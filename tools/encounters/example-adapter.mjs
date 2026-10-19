/** Example command bridge; inject battlefield functions bound to its sole sim.
 * No independent createEncounter(), update(), step(), projectile or HP logic.
 * All callbacks are synchronous; asset loading belongs to the presentation host.
 */
export function createBattlefieldEncounterAdapter(director, host) {
  if (typeof host?.spawnEnemy !== 'function' || typeof host?.clearCombat !== 'function') throw new Error('Battlefield spawnEnemy and clearCombat callbacks required');
  let pending = [], appliedRun = -1;
  const applied = new Set();
  const syncResult = value => {
    if (value && typeof value.then === 'function') throw new Error('Encounter command callbacks must be synchronous');
    return value;
  };
  function flush() {
    let count = 0;
    for (;;) {
      pending.push(...director.drainCommands());
      if (!pending.length) return { applied: count, waitingForClearance: false };
      const command = pending[0], snapshot = director.snapshot();
      if (appliedRun !== snapshot.runId) { applied.clear(); appliedRun = snapshot.runId; }
      if (command.runId !== snapshot.runId || applied.has(command.commandId)) { pending.shift(); continue; }
      if (command.type === 'clear-combat') {
        const report = syncResult(host.clearCombat(command));
        if (!report || !director.acknowledgeClearance({ runId: command.runId, commandId: command.commandId, remainingHazards: report.remainingHazards, remainingEnemies: report.remainingEnemies })) return { applied: count, waitingForClearance: true };
      } else if (command.type === 'spawn-enemy') {
        if (syncResult(host.spawnEnemy(command)) === false) throw new Error(`Battlefield refused spawn: ${command.enemyId}`);
      }
      else if (command.type === 'phase-changed') {
        syncResult(host.setMajorAttackTokens?.(command.majorAttackTokens));
        syncResult(host.onEvent?.(command));
      } else syncResult(host.onEvent?.(command));
      applied.add(command.commandId); pending.shift(); count++;
    }
  }
  return { flush };
}

/** Only for contract smoke tests before the world adapter supplies safe LU points.
 * These are explicit examples, not canonical region geography or obstacle QA.
 */
export function exampleSpawnCandidates() {
  return [
    { id: 'example-west', x: -28, z: -12, safe: true },
    { id: 'example-east', x: 28, z: -27, safe: true },
    { id: 'example-northwest', x: -35, z: -52, safe: true },
    { id: 'example-northeast', x: 35, z: -52, safe: true },
  ];
}
