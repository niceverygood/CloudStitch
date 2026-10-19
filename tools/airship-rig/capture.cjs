/* Capture real rendered motion. Does not edit or regenerate the original art. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { repoPath, launchBrowser } = require('../lib/runtime.cjs');

(async () => {
  const output = repoPath('outputs/airship-rig-v1');
  const browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(output, 'viewer.html')).href);
    await page.waitForFunction(() => window.__rigReady === true, null, { timeout: 45000 });
    const shots = [
      ['preview-handdrawn.png', 'FloatIdle', 2, false],
      ['preview-rig.png', 'BankTurn', 2, true],
      ['preview-winch.png', 'WinchCycle', 6, false],
    ];
    for (const [file, profile, time, skeleton] of shots) {
      await page.evaluate(({ profile, time }) => {
        const v = window.__rigViewer; v.setPlaying(false); v.setProfile(profile); v.setTime(time); v.reset();
      }, { profile, time });
      await page.locator('#skeleton').setChecked(skeleton);
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(output, file), fullPage: true });
    }
    if (!process.argv.includes('--video')) { console.log(JSON.stringify({ screenshots: shots.map(s => s[0]) })); return; }
    await page.locator('#skeleton').uncheck();
    const video = await page.evaluate(async () => {
      const v = window.__rigViewer;
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const context = canvas.getContext('2d');
      const stream = canvas.captureStream(30);
      const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('No WebM recorder available.');
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3000000 });
      const chunks = []; recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      let active = true, label = '';
      const draw = () => {
        if (!active) return;
        context.fillStyle = '#f4f1e6'; context.fillRect(0, 0, canvas.width, canvas.height);
        const source = v.renderer.domElement;
        const factor = Math.min(canvas.width / source.width, (canvas.height - 50) / source.height);
        const w = source.width * factor, h = source.height * factor;
        context.drawImage(source, (canvas.width - w) / 2, (canvas.height - h) / 2 + 22, w, h);
        context.fillStyle = '#315d59'; context.font = '600 24px "Apple SD Gothic Neo",sans-serif';
        context.fillText('Cloudstitch · 귀환호', 30, 42);
        context.fillStyle = '#718677'; context.font = '16px "Apple SD Gothic Neo",sans-serif';
        context.fillText(label, 30, 70);
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw); recorder.start();
      const segments = [
        ['FloatIdle', 0, 4000, '고요한 부유 · 느린 선체와 지연되는 갈고리'],
        ['Cruise', 0, 3000, '순항 · 프로펠러 속도와 가벼운 전진 자세'],
        ['BankTurn', 0, 5000, '선회 · 관성에 따라 기울고 따라오는 장치'],
        ['GustRecovery', 1, 6000, '돌풍 · 충격 이후 흔들림이 줄어드는 회복'],
        ['TurretScan', 0, 4000, '조준 · 부드럽게 감속하는 포탑'],
        ['WinchCycle', 3, 7000, '인양 · 케이블 연결과 갈고리 내림·회수'],
        ['FireBurst', 1.8, 4000, '포격 · 빠른 후퇴와 느린 복귀'],
      ];
      for (const [profile, time, milliseconds, title] of segments) {
        v.setPlaying(false); v.setProfile(profile); v.setTime(time); v.setSpeed(1); v.reset();
        label = title; v.setPlaying(true);
        await new Promise(resolve => setTimeout(resolve, milliseconds));
      }
      v.setPlaying(false);
      await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
      active = false; stream.getTracks().forEach(track => track.stop());
      const data = new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer());
      let text = ''; for (let i = 0; i < data.length; i += 32768) text += String.fromCharCode(...data.subarray(i, i + 32768));
      return btoa(text);
    });
    fs.writeFileSync(path.join(output, 'motion-preview.webm'), Buffer.from(video, 'base64'));
    console.log(JSON.stringify({ screenshots: shots.map(s => s[0]), video: 'motion-preview.webm', videoBytes: fs.statSync(path.join(output, 'motion-preview.webm')).size, source: 'Actual WebGL animation, 33-second montage at normal playback speed.' }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
