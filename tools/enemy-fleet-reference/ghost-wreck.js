import { THREE, group, mesh, box, sphere, tube, beam, ring, hull, cloth, engine, cannon, lantern, control } from './kit.js';

// Art-only reference interpretations. Source modules remain null. Local X is
// length, the bow points -X, +Y is up. None of these roots applies combat damage.
const sequence = (count, callback) => Array.from({ length: count }, (_, index) => callback(index));

function ribbon(parent, material, name, points, width, torn = false) {
  const vertices = [], uv = [], indices = [];
  for (let index = 0; index < points.length; index++) {
    const point = points[index], factor = torn ? .7 + .22 * Math.sin(index * 2.7) : 1;
    vertices.push(point[0], point[1], point[2] - width * factor / 2, point[0], point[1] + (torn ? Math.sin(index * 1.8) * .08 : 0), point[2] + width * factor / 2);
    uv.push(index / (points.length - 1), 0, index / (points.length - 1), 1);
    if (index < points.length - 1) { const a = index * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return mesh(parent, geometry, material, name);
}

function spearHull(parent, m, id) {
  const body = group(parent, id + '-needle-hull');
  body.userData.moduleType = 'hull';
  const stations = [[-10.1, .018, .58], [-7.7, .32, .18], [-5.2, .79, -.15], [-1.4, 1.28, -.45], [2.8, 1.14, -.32], [5.7, .61, -.1], [6.7, .12, .35]];
  const vertices = [], indices = [], uv = [], sides = 12;
  for (const [x, radius, rise] of stations) for (let step = 0; step <= sides; step++) {
    const angle = step / sides * Math.PI * 2;
    vertices.push(x, rise + Math.sin(angle) * (Math.sin(angle) > 0 ? .13 : .98), Math.cos(angle) * radius); uv.push((x + 10.1) / 16.8, step / sides);
  }
  for (let row = 0; row < stations.length - 1; row++) for (let side = 0; side < sides; side++) { const a = row * (sides + 1) + side, b = a + sides + 1; indices.push(a, b, a + 1, a + 1, b, b + 1); }
  for (const [row, reverse] of [[0, false], [stations.length - 1, true]]) {
    const center = vertices.length / 3; vertices.push(stations[row][0], stations[row][2], 0); uv.push(.5, .5);
    for (let step = 0; step < sides; step++) { const a = row * (sides + 1) + step; indices.push(center, reverse ? a + 1 : a, reverse ? a : a + 1); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  mesh(body, geometry, m.darkWood, id + '-long-fractured-wood-keel');
  for (const side of [-1, 1]) {
    for (const height of [-.16, -.52, -.85]) tube(body, m.wood, id + '-thin-long-strake-' + side + '-' + height, stations.map(([x, radius, rise]) => [x, rise + height, side * radius * (height < -.6 ? .6 : .98)]), height > -.2 ? .064 : .035, 26);
    tube(body, m.metal, id + '-exposed-side-rail-' + side, [[-9.8, .59, side * .04], [-6, .36, side * .58], [-1, .18, side * 1.35], [4.7, .28, side * .91], [6.6, .42, side * .12]], .062, 26);
    for (let index = 0; index < 9; index++) {
      const x = -5.8 + index * 1.36, width = Math.max(.35, 1.28 - Math.abs(x + .5) * .1);
      beam(body, m.metal, id + '-frayed-hull-frame-' + side + '-' + index, [x, -.9, side * width * .65], [x - .24, .42, side * width], .045);
      if (index % 2 === 0) box(body, m.glow, id + '-pale-cyan-keel-fissure-' + side + '-' + index, [x - .25, -.52 + (index % 3) * .09, side * width * .96], [.72, .035, .035], [0, side * .08, -.12]);
    }
    const outerWidth = x => {
      let index = stations.findIndex(station => station[0] >= x); index = Math.max(1, index < 0 ? stations.length - 1 : index);
      const a = stations[index - 1], b = stations[index], t = THREE.MathUtils.clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
      return THREE.MathUtils.lerp(a[1], b[1], t) + .12;
    };
    for (const [index, center, length] of [[0, -4.3, 1.7], [1, -.55, 2.3], [2, 3.05, 1.9]]) {
      const points = [[center - length / 2, -.68], [center - length * .16, -.44], [center + length * .19, -.58], [center + length / 2, -.37]].map(([x, y]) => [x, y, side * outerWidth(x)]);
      tube(body, m.glow, id + '-outer-cyan-wood-fissure-' + side + '-' + index, points, .071, 18);
    }
  }
  for (let index = 0; index < 18; index++) {
    const x = -6.4 + index * .68, width = Math.max(.22, 2.35 - Math.abs(x + .8) * .22);
    box(body, index % 4 ? m.wood : m.darkWood, id + '-weathered-deck-plank-' + index, [x, .11 + Math.sin(index * 1.9) * .045, 0], [.63, .065, width], [0, 0, index % 5 === 0 ? -.035 : 0]);
  }
  return body;
}

function ghostTatter(parent, material, name, { width, height, side = 1, phase = 0, skew = .3 }) {
  const vertices = [], uv = [], indices = [], nx = 16, ny = 14;
  const ends = [.46, .88, .57, 1, .69, .35, .81, .97, .48, .76, .6, .92, .39, .84, .54, .95];
  for (let row = 0; row <= ny; row++) for (let column = 0; column <= nx; column++) {
    const u = column / nx, v = row / ny;
    vertices.push((u - .5) * width + skew * v * v, -v * height + Math.sin(u * 8 + phase) * .08 * v, side * (Math.sin(u * 9 + phase) * .065 + Math.sin(u * Math.PI) * .26 * v)); uv.push(u, 1 - v);
  }
  for (let row = 0; row < ny; row++) for (let column = 0; column < nx; column++) {
    const cut = ends[(column + phase * 3) % ends.length], v = (row + .5) / ny;
    const split = (column + phase) % 7 === 2 && v > .4 || (column + phase * 2) % 11 === 4 && v > .57;
    if (v > cut || split) continue;
    const a = row * (nx + 1) + column, b = a + nx + 1; indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return mesh(parent, geometry, material, name);
}

function tornGasbag(parent, m, id, controls) {
  const bag = group(parent, id + '-torn-linen-main-envelope', [.25, 5.15, 0]);
  bag.userData.moduleType = 'balloon';
  const length = 13.6, radius = 1.85, radial = 12, longitudinal = 28;
  const surfacePoint = (u, angle, extra = 0) => {
    const round = Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2));
    return [(u - .5) * length, Math.cos(angle) * radius * round + extra, Math.sin(angle) * radius * round * .87];
  };
  // Broad warm-grey fabric gores have actual missing faces. Ropes bridge the
  // torn portions instead of covering a solid navy cylinder with glowing lines.
  for (let gore = 0; gore < radial; gore++) {
    const verts = [], uv = [], indices = [], across = 4;
    for (let row = 0; row <= longitudinal; row++) for (let step = 0; step <= across; step++) {
      const u = .018 + row / longitudinal * .964, angle = (gore + step / across * .96) / radial * Math.PI * 2;
      const point = surfacePoint(u, angle, .032 * Math.sin(row * 1.3 + gore) * Math.sin(u * Math.PI)); verts.push(...point); uv.push(u, step / across);
    }
    for (let row = 0; row < longitudinal; row++) for (let step = 0; step < across; step++) {
      const lowerSide = gore >= 2 && gore <= 9, broadTear = lowerSide && (row > 5 && row < 10 && gore % 3 !== 0 || row > 16 && row < 23 && gore % 4 === 0), tooth = lowerSide && row % 7 === 2 && step % 2 === 0;
      const upperMissingPanel = gore === 0 && row >= 10 && row <= 16 || gore === 1 && row >= 12 && row <= 18 || gore === 11 && row >= 7 && row <= 12;
      if (broadTear || tooth || upperMissingPanel) continue;
      const a = row * (across + 1) + step, b = a + across + 1; indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    mesh(bag, geometry, gore % 4 === 0 ? m.ivory : m.gray, id + '-ripped-grey-linen-gore-' + gore);
    tube(bag, m.rope, id + '-weathered-envelope-long-seam-' + gore, sequence(27, i => surfacePoint(.025 + i / 26 * .95, gore / radial * Math.PI * 2, .055)), .028, 26);
  }
  for (let band = 1; band < 7; band++) {
    const u = band / 7; tube(bag, m.rope, id + '-loose-envelope-net-hoop-' + band, sequence(33, i => surfacePoint(u, i / 32 * Math.PI * 2, .035)), .03, 32);
  }
  for (const side of [-1, 1]) for (let index = 0; index < 6; index++) {
    const phase = index + (side > 0 ? 1 : 0), lengths = [1.65, 3.65, 2.15, 4.05, 1.35, 2.8], widths = [1.05, 1.4, .85, 1.6, 1, 1.3];
    const sail = group(bag, id + '-broad-shredded-envelope-cover-' + side + '-' + index, [-5.3 + index * 1.85, -.1 - (index % 2) * .27, side * 1.38], [side * .08, 0, [-.19, .12, -.06, .23, .04, -.14][index]]);
    ghostTatter(sail, index % 3 ? m.gray : m.ivory, id + '-hanging-linen-hole-fringe-' + side + '-' + index, { width: widths[index], height: lengths[(index + (side > 0 ? 2 : 0)) % lengths.length], side, phase, skew: index % 2 ? -.35 : .28 });
    control(controls, sail, 'sail', 'z', .024 + index % 3 * .006);
  }
  control(controls, bag, 'envelope', 'y', .006);
  return bag;
}

export function buildGhostChaser(ctx) {
  const { id, motion, controls } = ctx, m = { ...ctx.m, glow: ctx.m.coldGlow || ctx.m.glow }, body = spearHull(motion, m, id), bag = tornGasbag(motion, m, id, controls);
  const connector = group(body, id + '-exposed-midship-connector', [-.6, .22, -1.29]);
  connector.userData.moduleType = 'connector';
  for (const x of [-.85, .85]) beam(connector, m.metal, id + '-connector-vertical-' + x, [x, -.12, 0], [x, 1.15, 0], .12);
  for (const y of [0, .95]) beam(connector, m.metal, id + '-connector-horizontal-' + y, [-1, y, 0], [1, y, 0], .115);
  beam(connector, m.brass, id + '-weathered-connector-diagonal', [-.85, .06, -.02], [.85, 1, -.02], .054);
  box(connector, m.glow, id + '-exposed-connector-memory-crack', [0, .51, -.06], [.86, .046, .046], [0, 0, .42]);
  const propulsion = engine(motion, m, id + '-exposed-aft-propulsion', { at: [6.35, -.13, 0], scale: .89 }, controls);
  for (const side of [-1, 1]) for (let post = 0; post < 4; post++) {
    const x = -4.7 + post * 2.7;
    tube(motion, m.rope, id + '-sagging-suspension-' + side + '-' + post, [[x, .31, side * .85], [x + .23, 2.6, side * 1.4], [x + .4, 4.3, side * 1.42]], .035, 14);
    if (post < 3) {
      const fringe = group(body, id + '-lower-ragged-sail-' + side + '-' + post, [x + .3, -.4, side * .86], [side * .11, 0, post % 2 ? -.16 : .13]);
      ghostTatter(fringe, post % 2 ? m.gray : m.ivory, id + '-lower-linen-tatter-' + side + '-' + post, { width: [1.5, 1.15, 1.8][post], height: [1.5, 3.05, 2.1][(post + (side > 0 ? 1 : 0)) % 3], side, phase: post + 2, skew: post % 2 ? -.42 : .37 });
      control(controls, fringe, 'sail', 'x', .035);
    }
  }
  for (const [index, at] of [[0, [-4.9, -1.1, -.63]], [1, [2.6, -1.15, .72]], [2, [-.7, -1.55, -1.4]]]) {
    const holder = group(body, id + '-memory-lantern-hanger-' + index, at); beam(holder, m.metal, id + '-lantern-chain-' + index, [0, .42, 0], [0, -.3, 0], .027); lantern(holder, m, id + '-pale-lantern-' + index, [0, -.5, 0], .25);
  }
  for (const side of [-1, 1]) ribbon(body, m.gray, id + '-long-wind-torn-bow-ribbon-' + side, [[-8.9, .35, side * .12], [-6.4, .26, side * .35], [-3.8, .03, side * .4]], .34, true);
  motion.userData.referenceAppearance = 'grey ragged linen and wooden spear; pale cyan only in narrow cracks and lanterns';
  return {
    artModules: { balloons: 1, engines: 1, cannons: 0, machineGuns: 0, harpoons: 0, winches: 0, sail: 18 },
    weakpoints: [{ id: id + ':side-connector', nodeName: connector.name, label: '노출 측면 연결 골조', kind: 'connector' }, { id: id + ':engine', nodeName: propulsion.name, label: '후방 노출 추진부', kind: 'engine' }],
    features: ['very-long-sharp-wooden-spear', 'broad-torn-grey-linen-envelope', 'actual-gaps-between-fabric-gores', 'three-missing-upper-gore-sections', 'irregular-separated-linen-strips-with-deep-tears', 'exposed-midship-connector', 'six-outer-pale-cyan-wood-fissures-and-lanterns'],
    referenceNotes: '첨부5번의 긴 창끝 선체·회색 누더기 기낭과 하부천을 참고한 독립 외형. 남색 로켓 실린더 대신 목재 골조와 넓은 린넨 면을 사용한다. source modules는 미정이며 기낭1/엔진1/천 조각 수는 제작 배치다. 실제 돌진 예고·이동·연결부 피해는 미구현.',
  };
}

function camouflageWing(ctx, side) {
  const { id, motion, m, controls } = ctx, wing = group(motion, id + '-camouflage-fold-' + (side < 0 ? 'port' : 'starboard'), [0, -.25, side * 1.43]);
  Object.assign(wing.userData, { featureId: 'camouflage-fold', deploymentAxis: 'x', deployedAngle: side * 1.35, gameplayStateAuthority: 'none; animation demonstration only' });
  // Bent ribs describe a sagging rounded hulk, not a second combat ship. The
  // canopy panels all inherit a side hinge so deployment can uncover the boat.
  for (let index = 0; index < 6; index++) {
    const x = -4.2 + index * 1.62, archHeight = 4.9 + Math.sin(index * .85) * .65;
    tube(wing, index % 2 ? m.darkWood : m.wood, id + '-broken-rib-arch-' + side + '-' + index, [[x, -.7, side * 1.25], [x - .26, 1.6, side * 2.48], [x + .28, archHeight - 1.1, side * 2], [x -.55, archHeight, side * .45], [x -.9, archHeight - .34, -side * .66]], .12, 18);
    beam(wing, m.brass, id + '-rib-strap-' + side + '-' + index, [x, .43, side * 1.91], [x -.18, 1.1, side * 2.18], .046);
  }
  for (let row = 0; row < 3; row++) for (let index = 0; index < 8; index++) {
    const x = -4.3 + index * 1.24, y = .65 + row * 1.06 + (index % 3) * .13, z = side * (2.17 - row * .18);
    box(wing, (row + index) % 3 ? m.wood : m.darkWood, id + '-collapsed-shell-plank-' + side + '-' + row + '-' + index, [x, y, z], [1.65, .12, .35], [side * .23, index % 2 ? .17 : -.1, .17 * Math.sin(index * 1.6)]);
    if (index % 2) beam(wing, m.rope, id + '-diagonal-plank-tie-' + side + '-' + row + '-' + index, [x -.6, y -.13, z + side * .04], [x + .6, y + .24, z + side * .05], .025);
  }
  for (let index = 0; index < 7; index++) {
    const x = -4.6 + index * 1.48;
    tube(wing, m.rope, id + '-loose-shell-net-vertical-' + side + '-' + index, [[x, -.7, side * 1.52], [x + .13, 1.4, side * 2.5], [x -.29, 3.6, side * 1.7], [x -.1, 5.05, side * .22]], .031, 16);
    if (index < 6) {
      const rag = group(wing, id + '-dirty-wrap-root-' + side + '-' + index, [x + .4, 3.5 + index % 2 * .63, side * 1.8]);
      cloth(rag, index % 2 ? m.gray : m.canvas, id + '-dirty-ragged-camouflage-canvas-' + side + '-' + index, { width: 1.84, height: 2.7 + index % 3 * .4, ragged: true, rotation: [side * .12, 0, index % 2 ? .14 : -.12], billow: side * .46 });
    }
  }
  for (let row = 0; row < 4; row++) tube(wing, m.rope, id + '-sagging-shell-net-long-' + side + '-' + row, sequence(15, i => [-4.8 + i / 14 * 10, .4 + row * .95 + Math.sin(i * .8) * .18, side * (2.5 - row * .2)]), .028, 20);
  for (let index = 0; index < 5; index++) box(wing, m.darkWood, id + '-jutting-broken-timber-' + side + '-' + index, [-4 + index * 2.1, 3.6 + index % 2, side * 1.15], [2.55, .18, .24], [side * .7, side * .32, index % 2 ? -.48 : .61]);
  control(controls, wing, 'sail', 'x', .008, { deployment: true, deployAngle: side * 1.35 });
  return wing;
}

export function buildDisguisedWreck(ctx) {
  const { id, motion, m, controls } = ctx;
  const boat = hull(motion, m, id + '-hidden-low-wooden-hull', { length: 8.9, width: 2.8, depth: 1.45, at: [.1, -.25, 0], bow: .42, style: 'wood' });
  const envelope = group(motion, id + '-hidden-low-cream-envelope', [.5, 2.05, 0]);
  sphere(envelope, m.canvas, id + '-compact-cream-gasbag', [0, 0, 0], [3.32, 1.13, 1.1], 24);
  for (let index = 0; index < 7; index++) {
    const x = -2.7 + index * .9, cross = Math.sqrt(Math.max(0, 1 - (x / 3.35) ** 2));
    tube(envelope, m.rope, id + '-inner-envelope-hoop-' + index, sequence(25, i => [x, Math.cos(i / 24 * Math.PI * 2) * 1.14 * cross, Math.sin(i / 24 * Math.PI * 2) * 1.12 * cross]), .027, 24);
  }
  for (const side of [-1, 1]) tube(envelope, m.rope, id + '-inner-envelope-long-net-' + side, [[-3.2, 0, 0], [-2, .82, side * .59], [0, 1.05, side * .58], [2.5, .6, side * .42], [3.3, 0, 0]], .025, 22);
  control(controls, envelope, 'envelope', 'y', .008);
  for (const side of [-1, 1]) {
    beam(motion, m.wood, id + '-inner-gasbag-support-' + side, [-1.5, 0, side * 1], [-1.15, 1.35, side * .92], .065);
    beam(motion, m.rope, id + '-inner-gasbag-rope-' + side, [2.6, .1, side * .82], [2.4, 1.55, side * .66], .032);
  }
  const propulsor = engine(motion, m, id + '-concealed-rear-engine', { at: [4.15, -.13, 0], scale: 1.05 }, controls);
  const guns = [];
  for (const side of [-1, 1]) guns.push(cannon(motion, m, id + '-hidden-broadside-cannon-' + side, { at: [-1.8, .22, side * 1.14], scale: .92, rotation: [0, side * Math.PI / 2, 0], kind: 'cannon' }, controls));
  const folds = [-1, 1].map(side => camouflageWing(ctx, side));
  const forwardCurtain = group(motion, id + '-camouflage-fold-bow-curtain', [-4.5, 3.2, 0]);
  cloth(forwardCurtain, m.gray, id + '-broken-forward-canvas-curtain', { width: 4.3, height: 3.3, ragged: true, rotation: [0, Math.PI / 2, -.1], billow: .45 });
  Object.assign(forwardCurtain.userData, { featureId: 'camouflage-fold', deploymentAxis: 'z', deployedAngle: -1.2, gameplayStateAuthority: 'none; animation demonstration only' });
  control(controls, forwardCurtain, 'sail', 'z', .012, { deployment: true, deployAngle: -1.2 }); folds.push(forwardCurtain);
  for (let index = 0; index < 7; index++) {
    const angle = index * Math.PI * 2 / 7;
    beam(motion, m.wood, id + '-discarded-under-keel-timber-' + index, [Math.cos(angle) * 3.4, -1.6, Math.sin(angle) * 2.7], [Math.cos(angle) * 4.6, -2.3 - index % 2 * .6, Math.sin(angle) * 3.4], .095);
  }
  for (let index = 0; index < 3; index++) {
    const x = -3 + index * 2.4; box(motion, m.darkWood, id + '-underslung-junk-chest-' + index, [x, -1.75, index % 2 ? .7 : -.7], [1.05, .8, .85], [0, index * .17, 0]);
    for (const z of [-.44, .44]) beam(motion, m.rope, id + '-crate-sling-' + index + '-' + z, [x -.7, -.5, z], [x, -2.15, z], .035);
  }
  lantern(motion, m, id + '-dim-warning-lantern', [-2.8, -.85, -1.28], .23);
  return {
    artModules: { balloons: 1, engines: 1, cannons: 2, machineGuns: 0, winches: 0, sail: 13 },
    weakpoints: [{ id: id + ':engine', nodeName: propulsor.name, label: '전개 후 드러나는 후방 추진부', kind: 'engine' }, ...guns.map((gun, index) => ({ id: id + ':cannon-' + index, nodeName: gun.name, label: '위장 외피 안의 함포', kind: 'cannon' }))],
    features: ['rounded-collapsed-wooden-rib-hulk', 'dirty-rag-and-rope-net-shell', 'low-cream-envelope-inside', 'folding-side-camouflage-bones', 'hidden-broadside-cannons', 'exposed-engine-after-deployment'],
    deployRig: { nodeNames: folds.map(node => node.name), description: '좌우 외피는 각 local X축 ±1.35rad, 선수 천은 local Z축 -1.2rad로 펼치는 표시용 뼈대다. 위장/기동의 실제 AI·충돌·피해 전환은 연결하지 않는다.' },
    referenceNotes: '첨부6번의 둥근 폐목재 갈빗대·처진 로프망·더러운 천 위장 아래 작은 크림 기낭과 목재 함선이 숨어 있는 독립 해석. 리그 전개는 시각 시범용이며 실제 잔해 잠복·기습 조건/공격 예고·피해는 미구현. 원본 modules=null을 기낭1/함포2의 정사 확정으로 변경하지 않는다.',
  };
}
