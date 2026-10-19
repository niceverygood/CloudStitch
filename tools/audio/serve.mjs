import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2),at=args.indexOf('--integration-root');
const integrationRoot=at>=0?path.resolve(args[at+1]||''):null;
const port=Number(args.find((v,i)=>/^\d+$/.test(v)&&i!==at+1)||8852);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local port');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.wav':'audio/wav','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    let base=root,relative=pathname.replace(/^\//,'');
    if(pathname.startsWith('/integration-source/')){
      if(!integrationRoot){res.writeHead(404);return res.end('Use --integration-root to read the frozen controller.');}
      base=integrationRoot;relative=pathname.slice('/integration-source/'.length);
      if(!relative.startsWith('tools/'))throw new Error('Forbidden');
    }else if(pathname==='/')relative='outputs/audio-v1/index.html';
    else if(!pathname.startsWith('/tools/audio/')&&!pathname.startsWith('/outputs/audio-v1/'))throw new Error('Forbidden');
    let file=path.resolve(base,relative);
    if(file!==base&&!file.startsWith(base+path.sep))throw new Error('Forbidden');
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);
  }catch(error){res.writeHead(error.message==='Forbidden'?403:404);res.end('Local file unavailable');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Cloudstitch audio: http://127.0.0.1:${port}/outputs/audio-v1/\nFrozen controller mount: ${integrationRoot?'enabled (read only)':'disabled; audition remains available'}`));
