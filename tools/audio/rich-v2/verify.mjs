import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PACK = path.join(ROOT, 'outputs/audio-rich-v2');
const V1_MANIFEST = 'outputs/audio-rich-v1/delivery-manifest.json';
const V1_MANIFEST_SHA256 = '9a50e6f105ff5497795fb33095cbc0dc71f2df88ac062372e6c6028e85709523';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const round = value => Number(value.toPrecision(10));
function local(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || /^[a-z]+:/i.test(relative)) throw new Error('Expected a local relative path');
  const result = path.resolve(root, relative), delta = path.relative(root, result);
  if (delta === '..' || delta.startsWith(`..${path.sep}`) || path.isAbsolute(delta)) throw new Error('Path escapes its root');
  return result;
}

export function readPcm16Wav(bytes) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('Invalid RIFF/WAVE header or length');
  let fmt, data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > bytes.length) throw new Error('Truncated WAVE chunk');
    if (kind === 'fmt ') {
      if (size < 16) throw new Error('Short fmt chunk');
      fmt = { codec: bytes.readUInt16LE(start), channels: bytes.readUInt16LE(start + 2), sampleRate: bytes.readUInt32LE(start + 4), byteRate: bytes.readUInt32LE(start + 8), align: bytes.readUInt16LE(start + 12), bits: bytes.readUInt16LE(start + 14) };
    }
    if (kind === 'data') { if (data) throw new Error('Multiple data chunks'); data = bytes.subarray(start, start + size); }
    offset = start + size + (size & 1);
  }
  if (!fmt || !data || fmt.codec !== 1 || fmt.bits !== 16 || fmt.channels !== 2 || fmt.sampleRate !== 44100 || fmt.align !== 4 || fmt.byteRate !== 176400 || !data.length || data.length % 4) throw new Error('Expected 44.1 kHz stereo PCM16');
  const frames = data.length / 4, channels = [new Float32Array(frames), new Float32Array(frames)];
  for (let i = 0; i < frames; i++) { channels[0][i] = data.readInt16LE(i * 4) / 32768; channels[1][i] = data.readInt16LE(i * 4 + 2) / 32768; }
  return { channels, frames, sampleRate: fmt.sampleRate, duration: frames / fmt.sampleRate };
}

// Independent measurement filter: cascaded second-order Butterworth high/low
// passes. This is a stated bandpass proxy, not FFT integration, LUFS or hearing.
function coefficients(kind, hz, sampleRate) {
  const w = 2 * Math.PI * hz / sampleRate, cosine = Math.cos(w), alpha = Math.sin(w) / Math.SQRT2, a0 = 1 + alpha;
  const b0 = (kind === 'high' ? 1 + cosine : 1 - cosine) / 2;
  return { b0: b0 / a0, b1: (kind === 'high' ? -(1 + cosine) : 1 - cosine) / a0, b2: b0 / a0, a1: -2 * cosine / a0, a2: (1 - alpha) / a0 };
}
function filter(input, coefficient, circular) {
  let z1 = 0, z2 = 0; const output = new Float64Array(input.length);
  const passes = circular ? 3 : 1;
  for (let pass = 0; pass < passes; pass++) for (let i = 0; i < input.length; i++) {
    const x = input[i], y = coefficient.b0 * x + z1;
    z1 = coefficient.b1 * x - coefficient.a1 * y + z2; z2 = coefficient.b2 * x - coefficient.a2 * y;
    output[i] = y;
  }
  return output;
}
function energy(channels) { let result = 0; for (const channel of channels) for (const value of channel) result += value * value; return result; }
function proxy(channels, sampleRate, lo, hi, loop) {
  let value = 0;
  for (const channel of channels) {
    const output = filter(filter(channel, coefficients('high', lo, sampleRate), loop), coefficients('low', hi, sampleRate), loop);
    for (const sample of output) value += sample * sample;
  }
  return value;
}
function edgeProbe(channels, sampleRate) {
  const frames = channels[0].length, width = Math.min(Math.max(1, Math.round(sampleRate * .005)), Math.max(1, Math.floor(frames / 2)));
  const window = start => {
    let sum = 0, count = 0, peak = 0, maxStep = 0;
    for (const channel of channels) for (let i = start; i < Math.min(frames, start + width); i++) {
      const value = channel[i]; sum += value * value; count++; peak = Math.max(peak, Math.abs(value)); if (i > start) maxStep = Math.max(maxStep, Math.abs(value - channel[i - 1]));
    }
    return { rms: round(Math.sqrt(sum / Math.max(1, count))), peak: round(peak), maxStep: round(maxStep) };
  };
  const first = window(0), last = window(Math.max(0, frames - width)), middle = window(Math.max(0, Math.floor((frames - width) / 2)));
  return { windowFrames: width, windowSeconds: width / sampleRate, first, last, middle, firstLastRmsRatio: round(first.rms / Math.max(last.rms, 1e-30)), firstMiddlePeakRatio: round(first.peak / Math.max(middle.peak, 1e-30)), lastMiddlePeakRatio: round(last.peak / Math.max(middle.peak, 1e-30)), interpretation: 'Actual 5 ms boundary-window diagnostics, not a perceptual loop approval. Natural temporal variation can create large ratios.' };
}
export function measure(pcm, { loop = false } = {}) {
  const { channels, sampleRate } = pcm, frames = channels[0].length;
  let peak = 0, finite = true, seam = 0, first = 0, last = 0, maxStep = 0, dc = 0, clippedSamples = 0;
  for (const channel of channels) {
    first = Math.max(first, Math.abs(channel[0] || 0)); last = Math.max(last, Math.abs(channel.at(-1) || 0)); seam = Math.max(seam, Math.abs((channel[0] || 0) - (channel.at(-1) || 0)));
    for (let i = 0; i < channel.length; i++) { const value = channel[i]; finite &&= Number.isFinite(value); peak = Math.max(peak, Math.abs(value)); dc += value; if (Math.abs(value) >= 32767 / 32768) clippedSamples++; if (i) maxStep = Math.max(maxStep, Math.abs(value - channel[i - 1])); }
  }
  const totalEnergy = energy(channels), count = frames * channels.length;
  const b80 = proxy(channels, sampleRate, 80, 350, loop), b100 = proxy(channels, sampleRate, 100, 350, loop), b35 = proxy(channels, sampleRate, 35, 120, loop);
  const mono = new Float32Array(frames); for (const channel of channels) for (let i = 0; i < frames; i++) mono[i] += channel[i] / channels.length;
  const monoEnergy = energy([mono]), monoBand = proxy([mono], sampleRate, 80, 350, loop);
  return { finite, frames, channels: channels.length, sampleRate, duration: frames / sampleRate, peak: round(peak), rms: round(Math.sqrt(totalEnergy / count)), dc: round(dc / count), energy: round(totalEnergy), clippedSamples, seam: round(seam), first: round(first), last: round(last), maxStep: round(maxStep), edgeProbe: edgeProbe(channels, sampleRate), lowMid80_350: { energy: round(b80), fraction: round(b80 / Math.max(totalEnergy, 1e-30)) }, lowMid100_350: { energy: round(b100), fraction: round(b100 / Math.max(totalEnergy, 1e-30)) }, lowBass35_120: { energy: round(b35), fraction: round(b35 / Math.max(totalEnergy, 1e-30)) }, mono: { finite: [...mono].every(Number.isFinite), rms: round(Math.sqrt(monoEnergy / Math.max(1, frames))), energy: round(monoEnergy), lowMid80_350Fraction: round(monoBand / Math.max(monoEnergy, 1e-30)) } };
}
function difference(source, output) {
  let xx = 0, yy = 0, xy = 0;
  for (let ch = 0; ch < source.channels.length; ch++) for (let i = 0; i < source.channels[ch].length; i++) { const x = source.channels[ch][i], y = output.channels[ch][i]; xx += x * x; yy += y * y; xy += x * y; }
  return { bestFitGain: round(xy / Math.max(xx, 1e-30)), nonGainEnergyFraction: round(Math.max(0, yy - xy * xy / Math.max(xx, 1e-30)) / Math.max(yy, 1e-30)) };
}
async function preserveV1() {
  const bytes = await readFile(local(ROOT, V1_MANIFEST)), manifest = JSON.parse(bytes), files = [];
  for (const entry of manifest.files || []) {
    try { const contents = await readFile(local(ROOT, entry.path)); files.push({ path: entry.path, bytes: contents.length, sha256: sha256(contents), passed: contents.length === entry.bytes && sha256(contents) === entry.sha256 }); }
    catch (error) { files.push({ path: entry.path, passed: false, error: error.message }); }
  }
  const manifestSha256 = sha256(bytes), selfPreserved = manifestSha256 === V1_MANIFEST_SHA256;
  return { manifest: V1_MANIFEST, manifestSha256, expectedManifestSha256: V1_MANIFEST_SHA256, selfPreserved, manifestListedCount: files.length, countIncludingManifest: files.length + 1, passed: selfPreserved && files.length === 126 && files.every(file => file.passed), files };
}
async function fixtures() {
  const { enhanceLowMid } = await import('./dsp.mjs'), results = [];
  const test = (id, fn) => { try { results.push({ id, passed: true, ...fn() }); } catch (error) { results.push({ id, passed: false, error: error.message }); } };
  const checksum = channels => { const hash = createHash('sha256'); for (const ch of channels) hash.update(Buffer.from(ch.buffer, ch.byteOffset, ch.byteLength)); return hash.digest('hex'); };
  test('silence_gets_no_oscillator_or_extra_duration', () => {
    const input = { channels: [new Float32Array(4410), new Float32Array(4410)], sampleRate: 44100 };
    const output = enhanceLowMid(input, { id: 'fire-cannon', category: 'weapon', loop: false });
    if (output.channels[0].length !== 4410 || energy(output.channels) !== 0) throw new Error('Silence changed');
  });
  test('deterministic_input_preservation_exact_loop_length', () => {
    const input = { channels: [Float32Array.from({ length: 8820 }, (_, i) => Math.sin(i * .071) * .1), Float32Array.from({ length: 8820 }, (_, i) => Math.cos(i * .052) * .08)], sampleRate: 44100 }, before = checksum(input.channels);
    const asset = { id: 'engine-idle-loop', category: 'ambience', loop: true }, a = enhanceLowMid(input, asset), b = enhanceLowMid(input, asset), m = measure(a, { loop: true });
    if (before !== checksum(input.channels) || checksum(a.channels) !== checksum(b.channels) || a.channels[0].length !== 8820 || !m.finite || m.seam > .012 || m.peak > .75005) throw new Error('Loop/determinism/safety boundary failed');
    return { peak: m.peak, seam: m.seam };
  });
  test('lowmid_response_is_relative_to_high_tone_not_global_gain', () => {
    const response = {};
    for (const hz of [60, 180, 300, 1000, 3000]) {
      const channel = Float32Array.from({ length: 44100 }, (_, i) => Math.sin(2 * Math.PI * hz * i / 44100) * .04), input = { channels: [channel, channel.slice()], sampleRate: 44100 };
      const output = enhanceLowMid(input, { id: 'fire-cannon', category: 'weapon', loop: false });
      response[hz] = 10 * Math.log10(energy(output.channels) / energy(input.channels));
    }
    const relative180 = response[180] - response[1000], relative300 = response[300] - response[1000];
    if (relative180 < 1.5 || relative300 < .9) throw new Error(`Expected lowmid response; measured ${relative180}/${relative300} dB`);
    return { responseDb: response, relative180to1000Db: relative180, relative300to1000Db: relative300, note: 'Sine response only, not actual-cue perception.' };
  });
  return results;
}
async function machinegunBurst(packDirectory, catalog) {
  const asset = catalog.assets.find(item => item.id === 'fire-machinegun');
  if (!asset) throw new Error('No actual machinegun cue');
  const pcm = readPcm16Wav(await readFile(local(packDirectory, asset.file))), starts = Array.from({ length: 6 }, (_, i) => Math.round(i * .22 * pcm.sampleRate)), frames = starts.at(-1) + pcm.frames;
  const channels = [new Float64Array(frames), new Float64Array(frames)], overlap = new Uint8Array(frames);
  for (const start of starts) for (let i = 0; i < pcm.frames; i++) {
    overlap[start + i]++; for (let ch = 0; ch < 2; ch++) channels[ch][start + i] += pcm.channels[ch][i];
  }
  let peak = 0, finite = true, sum = 0, maximumOverlap = 0, clippedSamples = 0;
  for (const count of overlap) maximumOverlap = Math.max(maximumOverlap, count);
  for (const channel of channels) for (const value of channel) { finite &&= Number.isFinite(value); peak = Math.max(peak, Math.abs(value)); sum += value * value; if (Math.abs(value) >= 1) clippedSamples++; }
  const rms = Math.sqrt(sum / (frames * 2)), quarterPeak = peak / 4;
  return { id: 'actual_machinegun_six_start_uncapped_rawmix', passed: finite && starts.length === 6 && maximumOverlap === 4 && quarterPeak <= .75005 && rms > .00001, sourceFile: asset.file, method: 'Six exact actual WAV copies summed offline with no voice eviction, source envelopes or limiting; fixed 1/4 headroom is measured separately.', startsSeconds: starts.map(frame => frame / pcm.sampleRate), startedSources: starts.length, evictedSources: 0, maximumFrameOverlap: maximumOverlap, sourceFrames: pcm.frames, mixedFrames: frames, duration: frames / pcm.sampleRate, finite, raw: { peak: round(peak), rms: round(rms), samplesAtOrBeyondUnity: clippedSamples }, fixedQuarterHeadroom: { gain: .25, peak: round(quarterPeak), rms: round(rms / 4), clips: quarterPeak >= 1 }, nativePlayback: false, note: 'Raw sample summation is not the runtime mixer or loudness measurement. Any raw clipping observation is reported rather than hidden by a limiter.' };
}

export async function verify({ packDirectory = PACK, write = true } = {}) {
  const bytes = await readFile(path.join(packDirectory, 'catalog.json')), catalog = JSON.parse(bytes), v1 = JSON.parse(await readFile(path.join(ROOT, 'outputs/audio-rich-v1/catalog.json')));
  const known = new Map(v1.assets.map(asset => [asset.id, asset])), assets = [], checks = [];
  const check = (id, passed, detail = {}) => checks.push({ id, passed: Boolean(passed), ...detail });
  check('49_exact_previous_cue_ids', catalog.assets?.length === 49 && new Set(catalog.assets.map(asset => asset.id)).size === 49 && catalog.assets.every(asset => known.has(asset.id)));
  for (const asset of catalog.assets || []) {
    const row = { id: asset.id, checks: [], passed: false };
    const cueCheck = (id, passed, detail = {}) => row.checks.push({ id, passed: Boolean(passed), ...detail });
    try {
      const originalBytes = await readFile(local(packDirectory, asset.source.file)), outputBytes = await readFile(local(packDirectory, asset.file)), original = readPcm16Wav(originalBytes), output = readPcm16Wav(outputBytes), old = known.get(asset.id);
      row.source = { file: asset.source.file, bytes: originalBytes.length, sha256: sha256(originalBytes), ...measure(original, { loop: asset.loop }) };
      row.output = { file: asset.file, bytes: outputBytes.length, sha256: sha256(outputBytes), ...measure(output, { loop: asset.loop }) };
      cueCheck('source_matches_previous_enhanced_wav', row.source.sha256 === old.sha256 && asset.source.sha256 === old.sha256 && row.source.bytes === old.bytes);
      cueCheck('output_hash_bytes', (!asset.sha256 || asset.sha256 === row.output.sha256) && (!asset.bytes || asset.bytes === row.output.bytes));
      cueCheck('finite_audible_no_clipping_peak_headroom', row.output.finite && row.output.rms > .00001 && row.output.clippedSamples === 0 && row.output.peak <= .75005, { peak: row.output.peak, rms: row.output.rms });
      cueCheck('exact_frames_channels_rate', output.frames === original.frames && output.channels.length === original.channels.length && output.sampleRate === original.sampleRate);
      row.change = { ...difference(original, output), lowMid80_350AtMatchedRmsRatio: row.output.lowMid80_350.fraction / Math.max(row.source.lowMid80_350.fraction, 1e-30), lowMid100_350AtMatchedRmsRatio: row.output.lowMid100_350.fraction / Math.max(row.source.lowMid100_350.fraction, 1e-30), monoLowMid80_350AtMatchedRmsRatio: row.output.mono.lowMid80_350Fraction / Math.max(row.source.mono.lowMid80_350Fraction, 1e-30) };
      cueCheck('not_just_uniform_gain', row.change.nonGainEnergyFraction > 1e-7, { fraction: row.change.nonGainEnergyFraction });
      cueCheck('lowmid_band_increases_at_equal_rms', row.change.lowMid80_350AtMatchedRmsRatio > 1.00001 && row.change.lowMid100_350AtMatchedRmsRatio > 1.00001, { ratio80_350: row.change.lowMid80_350AtMatchedRmsRatio, ratio100_350: row.change.lowMid100_350AtMatchedRmsRatio });
      cueCheck('mono_remains_audible_finite_and_lowmid_supported', row.output.mono.finite && row.output.mono.rms > .000001 && row.change.monoLowMid80_350AtMatchedRmsRatio > 1.00001, { rms: row.output.mono.rms, lowMidRatio: row.change.monoLowMid80_350AtMatchedRmsRatio });
      if (asset.loop) cueCheck('loop_sample_boundary_continuous', row.output.seam <= .012 && output.frames === original.frames, { seam: row.output.seam });
      else cueCheck('one_shot_edges_tapered_no_tail_growth', row.output.first <= .002 && row.output.last <= .002 && output.frames === original.frames, { first: row.output.first, last: row.output.last });
      cueCheck('still_review_candidate_not_game_installed', asset.humanApproved !== true && asset.gameplayInstalled !== true);
      row.passed = row.checks.every(item => item.passed);
    } catch (error) { row.error = error.message; }
    assets.push(row);
  }
  const preservation = await preserveV1(); check('v1_126_files_and_manifest_preserved', preservation.passed, { listed: preservation.manifestListedCount, includingManifest: preservation.countIncludingManifest });
  const fixtureChecks = await fixtures(); checks.push(...fixtureChecks);
  const burst = await machinegunBurst(packDirectory, catalog); checks.push(burst);
  check('all49_asset_checks', assets.length === 49 && assets.every(asset => asset.passed));
  const all = [...checks, ...assets.flatMap(asset => asset.checks)], valid = assets.filter(asset => asset.output && asset.change);
  const report = { schema: 'cloudstitch-audio-rich-v2-file-qa/v1', createdAt: new Date().toISOString(), passed: all.every(item => item.passed), total: all.length, passCount: all.filter(item => item.passed).length, catalogSha256: sha256(bytes), dspSha256: sha256(await readFile(new URL('./dsp.mjs', import.meta.url))), method: 'Independent PCM16 parsing, SHA/bytes/frame/peak/mono/seam checks and RBJ Butterworth HP80-or-100Hz followed by LP350Hz bandpass proxy. Band-energy fractions compare actual source/output at mathematically equal total RMS; no PCM gain fixture substitutes for actual 49-cue data.', signalSummary: { count: valid.length, bytes: valid.reduce((n, item) => n + item.output.bytes, 0), maximumSamplePeak: Math.max(...valid.map(item => item.output.peak)), equalRmsBand80_350RatioRange: [Math.min(...valid.map(item => item.change.lowMid80_350AtMatchedRmsRatio)), Math.max(...valid.map(item => item.change.lowMid80_350AtMatchedRmsRatio))], equalRmsBand100_350RatioRange: [Math.min(...valid.map(item => item.change.lowMid100_350AtMatchedRmsRatio)), Math.max(...valid.map(item => item.change.lowMid100_350AtMatchedRmsRatio))] }, checks, assets, preservation, browserRuns: 0, externalRequests: 0, providerRequests: 0, humanListening: 'not_performed', gameInstalled: false, limits: ['Bandpass proxy is not FFT brick-wall integration or LUFS/perceived loudness.', 'Biquad filters are circularly warmed for loops; numerical sample seam is not a listening approval.', 'Numeric stronger lowmid does not establish better timbre, dramatic quality, headphone balance or three-cue readability.', 'Native playback and the final game UI remain separate QA.'] };
  if (write) { await mkdir(packDirectory, { recursive: true }); await writeFile(path.join(packDirectory, 'file-verification.json'), `${JSON.stringify(report, null, 2)}\n`); }
  return report;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { const report = await verify({ packDirectory: process.argv[2] ? path.resolve(process.argv[2]) : PACK }); console.log(JSON.stringify({ passed: report.passed, total: report.total, passCount: report.passCount, checksFailed: report.checks.filter(item => !item.passed), assetsFailed: report.assets.filter(item => !item.passed).map(item => ({ id: item.id, error: item.error, checks: item.checks.filter(check => !check.passed) })), signalSummary: report.signalSummary })); if (!report.passed) process.exitCode = 1; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
