/** Lightweight local PCM stress measurements. No browser or audible playback. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeWav} from './wav.mjs';
import {RichReviewPlayer,measureBuffer,pairNormalization} from './review.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const output=path.join(root,'outputs/audio-rich-v1');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const checks=[];
const check=(name,passed,detail)=>checks.push({name,passed:Boolean(passed),detail});
const asBuffer=pcm=>({numberOfChannels:pcm.channels.length,length:pcm.channels[0].length,sampleRate:pcm.sampleRate,duration:pcm.channels[0].length/pcm.sampleRate,getChannelData:c=>pcm.channels[c]});
function downmix(pcm){
  const mono=new Float32Array(pcm.channels[0].length);
  for(const channel of pcm.channels)for(let i=0;i<mono.length;i++)mono[i]+=channel[i]/pcm.channels.length;
  return {channels:[mono],sampleRate:pcm.sampleRate};
}

// A small scheduling model for exactly the node operations used by the real
// review player. It is a numerical harness, not a native AudioParam test.
class Param{
  constructor(context,value=1){this.context=context;this.initial=value;this.events=[];this.order=0;}
  cancelScheduledValues(time){this.events=this.events.filter(event=>event.time<time);}
  cancelAndHoldAtTime(time){
    const held=this.at(time),next=this.events.find(event=>event.time>=time);
    this.cancelScheduledValues(time);
    // Preserve the already-rendered part of a linear ramp before holding.
    if(next?.type==='linear')this.add('linear',held,time);
    this.add('set',held,time);
  }
  add(type,value,time,constant){this.events.push({type,value,time,constant,order:this.order++});this.events.sort((a,b)=>a.time-b.time||a.order-b.order);}
  setValueAtTime(value,time){this.add('set',value,time);}
  linearRampToValueAtTime(value,time){this.add('linear',value,time);}
  setTargetAtTime(value,time,constant){this.add('target',value,time,constant);}
  at(time){
    let value=this.initial,previous=0,target=null,constant=null;
    for(const event of this.events){
      if(event.type==='linear'){
        if(time<event.time)return value+(event.value-value)*Math.max(0,time-previous)/Math.max(1e-12,event.time-previous);
        value=event.value;previous=event.time;target=null;continue;
      }
      if(time<event.time)return target===null?value:target+(value-target)*Math.exp(-(time-previous)/constant);
      if(target!==null)value=target+(value-target)*Math.exp(-(event.time-previous)/constant);
      previous=event.time;
      if(event.type==='set'){value=event.value;target=null;}
      else{target=event.value;constant=event.constant;}
    }
    return target===null?value:target+(value-target)*Math.exp(-(time-previous)/constant);
  }
  get value(){return this.at(this.context.currentTime);}
}
class Node{
  connect(destination){this.destination=destination;return destination;}
  disconnect(){}
}
class Gain extends Node{constructor(context){super();this.gain=new Param(context);}}
class Source extends Node{
  constructor(context){super();this.context=context;this.stopTime=Infinity;this.startTime=null;this.loop=false;}
  start(time){this.startTime=time;}
  stop(time=this.context.currentTime){this.stopTime=Math.min(this.stopTime,time);}
}
class Context{
  constructor(){this.currentTime=0;this.state='running';this.destination={};this.sources=[];}
  createGain(){return new Gain(this);}
  createBufferSource(){const source=new Source(this);this.sources.push(source);return source;}
  async resume(){this.state='running';}
  async close(){this.state='closed';}
}
function sampleAt(buffer,channel,time){
  const position=time*buffer.sampleRate,index=Math.floor(position),data=buffer.getChannelData(Math.min(channel,buffer.numberOfChannels-1));
  if(index<0||index>=data.length)return 0;
  const fraction=position-index;
  return data[index]+((data[index+1]??0)-data[index])*fraction;
}
function measureChannels(channels,sampleRate){return measureBuffer(asBuffer({channels,sampleRate}));}

function lowFrequencyProxy(channels,sampleRate){
  // An explicitly approximate LF estimate: two cascaded one-pole 160 Hz
  // lowpasses. It is not a brick-wall spectral integral or an LUFS estimate.
  const coefficient=1-Math.exp(-2*Math.PI*160/sampleRate);let energy=0,totalEnergy=0;
  for(const channel of channels){let a=0,b=0;for(const x of channel){a+=coefficient*(x-a);b+=coefficient*(a-b);energy+=b*b;totalEnergy+=x*x;}}
  return {method:'160 Hz two cascaded one-pole lowpasses; approximate LF energy proxy',
    energy,rms:Math.sqrt(energy/Math.max(1,channels.length*channels[0].length)),energyRatio:energy/Math.max(1e-20,totalEnergy)};
}

// Full-tail six-shot fixture is deliberately outside RichReviewPlayer: no
// audition voice cap, eviction, fade-steal, or master automation can hide the
// fourth overlapping tail. The real source WAV duration is retained in full.
function uncappedMachinegunFixture(clip,{mono=false}={}){
  const pcm=mono?clip.mono:clip.pcm,sampleRate=pcm.sampleRate,buffer=asBuffer(pcm);
  const starts=Array.from({length:6},(_,index)=>.03+index*.22);
  const sourceFrames=pcm.channels[0].length,sourceDuration=sourceFrames/sampleRate;
  const frames=Math.ceil((starts[starts.length-1]+sourceDuration+.01)*sampleRate);
  const raw=pcm.channels.map(()=>new Float32Array(frames));let maximumOverlap=0;
  for(let frame=0;frame<frames;frame++){
    const time=frame/sampleRate;let overlap=0;
    for(const start of starts){
      const local=time-start;if(local<0||local>=sourceDuration)continue;overlap++;
      for(let channel=0;channel<raw.length;channel++)raw[channel][frame]+=sampleAt(buffer,channel,local);
    }
    maximumOverlap=Math.max(maximumOverlap,overlap);
  }
  const headroomGain=1/maximumOverlap,scaled=raw.map(channel=>Float32Array.from(channel,x=>x*headroomGain));
  const rawMetrics=measureChannels(raw,sampleRate),scaledMetrics=measureChannels(scaled,sampleRate);
  const rawMono=downmix({channels:raw,sampleRate}),scaledMono=downmix({channels:scaled,sampleRate});
  const relativeBassAttacks=clip.asset.metrics?.addedBass?.attacks||[];
  const report={name:`Uncapped six complete machine gun WAVs at 0.22 seconds (${mono?'mono':'stereo'})`,
    method:'Direct complete rendered WAV sample scheduling; no RichReviewPlayer cap, evictions, fade steals, pairNormalization or Web Audio. Numerical offline fixture only.',
    sourceId:clip.asset.id,sourceFile:clip.asset.file,sourceSha256:clip.asset.sha256,
    channels:pcm.channels.length,sampleRate,sourceFrames,sourceDuration,intervalSeconds:.22,
    sourceStarts:starts,starts:starts.length,evictions:0,completeTailsPreserved:true,maximumOverlap,
    attackTiming:{sourceStartSeconds:starts,bassAttackRelativeSeconds:relativeBassAttacks,
      bassAttackAbsoluteSeconds:starts.map(start=>relativeBassAttacks.map(attack=>start+attack)),
      totalAttachedBassAttacks:starts.length*relativeBassAttacks.length,
      bassMode:clip.asset.recipe?.bass?.mode,bassHz:clip.asset.recipe?.bass?.hz,
      maxPulseSeconds:clip.asset.recipe?.bass?.maxPulseSeconds,
      sourceAddedBassMetrics:clip.asset.metrics?.addedBass,
      note:'Metadata is inherited from deterministic source rendering. Full WAV sums already include its attached bass. No new bass note, pulse, gunshot or event is generated by this fixture.'},
    rawSum:{...rawMetrics,lowFrequencyProxy:lowFrequencyProxy(raw,sampleRate),mono:measureChannels(rawMono.channels,sampleRate)},
    constantHeadroom:{gain:headroomGain,reason:'1 / measured maximum full-tail overlap, independent of signal phase.',
      conservativePeakBound:clip.metrics.peak*maximumOverlap*headroomGain,
      ...scaledMetrics,lowFrequencyProxy:lowFrequencyProxy(scaled,sampleRate),mono:measureChannels(scaledMono.channels,sampleRate)},
    limitations:['Offline numeric output only. No Native audio rendering, human listening or game installation.',
      'Raw sum may exceed 1.0 and is measured without clipping. It must not be exported or played at unity gain.',
      'Fixed 1/4 headroom is a conservative analysis mix; it is not installed as a game mixer or a change to attack events.']};
  check(report.name+' six starts/no eviction/four complete overlapping tails',starts.length===6&&report.evictions===0&&maximumOverlap===4&&report.completeTailsPreserved,
    {starts:starts.length,evictions:report.evictions,maximumOverlap,sourceDuration});
  check(report.name+' fixed headroom finite/peak <= 0.8',scaledMetrics.finite&&scaledMetrics.peak<=.8000001&&report.constantHeadroom.mono.peak<=.8000001,
    {gain:headroomGain,rawPeak:rawMetrics.peak,scaledPeak:scaledMetrics.peak,monoPeak:report.constantHeadroom.mono.peak});
  check(report.name+' LF proxy finite and bass attack metadata present',Number.isFinite(report.rawSum.lowFrequencyProxy.energyRatio)&&Number.isFinite(report.constantHeadroom.lowFrequencyProxy.energyRatio)&&relativeBassAttacks.length>0,
    {rawLfRatio:report.rawSum.lowFrequencyProxy.energyRatio,totalAttachedBassAttacks:report.attackTiming.totalAttachedBassAttacks});
  return report;
}

const catalogBytes=await fs.readFile(path.join(output,'catalog.json'));
const catalog=JSON.parse(catalogBytes);
if(catalog.assets.length!==49)throw new Error('All 49 rendered WAVs must exist before this verification.');
const clips=new Map(),monoRows=[];
for(const asset of catalog.assets){
  if(!/^enhanced\/[A-Za-z0-9_.-]+\.wav$/.test(asset.file))throw new Error('Unsafe enhanced path');
  const bytes=await fs.readFile(path.join(output,asset.file));
  if(sha(bytes)!==asset.sha256)throw new Error('WAV SHA mismatch: '+asset.id);
  const pcm=decodeWav(bytes),metrics=measureBuffer(asBuffer(pcm)),mono=downmix(pcm),monoMetrics=measureBuffer(asBuffer(mono));
  const sourcePath=asset.derivation?.decodedSource?.path;
  if(typeof sourcePath!=='string'||!/^work\/audio\/rich-v1\/decoded\/[A-Za-z0-9_.-]+\.wav$/.test(sourcePath))throw new Error('Expected local native decoder receipt');
  const originalBytes=await fs.readFile(path.join(root,sourcePath));
  if(sha(originalBytes)!==asset.derivation.decodedSource.sha256)throw new Error('Original PCM SHA mismatch');
  const original=decodeWav(originalBytes),sourceMetrics=measureBuffer(asBuffer(original)),sourceMonoMetrics=measureBuffer(asBuffer(downmix(original)));
  const levels=pairNormalization(sourceMetrics,metrics,true),rawLevels=pairNormalization(sourceMetrics,metrics,false),monoLevels=pairNormalization(sourceMonoMetrics,monoMetrics,true);
  const normalizedPeak=metrics.peak*levels.enhanced,monoNormalizedPeak=monoMetrics.peak*monoLevels.enhanced;
  const row={id:asset.id,file:asset.file,sha256:asset.sha256,sampleRate:pcm.sampleRate,frames:pcm.channels[0].length,
    stereo:metrics,mono:monoMetrics,monoRmsRetention:monoMetrics.rms/metrics.rms,
    pairNormalization:levels,unmatchedPairNormalization:rawLevels,monoPairNormalization:monoLevels,
    normalizedPeak,monoNormalizedPeak};
  monoRows.push(row);clips.set(asset.id,{asset,pcm,metrics,mono,monoMetrics,levels,monoLevels});
}
check('49 WAV hashes and native Float32 source receipts',clips.size===49,{count:clips.size});
check('49 per-voice normalization peak <= 0.8',monoRows.every(row=>row.normalizedPeak<=.8000001&&row.monoNormalizedPeak<=.8000001),{maximum:Math.max(...monoRows.map(row=>Math.max(row.normalizedPeak,row.monoNormalizedPeak)))});
check('49 mono downmix finite and audible signal',monoRows.every(row=>row.mono.finite&&row.mono.rms>1e-8),{minimumMonoRmsRetention:Math.min(...monoRows.map(row=>row.monoRmsRetention)),note:'Signal survival only; not human audibility or stereo quality approval.'});
check('49 unmatched mode does not increase per-voice peaks beyond 0.8',monoRows.every(row=>row.stereo.peak*row.unmatchedPairNormalization.enhanced<=.8000001),{});

async function simulate(name,starts,{volume=1,mono=false}={}){
  const context=new Context(),player=new RichReviewPlayer({assets:catalog.assets,settings:{volume,mono},contextFactory:()=>context});
  await player.unlock();let maxVoices=0;const allVoices=[];
  function finishBefore(time){
    for(;;){
      const physical=[...player.voices.values(),...[...(player.releasing?.values()||[])]];
      const ending=v=>Math.min(v.loop?Infinity:v.start+v.duration,v.source.stopTime);
      const next=physical.filter(v=>ending(v)<=time).sort((a,b)=>ending(a)-ending(b))[0];
      if(!next)break;context.currentTime=ending(next);next.source.onended?.();
    }
  }
  for(const start of starts){
    finishBefore(start.at);context.currentTime=start.at;
    const clip=clips.get(start.id);if(!clip)throw new Error('Unknown mix cue '+start.id);
    const pcm=mono?clip.mono:clip.pcm,metrics=mono?clip.monoMetrics:clip.metrics,level=mono?clip.monoLevels.enhanced:clip.levels.enhanced;
    const voice=player.start(clip.asset,{buffer:asBuffer(pcm),metrics,gain:level,targetRms:clip.levels.targetRms},{mode:'enhanced',loop:false,level:start.level,when:start.at+(start.lead??.015)});
    if(voice)allVoices.push(voice);maxVoices=Math.max(maxVoices,player.voices.size);
  }
  const end=Math.max(...allVoices.map(v=>v.start+v.duration));finishBefore(end+.001);
  const sampleRate=44100,frames=Math.ceil((end+.01)*sampleRate),channels=Array.from({length:mono?1:2},()=>new Float32Array(frames));
  const beforeMaster=channels.map(()=>new Float32Array(frames));let maxMasterGain=0,sourceMaxActive=0;
  for(let i=0;i<frames;i++){
    const time=i/sampleRate,master=context.sources.length?player.master.gain.at(time):0;let active=0;
    maxMasterGain=Math.max(maxMasterGain,master);
    for(const voice of allVoices){
      const source=voice.source,local=time-source.startTime;
      if(local<0||time>=source.stopTime||local>=voice.buffer.duration)continue;active++;
      const gain=voice.gain.gain.at(time);
      for(let c=0;c<channels.length;c++)beforeMaster[c][i]+=sampleAt(voice.buffer,c,local)*gain;
    }
    sourceMaxActive=Math.max(sourceMaxActive,active);
    for(let c=0;c<channels.length;c++)channels[c][i]=beforeMaster[c][i]*master;
  }
  const measured=measureChannels(channels,sampleRate),withoutHeadroom=measureChannels(beforeMaster,sampleRate),downmixed=measureBuffer(asBuffer(downmix({channels,sampleRate})));
  const result={name,method:'Actual RichReviewPlayer.start/lifecycle + numerical model of Web Audio gain envelopes. No native rendering/playback.',
    volume,mono,starts:starts.map(s=>({id:s.id,at:s.at,level:s.level,normalizationGain:(mono?clips.get(s.id).monoLevels:clips.get(s.id).levels).enhanced})),
    maxVoices,sourceMaxActive,createdSources:player.createdSources,activeAfterNaturalEnds:player.voices.size,
    releasesAfterNaturalEnds:player.releasing?.size||0,
    actualParamSchedules:{master:player.master.gain.events,voices:allVoices.map(v=>({id:v.asset.id,start:v.start,stop:v.source.stopTime===Infinity?null:v.source.stopTime,gain:v.gain.gain.events}))},
    output:measured,monoDownmix:downmixed,beforeMaster:withoutHeadroom,maxMasterGain,
    staticPeakBound:.8*volume,masterAutomation:{reserveLinearMilliseconds:3,recoveryTargetMilliseconds:12,releaseMilliseconds:player.releaseFade*1000},
    includesReleaseTailAndDeferredReplacement:true};
  await player.dispose();
  check(name+' finite/peak <= 0.8',measured.finite&&measured.peak<=.8000001,{peak:measured.peak,rms:measured.rms,monoPeak:downmixed.peak});
  check(name+' voice cap/lifecycle',maxVoices<=3&&sourceMaxActive<=3&&result.activeAfterNaturalEnds===0&&result.releasesAfterNaturalEnds===0,{maxVoices,sourceMaxActive,remaining:result.activeAfterNaturalEnds,releasing:result.releasesAfterNaturalEnds,createdSources:result.createdSources});
  return result;
}

const mixes=[];
const gunStarts=Array.from({length:6},(_,i)=>({id:'fire-machinegun',at:.03+i*.22,level:1,lead:.008}));
mixes.push(await simulate('Machine gun 6 shots at 0.22 seconds, full review volume',gunStarts));
mixes.push(await simulate('Machine gun 6 shots at 0.22 seconds, mono',gunStarts,{mono:true}));
const triples=[
  ['lift-danger-loop','hit-wood','fire-machinegun'],
  ['incoming-warning','hit-armor','fire-cannon'],
  ['lift-warning','hit-engine','mortar-launch-a'],
  ['mortar-impact','fire-cannon','module-break']
];
for(const ids of triples){
  const name='Three cues '+ids.join(' + '),starts=ids.map(id=>({id,at:.03,level:.36,lead:.015}));
  mixes.push(await simulate(name,starts));
  mixes.push(await simulate(name+' mono',starts,{mono:true}));
}
const uncappedMachinegun=[uncappedMachinegunFixture(clips.get('fire-machinegun')),
  uncappedMachinegunFixture(clips.get('fire-machinegun'),{mono:true})];

// Verify the settled algebra independently of waveform phase. Pair
// normalization bounds each signal at 0.8; actual per-voice gain is norm*level.
// Headroom uses sum(raw audition levels), not sum(normalization*level).
const boundCases=[];
for(const volume of [0,.4,1])for(const levels of [[1],[.36,.36,.36],[1,1,1],[.1,.5,1]]){
  const sum=levels.reduce((a,b)=>a+b,0),master=volume/Math.max(1,sum),bound=.8*sum*master;
  boundCases.push({volume,levels,sumAuditionLevels:sum,master,settledPeakUpperBound:bound});
}
check('Settled headroom bound <= 0.8 at all review volumes',boundCases.every(item=>item.settledPeakUpperBound<=.800000001),boundCases);
const reviewBytes=await fs.readFile(path.join(root,'tools/audio/rich-v1/review.mjs'));
const selfBytes=await fs.readFile(fileURLToPath(import.meta.url));
const report={schema:'cloudstitch-audio-rich-offline-mix-verification/v1',generatedAt:new Date().toISOString(),
  passed:checks.every(item=>item.passed),summary:{checks:checks.length,passed:checks.filter(item=>item.passed).length,failed:checks.filter(item=>!item.passed).length,
    actualWavs:clips.size,previewMixCases:mixes.length,uncappedFullTailMixCases:uncappedMachinegun.length,
    maximumMeasuredPreviewMixPeak:Math.max(...mixes.map(item=>item.output.peak)),maximumUncappedRawSumPeak:Math.max(...uncappedMachinegun.map(item=>item.rawSum.peak)),
    maximumUncappedHeadroomPeak:Math.max(...uncappedMachinegun.map(item=>item.constantHeadroom.peak)),minimumMonoRmsRetention:Math.min(...monoRows.map(row=>row.monoRmsRetention))},
  scope:'Offline arithmetic on actual rendered PCM16 WAVs and actual read-only review player scheduling. No browser, audible playback, human listening, game install, paid generation or extra WAV export.',
  evidence:{catalog:{file:'outputs/audio-rich-v1/catalog.json',sha256:sha(catalogBytes)},review:{file:'tools/audio/rich-v1/review.mjs',sha256:sha(reviewBytes)},script:{file:'tools/audio/rich-v1/verify-mix.mjs',sha256:sha(selfBytes)}},
  limits:[
    'Numerical gain automation is a local model, not Native Web Audio final QA.',
    'Per-voice/settled headroom bound is conservative; source phase, 3 ms master reserve ramp, 12 ms recovery and 5 ms release are measured only for the named actual PCM fixtures.',
    'This does not prove arbitrary future cue combinations or smoothing transients always remain below 0.8.',
    'Mono finite/RMS retention does not establish timbral quality or human three-cue distinguishability.',
    'The six shots are a verification fixture at the real 0.22 s cooldown; no attack timeline or new game event was installed.',
    'The ten preview cases use RichReviewPlayer cap=3. The separate two uncapped machine gun cases preserve all six complete tails, reach four-way overlap, and evict zero shots.'
  ],checks,boundCases,previewMixes:mixes,uncappedMachinegun,monoRows};
await fs.writeFile(path.join(output,'mix-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
if(!report.passed)process.exitCode=1;
