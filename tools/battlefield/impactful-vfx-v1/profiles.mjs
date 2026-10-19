/**
 * Exaggerated, layered display of the unchanged warm v1 shapes and palette.
 * All dimensions are local display wrappers, never physics/range/damage.
 * +Y is the contact normal; projectile flight is +Z. Echoes end with the
 * original clip, never spawn another projectile, contact or semantic action.
 */
const vec = values => Object.freeze(values);
const echo = (delay, scale, rotation, offset, stretch) => Object.freeze({
  delay, scale, rotation, offset: vec(offset), stretch: vec(stretch),
});
const NONE = Object.freeze([]);
const MUZZLE = Object.freeze([
  echo(.022, .68, .28, [-.10, .025, .055], [1.20, .87, 1.10]),
  echo(.055, .53, -.38, [.12, .045, .10], [.90, 1.16, 1.06]),
]);
const HEAVY_MUZZLE = Object.freeze([
  ...MUZZLE,
  echo(.105, .42, .52, [-.055, .07, .16], [1.22, .82, 1.18]),
]);
const HIT = Object.freeze([
  echo(.028, .72, -.32, [.10, .035, -.07], [1.22, .83, .92]),
  echo(.072, .56, .43, [-.13, .075, .10], [.90, 1.14, 1.18]),
  echo(.125, .42, -.57, [.07, .11, .14], [1.14, .91, 1.12]),
]);
const CLOUD = Object.freeze([
  echo(.04, .76, .23, [-.18, .07, .10], [1.25, .90, 1.08]),
  echo(.09, .59, -.37, [.18, .13, -.13], [.92, 1.22, 1.12]),
  echo(.16, .43, .51, [-.08, .19, -.15], [1.18, 1.08, .93]),
]);
const profile = (category, scale, echoes = NONE, projectile = false, stateful = false, stretch = [1, 1, 1]) =>
  Object.freeze({ category, scale, echoes, projectile, stateful, stretch: vec(stretch) });
const muzzle = (heavy = false) => profile('weapon', heavy ? 2.10 : 2.0, heavy ? HEAVY_MUZZLE : MUZZLE, false, false, [1.14, 1.02, 1.08]);
const bullet = () => profile('weapon', 1.65, NONE, true, false);
const hit = (category = 'weapon', scale = 2.30, echoes = HIT) => profile(category, scale, echoes, false, false, [1.16, .95, 1.08]);
const environment = (scale = 2.5, echoes = CLOUD, stateful = false) => profile('explosion-environment', scale, echoes, false, stateful, [1.12, 1.08, 1.04]);
const status = (stateful = true) => profile('damage-state', 1.6, NONE, false, stateful, [1.08, 1.04, 1.08]);
const support = (stateful = false) => profile('defense-support', 1.6, NONE, false, stateful, [1.08, 1.04, 1.08]);

// Explicit semantic IDs: adding a new asset never silently grants runtime use.
const PROFILES = Object.freeze({
  'machine-gun-muzzle': muzzle(),
  'machine-gun-projectile': bullet(),
  'machine-gun-hit': hit(),
  'cannon-muzzle': muzzle(true),
  'cannon-projectile': bullet(),
  'cannon-hit': hit('weapon', 2.40),
  'mortar-launch': muzzle(true),
  'mortar-projectile': bullet(),
  'mortar-hit': hit('weapon', 2.45),
  'harpoon-launch': profile('weapon', 2.0, NONE, false, false, [1.12, 1.04, 1.10]),
  'harpoon-projectile': bullet(),
  'harpoon-hit': hit('weapon', 2.30, NONE),
  'chain-shot-launch': muzzle(),
  'chain-shot-projectile': bullet(),
  'chain-shot-hit': hit(),
  'flamethrower-ignite': muzzle(),
  'flamethrower-stream': profile('weapon', 2.0, NONE, false, true, [1.14, 1.10, 1.04]),
  'flamethrower-hit': hit(),
  'wood-hit': hit('material-impact'),
  'metal-hit': hit('material-impact'),
  'fabric-hit': hit('material-impact'),
  'armor-hit': hit('material-impact'),
  'ricochet-hit': hit('material-impact', 2.30, NONE),
  'weakpoint-hit': hit('material-impact', 2.45),
  'cloud-miss': hit('material-impact', 2.0, CLOUD),
  'penetration-exit': hit('material-impact', 2.30, NONE),
  'small-explosion': environment(),
  'large-explosion': environment(2.60),
  'airburst': environment(),
  'shrapnel-burst': environment(),
  'smoke-puff': environment(2.0),
  'steam-vent': environment(2.0),
  'smoldering-fire': environment(2.0, NONE, true),
  'ember-drift': environment(2.0),
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
  'salvage-tether': profile('defense-support', 1.6, NONE, false, true),
  'mount-lock': support(),
});

export const IMPACTFUL_EFFECT_IDS = Object.freeze(Object.keys(PROFILES));
export function getImpactfulProfile(effectId) {
  if (typeof effectId !== 'string' || !Object.hasOwn(PROFILES, effectId)) {
    throw new RangeError(`등록되지 않은 과장형 v1 전투 효과입니다: ${String(effectId)}`);
  }
  return PROFILES[effectId];
}
