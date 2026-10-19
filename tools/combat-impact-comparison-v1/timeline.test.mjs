import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTape } from './timeline.mjs';
import { CONFIG } from '../battlefield/sim.mjs';
import { createMount } from './rig.js';

const canonical = { position: [0, 1.3, 0], direction: [0, 0, 1] };
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const xyz = (a, b) => a.forEach((v, i) => near(v, b[i]));
const digest = path => createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex');
const require = createRequire(import.meta.url);
const THREE = require(require.resolve('three', { paths: [fileURLToPath(new URL('../../work/combat-vfx-v2/deps/', import.meta.url)), process.cwd()] }));

test('real MG cooldown emits exactly ten authority-issued shots in [0,2), all settle after release', () => {
  const tape = makeTape({ weapon: 'machinegun', muzzle: canonical });
  const fires = tape.events.filter(e => e.type === 'fire'), hits = tape.events.filter(e => e.type === 'hit');
  assert.equal(CONFIG.playerCooldown, .22); assert.equal(CONFIG.playerDamage, 8);
  assert.equal(fires.length, 10); assert.equal(hits.length, 10);
  fires.forEach((e, i) => { near(e.time, i * CONFIG.playerCooldown); assert.equal(e.id, `shot-${i + 1}`); xyz(e.position, canonical.position); });
  assert.equal(tape.stats.damage, 80); assert.equal(tape.stats.finalTargetHp, 99920);
  assert.equal(tape.stats.finalProjectiles, 0); assert.ok(hits.at(-1).time > 2);
  assert.ok(tape.duration > hits.at(-1).time + 2);
  for (const hit of hits) {
    assert.equal(hit.target, 'module'); assert.ok(hit.time > fires.find(f => f.id === hit.id).time);
    xyz(hit.position, [0, 1.3, 24 - 3 - .1]); xyz(hit.normal, [0, 0, -1]); xyz(hit.direction, [0, 0, 1]);
  }
});

test('cannon records one actual enemy training shot and actual player damage; only time/display roles change', () => {
  const tape = makeTape({ weapon: 'cannon', muzzle: canonical });
  assert.equal(CONFIG.enemyDamage, 9); assert.equal(tape.stats.shots, 1); assert.equal(tape.stats.hits, 1);
  assert.equal(tape.stats.damage, 9); assert.equal(tape.stats.finalTargetHp, 91);
  const [fire, hit] = tape.events;
  assert.equal(fire.authorityType, 'enemy-fire'); assert.equal(fire.weaponId, '02-deck-cannon');
  assert.equal(fire.id, hit.id); assert.equal(hit.target, 'player'); assert.equal(fire.time, 0);
  near(tape.authority.timeOffset, 1.2 + CONFIG.enemyTelegraph);
  xyz(fire.position, canonical.position); xyz(hit.position, [0, 1.3, 24 - 3 - .65]); xyz(hit.normal, [0, 0, -1]);
  assert.equal(tape.stats.finalProjectiles, 0); assert.match(tape.authority.actorRole, /enemy-cannon-training/);
});

test('miss uses the actual off-axis training target: zero collisions/damage, native lifetime ends every shot', () => {
  for (const weapon of ['cannon', 'machinegun']) {
    const tape = makeTape({ weapon, muzzle: canonical, miss: true });
    assert.equal(tape.stats.hits, 0); assert.equal(tape.stats.damage, 0); assert.equal(tape.stats.finalProjectiles, 0);
    assert.equal(tape.events.some(e => e.type === 'hit'), false); xyz(tape.target.position, [10, 1.3, 24]);
    assert.deepEqual(tape.sample(tape.duration).projectiles, []);
    if (weapon === 'cannon') assert.ok(tape.duration > 7);
  }
});

test('rigid display transform rotates actual positions/directions/normals and translates cannon height together', () => {
  const muzzle = { position: [-6, 2.75, -4], direction: [-1, 0, 0] };
  for (const weapon of ['cannon', 'machinegun']) {
    const tape = makeTape({ weapon, muzzle }), base = makeTape({ weapon, muzzle: canonical });
    const transformed = p => [muzzle.position[0] - p[2], muzzle.position[1] + p[1] - 1.3, muzzle.position[2] + p[0]];
    tape.events.forEach((event, i) => {
      xyz(event.position, transformed(base.events[i].position)); xyz(event.direction, [-1, 0, 0]);
      if (event.normal) xyz(event.normal, [1, 0, 0]);
    });
    xyz(tape.target.position, transformed(base.target.position));
    tape.frames.forEach((frame, i) => frame.projectiles.forEach((p, j) => xyz(p.position, transformed(base.frames[i].projectiles[j].position))));
  }
});

test('immutable shared tape gives A/B and reverse scrubbing the identical recorded state without mutation', () => {
  const tape = makeTape({ weapon: 'machinegun', muzzle: canonical }), before = JSON.stringify(tape.frames);
  for (const t of [0, .155, .99, 1.99, 2.4, 5.5, .155, 0]) {
    assert.deepEqual(tape.sample(t), tape.sample(t));
    const prior = tape.frames.filter(f => f.time <= t + 1e-10).at(-1);
    assert.deepEqual(tape.sample(t), prior);
  }
  const value = tape.sample(.155); value.projectiles[0].position[0] = 12345;
  assert.equal(JSON.stringify(tape.frames), before);
  assert.throws(() => { tape.events[0].position[0] = 1; }, TypeError);
  assert.throws(() => makeTape({ weapon: 'cannon', muzzle: { ...canonical, direction: [0, 1, 1] } }), /planar/);
});

test('recording preserves existing authority source bytes and damage/collision configuration', () => {
  const sources = ['../battlefield/sim.mjs', '../battlefield/integration.mjs'];
  const before = sources.map(digest), config = JSON.stringify(CONFIG);
  for (const weapon of ['cannon', 'machinegun']) for (const miss of [true, false]) makeTape({ weapon, muzzle: canonical, miss });
  assert.deepEqual(sources.map(digest), before); assert.equal(JSON.stringify(CONFIG), config);
});

test('mounted recoil changes only the weapon instance; authority muzzle remains fixed, disposal respects borrowed model', () => {
  const hero = new THREE.Group(); hero.position.set(3, 2, -4); hero.rotation.y = .32;
  const source = new THREE.Group(), geometry = new THREE.BoxGeometry(2, 1, .8), material = new THREE.MeshToonMaterial();
  const barrel = new THREE.Mesh(geometry, material); barrel.position.y = .5; source.add(barrel);
  let geometryDisposals = 0, materialDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++); material.addEventListener('dispose', () => materialDisposals++);
  const before = { position: hero.position.toArray(), rotation: hero.rotation.toArray(), scale: hero.scale.toArray(), source: source.toJSON() };
  const mount = createMount(THREE, hero, source), initial = mount.frame();
  const event = [{ type: 'fire', time: 0 }], recoil = mount.root.getObjectByName('visual_recoil_only');
  mount.pose(.1, event, 'old'); const old = recoil.position.x;
  mount.pose(.1, event, 'new'); const rich = recoil.position.x;
  assert.ok(rich > old * 5); xyz(mount.frame().position.toArray(), initial.position.toArray());
  xyz(mount.frame().direction.toArray(), initial.direction.toArray());
  mount.pose(.1, event, 'new', true); assert.ok(recoil.position.x < rich * .25);
  mount.pose(5, event); near(recoil.position.x, 0); mount.pose(.1, event); near(recoil.position.x, rich);
  assert.deepEqual(hero.position.toArray(), before.position); assert.deepEqual(hero.rotation.toArray(), before.rotation); assert.deepEqual(hero.scale.toArray(), before.scale);
  assert.deepEqual(source.toJSON(), before.source); assert.ok(mount.root.getObjectByName('diagonal_hull_load_path'));
  mount.dispose(); mount.dispose(); assert.equal(hero.children.length, 0); assert.equal(geometryDisposals, 0); assert.equal(materialDisposals, 0);
  geometry.dispose(); material.dispose();
});

// CPU-only GLB reload with texture declarations removed from an in-memory
// copy. Original mesh accessors, node matrices and source files are untouched.
async function loadGeometry(relative) {
  const bytes = readFileSync(new URL(relative, import.meta.url)), length = bytes.readUInt32LE(12),
    data = JSON.parse(bytes.subarray(20, 20 + length).toString()), start = 20 + length,
    binary = bytes.subarray(start + 8, start + 8 + bytes.readUInt32LE(start));
  delete data.images; delete data.textures; delete data.samplers;
  data.materials = [{}]; for (const mesh of data.meshes) for (const primitive of mesh.primitives) primitive.material = 0;
  const raw = Buffer.from(JSON.stringify(data)), json = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]),
    header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8);
  jsonHeader.writeUInt32LE(json.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4); binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
  const packed = Buffer.concat([header, jsonHeader, json, binHeader, binary]);
  const { GLTFLoader } = await import(pathToFileURL(require.resolve('three/addons/loaders/GLTFLoader.js', { paths: [fileURLToPath(new URL('../../work/combat-vfx-v2/deps/', import.meta.url))] })).href);
  globalThis.ProgressEvent ??= class { constructor(type, values) { this.type = type; Object.assign(this, values); } };
  return (await new GLTFLoader().parseAsync(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength), '')).scene;
}

test('actual source GLBs: muzzle projects onto visible weapon tip and both support shoes touch original wooden hull triangles', async () => {
  const sourceShip = await loadGeometry('../../outputs/ship-states-v1/star4-assets-v1/star4-artillery.glb');
  const bounds = new THREE.Box3().setFromObject(sourceShip), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3()), scale = 15 / size.x;
  sourceShip.scale.setScalar(scale); sourceShip.position.copy(center).multiplyScalar(-scale);
  const hero = new THREE.Group(); hero.position.set(8, 2, 0); hero.add(sourceShip);
  for (const weapon of ['cannon', 'machinegun']) {
    const scene = await loadGeometry(`../../outputs/weapon-modules/${weapon === 'cannon' ? '02-deck-cannon' : '01-machine-gun'}/weapon.glb`);
    const mount = createMount(THREE, hero, scene, { weapon }), frame = mount.frame(), inverseRoot = mount.root.matrixWorld.clone().invert();
    const points = []; mount.model.traverse(n => {
      const attr = n.geometry?.attributes?.position; if (!attr) return;
      for (let i = 0; i < attr.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(attr, i).applyMatrix4(n.matrixWorld).applyMatrix4(inverseRoot));
    });
    const localBounds = new THREE.Box3().setFromPoints(points), band = points.filter(p => p.x <= localBounds.min.x + (localBounds.max.x - localBounds.min.x) * .025),
      mean = band.reduce((p, v) => p.add(v), new THREE.Vector3()).multiplyScalar(1 / band.length), localFrame = frame.position.clone().applyMatrix4(inverseRoot);
    near(localFrame.x, localBounds.min.x); near(localFrame.y, mean.y); near(localFrame.z, mean.z);
    // The source barrel front is above the base; the datum cannot be its plinth centroid.
    assert.ok((localFrame.y - localBounds.min.y) / (localBounds.max.y - localBounds.min.y) > .45);
    const actualHull = []; sourceShip.traverse(n => { if (n.isMesh && /HullAndCabin/i.test(n.name)) actualHull.push(n); });
    for (const anchor of mount.root.userData.hullAnchorsHeroLocal) {
      const p = hero.localToWorld(new THREE.Vector3(...anchor)), closest = new THREE.Vector3(); let distance = Infinity;
      for (const mesh of actualHull) {
        const positions = mesh.geometry.attributes.position, indices = mesh.geometry.index, count = indices?.count ?? positions.count;
        for (let i = 0; i < count; i += 3) {
          const vertices = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + k) : i + k).applyMatrix4(mesh.matrixWorld));
          new THREE.Triangle(...vertices).closestPointToPoint(p, closest); distance = Math.min(distance, closest.distanceTo(p));
        }
      }
      assert.ok(distance < 1e-5, `shoe misses actual wooden hull by ${distance}`);
      assert.ok(mount.root.position.z > anchor[2]);
    }
    mount.pose(.07, [{ type: 'fire', time: 0 }]); xyz(mount.frame().position.toArray(), frame.position.toArray()); mount.dispose();
  }
});
