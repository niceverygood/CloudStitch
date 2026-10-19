import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

const DATA = __WORLD_DATA__, $ = id => document.getElementById(id), stage = $('stage');
const cache = new Map(), records = [], originals = new Set(), converted = new Map();
const views = { iso: [-7, 5.5, 7], front: [0, .08, 1], back: [0, .08, -1], top: [0, 1, .00001] };
const categoryNames = {islands:'공중섬',clouds:'구름과 대기',birds:'하늘의 새',nature:'나무와 식생',props:'항로와 생활'};
const gradient = new THREE.DataTexture(new Uint8Array([70, 155, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.generateMipmaps = false; gradient.needsUpdate = true;
let renderer, effect, camera, controls, scene, ambient, key, fill, boxHelper, axesHelper;
let active, selected, downloadURL, ticket = 0, searchTimer;
let mode = 'handdrawn', outlined = true, thickness = 1.1, halfHeight = 2, currentView = 'iso', deep = false, animationPlaying = false, lastFrame = performance.now();
const bounds = new THREE.Box3(), target = new THREE.Vector3();
window.__worldReady = false;
window.__worldStats = { ready: false, offline: true, selectedId: null, mode, outlineEnabled: outlined, models: {} };

function fail(error) {
  window.__worldReady = false; window.__worldStats.ready = false; window.__worldStats.error = String(error?.message || error);
  $('loading').hidden = false; $('loading').classList.add('error'); $('loading').textContent = '모델을 표시하지 못했습니다. ' + window.__worldStats.error; console.error(error);
}
function materialFor(source) {
  if (mode === 'original') return source;
  const id = source.uuid + ':' + mode;
  if (converted.has(id)) return converted.get(id);
  // Both textured hero meshes and local vertex-painted meshes retain color.
  const common = { color: source.color?.clone() || new THREE.Color(0xffffff), map: source.map || null, alphaMap: source.alphaMap || null, opacity: source.opacity, transparent: source.transparent, alphaTest: source.alphaTest, side: source.side, vertexColors: source.vertexColors, depthWrite: source.depthWrite, depthTest: source.depthTest, visible: source.visible, toneMapped: false };
  const material = mode === 'cel' ? new THREE.MeshToonMaterial({ ...common, gradientMap: gradient }) : new THREE.MeshBasicMaterial(common);
  material.name = (source.name || 'world material') + ' / ' + mode; converted.set(id, material); return material;
}
function applyOutline() {
  const value = 2 * thickness / Math.max(stage.clientHeight, 1);
  for (const material of [...originals, ...converted.values()]) material.userData.outlineParameters = { thickness: value, color: [.02, .03, .025], alpha: 1, visible: outlined, keepAlive: true };
  Object.assign(window.__worldStats, { outlineEnabled: outlined, outlinePixels: thickness });
}
function setMode(value) {
  if (!['handdrawn', 'cel', 'original'].includes(value)) return;
  mode = value; ambient.intensity = value === 'cel' ? .18 : 1.05; key.intensity = value === 'cel' ? .92 : 2.1; fill.intensity = value === 'cel' ? .08 : .45;
  for (const record of records) record.mesh.material = Array.isArray(record.original) ? record.original.map(materialFor) : materialFor(record.original);
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === value)));
  window.__worldStats.mode = mode; applyOutline();
}
function refreshBounds() {
  if (!active) return;
  active.root.updateMatrixWorld(true); bounds.setFromObject(active.root); bounds.getCenter(target);
  if (boxHelper) boxHelper.box.copy(bounds);
  window.__worldStats.currentBounds = { min: bounds.min.toArray(), max: bounds.max.toArray() };
}
function resize() {
  const width = Math.max(stage.clientWidth, 1), height = Math.max(stage.clientHeight, 1); renderer.setSize(width, height, false);
  camera.left = -halfHeight * width / height; camera.right = halfHeight * width / height; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix(); applyOutline();
}
function fit() {
  if (!active) return;
  refreshBounds(); camera.position.add(target.clone().sub(controls.target)); controls.target.copy(target); camera.lookAt(target); camera.updateMatrixWorld(true);
  const aspect = Math.max(stage.clientWidth / stage.clientHeight, .1);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) {
    const point = new THREE.Vector3(x ? bounds.max.x : bounds.min.x, y ? bounds.max.y : bounds.min.y, z ? bounds.max.z : bounds.min.z).applyMatrix4(camera.matrixWorldInverse);
    minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
  }
  halfHeight = Math.max((maxY - minY) / 2, (maxX - minX) / (2 * aspect), .05) * 1.30; camera.zoom = 1; resize(); controls.update();
}
function setView(value) {
  if (!(value in views) || !active) return;
  // Drain orbit damping before replacing a preset; keep camera.up fixed for
  // OrbitControls. A tiny top-view Z offset avoids a collinear lookAt pole.
  const damping = controls.enableDamping; controls.enableDamping = false; controls.update(); controls.enableDamping = damping;
  refreshBounds(); camera.position.set(...views[value]).normalize().multiplyScalar(12).add(target); controls.target.copy(target); currentView = value;
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === value)));
  window.__worldStats.view = value; fit();
}
function setAutoRotate(value) { controls.autoRotate = Boolean(value); $('rotate').setAttribute('aria-pressed', String(controls.autoRotate)); window.__worldStats.autoRotate = controls.autoRotate; }
function reset() { setAutoRotate(false); setView('iso'); }
function setBackground(value) {
  deep = value === 'deepteal' || value === true; stage.classList.toggle('deep', deep); $('background').textContent = deep ? '배경 · 짙은 청록' : '배경 · 크림'; $('background').setAttribute('aria-pressed', String(deep)); window.__worldStats.background = deep ? 'deepteal' : 'cream';
}
function setPlaying(value) {
  animationPlaying = Boolean(value && active?.action); if (animationPlaying) for(const a of active.actions) { a.paused = false; a.setLoop(THREE.LoopRepeat, Infinity); a.play(); }
  $('animation-toggle').textContent = animationPlaying ? '일시정지' : '재생'; window.__worldStats.animationPlaying = animationPlaying;
}
function setTime(value) {
  setPlaying(false); if (!active?.action) return;
  const time = THREE.MathUtils.clamp(Number(value) || 0, 0, active.clip.duration); for(const a of active.actions){a.reset();a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play();} active.mixer.setTime(time); active.root.updateMatrixWorld(true); window.__worldStats.animationTime = time; refreshBounds(); if($('timeline'))$('timeline').value=time;
}
async function parseAsset(item) {
  if (cache.has(item.id)) return cache.get(item.id);
  const raw = atob(item.asset.base64), packed = new Uint8Array(raw.length); for (let index = 0; index < raw.length; index++) packed[index] = raw.charCodeAt(index);
  const bytes=item.asset.gzip ? new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()) : packed;
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, ''); if (!gltf.scene) throw new Error(item.id + ': GLB에 장면이 없습니다.');
  const source = gltf.scene; source.updateMatrixWorld(true); const sourceBox = new THREE.Box3().setFromObject(source); if (sourceBox.isEmpty()) throw new Error(item.id + ': GLB에 메시가 없습니다.');
  const size = sourceBox.getSize(new THREE.Vector3()), center = sourceBox.getCenter(new THREE.Vector3()), scale = 4 / Math.max(size.x, size.y, size.z, .001);
  const root = new THREE.Group(), normalization = new THREE.Group(); normalization.scale.setScalar(scale); normalization.position.set(-center.x * scale, -sourceBox.min.y * scale, -center.z * scale); normalization.add(source); root.add(normalization);
  root.name = item.id + ' / display-only ground normalization';
  let meshCount = 0, triangleCount = 0, nodeCount = 0, vertexColorMeshCount = 0; const textures = new Set(), sourceMaterials = new Set();
  source.traverse(object => {
    nodeCount++; if (!object.isMesh) return; meshCount++; triangleCount += (object.geometry.index?.count || object.geometry.attributes.position?.count || 0) / 3;
    if (object.geometry.attributes.color) vertexColorMeshCount++;
    records.push({ mesh: object, original: object.material });
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) { originals.add(material); sourceMaterials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); }
  });
  if (!meshCount) throw new Error(item.id + ': 표시할 메시가 없습니다.');
  const textureInfo = [...textures].map(texture => { const image = texture.source?.data || texture.image; return { width: image?.width || 0, height: image?.height || 0, ready: Boolean(image && (image.width > 0 || image.data)) }; });
  if (textureInfo.some(texture => !texture.ready)) throw new Error(item.id + ': 텍스처가 준비되지 않았습니다.');
  const mixer = new THREE.AnimationMixer(source), clip = gltf.animations.length ? {duration:Math.max(...gltf.animations.map(c=>c.duration))} : null, actions=gltf.animations.map(c=>mixer.clipAction(c)), action=actions[0]||null; for(const a of actions)a.play();
  const stats = { sourceBytes: bytes.length, meshCount, nodeCount, triangleCount: Math.round(triangleCount), vertexColorMeshCount, materialCount: sourceMaterials.size, textureCount: textures.size, texturesReady: textureInfo.every(texture => texture.ready), textures: textureInfo, animationClipCount: gltf.animations.length, animationDuration: clip?.duration || 0, originalBounds: { min: sourceBox.min.toArray(), max: sourceBox.max.toArray() }, displayNormalizationOnly: true };
  const result = { root, source, mixer, clip, action, actions, stats, bytes }; cache.set(item.id, result); window.__worldStats.models[item.id] = stats; return result;
}
function populateOptions() {
  const category = $('category-filter').value, query = $('search').value.trim().toLowerCase();
  const items = DATA.items.filter(item => (category === 'all' || item.category === category) && (!query || [item.id, item.name_ko, item.name_en, item.role].filter(Boolean).join(' ').toLowerCase().includes(query)));
  $('asset-select').replaceChildren(); for (const item of items) { const option = document.createElement('option'); option.value = item.id; option.textContent = (item.name_ko || item.id) + (item.available ? '' : ' · 제작 대기'); option.disabled = !item.available; $('asset-select').append(option); }
  $('asset-count').textContent = `${items.filter(item => item.available).length}개 선택 가능 / 전체 ${DATA.items.filter(item => item.available).length}개`;
  document.querySelectorAll('[data-card-id]').forEach(card=>{card.hidden=!items.some(i=>i.id===card.dataset.cardId);});
  const available = items.filter(item => item.available); $('asset-select').disabled = available.length === 0;
  if (!available.length) { if (active) active.root.visible = false; $('stage-title').textContent = '조건에 맞는 완료 모델이 없습니다'; return; }
  if (active) active.root.visible = true;
  const preserved = available.find(item => item.id === selected?.id); if (preserved) { $('asset-select').value = preserved.id; $('stage-title').textContent = preserved.name_ko || preserved.id; } else selectAsset(available[0].id).catch(fail);
}
async function selectAsset(id) {
  const item = DATA.items.find(item => item.id === id && item.available); if (!item) return false;
  const currentTicket = ++ticket; window.__worldReady = false; window.__worldStats.ready = false; $('loading').hidden = false; $('loading').classList.remove('error'); $('loading').textContent = (item.name_ko || id) + ' 모델과 텍스처를 준비하고 있습니다';
  const result = await parseAsset(item); if (currentTicket !== ticket) return false;
  if (active) scene.remove(active.root); active = result; selected = item; active.root.visible = true; scene.add(active.root);
  if (![...$('asset-select').options].some(option => option.value === id)) { $('category-filter').value = 'all'; $('search').value = ''; populateOptions(); }
  $('asset-select').value = id; $('stage-title').textContent = item.name_ko || id; $('stage-detail').textContent = categoryNames[item.category] || item.category || '실제 3D 모델';
  $('asset-name').textContent = item.name_ko || id; $('asset-english').textContent = item.name_en || ''; $('asset-role').textContent = item.role || ''; if($('motion-note'))$('motion-note').textContent=item.motion_ko||'';
  $('reference').hidden = !item.referenceDataURL; if (item.referenceDataURL) $('reference').src = item.referenceDataURL; else $('reference').removeAttribute('src');
  $('animation-toggle').disabled = !active.action; $('animation-info').textContent = active.action ? `${active.stats.animationClipCount}개 실제 클립 · ${active.clip.duration.toFixed(2)}초` : '애니메이션 없음';
  setMode(mode); reset(); setPlaying(Boolean(active.action));
  Object.assign(window.__worldStats, active.stats, { selectedId: id, category: item.category, buildMethod: item.build_method, kind: DATA.isScene ? 'scene' : 'asset', error: null });
  await renderer.compileAsync(scene, camera); if (outlined) effect.render(scene, camera); else renderer.render(scene, camera);
  if (downloadURL) URL.revokeObjectURL(downloadURL); downloadURL = URL.createObjectURL(new Blob([active.bytes], { type: 'model/gltf-binary' })); $('download').href = downloadURL; $('download').download = id + '.glb'; $('download').removeAttribute('aria-disabled');
  $('model-stats').textContent = `${active.stats.meshCount}개 메시 · ${active.stats.triangleCount.toLocaleString('ko-KR')}개 삼각형 · 텍스처 ${active.stats.textureCount}개 · vertex color ${active.stats.vertexColorMeshCount}개 메시`;
  if($('timeline')){ $('timeline').disabled=!active.action;$('timeline').max=active.clip?.duration||1;$('timeline').value=0; }
  document.querySelectorAll('[data-card-id]').forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.cardId===id)));
  window.__worldStats.ready = true; window.__worldReady = true; $('loading').hidden = true; return true;
}
async function initialize() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0, 0); renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', '실제 월드 3D 모델. 드래그 회전, 휠 확대.'); stage.prepend(renderer.domElement);
  scene = new THREE.Scene(); camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .01, 1000); camera.position.set(...views.iso).normalize().multiplyScalar(12);
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .085; controls.minZoom = .25; controls.maxZoom = 8; controls.autoRotateSpeed = .7; controls.screenSpacePanning = true;
  ambient = new THREE.AmbientLight(0xffffff, 1.05); key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(4, 8, 6); fill = new THREE.DirectionalLight(0xdce7eb, .45); fill.position.set(-6, 2, -4); scene.add(ambient, key, fill);
  effect = new OutlineEffect(renderer, { defaultThickness: .002, defaultColor: [.02, .03, .025], defaultKeepAlive: true });
  // OutlineEffect assigns its own autoClear to the renderer. Preserve this to
  // clear every rotating frame before the outline pass and prevent ghosting.
  effect.autoClear = true;
  boxHelper = new THREE.Box3Helper(bounds.clone(), 0x84a479); boxHelper.visible = false; axesHelper = new THREE.AxesHelper(1); axesHelper.visible = false; scene.add(boxHelper, axesHelper);
  for (const category of new Set(DATA.items.map(item => item.category).filter(Boolean))) { const option = document.createElement('option'); option.value = category; option.textContent = categoryNames[category] || category; $('category-filter').append(option); }
  for (const item of DATA.items) { const option = document.createElement('option'); option.value = item.id; option.textContent = (item.name_ko || item.id) + (item.available ? '' : ' · 제작 대기'); option.disabled = !item.available; $('asset-select').append(option); }
  $('asset-count').textContent = `${DATA.items.filter(item => item.available).length}개 실제 완료 모델`;
  $('category-filter').addEventListener('change', populateOptions); $('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(populateOptions, 180); }); $('asset-select').addEventListener('change', event => selectAsset(event.target.value).catch(fail));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode))); document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { setAutoRotate(false); setView(button.dataset.view); }));
  $('outline').addEventListener('change', event => { outlined = event.target.checked; applyOutline(); }); $('thickness').addEventListener('input', event => { thickness = Number(event.target.value); $('thickness-value').value = thickness.toFixed(1); applyOutline(); });
  $('bounds').addEventListener('change', event => { boxHelper.visible = event.target.checked; refreshBounds(); window.__worldStats.boundsVisible = boxHelper.visible; }); $('axes').addEventListener('change', event => { axesHelper.visible = event.target.checked; window.__worldStats.axesVisible = axesHelper.visible; }); $('animation-toggle').addEventListener('click', () => setPlaying(!animationPlaying));
  $('reset').addEventListener('click', reset); $('fit').addEventListener('click', fit); $('rotate').addEventListener('click', () => setAutoRotate(!controls.autoRotate)); $('background').addEventListener('click', () => setBackground(!deep));
  window.__worldWorkbench = { selectAsset, setMode, reset, fit, setAutoRotate, setBackground, setView, setPlaying, setTime, renderer, effect, camera, controls, scene,
    get root() { return active?.root; }, get mixer() { return active?.mixer; }, get selected() { return selected; },
    availableItems: DATA.items.filter(item => item.available).map(({ asset, referenceDataURL, ...metadata }) => metadata),
  };
  new ResizeObserver(() => active ? fit() : resize()).observe(stage);
  const requested = new URLSearchParams(location.search).get('asset'), initial = DATA.items.find(item => item.available && item.id === requested) || DATA.items.find(item => item.id==='root-garden') || DATA.items.find(item => item.available); setBackground('cream'); await selectAsset(initial.id);
  function animate(time) {
    requestAnimationFrame(animate); const delta = Math.min(Math.max((time - lastFrame) / 1000, 0), .1); lastFrame = time;
    if (animationPlaying && active?.action) { active.mixer.update(delta); window.__worldStats.animationTime = active.action.time; if($('timeline'))$('timeline').value=active.action.time; if (boxHelper.visible) refreshBounds(); }
    controls.update(delta); if (outlined) effect.render(scene, camera); else renderer.render(scene, camera);
  }
  requestAnimationFrame(animate); window.addEventListener('beforeunload', () => { if (downloadURL) URL.revokeObjectURL(downloadURL); }, { once: true });
}
async function captureComparison(id){
  const a=DATA.items.find(x=>x.id===id),b=(DATA.baselines||[]).find(x=>x.source_asset_id===id);if(!a||!b)throw Error('Missing comparison '+id);
  const [after,before]=await Promise.all([parseAsset(a),parseAsset(b)]),pair=[before,after];setPlaying(false);setAutoRotate(false);setMode('handdrawn');
  const saved=pair.map(r=>({r,pos:r.root.children[0].position.clone(),scale:r.root.children[0].scale.clone(),rot:r.root.rotation.clone()})),union=new THREE.Box3();
  for(const r of pair){r.root.rotation.set(0,0,0);const n=r.root.children[0];n.position.set(0,0,0);n.scale.setScalar(1);for(const action of r.actions){action.reset();action.play();}r.mixer.setTime(0);r.root.updateMatrixWorld(true);union.union(new THREE.Box3().setFromObject(r.root));}
  const center=union.getCenter(new THREE.Vector3()),extent=union.getSize(new THREE.Vector3()),s=4/Math.max(extent.x,extent.y,extent.z,.001);
  for(const r of pair){const n=r.root.children[0];n.scale.setScalar(s);n.position.copy(center).multiplyScalar(-s);r.root.updateMatrixWorld(true);}
  const size=renderer.getSize(new THREE.Vector2()),oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha();renderer.setSize(720,480,false);renderer.setClearColor(0xf3f0e4,1);
  const cam=new THREE.OrthographicCamera(-3,3,2,-2,.01,1000);cam.position.set(...views.iso).normalize().multiplyScalar(12);cam.lookAt(0,0,0);cam.updateMatrixWorld(true);
  const normalized=union.clone();normalized.min.sub(center).multiplyScalar(s);normalized.max.sub(center).multiplyScalar(s);
  let half=.1;for(const x of [normalized.min.x,normalized.max.x])for(const y of [normalized.min.y,normalized.max.y])for(const z of [normalized.min.z,normalized.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(cam.matrixWorldInverse);half=Math.max(half,Math.abs(p.y),Math.abs(p.x)/1.5);}half*=1.16;cam.left=-half*1.5;cam.right=half*1.5;cam.top=half;cam.bottom=-half;cam.updateProjectionMatrix();
  const temp=new THREE.Scene();temp.add(ambient.clone(),key.clone(),fill.clone());const png=[];
  try{for(const r of pair){temp.add(r.root);await renderer.compileAsync(temp,cam);effect.render(temp,cam);png.push(renderer.domElement.toDataURL('image/png'));temp.remove(r.root);}}
  finally{for(const old of saved){const n=old.r.root.children[0];n.position.copy(old.pos);n.scale.copy(old.scale);old.r.root.rotation.copy(old.rot);if(old.r===active)scene.add(old.r.root);}renderer.setClearColor(oldColor,oldAlpha);renderer.setSize(size.x,size.y,false);resize();fit();}
  return {id,before:png[0],after:png[1],camera:'shared orthographic camera',same_units_and_normalization:true,animation_time:0};
}
function attachGallery(){
  const grid=$('asset-grid');
  for(const item of DATA.items){
    const card=document.createElement('button');card.className='asset-card';card.dataset.cardId=item.id;card.setAttribute('aria-pressed',String(item.id===selected.id));
    const img=document.createElement('img');if(item.previewAvailable)img.src=item.preview||('previews/'+item.id+'.png');img.alt=item.name_ko+' 실제 3D 렌더';img.loading='lazy';img.addEventListener('error',()=>img.classList.add('pending'),{once:true});
    const text=document.createElement('span');text.className='card-copy';
    const badge=document.createElement('small');badge.textContent=String(item.order).padStart(2,'0')+' / '+categoryNames[item.category];
    const title=document.createElement('strong');title.textContent=item.name_ko;
    const motion=document.createElement('span');motion.className='card-motion';motion.textContent=item.animation_count?'움직임 재생 가능':'형태와 재료';
    text.append(badge,title,motion);card.append(img,text);card.addEventListener('click',async()=>{await selectAsset(item.id);$('review').scrollIntoView({behavior:'smooth',block:'start'});});grid.append(card);
  }
  $('timeline').addEventListener('input',e=>setTime(e.target.value));
  document.querySelectorAll('[data-panel]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    for(const id of ['assets-panel','compare-panel','moods-panel','reference-panel'])$(id).hidden=id!==button.dataset.panel;
  }));
  window.__mapGallery={count:DATA.items.length,items:DATA.items.map(({asset,referenceDataURL,...m})=>m),capturePreview(){setPlaying(false);setAutoRotate(false);reset();fit();if(outlined)effect.render(scene,camera);else renderer.render(scene,camera);const canvas=document.createElement('canvas');canvas.width=480;canvas.height=320;const ctx=canvas.getContext('2d');ctx.fillStyle='#f3f0e4';ctx.fillRect(0,0,480,320);const source=renderer.domElement,s=Math.min(480/source.width,320/source.height);ctx.drawImage(source,(480-source.width*s)/2,(320-source.height*s)/2,source.width*s,source.height*s);return canvas.toDataURL('image/png');},renderNow(){if(outlined)effect.render(scene,camera);else renderer.render(scene,camera);},get active(){return active;}};
}
initialize().then(()=>{attachGallery();window.__mapGallery.captureComparison=captureComparison;}).catch(fail);
