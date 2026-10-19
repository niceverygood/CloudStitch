'use strict';

// Run only in the integration owner's reserved Chrome slot. --help and
// --check never start a server/browser or create output artifacts.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const qaOut = path.join(root, 'outputs/fleet-comparison-browser-qa-v1');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const DESKTOP = { width: 1440, height: 1080 };
const MOBILE = { width: 390, height: 844 };

function help() {
  return [
    'Cloudstitch fleet comparison UI QA (one Chrome page, sequential)',
    '',
    'node tools/fleet-comparison/browser-qa.cjs',
    'node tools/fleet-comparison/browser-qa.cjs --url=http://127.0.0.1:8840/outputs/fleet-comparison-v1/index.html',
    'node tools/fleet-comparison/browser-qa.cjs --report=work/fleet-comparison/verification.json',
    '',
    'Default: temporary localhost server; only fleet-comparison-v1, fleet-v1',
    'and fleet-v2 output folders are served. Original archive GLBs allow HEAD',
    'only, with an exact A1-C3 name allowlist; no other workspace paths.',
    'Default report: outputs/fleet-comparison-browser-qa-v1/verification.json',
    'desktop.png and mobile.png are written beside the selected report.',
    'Use --help or node --check for preparation without running a browser.',
    '',
    'Verifies 71 cards/decoded PNGs, 9 original archive images/GLB HEAD checks,',
    '6 stages/12 slots, data-based affiliation',
    'and boss filters, presets, pane/card selection, one lazy v2/v1/previous',
    'GLB viewer, 390px mobile overflow, requests and page errors.',
    'Does not repeat animation, ghosting, performance, combat or art approval.',
  ].join('\n');
}

function parseArgs(args) {
  const options = { help: false, url: null, report: path.join(qaOut, 'verification.json') };
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--url=')) {
      const url = new URL(arg.slice(6));
      if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error('--url must be an unauthenticated localhost HTTP(S) URL.');
      options.url = url.href;
    } else if (arg.startsWith('--report=')) {
      if (!arg.slice(9)) throw new Error('--report requires a path.');
      options.report = path.resolve(root, arg.slice(9));
    } else throw new Error('Unknown option: ' + arg);
  }
  return options;
}

async function serve() {
  const directories = ['fleet-comparison-v1', 'fleet-v1', 'fleet-v2'].map(name => fs.realpathSync(path.join(root, 'outputs', name)));
  const originalDirectory = fs.realpathSync(path.join(root, 'outputs/airship-models-9'));
  const within = (base, file) => { const relative = path.relative(base, file); return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
  const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.glb': 'model/gltf-binary' };
  const server = http.createServer((request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const file = path.resolve(root, '.' + pathname);
      const originalName = path.relative(originalDirectory, file);
      const originalModel = /^[A-C][1-3]-airship\.glb$/.test(originalName);
      const originalIndex = originalName === 'index.html';
      if (originalModel && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
      if (!directories.some(directory => within(directory, file)) && !originalModel && !originalIndex) { response.writeHead(403).end(); return; }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
      const realFile = fs.realpathSync(file);
      if (!directories.some(directory => within(directory, realFile)) && !((originalModel || originalIndex) && path.dirname(realFile) === originalDirectory)) { response.writeHead(403).end(); return; }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size, 'Cache-Control': 'no-store' });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
    } catch { response.writeHead(400).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, url: 'http://127.0.0.1:' + server.address().port + '/outputs/fleet-comparison-v1/index.html' };
}

async function frames(page, count = 3) {
  await page.evaluate(count => new Promise(resolve => { let remaining = count; const next = () => { if (--remaining <= 0) resolve(); else requestAnimationFrame(next); }; requestAnimationFrame(next); }), count);
}

function expectedBossIds(data) {
  const ids = new Set();
  for (const ship of data.ships) if (ship.isBoss === true || ship.boss === true || ['mini-boss', 'boss-vessel', 'boss-facility'].includes(ship.category)) ids.add(ship.id);
  for (const stage of data.stages) for (const key of ['midBoss', 'finalBoss']) if (stage[key]?.assetId) ids.add(stage[key].assetId);
  return ids;
}

async function loadedViewer(page) {
  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe[data-comparison-viewer]');
    return Boolean(frame?.contentWindow?.__rigReady || frame?.contentWindow?.__rigStats?.error);
  }, null, { timeout: 60000 });
  const handle = await page.locator('iframe[data-comparison-viewer]').elementHandle();
  const frame = await handle.contentFrame();
  if (!frame) throw new Error('Comparison iframe disappeared.');
  const stats = await frame.evaluate(() => {
    const viewer = window.__rigViewer, state = window.__rigStats;
    if (viewer) viewer.setPlaying(false);
    return { ...state, assetId: viewer?.rig?.userData?.assetId, renderedCalls: viewer?.renderer?.info?.render?.calls };
  });
  if (stats.error) throw new Error(stats.error);
  return stats;
}

async function overflow(page) {
  return page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, passed: document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1 }));
}

async function run(options) {
  const report = { version: 'fleet-comparison-ui-qa-1.0.0', startedAt: new Date().toISOString(), passed: false, browser: null, source: {}, checks: [], pageErrors: [], externalRequests: [], failedRequests: [], localAborts: [], httpErrors: [], consoleErrors: [], screenshots: [], limits: ['UI and actual local preview/GLB loading only; existing frozen v2/v1 artifacts are read without modification.', 'No repeated animation, ghosting, performance, combat, collision/socket or art-quality approval.', 'Single Chrome page; desktop 1440x1080 and mobile viewport 390x844; no real-device/other-browser coverage.'] };
  let server, browser, context, section = 'startup';
  const record = (name, passed, detail) => report.checks.push({ section, name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
  const reportDirectory = path.dirname(options.report);
  try {
    let url = options.url;
    if (!url) { const local = await serve(); server = local.server; url = local.url; }
    const origin = new URL(url).origin;
    report.source.url = url;
    const { launchBrowser } = require('../lib/runtime.cjs');
    browser = await launchBrowser({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
    context = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await context.route('**/*', async route => {
      const requestUrl = route.request().url();
      if (!requestUrl.startsWith(origin + '/') && !/^(?:data|blob):/.test(requestUrl)) { report.externalRequests.push({ section, url: requestUrl }); await route.abort(); }
      else await route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.pageErrors.push({ section, message: error.message }));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ section, message: message.text() }); });
    page.on('response', response => { if (response.status() >= 400) report.httpErrors.push({ section, url: response.url(), status: response.status() }); });
    page.on('requestfailed', request => {
      const item = { section, url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType() };
      if (item.url.startsWith(origin + '/') && item.error?.includes('ERR_ABORTED')) report.localAborts.push(item); else report.failedRequests.push(item);
    });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => Boolean(window.__fleetComparison), null, { timeout: 30000 });
    const userAgent = await page.evaluate(() => navigator.userAgent);
    report.browser = { version: browser.version(), channel: 'chrome', userAgent, sequentialPageCount: 1 };
    record('chrome-channel', !/Edg\//.test(userAgent));
    if (/Edg\//.test(userAgent)) throw new Error('Chrome-only QA refused an Edge fallback.');
    const data = await page.evaluate(() => window.__fleetComparison.data);
    report.source.dataVersion = data.version;
    report.source.dataSha256 = sha(Buffer.from(JSON.stringify(data)));
    const byId = new Map(data.ships.map(ship => [ship.id, ship]));
    const bosses = expectedBossIds(data);

    section = 'all-ships';
    record('all-71-unique-cards', data.ships.length === 71 && new Set(data.ships.map(ship => ship.id)).size === 71 && await page.locator('[data-card-id]').count() === 71);
    record('initial-no-webgl-iframe', await page.locator('iframe[data-comparison-viewer]').count() === 0 && await page.evaluate(() => window.__fleetComparison.loadedViewers === 0));
    const decoded = await page.evaluate(async () => {
      const results = [];
      // Decode every declared local PNG, including initially lazy/offscreen
      // card previews. No screenshot or old-art substitution is accepted.
      for (const ship of window.__fleetComparison.data.ships) {
        const image = new Image(); const expected = new URL(ship.previewPath, location.href).href; image.src = expected;
        try { await image.decode(); results.push({ id: ship.id, url: image.currentSrc || image.src, expected, width: image.naturalWidth, height: image.naturalHeight, passed: image.naturalWidth > 0 && image.naturalHeight > 0 && (image.currentSrc || image.src) === expected }); }
        catch (error) { results.push({ id: ship.id, expected, passed: false, error: String(error.message || error) }); }
      }
      const rendered = [...document.querySelectorAll('[data-card-id]')].map(card => { const ship = window.__fleetComparison.data.ships.find(ship => ship.id === card.dataset.cardId); const image = card.querySelector('img'); return { id: ship.id, pathMatches: Boolean(image && image.src === new URL(ship.previewPath, location.href).href) }; });
      return { previews: results, rendered };
    });
    record('all-71-local-png-actual-decode', decoded.previews.length === 71 && decoded.previews.every(item => item.passed), decoded.previews);
    record('all-card-preview-url-mapping', decoded.rendered.length === 71 && decoded.rendered.every(item => item.pathMatches), decoded.rendered);

    section = 'original-archive';
    const archive = Array.isArray(data.archiveOriginals) ? data.archiveOriginals : [];
    record('nine-separate-original-archive-cards', archive.length === 9 && await page.locator('[data-archive-id]').count() === 9 && await page.locator('[data-card-id]').count() === 71);
    const decodedArchive = await page.evaluate(async () => {
      const rows = [];
      for (const original of window.__fleetComparison.data.archiveOriginals || []) {
        const expected = new URL(original.previewPath, location.href).href, image = new Image(); image.src = expected;
        try { await image.decode(); rows.push({ id: original.id, expected, width: image.naturalWidth, height: image.naturalHeight, passed: image.naturalWidth > 0 && image.naturalHeight > 0 && image.src === expected }); }
        catch (error) { rows.push({ id: original.id, passed: false, error: String(error.message || error) }); }
      }
      return rows;
    });
    record('nine-original-previews-actual-decode', decodedArchive.length === 9 && decodedArchive.every(item => item.passed), decodedArchive);
    for (const original of archive) {
      const expectedURL = new URL(original.assetPath, url).href;
      const declaredURL = await page.locator('[data-archive-id="' + original.id + '"] .archive-download').getAttribute('href');
      const response = await context.request.head(expectedURL);
      const bytes = Number(response.headers()['content-length']);
      record('original:' + original.id + ':head-only-download-link', response.ok() && bytes > 0 && new URL(declaredURL, url).href === expectedURL, { url: expectedURL, status: response.status(), bytes, bodyDownloaded: false });
    }
    record('archive-no-extra-webgl', await page.locator('iframe[data-comparison-viewer]').count() === 0);

    section = 'stage-board';
    record('six-stages', data.stages.length === 6 && await page.locator('[data-stage-id]').count() === 6);
    let slotCount = 0;
    for (const stage of data.stages) {
      const row = page.locator('[data-stage-id="' + stage.id + '"]');
      const slots = row.locator('.boss-slot');
      record(stage.id + ':two-slots', await slots.count() === 2);
      for (const [index, key] of ['midBoss', 'finalBoss'].entries()) {
        const slot = stage[key], ship = byId.get(slot?.assetId); slotCount++;
        const measured = await slots.nth(index).evaluate((node, expected) => { const image = node.querySelector('img'); return { name: node.querySelector('.slot-name')?.textContent, hasCompareButton: Boolean(node.querySelector('button')), imageURL: image?.src, expectedURL: expected.path ? new URL(expected.path, location.href).href : null, note: node.querySelector('.slot-note')?.textContent }; }, { path: ship?.previewPath });
        record(stage.id + ':' + key + ':asset-mapping', Boolean(ship) && measured.name === (slot.name || ship.name) && measured.imageURL === measured.expectedURL && measured.hasCompareButton, { assetId: slot?.assetId, ...measured });
      }
    }
    record('twelve-mapped-slots', slotCount === 12);
    record('canonical-section-separate', await page.locator('#canon-list').count() === 1 && await page.locator('#canon-list .canon-item').count() > 0);
    const canonPrimary = page.locator('#canon-list [data-canon-slot="midBoss"], #canon-list [data-canon-slot="finalBoss"]');
    record('canonical-twelve-primary-slots', await canonPrimary.count() === 12);
    record('canonical-six-midboss-slots', await page.locator('#canon-list [data-canon-slot="midBoss"]').count() === 6);
    record('canonical-six-finalboss-slots', await page.locator('#canon-list [data-canon-slot="finalBoss"]').count() === 6);
    record('canonical-eight-unspecified-slots', await page.locator('#canon-list [data-canon-status="unspecified"]').count() === 8);
    for (const stage of data.canonStages || []) for (const key of ['midBoss', 'finalBoss']) {
      const slot = stage[key], expectedStatus = !slot?.assetId || slot.status === 'unspecified' ? 'unspecified' : 'assigned';
      const row = page.locator('#canon-list [data-canon-stage-id="' + stage.id + '"][data-canon-slot="' + key + '"]');
      record('canonical:' + stage.id + ':' + key, await row.count() === 1 && await row.getAttribute('data-canon-status') === expectedStatus, { expectedStatus, assetId: slot?.assetId || null });
    }
    const components = page.locator('#canon-list [data-canon-slot="component"]');
    record('canonical-one-additional-command-component', await components.count() === 1 && await components.getAttribute('data-canon-stage-id') === 'stage-04-industry' && await components.getAttribute('data-canon-status') === 'assigned' && await components.innerText().then(text => text.includes('수석 조선공의 지휘함') && text.includes('별도 지역 최종보스가 아니라')), { note: 'Shipyard facility already occupies the canonical final slot; only its distinct command-ship component is additional.' });

    section = 'presets';
    for (const preset of ['ally-enemy', 'ally-boss', 'ally-ally', 'enemy-enemy']) {
      await page.locator('[data-preset="' + preset + '"]').click();
      const selection = await page.evaluate(() => window.__fleetComparison.selection);
      const left = byId.get(selection.left), right = byId.get(selection.right);
      const passed = preset === 'ally-enemy' ? left?.side === 'ally' && right?.side === 'enemy' : preset === 'ally-boss' ? left?.id === 'player-homeward' && bosses.has(right?.id) : preset === 'ally-ally' ? left?.side === 'ally' && right?.side === 'ally' && left.id !== right.id : left?.side === 'enemy' && right?.side === 'enemy' && left.id !== right.id;
      record(preset, passed, selection);
    }
    for (const pane of ['left', 'right']) {
      await page.locator('#side-' + pane).selectOption('ally');
      const allyCount = data.ships.filter(ship => ship.side === 'ally').length;
      record(pane + ':ally-pane-filter', await page.locator('#select-' + pane + ' option').count() === allyCount, { allyCount });
      const chosen = data.ships.filter(ship => ship.side === 'ally').at(-1).id;
      await page.locator('#select-' + pane).selectOption(chosen);
      record(pane + ':dropdown-selection', await page.evaluate(({ pane, chosen }) => window.__fleetComparison.selection[pane] === chosen, { pane, chosen }));
    }

    section = 'list-filters';
    for (const side of ['ally', 'enemy', 'neutral', 'reference', 'boss', 'all']) {
      await page.locator('[data-filter="' + side + '"]').click();
      const expected = side === 'all' ? data.ships.length : side === 'boss' ? bosses.size : data.ships.filter(ship => ship.side === side).length;
      const actual = await page.locator('[data-card-id]').count();
      record('filter:' + side, actual === expected, { actual, expected });
      if (side === 'boss') {
        const shown = await page.locator('[data-card-id]').evaluateAll(cards => cards.map(card => card.dataset.cardId));
        record('boss-filter-id-union', shown.length === bosses.size && shown.every(id => bosses.has(id)), { shown, expected: [...bosses] });
      }
    }
    const faction = data.ships.find(ship => ship.faction)?.faction;
    await page.locator('#faction-filter').selectOption(faction);
    record('faction-filter', await page.locator('[data-card-id]').count() === data.ships.filter(ship => ship.faction === faction).length, { faction });
    await page.locator('#faction-filter').selectOption('');
    await page.locator('#ship-search').fill('enemy-cult-blockade');
    record('search-by-id', await page.locator('[data-card-id]').count() === 1 && await page.locator('[data-card-id]').getAttribute('data-card-id') === 'enemy-cult-blockade');
    for (const pane of ['left', 'right']) {
      await page.locator('[data-card-id="enemy-cult-blockade"] [data-place-side="' + pane + '"]').click();
      record(pane + ':card-placement', await page.evaluate(pane => window.__fleetComparison.selection[pane] === 'enemy-cult-blockade', pane));
    }
    await page.locator('#ship-search').fill('');

    section = 'lazy-3d-modal';
    await page.locator('#side-left').selectOption('all');
    await page.locator('#select-left').selectOption('player-homeward');
    await page.locator('[data-open-side="left"]').click();
    let stats = await loadedViewer(page);
    record('v2-hero-actual-glb', stats.ready === true && stats.assetId === 'player-homeward' && stats.renderedCalls > 0 && await page.locator('iframe[data-comparison-viewer]').count() === 1, { assetId: stats.assetId, sourceBytes: stats.sourceBytes, renderer: stats.renderer });
    await page.locator('#viewer-close').click();
    record('close-removes-viewer', await page.locator('iframe[data-comparison-viewer]').count() === 0 && await page.locator('#viewer-dialog').evaluate(dialog => !dialog.open));
    const alternative = data.ships.find(ship => ship.sourceVersion === 'v1' && ship.category === 'preexisting-variant');
    if (!alternative) throw new Error('Missing v1 design alternative.');
    await page.locator('#select-left').selectOption(alternative.id);
    await page.locator('[data-open-side="left"]').click(); stats = await loadedViewer(page);
    const frameUrl = await page.locator('iframe[data-comparison-viewer]').getAttribute('src');
    record('v1-alternative-actual-glb', stats.ready === true && stats.assetId === alternative.id && stats.renderedCalls > 0 && frameUrl === alternative.viewerPath && await page.locator('iframe[data-comparison-viewer]').count() === 1, { assetId: stats.assetId, frameUrl });
    await page.keyboard.press('Escape');
    record('escape-removes-viewer', await page.locator('iframe[data-comparison-viewer]').count() === 0);
    await page.locator('#select-left').selectOption('player-homeward');
    await page.locator('[data-previous-side="left"]').click(); stats = await loadedViewer(page);
    record('previous-v1-same-asset-one-viewer', stats.ready === true && stats.assetId === 'player-homeward' && await page.locator('iframe[data-comparison-viewer]').count() === 1 && await page.locator('iframe[data-comparison-viewer]').getAttribute('src') === byId.get('player-homeward').previousViewerPath);
    await page.locator('#viewer-close').click();
    record('previous-close-zero-viewers', await page.locator('iframe[data-comparison-viewer]').count() === 0);

    section = 'viewport';
    await page.locator('[data-preset="ally-enemy"]').click();
    await page.locator('[data-filter="all"]').click();
    await page.evaluate(() => scrollTo(0, 0));
    await frames(page);
    fs.mkdirSync(reportDirectory, { recursive: true });
    const desktop = path.join(reportDirectory, 'desktop.png');
    await page.screenshot({ path: desktop, fullPage: true }); report.screenshots.push(path.relative(root, desktop).split(path.sep).join('/'));
    const desktopOverflow = await overflow(page); record('desktop-overflow', desktopOverflow.passed, desktopOverflow);
    await page.setViewportSize(MOBILE); await frames(page, 4);
    const mobile = await overflow(page); record('mobile-390-horizontal-overflow', mobile.passed, mobile);
    const paneRects = await page.locator('.compare-pane').evaluateAll(panes => panes.map(pane => { const r = pane.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; }));
    record('mobile-two-comparison-panes-visible', paneRects.length === 2 && paneRects.every(rect => rect.width > 0 && rect.left >= -1 && rect.right <= 391), paneRects);
    const mobileImage = path.join(reportDirectory, 'mobile.png');
    await page.screenshot({ path: mobileImage, fullPage: true }); report.screenshots.push(path.relative(root, mobileImage).split(path.sep).join('/'));

    section = 'network';
    record('no-external-requests', report.externalRequests.length === 0);
    record('no-page-errors', report.pageErrors.length === 0);
    record('no-http-errors', report.httpErrors.length === 0);
    record('no-failed-requests', report.failedRequests.length === 0, { localAborts: report.localAborts.length });
    record('no-console-errors', report.consoleErrors.length === 0);
  } catch (error) { record('inspection-exception', false, { message: error.message, stack: error.stack }); }
  finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise(resolve => server.close(resolve));
    report.completedAt = new Date().toISOString();
    report.summary = { checks: report.checks.length, passed: report.checks.filter(check => check.passed).length, failed: report.checks.filter(check => !check.passed).length };
    report.passed = report.checks.length > 0 && report.summary.failed === 0;
    fs.mkdirSync(reportDirectory, { recursive: true }); fs.writeFileSync(options.report, JSON.stringify(report, null, 2) + '\n');
  }
  process.stdout.write(JSON.stringify({ report: path.relative(root, options.report).split(path.sep).join('/'), passed: report.passed, ...report.summary }) + '\n');
  return report;
}

if (require.main === module) {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
  if (options?.help) process.stdout.write(help() + '\n');
  else if (options) run(options).then(report => { if (!report.passed) process.exitCode = 1; }).catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
}
module.exports = { help, parseArgs, expectedBossIds, run };
