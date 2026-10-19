import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattlefieldAdapter, BATTLEFIELD_VERSION } from './integration.mjs';
import { CONFIG, configureWorld, damageModule, fire } from './sim.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, message || `${actual} != ${expected}`);
const get = (enemy, key) => enemy.modules.find(module => module.key === key);
const stationaryIntent = { move: { x: 0, z: 0 }, attackTarget: null };

function module(id, key, parentId, values = {}) {
  return { id, key, parentId, type: key === 'root' ? 'hull' : key,
    hp: 64, maxHp: 64, localX: 0, localZ: 0, radius: 1, weight: 0, ...values };
}

function targetAdapter(options = {}) {
  const adapter = createBattlefieldAdapter({
    world: { playerSpawn: { x: -20, z: 10 }, harbor: { x: -20, z: 10, radius: 4 } },
    enemySpawns: [{ id: 'target', assetId: 'test-target', x: 0, z: 0,
      modules: [module('target:root', 'root', null)] }],
    ...options,
  });
  assert.equal(adapter.dispatch({ id: 'hold-target', type: 'intent', enemyId: 'target', intent: stationaryIntent }).ok, true);
  adapter.drainEvents();
  return adapter;
}

test('authored muzzle callback drives the real swept projectile, impact frame and termination', () => {
  let muzzleCalls = 0, callbackInput;
  const adapter = targetAdapter({ muzzleResolver(input) {
    muzzleCalls += 1; callbackInput = input;
    return { position: { x: -10, y: 2.5, z: 0 }, direction: { x: 4, y: 0, z: 0 }, source: 'fixture:actual-muzzle' };
  } });
  const state = adapter.advance(1 / 60, { fire: true, aimX: -20, aimZ: -50 });
  assert.equal(state, adapter.state, 'the adapter returns its single authority state');
  assert.equal(muzzleCalls, 1);
  assert.equal(callbackInput.player, state.player);
  assert.deepEqual(callbackInput.target, { x: -20, z: -50 });
  const spawn = adapter.drainEvents().find(event => event.type === 'player-fire');
  assert.ok(spawn);
  assert.equal(spawn.weaponId, '01-machine-gun');
  assert.equal(spawn.muzzleSource, 'fixture:actual-muzzle');
  assert.deepEqual({ x: spawn.x, y: spawn.y, z: spawn.z }, { x: -10, y: 2.5, z: 0 });
  assert.deepEqual(spawn.direction, { x: 1, y: 0, z: 0 });
  close(state.projectiles[0].x, -10 + CONFIG.playerProjectileSpeed / 60);
  assert.equal(state.projectiles[0].z, 0, 'aim target does not replace the supplied muzzle axis');
  assert.equal(get(state.enemies[0], 'root').hp, 64, 'firing is not an immediate hit timeline');

  adapter.advance(0.25);
  const events = adapter.drainEvents();
  const impact = events.find(event => event.type === 'hit');
  const ended = events.find(event => event.type === 'projectile-ended');
  assert.ok(impact && ended);
  assert.equal(impact.projectileId, spawn.projectileId);
  assert.equal(ended.projectileId, spawn.projectileId);
  assert.equal(ended.reason, 'collision');
  assert.equal(impact.moduleId, 'target:root');
  assert.equal(impact.weaponId, '01-machine-gun');
  close(impact.x, -1.1);
  close(impact.normal.x, -1);
  close(impact.normal.z, 0);
  close(Math.hypot(impact.normal.x, impact.normal.z), 1);
  assert.deepEqual(impact.direction, { x: 1, y: 0, z: 0 });
  assert.ok(impact.seq < ended.seq);
  assert.equal(get(state.enemies[0], 'root').hp, 56);
  assert.equal(state.stats.hits, 1);
  assert.equal(state.projectiles.length, 0);
  assert.deepEqual(adapter.drainEvents(), [], 'event draining has an independent cursor');
});

test('a projectile crossing a whole hit circle in one substep impacts only once even after replay', () => {
  const adapter = targetAdapter(), state = adapter.state;
  const shot = { id: 'replayed-projectile', owner: 'player', x: -20, z: 0,
    vx: 2400, vz: 0, damage: 8, ttl: 1, radius: 0.1 };
  state.projectiles.push(clone(shot), clone(shot));
  adapter.advance(1 / 60);
  assert.equal(get(state.enemies[0], 'root').hp, 56);
  assert.equal(state.stats.hits, 1);
  assert.equal(adapter.drainEvents().filter(event => event.type === 'hit').length, 1);
  state.projectiles.push(clone(shot));
  adapter.advance(1 / 60);
  assert.equal(get(state.enemies[0], 'root').hp, 56);
  assert.equal(state.stats.hits, 1);
  assert.equal(state.projectiles.length, 0);
  assert.deepEqual(adapter.drainEvents(), []);
});

test('damage receipts deduplicate a target identity while allowing a distinct impact', () => {
  const adapter = targetAdapter(), state = adapter.state;
  assert.equal(damageModule(state, 'target', 'root', 8, 'impact-A'), true);
  assert.equal(damageModule(state, 'target', 'target:root', 8, 'impact-A'), false);
  assert.equal(get(state.enemies[0], 'root').hp, 56, 'key aliases resolve to the same damage receipt');
  assert.equal(damageModule(state, 'target', 'root', 8, 'impact-B'), true);
  assert.equal(get(state.enemies[0], 'root').hp, 48);
});

test('an actual socket aimed back through its own hull cannot spawn a projectile', () => {
  let direction = -1;
  const adapter = createBattlefieldAdapter({ enemySpawns: [], world: { playerSpawn: { x: 0, z: 0 } },
    muzzleResolver: () => ({ position: { x: 4, y: 2, z: 0 },
      direction: { x: direction, y: 0, z: 0 }, source: 'fixture:rotating-socket' }),
  });
  assert.equal(fire(adapter.state, { x: 20, z: 0 }), false);
  assert.equal(adapter.state.stats.shots, 0);
  assert.equal(adapter.state.projectiles.length, 0);
  assert.deepEqual(adapter.drainEvents(), []);
  direction = 1;
  const shot = fire(adapter.state, { x: 20, z: 0 });
  assert.ok(shot);
  assert.equal(shot.x, 4);
  assert.equal(shot.vx, CONFIG.playerProjectileSpeed);
  assert.equal(adapter.state.stats.shots, 1);
});

test('lifetime expiry emits one termination without synthesizing a hit or damage', () => {
  const adapter = createBattlefieldAdapter({ enemySpawns: [] });
  adapter.state.projectiles.push({ id: 'expired', owner: 'player', x: 0, z: 0,
    vx: 1, vz: 0, damage: 8, ttl: 0.001, radius: 0.1 });
  adapter.advance(1 / 60);
  const events = adapter.drainEvents();
  assert.equal(events.filter(event => event.type === 'hit').length, 0);
  assert.deepEqual(events.filter(event => event.type === 'projectile-ended').map(event => [event.projectileId, event.reason]), [['expired', 'range-or-lifetime']]);
  assert.equal(adapter.state.projectiles.length, 0);
  assert.equal(adapter.state.stats.hits, 0);
});

test('pause freezes time, debris, telegraph, projectiles and cooldowns, then resume advances once', () => {
  const adapter = createBattlefieldAdapter(), state = adapter.state;
  damageModule(state, 'tax-1', 'connector', 100, 'make-debris');
  state.enemies[1].telegraph = { fromX: 28, fromZ: -27, targetX: 0, targetZ: 35, remaining: 0.8, duration: 1.3 };
  state.projectiles.push({ id: 'pause-shot', owner: 'player', x: 0, z: 0, vx: 1, vz: 0, damage: 8, ttl: 1 });
  state.player.cooldown = 0.4;
  assert.equal(adapter.dispatch({ id: 'pause', type: 'pause' }).ok, true);
  const before = adapter.snapshot();
  adapter.advance(20, { moveX: 1, boost: true, fire: true });
  assert.deepEqual(adapter.snapshot(), before);
  assert.equal(fire(state, { x: 0, z: -20 }), false);
  assert.equal(damageModule(state, 'scout-1', 'root', 8, 'paused-impact'), false);
  assert.equal(adapter.dispatch({ id: 'paused-salvage', type: 'salvage' }).ok, false);
  assert.deepEqual(adapter.snapshot(), before);
  assert.equal(adapter.dispatch({ id: 'resume', type: 'resume' }).ok, true);
  adapter.advance(1 / 60);
  close(state.time, 1 / 60);
  close(state.debris[0].remaining, CONFIG.debrisLifetime - 1 / 60);
  close(state.enemies[1].telegraph.remaining, 0.8 - 1 / 60);
  close(state.player.cooldown, 0.4 - 1 / 60);
});

test('retry clears combat and cursor state, rejects stale commands, and does not replay a retry mutation', () => {
  const adapter = createBattlefieldAdapter(), first = adapter.state;
  const firstGeneration = adapter.generation;
  damageModule(first, 'tax-1', 'connector', 100, 'detach-before-retry');
  Object.assign(first.player, { x: first.debris[0].x, z: first.debris[0].z });
  assert.equal(adapter.dispatch({ id: 'recover-before-retry', type: 'salvage', generation: firstGeneration }).ok, true);
  assert.ok(fire(first, { x: 80, z: 80 }));
  adapter.drainEvents();
  assert.equal(first.cargo.length, 1);
  assert.equal(first.projectiles.length, 1);
  const retryCommand = { id: 'retry-once', type: 'retry', generation: firstGeneration };
  const receipt = adapter.dispatch(retryCommand);
  assert.equal(receipt.ok, true);
  assert.equal(adapter.generation, firstGeneration + 1);
  assert.notEqual(adapter.state, first);
  assert.equal(adapter.state.time, 0);
  assert.equal(adapter.state.cargo.length, 0);
  assert.equal(adapter.state.projectiles.length, 0);
  assert.equal(adapter.state.debris.length, 0);
  assert.equal(adapter.state.damageReceipts.length, 0);
  assert.equal(adapter.state.completedProjectiles.length, 0);
  assert.deepEqual(adapter.drainEvents(), []);

  assert.ok(fire(adapter.state, { x: 0, z: -20 }));
  const resetEvents = adapter.drainEvents();
  assert.equal(resetEvents[0].seq, 1);
  assert.equal(resetEvents[0].generation, firstGeneration + 1);
  adapter.advance(0.1);
  const beforeReplay = adapter.snapshot();
  assert.deepEqual(adapter.dispatch(retryCommand), receipt);
  assert.deepEqual(adapter.snapshot(), beforeReplay, 'the acknowledged retry is not executed twice');
  assert.equal(adapter.dispatch({ id: 'old-generation-command', type: 'pause', generation: firstGeneration }).reason, 'stale-generation');
  assert.deepEqual(adapter.snapshot(), beforeReplay);
  assert.equal(adapter.dispatch({ ...retryCommand, type: 'pause' }).reason, 'command-id-conflict');
});

test('snapshots and drained events are detached copies of the sole authoritative state', () => {
  const adapter = targetAdapter();
  const snapshot = adapter.snapshot();
  assert.equal(snapshot.version, BATTLEFIELD_VERSION);
  snapshot.player.hp = 0; snapshot.enemies[0].modules[0].hp = 0;
  assert.equal(adapter.state.player.hp, 100);
  assert.equal(get(adapter.state.enemies[0], 'root').hp, 64);
  assert.equal(adapter.dispatch({ id: 'spawn-copy', type: 'spawn', enemy: {
    id: 'other', assetId: 'enemy-pirate-scout', x: 40, z: -20,
  } }).ok, true);
  const events = adapter.drainEvents();
  events[0].enemyId = 'edited-copy';
  assert.equal(adapter.state.events.at(-1).enemyId, 'other');
});

test('world data configures spawn, harbor and collider coordinates; invalid infinite radii are rejected', () => {
  const adapter = createBattlefieldAdapter({ enemySpawns: [], world: {
    playerSpawn: { x: 11, z: 22 }, harbor: { id: 'north-port', x: 11, z: 22, radius: 5 },
    obstacles: [{ id: 'wall', x: 30, z: 22, radius: 2 }],
  } });
  assert.deepEqual({ x: adapter.state.player.x, z: adapter.state.player.z }, { x: 11, z: 22 });
  assert.equal(adapter.state.harbor.id, 'north-port');
  assert.deepEqual(adapter.state.obstacles[0], { id: 'wall', x: 30, z: 22, radius: 2 });
  assert.equal(adapter.dispatch({ id: 'relocate-world', type: 'world', world: {
    playerSpawn: { x: -5, z: -7 }, harbor: { x: -5, z: -7, radius: 3 },
  } }).ok, true);
  assert.deepEqual({ x: adapter.state.player.x, z: adapter.state.player.z }, { x: -5, z: -7 });
  const before = adapter.snapshot();
  assert.throws(() => configureWorld(adapter.state, { obstacles: [{ x: 0, z: 0, radius: Infinity }] }), /Invalid world collider/);
  assert.deepEqual(adapter.snapshot(), before);
  assert.equal(adapter.dispatch({ id: 'invalid-infinity-world', type: 'world', world: { obstacles: [{ x: 0, z: 0, radius: Infinity }] } }).ok, false);
  assert.deepEqual(adapter.snapshot(), before);
  assert.equal(adapter.dispatch({ id: 'invalid-multi-field-world', type: 'world', world: {
    obstacles: [{ x: 1, z: 2, radius: 3 }], harbor: { x: 0, z: 0, radius: -1 },
  } }).ok, false);
  assert.deepEqual(adapter.snapshot(), before, 'invalid harbor must not partially replace valid colliders');
  assert.equal(adapter.dispatch({ id: 'return-custom-port', type: 'return' }).ok, true);
  assert.equal(adapter.state.outcome, 'victory');
});

test('a director stage barrier cancels combat once while preserving voyage and salvage state', () => {
  const adapter = createBattlefieldAdapter(), state = adapter.state;
  damageModule(state, 'tax-1', 'connector', 100, 'barrier-cargo');
  Object.assign(state.player, { x: state.debris[0].x, z: state.debris[0].z });
  assert.equal(adapter.dispatch({ id: 'barrier-salvage', type: 'salvage' }).ok, true);
  damageModule(state, 'scout-1', 'root', 100, 'barrier-debris');
  state.time = 3.5;
  const activeEnemy = state.enemies.find(enemy => enemy.id === 'salvager-1');
  activeEnemy.telegraph = { fromX: 5, fromZ: -52, targetX: 0, targetZ: 35, remaining: 1, duration: 1.3 };
  const shot = { id: 'barrier-live-shot', owner: 'enemy', x: 0, z: 0, vx: 1, vz: 0, damage: 8, ttl: 5 };
  state.projectiles.push(clone(shot), clone(shot));
  state.completedProjectiles.push('already-ended');
  const cargo = clone(state.cargo), debris = clone(state.debris), player = clone(state.player);
  const nextId = state.nextId, generation = adapter.generation;
  adapter.drainEvents();
  const command = { id: 'clear-stage-once', type: 'clear-combat', reason: 'stage-complete', generation };
  const receipt = adapter.dispatch(command);
  assert.equal(receipt.ok, true);
  assert.equal(adapter.generation, generation, 'a stage barrier does not create a new voyage generation');
  assert.equal(adapter.state, state);
  assert.deepEqual(state.enemies, []);
  assert.deepEqual(state.projectiles, []);
  assert.deepEqual(state.completedProjectiles, []);
  assert.equal(activeEnemy.telegraph, null);
  assert.deepEqual(state.cargo, cargo);
  assert.deepEqual(state.debris, debris);
  assert.deepEqual(state.player, player);
  assert.equal(state.time, 3.5);
  assert.equal(state.nextId, nextId);
  const events = adapter.drainEvents();
  assert.deepEqual(events.map(event => event.type), ['projectile-ended', 'combat-cleared']);
  assert.equal(events[0].projectileId, shot.id);
  assert.equal(events[0].reason, 'stage-complete');
  assert.equal(events[1].reason, 'stage-complete');

  assert.equal(adapter.dispatch({ id: 'next-stage-spawn', type: 'spawn', enemy: {
    id: 'next-stage', assetId: 'enemy-pirate-scout', x: 40, z: -20,
  } }).ok, true);
  adapter.drainEvents();
  const beforeReplay = adapter.snapshot();
  assert.deepEqual(adapter.dispatch(command), receipt);
  assert.deepEqual(adapter.snapshot(), beforeReplay, 'a delayed barrier replay cannot erase the new stage');
  assert.deepEqual(adapter.drainEvents(), []);
});

test('explicit encounter intent owns enemy movement and suppresses original AI attack', () => {
  const adapter = createBattlefieldAdapter({ world: { playerSpawn: { x: 0, z: 35 } },
    enemySpawns: [{ id: 'scout', assetId: 'enemy-pirate-scout', x: 20, z: -20 }] });
  const enemy = adapter.state.enemies[0]; enemy.cooldown = 0;
  assert.equal(adapter.dispatch({ id: 'hold-scout', type: 'intent', enemyId: enemy.id, intent: stationaryIntent }).ok, true);
  const original = { x: enemy.x, z: enemy.z, angle: enemy.angle };
  adapter.advance(4);
  assert.deepEqual({ x: enemy.x, z: enemy.z, angle: enemy.angle }, original);
  assert.equal(enemy.telegraph, null);
  assert.equal(adapter.state.projectiles.length, 0);
  assert.equal(adapter.state.events.some(event => event.type === 'enemy-fire'), false);

  assert.equal(adapter.dispatch({ id: 'move-scout', type: 'intent', enemyId: enemy.id,
    intent: { move: { x: 1, z: 0 }, attackTarget: null } }).ok, true);
  adapter.advance(1);
  close(enemy.x, original.x + 3);
  close(enemy.z, original.z);
  assert.equal(enemy.telegraph, null);
  assert.equal(adapter.state.events.some(event => event.type === 'enemy-fire'), false);
});

test('stage clearance cannot respawn an old actor or clone a salvaged module identity', () => {
  const adapter = createBattlefieldAdapter();
  damageModule(adapter.state, 'tax-1', 'connector', 100);
  const oldModule = clone(adapter.state.debris[0].modules[0]);
  adapter.dispatch({ id: 'clear-before-duplicate', type: 'clear-combat' });
  assert.equal(adapter.dispatch({ id: 'duplicate-old-actor', type: 'spawn', enemy: { id: 'tax-1', assetId: 'enemy-tax-cutter', x: 0, z: 0 } }).ok, false);
  const duplicate = module(oldModule.id, 'root', null, { type: 'hull' });
  assert.equal(adapter.dispatch({ id: 'duplicate-old-module', type: 'spawn', enemy: { id: 'new-actor', assetId: 'test', x: 0, z: 0, modules: [duplicate] } }).ok, false);
  assert.equal(adapter.state.enemies.length, 0);
  assert.equal(adapter.state.debris.length, 1);
});

test('repair spends scrap for actual restored HP, capped by damage and available resources', () => {
  const adapter = createBattlefieldAdapter({ enemySpawns: [], loadout: { hp: 95, maxHp: 100, scrap: 30 } });
  const first = adapter.dispatch({ id: 'repair-damage-cap', type: 'repair', hp: 50 });
  assert.equal(first.ok, true); assert.equal(first.value, 5);
  assert.equal(adapter.state.player.hp, 100);
  assert.equal(adapter.state.resources.scrap, 27.5);
  assert.deepEqual(adapter.dispatch({ id: 'repair-damage-cap', type: 'repair', hp: 50 }), first);
  assert.equal(adapter.state.resources.scrap, 27.5, 'a repeated repair command does not charge twice');
  assert.equal(adapter.dispatch({ id: 'repair-undamaged', type: 'repair', hp: 10 }).ok, false);
  assert.equal(adapter.state.resources.scrap, 27.5);

  adapter.state.player.hp = 90; adapter.state.resources.scrap = 1.5;
  const second = adapter.dispatch({ id: 'repair-resource-cap', type: 'repair', hp: 10 });
  assert.equal(second.value, 3);
  assert.equal(adapter.state.player.hp, 93);
  assert.equal(adapter.state.resources.scrap, 0);
  const repairEvent = adapter.state.events.at(-1);
  assert.equal(repairEvent.restored, 3);
  assert.equal(repairEvent.scrapSpent, 1.5);
});

test('harbor departure requires a confirmed loadout and resets the checkpoint with every scalar budget', () => {
  const adapter = createBattlefieldAdapter({ enemySpawns: [], world: {
    playerSpawn: { x: 0, z: 0 }, harbor: { x: 0, z: 0, radius: 5 },
  } });
  assert.equal(adapter.dispatch({ id: 'early-depart', type: 'depart', config: { loadout: {} } }).ok, false);
  assert.equal(adapter.dispatch({ id: 'return-for-departure', type: 'return' }).ok, true);
  assert.equal(adapter.dispatch({ id: 'no-loadout', type: 'depart', config: {} }).ok, false);
  const generation = adapter.generation;
  const loadout = { hp: 60, maxHp: 120, baseWeight: 64, crewWeight: 4,
    lift: 90, powerOutput: 20, powerDraw: 12, scrap: 8 };
  const receipt = adapter.dispatch({ id: 'confirmed-departure', type: 'depart', config: {
    loadout, world: { playerSpawn: { x: 8, z: 9 }, harbor: { x: 8, z: 9, radius: 5 } }, enemySpawns: [],
  } });
  assert.equal(receipt.ok, true);
  assert.equal(adapter.generation, generation + 1);
  for (const key of ['hp', 'maxHp', 'baseWeight', 'crewWeight', 'lift', 'powerOutput', 'powerDraw']) assert.equal(adapter.state.player[key], loadout[key], key);
  assert.equal(adapter.state.player.weight, 64);
  assert.equal(adapter.state.resources.scrap, 8);
  assert.equal(adapter.state.player.powerOverload, false);
  close(adapter.state.player.liftMargin, (90 - 64) / 64);
  assert.equal(adapter.state.outcome, 'sailing');
  assert.equal(adapter.state.cargo.length, 0);
  assert.equal(adapter.state.projectiles.length, 0);
  adapter.state.player.hp = 10;
  adapter.retry();
  assert.equal(adapter.state.player.hp, 60, 'retry uses the confirmed new departure checkpoint');
  assert.equal(adapter.state.player.x, 8);
  assert.equal(adapter.state.player.z, 9);
});

test('optional confirmed module topology recalculates HP, damaged lift, weight and power together', () => {
  const modules = [
    module('player:hull', 'root', null, { hp: 75, maxHp: 100, weight: 25 }),
    module('player:balloon', 'balloon', 'player:hull', { hp: 40, maxHp: 100, weight: 10, lift: 100 }),
    module('player:engine', 'main-engine', 'player:hull', { weight: 10, powerOutput: 12 }),
    module('player:gun', 'cannon', 'player:hull', { weight: 5, powerDraw: 4 }),
  ];
  const adapter = createBattlefieldAdapter({ enemySpawns: [], world: {
    playerSpawn: { x: 0, z: 0 }, harbor: { x: 0, z: 0, radius: 5 },
  } });
  adapter.dispatch({ id: 'return-for-modules', type: 'return' });
  assert.equal(adapter.dispatch({ id: 'depart-with-modules', type: 'depart', config: {
    loadout: { modules, crewWeight: 3, scrap: 9 }, enemySpawns: [],
  } }).ok, true);
  const player = adapter.state.player;
  assert.equal(player.hp, 75); assert.equal(player.maxHp, 100);
  assert.equal(player.baseWeight, 53); assert.equal(player.weight, 53);
  assert.equal(player.lift, 80); assert.equal(player.powerOutput, 12); assert.equal(player.powerDraw, 4);
  assert.equal(player.powerOverload, false);
  close(player.liftMargin, (80 - 53) / 53);
  modules[0].hp = 0;
  assert.equal(player.modules[0].hp, 75, 'confirmed loadout data is copied');
  const repair = adapter.dispatch({ id: 'repair-module-root', type: 'repair', hp: 2 });
  assert.equal(repair.value, 2);
  assert.equal(player.modules.find(value => value.key === 'root').hp, 77);
});
