import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightState, stepFlight } from './sim.mjs';
import { buildEnvironmentLayout, ENVIRONMENT_LAYERS, ENVIRONMENT_BUDGET } from './environment-layout.mjs';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function segmentDistance(p, a, b) {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const squared = d.x ** 2 + d.y ** 2 + d.z ** 2;
  const t = squared ? Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y + (p.z - a.z) * d.z) / squared)) : 0;
  return Math.hypot(p.x - a.x - d.x * t, p.y - a.y - d.y * t, p.z - a.z - d.z * t);
}

test('the default plan fills its bounded scenery budget across five height layers', (t) => {
  const layout = buildEnvironmentLayout(createFlightState());
  assert.equal(layout.clouds.filter((cloud) => cloud.tier === 'near').length, ENVIRONMENT_BUDGET.nearClouds);
  assert.equal(layout.clouds.length, ENVIRONMENT_BUDGET.nearClouds + ENVIRONMENT_BUDGET.distantClouds);
  assert.equal(layout.landmarks.length, ENVIRONMENT_BUDGET.landmarks);
  assert.equal(layout.islands.length, ENVIRONMENT_BUDGET.islands);
  assert.equal(layout.motes.length, ENVIRONMENT_BUDGET.motes);
  for (const layer of ENVIRONMENT_LAYERS) {
    assert.ok(layout.clouds.some((cloud) => cloud.tier === 'near' && Math.abs(cloud.y - layer) <= 2.01), `near cloud coverage at Y=${layer}`);
    assert.ok(layout.motes.some((mote) => Math.abs(mote.y - layer) <= 7.01), `mote coverage at Y=${layer}`);
  }
  assert.equal(new Set(layout.clouds.map((cloud) => cloud.kind)).size, 4);
  assert.equal(new Set(layout.landmarks.map((landmark) => landmark.kind)).size, 4);
  assert.deepEqual(new Set(layout.clouds.map((cloud) => cloud.tier)), new Set(['near', 'middle', 'far']));
  for (const cloud of layout.clouds) {
    assert.ok(cloud.tier === 'near' ? cloud.scale >= 12 && cloud.scale <= 24 : cloud.scale >= 36 && cloud.scale <= 80);
    assert.ok(cloud.clearanceRadius > cloud.scale * 0.55);
  }
  for (const landmark of layout.landmarks) assert.ok(landmark.scale >= 3 && landmark.scale <= 5 && landmark.clearanceRadius > landmark.scale * 0.55);
  for (const island of layout.islands) assert.ok(island.scale >= 50 && island.scale <= 78 && island.clearanceRadius > island.scale * 0.55);
  for (const mote of layout.motes) assert.ok(mote.scale >= 0.15 && mote.scale <= 0.35);
  t.diagnostic(JSON.stringify(Object.fromEntries(Object.entries(layout).map(([key, entries]) => [key, entries.length]))));
});

test('the layout is deterministic, finite, uniquely identified, and does not mutate the simulation', () => {
  const state = createFlightState();
  const before = structuredClone(state);
  const layout = buildEnvironmentLayout(state);
  assert.deepEqual(state, before);
  assert.deepEqual(layout, buildEnvironmentLayout(state));
  const entries = Object.values(layout).flat();
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  for (const entry of entries) {
    for (const key of ['x', 'y', 'z', 'scale', 'phase', 'clearanceRadius']) assert.ok(Number.isFinite(entry[key]), `${entry.id}.${key}`);
    assert.ok(entry.scale > 0 && entry.clearanceRadius > 0);
  }
});

test('rebuilding after flight, target damage, route progress, or pause does not attach scenery to the ship', () => {
  const state = createFlightState();
  const layout = buildEnvironmentLayout(state);
  for (let frame = 0; frame < 120; frame++) stepFlight(state, 1 / 60, { helm: { throttle: 1, turn: -0.3, rise: 0.5 } });
  state.targets[0].hp = 0;
  state.targets[0].defeated = true;
  state.routeIndex = 2;
  state.gates[0].passed = true;
  state.paused = true;
  assert.notEqual(state.player.z, 40);
  assert.deepEqual(buildEnvironmentLayout(state), layout);
});

test('cloud volumes and landmarks leave the start, initial camera, gates, route corridors and targets readable', () => {
  const state = createFlightState();
  const layout = buildEnvironmentLayout(state);
  const spawn = state.gates.at(-1), camera = { x: spawn.x, y: spawn.y + 10, z: spawn.z + 34 };
  const points = [spawn, ...state.gates];
  for (const entry of [...layout.clouds, ...layout.landmarks]) {
    const r = entry.clearanceRadius - 0.002; // layout rounds coordinates/radius to millimetres
    assert.ok(distance(entry, spawn) >= r + 16, `${entry.id}: departure area`);
    assert.ok(distance(entry, camera) >= r + 12, `${entry.id}: initial camera`);
    assert.ok(segmentDistance(entry, spawn, camera) >= r + 9, `${entry.id}: camera arm`);
    for (const gate of state.gates) assert.ok(distance(entry, gate) >= r + gate.radius + 5, `${entry.id}: ${gate.id}`);
    for (const target of state.targets) {
      assert.ok(distance(entry, target) >= r + target.radius + 7, `${entry.id}: ${target.id}`);
      assert.ok(segmentDistance(entry, spawn, target) >= r + 3, `${entry.id}: initial aim corridor ${target.id}`);
    }
    for (let i = 1; i < points.length; i++) assert.ok(segmentDistance(entry, points[i - 1], points[i]) >= r + 7, `${entry.id}: route leg ${i}`);
    for (const obstacle of state.obstacles) {
      const extent = obstacle.kind === 'box' ? Math.hypot(obstacle.half.x, obstacle.half.y, obstacle.half.z) : Math.max(obstacle.rx, obstacle.ry, obstacle.rz);
      assert.ok(distance(entry, obstacle) >= r + extent + 2, `${entry.id}: existing terrain ${obstacle.id}`);
    }
  }
});

test('large distant islands and cloud walls remain entirely beyond the authored flight bounds', () => {
  const state = createFlightState();
  const layout = buildEnvironmentLayout(state);
  for (const scenery of [...layout.islands, ...layout.clouds.filter((cloud) => cloud.tier !== 'near')]) {
    const dx = Math.max(state.bounds.minX - scenery.x, 0, scenery.x - state.bounds.maxX);
    const dz = Math.max(state.bounds.minZ - scenery.z, 0, scenery.z - state.bounds.maxZ);
    assert.ok(Math.hypot(dx, dz) >= scenery.clearanceRadius + 47.99, `${scenery.id}: full visual sphere outside bounds`);
    assert.ok(!state.obstacles.some((obstacle) => obstacle.id === scenery.id), 'scenery must not register a collider');
  }
});

test('small route cues provide immediate close parallax and cover both sides of every route leg', (t) => {
  const state = createFlightState();
  const { motes } = buildEnvironmentLayout(state);
  const spawn = state.gates.at(-1), points = [spawn, ...state.gates];
  const legs = points.slice(1).map((point, i) => [points[i], point]).filter(([a, b]) => distance(a, b) > 1);
  const nearbyStart = motes.filter((mote) => mote.z <= 55 && distance(mote, spawn) <= 35);
  assert.ok(nearbyStart.length >= 8, 'at least eight small cues must be visible around departure');
  const coverage = legs.map(([a, b], index) => {
    const cues = motes.slice(0, 40).filter((_, i) => i % legs.length === index);
    assert.equal(cues.length, 8, `route leg ${index + 1} has eight close cues`);
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    let left = 0, right = 0;
    for (const cue of cues) {
      const projection = ((cue.x - a.x) * dx + (cue.z - a.z) * dz) / (length * length);
      const side = ((cue.x - a.x) * dz - (cue.z - a.z) * dx) / length;
      assert.ok(Math.abs(side) >= 3.998 && Math.abs(side) <= 14.002, `${cue.id}: side distance`);
      assert.ok(Math.abs(cue.y - a.y - (b.y - a.y) * projection) <= 6.002, `${cue.id}: height near authored leg`);
      if (side < 0) left++; else right++;
    }
    assert.equal(left, 4); assert.equal(right, 4);
    return { leg: index + 1, left, right };
  });
  for (const layer of ENVIRONMENT_LAYERS) assert.ok(motes.slice(40).some((mote) => Math.abs(mote.y - layer) <= 7.01), `global tiny cues at Y=${layer}`);
  for (const mote of motes) {
    assert.ok(distance(mote, spawn) >= mote.clearanceRadius + 5.998, `${mote.id}: modest departure clearance`);
  }
  t.diagnostic(JSON.stringify({ nearDeparture: nearbyStart.length, routeCues: motes.slice(0, 40).length, globalCues: motes.slice(40).length, coverage }));
});
