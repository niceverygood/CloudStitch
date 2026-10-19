import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildFortress } from './model.mjs';

// The generator is bundled by tools/enemy-base/generate.cjs so a portable checkout
// uses its own installed three/esbuild. No account cache is part of the asset.
if (!globalThis.FileReader) {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.({ target: this }); }).catch(error => this.onerror?.(error));
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then(value => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(value).toString('base64')}`;
        this.onloadend?.({ target: this });
      }).catch(error => this.onerror?.(error));
    }
  };
}

const repo = process.cwd();
const output = path.resolve(repo, process.argv[2] || 'outputs/enemy-base-v1/reference-r3');
const referencePath = 'outputs/enemy-base-v1/reference-r3/reference.png';
const reference = fs.readFileSync(path.resolve(repo, referencePath));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const { root, zones } = buildFortress();
const scene = new THREE.Scene(); scene.name = 'Cloudstitch_enemy_base_art_review'; scene.add(root);
root.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(root);
const size = bounds.getSize(new THREE.Vector3());
let triangles = 0, vertices = 0, meshCount = 0;
const materialSet = new Set();
root.traverse(node => {
  if (!node.isMesh) return;
  meshCount++;
  const g = node.geometry;
  vertices += g.attributes.position.count;
  triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
  (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => materialSet.add(m));
  for (const name of ['position', 'normal', 'color']) {
    if (!g.attributes[name]) throw new Error(`Missing ${name}: ${node.name}`);
    if (!g.attributes[name].array.every(Number.isFinite)) throw new Error(`Non-finite ${name}: ${node.name}`);
  }
});
const binary = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, trs: false, includeCustomExtensions: false });
if (!(binary instanceof ArrayBuffer)) throw new Error('Expected binary glTF ArrayBuffer');
const bytes = Buffer.from(binary);
if (bytes.subarray(0, 4).toString() !== 'glTF') throw new Error('Invalid GLB header');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'enemy-base.glb'), bytes);
const manifest = {
  schema_version: 1, title: 'Cloudstitch · 봉쇄자의 공중 요새', revision: 'reference-r3',
  asset_status: 'static_3d_art_prototype',
  source: { reference: referencePath, sha256: sha(reference), preserved: true, method: 'original code-authored volumetric architecture and vertex painting' },
  model: { path: 'enemy-base.glb', bytes: bytes.length, sha256: sha(bytes), triangles, vertices, meshes: meshCount, materials: materialSet.size, textures: 0, animations: 0,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() },
    coordinates: '+Y up, +Z front/dock; relative design units', authored_components: root.userData.authored_components,
    semantic_groups: zones.map(z => ({ ...z, triangles: root.getObjectByName(z.nodeName).userData.triangles, meshes: root.getObjectByName(z.nodeName).children.length })),
  },
  appearance: { surfaces: 'matte vertex-painted metal, plaster, canvas and timber',
    palette: 'soot navy armor, weathered teal roofs, brass trim, cream quilted buoyancy, oxblood banners, warm amber windows',
    material: 'glTF metallic-roughness, roughness 1, metalness 0; review can replace with hand-painted unlit or toon shading',
    runtime: 'Outline and cel shading belong to review runtime; they are not automatically reproduced by importing the GLB into an engine.' },
  limitations: ['Art review prototype only; no gameplay or enemy AI.', 'No authored collision, LOD, navmesh, engine sockets, gameplay statistics or destruction.', 'Static geometry; no rig or animation; the crane, bell, banners and cannons are modeled in a fixed pose.', 'Building interiors are not authored; open gate is represented by a closed portcullis.', 'Artist/user approval is still required.'],
};
fs.writeFileSync(path.join(output, 'model-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output: path.relative(repo, output), ...manifest.model, semantic_groups: manifest.model.semantic_groups.map(g => ({ id: g.id, triangles: g.triangles, meshes: g.meshes })) }, null, 2)}\n`);
