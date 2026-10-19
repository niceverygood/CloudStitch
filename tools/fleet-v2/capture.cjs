'use strict';
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { launchBrowser } = require('../lib/runtime.cjs');
const { writeGallery } = require('./gallery.cjs');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'outputs/fleet-v2');
const esc = text => String(text).replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
(async () => {
  const { SHOWCASE_IDS } = await import('./profiles.mjs');
  const catalog = JSON.parse(fs.readFileSync(path.join(out, 'catalog.json'), 'utf8'));
  const ids = process.argv.find(arg => arg.startsWith('--ids='))?.slice(6).split(',');
  const ships = catalog.ships.filter(ship => ship.status === 'asset-built-v2' && (!ids || ids.includes(ship.id)));
  const browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 950 }, deviceScaleFactor: 1 });
    for (const ship of ships) {
      await page.goto(pathToFileURL(path.join(out, ship.viewerPath)).href);
      await page.waitForFunction(() => window.__rigReady === true || window.__rigStats?.error, null, { timeout: 60000 });
      const error = await page.evaluate(() => window.__rigStats?.error); if (error) throw new Error(ship.id + ': ' + error);
      await page.evaluate(() => { const v = window.__rigViewer; v.setComparison(false); v.setPlaying(false); v.setTime(2); v.controls.enableDamping = false; v.reset(); document.querySelectorAll('.stage-label,.view-tools,.caption').forEach(element => { element.style.display = 'none'; }); });
      await page.waitForTimeout(100); await page.locator('#stage').screenshot({ path: path.join(out, ship.previewPath) });
      await page.evaluate(() => window.__rigViewer.setSilhouette(true)); await page.waitForTimeout(80);
      const silhouettePath = `previews/${ship.id}-silhouette.png`; await page.locator('#stage').screenshot({ path: path.join(out, silhouettePath) });
      Object.assign(ship, { silhouettePath, previewSourceSha256: ship.sha256, previewCapturedAt: new Date().toISOString() });
      fs.writeFileSync(path.join(out, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
      process.stdout.write(JSON.stringify({ preview: ship.id }) + '\n');
    }
    const sheetShips = SHOWCASE_IDS.map(id => catalog.ships.find(ship => ship.id === id)).filter(ship => ship && ship.previewSourceSha256 === ship.sha256 && fs.existsSync(path.join(out, ship.previewPath)) && fs.existsSync(path.join(out, ship.silhouettePath || 'missing')));
    const columns = 4;
    for (const silhouettes of [false, true]) {
      const html = '<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#f3eee2;color:#263c3d;font:16px system-ui}h1{margin:0;font-size:32px}p{color:#65736b;font-size:14px;margin:8px 0 24px}.grid{display:grid;grid-template-columns:repeat(' + columns + ',1fr);gap:14px}.card{border:1px solid #c9cbbb;background:#fffaf0;border-radius:14px;overflow:hidden}.card img{width:100%;height:230px;display:block;object-fit:contain}.label{padding:10px 13px;border-top:1px solid #e4dece}strong{font-size:15px}small{display:block;font-size:11px;line-height:1.4;color:#65736b;margin-top:5px}</style><h1>Cloudstitch · ' + (silhouettes ? '각자의 실루엣을 가진 함대' : '각자의 형태를 가진 함대') + '</h1><p>대표 ' + sheetShips.length + '항목 · 선택 귀환호 보존 · 개별 화면 맞춤 크기 · 제작용 상대 크기는 3D 뷰어의 귀환호 비교에서 확인</p><div class="grid">' + sheetShips.map(ship => '<div class="card"><img src="' + pathToFileURL(path.join(out, silhouettes ? ship.silhouettePath : ship.previewPath)).href + '"><div class="label"><strong>' + esc(ship.name) + '</strong><small>' + esc(ship.identity?.tagline || ship.identityFamily) + '</small></div></div>').join('') + '</div>';
      const file = path.join(root, 'work/fleet-v2', silhouettes ? 'silhouette-sheet.html' : 'overview.html'); fs.writeFileSync(file, html);
      await page.setViewportSize({ width: 1600, height: 1000 }); await page.goto(pathToFileURL(file).href); await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
      await page.screenshot({ path: path.join(out, silhouettes ? 'silhouette-sheet.png' : 'fleet-overview.png'), fullPage: true });
    }
  } finally { await browser.close(); }
  process.stdout.write(JSON.stringify(writeGallery()) + '\n');
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
