/* Cloudstitch encounter prototype QA.
 * node tools/qa/encounters.cjs [outputs/encounters-v1] [work/verification/encounters] [tools/encounters/catalog.json]
 * --core-only skips rendered/UI coverage and produces an explicitly partial report.
 * Uses the actual fixed-step simulation and damage paths, not a parallel test state machine.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const http = require('node:http');
const zlib = require('node:zlib');
const esbuild = require('esbuild');
const { repoRoot, repoPath, reportDirectory, launchBrowser } = require('../lib/runtime.cjs');

const args = process.argv.slice(2), positional = args.filter(arg => !arg.startsWith('--'));
const outputRoot = repoPath(positional[0] || 'outputs/encounters-v1');
const reportDir = reportDirectory('encounters', positional[1]);
const sourcePath = repoPath(positional[2] || 'tools/encounters/catalog.json');
const coreOnly = args.includes('--core-only');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

// This function is deliberately self-contained: the same checks run in Node
// against createEncounter() and in the actual bundled browser prototype.
function exerciseSimulation(api, stages) {
  const results = [], clone = value => JSON.parse(JSON.stringify(value));
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const snapshot = () => api.getState();
  const live = state => state.enemies.filter(enemy => enemy.hp > 0 && enemy.alive !== false);
  const fixedFields = state => ({
    runId: state.runId, stageId: state.stageId, phase: state.phase,
    phaseIndex: state.phaseIndex, simTime: state.simTime, player: state.player,
    enemies: state.enemies, projectiles: state.projectiles,
    telegraphs: state.telegraphs, effects: state.effects,
    repairPickups: state.repairPickups, spawnLog: state.spawnLog,
    transitionLog: state.transitionLog, bossSpawnCounts: state.bossSpawnCounts,
    bossDefeatCounts: state.bossDefeatCounts, objective: state.objective,
  });
  const run = (name, fn) => { const detail = fn(); results.push({ name, passed: true, ...detail }); };
  function healthy(state) {
    check(state && typeof state.runId !== 'undefined' && typeof state.stageId === 'string', 'State identity is missing');
    check(Number.isFinite(state.simTime) && Number.isFinite(state.player?.hp), 'Invalid simulation time/player HP');
    for (const field of ['enemies', 'projectiles', 'telegraphs', 'effects', 'repairPickups', 'spawnLog', 'transitionLog']) check(Array.isArray(state[field]), `State ${field} is not an array`);
    check(state.bossSpawnCounts && state.bossDefeatCounts, 'Boss accounting missing');
    for (const field of ['enemies', 'projectiles', 'telegraphs', 'effects', 'repairPickups']) {
      const ids = state[field].map(item => item.id).filter(id => id !== undefined);
      check(new Set(ids).size === ids.length, `Duplicate live ${field} IDs`);
      const visit = value => { if (typeof value === 'number') check(Number.isFinite(value), `Nonfinite ${field} value`); else if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') Object.values(value).forEach(visit); };
      state[field].forEach(visit);
    }
    check(state.player.hp >= 0, 'Negative player HP');
    return state;
  }
  function clearCombatPhase(phase) {
    let kills = 0, steps = 0, before = snapshot();
    check(before.phase === phase, `Expected ${phase}, got ${before.phase}`);
    // Let scheduled waves use real simulation time. Kill only currently live
    // enemies through damageEnemy; no test hook directly advances a phase.
    while (snapshot().phase === phase && steps < 7200) {
      const current = healthy(snapshot());
      for (const enemy of live(current)) { api.defeatEnemy(enemy.id); kills++; }
      if (snapshot().phase === phase) api.step(1 / 60);
      steps++;
    }
    const after = healthy(snapshot());
    check(after.phase !== phase, `${phase} did not finish after all live enemies were defeated`);
    check(after.phase !== 'defeat', `Player died while clearing ${phase}`);
    check(kills > 0, `${phase} had no live enemy to defeat`);
    return { kills, simulationSeconds: after.simTime - before.simTime, after: after.phase };
  }
  function noAttacks(state, where) {
    check(state.projectiles.length === 0 && state.telegraphs.length === 0, `Residual attacks in ${where}`);
    check(live(state).length === 0, `Live enemies remain in ${where}`);
  }
  function pauseCheck() {
    api.pause(true); const before = clone(fixedFields(snapshot()));
    api.step(2); api.step(1 / 60); api.step(.25);
    const after = fixedFields(snapshot());
    check(JSON.stringify(before) === JSON.stringify(after), 'Pause advanced simulation, attacks, spawns or transitions');
    check(snapshot().paused === true, 'Pause state is not exposed');
    api.pause(false);
    return { frozenSecondsRequested: 2 + 1 / 60 + .25 };
  }
  for (const method of ['getState', 'step', 'startStage', 'pause', 'retry', 'reset', 'continue', 'nextStage', 'setInput', 'defeatEnemy', 'damagePlayer']) check(typeof api[method] === 'function', `Missing API ${method}`);
  if (typeof api.setAutoStep === 'function') api.setAutoStep(false);
  run('deep-snapshot-isolation', () => {
    api.startStage(stages[0].id);
    const original = clone(snapshot()), exposed = snapshot();
    exposed.player.hp = -999; exposed.enemies.length = 0;
    exposed.bossSpawnCounts.midboss = 99; exposed.spawnLog.push({ id: 'not-real' });
    check(JSON.stringify(snapshot()) === JSON.stringify(original), 'getState exposes mutable simulation state');
    return {};
  });
  for (const stage of stages) {
    run(`stage:${stage.id}:mandatory-two-bosses`, () => {
      api.startStage(stage.id); api.setInput({ moveX: 0, moveZ: 0, fire: false, dash: false });
      let state = healthy(snapshot()); const runId = state.runId, seen = [state.phase];
      check(state.stageId === stage.id && state.phase === 'opening', 'Stage did not start at opening');
      check(state.bossSpawnCounts.midboss === 0 && state.bossSpawnCounts.finalboss === 0, 'Boss counter leaked from previous run');
      const earlyContinue = clone(fixedFields(state)); api.continue();
      check(JSON.stringify(fixedFields(snapshot())) === JSON.stringify(earlyContinue), 'Continue bypassed required opening combat');
      const opening = clearCombatPhase('opening'); state = snapshot(); seen.push(state.phase);
      check(state.phase === 'midboss', 'Opening did not lead to midboss');
      check(state.bossSpawnCounts.midboss === 1 && state.bossSpawnCounts.finalboss === 0, 'Midboss must spawn once before finalboss');
      pauseCheck();
      api.step(1 / 60); check(snapshot().phase === 'midboss', 'Living midboss was skipped');
      const midbossId = live(snapshot())[0]?.id;
      const midboss = clearCombatPhase('midboss'); state = snapshot(); seen.push(state.phase);
      check(state.phase === 'maintenance', 'Midboss did not lead to maintenance');
      check(state.bossDefeatCounts.midboss === 1 && state.bossDefeatCounts.finalboss === 0, 'Midboss defeat was not counted exactly once');
      const afterMidboss = clone(fixedFields(state)); api.defeatEnemy(midbossId);
      check(JSON.stringify(fixedFields(snapshot())) === JSON.stringify(afterMidboss), 'Repeated midboss damage duplicated defeat/transition');
      noAttacks(state, 'maintenance'); pauseCheck();
      api.step(.5); check(snapshot().phase === 'maintenance', 'Maintenance proceeded without explicit continue');
      noAttacks(snapshot(), 'waiting maintenance'); api.continue();
      state = snapshot(); seen.push(state.phase); check(state.phase === 'late', 'Continue did not begin late waves');
      const late = clearCombatPhase('late'); state = snapshot(); seen.push(state.phase);
      check(state.phase === 'finalboss', 'Late waves did not lead to finalboss');
      check(state.bossSpawnCounts.midboss === 1 && state.bossSpawnCounts.finalboss === 1, 'Each boss must spawn exactly once');
      api.step(1 / 60); check(snapshot().phase === 'finalboss', 'Living finalboss was skipped');
      const finalbossId = live(snapshot())[0]?.id;
      const finalboss = clearCombatPhase('finalboss'); state = snapshot(); seen.push(state.phase);
      check(state.phase === 'victory', 'Finalboss defeat did not produce victory');
      check(state.bossDefeatCounts.midboss === 1 && state.bossDefeatCounts.finalboss === 1, 'Each boss must be defeated exactly once');
      check(state.runId === runId, 'Normal progression replaced the current run'); noAttacks(state, 'victory');
      const terminal = clone(fixedFields(state)); api.step(3);
      check(JSON.stringify(fixedFields(snapshot())) === JSON.stringify(terminal), 'Victory continued combat/time/spawns');
      api.defeatEnemy(finalbossId); api.damagePlayer(1e9);
      check(JSON.stringify(fixedFields(snapshot())) === JSON.stringify(terminal), 'Late damage replaced victory or duplicated a boss defeat');
      check(JSON.stringify(seen) === JSON.stringify(['opening', 'midboss', 'maintenance', 'late', 'finalboss', 'victory']), 'Incorrect stage phase order');
      const spawnIds = state.spawnLog.map(event => event.enemyId ?? event.id).filter(id => id !== undefined);
      check(new Set(spawnIds).size === spawnIds.length, 'An enemy spawned more than once in this run');
      return { stageId: stage.id, runId, phases: seen, opening, midboss, late, finalboss, spawnedEnemies: state.spawnLog.length };
    });
  }
  run('death-retry-clears-prior-run', () => {
    api.startStage(stages[0].id); api.step(.1); const before = healthy(snapshot());
    api.damagePlayer(1e9); const dead = healthy(snapshot());
    check(dead.phase === 'defeat' && dead.player.hp === 0, 'Lethal damage did not produce defeat'); noAttacks(dead, 'defeat');
    const terminal = clone(fixedFields(dead)); api.step(5);
    before.enemies.forEach(enemy => api.defeatEnemy(enemy.id));
    check(JSON.stringify(fixedFields(snapshot())) === JSON.stringify(terminal), 'Defeat continued combat/time/spawns');
    api.retry(); const retried = healthy(snapshot());
    check(retried.runId !== before.runId && retried.phase === 'opening' && retried.stageId === stages[0].id, 'Retry did not create a fresh same-stage run');
    check(retried.player.hp > 0 && retried.bossSpawnCounts.midboss === 0 && retried.bossSpawnCounts.finalboss === 0, 'Retry did not reset health/boss counts');
    check(retried.projectiles.length === 0 && retried.telegraphs.length === 0, 'Retry retained old attacks');
    const previousIds = new Set(before.enemies.map(enemy => enemy.id));
    check(retried.enemies.every(enemy => !previousIds.has(enemy.id)), 'Retry reused prior run entity IDs');
    return { oldRunId: before.runId, newRunId: retried.runId };
  });
  run('rapid-stage-switch-and-reset', () => {
    const runIds = [], selected = [stages[0], stages.at(-1), stages[0], stages[1], stages[0]];
    for (const stage of selected) { api.startStage(stage.id); const state = healthy(snapshot()); runIds.push(state.runId); check(state.stageId === stage.id && state.phase === 'opening', 'Rapid stage selection retained prior stage'); check(state.projectiles.length === 0 && state.telegraphs.length === 0, 'Stage selection retained prior attacks'); check(state.bossSpawnCounts.midboss === 0 && state.bossSpawnCounts.finalboss === 0, 'Stage selection retained boss counts'); }
    check(new Set(runIds).size === runIds.length, 'Rapid stage selection reused a run ID');
    api.reset(); const reset = healthy(snapshot());
    check(reset.phase === 'briefing', 'Reset did not return to briefing'); noAttacks(reset, 'reset');
    api.step(10); noAttacks(snapshot(), 'idle briefing');
    return { runIds };
  });
  run('movement-is-actual-fixed-step-input', () => {
    api.startStage(stages[0].id); const original = snapshot().player;
    check(Number.isFinite(original.x) && Number.isFinite(original.z), 'Player world coordinates missing');
    api.setInput({ moveX: 1, moveZ: 0, fire: false, dash: false }); api.step(.2);
    const moved = snapshot().player, displacement = Math.hypot(moved.x - original.x, moved.z - original.z);
    check(displacement > .01, 'Movement input did not move the player');
    pauseCheck(); api.setInput({ moveX: 0, moveZ: 0, fire: false, dash: false });
    return { displacement, requestedSeconds: .2 };
  });
  api.reset();
  return { passed: true, tests: results, stagesChecked: stages.length };
}

function loadCore() {
  const corePath = repoPath('tools/encounters/core.js');
  assert(fs.existsSync(corePath), 'Missing actual encounter core.js');
  const built = esbuild.buildSync({ entryPoints: [corePath], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const compiled = new Module(corePath, module); compiled.filename = corePath; compiled.paths = module.paths;
  compiled._compile(built.outputFiles[0].text, corePath);
  assert(typeof compiled.exports.createEncounter === 'function', 'core.js does not export createEncounter');
  return compiled.exports.createEncounter;
}

function exerciseAttackRules(createEncounter, catalog) {
  const tests = [], clone = value => JSON.parse(JSON.stringify(value));
  const run = (name, fn) => tests.push({ name, passed: true, ...fn() });
  const fixture = (role, obstacles = []) => {
    const c = clone(catalog); c.stages[0].opening = [{ assetId: 'enemy-pirate-scout', role, count: 1, name: 'QA stationary attack fixture' }];
    c.stages[0].environment.obstacles = obstacles; return c;
  };
  run('shape-boundaries-use-front-negative-X', () => {
    const api = createEncounter(catalog), inside = (point, shape, padding = 0) => api.inShape(point, { x: 0, z: 0, angle: 0, ...shape }, padding);
    assert(typeof api.inShape === 'function', 'Core does not expose actual shape predicate');
    const line = { shape: 'line', length: 8, width: 2 };
    assert(inside({ x: -4, z: .99 }, line) && !inside({ x: -4, z: 1.01 }, line), 'Line full-width interpretation incorrect');
    assert(!inside({ x: .1, z: 0 }, line) && !inside({ x: -8.1, z: 0 }, line), 'Line extends behind origin/beyond range');
    assert(inside({ x: -8.1, z: 0 }, line, .2), 'Player-radius padding was not applied');
    const cone = { shape: 'cone', length: 8, width: Math.PI / 3 };
    assert(inside({ x: -4, z: 2 }, cone) && !inside({ x: -4, z: 2.5 }, cone) && !inside({ x: 2, z: 0 }, cone), 'Cone range/angle/orientation incorrect');
    const circle = { shape: 'circle', r: 2 };
    assert(inside({ x: 1.99, z: 0 }, circle) && !inside({ x: 2.01, z: 0 }, circle), 'Circle radius boundary incorrect');
    const ring = { shape: 'ring', r: 5, width: 1, safeAngle: 0, safeWidth: Math.PI / 3 };
    assert(!inside({ x: -5, z: 0 }, ring) && inside({ x: 5, z: 0 }, ring) && inside({ x: 0, z: 5 }, ring), 'Ring safe gap is incorrect');
    assert(!inside({ x: 5.6, z: 0 }, ring), 'Ring band extends beyond full width');
    return { shapes: ['line', 'cone', 'circle', 'ring'] };
  });
  run('real-player-projectile-damages-target', () => {
    const c = fixture('shipyard'), api = createEncounter(c); api.startStage(c.stages[0].id);
    const target = api.getState().enemies[0], hp = target.hp;
    api.setInput({ moveX: 0, moveZ: 0, autoAim: false, aimX: target.x, aimZ: target.z, fire: false }); api.step(.5);
    api.setInput({ fire: true }); api.step(.9);
    const state = api.getState(), current = state.enemies.find(enemy => enemy.id === target.id);
    assert(state.stats.shots > 0 && state.stats.hits > 0 && (!current || current.hp < hp), 'Actual projectile failed to hit/damage the visible target');
    return { shots: state.stats.shots, hits: state.stats.hits, targetHpBefore: hp, targetHpAfter: current?.hp || 0 };
  });
  run('swept-projectile-cannot-tunnel-through-narrow-cover', () => {
    // Actual gun: 27 units/s at 60 Hz = .45 travel per step. A .02-radius
    // obstacle halfway between two shot positions is missed by endpoint-only
    // collision but intersects the shot's swept segment.
    const obstacle = { x: 0, z: 1.425, r: .02, label: 'QA narrow cover', kind: 'pillar' };
    const shoot = obstacles => {
      const c = fixture('shipyard', obstacles), api = createEncounter(c); api.startStage(c.stages[0].id);
      api.setInput({ moveX: 0, moveZ: 0, autoAim: false, aimX: 0, aimZ: -10, fire: true }); api.step(4 / 60);
      return api.getState();
    };
    const open = shoot([]), blocked = shoot([obstacle]);
    assert(open.stats.shots === 1 && open.projectiles.length === 1, 'Swept collision control shot was not in flight');
    assert(blocked.stats.shots === 1 && blocked.projectiles.length === 0 && blocked.effects.some(effect => effect.type === 'spark'), 'Projectile tunneled through narrow cover');
    return { shotTravelPerStep: .45, obstacleRadius: .02, openShotsInFlight: open.projectiles.length, blockedShotsInFlight: blocked.projectiles.length };
  });
  run('source-destruction-cancels-pending-warning', () => {
    const c = fixture('scout'), api = createEncounter(c); api.startStage(c.stages[0].id);
    let state, warning;
    for (let i = 0; i < 300; i++) { api.step(1 / 60); state = api.getState(); warning = state.telegraphs[0]; if (warning) break; }
    assert(warning, 'Fixture enemy never prepared an attack'); api.defeatEnemy(warning.sourceId);
    state = api.getState(); assert(!state.telegraphs.some(item => item.sourceId === warning.sourceId) && !state.projectiles.some(item => item.sourceId === warning.sourceId), 'Destroyed source retained an active warning/shot');
    api.step(1 / 60); assert(api.getState().phase === 'midboss', 'Source destruction did not follow normal phase progression');
    return { warningCanceled: true };
  });
  run('projectile-range-lock-and-fired-shot-persistence', () => {
    const cases = [];
    for (const role of ['blockade', 'salvage']) {
      const c = fixture(role), api = createEncounter(c); api.startStage(c.stages[0].id);
      let locked, emitted = false, largestDistance = 0, aimSamples = 0, shotSource;
      for (let i = 0; i < 600; i++) {
        api.step(1 / 60); const state = api.getState(), warning = state.telegraphs[0];
        if (warning?.locked && !locked) { locked = { ...warning }; api.setInput({ moveX: 1, moveZ: 0 }); }
        else if (warning?.locked && locked) { const source = state.enemies.find(enemy => enemy.id === warning.sourceId); assert(Math.abs(Math.atan2(Math.sin(source.aimAngle - warning.angle), Math.cos(source.aimAngle - warning.angle))) < 1e-8, 'Source aim changed away from locked attack'); aimSamples++; }
        for (const shot of state.projectiles.filter(shot => shot.team === 'enemy')) {
          assert(locked, 'Enemy projectile was emitted without an observed locked warning');
          emitted = true; shotSource = shot.sourceId;
          const traveled = Math.hypot(shot.x - locked.x, shot.z - locked.z); largestDistance = Math.max(largestDistance, traveled);
          assert(traveled <= locked.length + 1e-5, 'Projectile traveled beyond its shown attack range');
        }
        if (emitted && i > 300 && !state.projectiles.length) break;
      }
      assert(emitted && aimSamples > 0, `${role} projectile/aim case was not exercised`);
      // Re-enter a fresh actual attack and destroy its owner while a shot is in
      // flight, not merely before the warning finishes.
      const fresh = createEncounter(c); fresh.startStage(c.stages[0].id); let active;
      for (let i = 0; i < 600; i++) { fresh.step(1 / 60); active = fresh.getState().projectiles.find(shot => shot.team === 'enemy'); if (active) break; }
      assert(active, 'No real enemy projectile to observe after source defeat');
      const firedIds = fresh.getState().projectiles.filter(shot => shot.sourceId === active.sourceId).map(shot => shot.id);
      fresh.defeatEnemy(active.sourceId);
      assert(fresh.getState().projectiles.some(shot => shot.id === active.id), 'Defeating source erased an already fired projectile'); fresh.step(1 / 60);
      assert(fresh.getState().projectiles.some(shot => shot.id === active.id), 'Dead-source projectile disappeared instead of traveling');
      fresh.step(1);
      assert(!fresh.getState().telegraphs.some(warning => warning.sourceId === active.sourceId), 'Dead source prepared another warning');
      assert(fresh.getState().projectiles.filter(shot => shot.sourceId === active.sourceId).every(shot => firedIds.includes(shot.id)), 'Dead source emitted a new projectile');
      cases.push({ role, emitted, lockedAimSamples: aimSamples, maximumObservedDistance: largestDistance, shownLength: locked.length, alreadyFiredShotPersisted: true, newSourceShotsPrevented: true });
    }
    return { cases };
  });
  run('warning-floors-token-budget-and-locked-geometry', () => {
    let warningsObserved = 0, lockedObserved = 0, maximumOpening = 0, maximumLate = 0;
    const patterns = new Set(), difficulties = catalog.difficultyProfiles.map(item => item.id);
    for (const difficulty of difficulties) for (const stage of catalog.stages) for (const phase of ['opening', 'late']) {
      const api = createEncounter(catalog); api.setDifficulty(difficulty); api.startStage(stage.id);
      if (phase === 'late') {
        api.getState().enemies.forEach(enemy => api.defeatEnemy(enemy.id)); api.step(1 / 60);
        api.getState().enemies.forEach(enemy => api.defeatEnemy(enemy.id)); api.step(1 / 60); api.continue();
      }
      const locked = new Map(), seen = new Set(), budget = phase === 'opening' ? 1 : 2;
      for (let i = 0; i < 240; i++) {
        api.step(1 / 60); const state = api.getState();
        assert(state.phase === phase, 'Attack observation ended before its combat phase');
        assert(state.telegraphs.length <= budget, `Large-warning budget exceeded: ${difficulty}/${stage.id}/${phase}`);
        if (phase === 'opening') maximumOpening = Math.max(maximumOpening, state.telegraphs.length); else maximumLate = Math.max(maximumLate, state.telegraphs.length);
        for (const warning of state.telegraphs) {
          const floor = warning.pattern === 'charge' ? 1.2 : warning.pattern === 'shot' ? 1 : 1.5;
          assert(warning.duration >= floor - 1e-6, `Hidden/shortened warning: ${warning.pattern}`);
          assert(warning.remaining <= warning.duration && warning.progress >= 0 && warning.progress <= 1, 'Invalid warning clock/progress');
          if (!seen.has(warning.id)) { seen.add(warning.id); warningsObserved++; patterns.add(warning.pattern); }
          const geometry = { x: warning.x, z: warning.z, angle: warning.angle, length: warning.length, width: warning.width, r: warning.r, safeAngle: warning.safeAngle, safeWidth: warning.safeWidth };
          if (warning.locked) {
            assert(warning.remaining <= .4 + 1 / 60 + 1e-6 && Number.isFinite(warning.targetLockedAt), 'Warning locked outside its final target-lock window');
            if (!locked.has(warning.id)) { locked.set(warning.id, geometry); lockedObserved++; api.setInput({ moveX: .6, moveZ: 0 }); }
            else assert(JSON.stringify(locked.get(warning.id)) === JSON.stringify(geometry), 'Warning target/range changed after lock');
          }
        }
      }
    }
    assert(warningsObserved > 0 && lockedObserved > 0 && maximumOpening === 1 && maximumLate === 2, 'Warning/token observation did not exercise both budgets');
    return { difficulties, warningsObserved, lockedObserved, maximumOpening, maximumLate, patterns: [...patterns] };
  });
  run('boss-charge-damage-stays-inside-displayed-corridor', () => {
    const api = createEncounter(catalog); api.startStage('stage-05-fog');
    api.getState().enemies.forEach(enemy => api.defeatEnemy(enemy.id)); api.step(1 / 60);
    let lock, hit, previousHp = api.getState().player.hp;
    for (let i = 0; i < 600; i++) {
      let state = api.getState(), warning = state.telegraphs.find(item => item.pattern === 'charge');
      if (warning && !lock && warning.remaining < .85) api.setInput({ moveX: 1, moveZ: 0 });
      if (warning?.locked && !lock) lock = { ...warning, time: state.simTime };
      if (lock && state.simTime - lock.time >= .25) api.setInput({ moveX: 0, moveZ: 0 });
      api.step(1 / 60); state = api.getState();
      if (lock && state.player.hp < previousHp) {
        const dx = state.player.x - lock.x, dz = state.player.z - lock.z, dir = { x: -Math.cos(lock.angle), z: -Math.sin(lock.angle) };
        const across = Math.abs(dx * dir.z - dz * dir.x), along = dx * dir.x + dz * dir.z;
        assert(across <= lock.width / 2 + state.player.radius + .01, `Boss charge hit outside displayed corridor: cross=${across}, width=${lock.width}, playerRadius=${state.player.radius}`);
        assert(along >= -state.player.radius - .01 && along <= lock.length + state.player.radius + .01, 'Boss charge hit outside displayed corridor length');
        hit = { across, along, warningWidth: lock.width, warningLength: lock.length, playerRadius: state.player.radius }; break;
      }
      previousHp = state.player.hp; if (lock && state.simTime - lock.time > 1.3) break;
    }
    assert(lock, 'Charge corridor scenario never reached target lock');
    return { lockObserved: true, hit: hit || null, avoidedWithoutDamage: !hit };
  });
  return { passed: true, tests };
}

function exerciseWeaponRoutes(createEncounter, catalog) {
  const stages = [];
  for (const stage of catalog.stages) {
    const api = createEncounter(catalog); api.startStage(stage.id);
    const phases = []; let minimumHp = 150, state;
    for (let i = 0; i < 2000; i++) {
      state = api.getState(); if (phases.at(-1) !== state.phase) phases.push(state.phase);
      minimumHp = Math.min(minimumHp, state.player.hp);
      if (['victory', 'defeat'].includes(state.phase)) break;
      if (state.phase === 'maintenance') { api.continue(); continue; }
      // Deterministic orbit, simple cover repulsion and one timed dash. This
      // drives only ordinary movement/fire; no damage or defeat test hook.
      const p = state.player, angle = Math.atan2(p.z / 6, p.x / 9) + .5;
      let dx = 9 * Math.cos(angle) - p.x, dz = 6 * Math.sin(angle) - p.z;
      for (const obstacle of stage.environment.obstacles) {
        const distance = Math.hypot(p.x - obstacle.x, p.z - obstacle.z);
        if (distance < obstacle.r + 2) { dx += (p.x - obstacle.x) / Math.max(distance, .1) * 6; dz += (p.z - obstacle.z) / Math.max(distance, .1) * 6; }
      }
      const length = Math.hypot(dx, dz) || 1;
      const dash = state.telegraphs.some(warning => warning.locked && warning.remaining < .25) && p.dashCooldown <= 0;
      api.setInput({ moveX: dx / length, moveZ: dz / length, fire: true, autoAim: true, dash }); api.step(.1);
    }
    state = api.getState(); if (phases.at(-1) !== state.phase) phases.push(state.phase);
    assert(state.phase === 'victory' && state.simTime <= 200, `Actual player weapon route did not finish ${stage.id} within 200 simulation seconds`);
    assert(JSON.stringify(phases) === JSON.stringify(['opening', 'midboss', 'maintenance', 'late', 'finalboss', 'victory']), 'Actual weapon route skipped a required boss phase');
    const expectedKills = [...stage.opening, ...stage.late].reduce((sum, unit) => sum + unit.count, 0) + 2;
    assert(state.stats.kills === expectedKills && state.bossDefeatCounts.midboss === 1 && state.bossDefeatCounts.finalboss === 1, 'Actual projectiles did not defeat every required unit');
    stages.push({ stageId: stage.id, result: state.phase, simTime: state.simTime, minimumHp, shots: state.stats.shots, hits: state.stats.hits, kills: state.stats.kills, expectedKills, phases, bossDefeatCounts: state.bossDefeatCounts });
  }
  return { passed: true, stageCount: stages.length, usedDamageOrDefeatHooks: false, limitSimulationSeconds: 200, stages, limitation: 'Deterministic functional weapon-path proof; not human playtesting or difficulty/fun/fairness certification.' };
}

function inspectCatalog(catalog) {
  const stages = catalog.stages;
  assert(Array.isArray(stages) && stages.length === 6, 'Expected six encounter stages');
  assert(stages.every(stage => typeof stage.id === 'string' && stage.id && typeof stage.name === 'string'), 'Missing stage identity');
  assert(new Set(stages.map(stage => stage.id)).size === stages.length, 'Duplicate stage IDs');
  const expectedIds = ['stage-01-harbor', 'stage-02-canyon', 'stage-03-storm', 'stage-04-industry', 'stage-05-fog', 'stage-06-palace'];
  assert(JSON.stringify(stages.map(stage => stage.id)) === JSON.stringify(expectedIds), 'Six-region stage fixtures changed');
  assert(JSON.stringify(catalog.stageFlow) === JSON.stringify(['opening', 'midBoss', 'maintenance', 'late', 'finalBoss', 'victory']), 'Catalog stage flow does not require both bosses');
  const fleet = JSON.parse(fs.readFileSync(repoPath('tools/fleet/catalog.json'))), assetIds = new Set(fleet.ships.map(ship => ship.id));
  const references = new Set(), bosses = [], waveBudget = catalog.combatPolicy.spawnBudget.maxUnitsPerOpeningOrLateWave;
  const addRefs = refs => { assert(Array.isArray(refs) && refs.length > 0, 'Source reference missing'); refs.forEach(ref => { assert(typeof ref === 'string' && fs.existsSync(repoPath(ref)), `Missing source reference ${ref}`); references.add(ref); }); };
  for (const stage of stages) {
    addRefs(stage.sourceRefs);
    for (const phase of ['opening', 'late']) {
      assert(Array.isArray(stage[phase]) && stage[phase].length > 0, `${stage.id}/${phase} has no normal wave`);
      let total = 0; for (const unit of stage[phase]) { assert(assetIds.has(unit.assetId) && catalog.enemyRoles[unit.role] && Number.isInteger(unit.count) && unit.count > 0, 'Invalid normal-wave asset/role/count'); total += unit.count; }
      assert(total <= waveBudget, 'Normal wave exceeds explicit small-prototype spawn budget');
    }
    for (const role of ['midBoss', 'finalBoss']) {
      const boss = stage[role]; assert(boss && assetIds.has(boss.assetId) && catalog.enemyRoles[boss.role], `${stage.id} missing ${role} asset/role`);
      assert(boss.sourceKind === 'prototypeCommander' && boss.canonEncounterCompleted === false && boss.roleVariantOf === boss.assetId, 'Prototype commander is incorrectly recorded as canonical boss completion');
      addRefs(boss.sourceRefs); bosses.push({ stageId: stage.id, tier: role, assetId: boss.assetId, role: boss.role, sourceKind: boss.sourceKind });
    }
    assert(Array.isArray(stage.environment?.obstacles) && stage.environment.obstacles.length <= 3, 'Missing/unbounded obstacle set');
    for (const obstacle of stage.environment.obstacles) assert([obstacle.x, obstacle.z, obstacle.r].every(Number.isFinite) && obstacle.r > 0, 'Invalid obstacle geometry');
    assert(stage.environment.obstacles.every(obstacle => Math.hypot(obstacle.x, obstacle.z - 4.5) > obstacle.r + .7), 'Player starts inside an obstacle');
  }
  assert(bosses.length === 12, 'Every stage requires exactly two boss specifications');
  return { stages, stageIds: stages.map(stage => stage.id), bosses, sourceReferences: [...references] };
}

function inspectOutput(catalog) {
  const index = fs.readFileSync(path.join(outputRoot, 'index.html'));
  const manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, 'manifest.json')));
  const outputCatalog = JSON.parse(fs.readFileSync(path.join(outputRoot, 'catalog.json')));
  assert(JSON.stringify(outputCatalog) === JSON.stringify(catalog), 'Bundled output catalog differs from source catalog');
  const normalSpawns = catalog.stages.reduce((sum, stage) => sum + [...stage.opening, ...stage.late].reduce((n, unit) => n + unit.count, 0), 0);
  assert(manifest.stageCount === 6 && manifest.bossCount === 12 && manifest.normalSpawns === normalSpawns && normalSpawns === 36, 'Output manifest stage/boss/wave accounting is incorrect');
  assert(manifest.indexSha256 === hash(index), 'Output HTML SHA differs from its build manifest');
  const required = [...new Set(['player-homeward', ...catalog.stages.flatMap(stage => [...stage.opening, ...stage.late, stage.midBoss, stage.finalBoss].map(unit => unit.assetId))])].sort();
  assert(JSON.stringify(manifest.assets.map(asset => asset.id).sort()) === JSON.stringify(required), 'Output does not reference exactly the required fleet assets');
  const assets = manifest.assets.map(asset => {
    const file = path.resolve(outputRoot, asset.path);
    assert(file.startsWith(repoPath('outputs/fleet-v1/ships') + path.sep), 'Encounter asset escapes the preserved local fleet corpus');
    const bytes = fs.readFileSync(file), digest = hash(bytes);
    assert(bytes.length === asset.bytes && digest === asset.sha256, `Encounter fleet reference is stale: ${asset.id}`);
    return { id: asset.id, bytes: bytes.length, sha256: digest };
  });
  return { indexBytes: index.length, indexSha256: hash(index), stageCount: 6, bossCount: 12, normalSpawns, assetCount: assets.length, assets };
}

function pngPixels(bytes) {
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Invalid screenshot PNG');
  let width, height, channels, compressed = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8), data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); assert(data[8] === 8 && [2, 6].includes(data[9]) && data[12] === 0, 'Unsupported screenshot PNG format'); channels = data[9] === 6 ? 4 : 3; }
    if (type === 'IDAT') compressed.push(data);
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(compressed)), stride = width * channels, pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c, A = Math.abs(p - a), B = Math.abs(p - b), C = Math.abs(p - c); return A <= B && A <= C ? a : B <= C ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; assert(filter >= 0 && filter <= 4, 'Unknown PNG filter');
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, left = x >= channels ? pixels[i - channels] : 0, up = y ? pixels[i - stride] : 0, corner = y && x >= channels ? pixels[i - stride - channels] : 0;
      pixels[i] = (raw[y * (stride + 1) + x + 1] + (filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : filter === 4 ? paeth(left, up, corner) : 0)) & 255;
    }
  }
  const colors = new Set(); for (let i = 0; i < pixels.length && colors.size < 256; i += channels) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
  return { width, height, channels, pixels, colorsAtLeast: colors.size };
}

async function waitRendered(page, stageId, phase) {
  await page.waitForFunction(({ stageId, phase }) => {
    const stats = window.__encounterStats, state = window.__encounters.getState();
    const expected = [state.player, ...state.enemies].map(actor => `${actor.id}:${actor.assetId}`).sort();
    const actual = stats?.actorModels?.map(actor => `${actor.id}:${actor.assetId}`).sort();
    return stats?.ready === true && stats.loading === 0 && stats.renderedStageId === stageId && stats.renderedPhase === phase && actual && JSON.stringify(expected) === JSON.stringify(actual) && stats.actorModels.every(actor => actor.state === 'loaded' && actor.triangles > 0);
  }, { stageId, phase }, { timeout: 90000 });
  const stats = await page.evaluate(() => window.__encounterStats);
  assert(stats.errors.length === 0 && stats.outlineAutoClear === true, 'Render asset error/outline autoClear regression');
  assert(stats.actors >= 1 && stats.cachedAssets <= 8, 'Live model/cache count exceeds renderer contract');
  return stats;
}

async function renderedStages(page, stages) {
  const captures = [];
  const clearCurrent = () => page.evaluate(() => { const api = window.__encounters; api.pause(false); api.getState().enemies.forEach(enemy => api.defeatEnemy(enemy.id)); api.step(1 / 60); });
  for (const stage of stages) {
    await page.evaluate(id => { const api = window.__encounters; api.setAutoStep(false); api.startStage(id); }, stage.id);
    for (const phase of ['opening', 'midboss', 'late', 'finalboss']) {
      if (phase === 'midboss') await clearCurrent();
      if (phase === 'late') { await clearCurrent(); assert(await page.locator('#primary-action').isVisible(), 'Maintenance continue UI is absent'); await page.locator('#primary-action').click(); }
      if (phase === 'finalboss') await clearCurrent();
      const stats = await waitRendered(page, stage.id, phase), state = await page.evaluate(() => window.__encounters.getState());
      const expected = phase === 'opening' || phase === 'late' ? stage[phase].flatMap(unit => Array(unit.count).fill(unit.assetId)).sort() : [stage[phase === 'midboss' ? 'midBoss' : 'finalBoss'].assetId];
      const actual = stats.actorModels.filter(actor => actor.id !== 'player').map(actor => actor.assetId).sort();
      assert(JSON.stringify(actual) === JSON.stringify(expected), `Rendered ${stage.id}/${phase} uses wrong/missing fleet models`);
      if (phase === 'midboss' || phase === 'finalboss') {
        assert(await page.locator('#boss-hud').isVisible(), 'Boss health HUD missing');
        assert((await page.locator('#boss-tier').innerText()) === (phase === 'midboss' ? '중간보스' : '최종보스'), 'Wrong boss tier displayed');
      }
      const imagePath = path.join(reportDir, `${stage.id}-${phase}.png`), screenshot = await page.locator('#battle').screenshot({ path: imagePath });
      const png = pngPixels(screenshot); assert(png.colorsAtLeast >= 32 && png.width > 300 && png.height > 200, 'Empty/flat rendered battlefield');
      captures.push({ stageId: stage.id, phase, enemyAssetIds: actual, actors: stats.actors, triangles: stats.triangleCount, cachedAssets: stats.cachedAssets, rendererMemory: stats.rendererMemory, colorsAtLeast: png.colorsAtLeast, screenshot: imagePath, bossSpawnCounts: state.bossSpawnCounts });
    }
    await clearCurrent();
    assert((await page.evaluate(() => window.__encounters.getState().phase)) === 'victory', 'Rendered-stage final boss did not lead to victory');
    console.log(`Encounter render: ${stage.id} opening/mid/late/final passed`);
  }
  return captures;
}

async function actualControls(page, stages) {
  const results = [];
  await page.evaluate(() => { window.__encounters.setAutoStep(false); window.__encounters.reset(); });
  await page.locator('#difficulty').selectOption('normal'); await page.locator('#primary-action').click();
  assert((await page.evaluate(() => window.__encounters.getState().phase)) === 'opening', 'Start button failed');
  await waitRendered(page, stages.at(-1).id, 'opening');
  await page.evaluate(() => window.__encounters.setAutoStep(true));
  await page.locator('#battle').focus(); await page.keyboard.down('KeyD'); await page.keyboard.down('KeyJ');
  await page.waitForFunction(() => { const state = window.__encounters.getState(); return state.player.x > .2 && state.stats.shots > 0; });
  await page.keyboard.up('KeyD'); await page.keyboard.up('KeyJ');
  const moved = await page.evaluate(() => window.__encounters.getState());
  await page.keyboard.press('Escape');
  assert((await page.evaluate(() => window.__encounters.getState().paused)) === true, 'Escape did not pause');
  const pausedBefore = await page.evaluate(() => window.__encounters.getState());
  await page.evaluate(async () => { for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame); });
  assert(JSON.stringify(await page.evaluate(() => window.__encounters.getState())) === JSON.stringify(pausedBefore), 'Real-time frames advanced a paused battle');
  await page.locator('#pause').click();
  assert((await page.evaluate(() => window.__encounters.getState().paused)) === false, 'Pause button did not resume');
  await page.evaluate(() => window.__encounters.setAutoStep(false));
  results.push({ name: 'keyboard-move-fire-escape-pause-resume', passed: true, movedX: moved.player.x, shots: moved.stats.shots });

  // Selecting difficulty during an active battle must apply to every fresh-run
  // path, including Restart and death Retry, not merely stage-card selection.
  await page.locator('#difficulty').selectOption('easy'); await page.locator('#restart').click();
  const easy = await page.evaluate(() => window.__encounters.getState());
  assert(easy.difficulty === 'easy' && easy.phase === 'opening' && easy.enemies.length > 0, 'Restart failed to apply selected difficulty');
  await page.locator('#difficulty').selectOption('hard');
  await page.evaluate(() => { window.__encounters.pause(false); window.__encounters.damagePlayer(1e9); });
  assert(await page.locator('#primary-action').isVisible(), 'Defeat retry button missing'); await page.locator('#primary-action').click();
  const hard = await page.evaluate(() => window.__encounters.getState());
  assert(hard.phase === 'opening' && hard.difficulty === 'hard' && hard.runId !== easy.runId, 'Death retry failed to start a fresh selected-difficulty run');
  results.push({ name: 'difficulty-applies-restart-and-death-retry', passed: true, easy: easy.difficulty, hard: hard.difficulty });

  await page.locator('#difficulty').selectOption('normal');
  await page.locator(`[data-stage-id="${stages[0].id}"]`).click();
  assert((await page.evaluate(() => window.__encounters.getState().stageId)) === stages[0].id, 'Stage card did not start selected stage');
  await page.evaluate(() => { const api = window.__encounters; for (let i = 0; i < 2; i++) { api.getState().enemies.forEach(enemy => api.defeatEnemy(enemy.id)); api.step(1 / 60); } });
  assert((await page.evaluate(() => window.__encounters.getState().phase)) === 'maintenance', 'Midboss maintenance overlay absent');
  await page.locator('#primary-action').click();
  assert((await page.evaluate(() => window.__encounters.getState().phase)) === 'late', 'Maintenance button did not continue');
  await page.evaluate(() => { const api = window.__encounters; for (let i = 0; i < 2; i++) { api.getState().enemies.forEach(enemy => api.defeatEnemy(enemy.id)); api.step(1 / 60); } });
  assert((await page.evaluate(() => window.__encounters.getState().phase)) === 'victory', 'Victory overlay absent');
  await page.locator('#primary-action').click();
  assert((await page.evaluate(() => window.__encounters.getState().stageId)) === stages[1].id, 'Victory button did not open next stage');
  results.push({ name: 'stage-card-maintenance-victory-next', passed: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(id => { window.__encounters.setAutoStep(false); window.__encounters.startStage(id); }, stages[0].id);
  await waitRendered(page, stages[0].id, 'opening');
  assert(await page.locator('#joystick').isVisible() && await page.locator('#touch-fire').isVisible() && await page.locator('#touch-dash').isVisible(), 'Mobile combat controls absent');
  await page.locator('#joystick').scrollIntoViewIfNeeded();
  const joy = await page.locator('#joystick').boundingBox();
  await page.evaluate(() => window.__encounters.setAutoStep(true));
  await page.mouse.move(joy.x + joy.width / 2, joy.y + joy.height / 2); await page.mouse.down(); await page.mouse.move(joy.x + joy.width / 2 + 28, joy.y + joy.height / 2);
  await page.waitForFunction(() => window.__encounters.getState().player.x > .2); await page.mouse.up();
  await page.locator('#touch-fire').scrollIntoViewIfNeeded(); const fire = await page.locator('#touch-fire').boundingBox();
  const oldShots = await page.evaluate(() => window.__encounters.getState().stats.shots);
  await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2); await page.mouse.down();
  await page.waitForFunction(shots => window.__encounters.getState().stats.shots > shots, oldShots); await page.mouse.up();
  const released = await page.evaluate(() => window.__encounters.getState());
  await page.waitForFunction(time => window.__encounters.getState().simTime >= time + .4, released.simTime);
  assert((await page.evaluate(() => window.__encounters.getState().stats.shots)) === released.stats.shots, 'Released mobile fire stayed stuck');
  await page.locator('#touch-dash').click(); await page.waitForFunction(() => window.__encounters.getState().player.dashCooldown > 0);
  await page.evaluate(() => { window.__encounters.setAutoStep(false); window.__encounters.pause(true); });
  results.push({ name: 'mobile-joystick-fire-release-dash', passed: true });
  return results;
}

async function pendingAssetGate(browser, origin, indexURL) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 }, reducedMotion: 'reduce' });
  let release; const gate = new Promise(resolve => { release = resolve; }); let heldRequests = 0;
  await page.route('**/*.glb', async route => { heldRequests++; await gate; await route.continue(); });
  try {
    await page.goto(indexURL); await page.waitForFunction(() => window.__encountersReady === true);
    await page.locator('#primary-action').click(); await page.waitForFunction(() => window.__encounterStats.loading > 0);
    const before = await page.evaluate(() => window.__encounters.getState().simTime);
    await page.evaluate(async () => { for (let i = 0; i < 15; i++) await new Promise(requestAnimationFrame); });
    const after = await page.evaluate(() => window.__encounters.getState().simTime);
    assert(before === after, 'Real battle clock advanced while its fleet models were still loading');
    release(); await waitRendered(page, 'stage-01-harbor', 'opening');
    await page.waitForFunction(time => window.__encounters.getState().simTime > time + .1, after);
    return { passed: true, heldRequests, simulatedSecondsDuringLoading: after - before, resumedAfterReady: true };
  } finally { release(); await page.close(); }
}

async function browserChecks(catalog, stages) {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = http.createServer((request, response) => {
    let file; try { file = path.resolve(repoRoot, '.' + decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)); } catch { response.writeHead(400); response.end(); return; }
    if (!file.startsWith(repoRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  const errors = [], externalRequests = [], failedLocalRequests = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/i.test(request.url()) && new URL(request.url()).origin !== origin) externalRequests.push(request.url()); });
  page.on('response', response => { if (response.status() >= 400) failedLocalRequests.push({ url: response.url(), status: response.status() }); });
  try {
    const indexURL = origin + '/' + path.relative(repoRoot, path.join(outputRoot, 'index.html')).split(path.sep).map(encodeURIComponent).join('/');
    await page.goto(indexURL);
    await page.waitForFunction(() => window.__encountersReady === true && window.__encounters, null, { timeout: 90000 });
    const simulation = await page.evaluate(({ source, stages }) => {
      const exercise = (0, eval)(`(${source})`);
      return exercise(window.__encounters, stages);
    }, { source: exerciseSimulation.toString(), stages });
    assert(simulation.passed && simulation.stagesChecked === stages.length, 'Browser simulation suite did not cover every stage');
    const stageRenders = await renderedStages(page, stages);
    const controls = await actualControls(page, stages);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.evaluate(id => { window.__encounters.setAutoStep(false); window.__encounters.startStage(id); window.__encounters.step(.25); }, stages[0].id);
    await waitRendered(page, stages[0].id, 'opening');
    await page.screenshot({ path: path.join(reportDir, 'desktop-opening.png'), fullPage: true });
    const render = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return { width: canvas.width, height: canvas.height, stats: window.__encounterStats, text: document.body.innerText, canvasCount: document.querySelectorAll('canvas').length };
    });
    assert(render.width > 100 && render.height > 100 && render.canvasCount === 1, 'Missing/duplicate battlefield canvas');
    await page.evaluate(() => window.__encounters.pause(true));
    const before = pngPixels(await page.locator('#battle').screenshot());
    await page.evaluate(async () => { for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame); });
    const after = pngPixels(await page.locator('#battle').screenshot());
    assert(before.pixels.equals(after.pixels), 'Paused battlefield accumulated ghosting or continued moving');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(reportDir, 'mobile-portrait.png'), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile portrait horizontal overflow');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.screenshot({ path: path.join(reportDir, 'mobile-landscape.png'), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile landscape horizontal overflow');
    const loadingGate = await pendingAssetGate(browser, origin, indexURL);
    assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
    assert(externalRequests.length === 0, 'Prototype makes external HTTP requests');
    assert(failedLocalRequests.length === 0, 'Local prototype assets failed to load');
    return { simulation, stageRenders, controls, render, loadingGate, pausedPixelChanges: 0, errors, externalRequests, failedLocalRequests, mobileOverflow: false, serving: 'Isolated local HTTP server; no internet asset dependency.' };
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}

(async () => {
  const report = { scope: 'Small offline encounter prototype; no full campaign, engine selection, P0–P4 module loop or production-performance certification.', mode: coreOnly ? 'core-only' : 'core-and-browser', passed: false, fullCoveragePassed: false, failures: [] };
  try {
    assert(fs.existsSync(sourcePath), 'Encounter catalog not built yet');
    const bytes = fs.readFileSync(sourcePath), catalog = JSON.parse(bytes);
    const { stages, stageIds, bosses, sourceReferences } = inspectCatalog(catalog);
    report.catalog = { sha256: hash(bytes), stages: stageIds, bosses, sourceReferences };
    const implementationPaths = ['core.js', 'app.js', 'scene.js', 'template.html'].map(name => repoPath('tools/encounters/' + name)).filter(file => fs.existsSync(file));
    report.implementation = implementationPaths.map(file => ({ path: path.relative(repoRoot, file), sha256: hash(fs.readFileSync(file)) }));
    if (!coreOnly) report.output = inspectOutput(catalog);
    const createEncounter = loadCore();
    report.core = exerciseSimulation(createEncounter(catalog), stages);
    report.attackRules = exerciseAttackRules(createEncounter, catalog);
    report.weaponRoutes = exerciseWeaponRoutes(createEncounter, catalog);
    console.log(`Encounter core: ${stages.length}/${stages.length} stages passed`);
    if (!coreOnly) report.browser = await browserChecks(catalog, stages);
    assert(report.implementation.every(item => hash(fs.readFileSync(repoPath(item.path))) === item.sha256), 'Implementation changed during QA; rebuild and repeat the affected checks');
    report.passed = true; report.fullCoveragePassed = !coreOnly;
  } catch (error) { report.failures.push({ message: error.message, stack: error.stack }); }
  fs.writeFileSync(path.join(reportDir, 'qa-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, fullCoveragePassed: report.fullCoveragePassed, failures: report.failures.map(item => item.message), report: path.join(reportDir, 'qa-result.json') }, null, 2));
  if (!report.passed) process.exitCode = 1;
})();
