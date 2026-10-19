import { createPaintedMG } from './painted-effects.js';

const WEAPON = '01-machine-gun';
const DEFAULT_HEIGHT = 1.3;
const LIMITS = Object.freeze({ muzzle: 32, hit: 32, projectile: 64, pooled: 24, receipts: 2048 });
const TEXTURES = '../combat-vfx-v2/machine-gun-soft-runtime-v1/textures/';

/** Display only. Simulation owns every shot, position, collision and damage.
 * Inject caller-owned textures, or await load() to load the two local atlases.
 * Parent must be an untransformed world scene. No audio or camera impulse here.
 */
export function createSoftMachineGunVfx(THREE, scene, {
  atlas = null, metalTexture = null, atlasUrl = TEXTURES + 'soft-vfx-atlas.png',
  materialUrl = TEXTURES + 'soft-material-atlas.png', camera = null, effectScale = 1,
} = {}) {
  if (!scene?.add || !THREE?.Group) throw new TypeError('Soft MG requires THREE and a world scene.');
  if (!Number.isFinite(effectScale) || effectScale < .5 || effectScale > 1.5) throw new RangeError('Soft MG effectScale must be .5–1.5.');
  const shots = new Map(), fires = new Map(), oneShots = new Set();
  const pools = { muzzle: [], projectile: [], hit: [] }, ownedTextures = new Set();
  const fired = new Set(), ended = new Set();
  const counters = { created: 0, reused: 0, returned: 0, muzzleEffects: 0, hitEffects: 0,
    staleGenerationEvents: 0, dropped: 0, culled: 0 };
  let state = 'unloaded', loadPromise = null, lastError = null, generation = null, sequence = 0, cleared = false;
  const assertReady = () => { if (state !== 'ready') throw new Error('Soft MG load() must complete before use: ' + state); };
  const validGeneration = value => Number.isSafeInteger(value) && value >= 0;
  const point = event => {
    if (!Number.isFinite(event?.x) || !Number.isFinite(event?.z)) throw new TypeError('Soft MG requires finite simulation x/z.');
    return { x: event.x, y: Number.isFinite(event.y) ? event.y : DEFAULT_HEIGHT, z: event.z };
  };
  const vector = (value, fallback = { x: 0, y: 0, z: 1 }) => {
    const result = value && [value.x, value.y, value.z].every(Number.isFinite) ? { x: value.x, y: value.y, z: value.z } : { ...fallback };
    const length = Math.hypot(result.x, result.y, result.z);
    return length > 1e-8 ? { x: result.x / length, y: result.y / length, z: result.z / length } : { ...fallback };
  };
  const end = id => {
    fired.delete(id); ended.add(id);
    while (ended.size > LIMITS.receipts) ended.delete(ended.values().next().value);
  };
  const activeCount = kind => kind === 'projectile' ? shots.size : [...oneShots].filter(value => value.kind === kind).length;
  function acquire(kind, id) {
    if (activeCount(kind) >= LIMITS[kind]) { counters.dropped++; return null; }
    const instance = pools[kind].pop() || null;
    const value = instance || { visual: createPaintedMG(THREE, { atlas, metalTexture }), kind };
    if (instance) counters.reused++; else counters.created++;
    value.elapsed = 0; value.frame = null; value.projectileId = id;
    const root = value.visual.root;
    root.name = `soft-mg-${kind}-${id}`;
    root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.set(1, 1, 1); root.visible = false;
    Object.assign(root.userData, { kind, projectileId: id, elapsed: 0, hostId: null });
    scene.add(root); return value;
  }
  function release(instance) {
    const { visual, kind } = instance;
    visual.update({ mode: 'muzzle', time: -1 });
    visual.root.removeFromParent(); visual.root.position.set(0, 0, 0);
    visual.root.quaternion.identity(); visual.root.scale.set(1, 1, 1);
    visual.root.traverse(node => { if (node.material?.transparent) node.material.opacity = 0; });
    instance.elapsed = 0; instance.frame = null; instance.projectileId = null;
    Object.assign(visual.root.userData, { elapsed: 0, projectileId: null, hostId: null });
    if (pools[kind].length < LIMITS.pooled) pools[kind].push(instance);
    else { visual.dispose(); counters.culled++; }
    counters.returned++;
  }
  function removeShot(id) {
    const value = shots.get(id);
    if (value) { shots.delete(id); release(value); }
    fires.delete(id);
  }
  function poseOneShot(value) {
    value.visual.root.userData.elapsed = value.elapsed;
    value.visual.update({ mode: value.kind, time: value.elapsed, camera, amount: effectScale, ...value.frame });
  }
  function play(kind, event) {
    const position = point(event), direction = vector(event.direction);
    let normal = null;
    if (kind === 'hit') {
      if (!event.normal || ![event.normal.x, event.normal.y, event.normal.z].every(Number.isFinite) || Math.hypot(event.normal.x, event.normal.y, event.normal.z) < 1e-8) {
        throw new TypeError('Soft MG hit requires the actual nonzero contact normal.');
      }
      normal = vector(event.normal);
    }
    const value = acquire(kind, event.projectileId);
    if (!value) return false;
    value.frame = { muzzle: position, hit: position, flightDirection: direction, impactNormal: normal };
    value.visual.root.userData.hostId = event.hostId || null;
    oneShots.add(value); poseOneShot(value); return true;
  }
  function syncProjectiles(projectiles) {
    if (!Array.isArray(projectiles)) throw new TypeError('Soft MG projectiles must be an array.');
    const active = new Set();
    if (!cleared) for (const projectile of projectiles) {
      if (projectile?.id == null || ended.has(projectile.id)) continue;
      const fire = fires.get(projectile.id);
      if ((projectile.weaponId || fire?.weaponId) !== WEAPON) continue;
      const position = point({ ...projectile, y: Number.isFinite(projectile.y) ? projectile.y : fire?.y });
      const velocity = { x: Number.isFinite(projectile.vx) ? projectile.vx : 0, y: Number.isFinite(projectile.vy) ? projectile.vy : 0, z: Number.isFinite(projectile.vz) ? projectile.vz : 0 };
      const direction = Math.hypot(velocity.x, velocity.y, velocity.z) > 1e-8 ? vector(velocity) : vector(fire?.direction);
      active.add(projectile.id);
      let value = shots.get(projectile.id);
      if (!value) {
        value = acquire('projectile', projectile.id);
        if (!value) continue;
        shots.set(projectile.id, value);
      }
      value.visual.updateProjectile({ position, direction, camera, amount: effectScale });
    }
    for (const id of shots.keys()) if (!active.has(id)) { end(id); removeShot(id); }
    for (const id of fires.keys()) if (!active.has(id)) { end(id); fires.delete(id); }
  }
  function clearActive() {
    for (const value of oneShots) { end(value.projectileId); release(value); }
    for (const [id, value] of shots) { end(id); release(value); }
    for (const id of fires.keys()) end(id);
    oneShots.clear(); shots.clear(); fires.clear();
  }
  function disposeOwnedTextures() {
    for (const texture of ownedTextures) {
      if (atlas === texture) atlas = null;
      if (metalTexture === texture) metalTexture = null;
      texture.dispose();
    }
    ownedTextures.clear();
  }
  async function load() {
    if (state === 'disposed') throw new Error('Disposed soft MG cannot load.');
    if (state === 'ready') return api;
    if (loadPromise) return loadPromise;
    state = 'loading'; lastError = null;
    loadPromise = (async () => {
      try {
        const loader = new THREE.TextureLoader();
        const requests = [];
        if (!atlas) requests.push(loader.loadAsync(atlasUrl).then(texture => { atlas = texture; ownedTextures.add(texture); }));
        if (!metalTexture && materialUrl) requests.push(loader.loadAsync(materialUrl).then(texture => { metalTexture = texture; ownedTextures.add(texture); }));
        const results = await Promise.allSettled(requests);
        const errors = results.filter(result => result.status === 'rejected');
        if (errors.length) throw new Error(errors.map(result => result.reason?.message || String(result.reason)).join('; '));
        if (state === 'disposed') throw new Error('Soft MG disposed during load.');
        if (!atlas?.isTexture || (metalTexture && !metalTexture.isTexture)) throw new TypeError('Soft MG requires atlas textures.');
        for (const texture of ownedTextures) texture.colorSpace = THREE.SRGBColorSpace;
        state = 'ready'; return api;
      } catch (error) {
        disposeOwnedTextures();
        if (state !== 'disposed') state = 'failed';
        lastError = 'Cloudstitch soft MG: ' + (error?.message || error); throw new Error(lastError, { cause: error });
      } finally { loadPromise = null; }
    })();
    return loadPromise;
  }
  function consume(events, projectiles = [], currentGeneration = undefined) {
    assertReady();
    if (!Array.isArray(events)) throw new TypeError('Soft MG events must be an array.');
    if (currentGeneration !== undefined) {
      if (!validGeneration(currentGeneration)) throw new TypeError('Invalid soft MG generation.');
      if (generation !== null && currentGeneration < generation) { counters.staleGenerationEvents += events.length; return; }
      if (generation !== currentGeneration) reset(currentGeneration);
    }
    const pending = events.filter(event => {
      if (event?.generation === undefined) return true;
      if (!validGeneration(event.generation)) throw new TypeError('Invalid soft MG event generation.');
      if (generation === null) generation = event.generation;
      if (event.generation === generation) return true;
      counters.staleGenerationEvents++; return false;
    }).filter(event => Number.isSafeInteger(event?.seq) && event.seq > sequence).slice().sort((a, b) => a.seq - b.seq);
    for (const event of pending) {
      if (event.seq <= sequence) continue;
      sequence = event.seq;
      if (['combat-cleared', 'defeat', 'harbor-return'].includes(event.type)) { clearActive(); cleared = true; continue; }
      if (event.type === 'projectile-ended') {
        if (event.projectileId != null) { end(event.projectileId); removeShot(event.projectileId); }
        continue;
      }
      if (!['player-fire', 'enemy-fire', 'hit'].includes(event.type) || event.weaponId !== WEAPON) continue;
      if (event.projectileId == null) throw new TypeError('Soft MG event requires projectileId.');
      if (ended.has(event.projectileId)) continue;
      if (event.type === 'hit') {
        if (play('hit', event)) counters.hitEffects++;
        end(event.projectileId); removeShot(event.projectileId);
      } else {
        if (fired.has(event.projectileId)) continue;
        if (play('muzzle', event)) counters.muzzleEffects++;
        cleared = false; fired.add(event.projectileId);
        fires.set(event.projectileId, { weaponId: WEAPON, y: event.y, direction: vector(event.direction) });
      }
    }
    syncProjectiles(projectiles);
  }
  function update(dt, projectiles = [], cameraOverride = undefined) {
    assertReady();
    if (!Number.isFinite(dt) || dt < 0) throw new TypeError('Soft MG dt must be finite and nonnegative.');
    if (cameraOverride !== undefined) camera = cameraOverride;
    syncProjectiles(projectiles);
    for (const value of oneShots) {
      value.elapsed += dt;
      if (value.elapsed >= value.visual.durations[value.kind]) { oneShots.delete(value); release(value); }
      else poseOneShot(value);
    }
  }
  function reset(nextGeneration = null) {
    if (nextGeneration !== null && !validGeneration(nextGeneration)) throw new TypeError('Invalid soft MG reset generation.');
    clearActive(); fired.clear(); ended.clear(); sequence = 0; generation = nextGeneration; cleared = false;
    for (const key of Object.keys(counters)) counters[key] = 0;
  }
  function dispose() {
    if (state === 'disposed') return;
    reset();
    for (const pool of Object.values(pools)) { for (const value of pool) value.visual.dispose(); pool.length = 0; }
    // A pending load owns its newly resolved textures until its catch cleanup.
    if (!loadPromise) disposeOwnedTextures();
    state = 'disposed';
  }
  function debug() {
    return { state, loaded: state === 'ready', lastError, generation, eventCursor: sequence,
      presentation: 'soft-watercolor', assetVersion: 'machine-gun-soft-runtime-v1', supportedWeapons: [WEAPON],
      activeOneShots: oneShots.size, activeProjectiles: shots.size, projectileIds: [...shots.keys()],
      activeVisualLayers: oneShots.size + shots.size, firedProjectileCount: fired.size, fireEventCount: fires.size,
      terminalProjectileCount: ended.size, terminalReceiptCapacity: LIMITS.receipts,
      pooled: Object.fromEntries(Object.entries(pools).map(([kind, pool]) => [kind, pool.length])), ...counters,
      movementAuthority: 'battlefield-projectile-state', projectileAnimationApplied: false,
      attackVisualCopies: 1, logicalEventsEmitted: 0, callerTexturesDisposed: false, cleared,
      limitation: '기관총 표시 계층. 전투 상태·피해·충돌·오디오·화면 반동은 호출자가 소유.' };
  }
  const api = { load, consume, update, setCamera(value) { camera = value; }, reset, dispose, debug };
  return api;
}
