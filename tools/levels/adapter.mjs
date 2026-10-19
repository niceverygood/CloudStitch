/** Pure spatial queries. No movement, damage, encounter order, rewards or saves. */
const EPSILON = 1e-8;
const finiteVector = (v, name) => {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) throw new TypeError(`${name} must be a finite [x,y,z].`);
  return v;
};

export function validateFrame(frame) {
  finiteVector(frame.origin, 'frame.origin');
  if (!Number.isFinite(frame.unitsPerArtUnit) || frame.unitsPerArtUnit <= 0) throw new RangeError('unitsPerArtUnit must be positive.');
  if (!Number.isFinite(frame.yawRadians)) throw new TypeError('yawRadians must be finite.');
  return frame;
}

/** Art D is a relative assembly unit; this explicit transform never claims meters. */
export function artToLevel(point, frame) {
  validateFrame(frame); finiteVector(point, 'point');
  const c = Math.cos(frame.yawRadians), s = Math.sin(frame.yawRadians), k = frame.unitsPerArtUnit;
  return [frame.origin[0] + k * (c * point[0] + s * point[2]), frame.origin[1] + k * point[1], frame.origin[2] + k * (-s * point[0] + c * point[2])];
}

export function levelToArt(point, frame) {
  validateFrame(frame); finiteVector(point, 'point');
  const p = point.map((v, i) => (v - frame.origin[i]) / frame.unitsPerArtUnit), c = Math.cos(frame.yawRadians), s = Math.sin(frame.yawRadians);
  return [c * p[0] - s * p[2], p[1], s * p[0] + c * p[2]];
}

/** Optional screen-space bridge, distinct from BOTH XZ simulation hosts. */
export function toScreenPlane(point, bridge) {
  finiteVector(point, 'point');
  if (!Number.isFinite(bridge?.unitsPerLU) || bridge.unitsPerLU <= 0 || ![1, -1].includes(bridge.ySign) || !Array.isArray(bridge.origin) || bridge.origin.length !== 2 || !bridge.origin.every(Number.isFinite)) throw new TypeError('Invalid battlefield bridge.');
  return { x: bridge.origin[0] + point[0] * bridge.unitsPerLU, y: bridge.origin[1] + point[2] * bridge.unitsPerLU * bridge.ySign };
}

export function fromScreenPlane(point, altitude, bridge) {
  toScreenPlane([0, 0, 0], bridge);
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y) || !Number.isFinite(altitude)) throw new TypeError('Invalid host point.');
  return [(point.x - bridge.origin[0]) / bridge.unitsPerLU, altitude, (point.y - bridge.origin[1]) / (bridge.unitsPerLU * bridge.ySign)];
}

/** Existing battlefield sim.mjs uses {x,z}, Y-up, +Z heading zero. */
export function toBattlefield(point, bridge = { origin: [0, 0], unitsPerLU: 1, ySign: 1 }) {
  const projected = toScreenPlane(point, bridge);
  return { x: projected.x, z: projected.y };
}

export function fromBattlefield(point, altitude = 0, bridge = { origin: [0, 0], unitsPerLU: 1, ySign: 1 }) {
  return fromScreenPlane({ x: point?.x, y: point?.z }, altitude, bridge);
}

export function boxAt(center, halfExtents) {
  finiteVector(center, 'center'); finiteVector(halfExtents, 'halfExtents');
  if (halfExtents.some(v => v < 0)) throw new RangeError('halfExtents must be nonnegative.');
  return { min: center.map((v, i) => v - halfExtents[i]), max: center.map((v, i) => v + halfExtents[i]) };
}

export function intersectsAABB(a, b) {
  return a.min.every((v, i) => v <= b.max[i] + EPSILON && a.max[i] >= b.min[i] - EPSILON);
}

export function containsAABB(outer, inner) {
  return outer.min.every((v, i) => inner.min[i] >= v - EPSILON && inner.max[i] <= outer.max[i] + EPSILON);
}

export function overlappingSolids(level, position, halfExtents) {
  const body = boxAt(position, halfExtents);
  return level.colliders.filter(item => item.kind === 'solid' && intersectsAABB(body, boxAt(item.center, item.halfExtents)));
}

export function placementReport(level, position, halfExtents) {
  return { insideBounds: containsAABB(level.bounds, boxAt(position, halfExtents)), solidIds: overlappingSolids(level, position, halfExtents).map(item => item.id) };
}

/** Expanded-box slab cast; callers own movement resolution and physical response. */
export function segmentAABB(start, end, box, expansion = [0, 0, 0]) {
  finiteVector(start, 'start'); finiteVector(end, 'end'); finiteVector(expansion, 'expansion');
  if (expansion.some(v => v < 0)) throw new RangeError('expansion must be nonnegative.');
  let enter = 0, exit = 1;
  for (let axis = 0; axis < 3; axis++) {
    const lo = box.min[axis] - expansion[axis], hi = box.max[axis] + expansion[axis], delta = end[axis] - start[axis];
    if (Math.abs(delta) < EPSILON) { if (start[axis] < lo || start[axis] > hi) return null; continue; }
    const a = (lo - start[axis]) / delta, b = (hi - start[axis]) / delta;
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    if (enter > exit + EPSILON) return null;
  }
  return { t: enter, position: start.map((v, i) => v + (end[i] - v) * enter) };
}

export function sweepSolids(level, start, end, halfExtents) {
  return level.colliders.filter(item => item.kind === 'solid').map(item => ({ id: item.id, hit: segmentAABB(start, end, boxAt(item.center, item.halfExtents), halfExtents) })).filter(item => item.hit).sort((a, b) => a.hit.t - b.hit.t);
}

/** Query only: encounters decides when/what to spawn and reserves occupied space. */
export function availableSpawns(level, bodyHalfExtents, occupied = []) {
  return level.spawnAnchors.map(anchor => {
    const report = placementReport(level, anchor.position, bodyHalfExtents);
    const occupiedIds = occupied.filter(body => intersectsAABB(boxAt(anchor.position, bodyHalfExtents), boxAt(body.position, body.halfExtents))).map(body => body.id);
    return { ...anchor, available: report.insideBounds && report.solidIds.length === 0 && occupiedIds.length === 0, solidIds: report.solidIds, occupiedIds };
  });
}

/** No activation/payout side effects. Host must handle confirmation + idempotence. */
export function nearbyTriggers(level, position, halfExtents = [0, 0, 0]) {
  return level.triggers.filter(trigger => intersectsAABB(boxAt(position, halfExtents), boxAt(trigger.center, trigger.halfExtents)));
}

/** Conservative proxy occlusion, not a pixel/GPU visibility assertion. */
export function cameraOccluders(level, cameraPosition, targetPosition) {
  return level.colliders.filter(item => item.occludesCamera).filter(item => segmentAABB(cameraPosition, targetPosition, boxAt(item.center, item.halfExtents))).map(item => ({ colliderId: item.id, visualIds: item.visualIds || [], policy: item.cameraPolicy || 'fade-visual-only' }));
}

export function corridorReport(level, corridor, halfExtents) {
  if (!Number.isFinite(corridor.widthLU) || corridor.widthLU <= 0 || !Array.isArray(corridor.points) || corridor.points.length < 2) throw new TypeError('Corridor needs a positive width and at least two points.');
  const segments = corridor.points.slice(1).map((end, index) => ({ index, hits: sweepSolids(level, corridor.points[index], end, halfExtents) }));
  const insideBounds = corridor.points.every(point => placementReport(level, point, halfExtents).insideBounds);
  const tubeHalfExtents = [corridor.widthLU / 2, halfExtents[1], corridor.widthLU / 2];
  const envelopeInsideBounds = corridor.points.every(point => placementReport(level, point, tubeHalfExtents).insideBounds);
  const envelopeSegments = corridor.points.slice(1).map((end, index) => ({ index, hits: sweepSolids(level, corridor.points[index], end, tubeHalfExtents) }));
  const widthMarginLU = corridor.widthLU - 2 * Math.max(halfExtents[0], halfExtents[2]);
  const bodyClear = insideBounds && segments.every(segment => segment.hits.length === 0);
  const envelopeClear = envelopeInsideBounds && envelopeSegments.every(segment => segment.hits.length === 0);
  return { id: corridor.id, insideBounds, segments, bodyClear, envelopeClear, envelopeSegments, clear: bodyClear && envelopeClear && widthMarginLU >= 0, minimumWidthLU: corridor.widthLU, bodyWidthLU: 2 * Math.max(halfExtents[0], halfExtents[2]), widthMarginLU };
}
