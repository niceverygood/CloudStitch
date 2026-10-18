/* Verify the real gallery UI, then capture twelve representative browser cards. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { repoRoot, repoPath, launchBrowser } = require('../lib/runtime.cjs');
const relative = file => path.relative(repoRoot, file).split(path.sep).join('/');
const reportDirectory = repoPath('work/verification/combat-vfx-gallery');

async function frames(page, count = 3) {
  await page.evaluate(count => new Promise(resolve => { const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }), count);
}
async function visibleIds(page) {
  return page.evaluate(() => [...document.querySelectorAll('.card:not([hidden])')].map(card => card.dataset.id));
}
function sameIds(actual, expected) { return actual.length === expected.length && new Set(actual).size === expected.length && expected.every(id => actual.includes(id)); }
async function main() {
  const catalogFile = repoPath(process.argv[2] || 'outputs/combat-vfx/catalog.json');
  const galleryFile = repoPath(process.argv[3] || 'outputs/combat-vfx/gallery.html');
  const output = repoPath(process.argv[4] || 'outputs/combat-vfx/overview.png');
  fs.mkdirSync(reportDirectory, { recursive: true });
  const report = { catalog: relative(catalogFile), gallery: relative(galleryFile), overview: relative(output), pageErrors: [], externalRequests: [], passed: false };
  let browser;
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8').replace(/^\uFEFF/, ''));
    const complete = catalog.items.filter(item => item.model && item.preview && !['pending', 'generating', 'failed'].includes(item.status) && fs.existsSync(path.resolve(path.dirname(catalogFile), item.model)) && fs.existsSync(path.resolve(path.dirname(catalogFile), item.preview)));
    if (complete.length !== 48) throw new Error('Expected all 48 actual GLBs and rendered preview files before final gallery QA.');
    report.catalogCount = complete.length;
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('request', request => { if (/^https?:/i.test(request.url())) { const url = new URL(request.url()); report.externalRequests.push(url.origin + url.pathname); } });
    const url = pathToFileURL(galleryFile).href;
    await page.goto(url); await frames(page);
    const initial = await visibleIds(page);
    if (!sameIds(initial, complete.map(item => item.id))) throw new Error('Gallery cards do not match the 48 complete assets.');
    report.cardCount = initial.length;
    const images = await page.evaluate(async () => Promise.all([...document.querySelectorAll('.art img,.art svg image')].map(async node => {
      const source = node.getAttribute('href') || node.getAttribute('src'); const image = new Image(); image.src = new URL(source, location.href).href;
      try { await image.decode(); return { source, loaded: image.naturalWidth > 0 && image.naturalHeight > 0, width: image.naturalWidth, height: image.naturalHeight }; }
      catch { return { source, loaded: false }; }
    })));
    if (images.length !== 48 || images.some(image => !image.loaded)) throw new Error('A real preview PNG did not load.');
    report.images = images;
    const references = await page.evaluate(() => [...document.querySelectorAll('a[href],img[src],svg image[href],link[href],script[src]')].map(node => {
      const raw = node.getAttribute('href') || node.getAttribute('src'); return { raw, url: new URL(raw, location.href).href };
    }));
    const links = [];
    for (const reference of references) {
      const target = new URL(reference.url); target.search = ''; target.hash = '';
      if (target.protocol !== 'file:') throw new Error('Gallery has a nonlocal link or resource.');
      const file = fileURLToPath(target), exists = fs.existsSync(file) && fs.statSync(file).isFile();
      links.push({ link: reference.raw, target: relative(file), exists });
      if (!exists) throw new Error('Gallery relative link target is missing: ' + reference.raw);
    }
    report.relativeLinks = links;
    await page.selectOption('#category-filter', 'material-impact');
    const categoryIds = await visibleIds(page), expectedCategory = complete.filter(item => item.category === 'material-impact').map(item => item.id);
    if (!sameIds(categoryIds, expectedCategory)) throw new Error('Category filter failed.');
    await page.selectOption('#category-filter', 'all'); await page.selectOption('#weapon-filter', '01-machine-gun');
    const weaponIds = await visibleIds(page), expectedWeapon = complete.filter(item => item.weapon_id === '01-machine-gun').map(item => item.id);
    if (!sameIds(weaponIds, expectedWeapon)) throw new Error('Weapon filter failed.');
    await page.selectOption('#weapon-filter', 'all'); await page.fill('#search', 'repair-stitch');
    const searchIds = await visibleIds(page);
    if (!sameIds(searchIds, ['repair-stitch'])) throw new Error('Search filter failed.');
    await page.fill('#search', '');
    report.filters = { category: categoryIds, weapon: weaponIds, search: searchIds };
    await page.click('button[data-background="cream"]');
    if (await page.evaluate(() => document.body.dataset.background) !== 'cream') throw new Error('Cream background toggle failed.');
    await page.click('button[data-background="deepteal"]');
    if (await page.evaluate(() => document.body.dataset.background) !== 'deepteal') throw new Error('Deep teal background toggle failed.');
    report.backgroundToggle = true;
    const recipe = page.locator('[data-recipe]').first();
    const recipeId = await recipe.getAttribute('data-recipe');
    await recipe.click();
    const dialog = await page.evaluate(() => ({ open: document.getElementById('recipe-dialog').open, text: document.getElementById('recipe-content').textContent }));
    if (!dialog.open || !dialog.text.includes(recipeId)) throw new Error('Recipe dialog did not show the selected real recipe.');
    await page.click('#close-recipe');
    if (await page.evaluate(() => document.getElementById('recipe-dialog').open)) throw new Error('Recipe dialog did not close.');
    report.recipeDialog = { id: recipeId, openedCorrectRecipe: true, closed: true };
    await page.setViewportSize({ width: 390, height: 844 }); await frames(page);
    report.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (report.mobileOverflow) throw new Error('Gallery overflows the mobile viewport.');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(url + '?overview=1'); await frames(page);
    const representative = await visibleIds(page);
    const expectedOverview = ['machine-gun-muzzle', 'cannon-muzzle', 'mortar-launch', 'harpoon-launch', 'chain-shot-launch', 'flamethrower-stream', 'large-explosion', 'wood-hit', 'envelope-rupture-state', 'shield-pulse', 'repair-stitch', 'salvage-tether'];
    if (!sameIds(representative, expectedOverview)) throw new Error('Representative overview must show exactly the requested twelve effects.');
    if (await page.evaluate(() => document.body.dataset.background) !== 'deepteal') throw new Error('Representative overview must use deep teal contrast.');
    await page.evaluate(async () => { if (document.fonts) await document.fonts.ready; }); await frames(page);
    if (report.pageErrors.length || report.externalRequests.length) throw new Error('Gallery has a page error or external request.');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const screenshot = await page.screenshot({ path: output, fullPage: true });
    report.representativeIds = representative; report.overviewWidth = screenshot.readUInt32BE(16); report.overviewHeight = screenshot.readUInt32BE(20); report.overviewBytes = screenshot.length;
    if (report.overviewWidth !== 1440 || report.pageErrors.length || report.externalRequests.length) throw new Error('Overview screenshot failed its final check.');
    report.passed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(reportDirectory, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, cards: report.cardCount, overview: report.passed ? report.overview : null, summary: relative(path.join(reportDirectory, 'summary.json')), failure: report.failure || null }, null, 2));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
