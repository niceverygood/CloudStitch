/**
 * Cloudstitch audio-v1: authored local procedural SFX, not recorded/final audio.
 * Pure deterministic PCM synthesis; no network, assets, dependencies or state mutation.
 * See outputs/34-sound-music-direction.txt and 16-audio-accessibility-production.txt.
 */
const TAU = Math.PI * 2;
const mapping = (status, events, note) => Object.freeze({ status, events: Object.freeze(events), note });
const prototype = 'temporary_procedural_prototype';
const hitWeaponNote = ' 무기 충격은 재료 recipe를 유지하며 01-machine-gun은 gain×0.72/rate1.04, 02-deck-cannon은 gain×0.95/rate0.9로 읽기 어댑터에서 구분.';
const definition = (id, label, duration, seed, description, eventMapping, options = {}) => Object.freeze({
  id, label, category: 'sfx', duration, seed, priority: 2, interval: 0.08, loop: false,
  description, eventMapping, status: prototype, ...options,
});

export const SOUND_DEFINITIONS = Object.freeze([
  definition('fire-machinegun', '기관총 발사', 0.16, 340101,
    '짧은 압력 충격, 목재 총좌 공명, 급탄·황동 탄피. 한 실제 탄 발사에 한 큐.',
    mapping('supported_event', ['player-fire', 'enemy-fire'], 'weaponId === 01-machine-gun. 실제 발사 이벤트만 소비.'), { interval: 0.065 }),
  definition('fire-cannon', '함포 발사', 0.62, 340102,
    '즉시 낮은 발사압, 닫힌 약실 금속, 뒤따르는 목재 선체 반동. 별도 장전 예고는 후속 범위.',
    mapping('supported_event', ['player-fire', 'enemy-fire'], 'weaponId === 02-deck-cannon. 현재 적 탄은 trainingPattern 간이 탄.'), { interval: 0.2 }),
  definition('hit-wood', '목재 피격', 0.34, 340103,
    '빈 목재의 둔한 모드 공명과 불규칙한 짧은 가시·균열. 무기별 충격은 같은 재료 음의 강도·속도로 구별.',
    mapping('supported_event_with_material_resolution', ['hit'], '원본 hit에는 material 없음. snapshot의 피격 module.type/hull/deck 및 obstacle 대체 재질을 읽어 선택.' + hitWeaponNote)), 
  definition('hit-cloth', '천 피격', 0.36, 340104,
    '기낭 천 찢김, 부드러운 공기 분출, 마른 천의 짧은 펄럭임. 무기별 충격은 같은 재료 음의 강도·속도로 구별.',
    mapping('supported_event_with_material_resolution', ['hit'], '피격 module.type === balloon을 read-only 해석. 원본 이벤트에 재질 필드 추가하지 않음.' + hitWeaponNote)), 
  definition('hit-armor', '금속 장갑 피격', 0.50, 340105,
    '단단한 충격 뒤 비정수 배음의 황동·금속판 울림과 짧은 긁힘. 무기별 충격은 같은 재료 음의 강도·속도로 구별.',
    mapping('supported_event_with_material_resolution', ['hit'], 'cannon/machinegun/harpoon/connector 등의 금속 대체 재질. 전용 armor material은 현재 원본에 없음.' + hitWeaponNote)), 
  definition('hit-engine', '엔진 피격', 0.56, 340106,
    '케이스 충격 뒤 불규칙한 점화 헛돎과 증기 빠짐. 무기별 충격은 같은 재료 음의 강도·속도로 구별.',
    mapping('supported_event_with_material_resolution', ['hit'], '피격 module.type === engine을 read-only 해석.' + hitWeaponNote)), 
  definition('connector-cut', '연결부 절단', 0.55, 340107,
    '팽팽한 밧줄의 풀림, 골조 균열, 흩어지는 황동 볼트. 파괴 순간 신호이며 사전 균열 예고는 없음.',
    mapping('supported_event', ['module-destroyed'], 'moduleType === connector. connector-cut이라는 새 sim 이벤트를 만들지 않음.')), 
  definition('bundle-detach', '부품 묶음 분리', 0.70, 340108,
    '빈 목재 연결부의 이격, 두 번의 작은 후속 볼트, 공기 속으로 멀어지는 천.',
    mapping('supported_event', ['bundle-detached'], '절단/회수와 별도 큐. moduleIds 및 위치를 읽음.'), { interval: 0.15 }),
  definition('salvage', '인양·회수', 0.85, 340109,
    '짧은 윈치 회전, 장력을 받는 케이블, 래칫, 마지막 화물 고정 걸쇠.',
    mapping('supported_event', ['salvaged'], '실제 회수 성공 뒤 한 번. 선행 인양 진행 상태는 원본에 없어 예고하지 않음.'), { interval: 0.35 }),
  definition('engine-loop', '프로펠러·엔진 환경', 2, 340110,
    '낮은 모터 배음, 프로펠러 박자, 작은 베어링 떨림. 속도는 재생률/혼합으로 변화.',
    mapping('supported_snapshot', [], 'sailing && !paused && sim.outcome === sailing. 속도는 임시 XZ 게임 좌표.'), { category: 'ambience', priority: 1, interval: 0, loop: true }),
  definition('wind-loop', '바람·천 환경', 2, 340111,
    '주기적 대역 바람과 부드러운 천 플러터. 빠를 때 고역 층이 드러나는 별도 환경 루프.',
    mapping('supported_snapshot', [], 'sailing && !paused. 상태 전환으로 한 loop를 유지/정리.'), { category: 'ambience', priority: 1, interval: 0, loop: true }),
  definition('lift-danger-loop', '양력 부족 천 장력', 2, 340112,
    '늘어나는 천·밧줄의 거친 공명과 마찰. 반복 전자 경보/음량 증폭 대신 재료 장력.',
    mapping('supported_snapshot', [], 'sim.player.weight > sim.player.lift 또는 liftMargin으로 read-only 상태 감지.'), { category: 'ambience', priority: 3, interval: 0, loop: true }),
  definition('lift-warning', '양력 위험 짧은 경고', 0.52, 340113,
    '짧은 장력 끊김과 두 번의 구별되는 황동 장치 신호. 시각 경고를 계속 유지해야 함.',
    mapping('supported_snapshot_transition', [], '양력 위험 상태 진입. 원본 lift-warning 이벤트는 없음.'), { priority: 3, interval: 1.5 }),
  definition('return', '항구 귀환', 0.85, 340114,
    '느슨해지는 로프와 목재 선체의 착좌, 짧은 황동 계류 장치 공명. 음악 아님.',
    mapping('supported_snapshot_transition', [], '실제 sailing→harbor 또는 sim.outcome→victory 전환에 한 번. 귀환 정산 뒤 저장 실패여도 실제 귀환이면 재생하며 command(return)의 ok 자체를 조건으로 삼지 않음.'), { interval: 0.5 }),
  definition('harbor-repair', '항구 수리 완료', 0.55, 340115,
    '두 작은 망치 타격, 천 브러시, 마지막 공구 걸림.',
    mapping('supported_event_or_command_result', ['player-repaired'], '전장 player-repaired의 restored > 0은 snapshot player 위치를 anchor로 재생. 항구 controller.command(repair)는 실제 결과 ok === true일 때 재생. UI 클릭만으로 재생하지 않음.'), { interval: 0.25 }),
  definition('harbor-equip', '항구 장착 완료', 0.50, 340116,
    '짧은 레일 마찰, 목재 받침 착좌, 황동 걸쇠 잠금.',
    mapping('supported_command_result', [], 'controller.command(equip) 결과 ok === true.'), { interval: 0.2 }),
  definition('save-ok', '저장 성공', 0.34, 340117,
    '작은 두 기계식 걸쇠가 맞물리는 부드러운 확인음. 임무 보상이나 새 항해 생성 없음.',
    mapping('supported_command_result', [], 'controller.command(save)의 실제 ok 결과. 자동 저장은 별도 저장 결과 어댑터 연결 대기.'), { interval: 0.25 }),
  definition('ui-fail', '조작·저장 실패', 0.30, 340118,
    '맞물리지 않는 둔한 걸쇠와 낮은 목재 노크. 위험 경고와 다른 재료·길이.',
    mapping('supported_command_result', [], '현재 어댑터는 repair/equip/save의 실제 command 결과 ok === false만 지원. return 등 다른 실패 연결은 대기. 성공음과 동시에 내지 않음.'), { interval: 0.25 }),
]);

function random(seed) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let n = value; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const attack = (t, seconds) => Math.min(1, Math.max(0, t / seconds));

/** A small additive/modal instrument with swept phase and independent damping. */
function tone(out, rate, start, length, frequency, gain, decay = 0.08, endFrequency = frequency, phase = 0) {
  const begin = Math.round(start * rate), count = Math.min(Math.round(length * rate), out.length - begin);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const cycles = frequency * t + (endFrequency - frequency) * t * t / (2 * length);
    const env = attack(t, 0.0015) * Math.exp(-t / decay) * Math.min(1, (length - t) / 0.008);
    out[begin + i] += Math.sin(TAU * cycles + phase) * gain * env;
  }
}

/** Noise bands express air/cloth/splinter/steam rather than pitch variants. */
function noise(out, rate, rng, start, length, gain, { low = 1200, high = 0, decay = 0.08, rise = 0.002, flutter = 0, grit = 0 } = {}) {
  const begin = Math.round(start * rate), count = Math.min(Math.round(length * rate), out.length - begin);
  const a = 1 - Math.exp(-TAU * Math.min(low, rate * 0.44) / rate);
  const b = high ? 1 - Math.exp(-TAU * Math.min(high, rate * 0.44) / rate) : 0;
  let lp = 0, slow = 0;
  for (let i = 0; i < count; i++) {
    const t = i / rate, white = rng() * 2 - 1;
    lp += a * (white - lp); slow += b * (lp - slow);
    const env = attack(t, rise) * Math.exp(-t / decay) * Math.min(1, (length - t) / 0.012);
    const modulation = flutter ? 0.58 + 0.42 * Math.sin(TAU * flutter * t) ** 2 : 1;
    const grain = grit ? (rng() > grit ? 1 : 0.12) : 1;
    out[begin + i] += (lp - slow) * gain * env * modulation * grain;
  }
}

function woodenKnock(out, rate, rng, at, gain = 1, scale = 1) {
  for (const [f, g, d] of [[183, .37, .040], [337, .24, .055], [621, .13, .028], [1043, .06, .016]]) tone(out, rate, at, .24, f * scale, gain * g, d);
  noise(out, rate, rng, at, .048, .37 * gain, { low: 4400, high: 600, decay: .011 });
}
function brass(out, rate, at, gain = 1, scale = 1, length = .26) {
  for (const [f, g, d] of [[713, .19, .12], [1279, .12, .075], [1871, .08, .055], [3041, .045, .031]]) tone(out, rate, at, length, f * scale, gain * g, d);
}

/** Integer cycles over the exact buffer length keep all loop components periodic. */
function periodic(out, rng, kind) {
  const count = out.length, duration = 2;
  const terms = [];
  const term = (hz, gain) => terms.push([Math.max(1, Math.round(hz * duration)), gain, rng() * TAU]);
  if (kind === 'engine-loop') {
    for (const [hz, gain] of [[45,.22],[90,.12],[135,.045],[180,.02],[720,.015]]) term(hz,gain);
    for (let j = 0; j < 20; j++) term(170 + rng() * 1300, .006);
  } else if (kind === 'wind-loop') {
    for (let j = 0; j < 44; j++) term(80 + rng() ** 1.3 * 2700, .01 / (1 + j * .025));
    for (const hz of [63,97,181]) term(hz,.012);
  } else {
    for (const [hz,gain] of [[147,.13],[294,.065],[441,.035],[967,.025]]) term(hz,gain);
    for (let j = 0; j < 22; j++) term(380 + rng() * 2300, .008);
  }
  for (let i = 0; i < count; i++) {
    const cycle = i / count;
    let value = 0;
    for (const [cycles, gain, phase] of terms) value += Math.sin(TAU * cycles * cycle + phase) * gain;
    if (kind === 'engine-loop') value *= .68 + .32 * Math.sin(TAU * 12 * cycle) ** 2;
    if (kind === 'wind-loop') value *= .60 + .20 * Math.sin(TAU * cycle) + .12 * Math.sin(TAU * 7 * cycle);
    if (kind === 'lift-danger-loop') value *= .25 + .75 * Math.sin(TAU * 3 * cycle) ** 6;
    out[i] = value;
  }
}

function finish(out, def, rate) {
  // Remove DC before a bounded soft saturation. Preserve relative recipe dynamics.
  let mean = 0;
  for (const value of out) mean += value;
  mean /= out.length;
  let peak = 0;
  const edge = Math.max(2, Math.round(rate * .005));
  for (let i = 0; i < out.length; i++) {
    const distance = Math.min(i, out.length - 1 - i);
    const fade = distance < edge ? .5 - .5 * Math.cos(Math.PI * distance / edge) : 1;
    out[i] = Math.tanh((out[i] - mean) * 1.25) * fade;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  const target = def.loop ? (def.id === 'lift-danger-loop' ? .32 : .24) : def.priority === 3 ? .58 : .64;
  const gain = peak ? target / peak : 1;
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  // The 5 ms raised-cosine loop taper gives exact zero at both seam endpoints
  // and near-zero first derivatives, without a jump; periodic carrier underneath.
}

export function synthesize(id, { sampleRate = 22050, seed } = {}) {
  const def = SOUND_DEFINITIONS.find(item => item.id === id);
  if (!def) throw new RangeError(`Unknown Cloudstitch sound: ${id}`);
  if (!Number.isSafeInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw new RangeError('sampleRate must be an integer in 8000..96000');
  if (seed !== undefined && (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xFFFFFFFF)) throw new RangeError('seed must be a uint32 integer');
  const rng = random(seed ?? def.seed), out = new Float32Array(Math.round(sampleRate * def.duration)), r = sampleRate;
  if (def.loop) periodic(out, rng, id);
  else switch (id) {
    case 'fire-machinegun':
      noise(out,r,rng,0,.055,.87,{low:7200,high:750,decay:.010});
      tone(out,r,0,.09,188,.47,.018,110);
      brass(out,r,.018,.70,2.15,.12); woodenKnock(out,r,rng,.042,.22,1.35); break;
    case 'fire-cannon':
      tone(out,r,0,.45,105,.85,.105,47); tone(out,r,.004,.31,193,.24,.055,90);
      noise(out,r,rng,0,.22,1.15,{low:1200,decay:.045});
      noise(out,r,rng,.018,.32,.25,{low:2700,high:400,decay:.09});
      brass(out,r,.014,.65,.59); woodenKnock(out,r,rng,.095,.75,.55);
      woodenKnock(out,r,rng,.175,.23,.72); break;
    case 'hit-wood':
      woodenKnock(out,r,rng,0,1); woodenKnock(out,r,rng,.019,.36,1.7);
      for (const at of [.035,.061,.095]) noise(out,r,rng,at,.06,.22,{low:6500,high:1700,decay:.013}); break;
    case 'hit-cloth':
      noise(out,r,rng,0,.25,.9,{low:4100,high:900,decay:.085,rise:.004,flutter:32,grit:.12});
      noise(out,r,rng,.035,.31,.52,{low:1300,high:160,decay:.1,rise:.015,flutter:18});
      tone(out,r,.012,.20,119,.14,.035,56); break;
    case 'hit-armor':
      brass(out,r,0,1.5,1,.46); noise(out,r,rng,0,.045,.65,{low:7000,high:2100,decay:.011});
      noise(out,r,rng,.022,.14,.25,{low:5100,high:900,decay:.055,flutter:83}); break;
    case 'hit-engine':
      brass(out,r,0,1.0,.72); woodenKnock(out,r,rng,.006,.36,.72);
      for (const at of [.067,.112,.181]) { tone(out,r,at,.09,73+rng()*24,.32,.024,42); noise(out,r,rng,at,.07,.38,{low:650,decay:.021}); }
      noise(out,r,rng,.09,.40,.33,{low:4000,high:1100,decay:.13,rise:.018}); break;
    case 'connector-cut':
      noise(out,r,rng,0,.048,.84,{low:7100,high:500,decay:.008});
      tone(out,r,0,.19,643,.39,.035,160); tone(out,r,.015,.30,210,.24,.075,80);
      woodenKnock(out,r,rng,.012,.7,.88); brass(out,r,.073,.65,1.15); brass(out,r,.157,.28,1.5); break;
    case 'bundle-detach':
      woodenKnock(out,r,rng,0,.80,.65); woodenKnock(out,r,rng,.083,.45,.8);
      brass(out,r,.045,.34,.82); brass(out,r,.19,.19,1.3);
      noise(out,r,rng,.028,.58,.40,{low:1700,high:300,decay:.19,rise:.03,flutter:12}); break;
    case 'salvage':
      noise(out,r,rng,0,.60,.29,{low:2600,high:550,decay:.32,rise:.03,flutter:53});
      tone(out,r,.02,.54,176,.21,.36,283); tone(out,r,.02,.54,354,.1,.32,557);
      for(const at of [.08,.19,.33,.46]) brass(out,r,at,.24,1.2,.11);
      woodenKnock(out,r,rng,.61,.73,.85); brass(out,r,.63,.8,.8); break;
    case 'lift-warning':
      noise(out,r,rng,0,.1,.40,{low:2400,high:300,decay:.03,flutter:35});
      tone(out,r,0,.16,286,.38,.05,410);
      brass(out,r,.055,1.0,1.48,.18); brass(out,r,.26,.8,1.48,.20); break;
    case 'return':
      noise(out,r,rng,0,.30,.35,{low:1800,high:100,decay:.1,flutter:15});
      woodenKnock(out,r,rng,.10,.65,.6); woodenKnock(out,r,rng,.29,.29,.78);
      brass(out,r,.36,.80,.65,.44); break;
    case 'harbor-repair':
      woodenKnock(out,r,rng,0,.7,1.2); brass(out,r,0,.45,1.4,.1);
      woodenKnock(out,r,rng,.17,.5,1.2); brass(out,r,.17,.36,1.4,.1);
      noise(out,r,rng,.24,.22,.3,{low:2900,high:500,decay:.13,rise:.02}); brass(out,r,.40,.38,1.5,.13); break;
    case 'harbor-equip':
      noise(out,r,rng,0,.23,.35,{low:3800,high:900,decay:.14,rise:.02,flutter:62});
      tone(out,r,.01,.20,421,.14,.14,323); woodenKnock(out,r,rng,.22,.72,.85);
      brass(out,r,.28,.85,1.1,.21); break;
    case 'save-ok':
      brass(out,r,.018,.70,1.7,.14); woodenKnock(out,r,rng,0,.36,1.7);
      brass(out,r,.13,.60,1.7,.19); tone(out,r,.13,.17,947,.18,.06); break;
    case 'ui-fail':
      woodenKnock(out,r,rng,0,.8,.61); tone(out,r,.034,.18,205,.26,.045,115);
      noise(out,r,rng,.055,.13,.28,{low:1100,high:180,decay:.04,flutter:32}); break;
  }
  finish(out, def, r);
  return { samples: out, sampleRate: r, duration: out.length / r };
}
