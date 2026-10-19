import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createEncounterDirector, validateEncounterCatalog } from './director.mjs';
import { describeAttack, describeSpawn, describeSupport, ROLE_PROFILES } from './attack-intents.mjs';
import { createBattlefieldEncounterAdapter, exampleSpawnCandidates } from './example-adapter.mjs';
import { displayedActorHeading, showBossBanner } from './presentation-policy.mjs';
import { convertAttackIntent } from './training-intent.mjs';
import { collectEncounterAssets, resolveEncounterAsset } from '../fleet/encounter-assets.mjs';

const read = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const catalog = read('./catalog.json');
const sourceFleet = read('../fleet/catalog.json');
const positions = exampleSpawnCandidates;
function setup(stageId = catalog.stages[0].id) {
  const director = createEncounterDirector(catalog);
  const actors = new Map(), events = [], phases = [], counts = { spawned: 0, cleared: 0 };
  let hazards = 0;
  const host = {
    spawnEnemy(command) { assert(!actors.has(command.enemyId)); actors.set(command.enemyId, command); counts.spawned++; },
    clearCombat() { actors.clear(); hazards = 0; counts.cleared++; return { remainingEnemies: actors.size, remainingHazards: hazards }; },
    onEvent(command) { events.push(command); if (command.type === 'phase-changed') phases.push(command.to); },
  };
  const adapter = createBattlefieldEncounterAdapter(director, host);
  director.startStage(stageId, positions()); adapter.flush();
  function defeatWave() {
    for (const enemyId of director.snapshot().activeEnemyIds) {
      actors.delete(enemyId);
      assert(director.enemyDefeated({ runId: director.snapshot().runId, enemyId }));
    }
    assert(director.advance()); adapter.flush();
  }
  return { director, adapter, actors, events, phases, counts, defeatWave, addHazards() { hazards++; }, hazards() { return hazards; } };
}

test('existing six-region catalog has 48 spawns and only known fleet IDs/roles', () => {
  assert(validateEncounterCatalog(catalog));
  assert.equal(catalog.stages.length, 6);
  const ids = new Set(sourceFleet.ships.map(item => item.id));
  let count = 0;
  for (const stage of catalog.stages) {
    for (const spec of [...stage.opening, ...stage.late, stage.midBoss, stage.finalBoss]) {
      assert(ids.has(spec.assetId), spec.assetId); assert(ROLE_PROFILES[spec.role]); count += spec.count || 1;
    }
  }
  assert.equal(count, 48);
});

test('all six regions preserve phase order; each boss spawns and defeats exactly once', () => {
  let total = 0;
  for (const stage of catalog.stages) {
    const s = setup(stage.id);
    assert.equal(s.director.continue(), false);
    assert.equal(s.director.nextStage(), false);
    s.defeatWave(); assert.equal(s.director.snapshot().phase, 'midboss');
    s.addHazards(); s.defeatWave();
    assert.equal(s.director.snapshot().phase, 'maintenance'); assert.equal(s.hazards(), 0); assert.equal(s.actors.size, 0);
    assert(s.director.continue(positions())); s.adapter.flush();
    assert.equal(s.director.continue(), false);
    s.defeatWave(); assert.equal(s.director.snapshot().phase, 'finalboss');
    s.defeatWave(); assert.equal(s.director.snapshot().phase, 'victory');
    assert.equal(s.director.advance(), false);
    assert.deepEqual(s.phases, ['opening', 'midboss', 'maintenance', 'late', 'finalboss', 'victory']);
    assert.deepEqual(s.director.snapshot().bossSpawnCounts, { midboss: 1, finalboss: 1 });
    assert.deepEqual(s.director.snapshot().bossDefeatCounts, { midboss: 1, finalboss: 1 });
    assert.equal(s.events.filter(event => event.type === 'boss-spawned').length, 2);
    total += s.counts.spawned;
  }
  assert.equal(total, 48);
});

test('uncleared actors/hazards and absent acknowledgement block start and maintenance', () => {
  const director = createEncounterDirector(catalog);
  director.startStage(catalog.stages[0].id, positions());
  const command = director.drainCommands().find(command => command.type === 'clear-combat');
  assert.equal(director.snapshot().activeEnemyIds.length, 0);
  for (const report of [{ remainingHazards: 1, remainingEnemies: 0 }, { remainingHazards: 0, remainingEnemies: 1 }, {}]) {
    assert.equal(director.acknowledgeClearance({ runId: command.runId, commandId: command.commandId, ...report }), false);
  }
  assert.equal(director.advance(), false); assert.equal(director.continue(), false);
  assert(director.acknowledgeClearance({ runId: command.runId, commandId: command.commandId, remainingHazards: 0, remainingEnemies: 0 }));
  assert.equal(director.acknowledgeClearance({ runId: command.runId, commandId: command.commandId, remainingHazards: 0, remainingEnemies: 0 }), false);
  for (let wave = 0; wave < 2; wave++) {
    for (const enemyId of director.snapshot().activeEnemyIds) director.enemyDefeated({ runId: command.runId, enemyId });
    assert(director.advance());
  }
  assert.equal(director.snapshot().clearance.target, 'maintenance');
  assert.equal(director.snapshot().majorAttackTokens, 0);
  assert.equal(director.continue(), false);
});

test('duplicate deaths, out-of-order advancement and stale run events cannot progress', () => {
  const s = setup(), before = s.director.snapshot();
  const enemyId = before.activeEnemyIds[0];
  assert.equal(s.director.startStage(catalog.stages[5].id, positions()), false);
  assert.equal(s.director.advance(), false);
  assert.equal(s.director.enemyDefeated({ runId: before.runId - 1, enemyId }), false);
  assert(s.director.enemyDefeated({ runId: before.runId, enemyId }));
  assert.equal(s.director.enemyDefeated({ runId: before.runId, enemyId }), false);
  assert.equal(s.director.advance(), false);
  assert.equal(s.director.nextStage(), false);
});

test('same-frame player defeat overrides the last kill before host advances', () => {
  const s = setup();
  for (const enemyId of s.director.snapshot().activeEnemyIds) s.director.enemyDefeated({ runId: s.director.snapshot().runId, enemyId });
  assert(s.director.playerDefeated({ runId: s.director.snapshot().runId }));
  assert.equal(s.director.advance(), false); s.adapter.flush();
  assert.equal(s.director.snapshot().phase, 'defeat');
  assert.equal(s.director.snapshot().bossSpawnCounts.midboss, 0);
  assert.equal(s.actors.size, 0);
});

test('retry/reset reject old clear acknowledgements and create fresh IDs without leftover spawns', () => {
  const s = setup();
  s.director.retry(positions());
  const stale = s.director.drainCommands().find(command => command.type === 'clear-combat');
  s.director.retry(positions());
  assert.equal(s.director.acknowledgeClearance({ runId: stale.runId, commandId: stale.commandId, remainingHazards: 0, remainingEnemies: 0 }), false);
  s.adapter.flush(); const newIds = s.director.snapshot().activeEnemyIds;
  assert(newIds.every(id => id.includes(`encounter-${s.director.snapshot().runId}-`)));
  assert.equal(s.actors.size, 2);
  s.director.reset(); s.adapter.flush();
  assert.equal(s.director.snapshot().phase, 'briefing'); assert.equal(s.actors.size, 0);
  assert.equal(s.director.snapshot().activeEnemyIds.length, 0);
  assert.equal(s.director.enemyDefeated({ runId: stale.runId, enemyId: newIds[0] }), false);
});

test('spawn preflight is atomic and backtracks when world candidates restrict roles', () => {
  const director = createEncounterDirector(catalog), before = director.snapshot();
  assert.throws(() => director.startStage(catalog.stages[0].id, [{ id: 'only-one', x: 1, z: 1 }]), /Insufficient/);
  assert.deepEqual(director.snapshot(), before); assert.deepEqual(director.drainCommands(), []);
  assert.throws(() => director.startStage(catalog.stages[0].id, [{ id: 'bad', x: NaN, z: 1 }]), /Invalid/);
  // Industry opening: artillery, repair, salvage. A greedy allocator would fail.
  director.startStage('stage-04-industry', [{ id: 'any', x: 1, z: 1 }, { id: 'artillery-only', x: 2, z: 2, roles: ['artillery'] }, { id: 'salvage-only', x: 3, z: 3, roles: ['salvage'] }]);
  const clear = director.drainCommands()[0];
  director.acknowledgeClearance({ runId: clear.runId, commandId: clear.commandId, remainingHazards: 0, remainingEnemies: 0 });
  const spawns = director.drainCommands().filter(command => command.type === 'spawn-enemy');
  assert.equal(spawns.find(spawn => spawn.role === 'repair').candidateId, 'any');
  assert.equal(new Set(spawns.map(spawn => spawn.candidateId)).size, 3);
});

test('pause blocks progression; nextStage moves only to the adjacent region after victory', () => {
  const s = setup(); s.director.pause();
  assert.equal(s.director.enemyDefeated({ runId: s.director.snapshot().runId, enemyId: s.director.snapshot().activeEnemyIds[0] }), false);
  assert.equal(s.director.advance(), false); s.director.pause(false);
  s.defeatWave(); s.defeatWave(); s.director.continue(); s.adapter.flush(); s.defeatWave(); s.defeatWave();
  assert(s.director.nextStage(positions())); s.adapter.flush();
  assert.equal(s.director.snapshot().stageId, catalog.stages[1].id);
  assert.equal(s.director.snapshot().phase, 'opening');
});

test('host bridge waits for real clearance and never ticks, moves or damages entities', () => {
  const director = createEncounterDirector(catalog);
  let hazards = 1, spawns = 0, calls = 0;
  const adapter = createBattlefieldEncounterAdapter(director, { clearCombat() { calls++; return { remainingHazards: hazards, remainingEnemies: 0 }; }, spawnEnemy() { spawns++; } });
  director.startStage(catalog.stages[0].id, positions());
  assert.equal(adapter.flush().waitingForClearance, true); assert.equal(spawns, 0);
  hazards = 0; assert.equal(adapter.flush().waitingForClearance, false); assert.equal(spawns, 2);
  adapter.flush(); assert.equal(spawns, 2); assert.equal(calls, 2);
  assert.equal(typeof director.update, 'undefined'); assert.equal(typeof director.step, 'undefined');
});

test('intent descriptions preserve distinct shapes, floors, finite support and boss pattern transitions', () => {
  const expected = { scout: ['shot', 'line'], blockade: ['fan', 'cone'], salvage: ['harpoon', 'line'], charger: ['charge', 'line'], artillery: ['mortar', 'circle'], flame: ['flame', 'cone'], bell: ['ring', 'ring'], heart: ['pressure', 'line'] };
  const styles = new Set();
  for (const [role, [pattern, shape]] of Object.entries(expected)) {
    const intent = describeAttack({ role, telegraphScale: .01 });
    assert.equal(intent.pattern, pattern); assert.equal(intent.telegraph.shape, shape); styles.add(intent.telegraph.lineStyle);
    assert(intent.telegraph.duration >= (pattern === 'charge' ? 1.2 : pattern === 'shot' ? 1 : 1.5));
    assert(intent.telegraph.preserveSafePath); assert.equal(intent.telegraph.soundOnly, false);
  }
  assert.equal(styles.size, Object.keys(expected).length);
  assert.equal(describeAttack({ role: 'king', tier: 'finalboss', attackIndex: 2 }).pattern, 'charge');
  assert.equal(describeAttack({ role: 'blockade', tier: 'midboss', attackIndex: 1, healthFraction: .3 }).pattern, 'mortar');
  assert.equal(describeAttack({ role: 'bell', tier: 'finalboss', disabledPatterns: ['ring'] }), null);
  assert.equal(describeSupport({ role: 'repair', remainingBudget: 3 }).amountHint, 3);
  assert.equal(describeSupport({ role: 'repair', remainingBudget: 0 }), null);
  assert.equal(describeSpawn({ role: 'repair', tier: 'midboss' }).healBudget, 70);
});

test('weapon and VFX IDs in intent/support descriptors exist in their actual catalogs', () => {
  const weapons = new Set(read('../../outputs/weapon-modules/catalog.json').items.map(item => item.id));
  const effects = new Set(read('../../outputs/combat-vfx/catalog.json').items.map(item => item.id));
  for (const role of Object.keys(ROLE_PROFILES)) {
    for (let attackIndex = 0; attackIndex < 3; attackIndex++) {
      const intent = describeAttack({ role, tier: 'finalboss', attackIndex });
      if (intent.telegraph.weaponId) assert(weapons.has(intent.telegraph.weaponId));
      for (const id of intent.telegraph.vfx) assert(effects.has(id), id);
    }
  }
  for (const id of describeSupport({ role: 'repair', remainingBudget: 7 }).telegraph.vfx) assert(effects.has(id));
});

test('presentation fixes hide a banner during a warning and freeze charge heading only while charging', () => {
  const state = { banner: '중간보스 접근', bannerTime: 2, phase: 'midboss', paused: false, telegraphs: [] };
  assert(showBossBanner(state)); assert.equal(showBossBanner({ ...state, telegraphs: [{}] }), false);
  assert.equal(showBossBanner({ ...state, paused: true }), false);
  assert.equal(displayedActorHeading({ angle: 1, chargeAngle: 2, chargeTime: .5 }), 2);
  assert.equal(displayedActorHeading({ angle: 1, chargeAngle: 2, chargeTime: 0 }), 1);
  assert.equal(displayedActorHeading({ angle: 1, chargeTime: .5 }), 1);
});

test('training conversion explicitly downgrades mechanics and cannot target an unseen player', () => {
  const intent = describeAttack({ role: 'charger' });
  const converted = convertAttackIntent({ intent, enemy: { x: 0, z: 0 }, observedTarget: { x: 80, z: 0 } });
  assert.deepEqual(converted.move, { x: 1, z: 0 }); assert.equal(converted.sourcePattern, 'charge');
  assert.equal(converted.executedPattern, 'battlefield-training-projectile');
  assert.equal(convertAttackIntent({ intent, enemy: { x: 0, z: 0 }, observedTarget: null }).attackTarget, null);
  assert.equal(convertAttackIntent({ intent, enemy: { x: 0, z: 0 }, observedTarget: { x: 10, z: 0 }, allowAttack: false }).attackTarget, null);
});

test('fleet binding requires generated output paths and rejects path traversal', () => {
  const fixture = { ships: sourceFleet.ships.map(item => ({ ...item, model: `ships/${item.id}.glb` })) };
  const bindings = collectEncounterAssets(catalog, fixture);
  assert.equal(bindings.length, 19); // Player plus the 18 distinct enemy models in the source catalog.
  assert(bindings.every(binding => binding.modelPath.startsWith('outputs/fleet-v1/ships/')));
  assert.throws(() => resolveEncounterAsset({ ships: [{ id: 'bad', model: '../secret.glb' }] }, 'bad'), /Unsafe/);
  assert.throws(() => resolveEncounterAsset(sourceFleet, 'player-homeward'), /missing/);
});

test('restored generated fleet catalog supplies all 19 actual local GLB headers and byte sizes', () => {
  const fleet = read('../../outputs/fleet-v1/catalog.json');
  const bindings = collectEncounterAssets(catalog, fleet);
  assert.equal(bindings.length, 19);
  for (const binding of bindings) {
    const file = new URL(`../../${binding.modelPath}`, import.meta.url);
    assert.equal(fs.statSync(file).size, binding.bytes, binding.assetId);
    const header = Buffer.alloc(12), handle = fs.openSync(file, 'r');
    try { assert.equal(fs.readSync(handle, header, 0, 12, 0), 12); } finally { fs.closeSync(handle); }
    assert.equal(header.toString('ascii', 0, 4), 'glTF', binding.assetId);
    assert.equal(header.readUInt32LE(4), 2); assert.equal(header.readUInt32LE(8), binding.bytes);
  }
});

test('preserved standalone core still progresses six regions with explicit forced-defeat regression hooks', async () => {
  const source = fs.readFileSync(new URL('./core.js', import.meta.url), 'utf8');
  const { createEncounter } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  for (const stage of catalog.stages) {
    const engine = createEncounter(catalog); engine.startStage(stage.id);
    for (let wave = 0; wave < 4; wave++) {
      for (const enemy of engine.getState().enemies) engine.defeatEnemy(enemy.id);
      engine.step(1 / 60);
      if (engine.getState().phase === 'maintenance') assert(engine.continue());
    }
    assert.equal(engine.getState().phase, 'victory');
    assert.deepEqual(engine.getState().bossDefeatCounts, { midboss: 1, finalboss: 1 });
  }
});
