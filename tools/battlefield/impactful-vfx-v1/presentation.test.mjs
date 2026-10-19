import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatPresentation } from './presentation.mjs';
import { createCombatFeedback } from './feedback.mjs';

const fire = (seq, id, weaponId = '01-machine-gun', generation = 1) => ({ seq, generation,
  type: 'player-fire', projectileId: id, weaponId, x: 0, y: 1.3, z: 0, direction: { x: 0, y: 0, z: 1 } });
const shot = (id, weaponId) => ({ id, weaponId, x: 0, y: 1.3, z: 4, vx: 0, vz: 45 });
const hit = (seq, id, extra = {}) => ({ seq, generation: 1, type: 'hit', projectileId: id,
  target: 'module', enemyId: 'enemy', moduleId: 'enemy:root', x: 0, y: 1.3, z: 12,
  normal: { x: 0, y: 0, z: -1 }, direction: { x: 0, y: 0, z: 1 }, ...extra });

function visual(options = {}) {
  const calls = { load: 0, consume: [], update: [], reset: [], dispose: 0, camera: [] };
  let projectiles = [], events = [];
  const api = {
    async load() { calls.load++; if (options.load) await options.load(); return api; },
    consume(batch, actual, generation) { calls.consume.push({ events: batch, actual, generation }); events.push(...batch); projectiles = actual; },
    update(dt, actual, camera) { calls.update.push({ dt, actual, camera }); projectiles = actual; },
    reset(generation) { calls.reset.push(generation); events = []; projectiles = []; },
    dispose() { calls.dispose++; if (options.dispose) options.dispose(); },
    setCamera(camera) { calls.camera.push(camera); },
    debug() { return { activeOneShots: events.filter(event => ['player-fire', 'enemy-fire', 'hit'].includes(event.type)).length,
      activeProjectiles: projectiles.length, projectileIds: projectiles.map(value => value.id),
      supportedWeapons: options.supportedWeapons || [],
      muzzleEffects: events.filter(event => /-fire$/.test(event.type)).length, hitEffects: events.filter(event => event.type === 'hit').length }; },
  };
  return { api, calls };
}
async function fixture(soft = true) {
  const mesh = visual(), painted = soft ? visual() : null, feedback = createCombatFeedback();
  const presentation = createCombatPresentation({ meshVfx: mesh.api, softMachineGunVfx: painted?.api ?? null, feedback });
  await presentation.load(); return { presentation, mesh, painted, feedback };
}

test('mixed MG and cannon have one render path and one feedback delivery', async () => {
  const { presentation: p, mesh, painted, feedback } = await fixture();
  const events = [fire(1, 'mg'), fire(2, 'cannon', '02-deck-cannon')];
  const projectiles = [shot('mg', '01-machine-gun'), shot('cannon', '02-deck-cannon')];
  p.consume(events, projectiles, 1);
  assert.deepEqual(mesh.calls.consume.at(-1).events.map(event => event.projectileId), ['cannon']);
  assert.deepEqual(painted.calls.consume.at(-1).events.map(event => event.projectileId), ['mg']);
  assert.deepEqual(mesh.calls.consume.at(-1).actual.map(value => value.id), ['cannon']);
  assert.deepEqual(painted.calls.consume.at(-1).actual.map(value => value.id), ['mg']);
  assert.equal(feedback.debug().fires, 2); assert.equal(p.debug().activeProjectiles, 2);
  assert.equal(p.debug().movementAuthority, 'battlefield-projectile-state');
});

test('supported weapon union suppresses the host primitive fallback for both display paths', async () => {
  const mesh = visual({ supportedWeapons: ['02-deck-cannon'] });
  const painted = visual({ supportedWeapons: ['01-machine-gun', '02-deck-cannon'] });
  const p = createCombatPresentation({ meshVfx: mesh.api, softMachineGunVfx: painted.api, feedback: createCombatFeedback() });
  await p.load();
  assert.deepEqual(p.debug().supportedWeapons.sort(), ['01-machine-gun', '02-deck-cannon']);
  p.debug().supportedWeapons.push('mutated');
  assert.deepEqual(p.debug().supportedWeapons.sort(), ['01-machine-gun', '02-deck-cannon']);
  p.dispose();
});

test('missing hit and projectile weaponId are restored from matching fire without input mutation', async () => {
  const { presentation: p, mesh, painted } = await fixture();
  const events = [fire(1, 'cannon', '02-deck-cannon'), fire(2, 'mg')];
  const projectiles = [shot('cannon'), shot('mg')];
  const original = JSON.stringify({ events, projectiles });
  p.consume(events, projectiles, 1); p.update(.02, projectiles);
  assert.equal(mesh.calls.update.at(-1).actual[0].weaponId, '02-deck-cannon');
  assert.equal(painted.calls.update.at(-1).actual[0].weaponId, '01-machine-gun');
  const impacts = [hit(3, 'cannon'), hit(4, 'mg')], before = JSON.stringify(impacts);
  p.consume(impacts, [], 1);
  assert.equal(mesh.calls.consume.at(-1).events[0].weaponId, '02-deck-cannon');
  assert.equal(painted.calls.consume.at(-1).events[0].weaponId, '01-machine-gun');
  assert.equal(JSON.stringify({ events, projectiles }), original); assert.equal(JSON.stringify(impacts), before);
  assert.equal(p.debug().routedShotCount, 0);
});

test('terminal without weapon goes to both once and removes the routing entry', async () => {
  const { presentation: p, mesh, painted } = await fixture();
  p.consume([fire(1, 'mg')], [shot('mg')], 1);
  const end = { seq: 2, generation: 1, type: 'projectile-ended', projectileId: 'mg' };
  p.consume([end], [shot('mg')], 1);
  assert.equal(mesh.calls.consume.at(-1).events[0].type, 'projectile-ended');
  assert.equal(painted.calls.consume.at(-1).events[0].type, 'projectile-ended');
  assert.equal(p.debug().activeProjectiles, 0); assert.equal(p.debug().routedShotCount, 0);
  p.consume([end], [], 1);
  assert.equal(mesh.calls.consume.at(-1).events.length, 0); assert.equal(painted.calls.consume.at(-1).events.length, 0);
});

test('without soft renderer every supported weapon stays on mesh', async () => {
  const { presentation: p, mesh } = await fixture(false);
  p.consume([fire(1, 'mg'), fire(2, 'cannon', '02-deck-cannon')], [shot('mg'), shot('cannon')], 1);
  assert.equal(mesh.calls.consume.at(-1).events.length, 2); assert.equal(mesh.calls.consume.at(-1).actual.length, 2);
  assert.equal(p.debug().machineGunRoute, 'mesh'); assert.equal(p.debug().softMachineGun, null);
});

test('old generation high seq is filtered before cursor and generation changes reset children', async () => {
  const { presentation: p, mesh, painted } = await fixture();
  p.consume([fire(1, 'old')], [shot('old')], 1);
  p.consume([fire(999999, 'stale', '01-machine-gun', 1), fire(1, 'new', '01-machine-gun', 2)], [shot('new')], 2);
  assert.equal(p.debug().eventCursor, 1); assert.equal(p.debug().generation, 2);
  assert.deepEqual(painted.calls.consume.at(-1).events.map(event => event.projectileId), ['new']);
  const calls = mesh.calls.consume.length; p.consume([hit(999999, 'old')], [], 1);
  assert.equal(mesh.calls.consume.length, calls); assert.equal(p.debug().generation, 2);
  assert.deepEqual(mesh.calls.reset, [1, 2]);
});

test('clear is once only, retains seq barrier and prevents stale actual shots from reappearing', async () => {
  const { presentation: p, mesh, painted, feedback } = await fixture();
  p.consume([fire(1, 'old')], [shot('old')], 1);
  const clear = { seq: 2, generation: 1, type: 'combat-cleared' };
  p.consume([clear], [shot('old', '01-machine-gun')], 1);
  assert.equal(p.debug().activeProjectiles, 0); assert.equal(p.sampleFeedback().activePulses, 0);
  const resets = mesh.calls.reset.length;
  p.consume([clear, fire(3, 'new')], [shot('new')], 1);
  assert.equal(mesh.calls.reset.length, resets); assert.equal(painted.calls.reset.length, resets);
  assert.equal(p.debug().eventCursor, 3); assert.equal(feedback.debug().fires, 1);
  assert.deepEqual(painted.calls.consume.at(-1).events.map(event => event.projectileId), ['new']);
  p.update(0, [shot('old', '01-machine-gun'), shot('new')]);
  assert.deepEqual(painted.calls.update.at(-1).actual.map(value => value.id), ['new']);
});

test('a clear inside a batch discards earlier visuals and preserves later fire', async () => {
  const { presentation: p, painted } = await fixture();
  p.consume([fire(1, 'before'), { seq: 2, generation: 1, type: 'combat-cleared' }, fire(3, 'after')], [shot('before'), shot('after')], 1);
  assert.deepEqual(painted.calls.consume.at(-1).events.map(event => event.projectileId), ['after']);
  assert.deepEqual(painted.calls.consume.at(-1).actual.map(value => value.id), ['after']);
  assert.equal(p.sampleFeedback().activePulses, 1);
});

test('defeat/victory stop visuals and feedback until explicit reset even after clear', async () => {
  for (const type of ['defeat', 'victory']) {
    const { presentation: p, mesh, painted } = await fixture();
    p.consume([fire(1, 'a'), { seq: 2, generation: 1, type }, fire(3, 'b')], [shot('a'), shot('b')], 1);
    assert.equal(p.debug().stopped, true); assert.equal(p.debug().activeProjectiles, 0); assert.equal(p.sampleFeedback().activePulses, 0);
    p.consume([{ seq: 4, generation: 1, type: 'combat-cleared' }, fire(5, 'c')], [shot('c')], 1);
    assert.equal(p.sampleFeedback().activePulses, 0); assert.equal(p.debug().activeOneShots, 0);
    p.update(.01, [shot('c')]); assert.equal(mesh.calls.update.at(-1).actual.length, 0); assert.equal(painted.calls.update.at(-1).actual.length, 0);
    p.reset(2); p.consume([fire(1, 'new', '01-machine-gun', 2)], [shot('new')], 2);
    assert.equal(p.debug().stopped, false); assert.equal(p.sampleFeedback().activePulses, 1);
  }
});

test('update advances each child once and dt0/camera forwarding do not mutate camera', async () => {
  const { presentation: p, mesh, painted, feedback } = await fixture();
  p.consume([fire(1, 'mg')], [shot('mg')], 1);
  const camera = Object.freeze({ marker: 'stable-camera', position: Object.freeze({ x: 1, y: 2, z: 3 }) });
  p.setCamera(camera); p.update(.03, [shot('mg')], camera);
  assert.equal(mesh.calls.update.length, 1); assert.equal(painted.calls.update.length, 1); assert.equal(feedback.debug().oldestAge, .03);
  assert.equal(painted.calls.camera.at(-1), camera); assert.equal(painted.calls.update[0].camera, camera);
  const frozen = p.sampleFeedback();
  for (let i = 0; i < 10; i++) assert.deepEqual(p.update(0, [shot('mg')]), frozen);
  assert.deepEqual(camera.position, { x: 1, y: 2, z: 3 });
});

test('routing registry is active-only and bounded by actual shots rather than voyage history', async () => {
  const { presentation: p } = await fixture();
  for (let seq = 1; seq <= 2000; seq++) {
    p.consume([fire(seq, `shot-${seq}`)], [shot(`shot-${seq}`)], 1);
    assert.equal(p.debug().routedShotCount, 1);
  }
  p.update(.35, []); assert.equal(p.debug().routedShotCount, 0); assert.equal(p.sampleFeedback().activePulses, 0);
});

test('load is shared and waits for late successful child before cleaning both after failure', async () => {
  let release, resolved = false;
  const gate = new Promise(resolve => { release = resolve; });
  const mesh = visual({ load: () => Promise.reject(new Error('mesh failed')) });
  const painted = visual({ load: async () => { await gate; resolved = true; } });
  const feedback = createCombatFeedback();
  const p = createCombatPresentation({ meshVfx: mesh.api, softMachineGunVfx: painted.api, feedback });
  const a = p.load(), b = p.load(); await Promise.resolve(); await Promise.resolve();
  assert.equal(mesh.calls.load, 1); assert.equal(painted.calls.load, 1); assert.equal(mesh.calls.dispose, 0);
  release(); const results = await Promise.allSettled([a, b]);
  assert.equal(resolved, true); assert.ok(results.every(result => result.status === 'rejected'));
  assert.equal(mesh.calls.dispose, 1); assert.equal(painted.calls.dispose, 1); assert.equal(p.debug().state, 'failed');
  await assert.rejects(p.load(), /could not load/);
});

test('dispose is idempotent and cleanup continues when a child throws', async () => {
  const mesh = visual({ dispose: () => { throw new Error('cleanup failed'); } }), painted = visual();
  const p = createCombatPresentation({ meshVfx: mesh.api, softMachineGunVfx: painted.api, feedback: createCombatFeedback() });
  await p.load(); assert.throws(() => p.dispose(), /cleanup failed/);
  assert.equal(painted.calls.dispose, 1); assert.doesNotThrow(() => p.dispose());
  assert.throws(() => p.update(0, []), /load/); await assert.rejects(p.load(), /disposed/);
});

test('invalid APIs/arguments fail explicitly before display updates', async () => {
  assert.throws(() => createCombatPresentation(), /meshVfx/);
  const { presentation: p } = await fixture();
  assert.throws(() => p.consume({}, [], 1), /arrays/); assert.throws(() => p.consume([], {}, 1), /arrays/);
  assert.throws(() => p.consume([], [], -1), /generation/);
  assert.throws(() => p.consume([{ seq: 999, generation: NaN }], [], 1), /generation/);
  assert.equal(p.debug().eventCursor, 0);
  for (const dt of [-1, NaN, Infinity]) assert.throws(() => p.update(dt, []), /dt/);
  assert.throws(() => p.update(0, {}), /array/); assert.throws(() => p.reset(-1), /generation/);
});
