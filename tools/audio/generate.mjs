/** Node-only deterministic WAV export + signal checks. No listening/browser claims. */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SOUND_DEFINITIONS, synthesize } from './synthesis.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'outputs/audio-v1');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function encodeWav({ samples, sampleRate }) {
  const result = Buffer.alloc(44 + samples.length * 2);
  result.write('RIFF',0); result.writeUInt32LE(result.length-8,4); result.write('WAVEfmt ',8);
  result.writeUInt32LE(16,16); result.writeUInt16LE(1,20); result.writeUInt16LE(1,22);
  result.writeUInt32LE(sampleRate,24); result.writeUInt32LE(sampleRate*2,28);
  result.writeUInt16LE(2,32); result.writeUInt16LE(16,34); result.write('data',36);
  result.writeUInt32LE(samples.length*2,40);
  for(let i=0;i<samples.length;i++) result.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
  return result;
}
export function measure(samples, sampleRate) {
  let peak=0,sum=0,mean=0,maxAdjacent=0,nonFinite=0;
  for(let i=0;i<samples.length;i++) {
    const value=samples[i]; if(!Number.isFinite(value)){nonFinite++;continue;}
    peak=Math.max(peak,Math.abs(value));sum+=value*value;mean+=value;
    if(i)maxAdjacent=Math.max(maxAdjacent,Math.abs(value-samples[i-1]));
  }
  const tailCount=Math.min(samples.length,Math.round(sampleRate*.01));let tailEnergy=0;
  for(let i=samples.length-tailCount;i<samples.length;i++)tailEnergy+=samples[i]*samples[i];
  return {samples:samples.length,duration:samples.length/sampleRate,peak,rms:Math.sqrt(sum/samples.length),dcMean:mean/samples.length,
    first:samples[0],last:samples.at(-1),firstAdjacent:Math.abs(samples[1]-samples[0]),lastAdjacent:Math.abs(samples.at(-1)-samples.at(-2)),
    seamDelta:Math.abs(samples[0]-samples.at(-1)),tail10msRms:Math.sqrt(tailEnergy/tailCount),maxAdjacent,nonFinite};
}

export async function generate() {
  await mkdir(path.join(output,'previews'),{recursive:true});
  const representativeIds=['fire-machinegun','fire-cannon','hit-wood','hit-cloth','connector-cut','salvage'];
  // Check the first material/envelope set before exporting the rest.
  const representativeChecks=representativeIds.map(id=>{
    const sound=synthesize(id),metrics=measure(sound.samples,sound.sampleRate);
    return {id,passed:metrics.peak<=.7&&metrics.rms>.005&&metrics.nonFinite===0&&metrics.last===0&&metrics.first===0,...metrics};
  });
  if(representativeChecks.some(item=>!item.passed))throw new Error('Representative SFX signal check failed');
  const assets=[],checks=[];
  for(const def of SOUND_DEFINITIONS){
    const sound=synthesize(def.id),again=synthesize(def.id),wav=encodeWav(sound),againWav=encodeWav(again);
    const metrics=measure(sound.samples,sound.sampleRate);
    const deterministic=wav.equals(againWav),varied=!wav.equals(encodeWav(synthesize(def.id,{seed:def.seed+1})));
    const passed=deterministic&&varied&&metrics.peak<=.7&&metrics.rms>.005&&metrics.nonFinite===0&&metrics.first===0&&metrics.last===0&&metrics.firstAdjacent<.01&&metrics.lastAdjacent<.01;
    await writeFile(path.join(output,'previews',`${def.id}.wav`),wav);
    assets.push({...def,use:def.description,path:`previews/${def.id}.wav`,format:{container:'WAV',codec:'PCM_S16LE',sampleRate:sound.sampleRate,channels:1},
      bytes:wav.length,sha256:hash(wav),source:'Authored locally with tools/audio/synthesis.mjs; seeded procedural synthesis; no third-party samples or downloads',
      rights:'Project-authored procedural prototype; no third-party source audio. Not a final recorded or commercial sound asset.',
      completion:'synthesis_and_wav_export_complete; integration and human listening recorded separately'});
    checks.push({id:def.id,passed,deterministic,seedVariation:varied,loop:def.loop,...metrics});
  }
  const totalBytes=assets.reduce((sum,item)=>sum+item.bytes,0);
  const catalog={version:'audio-v1.0.0',title:'Cloudstitch 절차 합성 SFX 시제품',sampleRate:22050,generatedBy:'node tools/audio/generate.mjs',
    sourceReferences:['outputs/34-sound-music-direction.txt','outputs/16-audio-accessibility-production.txt'],
    scope:'Temporary SFX and short ambience only. No music, voices or external audio. Current event mappings are read-only contracts, not claims of live integration.',
    sourceAuthority:'tools/battlefield/sim.mjs and frozen desktop-integration tools/integration/session.mjs inspected 2026-10-18; material resolution is adapter policy because hit has no material field.',
    hitWeaponPolicy:'Material recipes remain distinct. Read-only adapter uses 01-machine-gun gain×0.72/rate1.04 and 02-deck-cannon gain×0.95/rate0.9; one-shot runtime rate clamp 0.8..1.2. Preview WAVs retain each recipe at its default rate.',
    loopPolicy:'2-second periodic carriers, seeded phases, 5ms raised-cosine edge taper; exact zero endpoints and small seam derivatives. No long loop files.',
    totalWavBytes:totalBytes,assets};
  const verification={version:catalog.version,tool:'Node PCM synthesis and WAV export, not OfflineAudioContext',
    passed:checks.every(item=>item.passed)&&totalBytes<1000000,representativeIds,representativeChecks,checks,totalWavBytes:totalBytes,
    criteria:{peakMaximum:.7,rmsMinimum:.005,endpointsAbsolute:0,edgeAdjacentMaximum:.01,totalWavBytesMaximum:1000000,deterministic:true,seedVariation:true},
    humanListening:{performed:false,note:'Numerical signal checks cannot establish pleasantness, perceptual material identification, three-cue masking, mono/low-dynamic-range accessibility or device comfort. Audition and sequential QA required.'},
    offlineAudioContext:{performed:false,note:'Pure Node PCM path used. Web Audio browser render/real output remains QA handoff.'},
    limits:['All timbres are synthetic placeholders; not final Foley/recordings.','No gameplay simulation, rewards, time or state is modified.','Envelope RMS/peak does not prove human audibility or warning discrimination.','Loop taper has a 10ms total shallow breathing dip per 2 seconds; listening needed on speakers/headphones.']};
  await writeFile(path.join(output,'catalog.json'),`${JSON.stringify(catalog,null,2)}\n`);
  await writeFile(path.join(output,'signal-verification.json'),`${JSON.stringify(verification,null,2)}\n`);
  if(!verification.passed)throw new Error('Audio signal verification failed; inspect outputs/audio-v1/signal-verification.json');
  return {version:catalog.version,assets:assets.length,totalWavBytes:totalBytes,passed:verification.passed,
    peakMaximum:Math.max(...checks.map(item=>item.peak)),rmsMinimum:Math.min(...checks.map(item=>item.rms)),maxEdgeAdjacent:Math.max(...checks.map(item=>Math.max(item.firstAdjacent,item.lastAdjacent)))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await generate(),null,2));
