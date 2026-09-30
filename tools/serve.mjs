import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../site/',import.meta.url)));
const base=('/'+(process.env.BASE_PATH||'').replace(/^\/+|\/+$/g,'')+'/').replace('//','/');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=createServer(async(req,res)=>{ try {
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if (base!=='/' && path===base.slice(0,-1)) {res.writeHead(301,{Location:base});res.end();return;}
 if(!path.startsWith(base))throw Error('not found');
 const relative=path.slice(base.length)||'index.html'; const target=resolve(root,relative);
 if(!target.startsWith(root+sep)||!(await stat(target)).isFile())throw Error('not found');
 res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await readFile(target));
 } catch {res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`Follow-through preview: http://127.0.0.1:${server.address().port}${base}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
