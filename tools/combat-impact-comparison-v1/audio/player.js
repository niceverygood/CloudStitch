// The scene supplies actual fire/hit events; no clocks, loops or extra shots here.
// Pure PCM composition: a slow render frame cannot alter the recorded cadence.
export function mixSequencePCM(cues,bufferFor,{offset=0,sampleRate=44100,volume=.9}={}){
 if(!Array.isArray(cues)||cues.length>32||!Number.isFinite(offset)||offset<0||offset>10||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw Error('Invalid bounded sequence');
 const level=Math.min(1,Math.max(0,Number.isFinite(volume)?volume:.9)),selected=[];
 for(let index=0;index<cues.length;index++){
  const cue=cues[index];if(!cue||typeof cue.id!=='string'||!Number.isFinite(cue.time)||cue.time<0||cue.time>10)throw Error('Invalid sequence cue');
  const b=bufferFor(cue.id);if(!b||!Number.isInteger(b.length)||b.length<1||b.numberOfChannels<1||b.numberOfChannels>2||!Number.isFinite(b.sampleRate)||b.sampleRate<8000||b.sampleRate>192000||b.length/b.sampleRate>10)throw Error('Invalid sequence buffer');
  const end=cue.time+b.length/b.sampleRate;if(end<=offset)continue;
  const startFrame=Math.round((cue.time-offset)*sampleRate),endFrame=Math.round((end-offset)*sampleRate);
  if(endFrame>sampleRate*10)throw Error('Sequence exceeds ten seconds');
  if(endFrame>0)selected.push({index,id:cue.id,time:cue.time,startFrame,endFrame,buffer:b});
 }
 const frameCount=Math.max(0,...selected.map(c=>c.endFrame)),edges=selected.flatMap(c=>[{frame:Math.max(0,c.startFrame),delta:1},{frame:c.endFrame,delta:-1}]).sort((a,b)=>a.frame-b.frame||a.delta-b.delta);
 let active=0,maxOverlap=0;for(const edge of edges){active+=edge.delta;maxOverlap=Math.max(maxOverlap,active);}if(maxOverlap>4)throw Error('Sequence exceeds four simultaneous cue tails');
 const channels=[new Float32Array(frameCount),new Float32Array(frameCount)];
 for(const cue of selected){const b=cue.buffer;for(let c=0;c<2;c++){const source=b.getChannelData(Math.min(c,b.numberOfChannels-1));for(let i=Math.max(0,cue.startFrame);i<cue.endFrame;i++){const p=(i-cue.startFrame)*b.sampleRate/sampleRate,j=Math.floor(p),f=p-j,value=(source[j]||0)*(1-f)+(source[j+1]||0)*f;if(!Number.isFinite(value))throw Error('Non-finite sequence PCM');channels[c][i]+=value*level;}}}
 let peak=0;for(const c of channels)for(const x of c){if(!Number.isFinite(x))throw Error('Non-finite mix');peak=Math.max(peak,Math.abs(x));}if(peak*.28>.92)throw Error('Unsafe sequence headroom');
 return {channels,sampleRate,frameCount,duration:frameCount/sampleRate,peak,masterPeak:peak*.28,maxOverlap,volume:level,cueCount:selected.length,eventIndices:selected.map(({buffer,...rest})=>rest)};
}
export function createComparisonAudio(data) {
 let context=null,master=null,ready=null,disposed=false,epoch=0,lastSequence=null;
 const buffers=new Map(),voices=new Set(),stats={played:0,suppressed:0,stops:0,errors:0,maxVoices:0,sequences:0,sequenceCues:0};
 const CAP=4,MASTER=.28;
 function bytes(base64){const s=atob(base64.replace(/^data:[^,]*,/,'')),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a.buffer;}
 async function unlock(){
  if(disposed)return false;
  try{
   if(!context){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return false;context=new C();master=context.createGain();master.gain.value=MASTER;master.connect(context.destination);}
   const resumed=context.resume();
   if(!ready){const ctx=context;ready=(async()=>{for(const [id,variants] of Object.entries(data))for(const version of ['old','new','oldMatched','newMatched']){if(typeof variants[version]!=='string')throw Error(`Missing ${id}:${version}`);const buffer=await ctx.decodeAudioData(bytes(variants[version]));if(disposed)return false;buffers.set(`${id}:${version}`,buffer);}return !disposed;})();}
   await resumed;return await ready;
  }catch{stats.errors++;ready=null;return false;}
 }
 function release(v){if(v.releasing)return;v.releasing=true;const t=context.currentTime;v.gain.gain.cancelScheduledValues(t);v.gain.gain.setValueAtTime(v.level,t);v.gain.gain.linearRampToValueAtTime(0,t+.005);try{v.source.stop(t+.005);}catch{} }
 function stop(){epoch++;stats.stops++;for(const v of voices)release(v);}
 async function play(id,version,{matched=true,volume=.8}={}){
  if(disposed||!['old','new'].includes(version)||!data[id])return false;
  const ticket=epoch;if(!await unlock()||disposed||ticket!==epoch)return false;
  // Includes voices in their 5ms release. Never steal and exceed the bound.
  if(voices.size>=CAP||[...voices].some(v=>v.sequence)){stats.suppressed++;return false;}
  const buffer=buffers.get(`${id}:${version}${matched?'Matched':''}`);if(!buffer)return false;
  const source=context.createBufferSource(),gain=context.createGain(),level=Math.min(1,Math.max(0,Number.isFinite(volume)?volume:.8));
  source.buffer=buffer;gain.gain.value=level;source.connect(gain);gain.connect(master);
  const voice={source,gain,level,releasing:false};voices.add(voice);stats.maxVoices=Math.max(stats.maxVoices,voices.size);
  source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();};source.start();stats.played++;return true;
 }
 async function playSequence(cues,version,{offset=0,matched=true,volume=.9}={}){
  if(disposed||!['old','new'].includes(version))return {ok:false,reason:'unavailable'};
  const ticket=epoch;if(!await unlock()||disposed||ticket!==epoch)return {ok:false,reason:'cancelled'};
  // A sequence owns the bus. Old voices in 5ms release finish before the 20ms
  // sequence start; active unrelated cues require stop() before replacement.
  if([...voices].some(v=>!v.releasing)){stats.suppressed++;return {ok:false,reason:'busy'};}
  try{
   const mixed=mixSequencePCM(cues,id=>buffers.get(`${id}:${version}${matched?'Matched':''}`),{offset,sampleRate:context.sampleRate,volume});
   if(!mixed.frameCount)return {ok:false,reason:'empty',cueCount:0};
   if(disposed||ticket!==epoch)return {ok:false,reason:'cancelled'};
   const buffer=context.createBuffer(2,mixed.frameCount,mixed.sampleRate);for(let c=0;c<2;c++)buffer.getChannelData(c).set(mixed.channels[c]);
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=1;source.connect(gain);gain.connect(master);
   const voice={source,gain,level:1,releasing:false,sequence:true};voices.add(voice);stats.maxVoices=Math.max(stats.maxVoices,voices.size);source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();};
   const leadSeconds=.02,scheduledContextTime=context.currentTime+leadSeconds,startPerformanceMs=performance.now()+leadSeconds*1000;
   source.start(scheduledContextTime);stats.sequences++;stats.sequenceCues+=mixed.cueCount;
   lastSequence={version,matched,offset,leadSeconds,scheduledContextTime,startPerformanceMs,duration:mixed.duration,frameCount:mixed.frameCount,sampleRate:mixed.sampleRate,cueCount:mixed.cueCount,eventIndices:mixed.eventIndices,maxOverlap:mixed.maxOverlap,masterPeak:mixed.masterPeak};
   return {ok:true,...lastSequence};
  }catch(error){stats.errors++;return {ok:false,reason:String(error.message||error)};}
 }
 function dispose(){if(disposed)return;stop();disposed=true;buffers.clear();const ctx=context;setTimeout(()=>{for(const v of voices){try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();}voices.clear();master?.disconnect();if(ctx&&ctx.state!=='closed')void ctx.close().catch(()=>{});},12);}
 return {unlock,play,playSequence,stop,dispose,debug:()=>({...stats,lastSequence,disposed,activeVoices:voices.size,voiceCap:CAP,masterGain:MASTER,decodedBuffers:buffers.size,state:context?.state??'uninitialized'})};
}
