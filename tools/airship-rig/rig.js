import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { captureMotionBindPose, createMotionClips, MOTION_PROFILES } from './motion.js';
import partMap from './part-map.json';

const worldPivots = {
  RigRoot: [0, 0, 0], HullMotion: [0, -.10, .0078],
  EnvelopeFlex: [0, .13, .0078], EngineVibration: [.384766, -.1430665, .0080565],
  PropellerSpin: [.451, -.136719, .0078125],
  TurretYaw: [-.2868655, -.103, .0097655], GunRecoil: [-.3125, -.0537105, .0080565],
  WinchDrum: [.0004885, -.117432, -.10791], HookSwing: [.002441, -.153076, -.121338],
};
const parents = {
  HullMotion: 'RigRoot', EnvelopeFlex: 'HullMotion', EngineVibration: 'HullMotion',
  PropellerSpin: 'EngineVibration', TurretYaw: 'HullMotion', GunRecoil: 'TurretYaw',
  WinchDrum: 'HullMotion', HookSwing: 'HullMotion',
};
const jointsForPart = {
  HullAndCabin: 'HullMotion', EnvelopeAndBands: 'EnvelopeFlex', EngineHousing: 'EngineVibration',
  PropellerAssembly: 'PropellerSpin', TurretAssembly: 'TurretYaw', GunBarrel: 'GunRecoil',
  WinchDrumMesh: 'WinchDrum', HookAndChain: 'HookSwing',
};

function subGeometry(source, triangleIndices) {
  const vertices = [], remap = new Map(), indices = [];
  for (const triangle of triangleIndices) for (let corner = 0; corner < 3; corner++) {
    const oldIndex = source.index.getX(triangle * 3 + corner);
    if (!remap.has(oldIndex)) { remap.set(oldIndex, vertices.length); vertices.push(oldIndex); }
    indices.push(remap.get(oldIndex));
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values = new attribute.array.constructor(vertices.length * attribute.itemSize);
    vertices.forEach((index, i) => {
      for (let c = 0; c < attribute.itemSize; c++) values[i * attribute.itemSize + c] = attribute.array[index * attribute.itemSize + c];
    });
    geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized));
  }
  geometry.setIndex(indices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, sourceVertices: vertices };
}

export async function buildRig(sourceBuffer) {
  const gltf = await new GLTFLoader().parseAsync(sourceBuffer, '');
  let original;
  gltf.scene.traverse(object => { if (object.isMesh) { if (original) throw new Error('Expected the selected single-mesh source.'); original = object; } });
  if (!original?.geometry.index) throw new Error('Selected source requires indexed geometry.');
  const geometry = original.geometry.clone();
  original.updateWorldMatrix(true, false); geometry.applyMatrix4(original.matrixWorld);
  const sourceTriangles = geometry.index.count / 3;
  if (sourceTriangles !== 11026) throw new Error('Unexpected source topology; re-author the part map.');

  // Export actual scene roots, avoiding a transformed wrapper around skins.
  const scene = new THREE.Scene(); scene.name = 'Cloudstitch_Airship_Rig_v1';
  const bones = {}, names = Object.keys(worldPivots);
  for (const name of names) { bones[name] = new THREE.Bone(); bones[name].name = name; }
  for (const name of names) {
    const parent = parents[name];
    bones[name].position.fromArray(worldPivots[name]);
    if (parent) { bones[name].position.sub(new THREE.Vector3().fromArray(worldPivots[parent])); bones[parent].add(bones[name]); }
    else scene.add(bones[name]);
    bones[name].userData = { control: name, bindWorldPivot: worldPivots[name], parent: parent || null };
  }
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(names.map(name => bones[name])); skeleton.calculateInverses();
  const jointIndex = Object.fromEntries(names.map((name, i) => [name, i]));
  const triangles = Object.fromEntries(Object.keys(jointsForPart).map(name => [name, []]));
  const seen = new Set(); const supportVertices = new Set();
  for (const component of partMap.components) {
    let target = Object.entries(partMap.parts).find(([, ids]) => ids.includes(component.componentId))?.[0];
    if (!target) target = component.center[1] > .065 ? 'EnvelopeAndBands' : 'HullAndCabin';
    triangles[target].push(...component.triangleIndices);
    for (const t of component.triangleIndices) {
      if (seen.has(t)) throw new Error('Part assignment duplicates a source triangle.');
      seen.add(t);
      if ([9, 10, 13, 16].includes(component.componentId)) for (let c = 0; c < 3; c++) supportVertices.add(geometry.index.getX(t * 3 + c));
    }
  }
  if (seen.size !== sourceTriangles) throw new Error('Part assignment lost source triangles.');
  const partStats = [];
  for (const [name, triangleIndices] of Object.entries(triangles)) {
    const { geometry: part, sourceVertices } = subGeometry(geometry, triangleIndices);
    const count = part.attributes.position.count;
    const indices = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      indices[i * 4] = jointIndex[jointsForPart[name]]; weights[i * 4] = 1;
      if (name === 'HullAndCabin') {
        const y = part.attributes.position.getY(i);
        // The four suspension ropes gently follow the envelope at their upper
        // ends. Cabin, hull planks, brackets and all mechanical parts stay rigid.
        if (supportVertices.has(sourceVertices[i])) {
          const t = THREE.MathUtils.smoothstep(y, -.08, .095);
          indices[i * 4 + 1] = jointIndex.EnvelopeFlex;
          weights[i * 4] = 1 - t; weights[i * 4 + 1] = t;
        }
      }
    }
    for (let i = 0; i < weights.length; i++) if (weights[i] === 0) indices[i] = 0;
    part.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    part.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const mesh = new THREE.SkinnedMesh(part, original.material); mesh.name = name;
    mesh.frustumCulled = false; mesh.bind(skeleton, new THREE.Matrix4()); scene.add(mesh);
    mesh.userData = { part: name, joint: jointsForPart[name], sourceTriangles: triangleIndices.length, sourceGeometryPreserved: true };
    partStats.push({ name, joint: jointsForPart[name], triangles: triangleIndices.length, vertices: count });
  }

  // A short braided cable bridges the fixed guide and moving hook. Top skin
  // weights stay on the hull; lower weights follow HookSwing during payout.
  const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x6b5140, roughness: 1, metalness: 0 });
  cableMaterial.name = 'Matte woven cable';
  for (let strand = 0; strand < 3; strand++) {
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, a = t * Math.PI * 8 + strand * Math.PI * 2 / 3;
      pts.push(new THREE.Vector3(.002441 + .00065 * Math.cos(a), -.151 - .029 * t, -.121338 + .00065 * Math.sin(a)));
    }
    const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, .00052, 5, false);
    const count = cable.attributes.position.count, indices = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const t = THREE.MathUtils.clamp((-.151 - cable.attributes.position.getY(i)) / .029, 0, 1);
      indices[i * 4] = jointIndex.HullMotion; indices[i * 4 + 1] = jointIndex.HookSwing;
      weights[i * 4] = 1 - t; weights[i * 4 + 1] = t;
    }
    for (let i = 0; i < weights.length; i++) if (weights[i] === 0) indices[i] = 0;
    cable.deleteAttribute('uv'); // The matte cable material has no texture map.
    cable.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    cable.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const mesh = new THREE.SkinnedMesh(cable, cableMaterial); mesh.name = `WovenCable_${strand + 1}`;
    mesh.frustumCulled = false; mesh.bind(skeleton, new THREE.Matrix4()); scene.add(mesh);
    partStats.push({ name: mesh.name, joint: 'HullMotion / HookSwing', triangles: cable.index.count / 3, vertices: count, addedGeometry: true });
  }
  const sockets = [
    ['Socket_W1', 'HullMotion', [-.2868655, -.103, .0097655]],
    ['Socket_E1', 'HullMotion', [.269043, -.142578, .0080565]],
    ['Socket_L1', 'HullMotion', [0, .006, .0078]],
    ['Socket_S1', 'HullMotion', [.0004885, -.117432, -.10791]],
    ['Muzzle', 'GunRecoil', [-.436768, -.027588, -.001953]],
    ['HookGrip', 'HookSwing', [.0026855, -.224, -.1264645]],
  ];
  for (const [name, parent, pivot] of sockets) {
    const socket = new THREE.Object3D(); socket.name = name;
    socket.position.fromArray(pivot).sub(new THREE.Vector3().fromArray(worldPivots[parent]));
    // Local -X is forward, +Y up, matching the preserved source asset.
    socket.userData = { purpose: name, provisional: true, forward: '-X', up: '+Y' }; bones[parent].add(socket);
  }
  scene.updateMatrixWorld(true);
  const bindPose = captureMotionBindPose(scene);
  const clips = createMotionClips(THREE, { bindPose });
  scene.userData = {
    title: 'Cloudstitch', revision: 1, source: partMap.source, sourceSha256: partMap.sourceSha256,
    originalTriangles: sourceTriangles, coordinateSystem: '+Y up / -X forward; source units preserved, metres unassigned',
    rig: '9 named bone controls; rigid mechanical weights, subtle envelope/suspension and payout cable skinning',
    purpose: 'Art asset and authored animation loops. Not gameplay or physically simulated flight.',
  };
  const binary = await new GLTFExporter().parseAsync(scene, { binary: true, animations: clips, onlyVisible: true, trs: true });
  return { binary, report: { sourceSha256: partMap.sourceSha256, sourceTriangles, jointCount: names.length, joints: names.map(name => ({ name, parent: parents[name] || null, worldPivot: worldPivots[name], localBind: bindPose[name] })), parts: partStats, profiles: MOTION_PROFILES, clips: clips.map(clip => ({ name: clip.name, duration: clip.duration, tracks: clip.tracks.length })), addedCableTriangles: partStats.filter(p => p.addedGeometry).reduce((sum, p) => sum + p.triangles, 0), sockets: sockets.map(([name, parent, pivot]) => ({ name, parent, pivot, provisional: true })) } };
}

window.__buildRig = buildRig;
