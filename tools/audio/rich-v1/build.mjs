import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=path.join(root,'outputs/audio-rich-v1'),hash=b=>createHash('sha256').update(b).digest('hex');
await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'index.html'),await fs.readFile(path.join(root,'tools/audio/rich-v1/index-template.html')));
if(process.argv.includes('--manifest')){
  const files=[];async function walk(relative){for(const entry of await fs.readdir(path.join(root,relative),{withFileTypes:true})){const p=relative+'/'+entry.name;if(entry.isDirectory())await walk(p);else if(!p.endsWith('/delivery-manifest.json')){const b=await fs.readFile(path.join(root,p));files.push({path:p,bytes:b.length,sha256:hash(b)});}}}
  await walk('tools/audio/rich-v1');await walk('outputs/audio-rich-v1');files.sort((a,b)=>a.path.localeCompare(b.path));const catalog=JSON.parse(await fs.readFile(path.join(out,'catalog.json'),'utf8'));
  const manifest={version:'audio-rich-v1.0.1-ready',revision:2,catalogVersion:catalog.version,status:'PCM_ENHANCEMENT_REVIEW_CANDIDATES',files,totalBytes:files.reduce((sum,f)=>sum+f.bytes,0),summary:catalog.summary,preserves:['audio-review-v2 113 frozen files','audio-mortar-r1 18 frozen files','audio-v1 46 frozen files'],excludes:['work-only decoded IEEE_FLOAT32 intermediates','this manifest itself'],entry:'outputs/audio-rich-v1/index.html',handoff:'tools/audio/rich-v1/HANDOFF.md',sourceHumanApproval:'Original mortar launch rejected; A/B selection and other candidates unapproved. Enhancement does not grant approval.',gameplayInstalled:false,paidGenerationRequests:0};
  await fs.writeFile(path.join(out,'delivery-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({version:manifest.version,files:files.length,bytes:manifest.totalBytes,sha256:hash(await fs.readFile(path.join(out,'delivery-manifest.json')))}));
}else console.log('Audio rich review page built.');
