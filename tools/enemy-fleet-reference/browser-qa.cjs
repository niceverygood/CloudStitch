'use strict';

// Prepared for the integration owner's reserved Chrome slot. --help and
// node --check do not launch Chrome or write any verification artifacts.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'outputs/enemy-fleet-reference-v1');
const work = path.join(root, 'work/enemy-fleet-reference-browser-qa');
const STANDARD_CLIPS = ['FloatIdle', 'Cruise', 'BankTurn', 'GustRecovery', 'TurretScan', 'WinchCycle', 'FireBurst'];
const MODES = ['handdrawn', 'cel', 'original'];
const DESKTOP = { width: 1280, height: 1000 };
const MOBILE = { width: 390, height: 844 };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function help() {
  return [
    'Cloudstitch reference enemy fleet browser QA — single Chrome page',
    '',
    'node tools/enemy-fleet-reference/browser-qa.cjs',
    'node tools/enemy-fleet-reference/browser-qa.cjs --ids=enemy-union-salvage,enemy-union-repair',
    'node tools/enemy-fleet-reference/browser-qa.cjs --gallery-only',
    'node tools/enemy-fleet-reference/browser-qa.cjs --ids=enemy-disguised-wreck --report=work/enemy-reference-subset.json',
    '',
    'Default report: outputs/enemy-fleet-reference-v1/browser-verification.json',
    'Screenshots, if captured: work/enemy-fleet-reference-browser-qa/ only.',
    'Uses existing tools/lib/runtime.cjs and NODE_PATH dependency resolution.',
    'Temporary HTTP server serves only outputs/enemy-fleet-reference-v1.',
    'Default: six direct viewer inspections plus the six-card gallery.',
    'Partial --ids only limits direct viewer inspections; gallery still has six',
    'cards and all six modal GLB loads. --gallery-only skips direct viewer tests.',
    '',
    'Checks loading, modes, standard 7 clips / wreck 8th deployment clip,',
    'weakpoint label on/off, three deployment-bone deltas/restoration, views,',
    'fit/reset/rotate/zoom, mobile width and one live gallery iframe at most.',
    'No precise rotating-frame ghosting, decoded-pixel comparison, long-run',
    'performance, combat or art approval. Root captures render quality separately.',
    'Estimated run: 2–4 minutes; cold software shader compilation can take longer.',
  ].join('\n');
}

function parseArgs(args) {
  const options = { help: false, ids: null, galleryOnly: false, report: path.join(out, 'browser-verification.json') };
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--gallery-only') options.galleryOnly = true;
    else if (arg.startsWith('--ids=')) {
      options.ids = arg.slice(6).split(',').filter(Boolean);
      if (!options.ids.length || options.ids.length !== new Set(options.ids).size) throw new Error('--ids must be a nonempty unique comma-separated list.');
    } else if (arg.startsWith('--report=')) {
      if (!arg.slice(9)) throw new Error('--report requires a path.');
      options.report = path.resolve(root, arg.slice(9));
    } else throw new Error('Unknown option: ' + arg);
  }
  if (options.galleryOnly && options.ids) throw new Error('--gallery-only and --ids cannot be combined.');
  return options;
}

async function serve() {
  const allowed = fs.realpathSync(out);
  const within = file => { const relative = path.relative(allowed, file); return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
  const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.glb': 'model/gltf-binary' };
  const server = http.createServer((request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const file = path.resolve(root, '.' + pathname);
      if (!within(file)) { response.writeHead(403).end(); return; }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
      if (!within(fs.realpathSync(file))) { response.writeHead(403).end(); return; }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size, 'Cache-Control': 'no-store' });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
    } catch { response.writeHead(400).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, origin: 'http://127.0.0.1:' + server.address().port };
}

async function frames(target, count = 3) {
  await target.evaluate(count => new Promise(resolve => { let remaining = count; const tick = () => { if (--remaining <= 0) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }), count);
}

async function rigReady(target, enhancement = true) {
  await target.waitForFunction(enhancement => Boolean(window.__rigStats?.error) || window.__rigReady === true && (!enhancement || window.__enemyReference?.ready === true), enhancement, { timeout: 60000 });
  const error = await target.evaluate(() => window.__rigStats?.error);
  if (error) throw new Error(error);
}

async function state(target) {
  return target.evaluate(() => {
    const v = window.__rigViewer, s = window.__rigStats;
    return {
      ...s, assetId: v.rig.userData.assetId, renderCalls: v.renderer.info.render.calls,
      clipNames: v.clips.map(clip => clip.name), autoClearActual: v.outlineEffect.autoClear,
      camera: v.camera.position.toArray(), quaternion: v.camera.quaternion.toArray(), zoom: v.camera.zoom,
      projection: v.camera.projectionMatrix.elements.slice(), canvasSize: [v.renderer.domElement.width, v.renderer.domElement.height],
      enhancementReady: window.__enemyReference?.ready === true,
      weakpoints: window.__enemyReference?.points || [], weakpointsVisible: window.__enemyReference?.weakpointsVisible,
      deployed: window.__enemyReference?.deployed,
    };
  });
}

async function width(target) {
  return target.evaluate(() => {
    const canvas = document.querySelector('#stage canvas')?.getBoundingClientRect();
    const rect = canvas ? { left: canvas.left, right: canvas.right, width: canvas.width } : null;
    return { viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, canvas: rect, passed: document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1 && (!rect || rect.left >= -1 && rect.right <= innerWidth + 1) };
  });
}

async function screenshot(page, name) {
  fs.mkdirSync(work, { recursive: true });
  const file = path.join(work, name + '.png');
  await page.screenshot({ path: file, fullPage: true });
  return path.relative(root, file).split(path.sep).join('/');
}

async function inspectViewer(page, ship, url, record) {
  await page.setViewportSize(DESKTOP);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await rigReady(page);
  await page.evaluate(() => { const v = window.__rigViewer; v.setPlaying(false); v.controls.enableDamping = false; v.setComparison(false); v.setSilhouette(false); v.reset(); });
  await frames(page);
  let current = await state(page);
  const expectedClips = [...STANDARD_CLIPS, ...(ship.id === 'enemy-disguised-wreck' ? ['AmbushReveal'] : [])];
  record('actual-embedded-glb-load', current.ready === true && current.assetId === ship.id && current.sourceBytes === fs.statSync(path.join(out, ship.assetPath)).size && current.meshCount > 0 && current.triangleCount > 0 && current.texturesReady === true && current.renderCalls > 0, { id: current.assetId, bytes: current.sourceBytes, meshes: current.meshCount, triangles: current.triangleCount, texturesReady: current.texturesReady });
  record('outline-autoclear', current.autoClearActual === true && current.outlineAutoClear === true);
  record('actual-clip-set', current.clipNames.length === expectedClips.length && expectedClips.every(name => current.clipNames.includes(name)), { observed: current.clipNames, expected: expectedClips, note: 'Uses actual GLB clips; catalog metrics may describe the seven standard clips only.' });
  for (const mode of MODES) {
    await page.locator('[data-mode="' + mode + '"]').click(); await frames(page);
    current = await state(page);
    record('mode:' + mode, current.mode === mode && current.renderCalls > 0 && current.autoClearActual === true && await page.locator('[data-mode="' + mode + '"]').getAttribute('aria-pressed') === 'true');
  }
  for (const name of STANDARD_CLIPS) {
    const sampled = await page.evaluate(name => {
      const v = window.__rigViewer, clip = v.clips.find(clip => clip.name === name);
      const accepted = v.setProfile(name), time = Math.min(1.17, (clip?.duration || 0) * .37);
      v.setTime(time);
      let invalidTransforms = 0;
      v.rig.traverse(node => { if (![...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()].every(Number.isFinite)) invalidTransforms++; });
      return { accepted, duration: clip?.duration, time, observedTime: window.__rigStats.time, playing: window.__rigStats.playing, profile: window.__rigStats.currentProfile, invalidTransforms };
    }, name);
    await frames(page, 2);
    record('clip-time:' + name, sampled.accepted === true && sampled.duration > 0 && sampled.profile === name && Math.abs(sampled.time - sampled.observedTime) < .001 && sampled.playing === false && sampled.invalidTransforms === 0, sampled);
    const enabled = await page.locator('[data-profile="' + name + '"]').isEnabled();
    const expectedEnabled = !Array.isArray(current.availableActions) || current.availableActions.includes(name);
    record('clip-button-availability:' + name, enabled === expectedEnabled, { enabled, expectedEnabled, note: 'Embedded neutral clips do not imply that every device action must be enabled.' });
  }
  await page.evaluate(() => { const v = window.__rigViewer; v.setProfile('FloatIdle'); v.setTime(0); });
  await page.locator('#play').click(); await frames(page, 6); await page.locator('#play').click();
  current = await state(page);
  record('playback-and-pause', current.time > 0 && current.playing === false, { time: current.time });

  const expectedPoints = ship.weakpoints || [];
  const targetNames = await page.evaluate(() => {
    const v = window.__rigViewer;
    return (v.rig.userData.weakpoints || []).map(point => ({ nodeName: point.nodeName, present: Boolean(v.rig.getObjectByName(point.nodeName)) }));
  });
  record('all-weakpoint-targets-resolve', current.enhancementReady && current.weakpoints.length === expectedPoints.length && expectedPoints.length > 0 && targetNames.length === expectedPoints.length && targetNames.every(point => point.present), targetNames);
  await page.locator('#weakpoints').check(); await frames(page, 4);
  let labels = await page.locator('.weakpoint-label').evaluateAll(labels => labels.map(label => ({ text: label.textContent, hidden: label.hidden, display: getComputedStyle(label).display, left: Number.parseFloat(label.style.left), top: Number.parseFloat(label.style.top) })));
  record('weakpoint-labels-on', (await state(page)).weakpointsVisible === true && labels.length === expectedPoints.length && labels.every(label => !label.hidden && label.display !== 'none' && Number.isFinite(label.left) && Number.isFinite(label.top)), labels);
  await page.locator('#weakpoints').uncheck(); await frames(page, 3);
  labels = await page.locator('.weakpoint-label').evaluateAll(labels => labels.map(label => ({ text: label.textContent, hidden: label.hidden, display: getComputedStyle(label).display })));
  record('weakpoint-labels-off-after-on', (await state(page)).weakpointsVisible === false && labels.every(label => label.hidden && label.display === 'none'), labels);

  const deployment = ship.id === 'enemy-disguised-wreck';
  if (deployment) {
    const readBones = () => page.evaluate(() => {
      const v = window.__rigViewer;
      return (v.rig.userData.deployRig?.nodeNames || []).map(name => { const node = v.rig.getObjectByName(name); return { name, present: Boolean(node), position: node?.position.toArray(), quaternion: node?.quaternion.toArray() }; });
    });
    await page.locator('[data-deploy="false"]').click(); await frames(page, 3);
    const closed = await readBones();
    await page.locator('[data-deploy="true"]').click(); await frames(page, 3);
    const opened = await readBones();
    const deltas = opened.map((node, index) => {
      const from = closed[index]?.quaternion, to = node.quaternion;
      const dot = from && to ? Math.min(1, Math.abs(to.reduce((sum, value, i) => sum + value * from[i], 0))) : 1;
      return { name: node.name, radians: 2 * Math.acos(dot) };
    });
    current = await state(page);
    record('three-deployment-bones-open', closed.length === 3 && opened.length === 3 && opened.every(node => node.present) && deltas.every(delta => delta.radians > .15) && current.deployed === true && current.currentProfile === 'AmbushReveal' && current.playing === false, { deltas, time: current.time });
    await page.locator('[data-deploy="false"]').click(); await frames(page, 3);
    const restored = await readBones();
    const restoration = restored.map((node, index) => ({ name: node.name, maxDifference: Math.max(...[...(node.quaternion || []), ...(node.position || [])].map((value, i) => Math.abs(value - [...(closed[index]?.quaternion || []), ...(closed[index]?.position || [])][i]))) }));
    current = await state(page);
    record('deployment-returns-to-closed-pose', restored.length === 3 && restoration.every(row => Number.isFinite(row.maxDifference) && row.maxDifference < .00001) && current.deployed === false && Math.abs(current.time) < .001, restoration);
  } else record('no-deployment-controls-on-other-ships', await page.locator('[data-deploy]').count() === 0);

  for (const view of ['front', 'side', 'top', 'perspective']) {
    await page.locator('[data-view="' + view + '"]').click(); await frames(page, 2);
    current = await state(page);
    record('view:' + view, current.view === view && [...current.camera, ...current.quaternion, ...current.projection].every(Number.isFinite) && current.renderCalls > 0);
  }
  await page.locator('#compare-size').check(); await frames(page, 3);
  current = await state(page);
  record('hero-size-reference', current.comparisonEnabled === true && current.comparisonReferenceReady === true && current.comparisonBounds?.min.every(Number.isFinite) && current.comparisonBounds?.max.every(Number.isFinite));
  await page.locator('#compare-size').uncheck();
  await page.locator('#silhouette').check(); record('silhouette-on', (await state(page)).silhouette === true);
  await page.locator('#silhouette').uncheck(); record('silhouette-off', (await state(page)).silhouette === false);
  await page.locator('#outline').uncheck(); record('outline-off', (await state(page)).outlineEnabled === false);
  await page.locator('#outline').check(); record('outline-on', (await state(page)).outlineEnabled === true);

  await page.locator('#reset').click(); await frames(page, 2);
  const cameraBefore = (await state(page)).camera;
  const canvas = page.locator('#stage canvas'); await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox(); if (!bounds) throw new Error('Canvas has no pointer bounds.');
  const x = bounds.x + bounds.width * .5, y = bounds.y + bounds.height * .5;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 80, y + 24, { steps: 5 }); await page.mouse.up(); await frames(page, 3);
  record('pointer-orbit', (await state(page)).camera.some((value, index) => Math.abs(value - cameraBefore[index]) > .001));
  await page.mouse.wheel(0, -180); await frames(page, 3);
  record('wheel-zoom', Math.abs((await state(page)).zoom - 1) > .001);
  await page.locator('#fit').click(); record('fit-resets-zoom', Math.abs((await state(page)).zoom - 1) < .001);
  await page.locator('#rotate').click(); const beforeRotate = (await state(page)).camera; await frames(page, 6);
  current = await state(page);
  record('auto-rotate', current.autoRotate === true && current.camera.some((value, index) => Math.abs(value - beforeRotate[index]) > .00001));
  await page.locator('#reset').click(); current = await state(page);
  record('reset', current.autoRotate === false && current.view === 'perspective' && Math.abs(current.zoom - 1) < .001);
  await page.setViewportSize(MOBILE); await frames(page, 4);
  const mobile = await width(page); record('mobile-390-maximum-width', mobile.passed, mobile);
  await page.setViewportSize(DESKTOP);
}

async function modalReady(page) {
  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe[data-enemy-reference-viewer]');
    return Boolean(frame?.contentWindow?.__rigStats?.error) || frame?.contentWindow?.__rigReady === true && frame?.contentWindow?.__enemyReference?.ready === true;
  }, null, { timeout: 60000 });
  const handle = await page.locator('iframe[data-enemy-reference-viewer]').elementHandle();
  const frame = await handle.contentFrame(); if (!frame) throw new Error('Gallery viewer iframe disappeared.');
  await rigReady(frame);
  await frame.evaluate(() => window.__rigViewer.setPlaying(false));
  return state(frame);
}

async function inspectGallery(page, url, record, report) {
  await page.setViewportSize(DESKTOP);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__enemyReferenceGallery), null, { timeout: 30000 });
  const ships = await page.evaluate(() => window.__enemyReferenceGallery.data.ships);
  record('six-unique-cards', ships.length === 6 && new Set(ships.map(ship => ship.id)).size === 6 && await page.locator('[data-asset-id]').count() === 6);
  record('initial-zero-iframes', await page.locator('iframe[data-enemy-reference-viewer]').count() === 0);
  const images = await page.evaluate(async () => {
    const rows = [];
    for (const ship of window.__enemyReferenceGallery.data.ships) {
      const image = document.querySelector('[data-asset-id="' + ship.id + '"] .picture img');
      if (!image) { rows.push({ id: ship.id, passed: false, reason: 'No fresh preview image element.' }); continue; }
      try { await image.decode(); rows.push({ id: ship.id, passed: image.naturalWidth > 0 && image.naturalHeight > 0 && image.src === new URL(ship.previewPath, location.href).href, width: image.naturalWidth, height: image.naturalHeight }); }
      catch (error) { rows.push({ id: ship.id, passed: false, reason: String(error.message || error) }); }
    }
    const reference = document.querySelector('#reference-crop img');
    try { await reference.decode(); rows.push({ id: 'reference-sheet', passed: reference.naturalWidth > 0 && reference.naturalHeight > 0, width: reference.naturalWidth, height: reference.naturalHeight }); }
    catch (error) { rows.push({ id: 'reference-sheet', passed: false, reason: String(error.message || error) }); }
    return rows;
  });
  record('six-preview-images-plus-reference-decode', images.length === 7 && images.every(image => image.passed), images);
  await page.evaluate(() => {
    window.__qaMaximumReferenceViewers = 0;
    const observe = () => { window.__qaMaximumReferenceViewers = Math.max(window.__qaMaximumReferenceViewers, document.querySelectorAll('iframe[data-enemy-reference-viewer]').length); };
    new MutationObserver(observe).observe(document.body, { childList: true, subtree: true }); observe();
  });
  for (const ship of ships) {
    await page.locator('[data-compare="' + ship.id + '"]').click();
    const selection = await page.evaluate(() => {
      const gallery = window.__enemyReferenceGallery, ship = gallery.data.ships.find(ship => ship.id === gallery.selected), reference = document.querySelector('#reference-crop img'), result = document.querySelector('#result-picture img');
      return { id: gallery.selected, left: reference.style.left, top: reference.style.top, result: result?.src, expected: ship ? new URL(ship.previewPath, location.href).href : null };
    });
    record('compare-selection:' + ship.id, selection.id === ship.id && selection.left === -(ship.index % 3) * 100 + '%' && selection.top === -Math.floor(ship.index / 3) * 100 + '%' && selection.result === selection.expected, selection);
    await page.locator('#open-selected').click(); const loaded = await modalReady(page);
    record('modal-load:' + ship.id, loaded.ready === true && loaded.assetId === ship.id && loaded.renderCalls > 0 && await page.locator('iframe[data-enemy-reference-viewer]').count() === 1);
    await page.locator('#close-viewer').click();
    record('modal-close:' + ship.id, await page.locator('iframe[data-enemy-reference-viewer]').count() === 0 && await page.locator('#viewer-dialog').evaluate(dialog => !dialog.open));
  }
  if (ships.length >= 2) {
    await page.locator('[data-open="' + ships[0].id + '"]').click(); await modalReady(page);
    await page.evaluate(id => window.__enemyReferenceGallery.open(id), ships[1].id); const replaced = await modalReady(page);
    record('api-replaces-one-existing-viewer', replaced.assetId === ships[1].id && await page.locator('iframe[data-enemy-reference-viewer]').count() === 1);
    await page.keyboard.press('Escape'); record('escape-removes-viewer', await page.locator('iframe[data-enemy-reference-viewer]').count() === 0);
  }
  record('maximum-one-concurrent-iframe', await page.evaluate(() => window.__qaMaximumReferenceViewers <= 1), { maximum: await page.evaluate(() => window.__qaMaximumReferenceViewers) });
  await page.evaluate(() => scrollTo(0, 0)); await frames(page, 3);
  report.screenshots.push(await screenshot(page, 'gallery-desktop'));
  const desktop = await width(page); record('desktop-maximum-width', desktop.passed, desktop);
  await page.setViewportSize(MOBILE); await frames(page, 4);
  const mobile = await width(page); record('gallery-mobile-390-maximum-width', mobile.passed, mobile);
  report.screenshots.push(await screenshot(page, 'gallery-mobile'));
}

async function run(options) {
  const catalogFile = path.join(out, 'catalog.json'), catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const all = catalog.ships.filter(ship => ship.status === 'asset-built');
  const ids = options.ids || all.map(ship => ship.id);
  if (ids.some(id => !all.some(ship => ship.id === id))) throw new Error('Unknown or unbuilt --ids selection.');
  const selected = options.galleryOnly ? [] : ids.map(id => all.find(ship => ship.id === id));
  const report = {
    version: 'enemy-reference-browser-qa-1.0.0', startedAt: new Date().toISOString(), passed: false,
    selection: { requestedIds: options.galleryOnly ? [] : ids, inspectedIds: [], directViewerCount: 0, fullSixDirectViewerInspection: false, galleryOnly: options.galleryOnly, galleryInspected: false, galleryAlwaysIncludesSixModalLoads: true },
    source: { catalogSha256: sha(fs.readFileSync(catalogFile)) }, browser: null,
    checks: [], screenshots: [], pageErrors: [], consoleErrors: [], externalRequests: [], failedRequests: [], localNavigationAborts: [], httpErrors: [],
    ghosting: { status: 'not-run', reason: 'This run checks loading/UI/rig controls. PNG encoded equality and tiny MSAA/camera changes are not a precise rotating-frame accumulation test. No ghosting pass is claimed.' },
    limits: ['Six newly authored models and presentation controls only; no existing frozen fleet artifacts are modified.', 'No combat/AI/weakpoint damage, collision/socket, long-run resource stability, performance or art-quality approval.', 'Chrome desktop and 390px mobile viewport only; no physical mobile device or other browser coverage.', 'Unavailable device buttons are valid even when the seven standard animation clips are embedded.', 'Static render quality is captured and reviewed separately by the integration owner.'],
  };
  let browser, context, server, page, section = 'startup';
  const record = (name, passed, detail) => report.checks.push({ section, name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
  try {
    const local = await serve(); server = local.server;
    const { launchBrowser } = require('../lib/runtime.cjs');
    browser = await launchBrowser({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
    context = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (!url.startsWith(local.origin + '/') && !/^(?:data|blob):/.test(url)) { report.externalRequests.push({ section, url }); await route.abort(); }
      else await route.continue();
    });
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.pageErrors.push({ section, message: error.message }));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ section, message: message.text() }); });
    page.on('response', response => { if (response.status() >= 400) report.httpErrors.push({ section, url: response.url(), status: response.status() }); });
    page.on('requestfailed', request => {
      const row = { section, url: request.url(), error: request.failure()?.errorText, navigation: request.isNavigationRequest() };
      if (row.url.startsWith(local.origin + '/') && row.error?.includes('ERR_ABORTED') && row.navigation) report.localNavigationAborts.push(row); else report.failedRequests.push(row);
    });
    const userAgent = await page.evaluate(() => navigator.userAgent);
    report.browser = { version: browser.version(), requestedChannel: 'chrome', userAgent, pageCount: 1, desktop: DESKTOP, mobile: MOBILE };
    record('chrome-not-edge', !/Edg\//.test(userAgent)); if (/Edg\//.test(userAgent)) throw new Error('Chrome-only QA refused an Edge fallback.');
    for (const ship of selected) {
      section = ship.id;
      try { await inspectViewer(page, ship, local.origin + '/outputs/enemy-fleet-reference-v1/' + ship.viewerPath, record); report.selection.inspectedIds.push(ship.id); }
      catch (error) { record('viewer-inspection-exception', false, { message: error.message, stack: error.stack }); try { report.screenshots.push(await screenshot(page, ship.id + '-exception')); } catch {} }
      process.stdout.write(JSON.stringify({ inspected: ship.id, failed: report.checks.filter(check => check.section === ship.id && !check.passed).length }) + '\n');
    }
    section = 'gallery';
    try { await inspectGallery(page, local.origin + '/outputs/enemy-fleet-reference-v1/index.html', record, report); report.selection.galleryInspected = true; }
    catch (error) { record('gallery-inspection-exception', false, { message: error.message, stack: error.stack }); try { report.screenshots.push(await screenshot(page, 'gallery-exception')); } catch {} }
    section = 'network';
    record('no-external-requests', report.externalRequests.length === 0);
    record('no-page-errors', report.pageErrors.length === 0);
    record('no-console-errors', report.consoleErrors.length === 0);
    record('no-http-errors', report.httpErrors.length === 0);
    record('no-failed-requests', report.failedRequests.length === 0, { ignoredLocalIframeNavigationAborts: report.localNavigationAborts.length });
  } catch (error) { record('fatal-exception', false, { message: error.message, stack: error.stack }); }
  finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise(resolve => server.close(resolve));
    report.selection.directViewerCount = report.selection.inspectedIds.length;
    report.selection.fullSixDirectViewerInspection = all.length === 6 && all.every(ship => report.selection.inspectedIds.includes(ship.id));
    report.completedAt = new Date().toISOString();
    report.summary = { checks: report.checks.length, passed: report.checks.filter(check => check.passed).length, failed: report.checks.filter(check => !check.passed).length };
    report.passed = report.checks.length > 0 && report.summary.failed === 0;
    fs.mkdirSync(path.dirname(options.report), { recursive: true }); fs.writeFileSync(options.report, JSON.stringify(report, null, 2) + '\n');
  }
  process.stdout.write(JSON.stringify({ report: path.relative(root, options.report).split(path.sep).join('/'), passed: report.passed, ...report.summary, fullSixDirectViewerInspection: report.selection.fullSixDirectViewerInspection, galleryInspected: report.selection.galleryInspected, preciseGhosting: report.ghosting.status }) + '\n');
  return report;
}

if (require.main === module) {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
  if (options?.help) process.stdout.write(help() + '\n');
  else if (options) run(options).then(report => { if (!report.passed) process.exitCode = 1; }).catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
}
module.exports = { help, parseArgs, run };
