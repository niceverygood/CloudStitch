import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),port=Number(process.argv[2]||8864);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local port');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.mp3':'audio/mpeg','.wav':'audio/wav','.md':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    let relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');
    if(!relative)relative='outputs/audio-review-v2/';
    if(!relative.startsWith('outputs/audio-review-v2/')&&!relative.startsWith('tools/audio/review-v2/')){res.writeHead(403);return res.end('Outside review pack');}
    let file=path.resolve(root,relative);const allowed=['outputs/audio-review-v2','tools/audio/review-v2'].map(folder=>path.resolve(root,folder));
    if(!allowed.some(folder=>file===folder||file.startsWith(folder+path.sep))){res.writeHead(403);return res.end();}
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; object-src 'none'; base-uri 'none'"});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404);res.end('Local file unavailable');}
}).listen(port,'127.0.0.1',()=>console.log(`Cloudstitch full SFX review: http://127.0.0.1:${port}/outputs/audio-review-v2/`));
