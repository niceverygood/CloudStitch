import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { boxAt, placementReport, sweepSolids, nearbyTriggers, availableSpawns, corridorReport, artToLevel } from './adapter.mjs';

const data = JSON.parse(document.getElementById('level-data').textContent), $ = id => document.getElementById(id);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#d8e5df');
const renderer = new THREE.WebGLRenderer({ canvas: $('viewport'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.info.autoReset = false;
const outlineEffect = new OutlineEffect(renderer, { defaultThickness: .0014, defaultColor: [.12, .24, .24], defaultKeepAlive: false });
outlineEffect.autoClear = true;
const camera = new THREE.OrthographicCamera(-45, 45, 35, -35, .1, 1000);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = false; controls.maxPolarAngle = Math.PI * .49; controls.minZoom = .35; controls.maxZoom = 5;
const art = new THREE.Group(), diagnostic = new THREE.Group(), player = new THREE.Group(), targetArt = new THREE.Group(), fullScene = new THREE.Group();
scene.add(art, diagnostic, player, targetArt, fullScene, new THREE.AmbientLight('#fff5de', 2));
const sourceCache = new Map(), roots = [], loadLog = [], errors = [], raycaster = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let level, generation = 0, playerLoaded = false, playerTask, comparisonGeneration = 0, showFullScene = false, started = performance.now(), readyAt = null, firstRequiredAt = null, position = [0, 0, 0], lastSweep = [], lastMetrics = {}, lastMetricsAt = -Infinity, assetMeshes = [], fullMeshes = [], drawing = false, activeErrors = [];
const assetMap = new Map(data.assets.map(a => [a.id, a]));
const statusText = value => { $('loading').textContent = value; };

function paintedClone(source) {
  const root = cloneSkeleton(source);
  root.traverse(object => {
    if (!object.isMesh) return;
    object.material = (Array.isArray(object.material) ? object.material : [object.material]).map(m => {
      const copy = new THREE.MeshBasicMaterial({ color: m.color || '#fff', map: m.map || null, vertexColors: Boolean(object.geometry.attributes.color), side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest || 0 });
      copy.userData.baseOpacity = m.opacity ?? 1; return copy;
    });
    if (object.material.length === 1) object.material = object.material[0];
  });
  return root;
}

async function loadGLB(metadata) {
  if (sourceCache.has(metadata.path)) return sourceCache.get(metadata.path);
  const task = (async () => {
    const begin = performance.now(), url = new URL('../../' + metadata.path, document.baseURI);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${metadata.path}: HTTP ${response.status}`);
    const bytes = await response.arrayBuffer(), fetched = performance.now();
    if (bytes.byteLength !== metadata.bytes || new DataView(bytes).getUint32(0, true) !== 0x46546c67) throw new Error(`실제 GLB 크기/헤더 불일치: ${metadata.path}`);
    const gltf = await new GLTFLoader().parseAsync(bytes, url.href.substring(0, url.href.lastIndexOf('/') + 1));
    gltf.scene.updateMatrixWorld(true);
    loadLog.push({ path: metadata.path, bytes: bytes.byteLength, fetchMs: fetched - begin, parseAndImagesMs: performance.now() - fetched, totalMs: performance.now() - begin, timingScope: 'fetch + GLTF parse + image decode; GPU upload may occur on later render' });
    return gltf.scene;
  })();
  sourceCache.set(metadata.path, task);
  try { return await task; } catch (error) { sourceCache.delete(metadata.path); throw error; }
}

function disposeInstance(root) {
  const skeletons = new Set();
  root.traverse(object => {
    if (object.isSkinnedMesh && object.skeleton) skeletons.add(object.skeleton);
    if (object.isMesh) for (const m of Array.isArray(object.material) ? object.material : [object.material]) m.dispose();
  });
  // SkeletonUtils clones own their bone textures; source geometry/maps stay cached.
  for (const skeleton of skeletons) skeleton.dispose();
  root.removeFromParent();
}
function clearDiagnostics() {
  diagnostic.traverse(object => { object.geometry?.dispose(); if (object.material) for (const m of Array.isArray(object.material) ? object.material : [object.material]) m.dispose(); });
  diagnostic.clear();
}
function resetArt() {
  for (const root of [...art.children, ...fullScene.children, ...targetArt.children]) disposeInstance(root);
  art.clear(); fullScene.clear(); targetArt.clear(); roots.length = 0; assetMeshes = []; fullMeshes = [];
}

function wireBox(center, halfExtents, color) {
  const geometry = new THREE.BoxGeometry(...halfExtents.map(v => v * 2));
  const edges = new THREE.EdgesGeometry(geometry); geometry.dispose();
  const box = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .7 })); box.position.set(...center); diagnostic.add(box); return box;
}
function ring(position, radius, color) {
  const points = Array.from({ length: 49 }, (_, i) => new THREE.Vector3(position[0] + Math.cos(i / 48 * Math.PI * 2) * radius, position[1] + .08, position[2] + Math.sin(i / 48 * Math.PI * 2) * radius));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color })); diagnostic.add(line); return line;
}
function line(points, color) { const object = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color })); diagnostic.add(object); }
function diagnostics() {
  clearDiagnostics();
  const grid = new THREE.GridHelper(200, 40, '#9bac9e', '#bdcaba'); grid.position.y = -.1; diagnostic.add(grid);
  for (const collider of level.colliders) wireBox(collider.center, collider.halfExtents, '#b47761');
  for (const trigger of level.triggers) wireBox(trigger.center, trigger.halfExtents, '#2e9a9d');
  for (const anchor of availableSpawns(level, data.player.conservativeHalfExtents)) ring(anchor.position, 2, anchor.available ? '#3e8570' : '#b95642');
  for (const pocket of level.turningPockets) ring(pocket.center, pocket.radiusLU, '#c5a053');
  for (const corridor of level.corridors) { line(corridor.points.map(p => [p[0], .14, p[2]]), '#fff7df'); for (const p of corridor.points) ring(p, corridor.widthLU / 2, '#b7c6ac'); }
  for (const target of level.referenceTargets) ring(target.position, target.radiusLU, '#cb795f');
  diagnostic.visible = $('proxies').checked;
}

function normalized(source, positionValue, longestLU, yaw) {
  const copy = paintedClone(source), bounds = new THREE.Box3().setFromObject(copy), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  copy.position.sub(center);
  const wrapper = new THREE.Group(); wrapper.add(copy); wrapper.scale.setScalar(longestLU / Math.max(size.x, size.y, size.z)); wrapper.rotation.y = yaw; wrapper.position.set(...positionValue); wrapper.updateMatrixWorld(true);
  return wrapper;
}

async function ensurePlayer() {
  if (playerLoaded) return;
  if (!playerTask) playerTask = (async () => {
    const source = await loadGLB(data.player), copy = paintedClone(source), bounds = new THREE.Box3().setFromObject(copy), size = bounds.getSize(new THREE.Vector3());
    copy.position.sub(bounds.getCenter(new THREE.Vector3()));
    const normalization = new THREE.Group(); normalization.rotation.y = data.player.normalizeYawRadians; normalization.scale.setScalar(data.player.lengthLU / size.x); normalization.add(copy); player.add(normalization); playerLoaded = true;
  })().catch(error => { playerTask = null; throw error; });
  return playerTask;
}

async function populate(token) {
  let requiredRemaining = level.visuals.filter(v => v.priority === 'required').length;
  const ordered = [...level.visuals].sort((a, b) => ['required', 'landmark', 'decoration'].indexOf(a.priority) - ['required', 'landmark', 'decoration'].indexOf(b.priority));
  for (const visual of ordered) {
    if (token !== generation) return;
    if (visual.priority === 'decoration' && !$('decoration').checked || visual.priority === 'landmark' && !$('landmarks').checked) continue;
    try {
      statusText(`${visual.priority === 'required' ? '필수' : '후순위'} 자산 준비 · ${visual.assetId}`);
      const source = await loadGLB(assetMap.get(visual.assetId));
      if (token !== generation) return;
      const root = normalized(source, visual.position, visual.longestLU, visual.yawRadians); root.name = visual.id; root.userData.visualId = visual.id; root.userData.priority = visual.priority; roots.push(root); art.add(root);
      root.traverse(object => { if (object.isMesh) { object.userData.visualRoot = root; assetMeshes.push(object); } });
      if (visual.priority === 'required' && --requiredRemaining === 0) firstRequiredAt = performance.now() - started;
    } catch (error) { errors.push(error.message); if (token !== generation) return; activeErrors.push(error.message); $('loading').dataset.error = 'true'; statusText(error.message); }
  }
  if (token !== generation) return;
  if (level.id === 'first-voyage' && $('target-model').checked && data.readabilityReference) {
    try {
      statusText('실제 징세정 표적 비교 준비');
      const source = await loadGLB(data.readabilityReference);
      if (token !== generation) return;
      const copy = paintedClone(source), box = new THREE.Box3().setFromObject(copy), size = box.getSize(new THREE.Vector3()); copy.position.sub(box.getCenter(new THREE.Vector3()));
      const normalization = new THREE.Group(); normalization.rotation.y = data.readabilityReference.normalizeYawRadians; normalization.scale.setScalar(data.readabilityReference.lengthLU / size.x); normalization.add(copy); targetArt.add(normalization); targetArt.position.set(...level.referenceTargets[0].position); targetArt.updateMatrixWorld(true);
    } catch (error) { errors.push(error.message); if (token !== generation) return; activeErrors.push(error.message); $('loading').dataset.error = 'true'; }
  }
  if (token !== generation) return;
  readyAt = performance.now() - started;
  statusText(activeErrors.length ? `표시 완료 · 현재 로딩 오류 ${activeErrors.length}건 (관측 JSON 확인)` : '선체·선택 자산 준비 완료');
}

function fit(mode = 'overview') {
  const target = mode === 'overview' ? new THREE.Vector3(0, 0, level.id === 'jonghang-harbor' ? 55 : 0) : new THREE.Vector3(...position);
  controls.target.copy(target);
  const h = mode === 'overview' ? level.id === 'jonghang-harbor' ? 40 : 115 : 28;
  camera.position.copy(target).add(new THREE.Vector3(0, h, mode === 'top' ? .01 : h / Math.tan(55 * Math.PI / 180)));
  camera.zoom = mode === 'overview' ? 1 : 1.4; camera.updateProjectionMatrix(); controls.update(); resize();
}
function resize() {
  const w = $('stage').clientWidth, h = $('stage').clientHeight, half = camera.position.distanceTo(controls.target) > 100 ? 105 : level?.camera.halfHeightLU || 35;
  renderer.setSize(w, h, false); camera.left = -half * w / h; camera.right = half * w / h; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
}

function place(next, yaw = player.rotation.y) {
  lastSweep = level ? sweepSolids(level, position, next, data.player.conservativeHalfExtents) : [];
  position = [...next]; player.position.set(...position); player.rotation.y = yaw; player.updateMatrixWorld(true); refreshPlacement();
}
function refreshPlacement() {
  if (!level) return;
  const report = placementReport(level, position, data.player.conservativeHalfExtents), triggers = nearbyTriggers(level, position, data.player.conservativeHalfExtents);
  $('status').dataset.blocked = String(!report.insideBounds || report.solidIds.length > 0);
  $('status').textContent = `위치 X ${position[0].toFixed(1)} · Z ${position[2].toFixed(1)} LU / ${report.insideBounds && !report.solidIds.length ? '배치 공간 확보' : '충돌 또는 경계 밖'}${report.solidIds.length ? ' · ' + report.solidIds.join(', ') : ''}\n${lastSweep.length ? '직전 위치에서 직선 이동하면 장애물 통과 · ' + lastSweep.map(h => h.id).join(', ') : '직전 위치와의 직선 검사: 장애물 없음'}\n${triggers.length ? '확인 가능한 접점: ' + triggers.map(t => t.target).join(' / ') : '근처 접점 없음'}`;
}
function scrub() {
  const corridor = level.corridors[$('corridor').selectedIndex], points = corridor.points, lengths = points.slice(1).map((end, i) => new THREE.Vector3(...end).distanceTo(new THREE.Vector3(...points[i])));
  let distance = lengths.reduce((a, b) => a + b, 0) * Number($('progress').value) / 100, index = 0;
  while (index < lengths.length - 1 && distance > lengths[index]) distance -= lengths[index++];
  const a = points[index], b = points[index + 1], t = lengths[index] ? distance / lengths[index] : 0;
  $('progress-label').textContent = `${$('progress').value}%`; place(a.map((v, i) => v + (b[i] - v) * t), Number($('yaw').value) * Math.PI / 180);
}

async function chooseLevel() {
  const token = ++generation; comparisonGeneration++; started = performance.now(); readyAt = firstRequiredAt = null; activeErrors = []; resetArt(); showFullScene = false; art.visible = true; fullScene.visible = false; $('full-scene').textContent = '원본 장면 비교 켜기'; $('loading').dataset.error = 'false';
  level = data.levels[$('level').selectedIndex];
  $('corridor').innerHTML = ''; for (const corridor of level.corridors) { const option = document.createElement('option'); option.textContent = corridor.name; $('corridor').append(option); }
  $('progress').value = 0; $('progress-label').textContent = '0%'; $('yaw').value = Math.round(level.playerStart.headingRadians * 180 / Math.PI); $('yaw-label').textContent = `${$('yaw').value}°`;
  place(level.playerStart.position, level.playerStart.headingRadians); lastSweep = []; refreshPlacement(); diagnostics(); fit();
  $('notice').textContent = '실제 선체 길이10LU · 회전 외접 직경10.44LU · 주통로18LU';
  try { await ensurePlayer(); if (token !== generation) return; await populate(token); } catch (error) { errors.push(error.message); if (token !== generation) return; activeErrors.push(error.message); $('loading').dataset.error = 'true'; statusText(error.message); }
}

async function compareFullScene() {
  if (level.id !== 'jonghang-harbor') { statusText('원본 장면 비교는 종항에서 사용할 수 있습니다.'); return; }
  showFullScene = !showFullScene; $('full-scene').textContent = showFullScene ? '새 소수자산 배치로 돌아가기' : '원본 장면 비교 켜기';
  const token = generation, comparisonToken = ++comparisonGeneration;
  if (showFullScene && !fullScene.children.length) {
    statusText('원본 종항 28MB 장면 준비 중');
    try {
      const source = await loadGLB(assetMap.get('scene:jonghang-harbor'));
      if (token !== generation || comparisonToken !== comparisonGeneration || !showFullScene || fullScene.children.length) return;
      const copy = paintedClone(source); for (const object of [...copy.children]) if (object.name.includes('@selected-airship')) disposeInstance(object);
      const frame = level.fullSceneComparison.artFrame; copy.position.set(...artToLevel([0, 0, 0], frame)); copy.rotation.y = frame.yawRadians; copy.scale.setScalar(frame.unitsPerArtUnit); fullScene.add(copy);
      copy.traverse(object => { if (object.isMesh) { let candidate = object; while (candidate.parent && candidate.parent !== copy) candidate = candidate.parent; object.userData.visualRoot = candidate; fullMeshes.push(object); } });
      statusText('원본 시각 장면 비교 · 이 장면의 새 충돌 검사는 미작성');
    } catch (error) { if (token !== generation || comparisonToken !== comparisonGeneration) return; showFullScene = false; errors.push(error.message); statusText(error.message); }
  }
  art.visible = !showFullScene; fullScene.visible = showFullScene; diagnostic.visible = $('proxies').checked && !showFullScene;
}

function sampleVisibility(point, offsets, meshes) {
  const blocked = new Set(); let occluded = 0;
  for (const offset of offsets) {
    const target = new THREE.Vector3(...point).add(new THREE.Vector3(...offset)), ndc = target.clone().project(camera);
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
    raycaster.far = Math.max(0, target.clone().sub(raycaster.ray.origin).dot(raycaster.ray.direction) - .05);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length) { occluded++; for (const hit of hits) if (hit.object.userData.visualRoot) blocked.add(hit.object.userData.visualRoot); }
  }
  return { samples: offsets.length, occluded, blocked };
}

function measure() {
  const meshes = showFullScene ? fullMeshes : assetMeshes, half = data.player.conservativeHalfExtents, samples = [[0, 0, 0], [0, half[1], 0], [-data.player.widthLU / 2, 0, 0], [data.player.widthLU / 2, 0, 0], [0, 0, data.player.lengthLU / 2]].map(offset => new THREE.Vector3(...offset).applyQuaternion(player.quaternion).toArray());
  const target = level.referenceTargets[0], targetHalf = targetArt.children.length ? new THREE.Box3().setFromObject(targetArt).getSize(new THREE.Vector3()).multiplyScalar(.5) : new THREE.Vector3(2, 2, 2);
  const playerMeshes = []; player.traverse(o => { if (o.isMesh) playerMeshes.push(o); });
  const playerVisibility = sampleVisibility(position, samples, meshes), targetVisibility = sampleVisibility(target.position, [[0, 0, 0], [0, targetHalf.y, 0], [-targetHalf.x, 0, 0], [targetHalf.x, 0, 0], [0, 0, targetHalf.z]], [...meshes, ...playerMeshes]);
  const blocked = new Set([...playerVisibility.blocked, ...targetVisibility.blocked]);
  const allRoots = showFullScene ? [...new Set(fullMeshes.map(m => m.userData.visualRoot))] : roots;
  for (const root of allRoots) if (root) root.traverse(object => { if (object.isMesh) for (const m of Array.isArray(object.material) ? object.material : [object.material]) { const faded = $('fade').checked && blocked.has(root); m.opacity = faded ? level.camera.fadeOpacity : m.userData.baseOpacity; m.transparent = faded || m.opacity < 1; m.depthWrite = !faded; } });
  const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(target.radiusLU);
  const projectedA = new THREE.Vector3(...target.position).sub(cameraRight).project(camera), projectedB = new THREE.Vector3(...target.position).add(cameraRight).project(camera);
  const targetPixels = Math.abs(projectedB.x - projectedA.x) * $('stage').clientWidth / 2;
  let actualTargetBoundsPx = null, targetMeshCount = 0;
  if (targetArt.children.length) {
    const box = new THREE.Box3().setFromObject(targetArt), projected = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) projected.push(new THREE.Vector3(x, y, z).project(camera));
    actualTargetBoundsPx = { width: (Math.max(...projected.map(p => p.x)) - Math.min(...projected.map(p => p.x))) * $('stage').clientWidth / 2, height: (Math.max(...projected.map(p => p.y)) - Math.min(...projected.map(p => p.y))) * $('stage').clientHeight / 2 };
    targetArt.traverse(o => { if (o.isMesh) targetMeshCount++; });
  }
  let modelMeshCount = 0; for (const mesh of [...meshes, ...player.children.flatMap(root => { const result = []; root.traverse(o => { if (o.isMesh) result.push(o); }); return result; })]) if (mesh.visible) modelMeshCount++;
  lastMetrics = { levelId: level.id, frameId: data.frameId, unitStatus: data.unitStatus, mode: showFullScene ? 'preserved-full-scene-comparison-no-authored-physics' : 'independent-priority-layout', position, playerLengthLU: data.player.lengthLU, playerRotatingDiameterLU: 2 * data.player.turnRadiusLU, readyMs: readyAt, requiredReadyMs: firstRequiredAt, sourceCacheEntries: sourceCache.size, currentModelMeshInstances: modelMeshCount, rendererGeometryCount: renderer.info.memory.geometries, rendererTextureCount: renderer.info.memory.textures, drawCallsIncludingOutlinePasses: renderer.info.render.calls, trianglesIncludingOutlinePasses: renderer.info.render.triangles, playerOcclusionSamples: { tested: playerVisibility.samples, blocked: playerVisibility.occluded }, targetOcclusionSamples: { tested: targetVisibility.samples, blocked: targetVisibility.occluded }, fadedVisualRoots: blocked.size, targetProjectedDiameterPx: targetPixels, targetWithinViewport: Math.abs(new THREE.Vector3(...target.position).project(camera).x) <= 1 && Math.abs(new THREE.Vector3(...target.position).project(camera).y) <= 1, corridors: level.corridors.map(c => corridorReport(level, c, data.player.conservativeHalfExtents)), loadLog: [...loadLog], errors: [...errors], viewport: { width: $('stage').clientWidth, height: $('stage').clientHeight, pixelRatio: renderer.getPixelRatio() }, note: 'Load timing excludes guaranteed GPU upload completion. Ray samples and projected diameter are diagnostics; no human readability/pixel occlusion/performance certification.' };
  $('metrics').textContent = `준비 ${readyAt == null ? '…' : readyAt.toFixed(0) + ' ms'} / 필수 ${firstRequiredAt == null ? '…' : firstRequiredAt.toFixed(0) + ' ms'}\n모델 메시 ${modelMeshCount} / 텍스처 ${renderer.info.memory.textures}\n기하 자원 ${renderer.info.memory.geometries}\n프레임 draw ${renderer.info.render.calls} (윤곽 포함)\n선체 가림 ${playerVisibility.occluded}/5 · 표적 가림 ${targetVisibility.occluded}/5\n표적 투영 ${targetPixels.toFixed(1)} px ${lastMetrics.targetWithinViewport ? '' : '(화면 밖)'}\n로딩 오류 ${activeErrors.length}`;
  window.__levelsPreview.metrics = lastMetrics;
  lastMetrics.fadedVisualRoots = $('fade').checked ? blocked.size : 0;
  lastMetrics.currentModelMeshInstances += targetMeshCount;
  lastMetrics.actualTaxCutterProjectedBoundsPx = actualTargetBoundsPx;
  lastMetrics.activeErrors = [...activeErrors];
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const targetMeshes = []; targetArt.traverse(o => { if (o.isMesh) targetMeshes.push(o); });
  lastMetrics.inFrustumModelMeshInstances = [...meshes, ...playerMeshes, ...targetMeshes].filter(mesh => mesh.visible && frustum.intersectsObject(mesh)).length;
  $('metrics').textContent += `\n화면 범위 모델 메시 ${lastMetrics.inFrustumModelMeshInstances}`;
  if (actualTargetBoundsPx) $('metrics').textContent += `\n실제 징세정 ${actualTargetBoundsPx.width.toFixed(1)}×${actualTargetBoundsPx.height.toFixed(1)} px / ${targetMeshCount}메시`;
}

for (const item of data.levels) { const option = document.createElement('option'); option.textContent = item.name; $('level').append(option); }
$('level').addEventListener('change', chooseLevel); $('landmarks').addEventListener('change', chooseLevel); $('decoration').addEventListener('change', chooseLevel);
$('target-model').addEventListener('change', chooseLevel);
$('fit').onclick = () => fit(); $('follow').onclick = () => fit('follow'); $('top').onclick = () => fit('top');
$('progress').oninput = scrub; $('corridor').onchange = scrub; $('yaw').oninput = () => { $('yaw-label').textContent = `${$('yaw').value}°`; place(position, Number($('yaw').value) * Math.PI / 180); };
$('proxies').onchange = () => { diagnostic.visible = $('proxies').checked && !showFullScene; }; $('full-scene').onclick = compareFullScene;
$('export').onclick = () => { const blob = new Blob([JSON.stringify(lastMetrics, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'cloudstitch-level-observation.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
let pointerDown;
renderer.domElement.addEventListener('pointerdown', e => { pointerDown = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => { if (!pointerDown || Math.hypot(e.clientX - pointerDown[0], e.clientY - pointerDown[1]) > 4) return; const rect = renderer.domElement.getBoundingClientRect(); raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera); const point = new THREE.Vector3(); if (raycaster.ray.intersectPlane(floor, point)) place([point.x, level.flightY, point.z]); });
window.addEventListener('keydown', e => { if (/INPUT|SELECT|BUTTON/.test(document.activeElement.tagName)) return; const offset = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] }[e.key]; if (offset) { e.preventDefault(); place([position[0] + offset[0], level.flightY, position[2] + offset[1]]); } });
new ResizeObserver(resize).observe($('stage'));
window.__levelsPreview = { data, metrics: lastMetrics, selectLevel: async id => { const index = data.levels.findIndex(l => l.id === id); if (index < 0) throw new Error('Unknown level'); $('level').selectedIndex = index; await chooseLevel(); }, place: (point, yaw = 0) => place(point, yaw), getState: () => ({ levelId: level?.id, position: [...position], report: level && placementReport(level, position, data.player.conservativeHalfExtents), ready: playerLoaded && readyAt !== null && firstRequiredAt !== null && activeErrors.length === 0, errors: [...activeErrors] }) };
function frame(time) { requestAnimationFrame(frame); if (!level || drawing) return; drawing = true; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); renderer.info.reset(); outlineEffect.render(scene, camera); if (time - lastMetricsAt > 500) { measure(); lastMetricsAt = time; } drawing = false; }
requestAnimationFrame(frame);
if (location.protocol === 'file:') { errors.push('저장소 루트를 HTTP 서버로 열어야 공유 GLB를 불러올 수 있습니다.'); $('loading').dataset.error = 'true'; statusText(errors[0]); }
chooseLevel();
