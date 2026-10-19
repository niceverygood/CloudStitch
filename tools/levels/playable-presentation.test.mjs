import test from 'node:test';
import assert from 'node:assert/strict';
import { objectiveFor, selectContact, nextContact, edgeIndicator } from './playable-presentation.mjs';
const enemy = (id, x, z) => ({ id, x, z, name: id, defeated: false });
const sailing = () => ({ phase: 'sailing', stage: { phase: 'opening' }, sim: { player: { x: 0, z: 0 }, enemies: [enemy('a', 20, 0), enemy('b', 5, 0)], cargo: [], debris: [], harbor: { x: 0, z: 48, radius: 12 } } });
test('contact selection follows a living explicit target and recovers when it is gone', () => {
  const snapshot = sailing();
  assert.equal(selectContact(snapshot.sim, null).id, 'b'); assert.equal(selectContact(snapshot.sim, 'a').id, 'a');
  snapshot.sim.enemies[0].defeated = true; assert.equal(selectContact(snapshot.sim, 'a').id, 'b');
  assert.equal(nextContact(snapshot.sim, 'b'), 'b');
});
test('guidance prioritizes live debris then cargo return without changing any owner state', () => {
  const snapshot = sailing(); snapshot.sim.debris.push({ id: 'parts', x: 3, z: 4, remaining: 20 });
  const before = JSON.stringify(snapshot), salvage = objectiveFor(snapshot);
  assert.equal(salvage.action, 'salvage'); assert.equal(salvage.inRange, true); assert.equal(JSON.stringify(snapshot), before);
  snapshot.sim.cargo.push({ id: 'cargo' }); const returning = objectiveFor(snapshot); assert.equal(returning.action, 'return'); assert.equal(returning.inRange, false);
  snapshot.sim.player.z = 40; assert.equal(objectiveFor(snapshot).inRange, true);
});
test('maintenance and defeat do not offer ordinary fire or automatic return', () => {
  const snapshot = sailing(); snapshot.stage.phase = 'maintenance'; assert.equal(objectiveFor(snapshot).action, 'maintenance');
  snapshot.phase = 'defeat'; assert.equal(objectiveFor(snapshot).action, 'retry');
  snapshot.phase = 'harbor'; assert.equal(objectiveFor(snapshot).action, 'depart');
});
test('uncarried debris is still offered after the final enemy is disabled', () => {
  const snapshot=sailing();snapshot.sim.enemies=[];snapshot.stage.phase='victory';snapshot.sim.debris=[{id:'last-parts',x:4,z:0,remaining:10}];
  assert.equal(objectiveFor(snapshot).action,'salvage');snapshot.sim.cargo=[{id:'aboard'}];assert.equal(objectiveFor(snapshot).action,'return');
});
test('only a live attached connector enables connector aiming guidance', () => {
  const snapshot=sailing(),target=snapshot.sim.enemies[1];target.modules=[{key:'connector',attached:true,hp:24}];
  assert.match(objectiveFor(snapshot).title,/연결부/);target.modules[0].attached=false;assert.match(objectiveFor(snapshot).detail,/선체/);target.modules[0].attached=true;target.modules[0].hp=0;assert.match(objectiveFor(snapshot).detail,/선체/);
});
test('direction indicator clamps offscreen targets and hides for a visible target', () => {
  const right = edgeIndicator({ x: 2000, y: 450, depth: 0 }, 1440, 900, 56);
  assert.equal(right.visible, true); assert.equal(right.x, 1384); assert.equal(right.degrees, 90);
  const top = edgeIndicator({ x: 720, y: -1000, depth: 0 }, 1440, 900, 56);
  assert.ok(Math.abs(top.y - 56) < 1e-6); assert.equal(top.degrees, 0);
  assert.equal(edgeIndicator({ x: 720, y: 450, depth: 0 }, 1440, 900).visible, false);
});
