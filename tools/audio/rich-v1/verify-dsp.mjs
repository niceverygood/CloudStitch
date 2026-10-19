import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { enrichPcm, getRecipe } from './dsp.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const OUT = path.join(REPO, 'outputs/audio-rich-v1/dsp-verification.json');
const checksum = channels => { const sha = createHash('sha256'); for (const ch of channels) sha.update(Buffer.from(ch.buffer, ch.byteOffset, ch.byteLength)); return sha.digest('hex'); };

function fixture(kind, { sampleRate = 44100, frames = 13230, stereo = true } = {}) {
  let seed = 0x81c31ab;
  const left = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const noise = ((seed >>> 0) / 4294967295 - 0.5) * 2;
    if (kind === 'sine') left[i] = 0.25 * Math.sin(t * Math.PI * 2 * 730);
    if (kind === 'noise') left[i] = noise * 0.2;
    if (kind === 'onset' && i > 220) left[i] = (noise * 0.18 + Math.sin(t * Math.PI * 2 * 440) * 0.13) * Math.exp(-(t - 0.005) * 15);
    if (kind === 'dc') left[i] = 0.3;
  }
  return { channels: stereo ? [left, Float32Array.from(left, (value, i) => value * (0.75 + 0.05 * Math.sin(i / 107)))] : [left], sampleRate };
}

function properties(output) {
  let peak = 0, energy = 0, seam = 0, finite = true, samples = 0;
  for (const ch of output.channels) {
    assert(ch instanceof Float32Array, 'channel type');
    seam = Math.max(seam, Math.abs(ch[0] - ch.at(-1)));
    for (const sample of ch) { finite &&= Number.isFinite(sample); peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; samples++; }
  }
  return { finite, peak, rms: Math.sqrt(energy / samples), seam, frames: output.channels[0].length, channels: output.channels.length };
}

export async function verifyDsp({ write = true } = {}) {
  const checks = [];
  const check = async (id, fn) => {
    try { const detail = await fn(); checks.push({ id, passed: true, ...(detail || {}) }); }
    catch (error) { checks.push({ id, passed: false, error: error.message }); }
  };
  const cues = [
    { id: 'fire-machinegun', category: 'weapon', loop: false },
    { id: 'fire-cannon', category: 'weapon', loop: false },
    { id: 'mortar-launch-a', category: 'weapon', loop: false },
    { id: 'hit-cloth', category: 'impact', loop: false },
    { id: 'hit-armor', category: 'impact', loop: false },
    { id: 'salvage-complete', category: 'salvage', loop: false },
    { id: 'engine-cruise-loop', category: 'ambience', loop: true },
    { id: 'wind-calm-loop', category: 'ambience', loop: true },
    { id: 'lift-warning', category: 'warning', loop: false },
    { id: 'harbor-repair', category: 'harbor', loop: false },
    { id: 'ui-hover', category: 'ui', loop: false }
  ];
  for (const kind of ['zero', 'sine', 'noise', 'onset', 'dc']) {
    for (const loop of [false, true]) await check(`${kind}_${loop ? 'loop' : 'oneshot'}_finite_shape_determinism`, () => {
      const input = fixture(kind), before = checksum(input.channels), asset = { id: loop ? 'engine-cruise-loop' : 'fire-cannon', category: loop ? 'ambience' : 'weapon', loop };
      const a = enrichPcm(input, asset), b = enrichPcm(input, asset), m = properties(a);
      assert.equal(checksum(input.channels), before, 'Input mutated');
      assert.equal(checksum(a.channels), checksum(b.channels), 'Not deterministic');
      assert(m.finite, 'Non-finite PCM'); assert(m.peak <= 0.86001, 'Peak exceeds headroom');
      assert.equal(a.sampleRate, input.sampleRate); assert.equal(m.channels, input.channels.length);
      if (loop) { assert.equal(m.frames, input.channels[0].length, 'Loop duration changed'); assert(m.seam <= 0.012, 'Loop sample boundary discontinuity'); }
      else { assert(m.frames >= input.channels[0].length, 'One-shot truncated'); assert(m.frames <= input.channels[0].length + input.sampleRate * 0.65, 'Tail excessive'); for (const ch of a.channels) { assert(Math.abs(ch[0]) <= 0.002, 'Start not tapered'); assert(Math.abs(ch.at(-1)) <= 0.002, 'End not tapered'); } }
      if (kind === 'zero') assert.equal(m.peak, 0, 'Silence gained a synthetic sound');
      return { ...m, sourceFrames: input.channels[0].length, sha256: checksum(a.channels) };
    });
  }
  for (const cue of cues) await check(`${cue.id}_bass_off_and_budget`, () => {
    const input = fixture('onset');
    const full = enrichPcm(input, cue), noBass = enrichPcm(input, cue, { bass: 0 });
    assert.equal(noBass.metrics.addedBass.energy, 0, 'bass=0 still adds a bass layer');
    assert(Number.isFinite(full.metrics.addedBass.relativeEnergy), 'Missing layer energy budget');
    assert(Number.isFinite(full.metrics.addedBass.limit) && full.metrics.addedBass.limit <= 0.024001, 'Missing or excessive declared bass budget');
    assert(full.metrics.addedBass.relativeEnergy <= full.metrics.addedBass.limit * 1.0001 + 1e-9, 'Bass layer energy exceeds its material-specific budget');
    if (full.metrics.addedBass.energy > 0) assert.notEqual(checksum(full.channels), checksum(noBass.channels), 'Bass switch makes no PCM difference');
    return { addedBass: full.metrics.addedBass, noBassEnergy: noBass.metrics.addedBass.energy, recipe: getRecipe(cue) };
  });
  await check('strength_zero_no_added_tail_or_bass', () => {
    const input = fixture('onset'), output = enrichPcm(input, cues[1], { strength: 0 });
    assert.equal(output.channels[0].length, input.channels[0].length);
    assert.equal(output.metrics.addedBass.energy, 0);
    return { note: 'Strength zero still allows the documented cleanup/high-pass and peak treatment; it is not a byte identity mode.' };
  });
  await check('different_material_recipes_and_pcm', () => {
    const input = fixture('onset');
    const a = enrichPcm(input, cues.find(cue => cue.id === 'hit-cloth'));
    const b = enrichPcm(input, cues.find(cue => cue.id === 'hit-armor'));
    assert.notEqual(checksum(a.channels), checksum(b.channels), 'Cloth/armor treatment identical');
    assert.notDeepEqual(getRecipe(cues.find(cue => cue.id === 'hit-cloth')), getRecipe(cues.find(cue => cue.id === 'hit-armor')));
    return { note: 'Numerical difference only, not human material recognition.' };
  });
  await check('mono_and_48k_shape_preserved', () => {
    const input = fixture('noise', { sampleRate: 48000, frames: 9600, stereo: false });
    const output = enrichPcm(input, { id: 'wind-calm-loop', category: 'ambience', loop: true });
    assert.equal(output.channels.length, 1); assert.equal(output.sampleRate, 48000); assert.equal(output.channels[0].length, 9600);
    assert(properties(output).finite);
  });
  await check('invalid_settings_recover_to_finite', () => {
    const input = fixture('noise');
    for (const options of [{ strength: NaN, bass: NaN }, { strength: Infinity, bass: -Infinity }, { strength: -99, bass: 99 }]) {
      const result = enrichPcm(input, cues[0], options), m = properties(result);
      assert(m.finite && m.peak <= 0.86001, 'Invalid controls produced unsafe samples');
    }
  });
  await check('short_and_empty_input_boundary', () => {
    for (const length of [1, 2, 40]) {
      const input = { channels: [Float32Array.from({ length }, () => 0.1)], sampleRate: 44100 };
      const output = enrichPcm(input, { id: 'ui-hover', category: 'ui', loop: true });
      assert.equal(output.channels[0].length, length); assert(properties(output).finite);
    }
    let emptyRejected = false;
    try { const output = enrichPcm({ channels: [new Float32Array(0)], sampleRate: 44100 }, cues[0]); emptyRejected = !output.channels[0].length; } catch { emptyRejected = true; }
    assert(emptyRejected, 'Empty input became a manufactured sound');
  });
  let dspSha256 = null;
  try { dspSha256 = createHash('sha256').update(await readFile(new URL('./dsp.mjs', import.meta.url))).digest('hex'); } catch {}
  const report = { version: 'audio-rich-v1-dsp-fixtures', createdAt: new Date().toISOString(), passed: checks.every(check => check.passed), total: checks.length, passedCount: checks.filter(check => check.passed).length, dspSha256, scope: 'Deterministic local DSP fixtures only. No provider requests, browser playback, human listening, or game installation.', checks, humanListening: 'not_performed', limits: ['Numeric fixtures check processing boundaries and bass-layer budget, not dramatic quality or source suitability.', 'Sample peak is not inter-sample true peak or LUFS.', 'Loop sample seam tests do not certify a perceptually seamless loop.'] };
  if (write) { await mkdir(path.dirname(OUT), { recursive: true }); await writeFile(OUT, `${JSON.stringify(report, null, 2)}\n`); }
  return report;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { const report = await verifyDsp(); console.log(JSON.stringify({ passed: report.passed, total: report.total, passedCount: report.passedCount, failed: report.checks.filter(check => !check.passed) })); if (!report.passed) process.exitCode = 1; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
