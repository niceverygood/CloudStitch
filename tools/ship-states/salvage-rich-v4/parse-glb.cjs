const assert=require('node:assert/strict'),THREE=require('three');
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

module.exports={parseGLB};


