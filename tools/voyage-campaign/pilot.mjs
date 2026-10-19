/**
 * Input-only full-stage QA pilot. This module never writes controller/sim state.
 * Movement, aim, fire, maintenance, salvage and docking use the public ports.
 * A successful run proves this prototype's four combat phases and safe return;
 * it is not evidence for the canonical campaign, boss mechanics or game balance.
 */
export const CAMPAIGN_PILOT_VERSION = 'campaign-input-pilot-1';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const phasesRequired = ['opening', 'midboss', 'maintenance', 'late', 'finalboss', 'victory'];
const planar = p => Array.isArray(p) ? {x: p[0], z: p[2]} : {x: p.x, z: p.z};

export function segmentDistanceSquared(a, b, center) {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length ? clamp(((center.x - a.x) * dx + (center.z - a.z) * dz) / length, 0, 1) : 0;
  return (a.x + t * dx - center.x) ** 2 + (a.z + t * dz - center.z) ** 2;
}

/** Clearance is used for navigation only; the real collision authority is sim. */
function visible(a, b, circles, clearance = 0, allowEscape = false) {
  return circles.every(o => {
    const radius = o.radius + clearance;
    if (segmentDistanceSquared(a, b, o) > radius * radius) return true;
    // Real physics may leave the pilot inside its additional navigation margin.
    // Permit an outward escape, never a shortcut across a solid footprint.
    return allowEscape && distance(a, o) < radius && distance(b, o) > distance(a, o)
      && (b.x - a.x) * (a.x - o.x) + (b.z - a.z) * (a.z - o.z) >= 0;
  });
}

function navigationGraph(circles, {radius = 3, bounds = 90, corridors = []} = {}) {
  const clearance = radius + .9, edge = bounds - radius - .6, nodes = [], links = [];
  const valid = p => finitePoint(p) && Math.abs(p.x) < edge && Math.abs(p.z) < edge
    && circles.every(o => distance(p, o) > o.radius + clearance);
  const add = p => { if (valid(p) && !nodes.some(n => distance(n, p) < .1)) nodes.push(p); };
  for (const route of corridors) for (const point of route.points || []) add(planar(point));
  for (const o of circles) {
    const r = o.radius + clearance + 1.6;
    for (let i = 0; i < 16; i++) add({x: o.x + Math.cos(i * Math.PI / 8) * r, z: o.z + Math.sin(i * Math.PI / 8) * r});
  }
  for (let i = 0; i < nodes.length; i++) links.push([]);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (!visible(nodes[i], nodes[j], circles, clearance)) continue;
    const weight = distance(nodes[i], nodes[j]); links[i].push([j, weight]); links[j].push([i, weight]);
  }
  function path(from, to) {
    if (!finitePoint(from) || !valid(to)) return null;
    if (visible(from, to, circles, clearance, true)) return [to];
    const start = nodes.length, end = start + 1, points = [...nodes, from, to];
    const neighbors = [...links.map(list => list.slice()), [], []];
    for (let i = 0; i < nodes.length; i++) {
      if (visible(from, nodes[i], circles, clearance, true)) { const d = distance(from, nodes[i]); neighbors[start].push([i, d]); neighbors[i].push([start, d]); }
      if (visible(to, nodes[i], circles, clearance)) { const d = distance(to, nodes[i]); neighbors[end].push([i, d]); neighbors[i].push([end, d]); }
    }
    const costs = points.map(() => Infinity), previous = points.map(() => -1), closed = new Set(); costs[start] = 0;
    for (let count = 0; count < points.length; count++) {
      let current = -1, best = Infinity;
      for (let i = 0; i < points.length; i++) if (!closed.has(i) && costs[i] + distance(points[i], to) < best) { current = i; best = costs[i] + distance(points[i], to); }
      if (current < 0) break;
      if (current === end) { const result = []; for (let at = end; at !== start; at = previous[at]) result.push(points[at]); return result.reverse(); }
      closed.add(current);
      for (const [next, weight] of neighbors[current]) if (!closed.has(next) && costs[current] + weight < costs[next]) { costs[next] = costs[current] + weight; previous[next] = current; }
    }
    return null;
  }
  return {path, valid, clearance};
}

/** Pure path helper for small steering regressions; does not run a simulation. */
export function planNavigationPath(from, to, circles, options = {}) {
  return navigationGraph(circles, options).path(from, to);
}

function modulePosition(enemy, module) {
  const c = Math.cos(enemy.angle), s = Math.sin(enemy.angle);
  return {x: enemy.x + module.localX * c + module.localZ * s, z: enemy.z - module.localX * s + module.localZ * c};
}

export function createCampaignPilot(controller, {
  maxSteps = 24000, maxSimSeconds = 1200, salvage = true, salvageSeconds = 12,
  orbitDirection = 1, combatRange = 27,
} = {}) {
  if (!controller || typeof controller.command !== 'function' || typeof controller.advance !== 'function' || typeof controller.snapshot !== 'function') throw new TypeError('Public controller command/advance/snapshot ports are required');
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || !Number.isFinite(maxSimSeconds) || maxSimSeconds <= 0 || !Number.isFinite(combatRange) || combatRange < 12 || combatRange > 50) throw new TypeError('Invalid bounded pilot options');
  let calls = 0, steps = 0, elapsed = 0, targetId = null, orbit = orbitDirection < 0 ? -1 : 1;
  let graph = null, graphKey = '', path = [], goal = null, plannedAt = -Infinity;
  let lastPhase = null, lastRun = null, lastEvent = 0, lastHitAt = 0, changedTargetAt = 0;
  let lastProgressAt = 0, lastPosition = null, stuckCount = 0, victoryAt = null, salvageAttempted = false;
  let terminal = null, departedVoyageId = null, initialSettlements = null, finalStage = null;
  const visited = [], transitions = [], kills = [], commands = [];
  const observed = {shots: 0, hits: 0, obstacleHits: 0, detached: 0, recovered: 0, enemyShots: 0, damage: 0};

  function resetNavigation() { path = []; goal = null; plannedAt = -Infinity; }
  function command(type, payload) {
    const result = controller.command(type, payload);
    if (result && typeof result.then === 'function') throw new TypeError('The synchronous input pilot requires synchronous controller.command');
    commands.push({type, ok: !!result?.ok, time: elapsed, reason: result?.reason || null});
    return result;
  }
  function capture(snapshot) {
    const stage = snapshot.stage || {}, sim = snapshot.sim;
    if (stage.runId !== lastRun) { lastRun = stage.runId; lastEvent = 0; }
    if (snapshot.phase === 'sailing' && stage.phase !== lastPhase) { lastPhase = stage.phase; transitions.push({phase: stage.phase, time: elapsed}); if (!visited.includes(stage.phase)) visited.push(stage.phase); resetNavigation(); }
    if (snapshot.phase === 'sailing' || !finalStage) finalStage = {stageId: stage.stageId, phase: stage.phase, runId: stage.runId, activeEnemyIds: [...(stage.activeEnemyIds || [])], bossSpawnCounts: {...stage.bossSpawnCounts}, bossDefeatCounts: {...stage.bossDefeatCounts}};
    departedVoyageId ||= snapshot.voyageId || null;
    if (initialSettlements === null) initialSettlements = snapshot.harbor?.settlements ?? null;
    if (!sim) return;
    for (const event of sim.events || []) {
      if (event.seq <= lastEvent) continue;
      lastEvent = event.seq;
      if (event.type === 'player-fire') observed.shots++;
      if (event.type === 'hit' && event.owner === 'player' && event.target === 'module') { observed.hits++; lastHitAt = elapsed; }
      if (event.type === 'hit' && event.owner === 'player' && event.target === 'obstacle') observed.obstacleHits++;
      if (event.type === 'enemy-fire') observed.enemyShots++;
      if (event.type === 'bundle-detached') observed.detached++;
      if (event.type === 'salvaged') observed.recovered++;
      if (event.type === 'enemy-defeated') kills.push({enemyId: event.enemyId, time: event.time});
    }
    observed.damage = sim.stats?.damageTaken ?? observed.damage;
  }
  function finish(reason, extra = {}) {
    const snapshot = controller.snapshot(), sim = snapshot.sim;
    const stageCleared = phasesRequired.every(phase => visited.includes(phase))
      && finalStage?.phase === 'victory' && finalStage.activeEnemyIds.length === 0
      && finalStage.bossDefeatCounts.midboss === 1 && finalStage.bossDefeatCounts.finalboss === 1;
    terminal = {version: CAMPAIGN_PILOT_VERSION, done: true, returned: snapshot.phase === 'harbor' && victoryAt !== null,
      stageCleared, saved: snapshot.phase === 'harbor' && !snapshot.harbor?.dirty, reason,
      voyageId: departedVoyageId, steps, calls, simulatedSeconds: elapsed, observed: {...observed}, visited: [...visited], transitions: [...transitions], kills: [...kills], commands: [...commands], finalStage,
      diagnostic: {phase: snapshot.phase, stagePhase: snapshot.stage?.phase, currentStage: snapshot.campaign?.currentStageIndex ?? null,
        hp: sim?.player?.hp ?? null, cargoWeight: sim?.player?.cargoWeight ?? null, weight: sim?.player?.weight ?? null, lift: sim?.player?.lift ?? null,
        outcome: sim?.outcome ?? null, endReason: sim?.endReason ?? null, targetId,
        remaining: (sim?.enemies || []).filter(e => !e.defeated).map(e => ({id:e.id,hp:e.hp,x:e.x,z:e.z})),
        settlementsBefore: initialSettlements, settlementsAfter: snapshot.harbor?.settlements ?? null, status: snapshot.status}, ...extra};
    return terminal;
  }
  function navigate(sim, target, snapshot) {
    const level = snapshot.routeMap?.seaLevel || snapshot.routeMap || snapshot.level || {};
    const key = JSON.stringify([sim.obstacles, sim.player.radius, level.id]);
    if (key !== graphKey) { graphKey = key; graph = navigationGraph(sim.obstacles, {radius: sim.player.radius, corridors: level.corridors || []}); resetNavigation(); }
    if (!goal || distance(goal, target) > 4 || elapsed - plannedAt > .8 || !path.length) {
      goal = {...target}; plannedAt = elapsed; path = graph.path(sim.player, target) || [];
    }
    while (path.length > 1 && visible(sim.player, path[1], sim.obstacles, graph.clearance, true)) path.shift();
    while (path.length > 1 && distance(sim.player, path[0]) < 2) path.shift();
    const waypoint = path[0]; if (!waypoint) return null;
    const d = distance(sim.player, waypoint), scale = Math.min(.9, d / 4), divisor = Math.max(d, 1e-9);
    return {moveX: (waypoint.x - sim.player.x) / divisor * scale, moveZ: (waypoint.z - sim.player.z) / divisor * scale};
  }
  function dodge(sim, move) {
    let x = move.moveX, z = move.moveZ;
    for (const enemy of sim.enemies || []) {
      if (enemy.defeated) continue;
      const dx = sim.player.x - enemy.x, dz = sim.player.z - enemy.z, d = Math.hypot(dx, dz) || 1;
      const safety = sim.player.radius + enemy.radius + 3;
      if (d < safety) { const scale = (safety - d) / 3; x += dx / d * scale; z += dz / d * scale; }
    }
    for (const shot of sim.projectiles || []) {
      if (shot.owner === 'player') continue;
      const dx = shot.x - sim.player.x, dz = shot.z - sim.player.z;
      const vx = shot.vx - sim.player.vx, vz = shot.vz - sim.player.vz, v2 = vx * vx + vz * vz;
      const time = v2 ? clamp(-(dx * vx + dz * vz) / v2, 0, .75) : 0;
      const cx = dx + vx * time, cz = dz + vz * time, d = Math.hypot(cx, cz) || 1;
      if (d < sim.player.radius + (shot.radius || 0) + 2 && Math.hypot(dx, dz) < 22) { const scale = (1 - time / 1.5) * .9; x -= cx / d * scale; z -= cz / d * scale; }
    }
    const magnitude = Math.max(1, Math.hypot(x, z)); return {moveX:x / magnitude, moveZ:z / magnitude};
  }
  function combatInput(sim, snapshot) {
    let enemy = sim.enemies.find(e => e.id === targetId && !e.defeated);
    if (!enemy || elapsed - lastHitAt > 18 && elapsed - changedTargetAt > 18) {
      const choices = sim.enemies.filter(e => !e.defeated).sort((a,b) => (distance(sim.player,a) + (a.id === targetId ? 40 : 0)) - (distance(sim.player,b) + (b.id === targetId ? 40 : 0)));
      enemy = choices[0]; targetId = enemy?.id || null; changedTargetAt = elapsed; lastHitAt = elapsed; resetNavigation();
    }
    if (!enemy) return null;
    const root = enemy.modules.find(m => m.key === 'root' && m.hp > 0);
    if (!root) return null;
    const center = modulePosition(enemy, root), angle = Math.atan2(sim.player.z-center.z,sim.player.x-center.x);
    const lead = Math.min(.9, distance(sim.player, center) / 45);
    // Native simulation projectiles own the actual travel and collision.
    const aim = {aimX:center.x+enemy.vx*lead, aimZ:center.z+enemy.vz*lead, fire:true};
    if (!graph) { navigate(sim, {x:0,z:55}, snapshot); }
    const candidates = [];
    for (const offset of [.5, 1, 1.5, 2.1, -.5, -1]) for (const range of [combatRange, combatRange+7, combatRange-6]) {
      const a = angle + orbit * offset, position = {x:center.x+Math.cos(a)*range,z:center.z+Math.sin(a)*range};
      if (graph.valid(position) && visible(position, center, sim.obstacles, .4)) candidates.push({position, score:distance(sim.player,position)+Math.abs(offset-.5)*10+Math.abs(range-combatRange)*.4});
    }
    candidates.sort((a,b)=>a.score-b.score);
    let move = null;
    for (const candidate of candidates.slice(0,6)) { move = navigate(sim, candidate.position, snapshot); if (move) break; }
    if (!move) move = navigate(sim, {x:clamp(center.x,-75,75),z:clamp(center.z,-75,75)}, snapshot);
    if (!move) return {...aim,moveX:0,moveZ:0,navigationBlocked:true};
    if (!lastPosition) { lastPosition = {x:sim.player.x,z:sim.player.z}; lastProgressAt = elapsed; }
    if (elapsed-lastProgressAt >= 3) {
      if (distance(sim.player,lastPosition)<1.5) { orbit*=-1; stuckCount++; resetNavigation(); }
      lastPosition={x:sim.player.x,z:sim.player.z}; lastProgressAt=elapsed;
    }
    return {...dodge(sim,move),...aim};
  }

  function step(dt = .05) {
    if (terminal) return terminal;
    if (!Number.isFinite(dt) || dt <= 0 || dt > .1) return finish('invalid-step-duration');
    calls++;
    const snapshot = controller.snapshot(); capture(snapshot);
    if (snapshot.phase === 'defeat') return finish('defeat');
    if (snapshot.phase === 'harbor') return finish(victoryAt !== null ? (snapshot.harbor?.dirty ? 'settlement-save-failed' : null) : 'not-sailing');
    const sim = snapshot.sim;
    if (!sim || snapshot.phase !== 'sailing') return finish('no-active-simulation');
    if (calls > maxSteps+32 || steps >= maxSteps || elapsed >= maxSimSeconds) return finish('pilot-timeout', {stuckCount});
    if (snapshot.stage?.phase === 'maintenance') {
      const continued = command('maintenance'); if (!continued?.ok) return finish('maintenance-rejected', {commandReason:continued?.reason});
      return {done:false,mode:'maintenance',steps,observed:{...observed}};
    }
    if (sim.paused) return finish('unexpected-pause');
    let input;
    if (snapshot.stage?.phase === 'victory') {
      victoryAt ??= elapsed;
      if (salvage && !salvageAttempted && !sim.cargo.length && elapsed-victoryAt < salvageSeconds) {
        const margin=sim.player.lift-sim.player.weight-.5;
        const available=sim.debris.filter(b=>!b.salvaged&&!b.lost&&b.remaining>0&&b.weight>0).sort((a,b)=>distance(sim.player,a)-distance(sim.player,b));
        const candidate=available.find(b=>b.weight<=margin);
        if (candidate) {
          const nearby=available.filter(b=>distance(sim.player,b)<=10);
          if (nearby.length && nearby[0].weight<=margin) { const recovered=command('salvage');salvageAttempted=true;if(!recovered?.ok)return finish('salvage-rejected',{commandReason:recovered?.reason}); }
          else if (nearby.length) salvageAttempted=true;
          else input=navigate(sim,candidate,snapshot);
        } else salvageAttempted=true;
      } else salvageAttempted=true;
      if (!input) {
        if (distance(sim.player,sim.harbor)<Math.max(1,sim.harbor.radius-1.5)) {
          const returned=command('return'),after=controller.snapshot();capture(after);
          if (!returned?.ok) return finish(after.phase==='harbor'?'settlement-save-failed':'return-rejected',{commandReason:returned?.reason});
          return finish(after.phase==='harbor'?null:'return-did-not-settle');
        }
        input=navigate(sim,sim.harbor,snapshot);
        if (!input) return finish('no-safe-return-path');
      }
    } else {
      input=combatInput(sim,snapshot);
      if (!input) return finish('no-enemy-before-stage-victory');
    }
    const {navigationBlocked,...publicInput}=input;
    controller.advance(dt,publicInput);steps++;elapsed+=dt;
    return {done:false,mode:victoryAt===null?'full-combat':input.fire?'full-combat':'return-or-salvage',steps,observed:{...observed},navigationBlocked:!!navigationBlocked};
  }
  function next(dt = .05) {
    try { return step(dt); }
    catch (error) { return finish('controller-or-pilot-error', {errorMessage:error.message}); }
  }
  return {next, get result(){return terminal;}};
}

export function runCampaignSortie(controller, {dt=.05,onStep,depart=true,...options} = {}) {
  if (depart) {
    const result=controller.command('depart');
    if (!result?.ok) return {version:CAMPAIGN_PILOT_VERSION,done:true,returned:false,stageCleared:false,saved:false,reason:'departure-rejected',commandReason:result?.reason,steps:0};
  }
  const pilot=createCampaignPilot(controller,options);
  for (;;) { const result=pilot.next(dt);onStep?.(controller.snapshot(),dt,result);if(result.done)return result; }
}
