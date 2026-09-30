import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('static app works below a GitHub Pages project path and keeps repository files private',async()=>{
 const child=spawn(process.execPath,['tools/serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0',BASE_PATH:'/cb-follow-through/'},stdio:['ignore','pipe','pipe']});
 try {
  const [line]=await once(child.stdout,'data'); const url=String(line).match(/http:\/\/[^\s]+/)[0];
  const index=await fetch(url);assert.equal(index.status,200);assert.equal(index.headers.get('content-type'),'text/html; charset=utf-8');
  for(const path of ['app.mjs','journal.mjs','style.css','data/journal.json'])assert.equal((await fetch(url+path)).status,200);
  assert.equal((await fetch(new URL('/.git/config',url))).status,404);assert.equal((await fetch(url+'%2e%2e%2fpackage.json')).status,404);assert.equal((await fetch(url+'absent')).status,404);
  const journal=await(await fetch(url+'data/journal.json')).json();assert.equal(journal.entries.length,44);
  assert.equal((await fetch(url+'data/cases.json')).status,404);
 }finally{child.kill();await once(child,'exit');}
});
