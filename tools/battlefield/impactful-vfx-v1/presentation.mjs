import { createEventCursor } from '../vfx-contract.mjs';

const MG = '01-machine-gun';
const validGeneration = value => Number.isSafeInteger(value) && value >= 0;
const numeric = value => Number.isFinite(value) ? value : 0;

/**
 * One display path per authoritative shot. Inject renderers rather than owning
 * THREE, a camera transform, collision, damage, projectile travel or any clock.
 * Call update with simulation-time deltas, after stable-camera aim calculation.
 */
export function createCombatPresentation({ meshVfx, softMachineGunVfx = null, feedback, camera = null } = {}) {
  const requireApi = (value, methods, name) => {
    if (!value || methods.some(method => typeof value[method] !== 'function')) throw new TypeError(`Invalid ${name} API`);
  };
  const visualMethods = ['load', 'consume', 'update', 'reset', 'dispose', 'debug'];
  requireApi(meshVfx, visualMethods, 'meshVfx');
  if (softMachineGunVfx !== null) requireApi(softMachineGunVfx, [...visualMethods, 'setCamera'], 'softMachineGunVfx');
  requireApi(feedback, ['consume', 'update', 'reset', 'sample', 'debug'], 'feedback');
  const visuals = softMachineGunVfx ? [meshVfx, softMachineGunVfx] : [meshVfx];
  const cursor = createEventCursor(), shotWeapons = new Map();
  let state = 'unloaded', generation = null, stopped = false, requireIssuedShots = false;
  let currentCamera = camera, loadPromise = null, lastError = null;
  let counters = { consumedEvents: 0, staleGenerationEvents: 0, clears: 0, updates: 0 };
  const assertAlive = () => { if (state === 'disposed') throw new Error('Combat presentation is disposed'); };
  const assertReady = () => { if (state !== 'ready') throw new Error('Combat presentation load() must complete: ' + state); };

  function setCamera(nextCamera) {
    assertAlive(); currentCamera = nextCamera;
    if (softMachineGunVfx) softMachineGunVfx.setCamera(nextCamera);
  }
  if (softMachineGunVfx) softMachineGunVfx.setCamera(camera);

  function resetChildren(resetFeedback = true) {
    for (const child of visuals) child.reset(generation);
    if (resetFeedback) feedback.reset(generation);
    shotWeapons.clear();
  }

  function reset(nextGeneration = null) {
    assertAlive();
    if (nextGeneration !== null && !validGeneration(nextGeneration)) throw new TypeError('Invalid presentation generation');
    generation = nextGeneration; stopped = false; requireIssuedShots = false;
    cursor.reset(); resetChildren();
    counters = { consumedEvents: 0, staleGenerationEvents: 0, clears: 0, updates: 0 };
    return api;
  }

  async function load() {
    assertAlive();
    if (state === 'ready') return api;
    if (state === 'failed') throw lastError;
    if (loadPromise) return loadPromise;
    state = 'loading';
    loadPromise = (async () => {
      const results = await Promise.allSettled(visuals.map(child => Promise.resolve().then(() => child.load())));
      const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
      if (state === 'disposed' || failures.length) {
        if (state !== 'disposed') {
          // allSettled ensures a late successful loader is also disposed.
          const cleanups = await Promise.allSettled(visuals.map(child => Promise.resolve().then(() => child.dispose())));
          for (const result of cleanups) if (result.status === 'rejected') failures.push(result.reason);
          feedback.reset(generation); state = 'failed';
        } else {
          // Loading may finish after an explicit dispose; clean late resources.
          await Promise.allSettled(visuals.map(child => Promise.resolve().then(() => child.dispose())));
        }
        lastError = new AggregateError(failures, 'Combat presentation could not load');
        throw lastError;
      }
      state = 'ready'; return api;
    })();
    return loadPromise;
  }

  const weaponOf = (value, id = value?.projectileId ?? value?.id) => {
    if (typeof value?.weaponId === 'string' && value.weaponId) return value.weaponId;
    if (shotWeapons.has(id)) return shotWeapons.get(id);
    if (value?.type === 'player-fire' || value?.owner === 'player') return MG;
    if (value?.type === 'enemy-fire' || value?.owner === 'enemy') return '02-deck-cannon';
    return null;
  };
  const withWeapon = (value, weaponId) => weaponId && value.weaponId !== weaponId ? { ...value, weaponId } : value;

  function routeProjectiles(projectiles, ended = new Set()) {
    const mesh = [], soft = [], activeIds = new Set();
    if (!stopped) for (const projectile of projectiles) {
      if (!projectile || typeof projectile !== 'object') throw new TypeError('Invalid presentation projectile');
      const id = projectile.id;
      if (ended.has(id) || (requireIssuedShots && !shotWeapons.has(id))) continue;
      const weaponId = weaponOf(projectile, id), normalized = withWeapon(projectile, weaponId);
      activeIds.add(id);
      if (softMachineGunVfx && weaponId === MG) soft.push(normalized); else mesh.push(normalized);
    }
    for (const id of shotWeapons.keys()) if (!activeIds.has(id)) shotWeapons.delete(id);
    return { mesh, soft };
  }

  function consume(events = [], actualProjectiles = [], currentGeneration = undefined) {
    assertReady();
    if (!Array.isArray(events) || !Array.isArray(actualProjectiles)) throw new TypeError('Presentation events/projectiles must be arrays');
    if (currentGeneration !== undefined) {
      if (!validGeneration(currentGeneration)) throw new TypeError('Invalid presentation generation');
      if (generation !== null && currentGeneration < generation) { counters.staleGenerationEvents += events.length; return; }
      if (generation !== currentGeneration) reset(currentGeneration);
    }
    if (generation === null) reset(events.find(event => validGeneration(event?.generation))?.generation ?? 0);
    // Filter generations BEFORE touching the global seq barrier.
    const currentEvents = events.filter(event => {
      if (!event || typeof event !== 'object') throw new TypeError('Invalid presentation event');
      if (event.generation !== undefined && !validGeneration(event.generation)) throw new TypeError('Invalid event generation');
      if (event.generation === undefined || event.generation === generation) return true;
      counters.staleGenerationEvents += 1; return false;
    });
    const accepted = cursor.take(currentEvents), meshEvents = [], softEvents = [], normalizedEvents = [], ended = new Set();
    counters.consumedEvents += accepted.length;
    for (const event of accepted) {
      if (['combat-cleared', 'clear', 'defeat', 'victory'].includes(event.type)) {
        resetChildren(!stopped); meshEvents.length = 0; softEvents.length = 0; ended.clear();
        requireIssuedShots = true; counters.clears += 1;
        if (event.type === 'defeat' || event.type === 'victory') stopped = true;
        normalizedEvents.push(event); continue;
      }
      if (stopped) { normalizedEvents.push(event); continue; }
      const weaponId = weaponOf(event), normalized = withWeapon(event, weaponId);
      normalizedEvents.push(normalized);
      if (event.type === 'player-fire' || event.type === 'enemy-fire') {
        if (event.projectileId != null && weaponId) shotWeapons.set(event.projectileId, weaponId);
      }
      if (event.type === 'projectile-ended') {
        // Terminal receipts are harmless to both children and never render a shot.
        meshEvents.push(normalized); if (softMachineGunVfx) softEvents.push(normalized);
        if (event.projectileId != null) { ended.add(event.projectileId); shotWeapons.delete(event.projectileId); }
      } else if (['player-fire', 'enemy-fire', 'hit'].includes(event.type)) {
        if (softMachineGunVfx && weaponId === MG) softEvents.push(normalized); else meshEvents.push(normalized);
        if (event.type === 'hit' && event.projectileId != null) ended.add(event.projectileId);
      } else {
        meshEvents.push(normalized); if (softMachineGunVfx) softEvents.push(normalized);
      }
    }
    const routed = routeProjectiles(actualProjectiles, ended);
    meshVfx.consume(meshEvents, routed.mesh, generation);
    if (softMachineGunVfx) softMachineGunVfx.consume(softEvents, routed.soft, generation);
    // Exactly one feedback delivery, retaining order and terminal events.
    feedback.consume(normalizedEvents, generation);
  }

  function update(dt, actualProjectiles = [], cameraOverride = undefined) {
    assertReady();
    if (!Number.isFinite(dt) || dt < 0) throw new TypeError('Presentation dt must be finite and nonnegative');
    if (!Array.isArray(actualProjectiles)) throw new TypeError('Presentation projectiles must be an array');
    if (cameraOverride !== undefined) setCamera(cameraOverride);
    const routed = routeProjectiles(actualProjectiles);
    meshVfx.update(dt, routed.mesh, currentCamera);
    if (softMachineGunVfx) softMachineGunVfx.update(dt, routed.soft, currentCamera);
    feedback.update(dt); counters.updates += 1;
    return feedback.sample();
  }

  function dispose() {
    if (state === 'disposed') return;
    state = 'disposed'; shotWeapons.clear(); cursor.reset(); stopped = true;
    const errors = [];
    for (const child of visuals) { try { child.dispose(); } catch (error) { errors.push(error); } }
    try { feedback.reset(generation); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(errors, 'Combat presentation cleanup failed');
  }

  function debug() {
    const mesh = meshVfx.debug(), soft = softMachineGunVfx?.debug() ?? null;
    const children = soft ? [mesh, soft] : [mesh];
    const sum = key => children.reduce((total, child) => total + numeric(child[key]), 0);
    return { state, loaded: state === 'ready', generation, eventCursor: cursor.sequence, stopped,
      lastError: lastError?.message ?? null, routedShotCount: shotWeapons.size, ...counters,
      presentation: soft ? 'impactful-soft-machine-gun' : 'impactful-v1',
      machineGunRoute: soft ? 'soft' : 'mesh', activeOneShots: sum('activeOneShots'),
      activeProjectiles: sum('activeProjectiles'), activeVisualLayers: sum('activeVisualLayers'),
      muzzleEffects: sum('muzzleEffects'), hitEffects: sum('hitEffects'),
      // The voyage renderer uses this union to hide its primitive fallback
      // bullets; omitting it would render a second projectile over soft VFX.
      supportedWeapons: [...new Set(children.flatMap(child => child.supportedWeapons ?? []))],
      projectileIds: [...new Set(children.flatMap(child => child.projectileIds ?? []))],
      movementAuthority: 'battlefield-projectile-state', projectileAnimationApplied: false,
      mesh, softMachineGun: soft, feedback: feedback.debug() };
  }
  const api = { load, consume, update, reset, dispose, debug, setCamera, sampleFeedback: () => feedback.sample() };
  return api;
}
