'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'outputs/fleet-v2');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const relative = file => path.relative(root, file).split(path.sep).join('/');
const catalog = read('outputs/fleet-v2/catalog.json');
const verification = read('outputs/fleet-v2/verification-structure.json');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]);
const files = [...walk(__dirname), ...walk(out)].filter(file => path.basename(file) !== 'source-manifest.json').sort().map(file => ({ path: relative(file), bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) }));
const originalInputs = ['tools/fleet/catalog.json', 'outputs/fleet-v1/catalog.json', 'outputs/fleet-v1/handpainted-atlas-v2.png', 'tools/fleet/body.js', 'tools/fleet/devices.js', 'tools/fleet/rigging.js', 'tools/airship-rig/motion.js', 'tools/lib/runtime.cjs', 'package.json', 'package-lock.json'].filter(file => fs.existsSync(path.join(root, file))).map(file => ({ path: file, bytes: fs.statSync(path.join(root, file)).size, sha256: sha(fs.readFileSync(path.join(root, file))) }));
const built = catalog.ships.filter(ship => ship.status === 'asset-built-v2');
const validPreviews = built.filter(ship => ship.previewSourceSha256 === ship.sha256 && fs.existsSync(path.join(out, ship.previewPath)));
const originalPlayer = fs.readFileSync(path.join(root, 'outputs/fleet-v1/ships/player-homeward.glb'));
const copiedPlayer = fs.readFileSync(path.join(out, 'ships/player-homeward.glb'));
const record = {
  version: 'fleet-v2-art-ready-1', capturedAt: new Date().toISOString(),
  status: 'generated-art-package; integrated-browser-QA-and-gameplay-mapping-pending',
  scope: 'Distinct silhouette art prototypes; no replacement of stable fleet-v1 combat assets.',
  catalogEntries: catalog.ships.length, builtModels: built.length,
  builtViewers: built.filter(ship => fs.existsSync(path.join(out, ship.viewerPath))).length,
  newModels: built.filter(ship => ship.id !== 'player-homeward').length,
  validModelPreviews: validPreviews.length,
  actualSilhouettePreviews: validPreviews.filter(ship => ship.silhouettePath && fs.existsSync(path.join(out, ship.silhouettePath))).length,
  structure: { passed: verification.passed, selected: verification.selectedIds.length, report: 'outputs/fleet-v2/verification-structure.json' },
  originalPlayer: { source: 'outputs/fleet-v1/ships/player-homeward.glb', sha256: sha(originalPlayer), byteIdentical: originalPlayer.equals(copiedPlayer), note: 'Rigged v1 derivative, not the raw 11026-triangle selected-airship source.' },
  originalPreservation: 'Read-only source audit: writes limited to new fleet-v2/work/fleet-v2 files, plus a pointer in tools/fleet/HANDOFF.md. No before-and-after rehash of all historical originals is claimed.',
  pending: ['Integrated browser interaction/3 display modes/7 clips/outline/mobile/request/ghosting QA', 'Final hand-painted polish review against selected hero', 'Battlefield bounds/collision/muzzle/socket/scale mapping and actual combat verification', 'HTML LFS rule before any commit'],
  originalInputs, files,
};
fs.writeFileSync(path.join(out, 'source-manifest.json'), JSON.stringify(record, null, 2) + '\n');
process.stdout.write(JSON.stringify({ status: record.status, models: built.length, previews: validPreviews.length, files: files.length, manifest: 'outputs/fleet-v2/source-manifest.json', manifestSha256: sha(fs.readFileSync(path.join(out, 'source-manifest.json'))) }) + '\n');
