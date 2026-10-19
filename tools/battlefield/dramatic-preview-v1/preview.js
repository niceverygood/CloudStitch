import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { getRichProfile } from '../vfx-rich-profiles.mjs';
import { getImpactfulProfile } from '../impactful-vfx-v1/profiles.mjs';
import { createDramaticCannonStage, CANNON_STAGE_DURATIONS } from '../dramatic-vfx-v1/cannon-stage.mjs';
import { HARPOON_DURATION, HARPOON_TIMING, sampleHarpoonLaunch, sampleRopeOffset } from './harpoon-motion.mjs';

// An art workbench only. Nothing here dispatches combat events or changes sim.
const $ = id => document.getElementById(id), stage = $('stage');
const templates = new Set(), baseScale = .32, up = new THREE.Vector3(0, 1, 0);
// View from the incoming side of the target so its board cannot hide an
// impact spreading along the unchanged -Z surface normal.
const initialDirection = new THREE.Vector3(8, 5.5, -8).normalize();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stats = { ready: false, combatSimulation: false, source: 'dramatic-v1', effectCount: 0, selectedId: null,
  mode: 'handdrawn', playing: !reducedMotion, loop: true, speed: 1, focus: 'ship',
  currentTime: 0, duration: 0, baseScale, placementIsApproximate: true, forward: '+Z', up: '+Y', lanes: [] };
window.__dramaticVfxStats = stats;
window.__richVfxStats = stats;
window.__impactfulVfxStats = stats;
window.__richVfxReady = false;
let atlas;
let renderer, outline, camera, controls, lanes = [], catalog, weaponCatalog, active;
let mode = 'handdrawn', outlined = true, halfHeight = 2.8, focused = false, deep = false;
let time = 0, duration = 1, playing = !reducedMotion, loop = true, speed = 1, ticket = 0, disposed = false, ready = false;
let last = performance.now(), observer, frame;
const gradient = new THREE.DataTexture(new Uint8Array([90, 177, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
gradient.generateMipmaps = false; gradient.needsUpdate = true;
const manager = new THREE.LoadingManager();
manager.setURLModifier(value => {
  if (/^(data:|blob:)/i.test(value)) return value;
  const url = new URL(value, location.href);
  if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin) throw new Error('외부 자원은 불러오지 않습니다.');
  return url.href;
});
const loader = new GLTFLoader(manager);
async function json(path) {
  const response = await fetch(path, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`자료를 읽지 못했습니다 (${response.status}): ${path}`);
  return response.json();
}

function outlineMaterial(material) {
  material.userData.outlineParameters = { thickness: 1.25 / Math.max(stage.clientHeight, 1),
    color: [.10, .14, .115], visible: outlined && !(material.transparent && !material.depthWrite), alpha: 1, keepAlive: false };
}
function createTemplate(source, animations = [], sourcePath = 'display-only-support') {
  const geometries = new Set(), originals = new Set(), textures = new Set(), skeletons = new Set(), derived = new Map(), instances = new Set();
  let removed = false;
  source.traverse(node => {
    if (node.isSkinnedMesh) skeletons.add(node.skeleton);
    if (!node.isMesh) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      originals.add(material); outlineMaterial(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  function materialFor(original) {
    if (mode === 'original') return original;
    const key = `${original.uuid}:${mode}`;
    if (derived.has(key)) return derived.get(key);
    const common = { color: original.color?.clone() || new THREE.Color(0xffffff), map: original.map || null,
      alphaMap: original.alphaMap || null, opacity: original.opacity, transparent: original.transparent,
      alphaTest: original.alphaTest, side: original.side, vertexColors: original.vertexColors,
      depthWrite: original.depthWrite, depthTest: original.depthTest, toneMapped: false };
    const material = mode === 'cel' ? new THREE.MeshToonMaterial({ ...common, gradientMap: gradient }) : new THREE.MeshBasicMaterial(common);
    material.name = `${original.name || 'v1'} / preview ${mode}`;
    outlineMaterial(material); derived.set(key, material); return material;
  }
  const template = { source, animations, sourcePath, instances,
    updateMaterials() {
      for (const instance of instances) for (const record of instance.records) {
        record.mesh.material = Array.isArray(record.original) ? record.original.map(materialFor) : materialFor(record.original);
      }
      for (const material of [...originals, ...derived.values()]) outlineMaterial(material);
    },
    dispose() {
      if (removed) return; removed = true;
      for (const instance of [...instances]) instance.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of [...originals, ...derived.values()]) material.dispose();
      for (const texture of textures) texture.dispose();
      for (const skeleton of skeletons) skeleton.dispose();
      derived.clear(); templates.delete(template);
    },
  };
  templates.add(template); return template;
}
async function loadTemplate(path) {
  const gltf = await loader.loadAsync(path);
  if (disposed) {
    createTemplate(gltf.scene, gltf.animations, path).dispose();
    throw new Error('작업대가 닫혔습니다.');
  }
  let meshes = 0; gltf.scene.traverse(node => { if (node.isMesh) meshes++; });
  if (!meshes) throw new Error(`실제 메시가 없습니다: ${path}`);
  return createTemplate(gltf.scene, gltf.animations, path);
}
function instanceOf(template, animate = false) {
  const source = cloneSkeleton(template.source), records = [], skeletons = new Set();
  source.traverse(node => {
    if (node.isSkinnedMesh) skeletons.add(node.skeleton);
    if (!node.isMesh) return;
    node.frustumCulled = false; records.push({ mesh: node, original: node.material });
  });
  const clip = animate ? template.animations[0] : null, mixer = clip ? new THREE.AnimationMixer(source) : null;
  const action = clip ? mixer.clipAction(clip) : null;
  if (action) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play(); }
  const translatedNodes = [...new Set((clip?.tracks || []).filter(track => track.name.endsWith('.position'))
    .map(track => source.getObjectByName(track.name.slice(0, -9))).filter(Boolean))];
  const longitudinalTethers = [];
  source.traverse(node => { if (/^harpoon-projectile_tether_growth_\d+$/.test(node.name)) longitudinalTethers.push(node); });
  let removed = false;
  const instance = { source, records, mixer, action, translatedNodes,
    evaluate(seconds, translationScale = 1) {
      if (action) {
        action.reset(); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
        mixer.setTime(THREE.MathUtils.clamp(seconds, 0, clip.duration));
        // Enlarge projectile shapes while leaving their authored display path
        // unchanged. Do not add another movement system to the GLB animation.
        if (translationScale !== 1) {
          for (const node of translatedNodes) node.position.multiplyScalar(translationScale);
          // The harpoon line grows through a scale-only track, separately
          // from the moving carrier. Preserve its endpoint distance while
          // allowing its cross-section to inherit the richer display size.
          for (const node of longitudinalTethers) node.scale.z *= translationScale;
        }
      }
      source.updateMatrixWorld(true);
    },
    dispose() {
      if (removed) return; removed = true;
      mixer?.stopAllAction(); mixer?.uncacheRoot(source);
      for (const skeleton of skeletons) skeleton.dispose();
      source.removeFromParent(); template.instances.delete(instance);
    },
  };
  template.instances.add(instance); template.updateMaterials(); return instance;
}
function normalize(instance, length, position) {
  const source = instance.source;
  source.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(source), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const scale = length / Math.max(size.x, size.y, size.z, .0001);
  const root = new THREE.Group(), normalization = new THREE.Group();
  normalization.scale.setScalar(scale); normalization.rotation.y = Math.PI / 2;
  source.position.sub(center); normalization.add(source); root.add(normalization); root.position.copy(position);
  return { root, instance, scale, center, box, size };
}
function platformTemplate() {
  const source = new THREE.Group();
  const wood = new THREE.MeshBasicMaterial({ color: 0xc69b66 }), trim = new THREE.MeshBasicMaterial({ color: 0x48776e });
  const plank = new THREE.Mesh(new THREE.BoxGeometry(.68, .08, .7), wood); plank.position.set(.98, .6, 1.25); source.add(plank);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.45, .09, .12), trim); arm.position.set(.72, .53, 1.25); source.add(arm);
  return createTemplate(source);
}
function targetTemplate() {
  const source = new THREE.Group(), wood = new THREE.MeshBasicMaterial({ color: 0xb98450 }), trim = new THREE.MeshBasicMaterial({ color: 0x46776f });
  for (let i = 0; i < 3; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(.13, .37, .035), wood); plank.position.x = (i - 1) * .14; source.add(plank);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.43, .04, .05), trim); bar.position.y = -.14; source.add(bar);
  return createTemplate(source);
}
function guessMuzzle(source, box, mortar) {
  const size = box.getSize(new THREE.Vector3()), sum = new THREE.Vector3(); let count = 0;
  source.updateMatrixWorld(true);
  source.traverse(node => {
    if (!node.isMesh) return;
    const points = node.geometry.attributes.position;
    for (let i = 0; i < points.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(points, i).applyMatrix4(node.matrixWorld);
      if (mortar ? point.y >= box.max.y - size.y * .035 : point.x <= box.min.x + size.x * .025) { sum.add(point); count++; }
    }
  });
  return count ? sum.divideScalar(count) : new THREE.Vector3(box.min.x, box.getCenter(new THREE.Vector3()).y, box.getCenter(new THREE.Vector3()).z);
}
function installWeapon(template, weaponId) {
  for (const lane of lanes) {
    lane.weapon?.instance.dispose(); lane.weapon?.root.removeFromParent();
    const instance = instanceOf(template), raw = instance.source;
    raw.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(raw), tip = guessMuzzle(raw, box, weaponId === '03-mortar');
    const weapon = normalize(instance, .84, new THREE.Vector3(.98, .64, 1.25));
    weapon.root.position.y += weapon.size.y * weapon.scale / 2;
    weapon.root.updateMatrixWorld(true);
    lane.muzzle = tip.sub(weapon.center).multiplyScalar(weapon.scale).applyAxisAngle(up, Math.PI / 2).add(weapon.root.position);
    lane.weapon = weapon; lane.scene.add(weapon.root);
  }
}
function placement(item, lane) {
  const root = new THREE.Group(); root.scale.setScalar(baseScale);
  root.name = `${item.id}: external display placement, not a socket`;
  lane.target.source.visible = false;
  lane.target.source.position.copy(lane.muzzle).add(new THREE.Vector3(0, 0, 4 * baseScale));
  if (item.category === 'material-impact' || /(?:-hit|penetration-exit)$/.test(item.id)) {
    root.position.copy(lane.target.source.position);
    root.quaternion.setFromUnitVectors(up, new THREE.Vector3(0, 0, -1));
    lane.target.source.visible = true;
  } else if (item.category === 'weapon') {
    root.position.copy(lane.muzzle);
    if (item.id === 'mortar-launch') root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    if (item.id.endsWith('-projectile')) lane.target.source.visible = true;
  } else {
    root.position.set(1.14, .86, .75);
    if (item.id === 'shield-pulse' || item.id === 'armor-block' || item.id === 'repair-stitch') {
      root.quaternion.setFromUnitVectors(up, new THREE.Vector3(1, 0, 0));
    }
  }
  return root;
}
function createLaneEffect(template, item, lane, rich, profile) {
  const root = placement(item, lane), richness = new THREE.Group(), parts = [];
  richness.scale.fromArray(rich ? (profile.stretch || [1, 1, 1]) : [1, 1, 1]).multiplyScalar(rich ? profile.scale : 1); root.add(richness);
  const variants = [{ delay: 0, scale: 1, rotation: 0, offset: [0, 0, 0] }, ...(rich && !profile.projectile ? profile.echoes : [])];
  for (const variant of variants) {
    const instance = instanceOf(template, true), wrapper = new THREE.Group();
    wrapper.scale.fromArray(variant.stretch || [1, 1, 1]).multiplyScalar(variant.scale); wrapper.rotation.y = variant.rotation; wrapper.position.fromArray(variant.offset);
    wrapper.add(instance.source); richness.add(wrapper); parts.push({ instance, wrapper, delay: variant.delay });
  }
  lane.scene.add(root);
  return { root, richness, parts, rich,
    evaluate(seconds) {
      const sourceTime = item.id === 'harpoon-launch' ? seconds - HARPOON_TIMING.release : seconds;
      for (const part of parts) {
        part.wrapper.visible = sourceTime >= part.delay && sourceTime < template.animations[0].duration;
        part.instance.evaluate(Math.max(0, sourceTime - part.delay), rich && profile.projectile ? 1 / profile.scale : 1);
      }
      root.updateMatrixWorld(true);
    },
    dispose() { for (const part of parts) part.instance.dispose(); root.removeFromParent(); },
  };
}
function createReadableHarpoon(launchTemplate, projectileTemplate, item, lane, profile) {
  // One unchanged launch source, one existing carrier and one persistent rope.
  // This context choreography never calls the combat simulator.
  const launch = { richness: new THREE.Group(), parts: [], dispose() {} };
  const root = new THREE.Group(); root.name = 'harpoon launch context';
  lane.scene.add(root);
  const projectile = instanceOf(projectileTemplate, false);
  const carrier = projectile.source.getObjectByName('harpoon-projectile_projectile_carrier_0');
  const oldTether = projectile.source.getObjectByName('harpoon-projectile_tether_growth_6');
  if (!carrier || !oldTether) { launch.dispose(); projectile.dispose(); root.removeFromParent(); throw new Error('기존 작살의 촉과 줄을 확인해 주세요.'); }
  oldTether.visible = false;
  carrier.position.set(0, 0, 0); carrier.quaternion.identity(); carrier.scale.set(1, 1, 1);
  const actor = new THREE.Group(); actor.add(projectile.source); root.add(actor);
  const projectileSize = getImpactfulProfile('harpoon-projectile').scale;
  const baseMuzzle = lane.muzzle.clone(), baseWeapon = lane.weapon.root.position.clone();
  const ropeStart = new THREE.Vector3(), ropeEnd = new THREE.Vector3();
  const tangent = new THREE.Vector3(), normal = new THREE.Vector3(), side = new THREE.Vector3(1, 0, 0);
  const segments = 64, radial = 6, positions = new Float32Array((segments + 1) * radial * 3), indices = [];
  for (let i = 0; i < segments; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial;
    indices.push(a, b, a + radial, b, b + radial, a + radial);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({ color: 0xffedbd, side: THREE.DoubleSide, toneMapped: false });
  outlineMaterial(material);
  const rope = new THREE.Mesh(geometry, material); rope.name = 'one cream launch rope'; rope.frustumCulled = false; root.add(rope);
  const brushGeometry = new THREE.PlaneGeometry(1,1), brushMaps=[], brushes=[];
  for(let i=0;i<8;i++){
    const map=atlas.clone(); map.repeat.set(.5,.5); map.offset.set((i%2)*.5,.5); map.needsUpdate=true; brushMaps.push(map);
    const mat=new THREE.MeshBasicMaterial({map,color:i%2?0xc1e1cf:0xffedc1,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}); outlineMaterial(mat);
    const brush=new THREE.Mesh(brushGeometry,mat); brush.frustumCulled=false; brushes.push(brush); root.add(brush);
  }
  function evaluateBrushes(state){
    const elapsed=state.time-HARPOON_TIMING.release;
    brushes.forEach((brush,i)=>{
      const q=Math.max(0,Math.min(1,(elapsed-i*.013)/.34));
      brush.visible=elapsed>=i*.013&&q<1;
      brush.position.copy(baseMuzzle); brush.position.x+=Math.cos(i*2.4)*q*.23; brush.position.y+=Math.sin(i*2.4)*q*.21; brush.position.z+=q*.38;
      brush.quaternion.copy(camera.quaternion); brush.rotateZ(i*1.7);
      brush.scale.set((.12+q*.26)*(i%2?1:.65),.05+q*.09,1); brush.material.opacity=(1-q)*.65;
    });
  }
  let currentState = sampleHarpoonLaunch(0), removed = false;
  function updateRope(state, radius) {
    const dz = ropeEnd.z - ropeStart.z;
    for (let i = 0; i <= segments; i++) {
      const u = i / segments, offset = sampleRopeOffset(state, u), x = THREE.MathUtils.lerp(ropeStart.x, ropeEnd.x, u) + offset.x;
      const y = THREE.MathUtils.lerp(ropeStart.y, ropeEnd.y, u) + offset.y;
      const z = THREE.MathUtils.lerp(ropeStart.z, ropeEnd.z, u);
      tangent.set(ropeEnd.x - ropeStart.x, ropeEnd.y - ropeStart.y , dz);
      if (tangent.lengthSq() < 1e-10) tangent.set(0, 0, 1);
      tangent.normalize(); normal.crossVectors(tangent, side).normalize();
      for (let j = 0; j < radial; j++) {
        const angle = j / radial * Math.PI * 2, at = (i * radial + j) * 3;
        const c = Math.cos(angle) * radius, s = Math.sin(angle) * radius;
        positions[at] = x + c + normal.x * s;
        positions[at + 1] = y + normal.y * s;
        positions[at + 2] = z + normal.z * s;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }
  return { root, richness: launch.richness, parts: launch.parts, rich: true,
    context: { carrier, actor, rope, get state() { return currentState; }, ropeStart, ropeEnd },
    evaluate(seconds) {
      const state = sampleHarpoonLaunch(seconds); currentState = state;
      lane.weapon.root.position.copy(baseWeapon); lane.weapon.root.position.z += state.recoilZ;
      lane.weapon.root.position.z -= state.phase === 'loaded' ? .035 * (1-state.preload) : 0;
      for (const part of launch.parts) {
        part.wrapper.visible = state.launchVisible;
        part.instance.evaluate(state.launchClipTime);
      }
      actor.visible = state.projectileVisible;
      actor.position.copy(baseMuzzle); actor.position.z += -.15 + state.projectileZ * baseScale;
      actor.scale.setScalar(baseScale * projectileSize * state.projectileScale);
      ropeStart.copy(baseMuzzle).add(lane.weapon.root.position).sub(baseWeapon);
      ropeEnd.copy(actor.position); ropeEnd.z -= .475 * baseScale * projectileSize * state.projectileScale;
      rope.visible = state.ropeVisible;
      updateRope(state, .012 * state.ropeScale);
      evaluateBrushes(state);
      root.updateMatrixWorld(true);
    },
    dispose() {
      if (removed) return; removed = true;
      lane.weapon.root.position.copy(baseWeapon);
      launch.dispose(); projectile.dispose(); geometry.dispose(); material.dispose();
      brushGeometry.dispose(); for (const brush of brushes) brush.material.dispose(); for (const map of brushMaps) map.dispose(); root.removeFromParent();
    },
  };
}
function createCannonEffect(item,lane) {
  const kind=item.id==='cannon-hit'?'hit':'muzzle';
  const stageEffect=createDramaticCannonStage(THREE,{atlas,camera,reducedMotion});
  const anchor=placement(item,lane);
  const frame={x:anchor.position.x,y:anchor.position.y,z:anchor.position.z,direction:{x:0,y:0,z:1},normal:{x:0,y:0,z:-1},camera};
  lane.scene.add(stageEffect.root);
  return {root:stageEffect.root,richness:stageEffect.root,parts:[],rich:true,stage:stageEffect,
    evaluate(seconds){stageEffect.evaluate(kind,seconds,frame);stageEffect.root.scale.setScalar(.24);stageEffect.root.updateMatrixWorld(true);},
    dispose(){stageEffect.dispose();stageEffect.root.removeFromParent();}
  };
}
function sync() {
  $('timeline').value = String(time); $('time-value').value = `${time.toFixed(2)} / ${duration.toFixed(2)}초`;
  Object.assign(stats, { currentTime: time, duration, playing, loop, speed });
}
function evaluateTime(value) {
  time = THREE.MathUtils.clamp(Number(value) || 0, 0, duration);
  for (const effect of active?.effects || []) effect.evaluate(time);
  stats.lanes = (active?.effects || []).map((effect, i) => {
    const source = effect.parts[0]?.instance.source, carrier = effect.context?.carrier || source?.getObjectByName(`${active.item.id}_projectile_carrier_0`);
    return { lane: i ? 'rich' : 'v1', scale: effect.richness.scale.x, echoCount: Math.max(0,effect.parts.length - 1),
      visibleParts: effect.parts.filter(part => part.wrapper.visible).length, anchor: effect.root.position.toArray(),
      carrierWorldPosition: carrier ? carrier.getWorldPosition(new THREE.Vector3()).toArray() : null,
      contextPhase: effect.context?.state.phase || null,
      dramaticStage: effect.stage?.debug() || null,
      projectileCount: effect.context?.state.projectileCount ?? null,
      recoilZ: effect.context?.state.recoilZ ?? null,
      ropeEndpoints: effect.context ? [effect.context.ropeStart.toArray(), effect.context.ropeEnd.toArray()] : null };
  });
  if ($('phase-label')) {
    const isHarpoon = active?.item.id === 'harpoon-launch';
    $('phase-label').hidden = !isHarpoon;
    $('phase-label').textContent = isHarpoon ? sampleHarpoonLaunch(time).phaseLabel : '';
  }
  sync();
}
function setPlaying(value) {
  if (value && time >= duration) evaluateTime(0);
  playing = Boolean(value); $('play').textContent = playing ? '일시정지' : '재생';
  $('play').setAttribute('aria-pressed', String(playing)); sync();
}
function setTime(value) { setPlaying(false); evaluateTime(value); render(); }
function setLoop(value) { loop = Boolean(value); $('loop').checked = loop; sync(); }
function setSpeed(value) {
  speed = THREE.MathUtils.clamp(Number(value) || 1, .1, 4);
  if (![...$('speed').options].some(option => Number(option.value) === speed)) $('speed').add(new Option(`${speed}×`, String(speed)));
  $('speed').value = String(speed); sync();
}
function setMode(value) {
  if (!['handdrawn', 'cel', 'original'].includes(value)) return;
  mode = value; stats.mode = mode;
  for (const template of templates) template.updateMaterials();
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  render();
}
function setOutline(value) {
  outlined = Boolean(value); $('outline').checked = outlined;
  for (const template of templates) template.updateMaterials();
  stats.outline = outlined; stats.outlineAutoClear = outline?.autoClear === true; render();
}
function setBackground(value) {
  deep = value === true || value === 'deepteal'; stage.classList.toggle('deep', deep);
  $('background').textContent = deep ? '배경 · 짙은 청록' : '배경 · 크림';
  $('background').setAttribute('aria-pressed', String(deep)); stats.background = deep ? 'deepteal' : 'cream'; render();
}
function setAutoRotate(value) {
  controls.autoRotate = Boolean(value); $('rotate').setAttribute('aria-pressed', String(controls.autoRotate)); stats.autoRotate = controls.autoRotate;
}
function resize() {
  const width = Math.max(stage.clientWidth, 2), height = Math.max(stage.clientHeight, 1), aspect = width / 2 / height;
  renderer.setSize(width, height, false);
  camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  for (const template of templates) template.updateMaterials();
}
function frameBounds(bounds, resetCamera) {
  if (bounds.isEmpty()) return;
  const target = bounds.getCenter(new THREE.Vector3());
  if (resetCamera) camera.position.copy(initialDirection).multiplyScalar(16).add(target);
  else camera.position.add(target.clone().sub(controls.target));
  controls.target.copy(target); camera.lookAt(target); camera.updateMatrixWorld(true);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) {
    const p = new THREE.Vector3(x ? bounds.max.x : bounds.min.x, y ? bounds.max.y : bounds.min.y, z ? bounds.max.z : bounds.min.z).applyMatrix4(camera.matrixWorldInverse);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const aspect = Math.max(stage.clientWidth / 2 / stage.clientHeight, .1);
  halfHeight = Math.max((maxY - minY) / 2, (maxX - minX) / (2 * aspect), .12) * 1.14;
  camera.zoom = 1; resize(); controls.update(); render();
}
function fit(resetCamera = false) {
  if (!active) return;
  focused = false; stats.focus = 'ship'; $('focus').setAttribute('aria-pressed', 'false');
  const bounds = active.effectBounds.clone();
  for (const lane of lanes) {
    lane.scene.updateMatrixWorld(true); bounds.union(new THREE.Box3().setFromObject(lane.ship.root));
    bounds.union(new THREE.Box3().setFromObject(lane.weapon.root));
    if (lane.target.source.visible) bounds.union(new THREE.Box3().setFromObject(lane.target.source));
  }
  frameBounds(bounds, resetCamera);
}
function reset() { setAutoRotate(false); fit(true); }
function setFocus(value) {
  focused = value === true || value === 'effect';
  if (!focused) { fit(true); return; }
  if (!active) return;
  setAutoRotate(false); stats.focus = 'effect'; $('focus').setAttribute('aria-pressed', 'true'); frameBounds(active.effectBounds, true);
}
function render() {
  if (!renderer || disposed || !lanes.length) return;
  const width = stage.clientWidth, height = stage.clientHeight, split = Math.floor(width / 2);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, width, height); renderer.clear(true, true, true);
  renderer.setScissorTest(true);
  for (let i = 0; i < lanes.length; i++) {
    const x = i ? split : 0, w = i ? width - split : split;
    renderer.setViewport(x, 0, w, height); renderer.setScissor(x, 0, w, height);
    if (outlined) outline.render(lanes[i].scene, camera); else renderer.render(lanes[i].scene, camera);
  }
  renderer.setScissorTest(false);
  stats.resources = { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, templates: templates.size };
}
async function selectEffect(id) {
  const item = catalog?.items.find(entry => entry.id === id);
  if (!item) return false;
  const current = ++ticket; ready = false; stats.ready = false; window.__richVfxReady = false;
  $('loading').hidden = false; $('loading').textContent = `${item.name_ko || id} · 원본과 확대판을 준비하고 있습니다`;
  getRichProfile(id); // Keep the exact original catalog contract.
  const profile = getImpactfulProfile(id), weaponId = item.weapon_id || '01-machine-gun';
  const weapon = weaponCatalog.items.find(entry => entry.id === weaponId);
  if (!weapon || !/^\d{2}-[a-z0-9-]+\/weapon\.glb$/.test(weapon.model)) throw new Error('기존 무기 경로를 확인해 주세요.');
  let effectTemplate, weaponTemplate, projectileTemplate;
  try {
    // Sequential acquisition makes failure cleanup explicit; no partial leaked
    // Promise.all result when one of the two source assets fails to load.
    effectTemplate = await loadTemplate(`../combat-vfx/${item.model}`);
    weaponTemplate = await loadTemplate(`../weapon-modules/${weapon.model}`);
    if (id === 'harpoon-launch') projectileTemplate = await loadTemplate('../combat-vfx/assets/harpoon-projectile.glb');
    if (current !== ticket || disposed) { effectTemplate.dispose(); weaponTemplate.dispose(); projectileTemplate?.dispose(); return false; }
    const clip = effectTemplate.animations[0];
    if (!clip || !Number.isFinite(clip.duration) || clip.duration <= 0) throw new Error('실제 애니메이션 클립이 필요합니다.');
    active?.effects.forEach(effect => effect.dispose());
    active?.effectTemplate.dispose(); active?.weaponTemplate.dispose(); active?.projectileTemplate?.dispose();
    installWeapon(weaponTemplate, weaponId);
    duration = id === 'harpoon-launch' ? HARPOON_DURATION : id === 'cannon-muzzle' ? CANNON_STAGE_DURATIONS.muzzle : id === 'cannon-hit' ? CANNON_STAGE_DURATIONS.hit : clip.duration;
    const effects = lanes.map((lane, i) => id === 'harpoon-launch' && i === 1
      ? createReadableHarpoon(effectTemplate, projectileTemplate, item, lane, profile)
      : i === 1 && /^cannon-(muzzle|hit)$/.test(id) ? createCannonEffect(item,lane)
      : createLaneEffect(effectTemplate, item, lane, i === 1, profile));
    active = { item, profile, effects, effectTemplate, weaponTemplate, projectileTemplate, effectBounds: new THREE.Box3() };
    // Use one stable extent of the entire two-lane clip. Independently fitting
    // each side would hide the enlargement and produce different cameras.
    for (let sample = 0; sample <= 24; sample++) {
      for (const effect of effects) { effect.evaluate(duration * sample / 24); active.effectBounds.union(new THREE.Box3().setFromObject(effect.root)); }
    }
    $('rich-heading').textContent = ['cannon-muzzle', 'cannon-hit', 'harpoon-launch'].includes(id)
      ? '새 극적 연출 · 큰 형태와 긴 여운' : '이전 풍성 프로파일';
    $('effect-select').value = id; $('timeline').max = String(duration); $('effect-name').textContent = item.name_ko || id;
    $('purpose').textContent = item.purpose || '';
    $('profile-note').textContent = `크기 ${profile.scale.toFixed(2)}배 · 겹침 ${profile.projectile ? 0 : profile.echoes.length}겹 추가`;
    $('rich-label').textContent = `v1 · 더 강한 연출 · 크기 · ${profile.scale.toFixed(2)}배${profile.echoes.length ? ` · ${profile.echoes.length}겹 추가` : ''}`;
    $('lifetime-note').textContent = profile.stateful ? '지속 효과의 한 주기를 함께 비교합니다.' : '시작과 종료 시점은 기존 효과와 같습니다.';
    $('clip-note').textContent = `${duration.toFixed(2)}초 · 같은 v1 GLB`;
    $('placement-note').textContent = profile.projectile ? '외부 무기에서 출발하는 전시용 궤적입니다. 양쪽의 이동 거리는 같습니다.' : '선체 옆 외부 배치 시안입니다. 실제 장착 소켓이나 피격 판정은 아닙니다.';
    if (id === 'harpoon-launch') {
      $('rich-label').textContent = '팽팽한 장전 → 강한 해방 → 두 번 감긴 줄의 채찍 움직임';
      $('purpose').textContent = '작살이 레일에서 튀어나오고, 발사기가 뒤로 밀리며 밧줄이 풀려 나가는 순간입니다.';
      $('lifetime-note').textContent = '양쪽 모두 0.28초에 발사합니다. 오른쪽은 장전·채찍처럼 풀리는 줄·긴 관성을 연결합니다.';
      $('profile-note').textContent = '작살 한 개 · 강한 해방 반동 · 하나의 연속 밧줄';
      $('placement-note').textContent = '표적과 걸림 없는 발사 연출 시안입니다. 실제 작살 전투는 아닙니다.';
      $('clip-note').textContent = '공통 발사 0.28초 · 원본 클립 0.35초 · 새 시연 1.70초';
    }
    if (/^cannon-(muzzle|hit)$/.test(id)) {
      $('rich-label').textContent = id==='cannon-hit' ? '접촉 섬광 · 큰 붓꽃 · 파열편 · 말리는 연기' : '압축 · 길게 찢어지는 불꽃 · 공기층 · 연기';
      $('profile-note').textContent = '큰 주형태와 서로 다른 재료·시간층을 새로 구성';
      $('lifetime-note').textContent = '같은 사건 시각에서 비교합니다. 오른쪽은 더 긴 잔해·연기 여운을 보여줍니다.';
      $('clip-note').textContent = '기존 '+clip.duration.toFixed(2)+'초 · 새 '+duration.toFixed(2)+'초';
    } else if (id!=='harpoon-launch') {
      $('rich-label').textContent = '이전 2.6배 이하 프로파일 보존';
      $('profile-note').textContent = '추가 45종은 이전 기술 기준 · 새 극적 연출 미적용';
    }
    Object.assign(stats, { selectedId: id, profile, sourcePath: effectTemplate.sourcePath, clipName: clip.name, catalogDuration: item.duration, error: null,
      weaponId, projectilePath: profile.projectile ? 'authored display translation, scale compensated; no physics' : null });
    evaluateTime(0); reset();
    await Promise.all(lanes.map(lane => renderer.compileAsync(lane.scene, camera)));
    if (current !== ticket || disposed) return false;
    ready = true; stats.ready = true; window.__richVfxReady = true; $('loading').hidden = true;
    setPlaying(!reducedMotion); render(); return true;
  } catch (error) {
    if (active?.effectTemplate !== effectTemplate) effectTemplate?.dispose();
    if (active?.weaponTemplate !== weaponTemplate) weaponTemplate?.dispose();
    if (active?.projectileTemplate !== projectileTemplate) projectileTemplate?.dispose();
    if (current !== ticket || disposed) return false;
    throw error;
  }
}
function fail(error) {
  ready = false; stats.ready = false; window.__richVfxReady = false; stats.error = String(error?.message || error);
  $('loading').hidden = false; $('loading').textContent = `작업대를 열지 못했습니다. ${stats.error}`; console.error(error);
}
function dispose() {
  if (disposed) return;
  disposed = true; ticket++; cancelAnimationFrame(frame); observer?.disconnect();
  active?.effects.forEach(effect => effect.dispose()); active = null;
  for (const template of [...templates]) template.dispose();
  controls?.dispose(); atlas?.dispose(); gradient.dispose(); renderer?.dispose();
  stats.ready = false; window.__richVfxReady = false;
}
async function initialize() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0, 0); renderer.autoClear = true;
  renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', '같은 비행선 위의 기존 v1과 확대 v1. 드래그 회전, 휠 확대.'); stage.prepend(renderer.domElement);
  camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .01, 100);
  camera.position.copy(initialDirection).multiplyScalar(16);
  controls = new OrbitControls(camera, renderer.domElement);
  // Camera-only changes must also reface painted cards while time is paused.
  // Absolute sampling preserves the play state and never advances the event.
  controls.addEventListener('change', () => {
    if (active && !disposed) evaluateTime(time);
  });
  controls.enableDamping = true; controls.dampingFactor = .085;
  controls.minZoom = .25; controls.maxZoom = 10; controls.autoRotateSpeed = .6; controls.screenSpacePanning = true;
  outline = new OutlineEffect(renderer, { defaultThickness: .001, defaultKeepAlive: false });
  // Essential: OutlineEffect changes renderer.autoClear internally. Its own
  // autoClear must be true to prevent accumulated rotating frames.
  outline.autoClear = true;
  atlas = await new THREE.TextureLoader(manager).loadAsync('../combat-vfx-v2/machine-gun-soft-runtime-v1/textures/soft-vfx-atlas.png');
  atlas.colorSpace=THREE.SRGBColorSpace;
  if(disposed){atlas.dispose();return;}
  const values = await Promise.all([json('../combat-vfx/catalog.json'), json('../weapon-modules/catalog.json'), loadTemplate('../selected-airship-toon3d/airship.glb')]);
  [catalog, weaponCatalog] = values; const shipTemplate = values[2];
  if (!Array.isArray(catalog.items) || catalog.items.length !== 48 || new Set(catalog.items.map(item => item.id)).size !== 48) throw new Error('v1 기본 48종 카탈로그가 필요합니다.');
  for (const item of catalog.items) {
    if (!/^assets\/[a-z0-9-]+\.glb$/.test(item.model)) throw new Error(`등록된 로컬 효과 경로가 아닙니다: ${item.id}`);
    getRichProfile(item.id);
  }
  if (!Array.isArray(weaponCatalog.items)) throw new Error('기존 무기 카탈로그가 필요합니다.');
  const platform = platformTemplate(), target = targetTemplate();
  lanes = ['v1', 'rich'].map(id => {
    const scene = new THREE.Scene(), ship = normalize(instanceOf(shipTemplate), 5.2, new THREE.Vector3(0, 1.35, 0));
    const support = instanceOf(platform), contact = instanceOf(target); contact.source.visible = false;
    const key = new THREE.DirectionalLight(0xfff8e9, 2); key.position.set(4, 8, 5);
    scene.add(new THREE.AmbientLight(0xffffff, 1.1), key, ship.root, support.source, contact.source);
    return { id, scene, ship, support, target: contact, weapon: null, muzzle: new THREE.Vector3() };
  });
  $('effect-select').replaceChildren(...[...catalog.items].sort((a, b) => a.order - b.order).map(item => new Option(item.name_ko || item.id, item.id)));
  stats.effectCount = catalog.items.length; $('count').textContent = '대포·작살 새 연출 / 전체 48종';
  $('effect-select').addEventListener('change', event => selectEffect(event.target.value).catch(fail));
  $('play').addEventListener('click', () => setPlaying(!playing));
  $('replay').addEventListener('click', () => { evaluateTime(0); setPlaying(true); });
  $('timeline').addEventListener('input', event => setTime(event.target.value));
  $('loop').addEventListener('change', event => setLoop(event.target.checked));
  $('speed').addEventListener('change', event => setSpeed(event.target.value));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $('outline').addEventListener('change', event => setOutline(event.target.checked));
  $('background').addEventListener('click', () => setBackground(!deep));
  $('focus').addEventListener('click', () => setFocus(!focused));
  $('fit').addEventListener('click', () => fit(false)); $('reset').addEventListener('click', reset);
  $('rotate').addEventListener('click', () => setAutoRotate(!controls.autoRotate));
  window.__richVfxPreview = { selectEffect, setTime, setPlaying, setLoop, setSpeed, setMode, setOutline, setFocus, setAutoRotate, setBackground,
    reset, fit: () => fit(false), render, dispose, renderer, camera, controls, outline,
    get lanes() { return lanes; }, get active() { return active; }, get items() { return catalog.items; } };
  window.__impactfulVfxPreview = window.__richVfxPreview;
  window.__dramaticVfxPreview = window.__richVfxPreview;
  observer = new ResizeObserver(() => { resize(); render(); }); observer.observe(stage); resize(); setOutline(outlined);
  const requested = new URLSearchParams(location.search).get('effect');
  await selectEffect(catalog.items.some(item => item.id === requested) ? requested : 'cannon-hit');
  function animate(now) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const delta = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
    if (ready && playing) {
      const next = time + delta * speed;
      if (next >= duration) {
        if (loop) evaluateTime(next % duration);
        else { evaluateTime(duration); setPlaying(false); }
      } else evaluateTime(next);
    }
    controls.update(delta); render();
  }
  frame = requestAnimationFrame(animate);
}
// Register before async acquisition so a closed/failed initial load also
// releases completed templates; later pending loads see disposed and self-free.
window.addEventListener('beforeunload', dispose, { once: true });
initialize().catch(error => { fail(error); dispose(); });
