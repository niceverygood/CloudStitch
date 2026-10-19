/** Sequential local HTTP smoke, not browser/media QA. */
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {SOUND_DEFINITIONS} from './synthesis.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),port=18852;
const args=[path.join(root,'tools/audio/serve.mjs'),String(port)];if(process.argv[2])args.push('--integration-root',path.resolve(process.argv[2]));
const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
const checks=[],base=`http://127.0.0.1:${port}`;
try{
  let ready=false;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('local server timeout')),30000);child.stdout.on('data',()=>{ready=true;clearTimeout(timer);resolve();});child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('exit',code=>{clearTimeout(timer);if(!ready)reject(new Error('server startup failed '+code));});});
  const paths=['/outputs/audio-v1/','/tools/audio/audition.mjs','/tools/audio/host.html','/tools/audio/host.mjs','/tools/audio/synthesis.mjs','/tools/audio/runtime.mjs','/tools/audio/adapter.mjs','/tools/audio/panel.mjs','/tools/audio/style.css','/tools/audio/offline-check.html','/tools/audio/offline-check.mjs','/outputs/audio-v1/catalog.json',...SOUND_DEFINITIONS.map(s=>`/outputs/audio-v1/previews/${s.id}.wav`)];
  if(process.argv[2])paths.push('/integration-source/tools/integration/session.mjs','/integration-source/tools/integration/contract.mjs','/integration-source/tools/encounters/catalog.json','/integration-source/tools/battlefield/sim.mjs');
  for(const route of paths){const r=await fetch(base+route);assert.equal(r.status,200,route);const bytes=new Uint8Array(await r.arrayBuffer());assert.ok(bytes.length>0);if(route.endsWith('.mjs'))assert.match(r.headers.get('content-type'),/javascript/);if(route.endsWith('.json'))assert.match(r.headers.get('content-type'),/application\/json/);if(route.endsWith('.wav'))assert.equal(Buffer.from(bytes).subarray(0,4).toString(),'RIFF');checks.push({route,bytes:bytes.length,status:200});}
  const blocked=await fetch(base+'/package.json');assert.equal(blocked.status,403);checks.push({route:'/package.json',status:403,expected:'outside audio scope rejected'});
  const catalog=JSON.parse(await readFile(path.join(root,'outputs/audio-v1/catalog.json'),'utf8'));assert.equal(catalog.assets.length,SOUND_DEFINITIONS.length);
  const report={version:'audio-v1.0.0-ready',passed:true,checks,scope:'Node local HTTP GET + MIME + WAV RIFF smoke; no browser/audio playback',browserPerformed:false,humanListeningPerformed:false,externalFetches:0};await writeFile(path.join(root,'outputs/audio-v1/http-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,requests:checks.length,browserPerformed:false}));
}finally{child.kill();}
