import test from 'node:test';
import assert from 'node:assert/strict';
import { artToLevel, levelToArt, toScreenPlane, fromScreenPlane, toBattlefield, fromBattlefield, placementReport, sweepSolids, availableSpawns, nearbyTriggers, cameraOccluders, corridorReport } from './adapter.mjs';

const close = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-8));
const fixture = () => ({ bounds: { min: [-50, -10, -50], max: [50, 10, 50] }, colliders: [{ id: 'thin-wall', kind: 'solid', center: [0, 0, 0], halfExtents: [.05, 5, 5], occludesCamera: true, visualIds: ['wall-art'] }], spawnAnchors: [{ id: 'safe', position: [-15, 0, 0] }, { id: 'wall', position: [0, 0, 0] }, { id: 'outside', position: [50, 0, 0] }], triggers: [{ id: 'return', center: [-15, 0, 0], halfExtents: [4, 4, 4], requiresConfirmation: true }] });

test('D/LU transform is invertible after offset, yaw and scale; unit invalidity fails', () => {
  for (const yawRadians of [0, .73, Math.PI / 2, -2.3]) {
    const frame = { origin: [13, -4, 29], unitsPerArtUnit: 3.7, yawRadians };
    close(levelToArt(artToLevel([2, -1, 4], frame), frame), [2, -1, 4]);
  }
  assert.throws(() => artToLevel([0, 0, 0], { origin: [0, 0, 0], unitsPerArtUnit: 0, yawRadians: 0 }));
});

test('host bridge keeps altitude explicit and supports both Y signs', () => {
  for (const ySign of [1, -1]) {
    const bridge = { origin: [300, 200], unitsPerLU: 4, ySign };
    close(fromBattlefield(toBattlefield([3, 7, -2], bridge), 7, bridge), [3, 7, -2]);
    close(fromScreenPlane(toScreenPlane([3, 7, -2], bridge), 7, bridge), [3, 7, -2]);
  }
  assert.deepEqual(toBattlefield([3, 7, -2]), { x: 3, z: -2 });
});

test('continuous sweep catches a thin wall even when both endpoints are clear', () => {
  const level = fixture();
  assert.equal(placementReport(level, [-20, 0, 0], [1, 1, 1]).solidIds.length, 0);
  assert.equal(placementReport(level, [20, 0, 0], [1, 1, 1]).solidIds.length, 0);
  const hit = sweepSolids(level, [-20, 0, 0], [20, 0, 0], [1, 1, 1])[0];
  assert.equal(hit.id, 'thin-wall'); assert.ok(hit.hit.t > .47 && hit.hit.t < .48);
  assert.equal(sweepSolids(level, [-20, 8, 0], [20, 8, 0], [1, 1, 1]).length, 0);
});

test('spawn queries reject solids, bounds and current occupancy without mutating state', () => {
  const level = fixture(), before = JSON.stringify(level);
  assert.deepEqual(availableSpawns(level, [1, 1, 1]).map(a => a.available), [true, false, false]);
  assert.equal(availableSpawns(level, [1, 1, 1], [{ id: 'reserved', position: [-15, 0, 0], halfExtents: [2, 2, 2] }])[0].available, false);
  assert.equal(JSON.stringify(level), before);
});

test('trigger overlap only returns data and camera occlusion leaves solids intact', () => {
  const level = fixture(), before = JSON.stringify(level);
  assert.equal(nearbyTriggers(level, [-15, 0, 0])[0].requiresConfirmation, true);
  assert.equal(nearbyTriggers(level, [20, 0, 0]).length, 0);
  assert.deepEqual(cameraOccluders(level, [-10, 2, 0], [10, 2, 0])[0].visualIds, ['wall-art']);
  assert.equal(cameraOccluders(level, [-10, 8, 0], [10, 8, 0]).length, 0);
  assert.equal(JSON.stringify(level), before);
});

test('corridor clear rejects width failure and nearby geometry within the declared tube', () => {
  const empty = { ...fixture(), colliders: [] };
  assert.equal(corridorReport(empty, { id: 'too-narrow', widthLU: 1, points: [[-10, 0, 10], [10, 0, 10]] }, [1, 1, 1]).clear, false);
  const report = corridorReport(fixture(), { id: 'near-wall', widthLU: 12, points: [[-10, 0, 8], [10, 0, 8]] }, [1, 1, 1]);
  assert.equal(report.bodyClear, true); assert.equal(report.envelopeClear, false); assert.equal(report.clear, false);
});
