import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMotionClips } from '../airship-rig/motion.js';

const TAU = Math.PI * 2;
const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const WEAPONS = new Set(['machinegun', 'cannon', 'mortar', 'harpoon', 'chainshot', 'flame']);

function stablePhase(name) {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 16777619);
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13; hash = Math.imul(hash, 0xc2b2ae35); hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296 * TAU;
}

function ancestry(object) {
  const chain = [];
  for (let node = object; node; node = node.parent) chain.push(node);
  const data = {};
  const fields = ['moduleId', 'moduleType', 'parentId', 'structuralRole', 'featureId', 'role', 'controlRole', 'surface', 'authored'];
  for (const node of chain.reverse()) for (const field of fields) {
    if (node.userData?.[field] !== undefined) data[field] = node.userData[field];
  }
  return data;
}

function ownerOf(object) {
  for (let node = object.parent; node; node = node.parent) if (node.isBone) return node;
  throw new Error(`Mesh has no owning Bone: ${object.name}`);
}

// Compact a material group without losing UV seams, normals or other vertex
// attributes. The caller has already baked the complete mesh world matrix.
function compactGeometry(source, start = 0, count = source.index?.count || source.attributes.position.count) {
  const remap = new Map(), selected = [], indices = [];
  for (let i = start; i < start + count; i++) {
    const old = source.index ? source.index.getX(i) : i;
    if (!remap.has(old)) { remap.set(old, selected.length); selected.push(old); }
    indices.push(remap.get(old));
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (name === 'skinIndex' || name === 'skinWeight') continue;
    const ArrayType = attribute.isInterleavedBufferAttribute ? attribute.data.array.constructor : attribute.array.constructor;
    const values = new ArrayType(selected.length * attribute.itemSize);
    selected.forEach((old, i) => {
      for (let c = 0; c < attribute.itemSize; c++) values[i * attribute.itemSize + c] = attribute.getComponent(old, c);
    });
    geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized));
  }
  geometry.setIndex(indices);
  return geometry;
}

function closeLoop(values, quaternion) {
  const size = quaternion ? 4 : 3, end = values.length - size;
  if (values.length < size * 3) return;
  if (!quaternion) {
    for (let c = 0; c < size; c++) {
      values[end + c] = values[c];
      values[end - size + c] = 2 * values[c] - values[size + c];
    }
    return;
  }
  const first = new THREE.Quaternion().fromArray(values, 0);
  const second = new THREE.Quaternion().fromArray(values, 4);
  const last = new THREE.Quaternion().fromArray(values, end);
  const sign = first.dot(last) < 0 ? -1 : 1;
  last.copy(first);
  if (sign < 0) last.set(-last.x, -last.y, -last.z, -last.w);
  last.toArray(values, end);
  const increment = first.clone().invert().multiply(second).normalize();
  last.multiply(increment.invert()).normalize().toArray(values, end - 4);
}

function addTrack(tracks, name, times, values, quaternion = false) {
  closeLoop(values, quaternion);
  const size = quaternion ? 4 : 3;
  // A complete profile still carries its neutral channel, with two keys instead
  // of thousands of repeated values for inactive drums, recoil and cable.
  let constant = true;
  for (let i = size; i < values.length && constant; i++) if (Math.abs(values[i] - values[i % size]) > 1e-12) constant = false;
  const Track = quaternion ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
  tracks.set(name, new Track(name, constant ? [0, times[times.length - 1]] : times, constant ? [...values.slice(0, size), ...values.slice(0, size)] : values, THREE.InterpolateLinear));
}

const smootherstep = value => {
  const x = Math.min(1, Math.max(0, value));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

function workCycle(u) {
  if (u < .1) return 0;
  if (u < .36) return smootherstep((u - .1) / .26);
  if (u < .49) return 1;
  if (u < .87) return 1 - smootherstep((u - .49) / .38);
  return 0;
}

function pulse(u, start, end) {
  if (u <= start || u >= end) return 0;
  return Math.sin(Math.PI * (u - start) / (end - start)) ** 4;
}

function deltaAngle(role, u, profile, control) {
  const phase = control.phase || 0, p = TAU * u + phase;
  const amplitude = control.amplitude ?? .1;
  const working = profile === 'WinchCycle', firing = profile === 'FireBurst';
  switch (role) {
    case 'shoulder': return amplitude * (working ? .75 * workCycle(u) + .18 * Math.sin(p) : .035 * Math.sin(p));
    case 'elbow': return amplitude * (working ? -.65 * workCycle(u) + .2 * Math.sin(p - .5) : .025 * Math.sin(p - .5));
    case 'grip': return amplitude * (working ? .7 * Math.sin(2 * p) * pulse(u, .15, .9) : .03 * Math.sin(p));
    case 'crane': return amplitude * (working ? workCycle(u) : .025 * Math.sin(p));
    case 'bell': return amplitude * (firing ? Math.sin(5 * p) * pulse(u, .18, .72) : .025 * Math.sin(p));
    case 'clapper': return amplitude * (firing ? -Math.sin(5 * p - .45) * pulse(u, .18, .76) : .025 * Math.sin(p - .6));
    case 'valve': return amplitude * (firing ? pulse(u, .25, .62) : 0);
    case 'pitch': return amplitude * (firing || profile === 'TurretScan' ? .6 * Math.sin(p - .2) : .025 * Math.sin(p));
    case 'sail': return amplitude * (profile === 'GustRecovery' ? 1.3 : .5) * (Math.sin(2 * p) + .2 * Math.sin(3 * p + .4));
    default: return 0;
  }
}

/** Convert bone-owned meshes into scene-root skins and author seven full poses. */
export function rigAndAnimate(scene, controls, { motionScale = 10, style = 'warm' } = {}) {
  if (!scene?.isObject3D || !Array.isArray(controls)) throw new Error('rigAndAnimate needs a scene and control list');
  if (!(Number.isFinite(motionScale) && motionScale > 0)) throw new Error('motionScale must be positive');
  scene.updateMatrixWorld(true);
  const rootBone = scene.getObjectByName('RigRoot'), hullBone = scene.getObjectByName('HullMotion');
  if (!rootBone?.isBone || !hullBone?.isBone) throw new Error('RigRoot and HullMotion Bones are required');
  const bones = [], meshes = [], boneNames = new Set();
  scene.traverse(object => {
    if (object.isBone) {
      if (boneNames.has(object.name)) throw new Error(`Duplicate Bone name: ${object.name}`);
      boneNames.add(object.name); bones.push(object);
    }
    if (object.isMesh) meshes.push(object);
  });
  const bind = new Map(bones.map(b => [b, { position: b.position.clone(), quaternion: b.quaternion.clone(), scale: b.scale.clone() }]));
  const uniqueControls = [], controlKeys = new Set();
  for (const control of controls) {
    if (!bind.has(control.bone)) throw new Error(`Control Bone is outside scene: ${control.bone?.name}`);
    const key = `${control.bone.uuid}:${control.role}`;
    if (!controlKeys.has(key)) {
      if (['rotor', 'vibration'].includes(control.role) && !Number.isFinite(control.phase)) control.phase = stablePhase(control.bone.name);
      if (Number.isFinite(control.phase)) control.bone.userData.motionPhase = control.phase;
      controlKeys.add(key); uniqueControls.push(control);
    }
  }
  const skeleton = new THREE.Skeleton(bones); skeleton.calculateInverses();
  const boneIndex = new Map(bones.map((b, i) => [b, i]));
  const buckets = new Map(); let sourceTriangles = 0;
  for (const object of meshes) {
    if (object.isSkinnedMesh) throw new Error('rigAndAnimate must run once on unskinned source meshes');
    const owner = ownerOf(object), data = ancestry(object);
    const world = object.geometry.clone().applyMatrix4(object.matrixWorld);
    if (!world.attributes.normal) world.computeVertexNormals();
    if (!world.attributes.uv) throw new Error(`Painted mesh has no UVs: ${object.name}`);
    sourceTriangles += (world.index?.count || world.attributes.position.count) / 3;
    const signature = Object.entries(world.attributes).filter(([key]) => !key.startsWith('skin')).map(([key, a]) => `${key}/${a.itemSize}/${a.normalized}/${a.isInterleavedBufferAttribute ? a.data.array.constructor.name : a.array.constructor.name}`).sort().join('|');
    const groups = Array.isArray(object.material)
      ? (world.groups.length ? world.groups : [{ start: 0, count: world.index?.count || world.attributes.position.count, materialIndex: 0 }])
      : [{ start: 0, count: world.index?.count || world.attributes.position.count, materialIndex: 0 }];
    for (const group of groups) {
      const material = Array.isArray(object.material) ? object.material[group.materialIndex] : object.material;
      if (!material) throw new Error(`Mesh has an invalid material group: ${object.name}`);
      const key = [owner.uuid, data.moduleId || 'core', material.uuid, signature, data.featureId || '', data.structuralRole || ''].join(':');
      if (!buckets.has(key)) buckets.set(key, { owner, material, data, geometries: [], names: [] });
      const bucket = buckets.get(key);
      bucket.geometries.push(compactGeometry(world, group.start, group.count)); bucket.names.push(object.name);
    }
    world.dispose();
  }
  let triangles = 0;
  const materialIds = new Set(), skins = [];
  for (const bucket of buckets.values()) {
    const geometry = mergeGeometries(bucket.geometries, false);
    if (!geometry) throw new Error(`Cannot merge ${bucket.owner.name} geometry`);
    for (const source of bucket.geometries) source.dispose();
    const count = geometry.attributes.position.count;
    const indices = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { indices[i * 4] = boneIndex.get(bucket.owner); weights[i * 4] = 1; }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const skin = new THREE.SkinnedMesh(geometry, bucket.material);
    skin.name = `${bucket.data.moduleId || 'core'}_${bucket.owner.name}_${skins.length}`;
    skin.frustumCulled = false;
    skin.bind(skeleton, new THREE.Matrix4());
    skin.userData = {
      ...bucket.data, moduleId: bucket.data.moduleId || 'core', moduleType: bucket.data.moduleType || 'hull',
      parentId: bucket.data.parentId ?? null, ownerBone: bucket.owner.name,
      rigidWeights: true, mergedSourceMeshCount: bucket.names.length,
    };
    scene.add(skin); skins.push(skin); materialIds.add(bucket.material.uuid);
    triangles += geometry.index.count / 3;
  }
  if (triangles !== sourceTriangles) throw new Error(`Skin merge changed triangle count: ${sourceTriangles} -> ${triangles}`);
  for (const object of meshes) { object.removeFromParent(); object.geometry.dispose(); }
  scene.updateMatrixWorld(true);

  // The reference has identity bind transforms. Its complete periodic channel
  // shape is transferred to each control's captured local bind transform.
  const reference = createMotionClips(THREE, { sampleRate: 60 });
  const moduleTypes = new Set(meshes.map(mesh => ancestry(mesh).moduleType).filter(Boolean));
  // Meshes have been detached; skin extras preserve their ancestor module type.
  for (const skin of skins) moduleTypes.add(skin.userData.moduleType);
  const hasRole = role => uniqueControls.some(c => c.role === role);
  const available = {
    FloatIdle: true, Cruise: true, BankTurn: true, GustRecovery: true,
    TurretScan: hasRole('yaw') || hasRole('pitch'),
    WinchCycle: ['hook', 'drum', 'shoulder', 'elbow', 'rail', 'crane'].some(hasRole),
    FireBurst: ['recoil', 'valve', 'bell', 'clapper'].some(hasRole),
  };
  const clips = reference.map(source => {
    const sourceTracks = new Map(source.tracks.map(track => [track.name, track]));
    const times = source.tracks[0].times;
    const tracks = new Map();
    function transfer(target, sourceName, property, options = {}) {
      const track = sourceTracks.get(`${sourceName}.${property}`);
      if (!track) return;
      const pose = bind.get(target), size = property === 'quaternion' ? 4 : 3, values = [];
      const interpolant = options.timeOffset ? track.createInterpolant() : null;
      for (let i = 0; i < times.length; i++) {
        const offset = interpolant ? 0 : i * size;
        const sampled = interpolant ? interpolant.evaluate((times[i] + options.timeOffset) % source.duration) : track.values;
        if (property === 'quaternion') {
          const delta = new THREE.Quaternion().fromArray(sampled, offset);
          if (options.phase) delta.multiply(new THREE.Quaternion().setFromAxisAngle(AXES[options.axis] || AXES.x, options.phase));
          pose.quaternion.clone().multiply(delta).normalize().toArray(values, values.length);
        } else if (property === 'scale') {
          pose.scale.clone().multiply(new THREE.Vector3().fromArray(sampled, offset)).toArray(values, values.length);
        } else {
          const delta = new THREE.Vector3().fromArray(sampled, offset).multiplyScalar(motionScale);
          pose.position.clone().add(delta).toArray(values, values.length);
        }
      }
      addTrack(tracks, `${target.name}.${property}`, times, values, property === 'quaternion');
    }
    transfer(rootBone, 'RigRoot', 'position'); transfer(rootBone, 'RigRoot', 'quaternion');
    transfer(hullBone, 'HullMotion', 'position'); transfer(hullBone, 'HullMotion', 'quaternion');
    const hookPosition = sourceTracks.get('HookSwing.position');
    for (const control of uniqueControls) {
      const { bone, role } = control;
      if (bone === rootBone || bone === hullBone) continue;
      switch (role) {
        case 'yaw': transfer(bone, 'TurretYaw', 'quaternion'); break;
        case 'recoil': transfer(bone, 'GunRecoil', 'position'); break;
        case 'rotor': transfer(bone, 'PropellerSpin', 'quaternion', control); break;
        case 'drum': transfer(bone, 'WinchDrum', 'quaternion'); break;
        case 'hook': transfer(bone, 'HookSwing', 'position'); transfer(bone, 'HookSwing', 'quaternion'); break;
        case 'vibration': {
          // The reference engine vibration is a 10 Hz closed cycle. Shift
          // within that cycle so parallel engines do not visibly breathe in
          // lockstep, without shifting the much slower hull/weapon actions.
          const offset = { timeOffset: (control.phase || 0) / (TAU * 10) };
          transfer(bone, 'EngineVibration', 'position', offset);
          transfer(bone, 'EngineVibration', 'quaternion', offset); break;
        }
        case 'envelope': transfer(bone, 'EnvelopeFlex', 'scale'); transfer(bone, 'EnvelopeFlex', 'quaternion'); break;
        case 'cable': {
          const length = control.restLength || bone.userData.restLength || 1;
          if (!(length > 0)) throw new Error(`Cable has no positive rest length: ${bone.name}`);
          const values = [], pose = bind.get(bone);
          for (let i = 0; i < times.length; i++) {
            const down = -hookPosition.values[i * 3 + 1] * motionScale;
            pose.scale.clone().multiply(new THREE.Vector3(1, 1 + down / length, 1)).toArray(values, values.length);
          }
          addTrack(tracks, `${bone.name}.scale`, times, values); break;
        }
        case 'rail': {
          const values = [], pose = bind.get(bone), axis = AXES[control.axis] || AXES.x;
          for (const t of times) {
            const distance = source.name === 'WinchCycle' ? (control.amplitude || .35) * workCycle(t / source.duration) : 0;
            pose.position.clone().addScaledVector(axis, distance).toArray(values, values.length);
          }
          addTrack(tracks, `${bone.name}.position`, times, values); break;
        }
        default: {
          const values = [], pose = bind.get(bone), axis = AXES[control.axis] || AXES.z;
          for (const t of times) {
            const delta = new THREE.Quaternion().setFromAxisAngle(axis, deltaAngle(role, t / source.duration, source.name, control));
            pose.quaternion.clone().multiply(delta).normalize().toArray(values, values.length);
          }
          addTrack(tracks, `${bone.name}.quaternion`, times, values, true); break;
        }
      }
    }
    const clip = new THREE.AnimationClip(source.name, source.duration, [...tracks.values()]);
    clip.userData = { ...source.userData, fullPose: true, availableAction: available[source.name], ambientOnly: !available[source.name], style };
    return clip;
  });
  const stats = {
    triangles, sourceTriangles, bones: bones.length, boneCount: bones.length,
    sourceMeshCount: meshes.length, meshCount: skins.length, skinnedMeshCount: skins.length,
    materialCount: materialIds.size, controls: uniqueControls.length,
    controlRoles: [...new Set(uniqueControls.map(c => c.role))],
    phasedControls: uniqueControls.filter(c => ['rotor', 'vibration'].includes(c.role)).map(c => ({ bone: c.bone.name, role: c.role, phase: c.phase })),
    availableActions: Object.keys(available).filter(name => available[name]),
    unavailableActions: Object.keys(available).filter(name => !available[name]),
    hasWeapons: [...moduleTypes].some(type => WEAPONS.has(type)),
    clips: clips.map(clip => ({ name: clip.name, duration: clip.duration, tracks: clip.tracks.length, ambientOnly: clip.userData.ambientOnly })),
    motionScale, style, sceneRootSkins: true, singleWeightRigidSkinning: true,
  };
  scene.userData = { ...scene.userData, rig: stats, availableActions: stats.availableActions };
  return { clips, stats };
}
