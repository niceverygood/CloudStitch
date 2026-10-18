/**
 * Locally authored Cloudstitch mechanical kit. +Y up, -X forward, a hull is
 * approximately 10 units long. All geometry has normals/UVs and uses supplied
 * matte painted materials. Every mesh is owned by a Bone for later rigid skin
 * conversion; no world transform or engine-specific animation is required.
 *
 * controls: {bone, role, axis, amplitude, motion, phase?, restLength?}.
 * Rotational amplitudes are radians, translations are model units. `cable`
 * scales local Y from a fixed upper anchor while `hook` translates down Y.
 */

export function makeDevice(THREE, { id, type, materials = {}, style = {} }) {
  if (!id || typeof id !== 'string') throw new Error('Device needs a unique module id');
  const root = new THREE.Bone();
  root.name = `${id}_Root`;
  root.userData = { moduleId: id, moduleType: type, parentId: null, authored: true };
  const controls = [], features = [];
  let serial = 0;
  const fallback = new Map();
  const palette = { wood: 0x96704c, canvas: 0xe7dfbd, metal: 0x687473, brass: 0xb19450, teal: 0x557f78, rope: 0x89734e, glass: 0x789f9a, coral: 0xbe7565, navy: 0x344f59 };
  function mat(key) {
    const mapped = style.materials?.[key] || key;
    if (materials[mapped]) return materials[mapped];
    if (!fallback.has(mapped)) {
      const m = new THREE.MeshStandardMaterial({ color: palette[mapped] || 0x8f9985, roughness: 1, metalness: 0 });
      m.name = `Fallback matte ${mapped}`; fallback.set(mapped, m);
    }
    return fallback.get(mapped);
  }
  function mesh(parent, label, geometry, material = 'metal', position = [0, 0, 0], rotation = [0, 0, 0]) {
    // ExtrudeGeometry emits world-sized UVs; keep every new part within its
    // supplied atlas tile rather than sampling neighbouring material tiles.
    const uv = geometry.attributes.uv;
    if (uv) {
      let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
      for (let i = 0; i < uv.count; i++) { minU = Math.min(minU, uv.getX(i)); maxU = Math.max(maxU, uv.getX(i)); minV = Math.min(minV, uv.getY(i)); maxV = Math.max(maxV, uv.getY(i)); }
      if (minU < 0 || minV < 0 || maxU > 1 || maxV > 1) {
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - minU) / Math.max(maxU - minU, .00001), (uv.getY(i) - minV) / Math.max(maxV - minV, .00001));
      }
    }
    const object = new THREE.Mesh(geometry, typeof material === 'string' ? mat(material) : material);
    object.name = `${id}_${label}_${serial++}`;
    object.position.fromArray(position); object.rotation.fromArray(rotation);
    object.userData = { moduleId: id, moduleType: type, surface: typeof material === 'string' ? material : 'custom' };
    parent.add(object); return object;
  }
  function bone(parent, suffix, role, axis, amplitude, position = [0, 0, 0], motion = 'rotation', extra = {}) {
    const b = new THREE.Bone(); b.name = `${id}_${suffix}`; b.position.fromArray(position);
    b.userData = { moduleId: id, controlRole: role, axis, motion, ...extra };
    parent.add(b);
    if (role) controls.push({ bone: b, role, axis, amplitude, motion, ...extra });
    return b;
  }
  function sphere(parent, label, radius, material, position, scale = [1, 1, 1]) {
    const geometry = new THREE.SphereGeometry(radius, 12, 8); geometry.scale(...scale);
    return mesh(parent, label, geometry, material, position);
  }
  function cylinder(parent, label, radius, length, material, position = [0, 0, 0], axis = 'y', radiusBottom = radius, segments = 16) {
    const g = new THREE.CylinderGeometry(radius, radiusBottom, length, segments, 1, false);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    return mesh(parent, label, g, material, position);
  }
  function ring(parent, label, radius, thickness, material, position = [0, 0, 0], axis = 'x') {
    const g = new THREE.TorusGeometry(radius, thickness, 6, 24);
    if (axis === 'x') g.rotateY(Math.PI / 2);
    if (axis === 'y') g.rotateX(Math.PI / 2);
    return mesh(parent, label, g, material, position);
  }
  function beam(parent, label, a, b, radius = .04, material = 'metal', radiusBottom = radius) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const g = new THREE.CylinderGeometry(radius, radiusBottom, start.distanceTo(end), 10, 1, false);
    const object = mesh(parent, label, g, material, start.clone().add(end).multiplyScalar(.5).toArray());
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return object;
  }
  function tube(parent, label, points, radius, material = 'metal', segments = 24) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(parent, label, new THREE.TubeGeometry(curve, segments, radius, 7, false), material);
  }
  function plate(parent, label, width, height, depth, material, position = [0, 0, 0], rotation = [0, 0, 0], corner = .09) {
    const x = -width / 2, y = -height / 2, r = Math.min(corner, width / 3, height / 3);
    const s = new THREE.Shape();
    s.moveTo(x + r, y); s.lineTo(x + width - r, y); s.quadraticCurveTo(x + width, y, x + width, y + r);
    s.lineTo(x + width, y + height - r); s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    s.lineTo(x + r, y + height); s.quadraticCurveTo(x, y + height, x, y + height - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: Math.min(.025, depth * .25), bevelThickness: Math.min(.025, depth * .25), bevelSegments: 1, curveSegments: 4, steps: 1 });
    g.translate(0, 0, -depth / 2);
    return mesh(parent, label, g, material, position, rotation);
  }
  function lathe(parent, label, profile, material, position = [0, 0, 0], axis = 'y', segments = 20) {
    const g = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), segments);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    return mesh(parent, label, g, material, position);
  }
  function bolts(parent, label, radius, position, axis = 'x', count = 8, size = .025) {
    for (let i = 0; i < count; i++) {
      const a = i * Math.PI * 2 / count, p = [...position];
      if (axis === 'x') { p[1] += Math.cos(a) * radius; p[2] += Math.sin(a) * radius; }
      if (axis === 'y') { p[0] += Math.cos(a) * radius; p[2] += Math.sin(a) * radius; }
      if (axis === 'z') { p[0] += Math.cos(a) * radius; p[1] += Math.sin(a) * radius; }
      sphere(parent, label, size, 'brass', p);
    }
  }
  function gunTube(parent, label, length, radius, position, material = 'metal') {
    const inner = radius * .67;
    lathe(parent, label, [[inner, -length / 2], [radius, -length / 2], [radius, length / 2], [inner, length / 2], [inner, -length / 2]], material, position, 'x');
    const mouth = position[0] - length / 2;
    const g = new THREE.CircleGeometry(inner * .98, 16); g.rotateY(-Math.PI / 2);
    mesh(parent, `${label}_DeepBore`, g, 'navy', [mouth + .12, position[1], position[2]]);
    ring(parent, `${label}_MuzzleRim`, radius * .94, radius * .12, 'brass', [mouth, position[1], position[2]], 'x');
  }
  function stand(parent = root, width = .9) {
    cylinder(parent, 'PedestalFoot', width * .48, .12, 'metal', [0, .06, 0], 'y', width * .55);
    cylinder(parent, 'TraverseBearing', width * .32, .16, 'teal', [0, .2, 0]);
    ring(parent, 'BearingLip', width * .34, .035, 'brass', [0, .28, 0], 'y');
    bolts(parent, 'FootBolt', width * .43, [0, .13, 0], 'y', 6, .025);
  }
  function weaponMount(recoil = .13) {
    stand();
    const yaw = bone(root, 'Yaw', 'yaw', 'y', .35, [0, .28, 0]);
    for (const side of [-1, 1]) {
      plate(yaw, 'CradleCheek', .66, .36, .065, 'teal', [.08, .2, side * .28]);
      ring(yaw, 'Trunnion', .105, .025, 'brass', [.02, .26, side * .32], 'z');
    }
    const kick = bone(yaw, 'Recoil', 'recoil', 'x', recoil, [-.08, .3, 0], 'translation');
    return { yaw, kick };
  }
  function tank(parent, position = [0, .5, 0], radius = .3, height = .9) {
    lathe(parent, 'PressureTank', [[0, -height / 2], [radius * .65, -height / 2], [radius, -height * .35], [radius, height * .32], [radius * .72, height / 2], [0, height * .52]], 'teal', position);
    for (const y of [-height * .27, height * .27]) ring(parent, 'TankStrap', radius * 1.01, .035, 'brass', [position[0], position[1] + y, position[2]], 'y');
    cylinder(parent, 'TankValveStem', .055, .15, 'brass', [position[0], position[1] + height * .6, position[2]]);
    ring(parent, 'TankValveWheel', .105, .022, 'coral', [position[0], position[1] + height * .7, position[2]], 'y');
  }

  switch (type) {
    case 'machinegun': {
      const { yaw, kick } = weaponMount(.08);
      plate(kick, 'Receiver', .55, .2, .3, 'metal', [.05, .02, 0]);
      gunTube(kick, 'VentedBarrel', 1.03, .085, [-.68, .06, 0]);
      for (let i = 0; i < 5; i++) {
        ring(kick, 'CoolingRib', .095, .015, 'teal', [-.32 - i * .145, .06, 0]);
        for (const z of [-.081, .081]) sphere(kick, 'CoolingVent', .032, 'navy', [-.39 - i * .145, .075, z], [1, .6, .32]);
      }
      cylinder(kick, 'DrumMagazine', .19, .17, 'brass', [.1, -.06, .22], 'z');
      ring(kick, 'MagazineRim', .19, .025, 'metal', [.1, -.06, .32], 'z');
      beam(yaw, 'RearHandle', [.26, .14, -.19], [.26, .35, -.19], .035, 'wood');
      plate(kick, 'IronSight', .12, .12, .04, 'brass', [-.48, .22, 0], [0, Math.PI / 2, 0]);
      features.push('vented-barrel', 'drum-magazine', 'yaw-traverse', 'short-recoil'); break;
    }
    case 'cannon': {
      const { yaw, kick } = weaponMount(.17);
      sphere(kick, 'Breech', .29, 'teal', [.15, .02, 0], [1.15, 1, 1]);
      gunTube(kick, 'ReinforcedBarrel', 1.65, .175, [-.69, .03, 0]);
      for (const x of [-.05, -.42, -1.24]) {
        ring(kick, 'BronzeBand', .19, .035, 'brass', [x, .03, 0]);
        if (x === -.05) bolts(kick, 'BreechRivet', .2, [x, .03, 0], 'x', 8);
      }
      for (const z of [-.19, .19]) cylinder(yaw, 'RecoilBuffer', .06, .62, 'brass', [.19, .08, z], 'x');
      cylinder(kick, 'BreechKnob', .08, .18, 'wood', [.48, .02, 0], 'x');
      features.push('hollow-heavy-barrel', 'reinforced-bronze-collars', 'recoil-buffers', 'yaw-traverse'); break;
    }
    case 'mortar': {
      stand(root, 1.0);
      const yaw = bone(root, 'Yaw', 'yaw', 'y', .24, [0, .28, 0]);
      lathe(yaw, 'CradledBowl', [[0, -.02], [.3, -.02], [.42, .12], [.43, .24], [.35, .27], [.28, .14], [0, .12]], 'teal');
      const pitch = bone(yaw, 'Elevation', 'pitch', 'z', .1, [0, .18, 0]); pitch.rotation.z = -1.12;
      const kick = bone(pitch, 'Recoil', 'recoil', 'x', .13, [0, 0, 0], 'translation');
      gunTube(kick, 'HighAngleTube', .95, .25, [-.42, 0, 0]);
      ring(kick, 'WideMortarLip', .265, .055, 'brass', [-.91, 0, 0]);
      for (const z of [-.36, .36]) {
        beam(yaw, 'ElevationArm', [.13, .04, z], [-.28, .51, z], .055, 'metal');
        ring(yaw, 'ElevationWheel', .17, .027, 'brass', [.14, .2, z], 'z');
      }
      features.push('high-angle-bowl', 'wide-open-bore', 'elevation-hinge', 'recoil'); break;
    }
    case 'harpoon': {
      const { yaw, kick } = weaponMount(.14);
      for (const z of [-.1, .1]) beam(kick, 'LaunchRail', [.25, 0, z], [-1.28, 0, z], .035, 'metal');
      cylinder(kick, 'HarpoonShaft', .035, 1.4, 'brass', [-.55, .12, 0], 'x');
      cylinder(kick, 'BarbedTip', 0, .3, 'metal', [-1.37, .12, 0], 'x', .12, 10);
      for (const side of [-1, 1]) {
        const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(.28, side * .16); s.lineTo(.18, 0); s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: .035, bevelEnabled: false });
        mesh(kick, 'HarpoonBarb', g, 'metal', [-1.4, .12, -.018]);
      }
      cylinder(yaw, 'LineReel', .21, .2, 'teal', [.27, .15, .35], 'z');
      for (let i = 0; i < 5; i++) ring(yaw, 'ReelRope', .17, .022, 'rope', [.27, .15, .27 + i * .035], 'z');
      tube(yaw, 'FeedCable', [[.24, .22, .3], [-.06, .3, .26], [-.7, .1, .17]], .018, 'rope');
      features.push('barbed-harpoon', 'twin-launch-rails', 'visible-line-reel', 'yaw-and-recoil'); break;
    }
    case 'chainshot': {
      const { kick } = weaponMount(.12);
      plate(kick, 'PairedBreech', .55, .28, .7, 'teal', [.03, 0, 0]);
      for (const z of [-.23, .23]) {
        gunTube(kick, 'ChainBarrel', 1.05, .125, [-.62, .04, z]);
        ring(kick, 'BreechBand', .14, .027, 'brass', [-.15, .04, z]);
      }
      for (let i = 0; i < 5; i++) ring(kick, 'ChainLink', .054, .014, 'metal', [-1.02, .02, -.2 + i * .1], i % 2 ? 'x' : 'y');
      features.push('paired-chain-barrels', 'linked-shot-silhouette', 'shared-recoil', 'yaw-traverse'); break;
    }
    case 'flame': {
      stand(root, .9);
      const yaw = bone(root, 'Yaw', 'yaw', 'y', .25, [0, .3, 0]);
      gunTube(yaw, 'FlameNozzle', .8, .16, [-.52, .25, 0], 'brass');
      lathe(yaw, 'NozzleGuard', [[.17, -.28], [.23, -.24], [.22, -.1], [.17, .1]], 'metal', [-.77, .25, 0], 'x');
      tank(root, [.42, .55, 0], .27, .85);
      tube(root, 'FuelHose', [[.32, .8, .2], [.1, .9, .35], [-.28, .55, .27], [-.45, .49, .12]], .036, 'rope');
      for (const z of [-.32, .32]) beam(root, 'TankGuard', [.68, .1, z], [.68, .95, z], .04, 'metal');
      const valve = bone(yaw, 'Valve', 'valve', 'z', .7, [-.1, .32, .22]);
      ring(valve, 'ReleaseWheel', .16, .027, 'coral', [0, 0, 0], 'z');
      for (let i = 0; i < 4; i++) beam(valve, 'ValveSpoke', [0, 0, 0], [.14 * Math.cos(i * Math.PI / 2), .14 * Math.sin(i * Math.PI / 2), 0], .015, 'brass');
      features.push('flared-nozzle', 'protected-pressure-tank', 'fuel-hose', 'animated-release-valve'); break;
    }
    case 'engine': {
      for (const x of [-.48, .43]) plate(root, 'EngineFoot', .28, .18, .95, 'metal', [x, .08, 0]);
      const housing = bone(root, 'Vibration', 'vibration', 'x', .004, [0, .68, 0]);
      lathe(housing, 'TealEngineCowling', [[0, -.65], [.35, -.65], [.43, -.48], [.45, .35], [.34, .65], [0, .7]], 'teal', [0, 0, 0], 'x');
      for (const x of [-.57, .5]) { ring(housing, 'CowlingBand', .39, .045, 'brass', [x, 0, 0]); bolts(housing, 'CowlingRivet', .37, [x, 0, 0], 'x', 10); }
      for (let i = 0; i < 5; i++) {
        const x = -.31 + i * .13;
        plate(housing, 'EngineVent', .055, .35, .025, 'navy', [x, .13, -.423], [.12, 0, 0], .02);
        plate(housing, 'EngineVentLip', .035, .35, .035, 'brass', [x + .034, .13, -.43], [.12, 0, 0], .01);
      }
      cylinder(housing, 'DriveShaft', .075, .4, 'brass', [.77, 0, 0], 'x');
      const rotor = bone(housing, 'Rotor', 'rotor', 'x', Math.PI * 2, [.96, 0, 0], 'rotation', { rpm: 240 });
      sphere(rotor, 'PropellerSpinner', .17, 'brass', [.04, 0, 0], [1.5, 1, 1]);
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Shape();
        s.moveTo(-.055, .12); s.bezierCurveTo(-.19, .3, -.19, .69, -.05, .84);
        s.bezierCurveTo(.07, .92, .22, .79, .23, .69); s.bezierCurveTo(.24, .47, .07, .24, .055, .12); s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: .045, bevelEnabled: true, bevelSize: .012, bevelThickness: .01, bevelSegments: 1, curveSegments: 7 });
        g.translate(0, 0, -.0225); g.rotateY(Math.PI / 2);
        const blade = mesh(rotor, 'CurvedPropellerBlade', g, 'teal'); blade.rotation.x = i * Math.PI * 2 / 3;
        const inset = mesh(rotor, 'BladeBrassRoot', new THREE.SphereGeometry(.085, 10, 6), 'brass', [0, .17 * Math.cos(i * Math.PI * 2 / 3), .17 * Math.sin(i * Math.PI * 2 / 3)]); inset.scale.set(.4, 1, 1);
      }
      tube(housing, 'ExhaustElbow', [[-.3, .31, .18], [-.32, .6, .18], [-.06, .69, .18]], .065, 'metal');
      ring(housing, 'ExhaustRim', .07, .018, 'brass', [-.04, .69, .18], 'x');
      features.push('curved-three-blade-propeller', 'independent-shaft-rotation', 'ribbed-vented-cowling', 'vibration-mount'); break;
    }
    case 'hook': {
      plate(root, 'WinchBase', 1.15, .16, .85, 'wood', [0, .08, 0]);
      for (const x of [-.47, .47]) plate(root, 'WinchCheek', .15, .72, .68, 'teal', [x, .36, 0]);
      const drum = bone(root, 'Drum', 'drum', 'x', Math.PI * 6, [0, .48, 0]);
      cylinder(drum, 'WinchCore', .23, .78, 'wood', [0, 0, 0], 'x');
      for (const x of [-.4, .4]) { cylinder(drum, 'WinchFlange', .36, .07, 'brass', [x, 0, 0], 'x'); bolts(drum, 'FlangeBolt', .28, [x * 1.1, 0, 0], 'x', 6); }
      for (let i = 0; i < 11; i++) ring(drum, 'WoundRope', .25, .025, 'rope', [-.32 + i * .064, 0, 0], 'x');
      beam(root, 'GuideArm', [.32, .35, -.25], [.32, .22, -.56], .04, 'metal');
      ring(root, 'CableGuide', .09, .025, 'brass', [.15, .15, -.55], 'z');
      const length = 1.15;
      const cable = bone(root, 'Cable', 'cable', 'y', .65, [.15, .15, -.55], 'scale', { restLength: length });
      cylinder(cable, 'SuspendedRope', .024, length, 'rope', [0, -length / 2, 0]);
      const hook = bone(root, 'Hook', 'hook', 'y', .65, [.15, .15 - length, -.55], 'translation');
      ring(hook, 'HookEye', .105, .025, 'brass', [0, -.08, 0], 'z');
      tube(hook, 'ForgedHook', [[0, -.15, 0], [-.06, -.31, 0], [-.02, -.51, 0], [.17, -.57, 0], [.32, -.44, 0], [.25, -.34, 0]], .055, 'metal');
      cylinder(hook, 'HookTip', 0, .17, 'brass', [.25, -.32, 0], 'y', .05, 8);
      features.push('wound-rope-drum', 'independent-drum', 'fixed-upper-cable-anchor', 'payout-hook'); break;
    }
    case 'repair': {
      stand(root, .85);
      const shoulder = bone(root, 'Shoulder', 'shoulder', 'z', .22, [0, .35, 0]); shoulder.rotation.z = -.35;
      sphere(shoulder, 'ShoulderBearing', .18, 'teal', [0, 0, 0]);
      for (const z of [-.09, .09]) beam(shoulder, 'UpperRepairArm', [0, 0, z], [-.85, 0, z], .065, 'brass');
      cylinder(shoulder, 'ShoulderAxle', .1, .32, 'metal', [0, 0, 0], 'z');
      const elbow = bone(shoulder, 'Elbow', 'elbow', 'z', .3, [-.85, 0, 0]); elbow.rotation.z = .8;
      sphere(elbow, 'ElbowBearing', .13, 'teal', [0, 0, 0]);
      beam(elbow, 'Forearm', [0, 0, 0], [-.72, 0, 0], .08, 'metal');
      tube(elbow, 'HydraulicLine', [[.08, .08, .12], [-.27, .17, .15], [-.64, .07, .1]], .025, 'rope');
      const grip = bone(elbow, 'Grip', 'grip', 'z', .18, [-.72, 0, 0]);
      cylinder(grip, 'ToolPivot', .1, .23, 'brass', [0, 0, 0], 'z');
      for (const side of [-1, 1]) tube(grip, 'RepairJaw', [[0, side * .06, 0], [-.18, side * .19, 0], [-.33, side * .13, 0]], .035, 'teal');
      cylinder(grip, 'WelderTip', .025, .3, 'brass', [-.15, 0, .12], 'x');
      features.push('articulated-shoulder-elbow-grip', 'paired-gripper-jaws', 'hydraulic-line', 'welder-nozzle'); break;
    }
    case 'bell': {
      for (const x of [-.67, .67]) beam(root, 'BellFramePost', [x, 0, 0], [x, 1.45, 0], .08, 'wood');
      beam(root, 'BellCrossbeam', [-.79, 1.45, 0], [.79, 1.45, 0], .09, 'wood');
      const bell = bone(root, 'Bell', 'bell', 'z', .24, [0, 1.38, 0]);
      ring(bell, 'HangingEye', .12, .03, 'brass', [0, -.05, 0], 'x');
      lathe(bell, 'CastBell', [[.13, -.14], [.23, -.2], [.27, -.45], [.44, -.78], [.6, -.9], [.6, -.98], [.51, -.98], [.45, -.81], [.2, -.45], [.15, -.25]], 'brass');
      ring(bell, 'BellLip', .57, .045, 'metal', [0, -.95, 0], 'y');
      for (let i = 0; i < 8; i++) sphere(bell, 'BellDecoration', .032, 'coral', [.31 * Math.cos(i * Math.PI / 4), -.57, .31 * Math.sin(i * Math.PI / 4)]);
      const clapper = bone(bell, 'Clapper', 'clapper', 'z', .34, [0, -.28, 0]);
      cylinder(clapper, 'ClapperRod', .035, .49, 'metal', [0, -.245, 0]);
      sphere(clapper, 'ClapperWeight', .13, 'metal', [0, -.54, 0]);
      features.push('flared-cast-bell', 'separate-bell-swing', 'independent-clapper', 'timber-hanging-frame'); break;
    }
    case 'tank': {
      tank(root, [0, .62, 0], .38, 1.1);
      for (const z of [-.45, .45]) beam(root, 'ProtectiveCage', [-.27, .05, z], [-.27, 1.26, z], .045, 'metal');
      plate(root, 'TankFoot', .95, .13, .95, 'wood', [0, .06, 0]);
      features.push('rounded-pressure-vessel', 'brass-straps', 'valve-wheel', 'protective-cage'); break;
    }
    case 'armor': {
      plate(root, 'ArmorBacking', 1.2, .95, .14, 'navy', [0, .45, 0]);
      plate(root, 'LayeredArmorFace', 1.08, .83, .12, style.armorMaterial || 'metal', [.02, .46, -.12], [.04, -.06, -.03]);
      plate(root, 'OverlappedCorner', .42, .27, .07, 'coral', [.3, .68, -.21], [0, 0, .08]);
      for (const x of [-.45, .45]) for (const y of [.15, .76]) sphere(root, 'ArmorRivet', .04, 'brass', [x, y, -.2]);
      features.push('overlapping-rounded-plate', 'visible-rivets', 'patch-panel'); break;
    }
    case 'smoke': {
      tank(root, [0, .38, 0], .25, .6);
      tube(root, 'SmokeStack', [[0, .66, 0], [0, 1.0, 0], [-.25, 1.17, 0]], .1, 'metal');
      ring(root, 'SmokeMouth', .11, .025, 'brass', [-.25, 1.17, 0], 'x');
      cylinder(root, 'StackRainCap', .19, .055, 'teal', [-.07, 1.27, 0], 'y');
      features.push('curved-smoke-stack', 'capped-pressure-canister'); break;
    }
    case 'rescue': {
      sphere(root, 'RescuePod', .66, 'canvas', [0, .49, 0], [1.3, .7, .7]);
      for (const x of [-.45, .45]) ring(root, 'PodBands', .45, .04, 'brass', [x, .49, 0], 'x');
      for (const z of [-.36, .36]) { sphere(root, 'PodWindow', .18, 'glass', [-.18, .58, z], [1, 1, .16]); ring(root, 'WindowRim', .18, .025, 'teal', [-.18, .58, z], 'z'); }
      plate(root, 'RescueHatch', .46, .53, .07, 'coral', [-.7, .5, 0], [0, Math.PI / 2, 0]);
      for (const z of [-.3, .3]) beam(root, 'PodSkid', [-.7, .08, z], [.7, .08, z], .04, 'metal');
      features.push('rounded-rescue-capsule', 'porthole-windows', 'distinct-coral-hatch', 'landing-skids'); break;
    }
    case 'rail': {
      for (const z of [-.28, .28]) beam(root, 'ModuleSwapRail', [-1, .09, z], [1, .09, z], .045, 'metal');
      for (const x of [-.8, 0, .8]) beam(root, 'RailSleeper', [x, .04, -.4], [x, .04, .4], .05, 'wood');
      const carriage = bone(root, 'Rail', 'rail', 'x', .35, [0, .16, 0], 'translation');
      plate(carriage, 'SwapCarriage', .78, .14, .74, 'teal');
      for (const x of [-.27, .27]) for (const z of [-.32, .32]) cylinder(carriage, 'RailWheel', .1, .06, 'brass', [x, -.08, z], 'z');
      features.push('paired-swap-rails', 'moving-wheeled-carriage'); break;
    }
    case 'storage': {
      plate(root, 'StoragePlatform', 1.3, .14, 1.0, 'wood', [0, .07, 0]);
      for (const z of [-.42, .42]) beam(root, 'RackPost', [.45, .1, z], [.45, 1.0, z], .045, 'metal');
      for (const y of [.38, .78]) beam(root, 'RackCrossbar', [.45, y, -.43], [.45, y, .43], .045, 'brass');
      for (const z of [-.25, .25]) cylinder(root, 'StoredBarrel', .11, .95, 'teal', [-.05, .37, z], 'x');
      tank(root, [.35, .57, .23], .14, .55);
      features.push('visible-finite-spare-equipment', 'brass-storage-rack'); break;
    }
    case 'crane': {
      stand(root, 1.2);
      cylinder(root, 'CraneTower', .19, 1.15, 'teal', [0, .82, 0]);
      const shoulder = bone(root, 'Shoulder', 'shoulder', 'z', .18, [0, 1.4, 0]); shoulder.rotation.z = -.35;
      for (const z of [-.15, .15]) beam(shoulder, 'CraneBoom', [0, 0, z], [-1.55, 0, z], .075, 'metal');
      for (let i = 0; i < 4; i++) beam(shoulder, 'BoomTruss', [-i * .38, 0, -.15], [-(i + 1) * .38, 0, .15], .025, 'brass');
      const elbow = bone(shoulder, 'Elbow', 'elbow', 'z', .24, [-1.55, 0, 0]); elbow.rotation.z = .55;
      beam(elbow, 'OuterBoom', [0, 0, 0], [-.9, 0, 0], .085, 'teal');
      ring(elbow, 'CranePulley', .16, .035, 'brass', [-.86, 0, 0], 'z');
      const cable = bone(elbow, 'Cable', 'cable', 'y', .65, [-.86, -.04, 0], 'scale', { restLength: .9 });
      cylinder(cable, 'CraneCable', .025, .9, 'rope', [0, -.45, 0]);
      const hook = bone(elbow, 'Hook', 'hook', 'y', .65, [-.86, -.94, 0], 'translation');
      tube(hook, 'CraneHook', [[0, 0, 0], [0, -.28, 0], [.18, -.34, 0], [.28, -.2, 0]], .055, 'metal');
      features.push('two-joint-trussed-crane', 'visible-pulley', 'extending-cable', 'recoverable-hook'); break;
    }
    case 'sail': {
      cylinder(root, 'SailMast', .055, 2.25, 'wood', [0, 1.125, 0]);
      beam(root, 'SailYard', [0, 2.03, -.8], [0, 2.03, .8], .045, 'wood');
      const sail = bone(root, 'Sail', 'sail', 'y', .055, [0, 1.96, 0]);
      const g = new THREE.PlaneGeometry(1.55, 1.58, 10, 10); g.rotateY(Math.PI / 2); g.translate(0, -.79, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), z = p.getZ(i);
        p.setX(i, .15 * Math.sin(Math.PI * (-y / 1.58)) * (1 - Math.abs(z) / .85));
        if (style.torn !== false && y < -1.5) p.setY(i, y + .2 * Math.max(0, Math.sin(z * 10 + .6)));
      }
      g.computeVertexNormals();
      const sailMat = mat(style.sailMaterial || 'navy').clone(); sailMat.side = THREE.DoubleSide;
      mesh(sail, 'BowedPaintedSail', g, sailMat);
      for (const z of [-.78, .78]) tube(sail, 'SailEdgeRope', [[0, 0, z], [.08, -.8, z * .93], [0, -1.58, z * .82]], .016, 'rope');
      features.push('bowed-painted-cloth', 'independent-sail-sway', 'timber-mast', 'edge-ropes'); break;
    }
    default: throw new Error(`Unsupported Cloudstitch device type: ${type}`);
  }
  root.updateMatrixWorld(true);
  root.userData.features = [...features];
  root.userData.controlCount = controls.length;
  return { root, controls, features };
}
