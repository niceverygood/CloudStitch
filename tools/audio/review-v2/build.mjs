import path from 'node:path';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=path.join(root,'outputs/audio-review-v2'),source=path.join(root,'tools/audio/review-v2');
await mkdir(out,{recursive:true});
await writeFile(path.join(out,'index.html'),await readFile(path.join(source,'index-template.html')));
const catalog=JSON.parse(await readFile(path.join(out,'catalog.json'),'utf8'));
const summary={version:catalog.version,planned:catalog.assets.length,generated:catalog.assets.filter(a=>a.status==='generated_unreviewed').length,reused:catalog.assets.filter(a=>a.status==='existing_reused').length,failed:catalog.assets.filter(a=>a.status==='failed').length,pending:catalog.assets.filter(a=>a.status==='pending').length,bytes:catalog.assets.reduce((n,a)=>n+(a.bytes||0),0),requestedSeconds:catalog.assets.reduce((n,a)=>n+a.duration,0),billedCharacterCost:catalog.assets.filter(a=>a.status==='generated_unreviewed').reduce((n,a)=>n+(Number(a.source?.billedCharacterCost)||0),0),humanReview:'pending',gameplayInstalled:false};
await writeFile(path.join(out,'generation-summary.json'),JSON.stringify(summary,null,2)+'\n');
if(process.argv.includes('--manifest')){
  const files=[];async function walk(relative){for(const e of await readdir(path.join(root,relative),{withFileTypes:true})){const p=relative+'/'+e.name;if(e.isDirectory())await walk(p);else if(!p.endsWith('/delivery-manifest.json')){const b=await readFile(path.join(root,p));files.push({path:p,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}}}
  await walk('tools/audio/review-v2');await walk('outputs/audio-review-v2');files.sort((a,b)=>a.path.localeCompare(b.path));
  const manifest={version:'audio-review-v2.0.0-ready',status:'GENERATED_REVIEW_PACK_NOT_HUMAN_APPROVED_OR_GAME_INSTALLED',summary,owners:['tools/audio/review-v2/','outputs/audio-review-v2/'],files,totalBytes:files.reduce((sum,f)=>sum+f.bytes,0),preserves:['Original procedural audio-v1 46 manifest-listed files','Existing ElevenLabs machinegun original and audition outputs','Frozen integration sources and game/save data'],excludedSelf:'outputs/audio-review-v2/delivery-manifest.json',entry:'outputs/audio-review-v2/index.html',handoff:'tools/audio/review-v2/HANDOFF.md',externalPlaybackRequests:false,credentialPersisted:false};
  await writeFile(path.join(out,'delivery-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({version:manifest.version,files:files.length,bytes:manifest.totalBytes,summary}));
}else console.log(JSON.stringify({built:true,summary}));
