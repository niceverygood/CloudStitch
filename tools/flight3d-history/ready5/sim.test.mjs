import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightState, stepFlight, setCombatEnabled, FLIGHT_CONFIG, segmentSphereHit, obstacleDistance, sweepObstacle } from './sim.mjs';

function emptyState(options) {
  const state = createFlightState(options);
  state.obstacles = [];
  state.targets = [];
  state.gates = [];
  return state;
}

function run(state, duration, input = {}, frame = 1 / 60) {
  const count = Math.round(duration / frame);
  for (let i = 0; i < count; i++) stepFlight(state, frame, input);
  return state;
}

const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
const targetAt = (x, y, z) => ({ id: 'test-target', x, y, z, radius: 2, hp: 60, maxHp: 60, defeated: false, telegraph: null, shotCooldown: 0.2 });

test('rising and descending actually change world Y, with inertia and braking', () => {
  const state = emptyState();
  const start = state.player.y;
  run(state, 1.5, { moveY: 1 });
  assert.ok(state.player.y > start + 15);
  assert.ok(state.player.vy > 13);
  const raised = state.player.y;
  run(state, 1.5, { moveY: -1 });
  assert.ok(state.player.y < raised - 12);
  assert.ok(state.player.vy < -13);
  const previousSpeed = Math.abs(state.player.vy);
  run(state, 1, {});
  assert.ok(Math.abs(state.player.vy) < previousSpeed / 30);
});

test('three-axis diagonals have the same speed budget, including boost', () => {
  const straight = emptyState();
  const diagonal = emptyState();
  run(straight, 1, { moveX: 1 });
  run(diagonal, 1, { moveX: 1, moveY: 1, moveZ: 1 });
  close(Math.hypot(diagonal.player.vx, diagonal.player.vy, diagonal.player.vz), straight.player.vx);
  close(Math.hypot(diagonal.player.x, diagonal.player.y - 8, diagonal.player.z - 40), straight.player.x);
  const boosted = emptyState();
  run(boosted, 1, { moveX: 1, moveY: 1, moveZ: -1, boost: true });
  assert.ok(Math.hypot(boosted.player.vx, boosted.player.vy, boosted.player.vz) > 24);
  close(boosted.player.boost, 75);
  run(boosted, 1, {});
  close(boosted.player.boost, 91);
});

test('camera-relative lateral taps ease in gently and cap at half forward speed', () => {
  const previous = emptyState();
  const lateral = emptyState();
  const lateralAxis = { x: 1, y: 0, z: 0 };
  run(previous, 0.25, { moveX: 1 });
  run(lateral, 0.25, { moveX: 1, lateralAxis });
  assert.ok(lateral.player.x < previous.player.x * 0.4, `${lateral.player.x} should be much smaller than ${previous.player.x}`);
  assert.ok(lateral.player.vx < previous.player.vx * 0.4);
  run(lateral, 3, { moveX: 1, lateralAxis });
  assert.ok(lateral.player.vx > 6.9 && lateral.player.vx <= FLIGHT_CONFIG.strafeSpeed);
  const boosted = emptyState();
  run(boosted, 2, { moveX: 1, boost: true, lateralAxis });
  assert.ok(boosted.player.vx > 12.3 && boosted.player.vx <= 12.5);
});

test('rotating or scaling the camera right axis preserves local lateral response', () => {
  const reference = emptyState();
  const rotated = emptyState();
  const angle = 0.73;
  const right = { x: Math.cos(angle), z: Math.sin(angle) };
  run(reference, 0.8, { moveX: 0.6, moveY: 0.3, moveZ: -0.8, lateralAxis: { x: 1, z: 0 } });
  run(rotated, 0.8, {
    moveX: 0.6 * right.x + 0.8 * right.z,
    moveY: 0.3,
    moveZ: 0.6 * right.z - 0.8 * right.x,
    lateralAxis: { x: right.x * 5, y: 99, z: right.z * 5 },
  });
  close(rotated.player.vx * right.x + rotated.player.vz * right.z, reference.player.vx);
  close(-rotated.player.vx * right.z + rotated.player.vz * right.x, reference.player.vz);
  close(rotated.player.vy, reference.player.vy);
  close(rotated.player.x * right.x + (rotated.player.z - 40) * right.z, reference.player.x);
  close(-rotated.player.x * right.z + (rotated.player.z - 40) * right.x, reference.player.z - 40);
});

test('lateral reversal retains inertia briefly, and release brakes it promptly', () => {
  const state = emptyState();
  const lateralAxis = { x: 1, z: 0 };
  run(state, 0.8, { moveX: 1, lateralAxis });
  const beforeReverse = state.player.vx;
  run(state, 0.05, { moveX: -1, lateralAxis });
  assert.ok(state.player.vx > 0 && state.player.vx < beforeReverse);
  run(state, 0.5, { moveX: -1, lateralAxis });
  assert.ok(state.player.vx < 0 && state.player.vx > -7);
  const beforeRelease = Math.abs(state.player.vx);
  run(state, 0.6, { lateralAxis });
  assert.ok(Math.abs(state.player.vx) < beforeRelease * 0.05);
});

test('lateral tuning preserves the existing forward and vertical movement response', () => {
  const previous = emptyState();
  const withAxis = emptyState();
  run(previous, 0.8, { moveY: 1, moveZ: -1 });
  run(withAxis, 0.8, { moveY: 1, moveZ: -1, lateralAxis: { x: 1, z: 0 } });
  close(withAxis.player.y, previous.player.y);
  close(withAxis.player.z, previous.player.z);
  close(withAxis.player.vy, previous.player.vy);
  close(withAxis.player.vz, previous.player.vz);
  const invalidAxis = emptyState();
  const ordinary = emptyState();
  run(invalidAxis, 0.25, { moveX: 1, lateralAxis: { x: 0, z: 0 } });
  run(ordinary, 0.25, { moveX: 1 });
  close(invalidAxis.player.x, ordinary.player.x);
});

test('heading turns at most 90 degrees per second and takes the short boundary wrap', () => {
  const state = emptyState();
  const initial = state.player.heading;
  run(state, 0.25, { moveX: 1 });
  const turn = Math.atan2(Math.sin(state.player.heading - initial), Math.cos(state.player.heading - initial));
  assert.ok(turn < -0.3 && Math.abs(turn) <= FLIGHT_CONFIG.turnSpeed * 0.25 + 1e-10);
  const wrapping = emptyState();
  wrapping.player.heading = Math.PI - 0.01;
  const desired = -Math.PI + 0.01;
  wrapping.player.vx = Math.sin(desired) * 14;
  wrapping.player.vz = Math.cos(desired) * 14;
  const before = wrapping.player.heading;
  stepFlight(wrapping, 1 / 120, { moveX: Math.sin(desired), moveZ: Math.cos(desired) });
  const delta = Math.atan2(Math.sin(wrapping.player.heading - before), Math.cos(wrapping.player.heading - before));
  assert.ok(delta > 0);
  close(delta, FLIGHT_CONFIG.turnSpeed / 120);
  assert.ok(wrapping.player.heading < -3, 'angle should cross the representation boundary by the short path');
});

test('helm forward/reverse follows the bow at heading PI, with separate boost and climb budgets', () => {
  const forward = emptyState();
  const reverse = emptyState();
  const boosted = emptyState();
  run(forward, 3, { helm: { throttle: 1 } });
  run(reverse, 3, { helm: { throttle: -1 } });
  run(boosted, 3, { helm: { throttle: 1 }, boost: true });
  assert.ok(forward.player.z < 15 && forward.player.vz < -12);
  assert.ok(reverse.player.z > 52 && reverse.player.vz > 6 && reverse.player.vz <= 7);
  assert.ok(boosted.player.vz < -19 && boosted.player.vz >= -22);
  close(forward.player.heading, Math.PI);
  close(reverse.player.heading, Math.PI);
  close(forward.player.x, 0);
  close(boosted.player.boost, 25);
  const climbing = emptyState();
  run(climbing, 1.5, { helm: { rise: 1 } });
  assert.ok(climbing.player.y > 18 && climbing.player.vy > 10 && climbing.player.vy <= 11);
  const high = climbing.player.y;
  run(climbing, 2, { helm: { rise: -1 } });
  assert.ok(climbing.player.y < high - 8 && climbing.player.vy < -10);
});

test('helm turns have bounded yaw inertia and release damping without velocity steering', () => {
  const state = emptyState();
  const initial = state.player.heading;
  run(state, 0.25, { helm: { turn: 1 } });
  assert.ok(state.player.yawRate > 0.2 && state.player.yawRate < FLIGHT_CONFIG.helmTurnSpeed);
  const initialTurn = Math.atan2(Math.sin(state.player.heading - initial), Math.cos(state.player.heading - initial));
  assert.ok(initialTurn > 0 && initialTurn < FLIGHT_CONFIG.helmTurnSpeed * 0.25);
  assert.equal(Math.hypot(state.player.vx, state.player.vz), 0, 'turning on the spot must not invent linear thrust');
  run(state, 1.75, { helm: { turn: 1 } });
  assert.ok(state.player.yawRate > 0.59 && state.player.yawRate <= 0.6);
  const beforeRelease = state.player.yawRate;
  const heading = state.player.heading;
  run(state, 0.5, { helm: {} });
  assert.ok(state.player.yawRate > 0 && state.player.yawRate < beforeRelease * 0.16);
  assert.ok(state.player.heading > heading, 'angular momentum eases out instead of stopping in one frame');
});

test('helm turning bends existing momentum instead of snapping it to the new heading', () => {
  const state = emptyState();
  run(state, 2, { helm: { throttle: 1 } });
  run(state, 1.5, { helm: { throttle: 1, turn: -1 } });
  const p = state.player;
  const velocityHeading = Math.atan2(p.vx, p.vz);
  const slip = Math.atan2(Math.sin(velocityHeading - p.heading), Math.cos(velocityHeading - p.heading));
  assert.ok(Math.abs(slip) > 0.1 && Math.abs(slip) < 0.7);
  assert.ok(p.vx > 0, 'negative helm turn from initial PI turns toward world +X');
  const beforeCoasting = Math.hypot(p.vx, p.vz);
  run(state, 0.2, { helm: {} });
  assert.ok(Math.hypot(p.vx, p.vz) > beforeCoasting * 0.7);
  assert.ok(Math.hypot(p.vx, p.vz) < beforeCoasting);
});

test('helm and attitude stay approximately frame-rate independent at 25/60/120 FPS', () => {
  const states = [25, 60, 120].map((fps) => {
    const state = emptyState();
    for (let frame = 0; frame < fps * 6; frame++) {
      const time = frame / fps;
      stepFlight(state, 1 / fps, { helm: { throttle: 1, turn: time >= 1.2 && time < 3.4 ? -0.8 : 0, rise: time >= 0.8 && time < 2 ? 0.7 : 0 } });
    }
    return state;
  });
  for (const state of states.slice(0, 2)) {
    const reference = states[2];
    assert.ok(Math.hypot(state.player.x - reference.player.x, state.player.y - reference.player.y, state.player.z - reference.player.z) < 0.04);
    close(state.player.heading, reference.player.heading, 0.001);
    for (const key of ['roll', 'pitch', 'heave']) close(state.player.attitude[key], reference.player.attitude[key], 0.001);
  }
});

test('idle buoyancy sways within small display limits without moving the collision center', () => {
  const state = emptyState();
  let minHeave = 0;
  let maxHeave = 0;
  for (let frame = 0; frame < 60 * 15; frame++) {
    stepFlight(state, 1 / 60, { helm: {} });
    const a = state.player.attitude;
    minHeave = Math.min(minHeave, a.heave);
    maxHeave = Math.max(maxHeave, a.heave);
    assert.ok(Math.abs(a.heave) <= 0.35 && Math.abs(a.roll) < 0.02 && Math.abs(a.pitch) < 0.02);
  }
  assert.ok(minHeave < -0.12 && maxHeave > 0.12);
  close(state.player.x, 0);
  close(state.player.y, 8);
  close(state.player.z, 40);
});

test('acceleration pitch and turning bank respond, then settle after releasing helm input', () => {
  const state = emptyState();
  run(state, 0.5, { helm: { throttle: 1 } });
  assert.ok(state.player.attitude.pitch < -0.01, 'initial acceleration pitches the bow gently up');
  run(state, 1.5, { helm: { throttle: 1 } });
  run(state, 1.5, { helm: { throttle: 1, turn: -1 } });
  assert.ok(state.player.attitude.roll > 0.015);
  const activeRoll = Math.abs(state.player.attitude.roll);
  run(state, 5, { helm: {} });
  assert.ok(Math.abs(state.player.attitude.roll) < activeRoll / 3);
  assert.ok(Math.abs(state.player.attitude.pitch) < 0.025);
  assert.ok(Math.abs(state.player.yawRate) < 0.0001);
  for (let frame = 0; frame < 60 * 20; frame++) {
    stepFlight(state, 1 / 60, { helm: { throttle: Math.sin(frame / 110), turn: Math.sin(frame / 53), rise: Math.sin(frame / 83) }, boost: true });
    const a = state.player.attitude;
    assert.ok(Math.abs(a.roll) <= 0.15 && Math.abs(a.pitch) <= 0.12 && Math.abs(a.heave) <= 0.35);
    assert.ok(Math.abs(state.player.yawRate) <= 0.6);
  }
});

test('a terrain collision can kick the bounded display spring without moving through the solid', () => {
  const state = emptyState();
  state.obstacles = [{ id: 'wall', kind: 'box', x: 0, y: 8, z: 0, half: { x: 0.1, y: 8, z: 8 } }];
  Object.assign(state.player, { x: -20, y: 8, z: 0, vx: 1000 });
  stepFlight(state, 1 / 30, { helm: {} });
  assert.ok(state.player.x < -1.89);
  assert.ok(state.stats.collisions > 0);
  assert.ok(Math.abs(state.player.attitude.rollVelocity) > 0.01);
  assert.ok(Math.abs(state.player.attitude.roll) <= 0.15);
});

test('pausing helm flight freezes angular momentum, springs, heave and acceleration together', () => {
  const state = emptyState();
  run(state, 1, { helm: { throttle: 1, turn: -1, rise: 0.5 } });
  state.paused = true;
  const frozen = structuredClone(state);
  stepFlight(state, 2, { helm: { throttle: -1, turn: 1, rise: -1 }, fire: true });
  assert.deepEqual(state, frozen);
});

test('helm brake settles momentum within one second while positions remain continuous', () => {
  const state = emptyState();
  run(state, 2, { helm: { throttle: 1, rise: 0.4, turn: -0.5 } });
  const before = { x: state.player.x, y: state.player.y, z: state.player.z };
  const speed = Math.hypot(state.player.vx, state.player.vy, state.player.vz);
  stepFlight(state, 1 / 120, { helm: { brake: true } });
  const displacement = Math.hypot(state.player.x - before.x, state.player.y - before.y, state.player.z - before.z);
  const nextSpeed = Math.hypot(state.player.vx, state.player.vy, state.player.vz);
  assert.ok(displacement > 0 && displacement < speed / 120 + 1e-7);
  assert.ok(nextSpeed > speed * 0.9 && nextSpeed < speed, 'braking damps rather than zeroing a moving ship');
  run(state, 1, { helm: { brake: true } });
  assert.ok(Math.hypot(state.player.vx, state.player.vy, state.player.vz) < 0.5);
  assert.ok(Math.abs(state.player.yawRate) < 0.005);
  assert.ok(Math.abs(state.player.attitude.pitch) <= 0.12);
});

test('held helm brake overrides simultaneous thrust, rise, turn and boost', () => {
  const state = emptyState();
  Object.assign(state.player, { vx: 3, vy: 4, vz: 5, yawRate: 0.3, boost: 50 });
  const input = { helm: { throttle: 1, rise: 1, turn: 1, brake: true }, boost: true };
  run(state, 1.5, input);
  assert.ok(Math.hypot(state.player.vx, state.player.vy, state.player.vz) < 0.001);
  assert.ok(Math.abs(state.player.yawRate) < 0.0001);
  assert.equal(state.player.boostActive, false);
  assert.ok(state.player.boost > 50);
  const stopped = { x: state.player.x, y: state.player.y, z: state.player.z };
  run(state, 1, input);
  assert.ok(Math.hypot(state.player.x - stopped.x, state.player.y - stopped.y, state.player.z - stopped.z) < 0.001);
});

test('releasing helm brake restores propulsion and steering normally', () => {
  const state = emptyState();
  run(state, 1, { helm: { brake: true }, boost: true });
  assert.equal(state.player.boostActive, false);
  const before = { x: state.player.x, y: state.player.y, z: state.player.z, heading: state.player.heading };
  run(state, 1, { helm: { throttle: 1, turn: -1, rise: 0.5 } });
  assert.ok(Math.hypot(state.player.x - before.x, state.player.z - before.z) > 3);
  assert.ok(state.player.y > before.y + 2);
  assert.ok(state.player.yawRate < -0.5);
  assert.ok(state.player.heading < before.heading - 0.2);
  run(state, 0.5, { helm: { throttle: 1 }, boost: true });
  assert.equal(state.player.boostActive, true);
});

test('same XZ but a different altitude misses; correct XYZ aim hits and defeats', () => {
  const wrong = emptyState();
  wrong.targets = [targetAt(0, 25, -20)];
  run(wrong, 0.6, { fire: true, aim: { x: 0, y: 8, z: -20 } });
  run(wrong, 1.2);
  assert.ok(wrong.stats.shots >= 3);
  assert.equal(wrong.stats.hits, 0);
  assert.equal(wrong.targets[0].hp, 60);
  const correct = emptyState();
  correct.targets = [targetAt(0, 25, -20)];
  run(correct, 0.6, { fire: true, aim: { x: 0, y: 25, z: -20 } });
  run(correct, 1.2);
  assert.equal(correct.stats.hits, 3);
  assert.equal(correct.stats.kills, 1);
  assert.equal(correct.targets[0].defeated, true);
  assert.equal(correct.events.filter((event) => event.type === 'target-defeated').length, 1);
});

test('swept sphere hits a tiny target between projectile endpoints', () => {
  const state = emptyState();
  state.targets = [{ ...targetAt(0, 8, 0), radius: 0.08 }];
  state.projectiles.push({ id: 'fast', owner: 'player', x: 0, y: 8, z: 50, px: 0, py: 8, pz: 50, vx: 0, vy: 0, vz: -20000, radius: 0.02, damage: 60, life: 1 });
  stepFlight(state, 1 / 60);
  assert.equal(state.targets[0].defeated, true);
  assert.equal(state.projectiles.length, 0);
  assert.equal(segmentSphereHit({ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1), 0.45);
});

test('a ship can pass above and below an island but is blocked at its height', () => {
  const island = { id: 'island', kind: 'ellipsoid', x: 0, y: 8, z: 0, rx: 6, ry: 4, rz: 6 };
  for (const y of [0, 16]) {
    const state = emptyState();
    Object.assign(state.player, { x: -20, y, z: 0 });
    state.obstacles = [island];
    run(state, 3, { moveX: 1 });
    assert.ok(state.player.x > 15, `should pass island at altitude ${y}`);
    assert.equal(state.stats.collisions, 0);
  }
  const blocked = emptyState();
  Object.assign(blocked.player, { x: -20, y: 8, z: 0 });
  blocked.obstacles = [island];
  run(blocked, 3, { moveX: 1 });
  assert.ok(blocked.player.x < -7.79);
  assert.ok(blocked.stats.collisions >= 1);
  assert.ok(obstacleDistance(blocked.player, island).distance >= blocked.player.radius - 0.0001);
});

test('swept terrain blocks high-speed motion, while sphere-box corners stay rounded', () => {
  const box = { id: 'thin-wall', kind: 'box', x: 0, y: 8, z: 0, half: { x: 0.1, y: 3, z: 8 } };
  const state = emptyState();
  state.obstacles = [box];
  Object.assign(state.player, { x: -40, y: 8, z: 0, vx: 10000 });
  stepFlight(state, 1 / 60);
  assert.ok(state.player.x < -1.89);
  const corner = { id: 'corner', kind: 'box', x: 0, y: 0, z: 0, half: { x: 1, y: 1, z: 1 } };
  const outsideRoundCorner = { x: 2.2, y: 2.2, z: 0 };
  close(obstacleDistance(outsideRoundCorner, corner).distance, Math.sqrt(2) * 1.2);
  assert.equal(sweepObstacle(outsideRoundCorner, outsideRoundCorner, corner, 1.5), null);
});

test('ellipsoid closest distance is Euclidean and gives the correct axis contact', () => {
  const island = { kind: 'ellipsoid', x: 0, y: 0, z: 0, rx: 10, ry: 4, rz: 6 };
  close(obstacleDistance({ x: 13, y: 0, z: 0 }, island).distance, 3);
  close(obstacleDistance({ x: 0, y: 7, z: 0 }, island).distance, 3);
  close(obstacleDistance({ x: 0, y: 0, z: 0 }, island).distance, -4);
  const hit = sweepObstacle({ x: -30, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }, island, 2);
  assert.ok(hit);
  close(hit.point.x, -12, 0.0001);
  assert.ok(hit.normal.x < -0.999);
});

test('terrain occludes projectiles, including targets behind it at the same height', () => {
  const state = emptyState();
  state.targets = [targetAt(0, 8, -20)];
  state.obstacles = [{ id: 'shield-island', kind: 'ellipsoid', x: 0, y: 8, z: 0, rx: 8, ry: 6, rz: 8 }];
  run(state, 0.6, { fire: true, aim: state.targets[0] });
  run(state, 1.2);
  assert.equal(state.stats.hits, 0);
  assert.equal(state.targets[0].hp, 60);
});

test('pause freezes the complete state: movement, AI, shots, effects and time', () => {
  const state = emptyState({ combatEnabled: true });
  state.targets = [targetAt(0, 8, 0)];
  run(state, 0.5, { moveY: 1, fire: true, aim: state.targets[0] });
  state.paused = true;
  const frozen = structuredClone(state);
  stepFlight(state, 2, { moveY: -1, fire: true });
  assert.deepEqual(state, frozen);
  state.paused = false;
  const inputPaused = structuredClone(state);
  stepFlight(state, 2, { pause: true, moveX: 1 });
  assert.deepEqual(state, inputPaused);
});

test('gates require their real altitude and must be crossed in sequence', () => {
  const state = emptyState();
  state.gates = [
    { id: 'upper', x: 0, y: 25, z: 40, radius: 5.5, heightTolerance: 3.5, passed: false },
    { id: 'lower', x: 0, y: 0, z: 40, radius: 5.5, heightTolerance: 3.5, passed: false },
  ];
  stepFlight(state, 1 / 60);
  assert.equal(state.routeIndex, 0);
  state.player.y = 0;
  stepFlight(state, 1 / 60);
  assert.equal(state.routeIndex, 0);
  state.player.y = 25;
  stepFlight(state, 1 / 60);
  assert.equal(state.routeIndex, 1);
  assert.equal(state.stats.checkpoints, 1);
  state.player.y = 0;
  stepFlight(state, 1 / 60);
  assert.equal(state.completed, true);
  assert.equal(state.routeIndex, 2);
  assert.ok(state.finishTime > 0);
  stepFlight(state, 0.1);
  assert.equal(state.events.filter((event) => event.type === 'route-complete').length, 1);
});

test('all default gates are clear of collider volumes and include real ascent/descent', () => {
  const state = createFlightState();
  assert.equal(state.combatEnabled, false);
  assert.ok(Math.min(...state.gates.map((gate) => gate.y)) < 0);
  assert.ok(Math.max(...state.gates.map((gate) => gate.y)) > 30);
  for (const gate of state.gates) {
    for (const obstacle of state.obstacles) {
      assert.ok(obstacleDistance(gate, obstacle).distance > gate.radius + state.player.radius, `${gate.id} overlaps ${obstacle.id}`);
    }
  }
});

test('the complete default altitude route is flyable with movement input only', () => {
  const state = createFlightState();
  for (let frame = 0; frame < 120 * 60 && !state.completed; frame++) {
    const p = state.player;
    const gate = state.gates[state.routeIndex];
    const delta = { x: gate.x - p.x, y: gate.y - p.y, z: gate.z - p.z };
    const distance = Math.hypot(delta.x, delta.y, delta.z);
    const scale = Math.min(1, distance / 6) / Math.max(0.001, distance);
    stepFlight(state, 1 / 120, {
      moveX: delta.x * scale - p.vx * 0.025,
      moveY: delta.y * scale - p.vy * 0.025,
      moveZ: delta.z * scale - p.vz * 0.025,
    });
  }
  assert.equal(state.completed, true);
  assert.equal(state.stats.checkpoints, 5);
  assert.equal(state.stats.collisions, 0);
  assert.ok(state.finishTime > 15 && state.finishTime < 40);
  assert.equal(state.player.hp, 100);
});

test('enemy attacks telegraph their fixed XYZ aim, then can hit or be dodged vertically', () => {
  const stationary = emptyState(true);
  stationary.targets = [targetAt(0, 8, 0)];
  run(stationary, 0.5);
  assert.ok(stationary.targets[0].telegraph);
  assert.equal(stationary.targets[0].telegraph.aim.y, 8);
  run(stationary, 2.5);
  assert.equal(stationary.stats.enemyShots, 1);
  assert.equal(stationary.player.hp, 90);
  const evading = emptyState(true);
  evading.targets = [targetAt(0, 8, 0)];
  run(evading, 0.5);
  run(evading, 2.5, { moveY: 1 });
  assert.equal(evading.stats.enemyShots, 1);
  assert.equal(evading.player.hp, 100);
  assert.ok(evading.player.y > 35);
});

test('safe flight cancels enemy telegraphs and in-flight enemy shots', () => {
  const state = emptyState(true);
  state.targets = [targetAt(0, 8, 0)];
  run(state, 1.5);
  assert.ok(state.projectiles.some((projectile) => projectile.owner === 'enemy'));
  const before = structuredClone({ player: state.player, time: state.time, stats: state.stats, routeIndex: state.routeIndex });
  setCombatEnabled(state, false);
  assert.equal(state.projectiles.some((projectile) => projectile.owner === 'enemy'), false);
  assert.equal(state.targets[0].telegraph, null);
  assert.deepEqual({ player: state.player, time: state.time, stats: state.stats, routeIndex: state.routeIndex }, before);
  run(state, 1);
  assert.equal(state.projectiles.some((projectile) => projectile.owner === 'enemy'), false);
  assert.equal(state.targets[0].telegraph, null);
  assert.equal(state.player.hp, 100);
});

test('bounded history, event sequence, world limits, and reset remain independent', () => {
  const state = emptyState();
  run(state, 20, { moveY: 1, fire: true, aim: { x: 100, y: 8, z: 40 } });
  assert.equal(state.events.length, 64);
  assert.ok(state.events[0].seq < state.events[63].seq);
  assert.ok(state.player.y <= FLIGHT_CONFIG.bounds.maxY - state.player.radius);
  assert.equal(state.player.vy, 0);
  const fresh = createFlightState();
  assert.equal(fresh.time, 0);
  assert.equal(fresh.events.length, 0);
  assert.equal(fresh.player.y, 8);
  assert.equal(fresh.stats.shots, 0);
});
