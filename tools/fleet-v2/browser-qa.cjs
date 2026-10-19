'use strict';

// Prepared for the integration owner's reserved Chrome QA run. Merely requiring
// this module or using --help neither launches a browser nor writes a report.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'outputs/fleet-v2');
const CLIPS = ['FloatIdle', 'Cruise', 'BankTurn', 'GustRecovery', 'TurretScan', 'WinchCycle', 'FireBurst'];
const MODES = ['handdrawn', 'cel', 'original'];
const DESKTOP = { width: 1280, height: 1000 };
const MOBILE = { width: 390, height: 844 };
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function usage() {
  return [
    'Cloudstitch fleet v2 sequential Chrome browser QA',
    '',
    'node tools/fleet-v2/browser-qa.cjs',
    'node tools/fleet-v2/browser-qa.cjs --ids=player-homeward,boss-bell-devourer',
    'node tools/fleet-v2/browser-qa.cjs --ids=player-homeward --report=work/fleet-v2/browser-subset.json',
    '',
    'Default selection: profiles.mjs SHOWCASE_IDS (13 representative entries).',
    'Default report: outputs/fleet-v2/verification-browser.json',
    'One Chrome browser and one page, sequentially; local temporary HTTP server.',
    'Uses existing tools/lib/runtime.cjs and installed dependencies. No installs.',
    'Tests actual embedded GLB rendering, UI/API, gallery and mobile overflow.',
    'Repeated paused PNG byte equality is supplementary evidence, not decoded',
    'pixel comparison or a rotating-frame ghosting/performance/art-quality test.',
    'Partial IDs remain a partial model inspection; gallery checks still cover',
    'the 13/62 listing and load its initially selected model plus one chosen card.',
  ].join('\n');
}

function parseArgs(args) {
  const options = { help: false, ids: null, report: path.join(out, 'verification-browser.json') };
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--ids=')) {
      options.ids = arg.slice(6).split(',').filter(Boolean);
      if (!options.ids.length || new Set(options.ids).size !== options.ids.length) throw new Error('--ids must be a nonempty unique comma-separated list.');
    } else if (arg.startsWith('--report=')) {
      if (!arg.slice(9)) throw new Error('--report requires a path.');
      options.report = path.resolve(root, arg.slice(9));
    } else throw new Error('Unknown option: ' + arg);
  }
  return options;
}

async function localServer() {
  const contentTypes = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.glb': 'model/gltf-binary', '.js': 'text/javascript; charset=utf-8' };
  const allowedRoots = ['outputs/fleet-v1', 'outputs/fleet-v2'].map(directory => fs.realpathSync(path.join(root, directory)));
  const within = (base, file) => {
    const relative = path.relative(base, file);
    return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
  };
  const server = http.createServer((request, response) => {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const file = path.resolve(root, '.' + pathname);
      const relative = path.relative(root, file);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) { response.writeHead(403).end(); return; }
      if (!allowedRoots.some(base => within(base, file))) { response.writeHead(403).end(); return; }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
      if (!allowedRoots.some(base => within(base, fs.realpathSync(file)))) { response.writeHead(403).end(); return; }
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size, 'Cache-Control': 'no-store' });
      if (request.method === 'HEAD') { response.end(); return; }
      fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
    } catch { response.writeHead(400).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, origin: 'http://127.0.0.1:' + server.address().port };
}

async function frames(target, count = 3) {
  await target.evaluate(count => new Promise(resolve => {
    let remaining = count;
    const next = () => { if (--remaining <= 0) resolve(); else requestAnimationFrame(next); };
    requestAnimationFrame(next);
  }), count);
}

async function rigReady(target) {
  await target.waitForFunction(() => window.__rigReady === true || Boolean(window.__rigStats?.error), null, { timeout: 60000 });
  const error = await target.evaluate(() => window.__rigStats?.error);
  if (error) throw new Error(error);
}

async function rigState(target) {
  return target.evaluate(() => {
    const v = window.__rigViewer, s = window.__rigStats;
    const pose = [];
    let meshes = 0, nonfinite = 0;
    const materialTypes = new Set();
    v.rig.traverse(object => {
      if (object.isMesh) {
        meshes++;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materialTypes.add(material.type);
      }
      if (object.isBone) pose.push(...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray());
      if (![...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()].every(Number.isFinite)) nonfinite++;
    });
    return {
      ...s, assetId: v.rig.userData.assetId, meshes, nonfinite, pose,
      renderCalls: v.renderer.info.render.calls, materialTypes: [...materialTypes],
      autoClearActual: v.outlineEffect.autoClear,
      camera: v.camera.position.toArray(), zoom: v.camera.zoom,
      referenceVisible: v.scene.getObjectByName('Original Homeward / relative size reference')?.visible === true,
      canvasSize: [v.renderer.domElement.width, v.renderer.domElement.height],
    };
  });
}

async function overflow(target) {
  return target.evaluate(() => {
    const viewport = window.innerWidth;
    const stage = document.getElementById('stage');
    const canvas = stage?.querySelector('canvas');
    const bounds = canvas?.getBoundingClientRect();
    return {
      viewport, documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      canvas: bounds ? { left: bounds.left, right: bounds.right, width: bounds.width } : null,
      passed: document.documentElement.scrollWidth <= viewport + 1 && document.body.scrollWidth <= viewport + 1 && (!bounds || bounds.left >= -1 && bounds.right <= viewport + 1),
    };
  });
}

async function galleryFrame(page) {
  await page.waitForFunction(() => {
    const frame = document.getElementById('ship-viewer');
    return Boolean(frame?.contentWindow?.__rigReady || frame?.contentWindow?.__rigStats?.error);
  }, null, { timeout: 60000 });
  const handle = await page.locator('#ship-viewer').elementHandle();
  const frame = await handle.contentFrame();
  if (!frame) throw new Error('Selected gallery iframe is missing.');
  await rigReady(frame);
  return frame;
}

async function inspectShip(page, ship, url, record, mobileIds) {
  await page.setViewportSize(DESKTOP);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await rigReady(page);
  await page.evaluate(() => { const v = window.__rigViewer; v.setPlaying(false); v.controls.enableDamping = false; v.setComparison(false); v.setSilhouette(false); v.reset(); });
  await frames(page);
  const loaded = await rigState(page);
  record('load', loaded.ready && loaded.assetId === ship.id && loaded.sourceBytes === fs.statSync(path.join(out, ship.assetPath)).size && loaded.meshes > 0 && loaded.renderCalls > 0 && loaded.texturesReady === true && loaded.nonfinite === 0, {
    assetId: loaded.assetId, sourceBytes: loaded.sourceBytes, meshes: loaded.meshes,
    triangles: loaded.triangleCount, texturesReady: loaded.texturesReady, renderCalls: loaded.renderCalls,
  });
  record('outline-auto-clear', loaded.outlineAutoClear === true && loaded.autoClearActual === true);
  record('seven-embedded-clips', loaded.animationClipCount === 7 && CLIPS.every(name => loaded.profiles.some(clip => clip.name === name && clip.duration > 0 && clip.tracks > 0)), loaded.profiles);

  for (const mode of MODES) {
    await page.locator('[data-mode="' + mode + '"]').click();
    await frames(page);
    const state = await rigState(page);
    record('mode:' + mode, state.mode === mode && state.renderCalls > 0 && state.outlineAutoClear === true && await page.locator('[data-mode="' + mode + '"]').getAttribute('aria-pressed') === 'true', { materialTypes: state.materialTypes, renderCalls: state.renderCalls });
  }

  for (const name of CLIPS) {
    const before = await page.evaluate(name => { const v = window.__rigViewer; const accepted = v.setProfile(name); v.setTime(0); return { accepted, duration: v.clips.find(clip => clip.name === name)?.duration }; }, name);
    await frames(page, 2);
    const start = await rigState(page);
    const sample = Math.min(before.duration * .37, 1.17);
    await page.evaluate(seconds => window.__rigViewer.setTime(seconds), sample);
    await frames(page, 2);
    const end = await rigState(page);
    const changedPoseValues = end.pose.reduce((sum, value, index) => sum + (Math.abs(value - start.pose[index]) > 1e-6 ? 1 : 0), 0);
    record('clip-frame:' + name, before.accepted === true && end.currentProfile === name && Math.abs(end.time - sample) < .001 && end.playing === false && end.nonfinite === 0 && end.renderCalls > 0, { duration: before.duration, sampledTime: sample, observedTime: end.time, changedPoseValues, note: 'Neutral channels may remain unchanged when the asset lacks that device.' });
    const button = page.locator('[data-profile="' + name + '"]');
    if (await button.isEnabled()) {
      await button.click();
      record('clip-button:' + name, (await rigState(page)).currentProfile === name);
    } else record('clip-button:' + name, Array.isArray(loaded.availableActions) && !loaded.availableActions.includes(name), { disabled: true, note: 'UI correctly disables an unavailable device action; embedded neutral clip still sampled by API.' });
  }

  await page.evaluate(() => { const v = window.__rigViewer; v.setProfile('FloatIdle'); v.setTime(0); v.setPlaying(true); });
  await frames(page, 6);
  await page.locator('#play').click();
  const advanced = await rigState(page);
  record('actual-playback-advance-and-pause', advanced.time > 0 && advanced.playing === false, { time: advanced.time });
  await page.locator('#outline').uncheck();
  record('outline-toggle-off', (await rigState(page)).outlineEnabled === false);
  await page.locator('#outline').check();
  record('outline-toggle-on', (await rigState(page)).outlineEnabled === true);

  for (const name of ['front', 'side', 'top', 'perspective']) {
    await page.locator('[data-view="' + name + '"]').click();
    await frames(page, 2);
    const state = await rigState(page);
    record('view:' + name, state.view === name && state.camera.every(Number.isFinite) && state.renderCalls > 0);
  }
  await page.locator('#compare-size').check();
  await frames(page);
  let state = await rigState(page);
  record('homeward-size-reference', state.comparisonEnabled === true && state.comparisonReferenceReady === true && state.referenceVisible && state.comparisonBounds?.min.every(Number.isFinite) && state.comparisonBounds?.max.every(Number.isFinite), { bounds: state.comparisonBounds, units: state.comparisonUnits });
  for (const name of ['front', 'side', 'top']) {
    await page.locator('[data-view="' + name + '"]').click();
    await frames(page, 2);
    state = await rigState(page);
    record('comparison-view:' + name, state.view === name && state.comparisonEnabled && state.referenceVisible && state.renderCalls > 0);
  }
  await page.locator('#silhouette').check();
  await frames(page, 2);
  state = await rigState(page);
  record('silhouette-on', state.silhouette === true && state.materialTypes.length === 1 && state.materialTypes[0] === 'MeshBasicMaterial');
  await page.locator('#silhouette').uncheck();
  await page.locator('#compare-size').uncheck();
  state = await rigState(page);
  record('silhouette-and-comparison-off', state.silhouette === false && state.comparisonEnabled === false && state.referenceVisible === false);

  await page.locator('#reset').click();
  await frames(page, 2);
  const initialCamera = (await rigState(page)).camera;
  const canvas = page.locator('#stage canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas has no visible bounds.');
  await canvas.scrollIntoViewIfNeeded();
  const visibleBox = await canvas.boundingBox();
  const x = visibleBox.x + visibleBox.width * .5, y = visibleBox.y + visibleBox.height * .5;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y + 25, { steps: 5 }); await page.mouse.up();
  await frames(page, 3);
  state = await rigState(page);
  record('pointer-orbit', state.camera.some((value, index) => Math.abs(value - initialCamera[index]) > .001));
  await page.mouse.wheel(0, -180);
  await frames(page, 3);
  record('wheel-zoom', Math.abs((await rigState(page)).zoom - 1) > .001);
  await page.locator('#fit').click();
  record('fit', Math.abs((await rigState(page)).zoom - 1) < .001);
  await page.locator('#rotate').click();
  const beforeRotation = await rigState(page);
  await frames(page, 6);
  state = await rigState(page);
  record('auto-rotate', state.autoRotate === true && state.camera.some((value, index) => Math.abs(value - beforeRotation.camera[index]) > .00001));
  await page.locator('#reset').click();
  state = await rigState(page);
  record('reset', state.autoRotate === false && state.view === 'perspective' && Math.abs(state.zoom - 1) < .001);

  for (const mode of MODES) {
    await page.evaluate(mode => { const v = window.__rigViewer; v.setMode(mode); v.setProfile('FloatIdle'); v.setPlaying(false); v.setTime(2); v.setComparison(false); v.setSilhouette(false); v.controls.enableDamping = false; v.reset(); }, mode);
    await frames(page, 4);
    const firstPNG = await page.locator('#stage canvas').screenshot({ animations: 'disabled' });
    await frames(page, 4);
    const secondPNG = await page.locator('#stage canvas').screenshot({ animations: 'disabled' });
    // Encoded screenshot Buffer.equals is supporting evidence only. It does
    // not replace decoded pixel QA or camera-rotation accumulation tests.
    record('paused-png-repeatability:' + mode, firstPNG.equals(secondPNG), { type: 'supplementary PNG encoded-byte equality', firstSha256: sha(firstPNG), secondSha256: sha(secondPNG), bytes: firstPNG.length, limitation: 'No decoded pixel difference, rotating-frame accumulation test, art review or performance conclusion.' });
  }

  if (mobileIds.has(ship.id)) {
    await page.setViewportSize(MOBILE);
    await frames(page, 4);
    const measured = await overflow(page);
    record('mobile-horizontal-overflow', measured.passed, measured);
    await page.setViewportSize(DESKTOP);
  }
}

async function inspectGallery(page, url, selectedIds, record) {
  await page.setViewportSize(DESKTOP);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__fleetViewer), null, { timeout: 30000 });
  let frame = await galleryFrame(page);
  await frame.evaluate(() => window.__rigViewer.setPlaying(false));
  const initial = await page.evaluate(() => ({ count: window.__fleetViewer.visibleCount, total: window.__fleetViewer.catalog.ships.length, iframes: window.__fleetViewer.loadedViewers, current: window.__fleetViewer.currentId }));
  record('default-13-one-iframe', initial.count === 13 && initial.total === 62 && initial.iframes === 1 && await page.locator('[data-ship-id]').count() === 13, initial);
  await page.locator('[data-scope="all"]').click();
  record('all-62', await page.locator('[data-ship-id]').count() === 62);
  const families = await page.locator('#family-filter option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
  if (!families.length) throw new Error('No family filter options.');
  await page.locator('#family-filter').selectOption(families[0]);
  let expected = await page.evaluate(value => window.__fleetViewer.catalog.ships.filter(ship => String(ship.identity?.family || ship.faction || 'other') === value).length, families[0]);
  record('family-filter', await page.locator('[data-ship-id]').count() === expected && expected > 0, { family: families[0], expected });
  await page.locator('#family-filter').selectOption('');
  const categories = await page.locator('#category-filter option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
  await page.locator('#category-filter').selectOption(categories[0]);
  expected = await page.evaluate(value => window.__fleetViewer.catalog.ships.filter(ship => ship.category === value).length, categories[0]);
  record('category-filter', await page.locator('[data-ship-id]').count() === expected && expected > 0, { category: categories[0], expected });
  await page.locator('#category-filter').selectOption('');
  const chosen = selectedIds.includes('enemy-cult-blockade') ? 'enemy-cult-blockade' : selectedIds[0];
  await page.locator('#ship-search').fill(chosen);
  record('search-by-id', await page.locator('[data-ship-id]').count() === 1 && await page.locator('[data-ship-id]').first().getAttribute('data-ship-id') === chosen, { chosen });
  await page.locator('[data-ship-id="' + chosen + '"]').click();
  frame = await galleryFrame(page);
  await frame.evaluate(() => window.__rigViewer.setPlaying(false));
  record('actual-card-v2-glb', (await rigState(frame)).assetId === chosen && await page.locator('iframe[data-fleet-viewer]').count() === 1);
  await page.locator('#version-old').click();
  frame = await galleryFrame(page);
  await frame.evaluate(() => window.__rigViewer.setPlaying(false));
  record('v1-switch-one-iframe', (await rigState(frame)).assetId === chosen && await page.locator('iframe[data-fleet-viewer]').count() === 1 && await page.evaluate(() => window.__fleetViewer.version === 'v1'), { chosen });
  await page.locator('#version-new').click();
  frame = await galleryFrame(page);
  await frame.evaluate(() => window.__rigViewer.setPlaying(false));
  record('v2-switch-one-iframe', (await rigState(frame)).assetId === chosen && await page.locator('iframe[data-fleet-viewer]').count() === 1 && await page.evaluate(() => window.__fleetViewer.version === 'v2'), { chosen });
  await page.locator('#ship-search').fill('');
  await page.locator('[data-scope="featured"]').click();
  record('return-to-featured-13', await page.locator('[data-ship-id]').count() === 13);
  const stale = await page.evaluate(() => {
    const ships = window.__fleetViewer.catalog.ships;
    return ships.filter(ship => ship.previewStale).map(ship => ({ id: ship.id, available: ship.previewAvailable, cardImage: Boolean(document.querySelector('[data-ship-id="' + ship.id + '"] img')) }));
  });
  record('stale-previews-not-shown', stale.every(ship => !ship.available && !ship.cardImage), { stale });
  await page.setViewportSize(MOBILE);
  await frames(page, 4);
  const measured = await overflow(page);
  record('gallery-mobile-horizontal-overflow', measured.passed, measured);
  record('gallery-mobile-one-iframe', await page.locator('iframe[data-fleet-viewer]').count() === 1);
  await page.setViewportSize(DESKTOP);
}

async function run(options) {
  const { SHOWCASE_IDS } = await import('./profiles.mjs');
  const catalogFile = path.join(out, 'catalog.json');
  const catalog = readJSON(catalogFile);
  const ids = options.ids || [...SHOWCASE_IDS];
  const selected = ids.map(id => catalog.ships.find(ship => ship.id === id));
  for (let index = 0; index < selected.length; index++) {
    const ship = selected[index];
    if (!ship || ship.status !== 'asset-built-v2') throw new Error('Unknown or unbuilt v2 model: ' + ids[index]);
    for (const key of ['assetPath', 'viewerPath']) if (!ship[key] || !fs.existsSync(path.join(out, ship[key]))) throw new Error('Missing ' + key + ': ' + ids[index]);
  }
  const report = {
    version: 'fleet-browser-qa-2.0.0', startedAt: new Date().toISOString(), passed: false,
    selection: { ids, requestedCount: ids.length, inspectedCount: 0, inspectedIds: [], showcaseCount: SHOWCASE_IDS.length, completeShowcaseInspection: false, complete62ModelBrowserInspection: false, galleryExtraModelLoads: true },
    catalogSha256: sha(fs.readFileSync(catalogFile)), browser: null, checks: [],
    pageErrors: [], externalRequests: [], failedRequests: [], navigationAborts: [], httpErrors: [], consoleErrors: [],
    limitations: [
      'Default 13 representative browser checks do not constitute a 62-model browser corpus check.',
      'PNG equality compares encoded bytes of two fixed paused frames; no decoded pixel or rotating-frame ghosting regression.',
      'No art-quality approval, role-identification study, game combat, balance, engine socket/collision validation, long-duration stability or performance profiling.',
      'Chrome only, desktop 1280x1000, representative mobile 390x844; no Edge/Safari/device coverage.',
      'Clip API samples all seven embedded tracks; unsupported device buttons are expected to remain disabled.',
    ],
  };
  let browser, context, server;
  let section = 'startup';
  const record = (name, passed, detail) => report.checks.push({ section, name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
  try {
    const local = await localServer(); server = local.server;
    const { launchBrowser } = require('../lib/runtime.cjs');
    browser = await launchBrowser({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
    report.browser = { version: browser.version(), requestedChannel: 'chrome', sequentialPages: 1 };
    context = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (!url.startsWith(local.origin + '/') && !/^(?:data|blob):/.test(url)) {
        report.externalRequests.push({ section, url }); await route.abort();
      } else await route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.pageErrors.push({ section, message: error.message }));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ section, message: message.text() }); });
    page.on('response', response => { if (response.status() >= 400) report.httpErrors.push({ section, url: response.url(), status: response.status() }); });
    page.on('requestfailed', request => {
      const item = { section, url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType(), navigation: request.isNavigationRequest() };
      // Gallery filtering removes lazy image elements and switching replaces
      // the iframe. A local cancellation is not a missing-file/HTTP failure.
      if (item.error?.includes('ERR_ABORTED') && item.url.startsWith(local.origin + '/')) report.navigationAborts.push(item);
      else report.failedRequests.push(item);
    });
    const userAgent = await page.evaluate(() => navigator.userAgent);
    report.browser.userAgent = userAgent;
    record('chrome-channel-not-edge', !/Edg\//.test(userAgent), { userAgent });
    if (/Edg\//.test(userAgent)) throw new Error('Chrome-only QA refused an Edge fallback. Configure an installed Chrome executable.');
    const mobileIds = new Set([ids.includes('player-homeward') ? 'player-homeward' : ids[0], ids.find(id => id.startsWith('boss-'))].filter(Boolean));
    report.selection.mobileIds = [...mobileIds];
    for (const ship of selected) {
      section = ship.id;
      try {
        await inspectShip(page, ship, local.origin + '/outputs/fleet-v2/' + ship.viewerPath, record, mobileIds);
        report.selection.inspectedIds.push(ship.id);
      }
      catch (error) { record('inspection-exception', false, { message: error.message, stack: error.stack }); }
      process.stdout.write(JSON.stringify({ inspected: ship.id, failedChecks: report.checks.filter(check => check.section === ship.id && !check.passed).length }) + '\n');
    }
    section = 'gallery';
    try { await inspectGallery(page, local.origin + '/outputs/fleet-v2/index.html', ids, record); }
    catch (error) { record('inspection-exception', false, { message: error.message, stack: error.stack }); }
    section = 'network';
    record('no-external-requests', report.externalRequests.length === 0);
    record('no-page-errors', report.pageErrors.length === 0);
    record('no-http-errors', report.httpErrors.length === 0);
    record('no-failed-requests', report.failedRequests.length === 0, { ignoredNavigationAborts: report.navigationAborts.length });
    record('no-console-errors', report.consoleErrors.length === 0);
  } catch (error) { record('fatal-exception', false, { message: error.message, stack: error.stack }); }
  finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise(resolve => server.close(resolve));
    report.selection.inspectedCount = report.selection.inspectedIds.length;
    report.selection.completeShowcaseInspection = SHOWCASE_IDS.every(id => report.selection.inspectedIds.includes(id));
    report.selection.complete62ModelBrowserInspection = catalog.ships.length === 62 && catalog.ships.every(ship => report.selection.inspectedIds.includes(ship.id));
    report.completedAt = new Date().toISOString();
    report.summary = { checks: report.checks.length, passed: report.checks.filter(check => check.passed).length, failed: report.checks.filter(check => !check.passed).length };
    report.passed = report.checks.length > 0 && report.summary.failed === 0;
    fs.mkdirSync(path.dirname(options.report), { recursive: true });
    fs.writeFileSync(options.report, JSON.stringify(report, null, 2) + '\n');
  }
  process.stdout.write(JSON.stringify({ report: path.relative(root, options.report).split(path.sep).join('/'), passed: report.passed, ...report.summary, completeShowcaseInspection: report.selection.completeShowcaseInspection, complete62ModelBrowserInspection: report.selection.complete62ModelBrowserInspection }) + '\n');
  return report;
}

if (require.main === module) {
  let options;
  try { options = parseArgs(process.argv.slice(2)); }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
  if (options?.help) process.stdout.write(usage() + '\n');
  else if (options) run(options).then(report => { if (!report.passed) process.exitCode = 1; }).catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
}

module.exports = { parseArgs, usage, run };
