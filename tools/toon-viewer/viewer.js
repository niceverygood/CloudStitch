import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

// Filled by esbuild from the actual GLB, so opening file:// needs no fetch or CDN.
const MODEL_BASE64 = __MODEL_BASE64__;
const MODEL_BYTES = __MODEL_BYTES__;
window.__toonReady = false;
window.__toonStats = { ready: false, sourceBytes: MODEL_BYTES, mode: 'handdrawn', offline: true };

const stage = document.getElementById('stage');
const loading = document.getElementById('loading');
const descriptions = {
  handdrawn: ['손그림', '빛 반사 없이 텍스처의 색과 선을 그대로 보여줍니다.'],
  cel: ['셀 명암', '세 단계로 나눈 명암과 윤곽선으로 입체감을 표현합니다.'],
  original: ['원본 재질', 'GLB에 저장된 재질을 조명 아래에서 확인합니다.'],
};
let renderer, outlineEffect, camera, controls, scene, modelRoot, ambientLight, keyLight, fillLight;
let modelBox = new THREE.Box3();
let currentMode = 'handdrawn';
let outlineEnabled = true;
let outlinePixels = 1.2;
let fitHalfHeight = 2.3;
let lastFrameTime = performance.now();
const records = [];
const cachedMaterials = new Map();
const originalMaterials = new Set();
const allTextures = new Set();
const startDirection = new THREE.Vector3(-7, 5.5, -7).normalize();
const modelTarget = new THREE.Vector3();

function fail(error) {
  window.__toonStats.error = String(error?.message || error);
  loading.hidden = false;
  loading.classList.add('error');
  document.getElementById('loading-text').textContent = '모델을 표시하지 못했습니다. ' + (error?.message || error);
  console.error(error);
}

function collectTextures(material) {
  for (const value of Object.values(material)) if (value?.isTexture) allTextures.add(value);
}

function materialFor(source, mode) {
  if (mode === 'original') return source;
  const key = source.uuid + ':' + mode;
  if (cachedMaterials.has(key)) return cachedMaterials.get(key);
  // Retain the texture's original UV transform/channel and vertex colors.
  // No normal/displacement maps or specular highlights in the 2D modes.
  const shared = {
    color: source.color?.clone() || new THREE.Color(0xffffff),
    map: source.map || null,
    alphaMap: source.alphaMap || null,
    opacity: source.opacity,
    transparent: source.transparent,
    alphaTest: source.alphaTest,
    side: source.side,
    vertexColors: source.vertexColors,
    depthWrite: source.depthWrite,
    depthTest: source.depthTest,
    visible: source.visible,
    toneMapped: false,
  };
  const material = mode === 'cel'
    ? new THREE.MeshToonMaterial({ ...shared, gradientMap, emissive: 0x000000 })
    : new THREE.MeshBasicMaterial(shared);
  material.name = source.name + ' / ' + mode;
  material.userData.outlineParameters = { thickness: 0.002, color: [0.006, 0.009, 0.012], alpha: 1, visible: true, keepAlive: true };
  cachedMaterials.set(key, material);
  return material;
}

const gradientMap = new THREE.DataTexture(new Uint8Array([70, 155, 255]), 3, 1, THREE.RedFormat);
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

function applyOutline() {
  // OutlineEffect uses normalized screen coordinates. Match its vertical extent to CSS px.
  const thickness = (2 * outlinePixels) / Math.max(stage.clientHeight, 1);
  for (const source of originalMaterials) {
    source.userData.outlineParameters = { thickness, color: [0.006, 0.009, 0.012], alpha: 1, visible: outlineEnabled, keepAlive: true };
  }
  for (const material of cachedMaterials.values()) {
    material.userData.outlineParameters.thickness = thickness;
    material.userData.outlineParameters.visible = outlineEnabled;
  }
  window.__toonStats.outlineEnabled = outlineEnabled;
  window.__toonStats.outlinePixels = outlinePixels;
}

function setMode(mode) {
  if (!(mode in descriptions)) return;
  currentMode = mode;
  ambientLight.intensity = mode === 'cel' ? .18 : 1.05;
  keyLight.intensity = mode === 'cel' ? .92 : 2.1;
  fillLight.intensity = mode === 'cel' ? .08 : .45;
  for (const record of records) record.mesh.material = Array.isArray(record.original)
    ? record.original.map(material => materialFor(material, mode))
    : materialFor(record.original, mode);
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  document.getElementById('mode-title').textContent = descriptions[mode][0];
  document.getElementById('mode-description').textContent = descriptions[mode][1];
  applyOutline();
  window.__toonStats.mode = mode;
}

function resize() {
  const width = Math.max(stage.clientWidth, 1), height = Math.max(stage.clientHeight, 1);
  renderer.setSize(width, height, false);
  const halfWidth = fitHalfHeight * width / height;
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = fitHalfHeight;
  camera.bottom = -fitHalfHeight;
  camera.updateProjectionMatrix();
  applyOutline();
}

function fitView(reset = false) {
  if (!modelRoot) return;
  controls.target.copy(modelTarget);
  if (reset) camera.position.copy(startDirection).multiplyScalar(12).add(modelTarget);
  camera.lookAt(modelTarget);
  camera.updateMatrixWorld(true);
  const width = stage.clientWidth, height = stage.clientHeight;
  const aspect = Math.max(width / height, 0.1);
  const view = camera.matrixWorldInverse;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) {
    const corner = new THREE.Vector3(x ? modelBox.max.x : modelBox.min.x, y ? modelBox.max.y : modelBox.min.y, z ? modelBox.max.z : modelBox.min.z).applyMatrix4(view);
    minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
    minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
  }
  // Reserve space above and below the model for the unobtrusive stage labels.
  fitHalfHeight = Math.max((maxY - minY) / 2, (maxX - minX) / (2 * aspect), .1) * 1.35;
  camera.zoom = 1;
  resize();
  controls.update();
}

function setAutoRotate(enabled) {
  controls.autoRotate = Boolean(enabled);
  document.getElementById('rotate').setAttribute('aria-pressed', String(controls.autoRotate));
  window.__toonStats.autoRotate = controls.autoRotate;
}

async function initialize() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-label', '비행선 3D 모델. 드래그로 회전, 휠로 확대할 수 있습니다.');
  renderer.domElement.tabIndex = 0;
  stage.insertBefore(renderer.domElement, stage.firstChild);
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .01, 1000);
  camera.position.copy(startDirection).multiplyScalar(12);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .085;
  controls.minZoom = .25;
  controls.maxZoom = 8;
  controls.autoRotate = false;
  controls.autoRotateSpeed = .7;
  controls.screenSpacePanning = true;
  // A neutral fill keeps original material readable without adding a shiny environment.
  ambientLight = new THREE.AmbientLight(0xffffff, 1.05);
  scene.add(ambientLight);
  keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(4, 8, 6);
  scene.add(keyLight);
  fillLight = new THREE.DirectionalLight(0xdce7eb, .45);
  fillLight.position.set(-6, 2, -4);
  scene.add(fillLight);
  outlineEffect = new OutlineEffect(renderer, { defaultThickness: .002, defaultColor: [.006, .009, .012], defaultKeepAlive: true });
  // OutlineEffect replaces renderer.autoClear with its own property for the
  // base pass. Explicitly clear it every frame before adding the outline pass.
  outlineEffect.autoClear = true;
  const raw = atob(MODEL_BASE64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  if (!gltf.scene) throw new Error('GLB에 표시할 장면이 없습니다.');
  gltf.scene.updateMatrixWorld(true);
  const originalBox = new THREE.Box3().setFromObject(gltf.scene);
  if (originalBox.isEmpty()) throw new Error('GLB에 표시할 메시가 없습니다.');
  const originalSize = originalBox.getSize(new THREE.Vector3());
  const originalCenter = originalBox.getCenter(new THREE.Vector3());
  const scale = 4 / Math.max(originalSize.x, originalSize.y, originalSize.z, .0001);
  modelRoot = new THREE.Group();
  modelRoot.name = 'Display normalization (original geometry unchanged)';
  modelRoot.add(gltf.scene);
  modelRoot.scale.setScalar(scale);
  modelRoot.position.copy(originalCenter).multiplyScalar(-scale);
  let triangleCount = 0, meshCount = 0;
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    records.push({ mesh: object, original: object.material });
    meshCount++;
    triangleCount += (object.geometry.index?.count || object.geometry.attributes.position?.count || 0) / 3;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      originalMaterials.add(material);
      collectTextures(material);
    }
  });
  if (!meshCount) throw new Error('GLB에서 메시를 찾을 수 없습니다.');
  // GLTFLoader.parseAsync resolves after its images and textures are decoded.
  const textureInfo = Array.from(allTextures, texture => {
    const image = texture.source?.data || texture.image;
    return { name: texture.name, width: image?.width || 0, height: image?.height || 0, ready: Boolean(image && (image.width > 0 || image.data)) };
  });
  if (textureInfo.some(texture => !texture.ready)) throw new Error('텍스처가 완전히 준비되지 않았습니다.');
  scene.add(modelRoot);
  modelRoot.updateMatrixWorld(true);
  modelBox.setFromObject(modelRoot);
  modelBox.getCenter(modelTarget);
  Object.assign(window.__toonStats, {
    meshCount, triangleCount: Math.round(triangleCount), textureCount: allTextures.size,
    texturesReady: textureInfo.every(texture => texture.ready), textures: textureInfo,
    materialCount: originalMaterials.size, animationClipCount: gltf.animations.length,
    originalBounds: { min: originalBox.min.toArray(), max: originalBox.max.toArray() },
    normalizedBounds: { min: modelBox.min.toArray(), max: modelBox.max.toArray() },
    renderer: renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL',
    autoRotate: false,
  });
  setMode('handdrawn');
  fitView(true);
  // Force shader compilation and texture uploads before exposing readiness for QA.
  await renderer.compileAsync(scene, camera);
  if (outlineEnabled) outlineEffect.render(scene, camera); else renderer.render(scene, camera);
  const link = document.getElementById('download');
  const modelURL = URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }));
  link.href = modelURL;
  link.removeAttribute('aria-disabled');
  document.getElementById('model-stats').textContent = `${meshCount.toLocaleString('ko-KR')}개 메시 · ${Math.round(triangleCount).toLocaleString('ko-KR')}개 삼각형 · 텍스처 ${allTextures.size}개`;
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.getElementById('outline').addEventListener('change', event => { outlineEnabled = event.target.checked; applyOutline(); });
  document.getElementById('thickness').addEventListener('input', event => {
    outlinePixels = Number(event.target.value);
    document.getElementById('thickness-value').value = outlinePixels.toFixed(1);
    applyOutline();
  });
  document.getElementById('reset').addEventListener('click', () => { setAutoRotate(false); fitView(true); });
  document.getElementById('fit').addEventListener('click', () => fitView(false));
  document.getElementById('rotate').addEventListener('click', () => setAutoRotate(!controls.autoRotate));
  new ResizeObserver(() => fitView(false)).observe(stage);
  window.__toonViewer = { setMode, fit: () => fitView(false), reset: () => fitView(true), setAutoRotate, camera, controls, renderer, scene };
  window.__toonStats.ready = true;
  window.__toonReady = true;
  loading.hidden = true;
  const animate = time => {
    requestAnimationFrame(animate);
    const delta = Math.min((time - lastFrameTime) / 1000, .1);
    lastFrameTime = time;
    controls.update(delta);
    if (outlineEnabled) outlineEffect.render(scene, camera); else renderer.render(scene, camera);
  };
  requestAnimationFrame(animate);
  window.addEventListener('beforeunload', () => URL.revokeObjectURL(modelURL), { once: true });
}
initialize().catch(fail);
