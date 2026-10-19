// Run by the integration owner, against one existing local server/browser.
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, reportDirectory } = require('../lib/runtime.cjs');
const url = process.env.LEVELS_URL || 'http://127.0.0.1:8080/outputs/levels-v1/index.html';
async function main() {
  const out = reportDirectory('levels'), browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], externalRequests = [], failedRequests = [], samples = [], checks = [];
  const origin = new URL(url).origin;
  const check = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), detail });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) externalRequests.push(request.url()); });
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__levelsPreview?.getState().ready, undefined, { timeout: 60000 });
    await page.waitForTimeout(650);
    samples.push({ phase: 'cold-initial-ready', ...await page.evaluate(() => window.__levelsPreview.metrics) });
    for (const levelId of ['first-voyage', 'jonghang-harbor']) {
      await page.evaluate(id => window.__levelsPreview.selectLevel(id), levelId);
      await page.waitForFunction(() => window.__levelsPreview.getState().ready);
      await page.waitForTimeout(650);
      const observation = await page.evaluate(() => window.__levelsPreview.metrics);
      samples.push({ phase: 'ready-overview', ...observation });
      check(`${levelId}:real-assets`, observation.currentModelMeshInstances > 1 && observation.rendererTextureCount >= 1 && observation.activeErrors.length === 0, observation);
      check(`${levelId}:corridors`, observation.corridors.every(item => item.clear), observation.corridors);
      if (levelId === 'first-voyage') check('restored-tax-cutter-reference', observation.actualTaxCutterProjectedBoundsPx?.width > 0, observation.actualTaxCutterProjectedBoundsPx);
      await page.screenshot({ path: path.join(out, `${levelId}-overview.png`) });
      await page.locator('#follow').click(); await page.waitForTimeout(650);
      samples.push({ phase: 'player-follow', ...await page.evaluate(() => window.__levelsPreview.metrics) });
      await page.locator('#progress').evaluate(node => { node.value = '100'; node.dispatchEvent(new Event('input', { bubbles: true })); });
      for (const yaw of [0, 45, 90, 135, 180, 270]) {
        await page.locator('#yaw').evaluate((node, value) => { node.value = String(value); node.dispatchEvent(new Event('input', { bubbles: true })); }, yaw);
        const state = await page.evaluate(() => window.__levelsPreview.getState()); check(`${levelId}:yaw-${yaw}-clear`, state.report.insideBounds && state.report.solidIds.length === 0, state);
      }
      await page.waitForTimeout(650); samples.push({ phase: 'route-end', ...await page.evaluate(() => window.__levelsPreview.metrics) });
      await page.screenshot({ path: path.join(out, `${levelId}-route-end.png`) });
    }
    // Optional art-only scene must not hide the next independent level.
    // This optional comparison lives inside a closed <details> by default.
    // Open it through the same summary control a user sees before clicking.
    const comparisonPanel = page.locator('details').filter({ has: page.locator('#full-scene') });
    if (!await comparisonPanel.evaluate(panel => panel.open)) await comparisonPanel.locator('summary').click();
    await page.locator('#full-scene').click();
    await page.waitForFunction(() => window.__levelsPreview.metrics.mode === 'preserved-full-scene-comparison-no-authored-physics' && window.__levelsPreview.metrics.currentModelMeshInstances > 200, undefined, { timeout: 60000 });
    samples.push({ phase: 'full-scene-comparison', ...await page.evaluate(() => window.__levelsPreview.metrics) });
    await page.evaluate(() => window.__levelsPreview.selectLevel('first-voyage'));
    await page.waitForFunction(() => window.__levelsPreview.getState().ready); await page.waitForTimeout(650);
    const restored = await page.evaluate(() => window.__levelsPreview.metrics); check('independent-level-after-full-scene', restored.mode === 'independent-priority-layout' && restored.currentModelMeshInstances > 1, restored.mode);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(650);
    check('mobile-no-horizontal-overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { width: 390 });
    await page.screenshot({ path: path.join(out, 'mobile.png'), fullPage: true });
    check('page-errors-zero', errors.length === 0, errors); check('external-requests-zero', externalRequests.length === 0, externalRequests); check('failed-local-requests-zero', failedRequests.length === 0, failedRequests);
    const report = { schemaVersion: 1, url, passed: checks.every(c => c.passed), checks, samples, errors, externalRequests, failedRequests, limitations: ['One automated desktop Chromium-compatible session and responsive viewport; not real mobile hardware.', 'No gameplay/time/damage/settlement validation.', 'Ray sample occlusion and projected size are not pixel coverage or human readability.', 'No final performance budget or FPS certification.'] };
    fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, checks: checks.length, failures: checks.filter(c => !c.passed).map(c => c.name), output: path.join(out, 'summary.json') }));
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ schemaVersion: 1, url, passed: false, incomplete: true, error: error.message, checks, samples, errors, externalRequests, failedRequests }, null, 2));
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
