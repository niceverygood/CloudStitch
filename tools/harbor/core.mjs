import { validateParts, departureReasons } from '../shipyard/shipyard.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code, message) => ({ ok: false, code, message });
const resourceKeys = ['S', 'F', 'C'];
const validId = v => typeof v === 'string' && v.length > 0 && v.length <= 200;
const validAmount = v => Number.isFinite(v) && v >= 0 && v <= 1e9;
const resourceErrors = v => !v || resourceKeys.some(k => !validAmount(v[k]));
const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
};

export function validateState(state) {
  if (!state || typeof state !== 'object') return ['저장 상태가 객체가 아닙니다.'];
  const errors = [];
  if (state.schemaVersion !== 1) errors.push('지원하지 않는 상태 버전입니다.');
  if (!validId(state.profileId) || !validId(state.ownerId)) errors.push('선장/소유자 ID가 없습니다.');
  if (!Number.isSafeInteger(state.revision) || state.revision < 0 || state.revision >= Number.MAX_SAFE_INTEGER) errors.push('수정 번호가 잘못되었습니다.');
  if (!Number.isSafeInteger(state.voyageSequence) || state.voyageSequence < 0 || state.voyageSequence >= Number.MAX_SAFE_INTEGER) errors.push('항해 순번이 잘못되었습니다.');
  if (!['harbor', 'debrief', 'sailing'].includes(state.phase)) errors.push('항해 상태가 잘못되었습니다.');
  if (!['harbor', 'return', 'departure'].includes(state.boundary)) errors.push('안전 경계가 잘못되었습니다.');
  if (resourceErrors(state.resources)) errors.push('S/F/C 자원이 잘못되었습니다.');
  if (!Array.isArray(state.settlements)) errors.push('정산 원장이 없습니다.');
  else {
    const voyages = new Set(), settlements = new Set();
    for (const entry of state.settlements) {
      if (!validId(entry?.voyageId) || !validId(entry?.settlementId) || typeof entry?.fingerprint !== 'string' ||
          voyages.has(entry.voyageId) || settlements.has(entry.settlementId) ||
          !Array.isArray(entry.partIds) || entry.partIds.some(id => !validId(id)) || new Set(entry.partIds).size !== entry.partIds.length ||
          !['completed','withdrawn'].includes(entry.outcome) ||
          [entry.gained, entry.spent, entry.contractPaid].some(resourceErrors) ||
          !resourceKeys.every(k => Number.isFinite(entry.net?.[k]) && Math.abs(entry.net[k]) <= 1e9 && entry.net[k] === entry.gained?.[k] - entry.spent?.[k] + entry.contractPaid?.[k])) errors.push('정산 원장 충돌 또는 형식 오류입니다.');
      voyages.add(entry?.voyageId); settlements.add(entry?.settlementId);
    }
  }
  if (state.activeVoyage !== null && (!state.activeVoyage || !validId(state.activeVoyage.id) || resourceErrors(state.activeVoyage.departureResources))) errors.push('진행 중 항해가 잘못되었습니다.');
  if (state.phase === 'sailing' && !state.activeVoyage) errors.push('항해 ID 없는 출항 상태입니다.');
  if (state.activeVoyage && (!['harbor','sailing'].includes(state.phase) || state.boundary !== 'departure')) errors.push('진행 항해는 출항 안전 경계를 유지해야 합니다.');
  if (state.boundary === 'departure' && !state.activeVoyage) errors.push('출항 안전 경계에 항해 ID가 없습니다.');
  if (state.activeVoyage && Array.isArray(state.settlements) && state.settlements.some(e => e?.voyageId === state.activeVoyage.id)) errors.push('정산된 항해가 다시 진행 중입니다.');
  if (!Array.isArray(state.repairReceipts)) errors.push('수리 영수증 원장이 없습니다.');
  try { errors.push(...validateParts(state)); } catch { errors.push('부품 구조를 읽을 수 없습니다.'); }
  return errors;
}

export function acceptReturn(state, result) {
  const invalid = validateState(state);
  if (invalid.length) return fail('INVALID_STATE', invalid.join(' '));
  if (!result || result.version !== 1 || !validId(result.voyageId) || !validId(result.settlementId) ||
      !['completed', 'withdrawn'].includes(result.outcome) ||
      !['independent-example', 'battlefield-adapter'].includes(result.evidence) ||
      [result.gained, result.spent, result.contractReward].some(resourceErrors) ||
      !Array.isArray(result.recovered) || !Array.isArray(result.damage)) return fail('INVALID_RETURN', '귀환 결과 형식이 잘못되었습니다.');
  const fingerprint = canonical(result);
  const prior = state.settlements.find(e => e.voyageId === result.voyageId || e.settlementId === result.settlementId);
  if (prior) return prior.voyageId === result.voyageId && prior.settlementId === result.settlementId && prior.fingerprint === fingerprint
    ? { ok: true, duplicate: true, state, receipt: prior }
    : fail('SETTLEMENT_CONFLICT', '이미 정산한 항해/정산 ID와 내용이 충돌합니다.');
  if (state.phase !== 'sailing' || state.activeVoyage?.id !== result.voyageId) return fail('WRONG_VOYAGE', '현재 출항한 항해와 귀환 ID가 다릅니다.');
  const next = clone(state);
  const net = {};
  for (const key of resourceKeys) {
    net[key] = result.gained[key] - result.spent[key] + (result.outcome === 'completed' ? result.contractReward[key] : 0);
    next.resources[key] += net[key];
    if (!validAmount(next.resources[key])) return fail('RESOURCE_UNDERFLOW', `${key} 실제 지출이 보유량을 넘습니다.`);
  }
  const incomingIds = new Set();
  for (const part of result.recovered) {
    if (!part || incomingIds.has(part.id) || next.parts.some(p => p.id === part.id)) return fail('PART_ID_CONFLICT', '회수품 ID가 중복됩니다.');
    if (part.ownerId !== state.ownerId || part.location !== 'cargo' || part.source?.acquiredVoyageId !== result.voyageId) return fail('RECOVERY_NOT_CONFIRMED', '회수 완료·소유권·화물 상태를 확인할 수 없습니다.');
    incomingIds.add(part.id); next.parts.push(clone(part));
  }
  if (result.recoveredSockets !== undefined && !Array.isArray(result.recoveredSockets)) return fail('INVALID_SOCKET', '회수 묶음 소켓 형식이 잘못되었습니다.');
  for (const socket of result.recoveredSockets || []) {
    if (!incomingIds.has(socket?.parentId) || next.ship.sockets.some(s => s.id === socket?.id)) return fail('SOCKET_ID_CONFLICT', '회수 묶음 소켓의 부모 또는 ID가 충돌합니다.');
    next.ship.sockets.push(clone(socket));
  }
  const damagedIds = new Set();let restoredBeyondDeparture=0;
  for (const damage of result.damage) {
    const part = next.parts.find(p => p.id === damage?.partId && p.location === 'installed');
    if (!part || damagedIds.has(part.id) || !validAmount(damage.hp) || damage.hp > part.maxHp) return fail('INVALID_DAMAGE', '귀환 내구도는 장착 부품의 최대 내구도를 넘을 수 없습니다.');
    if (damage.hp>part.hp&&part.id!==next.ship.rootId) return fail('UNSUPPORTED_FIELD_REPAIR', '현 전장의 전투 수리는 핵심 선체만 지원합니다.');
    restoredBeyondDeparture+=Math.max(0,damage.hp-part.hp);
    damagedIds.add(part.id); part.hp = damage.hp;
  }
  if (restoredBeyondDeparture>0 && (result.evidence!=='battlefield-adapter'||result.spent.S<restoredBeyondDeparture*.5)) return fail('UNPAID_FIELD_REPAIR', '출항 전보다 복구된 내구도의 실제 전투 수리 지출이 확인되지 않습니다.');
  const receipt = {
    voyageId: result.voyageId, settlementId: result.settlementId, fingerprint,
    outcome: result.outcome, evidence: result.evidence,
    gained: clone(result.gained), spent: clone(result.spent),
    contractPaid: result.outcome === 'completed' ? clone(result.contractReward) : { S: 0, F: 0, C: 0 },
    net, partIds: [...incomingIds], restoredBeyondDeparture,
  };
  next.settlements.push(receipt); next.activeVoyage = null;
  next.phase = 'debrief'; next.boundary = 'return'; next.revision += 1;
  const errors = validateState(next);
  return errors.length ? fail('INVALID_RETURN', errors.join(' ')) : { ok: true, state: next, receipt };
}

export function storeCargo(state) {
  if (!['harbor', 'debrief'].includes(state.phase)) return fail('UNSAFE_BOUNDARY', '항구에서만 화물을 보관할 수 있습니다.');
  const next = clone(state), partIds = [];
  for (const part of next.parts) if (part.location === 'cargo') { part.location = 'warehouse'; partIds.push(part.id); }
  next.phase = 'harbor'; next.boundary = next.activeVoyage ? 'departure' : 'harbor'; next.revision += 1;
  const errors = validateState(next);
  return errors.length ? fail('INVALID_STATE', errors.join(' ')) : { ok: true, state: next, partIds };
}

export function prepareDeparture(state) {
  const errors = validateState(state);
  if (errors.length) return fail('INVALID_STATE', errors.join(' '));
  if (!['harbor', 'debrief'].includes(state.phase)) return fail('ALREADY_SAILING', '이미 출항 중입니다.');
  if (state.activeVoyage) return fail('DEPARTURE_PENDING', '저장된 출항 준비를 이어가세요.');
  const reasons = departureReasons(state);
  if (reasons.length) return { ok: false, code: 'DEPARTURE_BLOCKED', message: reasons.join(' '), reasons };
  const next = clone(state); next.voyageSequence += 1;
  next.activeVoyage = { id: `${next.profileId}:voyage-${next.voyageSequence}`, departureResources: clone(next.resources) };
  next.boundary = 'departure'; next.phase = 'harbor'; next.revision += 1;
  return { ok: true, state: next, voyageId: next.activeVoyage.id };
}

export function commitDeparture(state) {
  const errors = validateState(state);
  if (errors.length) return fail('INVALID_STATE', errors.join(' '));
  if (state.phase !== 'harbor' || state.boundary !== 'departure' || !state.activeVoyage) return fail('NOT_PREPARED', '출항 직전 안전 저장이 필요합니다.');
  const reasons = departureReasons(state);
  if (reasons.length) return { ok:false, code:'DEPARTURE_BLOCKED', message:reasons.join(' '), reasons };
  const next = clone(state); next.phase = 'sailing'; next.revision += 1;
  // Fuel is charged once with the return's actual field spending, never here.
  return { ok: true, state: next, voyageId: next.activeVoyage.id };
}
