import { SOUND_DEFINITIONS, synthesize } from './synthesis.mjs';
import { AUDIO_VERSION, DEFAULT_SETTINGS } from './runtime.mjs';

const runButton = document.querySelector('#run');
const status = document.querySelector('#status');
const rows = document.querySelector('#results');
const json = document.querySelector('#json');
const download = document.querySelector('#download');
let downloadURL = null;
const number = value => Number.isFinite(value) ? Number(value.toFixed(7)) : null;
const display = value => value === null ? '유효하지 않음' : value.toFixed(5);

function measure(samples) {
  let peak = 0, squares = 0, finite = true;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) { finite = false; continue; }
    peak = Math.max(peak, Math.abs(sample)); squares += sample * sample;
  }
  return { samples: samples.length, finite, peak: number(peak), rms: number(Math.sqrt(squares / Math.max(1, samples.length))),
    first: number(samples[0] ?? 0), last: number(samples.at(-1) ?? 0),
    endpointJump: number(Math.abs(samples.at(-1) ?? 0)), seamJump: number(Math.abs((samples.at(-1) ?? 0) - (samples[0] ?? 0))) };
}

async function renderClip(definition, variant) {
  const Offline = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext;
  const rendered = synthesize(definition.id, { sampleRate: 22050, seed: definition.seed + variant * 7919 });
  const raw = measure(rendered.samples), sampleRate = rendered.sampleRate;
  const tailFrames = Math.ceil(sampleRate * 0.12);
  const context = new Offline(1, rendered.samples.length + tailFrames, sampleRate);
  const buffer = context.createBuffer(1, rendered.samples.length, sampleRate);
  buffer.getChannelData(0).set(rendered.samples);
  const source = context.createBufferSource(), gain = context.createGain(), compressor = context.createDynamicsCompressor(), limiter = context.createWaveShaper();
  source.buffer = buffer;
  const ambience = definition.category === 'ambience';
  gain.gain.value = (ambience ? 0.15 * DEFAULT_SETTINGS.ambience : 0.3 * DEFAULT_SETTINGS.sfx) * DEFAULT_SETTINGS.master * 0.8;
  compressor.threshold.value = -24; compressor.knee.value = 18; compressor.ratio.value = 6; compressor.attack.value = .003; compressor.release.value = .12;
  const curve = new Float32Array(2049);
  for (let i = 0; i < curve.length; i += 1) curve[i] = .85 * Math.tanh((i / (curve.length - 1) * 2 - 1) / .85);
  limiter.curve = curve; limiter.oversample = '2x';
  source.connect(gain); gain.connect(compressor); compressor.connect(limiter); limiter.connect(context.destination);
  source.start(0);
  const output = await context.startRendering(), mixed = measure(output.getChannelData(0));
  const expectedDuration = definition.duration ?? definition.seconds;
  const actualDuration = rendered.samples.length / sampleRate;
  const durationMatches = expectedDuration === undefined ? null : Math.abs(actualDuration - expectedDuration) <= 1 / sampleRate;
  const observations = [];
  if (!raw.finite || !mixed.finite) observations.push('유효하지 않은 샘플');
  if (raw.peak > 1 || mixed.peak > .86) observations.push('peak 한계 초과');
  if (raw.rms <= .0001 || mixed.rms <= .0001) observations.push('무음/매우 작은 신호 검토');
  if (durationMatches === false) observations.push('길이 불일치');
  if (raw.endpointJump > .005 || definition.loop && raw.seamJump > .005) observations.push('끝점 청취 검토');
  return { id: definition.id, variant, seed: definition.seed + variant * 7919, category: definition.category, loop: !!definition.loop,
    sampleRate, durationSeconds: number(actualDuration), expectedDurationSeconds: expectedDuration ?? null, durationMatches,
    raw, mixed, mixedTailSeconds: .12, status: observations.length ? 'review' : 'numeric-checks-passed', observations,
    listening: 'not-performed' };
}

function appendRow(result) {
  const tr = document.createElement('tr');
  const cells = [ `${result.id} · v${result.variant + 1}`, result.durationSeconds.toFixed(3),
    `${display(result.raw.peak)} / ${display(result.raw.rms)}`, `${display(result.mixed.peak)} / ${display(result.mixed.rms)}`,
    `${display(result.raw.endpointJump)} / ${result.loop ? display(result.raw.seamJump) : '해당 없음'}`,
    result.observations.join(', ') || '수치 기준 통과 · 청취 대기' ];
  for (const value of cells) { const cell = document.createElement('td'); cell.textContent = value; tr.append(cell); }
  tr.lastChild.className = result.status === 'review' ? 'bad' : 'good'; rows.append(tr);
}

runButton.addEventListener('click', async () => {
  if (!globalThis.OfflineAudioContext && !globalThis.webkitOfflineAudioContext) { status.textContent = '이 브라우저에서 OfflineAudioContext를 지원하지 않습니다.'; return; }
  runButton.disabled = true; rows.replaceChildren(); download.hidden = true;
  if (downloadURL) { URL.revokeObjectURL(downloadURL); downloadURL = null; }
  const report = { schema: 'cloudstitch.audio.offline-render.v1', audioVersion: AUDIO_VERSION, checkedAt: new Date().toISOString(),
    implementation: navigator.userAgent, sampleRate: 22050, status: 'running', browserOfflineRenderingPerformed: true, humanListeningPerformed: false,
    settings: DEFAULT_SETTINGS, pipeline: 'single-cue constant Gain -> DynamicsCompressor -> 2x WaveShaper(.85*tanh(x/.85)); playbackRate 1; one loop period',
    limitations: ['Offline numeric rendering only; no hardware output.', 'No simultaneous-cue intelligibility, stereo/mono listening, long-loop listening or game integration QA.', 'Standalone measurement chain uses default mixer values; no runtime attack ramp, distance/pan, priority ducking or playbackRate variation. Runtime scheduling is separately checked by Node.'], results: [] };
  try {
    for (const definition of SOUND_DEFINITIONS) {
      for (let variant = 0; variant < 3; variant += 1) {
        status.textContent = `측정 중 ${report.results.length + 1}/${SOUND_DEFINITIONS.length * 3} · ${definition.id}`;
        const result = await renderClip(definition, variant); report.results.push(result); appendRow(result);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    report.status = report.results.some(result => result.status === 'review') ? 'review' : 'numeric-checks-passed';
    status.textContent = `${report.results.length}개 수치 렌더 완료 · ${report.results.filter(result => result.status === 'review').length}개 검토 표시 · 청취 미실행`;
  } catch (error) { report.status = 'failed'; report.error = String(error?.stack ?? error); status.textContent = `측정 실패: ${error.message ?? error}`; }
  report.completedAt = new Date().toISOString(); const serialized = JSON.stringify(report, null, 2); json.textContent = serialized;
  downloadURL = URL.createObjectURL(new Blob([serialized + '\n'], { type: 'application/json' })); download.href = downloadURL; download.hidden = false;
  runButton.disabled = false;
});

addEventListener('pagehide', () => { if (downloadURL) URL.revokeObjectURL(downloadURL); });
