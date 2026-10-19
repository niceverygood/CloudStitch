import {createExampleState} from '../harbor/fixtures.mjs';
import {createSaveRepository, JOURNAL_FORMAT, SAVE_VERSION} from '../save/save.mjs';
import {selectedMap, routeBinding, validateRouteState} from './selection.mjs';

/** A rejected slot is preserved; callers can offer its original raw JSON for export. */
export class RouteSaveError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RouteSaveError';
    this.code = code;
    this.readOnly = true;
    Object.assign(this, details);
  }
}

export const stageMapSaveKey = (map = selectedMap) => `cloudstitch.stage-maps.v1.${map.id}`;
const clone = value => structuredClone(value);

function reject(code, message, key, details = {}) {
  throw new RouteSaveError(code, `${message} 기존 저장은 보존했습니다.`, {key, ...details});
}

function parseRaw(raw, key) {
  try { return JSON.parse(raw); }
  catch { return reject('ROUTE_SAVE_CORRUPT', '단계 저장 JSON을 해석하지 못했습니다.', key); }
}

function validateJournalRaw(raw, {key, map}) {
  const journal = parseRaw(raw, key);
  if (!journal || typeof journal !== 'object' || Array.isArray(journal) || journal.format !== JOURNAL_FORMAT || !Array.isArray(journal.backups)) {
    reject('ROUTE_SAVE_FORMAT', '단계 저장 기록의 형식이 다릅니다.', key);
  }
  // Check every route before the frozen factory's base validator can accept it.
  // A foreign backup is also a foreign checkpoint, even when current is correct.
  for (const [index, envelope] of [journal.current, ...journal.backups].entries()) {
    const issues = validateRouteState(envelope?.state, map);
    if (issues.length) {
      reject('ROUTE_SAVE_BINDING', '현재 단계와 저장 경로·버전·지형 또는 상태가 일치하지 않습니다.', key,
        {checkpoint: index === 0 ? 'current' : `backups[${index - 1}]`, issues});
    }
  }
  // Preserve the existing journal/version/checksum/backup-order rules as well.
  // The temporary adapter only reads this exact value; it never touches storage.
  const probe = createSaveRepository({
    storage: {getItem: () => raw, setItem: () => { throw new Error('read-only probe'); }},
    key,
    validateState: state => validateRouteState(state, map),
  }).load();
  if (!probe.ok) {
    reject('ROUTE_SAVE_INVALID', `단계 저장 무결성 확인에 실패했습니다 (${probe.code}).`, key,
      {repositoryCode: probe.code, issues: probe.issues ?? []});
  }
  return journal;
}

function validateConflictRaw(raw, {key, map}) {
  const conflict = parseRaw(raw, key);
  const keys = ['schemaVersion', 'state', 'saveRevision', 'reason'];
  if (!conflict || Array.isArray(conflict) || typeof conflict !== 'object' ||
      conflict.schemaVersion !== SAVE_VERSION || Object.keys(conflict).some(name => !keys.includes(name)) ||
      !Number.isSafeInteger(conflict.saveRevision) || conflict.saveRevision < 0 || typeof conflict.reason !== 'string') {
    reject('ROUTE_CONFLICT_FORMAT', '단계 저장 충돌 보관본의 형식이 다릅니다.', key);
  }
  const issues = validateRouteState(conflict.state, map);
  if (issues.length) reject('ROUTE_CONFLICT_BINDING', '저장 충돌 보관본이 현재 단계와 일치하지 않습니다.', key, {issues});
}

/**
 * Restricts the unchanged controller to one stage slot and its conflict sidecar.
 * Reads and writes validate all checkpoints. setItem remains a single atomic
 * adapter write; no new journal format or cross-tab locking is introduced.
 */
export function createRouteStorageGuard({storage, map = selectedMap} = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new RouteSaveError('ROUTE_STORAGE_UNAVAILABLE', '단계 항해 저장 장치를 사용할 수 없습니다.');
  }
  const key = stageMapSaveKey(map), conflictKey = `${key}.conflict`;
  let requireExisting = false;
  function checkKey(requestedKey) {
    if (requestedKey !== key && requestedKey !== conflictKey) {
      reject('ROUTE_SAVE_KEY', '현재 단계 밖의 저장 키 접근을 차단했습니다.', key);
    }
  }
  function validate(raw, requestedKey) {
    if (raw === null) {
      if (requireExisting && requestedKey === key) reject('ROUTE_SAVE_MISSING', '실행 중 단계 저장이 사라졌습니다.', key);
      return;
    }
    if (typeof raw !== 'string') reject('ROUTE_SAVE_FORMAT', '단계 저장 원본이 문자열이 아닙니다.', key);
    if (requestedKey === key) validateJournalRaw(raw, {key, map});
    else validateConflictRaw(raw, {key: conflictKey, map});
  }
  return {
    key,
    getItem(requestedKey) {
      checkKey(requestedKey);
      let raw;
      try { raw = storage.getItem(requestedKey); }
      catch { return reject('ROUTE_SAVE_READ_FAILED', '단계 저장을 읽지 못했습니다.', key); }
      validate(raw, requestedKey);
      return raw;
    },
    setItem(requestedKey, value) {
      checkKey(requestedKey);
      const raw = String(value);
      validate(raw, requestedKey);
      storage.setItem(requestedKey, raw);
    },
    requireExisting() { requireExisting = true; },
  };
}

/** Preflight and initialize before the frozen controller can use its fallback state. */
export function prepareStageMapStorage({storage, map = selectedMap} = {}) {
  const guarded = createRouteStorageGuard({storage, map});
  const key = guarded.key;
  // The save repository translates adapter exceptions into READ_FAILED. Read
  // once directly first so callers retain the actionable route rejection code.
  guarded.getItem(key);
  guarded.getItem(`${key}.conflict`);
  const repository = createSaveRepository({storage: guarded, key, validateState: state => validateRouteState(state, map)});
  let loaded = repository.load(), seeded = false;
  if (!loaded.ok && loaded.code === 'NOT_FOUND') {
    const state = createExampleState();
    state.route = clone(routeBinding(map));
    const saved = repository.save(state, {expectedRevision: 0, boundary: 'harbor'});
    if (!saved.ok) reject('ROUTE_SAVE_INITIALIZE_FAILED', `단계 첫 저장에 실패했습니다 (${saved.code}).`, key, {repositoryCode: saved.code});
    seeded = true;
    loaded = repository.load();
  }
  if (!loaded.ok) reject('ROUTE_SAVE_LOAD_FAILED', `단계 저장을 불러오지 못했습니다 (${loaded.code}).`, key, {repositoryCode: loaded.code, issues: loaded.issues ?? []});
  guarded.requireExisting();
  return {storage: guarded, key, repository, loaded, seeded, binding: clone(routeBinding(map))};
}

/** Uses the build-aliased, unchanged integration controller as the only owner. */
export async function createStageMapController({storage, muzzleResolver = null} = {}) {
  const prepared = prepareStageMapStorage({storage});
  // Dynamic import permits the storage guard's pure Node tests without a fake
  // controller. The production build aliases this to the frozen root factory.
  const {createVoyageController} = await import('cloudstitch/controller');
  const controller = await createVoyageController({storage: prepared.storage, saveKey: prepared.key, muzzleResolver});
  const issues = validateRouteState(controller.state, selectedMap);
  if (issues.length) reject('ROUTE_CONTROLLER_STATE', '통합 제어기의 시작 상태가 현재 단계와 일치하지 않습니다.', prepared.key, {issues});
  return controller;
}
