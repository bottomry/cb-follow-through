import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const checker=fileURLToPath(new URL('../tools/check-append-only.mjs',import.meta.url));
const seed=JSON.parse(await readFile(new URL('../site/data/journal.json',import.meta.url),'utf8'));
test('a clean root checkout accepts its initial journal but checks explicit bases',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'follow-through-root-'));
 const path=join(dir,'site/data/journal.json');
 const run=(cmd,args=[],env={})=>spawnSync(cmd,args,{cwd:dir,encoding:'utf8',env:{...process.env,...env}});
 try {
  await mkdir(join(dir,'site/data'),{recursive:true});
  await writeFile(path,JSON.stringify(seed));
  for(const args of [['init','-q'],['config','user.email','fixture@example.org'],
   ['config','user.name','Fixture'],['add','site/data/journal.json'],['commit','-qm','Public root']])
   assert.equal(run('git',args).status,0);
  assert.equal(run(process.execPath,[checker]).status,0);
  assert.equal(run(process.execPath,[checker],{
   GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF_NAME:'main'
  }).status,0);
  const eventPath=join(dir,'push-event.json');
  await writeFile(eventPath,JSON.stringify({before:'a'.repeat(40)}));
  const missingPrior=run(process.execPath,[checker],{
   GITHUB_EVENT_NAME:'push',GITHUB_EVENT_PATH:eventPath,GITHUB_REF_NAME:'main'
  });
  assert.notEqual(missingPrior.status,0);
  assert.match(missingPrior.stderr,/Cannot verify journal base a{40}/);
  await writeFile(eventPath,JSON.stringify({before:'0'.repeat(40)}));
  assert.equal(run(process.execPath,[checker],{
   GITHUB_EVENT_NAME:'push',GITHUB_EVENT_PATH:eventPath,GITHUB_REF_NAME:'main'
  }).status,0);
  assert.notEqual(run(process.execPath,[checker],{JOURNAL_BASE_REF:'missing-ref'}).status,0);
  const blob=run('git',['rev-parse','HEAD:site/data/journal.json']).stdout.trim();
  assert.notEqual(run(process.execPath,[checker],{JOURNAL_BASE_REF:blob}).status,0);
  const altered=structuredClone(seed);altered.entries[0].payload.scope='Rewritten scope';
  await writeFile(path,JSON.stringify(altered));
  const dirtyRoot=run(process.execPath,[checker]);
  assert.notEqual(dirtyRoot.status,0);
  assert.match(dirtyRoot.stderr,/differs from the committed initial journal/);
  const dirtyDispatch=run(process.execPath,[checker],{
   GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF_NAME:'main'
  });
  assert.notEqual(dirtyDispatch.status,0);
  assert.match(dirtyDispatch.stderr,/differs from the committed initial journal/);
  assert.notEqual(run(process.execPath,[checker],{JOURNAL_BASE_REF:'HEAD'}).status,0);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('history gate accepts additions and rejects rewritten prior entries',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'follow-through-journal-'));
 const path=join(dir,'site/data/journal.json');
 const run=(cmd,args=[],env={})=>spawnSync(cmd,args,{cwd:dir,encoding:'utf8',env:{...process.env,...env}});
 try {
  await mkdir(join(dir,'site/data'),{recursive:true});
  await writeFile(path,JSON.stringify(seed));
  for(const args of [['init','-q'],['config','user.email','fixture@example.org'],
   ['config','user.name','Fixture'],['add','site/data/journal.json'],['commit','-qm','Initial journal']])
   assert.equal(run('git',args).status,0);
  const initial=run('git',['rev-parse','HEAD']).stdout.trim();
  await writeFile(join(dir,'setup.txt'),'Unrelated second commit.');
  assert.equal(run('git',['add','setup.txt']).status,0);
  assert.equal(run('git',['commit','-qm','Setup follow-up']).status,0);
  const zeroBase=run(process.execPath,[checker],{JOURNAL_BASE_REF:'0'.repeat(40)});
  assert.notEqual(zeroBase.status,0);
  assert.match(zeroBase.stderr,/Cannot verify journal base 0000000000000000000000000000000000000000/);
  const check=()=>run(process.execPath,[checker],{JOURNAL_BASE_REF:'HEAD'});
  assert.equal(check().status,0);
  const altered=structuredClone(seed);altered.entries[0].payload.scope='Rewritten scope';
  await writeFile(path,JSON.stringify(altered));
  const rejected=check();assert.notEqual(rejected.status,0);
  assert.match(rejected.stderr,/rewrites or removes earlier entries/);
  const appended=structuredClone(seed);appended.entries.push({
   seq:appended.entries.length+1,recorded_on:'2026-09-30',kind:'collection_updated',
   payload:{reason:'Fixture update',changes:{reviewed_on:'2026-09-30'}}
  });
  await writeFile(path,JSON.stringify(appended));
  assert.equal(check().status,0);

  await writeFile(path,JSON.stringify(altered));
  assert.equal(run('git',['add','site/data/journal.json']).status,0);
  assert.equal(run('git',['commit','-qm','Rewrite prior evidence']).status,0);
  await writeFile(join(dir,'later.txt'),'A later unrelated commit.');
  assert.equal(run('git',['add','later.txt']).status,0);
  assert.equal(run('git',['commit','-qm','Later change']).status,0);
  const eventPath=join(dir,'push-event.json');
  await writeFile(eventPath,JSON.stringify({before:initial}));
  const pushed=run(process.execPath,[checker],{
   JOURNAL_BASE_REF:'',GITHUB_EVENT_NAME:'push',GITHUB_EVENT_PATH:eventPath,GITHUB_REF_NAME:'main'
  });
  assert.notEqual(pushed.status,0);
  assert.match(pushed.stderr,/rewrites or removes earlier entries/);
  const shallow=join(dir,'shallow');
  assert.equal(run('git',['clone','-q','--depth=1','file://'+dir,shallow]).status,0);
  const shallowCheck=spawnSync(process.execPath,[checker],{
   cwd:shallow,encoding:'utf8',env:process.env
  });
  assert.notEqual(shallowCheck.status,0);
  assert.match(shallowCheck.stderr,/Cannot verify journal base HEAD\^/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('a first branch push compares with its merge base, not moving main',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'follow-through-branch-'));
 const path=join(dir,'site/data/journal.json');
 const run=(cmd,args=[],env={})=>spawnSync(cmd,args,{cwd:dir,encoding:'utf8',env:{...process.env,...env}});
 const append=reason=>{
  const data=structuredClone(seed);data.entries.push({seq:data.entries.length+1,recorded_on:'2026-09-30',
   kind:'collection_updated',payload:{reason,changes:{reviewed_on:'2026-09-30'}}});return data;
 };
 try {
  await mkdir(join(dir,'site/data'),{recursive:true});
  await writeFile(path,JSON.stringify(seed));
  for(const args of [['init','-q'],['config','user.email','fixture@example.org'],
   ['config','user.name','Fixture'],['add','site/data/journal.json'],['commit','-qm','Initial journal']])
   assert.equal(run('git',args).status,0);
  const branchPoint=run('git',['rev-parse','HEAD']).stdout.trim();
  assert.equal(run('git',['switch','-qc','feature']).status,0);
  await writeFile(path,JSON.stringify(append('Feature review')));
  assert.equal(run('git',['add','site/data/journal.json']).status,0);
  assert.equal(run('git',['commit','-qm','Feature addition']).status,0);
  const feature=run('git',['rev-parse','HEAD']).stdout.trim();
  assert.equal(run('git',['switch','-qc','moving-main',branchPoint]).status,0);
  await writeFile(path,JSON.stringify(append('Main review')));
  assert.equal(run('git',['add','site/data/journal.json']).status,0);
  assert.equal(run('git',['commit','-qm','Main addition']).status,0);
  assert.equal(run('git',['update-ref','refs/remotes/origin/main','HEAD']).status,0);
  assert.equal(run('git',['switch','-q','feature']).status,0);
  assert.equal(run('git',['rev-parse','HEAD']).stdout.trim(),feature);
  const eventPath=join(dir,'push-event.json');
  await writeFile(eventPath,JSON.stringify({before:'0'.repeat(40)}));
  const checked=run(process.execPath,[checker],{
   JOURNAL_BASE_REF:'',GITHUB_EVENT_NAME:'push',GITHUB_EVENT_PATH:eventPath,GITHUB_REF_NAME:'feature'
  });
  assert.equal(checked.status,0,checked.stderr);
  assert.match(checked.stdout,new RegExp('Preserved '+seed.entries.length+' earlier journal entries'));
 } finally {await rm(dir,{recursive:true,force:true});}
});
