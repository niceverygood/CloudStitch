/**
 * Cloudstitch audio v1: read-only consumer of battlefield/sim.mjs events.
 * No simulation imports, clocks, commands, damage, ownership or ledger writes.
 *
 * Feed the same snapshot and explicit {voyageId, generation} used to read the
 * events. Session snapshots do NOT expose generation: use battlefield.generation.
 * Renderer events are untagged; enriched drainEvents entries are also accepted.
 * A command may emit sim.events without refreshing session.snapshot().events.
 */
export const AUDIO_ADAPTER_VERSION = 'audio-adapter-1.0.0-ready';
export const AUDIO_COORDINATES = Object.freeze({
  frame: 'XZ, Y-up, provisional LU; not metres',
  listener: 'snapshot.sim.player; camera orientation defines stereo right',
  camera: 'position/target: [x,y,z] or {x,y,z}; optional right:{x,z}',
  fallback: 'camera looking -Z: +X is screen right',
  attenuation: '1 / (1 + (distanceXZ / 22)^2), minimum 0.12',
  pan: 'dot(source-listener, camera rightXZ) / 28, clamped to [-1,1]',
});

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sequence = event => Number.isSafeInteger(event?.seq) && event.seq > 0 ? event.seq : null;
const generationValid = value => Number.isSafeInteger(value) && value >= 1;
const voyageValid = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
const point = value => Array.isArray(value)
  ? { x: finite(value[0]), z: finite(value[2]) }
  : { x: finite(value?.x), z: finite(value?.z) };
const simOf = snapshot => snapshot?.sim ?? (snapshot?.player ? snapshot : null);
const phaseOf = snapshot => snapshot?.phase ?? simOf(snapshot)?.outcome ?? 'harbor';
const highestSequence = snapshot => {
  const sim = simOf(snapshot);
  if (Number.isSafeInteger(sim?.eventSeq) && sim.eventSeq >= 0) return sim.eventSeq;
  return (sim?.events ?? snapshot?.events ?? []).reduce((high, event) => Math.max(high, sequence(event) ?? 0), 0);
};

function materialOf(event, snapshot) {
  const sim = simOf(snapshot);
  let module;
  if (event.target === 'player') module = sim?.player?.modules?.find(part => part.key === 'root');
  if (event.moduleId) {
    module = sim?.enemies?.find(enemy => enemy.id === event.enemyId)?.modules?.find(part => part.id === event.moduleId);
    // Destroyed/detached modules may survive only in the debris/cargo snapshot.
    if (!module) for (const bundle of [...(sim?.debris ?? []), ...(sim?.cargo ?? [])]) {
      module = bundle.modules?.find(part => part.id === event.moduleId);
      if (module) break;
    }
  }
  const type = module?.type;
  if (type === 'balloon' || type === 'fabric' || type === 'canvas') return 'cloth';
  if (type === 'engine') return 'engine';
  if (['armor', 'connector', 'cannon', 'machinegun', 'harpoon', 'hook', 'weapon', 'mortar', 'chain', 'flamethrower'].includes(type)) return 'armor';
  // sim has no authored obstacle material. Do not invent stone/metal metadata.
  return 'wood';
}

function spatial(event, snapshot, camera) {
  const listener = point(simOf(snapshot)?.player);
  const location = Number.isFinite(event?.x) && Number.isFinite(event?.z) ? point(event) : listener;
  const dx = location.x - listener.x, dz = location.z - listener.z;
  let rightX = 1, rightZ = 0;
  if (camera?.right && (Number.isFinite(camera.right.x) || Array.isArray(camera.right))) {
    const right = point(camera.right), length = Math.hypot(right.x, right.z);
    if (length > 1e-8) { rightX = right.x / length; rightZ = right.z / length; }
  } else if (camera?.position && camera?.target) {
    const position = point(camera.position), target = point(camera.target);
    const forwardX = target.x - position.x, forwardZ = target.z - position.z;
    const length = Math.hypot(forwardX, forwardZ);
    if (length > 1e-8) { rightX = -forwardZ / length; rightZ = forwardX / length; }
  }
  return { pan: clamp((dx * rightX + dz * rightZ) / 28, -1, 1), gain: Math.max(.12, 1 / (1 + (Math.hypot(dx, dz) / 22) ** 2)) };
}

/**
 * audio: {play(id,opts),setLoop(id,on,opts),clear(reason),setPaused(bool)}.
 * update after lifecycle commands and BEFORE advancing a resumed simulation.
 * reset({voyageId,generation,baselineSeq?}) explicitly establishes a boundary.
 * Same-identity reset never lowers the monotonic cursor. Host callbacks cannot
 * break this consumer; errors are counted and available via debug().
 */
export function createAudioAdapter({ audio, onCue } = {}) {
  for (const method of ['play', 'setLoop', 'clear', 'setPaused']) if (typeof audio?.[method] !== 'function') throw new TypeError(`audio.${method} must be a function`);
  let disposed = false, hidden = false, paused = false, resumeBarrier = false;
  let identity = null, cursor = 0, lastSnapshot = null, lastContext = {}, lifecycle = null;
  let returnPlayed = false, danger = false, clearingCombat = false;
  const retired = []; // Fixed 8 identities, diagnostics only; never one entry per shot.
  const loops = new Map(); // Only the three known loop IDs.
  const stats = { accepted: 0, duplicate: 0, stale: 0, invalid: 0, suppressed: 0, unknown: 0, cues: 0, errors: 0, boundaries: 0 };
  const safe = (method, ...args) => { try { return audio[method](...args); } catch { stats.errors++; return false; } };
  const notify = payload => { if (typeof onCue === 'function') try { onCue(payload); } catch { stats.errors++; } };
  const clear = reason => { safe('clear', reason); loops.clear(); danger = false; };

  function contextIdentity(snapshot, context = {}) {
    const voyageId = context.voyageId ?? snapshot?.voyageId;
    const generation = context.generation ?? snapshot?.generation;
    if (!voyageValid(voyageId) || !generationValid(generation)) return null;
    if (voyageValid(snapshot?.voyageId) && snapshot.voyageId !== voyageId) return null;
    if (generationValid(snapshot?.generation) && snapshot.generation !== generation) return null;
    return { voyageId, generation };
  }
  const same = (a, b) => a?.voyageId === b?.voyageId && a?.generation === b?.generation;
  function adopt(next, explicit = false, baseline = 0) {
    if (same(identity, next)) { cursor = Math.max(cursor, baseline); return true; }
    if (!explicit && identity) {
      if (next.voyageId === identity.voyageId && next.generation < identity.generation) return false;
      if (retired.some(old => same(old, next))) return false;
    }
    if (identity) { retired.push(identity); if (retired.length > 8) retired.shift(); }
    identity = next; cursor = baseline; returnPlayed = false; lifecycle = null;
    clear('identity-change'); stats.boundaries++; return true;
  }
  function play(id, event, snapshot, context, priority = 2, adjustment = {}) {
    const where = spatial(event, snapshot, context.camera);
    const key = `${identity?.voyageId ?? 'port'}:${identity?.generation ?? 0}:${sequence(event) ?? 'state'}:${id}:${event?.weaponId ?? 'none'}`;
    const options = { ...where, gain: where.gain * finite(adjustment.gainScale, 1), priority, variantKey: key };
    if (Number.isFinite(adjustment.rate)) options.rate = adjustment.rate;
    const result = safe('play', id, options);
    stats.cues++; notify({ id, eventType: event?.type ?? 'state', eventSeq: sequence(event), voyageId: identity?.voyageId ?? null, generation: identity?.generation ?? null, ...options, played: result !== false });
  }
  function loop(id, on, options = {}) {
    let previous = loops.get(id);
    // Unlock/mute/UI clear can remove a runtime voice independently. Never keep
    // a failed start in this cache or assume an externally cleared loop lives.
    const runtime = typeof audio.debug === 'function' ? safe('debug') : null;
    if (previous && Array.isArray(runtime?.activeLoops) && !runtime.activeLoops.includes(id)) { loops.delete(id); previous = null; }
    if (!on) {
      if (previous) { safe('setLoop', id, false, options); loops.delete(id); }
      return;
    }
    // Quantized rate/gain changes update an existing voice; they never restart it.
    const next = { rate: Math.round(finite(options.rate, 1) * 20) / 20, gain: Math.round(finite(options.gain, 1) * 20) / 20 };
    if (!previous || previous.rate !== next.rate || previous.gain !== next.gain) {
      if (safe('setLoop', id, true, next) === true) loops.set(id, next);
      else loops.delete(id);
    }
  }
  function sync(snapshot, context = {}) {
    if (disposed || !snapshot || typeof snapshot !== 'object') return false;
    const next = contextIdentity(snapshot, context);
    // Harbor before the first departure legitimately has no voyage/generation.
    const noCombat = !simOf(snapshot) && phaseOf(snapshot) === 'harbor';
    if (!next && !noCombat) { stats.invalid++; return false; }
    if (next && !adopt(next)) { stats.stale++; return false; }
    lastSnapshot = snapshot; lastContext = { ...context };
    const sim = simOf(snapshot), phase = phaseOf(snapshot), stage = snapshot.stage?.phase;
    const statePaused = !!snapshot.paused || !!sim?.paused || stage === 'maintenance';
    const blocked = hidden || statePaused;
    const sailing = phase === 'sailing' && sim?.outcome === 'sailing';
    const level = typeof snapshot.level === 'string' ? snapshot.level : snapshot.level?.id;
    const now = { phase, outcome: sim?.outcome ?? null, blocked, level: level ?? null };
    const previous = lifecycle;
    const returned = !!previous && !returnPlayed && ((previous.phase === 'sailing' && phase === 'harbor') || (previous.outcome !== 'victory' && sim?.outcome === 'victory'));
    const boundary = previous && (previous.phase !== phase || previous.outcome !== now.outcome || previous.level !== now.level);
    if (boundary) { clear('phase-or-map-change'); stats.boundaries++; }
    if (blocked !== paused) { paused = blocked; safe('setPaused', blocked); if (blocked) clear('pause-or-hidden'); }
    if (blocked || resumeBarrier || (previous?.blocked && !blocked)) {
      cursor = Math.max(cursor, highestSequence(snapshot));
      resumeBarrier = false;
    }
    lifecycle = now;
    if (returned) {
      returnPlayed = true;
      if (!blocked) play('return', { type: 'return-state', ...sim?.player }, snapshot, context, 2);
    }
    const running = sailing && !blocked;
    const speed = Math.hypot(finite(sim?.player?.vx), finite(sim?.player?.vz));
    const normalizedSpeed = clamp(speed / 23, 0, 1);
    loop('engine-loop', running, { rate: .8 + normalizedSpeed * .5, gain: .42 });
    loop('wind-loop', running, { rate: .75 + normalizedSpeed * .65, gain: .24 + normalizedSpeed * .2 });
    const risky = running && Number.isFinite(sim?.player?.weight) && Number.isFinite(sim?.player?.lift) && sim.player.weight > sim.player.lift;
    if (risky && !danger) play('lift-warning', { type: 'lift-state', ...sim.player }, snapshot, context, 3);
    danger = risky;
    const overload = risky ? clamp((sim.player.weight - sim.player.lift) / Math.max(1, sim.player.weight), 0, 1) : 0;
    loop('lift-danger-loop', risky, { rate: 1 + overload * .5, gain: .4 });
    return true;
  }

  function consume(events, snapshot, context = {}) {
    if (!sync(snapshot, context)) return 0;
    if (!Array.isArray(events)) { stats.invalid++; return 0; }
    let accepted = 0;
    // Sorting a copy protects the caller and handles a shuffled delivery batch.
    // The authority itself retains only 200 events; cap arbitrary host input.
    const batch = events.length <= 1024 ? events : events.slice(-1024);
    if (events.length > 1024) stats.invalid += events.length - 1024;
    for (const event of batch.slice().sort((a, b) => (sequence(a) ?? Infinity) - (sequence(b) ?? Infinity))) {
      const seq = sequence(event);
      if (seq === null || typeof event?.type !== 'string') { stats.invalid++; continue; }
      if ((event.voyageId !== undefined && event.voyageId !== identity?.voyageId) || (event.generation !== undefined && event.generation !== identity?.generation)) { stats.stale++; continue; }
      if (seq <= cursor) { stats.duplicate++; continue; }
      cursor = seq; accepted++; stats.accepted++;
      const sim = simOf(snapshot), blocked = hidden || paused || lifecycle?.phase !== 'sailing' || sim?.outcome !== 'sailing';
      if (event.type === 'combat-cleared') {
        clear('combat-cleared'); clearingCombat = true;
        // Sequence identity survives a combat barrier inside the same voyage.
        continue;
      }
      if (blocked) { stats.suppressed++; continue; }
      const options = [event, snapshot, context];
      if (event.type === 'player-fire' || event.type === 'enemy-fire') {
        const id = event.weaponId === '01-machine-gun' ? 'fire-machinegun' : event.weaponId === '02-deck-cannon' ? 'fire-cannon' : null;
        if (id) play(id, ...options, 2); else stats.unknown++;
      } else if (event.type === 'hit') {
        const adjustment = event.weaponId === '02-deck-cannon' ? { gainScale: .95, rate: .9 }
          : event.weaponId === '01-machine-gun' ? { gainScale: .72, rate: 1.04 } : {};
        play(`hit-${materialOf(event, snapshot)}`, ...options, 2, adjustment);
      }
      else if (event.type === 'module-destroyed' && event.moduleType === 'connector') play('connector-cut', ...options, 2);
      else if (event.type === 'bundle-detached') play('bundle-detach', ...options, 2);
      else if (event.type === 'salvaged') play('salvage', ...options, 2);
      else if (event.type === 'player-repaired' && event.restored > 0) play('harbor-repair', ...options, 2);
      else stats.unknown++;
    }
    if (clearingCombat) {
      clearingCombat = false;
      // A state update restarts persistent sailing ambience after the barrier.
      // The current batch may still contain later authoritative spawn/fire cues.
      sync(snapshot, context);
    }
    return accepted;
  }
  function commandResult(type, result, snapshot, context = {}) {
    if (disposed) return false;
    // Validate source identity before even an explicit lifecycle reset. A late
    // old command callback must not replace the current voyage's cursor.
    if (!contextIdentity(snapshot, context) && !(!simOf(snapshot) && phaseOf(snapshot) === 'harbor')) { stats.invalid++; return false; }
    if (result?.ok === true && ['retry', 'restore', 'depart', 'map-change'].includes(type)) {
      reset({ ...context, baselineSeq: highestSequence(snapshot) });
    }
    if (!sync(snapshot, context)) return false;
    if (!['repair', 'equip', 'save'].includes(type) || typeof result?.ok !== 'boolean') return false;
    if (hidden || paused) return false;
    const id = result.ok ? { repair: 'harbor-repair', equip: 'harbor-equip', save: 'save-ok' }[type] : 'ui-fail';
    play(id, { type: `${type}-result`, ...simOf(snapshot)?.player }, snapshot, context, 2);
    return true;
  }
  function update(snapshot, context = {}) { return sync(snapshot, context); }
  function setHidden(value) {
    if (disposed || hidden === !!value) return;
    hidden = !!value;
    if (hidden) { clear('hidden'); paused = true; safe('setPaused', true); }
    else resumeBarrier = true;
    if (lastSnapshot) sync(lastSnapshot, lastContext);
  }
  function reset(context = {}) {
    if (disposed) return false;
    const next = contextIdentity(null, context), baseline = Number.isSafeInteger(context.baselineSeq) && context.baselineSeq >= 0 ? context.baselineSeq : 0;
    if (next) adopt(next, true, baseline);
    clear('reset'); lifecycle = null; lastSnapshot = null; lastContext = {};
    // Explicit same-identity reset preserves the cursor and blocks old history.
    if (!next) cursor = Math.max(cursor, baseline);
    returnPlayed = false; resumeBarrier = false;
    return true;
  }
  function dispose() {
    if (disposed) return;
    clear('dispose'); safe('setPaused', true); disposed = true;
    lastSnapshot = null; lastContext = {}; lifecycle = null; retired.length = 0;
  }
  function debug() {
    return { version: AUDIO_ADAPTER_VERSION, disposed, hidden, paused, identity: identity ? { ...identity } : null, cursor, loops: [...loops.keys()], retiredIdentities: retired.length, retainedModuleMaps: 0, lifecycle: lifecycle ? { ...lifecycle } : null, ...stats };
  }
  return { consume, update, commandResult, setHidden, reset, dispose, debug };
}
