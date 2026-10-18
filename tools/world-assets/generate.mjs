/* Build only local static geometry; register existing hero GLBs without editing them. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { makeWorldKit } from './core.mjs';
import checks from '../qa/world-gltf.cjs';
import { generationProvenance } from './provenance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'outputs/world-assets');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); };
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }).catch(error => this.onerror?.(error)); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = 'data:' + blob.type + ';base64,' + Buffer.from(value).toString('base64'); this.onloadend?.(); }).catch(error => this.onerror?.(error)); }
};
function description(spec) {
  return Object.fromEntries(['id', 'order', 'name_ko', 'name_en', 'category', 'role', 'build_method', 'relative_size_hint'].filter(key => spec[key] !== undefined).map(key => [key, spec[key]]));
}
async function main() {
  const spec = read(path.join(OUT, 'production-spec.json'));
  if (!Array.isArray(spec.assets) || spec.assets.length !== 96) throw new Error('Production spec must define 96 independent assets.');
  const argument = process.argv[2];
  const selected = spec.assets.filter(item => !argument || (argument === '--locals' ? item.build_method === 'local_mesh' : argument === '--heroes' ? item.build_method === 'hero_meshy' : argument === '--available' ? (item.build_method === 'hero_meshy' ? fs.existsSync(path.join(OUT, `hero/${item.id}/model.glb`)) : fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), ['architecture', 'terrain'].includes(item.category) ? 'primary.mjs' : 'secondary.mjs'))) : item.id === argument));
  if (!selected.length) throw new Error('No requested asset in production spec.');
  const catalogFile = path.join(OUT, 'catalog.json'), old = fs.existsSync(catalogFile) ? read(catalogFile) : { items: [] };
  const registry = new Map(old.items.map(item => [item.id, item]));
  const failures = [], missingHeroes = [];
  for (const item of selected) {
    const hero = item.build_method === 'hero_meshy';
    const originalModel = hero ? `hero/${item.id}/model.glb` : `assets/${item.id}.glb`, originalFile = path.join(OUT, originalModel);
    let model = originalModel, file = originalFile, originalSHA256, repair, roofRepair;
    if (hero && !fs.existsSync(file)) { missingHeroes.push(item.id); registry.set(item.id, { ...description(item), model, preview: `previews/${item.id}.png`, status: 'pending_hero_source' }); continue; }
    try {
      let bytes;
      if (hero) {
        bytes = fs.readFileSync(originalFile); originalSHA256 = checks.sha256(bytes);
        const repairedModel = `hero/${item.id}/model-repaired.glb`, repairedFile = path.join(OUT, repairedModel), logFile = path.join(OUT, `hero/${item.id}/repair-log.json`);
        if (fs.existsSync(repairedFile) && fs.existsSync(logFile)) {
          const log = read(logFile), repairedBytes = fs.readFileSync(repairedFile);
          if (log.original_source?.sha256 !== originalSHA256 || log.repaired_source?.sha256 !== checks.sha256(repairedBytes) || log.after?.errors !== 0 || log.original_source_preserved !== true) throw new Error('Hero repair log does not match preserved original/repaired bytes: ' + item.id);
          model = repairedModel; file = repairedFile; bytes = repairedBytes;
          repair = { log: `hero/${item.id}/repair-log.json`, original_sha256: originalSHA256, repaired_sha256: log.repaired_source.sha256, normal_vectors_repaired: log.changes?.normal_vectors_repaired, zero_normal_vectors: log.changes?.zero_normal_vectors, non_unit_normal_vectors: log.changes?.non_unit_normal_vectors, official_errors_after: 0 };
        }
        const roofModel = `hero/${item.id}/model-closed-roof.glb`, roofFile = path.join(OUT,roofModel), roofLog = path.join(OUT,`hero/${item.id}/roof-repair-log.json`);
        if(fs.existsSync(roofFile)&&fs.existsSync(roofLog)){
          const log=read(roofLog),roofBytes=fs.readFileSync(roofFile);
          if(log.original_source?.sha256!==originalSHA256||log.base_normal_copy?.sha256!==checks.sha256(bytes)||log.repaired_source?.sha256!==checks.sha256(roofBytes)||log.after?.errors!==0)throw new Error('Roof repair sources or result do not match: '+item.id);
          roofRepair=log;model=roofModel;file=roofFile;bytes=roofBytes;
        }
      }
      else {
        if (item.build_method !== 'local_mesh') throw new Error('Unknown build method: ' + item.build_method);
        const kit = makeWorldKit(item);
        if (['architecture', 'terrain'].includes(item.category)) (await import('./primary.mjs')).buildPrimary(item, kit); else (await import('./secondary.mjs')).buildSecondary(item, kit);
        kit.root.updateMatrixWorld(true);
        bytes = Buffer.from(await new GLTFExporter().parseAsync(kit.root, { binary: true, animations: [], onlyVisible: true, trs: true }));
        fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes);
      }
      const result = await checks.verifyGLB(bytes, { requireStatic: !hero });
      if (!hero && result.mesh_count < 2) throw new Error('Local world modules need multiple actual mesh parts: ' + item.id);
      const status = result.standard_validator.errors === 0 ? 'completed_world_asset_prototype' : 'failed';
      const manifestPath = `manifests/${item.id}.json`;
      const reference = hero && fs.existsSync(path.join(OUT, `hero/${item.id}/reference.png`)) ? `hero/${item.id}/reference.png` : undefined;
      const stateFile = path.join(OUT, `hero/${item.id}/state.json`), state = hero && fs.existsSync(stateFile) ? read(stateFile) : {};
      // state.json is intentionally ignored by Git. Preserve only the three
      // public provenance fields from the previous manifest on a fresh clone.
      const previousManifestFile = path.join(OUT, manifestPath);
      const previousManifest = hero && fs.existsSync(previousManifestFile) ? read(previousManifestFile) : {};
      const generation = hero ? generationProvenance(state, previousManifest) : { consumed_credits: 0 };
      const manifest = {
        ...description(item), game_title: 'Cloudstitch', model, status,
        source: hero ? 'Existing downloaded Meshy hero GLB, inspected without source edits' : 'Original local static vertex-painted multipart geometry',
        ...result, ...generation, original_source_preserved: hero, ...(hero ? { source_model: originalModel, source_sha256: originalSHA256 } : {}), ...(repair ? { normal_repair: repair } : {}), ...(roofRepair ? {roof_repair_log:`hero/${item.id}/roof-repair-log.json`,roof_repair:roofRepair}:{}), spec_source: 'production-spec.json', canonical_sources: spec.canonical_sources,
        axes_and_units: 'Y up, Z front; relative design units. Actual generated bounds measured; final engine units and sockets are not approved.',
        limits: ['Visual static world asset prototype. Collider, navigation, LOD, interiors, interaction, physics and engine performance are not implemented.', 'Handdrawn/cel outline effects are viewer runtime materials. Original geometry and embedded colors/textures are separate from engine integration.', ...(hero ? ['Generated hidden surfaces, part separation and exact ground pivot require visual review.'] : [])],
      };
      write(path.join(OUT, manifestPath), manifest);
      const previous = registry.get(item.id);
      registry.set(item.id, { ...description(item), model, preview: `previews/${item.id}.png`, manifest: manifestPath, ...(reference ? { reference } : {}), ...(hero ? { source_model: originalModel, source_sha256: originalSHA256 } : {}), ...(repair ? { normal_repair: repair } : {}), ...(roofRepair?{roof_repair_log:`hero/${item.id}/roof-repair-log.json`,roof_repair:roofRepair}:{}), triangles: result.triangles, mesh_count: result.mesh_count, material_count: result.material_count, texture_count: result.texture_count, textures: result.textures, vertex_colors: result.vertex_colors, animation_count: result.animation_count, bytes: result.bytes, sha256: result.sha256, bounds: result.verification.bounds, status, ...(previous?.preview_image ? { preview_image: previous.preview_image } : {}) });
      if (hero && (checks.sha256(fs.readFileSync(originalFile)) !== originalSHA256 || checks.sha256(fs.readFileSync(file)) !== result.sha256)) throw new Error('Hero original/copy changed during inspection: ' + item.id);
      if (result.standard_validator.errors) failures.push({ id: item.id, error: 'Official validator errors', count: result.standard_validator.errors });
      console.log(JSON.stringify({ id: item.id, method: item.build_method, triangles: result.triangles, meshes: result.mesh_count, animations: result.animation_count, errors: result.standard_validator.errors, warnings: result.standard_validator.warnings }));
    } catch (error) {
      failures.push({ id: item.id, error: error.message }); registry.set(item.id, { ...description(item), model, preview: `previews/${item.id}.png`, status: 'failed', error: error.message });
    }
  }
  const items = spec.assets.map(item => registry.get(item.id) || { ...description(item), model: item.build_method === 'hero_meshy' ? `hero/${item.id}/model.glb` : `assets/${item.id}.glb`, preview: `previews/${item.id}.png`, status: 'pending' });
  write(catalogFile, { game_title: 'Cloudstitch', type: 'world-assets', independent_asset_count: 96, scene_assets_counted_separately: true, source_spec: 'production-spec.json', items });
  console.log(JSON.stringify({ generatedOrRegistered: selected.length - missingHeroes.length - failures.length, independentAssets: 96, missingHeroes, failures, complete: items.filter(item => item.status === 'completed_world_asset_prototype').length }));
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
