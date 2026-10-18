const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const { pathToFileURL } = require('node:url');
const { repoPath, launchBrowser } = require('../lib/runtime.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  const original = repoPath('outputs/selected-airship-toon3d/airship.glb');
  const output = repoPath('outputs/airship-rig-v1');
  const work = repoPath('work/rig-build');
  fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(output, { recursive: true });
  const source = fs.readFileSync(original);
  const map = require('./part-map.json');
  if (sha(source) !== map.sourceSha256) throw new Error('Source SHA changed; the authored component map must be reviewed.');
  const bundle = await esbuild.build({ entryPoints: [path.join(__dirname, 'rig.js')], bundle: true, write: false, format: 'iife', target: 'chrome100' });
  const builderPath = path.join(work, 'builder.html');
  fs.writeFileSync(builderPath, '<!doctype html><meta charset="utf-8"><script>' + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>');
  const browser = await launchBrowser();
  let result;
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.error(e.message));
    page.on('console', m => { if (m.type() === 'warn' || m.type() === 'error') console.error(m.text()); });
    await page.goto(pathToFileURL(builderPath).href);
    result = await page.evaluate(async base64 => {
      const raw = atob(base64), bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
      const result = await window.__buildRig(bytes.buffer), output = new Uint8Array(result.binary);
      let text = ''; for (let i = 0; i < output.length; i += 32768) text += String.fromCharCode(...output.subarray(i, i + 32768));
      return { data: btoa(text), report: result.report };
    }, source.toString('base64'));
  } finally { await browser.close(); }
  const binary = Buffer.from(result.data, 'base64');
  fs.writeFileSync(path.join(output, 'airship-rigged.glb'), binary);
  const manifest = { gameTitle: 'Cloudstitch', revision: 1, ...result.report, model: 'airship-rigged.glb', modelBytes: binary.length, sha256: sha(binary), scope: 'Reusable skinned GLB with embedded animation clips and provisional attachment nodes. Engine import, gameplay, collision and LOD are not yet verified.' };
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  if (!process.argv.includes('--model-only')) await buildViewer(binary, output);
  if (sha(fs.readFileSync(original)) !== map.sourceSha256) throw new Error('Original source unexpectedly changed.');
  console.log(JSON.stringify({ model: path.relative(repoPath('.'), path.join(output, 'airship-rigged.glb')), bytes: binary.length, joints: manifest.jointCount, triangles: manifest.sourceTriangles + manifest.addedCableTriangles, clips: manifest.clips.map(c => c.name), sourceUnchanged: true }));
}

async function buildViewer(binary, output) {
  const result = await esbuild.build({ entryPoints: [path.join(__dirname, 'viewer.js')], bundle: true, minify: true, write: false, format: 'iife', target: ['chrome100', 'safari16'], define: { '__MODEL_BASE64__': JSON.stringify(binary.toString('base64')), '__MODEL_BYTES__': String(binary.length) } });
  const template = fs.readFileSync(path.join(__dirname, 'viewer-template.html'), 'utf8');
  fs.writeFileSync(path.join(output, 'viewer.html'), template.replace('/* BUNDLED_VIEWER */', () => result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
