import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightState, obstacleDistance } from './sim.mjs';
import { resolveFlightCamera } from './camera-geometry.mjs';

const separation = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function safe(result, obstacles) {
  for (const obstacle of obstacles) {
    assert.ok(obstacleDistance(result.focus, obstacle).distance >= 0.7 - 1e-5, 'focus must stay outside the solid');
    assert.ok(obstacleDistance(result.position, obstacle).distance >= 0.5 - 1e-5, 'camera must stay outside the solid');
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const p = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, result.focus[axis] + (result.position[axis] - result.focus[axis]) * t]));
      assert.ok(obstacleDistance(p, obstacle).distance >= 0.5 - 1e-5, 'camera arm must not cross a solid');
    }
  }
  assert.ok(separation(result.focus, result.position) >= 0.079, 'lookAt needs a nonzero camera arm');
  for (const p of [result.focus, result.position]) for (const axis of ['x', 'y', 'z']) assert.ok(Number.isFinite(p[axis]));
}

test('clear space keeps the requested camera and interpolates without mutating inputs', () => {
  const options = { player: { x: 0, y: 8, z: 40 }, desiredFocus: { x: 0, y: 11, z: 34 }, desiredPosition: { x: 0, y: 18, z: 61 }, previousFocus: { x: 2, y: 9, z: 36 }, previousPosition: { x: 3, y: 20, z: 64 }, blend: 0.5, obstacles: [] };
  const before = structuredClone(options);
  const result = resolveFlightCamera(options);
  assert.deepEqual(result, { focus: { x: 1, y: 10, z: 35 }, position: { x: 1.5, y: 19, z: 62.5 } });
  assert.deepEqual(options, before);
  safe(result, []);
});

test('a valid player outside an island cannot put its forward focus and camera inside', () => {
  const obstacles = [createFlightState().obstacles[0]];
  const player = { x: -25, y: 9, z: 18.9 };
  const desiredFocus = { x: -25, y: 12, z: 12.9 };
  assert.ok(obstacleDistance(player, obstacles[0]).distance > 1.8);
  assert.ok(obstacleDistance(desiredFocus, obstacles[0]).distance < -3);
  const result = resolveFlightCamera({ player, desiredFocus, desiredPosition: { x: -25, y: 12 + Math.sin(0.24) * 28, z: 12.9 + Math.cos(0.24) * 28 }, obstacles });
  safe(result, obstacles);
});

test('smoothing an old focus and camera from the opposite side cannot cross the island', () => {
  const obstacles = [{ kind: 'ellipsoid', x: 0, y: 0, z: 0, rx: 5, ry: 5, rz: 5 }];
  for (const previousPosition of [{ x: 0, y: 0, z: -12 }, { x: 0, y: 0, z: 0 }]) {
    const result = resolveFlightCamera({ player: { x: 0, y: 0, z: 8 }, desiredFocus: { x: 0, y: 1, z: 7 }, desiredPosition: { x: 0, y: 3, z: 18 }, previousFocus: { x: 0, y: 0, z: -8 }, previousPosition, blend: 0.2, obstacles });
    safe(result, obstacles);
    assert.ok(result.focus.z > 5, 'resolved focus must remain on the player side');
    assert.ok(result.position.z > 5, 'eased camera must remain on the player side');
  }
});

test('box penetration is corrected even when smoothing is frozen', () => {
  const obstacles = [{ kind: 'box', x: 0, y: 0, z: 0, half: { x: 5, y: 5, z: 5 } }];
  const result = resolveFlightCamera({ player: { x: 0, y: 0, z: 8 }, desiredFocus: { x: 0, y: 0, z: 2 }, desiredPosition: { x: 0, y: 3, z: 18 }, previousFocus: { x: 0, y: 0, z: 0 }, previousPosition: { x: 0, y: 0, z: 1 }, blend: 0, obstacles });
  safe(result, obstacles);
  assert.ok(result.focus.z > 5 && result.position.z > 5);
});

test('coincident and nonfinite requests still produce a finite, nonzero viewing direction', () => {
  const result = resolveFlightCamera({ player: { x: 0, y: 0, z: 0 }, desiredFocus: { x: 0, y: 0, z: 0 }, desiredPosition: { x: NaN, y: Infinity, z: 0 }, blend: NaN });
  safe(result, []);
  assert.deepEqual(result.focus, { x: 0, y: 0, z: 0 });
});
