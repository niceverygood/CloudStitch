/**
 * Visual scenery only. Every position is an absolute world coordinate, never
 * relative to the current player/camera. No simulation object is changed.
 * `scale` is the world-space longest dimension of a centered, unit-normalized
 * map-atmosphere model. The renderer normalizes each source model only once.
 */
export const ENVIRONMENT_LAYERS = Object.freeze([-12, 8, 26, 44, 62]);
export const ENVIRONMENT_BUDGET = Object.freeze({ nearClouds: 24, distantClouds: 16, landmarks: 16, islands: 8, motes: 80 });

const TAU = Math.PI * 2;
const CLOUDS = ['sunlit-cloud', 'mist-ribbons', 'rising-cloud', 'storm-front'];
const PROPS = ['mail-balloon', 'lantern-buoy', 'wind-ribbon-mast', 'star-lanterns'];
const ISLANDS = ['root-garden', 'crescent-pass', 'double-arch', 'water-terraces', 'wreck-garden', 'quiet-terrace'];
const FALLBACK_BOUNDS = { minX: -110, maxX: 110, minY: -18, maxY: 60, minZ: -110, maxZ: 110 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const round = (n) => Math.round(n * 1000) / 1000;

function hash(index, salt = 0) {
  let n = Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt + 7, 0x27d4eb2d);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}

function segmentDistance(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy + (point.z - a.z) * dz) / lengthSquared)) : 0;
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy, point.z - a.z - t * dz);
}

function protection(state, bounds) {
  const gates = state.gates || [];
  // The final gate is the authored departure/return point. Using the mutable
  // player transform here would make scenery jump if rebuilt during flight.
  const spawn = gates.at(-1) || { x: (bounds.minX + bounds.maxX) / 2, y: 8, z: bounds.maxZ - 70 };
  const route = [spawn, ...gates];
  return {
    spawn, gates, targets: state.targets || [], obstacles: state.obstacles || [],
    segments: route.slice(1).map((point, i) => [route[i], point]),
    camera: { x: spawn.x, y: spawn.y + 10, z: spawn.z + 34 },
  };
}

function clearOfFlight(point, radius, protectedSpace, tiny = false) {
  const { spawn, camera, gates, targets, segments, obstacles } = protectedSpace;
  if (distance(point, spawn) < radius + (tiny ? 6 : 16) || distance(point, camera) < radius + (tiny ? 3 : 12)) return false;
  if (segmentDistance(point, spawn, camera) < radius + (tiny ? 3 : 9)) return false;
  if (gates.some((gate) => distance(point, gate) < radius + (gate.radius || 5.5) + 5)) return false;
  if (targets.some((target) => distance(point, target) < radius + (target.radius || 3) + 7)) return false;
  if (segments.some(([a, b]) => segmentDistance(point, a, b) < radius + (tiny ? 2 : 7))) return false;
  // Preserve direct shooting sight lines from the start. Camera position is
  // checked separately above; this is a readability corridor, not a collider.
  if (!tiny && targets.some((target) => segmentDistance(point, spawn, target) < radius + 3)) return false;
  if (!tiny && obstacles.some((obstacle) => {
    const extent = obstacle.kind === 'box'
      ? Math.hypot(obstacle.half.x, obstacle.half.y, obstacle.half.z)
      : Math.max(obstacle.rx, obstacle.ry, obstacle.rz);
    return distance(point, obstacle) < radius + extent + 2;
  })) return false;
  return true;
}

function entry(id, kind, point, scale, tier, clearanceRadius, phaseIndex) {
  return { id, kind, x: round(point.x), y: round(point.y), z: round(point.z), scale: round(scale), phase: round(hash(phaseIndex, 19) * TAU), tier, clearanceRadius: round(clearanceRadius) };
}

/** Build a deterministic, bounded scenery plan for the authored flight arena. */
export function buildEnvironmentLayout(state) {
  const bounds = { ...FALLBACK_BOUNDS, ...state.bounds };
  const protectedSpace = protection(state, bounds);
  const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
  const halfX = (bounds.maxX - bounds.minX) / 2, halfZ = (bounds.maxZ - bounds.minZ) / 2;
  const clouds = [], landmarks = [], islands = [], motes = [];

  for (let i = 0; i < ENVIRONMENT_BUDGET.nearClouds; i++) {
    const layer = ENVIRONMENT_LAYERS[i % ENVIRONMENT_LAYERS.length];
    const kind = i % 7 === 4 ? CLOUDS[2] : CLOUDS[i % 2];
    const scale = 12 + hash(i, 1) * 12;
    const radius = 0.62 * scale + 1; // includes breathing clips and ±0.5 sway
    let chosen;
    for (let attempt = 0; attempt < 512; attempt++) {
      const n = i * 521 + attempt;
      const point = {
        x: cx + (hash(n, 2) * 2 - 1) * halfX * 0.92,
        y: layer + (hash(n, 3) - 0.5) * 4,
        z: cz + (hash(n, 4) * 2 - 1) * halfZ * 0.92,
      };
      if (!clearOfFlight(point, radius, protectedSpace)) continue;
      if (clouds.some((cloud) => distance(point, cloud) < (radius + cloud.clearanceRadius) * 0.76)) continue;
      chosen = point; break;
    }
    // A changed arena may be too cramped; omit decoration instead of violating
    // its clear corridor or searching without a bound.
    if (chosen) clouds.push(entry(`cloud-near-${i + 1}`, kind, chosen, scale, 'near', radius, i));
  }

  for (let i = 0; i < ENVIRONMENT_BUDGET.distantClouds; i++) {
    const angle = i / ENVIRONMENT_BUDGET.distantClouds * TAU + (hash(i, 5) - 0.5) * 0.2;
    const tier = i % 3 === 0 ? 'far' : 'middle';
    const scale = tier === 'far' ? 60 + hash(i, 6) * 20 : 36 + hash(i, 6) * 20;
    const radius = 0.62 * scale + 1;
    // Broad cloud walls frame the entire flight space. Starting beyond the
    // bounds' circumscribed circle keeps their full sphere outside by 48 units,
    // including diagonal views, while preserving their dramatic scale.
    const reach = Math.hypot(halfX, halfZ) + radius + 48 + hash(i, 7) * 18;
    const point = { x: cx + Math.cos(angle) * reach, y: ENVIRONMENT_LAYERS[(i + 2) % 5] + (hash(i, 9) - 0.5) * 8, z: cz + Math.sin(angle) * reach };
    // Dark rain masses stay on the horizon; nearer clouds remain warm/light.
    clouds.push(entry(`cloud-distance-${i + 1}`, CLOUDS[i % CLOUDS.length], point, scale, tier, radius, 100 + i));
  }

  const segments = protectedSpace.segments.filter(([a, b]) => distance(a, b) > 1);
  for (let i = 0; i < ENVIRONMENT_BUDGET.landmarks; i++) {
    const [a, b] = segments[i % segments.length] || [protectedSpace.spawn, { ...protectedSpace.spawn, z: protectedSpace.spawn.z - 30 }];
    const dx = b.x - a.x, dz = b.z - a.z, horizontalLength = Math.hypot(dx, dz) || 1;
    const scale = 3 + hash(i, 10) * 2, radius = scale * 0.72 + 1;
    let chosen;
    for (let attempt = 0; attempt < 120; attempt++) {
      const side = (i + Math.floor(attempt / 30)) % 2 ? 1 : -1;
      const t = 0.18 + hash(i * 127 + attempt, 11) * 0.66;
      const offset = 15 + radius + (attempt % 30) * 0.85;
      const point = { x: a.x + dx * t + dz / horizontalLength * offset * side, y: a.y + (b.y - a.y) * t + (hash(i, 12) - 0.5) * 8, z: a.z + dz * t - dx / horizontalLength * offset * side };
      if (point.x < bounds.minX + radius || point.x > bounds.maxX - radius || point.z < bounds.minZ + radius || point.z > bounds.maxZ - radius) continue;
      if (!clearOfFlight(point, radius, protectedSpace)) continue;
      if (landmarks.some((landmark) => distance(point, landmark) < radius + landmark.clearanceRadius + 4)) continue;
      chosen = point; break;
    }
    if (chosen) landmarks.push(entry(`landmark-${i + 1}`, PROPS[i % PROPS.length], chosen, scale, 'near', radius, 200 + i));
  }

  const directions = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  directions.forEach(([dx, dz], i) => {
    const scale = 50 + hash(i, 13) * 28, radius = scale * 0.75 + 1;
    // Entire bounding spheres remain outside the flight box, so large solid
    // silhouettes never suggest an unregistered obstacle inside the arena.
    const point = { x: cx + dx * (halfX + radius + 48), y: ENVIRONMENT_LAYERS[(i + 1) % 5] - 8, z: cz + dz * (halfZ + radius + 48) };
    islands.push(entry(`island-horizon-${i + 1}`, ISLANDS[i % ISLANDS.length], point, scale, 'far', radius, 300 + i));
  });

  for (let i = 0; i < ENVIRONMENT_BUDGET.motes; i++) {
    for (let attempt = 0; attempt < 128; attempt++) {
      const n = i * 131 + attempt;
      let point;
      if (i < ENVIRONMENT_BUDGET.motes / 2 && segments.length) {
        // Forty tiny, non-colliding cues sit close to both sides of the route.
        // They provide near parallax immediately, while large scenery keeps
        // the more generous sight-line and departure clearances above.
        const [a, b] = segments[i % segments.length];
        const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz) || 1;
        const t = 0.1 + hash(n, 18) * 0.8;
        const side = Math.floor(i / segments.length) % 2 ? 1 : -1;
        const offset = 4 + hash(n, 20) * 10;
        point = { x: a.x + dx * t + dz / length * offset * side, y: a.y + (b.y - a.y) * t + (hash(n, 21) - 0.5) * 12, z: a.z + dz * t - dx / length * offset * side };
      } else {
        point = { x: cx + (hash(n, 14) * 2 - 1) * halfX * 0.76, y: ENVIRONMENT_LAYERS[i % 5] + (hash(n, 15) - 0.5) * 14, z: cz + (hash(n, 16) * 2 - 1) * halfZ * 0.76 };
      }
      if (!clearOfFlight(point, 0.4, protectedSpace, true)) continue;
      motes.push(entry(`mote-${i + 1}`, ['wind-seed', 'pollen', 'thread'][i % 3], point, 0.15 + hash(i, 17) * 0.2, 'near', 0.4, 400 + i));
      break;
    }
  }
  return { clouds, landmarks, islands, motes };
}
