/* Cloudstitch machine-gun painted presentation. No network or gameplay events.
 * Atlas: TL muzzle, TR impact, BL cream/sage smoke, BR horizontal gold trail.
 * Optional material atlas: TL brass, TR teal, BL wood, BR steel.
 * All times are absolute seconds. update() is deterministic and scrub-safe.
 * Attack repeats are three VISUAL copies, never three collision/fire events.
 */
export function createPaintedMG(THREE, { atlas, metalTexture = null } = {}) {
  if (!THREE?.Group || !atlas?.isTexture) throw new TypeError('createPaintedMG requires THREE and the painted atlas Texture.');
  const DURATIONS = Object.freeze({ attack: 2, muzzle: .2, projectile: .45, hit: .35 });
  const root = new THREE.Group(); root.name = 'machine_gun_painted_presentation';
  root.userData = { visualOnly: true, collisionAuthority: false, standardGLBAnimation: false, motionOwner: 'painted-preview-update', coordinates: '+Y up; projectile +Z; standalone hit normal +Y; attack hit normal opposes shot', attackVisualShotOffsets: [0, .13, .26] };
  const muzzleGroup = new THREE.Group(), projectileGroup = new THREE.Group(), hitGroup = new THREE.Group();
  muzzleGroup.name = 'painted_muzzle'; projectileGroup.name = 'painted_projectile'; hitGroup.name = 'painted_hit';
  root.add(muzzleGroup, projectileGroup, hitGroup);
  const materials = [], geometries = new Set(), ownTextures = new Set();
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = x => { const v = clamp(x); return v * v * (3 - 2 * v); };
  const pulse = (x, peak = .15, hold = .3, end = 1) => x < 0 || x >= end ? 0 : x < peak ? smooth(x / peak) : x <= hold ? 1 : 1 - smooth((x - hold) / (end - hold));
  const easeOut = x => 1 - (1 - clamp(x)) ** 2;
  const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const mu = new THREE.Vector3(), target = new THREE.Vector3(), direction = new THREE.Vector3(), normal = new THREE.Vector3();
  const cameraRight = new THREE.Vector3(1, 0, 0), cameraUp = new THREE.Vector3(0, 1, 0), cameraQ = new THREE.Quaternion();
  const localUp = new THREE.Vector3(), inverseImpactQ = new THREE.Quaternion(), temp = new THREE.Vector3(), worldA = new THREE.Vector3(), worldB = new THREE.Vector3();
  let disposed = false;

  function tile(base, column, row) {
    const map = base.clone(), gutter = .004;
    map.offset.set(column * .5 + gutter, (1 - row) * .5 + gutter);
    map.repeat.set(.5 - gutter * 2, .5 - gutter * 2);
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    map.generateMipmaps = false; map.minFilter = map.magFilter = THREE.LinearFilter;
    map.needsUpdate = true; ownTextures.add(map); return map;
  }
  const maps = { muzzle: tile(atlas, 0, 0), impact: tile(atlas, 1, 0), smoke: tile(atlas, 0, 1), trail: tile(atlas, 1, 1) };
  const materialMaps = metalTexture ? { brass: tile(metalTexture, 0, 0), wood: tile(metalTexture, 0, 1), steel: tile(metalTexture, 1, 1) } : {};
  function rememberMaterial(material) {
    material.toneMapped = false;
    material.userData = { ...material.userData, paintedPresentation: true, outlineParameters: { visible: false, keepAlive: true } };
    materials.push(material); return material;
  }
  function sprite(map, parent, name, { color = 0xffffff, additive = false, order = 12, center = [.5, .5] } = {}) {
    const material = rememberMaterial(new THREE.SpriteMaterial({ map, color, transparent: true, opacity: 0, depthWrite: false, depthTest: true, alphaTest: .045, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    const node = new THREE.Sprite(material); node.name = name; node.center.set(...center); node.renderOrder = order;
    node.userData.outlineParameters = { visible: false }; parent.add(node); return node;
  }
  function spritePose(node, position, width, height, opacity, rotation = 0) {
    node.visible = opacity > .001 && width > 0 && height > 0;
    node.position.copy(position);
    if(node.isSprite){node.scale.set(Math.max(width, .00001), Math.max(height, .00001), 1);node.material.rotation=rotation;}
    else{node.scale.set(Math.max(width,.00001),1,Math.max(height,.00001));node.rotation.y=-rotation;}
    node.material.opacity = clamp(opacity);
  }
  function geometry(value) { geometries.add(value); return value; }
  function surface(map,parent,name,{color=0xffffff,additive=false,order=18}={}){
    const material=rememberMaterial(new THREE.MeshBasicMaterial({map,color,transparent:true,opacity:0,depthWrite:false,depthTest:true,alphaTest:.045,side:THREE.DoubleSide,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending}));
    const mesh=new THREE.Mesh(geometry(new THREE.PlaneGeometry(1,1).rotateX(Math.PI/2)),material);mesh.name=name;mesh.renderOrder=order;parent.add(mesh);return mesh;
  }
  function matte(map, color, transparent = false) {
    return rememberMaterial(new THREE.MeshBasicMaterial({ map: map || null, color, vertexColors: false, transparent, opacity: 1, depthWrite: !transparent, depthTest: true, side: transparent ? THREE.DoubleSide : THREE.FrontSide }));
  }
  function readVector(value, fallback, out) {
    if (value?.isVector3) out.copy(value);
    else if (Array.isArray(value) && value.length >= 3) out.set(...value.slice(0, 3));
    else if (value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)) out.set(value.x, value.y, value.z);
    else out.set(...fallback);
    if (![out.x, out.y, out.z].every(Number.isFinite)) throw new TypeError('Painted MG endpoints must be finite.');
  }
  function screenAngle(localDirection) {
    worldB.copy(localDirection).transformDirection(root.matrixWorld);
    const x = worldB.dot(cameraRight), y = worldB.dot(cameraUp);
    return Math.abs(x) + Math.abs(y) > 1e-8 ? Math.atan2(y, x) : 0;
  }

  // Smooth pointed .11-diameter / .42-length projectile, longitudinal axis +Z.
  const bulletShape = [new THREE.Vector2(0, -.21), new THREE.Vector2(.039, -.21), new THREE.Vector2(.051, -.19), new THREE.Vector2(.055, -.145), new THREE.Vector2(.055, .045), new THREE.Vector2(.047, .11), new THREE.Vector2(0, .11)];
  const bulletGeometry = geometry(new THREE.LatheGeometry(bulletShape, 28).rotateX(Math.PI / 2));
  bulletGeometry.computeVertexNormals();
  const tipGeometry = geometry(new THREE.LatheGeometry([new THREE.Vector2(0, .11), new THREE.Vector2(.047, .11), new THREE.Vector2(.025, .18), new THREE.Vector2(0, .21)], 28).rotateX(Math.PI / 2));
  tipGeometry.computeVertexNormals();
  const bandGeometry = geometry(new THREE.CylinderGeometry(.056, .056, .022, 28, 1, false).rotateX(Math.PI / 2));
  const bodyMaterial = matte(materialMaps.brass, metalTexture ? 0xffedcf : 0xc6a05d);
  const tipMaterial = matte(materialMaps.steel, metalTexture ? 0xe1e6da : 0x9ca99d);
  const bandMaterial = matte(materialMaps.brass, metalTexture ? 0xffedbf : 0xe4bc64);
  // Tiny shallow bevels and curved outline; this is a splinter, not a box.
  const splinterShape = new THREE.Shape();
  splinterShape.moveTo(0, -.13); splinterShape.bezierCurveTo(-.026, -.08, -.028, .08, -.003, .17);
  splinterShape.bezierCurveTo(.019, .10, .031, -.085, 0, -.13);
  const splinterGeometry = geometry(new THREE.ExtrudeGeometry(splinterShape, { depth: .007, bevelEnabled: true, bevelThickness: .0025, bevelSize: .002, bevelSegments: 2, steps: 1, curveSegments: 9 }));
  splinterGeometry.translate(0, 0, -.0035); splinterGeometry.computeBoundingBox();
  const pos = splinterGeometry.getAttribute('position'), uv = splinterGeometry.getAttribute('uv'), box = splinterGeometry.boundingBox;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - box.min.x) / (box.max.x - box.min.x), (pos.getY(i) - box.min.y) / (box.max.y - box.min.y));
  uv.needsUpdate = true;

  const shots = [];
  for (let shot = 0; shot < 3; shot++) {
    const m = new THREE.Group(), p = new THREE.Group(), h = new THREE.Group();
    m.name = 'painted_muzzle_shot_' + shot; p.name = 'painted_flight_shot_' + shot; h.name = 'painted_impact_shot_' + shot;
    muzzleGroup.add(m); projectileGroup.add(p); hitGroup.add(h);
    const flash = sprite(maps.muzzle, m, 'painted_flash', { center: [.18, .5], order: 16 });
    const flashAccent = sprite(maps.muzzle, m, 'restrained_flash_light', { additive: true, center: [.18, .5], order: 17 });
    const muzzleSmoke = [0, 1].map(i => sprite(maps.smoke, m, 'muzzle_smoke_' + i, { color: i ? 0xf5efda : 0xffffff, order: 7 }));
    const body = new THREE.Group(); body.name = 'pointed_brass_bullet';
    body.add(new THREE.Mesh(bulletGeometry, bodyMaterial));
    body.add(new THREE.Mesh(tipGeometry, tipMaterial));
    for (const z of [-.155, -.055]) { const band = new THREE.Mesh(bandGeometry, bandMaterial); band.position.z = z; body.add(band); }
    p.add(body);
    const trail = sprite(maps.trail, p, 'painted_velocity_streak', { center: [.95, .5], order: 8 });
    const core = surface(maps.impact, h, 'painted_impact_core', { order: 18 });
    const sideCore = surface(maps.impact, h, 'painted_contact_brush', { color: 0xfff2da, order: 15 });
    const coreAccent = surface(maps.impact, h, 'restrained_impact_light', { additive: true, order: 19 });
    const sparks = Array.from({ length: 14 }, (_, i) => {
      const angle = i * 2.399963229728653 + shot * .17;
      const axis = new THREE.Vector3(Math.cos(angle) * (.65 + (i % 3) * .09), .18 + (i % 4) * .08, Math.sin(angle) * (.65 + (i % 3) * .09)).normalize();
      return { node: surface(maps.trail, h, 'fine_gold_flick_' + i, { color: i % 3 === 0 ? 0xffe5b0 : 0xffffff, order: 14 }), axis, start: .012 + (i % 4) * .012, life: .38 + (i % 5) * .035, speed: .65 + (i % 5) * .13, turn: angle };
    });
    const smoke = Array.from({ length: 5 }, (_, i) => {
      const angle = i * 2.399963229728653 + .4;
      return { node: sprite(maps.smoke, h, 'scalloped_cream_sage_' + i, { color: i % 2 ? 0xf2f0df : 0xffffff, order: 5 + i / 10 }), axis: new THREE.Vector3(Math.cos(angle), .24, Math.sin(angle)), start: .035 + i * .035, life: .72 - i * .035, spin: angle * .13 };
    });
    const splinters = Array.from({ length: 5 }, (_, i) => {
      const material = matte(materialMaps.wood, metalTexture ? 0xffead0 : (i % 2 ? 0xc49b66 : 0xedd0a0), true);
      const node = new THREE.Mesh(splinterGeometry, material); node.name = 'textured_tapered_splinter_' + i; node.renderOrder = 10; h.add(node);
      const a = i * 2.399963229728653 + .6;
      return { node, axis: new THREE.Vector3(Math.cos(a) * .7, .25 + i * .045, Math.sin(a) * .7), start: .025 + i * .012, life: .65 + i * .025, turn: a };
    });
    shots.push({ m, p, h, flash, flashAccent, muzzleSmoke, body, trail, core, sideCore, coreAccent, sparks, smoke, splinters });
  }
  const stats = { ready: true, disposed: false, mode: null, time: 0, duration: 0, visibleShots: 0, visibleSprites: 0, visibleMeshObjects: 0, activeLayers: [], presentationOnly: true, logicalEventsEmitted: 0, atlasTiles: 4, materialAtlasUsed: Boolean(metalTexture), attackVisualCopies: 3, triangleCount: 0 };
  root.traverse(node => { if (node.isMesh) stats.triangleCount += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3; });
  function hide() {
    for (const s of shots) { s.m.visible = s.p.visible = s.h.visible = false; }
    stats.visibleShots = stats.visibleSprites = stats.visibleMeshObjects = 0; stats.activeLayers = [];
  }
  function muzzlePose(s, t, span, a, angle, variation) {
    const f = t / span; s.m.visible = f >= 0 && f < 1; if (!s.m.visible) return;
    s.m.position.copy(mu);
    const bright = pulse(f, .07, .18, .58), long = .64 * a * (.88 + variation * .05);
    spritePose(s.flash, temp.copy(direction).multiplyScalar(.035), long * (.9 + .16 * bright), .28 * a * (.86 + .15 * bright), bright * .98, angle);
    spritePose(s.flashAccent, temp.copy(direction).multiplyScalar(.075), long * .55, .15 * a, bright * .16, angle);
    s.muzzleSmoke.forEach((node, i) => {
      const u = (f - .10 - i * .12) / (.90 - i * .12), envelope = pulse(u, .16, .26, 1), growth = easeOut(u);
      temp.copy(direction).multiplyScalar((.085 + i * .055 + growth * .09) * a).addScaledVector(Y, (.04 + growth * (.11 + i * .035)) * a);
      spritePose(node, temp, (.18 + growth * .15) * a, (.14 + growth * .16) * a, envelope * (i ? .24 : .34), -.16 + i * .42 + growth * .17);
    });
  }
  function projectilePose(s, t, span, a, angle) {
    const f = t / span; s.p.visible = f >= 0 && f < 1; if (!s.p.visible) return;
    s.p.position.copy(mu).lerp(target, f);
    s.body.quaternion.setFromUnitVectors(Z, direction); s.body.scale.setScalar(a);
    const envelope = pulse(f, .035, .90, 1); s.body.visible = envelope > .001;
    spritePose(s.trail, temp.copy(direction).multiplyScalar(-.19 * a), (.56 + .12 * Math.sin(f * Math.PI)) * a, .062 * a, envelope * .70, angle);
  }
  function impactPose(s, t, span, a, variation) {
    const f = t / span; s.h.visible = f >= 0 && f < 1; if (!s.h.visible) return;
    s.h.position.copy(target); s.h.quaternion.setFromUnitVectors(Y, normal);
    inverseImpactQ.copy(s.h.quaternion).invert(); localUp.copy(Y).applyQuaternion(inverseImpactQ);
    const brightness = pulse(f, .045, .12, .58), size = (.58 + .48 * easeOut(f * 2.1)) * a;
    spritePose(s.core, temp.set(0, .018, 0), size, size * .86, brightness * .98, -.12 + variation * .09);
    spritePose(s.sideCore, temp.set(.035 * a, .032 * a, -.027 * a), size * .63, size * .49, pulse(f - .025, .06, .13, .62) * .48, .35 + variation * .07);
    spritePose(s.coreAccent, temp.set(0, .027, 0), size * .44, size * .40, brightness * .17, -.1);
    for (const particle of s.sparks) {
      const u = (f - particle.start) / particle.life, alpha = pulse(u, .08, .30, 1), travel = easeOut(u);
      temp.copy(particle.axis).multiplyScalar((.035 + travel * particle.speed) * a).addScaledVector(localUp, (.025 + .13 * travel - .09 * clamp(u) ** 2) * a);
      worldA.copy(particle.axis).applyQuaternion(s.h.quaternion);
      spritePose(particle.node, temp, (.11 + .09 * (1 - clamp(u))) * a, (.011 + (particle.speed - .65) * .004) * a, alpha * .91, Math.atan2(particle.axis.z,particle.axis.x));
    }
    for (const particle of s.smoke) {
      const u = (f - particle.start) / particle.life, growth = easeOut(u), alpha = pulse(u, .17, .25, 1);
      temp.copy(particle.axis).multiplyScalar((.065 + .22 * growth) * a).addScaledVector(localUp, (.08 + .31 * growth) * a);
      spritePose(particle.node, temp, (.19 + .24 * growth) * a, (.17 + .23 * growth) * a, alpha * .40, particle.spin + growth * .23);
    }
    for (const particle of s.splinters) {
      const u = (f - particle.start) / particle.life, alpha = pulse(u, .04, .35, 1), travel = clamp(u);
      particle.node.visible = alpha > .001;
      particle.node.position.copy(particle.axis).multiplyScalar((.025 + .60 * travel) * a).addScaledVector(localUp, (.03 + .28 * travel - .37 * travel ** 2) * a);
      particle.node.rotation.set(.3 + travel * 3.2 + particle.turn, particle.turn + travel * 2.1, particle.turn * .45 - travel * 2.6);
      const shapeScale = (.49 + (particle.turn % 1) * .16) * a;
      particle.node.scale.set(shapeScale * .72, shapeScale, shapeScale * .8); particle.node.material.opacity = alpha * .94;
    }
  }
  function update({ time = 0, mode = 'attack', camera = null, muzzle = null, hit = null, impactNormal = null, amount = 1 } = {}) {
    if (disposed) return stats;
    if (!Object.hasOwn(DURATIONS, mode)) throw new RangeError('Unknown painted MG mode: ' + mode);
    const t = Number(time), a = clamp(Number(amount) || 1, .25, 3);
    if (!Number.isFinite(t)) throw new TypeError('Painted MG time must be finite.');
    hide(); root.visible = t >= 0 && t < DURATIONS[mode];
    for (const material of materials) if (material.userData.outlineParameters?.visible !== false) material.userData.outlineParameters = { visible: false, keepAlive: true };
    Object.assign(stats, { mode, time: t, duration: DURATIONS[mode] });
    if (!root.visible) return stats;
    readVector(muzzle, mode === 'attack' ? [.0007595372312182436, .6299396781481901, -.008382503840366984] : [0, 0, 0], mu);
    readVector(hit, mode === 'attack' ? [.0007595372312182436, .6299396781481901, 3.991617496159633] : mode === 'projectile' ? [mu.x, mu.y, mu.z + 4] : [0, 0, 0], target);
    direction.copy(target).sub(mu); if (direction.lengthSq() < 1e-10) direction.copy(Z); else direction.normalize();
    if(impactNormal){readVector(impactNormal,[0,1,0],normal);if(normal.lengthSq()<1e-10)throw new TypeError('Impact normal must be nonzero');normal.normalize();}
    else{normal.copy(mode === 'attack' ? direction : Y);if(mode === 'attack')normal.negate();}
    root.updateWorldMatrix(true, false);
    if (camera) { camera.updateWorldMatrix(true, false); camera.getWorldQuaternion(cameraQ); cameraRight.set(1, 0, 0).applyQuaternion(cameraQ); cameraUp.set(0, 1, 0).applyQuaternion(cameraQ); }
    else { cameraRight.set(1, 0, 0); cameraUp.set(0, 1, 0); }
    const angle = screenAngle(direction), count = mode === 'attack' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const s = shots[i], offset = mode === 'attack' ? i * .13 : 0, local = t - offset;
      if (mode === 'attack') { muzzlePose(s, local, .20, a, angle, i); projectilePose(s, local - .12, .73, a, angle); impactPose(s, local - .84, .96, a, i); }
      else if (mode === 'muzzle') muzzlePose(s, local, DURATIONS.muzzle, a, angle, i);
      else if (mode === 'projectile') projectilePose(s, local, DURATIONS.projectile, a, angle);
      else impactPose(s, local, DURATIONS.hit, a, i);
      if (s.m.visible || s.p.visible || s.h.visible) stats.visibleShots++;
      if (s.m.visible) stats.activeLayers.push('muzzle:' + i);
      if (s.p.visible) stats.activeLayers.push('projectile:' + i);
      if (s.h.visible) stats.activeLayers.push('hit:' + i);
    }
    // The final visual copy is cut at the original 2s sequence boundary. Ease
    // its remaining smoke away before that boundary instead of popping it off.
    if (mode === 'attack' && t > 1.88) {
      const gain = smooth((2 - t) / .12), faded = new Set();
      root.traverseVisible(node => { if (!node.material || faded.has(node.material)) return; faded.add(node.material); if (node.material.transparent) node.material.opacity *= gain; });
    }
    root.updateMatrixWorld(true);
    root.traverseVisible(node => { if (node.isSprite && node.material.opacity > .001) stats.visibleSprites++; else if (node.isMesh) stats.visibleMeshObjects++; });
    return stats;
  }
  function dispose() {
    if (disposed) return;
    hide(); root.visible = false; root.removeFromParent();
    for (const material of materials) material.dispose();
    for (const value of geometries) value.dispose();
    // These are tile clones owned by this instance; caller-supplied atlases live on.
    for (const map of ownTextures) map.dispose();
    disposed = true; stats.disposed = true; stats.ready = false;
  }
  hide(); root.visible = false;
  return { root, update, dispose, muzzleGroup, projectileGroup, hitGroup, parts: { muzzleGroup, projectileGroup, hitGroup }, materials, textures: [...ownTextures], stats, durations: DURATIONS, attackTiming: { duration: 2, muzzle: [0, .2], projectile: [.12, .85], hit: [.84, 1.8], visualOffsets: [0, .13, .26], clipEndTruncatesCopies: true, logicalEventsEmitted: 0 } };
}
