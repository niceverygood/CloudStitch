import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectGlb } from '../../fleet-v2/verify.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUTPUT = 'outputs/enemy-fleet-reference-v2';
const IDS = ['enemy-pirate-scout', 'enemy-cult-blockade', 'enemy-union-salvage', 'enemy-union-repair', 'enemy-ghost-chaser', 'enemy-disguised-wreck'];
const CLIPS = ['FloatIdle', 'Cruise', 'BankTurn', 'GustRecovery', 'TurretScan', 'WinchCycle', 'FireBurst'];
const COUNTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stable = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const same = (a, b) => stable(a) === stable(b);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fail = message => { throw new Error(message); };

function inside(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || /^[a-z]+:/i.test(relative) || relative.includes('\\')) fail('Expected a local relative path');
  const resolved = path.resolve(root, relative), distance = path.relative(root, resolved);
  if (distance === '..' || distance.startsWith('..' + path.sep) || path.isAbsolute(distance)) fail('Path escapes the expected root');
  return resolved;
}

function parseGlb(bytes) {
  const chunks = []; let offset = 12;
  while (offset < bytes.length) { const size = bytes.readUInt32LE(offset), kind = bytes.readUInt32LE(offset + 4); chunks.push({ kind, data: bytes.subarray(offset + 8, offset + 8 + size) }); offset += size + 8; }
  return { gltf: JSON.parse(chunks.find(chunk => chunk.kind === 0x4e4f534a).data.toString('utf8').trim()), bin: chunks.find(chunk => chunk.kind === 0x004e4942)?.data || Buffer.alloc(0) };
}

function component(bin, offset, type) {
  return type === 5120 ? bin.readInt8(offset) : type === 5121 ? bin.readUInt8(offset) : type === 5122 ? bin.readInt16LE(offset) : type === 5123 ? bin.readUInt16LE(offset) : type === 5125 ? bin.readUInt32LE(offset) : bin.readFloatLE(offset);
}

function accessorReader(gltf, bin) {
  const sparse = new Map();
  function layout(id) { const a = gltf.accessors[id]; if (!a) fail('Missing numeric accessor'); const v = gltf.bufferViews[a.bufferView]; return { a, v, bytes: BYTES[a.componentType], count: COUNTS[a.type], stride: v?.byteStride || COUNTS[a.type] * BYTES[a.componentType] }; }
  function sparseRows(id, a) {
    if (sparse.has(id)) return sparse.get(id);
    const result = new Map(), s = a.sparse;
    if (s) { const iv = gltf.bufferViews[s.indices.bufferView], vv = gltf.bufferViews[s.values.bufferView], size = COUNTS[a.type] * BYTES[a.componentType];
      for (let i = 0; i < s.count; i++) result.set(component(bin, (iv.byteOffset || 0) + (s.indices.byteOffset || 0) + i * BYTES[s.indices.componentType], s.indices.componentType), (vv.byteOffset || 0) + (s.values.byteOffset || 0) + i * size);
    }
    sparse.set(id, result); return result;
  }
  return function value(id, row, channel = 0) {
    const { a, v, bytes, stride } = layout(id), sparseOffset = sparseRows(id, a).get(row);
    if (sparseOffset !== undefined) return component(bin, sparseOffset + channel * bytes, a.componentType);
    return v ? component(bin, (v.byteOffset || 0) + (a.byteOffset || 0) + row * stride + channel * bytes, a.componentType) : 0;
  };
}

function uriReferences(value, trail = '', found = []) {
  if (Array.isArray(value)) value.forEach((child, index) => uriReferences(child, trail + '[' + index + ']', found));
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { if (key === 'uri' && child) found.push({ path: trail + '.uri', uri: child }); else if (child && typeof child === 'object') uriReferences(child, trail + '.' + key, found); }
  return found;
}

function embeddedImageInfo(gltf, bin) {
  return (gltf.images || []).map((image, index) => {
    if (image.uri) fail('External/URI image resource');
    const view = gltf.bufferViews[image.bufferView], bytes = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    if (image.mimeType !== 'image/png' || bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.toString('ascii', 12, 16) !== 'IHDR') fail('Expected an embedded PNG image with valid header');
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20); if (!width || !height) fail('Empty embedded PNG');
    return { index, mimeType: image.mimeType, bytes: bytes.length, width, height, pixelDecodingVerified: false };
  });
}

/** Real numeric/identity/rig checks on a new GLB. No renderer or model source mutation. */
export function inspectEnemyRig(bytes, ship) {
  const structure = inspectGlb(bytes), { gltf, bin } = parseGlb(bytes), value = accessorReader(gltf, bin), nodes = gltf.nodes || [], extras = gltf.scenes[gltf.scene || 0].extras || {};
  const names = new Map(), duplicates = [];
  nodes.forEach((node, index) => { if (!node.name) return; if (names.has(node.name)) duplicates.push(node.name); else names.set(node.name, index); });
  if (duplicates.length) fail('Duplicate actual GLB node names: ' + duplicates.join(', '));
  const uris = uriReferences(gltf); if (uris.length) fail('GLB has non-embedded URI resources');
  let floatAccessors = 0, floatValues = 0;
  for (const [id, accessor] of gltf.accessors.entries()) if (accessor.componentType === 5126) {
    floatAccessors++;
    for (let row = 0; row < accessor.count; row++) for (let channel = 0; channel < COUNTS[accessor.type]; channel++) { if (!Number.isFinite(value(id, row, channel))) fail(`NaN/Infinity in FLOAT accessor ${id}/${row}/${channel}`); floatValues++; }
  }
  const allJoints = new Set((gltf.skins || []).flatMap(skin => skin.joints));
  const bone = name => { const node = names.get(name); return { nodeName: name, nodeIndex: node ?? null, isSkinJoint: node !== undefined && allJoints.has(node) }; };
  const weakpoints = (ship.weakpoints || []).map(point => ({ id: point.id, label: point.label, kind: point.kind, ...bone(point.nodeName) }));
  if (!weakpoints.length || weakpoints.some(point => !point.isSkinJoint)) fail('Weakpoint does not reference an actual skin joint');
  if (new Set(weakpoints.map(point => point.id)).size !== weakpoints.length || new Set(weakpoints.map(point => point.nodeName)).size !== weakpoints.length) fail('Duplicate weakpoint ID/node reference');
  const animations = [];
  for (const animation of gltf.animations || []) {
    let duration = 0;
    for (const sampler of animation.samplers) {
      const input = gltf.accessors[sampler.input], output = gltf.accessors[sampler.output]; let previous = -Infinity;
      for (let row = 0; row < input.count; row++) { const time = value(sampler.input, row); if (!Number.isFinite(time) || time < 0 || time <= previous) fail('Animation input times are not finite, positive and strictly increasing'); previous = time; }
      duration = Math.max(duration, previous);
      if (output.count !== input.count * (sampler.interpolation === 'CUBICSPLINE' ? 3 : 1)) fail('Animation output/time sample counts differ');
    }
    if (!(duration > 0)) fail('Animation has no positive duration');
    const targets = animation.channels.map(channel => ({ nodeIndex: channel.target.node, nodeName: nodes[channel.target.node].name, path: channel.target.path, sampler: channel.sampler }));
    for (const channel of animation.channels) { const accessor = gltf.accessors[animation.samplers[channel.sampler].output], size = channel.target.path === 'rotation' ? 4 : 3; if (channel.target.path !== 'weights' && COUNTS[accessor.type] !== size) fail('Animation output dimensions differ from target property'); }
    animations.push({ name: animation.name, duration, channels: animation.channels.length, targets });
  }
  const expectedClips = ship.id === 'enemy-disguised-wreck' ? [...CLIPS, 'AmbushReveal'] : CLIPS;
  if (!same(structure.clips.slice().sort(), expectedClips.slice().sort())) fail('Expected exactly seven base clips; only the disguised wreck adds AmbushReveal');
  const deployments = [];
  if (ship.id === 'enemy-disguised-wreck') {
    if (!ship.deployRig?.nodeNames || ship.deployRig.nodeNames.length !== 3 || new Set(ship.deployRig.nodeNames).size !== 3) fail('Expected three explicit deployment bones');
    if (!same(ship.deployRig, extras.deployRig)) fail('Catalog/embedded deployment metadata differ');
    const reveal = gltf.animations.find(animation => animation.name === 'AmbushReveal');
    if (reveal.channels.length !== 3) fail('AmbushReveal must target exactly the three fold bones');
    for (const name of ship.deployRig.nodeNames) {
      const entry = bone(name), node = nodes[entry.nodeIndex], channel = reveal.channels.find(item => item.target.node === entry.nodeIndex && item.target.path === 'rotation');
      if (!entry.isSkinJoint || !channel || !['x', 'y', 'z'].includes(node.extras?.deploymentAxis) || !Number.isFinite(node.extras?.deployedAngle)) fail('Missing real fold bone/rotation channel/deployment axis');
      const sampler = reveal.samplers[channel.sampler], output = gltf.accessors[sampler.output], first = [0, 1, 2, 3].map(i => value(sampler.output, 0, i)), last = [0, 1, 2, 3].map(i => value(sampler.output, output.count - 1, i));
      const dot = Math.min(1, Math.abs(first.reduce((sum, n, index) => sum + n * last[index], 0))), rotationRadians = 2 * Math.acos(dot);
      if (rotationRadians < .5 || Math.abs(rotationRadians - Math.abs(node.extras.deployedAngle)) > .005) fail('Fold rotation clip is neutral or differs from declared deployment');
      deployments.push({ ...entry, axis: node.extras.deploymentAxis, declaredAngle: node.extras.deployedAngle, observedRotationRadians: rotationRadians, animation: 'AmbushReveal' });
    }
    if (!ship.availableActions?.includes('AmbushReveal') || !extras.availableActions?.includes('AmbushReveal')) fail('Deployment clip is not exposed in actions metadata');
  } else if (ship.deployRig?.nodeNames?.length) fail('Unexpected deployment rig on another archetype');
  for (const node of nodes) if (node.mesh !== undefined && node.skin !== undefined) {
    const skin = gltf.skins[node.skin];
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const jointsId = primitive.attributes.JOINTS_0, weightsId = primitive.attributes.WEIGHTS_0;
      if (jointsId === undefined || weightsId === undefined) fail('Skinned primitive lacks weights/joints');
      const joints = gltf.accessors[jointsId], weights = gltf.accessors[weightsId]; if (joints.type !== 'VEC4' || weights.type !== 'VEC4') fail('Expected VEC4 skin weights and joints');
      for (let row = 0; row < joints.count; row++) {
        let sum = 0;
        for (let component = 0; component < 4; component++) { const index = value(jointsId, row, component), weight = value(weightsId, row, component); if (!Number.isInteger(index) || index < 0 || index >= skin.joints.length || weight < 0) fail('Skin joint index/weight is out of range'); sum += weight; }
        if (weights.componentType === 5126 && Math.abs(sum - 1) > .001) fail('Skin weights do not sum to one');
      }
    }
  }
  return { ...structure, sha256: hash(bytes), skinJointCount: allJoints.size, weakpoints, deploymentNodes: deployments, animations, images: embeddedImageInfo(gltf, bin), numeric: { floatAccessors, floatValuesChecked: floatValues, nonfiniteValues: 0, duplicateNames: [] }, externalResourceUris: uris, embedded: extras };
}

export async function verifyEnemyFleet({ repoRoot = ROOT, writeReport = true } = {}) {
  const report = { version: 'enemy-reference-villain-structural-2', checkedAt: new Date().toISOString(), passed: false, scope: 'Six new reference GLBs only; actual binary, rig and metadata structure', catalogChecks: [], ships: [], errors: [], warnings: [], browserExecuted: false, browserNetworkVerified: false, imagePixelsDecoded: false, visualPreferencePassed: null, actualGameplayVerified: false, frozenModelsRehashed: 0 };
  const check = (name, passed, detail) => { report.catalogChecks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) }); if (!passed) report.errors.push(name); };
  try {
    const catalog = JSON.parse(await readFile(inside(repoRoot, OUTPUT + '/catalog.json'), 'utf8')), source = JSON.parse(await readFile(inside(repoRoot, 'tools/fleet/catalog.json'), 'utf8'));
    const ids = (catalog.ships || []).map(ship => ship.id);
    check('Exactly the six source enemy-archetype IDs are present', same([...ids].sort(), [...IDS].sort()) && new Set(ids).size === 6 && catalog.assetCount === 6);
    check('Catalog explicitly limits scope to independent reference art', /independent reference/i.test(catalog.scope || '') && /no automatic combat replacement/i.test(catalog.scope || ''));
    for (const [key, file] of [['referenceSha256', 'reference.png'], ['atlasSha256', 'painted-atlas.png']]) { const bytes = await readFile(inside(repoRoot, OUTPUT + '/' + (key === 'referenceSha256' ? catalog.referencePath : catalog.atlasPath))); check(file + ' matches catalog SHA256', validHash(catalog[key]) && catalog[key] === hash(bytes), { bytes: bytes.length, sha256: hash(bytes) }); }
    for (const ship of catalog.ships || []) {
      const original = source.ships.find(item => item.id === ship.id), entry = { id: ship.id, passed: false, errors: [] }; report.ships.push(entry);
      try {
        if (!original || !same(original.modules, ship.modules) || ship.category !== original.category || ship.name !== original.name || !same(ship.sourceFiles, original.sourceFiles)) entry.errors.push('Original ID/name/category/source/modules including null were changed');
        if (!ship.artModules || same(ship.artModules, ship.modules) || Object.entries(ship.modules).some(([key, count]) => Number.isInteger(count) && ship.artModules[key] !== count)) entry.errors.push('Art placements and confirmed modules are not preserved separately');
        if (ship.assetPath !== `ships/${ship.id}.glb` || ship.viewerPath !== `ships/${ship.id}.html`) fail('Unexpected same-ID model/viewer path');
        const bytes = await readFile(inside(repoRoot, OUTPUT + '/' + ship.assetPath)), inspected = inspectEnemyRig(bytes, ship), embedded = inspected.embedded; entry.observed = inspected;
        entry.clipMetadata = { metricsScope: 'rigAndAnimate base seven clip statistics; AmbushReveal is appended after those statistics', metricsBaseClipNames: (ship.metrics?.clips || []).map(clip => clip.name), actualGlbClipNames: inspected.clips, observedClipsFieldPresent: Array.isArray(ship.observedClips) };
        if (!same(entry.clipMetadata.metricsBaseClipNames.slice().sort(), CLIPS.slice().sort())) entry.errors.push('Shared rig metrics must describe the seven base clips');
        if (ship.observedClips !== undefined && !same(ship.observedClips, inspected.clips)) entry.errors.push('Catalog observedClips differ from the actual GLB animations');
        if (!validHash(ship.sha256) || ship.sha256 !== inspected.sha256 || ship.bytes !== bytes.length) entry.errors.push('Actual GLB SHA256/bytes differ from catalog');
        if (ship.geometrySignature !== inspected.observedGeometrySignature) entry.errors.push('Actual POSITION/index signature differs from catalog');
        if (!same(ship.observedBounds, inspected.staticNodeBounds) || !inspected.staticNodeBounds?.size.every(n => Number.isFinite(n) && n > 0)) entry.errors.push('Actual finite bounds differ from catalog');
        if (ship.triangles !== inspected.triangles || ship.metrics?.triangles !== inspected.triangles || ship.metrics?.meshCount !== inspected.meshes || ship.metrics?.bones !== inspected.skinJointCount) entry.errors.push('Actual mesh/triangle/bone counts differ from catalog');
        if (embedded.variantId !== ship.variantId || embedded.baseModelSha256 !== ship.baseModelSha256 || !embedded.villainTheme) entry.errors.push('Villain variant/base provenance missing');
        if (embedded.assetId !== ship.id || embedded.forwardAxis !== '-X' || embedded.upAxis !== '+Y' || !/not metres/i.test(embedded.authoredUnits || '')) entry.errors.push('Embedded model identity/axis/temporary-unit contract differs');
        if (!same(embedded.confirmedModules, original.modules) || !same(embedded.artModules, ship.artModules) || !same(embedded.weakpoints, ship.weakpoints) || !same(embedded.features, ship.features)) entry.errors.push('Embedded original modules/art/weakpoints/features differ from source/catalog');
        if (embedded.referenceSha256 !== catalog.referenceSha256 || !/art-only/i.test(embedded.gameplayIntegration || '') || !/unchanged/i.test(embedded.gameplayIntegration || '')) entry.errors.push('Embedded reference/simulation limitation is missing');
        if (!same(embedded.availableActions, ship.availableActions)) entry.errors.push('Available-actions metadata differs from catalog');
        const viewer = await stat(inside(repoRoot, OUTPUT + '/' + ship.viewerPath)); if (!viewer.isFile() || viewer.size <= 0) entry.errors.push('Missing standalone viewer');
      } catch (error) { entry.errors.push(error.message); }
      entry.passed = entry.errors.length === 0; if (!entry.passed) report.errors.push(ship.id + ': ' + entry.errors.join('; '));
    }
    const signatures = report.ships.map(ship => ship.observed?.observedGeometrySignature).filter(Boolean);
    check('The six actual geometry signatures are all distinct', signatures.length === 6 && new Set(signatures).size === 6);
    report.summary = { models: report.ships.length, passedModels: report.ships.filter(ship => ship.passed).length, uniqueGeometrySignatures: new Set(signatures).size, baseClipInstances: report.ships.reduce((sum, ship) => sum + (ship.observed?.clips || []).filter(name => CLIPS.includes(name)).length, 0), totalActualClips: report.ships.reduce((sum, ship) => sum + (ship.observed?.clips.length || 0), 0), weakpointBones: report.ships.reduce((sum, ship) => sum + (ship.observed?.weakpoints.length || 0), 0), deploymentBones: report.ships.reduce((sum, ship) => sum + (ship.observed?.deploymentNodes.length || 0), 0), embeddedImages: report.ships.reduce((sum, ship) => sum + (ship.observed?.images.length || 0), 0), externalResourceUris: report.ships.reduce((sum, ship) => sum + (ship.observed?.externalResourceUris.length || 0), 0), floatValuesChecked: report.ships.reduce((sum, ship) => sum + (ship.observed?.numeric.floatValuesChecked || 0), 0), totalTriangles: report.ships.reduce((sum, ship) => sum + (ship.observed?.triangles || 0), 0), totalModelBytes: report.ships.reduce((sum, ship) => sum + (ship.observed?.bytes || 0), 0) };
    report.warnings.push('GLB URI/resource inspection proves self-contained structure, not absence of browser network requests. No browser ran during this verification.');
    report.warnings.push('Seven base animation channels may be neutral where the ship lacks the device. Actual channel counts, finite keys and target nodes are checked; visual motion quality remains separate.');
    report.warnings.push('AmbushReveal rotates three real fold joints as a presentation demonstration. This does not implement disguise AI, collision/state transitions, damage or attack warnings.');
    report.warnings.push('Bounds are base node-transformed POSITION bounds, not animated skin/camera silhouettes. Embedded image headers are checked without pixel decoding or artistic approval. Original frozen fleet models were not opened or rehashed.');
  } catch (error) { report.errors.push(error.message); }
  report.passed = report.errors.length === 0;
  if (writeReport) await writeFile(inside(repoRoot, OUTPUT + '/structural-verification.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

async function main() {
  const args = process.argv.slice(2); if (args.length) { if (args.length === 1 && args[0] === '--help') { console.log('node tools/enemy-fleet-reference/villain-v2/verify.mjs\nChecks only the six new GLBs/catalog/reference/atlas; no browser. Writes outputs/enemy-fleet-reference-v2/structural-verification.json'); return; } fail('Only --help is supported; the structural check covers all six new GLBs'); }
  const report = await verifyEnemyFleet(); console.log(JSON.stringify({ passed: report.passed, summary: report.summary, errors: report.errors, report: OUTPUT + '/structural-verification.json' })); if (!report.passed) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
