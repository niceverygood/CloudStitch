// Integration owner runs once in its coordinated browser slot; READY6 recovery: only failed/unrun checks, original 11 passes retained.
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, repoPath } = require('../lib/runtime.cjs');
const url = process.env.FLIGHT3D_URL || 'http://127.0.0.1:8860/outputs/flight3d-v1/index.html';
const output = path.resolve(repoPath(process.env.FLIGHT3D_QA_OUT || 'outputs/flight3d-ready6-recovery-qa-v1'));
const EXPECTED_CHECKS = 7;
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
    await reset();
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => __flight3d.state.time >= 2);
    await page.keyboard.down('KeyD');
    const turnTime = (await sample()).camera.environment.time;
    await page.waitForFunction(t => __flight3d.state.time >= t + 1.5, turnTime);
    const banked = await sample();
    await page.keyboard.up('KeyD'); await page.keyboard.up('KeyW');
    await page.screenshot({ path: path.join(output, 'preview-bank.png') });
    check('actual-W-D-strong-bounded-bank', Math.abs(banked.player.attitude.roll) > 0.30 && banked.player.attitude.roll * banked.player.yawRate < 0 && Math.abs(banked.player.attitude.roll) <= 0.46 && banked.stats.collisions === 0, { attitude: banked.player.attitude, yawRate: banked.player.yawRate });
    // Read-only rAF observation. Fixed 1.2s E press, then 4s release;
    // measure relative reversal and decay instead of an arbitrary absolute peak.
    const observe = seconds => page.evaluate(async seconds => {
      const start = __flight3d.state.time, samples = [];
      await new Promise((resolve, reject) => {
        const tick = () => {
          const s = __flight3d.state, p = s.player, a = p.attitude;
          if(s.paused || p.hp <= 0) return reject(new Error('observation interrupted'));
          samples.push({time:s.time, y:p.y, vy:p.vy, heave:a.heave, heaveVelocity:a.heaveVelocity});
          if(s.time >= start + seconds) resolve(); else requestAnimationFrame(tick);
        };tick();
      }); return samples;
    }, seconds);
    await reset(); await page.keyboard.down('KeyE');
    const pressed = await observe(1.2), loaded = await sample();
    await page.keyboard.up('KeyE');
    const releasedSamples = await observe(4), released = await sample();
    const loadedPeak = Math.max(...pressed.map(s => s.heave));
    const reversePeak = Math.min(...releasedSamples.map(s => s.heave));
    const releaseTime = releasedSamples[0].time;
    const settling = releasedSamples.filter(s => s.time >= releaseTime + 3);
    const settleEnvelope = Math.max(...settling.map(s => Math.abs(s.heave)));
    check('actual-E-fixed-press-relative-reversal-decay-and-inertia',
      loaded.player.vy < 0 && releasedSamples.some(s => s.time > releaseTime + 0.2 && s.vy < 0 && s.y < loaded.player.y)
      && loadedPeak > 0 && reversePeak < 0 && -reversePeak >= loadedPeak * 0.25
      && settleEnvelope < Math.max(loadedPeak, -reversePeak) * 0.85,
      { pressSeconds:1.2, releaseSeconds:4, loadedPeak, reversePeak, settleEnvelope, loaded:loaded.player, released:released.player, pressed, releasedSamples,
        definition:'Same reset buoyancy phase; downward thrust loads hull upward, release crosses equilibrium downward by >=25% of loaded peak, final-second envelope falls below85% of peak; real Y retains downward inertia. No sim mutation.' });
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
    version: '6-recovery-1', url, expectedChecks: EXPECTED_CHECKS,
    passed: checks.length === EXPECTED_CHECKS && checks.every(c => c.passed) && !harnessErrors.length,
    scope: 'READY6 seven failed/unrun checks only; original environment10 + Q1 passes are retained in prior raw report. Actual keyboard/mouse; no sim/camera injection. Same-time scenery comparison hides pause overlay visibility only, then restores it. Mobile uses mouse at 390px, not touch certification.',
    limits: ['Human art/10x expressiveness approval remains separate.', 'No FPS guarantee, long-session resource soak, touch-device or full READY3/READY4 regression claim.'],
    checks, comparison, parallax, errors, externalRequests: external, failedRequests: failed, harnessErrors,
  };
  fs.writeFileSync(path.join(output, 'browser-verification.json'), JSON.stringify(report, null, 2) + '\n');
  if (!report.passed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
