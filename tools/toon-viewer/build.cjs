/* Bundle the actual GLB and Three.js into a fully offline HTML viewer. */
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const { repoPath } = require('../lib/paths.cjs');

async function main() {
  const input = repoPath(process.argv[2] || 'outputs/selected-airship-toon3d/airship.glb');
  const output = repoPath(process.argv[3] || 'outputs/selected-airship-toon3d/viewer.html');
  const versionedOutput = path.join(path.dirname(output), 'viewer-v2.html');
  if (!fs.existsSync(input)) throw new Error('Actual GLB is missing: ' + input);
  const glb = fs.readFileSync(input);
  if (glb.length < 12 || glb.readUInt32LE(0) !== 0x46546c67 || glb.readUInt32LE(4) !== 2) {
    throw new Error('Input must be a binary glTF 2.0 (.glb) file. If using Git LFS, run git lfs pull.');
  }
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'viewer.js')],
    bundle: true, write: false, minify: true, format: 'iife', target: ['chrome100', 'firefox100', 'safari16'],
    legalComments: 'inline',
    define: { '__MODEL_BASE64__': JSON.stringify(glb.toString('base64')), '__MODEL_BYTES__': String(glb.length) },
  });
  const template = fs.readFileSync(path.join(__dirname, 'viewer-template.html'), 'utf8');
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = template.replace('/* BUNDLED_VIEWER */', () => js);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html, 'utf8');
  if (versionedOutput !== output) fs.writeFileSync(versionedOutput, html, 'utf8');
  console.log(JSON.stringify({ input, output, versionedOutput, modelBytes: glb.length, htmlBytes: Buffer.byteLength(html), offline: true }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
