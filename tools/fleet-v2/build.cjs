'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const esbuild = require('esbuild');
const { launchBrowser } = require('../lib/runtime.cjs');
const { writeGallery } = require('./gallery.cjs');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'outputs/fleet-v2'), work = path.join(root, 'work/fleet-v2');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const nodePaths = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
let viewerCode;
const coreIds = ['player-homeward', 'enemy-pirate-scout', 'enemy-cult-blockade', 'enemy-union-salvage', 'enemy-union-repair', 'enemy-ghost-chaser', 'enemy-disguised-wreck', 'boss-bell-devourer'];

async function main() {
  const { getProfile, resolveArtModules, PROFILE_VERSION, SHOWCASE_IDS } = await import('./profiles.mjs');
  const { inspectGlb } = await import('./verify.mjs');
  const source = read('tools/fleet/catalog.json'), previous = read('outputs/fleet-v1/catalog.json');
  const args = process.argv.slice(2), onlyArg = args.find(arg => arg.startsWith('--ids='));
  const ids = onlyArg ? onlyArg.slice(6).split(',') : args.includes('--core') ? coreIds : args.includes('--showcase') ? SHOWCASE_IDS : null;
  const existing = fs.existsSync(path.join(out, 'catalog.json')) ? read('outputs/fleet-v2/catalog.json') : null;
  fs.mkdirSync(path.join(out, 'ships'), { recursive: true }); fs.mkdirSync(path.join(out, 'previews'), { recursive: true }); fs.mkdirSync(work, { recursive: true });
  const catalog = {
    version: PROFILE_VERSION, title: 'Cloudstitch · 서로 다른 하늘의 함대', status: 'new-identity-art-prototypes',
    originalCatalogCount: 71, activeEntryCount: 62, entryCountIsUniqueHullCount: false,
    excludes: source.ships.filter(ship => ship.category === 'preexisting-variant').map(ship => ship.id),
    originalPreservation: 'All fleet-v1, original art and selected player remain unchanged; selected player GLB copied byte-identically.',
    axes: { up: '+Y', forward: '-X for new procedural models; player retains original axes', units: 'fleet-kit visual LU, not metres', integrationStatus: 'New bounds/pivots; do not replace current combat collision or VFX sockets automatically' },
    ships: source.ships.filter(ship => ship.category !== 'preexisting-variant').map(ship => {
      const p = getProfile(ship.id), prior = previous.ships.find(item => item.id === ship.id);
      return existing?.ships.find(item => item.id === ship.id) || { ...ship, status: 'planned-v2', assetPath: `ships/${ship.id}.glb`, model: `ships/${ship.id}.glb`, viewerPath: `ships/${ship.id}.html`, previewPath: `previews/${ship.id}.png`, identityFamily: p.family, readableSilhouette: p.identity, identity: { family: p.family, tagline: p.identity.silhouette, landmarks: p.landmarks, silhouette: p.identity.silhouette, ...p.identity, showcasePriority: p.showcasePriority }, artModules: resolveArtModules(ship, prior.artModules), sourceV1Sha256: prior.sha256, geometrySignature: null, integrationStatus: 'visual-review-only; changed colliders and sockets require mapping' };
    }),
  };
  const selected = catalog.ships.filter(ship => !ids || ids.includes(ship.id));
  if (!selected.length || ids?.some(id => !selected.some(ship => ship.id === id))) throw new Error('Unknown or empty v2 selection');
  const reference = fs.readFileSync(path.join(root, 'outputs/fleet-v1/ships/player-homeward.glb'));
  const pipelineHash = sha(Buffer.concat(['geometry.js', 'assemble.js', 'export.js', 'profiles.mjs'].map(file => fs.readFileSync(path.join(__dirname, file)))));
  const result = await esbuild.build({ entryPoints: [path.join(__dirname, 'export.js')], bundle: true, write: false, format: 'iife', target: 'chrome100', nodePaths });
  const builder = path.join(work, 'builder.html'); fs.writeFileSync(builder, '<!doctype html><meta charset="utf-8"><script>' + result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(); page.on('pageerror', error => process.stderr.write(error.message + '\n'));
    await page.goto(pathToFileURL(builder).href);
    await page.evaluate(atlas => window.__initFleetV2(atlas), fs.readFileSync(path.join(root, 'outputs/fleet-v1/handpainted-atlas-v2.png')).toString('base64'));
    for (const ship of selected) {
      const original = source.ships.find(item => item.id === ship.id), prior = previous.ships.find(item => item.id === ship.id), profile = getProfile(ship.id);
      const buildHash = sha(Buffer.from(pipelineHash + JSON.stringify(profile) + JSON.stringify(original.modules)));
      const target = path.join(out, ship.assetPath); let binary, built;
      if (args.includes('--resume') && ship.buildHash === buildHash && fs.existsSync(target) && sha(fs.readFileSync(target)) === ship.sha256) binary = fs.readFileSync(target);
      else {
        built = profile.preserveOriginal ? { metrics: prior.metrics, artModules: prior.artModules, shapeProposal: { originalSelectedAsset: true }, style: prior.style, availableActions: prior.availableActions } : await page.evaluate(input => window.__exportFleetV2(input), { ship: original, profile, art: prior.artModules });
        binary = profile.preserveOriginal ? reference : Buffer.from(built.base64, 'base64');
        fs.writeFileSync(target, binary);
      }
      const observed = inspectGlb(binary);
      Object.assign(ship, { status: 'asset-built-v2', bytes: binary.length, sha256: sha(binary), buildHash, metrics: built?.metrics || ship.metrics, artModules: built?.artModules || ship.artModules, shapeProposal: built?.shapeProposal || ship.shapeProposal, style: built?.style || ship.style, availableActions: built?.availableActions || ship.availableActions, identityFamily: profile.family, readableSilhouette: profile.identity, declaredSilhouette: profile.identity, identity: { family: profile.family, tagline: profile.identity.silhouette, landmarks: profile.landmarks, silhouette: profile.identity.silhouette, ...profile.identity, showcasePriority: profile.showcasePriority }, geometrySignature: observed.observedGeometrySignature, bounds: observed.staticNodeBounds, observedBounds: observed.staticNodeBounds, authoredUnits: profile.preserveOriginal ? 'selected-original' : 'fleet-kit', recommendedFleetScale: profile.preserveOriginal ? prior.recommendedFleetScale : 1, qaStatus: 'structure-pending-browser-pending', productionNote: 'New silhouette architecture and painted-material interpretation. Static/rigged art only; battle geometry and sockets not automatically upgraded.' });
      await buildViewer(ship, binary, reference);
      catalog.assetCount = catalog.ships.filter(item => item.status === 'asset-built-v2').length; catalog.updatedAt = new Date().toISOString();
      fs.writeFileSync(path.join(out, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
      process.stdout.write(JSON.stringify({ id: ship.id, family: ship.identityFamily, bytes: binary.length, triangles: observed.triangles, bounds: observed.staticNodeBounds?.size, built: catalog.assetCount }) + '\n');
    }
  } finally { await browser.close(); }
  process.stdout.write(JSON.stringify(writeGallery()) + '\n');
}
async function buildViewer(ship, binary, reference) {
  if (!viewerCode) {
    const result = await esbuild.build({ entryPoints: [path.join(__dirname, 'viewer.js')], bundle: true, minify: true, write: false, format: 'iife', target: ['chrome100', 'safari16'], nodePaths, define: { __MODEL_BASE64__: 'window.__FLEET_MODEL_B64__', __MODEL_BYTES__: 'window.__FLEET_MODEL_BYTES__', __REFERENCE_BASE64__: 'window.__FLEET_REFERENCE_B64__' } });
    viewerCode = result.outputFiles[0].text;
  }
  // Binary strings do not need a JS parser/minifier pass for every model.
  const script = 'window.__FLEET_MODEL_B64__=' + JSON.stringify(binary.toString('base64')) + ';window.__FLEET_MODEL_BYTES__=' + binary.length + ';window.__FLEET_REFERENCE_B64__=' + JSON.stringify(reference.toString('base64')) + ';' + viewerCode;
  const name = ship.name.replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  const template = fs.readFileSync(path.join(__dirname, 'viewer-template.html'), 'utf8').replaceAll('__ASSET_NAME__', name);
  fs.writeFileSync(path.join(out, ship.viewerPath), template.replace('/* BUNDLED_VIEWER */', () => script.replace(/<\/script/gi, '<\\/script')));
}
main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
