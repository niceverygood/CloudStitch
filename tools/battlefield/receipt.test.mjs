import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  CONFIG, createSimulation, spawnEnemy, setEnemyIntent, clearCombat,
  damageModule, fire, step,
} from './sim.mjs';
import { createBattlefieldAdapter } from './integration.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const stationary = { move: { x: 0, z: 0 }, attackTarget: null };
const keys = value => Object.keys(value).sort();
const rootOf = enemy => enemy.modules.find(module => module.key === 'root');
const target = (id = 'target', x = 0, z = 0, extraModules = []) => ({
  id, assetId: 'receipt-test-target', x, z,
  modules: [{ id: `${id}:root`, key: 'root', type: 'hull', parentId: null,
    hp: 1e9, maxHp: 1e9, localX: 0, localZ: 0, radius: 1, weight: 0 }, ...extraModules],
});

test('20 minutes of real simulation fire keeps receipt records bounded and rejects evicted native replays', context => {
  const adapter = createBattlefieldAdapter({
    world: { playerSpawn: { x: -20, z: 0 } }, enemySpawns: [target()],
  });
  const sim = adapter.state, enemy = sim.enemies[0], root = rootOf(enemy);
  assert.equal(setEnemyIntent(sim, enemy.id, stationary), true);
  const originalKeys = { sim: keys(sim), player: keys(sim.player), enemy: keys(enemy), root: keys(root) };
  const ticks = 20 * 60 * 60;
  let oldestShot, maxActive = 0, maxDamageRecords = 0, maxCompletedRecords = 0;
  const started = performance.now();
  for (let tick = 0; tick < ticks; tick += 1) {
    adapter.advance(1 / 60, { fire: true, aimX: 0, aimZ: 0 });
    if (!oldestShot) oldestShot = clone(sim.projectiles[0]);
    maxActive = Math.max(maxActive, keys(sim.nativeActiveProjectiles).length);
    maxDamageRecords = Math.max(maxDamageRecords, sim.damageReceipts.length);
    maxCompletedRecords = Math.max(maxCompletedRecords, sim.completedProjectiles.length);
  }
  const elapsedMs = performance.now() - started;
  assert.ok(Math.abs(sim.time - 1200) < 1e-6);
  assert.equal(sim.outcome, 'sailing');
  assert.equal(sim.stats.damageTaken, 0);
  assert.ok(sim.stats.hits > CONFIG.receiptLimit, 'the test must exceed both recent receipt windows');
  assert.equal(sim.stats.shots, sim.stats.hits + sim.projectiles.length);
  assert.equal(root.hp, root.maxHp - sim.stats.hits * CONFIG.playerDamage);
  assert.equal(maxDamageRecords, CONFIG.receiptLimit);
  assert.equal(maxCompletedRecords, CONFIG.receiptLimit);
  assert.equal(sim.damageReceipts.length, CONFIG.receiptLimit);
  assert.equal(sim.completedProjectiles.length, CONFIG.receiptLimit);
  assert.equal(keys(sim.damageReceiptLookup).length, CONFIG.receiptLimit);
  assert.equal(keys(sim.completedProjectileLookup).length, CONFIG.receiptLimit);
  assert.equal(new Set(sim.damageReceipts).size, CONFIG.receiptLimit);
  assert.equal(new Set(sim.completedProjectiles).size, CONFIG.receiptLimit);
  for (const receipt of sim.damageReceipts) assert.equal(sim.damageReceiptLookup[receipt], true);
  for (const id of sim.completedProjectiles) assert.equal(sim.completedProjectileLookup[id], true);
  assert.deepEqual(keys(sim.nativeActiveProjectiles), sim.projectiles.map(shot => shot.id).sort());
  assert.ok(maxActive <= 2, `stationary short-range fire should have at most two live shots, got ${maxActive}`);
  assert.equal(sim.events.length, 200);
  assert.deepEqual({ sim: keys(sim), player: keys(sim.player), enemy: keys(enemy), root: keys(root) }, originalKeys);
  const snapshot = adapter.snapshot();
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot, 'authority receipts survive JSON snapshots');
  assert.equal(snapshot.nativeIssuedHighWater, sim.nativeIssuedHighWater);
  assert.equal(sim.completedProjectiles.includes(oldestShot.id), false, 'the oldest completion has actually been evicted');
  assert.equal(sim.damageReceipts.includes(JSON.stringify([oldestShot.id, root.id])), false, 'the oldest damage receipt has actually been evicted');

  context.diagnostic(JSON.stringify({ simulatedSeconds: sim.time, ticks, elapsedMs: Number(elapsedMs.toFixed(3)),
    shots: sim.stats.shots, hits: sim.stats.hits, activeNative: keys(sim.nativeActiveProjectiles).length,
    projectiles: sim.projectiles.length, maxActive,
    damageRecords: sim.damageReceipts.length, completedRecords: sim.completedProjectiles.length,
    damageLookupKeys: keys(sim.damageReceiptLookup).length,
    completedLookupKeys: keys(sim.completedProjectileLookup).length, fieldsAdded: 0 }));

  adapter.advance(1); // Drain the remaining real shots before testing replay isolation.
  assert.deepEqual(keys(sim.nativeActiveProjectiles), []);
  assert.equal(sim.projectiles.length, 0);
  assert.equal(sim.stats.hits, sim.stats.shots);
  context.diagnostic(JSON.stringify({ tailDrainSeconds: 1, shots: sim.stats.shots,
    hits: sim.stats.hits, activeNative: keys(sim.nativeActiveProjectiles).length, projectiles: sim.projectiles.length }));
  const hpBeforeReplay = root.hp, hitsBeforeReplay = sim.stats.hits, seqBeforeReplay = sim.eventSeq;
  assert.equal(damageModule(sim, enemy.id, root.id, CONFIG.playerDamage, oldestShot.id), false);
  sim.projectiles.push(clone(oldestShot), clone(oldestShot));
  adapter.advance(1 / 60);
  assert.equal(root.hp, hpBeforeReplay);
  assert.equal(sim.stats.hits, hitsBeforeReplay);
  assert.equal(sim.eventSeq, seqBeforeReplay, 'an evicted native replay cannot emit a second hit or ending');
  assert.equal(sim.projectiles.length, 0);
});

test('clear-combat rejects cancelled native shots against a new target while fresh issued shots still hit', () => {
  const sim = createSimulation({ enemySpawns: [], playerSpawn: { x: 0, z: 0 } });
  const shot = fire(sim, { x: 80, z: 0 }), stale = clone(shot);
  assert.ok(shot);
  const highWater = sim.nativeIssuedHighWater;
  clearCombat(sim);
  assert.equal(sim.nativeIssuedHighWater, highWater);
  assert.deepEqual(keys(sim.nativeActiveProjectiles), []);
  assert.deepEqual(sim.completedProjectiles, []);
  assert.deepEqual(keys(sim.completedProjectileLookup), []);
  const enemy = spawnEnemy(sim, target('next-stage', 10, 0)), root = rootOf(enemy);
  setEnemyIntent(sim, enemy.id, stationary);
  const hp = root.hp, seq = sim.eventSeq;
  assert.equal(damageModule(sim, enemy.id, root.id, 8, stale.id), false);
  sim.projectiles.push(stale);
  step(sim, 1);
  assert.equal(root.hp, hp);
  assert.equal(sim.stats.hits, 0);
  assert.equal(sim.eventSeq, seq);
  assert.equal(sim.projectiles.length, 0);
  const fresh = fire(sim, { x: 10, z: 0 });
  assert.ok(fresh);
  assert.ok(sim.nativeIssuedHighWater > highWater);
  step(sim, 0.25);
  assert.equal(root.hp, hp - CONFIG.playerDamage);
  assert.equal(sim.stats.hits, 1);
});

test('a newer native expiry does not retire an older live projectile', () => {
  const sim = createSimulation({ enemySpawns: [], playerSpawn: { x: 0, z: 0 } });
  const older = fire(sim, { x: 80, z: 0 });
  Object.assign(older, { vx: 0, vz: 0, ttl: 10 });
  step(sim, 0.25);
  const newer = fire(sim, { x: 80, z: 0 });
  Object.assign(newer, { vx: 0, vz: 0, ttl: 0.001 });
  const ttl = older.ttl;
  step(sim, 1 / 60);
  assert.equal(sim.nativeIssuedHighWater, Number(newer.id.slice(5)));
  assert.deepEqual(sim.projectiles.map(shot => shot.id), [older.id]);
  assert.deepEqual(keys(sim.nativeActiveProjectiles), [older.id]);
  assert.ok(older.ttl < ttl);
  assert.deepEqual(sim.completedProjectiles, [newer.id]);
  older.ttl = 0.001;
  step(sim, 1 / 60);
  assert.deepEqual(sim.completedProjectiles, [newer.id, older.id]);
  assert.deepEqual(keys(sim.nativeActiveProjectiles), []);
  assert.equal(sim.events.filter(event => event.type === 'projectile-ended').length, 2);
});

test('one live native shot deduplicates each target across multiple modules and recent receipt eviction', () => {
  const child = { id: 'target:deck', key: 'deck', type: 'deck', parentId: 'target:root',
    hp: 1e9, maxHp: 1e9, localX: 0, localZ: 10, radius: 1, weight: 0 };
  const sim = createSimulation({ playerSpawn: { x: -20, z: 0 },
    enemySpawns: [target('target', 0, 0, [child]), target('second-target', 0, 20)] });
  for (const enemy of sim.enemies) setEnemyIntent(sim, enemy.id, stationary);
  const shot = fire(sim, { x: 0, z: 0 });
  const root = rootOf(sim.enemies[0]), deck = sim.enemies[0].modules.find(module => module.key === 'deck');
  const secondRoot = rootOf(sim.enemies[1]);
  assert.equal(damageModule(sim, 'target', 'root', 8, shot.id), true);
  assert.equal(damageModule(sim, 'target', root.id, 8, shot.id), false, 'key and ID aliases share one target identity');
  assert.equal(damageModule(sim, 'target', 'deck', 8, shot.id), true);
  assert.equal(damageModule(sim, 'second-target', 'root', 8, shot.id), true);
  assert.equal(root.hp, root.maxHp - 8);
  assert.equal(deck.hp, deck.maxHp - 8);
  assert.equal(secondRoot.hp, secondRoot.maxHp - 8);
  assert.equal(Object.getPrototypeOf(sim.nativeActiveProjectiles[shot.id].targets), null);
  assert.deepEqual(keys(sim.nativeActiveProjectiles[shot.id].targets), [secondRoot.id, deck.id, root.id].sort());
  for (let index = 0; index < 5000; index += 1) assert.equal(damageModule(sim, 'target', root.id, 1, `generic-${index}`), true);
  assert.equal(sim.damageReceipts.length, CONFIG.receiptLimit);
  assert.equal(keys(sim.damageReceiptLookup).length, CONFIG.receiptLimit);
  for (const module of [root, deck, secondRoot]) assert.equal(sim.damageReceipts.includes(JSON.stringify([shot.id, module.id])), false);
  const before = [root.hp, deck.hp, secondRoot.hp];
  assert.equal(damageModule(sim, 'target', 'root', 8, shot.id), false);
  assert.equal(damageModule(sim, 'target', 'deck', 8, shot.id), false);
  assert.equal(damageModule(sim, 'second-target', 'root', 8, shot.id), false);
  assert.deepEqual([root.hp, deck.hp, secondRoot.hp], before);
  assert.equal(damageModule(sim, 'target', 'root', 1, 'generic-4999'), false, 'recent generic duplicate remains blocked');
});

test('unissued native shot IDs cannot create damage or reserve a future authority ID', () => {
  const sim = createSimulation({ playerSpawn: { x: -20, z: 0 }, enemySpawns: [target()] });
  setEnemyIntent(sim, 'target', stationary);
  const root = rootOf(sim.enemies[0]), hp = root.hp;
  assert.equal(damageModule(sim, 'target', 'root', 8, 'shot-999999'), false);
  sim.projectiles.push({ id: 'shot-999999', owner: 'player', x: -2, z: 0,
    vx: 2400, vz: 0, ttl: 1, radius: 0.1, damage: 8 });
  step(sim, 1 / 60);
  assert.equal(root.hp, hp);
  assert.equal(sim.projectiles.length, 0);
  assert.equal(sim.nativeIssuedHighWater, 0);
  assert.deepEqual(sim.completedProjectiles, []);
  const shot = fire(sim, { x: 0, z: 0 });
  assert.equal(shot.id, 'shot-1');
  assert.equal(sim.nativeIssuedHighWater, 1);
});

test('enemy role and tier metadata retain valid values and reject malformed values before spawning', () => {
  const adapter = createBattlefieldAdapter({ enemySpawns: [{ ...target(), role: 'finalBoss', tier: 'Tier_3-elite' }] });
  assert.equal(adapter.state.enemies[0].role, 'finalBoss');
  assert.equal(adapter.state.enemies[0].tier, 'Tier_3-elite');
  assert.equal(adapter.snapshot().enemies[0].role, 'finalBoss');
  assert.equal(adapter.snapshot().enemies[0].tier, 'Tier_3-elite');
  const sim = createSimulation({ enemySpawns: [] });
  for (const key of ['role', 'tier']) {
    for (const value of ['', 'mid boss', '_invalid', '3invalid', 'a'.repeat(49), 3, null, {}]) {
      assert.throws(() => spawnEnemy(sim, { ...target(`${key}-candidate`), [key]: value }), new RegExp(`Invalid enemy ${key}`));
      assert.equal(sim.enemies.length, 0);
      assert.equal(sim.spawnedEnemyIds.length, 0);
      assert.equal(sim.spawnedModuleIds.length, 0);
    }
  }
  const enemy = spawnEnemy(sim, { ...target('boundary'), role: 'a'.repeat(48), tier: 'T' });
  assert.equal(enemy.role.length, 48);
  assert.equal(enemy.tier, 'T');
});

test('an enemy cooldown elapses with no attack target and firing resumes through a fresh telegraph', () => {
  const sim = createSimulation({ playerSpawn: { x: 0, z: 30 }, enemySpawns: [{
    id: 'scout', assetId: 'enemy-pirate-scout', x: 0, z: 0, role: 'scout', tier: 'basic',
  }] });
  const enemy = sim.enemies[0];
  enemy.cooldown = 2;
  setEnemyIntent(sim, enemy.id, stationary);
  step(sim, 3);
  assert.equal(enemy.cooldown, 0);
  assert.equal(enemy.telegraph, null);
  assert.equal(sim.events.some(event => event.type === 'enemy-fire'), false);
  const attack = { move: { x: 0, z: 0 }, attackTarget: { x: sim.player.x, z: sim.player.z } };
  setEnemyIntent(sim, enemy.id, attack);
  step(sim, 1 / 60);
  assert.ok(enemy.telegraph, 'target restoration starts the warning immediately after the elapsed cooldown');
  assert.equal(sim.events.some(event => event.type === 'enemy-fire'), false, 'target restoration does not bypass the warning');
  step(sim, CONFIG.enemyTelegraph + 1 / 60);
  assert.equal(sim.events.filter(event => event.type === 'enemy-fire').length, 1);
  const seq = sim.eventSeq;
  setEnemyIntent(sim, enemy.id, stationary);
  step(sim, 4);
  assert.equal(enemy.cooldown, 0);
  assert.equal(enemy.telegraph, null);
  assert.equal(sim.events.filter(event => event.seq > seq && event.type === 'enemy-fire').length, 0);
  setEnemyIntent(sim, enemy.id, attack);
  step(sim, 1 / 60);
  assert.ok(enemy.telegraph);
  step(sim, CONFIG.enemyTelegraph + 1 / 60);
  assert.equal(sim.events.filter(event => event.type === 'enemy-fire').length, 2);
});
