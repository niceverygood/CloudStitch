/* Offline rig QA. Does not modify the asset, viewer, or original source.
 * Usage: node tools/qa/airship-rig.cjs [viewer.html] [report-directory] [rigged.glb]
 * A passing report verifies an art preview and reusable glTF rig, not gameplay.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const THREE = require('three');
const { pathToFileURL } = require('node:url');
const { repoPath, reportDirectory, launchBrowser } = require('../lib/runtime.cjs');
const PROFILES = ['FloatIdle', 'Cruise', 'BankTurn', 'GustRecovery', 'TurretScan', 'WinchCycle', 'FireBurst'];
const SOURCE_SHA = 'dae35b13806d553a8b124d502a81d7dff58c183a266db25efc0d9a060198ce74';
const reportDir = reportDirectory('airship-rig', process.argv[3]);
const viewerPath = repoPath(process.argv[2] || 'outputs/airship-rig-v1/viewer.html');
const assetPath = repoPath(process.argv[4] || 'outputs/airship-rig-v1/airship-rigged.glb');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const check = (condition, message) => { if (!condition) throw new Error(message); };
const finite = values => values.every(Number.isFinite);
const length = values => Math.hypot(...values);
const distance = (a, b) => length(a.map((v, i) => v - b[i]));
const componentSizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
function parseGLB(bytes) {
  check(bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'glTF', 'Not a binary glTF asset');
  check(bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, 'Invalid GLB version or declared length');
  let json, bin, offset = 12;
  while (offset < bytes.length) {
    const size = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    check(offset + 8 + size <= bytes.length && size % 4 === 0, 'Invalid GLB chunk bounds/alignment');
    const chunk = bytes.subarray(offset + 8, offset + 8 + size);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8').trim());
    if (type === 0x004e4942) bin = chunk;
    offset += 8 + size;
  }
  check(json && bin, 'GLB must contain JSON and embedded binary data');
  check((json.buffers || []).every(buffer => !buffer.uri), 'GLB contains an external buffer URI');
  check((json.images || []).every(image => !image.uri || image.uri.startsWith('data:')), 'GLB contains an external image URI');
  function accessor(index) {
    const a = json.accessors?.[index];
    check(a && !a.sparse, `Accessor ${index} missing or sparse (not supported by this QA decoder)`);
    const view = json.bufferViews?.[a.bufferView];
    const count = components[a.type], size = componentSizes[a.componentType];
    check(Number.isInteger(a.count) && a.count > 0, `Accessor ${index} has no elements`);
    check(view && view.buffer === 0 && count && size, `Accessor ${index} has an invalid view/type`);
    const stride = view.byteStride || count * size;
    const start = (view.byteOffset || 0) + (a.byteOffset || 0);
    check(start >= (view.byteOffset || 0) && start + (a.count - 1) * stride + count * size <= (view.byteOffset || 0) + view.byteLength, `Accessor ${index} exceeds its view`);
    check(start + (a.count - 1) * stride + count * size <= bin.length, `Accessor ${index} exceeds binary data`);
    const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    const read = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
    const normalized = value => !a.normalized ? value : a.componentType === 5120 ? Math.max(value / 127, -1) : a.componentType === 5121 ? value / 255 : a.componentType === 5122 ? Math.max(value / 32767, -1) : a.componentType === 5123 ? value / 65535 : value;
    return { ...a, rows: Array.from({ length: a.count }, (_, row) => Array.from({ length: count }, (_, col) => normalized(data[read](start + row * stride + col * size, true)))) };
  }
  return { json, bin, accessor };
}
function qMultiply(a, b) { const [x, y, z, w] = a, [X, Y, Z, W] = b; return [w * X + x * W + y * Z - z * Y, w * Y - x * Z + y * W + z * X, w * Z + x * Y - y * X + z * W, w * W - x * X - y * Y - z * Z]; }
function angularVelocity(a, b, dt) {
  let delta = qMultiply([-a[0], -a[1], -a[2], a[3]], b);
  if (delta[3] < 0) delta = delta.map(value => -value);
  const s = Math.hypot(...delta.slice(0, 3));
  const angle = 2 * Math.atan2(s, Math.min(1, Math.max(-1, delta[3])));
  return delta.slice(0, 3).map(value => s < 1e-9 ? 2 * value / dt : value / s * angle / dt);
}
function inspectAsset(bytes) {
  const { json, accessor } = parseGLB(bytes);
  check(json.skins?.length > 0, 'No skin/joint rig exported');
  const skinnedNodes = (json.nodes || []).filter(node => node.skin !== undefined);
  check(skinnedNodes.length > 0, 'No node uses the exported skin');
  let vertexCount = 0, triangleCount = 0, maxWeightError = 0, maxInfluences = 0, maxBindPoseError = 0;
  const parents = new Map(), worldMatrices = new Map();
  (json.nodes || []).forEach((node, index) => (node.children || []).forEach(child => { check(!parents.has(child), `Node ${child} has multiple parents`); parents.set(child, index); }));
  function nodeWorld(index, visiting = new Set()) {
    if (worldMatrices.has(index)) return worldMatrices.get(index);
    check(!visiting.has(index) && json.nodes[index], `Invalid/cyclic joint hierarchy at ${index}`); visiting.add(index);
    const node = json.nodes[index], matrix = new THREE.Matrix4();
    if (node.matrix) matrix.fromArray(node.matrix);
    else matrix.compose(new THREE.Vector3().fromArray(node.translation || [0, 0, 0]), new THREE.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]), new THREE.Vector3().fromArray(node.scale || [1, 1, 1]));
    check(finite(matrix.elements) && Math.abs(matrix.determinant()) > 1e-8, `Node ${index} transform is non-finite/singular`);
    if (parents.has(index)) matrix.premultiply(nodeWorld(parents.get(index), visiting));
    visiting.delete(index); worldMatrices.set(index, matrix); return matrix;
  }
  const skins = json.skins.map((skin, index) => {
    check(skin.joints.length > 1 && new Set(skin.joints).size === skin.joints.length, `Skin ${index} joints missing/duplicated`);
    check(skin.joints.every(joint => json.nodes[joint]), `Skin ${index} references nonexistent joint`);
    const inverses = accessor(skin.inverseBindMatrices);
    check(inverses.type === 'MAT4' && inverses.count === skin.joints.length && inverses.rows.every(finite), `Skin ${index} inverse bind matrices invalid`);
    // A zero determinant collapses a rigid part even if every matrix value is finite.
    for (const m of inverses.rows) {
      const det3 = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
      check(Math.abs(det3) > 1e-8, `Skin ${index} has a singular inverse bind matrix`);
    }
    return { index, jointCount: skin.joints.length, joints: skin.joints.map(joint => json.nodes[joint].name || `node_${joint}`) };
  });
  for (const node of skinnedNodes) {
    const skin = json.skins[node.skin], mesh = json.meshes[node.mesh];
    check(skin && mesh, 'Skinned node has invalid skin/mesh reference');
    const meshWorld = nodeWorld(json.nodes.indexOf(node));
    const inverses = accessor(skin.inverseBindMatrices).rows;
    skin.joints.forEach((joint, i) => {
      const neutral = nodeWorld(joint).clone().multiply(new THREE.Matrix4().fromArray(inverses[i]));
      maxBindPoseError = Math.max(maxBindPoseError, ...neutral.elements.map((value, component) => Math.abs(value - meshWorld.elements[component])));
    });
    for (const primitive of mesh.primitives) {
      check((primitive.mode ?? 4) === 4, 'Expected triangle geometry');
      const positions = accessor(primitive.attributes.POSITION), joints = accessor(primitive.attributes.JOINTS_0), weights = accessor(primitive.attributes.WEIGHTS_0);
      check(positions.rows.every(finite) && positions.count === joints.count && joints.count === weights.count, 'Skin vertex attributes invalid');
      check(joints.type === 'VEC4' && weights.type === 'VEC4', 'Expected four glTF influences per vertex');
      check([5121, 5123].includes(joints.componentType) && !joints.normalized, 'Joint indices must be unnormalized unsigned integers');
      vertexCount += positions.count;
      const indices = accessor(primitive.indices);
      check(indices.rows.every(row => Number.isInteger(row[0]) && row[0] >= 0 && row[0] < positions.count), 'Triangle index out of bounds');
      triangleCount += indices.count / 3;
      for (let i = 0; i < positions.count; i++) {
        check(joints.rows[i].every(joint => Number.isInteger(joint) && joint >= 0 && joint < skin.joints.length), `Vertex ${i} joint out of range`);
        check(finite(weights.rows[i]) && weights.rows[i].every(weight => weight >= 0 && weight <= 1 + 1e-6), `Vertex ${i} has invalid weights`);
        maxInfluences = Math.max(maxInfluences, weights.rows[i].filter(weight => weight > 1e-6).length);
        maxWeightError = Math.max(maxWeightError, Math.abs(weights.rows[i].reduce((sum, value) => sum + value, 0) - 1));
      }
    }
  }
  check(maxBindPoseError < 1e-4, `Inverse bind matrices deform the neutral model: ${maxBindPoseError}`);
  check(maxWeightError < 1e-4, `Skin weights do not sum to one: ${maxWeightError}`);
  const names = (json.animations || []).map(animation => animation.name);
  check(PROFILES.every(name => names.includes(name)), `Missing requested animation clips: ${PROFILES.filter(name => !names.includes(name)).join(', ')}`);
  const animations = json.animations.map(animation => {
    let duration = 0, maxPoseGap = 0, maxVelocityGap = 0, channelCount = 0;
    const channels = [];
    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler], input = accessor(sampler.input), output = accessor(sampler.output);
      const times = input.rows.map(row => row[0]);
      check(input.type === 'SCALAR' && finite(times) && Math.abs(times[0]) < 1e-6 && times.length >= 2 && times.every((time, i) => !i || time > times[i - 1]), `${animation.name}: invalid keyframe times`);
      check(output.rows.every(finite), `${animation.name}: non-finite keyframe values`);
      check(json.nodes[channel.target.node], `${animation.name}: channel references missing node`);
      const cubic = sampler.interpolation === 'CUBICSPLINE';
      check(output.count === input.count * (cubic ? 3 : 1), `${animation.name}: mismatched sampler lengths`);
      const values = cubic ? times.map((_, i) => output.rows[i * 3 + 1]) : output.rows;
      const rotation = channel.target.path === 'rotation';
      check(['rotation', 'translation', 'scale'].includes(channel.target.path), `${animation.name}: unsupported channel ${channel.target.path}`);
      if (rotation) check(values.every(q => Math.abs(length(q) - 1) < 2e-4), `${animation.name}: unnormalized quaternion`);
      const first = values[0], last = values.at(-1);
      const poseGap = rotation ? 2 * Math.acos(Math.min(1, Math.abs(first.reduce((sum, value, i) => sum + value * last[i], 0)))) : distance(first, last);
      const velocities = values.slice(1).map((value, i) => rotation ? angularVelocity(values[i], value, times[i + 1] - times[i]) : value.map((v, component) => (v - values[i][component]) / (times[i + 1] - times[i])));
      const velocityGap = distance(velocities[0], velocities.at(-1));
      const peakSpeed = Math.max(...velocities.map(length));
      check(poseGap < 0.002, `${animation.name}/${json.nodes[channel.target.node].name}/${channel.target.path}: loop pose seam ${poseGap}`);
      // Finite differences converge to the authored derivative as sampling grows.
      // Allow discretization relative to observed peak speed, plus float precision.
      check(velocityGap <= 0.15 * peakSpeed + 0.03, `${animation.name}/${json.nodes[channel.target.node].name}/${channel.target.path}: loop velocity seam ${velocityGap}, peak ${peakSpeed}`);
      duration = Math.max(duration, times.at(-1));
      maxPoseGap = Math.max(maxPoseGap, poseGap); maxVelocityGap = Math.max(maxVelocityGap, velocityGap); channelCount++;
      channels.push({ node: json.nodes[channel.target.node].name, path: channel.target.path, keyframes: times.length, interpolation: sampler.interpolation || 'LINEAR', poseGap, velocityGap, peakSpeed });
    }
    check(duration > 0 && duration <= 120, `${animation.name}: invalid duration`);
    return { name: animation.name, duration, channelCount, maxPoseGap, maxVelocityGap, channels };
  });
  return { bytes: bytes.length, sha256: sha(bytes), skinCount: skins.length, skins, vertexCount, triangleCount, maxWeightError, maxInfluences, maxBindPoseError, animations, externalResources: false };
}
function compareTriangleFidelity(sourceBytes, derivedBytes) {
  const records = (bytes, derived) => {
    const { json, accessor } = parseGLB(bytes), triangles = [], processed = new Set();
    for (const node of json.nodes || []) {
      if (node.mesh === undefined || processed.has(node.mesh) || (derived && /^WovenCable_/i.test(node.name || ''))) continue;
      processed.add(node.mesh);
      for (const primitive of json.meshes[node.mesh].primitives) {
        const p = accessor(primitive.attributes.POSITION).rows, uv = accessor(primitive.attributes.TEXCOORD_0).rows;
        const indices = accessor(primitive.indices).rows.map(row => row[0]);
        check(indices.length % 3 === 0, 'Original triangle fidelity: invalid index count');
        for (let i = 0; i < indices.length; i += 3) {
          const triangle = Buffer.allocUnsafe(60); let offset = 0;
          for (const index of indices.slice(i, i + 3)) for (const value of [...p[index], ...uv[index]]) { triangle.writeFloatLE(value, offset); offset += 4; }
          triangles.push(triangle);
        }
      }
    }
    triangles.sort(Buffer.compare);
    return { triangles, hash: sha(Buffer.concat(triangles)) };
  };
  const source = records(sourceBytes, false), derived = records(derivedBytes, true);
  const equal = source.triangles.length === derived.triangles.length && source.triangles.every((triangle, i) => triangle.equals(derived.triangles[i]));
  check(equal, `Original POSITION+TEXCOORD triangle multiset changed: source ${source.triangles.length}/${source.hash}; derived ${derived.triangles.length}/${derived.hash}`);
  return { triangleCount: source.triangles.length, sourceSha256: source.hash, derivedSha256: derived.hash, exactMatch: true, fields: '3 ordered corners × POSITION xyz + TEXCOORD_0 uv, packed float32, sorted triangles; added WovenCable meshes excluded' };
}
async function main() {
  const report = { scope: 'Offline glTF rig, animation and viewer QA; no engine/gameplay certification.', checks: {}, errors: [], externalRequests: [], passed: false };
  let browser, page;
  try {
    const source = fs.readFileSync(repoPath('outputs/selected-airship-toon3d/airship.glb'));
    report.checks.originalSource = { bytes: source.length, sha256: sha(source), unchanged: sha(source) === SOURCE_SHA };
    check(report.checks.originalSource.unchanged, 'Original airship asset changed');
    const bytes = fs.readFileSync(assetPath);
    report.checks.asset = inspectAsset(bytes);
    report.checks.sourceTriangleFidelity = compareTriangleFidelity(source, bytes);
    browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    page.on('request', request => { if (/^https?:/.test(request.url())) report.externalRequests.push(request.url()); });
    await page.goto(pathToFileURL(viewerPath).href);
    await page.waitForFunction(() => window.__rigReady === true || window.__rigStats?.error, null, { timeout: 60000 });
    report.checks.initial = await page.evaluate(() => window.__rigStats);
    check(report.checks.initial.ready && !report.checks.initial.error, `Rig did not load: ${JSON.stringify(report.checks.initial)}`);
    report.checks.animation = await page.evaluate(({ profiles, expectedDurations }) => {
      const v = window.__rigViewer;
      for (const key of ['setMode', 'setProfile', 'setPlaying', 'setTime', 'reset', 'fit', 'setAutoRotate']) if (typeof v?.[key] !== 'function') throw new Error(`Missing viewer API ${key}`);
      if (!v.rig || !v.clips?.length || !v.mixer || !v.renderer || !v.scene || !v.camera || !v.controls) throw new Error('Incomplete rig viewer API');
      v.setPlaying(false); v.setAutoRotate(false); v.controls.enableDamping = false;
      const meshes = [], nodes = [];
      v.rig.traverse(object => { nodes.push(object); if (object.isMesh) meshes.push(object); });
      const textures = []; const seenTextures = new Set();
      for (const mesh of meshes) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const texture = material.map;
        if (texture && !seenTextures.has(texture.uuid)) { const image = texture.source?.data || texture.image; if (!(image?.width > 0 && image?.height > 0)) throw new Error('Embedded painted texture is not decoded'); seenTextures.add(texture.uuid); textures.push({ width: image.width, height: image.height }); }
      }
      if (!textures.length) throw new Error('Painted source texture is missing');
      const baselineEdges = new Map(); let minOriginalEdgeRatio = 1, maxOriginalEdgeRatio = 1;
      const sample = full => {
        v.scene.updateMatrixWorld(true);
        meshes.forEach(mesh => mesh.skeleton?.update());
        const positions = [], min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (const mesh of meshes) {
          const count = mesh.geometry.attributes.position.count;
          const stride = full ? 1 : Math.max(1, Math.floor(count / 384));
          const vertex = mesh.position.clone(), vertices = [];
          for (let index = 0; index < count; index += stride) {
            mesh.getVertexPosition(index, vertex); vertex.applyMatrix4(mesh.matrixWorld);
            const p = vertex.toArray();
            if (!p.every(Number.isFinite)) throw new Error(`Non-finite skinned vertex ${mesh.name}/${index}`);
            p.forEach((value, i) => { min[i] = Math.min(min[i], value); max[i] = Math.max(max[i], value); });
            positions.push(...p); if (full) vertices.push(p);
          }
          if (full && !/^WovenCable_/i.test(mesh.name)) {
            const indices = mesh.geometry.index?.array || Array.from({ length: count }, (_, i) => i), edges = [];
            for (let i = 0; i < indices.length; i += 3) for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) { const p = vertices[indices[i + a]], q = vertices[indices[i + b]]; edges.push(Math.hypot(...p.map((value, component) => value - q[component]))); }
            if (!baselineEdges.has(mesh.uuid)) baselineEdges.set(mesh.uuid, edges);
            else { const base = baselineEdges.get(mesh.uuid); edges.forEach((value, i) => { if (base[i] > 1e-6) { const ratio = value / base[i]; minOriginalEdgeRatio = Math.min(minOriginalEdgeRatio, ratio); maxOriginalEdgeRatio = Math.max(maxOriginalEdgeRatio, ratio); } }); }
          }
        }
        return { positions, min, max, span: max.map((value, i) => value - min[i]), nodes: nodes.map(node => ({ name: node.name, position: node.position.toArray(), quaternion: node.quaternion.toArray(), scale: node.scale.toArray() })) };
      };
      v.setProfile(profiles[0]); v.setTime(0);
      const baseline = sample(true), longest = Math.max(...baseline.span);
      const results = [], moving = new Set();
      for (const name of profiles) {
        const clip = v.clips.find(clip => clip.name === name);
        if (!clip || Math.abs(clip.duration - expectedDurations[name]) > 1e-4) throw new Error(`Clip duration mismatch ${name}`);
        v.setProfile(name); v.setTime(0);
        const start = sample(false);
        let maxSpanRatio = 0, maxVertexMovement = 0, samples = 0;
        for (let step = 0; step <= 24; step++) {
          v.setTime(clip.duration * step / 24);
          const state = sample(step % 6 === 0);
          maxSpanRatio = Math.max(maxSpanRatio, Math.max(...state.span) / longest);
          if (Math.max(...state.span) > longest * 2.2) throw new Error(`Exploding mesh bounds in ${name} at ${step}/24`);
          if (step % 6 !== 0) {
            state.positions.forEach((value, i) => { maxVertexMovement = Math.max(maxVertexMovement, Math.abs(value - start.positions[i])); });
          }
          state.nodes.forEach((node, i) => {
            const before = start.nodes[i];
            if (Math.max(...node.position.map((value, j) => Math.abs(value - before.position[j])), ...node.quaternion.map((value, j) => Math.abs(value - before.quaternion[j])), ...node.scale.map((value, j) => Math.abs(value - before.scale[j]))) > 1e-5) moving.add(node.name);
          });
          samples++;
        }
        if (!(maxVertexMovement > longest * 0.0001)) throw new Error(`Clip ${name} does not move the actual mesh`);
        results.push({ name, duration: clip.duration, samples, fullVertexFrames: 5, maxSpanRatio, maxVertexMovement });
      }
      if (minOriginalEdgeRatio < 0.5 || maxOriginalEdgeRatio > 1.5) throw new Error(`Original triangle edges stretch/collapse: ${minOriginalEdgeRatio} to ${maxOriginalEdgeRatio}`);
      // Re-entering an action at a fixed local time must not retain another action's weights.
      v.setProfile(profiles[0]); v.setTime(0.71); const first = sample(false).positions;
      v.setProfile(profiles[1]); v.setTime(0.31);
      v.setProfile(profiles[0]); v.setTime(0.71); const second = sample(false).positions;
      const transitionRepeatError = Math.max(...first.map((value, i) => Math.abs(value - second[i])));
      if (transitionRepeatError > 1e-6) throw new Error(`Profile transition retains motion: ${transitionRepeatError}`);
      const categoryPatterns = { propeller: /propeller/i, turret: /turret|cannon/i, gunRecoil: /gunrecoil/i, winch: /winch|hook/i };
      const mechanisms = Object.fromEntries(Object.entries(categoryPatterns).map(([category, pattern]) => [category, [...moving].filter(name => pattern.test(name))]));
      for (const [category, names] of Object.entries(mechanisms)) if (!names.length) throw new Error(`No ${category} node motion observed`);
      return { results, textures, skinnedMeshCount: meshes.filter(mesh => mesh.isSkinnedMesh).length, meshCount: meshes.length, movingNodes: [...moving], mechanisms, minOriginalEdgeRatio, maxOriginalEdgeRatio, transitionRepeatError };
    }, { profiles: PROFILES, expectedDurations: Object.fromEntries(report.checks.asset.animations.map(clip => [clip.name, clip.duration])) });
    const frames = async count => page.evaluate(count => new Promise(resolve => { const tick = () => { if (--count <= 0) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }), count);
    report.checks.profileUI = [];
    for (const profile of PROFILES) {
      await page.locator(`[data-profile="${profile}"]`).click(); await frames(2);
      const state = await page.evaluate(() => ({ profile: window.__rigStats.currentProfile || window.__rigStats.profile, duration: window.__rigStats.duration }));
      check(state.profile === profile, `Profile UI did not activate ${profile}`);
      report.checks.profileUI.push(state);
    }
    await page.evaluate(() => { window.__rigViewer.setPlaying(false); window.__rigViewer.setTime(1.5); });
    await page.locator('#play').click(); check(await page.evaluate(() => window.__rigStats.playing) === true, 'Play UI did not start playback');
    await page.locator('#play').click(); check(await page.evaluate(() => window.__rigStats.playing) === false, 'Play UI did not pause playback');
    await page.locator('#timeline').evaluate(input => { input.value = String(Number(input.min || 0) + (Number(input.max) - Number(input.min || 0)) * 0.4); input.dispatchEvent(new Event('input', { bubbles: true })); });
    const scrubbed = await page.evaluate(() => ({ time: window.__rigStats.time, duration: window.__rigStats.duration, playing: window.__rigStats.playing }));
    check(scrubbed.time > 0 && scrubbed.time < scrubbed.duration && scrubbed.playing === false, 'Timeline UI did not scrub/pause the clip');
    await page.locator('#skeleton').check(); await frames(2);
    check(await page.evaluate(() => window.__rigStats.skeletonVisible) === true, 'Skeleton UI did not activate');
    await page.screenshot({ path: path.join(reportDir, 'qa-skeleton.png'), fullPage: true });
    await page.locator('#skeleton').uncheck();
    report.checks.motionControls = { playPause: true, timeline: scrubbed, skeleton: true };
    report.checks.modes = [];
    for (const mode of ['handdrawn', 'cel', 'original']) {
      await page.locator(`[data-mode="${mode}"]`).click();
      await frames(3);
      const state = await page.evaluate(() => ({ mode: window.__rigStats.mode, outlineAutoClear: window.__rigViewer.outlineEffect?.autoClear ?? window.__rigStats.outlineAutoClear }));
      check(state.mode === mode, `Mode UI did not update to ${mode}`);
      check(state.outlineAutoClear === true, 'OutlineEffect.autoClear must explicitly remain true');
      await page.screenshot({ path: path.join(reportDir, `qa-${mode}.png`), fullPage: true });
      report.checks.modes.push(state);
    }
    report.checks.playback = await page.evaluate(async () => {
      const v = window.__rigViewer;
      const frames = count => new Promise(resolve => { const tick = () => { if (--count <= 0) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      const pose = () => { const result = []; v.rig.traverse(node => result.push(...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray())); return result; };
      v.setPlaying(false); v.setProfile('Cruise'); v.setTime(0.21);
      const before = pose(); await frames(8); const paused = pose();
      v.setPlaying(true); await frames(8); const playing = pose();
      v.setPlaying(false);
      return { pausedMaxDelta: Math.max(...before.map((value, i) => Math.abs(value - paused[i]))), playingMaxDelta: Math.max(...playing.map((value, i) => Math.abs(value - paused[i]))) };
    });
    check(report.checks.playback.pausedMaxDelta < 1e-9 && report.checks.playback.playingMaxDelta > 1e-7, 'Playback/pause did not control actual rig motion');
    report.checks.rotorTransitions = await page.evaluate(async () => {
      const v = window.__rigViewer, rotor = v.rig.getObjectByName('PropellerSpin'), results = [];
      v.setPlaying(false); v.setProfile('FloatIdle'); v.setTime(0.73); v.setPlaying(true);
      for (const profile of ['Cruise', 'WinchCycle', 'FireBurst']) {
        let previous = rotor.quaternion.toArray(), previousTime = performance.now(), previousMixerTime = v.mixer.time;
        let reverseFrames = 0, overspeedFrames = 0, minStep = Infinity, maxStep = 0, maxObservedRate = 0;
        v.setProfile(profile);
        const started = previousTime;
        await new Promise(resolve => {
          let count = 0;
          const tick = time => {
            const current = rotor.quaternion.toArray(), dt = v.mixer.time - previousMixerTime;
            const [x, y, z, w] = previous, [X, Y, Z, W] = current;
            let dx = w * X - x * W - y * Z + z * Y, dw = w * W + x * X + y * Y + z * Z;
            if (dw < 0) { dx = -dx; dw = -dw; }
            const step = 2 * Math.atan2(dx, dw);
            // All authored profiles spin forward at 2–4 revolutions/second.
            // Mixer.time provides the actual animation step, independent of render
            // scheduling or GPU latency. This catches phase jumps
            // and quaternion blending reversals without assuming a frame rate.
            if (step < -1e-4) reverseFrames++;
            if (dt > 0 && step > 8 * Math.PI * Math.min(dt, .1) + .015) overspeedFrames++;
            if (dt > 1e-5) maxObservedRate = Math.max(maxObservedRate, step / dt);
            minStep = Math.min(minStep, step); maxStep = Math.max(maxStep, step);
            previous = current; previousTime = time; previousMixerTime = v.mixer.time;
            if (++count >= 75) resolve(); else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        results.push({ profile, samples: 75, elapsedSeconds: (previousTime - started) / 1000, reverseFrames, overspeedFrames, minStep, maxStep, maxObservedRate });
      }
      v.setPlaying(false);
      return results;
    });
    check(report.checks.rotorTransitions.every(result => result.reverseFrames === 0 && result.overspeedFrames === 0 && result.maxStep > 1e-4), 'Propeller profile transition reverses or jumps');
    report.checks.ghosting = [];
    for (const mode of ['handdrawn', 'cel', 'original']) {
      const result = await page.evaluate(async mode => {
        const v = window.__rigViewer;
        const frames = count => new Promise(resolve => { const tick = () => { if (--count <= 0) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
        const capture = () => { const source = v.renderer.domElement, canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height; const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height).data; };
        v.setMode(mode); v.setProfile('Cruise'); v.setPlaying(true); v.controls.enableDamping = false; v.controls.autoRotateSpeed = 18; v.setAutoRotate(true);
        await frames(120); v.setPlaying(false); v.setAutoRotate(false); await frames(4);
        const cameraBefore = v.camera.matrixWorld.toArray(), before = capture();
        let visiblePixels = 0; const colors = new Set();
        for (let i = 0; i < before.length; i += 4) { if (before[i + 3] > 0) visiblePixels++; if (colors.size < 100) colors.add(`${before[i]},${before[i + 1]},${before[i + 2]},${before[i + 3]}`); }
        if (visiblePixels < 500 || colors.size < 16) throw new Error('Ghosting comparison has no visible rendered ship');
        v.renderer.clear(true, true, true); await frames(3); const after = capture();
        let changedPixels = 0, totalChannelDifference = 0;
        for (let i = 0; i < before.length; i += 4) { let changed = false; for (let c = 0; c < 4; c++) { const d = Math.abs(before[i + c] - after[i + c]); totalChannelDifference += d; if (d) changed = true; } if (changed) changedPixels++; }
        const cameraDelta = Math.max(...cameraBefore.map((value, i) => Math.abs(value - v.camera.matrixWorld.elements[i])));
        return { mode, rotationFrames: 120, changedPixels, totalChannelDifference, cameraDelta, visiblePixels, colorsAtLeast: colors.size, pixelCount: before.length / 4 };
      }, mode);
      report.checks.ghosting.push(result);
      await page.screenshot({ path: path.join(reportDir, `qa-ghosting-${mode}.png`) });
      check(result.changedPixels === 0 && result.cameraDelta < 1e-8, `Paused frame leaves a ghost trail in ${mode}`);
    }
    await page.evaluate(() => { const v = window.__rigViewer; v.reset(); v.controls.enableDamping = false; });
    const canvas = page.locator('canvas').first(), rect = await canvas.boundingBox();
    const beforeDrag = await page.evaluate(() => window.__rigViewer.camera.position.toArray());
    await page.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.5); await page.mouse.down(); await page.mouse.move(rect.x + rect.width * 0.6, rect.y + rect.height * 0.54, { steps: 8 }); await page.mouse.up(); await frames(3);
    const afterDrag = await page.evaluate(() => window.__rigViewer.camera.position.toArray());
    check(distance(beforeDrag, afterDrag) > 0.001, 'Pointer drag did not rotate camera');
    const beforeZoom = await page.evaluate(() => window.__rigViewer.camera.zoom);
    await page.mouse.wheel(0, -160); await frames(3);
    const afterZoom = await page.evaluate(() => window.__rigViewer.camera.zoom);
    check(Math.abs(beforeZoom - afterZoom) > 1e-5, 'Wheel did not zoom camera');
    report.checks.controls = { dragRotate: true, wheelZoom: true };
    const downloadPromise = page.waitForEvent('download'); await page.locator('#download').click(); const download = await downloadPromise;
    const downloadPath = path.join(reportDir, 'qa-download.glb'); await download.saveAs(downloadPath);
    const downloaded = fs.readFileSync(downloadPath);
    check(sha(downloaded) === sha(bytes), 'Viewer download differs from the tested GLB');
    report.checks.download = { bytes: downloaded.length, sha256: sha(downloaded), exactMatch: true };
    if (await page.locator('#rotate').count()) {
      await page.locator('#rotate').click();
      check(await page.locator('#rotate').getAttribute('aria-pressed') === 'true', 'Auto rotate UI did not activate');
      await page.locator('#reset').click();
      check(await page.locator('#rotate').getAttribute('aria-pressed') === 'false', 'Reset did not stop auto rotate');
      await page.locator('#fit').click();
    }
    if (await page.locator('#outline').count()) {
      await page.locator('#outline').uncheck(); check(await page.evaluate(() => window.__rigStats.outlineEnabled) === false, 'Outline UI did not disable');
      await page.locator('#outline').check(); check(await page.evaluate(() => window.__rigStats.outlineEnabled) === true, 'Outline UI did not enable');
    }
    report.checks.responsive = [];
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport); await frames(5);
      const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > innerWidth, canvasWidth: document.querySelector('canvas').getBoundingClientRect().width, canvasHeight: document.querySelector('canvas').getBoundingClientRect().height }));
      check(!layout.overflow && layout.canvasWidth > 100 && layout.canvasHeight > 100, `Mobile canvas/overflow failure at ${viewport.width}x${viewport.height}`);
      report.checks.responsive.push(layout);
      await page.screenshot({ path: path.join(reportDir, `qa-mobile-${viewport.width}.png`), fullPage: true });
    }
    check(report.errors.length === 0 && report.externalRequests.length === 0, 'Browser errors or external network requests detected');
    // Recheck after all tests; source preservation is part of the deliverable.
    check(sha(fs.readFileSync(repoPath('outputs/selected-airship-toon3d/airship.glb'))) === SOURCE_SHA, 'Original source changed during QA');
    report.passed = true;
  } catch (error) {
    report.failure = error.stack || String(error);
    if (page) await page.screenshot({ path: path.join(reportDir, 'qa-failure.png'), fullPage: true }).catch(() => {});
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(reportDir, 'qa-result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, failure: report.failure, sourceUnchanged: report.checks.originalSource?.unchanged, asset: report.checks.asset && { triangles: report.checks.asset.triangleCount, joints: report.checks.asset.skins.map(skin => skin.jointCount), animations: report.checks.asset.animations.map(clip => clip.name) }, errors: report.errors, externalRequests: report.externalRequests, report: path.relative(repoPath('.'), path.join(reportDir, 'qa-result.json')) }, null, 2));
    if (!report.passed) process.exitCode = 1;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
