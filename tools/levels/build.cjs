const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');
const { repoPath } = require('../lib/paths.cjs');
async function main() {
  execFileSync(process.execPath, [path.join(__dirname, 'build-data.mjs')], { stdio: 'inherit' });
  const data = JSON.parse(fs.readFileSync(repoPath('outputs/levels-v1/level-package.json'), 'utf8'));
  const bundled = await esbuild.build({ entryPoints: [path.join(__dirname, 'viewer.js')], nodePaths: [path.resolve(path.dirname(require.resolve('three')), '../..')], bundle: true, write: false, minify: true, format: 'iife', target: ['chrome100', 'firefox100', 'safari16'], legalComments: 'inline' });
  const script = bundled.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8').replace('<!-- LEVELS_PAYLOAD -->', `<script type="application/json" id="level-data">${payload}</script><script>${script}</script>`);
  fs.writeFileSync(repoPath('outputs/levels-v1/index.html'), html);
  console.log(JSON.stringify({ output: 'outputs/levels-v1/index.html', bytes: Buffer.byteLength(html), externalCDN: false, usesSharedLocalGLB: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
