'use strict';

// One browser/page, sequential viewer checks. --help and require() are read-only.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'outputs/enemy-fleet-gallery-v1');
const work = path.join(root, 'work/verification/enemy-fleet-gallery');
const DESKTOP = { width: 1440, height: 1080 };
const MOBILE = { width: 390, height: 844 };
const MODES = ['handdrawn', 'cel', 'original'];
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const relative = file => path.relative(root, file).split(path.sep).join('/');
const within = (base, file) => { const delta = path.relative(base, file); return delta !== '..' && !delta.startsWith('..' + path.sep) && !path.isAbsolute(delta); };
const resolveAsset = value => {
  const file = path.resolve(out, decodeURIComponent(value.split(/[?#]/)[0]));
  if (!within(path.join(root, 'outputs'), file)) throw new Error('Asset path is outside outputs: ' + value);
  return file;
};

async function localServer() {
  const base = fs.realpathSync(path.join(root, 'outputs'));
  const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.glb': 'model/gltf-binary', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
  const server = http.createServer((request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const file = path.resolve(root, '.' + pathname);
      if (!within(base, file)) { response.writeHead(403).end(); return; }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
      if (!within(base, fs.realpathSync(file))) { response.writeHead(403).end(); return; }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size, 'Cache-Control': 'no-store' });
      if (request.method === 'HEAD') response.end(); else fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
    } catch { response.writeHead(400).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, origin: 'http://127.0.0.1:' + server.address().port };
}

const frames = (target, count = 3) => target.evaluate(count => new Promise(resolve => {
  const next = () => { if (--count <= 0) resolve(); else requestAnimationFrame(next); };
  requestAnimationFrame(next);
}), count);

const overflow = target => target.evaluate(() => {
  const rect = document.querySelector('#stage canvas')?.getBoundingClientRect();
  return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, canvas: rect ? { left: rect.left, right: rect.right, width: rect.width } : null,
    passed: document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1 && (!rect || rect.left >= -1 && rect.right <= innerWidth + 1) };
});

const state = target => target.evaluate(() => {
  const v = window.__rigViewer;
  return { ...window.__rigStats, assetId: v.rig.userData.assetId, renderCalls: v.renderer.info.render.calls, camera: v.camera.position.toArray(), zoom: v.camera.zoom, outlineAutoClearActual: v.outlineEffect.autoClear };
});

async function ready(target) {
  await target.waitForFunction(() => window.__rigReady === true || Boolean(window.__rigStats?.error), null, { timeout: 90000 });
  const error = await target.evaluate(() => window.__rigStats?.error);
  if (error) throw new Error(error);
  await target.evaluate(() => { const v = window.__rigViewer; v.setPlaying(false); v.controls.enableDamping = false; v.setComparison?.(false); v.setSilhouette?.(false); v.reset(); });
  await frames(target, 3);
}

async function screenshot(page, name, report) {
  const file = path.join(work, name + '.png');
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(relative(file));
}

async function inspectViewer(page, ship, record, report) {
  await page.locator('#search').fill('');
  await page.locator('#faction').selectOption('');
  await page.locator('[data-filter="all"]').click();
  await page.locator('#cards article[data-id="' + ship.id + '"] button[data-viewer]').first().click();
  await page.waitForFunction(() => document.querySelector('#viewer-frame')?.contentWindow?.__rigReady === true || Boolean(document.querySelector('#viewer-frame')?.contentWindow?.__rigStats?.error), null, { timeout: 90000 });
  const handle = await page.locator('#viewer-frame').elementHandle();
  const frame = await handle.contentFrame();
  if (!frame) throw new Error('Viewer frame missing: ' + ship.id);
  await ready(frame);
  const first = await state(frame);
  record('actual-model-load', first.assetId === ship.id && first.ready === true && first.meshCount > 0 && first.triangleCount > 0 && first.texturesReady === true && first.sourceBytes === fs.statSync(resolveAsset(ship.assetPath)).size && first.renderCalls > 0, first);
  record('explicit-outline-auto-clear', first.outlineAutoClearActual === true && first.outlineAutoClear === true);
  record('one-active-viewer', await page.locator('iframe[src]:not([src="about:blank"]):not([src=""])').count() === 1);
  for (const mode of MODES) {
    await frame.locator('[data-mode="' + mode + '"]').click(); await frames(frame);
    const modeState = await state(frame);
    record('mode:' + mode, modeState.mode === mode && modeState.renderCalls > 0 && await frame.locator('[data-mode="' + mode + '"]').getAttribute('aria-pressed') === 'true');
    const pixels = await frame.evaluate(async mode => {
      const v = window.__rigViewer;
      v.reset(); v.setPlaying(false); v.setProfile('FloatIdle'); v.setTime(.4); v.setMode(mode);
      v.controls.enableDamping = false; v.controls.autoRotateSpeed = 18;
      const frames = count => new Promise(resolve => { const next = () => { if (--count <= 0) resolve(); else requestAnimationFrame(next); }; requestAnimationFrame(next); });
      const capture = () => { const source = v.renderer.domElement, canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height; const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height).data; };
      const start = v.camera.position.toArray();
      v.setAutoRotate(true); await frames(120); v.setAutoRotate(false); await frames(4);
      const cameraBefore = v.camera.position.toArray(), before = capture();
      v.renderer.clear(true, true, true); await frames(3);
      const cameraAfter = v.camera.position.toArray(), after = capture();
      let changedPixels = 0, totalChannelDifference = 0, opaquePixels = 0;
      for (let i = 0; i < before.length; i += 4) { let changed = false; if (before[i + 3] > 0) opaquePixels++; for (let channel = 0; channel < 4; channel++) { const d = Math.abs(before[i + channel] - after[i + channel]); totalChannelDifference += d; if (d) changed = true; } if (changed) changedPixels++; }
      return { mode, rotationFrames: 120, changedPixels, totalChannelDifference, opaquePixels, pixelCount: before.length / 4, rotationDistance: Math.hypot(...cameraBefore.map((value, index) => value - start[index])), cameraDelta: Math.max(...cameraBefore.map((value, index) => Math.abs(value - cameraAfter[index]))), outlineAutoClear: v.outlineEffect.autoClear };
    }, mode);
    record('rotation-ghosting:' + mode, pixels.changedPixels === 0 && pixels.cameraDelta < 1e-8 && pixels.rotationDistance > .01 && pixels.opaquePixels > 100 && pixels.outlineAutoClear === true, pixels);
    report.ghosting.push({ id: ship.id, ...pixels });
  }
  await frame.locator('#outline').uncheck(); record('outline-off', (await state(frame)).outlineEnabled === false);
  await frame.locator('#outline').check(); record('outline-on', (await state(frame)).outlineEnabled === true);
  await frame.locator('#reset').click(); await frames(frame);
  const before = await state(frame);
  const canvas = frame.locator('#stage canvas'); await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox(); if (!bounds) throw new Error('Viewer has no canvas bounds.');
  const x = bounds.x + bounds.width * .5, y = bounds.y + bounds.height * .5;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 80, y + 20, { steps: 5 }); await page.mouse.up(); await frames(frame, 4);
  record('pointer-orbit', (await state(frame)).camera.some((value, index) => Math.abs(value - before.camera[index]) > .001));
  const zoomBefore = (await state(frame)).zoom;
  await page.mouse.wheel(0, -180); await frames(frame, 4);
  record('wheel-zoom', Math.abs((await state(frame)).zoom - zoomBefore) > .001);
  await frame.locator('#fit').click(); record('fit-view', Math.abs((await state(frame)).zoom - 1) < .001);
  await frame.locator('#rotate').click(); const rotating = await state(frame); await frames(frame, 8);
  record('auto-rotation', (await state(frame)).autoRotate === true && (await state(frame)).camera.some((value, index) => Math.abs(value - rotating.camera[index]) > .00001));
  await frame.locator('#reset').click(); const reset = await state(frame);
  record('reset-view', reset.autoRotate === false && Math.abs(reset.zoom - 1) < .001 && reset.view === 'perspective');
  await screenshot(page, ship.id + '-viewer', report);
  await page.setViewportSize(MOBILE); await frames(frame, 4);
  const innerMobile = await overflow(frame), outerMobile = await overflow(page);
  record('mobile-viewer-390', innerMobile.passed && outerMobile.passed, { frame: innerMobile, gallery: outerMobile });
  await page.setViewportSize(DESKTOP); await frames(frame, 3);
  await page.locator('#close-viewer').click();
  record('viewer-closes-and-stops', await page.locator('dialog[open]').count() === 0 && await page.locator('iframe[src]:not([src="about:blank"]):not([src=""])').count() === 0);
}

async function run() {
  fs.mkdirSync(work, { recursive: true });
  const report = { schema: 'cloudstitch-enemy-gallery-qa-1', startedAt: new Date().toISOString(), harness: relative(__filename), harnessSha256: sha(fs.readFileSync(__filename)), checks: [], screenshots: [], ghosting: [], pageErrors: [], consoleErrors: [], externalRequests: [], failedRequests: [], navigationAborts: [], httpErrors: [], limits: ['Gallery and two existing representative model viewers only; no new model generation.', 'Same-camera decoded canvas pixels before and after an explicit clean render test accumulation after 120 rotation frames. This is not a gameplay or long-run performance test.', '390px emulation is not physical mobile-device coverage.'] };
  let section = 'catalog', browser, context, server;
  const record = (name, passed, detail) => report.checks.push({ section, name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
  try {
    const data = JSON.parse(fs.readFileSync(path.join(out, 'catalog.json'), 'utf8'));
    record('catalog-26-unique-ships', data.ships.length === 26 && new Set(data.ships.map(ship => ship.id)).size === 26 && data.counts.enemy === 19 && data.counts.context === 7 && data.counts.total === 26, data.counts);
    for (const group of ['standard', 'mission', 'boss', 'context']) record('catalog-group:' + group, data.ships.filter(ship => ship.group === group).length === ({ standard: 7, mission: 7, boss: 5, context: 7 })[group]);
    const files = data.ships.map(ship => {
      const model = resolveAsset(ship.assetPath), image = resolveAsset(ship.previewPath), viewer = resolveAsset(ship.viewerPath);
      return { id: ship.id, modelExists: fs.existsSync(model), previewExists: fs.existsSync(image), viewerExists: fs.existsSync(viewer), modelSha256: sha(fs.readFileSync(model)), previewSha256: sha(fs.readFileSync(image)), expectedModelSha256: ship.sourceModelSha256, expectedPreviewSha256: ship.sourcePreviewSha256 };
    });
    record('26-model-preview-viewer-links-and-source-hashes', files.length === 26 && files.every(row => row.modelExists && row.previewExists && row.viewerExists && row.modelSha256 === row.expectedModelSha256 && row.previewSha256 === row.expectedPreviewSha256), files);
    const local = await localServer(); server = local.server;
    const { launchBrowser } = require('../lib/runtime.cjs');
    browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
    context = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await context.route('**/*', async route => { const url = route.request().url(); if (!url.startsWith(local.origin + '/') && !/^(?:data|blob):/.test(url)) { report.externalRequests.push({ section, url }); await route.abort(); } else await route.continue(); });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.pageErrors.push({ section, message: error.message }));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ section, message: message.text() }); });
    page.on('response', response => { if (response.status() >= 400) report.httpErrors.push({ section, url: response.url(), status: response.status() }); });
    page.on('requestfailed', request => { const row = { section, url: request.url(), error: request.failure()?.errorText }; if (request.isNavigationRequest() && row.url.startsWith(local.origin + '/') && row.error?.includes('ERR_ABORTED')) report.navigationAborts.push(row); else report.failedRequests.push(row); });
    report.browser = { version: browser.version(), desktop: DESKTOP, mobile: MOBILE, userAgent: await page.evaluate(() => navigator.userAgent), pages: 1 };
    section = 'gallery';
    await page.goto(local.origin + '/outputs/enemy-fleet-gallery-v1/index.html', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => Boolean(window.__enemyGallery));
    const cardIds = () => page.locator('#cards article[data-id]').evaluateAll(cards => cards.filter(card => !card.hidden && getComputedStyle(card).display !== 'none').map(card => card.dataset.id));
    record('default-19-enemy-cards', (await cardIds()).length === 19 && !(await cardIds()).some(id => data.ships.find(ship => ship.id === id).group === 'context'));
    record('no-initial-live-viewer', await page.locator('iframe[src]:not([src="about:blank"]):not([src=""])').count() === 0);
    record('comparison-initially-hidden', await page.locator('#compare-panel').isHidden());
    const images = await page.evaluate(async () => Promise.all(window.__enemyGallery.data.ships.map(async ship => { const image = new Image(); image.src = new URL(ship.previewPath, location.href).href; try { await image.decode(); return { id: ship.id, width: image.naturalWidth, height: image.naturalHeight, passed: image.naturalWidth > 0 && image.naturalHeight > 0 }; } catch (error) { return { id: ship.id, passed: false, error: error.message }; } })));
    record('26-browser-decoded-preview-images', images.length === 26 && images.every(row => row.passed), images);
    await screenshot(page, 'gallery-desktop', report);
    for (const filter of ['standard', 'mission', 'boss', 'context', 'all']) {
      await page.locator('[data-filter="' + filter + '"]').click();
      const ids = await cardIds(), expected = data.ships.filter(ship => filter === 'all' ? ship.group !== 'context' : ship.group === filter).map(ship => ship.id);
      record('filter:' + filter, ids.length === expected.length && expected.every(id => ids.includes(id)), { observed: ids, expected });
      record('result-count:' + filter, (await page.locator('#result-count').innerText()).includes(String(expected.length)));
    }
    const firstEnemy = data.ships.find(ship => ship.group === 'standard');
    await page.locator('#search').fill(firstEnemy.name);
    record('search-existing-name', (await cardIds()).includes(firstEnemy.id));
    await page.locator('#search').fill('존재하지않는함선_qa_7391');
    record('search-zero-results', (await cardIds()).length === 0);
    await page.locator('#clear-filters').click();
    record('clear-filters-restores-19', (await cardIds()).length === 19 && await page.locator('#search').inputValue() === '');
    const factionOptions = await page.locator('#faction option').evaluateAll(options => options.map(option => ({ value: option.value, text: option.textContent })).filter(option => option.value));
    if (factionOptions.length) {
      const faction = factionOptions.find(option => data.ships.some(ship => ship.faction === option.value)) || factionOptions[0];
      await page.locator('#faction').selectOption(faction.value);
      const tokens = { '마지막 숨 교단': '교단', '쇠갈비 연합': '연합', '이름 없는 함대': '이름 없는', '해적': '해적', '황궁 · 원숨': '황궁' };
      const marker = tokens[faction.value];
      const expected = data.ships.filter(ship => ship.group !== 'context' && (marker ? ship.faction.includes(marker) : !['교단', '연합', '이름 없는', '해적', '황궁'].some(token => ship.faction.includes(token)))).map(ship => ship.id), ids = await cardIds();
      record('faction-filter', expected.length > 0 && expected.length === ids.length && expected.every(id => ids.includes(id)), { faction, expected, observed: ids });
      await page.locator('#clear-filters').click();
    } else record('faction-options-exist', false);
    await page.locator('#toggle-compare').click();
    record('comparison-opens', await page.locator('#compare-panel').isVisible());
    const left = data.ships.find(ship => ship.id === 'enemy-pirate-scout'), right = data.ships.find(ship => ship.id === 'enemy-tax-cutter');
    if (!left || !right) throw new Error('The two representative ships must exist in the catalog.');
    await page.locator('#left-select').selectOption(left.id); await page.locator('#right-select').selectOption(right.id);
    const comparison = await page.evaluate(async () => {
      const ids = [document.getElementById('left-select').value, document.getElementById('right-select').value];
      return Promise.all(['compare-left', 'compare-right'].map(async (id, index) => { const element = document.getElementById(id), image = element.tagName === 'IMG' ? element : element.querySelector('img'), ship = window.__enemyGallery.data.ships.find(ship => ship.id === ids[index]); try { await image.decode(); return { id: ship.id, passed: image.naturalWidth > 0 && image.src === new URL(ship.previewPath, location.href).href, width: image.naturalWidth }; } catch (error) { return { id: ship.id, passed: false, error: error.message }; } }));
    });
    record('two-selected-ships-compare-images', comparison.length === 2 && comparison.every(row => row.passed), comparison);
    await screenshot(page, 'gallery-comparison', report);
    await page.setViewportSize(MOBILE); await frames(page, 3);
    const mobile = await overflow(page); record('mobile-gallery-and-comparison-390', mobile.passed, mobile);
    await screenshot(page, 'gallery-mobile-390', report);
    await page.setViewportSize(DESKTOP); await page.locator('#toggle-compare').click();
    for (const ship of [left, right]) {
      section = ship.id;
      try { await inspectViewer(page, ship, record, report); }
      catch (error) { record('viewer-inspection-exception', false, { message: error.message, stack: error.stack }); await screenshot(page, ship.id + '-exception', report).catch(() => {}); await page.evaluate(() => window.__enemyGallery.closeViewer()).catch(() => {}); }
      process.stdout.write(JSON.stringify({ inspected: ship.id, failed: report.checks.filter(check => check.section === ship.id && !check.passed).length }) + '\n');
    }
    section = 'network';
    record('zero-external-requests', report.externalRequests.length === 0);
    record('zero-page-errors', report.pageErrors.length === 0);
    record('zero-console-errors', report.consoleErrors.length === 0);
    record('zero-http-errors', report.httpErrors.length === 0);
    record('zero-failed-requests', report.failedRequests.length === 0, { ignoredLocalNavigationAborts: report.navigationAborts.length });
  } catch (error) { record('fatal-exception', false, { message: error.message, stack: error.stack }); }
  finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise(resolve => server.close(resolve));
    report.completedAt = new Date().toISOString();
    report.summary = { total: report.checks.length, passed: report.checks.filter(check => check.passed).length, failed: report.checks.filter(check => !check.passed).length };
    report.passed = report.checks.length > 0 && report.summary.failed === 0;
    const text = JSON.stringify(report, null, 2) + '\n';
    fs.writeFileSync(path.join(work, 'verification.json'), text);
    fs.writeFileSync(path.join(out, 'verification.json'), text);
  }
  process.stdout.write(JSON.stringify({ passed: report.passed, ...report.summary, report: 'outputs/enemy-fleet-gallery-v1/verification.json' }) + '\n');
  return report;
}

if (require.main === module) {
  if (process.argv.includes('--help')) process.stdout.write('node tools/enemy-fleet-gallery/qa.cjs\nChecks all 26 catalog assets, gallery controls, two embedded 3D viewers, six 120-frame pixel regressions, mobile overflow and network errors.\nReports: work/verification/enemy-fleet-gallery and outputs/enemy-fleet-gallery-v1/verification.json\n');
  else run().then(report => { if (!report.passed) process.exitCode = 1; }).catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
}
module.exports = { run };
