/* Save clean native WebGL PNGs of actual world GLBs; never edit reference PNGs.
 * node tools/world-assets/capture.cjs [id] [outputDirectory] [catalogPath] [viewerHTML]
 */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { repoPath, launchBrowser } = require('../lib/runtime.cjs');
async function frames(page, count = 4) {
  await page.evaluate(count => new Promise(resolve => { const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }), count);
}
async function main() {
  const id = process.argv[2], outputDirectory = process.argv[3] && repoPath(process.argv[3]);
  const catalogPath = repoPath(process.argv[4] || 'outputs/world-assets/catalog.json');
  const sceneCatalog = /scene-catalog\.json$/i.test(catalogPath);
  const html = repoPath(process.argv[5] || (sceneCatalog ? 'outputs/world-assets/scenes.html' : 'outputs/world-assets/index.html'));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8').replace(/^\uFEFF/, ''));
  const browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 1180 }, deviceScaleFactor: 2 });
  const errors = [], externalRequests = [], captures = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (/^https?:/i.test(request.url())) { const url = new URL(request.url()); externalRequests.push(url.origin + url.pathname); } });
  try {
    await page.goto(pathToFileURL(html).href); await page.waitForFunction(() => window.__worldReady || window.__worldStats?.error, null, { timeout: 60000 });
    if (!(await page.evaluate(() => window.__worldReady))) throw new Error(JSON.stringify(await page.evaluate(() => window.__worldStats)));
    // A square native drawing surface makes tall landmarks and wide docks
    // equally legible in gallery cards; no postprocessing of the PNG occurs.
    await page.addStyleTag({content:'.shell{max-width:820px;padding:20px}#stage{height:776px;min-height:776px}'});
    await frames(page,3);
    const available = await page.evaluate(() => window.__worldWorkbench.availableItems), items = id ? available.filter(item => item.id === id) : available;
    if (!items.length) throw new Error(id ? 'Requested world asset is unavailable: ' + id : 'No real completed GLBs available.');
    for (const item of items) {
      const record = catalog.items.find(record => record.id === item.id);
      if (!record?.preview && !outputDirectory) throw new Error('Catalog needs an output preview path: ' + item.id);
      const output = outputDirectory ? path.join(outputDirectory, item.id + '.png') : path.resolve(path.dirname(catalogPath), record.preview);
      await page.evaluate(id => window.__worldWorkbench.selectAsset(id), item.id); await page.waitForFunction(id => window.__worldReady && window.__worldStats.selectedId === id, item.id, { timeout: 60000 });
      const state = await page.evaluate(() => {
        const viewer = window.__worldWorkbench; viewer.setPlaying(false); viewer.setAutoRotate(false); viewer.controls.enableDamping = false; viewer.setMode('handdrawn');
        for (const id of ['bounds', 'axes']) { const input = document.getElementById(id); input.checked = false; input.dispatchEvent(new Event('change')); }
        if (window.__worldStats.animationClipCount) viewer.setTime(window.__worldStats.animationDuration * .35);
        viewer.reset();
        return { id: window.__worldStats.selectedId, triangles: window.__worldStats.triangleCount, textureCount: window.__worldStats.textureCount, vertexColorMeshCount: window.__worldStats.vertexColorMeshCount, animationClipCount: window.__worldStats.animationClipCount, camera: { position: viewer.camera.position.toArray(), target: viewer.controls.target.toArray(), zoom: viewer.camera.zoom } };
      });
      await frames(page);
      const png = await page.evaluate(() => window.__worldWorkbench.renderer.domElement.toDataURL('image/png'));
      const bytes = Buffer.from(png.split(',')[1], 'base64'); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, bytes);
      const result = { ...state, output, bytes: bytes.length, source: 'Native WebGL rendering of the actual GLB; transparent PNG; no raster editing.' }; captures.push(result); console.log(JSON.stringify(result));
    }
    if (errors.length || externalRequests.length) throw new Error(JSON.stringify({ errors, externalRequests }));
    console.log(JSON.stringify({ passed: true, captures: captures.length, errors, externalRequests }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
