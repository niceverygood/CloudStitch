import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const base=new URL(process.argv[2]||'http://127.0.0.1:8866/outputs/audio-rich-v1/');
if(!['127.0.0.1','localhost'].includes(base.hostname))throw new Error('Local review server only');
const hash=b=>createHash('sha256').update(b).digest('hex'),checks=[];
const check=(name,passed,detail={})=>checks.push({name,passed,...detail});
const response=await fetch(base),html=await response.text();
check('entry_and_self_csp',response.ok&&html.includes('풍성한 소리 비교실')&&response.headers.get('content-security-policy')?.includes("script-src 'self'"));
for(const [file,type] of [['../../tools/audio/rich-v1/review.mjs','javascript'],['../../tools/audio/rich-v1/review.css','text/css'],['catalog.json','application/json']]){
  const r=await fetch(new URL(file,base));check('local_resource:'+file,r.ok&&r.headers.get('content-type')?.includes(type));
}
const catalog=JSON.parse(await fs.readFile(path.join(root,'outputs/audio-rich-v1/catalog.json'),'utf8'));
const assets=catalog.assets.flatMap(a=>[{file:a.source.file,sha256:a.source.sha256,bytes:a.source.bytes,type:'audio/mpeg'},{file:a.file,sha256:a.sha256,bytes:a.bytes,type:'audio/wav'}]);
for(let i=0;i<assets.length;i+=6){
  const results=await Promise.allSettled(assets.slice(i,i+6).map(async a=>{const r=await fetch(new URL(a.file,base)),bytes=Buffer.from(await r.arrayBuffer());check('audio:'+a.file,r.ok&&r.headers.get('content-type')?.includes(a.type)&&bytes.length===a.bytes&&hash(bytes)===a.sha256,{bytes:bytes.length});}));
  for(const result of results)if(result.status==='rejected')check('audio_fetch_failure',false,{message:result.reason.message});
}
for(const relative of ['/README.md','/outputs/audio-review-v2/catalog.json','/outputs/audio-rich-v1/%2e%2e%5c%2e%2e%5cREADME.md']){
  const r=await fetch(new URL(relative,base));check('boundary:'+relative,r.status===403||r.status===404,{status:r.status});
}
const post=await fetch(base,{method:'POST'});check('read_only_server',post.status===405);
check('all_audio_requested',assets.length===98);
const report={version:'audio-rich-http-qa/v1',createdAt:new Date().toISOString(),base:base.href,passed:checks.every(c=>c.passed),total:checks.length,passedCount:checks.filter(c=>c.passed).length,checks,scope:'Local HTTP MIME, actual downloaded byte counts and SHA, dependency loading, read-only boundary. No browser playback or human listening.',externalRequests:0};
await fs.writeFile(path.join(root,'outputs/audio-rich-v1/http-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:report.total,failed:checks.filter(c=>!c.passed)}));if(!report.passed)process.exitCode=1;
