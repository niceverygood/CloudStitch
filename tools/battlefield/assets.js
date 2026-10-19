import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

// The fleet remains an input to this prototype. These loaders never rewrite a
// GLB, and all game transforms live above the authored skeleton.
const sourceLoads = new Map();
let fleetCatalogPromise = null;
const SEMANTICS = {
  hull: ['hull'], connector: ['starboardConnector'], deck: ['externalDeck'],
  cannon: ['cannon', 'machinegun', 'harpoon'], engine: ['engine'], balloon: ['balloon'],
};

async function loadSource(assetId) {
  if (!/^[a-z0-9-]+$/.test(assetId)) throw new Error(`지원하지 않는 함대 에셋: ${assetId}`);
  if (!fleetCatalogPromise) fleetCatalogPromise = fetch('../fleet-v1/catalog.json').then(response => {
    if (!response.ok) throw new Error(`함대 카탈로그 HTTP ${response.status}`);
    return response.json();
  }).catch(error => { fleetCatalogPromise = null; throw error; });
  const catalog = await fleetCatalogPromise;
  const entry = catalog.ships?.find(ship => ship.id === assetId);
  if (!entry || entry.model !== `ships/${assetId}.glb`) throw new Error(`카탈로그에 등록되지 않은 함대 에셋: ${assetId}`);
  if (!sourceLoads.has(assetId)) {
    const path = `../fleet-v1/${entry.model}`;
    const promise = new GLTFLoader().loadAsync(path).catch(error => {
      sourceLoads.delete(assetId);
      throw new Error(`비행선 에셋을 불러오지 못했습니다 (${assetId}): ${error?.message || error}`);
    });
    sourceLoads.set(assetId, promise);
  }
  return sourceLoads.get(assetId);
}

function moduleList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (value instanceof Map) return [...value.values()];
  return Object.entries(value).map(([key, state]) => typeof state === 'object' && state !== null ? { type: key, ...state } : { type: key, hp: state });
}

function unavailable(state) {
  return state.detached === true || state.destroyed === true || state.attached === false ||
    state.active === false || state.alive === false || state.hp === 0 || state.health === 0 ||
    ['detached', 'destroyed', 'recovered', 'cargo'].includes(state.state);
}

function meshBox(THREE, mesh) {
  if (mesh.isSkinnedMesh) {
    mesh.computeBoundingBox();
    return mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  }
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
}

function visibleBounds(THREE, object) {
  object.updateMatrixWorld(true);
  const result = new THREE.Box3();
  object.traverse(node => {
    if (!node.isMesh || !node.visible) return;
    for (let parent = node.parent; parent; parent = parent.parent) if (!parent.visible) return;
    result.union(meshBox(THREE, node));
  });
  return result;
}

function materialFactory(THREE) {
  const owned = new Set(), converted = new Map();
  const gradientMap = new THREE.DataTexture(new Uint8Array([112, 190, 255]), 3, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  function toon(source) {
    if (converted.has(source)) return converted.get(source);
    const material = new THREE.MeshToonMaterial({
      color: source.color?.clone() || new THREE.Color(0xffffff),
      map: source.map || null, alphaMap: source.alphaMap || null,
      opacity: source.opacity, transparent: source.transparent,
      alphaTest: source.alphaTest, side: source.side, vertexColors: source.vertexColors,
      depthWrite: source.depthWrite, depthTest: source.depthTest,
      toneMapped: false, fog: true, gradientMap,
    });
    material.name = `${source.name || 'Painted fleet'} / battlefield toon`;
    material.userData.outlineParameters = {
      thickness: .0015, color: [.14, .10, .075], alpha: 1, visible: true, keepAlive: true,
    };
    converted.set(source, material); owned.add(material);
    return material;
  }
  return { toon, dispose() { for (const material of owned) material.dispose(); gradientMap.dispose(); } };
}

/**
 * Load a real fleet GLB with independent bones. The returned group uses +Z
 * forward and +Y up; set group.rotation.y to the simulation heading. Length is
 * an explicitly provisional gameplay distance, not a declaration of metres.
 */
export async function loadShip(THREE, assetId, targetLength = 10) {
  if (!Number.isFinite(targetLength) || targetLength <= 0) throw new Error('비행선 표시 길이는 양수여야 합니다.');
  const gltf = await loadSource(assetId);
  const model = cloneSkeleton(gltf.scene);
  model.name = `${assetId}-source`;
  const paints = materialFactory(THREE), meshes = [];
  const ownedSkeletons = new Set();
  let disposed = false;
  model.traverse(node => {
    if (!node.isMesh) return;
    if (node.isSkinnedMesh && node.skeleton) ownedSkeletons.add(node.skeleton);
    node.material = Array.isArray(node.material) ? node.material.map(paints.toon) : paints.toon(node.material);
    node.frustumCulled = false;
    meshes.push(node);
  });
  model.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(model), rawSize = rawBox.getSize(new THREE.Vector3());
  if (!(rawSize.x > 0)) throw new Error(`비행선의 실제 지오메트리를 읽을 수 없습니다: ${assetId}`);
  const rawCenter = rawBox.getCenter(new THREE.Vector3()), scale = targetLength / rawSize.x;
  model.position.sub(rawCenter);
  const normalized = new THREE.Group();
  normalized.name = `${assetId}-normalization`;
  normalized.rotation.y = Math.PI / 2; // Authored -X -> gameplay +Z.
  normalized.scale.setScalar(scale);
  normalized.add(model);
  const group = new THREE.Group();
  group.name = assetId;
  group.add(normalized);
  group.updateMatrixWorld(true);

  const records = new Map();
  for (const mesh of meshes) {
    const data = mesh.userData, id = data.moduleId || data.part || mesh.name;
    if (!records.has(id)) records.set(id, { id, type: data.moduleType || 'hull', parentId: data.parentId ?? null, role: data.role, meshes: [] });
    records.get(id).meshes.push(mesh);
  }
  const selections = new Map();
  for (const [semantic, types] of Object.entries(SEMANTICS)) {
    let matches = [...records.values()].filter(record => types.includes(record.type));
    // A severed tax side deck must never remove its independent main engine or
    // main envelope. Generic scout guns have a deliberate cannon-role adapter.
    if (semantic === 'engine' || semantic === 'balloon') {
      const auxiliary = matches.filter(record => record.role === (semantic === 'engine' ? 'auxiliaryEngine' : 'auxiliaryBalloon'));
      if (auxiliary.length) matches = auxiliary;
    }
    selections.set(semantic, new Set(matches.map(record => record.id)));
  }
  const primary = type => new Set([...records.values()].filter(record => record.type === type && !record.role?.startsWith('auxiliary')).map(record => record.id));
  selections.set('main-engine', primary('engine'));
  selections.set('main-balloon', primary('balloon'));
  selections.set('aux-balloon', new Set([...records.values()].filter(record => record.role === 'auxiliaryBalloon').map(record => record.id)));
  selections.set('root', new Set(selections.get('hull')));
  function resolve(state) {
    if (typeof state === 'string') state = { type: state };
    const exact = state?.assetModuleId || state?.moduleId || state?.canonicalId || state?.id;
    if (records.has(exact)) return new Set([exact]);
    const key = state?.key;
    const type = key === 'balloon' ? 'main-balloon' : selections.has(key) ? key : state?.type || state?.kind || state?.role || exact;
    return new Set(selections.get(type) || []);
  }
  function descendants(ids) {
    const result = new Set(ids);
    let added = true;
    while (added) {
      added = false;
      for (const record of records.values()) if (result.has(record.parentId) && !result.has(record.id)) { result.add(record.id); added = true; }
    }
    return result;
  }

  const slots = {};
  for (const [type, ids] of selections) {
    if (!ids.size) continue;
    const box = new THREE.Box3();
    for (const id of ids) for (const mesh of records.get(id).meshes) box.union(meshBox(THREE, mesh));
    const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    slots[type] = {
      x: center.x, y: center.y, z: center.z,
      width: size.x, height: size.y, length: size.z,
      // A single elongated bounds circle would swallow every forward weapon.
      // This is an inscribed planar aiming proxy, not a mesh physics collider.
      radius: Math.min(size.x, size.z) * .5,
      canonicalIds: [...ids], visual: true,
    };
  }
  // Simulation key `balloon` names the main envelope; `aux-balloon` is the tax
  // deck child. Keep that distinction in the exported collider alignment map.
  if (slots['main-balloon']) slots.balloon = slots['main-balloon'];

  // Only the embedded rotor tracks play. Whole-pose art loops move HullMotion,
  // turret axes and muzzle sockets, which would disagree with game collision.
  const mixer = new THREE.AnimationMixer(model), cruise = gltf.animations.find(clip => clip.name === 'Cruise');
  const rotorTracks = cruise?.tracks.filter(track => /(?:PropellerSpin|_Rotor)\.quaternion$/.test(track.name)) || [];
  if (rotorTracks.length) {
    const clip = new THREE.AnimationClip(`${assetId}-CruiseRotors`, cruise.duration, rotorTracks.map(track => track.clone()));
    mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
  }

  function setModuleState(modules) {
    if (assetId === 'player-homeward') return;
    const hidden = new Set();
    for (const state of moduleList(modules)) {
      if (!state || !unavailable(state)) continue;
      const ids = resolve(state), type = state.type || state.kind;
      const affected = type === 'connector' || type === 'deck' || [...ids].some(id => /connector|external-deck/.test(id)) ? descendants(ids) : ids;
      for (const id of affected) hidden.add(id);
    }
    for (const record of records.values()) for (const mesh of record.meshes) mesh.visible = !hidden.has(record.id);
  }

  function createDebris(bundle) {
    // The clone preserves skeleton bindings even though skins are scene-root
    // objects. Match canonical IDs, not scene ancestry or display names.
    const requested = moduleList(bundle?.modules || bundle?.parts || bundle);
    const ids = new Set();
    for (const state of requested) for (const id of resolve(state)) ids.add(id);
    // The simulation already lists every live member. Expanding ancestry here
    // would resurrect an earlier destroyed cannon inside a later deck bundle.
    const selected = ids;
    if (!selected.size) throw new Error(`분리 묶음과 대응하는 실제 부품이 없습니다: ${assetId}`);
    const duplicate = cloneSkeleton(normalized);
    duplicate.name = `${assetId}-detached-art`;
    duplicate.traverse(node => {
      if (!node.isMesh) return;
      node.visible = selected.has(node.userData.moduleId || node.userData.part || node.name);
      node.frustumCulled = false;
    });
    const bounds = visibleBounds(THREE, duplicate), center = bounds.getCenter(new THREE.Vector3());
    duplicate.position.sub(center);
    const debris = new THREE.Group();
    debris.name = `${assetId}-recovery-bundle`;
    debris.add(duplicate);
    debris.userData = { assetId, canonicalModuleIds: [...selected], sourceLocalCenter: center.toArray(), staticPose: true };
    return debris;
  }

  const source = {
    assetId, path: `outputs/fleet-v1/ships/${assetId}.glb`,
    authoredForward: '-X', gameplayForward: '+Z', authoredUp: '+Y',
    targetLength, scale, rawBounds: { min: rawBox.min.toArray(), max: rawBox.max.toArray() },
    clips: gltf.animations.map(clip => ({ name: clip.name, duration: clip.duration })),
    rotorTracks: rotorTracks.length, moduleCount: records.size,
    visualTopology: assetId === 'enemy-tax-cutter' ? 'canonical-side-deck-tree' : 'direct-hull-modules',
    collisionNote: 'The display uses real fleet geometry. Gameplay uses separate provisional planar module proxies; GLBs contain no authored collision or LOD.',
  };
  const yawBones = [];
  model.traverse(node => { if (node.isBone && (node.name === 'TurretYaw' || node.userData.controlRole === 'yaw')) yawBones.push(node); });
  function aimAt(dx, dz, heading = 0) {
    if (!Number.isFinite(dx) || !Number.isFinite(dz) || !Number.isFinite(heading)) return;
    const up = new THREE.Vector3(0, 1, 0);
    const rawDirection = new THREE.Vector3(dx, 0, dz).applyAxisAngle(up, -heading - Math.PI / 2);
    for (const yaw of yawBones) {
      const chain = [];
      for (let node = yaw.parent; node && node !== model; node = node.parent) chain.push(node);
      const parentRotation = new THREE.Quaternion();
      for (const node of chain.reverse()) parentRotation.multiply(node.quaternion);
      const localDirection = rawDirection.clone().applyQuaternion(parentRotation.invert());
      if (Math.hypot(localDirection.x, localDirection.z) < .001) continue;
      // The direction and heading are simulation world values; no scene parent
      // transform is required. Native barrels point along -X, including the tax
      // cannon mounted sideways under a separate root bone.
      yaw.rotation.y = Math.atan2(localDirection.z, -localDirection.x);
    }
  }
  function muzzleOffset() {
    const muzzle = model.getObjectByName('Muzzle');
    if (!muzzle) return null;
    group.updateMatrixWorld(true);
    const offset = group.worldToLocal(muzzle.getWorldPosition(new THREE.Vector3()));
    return { x: offset.x, y: offset.y, z: offset.z };
  }
  // The source rig explicitly authors socket forward as -X. The adapter
  // exports a world +Z-style firing frame without rewriting the source GLB.
  function muzzleFrame() {
    const muzzle = model.getObjectByName('Muzzle');
    if (!muzzle) return null;
    group.updateWorldMatrix(true, true);
    const position = muzzle.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(-1, 0, 0).applyQuaternion(muzzle.getWorldQuaternion(new THREE.Quaternion())).normalize();
    return { position: { x: position.x, y: position.y, z: position.z }, direction: { x: direction.x, y: direction.y, z: direction.z }, source: `${assetId}:Muzzle`, provisional: true };
  }
  group.userData.asset = source;
  return {
    group, model, mixer, slots, slotPositions: slots, modulePositions: slots, source,
    update(dt) { if (Number.isFinite(dt) && dt >= 0) mixer.update(Math.min(dt, .1)); },
    setModuleState, createDebris, aimAt, muzzleOffset, muzzleFrame,
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.stopAllAction(); mixer.uncacheRoot(model);
      // SkeletonUtils owns these cloned skeletons/bone textures. Geometry and
      // source texture maps remain cache-shared and must survive this instance.
      for (const skeleton of ownedSkeletons) skeleton.dispose();
      ownedSkeletons.clear();
      paints.dispose(); group.removeFromParent();
    },
  };
}

export async function loadFleet(THREE) {
  const ids = ['enemy-tax-cutter', 'enemy-pirate-scout', 'enemy-union-salvage'];
  const loaded = await Promise.all([loadShip(THREE, 'player-homeward'), ...ids.map(id => loadShip(THREE, id))]);
  return { player: loaded[0], enemies: new Map(ids.map((id, index) => [id, loaded[index + 1]])) };
}
