/** Headless contract regression over the sole battlefield sim, not a browser
 * voyage or human playtest. Fixture spawns are explicit; no forced damage/kills.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, spawnEnemy, setEnemyIntent, step } from '../battlefield/sim.mjs';
import { allocateAttackTokens } from './attack-budget.mjs';

function fixture(count = 2) {
  const sim = createSimulation({ enemySpawns: [] });
  for (let index = 0; index < count; index++) spawnEnemy(sim, { id: `budget-${index}`, assetId: 'enemy-pirate-scout', name: '예산 검사 정찰선', x: index % 2 ? 20 : -20, z: -10 - index * 3 });
  return sim;
}

test('host cooldown advances exactly in battlefield while attack admission is withheld', () => {
  const sim = fixture(1), enemy = sim.enemies[0], before = enemy.cooldown;
  setEnemyIntent(sim, enemy.id, { move: { x: 0, z: 0 }, attackTarget: null });
  step(sim, .1);
  assert(Math.abs(enemy.cooldown - (before - .1)) < 1e-8, 'Cooldown must tick in battlefield before target-null early return');
  assert.equal(enemy.telegraph, null);
});

for (const maxTokens of [1, 2]) {
  test(`sole-sim policy enforces ${maxTokens} warning slots and both attackers actually fire`, () => {
    const sim = fixture(2); let peak = 0;
    for (let index = 0; index < 480; index++) {
      const budget = allocateAttackTokens({ units: sim.enemies.filter(enemy => !enemy.defeated).map(enemy => ({ enemyId: enemy.id, warningActive: Boolean(enemy.telegraph), ready: enemy.cooldown <= 1e-8 })), maxTokens });
      const permitted = new Set(budget.permittedEnemyIds);
      for (const enemy of sim.enemies) setEnemyIntent(sim, enemy.id, { move: { x: 0, z: 0 }, attackTarget: permitted.has(enemy.id) ? { x: sim.player.x, z: sim.player.z } : null });
      step(sim, 1 / 60);
      const warnings = sim.enemies.filter(enemy => !enemy.defeated && enemy.telegraph).length;
      peak = Math.max(peak, warnings); assert(warnings <= maxTokens);
      assert.equal(sim.outcome, 'sailing');
    }
    assert.equal(peak, maxTokens);
    assert.equal(new Set(sim.events.filter(event => event.type === 'enemy-fire').map(event => event.enemyId)).size, 2, 'Admission must not freeze both initial cooldowns or starve an attacker');
  });
}
