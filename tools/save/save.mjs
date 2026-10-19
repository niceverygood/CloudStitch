/**
 * Synchronous safe-boundary storage for the independent harbor example.
 * The storage adapter must implement localStorage's atomic setItem contract:
 * a throwing write leaves the existing value unchanged. This is not a
 * cross-tab compare-and-swap or an OS filesystem durability guarantee.
 */
export const SAVE_FORMAT = 'cloudstitch.safe-boundary';
export const JOURNAL_FORMAT = `${SAVE_FORMAT}.journal`;
export const SAVE_VERSION = 1;
export const MAX_BACKUPS = 3;

const BOUNDARIES = new Set(['harbor', 'departure', 'return']);
const PHASES = new Set(['harbor', 'debrief']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const copy = (value) => JSON.parse(JSON.stringify(value));
const failure = (code, message, details = {}) => ({ ok: false, code, message, ...details });

function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJSON(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** FNV-1a over UTF-8. Detects accidental corruption; not authentication. */
export function checksumFNV1a(text) {
  let hash = 0x811c9dc5;
  const consume = (byte) => { hash = Math.imul(hash ^ byte, 0x01000193) >>> 0; };
  for (const character of text) {
    let point = character.codePointAt(0);
    if (point >= 0xd800 && point <= 0xdfff) point = 0xfffd;
    if (point < 0x80) consume(point);
    else if (point < 0x800) {
      consume(0xc0 | (point >> 6)); consume(0x80 | (point & 0x3f));
    } else if (point < 0x10000) {
      consume(0xe0 | (point >> 12)); consume(0x80 | ((point >> 6) & 0x3f)); consume(0x80 | (point & 0x3f));
    } else {
      consume(0xf0 | (point >> 18)); consume(0x80 | ((point >> 12) & 0x3f));
      consume(0x80 | ((point >> 6) & 0x3f)); consume(0x80 | (point & 0x3f));
    }
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
}

function envelopeChecksum(envelope) {
  const { checksum, ...payload } = envelope;
  return checksumFNV1a(stableJSON(payload));
}

function jsonProblems(value, path = 'state', seen = new Set(), depth = 0) {
  if (depth > 64) return [`${path}: 저장 객체의 중첩 깊이가 너무 큽니다.`];
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return [];
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [`${path}: 유한한 숫자가 필요합니다.`];
  if (typeof value !== 'object') return [`${path}: JSON으로 보존할 수 없는 값입니다.`];
  if (seen.has(value)) return [`${path}: 순환 참조가 있습니다.`];
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return [`${path}: 일반 JSON 객체가 필요합니다.`];
  }
  seen.add(value);
  const issues = [];
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length) issues.push(`${path}: Symbol 키는 저장할 수 없습니다.`);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!own(descriptors, String(index))) issues.push(`${path}[${index}]: 비어 있는 배열 원소입니다.`);
    }
  }
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (!descriptor.enumerable || descriptor.get || descriptor.set) {
      issues.push(`${path}.${key}: 열거 가능한 값 속성만 저장할 수 있습니다.`);
      continue;
    }
    if (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key)) {
      issues.push(`${path}.${key}: 배열의 별도 속성은 저장할 수 없습니다.`);
      continue;
    }
    issues.push(...jsonProblems(descriptor.value, `${path}.${key}`, seen, depth + 1));
  }
  seen.delete(value);
  return issues;
}

function validRevision(value, minimum = 1) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function isoTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

export function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [String(key), String(value)]));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(String(key)) ?? null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); },
    dump() { return Object.fromEntries(values); },
  };
}

export function createSaveRepository({
  storage,
  key = 'cloudstitch.harbor.v1',
  validateState = () => [],
  now = () => new Date(),
} = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('getItem/setItem을 제공하는 저장 장치가 필요합니다.');
  }
  if (typeof validateState !== 'function' || typeof now !== 'function' || typeof key !== 'string' || !key) {
    throw new TypeError('저장 키와 검증·시간 함수를 확인하세요.');
  }
  let lastKnownGood = null;

  function stateIssues(state) {
    const issues = jsonProblems(state);
    if (issues.length) return issues;
    if (!state || Array.isArray(state) || typeof state !== 'object') return ['state: 저장 상태 객체가 필요합니다.'];
    if (state.schemaVersion !== SAVE_VERSION) issues.push('지원하지 않는 상태 버전입니다.');
    if (!PHASES.has(state.phase)) issues.push('항구 또는 귀환 정산의 안전 지점에서만 저장할 수 있습니다.');
    try {
      // A validator cannot mutate the caller's state or the stored candidate.
      const domainIssues = validateState(copy(state));
      if (!Array.isArray(domainIssues) || domainIssues.some((entry) => typeof entry !== 'string')) {
        issues.push('상태 검증 함수는 문자열 배열을 반환해야 합니다.');
      } else issues.push(...domainIssues);
    } catch {
      issues.push('상태 검증을 완료하지 못했습니다.');
    }
    return issues;
  }

  function envelopeIssues(envelope) {
    if (!envelope || Array.isArray(envelope) || typeof envelope !== 'object') return ['저장 스냅샷 형식이 잘못되었습니다.'];
    const issues = [];
    const envelopeKeys = new Set(['format', 'version', 'revision', 'savedAt', 'boundary', 'state', 'checksum']);
    if (Object.keys(envelope).some((name) => !envelopeKeys.has(name))) issues.push('저장 스냅샷에 알 수 없는 필드가 있습니다.');
    if (envelope.format !== SAVE_FORMAT) issues.push('저장 스냅샷 형식이 다릅니다.');
    if (envelope.version !== SAVE_VERSION) issues.push('지원하지 않는 저장 버전입니다.');
    if (!validRevision(envelope.revision)) issues.push('저장 revision이 잘못되었습니다.');
    if (!BOUNDARIES.has(envelope.boundary)) issues.push('저장 안전 경계가 잘못되었습니다.');
    try {
      if (typeof envelope.savedAt !== 'string' || isoTime(envelope.savedAt) !== envelope.savedAt) {
        issues.push('저장 시각이 올바른 ISO 시각이 아닙니다.');
      }
    } catch { issues.push('저장 시각이 잘못되었습니다.'); }
    const snapshotIssues = stateIssues(envelope.state);
    issues.push(...snapshotIssues);
    if (typeof envelope.checksum !== 'string' || (!issues.length && envelope.checksum !== envelopeChecksum(envelope))) {
      issues.push('저장 무결성 검사가 일치하지 않습니다.');
    }
    return issues;
  }

  function readJournal() {
    let raw;
    try { raw = storage.getItem(key); }
    catch { return failure('READ_FAILED', '저장 데이터를 읽지 못했습니다. 마지막 정상 저장은 변경하지 않았습니다.', { lastGoodRevision: lastKnownGood?.revision ?? null }); }
    if (raw === null) return { ok: true, empty: true, raw: null, journal: null };
    let journal;
    try { journal = JSON.parse(raw); }
    catch { return failure('CORRUPT_JOURNAL', '저장 데이터를 해석하지 못했습니다. 원본을 보존했으며 덮어쓰지 않습니다.', { readOnly: true, rawAvailable: true, raw }); }
    if (!journal || Array.isArray(journal) || typeof journal !== 'object' || journal.format !== JOURNAL_FORMAT) {
      return failure('INVALID_JOURNAL', '저장 기록 형식이 잘못되었습니다. 기존 데이터를 덮어쓰지 않습니다.', { readOnly: true, rawAvailable: true, raw });
    }
    const versionedSnapshots = [journal.current, ...(Array.isArray(journal.backups) ? journal.backups : [])];
    const hasUnsupportedVersion = versionedSnapshots.some((envelope) =>
      envelope && ((own(envelope, 'version') && envelope.version !== SAVE_VERSION) ||
      (envelope.state && own(envelope.state, 'schemaVersion') && envelope.state.schemaVersion !== SAVE_VERSION)));
    if (journal.version !== SAVE_VERSION || hasUnsupportedVersion) {
      return failure('UNSUPPORTED_VERSION', '이 저장 버전은 지원하지 않습니다. 원본을 보존하고 불러오기를 중단했습니다.', { readOnly: true, rawAvailable: true, raw });
    }
    if (!Array.isArray(journal.backups) || journal.backups.length > MAX_BACKUPS) {
      return failure('INVALID_JOURNAL', '정상 저장 백업 목록이 잘못되었습니다. 기존 데이터를 덮어쓰지 않습니다.', { readOnly: true, rawAvailable: true, raw });
    }
    if (Object.keys(journal).some((name) => !['format', 'version', 'current', 'backups'].includes(name))) {
      return failure('INVALID_JOURNAL', '저장 기록에 알 수 없는 필드가 있습니다. 기존 데이터를 덮어쓰지 않습니다.', { readOnly: true, rawAvailable: true, raw });
    }
    const currentIssues = envelopeIssues(journal.current);
    const backupChecks = journal.backups.map((envelope, index) => ({ envelope, index, issues: envelopeIssues(envelope) }));
    const revisions = journal.backups.map((envelope) => envelope?.revision);
    const sequenceIssues = [];
    if (new Set(revisions).size !== revisions.length) sequenceIssues.push('백업 revision이 중복되었습니다.');
    for (let index = 1; index < revisions.length; index += 1) {
      if (!(revisions[index - 1] > revisions[index])) sequenceIssues.push('백업 revision 순서가 잘못되었습니다.');
    }
    if (!currentIssues.length && revisions.some((revision) => revision >= journal.current.revision)) {
      sequenceIssues.push('현재 저장보다 새로운 백업이 있습니다.');
    }
    const validBackups = backupChecks.filter((entry) => !entry.issues.length).map((entry) => entry.envelope);
    return { ok: true, empty: false, raw, journal, currentIssues, backupChecks, sequenceIssues, validBackups };
  }

  function journalIssueResult(read) {
    if (!read.ok || read.empty) return read;
    if (read.currentIssues.length) {
      return failure(read.validBackups.length ? 'RECOVERY_AVAILABLE' : 'INVALID_CURRENT',
        read.validBackups.length ? '현재 저장이 손상되었습니다. 정상 백업을 확인한 뒤 명시적으로 복구하세요.' : '현재 저장이 손상되었고 정상 백업을 찾지 못했습니다. 기존 데이터를 덮어쓰지 않습니다.',
        { readOnly: true, recoveryAvailable: read.validBackups.length > 0, issues: read.currentIssues, backups: read.validBackups.map(summary), rawAvailable: true });
    }
    if (read.sequenceIssues.length || read.backupChecks.some((entry) => entry.issues.length)) {
      return failure('INVALID_JOURNAL', '백업 기록이 손상되었습니다. 기존 데이터를 덮어쓰지 않습니다.', {
        readOnly: true,
        issues: [...read.sequenceIssues, ...read.backupChecks.flatMap((entry) => entry.issues)],
        rawAvailable: true,
      });
    }
    return read;
  }

  function summary(envelope) {
    return { revision: envelope.revision, savedAt: envelope.savedAt, boundary: envelope.boundary };
  }

  function remember(envelope) { lastKnownGood = copy(envelope); }

  function load() {
    const read = journalIssueResult(readJournal());
    if (!read.ok) return read;
    if (read.empty) return failure('NOT_FOUND', '저장된 항해가 없습니다.');
    remember(read.journal.current);
    return { ok: true, code: 'LOADED', message: '최근 안전 지점에서 재개합니다.', ...summary(read.journal.current), state: copy(read.journal.current.state), envelope: copy(read.journal.current), backupCount: read.journal.backups.length };
  }

  function buildEnvelope(state, revision, boundary) {
    const envelope = { format: SAVE_FORMAT, version: SAVE_VERSION, revision, savedAt: isoTime(now()), boundary, state: copy(state) };
    envelope.checksum = envelopeChecksum(envelope);
    return envelope;
  }

  function save(state, { expectedRevision, boundary = 'harbor' } = {}) {
    const issues = stateIssues(state);
    if (issues.length) return failure('INVALID_STATE', '안전하게 저장할 수 없는 상태입니다.', { issues });
    if (!BOUNDARIES.has(boundary)) return failure('INVALID_BOUNDARY', '지원하지 않는 저장 안전 경계입니다.');
    if (expectedRevision !== undefined && !validRevision(expectedRevision, 0)) return failure('INVALID_REVISION', '예상 저장 revision이 잘못되었습니다.');
    const read = journalIssueResult(readJournal());
    if (!read.ok) return read;
    const revision = read.empty ? 0 : read.journal.current.revision;
    if (expectedRevision !== undefined && expectedRevision !== revision) {
      return failure('REVISION_CONFLICT', '다른 저장이 먼저 반영되었습니다. 다시 불러온 뒤 확인하세요.', { expectedRevision, actualRevision: revision, lastGoodRevision: revision });
    }
    if (!validRevision(revision + 1)) return failure('REVISION_EXHAUSTED', '저장 revision 범위를 초과했습니다. 기존 저장을 보존했습니다.');
    let envelope;
    try { envelope = buildEnvelope(state, revision + 1, boundary); }
    catch { return failure('INVALID_TIME', '저장 시각을 확인하지 못했습니다. 기존 저장을 보존했습니다.'); }
    const backups = read.empty ? [] : [read.journal.current, ...read.journal.backups].slice(0, MAX_BACKUPS);
    const journal = { format: JOURNAL_FORMAT, version: SAVE_VERSION, current: envelope, backups };
    try { storage.setItem(key, JSON.stringify(journal)); }
    catch { return failure('WRITE_FAILED', '저장하지 못했습니다. 현재 세션을 유지하며 마지막 정상 저장을 보존했습니다.', { lastGoodRevision: revision || null, lastGoodSavedAt: read.empty ? null : read.journal.current.savedAt }); }
    remember(envelope);
    return { ok: true, code: 'SAVED', message: '안전 지점에 저장했습니다.', ...summary(envelope), envelope: copy(envelope), backupCount: backups.length };
  }

  function exportCurrent() {
    try {
      const raw = storage.getItem(key);
      return { ok: true, code: 'EXPORTED', message: raw === null ? '저장 데이터가 없습니다.' : '저장 원본을 내보냈습니다.', key, raw, hasData: raw !== null };
    } catch { return failure('READ_FAILED', '저장 원본을 읽지 못했습니다.'); }
  }

  function inspect() {
    const read = readJournal();
    if (!read.ok) {
      const { raw, ...result } = read;
      return { ...result, key, lastKnownGood: lastKnownGood ? summary(lastKnownGood) : null };
    }
    if (read.empty) return { ok: true, code: 'EMPTY', message: '저장된 항해가 없습니다.', key, current: null, backups: [], backupCount: 0, readOnly: false };
    const status = journalIssueResult(read);
    return {
      ok: status.ok,
      code: status.ok ? 'VALID' : status.code,
      message: status.ok ? '저장 기록이 정상입니다.' : status.message,
      key,
      current: read.currentIssues.length ? null : summary(read.journal.current),
      backups: read.backupChecks.map((entry) => ({ ...summary(entry.envelope ?? {}), valid: entry.issues.length === 0, issues: [...entry.issues] })),
      backupCount: read.journal.backups.length,
      readOnly: !status.ok,
      recoveryAvailable: read.currentIssues.length > 0 && read.validBackups.length > 0,
      issues: status.issues ?? [],
    };
  }

  function recoverBackup({ revision, expectedRevision } = {}) {
    const read = readJournal();
    if (!read.ok) return read;
    if (read.empty) return failure('NOT_FOUND', '복구할 저장 데이터가 없습니다.');
    if (!read.currentIssues.length) return failure('RECOVERY_NOT_REQUIRED', '현재 저장이 정상입니다. 손상 복구가 필요하지 않습니다.');
    if (!read.validBackups.length) return failure('NO_VALID_BACKUP', '정상 백업을 찾지 못했습니다. 원본을 보존했습니다.');
    if (revision !== undefined && !validRevision(revision)) return failure('INVALID_REVISION', '복구할 백업 revision이 잘못되었습니다.');
    const candidate = revision === undefined
      ? [...read.validBackups].sort((a, b) => b.revision - a.revision)[0]
      : read.validBackups.find((envelope) => envelope.revision === revision);
    if (!candidate) return failure('BACKUP_NOT_FOUND', '요청한 정상 백업을 찾지 못했습니다.');
    const currentRevision = validRevision(read.journal.current?.revision) ? read.journal.current.revision : 0;
    if (expectedRevision !== undefined && (!validRevision(expectedRevision, 0) || expectedRevision !== currentRevision)) {
      return failure('REVISION_CONFLICT', '복구할 저장 revision이 달라졌습니다. 다시 확인하세요.', { actualRevision: currentRevision, expectedRevision });
    }
    const nextRevision = Math.max(currentRevision, ...read.validBackups.map((envelope) => envelope.revision)) + 1;
    if (!validRevision(nextRevision)) return failure('REVISION_EXHAUSTED', '복구 revision 범위를 초과했습니다. 원본을 보존했습니다.');
    let envelope;
    try { envelope = buildEnvelope(candidate.state, nextRevision, candidate.boundary); }
    catch { return failure('INVALID_TIME', '복구 저장 시각을 확인하지 못했습니다. 원본을 보존했습니다.'); }
    const uniqueBackups = [...new Map(read.validBackups.map((entry) => [entry.revision, entry])).values()];
    const backups = [candidate, ...uniqueBackups.filter((entry) => entry.revision !== candidate.revision).sort((a, b) => b.revision - a.revision)].slice(0, MAX_BACKUPS);
    // Restoring an older selected backup must still keep descending revisions.
    backups.sort((a, b) => b.revision - a.revision);
    const journal = { format: JOURNAL_FORMAT, version: SAVE_VERSION, current: envelope, backups };
    let quarantineKey = `${key}.quarantine.${envelope.savedAt}`;
    try {
      let suffix = 0;
      while (storage.getItem(quarantineKey) !== null) {
        suffix += 1;
        quarantineKey = `${key}.quarantine.${envelope.savedAt}.${suffix}`;
      }
      storage.setItem(quarantineKey, read.raw);
      if (storage.getItem(quarantineKey) !== read.raw) return failure('QUARANTINE_FAILED', '손상 원본 보존을 확인하지 못했습니다. 복구하지 않았습니다.');
      if (storage.getItem(key) !== read.raw) return failure('REVISION_CONFLICT', '원본 보존 중 저장이 변경되었습니다. 복구하지 않았습니다.', { quarantineKey });
    } catch {
      return failure('QUARANTINE_FAILED', '손상 원본을 보존·확인하지 못했습니다. 기존 저장을 변경하지 않았습니다.');
    }
    try { storage.setItem(key, JSON.stringify(journal)); }
    catch { return failure('WRITE_FAILED', '백업을 복구해 저장하지 못했습니다. 손상 원본과 정상 백업을 보존했습니다.', { quarantineKey, lastGoodRevision: candidate.revision }); }
    remember(envelope);
    return { ok: true, code: 'RECOVERED', message: '정상 백업의 안전 지점을 복구했습니다. 손상 원본도 별도로 보존했습니다.', ...summary(envelope), recoveredFromRevision: candidate.revision, quarantineKey, state: copy(envelope.state), envelope: copy(envelope), backupCount: backups.length };
  }

  return { load, save, exportCurrent, inspect, recoverBackup };
}
