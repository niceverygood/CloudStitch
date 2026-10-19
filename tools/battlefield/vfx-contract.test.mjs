import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WEAPON_VFX, RUNTIME_WEAPON_IDS, runtimeAssetDescriptors, createEventCursor, createShotReceipts,
  projectileCarrierName, projectilePose, flightBasis, impactBasis } from './vfx-contract.mjs';

const output = new URL('../../outputs/combat-vfx/', import.meta.url);
const json = async file => JSON.parse(await readFile(new URL(file, output), 'utf8'));
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const checkBasis = basis => {
  for (const axis of [basis.right, basis.up, basis.forward]) near(Math.hypot(...axis), 1);
  near(dot(basis.right, basis.up), 0); near(dot(basis.right, basis.forward), 0); near(dot(basis.up, basis.forward), 0);
};

test('completed VFX shots release active IDs and keep only a bounded recent replay window', () => {
  const receipts = createShotReceipts(2048), cursor = createEventCursor();
  const sourceKeys = Object.keys(receipts).sort();
  for (let id = 1; id <= 10000; id++) {
    assert.equal(receipts.start(id), true);
    assert.equal(receipts.start(id), false);
    cursor.take([{ seq: id * 2 - 1, type: 'player-fire', projectileId: id }]);
    receipts.end(id);
    cursor.take([{ seq: id * 2, type: 'projectile-ended', projectileId: id }]);
    assert.equal(receipts.activeCount, 0);
  }
  assert.equal(receipts.terminalCount, 2048);
  assert.equal(receipts.hasEnded(1), false, 'old receipts leave the bounded window');
  assert.deepEqual(cursor.take([{ seq: 1, type: 'player-fire', projectileId: 1 }]), [], 'the event cursor still rejects historical delivery');
  assert.equal(receipts.start(10000), false, 'late fire for a recent ended shot is rejected');
  assert.equal(receipts.hasEnded(10000), true, 'late hit for a recent ended shot is rejected');
  assert.deepEqual(Object.keys(receipts).sort(), sourceKeys, 'the long loop introduces no dynamic fields');
  receipts.reset();
  assert.equal(receipts.activeCount, 0); assert.equal(receipts.terminalCount, 0);
  assert.equal(receipts.start(10000), true, 'retry can reuse a generation-local ID after explicit reset');
});

test('six art mappings exist, while only machine gun and cannon runtime displays are supported', async () => {
  const [catalog, recipes] = await Promise.all([json('catalog.json'), json('recipes.json')]);
  assert.equal(Object.keys(WEAPON_VFX).length, 6);
  assert.deepEqual(RUNTIME_WEAPON_IDS, ['01-machine-gun', '02-deck-cannon']);
  assert.equal(WEAPON_VFX['06-flamethrower'].delivery, 'cone');
  for (const [weaponId, mapping] of Object.entries(WEAPON_VFX)) {
    for (const kind of ['muzzle', 'projectile', 'hit']) {
      const entry = catalog.items.find(item => item.id === mapping[kind]);
      const recipe = recipes.effects.find(item => item.id === mapping[kind]);
      assert.equal(entry?.weapon_id, weaponId); assert.equal(entry.model, recipe.model);
    }
  }
  assert.equal(runtimeAssetDescriptors(catalog, recipes).length, 6);
});

test('broken or escaping model records fail before a runtime GLB request', async () => {
  const [catalog, recipes] = await Promise.all([json('catalog.json'), json('recipes.json')]);
  const modified = structuredClone(catalog);
  modified.items.find(item => item.id === 'machine-gun-hit').model = '../elsewhere.glb';
  assert.throws(() => runtimeAssetDescriptors(modified, recipes), /일치하지/);
  assert.throws(() => runtimeAssetDescriptors({ items: [] }, recipes), /누락/);
});

test('actual projectile GLBs contain a separable carrier; demo smoke is outside that subtree', async () => {
  for (const weaponId of RUNTIME_WEAPON_IDS) {
    const effectId = WEAPON_VFX[weaponId].projectile;
    const bytes = await readFile(new URL(`assets/${effectId}.glb`, output));
    assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'Actual GLB rather than LFS pointer');
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
    const carrier = gltf.nodes.findIndex(node => node.name === projectileCarrierName(effectId));
    assert.ok(carrier >= 0);
    const descendants = new Set();
    const walk = index => { descendants.add(index); for (const child of gltf.nodes[index].children || []) walk(child); };
    walk(carrier);
    assert.ok(gltf.animations[0].channels.some(channel => channel.target.node === carrier && channel.target.path === 'translation'));
    assert.ok(gltf.animations[0].channels.some(channel => channel.target.node === carrier && channel.target.path === 'scale'));
    assert.equal([...descendants].filter(index => gltf.nodes[index].mesh !== undefined).length,
      weaponId === '01-machine-gun' ? 2 : 3);
    if (weaponId === '02-deck-cannon') {
      assert.ok(gltf.animations[0].channels.some(channel => channel.target.path === 'translation' && !descendants.has(channel.target.node)));
    }
  }
});

test('rolling event buffers and repeated delivery produce each seq once, including out-of-order input', () => {
  const cursor = createEventCursor();
  const fire = { seq: 4, type: 'player-fire' }, hit = { seq: 5, type: 'hit' };
  assert.deepEqual(cursor.take([hit, fire, fire]), [fire, hit]);
  assert.deepEqual(cursor.take([fire, hit]), []);
  assert.deepEqual(cursor.take([{ seq: 9, type: 'projectile-ended' }]).map(event => event.seq), [9]);
  assert.equal(cursor.sequence, 9);
  assert.deepEqual(cursor.take([{ seq: NaN }, { type: 'hit' }]), []);
});

test('retry resets cursor so a new voyage can start again at seq 1', () => {
  const cursor = createEventCursor();
  cursor.take([{ seq: 200 }]); cursor.reset();
  assert.equal(cursor.sequence, 0);
  assert.equal(cursor.take([{ seq: 1, type: 'player-fire' }]).length, 1);
});

test('projectile pose is exactly sim position and speed direction, independent of art duration', () => {
  const projectile = { x: 31, z: -42, vx: 30, vz: 40 };
  const pose = projectilePose(projectile, { y: 2, direction: { x: -1, y: 0, z: 0 } });
  assert.deepEqual(pose.position, [31, 2, -42]);
  near(pose.basis.forward[0], .6); near(pose.basis.forward[2], .8);
  assert.deepEqual(projectile, { x: 31, z: -42, vx: 30, vz: 40 });
  assert.throws(() => projectilePose({ x: Infinity, z: 0 }), /x\/z/);
  assert.deepEqual(projectilePose({ x: 1, y: 7, z: 2 }).position, [1, 7, 2]);
});

test('stationary projectile keeps fire direction and vertical travel has a stable basis', () => {
  const stationary = projectilePose({ x: 0, z: 0, vx: 0, vz: 0 }, { direction: { x: -1, y: 0, z: 0 } });
  assert.deepEqual(stationary.basis.forward, [-1, 0, 0]);
  checkBasis(flightBasis({ x: 0, y: 1, z: 0 })); checkBasis(flightBasis({ x: 0, y: -1, z: 0 }));
});

test('hit surface +Y follows a side wall normal, with tangent incoming +Z', () => {
  const basis = impactBasis({ x: 1, y: 0, z: 0 }, { x: -2, y: 0, z: 3 });
  assert.deepEqual(basis.up, [1, 0, 0]); assert.deepEqual(basis.forward, [0, 0, 1]); checkBasis(basis);
});

test('head-on impact chooses a stable surface tangent and rejects absent or zero normals', () => {
  checkBasis(impactBasis({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 }));
  checkBasis(impactBasis({ x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }));
  assert.throws(() => impactBasis(null), /법선/);
  assert.throws(() => impactBasis({ x: 0, y: 0, z: 0 }), /법선/);
});
