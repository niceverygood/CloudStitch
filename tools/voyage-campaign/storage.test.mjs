import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createMemoryStorage, createSaveRepository} from '../save/save.mjs';
import {prepareDeparture, commitDeparture, acceptReturn} from '../harbor/core.mjs';
import {stageMaps} from '../stage-maps/maps.mjs';
import {createCampaignState, validateCampaignState, currentMap, routeBinding, completeCampaignStage,
  advanceCampaignStage, CAMPAIGN_SAVE_KEY} from './campaign.mjs';
import {CampaignSaveError, createCampaignStorageGuard, prepareCampaignStorage} from './storage.mjs';

const must = result => {assert.equal(result.ok, true, JSON.stringify(result)); return result.state;};
function finish(state) {
  const sailing = must(commitDeparture(must(prepareDeparture(state))));
  const arrival = must(acceptReturn(sailing, {version: 1, voyageId: sailing.activeVoyage.id, settlementId: `${sailing.activeVoyage.id}:return`,
    outcome: 'completed', evidence: 'battlefield-adapter', gained: {S: 0, F: 0, C: 0}, spent: {S: 0, F: 0, C: 0}, contractReward: {S: 0, F: 0, C: 0}, recovered: [], damage: []}));
  return must(completeCampaignStage(arrival, {stageId: currentMap(arrival).stageId, voyageId: sailing.activeVoyage.id,
    phase: 'victory', midBossDefeats: 1, finalBossDefeats: 1}));
}
function rejectsCode(operation, code) {assert.throws(operation, error => error instanceof CampaignSaveError && error.code === code);}

test('absent slot seeds once without touching legacy or frozen integration slots', () => {
  const storage = createMemoryStorage({'cloudstitch.integration.v1': 'original', [`cloudstitch.stage-maps.v1.${stageMaps[0].id}`]: 'legacy'});
  const first = prepareCampaignStorage({storage}), raw = storage.getItem(CAMPAIGN_SAVE_KEY);
  assert.equal(first.seeded, true); assert.equal(first.loaded.revision, 1);
  assert.equal(prepareCampaignStorage({storage}).seeded, false);
  assert.equal(storage.getItem(CAMPAIGN_SAVE_KEY), raw);
  assert.equal(storage.getItem('cloudstitch.integration.v1'), 'original');
  assert.equal(storage.getItem(`cloudstitch.stage-maps.v1.${stageMaps[0].id}`), 'legacy');
});

test('backups from earlier valid campaign stages are accepted under one shared key', () => {
  const storage = createMemoryStorage(), prepared = prepareCampaignStorage({storage});
  let state = finish(prepared.loaded.state);
  assert.equal(prepared.repository.save(state, {expectedRevision: 1, boundary: 'return'}).ok, true);
  state = must(advanceCampaignStage(state));
  assert.equal(prepared.repository.save(state, {expectedRevision: 2, boundary: state.boundary}).ok, true);
  state = finish(state);
  assert.equal(prepared.repository.save(state, {expectedRevision: 3, boundary: 'return'}).ok, true);
  const reloaded = prepareCampaignStorage({storage});
  assert.equal(reloaded.loaded.state.campaign.currentStageIndex, 1);
  assert.equal(reloaded.loaded.state.campaign.completedStages.length, 2);
  assert.equal(reloaded.loaded.backupCount, 3);
  const backups = JSON.parse(storage.getItem(CAMPAIGN_SAVE_KEY)).backups;
  assert.deepEqual(backups.map(entry => entry.state.campaign.currentStageIndex), [1, 0, 0]);
});

test('changed route, completion proof, manifest and foreign backup never reset the slot', () => {
  for (const mutate of [
    journal => {journal.current.state.route.layoutHash = 'old';},
    journal => {journal.current.state.campaign.manifestHash = 'old';},
    journal => {delete journal.current.state.campaign;},
    journal => {journal.backups[0].state.route = routeBinding(stageMaps[3]);},
  ]) {
    const storage = createMemoryStorage(), prepared = prepareCampaignStorage({storage});
    assert.equal(prepared.repository.save(prepared.loaded.state, {expectedRevision: 1}).ok, true);
    const journal = JSON.parse(storage.getItem(CAMPAIGN_SAVE_KEY)); mutate(journal);
    const raw = JSON.stringify(journal); storage.setItem(CAMPAIGN_SAVE_KEY, raw);
    rejectsCode(() => prepareCampaignStorage({storage}), 'CAMPAIGN_SAVE_BINDING');
    assert.equal(storage.getItem(CAMPAIGN_SAVE_KEY), raw);
  }
});

test('corrupt JSON, checksums and unsupported journal versions are preserved', () => {
  const corrupt = createMemoryStorage({[CAMPAIGN_SAVE_KEY]: '{bad'});
  rejectsCode(() => prepareCampaignStorage({storage: corrupt}), 'CAMPAIGN_SAVE_CORRUPT');
  assert.equal(corrupt.getItem(CAMPAIGN_SAVE_KEY), '{bad');
  for (const mutate of [journal => {journal.current.checksum = 'wrong';}, journal => {journal.version++;}]) {
    const storage = createMemoryStorage(); prepareCampaignStorage({storage});
    const journal = JSON.parse(storage.getItem(CAMPAIGN_SAVE_KEY)); mutate(journal);
    const raw = JSON.stringify(journal); storage.setItem(CAMPAIGN_SAVE_KEY, raw);
    rejectsCode(() => prepareCampaignStorage({storage}), 'CAMPAIGN_SAVE_INVALID');
    assert.equal(storage.getItem(CAMPAIGN_SAVE_KEY), raw);
  }
});

test('completion proof corruption in a prior-stage backup prevents loading', () => {
  const storage = createMemoryStorage(), prepared = prepareCampaignStorage({storage});
  const completed = finish(prepared.loaded.state);
  assert.equal(prepared.repository.save(completed, {expectedRevision: 1, boundary: 'return'}).ok, true);
  assert.equal(prepared.repository.save(must(advanceCampaignStage(completed)), {expectedRevision: 2, boundary: 'return'}).ok, true);
  const journal = JSON.parse(storage.getItem(CAMPAIGN_SAVE_KEY));
  journal.backups[0].state.campaign.completedStages[0].proof.finalBossDefeats = 0;
  const raw = JSON.stringify(journal); storage.setItem(CAMPAIGN_SAVE_KEY, raw);
  rejectsCode(() => prepareCampaignStorage({storage}), 'CAMPAIGN_SAVE_BINDING');
  assert.equal(storage.getItem(CAMPAIGN_SAVE_KEY), raw);
});

test('guard rejects wrong keys and invalid conflict sidecars without overwrite', () => {
  const storage = createMemoryStorage(), prepared = prepareCampaignStorage({storage}), guard = prepared.storage;
  rejectsCode(() => guard.setItem('cloudstitch.integration.v1', 'anything'), 'CAMPAIGN_SAVE_KEY');
  const conflictKey = `${CAMPAIGN_SAVE_KEY}.conflict`, state = must(commitDeparture(must(prepareDeparture(prepared.loaded.state))));
  const raw = JSON.stringify({schemaVersion: 1, state, saveRevision: 1, reason: 'REVISION_CONFLICT'});
  guard.setItem(conflictKey, raw);
  assert.equal(guard.getItem(conflictKey), raw);
  state.route.layoutHash = 'old';
  rejectsCode(() => guard.setItem(conflictKey, JSON.stringify({schemaVersion: 1, state, saveRevision: 1, reason: 'REVISION_CONFLICT'})), 'CAMPAIGN_CONFLICT_BINDING');
  assert.equal(storage.getItem(conflictKey), raw);
  storage.setItem(conflictKey, '{bad');
  rejectsCode(() => prepareCampaignStorage({storage}), 'CAMPAIGN_SAVE_CORRUPT');
});

test('failed next-stage save leaves the live state and persisted route at prior stage', () => {
  const memory = createMemoryStorage(); let fail = false;
  const storage = {getItem: key => memory.getItem(key), setItem: (key, raw) => {if (fail) throw new Error('quota'); memory.setItem(key, raw);}};
  const prepared = prepareCampaignStorage({storage});
  const live = finish(prepared.loaded.state);
  assert.equal(prepared.repository.save(live, {expectedRevision: 1, boundary: 'return'}).ok, true);
  const raw = memory.getItem(CAMPAIGN_SAVE_KEY), before = structuredClone(live), candidate = must(advanceCampaignStage(live));
  fail = true;
  const saved = prepared.repository.save(candidate, {expectedRevision: 2, boundary: candidate.boundary});
  assert.equal(saved.ok, false); assert.equal(saved.code, 'WRITE_FAILED');
  assert.deepEqual(live, before); assert.equal(live.campaign.currentStageIndex, 0);
  assert.equal(memory.getItem(CAMPAIGN_SAVE_KEY), raw);
  fail = false;
  assert.equal(prepared.repository.save(candidate, {expectedRevision: 2, boundary: candidate.boundary}).ok, true);
  assert.equal(prepareCampaignStorage({storage}).loaded.state.campaign.currentStageIndex, 1);
});

test('departure checkpoint restores same voyage and saved stage in a fresh Node process', () => {
  const storage = createMemoryStorage(), prepared = prepareCampaignStorage({storage});
  let state = must(advanceCampaignStage(finish(prepared.loaded.state)));
  const departure = must(prepareDeparture(state));
  assert.equal(prepared.repository.save(departure, {expectedRevision: 1, boundary: 'departure'}).ok, true);
  const url = new URL('./storage.mjs', import.meta.url).href;
  const script = `import {prepareCampaignStorage} from ${JSON.stringify(url)}; let data='';for await(const chunk of process.stdin)data+=chunk;const raw=JSON.parse(data);const storage={getItem:key=>raw[key]??null,setItem(){throw Error('unexpected write')}};const result=prepareCampaignStorage({storage});console.log(JSON.stringify(result.loaded));`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {input: JSON.stringify(storage.dump()), encoding: 'utf8'});
  assert.equal(child.status, 0, child.stderr);
  const loaded = JSON.parse(child.stdout);
  assert.equal(loaded.state.activeVoyage.id, departure.activeVoyage.id);
  assert.equal(loaded.state.campaign.currentStageIndex, 1);
  assert.equal(loaded.state.phase, 'harbor'); assert.equal(loaded.boundary, 'departure');
  assert.deepEqual(loaded.state, departure);
});

test('initial write failure, blocked read and runtime deletion never create a fallback success', () => {
  const storage = createMemoryStorage();
  rejectsCode(() => prepareCampaignStorage({storage: {getItem: storage.getItem, setItem() {throw Error('quota');}}}), 'CAMPAIGN_SAVE_INITIALIZE_FAILED');
  assert.equal(storage.length, 0);
  rejectsCode(() => prepareCampaignStorage({storage: {getItem() {throw Error('blocked');}, setItem() {throw Error('unexpected');}}}), 'CAMPAIGN_SAVE_READ_FAILED');
  const prepared = prepareCampaignStorage({storage}); storage.removeItem(CAMPAIGN_SAVE_KEY);
  rejectsCode(() => prepared.storage.getItem(CAMPAIGN_SAVE_KEY), 'CAMPAIGN_SAVE_MISSING');
});
