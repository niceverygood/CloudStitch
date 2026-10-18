import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

const TAU = Math.PI * 2;
const ELEVATION = 55 * Math.PI / 180;
const MAX_CACHED_ASSETS = 8;

// This adapter renders authored art. Battle positions, damage, hit proxies and
// stage rules remain in the caller. Every animated rig lives below a distinct
// gameplay transform; GLB tracks never bind to that gameplay transform.
export async function createBattleScene({ canvas, onError = () => {}, onLoaded = () => {}, reducedMotion = false }) {
  if (!canvas) throw new Error('createBattleScene needs a canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0xf1f2e5, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-22, 22, 17, -17, .1, 200);
  camera.position.set(0, 32, 32 / Math.tan(ELEVATION));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const ambient = new THREE.AmbientLight(0xfff8e9, 1.05);
  const light = new THREE.DirectionalLight(0xffffff, 1.25);
  light.position.set(-12, 30, 18);
  scene.add(ambient, light, new THREE.HemisphereLight(0xecf4ed, 0xa5b29a, .35));
  const outline = new OutlineEffect(renderer, { defaultThickness: .0015, defaultColor: [.12, .18, .16], defaultKeepAlive: false });
  outline.autoClear = true;
  const gradient = new THREE.DataTexture(new Uint8Array([95, 180, 255]), 3, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false; gradient.needsUpdate = true;
  const loader = new GLTFLoader();
  const baseURL = new URL('../fleet-v1/ships/', document.baseURI);
  const cache = new Map(), actors = new Map(), projectiles = new Map(), telegraphs = new Map(), effects = new Map(), pickups = new Map();
  const errors = [], ownedGeometry = new Set(), ownedMaterials = new Set(), ownedTextures = new Set();
  const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let disposed = false, stageId = null, serial = 0, frame = 0, lastSnapshot = null;
  let canvasWidth = 1, canvasHeight = 1;

  const geometry = value => { ownedGeometry.add(value); return value; };
  const material = value => { value.userData.outlineParameters = { visible: false }; ownedMaterials.add(value); return value; };
  const texture = value => { ownedTextures.add(value); return value; };
  const sphereGeometry = geometry(new THREE.SphereGeometry(1, 10, 6));
  const planeGeometry = geometry(new THREE.PlaneGeometry(1, 1));
  const circleGeometry = geometry(new THREE.CircleGeometry(1, 40));
  const thinRingGeometry = geometry(new THREE.RingGeometry(.86, 1, 40));
  const projectileMaterials = {
    player: material(new THREE.MeshBasicMaterial({ color: 0xf3bf67 })),
    enemy: material(new THREE.MeshBasicMaterial({ color: 0xc66752 })),
  };

  function canvasTexture(draw, width = 128, height = 128) {
    const element = document.createElement('canvas'); element.width = width; element.height = height;
    draw(element.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(element); map.colorSpace = THREE.SRGBColorSpace;
    return texture(map);
  }
  const shadowMap = canvasTexture((ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, 'rgba(58,84,70,.32)'); gradient.addColorStop(.65, 'rgba(58,84,70,.12)'); gradient.addColorStop(1, 'rgba(58,84,70,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  });
  const glowMap = canvasTexture((ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,.9)'); gradient.addColorStop(.45, 'rgba(255,255,255,.35)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  });
  const shadowMaterial = material(new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, toneMapped: false }));
  const loadingLabels = {};
  for (const [key, label, color] of [['loading', '비행선 준비 중', '#617a70'], ['error', '모델 로딩 오류', '#9e594d']]) {
    loadingLabels[key] = canvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#faf7e9'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '500 22px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'; ctx.fillText(label, w / 2, h / 2);
    }, 256, 48);
  }
  const crestMaps = {};
  for (const team of ['player', 'enemy', 'boss']) crestMaps[team] = canvasTexture((ctx, w, h) => {
    const ink = team === 'player' ? '#547f73' : team === 'boss' ? '#b08a42' : '#b57460';
    ctx.fillStyle = ink;
    if (team === 'boss') {
      ctx.lineWidth = 8; ctx.strokeStyle = '#bca269'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .36, 0, TAU); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = w * (i % 2 ? .12 : .26); const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillRect(w * .28, h * .2, 7, h * .6); ctx.beginPath(); ctx.moveTo(w * .34, h * .22); ctx.lineTo(w * .78, h * .32); ctx.lineTo(w * .59, h * .48); ctx.lineTo(w * .34, h * .43); ctx.closePath(); ctx.fill();
    }
  });
  // Static, soft cloud banks keep attack markings readable. No opaque terrain
  // sits between the camera and the battle plane.
  const clouds = new THREE.Group(); clouds.name = 'Painted cloud banks'; scene.add(clouds);
  const cloudMap = canvasTexture((ctx, w, h) => {
    const g = ctx.createRadialGradient(w * .5, h * .5, 0, w * .5, h * .5, w * .5);
    g.addColorStop(0, '#fffdf2e0'); g.addColorStop(.55, '#fffdf2a0'); g.addColorStop(1, '#fffdf200'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const cloudMaterial = material(new THREE.MeshBasicMaterial({ map: cloudMap, transparent: true, depthWrite: false, toneMapped: false }));
  for (let i = 0; i < 18; i++) {
    const cloud = new THREE.Mesh(planeGeometry, cloudMaterial); cloud.rotation.x = -Math.PI / 2;
    cloud.position.set(Math.sin(i * 2.37) * 24, -.55 - (i % 3) * .025, Math.cos(i * 1.73) * 17);
    cloud.scale.set(11 + i % 4 * 2, 7 + i % 3, 1); clouds.add(cloud);
  }
  const terrain = new THREE.Group(); terrain.name = 'Visible collision obstacles'; scene.add(terrain);
  const terrainBox = geometry(new THREE.BoxGeometry(1, 1, 1));
  const terrainRock = geometry(new THREE.DodecahedronGeometry(1, 0));
  const terrainCylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  const terrainTorus = geometry(new THREE.TorusGeometry(1, .06, 6, 32));
  const collisionRing = geometry(new THREE.RingGeometry(.985, 1, 48));
  const terrainMats = {};
  for (const [name, color] of Object.entries({ rock: 0x8c9b93, wood: 0x967451, metal: 0x65857d, brass: 0xb9a168, vent: 0xae725d, dark: 0x58685f })) {
    const mat = material(new THREE.MeshToonMaterial({ color, gradientMap: gradient, toneMapped: false }));
    mat.userData.outlineParameters = { visible: true, thickness: .0011, color: [.16, .22, .18], keepAlive: false };
    terrainMats[name] = mat;
  }
  const collisionMaterial = material(new THREE.MeshBasicMaterial({ color: 0x927b62, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide }));
  const boundaryMaterial = material(new THREE.LineDashedMaterial({ color: 0xad9071, transparent: true, opacity: .56, dashSize: .6, gapSize: .42, depthWrite: false }));
  const boundaryGeometry = geometry(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-18, .035, -12), new THREE.Vector3(18, .035, -12), new THREE.Vector3(18, .035, 12), new THREE.Vector3(-18, .035, 12), new THREE.Vector3(-18, .035, -12),
  ]));
  const boundary = new THREE.Line(boundaryGeometry, boundaryMaterial); boundary.computeLineDistances(); boundary.name = 'Arena mooring boundary'; scene.add(boundary);
  const reticle = new THREE.Group(); reticle.name = 'Player aim reticle'; reticle.visible = false; scene.add(reticle);
  const aimInk = material(new THREE.MeshBasicMaterial({ color: 0x556d65, transparent: true, opacity: .4, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  const aimCream = material(new THREE.MeshBasicMaterial({ color: 0xfff1d2, transparent: true, opacity: .95, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  for (const [size, mat, height] of [[.34, aimInk, 0], [.3, aimCream, .004]]) {
    const ring = new THREE.Mesh(thinRingGeometry, mat); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(size); ring.position.y = height; ring.renderOrder = 10; reticle.add(ring);
  }
  const aimPoint = new THREE.Mesh(sphereGeometry, aimCream); aimPoint.scale.setScalar(.035); aimPoint.position.y = .008; aimPoint.renderOrder = 11; reticle.add(aimPoint);
  const buoys = new THREE.Group(); buoys.name = 'Arena mooring buoys'; scene.add(buoys);
  for (const [x, z] of [[-18,-12],[0,-12],[18,-12],[-18,0],[18,0],[-18,12],[0,12],[18,12]]) {
    const buoy = new THREE.Mesh(terrainRock, terrainMats.metal); buoy.position.set(x, .14, z); buoy.scale.set(.23, .22, .23); buoys.add(buoy);
    const cap = new THREE.Mesh(terrainCylinder, terrainMats.brass); cap.position.set(x, .29, z); cap.scale.set(.11, .08, .11); buoys.add(cap);
  }
  let environmentKey = '';

  function updateEnvironment(stage) {
    const env = stage?.environment || {}, key = JSON.stringify([stage?.id, env.skyColor, env.cloudColor, env.accent, env.obstacles]);
    if (key === environmentKey) return;
    environmentKey = key;
    renderer.setClearColor(env.skyColor || 0xf1f2e5, 1);
    cloudMaterial.color.set(env.cloudColor || 0xffffff);
    boundaryMaterial.color.set(env.accent || 0xad9071);
    collisionMaterial.color.set(env.accent || 0x927b62);
    terrainMats.metal.color.set(env.accent || 0x65857d).lerp(new THREE.Color(0x73877c), .35);
    terrain.clear();
    for (const [index, obstacle] of (env.obstacles || []).entries()) {
      const r = Math.max(obstacle.r || .7, .1), group = new THREE.Group();
      group.name = `Collision obstacle ${obstacle.label || obstacle.kind || index}`;
      group.position.set(obstacle.x || 0, 0, obstacle.z || 0); terrain.add(group);
      const add = (g, m, p, scale, rotation = [0, 0, 0]) => {
        const object = new THREE.Mesh(g, m); object.position.fromArray(p); object.scale.fromArray(scale); object.rotation.fromArray(rotation); group.add(object); return object;
      };
      add(collisionRing, collisionMaterial, [0, .035, 0], [r, r, 1], [-Math.PI / 2, 0, 0]);
      if (obstacle.kind === 'wreck') {
        add(terrainRock, terrainMats.dark, [0, .13, 0], [r * .7, .23, r * .58]);
        for (let i = 0; i < 4; i++) {
          const angle = (i - 1.5) * .29;
          add(terrainBox, terrainMats.wood, [(i - 1.5) * r * .16, .26 + (i % 2) * .065, (i - 1.5) * r * .1], [r * 1.2, .12, r * .19], [.04 * i, angle, .045 * (i - 1)]);
        }
        add(terrainBox, terrainMats.brass, [r * .19, .39, 0], [.09, .1, r * 1.02], [0, .13, 0]);
      } else if (obstacle.kind === 'pillar') {
        add(terrainCylinder, terrainMats.dark, [0, .03, 0], [r * .8, .17, r * .8]);
        add(terrainCylinder, terrainMats.metal, [0, .34, 0], [r * .5, .68, r * .5]);
        add(terrainTorus, terrainMats.brass, [0, .56, 0], [r * .52, r * .52, r * .52], [Math.PI / 2, 0, 0]);
        add(terrainCylinder, terrainMats.brass, [0, .7, 0], [r * .61, .1, r * .61]);
      } else if (obstacle.kind === 'vent') {
        add(terrainCylinder, terrainMats.dark, [0, .07, 0], [r * .83, .22, r * .83]);
        add(terrainCylinder, terrainMats.vent, [0, .27, 0], [r * .64, .37, r * .64]);
        for (let i = -1; i <= 1; i++) add(terrainBox, terrainMats.brass, [0, .47, i * r * .26], [r * 1.08, .07, .08]);
      } else if (obstacle.kind === 'seal') {
        add(terrainCylinder, terrainMats.dark, [0, .14, 0], [r * .78, .34, r * .78]);
        add(terrainTorus, terrainMats.brass, [0, .34, 0], [r * .54, r * .54, r * .54], [Math.PI / 2, 0, 0]);
        add(terrainBox, terrainMats.brass, [0, .39, 0], [r * .72, .09, r * .12], [0, .35, 0]);
        add(terrainBox, terrainMats.brass, [0, .39, 0], [r * .12, .09, r * .72], [0, .35, 0]);
      } else {
        add(terrainRock, terrainMats.rock, [0, .24, 0], [r * .83, .36, r * .79], [.09, index * .8, .13]);
        add(terrainRock, terrainMats.dark, [r * .36, .12, -r * .27], [r * .34, .24, r * .32], [0, index, 0]);
      }
    }
  }

  function emitError(error, assetId, actorId) {
    const item = { assetId, actorId, message: String(error?.message || error) };
    if (!errors.some(e => e.assetId === assetId && e.message === item.message)) { errors.push(item); const surfaced = new Error(item.message); Object.assign(surfaced, item); try { onError(surfaced); } catch { /* UI callbacks cannot break rendering. */ } }
  }

  function prepareMaterials(gltf) {
    const converted = new Map(), textures = new Set(), geometries = new Set(), sourceMaterials = new Set();
    let triangles = 0, bones = 0, geometryBytes = 0;
    gltf.scene.traverse(object => {
      if (object.isBone) bones++;
      if (!object.isMesh) return;
      object.frustumCulled = false;
      triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
      if (!geometries.has(object.geometry)) {
        geometries.add(object.geometry);
        for (const a of Object.values(object.geometry.attributes)) geometryBytes += a.isInterleavedBufferAttribute ? a.data.array.byteLength : a.array.byteLength;
        geometryBytes += object.geometry.index?.array.byteLength || 0;
      }
      const convert = source => {
        if (converted.has(source)) return converted.get(source);
        sourceMaterials.add(source);
        for (const value of Object.values(source)) if (value?.isTexture) textures.add(value);
        const mat = new THREE.MeshToonMaterial({
          color: source.color?.clone() || new THREE.Color(0xffffff), map: source.map || null,
          alphaMap: source.alphaMap || null, transparent: source.transparent, opacity: source.opacity,
          alphaTest: source.alphaTest, side: source.side, vertexColors: source.vertexColors,
          depthWrite: source.depthWrite, depthTest: source.depthTest, gradientMap: gradient,
          emissive: source.emissive?.clone() || new THREE.Color(0), emissiveMap: source.emissiveMap || null,
          toneMapped: false,
        });
        mat.name = `${source.name} / battle toon`;
        mat.userData.outlineParameters = { thickness: .0015, color: [.12, .18, .16], alpha: 1, visible: true, keepAlive: false };
        converted.set(source, mat); return mat;
      };
      object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
    });
    for (const old of sourceMaterials) old.dispose();
    const images = new Set([...textures].map(t => t.source?.data || t.image).filter(Boolean));
    const decodedImageBytes = [...images].reduce((sum, image) => sum + (image.width || 0) * (image.height || 0) * 4, 0);
    return { materials: new Set(converted.values()), textures, geometries, triangles, bones, geometryBytes, decodedImageBytes };
  }

  function disposeAsset(entry) {
    if (entry.disposed) return; entry.disposed = true;
    if (entry.resources) {
      for (const geometry of entry.resources.geometries) geometry.dispose();
      for (const material of entry.resources.materials) material.dispose();
      const images = new Set();
      for (const map of entry.resources.textures) { images.add(map.source?.data || map.image); map.dispose(); }
      for (const image of images) if (image?.close) image.close();
    }
    if (cache.get(entry.id) === entry) cache.delete(entry.id);
  }

  function trimCache(stageChanged = false) {
    if (stageChanged) for (const entry of cache.values()) if (entry.refs === 0) entry.dropWhenUnused = true;
    const free = [...cache.values()].filter(entry => entry.refs === 0 && entry.state !== 'loading').sort((a, b) => a.lastUsed - b.lastUsed);
    for (const entry of free) if (stageChanged || entry.dropWhenUnused || cache.size > MAX_CACHED_ASSETS || disposed) disposeAsset(entry);
  }

  function loadAsset(assetId) {
    if (!/^[a-z0-9-]+$/.test(assetId)) throw new Error(`Invalid asset id: ${assetId}`);
    if (cache.has(assetId)) { const entry = cache.get(assetId); entry.lastUsed = frame; entry.dropWhenUnused = false; return entry; }
    const entry = { id: assetId, state: 'loading', refs: 0, lastUsed: frame, bytes: 0, disposed: false };
    cache.set(assetId, entry);
    entry.promise = (async () => {
      const response = await fetch(new URL(`${assetId}.glb`, baseURL));
      if (!response.ok) throw new Error(`비행선 파일을 불러오지 못했습니다 (${response.status}): ${assetId}`);
      const buffer = await response.arrayBuffer(); entry.bytes = buffer.byteLength;
      const gltf = await loader.parseAsync(buffer, baseURL.href);
      if (!gltf.scene) throw new Error(`GLB scene is missing: ${assetId}`);
      entry.resources = prepareMaterials(gltf); entry.gltf = gltf; entry.state = 'loaded';
      if (disposed || (entry.dropWhenUnused && entry.refs === 0)) disposeAsset(entry);
      return entry;
    })().catch(error => { entry.state = 'error'; entry.error = error; throw error; });
    return entry;
  }

  function actorLength(actor, player) {
    const facility = actor.role === 'facility' || actor.role === 'environment' || ['boss-last-inhale', 'boss-living-shipyard'].includes(actor.assetId);
    const base = player ? 3.5 : facility ? 8 : actor.tier === 'finalboss' ? 6.5 : actor.tier === 'midboss' ? 4.5 : 3.5;
    return base * (Number.isFinite(actor.scale) ? THREE.MathUtils.clamp(actor.scale, .5, 2) : 1);
  }

  function placeholder(record) {
    const group = new THREE.Group(); group.name = `${record.id} / temporary loading marker`;
    const hullMat = new THREE.MeshBasicMaterial({ color: record.player ? 0x6c9a8b : 0xad8c7b, transparent: true, opacity: .32, wireframe: true });
    hullMat.userData.outlineParameters = { visible: false };
    record.localMaterials.push(hullMat);
    const hull = new THREE.Mesh(sphereGeometry, hullMat); hull.scale.set(record.length * .42, .16, record.length * .13); hull.position.y = .5; group.add(hull);
    const balloon = new THREE.Mesh(sphereGeometry, hullMat); balloon.scale.set(record.length * .4, .28, .3); balloon.position.y = 1.2; group.add(balloon);
    const labelMat = new THREE.SpriteMaterial({ map: loadingLabels.loading, depthTest: false, depthWrite: false });
    record.localMaterials.push(labelMat);
    const label = new THREE.Sprite(labelMat); label.position.y = 1.8; label.scale.set(1.8, .34, 1); group.add(label); record.label = label;
    record.group.add(group); record.placeholder = group;
  }

  function releaseActor(record) {
    record.generation = ++serial;
    record.group.removeFromParent();
    if (record.entry) record.entry.refs = Math.max(0, record.entry.refs - 1);
    if (record.mixer) { record.mixer.stopAllAction(); record.mixer.uncacheRoot(record.rig); }
    if (record.rig) {
      const skeletons = new Set(); record.rig.traverse(o => { if (o.isSkinnedMesh) skeletons.add(o.skeleton); });
      for (const skeleton of skeletons) skeleton.dispose();
    }
    for (const local of record.localMaterials) local.dispose();
    actors.delete(record.id);
  }

  function addActor(actor, player) {
    const record = { id: actor.id, assetId: actor.assetId, player, tier: actor.tier || (player ? 'player' : 'normal'), role: actor.role, group: new THREE.Group(), length: actorLength(actor, player), state: 'loading', generation: ++serial, localMaterials: [], triangleCount: 0 };
    record.group.name = `Gameplay transform ${record.id}`; scene.add(record.group); actors.set(actor.id, record);
    const shadow = new THREE.Mesh(planeGeometry, shadowMaterial); shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.14;
    shadow.scale.set(record.length * 1.15, record.length * .5, 1); record.group.add(shadow);
    const flashMat = new THREE.SpriteMaterial({ map: glowMap, transparent: true, opacity: 0, depthWrite: false, depthTest: false }); record.localMaterials.push(flashMat);
    record.flash = new THREE.Sprite(flashMat); record.flash.position.y = .65; record.flash.scale.set(record.length * .85, record.length * .55, 1); record.group.add(record.flash);
    const boss = !player && actor.tier !== 'normal' && Boolean(actor.tier);
    const crestMat = new THREE.SpriteMaterial({ map: crestMaps[boss ? 'boss' : player ? 'player' : 'enemy'], transparent: true, depthTest: true, depthWrite: false }); record.localMaterials.push(crestMat);
    record.crest = new THREE.Sprite(crestMat); record.crest.scale.setScalar(boss ? .62 : .34); record.group.add(record.crest);
    placeholder(record);
    const generation = record.generation;
    let entry;
    try { entry = loadAsset(actor.assetId); record.entry = entry; entry.refs++; }
    catch (error) { record.state = 'error'; record.label.material.map = loadingLabels.error; emitError(error, actor.assetId, actor.id); return record; }
    entry.promise.then(loaded => {
      if (disposed || actors.get(record.id) !== record || generation !== record.generation || loaded.disposed) { trimCache(); return; }
      const rig = cloneSkeleton(loaded.gltf.scene); rig.updateMatrixWorld(true);
      // SkeletonUtils clones a Skeleton for every skinned part. These exports
      // use one common palette per ship, so reuse that palette *inside this
      // actor* rather than allocating a bone texture for every rivet material.
      const palettes = new Map();
      rig.traverse(object => {
        if (!object.isSkinnedMesh) return;
        const key = object.skeleton.bones.map(bone => bone.uuid).join(',');
        const shared = palettes.get(key);
        const sameInverses = shared && shared.boneInverses.length === object.skeleton.boneInverses.length && shared.boneInverses.every((inverse, i) => inverse.elements.every((value, j) => Math.abs(value - object.skeleton.boneInverses[i].elements[j]) < 1e-8));
        if (shared && sameInverses) {
          object.skeleton.dispose(); object.skeleton = shared;
        } else palettes.set(key, object.skeleton);
      });
      const box = new THREE.Box3().setFromObject(rig), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      if (box.isEmpty() || !Number.isFinite(size.x) || size.x < .00001) throw new Error(`GLB bounds are invalid: ${record.assetId}`);
      const scale = record.length / size.x;
      const wrapper = new THREE.Group(); wrapper.name = `Normalized child rig ${record.id}`;
      wrapper.scale.setScalar(scale); wrapper.position.set(-center.x * scale, .16 - box.min.y * scale, -center.z * scale);
      wrapper.add(rig); record.group.add(wrapper);
      record.placeholder.removeFromParent(); record.placeholder = null; record.rig = rig; record.wrapper = wrapper;
      record.normalizationScale = scale; record.triangleCount = loaded.resources.triangles; record.state = 'loaded';
      record.turrets = [];
      rig.traverse(object => { if (object.isBone && (object.name === 'TurretYaw' || object.userData.controlRole === 'yaw' || /_Yaw$/.test(object.name))) record.turrets.push({ bone: object, bind: object.quaternion.clone() }); });
      record.crest.position.set(0, size.y * scale + .5, 0);
      record.mixer = new THREE.AnimationMixer(rig);
      const clip = loaded.gltf.animations.find(c => c.name === 'Cruise') || loaded.gltf.animations.find(c => c.name === 'FloatIdle') || loaded.gltf.animations[0];
      if (clip) { record.action = record.mixer.clipAction(clip).play(); record.action.setLoop(THREE.LoopRepeat, Infinity); }
      try { onLoaded({ actorId: record.id, assetId: record.assetId, ready: true, stats: getStats() }); } catch { /* UI callbacks cannot break rendering. */ }
    }).catch(error => {
      if (disposed || actors.get(record.id) !== record || generation !== record.generation) return;
      record.state = 'error'; if (record.label) record.label.material.map = loadingLabels.error;
      emitError(error, actor.assetId, actor.id);
    });
    return record;
  }

  function sweep(map, ids, remove) { for (const [id, record] of map) if (!ids.has(id)) { remove(record); map.delete(id); } }

  function updateActors(snapshot, dt) {
    const ids = new Set();
    reticle.visible = Number.isFinite(snapshot.player?.targetX) && Number.isFinite(snapshot.player?.targetZ);
    if (reticle.visible) reticle.position.set(snapshot.player.targetX, .08, snapshot.player.targetZ);
    for (const [actor, player] of [[snapshot.player, true], ...(snapshot.enemies || []).map(a => [a, false])]) {
      if (!actor) continue; ids.add(actor.id);
      let record = actors.get(actor.id);
      if (record && (record.assetId !== actor.assetId || Math.abs(record.length - actorLength(actor, player)) > .001)) { releaseActor(record); record = null; }
      if (!record) record = addActor(actor, player);
      record.group.position.set(actor.x || 0, 0, actor.z || 0);
      record.group.rotation.y = -(actor.angle || 0);
      record.tier = actor.tier || (player ? 'player' : 'normal'); record.role = actor.role;
      record.flash.material.opacity = THREE.MathUtils.clamp((actor.hitFlash || 0) * 6, 0, .45);
      if (record.mixer && !snapshot.paused && !reducedMotion) record.mixer.update(dt * (actor.dashing ? 1.35 : 1));
      if (record.turrets?.length && Number.isFinite(actor.aimAngle)) {
        record.group.updateMatrixWorld(true);
        const worldDirection = new THREE.Vector3(-Math.cos(actor.aimAngle), 0, -Math.sin(actor.aimAngle));
        for (const turret of record.turrets) {
          const parentRotation = turret.bone.parent.getWorldQuaternion(new THREE.Quaternion());
          const localDirection = worldDirection.clone().applyQuaternion(parentRotation.invert()).applyQuaternion(turret.bind.clone().invert());
          const yaw = Math.atan2(localDirection.z, -localDirection.x);
          turret.bone.quaternion.copy(turret.bind).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
          turret.bone.updateWorldMatrix(false, true);
        }
      }
      if (record.state !== 'loaded') record.crest.position.y = 2.2;
    }
    sweep(actors, ids, releaseActor);
  }

  function updateProjectiles(list) {
    const ids = new Set();
    for (const p of list || []) {
      ids.add(p.id); let record = projectiles.get(p.id);
      if (!record) { record = new THREE.Mesh(sphereGeometry, projectileMaterials[p.team === 'player' ? 'player' : 'enemy']); scene.add(record); projectiles.set(p.id, record); }
      const radius = Math.max(p.r || .1, .075);
      record.position.set(p.x, .5, p.z); record.rotation.y = -(p.angle || 0); record.scale.set(radius * 1.8, radius * .75, radius * .75);
    }
    sweep(projectiles, ids, object => object.removeFromParent());
  }

  function telegraphGeometry(t) {
    const positions = [], indices = [];
    const r = Math.max(t.r || t.length || 1, .05), thickness = Math.min(t.width || .35, r);
    if (t.shape === 'line') {
      const l = t.length || 1, w = (t.width || .4) / 2;
      positions.push(0, 0, -w, -l, 0, -w, -l, 0, w, 0, 0, w); indices.push(0, 1, 2, 0, 2, 3);
    } else if (t.shape === 'cone') {
      const length = t.length || t.r || 1, opening = Math.min(t.width || .8, TAU);
      positions.push(0, 0, 0);
      for (let i = 0; i <= 40; i++) { const a = -opening / 2 + opening * i / 40; positions.push(-Math.cos(a) * length, 0, -Math.sin(a) * length); if (i) indices.push(0, i, i + 1); }
    } else if (t.shape === 'ring') {
      const inner = Math.max(0, r - thickness / 2), outer = r + thickness / 2;
      for (let i = 0; i < 100; i++) {
        const a = TAU * i / 100, b = TAU * (i + 1) / 100, middle = (a + b) / 2;
        const safe = (t.safeAngle || 0) + Math.PI;
        const gap = Math.abs(Math.atan2(Math.sin(middle - safe), Math.cos(middle - safe)));
        if ((t.safeWidth || 0) > 0 && gap < t.safeWidth / 2) continue;
        const base = positions.length / 3;
        positions.push(Math.cos(a) * inner, 0, Math.sin(a) * inner, Math.cos(a) * outer, 0, Math.sin(a) * outer, Math.cos(b) * outer, 0, Math.sin(b) * outer, Math.cos(b) * inner, 0, Math.sin(b) * inner);
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    } else {
      positions.push(0, 0, 0);
      for (let i = 0; i <= 64; i++) { const a = TAU * i / 64; positions.push(Math.cos(a) * r, 0, Math.sin(a) * r); if (i) indices.push(0, i, i + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }

  function updateTelegraphs(list) {
    const ids = new Set();
    for (const t of list || []) {
      ids.add(t.id); const signature = [t.shape, t.length, t.width, t.r, t.safeAngle, t.safeWidth].join('|');
      let record = telegraphs.get(t.id);
      if (!record) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xcf8464, transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
        mat.userData.outlineParameters = { visible: false };
        const object = new THREE.Mesh(telegraphGeometry(t), mat); object.renderOrder = 1; scene.add(object);
        const stroke = new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry), new THREE.LineBasicMaterial({ color: 0xbb735b, transparent: true, opacity: .72, depthWrite: false }));
        stroke.position.y = .006; stroke.renderOrder = 2; object.add(stroke);
        record = { object, stroke, signature }; telegraphs.set(t.id, record);
      } else if (record.signature !== signature) {
        record.object.geometry.dispose(); record.stroke.geometry.dispose(); record.object.geometry = telegraphGeometry(t);
        record.stroke.geometry = new THREE.EdgesGeometry(record.object.geometry); record.signature = signature;
      }
      record.object.position.set(t.x, .05, t.z); record.object.rotation.y = ['line', 'cone'].includes(t.shape) ? -(t.angle || 0) : 0;
      record.object.material.color.set(t.locked ? 0xbf614f : 0xd09663);
      record.stroke.material.color.set(t.locked ? 0xa95645 : 0xbb735b);
      record.object.material.opacity = .12 + THREE.MathUtils.clamp(t.progress || 0, 0, 1) * .25;
    }
    sweep(telegraphs, ids, record => { record.object.removeFromParent(); record.object.geometry.dispose(); record.object.material.dispose(); record.stroke.geometry.dispose(); record.stroke.material.dispose(); });
  }

  function updateEffects(list) {
    const ids = new Set();
    for (const e of list || []) {
      ids.add(e.id); let object = effects.get(e.id);
      if (!object) {
        const mat = new THREE.SpriteMaterial({ map: glowMap, transparent: true, depthWrite: false, depthTest: false, color: e.type === 'repair' ? 0x88bca0 : e.type === 'dash' ? 0x95bfbd : 0xe6b16f });
        object = new THREE.Sprite(mat); scene.add(object); effects.set(e.id, object);
      }
      const u = THREE.MathUtils.clamp((e.age || 0) / Math.max(e.duration || .4, .001), 0, 1);
      const size = Math.max(e.r || .4, .1) * (reducedMotion ? 1 : 1 + u * 1.1);
      object.position.set(e.x, .65, e.z); object.scale.setScalar(size * 2); object.material.opacity = (1 - u) * .65;
    }
    sweep(effects, ids, object => { object.removeFromParent(); object.material.dispose(); });
  }

  function updatePickups(list) {
    const ids = new Set();
    for (const p of list || []) {
      ids.add(p.id); let record = pickups.get(p.id);
      if (!record) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x75a88f });
        mat.userData.outlineParameters = { visible: false };
        const group = new THREE.Group();
        const halo = new THREE.Mesh(thinRingGeometry, mat); halo.rotation.x = -Math.PI / 2; halo.scale.setScalar(.45); group.add(halo);
        const upright = new THREE.Mesh(planeGeometry, mat); upright.scale.set(.14, .48, 1); group.add(upright);
        const cross = new THREE.Mesh(planeGeometry, mat); cross.scale.set(.46, .14, 1); group.add(cross);
        scene.add(group); record = { group, mat, upright, cross }; pickups.set(p.id, record);
      }
      record.group.position.set(p.x, .28, p.z); record.upright.quaternion.copy(camera.quaternion); record.cross.quaternion.copy(camera.quaternion);
      record.group.scale.setScalar(Math.max(p.r || .45, .2) / .45);
    }
    sweep(pickups, ids, record => { record.group.removeFromParent(); record.mat.dispose(); });
  }

  function resize() {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect(); canvasWidth = Math.max(Math.round(rect.width || canvas.clientWidth || 1), 1); canvasHeight = Math.max(Math.round(rect.height || canvas.clientHeight || 1), 1);
    renderer.setSize(canvasWidth, canvasHeight, false);
    const aspect = canvasWidth / canvasHeight;
    // Fit the complete [-18,18] × [-12,12] plane in portrait as well as desktop.
    // Extra vertical room accommodates elevated envelopes and boss crests.
    const halfHeight = Math.max(14 * Math.sin(ELEVATION) + 3.2, 20 / aspect);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    mouse.set((clientX - rect.left) / Math.max(rect.width, 1) * 2 - 1, -(clientY - rect.top) / Math.max(rect.height, 1) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const point = raycaster.ray.intersectPlane(ground, new THREE.Vector3());
    return point ? { x: point.x, z: point.z } : { x: 0, z: 0 };
  }

  function getStats() {
    const active = [...actors.values()], entries = [...cache.values()];
    return {
      ready: !disposed && active.length > 0 && active.every(actor => actor.state === 'loaded'),
      loading: entries.filter(entry => entry.state === 'loading').length,
      loadedAssets: entries.filter(entry => entry.state === 'loaded' && entry.refs > 0).map(entry => entry.id),
      cachedAssets: entries.length, errors: errors.map(error => ({ ...error })),
      rendererMemory: { ...renderer.info.memory, calls: renderer.info.render.calls, glbBytes: entries.reduce((n, e) => n + e.bytes, 0), geometryBytes: entries.reduce((n, e) => n + (e.resources?.geometryBytes || 0), 0), decodedImageBytes: entries.reduce((n, e) => n + (e.resources?.decodedImageBytes || 0), 0) },
      actors: active.length, triangleCount: active.reduce((n, actor) => n + actor.triangleCount, 0),
      actorModels: active.map(actor => ({ id: actor.id, assetId: actor.assetId, tier: actor.tier, role: actor.role, state: actor.state, normalizationScale: actor.normalizationScale, triangles: actor.triangleCount })),
      outlineAutoClear: outline.autoClear === true, canvasWidth, canvasHeight, reducedMotion, stageId,
      renderedFrames: frame, cameraElevationDegrees: 55, obstacleCount: terrain.children.length, aimReticleVisible: reticle.visible,
    };
  }

  function sync(snapshot, dt = 0) {
    if (disposed || !snapshot) return;
    frame++; lastSnapshot = snapshot;
    const changed = stageId !== snapshot.stage?.id; stageId = snapshot.stage?.id;
    const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), .1);
    updateEnvironment(snapshot.stage);
    updateActors(snapshot, step); updateProjectiles(snapshot.projectiles); updateTelegraphs(snapshot.telegraphs); updateEffects(snapshot.effects); updatePickups(snapshot.repairPickups);
    trimCache(changed);
    outline.render(scene, camera);
  }

  function setReducedMotion(value) { reducedMotion = Boolean(value); }

  function dispose() {
    if (disposed) return; disposed = true;
    for (const record of [...actors.values()]) releaseActor(record);
    for (const entry of [...cache.values()]) if (entry.state !== 'loading') disposeAsset(entry);
    for (const record of telegraphs.values()) { record.object.geometry.dispose(); record.object.material.dispose(); record.stroke.geometry.dispose(); record.stroke.material.dispose(); }
    for (const object of effects.values()) object.material.dispose();
    for (const record of pickups.values()) record.mat.dispose();
    for (const value of ownedGeometry) value.dispose(); for (const value of ownedMaterials) value.dispose(); for (const value of ownedTextures) value.dispose();
    gradient.dispose(); scene.clear(); renderer.dispose(); lastSnapshot = null;
  }

  resize();
  outline.render(scene, camera);
  return { sync, resize, screenToWorld, setReducedMotion, getStats, dispose };
}
