const data = require('./data.cjs');
const byId = new Map(data.nodes.map(n => [n.id, n]));
const points = state => state.selected.reduce((sum,id) => sum + (byId.get(id)?.cost || 0),0);
const availablePoints = state => state.level - 1 - points(state);
const ultimate = state => data.nodes.find(n => n.kind === 'ultimate' && state.selected.includes(n.id)) || null;
const createState = (level = 9) => ({level:Math.max(1,Math.min(9,Math.trunc(Number(level) || 1))),selected:[],slots:{Q:null,E:null}});
const clone = state => ({level:state.level,selected:[...state.selected],slots:{...state.slots}});

function learnReason(state,id) {
  const n = byId.get(id);
  if (!n) return '없는 스킬입니다.';
  if (state.selected.includes(id)) return '이미 습득했습니다.';
  if (data.nodes.some(other => other.branch === n.branch && other.tier === n.tier && state.selected.includes(other.id))) return '같은 단계는 둘 중 하나만 선택합니다. 기존 선택을 먼저 취소하세요.';
  if (n.requiresAny.length && !n.requiresAny.some(parent => state.selected.includes(parent))) return '이 계열의 바로 앞 단계에서 하나를 먼저 습득하세요.';
  if (n.kind === 'ultimate' && state.level < 6) return '궁극기는 출항 Lv6부터 습득합니다.';
  if (n.kind === 'ultimate' && ultimate(state)) return '궁극기는 세 계열을 합쳐 하나만 습득합니다.';
  if (availablePoints(state) < n.cost) return `${n.cost}점이 필요합니다. 남은 점수가 부족합니다.`;
  return '';
}

function learn(state,id) {
  if (learnReason(state,id)) return state;
  const next = clone(state); next.selected.push(id);
  if (byId.get(id).kind === 'active') {
    const free = ['Q','E'].find(slot => !next.slots[slot]);
    if (free) next.slots[free] = id;
  }
  return next;
}

function prune(state) {
  let changed;
  do {
    const before = state.selected.length;
    state.selected = state.selected.filter(id => {
      const n = byId.get(id);
      return n && (!n.requiresAny.length || n.requiresAny.some(parent => state.selected.includes(parent)));
    });
    changed = state.selected.length !== before;
  } while (changed);
  for (const slot of ['Q','E']) if (!state.selected.includes(state.slots[slot])) state.slots[slot] = null;
  return state;
}

function refund(state,id) {
  const next = clone(state);
  next.selected = next.selected.filter(other => other !== id);
  return prune(next);
}

function setLevel(state,level) {
  let next = clone(state); next.level = createState(level).level;
  if (next.level < 6) for (const id of [...next.selected]) if (byId.get(id).kind === 'ultimate') next = refund(next,id);
  while (availablePoints(next) < 0 && next.selected.length) next = refund(next,next.selected.at(-1));
  return next;
}

function assign(state,slot,id) {
  if (!['Q','E'].includes(slot) || (id !== null && (!state.selected.includes(id) || byId.get(id)?.kind !== 'active'))) return state;
  const next = clone(state);
  if (id) for (const other of ['Q','E']) if (other !== slot && next.slots[other] === id) next.slots[other] = null;
  next.slots[slot] = id;
  return next;
}

function validate(state) {
  const errors = [];
  if (!Number.isInteger(state.level) || state.level < 1 || state.level > 9) errors.push('invalid-level');
  if (new Set(state.selected).size !== state.selected.length) errors.push('duplicate-node');
  if (availablePoints(state) < 0) errors.push('over-budget');
  if (state.selected.filter(id => byId.get(id)?.kind === 'ultimate').length > 1) errors.push('multiple-ultimates');
  for (const id of state.selected) {
    const n = byId.get(id);
    if (!n) {errors.push('unknown-node');continue;}
    if (n.requiresAny.length && !n.requiresAny.some(parent => state.selected.includes(parent))) errors.push('missing-parent');
    if (n.kind === 'ultimate' && state.level < 6) errors.push('ultimate-level');
    if (state.selected.some(other => other !== id && byId.get(other)?.branch === n.branch && byId.get(other)?.tier === n.tier)) errors.push('sibling-conflict');
  }
  for (const slot of ['Q','E']) {
    const id = state.slots[slot];
    if (id !== null && (!state.selected.includes(id) || byId.get(id)?.kind !== 'active')) errors.push('invalid-slot');
  }
  if (state.slots.Q && state.slots.Q === state.slots.E) errors.push('duplicate-slot');
  return errors;
}

function applyPreset(id) {
  const preset = data.presets.find(p => p.id === id);
  if (!preset) return createState();
  let state = createState();
  for (const id of preset.nodes) state = learn(state,id);
  for (const slot of ['Q','E']) state = assign(state,slot,preset.slots[slot]);
  return state;
}

module.exports = {createState,points,availablePoints,ultimate,learnReason,learn,refund,setLevel,assign,validate,applyPreset};
