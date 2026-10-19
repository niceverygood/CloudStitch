/* Geometry and deterministic motion checks against the actual selected GLB.
 * No renderer, network, texture decoder, or browser is used by this check. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const THREE = require('three');
const esbuild = require('esbuild');
const ROOT = path.resolve(__dirname, '../../..');
const SOURCE = 'outputs/selected-airship-toon3d/airship.glb';
const OUTPUT = 'outputs/ship-states-v1/imagination-v3/source-verification.json';
const STAGES = { normal: 3, damage: 4, weapons: 5, armor: 5, growth: 30, explosion: 5 };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const finite = (values, label) => { for (const n of values) assert(Number.isFinite(n), `${label}: non-finite value`); };

function parseGLB(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB declared byte length');
  let json, bin;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) json = JSON.parse(bytes.subarray(offset + 8, offset + 8 + length).toString('utf8'));
    if (type === 0x004e4942) bin = bytes.subarray(offset + 8, offset + 8 + length);
    offset += length + 8;
  }
  assert(json && bin, 'GLB JSON and BIN chunks');
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const types = {
    5120: { bytes: 1, read: 'readInt8', array: Int8Array },
    5121: { bytes: 1, read: 'readUInt8', array: Uint8Array },
    5122: { bytes: 2, read: 'readInt16LE', array: Int16Array },
    5123: { bytes: 2, read: 'readUInt16LE', array: Uint16Array },
    5125: { bytes: 4, read: 'readUInt32LE', array: Uint32Array },
    5126: { bytes: 4, read: 'readFloatLE', array: Float32Array },
  };
  function accessor(index) {
    const spec = json.accessors[index], view = json.bufferViews[spec.bufferView];
    assert(!spec.sparse && view, 'Only actual dense source accessors are supported');
    const type = types[spec.componentType], itemSize = components[spec.type];
    assert(type && itemSize, 'Accessor component/type supported');
    const values = new type.array(spec.count * itemSize);
    const stride = view.byteStride || itemSize * type.bytes;
    const start = (view.byteOffset || 0) + (spec.byteOffset || 0);
    for (let i = 0; i < spec.count; i++) for (let c = 0; c < itemSize; c++) {
      values[i * itemSize + c] = bin[type.read](start + i * stride + c * type.bytes);
    }
    return new THREE.BufferAttribute(values, itemSize, Boolean(spec.normalized));
  }
  function makeMesh(index) {
    const definition = json.meshes[index];
    const group = new THREE.Group(); group.name = definition.name || `mesh-${index}`;
    for (const primitive of definition.primitives) {
      assert([undefined, 4].includes(primitive.mode), 'Triangle primitive required');
      const geometry = new THREE.BufferGeometry();
      for (const [semantic, attribute] of Object.entries({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' })) {
        if (primitive.attributes[semantic] !== undefined) geometry.setAttribute(attribute, accessor(primitive.attributes[semantic]));
      }
      assert(primitive.indices !== undefined, 'Actual indexed source required');
      geometry.setIndex(accessor(primitive.indices));
      group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff })));
    }
    return group;
  }
  const nodes = json.nodes.map((node, index) => {
    const object = node.mesh !== undefined ? makeMesh(node.mesh) : new THREE.Group();
    object.name = node.name || `node-${index}`;
    if (node.matrix) new THREE.Matrix4().fromArray(node.matrix).decompose(object.position, object.quaternion, object.scale);
    else {
      if (node.translation) object.position.fromArray(node.translation);
      if (node.rotation) object.quaternion.fromArray(node.rotation);
      if (node.scale) object.scale.fromArray(node.scale);
    }
    return object;
  });
  json.nodes.forEach((node, index) => (node.children || []).forEach(child => nodes[index].add(nodes[child])));
  const scene = new THREE.Scene();
  for (const index of json.scenes[json.scene || 0].nodes) scene.add(nodes[index]);
  scene.updateMatrixWorld(true);
  return { scene, json };
}

function snapshot(variant, time) {
  variant.update(time); variant.root.updateMatrixWorld(true);
  const values = [], flags = [], names = [];
  variant.root.traverse(object => {
    names.push(object.name); finite(object.matrixWorld.elements, object.name);
    values.push(...object.matrixWorld.elements); flags.push(object.visible);
    if (object.isMesh) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        assert(Number.isFinite(material.opacity), 'Finite material opacity');
        values.push(material.opacity); flags.push(material.transparent, material.depthWrite, material.visible);
      }
    }
  });
  return { values, flags, names };
}
function same(a, b, label) {
  assert.deepEqual(a.names, b.names, `${label}: nodes`);
  assert.deepEqual(a.flags, b.flags, `${label}: visibility/transparency/depth state`);
  assert.equal(a.values.length, b.values.length, `${label}: snapshot length`);
  let maximum = 0;
  for (let i = 0; i < a.values.length; i++) maximum = Math.max(maximum, Math.abs(a.values[i] - b.values[i]));
  assert(maximum <= 1e-10, `${label}: matrix/opacity difference ${maximum}`);
  return maximum;
}

async function main() {
  const bytes = fs.readFileSync(path.join(ROOT, SOURCE));
  const partMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/airship-rig/part-map.json'), 'utf8'));
  assert.equal(sha(bytes), partMap.sourceSha256, 'Actual source hash matches authored part map');
  const gltf = parseGLB(bytes);
  let originalTriangles = 0, originalMeshCount = 0;
  gltf.scene.traverse(object => { if (object.isMesh) { originalMeshCount++; originalTriangles += object.geometry.index.count / 3; } });
  assert.equal(originalMeshCount, 1); assert.equal(originalTriangles, 11026);
  const bundle = await esbuild.build({ entryPoints: [path.join(__dirname, 'variants.js')], bundle: true, write: false, format: 'cjs', platform: 'node', external: ['three'] });
  const moduleObject = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, { module: moduleObject, exports: moduleObject.exports, require, console }, { filename: 'ship-states-variants-bundle.cjs' });
  const library = moduleObject.exports.createVariantLibrary(gltf);
  assert.equal(library.sourceTriangles, 11026);
  const report = { title: 'Cloudstitch', passed: false, source: { path: SOURCE, bytes: bytes.length, sha256: sha(bytes), triangles: originalTriangles, meshCount: originalMeshCount }, checks: { browser: false, texturesDecoded: false, actualIndexedSourceGeometry: true, nodeTransformsApplied: true, finiteGeometryAndMatrices: true, loopTolerance: 1e-10 }, stages: [], growth: [], explosionSamples: [0, .75, 1.6, 3.2, 5.3, 6], totalStages: 0, loopChecks: 0, explosionRepeatChecks: 0 };
  let previousGrowth;
  for (const [category, count] of Object.entries(STAGES)) for (let stage = 0; stage < count; stage++) {
    const variant = library.create(category, stage);
    assert.equal(variant.counts.sourceTriangles, 11026, `${category}/${stage}: source triangles`);
    variant.root.traverse(object => {
      if (!object.isMesh) return;
      for (const [name, attribute] of Object.entries(object.geometry.attributes)) finite(attribute.array, `${category}/${stage}/${name}`);
      if (object.geometry.index) finite(object.geometry.index.array, `${category}/${stage}/indices`);
    });
    snapshot(variant, 0);
    if (category === 'growth') {
      assert(variant.root.scale.equals(new THREE.Vector3(1, 1, 1)), 'Growth must add modules, not enlarge root uniformly');
      const metrics = { level: stage + 1, meshes: variant.counts.meshes, addonMeshes: variant.counts.addonMeshes, triangles: variant.counts.triangles };
      if (previousGrowth) {
        // Static surfaces are merged; triangle and module increments carry growth.
        assert(metrics.triangles > previousGrowth.triangles, 'Each growth level adds geometry');
      }
      previousGrowth = metrics; report.growth.push(metrics);
    }
    if (category === 'explosion') {
      const references = new Map(report.explosionSamples.map(time => [time, snapshot(variant, time)]));
      for (const time of [6, 0, 3.2, .75, 5.3, 1.6, 0, 6, .75, 3.2, 1.6, 5.3]) {
        same(references.get(time), snapshot(variant, time), `Explosion stage ${stage}, absolute time ${time}`); report.explosionRepeatChecks++;
      }
    } else {
      const start = snapshot(variant, 0); snapshot(variant, 2.25);
      same(start, snapshot(variant, 6), `${category}/${stage} six-second loop`); report.loopChecks++;
    }
    report.stages.push({ category, stage, ...variant.counts, passed: true }); report.totalStages++;
    variant.dispose();
  }
  library.dispose(); assert.equal(report.totalStages, 52);
  assert.equal(sha(fs.readFileSync(path.join(ROOT, SOURCE))), report.source.sha256, 'Source remains unchanged');
  report.passed = true; report.checks.sourcePreserved = true;
  report.limitations = ['No browser/render, texture decoding, outline/ghosting, mobile or real gameplay checks.'];
  fs.mkdirSync(path.dirname(path.join(ROOT, OUTPUT)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, OUTPUT), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, stages: report.totalStages, sourceTriangles: 11026, loopChecks: report.loopChecks, explosionRepeatChecks: report.explosionRepeatChecks, growthLevels: report.growth.length, output: OUTPUT }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
