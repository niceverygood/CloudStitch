import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

// Build embeds only actual completed GLBs. No fetch, server, CDN or API is needed.
const DATA = __WORKBENCH_DATA__;
const $ = id => document.getElementById(id);
const stage = $('stage');
const records = [], materials = new Set(), derived = new Map(), loaded = new Map();
const descriptions = {
  handdrawn: ['손그림', '빛 반사 없이 텍스처의 색과 선을 편안하게 보여줍니다.'],
  cel: ['셀 명암', '세 단계의 명암과 읽기 쉬운 윤곽으로 입체감을 표현합니다.'],
  original: ['원본 재질', 'GLB에 저장된 원본 재질을 조명 아래에서 확인합니다.'],
};
const direction = new THREE.Vector3(-7, 5.5, -7).normalize();
const gradient = new THREE.DataTexture(new Uint8Array([70, 155, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
gradient.generateMipmaps = false;
gradient.needsUpdate = true;
let renderer, effect, camera, controls, scene, ambient, key, fill, ship, support;
let selected = null, active = null, mode = 'handdrawn', mounted = false;
let outline = true, thickness = 1.2, halfHeight = 1.4, yaw = 0, mountScale = 1, loadTicket = 0;
let target = new THREE.Vector3(), bounds = new THREE.Box3(), lastFrame = performance.now();
let downloadURL = null;
window.__weaponReady = false;
window.__weaponStats = { ready: false, offline: true, mode, models: {}, selectedId: null, mounted: false };

function fail(error) {
  window.__weaponReady = false;
  window.__weaponStats.ready = false;
  window.__weaponStats.error = String(error?.message || error);
  $('loading').hidden = false;
  $('loading').classList.add('error');
  $('loading-text').textContent = '모델을 표시하지 못했습니다. ' + window.__weaponStats.error;
  console.error(error);
}
function decode(asset) {
  const raw = atob(asset.base64), bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}
function recordMesh(mesh) {
  records.push({ mesh, original: mesh.material });
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
}
async function parseAsset(asset, id) {
  if (loaded.has(id)) return loaded.get(id);
  const bytes = decode(asset);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  const source = gltf.scene;
  if (!source) throw new Error(id + ': GLB에 표시할 장면이 없습니다.');
  source.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(source);
  if (box.isEmpty()) throw new Error(id + ': GLB에 표시할 메시가 없습니다.');
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z, 0.00001);
  const root = new THREE.Group(), normalization = new THREE.Group();
  normalization.scale.setScalar(1 / longest);
  normalization.position.copy(center).multiplyScalar(-1 / longest);
  normalization.add(source);
  root.add(normalization);
  root.name = id + ' / display transform only (original GLB unchanged)';
  let meshCount = 0, triangles = 0;
  const textures = new Set(), sourceMaterials = new Set();
  source.traverse(object => {
    if (!object.isMesh) return;
    meshCount++;
    triangles += (object.geometry.index?.count || object.geometry.attributes.position?.count || 0) / 3;
    recordMesh(object);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      sourceMaterials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  if (!meshCount) throw new Error(id + ': 메시가 없습니다.');
  const textureInfo = Array.from(textures, texture => {
    const image = texture.source?.data || texture.image;
    return { name: texture.name, width: image?.width || 0, height: image?.height || 0, ready: Boolean(image && (image.width > 0 || image.data)) };
  });
  if (textureInfo.some(texture => !texture.ready)) throw new Error(id + ': 텍스처 디코딩이 완료되지 않았습니다.');
  const result = { root, bytes, stats: { sourceBytes: bytes.length, meshCount, triangleCount: Math.round(triangles), materialCount: sourceMaterials.size, textureCount: textures.size, texturesReady: textureInfo.every(texture => texture.ready), textures: textureInfo, animationClipCount: gltf.animations.length, originalBounds: { min: box.min.toArray(), max: box.max.toArray() } } };
  loaded.set(id, result);
  window.__weaponStats.models[id] = result.stats;
  return result;
}
function materialFor(source) {
  if (mode === 'original') return source;
  const cacheKey = source.uuid + ':' + mode;
  if (derived.has(cacheKey)) return derived.get(cacheKey);
  const common = {
    color: source.color?.clone() || new THREE.Color(0xffffff), map: source.map || null,
    alphaMap: source.alphaMap || null, opacity: source.opacity, transparent: source.transparent,
    alphaTest: source.alphaTest, side: source.side, vertexColors: source.vertexColors,
    depthWrite: source.depthWrite, depthTest: source.depthTest, visible: source.visible, toneMapped: false,
  };
  const material = mode === 'cel' ? new THREE.MeshToonMaterial({ ...common, gradientMap: gradient }) : new THREE.MeshBasicMaterial(common);
  material.name = (source.name || 'material') + ' / ' + mode;
  derived.set(cacheKey, material);
  return material;
}
function applyOutline() {
  const value = 2 * thickness / Math.max(stage.clientHeight, 1);
  for (const material of [...materials, ...derived.values()]) material.userData.outlineParameters = { thickness: value, color: [0.015, 0.025, 0.022], alpha: 1, visible: outline, keepAlive: true };
  Object.assign(window.__weaponStats, { outlineEnabled: outline, outlinePixels: thickness });
}
function setMode(value) {
  if (!(value in descriptions)) return;
  mode = value;
  ambient.intensity = mode === 'cel' ? .18 : 1.05;
  key.intensity = mode === 'cel' ? .92 : 2.1;
  fill.intensity = mode === 'cel' ? .08 : .45;
  for (const record of records) record.mesh.material = Array.isArray(record.original) ? record.original.map(materialFor) : materialFor(record.original);
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  $('mode-title').textContent = descriptions[mode][0];
  $('mode-description').textContent = descriptions[mode][1];
  window.__weaponStats.mode = mode;
  applyOutline();
}
function resize() {
  const width = Math.max(stage.clientWidth, 1), height = Math.max(stage.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.left = -halfHeight * width / height;
  camera.right = halfHeight * width / height;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  applyOutline();
}
function refreshBounds() {
  if (!active) return;
  scene.updateMatrixWorld(true);
  bounds.setFromObject(active.root);
  if (mounted && ship) bounds.union(new THREE.Box3().setFromObject(ship.root)).union(new THREE.Box3().setFromObject(support));
  bounds.getCenter(target);
}
function fitView(reset = false) {
  if (!active) return;
  refreshBounds();
  if (reset) camera.position.copy(direction).multiplyScalar(12).add(target);
  else camera.position.add(target.clone().sub(controls.target));
  controls.target.copy(target);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  const aspect = Math.max(stage.clientWidth / stage.clientHeight, .1);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) {
    const corner = new THREE.Vector3(x ? bounds.max.x : bounds.min.x, y ? bounds.max.y : bounds.min.y, z ? bounds.max.z : bounds.min.z).applyMatrix4(camera.matrixWorldInverse);
    minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
    minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
  }
  halfHeight = Math.max((maxY - minY) / 2, (maxX - minX) / (2 * aspect), .1) * 1.32;
  camera.zoom = 1;
  resize();
  controls.update();
}
function setAutoRotate(value) {
  controls.autoRotate = Boolean(value);
  $('rotate').setAttribute('aria-pressed', String(controls.autoRotate));
  window.__weaponStats.autoRotate = controls.autoRotate;
}
function makeSupport() {
  const root = new THREE.Group();
  root.name = 'Illustrative outboard mount, not an engine-ready socket';
  const wood = new THREE.MeshStandardMaterial({ color: 0xc58d50, roughness: 1, metalness: 0 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x58857a, roughness: 1, metalness: 0 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xcda04e, roughness: 1, metalness: 0 });
  const add = (geometry, material, position) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    root.add(mesh);
    recordMesh(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(.77, .075, .59), wood, [0, 0, 0]);
  add(new THREE.BoxGeometry(.78, .018, .036), teal, [0, .045, -.27]);
  add(new THREE.BoxGeometry(.78, .018, .036), teal, [0, .045, .27]);
  add(new THREE.BoxGeometry(.055, .045, .60), brass, [-.31, .017, 0]);
  add(new THREE.BoxGeometry(.055, .045, .60), brass, [.31, .017, 0]);
  for (const x of [-.27, .27]) {
    const brace = add(new THREE.BoxGeometry(.05, .055, .72), teal, [x, -.15, .2]);
    brace.rotation.x = -.45;
    add(new THREE.CylinderGeometry(.036, .036, .025, 8), brass, [x, .06, -.2]);
  }
  return root;
}
function eulerDegrees(value) {
  return (Array.isArray(value) ? value : [0, 0, 0]).map(number => THREE.MathUtils.degToRad(Number(number) || 0));
}
function positionWeapon() {
  if (!active) return;
  const item = selected;
  const rotation = eulerDegrees(mounted ? item.mount_rotation || item.display_rotation : item.display_rotation);
  active.root.rotation.set(...rotation);
  if (mounted) active.root.rotation.y += THREE.MathUtils.degToRad(yaw);
  active.root.position.set(0, 0, 0);
  active.root.scale.setScalar(mounted ? (Number(item.mount_length) || .65) * (Number(item.mount_scale) || 1) * mountScale : 1.8);
  if (ship) ship.root.visible = mounted;
  support.visible = mounted && Boolean(ship);
  if (mounted && ship) {
    const box = new THREE.Box3().setFromObject(ship.root), size = box.getSize(new THREE.Vector3());
    const base = Array.isArray(item.mount_position) && item.mount_position.length === 3 ? new THREE.Vector3(...item.mount_position) : new THREE.Vector3(box.min.x + size.x * .65, box.min.y + size.y * .18, box.min.z - .30);
    support.position.copy(base);
    active.root.updateMatrixWorld(true);
    const weaponBox = new THREE.Box3().setFromObject(active.root);
    active.root.position.set(base.x, base.y + .075 - weaponBox.min.y, base.z);
  }
  $('mounted').checked = mounted;
  $('mount-controls').hidden = !mounted;
  $('stage-description').textContent = mounted ? '기존 비행선 옆 임시 지지대에서 크기와 배치를 비교합니다' : '따뜻한 목재 · 청록색 기계 · 황동 장식';
  $('mount-note').textContent = mounted ? '장착 위치 시안입니다. 원본 비행선의 기존 포는 보존했습니다. 지지대와 크기는 비교용이며, 최종 소켓·물리·부품 분리·피벗은 후속 작업입니다.' : '독립 무기 원형입니다. 게임용 부품 분리·피벗·장착 소켓·발사 동작은 후속 작업입니다.';
  Object.assign(window.__weaponStats, { mounted, yawDegrees: yaw, mountScale, placementPreviewOnly: mounted });
}
function setMounted(value) {
  mounted = Boolean(value && ship);
  positionWeapon();
  fitView(true);
}
async function selectWeapon(id) {
  const item = DATA.items.find(candidate => candidate.id === id && candidate.available);
  if (!item) return false;
  const ticket = ++loadTicket;
  window.__weaponReady = false;
  window.__weaponStats.ready = false;
  $('loading').hidden = false;
  $('loading').classList.remove('error');
  $('loading-text').textContent = (item.name_ko || item.id) + ' 모델과 텍스처를 준비하고 있습니다';
  const model = await parseAsset(item.asset, id);
  if (ticket !== loadTicket) return false;
  if (active) scene.remove(active.root);
  active = model;
  selected = item;
  scene.add(active.root);
  $('weapon-select').value = id;
  $('stage-title').textContent = item.name_ko || item.id;
  $('weapon-name').textContent = item.name_ko || item.id;
  $('weapon-english').textContent = item.name_en || '';
  $('weapon-description').textContent = item.description || item.role || '비행선의 색과 재료를 이어받은 손그림 3D 무기 원형입니다.';
  const reference = $('reference');
  reference.hidden = !item.referenceDataURL;
  if (item.referenceDataURL) reference.src = item.referenceDataURL;
  yaw = 0; mountScale = 1;
  $('yaw').value = '0'; $('yaw-value').value = '0°';
  $('mount-scale').value = '1'; $('mount-scale-value').value = '1.00';
  setAutoRotate(false);
  positionWeapon();
  setMode(mode);
  fitView(true);
  await renderer.compileAsync(scene, camera);
  if (outline) effect.render(scene, camera); else renderer.render(scene, camera);
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  downloadURL = URL.createObjectURL(new Blob([model.bytes], { type: 'model/gltf-binary' }));
  $('download').href = downloadURL;
  $('download').download = item.id + '.glb';
  $('download').removeAttribute('aria-disabled');
  $('model-stats').textContent = `${model.stats.meshCount}개 메시 · ${model.stats.triangleCount.toLocaleString('ko-KR')}개 삼각형 · 텍스처 ${model.stats.textureCount}개 · 애니메이션 ${model.stats.animationClipCount}개`;
  Object.assign(window.__weaponStats, { ...model.stats, selectedId: id, ready: true, error: null });
  window.__weaponReady = true;
  $('loading').hidden = true;
  return true;
}
async function initialize() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0, 0);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '무기 3D 모델. 드래그 회전, 휠 확대.');
  stage.prepend(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-3, 3, 2, -2, .01, 1000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .085;
  controls.minZoom = .25; controls.maxZoom = 8; controls.autoRotateSpeed = .7;
  controls.screenSpacePanning = true;
  ambient = new THREE.AmbientLight(0xffffff, 1.05);
  key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(4, 8, 6);
  fill = new THREE.DirectionalLight(0xdce7eb, .45); fill.position.set(-6, 2, -4);
  scene.add(ambient, key, fill);
  effect = new OutlineEffect(renderer, { defaultThickness: .002, defaultColor: [.015, .025, .022], defaultKeepAlive: true });
  // OutlineEffect assigns this value to renderer.autoClear. Without it, rotating
  // geometry accumulates in the buffer even if renderer.autoClear itself is true.
  effect.autoClear = true;
  support = makeSupport(); support.visible = false; scene.add(support);
  if (DATA.ship) { ship = await parseAsset(DATA.ship, '__ship'); ship.root.scale.setScalar(4); ship.root.visible = false; scene.add(ship.root); }
  $('mounted').disabled = !ship;
  for (const item of DATA.items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = (item.name_ko || item.id) + (item.available ? '' : ' · 제작 대기');
    option.disabled = !item.available;
    $('weapon-select').append(option);
  }
  $('weapon-select').addEventListener('change', event => selectWeapon(event.target.value).catch(fail));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $('mounted').addEventListener('change', event => setMounted(event.target.checked));
  $('outline').addEventListener('change', event => { outline = event.target.checked; applyOutline(); });
  $('thickness').addEventListener('input', event => { thickness = Number(event.target.value); $('thickness-value').value = thickness.toFixed(1); applyOutline(); });
  $('yaw').addEventListener('input', event => { yaw = Number(event.target.value); $('yaw-value').value = yaw + '°'; positionWeapon(); });
  $('mount-scale').addEventListener('input', event => { mountScale = Number(event.target.value); $('mount-scale-value').value = mountScale.toFixed(2); positionWeapon(); });
  $('rotate').addEventListener('click', () => setAutoRotate(!controls.autoRotate));
  $('fit').addEventListener('click', () => fitView(false));
  $('reset').addEventListener('click', () => { setAutoRotate(false); fitView(true); });
  window.__weaponWorkbench = { selectWeapon, setMode, setMounted, setAutoRotate, fit: () => fitView(false), reset: () => { setAutoRotate(false); fitView(true); }, renderer, camera, controls, scene, effect,
    get selected() { return selected; }, get modelRoot() { return active?.root; }, get shipRoot() { return ship?.root; },
    availableItems: DATA.items.filter(item => item.available).map(({ id, name_ko }) => ({ id, name_ko })),
  };
  new ResizeObserver(() => active ? fitView(false) : resize()).observe(stage);
  const requestedId = new URLSearchParams(window.location.search).get('weapon');
  const initialItem = DATA.items.find(item => item.available && item.id === requestedId) || DATA.items.find(item => item.available);
  await selectWeapon(initialItem.id);
  function animate(time) {
    requestAnimationFrame(animate);
    const delta = Math.min((time - lastFrame) / 1000, .1); lastFrame = time;
    controls.update(delta);
    if (outline) effect.render(scene, camera); else renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
  window.addEventListener('beforeunload', () => { if (downloadURL) URL.revokeObjectURL(downloadURL); }, { once: true });
}
initialize().catch(fail);
