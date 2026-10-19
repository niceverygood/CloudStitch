/** Explicit downgrade for battlefield-v1's {move, attackTarget} contract.
 * This does not execute fan/charge/harpoon/repair/ring/pressure mechanics.
 * observedTarget must be supplied by the host's actual observation/last-seen rule.
 */
export function convertAttackIntent({ intent, enemy, observedTarget, desiredRange = 30, allowAttack = true }) {
  if (!enemy || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.z) || !Number.isFinite(desiredRange) || desiredRange <= 0) throw new Error('Invalid training intent context');
  if (observedTarget == null) return { move: { x: 0, z: 0 }, attackTarget: null, sourcePattern: intent?.pattern || null, executedPattern: null, limitation: 'No observed target; no omniscient fallback' };
  if (!Number.isFinite(observedTarget.x) || !Number.isFinite(observedTarget.z)) throw new Error('Invalid observed target');
  const dx = observedTarget.x - enemy.x, dz = observedTarget.z - enemy.z;
  const distance = Math.hypot(dx, dz), ux = distance > 1e-8 ? dx / distance : 0, uz = distance > 1e-8 ? dz / distance : 0;
  const approach = distance > desiredRange ? 1 : distance < desiredRange * .65 ? -.6 : 0;
  const orbit = intent?.role === 'scout' ? .55 : 0;
  const stationary = ['shipyard', 'heart'].includes(intent?.role);
  const move = stationary ? { x: 0, z: 0 } : { x: ux * approach - uz * orbit, z: uz * approach + ux * orbit };
  const length = Math.max(1, Math.hypot(move.x, move.z)); move.x /= length; move.z /= length;
  return {
    move, attackTarget: intent && allowAttack ? { x: observedTarget.x, z: observedTarget.z } : null,
    sourcePattern: intent?.pattern || null,
    executedPattern: intent && allowAttack ? 'battlefield-training-projectile' : null,
    limitation: 'Movement direction and basic aimed warning shot only; source pattern geometry, damageHint, timings, support and special mechanics are not applied',
  };
}
