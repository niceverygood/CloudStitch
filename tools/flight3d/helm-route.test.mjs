import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightState, stepFlight } from './sim.mjs';

const clamp = (value, min = -1, max = 1) => Math.max(min, Math.min(max, value));

// A reproducible reachability check for the default route through the public
// helm input. It does not certify human control feel, difficulty, or fun.
test('the default five-gate route is reachable with helm input alone', (t) => {
  const state = createFlightState();
  const passed = [];
  for (let frame = 0; frame < 60 * 180 && !state.completed; frame++) {
    const player = state.player;
    const gate = state.gates[state.routeIndex];
    const dx = gate.x - player.x, dy = gate.y - player.y, dz = gate.z - player.z;
    const distance = Math.hypot(dx, dz);
    const desiredHeading = Math.atan2(dx, dz);
    const error = Math.atan2(Math.sin(desiredHeading - player.heading), Math.cos(desiredHeading - player.heading));
    const turn = clamp(error * 2.5 - player.yawRate * 1.6);
    const rise = clamp((dy * 0.9 - player.vy * 0.6) / 11);
    const forwardSpeed = player.vx * Math.sin(player.heading) + player.vz * Math.cos(player.heading);
    const desiredSpeed = Math.min(12, distance * 0.7) * Math.max(0, Math.cos(error));
    const throttle = Math.abs(error) > 0.7 || Math.abs(dy) > 5
      ? 0 : clamp((desiredSpeed + (desiredSpeed - forwardSpeed) * 0.7) / 14, 0, 1);
    const brake = distance < 4 && Math.abs(dy) < 2 && Math.hypot(player.vx, player.vy, player.vz) > 3;
    const previousIndex = state.routeIndex;
    stepFlight(state, 1 / 60, { helm: { throttle, turn, rise, brake } });
    if (state.routeIndex !== previousIndex) passed.push({ gate: gate.id, time: Number(state.time.toFixed(3)) });
  }
  assert.equal(state.completed, true, 'the pilot must finish within the bounded run');
  assert.equal(state.routeIndex, 5);
  assert.equal(state.gates.filter((gate) => gate.passed).length, 5);
  assert.deepEqual(passed.map((entry) => entry.gate), ['gate-1', 'gate-2', 'gate-3', 'gate-4', 'gate-5']);
  assert.equal(state.player.hp, 100);
  assert.equal(state.stats.collisions, 0);
  t.diagnostic(JSON.stringify({ finishTime: Number(state.finishTime.toFixed(3)), checkpoints: state.stats.checkpoints, collisions: state.stats.collisions, hp: state.player.hp, passed }));
});
