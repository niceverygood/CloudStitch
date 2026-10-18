/* Verify actual offline world GLBs, their texture/vertex colors, and viewer controls.
 * CLI: node tools/qa/world-workbench.cjs [viewerHTML] [reportDir] [catalog] [IDs|all] [expectedCount]
 * IDs is an optional comma-separated partial selection. Omitted expectedCount uses
 * actual completed source files, so the same tool verifies partial, 96, or 7 views.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { repoRoot, repoPath, reportDirectory, launchBrowser } = require('../lib/runtime.cjs');
const htmlPath = repoPath(process.argv[2] || 'outputs/world-assets/index.html');
const reportDir = reportDirectory('world-workbench', process.argv[3]);
const catalogPath = repoPath(process.argv[4] || (/scenes\.html$/i.test(htmlPath) ? 'outputs/world-assets/scene-catalog.json' : 'outputs/world-assets/catalog.json'));
const filterIDs = process.argv[5] && process.argv[5] !== 'all' ? process.argv[5].split(',').map(value => value.trim()).filter(Boolean) : null;
const countArgument = process.argv[6] ? Number(process.argv[6]) : null;
const representatives = ['harbor-inn', 'dock-straight', 'island-grass-medium', 'world-map-table', 'jonghang-harbor', 'world-map-diorama'];
const modes = ['handdrawn', 'cel', 'original'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const assert = (value, message) => { if (!value) throw new Error(message); };
const relative = file => path.relative(repoRoot, file).split(path.sep).join('/');

async function frames(page, count = 3) {
  await page.evaluate(count => new Promise(resolve => { const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }), count);
}
async function select(page, id) {
  await page.evaluate(async id => { const w = window.__worldWorkbench; await w.selectAsset(id); w.setAutoRotate(false); w.setPlaying(false); w.reset(); w.controls.enableDamping = false; }, id);
  await page.waitForFunction(id => window.__worldReady && window.__worldStats.selectedId === id, id, { timeout: 60000 });
  for (const control of ['#bounds', '#axes']) if (await page.isChecked(control)) await page.uncheck(control);
  await frames(page, 3);
}
async function sample(page) {
  return page.evaluate(() => {
    const w = window.__worldWorkbench, source = w.renderer.domElement;
    w.root.updateMatrixWorld(true);
    let meshCount = 0, finite = true, vertexColorMeshes = 0;
    w.root.traverse(node => { if (!node.isMesh) return; meshCount++; finite = finite && node.matrixWorld.elements.every(Number.isFinite); if (node.geometry.getAttribute('color')) vertexColorMeshes++; });
    const c = document.createElement('canvas'); c.width = source.width; c.height = source.height;
    const context = c.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, c.width, c.height).data;
    let visiblePixels = 0, nonBlackPixels = 0, maxAlpha = 0;
    for (let index = 0; index < pixels.length; index += 4) { if (pixels[index + 3] > 0) { visiblePixels++; if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 0) nonBlackPixels++; } maxAlpha = Math.max(maxAlpha, pixels[index + 3]); }
    return { mode: window.__worldStats.mode, meshCount, vertexColorMeshes, finite, visiblePixels, nonBlackPixels, maxAlpha, pixelCount: pixels.length / 4, texturesReady: window.__worldStats.texturesReady };
  });
}
async function downloadBytes(page) {
  return page.evaluate(async () => {
    const link = document.getElementById('download'), response = await fetch(link.href), bytes = new Uint8Array(await response.arrayBuffer());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return { bytes: bytes.length, sha256: Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join(''), magic: Array.from(bytes.subarray(0, 4)), filename: link.download, urlType: link.href.split(':')[0] };
  });
}
async function ghosting(page, id, mode) {
  await select(page, id); await page.click(`[data-mode="${mode}"]`); await page.check('#outline'); await frames(page, 3);
  const result = await page.evaluate(async ({ id, mode }) => {
    const w = window.__worldWorkbench;
    w.controls.enableDamping = false; w.controls.autoRotateSpeed = 18; w.setPlaying(false);
    const frames = count => new Promise(resolve => { const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); });
    const capture = () => { const source = w.renderer.domElement, c = document.createElement('canvas'); c.width = source.width; c.height = source.height; const context = c.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0); return context.getImageData(0, 0, c.width, c.height).data; };
    w.setAutoRotate(true); await frames(120); w.setAutoRotate(false); await frames(4);
    const position = w.camera.position.toArray(), before = capture(); w.renderer.clear(true, true, true); await frames(3); const after = capture();
    let changedPixels = 0, totalChannelDifference = 0;
    for (let index = 0; index < before.length; index += 4) { let changed = false; for (let channel = 0; channel < 4; channel++) { const delta = Math.abs(before[index + channel] - after[index + channel]); totalChannelDifference += delta; if (delta) changed = true; } if (changed) changedPixels++; }
    const cameraDelta = Math.max(...position.map((value, index) => Math.abs(value - w.camera.position.toArray()[index])));
    return { id, mode, rotationFrames: 120, changedPixels, totalChannelDifference, cameraDelta, cameraUnchanged: cameraDelta < 1e-8, outlineAutoClear: w.effect.autoClear === true };
  }, { id, mode });
  return result;
}
async function controls(page, id) {
  await select(page, id); await page.click('[data-mode="handdrawn"]');
  const before = await page.evaluate(() => window.__worldWorkbench.camera.position.toArray());
  const stage = await page.locator('#stage').boundingBox(), center = { x: stage.x + stage.width * .5, y: stage.y + stage.height * .48 };
  await page.mouse.move(center.x, center.y); await page.mouse.down(); await page.mouse.move(center.x + 95, center.y + 30, { steps: 8 }); await page.mouse.up(); await frames(page, 3);
  const after = await page.evaluate(() => window.__worldWorkbench.camera.position.toArray());
  assert(before.some((value, index) => Math.abs(value - after[index]) > 1e-6), id + ': drag rotation failed');
  const oldZoom = await page.evaluate(() => window.__worldWorkbench.camera.zoom);
  await page.mouse.wheel(0, -160); await frames(page, 4);
  const newZoom = await page.evaluate(() => window.__worldWorkbench.camera.zoom);
  assert(Math.abs(newZoom - oldZoom) > 1e-6, id + ': wheel zoom failed');
  await page.click('#fit'); await frames(page, 2);
  assert(await page.evaluate(() => window.__worldWorkbench.camera.zoom === 1), id + ': fit did not reset zoom');
  const presetResults = [];
  for (const view of ['front', 'back', 'top', 'iso']) {
    await page.click(`[data-view="${view}"]`); await frames(page, 3);
    const preset = await page.evaluate(view => { const w = window.__worldWorkbench, vector = w.camera.position.clone().sub(w.controls.target).normalize(); return { view, actual: window.__worldStats.view, direction: vector.toArray(), finite: w.camera.projectionMatrix.elements.every(Number.isFinite) }; }, view);
    assert(preset.actual === view && preset.finite, id + ': invalid view ' + view);
    if (view === 'front') assert(preset.direction[2] > .99, 'Front view is not +Z');
    if (view === 'back') assert(preset.direction[2] < -.99, 'Back view is not -Z');
    if (view === 'top') assert(preset.direction[1] > .999, 'Top view is not +Y');
    presetResults.push(preset);
  }
  await page.click('#rotate'); await frames(page, 8);
  assert(await page.evaluate(() => window.__worldStats.autoRotate === true), 'Auto rotation did not start');
  await page.click('#reset'); await frames(page, 3);
  assert(await page.evaluate(() => window.__worldStats.autoRotate === false && window.__worldStats.view === 'iso'), 'Reset did not restore iso and stop rotation');
  await page.uncheck('#outline'); assert(await page.evaluate(() => window.__worldStats.outlineEnabled === false), 'Outline did not disable');
  await page.check('#outline'); await page.locator('#thickness').fill('2'); await page.locator('#thickness').dispatchEvent('input');
  assert(await page.evaluate(() => window.__worldStats.outlineEnabled === true && window.__worldStats.outlinePixels === 2), 'Outline thickness input failed');
  await page.locator('#thickness').fill('1.1'); await page.locator('#thickness').dispatchEvent('input');
  for (const flag of ['bounds', 'axes']) { await page.check('#' + flag); assert(await page.evaluate(flag => window.__worldStats[flag + 'Visible'] === true, flag), flag + ' did not enable'); await page.uncheck('#' + flag); }
  await page.click('#background'); assert(await page.evaluate(() => window.__worldStats.background === 'deepteal'), 'Deep teal background failed');
  await page.click('#background'); assert(await page.evaluate(() => window.__worldStats.background === 'cream'), 'Cream background failed');
  return { id, rotation: true, oldZoom, newZoom, fit: true, views: presetResults, reset: true, autoRotate: true, outlineThickness: true, bounds: true, axes: true, backgrounds: ['deepteal', 'cream'] };
}
async function filters(page, available) {
  const category = available[0].category;
  const expected = available.filter(item => item.category === category).map(item => item.id);
  await page.selectOption('#category-filter', category);
  await page.waitForFunction(() => window.__worldReady); await frames(page, 3);
  const actual = await page.locator('#asset-select option:not([disabled])').evaluateAll(options => options.map(option => option.value));
  assert(actual.length === expected.length && actual.every(id => expected.includes(id)), 'Category filter did not preserve actual available assets');
  await page.selectOption('#category-filter', 'all');
  const query = available[0].id;
  await page.fill('#search', query);
  await page.waitForFunction(query => { const options = [...document.querySelectorAll('#asset-select option:not([disabled])')]; return options.length > 0 && options.every(option => option.value.includes(query)); }, query, { timeout: 10000 });
  const searched = await page.locator('#asset-select option:not([disabled])').count();
  assert(searched > 0, 'Search returned no matching asset');
  await page.fill('#search', 'cloudstitch-no-such-asset-qa');
  await page.waitForFunction(() => document.getElementById('asset-select').disabled && !window.__worldWorkbench.root.visible, null, { timeout: 10000 });
  await page.fill('#search', '');
  await page.waitForFunction(count => document.querySelectorAll('#asset-select option:not([disabled])').length === count && window.__worldWorkbench.root.visible, available.length, { timeout: 10000 });
  return { category, categoryChoices: actual.length, search: query, searchChoices: searched, noMatchHidesModel: true, restoredChoices: available.length };
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8').replace(/^\uFEFF/, ''));
  assert(Array.isArray(catalog.items), 'Catalog has no items');
  const sources = new Map(catalog.items.map(item => [item.id, item]));
  const actualSources = catalog.items.filter(item => item.model && fs.existsSync(path.resolve(path.dirname(catalogPath), item.model)) && !['pending', 'generating', 'failed'].includes(item.status));
  const browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  const errors = [], consoleErrors = [], failedRequests = [], requests = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', request => requests.push(request.url())); page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  const report = { viewer: relative(htmlPath), catalog: relative(catalogPath), partialIDs: filterIDs, expectedCount: countArgument ?? actualSources.length, models: [], ghosting: [], controls: [], errors, consoleErrors, failedRequests, passed: false };
  try {
    await page.goto(pathToFileURL(htmlPath).href);
    await page.waitForFunction(() => window.__worldReady || window.__worldStats?.error, null, { timeout: 90000 });
    assert(await page.evaluate(() => window.__worldReady), 'Workbench did not become ready: ' + JSON.stringify(await page.evaluate(() => window.__worldStats)));
    const available = await page.evaluate(() => window.__worldWorkbench.availableItems);
    assert(available.length === report.expectedCount, `Expected ${report.expectedCount} actual available models, found ${available.length}`);
    const items = filterIDs ? available.filter(item => filterIDs.includes(item.id)) : available;
    assert(items.length > 0 && (!filterIDs || items.length === new Set(filterIDs).size), 'Some requested partial IDs are unavailable');
    report.availableCount = available.length;
    for (const item of items) {
      assert(sources.has(item.id), 'Embedded model absent from source catalog: ' + item.id);
      await select(page, item.id);
      const initial = await page.evaluate(() => ({ ...window.__worldStats, models: undefined }));
      assert(initial.ready && initial.meshCount > 0 && initial.triangleCount > 0 && initial.texturesReady, item.id + ': empty geometry or texture not ready');
      assert(Number.isInteger(initial.animationClipCount) && initial.animationClipCount >= 0, item.id + ': invalid clip count');
      if (initial.animationClipCount === 0) { assert(await page.isDisabled('#animation-toggle'), item.id + ': static GLB has enabled fake animation'); assert((await page.locator('#animation-info').textContent()).includes('애니메이션 없음'), item.id + ': static GLB is not described honestly'); }
      const modeSamples = [];
      for (const mode of modes) {
        await page.click(`[data-mode="${mode}"]`); await frames(page, 3); const result = await sample(page);
        assert(result.mode === mode && result.finite && result.meshCount === initial.meshCount && result.visiblePixels > 0 && result.nonBlackPixels > 0 && result.texturesReady, item.id + ': invalid actual render in ' + mode);
        modeSamples.push(result);
      }
      const source = fs.readFileSync(path.resolve(path.dirname(catalogPath), sources.get(item.id).model));
      const expected = { bytes: source.length, sha256: hash(source) }, delivered = await downloadBytes(page);
      assert(delivered.bytes === expected.bytes && delivered.sha256 === expected.sha256 && delivered.bytes === initial.sourceBytes && delivered.magic.join(',') === '103,108,84,70' && delivered.filename === item.id + '.glb' && delivered.urlType === 'blob', item.id + ': source/download GLB mismatch');
      report.models.push({ id: item.id, stats: initial, samples: modeSamples, source: expected, download: delivered });
      console.log(JSON.stringify({ id: item.id, meshes: initial.meshCount, triangles: initial.triangleCount, clips: initial.animationClipCount, modeVisiblePixels: modeSamples.map(value => value.visiblePixels), downloadMatches: true }));
    }
    const selectedRepresentatives = representatives.filter(id => items.some(item => item.id === id));
    if (!selectedRepresentatives.length) selectedRepresentatives.push(items[0].id);
    for (const id of selectedRepresentatives) {
      report.controls.push(await controls(page, id));
      for (const mode of modes) { const result = await ghosting(page, id, mode); report.ghosting.push(result); assert(result.changedPixels === 0 && result.totalChannelDifference === 0 && result.cameraUnchanged && result.outlineAutoClear, id + ': ghosting regression in ' + mode); }
      await page.screenshot({ path: path.join(reportDir, 'qa-' + id + '.png'), fullPage: true });
    }
    report.filters = await filters(page, available);
    await select(page, items[0].id);
    const buttonDownloadPromise = page.waitForEvent('download'); await page.click('#download'); const buttonDownload = await buttonDownloadPromise;
    const downloadPath = await buttonDownload.path(); assert(downloadPath, 'Download button returned no actual file'); const buttonBytes = fs.readFileSync(downloadPath);
    const expectedButton = report.models.find(item => item.id === items[0].id).source;
    assert(buttonBytes.length === expectedButton.bytes && hash(buttonBytes) === expectedButton.sha256, 'User-facing button download differs from source');
    report.buttonDownload = { id: items[0].id, filename: buttonDownload.suggestedFilename(), bytes: buttonBytes.length, sha256: hash(buttonBytes), matchesSource: true };
    await page.setViewportSize({ width: 390, height: 844 }); await frames(page, 6);
    report.mobile = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, canvasWidth: document.querySelector('#stage canvas').getBoundingClientRect().width, finiteProjection: window.__worldWorkbench.camera.projectionMatrix.elements.every(Number.isFinite) }));
    assert(!report.mobile.overflow && report.mobile.canvasWidth > 0 && report.mobile.finiteProjection, 'Mobile overflow or invalid canvas');
    await page.screenshot({ path: path.join(reportDir, 'qa-mobile.png'), fullPage: true });
    report.externalRequests = requests.filter(url => /^https?:/i.test(url));
    assert(!errors.length && !consoleErrors.length && !failedRequests.length && !report.externalRequests.length, 'Browser emitted an error or external/failed request');
    report.passed = true;
  } catch (error) {
    report.failure = error.message; report.externalRequests = requests.filter(url => /^https?:/i.test(url));
    await page.screenshot({ path: path.join(reportDir, 'qa-failure.png'), fullPage: true }).catch(() => {}); process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(reportDir, 'qa-result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, available: report.availableCount, models: report.models.length, ghosting: report.ghosting.map(value => ({ id: value.id, mode: value.mode, changedPixels: value.changedPixels })), errors, consoleErrors, externalRequests: report.externalRequests, mobile: report.mobile, failure: report.failure }, null, 2));
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
