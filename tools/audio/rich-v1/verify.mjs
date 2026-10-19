import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const DEFAULT_PACK = path.join(REPO, 'outputs/audio-rich-v1');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const round = n => Number(n.toPrecision(9));

function inside(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || /^[a-z]+:/i.test(relative)) throw new Error('Expected local relative path');
  const resolved = path.resolve(root, relative);
  const delta = path.relative(root, resolved);
  if (delta === '..' || delta.startsWith(`..${path.sep}`) || path.isAbsolute(delta)) throw new Error('Path escapes its root');
  return resolved;
}

/** Reads the actual PCM samples, independently of catalog metrics or browser decoding. */
export function inspectWav(bytes, { allowFloat = false } = {}) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Not a RIFF/WAVE file');
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('RIFF length mismatch');
  let offset = 12, fmt = null, data = null;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > bytes.length) throw new Error(`Truncated ${id} chunk`);
    if (id === 'fmt ') {
      if (size < 16) throw new Error('Short fmt chunk');
      fmt = { format: bytes.readUInt16LE(start), channels: bytes.readUInt16LE(start + 2), sampleRate: bytes.readUInt32LE(start + 4), byteRate: bytes.readUInt32LE(start + 8), blockAlign: bytes.readUInt16LE(start + 12), bits: bytes.readUInt16LE(start + 14) };
    }
    if (id === 'data') { if (data) throw new Error('Multiple data chunks'); data = bytes.subarray(start, start + size); }
    offset = start + size + (size & 1);
  }
  if (!fmt || !data) throw new Error('Missing fmt or data chunk');
  const isFloat = fmt.format === 3 && fmt.bits === 32;
  if (!((fmt.format === 1 && fmt.bits === 16) || (allowFloat && isFloat)) || ![1, 2].includes(fmt.channels)) throw new Error('Expected mono/stereo PCM16, or declared source float32');
  if (![22050, 32000, 44100, 48000].includes(fmt.sampleRate)) throw new Error('Unexpected sample rate');
  const bytesPerSample = fmt.bits / 8;
  if (fmt.blockAlign !== fmt.channels * bytesPerSample || fmt.byteRate !== fmt.sampleRate * fmt.blockAlign || data.length % fmt.blockAlign) throw new Error('Invalid PCM alignment');
  const frames = data.length / fmt.blockAlign;
  if (!frames) throw new Error('No PCM frames');
  const channels = Array.from({ length: fmt.channels }, () => new Float32Array(frames));
  for (let frame = 0; frame < frames; frame++) for (let ch = 0; ch < fmt.channels; ch++) {
    const sampleOffset = (frame * fmt.channels + ch) * bytesPerSample;
    channels[ch][frame] = isFloat ? data.readFloatLE(sampleOffset) : data.readInt16LE(sampleOffset) / 32768;
  }
  return { channels, sampleRate: fmt.sampleRate, format: isFloat ? 'FLOAT32_WAV_SOURCE' : 'PCM16_WAV', frames, duration: frames / fmt.sampleRate, dataBytes: data.length, metrics: measurePcm(channels, fmt.sampleRate) };
}

/** LF is a declared 180 Hz one-pole proxy, not a perceptual loudness or true-peak meter. */
export function measurePcm(channels, sampleRate) {
  const count = channels.reduce((n, ch) => n + ch.length, 0);
  let peak = 0, energy = 0, dc = 0, finite = true, seam = 0, first = 0, last = 0, maxStep = 0, lfEnergy = 0;
  const alpha = 1 - Math.exp(-2 * Math.PI * 180 / sampleRate);
  for (const ch of channels) {
    let low = 0;
    first = Math.max(first, Math.abs(ch[0] || 0)); last = Math.max(last, Math.abs(ch.at(-1) || 0));
    seam = Math.max(seam, Math.abs((ch[0] || 0) - (ch.at(-1) || 0)));
    // Warm the proxy for circular loops; the second pass is measured to reduce initial filter bias.
    for (const value of ch) low += alpha * (value - low);
    for (let i = 0; i < ch.length; i++) {
      const value = ch[i]; finite &&= Number.isFinite(value);
      peak = Math.max(peak, Math.abs(value)); energy += value * value; dc += value;
      low += alpha * (value - low); lfEnergy += low * low;
      if (i) maxStep = Math.max(maxStep, Math.abs(value - ch[i - 1]));
    }
  }
  return { finite, peak: round(peak), rms: round(Math.sqrt(energy / count)), dc: round(dc / count), energy: round(energy), lfEnergy: round(lfEnergy), lfEnergyRatio: round(energy ? lfEnergy / energy : 0), seam: round(seam), first: round(first), last: round(last), maxStep: round(maxStep) };
}

async function auditManifest(relative) {
  const filename = inside(REPO, relative), bytes = await readFile(filename), manifest = JSON.parse(bytes);
  const result = { manifest: relative, manifestSha256: hash(bytes), files: [], passed: true };
  for (const entry of manifest.files || []) {
    try {
      const content = await readFile(inside(REPO, entry.path));
      const actual = { path: entry.path, bytes: content.length, sha256: hash(content) };
      actual.passed = actual.bytes === entry.bytes && actual.sha256 === entry.sha256;
      result.files.push(actual);
    } catch (error) { result.files.push({ path: entry.path, passed: false, error: error.message }); }
  }
  result.fileCount = result.files.length; result.passed = result.fileCount > 0 && result.files.every(file => file.passed);
  return result;
}

export async function verifyPack({ packDirectory = DEFAULT_PACK, write = true } = {}) {
  const catalogBytes = await readFile(path.join(packDirectory, 'catalog.json'));
  const catalog = JSON.parse(catalogBytes), checks = [], assets = [], warnings = [];
  const check = (id, passed, detail = {}) => checks.push({ id, passed: Boolean(passed), ...detail });
  check('49_unique_assets', catalog.assets?.length === 49 && new Set(catalog.assets.map(asset => asset.id)).size === 49, { count: catalog.assets?.length });
  const oldCatalog = JSON.parse(await readFile(path.join(REPO, 'outputs/audio-review-v2/catalog.json')));
  const oldMortar = JSON.parse(await readFile(path.join(REPO, 'outputs/audio-mortar-r1/catalog.json')));
  const expected = new Map([...oldCatalog.assets, ...oldMortar.assets.filter(asset => !asset.old)].map(asset => [asset.id, asset]));
  check('exact_expected_cue_ids', catalog.assets?.length === expected.size && catalog.assets.every(asset => expected.has(asset.id)), { expectedIds: [...expected.keys()] });
  for (const asset of catalog.assets || []) {
    const row = { id: asset.id, passed: false, checks: [] };
    const cueCheck = (id, passed, detail = {}) => row.checks.push({ id, passed: Boolean(passed), ...detail });
    try {
      const original = expected.get(asset.id), source = asset.source || {};
      const originalBytes = await readFile(inside(packDirectory, source.file));
      const outputBytes = await readFile(inside(packDirectory, asset.file));
      const wav = inspectWav(outputBytes);
      row.source = { file: source.file, bytes: originalBytes.length, sha256: hash(originalBytes) };
      row.output = { file: asset.file, bytes: outputBytes.length, sha256: hash(outputBytes), sampleRate: wav.sampleRate, channels: wav.channels.length, frames: wav.frames, duration: round(wav.duration), ...wav.metrics };
      cueCheck('source_is_exact_original_mp3', row.source.sha256 === original?.sha256 && source.sha256 === original?.sha256 && (!source.bytes || source.bytes === originalBytes.length));
      cueCheck('pcm16_output_hash_bytes', (!asset.sha256 || asset.sha256 === row.output.sha256) && (!asset.bytes || asset.bytes === outputBytes.length));
      cueCheck('audible_finite_headroom', wav.metrics.finite && wav.metrics.peak > 0.001 && wav.metrics.rms > 0.00001 && wav.metrics.peak <= 0.86005, { peak: wav.metrics.peak, rms: wav.metrics.rms });
      cueCheck('recipe_and_mapping_recorded', !!asset.recipe && (asset.eventMapping !== undefined || asset.mapping !== undefined));
      let sourcePcm = null;
      const candidates = [asset.derivation?.decodedSource?.path, asset.decodedSource, source.decodedFile, `work/audio/rich-v1/decoded/${asset.id}.wav`].filter(Boolean);
      for (const candidate of candidates) {
        try {
          const decodedBytes = await readFile(inside(REPO, candidate));
          sourcePcm = inspectWav(decodedBytes, { allowFloat: true });
          row.sourcePcm = { file: candidate, bytes: decodedBytes.length, sha256: hash(decodedBytes), format: sourcePcm.format, sampleRate: sourcePcm.sampleRate, channels: sourcePcm.channels.length, frames: sourcePcm.frames, duration: round(sourcePcm.duration), ...sourcePcm.metrics };
          if (asset.derivation?.decodedSource?.sha256) cueCheck('decoded_source_matches_build_receipt', row.sourcePcm.sha256 === asset.derivation.decodedSource.sha256);
          break;
        }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      const metricsSource = asset.metrics?.original || asset.metrics?.source || asset.metrics?.input;
      const sourceFrames = sourcePcm?.frames ?? metricsSource?.frames ?? metricsSource?.samples;
      const sourceRate = sourcePcm?.sampleRate ?? metricsSource?.sampleRate ?? wav.sampleRate;
      const sourceDuration = sourcePcm?.duration ?? metricsSource?.duration ?? (sourceFrames ? sourceFrames / sourceRate : null);
      cueCheck('independent_source_pcm_available', !!sourcePcm, { note: 'The local decoded intermediate is independently measured; numeric source metrics alone are insufficient for this check.' });
      if (sourcePcm) cueCheck('sample_rate_and_channels_preserved', sourcePcm.sampleRate === wav.sampleRate && sourcePcm.channels.length === wav.channels.length);
      if (asset.loop) {
        cueCheck('loop_duration_preserved', sourceFrames ? sourceFrames === wav.frames : sourceDuration ? Math.abs(sourceDuration - wav.duration) <= 1 / wav.sampleRate : false, { sourceFrames, outputFrames: wav.frames });
        cueCheck('loop_boundary_sample_step', wav.metrics.seam <= 0.012, { seam: wav.metrics.seam, meaning: 'Sample discontinuity only; a seamless perceived loop still needs listening.' });
      } else {
        cueCheck('one_shot_edges_tapered', wav.metrics.first <= 0.002 && wav.metrics.last <= 0.002, { first: wav.metrics.first, last: wav.metrics.last });
        if (sourceDuration) cueCheck('bounded_short_tail', wav.duration >= sourceDuration - 1 / wav.sampleRate && wav.duration <= sourceDuration + 0.65, { sourceDuration, outputDuration: wav.duration });
      }
      if (sourcePcm) {
        let sourceEnergy = 0, outputEnergy = 0, correlation = 0;
        const comparedFrames = Math.min(wav.frames, sourcePcm.frames);
        for (let ch = 0; ch < wav.channels.length; ch++) for (let i = 0; i < comparedFrames; i++) {
          const x = sourcePcm.channels[ch][i], y = wav.channels[ch][i];
          sourceEnergy += x * x; outputEnergy += y * y; correlation += x * y;
        }
        const bestFitGain = correlation / Math.max(1e-20, sourceEnergy);
        const residualRatio = Math.max(0, outputEnergy - correlation * correlation / Math.max(1e-20, sourceEnergy)) / Math.max(1e-20, outputEnergy);
        row.comparison = { rmsRatio: round(wav.metrics.rms / sourcePcm.metrics.rms), peakMatchedRmsRatio: round((wav.metrics.rms / wav.metrics.peak) / (sourcePcm.metrics.rms / sourcePcm.metrics.peak)), lfEnergyRatioChange: round(wav.metrics.lfEnergyRatio - sourcePcm.metrics.lfEnergyRatio), sourcePeak: sourcePcm.metrics.peak, outputPeak: wav.metrics.peak, bestFitUniformGain: round(bestFitGain), nonUniformProcessingEnergyRatio: round(residualRatio), comparedFrames, note: 'Raw RMS ratio includes source normalization and duration differences. Peak-matched RMS is a numeric comparison, not perceived loudness.' };
        cueCheck('processing_is_more_than_uniform_gain', residualRatio > 1e-8, { residualRatio: round(residualRatio), meaning: 'Checks actual waveform change beyond uniform level; not a perceptual timbre judgment.' });
      } else warnings.push({ id: asset.id, note: 'Decoded source PCM unavailable; comparison relies on build-recorded metrics, not independent decoding.' });
      if (asset.metrics?.addedBass) {
        row.addedBass = asset.metrics.addedBass;
        const budget = asset.metrics.addedBass.limit;
        cueCheck('subtle_added_bass_budget', Number.isFinite(asset.metrics.addedBass.relativeEnergy) && Number.isFinite(budget) && budget <= 0.024001 && asset.metrics.addedBass.relativeEnergy <= budget * 1.0001 + 1e-9, { relativeEnergy: asset.metrics.addedBass.relativeEnergy, limit: budget, meaning: 'Added layer energy only; this does not certify perceived bass balance.' });
      }
      cueCheck('human_and_install_status_not_overclaimed', asset.gameplayInstalled !== true && asset.humanApproved !== true && asset.humanReview !== 'approved');
      row.passed = row.checks.every(item => item.passed);
    } catch (error) { row.error = error.message; }
    assets.push(row);
  }
  const preservation = [];
  for (const manifest of ['outputs/audio-review-v2/delivery-manifest.json', 'outputs/audio-mortar-r1/delivery-manifest.json', 'outputs/audio-v1/handoff-files.json']) preservation.push(await auditManifest(manifest));
  check('frozen_original_manifests_preserved', preservation.every(item => item.passed), { groups: preservation.map(item => ({ manifest: item.manifest, count: item.fileCount, passed: item.passed })) });
  check('all_asset_checks', assets.length === 49 && assets.every(asset => asset.passed), { count: assets.length });
  const allChecks = [...checks, ...assets.flatMap(asset => asset.checks)];
  const dspSha256 = hash(await readFile(new URL('./dsp.mjs', import.meta.url)));
  const report = { version: 'audio-rich-v1-file-qa', createdAt: new Date().toISOString(), passed: checks.every(item => item.passed), total: allChecks.length, passedCount: allChecks.filter(item => item.passed).length, dspSha256, catalogSha256: hash(catalogBytes), scope: 'Independent local file hashes, actual PCM16 numeric checks, source preservation and cue inventory. No browser, native playback, loudness perception, human approval, game installation or paid requests.', externalRequests: 0, browserRuns: 0, paidGenerationRequests: 0, humanListening: 'not_performed', gameplayInstalled: false, signalSummary: { assetCount: assets.length, pcm16WavBytes: assets.reduce((n, asset) => n + (asset.output?.bytes || 0), 0), outputSamplePeakRange: [Math.min(...assets.map(asset => asset.output?.peak ?? Infinity)), Math.max(...assets.map(asset => asset.output?.peak || 0))], peakMatchedRmsRatioRange: [Math.min(...assets.map(asset => asset.comparison?.peakMatchedRmsRatio ?? Infinity)), Math.max(...assets.map(asset => asset.comparison?.peakMatchedRmsRatio || 0))], maximumAddedBassEnergyRatio: Math.max(...assets.map(asset => asset.addedBass?.relativeEnergy || 0)), lfProxyMeaning: '180 Hz one-pole low-pass energy, circularly warmed; not a brick-wall spectral integral. Source rumble cleanup can reduce total LF proxy even when a small bass layer is added.' }, checks, assets, preservation, warnings, limits: ['Sample peak is not inter-sample true peak or LUFS.', 'RMS and LF proxy changes cannot certify richer timbre, dramatic quality, bass taste or three-cue recognition.', 'Source generation/license records remain in their original catalogs; no new provider generation occurred.'] };
  if (write) { await mkdir(packDirectory, { recursive: true }); await writeFile(path.join(packDirectory, 'file-verification.json'), `${JSON.stringify(report, null, 2)}\n`); }
  return report;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { const report = await verifyPack({ packDirectory: process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_PACK }); console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, assets: report.assets.length, failed: report.assets.filter(asset => !asset.passed).map(asset => ({ id: asset.id, error: asset.error, checks: asset.checks.filter(item => !item.passed) })), preservation: report.preservation.map(item => ({ files: item.fileCount, passed: item.passed })), warnings: report.warnings.length })); if (!report.passed) process.exitCode = 1; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
