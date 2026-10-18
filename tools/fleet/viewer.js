import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { MOTION_PROFILES } from '../airship-rig/motion.js';

// Build embeds the original binary; file:// works without a server or CDN.
const MODEL_BASE64 = __MODEL_BASE64__;
const MODEL_BYTES = __MODEL_BYTES__;
const stage = document.getElementById('stage');
const loading = document.getElementById('loading');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const profileMeta = new Map(MOTION_PROFILES.map(profile => [profile.name, profile]));
const profileDescriptions = {
  FloatIdle: '고요한 바람에 몸을 맡긴 비행선',
  Cruise: '잔잔한 흔들림을 품고 앞으로',
  BankTurn: '선체를 기울이며 부드럽게 방향을 바꿉니다',
  GustRecovery: '지나가는 바람, 천천히 되찾는 균형',
  TurretScan: '주변을 살피는 작은 포탑',
  WinchCycle: '흔들리는 갈고리를 내리고 다시 끌어올립니다',
  FireBurst: '짧은 후퇴와 천천히 돌아오는 포신',
};
const modeDescriptions = {
  handdrawn: ['손그림', '따뜻한 색과 붓의 흔적을 그대로'],
  cel: ['셀 명암', '단순한 명암으로 드러나는 입체감'],
  original: ['원본 재질', '모델에 담긴 재질과 빛을 함께'],
};
window.__rigReady = false;
window.__rigStats = { ready: false, sourceBytes: MODEL_BYTES, offline: true, mode: 'handdrawn', playing: !reducedMotion.matches };

let renderer, outlineEffect, camera, controls, scene, modelRoot, rig, mixer;
let ambientLight, keyLight, fillLight, skeletonHelper;
let currentAction = null;
let currentRotorAction = null;
let currentProfile = 'FloatIdle';
let currentMode = 'handdrawn';
let playing = !reducedMotion.matches;
let playbackSpeed = 1;
let outlineEnabled = true;
let outlinePixels = 1.2;
let fitHalfHeight = 2.3;
let clips = [];
let lastFrameTime = performance.now();
let lastUITime = 0;
const records = [];
const originalMaterials = new Set();
const cachedMaterials = new Map();
const allTextures = new Set();
const fadingActions = new Set();
const bodyClips = new Map();
const rotorClips = new Map();
const modelBox = new THREE.Box3();
const modelTarget = new THREE.Vector3();
const startDirection = new THREE.Vector3(-7, 5.5, -7).normalize();
const gradientMap = new THREE.DataTexture(new Uint8Array([70, 155, 255]), 3, 1, THREE.RedFormat);
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

function fail(error) {
  window.__rigStats.error = String(error?.message || error);
  loading.hidden = false;
  loading.classList.add('error');
  document.getElementById('loading-text').textContent = '비행선을 표시하지 못했습니다. ' + (error?.message || error);
  console.error(error);
}

function materialFor(source, mode) {
  if (mode === 'original') return source;
  const key = source.uuid + ':' + mode;
  if (cachedMaterials.has(key)) return cachedMaterials.get(key);
  const shared = {
    color: source.color?.clone() || new THREE.Color(0xffffff),
    map: source.map || null, alphaMap: source.alphaMap || null,
    opacity: source.opacity, transparent: source.transparent, alphaTest: source.alphaTest,
    side: source.side, vertexColors: source.vertexColors,
    depthWrite: source.depthWrite, depthTest: source.depthTest, visible: source.visible,
    toneMapped: false,
  };
  const material = mode === 'cel'
    ? new THREE.MeshToonMaterial({ ...shared, gradientMap, emissive: 0x000000 })
    : new THREE.MeshBasicMaterial(shared);
  material.name = source.name + ' / ' + mode;
  material.userData.outlineParameters = { thickness: .002, color: [.006, .009, .012], alpha: 1, visible: true, keepAlive: true };
  cachedMaterials.set(key, material);
  return material;
}

function applyOutline() {
  const thickness = 2 * outlinePixels / Math.max(stage.clientHeight, 1);
  for (const material of [...originalMaterials, ...cachedMaterials.values()]) {
    material.userData.outlineParameters = {
      thickness, color: [.006, .009, .012], alpha: 1, visible: outlineEnabled, keepAlive: true,
    };
  }
  Object.assign(window.__rigStats, { outlineEnabled, outlinePixels, outlineAutoClear: outlineEffect?.autoClear === true });
}

function setMode(mode) {
  if (!(mode in modeDescriptions) || !ambientLight) return false;
  currentMode = mode;
  ambientLight.intensity = mode === 'cel' ? .18 : 1.05;
  keyLight.intensity = mode === 'cel' ? .92 : 2.1;
  fillLight.intensity = mode === 'cel' ? .08 : .45;
  for (const record of records) record.mesh.material = Array.isArray(record.original)
    ? record.original.map(material => materialFor(material, mode))
    : materialFor(record.original, mode);
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  document.getElementById('mode-title').textContent = modeDescriptions[mode][0];
  document.getElementById('mode-description').textContent = modeDescriptions[mode][1];
  applyOutline();
  window.__rigStats.mode = mode;
  return true;
}

function syncPlaybackUI() {
  const duration = currentAction?.getClip().duration || 0;
  const time = currentAction?.time || 0;
  const timeline = document.getElementById('timeline');
  timeline.max = String(duration);
  timeline.value = String(time);
  document.getElementById('time-value').value = `${time.toFixed(1)} / ${duration.toFixed(1)}초`;
  const playButton = document.getElementById('play');
  playButton.textContent = playing ? '일시정지' : '재생';
  playButton.setAttribute('aria-pressed', String(playing));
  playButton.setAttribute('aria-label', playing ? '비행선 움직임 일시정지' : '비행선 움직임 재생');
  Object.assign(window.__rigStats, {
    profile: currentProfile, currentProfile, time, duration, playing,
    speed: playbackSpeed, skeletonVisible: skeletonHelper?.visible || false,
    outlineAutoClear: outlineEffect?.autoClear === true,
  });
}

function setProfile(name) {
  const clip = clips.find(candidate => candidate.name === name);
  if (!clip || !mixer) return false;
  if (currentAction && currentProfile === name) return true;
  const previous = currentAction;
  const previousRotor = currentRotorAction;
  const previousRPM = profileMeta.get(currentProfile)?.rpm || 120;
  const rotorPhase = previousRotor ? (previousRotor.time * previousRPM / 60) % 1 : 0;
  const rotorSpeed = previousRotor ? previousRPM / 60 * previousRotor.getEffectiveTimeScale() : 0;
  currentProfile = name;
  currentAction = mixer.clipAction(bodyClips.get(name) || clip);
  currentAction.reset().stopFading().stopWarping().setEffectiveWeight(1).setEffectiveTimeScale(1);
  currentAction.setLoop(THREE.LoopRepeat, Infinity);
  currentAction.paused = false;
  currentAction.play();
  fadingActions.delete(currentAction);
  // A rotor is periodic many times inside each pose loop. Blending two rotor
  // quaternion tracks can cancel or reverse the spin. Play that *same embedded
  // channel* separately, align its phase, then warp speed instead of blending.
  if (previousRotor) previousRotor.stop();
  currentRotorAction = rotorClips.has(name) ? mixer.clipAction(rotorClips.get(name)) : null;
  if (currentRotorAction) {
    const revolutionsPerSecond = (profileMeta.get(name)?.rpm || 120) / 60;
    currentRotorAction.reset().stopFading().stopWarping().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    currentRotorAction.setLoop(THREE.LoopRepeat, Infinity);
    currentRotorAction.time = rotorPhase / revolutionsPerSecond;
    if (previousRotor && playing) {
      const ratio = rotorSpeed / revolutionsPerSecond;
      currentRotorAction.setEffectiveTimeScale(ratio).warp(ratio, 1, .8);
    }
  }
  if (previous && playing) {
    previous.paused = false;
    currentAction.crossFadeFrom(previous, .8, false);
    fadingActions.add(previous);
  } else {
    if (previous) previous.stop();
    for (const action of fadingActions) action.stop();
    fadingActions.clear();
    mixer.update(0);
    currentAction.paused = !playing;
    if (currentRotorAction) currentRotorAction.paused = !playing;
  }
  document.querySelectorAll('[data-profile]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.profile === name)));
  document.getElementById('profile-title').textContent = profileMeta.get(name)?.label || name;
  document.getElementById('profile-description').textContent = profileDescriptions[name] || '';
  syncPlaybackUI();
  return true;
}

function setPlaying(value) {
  playing = Boolean(value);
  if (currentAction) currentAction.paused = !playing;
  if (currentRotorAction) currentRotorAction.paused = !playing;
  lastFrameTime = performance.now();
  syncPlaybackUI();
  return playing;
}

function setTime(seconds) {
  if (!currentAction || !Number.isFinite(Number(seconds))) return false;
  const clip = currentAction.getClip();
  const target = THREE.MathUtils.clamp(Number(seconds), 0, clip.duration);
  // Stop every pending blend so a scrubbed pose is deterministic. Evaluating
  // at delta=0 writes that pose immediately without advancing the animation.
  mixer.stopAllAction();
  fadingActions.clear();
  currentAction = mixer.clipAction(clip);
  currentAction.reset().stopFading().stopWarping().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
  currentAction.setLoop(THREE.LoopRepeat, Infinity);
  currentAction.paused = false;
  currentAction.time = target;
  if (currentRotorAction) {
    currentRotorAction.reset().stopFading().stopWarping().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    currentRotorAction.setLoop(THREE.LoopRepeat, Infinity);
    currentRotorAction.paused = false;
    currentRotorAction.time = target;
  }
  mixer.update(0);
  playing = false;
  currentAction.paused = true;
  if (currentRotorAction) currentRotorAction.paused = true;
  rig.updateMatrixWorld(true);
  syncPlaybackUI();
  return true;
}

function setSpeed(value) {
  const speed = Number(value);
  if (!Number.isFinite(speed)) return false;
  playbackSpeed = THREE.MathUtils.clamp(speed, .25, 1.5);
  document.getElementById('speed').value = String(playbackSpeed);
  document.getElementById('speed-value').value = playbackSpeed.toFixed(2).replace(/0$/, '') + '×';
  syncPlaybackUI();
  return true;
}

function resize() {
  const width = Math.max(stage.clientWidth, 1), height = Math.max(stage.clientHeight, 1);
  renderer.setSize(width, height, false);
  const halfWidth = fitHalfHeight * width / height;
  camera.left = -halfWidth; camera.right = halfWidth;
  camera.top = fitHalfHeight; camera.bottom = -fitHalfHeight;
  camera.updateProjectionMatrix();
  applyOutline();
}

function fitView(resetView = false) {
  if (!modelRoot) return;
  controls.target.copy(modelTarget);
  if (resetView) camera.position.copy(startDirection).multiplyScalar(12).add(modelTarget);
  camera.lookAt(modelTarget);
  camera.updateMatrixWorld(true);
  const aspect = Math.max(stage.clientWidth / Math.max(stage.clientHeight, 1), .1);
  const view = camera.matrixWorldInverse;
  let maxX = 0, maxY = 0;
  const vertex = new THREE.Vector3();
  modelRoot.updateMatrixWorld(true);
  for (const { mesh } of records) {
    if (mesh.isSkinnedMesh) mesh.skeleton.update();
    const count = mesh.geometry.attributes.position.count;
    for (let i = 0; i < count; i++) {
      mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld).applyMatrix4(view);
      maxX = Math.max(maxX, Math.abs(vertex.x));
      maxY = Math.max(maxY, Math.abs(vertex.y));
    }
  }
  // Actual painted vertices avoid the empty corners of a diagonal AABB fit.
  fitHalfHeight = Math.max(maxY, maxX / aspect, .1) * 1.15;
  camera.zoom = 1;
  resize();
  controls.update();
}

function setAutoRotate(enabled) {
  controls.autoRotate = Boolean(enabled);
  document.getElementById('rotate').setAttribute('aria-pressed', String(controls.autoRotate));
  window.__rigStats.autoRotate = controls.autoRotate;
}

function reset() {
  setAutoRotate(false);
  fitView(true);
}

async function initialize() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-label', '움직이는 Cloudstitch 에셋. 드래그로 회전, 휠로 확대할 수 있습니다.');
  renderer.domElement.tabIndex = 0;
  stage.insertBefore(renderer.domElement, stage.firstChild);
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .01, 1000);
  camera.position.copy(startDirection).multiplyScalar(12);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .085;
  controls.minZoom = .25; controls.maxZoom = 8;
  controls.autoRotate = false; controls.autoRotateSpeed = .7;
  controls.screenSpacePanning = true;
  ambientLight = new THREE.AmbientLight(0xffffff, 1.05);
  keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(4, 8, 6);
  fillLight = new THREE.DirectionalLight(0xdce7eb, .45);
  fillLight.position.set(-6, 2, -4);
  scene.add(ambientLight, keyLight, fillLight);
  outlineEffect = new OutlineEffect(renderer, { defaultThickness: .002, defaultColor: [.006, .009, .012], defaultKeepAlive: true });
  // Required: the effect overrides renderer.autoClear for its base pass.
  outlineEffect.autoClear = true;
  const raw = atob(MODEL_BASE64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  if (!gltf.scene) throw new Error('GLB에 표시할 장면이 없습니다.');
  if (!gltf.animations.length) throw new Error('GLB에서 움직임을 찾을 수 없습니다.');
  rig = gltf.scene;
  const supported = rig.userData.availableActions || rig.userData.availableProfiles;
  if (supported) document.querySelectorAll('[data-profile]').forEach(button => { button.disabled = !supported.includes(button.dataset.profile); button.title = button.disabled ? '이 함선에 해당 장치가 없습니다' : ''; });
  const equipment = rig.userData.artModules || {};
  const weaponEquipped = ['machineGuns','cannons','mortars','harpoons','chainCannons','flamethrowers'].some(key => equipment[key] > 0);
  if (!weaponEquipped && rig.userData.scopeKind !== 'environment') {
    profileMeta.set('FireBurst', { ...profileMeta.get('FireBurst'), label: '장치 반응' });
    profileDescriptions.FireBurst = '종과 밸브, 구조 캡슐 장치의 반응을 살펴봅니다';
  }
  if (!equipment.winches && rig.userData.scopeKind !== 'environment') {
    profileMeta.set('WinchCycle', { ...profileMeta.get('WinchCycle'), label: '인양·지원 작업' });
    profileDescriptions.WinchCycle = '수리 팔과 크레인, 지원 장치의 관절 움직임을 살펴봅니다';
  }
  if (rig.userData.scopeKind === 'environment') { profileMeta.set('FireBurst', { ...profileMeta.get('FireBurst'), label: '봉인과 압력 반응' }); profileMeta.set('WinchCycle', { ...profileMeta.get('WinchCycle'), label: '시설 장치 작동' }); profileDescriptions.FireBurst = '종과 밸브, 봉인 장치의 반응을 살펴봅니다'; profileDescriptions.WinchCycle = '크레인과 기계 관절의 움직임을 살펴봅니다'; document.querySelector('[data-profile=FireBurst]').textContent = '봉인·압력'; document.querySelector('[data-profile=WinchCycle]').textContent = '장치 작동'; }
  clips = gltf.animations;
  for (const clip of clips) {
    const rotor = clip.tracks.filter(track => (track.name.includes('PropellerSpin') || track.name.includes('_Rotor')) && track.name.endsWith('.quaternion'));
    if (rotor.length) {
      bodyClips.set(clip.name, new THREE.AnimationClip(clip.name, clip.duration, clip.tracks.filter(track => !rotor.includes(track))));
      rotorClips.set(clip.name, new THREE.AnimationClip(clip.name + ' / rotor', clip.duration, rotor));
    }
  }
  rig.updateMatrixWorld(true);
  const originalBox = new THREE.Box3().setFromObject(rig);
  if (originalBox.isEmpty()) throw new Error('GLB에 표시할 메시가 없습니다.');
  const originalSize = originalBox.getSize(new THREE.Vector3());
  const originalCenter = originalBox.getCenter(new THREE.Vector3());
  const scale = 4 / Math.max(originalSize.x, originalSize.y, originalSize.z, .0001);
  modelRoot = new THREE.Group();
  modelRoot.name = 'Display normalization (original geometry unchanged)';
  modelRoot.add(rig); modelRoot.scale.setScalar(scale);
  modelRoot.position.copy(originalCenter).multiplyScalar(-scale);
  let triangleCount = 0, meshCount = 0, boneCount = 0, skinnedMeshCount = 0;
  rig.traverse(object => {
    if (object.isBone) boneCount++;
    if (!object.isMesh) return;
    if (object.isSkinnedMesh) skinnedMeshCount++;
    records.push({ mesh: object, original: object.material }); meshCount++;
    triangleCount += (object.geometry.index?.count || object.geometry.attributes.position?.count || 0) / 3;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      originalMaterials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) allTextures.add(value);
    }
  });
  if (!meshCount) throw new Error('GLB에서 메시를 찾을 수 없습니다.');
  const textureInfo = Array.from(allTextures, texture => {
    const image = texture.source?.data || texture.image;
    return { name: texture.name, width: image?.width || 0, height: image?.height || 0, ready: Boolean(image && (image.width > 0 || image.data)) };
  });
  if (textureInfo.some(texture => !texture.ready)) throw new Error('텍스처가 완전히 준비되지 않았습니다.');
  scene.add(modelRoot); modelRoot.updateMatrixWorld(true);
  modelBox.setFromObject(modelRoot); modelBox.getCenter(modelTarget);
  skeletonHelper = new THREE.SkeletonHelper(rig);
  skeletonHelper.name = 'Rig overlay'; skeletonHelper.visible = false;
  skeletonHelper.material.depthTest = false;
  skeletonHelper.material.transparent = true;
  skeletonHelper.material.opacity = .8;
  skeletonHelper.renderOrder = 100;
  scene.add(skeletonHelper);
  mixer = new THREE.AnimationMixer(rig);
  Object.assign(window.__rigStats, {
    meshCount, triangleCount: Math.round(triangleCount), boneCount, skinnedMeshCount,
    textureCount: allTextures.size, texturesReady: textureInfo.every(texture => texture.ready), textures: textureInfo,
    materialCount: originalMaterials.size, animationClipCount: clips.length,
    availableActions: rig.userData.availableActions || rig.userData.availableProfiles,
    profiles: clips.map(clip => ({ name: clip.name, duration: clip.duration, tracks: clip.tracks.length })),
    originalBounds: { min: originalBox.min.toArray(), max: originalBox.max.toArray() },
    normalizedBounds: { min: modelBox.min.toArray(), max: modelBox.max.toArray() },
    renderer: renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL', autoRotate: false,
    reducedMotion: reducedMotion.matches,
    rotorPhaseAligned: rotorClips.size === clips.length,
  });
  setMode('handdrawn');
  currentProfile = '';
  setProfile(clips.some(clip => clip.name === 'FloatIdle') ? 'FloatIdle' : clips[0].name);
  fitView(true);
  await renderer.compileAsync(scene, camera);
  outlineEffect.render(scene, camera);
  const modelURL = URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }));
  const link = document.getElementById('download');
  link.href = modelURL; link.download = (rig.userData.assetId || 'airship-rigged') + '.glb'; link.removeAttribute('aria-disabled');
  document.getElementById('model-stats').textContent = `${clips.length}가지 움직임 · ${boneCount}개 뼈대 · ${Math.round(triangleCount).toLocaleString('ko-KR')}개 삼각형`;
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.querySelectorAll('[data-profile]').forEach(button => {
    button.disabled = !clips.some(clip => clip.name === button.dataset.profile) || !!supported && !supported.includes(button.dataset.profile);
    button.textContent = profileMeta.get(button.dataset.profile)?.label || button.textContent;
    button.addEventListener('click', () => setProfile(button.dataset.profile));
  });
  document.getElementById('play').addEventListener('click', () => setPlaying(!playing));
  document.getElementById('timeline').addEventListener('input', event => setTime(event.target.value));
  document.getElementById('speed').addEventListener('input', event => setSpeed(event.target.value));
  document.getElementById('skeleton').addEventListener('change', event => {
    skeletonHelper.visible = event.target.checked; syncPlaybackUI();
  });
  document.getElementById('outline').addEventListener('change', event => { outlineEnabled = event.target.checked; applyOutline(); });
  document.getElementById('thickness').addEventListener('input', event => {
    outlinePixels = Number(event.target.value);
    document.getElementById('thickness-value').value = outlinePixels.toFixed(1); applyOutline();
  });
  document.getElementById('reset').addEventListener('click', reset);
  document.getElementById('fit').addEventListener('click', () => fitView(false));
  document.getElementById('rotate').addEventListener('click', () => setAutoRotate(!controls.autoRotate));
  new ResizeObserver(() => fitView(false)).observe(stage);
  reducedMotion.addEventListener('change', event => {
    window.__rigStats.reducedMotion = event.matches;
    if (event.matches) { setPlaying(false); setAutoRotate(false); }
  });
  window.__rigViewer = {
    setMode, setProfile, setPlaying, setTime, setSpeed, reset, fit: () => fitView(false), setAutoRotate,
    camera, controls, renderer, scene, rig, mixer, clips, outlineEffect,
  };
  window.__rigStats.ready = true; window.__rigReady = true; loading.hidden = true;
  const animate = time => {
    requestAnimationFrame(animate);
    const delta = Math.min(Math.max((time - lastFrameTime) / 1000, 0), .1);
    lastFrameTime = time;
    if (playing) {
      mixer.update(delta * playbackSpeed);
      for (const action of fadingActions) if (action !== currentAction && action.getEffectiveWeight() < .00001) { action.stop(); fadingActions.delete(action); }
    }
    controls.update(delta);
    if (outlineEnabled) outlineEffect.render(scene, camera); else renderer.render(scene, camera);
    // Stats are refreshed each frame for QA; visual range updates are throttled.
    Object.assign(window.__rigStats, { time: currentAction?.time || 0, playing, currentProfile, profile: currentProfile });
    if (time - lastUITime > 80) { syncPlaybackUI(); lastUITime = time; }
  };
  lastFrameTime = performance.now();
  requestAnimationFrame(animate);
  window.addEventListener('beforeunload', () => URL.revokeObjectURL(modelURL), { once: true });
}

initialize().catch(fail);
