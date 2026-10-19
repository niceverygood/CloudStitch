/**
 * Cloudstitch richer SFX, revision 1. Pure deterministic PCM processing.
 * No decoding, browser, network, provider, gameplay state, or file I/O here.
 * Original attacks are retained: reflections stay below 41 ms and new bass
 * pulses follow measured attacks, never an invented firing/metronome timeline.
 * Candidate processing, not human listening approval or a final game mix.
 */

export const DSP_VERSION = 'cloudstitch-rich-dsp-v1.0.0';
const TAU = Math.PI * 2;
const EPS = 1e-20;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const finiteOption = (x, fallback, lo, hi) => Number.isFinite(x) ? clamp(x, lo, hi) : fallback;
const sumEnergy = buffer => {
  let energy = 0;
  for (let i = 0; i < buffer.length; i++) energy += buffer[i] * buffer[i];
  return energy;
};
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// [material body frequency, material overtone, body wet, early-room wet,
//  bass frequency, bass decay, bass peak relative to source, one-shot tail]
// Every cue has its own recipe. Values describe material support, not a new
// impact, extra gun shot, music note, flight sound, or warning beep.
const CUES = {
  'fire-machinegun': [280, 1750, .17, .09, 94, .052, .075, .045],
  'machinegun-feed': [430, 2330, .14, .08, 97, .040, .035, .035],
  'fire-cannon': [154, 710, .25, .17, 68, .132, .145, .160],
  'cannon-breech': [325, 1320, .20, .10, 90, .067, .065, .080],
  'fire-mortar': [194, 920, .23, .14, 79, .092, .105, .100],
  'mortar-launch-a': [214, 1090, .21, .105, 82, .074, .095, .085],
  'mortar-launch-b': [177, 810, .24, .125, 76, .092, .112, .105],
  'mortar-fall': [670, 2570, .12, .14, 100, .048, .025, .100],
  'fire-harpoon': [355, 1620, .19, .12, 91, .070, .075, .080],
  'harpoon-embed': [252, 1490, .23, .13, 86, .095, .100, .100],
  'harpoon-tension-loop': [460, 1210, .15, .08, 96, .065, .028, 0],
  'fire-chain': [286, 1880, .20, .13, 88, .084, .090, .100],
  'chain-spin': [525, 2470, .15, .11, 99, .055, .040, .065],
  'flame-ignite': [240, 1020, .21, .12, 84, .076, .092, .090],
  'flame-spray-loop': [235, 1560, .17, .11, 90, .080, .032, 0],
  'flame-stop': [370, 1850, .15, .08, 97, .050, .045, .055],
  'hit-wood': [235, 830, .26, .15, 83, .085, .100, .100],
  'hit-cloth': [480, 1810, .12, .075, 100, .040, .025, .055],
  'hit-armor': [390, 2140, .23, .12, 92, .073, .080, .110],
  'hit-engine': [182, 1310, .25, .14, 76, .101, .110, .120],
  'mortar-impact': [146, 650, .27, .18, 64, .140, .150, .180],
  'connector-cut': [560, 2380, .17, .10, 96, .045, .040, .070],
  'module-break': [204, 1050, .25, .16, 77, .100, .110, .140],
  'bundle-detach': [276, 1170, .23, .14, 84, .092, .085, .120],
  'winch-loop': [254, 1450, .19, .10, 91, .075, .033, 0],
  'salvage-complete': [310, 1740, .19, .13, 94, .070, .058, .100],
  'cargo-drop': [193, 925, .25, .15, 78, .098, .105, .110],
  'bundle-lost': [411, 1550, .14, .14, 94, .068, .050, .110],
  'engine-idle-loop': [174, 690, .20, .08, 79, .100, .034, 0],
  'engine-cruise-loop': [217, 985, .22, .095, 87, .088, .039, 0],
  'wind-calm-loop': [510, 1820, .08, .13, 97, .075, .012, 0],
  'wind-fast-loop': [430, 2290, .10, .14, 96, .080, .018, 0],
  'hull-creak-loop': [196, 940, .22, .12, 86, .105, .031, 0],
  'harbor-workshop-loop': [330, 1455, .16, .14, 94, .075, .020, 0],
  'lift-danger-loop': [520, 2140, .13, .075, 98, .055, .018, 0],
  'lift-warning': [640, 2490, .12, .065, 100, .045, .025, .055],
  'incoming-warning': [810, 2840, .11, .060, 100, .042, .023, .050],
  'defeat': [221, 1075, .20, .15, 75, .115, .080, .140],
  'return': [350, 1490, .18, .145, 94, .075, .053, .120],
  'harbor-repair': [295, 1840, .21, .10, 93, .065, .063, .075],
  'harbor-equip': [314, 1730, .22, .11, 90, .072, .068, .085],
  'harbor-store': [245, 1030, .20, .105, 87, .076, .064, .090],
  'harbor-depart': [384, 1710, .19, .14, 91, .080, .061, .105],
  'save-ok': [700, 2140, .105, .065, 100, .043, .022, .045],
  'ui-fail': [540, 1760, .105, .045, 98, .040, .023, .035],
  'ui-hover': [940, 2670, .065, .035, 100, .028, .010, .018],
  'ui-confirm': [660, 2450, .105, .060, 100, .040, .023, .040],
  'ui-back': [610, 1930, .085, .045, 100, .035, .018, .030],
  'restore-ok': [620, 2290, .11, .075, 98, .047, .025, .050]
};
const MATERIALS = {
  wood: ['목재의 짧은 몸체 공명', 1350, .065],
  cloth: ['천·바람의 부드러운 마찰층', 3300, .050],
  brass: ['황동·금속의 짧은 배음', 2900, .065],
  engine: ['부드러운 기계 몸체와 압력', 2100, .060],
  pressure: ['포신의 압력과 짧은 몸체', 1950, .055],
  warning: ['원래 경고의 중고역 가독성', 3100, .035],
  ui: ['작은 조작감과 짧은 공간', 2700, .030]
};
function materialFor(id, category) {
  if (category === 'warning' || /warning|danger/.test(id)) return 'warning';
  if (category === 'ui' || /^ui-|save-ok|restore-ok/.test(id)) return 'ui';
  if (/cloth|wind|mortar-fall/.test(id)) return 'cloth';
  if (/wood|cargo|hull|bundle|module/.test(id)) return 'wood';
  if (/engine|flame|winch/.test(id)) return 'engine';
  if (/cannon|mortar|fire-machinegun/.test(id)) return 'pressure';
  return 'brass';
}

function categoryFor(id) {
  if (/^ui-|^(?:save|restore)-ok$/.test(id)) return 'ui';
  if (/warning|danger|^defeat$/.test(id)) return 'warning';
  if (/^(?:engine-|wind-|hull-creak|harbor-workshop)/.test(id)) return 'ambience';
  if (/^harbor-|^return$/.test(id)) return 'harbor';
  if (/^(?:bundle-|winch-|salvage-|cargo-)/.test(id)) return 'salvage';
  if (/^(?:hit-|mortar-impact|connector-cut|module-break)/.test(id)) return 'impact';
  if (/^(?:fire-|machinegun-|cannon-|mortar-|harpoon-|chain-|flame-)/.test(id)) return 'weapon';
  return 'sfx';
}

/** Return an independent, JSON-safe cue recipe. Input can be an ID or asset. */
export function getRecipe(asset = {}) {
  const source = typeof asset === 'string' ? {id: asset} : (asset || {});
  const id = String(source.id || 'unidentified-cue');
  const category = String(source.category || categoryFor(id));
  const loop = source.loop === true || /(?:^|-)loop$/.test(id);
  const material = materialFor(id, category);
  const fallback = category === 'ui' ? CUES['ui-confirm']
    : category === 'warning' ? CUES['lift-warning']
      : category === 'ambience' ? CUES['hull-creak-loop'] : CUES['hit-wood'];
  const [bodyHz, overtoneHz, bodyMix, roomMix, bassHz, bassDecay, bassMix, tail] = CUES[id] || fallback;
  const [description, airHz, airMix] = MATERIALS[material];
  const seed = hash(id);
  const bassLimit = category === 'ambience' || loop ? .004 : category === 'ui' ? .003 : category === 'warning' ? .004 : .024;
  return {
    version: DSP_VERSION, id, category, material, loop, seed,
    description,
    body: [{hz: bodyHz, q: 1.2, mix: bodyMix}, {hz: overtoneHz, q: 1.7, mix: bodyMix * .48}],
    saturation: {drive: material === 'pressure' || material === 'engine' ? 1.65 : 1.35,
      cutoffHz: material === 'cloth' ? 2000 : 1450, mix: category === 'ui' ? .06 : .12},
    air: {cutoffHz: airHz, mix: airMix},
    reflections: [
      {seconds: .007 + (seed % 6) * .001, gain: roomMix * .62},
      {seconds: .017 + ((seed >>> 4) % 9) * .001, gain: roomMix * .36},
      {seconds: .032 + ((seed >>> 8) % 9) * .001, gain: roomMix * .18}
    ],
    bass: {mode: loop ? 'source-following-resonance' : 'measured-attack-pulses',
      hz: bassHz, decaySeconds: bassDecay, mix: bassMix, maxEnergyRatio: bassLimit,
      onsetMinIntervalSeconds: /^fire-machinegun$/.test(id) ? .15 : .11,
      // No pulse is scheduled by duration, weapon cooldown, or a beat grid.
      maxPulseSeconds: Math.min(category === 'ui' ? .06 : .23, bassDecay * 2.5)},
    highpassHz: 35, targetPeak: .79, absolutePeakLimit: .85,
    loudnessEnergyRatio: category === 'warning' ? 1.035 : category === 'ambience' ? 1.065 : 1.105,
    tailSeconds: loop ? 0 : Math.min(.18, tail),
    edgeFadeSeconds: {in: category === 'ui' ? .0015 : .002, out: .006},
    seamSeconds: .005,
    loopSeamMethod: 'symmetric-boundary-crossblend; fixed length; no silent edge taper',
    limits: ['원음과 공격 횟수 보존', '배경에 새 박자·음악 없음', '사람 청취 승인 전 후보']
  };
}

function coefficients(type, sampleRate, hz, q = Math.SQRT1_2) {
  const w = TAU * clamp(hz, 5, sampleRate * .44) / sampleRate;
  const cosine = Math.cos(w), sine = Math.sin(w), alpha = sine / (2 * q), a0 = 1 + alpha;
  let b0, b1, b2;
  if (type === 'highpass') { b0 = (1 + cosine) / 2; b1 = -(1 + cosine); b2 = b0; }
  else if (type === 'bandpass') { b0 = alpha; b1 = 0; b2 = -alpha; }
  else { b0 = (1 - cosine) / 2; b1 = 1 - cosine; b2 = b0; }
  return [b0 / a0, b1 / a0, b2 / a0, -2 * cosine / a0, (1 - alpha) / a0];
}

// Direct form II transposed, warm the state around the same periodic source
// for loops. Circular reflection taps also use the original full duration.
function filter(input, sampleRate, type, hz, q, loop = false) {
  const [b0, b1, b2, a1, a2] = coefficients(type, sampleRate, hz, q);
  const output = new Float32Array(input.length);
  let z1 = 0, z2 = 0;
  const warmCycles = loop ? Math.min(16, Math.max(2, Math.ceil(sampleRate * .3 / input.length))) : 0;
  for (let pass = 0; pass <= warmCycles; pass++) {
    for (let i = 0; i < input.length; i++) {
      const y = b0 * input[i] + z1;
      z1 = b1 * input[i] - a1 * y + z2;
      z2 = b2 * input[i] - a2 * y;
      if (pass === warmCycles) output[i] = y;
    }
  }
  return output;
}

function seamCrossblend(channel, fadeFrames) {
  const n = Math.min(Math.floor(channel.length / 4), Math.max(1, fadeFrames));
  // Cross the two existing boundary neighborhoods. At the wrap both sides
  // converge to the same pair average, without fading a loop to silence.
  for (let i = 0; i < n; i++) {
    const left = channel[i], right = channel[channel.length - 1 - i];
    const wet = .25 * (1 + Math.cos(Math.PI * i / n));
    channel[i] = left * (1 - wet) + right * wet;
    channel[channel.length - 1 - i] = right * (1 - wet) + left * wet;
  }
}

function fadeEdges(channel, sampleRate, attack, release) {
  const a = Math.min(channel.length / 3, Math.max(2, Math.round(sampleRate * attack)));
  const r = Math.min(channel.length / 3, Math.max(2, Math.round(sampleRate * release)));
  for (let i = 0; i < a; i++) channel[i] *= Math.sin(Math.PI * .5 * i / a) ** 2;
  for (let i = 0; i < r; i++) channel[channel.length - 1 - i] *= Math.sin(Math.PI * .5 * i / r) ** 2;
}

function inspect(channels, sampleRate) {
  let energy = 0, peak = 0, finite = true, lfEnergy = 0, seam = 0, dcSum = 0;
  for (const channel of channels) {
    const safe = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      const x = channel[i];
      if (!Number.isFinite(x)) {finite = false; continue;}
      safe[i] = x;
      energy += x * x; dcSum += x; peak = Math.max(peak, Math.abs(x));
    }
    seam = Math.max(seam, Math.abs((safe[0] || 0) - (safe[safe.length - 1] || 0)));
    lfEnergy += sumEnergy(filter(safe, sampleRate, 'lowpass', 160, Math.SQRT1_2));
  }
  const samples = channels.length * channels[0].length;
  return {peak, rms: Math.sqrt(energy / samples), energy, finite, seam,
    lfEnergy, lfEnergyRatio: lfEnergy / Math.max(EPS, energy), dc: dcSum / samples,
    lfEnergyEstimator: '160 Hz second-order lowpass energy; not a brick-wall spectral integral',
    frames: channels[0].length, channels: channels.length, duration: channels[0].length / sampleRate};
}

function monoEnvelope(channels, sampleRate, loop) {
  const n = channels[0].length;
  const envelope = new Float32Array(n);
  const attack = Math.exp(-1 / (sampleRate * .0015));
  const release = Math.exp(-1 / (sampleRate * .026));
  let follower = 0;
  for (let pass = 0; pass < (loop ? 3 : 1); pass++) {
    for (let i = 0; i < n; i++) {
      let absolute = 0;
      // Absolute channel mean cannot cancel when source stereo is out of phase.
      for (const channel of channels) absolute += Math.abs(channel[i]) / channels.length;
      const coefficient = absolute > follower ? attack : release;
      follower = coefficient * follower + (1 - coefficient) * absolute;
      if (!loop || pass === 2) envelope[i] = follower;
    }
  }
  return envelope;
}

function bassLayer(base, sampleRate, recipe, strength, bassStrength) {
  const n = base[0].length, envelope = monoEnvelope(base, sampleRate, recipe.loop);
  const bass = new Float32Array(n);
  let peakEnvelope = 0;
  for (let i = 0; i < n; i++) peakEnvelope = Math.max(peakEnvelope, envelope[i]);
  const baseEnergy = base.reduce((total, channel) => total + sumEnergy(channel), 0) / base.length;
  const limit = recipe.bass.maxEnergyRatio;
  if (!strength || !bassStrength || peakEnvelope < 1e-9 || baseEnergy < EPS) {
    return {buffer: bass, energy: 0, rms: 0, relativeEnergy: 0, limit, attacks: []};
  }
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // Preserve the reference channel for bass if opposite phase would cancel
    // a stereo average. Only the small new bass layer is shared between ears.
    let signed = 0, abs = 0;
    for (const channel of base) {signed += channel[i] / base.length; abs += Math.abs(channel[i]) / base.length;}
    mono[i] = Math.abs(signed) < abs * .15 ? base[0][i] : signed;
  }
  const resonance = filter(mono, sampleRate, 'bandpass', recipe.bass.hz, .8, recipe.loop);
  let resonancePeak = 0;
  for (let i = 0; i < n; i++) resonancePeak = Math.max(resonancePeak, Math.abs(resonance[i]));
  const attacks = [];
  if (!recipe.loop) {
    const look = Math.max(1, Math.round(.012 * sampleRate));
    const minimum = Math.round(recipe.bass.onsetMinIntervalSeconds * sampleRate);
    let last = -minimum, armed = true;
    for (let i = 0; i < n; i++) {
      const current = envelope[i], previous = i >= look ? envelope[i - look] : 0;
      if (current < peakEnvelope * .08) armed = true;
      const flux = current - previous;
      if (i - last >= minimum && current > peakEnvelope * .17 && flux > peakEnvelope * .075
          && (armed || flux > peakEnvelope * .22)) {
        attacks.push(i); last = i; armed = false;
      }
    }
    const pulseLength = Math.max(1, Math.round(sampleRate * recipe.bass.maxPulseSeconds));
    for (const onset of attacks) {
      const local = clamp(envelope[Math.min(n - 1, onset + look)] / peakEnvelope, .1, 1);
      for (let j = 0; j < pulseLength && onset + j < n; j++) {
        const t = j / sampleRate;
        const fadeIn = 1 - Math.exp(-t / .003);
        const fadeOut = Math.exp(-t / recipe.bass.decaySeconds);
        const endFade = Math.min(1, (pulseLength - j - 1) / Math.max(1, sampleRate * .006));
        // Fixed pitch, no synthesizer glide. A small second partial gives the
        // pressure body audibility on small speakers without a sub-bass boom.
        const carrier = Math.sin(TAU * recipe.bass.hz * t) + .12 * Math.sin(TAU * recipe.bass.hz * 2 * t);
        bass[onset + j] += local * carrier * fadeIn * fadeOut * endFade;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const body = resonancePeak > EPS ? resonance[i] / resonancePeak : 0;
    const envelopeWeight = Math.sqrt(envelope[i] / Math.max(EPS, peakEnvelope));
    bass[i] = recipe.loop ? body * envelopeWeight : bass[i] * .78 + body * envelopeWeight * .22;
  }
  const filteredBass = filter(bass, sampleRate, 'highpass', 35, Math.SQRT1_2, recipe.loop);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(filteredBass[i]));
  let basePeak = 0;
  for (const channel of base) for (let i = 0; i < n; i++) basePeak = Math.max(basePeak, Math.abs(channel[i]));
  const rawEnergy = sumEnergy(filteredBass);
  const requestedGain = peak > EPS ? basePeak * recipe.bass.mix * bassStrength * strength / peak : 0;
  // The cap is the energy of the ADDED layer / energy of the original signal;
  // it does not claim the original asset itself has little low-frequency energy.
  const energyGain = Math.sqrt(baseEnergy * limit / Math.max(EPS, rawEnergy));
  const gain = Math.min(requestedGain, energyGain);
  for (let i = 0; i < n; i++) filteredBass[i] *= gain;
  const energy = sumEnergy(filteredBass);
  return {buffer: filteredBass, energy, rms: Math.sqrt(energy / n),
    relativeEnergy: energy / Math.max(EPS, baseEnergy), limit,
    attacks: attacks.map(frame => frame / sampleRate)};
}

/**
 * Process 1/2 channels at 8–96 kHz, retaining inputs and channel count.
 * strength=0 is a safe-level/highpass/edge-polished baseline, not bit identity.
 * bass=0 removes the NEW bass layer; natural low frequencies remain.
 * Invalid option numbers recover to defaults. Non-finite input samples become
 * silence and are counted in metrics; malformed shape/sample rate throws.
 */
export function enrichPcm(input, asset = {}, options = {}) {
  if (!input || !Number.isFinite(input.sampleRate) || input.sampleRate < 8000 || input.sampleRate > 96000)
    throw new RangeError('sampleRate must be 8000–96000 Hz');
  const sampleRate = input.sampleRate;
  const supplied = input.channels;
  if (!Array.isArray(supplied) || supplied.length < 1 || supplied.length > 2
      || !supplied[0]?.length || !supplied.every(channel => channel?.length === supplied[0].length))
    throw new TypeError('channels must contain one or two equal, non-empty PCM arrays');
  const strength = finiteOption(options?.strength, 1, 0, 2);
  const bassStrength = finiteOption(options?.bass, 1, 0, 1.5);
  const recipe = getRecipe(asset);
  const original = inspect(supplied, sampleRate);
  const inputFrames = supplied[0].length;
  const tailFrames = recipe.loop ? 0 : Math.round(recipe.tailSeconds * Math.min(1, strength) * sampleRate);
  const n = inputFrames + tailFrames;
  const inputGain = original.peak > EPS ? .74 / original.peak : 1;
  let replacedSamples = 0;
  const base = supplied.map(channel => {
    const safe = new Float32Array(n);
    for (let i = 0; i < inputFrames; i++) {
      if (Number.isFinite(channel[i])) safe[i] = channel[i] * inputGain;
      else replacedSamples++;
    }
    if (recipe.loop) seamCrossblend(safe, Math.round(sampleRate * recipe.seamSeconds));
    return filter(safe, sampleRate, 'highpass', recipe.highpassHz, Math.SQRT1_2, recipe.loop);
  });
  const bass = bassLayer(base, sampleRate, recipe, strength, bassStrength);
  const channels = base.map((dry, channelIndex) => {
    const result = Float32Array.from(dry);
    for (const band of recipe.body) {
      const resonant = filter(dry, sampleRate, 'bandpass', band.hz, band.q, recipe.loop);
      for (let i = 0; i < n; i++) result[i] += resonant[i] * band.mix * strength;
    }
    const saturatedBody = filter(dry, sampleRate, 'lowpass', recipe.saturation.cutoffHz, Math.SQRT1_2, recipe.loop);
    const drive = recipe.saturation.drive;
    for (let i = 0; i < n; i++) {
      const x = saturatedBody[i];
      // Parallel odd-symmetric soft saturation adds gentle body harmonics.
      result[i] += (Math.tanh(x * drive) / drive - x * .82) * recipe.saturation.mix * strength;
    }
    const smooth = filter(dry, sampleRate, 'lowpass', recipe.air.cutoffHz, Math.SQRT1_2, recipe.loop);
    for (let i = 0; i < n; i++) result[i] += (dry[i] - smooth[i]) * recipe.air.mix * strength;
    const reflectionSource = filter(dry, sampleRate, 'lowpass', 3100, Math.SQRT1_2, recipe.loop);
    for (const reflection of recipe.reflections) {
      const delay = Math.max(1, Math.round((reflection.seconds + channelIndex * .0007) * sampleRate));
      for (let i = 0; i < n; i++) {
        const j = recipe.loop ? ((i - delay) % n + n) % n : i - delay;
        if (j >= 0) result[i] += reflectionSource[j] * reflection.gain * strength;
      }
    }
    for (let i = 0; i < n; i++) result[i] += bass.buffer[i];
    const cleaned = filter(result, sampleRate, 'highpass', recipe.highpassHz, Math.SQRT1_2, recipe.loop);
    if (recipe.loop) seamCrossblend(cleaned, Math.round(sampleRate * recipe.seamSeconds));
    else fadeEdges(cleaned, sampleRate, recipe.edgeFadeSeconds.in, recipe.edgeFadeSeconds.out);
    return cleaned;
  });
  // Match integrated energy to the safe-level reference, then cap peak. This
  // avoids disguising the richer spectrum solely as a large volume increase.
  const baseEnergy = base.reduce((total, c) => total + sumEnergy(c), 0);
  const wetEnergy = channels.reduce((total, c) => total + sumEnergy(c), 0);
  let peak = 0;
  for (const channel of channels) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(channel[i]));
  const desiredEnergyGain = wetEnergy > EPS
    ? Math.sqrt(baseEnergy / wetEnergy) * (1 + (recipe.loudnessEnergyRatio - 1) * Math.min(1, strength)) : 1;
  const gain = Math.min(desiredEnergyGain, peak > EPS ? recipe.targetPeak / peak : 1);
  for (const channel of channels) for (let i = 0; i < n; i++) channel[i] *= gain;
  const output = inspect(channels, sampleRate);
  const metrics = {
    original, output, addedBass: {energy: bass.energy, rms: bass.rms,
      relativeEnergy: bass.relativeEnergy, limit: bass.limit, attacks: bass.attacks,
      denominator: 'mean channel energy after safe-level normalization/highpass; before final shared gain'},
    inputGain, gain, strength, bassStrength, replacedSamples,
    originalSamples: inputFrames, outputSamples: n, tailSeconds: tailFrames / sampleRate,
    loop: recipe.loop, allFinite: output.finite,
    peak: output.peak, rms: output.rms, finite: output.finite,
    seam: output.seam, lfEnergyRatio: output.lfEnergyRatio,
    listeningApproved: false
  };
  return {channels, sampleRate, metrics, recipe};
}
