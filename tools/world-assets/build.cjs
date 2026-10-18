/* Embed real world assets or assembled scenes in an offline Three.js viewer. */
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const { repoPath } = require('../lib/paths.cjs');
function embed(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Expected an actual complete GLB: ' + file);
  const data = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  if ([...(data.buffers || []), ...(data.images || [])].some(item => item.uri && !item.uri.startsWith('data:'))) throw new Error('Offline GLBs must embed all buffers/textures: ' + file);
  return { base64: bytes.toString('base64'), bytes: bytes.length };
}
async function main() {
  const input = repoPath(process.argv[2] || 'outputs/world-assets/catalog.json');
  const isScene = /scene-catalog\.json$/i.test(input);
  const output = repoPath(process.argv[3] || (isScene ? 'outputs/world-assets/scenes.html' : 'outputs/world-assets/index.html'));
  const root = path.dirname(input), catalog = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
  const ids = new Set();
  const items = catalog.items.map(item => {
    if (!item.id || ids.has(item.id)) throw new Error('Each asset must have a unique id.'); ids.add(item.id);
    const file = item.model && path.resolve(root, item.model);
    const available = Boolean(file && fs.existsSync(file) && !['pending', 'generating', 'failed'].includes(item.status));
    const metadata = Object.fromEntries(['id', 'order', 'name_ko', 'name_en', 'category', 'role', 'build_method', 'triangles', 'animation_count', 'status'].filter(key => item[key] !== undefined).map(key => [key, item[key]]));
    const references = [item.reference, item.reference_png, `references/${item.id}.png`, `hero/${item.id}/reference.png`, `hero-models/${item.id}/reference.png`].filter(value => typeof value === 'string');
    const reference = references.map(file => path.resolve(root, file)).find(file => fs.existsSync(file));
    return { ...metadata, available, asset: available ? embed(file) : null, referenceDataURL: reference ? 'data:image/png;base64,' + fs.readFileSync(reference).toString('base64') : null };
  }).sort((a, b) => (a.order ?? 99999) - (b.order ?? 99999) || a.id.localeCompare(b.id));
  if (!items.some(item => item.available)) throw new Error('No real completed GLBs available.');
  const title = isScene ? '월드 조립 장면 3D 작업대' : '월드 에셋 3D 작업대';
  // Keep large embedded model payloads out of the JS compiler. They are data,
  // and compiling tens of megabytes of base64 as JS needlessly slows rebuilds.
  const payload=JSON.stringify({title,isScene,items}).replace(/</g,'\\u003c');
  const bundle = await esbuild.build({ entryPoints: [path.join(__dirname, 'viewer.js')], bundle: true, write: false, minify: true, format: 'iife', target: ['chrome100', 'firefox100', 'safari16'], legalComments: 'inline', define: { __WORLD_DATA__: 'window.__CLOUDSTITCH_WORLD_DATA__' } });
  const script = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8').replace(/WORLD_TITLE/g, title).replace('<script>/* BUNDLED_WORLD */</script>', () => '<script type="application/json" id="world-data">'+payload+'</script><script>window.__CLOUDSTITCH_WORLD_DATA__=JSON.parse(document.getElementById("world-data").textContent);'+script+'</script>');
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, html, 'utf8');
  console.log(JSON.stringify({ input, output, kind: isScene ? 'scenes' : 'assets', completedAssets: items.filter(item => item.available).length, htmlBytes: Buffer.byteLength(html), offline: true }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
