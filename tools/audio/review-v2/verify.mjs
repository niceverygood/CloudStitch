import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { strict as assert } from 'node:assert';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SHA256 = /^[0-9a-f]{64}$/i;
const PLAYABLE_STATUSES = new Set(['generated_unreviewed', 'existing_reused']);
const ALL_STATUSES = new Set([...PLAYABLE_STATUSES, 'failed', 'pending']);
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const normalize = name => name.split(path.sep).join('/');

function headerAt(buffer, offset) {
  if (offset + 4 > buffer.length || buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) return null;
  const bits = buffer.readUInt32BE(offset);
  const versionBits = (bits >>> 19) & 3;
  const layerBits = (bits >>> 17) & 3;
  const rateIndex = (bits >>> 12) & 15;
  const sampleIndex = (bits >>> 10) & 3;
  if (versionBits === 1 || layerBits !== 1 || rateIndex === 0 || rateIndex === 15 || sampleIndex === 3) return null;
  const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5;
  const sampleRate = [44100, 48000, 32000][sampleIndex] / (version === 1 ? 1 : version === 2 ? 2 : 4);
  const rates = version === 1 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const bitrateKbps = rates[rateIndex];
  const padding = (bits >>> 9) & 1;
  const channels = ((bits >>> 6) & 3) === 3 ? 1 : 2;
  const frameBytes = Math.floor((version === 1 ? 144000 : 72000) * bitrateKbps / sampleRate) + padding;
  return { version, layer: 3, sampleRate, channels, bitrateKbps, frameBytes, samples: version === 1 ? 1152 : 576, crcBytes: (bits & 0x10000) ? 0 : 2 };
}

/** Inspect compressed framing only. This is deliberately NOT an MP3 decoder or PCM/listening test. */
export function inspectMp3(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let start = 0, end = buffer.length, id3v2Bytes = 0, id3v1Bytes = 0;
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') {
    if (buffer.length < 10) throw new Error('Truncated ID3v2 header');
    const version = buffer[3];
    if (![2, 3, 4].includes(version)) throw new Error('Unsupported ID3v2 version');
    const sizeBytes = [...buffer.subarray(6, 10)];
    if (sizeBytes.some(byte => byte & 0x80)) throw new Error('Invalid ID3v2 synchsafe size');
    const tagSize = sizeBytes.reduce((value, byte) => value * 128 + byte, 0);
    start = 10 + tagSize + (version === 4 && (buffer[5] & 0x10) ? 10 : 0);
    if (start > buffer.length) throw new Error('ID3v2 extends beyond file');
    id3v2Bytes = start;
  }
  if (end - start >= 128 && buffer.subarray(end - 128, end - 125).toString('ascii') === 'TAG') {
    end -= 128; id3v1Bytes = 128;
  }
  const first = headerAt(buffer, start);
  if (!first) throw new Error('No valid MPEG Layer III frame at audio start');
  let offset = start, frameCount = 0, encodedSamples = 0, encodedSeconds = 0;
  const bitrates = new Set(), rates = new Set(), channels = new Set();
  while (offset < end) {
    const frame = headerAt(buffer, offset);
    if (!frame) throw new Error(`Invalid MPEG frame or trailing bytes at offset ${offset}`);
    if (offset + frame.frameBytes > end) throw new Error(`Truncated MPEG frame at offset ${offset}`);
    if (frame.version !== first.version || frame.sampleRate !== first.sampleRate || frame.channels !== first.channels) {
      throw new Error(`MPEG stream format changes at offset ${offset}`);
    }
    bitrates.add(frame.bitrateKbps); rates.add(frame.sampleRate); channels.add(frame.channels);
    frameCount++; encodedSamples += frame.samples; encodedSeconds += frame.samples / frame.sampleRate;
    offset += frame.frameBytes;
  }
  if (frameCount < 2) throw new Error('At least two complete MPEG frames are required');
  const sideInfoBytes = first.version === 1 ? (first.channels === 1 ? 17 : 32) : (first.channels === 1 ? 9 : 17);
  let xing = null;
  const markerOffset = start + 4 + first.crcBytes + sideInfoBytes;
  const marker = buffer.subarray(markerOffset, markerOffset + 4).toString('ascii');
  if ((marker === 'Xing' || marker === 'Info') && markerOffset + 8 <= start + first.frameBytes) {
    const flags = buffer.readUInt32BE(markerOffset + 4);
    let fieldOffset = markerOffset + 8;
    const take32 = () => { if (fieldOffset + 4 > start + first.frameBytes) throw new Error('Truncated Xing field'); const value = buffer.readUInt32BE(fieldOffset); fieldOffset += 4; return value; };
    const advertisedFrames = flags & 1 ? take32() : null;
    const advertisedBytes = flags & 2 ? take32() : null;
    if (flags & 4) fieldOffset += 100;
    if (flags & 8) fieldOffset += 4;
    if (fieldOffset > start + first.frameBytes) throw new Error('Truncated Xing table');
    xing = { marker, advertisedFrames, advertisedBytes };
    // Encoders vary on whether their Xing/Info frame is included in this number.
    if (advertisedFrames !== null && Math.abs(advertisedFrames - frameCount) > 1) throw new Error('Xing frame count disagrees with observed complete frames');
  }
  return {
    format: 'MPEG Layer III', version: first.version, sampleRate: first.sampleRate,
    channels: first.channels, frameCount, encodedSamples,
    encodedDurationSeconds: Number(encodedSeconds.toFixed(6)),
    bitrateKbps: [...bitrates].sort((a, b) => a - b), variableBitrate: bitrates.size > 1,
    audioBytes: end - start, id3v2Bytes, id3v1Bytes, xing,
    pcmDecoded: false,
    durationMeaning: 'Compressed frame duration includes encoder delay/padding and may include an Info/Xing frame; native decoded duration still requires browser QA.'
  };
}

function resolveInside(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || /^[a-z][a-z0-9+.-]*:/i.test(relative) || relative.includes('\\')) throw new Error('Path must be a local forward-slash relative path');
  const resolved = path.resolve(root, relative);
  const check = path.relative(root, resolved);
  if (check.startsWith(`..${path.sep}`) || check === '..' || path.isAbsolute(check)) throw new Error('Path escapes its root');
  return resolved;
}

function literalJsReferences(source, documentRoot) {
  const imported = [...source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g)].map(m => ({ ref: m[1] }));
  // fetch() resolves a relative URL against the HTML document, not the module URL.
  const fetched = [...source.matchAll(/\bfetch\s*\(\s*["']([^"']+)["']/g)].map(m => ({ ref: m[1], base: documentRoot }));
  return [...imported, ...fetched];
}

export function selfTest() {
  const checks = [];
  const test = (name, fn) => { fn(); checks.push(name); };
  function frames({ version = 1, mono = false, rateIndex = 9, padding = 0, count = 24 } = {}) {
    const header = Buffer.alloc(4);
    const bits = (0xffe00000 | ((version === 1 ? 3 : version === 2 ? 2 : 0) << 19) | (1 << 17) | (1 << 16) | (rateIndex << 12) | (padding << 9) | ((mono ? 3 : 0) << 6)) >>> 0;
    header.writeUInt32BE(bits);
    const h = headerAt(header, 0);
    return Buffer.concat(Array.from({ length: count }, () => { const b = Buffer.alloc(h.frameBytes); header.copy(b); return b; }));
  }
  const stereo = frames();
  test('MPEG1 stereo frame count/rate/duration', () => { const r = inspectMp3(stereo); assert.equal(r.frameCount, 24); assert.equal(r.sampleRate, 44100); assert.equal(r.channels, 2); assert.ok(Math.abs(r.encodedDurationSeconds - 24 * 1152 / 44100) < 1e-6); assert.equal(r.pcmDecoded, false); });
  test('Mono MPEG2', () => { const r = inspectMp3(frames({ version: 2, mono: true })); assert.equal(r.sampleRate, 22050); assert.equal(r.channels, 1); assert.equal(r.version, 2); });
  test('MPEG2.5 padded frames', () => { const r = inspectMp3(frames({ version: 2.5, padding: 1 })); assert.equal(r.sampleRate, 11025); assert.equal(r.version, 2.5); });
  test('VBR continuous framing', () => { const r = inspectMp3(Buffer.concat([frames({ rateIndex: 8 }), frames({ rateIndex: 10 })])); assert.equal(r.variableBitrate, true); assert.equal(r.frameCount, 48); });
  test('ID3v2 and ID3v1 skipped', () => { const id3 = Buffer.from([73, 68, 51, 4, 0, 0, 0, 0, 0, 3, 0, 0, 0]); const tail = Buffer.alloc(128); tail.write('TAG'); const r = inspectMp3(Buffer.concat([id3, stereo, tail])); assert.equal(r.id3v2Bytes, 13); assert.equal(r.id3v1Bytes, 128); assert.equal(r.frameCount, 24); });
  test('Xing observed count checked', () => { const copy = Buffer.from(stereo); copy.write('Info', 36); copy.writeUInt32BE(1, 40); copy.writeUInt32BE(23, 44); assert.equal(inspectMp3(copy).xing.advertisedFrames, 23); copy.writeUInt32BE(999, 44); assert.throws(() => inspectMp3(copy), /Xing frame count/); });
  test('Truncated audio rejected', () => assert.throws(() => inspectMp3(stereo.subarray(0, stereo.length - 1)), /Truncated/));
  test('Junk and fake extension rejected', () => assert.throws(() => inspectMp3(Buffer.from('not audio.mp3')), /No valid/));
  test('Corrupt middle frame rejected', () => { const copy = Buffer.from(stereo); copy[417] = 0; assert.throws(() => inspectMp3(copy), /Invalid MPEG/); });
  test('Truncated/invalid ID3 rejected', () => { assert.throws(() => inspectMp3(Buffer.from('ID3')), /Truncated ID3/); const b = Buffer.from([73, 68, 51, 4, 0, 0, 128, 0, 0, 0]); assert.throws(() => inspectMp3(b), /synchsafe/); });
  test('Changing stream sample format rejected', () => assert.throws(() => inspectMp3(Buffer.concat([stereo, frames({ mono: true })])), /format changes/));
  test('Traversal/absolute/remote paths rejected', () => { for (const bad of ['../escape.mp3', '/outside.mp3', 'https://example.test/a.mp3', 'C:/secret.mp3', 'audio\\bad.mp3']) assert.throws(() => resolveInside(REPO_ROOT, bad)); assert.equal(resolveInside(REPO_ROOT, 'outputs/audio-review-v2/catalog.json'), path.resolve(REPO_ROOT, 'outputs/audio-review-v2/catalog.json')); });
  test('JS fetch is document-relative while imports are module-relative', () => { const documentRoot = path.join(REPO_ROOT, 'outputs/audio-review-v2'); const moduleRoot = path.join(REPO_ROOT, 'tools/audio/review-v2'); const refs = literalJsReferences("import {x} from './support.mjs'; fetch('./catalog.json');", documentRoot); assert.equal(path.resolve(refs[0].base ?? moduleRoot, refs[0].ref), path.join(moduleRoot, 'support.mjs')); assert.equal(path.resolve(refs[1].base ?? moduleRoot, refs[1].ref), path.join(documentRoot, 'catalog.json')); });
  return { passed: true, count: checks.length, checks, pcmDecoded: false };
}

async function auditManifest(root, manifestRelative, label, record) {
  const manifestPath = resolveInside(root, manifestRelative);
  const manifestBuffer = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBuffer.toString('utf8'));
  if (!Array.isArray(manifest.files)) throw new Error(`${label}: no files array`);
  const items = [];
  for (const row of manifest.files) {
    const full = resolveInside(root, row.path);
    const data = await readFile(full);
    const observed = { bytes: data.length, sha256: hash(data) };
    const passed = observed.bytes === row.bytes && observed.sha256 === row.sha256;
    record(passed, `${label}: ${row.path}`, passed ? undefined : 'Frozen bytes/SHA256 differ from manifest');
    items.push({ path: row.path, ...observed, passed });
  }
  return { label, manifest: manifestRelative, manifestSha256: hash(manifestBuffer), files: items.length, bytes: items.reduce((sum, i) => sum + i.bytes, 0), unchanged: items.every(i => i.passed) };
}

/** Local static inspection of sources actually referenced from index.html. No browser, HTTP, evaluation or decode. */
async function auditPage(root, outputRoot, record) {
  const visited = new Set(), files = [];
  async function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = await readFile(file, 'utf8');
    const relative = normalize(path.relative(root, file));
    files.push(relative);
    const js = /\.(?:m?js)$/i.test(file);
    record(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), `page: no dynamic evaluation in ${relative}`);
    const references = [];
    if (/\.html$/i.test(file)) {
      for (const match of source.matchAll(/<(script|link|audio|source|img)\b[^>]*?\b(src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi)) references.push({ ref: match[3], base: path.dirname(file) });
      for (const match of source.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)) {
        record(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(match[1]), `page: inline script has no dynamic evaluation in ${relative}`);
        references.push(...literalJsReferences(match[1], outputRoot));
      }
    }
    if (js) references.push(...literalJsReferences(source, outputRoot));
    if (/\.css$/i.test(file) || /\.html$/i.test(file)) for (const match of source.matchAll(/(?:@import\s+(?:url\()?|url\()\s*["']?([^"')\s;]+)["']?\)?/gi)) references.push({ ref: match[1], base: path.dirname(file) });
    record(!/\b(?:fetch|WebSocket|EventSource|Worker)\s*\(\s*["'`]\s*(?:https?:|wss?:|\/\/)/i.test(source), `page: no literal remote network constructor in ${relative}`);
    for (const reference of references) {
      const { ref, base = path.dirname(file) } = reference;
      if (!ref || ref.startsWith('#')) continue;
      const remote = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref);
      record(!remote, `page: local reference ${ref}`, remote ? 'External or non-file source reference' : undefined);
      if (remote) continue;
      const clean = decodeURIComponent(ref.split(/[?#]/)[0]);
      const target = clean.startsWith('/') ? resolveInside(root, clean.slice(1)) : path.resolve(base, clean);
      const rel = path.relative(root, target);
      record(!rel.startsWith(`..${path.sep}`) && rel !== '..', `page: repository-contained reference ${ref}`);
      if (rel.startsWith(`..${path.sep}`) || rel === '..') continue;
      try {
        record((await stat(target)).isFile(), `page: referenced file exists ${normalize(rel)}`);
        if (/\.(?:html|m?js|css)$/i.test(target)) await visit(target);
      } catch (error) { record(false, `page: referenced file ${normalize(rel)}`, error.message); }
    }
  }
  try { await visit(path.join(outputRoot, 'index.html')); } catch (error) { record(false, 'review index.html readable', error.message); }
  return { files, runtimeVerified: false, limitations: 'Static literal-reference inspection cannot prove arbitrary dynamically constructed URLs are local. Native runtime network capture remains pending.' };
}

export async function verify({ root = REPO_ROOT, output = 'outputs/audio-review-v2', integrationRoot = null } = {}) {
  root = path.resolve(root);
  const outputRoot = resolveInside(root, output);
  const catalog = JSON.parse(await readFile(path.join(outputRoot, 'catalog.json'), 'utf8'));
  const checks = [], assets = [], warnings = [], preservation = [];
  const record = (passed, name, detail) => checks.push({ name, passed: Boolean(passed), ...(detail ? { detail } : {}) });
  const list = Array.isArray(catalog) ? catalog : catalog.assets;
  if (!Array.isArray(list) || !list.length) throw new Error('Catalog must contain a non-empty assets array');
  const ids = new Set(), filePaths = new Set();
  for (const asset of list) {
    const id = asset.id;
    record(typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id), `asset ${id}: valid ID`);
    record(!ids.has(id), `asset ${id}: unique ID`); ids.add(id);
    record(ALL_STATUSES.has(asset.status), `asset ${id}: explicit production/review status`);
    record(typeof asset.label === 'string' && asset.label.length > 0, `asset ${id}: readable label`);
    record(typeof asset.category === 'string' && asset.category.length > 0, `asset ${id}: category`);
    record(typeof asset.description === 'string' && asset.description.length > 0, `asset ${id}: purpose`);
    record(typeof asset.loop === 'boolean', `asset ${id}: loop explicitly set`);
    record(asset.eventMapping !== undefined && asset.eventMapping !== null, `asset ${id}: event/connection contract present`);
    const duration = asset.duration ?? asset.durationSeconds ?? asset.request?.duration_seconds;
    record(typeof duration === 'number' && Number.isFinite(duration) && duration >= .5 && duration <= 30, `asset ${id}: requested duration 0.5–30s`);
    const prompt = asset.prompt ?? asset.request?.text;
    if (asset.status === 'generated_unreviewed' || prompt !== undefined) record(typeof prompt === 'string' && prompt.length > 0 && prompt.length <= 450, `asset ${id}: generation prompt 1–450 characters`);
    record(asset.source !== undefined && asset.source !== null && asset.source !== '', `asset ${id}: provenance present`);
    if (!PLAYABLE_STATUSES.has(asset.status)) {
      warnings.push({ id, status: asset.status, detail: 'Not a playable delivered asset; review collection remains incomplete.' });
      assets.push({ id, status: asset.status, playable: false });
      continue;
    }
    let actual;
    try {
      const full = resolveInside(outputRoot, asset.file);
      record(/^audio\/[a-z0-9][a-z0-9-]*\.mp3$/.test(asset.file), `asset ${id}: local MP3 path`);
      record(!filePaths.has(asset.file), `asset ${id}: distinct file path`); filePaths.add(asset.file);
      const data = await readFile(full);
      actual = { bytes: data.length, sha256: hash(data) };
      record(Number.isInteger(asset.bytes) && data.length === asset.bytes, `asset ${id}: file bytes match`);
      record(SHA256.test(asset.sha256 ?? '') && actual.sha256 === asset.sha256.toLowerCase(), `asset ${id}: SHA256 matches`);
      const mp3 = inspectMp3(data);
      record(mp3.sampleRate >= 8000 && mp3.sampleRate <= 48000 && mp3.channels >= 1 && mp3.channels <= 2, `asset ${id}: plausible MP3 format`);
      const durationDelta = Math.abs(mp3.encodedDurationSeconds - duration);
      record(durationDelta <= Math.max(.3, duration * .08), `asset ${id}: frame duration matches requested duration`, `encoded=${mp3.encodedDurationSeconds}s; requested=${duration}s; encoder padding included`);
      if (asset.status === 'generated_unreviewed') {
        const receiptRelative = asset.source?.receipt;
        const receipt = JSON.parse(await readFile(resolveInside(outputRoot, receiptRelative), 'utf8'));
        record(receipt.id === id && receipt.status === 'generated_unreviewed' && receipt.httpStatus === 200, `asset ${id}: successful generation receipt`);
        record(receipt.output?.file === asset.file && receipt.output?.bytes === actual.bytes && receipt.output?.sha256 === actual.sha256, `asset ${id}: receipt matches delivered file`);
        record(receipt.request?.text === prompt && receipt.request?.duration_seconds === duration && receipt.request?.loop === asset.loop, `asset ${id}: recorded request matches catalog`);
        record(receipt.credentialPersisted === false, `asset ${id}: receipt declares credential not persisted`);
      } else if (asset.status === 'existing_reused') {
        record(asset.source?.originalSha256 === actual.sha256 && asset.source?.reusedWithoutGeneration === true, `asset ${id}: reuse provenance matches original content`);
      }
      assets.push({ id, status: asset.status, playable: true, file: asset.file, ...actual, mp3, nativeDecode: 'not performed', listening: 'not performed' });
    } catch (error) {
      record(false, `asset ${id}: complete readable MP3`, error.message);
      assets.push({ id, status: asset.status, playable: false, ...actual, error: error.message });
    }
  }
  try {
    const delivered = (await readdir(path.join(outputRoot, 'audio'), { withFileTypes: true })).filter(entry => entry.isFile() && /\.mp3$/i.test(entry.name));
    const catalogFiles = new Set(list.filter(a => PLAYABLE_STATUSES.has(a.status)).map(a => a.file));
    for (const entry of delivered) record(catalogFiles.has(`audio/${entry.name}`), `audio file is cataloged: ${entry.name}`);
  } catch (error) { record(false, 'MP3 directory readable', error.message); }
  const hashes = new Map();
  for (const asset of assets.filter(a => a.playable)) {
    const prior = hashes.get(asset.sha256);
    record(!prior, `asset ${asset.id}: distinct audio content`, prior ? `Same compressed bytes as ${prior}` : undefined);
    hashes.set(asset.sha256, asset.id);
  }
  const page = await auditPage(root, outputRoot, record);
  try { preservation.push(await auditManifest(root, 'outputs/audio-v1/handoff-files.json', 'frozen audio v1', record)); } catch (error) { record(false, 'frozen audio v1 audit', error.message); }
  if (integrationRoot) {
    integrationRoot = path.resolve(integrationRoot);
    for (const [manifest, label] of [['outputs/integration-v1/delivery-manifest.json', 'frozen integration v1'], ['outputs/audio-machinegun-elevenlabs-v1/delivery-manifest.json', 'original ElevenLabs machinegun']]) {
      try { preservation.push(await auditManifest(integrationRoot, manifest, label, record)); } catch (error) { record(false, `${label} audit`, error.message); }
    }
    try {
      const manifest = JSON.parse(await readFile(path.join(root, 'outputs/audio-v1/handoff-files.json'), 'utf8'));
      for (const entry of manifest.sourceBoundary ?? []) {
        const data = await readFile(resolveInside(integrationRoot, entry.path));
        record(data.length === entry.bytes && hash(data) === entry.sha256, `frozen audio source boundary: ${entry.path}`);
      }
    } catch (error) { record(false, 'frozen audio source boundary', error.message); }
  } else warnings.push({ detail: 'Integration/source-boundary/original-machinegun preservation not checked; provide --integration-root.' });
  const selfTests = selfTest();
  record(selfTests.passed, `MP3/path parser self-tests (${selfTests.count})`);
  const failedChecks = checks.filter(c => !c.passed);
  const playableCount = assets.filter(a => a.playable).length;
  const report = {
    version: 'audio-review-v2-file-verification-1', createdAt: new Date().toISOString(),
    passed: failedChecks.length === 0 && playableCount === list.length,
    staticChecksPassed: failedChecks.length === 0, complete: playableCount === list.length,
    assets: assets.length, playableAssets: playableCount, bytes: assets.reduce((sum, a) => sum + (a.bytes ?? 0), 0),
    checksPassed: checks.length - failedChecks.length, checksFailed: failedChecks.length,
    catalogSha256: hash(await readFile(path.join(outputRoot, 'catalog.json'))),
    checks, assetChecks: assets, preservation, page, selfTests, warnings,
    notPerformed: [
      'Native MP3 decoding and Web Audio playback in a browser',
      'Decoded PCM peak, RMS, silence, clipping, seam/end-click or true audio duration measurement',
      'Human listening, material/weapon identification, mono/headphones and three-cue masking review',
      'Loop seam quality and long-duration loop comfort',
      'Gameplay installation, command-result hooks, real-time event mapping and gameplay audio lifecycle regression'
    ],
    acceptanceMeaning: 'PASS is complete files, hashes, compressed MP3 framing and static source/preservation checks only. Generated/unreviewed audio is not human-approved or installed.'
  };
  await writeFile(path.join(outputRoot, 'file-verification.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) console.log(JSON.stringify(selfTest(), null, 2));
  else {
    const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
    try {
      const report = await verify({ root: option('--root') ?? REPO_ROOT, output: option('--output') ?? 'outputs/audio-review-v2', integrationRoot: option('--integration-root') ?? null });
      console.log(JSON.stringify({ passed: report.passed, staticChecksPassed: report.staticChecksPassed, complete: report.complete, assets: report.assets, playableAssets: report.playableAssets, checksPassed: report.checksPassed, checksFailed: report.checksFailed, failedChecks: report.checks.filter(c => !c.passed), report: 'outputs/audio-review-v2/file-verification.json', notPerformed: report.notPerformed }, null, 2));
      if (!report.passed) process.exitCode = 1;
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
