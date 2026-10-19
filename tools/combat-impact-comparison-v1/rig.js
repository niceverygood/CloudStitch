/** Presentation-only external gun deck. The canonical frame is a sibling of
 * the recoil group; recoil never changes the projectile authority frame. */
export function createMount(THREE, heroRoot, weaponScene, { weapon = 'cannon' } = {}) {
  if (!['cannon', 'machinegun'].includes(weapon)) throw new TypeError('Unknown mounted weapon');
  const cannon = weapon === 'cannon', root = new THREE.Group();
  root.name = 'comparison_external_gun_deck';
  // Fit to the actual wooden hull mesh in hero coordinates. The authored
  // artillery ship's original deployed ground feet/shields are not our rig.
  heroRoot.updateWorldMatrix(true, true);
  const inverseHero = heroRoot.matrixWorld.clone().invert(), hullMeshes = [], fallbackMeshes = [];
  heroRoot.traverse(node => { if (!node.isMesh) return; fallbackMeshes.push(node); if (/HullAndCabin/i.test(node.name)) hullMeshes.push(node); });
  const candidates = hullMeshes.length ? hullMeshes : fallbackMeshes, hullBounds = new THREE.Box3(), hullPoints = [];
  for (const node of candidates) {
    const positions = node.geometry?.attributes?.position; if (!positions) continue;
    const toHero = inverseHero.clone().multiply(node.matrixWorld);
    for (let i = 0; i < positions.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(toHero);
      hullBounds.expandByPoint(p); hullPoints.push(p);
    }
  }
  // Empty test hosts can still exercise presentation, but real assets use the
  // actual triangle surface via raycast, never a guessed hull radius.
  if (hullBounds.isEmpty()) hullBounds.set(new THREE.Vector3(-7.5, -2, -1.4), new THREE.Vector3(7.5, 0, 1.4));
  const hullHeight = hullBounds.max.y - hullBounds.min.y, anchorY = hullBounds.min.y + hullHeight * .43;
  const anchorX = THREE.MathUtils.clamp(-2.4, hullBounds.min.x + 1.3, hullBounds.max.x - 1.3);
  const ray = new THREE.Raycaster(), rayDirection = new THREE.Vector3(0, 0, -1).transformDirection(heroRoot.matrixWorld);
  const anchors = [-.95, .95].map(offset => {
    const origin = heroRoot.localToWorld(new THREE.Vector3(anchorX + offset, anchorY, hullBounds.max.z + 20));
    ray.set(origin, rayDirection);
    const hits = ray.intersectObjects(candidates, false);
    if (hits.length) return heroRoot.worldToLocal(hits[0].point.clone());
    // If the chosen height crosses a window/open triangle, use an actual
    // closest vertex of the same hull rather than a floating support foot.
    const expected = new THREE.Vector3(anchorX + offset, anchorY, hullBounds.max.z);
    return hullPoints.reduce((best, p) => !best || p.distanceToSquared(expected) < best.distanceToSquared(expected) ? p : best, null)?.clone() || expected;
  });
  root.position.set(anchorX, Math.max(...anchors.map(p => p.y)) + .35, Math.max(...anchors.map(p => p.z)) + 1.1);
  heroRoot.add(root);
  const localAnchors = anchors.map(p => p.clone().sub(root.position));
  const ownedGeometry = new Set(), ownedMaterials = new Set();
  const material = (color, name) => {
    const value = new THREE.MeshToonMaterial({ color }); value.name = name; ownedMaterials.add(value); return value;
  };
  const wood = material(0xa76c39, 'Honey painted timber'), teal = material(0x246e70, 'Teal recoil iron'),
    brass = material(0xc99a4d, 'Matte brass fittings'), coral = material(0xc76d59, 'Coral cloth shock pads');
  const mesh = (name, geometry, mat, p) => {
    ownedGeometry.add(geometry); const object = new THREE.Mesh(geometry, mat); object.name = name;
    object.position.fromArray(p); root.add(object); return object;
  };
  const box = (name, dims, p, mat) => mesh(name, new THREE.BoxGeometry(...dims), mat, p);
  function beam(name, a, b, width, mat) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), d = end.clone().sub(start);
    const result = box(name, [width, d.length(), width], start.clone().add(end).multiplyScalar(.5).toArray(), mat);
    result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return result;
  }
  box('timber_deck_with_hull_overlap', [3.6, .24, 2.45], [0, -.12, -.42], wood);
  for (const [i, anchor] of localAnchors.entries()) {
    const x = i ? .95 : -.95;
    beam('continuous_hull_cross_beam', [x, -.26, .55], [anchor.x, -.26, anchor.z - .12], .22, teal);
    beam('diagonal_hull_load_path', [x, -.20, .45], anchor.toArray(), .24, wood);
    box('brass_hull_shoe', [.44, .32, .22], anchor.toArray(), brass);
    box('brass_rail_top', [.12, .12, 2.35], [x, .05, -.42], brass);
  }
  for (const z of [-.55, .45]) box('coral_compression_pad', [2.3, .13, .24], [0, .11, z], coral);
  const recoil = new THREE.Group(); recoil.name = 'visual_recoil_only'; root.add(recoil);
  const model = weaponScene.clone(true); model.name = 'preserved_weapon_instance';
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const scale = (cannon ? 3 : 2.5) / Math.max(size.x, size.y, size.z);
  // In this source the muzzle points -X. Select the front tip's actual height,
  // rather than the center of the plinth/weapon bounding box.
  let tipY = 0, tipZ = 0, count = 0;
  model.updateMatrixWorld(true);
  const maxBand = bounds.min.x + size.x * .025;
  model.traverse(node => {
    const attr = node.geometry?.attributes?.position; if (!attr) return;
    const p = new THREE.Vector3();
    for (let i = 0; i < attr.count; i++) {
      p.fromBufferAttribute(attr, i).applyMatrix4(node.matrixWorld);
      if (p.x <= maxBand) { tipY += p.y; tipZ += p.z; count++; }
    }
  });
  const normalized = new THREE.Group(); normalized.name = 'uniform_weapon_scale'; normalized.scale.setScalar(scale);
  model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z)); normalized.add(model); recoil.add(normalized);
  recoil.position.y = .18;
  const datum = new THREE.Object3D(); datum.name = 'authority_muzzle_without_recoil';
  datum.position.set((bounds.min.x - center.x) * scale, .18 + ((count ? tipY / count : bounds.max.y) - bounds.min.y) * scale,
    ((count ? tipZ / count : center.z) - center.z) * scale); root.add(datum);
  const rest = recoil.position.clone();
  root.userData = { weapon, shipNormalizedLength: 15, forward: '-X', up: '+Y',
    mount: 'camera-facing external +Z gun deck with actual hull-surface anchors',
    recoilAuthority: 'presentation-only; stable muzzle sibling', gameplaySocket: false,
    weaponUniformScale: scale, sourcePreserved: true, hullAnchorsHeroLocal: anchors.map(p => p.toArray()),
    muzzleSourceLocal: [bounds.min.x, count ? tipY / count : bounds.max.y, count ? tipZ / count : center.z],
    muzzleBandFraction: .025, muzzleBandVertexCount: count };
  function frame() {
    root.updateWorldMatrix(true, true);
    return { position: datum.getWorldPosition(new THREE.Vector3()),
      direction: new THREE.Vector3(-1, 0, 0).transformDirection(root.matrixWorld) };
  }
  function pose(time, events, version = 'new', reducedMotion = false) {
    if (!Number.isFinite(time)) throw new TypeError('Finite pose time required');
    let kick = 0, lift = 0, roll = 0, compression = 0;
    for (const event of events) {
      if (event.type !== 'fire') continue;
      const age = time - event.time;
      if (age < -.13 || age > (cannon ? 1.5 : .42)) continue;
      const rich = version === 'new';
      if (age < 0) {
        if (rich) { const u = (age + .13) / .13; compression += Math.sin(u * Math.PI) * .075; }
        continue;
      }
      const impact = (1 - Math.exp(-age * (cannon ? 95 : 160))) * Math.exp(-age * (cannon ? 4.4 : 15));
      kick += impact * (rich ? (cannon ? 1.12 : .34) : (cannon ? .13 : .045));
      if (rich) {
        lift += impact * (cannon ? .18 : .05);
        roll += Math.sin(age * (cannon ? 20 : 45)) * Math.exp(-age * (cannon ? 4 : 17)) * (cannon ? .11 : .045);
      }
    }
    const motion = reducedMotion ? .18 : 1;
    recoil.position.copy(rest); recoil.position.x += Math.min(cannon ? .95 : .45, kick) * motion;
    recoil.position.y += (lift - compression) * motion;
    recoil.rotation.set(roll * .25 * motion, roll * .18 * motion, -roll * motion);
    // An armored whole weapon moves as one piece; no claim of barrel disassembly.
    recoil.scale.set(1 - compression * motion * .35, 1 - compression * motion, 1 + compression * motion * .4);
  }
  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true; root.removeFromParent();
    // Model geometry/textures are borrowed from the immutable loaded source.
    ownedGeometry.forEach(g => g.dispose()); ownedMaterials.forEach(m => m.dispose());
  }
  return { root, model, frame, pose, dispose };
}
