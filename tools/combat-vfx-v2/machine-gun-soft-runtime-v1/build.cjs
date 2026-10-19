const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const source = 'tools/combat-vfx-v2/machine-gun-soft-runtime-v1/';
const output = 'outputs/combat-vfx-v2/machine-gun-soft-runtime-v1/';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function describe(relative) {
  const bytes = fs.readFileSync(path.join(root, relative));
  return { path: relative, bytes: bytes.length, sha256: sha(bytes) };
}
fs.mkdirSync(path.join(root, output), { recursive: true });
for (const file of ['runtime.js', 'painted-effects.js']) fs.copyFileSync(path.join(__dirname, file), path.join(root, output, file));
const preservation = [];
for (const [file, expected] of [
  ['soft-vfx-atlas.png', 'c4ce60208e6dc66f3d5d8bec6a04399786e1ffb29b9cec55f8ab77d3ae4202ee'],
  ['soft-material-atlas.png', '20deb2347094dcc8ba0ca8d6b6c7fcc66a7a770f582aa356e251bcee9b2911fb'],
]) {
  const before = describe('outputs/combat-vfx-v2/machine-gun-soft-v1/textures/' + file);
  const after = describe(output + 'textures/' + file);
  if (before.sha256 !== expected || after.sha256 !== expected) throw new Error('Selected soft atlas changed: ' + file);
  preservation.push({ source: before, runtime: after, identical: true });
}
const previous = JSON.parse(fs.readFileSync(path.join(root, 'outputs/combat-vfx-v2/machine-gun-soft-v1/inventory.json'), 'utf8'));
const previousFiles = Array.isArray(previous) ? previous : previous.files || (previous.sources && previous.outputs ? [...previous.sources, ...previous.outputs] : null);
if (!Array.isArray(previousFiles)) throw new Error('Unknown frozen soft inventory schema.');
let preserved = 0;
for (const entry of previousFiles) {
  const actual = describe(entry.path);
  if (actual.bytes !== entry.bytes || actual.sha256 !== entry.sha256) throw new Error('Frozen soft predecessor changed: ' + entry.path);
  preserved++;
}
const report = JSON.parse(fs.readFileSync(path.join(root, output, 'verification/runtime-tests.json'), 'utf8'));
if (report.passed !== true) throw new Error('Runtime CPU report is not passing.');
const sources = ['runtime.js', 'painted-effects.js', 'runtime.test.cjs', 'build.cjs', 'HANDOFF.md', 'QA_PLAN.md'].map(file => describe(source + file));
for (const file of ['runtime.js', 'painted-effects.js', 'runtime.test.cjs']) {
  const expected = report.sources?.find(entry => entry.path === source + file);
  const actual = describe(source + file);
  if (!expected || expected.sha256 !== actual.sha256) throw new Error('CPU report/source drift: ' + file);
}
const files = ['runtime.js', 'painted-effects.js', 'textures/soft-vfx-atlas.png', 'textures/soft-material-atlas.png', 'verification/runtime-tests.json'].map(file => describe(output + file));
const manifest = {
  revision: 'MG-SOFT-RUNTIME-READY1-2026-10-18', title: 'Cloudstitch',
  purpose: 'Selected soft machine gun presentation driven by actual fire, projectile and hit state',
  sources, files, read_dependencies: ['tools/battlefield/sim.mjs', 'tools/battlefield/integration.mjs', 'docs/ART_DIRECTION.txt'].filter(file => fs.existsSync(path.join(root, file))).map(describe),
  preservation: { frozen_inventory: describe('outputs/combat-vfx-v2/machine-gun-soft-v1/inventory.json'), files_checked: preserved, textures: preservation },
  verified: { cpu: true, cases: report.cases, actual_browser_integration: false, user_art_approval: false },
  caller_owns: ['shot/fire/damage/collision/ammo', 'actual projectile XYZ/velocity/lifetime', 'actual hit position and normal', 'camera/aim/audio'],
  paid_calls: 0, new_generated_images: 0,
  remaining: 'Battlefield composite, actual consumer import and browser fire→flight→hit QA owned by battlefield/integration.',
};
fs.writeFileSync(path.join(root, output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ revision: manifest.revision, manifest: describe(output + 'manifest.json'), sources: sources.length, files: files.length, predecessor_files_preserved: preserved }));
