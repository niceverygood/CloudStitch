'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'outputs/fleet-comparison-v1');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(root, file).split(path.sep).join('/');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const inventory = JSON.parse(fs.readFileSync(path.join(out, 'inventory.json'), 'utf8'));
const check = JSON.parse(fs.readFileSync(path.join(out, 'verification-structure.json'), 'utf8'));
if (!check.passed) throw new Error('Structural verification must pass before snapshot');
const files = [...walk(__dirname), ...walk(out)].filter(file => path.basename(file) !== 'source-manifest.json').sort().map(file => ({ path: relative(file), bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) }));
const record = {
  version: inventory.version, capturedAt: new Date().toISOString(),
  scope: 'Comparison gallery and preview images only; no model, viewer, encounter, combat or save changes.',
  counts: inventory.counts, stageCount: inventory.stages.length,
  stageBossSlotCount: inventory.stages.reduce((n, s) => n + Boolean(s.midBoss?.assetId) + Boolean(s.finalBoss?.assetId), 0),
  stageAssignments: 'Current prototype encounter roles. Canon campaign boss decisions are separate and may be unspecified.',
  preservedFleetV2ManifestSha256: inventory.preservedFleetV2ManifestSha256,
  externalReadOnlyDependencies: ['outputs/fleet-v1/', 'outputs/fleet-v2/'],
  browserVerification: fs.existsSync(path.join(out, 'verification-browser.json')) ? 'See separate exact report and scope; do not infer success from existence.' : 'Not run by asset author; reserved sequential integration QA.',
  files,
};
const target = path.join(out, 'source-manifest.json');
fs.writeFileSync(target, JSON.stringify(record, null, 2) + '\n');
process.stdout.write(JSON.stringify({ manifest: relative(target), sha256: sha(fs.readFileSync(target)), files: files.length, counts: record.counts }) + '\n');
