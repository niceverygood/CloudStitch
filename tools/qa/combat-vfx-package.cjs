/* Fresh safe extraction and minimal independent browser checks of the final VFX ZIP. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { repoRoot, repoPath, launchBrowser } = require('../lib/runtime.cjs');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(repoRoot, file).split(path.sep).join('/');
const inside = (root, file) => { const rel = path.relative(root, file); return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };

function extractZIP(bytes, directory) {
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (bytes.readUInt32LE(index) === 0x06054b50 && index + 22 + bytes.readUInt16LE(index + 20) === bytes.length) { end = index; break; }
  }
  if (end < 0) throw new Error('ZIP end-of-central-directory record is missing.');
  const count = bytes.readUInt16LE(end + 10), centralSize = bytes.readUInt32LE(end + 12), centralOffset = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== count || count === 65535 || centralOffset + centralSize > end) throw new Error('Unsupported multidisk, ZIP64 or invalid archive.');
  const entries = [], names = new Set(); let cursor = centralOffset, totalSize = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP central directory.');
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32);
    const attributes = bytes.readUInt32LE(cursor + 38), offset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'), parts = name.split('/');
    if (!name || name.includes('\u0000') || name.includes('\\') || name.includes(':') || name.includes('\ufffd') || name.startsWith('/') || parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Unsafe ZIP path: ' + name);
    if (names.has(name)) throw new Error('Duplicate ZIP path: ' + name); names.add(name);
    if ((attributes >>> 16 & 0xf000) === 0xa000 || flags & 1 || ![0, 8].includes(method)) throw new Error('Unsupported symlink, encryption or compression: ' + name);
    totalSize += size;
    if (size > 256 * 1024 * 1024 || totalSize > 768 * 1024 * 1024) throw new Error('ZIP exceeds the expected deliverable size budget.');
    const target = path.resolve(directory, ...parts);
    if (!inside(directory, target)) throw new Error('ZIP path escapes its fresh extraction directory.');
    if (offset + 30 > bytes.length || bytes.readUInt32LE(offset) !== 0x04034b50) throw new Error('Invalid ZIP local header: ' + name);
    const localNameLength = bytes.readUInt16LE(offset + 26), localExtraLength = bytes.readUInt16LE(offset + 28);
    if (bytes.subarray(offset + 30, offset + 30 + localNameLength).toString('utf8') !== name) throw new Error('ZIP local and central paths disagree: ' + name);
    const start = offset + 30 + localNameLength + localExtraLength;
    if (start + compressedSize > centralOffset) throw new Error('ZIP data range is invalid: ' + name);
    const compressed = bytes.subarray(start, start + compressedSize), data = method === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed, { maxOutputLength: Math.max(size, 1) });
    if (data.length !== size) throw new Error('ZIP uncompressed size mismatch: ' + name);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data, { flag: 'wx' });
    entries.push({ path: name, bytes: size, sha256: sha256(data) }); cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== centralOffset + centralSize) throw new Error('ZIP central directory length mismatch.');
  return entries;
}

async function motionState(page, time) {
  return page.evaluate(time => {
    const viewer = window.__vfxWorkbench; viewer.setPlaying(false); viewer.setLoop(false); viewer.setTime(time); viewer.root.updateMatrixWorld(true);
    const values = []; let finite = true;
    viewer.root.traverse(node => { if (!node.isMesh) return; const matrix = node.matrixWorld.elements; finite &&= matrix.every(Number.isFinite); values.push(...matrix.map(value => Math.round(value * 1e6) / 1e6)); });
    return { time: window.__vfxStats.currentTime, finite, state: JSON.stringify(values) };
  }, time);
}
async function main() {
  const archive = repoPath(process.argv[2] || 'outputs/combat-vfx/Cloudstitch-combat-vfx.zip'), expectedSHA = process.argv[3];
  fs.mkdirSync(repoPath('work/verification'), { recursive: true });
  const directory = fs.mkdtempSync(path.join(repoPath('work/verification'), 'combat-vfx-package-unique-'));
  const extraction = path.join(directory, 'extracted'); fs.mkdirSync(extraction);
  const report = { sourceZIP: relative(archive), extractedDirectory: relative(extraction), pageErrors: [], externalRequests: [], outsideLocalRequests: [], passed: false }; let browser;
  try {
    const bytes = fs.readFileSync(archive); report.zipBytes = bytes.length; report.zipSHA256 = sha256(bytes);
    if (expectedSHA && report.zipSHA256 !== expectedSHA) throw new Error('This is not the final ZIP requested for verification.');
    const entries = extractZIP(bytes, extraction); report.entryCount = entries.length;
    const manifest = JSON.parse(fs.readFileSync(path.join(extraction, 'package-manifest.json'), 'utf8'));
    const records = manifest.entries || manifest.files;
    if (!Array.isArray(records)) throw new Error('Package manifest must contain an entries/files array.');
    const expected = new Map(records.map(record => [record.path, record]));
    if (entries.length !== expected.size + 1 || entries.some(entry => entry.path !== 'package-manifest.json' && (!expected.has(entry.path) || expected.get(entry.path).sha256 !== entry.sha256 || (expected.get(entry.path).bytes ?? expected.get(entry.path).size) !== entry.bytes))) throw new Error('Every extracted entry must match the manifest SHA-256 and bytes.');
    report.allEntryHashesMatch = true;
    const catalog = JSON.parse(fs.readFileSync(path.join(extraction, 'catalog.json'), 'utf8'));
    const sequences = JSON.parse(fs.readFileSync(path.join(extraction, 'sequence-catalog.json'), 'utf8'));
    if (catalog.items.length !== 48 || sequences.items.length !== 6) throw new Error('Expected the 48 standalone effects and six attack sequences.');
    if (fs.existsSync(path.resolve(extraction, '../weapon-modules')) || entries.some(entry => entry.path.startsWith('weapon-modules/'))) throw new Error('Independent test must not contain the external source weapon directory.');
    report.externalOriginalWeaponsAbsent = true;
    browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('request', request => {
      const url = request.url();
      if (/^https?:/i.test(url)) { const parsed = new URL(url); report.externalRequests.push(parsed.origin + parsed.pathname); }
      else if (url.startsWith('file:') && !inside(extraction, fileURLToPath(new URL(url)))) report.outsideLocalRequests.push(relative(fileURLToPath(new URL(url))));
    });
    await page.goto(pathToFileURL(path.join(extraction, 'gallery.html')).href + '?overview=1');
    const gallery = await page.evaluate(async () => {
      const cards = [...document.querySelectorAll('.card')], visible = cards.filter(card => !card.hidden);
      const images = await Promise.all(visible.map(async card => {
        const node = card.querySelector('.art img,.art svg image'), source = node?.getAttribute('href') || node?.getAttribute('src');
        if (!source) return { id: card.dataset.id, loaded: false };
        const image = new Image(); image.src = new URL(source, location.href).href;
        try { await image.decode(); return { id: card.dataset.id, loaded: image.naturalWidth > 0 && image.naturalHeight > 0 }; }
        catch { return { id: card.dataset.id, loaded: false }; }
      }));
      return { cardIds: cards.map(card => card.dataset.id), representativeIds: visible.map(card => card.dataset.id), images, links: [...document.querySelectorAll('a[href],img[src],svg image[href]')].map(node => { const raw = node.getAttribute('href') || node.getAttribute('src'); return { raw, url: new URL(raw, location.href).href }; }) };
    });
    if (gallery.cardIds.length !== 48 || catalog.items.some(item => !gallery.cardIds.includes(item.id)) || gallery.representativeIds.length !== 12 || gallery.images.some(image => !image.loaded)) throw new Error('Extracted gallery or twelve representative preview decodes failed.');
    for (const link of gallery.links) {
      const url = new URL(link.url); url.search = ''; url.hash = '';
      if (url.protocol !== 'file:') throw new Error('Gallery has a nonlocal relative link/resource.');
      const file = fileURLToPath(url);
      if (!inside(extraction, file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('Relative link is missing or escapes the package: ' + link.raw);
    }
    report.gallery = { cards: 48, representativeIds: gallery.representativeIds, images: gallery.images, relativeLinkCount: gallery.links.length, relativeLinksExist: true };
    await page.goto(pathToFileURL(path.join(extraction, 'index.html')).href);
    await page.waitForFunction(() => window.__vfxReady || window.__vfxStats?.error, null, { timeout: 60000 });
    await page.waitForTimeout(650);
    const shortPreview = await page.evaluate(() => ({ id: window.__vfxStats.selectedId, playing: window.__vfxStats.playing, loop: window.__vfxStats.loop, loopChecked: document.getElementById('loop').checked, duration: window.__vfxStats.duration }));
    if (shortPreview.id !== 'machine-gun-muzzle' || !shortPreview.playing || !shortPreview.loop || !shortPreview.loopChecked) throw new Error('Default short flash must still repeat after 0.6 seconds.');
    await page.evaluate(() => { const viewer = window.__vfxWorkbench; viewer.setLoop(false); viewer.setTime(0); viewer.setPlaying(true); });
    await page.waitForFunction(() => !window.__vfxStats.playing && Math.abs(window.__vfxStats.currentTime - window.__vfxStats.duration) < 1e-6, null, { timeout: 5000 });
    const stopped = await page.evaluate(() => ({ playing: window.__vfxStats.playing, loop: window.__vfxStats.loop, time: window.__vfxStats.currentTime, duration: window.__vfxStats.duration }));
    const exactLast = await page.evaluate(() => { const viewer = window.__vfxWorkbench; viewer.setTime(window.__vfxStats.duration); return { time: window.__vfxStats.currentTime, mixerTime: viewer.mixer.time, duration: window.__vfxStats.duration, playing: window.__vfxStats.playing }; });
    if (stopped.playing || stopped.loop || Math.abs(stopped.time - stopped.duration) > 1e-6 || exactLast.playing || Math.abs(exactLast.time - exactLast.duration) > 1e-6 || Math.abs(exactLast.mixerTime - exactLast.duration) > 1e-6) throw new Error('Finite flash must stop on its exact last GLB frame without wrapping.');
    report.defaultShortPreview = { ...shortPreview, checkedAfterSeconds: .65, finiteStop: stopped, exactLastFrame: exactLast };
    await page.goto(pathToFileURL(path.join(extraction, 'index.html')).href + '?effect=repair-stitch');
    await page.waitForFunction(() => window.__vfxReady || window.__vfxStats?.error, null, { timeout: 60000 });
    const repair = await page.evaluate(() => { const stats = window.__vfxStats; return { selectedId: stats.selectedId, ready: stats.ready, triangles: stats.triangleCount, animationClipCount: stats.animationClipCount, animationTrackCount: stats.animationTrackCount, duration: stats.duration, sourceBytes: stats.sourceBytes }; });
    const repairItem = catalog.items.find(item => item.id === 'repair-stitch');
    if (!repair.ready || repair.selectedId !== repairItem.id || repair.triangles !== repairItem.triangles || !repair.animationClipCount || !repair.animationTrackCount || repair.sourceBytes !== fs.statSync(path.join(extraction, repairItem.model)).size) throw new Error('Extracted repair GLB/clip readiness failed.');
    const first = await motionState(page, repair.duration * .2), second = await motionState(page, repair.duration * .7);
    if (!first.finite || !second.finite || first.state === second.state) throw new Error('Extracted repair GLB animation does not change finite transforms.');
    report.repair = { ...repair, finiteMotionChanged: true, sampleTimes: [first.time, second.time] };
    await page.goto(pathToFileURL(path.join(extraction, 'attack-sequences.html')).href + '?effect=06-flamethrower');
    await page.waitForFunction(() => window.__vfxReady || window.__vfxStats?.error, null, { timeout: 60000 });
    const attack = await page.evaluate(() => { const stats = window.__vfxStats; return { selectedId: stats.selectedId, ready: stats.ready, triangles: stats.triangleCount, texturesReady: stats.texturesReady, textures: stats.textures, animationClipCount: stats.animationClipCount, animationTrackCount: stats.animationTrackCount, sourceBytes: stats.sourceBytes }; });
    const attackItem = sequences.items.find(item => item.id === '06-flamethrower');
    if (!attack.ready || attack.selectedId !== attackItem.id || attack.triangles !== attackItem.triangles || !attack.texturesReady || !attack.textures.some(texture => texture.ready && texture.width === 2048 && texture.height === 2048) || !attack.animationClipCount || !attack.animationTrackCount || attack.sourceBytes !== fs.statSync(path.join(extraction, attackItem.model)).size) throw new Error('Extracted attack sequence needs its actual embedded 2K weapon texture and clip.');
    report.attack = attack;
    if (report.pageErrors.length || report.externalRequests.length || report.outsideLocalRequests.length) throw new Error('Packaged HTML has an error or relies on network/files outside the extracted ZIP.');
    report.passed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, entryCount: report.entryCount, zipSHA256: report.zipSHA256, summary: relative(path.join(directory, 'summary.json')), failure: report.failure || null }, null, 2));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
