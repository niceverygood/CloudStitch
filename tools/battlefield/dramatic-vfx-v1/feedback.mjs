/** Display offsets only, evaluated after stable-base aiming. No camera/sim writes.
 * Latest 10x dramatic direction uses staged compression/release/material settle,
 * rather than amplification of the former continuous noise. Units are visual.
 */
export const FEEDBACK_LIMITS = Object.freeze({ maxPulses: 32, receiptCapacity: 2048,
  cueCapacity: 64, duration: .44, cameraXZ: .65, cameraY: .30, roll: .04,
  zoomKick: .035, weaponRecoil: .60 });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const validGeneration = v => Number.isSafeInteger(v) && v >= 0;
const vector = v => ({ x: Number.isFinite(v?.x) ? v.x : 0,
  y: Number.isFinite(v?.y) ? v.y : 0, z: Number.isFinite(v?.z) ? v.z : 0 });
const directionOf = v => { const { x, z } = vector(v), n = Math.hypot(x, z);
  return n > 1e-8 ? { x: x/n, y: 0, z: z/n } : { x: 0, y: 0, z: 1 }; };
const freshCounters = () => ({ fires: 0, enemyFires: 0, hits: 0, playerHits: 0,
  duplicateSequences: 0, duplicateShots: 0, staleGenerations: 0, invalidEvents: 0,
  droppedPulses: 0, droppedCues: 0, peakPulses: 0, clears: 0 });
// seconds, signed displacement, recoil, energy, lift, phase; absolute age makes
// coarse/fine updates identical. The second reversal is deliberately distinct.
const CURVES = {
  cannon: [[0,-.24,.10,.20,-.22,'compression'],[.018,-.32,.19,.27,-.28,'compression'],
    [.045,1,1,1,.9,'release'],[.085,.70,.82,.78,.6,'release'],
    [.15,-.30,.32,.40,-.34,'secondary-settle'],[.24,.12,.12,.20,.12,'secondary-settle'],[.44,0,0,0,0,'tail']],
  mg: [[0,.85,.85,1,.55,'snap'],[.012,1,1,.9,.65,'snap'],[.055,-.20,.25,.4,-.18,'rebound'],
    [.11,.06,.08,.15,.04,'tail'],[.23,0,0,0,0,'tail']],
  harpoon: [[0,-.22,.15,.3,-.18,'latch'],[.018,1,1,1,.7,'snap'],[.065,.55,.6,.6,.35,'snap'],
    [.12,-.27,.18,.28,-.24,'rebound'],[.28,0,0,0,0,'tail']],
  impact: [[0,1,0,1,1,'contact'],[.028,.8,0,.8,.65,'contact'],[.09,-.24,0,.40,-.30,'rebound'],
    [.18,.09,0,.20,.08,'tail'],[.42,0,0,0,0,'tail']],
};
function curveAt(profile, age) {
  const points = CURVES[profile], right = points.findIndex(p => p[0] > age);
  if (right < 0) return { displacement: 0, recoil: 0, energy: 0, lift: 0, phase: 'idle' };
  const a = points[Math.max(0, right-1)], b = points[right];
  const t = b[0] === a[0] ? 0 : clamp((age-a[0])/(b[0]-a[0]),0,1), mix = i => a[i]+(b[i]-a[i])*t;
  return { displacement: mix(1), recoil: mix(2), energy: mix(3), lift: mix(4), phase: a[5] };
}
export function createCombatFeedback({ reducedMotion = false } = {}) {
  if (typeof reducedMotion !== 'boolean') throw new TypeError('reducedMotion must be boolean');
  let generation = null, sequence = 0, pulses = [], cues = [], stopped = false;
  let aimDirection = { x: 0, y: 0, z: 1 }, counters = freshCounters();
  const fireReceipts = new Set(), hitReceipts = new Set();
  function reset(nextGeneration = null) {
    if (nextGeneration !== null && !validGeneration(nextGeneration)) throw new TypeError('Invalid feedback generation');
    generation = nextGeneration; sequence = 0; pulses = []; cues = []; stopped = false;
    aimDirection = { x: 0, y: 0, z: 1 }; counters = freshCounters(); fireReceipts.clear(); hitReceipts.clear();
    return sample();
  }
  function remember(receipts, key) {
    if (receipts.has(key)) { counters.duplicateShots++; return false; }
    receipts.add(key);
    if (receipts.size > FEEDBACK_LIMITS.receiptCapacity) receipts.delete(receipts.values().next().value);
    return true;
  }
  function addPulse(p) {
    if (pulses.length === FEEDBACK_LIMITS.maxPulses) { pulses.shift(); counters.droppedPulses++; }
    pulses.push({ ...p, age: 0 }); counters.peakPulses = Math.max(counters.peakPulses,pulses.length);
  }
  function enqueueCue(e, type) {
    const cue = { id: `${generation}:${e.seq}:${type}`, generation, seq: e.seq,
      eventTime: Number.isFinite(e.time) ? e.time : Number.isFinite(e.eventTime) ? e.eventTime : 0,
      type, weaponId: e.weaponId ?? null, position: vector(e.position ?? e) };
    if (e.normal) cue.normal = vector(e.normal);
    if (cues.length === FEEDBACK_LIMITS.cueCapacity) { cues.shift(); counters.droppedCues++; }
    cues.push(cue);
  }
  function consume(events = [], currentGeneration = undefined) {
    if (!Array.isArray(events)) throw new TypeError('Feedback events must be an array');
    if (currentGeneration !== undefined) {
      if (!validGeneration(currentGeneration)) throw new TypeError('Invalid feedback generation');
      if (generation !== null && currentGeneration < generation) { counters.staleGenerations += events.length; return sample(); }
      if (generation !== currentGeneration) reset(currentGeneration);
    }
    if (generation === null) generation = events.find(e => validGeneration(e?.generation))?.generation ?? 0;
    const pending = [];
    for (const e of events) {
      if (!e || typeof e !== 'object' || !Number.isSafeInteger(e.seq) || e.seq <= 0 ||
        (e.generation !== undefined && !validGeneration(e.generation))) { counters.invalidEvents++; continue; }
      if (e.generation !== undefined && e.generation !== generation) { counters.staleGenerations++; continue; }
      pending.push(e);
    }
    pending.sort((a,b) => a.seq-b.seq);
    for (const e of pending) {
      if (e.seq <= sequence) { counters.duplicateSequences++; continue; }
      sequence = e.seq;
      if (['combat-cleared','clear','defeat','victory'].includes(e.type)) {
        pulses = []; cues = []; counters.clears++;
        if (e.type === 'defeat' || e.type === 'victory') stopped = true;
        continue;
      }
      if (stopped) continue;
      const direction = directionOf(e.direction), sign = e.seq % 2 ? 1 : -1;
      if (e.type === 'player-fire' || e.type === 'enemy-fire') {
        const key = e.projectileId == null ? `seq:${e.seq}` : String(e.projectileId);
        if (!remember(fireReceipts, key)) continue;
        enqueueCue(e,'weapon-fire');
        if (e.type === 'enemy-fire') { counters.enemyFires++; continue; }
        aimDirection = { ...direction }; counters.fires++;
        const cannon = e.weaponId === '02-deck-cannon', harpoon = e.weaponId === '04-harpoon';
        addPulse({ kind: 'fire', profile: cannon ? 'cannon' : harpoon ? 'harpoon' : 'mg', direction, sign,
          duration: cannon ? .44 : harpoon ? .28 : .23, recoil: cannon ? .58 : harpoon ? .37 : .20,
          camera: cannon ? .50 : harpoon ? .22 : .09, zoom: cannon ? .032 : harpoon ? .012 : .004, flash: 0 });
      } else if (e.type === 'hit') {
        const key = e.projectileId == null ? `seq:${e.seq}` : JSON.stringify([String(e.projectileId),e.target,e.moduleId ?? e.enemyId ?? null]);
        if (!remember(hitReceipts,key)) continue;
        enqueueCue(e,'weapon-hit');
        const player = e.target === 'player', obstacle = e.target === 'obstacle';
        counters.hits++; if (player) counters.playerHits++;
        addPulse({ kind: player ? 'player-hit' : 'hit', profile: 'impact', direction, sign, duration: .42, recoil: 0,
          camera: player ? .60 : obstacle ? .16 : .40, zoom: player ? .035 : obstacle ? .008 : .025,
          flash: player ? .85 : obstacle ? .20 : .65 });
      }
    }
    return sample();
  }
  function update(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new TypeError('Feedback dt must be finite and nonnegative');
    if (dt > 0) { for (const p of pulses) p.age += dt; pulses = pulses.filter(p => p.age+1e-12 < p.duration); }
    return sample();
  }
  function sample() {
    let x=0,y=0,z=0,roll=0,zoomKick=0,weaponRecoil=0,recoilX=0,recoilZ=0,playerFlash=0,hitFlash=0;
    for (const p of pulses) {
      const c=curveAt(p.profile,p.age), kick=p.recoil*c.recoil;
      weaponRecoil+=kick; recoilX-=p.direction.x*kick; recoilZ-=p.direction.z*kick;
      x+=(-p.direction.x*.78+p.direction.z*p.sign*.22)*p.camera*c.displacement;
      z+=(-p.direction.z*.78-p.direction.x*p.sign*.22)*p.camera*c.displacement;
      y+=p.camera*.42*c.lift; roll+=p.sign*p.camera*.11*c.displacement; zoomKick+=p.zoom*c.energy;
      if (p.kind === 'player-hit') playerFlash=Math.max(playerFlash,p.flash*c.energy);
      else if (p.kind === 'hit') hitFlash=Math.max(hitFlash,p.flash*c.energy);
    }
    const length=Math.hypot(recoilX,recoilZ), scale=length > .60 ? .60/length : 1, restrained=reducedMotion ? .35 : 1;
    return { cameraOffset: reducedMotion ? {x:0,y:0,z:0} : {x:clamp(x,-.65,.65),y:clamp(y,-.30,.30),z:clamp(z,-.65,.65)},
      roll: reducedMotion ? 0 : clamp(roll,-.04,.04), zoomKick: reducedMotion ? 0 : clamp(zoomKick,0,.035),
      weaponRecoil:clamp(weaponRecoil,0,.60)*restrained,
      recoilOffset:{x:recoilX*scale*restrained,y:0,z:recoilZ*scale*restrained}, aimDirection:{...aimDirection},
      playerFlash:clamp(playerFlash,0,1)*restrained,hitFlash:clamp(hitFlash,0,1)*restrained,
      flash:clamp(Math.max(playerFlash,hitFlash),0,1)*restrained,activePulses:pulses.length,
      phase:pulses.length ? curveAt(pulses.at(-1).profile,pulses.at(-1).age).phase : 'idle' };
  }
  function debug() { return {generation,sequence,reducedMotion,stopped,activePulses:pulses.length,
    queuedCues:cues.length,fireReceipts:fireReceipts.size,hitReceipts:hitReceipts.size,
    oldestAge:Math.max(0,...pulses.map(p => p.age)), limits:{...FEEDBACK_LIMITS},
    strengthUnits:'display offsets only; never damage/range/fire rate',...counters}; }
  function drainCues() { const drained=cues; cues=[]; return drained; }
  return {consume,update,reset,sample,debug,drainCues};
}
