import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

const DATA = __VFX_DATA__;
const $ = id => document.getElementById(id);
const stage = $('stage'), cache = new Map(), materials = new Set();
const names = { '01-machine-gun': '기관총', '02-deck-cannon': '함포', '03-mortar': '박격포', '04-harpoon': '작살포', '05-chain-shot': '사슬탄', '06-flamethrower': '화염방사기', common: '공통 효과' };
const direction = new THREE.Vector3(-7, 5.5, -7).normalize();
let renderer, effect, camera, controls, scene, targetBlock;
let selected, active, downloadURL, ticket = 0;
let currentTime = 0, duration = 0, playing = true, loop = false, speed = 1;
let outlined = false, deep = false, targetType = 'none', halfHeight = 2, lastFrame = performance.now();
const bounds = new THREE.Box3(), target = new THREE.Vector3();
window.__vfxReady = false;
window.__vfxStats = { ready: false, offline: true, selectedId: null, currentTime: 0, duration: 0, playing, loop, speed, outlineEnabled: outlined, models: {} };

function fail(error) {
  window.__vfxReady = false;
  window.__vfxStats.ready = false;
  window.__vfxStats.error = String(error?.message || error);
  $('loading').hidden = false;
  $('loading').classList.add('error');
  $('loading').textContent = '효과를 표시하지 못했습니다. ' + window.__vfxStats.error;
  console.error(error);
}
function bytesFor(asset) {
  const raw = atob(asset.base64), bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}
function syncTime() {
  $('timeline').value = String(currentTime);
  $('time-value').value = `${currentTime.toFixed(2)} / ${duration.toFixed(2)}초`;
  Object.assign(window.__vfxStats, { currentTime, time: currentTime, duration, playing, loop, speed });
}
function evaluateTime(time) {
  currentTime = THREE.MathUtils.clamp(Number(time) || 0, 0, duration);
  if (active?.action) {
    // Evaluate the actual GLB clip at an absolute time. Looping is managed by
    // the workbench clock, so scrubbing exactly to duration shows the last
    // frame rather than wrapping to zero in AnimationAction's repeat mode.
    active.action.reset();
    active.action.setLoop(THREE.LoopOnce, 1);
    active.action.clampWhenFinished = true;
    active.action.play();
    active.mixer.setTime(currentTime);
  }
  active?.root.updateMatrixWorld(true);
  syncTime();
}
function setPlaying(value) {
  if (value && active?.action && currentTime >= duration && duration > 0) evaluateTime(0);
  playing = Boolean(value && active?.action && duration > 0);
  $('play').textContent = playing ? '일시정지' : '재생';
  $('play').setAttribute('aria-pressed', String(playing));
  window.__vfxStats.playing = playing;
}
function setTime(time) { setPlaying(false); evaluateTime(time); }
function setLoop(value) { loop = Boolean(value); $('loop').checked = loop; window.__vfxStats.loop = loop; }
function setSpeed(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return;
  speed = THREE.MathUtils.clamp(number, .1, 4);
  if (![...$('speed').options].some(option => Number(option.value) === speed)) {
    const option = document.createElement('option'); option.value = String(speed); option.textContent = `${speed}×`; $('speed').append(option);
  }
  $('speed').value = String(speed); window.__vfxStats.speed = speed;
}
function applyOutline() {
  const thickness = 2 * .8 / Math.max(stage.clientHeight, 1);
  for (const material of materials) material.userData.outlineParameters = { thickness, color: [.025, .04, .035], alpha: 1, visible: outlined, keepAlive: true };
  window.__vfxStats.outlineEnabled = outlined;
}
function setAutoRotate(value) {
  controls.autoRotate = Boolean(value);
  $('rotate').setAttribute('aria-pressed', String(controls.autoRotate));
  window.__vfxStats.autoRotate = controls.autoRotate;
}
function setBackground(value) {
  deep = value === 'deepteal' || value === true;
  stage.classList.toggle('deep', deep);
  $('background').textContent = deep ? '배경 · 짙은 청록' : '배경 · 크림';
  $('background').setAttribute('aria-pressed', String(deep));
  window.__vfxStats.background = deep ? 'deepteal' : 'cream';
}
function resize() {
  const width = Math.max(stage.clientWidth, 1), height = Math.max(stage.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.left = -halfHeight * width / height; camera.right = halfHeight * width / height;
  camera.top = halfHeight; camera.bottom = -halfHeight;
  camera.updateProjectionMatrix(); applyOutline();
}
function viewBounds() {
  bounds.copy(active.displayBounds);
  if (targetBlock.visible) bounds.union(new THREE.Box3().setFromObject(targetBlock));
  bounds.getCenter(target);
}
function fit(reset = false) {
  if (!active) return;
  viewBounds();
  if (reset) camera.position.copy(direction).multiplyScalar(12).add(target);
  else camera.position.add(target.clone().sub(controls.target));
  controls.target.copy(target); camera.lookAt(target); camera.updateMatrixWorld(true);
  const aspect = Math.max(stage.clientWidth / stage.clientHeight, .1);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) {
    const corner = new THREE.Vector3(x ? bounds.max.x : bounds.min.x, y ? bounds.max.y : bounds.min.y, z ? bounds.max.z : bounds.min.z).applyMatrix4(camera.matrixWorldInverse);
    minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x); minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
  }
  halfHeight = Math.max((maxY - minY) / 2, (maxX - minX) / (2 * aspect), .12) * 1.28;
  camera.zoom = 1; resize(); controls.update();
}
function reset() { setAutoRotate(false); fit(true); }
function setTarget(value) {
  targetType = ['wood', 'metal', 'cloth'].includes(value) ? value : 'none';
  $('target').value = targetType;
  targetBlock.visible = targetType !== 'none';
  const colors = { wood: 0xb8864d, metal: 0x608b81, cloth: 0xe7d8ad };
  if (colors[targetType]) targetBlock.material.color.setHex(colors[targetType]);
  if (active) { targetBlock.position.copy(active.origin); targetBlock.position.y -= .045; targetBlock.updateMatrixWorld(true); fit(false); }
  window.__vfxStats.target = targetType;
}
async function parseAsset(item) {
  if (cache.has(item.id)) return cache.get(item.id);
  const bytes = bytesFor(item.asset), gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  const source = gltf.scene;
  if (!source) throw new Error(item.id + ': GLB에 장면이 없습니다.');
  let meshCount = 0, triangleCount = 0, nodeCount = 0;
  const textures = new Set();
  source.traverse(object => {
    nodeCount++;
    if (!object.isMesh) return;
    meshCount++; triangleCount += (object.geometry.index?.count || object.geometry.attributes.position?.count || 0) / 3;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  if (!meshCount) throw new Error(item.id + ': GLB에 메시가 없습니다.');
  const textureInfo = [...textures].map(texture => { const image = texture.source?.data || texture.image; return { width: image?.width || 0, height: image?.height || 0, ready: Boolean(image && (image.width > 0 || image.data)) }; });
  if (textureInfo.some(texture => !texture.ready)) throw new Error(item.id + ': 텍스처 디코딩이 완료되지 않았습니다.');
  const clip = gltf.animations[0] || null, clipDuration = clip?.duration || 0;
  const mixer = new THREE.AnimationMixer(source), action = clip ? mixer.clipAction(clip) : null;
  const animationBounds = new THREE.Box3();
  // Effects can have zero scale at frame zero. Fit their complete real clip,
  // sampling a stable union instead of fitting a single invisible frame.
  for (let sample = 0; sample <= (action ? 24 : 0); sample++) {
    if (action) {
      action.reset(); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play(); mixer.setTime(clipDuration * sample / 24);
    }
    source.updateMatrixWorld(true);
    animationBounds.union(new THREE.Box3().setFromObject(source));
  }
  if (animationBounds.isEmpty()) throw new Error(item.id + ': 효과의 표시 범위를 찾을 수 없습니다.');
  const size = animationBounds.getSize(new THREE.Vector3()), center = animationBounds.getCenter(new THREE.Vector3());
  const scale = 3 / Math.max(size.x, size.y, size.z, .001);
  const root = new THREE.Group(), normalization = new THREE.Group();
  normalization.scale.setScalar(scale); normalization.position.copy(center).multiplyScalar(-scale);
  normalization.add(source); root.add(normalization);
  root.name = item.id + ' / display normalization (original GLB unchanged)';
  const displayBounds = animationBounds.clone().applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale)).translate(center.clone().multiplyScalar(-scale));
  const animatedNodes = new Set((clip?.tracks || []).map(track => track.name.replace(/\.[^.]+$/, '')));
  const stats = { sourceBytes: bytes.length, nodeCount, meshCount, triangleCount: Math.round(triangleCount), textureCount: textures.size, texturesReady: textureInfo.every(texture => texture.ready), textures: textureInfo, animationClipCount: gltf.animations.length, animationTrackCount: clip?.tracks.length || 0, animatedNodeCount: animatedNodes.size, activeClip: clip?.name || null, duration: clipDuration, originalAnimationBounds: { min: animationBounds.min.toArray(), max: animationBounds.max.toArray() } };
  const result = { root, source, mixer, action, clip, duration: clipDuration, displayBounds, origin: center.clone().multiplyScalar(-scale), stats, bytes };
  cache.set(item.id, result); window.__vfxStats.models[item.id] = stats;
  return result;
}
function populateEffects(filter = 'all') {
  $('effect-select').replaceChildren();
  for (const item of DATA.items.filter(item => filter === 'all' || (item.weapon_id || 'common') === filter)) {
    const option = document.createElement('option'); option.value = item.id; option.textContent = (item.name_ko || item.id) + (item.available ? '' : ' · 제작 대기'); option.disabled = !item.available; $('effect-select').append(option);
  }
}
async function selectEffect(id) {
  const item = DATA.items.find(item => item.id === id && item.available);
  if (!item) return false;
  const currentTicket = ++ticket;
  window.__vfxReady = false; window.__vfxStats.ready = false;
  $('loading').hidden = false; $('loading').classList.remove('error'); $('loading').textContent = (item.name_ko || item.id) + ' 모델과 애니메이션을 준비하고 있습니다';
  const result = await parseAsset(item);
  if (currentTicket !== ticket) return false;
  if (active) scene.remove(active.root);
  active = result; selected = item; duration = active.duration; scene.add(active.root);
  if (![...$('effect-select').options].some(option => option.value === id)) { $('weapon-filter').value = 'all'; populateEffects(); }
  $('effect-select').value = id;
  $('stage-title').textContent = item.name_ko || id;
  $('stage-detail').textContent = active.clip ? `${active.stats.animatedNodeCount}개 노드 · ${duration.toFixed(2)}초 실제 변환 애니메이션` : '애니메이션이 없는 정적 GLB';
  $('effect-name').textContent = item.name_ko || id; $('effect-english').textContent = item.name_en || ''; $('effect-purpose').textContent = item.purpose || '';
  $('timeline').max = String(duration); $('timeline').disabled = !active.action; $('play').disabled = !active.action; $('replay').disabled = !active.action;
  // Preview repeats even one-shot effects, so a 0.2s flash remains discoverable.
  // This viewer preference does not change the original recipe's loop policy.
  setLoop(true); setAutoRotate(false); evaluateTime(0); setTarget(targetType); applyOutline(); reset();
  Object.assign(window.__vfxStats, active.stats, { selectedId: id, weaponId: item.weapon_id || 'common', category: item.category || '', catalogDuration: item.duration, error: null });
  await renderer.compileAsync(scene, camera);
  if (outlined) effect.render(scene, camera); else renderer.render(scene, camera);
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  downloadURL = URL.createObjectURL(new Blob([active.bytes], { type: 'model/gltf-binary' }));
  $('download').href = downloadURL; $('download').download = id + '.glb'; $('download').removeAttribute('aria-disabled');
  $('model-stats').textContent = `${active.stats.meshCount}개 메시 · ${active.stats.triangleCount.toLocaleString('ko-KR')}개 삼각형 · ${active.stats.animationClipCount}개 클립 · ${active.stats.animationTrackCount}개 트랙`;
  setPlaying(true); window.__vfxStats.ready = true; window.__vfxReady = true; $('loading').hidden = true;
  return true;
}
async function initialize() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0, 0);
  renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', 'GLB 전투 효과 애니메이션. 드래그 회전, 휠 확대.'); stage.prepend(renderer.domElement);
  scene = new THREE.Scene(); camera = new THREE.OrthographicCamera(-3, 3, 2, -2, .01, 1000); camera.position.copy(direction).multiplyScalar(12);
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .085; controls.minZoom = .25; controls.maxZoom = 8; controls.autoRotateSpeed = .7; controls.screenSpacePanning = true;
  scene.add(new THREE.AmbientLight(0xffffff, 1)); const light = new THREE.DirectionalLight(0xffffff, 1.6); light.position.set(4, 8, 5); scene.add(light);
  effect = new OutlineEffect(renderer, { defaultThickness: .0015, defaultColor: [.025, .04, .035], defaultKeepAlive: true });
  // OutlineEffect overwrites renderer.autoClear; explicitly clear every base
  // frame so moving animated meshes do not accumulate into trails.
  effect.autoClear = true;
  const targetMaterial = new THREE.MeshBasicMaterial({ color: 0xb8864d }); materials.add(targetMaterial);
  targetBlock = new THREE.Mesh(new THREE.BoxGeometry(.8, .09, .8), targetMaterial); targetBlock.name = 'Display-only comparison target, no hit detection'; targetBlock.visible = false; scene.add(targetBlock);
  const weaponIDs = [...new Set(DATA.items.filter(item => item.available).map(item => item.weapon_id || 'common'))];
  for (const id of weaponIDs) { const option = document.createElement('option'); option.value = id; option.textContent = names[id] || id; $('weapon-filter').append(option); }
  populateEffects(); $('effect-count').textContent = `${DATA.items.filter(item => item.available).length}개 실제 GLB`;
  $('weapon-filter').addEventListener('change', event => {
    const filter = event.target.value; populateEffects(filter);
    const match = DATA.items.find(item => item.available && (filter === 'all' || (item.weapon_id || 'common') === filter));
    if (match) selectEffect(match.id).catch(fail);
  });
  $('effect-select').addEventListener('change', event => selectEffect(event.target.value).catch(fail));
  $('play').addEventListener('click', () => setPlaying(!playing));
  $('replay').addEventListener('click', () => { evaluateTime(0); setPlaying(true); });
  $('loop').addEventListener('change', event => setLoop(event.target.checked));
  $('speed').addEventListener('change', event => setSpeed(event.target.value));
  $('timeline').addEventListener('input', event => setTime(event.target.value));
  $('outline').addEventListener('change', event => { outlined = event.target.checked; applyOutline(); });
  $('target').addEventListener('change', event => setTarget(event.target.value));
  $('background').addEventListener('click', () => setBackground(!deep));
  $('reset').addEventListener('click', reset); $('fit').addEventListener('click', () => fit(false)); $('rotate').addEventListener('click', () => setAutoRotate(!controls.autoRotate));
  window.__vfxWorkbench = { selectEffect, setTime, setPlaying, setLoop, setSpeed, reset, fit: () => fit(false), setAutoRotate, setBackground, setTarget, renderer, camera, controls, effect, scene,
    get root() { return active?.root; }, get mixer() { return active?.mixer; }, get action() { return active?.action; }, get selected() { return selected; },
    availableItems: DATA.items.filter(item => item.available).map(({ asset, ...metadata }) => metadata),
  };
  new ResizeObserver(() => active ? fit(false) : resize()).observe(stage);
  const requested = new URLSearchParams(location.search).get('effect');
  const initial = DATA.items.find(item => item.available && item.id === requested) || DATA.items.find(item => item.available);
  setBackground('cream'); await selectEffect(initial.id);
  function animate(time) {
    requestAnimationFrame(animate);
    const delta = Math.min(Math.max((time - lastFrame) / 1000, 0), .1); lastFrame = time;
    if (playing && duration > 0) {
      const next = currentTime + delta * speed;
      if (next >= duration) {
        if (loop) evaluateTime(next % duration);
        else { evaluateTime(duration); setPlaying(false); }
      } else evaluateTime(next);
    }
    controls.update(delta);
    if (outlined) effect.render(scene, camera); else renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
  window.addEventListener('beforeunload', () => { if (downloadURL) URL.revokeObjectURL(downloadURL); }, { once: true });
}
initialize().catch(fail);
