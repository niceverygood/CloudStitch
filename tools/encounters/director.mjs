import { ROLE_PROFILES, describeSpawn, INTENT_VERSION } from './attack-intents.mjs';

const combat = new Set(['opening', 'midboss', 'late', 'finalboss']);
const nextPhase = { opening: 'midboss', midboss: 'maintenance', late: 'finalboss', finalboss: 'victory' };
const copy = value => JSON.parse(JSON.stringify(value));

export function validateEncounterCatalog(catalog) {
  if (!Array.isArray(catalog?.stages) || !catalog.stages.length) throw new Error('Missing encounter stages');
  const ids = new Set();
  for (const stage of catalog.stages) {
    if (typeof stage.id !== 'string' || ids.has(stage.id)) throw new Error('Invalid or duplicate stage ID');
    ids.add(stage.id);
    for (const phase of ['opening', 'late']) {
      if (!Array.isArray(stage[phase]) || !stage[phase].length) throw new Error(`Missing wave: ${stage.id}/${phase}`);
      let count = 0;
      for (const spec of stage[phase]) {
        if (!Number.isInteger(spec.count) || spec.count < 1) throw new Error('Invalid wave count');
        count += spec.count;
      }
      if (count > (catalog.combatPolicy?.spawnBudget?.maxUnitsPerOpeningOrLateWave ?? 4)) throw new Error('Wave exceeds source spawn budget');
    }
    for (const spec of [...stage.opening, ...stage.late, stage.midBoss, stage.finalBoss]) {
      if (!spec?.assetId || !ROLE_PROFILES[spec.role]) throw new Error(`Invalid unit: ${stage.id}`);
    }
  }
  return true;
}

function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates)) throw new Error('Spawn candidates must be an array');
  const ids = new Set();
  return candidates.map(candidate => {
    if (!candidate || typeof candidate.id !== 'string' || !candidate.id || ids.has(candidate.id) || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.z)) throw new Error('Invalid or duplicate world spawn candidate');
    if (candidate.roles && (!Array.isArray(candidate.roles) || candidate.roles.some(role => !ROLE_PROFILES[role]))) throw new Error('Invalid candidate roles');
    if (candidate.phases && (!Array.isArray(candidate.phases) || candidate.phases.some(phase => !combat.has(phase)))) throw new Error('Invalid candidate phases');
    ids.add(candidate.id);
    return { ...copy(candidate), y: 0 };
  });
}

/** Encounter ordering only. Never import/create the independent combat core here.
 * Battlefield calls advance AFTER its damage/outcome pass, so defeat wins a tie.
 * All commands carry runId. A host must discard stale generations.
 */
export function createEncounterDirector(catalog, { difficulty = 'normal' } = {}) {
  validateEncounterCatalog(catalog);
  if (!catalog.difficultyProfiles?.some(profile => profile.id === difficulty)) throw new Error(`Unknown encounter difficulty: ${difficulty}`);
  catalog = copy(catalog);
  let candidates = [], commands = [], sequence = 0, runId = 0;
  let state = fresh(catalog.stages[0]);
  function fresh(stage) {
    return { version: INTENT_VERSION, runId, stageId: stage.id, phase: 'briefing', paused: false, active: [], bossSpawnCounts: { midboss: 0, finalboss: 0 }, bossDefeatCounts: { midboss: 0, finalboss: 0 }, clearance: null, majorAttackTokens: 0, difficulty };
  }
  function stage() { return catalog.stages.find(item => item.id === state.stageId); }
  function emit(type, detail = {}) {
    const command = { commandId: `encounter-${runId}-${++sequence}`, runId, stageId: state.stageId, phase: state.phase, type, ...copy(detail) };
    commands.push(command);
    return command;
  }
  function planSpawns(phase, proposed = candidates, selectedStage = stage()) {
    // This pure preflight must not alter the live phase/run, even if no candidates fit.
    const specs = phase === 'opening' || phase === 'late'
      ? selectedStage[phase].flatMap(spec => Array.from({ length: spec.count }, () => ({ ...spec, tier: 'normal' })))
      : phase === 'midboss' || phase === 'finalboss' ? [{ ...selectedStage[phase === 'midboss' ? 'midBoss' : 'finalBoss'], tier: phase }] : [];
    const matches = new Array(specs.length);
    const used = new Set();
    // Backtracking avoids starving a restricted role by greedily taking its only slot.
    function place(index) {
      if (index === specs.length) return true;
      for (const candidate of proposed) {
        if (used.has(candidate.id) || candidate.safe === false || candidate.roles && !candidate.roles.includes(specs[index].role) || candidate.phases && !candidate.phases.includes(phase)) continue;
        used.add(candidate.id); matches[index] = candidate;
        if (place(index + 1)) return true;
        used.delete(candidate.id);
      }
      return false;
    }
    if (!place(0)) throw new Error(`Insufficient safe world spawn candidates: ${selectedStage.id}/${phase}`);
    return specs.map((spec, index) => ({ spec, candidate: matches[index] }));
  }
  function enter(phase, plan = []) {
    const previous = state.phase;
    state.phase = phase;
    state.majorAttackTokens = { opening: 1, midboss: 1, late: 2, finalboss: 2 }[phase] || 0;
    emit('phase-changed', { from: previous, to: phase, majorAttackTokens: state.majorAttackTokens });
    for (const [slot, { spec, candidate }] of plan.entries()) {
      if (spec.tier !== 'normal') {
        if (state.bossSpawnCounts[spec.tier]) throw new Error('Duplicate boss spawn blocked');
        state.bossSpawnCounts[spec.tier]++;
      }
      const enemyId = `encounter-${runId}-${state.stageId}-${phase}-${slot}`;
      const profile = catalog.difficultyProfiles?.find(item => item.id === difficulty)?.prototypeTuning || catalog.difficultyPrototypeTuning?.[difficulty] || {};
      const spawn = { enemyId, assetId: spec.assetId, name: spec.name, role: spec.role, tier: spec.tier, x: candidate.x, y: 0, z: candidate.z, candidateId: candidate.id, sourceRefs: spec.sourceRefs || stage().sourceRefs || [], sourceKind: spec.sourceKind || 'prototypeUnit', canonEncounterCompleted: false, tuning: describeSpawn({ role: spec.role, tier: spec.tier, stageIndex: catalog.stages.findIndex(item => item.id === state.stageId), tuning: profile }), difficultyTuning: profile };
      state.active.push({ enemyId, role: spec.role, tier: spec.tier, assetId: spec.assetId });
      emit('spawn-enemy', spawn);
      if (spec.tier !== 'normal') emit('boss-spawned', { enemyId, tier: spec.tier, assetId: spec.assetId });
    }
    if (phase === 'maintenance') emit('maintenance-ready', { repairPolicy: 'host-explicit-prototype-support; no implicit economy or save' });
    if (phase === 'victory') emit('region-completed', { canonEncounterCompleted: false });
  }
  function barrier(reason, target, plan = []) {
    state.majorAttackTokens = 0;
    const command = emit('clear-combat', { reason, targetPhase: target, restoreCheckpoint: reason === 'retry', clear: ['enemy-actors', 'projectiles', 'telegraphs', 'charges', 'tethers', 'effects', 'repair-pickups', 'held-input'], authority: 'battlefield', preserve: ['confirmed-cargo-and-rewards-unless-host-checkpoint-restores-them'] });
    state.clearance = { commandId: command.commandId, target, plan };
  }
  function begin(id, proposed, reason) {
    const selected = catalog.stages.find(item => item.id === id);
    if (!selected) throw new Error(`Unknown stage: ${id}`);
    const valid = proposed === undefined ? candidates : normalizeCandidates(proposed);
    const plan = planSpawns('opening', valid, selected);
    runId++; sequence = 0; commands = []; candidates = valid; state = fresh(selected);
    barrier(reason, 'opening', plan);
    return snapshot();
  }
  function startStage(id = state.stageId, proposed) {
    if (state.phase !== 'briefing' || state.clearance) return false;
    return begin(id, proposed, 'start');
  }
  function acknowledgeClearance({ runId: ackRun, commandId, remainingHazards, remainingEnemies }) {
    const pending = state.clearance;
    if (!pending || ackRun !== runId || pending.commandId !== commandId || remainingHazards !== 0 || remainingEnemies !== 0) return false;
    state.clearance = null;
    state.active = [];
    enter(pending.target, pending.plan);
    return true;
  }
  function advance(proposed) {
    if (state.paused || state.clearance || !combat.has(state.phase) || state.active.length) return false;
    const target = nextPhase[state.phase];
    const valid = proposed === undefined ? candidates : normalizeCandidates(proposed);
    const plan = planSpawns(target, valid);
    candidates = valid;
    if (target === 'maintenance' || target === 'victory') barrier(target, target);
    else enter(target, plan);
    return true;
  }
  function continueStage(proposed) {
    if (state.phase !== 'maintenance' || state.clearance || state.paused) return false;
    const valid = proposed === undefined ? candidates : normalizeCandidates(proposed);
    const plan = planSpawns('late', valid); candidates = valid; enter('late', plan); return true;
  }
  function enemyDefeated({ runId: eventRun, enemyId }) {
    if (eventRun !== runId || state.paused || state.clearance || !combat.has(state.phase)) return false;
    const index = state.active.findIndex(item => item.enemyId === enemyId);
    if (index < 0) return false;
    const [unit] = state.active.splice(index, 1);
    emit('enemy-defeated', unit);
    if (unit.tier !== 'normal') { state.bossDefeatCounts[unit.tier]++; emit('boss-defeated', unit); }
    return true;
  }
  function playerDefeated({ runId: eventRun, reason = 'host-confirmed-defeat' }) {
    if (eventRun !== runId || !combat.has(state.phase)) return false;
    state.phase = 'defeat'; state.paused = false;
    state.clearance = null; commands = [];
    emit('player-defeated', { reason }); barrier('defeat', 'defeat'); return true;
  }
  function retry(proposed) { return begin(state.stageId, proposed, 'retry'); }
  function reset() {
    const selected = stage(); runId++; sequence = 0; commands = []; state = fresh(selected);
    barrier('reset', 'briefing'); return snapshot();
  }
  function nextStage(proposed) {
    if (state.phase !== 'victory' || state.clearance) return false;
    const next = catalog.stages[catalog.stages.findIndex(item => item.id === state.stageId) + 1];
    return next ? begin(next.id, proposed, 'next-region') : false;
  }
  function pause(value = true) { state.paused = Boolean(value); emit('pause-changed', { paused: state.paused }); }
  function snapshot() { return copy({ ...state, clearance: state.clearance && { commandId: state.clearance.commandId, target: state.clearance.target }, activeEnemyIds: state.active.map(item => item.enemyId) }); }
  return { startStage, advance, continue: continueStage, nextStage, retry, reset, pause, enemyDefeated, playerDefeated, acknowledgeClearance, snapshot, drainCommands() { const result = commands; commands = []; return copy(result); } };
}
