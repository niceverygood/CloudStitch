/**
 * Cloudstitch free-flight experiment. This module owns its entire simulation.
 * It does not import, wrap, or advance the earlier planar combat simulation.
 * Coordinates are world XYZ, Y up; sizes are provisional scene units.
 */
export const FLIGHT_CONFIG = Object.freeze({
  fixedStep: 1 / 120,
  speed: 14,
  boostSpeed: 25,
  acceleration: 5,
  deceleration: 3.8,
  strafeSpeed: 7,
  strafeAcceleration: 2.4,
  strafeDeceleration: 5.5,
  turnSpeed: Math.PI / 2,
  helmReverseSpeed: 7,
  helmBoostSpeed: 22,
  helmRiseSpeed: 11,
  helmTurnSpeed: 0.6,
  helmYawResponse: 2.8,
  helmYawDamping: 3.8,
  helmForwardDrag: 0.75,
  helmCoastDrag: 0.65,
  helmLateralDrag: 1.25,
  helmBrakeDrag: 7,
  playerRadius: 1.8,
  projectileSpeed: 90,
  fireInterval: 0.22,
  bounds: Object.freeze({ minX: -110, maxX: 110, minY: -18, maxY: 60, minZ: -110, maxZ: 110 }),
});

const EPS = 1e-7;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const length = (v) => Math.hypot(v.x, v.y, v.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const pointAt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

function emit(state, type, point, payload = {}) {
  const seq = ++state.eventSequence;
  state.events.push({ id: `event-${seq}`, seq, type, time: state.time, x: point.x, y: point.y, z: point.z, ...payload });
  if (state.events.length > 64) state.events.splice(0, state.events.length - 64);
}

function effect(state, type, point, life = 0.55) {
  state.effects.push({ id: `effect-${++state.effectSequence}`, type, x: point.x, y: point.y, z: point.z, age: 0, life });
  if (state.effects.length > 80) state.effects.splice(0, state.effects.length - 80);
}

export function createFlightState(options = {}) {
  if (typeof options === 'boolean') options = { combatEnabled: options };
  return {
    version: 'cloudstitch-flight3d-v1',
    time: 0,
    paused: false,
    combatEnabled: Boolean(options.combatEnabled),
    completed: false,
    finishTime: null,
    routeIndex: 0,
    eventSequence: 0,
    effectSequence: 0,
    projectileSequence: 0,
    fireCooldown: 0,
    bounds: { ...FLIGHT_CONFIG.bounds },
    player: {
      id: 'player', x: 0, y: 8, z: 40, vx: 0, vy: 0, vz: 0,
      radius: FLIGHT_CONFIG.playerRadius, hp: 100, maxHp: 100,
      heading: Math.PI, pitch: 0, boost: 100, maxBoost: 100,
      boostActive: false, collisionCooldown: 0,
      yawRate: 0, ax: 0, ay: 0, az: 0,
      attitude: { roll: 0, pitch: 0, rollVelocity: 0, pitchVelocity: 0, heave: 0, heaveVelocity: 0 },
    },
    aim: { x: 0, y: 8, z: -100 },
    obstacles: [
      { id: 'island-west', kind: 'ellipsoid', label: '낮은 정원섬', x: -25, y: 9, z: 6, rx: 10, ry: 9, rz: 11 },
      { id: 'island-east', kind: 'ellipsoid', label: '중층 풍차섬', x: 39, y: 16, z: -22, rx: 12, ry: 12, rz: 11 },
      { id: 'island-high', kind: 'ellipsoid', label: '상층 구름섬', x: -40, y: 30, z: -29, rx: 11, ry: 8, rz: 12 },
      { id: 'island-south', kind: 'ellipsoid', label: '상층 바위섬', x: 37, y: 30, z: 30, rx: 10, ry: 7, rz: 10 },
      { id: 'dock-building', kind: 'box', label: '부두 창고', x: -48, y: 10, z: 33, half: { x: 8, y: 4, z: 6 } },
    ],
    gates: [
      { id: 'gate-1', label: '첫 항로', x: 0, y: 8, z: 10, radius: 5.5, heightTolerance: 3.5, passed: false },
      { id: 'gate-2', label: '상승', x: 18, y: 26, z: -20, radius: 5.5, heightTolerance: 3.5, passed: false },
      { id: 'gate-3', label: '하강', x: -20, y: -6, z: -38, radius: 5.5, heightTolerance: 3.5, passed: false },
      { id: 'gate-4', label: '상층 우회', x: -42, y: 38, z: 4, radius: 5.5, heightTolerance: 3.5, passed: false },
      { id: 'gate-5', label: '부두 귀환', x: 0, y: 8, z: 40, radius: 5.5, heightTolerance: 3.5, passed: false },
    ],
    targets: [
      { id: 'target-low', label: '저층 표적', x: -24, y: 5, z: -18, radius: 3, hp: 60, maxHp: 60, defeated: false, telegraph: null, shotCooldown: 3.2 },
      { id: 'target-mid', label: '중층 표적', x: 18, y: 25, z: -42, radius: 3, hp: 60, maxHp: 60, defeated: false, telegraph: null, shotCooldown: 4.1 },
      { id: 'target-under', label: '하층 표적', x: -47, y: -9, z: -11, radius: 3, hp: 60, maxHp: 60, defeated: false, telegraph: null, shotCooldown: 5.0 },
      { id: 'target-high', label: '상층 표적', x: 43, y: 45, z: -4, radius: 3, hp: 60, maxHp: 60, defeated: false, telegraph: null, shotCooldown: 5.9 },
      { id: 'target-far', label: '고층 표적', x: -4, y: 37, z: -67, radius: 3, hp: 60, maxHp: 60, defeated: false, telegraph: null, shotCooldown: 6.8 },
    ],
    projectiles: [],
    effects: [],
    events: [],
    stats: { shots: 0, hits: 0, kills: 0, checkpoints: 0, collisions: 0, enemyShots: 0, damageTaken: 0 },
  };
}

/** Safe-flight toggle changes only the enemy attack channel. */
export function setCombatEnabled(state, enabled) {
  state.combatEnabled = Boolean(enabled);
  if (!state.combatEnabled) {
    state.projectiles = state.projectiles.filter((projectile) => projectile.owner !== 'enemy');
    for (const target of state.targets) target.telegraph = null;
  }
  return state;
}

// Earliest segment/sphere hit. The complete XYZ segment is tested, including
// its start point, so fast projectiles cannot step through a small target.
export function segmentSphereHit(a, b, center, radius) {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const m = { x: a.x - center.x, y: a.y - center.y, z: a.z - center.z };
  const c = dot(m, m) - radius * radius;
  if (c <= 0) return 0;
  const aa = dot(d, d);
  if (aa < EPS) return null;
  const bb = dot(m, d);
  const discriminant = bb * bb - aa * c;
  if (discriminant < 0) return null;
  const t = (-bb - Math.sqrt(discriminant)) / aa;
  return t >= 0 && t <= 1 ? t : null;
}

function ellipsoidDistance(point, obstacle) {
  const p = [point.x - obstacle.x, point.y - obstacle.y, point.z - obstacle.z];
  const r = [obstacle.rx, obstacle.ry, obstacle.rz];
  const rr = r.map((n) => n * n);
  const normalized = p.reduce((sum, n, i) => sum + n * n / rr[i], 0);
  const equation = (lambda) => p.reduce((sum, n, i) => sum + rr[i] * n * n / ((lambda + rr[i]) ** 2), 0);
  let q;
  if (normalized > 1 + EPS) {
    let lo = 0;
    let hi = Math.max(...r) * Math.hypot(...p);
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (equation(mid) > 1) lo = mid; else hi = mid;
    }
    const lambda = (lo + hi) / 2;
    q = p.map((n, i) => rr[i] * n / (lambda + rr[i]));
  } else if (normalized < 1 - EPS) {
    // Interior closest point: the regular negative-Lagrange root, or the
    // shortest-axis singular solution when that point coordinate is zero.
    const minRR = Math.min(...rr);
    let lo = -minRR + Math.max(1e-12, minRR * 1e-12);
    let hi = 0;
    if (equation(lo) > 1) {
      for (let i = 0; i < 48; i++) {
        const mid = (lo + hi) / 2;
        if (equation(mid) > 1) lo = mid; else hi = mid;
      }
      const lambda = (lo + hi) / 2;
      q = p.map((n, i) => rr[i] * n / (lambda + rr[i]));
    } else {
      q = p.map((n, i) => rr[i] > minRR + EPS ? rr[i] * n / (rr[i] - minRR) : 0);
      const occupied = q.reduce((sum, n, i) => sum + n * n / rr[i], 0);
      const axis = rr.indexOf(minRR);
      q[axis] = Math.sqrt(Math.max(0, 1 - occupied)) * r[axis];
    }
  } else {
    q = [...p];
  }
  const outward = q.map((n, i) => n / rr[i]);
  const normalLength = Math.hypot(...outward) || 1;
  const normal = { x: outward[0] / normalLength, y: outward[1] / normalLength, z: outward[2] / normalLength };
  const distance = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  return { distance: normalized < 1 ? -distance : distance, normal };
}

function boxDistance(point, obstacle) {
  const p = { x: point.x - obstacle.x, y: point.y - obstacle.y, z: point.z - obstacle.z };
  const h = obstacle.half;
  const delta = { x: p.x - clamp(p.x, -h.x, h.x), y: p.y - clamp(p.y, -h.y, h.y), z: p.z - clamp(p.z, -h.z, h.z) };
  const distance = length(delta);
  if (distance > EPS) return { distance, normal: { x: delta.x / distance, y: delta.y / distance, z: delta.z / distance } };
  const distances = { x: h.x - Math.abs(p.x), y: h.y - Math.abs(p.y), z: h.z - Math.abs(p.z) };
  const axis = Object.keys(distances).reduce((best, next) => distances[next] < distances[best] ? next : best, 'x');
  const normal = { x: 0, y: 0, z: 0 };
  normal[axis] = p[axis] >= 0 ? 1 : -1;
  return { distance: -distances[axis], normal };
}

export function obstacleDistance(point, obstacle) {
  return obstacle.kind === 'box' ? boxDistance(point, obstacle) : ellipsoidDistance(point, obstacle);
}

function broadphase(a, b, obstacle, radius) {
  const h = obstacle.kind === 'box' ? obstacle.half : { x: obstacle.rx, y: obstacle.ry, z: obstacle.rz };
  return ['x', 'y', 'z'].every((axis) => Math.max(a[axis], b[axis]) >= obstacle[axis] - h[axis] - radius && Math.min(a[axis], b[axis]) <= obstacle[axis] + h[axis] + radius);
}

// Exact point-to-solid distance + conservative advancement tests a swept
// sphere against a convex collider, including rounded box corners. Inflating
// ellipsoid axes is deliberately avoided: it is not a sphere/ellipsoid test.
export function sweepObstacle(a, b, obstacle, radius = 0) {
  if (!broadphase(a, b, obstacle, radius)) return null;
  const delta = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const travel = length(delta);
  let t = 0;
  for (let i = 0; i < 72; i++) {
    const point = pointAt(a, b, t);
    const contact = obstacleDistance(point, obstacle);
    const gap = contact.distance - radius;
    if (gap <= 0.00001) {
      if (t === 0 && gap >= -0.0001 && dot(delta, contact.normal) >= -EPS) return null;
      return { t, point, normal: contact.normal, penetration: Math.max(0, -gap) };
    }
    if (travel < EPS) return null;
    t += Math.max(gap / travel * 0.999, 1e-9);
    if (t > 1) return null;
  }
  // A nearly tangent approach may converge slowly. A conservative contact
  // leaves the player outside instead of allowing a grazing penetration.
  const point = pointAt(a, b, t);
  const contact = obstacleDistance(point, obstacle);
  return { t, point, normal: contact.normal, penetration: Math.max(0, radius - contact.distance) };
}

function applyHelmVelocity(p, dt, input) {
  const braking = Boolean(input.helm.brake);
  const throttle = braking ? 0 : clamp(finite(input.helm.throttle), -1, 1);
  const turn = braking ? 0 : clamp(finite(input.helm.turn), -1, 1);
  const rise = braking ? 0 : clamp(finite(input.helm.rise), -1, 1);
  const yawResponse = 1 - Math.exp(-(braking ? FLIGHT_CONFIG.helmBrakeDrag : (Math.abs(turn) > EPS ? FLIGHT_CONFIG.helmYawResponse : FLIGHT_CONFIG.helmYawDamping)) * dt);
  p.yawRate += (turn * FLIGHT_CONFIG.helmTurnSpeed - p.yawRate) * yawResponse;
  p.yawRate = clamp(p.yawRate, -FLIGHT_CONFIG.helmTurnSpeed, FLIGHT_CONFIG.helmTurnSpeed);
  p.heading += p.yawRate * dt;
  p.heading = Math.atan2(Math.sin(p.heading), Math.cos(p.heading));
  p.boostActive = Boolean(input.boost && throttle > EPS && p.boost > 0.5);
  p.boost = clamp(p.boost + (p.boostActive ? -25 : 16) * dt, 0, p.maxBoost);
  const forward = { x: Math.sin(p.heading), z: Math.cos(p.heading) };
  const right = { x: Math.cos(p.heading), z: -Math.sin(p.heading) };
  const forwardVelocity = p.vx * forward.x + p.vz * forward.z;
  const sideVelocity = p.vx * right.x + p.vz * right.z;
  const forwardTarget = throttle * (throttle >= 0 ? (p.boostActive ? FLIGHT_CONFIG.helmBoostSpeed : FLIGHT_CONFIG.speed) : FLIGHT_CONFIG.helmReverseSpeed);
  const forwardDrag = braking ? FLIGHT_CONFIG.helmBrakeDrag : (Math.abs(throttle) > EPS ? FLIGHT_CONFIG.helmForwardDrag : FLIGHT_CONFIG.helmCoastDrag);
  // A simple mass/drag flight prototype, not certified flight physics. The
  // longitudinal force and stronger lateral drag bend existing momentum
  // toward the bow gradually instead of rotating velocity with the model.
  const nextForward = forwardTarget + (forwardVelocity - forwardTarget) * Math.exp(-forwardDrag * dt);
  const nextSide = sideVelocity * Math.exp(-(braking ? FLIGHT_CONFIG.helmBrakeDrag : FLIGHT_CONFIG.helmLateralDrag) * dt);
  p.vx = nextForward * forward.x + nextSide * right.x;
  p.vz = nextForward * forward.z + nextSide * right.z;
  const riseResponse = 1 - Math.exp(-(braking ? FLIGHT_CONFIG.helmBrakeDrag : (Math.abs(rise) > EPS ? 1.9 : 1.5)) * dt);
  p.vy += (rise * FLIGHT_CONFIG.helmRiseSpeed - p.vy) * riseResponse;
}

function springAxis(attitude, key, velocityKey, target, stiffness, damping, limit, velocityLimit, dt) {
  let velocity = attitude[velocityKey] + ((target - attitude[key]) * stiffness - attitude[velocityKey] * damping) * dt;
  velocity = clamp(velocity, -velocityLimit, velocityLimit);
  const next = attitude[key] + velocity * dt;
  attitude[key] = clamp(next, -limit, limit);
  attitude[velocityKey] = next !== attitude[key] && velocity * next > 0 ? 0 : velocity;
}

function advanceAttitude(state, dt, helmMode) {
  const p = state.player;
  const attitude = p.attitude;
  const sin = Math.sin(p.heading);
  const cos = Math.cos(p.heading);
  const forwardSpeed = p.vx * sin + p.vz * cos;
  const forwardAcceleration = p.ax * sin + p.az * cos;
  const lateralAcceleration = p.ax * cos - p.az * sin;
  const rollTarget = clamp(-p.yawRate * forwardSpeed * 0.012 - lateralAcceleration * 0.005 + Math.sin(state.time * 1.31) * 0.009, -0.135, 0.135);
  const pitchTarget = clamp(-forwardAcceleration * 0.007 - p.vy * 0.002 + Math.sin(state.time * 1.57 + 0.8) * 0.007, -0.105, 0.105);
  // Buoyancy and attitude are display offsets only. No bob is added to the
  // authoritative collision/projectile center, so idle flight stays at Y.
  springAxis(attitude, 'roll', 'rollVelocity', rollTarget, 16, 5, 0.15, 0.6, dt);
  springAxis(attitude, 'pitch', 'pitchVelocity', pitchTarget, 14, 5.2, 0.12, 0.5, dt);
  springAxis(attitude, 'heave', 'heaveVelocity', Math.sin(state.time * Math.PI * 2 / 3.4) * 0.18, 16, 5.2, 0.35, 0.8, dt);
  if (helmMode) p.pitch = attitude.pitch;
}

function applyWorldVelocity(p, dt, input) {
  p.yawRate *= Math.exp(-FLIGHT_CONFIG.helmYawDamping * dt);
  const movement = { x: clamp(finite(input.moveX), -1, 1), y: clamp(finite(input.moveY), -1, 1), z: clamp(finite(input.moveZ), -1, 1) };
  const inputLength = length(movement);
  if (inputLength > 1) { movement.x /= inputLength; movement.y /= inputLength; movement.z /= inputLength; }
  p.boostActive = Boolean(input.boost && inputLength > EPS && p.boost > 0.5);
  p.boost = clamp(p.boost + (p.boostActive ? -25 : 16) * dt, 0, p.maxBoost);
  const speed = p.boostActive ? FLIGHT_CONFIG.boostSpeed : FLIGHT_CONFIG.speed;
  const axisLength = input.lateralAxis && Number.isFinite(input.lateralAxis.x) && Number.isFinite(input.lateralAxis.z)
    ? Math.hypot(input.lateralAxis.x, input.lateralAxis.z) : 0;
  if (axisLength > EPS) {
    // The camera supplies a horizontal world axis, never a new coordinate
    // system for stored positions. A rotated view therefore has the same
    // local response without accumulating transforms on the world state.
    const right = { x: input.lateralAxis.x / axisLength, z: input.lateralAxis.z / axisLength };
    const lateralInput = movement.x * right.x + movement.z * right.z;
    const lateralVelocity = p.vx * right.x + p.vz * right.z;
    const lateralTarget = lateralInput * speed * (FLIGHT_CONFIG.strafeSpeed / FLIGHT_CONFIG.speed);
    const lateralResponse = 1 - Math.exp(-(Math.abs(lateralInput) > EPS ? FLIGHT_CONFIG.strafeAcceleration : FLIGHT_CONFIG.strafeDeceleration) * dt);
    const lateralChange = (lateralTarget - lateralVelocity) * lateralResponse;
    const restInput = { x: movement.x - right.x * lateralInput, y: movement.y, z: movement.z - right.z * lateralInput };
    const restResponse = 1 - Math.exp(-(length(restInput) > EPS ? FLIGHT_CONFIG.acceleration : FLIGHT_CONFIG.deceleration) * dt);
    p.vx += (restInput.x * speed - (p.vx - right.x * lateralVelocity)) * restResponse + right.x * lateralChange;
    p.vy += (restInput.y * speed - p.vy) * restResponse;
    p.vz += (restInput.z * speed - (p.vz - right.z * lateralVelocity)) * restResponse + right.z * lateralChange;
  } else {
    const response = 1 - Math.exp(-(inputLength > EPS ? FLIGHT_CONFIG.acceleration : FLIGHT_CONFIG.deceleration) * dt);
    p.vx += (movement.x * speed - p.vx) * response;
    p.vy += (movement.y * speed - p.vy) * response;
    p.vz += (movement.z * speed - p.vz) * response;
  }
}

function movePlayer(state, dt, input) {
  const p = state.player;
  const previousVelocity = { x: p.vx, y: p.vy, z: p.vz };
  const helmMode = Boolean(input.helm && typeof input.helm === 'object');
  if (helmMode) applyHelmVelocity(p, dt, input);
  else applyWorldVelocity(p, dt, input);
  let current = { x: p.x, y: p.y, z: p.z };
  let destination = { x: p.x + p.vx * dt, y: p.y + p.vy * dt, z: p.z + p.vz * dt };
  p.collisionCooldown = Math.max(0, p.collisionCooldown - dt);
  for (let pass = 0; pass < 3; pass++) {
    let first = null;
    for (const obstacle of state.obstacles) {
      const hit = sweepObstacle(current, destination, obstacle, p.radius);
      if (hit && (!first || hit.t < first.t)) first = { ...hit, obstacle };
    }
    if (!first) { current = destination; break; }
    const { normal, point, penetration } = first;
    current = { x: point.x + normal.x * (penetration + 0.002), y: point.y + normal.y * (penetration + 0.002), z: point.z + normal.z * (penetration + 0.002) };
    const remaining = { x: destination.x - point.x, y: destination.y - point.y, z: destination.z - point.z };
    const inward = Math.min(0, dot(remaining, normal));
    destination = { x: current.x + remaining.x - normal.x * inward, y: current.y + remaining.y - normal.y * inward, z: current.z + remaining.z - normal.z * inward };
    const velocityInward = Math.min(0, p.vx * normal.x + p.vy * normal.y + p.vz * normal.z);
    p.vx -= normal.x * velocityInward;
    p.vy -= normal.y * velocityInward;
    p.vz -= normal.z * velocityInward;
    if (p.collisionCooldown === 0 && velocityInward < -1.5) {
      p.collisionCooldown = 0.8;
      state.stats.collisions++;
      emit(state, 'collision', point, { obstacleId: first.obstacle.id });
      effect(state, 'collision', point, 0.45);
      const force = -velocityInward;
      p.attitude.rollVelocity = clamp(p.attitude.rollVelocity + (normal.x * Math.cos(p.heading) - normal.z * Math.sin(p.heading)) * force * 0.012, -0.3, 0.3);
      p.attitude.pitchVelocity = clamp(p.attitude.pitchVelocity + (normal.x * Math.sin(p.heading) + normal.z * Math.cos(p.heading)) * force * 0.012, -0.25, 0.25);
      p.attitude.heaveVelocity = clamp(p.attitude.heaveVelocity + normal.y * force * 0.025, -0.4, 0.4);
    }
  }
  const bounds = state.bounds;
  p.x = clamp(current.x, bounds.minX + p.radius, bounds.maxX - p.radius);
  p.y = clamp(current.y, bounds.minY + p.radius, bounds.maxY - p.radius);
  p.z = clamp(current.z, bounds.minZ + p.radius, bounds.maxZ - p.radius);
  if (p.x !== current.x) p.vx = 0;
  if (p.y !== current.y) p.vy = 0;
  if (p.z !== current.z) p.vz = 0;
  const horizontal = Math.hypot(p.vx, p.vz);
  if (!helmMode && horizontal > 0.3) {
    const desired = Math.atan2(p.vx, p.vz);
    const shortest = Math.atan2(Math.sin(desired - p.heading), Math.cos(desired - p.heading));
    p.heading += clamp(shortest, -FLIGHT_CONFIG.turnSpeed * dt, FLIGHT_CONFIG.turnSpeed * dt);
    p.heading = Math.atan2(Math.sin(p.heading), Math.cos(p.heading));
  }
  if (!helmMode) p.pitch = Math.atan2(p.vy, Math.max(0.4, horizontal));
  p.ax = (p.vx - previousVelocity.x) / dt;
  p.ay = (p.vy - previousVelocity.y) / dt;
  p.az = (p.vz - previousVelocity.z) / dt;
  advanceAttitude(state, dt, helmMode);
}

function shoot(state, owner, origin, target, { speed, damage, radius = 0.28, life = 2.8 }) {
  const direction = { x: target.x - origin.x, y: target.y - origin.y, z: target.z - origin.z };
  const distance = length(direction);
  if (distance < EPS) return false;
  const startOffset = owner === 'player' ? state.player.radius + 0.6 : 3.7;
  const d = { x: direction.x / distance, y: direction.y / distance, z: direction.z / distance };
  const x = origin.x + d.x * startOffset;
  const y = origin.y + d.y * startOffset;
  const z = origin.z + d.z * startOffset;
  state.projectiles.push({ id: `projectile-${++state.projectileSequence}`, owner, x, y, z, px: x, py: y, pz: z, vx: d.x * speed, vy: d.y * speed, vz: d.z * speed, radius, damage, life });
  emit(state, owner === 'player' ? 'shot' : 'enemy-shot', { x, y, z }, { targetX: target.x, targetY: target.y, targetZ: target.z });
  effect(state, 'muzzle', { x, y, z }, 0.15);
  return true;
}

function advanceAI(state, dt) {
  if (!state.combatEnabled) {
    state.projectiles = state.projectiles.filter((projectile) => projectile.owner !== 'enemy');
    for (const target of state.targets) target.telegraph = null;
    return;
  }
  for (const target of state.targets) {
    if (target.defeated) { target.telegraph = null; continue; }
    if (target.telegraph) {
      target.telegraph.remaining -= dt;
      target.telegraph.progress = clamp(1 - target.telegraph.remaining / target.telegraph.duration, 0, 1);
      if (target.telegraph.remaining <= 0) {
        shoot(state, 'enemy', target, target.telegraph.aim, { speed: 27, damage: 10, radius: 0.55, life: 7 });
        state.stats.enemyShots++;
        target.telegraph = null;
        target.shotCooldown = 4.2;
      }
    } else {
      target.shotCooldown -= dt;
      const p = state.player;
      if (target.shotCooldown <= 0 && Math.hypot(target.x - p.x, target.y - p.y, target.z - p.z) < 125) {
        const aim = { x: p.x + p.vx * 0.3, y: p.y + p.vy * 0.3, z: p.z + p.vz * 0.3 };
        target.telegraph = { remaining: 1.2, duration: 1.2, progress: 0, aim };
        emit(state, 'enemy-warning', target, { targetId: target.id, aim: { ...aim }, duration: 1.2 });
      }
    }
  }
}

function advanceProjectiles(state, dt, playerBeforeMove) {
  const survivors = [];
  for (const projectile of state.projectiles) {
    const start = { x: projectile.x, y: projectile.y, z: projectile.z };
    const end = { x: start.x + projectile.vx * dt, y: start.y + projectile.vy * dt, z: start.z + projectile.vz * dt };
    projectile.px = start.x; projectile.py = start.y; projectile.pz = start.z;
    let hit = null;
    if (projectile.owner === 'player') {
      for (const target of state.targets) {
        if (target.defeated) continue;
        const t = segmentSphereHit(start, end, target, target.radius + projectile.radius);
        if (t !== null && (!hit || t < hit.t)) hit = { t, target };
      }
    } else {
      // Relative motion catches a player crossing the shot between frames.
      const p = state.player;
      const relativeStart = { x: start.x - playerBeforeMove.x, y: start.y - playerBeforeMove.y, z: start.z - playerBeforeMove.z };
      const relativeEnd = { x: end.x - p.x, y: end.y - p.y, z: end.z - p.z };
      const t = segmentSphereHit(relativeStart, relativeEnd, { x: 0, y: 0, z: 0 }, p.radius + projectile.radius);
      if (t !== null) hit = { t, target: p };
    }
    for (const obstacle of state.obstacles) {
      const collision = sweepObstacle(start, end, obstacle, projectile.radius);
      if (collision && (!hit || collision.t < hit.t)) hit = { t: collision.t, obstacle };
    }
    if (hit) {
      const point = pointAt(start, end, hit.t);
      effect(state, hit.obstacle ? 'terrain-hit' : 'hit', point);
      if (hit.target && projectile.owner === 'player') {
        const target = hit.target;
        target.hp = Math.max(0, target.hp - projectile.damage);
        state.stats.hits++;
        emit(state, 'hit', point, { targetId: target.id, damage: projectile.damage, hp: target.hp });
        if (target.hp === 0 && !target.defeated) {
          target.defeated = true;
          target.telegraph = null;
          state.stats.kills++;
          emit(state, 'target-defeated', target, { targetId: target.id });
          effect(state, 'explosion', target, 1.1);
        }
      } else if (hit.target) {
        const p = state.player;
        const wasAlive = p.hp > 0;
        const damage = Math.min(p.hp, projectile.damage);
        p.hp -= damage;
        state.stats.damageTaken += damage;
        emit(state, 'player-hit', point, { damage, hp: p.hp });
        if (wasAlive && p.hp === 0) emit(state, 'defeated', p);
      }
      continue;
    }
    projectile.x = end.x; projectile.y = end.y; projectile.z = end.z;
    projectile.life -= dt;
    if (projectile.life > 0) survivors.push(projectile);
  }
  state.projectiles = survivors;
}

function advanceRoute(state, before) {
  if (state.completed) return;
  const gate = state.gates[state.routeIndex];
  if (!gate) return;
  const p = state.player;
  const delta = { x: p.x - before.x, y: p.y - before.y, z: p.z - before.z };
  const denominator = dot(delta, delta);
  const t = denominator > EPS ? clamp(((gate.x - before.x) * delta.x + (gate.y - before.y) * delta.y + (gate.z - before.z) * delta.z) / denominator, 0, 1) : 0;
  const point = pointAt(before, p, t);
  if (Math.hypot(point.x - gate.x, point.y - gate.y, point.z - gate.z) > gate.radius || Math.abs(point.y - gate.y) > gate.heightTolerance) return;
  gate.passed = true;
  state.routeIndex++;
  state.stats.checkpoints++;
  emit(state, 'gate', gate, { gateId: gate.id, routeIndex: state.routeIndex });
  effect(state, 'gate', gate, 1.2);
  if (state.routeIndex === state.gates.length) {
    state.completed = true;
    state.finishTime = state.time;
    emit(state, 'route-complete', p, { finishTime: state.finishTime });
  }
}

/**
 * Advance this sandbox only. dt is elapsed seconds (0..2 per call); long
 * frames are subdivided so acceleration, AI, collision and shots agree.
 * Pausing freezes clocks, AI, projectiles, cooldowns and effects together.
 * Optional input.lateralAxis is the camera's horizontal right axis in world
 * coordinates. It reduces only that component's speed and acceleration.
 * Optional input.helm={throttle,turn,rise,brake} uses ship-relative inertial
 * flight instead. Positive turn increases heading independently of velocity.
 * Brake overrides thrust/turn/boost and damps momentum without teleporting.
 */
export function stepFlight(state, dt, input = {}) {
  if (state.paused || input.pause || state.player.hp <= 0) return state;
  const elapsed = clamp(finite(dt), 0, 2);
  if (elapsed <= 0) return state;
  if (input.aim && ['x', 'y', 'z'].every((axis) => Number.isFinite(input.aim[axis]))) state.aim = { x: input.aim.x, y: input.aim.y, z: input.aim.z };
  const steps = Math.ceil(elapsed / FLIGHT_CONFIG.fixedStep);
  const subDt = elapsed / steps;
  for (let i = 0; i < steps; i++) {
    if (state.player.hp <= 0) break;
    state.time += subDt;
    const before = { x: state.player.x, y: state.player.y, z: state.player.z };
    movePlayer(state, subDt, input);
    state.fireCooldown = Math.max(0, state.fireCooldown - subDt);
    if (input.fire && state.fireCooldown <= EPS) {
      if (shoot(state, 'player', state.player, state.aim, { speed: FLIGHT_CONFIG.projectileSpeed, damage: 20 })) state.stats.shots++;
      state.fireCooldown = FLIGHT_CONFIG.fireInterval;
    }
    advanceAI(state, subDt);
    advanceProjectiles(state, subDt, before);
    advanceRoute(state, before);
    for (const visual of state.effects) visual.age += subDt;
    state.effects = state.effects.filter((visual) => visual.age < visual.life);
  }
  return state;
}
