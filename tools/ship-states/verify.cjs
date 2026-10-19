/* Verify the offline ship appearance study through its public UI and actual WebGL.
 * CLI: node tools/ship-states/verify.cjs [--followup|--finish] [viewerHTML] [reportDirectory]
 * Followup reuses the preserved initial 31-stage geometry evidence and tests the
 * revised framing, thumbnails, six representative models and changed animations.
 * A browser is supplied by tools/lib/runtime.cjs; no local web server is needed.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { repoRoot, repoPath, reportDirectory, launchBrowser } = require('../lib/runtime.cjs');

const followup = process.argv.slice(2).includes('--followup');
const finish = process.argv.slice(2).includes('--finish');
const positional = process.argv.slice(2).filter(value => !['--followup', '--finish'].includes(value));
const htmlPath = repoPath(positional[0] || 'outputs/ship-states-v1/index.html');
const reportDir = reportDirectory('ship-states', positional[1]);
const outputDir = path.dirname(htmlPath);
const modes = ['handdrawn', 'cel', 'original'];
const expected = { normal: 3, damage: 4, weapons: 5, armor: 5, growth: 9, explosion: 5 };
const countExpected = Object.values(expected).reduce((sum, count) => sum + count, 0);
const representatives = { normal: 2, damage: 3, weapons: 4, armor: 4, growth: 8, explosion: 2 };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const relative = filename => path.relative(repoRoot, filename).split(path.sep).join('/');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function frames(page, count = 3) {
  await page.evaluate(count => new Promise(resolve => {
    const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  }), count);
}
async function select(page, category, stage, time = 0) {
  await page.evaluate(async ({ category, stage, time }) => {
    const viewer = window.__shipStates;
    await viewer.select(category, stage);
    viewer.setPlaying(false);
    viewer.controls.autoRotate = false;
    viewer.controls.enableDamping = false;
    viewer.setTime(time);
    viewer.render();
  }, { category, stage, time });
  await frames(page, 2);
}
async function statistics(page) {
  return page.evaluate(() => {
    const viewer = window.__shipStates, value = viewer.stats;
    return typeof value === 'function' ? value.call(viewer) : value;
  });
}
async function pixels(page, options = {}) {
  return page.evaluate(options => {
    const viewer = window.__shipStates;
    if (options.render !== false) viewer.render();
    const source = viewer.renderer.domElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261, nonBackgroundPixels = 0, opaquePixels = 0;
    const background = Array.from(data.subarray(0, 4));
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3]) opaquePixels++;
      if (data[index + 3] && (Math.abs(data[index] - background[0]) + Math.abs(data[index + 1] - background[1]) + Math.abs(data[index + 2] - background[2])) > 18) nonBackgroundPixels++;
      for (let channel = 0; channel < 4; channel++) { hash ^= data[index + channel]; hash = Math.imul(hash, 16777619); }
    }
    const matrices = [], materials = [], renderOrders = new Set();
    viewer.current.root.updateMatrixWorld(true);
    viewer.current.root.traverse(node => {
      matrices.push([node.name, node.visible, node.renderOrder, ...node.matrixWorld.elements]); renderOrders.add(node.renderOrder);
      if (node.isMesh) for (const material of (Array.isArray(node.material) ? node.material : [node.material])) materials.push({ mesh: node.name, type: material.type, opacity: material.opacity, visible: material.visible, transparent: material.transparent, depthWrite: material.depthWrite, depthTest: material.depthTest, side: material.side, alphaTest: material.alphaTest, alphaHash: material.alphaHash, alphaToCoverage: material.alphaToCoverage, dithering: material.dithering, color: material.color?.toArray(), emissive: material.emissive?.toArray(), emissiveIntensity: material.emissiveIntensity });
    });
    const matrixJSON = JSON.stringify(matrices), materialJSON = JSON.stringify(materials);
    const hashText = text => { let hash = 2166136261; for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16); };
    const stats = viewer.stats;
    const result = { width: canvas.width, height: canvas.height, hash: (hash >>> 0).toString(16), nonBackgroundPixels, opaquePixels,
      camera: { position: viewer.camera.position.toArray(), quaternion: viewer.camera.quaternion.toArray(), target: viewer.controls.target.toArray(), zoom: viewer.camera.zoom }, state: { time: stats.time, category: stats.category, stage: stats.stage, mode: stats.mode }, actualState: { nodes: matrices.length, materialEntries: materials.length, matrixHash: hashText(matrixJSON), materialHash: hashText(materialJSON), renderOrders: [...renderOrders], exactReferenceData: 'Full matrixWorld/visible/renderOrder and actual material opacity/visible/transparent/depth/color/alpha settings are compared as JSON in the browser.' } };
    if (options.store) {
      window.__shipQAPixelReferences ||= new Map();
      window.__shipQAPixelReferences.set(options.store, { pixels: data.slice(), camera: result.camera, matrixJSON, materialJSON });
    }
    if (options.compare) {
      const reference = window.__shipQAPixelReferences?.get(options.compare);
      if (!reference || reference.pixels.length !== data.length) result.comparison = { valid: false };
      else {
        let changedPixels = 0, totalChannelDifference = 0, maxRGBDifference = 0, alphaChangedPixels = 0, opaqueChangedPixels = 0, leftChangedPixels = 0, rightChangedPixels = 0;
        for (let index = 0; index < data.length; index += 4) {
          let changed = false;
          for (let channel = 0; channel < 4; channel++) {
            const difference = Math.abs(data[index + channel] - reference.pixels[index + channel]);
            totalChannelDifference += difference; if (difference) changed = true;
            if (channel < 3) maxRGBDifference = Math.max(maxRGBDifference, difference);
          }
          if (data[index + 3] !== reference.pixels[index + 3]) alphaChangedPixels++;
          if (changed) {
            changedPixels++;
            if (data[index + 3] === 255 || reference.pixels[index + 3] === 255) opaqueChangedPixels++;
            if ((index / 4) % canvas.width < canvas.width / 2) leftChangedPixels++; else rightChangedPixels++;
          }
        }
        const a = [...reference.camera.position, ...reference.camera.quaternion, ...reference.camera.target, reference.camera.zoom];
        const b = [...result.camera.position, ...result.camera.quaternion, ...result.camera.target, result.camera.zoom];
        result.comparison = { valid: true, changedPixels, totalChannelDifference, maxRGBDifference, alphaChangedPixels, opaqueChangedPixels, leftChangedPixels, rightChangedPixels, cameraDelta: Math.max(...a.map((value, index) => Math.abs(value - b[index]))), matrixStateSame: matrixJSON === reference.matrixJSON, materialStateSame: materialJSON === reference.materialJSON };
      }
    }
    return result;
  }, options);
}
async function geometry(page) {
  return page.evaluate(() => {
    const viewer = window.__shipStates;
    const current = viewer.current;
    const root = current?.root || current?.group || current?.model || current?.object || current;
    if (!root || typeof root.traverse !== 'function') return { exposed: false };
    root.updateMatrixWorld(true);
    const result = { exposed: true, meshes: 0, visibleMeshes: 0, triangles: 0, finite: true, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    root.traverse(node => {
      if (!node.isMesh) return;
      result.meshes++;
      const p = node.geometry?.getAttribute('position');
      if (!p) { result.finite = false; return; }
      const triangles = (node.geometry.index?.count || p.count) / 3;
      result.triangles += triangles;
      result.finite = result.finite && node.matrixWorld.elements.every(Number.isFinite);
      let visible = node.visible;
      for (let parent = node.parent; parent && visible; parent = parent.parent) visible = visible && parent.visible;
      if (!visible) return;
      result.visibleMeshes++;
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      const bounds = node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld);
      ['x', 'y', 'z'].forEach((axis, index) => {
        result.min[index] = Math.min(result.min[index], bounds.min[axis]);
        result.max[index] = Math.max(result.max[index], bounds.max[axis]);
      });
    });
    result.finite = result.finite && [...result.min, ...result.max].every(Number.isFinite);
    result.size = result.max.map((value, index) => value - result.min[index]);
    return result;
  });
}
async function ghosting(page, mode) {
  await select(page, 'growth', 8, .6);
  await page.evaluate(mode => {
    const viewer = window.__shipStates;
    viewer.setMode(mode); viewer.controls.enableDamping = false;
    viewer.controls.autoRotateSpeed = 18;
    viewer.controls.autoRotate = true;
  }, mode);
  await frames(page, 120);
  await page.evaluate(() => { window.__shipStates.controls.autoRotate = false; });
  await frames(page, 4);
  const result = await page.evaluate(async mode => {
    const viewer = window.__shipStates;
    const capture = () => {
      const source = viewer.renderer.domElement, canvas = document.createElement('canvas');
      canvas.width = source.width; canvas.height = source.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(source, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    viewer.render();
    const cameraBefore = viewer.camera.position.toArray(), before = capture();
    const previousScissor = viewer.renderer.getScissorTest();
    viewer.renderer.setScissorTest(false);
    viewer.renderer.clear(true, true, true);
    viewer.renderer.setScissorTest(previousScissor);
    viewer.render();
    const after = capture();
    let changedPixels = 0, totalChannelDifference = 0;
    for (let index = 0; index < before.length; index += 4) {
      let changed = false;
      for (let channel = 0; channel < 4; channel++) {
        const difference = Math.abs(before[index + channel] - after[index + channel]);
        totalChannelDifference += difference; if (difference) changed = true;
      }
      if (changed) changedPixels++;
    }
    const cameraDelta = Math.max(...cameraBefore.map((value, index) => Math.abs(value - viewer.camera.position.toArray()[index])));
    return { mode, rotationFrames: 120, changedPixels, totalChannelDifference, cameraDelta, outlineAutoClear: viewer.outline.autoClear === true };
  }, mode);
  await page.screenshot({ path: path.join(reportDir, `ghosting-${mode}.png`) });
  return result;
}

async function controls(page) {
  await select(page, 'growth', 8, .5);
  await page.evaluate(() => { window.__shipStates.reset(); window.__shipStates.setPlaying(false); window.__shipStates.controls.enableDamping = false; });
  const canvas = page.locator('canvas').first();
  await canvas.scrollIntoViewIfNeeded();
  const rect = await canvas.boundingBox();
  assert(rect && rect.width > 0 && rect.height > 0, 'Main WebGL canvas has no visible dimensions');
  const start = { x: rect.x + rect.width * .75, y: rect.y + rect.height * .5 };
  const before = await page.evaluate(() => window.__shipStates.camera.position.toArray());
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + 85, start.y + 25, { steps: 10 }); await page.mouse.up();
  await frames(page, 4);
  const after = await page.evaluate(() => window.__shipStates.camera.position.toArray());
  assert(before.some((value, index) => Math.abs(value - after[index]) > 1e-6), 'Mouse drag did not rotate the actual camera');
  const zoomBefore = await page.evaluate(() => ({ zoom: window.__shipStates.camera.zoom, distance: window.__shipStates.camera.position.distanceTo(window.__shipStates.controls.target) }));
  await page.mouse.wheel(0, -180); await frames(page, 4);
  const zoomAfter = await page.evaluate(() => ({ zoom: window.__shipStates.camera.zoom, distance: window.__shipStates.camera.position.distanceTo(window.__shipStates.controls.target) }));
  assert(Math.abs(zoomAfter.zoom - zoomBefore.zoom) > 1e-6 || Math.abs(zoomAfter.distance - zoomBefore.distance) > 1e-6, 'Mouse wheel did not zoom the actual camera');
  await page.click('#fit'); await frames(page, 3);
  assert(await page.evaluate(() => window.__shipStates.camera.projectionMatrix.elements.every(Number.isFinite)), 'Fit produced an invalid camera');
  await page.click('#rotate'); await frames(page, 10);
  assert(await page.evaluate(() => window.__shipStates.controls.autoRotate), 'Auto rotation button did not start rotation');
  await page.click('#rotate');
  assert(await page.evaluate(() => !window.__shipStates.controls.autoRotate), 'Auto rotation button did not stop rotation');
  await page.click('#reset'); await frames(page, 3);
  assert(await page.evaluate(() => !window.__shipStates.controls.autoRotate), 'Reset did not stop auto rotation');
  const originalOutline = await page.isChecked('#outline');
  await page.setChecked('#outline', !originalOutline); await frames(page, 2);
  const outlineOff = await statistics(page);
  await page.setChecked('#outline', originalOutline); await frames(page, 2);
  const outlineOn = await statistics(page);
  assert(outlineOff.outlineEnabled !== outlineOn.outlineEnabled, 'Outline checkbox did not update renderer state');
  const backgroundBefore = (await statistics(page)).background;
  await page.click('#background'); await frames(page, 2);
  const backgroundAfter = (await statistics(page)).background;
  assert(backgroundBefore !== backgroundAfter, 'Background button did not change background');
  await page.click('#background');
  const categoryChoices = [];
  for (const category of Object.keys(expected)) {
    await page.locator(`[data-category="${category}"]`).first().click();
    await frames(page, 2);
    const stats = await statistics(page);
    assert(stats.category === category, 'Category button did not select ' + category);
    categoryChoices.push(category);
  }
  await page.locator('[data-card-category="damage"][data-card-stage="2"]').click();
  await frames(page, 2);
  const cardSelected = await statistics(page);
  assert(cardSelected.category === 'damage' && cardSelected.stage === 2, 'Stage thumbnail click did not select its appearance');
  await page.locator('#timeline').focus(); await page.locator('#timeline').press('Home');
  const timeBefore = Number(await page.inputValue('#timeline'));
  await page.locator('#timeline').press('ArrowRight');
  const timeAfter = Number(await page.inputValue('#timeline'));
  assert(timeAfter > timeBefore, 'Timeline keyboard interaction did not scrub');
  await page.selectOption('#speed', '1.5');
  assert(Number(await page.inputValue('#speed')) === 1.5, 'Playback speed UI did not change');
  await page.selectOption('#speed', '1');
  return { dragRotation: true, wheelZoom: true, zoomBefore, zoomAfter, fit: true, reset: true, autoRotate: true, outline: true, backgrounds: [backgroundBefore, backgroundAfter], categories: categoryChoices, stageCard: true, timeline: { timeBefore, timeAfter }, speed: true };
}

async function timeline(page) {
  await select(page, 'explosion', 0, 0);
  const first = await statistics(page);
  assert(Number.isFinite(first.duration) && first.duration > 0, 'Explosion has no actual duration');
  const duration = first.duration;
  const times = [0, duration * .22, duration * .55, duration * .85, duration];
  const forwards = [];
  for (const time of times) { await page.evaluate(time => window.__shipStates.setTime(time), time); await frames(page, 2); forwards.push({ time, ...(await pixels(page, { store: `explosion:${time}` })) }); }
  assert(new Set(forwards.map(item => item.hash)).size >= 4, 'Explosion timeline does not materially change the rendered ship/effect');
  const backwards = [];
  for (const point of [...forwards].reverse()) {
    await page.evaluate(time => window.__shipStates.setTime(time), point.time); await frames(page, 2);
    const actual = await pixels(page, { compare: `explosion:${point.time}` });
    if (actual.hash !== point.hash) {
      await page.screenshot({ path: path.join(reportDir, 'scrub-mismatch.png') });
      const subsequentFrames = [];
      for (let count = 0; count < 3; count++) { await frames(page, 1); subsequentFrames.push(await pixels(page, { compare: `explosion:${point.time}` })); }
      fs.writeFileSync(path.join(reportDir, 'scrub-mismatch.json'), JSON.stringify({ forwards, actual: { time: point.time, ...actual }, subsequentFrames, stats: await statistics(page) }, null, 2));
      throw new Error(`Reverse scrubbing is nondeterministic at ${point.time}: ${point.hash} != ${actual.hash}`);
    }
    backwards.push({ time: point.time, hash: actual.hash, camera: actual.camera, comparison: actual.comparison, matchesForward: true });
  }
  await page.uncheck('#loop');
  await page.selectOption('#speed', '1.5');
  await page.evaluate(time => window.__shipStates.setTime(time), Math.max(0, duration - .12));
  await page.click('#play');
  await page.waitForFunction(() => {
    const value = window.__shipStates.stats;
    const stats = typeof value === 'function' ? value.call(window.__shipStates) : value;
    return !stats.playing && Math.abs(stats.time - stats.duration) < .025;
  }, null, { timeout: 10000 });
  const stopped = await statistics(page);
  await page.click('#replay');
  await frames(page, 3);
  const replay = await statistics(page);
  assert(replay.time < duration * .5 && replay.playing, 'Replay did not restart explosion playback');
  await page.evaluate(() => window.__shipStates.setPlaying(false));
  await page.evaluate(() => { window.__shipQAPixelReferences?.clear(); });
  await page.check('#loop'); await page.selectOption('#speed', '1');
  return { duration, forwards, backwards, nonLoopStopsAtEnd: !stopped.playing && Math.abs(stopped.time - duration) < .025, replayRestarts: true };
}
async function normalTimeline(page) {
  await select(page, 'normal', 2, 0);
  const samples = [];
  for (const time of [0, 1.1, 3.2, 0]) {
    await page.evaluate(time => window.__shipStates.setTime(time), time); await frames(page, 2);
    const state = await page.evaluate(() => {
      const parts = window.__shipStates.current.parts;
      parts.GunBarrel.updateWorldMatrix(true, false);
      return { turretYaw: parts.TurretAssembly.rotation.y, barrelFollowsTurret: parts.GunBarrel.parent === parts.TurretAssembly, barrelMatrixFinite: parts.GunBarrel.matrixWorld.elements.every(Number.isFinite) };
    });
    samples.push({ time, ...state, pixels: await pixels(page) });
  }
  assert(samples.every(sample => sample.barrelFollowsTurret && sample.barrelMatrixFinite), 'Normal lookout barrel does not follow its actual turret');
  assert(Math.abs(samples[1].turretYaw - samples[0].turretYaw) > .05, 'Normal lookout turret does not actually scan');
  assert(samples[0].pixels.hash === samples[3].pixels.hash, 'Normal lookout reverse scrubbing is nondeterministic');
  return { samples, deterministic: true, turretAndBarrelLinked: true };
}
async function transport(page) {
  await select(page, 'explosion', 0, 0);
  const duration = (await statistics(page)).duration;
  await page.uncheck('#loop'); await page.selectOption('#speed', '1.5');
  await page.evaluate(time => window.__shipStates.setTime(time), duration - .15);
  await page.click('#play');
  await page.waitForFunction(() => { const s = window.__shipStates.stats; return !s.playing && Math.abs(s.time - s.duration) < .025; }, null, { timeout: 10000 });
  const stopped = await statistics(page);
  await page.click('#replay'); await frames(page, 3);
  const replay = await statistics(page);
  assert(replay.playing && replay.time < duration * .5, 'Replay did not restart the finished explosion');
  await page.evaluate(() => window.__shipStates.setPlaying(false));
  await page.check('#loop'); await page.selectOption('#speed', '1');
  return { duration, nonLoopStopsAtEnd: !stopped.playing && Math.abs(stopped.time - duration) < .025, replayRestarts: true };
}
async function cropGuard(page, allowEmptyCurrent = false) {
  return page.evaluate(allowEmptyCurrent => {
    const v = window.__shipStates; v.render();
    const source = v.renderer.domElement, c = document.createElement('canvas'); c.width = source.width; c.height = source.height;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const split = Math.floor(c.width / 2), panes = [];
    for (let side = 0; side < 2; side++) {
      const start = side ? split : 0, end = side ? c.width : split, width = end - start;
      let minX = width, minY = c.height, maxX = -1, maxY = -1, pixels = 0;
      for (let y = 0; y < c.height; y++) for (let x = start; x < end; x++) if (data[(y * c.width + x) * 4 + 3] > 8) { pixels++; minX = Math.min(minX, x - start); maxX = Math.max(maxX, x - start); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      const emptyAllowed = side === 1 && allowEmptyCurrent;
      const margin = pixels ? Math.min(minX, minY, width - 1 - maxX, c.height - 1 - maxY) : null;
      panes.push({ side: side ? 'current' : 'baseline', width, height: c.height, pixels, bounds: pixels ? [minX, minY, maxX, maxY] : null, margin, passed: pixels ? margin >= 2 : emptyAllowed });
    }
    const s = v.stats;
    return { category: s.category, stage: s.stage, time: s.time, mode: s.mode, viewport: innerWidth, alphaThreshold: 8, panes, passed: panes.every(p => p.passed) };
  }, allowEmptyCurrent);
}
async function thumbnailCropGuards(page) {
  return page.locator('.stage-card img').evaluateAll(images => images.map(image => {
    const c = document.createElement('canvas'); c.width = image.naturalWidth; c.height = image.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width, minY = c.height, maxX = -1, maxY = -1, pixels = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3] > 8) { pixels++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const margin = pixels ? Math.min(minX, minY, c.width - 1 - maxX, c.height - 1 - maxY) : null;
    return { category: image.closest('.stage-card').dataset.cardCategory, stage: Number(image.closest('.stage-card').dataset.cardStage), width: c.width, height: c.height, pixels, bounds: pixels ? [minX, minY, maxX, maxY] : null, margin, alphaThreshold: 8, passed: pixels > 20 && margin >= 1 };
  }));
}
async function focusedTimeline(page, mode) {
  await select(page, 'explosion', 0, 0); await page.evaluate(mode => window.__shipStates.setMode(mode), mode);
  const duration = (await statistics(page)).duration, times = [0, duration * .22, duration * .55, duration * .85, duration];
  const forwards = [], backwards = [];
  for (const time of times) {
    await page.evaluate(time => window.__shipStates.setTime(time), time); await frames(page, 2);
    forwards.push({ time, pixels: await pixels(page, { store: `${mode}:${time}` }), crop: await cropGuard(page, time === duration) });
  }
  for (const reference of [...forwards].reverse()) {
    await page.evaluate(time => window.__shipStates.setTime(time), reference.time); await frames(page, 2);
    const sample = await pixels(page, { compare: `${mode}:${reference.time}` });
    backwards.push({ time: reference.time, pixels: sample, exactRasterPassed: sample.hash === reference.pixels.hash, animationStatePassed: sample.comparison?.valid && sample.comparison.matrixStateSame && sample.comparison.materialStateSame && sample.comparison.cameraDelta === 0 });
  }
  await page.evaluate(() => window.__shipQAPixelReferences?.clear());
  return { mode, forwards, backwards, exactRasterPassed: backwards.every(point => point.exactRasterPassed), animationStatePassed: backwards.every(point => point.animationStatePassed), cropGuardsPassed: forwards.every(point => point.crop.passed), pixelTolerancesUsedForPass: false };
}
async function staticRasterDiagnostic(page, mode) {
  await select(page, 'explosion', 0, 3.4); await page.evaluate(mode => window.__shipStates.setMode(mode), mode); await frames(page, 2);
  return page.evaluate(mode => {
    const viewer = window.__shipStates, source = viewer.renderer.domElement;
    const hash = data => { let value = 2166136261; for (let i = 0; i < data.length; i++) { value ^= typeof data === 'string' ? data.charCodeAt(i) : data[i]; value = Math.imul(value, 16777619); } return (value >>> 0).toString(16); };
    const read = () => { const c = document.createElement('canvas'); c.width = source.width; c.height = source.height; const context = c.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0); return context.getImageData(0, 0, c.width, c.height).data; };
    const compare = (a, b) => { let changedPixels = 0, totalChannelDifference = 0, maxRGBDifference = 0, alphaChangedPixels = 0, opaqueChangedPixels = 0; for (let i = 0; i < a.length; i += 4) { let changed = false; for (let j = 0; j < 4; j++) { const d = Math.abs(a[i + j] - b[i + j]); totalChannelDifference += d; if (j < 3) maxRGBDifference = Math.max(maxRGBDifference, d); if (d) changed = true; } if (a[i + 3] !== b[i + 3]) alphaChangedPixels++; if (changed) { changedPixels++; if (a[i + 3] === 255 || b[i + 3] === 255) opaqueChangedPixels++; } } return { changedPixels, totalChannelDifference, maxRGBDifference, alphaChangedPixels, opaqueChangedPixels }; };
    const objectState = () => { const rows = []; viewer.current.root.updateMatrixWorld(true); viewer.current.root.traverse(n => { rows.push([n.name, n.visible, n.renderOrder, ...n.matrixWorld.elements]); if (n.isMesh) for (const m of (Array.isArray(n.material) ? n.material : [n.material])) rows.push([m.type, m.visible, m.opacity, m.transparent, m.depthWrite, m.depthTest, m.side, m.alphaTest, m.alphaHash, m.alphaToCoverage, m.dithering]); }); return JSON.stringify(rows); };
    const camera = JSON.stringify([viewer.camera.position.toArray(), viewer.camera.quaternion.toArray(), viewer.controls.target.toArray(), viewer.camera.zoom]), state = objectState();
    const first = read(), png1 = source.toDataURL('image/png'), png2 = source.toDataURL('image/png'), second = read();
    viewer.render(); const renderedOnce = read(), pngAfterRender = source.toDataURL('image/png');
    viewer.render(); const renderedTwice = read(), noRenderAfter = read();
    return { mode, time: viewer.stats.time, singleSynchronousEvaluation: true, poseOrUpdateCalls: 0, getImageData: { firstHash: hash(first), secondHash: hash(second), noRenderDifference: compare(first, second) }, toDataURL: { firstHash: hash(png1), secondHash: hash(png2), bytesAsDataURL: png1.length, sameFrameExact: png1 === png2, afterRenderHash: hash(pngAfterRender) }, renderOnly: { onceHash: hash(renderedOnce), twiceHash: hash(renderedTwice), onceDifference: compare(first, renderedOnce), twiceDifference: compare(first, renderedTwice), immediateNoRenderDifference: compare(renderedTwice, noRenderAfter) }, matrixMaterialStateSame: objectState() === state, cameraSame: JSON.stringify([viewer.camera.position.toArray(), viewer.camera.quaternion.toArray(), viewer.controls.target.toArray(), viewer.camera.zoom]) === camera };
  }, mode);
}
function parseGLB(bytes) {
  assert(bytes.subarray(0, 4).toString('ascii') === 'glTF', 'Export is not an actual GLB');
  assert(bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, 'GLB header version or length is invalid');
  assert(bytes.subarray(16, 20).toString('ascii') === 'JSON', 'GLB has no JSON chunk');
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8').trim());
}
async function downloads(page) {
  await select(page, 'growth', 8, .6);
  const glbPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.click('#export-glb'); const glbDownload = await glbPromise;
  assert(!await glbDownload.failure(), 'GLB download failed');
  const glbPath = path.join(reportDir, glbDownload.suggestedFilename()); await glbDownload.saveAs(glbPath);
  const bytes = fs.readFileSync(glbPath), glb = parseGLB(bytes);
  const sourceBytes = fs.readFileSync(repoPath('outputs/selected-airship-toon3d/airship.glb'));
  const source = parseGLB(sourceBytes);
  assert(sha256(bytes) !== sha256(sourceBytes), 'Growth GLB export simply downloads the unchanged original ship');
  assert(glb.meshes?.length > source.meshes.length, 'Growth GLB has no actual added geometry');
  assert(glb.nodes?.length > source.nodes.length, 'Growth GLB has no actual added scene nodes');
  const pngPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.click('#capture'); const pngDownload = await pngPromise;
  assert(!await pngDownload.failure(), 'PNG download failed');
  const pngPath = path.join(reportDir, pngDownload.suggestedFilename()); await pngDownload.saveAs(pngPath);
  const png = fs.readFileSync(pngPath);
  assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Screenshot download is not a PNG');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert(width > 300 && height > 200, 'Screenshot download has no usable dimensions');
  return {
    glb: { filename: glbDownload.suggestedFilename(), bytes: bytes.length, sha256: sha256(bytes), meshes: glb.meshes.length, nodes: glb.nodes.length, sourceMeshes: source.meshes.length, sourceNodes: source.nodes.length, containsAdditions: true },
    png: { filename: pngDownload.suggestedFilename(), bytes: png.length, width, height, sha256: sha256(png) },
  };
}

async function main() {
  assert(fs.existsSync(htmlPath), 'Build the ship appearance viewer before verification');
  const viewerBytes = fs.readFileSync(htmlPath);
  const browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, acceptDownloads: true });
  const errors = [], consoleErrors = [], failedRequests = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  const report = { viewer: relative(htmlPath), viewerBytes: viewerBytes.length, viewerSha256: sha256(viewerBytes), scope: finish ? 'finish' : followup ? 'followup' : 'full', expectedCategories: expected, expectedStages: countExpected, variants: [], modes: [], ghosting: [], responsive: [], failedChecks: [], errors, consoleErrors, failedRequests, passed: false };
  const check = async (name, run) => {
    try { return await run(); }
    catch (error) {
      report.failedChecks.push({ name, error: error.message });
      console.log(JSON.stringify({ check: name, passed: false, error: error.message }));
      await page.screenshot({ path: path.join(reportDir, `failure-${name}.png`) }).catch(() => {});
      return null;
    }
  };
  try {
    await page.goto(pathToFileURL(htmlPath).href);
    await page.waitForFunction(() => window.__shipStates?.ready, null, { timeout: 120000 });
    await frames(page, 3);
    const initial = await statistics(page);
    report.initialStats = initial;
    const items = await page.evaluate(() => window.__shipStates.items.map(item => ({ category: item.category, stage: item.stage })));
    assert(items.length === countExpected, `Expected ${countExpected} actual stages, found ${items.length}`);
    for (const [category, count] of Object.entries(expected)) assert(items.filter(item => item.category === category).length === count, category + ': incorrect stage count');
    assert(new Set(items.map(item => item.category + ':' + item.stage)).size === countExpected, 'Duplicate appearance stages');
    assert(await page.locator('.overview-card').count() === 6, 'The six category overview cards are missing');
    assert(await page.locator('.stage-card').count() === countExpected, 'The all-stage overview does not contain 31 cards');
    await page.waitForFunction(count => {
      const images = [...document.querySelectorAll('.stage-card img')];
      return images.length === count && images.every(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
    }, countExpected, { timeout: 120000 });
    report.thumbnails = await page.locator('.stage-card img').evaluateAll(images => images.map(image => ({ width: image.naturalWidth, height: image.naturalHeight, embedded: image.src.startsWith('data:') || image.src.startsWith('blob:') })));
    assert(report.thumbnails.every(image => image.embedded), 'A thumbnail depends on a nonembedded image');
    report.overviewImages = await page.locator('.overview-card img').evaluateAll(images => images.map(image => ({ width: image.naturalWidth, height: image.naturalHeight, ready: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 })));
    assert(report.overviewImages.length === 6 && report.overviewImages.every(image => image.ready), 'Six representative overview images were not actually regenerated');
    if (followup || finish) {
      const initialPath = path.join(outputDir, 'initial-verification.json');
      assert(fs.existsSync(initialPath), 'Followup requires the preserved initial 31-stage report');
      const initialBytes = fs.readFileSync(initialPath), initialReport = JSON.parse(initialBytes.toString('utf8'));
      assert(initialReport.variants?.length === countExpected && initialReport.variants.every(item => item.geometry?.finite && item.geometry.meshes > 0 && item.pixels.nonBackgroundPixels > 1000), 'Initial report does not contain the actual 31-stage geometry/render evidence');
      report.initialEvidence = { path: relative(initialPath), sha256: sha256(initialBytes), actualStages: initialReport.variants.length, priorPassed: initialReport.passed, priorFailure: initialReport.failure, reusedScope: '31 geometry/render samples; current followup does not repeat those 31 samples' };
    }
    const sampledItems = finish ? items.filter(item => ['normal', 'explosion'].includes(item.category) && representatives[item.category] === item.stage) : followup ? items.filter(item => representatives[item.category] === item.stage) : items;
    for (const item of sampledItems) {
      await select(page, item.category, item.stage, item.category === 'explosion' ? [0, .65, 1.3, 2.3, 3.8][item.stage] : .6);
      const stats = await statistics(page), actualGeometry = await geometry(page), actualPixels = await pixels(page);
      assert(stats.category === item.category && stats.stage === item.stage, 'Appearance API selected the wrong stage');
      assert(actualGeometry.exposed && actualGeometry.meshes > 0 && actualGeometry.triangles > 0 && actualGeometry.visibleMeshes > 0 && actualGeometry.finite, item.category + ':' + item.stage + ': invalid actual geometry');
      assert(actualPixels.nonBackgroundPixels > 1000 && actualPixels.opaquePixels > 0, item.category + ':' + item.stage + ': render contains no visible ship/effect');
      report.variants.push({ ...item, stats, geometry: actualGeometry, pixels: actualPixels, ...(finish ? { crop: await cropGuard(page) } : {}) });
      console.log(JSON.stringify({ category: item.category, stage: item.stage, meshes: actualGeometry.meshes, triangles: actualGeometry.triangles, pixels: actualPixels.nonBackgroundPixels }));
    }
    report.currentActualStages = sampledItems.length;
    if (!followup && !finish) {
      report.distinctAppearances = Object.fromEntries(Object.keys(expected).map(category => [category, new Set(report.variants.filter(item => item.category === category).map(item => item.pixels.hash)).size]));
      for (const [category, count] of Object.entries(expected)) assert(report.distinctAppearances[category] === count, category + ': some requested appearance stages render identically');
      assert(new Set(report.variants.filter(item => item.category === 'growth').map(item => item.geometry.meshes)).size >= 6, 'Growth stages do not add meaningful actual geometry');
    }
    if (finish) {
      const priorPath = path.join(outputDir, 'followup-verification.json'), priorBytes = fs.readFileSync(priorPath), prior = JSON.parse(priorBytes.toString('utf8'));
      assert(prior.controls && prior.normalTimeline?.deterministic && prior.ghosting?.length === 3 && prior.ghosting.every(g => g.changedPixels === 0 && g.outlineAutoClear) && prior.downloads?.glb.containsAdditions && prior.responsive?.length === 3 && prior.responsive.every(r => !r.overflow), 'Preserved followup lacks the required passed checks');
      report.importedEvidence = { path: relative(priorPath), sha256: sha256(priorBytes), viewerSha256: prior.viewerSha256, currentRunDidNotRepeat: ['controls', 'normal-timeline', 'three-mode 120-frame ghosting', 'growth GLB/PNG downloads', '390/768/1440 overflow'], preservedDownload: prior.downloads, priorPassed: prior.passed, priorFailure: prior.failure };
      report.thumbnailCropGuards = await thumbnailCropGuards(page);
      report.transport = await check('transport', () => transport(page));
      report.focusedModes = []; report.staticRasterDiagnostics = [];
      for (const mode of modes) {
        const result = await check('focused-' + mode, () => focusedTimeline(page, mode)); if (result) report.focusedModes.push(result);
        const diagnostic = await check('static-' + mode, () => staticRasterDiagnostic(page, mode)); if (diagnostic) report.staticRasterDiagnostics.push(diagnostic);
      }
      report.animationStatePassed = report.focusedModes.length === 3 && report.focusedModes.every(result => result.animationStatePassed);
      report.exactRasterPassed = report.focusedModes.length === 3 && report.focusedModes.every(result => result.exactRasterPassed);
      report.cropGuardsPassed = report.thumbnailCropGuards.every(result => result.passed) && report.variants.every(result => result.crop.passed) && report.focusedModes.every(result => result.cropGuardsPassed);
      await page.setViewportSize({ width: 390, height: 844 }); await frames(page, 5);
      report.mobileFraming = [];
      await select(page, 'normal', 2, .6); report.mobileFraming.push(await cropGuard(page));
      await select(page, 'explosion', 0, 0); await page.evaluate(() => window.__shipStates.setMode('handdrawn'));
      for (const time of [0, .88, 2.2, 3.4, 4]) { await page.evaluate(time => window.__shipStates.setTime(time), time); await frames(page, 2); report.mobileFraming.push(await cropGuard(page, time === 4)); }
      report.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth);
      report.cropGuardsPassed = report.cropGuardsPassed && report.mobileFraming.every(result => result.passed) && !report.mobileOverflow;
      await page.setViewportSize({ width: 1440, height: 1100 }); await page.evaluate(() => { window.__shipStates.select('normal', 0); window.__shipStates.setMode('handdrawn'); window.__shipStates.setTime(.6); scrollTo(0, 0); }); await frames(page, 4);
      const bottom = await page.locator('.overview-card').evaluateAll(cards => Math.max(...cards.map(card => card.getBoundingClientRect().bottom + scrollY)));
      await page.screenshot({ path: path.join(outputDir, 'overview.png'), clip: { x: 0, y: 0, width: 1440, height: Math.ceil(bottom + 24) } });
      report.externalRequests = requests.filter(url => /^https?:/i.test(url));
      if (!report.animationStatePassed) report.failedChecks.push({ name: 'animation-state', error: 'Actual matrices/materials/camera differ across reverse scrub' });
      if (!report.exactRasterPassed) report.failedChecks.push({ name: 'exact-raster', error: 'At least one exact RGBA comparison differs; no tolerance is counted as a pass' });
      if (!report.cropGuardsPassed) report.failedChecks.push({ name: 'crop-guards', error: 'Thumbnail or desktop/mobile content touches a canvas edge' });
      assert(!errors.length && !consoleErrors.length && !failedRequests.length && !report.externalRequests.length, 'Browser errors or external/failed requests occurred');
      assert(!report.failedChecks.length, 'Some focused checks failed: ' + report.failedChecks.map(item => item.name).join(', '));
      report.passed = true; return;
    }
    await select(page, 'growth', 8, .6);
    for (const mode of modes) {
      await page.click(`[data-mode="${mode}"]`); await frames(page, 3);
      const stats = await statistics(page), rendered = await pixels(page);
      assert(stats.mode === mode && rendered.nonBackgroundPixels > 1000, mode + ': mode control failed to render');
      report.modes.push({ mode, pixels: rendered });
    }
    assert(new Set(report.modes.map(item => item.pixels.hash)).size === 3, 'Display modes are visually identical');
    report.controls = await check('controls', () => controls(page));
    report.normalTimeline = await check('normal-timeline', () => normalTimeline(page));
    report.timeline = await check('timeline', () => timeline(page));
    for (const mode of modes) {
      await check('ghosting-' + mode, async () => {
        const result = await ghosting(page, mode); report.ghosting.push(result);
        assert(result.changedPixels === 0 && result.totalChannelDifference === 0 && result.cameraDelta < 1e-8 && result.outlineAutoClear, mode + ': ghosting or outline autoClear regression');
      });
    }
    report.downloads = await check('downloads', () => downloads(page));
    await page.evaluate(() => { const viewer = window.__shipStates; viewer.setMode('handdrawn'); viewer.reset(); viewer.setPlaying(false); viewer.setTime(.6); });
    await page.setViewportSize({ width: 1440, height: 1100 }); await page.evaluate(() => scrollTo(0, 0)); await frames(page, 4);
    const overviewBottom = await page.locator('.overview-card').evaluateAll(cards => Math.max(...cards.map(card => card.getBoundingClientRect().bottom + scrollY)));
    await page.screenshot({ path: path.join(outputDir, 'overview.png'), clip: { x: 0, y: 0, width: 1440, height: Math.ceil(overviewBottom + 24) } });
    await page.screenshot({ path: path.join(reportDir, 'desktop.png'), fullPage: true });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 }); await frames(page, 6);
      const responsive = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, canvasWidth: window.__shipStates.renderer.domElement.getBoundingClientRect().width, finiteCamera: window.__shipStates.camera.projectionMatrix.elements.every(Number.isFinite) }));
      responsive.overflow = responsive.documentWidth > responsive.viewport || responsive.bodyWidth > responsive.viewport;
      assert(!responsive.overflow && responsive.canvasWidth > 0 && responsive.finiteCamera, width + ': mobile overflow or invalid renderer');
      report.responsive.push(responsive);
      await page.screenshot({ path: path.join(reportDir, `responsive-${width}.png`), fullPage: true });
    }
    report.externalRequests = requests.filter(url => /^https?:/i.test(url));
    assert(!errors.length && !consoleErrors.length && !failedRequests.length && !report.externalRequests.length, 'Browser errors or external/failed requests occurred');
    assert(!report.failedChecks.length, 'Some browser checks failed: ' + report.failedChecks.map(item => item.name).join(', '));
    report.passed = true;
  } catch (error) {
    report.failure = error.message; report.externalRequests = requests.filter(url => /^https?:/i.test(url));
    await page.screenshot({ path: path.join(reportDir, 'failure.png'), fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    const serialized = JSON.stringify(report, null, 2);
    fs.writeFileSync(path.join(reportDir, 'verification.json'), serialized);
    fs.writeFileSync(path.join(outputDir, 'verification.json'), serialized);
    console.log(JSON.stringify({ passed: report.passed, stages: report.variants.length, ghosting: report.ghosting, responsive: report.responsive, errors, consoleErrors, failedRequests, externalRequests: report.externalRequests, failure: report.failure }, null, 2));
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
