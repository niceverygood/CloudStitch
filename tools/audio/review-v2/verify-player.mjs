import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { REVIEW_SCHEMA, DEFAULT_SETTINGS, sanitizeSettings, safeAssetFile, validateReviewImport, measureBuffer, ReviewAudioEngine } from './review.mjs';

// Scheduling/lifecycle fixtures only. No browser, network request, MP3 decoder or audio hardware is used.
class FakeParam {
  constructor(value = 0) { this.value = value; this.events = []; }
  cancelScheduledValues(time) { this.events.push(['cancel', time]); return this; }
  setValueAtTime(value, time) { assert.ok(Number.isFinite(value)); this.value = value; this.events.push(['set', value, time]); return this; }
  setTargetAtTime(value, time, constant) { assert.ok(Number.isFinite(value)); this.value = value; this.events.push(['target', value, time, constant]); return this; }
  linearRampToValueAtTime(value, time) { assert.ok(Number.isFinite(value)); this.value = value; this.events.push(['ramp', value, time]); return this; }
}
class FakeNode {
  constructor() { this.connections = []; this.disconnected = false; }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections.length = 0; this.disconnected = true; }
}
class FakeSource extends FakeNode {
  constructor(context) { super(); this.context = context; this.started = false; this.ended = false; this.startTime = Infinity; this.stopTime = Infinity; this.loop = false; this.buffer = null; this.onended = null; }
  start(time = 0) {
    assert.equal(this.started, false, 'AudioBufferSource may start only once');
    assert.ok(this.buffer); this.started = true; this.startTime = Math.max(time, this.context.currentTime);
    if (!this.loop) this.stopTime = this.startTime + this.buffer.duration;
    this.context.starts++; this.context.tick();
  }
  stop(time = 0) { assert.ok(this.started, 'Cannot stop an unstarted source'); this.stopTime = Math.min(this.stopTime, Math.max(time, this.context.currentTime)); this.context.tick(); }
  finish() { if (!this.ended) { this.ended = true; this.onended?.(); } }
  get active() { return this.started && !this.ended && this.startTime <= this.context.currentTime && this.stopTime > this.context.currentTime; }
}
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'suspended'; this.destination = new FakeNode(); this.sources = []; this.starts = 0; this.resumeCalls = 0; this.suspendCalls = 0; this.closeCalls = 0; this.decodeCalls = 0; this.resumeGate = null; this.decodeGate = null; this.decodeError = null; this.onstatechange = null; }
  createGain() { return Object.assign(new FakeNode(), { gain: new FakeParam(1) }); }
  createDynamicsCompressor() { return Object.assign(new FakeNode(), Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(name => [name, new FakeParam()]))); }
  createWaveShaper() { return Object.assign(new FakeNode(), { curve: null, oversample: 'none' }); }
  createBufferSource() { const source = new FakeSource(this); this.sources.push(source); return source; }
  createBuffer(channels, length, sampleRate) {
    assert.ok(Number.isInteger(channels) && channels > 0); assert.ok(Number.isInteger(length) && length > 0); assert.ok(Number.isFinite(sampleRate) && sampleRate > 0);
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: channel => data[channel] };
  }
  async decodeAudioData(bytes) { assert.ok(bytes instanceof ArrayBuffer); this.decodeCalls++; if (this.decodeGate) await this.decodeGate; if (this.decodeError) throw this.decodeError; return pcmFixture(this); }
  async resume() { this.resumeCalls++; if (this.resumeGate) await this.resumeGate; if (this.state !== 'closed') this.state = 'running'; this.onstatechange?.(); }
  async suspend() { this.suspendCalls++; if (this.state !== 'closed') this.state = 'suspended'; this.onstatechange?.(); }
  async close() { this.closeCalls++; this.state = 'closed'; for (const source of this.sources) if (source.started) source.finish(); this.onstatechange?.(); }
  tick() { for (const source of this.sources) if (source.started && !source.ended && source.stopTime <= this.currentTime) source.finish(); }
  advance(seconds) { assert.ok(seconds >= 0); this.currentTime += seconds; this.tick(); }
  get activeSources() { this.tick(); return this.sources.filter(source => source.active); }
}

function pcmFixture(context, { channels = 2, length = 1600, sampleRate = 8000, silent = false, cancelMono = false } = {}) {
  const buffer = context.createBuffer(channels, length, sampleRate);
  for (let channel = 0; channel < channels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] = silent ? 0 : cancelMono ? Math.sin(i * .17) * (channel % 2 ? -1 : 1) : Math.sin(i * .17 + channel * .2) * (channel ? .85 : 1.4);
  }
  return buffer;
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function response() { return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(16) }; }
function asset(id = 'fixture-shot', category = 'weapon', priority = 2) { return { id, label: id, category, priority, loop: category === 'ambience', status: 'generated_unreviewed', file: `audio/${id}.mp3`, sha256: 'a'.repeat(64) }; }
const fixtures = [];
function fixture(options = {}) {
  const context = new FakeAudioContext(), fetches = [], starts = []; let factories = 0;
  const engine = new ReviewAudioEngine({ contextFactory: () => { factories++; return context; }, fetcher: async (file, fetchOptions) => { fetches.push({ file, ...fetchOptions }); return options.fetchGate ? options.fetchGate.promise : options.fetcher ? options.fetcher(file, fetchOptions) : response(); }, settings: options.settings, onStarted: voice => starts.push(voice) });
  const value = { context, engine, fetches, starts, get factories() { return factories; } }; fixtures.push(value); return value;
}
const checks = [];
async function check(name, fn) {
  const firstFixture = fixtures.length;
  try { const evidence = await fn(); checks.push({ name, passed: true, evidence: evidence ?? null }); }
  catch (error) { checks.push({ name, passed: false, detail: error.stack ?? String(error) }); }
  finally { for (const f of fixtures.slice(firstFixture)) { try { await f.engine.dispose(); } catch (error) { checks.push({ name: `${name}: fixture disposal`, passed: false, detail: error.message }); } } }
}
const maximumPeak = buffer => measureBuffer(buffer).peak;

await check('pure module import leaves DOM, browser and network untouched', () => { assert.equal(typeof document, 'undefined'); assert.equal(typeof window, 'undefined'); assert.equal(typeof ReviewAudioEngine, 'function'); return 'Module boot is guarded by typeof document; no browser is created.'; });
await check('settings recover malformed input and discard unknown keys', () => {
  for (const bad of [null, undefined, [], true, 5, 'bad']) assert.deepEqual(sanitizeSettings(bad), DEFAULT_SETTINGS);
  const clean = sanitizeSettings({master: 2, sfx: -1, ambience: NaN, mute: 'yes', mono: {}, lowDynamic: null, unexpected: true});
  assert.deepEqual(clean, {...DEFAULT_SETTINGS, master: 1, sfx: 0});
  const valid = sanitizeSettings({master: .2, sfx: .3, ambience: .4, mute: true, mono: true, lowDynamic: true}); assert.equal(valid.master, .2); assert.equal(valid.mute, true); assert.equal(valid.lowDynamic, true); return {clean, valid};
});
await check('safeAssetFile accepts local audio and blocks remote/traversal/encoded paths', () => {
  for (const good of ['audio/fire-cannon.mp3', 'audio/variants/shot_01.wav', 'audio/a-b.ogg']) assert.equal(safeAssetFile(good), true, good);
  for (const bad of [null, '', '../audio/a.mp3', '/audio/a.mp3', 'https://example.test/a.mp3', '//example.test/a.mp3', 'audio/../a.mp3', 'audio/a/../../b.mp3', 'audio//a.mp3', 'audio/%2e%2e/a.mp3', 'audio/a.mp3?url=remote', 'audio/a\\b.mp3', 'audio/evil.html']) assert.equal(safeAssetFile(bad), false, String(bad));
  return '3 local fixtures accepted; 13 unsafe/non-audio fixtures rejected.';
});
const reviewAssets = [asset('one'), asset('two')], reviewVersion = 'fixture-v2';
const reviewPayload = (overrides = {}) => ({schema: REVIEW_SCHEMA, catalogVersion: reviewVersion, decisions: [{id: 'one', decision: 'approved', note: '목재 잔향 검수 메모', heard: 4, sha256: 'a'.repeat(64)}], ...overrides});
await check('review JSON valid schema/version/hash preserves decisions without prototypes', () => { const r = validateReviewImport(reviewPayload(), reviewAssets, reviewVersion); assert.equal(Object.getPrototypeOf(r), null); assert.deepEqual(r.one, {decision: 'approved', note: '목재 잔향 검수 메모', heard: 4}); assert.equal(Object.hasOwn(r, 'two'), false); });
await check('review JSON rejects malformed root/schema/version/decisions', () => { for (const bad of [null, [], 'text', reviewPayload({schema: 'other'}), reviewPayload({catalogVersion: 'old'}), reviewPayload({decisions: {}}), reviewPayload({decisions: [{}, {}, {}]})]) assert.throws(() => validateReviewImport(bad, reviewAssets, reviewVersion)); });
await check('review JSON rejects unknown/duplicate/prototype IDs and invalid decisions', () => {
  for (const decisions of [[{id:'unknown',decision:'approved',note:''}], [{id:'__proto__',decision:'approved',note:''}], [{id:'one',decision:'approved',note:''},{id:'one',decision:'hold',note:''}], [{id:'one',decision:'final',note:''}], [null]]) assert.throws(() => validateReviewImport(reviewPayload({decisions}), reviewAssets, reviewVersion));
});
await check('review JSON enforces note length/type and rejects changed audio hash', () => {
  for (const note of [null, 42, {}, 'x'.repeat(4001)]) assert.throws(() => validateReviewImport(reviewPayload({decisions: [{id:'one',decision:'revision',note}]}), reviewAssets, reviewVersion));
  assert.throws(() => validateReviewImport(reviewPayload({decisions: [{id:'one',decision:'hold',note:'',sha256:'b'.repeat(64)}]}), reviewAssets, reviewVersion));
  assert.equal(validateReviewImport(reviewPayload({decisions: [{id:'one',decision:'revision',note:'x'.repeat(4000),heard:-8}]}), reviewAssets, reviewVersion).one.heard, 0);
  assert.equal(validateReviewImport(reviewPayload({decisions: [{id:'one',decision:'hold',note:'',heard:100001}]}), reviewAssets, reviewVersion).one.heard, 100000);
});
await check('measureBuffer reports fixture peak/RMS/seam and rejects nonfinite samples', () => {
  const context = new FakeAudioContext(), raw = pcmFixture(context), metrics = measureBuffer(raw); assert.equal(metrics.finite, true); assert.equal(metrics.frames, 1600); assert.equal(metrics.channels, 2); assert.equal(metrics.duration, .2); assert.ok(metrics.peak > 1.3 && metrics.rms > .1); assert.ok(Number.isFinite(metrics.seamDelta)); raw.getChannelData(0)[12] = NaN; assert.throws(() => measureBuffer(raw)); return metrics;
});
await check('normalization caps fixture at 0.7, caches variants and preserves original', async () => {
  const {engine, context} = fixture(); await engine.unlock(); const raw = pcmFixture(context), original = raw.getChannelData(0).slice(); const decoded = {buffer: raw, metrics: measureBuffer(raw), variants: new Map()};
  const stereo = engine.normalized(decoded, false); assert.ok(Math.abs(maximumPeak(stereo) - .7) < 1e-6); assert.equal(stereo.numberOfChannels, 2); assert.equal(engine.normalized(decoded, false), stereo); assert.deepEqual(raw.getChannelData(0), original);
  const mono = engine.normalized(decoded, true); assert.equal(mono.numberOfChannels, 1); assert.ok(Math.abs(maximumPeak(mono) - .7) < 1e-6); assert.equal(engine.normalized(decoded, true), mono); assert.equal(decoded.variants.size, 2); return {stereoPeak: maximumPeak(stereo), monoPeak: maximumPeak(mono)};
});
await check('silent audio and fully phase-cancelled mono do not start sources', async () => {
  const {engine, context} = fixture(); await engine.unlock();
  for (const raw of [pcmFixture(context, {silent:true}), pcmFixture(context, {cancelMono:true})]) assert.throws(() => engine.normalized({buffer:raw,variants:new Map()}, true), /무음/);
  assert.equal(context.starts, 0);
});
await check('locked play/playMany drop requests without fetch/context/backlog', async () => {
  const f = fixture(); for (let i=0;i<20;i++) assert.equal(await f.engine.play(asset()), null); assert.deepEqual(await f.engine.playMany([asset()]), []); assert.equal(f.fetches.length, 0); assert.equal(f.factories, 0); assert.equal(f.engine.debug().pending, 0);
  assert.equal(await f.engine.unlock(), true); assert.equal(f.context.starts, 0); await f.engine.play(asset()); assert.equal(f.context.starts, 1); assert.equal(f.fetches[0].credentials, 'same-origin');
});
await check('decode pending stopAll invalidates old work and permits only new explicit play', async () => {
  const gate = deferred(), f = fixture({fetchGate:gate}); await f.engine.unlock(); const playing = f.engine.play(asset()); assert.equal(f.engine.debug().pending, 1); f.engine.stopAll('user stop'); gate.resolve(response()); assert.equal(await playing, null); assert.equal(f.context.starts, 0); assert.equal(f.engine.debug().pending, 0); await f.engine.play(asset()); assert.equal(f.context.starts, 1);
});
await check('decode pending stopAsset cancels selected asset only', async () => {
  const gate = deferred(), f = fixture({fetchGate:gate}); await f.engine.unlock(); const a = f.engine.play(asset('one')), b = f.engine.play(asset('two')); f.engine.stopAsset('one'); gate.resolve(response()); assert.equal(await a, null); assert.ok(await b); assert.equal(f.context.starts, 1); assert.equal(f.engine.debug().voices[0].assetId, 'two');
});
await check('decode pending group stop cancels ambience but preserves unrelated SFX', async () => {
  const gate = deferred(), f = fixture({fetchGate:gate}); await f.engine.unlock(); const a = f.engine.play(asset('wind','ambience',1), {loop:true}), b = f.engine.play(asset('shot')); f.engine.stopGroup('ambience'); gate.resolve(response()); assert.equal(await a, null); assert.ok(await b); assert.equal(f.context.starts, 1); assert.equal(f.engine.debug().voices[0].group, 'sfx');
});
await check('hidden tab cancels pending audio, suspends and never auto-replays on return', async () => {
  const gate = deferred(), f = fixture({fetchGate:gate}); await f.engine.unlock(); const playing = f.engine.play(asset()); f.engine.setHidden(true); gate.resolve(response()); assert.equal(await playing, null); assert.equal(f.context.starts, 0); assert.equal(f.context.state, 'suspended'); assert.equal(await f.engine.unlock(), false); f.engine.setHidden(false); assert.equal(f.context.starts, 0); assert.equal(await f.engine.play(asset()), null); await f.engine.unlock(); assert.equal(f.context.starts, 0); await f.engine.play(asset()); assert.equal(f.context.starts, 1);
});
await check('concurrent same-loop decode requests share fetch/cache and start once', async () => {
  const gate = deferred(), f = fixture({fetchGate:gate}); await f.engine.unlock(); const loop = asset('engine','ambience',1); const a = f.engine.play(loop,{loop:true}), b = f.engine.play(loop,{loop:true}); assert.equal(f.fetches.length, 1); gate.resolve(response()); const voices = await Promise.all([a,b]); assert.equal(voices[0], voices[1]); assert.equal(f.context.starts, 1); assert.equal(f.context.decodeCalls, 1); for(let i=0;i<120;i++) assert.equal(await f.engine.play(loop,{loop:true}), voices[0]); assert.equal(f.context.starts, 1); return {playRequests:122, fetches:f.fetches.length, nativeSourcesMocked:f.context.starts};
});
await check('lower priority cannot replace three critical SFX', async () => {
  const f = fixture(); await f.engine.unlock(); for (let i=0;i<3;i++) assert.ok(await f.engine.play(asset(`critical-${i}`,'warning',3))); const prior = [...f.engine.voices.values()].map(v=>v.id); assert.equal(await f.engine.play(asset('lower','weapon',2)), null); assert.deepEqual([...f.engine.voices.values()].map(v=>v.id), prior); assert.equal(f.context.starts, 3);
});
await check('critical warning replaces oldest lower priority cue at logical group cap', async () => {
  const f = fixture(); await f.engine.unlock(); for (let i=0;i<3;i++) await f.engine.play(asset(`ordinary-${i}`,'weapon',1)); const oldest = [...f.engine.voices.values()][0]; const warning = await f.engine.play(asset('lift-warning','warning',3)); assert.ok(warning); assert.equal(f.engine.voices.size, 3); assert.equal(f.engine.voices.has(oldest.id), false); assert.equal(f.engine.voices.has(warning.id), true); assert.equal(f.context.starts, 4);
});
await check('rapid repeated SFX stay at three logical voices and twelve bounded release tails', async () => {
  const f = fixture(); await f.engine.unlock(); let logicalHigh = 0, releaseHigh = 0;
  for(let i=0;i<100;i++){await f.engine.play(asset('rapid'));logicalHigh=Math.max(logicalHigh,f.engine.voices.size);releaseHigh=Math.max(releaseHigh,f.engine.releases.size);assert.ok(f.engine.voices.size<=3);assert.ok(f.engine.releases.size<=12);}
  f.context.advance(2); assert.equal(f.engine.voices.size,0); assert.equal(f.engine.releases.size,0); assert.equal(f.context.activeSources.length,0); return {requests:100,logicalHigh,releaseHigh,physicalReleaseTailsAreSeparate:true};
});
await check('ambience has a separate two-loop cap and group stop releases it', async () => {
  const f = fixture(); await f.engine.unlock(); await f.engine.play(asset('shot')); for(const id of ['wind','engine','cloth'])await f.engine.play(asset(id,'ambience',1),{loop:true}); assert.equal([...f.engine.voices.values()].filter(v=>v.group==='ambience').length,2); assert.equal([...f.engine.voices.values()].filter(v=>v.group==='sfx').length,1); f.engine.stopGroup('ambience'); assert.equal([...f.engine.voices.values()].filter(v=>v.group==='ambience').length,0); assert.equal([...f.engine.voices.values()].filter(v=>v.group==='sfx').length,1); f.context.advance(1); assert.equal(f.engine.releases.size,0);
});
await check('playMany starts at most three cues on the same mock audio time', async () => {
  const f = fixture(); await f.engine.unlock(); const voices = await f.engine.playMany([asset('warning','warning',3),asset('impact','impact'),asset('cannon'),asset('ignored')]); assert.equal(voices.length,3); assert.equal(f.context.starts,3); assert.equal(new Set(voices.map(v=>v.start)).size,1); assert.equal(voices[0].priority,3); assert.equal(f.fetches.length,3);
});
await check('stopAll cancels an awaiting three-cue group before any source starts', async () => {
  const gate=deferred(),f=fixture({fetchGate:gate});await f.engine.unlock();const playing=f.engine.playMany([asset('one'),asset('two'),asset('three')]);f.engine.stopAll();gate.resolve(response());assert.deepEqual(await playing,[]);assert.equal(f.context.starts,0);assert.equal(f.engine.debug().pending,0);
});
await check('six-shot audition uses a finite mixed fixture buffer capped at 0.7', async () => {
  const f=fixture();await f.engine.unlock();const voice=await f.engine.play(asset(),{burst:true});assert.ok(Math.abs(voice.duration-(.2+.22*5))<1/f.context.sampleRate);assert.ok(maximumPeak(voice.buffer)<=.700001);assert.equal(voice.loop,false);assert.equal(f.context.starts,1);return {mixedDuration:voice.duration,peak:maximumPeak(voice.buffer),sourceCount:1,timing:'Preview-only 0.22s offsets, not authoritative gameplay timing.'};
});
await check('mute stops active/pending audio and unmute does not replay backlog', async () => {
  const gate=deferred(),f=fixture({fetchGate:gate});await f.engine.unlock();const playing=f.engine.play(asset());f.engine.setSettings({mute:true});gate.resolve(response());assert.equal(await playing,null);assert.equal(f.context.starts,0);assert.equal(f.engine.master.gain.value,0);assert.equal(await f.engine.play(asset()),null);f.engine.setSettings({mute:false});assert.equal(f.context.starts,0);const voice=await f.engine.play(asset());assert.ok(voice);f.engine.setSettings({mute:true});assert.equal(f.engine.voices.size,0);f.context.advance(.1);assert.equal(f.engine.releases.size,0);
});
await check('mono changes cancel active/pending audio and next explicit play uses mono', async () => {
  const gate=deferred(),f=fixture({fetchGate:gate});await f.engine.unlock();const playing=f.engine.play(asset());f.engine.setSettings({mono:true});gate.resolve(response());assert.equal(await playing,null);assert.equal(f.context.starts,0);const voice=await f.engine.play(asset());assert.equal(voice.buffer.numberOfChannels,1);f.engine.setSettings({mono:false});assert.equal(f.engine.voices.size,0);const stereo=await f.engine.play(asset());assert.equal(stereo.buffer.numberOfChannels,2);
});
await check('volume/low-dynamic settings update buses/compressor without new sources', async () => {
  const f=fixture();await f.engine.unlock();f.engine.setSettings({master:.2,sfx:.3,ambience:.4,lowDynamic:true});assert.equal(f.engine.master.gain.value,.2);assert.equal(f.engine.buses.sfx.gain.value,.3);assert.equal(f.engine.buses.ambience.gain.value,.4);assert.equal(f.engine.compressor.threshold.value,-28);assert.equal(f.engine.compressor.ratio.value,8);assert.equal(f.context.starts,0);await f.engine.play(asset());assert.ok(Math.abs(f.engine.buses.ambience.gain.value-.4*.55)<1e-12);f.engine.stopAll();assert.equal(f.engine.buses.ambience.gain.value,.4);assert.ok(Math.max(...f.engine.limiter.curve)<=.940001);
});
await check('failed fetch/decode clears failed cache and pending count for explicit retry', async () => {
  let fail=true;const f=fixture({fetcher:()=>fail?{ok:false,status:404}:response()});await f.engine.unlock();await assert.rejects(f.engine.play(asset()),/404/);assert.equal(f.engine.cache.size,0);assert.equal(f.engine.debug().pending,0);fail=false;f.context.decodeError=Error('mock decode failure');await assert.rejects(f.engine.play(asset()),/mock decode/);assert.equal(f.engine.cache.size,0);f.context.decodeError=null;assert.ok(await f.engine.play(asset()));assert.equal(f.context.starts,1);
});
await check('dispose cancels pending decode and clears caches, voices and resources', async () => {
  const gate=deferred(),f=fixture();f.context.decodeGate=gate.promise;await f.engine.unlock();const playing=f.engine.play(asset());while(!f.context.decodeCalls)await Promise.resolve();await f.engine.dispose();gate.resolve();assert.equal(await playing,null);assert.equal(f.context.starts,0);assert.equal(f.engine.debug().pending,0);assert.equal(f.engine.cache.size,0);assert.equal(f.engine.voices.size,0);assert.equal(f.engine.releases.size,0);assert.equal(f.context.state,'closed');assert.equal(await f.engine.play(asset()),null);await assert.rejects(f.engine.unlock(),/종료/);await f.engine.dispose();assert.equal(f.context.closeCalls,1);
});
await check('dispose wins pending unlock/resume and prevents source creation', async () => {
  const gate=deferred(),f=fixture();f.context.resumeGate=gate.promise;const unlocking=f.engine.unlock();assert.equal(f.context.resumeCalls,1);await f.engine.dispose();gate.resolve();assert.equal(await unlocking,false);assert.equal(f.context.state,'closed');assert.equal(f.engine.disposed,true);assert.equal(await f.engine.play(asset()),null);assert.equal(f.context.starts,0);return 'Mock close is terminal, matching AudioContext closed-state contract; no hardware/browser race was measured.';
});
await check('dispose clears active loops and faded one-shot tails once', async () => {
  const f=fixture();await f.engine.unlock();await f.engine.play(asset('wind','ambience',1),{loop:true});await f.engine.play(asset('shot'));f.engine.stopAsset('shot');assert.equal(f.engine.releases.size,1);await f.engine.dispose();assert.equal(f.engine.voices.size,0);assert.equal(f.engine.releases.size,0);assert.equal(f.engine.cache.size,0);assert.equal(f.context.activeSources.length,0);assert.ok(f.context.sources.every(source=>source.disconnected));assert.equal(f.context.closeCalls,1);
});
await check('whenIdle waits pending/one-shot work, ignores deliberate loops and times out boundedly', async () => {
  const gate=deferred(),f=fixture({fetchGate:gate});await f.engine.unlock();const pending=f.engine.play(asset());assert.equal(await f.engine.whenIdle(1),false);gate.resolve(response());const voice=await pending;assert.ok(voice);assert.equal(await f.engine.whenIdle(1),false);f.context.advance(1);assert.equal(await f.engine.whenIdle(50),true);await f.engine.play(asset('wind','ambience',1),{loop:true});assert.equal(await f.engine.whenIdle(50),true);f.engine.stopAll();assert.equal(await f.engine.whenIdle(50),true);return 'Idle means no pending request/non-loop logical voice; intentional loops and short releasing fade tails are excluded.';
});
await check('inspectAll mock decode produces no sources and release option drops idle cache', async () => {
  const f=fixture();await f.engine.unlock();const report=await f.engine.inspectAll([asset('one'),asset('two'),{...asset('three'),status:'pending'}],{release:true});assert.equal(report.results.filter(r=>r.status==='decoded').length,2);assert.equal(report.results.filter(r=>r.status==='unavailable').length,1);assert.equal(f.context.starts,0);assert.equal(f.engine.cache.size,0);return 'Mock PCM metrics only; generated MP3 files were not decoded.';
});

const root=fileURLToPath(new URL('../../../',import.meta.url));
const player=await readFile(path.join(root,'tools/audio/review-v2/review.mjs'));
const report={version:'audio-review-v2-player-verification-1',createdAt:new Date().toISOString(),passed:checks.every(c=>c.passed),checksPassed:checks.filter(c=>c.passed).length,checksFailed:checks.filter(c=>!c.passed).length,checks,
  source:{path:'tools/audio/review-v2/review.mjs',bytes:player.length,sha256:createHash('sha256').update(player).digest('hex')},
  method:'Node public exports + in-memory fake AudioContext, fetch responses and synthetic PCM fixtures. Scheduling/lifecycle validation only.',
  nativeAudioContextUsed:false,browserLaunched:false,networkRequests:0,generatedAssetsDecoded:0,humanListeningPerformed:false,
  notPerformed:['Native Web Audio/MP3 decoding/playback and runtime network capture','Actual generated-file PCM peak/RMS/seam/silence/clipping measurements','Human listening, mono/headphones, three-cue perceptual identification and long-loop comfort','DOM interactions/localStorage restrictions/import download UX/mobile layout','Gameplay installation or authoritative event/command-result hooks'],
  notes:['Voice caps count admitted logical voices. Up to twelve bounded fade release tails are tracked separately.','Fake resume never reopens a closed context; this test verifies cancellation/control state, not browser hardware races.','whenIdle intentionally excludes active loops and short releasing fade tails.']};
await writeFile(path.join(root,'outputs/audio-review-v2/player-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checksPassed:report.checksPassed,checksFailed:report.checksFailed,failed:checks.filter(c=>!c.passed),source:report.source,report:'outputs/audio-review-v2/player-verification.json',nativeAudioContextUsed:false},null,2));
if(!report.passed)process.exitCode=1;
