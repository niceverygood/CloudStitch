/* Fresh safe extraction and minimal independent operation of the world ZIP.
 * node tools/qa/world-package.cjs [ZIP] [expectedSHA256]
 * Does not regenerate assets, repeat 103-model QA, or edit packaged originals.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { repoRoot, repoPath, launchBrowser } = require('../lib/runtime.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(repoRoot, file).split(path.sep).join('/');
const inside = (base, file) => { const value = path.relative(base, file); return value !== '..' && !value.startsWith('..' + path.sep) && !path.isAbsolute(value); };
const assert = (value, message) => { if (!value) throw new Error(message); };
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

function extractZIP(bytes, directory) {
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (bytes.readUInt32LE(index) === 0x06054b50 && index + 22 + bytes.readUInt16LE(index + 20) === bytes.length) { end = index; break; }
  }
  assert(end >= 0, 'ZIP end-of-central-directory record is missing.');
  const count = bytes.readUInt16LE(end + 10), centralSize = bytes.readUInt32LE(end + 12), centralOffset = bytes.readUInt32LE(end + 16);
  assert(!bytes.readUInt16LE(end + 4) && !bytes.readUInt16LE(end + 6) && bytes.readUInt16LE(end + 8) === count && count !== 65535 && centralOffset + centralSize <= end, 'Unsupported multidisk, ZIP64 or invalid archive.');
  const entries = [], names = new Set(); let cursor = centralOffset, totalSize = 0;
  for (let index = 0; index < count; index++) {
    assert(cursor + 46 <= bytes.length && bytes.readUInt32LE(cursor) === 0x02014b50, 'Invalid ZIP central directory.');
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10), compressedSize = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32), attributes = bytes.readUInt32LE(cursor + 38), offset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'), parts = name.split('/');
    assert(name && !name.includes('\u0000') && !name.includes('\\') && !name.includes(':') && !name.includes('\ufffd') && !name.startsWith('/') && !parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)), 'Unsafe ZIP path: ' + name);
    assert(!names.has(name.toLowerCase()), 'Duplicate or case-colliding ZIP path: ' + name); names.add(name.toLowerCase());
    assert((attributes >>> 16 & 0xf000) !== 0xa000 && !(flags & 1) && [0, 8].includes(method), 'Unsupported symlink, encryption or compression: ' + name);
    totalSize += size;
    assert(size <= 512 * 1024 * 1024 && totalSize <= 2 * 1024 * 1024 * 1024, 'ZIP exceeds the expected world-pack extraction budget.');
    const target = path.resolve(directory, ...parts); assert(inside(directory, target), 'ZIP path escapes its fresh extraction directory.');
    assert(offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50, 'Invalid ZIP local header: ' + name);
    const localNameLength = bytes.readUInt16LE(offset + 26), localExtraLength = bytes.readUInt16LE(offset + 28);
    assert(bytes.subarray(offset + 30, offset + 30 + localNameLength).toString('utf8') === name, 'ZIP local/central names disagree: ' + name);
    const start = offset + 30 + localNameLength + localExtraLength; assert(start + compressedSize <= centralOffset, 'Invalid ZIP data range: ' + name);
    const compressed = bytes.subarray(start, start + compressedSize), data = method === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed, { maxOutputLength: Math.max(size, 1) });
    assert(data.length === size, 'ZIP uncompressed size mismatch: ' + name);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data, { flag: 'wx' });
    entries.push({ path: name, bytes: size, sha256: hash(data) }); cursor += 46 + nameLength + extraLength + commentLength;
  }
  assert(cursor === centralOffset + centralSize, 'ZIP central directory length mismatch.');
  return entries;
}

function packFile(directory, name) {
  assert(typeof name === 'string' && name && !name.includes('\\') && !name.includes(':'), 'Invalid registered relative path.');
  const file = path.resolve(directory, name); assert(inside(directory, file) && fs.existsSync(file) && fs.statSync(file).isFile(), 'Registered file is missing/outside extracted pack: ' + name);
  return file;
}
function registeredBytes(directory, record) {
  const bytes = fs.readFileSync(packFile(directory, record.path));
  assert(bytes.length === record.bytes && hash(bytes) === record.sha256, 'Final registered byte hash mismatch: ' + record.path); return bytes;
}
function embeddedGLB(bytes, name) {
  assert(bytes.length > 20 && bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length && bytes.readUInt32LE(16) === 0x4e4f534a, 'Invalid packed GLB header: ' + name);
  const data = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  assert((data.meshes || []).length > 0, 'Packed GLB contains no meshes: ' + name);
  assert([...(data.images || []), ...(data.buffers || [])].every(resource => !resource.uri || resource.uri.startsWith('data:')), 'Packed GLB depends on an external URI: ' + name);
  return data;
}

async function inspectViewer(page, extraction, html, item, expectedCount) {
  await page.goto(pathToFileURL(path.join(extraction, html)).href + '?asset=' + encodeURIComponent(item.id));
  await page.waitForFunction(() => window.__worldReady || window.__worldStats?.error, null, { timeout: 90000 });
  const result = await page.evaluate(async () => {
    const w = window.__worldWorkbench, s = window.__worldStats; w.setAutoRotate(false); w.setPlaying(false); w.reset(); w.fit();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    let finite = true, meshes = 0; w.root.updateMatrixWorld(true); w.root.traverse(node => { if (node.isMesh) { meshes++; finite &&= node.matrixWorld.elements.every(Number.isFinite); } });
    const source = w.renderer.domElement, canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0); const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let visiblePixels = 0; for (let index = 0; index < pixels.length; index += 4) if (pixels[index + 3] && pixels[index] + pixels[index + 1] + pixels[index + 2]) visiblePixels++;
    const link = document.getElementById('download'), bytes = new Uint8Array(await (await fetch(link.href)).arrayBuffer()), digest = await crypto.subtle.digest('SHA-256', bytes);
    return { ready: s.ready, id: s.selectedId, kind: s.kind, triangles: s.triangleCount, meshes, finite,
      sourceBytes: s.sourceBytes, texturesReady: s.texturesReady, textures: s.textures, animationClipCount: s.animationClipCount,
      availableCount: w.availableItems.length, visiblePixels, outlineAutoClear: w.effect.autoClear,
      projectionFinite: w.camera.projectionMatrix.elements.every(Number.isFinite),
      download: { bytes: bytes.length, sha256: Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join(''), filename: link.download, urlType: link.href.split(':')[0] } };
  });
  assert(result.ready && result.id === item.id && result.triangles === item.triangles && result.meshes > 0 && result.finite && result.visiblePixels > 0 && result.projectionFinite && result.outlineAutoClear, 'Extracted viewer actual geometry/render readiness failed: ' + item.id);
  assert(result.availableCount === expectedCount && result.sourceBytes === item.bytes && result.texturesReady && result.textures.some(texture => texture.ready && texture.width === 2048 && texture.height === 2048), 'Extracted viewer actual catalog/embedded 2K texture failed: ' + item.id);
  assert(result.animationClipCount === 0, 'Static world prototype must not report fabricated animation.');
  assert(result.download.bytes === item.bytes && result.download.sha256 === item.sha256 && result.download.filename === item.id + '.glb' && result.download.urlType === 'blob', 'Embedded download differs from original registered GLB: ' + item.id);
  return result;
}

async function main() {
  const archive = repoPath(process.argv[2] || 'outputs/world-assets/Cloudstitch-world-assets.zip'), expectedSHA = process.argv[3];
  fs.mkdirSync(repoPath('work/verification'), { recursive: true });
  const directory = fs.mkdtempSync(path.join(repoPath('work/verification'), 'world-package-unique-')), extraction = path.join(directory, 'extracted'); fs.mkdirSync(extraction);
  const report = { sourceZIP: relative(archive), extractedDirectory: relative(extraction), pageErrors: [], consoleErrors: [], failedRequests: [], externalRequests: [], outsideLocalRequests: [], passed: false }; let browser;
  try {
    const bytes = fs.readFileSync(archive); report.zipBytes = bytes.length; report.zipSHA256 = hash(bytes);
    if (expectedSHA) assert(report.zipSHA256 === expectedSHA, 'This is not the final ZIP requested for verification.');
    const entries = extractZIP(bytes, extraction); report.entryCount = entries.length;
    const packageManifest = readJSON(packFile(extraction, 'package-manifest.json')), expected = new Map(packageManifest.entries.map(entry => [entry.path, entry]));
    assert(expected.size === packageManifest.entries.length && entries.length === expected.size + 1 && entries.every(entry => entry.path === 'package-manifest.json' || expected.has(entry.path) && expected.get(entry.path).bytes === entry.bytes && expected.get(entry.path).sha256 === entry.sha256), 'Every extracted ZIP entry must match its registered SHA-256 and bytes.');
    report.allEntryHashesMatch = true;
    const catalog = readJSON(packFile(extraction, 'catalog.json')), scenes = readJSON(packFile(extraction, 'scene-catalog.json')), finalManifest = readJSON(packFile(extraction, 'asset-manifest.json'));
    assert(catalog.items.length === 96 && scenes.items.length === 7 && finalManifest.records.length === 103, 'Expected 96 separate world assets and seven separate scene assemblies.');
    const registry = new Map([...catalog.items, ...scenes.items].map(item => [item.id, item])); assert(registry.size === 103, 'Catalog ids must be unique.');
    let originals = 0, repairs = 0, roofRepairs = 0, roofReviewImages = 0;
    for (const record of finalManifest.records) {
      const item = registry.get(record.id); assert(item && item.model === record.model.path && item.sha256 === record.model.sha256 && item.bytes === record.model.bytes, 'Packed catalog/final manifest mismatch: ' + record.id);
      embeddedGLB(registeredBytes(extraction, record.model), item.model);
      const manifest = JSON.parse(registeredBytes(extraction, record.manifest).toString('utf8'));
      assert(manifest.id === record.id && manifest.sha256 === item.sha256 && manifest.verification?.passed && manifest.standard_validator?.errors === 0 && manifest.standard_validator?.warnings === 0, 'Packed model manifest validation/hash mismatch: ' + record.id);
      registeredBytes(extraction, record.preview);
      if (record.preserved_original) {
        const original = registeredBytes(extraction, record.preserved_original); embeddedGLB(original, record.preserved_original.path);
        assert(manifest.source_sha256 === hash(original) && item.source_sha256 === hash(original) && manifest.original_source_preserved, 'Packed hero original provenance mismatch: ' + record.id);
        registeredBytes(extraction, record.reference); originals++;
      }
      if (record.normal_repair) {
        const log = JSON.parse(registeredBytes(extraction, record.normal_repair.log).toString('utf8'));
        assert(log.original_source.sha256 === record.preserved_original.sha256 && log.repaired_source.sha256 === record.normal_repair.repaired_sha256 && log.original_source_preserved && log.after.errors === 0, 'Packed repair log is stale: ' + record.id);
        for (const source of [log.original_source, log.repaired_source]) registeredBytes(extraction, { path: source.model, bytes: source.bytes, sha256: source.sha256 }); repairs++;
      }
      if (record.roof_repair) {
        const roof = record.roof_repair, log = JSON.parse(registeredBytes(extraction, roof.log).toString('utf8'));
        assert(log.original_source.sha256 === record.preserved_original.sha256 && log.base_normal_copy.sha256 === record.normal_repair.repaired_sha256 && log.repaired_source.sha256 === item.sha256 && log.original_source_preserved && log.base_normal_copy_preserved && log.after.errors === 0 && log.after.warnings === 0 && log.after.triangles === item.triangles, 'Packed roof derivative provenance mismatch: ' + record.id);
        for (const source of [log.original_source, log.base_normal_copy, log.repaired_source]) registeredBytes(extraction, { path: source.model, bytes: source.bytes, sha256: source.sha256 });
        registeredBytes(extraction, roof.review.page); registeredBytes(extraction, roof.review.comparison);
        assert(roof.review.images.length === 8, 'Each roof review must retain four before/after direction pairs.');
        for (const image of roof.review.images) registeredBytes(extraction, image);
        roofReviewImages += roof.review.images.length; roofRepairs++;
      }
    }
    assert(originals === 6, 'All six preserved hero originals must be independently hashed.');
    assert(repairs === 6 && roofRepairs === 2 && roofReviewImages === 16, 'Expected six normal-only copies and two separate registered roof derivatives with 16 review PNGs.');
    report.registeredModels = { assets: 96, scenes: 7, hashesChecked: 103, preservedOriginalsChecked: originals, normalRepairLogsChecked: repairs, roofRepairLogsChecked: roofRepairs, additionalRoofReviewPNGs: roofReviewImages };
    assert(!entries.some(entry => /(?:^|\/)(?:state\.json|meshy_output|node_modules|\.env)(?:\/|$)/i.test(entry.path)) && !entries.some(entry => entry.path.startsWith('selected-airship-toon3d/')), 'Package contains state/cache/secret data or unnecessarily depends on an external ship.');
    report.externalAirshipFileAbsent = !fs.existsSync(path.resolve(extraction, '../selected-airship-toon3d/airship.glb'));
    assert(report.externalAirshipFileAbsent, 'Fresh extraction unexpectedly has an external selected airship source.');
    browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => report.failedRequests.push({ url: request.url().split('?')[0], failure: request.failure()?.errorText }));
    page.on('request', request => {
      const url = request.url(); if (/^https?:/i.test(url)) { const parsed = new URL(url); report.externalRequests.push(parsed.origin + parsed.pathname); }
      else if (url.startsWith('file:') && !inside(extraction, fileURLToPath(new URL(url)))) report.outsideLocalRequests.push(relative(fileURLToPath(new URL(url))));
    });
    await page.goto(pathToFileURL(path.join(extraction, 'gallery.html')).href + '?overview=1');
    const gallery = await page.evaluate(async () => {
      const cards = [...document.querySelectorAll('.card')], representatives = cards.filter(card => !card.hidden);
      const images = await Promise.all(representatives.map(async card => { const node = card.querySelector('.art img,.art svg image'), source = node?.getAttribute('href') || node?.getAttribute('src'); if (!source) return { id: card.dataset.id, loaded: false }; const image = new Image(); image.src = new URL(source, location.href).href; try { await image.decode(); return { id: card.dataset.id, loaded: image.naturalWidth > 0 && image.naturalHeight > 0 }; } catch { return { id: card.dataset.id, loaded: false }; } }));
      return { assetIds: cards.filter(card => card.dataset.kind === 'asset').map(card => card.dataset.id), sceneIds: cards.filter(card => card.dataset.kind === 'scene').map(card => card.dataset.id), images,
        links: [...document.querySelectorAll('a[href],img[src],svg image[href]')].map(node => { const raw = node.getAttribute('href') || node.getAttribute('src'); return { raw, url: new URL(raw, location.href).href }; }) };
    });
    assert(gallery.assetIds.length === 96 && gallery.sceneIds.length === 7 && catalog.items.every(item => gallery.assetIds.includes(item.id)) && scenes.items.every(item => gallery.sceneIds.includes(item.id)), 'Extracted gallery does not contain all 96 assets and seven scenes.');
    assert(gallery.images.length === 13 && gallery.images.every(image => image.loaded), 'Extracted representative six hero / seven scene PNG decodes failed.');
    for (const link of gallery.links) {
      const url = new URL(link.url); url.search = ''; url.hash = ''; assert(url.protocol === 'file:', 'Nonlocal gallery link/resource: ' + link.raw);
      const file = fileURLToPath(url); assert(inside(extraction, file) && fs.existsSync(file) && fs.statSync(file).isFile(), 'Broken/outside package relative link: ' + link.raw);
    }
    report.gallery = { assetCards: 96, sceneCards: 7, representativeImages: gallery.images, relativeLinksChecked: gallery.links.length, brokenLinks: 0 };
    const roofReviewLinks = [];
    for (const record of finalManifest.records.filter(record => record.roof_repair)) {
      const html = fs.readFileSync(packFile(extraction, record.roof_repair.review.page.path), 'utf8');
      for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const url = new URL(match[1], pathToFileURL(packFile(extraction, record.roof_repair.review.page.path)).href); url.search = ''; url.hash = '';
        assert(url.protocol === 'file:' && inside(extraction, fileURLToPath(url)) && fs.existsSync(fileURLToPath(url)), 'Broken/outside roof review link: ' + match[1]); roofReviewLinks.push(match[1]);
      }
    }
    report.roofReviewRelativeLinks = { checked: roofReviewLinks.length, broken: 0 };
    const hero = catalog.items.find(item => item.id === 'harbor-inn'), scene = scenes.items.find(item => item.id === 'jonghang-harbor'); assert(hero && scene, 'Required independent viewer samples are missing.');
    report.assetViewer = await inspectViewer(page, extraction, 'index.html', hero, 96);
    report.sceneViewer = await inspectViewer(page, extraction, 'scenes.html', scene, 7);
    assert(!report.pageErrors.length && !report.consoleErrors.length && !report.failedRequests.length && !report.externalRequests.length && !report.outsideLocalRequests.length, 'Packaged HTML has an error or depends on network/files outside fresh extraction.');
    report.passed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, entryCount: report.entryCount, zipSHA256: report.zipSHA256, registeredModels: report.registeredModels, summary: relative(path.join(directory, 'summary.json')), failure: report.failure || null }, null, 2));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
