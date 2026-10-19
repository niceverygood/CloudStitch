/** Cloudstitch: a single, staged painted cannon event. Display only.
 * Absolute time makes pause, reverse scrub and deterministic comparisons safe.
 * Big curved brush petals, medium timber chips and tiny glints have separate
 * rhythms; the 10x direction is a redesign, never a damage/scale multiplier.
 */
export const CANNON_STAGE_DURATIONS = Object.freeze({ muzzle: .78, hit: 1.10 });
const clamp = n => Math.max(0, Math.min(1, n));
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const fade = (t, a, b) => 1 - ramp(t, a, b);
const COLORS = { cream: 0xffedbc, ivory: 0xfff5da, brass: 0xd7a34d, wood: 0xb47540, sage: 0x8caa9a, ink: 0x485e59, coral: 0xd88860 };

export function createDramaticCannonStage(THREE, { atlas, camera = null, reducedMotion = false } = {}) {
  if (!atlas?.isTexture) throw new TypeError('Cannon stage requires a caller-owned atlas texture.');
  const root = new THREE.Group(); root.name = 'dramatic-painted-cannon';
  const nodes = [], owned = new Set(), cameraNormal = new THREE.Vector3(), cameraUp = new THREE.Vector3();
  const axis = new THREE.Vector3(), right = new THREE.Vector3(), face = new THREE.Vector3();
  const matrix = new THREE.Matrix4(), inverse = new THREE.Quaternion(), cameraWorldQ = new THREE.Quaternion(), cameraLocalQ = new THREE.Quaternion();
  const roll = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  let disposed = false, phase = 'idle', currentKind = null, seconds = -1;
  function tile(geometry, index) {
    const uv = geometry.getAttribute('uv'), x = index % 2 * .5, y = index < 2 ? .5 : 0;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, x + .012 + uv.getX(i) * .476, y + .012 + uv.getY(i) * .476);
    return geometry;
  }
  function add(name, index, color, geometry = new THREE.PlaneGeometry(1, 1)) {
    const material = new THREE.MeshBasicMaterial({ map: atlas, color, transparent: true, opacity: 0,
      depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(tile(geometry, index), material); mesh.name = name; mesh.visible = false;
    mesh.renderOrder = 2; root.add(mesh); nodes.push(mesh); owned.add(geometry); owned.add(material); return mesh;
  }
  function petalGeometry(index) {
    const positions = [], uvs = [], indices = [], count = 10;
    for (let i = 0; i <= count; i++) {
      const t = i / count, bend = Math.sin(t * Math.PI * .9) * (.34 + index * .027), width = Math.sin(Math.PI * t) ** .65 * .48 + .018;
      for (const sign of [-1, 1]) { positions.push(bend + sign * width, t, 0); uvs.push(sign < 0 ? 0 : 1, t); }
      if (i < count) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }
  const contact = add('ink-contact', 1, COLORS.ink), star = add('cream-contact-star', 1, COLORS.ivory);
  const flash = add('long-painted-flash', 0, COLORS.ivory), fan = add('compressed-brush-fan', 0, COLORS.brass);
  const petals = Array.from({ length: 7 }, (_, i) => add('curved-pressure-petal-' + i, i % 3 === 0 ? 3 : 1, i % 3 === 0 ? COLORS.brass : COLORS.cream, petalGeometry(i)));
  const chips = Array.from({ length: 10 }, (_, i) => add('timber-splinter-' + i, 3, i % 2 ? COLORS.wood : COLORS.coral));
  const smoke = Array.from({ length: 7 }, (_, i) => add('rolling-smoke-plume-' + i, 2, i % 3 === 0 ? COLORS.sage : COLORS.cream));
  const glints = Array.from({ length: 9 }, (_, i) => add('small-ember-' + i, 3, i % 2 ? COLORS.ivory : COLORS.brass));
  function billboard(mesh, rotation = 0) {
    // Camera orientation, not camera position: orthographic quads stay parallel
    // at every event origin, including large off-center contact positions.
    mesh.quaternion.copy(cameraLocalQ);
    if (rotation) mesh.quaternion.multiply(roll.setFromAxisAngle(Z, rotation));
  }
  function stroke(mesh, vector) {
    face.copy(cameraNormal);
    axis.copy(vector).addScaledVector(face, -vector.dot(face));
    if (axis.lengthSq() < 1e-8) axis.copy(cameraUp);
    axis.normalize(); right.crossVectors(axis, face).normalize();
    matrix.makeBasis(right, axis, face); mesh.quaternion.setFromRotationMatrix(matrix);
  }
  function show(mesh, opacity, x, y, z, width, height, rotation = 0) {
    mesh.material.opacity = clamp(opacity); mesh.visible = opacity > .001; mesh.position.set(x, y, z);
    mesh.scale.set(width, height, 1); billboard(mesh, rotation);
  }
  function reset() {
    for (const mesh of nodes) { mesh.visible = false; mesh.material.opacity = 0; mesh.position.set(0, 0, 0); mesh.quaternion.identity(); mesh.scale.set(1, 1, 1); }
    root.visible = false; root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.set(1, 1, 1);
    phase = 'idle'; currentKind = null; seconds = -1;
  }
  function evaluate(kind, time, frame = {}) {
    if (disposed) throw new Error('Disposed cannon stage.');
    if (!Object.hasOwn(CANNON_STAGE_DURATIONS, kind) || !Number.isFinite(time)) throw new TypeError('Invalid cannon stage/time.');
    reset(); currentKind = kind; seconds = time;
    if (time < 0 || time >= CANNON_STAGE_DURATIONS[kind]) { phase = 'ended'; return api; }
    for (const key of ['x', 'y', 'z']) if (!Number.isFinite(frame[key])) throw new TypeError('Cannon frame requires finite world XYZ.');
    const basis = kind === 'hit' ? frame.normal : frame.direction;
    if (!basis || ![basis.x, basis.y, basis.z].every(Number.isFinite) || Math.hypot(basis.x, basis.y, basis.z) < 1e-8) throw new TypeError('Cannon requires actual direction/normal.');
    root.position.set(frame.x, frame.y, frame.z); root.quaternion.setFromUnitVectors(new THREE.Vector3(0, kind === 'hit' ? 1 : 0, kind === 'muzzle' ? 1 : 0), new THREE.Vector3(basis.x, basis.y, basis.z).normalize()); root.visible = true;
    const view = frame.camera || camera;
    if (view?.getWorldQuaternion) view.getWorldQuaternion(cameraWorldQ); else cameraWorldQ.identity();
    cameraLocalQ.copy(inverse.copy(root.quaternion).invert()).multiply(cameraWorldQ);
    cameraNormal.set(0, 0, 1).applyQuaternion(cameraLocalQ); cameraUp.set(0, 1, 0).applyQuaternion(cameraLocalQ);
    const t = time, motion = reducedMotion ? .62 : 1;
    if (kind === 'hit') {
      phase = t < .06 ? 'contact' : t < .30 ? 'painted-eruption' : t < .85 ? 'rolling-smoke' : 'embers';
      const contactAlpha = fade(t, .025, .105), burst = ramp(t, .025, .19);
      show(contact, contactAlpha * .60, 0, .025, 0, .65 + burst * 1.5, .65 + burst * 1.5, -.2);
      show(star, contactAlpha, 0, .07, 0, .28 + ramp(t, 0, .055) * 1.9, .38 + ramp(t, 0, .055) * 1.65, .2);
      petals.forEach((mesh, i) => {
        const angle = i / 7 * Math.PI * 2 + .18, delay = .035 + (i % 3) * .011, grow = ramp(t, delay, .19), decay = fade(t, .20, .40);
        const length = (2.4 + (i % 3) * .31) * grow, distance = .10 + grow * .48 * motion;
        const vector = new THREE.Vector3(Math.cos(angle), .22 + (i % 2) * .31, Math.sin(angle));
        mesh.position.copy(vector).multiplyScalar(distance); mesh.material.opacity = grow * decay * .92; mesh.visible = mesh.material.opacity > .001;
        mesh.scale.set(.77 + (i % 2) * .18, length, 1); stroke(mesh, vector);
      });
      chips.forEach((mesh, i) => {
        const q = ramp(t, .045 + i % 3 * .012, .60), a = i * 2.399 + .35, radius = (.55 + q * (2.0 + i % 3 * .22)) * motion;
        show(mesh, ramp(t, .04, .10) * fade(t, .32, .72), Math.cos(a) * radius, .15 + q * (1.4 + i % 2 * .5) - q * q * 1.6, Math.sin(a) * radius, .12 + i % 3 * .055, .45 + i % 2 * .26, a + q * 2.4 * motion);
      });
      smoke.forEach((mesh, i) => {
        const delay = .12 + i * .027, q = ramp(t, delay, .87), a = i * 2.399 + q * .92 * motion, radius = (.18 + q * (1.1 + i % 2 * .25)) * motion;
        const size = (.65 + q * (1.5 + i % 3 * .2));
        show(mesh, ramp(t, delay, delay + .11) * fade(t, .58 + i * .035, 1.04 + i * .008) * .64, Math.cos(a) * radius, .35 + q * (1.4 + i % 3 * .23), Math.sin(a) * radius, size, size * (.85 + i % 2 * .22), i * .6 + q * .2);
      });
    } else {
      phase = t < .045 ? 'compressed-contact' : t < .16 ? 'brush-release' : 'muzzle-smoke';
      const release = ramp(t, .015, .075), alpha = fade(t, .08, .19);
      show(fan, fade(t, .035, .10), 0, 0, .15, .9 + release * .6, .8 + release * .4, .35);
      const flashLength = .35 + release * 3.1;
      flash.position.set(0, 0, .12 + flashLength * .46); flash.material.opacity = alpha; flash.visible = alpha > .001;
      flash.scale.set(.58 + release * .45, flashLength, 1); stroke(flash, new THREE.Vector3(0, 0, 1));
      petals.slice(0, 3).forEach((mesh, i) => {
        const a = i * 2.1 + .35, q = ramp(t, .02, .12), vector = new THREE.Vector3(Math.cos(a) * .70, Math.sin(a) * .70, .60);
        mesh.position.set(Math.cos(a) * .12, Math.sin(a) * .12, .22); mesh.scale.set(.45, q * (1.4 + i * .2), 1);
        mesh.material.opacity = q * fade(t, .11, .24) * .85; mesh.visible = mesh.material.opacity > .001; stroke(mesh, vector);
      });
      smoke.slice(0, 5).forEach((mesh, i) => {
        const q = ramp(t, .08 + i * .025, .70), a = i * 2.399, size = .45 + q * 1.5;
        show(mesh, ramp(t, .08 + i * .025, .18 + i * .025) * fade(t, .43, .78) * .58, Math.cos(a) * q * .70 * motion, Math.sin(a) * q * .70 * motion + q * .65, .4 + q * (1.3 + i * .18), size, size * .8, a);
      });
    }
    glints.forEach((mesh, i) => {
      const q = ramp(t, kind === 'hit' ? .12 : .03, kind === 'hit' ? 1.08 : .40), a = i * 2.399, r = q * (1.8 + i % 3 * .26) * motion;
      const opacity = ramp(t, kind === 'hit' ? .11 : .02, kind === 'hit' ? .2 : .06) * fade(t, kind === 'hit' ? .62 : .14, kind === 'hit' ? 1.10 : .38);
      const p = kind === 'hit' ? [Math.cos(a) * r, .25 + q * 1.1 - q * q * 1.1, Math.sin(a) * r] : [Math.cos(a) * r * .4, Math.sin(a) * r * .4, q * 2.6];
      show(mesh, opacity * .78, ...p, .055 + i % 2 * .035, .16 + i % 3 * .06, a + q);
    });
    root.userData.phase = phase; root.userData.elapsed = t; root.userData.kind = kind; return api;
  }
  function dispose() { if (disposed) return; reset(); root.removeFromParent(); for (const resource of owned) resource.dispose(); owned.clear(); disposed = true; }
  const api = { root, evaluate, reset, dispose, durations: CANNON_STAGE_DURATIONS,
    debug: () => ({ phase, kind: currentKind, seconds, reducedMotion, disposed, meshCount: nodes.length, visibleMeshes: nodes.filter(n => n.visible).length, ownedResources: owned.size, callerAtlasOwned: false }) };
  reset(); return api;
}
