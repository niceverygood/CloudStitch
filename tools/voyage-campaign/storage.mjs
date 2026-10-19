import {createSaveRepository, JOURNAL_FORMAT, SAVE_VERSION} from '../save/save.mjs';
import {CAMPAIGN_SAVE_KEY, createCampaignState, validateCampaignState} from './campaign.mjs';

export class CampaignSaveError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'CampaignSaveError'; this.code = code; this.readOnly = true; Object.assign(this, details); }
}
function reject(code, message, key = CAMPAIGN_SAVE_KEY, details = {}) {
  throw new CampaignSaveError(code, `${message} 기존 저장은 보존했습니다.`, {key, ...details});
}
function parse(raw, key) {
  try { return JSON.parse(raw); }
  catch { return reject('CAMPAIGN_SAVE_CORRUPT', '캠페인 저장 JSON을 해석하지 못했습니다.', key); }
}
function validateRaw(raw, key) {
  const journal = parse(raw, key);
  if (!journal || Array.isArray(journal) || typeof journal !== 'object' || journal.format !== JOURNAL_FORMAT || !Array.isArray(journal.backups)) {
    reject('CAMPAIGN_SAVE_FORMAT', '캠페인 저장 기록의 형식이 다릅니다.', key);
  }
  for (const [index, envelope] of [journal.current, ...journal.backups].entries()) {
    const issues = validateCampaignState(envelope?.state);
    if (issues.length) reject('CAMPAIGN_SAVE_BINDING', '캠페인 경로·진행·상태가 일치하지 않습니다.', key,
      {checkpoint: index === 0 ? 'current' : `backups[${index - 1}]`, issues});
  }
  const checked = createSaveRepository({storage: {getItem: () => raw, setItem: () => {throw new Error('read only');}}, key, validateState: validateCampaignState}).load();
  if (!checked.ok) reject('CAMPAIGN_SAVE_INVALID', `캠페인 저장 무결성 확인에 실패했습니다 (${checked.code}).`, key, {repositoryCode: checked.code, issues: checked.issues ?? []});
}
function validateConflict(raw, key) {
  const value = parse(raw, key), keys = ['schemaVersion', 'state', 'saveRevision', 'reason'];
  if (!value || Array.isArray(value) || typeof value !== 'object' || value.schemaVersion !== SAVE_VERSION ||
      Object.keys(value).length !== keys.length || Object.keys(value).some(name => !keys.includes(name)) ||
      !Number.isSafeInteger(value.saveRevision) || value.saveRevision < 0 || typeof value.reason !== 'string') {
    reject('CAMPAIGN_CONFLICT_FORMAT', '캠페인 충돌 보관본의 형식이 다릅니다.', key);
  }
  const issues = validateCampaignState(value.state);
  if (issues.length) reject('CAMPAIGN_CONFLICT_BINDING', '캠페인 충돌 보관본의 경로·진행이 일치하지 않습니다.', key, {issues});
}

/** Same atomic journal write; no automatic reset, conversion, or cross-tab lock. */
export function createCampaignStorageGuard({storage} = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') reject('CAMPAIGN_STORAGE_UNAVAILABLE', '캠페인 저장 장치를 사용할 수 없습니다.');
  const key = CAMPAIGN_SAVE_KEY, conflictKey = `${key}.conflict`;
  let requireExisting = false;
  function checkKey(requested) {
    if (requested !== key && requested !== conflictKey) reject('CAMPAIGN_SAVE_KEY', '캠페인 밖의 저장 키 접근을 차단했습니다.');
  }
  function check(raw, requested) {
    if (raw === null) {
      if (requireExisting && requested === key) reject('CAMPAIGN_SAVE_MISSING', '실행 중 캠페인 저장이 사라졌습니다.');
      return;
    }
    if (typeof raw !== 'string') reject('CAMPAIGN_SAVE_FORMAT', '캠페인 저장 원본이 문자열이 아닙니다.');
    if (requested === key) validateRaw(raw, key); else validateConflict(raw, conflictKey);
  }
  return {
    key,
    getItem(requested) { checkKey(requested); let raw; try {raw = storage.getItem(requested);} catch {return reject('CAMPAIGN_SAVE_READ_FAILED', '캠페인 저장을 읽지 못했습니다.');} check(raw, requested); return raw; },
    setItem(requested, value) {checkKey(requested); const raw = String(value); check(raw, requested); storage.setItem(requested, raw);},
    requireExisting() {requireExisting = true;},
  };
}

export function prepareCampaignStorage({storage} = {}) {
  const guarded = createCampaignStorageGuard({storage}), key = guarded.key;
  guarded.getItem(key); guarded.getItem(`${key}.conflict`);
  const repository = createSaveRepository({storage: guarded, key, validateState: validateCampaignState});
  let loaded = repository.load(), seeded = false;
  if (!loaded.ok && loaded.code === 'NOT_FOUND') {
    const saved = repository.save(createCampaignState(), {expectedRevision: 0, boundary: 'harbor'});
    if (!saved.ok) reject('CAMPAIGN_SAVE_INITIALIZE_FAILED', `캠페인 첫 저장에 실패했습니다 (${saved.code}).`, key, {repositoryCode: saved.code});
    seeded = true; loaded = repository.load();
  }
  if (!loaded.ok) reject('CAMPAIGN_SAVE_LOAD_FAILED', `캠페인을 불러오지 못했습니다 (${loaded.code}).`, key, {repositoryCode: loaded.code});
  guarded.requireExisting();
  return {storage: guarded, key, repository, loaded, seeded};
}
