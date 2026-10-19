/* Build only the new preview; original GLBs and frozen outputs are untouched. */
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '../../..');

async function main() {
  const output = path.resolve(root, process.argv[2] || 'outputs/combat-impactful-v1');
  if (path.dirname(output) !== path.join(root, 'outputs') || path.basename(output) === 'battlefield-v1') {
    throw new Error('새 outputs 하위의 독립 폴더를 지정하세요.');
  }
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'preview.js')],
    outfile: path.join(output, 'preview.js'),
    bundle: true, minify: true, format: 'iife', target: ['chrome100', 'safari16'],
    legalComments: 'inline', sourcemap: false,
    nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
  });
  fs.copyFileSync(path.join(__dirname, 'preview.html'), path.join(output, 'preview.html'));
  console.log(JSON.stringify({ output: path.relative(root, output).replaceAll('\\', '/'), entry: 'preview.html',
    assets: 'sibling-relative original v1 GLBs', network: 'same-origin only', combatSimulation: false }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
