/** Absolute display choreography; no physics, damage, contact or latch. */
export const HARPOON_DURATION = 1.70;
export const HARPOON_LAUNCH_SOURCE_DURATION = .35;
export const HARPOON_TIMING = Object.freeze({release:.28, flight:.42, flightEnd:1.05, shrink:1.52, end:HARPOON_DURATION, recoilPeak:.34, recoilEnd:.76});
const clamp = v => Math.max(0, Math.min(1, v));
const p = (t,a,b) => clamp((t-a)/(b-a));
const smooth = v => v*v*(3-2*v);
export function sampleHarpoonLaunch(inputTime) {
  if (typeof inputTime !== 'number' || !Number.isFinite(inputTime)) throw new TypeError('작살 시연 시간은 유한한 숫자여야 합니다.');
  const t=Math.min(HARPOON_DURATION,Math.max(0,inputTime)), h=HARPOON_TIMING;
  const travel=p(t,h.release,h.flightEnd), accelerated=travel*travel*(2-travel);
  const scale=1-smooth(p(t,h.shrink,h.end)), visible=t<h.end;
  const recoil=t<=h.recoilPeak ? smooth(p(t,h.release,h.recoilPeak)) : 1-smooth(p(t,h.recoilPeak,h.recoilEnd));
  const tension=smooth(p(t,h.release,h.flight)), phase=t<h.release?'loaded':t<h.flight?'release':t<h.flightEnd?'flight':t<h.end?'tail':'finished';
  const phaseLabel={loaded:'장전 · 두 번 감긴 밧줄과 팽팽해지는 발사기',release:'공통 발사 순간 0.28초 · 작살 한 개와 강한 반동',flight:'비행 · 밧줄이 크게 휘었다 펴짐',tail:'여운 · 작살과 밧줄의 관성',finished:'시연 끝'}[phase];
  return Object.freeze({time:t,phase,phaseLabel,launchClipTime:Math.min(.35,Math.max(0,t-h.release)),launchVisible:t>=h.release&&t<h.release+.35,projectileZ:4.8*accelerated,projectileVisible:visible,projectileScale:scale,projectileCount:visible?1:0,recoilZ:-.24*recoil,preload:1-smooth(p(t,0,h.release)),ropeVisible:visible,ropeExtension:accelerated,ropeSag:.13*(1-tension)+.012*tension,ropeTension:tension,ropeCoil:1-smooth(p(t,h.release,.53)),ropeWhip:Math.sin(Math.PI*p(t,h.release,.88))*.24,ropeScale:scale});
}
/** One continuous centerline: two loose windings → S whip → trailing line. */
export function sampleRopeOffset(state,u) {
  const edge=Math.sin(Math.PI*u);
  return {x:edge*(Math.cos(u*Math.PI*4)*.14*state.ropeCoil + Math.sin(u*Math.PI*2)*state.ropeWhip),y:edge*(Math.sin(u*Math.PI*4)*.14*state.ropeCoil-state.ropeSag)};
}

