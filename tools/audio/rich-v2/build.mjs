import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=path.join(root,'outputs/audio-rich-v2'),hash=b=>createHash('sha256').update(b).digest('hex');
await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'index.html'),await fs.readFile(path.join(root,'tools/audio/rich-v2/index-template.html')));
if(process.argv.includes('--manifest')){
 const files=[];async function walk(relative){for(const f of await fs.readdir(path.join(root,relative),{withFileTypes:true})){const p=relative+'/'+f.name;if(f.isDirectory())await walk(p);else if(!p.endsWith('/delivery-manifest.json')){const b=await fs.readFile(path.join(root,p));files.push({path:p,bytes:b.length,sha256:hash(b)});}}}
 await walk('tools/audio/rich-v2');await walk('outputs/audio-rich-v2');files.sort((a,b)=>a.path.localeCompare(b.path));const catalog=JSON.parse(await fs.readFile(path.join(out,'catalog.json'),'utf8'));
 const manifest={version:'audio-rich-v2.0.0-ready',status:'LOWMID_ENHANCEMENT_REVIEW_CANDIDATES',files,totalBytes:files.reduce((s,f)=>s+f.bytes,0),summary:catalog.summary,previousManifest:catalog.previousManifest,entry:'outputs/audio-rich-v2/index.html',handoff:'tools/audio/rich-v2/HANDOFF.md',sourceHumanApproval:'Old mortar launch remains rejected; A/B selection pending. v1 and v2 are review candidates.',gameplayInstalled:false,paidGenerationRequests:0};
 const b=Buffer.from(JSON.stringify(manifest,null,2)+'\n');await fs.writeFile(path.join(out,'delivery-manifest.json'),b);console.log(JSON.stringify({files:files.length,bytes:manifest.totalBytes,sha256:hash(b)}));
}else console.log('Low-mid comparison page built.');
