/* Decode seven moments of the rendered montage, entirely in a local browser. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { repoPath, launchBrowser } = require('../lib/runtime.cjs');

(async () => {
  const bytes = fs.readFileSync(repoPath('outputs/airship-rig-v1/motion-preview.webm'));
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(pathToFileURL(repoPath('outputs/airship-rig-v1/viewer.html')).href);
    const result = await page.evaluate(async base64 => {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const video = document.createElement('video');
      // A same-origin Blob permits canvas readback even under file://.
      video.src = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' })); video.muted = true;
      document.body.append(video);
      await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = () => reject(new Error('Video initial decode failed')); });
      video.pause(); const frames = [];
      for (const time of [1, 6, 10, 16, 21, 26, 31]) {
        await new Promise((resolve, reject) => { video.addEventListener('seeked', resolve, { once: true }); video.addEventListener('error', () => reject(new Error('Video seek/decode failed')), { once: true }); video.currentTime = time; });
        const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
        const context = canvas.getContext('2d'); context.drawImage(video, 0, 0, 160, 90);
        const pixels = context.getImageData(0, 0, 160, 90).data;
        let hash = 0; const colors = new Set();
        for (let i = 0; i < pixels.length; i++) hash = (hash * 31 + pixels[i]) >>> 0;
        for (let i = 0; i < pixels.length; i += 4) colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
        frames.push({ time: video.currentTime, hash, ready: video.readyState, colors: colors.size });
      }
      return { width: video.videoWidth, height: video.videoHeight, duration: video.duration, decodedFrames: frames, error: video.error?.message || null };
    }, bytes.toString('base64'));
    result.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    result.passed = !result.error && result.width === 1280 && result.height === 720 && result.duration >= 32 && result.duration <= 36 && result.decodedFrames.every(f => f.ready >= 2 && f.colors > 16) && new Set(result.decodedFrames.map(f => f.hash)).size === 7;
    const output = repoPath('work/verification/airship-rig/video-decode.json');
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result)); if (!result.passed) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
