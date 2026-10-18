/* Verify the final six-item gallery and capture its original browser layout. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { repoRoot, repoPath, launchBrowser } = require('../lib/runtime.cjs');

const EXPECTED_IDS = ['01-machine-gun', '02-deck-cannon', '03-mortar', '04-harpoon', '05-chain-shot', '06-flamethrower'];
const reportDirectory = repoPath('work/verification/weapon-gallery');
const reportFile = path.join(reportDirectory, 'summary.json');

function relative(file) { return path.relative(repoRoot, file).split(path.sep).join('/'); }
function safeURL(value) {
  try { const url = new URL(value); return url.origin + url.pathname; } catch { return '(invalid URL)'; }
}
async function frames(page, count = 3) {
  await page.evaluate(count => new Promise(resolve => {
    const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  }), count);
}
function completedItems(catalog, directory) {
  const items = (catalog.items || []).filter(item => item.status === 'completed_asset_prototype');
  if (items.length !== 6 || new Set(items.map(item => item.id)).size !== 6 || EXPECTED_IDS.some(id => !items.some(item => item.id === id))) {
    throw new Error('Final overview requires exactly the six completed weapon prototypes.');
  }
  for (const item of items) {
    const file = item.model && path.resolve(directory, item.model);
    if (!file || !fs.existsSync(file)) throw new Error('Completed model is missing: ' + item.id);
    const bytes = fs.readFileSync(file);
    if (bytes.length < 12 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
      throw new Error('Expected an actual complete GLB: ' + item.id);
    }
  }
  return items;
}

async function main() {
  // Optional paths permit review copies while defaults match the final deliverable.
  const catalogFile = repoPath(process.argv[2] || 'outputs/weapon-modules/catalog.json');
  const galleryFile = repoPath(process.argv[3] || 'outputs/weapon-modules/gallery.html');
  const output = repoPath(process.argv[4] || 'outputs/weapon-modules/overview.png');
  fs.mkdirSync(reportDirectory, { recursive: true });
  const report = { gallery: relative(galleryFile), catalog: relative(catalogFile), screenshot: relative(output), desktopViewport: { width: 1440, height: 1000 }, mobileViewport: { width: 390, height: 844 }, errors: [], externalRequests: [], passed: false };
  let browser;
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
    const completed = completedItems(catalog, path.dirname(catalogFile));
    report.completedIds = completed.map(item => item.id);
    report.completedCount = completed.length;
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: report.desktopViewport, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('request', request => {
      if (/^https?:/i.test(request.url())) report.externalRequests.push(safeURL(request.url()));
    });
    await page.goto(pathToFileURL(galleryFile).href);
    await page.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
    const state = await page.evaluate(async () => {
      const cards = [...document.querySelectorAll('.card')];
      const imageNodes = [...document.querySelectorAll('.art img, .art svg image')];
      const imageResults = await Promise.all(imageNodes.map(async node => {
        const source = node.getAttribute('href') || node.getAttribute('src');
        if (!source) return { source: '', loaded: false, width: 0, height: 0 };
        const image = new Image(); image.src = new URL(source, location.href).href;
        try { await image.decode(); return { source, loaded: image.naturalWidth > 0 && image.naturalHeight > 0, width: image.naturalWidth, height: image.naturalHeight }; }
        catch { return { source, loaded: false, width: 0, height: 0 }; }
      }));
      const references = [...document.querySelectorAll('a[href],link[href],script[src],img[src],svg image[href],source[src]')].map(node => {
        const raw = node.getAttribute('href') || node.getAttribute('src');
        return raw ? { raw, url: new URL(raw, location.href).href } : null;
      }).filter(Boolean);
      return { cardIds: cards.map(card => card.dataset.weaponId), imageResults, references, header: document.querySelector('header')?.innerText || '', desktopOverflow: document.documentElement.scrollWidth > innerWidth };
    });
    report.cardIds = state.cardIds;
    report.cardCount = state.cardIds.length;
    report.imageResults = state.imageResults;
    report.header = state.header;
    report.desktopOverflow = state.desktopOverflow;
    if (report.cardCount !== completed.length || completed.some(item => !state.cardIds.includes(item.id)) || new Set(state.cardIds).size !== completed.length) {
      throw new Error('Gallery cards do not match the actual completed model catalog.');
    }
    if (state.imageResults.length !== completed.length || state.imageResults.some(image => !image.loaded)) throw new Error('A gallery preview image did not load.');
    const links = [];
    for (const reference of state.references) {
      const url = new URL(reference.url);
      if (url.protocol === 'data:' || url.protocol === 'blob:') continue;
      if (url.protocol !== 'file:') throw new Error('Gallery contains a nonlocal resource or link: ' + safeURL(reference.url));
      url.search = ''; url.hash = '';
      const file = fileURLToPath(url);
      const exists = fs.existsSync(file) && fs.statSync(file).isFile();
      links.push({ link: reference.raw, target: relative(file), exists });
      if (!exists) throw new Error('Gallery link target is missing: ' + reference.raw);
    }
    report.relativeLinks = links;
    await page.setViewportSize(report.mobileViewport); await frames(page);
    report.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (report.desktopOverflow || report.mobileOverflow) throw new Error('Gallery overflows the viewport.');
    if (report.errors.length || report.externalRequests.length) throw new Error('Gallery emitted a page error or external request.');
    await page.setViewportSize(report.desktopViewport); await frames(page);
    // This is a browser screenshot of the final original gallery; no image
    // compositing, cropping, resizing or raster editing is performed afterward.
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const screenshot = await page.screenshot({ path: output, fullPage: true });
    report.screenshotWidth = screenshot.readUInt32BE(16);
    report.screenshotHeight = screenshot.readUInt32BE(20);
    report.screenshotBytes = screenshot.length;
    if (report.screenshotWidth !== 1440) throw new Error('Overview PNG must have a 1440-pixel browser viewport width.');
    if (report.errors.length || report.externalRequests.length) throw new Error('Gallery emitted a page error or external request during capture.');
    report.passed = true;
  } catch (error) {
    report.failure = error.message;
    throw error;
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, completedCount: report.completedCount, cardCount: report.cardCount, screenshot: report.passed ? report.screenshot : null, summary: relative(reportFile), failure: report.failure || null }, null, 2));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
