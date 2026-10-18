/* Reuse static source GLB geometry/textures in seven explicitly proposed scenes.
 * Original assets and the selected airship are never rewritten. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { makeWorldKit, THREE } from './core.mjs';
import checks from '../qa/world-gltf.cjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), OUT = path.join(ROOT, 'outputs/world-assets');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); };
globalThis.FileReader ??= class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }).catch(error => this.onerror?.(error)); } readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = 'data:' + blob.type + ';base64,' + Buffer.from(value).toString('base64'); this.onloadend?.(); }).catch(error => this.onerror?.(error)); } };

function composer(name) {
  const json = { asset: { version: '2.0', generator: 'Cloudstitch static world assembly composer' }, scene: 0, scenes: [{ name, nodes: [] }], buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [], materials: [], meshes: [], nodes: [], textures: [], images: [], samplers: [] };
  const chunks = [], imports = new Map(), used = new Set(), required = new Set(); let binaryLength = 0;
  function append(bytes) { const offset = binaryLength; chunks.push(bytes); binaryLength += bytes.length; const pad = (4 - binaryLength % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); binaryLength += pad; } return offset; }
  function importSource(source) {
    if (imports.has(source.sha256)) return imports.get(source.sha256);
    const { json: s, bin } = checks.parseGLB(source.bytes);
    if (s.skins?.length || s.animations?.length) throw new Error('Static scene assembly requires unskinned static source assets: ' + source.id);
    if ((s.buffers || []).some(buffer => buffer.uri)) throw new Error('Composer expects a binary embedded buffer: ' + source.id);
    const base = { view: json.bufferViews.length, accessor: json.accessors.length, material: json.materials.length, mesh: json.meshes.length, texture: json.textures.length, image: json.images.length, sampler: json.samplers.length };
    const offset = append(bin);
    for (const view of s.bufferViews || []) json.bufferViews.push({ ...view, buffer: 0, byteOffset: (view.byteOffset || 0) + offset });
    for (const accessor of s.accessors || []) { const a = structuredClone(accessor); if (a.bufferView !== undefined) a.bufferView += base.view; if (a.sparse) { a.sparse.indices.bufferView += base.view; a.sparse.values.bufferView += base.view; } json.accessors.push(a); }
    const fixTextureInfo = object => { if (!object || typeof object !== 'object') return; for (const [key, value] of Object.entries(object)) { if (/Texture$/.test(key) && value?.index !== undefined) value.index += base.texture; else if (value && typeof value === 'object') fixTextureInfo(value); } };
    for (const material of s.materials || []) { const m = structuredClone(material); fixTextureInfo(m); json.materials.push(m); }
    for (const mesh of s.meshes || []) { const m = structuredClone(mesh); for (const p of m.primitives) { for (const key of Object.keys(p.attributes)) p.attributes[key] += base.accessor; if (p.indices !== undefined) p.indices += base.accessor; if (p.material !== undefined) p.material += base.material; for (const target of p.targets || []) for (const key of Object.keys(target)) target[key] += base.accessor; } json.meshes.push(m); }
    for (const image of s.images || []) { const i = structuredClone(image); if (i.bufferView !== undefined) i.bufferView += base.view; json.images.push(i); }
    for (const texture of s.textures || []) { const t = structuredClone(texture); if (t.source !== undefined) t.source += base.image; if (t.sampler !== undefined) t.sampler += base.sampler; for (const extension of Object.values(t.extensions || {})) if (extension.source !== undefined) extension.source += base.image; json.textures.push(t); }
    json.samplers.push(...structuredClone(s.samplers || [])); (s.extensionsUsed || []).forEach(value => used.add(value)); (s.extensionsRequired || []).forEach(value => required.add(value));
    const sceneRoots = s.scenes[s.scene ?? 0].nodes || [], reachable = new Set();
    const visit = index => { if (reachable.has(index)) return; reachable.add(index); for (const child of s.nodes[index].children || []) visit(child); }; sceneRoots.forEach(visit);
    const record = { source: s, base, sceneRoots, reachable: [...reachable] }; imports.set(source.sha256, record); return record;
  }
  function instance(source, matrix, instanceName) {
    const imported = importSource(source), s = imported.source;
    const indices = new Map(imported.reachable.map((old, index) => [old, json.nodes.length + index]));
    for (const old of imported.reachable) {
      const node = structuredClone(s.nodes[old]); node.name = instanceName + '/' + (node.name || old); if (node.mesh !== undefined) node.mesh += imported.base.mesh; if (node.children) node.children = node.children.map(index => indices.get(index)); delete node.camera; json.nodes.push(node);
    }
    const parent = json.nodes.push({ name: instanceName, matrix: matrix.toArray(), children: imported.sceneRoots.map(index => indices.get(index)) }) - 1; json.scenes[0].nodes.push(parent);
  }
  function finish(extras) {
    json.buffers[0].byteLength = binaryLength; if (used.size) json.extensionsUsed = [...used]; if (required.size) json.extensionsRequired = [...required]; json.scenes[0].extras = extras;
    for (const key of ['textures', 'images', 'samplers']) if (!json[key].length) delete json[key];
    return checks.makeGLB(json, Buffer.concat(chunks));
  }
  return { instance, finish, uniqueImportCount: () => imports.size };
}

function selectedAirshipCopy(bytes) {
  const parsed = checks.parseGLB(bytes), json = parsed.json, bin = Buffer.from(parsed.bin);
  let repaired = 0;
  const offset = (accessor, index, components = 3) => { const view = json.bufferViews[accessor.bufferView]; const componentBytes = accessor.componentType === 5125 || accessor.componentType === 5126 ? 4 : accessor.componentType === 5123 ? 2 : 1; return (view.byteOffset || 0) + (accessor.byteOffset || 0) + index * (view.byteStride || components * componentBytes); };
  for (const mesh of json.meshes || []) for (const primitive of mesh.primitives) {
    if (primitive.attributes.NORMAL === undefined) continue;
    const normal = json.accessors[primitive.attributes.NORMAL], position = json.accessors[primitive.attributes.POSITION], indices = primitive.indices === undefined ? null : json.accessors[primitive.indices];
    if (normal.componentType !== 5126 || position.componentType !== 5126 || normal.sparse) throw new Error('Selected-airship copy normal repair expects ordinary float VEC3 attributes.');
    const vertex = index => !indices ? index : indices.componentType === 5125 ? bin.readUInt32LE(offset(indices, index, 1)) : indices.componentType === 5123 ? bin.readUInt16LE(offset(indices, index, 1)) : bin.readUInt8(offset(indices, index, 1));
    const point = index => { const at = offset(position, index); return new THREE.Vector3(bin.readFloatLE(at), bin.readFloatLE(at + 4), bin.readFloatLE(at + 8)); };
    let changed = false;
    for (let index = 0; index < normal.count; index++) {
      const at = offset(normal, index), value = new THREE.Vector3(bin.readFloatLE(at), bin.readFloatLE(at + 4), bin.readFloatLE(at + 8)); if (value.lengthSq() > 1e-12) continue;
      const sum = new THREE.Vector3();
      for (let triangle = 0; triangle < (indices?.count || position.count); triangle += 3) {
        const ids = [vertex(triangle), vertex(triangle + 1), vertex(triangle + 2)]; if (!ids.includes(index)) continue;
        const a = point(ids[0]), b = point(ids[1]), c = point(ids[2]); sum.add(b.sub(a).cross(c.sub(a)));
      }
      if (sum.lengthSq() < 1e-12) sum.set(0, 1, 0); else sum.normalize();
      bin.writeFloatLE(sum.x, at); bin.writeFloatLE(sum.y, at + 4); bin.writeFloatLE(sum.z, at + 8); repaired++; changed = true;
    }
    if (changed && (normal.min || normal.max)) {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let index = 0; index < normal.count; index++) for (let component = 0; component < 3; component++) { const value = bin.readFloatLE(offset(normal, index) + component * 4); min[component] = Math.min(min[component], value); max[component] = Math.max(max[component], value); }
      if (normal.min) normal.min = min; if (normal.max) normal.max = max;
    }
  }
  if (repaired > 2) throw new Error('Selected-airship source unexpectedly needs more than the two approved zero-normal repairs.');
  return { bytes: repaired ? checks.makeGLB(json, bin) : Buffer.from(bytes), repaired };
}

function planScene(scene) {
  const plan = [], add = (id, position, options = {}) => plan.push({ id, position, ...options });
  const row = (ids, y, z, start = -3.5, step = 1.4) => ids.forEach((id, index) => add(id, [start + index * step, y, z]));
  switch (scene.id) {
    case 'jonghang-harbor':
      for (const x of [-6.3, 0, 6.3]) add('platform-square', [x, 0, -3.3], { scale: [1.38, 1, 1.30] });
      add('platform-square', [-6.3, 0, 3.7], { scale: [1.38, 1, 1.30] }); add('platform-round', [0, 0, 3.7], { scale: [1.75, 1, 1.75] }); add('platform-square', [6.3, 0, 3.7], { scale: [1.38, 1, 1.30] });
      add('harbor-inn', [-6.3, .58, -3.3],{longest:5.2}); add('repair-workshop', [0, .58, -3.3],{longest:5.0}); add('canvas-market', [6.3, .58, -3.3],{longest:5.3}); add('harbor-office', [-6.3, .58, 3.7], { height: 4.4 }); add('beacon-lighthouse', [7.8, .58, 3.5], { height: 7 });
      for (const x of [-3.15, 3.15]) { add('dock-straight', [x, .25, -3.3], { yaw: Math.PI / 2 }); add('bridge-arched', [x, .24, 3.7], { yaw: Math.PI / 2, scale: .85 }); }
      add('dock-straight', [0, .25, .1]); add('dock-tee', [0, .25, 1.9]); add('dock-corner', [3.8, .25, 5.6]);
      add('empty-bell-frame', [-1.5, .58, 5.2]); add('market-stall', [4.5, .58, .2], { scale: .8 }); add('repair-station', [1.2, .58, -.1]); add('mission-board', [-3.8, .58, 1.7]); add('memory-desk', [-1.8, .58, 2.6]); add('departure-console', [1.1, .58, 5.2]);
      add('table-round', [-4.1, .58, 5.1], { scale: .8 }); add('bench-wood', [-3.8, .58, 6.1]); add('lantern-hanging', [2.7, 2.4, 4.5]); add('flower-planter', [-8.5, .58, 1.0]); add('flower-planter', [7, .58, .2]);
      for (const x of [-5, 0, 5]) add('rail-rope', [x, .58, 7], { scale: .85 });
      // Scene-only hanging infrastructure is separate from the 96 asset count.
      for (const z of [-6.3, 7.1]) { add('@suspension-beam', [0, 10.1, z], { anchor: 'center' }); add('@suspension-beam', [0, -.18, z], { anchor: 'center' }); }
      for (const x of [-9.2, 9.2]) add('@suspension-beam', [x, 10.1, .4], { anchor: 'center', yaw: Math.PI / 2, scale: [13.4 / 19.2, 1, 1] });
      for (const x of [-9.2, 9.2]) for (const z of [-6.3, 7.1]) for (let link = 0; link < 32; link++) add('@suspension-link', [x, .2 + link * .31, z], { anchor: 'center', rotation: [Math.PI / 2, link % 2 ? Math.PI / 2 : 0, 0] });
      add('cloud-bank', [-7, -3.9, 2], { scale: [1.3, .32, .8] }); add('cloud-bank', [7, -3.6, 2], { scale: [1.1, .30, .7] });
      add('@selected-airship', [2.2, 3, 8.4], { anchor: 'center', longest: 4.7, yaw: Math.PI / 2 }); break;
    case 'updraft-canyon':
      add('cliff-arch', [-3.5, -3.2, -2], { scale: .95 }); add('cliff-ledge', [3, -2, 1], { scale: [1.2, 1, 1] }); add('cloud-column', [-7, -5, 1], { scale: .8 }); add('mineral-outcrop-teal', [-5, .7, -1]); add('mineral-outcrop-teal', [1.4, 1.4, -1.5], { scale: .7 });
      add('dock-straight', [3.6, 2.6, 1], { scale: [1.4, 1, 1.35] }); add('bridge-short', [.8, 2.6, 1], { yaw: Math.PI / 2 }); add('canopy-canvas', [3.8, 3.0, -.6], { scale: .8 }); add('mooring-ring', [4.8, 3.05, 2.1]); add('mooring-winch', [2.5, 3.05, 2]); add('wind-vane', [4.2, 3.05, -1.3], { scale: .8 }); add('signal-flag', [.3, 3.05, 2.0]); add('tree-windswept', [-5.0, .15, -2], { scale: .65 }); add('hanging-vine', [-1.3, 2.4, 1.7]); add('storage-chest', [4, 3.05, 1.5], { scale: .65 }); add('departure-console', [3, 3.05, -.8], { scale: .7 }); break;
    case 'storm-shelter':
      add('platform-square', [0, 0, 0], { scale: [1.65, 1, 1.65] }); add('storm-cloud-mass', [0, .4, -7.5], { scale: 1.2 }); add('cloud-bank', [-4, -2.4, 1], { scale: [1, .5, .8] }); add('wall-timber', [0, .58, -2], { scale: 1.4 }); add('canopy-canvas', [-1, .58, -.4], { scale: .9 }); add('awning-repair', [1.5, .58, -1.8]); add('dock-endcap', [0, .25, 4.0]); add('boundary-marker', [-2.7, .58, 2.3]); add('beacon-buoy', [3.2, .5, 2.5], { scale: .75 }); add('lantern-standing', [-2, .58, 1.8]);
      row(['canvas-roll', 'rope-coil', 'repair-station', 'storage-chest', 'safety-anchor'], .58, 1.0, -2.3, 1.1); break;
    case 'iron-rib-yard':
      add('platform-square', [0, 0, 0], { scale: [2, 1, 1.65] }); add('industrial-rib', [-3.9, .5, -.8], { scale: .9 }); add('industrial-rib', [3.9, .5, -.8], { scale: .9 }); add('rubble-mound', [-5.5, -.1, -2], { scale: .55 }); add('bridge-short', [-5, .25, 0], { yaw: Math.PI / 2, scale: .8 }); add('dock-ramp', [0, .25, 4], { scale: .9 }); add('rail-rope', [0, .58, -3.1], { scale: 1.5 });
      row(['repair-station', 'crafting-anvil', 'workbench-static', 'tool-rack'], .58, -1.5, -3, 2); row(['scrap-bin', 'fuel-pump', 'lantern-standing', 'harbor-sign'], .58, 1.5, -3, 2); add('salvage-crane', [3, .58, 1.3], { scale: .7 }); break;
    case 'lower-fog-mooring':
      add('platform-round', [0, 0, 0], { scale: [1.8, 1, 1.8] }); add('beacon-lighthouse', [-2, .58, -1.2], { height: 5.8 }); add('memory-observatory', [2.2, .58, -1.4], { height: 3.0 }); add('cloud-bank', [4, -3, 1], { scale: [1.2, .5, .8] }); add('fog-layer', [-6, -1, -2], { scale: .9 }); add('dock-straight', [0, .25, 4.7]); add('awning-repair', [1.0, .58, .8], { scale: .75 });
      row(['departure-console', 'memory-desk', 'canvas-roll', 'storage-chest'], .58, 1.8, -2.5, 1.4); add('beacon-buoy', [3.8, .3, 3.5], { scale: .7 }); add('lantern-hanging', [-.2, 2.4, 2.2]); add('mooring-ring', [-2.8, .58, 2.2]); break;
    case 'royal-service-deck':
      add('royal-stone-platform', [0, 0, 0], { scale: [1.15, 1, 1.15] }); add('platform-square', [0, .49, .5], { scale: [1.2, .7, 1.1] }); add('sealed-stone-fragment', [-3.2, 0, -2], { scale: .7 }); add('dock-stairs', [0, 0, 2.8]); add('rail-rope', [0, .9, -2.0], { scale: 1.2 });
      row(['storage-chest', 'departure-console', 'repair-station'], .9, .5, -1.7, 1.7); row(['canvas-roll', 'crate-wood', 'lantern-standing'], .9, -1.2, -1.7, 1.7); add('safety-anchor', [2.5, .9, 2]); add('compass-rose', [0, .9, 2.1], { scale: .6 }); break;
    case 'world-map-diorama': {
      add('world-map-table', [0, 0, 0]); const y = 1.25;
      const markers = [[-1.15, -.65], [-.4, -.65], [.4, -.65], [1.15, -.45], [.72, .52], [-.48, .52]];
      const land = ['island-grass-small', 'cliff-arch', 'storm-cloud-mass', 'industrial-rib', 'fog-layer', 'royal-stone-platform'];
      const scales = [.13, .07, .10, .09, .10, .13];
      markers.forEach(([x, z], index) => { add(land[index], [x, y, z], { scale: scales[index], region_order: index + 1 }); add('route-node', [x, y, z + .24], { scale: .24, region_order: index + 1 }); });
      for (let i = 0; i < markers.length - 1; i++) { const a = markers[i], b = markers[i + 1], dx = b[0] - a[0], dz = b[1] - a[1]; add('route-segment', [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2 + .24], { yaw: Math.atan2(dx, dz), scale: [.28, .28, Math.hypot(dx, dz) / 1.6] }); }
      add('route-fork', [.0, y, .1], { scale: .3 }); add('route-gate', [1.15, y, -.13], { scale: .2 }); add('compass-rose', [-1.2, y, .6], { scale: .32 }); add('beacon-buoy', [.15, y, .63], { scale: .18 }); break;
    }
    default: throw new Error('Unknown canonical scene: ' + scene.id);
  }
  // Any subsequently added declared detail is shown in a small comparison row;
  // do not silently invent a missing facility or drop a declared source.
  const used = new Set(plan.map(item => item.id)); let extra = 0;
  for (const id of scene.asset_ids) if (!used.has(id)) add(id, [-3 + extra++ * 1.5, .6, 5.5], { scale: .65, role: 'Declared detail comparison placement' });
  return plan;
}

async function makeSceneDetails() {
  const link = makeWorldKit({ id: 'scene-suspension-link', category: 'scene-detail' }); link.ring('teal_chain_link', .14, .035, [0, 0, 0], link.palette.deepTeal); link.ring('brass_link_edge', .14, .014, [0, .027, 0], link.palette.brass);
  const beam = makeWorldKit({ id: 'scene-suspension-beam', category: 'scene-detail' }); beam.bevelBox('upper_city_underframe', [19.2, .32, .45], [0, 0, 0], beam.palette.woodDark); for (const x of [-9, 0, 9]) beam.bevelBox('brass_frame_collar', [.24, .39, .53], [x, 0, 0], beam.palette.brass);
  const result = new Map();
  for (const [id, kit] of [['@suspension-link', link], ['@suspension-beam', beam]]) { const bytes = Buffer.from(await new GLTFExporter().parseAsync(kit.root, { binary: true, animations: [], trs: true })); const stats = await checks.verifyGLB(bytes, { requireStatic: true }); result.set(id, { id, bytes, sha256: stats.sha256, bounds: stats.verification.bounds, build_method: 'scene_only_native_detail', model: null }); }
  return result;
}
async function main() {
  const spec = read(path.join(OUT, 'production-spec.json')), catalog = read(path.join(OUT, 'catalog.json'));
  if (spec.scenes.length !== 7) throw new Error('Expected the six canonical region proposals and separate map diorama.');
  const items = new Map(catalog.items.map(item => [item.id, item])), specs = new Map(spec.assets.map(item => [item.id, item]));
  const sources = new Map(), details = await makeSceneDetails(), selected = process.argv[2] ? spec.scenes.filter(scene => scene.id === process.argv[2]) : spec.scenes;
  if (!selected.length) throw new Error('Requested scene is not in the production spec.');
  const sceneCatalogFile = path.join(OUT, 'scene-catalog.json'), old = fs.existsSync(sceneCatalogFile) ? read(sceneCatalogFile) : { items: [] }, registry = new Map(old.items.map(item => [item.id, item]));
  async function sourceFor(id) {
    if (sources.has(id)) return sources.get(id); if (details.has(id)) return details.get(id);
    const external = id === '@selected-airship', item = external ? { id, model: '../selected-airship-toon3d/airship.glb', build_method: 'original_selected_airship_copy' } : items.get(id);
    if (!item?.model) throw new Error('No registered source asset: ' + id);
    const file = path.resolve(OUT, item.model), original = fs.readFileSync(file), copied = external ? selectedAirshipCopy(original) : { bytes: original, repaired: 0 }, bytes = copied.bytes, stats = await checks.verifyGLB(bytes, { requireStatic: true });
    if (item.sha256 && stats.sha256 !== item.sha256) throw new Error('Source asset hash changed: ' + id);
    if (stats.standard_validator.errors) throw new Error('Source asset has format errors: ' + id);
    const source = { id, bytes, sha256: stats.sha256, ...(external ? { original_sha256: checks.sha256(original), copied_zero_normals_repaired: copied.repaired } : {}), bounds: stats.verification.bounds, model: item.model, file, build_method: item.build_method }; sources.set(id, source); return source;
  }
  for (const scene of selected) {
    const plans = planScene(scene), loaded = new Map(); for (const id of new Set(plans.map(item => item.id))) loaded.set(id, await sourceFor(id));
    const assembly = composer(scene.id), sourceCounts = new Map(), placements = [];
    for (let index = 0; index < plans.length; index++) {
      const plan = plans[index], source = loaded.get(plan.id), min = new THREE.Vector3(...source.bounds.min), max = new THREE.Vector3(...source.bounds.max), size = max.clone().sub(min), center = min.clone().add(max).multiplyScalar(.5);
      let scale = plan.scale ?? 1;
      const hero = specs.get(plan.id)?.build_method === 'hero_meshy';
      if (plan.longest) scale = plan.longest / Math.max(size.x, size.y, size.z, .001);
      else if (plan.height || hero) scale = (plan.height || specs.get(plan.id).relative_size_hint.height) / Math.max(size.y, .001);
      const vectorScale = Array.isArray(scale) ? new THREE.Vector3(...scale) : new THREE.Vector3(scale, scale, scale), anchor = plan.anchor === 'center' ? center : new THREE.Vector3(center.x, min.y, center.z);
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(plan.rotation || [0, plan.yaw || 0, 0])));
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...plan.position), rotation, vectorScale).multiply(new THREE.Matrix4().makeTranslation(-anchor.x, -anchor.y, -anchor.z));
      assembly.instance(source, matrix, `${scene.id}/${plan.id}/${index}`); sourceCounts.set(plan.id, (sourceCounts.get(plan.id) || 0) + 1);
      placements.push({ asset_id: plan.id, position: plan.position, scale: vectorScale.toArray(), rotation_radians: plan.rotation || [0, plan.yaw || 0, 0], anchor: plan.anchor || 'ground-center', ...(plan.region_order ? { region_order: plan.region_order } : {}) });
    }
    const extras = { scene_id: scene.id, canonical_region: scene.region_ko, source_spec: 'production-spec.json', relative_design_units_only: true, gameplay_implemented: false };
    const bytes = assembly.finish(extras), result = await checks.verifyGLB(bytes, { requireStatic: true }); if (result.standard_validator.errors) throw new Error('Assembled scene format errors: ' + scene.id);
    const model = `scenes/${scene.id}.glb`, manifest = `manifests/${scene.id}.json`; fs.mkdirSync(path.join(OUT, 'scenes'), { recursive: true }); fs.writeFileSync(path.join(OUT, model), bytes);
    const sourceAssets = [...loaded.values()].map(source => ({ asset_id: source.id, model: source.model, sha256: source.original_sha256 || source.sha256, ...(source.original_sha256 ? { embedded_copy_sha256: source.sha256, copied_zero_normals_repaired: source.copied_zero_normals_repaired } : {}), instances: sourceCounts.get(source.id), build_method: source.build_method, counted_in_independent_96: !source.id.startsWith('@') }));
    for (const source of loaded.values()) if (source.file && checks.sha256(fs.readFileSync(source.file)) !== (source.original_sha256 || source.sha256)) throw new Error('Original source changed during assembly: ' + source.id);
    write(path.join(OUT, manifest), { id: scene.id, game_title: 'Cloudstitch', name_ko: scene.name_ko, region_ko: scene.region_ko, status: 'completed_world_scene_prototype', model, source_spec: 'production-spec.json', canonical_sources: spec.canonical_sources, composition: scene.composition, limits: scene.limits, ...result, source_assets: sourceAssets, placements, unique_source_imports: assembly.uniqueImportCount(), mesh_images_reused_per_source: true, original_sources_unchanged: true, ...(loaded.has('@selected-airship') ? { selected_airship_source_sha256: loaded.get('@selected-airship').original_sha256, selected_airship_embedded_copy_sha256: loaded.get('@selected-airship').sha256, selected_airship_copy_zero_normals_repaired: loaded.get('@selected-airship').copied_zero_normals_repaired } : {}), engine_scope: 'Relative visual layout only. No approved meters, colliders, navigation, interactions, simulation, menus or game progression.' });
    registry.set(scene.id, { id: scene.id, order: spec.scenes.findIndex(item => item.id === scene.id) + 1, name_ko: scene.name_ko, name_en: scene.name_en, category: 'scene', region_ko: scene.region_ko, role: scene.purpose, build_method: 'reuse_assembly', model, preview: `scene-previews/${scene.id}.png`, manifest, triangles: result.triangles, mesh_count: result.mesh_count, mesh_definition_count: result.mesh_definition_count, texture_count: result.texture_count, textures: result.textures, animation_count: result.animation_count, bytes: result.bytes, sha256: result.sha256, bounds: result.verification.bounds, status: 'completed_world_scene_prototype' });
    console.log(JSON.stringify({ scene: scene.id, sourceAssets: sourceAssets.length, instances: plans.length, triangles: result.triangles, textures: result.texture_count, errors: result.standard_validator.errors, warnings: result.standard_validator.warnings }));
  }
  write(sceneCatalogFile, { game_title: 'Cloudstitch', type: 'world-scene-assemblies', scene_count: 7, independent_assets_counted_separately: 96, source_spec: 'production-spec.json', items: spec.scenes.map((scene, index) => registry.get(scene.id) || { id: scene.id, order: index + 1, name_ko: scene.name_ko, name_en: scene.name_en, category: 'scene', role: scene.purpose, build_method: 'reuse_assembly', model: `scenes/${scene.id}.glb`, preview: `scene-previews/${scene.id}.png`, status: 'pending' }) });
}
export { composer, selectedAirshipCopy };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
