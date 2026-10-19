import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryStorage, createSaveRepository} from '../save/save.mjs';
import {createExampleState} from '../harbor/fixtures.mjs';
import {prepareDeparture, commitDeparture} from '../harbor/core.mjs';
import {stageMaps} from './maps.mjs';
import {routeBinding, validateRouteState} from './selection.mjs';
import {RouteSaveError, stageMapSaveKey, createRouteStorageGuard, prepareStageMapStorage} from './session-bridge.mjs';

const first = stageMaps[0], second = stageMaps[1];
const stateFor = map => ({...createExampleState(), route: routeBinding(map)});
function seed(storage, map = first, count = 1) {
  const key = stageMapSaveKey(map);
  const repository = createSaveRepository({storage, key, validateState: state => validateRouteState(state, map)});
  for (let revision = 0; revision < count; revision++) {
    const state = stateFor(map);
    state.resources.S += revision;
    assert.equal(repository.save(state, {expectedRevision: revision}).ok, true);
  }
  return {key, repository};
}
function rejectsCode(operation, code) {
  assert.throws(operation, error => error instanceof RouteSaveError && error.code === code);
}

test('all six slots seed exact route metadata and remain independent', () => {
  const storage = createMemoryStorage();
  const keys = stageMaps.map(map => {
    const prepared = prepareStageMapStorage({storage, map});
    assert.equal(prepared.seeded, true);
    assert.deepEqual(prepared.loaded.state.route, routeBinding(map));
    assert.equal(prepared.loaded.revision, 1);
    assert.equal(prepared.loaded.boundary, 'harbor');
    assert.equal(prepared.loaded.state.activeVoyage, null);
    assert.equal(prepareStageMapStorage({storage, map}).seeded, false);
    return prepared.key;
  });
  assert.equal(new Set(keys).size, 6);
  assert.equal(storage.length, 6);
  assert.equal(storage.getItem('cloudstitch.integration.v1'), null);
});

test('foreign current checkpoint is refused and never replaced', () => {
  const storage = createMemoryStorage();
  const {key: foreignKey} = seed(storage, second);
  const key = stageMapSaveKey(first), raw = storage.getItem(foreignKey);
  storage.setItem(key, raw);
  rejectsCode(() => prepareStageMapStorage({storage, map: first}), 'ROUTE_SAVE_BINDING');
  assert.equal(storage.getItem(key), raw);
});

test('foreign backup is refused even with a valid selected current', () => {
  const storage = createMemoryStorage();
  const {key} = seed(storage, first, 2);
  const {key: foreignKey} = seed(storage, second);
  const journal = JSON.parse(storage.getItem(key));
  journal.backups[0] = JSON.parse(storage.getItem(foreignKey)).current;
  const raw = JSON.stringify(journal);
  storage.setItem(key, raw);
  rejectsCode(() => prepareStageMapStorage({storage, map: first}), 'ROUTE_SAVE_BINDING');
  assert.equal(storage.getItem(key), raw);
});

test('missing, extra, versioned, stage, and changed-layout bindings are refused', () => {
  for (const mutate of [
    state => { delete state.route; },
    state => { state.route.extra = true; },
    state => { state.route.routeVersion += 1; },
    state => { state.route.stageId = second.stageId; },
    state => { state.route.levelId = second.seaLevel.id; },
    state => { state.route.layoutHash = 'fnv1a32:00000000'; },
  ]) {
    const storage = createMemoryStorage();
    const {key} = seed(storage);
    const journal = JSON.parse(storage.getItem(key));
    mutate(journal.current.state);
    const raw = JSON.stringify(journal);
    storage.setItem(key, raw);
    rejectsCode(() => prepareStageMapStorage({storage, map: first}), 'ROUTE_SAVE_BINDING');
    assert.equal(storage.getItem(key), raw);
  }
});

test('current and backup integrity failures remain preserved', () => {
  for (const mutate of [
    journal => { journal.current.checksum = 'fnv1a32:00000000'; },
    journal => { journal.backups[0].checksum = 'fnv1a32:00000000'; },
    journal => { journal.backups[0].revision = journal.current.revision; },
    journal => { journal.version += 1; },
  ]) {
    const storage = createMemoryStorage();
    const {key} = seed(storage, first, 2);
    const journal = JSON.parse(storage.getItem(key));
    mutate(journal);
    const raw = JSON.stringify(journal);
    storage.setItem(key, raw);
    rejectsCode(() => prepareStageMapStorage({storage, map: first}), 'ROUTE_SAVE_INVALID');
    assert.equal(storage.getItem(key), raw);
  }
});

test('malformed JSON is preserved instead of seeded again', () => {
  const key = stageMapSaveKey(first), storage = createMemoryStorage({[key]: '{incomplete'});
  rejectsCode(() => prepareStageMapStorage({storage, map: first}), 'ROUTE_SAVE_CORRUPT');
  assert.equal(storage.getItem(key), '{incomplete');
});

test('guard rejects cross-slot writes and mismatched checkpoint writes atomically', () => {
  const storage = createMemoryStorage();
  const {key} = seed(storage, first);
  const {key: foreignKey} = seed(storage, second);
  const ownRaw = storage.getItem(key), foreignRaw = storage.getItem(foreignKey);
  const guard = createRouteStorageGuard({storage, map: first});
  rejectsCode(() => guard.setItem(foreignKey, foreignRaw), 'ROUTE_SAVE_KEY');
  rejectsCode(() => guard.setItem(key, foreignRaw), 'ROUTE_SAVE_BINDING');
  assert.equal(storage.getItem(key), ownRaw);
  assert.equal(storage.getItem(foreignKey), foreignRaw);
});

test('root conflict sidecar accepts selected state and rejects foreign state', () => {
  const storage = createMemoryStorage();
  seed(storage);
  const guard = createRouteStorageGuard({storage, map: first}), key = `${guard.key}.conflict`;
  const state = commitDeparture(prepareDeparture(stateFor(first)).state).state;
  const raw = JSON.stringify({schemaVersion: 1, state, saveRevision: 1, reason: 'REVISION_CONFLICT'});
  guard.setItem(key, raw);
  assert.equal(guard.getItem(key), raw);
  state.route = routeBinding(second);
  rejectsCode(() => guard.setItem(key, JSON.stringify({schemaVersion: 1, state, saveRevision: 1, reason: 'REVISION_CONFLICT'})), 'ROUTE_CONFLICT_BINDING');
  assert.equal(storage.getItem(key), raw);
});

test('existing foreign conflict sidecar prevents startup without changing either value', () => {
  const storage = createMemoryStorage();
  const {key} = seed(storage), conflictKey = `${key}.conflict`;
  const currentRaw = storage.getItem(key);
  const raw = JSON.stringify({schemaVersion: 1, state: stateFor(second), saveRevision: 1, reason: 'REVISION_CONFLICT'});
  storage.setItem(conflictKey, raw);
  rejectsCode(() => prepareStageMapStorage({storage, map: first}), 'ROUTE_CONFLICT_BINDING');
  assert.equal(storage.getItem(key), currentRaw);
  assert.equal(storage.getItem(conflictKey), raw);
});

test('checkpoint remains bound through real core departure and fresh repository load', () => {
  const storage = createMemoryStorage();
  const prepared = prepareStageMapStorage({storage, map: first});
  const departure = prepareDeparture(prepared.loaded.state);
  assert.equal(departure.ok, true);
  const saved = prepared.repository.save(departure.state, {expectedRevision: 1, boundary: 'departure'});
  assert.equal(saved.ok, true);
  const sailing = commitDeparture(departure.state);
  assert.deepEqual(sailing.state.route, routeBinding(first));
  const resumed = prepareStageMapStorage({storage, map: first});
  assert.equal(resumed.loaded.boundary, 'departure');
  assert.equal(resumed.loaded.state.phase, 'harbor');
  assert.equal(resumed.loaded.state.activeVoyage.id, sailing.state.activeVoyage.id);
  assert.deepEqual(resumed.loaded.state.route, routeBinding(first));
  assert.equal(resumed.loaded.revision, 2);
});

test('initial write failure does not start or create an in-memory successful slot', () => {
  const storage = createMemoryStorage();
  const failing = {getItem: storage.getItem, setItem: () => { throw new Error('quota'); }};
  rejectsCode(() => prepareStageMapStorage({storage: failing, map: first}), 'ROUTE_SAVE_INITIALIZE_FAILED');
  assert.equal(storage.length, 0);
});

test('active guard refuses a deleted or later-corrupted slot', () => {
  const storage = createMemoryStorage();
  const prepared = prepareStageMapStorage({storage, map: first});
  storage.removeItem(prepared.key);
  rejectsCode(() => prepared.storage.getItem(prepared.key), 'ROUTE_SAVE_MISSING');
  storage.setItem(prepared.key, '{bad');
  rejectsCode(() => prepared.storage.getItem(prepared.key), 'ROUTE_SAVE_CORRUPT');
});

test('storage read failure remains actionable and no write occurs', () => {
  let writes = 0;
  const storage = {getItem: () => { throw new Error('blocked'); }, setItem: () => { writes++; }};
  rejectsCode(() => prepareStageMapStorage({storage, map: first}), 'ROUTE_SAVE_READ_FAILED');
  assert.equal(writes, 0);
});
