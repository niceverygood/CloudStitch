/**
 * Presentation-only enlargement of the original v1 effect IDs. The source
 * geometry, material palette and animation clip stay unchanged. Apply scale
 * only to the display wrapper, never to physics, sim bounds, damage or range.
 * Echoes are small, delayed copies of the SAME primary effect; they create no
 * extra hit/fire events. Their lifetime must not exceed the original clip end.
 * `rotation` is radians around the effect's local +Y axis;
 * offset is asset-local XYZ before the display wrapper scale, not world space.
 */
const echo = (delay, scale, rotation, offset) => Object.freeze({
  delay, scale, rotation, offset: Object.freeze(offset),
});
const SMALL_MUZZLE = Object.freeze([echo(.025, .60, .22, [-.07, .025, .035])]);
const LARGE_MUZZLE = Object.freeze([
  echo(.03, .65, .22, [-.10, .035, .05]),
  echo(.065, .48, -.31, [.085, .055, .075]),
]);
const SMALL_HIT = Object.freeze([echo(.03, .58, -.24, [.055, .025, -.045])]);
const LARGE_HIT = Object.freeze([
  echo(.035, .65, .27, [-.08, .035, .055]),
  echo(.075, .50, -.36, [.075, .055, -.065]),
]);
const CLOUD = Object.freeze([
  echo(.04, .68, .18, [-.10, .045, .04]),
  echo(.08, .52, -.28, [.10, .075, -.035]),
]);
const NONE = Object.freeze([]);
const profile = (category, scale, echoes = NONE, projectile = false, stateful = false) =>
  Object.freeze({ scale, echoes, projectile, stateful, category });
const weapon = (scale, echoes = NONE, projectile = false, stateful = false) =>
  profile('weapon', scale, echoes, projectile, stateful);
const impact = (echoes = SMALL_HIT, scale = 1.5) => profile('material-impact', scale, echoes);
const environment = (echoes = CLOUD, stateful = false) =>
  profile('explosion-environment', 1.6, echoes, false, stateful);
const status = (stateful = true) => profile('damage-state', 1.3, NONE, false, stateful);
const support = (stateful = false) => profile('defense-support', 1.3, NONE, false, stateful);

// Exact catalog IDs, deliberately not substring/regex classification. Adding
// assets does not silently add runtime support or reinterpret semantic effects.
const PROFILES = Object.freeze({
  'machine-gun-muzzle': weapon(1.4, SMALL_MUZZLE),
  'machine-gun-projectile': weapon(1.35, NONE, true),
  'machine-gun-hit': weapon(1.5, SMALL_HIT),
  'cannon-muzzle': weapon(1.4, LARGE_MUZZLE),
  'cannon-projectile': weapon(1.35, NONE, true),
  'cannon-hit': weapon(1.5, LARGE_HIT),
  'mortar-launch': weapon(1.4, LARGE_MUZZLE),
  'mortar-projectile': weapon(1.35, NONE, true),
  'mortar-hit': weapon(1.5, LARGE_HIT),
  'harpoon-launch': weapon(1.4),
  'harpoon-projectile': weapon(1.35, NONE, true),
  'harpoon-hit': weapon(1.5),
  'chain-shot-launch': weapon(1.4, SMALL_MUZZLE),
  'chain-shot-projectile': weapon(1.35, NONE, true),
  'chain-shot-hit': weapon(1.5, SMALL_HIT),
  'flamethrower-ignite': weapon(1.4, SMALL_MUZZLE),
  'flamethrower-stream': weapon(1.4, NONE, false, true),
  'flamethrower-hit': weapon(1.5, SMALL_HIT),
  'wood-hit': impact(LARGE_HIT),
  'metal-hit': impact(),
  'fabric-hit': impact(),
  'armor-hit': impact(LARGE_HIT),
  'ricochet-hit': impact(NONE),
  'weakpoint-hit': impact(LARGE_HIT),
  'cloud-miss': impact(CLOUD, 1.6),
  'penetration-exit': impact(NONE),
  'small-explosion': environment(LARGE_HIT),
  'large-explosion': environment(LARGE_HIT),
  'airburst': environment(LARGE_HIT),
  'shrapnel-burst': environment(LARGE_HIT),
  'smoke-puff': environment(),
  'steam-vent': environment(),
  'smoldering-fire': environment(NONE, true),
  'ember-drift': environment(SMALL_HIT),
  'burning-state': status(),
  'heavy-smoke-state': status(),
  'gas-leak-state': status(),
  'overheat-state': status(),
  'short-circuit-state': status(),
  'engine-stall-state': status(),
  'envelope-rupture-state': status(false),
  'module-detach-state': status(false),
  'shield-pulse': support(),
  'armor-block': support(),
  'repair-stitch': support(),
  'healing-pulse': support(),
  'salvage-tether': support(true),
  'mount-lock': support(),
});

export const RICH_EFFECT_IDS = Object.freeze(Object.keys(PROFILES));

/** Return immutable display parameters for an unchanged v1 semantic/source ID. */
export function getRichProfile(effectId) {
  if (typeof effectId !== 'string' || !Object.hasOwn(PROFILES, effectId)) {
    throw new RangeError(`등록되지 않은 v1 전투 효과입니다: ${String(effectId)}`);
  }
  return PROFILES[effectId];
}
