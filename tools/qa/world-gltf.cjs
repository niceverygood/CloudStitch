/* Real-file geometry/format checks shared by the world generator and its CLI QA. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { repoRoot, repoPath } = require('../lib/paths.cjs');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function parseGLB(bytes) {
  if (bytes.length < 28 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Expected complete binary glTF 2.0 bytes.');
  let json, bin = Buffer.alloc(0), offset = 12;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4); offset += 8;
    if (offset + length > bytes.length) throw new Error('GLB chunk exceeds its file.');
    if (type === 0x4e4f534a) json = JSON.parse(bytes.subarray(offset, offset + length).toString('utf8'));
    else if (type === 0x004e4942) bin = bytes.subarray(offset, offset + length);
    offset += length;
  }
  if (!json || offset !== bytes.length) throw new Error('Invalid GLB chunks.');
  if ([...(json.buffers || []), ...(json.images || [])].some(resource => resource.uri && !resource.uri.startsWith('data:'))) throw new Error('World GLBs must embed every image and buffer.');
  return { json, bin };
}
function makeGLB(json, bin) {
  const raw = Buffer.from(JSON.stringify(json)), j = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]), b = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
  const h = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8); h.writeUInt32LE(0x46546c67); h.writeUInt32LE(2, 4); h.writeUInt32LE(28 + j.length + b.length, 8); jh.writeUInt32LE(j.length); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(b.length); bh.writeUInt32LE(0x004e4942, 4); return Buffer.concat([h, jh, j, bh, b]);
}
function geometryOnly(bytes) {
  const { json, bin } = parseGLB(bytes);
  json.materials = [{ name: 'Node geometry-check material only', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] }, extensions: { KHR_materials_unlit: {} } }];
  for (const mesh of json.meshes || []) for (const primitive of mesh.primitives) primitive.material = 0;
  delete json.textures; delete json.images; delete json.samplers;
  json.extensionsUsed = (json.extensionsUsed || []).filter(name => !/texture|materials_/i.test(name)); json.extensionsUsed.push('KHR_materials_unlit');
  if (json.extensionsRequired) json.extensionsRequired = json.extensionsRequired.filter(name => !/texture|materials_/i.test(name));
  return makeGLB(json, bin);
}
function imageSize(bytes, mime) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes[0] === 255 && bytes[1] === 216) {
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 255) { offset++; continue; }
      const marker = bytes[offset + 1]; if ([216, 217].includes(marker)) { offset += 2; continue; }
      const length = bytes.readUInt16BE(offset + 2); if (length < 2) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      offset += 2 + length;
    }
  }
  return { width: null, height: null, mime: mime || 'unknown' };
}
function inspectGLB(bytes) {
  const { json, bin } = parseGLB(bytes); let triangles = 0, primitiveCount = 0, colored = 0;
  for (const mesh of json.meshes || []) for (const primitive of mesh.primitives) {
    if ((primitive.mode ?? 4) !== 4) throw new Error('Expected triangle meshes.');
    const count = json.accessors[primitive.indices ?? primitive.attributes.POSITION]?.count;
    if (!Number.isInteger(count) || count % 3) throw new Error('Invalid triangle index/vertex count.');
    triangles += count / 3; primitiveCount++; if (primitive.attributes.COLOR_0 !== undefined) colored++;
  }
  if (!triangles) throw new Error('GLB has no actual triangles.');
  const textures = (json.images || []).map(image => {
    const view = json.bufferViews?.[image.bufferView];
    const data = view ? bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength) : image.uri?.startsWith('data:') ? Buffer.from(image.uri.split(',')[1], 'base64') : Buffer.alloc(0);
    return { ...imageSize(data, image.mimeType), embedded: Boolean(view || image.uri?.startsWith('data:')) };
  });
  return { triangles, mesh_count: (json.meshes || []).length, primitive_count: primitiveCount, node_count: (json.nodes || []).length, material_count: (json.materials || []).length, texture_count: (json.textures || []).length, textures, vertex_color_primitive_count: colored, vertex_colors: colored === primitiveCount, animation_count: (json.animations || []).length, bytes: bytes.length, sha256: sha256(bytes) };
}
let validator;
function getValidator() {
  if (validator) return validator;
  for (const name of ['gltf-validator', path.join(repoRoot, 'work/vfx-validation/node_modules/gltf-validator')]) {
    try { validator = require(name); return validator; } catch {}
  }
  throw new Error('gltf-validator is required. Install it locally or restore work/vfx-validation/node_modules/gltf-validator.');
}
async function verifyGLB(bytes, options = {}) {
  const stats = inspectGLB(bytes);
  const [{ GLTFLoader }, THREE] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three')]);
  globalThis.ProgressEvent ??= class { constructor(type, data = {}) { this.type = type; Object.assign(this, data); } };
  const copy = geometryOnly(bytes), gltf = await new GLTFLoader().parseAsync(copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength), '');
  gltf.scene.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(gltf.scene); if (box.isEmpty()) throw new Error('Actual GLTFLoader loaded no geometry.');
  const values = [...box.min.toArray(), ...box.max.toArray()]; let finite = values.every(Number.isFinite), loadedMeshes = 0, loadedTriangles = 0;
  gltf.scene.traverse(node => { finite &&= node.matrixWorld.elements.every(Number.isFinite); if (node.isMesh) { loadedMeshes++; loadedTriangles += (node.geometry.index?.count || node.geometry.attributes.position?.count || 0) / 3; } });
  if (!finite) throw new Error('Nonfinite GLB geometry or transforms.');
  const validated = await getValidator().validateBytes(new Uint8Array(bytes), { maxIssues: 0, externalResourceFunction: async () => { throw new Error('No external resources permitted.'); } });
  const standard = { errors: validated.issues.numErrors, warnings: validated.issues.numWarnings, infos: validated.issues.numInfos, messages: validated.issues.messages };
  if (options.requireStatic && stats.animation_count !== 0) throw new Error('Local static assets must have animation_count 0.');
  const verification = { GLTFLoader_geometry_roundtrip: true, geometry_only_check_did_not_modify_source: true, loaded_meshes: loadedMeshes, finite_transforms_and_bounds: finite, bounds: { min: box.min.toArray(), max: box.max.toArray() }, standard_validator: standard, passed: standard.errors === 0 };
  return { ...stats, triangles: Math.round(loadedTriangles), mesh_count: loadedMeshes, mesh_definition_count: stats.mesh_count, unique_geometry_triangles: stats.triangles, verification, standard_validator: standard };
}
async function main() {
  const catalogFile = repoPath(process.argv[2] || 'outputs/world-assets/catalog.json'), reportDir = repoPath(process.argv[3] || 'work/verification/world-gltf'); fs.mkdirSync(reportDir, { recursive: true });
  const sceneFile = repoPath(process.argv[4] || 'outputs/world-assets/scene-catalog.json');
  const catalogs = [catalogFile, ...(fs.existsSync(sceneFile) ? [sceneFile] : [])], results = [], missing = [];
  for (const file of catalogs) for (const item of JSON.parse(fs.readFileSync(file, 'utf8')).items) {
    const model = item.model && path.resolve(path.dirname(file), item.model);
    if (!model || !fs.existsSync(model)) { missing.push(item.id); continue; }
    const bytes = fs.readFileSync(model), result = await verifyGLB(bytes, { requireStatic: item.build_method === 'local_mesh' || item.build_method === 'reuse_assembly' });
    if (item.sha256 && item.sha256 !== result.sha256) throw new Error('Catalog SHA-256 mismatch: ' + item.id);
    if (item.source_model && item.source_sha256 && sha256(fs.readFileSync(path.resolve(path.dirname(file), item.source_model))) !== item.source_sha256) throw new Error('Preserved original source SHA-256 mismatch: ' + item.id);
    const manifest = item.manifest && path.resolve(path.dirname(file), item.manifest);
    if (manifest && fs.existsSync(manifest)) {
      const record = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (record.sha256 !== result.sha256) throw new Error('Manifest SHA-256 mismatch: ' + item.id);
      for (const source of record.source_assets || []) if (source.model && sha256(fs.readFileSync(path.resolve(path.dirname(file), source.model))) !== source.sha256) throw new Error('Scene original source SHA-256 mismatch: ' + item.id + '/' + source.asset_id);
      if (record.selected_airship_source_sha256 && record.selected_airship_copy_zero_normals_repaired !== 2) throw new Error('Selected airship scene must record exactly two copy-only zero-normal repairs.');
    }
    results.push({ id: item.id, model: path.relative(repoRoot, model).split(path.sep).join('/'), ...result });
    console.log(JSON.stringify({ id: item.id, triangles: result.triangles, animation_count: result.animation_count, errors: result.standard_validator.errors, warnings: result.standard_validator.warnings }));
  }
  const summary = { checked: results.length, missing, results, errors: results.reduce((sum, item) => sum + item.standard_validator.errors, 0), warnings: results.reduce((sum, item) => sum + item.standard_validator.warnings, 0), passed: !missing.length && results.every(item => item.verification.passed) };
  fs.writeFileSync(path.join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n'); console.log(JSON.stringify({ checked: summary.checked, missing, errors: summary.errors, warnings: summary.warnings, passed: summary.passed })); if (!summary.passed) process.exitCode = 1;
}
module.exports = { sha256, parseGLB, makeGLB, geometryOnly, inspectGLB, verifyGLB };
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
