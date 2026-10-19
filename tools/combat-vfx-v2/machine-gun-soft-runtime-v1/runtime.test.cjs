/* CPU-only authority/lifecycle tests. No browser, server, fetch or WebGL.
 * Use the existing dependency cache through NODE_PATH, for example PowerShell:
 * $env:NODE_PATH = (Join-Path (Get-Location) 'work/combat-vfx-v2/deps/node_modules')
 * node --test tools/combat-vfx-v2/machine-gun-soft-runtime-v1/runtime.test.cjs
 * node tools/combat-vfx-v2/machine-gun-soft-runtime-v1/runtime.test.cjs --write
 * Texture fixtures isolate scene-graph behavior; they do not approve the art.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const THREE = require('three');
const ROOT = path.resolve(__dirname, '../../..');
const WRITE = process.argv.includes('--write');
const REPORT_FILE = path.join(ROOT, 'outputs/combat-vfx-v2/machine-gun-soft-runtime-v1/verification/runtime-tests.json');
const report = { schema_version: 1, game_title: 'Cloudstitch', started_at_utc: new Date().toISOString(), passed: false, completed: false,
  scope: 'CPU-only actual Three.js authority, scene graph, surface alignment and lifecycle tests with injected DataTexture fixtures. No browser, WebGL or visual-art approval.',
  browser_run: false, visual_art_approved: false, cases: [], sources: [],
  limits: ['Generated atlas pixels, shader compilation, actual browser rendering and game-screen readability are not checked by texture fixtures.', 'These tests do not connect or modify the integration renderer, original sim, damage, audio or camera impulse.'] };
let reportWritten = false;
function writeReport() {
  report.finished_at_utc = new Date().toISOString();
  report.sources = ['runtime.js', 'painted-effects.js', 'runtime.test.cjs'].map(name => {
    const file = path.join(__dirname, name), bytes = fs.readFileSync(file);
    return { path: path.relative(ROOT, file).split(path.sep).join('/'), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  });
  report.case_count = report.cases.length; report.passed_cases = report.cases.filter(value => value.passed).length;
  report.failed_cases = report.cases.filter(value => !value.passed).length;
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + '\n'); reportWritten = true;
}
process.on('exit', code => {
  if (!WRITE || reportWritten) return;
  report.passed = false; report.failure ||= 'Test run did not reach final cleanup (exit ' + code + ').';
  try { writeReport(); } catch (error) { console.error('Cannot write runtime test report: ' + error.message); }
  process.exitCode = 1;
});
const close = (a, b, label = 'value') => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} != ${b}`);
const vector = (actual, expected, label = 'vector') => actual.toArray().forEach((value, i) => close(value, expected[i], label + '[' + i + ']'));

// In-memory ESM import also supports a repository without type=module on Node20.
// Only relative JS dependencies are inlined; existing .mjs contracts keep URLs.
function moduleURL(filename, ancestors = []) {
  if (ancestors.includes(filename)) throw new Error('Unexpected cyclic test module import: ' + filename);
  let source = fs.readFileSync(filename, 'utf8');
  source = source.replace(/\bfrom\s*(['"])(\.{1,2}\/[^'"]+)\1/g, (match, quote, specifier) => {
    const file = path.resolve(path.dirname(filename), specifier);
    const url = path.extname(file) === '.js' ? moduleURL(file, [...ancestors, filename]) : pathToFileURL(file).href;
    return 'from ' + quote + url + quote;
  });
  return 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
}
const fireEvent = (seq = 1, projectileId = 'visual-shot', extra = {}) => ({ seq, type: 'player-fire', projectileId, weaponId: '01-machine-gun', generation: 1, x: 4, y: 2, z: 6, direction: { x: 0, y: 0, z: 1 }, ...extra });
const shot = (id = 'visual-shot', extra = {}) => ({ id, weaponId: '01-machine-gun', x: 4, y: 2, z: 6, vx: 0, vy: 0, vz: 30, ...extra });
const hitEvent = (seq = 2, projectileId = 'visual-shot', extra = {}) => ({ ...fireEvent(seq, projectileId), type: 'hit', x: 12, y: 2, z: 16, normal: { x: 1, y: 0, z: 0 }, ...extra });
const endedEvent = (seq = 3, projectileId = 'visual-shot', extra = {}) => ({ seq, generation: 1, type: 'projectile-ended', projectileId, reason: 'range-or-lifetime', ...extra });
const rootFor = (scene, kind, id = 'visual-shot') => scene.getObjectByName(`soft-mg-${kind}-${id}`);
const bodyFor = (scene, id = 'visual-shot') => {
  const root = rootFor(scene, 'projectile', id);
  assert.ok(root, 'authoritative projectile display exists: ' + id);
  const body = root.getObjectByName('pointed_brass_bullet');
  assert.ok(body, 'the actual painted smooth bullet is used');
  return body;
};
function visibleState(scene) {
  scene.updateMatrixWorld(true); const entries = [];
  scene.traverseVisible(node => {
    if (node === scene) return;
    entries.push({ name: node.name.replace(/soft-mg-(muzzle|projectile|hit)-.*/, 'runtime-root'),
      p: node.position.toArray(), q: node.quaternion.toArray(), s: node.scale.toArray(), world: node.matrixWorld.elements.slice(),
      opacity: node.material?.opacity, rotation: node.material?.rotation, elapsed: node.userData?.elapsed });
  });
  return JSON.stringify(entries);
}
function assertNoPreviewCopies(root) {
  let visibleBullets = 0;
  root.traverseVisible(node => { if (node.name === 'pointed_brass_bullet') visibleBullets++; });
  assert.equal(visibleBullets, 1, 'one real shot has one displayed bullet, without the preview triple-shot');
}

test('soft MG runtime follows battlefield authority with real Three.js scene objects', async t => {
  const originalFetch = globalThis.fetch, fixtures = new Set(); let fetchCalls = 0;
  t.after(() => {
    globalThis.fetch = originalFetch;
    try { for (const f of fixtures) { f.api.dispose(); f.atlas.dispose(); f.metalTexture.dispose(); } }
    catch (error) { report.failure = 'Cleanup failed: ' + error.message; }
    report.fetch_calls = fetchCalls;
    report.passed = report.completed && report.cases.length > 0 && report.cases.every(value => value.passed) && !report.failure;
    if (WRITE) {
      try { writeReport(); }
      catch (error) { report.passed = false; report.failure = 'Report failed: ' + error.message; console.error(report.failure); }
    }
    if (!report.passed) process.exitCode = 1;
  });
  const run = async (name, body) => {
    const result = { name, passed: false, duration_ms: 0 }, start = performance.now(); report.cases.push(result);
    await t.test(name, async context => {
      try { await body(context); result.passed = true; }
      catch (error) { result.failure = error.message; throw error; }
      finally { result.duration_ms = Math.round((performance.now() - start) * 1000) / 1000; }
    });
  };
  const { createSoftMachineGunVfx } = await import(moduleURL(path.join(__dirname, 'runtime.js')));
  const { createBattlefieldAdapter } = await import(pathToFileURL(path.join(ROOT, 'tools/battlefield/integration.mjs')).href);
  globalThis.fetch = async () => { fetchCalls++; throw new Error('CPU runtime tests must not fetch or load remote media.'); };
  async function make(options = {}) {
    const atlas = new THREE.DataTexture(new Uint8Array(16).fill(255), 2, 2, THREE.RGBAFormat);
    const metalTexture = atlas.clone(), scene = new THREE.Scene(); let baseDisposed = 0;
    atlas.addEventListener('dispose', () => baseDisposed++); metalTexture.addEventListener('dispose', () => baseDisposed++);
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .01, 1000);
    camera.position.set(-7, 5.5, -7); camera.lookAt(0, 1, 2); camera.updateMatrixWorld(true);
    const api = createSoftMachineGunVfx(THREE, scene, { atlas, metalTexture, camera, ...options });
    const f = { api, scene, atlas, metalTexture, camera, get baseDisposed() { return baseDisposed; } }; fixtures.add(f);
    await api.load(); return f;
  }

  await run('one fire uses its event frame while the bullet follows actual state for any age', async () => {
    const { api, scene } = await make();
    const event = fireEvent(), projectiles = [shot()], before = JSON.stringify({ event, projectiles });
    api.consume([event], projectiles, 1); api.update(.04, projectiles);
    assert.equal(api.debug().muzzleEffects, 1); assert.equal(api.debug().hitEffects, 0);
    assert.equal(api.debug().activeProjectiles, 1);
    const muzzle = rootFor(scene, 'muzzle'); assert.ok(muzzle);
    vector(muzzle.getObjectByName('painted_muzzle_shot_0').getWorldPosition(new THREE.Vector3()), [4, 2, 6], 'event muzzle');
    const root = rootFor(scene, 'projectile'); vector(root.position, [0, 0, 0], 'runtime root stays identity');
    vector(root.scale, [1, 1, 1], 'effect scaling belongs to visual contents');
    assertNoPreviewCopies(root);
    vector(bodyFor(scene).getWorldPosition(new THREE.Vector3()), [4, 2, 6], 'initial sim position');
    const moved = [shot('visual-shot', { x: -11.25, y: 3.75, z: 8.5, vx: 4, vy: 1.5, vz: -2 })];
    api.update(0, moved);
    const body = bodyFor(scene), forward = new THREE.Vector3(0, 0, 1).applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion())).normalize();
    vector(body.getWorldPosition(new THREE.Vector3()), [-11.25, 3.75, 8.5], 'new sim position at dt0');
    vector(forward, new THREE.Vector3(4, 1.5, -2).normalize().toArray(), 'actual velocity axis');
    api.update(20, moved);
    assert.equal(api.debug().activeProjectiles, 1, 'neither preview .45s nor 2s sequence time can retire a live shot');
    vector(bodyFor(scene).getWorldPosition(new THREE.Vector3()), [-11.25, 3.75, 8.5], 'no local Z4 travel or velocity integration');
    assertNoPreviewCopies(rootFor(scene, 'projectile'));
    assert.equal(api.debug().hitEffects, 0, 'elapsed clip time cannot manufacture a hit');
    assert.equal(JSON.stringify({ event, projectiles }), before, 'runtime never edits input events/projectiles');
    api.dispose();
  });

  await run('duplicate fire/hit and terminal replays never add logical effects', async () => {
    const { api, scene } = await make();
    api.consume([fireEvent(), fireEvent()], [shot()], 1);
    api.consume([fireEvent(), fireEvent(2)], [shot()], 1);
    assert.equal(api.debug().muzzleEffects, 1);
    api.consume([hitEvent(3)], [], 1); api.update(.055, []);
    assert.equal(api.debug().hitEffects, 1); assert.equal(api.debug().activeProjectiles, 0);
    assert.ok(rootFor(scene, 'hit'));
    api.consume([hitEvent(4), fireEvent(5), endedEvent(6)], [shot()], 1);
    assert.equal(api.debug().hitEffects, 1); assert.equal(api.debug().muzzleEffects, 1); assert.equal(api.debug().activeProjectiles, 0);
    api.update(5, []); assert.equal(api.debug().activeOneShots, 0); assert.equal(scene.children.length, 0);
    api.dispose();
  });

  await run('expiry, disappearance and cancelled projectiles do not invent contact', async () => {
    const { api, scene } = await make();
    api.consume([fireEvent()], [shot()], 1);
    api.consume([endedEvent(2)], [], 1);
    assert.equal(api.debug().activeProjectiles, 0); assert.equal(api.debug().hitEffects, 0);
    api.consume([fireEvent(3, 'disappeared')], [shot('disappeared')], 1);
    api.update(.01, []); assert.equal(api.debug().activeProjectiles, 0); assert.equal(api.debug().hitEffects, 0);
    api.consume([fireEvent(4, 'cancelled')], [shot('cancelled')], 1);
    api.consume([endedEvent(5, 'cancelled', { reason: 'stage-complete' })], [], 1);
    api.update(1, []); assert.equal(scene.children.length, 0); assert.equal(api.debug().hitEffects, 0);
    api.dispose();
  });

  await run('combat-clear, defeat and harbor-return hide all layers and bar stale state replay', async () => {
    const { api, scene } = await make();
    for (const type of ['combat-cleared', 'defeat', 'harbor-return']) {
      api.reset(1); api.consume([fireEvent()], [shot()], 1); api.update(.045, [shot()]);
      api.consume([{ seq: 2, generation: 1, type }], [shot()], 1);
      assert.equal(api.debug().activeOneShots, 0); assert.equal(api.debug().activeProjectiles, 0); assert.equal(scene.children.length, 0);
      assert.equal(api.debug().cleared, true);
      api.update(0, [shot(), shot('unseen-stale-state')]);
      assert.equal(scene.children.length, 0, 'state snapshots alone cannot resume a globally cleared presentation');
      api.consume([fireEvent(3, 'fresh')], [shot('fresh')], 1);
      assert.equal(api.debug().cleared, false); assert.equal(api.debug().muzzleEffects, 2); assert.deepEqual(api.debug().projectileIds, ['fresh']);
    }
    api.dispose();
  });

  await run('missing projectile height and zero velocity use the fire frame without changing sim data', async () => {
    const { api, scene } = await make();
    const event = fireEvent(1, 'fallback', { y: undefined, direction: { x: -5, y: 0, z: 0 } });
    const projectile = shot('fallback', { x: 8, y: undefined, z: 11, vx: 0, vy: 0, vz: 0 });
    const before = JSON.stringify({ event, projectile });
    api.consume([event], [projectile], 1); api.update(.04, [projectile]);
    const body = bodyFor(scene, 'fallback'); vector(body.getWorldPosition(new THREE.Vector3()), [8, 1.3, 11]);
    vector(new THREE.Vector3(0, 0, 1).applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion())), [-1, 0, 0], 'fire direction fallback');
    assert.equal(JSON.stringify({ event, projectile }), before); api.dispose();
  });

  await run('generation filters stale high sequences before current events and allows retry IDs', async () => {
    const { api } = await make();
    api.consume([fireEvent(1, 'old')], [shot('old')], 1);
    api.consume([fireEvent(9999, 'stale'), fireEvent(1, 'current', { generation: 2 })], [shot('current')], 2);
    assert.equal(api.debug().generation, 2); assert.equal(api.debug().eventCursor, 1);
    assert.deepEqual(api.debug().projectileIds, ['current']); assert.equal(api.debug().muzzleEffects, 1);
    api.consume([hitEvent(10000, 'current')], [], 1);
    assert.deepEqual(api.debug().projectileIds, ['current']); assert.equal(api.debug().hitEffects, 0);
    api.consume([hitEvent(2, 'current', { generation: 2 })], [], 2);
    assert.equal(api.debug().hitEffects, 1); assert.equal(api.debug().activeProjectiles, 0);
    api.reset(3); api.consume([fireEvent(1, 'current', { generation: 3 })], [shot('current')], 3);
    assert.equal(api.debug().muzzleEffects, 1); assert.deepEqual(api.debug().projectileIds, ['current']);
    api.dispose();
  });

  await run('dt0 pauses ages and opacity; normal update resumes only once', async () => {
    const { api, scene } = await make(); api.consume([fireEvent()], [shot()], 1); api.update(.055, [shot()]);
    const before = visibleState(scene), elapsed = rootFor(scene, 'muzzle').userData.elapsed;
    api.update(0, [shot()]); api.update(0, [shot()]);
    assert.equal(visibleState(scene), before); assert.equal(rootFor(scene, 'muzzle').userData.elapsed, elapsed);
    api.update(.015, [shot()]); assert.notEqual(visibleState(scene), before);
    close(rootFor(scene, 'muzzle').userData.elapsed, elapsed + .015, 'one resume increment'); api.dispose();
  });

  await run('hit core and six soft spark planes keep actual surface normals while orbiting', async () => {
    const { api, scene, camera } = await make(); let seq = 1;
    for (const value of [[0, 1, 0], [0, 0, -1], [.4, .7, .2]]) {
      const id = 'contact-' + seq, normal = new THREE.Vector3(...value).normalize();
      api.reset(seq); api.consume([hitEvent(1, id, { generation: seq, normal: { x: normal.x, y: normal.y, z: normal.z } })], [], seq); api.update(.055, []);
      const root = rootFor(scene, 'hit', id); assert.ok(root);
      vector(root.getObjectByName('painted_impact_shot_0').getWorldPosition(new THREE.Vector3()), [12, 2, 16], 'actual contact');
      for (const angle of [0, .9, 2.1]) {
        camera.position.set(Math.cos(angle) * 8, 5, Math.sin(angle) * 8); camera.lookAt(12, 2, 16); camera.updateMatrixWorld(true); api.setCamera(camera); api.update(0, [], camera);
        let planes = 0;
        root.traverseVisible(node => {
          if (node.name !== 'painted_impact_core' && !node.name.startsWith('fine_gold_flick_')) return;
          assert.ok(node.isMesh && !node.isSprite, 'contact paint is a real surface plane');
          const actual = new THREE.Vector3().fromBufferAttribute(node.geometry.attributes.normal, 0).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(node.matrixWorld));
          close(Math.abs(actual.dot(normal)), 1, 'plane stays parallel to contact'); planes++;
          assert.equal(node.material.depthWrite, false); assert.equal(node.material.userData.outlineParameters.visible, false);
        });
        assert.equal(planes, 7, 'one core plus six delicate planar sparks');
      }
      seq++;
    }
    api.dispose();
  });

  await run('reset detaches and clears references; reused effects match a fresh instance', async () => {
    const reused = await make(), fresh = await make();
    reused.api.consume([fireEvent()], [shot()], 1); reused.api.update(.12, [shot()]);
    const oldMuzzle = rootFor(reused.scene, 'muzzle'), oldProjectile = rootFor(reused.scene, 'projectile');
    reused.api.reset(2);
    assert.equal(reused.scene.children.length, 0); assert.equal(reused.api.debug().activeOneShots, 0); assert.equal(reused.api.debug().activeProjectiles, 0);
    assert.equal(reused.api.debug().eventCursor, 0); assert.equal(reused.api.debug().terminalProjectileCount, 0); assert.equal(reused.api.debug().fireEventCount, 0);
    for (const root of [oldMuzzle, oldProjectile]) {
      assert.equal(root.parent, null); assert.equal(root.visible, false); vector(root.position, [0, 0, 0]); vector(root.scale, [1, 1, 1]);
      assert.ok(root.userData.projectileId == null); close(root.userData.elapsed, 0); assert.ok(root.userData.hostId == null); assert.ok(root.userData.endpoints == null);
    }
    const event = fireEvent(1, 'retry-shot', { generation: 2 }), projectile = shot('retry-shot');
    for (const f of [reused, fresh]) { f.api.consume([event], [projectile], 2); f.api.update(.045, [projectile]); }
    assert.equal(visibleState(reused.scene), visibleState(fresh.scene), 'no stale time/TRS/opacity/loop or endpoint state leaks into reuse');
    for (let generation = 3; generation < 8; generation++) { reused.api.reset(generation); reused.api.consume([fireEvent(1, 'retry-shot', { generation })], [projectile], generation); reused.api.update(.04, [projectile]); }
    reused.api.reset(8); assert.equal(reused.scene.children.length, 0);
    reused.api.dispose(); fresh.api.dispose();
  });

  await run('unsupported weapons and invalid contacts do not attach soft MG effects', async () => {
    const { api, scene } = await make();
    api.consume([fireEvent(1, 'cannon', { type: 'enemy-fire', weaponId: '02-deck-cannon' })], [shot('cannon', { weaponId: '02-deck-cannon' })], 1);
    assert.equal(api.debug().activeProjectiles, 0); assert.equal(api.debug().muzzleEffects, 0); assert.equal(scene.children.length, 0);
    assert.throws(() => api.consume([hitEvent(2, 'bad', { normal: { x: 0, y: 0, z: 0 } })], [], 1), /normal|법선/i);
    assert.equal(scene.children.length, 0, 'bad contact cannot leak an acquired instance');
    assert.throws(() => api.update(-1, []), /dt|time|초/i);
    assert.throws(() => api.update(NaN, []), /dt|time|초/i);
    assert.throws(() => api.consume([], [], -1), /generation/i);
    api.dispose();
  });

  await run('simultaneous shots respect active/pool caps while receipts and input stay independent', async () => {
    const { api, scene } = await make();
    const events = Array.from({ length: 100 }, (_, i) => fireEvent(i + 1, 'burst-' + i));
    const projectiles = events.map(event => shot(event.projectileId)), before = JSON.stringify({ events, projectiles });
    api.consume(events, projectiles, 1);
    assert.equal(api.debug().activeOneShots, 32); assert.equal(api.debug().activeProjectiles, 64);
    assert.ok(api.debug().dropped > 0); assert.equal(scene.children.length, 96);
    api.update(.25, projectiles); assert.equal(api.debug().activeOneShots, 0); assert.equal(api.debug().activeProjectiles, 64);
    api.update(0, []); assert.equal(scene.children.length, 0); assert.equal(api.debug().hitEffects, 0);
    assert.ok(api.debug().pooled.muzzle <= 24); assert.ok(api.debug().pooled.projectile <= 24); assert.ok(api.debug().culled > 0);
    assert.equal(JSON.stringify({ events, projectiles }), before, 'dropping visuals cannot drop or alter authoritative shots');
    api.reset(2); assert.equal(api.debug().terminalProjectileCount, 0); assert.equal(api.debug().firedProjectileCount, 0); assert.equal(api.debug().fireEventCount, 0); api.dispose();
  });

  await run('real swept sim contact alone creates a soft impact and cannot be mutated by display', async () => {
    const { api, scene } = await make();
    const adapter = createBattlefieldAdapter({ world: { playerSpawn: { x: -20, z: 10 }, harbor: { x: -20, z: 10, radius: 4 } },
      enemySpawns: [{ id: 'target', assetId: 'fixture-target', x: 0, z: 0, modules: [{ id: 'target:root', key: 'root', parentId: null, type: 'hull', hp: 64, maxHp: 64, localX: 0, localZ: 0, radius: 1, weight: 0 }] }],
      muzzleResolver() { return { position: { x: -10, y: 2.5, z: 0 }, direction: { x: 1, y: 0, z: 0 }, source: 'cpu-actual-muzzle' }; } });
    adapter.dispatch({ id: 'hold', type: 'intent', enemyId: 'target', intent: { move: { x: 0, z: 0 }, attackTarget: null } }); adapter.drainEvents();
    adapter.advance(1 / 60, { fire: true, aimX: -20, aimZ: -50 });
    let events = adapter.drainEvents(), snapshot = JSON.stringify(adapter.state);
    api.consume(events, adapter.state.projectiles, adapter.generation); api.update(1 / 60, adapter.state.projectiles);
    assert.equal(JSON.stringify(adapter.state), snapshot); assert.equal(adapter.state.stats.hits, 0); assert.equal(api.debug().hitEffects, 0);
    const event = events.find(e => e.type === 'player-fire'); assert.ok(event);
    vector(bodyFor(scene, event.projectileId).getWorldPosition(new THREE.Vector3()), [adapter.state.projectiles[0].x, 2.5, adapter.state.projectiles[0].z]);
    api.update(10, adapter.state.projectiles); assert.equal(api.debug().hitEffects, 0); assert.equal(adapter.state.stats.hits, 0);
    adapter.advance(.25); events = adapter.drainEvents(); const hit = events.find(e => e.type === 'hit'); assert.ok(hit, 'sim swept contact exists');
    snapshot = JSON.stringify(adapter.state); const copiedEvents = JSON.stringify(events);
    api.consume(events, adapter.state.projectiles, adapter.generation); api.update(.055, adapter.state.projectiles);
    assert.equal(api.debug().hitEffects, 1); assert.equal(api.debug().activeProjectiles, 0); assert.equal(JSON.stringify(adapter.state), snapshot); assert.equal(JSON.stringify(events), copiedEvents);
    const contact = rootFor(scene, 'hit', event.projectileId); assert.ok(contact); vector(contact.getObjectByName('painted_impact_shot_0').getWorldPosition(new THREE.Vector3()), [hit.x, hit.y, hit.z]);
    assert.equal(adapter.state.stats.hits, 1); assert.equal(adapter.state.enemies[0].modules[0].hp, 56); api.dispose();
  });

  await run('dispose is idempotent and owns only cloned textures, not caller atlases', async () => {
    const f = await make(); f.api.consume([fireEvent()], [shot()], 1); f.api.consume([hitEvent()], [], 1); f.api.update(.05, []);
    const owned = new Set(); f.scene.traverse(node => { if (node.material?.map && node.material.map !== f.atlas && node.material.map !== f.metalTexture) owned.add(node.material.map); });
    const counts = new Map(); for (const map of owned) { counts.set(map, 0); map.addEventListener('dispose', () => counts.set(map, counts.get(map) + 1)); }
    f.api.dispose(); f.api.dispose();
    assert.equal(f.scene.children.length, 0); assert.equal(f.baseDisposed, 0, 'caller atlas lifetime is independent');
    assert.equal(f.api.debug().state, 'disposed'); assert.ok(owned.size > 0);
    for (const count of counts.values()) assert.equal(count, 1, 'instance-owned tile textures dispose exactly once');
    await assert.rejects(() => f.api.load(), /disposed|폐기/i);
    assert.throws(() => f.api.consume([], []), /disposed|ready|load|폐기/i);
    assert.throws(() => f.api.update(0, []), /disposed|ready|load|폐기/i);
    assert.equal(fetchCalls, 0, 'injected textures need no fetch/decode/browser');
  });
  report.completed = true;
});
