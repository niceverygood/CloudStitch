import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readPcm16Wav, measure } from '../rich-v2/verify.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PACK = path.join(ROOT, 'outputs/audio-grand-v4');
const V2_MANIFEST = 'outputs/audio-rich-v2/delivery-manifest.json';
const V2_SHA256 = '26cb7743a373c99126fab156fa80c9927bea2904a4757406a73067e3198db823';
const V3_MANIFEST = 'outputs/audio-grand-v3/delivery-manifest.json';
const V3_SHA256 = 'f1a3845e0d10f495d26802f49748f4a72654dbeb12bd7737aae18ed014da8a3a';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const rounded = value => Number(value.toPrecision(10));
function local(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || /^[a-z]+:/i.test(relative)) throw new Error('Expected a local relative path');
  const filename = path.resolve(root, relative), delta = path.relative(root, filename);
  if (delta === '..' || delta.startsWith(`..${path.sep}`) || path.isAbsolute(delta)) throw new Error('Path escapes its root');
  return filename;
}
function readProcessingWav(bytes) {
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('Invalid processing WAVE');
  let fmt, data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > bytes.length) throw new Error('Truncated processing WAVE chunk');
    if (kind === 'fmt ') fmt = { codec: bytes.readUInt16LE(start), channels: bytes.readUInt16LE(start + 2), sampleRate: bytes.readUInt32LE(start + 4), byteRate: bytes.readUInt32LE(start + 8), align: bytes.readUInt16LE(start + 12), bits: bytes.readUInt16LE(start + 14) };
    if (kind === 'data') { if (data) throw new Error('Duplicate processing data'); data = bytes.subarray(start, start + size); }
    offset = start + size + (size & 1);
  }
  if (!fmt || !data || fmt.codec !== 3 || fmt.bits !== 32 || fmt.channels !== 2 || fmt.sampleRate !== 44100 || fmt.align !== 8 || fmt.byteRate !== 352800 || !data.length || data.length % 8) throw new Error('Expected first-decode stereo IEEE_FLOAT32 44.1 kHz source');
  const frames = data.length / 8, channels = [new Float32Array(frames), new Float32Array(frames)];
  for (let i = 0; i < frames; i++) for (let ch = 0; ch < 2; ch++) {
    const sample = data.readFloatLE(i * 8 + ch * 4);
    if (!Number.isFinite(sample)) throw new Error('Non-finite processing source'); channels[ch][i] = sample;
  }
  return { channels, frames, sampleRate: fmt.sampleRate, duration: frames / fmt.sampleRate };
}
const channelHash = channels => { const hash = createHash('sha256'); for (const channel of channels) hash.update(Buffer.from(channel.buffer, channel.byteOffset, channel.byteLength)); return hash.digest('hex'); };
function nonGainDifference(input, output) {
  let xx = 0, yy = 0, xy = 0; const frames = Math.min(input.channels[0].length, output.channels[0].length);
  for (let ch = 0; ch < input.channels.length; ch++) for (let i = 0; i < frames; i++) { const x = input.channels[ch][i], y = output.channels[ch][i]; xx += x * x; yy += y * y; xy += x * y; }
  return { comparedFrames: frames, bestFitGain: rounded(xy / Math.max(xx, 1e-30)), nonGainEnergyFraction: rounded(Math.max(0, yy - xy * xy / Math.max(xx, 1e-30)) / Math.max(yy, 1e-30)), note: 'Unaligned first-frame residual: changed pitch, phase, layers and space can all contribute; not a perceptual quality score.' };
}
function energy(channels) { let sum = 0; for (const ch of channels) for (const value of ch) sum += value * value; return sum; }
function roughness(pcm) {
  let stepEnergy = 0; for (const channel of pcm.channels) for (let i = 1; i < channel.length; i++) { const delta = channel[i] - channel[i - 1]; stepEnergy += delta * delta; }
  return { firstDifferenceEnergyFraction: rounded(stepEnergy / Math.max(energy(pcm.channels), 1e-30)), meaning: 'Time-domain first-difference proxy weights high frequencies; it is not a defined high-frequency band, brightness judgment or hearing result.' };
}
async function preservation(relative, expectedHash, expectedCount) {
  const bytes = await readFile(local(ROOT, relative)), manifest = JSON.parse(bytes), files = [];
  for (const item of manifest.files || []) {
    try { const contents = await readFile(local(ROOT, item.path)); files.push({ path: item.path, bytes: contents.length, sha256: sha256(contents), passed: item.bytes === contents.length && item.sha256 === sha256(contents) }); }
    catch (error) { files.push({ path: item.path, passed: false, error: error.message }); }
  }
  const manifestHash = sha256(bytes);
  return { manifest: relative, expectedManifestSha256: expectedHash, manifestSha256: manifestHash, manifestPreserved: manifestHash === expectedHash, listedCount: files.length, countIncludingManifest: files.length + 1, passed: manifestHash === expectedHash && files.length === expectedCount && files.every(item => item.passed), files };
}
async function renderMix(pack, assets, ids, starts, { purpose, interval = null } = {}) {
  const sources = [];
  for (let i = 0; i < ids.length; i++) {
    const asset = assets.find(asset => asset.id === ids[i]); if (!asset) throw new Error(`Missing mix cue ${ids[i]}`);
    const pcm = readPcm16Wav(await readFile(local(pack, asset.file))); sources.push({ id: ids[i], file: asset.file, startFrame: Math.round(starts[i] * pcm.sampleRate), pcm });
  }
  const frames = Math.max(...sources.map(source => source.startFrame + source.pcm.frames)), channels = [new Float64Array(frames), new Float64Array(frames)], overlap = new Uint8Array(frames);
  for (const source of sources) for (let i = 0; i < source.pcm.frames; i++) { overlap[source.startFrame + i]++; for (let ch = 0; ch < 2; ch++) channels[ch][source.startFrame + i] += source.pcm.channels[ch][i]; }
  let maximumOverlap = 0, peak = 0, sum = 0, finite = true, unitySamples = 0;
  for (const count of overlap) maximumOverlap = Math.max(maximumOverlap, count);
  for (const channel of channels) for (const value of channel) { finite &&= Number.isFinite(value); peak = Math.max(peak, Math.abs(value)); sum += value * value; if (Math.abs(value) >= 1) unitySamples++; }
  const rms = Math.sqrt(sum / (2 * frames)), gain = 1 / Math.max(1, maximumOverlap);
  return { purpose, method: 'Actual output WAVs summed offline without voice eviction, limiter, envelopes or source cap. A fixed reciprocal-overlap gain is evaluated separately.', starts: sources.map(source => ({ id: source.id, file: source.file, startFrame: source.startFrame, startSeconds: source.startFrame / 44100, duration: source.pcm.duration })), startedSources: sources.length, evictedSources: 0, intervalSeconds: interval, mixedFrames: frames, duration: frames / 44100, maximumFrameOverlap: maximumOverlap, finite, raw: { peak: rounded(peak), rms: rounded(rms), samplesAtOrBeyondUnity: unitySamples }, reciprocalOverlapHeadroom: { gain, peak: rounded(peak * gain), rms: rounded(rms * gain), clips: peak * gain >= 1 }, fixedQuarterHeadroom: { gain: .25, peak: rounded(peak * .25), rms: rounded(rms * .25) }, passed: finite && rms > .000001 && sources.length === ids.length && peak * gain <= .73005, nativePlayback: false, limitations: 'This numerical mix does not certify loudness, clipping at a device, dramatic character or recognition when cues overlap.' };
}
async function verifyPairedAuditions(packDirectory) {
  const relative = 'audition-catalog.json', bytes = await readFile(path.join(packDirectory, relative)), catalog = JSON.parse(bytes), pairs = [];
  for (const pair of catalog.pairs || []) {
    const row = { id: pair.id, file: pair.file, passed: false, checks: [], segments: [] }, check = (id, passed, detail = {}) => row.checks.push({ id, passed: Boolean(passed), ...detail });
    try {
      const pairBytes = await readFile(local(packDirectory, pair.file)), pcm = readPcm16Wav(pairBytes);
      row.sha256 = sha256(pairBytes); row.bytes = pairBytes.length;
      check('actual_pair_hash_bytes_format_frames', row.sha256 === pair.sha256 && row.bytes === pair.bytes && pcm.frames === pair.frames && pcm.sampleRate === pair.sampleRate && pcm.channels.length === pair.channels);
      check('two_segments_order_is_previous_v2_then_v4', pair.segments?.length === 2 && pair.order?.join(',') === 'v2,v4' && pair.segments.map(segment => segment.version).join(',') === 'v2,v4');
      const [first, second] = pair.segments;
      check('declared_gap_and_boundaries', first.startFrame === 0 && second.startFrame === first.frames + pair.gapFrames && second.startFrame + second.frames === pcm.frames && Math.abs(pair.gapFrames / pcm.sampleRate - .35) <= 1 / pcm.sampleRate);
      let gapPeak = 0;
      for (const channel of pcm.channels) for (let i = first.frames; i < second.startFrame; i++) gapPeak = Math.max(gapPeak, Math.abs(channel[i]));
      check('gap_is_actual_digital_silence', gapPeak === 0, { gapPeak });
      for (const segment of pair.segments) {
        const sourceBytes = await readFile(local(packDirectory, segment.file)), source = readPcm16Wav(sourceBytes), segmentChannels = pcm.channels.map(channel => channel.subarray(segment.startFrame, segment.startFrame + segment.frames));
        let peak = 0, sum = 0, difference = 0, sourceSum = 0, sourcePeak = 0;
        for (let ch = 0; ch < segmentChannels.length; ch++) for (let i = 0; i < segment.frames; i++) {
          const value = segmentChannels[ch][i], original = source.channels[ch][i];
          peak = Math.max(peak, Math.abs(value)); sum += value * value; sourceSum += original * original; sourcePeak = Math.max(sourcePeak, Math.abs(original)); difference = Math.max(difference, Math.abs(value - original * segment.gain));
        }
        const rms = Math.sqrt(sum / (segment.frames * pcm.channels.length)), sourceRms = Math.sqrt(sourceSum / (segment.frames * pcm.channels.length));
        const actual = { version: segment.version, file: segment.file, sha256: sha256(sourceBytes), frames: segment.frames, gain: segment.gain, sourceRms, sourcePeak, actualRms: rms, actualPeak: peak, targetRms: pair.targetRms, maxGainAppliedPcmDeviation: difference };
        row.segments.push(actual);
        check(`${segment.version}_correct_file_and_gain_applied_to_actual_samples`, actual.sha256 === segment.sha256 && source.frames === segment.frames && Number.isFinite(segment.gain) && segment.gain > 0 && difference <= .00005, { maxDeviation: difference });
        check(`${segment.version}_actual_rms_and_peak_match_metadata`, Math.abs(rms - pair.targetRms) <= .00002 && Math.abs(rms - segment.expectedRms) <= .00002 && Math.abs(sourceRms - segment.sourceRms) <= .00002 && Math.abs(sourcePeak - segment.sourcePeak) <= .00004 && peak <= pair.peakLimit + .00004, { rms, targetRms: pair.targetRms, peak, limit: pair.peakLimit });
      }
      check('actual_two_segment_rms_equal', Math.abs(row.segments[0].actualRms - row.segments[1].actualRms) <= .00002, { absoluteDifference: Math.abs(row.segments[0].actualRms - row.segments[1].actualRms) });
      check('review_approval_not_implied', pair.humanApproval === false);
      row.passed = row.checks.every(item => item.passed);
    } catch (error) { row.error = error.message; }
    pairs.push(row);
  }
  return { catalog: relative, sha256: sha256(bytes), passed: pairs.length === 5 && new Set(pairs.map(pair => pair.id)).size === 5 && pairs.every(pair => pair.passed), count: pairs.length, pairs, method: 'Independent PCM inspection of two ordered actual-file segments, applied gains, silent gap, RMS matching within 2e-5 and peak ceilings. RMS matching is not LUFS or human equal-loudness approval.' };
}
export async function verifyDspFixtures(library) {
  const { designGrand } = await import('./dsp.mjs'), results = [];
  const test = (id, fn) => { try { results.push({ id, passed: true, ...fn() }); } catch (error) { results.push({ id, passed: false, error: error.message }); } };
  test('silent_main_and_silent_library_produce_no_oscillator', () => {
    const input = { channels: [new Float32Array(35280), new Float32Array(35280)], sampleRate: 44100 }, zeroLibrary = Object.fromEntries(Object.entries(library).map(([id, item]) => [id, { channels: item.channels.map(channel => new Float32Array(channel.length)), sampleRate: item.sampleRate, sha256: item.sha256 }])), output = designGrand(input, { id: 'fire-cannon', category: 'weapon', loop: false }, { library: zeroLibrary });
    if (energy(output.channels) !== 0) throw new Error('Silent main and library acquired a synthetic sound');
    return { outputFrames: output.channels[0].length };
  });
  test('silent_main_gates_even_the_actual_material_library', () => {
    const input = { channels: [new Float32Array(35280), new Float32Array(35280)], sampleRate: 44100 }, output = designGrand(input, { id: 'fire-cannon', category: 'weapon', loop: false }, { library });
    if (energy(output.channels) !== 0) throw new Error('Untriggered material sounded despite a silent main source');
    return { outputFrames: output.channels[0].length, libraryEntries: Object.keys(library).length };
  });
  for (const loop of [false, true]) test(`determinism_input_preservation_${loop ? 'loop' : 'oneshot'}`, () => {
    let seed = 0x69723a; const channel = Float32Array.from({ length: 26460 }, (_, i) => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (((seed >>> 0) / 4294967295 - .5) * .3 + Math.sin(i * .047) * .12) * (loop ? 1 : Math.exp(-i / 9500)); });
    const input = { channels: [channel, channel.slice()], sampleRate: 44100 }, before = channelHash(input.channels), libraryBefore = Object.fromEntries(Object.entries(library).map(([id, item]) => [id, channelHash(item.channels)])), asset = { id: loop ? 'engine-idle-loop' : 'fire-cannon', category: loop ? 'ambience' : 'weapon', loop }, a = designGrand(input, asset, { library }), b = designGrand(input, asset, { library }), m = measure(a, { loop });
    if (channelHash(input.channels) !== before || channelHash(a.channels) !== channelHash(b.channels) || !m.finite || m.peak > .75005 || Object.entries(library).some(([id, item]) => channelHash(item.channels) !== libraryBefore[id])) throw new Error('Determinism/main/library preservation/finite/peak failed');
    const base = a.recipe.baseRecipe, expected = loop ? channel.length : Math.ceil(channel.length / base.pitchRatio) + Math.round(base.tailSeconds * 44100) + Math.round(a.recipe.extraTailSeconds * 44100);
    if (a.channels[0].length !== expected || (loop && m.seam > .012)) throw new Error('Pitch/tail/loop length failed');
    return { frames: a.channels[0].length, expectedFrames: expected, basePitchRatio: base.pitchRatio, baseTailSeconds: base.tailSeconds, extraTailSeconds: a.recipe.extraTailSeconds, sourceLibraryEntries: Object.keys(library).length, peak: m.peak, seam: m.seam };
  });
  return results;
}

export async function verify({ packDirectory = PACK, write = true } = {}) {
  const catalogBytes = await readFile(path.join(packDirectory, 'catalog.json')), catalog = JSON.parse(catalogBytes), priorCatalog = JSON.parse(await readFile(path.join(ROOT, 'outputs/audio-rich-v2/catalog.json'))), known = new Map(priorCatalog.assets.map(asset => [asset.id, asset]));
  const checks = [], assets = [], receiptCache = new Map(), check = (id, passed, detail = {}) => checks.push({ id, passed: Boolean(passed), ...detail });
  check('49_exact_previous_ids', catalog.assets?.length === 49 && new Set(catalog.assets.map(asset => asset.id)).size === 49 && catalog.assets.every(asset => known.has(asset.id)));
  check('v3_prototype_reference_retained_in_new_catalog', Array.isArray(catalog.preservedPrototypes) && catalog.preservedPrototypes.some(item => item.sha256 === V3_SHA256 && item.files === 117));
  const library = {}, libraryRegistry = new Map();
  for (const asset of catalog.assets) {
    const bytes = await readFile(local(ROOT, asset.processingSource.path)), pcm = readProcessingWav(bytes), contentHash = sha256(bytes);
    library[asset.id] = { channels: pcm.channels, sampleRate: pcm.sampleRate, sha256: contentHash };
    libraryRegistry.set(asset.id, { path: asset.processingSource.path, bytes, pcm, sha256: contentHash });
  }
  check('49_actual_float_library_sources', libraryRegistry.size === 49 && catalog.assets.every(asset => libraryRegistry.get(asset.id)?.sha256 === asset.processingSource.sha256));
  for (const asset of catalog.assets || []) {
    const item = { id: asset.id, checks: [], passed: false }, cueCheck = (id, passed, detail = {}) => item.checks.push({ id, passed: Boolean(passed), ...detail });
    try {
      const sourceBytes = await readFile(local(packDirectory, asset.source.file)), registered = libraryRegistry.get(asset.id), processingBytes = registered.bytes, outputBytes = await readFile(local(packDirectory, asset.file));
      const source = readPcm16Wav(sourceBytes), processing = registered.pcm, output = readPcm16Wav(outputBytes), prior = known.get(asset.id), recipe = asset.recipe;
      item.source = { role: 'previous v2 comparison only', file: asset.source.file, bytes: sourceBytes.length, sha256: sha256(sourceBytes), ...measure(source, { loop: asset.loop }), roughness: roughness(source) };
      item.processingSource = { role: 'first MP3 Float32 decode used for fresh redesign', file: asset.processingSource.path, bytes: processingBytes.length, sha256: sha256(processingBytes), originalMp3Sha256: asset.processingSource.originalMp3Sha256, ...measure(processing, { loop: asset.loop }) };
      item.output = { file: asset.file, bytes: outputBytes.length, sha256: sha256(outputBytes), ...measure(output, { loop: asset.loop }), roughness: roughness(output) };
      cueCheck('comparison_source_exact_previous_v2', item.source.sha256 === prior.sha256 && item.source.sha256 === asset.source.sha256 && item.source.bytes === prior.bytes);
      cueCheck('fresh_float_processing_source_hash', item.processingSource.sha256 === asset.processingSource.sha256 && /^[a-f0-9]{64}$/i.test(asset.processingSource.originalMp3Sha256 || ''), { originalMp3HashMeaning: 'Provenance reference, not a fresh MP3 decode or provider request.' });
      const originalMp3Bytes = await readFile(local(ROOT, asset.processingSource.originalMp3Relative));
      cueCheck('underlying_mp3_provenance_hash', sha256(originalMp3Bytes) === asset.processingSource.originalMp3Sha256, { file: asset.processingSource.originalMp3Relative, bytes: originalMp3Bytes.length });
      const receiptPath = asset.processingSource.decodingReceipt;
      if (!receiptCache.has(receiptPath)) receiptCache.set(receiptPath, JSON.parse(await readFile(local(ROOT, receiptPath))));
      const receiptClip = receiptCache.get(receiptPath).clips?.find(clip => clip.id === asset.id);
      cueCheck('first_decode_receipt_couples_original_to_float', receiptClip?.sha256 === item.processingSource.sha256 && receiptClip?.sourceSha256 === asset.processingSource.originalMp3Sha256 && receiptClip?.frames === processing.frames && receiptClip?.path === asset.processingSource.path, { receipt: receiptPath, note: 'Existing native-decoding receipt, verified against actual MP3 and float files. This QA performs no decode.' });
      cueCheck('output_hash_bytes', (!asset.sha256 || asset.sha256 === item.output.sha256) && (!asset.bytes || asset.bytes === item.output.bytes));
      cueCheck('finite_audible_peak_dc_no_clipping', item.output.finite && item.output.rms > .00001 && item.output.peak <= .75005 && item.output.clippedSamples === 0 && Math.abs(item.output.dc) <= .01, { peak: item.output.peak, rms: item.output.rms, dc: item.output.dc });
      cueCheck('channels_rate_preserved', output.sampleRate === processing.sampleRate && output.channels.length === processing.channels.length);
      const baseRecipe = recipe?.baseRecipe, ratio = baseRecipe?.pitchRatio, tail = baseRecipe?.tailSeconds, extraTail = recipe?.extraTailSeconds;
      const baseFrames = asset.loop ? processing.frames : Math.ceil(processing.frames / ratio) + Math.round(tail * processing.sampleRate), expectedFrames = asset.loop ? processing.frames : baseFrames + Math.round(extraTail * processing.sampleRate);
      item.timing = { processingFrames: processing.frames, comparisonFrames: source.frames, outputFrames: output.frames, expectedFrames, baseFrames, basePitchRatio: ratio, baseTailSeconds: tail, extraTailSeconds: extraTail, outputVsProcessingDurationRatio: output.frames / processing.frames };
      cueCheck('base_pitch_body_space_and_composition_metadata_separate', ratio > 0 && ratio <= 1 && Number.isFinite(tail) && tail >= 0 && tail <= 1.2 && Number.isFinite(extraTail) && extraTail >= 0 && extraTail <= 2.5 && !!baseRecipe.body && !!baseRecipe.space?.earlyReflections && !!baseRecipe.space?.diffusion && !!baseRecipe.dynamics && Array.isArray(recipe.stems) && recipe.stems.length > 0, { note: 'V3 base stages and new material-fragment composition remain separately declared. They do not numerically certify a requested dramatic quality.' });
      item.stems = (recipe.stems || []).map(stem => {
        const donor = libraryRegistry.get(stem.id);
        const sourceHash = stem.sourceSha256 || stem.sha256, donorPath = stem.processingPath || stem.sourcePath;
        const fragmentBounded = Number.isFinite(stem.fragmentSeconds) && stem.fragmentSeconds > 0 && (asset.loop ? Math.abs(stem.fragmentSeconds - output.duration * stem.rate) <= .001 : stem.fragmentSeconds <= 2.5);
        return { id: stem.id, role: stem.role, sourceSha256: sourceHash, processingPath: donorPath, offsetSeconds: stem.offsetSeconds, fragmentMode: stem.fragmentMode, fragmentSeconds: stem.fragmentSeconds, rate: stem.rate, sourceStartSeconds: stem.sourceStartSeconds, donorDuration: donor?.pcm.duration, passed: !!donor && sourceHash === donor.sha256 && (!stem.sha256 || stem.sha256 === donor.sha256) && (!donorPath || donorPath === donor.path) && typeof stem.role === 'string' && !!stem.role && !/^fire-/.test(stem.id) && Number.isFinite(stem.offsetSeconds) && stem.offsetSeconds >= 0 && fragmentBounded && Number.isFinite(stem.rate) && stem.rate > 0 && stem.rate <= 2 };
      });
      cueCheck('all_composed_material_stems_have_real_library_provenance', item.stems.length > 0 && item.stems.every(stem => stem.passed), { donorIds: [...new Set(item.stems.map(stem => stem.id))], note: 'Actual material donors are checked by ID/SHA; complete fire-* donors are prohibited. Fragment identity does not imply a new gameplay shot.' });
      if (Number.isFinite(asset.metrics?.expectedFrames)) cueCheck('render_expected_frames_matches_independent_formula', asset.metrics.expectedFrames === expectedFrames);
      cueCheck('pitch_tail_frame_formula', output.frames === expectedFrames, item.timing);
      if (asset.loop) cueCheck('loop_duration_boundary', output.frames === source.frames && output.frames === processing.frames && item.output.seam <= .012, { sampleSeam: item.output.seam, edgeProbe: item.output.edgeProbe });
      else cueCheck('one_shot_edges_tapered', item.output.first <= .002 && item.output.last <= .002, { first: item.output.first, last: item.output.last });
      item.comparison = { versusV2: nonGainDifference(source, output), versusFreshProcessing: nonGainDifference(processing, output), equalRmsLowMid80_350Ratio: item.output.lowMid80_350.fraction / Math.max(item.source.lowMid80_350.fraction, 1e-30), equalRmsLowMid100_350Ratio: item.output.lowMid100_350.fraction / Math.max(item.source.lowMid100_350.fraction, 1e-30), firstDifferenceProxyRatio: item.output.roughness.firstDifferenceEnergyFraction / Math.max(item.source.roughness.firstDifferenceEnergyFraction, 1e-30), note: 'Spectrum-proxy and residual changes are descriptions, not a pass criterion for grandeur or dramatic quality.' };
      cueCheck('changed_beyond_uniform_gain', item.comparison.versusV2.nonGainEnergyFraction > 1e-6 && item.comparison.versusFreshProcessing.nonGainEnergyFraction > 1e-6);
      cueCheck('mono_finite_and_audible', item.output.mono.finite && item.output.mono.rms > .000001, { rms: item.output.mono.rms });
      cueCheck('candidate_not_human_approved_or_game_installed', asset.humanApproved !== true && asset.gameplayInstalled !== true);
      item.passed = item.checks.every(result => result.passed);
    } catch (error) { item.error = error.message; }
    assets.push(item);
  }
  const boundaries = [await preservation(V2_MANIFEST, V2_SHA256, 120), await preservation(V3_MANIFEST, V3_SHA256, 117)];
  for (const boundary of boundaries) check(`preserved_${boundary.manifest}`, boundary.passed, { listed: boundary.listedCount, includingManifest: boundary.countIncludingManifest });
  const baseDspBytes = await readFile(new URL('./base-dsp.mjs', import.meta.url));
  const expectedBaseSha256 = '1b6dcc001725656f752fc6271fd3ef7957a5c68e91d8a233b33bc5df6794bd90';
  check('base_dsp_exact_frozen_v3', sha256(baseDspBytes) === expectedBaseSha256);
  checks.push(...await verifyDspFixtures(library));
  const machinegun = await renderMix(packDirectory, catalog.assets, Array(6).fill('fire-machinegun'), Array.from({ length: 6 }, (_, i) => i * .22), { purpose: 'Six machinegun cues at actual preview interval; observe true frame overlap of redesigned duration.', interval: .22 });
  check('actual_six_machinegun_uncapped_mix', machinegun.passed && machinegun.startedSources === 6 && machinegun.evictedSources === 0, { mix: machinegun });
  const threeCue = await renderMix(packDirectory, catalog.assets, ['lift-warning', 'hit-wood', 'fire-cannon'], [0, 0, 0], { purpose: 'Warning/wood impact/cannon simultaneous numerical mixture; no human identification claim.' });
  check('actual_three_cue_uncapped_mix', threeCue.passed && threeCue.maximumFrameOverlap === 3, { mix: threeCue });
  const pairedAuditions = await verifyPairedAuditions(packDirectory);
  check('five_actual_paired_auditions_rms_gain_peak', pairedAuditions.passed, { count: pairedAuditions.count });
  check('all49_asset_checks', assets.length === 49 && assets.every(asset => asset.passed));
  const all = [...checks, ...assets.flatMap(asset => asset.checks), ...pairedAuditions.pairs.flatMap(pair => pair.checks)], valid = assets.filter(asset => asset.output);
  const report = { schema: 'cloudstitch-audio-grand-v4-file-qa/v1', createdAt: new Date().toISOString(), passed: all.every(item => item.passed), total: all.length, passCount: all.filter(item => item.passed).length, catalogSha256: sha256(catalogBytes), dspSha256: sha256(await readFile(new URL('./dsp.mjs', import.meta.url))), baseDspSha256: sha256(baseDspBytes), measurementHelper: { file: 'tools/audio/rich-v2/verify.mjs', sha256: sha256(await readFile(new URL('../rich-v2/verify.mjs', import.meta.url))), coveredByPreservedV2Manifest: true }, method: 'Actual WAV/Float32 samples, source-role-separated hashes, material-library donor ID/SHA, frozen V3 base, derived frame/tail formula, safety/mono/edge probes, non-gain residual, input/library preservation fixtures and uncapped actual-file sums. No numeric tenfold/grandeur score.', summary: { assets: assets.length, pcm16Bytes: valid.reduce((sum, asset) => sum + asset.output.bytes, 0), maximumPeak: Math.max(...valid.map(asset => asset.output.peak)), loopCount: catalog.assets.filter(asset => asset.loop).length, paidRequests: 0, browserRuns: 0, humanApproval: false, gameInstalled: false }, checks, assets, preservation: boundaries, libraryRegistry: [...libraryRegistry].map(([id, item]) => ({ id, path: item.path, sha256: item.sha256, frames: item.pcm.frames, sampleRate: item.pcm.sampleRate })), limits: ['Tenfold/grand/rich/dramatic character requires listening; no signal statistic approves those qualities.', 'Frequency, RMS, first-difference, DC and sample-peak measurements are not LUFS, device true peak, timbre approval or headphone QA.', 'A zero sample seam and bounded 5 ms edge metrics do not certify a seamless perceived loop.', 'Raw mixtures use no voice cap and can exceed unity; separate fixed headroom results do not establish the actual runtime mix.', 'Processing originals are existing first-decode Float32 files. This QA performs no new native decode, browser run or provider call.'] };
  report.pairedAuditions = pairedAuditions;
  if (write) { await mkdir(packDirectory, { recursive: true }); await writeFile(path.join(packDirectory, 'file-verification.json'), `${JSON.stringify(report, null, 2)}\n`); }
  return report;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { const report = await verify({ packDirectory: process.argv[2] ? path.resolve(process.argv[2]) : PACK }); console.log(JSON.stringify({ passed: report.passed, total: report.total, passCount: report.passCount, summary: report.summary, failedChecks: report.checks.filter(item => !item.passed), failedAssets: report.assets.filter(item => !item.passed).map(item => ({ id: item.id, error: item.error, checks: item.checks.filter(check => !check.passed) })) })); if (!report.passed) process.exitCode = 1; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
