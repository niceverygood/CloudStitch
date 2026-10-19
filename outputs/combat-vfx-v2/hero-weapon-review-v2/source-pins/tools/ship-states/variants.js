import * as THREE from 'three';
import partMap from '../airship-rig/part-map.json';

// All additions use the selected airship's original coordinates: +Y up, -X bow.
// These are authored visual studies, not damage, socket, or progression rules.
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
const TAU = Math.PI * 2;
const PIVOTS = {
  HullAndCabin: [0, -.11, .008], EnvelopeAndBands: [0, .132, .008],
  EngineHousing: [.385, -.143, .008], PropellerAssembly: [.451, -.137, .008],
  TurretAssembly: [-.287, -.103, .010], GunBarrel: [-.313, -.054, .008],
  WinchDrumMesh: [0, -.117, -.108], HookAndChain: [.003, -.208, -.126],
};
const COLORS = {
  wood: 0xb77b37, woodLight: 0xd3a055, woodDark: 0x795035,
  teal: 0x377e7c, tealLight: 0x65a2a0, tealDark: 0x244d51,
  brass: 0xc99d46, brassLight: 0xe1bd69, cream: 0xf3dfb9,
  coral: 0xc86e51, rope: 0xa4855c, iron: 0x3d5657, black: 0x302e2a,
  smoke: 0x576569, smokeLight: 0x88948c, orange: 0xed9942, fire: 0xf7cb6a,
};

function extract(source, triangleIndices, origin = V()) {
  const vertices = [], remap = new Map(), indices = [];
  for (const triangle of triangleIndices) for (let corner = 0; corner < 3; corner++) {
    const oldIndex = source.index.getX(triangle * 3 + corner);
    if (!remap.has(oldIndex)) { remap.set(oldIndex, vertices.length); vertices.push(oldIndex); }
    indices.push(remap.get(oldIndex));
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values = new attribute.array.constructor(vertices.length * attribute.itemSize);
    vertices.forEach((index, i) => {
      for (let c = 0; c < attribute.itemSize; c++) values[i * attribute.itemSize + c] = attribute.array[index * attribute.itemSize + c];
    });
    geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized));
  }
  geometry.setIndex(indices);
  geometry.translate(-origin.x, -origin.y, -origin.z);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function createVariantLibrary(gltf) {
  let source;
  gltf.scene.traverse(object => {
    if (object.isMesh) {
      if (source) throw new Error('Ship variants require the selected single-mesh original.');
      source = object;
    }
  });
  if (!source?.geometry.index) throw new Error('Selected ship has no indexed geometry.');
  source.updateWorldMatrix(true, false);
  const worldGeometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
  const sourceTriangles = worldGeometry.index.count / 3;
  if (sourceTriangles !== 11026) throw new Error('Ship topology differs from the preserved part map.');
  const groupedTriangles = Object.fromEntries(Object.keys(PIVOTS).map(name => [name, []]));
  const used = new Set();
  for (const component of partMap.components) {
    const target = Object.entries(partMap.parts).find(([, ids]) => ids.includes(component.componentId))?.[0]
      || (component.center[1] > .065 ? 'EnvelopeAndBands' : 'HullAndCabin');
    for (const triangle of component.triangleIndices) {
      if (used.has(triangle)) throw new Error('Duplicate source triangle in ship part map.');
      used.add(triangle);
    }
    groupedTriangles[target].push(...component.triangleIndices);
  }
  if (used.size !== sourceTriangles) throw new Error('Ship part map does not preserve all source triangles.');
  const partGeometries = Object.fromEntries(Object.entries(groupedTriangles).map(([name, triangles]) =>
    [name, extract(worldGeometry, triangles, V(...PIVOTS[name]))]));
  let islandGeometries;
  const variants = new Set();
  // Small, deterministic painted surfaces shared across all added modules.
  // Source UVs/texture remain untouched; this adds dry-brush grain to new work.
  const paintedTextures = new Map();
  function paintedTexture(kind) {
    if (paintedTextures.has(kind)) return paintedTextures.get(kind);
    const size = 96, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const grain = Math.sin(x * 1.73 + y * 3.13) * Math.sin(x * .53 - y * 1.17);
      const stripe = kind === 'wood'
        ? Math.sin(y * .78 + Math.sin(x * .07) * 1.4) * 10 + Math.sin(y * 2.3 + x * .09) * 4
        : kind === 'cloth' ? ((x % 5 === 0 || y % 5 === 0) ? -10 : 1) + Math.sin(x * .11 + y * .14) * 5
        : Math.sin(y * .64 + Math.sin(x * .12)) * 5 + Math.sin(x * .14 + y * .1) * 4;
      const v = Math.round(clamp(238 + stripe + grain * 7, 212, 255)), i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = 'Cloudstitch painted ' + kind;
    texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.needsUpdate = true;
    paintedTextures.set(kind, texture); return texture;
  }

  function create(category, stage = 0) {
    const limits = { normal: 2, damage: 3, weapons: 4, armor: 4, growth: 8, explosion: 4 };
    if (!(category in limits)) throw new Error(`Unknown ship state category: ${category}`);
    stage = clamp(Math.round(stage), 0, limits[category]);
    const root = new THREE.Group(); root.name = `Cloudstitch_${category}_${stage}`;
    root.userData = { category, stage, sourceTriangles, sourceGeometryPreserved: true, visualStudy: true };
    const ownedGeometries = new Set(), ownedMaterials = new Set(), animated = [];
    const parts = {}, meshes = [], addonMeshes = [];
    const makeMaterial = (color, options = {}) => {
      const material = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true, ...options });
      if (!options.transparent && !options.emissive) {
        if ([COLORS.wood, COLORS.woodLight, COLORS.woodDark].includes(color)) material.map = paintedTexture('wood');
        if ([COLORS.teal, COLORS.tealLight, COLORS.tealDark, COLORS.brass, COLORS.brassLight].includes(color)) material.map = paintedTexture('metal');
        if ([COLORS.cream, COLORS.coral, COLORS.rope].includes(color)) material.map = paintedTexture('cloth');
      }
      material.userData.outlineParameters = { thickness: .002, color: [.07, .08, .07], alpha: 1, visible: true, keepAlive: true };
      ownedMaterials.add(material); return material;
    };
    const materials = Object.fromEntries(Object.entries(COLORS).map(([name, color]) => [name, makeMaterial(color)]));
    materials.cream.flatShading = false;
    const group = (name, parent = root, pos = [0, 0, 0]) => {
      const object = new THREE.Group(); object.name = name; object.position.set(...pos); parent.add(object); return object;
    };
    const add = (geometry, material, parent = root, name = 'Attached module') => {
      ownedGeometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, typeof material === 'string' ? materials[material] : material);
      mesh.name = name; mesh.userData.addon = true; parent.add(mesh); meshes.push(mesh); addonMeshes.push(mesh); return mesh;
    };
    const box = (size, pos, material, parent = root, name) => {
      const mesh = add(new THREE.BoxGeometry(...size), material, parent, name); mesh.position.set(...pos); return mesh;
    };
    const sphere = (size, pos, material, parent = root, name, detail = 1) => {
      const mesh = add(new THREE.IcosahedronGeometry(1, detail), material, parent, name);
      mesh.scale.set(...size); mesh.position.set(...pos); return mesh;
    };
    const rod = (a, b, radius, material = 'brass', parent = root, segments = 8, name) => {
      const start = V(...a), end = V(...b), length = start.distanceTo(end);
      const mesh = add(new THREE.CylinderGeometry(radius, radius, length, segments), material, parent, name);
      mesh.position.copy(start).add(end).multiplyScalar(.5);
      mesh.quaternion.setFromUnitVectors(V(0, 1, 0), end.sub(start).normalize()); return mesh;
    };
    const tube = (points, radius, material, parent = root, name) => add(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => V(...p))), 16, radius, 5, false), material, parent, name);
    const cylinder = (radius, length, pos, material, parent = root, name) => {
      const mesh = add(new THREE.CylinderGeometry(radius, radius, length, 12), material, parent, name);
      mesh.position.set(...pos); return mesh;
    };
    const ring = (radius, thickness, pos, material, parent = root, axis = 'x') => {
      const mesh = add(new THREE.TorusGeometry(radius, thickness, 5, 20), material, parent, 'Forged brass rim');
      mesh.position.set(...pos); if (axis === 'x') mesh.rotation.y = Math.PI / 2; if (axis === 'y') mesh.rotation.x = Math.PI / 2; return mesh;
    };
    const rivet = (pos, parent = root, radius = .003) => sphere([radius, radius, radius], pos, 'brassLight', parent, 'Hand-set rivet', 0);
    const plankDeck = (length, width, pos, parent = root) => {
      const deck = group('Bolted wooden deck', parent, pos);
      box([length, .013, width], [0, 0, 0], 'woodDark', deck, 'Deck support');
      const planks = Math.max(3, Math.round(width / .027));
      for (let i = 0; i < planks; i++) box([length - .008, .009, width / planks - .002],
        [0, .01, (i - (planks - 1) / 2) * width / planks], i % 2 ? 'woodLight' : 'wood', deck, 'Individual deck plank');
      for (const x of [-length * .41, length * .41]) for (const z of [-width * .4, width * .4]) rivet([x, .017, z], deck);
      return deck;
    };
    const railing = (length, z, pos, parent = root) => {
      const rail = group('Safety railing', parent, pos);
      for (let i = 0; i <= 4; i++) rod([-length / 2 + length * i / 4, 0, z], [-length / 2 + length * i / 4, .045, z], .0035, 'wood', rail);
      rod([-length / 2, .043, z], [length / 2, .043, z], .0035, 'brass', rail); return rail;
    };
    const explosionSourceMaterial = material => {
      const copy = material.clone();
      // Keep a single render path throughout the timeline. Switching opaque /
      // transparent at a scrub boundary changes THREE's render queues and the
      // outline pass's cached shaders, even when the same pose is requested.
      copy.transparent = true; copy.opacity = 1; copy.depthWrite = true;
      copy.needsUpdate = true; ownedMaterials.add(copy); return copy;
    };
    const baseSourceMaterial = category === 'explosion'
      ? (Array.isArray(source.material) ? source.material.map(explosionSourceMaterial) : explosionSourceMaterial(source.material))
      : source.material;

    if (category === 'explosion') {
      islandGeometries ||= partMap.components.map(component => extract(worldGeometry, component.triangleIndices, V(...component.center)));
      partMap.components.forEach((component, i) => {
        const pivot = group(`Original island ${component.componentId}`, root, component.center);
        const mesh = new THREE.Mesh(islandGeometries[i], baseSourceMaterial); mesh.name = `Original island mesh ${i}`;
        mesh.userData.sourceTriangles = component.triangleIndices.length; pivot.add(mesh); meshes.push(mesh);
        const c = V(...component.center);
        let direction = c.clone().sub(V(.04, -.11, 0));
        direction.y += .08 + .15 * Math.sin(i * 2.23); direction.z += .11 * Math.sin(i * 1.85);
        if (direction.lengthSq() < .0001) direction.set(.1, .1, .1);
        direction.normalize();
        animated.push({ type: 'island', object: pivot, mesh, start: c, direction, index: i, envelope: component.componentId === 2 });
      });
    } else {
      for (const [name, geometry] of Object.entries(partGeometries)) {
        const pivot = group(name, root, PIVOTS[name]);
        const mesh = new THREE.Mesh(geometry, baseSourceMaterial); mesh.name = name + ' original';
        mesh.userData.sourceTriangles = groupedTriangles[name].length;
        pivot.add(mesh); meshes.push(mesh); parts[name] = pivot;
      }
      // The original barrel follows its turret as a rigid child, rather than
      // orbiting separately when the lookout state scans the horizon.
      parts.GunBarrel.position.sub(parts.TurretAssembly.position);
      parts.TurretAssembly.add(parts.GunBarrel);
    }

    function rotor(parent, radius = .05) {
      const spin = group('Spinning auxiliary propeller', parent);
      rod([-.008, 0, 0], [.012, 0, 0], .012, 'brass', spin);
      for (let i = 0; i < 3; i++) {
        const blade = group('Teal propeller blade', spin); blade.rotation.x = i * Math.PI * 2 / 3;
        const leaf = sphere([.004, radius * .47, radius * .15], [0, radius * .51, .004], 'teal', blade);
        leaf.rotation.x = -.32;
        rod([-.003, radius * .22, .003], [-.003, radius * .8, .003], .002, 'brass', blade);
      }
      animated.push({ type: 'rotor', object: spin }); return spin;
    }
    function enginePod(pos, scale = 1, parent = root) {
      const pod = group('Auxiliary engine and mounting struts', parent, pos); pod.scale.setScalar(scale);
      const body = cylinder(.035, .09, [0, 0, 0], 'teal', pod, 'Teal engine casing'); body.rotation.z = Math.PI / 2;
      for (const x of [-.041, .028]) ring(.036, .004, [x, 0, 0], 'brass', pod);
      for (const x of [-.02, -.006, .008]) ring(.0355, .0018, [x, 0, 0], 'tealDark', pod);
      rod([-.025, .015, 0], [-.025, .059, 0], .008, 'iron', pod, 8, 'Engine exhaust');
      ring(.008, .002, [-.025, .059, 0], 'brass', pod, 'y');
      const prop = group('Auxiliary propeller hub', pod, [.061, 0, 0]); rotor(prop, .065);
      sphere([.012, .014, .014], [-.05, 0, 0], 'brass', pod);
      return pod;
    }
    function auxiliaryEnvelope(pos, scale = 1, parent = root) {
      const envelope = group('Cream auxiliary lift envelope', parent, pos); envelope.scale.setScalar(scale);
      sphere([.225, .073, .073], [0, 0, 0], 'cream', envelope, 'Sewn lift cloth', 2);
      for (const x of [-.13, .12]) {
        ring(.062, .004, [x, 0, 0], 'woodDark', envelope);
        box([.017, .015, .009], [x, .048, -.043], 'brass', envelope, 'Envelope buckle');
      }
      for (const s of [-1, 1]) tube([[-.2, .007, .006 * s], [0, .03, .073 * s], [.2, .007, .006 * s]], .0012, 'rope', envelope, 'Longitudinal cloth seam');
      const patch = box([.045, .002, .036], [-.11, .066, -.018], 'coral', envelope, 'Coral repair cloth'); patch.rotation.x = -.3;
      rod([-.23, 0, 0], [-.2, 0, 0], .008, 'brass', envelope);
      return envelope;
    }
    function lamp(pos, parent = root) {
      const stand = group('Warm navigation lantern', parent, pos);
      rod([0, 0, 0], [0, .045, 0], .0035, 'brass', stand);
      const glow = makeMaterial(0xf2cb73, { emissive: 0xc27725, emissiveIntensity: .3 });
      box([.018, .024, .018], [0, .044, 0], glow, stand, 'Lantern glass');
      for (const y of [.031, .057]) box([.022, .004, .022], [0, y, 0], 'tealDark', stand);
      return stand;
    }
    function platform(pos, length = .25, width = .13) {
      const deck = plankDeck(length, width, pos);
      const side = Math.sign(pos[2]) || 1;
      for (const x of [-length * .35, length * .35]) rod([x, -.01, 0], [x, -.075, -side * width * .58], .006, 'woodDark', deck);
      railing(length * .88, side * width * .44, [0, .014, 0], deck); return deck;
    }
    function cannon(pos, kind = 'cannon', parent = root) {
      const gun = group(kind + ' attached mount', parent, pos);
      plankDeck(.13, .11, [0, -.006, 0], gun);
      cylinder(.038, .018, [0, .012, 0], 'tealDark', gun, 'Bolted turntable');
      ring(.036, .0035, [0, .023, 0], 'brass', gun, 'y');
      box([.052, .045, .05], [.005, .041, 0], 'teal', gun, 'Gun cradle');
      for (const z of [-.033, .033]) {
        rod([-.025, .032, z], [.025, .032, z], .014, 'brass', gun);
        rivet([0, .035, z + Math.sign(z) * .005], gun, .005);
      }
      if (kind === 'mortar') {
        rod([.015, .035, 0], [-.047, .126, 0], .026, 'iron', gun, 12, 'Elevated mortar tube');
        const lip = ring(.026, .004, [-.047, .126, 0], 'brass', gun, 'y'); lip.rotation.z = -.6;
        rod([-.04, .024, -.035], [-.027, .085, -.027], .004, 'brass', gun);
        for (const x of [.025, .055]) sphere([.014, .019, .014], [x, .031, .035], 'coral', gun, 'Mortar ammunition', 1);
      } else if (kind === 'harpoon') {
        rod([.03, .064, 0], [-.155, .077, 0], .009, 'iron', gun, 8, 'Harpoon shaft');
        rod([-.016, .061, -.045], [-.07, .068, .045], .004, 'wood', gun);
        rod([-.016, .061, .045], [-.07, .068, -.045], .004, 'wood', gun);
        const tip = add(new THREE.ConeGeometry(.019, .047, 4), 'brass', gun, 'Barbed harpoon head');
        tip.position.set(-.17, .079, 0); tip.rotation.z = Math.PI / 2;
        for (const z of [-1, 1]) rod([-.145, .077, 0], [-.13, .077, z * .025], .004, 'brass', gun);
        ring(.025, .006, [.031, .037, -.045], 'rope', gun, 'z');
        tube([[.03, .035, -.044], [.065, .01, -.03], [-.04, .01, -.05], [-.12, .073, 0]], .002, 'rope', gun, 'Tether line');
      } else if (kind === 'brace') {
        for (const z of [-.012, .012]) {
          rod([.028, .065, z], [-.125, .065, z], .008, 'iron', gun, 10, 'Twin machine-gun barrel');
          ring(.009, .002, [-.111, .065, z], 'brass', gun);
        }
        box([.027, .028, .039], [.036, .049, .043], 'brass', gun, 'Ammunition box');
        for (let i = 0; i < 6; i++) rod([.013 + i * .007, .049, .03], [.013 + i * .007, .057, .03], .0027, 'brassLight', gun);
      } else {
        rod([.035, .065, 0], [-.14, .072, 0], .018, 'iron', gun, 12, 'Side cannon barrel');
        for (const x of [-.122, -.063]) ring(.020, .0035, [x, .072, 0], 'brass', gun);
        rod([.022, .051, -.025], [.05, .051, -.025], .007, 'wood', gun);
        for (let i = 0; i < 3; i++) sphere([.012, .012, .012], [.042 + (i % 2) * .023, .027 + (i === 2 ? .019 : 0), .033], 'iron', gun, 'Stored cannonball', 1);
      }
      return gun;
    }
    function armorPlate(x, y, z, index = 0, size = [.10, .075, .014]) {
      const plate = group('Overlapping teal armor', root, [x, y, z]);
      const face = box(size, [0, 0, 0], index % 2 ? 'teal' : 'tealLight', plate, 'Forged armor plate');
      face.rotation.z = .03 * Math.sin(index * 2);
      const side = Math.sign(z) || 1;
      rod([-size[0] * .46, size[1] * .41, side * .01], [size[0] * .46, size[1] * .41, side * .01], .0025, 'brass', plate);
      for (const px of [-1, 1]) for (const py of [-1, 1]) rivet([px * size[0] * .35, py * size[1] * .32, side * .009], plate, .003);
      return plate;
    }
    function fin(pos, parent = root, scale = 1) {
      const shape = new THREE.Shape(); shape.moveTo(-.07, 0); shape.lineTo(.07, 0); shape.lineTo(.11, .075); shape.lineTo(-.02, .049); shape.closePath();
      const geom = new THREE.ExtrudeGeometry(shape, { depth: .008, bevelEnabled: false });
      const mesh = add(geom, 'teal', parent, 'Teal steering fin'); mesh.position.set(...pos); mesh.scale.setScalar(scale);
      rod([pos[0] - .07 * scale, pos[1], pos[2] + .004], [pos[0] + .11 * scale, pos[1] + .075 * scale, pos[2] + .004], .0025, 'brass', parent);
      return mesh;
    }
    function puffCloud(pos, count, size = .025, parent = root, type = 'smoke') {
      const cloud = group('Animated engine smoke', parent, pos);
      for (let i = 0; i < count; i++) {
        const material = makeMaterial(i % 3 ? COLORS.smoke : COLORS.smokeLight, { transparent: true, opacity: .8, depthWrite: false });
        const puff = sphere([size, size * .83, size], [0, 0, 0], material, cloud, 'Soft smoke puff', 1);
        animated.push({ type, object: puff, index: i, count, size, material });
      }
      return cloud;
    }
    function tear(pos, size, parent) {
      const shape = new THREE.Shape();
      for (let i = 0; i < 17; i++) {
        const angle = i / 16 * Math.PI * 2, jag = i % 2 ? .69 : 1;
        const x = Math.cos(angle) * size[0] * jag, y = Math.sin(angle) * size[1] * jag;
        i ? shape.lineTo(x, y) : shape.moveTo(x, y);
      }
      const dark = add(new THREE.ShapeGeometry(shape), makeMaterial(0x494139, { side: THREE.DoubleSide }), parent, 'Jagged torn cloth opening'); dark.position.set(...pos);
      const near = pos[2] < 0 ? -1 : 1;
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI * 2 / 6;
        const a = [pos[0] + Math.cos(angle) * size[0] * .78, pos[1] + Math.sin(angle) * size[1] * .78, pos[2] + near * .001];
        const b = [pos[0] + Math.cos(angle + .12) * size[0] * 1.12, pos[1] + Math.sin(angle + .12) * size[1] * 1.12, pos[2] + near * .002];
        rod(a, b, .0015, 'cream', parent, 5, 'Frayed cloth edge');
      }
      const strip = box([size[0] * .36, size[1] * 1.1, .001], [pos[0] + size[0] * .4, pos[1] - size[1] * .6, pos[2] + near * .003], 'cream', parent, 'Loose hanging cloth');
      animated.push({ type: 'cloth', object: strip, phase: pos[0] * 30 });
    }

    if (category === 'normal') {
      if (stage >= 1) { lamp([-.27, -.10, -.112]); lamp([.22, -.045, .08]); }
      if (stage === 2) {
        for (const side of [-1, 1]) {
          const flag = group('Wind-stretched coral pennant', root, [.22, .005, side * .105]);
          rod([0, -.02, 0], [0, .07, 0], .0025, 'woodDark', flag);
          const shape = new THREE.Shape(); shape.moveTo(0, .065); shape.lineTo(.10, .044); shape.lineTo(0, .025); shape.closePath();
          add(new THREE.ShapeGeometry(shape), makeMaterial(COLORS.coral, { side: THREE.DoubleSide }), flag, 'Coral signal cloth');
          animated.push({ type: 'flag', object: flag, phase: side });
        }
        puffCloud([.39, -.07, .01], 5, .013);
      }
    }

    if (category === 'damage' && stage > 0) {
      const envelope = parts.EnvelopeAndBands;
      const pivot = V(...PIVOTS.EnvelopeAndBands);
      // Cloth tears are attached to the envelope's pivot and follow its sag.
      tear([-.18 - pivot.x, .14 - pivot.y, -.119 - pivot.z], [.045 + .012 * stage, .027 + .006 * stage], envelope);
      if (stage >= 2) tear([.095 - pivot.x, .162 - pivot.y, -.116 - pivot.z], [.052, .023], envelope);
      if (stage === 3) tear([-.06 - pivot.x, .218 - pivot.y, -.078 - pivot.z], [.070, .027], envelope);
      for (let i = 0; i < stage + 1; i++) {
        const x = -.33 + i * .115;
        tube([[x, -.154, -.104], [x + .017, -.178, -.108], [x + .005, -.192, -.106], [x + .025, -.215, -.094]],
          .0026, 'black', root, 'Split wooden hull seam');
        for (const z of [-1, 1]) box([.029, .014, .003], [x + .015, -.186 + i * .007, z * .107], 'black', root, 'Hull impact scar').rotation.z = -.4;
      }
      if (stage >= 2) {
        const loose = armorPlate(-.21, -.22, -.12, 1, [.085, .035, .006]); loose.rotation.z = -.4;
        animated.push({ type: 'loose', object: loose });
        rod([-.24, -.174, -.11], [-.24, -.237, -.133], .0025, 'rope');
        puffCloud([.345, -.07, -.02], 7 + stage * 2, .022 + stage * .006);
      }
      if (stage === 3) {
        const flare = makeMaterial(COLORS.orange, { emissive: 0xe6772f, emissiveIntensity: .55 });
        for (let i = 0; i < 5; i++) {
          const fire = sphere([.015, .04 + i * .004, .018], [.33 + (i % 3) * .015, -.095 + i * .008, -.018], flare, root, 'Small engine fire', 0);
          animated.push({ type: 'fire', object: fire, index: i, initial: fire.scale.clone() });
        }
      }
    }

    if (category === 'weapons') {
      if (stage >= 1) {
        const mount = platform([-.19, -.121, -.17], .23, .15);
        cannon([-.20, -.101, -.175], 'brace');
        lamp([-.085, -.10, -.215]);
      }
      if (stage >= 2) {
        platform([-.06, -.122, .18], .23, .16);
        const gun = cannon([-.045, -.102, .18], 'cannon'); gun.rotation.y = -.28;
        // Near-side cannon stays readable from the default review camera.
        cannon([.04, -.108, -.19], 'cannon').rotation.y = .24;
        for (const z of [-.27, .25]) box([.041, .04, .042], [.08, -.098, z], 'wood', root, 'Strapped ammunition crate');
      }
      if (stage >= 3) {
        platform([.11, -.117, .19], .18, .13);
        cannon([.12, -.097, .19], 'mortar');
        box([.065, .038, .055], [.04, -.073, .235], 'coral', root, 'Mortar ammunition locker');
      }
      if (stage >= 4) {
        platform([-.36, -.121, -.035], .21, .17);
        cannon([-.36, -.101, -.04], 'harpoon');
        rod([-.44, -.14, -.06], [-.27, -.20, -.06], .007, 'brass');
        for (const z of [-.09, .09]) box([.06, .022, .019], [-.39, -.102, z], 'coral', root, 'Harpoon bolt case');
      }
    }

    if (category === 'armor') {
      if (stage >= 1) {
        for (const side of [-1, 1]) for (const x of [-.28, -.08, .115]) {
          box([.021, .106, .016], [x, -.195, side * .101], 'brass', root, 'Vertical brass hull strap');
          for (const y of [-.159, -.225]) rivet([x, y, side * .112]);
        }
      }
      if (stage >= 2) for (const side of [-1, 1]) for (let i = 0; i < 5; i++) armorPlate(-.30 + i * .096, -.183, side * .119, i);
      if (stage >= 3) {
        for (const side of [-1, 1]) {
          armorPlate(.22, -.101, side * .082, 2, [.135, .104, .015]);
          const bow = armorPlate(-.405, -.157, side * .074, 1, [.095, .10, .018]); bow.rotation.y = -side * .46;
          rod([-.44, -.113, side * .056], [-.30, -.119, side * .128], .006, 'brass');
        }
        box([.18, .016, .142], [.225, -.015, .008], 'teal', root, 'Raised cabin roof guard');
        rod([.14, -.004, -.066], [.313, -.004, -.066], .0045, 'brass');
      }
      if (stage >= 4) {
        for (const side of [-1, 1]) {
          rod([-.41, -.248, side * .065], [.25, -.231, side * .076], .009, 'brass');
          rod([-.35, -.128, side * .133], [.18, -.128, side * .133], .006, 'tealDark');
          for (let i = 0; i < 4; i++) armorPlate(-.27 + i * .12, -.238, side * .089, i + 1, [.108, .044, .018]);
          const shield = armorPlate(.352, -.145, side * .05, 2, [.105, .094, .018]); shield.rotation.y = side * .22;
        }
        const crest = sphere([.017, .022, .006], [-.411, -.157, -.096], 'brassLight', root, 'Cloudstitch bow crest'); crest.rotation.z = -.25;
        for (const x of [-.2, .13]) {
          const band = ring(.118, .0035, [x, .132, .008], 'brass'); band.scale.z = .98;
        }
      }
    }

    if (category === 'growth') {
      const level = stage + 1;
      if (level >= 2) {
        for (const side of [-1, 1]) platform([-.09, -.127, side * .181], .36, .14);
        lamp([-.25, -.10, -.235]);
        for (const z of [-.21, .21]) box([.055, .048, .043], [.005, -.096, z], 'wood', root, 'Secured cargo crate');
      }
      if (level >= 3) for (const side of [-1, 1]) {
        rod([.12, -.14, side * .09], [.255, -.15, side * .21], .007, 'woodDark');
        rod([.24, -.12, side * .09], [.255, -.15, side * .21], .006, 'brass');
        enginePod([.255, -.155, side * .22], .82);
      }
      if (level >= 4) {
        auxiliaryEnvelope([-.015, .06, -.27], .83);
        for (const x of [-.14, .12]) {
          rod([x, -.115, -.19], [x, .044, -.27], .005, 'brass');
          rod([x, .035, -.08], [x, .05, -.27], .003, 'rope');
        }
      }
      if (level >= 5) {
        platform([-.435, -.118, 0], .23, .24);
        for (const side of [-1, 1]) rod([-.51, -.12, side * .092], [-.27, -.221, side * .065], .007, 'woodDark');
        cannon([-.445, -.096, 0], 'brace');
        lamp([-.52, -.09, -.087]);
      }
      if (level >= 6) {
        const cargo = plankDeck(.41, .22, [-.04, -.30, .008]);
        for (const x of [-.20, .12]) for (const side of [-1, 1]) rod([x, -.18, side * .08], [x, -.29, side * .108], .005, 'brass');
        for (let i = 0; i < 4; i++) {
          const crate = box([.077, .06, .072], [-.14 + (i % 2) * .12, -.257, -.046 + Math.floor(i / 2) * .10], i % 2 ? 'woodLight' : 'wood');
          for (const d of [-1, 1]) box([.008, .064, .075], [crate.position.x + d * .024, -.257, crate.position.z], 'woodDark');
        }
        railing(.36, -.102, [0, .014, 0], cargo); railing(.36, .102, [0, .014, 0], cargo);
      }
      if (level >= 7) {
        const lookout = plankDeck(.18, .14, [.09, .32, .008]);
        for (const x of [.025, .155]) for (const side of [-1, 1]) rod([x, .228, side * .05], [x, .32, side * .061], .0045, 'brass');
        railing(.15, -.061, [0, .014, 0], lookout); railing(.15, .061, [0, .014, 0], lookout);
        rod([.12, .329, 0], [.12, .445, 0], .003, 'woodDark');
        fin([.11, .39, .003], root, .55);
        lamp([.025, .332, -.045]);
        for (let i = 0; i < 7; i++) rod([.035, .12 + i * .026, -.065], [.065, .12 + i * .026, -.065], .002, 'brass');
      }
      if (level >= 8) {
        auxiliaryEnvelope([-.015, .06, .27], .83);
        for (const x of [-.14, .12]) {
          rod([x, -.115, .19], [x, .044, .27], .005, 'brass');
          rod([x, .035, .08], [x, .05, .27], .003, 'rope');
        }
        for (const side of [-1, 1]) enginePod([.16, -.17, side * .34], .75);
      }
      if (level >= 9) {
        for (const side of [-1, 1]) {
          platform([.12, -.12, side * .28], .19, .13);
          fin([.13, .02, side * .28], root, .78);
          for (let i = 0; i < 5; i++) armorPlate(-.29 + i * .098, -.19, side * .114, i);
          rod([-.43, -.254, side * .07], [.26, -.236, side * .08], .007, 'brass');
          cannon([.07, -.099, side * .27], side < 0 ? 'cannon' : 'mortar');
        }
        fin([.28, .015, .008], root, .8);
        for (const x of [-.2, .13]) ring(.118, .0025, [x, .132, .008], 'brass');
      }
      root.userData.level = level;
    }

    if (category === 'explosion') {
      // One deterministic timeline. Each review stage starts at its own sample,
      // while update(t) always accepts absolute seconds from energy exhaustion.
      // Start on the visible engine housing; the short radial fire lobes then
      // project beyond its silhouette before the darker smoke takes over.
      const burstCenter = V(.345, -.095, -.025);
      for (let i = 0; i < 22; i++) {
        const angle = i * 2.399963, y = ((i * 7) % 19) / 19 * 1.4 - .45;
        const direction = V(Math.cos(angle), y, Math.sin(angle)).normalize();
        const material = makeMaterial(i % 3 === 0 ? COLORS.fire : COLORS.orange, { transparent: true, opacity: 1, emissive: i % 3 === 0 ? 0xd18a31 : 0xc85c29, emissiveIntensity: .5, depthWrite: false });
        const fire = sphere([.035, .035, .035], burstCenter.toArray(), material, root, 'Radial explosion flame', i % 3 ? 0 : 1);
        animated.push({ type: 'burst', object: fire, material, direction, start: burstCenter, index: i });
      }
      for (let i = 0; i < 34; i++) {
        const angle = i * 2.399963 + .4, direction = V(Math.cos(angle), .1 + Math.sin(i * 1.3) * .65, Math.sin(angle)).normalize();
        const material = makeMaterial(i % 4 ? COLORS.brassLight : COLORS.coral, { transparent: true, opacity: 1, emissive: 0x825021, emissiveIntensity: .2 });
        const spark = box([.025, .004, .004], burstCenter.toArray(), material, root, 'Ejected glowing splinter');
        animated.push({ type: 'spark', object: spark, material, direction, start: burstCenter, index: i });
      }
      for (let i = 0; i < 26; i++) {
        const material = makeMaterial(i % 3 ? COLORS.smoke : COLORS.smokeLight, { transparent: true, opacity: .9, depthWrite: false });
        const smoke = sphere([.04, .04, .04], burstCenter.toArray(), material, root, 'Expanding explosion smoke', 1);
        const angle = i * 2.399963;
        animated.push({ type: 'explosionSmoke', object: smoke, material, direction: V(Math.cos(angle), .25 + (i % 5) * .15, Math.sin(angle)).normalize(), start: burstCenter, index: i });
      }
      const warningMaterial = makeMaterial(COLORS.coral, { transparent: true, opacity: 0, depthWrite: false, emissive: 0xb63e28, emissiveIntensity: .4 });
      const warning = sphere([.14, .10, .09], [.385, -.143, .008], warningMaterial, root, 'Energy exhaustion warning glow', 1);
      animated.push({ type: 'warning', object: warning, material: warningMaterial });
      for (let i = 0; i < 2; i++) {
        const material = makeMaterial(i ? COLORS.fire : COLORS.brassLight, { transparent: true, opacity: 0, depthWrite: false, emissive: 0xba7d35, emissiveIntensity: .4 });
        const wave = ring(1, .013, burstCenter.toArray(), material, root, i ? 'z' : 'y');
        wave.name = 'Expanding golden pressure ring';
        animated.push({ type: 'shockwave', object: wave, material, index: i });
      }
    }

    function setOpacity(item, opacity) {
      item.object.visible = opacity > .006;
      const material = item.object.material;
      if (Array.isArray(material)) material.forEach(m => { m.opacity = opacity; m.transparent = true; });
      else if (material) { material.opacity = opacity; material.transparent = true; }
      if (item.material) item.material.opacity = opacity;
    }
    function update(time = 0) {
      const t = Number.isFinite(time) ? Math.max(0, time) : 0;
      // All ordinary motion shares a six-second closed cycle. Integer turn
      // counts and harmonics also make a manual scrub from 6 -> 0 exact.
      const cycleTime = t % 6, phase = TAU * cycleTime / 6;
      if (category === 'explosion') {
        const alpha = 1 - smooth(2.75, 4, t);
        // Synchronize the retained source materials as well as the currently
        // selected display material so changing display modes cannot restore
        // an opacity left over from an earlier point on the timeline.
        for (const material of (Array.isArray(baseSourceMaterial) ? baseSourceMaterial : [baseSourceMaterial])) {
          material.opacity = alpha; material.transparent = true; material.depthWrite = true;
        }
      }
      if (category !== 'explosion') {
        const rotorTurns = category === 'normal' ? [6, 14, 25][stage] : category === 'damage' ? [12, 9, 7, 4][stage] : 12;
        root.position.y = Math.sin(phase) * .005;
        root.rotation.z = Math.sin(phase) * .009;
        if (parts.PropellerAssembly) parts.PropellerAssembly.rotation.x = -phase * rotorTurns;
        if (parts.TurretAssembly) parts.TurretAssembly.rotation.y = category === 'normal' && stage === 2 ? Math.sin(phase) * .32 : 0;
        if (parts.EnvelopeAndBands) {
          parts.EnvelopeAndBands.rotation.z = .008 * Math.sin(phase);
          if (category === 'damage') {
            parts.EnvelopeAndBands.scale.y = 1 - stage * .085;
            parts.EnvelopeAndBands.position.y = PIVOTS.EnvelopeAndBands[1] - stage * .012;
            parts.EnvelopeAndBands.rotation.z += stage * .024;
            root.rotation.z += stage * .013;
          }
        }
        if (parts.EngineHousing && category === 'damage') {
          parts.EngineHousing.position.y = PIVOTS.EngineHousing[1] + Math.sin(phase * 32) * .0007 * stage;
          parts.EngineHousing.rotation.z = stage === 3 ? -.15 + Math.sin(phase * 15) * .012 : 0;
        }
      }
      for (const item of animated) {
        const o = item.object, i = item.index || 0;
        if (item.type === 'rotor') o.rotation.x = -phase * 12;
        if (item.type === 'flag') o.rotation.y = Math.sin(phase * 7 + item.phase) * .12;
        if (item.type === 'cloth') o.rotation.x = Math.sin(phase * 4 + item.phase) * .22;
        if (item.type === 'loose') o.rotation.z = -.4 + Math.sin(phase * 3) * .08;
        if (item.type === 'fire') { o.scale.copy(item.initial).multiplyScalar(.83 + .18 * Math.sin(phase * 12 + i * 2)); o.rotation.z = Math.sin(phase * 8 + i) * .15; }
        if (item.type === 'smoke') {
          const smokePhase = (cycleTime / 2 + i / item.count) % 1;
          o.position.set(smokePhase * .08 + Math.sin(i * 3) * .009, smokePhase * .18, Math.sin(smokePhase * 5 + i) * .017);
          o.scale.setScalar(item.size * (.5 + smokePhase * 1.8));
          setOpacity(item, smooth(0, .10, smokePhase) * (1 - smokePhase) * .67);
        }
        if (item.type === 'island') {
          const travel = Math.max(0, t - .95), detach = smooth(.9, 1.32, t);
          o.position.copy(item.start).addScaledVector(item.direction, travel * (.07 + (i % 8) * .008));
          o.position.y -= .06 * travel * travel;
          o.rotation.set(Math.sin(i * 3.1) * travel * .7, Math.cos(i * 1.8) * travel * .6, Math.sin(i + .7) * travel * .9);
          if (t < .95) { o.rotation.set(0, 0, 0); o.position.x += Math.sin(t * 65) * .0017 * smooth(.2, .9, t); }
          if (item.envelope) { o.scale.set(1 - detach * .06, 1 - detach * .22, 1 - detach * .12); o.position.y += travel * .11; }
          const alpha = 1 - smooth(2.75, 4, t);
          const mats = Array.isArray(item.mesh.material) ? item.mesh.material : [item.mesh.material];
          for (const m of mats) { m.opacity = alpha; m.transparent = true; m.depthWrite = true; }
          o.visible = alpha > .006;
        }
        if (item.type === 'warning') setOpacity(item, (1 - smooth(.82, 1, t)) * (.12 + .23 * Math.pow(Math.sin(t * 18), 2)));
        if (item.type === 'shockwave') {
          const age = t - .82 - i * .12, progress = clamp(age / .72, 0, 1);
          o.scale.setScalar(.04 + progress * .52);
          setOpacity(item, age > 0 && age < .72 ? Math.sin(progress * Math.PI) * (1 - progress) * .9 : 0);
        }
        if (item.type === 'burst') {
          const age = t - (.57 + (i % 4) * .07);
          const progress = clamp(age / 1.25, 0, 1);
          o.position.copy(item.start).addScaledVector(item.direction, progress * (.22 + (i % 5) * .024));
          const size = 1.6 * (.034 + (i % 5) * .009) * Math.sin(progress * Math.PI);
          o.scale.set(size, size * (1.1 + i % 3 * .2), size);
          setOpacity(item, t < 4 && age > 0 && age < 1.25 ? smooth(0, .10, age) * (1 - smooth(.78, 1.25, age)) : 0);
        }
        if (item.type === 'spark') {
          const age = Math.max(0, t - .9), speed = .20 + (i % 9) * .018;
          o.position.copy(item.start).addScaledVector(item.direction, age * speed); o.position.y -= .12 * age * age;
          o.rotation.set(age * (i % 5 + 1), age * 2, age * 3 + i);
          o.scale.setScalar(1 - .45 * smooth(1.3, 2.7, age));
          setOpacity(item, t >= .9 && t < 4 ? 1 - smooth(1.4, 2.6, age) : 0);
        }
        if (item.type === 'explosionSmoke') {
          const age = t - (.88 + (i % 5) * .08), progress = clamp(age / 2.7, 0, 1);
          o.position.copy(item.start).addScaledVector(item.direction, progress * (.17 + (i % 4) * .024)); o.position.y += progress * .17;
          const size = .025 + progress * (.07 + (i % 4) * .009); o.scale.set(size, size * .85, size);
          o.rotation.y = i + progress * .7;
          // Fade by absolute sequence time, not staggered particle age, so
          // every lobe is gone at the terminal frame and replay starts clean.
          setOpacity(item, age >= 0 && t < 4 ? smooth(0, .65, age) * (1 - smooth(3, 4, t)) * .85 : 0);
        }
      }
    }
    update(category === 'explosion' ? [0, .65, 1.3, 2.3, 3.8][stage] : 0);
    const counts = {
      sourceTriangles, meshes: meshes.length, addonMeshes: addonMeshes.length,
      triangles: meshes.reduce((sum, mesh) => sum + (mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3), 0),
      sourceParts: category === 'explosion' ? partMap.components.length : Object.keys(parts).length,
    };
    root.userData.counts = counts;
    let disposed = false;
    const result = { root, update, counts, parts, dispose() {
      if (disposed) return; disposed = true;
      ownedGeometries.forEach(geometry => geometry.dispose()); ownedMaterials.forEach(material => material.dispose());
      variants.delete(result); root.removeFromParent();
    } };
    variants.add(result); return result;
  }
  return { create, sourceTriangles, dispose() {
    [...variants].forEach(variant => variant.dispose());
    Object.values(partGeometries).forEach(geometry => geometry.dispose());
    islandGeometries?.forEach(geometry => geometry.dispose()); worldGeometry.dispose();
    paintedTextures.forEach(texture => texture.dispose());
  } };
}
