import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatFeedback, FEEDBACK_LIMITS } from './feedback.mjs';
import { createSimulation, fire, step, setEnemyIntent } from '../sim.mjs';

const shot = (seq = 1, extra = {}) => ({ type: 'player-fire', seq, generation: 1,
  projectileId: `shot-${seq}`, weaponId: '01-machine-gun', direction: { x: 3, y: 0, z: 4 }, ...extra });
const hit = (seq = 2, extra = {}) => ({ type: 'hit', seq, generation: 1, target: 'module', owner: 'player',
  projectileId: `shot-${seq}`, enemyId: 'enemy-1', moduleId: 'enemy-1:root', direction: { x: 1, y: 0, z: 0 }, ...extra });
const isZero = sample => {
  assert.deepEqual(sample.cameraOffset, { x: 0, y: 0, z: 0 });
  for (const key of ['roll', 'zoomKick', 'weaponRecoil', 'flash', 'playerFlash', 'hitFlash', 'activePulses']) assert.equal(sample[key], 0, key);
  assert.deepEqual(sample.recoilOffset, { x: 0, y: 0, z: 0 });
};
const withinLimits = sample => {
  assert.ok(Math.abs(sample.cameraOffset.x) <= FEEDBACK_LIMITS.cameraXZ);
  assert.ok(Math.abs(sample.cameraOffset.z) <= FEEDBACK_LIMITS.cameraXZ);
  assert.ok(Math.abs(sample.cameraOffset.y) <= FEEDBACK_LIMITS.cameraY);
  assert.ok(Math.abs(sample.roll) <= FEEDBACK_LIMITS.roll);
  assert.ok(sample.zoomKick >= 0 && sample.zoomKick <= FEEDBACK_LIMITS.zoomKick);
  assert.ok(sample.weaponRecoil >= 0 && sample.weaponRecoil <= FEEDBACK_LIMITS.weaponRecoil);
  assert.ok(Math.hypot(sample.recoilOffset.x, sample.recoilOffset.z) <= FEEDBACK_LIMITS.weaponRecoil + 1e-12);
  assert.ok(sample.flash >= 0 && sample.flash <= 1);
  assert.ok(sample.activePulses <= FEEDBACK_LIMITS.maxPulses);
};

test('fire has immediate directional recoil and cannon has a stronger kick', () => {
  const mg = createCombatFeedback(), cannon = createCombatFeedback();
  const a = mg.consume([shot()], 1), b = cannon.consume([shot(1, { weaponId: '02-deck-cannon' })], 1);
  assert.equal(a.weaponRecoil, .18); assert.equal(b.weaponRecoil, .32);
  assert.deepEqual(a.aimDirection, { x: .6, y: 0, z: .8 });
  assert.ok(a.recoilOffset.x < 0 && a.recoilOffset.z < 0);
  assert.ok(b.zoomKick > a.zoomKick); assert.equal(a.flash, 0);
});

test('only authoritative hit creates target-specific impact feedback', () => {
  const feedback = createCombatFeedback();
  feedback.consume([shot(), { seq: 2, type: 'projectile-ended', generation: 1 }], 1);
  assert.equal(feedback.sample().hitFlash, 0);
  const enemy = createCombatFeedback().consume([hit()], 1);
  const player = createCombatFeedback().consume([hit(2, { target: 'player', owner: 'enemy', moduleId: undefined })], 1);
  assert.equal(enemy.playerFlash, 0); assert.equal(enemy.hitFlash, .4);
  assert.equal(player.hitFlash, 0); assert.equal(player.playerFlash, .7);
  assert.ok(player.zoomKick > enemy.zoomKick);
  const hostileFire = createCombatFeedback().consume([shot(1, { type: 'enemy-fire' })], 1);
  isZero(hostileFire);
});

test('sequence and projectile receipts independently suppress duplicates', () => {
  const feedback = createCombatFeedback();
  feedback.consume([hit(2), shot(1), shot(1), hit(2)], 1);
  assert.equal(feedback.debug().fires, 1); assert.equal(feedback.debug().hits, 1);
  feedback.consume([shot(3, { projectileId: 'shot-1' }), hit(4, { projectileId: 'shot-2' })], 1);
  assert.equal(feedback.debug().activePulses, 2); assert.equal(feedback.debug().duplicateShots, 2);
  feedback.consume([shot(), hit()], 1); assert.equal(feedback.debug().activePulses, 2);
});

test('generation guard precedes cursor and retry permits reused seq/shot IDs', () => {
  const feedback = createCombatFeedback();
  feedback.consume([shot()], 1); feedback.reset(2);
  feedback.consume([shot(999999, { generation: 1 }), shot(1, { generation: 2 })], 2);
  assert.equal(feedback.debug().sequence, 1); assert.equal(feedback.debug().fires, 1);
  const before = feedback.sample(); feedback.consume([hit(9)], 1);
  assert.deepEqual(feedback.sample(), before); assert.equal(feedback.debug().generation, 2);
  feedback.consume([hit(2, { generation: 3 })], 3);
  assert.equal(feedback.debug().fires, 0); assert.equal(feedback.debug().hits, 1);
});

test('dt zero and repeated renders freeze feedback exactly', () => {
  const feedback = createCombatFeedback(); feedback.consume([shot(), hit()], 1); feedback.update(.037);
  const frozen = feedback.sample();
  for (let i = 0; i < 100; i += 1) { assert.deepEqual(feedback.update(0), frozen); assert.deepEqual(feedback.sample(), frozen); }
  assert.equal(feedback.debug().oldestAge, .037);
});

test('all feedback decays to exact zero within .34 simulation seconds', () => {
  const feedback = createCombatFeedback();
  feedback.consume([shot(), hit(2, { target: 'player' })], 1);
  for (let i = 0; i < 34; i += 1) withinLimits(feedback.update(.01));
  isZero(feedback.sample()); assert.equal(feedback.debug().oldestAge, 0);
});

test('clear resets live pulses without resetting generation/cursor; defeat stops until reset', () => {
  const feedback = createCombatFeedback(); feedback.consume([shot()], 1);
  isZero(feedback.consume([{ seq: 2, generation: 1, type: 'combat-cleared' }], 1));
  assert.equal(feedback.debug().generation, 1); assert.equal(feedback.debug().sequence, 2);
  feedback.consume([shot(3)], 1); assert.equal(feedback.sample().activePulses, 1);
  feedback.consume([{ seq: 4, generation: 1, type: 'defeat' }, shot(5)], 1); isZero(feedback.sample());
  assert.equal(feedback.debug().stopped, true);
  feedback.reset(2); feedback.consume([shot(1, { generation: 2 })], 2); assert.equal(feedback.sample().activePulses, 1);
});

test('replayed clears cannot erase later feedback and stale terminal events cannot poison seq', () => {
  const feedback = createCombatFeedback();
  const clear = { seq: 2, generation: 1, type: 'combat-cleared' };
  feedback.consume([shot(), clear, shot(3)], 1);
  const live = feedback.sample(); feedback.consume([clear], 1);
  assert.deepEqual(feedback.sample(), live); assert.equal(feedback.debug().clears, 1);
  feedback.reset(2);
  feedback.consume([{ seq: 999999, generation: 1, type: 'defeat' }, shot(1, { generation: 2 })], 2);
  assert.equal(feedback.debug().sequence, 1); assert.equal(feedback.debug().stopped, false);
  assert.equal(feedback.debug().fires, 1); assert.equal(feedback.debug().activePulses, 1);
});

test('storm of unique fire and hit stays bounded in memory and display amplitude', () => {
  const feedback = createCombatFeedback();
  for (let seq = 1; seq <= 5000; seq += 1) {
    feedback.consume([shot(seq * 2 - 1), hit(seq * 2, { target: 'player' })], 1);
    withinLimits(feedback.update(seq % 30 ? 0 : .001));
  }
  const debug = feedback.debug();
  assert.equal(debug.fires, 5000); assert.equal(debug.hits, 5000);
  assert.equal(debug.peakPulses, 32); assert.ok(debug.droppedPulses > 9900);
  assert.equal(debug.fireReceipts, 2048); assert.equal(debug.hitReceipts, 2048);
  isZero(feedback.update(1));
});

test('reduced motion disables camera/roll/zoom and restrains recoil and flash', () => {
  const normal = createCombatFeedback(), reduced = createCombatFeedback({ reducedMotion: true });
  const a = normal.consume([shot(), hit(2, { target: 'player' })], 1);
  const b = reduced.consume([shot(), hit(2, { target: 'player' })], 1);
  assert.deepEqual(b.cameraOffset, { x: 0, y: 0, z: 0 }); assert.equal(b.roll, 0); assert.equal(b.zoomKick, 0);
  assert.equal(b.weaponRecoil, a.weaponRecoil * .35); assert.equal(b.flash, a.flash * .35);
  isZero(reduced.update(.35));
});

test('samples/debug are detached values and controller never mutates frozen event data', () => {
  const event = shot(); Object.freeze(event.direction); Object.freeze(event);
  const events = Object.freeze([event]); const encoded = JSON.stringify(events);
  const feedback = createCombatFeedback(); feedback.consume(events, 1);
  const sample = feedback.sample(); sample.aimDirection.x = 900; sample.cameraOffset.y = 900;
  const debug = feedback.debug(); debug.limits.maxPulses = 900;
  assert.equal(JSON.stringify(events), encoded); assert.equal(feedback.sample().aimDirection.x, .6);
  assert.equal(feedback.debug().limits.maxPulses, 32);
});

test('actual simulation events are consumed read-only and do not alter hit/damage/travel', () => {
  const sim = createSimulation({ playerSpawn: { x: 0, z: 0 }, enemySpawns: [{ id: 'target', assetId: 'enemy-pirate-scout', x: 0, z: 15 }] });
  setEnemyIntent(sim, 'target', { move: { x: 0, z: 0 }, attackTarget: null });
  const feedback = createCombatFeedback(); fire(sim, { x: 0, z: 15 });
  const fired = JSON.stringify(sim); feedback.consume(sim.events, 1);
  assert.equal(JSON.stringify(sim), fired); assert.equal(feedback.debug().fires, 1);
  for (let i = 0; i < 60 && !sim.events.some(event => event.type === 'hit'); i += 1) step(sim, 1 / 60);
  const hitEvent = sim.events.find(event => event.type === 'hit'); assert.equal(hitEvent?.target, 'module');
  const collided = JSON.stringify(sim); feedback.consume(sim.events, 1); feedback.update(1 / 60);
  assert.equal(JSON.stringify(sim), collided); assert.equal(feedback.debug().hits, 1);
  assert.equal(sim.stats.shots, 1); assert.equal(sim.stats.hits, 1);
  const damaged = sim.enemies[0].modules.find(module => module.id === hitEvent.moduleId);
  assert.equal(damaged.hp, damaged.maxHp - 8);
});

test('invalid input is rejected or skipped without poisoning cursor', () => {
  const feedback = createCombatFeedback();
  for (const dt of [-1, NaN, Infinity]) assert.throws(() => feedback.update(dt), /dt/);
  assert.throws(() => feedback.consume({}, 1), /array/); assert.throws(() => feedback.reset(-1), /generation/);
  assert.throws(() => feedback.consume([], NaN), /generation/);
  feedback.consume([null, { seq: 999, generation: NaN }, shot(1)], 1);
  assert.equal(feedback.debug().sequence, 1); assert.equal(feedback.debug().invalidEvents, 2);
  withinLimits(feedback.consume([shot(2, { direction: { x: Infinity, z: NaN } })], 1));
});
