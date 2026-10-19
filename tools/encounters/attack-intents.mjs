/** Pure intent descriptions, derived from the preserved encounters/core.js.
 * No timers, movement, projectile integration, healing or damage are executed.
 * Numbers are provisional encounter tuning, in host-selected LU, never metres.
 */
export const INTENT_VERSION = 'encounters-integration-v1';
export const ROLE_PROFILES = Object.freeze({
  scout: Object.freeze({ hp: 30, speed: 2.7, range: 9, attack: 'shot', recovery: 2.4, movement: 'flank-and-orbit' }),
  blockade: Object.freeze({ hp: 55, speed: 1.1, range: 11, attack: 'fan', recovery: 3.5, movement: 'block-route-broadside' }),
  salvage: Object.freeze({ hp: 42, speed: 1.6, range: 10, attack: 'harpoon', recovery: 3, movement: 'keep-range-tether' }),
  repair: Object.freeze({ hp: 35, speed: 1.8, range: 10, attack: 'shot', recovery: 3.3, movement: 'approach-damaged-ally', healBudget: 36, bossHealBudget: 70 }),
  charger: Object.freeze({ hp: 43, speed: 2.1, range: 8, attack: 'charge', recovery: 3.4, movement: 'locked-straight-charge' }),
  ambush: Object.freeze({ hp: 35, speed: .7, range: 9, attack: 'fan', recovery: 3.3, movement: 'visible-warning-before-deploy' }),
  artillery: Object.freeze({ hp: 44, speed: 1, range: 15, attack: 'mortar', recovery: 3.4, movement: 'fixed-bearing-artillery' }),
  flame: Object.freeze({ hp: 48, speed: 1.7, range: 6, attack: 'flame', recovery: 3.3, movement: 'short-cone-then-cooldown' }),
  bell: Object.freeze({ hp: 80, speed: .8, range: 12, attack: 'ring', recovery: 3.6, movement: 'slow-broadside' }),
  shipyard: Object.freeze({ hp: 90, speed: 0, range: 30, attack: 'mortar', recovery: 3.4, movement: 'stationary-device' }),
  king: Object.freeze({ hp: 90, speed: 1.3, range: 14, attack: 'harpoon', recovery: 3, movement: 'moving-command-ship' }),
  heart: Object.freeze({ hp: 100, speed: 0, range: 30, attack: 'pressure', recovery: 3.4, movement: 'stationary-device' }),
});

const warnings = {
  shot: { shape: 'line', lineStyle: 'short-tracer', icon: 'barrel', weaponId: '01-machine-gun', vfx: ['machine-gun-muzzle', 'machine-gun-projectile', 'machine-gun-hit'] },
  fan: { shape: 'cone', lineStyle: 'solid-fan-boundary', icon: 'broadside', weaponId: '02-deck-cannon', vfx: ['cannon-muzzle', 'cannon-projectile', 'cannon-hit'] },
  harpoon: { shape: 'line', lineStyle: 'thin-hook-line', icon: 'hook', weaponId: '04-harpoon', vfx: ['harpoon-launch', 'harpoon-projectile', 'harpoon-hit'] },
  charge: { shape: 'line', lineStyle: 'thick-direction-band', icon: 'ram', weaponId: null, vfx: [] },
  mortar: { shape: 'circle', lineStyle: 'closed-landing-circle', icon: 'falling-shell', weaponId: '03-mortar', vfx: ['mortar-launch', 'mortar-projectile', 'mortar-hit'] },
  flame: { shape: 'cone', lineStyle: 'short-pump-cone', icon: 'pump', weaponId: '06-flamethrower', vfx: ['flamethrower-ignite', 'flamethrower-stream', 'flamethrower-hit'] },
  ring: { shape: 'ring', lineStyle: 'horizontal-band-with-safe-gap', icon: 'bell', weaponId: null, vfx: [] },
  pressure: { shape: 'line', lineStyle: 'parallel-edges-and-arrow', icon: 'pressure', weaponId: null, vfx: ['steam-vent'] },
};

export function describeAttack({ role, tier = 'normal', attackIndex = 0, healthFraction = 1, telegraphScale = 1, disabledPatterns = [] }) {
  const profile = ROLE_PROFILES[role];
  if (!profile) throw new Error(`Unknown encounter role: ${role}`);
  if (!['normal', 'midboss', 'finalboss'].includes(tier) || !Number.isInteger(attackIndex) || attackIndex < 0 || !Number.isFinite(healthFraction) || healthFraction < 0 || healthFraction > 1 || !Number.isFinite(telegraphScale) || telegraphScale <= 0) throw new Error('Invalid attack facts');
  const boss = tier !== 'normal';
  let pattern = profile.attack;
  let branch = 'role-default';
  if (boss) {
    const cycle = { bell: ['ring', 'fan'], shipyard: ['mortar', 'pressure'], king: ['harpoon', 'fan', 'charge'], heart: ['pressure', 'mortar'] }[role];
    if (cycle) { pattern = cycle[attackIndex % cycle.length]; branch = 'boss-cycle'; }
    else if (healthFraction < .5 && attackIndex % 2 === 1) { pattern = role === 'charger' ? 'fan' : 'mortar'; branch = 'damaged-commander'; }
  }
  // A disabled device cannot silently switch to an unannounced attack.
  if (disabledPatterns.includes(pattern)) return null;
  const warning = warnings[pattern];
  const duration = Math.max(pattern === 'charge' ? 1.2 : pattern === 'shot' ? 1 : 1.5, (boss ? 1.85 : 1.6) * telegraphScale);
  return {
    version: INTENT_VERSION, role, tier, attackIndex, pattern,
    patternTransition: { branch, healthFraction, source: 'tools/encounters/core.js choosePattern; prototype combat, not canonical boss phases' },
    telegraph: { ...warning, vfx: [...warning.vfx], duration, lockBeforeRelease: .4, offscreenDirectionRequired: true, color: '#c66752', soundOnly: false, preserveSafePath: true, geometryAuthority: 'battlefield' },
    recovery: profile.recovery, majorAttackTokenCost: 1,
    movementIntent: profile.movement, damageHint: boss ? 19 : 12,
    cancelOnSourceDisabled: true, clip: pattern === 'harpoon' ? 'WinchCycle' : 'FireBurst',
    authority: 'battlefield alone advances warning/recovery, moves, fires, collides and applies damage',
  };
}

export function describeSpawn({ role, tier = 'normal', stageIndex = 0, tuning = {} }) {
  const profile = ROLE_PROFILES[role];
  if (!profile || !['normal', 'midboss', 'finalboss'].includes(tier) || !Number.isInteger(stageIndex) || stageIndex < 0) throw new Error('Invalid spawn facts');
  const healthScale = tuning.enemyHealth ?? 1;
  if (!Number.isFinite(healthScale) || healthScale <= 0) throw new Error('Invalid health scale');
  const hp = (tier === 'midboss' ? 155 + stageIndex * 27 : tier === 'finalboss' ? 250 + stageIndex * 38 : profile.hp + stageIndex * 3) * healthScale;
  return { ...profile, hp, speed: profile.speed * (tier === 'normal' ? 1 : .85), radiusHint: tier === 'normal' ? .8 : ['heart', 'shipyard'].includes(role) ? 2.3 : 1.6, healBudget: role === 'repair' ? tier === 'normal' ? profile.healBudget : profile.bossHealBudget : 0, units: 'encounter prototype LU; battlefield chooses scale conversion' };
}

export function describeSupport({ role, remainingBudget }) {
  if (role !== 'repair') return null;
  if (!Number.isFinite(remainingBudget) || remainingBudget < 0) throw new Error('Invalid repair budget');
  if (remainingBudget === 0) return null;
  return { kind: 'repair-ally', targetPolicy: 'damaged-ally-in-host-line-of-sight', amountHint: Math.min(7, remainingBudget), rangeHint: 7, recovery: 2, telegraph: { shape: 'line', lineStyle: 'stitched-support-link', icon: 'repair', color: '#4c9690', vfx: ['repair-stitch', 'healing-pulse'] }, clip: 'WinchCycle', authority: 'battlefield chooses target and deducts finite budget once; no HP mutation here' };
}
