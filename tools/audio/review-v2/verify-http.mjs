/** Local HTTP/MIME/path audit only; no browser and no audio playback. */
import {spawn} from 'node:child_process';
import {writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url)),port=18854;
const child=spawn(process.execPath,[path.join(root,'tools/audio/review-v2/serve.mjs'),String(port)],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
const checks=[];
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Local server timeout')),30000);child.stdout.on('data',()=>{clearTimeout(timer);resolve();});child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code));});});
  const catalog=JSON.parse(await readFile(path.join(root,'outputs/audio-review-v2/catalog.json'),'utf8'));
  for(const route of ['/outputs/audio-review-v2/','/outputs/audio-review-v2/catalog.json','/tools/audio/review-v2/review.mjs','/tools/audio/review-v2/review.css',...catalog.assets.map(a=>'/outputs/audio-review-v2/'+a.file)]){
    const response=await fetch(`http://127.0.0.1:${port}`+route);assert.equal(response.status,200,route);const bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.length>0);
    const asset=catalog.assets.find(a=>route.endsWith('/'+a.file));if(asset){assert.match(response.headers.get('content-type'),/audio\/mpeg/);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
    if(route.endsWith('.mjs'))assert.match(response.headers.get('content-type'),/javascript/);
    checks.push({route,status:response.status,bytes:bytes.length});
  }
  for(const route of ['/AGENTS.md','/outputs/audio-review-v2/..%5c..%5cAGENTS.md','/tools/audio/review-v2/..%5c..%5c..%5cAGENTS.md','/outputs/audio-review-v2/%2e%2e%5c%2e%2e%5c.env']){
    const response=await fetch(`http://127.0.0.1:${port}`+route);assert.equal(response.status,403,route);checks.push({route,status:403,expected:'outside owned review paths rejected'});
  }
  const report={version:'audio-review-http-1',passed:true,scope:'Node local HTTP responses, MIME, audio SHA and Windows encoded traversal denial; no browser/native decoding or listening.',checks,externalNetworkRequests:0,browserPerformed:false};
  await writeFile(path.join(root,'outputs/audio-review-v2/http-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,requests:checks.length,browserPerformed:false}));
}finally{child.kill();}
