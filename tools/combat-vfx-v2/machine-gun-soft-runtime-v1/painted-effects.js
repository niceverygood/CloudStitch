/* Cloudstitch single-shot soft watercolor runtime presentation. No gameplay events.
 * Atlas: TL muzzle, TR impact, BL cream/sage smoke, BR horizontal gold trail.
 * Optional material atlas: TL brass, TR teal, BL wood, BR steel.
 * All times are absolute seconds. update() is deterministic and scrub-safe.
 * Flight position and lifetime come exclusively from the caller's simulation.
 */
export function createPaintedMG(THREE, { atlas, metalTexture = null } = {}) {
  if (!THREE?.Group || !atlas?.isTexture) throw new TypeError('createPaintedMG requires THREE and the painted atlas Texture.');
  const DURATIONS = Object.freeze({ muzzle: .2, hit: .35 });
  const root = new THREE.Group(); root.name = 'machine_gun_soft_presentation';
  root.userData = { visualOnly: true, collisionAuthority: false, standardGLBAnimation: false, motionOwner: 'battlefield-projectile-state', coordinates: '+Y up; projectile +Z; impact normal +Y', artDirection: 'Soft ivory and pale apricot watercolor puffs; restrained cream-gold curls and airy sage smoke; matte light brass.' };
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
    // The soft image has generous empty padding. Crop only that transparent
    // gutter in UV space so gentler color does not also become a tiny dot.
    const map = base.clone(), gutter = base === atlas ? .07 : .004;
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
    const material = rememberMaterial(new THREE.SpriteMaterial({ map, color, transparent: true, opacity: 0, depthWrite: false, depthTest: true, alphaTest: .03, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
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
    const material=rememberMaterial(new THREE.MeshBasicMaterial({map,color,transparent:true,opacity:0,depthWrite:false,depthTest:true,alphaTest:.03,side:THREE.DoubleSide,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending}));
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
  const bodyMaterial = matte(materialMaps.brass, metalTexture ? 0xfff8e6 : 0xd7b677);
  const tipMaterial = matte(materialMaps.steel, metalTexture ? 0xdce9e1 : 0xaabdb4);
  const bandMaterial = matte(materialMaps.brass, metalTexture ? 0xfff2d5 : 0xe7c88f);
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
  for (let shot = 0; shot < 1; shot++) {
    const m = new THREE.Group(), p = new THREE.Group(), h = new THREE.Group();
    m.name = 'painted_muzzle_shot_' + shot; p.name = 'painted_flight_shot_' + shot; h.name = 'painted_impact_shot_' + shot;
    muzzleGroup.add(m); projectileGroup.add(p); hitGroup.add(h);
    const flash = sprite(maps.muzzle, m, 'painted_flash', { center: [.22, .5], color: 0xfffbef, order: 16 });
    const flashAccent = sprite(maps.muzzle, m, 'restrained_flash_light', { center: [.22, .5], color: 0xfffcf2, order: 17 });
    const muzzleSmoke = [0, 1].map(i => sprite(maps.smoke, m, 'muzzle_smoke_' + i, { color: i ? 0xf8f5e9 : 0xffffff, order: 7 }));
    const body = new THREE.Group(); body.name = 'pointed_brass_bullet';
    body.add(new THREE.Mesh(bulletGeometry, bodyMaterial));
    body.add(new THREE.Mesh(tipGeometry, tipMaterial));
    for (const z of [-.155, -.055]) { const band = new THREE.Mesh(bandGeometry, bandMaterial); band.position.z = z; body.add(band); }
    p.add(body);
    const trail = sprite(maps.trail, p, 'painted_velocity_streak', { center: [.95, .5], order: 8 });
    const core = surface(maps.impact, h, 'painted_impact_core', { order: 18 });
    const sideCore = surface(maps.impact, h, 'painted_contact_brush', { color: 0xfff8ec, order: 15 });
    const coreAccent = surface(maps.impact, h, 'restrained_impact_light', { color: 0xfffcf4, order: 19 });
    const sparks = Array.from({ length: 6 }, (_, i) => {
      const angle = i * 2.12 + shot * .11;
      const axis = new THREE.Vector3(Math.cos(angle) * (.60 + (i % 3) * .05), .12 + (i % 3) * .045, Math.sin(angle) * (.60 + (i % 3) * .05)).normalize();
      const curl = new THREE.Vector3(-axis.z, 0, axis.x);
      return { node: surface(maps.trail, h, 'fine_gold_flick_' + i, { color: i % 3 === 0 ? 0xfff6e2 : 0xffffff, order: 14 }), axis, curl, start: .025 + (i % 3) * .018, life: .42 + (i % 3) * .04, speed: .30 + (i % 4) * .05, turn: angle };
    });
    const smoke = Array.from({ length: 4 }, (_, i) => {
      const angle = i * 2.399963229728653 + .4;
      const axis = new THREE.Vector3(Math.cos(angle), .20, Math.sin(angle));
      return { node: sprite(maps.smoke, h, 'scalloped_cream_sage_' + i, { color: i % 2 ? 0xf9f7ec : 0xffffff, order: 5 + i / 10 }), axis, curl: new THREE.Vector3(-axis.z, 0, axis.x), start: .025 + i * .05, life: .79 - i * .045, spin: angle * .095 };
    });
    const splinters = Array.from({ length: 3 }, (_, i) => {
      const material = matte(materialMaps.wood, metalTexture ? 0xfff0db : (i % 2 ? 0xcdb18b : 0xefdab9), true);
      const node = new THREE.Mesh(splinterGeometry, material); node.name = 'textured_tapered_splinter_' + i; node.renderOrder = 10; h.add(node);
      const a = i * 2.399963229728653 + .6;
      return { node, axis: new THREE.Vector3(Math.cos(a) * .45, .20 + i * .04, Math.sin(a) * .45), start: .045 + i * .025, life: .61 + i * .035, turn: a };
    });
    shots.push({ m, p, h, flash, flashAccent, muzzleSmoke, body, trail, core, sideCore, coreAccent, sparks, smoke, splinters });
  }
  const stats = { ready: true, disposed: false, mode: null, time: 0, duration: 0, visibleShots: 0, visibleSprites: 0, visibleMeshObjects: 0, activeLayers: [], presentationOnly: true, logicalEventsEmitted: 0, atlasTiles: 4, materialAtlasUsed: Boolean(metalTexture), attackVisualCopies: 1, sparksPerHit: 6, smokePerHit: 4, splintersPerHit: 3, artDirection: 'soft-watercolor', triangleCount: 0 };
  root.traverse(node => { if (node.isMesh) stats.triangleCount += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3; });
  function hide() {
    for (const s of shots) { s.m.visible = s.p.visible = s.h.visible = false; }
    stats.visibleShots = stats.visibleSprites = stats.visibleMeshObjects = 0; stats.activeLayers = [];
  }
  function muzzlePose(s, t, span, a, angle, variation) {
    const f = t / span; s.m.visible = f >= 0 && f < 1; if (!s.m.visible) return;
    s.m.position.copy(mu);
    const bright = pulse(f, .11, .22, .72), long = .42 * a * (.94 + variation * .025);
    spritePose(s.flash, temp.copy(direction).multiplyScalar(.028), long * (.94 + .12 * bright), .29 * a * (.94 + .12 * bright), bright * .83, angle);
    spritePose(s.flashAccent, temp.copy(direction).multiplyScalar(.048), long * .51, .16 * a, bright * .055, angle + .035);
    s.muzzleSmoke.forEach((node, i) => {
      const u = (f - .13 - i * .13) / (.87 - i * .13), envelope = pulse(u, .20, .30, 1), growth = easeOut(u);
      temp.copy(direction).multiplyScalar((.055 + i * .04 + growth * .065) * a).addScaledVector(Y, (.035 + growth * (.09 + i * .025)) * a);
      spritePose(node, temp, (.16 + growth * .13) * a, (.15 + growth * .13) * a, envelope * (i ? .25 : .33), -.13 + i * .32 + growth * .12);
    });
  }
  function impactPose(s, t, span, a, variation) {
    const f = t / span; s.h.visible = f >= 0 && f < 1; if (!s.h.visible) return;
    s.h.position.copy(target); s.h.quaternion.setFromUnitVectors(Y, normal);
    inverseImpactQ.copy(s.h.quaternion).invert(); localUp.copy(Y).applyQuaternion(inverseImpactQ);
    const brightness = pulse(f, .075, .20, .69), growth = easeOut(f * 1.9), size = (.34 + .42 * growth) * a;
    spritePose(s.core, temp.set(0, .018, 0), size, size * .91, brightness * .85, -.12 + variation * .065 + growth * .10);
    spritePose(s.sideCore, temp.set(.025 * a, .032 * a, -.020 * a), size * .57, size * .50, pulse(f - .04, .09, .20, .73) * .28, .27 + variation * .05 - growth * .08);
    spritePose(s.coreAccent, temp.set(0, .027, 0), size * .42, size * .40, brightness * .045, -.07);
    for (const particle of s.sparks) {
      const u = (f - particle.start) / particle.life, alpha = pulse(u, .08, .30, 1), travel = easeOut(u);
      temp.copy(particle.axis).multiplyScalar((.025 + travel * particle.speed) * a).addScaledVector(particle.curl, Math.sin(Math.PI * clamp(u)) * .06 * a).addScaledVector(localUp, (.025 + .06 * travel - .03 * clamp(u) ** 2) * a);
      worldA.copy(particle.axis).applyQuaternion(s.h.quaternion);
      spritePose(particle.node, temp, (.08 + .07 * (1 - clamp(u))) * a, (.010 + (particle.speed - .30) * .007) * a, alpha * .66, Math.atan2(particle.axis.z,particle.axis.x) + Math.sin(Math.PI * clamp(u)) * .18);
    }
    for (const particle of s.smoke) {
      const u = (f - particle.start) / particle.life, growth = easeOut(u), alpha = pulse(u, .17, .25, 1);
      temp.copy(particle.axis).multiplyScalar((.045 + .14 * growth) * a).addScaledVector(particle.curl, Math.sin(Math.PI * clamp(u)) * .045 * a).addScaledVector(localUp, (.055 + .26 * growth) * a);
      spritePose(particle.node, temp, (.17 + .20 * growth) * a, (.16 + .20 * growth) * a, alpha * (.31 + (particle.spin > .3 ? .03 : 0)), particle.spin + growth * .14);
    }
    for (const particle of s.splinters) {
      const u = (f - particle.start) / particle.life, alpha = pulse(u, .04, .35, 1), travel = clamp(u);
      particle.node.visible = alpha > .001;
      particle.node.position.copy(particle.axis).multiplyScalar((.020 + .38 * travel) * a).addScaledVector(localUp, (.03 + .22 * travel - .26 * travel ** 2) * a);
      particle.node.rotation.set(.3 + travel * 1.4 + particle.turn, particle.turn + travel * 1.0, particle.turn * .45 - travel * 1.2);
      const shapeScale = (.30 + (particle.turn % 1) * .09) * a;
      particle.node.scale.set(shapeScale * .68, shapeScale, shapeScale * .72); particle.node.material.opacity = alpha * .76;
    }
  }
  function updateCamera(camera) {
    root.updateWorldMatrix(true, false);
    if (camera) { camera.updateWorldMatrix(true, false); camera.getWorldQuaternion(cameraQ); cameraRight.set(1, 0, 0).applyQuaternion(cameraQ); cameraUp.set(0, 1, 0).applyQuaternion(cameraQ); }
    else { cameraRight.set(1, 0, 0); cameraUp.set(0, 1, 0); }
  }
  function finish() {
    root.updateMatrixWorld(true);
    root.traverseVisible(node => { if (node.isSprite && node.material.opacity > .001) stats.visibleSprites++; else if (node.isMesh) stats.visibleMeshObjects++; });
    return stats;
  }
  function updateProjectile({ position, direction: actualDirection, camera = null, amount = 1 } = {}) {
    if (disposed) return stats;
    readVector(position, [NaN, NaN, NaN], mu);
    readVector(actualDirection, [0, 0, 1], direction);
    if (direction.lengthSq() < 1e-10) direction.copy(Z); else direction.normalize();
    const a = clamp(Number(amount) || 1, .25, 3), s = shots[0];
    hide(); root.visible = s.p.visible = s.body.visible = true;
    updateCamera(camera);
    s.p.position.copy(mu); s.body.quaternion.setFromUnitVectors(Z, direction);
    s.body.scale.set(.80 * a, .80 * a, .76 * a);
    spritePose(s.trail, temp.copy(direction).multiplyScalar(-.145 * a), .42 * a, .043 * a, .45, screenAngle(direction));
    Object.assign(stats, { mode: 'projectile', time: 0, duration: null, visibleShots: 1, activeLayers: ['projectile:0'] });
    return finish();
  }
  function update({ time = 0, mode = 'muzzle', camera = null, muzzle = null, hit = null, flightDirection = null, impactNormal = null, amount = 1 } = {}) {
    if (disposed) return stats;
    if (!Object.hasOwn(DURATIONS, mode)) throw new RangeError('Unknown painted MG mode: ' + mode);
    const t = Number(time), a = clamp(Number(amount) || 1, .25, 3);
    if (!Number.isFinite(t)) throw new TypeError('Painted MG time must be finite.');
    hide(); root.visible = t >= 0 && t < DURATIONS[mode];
    for (const material of materials) if (material.userData.outlineParameters?.visible !== false) material.userData.outlineParameters = { visible: false, keepAlive: true };
    Object.assign(stats, { mode, time: t, duration: DURATIONS[mode] });
    if (!root.visible) return stats;
    readVector(muzzle, [0, 0, 0], mu);
    readVector(hit, [0, 0, 0], target);
    if (flightDirection) readVector(flightDirection, [0, 0, 1], direction); else direction.copy(target).sub(mu);
    if (direction.lengthSq() < 1e-10) direction.copy(Z); else direction.normalize();
    if(impactNormal){readVector(impactNormal,[0,1,0],normal);if(normal.lengthSq()<1e-10)throw new TypeError('Impact normal must be nonzero');normal.normalize();}
    else{normal.copy(Y);}
    updateCamera(camera);
    const angle = screenAngle(direction), count = 1;
    for (let i = 0; i < count; i++) {
      const s = shots[i], local = t;
      if (mode === 'muzzle') muzzlePose(s, local, DURATIONS.muzzle, a, angle, i);
      else impactPose(s, local, DURATIONS.hit, a, i);
      if (s.m.visible || s.p.visible || s.h.visible) stats.visibleShots++;
      if (s.m.visible) stats.activeLayers.push('muzzle:' + i);
      if (s.p.visible) stats.activeLayers.push('projectile:' + i);
      if (s.h.visible) stats.activeLayers.push('hit:' + i);
    }
    return finish();
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
  return { root, update, updateProjectile, dispose, muzzleGroup, projectileGroup, hitGroup, parts: { muzzleGroup, projectileGroup, hitGroup }, materials, textures: [...ownTextures], stats, durations: DURATIONS };
}
