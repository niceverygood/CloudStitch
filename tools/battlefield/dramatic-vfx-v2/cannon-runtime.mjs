import { createDramaticCannonStage, CANNON_STAGE_DURATIONS } from './cannon-stage.mjs';
const CANNON = '02-deck-cannon';
export const DRAMATIC_CANNON_LIMITS = Object.freeze({ active: 12, pooled: 12, receipts: 2048 });
const validGeneration = n => Number.isSafeInteger(n) && n >= 0;

/** Caller injects the existing carrier authority consumer. No new projectile or
 * collision is created here; only cannon fire/hit presentation is replaced. */
export function createDramaticCannonVfx(THREE, scene, { projectileVfx, atlas = null,
  atlasUrl = '../combat-vfx-v2/machine-gun-soft-runtime-v1/textures/soft-vfx-atlas.png', camera = null, reducedMotion = false } = {}) {
  if (!projectileVfx || ['load', 'consume', 'update', 'reset', 'dispose', 'debug'].some(k => typeof projectileVfx[k] !== 'function')) throw new TypeError('Cannon requires an injected projectileVfx API.');
  const active = new Set(), pool = [], fired = new Set(), hit = new Set();
  let generation = null, sequence = 0, state = 'unloaded', pending = null, ownsAtlas = false, stopped = false;
  const counters = { created: 0, reused: 0, muzzleEffects: 0, hitEffects: 0, dropped: 0, staleGenerationEvents: 0, cleared: 0 };
  const alive = () => { if (state !== 'ready') throw new Error('Dramatic cannon is ' + state); };
  const receipt = (set, id) => { set.add(id); while (set.size > DRAMATIC_CANNON_LIMITS.receipts) set.delete(set.values().next().value); };
  function release(value) { value.stage.reset(); value.stage.root.removeFromParent(); value.frame = null; value.id = null; value.age = 0; if (pool.length < DRAMATIC_CANNON_LIMITS.pooled) pool.push(value); else value.stage.dispose(); }
  function clear() { for (const value of active) release(value); active.clear(); }
  function play(kind, event) {
    const frame = { x: event.x, y: Number.isFinite(event.y) ? event.y : 1.3, z: event.z,
      direction: event.direction ? { ...event.direction } : null, normal: event.normal ? { ...event.normal } : null };
    const basis = kind === 'hit' ? frame.normal : frame.direction;
    if (![frame.x, frame.y, frame.z].every(Number.isFinite) || !basis || ![basis.x, basis.y, basis.z].every(Number.isFinite) || Math.hypot(basis.x, basis.y, basis.z) < 1e-8) throw new TypeError('Cannon requires finite world XYZ and actual nonzero direction/normal.');
    if (active.size >= DRAMATIC_CANNON_LIMITS.active) { counters.dropped++; return; }
    let value = pool.pop(); if (value) counters.reused++; else { value = { stage: createDramaticCannonStage(THREE, { atlas, camera, reducedMotion }) }; counters.created++; }
    value.kind = kind; value.age = 0; value.id = event.projectileId;
    value.frame = frame;
    value.stage.evaluate(kind, 0, { ...value.frame, camera }); scene.add(value.stage.root); active.add(value);
    value.stage.root.userData.projectileId = value.id; counters[kind === 'hit' ? 'hitEffects' : 'muzzleEffects']++;
  }
  async function load() {
    if (state === 'disposed') throw new Error('Disposed dramatic cannon.');
    if (state === 'ready') return api; if (pending) return pending; state = 'loading';
    pending = (async () => {
      try {
        const results = await Promise.allSettled([projectileVfx.load(), atlas ? Promise.resolve(atlas) : new THREE.TextureLoader().loadAsync(atlasUrl).then(value => { atlas = value; ownsAtlas = true; atlas.colorSpace = THREE.SRGBColorSpace; })]);
        const failed = results.find(r => r.status === 'rejected'); if (failed) throw failed.reason;
        if (state === 'disposed') throw new Error('Disposed during cannon load.');
        if (!atlas?.isTexture) throw new TypeError('Cannon atlas is not a texture.'); state = 'ready'; return api;
      } catch (error) { if (ownsAtlas && atlas) { atlas.dispose(); atlas = null; ownsAtlas = false; } if (state !== 'disposed') state = 'failed'; throw error; }
      finally { pending = null; }
    })(); return pending;
  }
  function reset(nextGeneration = null) {
    if (nextGeneration !== null && !validGeneration(nextGeneration)) throw new TypeError('Invalid cannon generation.');
    clear(); fired.clear(); hit.clear(); generation = nextGeneration; sequence = 0; stopped = false; projectileVfx.reset(nextGeneration);
    for (const key of Object.keys(counters)) counters[key] = 0;
  }
  function consume(events, actualProjectiles = [], currentGeneration = undefined) {
    alive(); if (!Array.isArray(events) || !Array.isArray(actualProjectiles)) throw new TypeError('Cannon events/projectiles must be arrays.');
    if (currentGeneration !== undefined) {
      if (!validGeneration(currentGeneration)) throw new TypeError('Invalid cannon generation.');
      if (generation !== null && currentGeneration < generation) { counters.staleGenerationEvents += events.length; return; }
      if (generation !== currentGeneration) reset(currentGeneration);
    }
    const accepted = events.filter(event => {
      if (event.generation === undefined) return true;
      if (!validGeneration(event.generation)) throw new TypeError('Invalid cannon event generation.');
      if (generation === null) generation = event.generation;
      if (event.generation === generation) return true; counters.staleGenerationEvents++; return false;
    }).filter(event => Number.isSafeInteger(event.seq) && event.seq > sequence).slice().sort((a, b) => a.seq - b.seq);
    const forwarded = [];
    for (const event of accepted) {
      if (event.seq <= sequence) continue; sequence = event.seq;
      if (['combat-cleared', 'defeat', 'harbor-return'].includes(event.type)) { clear(); stopped = true; counters.cleared++; forwarded.push(event); continue; }
      const fire = ['player-fire', 'enemy-fire'].includes(event.type);
      if (event.weaponId !== CANNON || (!fire && event.type !== 'hit')) { forwarded.push(event); continue; }
      if (event.projectileId == null) throw new TypeError('Cannon event requires actual projectileId.');
      const id = event.projectileId;
      if (fire) { if (fired.has(id) || hit.has(id)) continue; receipt(fired, id); stopped = false; play('muzzle', event); }
      else { if (hit.has(id) || stopped) continue; receipt(hit, id); fired.delete(id); play('hit', event); }
    }
    // Fire/hit are deliberately absent; every actual carrier position and every
    // projectile-ended event is still consumed by the injected original owner.
    projectileVfx.consume(forwarded, actualProjectiles, generation === null ? undefined : generation);
  }
  function update(dt, actualProjectiles = [], cameraOverride = undefined) {
    alive(); if (!Number.isFinite(dt) || dt < 0) throw new TypeError('Cannon dt must be finite/nonnegative.');
    if (cameraOverride !== undefined) camera = cameraOverride;
    projectileVfx.update(dt, actualProjectiles);
    for (const value of active) { value.age += dt; if (value.age >= CANNON_STAGE_DURATIONS[value.kind]) { active.delete(value); release(value); } else value.stage.evaluate(value.kind, value.age, { ...value.frame, camera }); }
  }
  function setCamera(value) { camera = value; if (projectileVfx.setCamera) projectileVfx.setCamera(value); }
  function dispose() {
    if (state === 'disposed') return;
    try { clear(); for (const value of pool) value.stage.dispose(); pool.length = 0; projectileVfx.dispose(); }
    finally {
      try { if (ownsAtlas && atlas && !pending) { atlas.dispose(); atlas = null; ownsAtlas = false; } }
      finally { state = 'disposed'; }
    }
  }
  const api = { load, consume, update, reset, dispose, setCamera, debug() {
    const child = projectileVfx.debug(), own = [...active].map(v => ({ kind: v.kind, projectileId: v.id, age: v.age, ...v.stage.debug() }));
    return { state, loaded: state === 'ready', generation, sequence, supportedWeapons: [...new Set([CANNON, ...(child.supportedWeapons || [])])],
      activeOneShots: active.size + (child.activeOneShots || 0), activeProjectiles: child.activeProjectiles || 0,
      activeVisualLayers: own.reduce((sum, value) => sum + value.visibleMeshes, 0) + (child.activeVisualLayers || 0),
      projectileIds: child.projectileIds || [], muzzleEffects: counters.muzzleEffects + (child.muzzleEffects || 0), hitEffects: counters.hitEffects + (child.hitEffects || 0),
      dropped: counters.dropped + (child.dropped || 0), presentation: 'dramatic-filled-painted-cannon-v2', movementAuthority: 'battlefield-projectile-state', projectileAnimationApplied: false,
      active: active.size, pooled: pool.length, limits: DRAMATIC_CANNON_LIMITS, counters: { ...counters },
      own, child };
  } }; return api;
}
