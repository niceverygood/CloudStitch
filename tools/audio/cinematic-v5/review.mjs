export const REVIEW_SCHEMA = 'cloudstitch-audio-cinematic-review/v5';
export const CATEGORY_LABELS = Object.freeze({weapon:'무기',impact:'피격·재료',salvage:'절단·인양',ambience:'항해·환경',warning:'위험 경고',harbor:'항구',ui:'조작·UI'});
export const DEFAULT_SETTINGS = Object.freeze({volume:.4,equalLoudness:true,mono:false,mute:false});
const DECISIONS = Object.freeze({unreviewed:['○','검수 전'],approved:['✓','승인'],revision:['↺','수정 요청'],hold:['—','보류']});
const MODES = ['original','enhanced'];
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const numeric=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const timeText=s=>`${numeric(s).toFixed(2)}초`;
const dbText=v=>v>0?`${(20*Math.log10(v)).toFixed(1)} dBFS`:'−∞ dBFS';
const sourceHash=a=>a.source?.sha256||a.source?.originalSha256||'';
const outputHash=a=>a.sha256||a.output?.sha256||'';
const fileOf=(a,mode)=>mode==='original'?a.source?.file:a.file;
export const safeAudioFile=file=>typeof file==='string'&&/^(?:original|enhanced)\/[A-Za-z0-9_.-]+\.(?:mp3|wav)$/i.test(file)&&!file.includes('..');

export function sanitizeSettings(input={}) {
  const out={...DEFAULT_SETTINGS};
  if(!input||typeof input!=='object'||Array.isArray(input))return out;
  if(typeof input.volume==='number'&&Number.isFinite(input.volume))out.volume=clamp(input.volume,0,1);
  for(const key of ['equalLoudness','mono','mute'])if(typeof input[key]==='boolean')out[key]=input[key];
  return out;
}
export function assetIdentity(asset) {return {id:asset.id,originalSha256:sourceHash(asset),enhancedSha256:outputHash(asset)};}
export function catalogFingerprint(catalog) {
  const value=JSON.stringify([catalog.version,...catalog.assets.map(assetIdentity)]);let hash=2166136261;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,'0');
}
export function validateReviewImport(payload,catalog) {
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.schema!==REVIEW_SCHEMA)throw new Error('이 시네마틱 소리 비교실에서 내보낸 검수 JSON을 선택해 주세요.');
  if(payload.catalogVersion!==catalog.version||payload.catalogFingerprint!==catalogFingerprint(catalog))throw new Error('검수 카탈로그의 버전 또는 파일 구성이 다릅니다.');
  const identities=catalog.assets.map(assetIdentity);
  if(!Array.isArray(payload.catalogAssets)||JSON.stringify(payload.catalogAssets)!==JSON.stringify(identities))throw new Error('이전 v4 또는 새 v5 WAV의 SHA가 다릅니다. 메모를 가져오지 않았습니다.');
  if(!Array.isArray(payload.decisions)||payload.decisions.length>catalog.assets.length)throw new Error('검수 항목 수가 올바르지 않습니다.');
  const known=new Map(catalog.assets.map(a=>[a.id,a])),out=Object.create(null);
  for(const item of payload.decisions){
    if(!item||typeof item!=='object'||!known.has(item.id)||Object.hasOwn(out,item.id))throw new Error('알 수 없거나 중복된 소리 ID가 있습니다.');
    if(!Object.hasOwn(DECISIONS,item.decision)||typeof item.note!=='string'||item.note.length>4000)throw new Error('검수 판정 또는 메모 형식이 올바르지 않습니다.');
    const identity=assetIdentity(known.get(item.id));
    if(item.originalSha256!==identity.originalSha256||item.enhancedSha256!==identity.enhancedSha256)throw new Error('검수 대상 파일의 SHA가 다릅니다.');
    const heard={original:0,enhanced:0};for(const mode of MODES)if(Number.isInteger(item.heard?.[mode]))heard[mode]=clamp(item.heard[mode],0,100000);
    out[item.id]={decision:item.decision,note:item.note,heard};
  }
  return out;
}
export function measureBuffer(buffer) {
  let peak=0,square=0,seam=0,firstAbs=0,lastAbs=0;
  for(let c=0;c<buffer.numberOfChannels;c++){
    const data=buffer.getChannelData(c);
    for(let i=0;i<data.length;i++){const v=data[i];if(!Number.isFinite(v))throw new Error('오디오에 유한하지 않은 샘플이 있습니다.');peak=Math.max(peak,Math.abs(v));square+=v*v;}
    firstAbs=Math.max(firstAbs,Math.abs(data[0]||0));lastAbs=Math.max(lastAbs,Math.abs(data[data.length-1]||0));seam=Math.max(seam,Math.abs((data[data.length-1]||0)-(data[0]||0)));
  }
  return {duration:buffer.duration,sampleRate:buffer.sampleRate,channels:buffer.numberOfChannels,frames:buffer.length,peak,rms:Math.sqrt(square/Math.max(1,buffer.length*buffer.numberOfChannels)),firstAbs,lastAbs,seamDelta:seam,finite:true};
}
export function pairNormalization(original,enhanced,equal=true) {
  const samples={original,enhanced};
  for(const m of MODES)if(!Number.isFinite(samples[m]?.peak)||!Number.isFinite(samples[m]?.rms)||samples[m].peak<1e-8||samples[m].rms<1e-9)throw new Error('무음에 가까운 비교 파일입니다.');
  if(!equal)return {targetRms:null,original:Math.min(1,.8/original.peak),enhanced:Math.min(1,.8/enhanced.peak)};
  const targetRms=Math.min(.18,.8*original.rms/original.peak,.8*enhanced.rms/enhanced.peak);
  return {targetRms,original:targetRms/original.rms,enhanced:targetRms/enhanced.rms};
}

export class RichReviewPlayer {
  constructor({assets=[],settings={},contextFactory,fetcher=(...args)=>fetch(...args),onChange=()=>{},onStarted=()=>{}}={}) {
    this.assets=new Map(assets.map(a=>[a.id,a]));this.settings=sanitizeSettings(settings);this.contextFactory=contextFactory;this.fetcher=fetcher;this.onChange=onChange;this.onStarted=onStarted;
    this.context=null;this.master=null;this.cache=new Map();this.requests=new Set();this.voices=new Map();this.releasing=new Map();this.nextVoice=1;this.pending=0;this.epoch=0;this.hidden=false;this.disposed=false;this.createdSources=0;this.lastReason='initial';this.lastError=null;this.cacheLimit=8;this.releaseFade=.005;this.mixHeadroom=1;this.visibilityEpoch=0;this.suspendPromise=null;this.disposePromise=null;
  }
  async unlock() {
    if(this.disposed)throw new Error('종료된 비교실입니다. 화면을 새로 열어 주세요.');if(this.hidden)return false;
    if(!this.context){const factory=this.contextFactory||(()=>new(globalThis.AudioContext||globalThis.webkitAudioContext)());this.context=factory();this.master=this.context.createGain();this.master.connect(this.context.destination);this.context.onstatechange=()=>this.onChange();this.applySettings(true);}
    // A visibility change can arrive after suspend() was called but before its
    // promise settles. Serialize the next gesture behind it before resuming.
    if(this.suspendPromise)await this.suspendPromise.catch(()=>{});
    if(this.disposed||this.hidden)return false;
    if(this.context.state==='suspended'||this.context.state==='interrupted')await this.context.resume();
    this.onChange();return !this.disposed&&!this.hidden&&this.context.state==='running';
  }
  setSettings(patch={}) {
    const old=this.settings;this.settings=sanitizeSettings({...old,...patch});
    if(old.mono!==this.settings.mono||old.equalLoudness!==this.settings.equalLoudness||(!old.mute&&this.settings.mute))this.stopAll('listening setting changed');
    this.applySettings();this.onChange();return {...this.settings};
  }
  applySettings(immediate=false) {
    if(!this.context||!this.master)return;
    const now=this.context.currentTime,param=this.master.gain,physical=[...this.voices.values(),...this.releasing.values()],headroom=Math.max(1,physical.reduce((sum,voice)=>sum+voice.level,0)),value=this.settings.mute?0:this.settings.volume/headroom,needsReserve=headroom>this.mixHeadroom;
    this.mixHeadroom=headroom;
    if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(now);else{const held=param.value;param.cancelScheduledValues(now);param.setValueAtTime(held,now);}
    // A silent bus can retain a stale AudioParam.value until rendered. Apply immediately
    // while idle; smooth only while a real source is active.
    if(physical.length===0||(immediate&&!needsReserve&&this.releasing.size===0))param.setValueAtTime(value,now);
    else if(needsReserve)param.linearRampToValueAtTime(value,now+.003);
    else param.setTargetAtTime(value,now,.012);
  }
  usable(epoch=this.epoch){return !this.disposed&&!this.hidden&&!this.settings.mute&&this.context?.state==='running'&&epoch===this.epoch;}
  trimCache() {
    for(const [key,promise]of this.cache){if(this.cache.size<=this.cacheLimit)break;if(promise.decoded)this.cache.delete(key);}
  }
  async decode(asset,mode='enhanced') {
    if(!this.context||this.disposed)throw new Error('먼저 오디오를 활성화해 주세요.');
    if(!MODES.includes(mode)||!safeAudioFile(fileOf(asset,mode)))throw new Error('검수용 로컬 음원 경로가 올바르지 않습니다.');
    const key=`${asset.id}:${mode}`;if(this.cache.has(key)){const cached=this.cache.get(key);this.cache.delete(key);this.cache.set(key,cached);return cached;}
    const controller=new AbortController();this.requests.add(controller);const bornEpoch=this.epoch;
    const promise=(async()=>{
      try{
        const response=await this.fetcher(fileOf(asset,mode),{credentials:'same-origin',signal:controller.signal});if(!response.ok)throw new Error(`음원을 읽지 못했습니다 (${response.status}).`);
        const data=await response.arrayBuffer();if(data.byteLength>24*1024*1024)throw new Error('검수 파일 크기 제한을 넘었습니다.');
        const buffer=await this.context.decodeAudioData(data),metrics=measureBuffer(buffer);
        if(buffer.duration<=0||buffer.duration>120||buffer.numberOfChannels>8||metrics.peak<1e-8)throw new Error('음원 길이·채널 또는 무음 상태를 확인해 주세요.');
        const result={buffer,metrics,mono:null,monoMetrics:null,bytes:data.byteLength};promise.decoded=result;
        if(this.disposed||bornEpoch!==this.epoch||controller.signal.aborted){if(this.cache.get(key)===promise)this.cache.delete(key);}else this.trimCache();
        return result;
      }finally{this.requests.delete(controller);}
    })();
    this.cache.set(key,promise);
    try{return await promise;}catch(error){if(this.cache.get(key)===promise)this.cache.delete(key);if(error.name!=='AbortError')this.lastError=error.message;throw error;}
  }
  effective(decoded) {
    if(!this.settings.mono||decoded.buffer.numberOfChannels===1)return {buffer:decoded.buffer,metrics:decoded.metrics};
    if(!decoded.mono){const raw=decoded.buffer,mono=this.context.createBuffer(1,raw.length,raw.sampleRate),out=mono.getChannelData(0);for(let c=0;c<raw.numberOfChannels;c++){const data=raw.getChannelData(c);for(let i=0;i<data.length;i++)out[i]+=data[i]/raw.numberOfChannels;}decoded.mono=mono;decoded.monoMetrics=measureBuffer(mono);}
    return {buffer:decoded.mono,metrics:decoded.monoMetrics};
  }
  async prepare(asset,mode) {
    const decoded=await Promise.all(MODES.map(m=>this.decode(asset,m))),pair=decoded.map(d=>this.effective(d)),levels=pairNormalization(pair[0].metrics,pair[1].metrics,this.settings.equalLoudness),index=mode==='original'?0:1;
    return {...pair[index],gain:levels[mode],targetRms:levels.targetRms};
  }
  async play(assetOrId,{mode='enhanced',loop=false,exclusive=true,level=1,when}={}) {
    const asset=typeof assetOrId==='string'?this.assets.get(assetOrId):assetOrId;
    if(!asset)throw new Error('선택한 소리를 찾을 수 없습니다.');if(!MODES.includes(mode))throw new Error('비교 모드가 올바르지 않습니다.');
    if(exclusive)this.stopAll('new audition');const epoch=this.epoch;if(!this.usable(epoch))return null;
    const existing=[...this.voices.values()].find(v=>v.asset.id===asset.id&&v.mode===mode&&v.loop&&loop);if(existing)return existing;
    this.pending++;this.onChange();
    try{const prepared=await this.prepare(asset,mode);if(!this.usable(epoch))return null;return this.start(asset,prepared,{mode,loop,level,when});}
    catch(error){if(error.name==='AbortError'||epoch!==this.epoch)return null;this.lastError=error.message;throw error;}
    finally{this.pending--;this.onChange();}
  }
  start(asset,prepared,{mode='enhanced',loop=false,level=1,when}={}) {
    if(!this.usable())return null;
    const duplicate=[...this.voices.values()].find(v=>v.asset.id===asset.id&&v.mode===mode&&v.loop&&loop);if(duplicate)return duplicate;
    const priority=asset.category==='warning'?3:asset.category==='ambience'?1:2;
    // Cap even the short-lived release tails during a burst of repeated UI input.
    if(this.voices.size+this.releasing.size>=9)return null;
    if(this.voices.size>=3){const victim=[...this.voices.values()].sort((a,b)=>a.priority-b.priority||a.id-b.id)[0];if(victim.priority>priority)return null;this.stopVoice(victim);}
    const c=this.context,source=c.createBufferSource(),gain=c.createGain();source.buffer=prepared.buffer;source.loop=Boolean(loop);source.connect(gain);gain.connect(this.master);
    // Releases finish before a replacement begins, so an exclusive switch never
    // overlaps audible sources and priority replacement still has three audible slots.
    const releaseEnd=Math.max(c.currentTime,...[...this.releasing.values()].map(v=>v.stopAt||c.currentTime));
    when=Math.max(c.currentTime+.008,releaseEnd+.001,Number.isFinite(when)?when:0);
    level=clamp(level,0,1);
    const amount=prepared.gain*level,fade=Math.min(.004,prepared.buffer.duration/8),end=when+prepared.buffer.duration,fadeOutAt=Math.max(when+fade,end-.008);
    gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(amount,when+fade);
    if(!loop){gain.gain.setValueAtTime(amount,fadeOutAt);gain.gain.linearRampToValueAtTime(0,end);}
    let resolve;const done=new Promise(r=>{resolve=r;}),voice={id:this.nextVoice++,asset,mode,loop,priority,source,gain,buffer:prepared.buffer,start:when,duration:prepared.buffer.duration,normalizationGain:prepared.gain,targetRms:prepared.targetRms,level,amount,attack:fade,fadeOutAt,end,done,resolve,stopped:false};
    source.onended=()=>this.cleanupVoice(voice);this.voices.set(voice.id,voice);this.createdSources++;this.applySettings();source.start(when);this.onStarted(voice);this.onChange();return voice;
  }
  cleanupVoice(voice,reason='source ended') {
    if(voice.cleaned)return;voice.cleaned=true;voice.stopped=true;voice.cleanupReason=reason;clearTimeout(voice.releaseWatchdog);this.voices.delete(voice.id);this.releasing.delete(voice.id);voice.source.onended=null;try{voice.source.disconnect();voice.gain.disconnect();}catch{/* Already disconnected. */}voice.resolve();this.applySettings();this.onChange();
  }
  envelopeAt(voice,time) {
    if(time<=voice.start)return 0;
    if(time<voice.start+voice.attack)return voice.amount*(time-voice.start)/voice.attack;
    if(!voice.loop&&time>voice.fadeOutAt)return voice.amount*clamp((voice.end-time)/Math.max(.000001,voice.end-voice.fadeOutAt),0,1);
    return voice.amount;
  }
  stopVoice(voice) {
    if(!voice||voice.stopped)return;voice.stopped=true;this.voices.delete(voice.id);this.releasing.set(voice.id,voice);
    const now=this.context.currentTime,param=voice.gain.gain;voice.releaseAt=now+this.releaseFade;voice.stopAt=voice.releaseAt+.001;
    try{
      if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(now);else{param.cancelScheduledValues(now);param.setValueAtTime(this.envelopeAt(voice,now),now);}
      param.linearRampToValueAtTime(0,voice.releaseAt);voice.source.stop(voice.stopAt);
      // A suspended/interrupted device may not dispatch onended. It is silent;
      // a bounded watchdog completes graph cleanup if native time stops advancing.
      if(!voice.cleaned)voice.releaseWatchdog=setTimeout(()=>{if(voice.cleaned)return;try{voice.source.stop();}catch{/* Context may already be closed. */}this.cleanupVoice(voice,'release watchdog');},80);
    }catch{this.cleanupVoice(voice,'source already ended');}
    this.applySettings();this.onChange();
  }
  stopAll(reason='manual stop') {
    this.epoch++;for(const request of this.requests)request.abort();for(const [key,promise]of this.cache)if(!promise.decoded)this.cache.delete(key);for(const voice of [...this.voices.values()])this.stopVoice(voice);this.lastReason=reason;this.applySettings();this.onChange();
  }
  async playMany(ids) {
    this.stopAll('three cue audition');const epoch=this.epoch;if(!this.usable(epoch))return[];
    const assets=ids.slice(0,3).map(id=>typeof id==='string'?this.assets.get(id):id).filter(Boolean);this.pending++;this.onChange();
    try{const prepared=await Promise.all(assets.map(a=>this.prepare(a,'enhanced')));if(!this.usable(epoch))return[];const when=this.context.currentTime+.015;return assets.map((a,i)=>this.start(a,prepared[i],{mode:'enhanced',loop:false,when,level:.36})).filter(Boolean);}
    catch(error){if(error.name==='AbortError'||epoch!==this.epoch)return[];throw error;}finally{this.pending--;this.onChange();}
  }
  setHidden(hidden) {
    this.hidden=Boolean(hidden);const epoch=++this.visibilityEpoch;
    if(this.hidden){this.stopAll('tab hidden');void this.waitForReleases().then(async()=>{if(!this.hidden||epoch!==this.visibilityEpoch||this.disposed||!this.context)return;const operation=this.context.suspend();this.suspendPromise=operation;try{await operation;}finally{if(this.suspendPromise===operation)this.suspendPromise=null;}}).catch(()=>{});}
    this.onChange();
  }
  async inspectAll({release=true}={}) {
    if(!this.context||this.disposed)throw new Error('첫 클릭으로 오디오를 활성화한 뒤 실행해 주세요.');const epoch=this.epoch,results=[];let cancelled=false;
    for(const asset of this.assets.values()){
      for(const mode of MODES){if(epoch!==this.epoch||this.disposed||this.hidden){cancelled=true;break;}try{const d=await this.decode(asset,mode);results.push({id:asset.id,mode,status:'decoded',file:fileOf(asset,mode),sha256:mode==='original'?sourceHash(asset):outputHash(asset),...d.metrics});}catch(error){results.push({id:asset.id,mode,status:'error',message:error.message});}if(release)this.cache.delete(`${asset.id}:${mode}`);}
      if(cancelled)break;
    }
    this.onChange();return {schema:'cloudstitch-audio-cinematic-native-inspection/v5',method:'Native decodeAudioData only. No playback, EQ, quality judgment or human listening.',cancelled,generatedAt:new Date().toISOString(),results};
  }
  debug() {return {contextState:this.context?.state||'locked',settings:{...this.settings},hidden:this.hidden,disposed:this.disposed,epoch:this.epoch,pending:this.pending,cacheCount:this.cache.size,fetchCount:this.requests.size,createdSources:this.createdSources,lastReason:this.lastReason,lastError:this.lastError,gain:this.master?.gain.value??null,mixHeadroom:this.mixHeadroom,releaseCount:this.releasing.size,releasing:[...this.releasing.values()].map(v=>({id:v.id,assetId:v.asset.id,mode:v.mode,level:v.level,releaseAt:v.releaseAt,stopAt:v.stopAt,fadeMs:this.releaseFade*1000})),voices:[...this.voices.values()].map(v=>({id:v.id,assetId:v.asset.id,mode:v.mode,loop:v.loop,priority:v.priority,channels:v.buffer.numberOfChannels,start:v.start,duration:v.duration,normalizationGain:v.normalizationGain,targetRms:v.targetRms,level:v.level})),metrics:Object.fromEntries([...this.cache].filter(([,p])=>p.decoded).map(([key,p])=>[key,p.decoded.metrics]))};}
  async waitForReleases(){while(this.releasing.size)await Promise.all([...this.releasing.values()].map(v=>v.done));}
  async whenIdle(timeout=15000) {const start=Date.now();while(this.pending||this.voices.size||this.releasing.size){if(Date.now()-start>timeout)return false;await new Promise(r=>setTimeout(r,10));}return true;}
  async dispose() {
    if(this.disposePromise)return this.disposePromise;this.disposed=true;this.visibilityEpoch++;this.stopAll('dispose');this.cache.clear();
    this.disposePromise=(async()=>{await this.waitForReleases();if(this.context&&this.context.state!=='closed')await this.context.close();for(const voice of [...this.releasing.values()])this.cleanupVoice(voice,'context closed');try{this.master?.disconnect();}catch{/* Already disconnected. */}this.onChange();})();return this.disposePromise;
  }
}

async function boot() {
  const $=id=>document.getElementById(id);let catalog,assets=[],filtered=[],selectedId='',category='all',sequenceToken=0,sequenceActive=false,compareActive=false,visibleBuffer=null,storageKey,storageOk=true;
  const reviews=Object.create(null),settingsKey='cloudstitch:audio-cinematic:v5:settings';
  const current=()=>assets.find(a=>a.id===selectedId);
  const notice=(message,error=false)=>{$('notice').textContent=message;$('notice').classList.toggle('error',error);};
  const getReview=id=>reviews[id]||(reviews[id]={decision:'unreviewed',note:'',heard:{original:0,enhanced:0}});
  let storedSettings={};try{storedSettings=JSON.parse(localStorage.getItem(settingsKey)||'{}');}catch{storageOk=false;}
  const player=new RichReviewPlayer({settings:storedSettings,onChange:renderRuntime,onStarted:voice=>{
    const row=getReview(voice.asset.id);row.heard[voice.mode]=Math.min(100000,row.heard[voice.mode]+1);saveNotes();
    if(voice.asset.id===selectedId){visibleBuffer=voice.buffer;drawWaveform();$('waveform-mode').textContent=voice.mode==='original'?'PREVIOUS BODY v4 WAV':'BOLD DRAMATIC v5 WAV';renderHeard();$('track-info').textContent=`${timeText(voice.duration)} · ${voice.buffer.numberOfChannels} ch · ${(voice.buffer.sampleRate/1000).toFixed(1)} kHz`;}renderRuntime();
  }});
  player.setHidden(Boolean(document.hidden));
  function renderRuntime(){
    const d=player.debug(),running=d.contextState==='running'&&!d.hidden;
    $('unlock').dataset.state=player.settings.mute?'muted':running?'running':'locked';$('audio-state').textContent=player.settings.mute?'음소거 중':d.hidden?'탭 숨김 · 정지':running?'오디오 활성화됨':'오디오 활성화';
    $('runtime-status').textContent=`${d.voices.length}/3 재생 · ${d.pending?'파일 준비 중':d.contextState==='locked'?'첫 클릭 뒤 재생':'자동 재생 없음'}`;
  }
  function payload(){return {schema:REVIEW_SCHEMA,catalogVersion:catalog.version,catalogFingerprint:catalogFingerprint(catalog),catalogAssets:assets.map(assetIdentity),exportedAt:new Date().toISOString(),decisions:assets.map(a=>({...assetIdentity(a),...getReview(a.id)}))};}
  function saveNotes(){if(!storageKey)return;try{localStorage.setItem(storageKey,JSON.stringify(payload()));$('save-state').textContent='새 버전의 검수 메모를 이 브라우저에 저장함';}catch{storageOk=false;$('save-state').textContent='로컬 저장 불가 · JSON으로 내보내 주세요.';}renderSummary();}
  function renderSummary(){if(!assets.length)return;const counts={approved:0,revision:0,hold:0,unreviewed:0};for(const a of assets)counts[getReview(a.id).decision]++;$('review-progress').textContent=`${assets.length-counts.unreviewed} / ${assets.length} 검수`;$('review-summary').textContent=`승인 ${counts.approved} · 수정 ${counts.revision} · 보류 ${counts.hold}`;}
  function renderHeard(){const a=current();if(!a)return;const h=getReview(a.id).heard;$('heard').textContent=`재생 시작 · v4 ${h.original} / v5 ${h.enhanced}회`;}
  function saveSettings(){try{localStorage.setItem(settingsKey,JSON.stringify(player.settings));}catch{storageOk=false;notice('설정은 적용했습니다. 로컬 저장이 제한되어 있습니다.');}}
  function cancelFlow(stop=false){sequenceToken++;sequenceActive=false;compareActive=false;$('sequence').textContent='현재 목록 차례로 듣기 →';$('sequence-state').textContent='시네마틱 v5 기준';$('compare-ab').textContent='v4 → v5 비교';if(stop)player.stopAll('flow cancelled');}
  function stopAll(reason='manual stop'){cancelFlow();player.stopAll(reason);notice(reason==='tab hidden'?'탭을 숨겨 재생과 예약을 모두 정리했습니다. 다시 듣기는 버튼을 눌러 주세요.':'모든 소리를 정지했습니다.');}
  async function activate(){try{const ok=await player.unlock();if(!ok)notice(player.settings.mute?'음소거를 해제해 주세요.':'오디오를 다시 활성화해 주세요.');return ok;}catch(error){notice(error.message,true);return false;}}
  function renderFilters(){const filters=$('filters');filters.replaceChildren();for(const [key,label]of [['all','전체'],...Object.entries(CATEGORY_LABELS)]){if(key!=='all'&&!assets.some(a=>a.category===key))continue;const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.category=key;b.setAttribute('aria-pressed',String(category===key));b.addEventListener('click',()=>{cancelFlow(true);category=key;renderFilters();applyFilter();});filters.append(b);}}
  function applyFilter(){const q=$('search').value.trim().toLowerCase();filtered=assets.filter(a=>(category==='all'||a.category===category)&&[a.id,a.label,a.description,a.richDescription,JSON.stringify(a.eventMapping||{})].join(' ').toLowerCase().includes(q));$('filtered-count').textContent=`${filtered.length} / ${assets.length}`;$('empty').hidden=filtered.length>0;if(!filtered.some(a=>a.id===selectedId)&&filtered.length)select(filtered[0].id,false);renderList();}
  function renderList(){const list=$('asset-list');list.replaceChildren();for(const a of filtered){const row=document.createElement('button');row.type='button';row.className='asset-row';row.dataset.assetId=a.id;row.dataset.decision=getReview(a.id).decision;row.setAttribute('aria-pressed',String(a.id===selectedId));const title=document.createElement('b'),meta=document.createElement('small'),symbol=document.createElement('span');title.textContent=a.label;meta.textContent=`${CATEGORY_LABELS[a.category]||a.category} · ${timeText(a.duration||a.metrics?.output?.duration)}${a.loop?' · 루프':''}${a.id==='fire-mortar'?' · 최초 음원 수정 요청':a.id.startsWith('mortar-launch-')?' · A/B 후보':''}`;symbol.className='decision-symbol';symbol.textContent=DECISIONS[getReview(a.id).decision][0];symbol.setAttribute('aria-label',DECISIONS[getReview(a.id).decision][1]);row.append(title,meta,symbol);row.addEventListener('click',()=>select(a.id));list.append(row);}}
  function select(id,stop=true){if(!assets.some(a=>a.id===id))return;if(stop)cancelFlow(true);selectedId=id;visibleBuffer=null;$('repeat').checked=false;renderSelected();renderList();drawWaveform();}
  function renderMetadata(a){
    const out=$('metadata');out.replaceChildren();const add=(key,value)=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=String(value??'—');out.append(dt,dd);};
    const metrics=a.metrics||{},source=metrics.comparisonSource||metrics.previous||metrics.source||metrics.original||{},result=metrics.output||metrics.enhanced||{};
    add('ID',a.id);add('새 버전 상태','편집 완료 · 사람 청취 승인 대기 · 게임 적용 전');add('이전 v4 길이',timeText(source.duration||a.source?.duration||a.duration));add('새 v5 길이',timeText(result.duration||a.duration));
    add('v4 peak / RMS',`${dbText(source.peak)} / ${dbText(source.rms)}`);add('v5 peak / RMS',`${dbText(result.peak)} / ${dbText(result.rms)}`);add('이전 v4 SHA-256',sourceHash(a));add('새 v5 SHA-256',outputHash(a));
    add('편집 레시피',typeof a.recipe==='string'?a.recipe:JSON.stringify(a.recipe||a.processing||{},null,2));add('게임 연결 규격',JSON.stringify(a.eventMapping||{},null,2));
    add('이전 v4 출처',a.source?.provider||catalog.sourceProvider||'Cloudstitch 중저음 v4 · 로컬 편집 WAV');add('이전 v4 파일',a.source?.originalRelative||a.source?.file);if(a.provenance)add('최초 생성 이력 · 읽기 전용',JSON.stringify(a.provenance,null,2));add('이용권리',catalog.rights||a.source?.rights||'기존 생성 계정의 이용 약관·권리 조건을 따릅니다.');
    $('download-original').href=a.source.file;$('download-original').download=`${a.id}-body-v4.wav`;$('download-enhanced').href=a.file;$('download-enhanced').download=`${a.id}-bold-v5.wav`;
  }
  function renderSelected(){const a=current();if(!a)return;$('selected-title').textContent=a.label;$('selected-category').textContent=`02 / ${CATEGORY_LABELS[a.category]||'COMPARE'}`;$('description').textContent=a.description||'';$('rich-description').textContent=a.richDescription||'기존 생성 음원의 목재·황동·압력 조각을 겹쳐 충격 → 파열 → 여운으로 다시 구성한 v5입니다. 표현의 대담함은 청취 검수 대기입니다.';$('selected-status').textContent=a.id.startsWith('mortar-launch-')?'박격포 새 후보 · 검수 전':'새 편집 · 검수 전';$('feedback-warning').hidden=a.id!=='fire-mortar';const note=getReview(a.id);$('note').value=note.note;for(const input of document.querySelectorAll('input[name=decision]'))input.checked=input.value===note.decision;$('track-info').textContent=`${timeText(a.metrics?.output?.duration||a.duration)} · BOLD DRAMATIC v5 WAV`;$('waveform-mode').textContent='BOLD DRAMATIC v5 WAV';renderHeard();renderMetadata(a);}
  function drawWaveform(){const canvas=$('waveform'),ctx=canvas.getContext('2d');if(!ctx)return;const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);$('waveform-placeholder').hidden=Boolean(visibleBuffer);if(!visibleBuffer)return;const data=visibleBuffer.getChannelData(0),step=Math.max(1,Math.floor(data.length/w));ctx.strokeStyle='#57795f';ctx.lineWidth=1.6;ctx.beginPath();for(let x=0;x<w;x++){const start=Math.floor(x*data.length/w);let min=0,max=0;for(let i=start;i<Math.min(data.length,start+step);i++){min=Math.min(min,data[i]);max=Math.max(max,data[i]);}ctx.moveTo(x,h/2+min*h*.43);ctx.lineTo(x,h/2+max*h*.43);}ctx.stroke();}
  async function playSelected(mode){cancelFlow(true);const token=sequenceToken,a=current();if(!a)return;if(!await activate()||token!==sequenceToken||player.settings.mute)return;try{const voice=await player.play(a,{mode,loop:$('repeat').checked});if(voice)notice(`${a.label} · ${mode==='original'?'이전 v4':'시네마틱 v5'} 재생${voice.loop?' · 반복':''}`);}catch(error){notice(error.message,true);}}
  async function comparePair(){if(compareActive){stopAll();return;}cancelFlow(true);const token=sequenceToken,a=current();if(!a||!await activate()||token!==sequenceToken)return;let failed=false;compareActive=true;$('compare-ab').textContent='비교 중 · 정지';try{for(const mode of MODES){if(token!==sequenceToken||!player.usable())break;notice(`${a.label} · ${mode==='original'?'① 이전 v4':'② 시네마틱 v5'} 비교`);const voice=await player.play(a,{mode,loop:false});if(!voice)break;await voice.done;if(token!==sequenceToken)break;await new Promise(r=>setTimeout(r,220));}}catch(error){failed=true;notice(error.message,true);}finally{if(token===sequenceToken){compareActive=false;$('compare-ab').textContent='v4 → v5 비교';if(!failed)notice(`${a.label} · 비교 완료`);}}}
  async function playSequence(){if(sequenceActive){stopAll();return;}cancelFlow(true);const token=sequenceToken,ids=filtered.map(a=>a.id);if(!ids.length||!await activate()||token!==sequenceToken)return;let failed=false;sequenceActive=true;$('sequence').textContent='■ 차례로 듣기 정지';try{for(let i=0;i<ids.length;i++){if(token!==sequenceToken||!player.usable())break;selectedId=ids[i];visibleBuffer=null;renderSelected();renderList();drawWaveform();$('sequence-state').textContent=`${i+1} / ${ids.length}`;notice(`${i+1}/${ids.length} · ${current().label} · 시네마틱 v5`);const voice=await player.play(ids[i],{mode:'enhanced',loop:false});if(!voice)break;await voice.done;if(token!==sequenceToken)break;await new Promise(r=>setTimeout(r,220));}}catch(error){failed=true;notice(error.message,true);}finally{if(token===sequenceToken){sequenceActive=false;$('sequence').textContent='현재 목록 차례로 듣기 →';$('sequence-state').textContent='시네마틱 v5 기준';if(!failed)notice('현재 목록의 순차 재생을 마쳤습니다.');}}}
  function exportJson(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function fillCue(id,items){const s=$(id);s.replaceChildren();for(const a of items){const option=document.createElement('option');option.value=a.id;option.textContent=a.label;s.append(option);}}
  $('unlock').addEventListener('click',()=>void activate());$('stop-all').addEventListener('click',()=>stopAll());$('stop-selected').addEventListener('click',()=>stopAll());
  $('play-original').addEventListener('click',()=>void playSelected('original'));$('play-enhanced').addEventListener('click',()=>void playSelected('enhanced'));$('compare-ab').addEventListener('click',()=>void comparePair());$('sequence').addEventListener('click',()=>void playSequence());
  $('search').addEventListener('input',()=>{cancelFlow(true);applyFilter();});
  for(const [id,delta]of [['previous',-1],['next',1]])$(id).addEventListener('click',()=>{if(!filtered.length)return;const i=filtered.findIndex(a=>a.id===selectedId);select(filtered[(i+delta+filtered.length)%filtered.length].id);});
  $('volume').value=String(Math.round(player.settings.volume*100));$('volume-value').value=`${Math.round(player.settings.volume*100)}%`;
  $('volume').addEventListener('input',()=>{player.setSettings({volume:Number($('volume').value)/100});$('volume-value').value=`${$('volume').value}%`;saveSettings();});
  for(const [id,key]of [['equal-loudness','equalLoudness'],['mono','mono'],['mute','mute']]){$(id).checked=player.settings[key];$(id).addEventListener('change',()=>{cancelFlow(true);player.setSettings({[key]:$(id).checked});saveSettings();notice('듣기 설정을 적용했습니다. 재생 버튼으로 다시 들어보세요.');});}
  $('repeat').addEventListener('change',()=>{cancelFlow(true);notice('반복 설정을 바꿨습니다. 듣기 버튼으로 시작해 주세요.');});
  $('note').addEventListener('input',()=>{if(!current())return;getReview(selectedId).note=$('note').value;saveNotes();});for(const radio of document.querySelectorAll('input[name=decision]'))radio.addEventListener('change',()=>{if(!current())return;getReview(selectedId).decision=radio.value;saveNotes();renderList();});
  $('export-notes').addEventListener('click',()=>{if(!catalog)return;saveNotes();exportJson(payload(),`Cloudstitch-${catalog.version}-review.json`);notice('새 버전의 검수 결과를 JSON으로 내보냈습니다.');});
  $('import-notes').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>1024*1024)throw new Error('검수 JSON은 1 MB 이내만 가져올 수 있습니다.');const incoming=validateReviewImport(JSON.parse(await file.text()),catalog);Object.assign(reviews,incoming);saveNotes();renderSelected();renderList();notice('같은 버전과 파일 SHA를 확인한 검수 메모를 합쳤습니다.');}catch(error){notice(`가져오기 실패: ${error.message}`,true);}finally{event.target.value='';}});
  $('play-three').addEventListener('click',async()=>{cancelFlow(true);const token=sequenceToken;if(!await activate()||token!==sequenceToken)return;try{const voices=await player.playMany(['cue-warning','cue-impact','cue-weapon'].map(id=>$(id).value));notice(`시네마틱 v5 ${voices.length}개를 함께 재생합니다. 각 소리의 식별성을 확인해 주세요.`);}catch(error){notice(error.message,true);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopAll('tab hidden');player.setHidden(true);}else player.setHidden(false);});
  window.addEventListener('pagehide',()=>{cancelFlow();void player.dispose();});window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  window.__audioRich={get debug(){return {...player.debug(),selectedId,filteredIds:filtered.map(a=>a.id),sequenceActive,compareActive,notes:catalog?payload():null,storageAvailable:storageOk};},getCatalog:()=>catalog,inspectAll:async options=>{if(!await activate())throw new Error('오디오 활성화가 필요합니다.');return player.inspectAll(options);},play:async(id,options)=>{cancelFlow(options?.exclusive!==false);const token=sequenceToken;if(!await activate()||token!==sequenceToken)return null;return player.play(id,options);},stopAll,whenIdle:timeout=>player.whenIdle(timeout),dispose:async()=>{cancelFlow();await player.dispose();}};
  try{
    const response=await fetch('catalog.json',{credentials:'same-origin'});if(!response.ok)throw new Error(`카탈로그 응답 ${response.status}`);catalog=await response.json();
    if(!catalog||typeof catalog.version!=='string'||!Array.isArray(catalog.assets)||catalog.assets.length===0||catalog.assets.length>200)throw new Error('카탈로그 형식을 확인해 주세요.');
    const seen=new Set();for(const a of catalog.assets){if(!a||typeof a.id!=='string'||!a.id||seen.has(a.id)||!safeAudioFile(a.file)||!safeAudioFile(a.source?.file))throw new Error('음원 ID 또는 로컬 파일 경로가 올바르지 않습니다.');seen.add(a.id);}assets=catalog.assets;player.assets=new Map(assets.map(a=>[a.id,a]));
    storageKey=`cloudstitch:audio-cinematic:v5:${catalog.version}:${catalogFingerprint(catalog)}:notes`;
    try{const stored=localStorage.getItem(storageKey);if(stored)Object.assign(reviews,validateReviewImport(JSON.parse(stored),catalog));}catch{notice('이 버전의 저장 메모를 읽지 못했습니다. 기존 저장값은 보존했습니다.');storageOk=false;}
    $('asset-count').replaceChildren(document.createTextNode(String(assets.length)),Object.assign(document.createElement('small'),{textContent:' SOUNDS'}));$('catalog-version').textContent=catalog.version;
    selectedId=assets[0].id;renderFilters();applyFilter();renderSelected();renderSummary();renderRuntime();
    fillCue('cue-warning',assets.filter(a=>a.category==='warning'));fillCue('cue-impact',assets.filter(a=>a.category==='impact'));fillCue('cue-weapon',assets.filter(a=>a.category==='weapon'&&a.id.startsWith('fire-')));
    if(storageOk)$('save-state').textContent='이전 검수와 별도 보관 · 이 브라우저에 자동 저장';
  }catch(error){notice(`비교실 준비 실패: ${error.message}`,true);for(const id of ['play-original','play-enhanced','compare-ab','sequence','play-three','export-notes'])$(id).disabled=true;}
}
if(typeof document!=='undefined')void boot();
