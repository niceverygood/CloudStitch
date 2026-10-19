import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as THREE from 'three';
import { makeWorldKit } from './environment-source/core.mjs';
import * as sky from './environment-source/sky.mjs';
import { createEnvironmentModelLibrary } from './environment-models.js';

const meshList = (group) => {
  const meshes = [];
  group.traverse((node) => { if (node.isMesh) meshes.push(node); });
  return meshes;
};

function close(actual, expected, message, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} versus ${expected}`);
}

function worldTransforms(group) {
  group.updateMatrixWorld(true);
  return meshList(group).flatMap((mesh) => mesh.matrixWorld.toArray());
}

function sameTransforms(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) close(actual[i], expected[i], `matrix component ${i}`, 1e-10);
}

describe('flight scenery adapters: three representative recipe kinds only', { concurrency: false }, () => {
  let library, cloud, mail, tree;
  const clones = [];
  before(() => {
    library = createEnvironmentModelLibrary();
    cloud = library.create('sunlit-cloud', { flatten: true });
    mail = library.create('mail-balloon');
    tree = library.create('wind-tree');
  });
  after(() => library?.dispose());

  it('normalizes the initial pose to center zero and unit longest extent', () => {
    for (const instance of [cloud, mail, tree]) {
      instance.group.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(instance.group);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      for (const axis of ['x', 'y', 'z']) close(center[axis], 0, `${instance.sourceId} center ${axis}`);
      close(Math.max(size.x, size.y, size.z), 1, `${instance.sourceId} normalized extent`);
      assert.ok(instance.maxExtent > 1);
      assert.deepEqual(instance.group.position.toArray(), [0, 0, 0]);
      assert.deepEqual(instance.group.scale.toArray(), [1, 1, 1]);
    }
  });

  it('reduces draw meshes and preserves finite positions, normals and original vertex colors', () => {
    assert.equal(cloud.renderMeshes, 1);
    assert.equal(meshList(cloud.group).length, 1);
    for (const instance of [cloud, mail, tree]) {
      const meshes = meshList(instance.group);
      assert.equal(meshes.length, instance.renderMeshes);
      assert.ok(instance.renderMeshes < instance.sourceMeshes, `${instance.sourceId} mesh reduction`);
      let triangles = 0;
      for (const mesh of meshes) {
        assert.deepEqual(Object.keys(mesh.geometry.attributes).sort(), ['color', 'normal', 'position']);
        const count = mesh.geometry.getAttribute('position').count;
        triangles += (mesh.geometry.index?.count ?? count) / 3;
        for (const name of ['position', 'normal', 'color']) {
          const attribute = mesh.geometry.getAttribute(name);
          assert.equal(attribute.count, count);
          assert.equal(attribute.itemSize, 3);
          assert.ok(attribute.array.every(Number.isFinite), `${instance.sourceId} ${name} must be finite`);
        }
        assert.equal(mesh.material.isMeshBasicMaterial, true);
        assert.equal(mesh.material.vertexColors, true);
        assert.equal(mesh.material.fog, true);
      }
      assert.equal(triangles, instance.triangles);
    }

    // Independently read the same one cloud recipe to ensure batching did not
    // replace its painted color data with a uniform tint or recomputed lighting.
    const kit = makeWorldKit(sky.assets.find((asset) => asset.id === 'sunlit-cloud'));
    const geometries = new Set(), materials = new Set(), expected = [];
    try {
      sky.build(sky.assets.find((asset) => asset.id === 'sunlit-cloud'), kit);
      kit.root.traverse((node) => {
        if (!node.isMesh) return;
        geometries.add(node.geometry);
        for (const material of [node.material].flat()) materials.add(material);
        assert.equal(node.geometry.index, null);
        expected.push(...node.geometry.getAttribute('color').array);
      });
      const actual = meshList(cloud.group)[0].geometry.getAttribute('color').array;
      const reference = new Float32Array(expected);
      assert.equal(actual.length, reference.length);
      const actualBytes = Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength);
      const expectedBytes = Buffer.from(reference.buffer, reference.byteOffset, reference.byteLength);
      assert.equal(Buffer.compare(actualBytes, expectedBytes), 0, 'original painted colors remain byte-identical');
    } finally {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      kit.root.clear();
    }
  });

  it('reuses the kind cache and shares geometry while instance transforms remain independent', () => {
    const beforeStats = library.stats();
    const cloudClone = library.create('sunlit-cloud', { flatten: true });
    const mailClone = library.create('mail-balloon');
    clones.push(cloudClone, mailClone);
    assert.equal(library.stats().prototypeCount, 3);
    assert.equal(library.stats().sourceMeshes, beforeStats.sourceMeshes);
    for (const [original, clone] of [[cloud, cloudClone], [mail, mailClone]]) {
      const a = meshList(original.group), b = meshList(clone.group);
      assert.notEqual(original.group, clone.group);
      assert.equal(a.length, b.length);
      for (let i = 0; i < a.length; i++) {
        assert.notEqual(a[i], b[i]);
        assert.equal(a[i].geometry, b[i].geometry);
        assert.equal(a[i].material, b[i].material);
      }
      clone.group.position.set(7, 8, 9);
      clone.group.scale.setScalar(3);
      assert.deepEqual(original.group.position.toArray(), [0, 0, 0]);
      assert.deepEqual(original.group.scale.toArray(), [1, 1, 1]);
    }
    const originalMail = worldTransforms(mail.group);
    mailClone.update(1);
    sameTransforms(worldTransforms(mail.group), originalMail);
  });

  it('keeps authored articulated motion and evaluates repeated absolute times deterministically', () => {
    for (const instance of [mail, tree]) {
      instance.update(0);
      const zero = worldTransforms(instance.group);
      instance.update(1);
      const one = worldTransforms(instance.group);
      assert.ok(one.some((value, i) => Math.abs(value - zero[i]) > 1e-6), `${instance.sourceId} geometry moves with its authored clip`);
      instance.update(1);
      sameTransforms(worldTransforms(instance.group), one);
      instance.update(0);
      sameTransforms(worldTransforms(instance.group), zero);
      instance.update(1);
      sameTransforms(worldTransforms(instance.group), one);
      assert.throws(() => instance.update(Number.NaN), /finite/);
      instance.update(0);
    }
  });

  it('disposes shared resources once and rejects creation after library disposal', () => {
    const resources = new Set();
    for (const instance of [cloud, mail, tree, ...clones]) {
      for (const mesh of meshList(instance.group)) {
        resources.add(mesh.geometry);
        resources.add(mesh.material);
      }
    }
    const disposeCounts = new Map();
    for (const resource of resources) {
      disposeCounts.set(resource, 0);
      resource.addEventListener('dispose', () => disposeCounts.set(resource, disposeCounts.get(resource) + 1));
    }
    library.dispose();
    library.dispose();
    for (const count of disposeCounts.values()) assert.equal(count, 1);
    assert.equal(library.stats().disposed, true);
    assert.equal(library.stats().prototypeCount, 0);
    assert.equal(library.stats().mergedGeometries, 0);
    assert.equal(library.stats().instanceCount, 0);
    assert.throws(() => library.create('sunlit-cloud'), /disposed/);
    assert.doesNotThrow(() => mail.update(5));
  });
});
