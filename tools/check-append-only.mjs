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
function preserves(previous,next) {
 return Array.isArray(previous.entries)&&Array.isArray(next.entries)&&
  next.entries.length>=previous.entries.length&&
  previous.entries.every((entry,index)=>isDeepStrictEqual(entry,next.entries[index]));
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
const explicitBase=process.env.JOURNAL_BASE_REF;
const publishedBase=process.env.JOURNAL_PUBLISHED_BASE;
const initialPublish=process.env.JOURNAL_INITIAL_PUBLISH==='1';
const selected=explicitBase||eventBase();
const base=!selected||(!explicitBase&&zeroSha.test(selected))?fallbackBase(branch):selected;
const baseExists=git('rev-parse','--verify',base+'^{commit}').status===0;
const headObject=git('cat-file','-p','HEAD');
const headHeader=headObject.stdout.split('\n\n',1)[0];
const rootCommit=headObject.status===0 && !/^parent /m.test(headHeader);
const initialPush=process.env.GITHUB_EVENT_NAME==='push' && zeroSha.test(selected);
const dispatch=process.env.GITHUB_EVENT_NAME==='workflow_dispatch';
const trustedDispatch=dispatch&&(Boolean(publishedBase)||(initialPublish&&rootCommit));
if(dispatch&&!trustedDispatch)
 throw Error('Workflow dispatch requires a published journal baseline or a root initial publish.');
const baseFreeRun=!process.env.GITHUB_EVENT_NAME||trustedDispatch;
const rootBootstrap=!baseExists && rootCommit && !explicitBase &&
 (initialPush||(baseFreeRun&&base==='HEAD^'));
if(rootBootstrap) {
 const committed=git('show','HEAD:'+path);
 if(committed.status!==0)throw Error('Cannot read committed root journal.');
 if(!isDeepStrictEqual(JSON.parse(committed.stdout),current))
  throw Error('Root journal differs from the committed initial journal.');
 console.log('Root commit has no reachable prior journal; initial journal accepted.');
} else if(!baseExists)throw Error('Cannot verify journal base '+base);
else if(git('show',base+':'+path).status!==0) {
 // The first journal commit has no earlier journal to preserve.
 if(git('cat-file','-e',base+':'+path).status===0)throw Error('Cannot read earlier journal.');
 console.log('No prior evidence journal at '+base+'; initial journal accepted.');
} else {
 const previous=git('show',base+':'+path);
 const old=JSON.parse(previous.stdout);
 if(!preserves(old,current))
  throw Error('Evidence journal rewrites or removes earlier entries. Append a correction instead.');
 console.log('Preserved '+old.entries.length+' earlier journal entries.');
}
if(dispatch) {
 const history=git('rev-list','HEAD','--',path);
 if(history.status!==0)throw Error('Cannot inspect journal ancestry.');
 for(const ref of history.stdout.trim().split(/\s+/).filter(Boolean)) {
  const version=git('show',ref+':'+path);
  if(version.status!==0||!preserves(JSON.parse(version.stdout),current))
   throw Error('Evidence journal rewrites or removes entries from its ancestry.');
 }
 if(publishedBase) {
  const published=JSON.parse(readFileSync(publishedBase,'utf8'));
  if(!preserves(published,current))
   throw Error('Evidence journal rewrites or removes entries from the published baseline.');
 }
}
