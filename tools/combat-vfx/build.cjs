/* Bundle actual animated GLBs and Three.js into one offline VFX workbench. */
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const { repoPath } = require('../lib/paths.cjs');

function embedGLB(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Expected an actual binary glTF 2.0 file: ' + file);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  for (const resource of [...(json.buffers || []), ...(json.images || [])]) if (resource.uri && !resource.uri.startsWith('data:')) throw new Error('Offline GLBs must embed their buffers and images: ' + file);
  return { base64: bytes.toString('base64'), bytes: bytes.length };
}
async function main() {
  const input = repoPath(process.argv[2] || 'outputs/combat-vfx/catalog.json');
  const output = repoPath(process.argv[3] || 'outputs/combat-vfx/index.html');
  const catalog = JSON.parse(fs.readFileSync(input, 'utf8'));
  if (!Array.isArray(catalog.items)) throw new Error('Catalog must contain an items array.');
  const ids = new Set();
  const items = catalog.items.map(item => {
    if (!item.id || ids.has(item.id)) throw new Error('Each effect needs a unique id.');
    ids.add(item.id);
    const file = item.model && path.resolve(path.dirname(input), item.model);
    const available = Boolean(file && fs.existsSync(file) && !['pending', 'generating', 'failed'].includes(item.status));
    const metadata = Object.fromEntries(['id', 'order', 'name_ko', 'name_en', 'category', 'duration', 'loop', 'purpose', 'weapon_id', 'triangles', 'animation_count'].filter(key => item[key] !== undefined).map(key => [key, item[key]]));
    return { ...metadata, available, asset: available ? embedGLB(file) : null };
  }).sort((a, b) => (a.order ?? 99999) - (b.order ?? 99999) || a.id.localeCompare(b.id));
  if (!items.some(item => item.available)) throw new Error('No actual completed effect GLBs are available.');
  const bundle = await esbuild.build({ entryPoints: [path.join(__dirname, 'viewer.js')], bundle: true, write: false, minify: true, format: 'iife', target: ['chrome100', 'firefox100', 'safari16'], legalComments: 'inline', define: { __VFX_DATA__: JSON.stringify({ gameTitle: 'Cloudstitch', items }) } });
  const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
  const script = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = template.replace('/* BUNDLED_VFX */', () => script);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html, 'utf8');
  console.log(JSON.stringify({ input, output, availableEffects: items.filter(item => item.available).map(item => item.id), htmlBytes: Buffer.byteLength(html), offline: true }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
