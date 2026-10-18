/* Embed completed weapon GLBs, their references and the selected ship in an offline workbench. */
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const { repoPath } = require('../lib/paths.cjs');

function modelAsset(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 12 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error('Expected an actual binary glTF 2.0 file: ' + file + '. Check Git LFS downloads.');
  }
  return { base64: bytes.toString('base64'), bytes: bytes.length };
}
async function main() {
  const input = repoPath(process.argv[2] || 'outputs/weapon-modules/catalog.json');
  const output = repoPath(process.argv[3] || 'outputs/weapon-modules/index.html');
  const catalog = JSON.parse(fs.readFileSync(input, 'utf8'));
  if (!Array.isArray(catalog.items)) throw new Error('Catalog must contain an items array.');
  const root = path.dirname(input);
  const ids = new Set();
  const items = catalog.items.map(item => {
    if (!item.id || ids.has(item.id)) throw new Error('Each weapon needs a unique id.');
    ids.add(item.id);
    const file = item.model && path.resolve(root, item.model);
    // Only real, completed assets are selectable. Pending entries may be shown as disabled.
    const available = Boolean(file && fs.existsSync(file) && !['pending', 'failed', 'generating'].includes(item.status));
    const info = Object.fromEntries(['id', 'name_ko', 'name_en', 'triangles', 'role', 'description', 'mount_scale', 'mount_rotation', 'mount_position', 'display_rotation', 'mount_length', 'limitations'].filter(key => item[key] !== undefined).map(key => [key, item[key]]));
    const asset = available ? modelAsset(file) : null;
    const reference = item.reference && path.resolve(root, item.reference);
    const referenceDataURL = reference && fs.existsSync(reference) ? 'data:image/png;base64,' + fs.readFileSync(reference).toString('base64') : null;
    return { ...info, available, asset, referenceDataURL };
  });
  if (!items.some(item => item.available)) throw new Error('No completed weapon models are available.');
  const shipFile = catalog.selected_ship && path.resolve(root, catalog.selected_ship);
  const ship = shipFile && fs.existsSync(shipFile) ? modelAsset(shipFile) : null;
  const payload = { gameTitle: 'Cloudstitch', items, ship };
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'viewer.js')], bundle: true, write: false,
    minify: true, format: 'iife', target: ['chrome100', 'firefox100', 'safari16'],
    legalComments: 'inline', define: { __WORKBENCH_DATA__: JSON.stringify(payload) },
  });
  const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
  const html = template.replace('/* BUNDLED_WORKBENCH */', () => script);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html, 'utf8');
  console.log(JSON.stringify({ input, output, availableWeapons: items.filter(item => item.available).map(item => item.id), shipAvailable: Boolean(ship), htmlBytes: Buffer.byteLength(html), offline: true }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
