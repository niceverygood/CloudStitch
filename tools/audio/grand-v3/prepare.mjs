import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=path.join(root,'outputs/audio-grand-v3'),hash=b=>createHash('sha256').update(b).digest('hex');
const manifestPath='outputs/audio-rich-v2/delivery-manifest.json',mb=await fs.readFile(path.join(root,manifestPath)),m=JSON.parse(mb);
if(hash(mb)!=='26cb7743a373c99126fab156fa80c9927bea2904a4757406a73067e3198db823')throw new Error('Previous frozen manifest changed');
for(const f of m.files){const b=await fs.readFile(path.join(root,f.path));if(b.length!==f.bytes||hash(b)!==f.sha256)throw new Error('Frozen v2 changed: '+f.path);}
const previous=JSON.parse(await fs.readFile(path.join(root,'outputs/audio-rich-v2/catalog.json'),'utf8'));
const raw=JSON.parse(await fs.readFile(path.join(root,'outputs/audio-rich-v1/input-catalog.json'),'utf8'));
const decode=JSON.parse(await fs.readFile(path.join(root,'work/audio/rich-v1/decoding.json'),'utf8'));
await fs.mkdir(path.join(out,'original'),{recursive:true});
const assets=[];
for(const a of previous.assets){
 const originalRelative='outputs/audio-rich-v2/'+a.file,b=await fs.readFile(path.join(root,originalRelative)),r=raw.assets.find(x=>x.id===a.id),d=decode.clips.find(x=>x.id===a.id);
 if(hash(b)!==a.sha256||b.length!==a.bytes||!r||!d||d.sourceSha256!==r.source.sha256)throw new Error('Source mismatch: '+a.id);
 const float=await fs.readFile(path.join(root,d.path));if(hash(float)!==d.sha256)throw new Error('Original decoded PCM changed: '+a.id);
 const mp3=await fs.readFile(path.join(root,r.source.originalRelative));if(hash(mp3)!==r.source.sha256)throw new Error('Original MP3 changed: '+a.id);
 const file='original/'+a.id+'.wav',target=path.join(out,file);let exists=false;
 try{if(hash(await fs.readFile(target))!==a.sha256)throw new Error('Existing grand comparison copy differs');exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!exists)await fs.writeFile(target,b,{flag:'wx'});
 assets.push({id:a.id,label:a.label,category:a.category,loop:a.loop,description:a.description,source:{file,originalRelative,sha256:a.sha256,bytes:a.bytes,provider:'Cloudstitch · 중저음 v2',format:a.format,rights:r.source.rights},processingSource:{path:d.path,sha256:d.sha256,format:'IEEE_FLOAT32',frames:d.frames,sampleRate:d.sampleRate,channels:d.channels,originalMp3Relative:r.source.originalRelative,originalMp3Sha256:r.source.sha256,decodingReceipt:'work/audio/rich-v1/decoding.json'},provenance:{originalMp3:r.source,previousRecipe:a.recipe},file:'enhanced/'+a.id+'.wav',eventMapping:a.eventMapping,priority:a.priority,sourceHumanReview:a.sourceHumanReview,status:'grand_design_pending',humanApproved:false,gameplayInstalled:false});
}
const input={version:'audio-grand-v3.0.0',title:'Cloudstitch · 웅장·극적 사운드 비교실',purpose:'Rebuild source scale and dramatic material layers from original decoded PCM; compare with preserved v2',assets,counts:{logicalOriginalCues:47,mortarAlternatives:2,sources:49},paidGenerationRequests:0,gameplayInstalled:false,humanApproved:false,previousManifest:{file:manifestPath,sha256:hash(mb),files:m.files.length}};
await fs.writeFile(path.join(out,'input-catalog.json'),JSON.stringify(input,null,2)+'\n');
await fs.mkdir(path.join(root,'work/audio/grand-v3'),{recursive:true});
await fs.writeFile(path.join(root,'work/audio/grand-v3/previous-boundary.json'),JSON.stringify({manifest:input.previousManifest,files:[{path:manifestPath,bytes:mb.length,sha256:hash(mb)},...m.files]},null,2)+'\n');
console.log(JSON.stringify({sources:assets.length,previousFilesChecked:m.files.length+1,comparisonBytes:assets.reduce((s,a)=>s+a.source.bytes,0),processing:'original native-decoded Float32; no new API/native decode'}));
