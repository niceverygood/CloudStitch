/* Bundle the local geometry authoring module; no browser or paid generation. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
async function main() {
  const esbuild = require('esbuild');
  const work = path.join(root, 'work/enemy-base/chapter2-r1');
  fs.mkdirSync(work, { recursive: true });
  const outfile = path.join(work, 'generator.mjs');
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'generate.mjs')], outfile,
    bundle: true, format: 'esm', platform: 'node', target: 'node20',
    nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
    logLevel: 'warning'
  });
  if (process.argv.includes('--bundle-only')) {
    console.log(JSON.stringify({ bundled: path.relative(root, outfile).split(path.sep).join('/'), exported: false }));
    return;
  }
  const run = spawnSync(process.execPath, [outfile, ...process.argv.slice(2)], { cwd: root, env: process.env, stdio: 'inherit' });
  if (run.error) throw run.error;
  process.exitCode = run.status ?? 1;
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
