/* Extract a fresh ZIP safely, then verify that its gallery and embedded 3D viewer
 * work without the source repository's ship/model files. No files are deleted. */
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
  // This packager produces a standard single-volume, non-ZIP64 archive. Parse
  // its central directory rather than invoking a shell or trusting ZIP paths.
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (bytes.readUInt32LE(index) === 0x06054b50 && index + 22 + bytes.readUInt16LE(index + 20) === bytes.length) { end = index; break; }
  }
  if (end < 0) throw new Error('ZIP end-of-central-directory record is missing.');
  const count = bytes.readUInt16LE(end + 10), centralSize = bytes.readUInt32LE(end + 12), centralOffset = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== count || count === 65535 || centralOffset + centralSize > end) throw new Error('Unsupported multidisk, ZIP64 or invalid archive.');
  const entries = [], names = new Set();
  let cursor = centralOffset, totalSize = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP central directory.');
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32);
    const attributes = bytes.readUInt32LE(cursor + 38), offset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    const parts = name.split('/');
    if (!name || name.includes('\u0000') || name.includes('\\') || name.includes(':') || name.includes('\ufffd') || name.startsWith('/') || parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Unsafe ZIP path: ' + name);
    if (names.has(name)) throw new Error('Duplicate ZIP path: ' + name);
    names.add(name);
    if ((attributes >>> 16 & 0xf000) === 0xa000 || flags & 1 || ![0, 8].includes(method)) throw new Error('Unsupported symlink, encryption or compression: ' + name);
    totalSize += size;
    if (size > 256 * 1024 * 1024 || totalSize > 768 * 1024 * 1024) throw new Error('ZIP exceeds the expected deliverable size budget.');
    const target = path.resolve(directory, ...parts);
    if (!inside(directory, target)) throw new Error('ZIP path escapes its fresh extraction directory.');
    if (offset + 30 > bytes.length || bytes.readUInt32LE(offset) !== 0x04034b50) throw new Error('Invalid ZIP local header: ' + name);
    const localNameLength = bytes.readUInt16LE(offset + 26), localExtraLength = bytes.readUInt16LE(offset + 28);
    const localName = bytes.subarray(offset + 30, offset + 30 + localNameLength).toString('utf8');
    if (localName !== name) throw new Error('ZIP local and central paths disagree: ' + name);
    const start = offset + 30 + localNameLength + localExtraLength;
    if (start + compressedSize > centralOffset) throw new Error('ZIP data range is invalid: ' + name);
    const compressed = bytes.subarray(start, start + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed, { maxOutputLength: Math.max(size, 1) });
    if (data.length !== size) throw new Error('ZIP uncompressed size mismatch: ' + name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data, { flag: 'wx' });
    entries.push({ path: name, bytes: size, sha256: sha256(data) });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== centralOffset + centralSize) throw new Error('ZIP central directory length mismatch.');
  return entries;
}

async function frames(page, count = 4) {
  await page.evaluate(count => new Promise(resolve => { const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }), count);
}
async function main() {
  const archive = repoPath(process.argv[2] || 'outputs/weapon-modules/Cloudstitch-weapons-6.zip');
  const expectedArchiveSHA = process.argv[3];
  const root = repoPath('work/verification');
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'weapon-package-unique-'));
  const extraction = path.join(directory, 'extracted'); fs.mkdirSync(extraction);
  const report = { sourceZIP: relative(archive), reportDirectory: relative(directory), extractedDirectory: relative(extraction), pageErrors: [], externalRequests: [], localRequestsOutsidePackage: [], passed: false };
  let browser;
  try {
    const bytes = fs.readFileSync(archive);
    report.zipBytes = bytes.length; report.zipSHA256 = sha256(bytes);
    if (expectedArchiveSHA && report.zipSHA256 !== expectedArchiveSHA) throw new Error('The ZIP is not the final archive requested for this check.');
    const entries = extractZIP(bytes, extraction);
    report.entryCount = entries.length;
    const manifest = JSON.parse(fs.readFileSync(path.join(extraction, 'package-manifest.json'), 'utf8'));
    const expected = new Map(manifest.entries.map(entry => [entry.path, entry]));
    if (entries.length !== expected.size + 1 || entries.some(entry => entry.path !== 'package-manifest.json' && (!expected.has(entry.path) || expected.get(entry.path).sha256 !== entry.sha256 || expected.get(entry.path).bytes !== entry.bytes))) throw new Error('Extracted file hashes do not match the package manifest.');
    report.extractedHashesMatch = true;
    const catalog = JSON.parse(fs.readFileSync(path.join(extraction, 'catalog.json'), 'utf8'));
    const completed = catalog.items.filter(item => item.status === 'completed_asset_prototype');
    if (completed.length !== 6) throw new Error('Package must contain six completed weapon prototypes.');
    const externalShip = path.resolve(extraction, catalog.selected_ship);
    if (fs.existsSync(externalShip)) throw new Error('The test directory unexpectedly contains the external source ship.');
    report.externalSourceShipAbsent = true;
    browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('request', request => {
      const url = request.url();
      if (/^https?:/i.test(url)) report.externalRequests.push(new URL(url).origin + new URL(url).pathname);
      else if (url.startsWith('file:') && !inside(extraction, fileURLToPath(new URL(url)))) report.localRequestsOutsidePackage.push(relative(fileURLToPath(new URL(url))));
    });
    await page.goto(pathToFileURL(path.join(extraction, 'gallery.html')).href);
    const gallery = await page.evaluate(async () => {
      const nodes = [...document.querySelectorAll('.art img,.art svg image')];
      const images = await Promise.all(nodes.map(async node => {
        const source = node.getAttribute('href') || node.getAttribute('src');
        const image = new Image(); image.src = new URL(source, location.href).href;
        try { await image.decode(); return { source, loaded: image.naturalWidth > 0 && image.naturalHeight > 0 }; }
        catch { return { source, loaded: false }; }
      }));
      return { cardIds: [...document.querySelectorAll('.card')].map(card => card.dataset.weaponId), svgCount: document.querySelectorAll('.art svg').length, images, links: [...document.querySelectorAll('a[href]')].map(link => ({ raw: link.getAttribute('href'), url: link.href })) };
    });
    if (gallery.cardIds.length !== 6 || gallery.svgCount !== 6 || gallery.images.length !== 6 || gallery.images.some(image => !image.loaded) || completed.some(item => !gallery.cardIds.includes(item.id))) throw new Error('Extracted gallery cards or SVG previews failed.');
    for (const link of gallery.links) {
      const url = new URL(link.url); url.search = ''; url.hash = '';
      if (url.protocol !== 'file:') throw new Error('Extracted gallery has a nonlocal link.');
      const file = fileURLToPath(url);
      if (!inside(extraction, file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('Extracted gallery target is missing or outside the package: ' + link.raw);
    }
    report.gallery = { cardIds: gallery.cardIds, svgCount: gallery.svgCount, images: gallery.images, relativeLinkCount: gallery.links.length, relativeLinksExist: true };
    await page.screenshot({ path: path.join(directory, 'extracted-gallery.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await frames(page);
    report.galleryMobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (report.galleryMobileOverflow) throw new Error('Extracted gallery overflows the mobile viewport.');
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.goto(pathToFileURL(path.join(extraction, 'index.html')).href + '?weapon=06-flamethrower');
    await page.waitForFunction(() => window.__weaponReady || window.__weaponStats?.error, null, { timeout: 60000 });
    const state = await page.evaluate(() => ({ selected: window.__weaponStats.selectedId, ready: window.__weaponStats.ready, triangleCount: window.__weaponStats.triangleCount, texturesReady: window.__weaponStats.texturesReady, sourceBytes: window.__weaponStats.sourceBytes, ship: window.__weaponStats.models.__ship, outlineAutoClear: window.__weaponWorkbench?.effect.autoClear === true }));
    if (!state.ready || state.selected !== '06-flamethrower' || state.triangleCount !== 3957 || !state.texturesReady || !state.ship?.texturesReady || state.ship.triangleCount !== 11026 || !state.outlineAutoClear) throw new Error('Extracted offline flamethrower/ship GLB readiness failed.');
    if (state.sourceBytes !== fs.statSync(path.join(extraction, '06-flamethrower/weapon.glb')).size) throw new Error('Embedded flamethrower bytes do not match its packaged GLB.');
    await page.check('#mounted'); await frames(page);
    const mounted = await page.evaluate(() => ({ mounted: window.__weaponStats.mounted, shipVisible: window.__weaponWorkbench.shipRoot?.visible, placementPreviewOnly: window.__weaponStats.placementPreviewOnly }));
    if (!mounted.mounted || !mounted.shipVisible || !mounted.placementPreviewOnly) throw new Error('Extracted embedded ship mounting view failed.');
    await page.screenshot({ path: path.join(directory, 'extracted-flamethrower-mounted.png'), fullPage: true });
    await page.uncheck('#mounted'); await frames(page);
    if (await page.evaluate(() => window.__weaponStats.mounted)) throw new Error('Extracted view did not return to standalone mode.');
    report.viewer = { ...state, mountedTransition: mounted, standaloneReturn: true };
    if (report.pageErrors.length || report.externalRequests.length || report.localRequestsOutsidePackage.length) throw new Error('Package relies on an external file/network request or has a page error.');
    report.passed = true;
  } catch (error) {
    report.failure = error.message;
    throw error;
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, entryCount: report.entryCount, zipSHA256: report.zipSHA256, summary: relative(path.join(directory, 'summary.json')), failure: report.failure || null }, null, 2));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
