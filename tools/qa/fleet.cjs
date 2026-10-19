/* Cloudstitch fleet corpus and offline browser QA.
 * node tools/qa/fleet.cjs [outputs/fleet-v1] [work/verification/fleet] [tools/fleet/catalog.json]
 * Optional --ids=id1,id2, --structure-only and --skip-preview produce a
 * clearly labelled partial report with fullCorpusPassed=false.
 * Checks asset implementation and presentation. Does not certify gameplay,
 * human recognizability, collision, LOD or an undecided engine/frame budget.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const validator = require('gltf-validator');
const THREE = require('three');
const { repoPath, reportDirectory, launchBrowser } = require('../lib/runtime.cjs');
const args = process.argv.slice(2), positional = args.filter(arg => !arg.startsWith('--'));
const root = repoPath(positional[0] || 'outputs/fleet-v1');
const reportDir = reportDirectory('fleet', positional[1]);
const sourcePath = repoPath(positional[2] || 'tools/fleet/catalog.json');
const selectedIds = args.find(arg => arg.startsWith('--ids='))?.slice(6).split(',');
const structureOnly = args.includes('--structure-only');
const skipPreview = args.includes('--skip-preview');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const assert = (value, message) => { if (!value) throw new Error(message); };
const finite = values => values.every(Number.isFinite);
const normalizeType = type => ({ balloons: 'balloon', envelopes: 'balloon', envelope: 'balloon', engines: 'engine', machineguns: 'machinegun', machinegun: 'machinegun', cannon: 'cannon', cannons: 'cannon', mortars: 'mortar', harpoons: 'harpoon', chainshots: 'chainshot', chaincannon: 'chainshot', chaincannons: 'chainshot', flamethrower: 'flame', flamethrowers: 'flame', flames: 'flame', hook: 'winch', hooks: 'winch', repairarms: 'repair', repairarm: 'repair', repairs: 'repair', armors: 'armor', armour: 'armor', armorplates: 'armor', armorplate: 'armor', smokeemitters: 'smoke', smoker: 'smoke', smokegenerator: 'smoke', rescuecapsule: 'rescue', rescuecapsules: 'rescue', hulls: 'hull', winches: 'winch', bells: 'bell', towers: 'tower' }[String(type).replace(/[-_\s]/g, '').toLowerCase()] || String(type).replace(/[-_\s]/g, '').toLowerCase());
const rows = catalog => Array.isArray(catalog) ? catalog : catalog.ships || catalog.entries || catalog.assets || [];
function artifactFile(value, fallback) {
  value = value || fallback;
  const resolved = path.isAbsolute(value) ? value : value.startsWith('outputs/') ? repoPath(value) : path.resolve(root, value);
  assert(resolved.startsWith(root + path.sep), `Artifact is outside fleet output: ${value}`);
  return resolved;
}
function parseGLB(bytes) {
  assert(bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'glTF' && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, 'Invalid GLB header');
  let json, bin;
  for (let offset = 12; offset < bytes.length;) {
    const size = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    assert(size % 4 === 0 && offset + size + 8 <= bytes.length, 'Invalid GLB chunk');
    if (type === 0x4e4f534a) json = JSON.parse(bytes.subarray(offset + 8, offset + 8 + size).toString('utf8').trim());
    if (type === 0x004e4942) bin = bytes.subarray(offset + 8, offset + 8 + size);
    offset += size + 8;
  }
  assert(json && bin, 'Missing GLB JSON or binary chunk');
  const sizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, dimensions = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const readers = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }, cache = new Map();
  function accessor(index) {
    if (cache.has(index)) return cache.get(index);
    const a = json.accessors?.[index], view = json.bufferViews?.[a?.bufferView], dimension = dimensions[a?.type], size = sizes[a?.componentType];
    assert(a && view && !a.sparse && view.buffer === 0 && dimension && size && a.count > 0, `Invalid/unsupported accessor ${index}`);
    const start = (view.byteOffset || 0) + (a.byteOffset || 0), stride = view.byteStride || size * dimension;
    assert(start + (a.count - 1) * stride + size * dimension <= (view.byteOffset || 0) + view.byteLength && start + (a.count - 1) * stride + size * dimension <= bin.length, `Accessor ${index} out of bounds`);
    const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength), result = [];
    const normalized = value => !a.normalized ? value : a.componentType === 5121 ? value / 255 : a.componentType === 5123 ? value / 65535 : a.componentType === 5120 ? Math.max(value / 127, -1) : a.componentType === 5122 ? Math.max(value / 32767, -1) : value;
    for (let row = 0; row < a.count; row++) result.push(Array.from({ length: dimension }, (_, col) => normalized(data[readers[a.componentType]](start + row * stride + col * size, true))));
    const decoded = { ...a, rows: result }; cache.set(index, decoded); return decoded;
  }
  return { json, accessor, bin };
}
function quaternionVelocity(a, b, dt) {
  const [x, y, z, w] = a, [X, Y, Z, W] = b;
  let q = [w * X - x * W - y * Z + z * Y, w * Y + x * Z - y * W - z * X, w * Z - x * Y + y * X - z * W, w * W + x * X + y * Y + z * Z];
  if (q[3] < 0) q = q.map(value => -value);
  const sine = Math.hypot(...q.slice(0, 3)), angle = 2 * Math.atan2(sine, q[3]);
  return q.slice(0, 3).map(value => sine > 1e-9 ? value / sine * angle / dt : 2 * value / dt);
}
function sourceRefs(entry) {
  const references = entry.sourceRefs || entry.sourceFiles || entry.sources || entry.references || entry.sourceDocuments || [];
  return references.map(reference => typeof reference === 'string' ? reference : reference.path || reference.file || reference.document).filter(Boolean);
}
function requiredCounts(entry) { return entry.requiredCounts || entry.exactModules || entry.moduleCounts || entry.modules || entry.spec?.modules || {}; }
function inspect(bytes, source, output) {
  if (output.modules) assert(Object.keys(output.modules).length === Object.keys(source.modules).length && Object.entries(source.modules).every(([key, value]) => output.modules[key] === value), 'Output overwrote confirmed/null source module counts');
  assert(!output.category || output.category === source.category, 'Output changed source scope category');
  assert(typeof output.authoredUnits === 'string' && output.authoredUnits.length > 0 && Number.isFinite(output.recommendedFleetScale) && output.recommendedFleetScale > 0, 'Authoring units/recommended fleet scale metadata missing');
  const { json, accessor, bin } = parseGLB(bytes);
  assert((json.buffers || []).every(buffer => !buffer.uri), 'External buffer reference');
  assert((json.images || []).every(image => image.bufferView !== undefined || image.uri?.startsWith('data:')), 'External/missing image reference');
  assert(json.images?.length > 0 && json.materials?.length > 0 && json.textures?.length > 0, 'Painted atlas/material/texture missing');
  assert(json.skins?.length > 0 && json.animations?.length > 0, 'Rig or embedded animation clips missing');
  let triangles = 0, skinnedMeshes = 0, maxWeightError = 0, vertices = 0;
  const boundsMin = [Infinity, Infinity, Infinity], boundsMax = [-Infinity, -Infinity, -Infinity];
  const geometryHashes = [], uvAreas = [], moduleNodes = new Map(), moduleCounts = {}, structuralNodes = new Map(), roleModules = new Map();
  const names = new Map(json.nodes.map((node, index) => [node.name, index]));
  const parents = new Map(), world = new Map(); let maxBindPoseError = 0;
  json.nodes.forEach((node, index) => (node.children || []).forEach(child => { assert(!parents.has(child), 'Multiple node parents'); parents.set(child, index); }));
  const nodeWorld = (index, seen = new Set()) => { if (world.has(index)) return world.get(index); assert(!seen.has(index), 'Cyclic node hierarchy'); seen.add(index); const node = json.nodes[index], matrix = new THREE.Matrix4(); if (node.matrix) matrix.fromArray(node.matrix); else matrix.compose(new THREE.Vector3().fromArray(node.translation || [0, 0, 0]), new THREE.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]), new THREE.Vector3().fromArray(node.scale || [1, 1, 1])); assert(finite(matrix.elements) && Math.abs(matrix.determinant()) > 1e-9, 'Invalid/singular node transform'); if (parents.has(index)) matrix.premultiply(nodeWorld(parents.get(index), seen)); seen.delete(index); world.set(index, matrix); return matrix; };
  const subtree = index => { const found = new Set(); const visit = value => { if (found.has(value)) return; found.add(value); (json.nodes[value].children || []).forEach(visit); }; visit(index); return found; };
  const childrenHaveMesh = (index, seen = new Set()) => {
    assert(!seen.has(index), 'Node hierarchy cycle'); seen.add(index);
    const node = json.nodes[index];
    return node.mesh !== undefined || (node.children || []).some(child => childrenHaveMesh(child, new Set(seen)));
  };
  json.nodes.forEach((node, index) => {
    for (const values of [node.translation, node.rotation, node.scale, node.matrix]) if (values) assert(finite(values), `Non-finite node transform ${node.name}`);
    const extras = node.extras || {};
    if (extras.moduleId) {
      for (const key of new Set((node.mesh === undefined ? [extras.featureId, extras.structuralRole] : []).filter(Boolean))) { if (!structuralNodes.has(key)) structuralNodes.set(key, new Set()); structuralNodes.get(key).add(extras.moduleId); }
      if (extras.role) { if (!roleModules.has(extras.role)) roleModules.set(extras.role, new Set()); roleModules.get(extras.role).add(extras.moduleId); }
    }
    if (extras.moduleId && extras.moduleType) {
      if (!moduleNodes.has(extras.moduleId)) moduleNodes.set(extras.moduleId, { type: normalizeType(extras.moduleType), parent: extras.parentId, indices: [] });
      const module = moduleNodes.get(extras.moduleId); assert(module.type === normalizeType(extras.moduleType), `Conflicting module type ${extras.moduleId}`); module.indices.push(index);
    }
    if (node.mesh === undefined) return;
    const skin = json.skins[node.skin]; assert(skin, `Visible mesh ${node.name} has no skin`); skinnedMeshes++;
    const ownerValue = extras.ownerBone;
    const ownerIndex = typeof ownerValue === 'string' ? names.get(ownerValue) : Number.isInteger(ownerValue) ? (skin.joints.includes(ownerValue) ? ownerValue : skin.joints[ownerValue]) : undefined;
    assert(ownerIndex !== undefined && json.nodes[ownerIndex], `Mesh ${node.name} ownerBone is missing/invalid`);
    const ownerSubtree = subtree(ownerIndex);
    assert(new Set(skin.joints).size === skin.joints.length && skin.joints.every(joint => json.nodes[joint]), 'Invalid/duplicate skin joints');
    const inverse = accessor(skin.inverseBindMatrices); assert(inverse.type === 'MAT4' && inverse.count === skin.joints.length && inverse.rows.every(finite), 'Invalid inverse bind matrices');
    const meshWorld = nodeWorld(index); skin.joints.forEach((joint, i) => { const neutral = nodeWorld(joint).clone().multiply(new THREE.Matrix4().fromArray(inverse.rows[i])); neutral.elements.forEach((value, component) => { maxBindPoseError = Math.max(maxBindPoseError, Math.abs(value - meshWorld.elements[component])); }); });
    for (const primitive of json.meshes[node.mesh].primitives) {
      const p = accessor(primitive.attributes.POSITION), uvIndex = primitive.attributes.TEXCOORD_0, textured = json.materials[primitive.material]?.pbrMetallicRoughness?.baseColorTexture;
      assert(!textured || uvIndex !== undefined, 'Textured primitive has no UV coordinates');
      const uv = uvIndex === undefined ? { count: p.count, rows: [] } : accessor(uvIndex), joints = accessor(primitive.attributes.JOINTS_0), weights = accessor(primitive.attributes.WEIGHTS_0);
      assert(p.rows.every(finite) && uv.rows.every(finite) && p.count === uv.count && p.count === joints.count && p.count === weights.count, 'Invalid position/UV/skin attributes');
      const indices = primitive.indices === undefined ? { count: p.count, rows: Array.from({ length: p.count }, (_, i) => [i]) } : accessor(primitive.indices);
      assert((primitive.mode ?? 4) === 4 && indices.count % 3 === 0 && indices.rows.every(row => Number.isInteger(row[0]) && row[0] >= 0 && row[0] < p.count), 'Invalid triangle indices');
      triangles += indices.count / 3; vertices += p.count;
      p.rows.forEach(row => row.forEach((value, component) => { boundsMin[component] = Math.min(boundsMin[component], value); boundsMax[component] = Math.max(boundsMax[component], value); }));
      let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
      uv.rows.forEach(([u, v]) => { minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v); });
      uvAreas.push(uv.rows.length ? (maxU - minU) * (maxV - minV) : 0);
      geometryHashes.push(hash(Buffer.from(new Float32Array(p.rows.flat()).buffer)));
      for (let i = 0; i < p.count; i++) {
        assert(joints.rows[i].every(joint => Number.isInteger(joint) && joint >= 0 && joint < skin.joints.length), 'Joint index out of bounds');
        assert(finite(weights.rows[i]) && weights.rows[i].every(weight => weight >= 0 && weight <= 1.000001), 'Invalid skin weights');
        assert(joints.rows[i].every((joint, slot) => weights.rows[i][slot] <= 1e-6 || ownerSubtree.has(skin.joints[joint])), `Vertex bound outside module ownerBone subtree: ${node.name}`);
        maxWeightError = Math.max(maxWeightError, Math.abs(weights.rows[i].reduce((sum, value) => sum + value, 0) - 1));
      }
    }
  });
  assert(maxBindPoseError < 1e-4, `Inverse bind matrices deform the neutral asset: ${maxBindPoseError}`);
  assert(triangles > 0 && vertices > 0 && maxWeightError < 1e-4, 'Empty geometry or skin weights do not sum to one');
  assert(uvAreas.some(area => area > 1e-5), 'UV atlas sampling is collapsed');
  for (const [id, module] of moduleNodes) {
    assert(module.indices.some(index => childrenHaveMesh(index)), `Module ${id} is an empty metadata annotation`);
    moduleCounts[module.type] = (moduleCounts[module.type] || 0) + 1;
    if (module.parent !== undefined && module.parent !== null && !['root', 'Root', 'RigRoot'].includes(module.parent)) assert(moduleNodes.has(module.parent) || names.has(module.parent), `Unknown parentId ${module.parent} for ${id}`);
  }
  assert(moduleNodes.size > 0, 'Semantic moduleId/moduleType metadata missing');
  const structuralCounts = Object.fromEntries([...structuralNodes].map(([key, ids]) => [key, [...ids].filter(id => moduleNodes.has(id)).length])), structuralCompared = {}, structuralManualReview = [];
  for (const [key, expected] of Object.entries(source.structuralFeatures || {})) {
    if (typeof expected === 'number') { const actual = structuralCounts[key] || 0; assert(actual === expected, `Structural feature ${key}: expected ${expected}, actual ${actual}`); structuralCompared[key] = { expected, actual }; }
    else if (Array.isArray(expected) && key === 'externalDeckSubtree') {
      const deckIds = structuralNodes.get('externalDeck') || new Set();
      for (const role of expected) { const candidates = roleModules.get(role) || new Set(); assert([...candidates].some(id => { const seen = new Set(); while (moduleNodes.has(id) && !seen.has(id)) { if (deckIds.has(id)) return true; seen.add(id); id = moduleNodes.get(id).parent; } return false; }), `External deck subtree missing actual attached role ${role}`); }
      structuralCompared[key] = { roles: expected, attachedToExternalDeck: true };
    } else structuralManualReview.push({ key, requirement: expected, taggedModules: structuralCounts[key] || 0 });
  }
  const counts = requiredCounts(source), comparedCounts = {};
  const requiredFeatures = source.requiredFeatures || [];
  for (const feature of requiredFeatures) { const acceptable = feature === 'hook' ? ['hook', 'winch'] : [normalizeType(feature)]; assert(acceptable.some(type => moduleCounts[type] > 0), `Required 3D module feature missing: ${feature}`); }
  for (const [type, expected] of Object.entries(counts)) {
    if (expected === null || expected === undefined || typeof expected !== 'number') continue;
    const normalized = normalizeType(type), actual = moduleCounts[normalized] || 0;
    assert(actual === expected, `Module count ${type}: expected ${expected}, actual ${actual}`); comparedCounts[normalized] = { expected, actual };
  }
  const clips = json.animations.map(animation => {
    assert(animation.name && animation.channels.length > 0, 'Unnamed/empty clip'); let duration = 0, maxLoopPoseGap = 0, maxLoopVelocityGap = 0;
    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler], times = accessor(sampler.input).rows.map(row => row[0]), values = accessor(sampler.output).rows;
      assert(json.nodes[channel.target.node] && finite(times) && times.every((time, i) => !i || time > times[i - 1]) && values.every(finite), `Invalid sampler ${animation.name}`);
      duration = Math.max(duration, ...times);
      const rotation = channel.target.path === 'rotation'; if (rotation) assert(values.every(q => Math.abs(Math.hypot(...q) - 1) < 1e-3), 'Unnormalized rotation keyframe');
      assert(times.length >= 2 && Math.abs(times[0]) < 1e-6 && (sampler.interpolation || 'LINEAR') === 'LINEAR' && values.length === times.length, 'Expected sampled linear complete-loop clip');
      const first = values[0], last = values.at(-1), poseGap = rotation ? 2 * Math.acos(Math.min(1, Math.abs(first.reduce((sum, value, i) => sum + value * last[i], 0)) / Math.hypot(...first) / Math.hypot(...last))) : Math.hypot(...first.map((value, i) => value - last[i]));
      const velocity = (a, b, dt) => rotation ? quaternionVelocity(a, b, dt) : b.map((value, i) => (value - a[i]) / dt);
      const startVelocity = velocity(first, values[1], times[1] - times[0]), endVelocity = velocity(values.at(-2), last, times.at(-1) - times.at(-2));
      const velocityGap = Math.hypot(...startVelocity.map((value, i) => value - endVelocity[i])), seamSpeed = Math.max(Math.hypot(...startVelocity), Math.hypot(...endVelocity));
      assert(poseGap < .002 && velocityGap < seamSpeed * .15 + .03, `Loop pose/velocity seam in ${animation.name}/${json.nodes[channel.target.node].name}/${channel.target.path}`);
      maxLoopPoseGap = Math.max(maxLoopPoseGap, poseGap); maxLoopVelocityGap = Math.max(maxLoopVelocityGap, velocityGap);
    }
    assert(duration > 0 && Number.isFinite(duration), 'Invalid animation duration'); return { name: animation.name, duration, channels: animation.channels.length, maxLoopPoseGap, maxLoopVelocityGap };
  });
  assert(new Set(clips.map(clip => clip.name)).size === clips.length, 'Duplicate clip names');
  let selectedRigBinary = null;
  if (source.id === 'player-homeward') { const original = parseGLB(fs.readFileSync(repoPath('outputs/airship-rig-v1/airship-rigged.glb'))); selectedRigBinary = { source: 'outputs/airship-rig-v1/airship-rigged.glb', sourceBinarySha256: hash(original.bin), fleetBinarySha256: hash(bin), exactMatch: hash(original.bin) === hash(bin) }; assert(selectedRigBinary.exactMatch, 'Selected player geometry/painted texture/animation binary was replaced'); }
  const digest = hash(bytes); if (!structureOnly && !skipPreview) assert(output.previewSourceSha256 === digest, 'Preview source SHA is missing/stale');
  else if (output.previewSourceSha256) assert(output.previewSourceSha256 === digest, 'Declared preview source SHA is stale');
  if (output.sha256) assert(digest === output.sha256, 'Manifest SHA does not match GLB');
  if (output.bytes || output.modelBytes) assert(bytes.length === (output.bytes || output.modelBytes), 'Manifest byte count mismatch');
  const refs = sourceRefs(source);
  assert(refs.length > 0, 'Catalog source references missing');
  for (const reference of refs) { const file = reference.split('#')[0]; if (/\.(txt|json|png|html)$/.test(file)) assert(fs.existsSync(repoPath(file)), `Missing source reference ${file}`); }
  return { bytes: bytes.length, sha256: digest, previewSourceSha256: output.previewSourceSha256 || null, authoredUnits: output.authoredUnits, recommendedFleetScale: output.recommendedFleetScale, triangles, vertices, rawBindBounds: { min: boundsMin, max: boundsMax, span: boundsMax.map((value, i) => value - boundsMin[i]), units: 'Authored model units; no game-U or real-world conversion certified.' }, skinnedMeshes, skins: json.skins.length, joints: new Set(json.skins.flatMap(skin => skin.joints)).size, materialCount: json.materials.length, textureCount: json.textures.length, maxWeightError, maxBindPoseError, selectedRigBinary, moduleCount: moduleNodes.size, moduleCounts, comparedCounts, structuralCounts, structuralCompared, structuralManualReview, clips, sourceRefs: refs, requiredFeaturesVerified: requiredFeatures, geometryFingerprint: hash(Buffer.from(geometryHashes.sort().join('\n'))) };
}
function verifySourceCatalog(source) {
  const planned = rows(source), ids = new Set(planned.map(ship => ship.id));
  const fixtures = ['player-homeward', 'player-cloud-scout', 'player-mixed-raider', 'player-broadside', 'player-rescue-workshop', 'player-control', 'player-close-flame', 'enemy-pirate-scout', 'enemy-cult-blockade', 'enemy-union-salvage', 'enemy-union-repair', 'enemy-ghost-chaser', 'enemy-disguised-wreck', 'enemy-tax-cutter', 'rival-change', 'rival-debts-end', 'rival-quiet-answer', 'rival-night-shift', 'rival-go-first', 'rival-unfinished', 'boss-bell-devourer', 'boss-shipyard-ribs', 'boss-shipwright-command', 'boss-fleet-king', 'boss-last-inhale', 'mini-funeral-guard'];
  assert(fixtures.every(id => ids.has(id)), `Missing core catalog fixtures: ${fixtures.filter(id => !ids.has(id))}`);
  if (source.counts?.entries !== undefined) assert(source.counts.entries === planned.length, 'Source declared entry count mismatch');
  const categories = {}; planned.forEach(ship => { categories[ship.category] = (categories[ship.category] || 0) + 1; for (const [key, value] of Object.entries(requiredCounts(ship))) assert(value === null || Number.isInteger(value) && value >= 0, `Invalid confirmed count ${ship.id}/${key}`); });
  for (const [category, count] of Object.entries(source.counts?.categories || {})) assert(categories[category] === count, `Source category count mismatch ${category}`);
  for (const alias of source.aliases || []) if (alias.targetId) assert(ids.has(alias.targetId), `Alias references nonexistent target ${alias.term}`);
  const paper = JSON.parse(fs.readFileSync(repoPath('outputs/47-build-budget-examples.json'), 'utf8'));
  for (const build of paper.builds) { const row = planned.find(ship => ship.category === 'player-build' && ship.name === build.name); assert(row, `Missing 47 player build ${build.name}`); const actual = Object.fromEntries(Object.entries(requiredCounts(row)).map(([key, value]) => [normalizeType(key), value])); for (const [part, count] of Object.entries(build.parts)) if (part !== 'hull') assert(actual[normalizeType(part)] === count, `47 paper count changed ${build.name}/${part}`); }
  return { entries: planned.length, categories, coreFixtureCount: fixtures.length, paperBuildsCompared: paper.builds.length, aliasesValid: true, note: 'Coverage rows include loadouts, facilities, roles, ending/record forms and design alternatives; the row count is not a claim of unique canonical hulls.' };
}
function verifyOriginals() {
  const inventory = JSON.parse(fs.readFileSync(repoPath('docs/asset-inventory.json'), 'utf8'));
  const entries = inventory.assets.filter(entry => entry.path.startsWith('outputs/selected-airship-toon3d/') && /\.(glb|png)$/.test(entry.path) || entry.path.startsWith('outputs/airship-models-9/') && entry.path.endsWith('.glb'));
  for (const entry of entries) assert(hash(fs.readFileSync(repoPath(entry.path))) === entry.sha256, `Original asset changed: ${entry.path}`);
  assert(hash(fs.readFileSync(repoPath('outputs/selected-airship-toon3d/airship.glb'))) === 'dae35b13806d553a8b124d502a81d7dff58c183a266db25efc0d9a060198ce74', 'Selected source GLB changed');
  return { checked: entries.length, unchanged: true };
}
async function inspectViewer(page, id, viewer, preview, expected) {
  const errors = [], external = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); }); page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
  await page.goto(pathToFileURL(viewer).href);
  await page.waitForFunction(() => window.__rigReady === true || window.__rigStats?.error, null, { timeout: 45000 });
  const state = await page.evaluate(({ expected }) => {
    const v = window.__rigViewer, stats = window.__rigStats;
    if (!stats?.ready || stats.error || !v?.rig || !v.clips?.length) throw new Error(`Viewer not ready: ${JSON.stringify(stats)}`);
    if ((v.outlineEffect?.autoClear ?? stats.outlineAutoClear) !== true) throw new Error('OutlineEffect.autoClear missing');
    if (stats.sourceBytes !== expected.bytes || stats.triangleCount !== expected.triangles || v.clips.length !== expected.clips.length) throw new Error('Embedded model metadata/clip count differs from standalone GLB');
    const meshes = [], textures = new Map(); v.rig.traverse(node => { if (node.isMesh) meshes.push(node); });
    if (!meshes.every(mesh => mesh.isSkinnedMesh)) throw new Error('A visible runtime mesh is not skinned');
    for (const mesh of meshes) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (material.map) { const texture = material.map, image = texture.source?.data || texture.image; if (!(image?.width >= 1024 && image?.height >= 1024)) throw new Error('Atlas image not decoded or below 1024×1024'); textures.set(texture.uuid, { width: image.width, height: image.height }); }
    if (!textures.size) throw new Error('Rendered meshes do not use a painted atlas');
    v.setPlaying(false); v.setAutoRotate(false); v.controls.enableDamping = false;
    const sample = () => { v.scene.updateMatrixWorld(true); const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; let n = 0; for (const mesh of meshes) { const p = mesh.position.clone(), count = mesh.geometry.attributes.position.count, stride = Math.max(1, Math.floor(count / 256)); for (let i = 0; i < count; i += stride) { mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld); const values = p.toArray(); if (!values.every(Number.isFinite)) throw new Error('Non-finite skinned vertices'); values.forEach((value, component) => { min[component] = Math.min(min[component], value); max[component] = Math.max(max[component], value); }); n++; } } return { min, max, sampledVertices: n, span: max.map((value, i) => value - min[i]) }; };
    const clips = [];
    for (const clip of expected.clips) { if (!v.clips.find(value => value.name === clip.name)) throw new Error(`Viewer missing embedded clip ${clip.name}`); v.setProfile(clip.name); v.setTime(0); const initial = sample(); let maxSpanRatio = 1; for (const fraction of [.173, .437, .731, .999]) { v.setTime(clip.duration * fraction); const pose = sample(), ratio = Math.max(...pose.span) / Math.max(...initial.span); if (!(ratio > 0 && ratio < 4)) throw new Error(`Exploding/collapsed clip ${clip.name}`); maxSpanRatio = Math.max(maxSpanRatio, ratio); } clips.push({ name: clip.name, samples: 5, sampledVertices: initial.sampledVertices, maxSpanRatio }); }
    v.setProfile(v.clips[0].name); v.setTime(.25); v.setMode('handdrawn');
    const target = v.controls.target, offset = v.camera.position.clone().sub(target), radius = offset.length(), horizontal = Math.hypot(offset.x, offset.z), elevation = 55 * Math.PI / 180;
    v.camera.position.set(target.x + radius * Math.cos(elevation) * offset.x / horizontal, target.y + radius * Math.sin(elevation), target.z + radius * Math.cos(elevation) * offset.z / horizontal); v.camera.lookAt(target); v.controls.update(); v.fit();
    return { stats, textures: [...textures.values()], meshCount: meshes.length, clipSamples: clips, rendererGeometryCount: v.renderer.info.memory.geometries, rendererTextureCount: v.renderer.info.memory.textures };
  }, { expected });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const rendered = await page.evaluate(() => { const source = window.__rigViewer.renderer.domElement, canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height; const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0); const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data, colors = new Set(); let visible = 0; for (let i = 0; i < pixels.length; i += 4) { if (pixels[i + 3]) visible++; if (colors.size < 100) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`); } return { visiblePixels: visible, colorsAtLeast: colors.size }; });
  assert(rendered.visiblePixels > 300 && rendered.colorsAtLeast >= 16, 'Empty/flat viewer render');
  for (const mode of ['cel', 'original', 'handdrawn']) { await page.evaluate(mode => window.__rigViewer.setMode(mode), mode); assert(await page.evaluate(() => window.__rigStats.mode) === mode, 'Material mode did not update'); }
  const previewInfo = skipPreview ? { skipped: true } : await page.evaluate(url => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight }); image.onerror = () => reject(new Error('Thumbnail decode failed')); image.src = url; }), pathToFileURL(preview).href);
  assert(skipPreview || previewInfo.width >= 256 && previewInfo.height >= 256, 'Thumbnail is missing or too small');
  await page.screenshot({ path: path.join(reportDir, `${id}-viewer.png`), fullPage: true });
  await page.locator('canvas').first().screenshot({ path: path.join(reportDir, `${id}-game55.png`) });
  const downloadPending = page.waitForEvent('download'); await page.locator('#download').click(); const download = await downloadPending;
  const downloaded = fs.readFileSync(await download.path()), downloadHash = hash(downloaded); assert(downloadHash === expected.sha256, 'Offline viewer downloads a different GLB');
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Individual viewer mobile overflow');
  assert(!errors.length && !external.length, `Viewer errors/network: ${errors.join('; ')} ${external.join('; ')}`);
  return { ...state, rendered, preview: previewInfo, download: { bytes: downloaded.length, sha256: downloadHash, exactMatch: true }, gameCameraElevationDegrees: 55, captureScale: 'Each model normalized and fit independently; these screenshots do not certify common-scale size comparisons or human recognizability.', errors, externalRequests: external, mobileOverflow: false };
}
async function inspectGallery(browser, ships) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
  try {
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    const ids = ships.map(ship => ship.id), transitions = [];
    const select = async id => {
      const matches = frame => decodeURIComponent(new URL(frame.url()).pathname).endsWith('/' + id + '.html');
      const existing = page.frames().find(frame => frame !== page.mainFrame() && frame.url() !== 'about:blank' && matches(frame));
      const navigation = existing ? null : page.waitForEvent('framenavigated', { predicate: frame => frame.url() !== 'about:blank' && matches(frame), timeout: 45000 });
      if (await page.evaluate(() => typeof window.__fleetViewer?.selectShip === 'function')) await page.evaluate(id => window.__fleetViewer.selectShip(id), id);
      else await page.locator(`[data-ship-id="${id}"]`).click();
      const frame = existing || await navigation;
      await frame.waitForFunction(() => window.__rigReady === true || window.__rigStats?.error, null, { timeout: 45000 });
      const resource = await frame.evaluate(() => { if (!window.__rigReady || window.__rigStats.error) throw new Error('Gallery child viewer failed'); const v = window.__rigViewer; return { geometryCount: v.renderer.info.memory.geometries, textureCount: v.renderer.info.memory.textures }; });
      const outer = await page.evaluate(() => ({ iframeCount: document.querySelectorAll('iframe').length, frameSrc: document.querySelector('iframe')?.getAttribute('src') }));
      return { ...resource, ...outer };
    };
    const first = await select(ids[0]);
    for (let i = 0; i < 20; i++) { const id = ids[(i + 1) % ids.length], state = await select(id); assert(state.iframeCount === 1 && page.frames().length <= 2, 'Gallery retains multiple live viewer frames'); transitions.push({ id, ...state }); }
    const last = await select(ids[0]); assert(first.geometryCount === last.geometryCount && first.textureCount === last.textureCount, 'Gallery renderer resources grow after switching back to original model');
    const thumbnails = await page.evaluate(() => [...document.images].filter(image => (image.getAttribute('src') || '').includes('previews/')).map(image => ({ src: image.getAttribute('src'), loading: image.getAttribute('loading'), decoded: image.complete && image.naturalWidth > 0 })));
    assert(thumbnails.length === ships.length && thumbnails.every(image => image.loading === 'lazy'), 'Gallery thumbnail coverage/lazy attributes mismatch');
    const decodedThumbnails = thumbnails.filter(image => image.decoded).length;
    if (ships.length > 30) assert(decodedThumbnails < ships.length, 'Gallery eagerly decoded the entire thumbnail corpus');
    await page.screenshot({ path: path.join(reportDir, 'gallery-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Gallery mobile overflow'); await page.screenshot({ path: path.join(reportDir, 'gallery-mobile.png'), fullPage: true });
    assert(!errors.length && !external.length, 'Gallery JS errors or external requests');
    return { transitions, first, last, maximumLiveFrames: 1, lazyThumbnails: thumbnails.length, decodedThumbnails, undecodedThumbnails: thumbnails.length - decodedThumbnails, errors, externalRequests: external, mobileOverflow: false, limitation: 'One live iframe and stable current-renderer resources verified; browser internal GPU reclamation and production game performance are not certified.' };
  } finally { await page.close(); }
}
async function main() {
  const report = { scope: 'Fleet catalog, glTF rig/painted assets and offline previews; no gameplay or human-readability certification.', validator: validator.version(), assets: [], failures: [], passed: false };
  let browser;
  try {
    const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8')), output = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
    report.sourceCatalog = verifySourceCatalog(source);
    const fullPlanned = rows(source), fullProduced = rows(output);
    const planned = selectedIds ? fullPlanned.filter(ship => selectedIds.includes(ship.id)) : fullPlanned, produced = selectedIds ? fullProduced.filter(ship => selectedIds.includes(ship.id)) : fullProduced;
    if (selectedIds) assert(selectedIds.every(id => planned.some(ship => ship.id === id)), 'Unknown --ids selection');
    report.mode = { selectedIds: selectedIds || null, structureOnly, skipPreview, fullCorpus: !selectedIds && !structureOnly && !skipPreview };
    assert(planned.length > 0 && produced.length > 0, 'Empty source/output catalog');
    const plannedIds = planned.map(row => row.id), outputIds = produced.map(row => row.id);
    assert(plannedIds.every(id => id && /^[a-zA-Z0-9_-]+$/.test(id)) && new Set(plannedIds).size === planned.length && new Set(outputIds).size === produced.length, 'Invalid/duplicate catalog IDs');
    assert(plannedIds.length === outputIds.length && plannedIds.every(id => outputIds.includes(id)), `Catalog coverage mismatch: missing ${plannedIds.filter(id => !outputIds.includes(id))}, extra ${outputIds.filter(id => !plannedIds.includes(id))}`);
    report.coverage = { plannedTotal: fullPlanned.length, producedTotal: fullProduced.length, selectedPlanned: planned.length, selectedProduced: produced.length, ids: plannedIds, complete: fullPlanned.length === fullProduced.length && fullPlanned.every(ship => fullProduced.some(value => value.id === ship.id)), selectedComplete: true };
    report.originals = verifyOriginals();
    if (!structureOnly) browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
    for (const spec of planned) {
      const entry = produced.find(row => row.id === spec.id), result = { id: spec.id, name: spec.name || spec.title, passed: false };
      try {
        const glb = artifactFile(entry.assetPath || entry.glb || entry.model, `ships/${spec.id}.glb`), viewer = artifactFile(entry.viewerPath || entry.viewer || entry.html, `ships/${spec.id}.html`), preview = artifactFile(entry.previewPath || entry.preview || entry.thumbnail, `previews/${spec.id}.png`);
        const bytes = fs.readFileSync(glb); result.asset = inspect(bytes, spec, entry);
        const validation = await validator.validateBytes(new Uint8Array(bytes), { uri: path.basename(glb), maxIssues: 1000, writeTimestamp: false });
        result.validation = { errors: validation.issues.numErrors, warnings: validation.issues.numWarnings, infos: validation.issues.numInfos, hints: validation.issues.numHints, messages: validation.issues.messages };
        fs.writeFileSync(path.join(reportDir, `${spec.id}-gltf.json`), JSON.stringify(validation, null, 2));
        assert(!validation.issues.numErrors && !validation.issues.numWarnings, 'Khronos glTF validation errors/warnings');
        if (!structureOnly) {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
        try { result.viewer = await inspectViewer(page, spec.id, viewer, preview, result.asset); } finally { await page.close(); }
        }
        result.passed = true;
      } catch (error) { result.failure = error.stack || String(error); report.failures.push({ id: spec.id, message: error.message }); }
      report.assets.push(result);
      fs.writeFileSync(path.join(reportDir, 'qa-result.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ id: result.id, passed: result.passed, triangles: result.asset?.triangles, modules: result.asset?.moduleCount, failure: result.failure?.split('\n')[0] }));
    }
    if (!report.failures.length && !structureOnly && !selectedIds) report.gallery = await inspectGallery(browser, produced);
    report.originalsAfter = verifyOriginals();
    const fingerprintGroups = new Map(); for (const item of report.assets) if (item.asset) { const key = item.asset.geometryFingerprint; if (!fingerprintGroups.has(key)) fingerprintGroups.set(key, []); fingerprintGroups.get(key).push(item.id); }
    report.duplicateGeometryCandidates = [...fingerprintGroups.values()].filter(group => group.length > 1);
    report.duplicateGeometryNote = 'Candidates require semantic/manual review. Shared hulls in planned loadouts are legitimate; different paint alone is insufficient for rival/faction signatures.';
    report.passed = report.failures.length === 0 && report.assets.length === planned.length && (structureOnly || !!selectedIds || !!report.gallery);
    report.fullCorpusPassed = report.passed && report.mode.fullCorpus && report.coverage.complete;
  } catch (error) { report.failure = error.stack || String(error); }
  finally {
    if (browser) await browser.close(); fs.writeFileSync(path.join(reportDir, 'qa-result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, fullCorpusPassed: report.fullCorpusPassed || false, mode: report.mode, checked: report.assets.length, failures: report.failures, failure: report.failure, report: path.relative(repoPath('.'), path.join(reportDir, 'qa-result.json')) }, null, 2));
    if (!report.passed) process.exitCode = 1;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
