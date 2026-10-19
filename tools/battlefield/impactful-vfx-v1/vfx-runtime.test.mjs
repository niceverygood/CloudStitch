import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRichProfile } from '../vfx-rich-profiles.mjs';
import { getImpactfulProfile } from './profiles.mjs';
import { runtimeAssetDescriptors } from '../vfx-contract.mjs';
import { CONFIG, createSimulation, fire, step } from '../sim.mjs';

// No WebGL/browser or mocked THREE: exercise the real scene graph and mixer.
// Set BATTLEFIELD_DEPENDENCY_ROOT to an existing checkout with three installed.
// GLB decoding and original asset hashes are checked by verify-bindings.mjs;
// these small authored fixtures isolate lifecycle and authority regressions.
const dependencyRoot = process.env.BATTLEFIELD_DEPENDENCY_ROOT || fileURLToPath(new URL('../../../', import.meta.url));
const THREE = createRequire(path.join(dependencyRoot, 'package.json'))('three');
const readJson = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const [catalog, recipes] = await Promise.all([
  readJson('../../../outputs/combat-vfx/catalog.json'), readJson('../../../outputs/combat-vfx/recipes.json'),
]);
const descriptors = runtimeAssetDescriptors(catalog, recipes);
const descriptorById = new Map(descriptors.map(value => [value.id, value]));
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message || ''}: ${actual} != ${expected}`);
const vector = (actual, expected) => actual.toArray().forEach((value, index) => close(value, expected[index], `axis ${index}`));
const fixtureStats = { loads: [], geometriesDisposed: 0, materialsDisposed: 0, texturesDisposed: 0 };
let loaderFailure = null, jsonFailure = null;

class FixtureLoader {
  async loadAsync(url) {
    const id = url.match(/\/([a-z0-9-]+)\.glb$/)?.[1];
    const descriptor = descriptorById.get(id);
    assert.ok(descriptor, `only the six v1 runtime assets may load: ${url}`);
    fixtureStats.loads.push(id);
    if (loaderFailure === 'reject' && id === 'machine-gun-muzzle') throw new Error('fixture decode failure');
    const scene = new THREE.Group();
    scene.name = `source_${id}`;
    const texture = new THREE.Texture();
    texture.addEventListener('dispose', () => fixtureStats.texturesDisposed++);
    const material = new THREE.MeshBasicMaterial({ color: 0xe8bd70, map: texture });
    material.addEventListener('dispose', () => fixtureStats.materialsDisposed++);
    const geometry = new THREE.BoxGeometry(.1, .1, .1);
    geometry.addEventListener('dispose', () => fixtureStats.geometriesDisposed++);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `pulse_${id}`;
    mesh.position.set(2, 3, 4);
    mesh.scale.set(.7, .8, .9);
    if (descriptor.kind === 'projectile') {
      const carrier = new THREE.Group();
      carrier.name = loaderFailure === 'missing-carrier' && id === 'machine-gun-projectile' ? 'wrong_carrier' : descriptor.carrierName;
      carrier.position.set(99, 100, 101);
      carrier.rotation.set(.2, .3, .4); carrier.scale.set(8, 9, 10);
      carrier.add(mesh); scene.add(carrier);
      const demo = new THREE.Group(); demo.name = `demo_only_${id}`; scene.add(demo);
    } else scene.add(mesh);
    // Non-zero authored baseline plus a changing track makes reset meaningful.
    const clip = new THREE.AnimationClip(`${id}_source_clip`, descriptor.catalogDuration, [
      new THREE.VectorKeyframeTrack(`${mesh.name}.position`, [0, descriptor.catalogDuration / 2, descriptor.catalogDuration],
        [2, 3, 4, 5, 6, 7, 8, 9, 10]),
    ]);
    return { scene, animations: loaderFailure === 'no-clip' && id === 'machine-gun-hit' ? [] : [clip] };
  }
}

const fireEvent = (seq = 1, projectileId = 'visual-shot', overrides = {}) => ({
  seq, type: 'player-fire', projectileId, weaponId: '01-machine-gun', x: 4, y: 2, z: 6,
  direction: { x: 0, y: 0, z: 1 }, ...overrides,
});
const projectile = (id = 'visual-shot', overrides = {}) => ({
  id, weaponId: '01-machine-gun', x: 4, y: 2, z: 6, vx: 0, vz: 30, ...overrides,
});
const hitEvent = (seq = 2, projectileId = 'visual-shot', overrides = {}) => ({
  ...fireEvent(seq, projectileId), type: 'hit', x: 14, y: 2, z: 16,
  normal: { x: 1, y: 0, z: 0 }, ...overrides,
});
const rootFor = (scene, id) => scene.getObjectByName(`battlefield-vfx-${id}`);

test('v1 impactful runtime uses real Three.js mixers and authoritative combat events', async t => {
  const originalFetch = globalThis.fetch;
  const originalLoader = globalThis.__battlefieldVfxFixtureLoader;
  const instances = [];
  globalThis.__battlefieldVfxFixtureLoader = FixtureLoader;
  globalThis.fetch = async url => {
    assert.ok(['../combat-vfx/catalog.json', '../combat-vfx/recipes.json'].includes(url), `unexpected fetch ${url}`);
    if (jsonFailure) return { ok: false, status: 503 };
    return { ok: true, json: async () => structuredClone(url.endsWith('catalog.json') ? catalog : recipes) };
  };
  let source = await readFile(new URL('./vfx.js', import.meta.url), 'utf8');
  source = source.replace("import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    'const GLTFLoader = globalThis.__battlefieldVfxFixtureLoader;');
  source = source.replaceAll("'../vfx-contract.mjs'", JSON.stringify(new URL('../vfx-contract.mjs', import.meta.url).href))
    .replaceAll("'../vfx-rich-profiles.mjs'", JSON.stringify(new URL('../vfx-rich-profiles.mjs', import.meta.url).href))
    .replaceAll("'./profiles.mjs'", JSON.stringify(new URL('./profiles.mjs', import.meta.url).href));
  const { createCombatVfx } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const make = async options => {
    const scene = new THREE.Scene(), vfx = createCombatVfx(THREE, scene, options);
    instances.push(vfx); await vfx.load(); return { scene, vfx };
  };
  try {
    await t.test('explicit original presentation preserves v1 scale and loads exactly the original six assets', async () => {
      const before = fixtureStats.loads.length;
      const { scene, vfx } = await make({ presentation: 'original' });
      assert.deepEqual(fixtureStats.loads.slice(before).sort(), descriptors.map(value => value.id).sort());
      assert.equal(vfx.debug().presentation, 'original'); assert.equal(vfx.debug().assetVersion, 'v1');
      vfx.consume([fireEvent()], [projectile()]);
      const muzzle = rootFor(scene, 'machine-gun-muzzle'), bullet = rootFor(scene, 'machine-gun-projectile');
      vector(muzzle.scale, [1, 1, 1]); vector(bullet.scale, [1, 1, 1]);
      assert.equal(muzzle.children.length, 1); assert.equal(bullet.children.length, 1);
      assert.equal(vfx.debug().muzzleEffects, 1); assert.equal(vfx.debug().activeProjectiles, 1);
      vfx.dispose(); assert.equal(scene.children.length, 0);
    });

    await t.test('new factory defaults to impactful while explicit rich retains its frozen display values', async () => {
      const next = await make();
      assert.equal(next.vfx.debug().presentation, 'impactful');
      next.vfx.consume([fireEvent()], [projectile()]);
      const p = getImpactfulProfile('machine-gun-muzzle');
      vector(rootFor(next.scene, 'machine-gun-muzzle').scale, p.stretch.map(axis => axis * p.scale));
      assert.equal(rootFor(next.scene, 'machine-gun-muzzle').children.length, 3);
      vector(rootFor(next.scene, 'machine-gun-projectile').scale, [1.65, 1.65, 1.65]);
      next.vfx.dispose();
      const old = await make({ presentation: 'rich' });
      old.vfx.consume([fireEvent()], [projectile()]);
      const previous = getRichProfile('machine-gun-muzzle');
      vector(rootFor(old.scene, 'machine-gun-muzzle').scale, [1.4, 1.4, 1.4]);
      assert.equal(rootFor(old.scene, 'machine-gun-muzzle').children.length, previous.echoes.length + 1);
      const echo = rootFor(old.scene, 'machine-gun-muzzle').children[1];
      vector(echo.scale, [.6, .6, .6]);
      vector(rootFor(old.scene, 'machine-gun-projectile').scale, [1.35, 1.35, 1.35]);
      old.vfx.dispose();
    });

    await t.test('richness scales visual wrappers and delays local +Y echoes without extra shots', async () => {
      const { scene, vfx } = await make({ presentation: 'impactful', effectScale: 1.1 });
      vfx.consume([fireEvent()], [projectile()]);
      const profile = getImpactfulProfile('machine-gun-muzzle'), root = rootFor(scene, 'machine-gun-muzzle');
      vector(root.scale, profile.stretch.map(value => value * profile.scale * 1.1));
      assert.equal(root.children.length, 1 + profile.echoes.length);
      const echo = root.children[1], spec = profile.echoes[0];
      assert.equal(echo.visible, false); vector(echo.position, spec.offset); vector(echo.scale, spec.stretch.map(value => value * spec.scale));
      close(echo.rotation.y, spec.rotation); close(echo.rotation.x, 0); close(echo.rotation.z, 0);
      vfx.update(spec.delay / 2, [projectile()]); assert.equal(echo.visible, false);
      vfx.update(spec.delay / 2 + .001, [projectile()]); assert.equal(echo.visible, true);
      assert.equal(vfx.debug().muzzleEffects, 1); assert.equal(vfx.debug().activeProjectiles, 1); assert.equal(vfx.debug().hitEffects, 0);
      assert.equal(rootFor(scene, 'machine-gun-projectile').children.length, 1);
      vfx.dispose();
    });

    await t.test('projectile uses carrier only and never integrates velocity or GLB demo motion', async () => {
      const { scene, vfx } = await make({ presentation: 'impactful' });
      const shot = projectile(); vfx.consume([fireEvent()], [shot]);
      const root = rootFor(scene, 'machine-gun-projectile'), carrier = root.children[0].children[0];
      vector(carrier.position, [0, 0, 0]); vector(carrier.scale, [1, 1, 1]);
      close(carrier.quaternion.angleTo(new THREE.Quaternion()), 0);
      assert.equal(root.getObjectByName('demo_only_machine-gun-projectile'), undefined);
      const before = JSON.stringify(shot);
      vfx.update(20, [shot]); vector(root.position, [4, 2, 6]);
      vector(carrier.getObjectByName('pulse_machine-gun-projectile').position, [2, 3, 4]);
      assert.equal(JSON.stringify(shot), before); assert.equal(vfx.debug().activeProjectiles, 1); assert.equal(vfx.debug().hitEffects, 0);
      Object.assign(shot, { x: 18, y: 7, z: -9, vx: 9, vz: 0 });
      vfx.update(0, [shot]); vector(root.position, [18, 7, -9]);
      vector(new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion), [1, 0, 0]);
      vfx.update(0, []); assert.equal(root.parent, null); assert.equal(vfx.debug().activeProjectiles, 0);
      assert.equal(vfx.debug().hitEffects, 0, 'disappearance without a hit must never invent an impact');
      vfx.dispose();
    });

    await t.test('all echoes stop at the original clip end and pause consumes no animation time', async () => {
      const { scene, vfx } = await make({ presentation: 'impactful' });
      vfx.consume([fireEvent()], [projectile()]);
      const root = rootFor(scene, 'machine-gun-muzzle'), mesh = root.getObjectByName('pulse_machine-gun-muzzle');
      const duration = descriptorById.get('machine-gun-muzzle').catalogDuration;
      vfx.update(duration / 2, [projectile()]);
      assert.ok(mesh.position.x > 2);
      const held = mesh.position.clone(); vfx.update(0, [projectile()]); assert.ok(mesh.position.equals(held));
      vfx.update(duration / 2 - .00001, [projectile()]); assert.equal(root.parent, scene);
      vfx.update(.00002, [projectile()]); assert.equal(root.parent, null);
      assert.equal(vfx.debug().activeOneShots, 0); assert.equal(vfx.debug().activeProjectiles, 1);
      vfx.dispose();
    });

    await t.test('a real simulated shot creates one authoritative contact and exactly one damage application', async () => {
      const { scene, vfx } = await make({ presentation: 'impactful' });
      const sim = createSimulation({ playerSpawn: { x: -20, z: 0 } });
      const enemy = sim.enemies[0]; sim.enemies = [enemy];
      Object.assign(enemy, { x: 0, z: 0, angle: 0, cooldown: 1e6 });
      const startingHp = enemy.modules.reduce((sum, module) => sum + module.hp, 0);
      assert.ok(fire(sim, { x: 0, z: 0 }));
      vfx.consume(sim.events, sim.projectiles);
      assert.equal(vfx.debug().muzzleEffects, 1); assert.equal(vfx.debug().hitEffects, 0);
      // Display time alone is not a collision clock.
      vfx.update(10, sim.projectiles); assert.equal(sim.stats.hits, 0); assert.equal(vfx.debug().hitEffects, 0);
      for (let frame = 0; frame < 240 && !sim.stats.hits; frame++) {
        const previousTime = sim.time; step(sim, 1 / 60);
        vfx.consume(sim.events, sim.projectiles); vfx.update(sim.time - previousTime, sim.projectiles);
      }
      assert.equal(sim.stats.shots, 1); assert.equal(sim.stats.hits, 1);
      assert.equal(startingHp - enemy.modules.reduce((sum, module) => sum + module.hp, 0), CONFIG.playerDamage);
      assert.equal(vfx.debug().muzzleEffects, 1); assert.equal(vfx.debug().hitEffects, 1); assert.equal(vfx.debug().activeProjectiles, 0);
      const hit = sim.events.find(event => event.type === 'hit'), hitRoot = rootFor(scene, 'machine-gun-hit');
      assert.ok(hitRoot); vector(hitRoot.position, [hit.x, hit.y, hit.z]);
      vector(new THREE.Vector3(0, 1, 0).applyQuaternion(hitRoot.quaternion), [hit.normal.x, hit.normal.y, hit.normal.z]);
      const snapshot = JSON.stringify(sim); vfx.consume(sim.events, sim.projectiles); vfx.update(.01, sim.projectiles);
      assert.equal(JSON.stringify(sim), snapshot); assert.equal(vfx.debug().hitEffects, 1);
      assert.equal(hitRoot.children.length, 1 + getImpactfulProfile('machine-gun-hit').echoes.length);
      vfx.dispose();
    });

    await t.test('duplicate events and terminal projectiles never replay muzzle or impact', async () => {
      const { vfx } = await make({ presentation: 'impactful' });
      vfx.consume([fireEvent()], [projectile()]);
      vfx.consume([fireEvent(), fireEvent(2)], [projectile()]);
      assert.equal(vfx.debug().muzzleEffects, 1);
      vfx.consume([hitEvent(3)], []); vfx.consume([hitEvent(4), fireEvent(5)], [projectile()]);
      assert.equal(vfx.debug().hitEffects, 1); assert.equal(vfx.debug().muzzleEffects, 1);
      assert.equal(vfx.debug().activeProjectiles, 0);
      vfx.update(30, []); assert.equal(vfx.debug().activeOneShots, 0);
      vfx.dispose();
    });

    await t.test('stale generations are rejected before a high seq can starve the current generation', async () => {
      const { vfx } = await make({ presentation: 'impactful' });
      vfx.consume([fireEvent(1, 'old', { generation: 1 })], [projectile('old')], 1);
      vfx.consume([fireEvent(9999, 'stale', { generation: 1 }), fireEvent(1, 'current', { generation: 2 })], [projectile('current')], 2);
      assert.equal(vfx.debug().generation, 2); assert.equal(vfx.debug().eventCursor, 1);
      assert.deepEqual(vfx.debug().projectileIds, ['current']); assert.equal(vfx.debug().muzzleEffects, 1);
      assert.equal(vfx.debug().staleGenerationEvents, 1);
      vfx.consume([hitEvent(10000, 'current', { generation: 1 })], [], 1);
      assert.deepEqual(vfx.debug().projectileIds, ['current']); assert.equal(vfx.debug().hitEffects, 0);
      assert.equal(vfx.debug().staleGenerationEvents, 2);
      vfx.consume([hitEvent(2, 'current', { generation: 2 })], [], 2);
      assert.equal(vfx.debug().hitEffects, 1); assert.equal(vfx.debug().activeProjectiles, 0);
      vfx.dispose();
    });

    await t.test('reset restores animated child transforms and reuses clean pooled roots', async () => {
      const { scene, vfx } = await make({ presentation: 'impactful' });
      vfx.consume([fireEvent(1, 'a')], [projectile('a')], 1);
      const root = rootFor(scene, 'machine-gun-muzzle'), mesh = root.getObjectByName('pulse_machine-gun-muzzle');
      vfx.update(.07, [projectile('a')]); assert.ok(mesh.position.x > 2);
      vfx.reset(2); assert.equal(scene.children.length, 0); assert.equal(vfx.debug().activeVisualLayers, 0);
      assert.equal(root.visible, false); vector(root.position, [0, 0, 0]); vector(root.scale, [1, 1, 1]);
      vector(mesh.position, [2, 3, 4]); vector(mesh.scale, [.7, .8, .9]);
      for (const layer of root.children) assert.equal(layer.visible, false);
      vfx.consume([fireEvent(1, 'b', { generation: 2, x: -7, z: 19 })], [projectile('b')], 2);
      assert.equal(rootFor(scene, 'machine-gun-muzzle'), root); vector(root.position, [-7, 2, 19]);
      vector(root.scale, getImpactfulProfile('machine-gun-muzzle').stretch.map(axis => axis * 2)); vector(mesh.position, [2, 3, 4]);
      assert.equal(root.children[0].visible, true); assert.equal(root.children[1].visible, false);
      assert.equal(vfx.debug().reused, 2); assert.equal(vfx.debug().created, 0);
      for (let generation = 3; generation < 20; generation++) {
        vfx.reset(generation); assert.equal(scene.children.length, 0);
        vfx.consume([fireEvent(1, `reuse-${generation}`, { generation })], [projectile(`reuse-${generation}`)], generation);
      }
      vfx.reset(20); assert.equal(scene.children.length, 0); assert.equal(vfx.debug().fireEventCount, 0);
      assert.equal(vfx.debug().terminalProjectileCount, 0); assert.equal(vfx.debug().activeVisualLayers, 0);
      vfx.dispose();
    });

    await t.test('cannon has its own impactful scales and echoes while unsupported weapons remain unsupported', async () => {
      const { scene, vfx } = await make({ presentation: 'impactful' });
      vfx.consume([fireEvent(1, 'cannon', { type: 'enemy-fire', weaponId: '02-deck-cannon' })], [projectile('cannon', { weaponId: '02-deck-cannon' })]);
      const muzzle = rootFor(scene, 'cannon-muzzle');
      assert.equal(muzzle.children.length, 1 + getImpactfulProfile('cannon-muzzle').echoes.length); vector(muzzle.scale, getImpactfulProfile('cannon-muzzle').stretch.map(axis => axis * 2.1));
      vfx.consume([hitEvent(2, 'cannon', { weaponId: '02-deck-cannon' })], []);
      const hit = rootFor(scene, 'cannon-hit'); assert.equal(hit.children.length, 1 + getImpactfulProfile('cannon-hit').echoes.length);
      vfx.consume([fireEvent(3, 'mortar', { weaponId: '03-mortar' })], [projectile('mortar', { weaponId: '03-mortar' })]);
      assert.equal(vfx.debug().unsupportedEvents, 1); assert.equal(vfx.debug().activeProjectiles, 0);
      assert.equal(vfx.debug().hitEffects, 1); assert.equal(vfx.debug().muzzleEffects, 1);
      vfx.dispose();
    });

    await t.test('100 simultaneous shots respect separate active and idle pool caps without changing combat data', async () => {
      const { scene, vfx } = await make({ presentation: 'impactful' });
      const events = Array.from({ length: 100 }, (_, index) => fireEvent(index + 1, `burst-${index}`));
      const shots = events.map(event => projectile(event.projectileId));
      const authoritativeSnapshot = JSON.stringify({ events, shots });
      vfx.consume(events, shots);
      const saturated = vfx.debug(), muzzle = saturated.perEffect['machine-gun-muzzle'];
      const bullet = saturated.perEffect['machine-gun-projectile'];
      assert.equal(muzzle.maxActive, 32); assert.equal(muzzle.active, 32); assert.equal(muzzle.peak, 32);
      assert.equal(muzzle.spawned, 32); assert.equal(muzzle.dropped, 68);
      assert.equal(bullet.maxActive, 64); assert.equal(bullet.active, 64); assert.equal(bullet.peak, 64);
      assert.equal(bullet.spawned, 64); assert.equal(bullet.dropped, 36);
      assert.equal(saturated.activeOneShots, 32); assert.equal(saturated.activeProjectiles, 64);
      assert.equal(saturated.dropped, 104); assert.equal(scene.children.length, 96);
      let displayedMeshes = 0; scene.traverse(node => { if (node.isMesh) displayedMeshes++; });
      assert.equal(displayedMeshes, muzzle.activeMeshes + bullet.activeMeshes);
      for (const stats of Object.values(saturated.perEffect)) {
        assert.ok(stats.active <= stats.maxActive); assert.ok(stats.activeLayers <= stats.maxLayers);
        assert.ok(stats.activeMeshes <= stats.maxMeshes); assert.equal(stats.maxPooled, 24);
      }
      vfx.update(1, shots);
      assert.equal(vfx.debug().activeOneShots, 0); assert.equal(vfx.debug().activeProjectiles, 64);
      assert.equal(vfx.debug().perEffect['machine-gun-muzzle'].pooled, 24);
      assert.equal(vfx.debug().perEffect['machine-gun-muzzle'].culled, 8);
      vfx.update(0, []);
      const ended = vfx.debug(); assert.equal(scene.children.length, 0); assert.equal(ended.activeVisualLayers, 0);
      assert.equal(ended.activeProjectiles, 0); assert.equal(ended.hitEffects, 0);
      assert.equal(ended.perEffect['machine-gun-projectile'].pooled, 24);
      assert.equal(ended.perEffect['machine-gun-projectile'].culled, 40); assert.equal(ended.culled, 48);
      for (const stats of Object.values(ended.perEffect)) assert.ok(stats.pooled <= stats.maxPooled);
      assert.equal(JSON.stringify({ events, shots }), authoritativeSnapshot);
      vfx.reset(9);
      for (const stats of Object.values(vfx.debug().perEffect)) {
        assert.equal(stats.active, 0); assert.equal(stats.spawned, 0); assert.equal(stats.peak, 0);
        assert.equal(stats.dropped, 0); assert.equal(stats.culled, 0); assert.ok(stats.pooled <= 24);
      }
      vfx.dispose();
    });

    await t.test('invalid API inputs fail explicitly and cannot leak an attached contact effect', async () => {
      assert.throws(() => createCombatVfx(THREE, new THREE.Scene(), { presentation: 'v2' }), /presentation/);
      for (const effectScale of [NaN, Infinity, .49, 1.51]) assert.throws(() => createCombatVfx(THREE, new THREE.Scene(), { effectScale }), /effectScale/);
      const scene = new THREE.Scene(), unloaded = createCombatVfx(THREE, scene);
      instances.push(unloaded); assert.throws(() => unloaded.update(0), /load/); assert.throws(() => unloaded.consume([]), /load/);
      await unloaded.load();
      for (const dt of [-1, Infinity, NaN]) assert.throws(() => unloaded.update(dt), /dt/);
      assert.throws(() => unloaded.update(0, {}), /배열/);
      for (const generation of [-1, .5, Infinity]) {
        assert.throws(() => unloaded.consume([], [], generation), /generation/);
        assert.throws(() => unloaded.reset(generation), /generation/);
      }
      assert.throws(() => unloaded.consume([hitEvent(1, 'bad', { normal: { x: 0, y: 0, z: 0 } })], []), /법선/);
      assert.equal(scene.children.length, 0);
      assert.throws(() => unloaded.consume([fireEvent(2, null)], []), /projectileId/);
      unloaded.dispose(); assert.throws(() => unloaded.update(0), /load/);
      await assert.rejects(unloaded.load(), /폐기/);
    });

    await t.test('dispose clears active and pooled wrappers and disposes each source resource once', async () => {
      const { scene, vfx } = await make({ presentation: 'impactful' });
      vfx.consume([fireEvent()], [projectile()]); vfx.update(.03, [projectile()]);
      const before = { ...fixtureStats }; vfx.dispose();
      assert.equal(scene.children.length, 0); assert.equal(vfx.debug().state, 'disposed');
      assert.equal(vfx.debug().activeOneShots, 0); assert.equal(vfx.debug().activeProjectiles, 0);
      assert.deepEqual(vfx.debug().pooled, {}); assert.deepEqual(vfx.debug().loadedEffects, []);
      assert.equal(fixtureStats.geometriesDisposed - before.geometriesDisposed, 6);
      assert.equal(fixtureStats.materialsDisposed - before.materialsDisposed, 6);
      assert.equal(fixtureStats.texturesDisposed - before.texturesDisposed, 6);
      const disposed = { ...fixtureStats }; vfx.dispose(); assert.deepEqual(fixtureStats, disposed);
    });

    await t.test('load rejects missing carrier, clip, decoder and JSON failures, cleans up, and can retry', async () => {
      for (const failure of ['missing-carrier', 'no-clip', 'reject', 'json']) {
        const scene = new THREE.Scene(), vfx = createCombatVfx(THREE, scene, { presentation: 'impactful' }); instances.push(vfx);
        loaderFailure = failure; jsonFailure = failure === 'json';
        const before = fixtureStats.geometriesDisposed;
        await assert.rejects(vfx.load(), /초기화 실패/);
        assert.equal(vfx.debug().state, 'failed'); assert.equal(scene.children.length, 0);
        assert.deepEqual(vfx.debug().loadedEffects, []);
        assert.equal(fixtureStats.geometriesDisposed - before, failure === 'json' ? 0 : failure === 'reject' ? 5 : 6);
        loaderFailure = null; jsonFailure = null;
        await vfx.load(); assert.equal(vfx.debug().loadedEffects.length, 6); vfx.dispose();
      }
    });
  } finally {
    for (const vfx of instances) vfx.dispose();
    globalThis.fetch = originalFetch;
    if (originalLoader === undefined) delete globalThis.__battlefieldVfxFixtureLoader;
    else globalThis.__battlefieldVfxFixtureLoader = originalLoader;
  }
});
