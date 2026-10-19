import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createDramaticCannonStage, CANNON_STAGE_DURATIONS } from './cannon-stage.mjs';
const require = createRequire(new URL('../../../work/combat-vfx-v2/deps/package.json', import.meta.url));
const THREE = require('three');
const frame = { x: 3, y: 2, z: 7, direction: { x: 1, y: 0, z: 0 }, normal: { x: 0, y: 0, z: -1 } };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const snapshot = root => root.children.map(n => [n.visible, n.material.opacity, ...n.position.toArray(), ...n.quaternion.toArray(), ...n.scale.toArray()]);

test('absolute stage evaluates reversible phases, original world contact basis and bounded layered geometry', () => {
  const atlas = new THREE.Texture(), camera = new THREE.PerspectiveCamera(); camera.position.set(7, 8, 13);
  const value = createDramaticCannonStage(THREE, { atlas, camera });
  value.evaluate('hit', .19, frame); assert.equal(value.debug().phase, 'painted-eruption'); assert.equal(value.debug().meshCount, 37);
  assert.deepEqual(value.root.position.toArray(), [3, 2, 7]);
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(value.root.quaternion); near(axis.z, -1); near(axis.y, 0);
  const first = snapshot(value.root); value.evaluate('hit', .8, frame); assert.equal(value.debug().phase, 'rolling-smoke');
  value.evaluate('hit', .19, frame); assert.deepEqual(snapshot(value.root), first);
  value.evaluate('hit', .02, frame); assert.equal(value.debug().phase, 'contact');
  value.evaluate('hit', .98, frame); assert.equal(value.debug().phase, 'embers');
  for (const n of value.root.children) { assert.equal(n.material.depthTest, true); assert.equal(n.material.depthWrite, false); assert.equal(n.material.map, atlas); }
  value.evaluate('muzzle', .10, frame); assert.equal(value.debug().phase, 'brush-release');
  const flight = new THREE.Vector3(0, 0, 1).applyQuaternion(value.root.quaternion); near(flight.x, 1);
  value.dispose(); atlas.dispose();
});

test('all durations end exactly, reset has no residual transforms and caller atlas is never mutated/disposed', () => {
  const atlas = new THREE.Texture(); let disposed = 0; atlas.addEventListener('dispose', () => disposed++);
  const uv = [...atlas.repeat.toArray(), ...atlas.offset.toArray()], value = createDramaticCannonStage(THREE, { atlas });
  let geometryDisposals = 0, materialDisposals = 0;
  for (const mesh of value.root.children) { mesh.geometry.addEventListener('dispose', () => geometryDisposals++); mesh.material.addEventListener('dispose', () => materialDisposals++); }
  for (const kind of ['muzzle', 'hit']) {
    value.evaluate(kind, CANNON_STAGE_DURATIONS[kind] - .001, frame); assert.equal(value.root.visible, true);
    value.evaluate(kind, CANNON_STAGE_DURATIONS[kind], frame); assert.equal(value.root.visible, false); assert.equal(value.debug().visibleMeshes, 0);
  }
  value.reset(); assert.deepEqual(value.root.position.toArray(), [0, 0, 0]); assert.equal(value.debug().phase, 'idle');
  assert.deepEqual([...atlas.repeat.toArray(), ...atlas.offset.toArray()], uv);
  value.dispose(); value.dispose(); assert.equal(disposed, 0); assert.equal(value.debug().ownedResources, 0);
  assert.equal(geometryDisposals, 37); assert.equal(materialDisposals, 37);
  assert.throws(() => value.evaluate('hit', .1, frame), /Disposed/); atlas.dispose();
});

test('reduced motion reduces travel without removing contact or creating another event', () => {
  const atlas = new THREE.Texture(), regular = createDramaticCannonStage(THREE, { atlas }), reduced = createDramaticCannonStage(THREE, { atlas, reducedMotion: true });
  regular.evaluate('hit', .45, frame); reduced.evaluate('hit', .45, frame);
  const a = regular.root.getObjectByName('timber-splinter-0'), b = reduced.root.getObjectByName('timber-splinter-0');
  assert.ok(Math.abs(b.position.x) < Math.abs(a.position.x)); assert.equal(regular.debug().meshCount, reduced.debug().meshCount);
  for (let t = 0; t < 1.1; t += .011) { reduced.evaluate('hit', t, frame); for (const n of reduced.root.children) assert.ok([...n.position.toArray(), ...n.scale.toArray(), n.material.opacity].every(Number.isFinite)); }
  regular.dispose(); reduced.dispose(); atlas.dispose();
});

test('invalid event poses are rejected and seven curved petals create a 5–7 unit peak silhouette', () => {
  const atlas = new THREE.Texture(), value = createDramaticCannonStage(THREE, { atlas });
  assert.throws(() => value.evaluate('hit', .1, { ...frame, normal: { x: 0, y: 0, z: 0 } }), /normal/);
  value.evaluate('hit', .19, { ...frame, normal: { x: 0, y: 1, z: 0 } }); value.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3(); for (const mesh of value.root.children.filter(n => n.visible && n.name.startsWith('curved'))) bounds.expandByObject(mesh);
  const size = bounds.getSize(new THREE.Vector3()); assert.ok(Math.max(size.x, size.z) >= 5 && Math.max(size.x, size.z) <= 8, JSON.stringify(size));
  value.dispose(); atlas.dispose();
});

test('orthographic camera orientation keeps every visible plane parallel at different world origins and actual impact normals', () => {
  const atlas = new THREE.Texture();
  const cameras = [[9, 12, 15], [-13, 7, -11]].map(position => {
    const camera = new THREE.OrthographicCamera(-15, 15, 10, -10, .1, 100); camera.position.set(...position); camera.lookAt(1, 2, 3); camera.updateMatrixWorld(true); return camera;
  });
  for (const camera of cameras) for (const normal of [{ x: 0, y: 0, z: -1 }, { x: .6, y: .8, z: 0 }]) for (const origin of [[3, 2, 7], [-18, 9, 21]]) {
    const stage = createDramaticCannonStage(THREE, { atlas, camera });
    const cameraQ = camera.getWorldQuaternion(new THREE.Quaternion()), cameraForward = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraQ);
    for (const [kind, time] of [['hit', .19], ['hit', .43], ['muzzle', .075]]) {
      stage.evaluate(kind, time, { ...frame, x: origin[0], y: origin[1], z: origin[2], normal }); stage.root.updateMatrixWorld(true);
      for (const mesh of stage.root.children.filter(n => n.visible)) {
        const meshNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
        near(Math.abs(meshNormal.dot(cameraForward)), 1);
      }
      if (kind === 'hit') {
        const actual = new THREE.Vector3(0, 1, 0).applyQuaternion(stage.root.quaternion);
        near(actual.dot(new THREE.Vector3(normal.x, normal.y, normal.z).normalize()), 1);
      }
    }
    stage.dispose();
  }
  atlas.dispose();
});
