/* Cloudstitch VFX v2 preservation and coverage records. No dependencies.
 * From the repository root:
 *   node tools/combat-vfx-v2/record.cjs baseline
 *   node tools/combat-vfx-v2/record.cjs verify
 *   node tools/combat-vfx-v2/record.cjs summarize [--write]
 * Baseline never replaces an existing inventory. Summarize reports actual files
 * separately from art/browser verification and never modifies a catalog.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');
const OUT = 'outputs/combat-vfx-v2';
const INVENTORY = `${OUT}/source-inventory.json`;
const REPRESENTATIVES = ['machine-gun-muzzle', 'smoke-puff', 'cannon-hit', 'flamethrower-stream', 'shield-pulse', 'repair-stitch'];
const read = relative => JSON.parse(fs.readFileSync(resolve(relative), 'utf8').replace(/^\uFEFF/, ''));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const slash = value => value.split(path.sep).join('/');
function resolve(relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Expected a repository-relative path.');
  const absolute = path.resolve(ROOT, relative);
  const back = path.relative(ROOT, absolute);
  if (back === '..' || back.startsWith(`..${path.sep}`) || path.isAbsolute(back)) throw new Error('Path escapes the repository: ' + relative);
  return absolute;
}
function catalogPath(folder, model) {
  return slash(path.relative(ROOT, resolve(slash(path.join(folder, model)))));
}
function originals() {
  const effects = read('outputs/combat-vfx/catalog.json').items;
  const sequences = read('outputs/combat-vfx/sequence-catalog.json').items;
  const weapons = read('outputs/weapon-modules/catalog.json').items;
  const references = read(`${OUT}/brief/reference-inventory.json`);
  if (effects.length !== 48 || sequences.length !== 6 || weapons.length !== 6 || references.length !== 2) {
    throw new Error('Expected original 48 effects, 6 sequences, 6 weapons and 2 reference images.');
  }
  const files = [
    ...effects.map(item => ({id:item.id, kind:'original-effect', path:catalogPath('outputs/combat-vfx', item.model)})),
    ...sequences.map(item => ({id:item.id, kind:'original-sequence', path:catalogPath('outputs/combat-vfx', item.model)})),
    {id:'selected-airship', kind:'original-airship', path:'outputs/selected-airship-toon3d/airship.glb'},
    ...weapons.map(item => ({id:item.id, kind:'original-weapon', path:catalogPath('outputs/weapon-modules', item.model)})),
    ...references.map(item => ({id:path.posix.basename(item.path, path.posix.extname(item.path)), kind:'user-reference', path:item.path})),
  ];
  if (new Set(files.map(file => file.path)).size !== 63) throw new Error('Expected exactly 63 unique preservation files.');
  return files;
}
function verify(print = true) {
  const inventory = read(INVENTORY);
  const current = originals();
  const expected = new Map(current.map(file => [file.path, file]));
  const entries = inventory.files;
  if (!Array.isArray(entries) || entries.length !== 63 || new Set(entries.map(file => file.path)).size !== 63) throw new Error('Invalid preservation inventory count.');
  const results = entries.map(file => {
    if (!expected.has(file.path)) return {path:file.path, unchanged:false, reason:'unexpected_inventory_path'};
    if (!fs.existsSync(resolve(file.path))) return {path:file.path, unchanged:false, reason:'missing_source'};
    const bytes = fs.readFileSync(resolve(file.path));
    const actual = hash(bytes);
    return {path:file.path, bytes:bytes.length, sha256:actual, unchanged:bytes.length === file.bytes && actual === file.sha256};
  });
  const report = {schema_version:1, game_title:'Cloudstitch', checked_at_utc:new Date().toISOString(), inventory:INVENTORY,
    source_count:results.length, unchanged_count:results.filter(file => file.unchanged).length,
    passed:results.every(file => file.unchanged), files:results};
  if (print) console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
  return report;
}
function baseline() {
  if (fs.existsSync(resolve(INVENTORY))) {
    const report = verify(false);
    console.log(JSON.stringify({action:'preserved_existing_baseline', inventory:INVENTORY, source_count:report.source_count, passed:report.passed}, null, 2));
    return;
  }
  const refs = new Map(read(`${OUT}/brief/reference-inventory.json`).map(item => [item.path, item]));
  const files = originals().map(file => {
    const bytes = fs.readFileSync(resolve(file.path));
    const record = {...file, bytes:bytes.length, sha256:hash(bytes)};
    if (file.kind === 'user-reference') {
      const ref = refs.get(file.path);
      if (ref.bytes !== record.bytes || ref.sha256 !== record.sha256) throw new Error('Preserved user attachment differs from its brief inventory: ' + file.path);
    }
    return record;
  });
  const inventory = {schema_version:1, game_title:'Cloudstitch', purpose:'Read-only preservation baseline for VFX v1, selected airship, weapon originals and the two unedited user attachments.',
    created_at_utc:new Date().toISOString(), source_count:files.length, total_bytes:files.reduce((sum,file) => sum+file.bytes,0),
    counts:Object.fromEntries([...new Set(files.map(file => file.kind))].map(kind => [kind, files.filter(file => file.kind === kind).length])), files};
  fs.mkdirSync(resolve(OUT), {recursive:true});
  // Exclusive creation prevents a concurrent run from replacing its baseline.
  fs.writeFileSync(resolve(INVENTORY), JSON.stringify(inventory,null,2)+'\n', {flag:'wx'});
  console.log(JSON.stringify({action:'created_baseline', inventory:INVENTORY, source_count:files.length, total_bytes:inventory.total_bytes},null,2));
}
function inspectGLB(file) {
  const bytes = fs.readFileSync(resolve(file));
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid or incomplete binary glTF 2.0.');
  let cursor = 12, json, bin;
  while (cursor < bytes.length) {
    if (cursor+8 > bytes.length) throw new Error('Incomplete GLB chunk header.');
    const length = bytes.readUInt32LE(cursor), type = bytes.readUInt32LE(cursor+4);
    cursor += 8;
    if (cursor+length > bytes.length) throw new Error('Incomplete GLB chunk.');
    const chunk = bytes.subarray(cursor,cursor+length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    cursor += length;
  }
  if (!json || !bin) throw new Error('Expected embedded JSON and binary chunks.');
  if ([...(json.buffers||[]),...(json.images||[])].some(resource => resource.uri && !resource.uri.startsWith('data:'))) throw new Error('External resource dependency in GLB.');
  let triangles = 0;
  for (const mesh of json.meshes||[]) for (const primitive of mesh.primitives||[]) {
    if ((primitive.mode??4) !== 4) throw new Error('Summary expects triangle primitives.');
    const accessor = json.accessors?.[primitive.indices??primitive.attributes.POSITION];
    if (!accessor) throw new Error('Missing mesh accessor.');
    triangles += accessor.count/3;
  }
  const clips = (json.animations||[]).map(animation => {
    const values = [];
    for (const sampler of animation.samplers||[]) {
      const accessor = json.accessors?.[sampler.input], view = json.bufferViews?.[accessor?.bufferView];
      if (!accessor || !view || accessor.type !== 'SCALAR' || accessor.componentType !== 5126 || accessor.sparse) throw new Error('Unsupported animation input accessor.');
      const offset = (view.byteOffset||0)+(accessor.byteOffset||0), stride = view.byteStride||4;
      for(let i=0;i<accessor.count;i++) values.push(bin.readFloatLE(offset+i*stride));
    }
    if (values.some(value => !Number.isFinite(value))) throw new Error('Non-finite animation time.');
    const paths = (animation.channels||[]).map(channel => channel.target.path);
    return {name:animation.name||'', duration_seconds:values.length?Math.max(...values):0, channels:paths.length, channel_paths:[...new Set(paths)], standard_trs_only:paths.every(value => ['translation','rotation','scale'].includes(value))};
  });
  return {path:file, bytes:bytes.length, sha256:hash(bytes), triangles, mesh_count:(json.meshes||[]).length, node_count:(json.nodes||[]).length,
    material_count:(json.materials||[]).length, texture_count:(json.textures||[]).length, image_count:(json.images||[]).length,
    animation_count:clips.length, animations:clips, embedded_resources:true};
}
function summarize() {
  const effectOriginals = read('outputs/combat-vfx/catalog.json').items;
  const sequenceOriginals = read('outputs/combat-vfx/sequence-catalog.json').items;
  const localCatalog = name => fs.existsSync(resolve(`${OUT}/${name}`)) ? read(`${OUT}/${name}`).items||[] : [];
  const effectsCatalog = localCatalog('catalog.json'), sequencesCatalog = localCatalog('sequence-catalog.json');
  const inspect = (original,kind,catalog,folder) => {
    const metadata = catalog.find(item => item.id === original.id);
    const file = metadata?.model ? catalogPath(OUT,metadata.model) : `${OUT}/${folder}/${original.id}.glb`;
    const base = {id:original.id, order:original.order, name_ko:original.name_ko, category:original.category, kind,
      original_model:catalogPath('outputs/combat-vfx',original.model), expected_model:file,
      ...(metadata ? {catalog_status:metadata.status??'unspecified'} : {}), art_review:'not_inferred_from_file_presence', browser_verification:'not_inferred_from_file_presence'};
    if (!fs.existsSync(resolve(file))) return {...base,status:'pending', model_present:false};
    try {
      const model = inspectGLB(file), hasAnimation = model.animation_count>0 && model.animations.some(clip=>clip.channels>0 && clip.duration_seconds>0);
      return {...base,status:hasAnimation?'model_present_verification_pending':'animation_pending', model_present:true, actual:model};
    } catch (error) { return {...base,status:'invalid_model', model_present:true,error:error.message}; }
  };
  const effects = effectOriginals.map(item=>inspect(item,'effect',effectsCatalog,'assets'));
  const sequences = sequenceOriginals.map(item=>inspect(item,'sequence',sequencesCatalog,'sequences'));
  const items = [...effects,...sequences];
  const summary = {schema_version:1, game_title:'Cloudstitch', generated_at_utc:new Date().toISOString(), scope:{effects:48,weapon_sequences:6,total:54},
    completion_rule:'Actual GLB presence and TRS structure are reported separately. This script does not declare art review, browser verification or game integration complete.',
    counts:{models_present:items.filter(item=>item.model_present).length,animated_models_present:items.filter(item=>item.status==='model_present_verification_pending').length,
      pending:items.filter(item=>item.status==='pending').length,animation_pending:items.filter(item=>item.status==='animation_pending').length,invalid_models:items.filter(item=>item.status==='invalid_model').length},
    representatives:REPRESENTATIVES.map(id=>effects.find(item=>item.id===id)), effects,sequences};
  if (process.argv.includes('--write')) {
    const output = `${OUT}/progress-summary.json`;
    fs.mkdirSync(resolve(OUT),{recursive:true});
    fs.writeFileSync(resolve(output),JSON.stringify(summary,null,2)+'\n');
    console.log(JSON.stringify({output,counts:summary.counts,scope:summary.scope},null,2));
  } else console.log(JSON.stringify(summary,null,2));
  if (summary.counts.invalid_models) process.exitCode = 1;
}
try {
  const command = process.argv[2];
  if(command==='baseline') baseline();
  else if(command==='verify') verify();
  else if(command==='summarize') summarize();
  else throw new Error('Usage: node tools/combat-vfx-v2/record.cjs baseline|verify|summarize [--write]');
} catch(error) { console.error(error.message); process.exitCode=1; }
