'use strict';

// Run only in the coordinated browser/export/capture slot. Does not install dependencies.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(ROOT, 'outputs/enemy-base-v1/dense-r4');
const WORK = path.join(ROOT, 'work/verification/enemy-base-v1/dense-r4');
const DESKTOP = { width: 1440, height: 1050 };
const MOBILE = { width: 390, height: 844 };
const MODES = ['handdrawn', 'cel', 'original'];
const relative = file => path.relative(ROOT, file).split(path.sep).join('/');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const delta = (a, b) => Math.max(...a.map((value, index) => Math.abs(value - b[index])));

function inspectGlb(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid GLB v2 header or declared byte length.');
  let json, binaryBytes = 0;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    if (offset + 8 + length > bytes.length) throw new Error('GLB chunk exceeds file bounds.');
    if (type === 0x4e4f534a) json = JSON.parse(bytes.toString('utf8', offset + 8, offset + 8 + length).trim());
    if (type === 0x004e4942) binaryBytes += length;
    offset += length + 8;
  }
  if (!json) throw new Error('GLB JSON chunk is missing.');
  let primitiveInstances = 0, triangleCount = 0, vertexInstances = 0;
  const nonTriangleModes = [], visited = new Set();
  const walk = index => {
    if (visited.has(index)) throw new Error('Repeated or cyclic scene node index: ' + index);
    visited.add(index);
    const node = json.nodes[index];
    if (node.mesh !== undefined) for (const primitive of json.meshes[node.mesh].primitives) {
      primitiveInstances++;
      const position = json.accessors[primitive.attributes.POSITION];
      vertexInstances += position.count;
      const count = primitive.indices === undefined ? position.count : json.accessors[primitive.indices].count;
      if (primitive.mode === undefined || primitive.mode === 4) triangleCount += count / 3;
      else nonTriangleModes.push(primitive.mode);
    }
    for (const child of node.children || []) walk(child);
  };
  for (const node of json.scenes[json.scene || 0].nodes || []) walk(node);
  return { bytes: bytes.length, sha256: sha(bytes), version: json.asset.version, binaryBytes, nodesInScene: visited.size, primitiveInstances, triangleCount, vertexInstances, meshDefinitions: json.meshes?.length || 0, materials: json.materials?.length || 0, images: json.images?.length || 0, animations: json.animations?.length || 0, nonTriangleModes, externalUris: [...(json.buffers || []), ...(json.images || [])].map(row => row.uri).filter(uri => uri && !uri.startsWith('data:')) };
}

const frames = (page, count = 3) => page.evaluate(count => new Promise(resolve => {
  const tick = () => { if (--count <= 0) resolve(); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}), count);

async function ready(page) {
  await page.waitForFunction(() => window.__enemyBaseReady === true || window.__enemyBaseError || window.__enemyBaseReview?.stats?.error, null, { timeout: 90000 });
  const error = await page.evaluate(() => window.__enemyBaseError || window.__enemyBaseReview?.stats?.error);
  if (error) throw new Error(String(error));
  await page.evaluate(() => {
    const v = window.__enemyBaseReview;
    v.setAutoRotate(false); v.controls.enableDamping = false;
    v.setMotion?.(false); v.reset(); v.setAutoRotate(false); v.render();
  });
  await frames(page);
}

const cameraState = page => page.evaluate(() => {
  const v = window.__enemyBaseReview;
  const materialTypes = new Set();
  v.root.traverse(object => { if (object.isMesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materialTypes.add(material.type); });
  return { position: v.camera.position.toArray(), target: v.controls.target.toArray(), zoom: v.camera.zoom, distance: v.camera.position.distanceTo(v.controls.target), autoRotate: v.controls.autoRotate, mode: v.stats.mode, view: v.stats.view, outline: v.stats.outlineEnabled, effectAutoClear: v.effect.autoClear, renderCalls: v.renderer.info.render.calls, materialTypes: [...materialTypes] };
});

async function run(options = {}) {
  fs.mkdirSync(WORK, { recursive: true });
  const report = { schema: 'cloudstitch-enemy-base-browser-qa-1', startedAt: new Date().toISOString(), harness: relative(__filename), harnessSha256: sha(fs.readFileSync(__filename)), entry: 'outputs/enemy-base-v1/dense-r4/index.html', checks: [], ghosting: [], screenshots: [], pageErrors: [], consoleErrors: [], externalRequests: [], failedRequests: [], limits: ['Static 3D asset and local review page verification only; no campaign, combat, collision or game balance is tested.', 'The 390px viewport is browser emulation, not a physical mobile-device performance test.', 'Same-pose canvas pixels before and after a clean render detect accumulated frames; they do not substitute for human art approval.'] };
  const record = (name, passed, detail) => report.checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
  let browser, context, page;
  const capture = async (name, locator) => {
    const file = path.join(WORK, name + '.png');
    if (locator) {
      // Capture actual WebGL pixels only: a DOM region screenshot would include overlaid controls.
      const data = await locator.evaluate(canvas => { window.__enemyBaseReview.render(); return canvas.toDataURL('image/png'); });
      fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    }
    else await page.screenshot({ path: file, fullPage: true });
    report.screenshots.push(relative(file));
  };
  try {
    const modelFile = path.join(OUTPUT, 'enemy-base.glb');
    const model = inspectGlb(modelFile); report.model = { path: relative(modelFile), ...model };
    record('glb-v2-nonempty-triangle-geometry', model.binaryBytes > 0 && model.primitiveInstances > 0 && model.vertexInstances > 0 && model.triangleCount > 0 && Number.isInteger(model.triangleCount) && model.nonTriangleModes.length === 0, model);
    record('glb-self-contained', model.externalUris.length === 0, model.externalUris);
    const manifestFile = path.join(OUTPUT, 'model-manifest.json');
    record('model-manifest-present-and-valid-json', fs.existsSync(manifestFile));
    if (fs.existsSync(manifestFile)) { report.modelManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); report.modelManifestSha256 = sha(fs.readFileSync(manifestFile)); }
    const { launchBrowser } = require('../../lib/runtime.cjs');
    browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
    context = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1, reducedMotion: 'reduce', acceptDownloads: true });
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (/^https?:/.test(url)) { report.externalRequests.push(url); await route.abort(); }
      else await route.continue();
    });
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    report.browser = { version: browser.version(), desktop: DESKTOP, mobile: MOBILE, deviceScaleFactor: 1, entryProtocol: 'file:' };
    await page.goto(pathToFileURL(path.join(OUTPUT, 'index.html')).href, { waitUntil: 'load', timeout: 60000 });
    await ready(page);
    const geometry = await page.evaluate(() => {
      const v = window.__enemyBaseReview, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      let meshes = 0, vertices = 0, triangles = 0, badCoordinates = 0;
      v.root.updateMatrixWorld(true);
      v.root.traverse(object => {
        if (!object.isMesh || !object.geometry?.attributes?.position) return;
        meshes++; const p = object.geometry.attributes.position, matrix = object.matrixWorld.elements;
        vertices += p.count; triangles += (object.geometry.index?.count || p.count) / 3;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const point = [matrix[0]*x + matrix[4]*y + matrix[8]*z + matrix[12], matrix[1]*x + matrix[5]*y + matrix[9]*z + matrix[13], matrix[2]*x + matrix[6]*y + matrix[10]*z + matrix[14]];
          if (point.some(value => !Number.isFinite(value))) badCoordinates++;
          else point.forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); });
        }
      });
      return { meshes, vertices, triangles, badCoordinates, min, max, size: max.map((value, i) => value - min[i]), renderCalls: v.renderer.info.render.calls, rootChildren: v.root.children.length, stats: v.stats, effectAutoClear: v.effect.autoClear };
    });
    report.renderedGeometry = geometry;
    record('actual-glb-loaded-and-rendered', geometry.meshes === model.primitiveInstances && geometry.triangles === model.triangleCount && geometry.vertices === model.vertexInstances && geometry.renderCalls > 0, geometry);
    record('finite-nonempty-world-bounds', geometry.badCoordinates === 0 && geometry.size.every(value => Number.isFinite(value) && value > 0), { min: geometry.min, max: geometry.max, size: geometry.size, badCoordinates: geometry.badCoordinates });
    record('outline-effect-explicit-auto-clear', geometry.effectAutoClear === true);
    const surfaces=await page.evaluate(()=>{
      const maps=new Set();let uvMeshes=0,badUv=0;
      window.__enemyBaseReview.root.traverse(n=>{if(!n.isMesh)return;
        if(n.material.map){maps.add(n.material.map);const uv=n.geometry.attributes.uv;if(uv){uvMeshes++;for(const value of uv.array)if(!Number.isFinite(value))badUv++;}}
      });
      return {images:[...maps].map(m=>({width:m.image?.width,height:m.image?.height})),uvMeshes,badUv};
    });
    record('embedded-painted-atlas-decoded-in-browser',surfaces.images.length===1&&surfaces.images[0].width===1536&&surfaces.images[0].height===1024,surfaces);
    record('painted-mesh-uvs-finite',surfaces.uvMeshes>0&&surfaces.badUv===0,surfaces);

    // This API is intentionally required: the screenshots/pixel regression must isolate the static GLB.
    const isolationAvailable = await page.evaluate(() => typeof window.__enemyBaseReview.setEnvironment === 'function');
    record('model-isolation-api', isolationAvailable);
    if (!isolationAvailable) throw new Error('Review API must provide setEnvironment(false) to isolate model from scenery.');
    await page.evaluate(() => { const v = window.__enemyBaseReview; v.setEnvironment(false); v.setMotion?.(false); });
    for (const mode of MODES) {
      await page.locator('[data-mode="' + mode + '"]').click(); await frames(page);
      const state = await cameraState(page);
      record('display-mode:' + mode, state.mode === mode && state.renderCalls > 0 && await page.locator('[data-mode="' + mode + '"]').getAttribute('aria-pressed') === 'true', state);
      if (mode !== 'original') record('actual-display-materials:' + mode, state.materialTypes.length === 1 && state.materialTypes[0] === (mode === 'cel' ? 'MeshToonMaterial' : 'MeshBasicMaterial'), state.materialTypes);
      const ghost = await page.evaluate(async mode => {
        const v = window.__enemyBaseReview; v.reset(); v.setEnvironment(false); v.setMotion?.(false); v.setMode(mode); v.controls.enableDamping = false; v.controls.autoRotateSpeed = 18;
        const waitFrames = count => new Promise(resolve => { const tick = () => { if (--count <= 0) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
        const capture = () => { const source = v.renderer.domElement, c = document.createElement('canvas'); c.width = source.width; c.height = source.height; const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0); return ctx.getImageData(0, 0, c.width, c.height).data; };
        const cameraStart = v.camera.position.toArray();
        v.setMotion?.(true); v.controls.enableDamping = false; v.setAutoRotate(true);
        await waitFrames(120); v.setAutoRotate(false); v.setMotion?.(false); await waitFrames(4); v.render();
        const cameraBefore = v.camera.position.toArray(), targetBefore = v.controls.target.toArray(), before = capture();
        v.renderer.clear(true, true, true); v.render(); const after = capture();
        let changedPixels = 0, totalChannelDifference = 0, paintedPixels = 0;
        for (let i = 0; i < before.length; i += 4) { let changed = false; if (before[i + 3] > 0) paintedPixels++; for (let c = 0; c < 4; c++) { const d = Math.abs(before[i + c] - after[i + c]); if (d) changed = true; totalChannelDifference += d; } if (changed) changedPixels++; }
        return { mode, rotationFrames: 120, changedPixels, totalChannelDifference, paintedPixels, pixelCount: before.length / 4, cameraDelta: Math.max(...cameraBefore.map((x, i) => Math.abs(x - v.camera.position.toArray()[i]))), targetDelta: Math.max(...targetBefore.map((x, i) => Math.abs(x - v.controls.target.toArray()[i]))), rotationDistance: Math.hypot(...cameraBefore.map((x, i) => x - cameraStart[i])), outlineAutoClear: v.effect.autoClear };
      }, mode);
      report.ghosting.push(ghost);
      record('120-frame-rotation-clean-render:' + mode, ghost.changedPixels === 0 && ghost.cameraDelta < 1e-8 && ghost.targetDelta < 1e-8 && ghost.rotationDistance > .001 && ghost.paintedPixels > 100 && ghost.outlineAutoClear === true, ghost);
    }

    // Remaining UI checks are kept in one place so selectors follow the source review contract.
    await inspectReviewControls(page, record, capture, model, report);
    record('no-external-http-requests', report.externalRequests.length === 0, report.externalRequests);
    record('no-page-errors', report.pageErrors.length === 0, report.pageErrors);
    record('no-console-errors', report.consoleErrors.length === 0, report.consoleErrors);
    record('no-failed-requests', report.failedRequests.length === 0, report.failedRequests);
  } catch (error) {
    record('fatal-exception', false, { message: error.message, stack: error.stack });
    if (page) await capture('failure-page').catch(() => {});
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    report.completedAt = new Date().toISOString();
    report.summary = { total: report.checks.length, passed: report.checks.filter(row => row.passed).length, failed: report.checks.filter(row => !row.passed).length };
    report.passed = report.summary.total > 0 && report.summary.failed === 0;
    fs.writeFileSync(path.join(WORK, 'qa-result.json'), JSON.stringify(report, null, 2) + '\n');
  }
  process.stdout.write(JSON.stringify({ passed: report.passed, ...report.summary, report: relative(path.join(WORK, 'qa-result.json')) }) + '\n');
  return report;
}

async function inspectReviewControls(page, record, capture, model, report) {
  const reset = async () => {
    await page.locator('#reset').click();
    await page.evaluate(() => { const v = window.__enemyBaseReview; v.setAutoRotate(false); v.setMotion?.(false); v.controls.enableDamping = false; });
    await frames(page, 3);
  };
  await reset();
  const initial = await cameraState(page);
  const canvas = page.locator('#stage canvas');
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Rendered model canvas has no bounds.');
  // Use the upper-middle canvas, away from the toolbar overlay.
  const x = bounds.x + bounds.width * .46, y = bounds.y + bounds.height * .42;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 90, y + 28, { steps: 8 }); await page.mouse.up();
  await frames(page, 4);
  const rotated = await cameraState(page);
  record('pointer-drag-rotates-model-camera', delta(initial.position, rotated.position) > .001, { before: initial.position, after: rotated.position });
  await page.mouse.move(x, y); await page.mouse.wheel(0, -180); await frames(page, 4);
  const zoomed = await cameraState(page);
  record('wheel-zooms-model', Math.abs(zoomed.zoom - rotated.zoom) > .001 || Math.abs(zoomed.distance - rotated.distance) > .001, { before: { zoom: rotated.zoom, distance: rotated.distance }, after: { zoom: zoomed.zoom, distance: zoomed.distance } });
  await reset();
  const resetState = await cameraState(page);
  record('reset-restores-initial-camera-and-stops-rotation', delta(initial.position, resetState.position) < 1e-6 && delta(initial.target, resetState.target) < 1e-6 && Math.abs(initial.zoom - resetState.zoom) < 1e-6 && resetState.autoRotate === false, resetState);
  await page.evaluate(() => { const v = window.__enemyBaseReview; v.setMotion?.(true); v.controls.enableDamping = false; });
  await page.locator('#auto-rotate').click(); const autoStart = await cameraState(page); await frames(page, 12);
  const autoEnd = await cameraState(page);
  record('automatic-rotation-toggle-and-movement', autoEnd.autoRotate === true && delta(autoStart.position, autoEnd.position) > .00001 && await page.locator('#auto-rotate').getAttribute('aria-pressed') === 'true', { start: autoStart.position, end: autoEnd.position });
  await page.locator('#auto-rotate').click();
  record('automatic-rotation-can-stop', (await cameraState(page)).autoRotate === false && await page.locator('#auto-rotate').getAttribute('aria-pressed') === 'false');
  await page.evaluate(() => window.__enemyBaseReview.setMotion?.(false));

  await page.locator('#outline').uncheck(); await frames(page);
  record('outline-toggle-off', (await cameraState(page)).outline === false);
  await page.locator('#outline').check(); await frames(page);
  record('outline-toggle-on', (await cameraState(page)).outline === true && (await cameraState(page)).effectAutoClear === true);
  await page.locator('#outline-width').fill('2.5'); await page.locator('#outline-width').dispatchEvent('input');
  record('outline-width-control', await page.locator('#outline-width').inputValue() === '2.5' && (await page.locator('#outline-value').innerText()).trim() === '2.5');
  await page.locator('#outline-width').fill('1.5'); await page.locator('#outline-width').dispatchEvent('input');

  const presets = [];
  for (const view of ['front', 'back', 'top', 'iso']) {
    await page.locator('[data-view="' + view + '"]').click(); await frames(page, 3);
    const state = await cameraState(page); presets.push({ view, ...state });
    record('view-preset:' + view, state.view === view && state.position.every(Number.isFinite) && await page.locator('[data-view="' + view + '"]').getAttribute('aria-pressed') === 'true', state);
  }
  const front = presets.find(row => row.view === 'front'), back = presets.find(row => row.view === 'back');
  const fv = front.position.map((value, i) => value - front.target[i]), bv = back.position.map((value, i) => value - back.target[i]);
  const cosine = fv.reduce((sum, value, i) => sum + value * bv[i], 0) / Math.hypot(...fv) / Math.hypot(...bv);
  record('front-and-back-face-opposite-directions', cosine < -.9, { cosine });
  const top = presets.find(row => row.view === 'top'), topDirection = top.position.map((value, i) => value - top.target[i]);
  record('top-view-looks-down-on-model', Math.abs(topDirection[1]) / Math.hypot(...topDirection) > .95, { direction: topDirection });

  await page.locator('#fit').click(); await frames(page);
  const fitted = await page.evaluate(box => {
    const v = window.__enemyBaseReview; v.camera.updateMatrixWorld(true); v.camera.updateProjectionMatrix();
    const transform = (p, matrix) => {
      const e = matrix.elements, [x,y,z,w] = p;
      return [e[0]*x+e[4]*y+e[8]*z+e[12]*w, e[1]*x+e[5]*y+e[9]*z+e[13]*w, e[2]*x+e[6]*y+e[10]*z+e[14]*w, e[3]*x+e[7]*y+e[11]*z+e[15]*w];
    };
    const points = [];
    for (const x of [box.min[0],box.max[0]]) for (const y of [box.min[1],box.max[1]]) for (const z of [box.min[2],box.max[2]]) {
      const p = transform(transform([x,y,z,1], v.camera.matrixWorldInverse), v.camera.projectionMatrix);
      points.push(p.slice(0,3).map(value => value / p[3]));
    }
    return { ndcCorners: points, maxXY: Math.max(...points.flatMap(point => [Math.abs(point[0]), Math.abs(point[1])])), allInDepth: points.every(point => point[2] >= -1 && point[2] <= 1) };
  }, report.renderedGeometry);
  record('fit-keeps-entire-model-bounds-in-viewport', fitted.maxXY <= 1.01 && fitted.allInDepth, fitted);

  for (const focus of ['keep', 'bell_tower', 'dock', 'machinery']) {
    await reset(); const before = await cameraState(page);
    await page.locator('[data-focus="' + focus + '"]').click(); await frames(page, 3);
    const after = await cameraState(page);
    record('detail-focus:' + focus, after.position.every(Number.isFinite) && after.target.every(Number.isFinite) && (delta(before.target, after.target) > .001 || Math.abs(before.distance - after.distance) > .001 || Math.abs(before.zoom - after.zoom) > .001), { before, after });
  }
  await page.locator('.inspector details summary').click();
  await page.locator('[data-group="machinery"]').uncheck();
  const hidden = await page.evaluate(() => window.__enemyBaseReview.root.getObjectByName('machinery')?.visible);
  record('structure-group-can-hide', hidden === false);
  await page.locator('[data-group="machinery"]').check();
  const shown = await page.evaluate(() => window.__enemyBaseReview.root.getObjectByName('machinery')?.visible);
  record('structure-group-can-show', shown === true);
  await page.locator('.inspector details summary').click();

  await page.locator('#open-reference').click();
  const reference = await page.locator('#reference-dialog img').evaluate(async img => { await img.decode(); return { width: img.naturalWidth, height: img.naturalHeight, embedded: img.src.startsWith('data:image/png;base64,') }; });
  record('reference-modal-opens-with-decoded-original', await page.locator('#reference-dialog').isVisible() && reference.width > 0 && reference.height > 0 && reference.embedded, reference);
  await page.locator('[data-close="reference-dialog"]').click();
  record('reference-modal-closes', !await page.locator('#reference-dialog').isVisible());

  const storageBefore = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const note = 'Cloudstitch automated review persistence probe 2026-10-18';
  await page.locator('#open-review').click(); await page.locator('#review-comment').fill(note);
  await page.locator('[data-check="silhouette"]').check();
  await page.waitForFunction(note => Object.values(localStorage).some(value => value.includes(note)), note, { timeout: 10000 });
  await page.reload({ waitUntil: 'load' }); await ready(page);
  await page.locator('#open-review').click();
  record('review-note-and-check-persist-after-reload', await page.locator('#review-comment').inputValue() === note && await page.locator('[data-check="silhouette"]').isChecked());
  const exportPromise = page.waitForEvent('download'); await page.locator('#export-review').click();
  const exportDownload = await exportPromise, exportPath = path.join(WORK, 'qa-review-export.json');
  await exportDownload.saveAs(exportPath);
  const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  record('review-json-export-matches-saved-opinion', JSON.stringify(exported).includes(note), { path: relative(exportPath), bytes: fs.statSync(exportPath).size, sha256: sha(fs.readFileSync(exportPath)), suggestedFilename: exportDownload.suggestedFilename(), exportedKeys: Object.keys(exported) });
  await page.locator('[data-close="review-dialog"]').click();
  // Fresh isolated context has no user data; also restore it explicitly so captures show no QA opinion.
  await page.evaluate(before => { localStorage.clear(); for (const [key,value] of Object.entries(before)) localStorage.setItem(key,value); }, storageBefore);
  await page.reload({ waitUntil: 'load' }); await ready(page);

  const downloadPromise = page.waitForEvent('download'); await page.locator('#download-glb').click();
  const download = await downloadPromise, downloadPath = path.join(WORK, 'qa-download.glb');
  await download.saveAs(downloadPath);
  const downloadBytes = fs.readFileSync(downloadPath);
  report.download = { path: relative(downloadPath), bytes: downloadBytes.length, sha256: sha(downloadBytes), suggestedFilename: download.suggestedFilename() };
  record('download-is-exact-source-glb', downloadBytes.length === model.bytes && sha(downloadBytes) === model.sha256, report.download);

  await reset(); await page.locator('[data-mode="handdrawn"]').click();
  await page.evaluate(() => { const v = window.__enemyBaseReview; v.setEnvironment(true); v.render(); }); await frames(page);
  await page.evaluate(() => scrollTo(0,0)); await capture('review-desktop');
  await page.evaluate(() => { const v = window.__enemyBaseReview; v.setEnvironment(false); v.setMotion?.(false); v.render(); }); await frames(page);
  await capture('model-iso', canvas);
  for (const view of ['back', 'front']) {
    await page.locator('[data-view="' + view + '"]').click(); await frames(page);
    await capture('model-' + view, canvas);
  }
  for (const [focus,name] of [['bell_tower','detail-bell'],['dock','detail-dock']]) {
    await reset(); await page.evaluate(() => window.__enemyBaseReview.setEnvironment(false));
    await page.locator('[data-focus="' + focus + '"]').click(); await frames(page);
    await capture(name, canvas);
  }
  await reset();
  await page.setViewportSize(MOBILE); await frames(page, 4);
  await page.evaluate(() => { const v = window.__enemyBaseReview; v.setEnvironment(true); v.fit(); v.render(); scrollTo(0,0); }); await frames(page);
  const overflow = await page.evaluate(() => {
    const rect = document.querySelector('#stage canvas').getBoundingClientRect();
    return { viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, canvas: { left: rect.left, right: rect.right, width: rect.width }, passed: document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1 && rect.left >= -1 && rect.right <= innerWidth + 1 };
  });
  record('mobile-390-no-horizontal-overflow', overflow.passed, overflow);
  await capture('review-mobile-390');
  await page.locator('#open-review').click();
  const dialog = await page.locator('#review-dialog').evaluate(element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width, viewport: innerWidth, document: document.documentElement.scrollWidth }; });
  record('mobile-review-dialog-fits-viewport', dialog.left >= -1 && dialog.right <= dialog.viewport + 1 && dialog.document <= dialog.viewport + 1, dialog);
  await page.locator('[data-close="review-dialog"]').click();
}

if (require.main === module) {
  if (process.argv.includes('--help')) process.stdout.write('node tools/enemy-base/qa.cjs\nRun only in the coordinated browser slot. Verifies the static enemy-base GLB, review controls, offline loading, three display modes, 120-frame clean-render regressions, downloads and 390px layout. Writes work/verification/enemy-base-v1/dense-r4/qa-result.json and screenshots.\n');
  else run().then(report => { if (!report.passed) process.exitCode = 1; }).catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
}
module.exports = { run, inspectGlb };
