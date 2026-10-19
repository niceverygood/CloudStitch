import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeWav,encodeWav} from './wav.mjs';
import {designCinematic,VERSION} from './dsp.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=path.join(root,'outputs/audio-cinematic-v5'),hash=b=>createHash('sha256').update(b).digest('hex');
const previousPath='outputs/audio-grand-v4/delivery-manifest.json',mb=await fs.readFile(path.join(root,previousPath));
if(hash(mb)!=='c7bec6defed1cd135de57330ced6b0f3fb1685093dc2ec28a5100eeac832ab71')throw Error('Frozen v4 changed');
const old=JSON.parse(await fs.readFile(path.join(root,'outputs/audio-grand-v4/catalog.json'),'utf8'));
const selection=process.argv.find(x=>x.startsWith('--ids='))?.slice(6).split(','),chosen=old.assets.filter(a=>!selection||selection.includes(a.id));
const donors=['hit-wood','hit-armor','hit-engine','mortar-impact','machinegun-feed','wind-fast-loop','wind-calm-loop','hull-creak-loop','chain-spin','engine-idle-loop','engine-cruise-loop','flame-ignite'];
const needed=new Set([...chosen.map(a=>a.id),...donors]),library={};
for(const a of old.assets.filter(a=>needed.has(a.id))){const b=await fs.readFile(path.join(root,a.processingSource.path));if(hash(b)!==a.processingSource.sha256)throw Error('Source changed '+a.id);library[a.id]={...decodeWav(b),sha256:hash(b),path:a.processingSource.path};}
for(const d of ['original','enhanced'])await fs.mkdir(path.join(out,d),{recursive:true});
const assets=[];
for(const a of chosen){
 const relative='outputs/audio-grand-v4/'+a.file,b=await fs.readFile(path.join(root,relative));if(hash(b)!==a.sha256)throw Error('Comparison changed '+a.id);
 const sourceFile='original/'+a.id+'.wav';await fs.writeFile(path.join(out,sourceFile),b);
 const result=designCinematic(library[a.id],a,{library}),bytes=encodeWav(result),file='enhanced/'+a.id+'.wav';await fs.writeFile(path.join(out,file),bytes);
 const s=decodeWav(b);let peak=0,e=0;for(const c of s.channels)for(const x of c){e+=x*x;peak=Math.max(peak,Math.abs(x));}
 assets.push({...a,file,source:{file:sourceFile,originalRelative:relative,sha256:hash(b),bytes:b.length,provider:'Cloudstitch · v4 (사용자 표현 반려)',rights:a.source.rights},previousV4Recipe:a.recipe,recipe:result.recipe,metrics:{source:{peak,rms:Math.sqrt(e/(s.channels.length*s.channels[0].length)),duration:s.duration,frames:s.channels[0].length},processing:result.metrics.original,output:result.metrics.output},richDescription:result.recipe.description,sha256:hash(bytes),bytes:bytes.length,duration:result.metrics.output.duration,status:'cinematic_redesign_unreviewed',humanApproved:false,gameplayInstalled:false,derivation:{processing:'Original Float32 material + deterministic original synthesis; not enhanced v4 input',paidGenerationRequests:0,dspSha256:hash(await fs.readFile(new URL('./dsp.mjs',import.meta.url)))}});
 console.log(JSON.stringify({id:a.id,seconds:result.metrics.output.duration,peak:result.metrics.output.peak,rms:result.metrics.output.rms,layers:result.recipe.layers.length}));
}
const catalog={version:VERSION,title:'Cloudstitch · 시네마틱 사운드 v5',assets,previousManifest:{file:previousPath,sha256:hash(mb)},purpose:'v4 rejected as still insufficiently dramatic. Radically recompose contact, pressure, discharge, fracture, debris and long aftermath. Tenfold is a listening target, not a numeric pass.',counts:{rendered:assets.length,logicalOriginalCues:47,mortarAlternatives:2},summary:{rendered:assets.length,renderedBytes:assets.reduce((s,a)=>s+a.bytes,0),sourceBytes:assets.reduce((s,a)=>s+a.source.bytes,0),paidGenerationRequests:0,humanApproval:false,gameplayInstalled:false},humanApproved:false,gameplayInstalled:false,paidGenerationRequests:0};
await fs.writeFile(path.join(out,selection?'prototype-catalog.json':'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify(catalog.summary));
