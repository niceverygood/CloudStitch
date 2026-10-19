import { SOUND_DEFINITIONS, synthesize } from './synthesis.mjs';

export const AUDIO_VERSION = 'audio-v1.0.0-ready';
export const DEFAULT_SETTINGS = Object.freeze({master:.7,sfx:.8,ambience:.35,muted:false,mono:false,lowDynamicRange:true});
const definitions = new Map(SOUND_DEFINITIONS.map(item=>[item.id,item]));
const clamp = (value,min,max)=>Math.max(min,Math.min(max,value));
const number = (value,fallback)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
export function sanitizeSettings(input) {
  const value=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key,fallback])=>[key,typeof fallback==='boolean'?(typeof value[key]==='boolean'?value[key]:fallback):clamp(number(value[key],fallback),0,1)]));
}
const hash = value=>{let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};

/** Presentation only: no combat commands, state mutation, or scheduled event queue. */
export function createAudioEngine({contextFactory,storage=null,now=()=>globalThis.performance?.now()/1000||Date.now()/1000}={}) {
  const key='cloudstitch.audio.v1.settings';
  let config={...DEFAULT_SETTINGS},storageError=null,context=null,master=null,compressor=null,limiter=null;
  let unlocked=false,paused=false,disposed=false,unlockError=null,serial=0,unlocking=null;
  const voices=new Map(),loops=new Map(),buffers=new Map(),lastPlay=new Map(),releasing=new Set();
  const counts={played:0,droppedLocked:0,droppedMuted:0,droppedRate:0,droppedCap:0,stolen:0,loopStarts:0,clears:0};
  try{config=sanitizeSettings(JSON.parse(storage?.getItem(key)||'null'));}catch{storageError='설정을 읽지 못해 기본값으로 복구했습니다.';}
  const time=()=>number(context?.currentTime,number(now(),0));
  const gainTo=(param,value,ramp=.025)=>{if(!param)return;const t=time();param.cancelScheduledValues(t);param.setValueAtTime(number(param.value,value),t);param.linearRampToValueAtTime(value,t+ramp);};
  function updateMix(){
    if(!context)return;
    gainTo(master.gain,config.muted?0:config.master*.8);
    compressor.threshold.value=config.lowDynamicRange?-24:-12;compressor.knee.value=18;
    compressor.ratio.value=config.lowDynamicRange?6:12;compressor.attack.value=.003;compressor.release.value=.12;
    const duck=[...voices.values()].some(v=>v.priority===3)?.32:1;
    for(const voice of voices.values()){
      const bus=voice.category==='ambience'?config.ambience:config.sfx;
      voice.targetGain=voice.baseGain*bus*(voice.category==='ambience'?duck:1);
      gainTo(voice.gain.gain,voice.targetGain);
      gainTo(voice.panner.pan,config.mono?0:voice.pan);
    }
  }
  function finalize(voice){
    voices.delete(voice.serial);releasing.delete(voice);
    if(loops.get(voice.id)===voice)loops.delete(voice.id);
    for(const node of [voice.source,voice.gain,voice.panner])try{node.disconnect();}catch{}
    updateMix();
  }
  function stopVoice(voice,fade=.012){
    voices.delete(voice.serial);if(loops.get(voice.id)===voice)loops.delete(voice.id);
    releasing.add(voice);gainTo(voice.gain.gain,0,fade);
    try{voice.source.stop(time()+fade);}catch{finalize(voice);}
    // Bound short release tails even when a test/misbehaving implementation never fires onended.
    if(releasing.size>24){const oldest=releasing.values().next().value;try{oldest.source.stop();}catch{}finalize(oldest);}
  }
  function clear(reason='clear'){
    for(const voice of [...voices.values()])stopVoice(voice);
    loops.clear();lastPlay.clear();counts.clears++;updateMix();return reason;
  }
  async function unlock(){
    if(disposed)return false;if(unlocking)return unlocking;
    const attempt=(async()=>{
      try{
        if(!context){
          const Factory=globalThis.AudioContext||globalThis.webkitAudioContext;
          context=contextFactory?contextFactory():Factory?new Factory():null;
          if(!context)throw new Error('이 브라우저는 Web Audio를 지원하지 않습니다.');
          master=context.createGain();compressor=context.createDynamicsCompressor();limiter=context.createWaveShaper();
          const curve=new Float32Array(2049);for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=.85*Math.tanh(x/.85);}
          limiter.curve=curve;limiter.oversample='2x';master.connect(compressor);compressor.connect(limiter);limiter.connect(context.destination);updateMix();
        }
        await context.resume();
        if(disposed){unlocked=false;if(context.state!=='closed')await context.close();return false;}
        unlocked=context.state==='running';unlockError=unlocked?null:'첫 클릭이나 키 입력으로 소리를 켜세요.';return unlocked;
      }catch(error){unlockError=error.message;unlocked=false;return false;}
    })();
    unlocking=attempt;try{return await attempt;}finally{if(unlocking===attempt)unlocking=null;}
  }
  function getBuffer(id,variant){
    const cacheKey=`${id}:${variant}`;if(buffers.has(cacheKey))return buffers.get(cacheKey);
    const def=definitions.get(id),rendered=synthesize(id,{sampleRate:22050,seed:def.seed+variant*7919});
    const buffer=context.createBuffer(1,rendered.samples.length,rendered.sampleRate);buffer.getChannelData(0).set(rendered.samples);buffers.set(cacheKey,buffer);
    if(buffers.size>64)buffers.delete(buffers.keys().next().value);return buffer;
  }
  function start(id,options={},loop=false){
    if(disposed)return false;
    const def=definitions.get(id);if(!def)return false;
    if(!unlocked||context?.state!=='running'){counts.droppedLocked++;return false;}
    if(config.muted||paused){counts.droppedMuted++;return false;}
    const priority=clamp(Math.floor(number(options.priority,def.priority)),1,3),t=time();
    if(!loop&&t-(lastPlay.get(id)??-Infinity)<number(def.interval,.06)){counts.droppedRate++;return false;}
    const important=[...voices.values()].filter(v=>v.priority>=2);
    if(priority>=2&&important.length>=3){
      const candidate=important.filter(v=>v.priority<=priority).sort((a,b)=>a.priority-b.priority||a.serial-b.serial)[0];
      if(!candidate){counts.droppedCap++;return false;}stopVoice(candidate);counts.stolen++;
    }
    if(voices.size>=12){
      const candidates=[...voices.values()].filter(v=>v.priority<priority&&!v.loop).sort((a,b)=>a.priority-b.priority||a.serial-b.serial);
      if(!candidates.length){counts.droppedCap++;return false;}stopVoice(candidates[0]);counts.stolen++;
    }
    const variant=loop?0:hash(options.variantKey??serial)%3;
    const source=context.createBufferSource(),gain=context.createGain(),panner=context.createStereoPanner();
    source.buffer=getBuffer(id,variant);source.loop=loop;
    const rate=loop?clamp(number(options.rate,1),.65,1.5):clamp(number(options.rate,.98+variant*.02),.8,1.2);source.playbackRate.value=rate;
    const voice={id,serial:++serial,source,gain,panner,category:def.category,priority,loop,pan:clamp(number(options.pan,0),-1,1),baseGain:clamp(number(options.gain,1),0,1)*(def.category==='ambience'?.15:.3),targetGain:0};
    gain.gain.value=0;panner.pan.value=config.mono?0:voice.pan;
    source.connect(gain);gain.connect(panner);panner.connect(master);source.onended=()=>finalize(voice);
    voices.set(voice.serial,voice);if(loop){loops.set(id,voice);counts.loopStarts++;}
    lastPlay.set(id,t);updateMix();source.start(t);counts.played++;return true;
  }
  function setLoop(id,active,options={}){
    if(!definitions.get(id)?.loop)return false;
    const existing=loops.get(id);
    if(!active){if(existing)stopVoice(existing);updateMix();return false;}
    if(existing){existing.baseGain=clamp(number(options.gain,1),0,1)*.15;gainTo(existing.source.playbackRate,clamp(number(options.rate,1),.65,1.5));updateMix();return true;}
    return start(id,options,true);
  }
  function setSettings(patch){
    config=sanitizeSettings({...config,...(patch&&typeof patch==='object'?patch:{})});
    if(config.muted)clear('muted');updateMix();
    try{storage?.setItem(key,JSON.stringify(config));storageError=null;}catch{storageError='음향 설정을 저장하지 못했습니다. 현재 세션에는 적용했습니다.';}
    return {...config};
  }
  function setPaused(value){const next=!!value;if(next&&!paused)clear('paused');paused=next;return paused;}
  async function dispose(){if(disposed)return;disposed=true;clear('dispose');for(const v of [...releasing]){try{v.source.stop();}catch{}finalize(v);}buffers.clear();lastPlay.clear();for(const node of [master,compressor,limiter])try{node?.disconnect();}catch{}await context?.close();unlocked=false;}
  return {unlock,play:(id,options)=>start(id,options,false),setLoop,clear,setPaused,setSettings,settings:()=>({...config}),dispose,
    debug:()=>({version:AUDIO_VERSION,unlocked,locked:!unlocked||context?.state!=='running',contextState:context?.state||'not-created',paused,disposed,muted:config.muted,activeVoices:voices.size,activeImportant:[...voices.values()].filter(v=>v.priority>=2).length,activeCritical:[...voices.values()].filter(v=>v.priority===3).length,activeLoops:[...loops.keys()],releasing:releasing.size,bufferCache:buffers.size,throttleKeys:lastPlay.size,counts:{...counts},unlockError,storageError,limits:{voices:12,important:3,critical:3,buffers:64,releaseTails:24}})};
}
