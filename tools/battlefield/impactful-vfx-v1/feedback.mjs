/**
 * Display feedback only. The renderer supplies simulation-time deltas and reads
 * these offsets after aiming with its stable base camera. Nothing here writes
 * camera objects, actors, damage, projectiles, audio or simulation time.
 */
export const FEEDBACK_LIMITS = Object.freeze({
  maxPulses: 32, receiptCapacity: 2048, duration: .34,
  cameraXZ: .22, cameraY: .12, roll: .025, zoomKick: .02, weaponRecoil: .4,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const directionOf = value => {
  const x = Number.isFinite(value?.x) ? value.x : 0;
  const z = Number.isFinite(value?.z) ? value.z : 0;
  const length = Math.hypot(x, z);
  return length > 1e-8 ? { x: x / length, y: 0, z: z / length } : { x: 0, y: 0, z: 1 };
};
const validGeneration = value => Number.isSafeInteger(value) && value >= 0;
const freshCounters = () => ({ fires: 0, hits: 0, playerHits: 0, duplicateSequences: 0,
  duplicateShots: 0, staleGenerations: 0, invalidEvents: 0, droppedPulses: 0,
  peakPulses: 0, clears: 0 });

/** All distances are display units; roll is radians and zoomKick is a ratio. */
export function createCombatFeedback({ reducedMotion = false } = {}) {
  if (typeof reducedMotion !== 'boolean') throw new TypeError('reducedMotion must be boolean');
  let generation = null, sequence = 0, pulses = [], stopped = false;
  let aimDirection = { x: 0, y: 0, z: 1 }, counters = freshCounters();
  const fireReceipts = new Set(), hitReceipts = new Set();

  function reset(nextGeneration = null) {
    if (nextGeneration !== null && !validGeneration(nextGeneration)) throw new TypeError('Invalid feedback generation');
    generation = nextGeneration; sequence = 0; pulses = []; stopped = false;
    aimDirection = { x: 0, y: 0, z: 1 }; counters = freshCounters();
    fireReceipts.clear(); hitReceipts.clear();
    return sample();
  }

  function remember(receipts, key) {
    if (receipts.has(key)) { counters.duplicateShots += 1; return false; }
    receipts.add(key);
    if (receipts.size > FEEDBACK_LIMITS.receiptCapacity) receipts.delete(receipts.values().next().value);
    return true;
  }

  function addPulse(pulse) {
    // Retain the newest input/impact under overload, with a fixed memory bound.
    if (pulses.length === FEEDBACK_LIMITS.maxPulses) { pulses.shift(); counters.droppedPulses += 1; }
    pulses.push({ ...pulse, age: 0 });
    counters.peakPulses = Math.max(counters.peakPulses, pulses.length);
  }

  /** Explicit generation is recommended. Old-generation seq never advances the cursor. */
  function consume(events = [], currentGeneration = undefined) {
    if (!Array.isArray(events)) throw new TypeError('Feedback events must be an array');
    if (currentGeneration !== undefined) {
      if (!validGeneration(currentGeneration)) throw new TypeError('Invalid feedback generation');
      if (generation !== null && currentGeneration < generation) {
        counters.staleGenerations += events.length; return sample();
      }
      if (generation !== currentGeneration) reset(currentGeneration);
    }
    // Establish a generation before sorting/filtering seq, never from a stale seq.
    if (generation === null) generation = events.find(event => validGeneration(event?.generation))?.generation ?? 0;
    const pending = [];
    for (const event of events) {
      if (!event || typeof event !== 'object' || !Number.isSafeInteger(event.seq) || event.seq <= 0) {
        counters.invalidEvents += 1; continue;
      }
      if (event.generation !== undefined && !validGeneration(event.generation)) {
        counters.invalidEvents += 1; continue;
      }
      if (event.generation !== undefined && event.generation !== generation) {
        counters.staleGenerations += 1; continue;
      }
      pending.push(event);
    }
    pending.sort((a, b) => a.seq - b.seq);
    for (const event of pending) {
      if (event.seq <= sequence) { counters.duplicateSequences += 1; continue; }
      sequence = event.seq;
      if (event.type === 'combat-cleared' || event.type === 'clear' || event.type === 'defeat' || event.type === 'victory') {
        pulses = []; counters.clears += 1;
        if (event.type === 'defeat' || event.type === 'victory') stopped = true;
        continue;
      }
      if (stopped) continue;
      const direction = directionOf(event.direction);
      const sign = event.seq % 2 ? 1 : -1;
      if (event.type === 'player-fire') {
        const receipt = event.projectileId == null ? `seq:${event.seq}` : String(event.projectileId);
        if (!remember(fireReceipts, receipt)) continue;
        const cannon = event.weaponId === '02-deck-cannon';
        const harpoon = event.weaponId === '04-harpoon';
        aimDirection = { ...direction }; counters.fires += 1;
        addPulse({ kind: 'fire', direction, sign, duration: cannon ? .29 : harpoon ? .26 : .19,
          recoil: cannon ? .32 : harpoon ? .28 : .18, camera: cannon ? .075 : .027,
          zoom: cannon ? .007 : .0025, flash: 0 });
      } else if (event.type === 'hit') {
        // A collision against one authoritative target produces one feedback pulse.
        const receipt = event.projectileId == null ? `seq:${event.seq}` :
          JSON.stringify([String(event.projectileId), event.target, event.moduleId ?? event.enemyId ?? null]);
        if (!remember(hitReceipts, receipt)) continue;
        const player = event.target === 'player';
        const obstacle = event.target === 'obstacle';
        counters.hits += 1; if (player) counters.playerHits += 1;
        addPulse({ kind: player ? 'player-hit' : 'hit', direction, sign,
          duration: player ? .34 : .28, recoil: 0,
          camera: player ? .19 : obstacle ? .035 : .092,
          zoom: player ? .017 : obstacle ? .003 : .009,
          flash: player ? .7 : obstacle ? .12 : .4 });
      }
    }
    return sample();
  }

  function update(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new TypeError('Feedback dt must be finite and nonnegative');
    if (dt > 0) {
      for (const pulse of pulses) pulse.age += dt;
      pulses = pulses.filter(pulse => pulse.age + 1e-12 < pulse.duration);
    }
    return sample();
  }

  function sample() {
    let x = 0, y = 0, z = 0, roll = 0, zoomKick = 0, weaponRecoil = 0;
    let recoilX = 0, recoilZ = 0, playerFlash = 0, hitFlash = 0;
    for (const pulse of pulses) {
      const envelope = (1 - pulse.age / pulse.duration) ** 2;
      const wobble = Math.cos(pulse.age * 58), twist = Math.cos(pulse.age * 45);
      const kick = pulse.recoil * envelope * (.76 + .24 * Math.cos(pulse.age * 52));
      weaponRecoil += kick;
      recoilX -= pulse.direction.x * kick; recoilZ -= pulse.direction.z * kick;
      x += (-pulse.direction.x * .78 + pulse.direction.z * pulse.sign * .22) * pulse.camera * envelope * wobble;
      z += (-pulse.direction.z * .78 - pulse.direction.x * pulse.sign * .22) * pulse.camera * envelope * wobble;
      y += pulse.camera * .42 * envelope * Math.cos(pulse.age * 47);
      roll += pulse.sign * pulse.camera * .11 * envelope * twist;
      zoomKick += pulse.zoom * envelope;
      const flash = pulse.flash * envelope;
      if (pulse.kind === 'player-hit') playerFlash = Math.max(playerFlash, flash);
      else if (pulse.kind === 'hit') hitFlash = Math.max(hitFlash, flash);
    }
    const recoilLength = Math.hypot(recoilX, recoilZ);
    const recoilScale = recoilLength > FEEDBACK_LIMITS.weaponRecoil ? FEEDBACK_LIMITS.weaponRecoil / recoilLength : 1;
    const restrained = reducedMotion ? .35 : 1;
    const cameraOffset = reducedMotion ? { x: 0, y: 0, z: 0 } : {
      x: clamp(x, -FEEDBACK_LIMITS.cameraXZ, FEEDBACK_LIMITS.cameraXZ),
      y: clamp(y, -FEEDBACK_LIMITS.cameraY, FEEDBACK_LIMITS.cameraY),
      z: clamp(z, -FEEDBACK_LIMITS.cameraXZ, FEEDBACK_LIMITS.cameraXZ) };
    return { cameraOffset, roll: reducedMotion ? 0 : clamp(roll, -FEEDBACK_LIMITS.roll, FEEDBACK_LIMITS.roll),
      zoomKick: reducedMotion ? 0 : clamp(zoomKick, 0, FEEDBACK_LIMITS.zoomKick),
      weaponRecoil: clamp(weaponRecoil, 0, FEEDBACK_LIMITS.weaponRecoil) * restrained,
      recoilOffset: { x: recoilX * recoilScale * restrained, y: 0, z: recoilZ * recoilScale * restrained },
      aimDirection: { ...aimDirection }, playerFlash: clamp(playerFlash, 0, 1) * restrained,
      hitFlash: clamp(hitFlash, 0, 1) * restrained,
      flash: clamp(Math.max(playerFlash, hitFlash), 0, 1) * restrained,
      activePulses: pulses.length };
  }

  function debug() {
    return { generation, sequence, reducedMotion, stopped, activePulses: pulses.length,
      fireReceipts: fireReceipts.size, hitReceipts: hitReceipts.size,
      oldestAge: Math.max(0, ...pulses.map(pulse => pulse.age)), limits: { ...FEEDBACK_LIMITS }, ...counters };
  }
  return { consume, update, reset, sample, debug };
}
