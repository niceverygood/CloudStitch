/** Cloudstitch dramatic revision 2: filled, painted organic volumes.
 * The 10x brief is addressed by mass, silhouette, material contrast and rhythm;
 * atlas alpha is only a secondary wisp/ember, never the main body. Display only.
 */
export const CANNON_STAGE_DURATIONS = Object.freeze({ muzzle: .95, hit: 1.60 });
const clamp = n => Math.max(0, Math.min(1, n));
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const fade = (t, a, b) => 1 - ramp(t, a, b);
const C = { cream: 0xffeac0, center: 0xfff5d8, gold: 0xdb9b43, shadow: 0x727f72, ink: 0x655d49,
  sage: 0xa7b6a0, smokeShadow: 0x536c66, wood: 0xb8743d, woodLight: 0xe0aa64, coral: 0xd87654 };

export function createDramaticCannonStage(THREE, { atlas, camera = null, reducedMotion = false } = {}) {
  if (!atlas?.isTexture) throw new TypeError('Cannon stage requires a caller-owned atlas texture.');
  const root = new THREE.Group(); root.name = 'dramatic-filled-painted-cannon';
  const meshes = [], panels = [], resources = new Set(), cameraQ = new THREE.Quaternion(), localCameraQ = new THREE.Quaternion();
  const inverse = new THREE.Quaternion(), roll = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  const cameraRight = new THREE.Vector3(), cameraUp = new THREE.Vector3(), cameraNormal = new THREE.Vector3();
  const projected = new THREE.Vector3(), cross = new THREE.Vector3(), matrix = new THREE.Matrix4();
  let disposed = false, phase = 'idle', kindNow = null, seconds = -1;

  function material({ color = 0xffffff, map = null, vertexColors = false } = {}) {
    const value = new THREE.MeshBasicMaterial({ color, map, vertexColors, transparent: true, opacity: 0,
      depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    value.userData.outlineParameters = { visible: false, keepAlive: true }; resources.add(value); return value;
  }
  function geometry(positions, colors, indices, uvs = null) {
    const value = new THREE.BufferGeometry(); value.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (colors) value.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    if (uvs) value.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    value.setIndex(indices); value.computeVertexNormals(); resources.add(value); return value;
  }
  function inkEdge(points) {
    const p = [], colors = [], indices = [], color = new THREE.Color(C.ink);
    points.forEach(([x, y], i) => {
      // A narrow, imperfect painted edge, never a rectangular plane outline.
      const radius = Math.max(.05, Math.hypot(x, y)), width = .012 + .004 * Math.sin(i * 1.73);
      for (const f of [1 - width / radius, 1 + width / radius]) { p.push(x * f, y * f, -.025); colors.push(color.r, color.g, color.b); }
      const j = (i + 1) % points.length, a = i * 2, b = j * 2; indices.push(a, a + 1, b, a + 1, b + 1, b);
    }); return geometry(p, colors, indices);
  }
  function billow(seed, smoke = false) {
    const segments = 48, rings = 4, p = [], colors = [], indices = [], rim = [], center = new THREE.Color(smoke ? C.cream : C.center);
    const edge = new THREE.Color(smoke ? C.sage : C.gold), under = new THREE.Color(smoke ? C.smokeShadow : C.shadow), color = new THREE.Color();
    for (let ring = 0; ring <= rings; ring++) for (let i = 0; i < segments; i++) {
      const theta = i / segments * Math.PI * 2, r = ring / rings;
      const organic = 1 + .085 * Math.sin(theta * 3 + seed) + .037 * Math.sin(theta * 7 - seed * .6);
      const x = Math.cos(theta) * r * organic * .5, y = Math.sin(theta) * r * organic * .5;
      p.push(x + Math.sin(theta * 2 + seed) * r * r * .015, y, (1 - r * r) * .13);
      const lower = clamp(-Math.sin(theta) * .83 + .10) * Math.pow(r, .8);
      color.copy(center).lerp(edge, Math.pow(r, 2.8) * .72).lerp(under, lower * (smoke ? .82 : .60));
      // Broad hand-painted patches, not faceted PBR highlights.
      color.multiplyScalar(1 - .035 * Math.sin(theta * 5 + seed) * r); colors.push(color.r, color.g, color.b);
      if (ring === rings) rim.push([p[p.length - 3], y]);
      if (ring < rings) { const a = ring * segments + i, b = ring * segments + (i + 1) % segments, c = a + segments, d = b + segments; indices.push(a, b, c, b, d, c); }
    }
    return { fill: geometry(p, colors, indices), edge: inkEdge(rim) };
  }
  function comma(seed) {
    const p = [], colors = [], indices = [], left = [], right = [], segments = 28;
    const cream = new THREE.Color(C.center), gold = new THREE.Color(C.gold), shade = new THREE.Color(C.shadow), color = new THREE.Color();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, bend = Math.sin(t * Math.PI * .88) * (.26 + seed * .025), width = Math.pow(Math.sin(t * Math.PI), .64) * .28 + .008;
      for (let col = 0; col < 3; col++) {
        const side = col - 1, x = bend + side * width * (1 + .08 * Math.sin(i * .8 + seed));
        p.push(x, t, col === 1 ? .11 * Math.sin(Math.PI * t) : 0);
        color.copy(cream).lerp(col === 0 ? shade : gold, col === 1 ? .08 : .65); colors.push(color.r, color.g, color.b);
        if (col === 0) left.push([x, t]); if (col === 2) right.push([x, t]);
      }
      if (i < segments) for (let col = 0; col < 2; col++) { const a = i * 3 + col; indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3); }
    }
    return { fill: geometry(p, colors, indices), edge: inkEdge([...left, ...right.reverse()]) };
  }
  function timber(seed) {
    const points = [[-.45, -.45], [.15, -.53], [.43, -.12], [.27, .49], [-.04, .37], [-.36, .53]], p = [0, 0, .10], colors = [], indices = [];
    const center = new THREE.Color(seed % 3 ? C.woodLight : C.coral), dark = new THREE.Color(C.wood);
    colors.push(center.r, center.g, center.b);
    points.forEach(([x, y], i) => { p.push(x, y, 0); const c = center.clone().lerp(dark, i % 2 ? .66 : .25); colors.push(c.r, c.g, c.b); indices.push(0, i + 1, (i + 1) % points.length + 1); });
    return { fill: geometry(p, colors, indices), edge: inkEdge(points) };
  }
  function panel(name, shape, role) {
    const group = new THREE.Group(); group.name = name; group.visible = false; group.userData.role = role; root.add(group);
    for (const [key, geo] of Object.entries(shape)) {
      const mesh = new THREE.Mesh(geo, material({ vertexColors: true })); mesh.name = name + '-' + key;
      mesh.userData = { filledPaint: key === 'fill', role, massClass: name.startsWith('filled-main') ? 'primary' : name.startsWith('swept-pressure') ? 'wing' : null }; mesh.renderOrder = role === 'smoke' ? 5 : role === 'splinter' ? 6 : 3;
      group.add(mesh); meshes.push(mesh);
    }
    panels.push(group); return group;
  }
  function sprite(name, tile, color) {
    const geo = new THREE.PlaneGeometry(1, 1), uv = geo.getAttribute('uv'), x = tile % 2 * .5, y = tile < 2 ? .5 : 0;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, x + .012 + uv.getX(i) * .476, y + .012 + uv.getY(i) * .476);
    resources.add(geo); const mesh = new THREE.Mesh(geo, material({ map: atlas, color })); mesh.name = name; mesh.visible = false;
    mesh.userData.role = 'accent'; mesh.renderOrder = 7; root.add(mesh); meshes.push(mesh); panels.push(mesh); return mesh;
  }
  const core = Array.from({ length: 5 }, (_, i) => panel('filled-main-billow-' + i, billow(.8 + i * 1.7), 'main'));
  const wings = Array.from({ length: 2 }, (_, i) => panel('swept-pressure-wing-' + i, comma(i), 'main'));
  const smoke = Array.from({ length: 5 }, (_, i) => panel('dense-rolling-smoke-' + i, billow(2.5 + i * 1.9, true), 'smoke'));
  const chips = Array.from({ length: 10 }, (_, i) => panel('wood-coral-splinter-' + i, timber(i), 'splinter'));
  const contact = panel('compressed-cream-contact', billow(5.2), 'contact');
  const wisps = Array.from({ length: 3 }, (_, i) => sprite('secondary-painted-wisp-' + i, 2, C.cream));
  const embers = Array.from({ length: 8 }, (_, i) => sprite('tiny-gold-ember-' + i, 3, i % 2 ? C.gold : C.cream));
  function orient(node, rotation = 0) { node.quaternion.copy(localCameraQ).multiply(roll.setFromAxisAngle(Z, rotation)); }
  function pose(node, opacity, width, height, rotation = 0) {
    node.visible = opacity > .001; node.scale.set(width, height, 1); orient(node, rotation);
    if (node.isMesh) node.material.opacity = clamp(opacity);
    else for (const mesh of node.children) mesh.material.opacity = clamp(opacity * (mesh.userData.filledPaint ? 1 : .82));
  }
  function screen(node, x, y, depth = 0) { node.position.copy(cameraRight).multiplyScalar(x).addScaledVector(cameraUp, y).addScaledVector(cameraNormal, depth); }
  function along(node, vector, distance, side = 0, lift = 0) {
    node.position.copy(vector).multiplyScalar(distance).addScaledVector(cameraRight, side).addScaledVector(cameraUp, lift);
  }
  function directionAngle(vector) {
    projected.copy(vector).addScaledVector(cameraNormal, -vector.dot(cameraNormal));
    if (projected.lengthSq() < 1e-8) projected.copy(cameraUp);
    projected.normalize(); cross.crossVectors(projected, cameraNormal).normalize();
    matrix.makeBasis(cross, projected, cameraNormal); return Math.atan2(-projected.dot(cameraRight), projected.dot(cameraUp));
  }
  function reset() {
    for (const node of panels) { node.visible = false; node.position.set(0, 0, 0); node.quaternion.identity(); node.scale.set(1, 1, 1); }
    for (const mesh of meshes) mesh.material.opacity = 0;
    root.visible = false; root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.set(1, 1, 1);
    phase = 'idle'; kindNow = null; seconds = -1;
  }
  function evaluate(kind, time, frame = {}) {
    if (disposed) throw new Error('Disposed cannon stage.');
    if (!Object.hasOwn(CANNON_STAGE_DURATIONS, kind) || !Number.isFinite(time)) throw new TypeError('Invalid cannon stage/time.');
    reset(); kindNow = kind; seconds = time;
    if (time < 0 || time >= CANNON_STAGE_DURATIONS[kind]) { phase = 'ended'; return api; }
    if (![frame.x, frame.y, frame.z].every(Number.isFinite)) throw new TypeError('Cannon requires finite world XYZ.');
    const basis = kind === 'hit' ? frame.normal : frame.direction;
    if (!basis || ![basis.x, basis.y, basis.z].every(Number.isFinite) || Math.hypot(basis.x, basis.y, basis.z) < 1e-8) throw new TypeError('Cannon requires actual nonzero direction/normal.');
    root.position.set(frame.x, frame.y, frame.z); root.quaternion.setFromUnitVectors(new THREE.Vector3(0, kind === 'hit' ? 1 : 0, kind === 'muzzle' ? 1 : 0), new THREE.Vector3(basis.x, basis.y, basis.z).normalize()); root.visible = true;
    const view = frame.camera || camera; if (view?.getWorldQuaternion) view.getWorldQuaternion(cameraQ); else cameraQ.identity();
    localCameraQ.copy(inverse.copy(root.quaternion).invert()).multiply(cameraQ);
    cameraRight.set(1, 0, 0).applyQuaternion(localCameraQ); cameraUp.set(0, 1, 0).applyQuaternion(localCameraQ); cameraNormal.set(0, 0, 1).applyQuaternion(localCameraQ);
    const t = time, motion = reducedMotion ? .62 : 1;
    if (kind === 'hit') {
      phase = t < .035 ? 'compressed-contact' : t < .16 ? 'mass-eruption' : t < .35 ? 'filled-pressure-hold' : t < 1.40 ? 'dense-rolling-smoke' : 'embers';
      const grow = 1 - (1 - ramp(t, .035, .16)) ** 2, hold = fade(t, .35, .57);
      pose(contact, fade(t, .035, .10), .50 + ramp(t, 0, .045) * 2.8, .5 + ramp(t, 0, .045) * 2.2, .18); screen(contact, 0, 0, .24);
      const layout = [[-3.35, -.35, 5.55, 5.2], [-.35, 1.35, 6.2, 6.2], [3.10, -.10, 5.8, 5.4], [-1.70, -1.50, 4.9, 4.4], [1.85, -1.30, 4.8, 4.5]];
      core.forEach((node, i) => {
        const [x, y, w, h] = layout[i], pulse = 1 + Math.sin(t * 13 + i * .8) * .018 * motion;
        pose(node, grow * hold * .98, w * .57 * grow * pulse, h * .65 * grow * pulse, (i - 2) * .09);
        screen(node, x * .57 * grow, y * .65 * grow, .03 + i * .022); node.position.y += ramp(t, .16, .50) * .22;
      });
      wings.forEach((node, i) => { pose(node, grow * fade(t, .28, .53) * .96, i ? 2.75 : 3.1, grow * (i ? 6.8 : 7.4), i ? 1.06 : -1.08); screen(node, i ? -.15 : .25, i ? -.40 : -.20, -.09); });
      smoke.forEach((node, i) => {
        const delay = .16 + i * .025, q = ramp(t, delay, 1.36), a = i * 2.399 + q * .65 * motion;
        const opacity = ramp(t, delay, delay + .14) * fade(t, 1.04 + i * .025, 1.48 + i * .022) * .91;
        const w = 3.6 + q * (2.0 + i % 2 * .40), h = 3.3 + q * (2.25 + i % 3 * .25);
        pose(node, opacity, w, h, Math.sin(i + q) * .13); screen(node, Math.cos(a) * (1.25 + q * 2.4 * motion), .30 + Math.sin(a) * (1.0 + q * 1.25) + q * 3.5, .30 + i * .035);
      });
      chips.forEach((node, i) => {
        const q = ramp(t, .055 + i % 3 * .014, .95), a = i * 2.399 + .22, radius = (1 + q * (3.2 + i % 3 * .65)) * motion;
        pose(node, ramp(t, .055, .13) * fade(t, .67, 1.18), .21 + i % 3 * .075, .82 + i % 2 * .44, a + q * 3.1 * motion);
        screen(node, Math.cos(a) * radius, Math.sin(a) * radius * .8 + q * 1.7 - q * q * 2.5, .55 + i * .012);
      });
    } else {
      phase = t < .035 ? 'compressed-contact' : t < .18 ? 'heavy-brush-release' : 'dense-muzzle-smoke';
      const grow = 1 - (1 - ramp(t, .018, .095)) ** 2, alpha = fade(t, .15, .30), angle = directionAngle(Z);
      pose(contact, fade(t, .035, .10), .70 + grow * 2.0, .8 + grow * 2.3, angle); along(contact, Z, .10);
      wings.forEach((node, i) => { pose(node, grow * alpha, i ? 2.0 : 2.8, grow * (i ? 5.8 : 7.6), angle + (i ? -.34 : .13)); along(node, Z, .1 + i * .2, (i ? -.2 : .1)); });
      core.slice(0, 3).forEach((node, i) => { pose(node, grow * fade(t, .13, .34) * .96, (2.9 - i * .3) * grow, (3.8 + i * .4) * grow, angle + (i - 1) * .15); along(node, Z, .6 + i * 1.05, (i - 1) * .47); });
      smoke.forEach((node, i) => { const delay = .10 + i * .027, q = ramp(t, delay, .88); pose(node, ramp(t, delay, delay + .12) * fade(t, .58 + i * .02, .95) * .85, 2.1 + q * 2.2, 2.0 + q * 2.2, i * .18); along(node, Z, .6 + q * (2.3 + i * .3), Math.sin(i * 2.39 + q) * q * 1.3 * motion, q * 1.6); });
    }
    wisps.forEach((node, i) => { const q = ramp(t, .15 + i * .04, kind === 'hit' ? 1.3 : .8); pose(node, ramp(t, .15, .32) * fade(t, kind === 'hit' ? 1.0 : .55, CANNON_STAGE_DURATIONS[kind]) * .24, 2 + q * 3, 1.7 + q * 2, i * 1.3 + q * .4); screen(node, Math.sin(i * 2.39) * q * 2, .7 + q * 4.3, .60 + i * .03); });
    embers.forEach((node, i) => { const q = ramp(t, .10, CANNON_STAGE_DURATIONS[kind]), a = i * 2.399, radius = q * (3.2 + i % 3 * .4) * motion; pose(node, ramp(t, .10, .23) * fade(t, kind === 'hit' ? 1.17 : .55, CANNON_STAGE_DURATIONS[kind]) * .8, .08 + i % 2 * .05, .23 + i % 3 * .08, a + q); screen(node, Math.cos(a) * radius, Math.sin(a) * radius * .8 + q - q * q * 1.3, .8); });
    Object.assign(root.userData, { phase, kind, elapsed: t }); return api;
  }
  function dispose() { if (disposed) return; reset(); root.removeFromParent(); for (const value of resources) value.dispose(); resources.clear(); disposed = true; }
  const api = { root, evaluate, reset, dispose, durations: CANNON_STAGE_DURATIONS, debug: () => {
    let visibleMeshes = 0, highDensityMainMeshes = 0, filledMeshes = 0; root.traverseVisible(node => { if (!node.isMesh || node.material.opacity <= .001) return; visibleMeshes++; if (node.userData.filledPaint) { filledMeshes++; if (node.userData.role === 'main' && node.material.opacity >= .9) highDensityMainMeshes++; } });
    return { phase, kind: kindNow, seconds, reducedMotion, disposed, meshCount: meshes.length, visibleMeshes, filledMeshes, highDensityMainMeshes, ownedResources: resources.size, callerAtlasOwned: false, design: 'filled-organic-painted-mass-v2' };
  } }; reset(); return api;
}
