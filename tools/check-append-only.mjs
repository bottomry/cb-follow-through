import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
const path='site/data/journal.json';
const zeroSha=/^0{40}$/;
function git(...args) {
 const result=spawnSync('git',args,{encoding:'utf8'});
 if(result.error)throw result.error;
 return result;
}
function eventBase() {
 if(!process.env.GITHUB_EVENT_NAME || !process.env.GITHUB_EVENT_PATH)return '';
 const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 if(process.env.GITHUB_EVENT_NAME==='pull_request')return event.pull_request?.base?.sha||'';
 if(process.env.GITHUB_EVENT_NAME==='push')return event.before||'';
 return '';
}
function fallbackBase(branch) {
 if(branch!=='main' && git('rev-parse','--verify','origin/main').status===0) {
  const result=git('merge-base','HEAD','origin/main');
  if(result.status===0 && result.stdout.trim())return result.stdout.trim();
 }
 return 'HEAD^';
}
const current=JSON.parse(readFileSync(path,'utf8'));
const branch=process.env.GITHUB_REF_NAME||git('branch','--show-current').stdout.trim();
const selected=process.env.JOURNAL_BASE_REF||eventBase();
const base=!selected||zeroSha.test(selected)?fallbackBase(branch):selected;
const baseExists=git('rev-parse','--verify',base+'^{commit}').status===0;
const headParents=git('rev-list','--parents','-n','1','HEAD').stdout.trim().split(/\s+/);
const rootBootstrap=!baseExists && headParents.length===1 && !process.env.JOURNAL_BASE_REF &&
 (base==='HEAD^'||process.env.GITHUB_EVENT_NAME==='push');
if(rootBootstrap) {
 console.log('Root commit has no reachable prior journal; initial journal accepted.');
} else if(!baseExists)throw Error('Cannot verify journal base '+base);
else if(git('show',base+':'+path).status!==0) {
 // The first journal commit has no earlier journal to preserve.
 if(git('cat-file','-e',base+':'+path).status===0)throw Error('Cannot read earlier journal.');
 console.log('No prior evidence journal at '+base+'; initial journal accepted.');
} else {
 const previous=git('show',base+':'+path);
 const old=JSON.parse(previous.stdout);
 if(!Array.isArray(old.entries)||!Array.isArray(current.entries)||
    current.entries.length<old.entries.length||
    !old.entries.every((entry,index)=>isDeepStrictEqual(entry,current.entries[index])))
  throw Error('Evidence journal rewrites or removes earlier entries. Append a correction instead.');
 console.log('Preserved '+old.entries.length+' earlier journal entries.');
}
