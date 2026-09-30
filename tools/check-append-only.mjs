import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
const path='site/data/journal.json';
function git(...args) {
 const result=spawnSync('git',args,{encoding:'utf8'});
 if(result.error)throw result.error;
 return result;
}
const current=JSON.parse(readFileSync(path,'utf8'));
const branch=process.env.GITHUB_REF_NAME||git('branch','--show-current').stdout.trim();
const base=process.env.JOURNAL_BASE_REF || (branch==='main'?'HEAD^':'origin/main');
if(git('rev-parse','--verify',base).status!==0)throw Error('Cannot verify journal base '+base);
const previous=git('show',base+':'+path);
if(previous.status!==0) {
 // The first journal commit has no earlier journal to preserve.
 if(git('cat-file','-e',base+':'+path).status===0)throw Error('Cannot read earlier journal.');
 console.log('No prior evidence journal at '+base+'; initial journal accepted.');
} else {
 const old=JSON.parse(previous.stdout);
 if(!Array.isArray(old.entries)||!Array.isArray(current.entries)||
    current.entries.length<old.entries.length||
    !old.entries.every((entry,index)=>isDeepStrictEqual(entry,current.entries[index])))
  throw Error('Evidence journal rewrites or removes earlier entries. Append a correction instead.');
 console.log('Preserved '+old.entries.length+' earlier journal entries.');
}
