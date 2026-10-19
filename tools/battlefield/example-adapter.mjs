/** Independent headless adapter example. Socket data here is a labelled fixture. */
import assert from 'node:assert/strict';
import { createBattlefieldAdapter } from './integration.mjs';
import { moduleWorldPosition } from './sim.mjs';

const battle = createBattlefieldAdapter({
  world: { playerSpawn: { x: 1.10375, z: 18 }, harbor: { x: 0, z: 48, radius: 12 } },
  enemySpawns: [{ id: 'example-tax', assetId: 'enemy-tax-cutter', x: 0, z: 0 }],
  muzzleResolver: ({ player, target }) => {
    const length = Math.hypot(target.x - player.x, target.z - player.z);
    const direction = { x: (target.x - player.x) / length, y: 0, z: (target.z - player.z) / length };
    return { position: { x: player.x + direction.x * 3.8, y: 1.3, z: player.z + direction.z * 3.8 }, direction, source: 'example-fixture-not-rig-socket' };
  },
});
battle.dispatch({ id: 'idle-example', type: 'intent', enemyId: 'example-tax', intent: { move: { x: 0, z: 0 }, attackTarget: null } });
const events = [], enemy = battle.state.enemies[0];
const connector = enemy.modules.find(m => m.key === 'connector');
for (let frame = 0; frame < 180 && connector.hp > 0; frame++) {
  const target = moduleWorldPosition(enemy, connector);
  battle.advance(1 / 60, { fire: true, aimX: target.x, aimZ: target.z });
  events.push(...battle.drainEvents());
}
assert.equal(connector.hp, 0);
assert.equal(battle.state.debris.length, 1);
assert.equal(enemy.modules.find(m => m.key === 'cannon').hp, 32);
const bundle = battle.state.debris[0];
// Fixture teleport only positions the next integration boundary; it is not user flight QA.
battle.dispatch({ id: 'fixture-at-bundle', type: 'world', world: { playerSpawn: { x: bundle.x, z: bundle.z } } });
assert.equal(battle.dispatch({ id: 'recover', type: 'salvage' }).ok, true);
battle.dispatch({ id: 'fixture-at-harbor', type: 'world', world: { playerSpawn: { x: 0, z: 48 } } });
assert.equal(battle.dispatch({ id: 'return', type: 'return' }).ok, true);
const returned = battle.snapshot();
assert.equal(returned.outcome, 'victory');
battle.depart({ loadout: { hp: 100, maxHp: 100, baseWeight: 50, lift: 65, powerOutput: 14, powerDraw: 10, scrap: 30 } });
assert.equal(battle.state.outcome, 'sailing');
assert.equal(battle.state.cargo.length, 0);
console.log(JSON.stringify({ version: returned.version, fixture: 'headless socket and boundary positions; no browser QA', hits: returned.stats.hits, recovered: returned.stats.recovered, endReason: returned.endReason, eventTypes: [...new Set(events.map(e => e.type))], nextGeneration: battle.generation }, null, 2));
