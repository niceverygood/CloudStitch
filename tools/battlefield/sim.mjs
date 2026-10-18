/**
 * Cloudstitch local battlefield rules. No engine, campaign, save or final balance.
 * Structure follows references 19 / 65 / 112; distances, collider shapes and
 * enemy layouts here are deliberately provisional gameplay units.
 */
export const CONFIG = Object.freeze({
  bounds: 90,
  playerRadius: 3,
  playerSpeed: 14,
  boostSpeed: 23,
  playerCooldown: 0.22,
  playerDamage: 8,
  playerProjectileSpeed: 45,
  enemyProjectileSpeed: 17,
  enemyDamage: 9,
  enemyTelegraph: 1.3,
  salvageRadius: 10,
  sinkingGrace: 7,
  debrisLifetime: 95,
  integrationStep: 1 / 60,
});

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const wrapAngle = (angle) => ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;

function event(sim, type, data = {}) {
  const seq = ++sim.eventSeq;
  const entry = { id: seq, seq, time: sim.time, type, ...data };
  sim.events.push(entry);
  if (sim.events.length > 200) sim.events.shift();
  return entry;
}

function createEnemy(id, assetId, name, x, z, index) {
  // Centers read from fleet geometry normalized to a provisional length of 10.
  // Each collider remains a simplified planar proxy rather than authored GLB
  // collision. The tax cutter alone owns the real severable side-deck tree.
  const isTax = assetId === 'enemy-tax-cutter';
  const isScout = assetId === 'enemy-pirate-scout';
  const definitions = isTax ? [
    ['root', null, 'hull', '핵심 선체', 64, -1.1027, 0.1725, 1.6, 0],
    ['connector', 'root', 'connector', '연결 골조', 24, 1.10375, 0.1725, 0.37, 1],
    ['deck', 'connector', 'deck', '외부 갑판', 40, 2.0199, 0.1725, 0.4, 2],
    ['cannon', 'deck', 'cannon', '함포', 32, 1.595, 0.5543, 0.32, 3],
    ['engine', 'deck', 'engine', '보조 엔진', 32, 1.3838, -0.9555, 0.48, 2],
    ['aux-balloon', 'deck', 'balloon', '보조 기낭', 24, 2.1344, 0.1725, 0.35, 1],
    ['balloon', 'root', 'balloon', '주 기낭', 48, -1.9219, 0.1725, 0.8, 2],
    ['main-engine', 'root', 'engine', '기본 엔진', 32, -1.9892, -4.2537, 0.65, 2],
  ] : [
    ['root', null, 'hull', '핵심 선체', 64, isScout ? 0.2259 : 0.0498, isScout ? 0.27 : 0.1094, 1.7, 0],
    ['cannon', 'root', isScout ? 'machinegun' : 'harpoon', isScout ? '기관총' : '작살 장치', 32, isScout ? 0.2259 : 0.0498, isScout ? 3.2353 : 3.172, 0.65, 3],
    ['balloon', 'root', 'balloon', '주 기낭', 48, isScout ? 0.2259 : 0.0498, isScout ? 0.27 : 0.1094, 1.2, 2],
    ['main-engine', 'root', 'engine', '기본 엔진', 32, isScout ? 0.241 : 0.061, isScout ? -4.1202 : -4.351, 0.7, 2],
  ];
  return {
    id, assetId, name, x, z, spawnX: x, spawnZ: z, vx: 0, vz: 0,
    angle: 0, radius: 3.7, hp: 64, maxHp: 64, defeated: false,
    layout: isTax ? 'side-deck-tree' : 'direct-hull-modules',
    cooldown: 1.2 + index * 0.9, telegraph: null, phase: index * 1.7,
    modules: definitions.map(([key, parent, type, label, hp, localX, localZ, radius, weight]) => ({
      id: `${id}:${key}`, key, parentId: parent ? `${id}:${parent}` : null,
      type, name: label, hp, maxHp: hp, localX, localZ, radius, weight,
      attached: true, detached: false, destroyed: false,
      owner: id, source: { enemyId: id, assetId },
    })),
  };
}

export function createSimulation({ obstacles = [] } = {}) {
  return {
    time: 0, outcome: 'sailing', endReason: null, eventSeq: 0, nextId: 0,
    prototype: {
      version: 'battlefield-v1',
      status: 'Local combat prototype; not final game balance or a campaign.',
      units: 'Provisional planar gameplay units; not fleet-kit metres.',
      sourceRules: ['19', '21', '50', '65', '112'],
      limits: ['Simplified hit circles', 'Cargo only; no auto attachment', 'No persistent save',
        'Union paired engines and balloons share aggregate proxies',
        'Enemy weapons use slow training projectiles rather than final weapon-specific effects'],
    },
    player: {
      id: 'player', assetId: 'player-homeward', name: '귀환호',
      x: 0, z: 35, vx: 0, vz: 0, angle: Math.PI, radius: CONFIG.playerRadius,
      hp: 100, maxHp: 100, cooldown: 0, aimX: 0, aimZ: -20,
      baseWeight: 50, cargoWeight: 0, weight: 50, lift: 65,
      boostCharge: 100, maxBoostCharge: 100, sinkingTime: 0, boosting: false,
      weapon: 'machinegun',
    },
    enemies: [
      createEnemy('tax-1', 'enemy-tax-cutter', '녹슨 징세정', -28, -12, 0),
      createEnemy('scout-1', 'enemy-pirate-scout', '해적 정찰선', 28, -27, 1),
      createEnemy('salvager-1', 'enemy-union-salvage', '연합 인양선', 5, -52, 2),
    ],
    obstacles: obstacles.filter(o => Number.isFinite(o.x) && Number.isFinite(o.z) && o.radius > 0)
      .map(o => ({ x: o.x, z: o.z, radius: o.radius })),
    harbor: { x: 0, z: 48, radius: 12 },
    projectiles: [], debris: [], cargo: [], events: [],
    stats: { shots: 0, hits: 0, kills: 0, recovered: 0, damageTaken: 0, cargoDropped: 0 },
  };
}

/** Model-independent hit marker: local axes rotate with the enemy heading. */
export function moduleWorldPosition(enemy, module) {
  const c = Math.cos(enemy.angle), s = Math.sin(enemy.angle);
  return {
    x: enemy.x + module.localX * c + module.localZ * s,
    z: enemy.z - module.localX * s + module.localZ * c,
  };
}

function aliveModule(enemy, key) {
  return enemy.modules.find(m => m.key === key && m.attached && m.hp > 0);
}

function makeBundle(sim, enemy, modules, at) {
  if (!modules.length) return null;
  const bundle = {
    id: `bundle-${++sim.nextId}`, enemyId: enemy.id,
    source: { enemyId: enemy.id, assetId: enemy.assetId, name: enemy.name },
    owner: enemy.id, x: at.x, z: at.z, angle: enemy.angle,
    modules: modules.map(m => ({ ...m, source: { ...m.source } })),
    weight: modules.reduce((sum, m) => sum + m.weight, 0),
    remaining: CONFIG.debrisLifetime, salvaged: false, lost: false,
  };
  sim.debris.push(bundle);
  event(sim, 'bundle-detached', { x: at.x, z: at.z, bundleId: bundle.id, enemyId: enemy.id, moduleIds: modules.map(m => m.id) });
  return bundle;
}

/** Damage never leaks into hull HP; only descendants of the broken part detach. */
export function damageModule(sim, enemyId, moduleId, damage) {
  if (sim.outcome !== 'sailing' || !Number.isFinite(damage) || damage <= 0) return false;
  const enemy = sim.enemies.find(e => e.id === enemyId);
  const module = enemy?.modules.find(m => m.id === moduleId || m.key === moduleId);
  if (!enemy || enemy.defeated || !module?.attached || module.hp <= 0) return false;
  module.hp = Math.max(0, module.hp - damage);
  if (module.key === 'root') enemy.hp = module.hp;
  if (module.hp > 0) return true;

  const at = moduleWorldPosition(enemy, module);
  event(sim, 'module-destroyed', { ...at, enemyId, moduleId: module.id, moduleType: module.type });
  const descendants = new Set([module.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const child of enemy.modules) {
      if (child.attached && descendants.has(child.parentId) && !descendants.has(child.id)) {
        descendants.add(child.id);
        grew = true;
      }
    }
  }
  const detached = enemy.modules.filter(m => m.attached && m.hp > 0 && descendants.has(m.id));
  for (const m of enemy.modules) if (descendants.has(m.id)) {
    m.attached = false;
    m.detached = m.hp > 0;
    m.destroyed = m.hp <= 0;
  }
  makeBundle(sim, enemy, detached, at);
  if (!aliveModule(enemy, 'cannon')) enemy.telegraph = null;
  if (module.key === 'root') {
    enemy.defeated = true;
    enemy.vx = 0; enemy.vz = 0;
    sim.stats.kills += 1;
    event(sim, 'enemy-defeated', { x: enemy.x, z: enemy.z, enemyId });
  }
  return true;
}

export function fire(sim, target = {}) {
  const p = sim.player;
  if (sim.outcome !== 'sailing' || p.hp <= 0 || p.cooldown > 1e-8) return false;
  const x = finite(target.x, p.aimX), z = finite(target.z, p.aimZ);
  let dx = x - p.x, dz = z - p.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.01) return false;
  dx /= length; dz /= length;
  p.aimX = x; p.aimZ = z;
  const muzzleX = p.x + dx * 3.8, muzzleZ = p.z + dz * 3.8;
  // The provisional muzzle is outside the player's core collider. Do not let
  // its offset skip a thin obstacle between the hull and that muzzle.
  if (sim.obstacles.some(o => segmentCircleT(p.x, p.z, muzzleX, muzzleZ, o.x, o.z, o.radius) !== null)) {
    p.cooldown = CONFIG.playerCooldown;
    return false;
  }
  const projectile = {
    id: `shot-${++sim.nextId}`, owner: 'player',
    x: muzzleX, z: muzzleZ, prevX: muzzleX, prevZ: muzzleZ,
    vx: dx * CONFIG.playerProjectileSpeed, vz: dz * CONFIG.playerProjectileSpeed,
    damage: CONFIG.playerDamage, radius: 0.1, ttl: 3.6,
  };
  sim.projectiles.push(projectile);
  p.cooldown = CONFIG.playerCooldown;
  sim.stats.shots += 1;
  event(sim, 'player-fire', { x: projectile.x, z: projectile.z, projectileId: projectile.id });
  return projectile;
}

/** Immediate completed winch action. It changes ownership, never equips parts. */
export function salvage(sim) {
  if (sim.outcome !== 'sailing') return false;
  const nearby = sim.debris.filter(b => !b.salvaged && !b.lost && b.remaining > 0 && distance(sim.player, b) <= CONFIG.salvageRadius);
  nearby.sort((a, b) => distance(sim.player, a) - distance(sim.player, b));
  const bundle = nearby[0];
  if (!bundle) return false;
  bundle.salvaged = true;
  bundle.owner = 'player';
  for (const module of bundle.modules) module.owner = 'player';
  sim.cargo.push({ ...bundle, modules: bundle.modules.map(m => ({ ...m, source: { ...m.source } })), status: 'cargo' });
  for (const enemy of sim.enemies) for (const module of enemy.modules) {
    if (bundle.modules.some(m => m.id === module.id)) module.owner = 'player';
  }
  if (!bundle.previouslyRecovered) sim.stats.recovered += 1;
  bundle.previouslyRecovered = true;
  sim.cargo.at(-1).previouslyRecovered = true;
  updateWeight(sim);
  event(sim, 'salvaged', { x: bundle.x, z: bundle.z, bundleId: bundle.id, weight: bundle.weight });
  return sim.cargo.at(-1);
}

/** Release the last cargo bundle; same identity and no second recovery reward. */
export function dropCargo(sim) {
  if (sim.outcome !== 'sailing' || !sim.cargo.length) return false;
  const cargo = sim.cargo.pop();
  let bundle = sim.debris.find(b => b.id === cargo.id);
  if (!bundle) { bundle = cargo; sim.debris.push(bundle); }
  Object.assign(bundle, cargo, {
    x: sim.player.x + 6, z: sim.player.z, salvaged: false, lost: false,
    remaining: CONFIG.debrisLifetime, previouslyRecovered: true,
  });
  sim.stats.cargoDropped += 1;
  updateWeight(sim);
  event(sim, 'cargo-dropped', { x: bundle.x, z: bundle.z, bundleId: bundle.id });
  return bundle;
}

export function returnToHarbor(sim) {
  if (sim.outcome !== 'sailing' || distance(sim.player, sim.harbor) > sim.harbor.radius) return false;
  const cleared = sim.enemies.every(e => e.defeated);
  if (!sim.cargo.length && !cleared) return false;
  sim.outcome = 'victory';
  sim.endReason = cleared ? 'battle-cleared' : 'safe-retreat-with-cargo';
  sim.player.vx = 0; sim.player.vz = 0;
  event(sim, 'victory', { x: sim.player.x, z: sim.player.z, reason: sim.endReason, recovered: sim.cargo.length });
  return true;
}

function updateWeight(sim) {
  sim.player.cargoWeight = sim.cargo.reduce((sum, b) => sum + b.weight, 0);
  sim.player.weight = sim.player.baseWeight + sim.player.cargoWeight;
  if (sim.player.weight <= sim.player.lift) sim.player.sinkingTime = 0;
}

function resolveCollision(body, obstacles, radius) {
  const limit = CONFIG.bounds - radius;
  for (let pass = 0; pass < 4; pass++) {
    body.x = clamp(body.x, -limit, limit);
    body.z = clamp(body.z, -limit, limit);
    for (const o of obstacles) {
      let dx = body.x - o.x, dz = body.z - o.z;
      const d = Math.hypot(dx, dz), total = radius + o.radius;
      if (d >= total) continue;
      if (d < 1e-8) { dx = 1; dz = 0; }
      else { dx /= d; dz /= d; }
      body.x = o.x + dx * total;
      body.z = o.z + dz * total;
      const inward = body.vx * dx + body.vz * dz;
      if (inward < 0) { body.vx -= inward * dx; body.vz -= inward * dz; }
    }
  }
  body.x = clamp(body.x, -limit, limit);
  body.z = clamp(body.z, -limit, limit);
}

/** Earliest swept segment hit, including a projectile that starts inside. */
export function segmentCircleT(x0, z0, x1, z1, cx, cz, radius) {
  const dx = x1 - x0, dz = z1 - z0, fx = x0 - cx, fz = z0 - cz;
  const c = fx * fx + fz * fz - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dz * dz;
  if (a < 1e-16) return null;
  const b = 2 * (fx * dx + fz * dz), discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

function updateProjectiles(sim, dt) {
  const surviving = [];
  for (const shot of sim.projectiles) {
    const x0 = shot.x, z0 = shot.z;
    const x1 = x0 + shot.vx * dt, z1 = z0 + shot.vz * dt;
    let hit = null, hitT = Infinity;
    const consider = (target, radius, data) => {
      const t = segmentCircleT(x0, z0, x1, z1, target.x, target.z, radius + (shot.radius || 0));
      if (t !== null && t < hitT) { hitT = t; hit = data; }
    };
    for (const obstacle of sim.obstacles) consider(obstacle, obstacle.radius, { type: 'obstacle' });
    if (shot.owner === 'player') {
      for (const enemy of sim.enemies) {
        if (enemy.defeated) continue;
        for (const module of enemy.modules) {
          if (module.attached && module.hp > 0) consider(moduleWorldPosition(enemy, module), module.radius, { type: 'module', enemy, module });
        }
      }
    } else consider(sim.player, sim.player.radius, { type: 'player' });
    if (hit) {
      shot.x = x0 + (x1 - x0) * hitT;
      shot.z = z0 + (z1 - z0) * hitT;
      event(sim, 'hit', { x: shot.x, z: shot.z, owner: shot.owner, target: hit.type, enemyId: hit.enemy?.id, moduleId: hit.module?.id });
      if (hit.type === 'module') {
        sim.stats.hits += 1;
        damageModule(sim, hit.enemy.id, hit.module.id, shot.damage);
      } else if (hit.type === 'player') {
        const damage = Math.min(sim.player.hp, shot.damage);
        sim.player.hp -= damage;
        sim.stats.damageTaken += damage;
      }
    } else {
      shot.prevX = x0; shot.prevZ = z0; shot.x = x1; shot.z = z1;
      shot.ttl -= dt;
      if (shot.ttl > 0 && Math.abs(shot.x) < CONFIG.bounds + 12 && Math.abs(shot.z) < CONFIG.bounds + 12) surviving.push(shot);
    }
  }
  sim.projectiles = surviving;
}

function updateEnemy(sim, enemy, dt) {
  if (enemy.defeated) return;
  const p = sim.player, dx = p.x - enemy.x, dz = p.z - enemy.z;
  const d = Math.hypot(dx, dz);
  const speed = aliveModule(enemy, 'main-engine') ? 3 : 0.75;
  const advance = d > 38 ? 1 : d < 18 ? -0.6 : 0;
  const strafe = Math.sin(sim.time * 0.35 + enemy.phase) * 0.5;
  enemy.vx = d > 0.01 ? (dx * advance - dz * strafe) / d * speed : 0;
  enemy.vz = d > 0.01 ? (dz * advance + dx * strafe) / d * speed : 0;
  enemy.x += enemy.vx * dt; enemy.z += enemy.vz * dt;
  resolveCollision(enemy, sim.obstacles, enemy.radius);
  // Heading settles slowly. Its side connector stays individually hittable.
  const desired = Math.atan2(dx, dz);
  enemy.angle += clamp(wrapAngle(desired - enemy.angle), -0.4 * dt, 0.4 * dt);
  const cannon = aliveModule(enemy, 'cannon');
  if (!cannon) { enemy.telegraph = null; return; }
  const shotBlocked = (from, target) => {
    const root = aliveModule(enemy, 'root');
    if (root) {
      const hull = moduleWorldPosition(enemy, root);
      if (segmentCircleT(from.x, from.z, target.x, target.z, hull.x, hull.z, root.radius) !== null) return true;
    }
    return sim.obstacles.some(o => segmentCircleT(from.x, from.z, target.x, target.z, o.x, o.z, o.radius) !== null);
  };
  enemy.cooldown = Math.max(0, enemy.cooldown - dt);
  if (enemy.telegraph) {
    const warning = enemy.telegraph;
    warning.remaining -= dt;
    const from = moduleWorldPosition(enemy, cannon);
    warning.fromX = from.x; warning.fromZ = from.z;
    if (warning.remaining <= 0) {
      if (shotBlocked(from, { x: warning.targetX, z: warning.targetZ })) {
        enemy.telegraph = null; enemy.cooldown = 0.5;
        return;
      }
      let sx = warning.targetX - from.x, sz = warning.targetZ - from.z;
      const length = Math.hypot(sx, sz) || 1; sx /= length; sz /= length;
      const shot = {
        id: `shot-${++sim.nextId}`, owner: 'enemy', enemyId: enemy.id,
        x: from.x, z: from.z, prevX: from.x, prevZ: from.z,
        vx: sx * CONFIG.enemyProjectileSpeed, vz: sz * CONFIG.enemyProjectileSpeed,
        damage: CONFIG.enemyDamage, radius: 0.65, ttl: 7,
      };
      sim.projectiles.push(shot);
      event(sim, 'enemy-fire', { x: from.x, z: from.z, enemyId: enemy.id, projectileId: shot.id });
      enemy.telegraph = null; enemy.cooldown = 3.5 + enemy.phase * 0.25;
    }
  } else if (enemy.cooldown <= 1e-8 && d <= 72) {
    const from = moduleWorldPosition(enemy, cannon);
    if (!shotBlocked(from, p)) enemy.telegraph = {
      fromX: from.x, fromZ: from.z, targetX: p.x, targetZ: p.z,
      remaining: CONFIG.enemyTelegraph, duration: CONFIG.enemyTelegraph,
    };
  }
}

function tick(sim, dt, input) {
  sim.time += dt;
  const p = sim.player;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.aimX = finite(input.aimX, p.aimX); p.aimZ = finite(input.aimZ, p.aimZ);
  let mx = clamp(finite(input.moveX), -1, 1), mz = clamp(finite(input.moveZ), -1, 1);
  const length = Math.hypot(mx, mz);
  if (length > 1) { mx /= length; mz /= length; }
  p.boosting = !!input.boost && length > 0.01 && p.boostCharge > 0.5;
  p.boostCharge = clamp(p.boostCharge + (p.boosting ? -15 : 6) * dt, 0, p.maxBoostCharge);
  const cargoPenalty = Math.max(0.65, 1 - p.cargoWeight * 0.009);
  const speed = (p.boosting ? CONFIG.boostSpeed : CONFIG.playerSpeed) * cargoPenalty;
  const response = 1 - Math.exp(-7 * dt);
  p.vx += (mx * speed - p.vx) * response;
  p.vz += (mz * speed - p.vz) * response;
  p.x += p.vx * dt; p.z += p.vz * dt;
  resolveCollision(p, [...sim.obstacles, ...sim.enemies.filter(e => !e.defeated)], p.radius);
  const heading = length > 0.05 ? Math.atan2(mx, mz) : Math.atan2(p.aimX - p.x, p.aimZ - p.z);
  p.angle += clamp(wrapAngle(heading - p.angle), -3.1 * dt, 3.1 * dt);
  if (input.fire) fire(sim, { x: p.aimX, z: p.aimZ });
  for (const enemy of sim.enemies) updateEnemy(sim, enemy, dt);
  updateProjectiles(sim, dt);
  for (const bundle of sim.debris) {
    if (!bundle.salvaged && !bundle.lost) {
      bundle.remaining = Math.max(0, bundle.remaining - dt);
      if (bundle.remaining === 0) { bundle.lost = true; event(sim, 'bundle-lost', { x: bundle.x, z: bundle.z, bundleId: bundle.id }); }
    }
  }
  if (p.weight > p.lift) p.sinkingTime += dt;
  else p.sinkingTime = 0;
  if (p.hp <= 0 || p.sinkingTime >= CONFIG.sinkingGrace) {
    sim.outcome = 'defeat';
    sim.endReason = p.hp <= 0 ? 'hull-destroyed' : 'overloaded';
    p.vx = 0; p.vz = 0;
    event(sim, 'defeat', { x: p.x, z: p.z, reason: sim.endReason });
  }
}

/** Caller pauses by omitting step; no timers run independently of this method. */
export function step(sim, dt, input = {}) {
  if (sim.outcome !== 'sailing' || !Number.isFinite(dt) || dt <= 0) return sim;
  // Bound pathological callers; normal frame intervals are integrated in full.
  let remaining = Math.min(dt, 60);
  while (remaining > 1e-9 && sim.outcome === 'sailing') {
    const interval = Math.min(CONFIG.integrationStep, remaining);
    tick(sim, interval, input);
    remaining -= interval;
  }
  return sim;
}
