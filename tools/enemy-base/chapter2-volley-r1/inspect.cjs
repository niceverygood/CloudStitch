/* Official format validation and actual geometry round trip for one owned GLB. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
const rel = file => path.relative(root, file).split(path.sep).join('/');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function main() {
  const file = path.join(root, 'outputs/enemy-base-v1/chapter2-volley-r1/enemy-base.glb');
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  const external = [...(json.buffers || []), ...(json.images || [])].filter(item => item.uri && !item.uri.startsWith('data:'));
  assert.equal(external.length, 0, 'Asset must be self-contained');
  const validator = require('gltf-validator');
  const validation = await validator.validateBytes(new Uint8Array(bytes), {
    maxIssues: 100, externalResourceFunction: async () => { throw Error('External resources are forbidden'); }
  });
  assert.equal(validation.issues.numErrors, 0, 'Official glTF validator errors');
  const THREE = require('three');
  const { GLTFLoader } = await import(pathToFileURL(require.resolve('three/addons/loaders/GLTFLoader.js')).href);
  globalThis.ProgressEvent ??= class { constructor(type, data = {}) { this.type = type; Object.assign(this, data); } };
  // Node has no image decoder. Strip images only in this temporary geometry
  // round-trip copy; official validation below/above still reads full original.
  const geometryBytes = require('../../qa/world-gltf.cjs').geometryOnly(bytes);
  const model = await new GLTFLoader().parseAsync(geometryBytes.buffer.slice(geometryBytes.byteOffset, geometryBytes.byteOffset + geometryBytes.byteLength), '');
  model.scene.updateMatrixWorld(true);
  let meshes = 0, triangles = 0, vertices = 0, vertexColorMeshes = 0, finite = true;
  const names = new Set();
  model.scene.traverse(node => {
    if (node.name) names.add(node.name);
    finite &&= node.matrixWorld.elements.every(Number.isFinite);
    if (!node.isMesh) return;
    meshes++;
    const positions = node.geometry.getAttribute('position');
    triangles += (node.geometry.index?.count ?? positions.count) / 3;
    vertices += positions.count;
    if (node.geometry.getAttribute('color')) vertexColorMeshes++;
    for (let i = 0; i < positions.array.length; i++) finite &&= Number.isFinite(positions.array[i]);
  });
  const box = new THREE.Box3().setFromObject(model.scene);
  assert(!box.isEmpty() && finite && meshes > 0 && triangles > 0);
  const expectedGroups = ['hull', 'buoyancy', 'keep', 'bell_tower', 'bastions', 'dock', 'machinery', 'banners'];
  for (const name of expectedGroups) assert(names.has(name), 'Missing inspectable group: ' + name);
  const reference = path.join(root, 'outputs/enemy-base-v1/chapter2-volley-r1/reference.png');
  assert.equal(hash(fs.readFileSync(reference)), '41d2d5856fe540d2c4cae01fb37507c365f883e93cf89ac622349c908a321192', 'Approved moodboard must be preserved');
  const versions = {};
  for (const dependency of ['three', 'esbuild', 'playwright', 'gltf-validator']) {
    let packageFile;
    try { packageFile = require.resolve(dependency + '/package.json'); }
    catch { packageFile = path.join(path.dirname(require.resolve(dependency)), '../package.json'); }
    const info = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    versions[dependency] = { version: info.version, source: 'existing read-only Node dependency resolved through NODE_PATH or node_modules' };
  }
  const report = {
    asset: rel(file), bytes: bytes.length, sha256: hash(bytes), meshes, triangles, vertices,
    vertexColorMeshes, animations: model.animations.length,
    bounds: { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray() },
    groups: expectedGroups, embedded: true, finite,
    validator: { errors: validation.issues.numErrors, warnings: validation.issues.numWarnings, infos: validation.issues.numInfos, messages: validation.issues.messages },
    reference: { path: rel(reference), sha256: hash(fs.readFileSync(reference)), preserved: true },
    dependencies: versions,
    scope: 'GLB format and geometry check only; no gameplay or engine performance test.', passed: true
  };
  const reportPath = path.join(root, 'outputs/enemy-base-v1/chapter2-volley-r1/structure-verification.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ report: rel(reportPath), triangles, meshes, bytes: bytes.length, errors: report.validator.errors, warnings: report.validator.warnings, infos: report.validator.infos }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
