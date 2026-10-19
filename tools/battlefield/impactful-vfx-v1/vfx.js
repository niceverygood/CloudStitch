import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createEventCursor, createShotReceipts, getWeaponVfx, runtimeAssetDescriptors, flightBasis, impactBasis,
  projectilePose, RUNTIME_WEAPON_IDS, DEFAULT_PROJECTILE_HEIGHT } from '../vfx-contract.mjs';
import { getRichProfile } from '../vfx-rich-profiles.mjs';
import { getImpactfulProfile } from './profiles.mjs';

// Relative to outputs/battlefield-v1/index.html, matching the existing asset loader.
// Serve the repository over HTTP; fetch is not a file:// or embedded-file loader.
const ASSET_BASE = '../combat-vfx/';
const MAX_POOL_PER_EFFECT = 24;
const MAX_ACTIVE_ONESHOTS_PER_EFFECT = 32;
const MAX_ACTIVE_PROJECTILES_PER_EFFECT = 64;

/**
 * await vfx.load(); vfx.consume(sim.events, sim.projectiles);
 * vfx.update(paused ? 0 : dt, sim.projectiles); vfx.reset() at retry.
 * Fire/hit events carry seq, projectileId, weaponId, x/y/z and direction{x,y,z};
 * hit additionally carries the actual normal{x,y,z}. No hit is scheduled here.
 */
export function createCombatVfx(THREE, scene, { presentation = 'impactful', effectScale = 1 } = {}) {
  if (!['original', 'rich', 'impactful'].includes(presentation)) throw new Error('Unknown VFX presentation');
  if (!Number.isFinite(effectScale) || effectScale < 0.5 || effectScale > 1.5) throw new Error('VFX effectScale must be between 0.5 and 1.5');
  const cursor = createEventCursor(), sources = new Map(), pools = new Map(), effectStats = new Map();
  const shots = new Map(), fireEvents = new Map(), receipts = createShotReceipts(2048), oneShots = new Set();
  const counters = { created: 0, reused: 0, returned: 0, muzzleEffects: 0, hitEffects: 0, unsupportedEvents: 0, staleGenerationEvents: 0, dropped: 0, culled: 0 };
  let state = 'unloaded', loadPromise = null, lastError = null, generation = null;
  const displayProfile = effectId => presentation === 'impactful' ? getImpactfulProfile(effectId)
    : presentation === 'rich' ? getRichProfile(effectId) : { scale: 1, echoes: [] };

  const assertReady = () => {
    if (state !== 'ready') throw new Error(`전투 VFX load() 완료 후 사용해야 합니다 (현재 ${state}).`);
  };
  const identity = root => {
    root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.set(1, 1, 1);
    root.visible = false;
  };
  const clearReferences = instance => {
    instance.projectileId = null; instance.hostId = null; instance.endpoints = null; instance.elapsed = 0;
  };
  const pose = (root, position, basis) => {
    root.position.set(...position);
    root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...basis.right), new THREE.Vector3(...basis.up), new THREE.Vector3(...basis.forward)));
    root.visible = true;
  };
  const disposeSources = () => {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    for (const source of sources.values()) source.gltf.scene.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
    sources.clear();
  };

  function makeInstance(effectId) {
    const source = sources.get(effectId), root = new THREE.Group();
    root.name = `battlefield-vfx-${effectId}`;
    const profile = displayProfile(effectId);
    const layers = [], baseline = [];
    const layerSpecs = [{ delay: 0, scale: 1, rotation: 0, offset: [0, 0, 0] }, ...(source.carrier ? [] : profile.echoes)];
    for (const spec of layerSpecs) {
      // Only carrier children: source root siblings contain demo flight/smoke.
      const model = (source.carrier || source.gltf.scene).clone(true);
      if (source.carrier) { model.position.set(0, 0, 0); model.quaternion.identity(); model.scale.set(1, 1, 1); }
      const group = new THREE.Group();
      group.position.set(...spec.offset); group.scale.set(...(spec.stretch || [1, 1, 1])).multiplyScalar(spec.scale);
      group.rotation.y = spec.rotation;
      group.add(model); root.add(group);
      model.traverse(node => baseline.push({ node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
      const mixer = source.carrier ? null : new THREE.AnimationMixer(model);
      const action = mixer ? mixer.clipAction(source.clip) : null;
      layers.push({ group, model, mixer, action, delay: spec.delay });
    }
    counters.created++;
    return { effectId, root, model: layers[0].model, baseline, layers,
      visualScale: (profile.stretch || [1, 1, 1]).map(axis => axis * profile.scale * effectScale), duration: source.clip?.duration || 0,
      elapsed: 0, projectileId: null, hostId: null, endpoints: null };
  }

  function disposeInstance(instance) {
    for (const layer of instance.layers) layer.mixer?.uncacheRoot(layer.model);
  }

  function release(instance) {
    const stats = effectStats.get(instance.effectId);
    if (instance.active) { stats.active--; instance.active = false; }
    for (const layer of instance.layers) {
      layer.action?.stop(); layer.action?.reset();
      if (layer.action) {
        layer.action.time = 0; layer.action.setLoop(THREE.LoopOnce, 1);
        layer.action.clampWhenFinished = false;
      }
      layer.mixer?.stopAllAction();
      if (layer.mixer) layer.mixer.time = 0;
      layer.group.visible = false;
    }
    for (const original of instance.baseline) {
      original.node.position.copy(original.position); original.node.quaternion.copy(original.quaternion);
      original.node.scale.copy(original.scale);
    }
    instance.root.removeFromParent(); identity(instance.root); clearReferences(instance);
    const pool = pools.get(instance.effectId) || [];
    if (pool.length < MAX_POOL_PER_EFFECT) { pool.push(instance); pools.set(instance.effectId, pool); }
    else { disposeInstance(instance); stats.culled++; counters.culled++; }
    counters.returned++;
  }

  function acquire(effectId) {
    const stats = effectStats.get(effectId);
    if (stats.active >= stats.maxActive) { stats.dropped++; counters.dropped++; return null; }
    const pool = pools.get(effectId);
    const instance = pool?.length ? (counters.reused++, pool.pop()) : makeInstance(effectId);
    instance.active = true; stats.spawned++; stats.active++; stats.peak = Math.max(stats.peak, stats.active);
    identity(instance.root); clearReferences(instance);
    instance.root.scale.set(...instance.visualScale);
    for (const layer of instance.layers) layer.group.visible = layer.delay === 0;
    scene.add(instance.root);
    return instance;
  }

  function playOnce(effectId, event, surface = false) {
    if (!Number.isFinite(event.x) || !Number.isFinite(event.z)) throw new Error(`전투 VFX 이벤트 좌표가 유효하지 않습니다: ${event.type}`);
    // Compute first so an invalid contact cannot leave a pooled instance attached.
    const basis = surface ? impactBasis(event.normal, event.direction) : flightBasis(event.direction);
    const instance = acquire(effectId);
    if (!instance) return false;
    instance.projectileId = event.projectileId; instance.hostId = event.hostId || null;
    pose(instance.root, [event.x, Number.isFinite(event.y) ? event.y : DEFAULT_PROJECTILE_HEIGHT, event.z], basis);
    for (const layer of instance.layers) {
      layer.action.reset(); layer.action.setLoop(THREE.LoopOnce, 1);
      layer.action.clampWhenFinished = true; layer.action.enabled = true;
      layer.action.setEffectiveTimeScale(1); layer.action.setEffectiveWeight(1); layer.action.play();
      layer.mixer.update(0);
    }
    oneShots.add(instance);
    return true;
  }

  function removeShot(projectileId) {
    const instance = shots.get(projectileId);
    if (instance) { shots.delete(projectileId); release(instance); }
    fireEvents.delete(projectileId);
  }

  function syncProjectiles(projectiles = []) {
    if (!Array.isArray(projectiles)) throw new TypeError('VFX projectiles는 배열이어야 합니다.');
    const active = new Set();
    for (const projectile of projectiles) {
      if (projectile?.id == null || receipts.hasEnded(projectile.id)) continue;
      const fireEvent = fireEvents.get(projectile.id);
      const weaponId = projectile.weaponId || fireEvent?.weaponId;
      const mapping = getWeaponVfx(weaponId);
      if (!mapping?.runtimeSupported) continue;
      const actual = projectilePose(projectile, fireEvent);
      active.add(projectile.id);
      let instance = shots.get(projectile.id);
      if (instance && instance.effectId !== mapping.projectile) { removeShot(projectile.id); instance = null; }
      if (!instance) {
        instance = acquire(mapping.projectile);
        if (!instance) continue;
        instance.projectileId = projectile.id; shots.set(projectile.id, instance);
      }
      // No mixer, local flight translation, end-scale, velocity integration or demo trail.
      pose(instance.root, actual.position, actual.basis);
    }
    for (const projectileId of shots.keys()) if (!active.has(projectileId)) { receipts.end(projectileId); removeShot(projectileId); }
    for (const projectileId of fireEvents.keys()) if (!active.has(projectileId)) { receipts.end(projectileId); fireEvents.delete(projectileId); }
  }

  async function load() {
    if (state === 'disposed') throw new Error('폐기된 전투 VFX는 다시 로드할 수 없습니다.');
    if (state === 'ready') return api;
    if (loadPromise) return loadPromise;
    state = 'loading'; lastError = null;
    loadPromise = (async () => {
      const readJson = async filename => {
        const url = ASSET_BASE + filename;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
        return response.json();
      };
      try {
        const [catalog, recipes] = await Promise.all([readJson('catalog.json'), readJson('recipes.json')]);
        const descriptors = runtimeAssetDescriptors(catalog, recipes), loader = new GLTFLoader();
        // Wait for all loads before cleanup, including when an earlier GLB failed.
        const results = await Promise.allSettled(descriptors.map(async descriptor => {
          const url = ASSET_BASE + descriptor.model;
          const gltf = await loader.loadAsync(url).catch(error => { throw new Error(`${url}: ${error?.message || error}`); });
          const source = { ...descriptor, gltf, clip: gltf.animations[0] || null, carrier: null };
          sources.set(descriptor.id, source);
          if (descriptor.kind === 'projectile') {
            source.carrier = gltf.scene.getObjectByName(descriptor.carrierName);
            if (!source.carrier) throw new Error(`${url}: ${descriptor.carrierName} 노드가 없습니다.`);
          } else if (!source.clip || !Number.isFinite(source.clip.duration) || source.clip.duration <= 0) {
            throw new Error(`${url}: 유효한 실제 단발 애니메이션이 없습니다.`);
          }
          let meshes = 0;
          (source.carrier || source.gltf.scene).traverse(node => { if (node.isMesh) meshes++; });
          const layers = source.carrier ? 1 : 1 + displayProfile(descriptor.id).echoes.length;
          effectStats.set(descriptor.id, { spawned: 0, active: 0, peak: 0, dropped: 0, culled: 0,
            layerCount: layers, meshPerInstance: meshes * layers,
            maxActive: source.carrier ? MAX_ACTIVE_PROJECTILES_PER_EFFECT : MAX_ACTIVE_ONESHOTS_PER_EFFECT });
        }));
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length) throw new Error(failures.map(result => result.reason?.message || String(result.reason)).join('; '));
        if (state === 'disposed') throw new Error('로드 중 전투 VFX가 폐기되었습니다.');
        state = 'ready';
        return api;
      } catch (error) {
        disposeSources(); effectStats.clear();
        if (state !== 'disposed') state = 'failed';
        lastError = `Cloudstitch 전투 VFX 초기화 실패: ${error?.message || error}`;
        throw new Error(lastError, { cause: error });
      } finally { loadPromise = null; }
    })();
    return loadPromise;
  }

  function consume(events, projectiles = [], currentGeneration = undefined) {
    assertReady();
    if (!Array.isArray(events)) throw new TypeError('VFX events는 배열이어야 합니다.');
    if (currentGeneration !== undefined) {
      if (!Number.isSafeInteger(currentGeneration) || currentGeneration < 0) throw new Error('Invalid VFX generation');
      if (generation !== null && currentGeneration < generation) { counters.staleGenerationEvents += events.length; return; }
      if (generation !== currentGeneration) reset(currentGeneration);
    }
    const acceptedEvents = events.filter(event => {
      if (event.generation === undefined) return true;
      if (!Number.isSafeInteger(event.generation) || event.generation < 0) throw new Error('Invalid event generation');
      if (generation === null) generation = event.generation;
      if (event.generation === generation) return true;
      counters.staleGenerationEvents++; return false;
    });
    for (const event of cursor.take(acceptedEvents)) {
      if (event.type === 'projectile-ended') {
        if (event.projectileId != null) { receipts.end(event.projectileId); removeShot(event.projectileId); }
        continue;
      }
      if (!['player-fire', 'enemy-fire', 'hit'].includes(event.type)) continue;
      if (event.projectileId == null) throw new Error(`${event.type} VFX 이벤트에 projectileId가 필요합니다.`);
      if (receipts.hasEnded(event.projectileId)) continue;
      const mapping = getWeaponVfx(event.weaponId);
      if (!mapping?.runtimeSupported) { counters.unsupportedEvents++; continue; }
      if (event.type === 'hit') {
        if (playOnce(mapping.hit, event, true)) counters.hitEffects++;
        receipts.end(event.projectileId); removeShot(event.projectileId);
      } else {
        if (receipts.hasFired(event.projectileId)) continue;
        if (playOnce(mapping.muzzle, event)) counters.muzzleEffects++;
        receipts.start(event.projectileId);
        fireEvents.set(event.projectileId, { weaponId: event.weaponId, y: event.y,
          direction: event.direction ? { ...event.direction } : null });
      }
    }
    syncProjectiles(projectiles);
  }

  function update(dt, projectiles = []) {
    assertReady();
    if (!Number.isFinite(dt) || dt < 0) throw new Error('VFX dt는 0 이상의 유한한 초여야 합니다.');
    syncProjectiles(projectiles);
    for (const instance of oneShots) {
      const previous = instance.elapsed; instance.elapsed += dt;
      for (const layer of instance.layers) {
        layer.group.visible = instance.elapsed >= layer.delay;
        layer.mixer.update(Math.max(0, instance.elapsed - layer.delay) - Math.max(0, previous - layer.delay));
      }
      // Richness does not extend a logical effect or make another hit.
      if (instance.elapsed >= instance.duration) { oneShots.delete(instance); release(instance); }
    }
  }

  function reset(nextGeneration = null) {
    if (nextGeneration !== null && (!Number.isSafeInteger(nextGeneration) || nextGeneration < 0)) throw new Error('Invalid VFX generation');
    for (const instance of oneShots) release(instance);
    for (const instance of shots.values()) release(instance);
    oneShots.clear(); shots.clear(); fireEvents.clear(); receipts.reset(); cursor.reset();
    generation = nextGeneration;
    for (const key of Object.keys(counters)) counters[key] = 0;
    for (const stats of effectStats.values()) {
      stats.spawned = 0; stats.active = 0; stats.peak = 0; stats.dropped = 0; stats.culled = 0;
    }
  }

  function dispose() {
    if (state === 'disposed') return;
    reset();
    for (const pool of pools.values()) for (const instance of pool) disposeInstance(instance);
    pools.clear(); disposeSources(); effectStats.clear(); state = 'disposed';
  }

  function debug() {
    return { state, loaded: state === 'ready', lastError, eventCursor: cursor.sequence, generation, presentation, effectScale, assetVersion: 'v1',
      supportedWeapons: [...RUNTIME_WEAPON_IDS], mappedWeaponCount: 6,
      loadedEffects: [...sources.keys()], activeOneShots: oneShots.size, activeProjectiles: shots.size,
      projectileIds: [...shots.keys()], terminalProjectileCount: receipts.terminalCount,
      activeVisualLayers: [...oneShots, ...shots.values()].reduce((sum, instance) => sum + instance.layers.length, 0),
      profiles: Object.fromEntries([...sources.keys()].map(id => [id, displayProfile(id)])),
      firedProjectileCount: receipts.activeCount, fireEventCount: fireEvents.size, terminalReceiptCapacity: receipts.capacity,
      pooled: Object.fromEntries([...pools].map(([id, pool]) => [id, pool.length])), ...counters,
      perEffect: Object.fromEntries([...effectStats].map(([id, stats]) => [id, { ...stats,
        pooled: pools.get(id)?.length || 0, maxPooled: MAX_POOL_PER_EFFECT,
        activeLayers: stats.active * stats.layerCount, activeMeshes: stats.active * stats.meshPerInstance,
        maxLayers: stats.maxActive * stats.layerCount, maxMeshes: stats.maxActive * stats.meshPerInstance }])),
      movementAuthority: 'battlefield-projectile-state', projectileAnimationApplied: false,
      limitation: '기관총/함포 표시 연결. 다른 네 무기의 실제 판정·상태·견인·범위 공격은 미구현.' };
  }

  const api = { load, consume, update, reset, dispose, debug };
  return api;
}
