'use strict';
// Creates only comparison previews. Frozen fleet-v1/fleet-v2 are read-only.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'outputs/fleet-comparison-v1');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
async function main() {
  if (process.argv.includes('--help')) { process.stdout.write('node tools/fleet-comparison/capture.cjs [--resume]\nCreates current v2 62 previews and preserves v1 nine design-alternative previews, in a separate output directory.\n'); return; }
  const v2 = read('outputs/fleet-v2/catalog.json'), v1 = read('outputs/fleet-v1/catalog.json');
  fs.mkdirSync(path.join(out, 'previews'), { recursive: true });
  const reportPath = path.join(out, 'previews.json');
  const prior = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : { items: [] };
  const records = { version: 'fleet-comparison-previews-1', items: [], scope: 'Actual model thumbnails and preserved archived thumbnails; no new GLB generation or combat verification.' };
  const pending = [];
  const all = [...v2.ships.map(ship => ({ ...ship, version: 'v2' })), ...v1.ships.filter(ship => ship.category === 'preexisting-variant').map(ship => ({ ...ship, version: 'v1' }))];
  for (const ship of all) {
    const sourceRoot = path.join(root, 'outputs/fleet-' + ship.version), target = 'previews/' + ship.id + '.png';
    const old = prior.items.find(item => item.id === ship.id);
    if (process.argv.includes('--resume') && old?.modelSha256 === ship.sha256 && fs.existsSync(path.join(out, target)) && sha(fs.readFileSync(path.join(out, target))) === old.previewSha256) { records.items.push(old); continue; }
    const sourcePreview = path.join(sourceRoot, ship.previewPath);
    if ((ship.version === 'v1' || ship.previewSourceSha256 === ship.sha256) && fs.existsSync(sourcePreview)) {
      const bytes = fs.readFileSync(sourcePreview); fs.writeFileSync(path.join(out, target), bytes);
      records.items.push({ id: ship.id, sourceVersion: ship.version, modelSha256: ship.sha256, previewPath: target, previewSha256: sha(bytes), method: ship.version === 'v1' ? 'preserved-v1-design-alternative-thumbnail' : 'copied-current-model-sha-matched-v2-thumbnail', source: 'outputs/fleet-' + ship.version + '/' + ship.previewPath });
    } else pending.push({ ship, sourceRoot, target });
  }
  const write = () => { records.updatedAt = new Date().toISOString(); records.actualCount = records.items.length; fs.writeFileSync(reportPath, JSON.stringify(records, null, 2) + '\n'); };
  write();
  if (pending.length) {
    const { launchBrowser } = require('../lib/runtime.cjs');
    const browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 950 }, deviceScaleFactor: 1 });
      for (const { ship, sourceRoot, target } of pending) {
        await page.goto(pathToFileURL(path.join(sourceRoot, ship.viewerPath)).href, { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction(() => window.__rigReady === true || Boolean(window.__rigStats?.error), null, { timeout: 60000 });
        const state = await page.evaluate(() => {
          if (window.__rigStats?.error) throw new Error(window.__rigStats.error);
          const v = window.__rigViewer; v.setPlaying(false); v.setTime(2); v.setComparison?.(false); v.setSilhouette?.(false); v.controls.enableDamping = false; v.reset();
          document.querySelectorAll('.stage-label,.view-tools,.caption').forEach(el => { el.style.display = 'none'; });
          return { ready: window.__rigStats.ready, assetId: v.rig.userData.assetId, outlineAutoClear: v.outlineEffect.autoClear };
        });
        if (state.assetId !== ship.id || !state.ready || state.outlineAutoClear !== true) throw new Error('Wrong or unready model: ' + ship.id);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const bytes = await page.locator('#stage').screenshot({ path: path.join(out, target) });
        records.items.push({ id: ship.id, sourceVersion: ship.version, modelSha256: ship.sha256, previewPath: target, previewSha256: sha(bytes), method: 'actual-paused-v2-GLB-render', capturedAt: new Date().toISOString(), state });
        write(); process.stdout.write(JSON.stringify({ preview: ship.id, count: records.items.length, total: all.length }) + '\n');
      }
    } finally { await browser.close(); }
  }
  write(); process.stdout.write(JSON.stringify({ output: 'outputs/fleet-comparison-v1/previews.json', previews: records.items.length, expected: all.length }) + '\n');
}
main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
