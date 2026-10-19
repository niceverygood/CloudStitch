import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAudioAdapter, AUDIO_ADAPTER_VERSION } from './adapter.mjs';
import { SOUND_DEFINITIONS } from './synthesis.mjs';

const checks = [];
async function test(name, run) {
  try { await run(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.stack }); }
}
const ids = new Set(SOUND_DEFINITIONS.map(definition => definition.id));
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); for (const item of Object.values(value)) freeze(item);
  }
  return value;
};
const event = (seq, type, extra = {}) => ({ seq, id: seq, time: seq / 60, type, ...extra });
function snapshot(overrides = {}) {
  const { player = {}, sim = {}, ...rest } = overrides;
  return { voyageId: 'voyage-1', phase: 'sailing', paused: false, level: { id: 'first-voyage' }, stage: { phase: 'opening' },
    sim: { time: 100, eventSeq: 0, outcome: 'sailing', paused: false, enemies: [], debris: [], cargo: [], events: [],
      player: { x: 0, z: 0, vx: 0, vz: 0, hp: 100, lift: 65, weight: 50, ...player }, ...sim }, ...rest };
}
const context = (extra = {}) => ({ voyageId: 'voyage-1', generation: 1, ...extra });
function harness(options = {}) {
  const calls = [], loopState = new Map();
  let paused = false;
  const audio = {
    play(id, settings) { assert(ids.has(id), `Unknown cue ${id}`); calls.push({ method: 'play', id, settings }); return !paused; },
    setLoop(id, on, settings) { assert(ids.has(id)); calls.push({ method: 'setLoop', id, on, settings }); if (on) loopState.set(id, settings); else loopState.delete(id); return !!on; },
    clear(reason) { calls.push({ method: 'clear', reason }); loopState.clear(); },
    setPaused(value) { paused = value; calls.push({ method: 'setPaused', value }); if (value) loopState.clear(); },
  };
  const adapter = createAudioAdapter({ audio, ...options });
  return { adapter, calls, loopState, plays: id => calls.filter(call => call.method === 'play' && (!id || id === call.id)), loopCalls: id => calls.filter(call => call.method === 'setLoop' && (!id || id === call.id)) };
}

await test('Exact weapon fire mapping, no hit before actual collision event', () => {
  const h = harness(), s = snapshot();
  h.adapter.consume([event(1, 'player-fire', { weaponId: '01-machine-gun' }), event(2, 'enemy-fire', { weaponId: '02-deck-cannon' })], s, context());
  assert.deepEqual(h.plays().map(call => call.id), ['fire-machinegun', 'fire-cannon']);
  h.adapter.consume([event(3, 'player-fire', { weaponId: '03-mortar' })], s, context());
  assert.equal(h.plays().length, 2); assert.equal(h.adapter.debug().unknown, 1);
});
await test('Duplicate and shuffled batch consume once in monotonic sequence', () => {
  const h = harness(), s = snapshot(), entries = [event(3, 'hit'), event(1, 'hit'), event(2, 'hit'), event(2, 'hit')];
  h.adapter.consume(entries, s, context()); h.adapter.consume(entries, s, context());
  assert.equal(h.plays().length, 3); assert.equal(h.adapter.debug().cursor, 3); assert.equal(h.adapter.debug().duplicate, 5);
});
await test('Late old event after a later batch is rejected', () => {
  const h = harness(); h.adapter.consume([event(7, 'hit')], snapshot(), context()); h.adapter.consume([event(6, 'hit')], snapshot(), context());
  assert.equal(h.plays().length, 1); assert.equal(h.adapter.debug().cursor, 7);
});
await test('New generation accepts restarted seq and rejects previous generation context', () => {
  const h = harness(), s = snapshot();
  h.adapter.consume([event(1, 'hit')], s, context()); h.adapter.consume([event(1, 'hit')], s, context({ generation: 2 }));
  h.adapter.consume([event(99, 'hit')], s, context()); assert.equal(h.plays().length, 2); assert.equal(h.adapter.debug().identity.generation, 2);
});
await test('Current explicit context rejects prior voyage or generation tagged entries', () => {
  const h = harness(), s = snapshot({ voyageId: 'voyage-2' }), c = context({ voyageId: 'voyage-2', generation: 2 });
  h.adapter.consume([event(1, 'hit', { voyageId: 'voyage-1', generation: 1 }), event(2, 'hit', { voyageId: 'voyage-2', generation: 1 }), event(3, 'hit', { voyageId: 'voyage-2', generation: 2 })], s, c);
  assert.equal(h.plays().length, 1); assert.equal(h.adapter.debug().cursor, 3); assert.equal(h.adapter.debug().stale, 2);
});
await test('Mismatched current snapshot/context cannot reset current identity', () => {
  const h = harness(); h.adapter.consume([event(4, 'hit')], snapshot({ voyageId: 'voyage-2' }), context({ voyageId: 'voyage-2' }));
  h.adapter.consume([event(9, 'hit')], snapshot({ voyageId: 'voyage-2' }), context({ voyageId: 'voyage-1' }));
  assert.equal(h.plays().length, 1); assert.equal(h.adapter.debug().identity.voyageId, 'voyage-2');
  h.adapter.commandResult('retry', { ok: true }, snapshot({ voyageId: 'voyage-2' }), context({ voyageId: 'voyage-1' }));
  assert.equal(h.adapter.debug().identity.voyageId, 'voyage-2'); assert.equal(h.adapter.debug().cursor, 4);
});
await test('Old voyage is retired after a new voyage and cannot replay its history', () => {
  const h = harness(); h.adapter.consume([event(1, 'hit')], snapshot(), context());
  h.adapter.consume([event(1, 'hit')], snapshot({ voyageId: 'voyage-2' }), context({ voyageId: 'voyage-2' }));
  h.adapter.consume([event(2, 'hit')], snapshot(), context()); assert.equal(h.plays().length, 2);
});
await test('Invalid seq, missing generation, malformed event and unsupported event rejected safely', () => {
  const h = harness(); assert.equal(h.adapter.consume([event(1, 'hit')], snapshot(), { voyageId: 'voyage-1' }), 0);
  h.adapter.consume([null, {}, event(-1, 'hit'), event(1.5, 'hit'), event(1, 'not-a-real-event')], snapshot(), context());
  assert.equal(h.plays().length, 0); assert(h.adapter.debug().invalid >= 5); assert.equal(h.adapter.debug().unknown, 1);
});
await test('Material lookup reads hull/balloon/armor/engine with destroyed and detached modules', () => {
  const h = harness();
  const s = snapshot({ sim: { enemies: [{ id: 'enemy', modules: [{ id: 'a', type: 'balloon', destroyed: true }, { id: 'b', type: 'cannon' }, { id: 'c', type: 'connector' }] }], debris: [{ modules: [{ id: 'd', type: 'engine' }] }], cargo: [{ modules: [{ id: 'e', type: 'balloon' }] }] } });
  h.adapter.consume(['a', 'b', 'c', 'd', 'e', 'missing'].map((moduleId, i) => event(i + 1, 'hit', { target: 'module', enemyId: 'enemy', moduleId })), s, context());
  assert.deepEqual(h.plays().map(call => call.id), ['hit-cloth', 'hit-armor', 'hit-armor', 'hit-engine', 'hit-cloth', 'hit-wood']);
});
await test('Player and untyped obstacle use conservative wood impact fallback', () => {
  const h = harness(); h.adapter.consume([event(1, 'hit', { target: 'player' }), event(2, 'hit', { target: 'obstacle' })], snapshot(), context());
  assert.deepEqual(h.plays().map(call => call.id), ['hit-wood', 'hit-wood']);
});
await test('Weapon-specific hit gain/rate preserves material distinctions', () => {
  const h = harness(); h.adapter.consume([event(1, 'hit', { weaponId: '01-machine-gun' }), event(2, 'hit', { weaponId: '02-deck-cannon' })], snapshot(), context());
  assert.equal(h.plays()[0].settings.gain, .72); assert.equal(h.plays()[0].settings.rate, 1.04);
  assert.equal(h.plays()[1].settings.gain, .95); assert.equal(h.plays()[1].settings.rate, .9);
  assert(h.plays()[0].settings.variantKey.includes('01-machine-gun')); assert(h.plays()[1].settings.variantKey.includes('02-deck-cannon'));
});
await test('Actual field repair requires restored HP and anchors to the player', () => {
  const h = harness(); h.adapter.consume([event(1, 'player-repaired', { restored: 0 }), event(2, 'player-repaired', { restored: 10 })], snapshot({ player: { x: 50, z: 50 } }), context());
  assert.equal(h.plays('harbor-repair').length, 1); assert.equal(h.plays()[0].settings.pan, 0); assert.equal(h.plays()[0].settings.gain, 1);
});
await test('Cut, detached bundle and actual recovered ownership are distinct source events', () => {
  const h = harness(); h.adapter.consume([event(1, 'module-destroyed', { moduleType: 'connector' }), event(2, 'bundle-detached'), event(3, 'salvaged'), event(4, 'module-destroyed', { moduleType: 'engine' }), event(5, 'connector-cut')], snapshot(), context());
  assert.deepEqual(h.plays().map(call => call.id), ['connector-cut', 'bundle-detach', 'salvage']);
});
await test('Clear-combat stops voices and keeps seq cursor within the same generation', () => {
  const h = harness(), s = snapshot(), entries = [event(1, 'hit'), event(2, 'combat-cleared')];
  h.adapter.consume(entries, s, context()); h.adapter.consume(entries, s, context());
  assert.equal(h.plays().length, 1); assert.equal(h.calls.filter(call => call.method === 'clear' && call.reason === 'combat-cleared').length, 1);
  assert.equal(h.adapter.debug().cursor, 2); assert.equal(h.adapter.debug().identity.generation, 1);
});
await test('Pause drains backlog, stops loops and resumes without an old hit burst', () => {
  const h = harness(); h.adapter.update(snapshot(), context());
  const paused = snapshot({ paused: true, sim: { eventSeq: 3, events: [event(2, 'hit'), event(3, 'hit')] } });
  h.adapter.consume(paused.sim.events, paused, context()); assert.equal(h.loopState.size, 0); assert.equal(h.adapter.debug().cursor, 3);
  const resumed = snapshot({ sim: { eventSeq: 3, events: paused.sim.events } }); h.adapter.update(resumed, context()); h.adapter.consume(resumed.sim.events, resumed, context());
  assert.equal(h.plays().length, 0); assert.equal(h.loopState.size, 2);
  h.adapter.consume([event(4, 'hit')], snapshot({ sim: { eventSeq: 4 } }), context()); assert.equal(h.plays().length, 1);
});
await test('Hidden tab consumes and clears, then discards accumulated hidden history', () => {
  const h = harness(); h.adapter.update(snapshot(), context()); h.adapter.setHidden(true);
  const s = snapshot({ sim: { eventSeq: 8, events: [event(7, 'hit'), event(8, 'hit')] } });
  h.adapter.consume(s.sim.events, s, context()); h.adapter.setHidden(false); h.adapter.update(s, context()); h.adapter.consume(s.sim.events, s, context());
  assert.equal(h.plays().length, 0); assert.equal(h.adapter.debug().cursor, 8); assert.equal(h.loopState.size, 2);
});
await test('Maintenance stops loops and drains old events without changing combat authority', () => {
  const h = harness(); h.adapter.update(snapshot(), context()); const s = snapshot({ stage: { phase: 'maintenance' }, sim: { eventSeq: 2 } });
  h.adapter.consume([event(1, 'hit'), event(2, 'enemy-fire', { weaponId: '02-deck-cannon' })], s, context()); assert.equal(h.loopState.size, 0); assert.equal(h.plays().length, 0);
  h.adapter.update(snapshot({ sim: { eventSeq: 2 } }), context()); assert.equal(h.loopState.size, 2);
});
await test('Defeat clears active one-shots and loops', () => {
  const h = harness(); h.adapter.consume([event(1, 'hit')], snapshot(), context());
  h.adapter.update(snapshot({ phase: 'defeat', sim: { outcome: 'defeat' } }), context()); assert.equal(h.loopState.size, 0);
  assert(h.calls.some(call => call.method === 'clear' && call.reason === 'phase-or-map-change'));
});
await test('Retry establishes next generation and rejects all old generation events', () => {
  const h = harness(); h.adapter.consume([event(12, 'hit')], snapshot(), context());
  h.adapter.commandResult('retry', { ok: true }, snapshot(), context({ generation: 2 }));
  h.adapter.consume([event(13, 'hit', { generation: 1 }), event(1, 'hit', { generation: 2 })], snapshot(), context({ generation: 2 }));
  assert.equal(h.plays().length, 2); assert.equal(h.adapter.debug().cursor, 1);
});
await test('Same-identity reset never lowers cursor; baseline explicitly suppresses retained history', () => {
  const h = harness(); h.adapter.consume([event(6, 'hit')], snapshot(), context()); h.adapter.reset(context());
  h.adapter.consume([event(5, 'hit'), event(6, 'hit')], snapshot(), context()); assert.equal(h.plays().length, 1);
  h.adapter.reset(context({ generation: 2, baselineSeq: 20 })); h.adapter.consume([event(19, 'hit'), event(21, 'hit')], snapshot(), context({ generation: 2 }));
  assert.equal(h.plays().length, 2); assert.equal(h.adapter.debug().cursor, 21);
});
await test('Map switch clears voices and replaces ambience without a second simulation', () => {
  const h = harness(); h.adapter.update(snapshot(), context()); const before = h.calls.filter(call => call.method === 'clear').length;
  h.adapter.update(snapshot({ level: { id: 'another-map' } }), context()); assert.equal(h.calls.filter(call => call.method === 'clear').length, before + 1); assert.equal(h.loopState.size, 2);
});
await test('Identical frame updates never duplicate loop start commands', () => {
  const h = harness(), s = snapshot(); for (let i = 0; i < 1000; i++) h.adapter.update(s, context());
  assert.equal(h.loopCalls().filter(call => call.on).length, 2); assert.equal(h.loopState.size, 2);
});
await test('Locked loop start is retried on unlock; runtime clear/mute can recover on the next state sync', () => {
  let locked = true; const activeLoops = new Map(), starts = [];
  const audio = { play() { return true; }, setPaused() {}, clear() { activeLoops.clear(); }, debug: () => ({ activeLoops: [...activeLoops.keys()] }),
    setLoop(id, on, options) { if (locked) return false; if (on) { starts.push(id); activeLoops.set(id, options); return true; } activeLoops.delete(id); return false; } };
  const adapter = createAudioAdapter({ audio }); adapter.update(snapshot(), context()); assert.equal(adapter.debug().loops.length, 0);
  locked = false; adapter.update(snapshot(), context()); assert.equal(activeLoops.size, 2); assert.equal(starts.length, 2);
  adapter.update(snapshot(), context()); assert.equal(starts.length, 2);
  audio.clear(); adapter.update(snapshot(), context()); assert.equal(starts.length, 4); assert.equal(activeLoops.size, 2);
});
await test('Speed updates existing loop parameters only; danger has a separate transition cue', () => {
  const h = harness(); h.adapter.update(snapshot(), context()); const slow = h.loopState.get('wind-loop');
  h.adapter.update(snapshot({ player: { vx: 23 } }), context()); assert(h.loopState.get('wind-loop').rate > slow.rate);
  const risk = snapshot({ player: { weight: 75, lift: 65 } }); h.adapter.update(risk, context()); h.adapter.update(risk, context());
  assert.equal(h.plays('lift-warning').length, 1); assert.equal(h.loopState.size, 3); assert.equal(h.plays('lift-warning')[0].settings.priority, 3);
  h.adapter.update(snapshot(), context()); assert.equal(h.loopState.size, 2);
  h.adapter.update(risk, context()); assert.equal(h.plays('lift-warning').length, 2);
});
await test('Actual harbor transition returns once even when settlement save failed', () => {
  const h = harness(); h.adapter.update(snapshot(), context());
  const harbor = snapshot({ phase: 'harbor', level: { id: 'jonghang-harbor' }, sim: { outcome: 'victory', eventSeq: 3 } });
  h.adapter.commandResult('return', { ok: false, reason: 'save-failed' }, harbor, context()); h.adapter.update(harbor, context()); h.adapter.commandResult('return', { ok: true }, harbor, context());
  assert.equal(h.plays('return').length, 1); assert.equal(h.loopState.size, 0);
});
await test('Victory then harbor transition cannot double-play return', () => {
  const h = harness(); h.adapter.update(snapshot(), context()); h.adapter.update(snapshot({ sim: { outcome: 'victory' } }), context());
  h.adapter.update(snapshot({ phase: 'harbor', sim: { outcome: 'victory' } }), context()); assert.equal(h.plays('return').length, 1);
});
await test('Repair/equip/save audio follows explicit command success or failure only', () => {
  const h = harness(), s = snapshot({ phase: 'harbor', sim: { outcome: 'victory' } });
  for (const type of ['repair', 'equip', 'save']) { h.adapter.commandResult(type, { ok: true }, s, context()); h.adapter.commandResult(type, { ok: false }, s, context()); }
  h.adapter.commandResult('save', {}, s, context()); h.adapter.commandResult('salvage', { ok: true }, s, context());
  assert.deepEqual(h.plays().map(call => call.id), ['harbor-repair', 'ui-fail', 'harbor-equip', 'ui-fail', 'save-ok', 'ui-fail']);
});
await test('Initial harbor command confirmation works without a voyage or generation', () => {
  const h = harness(), s = { phase: 'harbor', voyageId: null, sim: null };
  assert.equal(h.adapter.commandResult('save', { ok: true }, s), true); assert.equal(h.plays('save-ok').length, 1);
});
await test('Distance and pan use provisional XZ, camera right and attenuation', () => {
  const h = harness(), s = snapshot(); h.adapter.consume([event(1, 'hit', { x: 28, z: 0 })], s, context());
  assert.equal(h.plays()[0].settings.pan, 1); assert(h.plays()[0].settings.gain < .5);
  h.adapter.consume([event(2, 'hit', { x: 28, z: 0 })], s, context({ camera: { position: [0, 50, -30], target: [0, 0, 0] } })); assert.equal(h.plays()[1].settings.pan, -1);
  h.adapter.consume([event(3, 'hit', { x: 0, z: 1000 })], s, context()); assert.equal(h.plays()[2].settings.gain, .12);
  h.adapter.consume([event(4, 'hit')], s, context()); assert.equal(h.plays()[3].settings.gain, 1);
});
await test('Inputs remain byte-identical and deeply frozen snapshots are supported', () => {
  const h = harness(); const s = freeze(snapshot({ sim: { eventSeq: 2, events: [event(2, 'hit')] } }));
  const entries = freeze([event(2, 'hit'), event(1, 'player-fire', { weaponId: '01-machine-gun' })]); const c = freeze(context({ camera: { position: [0, 3, 9], target: [0, 0, 0] } }));
  const before = JSON.stringify({ s, entries, c }); h.adapter.consume(entries, s, c); h.adapter.update(s, c); h.adapter.commandResult('save', { ok: true }, s, c);
  assert.equal(JSON.stringify({ s, entries, c }), before);
});
await test('Long logical input uses bounded identity/loop storage and no per-shot maps', () => {
  const h = harness();
  for (let generation = 1; generation <= 32; generation++) {
    const entries = Array.from({ length: 5000 }, (_, i) => event(i + 1, 'projectile-ended'));
    h.adapter.consume(entries, snapshot(), context({ generation }));
  }
  const d = h.adapter.debug(); assert.equal(d.cursor, 5000); assert(d.retiredIdentities <= 8); assert(d.loops.length <= 3); assert.equal(d.retainedModuleMaps, 0); assert.equal(h.plays().length, 0);
});
await test('Dispose is idempotent and ignores later reads, commands and hidden changes', () => {
  const h = harness(); h.adapter.update(snapshot(), context()); h.adapter.dispose(); const count = h.calls.length;
  h.adapter.dispose(); h.adapter.consume([event(1, 'hit')], snapshot(), context()); h.adapter.commandResult('save', { ok: true }, snapshot(), context()); h.adapter.setHidden(true); h.adapter.reset(context());
  assert.equal(h.calls.length, count); assert.equal(h.loopState.size, 0); assert.equal(h.adapter.debug().disposed, true);
});
await test('Audio and UI callback errors are isolated from combat readers', () => {
  const audio = { play() { throw new Error('blocked'); }, setLoop() { throw new Error('blocked'); }, clear() { throw new Error('blocked'); }, setPaused() { throw new Error('blocked'); } };
  const adapter = createAudioAdapter({ audio, onCue() { throw new Error('UI'); } });
  assert.doesNotThrow(() => adapter.consume([event(1, 'hit')], snapshot(), context())); assert(adapter.debug().errors >= 4); adapter.dispose();
});

const integrationFlag = process.argv.indexOf('--integration-root');
const sourceEvidence = [];
if (integrationFlag >= 0) {
  const integrationRoot = path.resolve(process.argv[integrationFlag + 1]);
  await test('Frozen controller source: actual fire/hit, command salvage and return read without audio mutation', async () => {
    for (const filename of ['tools/integration/contract.mjs', 'tools/integration/session.mjs', 'tools/integration/renderer.js', 'tools/integration/ui.js', 'tools/battlefield/sim.mjs', 'tools/battlefield/integration.mjs']) {
      const data = await readFile(path.join(integrationRoot, filename)); sourceEvidence.push({ path: filename, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    }
    const { createBattlefieldAdapter } = await import(pathToFileURL(path.join(integrationRoot, 'tools/battlefield/integration.mjs')));
    const battlefield = createBattlefieldAdapter({ enemySpawns: [{ id: 'tax-1', assetId: 'enemy-tax-cutter', x: 0, z: 0 }], world: { playerSpawn: { x: 0, z: 20 }, harbor: { x: 0, z: 20, radius: 200 } } });
    const h = harness(), c = context({ generation: battlefield.generation });
    const snapshotNow = () => ({ phase: 'sailing', voyageId: 'voyage-1', sim: battlefield.state });
    battlefield.advance(1 / 60, { fire: true, aimX: -1.1, aimZ: .17 });
    const fireSnapshot = snapshotNow(), beforeFire = JSON.stringify(battlefield.snapshot()); h.adapter.consume(battlefield.state.events, fireSnapshot, c); assert.equal(JSON.stringify(battlefield.snapshot()), beforeFire); assert.equal(h.plays('fire-machinegun').length, 1);
    for (let i = 0; i < 90; i++) battlefield.advance(1 / 60, {});
    const hitBefore = JSON.stringify(battlefield.snapshot()); h.adapter.consume(battlefield.state.events, snapshotNow(), c); assert.equal(JSON.stringify(battlefield.snapshot()), hitBefore); assert(h.plays().some(call => call.id.startsWith('hit-')));
    const { damageModule } = await import(pathToFileURL(path.join(integrationRoot, 'tools/battlefield/sim.mjs')));
    // Explicit test fixture destroys a connector; audio itself never calls damage.
    assert.equal(damageModule(battlefield.state, 'tax-1', 'connector', 100, 'audio-fixture-cut'), true);
    h.adapter.consume(battlefield.state.events, snapshotNow(), c); assert.equal(h.plays('connector-cut').length, 1); assert.equal(h.plays('bundle-detach').length, 1);
    const bundle = battlefield.state.debris[0]; battlefield.state.player.x = bundle.x; battlefield.state.player.z = bundle.z; // fixture positioning, not adapter behavior
    const drainedBeforeCommand = battlefield.drainEvents();
    const recovered = battlefield.dispatch({ id: 'audio-fixture-salvage', type: 'salvage' }); assert.equal(recovered.ok, true);
    assert(!drainedBeforeCommand.some(entry => entry.type === 'salvaged'));
    const recoverBefore = JSON.stringify(battlefield.snapshot()); h.adapter.consume(battlefield.state.events, snapshotNow(), c); assert.equal(JSON.stringify(battlefield.snapshot()), recoverBefore); assert.equal(h.plays('salvage').length, 1);
    const returned = battlefield.dispatch({ id: 'audio-fixture-return', type: 'return' }); assert.equal(returned.ok, true);
    const returnBefore = JSON.stringify(battlefield.snapshot()); const harbor = { ...snapshotNow(), phase: 'harbor' }; h.adapter.commandResult('return', returned, harbor, c); assert.equal(JSON.stringify(battlefield.snapshot()), returnBefore); assert.equal(h.plays('return').length, 1);
    for (const item of sourceEvidence) assert.equal(createHash('sha256').update(await readFile(path.join(integrationRoot, item.path))).digest('hex'), item.sha256);
  });
}
const failed = checks.filter(check => !check.passed);
process.stdout.write(`${JSON.stringify({ version: AUDIO_ADAPTER_VERSION, scope: 'Node logic/read-only adapter; no browser/audio listening proof', passed: checks.length - failed.length, failed: failed.length, sourceEvidence, checks }, null, 2)}\n`);
if (failed.length) process.exitCode = 1;
