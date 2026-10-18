const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { repoPath, reportDirectory, launchBrowser } = require('../lib/runtime.cjs');
const reportDir = reportDirectory('weapon-workbench', process.argv[3]);

async function frames(page, count = 3) {
  await page.evaluate(count => new Promise(resolve => {
    const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  }), count);
}
async function ghosting(page, mode) {
  return page.evaluate(async mode => {
    const viewer = window.__weaponWorkbench;
    viewer.reset(); viewer.setMode(mode); viewer.controls.enableDamping = false; viewer.controls.autoRotateSpeed = 18;
    const frames = count => new Promise(resolve => { const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); });
    const capture = () => {
      const source = viewer.renderer.domElement, canvas = document.createElement('canvas');
      canvas.width = source.width; canvas.height = source.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(source, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    viewer.setAutoRotate(true); await frames(120); viewer.setAutoRotate(false); await frames(4);
    const position = viewer.camera.position.toArray(), before = capture();
    viewer.renderer.clear(true, true, true); await frames(3);
    const after = capture(); let changedPixels = 0, totalChannelDifference = 0;
    for (let index = 0; index < before.length; index += 4) {
      let changed = false;
      for (let channel = 0; channel < 4; channel++) {
        const delta = Math.abs(before[index + channel] - after[index + channel]);
        totalChannelDifference += delta; if (delta) changed = true;
      }
      if (changed) changedPixels++;
    }
    const cameraDelta = Math.max(...position.map((value, index) => Math.abs(value - viewer.camera.position.toArray()[index])));
    return { mode, mounted: window.__weaponStats.mounted, rotationFrames: 120, changedPixels, totalChannelDifference, cameraDelta, cameraUnchanged: cameraDelta < 1e-8, outlineAutoClear: viewer.effect.autoClear === true };
  }, mode);
}
async function main() {
  const browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  const errors = [], requests = [], models = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  try {
    await page.goto(pathToFileURL(repoPath(process.argv[2] || 'outputs/weapon-modules/index.html')).href);
    await page.waitForFunction(() => window.__weaponReady || window.__weaponStats?.error, null, { timeout: 60000 });
    if (!(await page.evaluate(() => window.__weaponReady))) throw new Error(JSON.stringify(await page.evaluate(() => window.__weaponStats)));
    const available = await page.evaluate(() => window.__weaponWorkbench.availableItems);
    const filterId = process.argv[4];
    const items = filterId ? available.filter(item => item.id === filterId) : available;
    if (filterId && !items.length) throw new Error('Requested weapon is not available in this viewer: ' + filterId);
    if (!items.length) throw new Error('No actual completed weapons to verify.');
    for (const item of items) {
      await page.selectOption('#weapon-select', item.id);
      await page.waitForFunction(id => window.__weaponReady && window.__weaponStats.selectedId === id, item.id, { timeout: 60000 });
      await page.evaluate(() => window.__weaponWorkbench.setMounted(false));
      const initial = await page.evaluate(() => window.__weaponStats);
      if (!initial.meshCount || !initial.triangleCount || !initial.texturesReady) throw new Error('Invalid GLB readiness: ' + item.id);
      const regressions = [];
      for (const mode of ['handdrawn', 'cel', 'original']) {
        await page.click(`[data-mode="${mode}"]`);
        await frames(page);
        if (await page.evaluate(() => window.__weaponStats.mode) !== mode) throw new Error('Mode did not change: ' + mode);
        await page.locator('#stage canvas').screenshot({ path: path.join(reportDir, item.id + '-' + mode + '.png') });
        regressions.push(await ghosting(page, mode));
      }
      const downloadPromise = page.waitForEvent('download');
      await page.click('#download');
      const download = await downloadPromise;
      const downloadPath = path.join(reportDir, item.id + '.glb');
      await download.saveAs(downloadPath);
      const downloaded = fs.readFileSync(downloadPath);
      if (downloaded.length !== initial.sourceBytes || downloaded.readUInt32LE(0) !== 0x46546c67) throw new Error('Embedded GLB download mismatch: ' + item.id);
      const shipAvailable = !(await page.isDisabled('#mounted'));
      if (shipAvailable) {
        await page.check('#mounted'); await frames(page);
        const placement = await page.evaluate(() => ({ mounted: window.__weaponStats.mounted, shipVisible: window.__weaponWorkbench.shipRoot?.visible }));
        if (!placement.mounted || !placement.shipVisible) throw new Error('Mounted comparison failed: ' + item.id);
        await page.locator('#yaw').fill('45'); await page.locator('#yaw').dispatchEvent('input');
        await page.locator('#mount-scale').fill('1.25'); await page.locator('#mount-scale').dispatchEvent('input');
        const adjustment = await page.evaluate(() => ({ yaw: window.__weaponStats.yawDegrees, scale: window.__weaponStats.mountScale }));
        if (adjustment.yaw !== 45 || adjustment.scale !== 1.25) throw new Error('Mount adjustments failed.');
        await page.click('[data-mode="handdrawn"]');
        await page.click('#reset'); await frames(page);
        await page.screenshot({ path: path.join(reportDir, item.id + '-mounted.png'), fullPage: true });
        regressions.push(await ghosting(page, 'handdrawn'));
        await page.uncheck('#mounted');
      }
      models.push({ id: item.id, initial, downloadBytes: downloaded.length, shipComparison: shipAvailable, regressions });
      console.log(JSON.stringify({ id: item.id, triangles: initial.triangleCount, ghosting: regressions.map(result => result.changedPixels) }));
    }
    await page.click('#reset'); await frames(page);
    const oldPosition = await page.evaluate(() => window.__weaponWorkbench.camera.position.toArray());
    const stage = await page.locator('#stage').boundingBox();
    const center = { x: stage.x + stage.width * .5, y: stage.y + stage.height * .5 };
    await page.mouse.move(center.x, center.y); await page.mouse.down(); await page.mouse.move(center.x + 85, center.y + 35, { steps: 8 }); await page.mouse.up(); await frames(page, 6);
    const newPosition = await page.evaluate(() => window.__weaponWorkbench.camera.position.toArray());
    if (JSON.stringify(oldPosition) === JSON.stringify(newPosition)) throw new Error('Drag rotation failed.');
    const oldZoom = await page.evaluate(() => window.__weaponWorkbench.camera.zoom);
    await page.mouse.wheel(0, -160); await frames(page, 6);
    if (await page.evaluate(() => window.__weaponWorkbench.camera.zoom) === oldZoom) throw new Error('Wheel zoom failed.');
    await page.click('#rotate');
    if (await page.getAttribute('#rotate', 'aria-pressed') !== 'true') throw new Error('Automatic rotation toggle failed.');
    await page.click('#reset');
    if (await page.getAttribute('#rotate', 'aria-pressed') !== 'false') throw new Error('Reset did not stop automatic rotation.');
    await page.click('#fit'); await page.uncheck('#outline');
    if (await page.evaluate(() => window.__weaponStats.outlineEnabled) !== false) throw new Error('Outline disable failed.');
    await page.check('#outline');
    await page.locator('#thickness').fill('2.4'); await page.locator('#thickness').dispatchEvent('input');
    if (await page.evaluate(() => window.__weaponStats.outlinePixels) !== 2.4) throw new Error('Outline thickness failed.');
    await page.setViewportSize({ width: 390, height: 844 }); await frames(page, 6);
    await page.screenshot({ path: path.join(reportDir, 'qa-mobile.png'), fullPage: true });
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const externalRequests = requests.filter(url => /^https?:/i.test(url));
    const report = { models, errors, externalRequests, mobileOverflow, dragRotate: true, wheelZoom: true, passed: !errors.length && !externalRequests.length && !mobileOverflow && models.every(model => model.regressions.every(result => result.changedPixels === 0 && result.cameraUnchanged && result.outlineAutoClear)) };
    fs.writeFileSync(path.join(reportDir, 'qa-result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, models: models.length, errors, externalRequests, mobileOverflow }, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    await page.screenshot({ path: path.join(reportDir, 'qa-failure.png'), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(reportDir, 'qa-error.json'), JSON.stringify({ error: error.message, errors }, null, 2));
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
