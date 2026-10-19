import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createDramaticCannonStage, CANNON_STAGE_DURATIONS } from './cannon-stage.mjs';
const require = createRequire(new URL('../../../work/combat-vfx-v2/deps/package.json', import.meta.url));
const THREE = require('three');
const frame = { x: 3, y: 2, z: 7, direction: { x: 1, y: 0, z: 0 }, normal: { x: 0, y: 0, z: -1 } };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const allMeshes = root => { const result = []; root.traverse(n => { if (n.isMesh) result.push(n); }); return result; };
const visible = root => { const result = []; root.traverseVisible(n => { if (n.isMesh && n.material.opacity > .001) result.push(n); }); return result; };
const snapshot = root => { const result = []; root.traverse(n => result.push([n.name, n.visible, n.material?.opacity, ...n.position.toArray(), ...n.quaternion.toArray(), ...n.scale.toArray()])); return result; };
function projectedWidth(root, camera, predicate) {
  root.updateMatrixWorld(true); const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
  let low = Infinity, high = -Infinity; const p = new THREE.Vector3();
  for (const mesh of visible(root).filter(predicate)) { const vertices = mesh.geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld); const v = p.dot(axis); low = Math.min(low, v); high = Math.max(high, v); }
  } return high - low;
}

test('absolute stage evaluates reversible phases, original world contact basis and bounded layered geometry', () => {
  const atlas = new THREE.Texture(), camera = new THREE.PerspectiveCamera(); camera.position.set(7, 8, 13);
  const value = createDramaticCannonStage(THREE, { atlas, camera });
  value.evaluate('hit', .19, frame); assert.equal(value.debug().phase, 'filled-pressure-hold'); assert.equal(value.debug().meshCount, 57); assert.equal(value.debug().highDensityMainMeshes, 7);
  assert.deepEqual(value.root.position.toArray(), [3, 2, 7]);
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(value.root.quaternion); near(axis.z, -1); near(axis.y, 0);
  const first = snapshot(value.root); value.evaluate('hit', .8, frame); assert.equal(value.debug().phase, 'dense-rolling-smoke');
  value.evaluate('hit', .19, frame); assert.deepEqual(snapshot(value.root), first);
  value.evaluate('hit', .02, frame); assert.equal(value.debug().phase, 'compressed-contact');
  value.evaluate('hit', 1.5, frame); assert.equal(value.debug().phase, 'embers');
  for (const n of allMeshes(value.root)) {
    assert.equal(n.material.depthTest, true); assert.equal(n.material.depthWrite, false);
    assert.deepEqual(n.material.userData.outlineParameters, { visible: false, keepAlive: true });
  }
  value.evaluate('muzzle', .10, frame); assert.equal(value.debug().phase, 'heavy-brush-release');
  const flight = new THREE.Vector3(0, 0, 1).applyQuaternion(value.root.quaternion); near(flight.x, 1);
  value.dispose(); atlas.dispose();
});

test('all durations end exactly, reset has no residual transforms and caller atlas is never mutated/disposed', () => {
  assert.deepEqual(CANNON_STAGE_DURATIONS, { muzzle: .95, hit: 1.60 });
  const atlas = new THREE.Texture(); let disposed = 0; atlas.addEventListener('dispose', () => disposed++);
  const uv = [...atlas.repeat.toArray(), ...atlas.offset.toArray()], value = createDramaticCannonStage(THREE, { atlas });
  let geometryDisposals = 0, materialDisposals = 0;
  for (const mesh of allMeshes(value.root)) { mesh.geometry.addEventListener('dispose', () => geometryDisposals++); mesh.material.addEventListener('dispose', () => materialDisposals++); }
  for (const kind of ['muzzle', 'hit']) {
    value.evaluate(kind, CANNON_STAGE_DURATIONS[kind] - .001, frame); assert.equal(value.root.visible, true);
    value.evaluate(kind, CANNON_STAGE_DURATIONS[kind], frame); assert.equal(value.root.visible, false); assert.equal(value.debug().visibleMeshes, 0);
  }
  value.reset(); assert.deepEqual(value.root.position.toArray(), [0, 0, 0]); assert.equal(value.debug().phase, 'idle');
  assert.deepEqual([...atlas.repeat.toArray(), ...atlas.offset.toArray()], uv);
  value.dispose(); value.dispose(); assert.equal(disposed, 0); assert.equal(value.debug().ownedResources, 0);
  assert.equal(geometryDisposals, 57); assert.equal(materialDisposals, 57);
  assert.throws(() => value.evaluate('hit', .1, frame), /Disposed/); atlas.dispose();
});

test('reduced motion reduces travel without removing contact or creating another event', () => {
  const atlas = new THREE.Texture(), regular = createDramaticCannonStage(THREE, { atlas }), reduced = createDramaticCannonStage(THREE, { atlas, reducedMotion: true });
  regular.evaluate('hit', .45, frame); reduced.evaluate('hit', .45, frame);
  const a = regular.root.getObjectByName('wood-coral-splinter-0'), b = reduced.root.getObjectByName('wood-coral-splinter-0');
  assert.ok(b.position.length() < a.position.length()); assert.equal(regular.debug().meshCount, reduced.debug().meshCount);
  for (let t = 0; t < 1.6; t += .017) { reduced.evaluate('hit', t, frame); for (const n of allMeshes(reduced.root)) assert.ok([...n.position.toArray(), ...n.scale.toArray(), n.material.opacity].every(Number.isFinite)); }
  regular.dispose(); reduced.dispose(); atlas.dispose();
});

test('invalid poses reject, primary filled width is 6–8 units and separate swept wings span 12–14 units', t => {
  const atlas = new THREE.Texture(), camera = new THREE.OrthographicCamera(-15, 15, 10, -10, .1, 100); camera.position.set(9, 12, 15); camera.lookAt(1, 2, 3);
  const value = createDramaticCannonStage(THREE, { atlas, camera });
  assert.throws(() => value.evaluate('hit', .1, { ...frame, normal: { x: 0, y: 0, z: 0 } }), /normal/);
  value.evaluate('hit', .19, frame);
  const primary = projectedWidth(value.root, camera, n => n.userData.filledPaint && n.userData.massClass === 'primary');
  const outer = projectedWidth(value.root, camera, n => n.userData.filledPaint && n.userData.role === 'main');
  assert.ok(primary >= 6 && primary <= 8, `primary filled width ${primary}`); assert.ok(outer >= 12 && outer <= 14, `outer filled wing silhouette ${outer}`);
  value.evaluate('hit', .8, frame); const smokeWidth = projectedWidth(value.root, camera, n => n.userData.filledPaint && n.userData.role === 'smoke');
  assert.ok(smokeWidth >= 8 && smokeWidth <= 10, `dense smoke width ${smokeWidth}`);
  t.diagnostic(JSON.stringify({ primaryFilledWidthLU: primary, outerPressureWingWidthLU: outer, smokeWidthAt08LU: smokeWidth, simulationShipLengthLU: 10 }));
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
    for (const [kind, time] of [['hit', .19], ['hit', .8], ['muzzle', .10]]) {
      stage.evaluate(kind, time, { ...frame, x: origin[0], y: origin[1], z: origin[2], normal }); stage.root.updateMatrixWorld(true);
      for (const mesh of visible(stage.root)) {
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

test('primary domes and smoke have high-density filled vertex color while wood chips are polygon material bits', () => {
  const atlas = new THREE.Texture(), value = createDramaticCannonStage(THREE, { atlas }); value.evaluate('hit', .19, frame);
  const main = visible(value.root).filter(n => n.userData.filledPaint && n.userData.role === 'main'); assert.equal(main.length, 7);
  for (const mesh of main) { assert.equal(mesh.material.map, null); assert.equal(mesh.material.vertexColors, true); assert.ok(mesh.material.opacity >= .9); assert.ok(mesh.geometry.getAttribute('color').count > 6); }
  const dome = value.root.getObjectByName('filled-main-billow-0-fill'), position = dome.geometry.getAttribute('position'), colors = dome.geometry.getAttribute('color');
  assert.ok(position.count >= 48 * 4); assert.ok(Math.max(...Array.from({ length: position.count }, (_, i) => position.getZ(i))) > .1);
  let filledArea = 0; const indices = dome.geometry.index;
  for (let i = 0; i < indices.count; i += 3) {
    const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2);
    filledArea += Math.abs((position.getX(b) - position.getX(a)) * (position.getY(c) - position.getY(a)) - (position.getY(b) - position.getY(a)) * (position.getX(c) - position.getX(a))) * .5;
  }
  assert.ok(filledArea > .70 && filledArea < .9, `continuous filled painted dome area ${filledArea}`);
  assert.ok(new Set(Array.from({ length: colors.count }, (_, i) => colors.getX(i).toFixed(2) + colors.getY(i).toFixed(2))).size > 20);
  value.evaluate('hit', .8, frame); const smoke = visible(value.root).filter(n => n.userData.filledPaint && n.userData.role === 'smoke'); assert.equal(smoke.length, 5); assert.ok(smoke.every(n => !n.material.map && n.material.opacity > .7));
  const wood = allMeshes(value.root).filter(n => n.userData.filledPaint && n.userData.role === 'splinter'); assert.equal(wood.length, 10); assert.ok(wood.every(n => !n.material.map && n.geometry.getAttribute('position').count === 7));
  value.dispose(); atlas.dispose();
});
