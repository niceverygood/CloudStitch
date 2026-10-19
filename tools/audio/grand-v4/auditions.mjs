import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeWav,encodeWav} from './wav.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=path.join(root,'outputs/audio-grand-v4'),hash=b=>createHash('sha256').update(b).digest('hex');
const catalog=JSON.parse(await fs.readFile(path.join(out,process.argv.includes('--prototype')?'prototype-catalog.json':'catalog.json'),'utf8'));
const ids=['fire-machinegun','fire-cannon','mortar-launch-a','hit-wood','engine-idle-loop'];
function measure(p){let peak=0,e=0;for(const c of p.channels)for(const x of c){peak=Math.max(peak,Math.abs(x));e+=x*x;}return {peak,rms:Math.sqrt(e/(p.channels.length*p.channels[0].length)),frames:p.channels[0].length};}
await fs.mkdir(path.join(out,'auditions'),{recursive:true});const pairs=[];
for(const id of ids){
 const a=catalog.assets.find(a=>a.id===id);if(!a)throw new Error('Missing audition '+id);
 const versions=[];for(const [version,file]of[['v2',a.source.file],['v4',a.file]]){const bytes=await fs.readFile(path.join(out,file)),pcm=decodeWav(bytes);versions.push({version,file,sha256:hash(bytes),pcm,metrics:measure(pcm)});}
 const sr=versions[0].pcm.sampleRate;if(versions.some(v=>v.pcm.sampleRate!==sr||v.pcm.channels.length!==2))throw new Error('Audition format mismatch');
 const targetRms=Math.min(.12,...versions.map(v=>.65*v.metrics.rms/Math.max(v.metrics.peak,1e-12))),gapFrames=Math.round(sr*.35),frames=versions.reduce((n,v)=>n+v.metrics.frames,0)+gapFrames;
 const channels=[new Float32Array(frames),new Float32Array(frames)],segments=[];let cursor=0;
 for(const v of versions){const gain=targetRms/Math.max(v.metrics.rms,1e-12);for(let c=0;c<2;c++)for(let i=0;i<v.metrics.frames;i++)channels[c][cursor+i]=v.pcm.channels[c][i]*gain;segments.push({version:v.version,file:v.file,sha256:v.sha256,startFrame:cursor,frames:v.metrics.frames,gain,sourceRms:v.metrics.rms,sourcePeak:v.metrics.peak,expectedRms:targetRms});cursor+=v.metrics.frames+gapFrames;}
 const bytes=encodeWav({channels,sampleRate:sr}),file='auditions/'+id+'-ab.wav';await fs.writeFile(path.join(out,file),bytes);
 pairs.push({id,label:a.label,file,sha256:hash(bytes),bytes:bytes.length,sampleRate:sr,channels:2,frames,gapFrames,targetRms,peakLimit:.65,segments,order:['v2','v4'],humanApproval:false});
}
await fs.writeFile(path.join(out,'audition-catalog.json'),JSON.stringify({schema:'cloudstitch-grand-v4-paired-auditions/v1',purpose:'Same-event previous v2 then new v4, separated by 350 ms silence. Full-clip stereo RMS matched; not LUFS or human quality approval.',pairs,humanApproval:false},null,2)+'\n');console.log(JSON.stringify({pairs:pairs.length,bytes:pairs.reduce((n,p)=>n+p.bytes,0)}));
