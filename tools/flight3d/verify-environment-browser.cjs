// Integration owner runs once in its coordinated browser slot; READY6 motion + environment.
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, repoPath } = require('../lib/runtime.cjs');
const url = process.env.FLIGHT3D_URL || 'http://127.0.0.1:8860/outputs/flight3d-v1/index.html';
const output = path.resolve(repoPath(process.env.FLIGHT3D_QA_OUT || 'outputs/flight3d-ready6-browser-qa-v1'));
const EXPECTED_CHECKS = 18;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

async function main() {
  const checks = [], errors = [], external = [], failed = [], harnessErrors = [];
  let browser, comparison, parallax;
  fs.mkdirSync(output, { recursive: true });
  const check = (name, passed, detail) => {
    checks.push({ name, passed: !!passed, detail });
    console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  };
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(10000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(url).origin) external.push(r.url()); });
    page.on('requestfailed', r => failed.push({ url: r.url(), reason: r.failure()?.errorText }));
    const sample = () => page.evaluate(() => ({
      camera: __flight3d.renderer.stats(), player: structuredClone(__flight3d.state.player),
      paused: __flight3d.state.paused, stats: structuredClone(__flight3d.state.stats),
    }));
    const reset = async () => { await page.locator('#reset-button').click(); await page.waitForTimeout(80); };
    const projections = () => page.evaluate(() => __flight3d.renderer.stats().environment.anchors.map(a => ({
      id: a.id, type: a.type, rest: a.rest, visible: a.visible,
      point: __flight3d.renderer.projectPoint({ x: a.rest[0], y: a.rest[1], z: a.rest[2] }),
    })));
    const toggle = async () => {
      await page.locator('#help-button').click();
      await page.locator('#environment-button').click();
      await page.locator('#help-button').click();
      await page.waitForTimeout(100);
    };
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__flight3d?.ready, undefined, { timeout: 45000 });
    await page.locator('#start-button').click();
    await page.waitForTimeout(120);
    const initial = await sample(), env = initial.camera.environment;
    check('six-real-ships-perspective-and-outline-autoclear', initial.camera.ships === 6 && initial.camera.projection === 'perspective' && initial.camera.outlineAutoClear, { ships: initial.camera.ships, projection: initial.camera.projection, outlineAutoClear: initial.camera.outlineAutoClear });
    check('rich-environment-exact-instance-counts', env.rich && same(env.counts, { clouds: 40, landmarks: 16, islands: 8, motes: 80, drafts: 12, dressing: 6 }), env.counts);
    const kinds = type => [...new Set(env.anchors.filter(a => a.type === type).map(a => a.kind))];
    const heights = env.anchors.filter(a => a.type === 'cloud').map(a => a.rest[1]);
    check('four-cloud-four-prop-six-island-kinds-and-altitude-layers', kinds('cloud').length === 4 && kinds('landmark').length === 4 && kinds('island').length === 6 && Math.min(...heights) < -8 && Math.max(...heights) > 58, { clouds: kinds('cloud'), props: kinds('landmark'), islands: kinds('island'), minY: Math.min(...heights), maxY: Math.max(...heights) });
    check('source-models-merged-into-bounded-render-meshes', env.models.prototypeCount >= 16 && env.models.sourceMeshes > env.models.renderMeshes && env.models.renderMeshes < 450 && env.models.triangles > 0, env.models);
    check('short-frame-drawcall-and-triangle-budget', initial.camera.drawCalls > 0 && initial.camera.drawCalls < 850 && initial.camera.triangles > 0 && initial.camera.triangles < 2000000, { drawCalls: initial.camera.drawCalls, triangles: initial.camera.triangles, caveat: 'Frame counters only; not an FPS or long-session guarantee.' });

    await page.waitForTimeout(650);
    const idle = await sample(), idleEnv = idle.camera.environment;
    check('idle-cloud-prop-seed-motion-preserves-physical-center', idleEnv.time > env.time && !same(env.anchors.filter(a => a.type === 'cloud').map(a => a.position), idleEnv.anchors.filter(a => a.type === 'cloud').map(a => a.position)) && !same(env.motion, idleEnv.motion) && !same(env.seeds, idleEnv.seeds) && distance([initial.player.x, initial.player.y, initial.player.z], [idle.player.x, idle.player.y, idle.player.z]) < 0.000001, { timeBefore: env.time, timeAfter: idleEnv.time, motionBefore: env.motion, motionAfter: idleEnv.motion, seedsBefore: env.seeds, seedsAfter: idleEnv.seeds });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const frozen = await sample();
    await page.waitForTimeout(500);
    const frozenLater = await sample();
    check('actual-Escape-freezes-environment-time-motion-and-seeds', frozen.paused && frozenLater.paused && same(frozen.camera.environment, frozenLater.camera.environment), { time: frozen.camera.environment.time, laterTime: frozenLater.camera.environment.time });

    // Screenshot-only DOM presentation override: real Escape controls the sim.
    // Visibility (not hidden/display) leaves the overlay's layout unchanged.
    const oldVisibility = await page.locator('#pause-screen').evaluate(e => { const old = e.style.visibility; e.style.visibility = 'hidden'; return old; });
    try {
      await toggle();
      const basic = await sample();
      const before = await page.screenshot({ path: path.join(output, 'preview-before.png') });
      await toggle();
      const rich = await sample();
      const after = await page.screenshot({ path: path.join(output, 'preview-after.png') });
      comparison = { basic: { rich: basic.camera.environment.rich, time: basic.camera.environment.time, position: basic.camera.position, target: basic.camera.target }, rich: { rich: rich.camera.environment.rich, time: rich.camera.environment.time, position: rich.camera.position, target: rich.camera.target }, screenshotsDiffer: !before.equals(after), ariaPressed: await page.locator('#environment-button').getAttribute('aria-pressed'), helpClosed: await page.locator('#help-panel').evaluate(e => e.hidden) };
      check('actual-UI-basic-rich-same-camera-same-time-comparison', !basic.camera.environment.rich && rich.camera.environment.rich && comparison.ariaPressed === 'true' && comparison.helpClosed && basic.camera.environment.time === rich.camera.environment.time && same(basic.player, rich.player) && distance(basic.camera.position, rich.camera.position) < 0.02 && distance(basic.camera.target, rich.camera.target) < 0.02 && comparison.screenshotsDiffer, comparison);
    } finally { await page.locator('#pause-screen').evaluate((e, value) => { e.style.visibility = value; }, oldVisibility); }
    await page.keyboard.press('Escape');
    await reset();
    await page.waitForTimeout(200);
    const moveBefore = await sample(), projectedBefore = await projections();
    await page.keyboard.down('KeyW'); await page.keyboard.down('KeyQ');
    await page.waitForTimeout(1200);
    await page.keyboard.up('KeyQ'); await page.keyboard.up('KeyW');
    const moveAfter = await sample(), projectedAfter = await projections();
    await page.screenshot({ path: path.join(output, 'preview-motion.png') });
    const rests = state => state.camera.environment.anchors.map(a => ({ id: a.id, rest: a.rest }));
    const horizontal = Math.hypot(moveAfter.player.x - moveBefore.player.x, moveAfter.player.z - moveBefore.player.z);
    check('actual-W-Q-translates-and-climbs-with-world-fixed-anchors', horizontal > 5 && moveAfter.player.y > moveBefore.player.y + 3 && same(rests(moveBefore), rests(moveAfter)), { before: moveBefore.player, after: moveAfter.player, horizontal, anchors: rests(moveAfter) });
    const visible = a => a.visible && a.point.depth > -1 && a.point.depth < 1 && a.point.x >= 0 && a.point.x <= 1440 && a.point.y >= 0 && a.point.y <= 900;
    const motions = projectedBefore.filter(visible).map(a => {
      const b = projectedAfter.find(value => value.id === a.id);
      return b && visible(b) ? { id: a.id, type: a.type, rest: a.rest, before: a.point, after: b.point, pixels: Math.hypot(b.point.x - a.point.x, b.point.y - a.point.y) } : null;
    }).filter(Boolean);
    const near = motions.filter(a => a.type === 'landmark'), far = motions.filter(a => a.type === 'island');
    const nearMean = mean(near.map(a => a.pixels)), farMean = mean(far.map(a => a.pixels));
    parallax = { near, far, nearMean, farMean, ratio: farMean > 0 ? nearMean / farMean : null, method: 'Fixed world rest points projected before/after actual W+Q; only centers visible in both frames. No camera/state mutation.' };
    check('visible-near-landmarks-parallax-exceeds-far-islands', near.length >= 2 && far.length >= 1 && farMean > 0.1 && nearMean > farMean * 1.3, parallax);

    await reset();
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => __flight3d.state.time >= 2);
    await page.keyboard.down('KeyD');
    const turnTime = (await sample()).camera.environment.time;
    await page.waitForFunction(t => __flight3d.state.time >= t + 1.5, turnTime);
    const banked = await sample();
    await page.keyboard.up('KeyD'); await page.keyboard.up('KeyW');
    await page.screenshot({ path: path.join(output, 'preview-bank.png') });
    check('actual-W-D-strong-bounded-bank', banked.player.attitude.roll < -0.30 && Math.abs(banked.player.attitude.roll) <= 0.46 && banked.stats.collisions === 0, { attitude: banked.player.attitude, yawRate: banked.player.yawRate });
    for (const [key, direction] of [['KeyQ', 1], ['KeyE', -1]]) {
      await reset(); await page.keyboard.down(key);
      await page.waitForFunction(d => __flight3d.state.player.attitude.heave * d < -0.25, direction);
      const loaded = await sample();
      await page.keyboard.up(key);
      await page.waitForFunction(d => __flight3d.state.player.attitude.heave * d > 0.25, direction);
      const released = await sample();
      check(`actual-${key}-load-rebound-and-vertical-inertia`, loaded.player.vy * direction > 0 && released.player.vy * direction > 0 && (released.player.y - loaded.player.y) * direction > 0, { loaded: loaded.player, released: released.player });
    }
    await reset();
    const grabBefore = await sample();
    await page.mouse.move(780, 500); await page.mouse.down();
    await page.mouse.move(960, 550, { steps: 6 });
    const grabbing = await sample();
    await page.mouse.up(); await page.waitForTimeout(70);
    const grabAfter = await sample();
    check('one-left-grab-orbits-with-zero-shots', Math.abs(grabbing.camera.freeYaw - grabBefore.camera.freeYaw) > 0.5 && grabbing.camera.elevation > grabBefore.camera.elevation + 0.1 && !grabAfter.camera.looking && grabAfter.stats.shots === 0, { before: grabBefore.camera.freeYaw, during: grabbing.camera.freeYaw, after: grabAfter.camera.freeYaw, shots: grabAfter.stats.shots });
    await reset();
    await page.waitForTimeout(150);
    const targetPoint = await page.evaluate(() => __flight3d.renderer.projectPoint(__flight3d.state.targets.find(t => t.id === 'target-mid')));
    await page.mouse.move(targetPoint.x, targetPoint.y); await page.keyboard.down('KeyJ');
    await page.waitForTimeout(1500); await page.keyboard.up('KeyJ');
    const jReleased = await sample();
    await page.waitForTimeout(800);
    const target = await page.evaluate(() => structuredClone(__flight3d.state.targets.find(t => t.id === 'target-mid'))), jLater = await sample();
    check('J-hold-still-hits-elevated-target-and-release-stops', jLater.stats.hits >= 3 && target.defeated && jLater.stats.shots === jReleased.stats.shots, { target, stats: jLater.stats });

    await reset(); await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    const mobileBefore = await sample(), up = await page.locator('#up-button').boundingBox();
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight);
    await page.mouse.move(up.x + up.width / 2, up.y + up.height / 2); await page.mouse.down();
    await page.waitForTimeout(1100); await page.mouse.up();
    const mobileUp = await sample();
    await page.mouse.move(190, 440); await page.mouse.down();
    await page.mouse.move(300, 490, { steps: 5 }); await page.mouse.up();
    const mobileGrab = await sample();
    await page.screenshot({ path: path.join(output, 'preview-mobile.png') });
    check('mobile-rich-no-overflow-actual-up-hold-and-grab', noOverflow && mobileUp.camera.environment.rich && mobileUp.player.y > mobileBefore.player.y + 3 && Math.abs(mobileGrab.camera.freeYaw - mobileUp.camera.freeYaw) > 0.4 && !mobileGrab.camera.looking && mobileGrab.stats.shots === 0, { noOverflow, altitudeBefore: mobileBefore.player.y, altitudeAfter: mobileUp.player.y, freeYaw: mobileGrab.camera.freeYaw, pointer: 'Actual mouse at mobile viewport; not a touch-device claim.' });
    await reset(); const resetOne = await sample();
    await reset(); const resetTwo = await sample();
    check('reset-rewinds-environment-without-resource-or-source-churn', resetTwo.camera.environment.time >= 0 && resetTwo.camera.environment.time < 0.4 && same(resetOne.camera.environment.models, resetTwo.camera.environment.models) && same(env.sourceIds, resetTwo.camera.environment.sourceIds) && same(resetOne.camera.memory, resetTwo.camera.memory) && same(env.anchors.map(a => a.rest), resetTwo.camera.environment.anchors.map(a => a.rest)), { time: resetTwo.camera.environment.time, firstMemory: resetOne.camera.memory, secondMemory: resetTwo.camera.memory, sourceIds: resetTwo.camera.environment.sourceIds, models: resetTwo.camera.environment.models });
    check('page-errors-external-and-failed-requests-zero', !errors.length && !external.length && !failed.length, { errors, external, failed });
  } catch (error) { harnessErrors.push(error.stack || error.message); console.error(error.message); }
  finally { if (browser) await browser.close(); }
  const report = {
    version: 6, url, expectedChecks: EXPECTED_CHECKS,
    passed: checks.length === EXPECTED_CHECKS && checks.every(c => c.passed) && !harnessErrors.length,
    scope: 'READY6 motion and previously pending environment QA. Actual keyboard/mouse; no sim/camera injection. Same-time scenery comparison hides pause overlay visibility only, then restores it. Mobile uses mouse at 390px, not touch certification.',
    limits: ['Human art/10x expressiveness approval remains separate.', 'No FPS guarantee, long-session resource soak, touch-device or full READY3/READY4 regression claim.'],
    checks, comparison, parallax, errors, externalRequests: external, failedRequests: failed, harnessErrors,
  };
  fs.writeFileSync(path.join(output, 'browser-verification.json'), JSON.stringify(report, null, 2) + '\n');
  if (!report.passed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
