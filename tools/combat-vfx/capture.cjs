/* Capture a representative frame from each actual GLB AnimationMixer clip.
 * node tools/combat-vfx/capture.cjs [effectId] [outputDirectory] [catalogPath] [viewerHTML] [timeFraction]
 */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { repoPath, launchBrowser } = require('../lib/runtime.cjs');

async function frames(page, count = 4) {
  await page.evaluate(count => new Promise(resolve => { const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }), count);
}
async function main() {
  const selectedId = process.argv[2];
  const outputDirectory = process.argv[3] && repoPath(process.argv[3]);
  const catalogPath = repoPath(process.argv[4] || 'outputs/combat-vfx/catalog.json');
  const viewerPath = repoPath(process.argv[5] || 'outputs/combat-vfx/index.html');
  const fraction = process.argv[6] === undefined ? .35 : Number(process.argv[6]);
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new Error('Representative time fraction must be between zero and one.');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 2 });
  const errors = [], externalRequests = [], captures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/i.test(request.url())) externalRequests.push(new URL(request.url()).origin + new URL(request.url()).pathname); });
  try {
    await page.goto(pathToFileURL(viewerPath).href);
    await page.waitForFunction(() => window.__vfxReady || window.__vfxStats?.error, null, { timeout: 60000 });
    if (!(await page.evaluate(() => window.__vfxReady))) throw new Error(JSON.stringify(await page.evaluate(() => window.__vfxStats)));
    const available = await page.evaluate(() => window.__vfxWorkbench.availableItems);
    const items = selectedId ? available.filter(item => item.id === selectedId) : available;
    if (!items.length) throw new Error(selectedId ? 'Requested effect is unavailable: ' + selectedId : 'No completed effect models.');
    for (const item of items) {
      const entry = catalog.items.find(entry => entry.id === item.id);
      if (!entry?.preview && !outputDirectory) throw new Error('Catalog needs a preview path for ' + item.id);
      const output = outputDirectory ? path.join(outputDirectory, item.id + '.png') : path.resolve(path.dirname(catalogPath), entry.preview);
      await page.evaluate(id => window.__vfxWorkbench.selectEffect(id), item.id);
      await page.waitForFunction(id => window.__vfxReady && window.__vfxStats.selectedId === id, item.id, { timeout: 60000 });
      const state = await page.evaluate(fraction => {
        const viewer = window.__vfxWorkbench;
        viewer.setPlaying(false); viewer.setLoop(false); viewer.setAutoRotate(false); viewer.controls.enableDamping = false;
        viewer.setTarget('none'); viewer.reset();
        viewer.setTime(window.__vfxStats.duration * fraction);
        return { id: window.__vfxStats.selectedId, time: window.__vfxStats.currentTime, duration: window.__vfxStats.duration, clipCount: window.__vfxStats.animationClipCount, camera: { position: viewer.camera.position.toArray(), target: viewer.controls.target.toArray(), zoom: viewer.camera.zoom } };
      }, fraction);
      await frames(page);
      const dataURL = await page.evaluate(() => window.__vfxWorkbench.renderer.domElement.toDataURL('image/png'));
      const bytes = Buffer.from(dataURL.split(',')[1], 'base64');
      fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, bytes);
      const result = { ...state, file: output, bytes: bytes.length, source: 'Actual WebGL rendering of the GLB clip; transparent PNG; no raster editing.' };
      captures.push(result); console.log(JSON.stringify(result));
    }
    if (errors.length || externalRequests.length) throw new Error(JSON.stringify({ errors, externalRequests }));
    console.log(JSON.stringify({ captures: captures.length, representativeFraction: fraction, errors, externalRequests, passed: true }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
