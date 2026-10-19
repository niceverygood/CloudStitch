/** Shared pure policy: testable without a DOM, WebGL or a second simulation. */
export function showBossBanner(snapshot) {
  return Boolean(snapshot.banner && snapshot.bannerTime > 0 && !snapshot.paused && !snapshot.telegraphs?.length && !['maintenance', 'victory', 'defeat'].includes(snapshot.phase));
}

export function displayedActorHeading(actor) {
  return actor.chargeTime > 0 && Number.isFinite(actor.chargeAngle) ? actor.chargeAngle : Number.isFinite(actor.angle) ? actor.angle : 0;
}
