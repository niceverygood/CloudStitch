/**
 * Cloudstitch harbor example rules, v1. No GLB or live voyage state is modified.
 * Costs, departure equipment, and the five fuel gate are provisional examples.
 * Public operations return new state objects; previews and quotes never mutate.
 */
export const SHIPYARD_VERSION = '1.0.1';

const LOCATIONS = new Set(['installed', 'warehouse', 'cargo']);
const PHASES = new Set(['harbor', 'debrief', 'sailing']);
const EPSILON = 1e-9;
const textId = value => typeof value === 'string' && value.trim().length > 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const amount = value => value === undefined ? 0 : value;
const error = (code, message) => `${code}: ${message}`;
const unique = values => [...new Set(values)];

/** Structural and numeric validation; unsafe budgets are handled at departure. */
export function validateParts(state) {
  const errors = [];
  if (!record(state)) return [error('state-invalid', '상태 객체가 필요합니다.')];
  if (state.schemaVersion !== 1) errors.push(error('schema-invalid', '지원하는 상태 형식은 1입니다.'));
  if (!textId(state.ownerId)) errors.push(error('owner-invalid', '선주 ID가 필요합니다.'));
  if (!PHASES.has(state.phase)) errors.push(error('phase-invalid', '안전 경계 또는 항해 단계가 잘못되었습니다.'));
  if (!Number.isSafeInteger(state.revision) || state.revision < 0) errors.push(error('revision-invalid', '수정 번호는 0 이상의 안전한 정수여야 합니다.'));
  if (!record(state.resources)) errors.push(error('resources-invalid', 'S/F/C 자원이 필요합니다.'));
  else for (const key of ['S', 'F', 'C']) {
    if (!nonnegative(state.resources[key])) errors.push(error('resource-invalid', `${key} 자원은 유한한 0 이상 수여야 합니다.`));
  }
  if (!record(state.ship)) return [...errors, error('ship-invalid', '함선 정보가 필요합니다.')];
  if (!textId(state.ship.id) || !textId(state.ship.rootId)) errors.push(error('ship-id-invalid', '함선과 핵심 선체 ID가 필요합니다.'));
  if (!nonnegative(state.ship.passengerWeight)) errors.push(error('passenger-weight-invalid', '탑승 인원 중량은 유한한 0 이상 수여야 합니다.'));
  if (!Array.isArray(state.parts)) return [...errors, error('parts-invalid', '부품 배열이 필요합니다.')];
  if (!Array.isArray(state.ship.sockets)) errors.push(error('sockets-invalid', '장착 소켓 배열이 필요합니다.'));

  const parts = new Map();
  for (const part of state.parts) {
    if (!record(part)) { errors.push(error('part-invalid', '부품은 객체여야 합니다.')); continue; }
    if (!textId(part.id)) errors.push(error('part-id-invalid', '빈 부품 ID는 사용할 수 없습니다.'));
    else if (parts.has(part.id)) errors.push(error('part-id-duplicate', `${part.id} 부품 ID가 중복됩니다.`));
    else parts.set(part.id, part);
    if (!textId(part.kind) || !textId(part.name)) errors.push(error('part-label-invalid', `${part.id}의 종류/이름이 필요합니다.`));
    if (!nonnegative(part.hp) || !nonnegative(part.maxHp) || part.maxHp <= 0 || part.hp > part.maxHp) errors.push(error('hp-invalid', `${part.id} 내구도는 0 ≤ HP ≤ 최대 HP, 최대 HP > 0이어야 합니다.`));
    if (!nonnegative(part.weight)) errors.push(error('weight-invalid', `${part.id} 중량은 유한한 0 이상 수여야 합니다.`));
    for (const key of ['lift', 'powerSupply', 'powerDemand']) {
      if (part[key] !== undefined && !nonnegative(part[key])) errors.push(error('budget-invalid', `${part.id}의 ${key} 값이 잘못되었습니다.`));
    }
    if (part.ownerId !== state.ownerId) errors.push(error('part-not-owned', `${part.id} 부품의 소유권이 현재 선주에게 없습니다.`));
    if (!LOCATIONS.has(part.location)) errors.push(error('location-invalid', `${part.id}의 보관/화물/장착 상태가 잘못되었습니다.`));
    if (part.parentId !== null && !textId(part.parentId)) errors.push(error('parent-invalid', `${part.id}의 부모 ID는 문자열 또는 null이어야 합니다.`));
    if (part.socketId !== null && !textId(part.socketId)) errors.push(error('socket-invalid', `${part.id}의 소켓 ID는 문자열 또는 null이어야 합니다.`));
    if (!record(part.source) || !textId(part.source.originId) || !textId(part.source.assetId)
      || (part.source.acquiredVoyageId !== null && !textId(part.source.acquiredVoyageId))) {
      errors.push(error('source-invalid', `${part.id}의 원본 개체/자산/회수 항해 출처가 필요합니다.`));
    }
  }

  const sockets = new Map();
  for (const socket of Array.isArray(state.ship.sockets) ? state.ship.sockets : []) {
    if (!record(socket)) { errors.push(error('socket-invalid', '소켓은 객체여야 합니다.')); continue; }
    if (!textId(socket.id)) errors.push(error('socket-id-invalid', '빈 소켓 ID는 사용할 수 없습니다.'));
    else if (sockets.has(socket.id)) errors.push(error('socket-id-duplicate', `${socket.id} 소켓 ID가 중복됩니다.`));
    else sockets.set(socket.id, socket);
    if (!textId(socket.parentId) || !parts.has(socket.parentId)) errors.push(error('socket-parent-missing', `${socket.id} 소켓의 부모 부품을 찾을 수 없습니다.`));
    if (!Array.isArray(socket.kinds) || socket.kinds.length === 0 || socket.kinds.some(kind => !textId(kind)) || unique(socket.kinds).length !== socket.kinds.length) errors.push(error('socket-kinds-invalid', `${socket.id} 소켓의 호환 부품 종류가 잘못되었습니다.`));
    if (typeof socket.enabled !== 'boolean') errors.push(error('socket-enabled-invalid', `${socket.id} 소켓의 활성 상태가 필요합니다.`));
  }
  const root = parts.get(state.ship.rootId);
  if (!root || root.kind !== 'hull' || root.location !== 'installed' || root.parentId !== null || root.socketId !== null) errors.push(error('root-invalid', '핵심 선체는 부모와 소켓이 없는 장착 hull이어야 합니다.'));

  const occupied = new Set();
  for (const part of parts.values()) {
    const parent = parts.get(part.parentId);
    if (part.parentId !== null) {
      if (!parent) errors.push(error('parent-missing', `${part.id}의 부모 부품을 찾을 수 없습니다.`));
      else if (parent.location !== part.location) errors.push(error('location-crossing', `${part.id}와 부모의 위치 상태가 다릅니다.`));
      if (!textId(part.socketId)) errors.push(error('connector-missing', `${part.id}의 부모 연결 소켓이 필요합니다.`));
    } else if (part.socketId !== null) errors.push(error('loose-root-socket', `${part.id} 묶음 루트의 소켓은 null이어야 합니다.`));
    if (part.location === 'installed' && part.id !== state.ship.rootId) {
      if (part.parentId === null) errors.push(error('installed-root-extra', `${part.id}가 핵심 선체에 연결되지 않았습니다.`));
      const socket = sockets.get(part.socketId);
      if (!socket) errors.push(error('installed-socket-missing', `${part.id}의 실제 장착 소켓이 없습니다.`));
      else {
        if (socket.parentId !== part.parentId) errors.push(error('socket-parent-mismatch', `${part.id}의 소켓과 부모 부품이 다릅니다.`));
        if (!Array.isArray(socket.kinds) || !socket.kinds.includes(part.kind)) errors.push(error('socket-incompatible', `${part.id} 종류를 해당 소켓에 장착할 수 없습니다.`));
      }
      if (occupied.has(part.socketId)) errors.push(error('socket-occupied', `${part.socketId} 소켓이 중복 점유되었습니다.`));
      occupied.add(part.socketId);
    }
    const visited = new Set();
    let current = part;
    while (current) {
      if (visited.has(current.id)) { errors.push(error('part-cycle', `${part.id} 부모 연결에 순환이 있습니다.`)); break; }
      visited.add(current.id);
      if (current.parentId === null) {
        if (part.location === 'installed' && current.id !== state.ship.rootId) errors.push(error('root-unreachable', `${part.id}가 핵심 선체까지 연결되지 않습니다.`));
        break;
      }
      current = parts.get(current.parentId);
    }
  }
  if (state.repairReceipts !== undefined) {
    if (!Array.isArray(state.repairReceipts)) errors.push(error('repair-receipts-invalid', '수리 영수증은 배열이어야 합니다.'));
    else {
      const receiptIds = new Set();
      for (const receipt of state.repairReceipts) {
        if (!record(receipt) || !textId(receipt.quoteId) || receiptIds.has(receipt.quoteId)
          || !Number.isSafeInteger(receipt.revision) || receipt.revision < 0 || !nonnegative(receipt.recovery)
          || !record(receipt.cost) || !['S', 'F', 'C'].every(key => nonnegative(receipt.cost[key]))) errors.push(error('repair-receipt-invalid', '수리 영수증의 ID/수정 번호/실소비가 잘못되었습니다.'));
        receiptIds.add(receipt?.quoteId);
      }
    }
  }
  return unique(errors);
}

/** Cargo adds weight only. Warehouse parts provide neither weight nor output. */
export function computeBudget(state) {
  let installedWeight = 0, cargoWeight = 0, lift = 0, powerSupply = 0, powerDemand = 0;
  for (const part of Array.isArray(state?.parts) ? state.parts : []) {
    if (part?.location === 'cargo') cargoWeight += part.weight;
    if (part?.location !== 'installed') continue;
    installedWeight += part.weight;
    if (part.hp <= 0) continue;
    const liftScale = part.kind === 'balloon' ? Math.min(1, part.hp / (part.maxHp * 0.5)) : 1;
    lift += amount(part.lift) * liftScale;
    powerSupply += amount(part.powerSupply);
    powerDemand += amount(part.powerDemand);
  }
  const passengerWeight = state?.ship?.passengerWeight ?? 0;
  const weight = installedWeight + cargoWeight + passengerWeight;
  const liftMargin = lift - weight;
  const powerMargin = powerSupply - powerDemand;
  return { installedWeight, cargoWeight, passengerWeight, weight, totalWeight: weight, lift, powerSupply, powerDemand,
    liftMargin, powerMargin, canLift: liftMargin >= -EPSILON, hasPower: powerMargin >= -EPSILON };
}

function mutationReasons(state) {
  const reasons = validateParts(state);
  if (!['harbor', 'debrief'].includes(state?.phase)) reasons.push(error('unsafe-phase', '항구 또는 귀환 정산 경계에서만 개조/수리할 수 있습니다.'));
  if (state?.revision === Number.MAX_SAFE_INTEGER) reasons.push(error('revision-overflow', '수정 번호 한계에 도달했습니다.'));
  return unique(reasons);
}

function subtree(state, rootId) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const part of state.parts) if (ids.has(part.parentId) && !ids.has(part.id)) { ids.add(part.id); changed = true; }
  }
  return [...ids];
}

function budgetReasons(budget) {
  const reasons = [];
  if (!budget.canLift) reasons.push(error('underlift', `중량 ${budget.weight}이 유효 양력 ${budget.lift}을 초과합니다.`));
  if (!budget.hasPower) reasons.push(error('overpower', `소비 전력 ${budget.powerDemand}이 발전 ${budget.powerSupply}을 초과합니다.`));
  return reasons;
}

export function previewInstall(state, partId, socketId) {
  const before = computeBudget(state);
  const result = { ok: false, reasons: mutationReasons(state), before, after: before, partIds: [] };
  if (result.reasons.length) return result;
  const root = state.parts.find(part => part.id === partId);
  const socket = state.ship.sockets.find(item => item.id === socketId);
  if (!root) result.reasons.push(error('part-missing', '장착할 부품을 찾을 수 없습니다.'));
  else {
    result.partIds = subtree(state, partId);
    if (!['warehouse', 'cargo'].includes(root.location)) result.reasons.push(error('already-installed', '창고 또는 화물의 부품만 장착할 수 있습니다.'));
    if (root.parentId !== null) result.reasons.push(error('bundle-root-required', '묶음의 루트 부품을 선택해야 합니다.'));
    for (const part of state.parts.filter(part => result.partIds.includes(part.id))) {
      if (part.ownerId !== state.ownerId) result.reasons.push(error('part-not-owned', `${part.id}의 소유권이 없습니다.`));
      if (part.hp <= 0) result.reasons.push(error('part-destroyed', `${part.id}를 먼저 수리해야 합니다.`));
    }
  }
  if (!socket) result.reasons.push(error('socket-missing', '장착 위치를 찾을 수 없습니다.'));
  else {
    const parent = state.parts.find(part => part.id === socket.parentId);
    if (!socket.enabled) result.reasons.push(error('socket-disabled', '장착 위치가 비활성 상태입니다.'));
    if (parent?.location !== 'installed') result.reasons.push(error('parent-not-installed', '장착 위치의 부모가 함선에 장착되어 있지 않습니다.'));
    if (root && !socket.kinds.includes(root.kind)) result.reasons.push(error('socket-incompatible', '해당 부품 종류와 장착 위치가 호환되지 않습니다.'));
    if (state.parts.some(part => part.location === 'installed' && part.socketId === socket.id)) result.reasons.push(error('socket-occupied', '선택한 장착 위치를 다른 부품이 사용 중입니다.'));
    if (result.partIds.includes(socket.parentId)) result.reasons.push(error('part-cycle', '자기 묶음 안에 부품을 연결할 수 없습니다.'));
  }
  if (result.reasons.length) return result;
  const next = structuredClone(state);
  const ids = new Set(result.partIds);
  for (const part of next.parts) if (ids.has(part.id)) {
    part.location = 'installed';
    if (part.id === partId) { part.parentId = socket.parentId; part.socketId = socketId; }
  }
  result.after = computeBudget(next);
  result.reasons = [...validateParts(next), ...budgetReasons(result.after)];
  result.ok = result.reasons.length === 0;
  if (result.ok) result.state = next;
  return result;
}

export function installPart(state, partId, socketId) {
  const result = previewInstall(state, partId, socketId);
  if (result.ok) result.state.revision += 1;
  return result;
}

/** Maintenance may leave a ship underpowered/underlift; departure checks it. */
export function removePart(state, partId, { destination } = {}) {
  const before = computeBudget(state);
  const result = { ok: false, reasons: mutationReasons(state), before, after: before, partIds: [] };
  if (result.reasons.length) return result;
  const root = state.parts.find(part => part.id === partId);
  if (!['warehouse', 'cargo'].includes(destination)) result.reasons.push(error('destination-invalid', '분리한 묶음은 창고 또는 화물에 보관해야 합니다.'));
  if (!root) result.reasons.push(error('part-missing', '분리할 부품을 찾을 수 없습니다.'));
  else if (root.id === state.ship.rootId || root.kind === 'hull') result.reasons.push(error('hull-removal-forbidden', '핵심 선체는 분리할 수 없습니다.'));
  else if (root.location !== 'installed') result.reasons.push(error('part-not-installed', '장착한 부품만 분리할 수 있습니다.'));
  if (result.reasons.length) return result;
  result.partIds = subtree(state, partId);
  const ids = new Set(result.partIds);
  const next = structuredClone(state);
  for (const part of next.parts) if (ids.has(part.id)) {
    part.location = destination;
    if (part.id === partId) { part.parentId = null; part.socketId = null; }
  }
  result.after = computeBudget(next);
  result.reasons = validateParts(next);
  result.ok = result.reasons.length === 0;
  if (result.ok) { next.revision += 1; result.state = next; }
  return result;
}

// Change detector, not a security signature. Confirm also recomputes the quote.
function fingerprint(state, ids) {
  return JSON.stringify({ revision: state.revision, ownerId: state.ownerId,
    parts: state.parts.filter(part => ids.includes(part.id)).map(part => ({ id: part.id, hp: part.hp, maxHp: part.maxHp, ownerId: part.ownerId })).sort((a, b) => a.id.localeCompare(b.id)) });
}
function shortHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function quoteRepair(state, partIds) {
  const reasons = mutationReasons(state);
  const ids = partIds === undefined
    ? (Array.isArray(state?.parts) ? state.parts.filter(part => part?.ownerId === state.ownerId && part.hp < part.maxHp).map(part => part.id) : [])
    : Array.isArray(partIds) ? [...partIds] : [];
  if (partIds !== undefined && !Array.isArray(partIds)) reasons.push(error('repair-selection-invalid', '수리 대상은 부품 ID 배열이어야 합니다.'));
  if (unique(ids).length !== ids.length || ids.some(id => !textId(id))) reasons.push(error('repair-selection-invalid', '수리 대상 ID는 중복 없이 지정해야 합니다.'));
  if (reasons.length) return { ok: false, reasons: unique(reasons), partIds: ids, recovery: 0, cost: { S: 0, F: 0, C: 0 } };
  let recovery = 0;
  for (const id of ids) {
    const part = state.parts.find(item => item.id === id);
    if (!part) reasons.push(error('part-missing', `${id} 수리 대상을 찾을 수 없습니다.`));
    else if (part.ownerId !== state.ownerId) reasons.push(error('part-not-owned', `${id} 수리 대상의 소유권이 없습니다.`));
    else recovery += part.maxHp - part.hp;
  }
  const sortedIds = [...ids].sort();
  const stamp = fingerprint(state, sortedIds);
  return { ok: reasons.length === 0, reasons: unique(reasons), quoteId: `repair:${state.revision}:${shortHash(stamp)}`,
    revision: state.revision, fingerprint: stamp, partIds: sortedIds, recovery, cost: { S: Math.ceil(recovery * 0.25), F: 0, C: 0 } };
}

export function confirmRepair(state, quote) {
  const before = computeBudget(state);
  const result = { ok: false, reasons: mutationReasons(state), before, after: before, partIds: [], recovery: 0, actualCost: { S: 0, F: 0, C: 0 } };
  if (!record(quote) || !quote.ok || !Array.isArray(quote.partIds)) result.reasons.push(error('quote-invalid', '유효한 미지불 수리 견적이 필요합니다.'));
  if (result.reasons.length) return result;
  if (state.repairReceipts?.some(receipt => receipt.quoteId === quote.quoteId)) result.reasons.push(error('quote-already-paid', '이미 확정한 수리 견적입니다.'));
  const current = quoteRepair(state, quote.partIds);
  if (!current.ok) result.reasons.push(...current.reasons);
  if (quote.revision !== state.revision || quote.fingerprint !== current.fingerprint || quote.quoteId !== current.quoteId
    || quote.recovery !== current.recovery || !record(quote.cost) || ['S', 'F', 'C'].some(key => quote.cost[key] !== current.cost[key])) result.reasons.push(error('quote-stale', '상태가 바뀌었거나 견적이 변조되었습니다. 새 견적을 받아야 합니다.'));
  if (state.resources.S < current.cost.S) result.reasons.push(error('scrap-insufficient', `수리에 스크랩 ${current.cost.S}S가 필요합니다.`));
  if (result.reasons.length) { result.reasons = unique(result.reasons); return result; }
  const next = structuredClone(state);
  const ids = new Set(current.partIds);
  for (const part of next.parts) if (ids.has(part.id)) part.hp = part.maxHp;
  next.resources.S -= current.cost.S;
  next.revision += 1;
  next.repairReceipts = [...(next.repairReceipts ?? []), { quoteId: current.quoteId, revision: next.revision, recovery: current.recovery, cost: { ...current.cost } }];
  return { ...result, ok: true, reasons: [], state: next, after: computeBudget(next), partIds: current.partIds,
    quoteId: current.quoteId, recovery: current.recovery, actualCost: { ...current.cost } };
}

export function departureReasons(state) {
  const reasons = validateParts(state);
  if (reasons.length) return reasons;
  if (!['harbor', 'debrief'].includes(state.phase)) reasons.push(error('departure-phase', '항구 또는 귀환 정산 단계에서 출항해야 합니다.'));
  if (state.parts.find(part => part.id === state.ship.rootId).hp <= 0) reasons.push(error('hull-destroyed', '핵심 선체를 먼저 수리해야 합니다.'));
  for (const part of state.parts) if (part.location === 'installed' && part.hp <= 0 && part.id !== state.ship.rootId) {
    reasons.push(error('installed-part-destroyed', `${part.name} 장착 부품이 파괴되었습니다. 수리하거나 보관함으로 옮긴 뒤 출항하세요.`));
  }
  for (const [kind, label] of [['engine', '엔진'], ['balloon', '기낭'], ['hook', '갈고리'], ['machinegun', '기관총']]) {
    if (!state.parts.some(part => part.location === 'installed' && part.kind === kind && part.hp > 0)) reasons.push(error(`required-${kind}`, `출항 예시에 필요한 작동 ${label}이 없습니다.`));
  }
  reasons.push(...budgetReasons(computeBudget(state)));
  if (state.resources.F < 5) reasons.push(error('fuel-insufficient', '출항 예시에는 연료 5F가 필요합니다.'));
  return unique(reasons);
}
