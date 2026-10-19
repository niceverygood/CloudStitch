import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {
  RichReviewPlayer,pairNormalization,sanitizeSettings,validateReviewImport,
  catalogFingerprint,assetIdentity,REVIEW_SCHEMA,safeAudioFile,
} from './review.mjs';

// This deliberately tests lifecycle without opening a browser or claiming audibility.
class FakeParam {
  value=1;operations=[];
  setValueAtTime(value,time){this.value=value;this.operations.push(['set',value,time]);}
  linearRampToValueAtTime(value,time){this.value=value;this.operations.push(['ramp',value,time]);}
  setTargetAtTime(value,time,tau){this.value=value;this.operations.push(['target',value,time,tau]);}
  cancelScheduledValues(time){this.operations.push(['cancel',time]);}
}
class FakeGain {
  gain=new FakeParam();disconnected=false;
  connect(){}disconnect(){this.disconnected=true;}
}
class FakeBuffer {
  constructor(channels=2,length=400,rate=1000,amplitude=.6){
    this.numberOfChannels=channels;this.length=length;this.sampleRate=rate;this.duration=length/rate;
    this.data=Array.from({length:channels},(_,channel)=>Float32Array.from({length},(_,i)=>amplitude*Math.sin(i*.14+channel*.02)));
  }
  getChannelData(channel){return this.data[channel];}
}
class FakeSource {
  started=false;stopped=false;disconnected=false;
  constructor(context){this.context=context;}
  connect(){}disconnect(){this.disconnected=true;clearTimeout(this.timer);}
  arm(){clearTimeout(this.timer);this.timer=setTimeout(()=>{if(this.context.state==='running'&&this.context.currentTime>=this.stopTime-.0001)this.finish();else this.arm();},Math.max(1,Math.ceil((this.stopTime-this.context.currentTime)*1000)));}
  start(when){this.started=true;this.startTime=when;if(!this.loop){this.stopTime=when+this.buffer.duration;this.arm();}}
  stop(when=this.context.currentTime){this.stopped=true;this.stopTime=when;this.arm();}
  finish(){if(this.ended)return;this.ended=true;clearTimeout(this.timer);this.onended?.();}
}
class FakeContext {
  state='suspended';destination={};created=[];gains=[];offset=.5;resumedAt=0;
  get currentTime(){return this.offset+(this.state==='running'?(Date.now()-this.resumedAt)/1000:0);}
  createGain(){const gain=new FakeGain();this.gains.push(gain);return gain;}
  createBufferSource(){const source=new FakeSource(this);this.created.push(source);return source;}
  createBuffer(channels,length,rate){return new FakeBuffer(channels,length,rate,0);}
  async decodeAudioData(bytes){return new FakeBuffer(2,400,1000,new Uint8Array(bytes)[0]===1?.6:.42);}
  async resume(){if(this.state!=='running'){this.resumedAt=Date.now();this.state='running';}}
  async suspend(){this.offset=this.currentTime;this.state='suspended';}
  async close(){this.offset=this.currentTime;this.state='closed';for(const source of this.created)source.finish();}
}
const fetcher=async file=>({ok:true,arrayBuffer:async()=>new Uint8Array([file.startsWith('original')?1:2]).buffer});
const base={id:'fire-test',label:'테스트 발사',category:'weapon',source:{file:'original/fire-test.wav',sha256:'a'.repeat(64)},file:'enhanced/fire-test.wav',sha256:'b'.repeat(64)};
const fixtures=[base,{...base,id:'danger-test',category:'warning'},{...base,id:'wind-test',category:'ambience'}];
const results=[];
async function test(name,run){try{await run();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
const context=new FakeContext(),player=new RichReviewPlayer({assets:fixtures,contextFactory:()=>context,fetcher});
await test('locked playback creates no source or queued voice',async()=>{assert.equal(await player.play(base),null);assert.equal(context.created.length,0);assert.equal(player.debug().pending,0);});
await test('first activation has no delayed old playback',async()=>{assert.equal(await player.unlock(),true);assert.equal(context.created.length,0);assert.equal(player.debug().voices.length,0);});
await test('default volume is 0.4 with equal RMS enabled',()=>{assert.equal(player.debug().gain,.4);assert.equal(player.settings.equalLoudness,true);});
await test('idle volume is applied immediately',()=>{player.setSettings({volume:.23});assert.equal(player.debug().gain,.23);assert.equal(player.master.gain.operations.at(-1)[0],'set');});
await test('original playback uses the actual original mode',async()=>{const voice=await player.play(base,{mode:'original',loop:true});assert.equal(voice.mode,'original');assert.equal(voice.source.loop,true);assert.equal(player.debug().voices.length,1);});
await test('same loop request does not create a second source',async()=>{const first=player.debug().voices[0].id,created=context.created.length;const repeat=await player.play(base,{mode:'original',loop:true,exclusive:false});assert.equal(repeat.id,first);assert.equal(context.created.length,created);});
await test('active volume update uses short smoothing',()=>{player.setSettings({volume:.27});assert.equal(player.master.gain.operations.at(-1)[0],'target');assert.equal(player.debug().gain,.27);});
await test('mono change stops the old channel graph',()=>{player.setSettings({mono:true});assert.equal(player.debug().voices.length,0);assert.ok(context.created.every(s=>s.stopped));});
await test('mono reuses downmixed one-channel PCM',async()=>{const voice=await player.play(base,{mode:'enhanced'});assert.equal(voice.buffer.numberOfChannels,1);assert.equal(voice.mode,'enhanced');});
await test('three-cue preview starts exactly three concurrent sources',async()=>{player.stopAll();const voices=await player.playMany(fixtures);assert.equal(voices.length,3);assert.equal(player.debug().voices.length,3);assert.equal(new Set(voices.map(v=>v.start)).size,1);});
await test('three voices reserve headroom at full master volume',()=>{player.setSettings({volume:1});const voices=player.debug().voices;const aggregatePeak=voices.reduce((sum,v)=>sum+.8*v.level,0)*player.debug().gain;assert.ok(aggregatePeak<=.800001);});
await test('a fourth voice respects the three-voice cap',async()=>{await player.play(base,{exclusive:false});assert.equal(player.debug().voices.length,3);});
await test('lower-priority ambience cannot steal warning voices',async()=>{player.stopAll();for(let i=0;i<3;i++)await player.play(fixtures[1],{exclusive:false});const created=context.created.length;assert.equal(await player.play(fixtures[2],{exclusive:false}),null);assert.equal(context.created.length,created);assert.ok(player.debug().voices.every(v=>v.priority===3));});
await test('hidden state cleans active and looping sources',()=>{player.setHidden(true);assert.equal(player.debug().voices.length,0);assert.equal(player.debug().hidden,true);});
await test('hidden state refuses playback',async()=>{const created=context.created.length;assert.equal(await player.play(base),null);assert.equal(context.created.length,created);});
await test('hidden release finishes before context suspension',async()=>{assert.equal(await player.whenIdle(500),true);await Promise.resolve();assert.equal(player.debug().releaseCount,0);assert.equal(context.state,'suspended');});
await test('visible state does not automatically resume playback',async()=>{player.setHidden(false);assert.equal(player.debug().voices.length,0);assert.equal(context.state,'suspended');await player.unlock();});
await test('stopAll keeps a five-millisecond fade connected until source ended',async()=>{
  const voice=await player.play(base,{loop:true});await new Promise(r=>setTimeout(r,18));let ended=false;voice.done.then(()=>{ended=true;});player.stopAll();
  assert.equal(player.debug().voices.length,0);assert.equal(player.debug().releaseCount,1);assert.equal(voice.source.disconnected,false);assert.equal(voice.gain.disconnected,false);
  const last=voice.gain.gain.operations.slice(-2);assert.equal(last[0][0],'set');assert.ok(last[0][1]>0);assert.equal(last[1][0],'ramp');assert.equal(last[1][1],0);assert.ok(Math.abs(last[1][2]-last[0][2]-.005)<1e-9);
  await Promise.resolve();assert.equal(ended,false);assert.equal(await player.whenIdle(500),true);assert.equal(ended,true);assert.equal(player.debug().releaseCount,0);assert.equal(voice.source.disconnected,true);assert.equal(voice.gain.disconnected,true);
});
await test('release tails retain mix headroom until cleanup',async()=>{
  const voices=await player.playMany(fixtures);const reserved=player.debug().mixHeadroom;player.stopAll();assert.equal(player.debug().releaseCount,3);assert.equal(player.debug().mixHeadroom,reserved);assert.ok(player.debug().gain<=1/reserved+1e-7);await player.whenIdle(500);assert.equal(player.debug().mixHeadroom,1);
});
await test('exclusive replacement is scheduled after the old release stop',async()=>{
  const old=await player.play(base,{loop:true});await new Promise(r=>setTimeout(r,15));const replacement=await player.play(fixtures[1]);assert.ok(replacement.start>=old.stopAt+.00099);assert.equal(player.debug().voices.length,1);player.stopAll();await player.whenIdle(500);
});
await test('rapid repeated replacements keep physical source count bounded',async()=>{
  for(let i=0;i<30;i++)await player.play(base,{loop:true});const debug=player.debug();assert.ok(debug.voices.length<=3);assert.ok(debug.voices.length+debug.releaseCount<=9);player.stopAll();await player.whenIdle(500);assert.equal(player.debug().releaseCount,0);
});
await test('hidden suspension is cancelled when visibility changes during release',async()=>{
  await player.play(base,{loop:true});player.setHidden(true);player.setHidden(false);await player.whenIdle(500);await Promise.resolve();assert.equal(context.state,'running');assert.equal(player.debug().voices.length,0);
});
await test('suspended release watchdog completes without native onended',async()=>{
  const interruptedContext=new FakeContext(),interrupted=new RichReviewPlayer({assets:[base],contextFactory:()=>interruptedContext,fetcher});await interrupted.unlock();await interrupted.play(base,{loop:true});await interruptedContext.suspend();interrupted.stopAll();assert.equal(interrupted.debug().releaseCount,1);assert.equal(await interrupted.whenIdle(500),true);assert.equal(interrupted.debug().releaseCount,0);await interrupted.dispose();
});
await test('new activation waits for an already pending hidden suspend',async()=>{
  let finishSuspend;const delayedContext=new FakeContext(),delayed=new RichReviewPlayer({assets:[base],contextFactory:()=>delayedContext,fetcher});
  await delayed.unlock();delayedContext.suspend=()=>new Promise(resolve=>{finishSuspend=()=>{delayedContext.offset=delayedContext.currentTime;delayedContext.state='suspended';resolve();};});
  delayed.setHidden(true);await new Promise(r=>setTimeout(r,0));assert.equal(typeof finishSuspend,'function');delayed.setHidden(false);const activation=delayed.unlock();let resumed=false;activation.then(()=>{resumed=true;});await Promise.resolve();assert.equal(resumed,false);finishSuspend();assert.equal(await activation,true);assert.equal(delayedContext.state,'running');await delayed.dispose();
});
await test('native-inspection interface decodes both modes without playing',async()=>{const created=context.created.length;const report=await player.inspectAll({release:true});assert.equal(report.results.length,fixtures.length*2);assert.ok(report.results.every(r=>r.status==='decoded'&&r.finite));assert.equal(context.created.length,created);});
await test('release inspection leaves no cached PCM',()=>{assert.equal(player.debug().cacheCount,0);});
await test('cache limit remains bounded across many different cues',async()=>{for(let i=0;i<14;i++)await player.decode({...base,id:`test-${i}`},'original');assert.ok(player.debug().cacheCount<=8);});
await test('pair gains produce exactly equal RMS',()=>{const original={peak:.8,rms:.09},enhanced={peak:.7,rms:.1},levels=pairNormalization(original,enhanced);assert.ok(Math.abs(original.rms*levels.original-enhanced.rms*levels.enhanced)<1e-12);});
await test('pair gains keep both peaks at or below 0.8',()=>{const original={peak:.99,rms:.15},enhanced={peak:.3,rms:.02},levels=pairNormalization(original,enhanced);assert.ok(original.peak*levels.original<=.80000001);assert.ok(enhanced.peak*levels.enhanced<=.80000001);});
await test('disabled RMS comparison preserves file level below peak cap',()=>{const levels=pairNormalization({peak:.6,rms:.1},{peak:.9,rms:.15},false);assert.equal(levels.original,1);assert.ok(Math.abs(levels.enhanced-.8/.9)<1e-12);});
await test('silent or corrupt comparison metrics are rejected',()=>{assert.throws(()=>pairNormalization({peak:0,rms:0},{peak:.4,rms:.1}));assert.throws(()=>pairNormalization({peak:NaN,rms:.1},{peak:.4,rms:.1}));});
const catalog={version:'audio-rich-test',assets:[base]};
const decision={...assetIdentity(base),decision:'revision',note:'저음을 조금 줄여 주세요.',heard:{original:1,enhanced:2}};
const payload={schema:REVIEW_SCHEMA,catalogVersion:catalog.version,catalogFingerprint:catalogFingerprint(catalog),catalogAssets:[assetIdentity(base)],decisions:[decision]};
await test('review JSON preserves decision, note and separate play counts',()=>{assert.deepEqual(validateReviewImport(payload,catalog)[base.id],{decision:decision.decision,note:decision.note,heard:decision.heard});});
await test('old review schema and other versions are rejected',()=>{assert.throws(()=>validateReviewImport({...payload,schema:'cloudstitch-audio-review/v4'},catalog));assert.throws(()=>validateReviewImport({...payload,catalogVersion:'other'},catalog));});
await test('catalog original or enhanced SHA mismatch is rejected',()=>{assert.throws(()=>validateReviewImport({...payload,catalogAssets:[{...assetIdentity(base),enhancedSha256:'c'.repeat(64)}]},catalog));assert.throws(()=>validateReviewImport({...payload,decisions:[{...decision,originalSha256:'d'.repeat(64)}]},catalog));});
await test('duplicate or unknown review IDs are rejected',()=>{assert.throws(()=>validateReviewImport({...payload,decisions:[decision,decision]},catalog));assert.throws(()=>validateReviewImport({...payload,decisions:[{...decision,id:'missing'}]},catalog));});
await test('invalid decisions or oversized notes are rejected',()=>{assert.throws(()=>validateReviewImport({...payload,decisions:[{...decision,decision:'auto-approved'}]},catalog));assert.throws(()=>validateReviewImport({...payload,decisions:[{...decision,note:'x'.repeat(4001)}]},catalog));});
await test('corrupt settings recover to defaults and clamp numeric volume',()=>{assert.equal(sanitizeSettings(null).volume,.4);assert.equal(sanitizeSettings({volume:NaN}).volume,.4);assert.equal(sanitizeSettings({volume:99,mono:'bad'}).volume,1);assert.equal(sanitizeSettings({mono:'bad'}).mono,false);});
await test('audio paths reject traversal or remote files',()=>{assert.ok(safeAudioFile('original/fire-test.wav'));assert.ok(safeAudioFile('enhanced/fire-test.wav'));assert.equal(safeAudioFile('original/../test.wav'),false);assert.equal(safeAudioFile('https://example.com/test.wav'),false);assert.equal(safeAudioFile('enhanced/test.wav?remote=1'),false);});
await test('dispose awaits release cleanup and closes context, voices and PCM cache',async()=>{await player.play(base,{loop:true});const disposal=player.dispose();assert.equal(player.debug().voices.length,0);assert.equal(player.debug().releaseCount,1);await disposal;assert.equal(player.debug().releaseCount,0);assert.equal(player.debug().voices.length,0);assert.equal(player.debug().cacheCount,0);assert.equal(player.debug().disposed,true);assert.equal(context.state,'closed');});
await test('disposed context cannot restart',async()=>{await assert.rejects(()=>player.unlock());assert.equal(await player.play(base),null);});
await test('stop during two asynchronous decodes creates no stale source',async()=>{
  const releases=[],ctx=new FakeContext(),slow=new RichReviewPlayer({assets:[base],contextFactory:()=>ctx,fetcher:async()=>{await new Promise(r=>releases.push(r));return {ok:true,arrayBuffer:async()=>new Uint8Array([1]).buffer};}});
  await slow.unlock();const request=slow.play(base);await new Promise(r=>setTimeout(r,0));slow.stopAll();for(const release of releases)release();assert.equal(await request,null);assert.equal(slow.debug().createdSources,0);await slow.dispose();
});
await test('rapid switch after aborted fetch can create a fresh voice',async()=>{
  let slow=true;const releases=[],ctx=new FakeContext(),switcher=new RichReviewPlayer({assets:[base],contextFactory:()=>ctx,fetcher:async()=>{if(slow)await new Promise(r=>releases.push(r));return {ok:true,arrayBuffer:async()=>new Uint8Array([1]).buffer};}});
  await switcher.unlock();const stale=switcher.play(base);await new Promise(r=>setTimeout(r,0));switcher.stopAll();slow=false;const fresh=await switcher.play(base,{mode:'enhanced'});assert.ok(fresh);for(const release of releases)release();assert.equal(await stale,null);assert.equal(switcher.debug().voices.length,1);await switcher.dispose();
});
await test('static template includes every direct DOM target exactly once',async()=>{
  const template=await readFile(new URL('./index-template.html',import.meta.url),'utf8'),module=await readFile(new URL('./review.mjs',import.meta.url),'utf8'),ids=[...template.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  for(const match of module.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(match[1]),`Missing DOM id ${match[1]}`);
  assert.equal(/(?:src|href)="https?:\/\//i.test(template),false);assert.ok(template.includes('id="feedback-warning"'));assert.ok(template.includes('id="equal-loudness" checked'));
});
const report={schema:'cloudstitch-audio-cinematic-player-verification/v5',generatedAt:new Date().toISOString(),method:'Node fake AudioContext with advancing time, scheduled stop/onended and release watchdog; lifecycle and static template tests. No native browser, decode, playback, mobile measurement or human listening.',releasePolicy:'5 ms gain release, 1 ms stop margin, disconnect after onended; silent/interrupted context watchdog cleanup at 80 ms. whenIdle waits pending, active and releasing voices.',passed:results.every(r=>r.passed),checks:results.length,passCount:results.filter(r=>r.passed).length,results};
const destination=new URL('../../../outputs/audio-cinematic-v5/player-verification.json',import.meta.url);
await mkdir(new URL('.',destination),{recursive:true});await writeFile(destination,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:report.checks,passCount:report.passCount,output:fileURLToPath(destination)}));
if(!report.passed){for(const failure of results.filter(r=>!r.passed))console.error(`${failure.name}: ${failure.error}`);process.exitCode=1;}
