import test from 'node:test';
import assert from 'node:assert/strict';
import { checksumFNV1a, createMemoryStorage, createSaveRepository, JOURNAL_FORMAT, SAVE_FORMAT } from './save.mjs';

const KEY = 'cloudstitch.harbor.v1';
const NOW = '2026-10-18T09:30:00.000Z';
const state = (scrap = 100, phase = 'harbor') => ({ schemaVersion: 1, phase, resources: { scrap, fuel: 100 }, parts: [], settlements: [] });
const validateState = (value) => value.resources.scrap < 0 ? ['스크랩은 음수일 수 없습니다.'] : [];
function setup(storage = createMemoryStorage()) {
  return { storage, repository: createSaveRepository({ storage, validateState, now: () => NOW }) };
}
function journal(storage) { return JSON.parse(storage.getItem(KEY)); }
function corruptCurrent(storage) {
  const value = journal(storage);
  value.current.state.resources.scrap = 9999;
  storage.setItem(KEY, JSON.stringify(value));
  return storage.getItem(KEY);
}

test('UTF-8 FNV-1a is deterministic and is explicitly a nonsecurity checksum', () => {
  assert.equal(checksumFNV1a('hello'), 'fnv1a32:4f9f2cab');
  let expected = 0x811c9dc5;
  for (const byte of new TextEncoder().encode('클라우드스티치 ☁️🚢')) expected = Math.imul(expected ^ byte, 0x01000193) >>> 0;
  assert.equal(checksumFNV1a('클라우드스티치 ☁️🚢'), `fnv1a32:${expected.toString(16).padStart(8, '0')}`);
});

test('empty slot does not automatically create or load a new game', () => {
  const { storage, repository } = setup();
  assert.equal(repository.load().code, 'NOT_FOUND');
  assert.equal(repository.inspect().code, 'EMPTY');
  assert.equal(repository.exportCurrent().raw, null);
  assert.equal(storage.length, 0);
});

test('save envelope, ISO time, revision, boundaries and defensive copies', () => {
  const { storage, repository } = setup();
  const original = state();
  const result = repository.save(original, { expectedRevision: 0, boundary: 'departure' });
  assert.equal(result.ok, true);
  assert.equal(result.revision, 1);
  assert.equal(result.savedAt, NOW);
  assert.equal(journal(storage).format, JOURNAL_FORMAT);
  assert.equal(journal(storage).current.format, SAVE_FORMAT);
  original.resources.scrap = 888;
  result.envelope.state.resources.scrap = 777;
  const loaded = repository.load();
  assert.equal(loaded.state.resources.scrap, 100);
  loaded.state.resources.scrap = 666;
  assert.equal(repository.load().state.resources.scrap, 100);
  assert.equal(repository.save(state(110, 'debrief'), { boundary: 'return' }).ok, true);
});

test('five saves retain exactly three prior successful snapshots', () => {
  const { storage, repository } = setup();
  for (let index = 1; index <= 5; index += 1) assert.equal(repository.save(state(index)).ok, true);
  assert.equal(journal(storage).current.revision, 5);
  assert.deepEqual(journal(storage).backups.map((value) => value.revision), [4, 3, 2]);
  assert.equal(repository.inspect().backupCount, 3);
  assert.equal(repository.inspect().backups.every((value) => value.valid), true);
  assert.equal(storage.length, 1);
});

test('sailing, wrong schema, domain errors, nonfinite and lossy JSON are rejected without writes', () => {
  const { storage, repository } = setup();
  repository.save(state());
  const before = storage.getItem(KEY);
  const wrongVersion = { ...state(), schemaVersion: 2 };
  const cyclic = state(); cyclic.self = cyclic;
  const hidden = state(); Object.defineProperty(hidden, 'hidden', { value: 1 });
  const getter = state(); Object.defineProperty(getter, 'unsafe', { enumerable: true, get() { throw new Error('must not execute'); } });
  for (const candidate of [state(100, 'sailing'), wrongVersion, state(-1), state(NaN), state(Infinity), { ...state(), missing: undefined }, cyclic, hidden, getter, { ...state(), date: new Date() }, { ...state(), sparse: Array(1) }]) {
    assert.equal(repository.save(candidate).code, 'INVALID_STATE');
    assert.equal(storage.getItem(KEY), before);
  }
  assert.equal(repository.save(state(), { boundary: 'combat' }).code, 'INVALID_BOUNDARY');
  assert.equal(repository.save(state(), { expectedRevision: -1 }).code, 'INVALID_REVISION');
});

test('validator mutation cannot change caller state or saved candidate', () => {
  const storage = createMemoryStorage();
  const repository = createSaveRepository({ storage, now: () => NOW, validateState(value) { value.resources.scrap = 42; return []; } });
  const candidate = state(100);
  assert.equal(repository.save(candidate).ok, true);
  assert.equal(candidate.resources.scrap, 100);
  assert.equal(repository.load().state.resources.scrap, 100);
});

test('optimistic revision conflict preserves newer save and session state', () => {
  const { storage, repository } = setup();
  const second = createSaveRepository({ storage, validateState, now: () => NOW });
  repository.save(state(100), { expectedRevision: 0 });
  const session = second.load().state;
  repository.save(state(120), { expectedRevision: 1 });
  const before = storage.getItem(KEY);
  assert.equal(second.save(session, { expectedRevision: 1 }).code, 'REVISION_CONFLICT');
  assert.equal(storage.getItem(KEY), before);
  assert.equal(session.resources.scrap, 100);
});

test('atomic write failure preserves raw journal, backups and caller state', () => {
  const backing = createMemoryStorage();
  let shouldFail = false;
  const storage = { getItem: (...args) => backing.getItem(...args), setItem(...args) { if (shouldFail) throw new Error('quota'); backing.setItem(...args); } };
  const { repository } = setup(storage);
  repository.save(state());
  const before = backing.getItem(KEY);
  const candidate = state(130);
  shouldFail = true;
  const result = repository.save(candidate);
  assert.equal(result.code, 'WRITE_FAILED');
  assert.equal(result.lastGoodRevision, 1);
  assert.equal(result.lastGoodSavedAt, NOW);
  assert.equal(backing.getItem(KEY), before);
  assert.deepEqual(candidate, state(130));
  shouldFail = false;
  assert.equal(repository.save(candidate, { expectedRevision: 1 }).revision, 2);
});

test('read failure never attempts a write and preserves last known good revision', () => {
  const backing = createMemoryStorage();
  let shouldFail = false;
  let writes = 0;
  const storage = { getItem(key) { if (shouldFail) throw new Error('permission'); return backing.getItem(key); }, setItem(...args) { writes += 1; backing.setItem(...args); } };
  const { repository } = setup(storage);
  repository.save(state());
  const before = backing.getItem(KEY);
  shouldFail = true;
  assert.equal(repository.save(state(999)).code, 'READ_FAILED');
  assert.equal(repository.load().lastGoodRevision, 1);
  assert.equal(repository.exportCurrent().code, 'READ_FAILED');
  assert.equal(writes, 1);
  assert.equal(backing.getItem(KEY), before);
});

test('malformed JSON stays untouched and can be exported as raw data', () => {
  const raw = '{broken Korean 원본';
  const { storage, repository } = setup(createMemoryStorage({ [KEY]: raw }));
  assert.equal(repository.load().code, 'CORRUPT_JOURNAL');
  assert.equal(repository.save(state()).code, 'CORRUPT_JOURNAL');
  assert.equal(repository.recoverBackup().code, 'CORRUPT_JOURNAL');
  assert.equal(repository.exportCurrent().raw, raw);
  assert.equal(storage.getItem(KEY), raw);
});

test('unsupported journal, envelope or state versions are never overwritten', () => {
  for (const location of ['journal', 'envelope', 'state']) {
    const { storage, repository } = setup();
    repository.save(state());
    const value = journal(storage);
    if (location === 'journal') value.version = 2;
    else if (location === 'envelope') value.current.version = 2;
    else value.current.state.schemaVersion = 2;
    storage.setItem(KEY, JSON.stringify(value));
    const before = storage.getItem(KEY);
    assert.equal(repository.load().code, 'UNSUPPORTED_VERSION');
    assert.equal(repository.save(state()).code, 'UNSUPPORTED_VERSION');
    assert.equal(repository.recoverBackup().code, 'UNSUPPORTED_VERSION');
    assert.equal(storage.getItem(KEY), before);
  }
});

test('corrupt current offers recovery but never automatically loads or overwrites a backup', () => {
  const { storage, repository } = setup();
  repository.save(state(100)); repository.save(state(110)); repository.save(state(120));
  const before = corruptCurrent(storage);
  const result = repository.load();
  assert.equal(result.code, 'RECOVERY_AVAILABLE');
  assert.equal(result.recoveryAvailable, true);
  assert.deepEqual(result.backups.map((value) => value.revision), [2, 1]);
  assert.equal(repository.save(state(999)).code, 'RECOVERY_AVAILABLE');
  assert.equal(repository.inspect().recoveryAvailable, true);
  assert.equal(storage.getItem(KEY), before);
});

test('explicit recovery preserves corrupt raw separately and restores chosen valid backup', () => {
  const { storage, repository } = setup();
  for (const value of [100, 110, 120, 130]) repository.save(state(value));
  const before = corruptCurrent(storage);
  const result = repository.recoverBackup({ revision: 2, expectedRevision: 4 });
  assert.equal(result.ok, true);
  assert.equal(result.revision, 5);
  assert.equal(result.recoveredFromRevision, 2);
  assert.equal(storage.getItem(result.quarantineKey), before);
  assert.equal(repository.load().state.resources.scrap, 110);
  assert.deepEqual(journal(storage).backups.map((value) => value.revision), [3, 2, 1]);
  assert.equal(repository.inspect().code, 'VALID');
  const relaunched = setup(storage).repository;
  assert.equal(relaunched.load().state.resources.scrap, 110);
});

test('quarantine failure leaves corrupt current and valid backups untouched', () => {
  const backing = createMemoryStorage();
  const { repository: initial } = setup(backing);
  initial.save(state(100)); initial.save(state(110));
  const before = corruptCurrent(backing);
  const storage = { getItem: (...args) => backing.getItem(...args), setItem(key, value) { if (key.includes('.quarantine.')) throw new Error('quota'); backing.setItem(key, value); } };
  const { repository } = setup(storage);
  assert.equal(repository.recoverBackup().code, 'QUARANTINE_FAILED');
  assert.equal(backing.getItem(KEY), before);
});

test('recovery main-write failure leaves both original journal and quarantine intact', () => {
  const backing = createMemoryStorage();
  const { repository: initial } = setup(backing);
  initial.save(state(100)); initial.save(state(110));
  const before = corruptCurrent(backing);
  const storage = { getItem: (...args) => backing.getItem(...args), setItem(key, value) { if (key === KEY) throw new Error('quota'); backing.setItem(key, value); } };
  const { repository } = setup(storage);
  const result = repository.recoverBackup();
  assert.equal(result.code, 'WRITE_FAILED');
  assert.equal(backing.getItem(KEY), before);
  assert.equal(backing.getItem(result.quarantineKey), before);
  assert.equal(repository.load().recoveryAvailable, true);
});

test('invalid backups, invalid sequence, and more than three backups block overwrite', () => {
  for (const damage of ['checksum', 'duplicate', 'too-many']) {
    const { storage, repository } = setup();
    for (const value of [1, 2, 3, 4]) repository.save(state(value));
    const value = journal(storage);
    if (damage === 'checksum') value.backups[0].checksum = 'broken';
    if (damage === 'duplicate') value.backups[1] = value.backups[0];
    if (damage === 'too-many') value.backups.push(value.backups[0]);
    storage.setItem(KEY, JSON.stringify(value));
    const before = storage.getItem(KEY);
    assert.equal(repository.save(state()).code, 'INVALID_JOURNAL');
    assert.equal(storage.getItem(KEY), before);
  }
});

test('invalid current without valid backup and invalid time are not replaced', () => {
  const { storage, repository } = setup();
  repository.save(state());
  const before = corruptCurrent(storage);
  assert.equal(repository.load().code, 'INVALID_CURRENT');
  assert.equal(repository.recoverBackup().code, 'NO_VALID_BACKUP');
  assert.equal(repository.save(state()).code, 'INVALID_CURRENT');
  assert.equal(storage.getItem(KEY), before);
  const empty = createMemoryStorage();
  const badClock = createSaveRepository({ storage: empty, now: () => 'invalid date' });
  assert.equal(badClock.save(state()).code, 'INVALID_TIME');
  assert.equal(empty.length, 0);
});

test('two example voyages survive repository recreation with settlement ledger intact', () => {
  const { storage, repository } = setup();
  let session = state();
  repository.save(session, { boundary: 'departure', expectedRevision: 0 });
  session = { ...session, phase: 'debrief', resources: { scrap: 230, fuel: 85 }, settlements: [{ voyageId: 'v1', settlementId: 's1' }], parts: [{ id: 'recovered-1', ownerId: 'player', location: 'warehouse' }] };
  repository.save(session, { boundary: 'return', expectedRevision: 1 });
  session = { ...session, phase: 'harbor', resources: { scrap: 205, fuel: 85 } };
  repository.save(session, { boundary: 'departure', expectedRevision: 2 });
  session = { ...session, phase: 'debrief', resources: { scrap: 260, fuel: 73 }, settlements: [...session.settlements, { voyageId: 'v2', settlementId: 's2' }] };
  repository.save(session, { boundary: 'return', expectedRevision: 3 });
  session = { ...session, phase: 'harbor', resources: { scrap: 240, fuel: 73 } };
  repository.save(session, { boundary: 'harbor', expectedRevision: 4 });
  const loaded = setup(storage).repository.load();
  assert.deepEqual(loaded.state.resources, { scrap: 240, fuel: 73 });
  assert.deepEqual(loaded.state.settlements, [{ voyageId: 'v1', settlementId: 's1' }, { voyageId: 'v2', settlementId: 's2' }]);
  assert.deepEqual(loaded.state.parts, session.parts);
  assert.equal(loaded.backupCount, 3);
  assert.equal(loaded.revision, 5);
  // This verifies persisted example data, not actual sailing or reward logic.
});

test('excessively nested candidate and saved state fail safely without replacing data', () => {
  const { storage, repository } = setup();
  repository.save(state());
  const before = storage.getItem(KEY);
  const candidate = state();
  let nested = candidate;
  for (let index = 0; index < 100; index += 1) { nested.extra = {}; nested = nested.extra; }
  assert.equal(repository.save(candidate).code, 'INVALID_STATE');
  assert.equal(storage.getItem(KEY), before);
  const damaged = journal(storage);
  damaged.current.state = candidate;
  storage.setItem(KEY, JSON.stringify(damaged));
  assert.equal(repository.load().code, 'INVALID_CURRENT');
});

test('quarantine read verification failure cannot replace the source journal', () => {
  const backing = createMemoryStorage();
  const { repository: initial } = setup(backing);
  initial.save(state(100)); initial.save(state(110));
  const before = corruptCurrent(backing);
  let quarantineWritten = false;
  const storage = {
    getItem(key) { if (quarantineWritten && key.includes('.quarantine.')) throw new Error('read failed'); return backing.getItem(key); },
    setItem(key, value) { backing.setItem(key, value); if (key.includes('.quarantine.')) quarantineWritten = true; },
  };
  assert.equal(setup(storage).repository.recoverBackup().code, 'QUARANTINE_FAILED');
  assert.equal(backing.getItem(KEY), before);
});

test('recovery detects source change after quarantine before replacing main key', () => {
  const backing = createMemoryStorage();
  const { repository: initial } = setup(backing);
  initial.save(state(100)); initial.save(state(110));
  const before = corruptCurrent(backing);
  const replacement = 'another writer changed this';
  const storage = {
    getItem: (...args) => backing.getItem(...args),
    setItem(key, value) { backing.setItem(key, value); if (key.includes('.quarantine.')) backing.setItem(KEY, replacement); },
  };
  const result = setup(storage).repository.recoverBackup();
  assert.equal(result.code, 'REVISION_CONFLICT');
  assert.equal(backing.getItem(KEY), replacement);
  assert.equal(backing.getItem(result.quarantineKey), before);
});

test('recovery rejects stale revision and de-duplicates valid backups in a damaged journal', () => {
  const { storage, repository } = setup();
  for (const value of [100, 110, 120, 130]) repository.save(state(value));
  const value = journal(storage);
  value.current.checksum = 'broken';
  value.backups[2] = value.backups[1];
  storage.setItem(KEY, JSON.stringify(value));
  const before = storage.getItem(KEY);
  assert.equal(repository.recoverBackup({ expectedRevision: 3 }).code, 'REVISION_CONFLICT');
  assert.equal(storage.getItem(KEY), before);
  assert.equal(repository.recoverBackup({ expectedRevision: 4 }).ok, true);
  assert.deepEqual(journal(storage).backups.map((entry) => entry.revision), [3, 2]);
  assert.equal(repository.inspect().code, 'VALID');
});

test('repeated recovery at same clock time preserves earlier quarantine records', () => {
  const { storage, repository } = setup();
  repository.save(state(100)); repository.save(state(110));
  const firstRaw = corruptCurrent(storage);
  const first = repository.recoverBackup();
  repository.save(state(120));
  const secondRaw = corruptCurrent(storage);
  const second = repository.recoverBackup();
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.quarantineKey, second.quarantineKey);
  assert.equal(storage.getItem(first.quarantineKey), firstRaw);
  assert.equal(storage.getItem(second.quarantineKey), secondRaw);
});

test('missing current fields are corruption with explicit backup recovery, not a future version', () => {
  for (const missing of ['current', 'state', 'version']) {
    const { storage, repository } = setup();
    repository.save(state(100)); repository.save(state(110));
    const value = journal(storage);
    if (missing === 'current') delete value.current;
    else delete value.current[missing];
    storage.setItem(KEY, JSON.stringify(value));
    assert.equal(repository.load().code, 'RECOVERY_AVAILABLE');
    assert.equal(repository.recoverBackup().ok, true);
    assert.equal(repository.load().state.resources.scrap, 100);
  }
});

test('unknown envelope fields and future-version backups are preserved without overwrite', () => {
  for (const damage of ['unknown', 'future']) {
    const { storage, repository } = setup();
    repository.save(state(100)); repository.save(state(110));
    const value = journal(storage);
    if (damage === 'unknown') value.current.extra = { deeply: 'unexpected' };
    else value.backups[0].version = 2;
    storage.setItem(KEY, JSON.stringify(value));
    const before = storage.getItem(KEY);
    assert.equal(repository.save(state()).ok, false);
    assert.equal(storage.getItem(KEY), before);
    if (damage === 'future') assert.equal(repository.recoverBackup().code, 'UNSUPPORTED_VERSION');
  }
});
