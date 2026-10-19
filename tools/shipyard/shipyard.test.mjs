import test from 'node:test';
import assert from 'node:assert/strict';
import { validateParts, computeBudget, previewInstall, installPart, removePart, quoteRepair, confirmRepair, departureReasons } from './shipyard.mjs';

function fixture() {
  const make = (id, kind, extra = {}) => ({ id, kind, name: id, hp: 100, maxHp: 100, weight: 1, lift: 0, powerSupply: 0, powerDemand: 0,
    ownerId: 'player', source: { originId: `origin-${id}`, assetId: `catalog-${kind}`, acquiredVoyageId: null },
    location: 'installed', parentId: 'hull', socketId: `s-${id}`, ...extra });
  const parts = [make('hull', 'hull', { weight: 20, parentId: null, socketId: null }),
    make('balloon', 'balloon', { weight: 4, lift: 60 }), make('engine', 'engine', { weight: 5, powerSupply: 14, powerDemand: 2 }),
    make('hook', 'hook', { weight: 3, powerDemand: 3 }), make('gun', 'machinegun', { weight: 3, powerDemand: 5 }),
    make('spare', 'armor', { weight: 10, location: 'warehouse', parentId: null, socketId: null })];
  return { schemaVersion: 1, ownerId: 'player', phase: 'harbor', revision: 0, resources: { S: 100, F: 20, C: 2 },
    ship: { id: 'ship-1', rootId: 'hull', passengerWeight: 5, sockets: [
      ...parts.filter(part => part.parentId).map(part => ({ id: part.socketId, parentId: 'hull', kinds: [part.kind], enabled: true })),
      { id: 'extra', parentId: 'hull', kinds: ['armor', 'engine', 'balloon'], enabled: true } ] }, parts,
    custom: { preserve: ['unrelated state'] } };
}
const has = (values, prefix) => values.some(value => value.startsWith(`${prefix}:`));

test('valid starter: cargo weight and warehouse exclusion; unrelated state preserved', () => {
  const state = fixture();
  assert.deepEqual(validateParts(state), []);
  assert.deepEqual(departureReasons(state), []);
  assert.equal(computeBudget(state).weight, 40);
  assert.equal(computeBudget(state).lift, 60);
  const snapshot = structuredClone(state);
  const result = installPart(state, 'spare', 'extra');
  assert.equal(result.ok, true);
  assert.equal(result.before.weight, 40);
  assert.equal(result.after.weight, 50);
  assert.equal(result.state.revision, 1);
  assert.deepEqual(result.state.custom, state.custom);
  assert.deepEqual(state, snapshot);
  assert.notEqual(result.state.parts, state.parts);
});

test('duplicate identity, foreign ownership, invalid numbers and cycles are rejected; origin grouping may repeat', () => {
  const duplicate = fixture(); duplicate.parts.push(structuredClone(duplicate.parts[1]));
  assert.equal(has(validateParts(duplicate), 'part-id-duplicate'), true);
  const grouped = fixture(); grouped.parts.forEach(part => { part.source.originId = 'starter-support'; });
  assert.deepEqual(validateParts(grouped), []);
  const foreign = fixture(); foreign.parts[5].ownerId = 'enemy';
  assert.equal(has(previewInstall(foreign, 'spare', 'extra').reasons, 'part-not-owned'), true);
  for (const bad of [NaN, Infinity, -1]) {
    const state = fixture(); state.parts[1].hp = bad;
    assert.equal(has(validateParts(state), 'hp-invalid'), true);
  }
  const hp = fixture(); hp.parts[1].hp = 101;
  assert.equal(has(validateParts(hp), 'hp-invalid'), true);
  const cycle = fixture(); cycle.parts[1].parentId = 'engine'; cycle.parts[2].parentId = 'balloon';
  assert.equal(has(validateParts(cycle), 'part-cycle'), true);
});

test('occupied, incompatible, disabled and noninstalled parent sockets give reasons', () => {
  const state = fixture(); state.ship.sockets[0].kinds.push('armor');
  assert.equal(has(previewInstall(state, 'spare', 's-balloon').reasons, 'socket-occupied'), true);
  assert.equal(has(previewInstall(state, 'spare', 's-engine').reasons, 'socket-incompatible'), true);
  state.ship.sockets.at(-1).enabled = false;
  assert.equal(has(previewInstall(state, 'spare', 'extra').reasons, 'socket-disabled'), true);
  state.ship.sockets.at(-1).enabled = true; state.ship.sockets.at(-1).parentId = 'spare';
  assert.equal(has(previewInstall(state, 'spare', 'extra').reasons, 'parent-not-installed'), true);
  assert.equal(has(previewInstall(state, 'spare', 'extra').reasons, 'part-cycle'), true);
});

test('cargo to installed retains weight, warehouse to installed adds it; preview does not commit', () => {
  const state = fixture(); state.parts[5].location = 'cargo';
  const result = previewInstall(state, 'spare', 'extra');
  assert.equal(result.ok, true);
  assert.equal(result.before.weight, 50);
  assert.equal(result.after.weight, 50);
  assert.equal(result.state.revision, 0);
  assert.equal(state.parts[5].location, 'cargo');
  assert.equal(installPart(state, 'spare', 'extra').state.revision, 1);
});

test('installation refuses insufficient lift or power and reports attempted after budget', () => {
  const state = fixture(); state.parts[5].weight = 25;
  const result = installPart(state, 'spare', 'extra');
  assert.equal(result.ok, false);
  assert.equal(has(result.reasons, 'underlift'), true);
  assert.equal(result.after.weight, 65);
  assert.equal(result.state, undefined);
  const power = fixture(); power.parts[5].powerDemand = 5;
  const overload = previewInstall(power, 'spare', 'extra');
  assert.equal(has(overload.reasons, 'overpower'), true);
  assert.equal(overload.after.powerMargin, -1);
});

test('balloon output scales below 50%; other outputs remain full until destroyed', () => {
  const state = fixture();
  state.parts[1].hp = 50; assert.equal(computeBudget(state).lift, 60);
  state.parts[1].hp = 25; assert.equal(computeBudget(state).lift, 30);
  assert.equal(has(departureReasons(state), 'underlift'), true);
  state.parts[2].hp = 1; assert.equal(computeBudget(state).powerSupply, 14);
  state.parts[2].hp = 0; assert.equal(computeBudget(state).powerSupply, 0);
  assert.equal(has(departureReasons(state), 'required-engine'), true);
});

test('subtree removal and bundle reinstall keep IDs, provenance and internal links', () => {
  const state = fixture();
  state.parts.find(part => part.id === 'gun').parentId = 'engine';
  state.ship.sockets.find(socket => socket.id === 's-gun').parentId = 'engine';
  const removed = removePart(state, 'engine', { destination: 'warehouse' });
  assert.equal(removed.ok, true);
  assert.deepEqual(removed.partIds, ['engine', 'gun']);
  assert.equal(removed.state.parts.find(part => part.id === 'engine').parentId, null);
  assert.equal(removed.state.parts.find(part => part.id === 'gun').parentId, 'engine');
  assert.equal(removed.state.parts.find(part => part.id === 'gun').socketId, 's-gun');
  assert.deepEqual(validateParts(removed.state), []);
  assert.equal(has(departureReasons(removed.state), 'required-engine'), true);
  assert.equal(has(previewInstall(removed.state, 'gun', 's-gun').reasons, 'bundle-root-required'), true);
  const installed = installPart(removed.state, 'engine', 'extra');
  assert.equal(installed.ok, true);
  assert.equal(installed.state.parts.find(part => part.id === 'engine').socketId, 'extra');
  assert.equal(installed.state.parts.find(part => part.id === 'gun').parentId, 'engine');
  assert.deepEqual(installed.state.parts.map(part => part.source), state.parts.map(part => part.source));
  assert.equal(removePart(state, 'hull', { destination: 'cargo' }).ok, false);
});

test('repair quote is unpaid, aggregates rounding, consumes actual recovery once, and is immutable', () => {
  const state = fixture(); state.parts[1].hp = 97; state.parts[2].hp = 98;
  const snapshot = structuredClone(state);
  const quote = quoteRepair(state);
  assert.equal(quote.recovery, 5);
  assert.deepEqual(quote.cost, { S: 2, F: 0, C: 0 });
  assert.equal(state.resources.S, 100);
  const repaired = confirmRepair(state, quote);
  assert.equal(repaired.ok, true);
  assert.equal(repaired.state.resources.S, 98);
  assert.deepEqual(repaired.actualCost, { S: 2, F: 0, C: 0 });
  assert.equal(repaired.state.repairReceipts.length, 1);
  assert.deepEqual(state, snapshot);
  const repeated = confirmRepair(repaired.state, quote);
  assert.equal(repeated.ok, false);
  assert.equal(has(repeated.reasons, 'quote-already-paid'), true);
  assert.equal(repaired.state.resources.S, 98);
  const zeroQuote = quoteRepair(repaired.state);
  const zero = confirmRepair(repaired.state, zeroQuote);
  assert.equal(zero.ok, true);
  assert.equal(zero.recovery, 0);
  assert.equal(zero.state.resources.S, 98);
});

test('stale HP/revision, forged cost, repeated IDs and insufficient scrap prevent repair', () => {
  const state = fixture(); state.parts[1].hp = 25;
  const quote = quoteRepair(state);
  const changedHp = structuredClone(state); changedHp.parts[1].hp = 30;
  assert.equal(has(confirmRepair(changedHp, quote).reasons, 'quote-stale'), true);
  const changedRevision = structuredClone(state); changedRevision.revision += 1;
  assert.equal(has(confirmRepair(changedRevision, quote).reasons, 'quote-stale'), true);
  const forged = structuredClone(quote); forged.cost.S = 0;
  assert.equal(has(confirmRepair(state, forged).reasons, 'quote-stale'), true);
  assert.equal(quoteRepair(state, ['balloon', 'balloon']).ok, false);
  const poor = structuredClone(state); poor.resources.S = 1;
  assert.equal(has(confirmRepair(poor, quote).reasons, 'scrap-insufficient'), true);
  assert.equal(poor.parts[1].hp, 25);
});

test('safe phase gates every mutation, fuel gate and missing example equipment explain departure refusal', () => {
  const state = fixture(); state.phase = 'sailing';
  assert.equal(has(installPart(state, 'spare', 'extra').reasons, 'unsafe-phase'), true);
  assert.equal(has(removePart(state, 'gun', { destination: 'cargo' }).reasons, 'unsafe-phase'), true);
  assert.equal(has(quoteRepair(state).reasons, 'unsafe-phase'), true);
  state.phase = 'debrief'; state.resources.F = 4;
  assert.equal(has(departureReasons(state), 'fuel-insufficient'), true);
  const removed = removePart(state, 'hook', { destination: 'cargo' });
  assert.equal(removed.ok, true);
  assert.equal(removed.before.weight, removed.after.weight);
  assert.equal(has(departureReasons(removed.state), 'required-hook'), true);
});

test('malformed save-shaped payloads return validation failures instead of throwing or creating state', () => {
  const badSockets = fixture(); badSockets.ship.sockets = { bad: true };
  const badKinds = fixture(); badKinds.ship.sockets[0].kinds = 7;
  const badParts = fixture(); badParts.parts = [null, 5, {}];
  const badSource = fixture(); badSource.parts[2].source.acquiredVoyageId = {};
  const badReceipt = fixture(); badReceipt.repairReceipts = [null];
  const badMax = fixture(); badMax.parts[1].maxHp = Infinity;
  for (const state of [null, {}, badSockets, badKinds, badParts, badSource, badReceipt, badMax]) {
    assert.doesNotThrow(() => validateParts(state));
    assert.ok(validateParts(state).length > 0);
    const install = installPart(state, 'spare', 'extra');
    assert.equal(install.ok, false);
    assert.equal(install.state, undefined);
    assert.equal(quoteRepair(state).ok, false);
  }
});
