/* Portable, self-contained comparison. Original GLBs are read, never rewritten. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function embed(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 24 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Actual GLB required: ' + file);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  for (const resource of [...(json.buffers || []), ...(json.images || [])]) if (resource.uri && !resource.uri.startsWith('data:')) throw new Error('External GLB resource: ' + file);
  return { base64: bytes.toString('base64'), bytes: bytes.length, sha256: hash(bytes), source: path.relative(root, file).replaceAll('\\', '/') };
}
function pair(v2, v1, folder, kind = 'effect') {
  const source = v1.items.find(item => item.id === v2.id);
  const newPath = v2.model && path.resolve(folder, v2.model);
  const oldPath = source?.model && path.resolve(root, 'outputs/combat-vfx', source.model);
  const available = Boolean(newPath && fs.existsSync(newPath) && oldPath && fs.existsSync(oldPath) && !['pending', 'generating', 'failed', 'planned'].includes(v2.status));
  const metadata = Object.fromEntries(Object.entries(v2).filter(([key]) => !['asset', 'base64'].includes(key)));
  return { ...metadata, kind, available, v1: available ? embed(oldPath) : null, v2: available ? embed(newPath) : null };
}
async function main() {
  const argumentsList = process.argv.slice(2), flags = new Set(argumentsList.filter(value => value.startsWith('--'))), positional = argumentsList.filter(value => !value.startsWith('--'));
  const representativesOnly = flags.has('--representatives');
  const input = path.resolve(root, positional[0] || 'outputs/combat-vfx-v2/catalog.json');
  const batchId = [...flags].find(flag => flag.startsWith('--batch='))?.slice(8);
  const batch = batchId ? read(path.join(path.dirname(input), 'review-batches.json')).batches.find(item => item.id === batchId) : null;
  if (batchId && !batch) throw new Error('Unknown review batch: ' + batchId);
  const batchIds = batch ? new Set(batch.effect_ids.concat(batch.sequence_ids)) : null;
  const output = path.resolve(root, positional[1] || (batch ? `outputs/combat-vfx-v2/review/${batch.id}.html` : representativesOnly ? 'outputs/combat-vfx-v2/comparison.html' : 'outputs/combat-vfx-v2/index.html'));
  const catalog = read(input), old = read(path.join(root, 'outputs/combat-vfx/catalog.json'));
  const representativeIds = new Set(['machine-gun-muzzle', 'smoke-puff', 'cannon-hit', 'flamethrower-stream', 'shield-pulse', 'repair-stitch']);
  const items = catalog.items.filter(item => (!representativesOnly || representativeIds.has(item.id)) && (!batchIds || batchIds.has(item.id))).map(item => pair(item, old, path.dirname(input)));
  const sequencePath = path.join(path.dirname(input), 'sequence-catalog.json');
  if (!representativesOnly && fs.existsSync(sequencePath)) {
    const sequenceCatalog = read(sequencePath), oldSequences = read(path.join(root, 'outputs/combat-vfx/sequence-catalog.json'));
    items.push(...sequenceCatalog.items.filter(item => !batchIds || batchIds.has(item.id)).map(item => pair(item, oldSequences, path.dirname(input), 'sequence')));
  }
  if (!items.some(item => item.available)) throw new Error('No v1/v2 GLB pair is available yet.');
  const weaponsCatalog = read(path.join(root, 'outputs/weapon-modules/catalog.json'));
  const neededWeapons = new Set(['01-machine-gun', ...items.filter(item => item.available).map(item => item.weapon_id || (item.id.includes('cannon') ? '02-deck-cannon' : item.id.includes('flame') ? '06-flamethrower' : '01-machine-gun'))]);
  const weapons = weaponsCatalog.items.filter(item => neededWeapons.has(item.id)).map(item => ({ ...item, asset: embed(path.join(root, 'outputs/weapon-modules', item.model)) }));
  const rigPath = path.join(root, 'outputs/airship-rig-v1/airship-rigged.glb');
  const data = { title: 'Cloudstitch', reviewBatch:batch, items, weapons, ship: embed(path.join(root, 'outputs/selected-airship-toon3d/airship.glb')), rig: fs.existsSync(rigPath) ? embed(rigPath) : null };
  // Keep GLB base64 out of esbuild's parser/minifier. The data script is raw
  // serialized JSON, while only the reusable viewer code is bundled/minified.
  const result = await esbuild.build({ entryPoints: [path.join(__dirname, 'viewer.js')], bundle: true, write: false, minify: true, format: 'iife', target: ['chrome100', 'safari16'], nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean), define: { __VFX_V2_DATA__: 'window.__VFX_V2_DATA__' }, legalComments: 'inline' });
  const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
  const dataScript = 'window.__VFX_V2_DATA__=' + JSON.stringify(data).replace(/<\/script/gi, '<\\/script') + ';';
  const html = template.replace('/* EMBEDDED_COMPARISON_DATA */', () => dataScript).replace('/* BUNDLED_COMPARISON */', () => result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, html);
  console.log(JSON.stringify({ output: path.relative(root, output), htmlBytes: Buffer.byteLength(html), htmlSha256:hash(Buffer.from(html)), offline: true, representativesOnly, reviewBatch:batch?.id??null, weaponCount: weapons.length, available: items.filter(item => item.available).map(item => ({ id: item.id, kind: item.kind, v1: item.v1.sha256, v2: item.v2.sha256 })), shipSha256: data.ship.sha256, rigSha256: data.rig?.sha256 || null }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
