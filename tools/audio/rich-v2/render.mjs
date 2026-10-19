import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeWav,encodeWav} from './wav.mjs';
import {enhanceLowMid} from './dsp.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=path.join(root,'outputs/audio-rich-v2'),hash=b=>createHash('sha256').update(b).digest('hex');
const input=JSON.parse(await fs.readFile(path.join(out,'input-catalog.json'),'utf8')),assets=[];
await fs.mkdir(path.join(out,'enhanced'),{recursive:true});
for(const a of input.assets){
  const b=await fs.readFile(path.join(out,a.source.file));if(hash(b)!==a.source.sha256)throw new Error('Previous copy changed: '+a.id);
  const pcm=decodeWav(b),result=enhanceLowMid(pcm,a),bytes=encodeWav(result);
  if(result.sampleRate!==pcm.sampleRate||result.channels.length!==pcm.channels.length||result.channels[0].length!==pcm.channels[0].length)throw new Error('Format or length changed: '+a.id);
  await fs.writeFile(path.join(out,a.file),bytes);
  assets.push({...a,status:'lowmid_enhanced_unreviewed',sha256:hash(bytes),bytes:bytes.length,duration:result.channels[0].length/result.sampleRate,format:{container:'WAV',codec:'PCM_S16LE',sampleRate:result.sampleRate,channels:result.channels.length},metrics:{source:result.metrics.original,output:result.metrics.output,...result.metrics},recipe:result.recipe,richDescription:result.recipe.description||'前 v1의 질감 위에 저음과 중저음 몸통을 더했습니다. 새 v2 WAV에 처리한 결과입니다.',derivation:{input:'preserved rich-v1 WAV',sourceSha256:a.source.sha256,method:'offline material-aware low shelf and broad low-mid EQ; no new synthesized sound',paidGenerationRequests:0}});
}
const summary={sources:49,rendered:assets.length,logicalOriginalCues:47,mortarAlternatives:2,sourceBytes:assets.reduce((s,a)=>s+a.source.bytes,0),renderedBytes:assets.reduce((s,a)=>s+a.bytes,0),maximumOutputPeak:Math.max(...assets.map(a=>a.metrics.output.peak)),paidGenerationRequests:0,humanApproval:false,gameplayInstalled:false};
await fs.writeFile(path.join(out,'catalog.json'),JSON.stringify({...input,assets,summary},null,2)+'\n');
await fs.writeFile(path.join(out,'render-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
