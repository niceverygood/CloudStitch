import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeWorldKit } from './environment-source/core.mjs';
import * as sky from './environment-source/sky.mjs';
import * as props from './environment-source/props.mjs';
import * as terrain from './environment-source/terrain.mjs';

const RECIPES = new Map();
for (const module of [sky, props, terrain]) {
  for (const spec of module.assets) RECIPES.set(spec.id, { spec, build: module.build });
}

function disposeSource(root) {
  const geometries = new Set(), materials = new Set();
  root.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of [node.material].flat()) if (material) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

// Keep only the attributes used by the common painted, unlit material. Converting
// each input to the same layout also makes indexed and nonindexed recipes mix.
function bakedGeometry(mesh, matrix) {
  const source = mesh.geometry;
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  try {
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    for (const name of Object.keys(geometry.attributes)) {
      if (!['position', 'normal', 'color'].includes(name)) geometry.deleteAttribute(name);
    }
    const positions = geometry.getAttribute('position');
    if (!positions || positions.itemSize !== 3) throw new Error('Scenery needs XYZ vertex positions.');
    for (const name of ['position', 'normal', 'color']) {
      const attribute = geometry.getAttribute(name);
      const values = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i++) {
        values[i * 3] = attribute ? attribute.getX(i) : 1;
        values[i * 3 + 1] = attribute ? attribute.getY(i) : 1;
        values[i * 3 + 2] = attribute ? attribute.getZ(i) : 1;
      }
      geometry.setAttribute(name, new THREE.BufferAttribute(values, 3));
    }
    geometry.clearGroups();
    geometry.applyMatrix4(matrix);
    return geometry;
  } catch (error) {
    geometry.dispose();
    throw error;
  }
}

function mergeBucket(inputs, material, name, geometryOwner) {
  let geometry;
  try {
    geometry = mergeGeometries(inputs, false);
    if (!geometry) throw new Error(`Could not merge painted scenery: ${name}`);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometryOwner.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.userData.environmentMerged = true;
    return mesh;
  } catch (error) {
    if (geometry && !geometryOwner.has(geometry)) geometry.dispose();
    throw error;
  } finally {
    for (const input of inputs) input.dispose();
    inputs.length = 0;
  }
}

function preservedNodes(root, clips) {
  const keep = new Set([root]);
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const binding = THREE.PropertyBinding.parseTrackName(track.name);
      if (binding.objectName || !['position', 'quaternion', 'scale', 'rotation'].includes(binding.propertyName)) {
        throw new Error(`Scenery merger only supports transform tracks: ${track.name}`);
      }
      const target = THREE.PropertyBinding.findNode(root, binding.nodeName);
      if (!target) throw new Error(`Missing scenery animation node: ${track.name}`);
      for (let node = target; node; node = node.parent) {
        keep.add(node);
        if (node === root) break;
      }
    }
  }
  return keep;
}

function copyTransform(source) {
  const group = new THREE.Group();
  group.name = source.name;
  group.rotation.order = source.rotation.order;
  group.position.copy(source.position);
  group.quaternion.copy(source.quaternion);
  group.scale.copy(source.scale);
  group.visible = source.visible;
  return group;
}

function measurePrototype(variant, sourceId) {
  variant.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(variant.root);
  const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  const maxExtent = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxExtent) || maxExtent <= 0 || !center.toArray().every(Number.isFinite)) {
    throw new Error(`Invalid merged scenery bounds: ${sourceId}`);
  }
  return { ...variant, center, maxExtent };
}

function animatedPrototype(root, meshes, clips, material, geometryOwner) {
  const keep = preservedNodes(root, clips), groups = new Map(), buckets = new Map();
  root.traverse((node) => {
    if (!keep.has(node)) return;
    const group = copyTransform(node);
    groups.set(node, group);
    if (node !== root) groups.get(node.parent).add(group);
  });
  try {
    for (const mesh of meshes) {
      let anchor = mesh;
      while (!keep.has(anchor)) anchor = anchor.parent;
      const matrix = anchor.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
      if (!buckets.has(anchor)) buckets.set(anchor, []);
      buckets.get(anchor).push(bakedGeometry(mesh, matrix));
    }
    for (const [anchor, inputs] of buckets) {
      groups.get(anchor).add(mergeBucket(inputs, material, `${anchor.name}_painted_batch`, geometryOwner));
      inputs.length = 0;
    }
    return { root: groups.get(root), renderMeshes: buckets.size, clips };
  } finally {
    // On failure, release inputs from buckets that have not been merged yet.
    for (const inputs of buckets.values()) for (const input of inputs) input.dispose();
  }
}

/**
 * Read-only adapters for the map-atmosphere recipes. One factory build per kind;
 * flat and articulated prototypes share a library-owned painted material. Each
 * instance shares merged geometry and owns its animation mixer. Do not dispose
 * those shared resources from a scene traversal; dispose this library instead.
 */
export function createEnvironmentModelLibrary() {
  const prototypes = new Map(), geometries = new Set(), mixers = new Set();
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, fog: true });
  let disposed = false, instanceCount = 0, liveRenderMeshes = 0, liveTriangles = 0;

  function prototype(kind) {
    if (prototypes.has(kind)) return prototypes.get(kind);
    const recipe = RECIPES.get(kind);
    if (!recipe) throw new Error(`Unknown map-atmosphere scenery kind: ${kind}`);
    const kit = makeWorldKit(recipe.spec), raw = kit.root;
    let initialMixer;
    const before = new Set(geometries);
    try {
      const { clips = [] } = recipe.build(recipe.spec, kit) || {};
      // Some authored clips start at a nonzero phase. Measure that same initial
      // pose so the first rendered instance is centered and has unit extent.
      if (clips.length) {
        initialMixer = new THREE.AnimationMixer(raw);
        for (const clip of clips) initialMixer.clipAction(clip).play();
        initialMixer.setTime(0);
      }
      raw.updateMatrixWorld(true);
      const meshes = [];
      raw.traverse((node) => {
        if (!node.isMesh) return;
        if (node.isSkinnedMesh || Object.keys(node.geometry.morphAttributes).length) {
          throw new Error(`Scenery merger needs static geometry with transform clips: ${kind}`);
        }
        meshes.push(node);
      });
      if (!meshes.length) throw new Error(`Empty scenery recipe: ${kind}`);
      const triangles = meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3, 0);
      const animated = measurePrototype(animatedPrototype(raw, meshes, clips, material, geometries), kind);
      const flatRoot = new THREE.Group();
      flatRoot.name = `${kind}_flat`;
      const flatInputs = [];
      try {
        for (const mesh of meshes) flatInputs.push(bakedGeometry(mesh, mesh.matrixWorld));
        flatRoot.add(mergeBucket(flatInputs, material, `${kind}_painted_flat`, geometries));
        flatInputs.length = 0;
      } finally {
        for (const input of flatInputs) input.dispose();
      }
      // Batching changes the axis-aligned bounds of rotated subassemblies.
      // Normalize the actual merged variant rather than the unmerged recipe.
      const flat = measurePrototype({ root: flatRoot, renderMeshes: 1, clips: [] }, kind);
      const value = { sourceId: kind, sourceMeshes: meshes.length, triangles, animated, flat };
      prototypes.set(kind, value);
      return value;
    } catch (error) {
      for (const geometry of geometries) {
        if (before.has(geometry)) continue;
        geometry.dispose();
        geometries.delete(geometry);
      }
      throw error;
    } finally {
      if (initialMixer) {
        initialMixer.stopAllAction();
        initialMixer.uncacheRoot(raw);
      }
      disposeSource(raw);
      raw.clear();
    }
  }

  return {
    create(kind, { flatten = false } = {}) {
      if (disposed) throw new Error('The scenery library has been disposed.');
      const source = prototype(kind), variant = flatten ? source.flat : source.animated;
      const group = new THREE.Group(), normalized = new THREE.Group(), centered = new THREE.Group();
      group.name = `environment_${kind}`;
      group.userData = { sourceId: source.sourceId, visualOnly: true, normalizedExtent: 1, originalMaxExtent: variant.maxExtent, flattened: !!flatten };
      normalized.scale.setScalar(1 / variant.maxExtent);
      centered.position.copy(variant.center).negate();
      const rig = variant.root.clone(true);
      group.add(normalized);
      normalized.add(centered);
      centered.add(rig);
      let mixer;
      if (variant.clips.length) {
        mixer = new THREE.AnimationMixer(rig);
        for (const clip of variant.clips) mixer.clipAction(clip).play();
        mixer.setTime(0);
        mixers.add(mixer);
      }
      instanceCount++;
      liveRenderMeshes += variant.renderMeshes;
      liveTriangles += source.triangles;
      return {
        group,
        sourceId: source.sourceId,
        sourceMeshes: source.sourceMeshes,
        renderMeshes: variant.renderMeshes,
        triangles: source.triangles,
        maxExtent: variant.maxExtent,
        update(timeSeconds) {
          if (disposed || !mixer) return;
          if (!Number.isFinite(timeSeconds)) throw new Error('Scenery animation time must be finite.');
          mixer.setTime(Math.max(0, timeSeconds));
        },
      };
    },
    stats() {
      const cached = [...prototypes.values()];
      return {
        prototypeCount: prototypes.size,
        sourceMeshes: cached.reduce((sum, entry) => sum + entry.sourceMeshes, 0),
        sourceTriangles: cached.reduce((sum, entry) => sum + entry.triangles, 0),
        instanceCount,
        renderMeshes: liveRenderMeshes,
        triangles: liveTriangles,
        mergedGeometries: geometries.size,
        disposed,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const mixer of mixers) {
        mixer.stopAllAction();
        mixer.uncacheRoot(mixer.getRoot());
      }
      mixers.clear();
      for (const geometry of geometries) geometry.dispose();
      geometries.clear();
      material.dispose();
      prototypes.clear();
      instanceCount = liveRenderMeshes = liveTriangles = 0;
    },
  };
}
