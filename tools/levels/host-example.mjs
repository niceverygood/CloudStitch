import { toBattlefield, availableSpawns, nearbyTriggers, placementReport } from './adapter.mjs';

/** Convert host positions explicitly. This module never advances sim or edits it. */
export function levelsHeadingToEncounters(theta) { return -theta - Math.PI / 2; }
export function encountersHeadingToLevels(angle) { return -angle - Math.PI / 2; }

export function battlefieldSpatialInput(level) {
  if (level.id !== 'first-voyage') throw new Error('Legacy circle bridge is only authored for first-voyage. Harbor AABBs need a host collision adapter.');
  const obstacles = level.colliders.filter(c => c.legacyCircleXZ).map(c => ({ ...c.legacyCircleXZ }));
  const returnTrigger = level.triggers.find(t => t.type === 'return-request');
  return {
    obstacles,
    proposedPlayerStart: { ...toBattlefield(level.playerStart.position), angle: level.playerStart.headingRadians },
    proposedHarbor: { ...returnTrigger.hostLegacyCircleXZ },
    note: 'Pass obstacles once to createSimulation({obstacles}); do not append them to the old world obstacles. Existing sim owns state/time/damage and eligibility. Apply proposed anchors only through the host-owned initialization API.'
  };
}

/** Host reserves candidates one at a time; two unreserved simultaneous queries can overlap. */
export function encounterSpawnCandidates(level, halfExtents, occupied = []) {
  return availableSpawns(level, halfExtents, occupied).filter(a => a.available && a.tags.includes('enemy')).map(a => ({ anchorId: a.id, ...toBattlefield(a.position), angleBattlefield: a.headingRadians, angleEncounters: levelsHeadingToEncounters(a.headingRadians), tags: [...a.tags] }));
}

export function harborRequests(level, simSnapshot, halfExtents) {
  const position = [simSnapshot.player.x, level.flightY, simSnapshot.player.z];
  const placement = placementReport(level, position, halfExtents);
  if (!placement.insideBounds || placement.solidIds.length) return [];
  return nearbyTriggers(level, position, halfExtents).map(t => ({ triggerId: t.id, type: t.type, target: t.target, requiresConfirmation: t.requiresConfirmation, owner: t.owner, note: 'Availability only. Host confirms transition and settlement/save idempotence.' }));
}
