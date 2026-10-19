import { obstacleDistance, sweepObstacle } from './sim.mjs';

const FOCUS_RADIUS = 0.7;
const CAMERA_RADIUS = 0.5;
const MARGIN = 0.01;
const length = (v) => Math.hypot(v.x, v.y, v.z);
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const point = (value, fallback = { x: 0, y: 0, z: 0 }) => ({
  x: Number.isFinite(value?.x) ? value.x : fallback.x,
  y: Number.isFinite(value?.y) ? value.y : fallback.y,
  z: Number.isFinite(value?.z) ? value.z : fallback.z,
});

function pushOutside(value, radius, obstacles) {
  const result = point(value);
  // A correction against one solid can enter another. Repeat the complete
  // set, rather than assuming that the first separating normal is sufficient.
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (const obstacle of obstacles) {
      const contact = obstacleDistance(result, obstacle);
      const depth = radius + MARGIN - contact.distance;
      if (depth <= 1e-7) continue;
      result.x += contact.normal.x * depth;
      result.y += contact.normal.y * depth;
      result.z += contact.normal.z * depth;
      changed = true;
    }
    if (!changed) break;
  }
  return result;
}

function clipSegment(start, end, radius, obstacles) {
  const travel = length(subtract(end, start));
  if (travel < 1e-8) return pushOutside(start, radius, obstacles);
  let fraction = 1;
  for (const obstacle of obstacles) {
    const hit = sweepObstacle(start, end, obstacle, radius);
    if (hit) fraction = Math.min(fraction, Math.max(0, hit.t - MARGIN / travel));
  }
  return pushOutside(mix(start, end, fraction), radius, obstacles);
}

/**
 * Resolve presentation geometry only; never move the player or advance time.
 * Focus is checked from the safe player position before and after smoothing.
 * Camera easing is checked again from that resolved focus, so an old camera
 * across an island cannot pull the new frame through the island.
 */
export function resolveFlightCamera({ player, desiredFocus, desiredPosition, previousFocus, previousPosition, blend = 1, obstacles = [] }) {
  const t = Number.isFinite(blend) ? Math.max(0, Math.min(1, blend)) : 1;
  const anchor = pushOutside(point(player), FOCUS_RADIUS, obstacles);
  const targetFocus = clipSegment(anchor, point(desiredFocus, anchor), FOCUS_RADIUS, obstacles);
  let focus = clipSegment(anchor, mix(point(previousFocus, targetFocus), targetFocus, t), FOCUS_RADIUS, obstacles);
  focus = pushOutside(focus, FOCUS_RADIUS, obstacles);

  const targetPosition = clipSegment(focus, point(desiredPosition, focus), CAMERA_RADIUS, obstacles);
  let position = clipSegment(focus, mix(point(previousPosition, targetPosition), targetPosition, t), CAMERA_RADIUS, obstacles);
  position = pushOutside(position, CAMERA_RADIUS, obstacles);

  if (length(subtract(position, focus)) < 0.08) {
    let direction = subtract(point(desiredPosition, focus), point(desiredFocus, focus));
    if (length(direction) < 1e-8) direction = { x: 0, y: 0.2, z: 1 };
    const scale = 0.1 / length(direction);
    // The focus has a larger safety radius than the camera. This short arm
    // fits within that clearance and gives lookAt a nonzero direction.
    position = clipSegment(focus, {
      x: focus.x + direction.x * scale,
      y: focus.y + direction.y * scale,
      z: focus.z + direction.z * scale,
    }, CAMERA_RADIUS, obstacles);
  }
  return { focus, position };
}
