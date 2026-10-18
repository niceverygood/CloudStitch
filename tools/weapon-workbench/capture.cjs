/* Capture browser-rendered previews with a fresh, identical camera for every style. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { repoPath, launchBrowser } = require('../lib/runtime.cjs');

// node tools/weapon-workbench/capture.cjs [weaponId] [outputDirectory] [catalogPath] [viewerHTML]
// No id means every completed item. Multiple items in a custom outputDirectory
// receive their own id subfolders; a single item writes directly to that folder.
async function frames(page, count = 6) {
  await page.evaluate(count => new Promise(resolve => {
    const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  }), count);
}
async function saveCanvasPNG(page, file) {
  // Capture WebGL pixels directly. Element screenshots also include overlapping
  // HTML labels and buttons, which do not belong in the standalone asset preview.
  const dataURL = await page.evaluate(() => window.__weaponWorkbench.renderer.domElement.toDataURL('image/png'));
  fs.writeFileSync(file, Buffer.from(dataURL.split(',')[1], 'base64'));
}
async function main() {
  const filterId = process.argv[2];
  const outputOverride = process.argv[3] && repoPath(process.argv[3]);
  const catalogPath = repoPath(process.argv[4] || 'outputs/weapon-modules/catalog.json');
  const viewerPath = repoPath(process.argv[5] || 'outputs/weapon-modules/index.html');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 2 });
  const errors = [], requests = [], results = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  try {
    await page.goto(pathToFileURL(viewerPath).href);
    await page.waitForFunction(() => window.__weaponReady || window.__weaponStats?.error, null, { timeout: 60000 });
    if (!(await page.evaluate(() => window.__weaponReady))) throw new Error(JSON.stringify(await page.evaluate(() => window.__weaponStats)));
    const available = await page.evaluate(() => window.__weaponWorkbench.availableItems);
    const items = filterId ? available.filter(item => item.id === filterId) : available;
    if (!items.length) throw new Error(filterId ? 'Requested weapon is unavailable: ' + filterId : 'No completed weapons are available.');
    for (const item of items) {
      const record = catalog.items.find(record => record.id === item.id);
      if (!record?.model) throw new Error('Catalog is missing a model path for ' + item.id);
      const output = outputOverride
        ? (items.length === 1 ? outputOverride : path.join(outputOverride, item.id))
        : path.dirname(path.resolve(path.dirname(catalogPath), record.model));
      fs.mkdirSync(output, { recursive: true });
      await page.selectOption('#weapon-select', item.id);
      await page.waitForFunction(id => window.__weaponReady && window.__weaponStats.selectedId === id, item.id, { timeout: 60000 });
      const captures = [];
      let initialCamera;
      for (const mode of ['handdrawn', 'cel', 'original']) {
        const pose = await page.evaluate(mode => {
          const viewer = window.__weaponWorkbench;
          viewer.setMounted(false);
          viewer.setAutoRotate(false);
          viewer.controls.enableDamping = false;
          viewer.setMode(mode);
          viewer.reset();
          return { position: viewer.camera.position.toArray(), target: viewer.controls.target.toArray(), zoom: viewer.camera.zoom };
        }, mode);
        if (!initialCamera) initialCamera = pose;
        if (JSON.stringify(pose) !== JSON.stringify(initialCamera)) throw new Error('Style preview camera changed for ' + item.id);
        await frames(page);
        const file = path.join(output, 'preview-' + mode + '.png');
        await saveCanvasPNG(page, file);
        captures.push({ mode, file, camera: pose });
      }
      if (!(await page.isDisabled('#mounted'))) {
        await page.evaluate(() => {
          const viewer = window.__weaponWorkbench;
          viewer.setMode('handdrawn');
          viewer.setMounted(true);
          viewer.reset();
        });
        await frames(page);
        const file = path.join(output, 'preview-mounted.png');
        await saveCanvasPNG(page, file);
        captures.push({ mode: 'mounted-handdrawn', file, placementPreviewOnly: true });
      }
      const result = { id: item.id, captures, actualBrowserRenders: true };
      results.push(result);
      console.log(JSON.stringify(result));
    }
    const externalRequests = requests.filter(url => /^https?:/i.test(url));
    if (errors.length || externalRequests.length) throw new Error(JSON.stringify({ errors, externalRequests }));
    console.log(JSON.stringify({ completed: results.length, errors, externalRequests, identicalStyleCamera: true }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
