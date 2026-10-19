// Integration owner runs this once in the coordinated browser slot.
// This checks READY4 camera input only; it does not repeat the flight physics suite.
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, repoPath } = require('../lib/runtime.cjs');

const url = process.env.FLIGHT3D_URL || 'http://127.0.0.1:8860/outputs/flight3d-v1/index.html';
const output = path.resolve(repoPath(process.env.FLIGHT3D_QA_OUT || 'outputs/flight3d-ready4-browser-qa-v1'));
const EXPECTED_CHECKS = 20;
const angle = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const cleared = s => !s.grabbing && !s.camera.looking;
const sameView = (a, b) => Math.abs(angle(a.camera.freeYaw, b.camera.freeYaw)) < 0.00001 && Math.abs(a.camera.elevation - b.camera.elevation) < 0.00001;

async function main() {
  const checks = [], errors = [], harnessErrors = [], external = [], failed = [], samples = [];
  const omitted = ['Real browser-tab hiding was not exercised. The blur check dispatches a DOM window blur event and verifies its input cleanup path.'];
  fs.mkdirSync(output, { recursive: true });
  let browser;
  const check = (name, passed, detail) => {
    checks.push({ name, passed: !!passed, ...(detail === undefined ? {} : { detail }) });
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
      camera: __flight3d.renderer.stats(), heading: __flight3d.state.player.heading,
      shots: __flight3d.state.stats.shots, paused: __flight3d.state.paused,
      grabbing: document.getElementById('scene').classList.contains('is-grabbing'),
      cursor: getComputedStyle(document.getElementById('scene')).cursor,
      focused: document.activeElement.id,
    }));
    const reset = async () => { await page.locator('#reset-button').click(); await page.waitForTimeout(50); };
    const begin = async (button = 'left', x = 780, y = 500) => { await page.mouse.move(x, y); await page.mouse.down({ button }); };
    const registerPointer = () => page.evaluate(() => {
      window.__grabQaPointerId = null;
      document.getElementById('scene').addEventListener('pointerdown', e => { window.__grabQaPointerId = e.pointerId; }, { once: true });
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__flight3d?.ready, undefined, { timeout: 45000 });
    await page.locator('#start-button').click();
    const initial = await sample();
    check('six-real-models-and-perspective-camera', initial.camera.ships === 6 && initial.camera.projection === 'perspective' && initial.camera.outlineAutoClear, initial.camera);

    await begin();
    await page.waitForTimeout(500);
    const pending = await sample();
    check('left-button-held-still-does-not-fire', pending.shots === 0 && pending.grabbing && !pending.camera.looking && Math.abs(pending.camera.freeYaw) < 0.00001, pending);
    await page.mouse.move(960, 550, { steps: 6 });
    await page.waitForTimeout(70);
    const grabbed = await sample();
    check('left-grab-orbits-without-firing-or-turning-the-ship', grabbed.grabbing && grabbed.cursor === 'grabbing' && grabbed.camera.looking && Math.abs(grabbed.camera.freeYaw) > 0.5 && grabbed.camera.elevation > initial.camera.elevation + 0.1 && Math.abs(angle(grabbed.heading, initial.heading)) < 0.00001 && grabbed.shots === 0, grabbed);
    await page.screenshot({ path: path.join(output, 'preview-grab.png') });
    await page.mouse.up();
    await page.waitForTimeout(100);
    const released = await sample();
    check('left-grab-release-restores-cursor-without-click-shot', cleared(released) && released.cursor === 'grab' && released.shots === 0, released);

    await reset();
    await begin();
    await page.mouse.move(783, 502);
    await page.mouse.up();
    await page.waitForTimeout(120);
    const clicked = await sample();
    await page.waitForTimeout(400);
    const clickedLater = await sample();
    check('sub-six-pixel-jitter-click-fires-one-shot-without-continuing', clicked.shots === 1 && clickedLater.shots === 1 && cleared(clickedLater) && Math.abs(clicked.camera.freeYaw) < 0.00001, { clicked, clickedLater });

    const alternateButtons = [];
    for (const button of ['right', 'middle']) {
      await reset();
      await begin(button);
      await page.mouse.move(920, 540, { steps: 5 });
      const during = await sample();
      await page.mouse.up({ button });
      await page.waitForTimeout(70);
      const after = await sample();
      alternateButtons.push({ button, during, after, passed: during.camera.looking && during.grabbing && Math.abs(during.camera.freeYaw) > 0.4 && during.shots === 0 && cleared(after) && after.shots === 0 && Math.abs(angle(after.heading, Math.PI)) < 0.00001 });
    }
    check('right-and-middle-button-orbits-remain-fire-free', alternateButtons.every(item => item.passed), alternateButtons);

    await reset();
    await registerPointer();
    await begin();
    await page.mouse.move(900, 535, { steps: 4 });
    const header = await page.locator('#reset-button').boundingBox();
    await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2, { steps: 6 });
    const overHeader = await sample();
    const captured = await page.evaluate(() => document.getElementById('scene').hasPointerCapture(window.__grabQaPointerId));
    await page.mouse.up();
    await page.waitForTimeout(70);
    const headerReleased = await sample();
    await page.mouse.move(800, 520);
    await page.waitForTimeout(70);
    const returned = await sample();
    check('pointer-capture-over-header-releases-without-camera-or-fire-latch', captured && overHeader.camera.looking && overHeader.grabbing && overHeader.shots === 0 && cleared(headerReleased) && cleared(returned) && returned.shots === 0 && sameView(headerReleased, returned), { captured, overHeader, headerReleased, returned });

    await reset();
    await begin();
    await page.mouse.move(910, 540, { steps: 4 });
    await page.keyboard.press('Escape');
    const escaped = await sample();
    await page.mouse.up();
    await page.keyboard.press('Escape');
    const resumed = await sample();
    await page.mouse.move(810, 530);
    await page.waitForTimeout(100);
    const resumedLater = await sample();
    check('Escape-during-grab-clears-input-and-resumes-without-ghost-shot', escaped.paused && cleared(escaped) && escaped.shots === 0 && !resumedLater.paused && cleared(resumedLater) && resumedLater.shots === 0 && sameView(resumed, resumedLater), { escaped, resumed, resumedLater });

    await reset();
    await begin();
    await page.mouse.move(920, 550, { steps: 4 });
    await page.locator('#reset-button').focus();
    await page.keyboard.press('Enter');
    const resetHeld = await sample();
    await page.mouse.up();
    await page.waitForTimeout(120);
    const resetReleased = await sample();
    check('keyboard-reset-clears-held-grab-and-late-release-does-not-fire', cleared(resetHeld) && !resetHeld.paused && resetHeld.shots === 0 && Math.abs(resetHeld.camera.freeYaw) < 0.00001 && resetHeld.focused === 'scene' && cleared(resetReleased) && resetReleased.shots === 0, { resetHeld, resetReleased });

    await reset();
    await registerPointer();
    await begin();
    await page.mouse.move(910, 540, { steps: 4 });
    const cancellation = await page.evaluate(() => {
      const scene = document.getElementById('scene'), pointerId = window.__grabQaPointerId;
      scene.dispatchEvent(new PointerEvent('pointercancel', { pointerId, pointerType: 'mouse', bubbles: true, cancelable: true }));
      return { pointerId, captureRemaining: scene.hasPointerCapture(pointerId) };
    });
    const cancelled = await sample();
    await page.mouse.up();
    await page.waitForTimeout(100);
    const cancelledLater = await sample();
    check('DOM-pointercancel-releases-real-capture-without-late-click-shot', Number.isInteger(cancellation.pointerId) && !cancellation.captureRemaining && cleared(cancelled) && cancelled.shots === 0 && cleared(cancelledLater) && cancelledLater.shots === 0, { cancellation, cancelled, cancelledLater });

    await reset();
    await registerPointer();
    await begin();
    await page.mouse.move(910, 540, { steps: 4 });
    const captureRelease = await page.evaluate(() => {
      const scene = document.getElementById('scene'), pointerId = window.__grabQaPointerId;
      const hadCapture = scene.hasPointerCapture(pointerId);
      scene.releasePointerCapture(pointerId);
      return { pointerId, hadCapture };
    });
    // The next real pointer event flushes pending lostpointercapture dispatch.
    await page.mouse.move(911, 540);
    await page.waitForTimeout(70);
    const lost = await sample();
    await page.mouse.up();
    await page.waitForTimeout(100);
    const lostLater = await sample();
    check('real-capture-loss-clears-grab-without-late-click-shot', captureRelease.hadCapture && cleared(lost) && lost.shots === 0 && cleared(lostLater) && lostLater.shots === 0, { captureRelease, lost, lostLater });

    await reset();
    await begin();
    await page.mouse.down({ button: 'right' });
    // No explicit movement between button changes: Chromium's chord pointer events
    // must cancel the original left-button gesture when its buttons mask vanishes.
    await page.mouse.up({ button: 'left' });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(100);
    const chordNoMove = await sample();
    check('left-right-chord-left-released-first-without-motion-has-no-ghost-shot', cleared(chordNoMove) && chordNoMove.shots === 0, chordNoMove);

    await reset();
    await begin();
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(930, 550, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(100);
    const chordDrag = await sample();
    check('left-right-chord-right-released-first-does-not-latch-or-fire', cleared(chordDrag) && Math.abs(chordDrag.camera.freeYaw) > 0.4 && chordDrag.shots === 0, chordDrag);

    await reset();
    await begin();
    await page.mouse.move(910, 540, { steps: 4 });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const blurred = await sample();
    await page.mouse.up();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    const blurResumed = await sample();
    check('dispatched-blur-event-clears-grab-without-ghost-shot-after-resume', blurred.paused && cleared(blurred) && blurred.shots === 0 && !blurResumed.paused && cleared(blurResumed) && blurResumed.shots === 0, { blurred, blurResumed });

    await reset();
    await page.waitForTimeout(150);
    const target = await page.evaluate(() => __flight3d.renderer.projectPoint(__flight3d.state.targets.find(t => t.id === 'target-mid')));
    await page.mouse.move(target.x, target.y);
    await page.keyboard.down('KeyJ');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyJ');
    const jReleased = await sample();
    await page.waitForTimeout(800);
    const targetResult = await page.evaluate(() => ({ stats: structuredClone(__flight3d.state.stats), target: structuredClone(__flight3d.state.targets.find(t => t.id === 'target-mid')) }));
    const jLater = await sample();
    check('J-hold-hits-elevated-target-and-release-stops-firing', targetResult.stats.hits >= 3 && targetResult.target.defeated && targetResult.stats.shots >= 3 && jLater.shots === jReleased.shots, { targetResult, jReleased, jLater });

    await reset();
    await page.setViewportSize({ width: 390, height: 844 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await page.waitForTimeout(100);
    check('mobile-layout-has-no-overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight));
    const touch = (type, x, y, id = 1) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id, radiusX: 2, radiusY: 2, force: 1 }],
    });
    const touchBefore = await sample();
    await touch('touchStart', 190, 440);
    for (let step = 1; step <= 5; step++) await touch('touchMove', 190 + 22 * step, 440 + 10 * step);
    const touchDuring = await sample();
    await touch('touchEnd');
    await page.waitForTimeout(100);
    const touchAfter = await sample();
    check('CDP-touch-drag-orbits-and-releases-without-firing-or-steering', touchDuring.camera.looking && touchDuring.grabbing && Math.abs(angle(touchDuring.camera.freeYaw, touchBefore.camera.freeYaw)) > 0.4 && touchDuring.camera.elevation > touchBefore.camera.elevation + 0.1 && touchDuring.shots === 0 && Math.abs(angle(touchDuring.heading, touchBefore.heading)) < 0.00001 && cleared(touchAfter) && touchAfter.shots === 0, { touchBefore, touchDuring, touchAfter });

    await reset();
    const up = await page.locator('#up-button').boundingBox();
    const altitudeBefore = await page.evaluate(() => __flight3d.state.player.y);
    await touch('touchStart', up.x + up.width / 2, up.y + up.height / 2, 2);
    await page.waitForTimeout(750);
    await touch('touchEnd');
    const altitudeAfter = await page.evaluate(() => __flight3d.state.player.y);
    check('mobile-up-button-accepts-a-real-touch-hold', altitudeAfter > altitudeBefore + 3, { altitudeBefore, altitudeAfter });
    await page.screenshot({ path: path.join(output, 'preview-mobile.png') });

    await reset();
    const fire = await page.locator('#fire-button').boundingBox();
    await touch('touchStart', fire.x + fire.width / 2, fire.y + fire.height / 2, 3);
    await page.waitForTimeout(750);
    const buttonHeld = await sample();
    await touch('touchEnd');
    await page.waitForTimeout(350);
    const buttonReleased = await sample();
    check('screen-fire-button-touch-hold-fires-continuously-and-release-stops', buttonHeld.shots >= 3 && !buttonHeld.grabbing && buttonReleased.shots === buttonHeld.shots, { buttonHeld, buttonReleased });
    samples.push(grabbed, touchDuring, buttonReleased);
    await cdp.detach();

    check('page-errors-external-requests-and-failed-requests-all-zero', errors.length === 0 && external.length === 0 && failed.length === 0, { errors, external, failed });
  } catch (error) {
    harnessErrors.push(error.stack || error.message);
    console.error(error.message);
  } finally {
    if (browser) await browser.close();
  }
  const report = {
    version: 4, url, expectedChecks: EXPECTED_CHECKS,
    passed: checks.length === EXPECTED_CHECKS && checks.every(c => c.passed) && harnessErrors.length === 0,
    scope: 'READY4 short actual-browser input QA: grab camera, click/J/button fire separation, cancellation/capture/chords and mobile touch. DOM pointercancel and blur are explicitly injected event-path checks. Flight physics, human feel, real tab hiding and long-session performance are separate.',
    omitted, checks, samples, errors, harnessErrors, externalRequests: external, failedRequests: failed,
  };
  fs.writeFileSync(path.join(output, 'browser-verification.json'), JSON.stringify(report, null, 2) + '\n');
  if (!report.passed) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
