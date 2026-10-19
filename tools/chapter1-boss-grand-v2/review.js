import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

// The sky is CSS exhibition decoration. Only the loaded GLB contributes to asset stats.
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const stage = $('#stage');
const modeDescriptions = {
  handdrawn: '에셋에 그린 재료색과 면 명암을 그대로 살리고 가는 윤곽을 더합니다.',
  cel: '재료색을 유지하면서 세 단계의 조명 명암으로 입체 구조를 강조합니다.',
  original: 'GLB에 담긴 원본 재질을 검수용 조명 아래에서 확인합니다.',
};
const groupLabels = { hull:'철갑 선체', buoyancy:'봉제 기낭', keep:'괴수형 선수', bell_tower:'중앙 종실', bastions:'측면 포대', dock:'인양 윈치', machinery:'추진 기관', banners:'장례 장막' };
const modeLabels = { handdrawn:'손그림', cel:'셀 명암', original:'원본' };
const viewLabels = { iso:'입체 시점', front:'정면', back:'후면', top:'위에서' };
let renderer, effect, camera, controls, scene, root;
let currentMode = 'handdrawn', currentView = 'iso', activeFocus = null, outlineEnabled = true;
let outlineColor = [0.055,0.065,0.09], outlineAlpha=1;
let outlineWidth = 1.5, modelBytes, frame = 0, lastFrame = 0, paused = false;
let atmosphere = true; let mixer, baseline, motionEnabled=false, baselineEnabled=false;
let fullBounds, frustumHeight = 40;
let observedWidth = 0, observedHeight = 0;
const stats = {};
const allMaterials = new Set();
const toonCache = new Map();
const groupNodes = new Map();
const modelMeshes = [];
const originalMaterials = new Map();
let toastTimeout;
const storageKey = 'cloudstitch.chapter1-boss-grand-v2.art-review';

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 3300);
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.style.display = 'none';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
function fail(error) {
  window.__bossReady = false;
  window.__bossError = error instanceof Error ? error.message : String(error);
  const loader = $('#loader'); loader.hidden = false; loader.classList.add('error');
  $('#load-title').textContent = '3D 화면을 열지 못했습니다';
  $('#load-detail').textContent = 'WebGL 2를 지원하는 브라우저에서 다시 열어주세요. ' + window.__bossError;
  console.error(error);
}
function updateStatus() {
  $('#view-status').textContent = modeLabels[currentMode] + ' · ' + (activeFocus ? groupLabels[activeFocus] : viewLabels[currentView]);
}
function setOutline(enabled) {
  outlineEnabled = Boolean(enabled); $('#outline').checked = outlineEnabled; render();
}
function setOutlineWidth(value) {
  outlineWidth = THREE.MathUtils.clamp(Number(value), 0, 8);
  $('#outline-width').value = String(outlineWidth); $('#outline-value').value = String(outlineWidth);
  allMaterials.forEach(material => {
    material.userData.outlineParameters = { thickness:outlineWidth * .001, color:outlineColor, alpha:outlineAlpha, keepAlive:true };
  });
  render();
}
function makeToonMaterial(original, mode) {
  const key = original.uuid + ':' + mode;
  if (toonCache.has(key)) return toonCache.get(key);
  const parameters = {
    name:original.name + ' / ' + mode,
    color:original.color ? original.color.clone() : new THREE.Color(0xffffff),
    map:original.map || null, vertexColors:original.vertexColors,
    side:original.side, transparent:original.transparent, opacity:original.opacity,
    alphaTest:original.alphaTest, depthWrite:original.depthWrite,
    polygonOffset:original.polygonOffset, polygonOffsetFactor:original.polygonOffsetFactor,
    polygonOffsetUnits:original.polygonOffsetUnits,
  };
  let material;
  if (mode === 'handdrawn') {
    material = new THREE.MeshBasicMaterial(parameters);
  } else {
    const data = new Uint8Array([105, 178, 245]);
    const gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false; gradient.needsUpdate = true;
    material = new THREE.MeshToonMaterial({
      ...parameters, gradientMap:gradient,
      emissive:original.emissive?.clone() || new THREE.Color(0),
      emissiveMap:original.emissiveMap || null,
      emissiveIntensity:original.emissiveIntensity ?? 1,
      normalMap:original.normalMap || null,
    });
  }
  toonCache.set(key, material); allMaterials.add(material);
  material.userData.outlineParameters = { thickness:outlineWidth * .001, color:outlineColor, alpha:outlineAlpha, keepAlive:true };
  return material;
}
function setMode(mode) {
  if (mode === 'hand') mode = 'handdrawn';
  if (!Object.hasOwn(modeLabels, mode)) throw new Error('Unknown material mode: ' + mode);
  currentMode = mode;
  modelMeshes.forEach(mesh => {
    const source = originalMaterials.get(mesh);
    mesh.material = mode === 'original' ? source : Array.isArray(source) ? source.map(material => makeToonMaterial(material, mode)) : makeToonMaterial(source, mode);
  });
  $$('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  $('#mode-help').textContent = modeDescriptions[mode];
  updateStatus(); render();
}
function render() {
  if (!renderer || !scene || !camera || renderer.getContext().isContextLost()) return;
  // The effect itself must clear every frame. renderer.autoClear alone is insufficient.
  effect.autoClear = true;
  if (outlineEnabled) effect.render(scene, camera); else renderer.render(scene, camera);
}
function resize() {
  if (!renderer || !camera) return;
  const width = Math.max(stage.clientWidth, 1), height = Math.max(stage.clientHeight, 1);
  const aspect = width / height;
  camera.top = frustumHeight / 2; camera.bottom = -frustumHeight / 2;
  camera.left = -frustumHeight * aspect / 2; camera.right = frustumHeight * aspect / 2;
  camera.updateProjectionMatrix();
  effect.setSize(width, height);
  render();
}
function visibleBounds(object = root) {
  const box = new THREE.Box3();
  object.updateMatrixWorld(true);
  object.traverseVisible(node => { if (node.isMesh) box.expandByObject(node); });
  return box.isEmpty() ? fullBounds.clone() : box;
}
function fit(object = root) {
  if (!root) return;
  if (object === root && activeFocus) {
    activeFocus = null;
    $$('[data-focus]').forEach(button => button.setAttribute('aria-pressed','false'));
    $$('[data-view]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.view===currentView)));
    updateStatus();
  }
  const bounds = visibleBounds(object);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const direction = camera.position.clone().sub(controls.target).normalize();
  if (direction.lengthSq() < .01) direction.set(1.1,.62,1.4).normalize();
  const distance = Math.max(size.length() * 2, 10);
  camera.position.copy(center).addScaledVector(direction, distance);
  controls.target.copy(center); camera.lookAt(center); camera.updateMatrixWorld(true);
  // Project the bounds onto the current camera basis so tall towers and long docks fit.
  const inverse = camera.matrixWorldInverse;
  const projected = new THREE.Box3();
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) {
    projected.expandByPoint(new THREE.Vector3(x?bounds.max.x:bounds.min.x,y?bounds.max.y:bounds.min.y,z?bounds.max.z:bounds.min.z).applyMatrix4(inverse));
  }
  const projectedSize = projected.getSize(new THREE.Vector3());
  const aspect = Math.max(stage.clientWidth, 1) / Math.max(stage.clientHeight, 1);
  const margin = object === root ? 1.19 : 1.35;
  frustumHeight = Math.max(projectedSize.y, projectedSize.x / aspect, .1) * margin;
  // Reserve the bottom strip for the on-canvas controls.
  if (stage.clientWidth < 440) frustumHeight *= 1.12;
  camera.zoom = 1;
  camera.near = .05; camera.far = Math.max(fullBounds.getSize(new THREE.Vector3()).length() * 30, 2000);
  controls.minZoom = .25; controls.maxZoom = 12;
  controls.update(); resize();
}
function setAutoRotate(enabled) {
  if (!controls) return;
  controls.autoRotate = Boolean(enabled);
  $('#auto-rotate').setAttribute('aria-pressed', String(controls.autoRotate));
}
function setView(view) {
  if (!root || !Object.hasOwn(viewLabels, view)) return;
  currentView = view; activeFocus = null;
  const dirs = { iso:[-1.4,.64,1.6], front:[-2,0,0], back:[2,0,0], top:[0,2,.001] };
  const center = fullBounds.getCenter(new THREE.Vector3());
  camera.position.copy(center).add(new THREE.Vector3(...dirs[view]).multiplyScalar(fullBounds.getSize(new THREE.Vector3()).length()));
  controls.target.copy(center);
  camera.up.set(0,1,0);
  $$('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  $$('[data-focus]').forEach(button => button.setAttribute('aria-pressed','false'));
  fit(); updateStatus();
}
function focus(name) {
  if(baselineEnabled)setBaseline(false);
  const object = groupNodes.get(name);
  if (!object) { toast('이 구조를 찾을 수 없습니다.'); return false; }
  object.visible = true;
  const checkbox = document.querySelector('[data-group="' + name + '"]');
  if (checkbox) checkbox.checked = true;
  activeFocus = name;
  $$('[data-view]').forEach(button => button.setAttribute('aria-pressed','false'));
  $$('[data-focus]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.focus === name)));
  fit(object); updateStatus(); return true;
}
function setGroupVisible(name, visible) {
  const object = groupNodes.get(name);
  if (!object) return false;
  object.visible = Boolean(visible);
  const checkbox = document.querySelector('[data-group="' + name + '"]');
  if (checkbox) checkbox.checked = object.visible;
  render(); return true;
}
function setAtmosphere(enabled) {
  atmosphere = Boolean(enabled);
  $('.sky').hidden = !atmosphere;
  $('.viewer').style.background = atmosphere ? '' : 'transparent';
  render();
}
function reset() {
  if (!root) return;
  setMotion(false); if(mixer)mixer.setTime(0); setBaseline(false);
  setAutoRotate(false);
  groupNodes.forEach((object, name) => setGroupVisible(name, true));
  outlineColor=[0.055,0.065,0.09];outlineAlpha=1;$('#outline-color').value='#0e1117';$('#outline-alpha').value='1';$('#outline-alpha-value').value='1';setOutline(true); setOutlineWidth(1.5); setMode('handdrawn'); setView('iso'); setAtmosphere(true);
}
function setMotion(enabled) {
  motionEnabled=Boolean(enabled); paused = !enabled; if(mixer)mixer.timeScale=motionEnabled?1:0; const button=document.querySelector("#motion"); if(button)button.setAttribute("aria-pressed",String(motionEnabled));
  if (paused) { setAutoRotate(false); if (controls) controls.enableDamping = false; }
  else if (controls) controls.enableDamping = true;
  render();
}
function loop(time) {
  frame = requestAnimationFrame(loop);
  if (document.hidden || (paused && !controls?.autoRotate)) { lastFrame = time; return; }
  const delta = Math.min((time - lastFrame) / 1000 || .016, .05); lastFrame = time;
  if (controls && (controls.autoRotate || controls.enableDamping)) controls.update(delta);
  if(motionEnabled && mixer && !baselineEnabled){mixer.update(delta);render();}
}

// Local review notes are never sent to a server. Storage failure is visible and export stays usable.
let review = { schema:'cloudstitch-art-review-v1', asset:'chapter1-boss-grand-v2', title:'종을 삼킨 자', checks:{}, comment:'', updatedAt:null };
function reviewPayload() {
  return { ...review, view:{ mode:currentMode, preset:currentView, focus:activeFocus, outline:outlineEnabled, outlineWidth }, assetStats:{...stats}, localOnly:true };
}
function reviewSummary() {
  const checked = Object.values(review.checks).filter(Boolean).length;
  $('#review-summary').textContent = review.updatedAt ? `${checked}/4개 항목 확인 · 로컬 검수 의견 ${review.comment ? '있음' : '없음'}` : '이 브라우저에만 저장됩니다. JSON으로 내보낼 수 있습니다.';
}
function saveReview() {
  review.checks = Object.fromEntries($$('[data-check]').map(input => [input.dataset.check, input.checked]));
  review.comment = $('#review-comment').value;
  review.updatedAt = new Date().toISOString();
  try { localStorage.setItem(storageKey, JSON.stringify(reviewPayload())); $('#save-status').textContent = '이 브라우저에 자동 저장했습니다.'; }
  catch { $('#save-status').textContent = '브라우저 저장이 제한되어 있습니다. JSON 내보내기로 보관해주세요.'; }
  reviewSummary();
}
function initReview() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && saved.asset === review.asset) {
      review = { ...review, checks:saved.checks || {}, comment:String(saved.comment || '').slice(0,8000), updatedAt:saved.updatedAt || null };
    }
  } catch { /* An absent/unavailable localStorage does not block rendering or export. */ }
  $$('[data-check]').forEach(input => { input.checked = Boolean(review.checks[input.dataset.check]); input.addEventListener('change', saveReview); });
  $('#review-comment').value = review.comment;
  $('#review-comment').addEventListener('input', saveReview);
  reviewSummary();
  $('#export-review').addEventListener('click', () => {
    saveReview(); downloadBlob(new Blob([JSON.stringify(reviewPayload(), null, 2)], {type:'application/json;charset=utf-8'}), 'cloudstitch-boss-review.json'); toast('검수 기록을 JSON으로 내보냈습니다.');
  });
  $('#copy-review').addEventListener('click', async () => {
    saveReview();
    const text = 'Cloudstitch / 종을 삼킨 자\n' + Object.entries(groupLabels).length + '개 구조의 3D 아트 검수\n\n' + $$('[data-check]').map(input => (input.checked ? '[확인] ' : '[미확인] ') + input.parentElement.textContent.trim()).join('\n') + '\n\n수정 의견\n' + (review.comment || '(없음)') + '\n\n로컬 기록 · ' + review.updatedAt;
    try { await navigator.clipboard.writeText(text); toast('검수 의견을 복사했습니다.'); }
    catch {
      const textarea = document.createElement('textarea'); textarea.value = text;
      textarea.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(textarea); textarea.select();
      const copied = document.execCommand('copy'); textarea.remove();
      toast(copied ? '검수 의견을 복사했습니다.' : '복사가 제한되어 있습니다. JSON 내보내기를 이용해주세요.');
    }
  });
}
function setBaseline(enabled){baselineEnabled=Boolean(enabled);if(baseline)baseline.visible=baselineEnabled;if(root)root.visible=!baselineEnabled;document.querySelector('#compare-old')?.setAttribute('aria-pressed',String(baselineEnabled));document.querySelector('#comparison-state').textContent=baselineEnabled?'이전 3D · 동일 카메라 / 길이 기준 정규화':'새 보스 · 무드보드 기반';render();}
function initUi() {
  document.querySelector('#motion').addEventListener('click',()=>setMotion(!motionEnabled));
  document.querySelector('#compare-old').addEventListener('click',()=>setBaseline(!baselineEnabled));
  $('#open-reference').addEventListener('click', () => $('#reference-dialog').showModal());
  $('#open-review').addEventListener('click', () => $('#review-dialog').showModal());
  $$('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
  $$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const rect=dialog.getBoundingClientRect(); if (event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) dialog.close(); } }));
  $$('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $$('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $$('[data-focus]').forEach(button => button.addEventListener('click', () => focus(button.dataset.focus)));
  $('#outline-color').addEventListener('input',()=>{const c=new THREE.Color($('#outline-color').value);outlineColor=c.toArray();setOutlineWidth(outlineWidth);});
  $('#outline-alpha').addEventListener('input',()=>{outlineAlpha=Number($('#outline-alpha').value);$('#outline-alpha-value').value=outlineAlpha;setOutlineWidth(outlineWidth);});
  $('#outline').addEventListener('change', () => setOutline($('#outline').checked));
  $('#outline-width').addEventListener('input', () => setOutlineWidth($('#outline-width').value));
  $('#fit').addEventListener('click', () => { fit(); updateStatus(); });
  $('#reset').addEventListener('click', reset);
  $('#auto-rotate').addEventListener('click', () => setAutoRotate(!controls.autoRotate));
  $('#download-glb').addEventListener('click', () => { if (modelBytes) downloadBlob(new Blob([modelBytes], {type:'model/gltf-binary'}), 'boss.glb'); });
  stage.addEventListener('keydown', event => {
    if (event.target !== stage && event.target !== renderer?.domElement) return;
    if (event.key === '+' || event.key === '=') { camera.zoom=Math.min(camera.zoom*1.15,12); event.preventDefault(); }
    else if (event.key === '-') { camera.zoom=Math.max(camera.zoom/1.15,.25); event.preventDefault(); }
    else if (event.key.toLowerCase() === 'r') { reset(); event.preventDefault(); }
    else return;
    camera.updateProjectionMatrix(); render();
  });
  initReview();
}

async function init() {
  window.__bossReady = false;
  initUi();
  const base64 = $('#glb-data').textContent.trim();
  const binary = atob(base64); modelBytes = new Uint8Array(binary.length);
  for (let i=0;i<binary.length;i++) modelBytes[i]=binary.charCodeAt(i);
  renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000,0); renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NoToneMapping; renderer.autoClear=true;
  renderer.domElement.setAttribute('aria-label','회전 가능한 종을 삼킨 자 3D 모델');
  renderer.domElement.setAttribute('tabindex','0');
  stage.insertBefore(renderer.domElement,stage.firstChild);
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(new Error('WebGL 화면 연결이 해제되었습니다. 페이지를 새로고침해주세요.')); });
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-30,30,30,-30,.05,3000);
  camera.position.set(60,38,70);
  controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true; controls.dampingFactor=.09; controls.autoRotate=false; controls.autoRotateSpeed=.45;
  controls.minPolarAngle=.025; controls.maxPolarAngle=Math.PI-.025;
  controls.addEventListener('change',render);
  effect = new OutlineEffect(renderer,{defaultThickness:.0015,defaultColor:[.12,.15,.15],defaultAlpha:1});
  effect.autoClear = true;
  scene.add(new THREE.HemisphereLight(0xfff0d7,0x8d9d9d,1.65));
  const key = new THREE.DirectionalLight(0xffe6bd,2.0); key.position.set(-40,70,55); scene.add(key);
  const fill = new THREE.DirectionalLight(0xb9d6d3,.7); fill.position.set(50,25,-30); scene.add(fill);
  const gltf=await new GLTFLoader().parseAsync(modelBytes.buffer,'');
  root=gltf.scene; root.name = root.name || 'bell_devourer';
  scene.add(root); root.updateMatrixWorld(true);
  fullBounds=new THREE.Box3().setFromObject(root);
  mixer=new THREE.AnimationMixer(root);for(const clip of gltf.animations)mixer.clipAction(clip).play();mixer.timeScale=0;
  const oldBinary=Uint8Array.from(atob(document.querySelector('#baseline-data').textContent.trim()),c=>c.charCodeAt(0));
  const previous=await new GLTFLoader().parseAsync(oldBinary.buffer,'');baseline=previous.scene;const oldBounds=new THREE.Box3().setFromObject(baseline);const factor=1;baseline.scale.setScalar(factor);const c=oldBounds.getCenter(new THREE.Vector3()).multiplyScalar(factor);baseline.position.set(-c.x,fullBounds.min.y-oldBounds.min.y*factor,-c.z);baseline.visible=false;scene.add(baseline);baseline.traverse(n=>{if(!n.isMesh)return;modelMeshes.push(n);originalMaterials.set(n,n.material);for(const mat of Array.isArray(n.material)?n.material:[n.material])allMaterials.add(mat);});
  const materials = new Set(), geometries=new Set(); let triangles=0,vertices=0,meshes=0;
  root.traverse(node => {
    if (Object.hasOwn(groupLabels,node.name) && !groupNodes.has(node.name)) groupNodes.set(node.name,node);
    if (!node.isMesh) return;
    modelMeshes.push(node); originalMaterials.set(node,node.material);
    meshes++;
    if (node.geometry?.attributes.position) {
      triangles += (node.geometry.index ? node.geometry.index.count : node.geometry.attributes.position.count) / 3;
      vertices += node.geometry.attributes.position.count; geometries.add(node.geometry.uuid);
    }
    (Array.isArray(node.material)?node.material:[node.material]).forEach(material => { materials.add(material.uuid); allMaterials.add(material); });
  });
  Object.assign(stats,{triangles:Math.round(triangles),meshes,materials:materials.size,vertices,geometries:geometries.size,bytes:modelBytes.byteLength,animations:gltf.animations.length,groups:[...groupNodes.keys()],bounds:fullBounds.getSize(new THREE.Vector3()).toArray()});
  Object.defineProperties(stats,{
    mode:{enumerable:true,get:()=>currentMode},view:{enumerable:true,get:()=>currentView},
    focus:{enumerable:true,get:()=>activeFocus},outline:{enumerable:true,get:()=>outlineEnabled},outlineEnabled:{enumerable:true,get:()=>outlineEnabled},
  });
  $('#stat-triangles').textContent=stats.triangles.toLocaleString('ko-KR');
  $('#stat-meshes').textContent=stats.meshes.toLocaleString('ko-KR');
  $('#stat-materials').textContent=stats.materials.toLocaleString('ko-KR');
  $('#stat-size').innerHTML=(stats.bytes/1048576).toFixed(1)+' <small>MB</small>';
  $('#asset-note').textContent=`내장 GLB 실측 · ${groupNodes.size}개 구조 그룹\n애니메이션 ${gltf.animations.length}개 · 종/프로펠러 전시용 클립`;
  $('#asset-note').style.whiteSpace='pre-line';
  for (const [name,label] of Object.entries(groupLabels)) {
    const item=document.createElement('label'); item.className='checkbox-label';
    const input=document.createElement('input');input.type='checkbox';input.checked=true;input.dataset.group=name;
    input.disabled=!groupNodes.has(name); input.addEventListener('change',()=>setGroupVisible(name,input.checked));
    item.append(input,document.createTextNode(label));$('#group-toggles').append(item);
    const button=document.querySelector('[data-focus="'+name+'"]');if(button)button.disabled=!groupNodes.has(name);
  }
  setOutlineWidth(outlineWidth);setMode('handdrawn');setView('iso');
  new ResizeObserver(() => {
    const width=stage.clientWidth,height=stage.clientHeight;
    if(width===observedWidth&&height===observedHeight)return;
    observedWidth=width;observedHeight=height;
    // Reframe on a real layout change, preserving the user's orbit direction.
    if(root)fit(activeFocus?groupNodes.get(activeFocus)||root:root);else resize();
  }).observe(stage);
  $('#download-glb').disabled=false;$('#loader').hidden=true;
  window.__bossReview={renderer,effect,camera,controls,scene,root,mixer,setBaseline,get motionEnabled(){return motionEnabled},setMode,setView,fit,reset,setAutoRotate,render,stats,focus,setOutline,setOutlineWidth,setGroupVisible,setAtmosphere,setEnvironment:setAtmosphere,setMotion,storageKey,getReview:reviewPayload,pause:()=>setMotion(false),resume:()=>setMotion(true),get mode(){return currentMode},get view(){return currentView},get focusName(){return activeFocus},get outlineEnabled(){return outlineEnabled},get outlineWidth(){return outlineWidth},get atmosphere(){return atmosphere}};
  window.__bossReady=true;
  frame=requestAnimationFrame(loop);
}
init().catch(fail);

