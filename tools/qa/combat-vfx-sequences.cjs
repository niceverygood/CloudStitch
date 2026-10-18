/* Verify only the six composed attack sequences and preserved source weapons. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { repoRoot, repoPath, reportDirectory, launchBrowser } = require('../lib/runtime.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(repoRoot, file).split(path.sep).join('/');
const expectedIds = ['01-machine-gun', '02-deck-cannon', '03-mortar', '04-harpoon', '05-chain-shot', '06-flamethrower'];
const sampleSeconds = [.1, .4, .75];

async function frames(page, count = 3) {
  await page.evaluate(count => new Promise(resolve => { const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }), count);
}
async function snapshot(page, time) {
  return page.evaluate(time => {
    const viewer = window.__vfxWorkbench;
    viewer.setPlaying(false); viewer.setLoop(false); viewer.setAutoRotate(false); viewer.controls.enableDamping = false;
    viewer.setTime(time); viewer.root.updateMatrixWorld(true); viewer.camera.updateMatrixWorld(true);
    const values = [], meshes = [], tether = [];
    let finite = true, maximumProjectedXY = 0;
    viewer.root.traverse(node => {
      const matrix = node.matrixWorld.elements;
      if (!matrix.every(Number.isFinite)) finite = false;
      if (/tether_growth/i.test(node.name)) {
        const worldScale = [Math.hypot(matrix[0], matrix[1], matrix[2]), Math.hypot(matrix[4], matrix[5], matrix[6]), Math.hypot(matrix[8], matrix[9], matrix[10])];
        let ancestorsVisible = true;
        for (let parent = node; parent; parent = parent.parent) if (!parent.visible) ancestorsVisible = false;
        tether.push({ name: node.name, localScale: node.scale.toArray(), worldScale, ancestorsVisible });
      }
      if (!node.isMesh) return;
      values.push(...matrix.map(number => Math.round(number * 1e6) / 1e6));
      node.geometry.computeBoundingBox();
      const box = node.geometry.boundingBox;
      if (!box) return;
      for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) {
        const corner = new viewer.camera.position.constructor(x ? box.max.x : box.min.x, y ? box.max.y : box.min.y, z ? box.max.z : box.min.z).applyMatrix4(node.matrixWorld).project(viewer.camera);
        if (![corner.x, corner.y, corner.z].every(Number.isFinite)) finite = false;
        maximumProjectedXY = Math.max(maximumProjectedXY, Math.abs(corner.x), Math.abs(corner.y));
      }
      meshes.push(node.name);
    });
    return { time: window.__vfxStats.currentTime, mixerTime: viewer.mixer.time, finite, meshCount: meshes.length, maximumProjectedXY, state: JSON.stringify(values), tether };
  }, time);
}
async function main() {
  const html = repoPath(process.argv[2] || 'outputs/combat-vfx/attack-sequences.html');
  const directory = reportDirectory('combat-vfx-sequences', process.argv[3]);
  const catalogFile = repoPath(process.argv[4] || 'outputs/combat-vfx/sequence-catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8').replace(/^\uFEFF/, ''));
  const weaponCatalogFile = repoPath('outputs/weapon-modules/catalog.json');
  const weaponCatalog = JSON.parse(fs.readFileSync(weaponCatalogFile, 'utf8').replace(/^\uFEFF/, ''));
  const report = { html: relative(html), catalog: relative(catalogFile), sampleSeconds, models: [], errors: [], externalRequests: [], passed: false };
  let browser;
  try {
    if (catalog.items.length !== 6 || expectedIds.some(id => !catalog.items.some(item => item.id === id))) throw new Error('Expected exactly the six attack sequences.');
    const chain = catalog.items.find(item => item.id === '05-chain-shot');
    if (chain.copied_weapon_zero_normals_repaired !== 4) throw new Error('Chain-shot copy must record the four repaired zero normals.');
    const harpoon = catalog.items.find(item => item.id === '04-harpoon');
    const projectile = harpoon.component_effects.find(item => item.id === 'harpoon-projectile');
    if (!projectile || Math.abs(projectile.visible_until - 2.7) > 1e-6) throw new Error('Harpoon projectile/tether visibility must be held until 2.7 seconds.');
    report.chainShotCopiedNormalsRepaired = 4; report.harpoonVisibleUntil = projectile.visible_until;
    browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('request', request => { if (/^https?:/i.test(request.url())) { const url = new URL(request.url()); report.externalRequests.push(url.origin + url.pathname); } });
    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction(() => window.__vfxReady || window.__vfxStats?.error, null, { timeout: 60000 });
    if (!(await page.evaluate(() => window.__vfxReady))) throw new Error(JSON.stringify(await page.evaluate(() => window.__vfxStats)));
    const available = await page.evaluate(() => window.__vfxWorkbench.availableItems.map(item => item.id));
    if (available.length !== 6 || expectedIds.some(id => !available.includes(id))) throw new Error('The attack viewer does not expose all six embedded models.');
    for (const item of catalog.items) {
      const modelFile = path.resolve(path.dirname(catalogFile), item.model), modelBytes = fs.readFileSync(modelFile), modelHash = hash(modelBytes);
      if (modelHash !== item.sha256 || modelBytes.length !== item.bytes) throw new Error('Sequence model differs from its final catalog: ' + item.id);
      const weapon = weaponCatalog.items.find(weapon => weapon.id === item.weapon_id);
      if (!weapon) throw new Error('Missing original weapon catalog entry: ' + item.id);
      const sourceHash = hash(fs.readFileSync(path.resolve(path.dirname(weaponCatalogFile), weapon.model)));
      if (sourceHash !== item.source_weapon_sha256) throw new Error('Original weapon SHA-256 changed: ' + item.id);
      await page.evaluate(id => window.__vfxWorkbench.selectEffect(id), item.id);
      await page.waitForFunction(id => window.__vfxReady && window.__vfxStats.selectedId === id, item.id, { timeout: 60000 });
      const initial = await page.evaluate(() => {
        const viewer = window.__vfxWorkbench; viewer.setPlaying(false); viewer.setLoop(false); viewer.setTarget('none'); viewer.reset(); viewer.fit();
        const stats = window.__vfxStats;
        return { ready: stats.ready, selectedId: stats.selectedId, triangles: stats.triangleCount, meshCount: stats.meshCount, texturesReady: stats.texturesReady, textures: stats.textures, animationClipCount: stats.animationClipCount, animationTrackCount: stats.animationTrackCount, duration: stats.duration, sourceBytes: stats.sourceBytes, outlineAutoClear: viewer.effect.autoClear === true, cameraZoom: viewer.camera.zoom };
      });
      if (!initial.ready || initial.triangles !== item.triangles || initial.sourceBytes !== modelBytes.length || !initial.texturesReady || !initial.textures.some(texture => texture.ready && texture.width === 2048 && texture.height === 2048) || !initial.animationClipCount || !initial.animationTrackCount || Math.abs(initial.duration - item.duration) > 1e-5 || !initial.outlineAutoClear || !(initial.cameraZoom > 0)) throw new Error('Actual GLB/texture/clip/fit readiness failed: ' + item.id);
      const samples = [];
      for (const time of sampleSeconds) {
        const sample = await snapshot(page, time);
        if (!sample.finite || Math.abs(sample.time - time) > 1e-6 || Math.abs(sample.mixerTime - time) > 1e-6 || sample.maximumProjectedXY > 1.025) throw new Error('Animation transform or camera fit failed at ' + item.id + ': ' + time);
        samples.push({ time: sample.time, mixerTime: sample.mixerTime, finite: sample.finite, meshCount: sample.meshCount, maximumProjectedXY: sample.maximumProjectedXY, transformSHA256: hash(sample.state) });
      }
      if (new Set(samples.map(sample => sample.transformSHA256)).size !== sampleSeconds.length) throw new Error('Clip transforms did not change at the three requested times: ' + item.id);
      let harpoonTether;
      if (item.id === '04-harpoon') {
        const sample = await snapshot(page, 1.8);
        harpoonTether = sample.tether;
        if (!harpoonTether.length || harpoonTether.some(tether => !tether.ancestorsVisible || tether.localScale[2] < 3.5 || Math.min(...tether.worldScale) < .01)) throw new Error('Harpoon tether was hidden or shrunk at 1.8 seconds.');
      }
      const downloadPromise = page.waitForEvent('download'); await page.click('#download'); const download = await downloadPromise;
      const downloadedFile = path.join(directory, item.id + '.glb'); await download.saveAs(downloadedFile);
      if (hash(fs.readFileSync(downloadedFile)) !== modelHash) throw new Error('Downloaded embedded GLB does not match its original source bytes: ' + item.id);
      report.models.push({ id: item.id, initial, sourceWeaponSHA256: sourceHash, originalWeaponUnchanged: true, sequenceSHA256: modelHash, samples, downloadMatchesOriginalHash: true, ...(harpoonTether ? { harpoonTetherAt1_8Seconds: harpoonTether } : {}) });
      console.log(JSON.stringify({ id: item.id, triangles: initial.triangles, textures2KReady: true, transformsChanged: true, sourceWeaponUnchanged: true, downloadHashMatched: true }));
    }
    if (report.errors.length || report.externalRequests.length) throw new Error('Attack-sequence viewer emitted an error or external request.');
    report.passed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, models: report.models.length, summary: relative(path.join(directory, 'summary.json')), errors: report.errors, externalRequests: report.externalRequests, failure: report.failure || null }, null, 2));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
