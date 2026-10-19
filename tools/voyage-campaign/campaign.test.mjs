import test from 'node:test';
import assert from 'node:assert/strict';
import {stageMaps} from '../stage-maps/maps.mjs';
import {createExampleState, exampleReturn} from '../harbor/fixtures.mjs';
import {prepareDeparture, commitDeparture, acceptReturn, storeCargo} from '../harbor/core.mjs';
import {installPart, quoteRepair, confirmRepair} from '../shipyard/shipyard.mjs';
import {createCampaignState, validateCampaignState, currentMap, routeBinding, completeCampaignStage,
  advanceCampaignStage, validateLegacyState, migrateLegacyState, CAMPAIGN_ID, CAMPAIGN_MANIFEST_HASH} from './campaign.mjs';

const must = result => {assert.equal(result.ok, true, JSON.stringify(result)); return result.state;};
// Synthetic core receipts test pure progression rules; these are not gameplay evidence.
function returned(state, {outcome = 'completed', evidence = 'battlefield-adapter', loot = false} = {}) {
  const sailing = must(commitDeparture(must(prepareDeparture(state))));
  const payload = loot ? exampleReturn(sailing, outcome) : {version: 1, voyageId: sailing.activeVoyage.id,
    settlementId: `${sailing.activeVoyage.id}:return`, outcome, evidence,
    gained: {S: 0, F: 0, C: 0}, spent: {S: 0, F: 0, C: 0}, contractReward: {S: 0, F: 0, C: 0}, recovered: [], damage: []};
  payload.evidence = evidence;
  return must(acceptReturn(sailing, payload));
}
function witness(state) {return {stageId: currentMap(state).stageId, voyageId: state.settlements.at(-1)?.voyageId,
  phase: 'victory', midBossDefeats: 1, finalBossDefeats: 1};}
const finished = state => {const arrival = returned(state); return must(completeCampaignStage(arrival, witness(arrival)));};

test('new campaign starts at map one with exact metadata and no completion', () => {
  const state = createCampaignState();
  assert.deepEqual(validateCampaignState(state), []);
  assert.equal(state.campaign.campaignId, CAMPAIGN_ID);
  assert.equal(state.campaign.manifestHash, CAMPAIGN_MANIFEST_HASH);
  assert.equal(currentMap(state), stageMaps[0]);
  assert.deepEqual(state.route, routeBinding(stageMaps[0]));
  assert.equal(advanceCampaignStage(state).code, 'STAGE_INCOMPLETE');
});

test('six stage sequence retains one ship, inventory, resources and global voyage IDs', () => {
  let state = createCampaignState();
  const ship = structuredClone(state.ship), resources = structuredClone(state.resources), parts = structuredClone(state.parts);
  for (let index = 0; index < 6; index++) {
    assert.equal(currentMap(state).stageId, stageMaps[index].stageId);
    const arrival = returned(state), before = structuredClone(arrival);
    state = must(completeCampaignStage(arrival, witness(arrival)));
    assert.deepEqual(arrival, before);
    assert.equal(state.campaign.completedStages.length, index + 1);
    assert.equal(state.voyageSequence, index + 1);
    assert.equal(state.settlements.length, index + 1);
    assert.deepEqual(state.ship, ship); assert.deepEqual(state.parts, parts); assert.deepEqual(state.resources, resources);
    assert.deepEqual(validateCampaignState(state), []);
    if (index < 5) state = must(advanceCampaignStage(state));
  }
  const final = structuredClone(state);
  assert.equal(advanceCampaignStage(state).code, 'CAMPAIGN_COMPLETE');
  assert.deepEqual(state, final);
  assert.equal(new Set(state.campaign.completedStages.map(item => item.voyageId)).size, 6);
});

test('advance changes only campaign cursor, route and domain revision', () => {
  const state = finished(createCampaignState()), before = structuredClone(state);
  const next = must(advanceCampaignStage(state));
  assert.deepEqual(state, before);
  const expected = structuredClone(before);
  expected.campaign.currentStageIndex = 1; expected.route = routeBinding(stageMaps[1]); expected.revision++;
  assert.deepEqual(next, expected);
  assert.equal(advanceCampaignStage(next).code, 'STAGE_INCOMPLETE');
});

test('real harbor equipment, warehouse and repair spending carry into the next stage', () => {
  const arrival = returned(createCampaignState(), {loot: true});
  let state = must(completeCampaignStage(arrival, witness(arrival)));
  state = must(storeCargo(state));
  const engine = state.parts.find(part => part.kind === 'engine' && part.location === 'warehouse');
  state = must(installPart(state, engine.id, 'E2'));
  const quote = quoteRepair(state), scrap = state.resources.S;
  state = must(confirmRepair(state, quote));
  assert.equal(state.resources.S, scrap - quote.cost.S);
  const next = must(advanceCampaignStage(state));
  assert.deepEqual(next.ship, state.ship); assert.deepEqual(next.parts, state.parts); assert.deepEqual(next.resources, state.resources);
  assert.equal(next.parts.find(part => part.id === engine.id).socketId, 'E2');
  assert.ok(next.parts.some(part => part.location === 'warehouse'));
  assert.deepEqual(validateCampaignState(next), []);
});

test('completion rejects early return, missing boss proof, different stage and different voyage', () => {
  const arrival = returned(createCampaignState());
  for (const change of [{phase: 'maintenance'}, {phase: 'midboss'}, {midBossDefeats: 0}, {finalBossDefeats: 0},
    {finalBossDefeats: 2}, {stageId: stageMaps[1].stageId}, {voyageId: 'different'}]) {
    const before = structuredClone(arrival);
    assert.equal(completeCampaignStage(arrival, {...witness(arrival), ...change}).ok, false);
    assert.deepEqual(arrival, before);
  }
  for (const options of [{outcome: 'withdrawn'}, {evidence: 'independent-example'}]) {
    const incomplete = returned(createCampaignState(), options);
    assert.equal(completeCampaignStage(incomplete, witness(incomplete)).code, 'STAGE_RECEIPT_REQUIRED');
  }
});

test('completion is idempotent for the identical settled voyage', () => {
  const arrival = returned(createCampaignState()), proof = witness(arrival);
  const completed = must(completeCampaignStage(arrival, proof));
  const repeated = completeCampaignStage(completed, proof);
  assert.equal(repeated.ok, true); assert.equal(repeated.duplicate, true); assert.equal(repeated.state, completed);
  assert.equal(completed.campaign.completedStages.length, 1);
  assert.equal(completed.settlements.length, 1);
});

test('schema rejects skipped, duplicated, foreign and unbacked completion records', () => {
  const first = finished(createCampaignState());
  const second = finished(must(advanceCampaignStage(first)));
  for (const mutate of [
    state => {state.campaign.currentStageIndex = 4;},
    state => {state.campaign.completedStages.reverse();},
    state => {state.campaign.completedStages[1] = structuredClone(state.campaign.completedStages[0]);},
    state => {state.campaign.completedStages[0].proof.finalBossDefeats = 0;},
    state => {state.settlements[0].evidence = 'independent-example';},
    state => {state.campaign.completedStages[0].settlementId = 'unknown';},
    state => {state.route.layoutHash = 'old';},
    state => {state.campaign.manifestHash = 'old';},
    state => {state.campaign.extra = 1;},
    state => {state.campaign.completedStages[0] = null;},
    state => {state.settlements = {};},
  ]) {
    const changed = structuredClone(second); mutate(changed);
    assert.ok(validateCampaignState(changed).length);
  }
});

test('active departure cannot advance or complete a stage', () => {
  const departure = must(prepareDeparture(createCampaignState()));
  assert.equal(advanceCampaignStage(departure).code, 'SAFE_HARBOR_REQUIRED');
  assert.equal(completeCampaignStage(departure, {...witness(departure), voyageId: departure.activeVoyage.id}).code, 'SAFE_RETURN_REQUIRED');
});

test('legacy migration preserves equipment, cargo, warehouse, resources and ledger without granting progression', () => {
  let legacy = createExampleState(); legacy.route = routeBinding(stageMaps[4]);
  legacy = must(storeCargo(returned(legacy, {loot: true})));
  const before = structuredClone(legacy), next = must(migrateLegacyState(legacy, stageMaps[4].id));
  for (const key of ['ship', 'parts', 'resources', 'settlements', 'repairReceipts', 'voyageSequence', 'profileId', 'ownerId']) assert.deepEqual(next[key], legacy[key]);
  assert.deepEqual(legacy, before);
  assert.equal(next.campaign.currentStageIndex, 0); assert.equal(next.campaign.completedStages.length, 0);
  assert.deepEqual(next.route, routeBinding(stageMaps[0]));
  assert.equal(next.campaignImport.mapId, stageMaps[4].id);
  assert.equal(next.campaignImport.sourceRevision, legacy.revision);
  assert.deepEqual(validateCampaignState(next), []);
});

test('legacy migration rejects wrong layout, unknown route, active voyage and campaign reimport', () => {
  const legacy = createExampleState(); legacy.route = routeBinding(stageMaps[0]);
  assert.deepEqual(validateLegacyState(legacy, stageMaps[0]), []);
  assert.equal(migrateLegacyState(legacy, 'missing').code, 'LEGACY_MAP_UNKNOWN');
  const old = structuredClone(legacy); old.route.layoutHash = 'old';
  assert.equal(migrateLegacyState(old, stageMaps[0]).code, 'LEGACY_STATE_INVALID');
  assert.equal(migrateLegacyState(must(prepareDeparture(legacy)), stageMaps[0]).code, 'LEGACY_UNSAFE');
  assert.equal(migrateLegacyState(createCampaignState(), stageMaps[0]).code, 'LEGACY_STATE_INVALID');
});

test('invalid campaign shapes yield issues rather than throwing', () => {
  for (const state of [null, [], {}, {campaign: null}, {...createCampaignState(), campaign: {}}]) assert.ok(validateCampaignState(state).length);
});
