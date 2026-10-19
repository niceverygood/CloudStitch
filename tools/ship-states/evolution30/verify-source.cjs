/* Geometry and deterministic motion checks against the actual selected GLB.
 * No renderer, network, texture decoder, or browser is used by this check. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const THREE = require('three');
const esbuild = require('esbuild');
const ROOT = path.resolve(__dirname, '../../..');
const SOURCE = 'outputs/selected-airship-toon3d/airship.glb';
const OUTPUT = 'outputs/ship-states-v1/evolution30/source-verification.json';
const STAGES = { normal: 3, damage: 4, weapons: 5, armor: 5, growth: 9, explosion: 5 };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const finite = (values, label) => { for (const n of values) assert(Number.isFinite(n), `${label}: non-finite value`); };

function parseGLB(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB declared byte length');
  let json, bin;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) json = JSON.parse(bytes.subarray(offset + 8, offset + 8 + length).toString('utf8'));
    if (type === 0x004e4942) bin = bytes.subarray(offset + 8, offset + 8 + length);
    offset += length + 8;
  }
  assert(json && bin, 'GLB JSON and BIN chunks');
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const types = {
    5120: { bytes: 1, read: 'readInt8', array: Int8Array },
    5121: { bytes: 1, read: 'readUInt8', array: Uint8Array },
    5122: { bytes: 2, read: 'readInt16LE', array: Int16Array },
    5123: { bytes: 2, read: 'readUInt16LE', array: Uint16Array },
    5125: { bytes: 4, read: 'readUInt32LE', array: Uint32Array },
    5126: { bytes: 4, read: 'readFloatLE', array: Float32Array },
  };
  function accessor(index) {
    const spec = json.accessors[index], view = json.bufferViews[spec.bufferView];
    assert(!spec.sparse && view, 'Only actual dense source accessors are supported');
    const type = types[spec.componentType], itemSize = components[spec.type];
    assert(type && itemSize, 'Accessor component/type supported');
    const values = new type.array(spec.count * itemSize);
    const stride = view.byteStride || itemSize * type.bytes;
    const start = (view.byteOffset || 0) + (spec.byteOffset || 0);
    for (let i = 0; i < spec.count; i++) for (let c = 0; c < itemSize; c++) {
      values[i * itemSize + c] = bin[type.read](start + i * stride + c * type.bytes);
    }
    return new THREE.BufferAttribute(values, itemSize, Boolean(spec.normalized));
  }
  function makeMesh(index) {
    const definition = json.meshes[index];
    const group = new THREE.Group(); group.name = definition.name || `mesh-${index}`;
    for (const primitive of definition.primitives) {
      assert([undefined, 4].includes(primitive.mode), 'Triangle primitive required');
      const geometry = new THREE.BufferGeometry();
      for (const [semantic, attribute] of Object.entries({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' })) {
        if (primitive.attributes[semantic] !== undefined) geometry.setAttribute(attribute, accessor(primitive.attributes[semantic]));
      }
      assert(primitive.indices !== undefined, 'Actual indexed source required');
      geometry.setIndex(accessor(primitive.indices));
      group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff })));
    }
    return group;
  }
  const nodes = json.nodes.map((node, index) => {
    const object = node.mesh !== undefined ? makeMesh(node.mesh) : new THREE.Group();
    object.name = node.name || `node-${index}`;
    if (node.matrix) new THREE.Matrix4().fromArray(node.matrix).decompose(object.position, object.quaternion, object.scale);
    else {
      if (node.translation) object.position.fromArray(node.translation);
      if (node.rotation) object.quaternion.fromArray(node.rotation);
      if (node.scale) object.scale.fromArray(node.scale);
    }
    return object;
  });
  json.nodes.forEach((node, index) => (node.children || []).forEach(child => nodes[index].add(nodes[child])));
  const scene = new THREE.Scene();
  for (const index of json.scenes[json.scene || 0].nodes) scene.add(nodes[index]);
  scene.updateMatrixWorld(true);
  return { scene, json };
}

function snapshot(variant, time) {
  variant.update(time); variant.root.updateMatrixWorld(true);
  const values = [], flags = [], names = [];
  variant.root.traverse(object => {
    names.push(object.name); finite(object.matrixWorld.elements, object.name);
    values.push(...object.matrixWorld.elements); flags.push(object.visible);
    if (object.isMesh) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        assert(Number.isFinite(material.opacity), 'Finite material opacity');
        values.push(material.opacity); flags.push(material.transparent, material.depthWrite, material.visible);
      }
    }
  });
  return { values, flags, names };
}
function same(a, b, label) {
  assert.deepEqual(a.names, b.names, `${label}: nodes`);
  assert.deepEqual(a.flags, b.flags, `${label}: visibility/transparency/depth state`);
  assert.equal(a.values.length, b.values.length, `${label}: snapshot length`);
  let maximum = 0;
  for (let i = 0; i < a.values.length; i++) maximum = Math.max(maximum, Math.abs(a.values[i] - b.values[i]));
  assert(maximum <= 1e-10, `${label}: matrix/opacity difference ${maximum}`);
  return maximum;
}


async function main(){
 const bytes=fs.readFileSync(path.join(ROOT,SOURCE)),gltf=parseGLB(bytes);
 assert.equal(sha(bytes),'dae35b13806d553a8b124d502a81d7dff58c183a266db25efc0d9a060198ce74');
 const bundle=await esbuild.build({entryPoints:[path.join(__dirname,'variants.js')],bundle:true,write:false,format:'cjs',platform:'node',external:['three'],nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)});
 const moduleObject={exports:{}};vm.runInNewContext(bundle.outputFiles[0].text,{module:moduleObject,exports:moduleObject.exports,require,console});const library=moduleObject.exports.createVariantLibrary(gltf);
 const report={title:'Cloudstitch',levels:[],passed:false,sourceSha256:sha(bytes),wholeRootScale:1,browser:false,sourceTriangles:11026};let previous=0;
 for(let level=1;level<=30;level++){
  const v=library.create('e'+(Math.floor((level-1)/5)+1),(level-1)%5);assert.equal(v.counts.sourceTriangles,11026);assert.equal(v.root.userData.level,level);assert.equal(v.root.userData.modules.length,level-1);assert(v.counts.triangles>previous);previous=v.counts.triangles;assert(v.root.scale.equals(new THREE.Vector3(1,1,1)));
  v.root.traverse(n=>{if(n.isMesh){for(const [k,a]of Object.entries(n.geometry.attributes))finite(a.array,k);}});
  const a=snapshot(v,0);snapshot(v,2);same(a,snapshot(v,6),'loop'+level);
  report.levels.push({level,...v.counts,bounds:new THREE.Box3().setFromObject(v.root).getSize(new THREE.Vector3()).toArray()});v.dispose();
 }
 library.dispose();assert.equal(sha(fs.readFileSync(path.join(ROOT,SOURCE))),sha(bytes));report.passed=true;fs.mkdirSync(path.dirname(path.join(ROOT,OUTPUT)),{recursive:true});fs.writeFileSync(path.join(ROOT,OUTPUT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,levels:30,triangleRange:[report.levels[0].triangles,report.levels[29].triangles],meshRange:[report.levels[0].meshes,report.levels[29].meshes],sourcePreserved:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
