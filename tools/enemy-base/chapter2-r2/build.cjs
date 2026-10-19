/* Offline review-page packer. Uses installed dependencies; never installs packages. */
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '../../..');
const output = path.join(root, 'outputs/enemy-base-v1/chapter2-r2');
const modelPath = path.join(output, 'enemy-base.glb');
const referencePath = path.join(root, 'outputs/enemy-base-v1/chapter2-r2/reference.png');
async function build() {
  const model = fs.readFileSync(modelPath);
  if (model.length < 20 || model.toString('ascii', 0, 4) !== 'glTF') throw new Error('Expected an actual GLB, not an LFS pointer.');
  const reference = fs.readFileSync(referencePath);
  if (!reference.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Expected an actual PNG reference.');
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'review.js')], bundle: true, write: false,
    format: 'iife', platform: 'browser', target: ['es2020'], minify: true, legalComments: 'inline',
    nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
  });
  const html = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8')
    .replace('__REFERENCE_DATA__', () => 'data:image/png;base64,' + reference.toString('base64'))
    .replace('__GLB_BASE64__', () => model.toString('base64'))
    .replace('__BUNDLE__', () => result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'index.html'), html);
  console.log(JSON.stringify({ page:'outputs/enemy-base-v1/chapter2-r2/index.html', bytes:Buffer.byteLength(html), modelBytes:model.length, embeddedReferenceBytes:reference.length }));
}
build().catch(error => { console.error(error.message); process.exitCode = 1; });
