import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG, createSimulation, damageModule, dropCargo, fire,
  moduleWorldPosition, returnToHarbor, segmentCircleT, salvage, step,
} from './sim.mjs';

const get = (enemy, key) => enemy.modules.find(m => m.key === key);
const quiet = (sim) => { for (const e of sim.enemies) e.cooldown = 1e6; return sim; };

test('connector damage separates only its live descendant bundle, keeping HP and ancestry', () => {
  const sim = createSimulation(), enemy = sim.enemies[0];
  const cannon = get(enemy, 'cannon'), engine = get(enemy, 'engine');
  damageModule(sim, enemy.id, cannon.id, 7);
  const parent = cannon.parentId;
  damageModule(sim, enemy.id, 'connector', 24);
  assert.equal(enemy.hp, enemy.maxHp);
  assert.equal(get(enemy, 'root').attached, true);
  assert.equal(get(enemy, 'main-engine').attached, true);
  assert.equal(cannon.attached, false);
  assert.equal(engine.attached, false);
  assert.equal(sim.debris.length, 1);
  assert.deepEqual(sim.debris[0].modules.map(m => m.key).sort(), ['aux-balloon', 'cannon', 'deck', 'engine']);
  assert.equal(sim.debris[0].modules.find(m => m.id === cannon.id).hp, cannon.maxHp - 7);
  assert.equal(sim.debris[0].modules.find(m => m.id === cannon.id).parentId, parent);
  assert.equal(sim.debris[0].owner, enemy.id);
});

test('destroying a cannon keeps sibling engine and deck attached, with no hull damage', () => {
  const sim = createSimulation(), enemy = sim.enemies[0];
  damageModule(sim, enemy.id, 'cannon', 100);
  assert.equal(get(enemy, 'cannon').destroyed, true);
  assert.equal(get(enemy, 'deck').attached, true);
  assert.equal(get(enemy, 'engine').attached, true);
  assert.equal(enemy.hp, enemy.maxHp);
  assert.equal(sim.debris.length, 0);
});

test('a detached enemy cannon immediately cancels warning and cannot fire later', () => {
  const sim = quiet(createSimulation()), enemy = sim.enemies[0];
  enemy.cooldown = 0;
  step(sim, 0.1);
  assert.ok(enemy.telegraph);
  assert.ok(enemy.telegraph.remaining > 1);
  damageModule(sim, enemy.id, 'connector', 100);
  assert.equal(enemy.telegraph, null);
  step(sim, 8);
  assert.equal(sim.events.some(e => e.type === 'enemy-fire' && e.enemyId === enemy.id), false);
});

test('recovery requires range, preserves source, remaining HP and unique identity, and never attaches', () => {
  const sim = createSimulation(), enemy = sim.enemies[0];
  damageModule(sim, enemy.id, 'cannon', 5);
  damageModule(sim, enemy.id, 'connector', 100);
  const bundle = sim.debris[0], ids = bundle.modules.map(m => m.id);
  assert.equal(salvage(sim), false);
  Object.assign(sim.player, { x: bundle.x, z: bundle.z });
  const cargo = salvage(sim);
  assert.equal(cargo.id, bundle.id);
  assert.equal(cargo.owner, 'player');
  assert.deepEqual(cargo.modules.map(m => m.id), ids);
  assert.equal(cargo.modules.find(m => m.key === 'cannon').hp, 27);
  assert.equal(cargo.source.assetId, 'enemy-tax-cutter');
  assert.ok(cargo.modules.every(m => m.owner === 'player' && !m.attached));
  assert.equal(salvage(sim), false);
  assert.equal(sim.cargo.length, 1);
  assert.equal(sim.stats.recovered, 1);
  assert.equal(sim.player.weight, 58);
  dropCargo(sim);
  assert.equal(sim.player.weight, 50);
  assert.equal(salvage(sim).id, bundle.id);
  assert.equal(sim.stats.recovered, 1, 'own cargo recovery does not grant another reward');
  assert.equal(new Set(sim.cargo.map(b => b.id)).size, sim.cargo.length);
});

test('swept projectiles hit a module even when the entire circle is crossed in one substep', () => {
  const sim = quiet(createSimulation()), enemy = sim.enemies[0];
  enemy.x = 0; enemy.z = 0; enemy.angle = 0;
  sim.enemies = [enemy];
  sim.projectiles.push({ id: 'fast', owner: 'player', x: -20, z: 0, vx: 2400, vz: 0, damage: 8, ttl: 1, radius: 0.01 });
  step(sim, 1 / 60);
  assert.equal(get(enemy, 'balloon').hp, 40, 'earliest visible module absorbs the swept hit');
  assert.equal(enemy.hp, 64, 'a balloon hit does not also damage the hull');
  assert.equal(sim.projectiles.length, 0);
  assert.equal(sim.stats.hits, 1);
  assert.equal(segmentCircleT(-20, 0, 20, 0, 0, 0, 1), 0.475);
});

test('obstacle sweep intercepts an otherwise valid projectile hit', () => {
  const sim = quiet(createSimulation({ obstacles: [{ x: -8, z: 0, radius: 2 }] }));
  const enemy = sim.enemies[0]; enemy.x = 0; enemy.z = 0; enemy.angle = 0;
  sim.enemies = [enemy];
  sim.projectiles.push({ id: 'blocked', owner: 'player', x: -20, z: 0, vx: 2400, vz: 0, damage: 8, ttl: 1 });
  step(sim, 1 / 60);
  assert.equal(enemy.hp, enemy.maxHp);
  assert.equal(sim.stats.hits, 0);
  assert.equal(sim.events.find(e => e.type === 'hit').target, 'obstacle');
});

test('world bounds and circular obstacles stop the hull without tunnelling', () => {
  const sim = createSimulation({ obstacles: [{ x: 0, z: 20, radius: 5 }] });
  sim.enemies = [];
  step(sim, 3, { moveZ: -1, boost: true });
  assert.ok(sim.player.z >= 28 - 1e-6);
  step(sim, 20, { moveX: 1, moveZ: 1, boost: true });
  assert.ok(sim.player.x <= CONFIG.bounds - sim.player.radius);
  assert.ok(sim.player.z <= CONFIG.bounds - sim.player.radius);
});

test('enemy telegraphs lock a dodgeable destination and respect at least one second warning', () => {
  const sim = quiet(createSimulation()), enemy = sim.enemies[0];
  sim.enemies = [enemy]; enemy.cooldown = 0;
  step(sim, 0.1);
  const targetX = enemy.telegraph.targetX;
  step(sim, 0.8, { moveX: 1 });
  assert.equal(sim.events.some(e => e.type === 'enemy-fire'), false);
  assert.equal(enemy.telegraph.targetX, targetX);
  step(sim, 0.6, { moveX: 1 });
  assert.equal(sim.events.filter(e => e.type === 'enemy-fire').length, 1);
  assert.equal(sim.projectiles[0].owner, 'enemy');
  assert.ok(Math.abs(Math.hypot(sim.projectiles[0].vx, sim.projectiles[0].vz) - CONFIG.enemyProjectileSpeed) < 1e-10);
});

test('fire cooldown, terminal freeze and explicit harbor return behave consistently', () => {
  const sim = quiet(createSimulation());
  assert.ok(fire(sim, { x: 0, z: -50 }));
  assert.equal(fire(sim, { x: 0, z: -50 }), false);
  step(sim, CONFIG.playerCooldown);
  assert.ok(fire(sim, { x: 0, z: -50 }));
  assert.equal(sim.stats.shots, 2);
  assert.equal(returnToHarbor(sim), false);
  const enemy = sim.enemies[0];
  damageModule(sim, enemy.id, 'root', 100);
  const bundle = sim.debris[0];
  Object.assign(sim.player, { x: bundle.x, z: bundle.z });
  salvage(sim);
  assert.equal(returnToHarbor(sim), false);
  Object.assign(sim.player, { x: 0, z: 48 });
  assert.equal(returnToHarbor(sim), true);
  assert.equal(sim.outcome, 'victory');
  assert.equal(sim.endReason, 'safe-retreat-with-cargo');
  const snapshot = JSON.stringify(sim);
  step(sim, 20, { moveX: 1, fire: true });
  assert.equal(JSON.stringify(sim), snapshot);
});

test('same inputs reproduce identical state and events; pause requires no clocks or wall time', () => {
  const a = createSimulation(), b = createSimulation();
  for (let frame = 0; frame < 240; frame++) {
    const input = { moveX: Math.sin(frame / 20), moveZ: -0.4, aimX: -28, aimZ: -12, fire: frame > 50, boost: frame < 40 };
    step(a, 1 / 60, input); step(b, 1 / 60, input);
  }
  assert.deepEqual(a, b);
  const snapshot = JSON.stringify(a);
  step(a, 0, { moveX: 1 });
  step(a, Number.NaN, { fire: true });
  assert.equal(JSON.stringify(a), snapshot);
  assert.ok(a.events.every((entry, i) => !i || entry.seq > a.events[i - 1].seq));
});

test('module world coordinates use the same +Z forward heading as ship rendering', () => {
  const enemy = createSimulation().enemies[0];
  enemy.x = 3; enemy.z = 4; enemy.angle = Math.PI / 2;
  const result = moduleWorldPosition(enemy, { localX: 2, localZ: 5 });
  assert.ok(Math.abs(result.x - 8) < 1e-10);
  assert.ok(Math.abs(result.z - 2) < 1e-10);
});

test('scout and union assets use direct hull children, without invented side connectors', () => {
  const sim = createSimulation();
  for (const enemy of sim.enemies.slice(1)) {
    assert.equal(enemy.layout, 'direct-hull-modules');
    assert.equal(get(enemy, 'connector'), undefined);
    assert.equal(get(enemy, 'deck'), undefined);
    assert.ok(enemy.modules.filter(m => m.key !== 'root').every(m => m.parentId === get(enemy, 'root').id));
    damageModule(sim, enemy.id, 'cannon', 100);
    assert.equal(get(enemy, 'main-engine').attached, true);
  }
  assert.equal(get(sim.enemies[1], 'cannon').type, 'machinegun');
  assert.equal(get(sim.enemies[2], 'cannon').type, 'harpoon');
});

test('cargo overload has a seven second simulation grace and dropping cargo restores lift', () => {
  const sim = quiet(createSimulation());
  for (const enemy of sim.enemies.slice(0, 2)) {
    damageModule(sim, enemy.id, 'root', 100);
    const bundle = sim.debris.find(b => b.enemyId === enemy.id);
    Object.assign(sim.player, { x: bundle.x, z: bundle.z });
    salvage(sim);
  }
  assert.ok(sim.player.weight > sim.player.lift);
  step(sim, 6.7);
  assert.equal(sim.outcome, 'sailing');
  assert.ok(sim.player.sinkingTime >= 6.69);
  const paused = sim.player.sinkingTime;
  step(sim, 0);
  assert.equal(sim.player.sinkingTime, paused);
  assert.ok(dropCargo(sim));
  assert.ok(sim.player.weight <= sim.player.lift);
  assert.equal(sim.player.sinkingTime, 0);
  step(sim, 1);
  assert.equal(sim.outcome, 'sailing');

  const overload = quiet(createSimulation());
  overload.player.weight = 66;
  step(overload, 7.1);
  assert.equal(overload.outcome, 'defeat');
  assert.equal(overload.endReason, 'overloaded');
});

test('destroying the same hull twice cannot duplicate defeat credit or recovery modules', () => {
  const sim = createSimulation(), enemy = sim.enemies[0];
  damageModule(sim, enemy.id, 'root', 100);
  assert.equal(damageModule(sim, enemy.id, 'root', 100), false);
  assert.equal(sim.stats.kills, 1);
  assert.equal(sim.debris.length, 1);
  const ids = sim.debris.flatMap(b => b.modules.map(m => m.id));
  assert.equal(ids.length, new Set(ids).size);
});

test('real aimed bullets sever the connector while preserving a full-health cannon to recover', () => {
  const sim = quiet(createSimulation()), enemy = sim.enemies[0];
  sim.enemies = [enemy]; enemy.x = 0; enemy.z = 0; enemy.angle = 0;
  sim.player.x = 1.10375; sim.player.z = 18;
  const connector = get(enemy, 'connector');
  for (let frame = 0; frame < 180 && connector.hp > 0; frame++) {
    const target = moduleWorldPosition(enemy, connector);
    step(sim, 1 / 60, { fire: true, aimX: target.x, aimZ: target.z });
  }
  assert.equal(connector.hp, 0);
  assert.equal(get(enemy, 'cannon').hp, 32);
  assert.equal(enemy.hp, 64);
  assert.equal(sim.stats.hits, 3);
  const bundle = sim.debris[0];
  Object.assign(sim.player, { x: bundle.x, z: bundle.z });
  assert.ok(salvage(sim));
  assert.equal(sim.cargo[0].modules.find(m => m.key === 'cannon').hp, 32);
  Object.assign(sim.player, { x: 0, z: 48 });
  assert.ok(returnToHarbor(sim));
  assert.equal(sim.endReason, 'safe-retreat-with-cargo');
});

test('enemy fire cannot pass through its own hull, and a muzzle offset cannot skip a thin obstacle', () => {
  const sim = quiet(createSimulation()), enemy = sim.enemies[0];
  sim.enemies = [enemy]; enemy.x = 0; enemy.z = 0; enemy.angle = 0; enemy.cooldown = 0;
  sim.player.x = -12; sim.player.z = 0;
  step(sim, 0.1);
  assert.equal(enemy.telegraph, null);
  sim.player.x = 12;
  step(sim, 0.1);
  assert.ok(enemy.telegraph);

  const blocked = createSimulation({ obstacles: [{ x: 0, z: 31.7, radius: 0.1 }] });
  assert.equal(fire(blocked, { x: 0, z: -50 }), false);
  assert.equal(blocked.projectiles.length, 0);
  assert.equal(blocked.stats.shots, 0);
});
