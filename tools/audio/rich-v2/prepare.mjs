import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=path.join(root,'outputs/audio-rich-v2'),hash=b=>createHash('sha256').update(b).digest('hex');
const manifestPath='outputs/audio-rich-v1/delivery-manifest.json',mb=await fs.readFile(path.join(root,manifestPath)),m=JSON.parse(mb);
if(hash(mb)!=='9a50e6f105ff5497795fb33095cbc0dc71f2df88ac062372e6c6028e85709523')throw new Error('Previous frozen manifest changed');
for(const f of m.files){const b=await fs.readFile(path.join(root,f.path));if(b.length!==f.bytes||hash(b)!==f.sha256)throw new Error('Frozen previous file changed: '+f.path);}
const previous=JSON.parse(await fs.readFile(path.join(root,'outputs/audio-rich-v1/catalog.json'),'utf8'));
await fs.mkdir(path.join(out,'original'),{recursive:true});
const assets=[];
for(const a of previous.assets){
  const originalRelative='outputs/audio-rich-v1/'+a.file,b=await fs.readFile(path.join(root,originalRelative));
  if(hash(b)!==a.sha256||b.length!==a.bytes)throw new Error('Previous WAV mismatch: '+a.id);
  const file='original/'+a.id+'.wav',target=path.join(out,file);let exists=false;
  try{if(hash(await fs.readFile(target))!==a.sha256)throw new Error('Existing v2 source differs');exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!exists)await fs.writeFile(target,b,{flag:'wx'});
  assets.push({id:a.id,label:a.label,category:a.category,loop:a.loop,description:a.description,source:{file,originalRelative,sha256:a.sha256,bytes:a.bytes,provider:'Cloudstitch · 풍성한 소리 v1',format:a.format,rights:a.source.rights},provenance:{originalMp3:a.source,previousRecipe:a.recipe,previousCatalog:'outputs/audio-rich-v1/catalog.json'},file:'enhanced/'+a.id+'.wav',eventMapping:a.eventMapping,priority:a.priority,sourceHumanReview:a.sourceHumanReview,status:'lowmid_enhancement_pending',humanApproved:false,gameplayInstalled:false});
}
const input={version:'audio-rich-v2.0.0',title:'Cloudstitch · 중저음 강화 비교실',purpose:'Stronger body and low-mid balance compared directly with the preserved rich v1 WAVs',assets,counts:{logicalOriginalCues:47,mortarAlternatives:2,sources:49},paidGenerationRequests:0,gameplayInstalled:false,humanApproved:false,previousManifest:{file:manifestPath,sha256:hash(mb),files:m.files.length}};
await fs.writeFile(path.join(out,'input-catalog.json'),JSON.stringify(input,null,2)+'\n');
await fs.mkdir(path.join(root,'work/audio/rich-v2'),{recursive:true});
await fs.writeFile(path.join(root,'work/audio/rich-v2/previous-boundary.json'),JSON.stringify({manifest:input.previousManifest,files:[{path:manifestPath,bytes:mb.length,sha256:hash(mb)},...m.files]},null,2)+'\n');
console.log(JSON.stringify({sources:assets.length,previousFilesChecked:m.files.length+1,bytes:assets.reduce((s,a)=>s+a.source.bytes,0),paid:0}));
