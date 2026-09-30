import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const checker=fileURLToPath(new URL('../tools/check-append-only.mjs',import.meta.url));
const seed=JSON.parse(await readFile(new URL('../site/data/journal.json',import.meta.url),'utf8'));
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
 } finally {await rm(dir,{recursive:true,force:true});}
});
