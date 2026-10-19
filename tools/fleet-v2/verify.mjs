import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CLIPS = ['FloatIdle', 'Cruise', 'BankTurn', 'GustRecovery', 'TurretScan', 'WinchCycle', 'FireBurst'];
const EXCLUDED = ['design-a1', 'design-a2', 'design-a3', 'design-b1', 'design-b2', 'design-b3', 'design-c1', 'design-c2', 'design-c3'];
const COMPONENTS = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const digest = data => createHash('sha256').update(data).digest('hex');
const stable = value => JSON.stringify(value, (_, entry) => entry && !Array.isArray(entry) && typeof entry === 'object' ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);
const same = (left, right) => stable(left) === stable(right);
const finiteVector = (value, n) => Array.isArray(value) && value.length === n && value.every(Number.isFinite);
const fail = message => { throw new Error(message); };
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const emptyBounds = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
function include(bounds, point) { for (let k = 0; k < 3; k++) { bounds.min[k] = Math.min(bounds.min[k], point[k]); bounds.max[k] = Math.max(bounds.max[k], point[k]); } }
function finishBounds(bounds) {
  if (!bounds.min.every(Number.isFinite)) return null;
  const size = bounds.min.map((n, k) => bounds.max[k] - n), longest = Math.max(...size);
  return { min: bounds.min, max: bounds.max, size, axisRatios: size.map(n => longest ? n / longest : 0) };
}
function scalar(buffer, offset, component) {
  return component === 5120 ? buffer.readInt8(offset) : component === 5121 ? buffer.readUInt8(offset) :
    component === 5122 ? buffer.readInt16LE(offset) : component === 5123 ? buffer.readUInt16LE(offset) :
      component === 5125 ? buffer.readUInt32LE(offset) : buffer.readFloatLE(offset);
}
function elementSize(accessor) {
  const bytes = COMPONENTS[accessor.componentType], count = TYPES[accessor.type];
  if (!bytes || !count) fail('Unknown accessor component/type');
  if (accessor.type.startsWith('MAT')) { const side = Number(accessor.type.at(-1)); return Math.ceil(side * bytes / 4) * 4 * side; }
  return bytes * count;
}
function matrix(node) {
  if (node.matrix) { if (!finiteVector(node.matrix, 16)) fail('Invalid node matrix'); return node.matrix; }
  const t = node.translation || [0, 0, 0], q = node.rotation || [0, 0, 0, 1], s = node.scale || [1, 1, 1];
  if (!finiteVector(t, 3) || !finiteVector(q, 4) || !finiteVector(s, 3)) fail('Invalid node TRS');
  const [x, y, z, w] = q, xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [(1 - 2 * yy - 2 * zz) * s[0], (2 * xy + 2 * wz) * s[0], (2 * xz - 2 * wy) * s[0], 0,
    (2 * xy - 2 * wz) * s[1], (1 - 2 * xx - 2 * zz) * s[1], (2 * yz + 2 * wx) * s[1], 0,
    (2 * xz + 2 * wy) * s[2], (2 * yz - 2 * wx) * s[2], (1 - 2 * xx - 2 * yy) * s[2], 0, ...t, 1];
}
function multiply(a, b) { const out = Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return out; }
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Structural inspection of a NEW GLB only. No renderer, validator package or original corpus reads. */
export function inspectGlb(buffer) {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') fail('Not a GLB (possibly an LFS pointer)');
  if (buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) fail('Invalid GLB version or declared length');
  const chunks = []; let offset = 12;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) fail('Truncated GLB chunk');
    const length = buffer.readUInt32LE(offset), type = buffer.readUInt32LE(offset + 4);
    if (length % 4 || offset + 8 + length > buffer.length) fail('Invalid GLB chunk length/alignment');
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) }); offset += 8 + length;
  }
  if (chunks[0]?.type !== 0x4e4f534a || chunks.filter(c => c.type === 0x4e4f534a).length !== 1 || chunks.filter(c => c.type === 0x004e4942).length > 1) fail('Expected one leading JSON and at most one BIN chunk');
  const gltf = JSON.parse(chunks[0].data.toString('utf8').trim()), bin = chunks.find(c => c.type === 0x004e4942)?.data || Buffer.alloc(0);
  if (gltf.asset?.version !== '2.0' || gltf.buffers?.length !== 1 || gltf.buffers[0].uri || !integer(gltf.buffers[0].byteLength) || gltf.buffers[0].byteLength > bin.length || bin.length - gltf.buffers[0].byteLength > 3) fail('Expected one valid embedded glTF 2 buffer');
  for (const image of gltf.images || []) if (image.uri) fail('External/data URI image is outside the self-contained GLB contract');
  const views = gltf.bufferViews || [], accessors = gltf.accessors || [], layouts = [];
  const getView = id => { if (!integer(id) || !views[id]) fail('Missing bufferView'); return views[id]; };
  for (const view of views) {
    if (view.buffer !== 0 || !integer(view.byteOffset || 0) || !integer(view.byteLength) || (view.byteOffset || 0) + view.byteLength > gltf.buffers[0].byteLength) fail('bufferView exceeds embedded buffer');
    if (view.byteStride !== undefined && (!integer(view.byteStride, 4) || view.byteStride > 252 || view.byteStride % 4)) fail('Invalid bufferView stride');
  }
  for (const image of gltf.images || []) if (image.bufferView === undefined || !views[image.bufferView] || !['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType)) fail('Invalid embedded image view/MIME');
  for (const [id, accessor] of accessors.entries()) {
    if (!integer(accessor.count, 1) || !integer(accessor.byteOffset || 0)) fail(`Invalid accessor count/offset ${id}`);
    const bytes = COMPONENTS[accessor.componentType], size = elementSize(accessor), count = TYPES[accessor.type];
    if ((accessor.byteOffset || 0) % bytes) fail(`Unaligned accessor ${id}`);
    const view = accessor.bufferView === undefined ? null : getView(accessor.bufferView), stride = view?.byteStride || size;
    if (view && (stride < size || (accessor.byteOffset || 0) + (accessor.count - 1) * stride + size > view.byteLength || ((view.byteOffset || 0) + (accessor.byteOffset || 0)) % bytes)) fail(`Accessor exceeds bufferView ${id}`);
    for (const name of ['min', 'max']) if (accessor[name] !== undefined && !finiteVector(accessor[name], count)) fail(`Invalid accessor ${name} ${id}`);
    const layout = { accessor, view, stride, bytes, count, start: (view?.byteOffset || 0) + (accessor.byteOffset || 0), sparse: new Map() };
    if (accessor.sparse) {
      const sparse = accessor.sparse, indicesView = getView(sparse.indices?.bufferView), valuesView = getView(sparse.values?.bufferView), indexBytes = COMPONENTS[sparse.indices.componentType];
      if (!integer(sparse.count, 1) || sparse.count > accessor.count || ![5121, 5123, 5125].includes(sparse.indices.componentType)) fail(`Invalid sparse accessor ${id}`);
      const indexOffset = sparse.indices.byteOffset || 0, valueOffset = sparse.values.byteOffset || 0;
      if (!integer(indexOffset) || !integer(valueOffset) || indexOffset % indexBytes || valueOffset % bytes || indexOffset + sparse.count * indexBytes > indicesView.byteLength || valueOffset + sparse.count * size > valuesView.byteLength) fail(`Sparse accessor exceeds view ${id}`);
      let previous = -1;
      for (let i = 0; i < sparse.count; i++) { const index = scalar(bin, (indicesView.byteOffset || 0) + indexOffset + i * indexBytes, sparse.indices.componentType); if (index <= previous || index >= accessor.count) fail(`Sparse indices unordered/out of bounds ${id}`); previous = index; layout.sparse.set(index, (valuesView.byteOffset || 0) + valueOffset + i * size); }
    }
    layouts.push(layout);
  }
  function getAccessor(id) { if (!integer(id) || !layouts[id]) fail('Primitive references missing accessor'); return layouts[id]; }
  function value(layout, index, component) {
    const start = layout.sparse.get(index) ?? (layout.view ? layout.start + index * layout.stride : null);
    return start === null ? 0 : scalar(bin, start + component * layout.bytes, layout.accessor.componentType);
  }
  const meshBounds = [], primitives = [], geometry = createHash('sha256'); let triangles = 0, positionVertices = 0;
  for (const [meshIndex, mesh] of (gltf.meshes || []).entries()) {
    if (!Array.isArray(mesh.primitives) || !mesh.primitives.length) fail('Mesh has no primitives');
    const bounds = emptyBounds();
    for (const [primitiveIndex, primitive] of mesh.primitives.entries()) {
      const position = getAccessor(primitive.attributes?.POSITION), accessor = position.accessor;
      if (accessor.type !== 'VEC3' || accessor.componentType !== 5126 || !accessor.min || !accessor.max) fail('POSITION must be FLOAT VEC3 with min/max');
      for (const accessorId of Object.values(primitive.attributes)) if (getAccessor(accessorId).accessor.count !== accessor.count) fail('Attribute vertex counts differ');
      const actual = emptyBounds(), vertexBytes = Buffer.allocUnsafe(12);
      geometry.update(JSON.stringify({ mode: primitive.mode ?? 4, vertices: accessor.count }));
      for (let i = 0; i < accessor.count; i++) {
        const point = [value(position, i, 0), value(position, i, 1), value(position, i, 2)];
        if (!point.every(Number.isFinite)) fail('Non-finite POSITION');
        include(actual, point); include(bounds, point); for (let k = 0; k < 3; k++) vertexBytes.writeFloatLE(point[k], k * 4); geometry.update(vertexBytes);
      }
      for (let k = 0; k < 3; k++) { const tolerance = 1e-5 * Math.max(1, Math.abs(actual.min[k]), Math.abs(actual.max[k])); if (Math.abs(actual.min[k] - accessor.min[k]) > tolerance || Math.abs(actual.max[k] - accessor.max[k]) > tolerance) fail('POSITION accessor bounds differ from actual vertices'); }
      let elements = accessor.count;
      if (primitive.indices !== undefined) {
        const indices = getAccessor(primitive.indices), indexBytes = Buffer.allocUnsafe(4);
        if (indices.accessor.type !== 'SCALAR' || ![5121, 5123, 5125].includes(indices.accessor.componentType)) fail('Invalid index accessor');
        elements = indices.accessor.count;
        for (let i = 0; i < elements; i++) { const index = value(indices, i, 0); if (index >= accessor.count) fail('Primitive index exceeds vertex count'); indexBytes.writeUInt32LE(index); geometry.update(indexBytes); }
      }
      const mode = primitive.mode ?? 4;
      if (!integer(mode) || mode > 6 || mode === 4 && elements % 3) fail('Invalid primitive mode/triangle count');
      if (primitive.material !== undefined && (!integer(primitive.material) || !gltf.materials?.[primitive.material])) fail('Missing primitive material');
      const triangleCount = mode === 4 ? elements / 3 : mode === 5 || mode === 6 ? Math.max(0, elements - 2) : 0;
      triangles += triangleCount; positionVertices += accessor.count;
      primitives.push({ meshIndex, primitiveIndex, mode, vertices: accessor.count, elements, triangles: triangleCount, bounds: finishBounds(actual) });
    }
    meshBounds.push(finishBounds(bounds));
  }
  if (!primitives.length) fail('No mesh primitives');
  const nodes = gltf.nodes || [], parents = new Map(), worlds = new Map(), visiting = new Set(), worldBounds = emptyBounds();
  for (const [id, node] of nodes.entries()) for (const child of node.children || []) { if (!integer(child) || !nodes[child] || parents.has(child)) fail('Invalid/multiple node parent'); parents.set(child, id); }
  function world(id) { if (worlds.has(id)) return worlds.get(id); if (visiting.has(id)) fail('Cyclic node hierarchy'); visiting.add(id); const node = nodes[id]; if (!node) fail('Missing node'); const result = multiply(parents.has(id) ? world(parents.get(id)) : IDENTITY, matrix(node)); visiting.delete(id); worlds.set(id, result); return result; }
  for (const [id, node] of nodes.entries()) {
    const transform = world(id);
    if (node.mesh !== undefined) {
      const bounds = meshBounds[node.mesh]; if (!bounds) fail('Node references missing mesh');
      for (let corner = 0; corner < 8; corner++) { const point = bounds.min.map((min, k) => corner & (1 << k) ? bounds.max[k] : min); include(worldBounds, [0, 1, 2].map(r => transform[r] * point[0] + transform[4 + r] * point[1] + transform[8 + r] * point[2] + transform[12 + r])); }
    }
    if (node.skin !== undefined && !gltf.skins?.[node.skin]) fail('Node references missing skin');
  }
  for (const scene of gltf.scenes || []) if (!Array.isArray(scene.nodes) || scene.nodes.some(id => !integer(id) || !nodes[id] || parents.has(id))) fail('Invalid scene root nodes');
  if (!gltf.scenes?.length || !integer(gltf.scene ?? 0) || !gltf.scenes[gltf.scene ?? 0]) fail('Missing default scene');
  for (const skin of gltf.skins || []) { if (!skin.joints?.length || skin.joints.some(id => !integer(id) || !nodes[id])) fail('Invalid skin joints'); if (skin.inverseBindMatrices !== undefined) { const matrices = getAccessor(skin.inverseBindMatrices).accessor; if (matrices.type !== 'MAT4' || matrices.componentType !== 5126 || matrices.count !== skin.joints.length) fail('Invalid inverse bind matrices'); } }
  for (const animation of gltf.animations || []) {
    if (!animation.channels?.length || !animation.samplers?.length) fail('Empty animation');
    for (const sampler of animation.samplers) { const input = getAccessor(sampler.input).accessor; getAccessor(sampler.output); if (input.type !== 'SCALAR' || input.componentType !== 5126) fail('Invalid animation time accessor'); }
    for (const channel of animation.channels) if (!animation.samplers[channel.sampler] || !nodes[channel.target?.node] || !['translation', 'rotation', 'scale', 'weights'].includes(channel.target?.path)) fail('Invalid animation channel');
  }
  return { bytes: buffer.length, meshes: gltf.meshes.length, nodes: nodes.length, skins: gltf.skins?.length || 0, materials: gltf.materials?.length || 0, images: gltf.images?.length || 0, accessors: accessors.length, bufferViews: views.length, primitives, triangles, positionVertices,
    clips: (gltf.animations || []).map(animation => animation.name || ''), observedGeometrySignature: geometry.digest('hex'), staticNodeBounds: finishBounds(worldBounds),
    boundsScope: 'Node-transformed base POSITION bounds; not animated/skinned deformation, camera silhouette, collision, or performance verification' };
}

function declaredIdentity(ship) { return { identityFamily: ship.identityFamily ?? ship.redesign?.identityFamily, geometrySignature: ship.geometrySignature ?? ship.redesign?.geometrySignature, readableSilhouette: ship.readableSilhouette ?? ship.redesign?.readableSilhouette }; }
function safeModel(root, model, id) {
  if (model !== `ships/${id}.glb`) fail(`Unexpected model path for ${id}`);
  return path.join(root, model);
}
function groupDuplicates(entries, key) { const map = new Map(); for (const entry of entries) { const value = key(entry); if (value == null) continue; const ids = map.get(value) || []; ids.push(entry.id); map.set(value, ids); } return [...map].filter(([, ids]) => ids.length > 1).map(([value, ids]) => ({ value, ids })); }

export async function verifyFleetV2({ repoRoot = ROOT, ids = null, reportPath = 'outputs/fleet-v2/verification-structure.json', writeReport = true } = {}) {
  const outputRoot = path.join(repoRoot, 'outputs/fleet-v2'), report = { schemaVersion: 1, checkedAt: new Date().toISOString(), scope: 'fleet-v2 structural verification only', passed: false, selectedIds: ids, catalogChecks: [], ships: [], warnings: [], errors: [],
    preservedOriginalScope: 'Only the used player-homeward binary is read/hashed. No full v1 corpus scan.', visualPreferencePassed: null, browserVerified: false, gameplayVerified: false };
  const check = (name, passed, detail) => { report.catalogChecks.push({ name, passed, detail }); if (!passed) report.errors.push(name); };
  try {
    const source = JSON.parse(await readFile(path.join(repoRoot, 'tools/fleet/catalog.json'), 'utf8')), v1 = JSON.parse(await readFile(path.join(repoRoot, 'outputs/fleet-v1/catalog.json'), 'utf8')), v2 = JSON.parse(await readFile(path.join(outputRoot, 'catalog.json'), 'utf8'));
    if (!Array.isArray(source.ships) || !Array.isArray(v1.ships) || !Array.isArray(v2.ships)) fail('Missing catalog ships[]');
    const excluded = source.ships.filter(s => s.category === 'preexisting-variant' || s.definitionLevel === 'design-alternative').map(s => s.id).sort();
    check('Exactly the nine original design alternatives are excluded', same(excluded, [...EXCLUDED].sort()), excluded);
    const expected = source.ships.filter(s => !EXCLUDED.includes(s.id)).map(s => s.id).sort(), actual = v2.ships.map(s => s.id).sort();
    check('Catalog contains all and only the 62 retained source IDs', expected.length === 62 && same(expected, actual), { expectedCount: expected.length, observedCount: actual.length, missing: expected.filter(id => !actual.includes(id)), extra: actual.filter(id => !expected.includes(id)) });
    check('Catalog IDs are unique', new Set(actual).size === actual.length);
    const selected = ids ? [...new Set(ids)] : actual;
    if (selected.some(id => !actual.includes(id))) fail(`Unknown/unbuilt v2 subset ID: ${selected.filter(id => !actual.includes(id)).join(', ')}`);
    report.selectedIds = selected; report.selection = { inspectedModels: selected.length, totalCatalogEntries: actual.length, completeV2ModelInspection: selected.length === actual.length };
    for (const ship of v2.ships) {
      const origin = source.ships.find(s => s.id === ship.id); if (!origin) continue;
      check(`${ship.id}: confirmed modules including null remain unchanged`, same(origin.modules, ship.modules));
      check(`${ship.id}: artModules are separate provisional placement`, ship.artModules && typeof ship.artModules === 'object' && ship.artModules !== ship.modules && Object.entries(origin.modules).every(([key, value]) => !Number.isInteger(value) || ship.artModules[key] === value));
      check(`${ship.id}: source category is preserved`, ship.category === origin.category);
      check(`${ship.id}: self-contained same-ID model path`, (ship.model || ship.assetPath) === `ships/${ship.id}.glb`);
    }
    for (const id of selected) {
      const ship = v2.ships.find(s => s.id === id), original = v1.ships.find(s => s.id === id), identity = declaredIdentity(ship), entry = { id, passed: false, errors: [], declared: identity };
      report.ships.push(entry);
      try {
        const buffer = await readFile(safeModel(outputRoot, ship.model || ship.assetPath, id)); entry.observed = inspectGlb(buffer);
        if (!same([...entry.observed.clips].sort(), [...CLIPS].sort())) entry.errors.push('Expected exactly the seven preserved clip names');
        if (!entry.observed.staticNodeBounds) entry.errors.push('No finite node-transformed mesh bounds');
        if (ship.bounds !== undefined && !same(ship.bounds, entry.observed.staticNodeBounds)) entry.errors.push('Catalog bounds differ from observed staticNodeBounds');
        if (ship.observedBounds !== undefined && !same(ship.observedBounds, entry.observed.staticNodeBounds)) entry.errors.push('Catalog observedBounds differ from observed staticNodeBounds');
        if (ship.declaredSilhouette !== undefined && !same(ship.declaredSilhouette, identity.readableSilhouette)) entry.errors.push('declaredSilhouette and readableSilhouette declarations differ');
        if (ship.bytes !== undefined && ship.bytes !== buffer.length) entry.errors.push('Catalog bytes differ from new GLB');
        if (id === 'player-homeward') {
          const before = await readFile(safeModel(path.join(repoRoot, 'outputs/fleet-v1'), original?.model || original?.assetPath, id));
          entry.originalBinary = { path: 'outputs/fleet-v1/ships/player-homeward.glb', bytes: before.length, sha256: digest(before), newSha256: digest(buffer), preserved: before.equals(buffer) };
          if (!entry.originalBinary.preserved) entry.errors.push('Selected player GLB must be a byte-identical copy of v1');
        } else {
          if (typeof identity.identityFamily !== 'string' || !identity.identityFamily.trim()) entry.errors.push('Missing identityFamily');
          if (typeof identity.geometrySignature !== 'string' || !identity.geometrySignature.trim()) entry.errors.push('Missing declared geometrySignature');
          else if (identity.geometrySignature !== entry.observed.observedGeometrySignature) entry.errors.push('Declared geometrySignature differs from observed POSITION/index streams');
          const silhouette = identity.readableSilhouette;
          if (!(typeof silhouette === 'string' && silhouette.trim() || silhouette && typeof silhouette === 'object' && !Array.isArray(silhouette) && Object.keys(silhouette).length)) entry.errors.push('Missing readableSilhouette design evidence');
        }
        if (Number.isFinite(ship.metrics?.triangles) && ship.metrics.triangles !== entry.observed.triangles) entry.errors.push('Catalog triangle count differs from new GLB');
        entry.v1Comparison = { baselineRead: 'catalog only; original GLB not opened', identityFamily: original?.identityFamily ?? original?.style ?? null, geometrySignature: original?.geometrySignature ?? null, readableSilhouette: original?.readableSilhouette ?? null, shapeProposal: original?.shapeProposal ?? null,
          triangles: original?.metrics?.triangles ?? null, meshes: original?.metrics?.meshCount ?? null, newTriangles: entry.observed.triangles, newMeshes: entry.observed.meshes, baselineSilhouetteMeasured: false };
        if (!original) entry.errors.push('No matching v1 model ID');
        entry.passed = entry.errors.length === 0;
      } catch (error) { entry.errors.push(error.message); }
      if (!entry.passed) report.errors.push(`${id}: ${entry.errors.join('; ')}`);
    }
    report.identityFamilies = groupDuplicates(report.ships, entry => entry.declared.identityFamily);
    report.duplicateObservedGeometry = groupDuplicates(report.ships, entry => entry.observed?.observedGeometrySignature);
    if (report.duplicateObservedGeometry.length) report.warnings.push('Some selected models share identical POSITION/index streams. Review deliberate reuse and silhouette; this metric is not a visual preference verdict.');
    report.warnings.push('Identity family and readableSilhouette are authored declarations. Static bounds/signatures cannot prove hand-drawn quality, role recognition, intimidating bosses, or readability at gameplay scale.');
    if (ids) report.warnings.push('Subset inspection: unselected v2 GLBs were not opened; passed does not claim all model files passed.');
  } catch (error) { report.errors.push(error.message); }
  report.passed = report.errors.length === 0;
  if (writeReport) { const target = path.resolve(repoRoot, reportPath); if (!target.startsWith(outputRoot + path.sep)) fail('Report must stay inside outputs/fleet-v2'); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, JSON.stringify(report, null, 2) + '\n'); }
  return report;
}

async function main() {
  const args = process.argv.slice(2); let ids = null;
  if (args.includes('--help')) { console.log('node tools/fleet-v2/verify.mjs [--ids player-homeward,enemy-tax-cutter]\nWrites outputs/fleet-v2/verification-structure.json. No original corpus scan, browser, install, or visual approval.'); return; }
  for (let i = 0; i < args.length; i++) { if (args[i] === '--ids') { if (!args[i + 1]) fail('--ids requires comma-separated IDs'); ids = args[++i].split(',').map(id => id.trim()).filter(Boolean); if (!ids.length) fail('Empty --ids'); } else fail(`Unknown argument: ${args[i]}`); }
  const report = await verifyFleetV2({ ids });
  console.log(JSON.stringify({ passed: report.passed, modelsInspected: report.ships.length, errors: report.errors, report: 'outputs/fleet-v2/verification-structure.json', visualPreferencePassed: null }));
  if (!report.passed) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
