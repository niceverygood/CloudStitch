const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '../..'), output = path.join(root, 'outputs/playable-battlefield-v1');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({ entryPoints: [path.join(__dirname, 'playable-ui.js')], outfile: path.join(output, 'playable.js'), nodePaths: [path.resolve(path.dirname(require.resolve('three')), '../..')], bundle: true, minify: true, format: 'iife', target: ['chrome100', 'safari16'], legalComments: 'inline' });
  await esbuild.build({ entryPoints: [path.join(__dirname, 'playable-qa-driver.mjs')], outfile: path.join(output, 'qa-driver.js'), bundle: true, minify: true, format: 'iife', target: ['chrome100', 'safari16'] });
  fs.copyFileSync(path.join(__dirname, 'playable-template.html'), path.join(output, 'index.html'));
  fs.copyFileSync(path.join(__dirname, 'playable-style.css'), path.join(output, 'style.css'));
  const files = ['index.html', 'style.css', 'playable.js', 'qa-driver.js'].map(file => { const bytes = fs.readFileSync(path.join(output, file)); return { path: `outputs/playable-battlefield-v1/${file}`, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; });
  fs.writeFileSync(path.join(output, 'build-manifest.json'), JSON.stringify({ schemaVersion: 1, gameTitle: 'Cloudstitch', scope: 'one first-voyage battlefield and return harbor; new full-screen presentation', combatAuthority: 'tools/battlefield/sim.mjs', sourceBaseline: 'preserved desktop integration controller/renderer/UI; separate playable copies', stateOwners: 1, sharedLocalAssets: true, externalCDN: false, files }, null, 2) + '\n');
  console.log(JSON.stringify({ output: 'outputs/playable-battlefield-v1/index.html', files }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
