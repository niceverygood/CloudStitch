/**
 * Display choreography for one harpoon leaving a launcher. Values describe an
 * art demonstration only; they do not issue combat events or model physics.
 * Projectile Z uses original VFX asset units. Recoil and rope sag use preview
 * world units. The adapter owns the muzzle and the rope's two actual endpoints.
 */
export const HARPOON_DURATION = 1.25;
export const HARPOON_LAUNCH_SOURCE_DURATION = .35;
export const HARPOON_TIMING = Object.freeze({
  release: .16,
  flight: .28,
  flightEnd: .90,
  shrink: 1.15,
  end: HARPOON_DURATION,
  recoilPeak: .22,
  recoilEnd: .50,
});

const clamp01 = value => Math.max(0, Math.min(1, value));
const progress = (time, start, end) => clamp01((time - start) / (end - start));
const smooth = value => value * value * (3 - 2 * value);
const mix = (a, b, factor) => a + (b - a) * factor;

/** Evaluate an absolute display time, independent of dt or previous samples. */
export function sampleHarpoonLaunch(inputTime) {
  if (typeof inputTime !== 'number' || !Number.isFinite(inputTime)) {
    throw new TypeError('작살 시연 시간은 유한한 숫자여야 합니다.');
  }
  const time = Math.min(HARPOON_DURATION, Math.max(0, inputTime));
  const timing = HARPOON_TIMING;
  const travel = progress(time, timing.release, timing.flightEnd);
  const shrink = 1 - smooth(progress(time, timing.shrink, timing.end));
  const visible = time < timing.end;
  const recoil = time <= timing.recoilPeak
    ? smooth(progress(time, timing.release, timing.recoilPeak))
    : 1 - smooth(progress(time, timing.recoilPeak, timing.recoilEnd));
  const ropeTension = smooth(progress(time, timing.release, timing.flight));
  const phase = time < timing.release ? 'loaded'
    : time < timing.flight ? 'release'
      : time < timing.flightEnd ? 'flight'
        : time < timing.end ? 'tail' : 'finished';
  const phaseLabel = {
    loaded: '발사 전 · 작살이 레일에 놓임',
    release: '발사 · 작살이 나가고 발사기가 뒤로 튕김',
    flight: '비행 · 작살 뒤로 밧줄이 풀려 나감',
    tail: '발사 뒤 · 작살과 밧줄이 멀어짐',
    finished: '시연 끝',
  }[phase];

  // The existing launch clip keeps its authored duration and rate. The longer
  // context timeline adds a loaded pose and visible flight, not a stretched
  // launch clip or an extra hit/latch effect.
  const launchClipTime = Math.min(HARPOON_LAUNCH_SOURCE_DURATION,
    Math.max(0, time - timing.release));
  return Object.freeze({
    time,
    phase,
    phaseLabel,
    launchClipTime,
    launchVisible: time >= timing.release
      && time < timing.release + HARPOON_LAUNCH_SOURCE_DURATION,
    projectileZ: 4 * travel,
    projectileVisible: visible,
    projectileScale: shrink,
    projectileCount: visible ? 1 : 0,
    recoilZ: -.12 * recoil,
    ropeVisible: visible,
    ropeExtension: travel,
    ropeSag: mix(.10, .012, ropeTension),
    ropeTension,
    ropeScale: shrink,
  });
}
