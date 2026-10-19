import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createAudioEngine, sanitizeSettings } from './runtime.mjs';
import { SOUND_DEFINITIONS } from './synthesis.mjs';

// A scheduling/lifecycle mock only. It does not measure or prove audible output.
class FakeParam {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); return this; }
  linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['linear', value, time]); return this; }
  exponentialRampToValueAtTime(value, time) { this.value = value; this.events.push(['exponential', value, time]); return this; }
  setTargetAtTime(value, time, constant) { this.value = value; this.events.push(['target', value, time, constant]); return this; }
  cancelScheduledValues(time) { this.events.push(['cancel', time]); return this; }
  cancelAndHoldAtTime(time) { this.events.push(['hold', time]); return this; }
}

class FakeNode {
  constructor() { this.connections = []; this.disconnected = false; }
  connect(target) { this.connections.push(target); return target; }
  disconnect() { this.connections = []; this.disconnected = true; }
}

class FakeSource extends FakeNode {
  constructor(context) {
    super(); this.context = context; this.playbackRate = new FakeParam(1); this.detune = new FakeParam();
    this.loop = false; this.loopStart = 0; this.loopEnd = 0; this.onended = null;
    this.started = false; this.ended = false; this.startTime = Infinity; this.stopTime = Infinity;
  }
  start(when = 0, offset = 0, duration) {
    assert.equal(this.started, false, 'AudioBufferSourceNode must not start twice');
    this.started = true; this.startTime = Math.max(this.context.currentTime, when);
    if (!this.loop) this.stopTime = this.startTime + (duration ?? Math.max(0, (this.buffer?.duration ?? 0) - offset)) / this.playbackRate.value;
    this.context.starts += 1; this.context.tick();
  }
  stop(when = 0) { this.stopTime = Math.min(this.stopTime, Math.max(this.context.currentTime, when)); this.context.tick(); }
  finish() { if (!this.ended) { this.ended = true; this.onended?.(); } }
  get active() { return this.started && !this.ended && this.startTime <= this.context.currentTime && this.stopTime > this.context.currentTime; }
}

export class FakeAudioContext {
  constructor() { this.currentTime = 0; this.sampleRate = 24000; this.state = 'suspended'; this.destination = new FakeNode(); this.sources = []; this.panners = []; this.starts = 0; this.resumeCalls = 0; this.closeCalls = 0; }
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate,
      getChannelData(channel) { return data[channel]; },
      copyToChannel(source, channel, offset = 0) { data[channel].set(source, offset); } };
  }
  createBufferSource() { const source = new FakeSource(this); this.sources.push(source); return source; }
  createGain() { return Object.assign(new FakeNode(), { gain: new FakeParam(1) }); }
  createStereoPanner() { const node = Object.assign(new FakeNode(), { pan: new FakeParam() }); this.panners.push(node); return node; }
  createDynamicsCompressor() { return Object.assign(new FakeNode(), Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(name => [name, new FakeParam()]))); }
  createWaveShaper() { return Object.assign(new FakeNode(), { curve: null, oversample: 'none' }); }
  async resume() { this.resumeCalls += 1; this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.closeCalls += 1; this.state = 'closed'; }
  tick() { for (const source of this.sources) if (source.started && !source.ended && source.stopTime <= this.currentTime) source.finish(); }
  advance(seconds) { this.currentTime += seconds; this.tick(); }
  get activeSources() { this.tick(); return this.sources.filter(source => source.active); }
}

const defaults = { master: 0.7, sfx: 0.8, ambience: 0.35, muted: false, mono: false, lowDynamicRange: true };
const tests = [];
async function check(name, body) {
  try { const evidence = await body(); tests.push({ name, status: 'passed', evidence: evidence ?? null }); }
  catch (error) { tests.push({ name, status: 'failed', error: error.stack ?? String(error) }); }
}

function fixture(storage = null) {
  const context = new FakeAudioContext();
  const engine = createAudioEngine({ contextFactory: () => context, storage, now: () => context.currentTime });
  return { context, engine };
}
function settingsEqual(actual, expected) { for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, `setting ${key}`); }

// IDs are the public catalog contract; no simulator state is changed by tests.
const ids = { shot: 'fire-machinegun', cannon: 'fire-cannon', warning: 'lift-warning', engine: 'engine-loop', wind: 'wind-loop' };

await check('settings defaults and malformed values', () => {
  settingsEqual(sanitizeSettings(null), defaults);
  const clean = sanitizeSettings({ master: 8, sfx: -3, ambience: NaN, muted: 'yes', mono: {}, lowDynamicRange: null, unrecognized: 'ignored' });
  assert.equal(clean.master, 1); assert.equal(clean.sfx, 0); assert.equal(clean.ambience, defaults.ambience);
  assert.equal(typeof clean.muted, 'boolean'); assert.equal(typeof clean.mono, 'boolean'); assert.equal(typeof clean.lowDynamicRange, 'boolean');
  assert.equal(Object.hasOwn(clean, 'unrecognized'), false);
  return clean;
});

await check('corrupt and denied storage recover without throwing', async () => {
  for (const storage of [ { getItem: () => '{bad JSON', setItem() {} }, { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } } ]) {
    const { engine } = fixture(storage); settingsEqual(engine.settings(), defaults);
    engine.setSettings({ master: 0.25 }); assert.equal(engine.settings().master, 0.25);
    await engine.dispose();
  }
  return 'Both invalid JSON and SecurityError-like storage failures preserve usable defaults/settings.';
});

await check('user unlock gate drops old one-shots', async () => {
  const { engine, context } = fixture();
  for (let n = 0; n < 10; n += 1) engine.play(ids.shot, { variantKey: `locked-${n}` });
  assert.equal(context.starts, 0); await engine.unlock(); assert.equal(context.starts, 0);
  engine.play(ids.shot, { variantKey: 'after-unlock' }); assert.equal(context.starts, 1);
  await engine.dispose(); return 'No locked cue backlog; first unlocked cue schedules one source.';
});

await check('unlock can retry after context creation failure', async () => {
  const context = new FakeAudioContext(); let attempts = 0;
  const engine = createAudioEngine({ contextFactory: () => { attempts += 1; if (attempts === 1) throw Error('temporary creation failure'); return context; } });
  assert.equal(await engine.unlock(), false); assert.equal(await engine.unlock(), true);
  assert.equal(attempts, 2); assert.equal(engine.debug().unlocked, true); await engine.dispose();
});

await check('dispose wins a pending unlock/resume race', async () => {
  const context = new FakeAudioContext(); let finishResume;
  context.resume = () => new Promise(resolve => { finishResume = () => { context.state = 'running'; resolve(); }; });
  const engine = createAudioEngine({ contextFactory: () => context }); const unlocking = engine.unlock();
  assert.equal(typeof finishResume, 'function'); await engine.dispose(); finishResume();
  assert.equal(await unlocking, false); assert.equal(engine.debug().disposed, true); assert.equal(engine.debug().unlocked, false);
  assert.equal(context.state, 'closed'); assert.equal(engine.play(ids.cannon), false);
});

await check('concurrent unlock requests share one context resume', async () => {
  const context = new FakeAudioContext(); let factoryCalls = 0;
  const engine = createAudioEngine({ contextFactory: () => { factoryCalls += 1; return context; } });
  assert.deepEqual(await Promise.all([engine.unlock(), engine.unlock(), engine.unlock()]), [true, true, true]);
  assert.equal(factoryCalls, 1); assert.equal(context.resumeCalls, 1); await engine.dispose();
});

await check('mute discards cue backlog and restores on next cue', async () => {
  const { engine, context } = fixture(); await engine.unlock(); engine.setSettings({ muted: true });
  for (let n = 0; n < 20; n += 1) { context.advance(0.1); engine.play(ids.shot, { variantKey: `muted-${n}` }); }
  assert.equal(context.starts, 0); engine.setSettings({ muted: false }); assert.equal(context.starts, 0);
  context.advance(0.2); engine.play(ids.shot, { variantKey: 'audible' }); assert.equal(context.starts, 1);
  await engine.dispose();
});

await check('burst rate limit and total voice cap', async () => {
  const { engine, context } = fixture(); await engine.unlock();
  for (let n = 0; n < 100; n += 1) engine.play(ids.shot, { variantKey: n });
  assert.ok(context.starts <= 3, `same-instant burst started ${context.starts} sources`);
  const sameInstantStarts = context.starts;
  let highWater = engine.debug().activeVoices, releaseHighWater = context.activeSources.length;
  for (let n = 0; n < 150; n += 1) {
    context.advance(0.009); engine.play(n % 2 ? ids.cannon : ids.shot, { variantKey: n });
    highWater = Math.max(highWater, engine.debug().activeVoices); releaseHighWater = Math.max(releaseHighWater, context.activeSources.length);
    assert.ok(engine.debug().activeVoices <= 12); assert.ok(engine.debug().releasing <= 24);
  }
  await engine.dispose(); return { sameInstantStarts, activeVoiceHighWater: highWater, withReleaseTailsHighWater: releaseHighWater, logicalVoiceCap: 12, releaseTailCap: 24 };
});

await check('three critical cue ceiling and priority admission', async () => {
  const { engine, context } = fixture(); await engine.unlock();
  for (const definition of SOUND_DEFINITIONS.filter(definition => !definition.loop && definition.id !== ids.warning)) engine.play(definition.id, { priority: 1 });
  assert.equal(engine.debug().activeVoices, 12, 'saturation fixture reaches the voice cap');
  assert.ok(engine.debug().counts.droppedCap > 0, 'same/lower priority is rejected at cap');
  const before = context.starts, stolenBefore = engine.debug().counts.stolen;
  assert.equal(engine.play(ids.warning, { priority: 3, variantKey: 'critical' }), true, 'critical warning must be admitted over lower priority cues');
  assert.equal(context.starts, before + 1); assert.equal(engine.debug().counts.stolen, stolenBefore + 1);
  let highWater = 0, criticalHighWater = 0;
  context.advance(2);
  for (const definition of SOUND_DEFINITIONS.filter(definition => !definition.loop)) {
    engine.play(definition.id, { priority: 3 });
    highWater = Math.max(highWater, engine.debug().activeVoices); criticalHighWater = Math.max(criticalHighWater, engine.debug().activeCritical);
    assert.ok(engine.debug().activeVoices <= 12); assert.ok(engine.debug().activeCritical <= 3);
  }
  const debug = engine.debug();
  assert.ok(debug.activeCritical <= 3);
  await engine.dispose(); return { warningAdmitted: true, totalActiveHighWater: highWater, criticalHighWater, debug };
});

await check('three important cues ceiling protects critical cues from lower priority replacement', async () => {
  const { engine, context } = fixture(); await engine.unlock(); let importantHighWater = 0;
  for (const definition of SOUND_DEFINITIONS.filter(definition => !definition.loop && definition.id !== ids.warning)) {
    engine.play(definition.id, { priority: 2 }); importantHighWater = Math.max(importantHighWater, engine.debug().activeImportant);
    assert.ok(engine.debug().activeImportant <= 3);
  }
  assert.equal(importantHighWater, 3); assert.equal(engine.play(ids.warning, { priority: 3 }), true); assert.equal(engine.debug().activeImportant, 3);
  context.advance(2);
  for (const id of [ids.shot, ids.cannon, 'hit-wood']) assert.equal(engine.play(id, { priority: 3 }), true);
  assert.equal(engine.debug().activeCritical, 3);
  const before = context.starts; assert.equal(engine.play('hit-cloth', { priority: 2 }), false); assert.equal(context.starts, before);
  assert.equal(engine.debug().activeImportant, 3); assert.equal(engine.debug().activeCritical, 3);
  await engine.dispose(); return { importantHighWater, lowerPriorityRejectedOverThreeCritical: true };
});

await check('loop idempotence, update and explicit stop', async () => {
  const { engine, context } = fixture(); await engine.unlock();
  for (let n = 0; n < 100; n += 1) engine.setLoop(ids.engine, true, { rate: 0.9 + n / 1000, gain: 0.2 });
  assert.equal(context.starts, 1); assert.equal(context.activeSources.length, 1);
  engine.setLoop(ids.wind, true, { gain: 0.2 }); assert.equal(context.activeSources.length, 2);
  engine.setLoop(ids.engine, false); context.advance(0.2); assert.equal(context.activeSources.length, 1);
  engine.setLoop(ids.wind, false); context.advance(0.2); assert.equal(context.activeSources.length, 0);
  await engine.dispose(); return 'Repeated loop update does not start another source.';
});

await check('three ambience loops remain bounded across state updates', async () => {
  const { engine, context } = fixture(); await engine.unlock();
  const loops = SOUND_DEFINITIONS.filter(definition => definition.loop);
  assert.equal(loops.length, 3, 'the current library intentionally exposes three state loops');
  for (let frame = 0; frame < 500; frame += 1) for (const definition of loops) engine.setLoop(definition.id, true, { rate: 1, gain: 0.3 });
  assert.equal(context.starts, 3); assert.equal(engine.debug().activeLoops.length, 3); assert.equal(engine.debug().activeVoices, 3);
  engine.clear('map-transition'); context.advance(0.2); assert.equal(engine.debug().activeLoops.length, 0); assert.equal(context.activeSources.length, 0);
  await engine.dispose(); return { updates: 1500, sourceStarts: 3 };
});

await check('pause/resume clears sources and drops old hits', async () => {
  const { engine, context } = fixture(); await engine.unlock(); engine.setLoop(ids.engine, true); engine.play(ids.cannon);
  assert.ok(context.activeSources.length > 0); engine.setPaused(true); context.advance(0.2); assert.equal(context.activeSources.length, 0);
  const before = context.starts; for (let n = 0; n < 20; n += 1) engine.play(ids.shot, { variantKey: n });
  assert.equal(context.starts, before); engine.setPaused(false); context.advance(0.2); assert.equal(context.starts, before);
  engine.play(ids.shot, { variantKey: 'fresh' }); assert.equal(context.starts, before + 1); await engine.dispose();
});

await check('clear and dispose remove all sources and reject future playback', async () => {
  const { engine, context } = fixture(); await engine.unlock(); engine.setLoop(ids.engine, true); engine.play(ids.cannon);
  engine.clear('retry'); context.advance(0.2); assert.equal(context.activeSources.length, 0);
  engine.setLoop(ids.wind, true); engine.play(ids.shot); assert.ok(context.activeSources.length > 0);
  await engine.dispose(); context.advance(0.2); assert.equal(context.activeSources.length, 0);
  const before = context.starts; engine.play(ids.cannon); engine.setLoop(ids.engine, true); assert.equal(context.starts, before);
  assert.equal(context.closeCalls, 1); await engine.dispose(); assert.equal(context.closeCalls, 1);
});

await check('settings patches retain other valid fields', async () => {
  const { engine } = fixture(); engine.setSettings({ master: 0.15, mono: true });
  engine.setSettings({ sfx: 0.4 }); settingsEqual(engine.settings(), { ...defaults, master: 0.15, mono: true, sfx: 0.4 });
  engine.setSettings({ ambience: Infinity, muted: 'false' });
  assert.ok(Number.isFinite(engine.settings().ambience)); assert.equal(typeof engine.settings().muted, 'boolean'); await engine.dispose();
});

await check('mono re-centers existing and future panners; invalid IDs do not allocate', async () => {
  const { engine, context } = fixture(); await engine.unlock();
  engine.play(ids.cannon, { pan: -0.8 }); assert.equal(context.panners.at(-1).pan.value, -0.8);
  engine.setSettings({ mono: true }); assert.equal(context.panners.at(-1).pan.value, 0);
  engine.play(ids.shot, { pan: 0.9 }); assert.equal(context.panners.at(-1).pan.value, 0);
  const before = context.starts; assert.equal(engine.play('not-a-catalog-id'), false); assert.equal(engine.setLoop('not-a-catalog-id', true), false); assert.equal(context.starts, before);
  await engine.dispose();
});

await check('weapon-specific one-shot playback rate is bounded independently of loop rate', async () => {
  const { engine, context } = fixture(); await engine.unlock();
  assert.equal(engine.play('hit-wood', { rate: 0.9 }), true); assert.equal(context.sources.at(-1).playbackRate.value, 0.9);
  assert.equal(engine.play('hit-armor', { rate: 100 }), true); assert.equal(context.sources.at(-1).playbackRate.value, 1.2);
  assert.equal(engine.play('hit-engine', { rate: -100 }), true); assert.equal(context.sources.at(-1).playbackRate.value, 0.8);
  assert.equal(engine.setLoop(ids.engine, true, { rate: 100 }), true); assert.equal(context.sources.at(-1).playbackRate.value, 1.5);
  await engine.dispose();
});

const report = {
  schema: 'cloudstitch.audio.runtime-verification.v1', checkedAt: new Date().toISOString(),
  status: tests.every(test => test.status === 'passed') ? 'passed' : 'failed',
  scope: 'Node scheduling/lifecycle assertions using an injected fake AudioContext; no browser launched.',
  limitations: ['No human listening result.', 'No native Web Audio rendering or peak/RMS result.', 'No browser, hardware, long-duration or integration QA.'],
  passed: tests.filter(test => test.status === 'passed').length, failed: tests.filter(test => test.status === 'failed').length, tests
};
const reportPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../outputs/audio-v1/runtime-verification.json');
await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${report.status}: ${report.passed}/${tests.length} lifecycle checks; ${reportPath}`);
for (const test of tests.filter(test => test.status === 'failed')) console.error(`${test.name}\n${test.error}`);
if (report.failed) process.exitCode = 1;
