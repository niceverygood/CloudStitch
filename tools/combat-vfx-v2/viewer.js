import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

const DATA = __VFX_V2_DATA__;
const $ = id => document.getElementById(id);
const representativeIds = ['machine-gun-muzzle', 'smoke-puff', 'cannon-hit', 'flamethrower-stream', 'shield-pulse', 'repair-stitch'];
const stage = $('stage'), laneNames = ['v1', 'v2'], materials = new Set(), records = [], derived = new Map(), cache = new Map(), downloads = [];
const direction = new THREE.Vector3(-8, 5.5, -8).normalize();
const gradient = new THREE.DataTexture(new Uint8Array([82, 170, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.generateMipmaps = false; gradient.needsUpdate = true;
const stats = { ready: false, offline: true, selectedId: null, selectedKind: null, models: {}, currentTime: 0, duration: 0, playing: true, loop: true, speed: 1, mode: 'handdrawn', placementIsApproximate: true, placementScale: .2 };
let renderer, effect, camera, controls, lanes, active, ticket = 0, halfHeight = 2.4, time = 0, duration = 1, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, loop = true, speed = 1, mode = 'handdrawn', outlined = true, thickness = .65, last = performance.now(), ready = false, anchorMode = 'muzzle', focused = false;
const forwardCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
const bounds = new THREE.Box3(), target = new THREE.Vector3();
window.__vfxV2Ready = false; window.__vfxV2Stats = stats;
function bytes(asset) { const raw = atob(asset.base64); return Uint8Array.from(raw, c => c.charCodeAt(0)); }
function remember(root) {
  root.traverse(node => { if (!node.isMesh) return; records.push({ mesh: node, original: node.material }); for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material); });
}
function prepareRuntimeFades(root) {
  const fades = [];
  function visit(node, inherited) {
    const recipe = node.userData?.runtime_fade || inherited;
    if (node.isMesh && recipe) {
      // Opacity is a viewer feature, not an animated glTF material channel.
      // Clone for each mesh before recording display modes so one plume does
      // not change the opacity of another mesh that shared its GLB material.
      node.material = Array.isArray(node.material) ? node.material.map(material => material.clone()) : node.material.clone();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        material.userData.vfxBaseOpacity = material.opacity;
        material.transparent = true; material.depthWrite = false;
      }
      fades.push({ node, recipe });
    }
    for (const child of node.children) visit(child, recipe);
  }
  visit(root, null); return fades;
}
function applyRuntimeFades(model, seconds) {
  for (const { node, recipe } of model?.fades || []) {
    const start = Number(recipe.start) || 0, peak = Math.max(start, Number(recipe.peak) || 0), end = Math.max(peak, Number(recipe.end) || 0), maximum = Math.max(0, Math.min(1, Number(recipe.opacity ?? 1)));
    const amount = seconds < start || seconds >= end ? 0 : seconds < peak ? (seconds - start) / Math.max(peak - start, .00001) : (end - seconds) / Math.max(end - peak, .00001);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      material.opacity = (material.userData.vfxBaseOpacity ?? 1) * maximum * THREE.MathUtils.clamp(amount, 0, 1);
      material.transparent = true; material.depthWrite = false;
      // BackSide outline fills the whole silhouette when a transparent base
      // does not write depth. Keep painted translucent effects out of the
      // outline pass; retain outlines on the hull and opaque effect details.
      material.userData.outlineParameters = { ...(material.userData.outlineParameters || {}), alpha: material.opacity, visible: false };
    }
  }
}
function modelStats(source, gltf, asset) {
  let meshes = 0, triangles = 0; const textures = new Set();
  source.traverse(node => { if (!node.isMesh) return; meshes++; triangles += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3; for (const material of Array.isArray(node.material) ? node.material : [node.material]) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); });
  const textureList = [...textures].map(texture => { const image = texture.source?.data || texture.image; return { width: image?.width || 0, height: image?.height || 0, ready: Boolean(image && (image.width > 0 || image.data)) }; });
  if (!meshes || textureList.some(item => !item.ready)) throw new Error('메시 또는 텍스처를 읽을 수 없습니다: ' + asset.source);
  return { meshes, triangles: Math.round(triangles), textures: textureList, texturesReady: textureList.every(item => item.ready), clipCount: gltf.animations.length, trackCount: gltf.animations[0]?.tracks.length || 0, duration: gltf.animations[0]?.duration || 0, sourceBytes: asset.bytes, sha256: asset.sha256 };
}
async function parse(asset, key, animate = true) {
  if (cache.has(key)) return cache.get(key);
  const raw = bytes(asset), gltf = await new GLTFLoader().parseAsync(raw.buffer, '');
  const source = gltf.scene; source.updateMatrixWorld(true); const fades = prepareRuntimeFades(source); remember(source);
  const clip = gltf.animations[0], mixer = new THREE.AnimationMixer(source), action = clip && animate ? mixer.clipAction(clip) : null;
  if (action) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play(); mixer.setTime(0); }
  const value = { source, gltf, bytes: raw, clip, mixer, action, fades, duration: clip?.duration || 0, stats: { ...modelStats(source, gltf, asset), runtimeFadeMeshCount: fades.length } };
  stats.models[key] = value.stats; cache.set(key, value); return value;
}
function evaluate(model, seconds) {
  if (model?.action) { model.action.reset(); model.action.setLoop(THREE.LoopOnce, 1); model.action.clampWhenFinished = true; model.action.play(); model.mixer.setTime(Math.min(Math.max(seconds, 0), model.duration)); }
  applyRuntimeFades(model, seconds);
  model?.source.updateMatrixWorld(true);
}
function materialFor(original) {
  if (mode === 'original') return original;
  const key = original.uuid + ':' + mode;
  if (derived.has(key)) return derived.get(key);
  const common = { color: original.color?.clone() || new THREE.Color(0xffffff), map: original.map || null, alphaMap: original.alphaMap || null, opacity: original.userData.vfxBaseOpacity ?? original.opacity, transparent: original.transparent, alphaTest: original.alphaTest, side: original.side, vertexColors: original.vertexColors, depthWrite: original.depthWrite, depthTest: original.depthTest, toneMapped: false };
  const material = mode === 'cel' ? new THREE.MeshToonMaterial({ ...common, gradientMap: gradient }) : new THREE.MeshBasicMaterial(common);
  material.name = (original.name || 'material') + ' / ' + mode;
  if (original.userData.vfxBaseOpacity !== undefined) material.userData.vfxBaseOpacity = original.userData.vfxBaseOpacity;
  derived.set(key, material); return material;
}
function setMode(value) {
  if (!['handdrawn', 'cel', 'original'].includes(value)) return;
  mode = value; stats.mode = value;
  for (const record of records) record.mesh.material = Array.isArray(record.original) ? record.original.map(materialFor) : materialFor(record.original);
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  $('mode-note').textContent = { handdrawn: '텍스처의 붓결을 그대로', cel: '세 단계의 단순한 명암', original: 'GLB의 저장된 기본 재질' }[mode];
  if (active) for (const model of active.models) applyRuntimeFades(model, time);
  applyOutline();
}
function applyOutline() {
  const value = 2 * thickness / Math.max(stage.clientHeight, 1);
  for (const material of [...materials, ...derived.values()]) {
    const fading = material.userData.vfxBaseOpacity !== undefined;
    material.userData.outlineParameters = { thickness: value, color: [.07, .13, .13], visible: outlined && !fading && !(material.transparent && !material.depthWrite), alpha: fading ? material.opacity : 1, keepAlive: true };
  }
  stats.outline = outlined; stats.outlineAutoClear = effect?.autoClear === true; stats.translucentEffectsOutline = false;
}
function makeSupport() {
  const support = new THREE.Group(); support.name = 'Approximate external weapon mounting study';
  const wood = new THREE.MeshBasicMaterial({ color: 0xc69b66 }), teal = new THREE.MeshBasicMaterial({ color: 0x48776e });
  const plank = new THREE.Mesh(new THREE.BoxGeometry(.82, .08, .65), wood); plank.position.y = .39; support.add(plank);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.12, .1, .55), teal); arm.position.set(.2, .32, .35); support.add(arm);
  remember(support); return support;
}
function makeTarget() {
  const root = new THREE.Group(); root.name = 'Display-only wood contact surface; no collision';
  const wood = new THREE.MeshBasicMaterial({ color: 0xb98450 }), trim = new THREE.MeshBasicMaterial({ color: 0x46776f });
  for (let i = 0; i < 3; i++) { const plank = new THREE.Mesh(new THREE.BoxGeometry(.035, .26, .105), wood); plank.position.z = (i - 1) * .11; root.add(plank); }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.05, .04, .35), trim); bar.position.y = -.12; root.add(bar); remember(root); return root;
}
function normalize(source, length, base) {
  source.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(source), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3()), scale = length / Math.max(size.x, size.y, size.z);
  const root = new THREE.Group(), transform = new THREE.Group(); transform.scale.setScalar(scale); transform.position.copy(center).multiplyScalar(-scale); transform.add(source); root.add(transform); root.position.copy(base); return { root, scale, center, box, size };
}
function muzzlePoint(source, box, mortar = false) {
  const size = box.getSize(new THREE.Vector3()), points = []; source.updateMatrixWorld(true);
  source.traverse(node => { if (!node.isMesh) return; const p = node.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(node.matrixWorld); if (mortar ? v.y > box.max.y - size.y * .035 : v.x < box.min.x + size.x * .025) points.push(v); } });
  return points.length ? points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length) : new THREE.Vector3(box.min.x, box.getCenter(new THREE.Vector3()).y, box.getCenter(new THREE.Vector3()).z);
}
async function setWeapon(lane, id) {
  if (lane.weaponId === id) return;
  if (lane.weapon) lane.scene.remove(lane.weapon.root);
  const item = DATA.weapons.find(item => item.id === id) || DATA.weapons[0];
  const parsed = await parse(item.asset, lane.id + ':weapon:' + item.id);
  parsed.source.removeFromParent(); parsed.source.updateMatrixWorld(true);
  const sourceBox = new THREE.Box3().setFromObject(parsed.source), tip = muzzlePoint(parsed.source, sourceBox, item.id === '03-mortar');
  const value = normalize(parsed.source, .88, new THREE.Vector3(-1.72, .67, -1.1));
  value.root.position.y = .43 + value.size.y * value.scale / 2;
  lane.weapon = value; lane.weaponId = item.id; lane.scene.add(value.root);
  // The original weapon geometry is retained; source units and the guessed
  // tip are transformed together. This is not a validated engine socket.
  lane.muzzle = tip.sub(value.center).multiplyScalar(value.scale).add(value.root.position);
  lane.support.position.set(-1.72, 0, -1.1);
}
function placement(item, lane) {
  const wrapper = new THREE.Group(); wrapper.name = item.id + ' / shared approximate placement';
  const scale = item.placement_scale ?? .2; wrapper.scale.setScalar(scale);
  const useSocket = anchorMode === 'muzzle' && lane.rigMuzzle && item.kind !== 'sequence';
  lane.ship.root.visible = !useSocket; if (lane.rig) lane.rig.root.visible = Boolean(useSocket);
  lane.scene.updateMatrixWorld(true);
  const muzzle = useSocket ? lane.rigMuzzle.getWorldPosition(new THREE.Vector3()) : lane.muzzle || new THREE.Vector3(-2.15, .7, -1.1);
  lane.target.position.copy(muzzle).add(new THREE.Vector3(-.8, 0, 0)); lane.target.visible = false;
  const id = item.id;
  if (item.kind === 'sequence') {
    wrapper.scale.setScalar(item.placement_scale ?? .35); wrapper.rotation.y = -Math.PI / 2; wrapper.position.set(-1.3, .43, -1.1); lane.weapon.root.visible = false; lane.support.visible = false;
  } else {
    lane.weapon.root.visible = !useSocket; lane.support.visible = !useSocket;
    if (/shield|repair|heal|buff|armor-state|overheat|damage-state|engine|leak|mount-lock|cut|detach|salvage/.test(id)) {
      // +Y is the support/contact normal. The visible hull side is -Z;
      // +PI/2 pointed the smaller v2 strokes inward behind the hull surface.
      if (/shield|repair/.test(id)) wrapper.position.set(-1.15, .85, -1.13);
      else wrapper.position.set(-.5, .8, -1.03);
      wrapper.rotation.x = -Math.PI / 2;
    } else if (/hit|explosion|impact|ricochet|penetration/.test(id)) {
      wrapper.position.copy(lane.target.position); wrapper.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)); lane.target.visible = true;
    } else {
      wrapper.position.copy(muzzle);
      if (useSocket) {
        wrapper.quaternion.copy(lane.rigMuzzle.getWorldQuaternion(new THREE.Quaternion())).multiply(forwardCorrection); wrapper.userData.followMuzzle = true;
        // The provisional socket sits behind the model's raised wooden bow.
        // Keep the attachment root exactly on Muzzle and apply an explicit,
        // identical display clearance below it; never alter either GLB.
        if (/muzzle|launch|ignite/.test(id)) wrapper.userData.emitterClearanceWorld = item.emitter_clearance_world ?? .24;
      }
      else wrapper.rotation.y = -Math.PI / 2;
      if (/flame.*stream/.test(id)) { lane.target.visible = true; lane.target.position.copy(muzzle).add(new THREE.Vector3(-.7, 0, 0)); }
        if (/projectile/.test(id)) { lane.target.visible = true; lane.target.position.copy(muzzle).add(new THREE.Vector3(-4*scale,0,0)); }
        if (id === 'mortar-launch') wrapper.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0));
    }
  }
  return wrapper;
}
function attachSource(wrapper, source) {
  const emitter = new THREE.Group(); emitter.name = 'Shared display emitter clearance; GLB unchanged';
  emitter.position.z = (wrapper.userData.emitterClearanceWorld || 0) / wrapper.scale.z;
  emitter.add(source); wrapper.add(emitter); wrapper.userData.emitter = emitter;
}
function updateMuzzleAttachments() {
  for (const lane of lanes || []) {
    if (!lane.effectRoot?.userData.followMuzzle || !lane.rigMuzzle) continue;
    lane.rig.root.updateMatrixWorld(true);
    lane.effectRoot.position.copy(lane.rigMuzzle.getWorldPosition(new THREE.Vector3()));
    lane.effectRoot.quaternion.copy(lane.rigMuzzle.getWorldQuaternion(new THREE.Quaternion())).multiply(forwardCorrection);
    lane.effectRoot.updateMatrixWorld(true);
  }
  if (lanes) stats.anchors = lanes.map(lane => ({ lane: lane.id, mode: lane.effectRoot?.userData.followMuzzle ? 'actual-rig-Muzzle' : 'approximate-placement', node: lane.effectRoot?.userData.followMuzzle ? lane.rigMuzzle.name : null, worldPosition: lane.effectRoot?.position.toArray(), rawMuzzleWorldPosition: lane.effectRoot?.userData.followMuzzle ? lane.rigMuzzle.getWorldPosition(new THREE.Vector3()).toArray() : null, worldQuaternion: lane.effectRoot?.quaternion.toArray(), sharedScale: lane.effectRoot?.scale.toArray(), displayOffsetLocal: lane.effectRoot?.userData.emitter?.position.toArray(), displayEmitterClearanceWorld: lane.effectRoot?.userData.emitterClearanceWorld || 0, displayEmitterWorldPosition: lane.effectRoot?.userData.emitter?.getWorldPosition(new THREE.Vector3()).toArray() }));
}
function updatePlacementNote() {
  if (!active) return;
  const socket = anchorMode === 'muzzle' && active.item.kind !== 'sequence' && lanes.every(lane => lane.rigMuzzle);
  stats.anchor = socket ? 'rig-muzzle' : 'external-approximate';
  stats.placementIsApproximate = true; stats.provisionalSocket = Boolean(socket);
  $('anchor').value = socket ? 'muzzle' : 'external';
  const clearance = lanes[0].effectRoot?.userData.emitterClearanceWorld || 0;
  $('placement-note').textContent = socket ? `airship-rig-v1의 실제 Muzzle 노드·bind pose에 부착했습니다. +Z 효과 축을 소켓의 -X 전방에 맞춥니다.${clearance ? ` 임시 소켓 가림 방지 전방 ${clearance.toFixed(2)} 시연 보정을 양쪽에 동일하게 적용했습니다.` : ''} 임시 소켓이며 엔진 규격 검증은 별도입니다.` : active.item.kind === 'sequence' ? '실제 선체 옆에 무기와 표적이 포함된 합성 GLB를 배치했습니다. v1/v2는 같은 변환과 초 단위 시간을 공유합니다. 실제 충돌·장착 소켓이 아닙니다.' : '실제 선체와 독립 무기를 사용한 외부 받침 배치 시안입니다. 포구는 메시 끝점으로 추정한 근사 위치이며, 표적은 시각 비교용입니다.';
  if (!socket && active.item.kind !== 'sequence' && /shield|repair/.test(active.item.id)) $('placement-note').textContent = '선수 측면의 열린 목재판을 가정한 근사 시연 위치입니다. 윈치·갈고리와 겹치지 않도록 선체 바깥쪽에 표시하며, 실제 장착 소켓이나 피격 판정은 아닙니다. 양쪽은 같은 위치·회전·표시 배율을 사용합니다.';
}
function setAnchor(value) {
  anchorMode = value === 'muzzle' && lanes.every(lane => lane.rigMuzzle) ? 'muzzle' : 'external';
  if (active) for (let i = 0; i < lanes.length; i++) { const lane = lanes[i]; lane.scene.remove(lane.effectRoot); const wrapper = placement(active.item, lane); attachSource(wrapper, active.models[i].source); lane.effectRoot = wrapper; lane.scene.add(wrapper); }
  updatePlacementNote(); updateMuzzleAttachments(); render(true);
}
function sync() {
  $('timeline').value = String(time); $('time-value').value = `${time.toFixed(2)} / ${duration.toFixed(2)}초`;
  Object.assign(stats, { currentTime: time, time, duration, playing, loop, speed });
}
function setTime(value) { setPlaying(false); evaluateTime(value); }
function evaluateTime(value) { time = THREE.MathUtils.clamp(Number(value) || 0, 0, duration); if (active) for (const model of active.models) evaluate(model, time); updateMuzzleAttachments(); sync(); }
function setPlaying(value) { if (value && time >= duration) evaluateTime(0); playing = Boolean(value); $('play').textContent = playing ? '일시정지' : '재생'; $('play').setAttribute('aria-pressed', String(playing)); sync(); }
function setLoop(value) { loop = Boolean(value); $('loop').checked = loop; sync(); }
function setSpeed(value) { speed = THREE.MathUtils.clamp(Number(value) || 1, .1, 4); if (![...$('speed').options].some(option => Number(option.value) === speed)) $('speed').add(new Option(speed + '×', String(speed))); $('speed').value = String(speed); sync(); }
function setBackground(value) { const deep = value === true || value === 'deepteal'; stage.classList.toggle('deep', deep); $('background').textContent = deep ? '배경 · 짙은 청록' : '배경 · 크림'; $('background').setAttribute('aria-pressed', String(deep)); stats.background = deep ? 'deepteal' : 'cream'; }
function setAutoRotate(value) { controls.autoRotate = Boolean(value); $('rotate').setAttribute('aria-pressed', String(controls.autoRotate)); stats.autoRotate = controls.autoRotate; }
function resize() {
  const width = Math.max(stage.clientWidth, 2), height = Math.max(stage.clientHeight, 1); renderer.setSize(width, height, false);
  const aspect = width / 2 / height; camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix(); applyOutline();
}
function fit(resetCamera = false) {
  focused = false; stats.focus = 'ship'; $('focus').setAttribute('aria-pressed', 'false');
  bounds.makeEmpty();
  // Ship + weapon + a stable authored effect extent. Never independently fit
  // v1 and v2 or normalize their effects by their individual bounding boxes.
  for (const lane of lanes) { lane.scene.updateMatrixWorld(true); bounds.union(new THREE.Box3().setFromObject(lane.rig?.root.visible ? lane.rig.root : lane.ship.root)); if (lane.weapon?.root.visible) bounds.union(new THREE.Box3().setFromObject(lane.weapon.root)); }
  bounds.expandByPoint(new THREE.Vector3(-3.4, .1, -1.55)); bounds.expandByPoint(new THREE.Vector3(2.9, 2.85, 1)); bounds.getCenter(target);
  if (resetCamera) camera.position.copy(direction).multiplyScalar(14).add(target); else camera.position.add(target.clone().sub(controls.target));
  controls.target.copy(target); camera.lookAt(target); camera.updateMatrixWorld(true);
  const aspect = Math.max(stage.clientWidth / 2 / stage.clientHeight, .1); let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) { const p = new THREE.Vector3(x ? bounds.max.x : bounds.min.x, y ? bounds.max.y : bounds.min.y, z ? bounds.max.z : bounds.min.z).applyMatrix4(camera.matrixWorldInverse); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  halfHeight = Math.max((maxY - minY) / 2, (maxX - minX) / (2 * aspect)) * 1.1; camera.zoom = 1; resize(); controls.update();
}
function reset() { setAutoRotate(false); fit(true); }
function setFocus(value) {
  focused = value === true || value === 'effect';
  if (!focused || !active) { reset(); return; }
  setAutoRotate(false); updateMuzzleAttachments();
  const union = new THREE.Box3();
  for (const lane of lanes) { lane.effectRoot.updateMatrixWorld(true); union.union(new THREE.Box3().setFromObject(lane.effectRoot)); }
  const point = union.isEmpty() ? lanes[0].effectRoot.userData.emitter.getWorldPosition(new THREE.Vector3()) : union.getCenter(new THREE.Vector3());
  target.copy(point); camera.position.copy(direction).multiplyScalar(14).add(target); controls.target.copy(target); camera.lookAt(target); camera.updateMatrixWorld(true);
  halfHeight = active.item.kind === 'sequence' ? 1.25 : 1.1; camera.zoom = 1; resize(); controls.update();
  stats.focus = 'effect'; $('focus').setAttribute('aria-pressed', 'true'); render(true);
}
function render(clear = false) {
  if (!renderer || !lanes) return;
  updateMuzzleAttachments();
  const width = stage.clientWidth, height = stage.clientHeight, split = Math.floor(width / 2); renderer.setScissorTest(false);
  if (clear) renderer.clear(true, true, true);
  renderer.setScissorTest(true);
  for (let i = 0; i < 2; i++) { const x = i ? split : 0, w = i ? width - split : split; renderer.setViewport(x, 0, w, height); renderer.setScissor(x, 0, w, height); if (outlined) effect.render(lanes[i].scene, camera); else renderer.render(lanes[i].scene, camera); }
  renderer.setScissorTest(false);
}
function populate(scope) {
  const list = DATA.items.filter(item => scope === 'sequences' ? item.kind === 'sequence' : item.kind !== 'sequence' && (scope !== 'representatives' || representativeIds.includes(item.id)));
  list.sort((a, b) => scope === 'representatives' ? representativeIds.indexOf(a.id) - representativeIds.indexOf(b.id) : (a.order || 0) - (b.order || 0));
  $('effect-select').replaceChildren(...list.map(item => { const option = new Option((item.name_ko || item.id) + (item.available ? '' : ' · 제작 대기'), item.id); option.disabled = !item.available; return option; }));
  return list;
}
async function selectEffect(id) {
  const item = DATA.items.find(item => item.id === id && item.available); if (!item) return false;
  const current = ++ticket; ready = false; window.__vfxV2Ready = false; stats.ready = false; $('loading').hidden = false; $('loading').textContent = (item.name_ko || id) + ' · 실제 두 GLB를 준비하고 있습니다';
  const models = await Promise.all(lanes.map(lane => parse(item[lane.id], lane.id + ':effect:' + item.kind + ':' + id)));
  const weaponId = item.weapon_id || (id.includes('cannon') ? '02-deck-cannon' : id.includes('flame') ? '06-flamethrower' : '01-machine-gun');
  await Promise.all(lanes.map(lane => setWeapon(lane, weaponId)));
  if (current !== ticket) return false;
  anchorMode = id === 'machine-gun-muzzle' && lanes.every(lane => lane.rigMuzzle) ? 'muzzle' : 'external';
  for (let i = 0; i < 2; i++) { const lane = lanes[i]; if (lane.effectRoot) lane.scene.remove(lane.effectRoot); const wrapper = placement(item, lane); attachSource(wrapper, models[i].source); lane.effectRoot = wrapper; lane.scene.add(wrapper); }
  active = { item, models }; duration = Math.max(...models.map(model => model.duration), .001);
  updatePlacementNote();
  if (![...$('effect-select').options].some(option => option.value === id)) { $('scope').value = item.kind === 'sequence' ? 'sequences' : 'all'; populate($('scope').value); }
  $('effect-select').value = id; $('timeline').max = String(duration); $('effect-name').textContent = item.name_ko || id; $('purpose').textContent = item.purpose || '실제 비행선과 무기 위에서 실루엣과 시간 연출을 비교합니다.';
  $('model-stats').textContent = models.map((model, i) => `${laneNames[i]} · ${model.stats.triangles.toLocaleString('ko-KR')}삼각형 / ${model.stats.clipCount}클립 / ${model.duration.toFixed(2)}초`).join('   |   ');
  stats.placementScale = item.placement_scale ?? (item.kind === 'sequence' ? .35 : .2); $('scale-note').textContent = `공통 효과 배율 ${stats.placementScale.toFixed(2)} · 선체 길이 5.2`;
  for (const url of downloads.splice(0)) URL.revokeObjectURL(url);
  for (let i = 0; i < 2; i++) { const url = URL.createObjectURL(new Blob([models[i].bytes], { type: 'model/gltf-binary' })); downloads.push(url); $('download-' + laneNames[i]).href = url; $('download-' + laneNames[i]).download = id + '-' + laneNames[i] + '.glb'; }
  Object.assign(stats, { selectedId: id, selectedKind: item.kind, lanes: models.map((model, i) => ({ lane: laneNames[i], ...model.stats })), error: null });
  setMode(mode); evaluateTime(0); reset(); await Promise.all(lanes.map(lane => renderer.compileAsync(lane.scene, camera)));
  if (current !== ticket) return false;
  ready = true; stats.ready = true; window.__vfxV2Ready = true; $('loading').hidden = true; setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches); render(true); return true;
}
function step(delta) { if (!playing || !ready) return; const next = time + Math.max(0, Number(delta) || 0) * speed; if (next >= duration) { if (loop) evaluateTime(next % duration); else { evaluateTime(duration); setPlaying(false); } } else evaluateTime(next); }
function fail(error) { ready = false; stats.ready = false; stats.error = String(error.message || error); window.__vfxV2Ready = false; $('loading').hidden = false; $('loading').textContent = '비교 장면을 열지 못했습니다. ' + stats.error; console.error(error); }
async function initialize() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0, 0); renderer.autoClear = true; renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', 'v1과 v2의 동기화된 3D 비교. 드래그 회전, 휠 확대.'); stage.prepend(renderer.domElement);
  camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .01, 100); camera.position.copy(direction).multiplyScalar(14);
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .085; controls.minZoom = .35; controls.maxZoom = 7; controls.autoRotateSpeed = .6; controls.screenSpacePanning = true;
  effect = new OutlineEffect(renderer, { defaultThickness: .001, defaultColor: [.07, .13, .13], defaultKeepAlive: true });
  // OutlineEffect changes renderer.autoClear. Its own autoClear must be true;
  // each scissored half is cleared before drawing its current moving frame.
  effect.autoClear = true;
  lanes = await Promise.all(laneNames.map(async id => {
    const scene = new THREE.Scene(), shipModel = await parse(DATA.ship, id + ':ship'), ship = normalize(shipModel.source, 5.2, new THREE.Vector3(0, 1.35, 0));
    const ambient = new THREE.AmbientLight(0xfff7e7, 1.3), key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-4, 8, -5); scene.add(ambient, key, ship.root);
    let rig = null, rigMuzzle = null;
    if (DATA.rig) {
      const model = await parse(DATA.rig, id + ':rig', false); rig = normalize(model.source, 5.2, new THREE.Vector3(0, 1.35, 0));
      rigMuzzle = model.source.getObjectByName('Muzzle'); rig.root.visible = false; scene.add(rig.root);
    }
    const support = makeSupport(), contact = makeTarget(); scene.add(support, contact); return { id, scene, ship, rig, rigMuzzle, support, target: contact, weaponId: null, weapon: null, effectRoot: null };
  }));
  const controlsAPI = { selectEffect, select: selectEffect, setTime, evaluateTime, setPlaying, setLoop, setSpeed, setMode, setBackground, setAnchor, setFocus, focusEffect: () => setFocus(true), reset, fit: () => fit(false), setAutoRotate, render, renderClean: () => render(true), step, frameAdvance: (delta = 1 / 60) => { const next = time + Math.max(0, Number(delta) || 0); evaluateTime(loop && next >= duration ? next % duration : Math.min(next, duration)); render(); }, setOutline: value => { outlined = Boolean(value); $('outline').checked = outlined; applyOutline(); }, renderer, camera, controls, effect, scenes: lanes.map(lane => lane.scene), lanes, stats,
    get root() { return lanes[1]?.effectRoot; }, get roots() { return lanes.map(lane => lane.effectRoot); }, get selected() { return active?.item; }, get models() { return active?.models; }, get currentTime() { return time; }, get duration() { return duration; }, get ready() { return ready; }, availableItems: DATA.items.filter(item => item.available).map(({ v1, v2, ...metadata }) => metadata) };
  window.__vfxV2 = controlsAPI;
  $('count').textContent = `${DATA.items.filter(item => item.available && item.kind !== 'sequence').length} / 48개 효과 · ${DATA.items.filter(item => item.available && item.kind === 'sequence').length} / 6개 공격 시연`;
  if(DATA.reviewBatch){$('batch-note').hidden=false;$('batch-note').textContent='검수 묶음 · '+DATA.reviewBatch.title+' · 새 렌더 확인 전';}
  $('scope').querySelector('option[value="sequences"]').disabled = !DATA.items.some(item => item.available && item.kind === 'sequence');
  $('anchor').querySelector('option[value="muzzle"]').disabled = !lanes.every(lane => lane.rigMuzzle);
  $('anchor').addEventListener('change', () => setAnchor($('anchor').value));
  $('focus').addEventListener('click', () => setFocus(!focused));
  $('scope').addEventListener('change', () => { const list = populate($('scope').value), first = list.find(item => item.available); if (first) selectEffect(first.id).catch(fail); });
  $('effect-select').addEventListener('change', () => selectEffect($('effect-select').value).catch(fail));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $('play').addEventListener('click', () => setPlaying(!playing)); $('replay').addEventListener('click', () => { evaluateTime(0); setPlaying(true); }); $('timeline').addEventListener('input', () => setTime($('timeline').value)); $('loop').addEventListener('change', () => setLoop($('loop').checked)); $('speed').addEventListener('change', () => setSpeed($('speed').value));
  $('outline').addEventListener('change', () => controlsAPI.setOutline($('outline').checked)); $('thickness').addEventListener('input', () => { thickness = Number($('thickness').value); applyOutline(); }); $('background').addEventListener('click', () => setBackground(stats.background !== 'deepteal')); $('reset').addEventListener('click', reset); $('fit').addEventListener('click', () => fit(false)); $('rotate').addEventListener('click', () => setAutoRotate(!controls.autoRotate));
  new ResizeObserver(() => { resize(); render(true); }).observe(stage);
  const first = DATA.items.find(item => item.available && item.id === new URLSearchParams(location.search).get('effect')) || DATA.items.find(item => item.available && representativeIds.includes(item.id)) || DATA.items.find(item => item.available);
  const initialScope=DATA.reviewBatch?(first.kind==='sequence'?'sequences':'all'):'representatives';$('scope').value=initialScope;populate(initialScope); setBackground(false); await selectEffect(first.id);
  function animate(now) { requestAnimationFrame(animate); const delta = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now; step(delta); controls.update(delta); render(); }
  requestAnimationFrame(animate); window.addEventListener('beforeunload', () => downloads.forEach(url => URL.revokeObjectURL(url)), { once: true });
}
initialize().catch(fail);
