import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeWav,encodeWav} from './wav.mjs';
import {designGrand} from './dsp.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=path.join(root,'outputs/audio-grand-v4'),hash=b=>createHash('sha256').update(b).digest('hex');
const input=JSON.parse(await fs.readFile(path.join(out,'input-catalog.json'),'utf8')),assets=[];
const selection=process.argv.find(s=>s.startsWith('--ids='))?.slice(6).split(',');
await fs.mkdir(path.join(out,'enhanced'),{recursive:true});
const library={};
for(const a of input.assets){const b=await fs.readFile(path.join(root,a.processingSource.path));if(hash(b)!==a.processingSource.sha256)throw new Error('Library source changed: '+a.id);library[a.id]={...decodeWav(b),sha256:hash(b),path:a.processingSource.path};}
function measure(pcm){let energy=0,peak=0,seam=0;for(const ch of pcm.channels){for(const x of ch){if(!Number.isFinite(x))throw new Error('Non-finite comparison input');energy+=x*x;peak=Math.max(peak,Math.abs(x));}seam=Math.max(seam,Math.abs(ch[0]-ch.at(-1)));}const frames=pcm.channels[0].length;return {peak,rms:Math.sqrt(energy/(frames*pcm.channels.length)),energy,frames,channels:pcm.channels.length,duration:frames/pcm.sampleRate,sampleRate:pcm.sampleRate,finite:true,seam};}
for(const a of input.assets){
 if(selection&&!selection.includes(a.id))continue;
 const b=await fs.readFile(path.join(out,a.source.file));if(hash(b)!==a.source.sha256)throw new Error('Comparison source changed: '+a.id);
 const pb=await fs.readFile(path.join(root,a.processingSource.path));if(hash(pb)!==a.processingSource.sha256)throw new Error('Processing source changed: '+a.id);
 const comparison=decodeWav(b),pcm=decodeWav(pb),result=designGrand(pcm,a,{library}),bytes=encodeWav(result);
 for(const stem of result.recipe.stems||[]){if(!library[stem.id])throw new Error('Unknown donor: '+stem.id);stem.sha256=library[stem.id].sha256;stem.processingPath=library[stem.id].path;}
 if(result.sampleRate!==pcm.sampleRate||result.channels.length!==pcm.channels.length)throw new Error('Rate or channel count changed: '+a.id);
 await fs.writeFile(path.join(out,a.file),bytes);
 assets.push({...a,status:'grand_design_unreviewed',sha256:hash(bytes),bytes:bytes.length,duration:result.channels[0].length/result.sampleRate,format:{container:'WAV',codec:'PCM_S16LE',sampleRate:result.sampleRate,channels:result.channels.length},metrics:{...result.metrics,source:measure(comparison),processing:result.metrics.original,output:result.metrics.output},recipe:result.recipe,richDescription:result.recipe.description||'원재료의 음고·질감·몸통과 충격 뒤 여운을 다시 구성한 웅장·극적 v4',derivation:{input:'first original decoded Float32, not accumulated v1/v2 EQ',comparisonSha256:a.source.sha256,processingSha256:a.processingSource.sha256,paidGenerationRequests:0}});
}
const summary={sources:49,rendered:assets.length,logicalOriginalCues:47,mortarAlternatives:2,sourceBytes:assets.reduce((s,a)=>s+a.source.bytes,0),renderedBytes:assets.reduce((s,a)=>s+a.bytes,0),maximumOutputPeak:Math.max(...assets.map(a=>a.metrics.output.peak)),paidGenerationRequests:0,humanApproval:false,gameplayInstalled:false};
const file=selection?'prototype-catalog.json':'catalog.json';
await fs.writeFile(path.join(out,file),JSON.stringify({...input,assets,summary},null,2)+'\n');
if(!selection)await fs.writeFile(path.join(out,'render-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
