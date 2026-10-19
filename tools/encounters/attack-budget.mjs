/** Pure admission policy. Battlefield owns readiness, warning timers and shots.
 * Reserve in-progress warnings before admitting ready attackers; callers must
 * retain an admitted target while its real battlefield warning is active.
 */
export function allocateAttackTokens({ units, maxTokens }) {
  if (!Array.isArray(units) || !Number.isSafeInteger(maxTokens) || maxTokens < 0) throw new Error('Invalid attack budget');
  const ids = new Set();
  for (const unit of units) {
    if (!unit || typeof unit.enemyId !== 'string' || !unit.enemyId || ids.has(unit.enemyId) || typeof unit.warningActive !== 'boolean' || typeof unit.ready !== 'boolean') throw new Error('Invalid or duplicate attack facts');
    ids.add(unit.enemyId);
  }
  const active = units.filter(unit => unit.warningActive);
  // If a pre-existing host state already exceeds its cap, report the violation
  // and preserve existing warnings. Cancelling a warning halfway is not a fix.
  const permitted = [...active];
  const free = Math.max(0, maxTokens - active.length);
  permitted.push(...units.filter(unit => !unit.warningActive && unit.ready).slice(0, free));
  return {
    permittedEnemyIds: permitted.map(unit => unit.enemyId),
    activeWarnings: active.length,
    admittedStarts: permitted.length - active.length,
    maxTokens,
    exceededByExistingWarnings: active.length > maxTokens,
    authority: 'Admission only. Host computes readiness and keeps battlefield as the sole timer/projectile/damage owner.',
  };
}
