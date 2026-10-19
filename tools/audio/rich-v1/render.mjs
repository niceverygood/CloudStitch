import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeWav,encodeWav} from './wav.mjs';
import {enrichPcm} from './dsp.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=path.join(root,'outputs/audio-rich-v1'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
await fs.mkdir(path.join(out,'enhanced'),{recursive:true});
const input=JSON.parse(await fs.readFile(path.join(out,'input-catalog.json'),'utf8')),decoding=JSON.parse(await fs.readFile(path.join(root,'work/audio/rich-v1/decoding.json'),'utf8'));
const assets=[];for(const asset of input.assets){
  const decoded=decoding.clips.find(c=>c.id===asset.id);if(!decoded||decoded.sourceSha256!==asset.source.sha256)throw new Error('Native decoding receipt missing: '+asset.id);
  const originalBytes=await fs.readFile(path.join(root,decoded.path));if(hash(originalBytes)!==decoded.sha256)throw new Error('Intermediate PCM hash mismatch: '+asset.id);
  const pcm=decodeWav(originalBytes),result=enrichPcm(pcm,asset,{strength:1,bass:1}),bytes=encodeWav(result);
  await fs.writeFile(path.join(out,asset.file),bytes);
  const sourceMetrics=result.metrics.original||result.metrics.source;
  assets.push({...asset,status:'enhanced_unreviewed',sha256:hash(bytes),bytes:bytes.length,duration:result.channels[0].length/result.sampleRate,format:{container:'WAV',codec:'PCM_S16LE',sampleRate:result.sampleRate,channels:result.channels.length},metrics:{source:sourceMetrics,output:result.metrics.output,addedBass:result.metrics.addedBass,...result.metrics},recipe:result.recipe,richDescription:result.recipe.description||result.recipe.note||'재료 공명·짧은 공간층·은은한 저음을 추가한 검수 후보',derivation:{method:'deterministic offline PCM enhancement of preserved ElevenLabs original',decodedSource:{path:decoded.path,format:pcm.format,sha256:decoded.sha256},nativeDecoder:'Chromium OfflineAudioContext.decodeAudioData; no playback',sourceSha256:asset.source.sha256,paidGenerationRequests:0}});
}
const summary={sourceClips:49,logicalOriginalCues:47,mortarAlternatives:2,rendered:assets.length,sourceBytes:assets.reduce((n,a)=>n+a.source.bytes,0),renderedBytes:assets.reduce((n,a)=>n+a.bytes,0),paidGenerationRequests:0,maximumOutputPeak:Math.max(...assets.map(a=>a.metrics.output.peak)),humanApproval:false,gameplayInstalled:false};
await fs.writeFile(path.join(out,'catalog.json'),JSON.stringify({...input,assets,summary,renderedAt:new Date().toISOString()},null,2)+'\n');
await fs.writeFile(path.join(out,'decoding.json'),JSON.stringify({...decoding,clips:decoding.clips.map(c=>({...c,path:undefined,intermediate:'work-only Float32 WAV (not included in delivery)'}))},null,2)+'\n');
await fs.writeFile(path.join(out,'render-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
