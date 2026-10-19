import { createBattlefieldAdapter } from '../battlefield/integration.mjs';
import { CONFIG, fire } from '../battlefield/sim.mjs';

const DT = .01;
const copy = value => JSON.parse(JSON.stringify(value));
const round = value => Math.round(value * 1e10) / 1e10;
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const vector = value => value && value.length === 3 && value.every(Number.isFinite);
const module = (key, parentId, z, hp, radius) => ({
  id: `review-${key}`, key, parentId, type: key === 'root' ? 'hull' : 'cannon',
  localX: 0, localZ: z, radius, weight: 0, hp, maxHp: hp,
});

/** Record the existing battlefield authority once; both A/B renderers read it.
 * The cannon is an enemy training actor mapped onto the review ship. This does
 * not add a player cannon, projectile controller, collider or damage rule. */
export function makeTape({ weapon, muzzle, miss = false } = {}) {
  if (!['cannon', 'machinegun'].includes(weapon)) throw new TypeError('Unknown comparison weapon');
  if (!vector(muzzle?.position) || !vector(muzzle?.direction)) throw new TypeError('Finite XYZ muzzle arrays required');
  const planar = Math.hypot(muzzle.direction[0], muzzle.direction[2]);
  if (planar < 1e-8 || Math.abs(muzzle.direction[1]) > 1e-7) throw new TypeError('Battlefield authority requires a planar muzzle direction');
  const direction = [muzzle.direction[0] / planar, 0, muzzle.direction[2] / planar];
  const cannon = weapon === 'cannon', lateral = miss ? 10 : 0, distance = 24;
  // Canonical +Z training lane is rigidly mapped onto the displayed muzzle.
  const origin = cannon ? [0, 1.3, 4] : [0, 1.3, 0];
  const position = p => {
    const x = p.x - origin[0], z = p.z - origin[2];
    return [muzzle.position[0] + direction[2] * x + direction[0] * z,
      muzzle.position[1] + (p.y ?? 1.3) - origin[1],
      muzzle.position[2] - direction[0] * x + direction[2] * z];
  };
  const rotate = v => [direction[2] * v.x + direction[0] * v.z, v.y || 0, -direction[0] * v.x + direction[2] * v.z];
  const targetCanonical = { x: lateral, y: 1.3, z: origin[2] + distance };
  const actor = cannon ? {
    id: 'review-cannon-actor', assetId: 'review-cannon-training', x: 0, z: 0,
    modules: [module('root', null, 0, 64, 1.7), module('cannon', 'review-root', 4, 32, .65)],
  } : {
    id: 'review-target', assetId: 'review-training-hull', x: lateral, z: distance,
    modules: [module('root', null, 0, 100000, 3)],
  };
  const adapter = createBattlefieldAdapter({
    world: { obstacles: [], harbor: { x: 70, z: 70, radius: 2 },
      playerSpawn: cannon ? { x: lateral, z: origin[2] + distance } : { x: 0, z: -5 } },
    enemySpawns: [actor],
    muzzleResolver: () => ({ position: { x: 0, y: 1.3, z: 0 }, direction: { x: 0, y: 0, z: 1 }, source: 'comparison-fixed-mount' }),
  });
  let commandId = 0;
  const intent = attackTarget => {
    const result = adapter.dispatch({ id: `range-intent-${++commandId}`, type: 'intent', enemyId: actor.id,
      intent: { move: { x: 0, z: 0 }, attackTarget } });
    if (!result.ok) throw new Error(result.reason || 'Training intent rejected');
  };
  intent(cannon ? { x: 0, z: origin[2] + distance } : null);
  adapter.drainEvents();
  const rawEvents = [], rawFrames = [];
  const record = () => {
    rawEvents.push(...adapter.drainEvents());
    rawFrames.push({ time: adapter.state.time, projectiles: adapter.state.projectiles.map(p => ({
      id: p.id, position: position(p), direction: rotate({ x: p.vx / Math.hypot(p.vx, p.vz), y: 0, z: p.vz / Math.hypot(p.vx, p.vz) }),
    })) });
  };
  let offset = 0;
  if (cannon) {
    // Let the original 1.2 s cooldown and 1.3 s enemy telegraph issue the shot.
    while (!rawEvents.some(e => e.type === 'enemy-fire') && adapter.state.time < 4) {
      adapter.advance(DT); record();
    }
    const first = rawEvents.find(e => e.type === 'enemy-fire');
    if (!first) throw new Error('Existing enemy cannon authority did not fire');
    offset = first.time;
    intent(null); // Existing intent API prevents a second training shot.
  } else {
    // Original authority issues the first shot at t=0, then .22 cooldown governs
    // every subsequent held-fire tick, including the tenth shot at t=1.98.
    if (!fire(adapter.state, { x: 0, z: distance })) throw new Error('Existing machinegun authority did not fire');
    record();
  }
  const duration = cannon ? (miss ? 8.8 : 5.5) : 5.5;
  while (adapter.state.time - offset < duration - 1e-8) {
    const next = round(adapter.state.time + DT);
    adapter.advance(DT, { fire: !cannon && next < 2 - 1e-8, aimX: 0, aimZ: distance }); record();
  }
  const events = rawEvents.filter(e => ['player-fire', 'enemy-fire', 'hit'].includes(e.type)).map(e => ({
    type: e.type === 'hit' ? 'hit' : 'fire', time: round(e.time - offset), id: e.projectileId,
    position: position(e), direction: rotate(e.direction), normal: e.normal ? rotate(e.normal) : null,
    authorityType: e.type, weaponId: e.weaponId, target: e.target || null,
  }));
  const frames = rawFrames.filter(f => f.time >= offset - 1e-8).map(f => ({ ...f, time: round(f.time - offset) }));
  const stats = {
    shots: events.filter(e => e.type === 'fire').length, hits: events.filter(e => e.type === 'hit').length,
    damage: cannon ? adapter.state.stats.damageTaken : actor.modules[0].hp - adapter.state.enemies[0].hp,
    damagePerShot: cannon ? CONFIG.enemyDamage : CONFIG.playerDamage, burstDuration: cannon ? 0 : 2,
    cooldown: cannon ? null : CONFIG.playerCooldown, finalProjectiles: adapter.state.projectiles.length,
    finalTargetHp: cannon ? adapter.state.player.hp : adapter.state.enemies[0].hp,
  };
  const authority = {
    source: 'tools/battlefield/sim.mjs + integration.mjs', version: adapter.state.prototype.integrationVersion,
    projectileMovement: 'existing-authority-snapshots', collision: 'existing-swept-circle',
    actorRole: cannon ? 'enemy-cannon-training-actor-mapped-to-review-ship' : 'player-machinegun',
    targetRole: cannon ? 'existing-player-proxy-mapped-to-training-target' : 'explicit-high-HP-training-hull',
    targetSetup: cannon ? 'Original player radius3 HP100, existing enemyDamage9' : 'Review hull radius3 HP100000, existing playerDamage8',
    canonicalMuzzle: origin, timeOffset: offset, frameInterval: DT,
    fireWindow: cannon ? 'single actual enemy-fire; subsequent attacks disabled with intent API' : '[0,2) seconds held fire',
    displayTransform: { origin, muzzle: copy(muzzle.position), direction },
    limits: ['Planar prototype collision; displayed target art is not a GLB mesh collider',
      'Cannon is the existing slow enemy training pattern, not a player cannon implementation',
      'Frame sampling uses recorded authority positions without a second projectile integration'],
  };
  freeze(events); freeze(frames); freeze(stats); freeze(authority);
  // Hold the most recent authority snapshot. No invented between-tick flight.
  function sample(time) {
    if (!Number.isFinite(time)) throw new TypeError('Finite sample time required');
    const t = Math.max(0, Math.min(duration, time));
    let lo = 0, hi = frames.length - 1;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (frames[mid].time <= t + 1e-10) lo = mid; else hi = mid - 1; }
    return copy(frames[lo]);
  }
  return Object.freeze({ duration, events, frames, sample, stats, authority,
    target: freeze({ position: position(targetCanonical), radius: 3 }),
  });
}
