import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createDramaticCannonVfx, DRAMATIC_CANNON_LIMITS } from './cannon-runtime.mjs';
const require = createRequire(new URL('../../../work/combat-vfx-v2/deps/package.json', import.meta.url));
const THREE = require('three');
const fire = (seq = 1, id = 'actual-1', extra = {}) => ({ seq, generation: 1, type: 'player-fire', weaponId: '02-deck-cannon', projectileId: id, x: 2, y: 3, z: 4, direction: { x: 0, y: 0, z: 1 }, ...extra });
const impact = (seq = 2, id = 'actual-1', extra = {}) => fire(seq, id, { type: 'hit', x: 8, z: 12, normal: { x: 0, y: 0, z: -1 }, ...extra });
async function setup() {
  const calls = [], scene = new THREE.Scene(), atlas = new THREE.Texture();
  const child = { load: async () => calls.push(['load']), consume: (...args) => calls.push(['consume', ...args]), update: (...args) => calls.push(['update', ...args]), reset: (...args) => calls.push(['reset', ...args]), dispose: () => calls.push(['dispose']), debug: () => ({ supportedWeapons: ['01-machine-gun', '02-deck-cannon'] }) };
  const vfx = createDramaticCannonVfx(THREE, scene, { projectileVfx: child, atlas }); await vfx.load();
  return { vfx, child, calls, scene, atlas, cleanup() { vfx.dispose(); atlas.dispose(); } };
}
test('one actual fire/hit creates exactly one stage each and child alone consumes actual carrier positions', async () => {
  const s = await setup(), projectiles = [{ id: 'actual-1', weaponId: '02-deck-cannon', x: 13, y: 5, z: -7, vx: 1, vy: 2, vz: 3 }];
  const before = JSON.stringify(projectiles), events = [fire(), fire(), impact(), { seq: 3, generation: 1, type: 'projectile-ended', projectileId: 'actual-1' }];
  s.vfx.consume(events, projectiles, 1); s.vfx.consume(events, projectiles, 1);
  assert.equal(s.vfx.debug().counters.muzzleEffects, 1); assert.equal(s.vfx.debug().counters.hitEffects, 1);
  assert.equal(s.vfx.debug().muzzleEffects, 1); assert.equal(s.vfx.debug().hitEffects, 1); assert.equal(s.vfx.debug().activeOneShots, 2);
  const forwarded = s.calls.filter(c => c[0] === 'consume'); assert.deepEqual(forwarded[0][1].map(e => e.type), ['projectile-ended']); assert.equal(forwarded[0][2], projectiles);
  s.vfx.update(.1, projectiles); assert.equal(s.calls.at(-1)[2], projectiles); assert.equal(JSON.stringify(projectiles), before);
  assert.deepEqual(s.vfx.debug().supportedWeapons, ['02-deck-cannon', '01-machine-gun']); assert.equal(s.scene.children.length, 2);
  assert.equal(s.vfx.debug().own.find(v => v.kind === 'hit').phase, 'mass-eruption'); s.cleanup();
});
test('pause is deterministic, original end times release stages and reset reuses clean pooled graphs', async () => {
  const s = await setup(); s.vfx.consume([impact(1)], [], 1); s.vfx.update(.25, []); const graph = s.scene.children[0];
  const snapshot = () => { const nodes = []; graph.traverse(n => nodes.push([n.visible, ...n.position.toArray(), ...n.quaternion.toArray(), n.material?.opacity])); return nodes; };
  const before = snapshot(); s.vfx.update(0, []); s.vfx.update(0, []); assert.deepEqual(snapshot(), before); assert.equal(s.vfx.debug().own[0].age, .25);
  s.vfx.update(1.35, []); assert.equal(s.vfx.debug().active, 0); assert.equal(s.vfx.debug().pooled, 1); assert.equal(s.scene.children.length, 0);
  s.vfx.reset(2); s.vfx.consume([impact(1, 'new', { generation: 2 })], [], 2); assert.equal(s.scene.children[0], graph); assert.equal(s.vfx.debug().own[0].age, 0);
  s.vfx.reset(3); assert.equal(s.vfx.debug().active, 0); s.cleanup();
});
test('stale high sequence cannot starve current generation and terminal hit cannot replay', async () => {
  const s = await setup(); s.vfx.consume([impact(9999, 'stale', { generation: 0 }), impact(1, 'current')], [], 1);
  assert.equal(s.vfx.debug().sequence, 1); assert.equal(s.vfx.debug().counters.hitEffects, 1);
  s.vfx.consume([impact(2, 'current'), fire(3, 'current')], [], 1); assert.equal(s.vfx.debug().counters.hitEffects, 1); assert.equal(s.vfx.debug().counters.muzzleEffects, 0);
  s.vfx.consume([impact(90000, 'past', { generation: 0 })], [], 0); assert.equal(s.vfx.debug().sequence, 3); s.cleanup();
});
test('active/pool bounds and clear forbid late hit while preserving child non-cannon events', async () => {
  const s = await setup(); const events = Array.from({ length: 30 }, (_, i) => impact(i + 1, 'impact-' + i));
  s.vfx.consume(events, [], 1); assert.equal(s.vfx.debug().active, DRAMATIC_CANNON_LIMITS.active); assert.equal(s.vfx.debug().counters.dropped, 18);
  s.vfx.consume([{ type: 'combat-cleared', seq: 31, generation: 1 }, impact(32, 'late'), fire(33, 'mg', { weaponId: '01-machine-gun' })], [], 1);
  assert.equal(s.vfx.debug().active, 0); assert.equal(s.vfx.debug().pooled, 12); assert.deepEqual(s.calls.at(-1)[1].map(e => e.type), ['combat-cleared', 'player-fire']);
  s.cleanup(); assert.equal(s.scene.children.length, 0);
});
test('injected texture ownership and dt guards survive repeated cleanup', async () => {
  const s = await setup(); let count = 0; s.atlas.addEventListener('dispose', () => count++);
  assert.throws(() => s.vfx.update(-1), /dt/); s.vfx.consume([fire()], [], 1); s.vfx.dispose(); s.vfx.dispose(); assert.equal(count, 0); s.atlas.dispose(); assert.equal(count, 1);
});

test('invalid contacts allocate no stages/resources, including a populated idle pool', async () => {
  const s = await setup(), before = s.vfx.debug();
  assert.throws(() => s.vfx.consume([impact(1, 'invalid', { normal: { x: 0, y: 0, z: 0 } })], [], 1), /nonzero/);
  assert.equal(s.vfx.debug().active, 0); assert.equal(s.vfx.debug().pooled, 0); assert.equal(s.vfx.debug().counters.created, before.counters.created);
  s.vfx.consume([impact(2, 'valid')], [], 1); s.vfx.update(1.6, []); const pooled = s.vfx.debug();
  assert.throws(() => s.vfx.consume([impact(3, 'invalid-x', { x: NaN })], [], 1), /finite/);
  assert.equal(s.vfx.debug().pooled, pooled.pooled); assert.equal(s.vfx.debug().counters.created, pooled.counters.created); assert.equal(s.vfx.debug().counters.reused, pooled.counters.reused);
  assert.equal(s.scene.children.length, 0); s.cleanup();
});

test('a throwing child dispose still clears owned graphs and final state while preserving caller texture', async () => {
  const s = await setup(); let textureDisposals = 0; s.atlas.addEventListener('dispose', () => textureDisposals++);
  s.vfx.consume([impact(1)], [], 1); s.child.dispose = () => { throw new Error('injected child disposal failed'); };
  assert.throws(() => s.vfx.dispose(), /child disposal/); assert.equal(s.vfx.debug().state, 'disposed'); assert.equal(s.scene.children.length, 0); assert.equal(s.vfx.debug().pooled, 0); assert.equal(textureDisposals, 0);
  s.vfx.dispose(); s.atlas.dispose();
});

test('a locally loaded owned texture is disposed even when injected child disposal throws', async () => {
  const atlas = new THREE.Texture(); let disposed = 0; atlas.addEventListener('dispose', () => disposed++);
  class TextureLoaderFixture { async loadAsync(url) { assert.equal(url, 'local-atlas.png'); return atlas; } }
  const child = { load: async () => {}, consume() {}, update() {}, reset() {}, dispose() { throw new Error('child throw'); }, debug: () => ({}) };
  const vfx = createDramaticCannonVfx({ ...THREE, TextureLoader: TextureLoaderFixture }, new THREE.Scene(), { projectileVfx: child, atlasUrl: 'local-atlas.png' });
  await vfx.load(); assert.throws(() => vfx.dispose(), /child throw/); assert.equal(disposed, 1); assert.equal(vfx.debug().state, 'disposed'); vfx.dispose(); assert.equal(disposed, 1);
});
