import { THREE, group, box, sphere, beam, tube, ring, cone, cloth, gear, jaw, lantern } from './core.js';

// Separate visual proposal. No source module, AI, collision or equipment counts change.
const IDS = new Set([
  'mission-cult-purifier', 'mini-funeral-guard', 'boss-bell-devourer',
  'boss-shipyard-ribs', 'boss-shipwright-command', 'boss-last-inhale',
]);

function sourcePoint(ctx, name, point, fallback) {
  // Read the existing bind pose, including its source scale. This keeps added
  // ornament wrapped around one landmark rather than creating a second one.
  const source = (ctx.sourceScene || ctx.root.parent)?.getObjectByName(name);
  if (!source) return [...fallback];
  ctx.root.updateWorldMatrix(true, true);
  const position = source.localToWorld(new THREE.Vector3(...point));
  return ctx.root.worldToLocal(position).toArray();
}

function paintedMesh(parent, geometry, mat, name, at = [0, 0, 0], rot = [0, 0, 0]) {
  const node = new THREE.Mesh(geometry, mat);
  node.name = name; node.position.fromArray(at); node.rotation.fromArray(rot);
  node.userData = { visualOnly: true, designLayer: 'villain-v1' };
  parent.add(node); return node;
}

function shield(parent, m, name, at, width = 2, height = 3, rot = [0, 0, 0]) {
  const root = group(parent, name, at, rot);
  const shape = new THREE.Shape();
  shape.moveTo(-width * .5, height * .4); shape.lineTo(-width * .47, -height * .18);
  shape.lineTo(0, -height * .6); shape.lineTo(width * .47, -height * .18);
  shape.lineTo(width * .5, height * .4); shape.lineTo(0, height * .57); shape.closePath();
  paintedMesh(root, new THREE.ExtrudeGeometry(shape, { depth: .18, bevelEnabled: true, bevelSize: .08, bevelThickness: .04, bevelSegments: 1 }), m.ink, name + '-iron-face');
  const border = [[-.5, .4], [-.47, -.18], [0, -.6], [.47, -.18], [.5, .4], [0, .57], [-.5, .4]].map(([x, y]) => [x * width, y * height, .23]);
  tube(root, m.brass, name + '-brass-seam', border, .075, 30);
  box(root, m.ivory, name + '-seal-stripe', [0, .02, .25], [.18, height * .58, .05]);
  ring(root, m.red, name + '-wax-seal', [0, height * .18, .31], width * .13, .12, 'z');
  return root;
}

function chain(parent, m, name, a, b, links = 7) {
  const start = new THREE.Vector3(...a), delta = new THREE.Vector3(...b).sub(start);
  for (let i = 0; i < links; i++) {
    const p = start.clone().addScaledVector(delta, i / Math.max(links - 1, 1));
    ring(parent, m.iron, name + '-link-' + i, p.toArray(), .14, .045, i % 2 ? 'z' : 'x');
  }
}

function bell(parent, m, name, at, radius = 1, height = 1.8) {
  const root = group(parent, name, at);
  // A hollow, open lip, rather than a solid cone. The void is visible from below.
  const outline = [[.98, 0], [1.03, .08], [.93, .2], [.76, .38], [.61, .73], [.52, .9], [.25, 1], [.19, 1.06], [.12, 1.06]];
  const points = outline.map(([x, y]) => new THREE.Vector2(x * radius, y * height));
  paintedMesh(root, new THREE.LatheGeometry(points, 28), m.brass, name + '-hollow-brass-body');
  ring(root, m.ink, name + '-lower-lip', [0, .08, 0], radius, .1, 'y');
  ring(root, m.brass, name + '-raised-lip', [0, .18, 0], radius * .96, .055, 'y');
  beam(root, m.iron, name + '-clapper-stem', [0, height * .9, 0], [0, -.04, 0], radius * .07);
  sphere(root, m.red, name + '-red-clapper', [0, -.08, 0], [radius * .24, radius * .3, radius * .24], 14);
  ring(root, m.iron, name + '-hanger', [0, height * 1.2, 0], radius * .23, .08, 'z');
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    beam(root, m.ink, name + '-engraved-gore-' + i, [Math.cos(a) * radius * .94, height * .2, Math.sin(a) * radius * .94], [Math.cos(a) * radius * .55, height * .82, Math.sin(a) * radius * .55], radius * .018);
  }
  return root;
}

function censer(parent, m, name, at, scale = 1) {
  const root = group(parent, name, at); root.scale.setScalar(scale);
  sphere(root, m.ink, name + '-lower-bowl', [0, .25, 0], [1.05, .64, 1.05]);
  ring(root, m.brass, name + '-hot-lip', [0, .58, 0], 1.03, .12, 'y');
  sphere(root, m.glow, name + '-ember-pot', [0, .74, 0], [.68, .55, .68], 14);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    tube(root, m.iron, name + '-cage-rib-' + i, [[Math.cos(a), .55, Math.sin(a)], [Math.cos(a) * .94, 1.4, Math.sin(a) * .94], [Math.cos(a) * .3, 2, Math.sin(a) * .3]], .075, 12);
  }
  cone(root, m.ink, name + '-incense-cap', [0, 2.03, 0], .55, .53, [0, 0, 0], 8);
  ring(root, m.brass, name + '-lifting-halo', [0, 2.47, 0], .3, .08, 'z');
  for (let j = 0; j < 3; j++) {
    const x = (j % 2 ? -.18 : .14), y = 2.6 + j * .42;
    sphere(root, j % 2 ? m.cold : m.cloth, name + '-painted-incense-' + j, [x, y, .03], [.29 + j * .1, .33, .3 + j * .08], 10);
  }
  return root;
}

function coffin(parent, m, name, at, scale = 1, rot = [0, 0, 0]) {
  const root = group(parent, name, at, rot); root.scale.setScalar(scale);
  box(root, m.darkWood, name + '-long-casket', [0, 0, 0], [3.3, .66, 1.18]);
  box(root, m.ink, name + '-sloped-lid', [0, .48, 0], [3.48, .38, 1.34], [0, 0, -.025]);
  for (const x of [-1.18, 0, 1.18]) {
    box(root, m.brass, name + '-binding-' + x, [x, .28, 0], [.14, 1, 1.44]);
    for (const side of [-1, 1]) ring(root, m.brass, name + '-handle-' + x + '-' + side, [x, -.05, side * .75], .17, .05, 'z');
  }
  cloth(root, m.red, name + '-mourning-runner', { at: [0, .72, -.02], width: 2.7, height: 1, rotation: [Math.PI / 2, 0, 0], billow: .03 });
  return root;
}

function cage(parent, m, name, at, size = [2, 2.4, 1.8]) {
  const root = group(parent, name, at), [w, h, d] = size;
  box(root, m.darkWood, name + '-floor', [0, 0, 0], [w + .2, .2, d + .2]);
  box(root, m.ink, name + '-roof', [0, h, 0], [w + .3, .23, d + .3]);
  for (const side of [-1, 1]) for (let j = 0; j < 5; j++) {
    const x = (j / 4 - .5) * w;
    beam(root, m.iron, name + '-front-bar-' + side + '-' + j, [x, .1, side * d / 2], [x, h, side * d / 2], .055);
  }
  for (const side of [-1, 1]) for (const z of [-d / 2, 0, d / 2]) beam(root, m.brass, name + '-side-bar-' + side + '-' + z, [side * w / 2, .1, z], [side * w / 2, h, z], .055);
  lantern(root, m, name + '-watchlight', [0, h + .7, 0], .42);
  return root;
}

function addPurifier(ctx, root, n) {
  const { m, features } = ctx;
  // Tall ritual arch and low enormous hot pots are the readable primary masses.
  for (const x of [-3.7, 3.7]) {
    tube(root, m.ink, n('seal-arch-' + x), [[x, .2, -3.3], [x, 5.5, -3.5], [x, 8.6, -1.9], [x, 9.3, 0], [x, 8.6, 1.9], [x, 5.5, 3.5], [x, .2, 3.3]], .32, 26);
    tube(root, m.brass, n('arch-gold-seam-' + x), [[x - .32, 1.1, -3.5], [x - .32, 6, -3.6], [x - .32, 8.8, -1.8], [x - .32, 9.6, 0], [x - .32, 8.8, 1.8], [x - .32, 6, 3.6], [x - .32, 1.1, 3.5]], .075, 26);
  }
  beam(root, m.brass, n('high-processional-spine'), [-4, 9.3, 0], [4, 9.3, 0], .2);
  for (const side of [-1, 1]) {
    cloth(root, m.ivory, n('immense-judgement-curtain-' + side), { at: [0, 8.75, side * 2.65], width: 7.2, height: 3.15, billow: side * .52, ragged: true });
    cloth(root, m.red, n('blood-red-center-vow-' + side), { at: [.45, 8.9, side * 2.78], width: .76, height: 3.45, billow: side * .56 });
    for (let i = 0; i < 3; i++) {
      const x = -4.7 + i * 4.1, z = side * 3.7;
      censer(root, m, n('huge-purification-censer-' + side + '-' + i), [x, -.2, z], i === 1 ? 1.3 : 1.03);
      chain(root, m, n('censer-hanger-' + side + '-' + i), [x, 4.5, z], [x, 2.8, z], 6);
    }
  }
  shield(root, m, n('beaked-inquisitor-face'), [-8.65, 2.4, 0], 4.3, 4.4, [0, -Math.PI / 2, 0]);
  jaw(root, m, n('execution-prong'), [-9.2, .6, 0], 3.5, 2.7, [0, 0, 0]);
  const chimney = group(root, n('unequal-pressure-chimney'), [5.4, 1.5, -2.3], [0, 0, -.08]);
  box(chimney, m.ink, n('tall-square-stack'), [0, 3.2, 0], [1.35, 6.4, 1.4]);
  for (const y of [1, 3.6, 5.9]) box(chimney, m.brass, n('chimney-collar-' + y), [0, y, 0], [1.6, .24, 1.65]);
  features.push('거대한 심문 아치와 찢긴 흰 봉인 장막', '좌우 대형 향로 탱크 열과 붉은 잿불', '길게 늘어진 진홍 서약 천', '선수의 가면형 방패와 집행 집게', '비대칭 검은 압력 굴뚝과 황동 띠');
}

function addFuneralGuard(ctx, root, n) {
  const { m, features } = ctx;
  box(root, m.darkWood, n('hearse-raised-coach'), [.2, 1.75, 0], [9.4, .65, 4]);
  coffin(root, m, n('display-casket'), [-.5, 2.4, 0], 1.66);
  // Four oversized procession wheels distinguish the guard from the open bell warship.
  for (const x of [-4.5, 4.4]) for (const side of [-1, 1]) {
    const wheel = group(root, n('procession-wheel-' + x + '-' + side), [x, .55, side * 2.9]);
    ring(wheel, m.ink, n('wheel-heavy-tire-' + x + '-' + side), [0, 0, 0], 1.75, .3, 'z');
    ring(wheel, m.brass, n('wheel-trim-' + x + '-' + side), [0, 0, side * .18], 1.57, .08, 'z');
    sphere(wheel, m.red, n('wheel-wax-hub-' + x + '-' + side), [0, 0, 0], [.36, .36, .24]);
    for (let j = 0; j < 8; j++) {
      const a = j * Math.PI / 4;
      beam(wheel, m.iron, n('wheel-spoke-' + x + '-' + side + '-' + j), [0, 0, 0], [Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0], .09);
    }
  }
  for (const side of [-1, 1]) {
    tube(root, m.ink, n('hearse-sweeping-canopy-' + side), [[4.6, 1.8, side * 2], [4.2, 6.4, side * 2.2], [1.7, 7.9, side * 2.3], [-3.4, 7.3, side * 2]], .25, 22);
    cloth(root, m.ink, n('long-mourning-drape-' + side), { at: [1.1, 7.2, side * 2.15], width: 6.7, height: 2.5, billow: side * .55, ragged: true });
    cloth(root, m.red, n('mourning-silk-lining-' + side), { at: [1.1, 7.06, side * 2.24], width: 6.1, height: 1.15, billow: side * .6, ragged: true });
    lantern(root, m, n('coach-grave-lantern-' + side), [-5.6, 4.6, side * 2.5], .72);
  }
  beam(root, m.brass, n('small-bell-gallows'), [-6.2, 4, 0], [-6.2, 7.2, 0], .13);
  bell(root, m, n('escort-death-bell'), [-6.2, 4.2, 0], 1.15, 1.7);
  shield(root, m, n('coffin-coach-bow'), [-8.4, 1.8, 0], 3.5, 3.2, [0, -Math.PI / 2, 0]);
  features.push('거대한 차륜 4개의 장례 집행 마차', '중앙에 높게 드러난 황동 결박 관', '앞으로 휘어지는 검은 차양과 진홍 안감', '대형 전함과 구분되는 작은 사형 종', '길을 비추는 한 쌍의 묘지 등과 가면 방패');
}

function addBellDevourer(ctx, root, n) {
  const { m, features } = ctx;
  // Source Bell's lip is -.98 in its own 4.8x local scale. Align the larger
  // hollow bell and its whole open hall to that lip, not the model's min-Y.
  const lip = sourcePoint(ctx, ctx.id + '-bell-1_Bell', [0, -.98, 0], [0, 2.9, 0]);
  root.position.set(lip[0], lip[1] - 2.9, lip[2]);
  root.userData.sourceAnchor = ctx.id + '-bell-1_Bell';
  root.userData.ornamentAlignment = 'existing bell lip; no second bell chamber';
  // Leave both long sides open. The empty chamber and its bell are the landmark.
  for (const x of [-4.5, 4.5]) for (const side of [-1, 1]) {
    box(root, m.ink, n('great-open-hall-pier-' + x + '-' + side), [x, 4.5, side * 3.4], [.7, 8.1, .72]);
    beam(root, m.brass, n('cathedral-gold-pier-' + x + '-' + side), [x - .38, 1, side * 3.4], [x - .38, 8.6, side * 3.4], .08);
    tube(root, m.iron, n('open-hall-flying-buttress-' + x + '-' + side), [[x * 1.55, .5, side * 4.7], [x * 1.5, 3.8, side * 4.5], [x, 8.4, side * 3.4]], .22, 18);
    cloth(root, m.ivory, n('narrow-sealed-pier-drape-' + x + '-' + side), { at: [x, 8.2, side * 3.85], width: .95, height: 5, billow: side * .2, ragged: true });
  }
  for (const x of [-4.5, 4.5]) {
    tube(root, m.ink, n('massive-roof-arch-' + x), [[x, 8.4, -3.4], [x, 10.5, -1.4], [x, 11, 0], [x, 10.5, 1.4], [x, 8.4, 3.4]], .42, 20);
    cone(root, m.brass, n('roof-votive-crown-' + x), [x, 11.5, 0], .64, 1.4, [0, Math.PI / 4, 0], 4);
  }
  beam(root, m.ink, n('whole-hall-ridge'), [-5.2, 10.9, 0], [5.2, 10.9, 0], .45);
  bell(root, m, n('colossal-swallowed-bell'), [0, 2.9, 0], 3.05, 4.9);
  chain(root, m, n('great-bell-suspension'), [0, 10.3, 0], [0, 9, 0], 6);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) shield(root, m, n('hanging-funeral-plate-' + side + '-' + i), [-6 + i * 4, .15, side * 4.05], 2.65, 3.5, [0, side < 0 ? Math.PI : 0, 0]);
    cloth(root, m.red, n('cathedral-tail-banner-' + side), { at: [6.1, 8.2, side * 2.9], width: 2.4, height: 5.5, billow: side * .45, ragged: true });
    lantern(root, m, n('funeral-flame-lantern-' + side), [-7.2, 3.3, side * 3.9], .9);
  }
  jaw(root, m, n('black-dreadnought-bow'), [-9.2, .8, 0], 5.4, 4.1, [0, 0, 0]);
  features.push('열린 거대 종실과 공중에 매단 초대형 속 빈 종', '높게 솟은 장례 성당 능선과 황동 관', '선체 바깥으로 벌어진 육중한 버팀벽', '하단에 늘어선 대형 관 모양 방패', '긴 진홍 장례기와 짐승턱 선수', '종실 양옆을 막지 않는 흰 봉인 천');
}

function addShipyard(ctx, root, n) {
  const { m, features } = ctx;
  // An enormous animal-like cage, with a deliberately empty dry dock in its center.
  for (let i = 0; i < 7; i++) {
    const x = -8.1 + i * 2.7, tall = 8.7 + Math.sin(i / 6 * Math.PI) * 1.6;
    for (const side of [-1, 1]) {
      tube(root, m.ivory, n('great-jail-rib-' + i + '-' + side), [[x, -.3, side * 4.7], [x - .2, 2.7, side * 5.15], [x - .4, 6.2, side * 4.2], [x - .65, tall, side * 1.9], [x - .9, tall + .3, side * .75]], .27, 22);
      tube(root, m.ink, n('rib-iron-cuff-' + i + '-' + side), [[x - .15, 2.1, side * 5.02], [x - .24, 3.5, side * 5.08], [x - .3, 4.3, side * 4.82]], .38, 10);
      beam(root, m.brass, n('dock-jail-lower-rail-' + i + '-' + side), [x, .25, side * 4.7], [x + 2.1, .25, side * 4.7], .14);
    }
  }
  for (const side of [-1, 1]) {
    beam(root, m.iron, n('lengthwise-cage-spine-' + side), [-8.5, 7.3, side * 3.6], [8.4, 7.3, side * 3.6], .23);
    cage(root, m, n('suspended-work-prison-' + side), [-2.9, -1.5, side * 5.6], [3.2, 2.4, 1.8]);
    chain(root, m, n('prison-hoist-chain-' + side), [-2.9, 5.5, side * 5.6], [-2.9, 1, side * 5.6], 12);
    cloth(root, m.red, n('rusty-warning-cloth-' + side), { at: [5.5, 4.2, side * 5.25], width: 3, height: 2.6, ragged: true, billow: side * .35 });
  }
  const crane = group(root, n('unequal-bone-picking-crane'), [6.2, .6, -4.9]);
  beam(crane, m.iron, n('shipyard-crane-upright'), [0, 0, 0], [0, 10.3, 0], .3);
  beam(crane, m.brass, n('shipyard-crane-jib'), [.9, 9.8, 0], [-8.5, 10.6, 0], .26);
  beam(crane, m.iron, n('shipyard-crane-jib-brace'), [0, 5, 0], [-6.5, 10.4, 0], .17);
  chain(crane, m, n('shipyard-crane-hook-line'), [-8.2, 10.6, 0], [-8.2, 5.8, 0], 12);
  jaw(crane, m, n('shipyard-crane-bone-grabber'), [-8.2, 5.3, 0], 1.9, 2.5, [0, 0, -Math.PI / 2]);
  for (let i = 0; i < 3; i++) {
    const x = 2.7 + i * 2;
    sphere(root, m.red, n('furnace-belly-' + i), [x, -.7, 5.2], [.8, 1.2, .85], 14);
    ring(root, m.brass, n('furnace-mouth-' + i), [x, -.4, 6.05], .6, .13, 'z');
    sphere(root, m.glow, n('furnace-eye-' + i), [x, -.4, 6.04], [.42, .42, .08], 12);
  }
  shield(root, m, n('prison-dock-muzzle'), [-10.1, 1.6, 0], 5.6, 4.2, [0, -Math.PI / 2, 0]);
  features.push('빈 중앙 도크를 감싸는 거대한 짐승 같은 일곱 쌍의 감옥 늑골', '흰 뼈색 아치와 검은 철제 족쇄', '한쪽으로 튀어나온 거대 뼈 수거 크레인', '양현에 매단 감시등 달린 작업 감옥', '붉게 달궈진 세 개의 용광로와 낡은 경고 천', '선수를 막는 커다란 죄수 운송 방패');
}

function addShipwright(ctx, root, n) {
  const { m, features } = ctx;
  box(root, m.darkWood, n('command-throne-plinth'), [4.1, 2.7, 0], [6.7, 1.2, 4.6]);
  box(root, m.ink, n('high-industrial-throne'), [5.4, 5.2, 0], [3.3, 4.6, 3.4]);
  box(root, m.brass, n('throne-upper-cornice'), [5.4, 7.75, 0], [4.1, .35, 4.1]);
  for (const side of [-1, 1]) {
    box(root, m.glow, n('judging-window-' + side), [5.2, 5.8, side * 1.73], [2.4, .3, .06]);
    for (let i = 0; i < 3; i++) beam(root, m.ink, n('window-iron-slit-' + side + '-' + i), [4.3 + i * .85, 5.4, side * 1.8], [4.3 + i * .85, 6.2, side * 1.8], .09);
    shield(root, m, n('authority-face-' + side), [5.4, 3.7, side * 2.5], 2.6, 3.3, [0, side < 0 ? Math.PI : 0, 0]);
    cloth(root, m.red, n('ruler-banner-' + side), { at: [7.3, 8.1, side * 2.4], width: 1.9, height: 6.2, billow: side * .4, ragged: true });
  }
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    cone(root, m.brass, n('industrial-crown-fin-' + i), [5.4 + Math.cos(a) * 1.7, 8.8, Math.sin(a) * 1.7], .48, i % 2 ? 1.5 : 2.2, [0, 0, 0], 4);
  }
  const crane = group(root, n('giant-throne-crane'), [2.7, 1.2, -2.5]);
  gear(crane, m.brass, n('crane-root-gear'), [0, 2, 0], 1.5, 'z');
  beam(crane, m.iron, n('massive-crane-neck'), [0, 1.9, 0], [.2, 9.8, 0], .48);
  beam(crane, m.iron, n('long-black-crane-boom'), [.2, 9.8, 0], [-11.6, 11.3, 0], .34);
  beam(crane, m.brass, n('long-crane-brace'), [.2, 4.8, 0], [-8.5, 10.9, 0], .22);
  beam(crane, m.brass, n('crane-top-tension'), [.2, 12.3, 0], [-11.6, 11.3, 0], .1);
  beam(crane, m.ink, n('crane-tension-mast'), [.2, 9.8, 0], [.2, 12.4, 0], .19);
  chain(crane, m, n('industrial-execution-chain'), [-11.3, 11.2, 0], [-11.3, 4.6, 0], 17);
  jaw(crane, m, n('oversized-execution-grab'), [-11.3, 3.6, 0], 3.3, 4.1, [0, 0, -Math.PI / 2]);
  gear(root, m.ink, n('starboard-huge-dismantling-saw'), [-3.2, 1.3, 4.1], 2.55, 'z');
  gear(root, m.brass, n('saw-inner-gilded-hub'), [-3.2, 1.3, 4.25], 1.23, 'z');
  tube(root, m.red, n('oversized-red-hydraulic-hose'), [[4, 1.9, 3], [1.4, 3.2, 4.1], [-1.8, 2.5, 4.5], [-3.2, 1.3, 4.3]], .22, 18);
  for (let i = 0; i < 3; i++) {
    const x = 2.2 + i * 1.7;
    box(root, m.ink, n('unequal-worker-stack-' + i), [x, 3.3 + i * .7, 3], [.8, 3.7 + i * 1.4, .9]);
    ring(root, m.brass, n('stack-mouth-' + i), [x, 5.15 + i * 1.4, 3], .48, .11, 'y');
  }
  features.push('기체보다 길게 뻗는 거대 처형 크레인', '왕관을 쓴 고층 산업 지휘 왕좌', '반대편으로 돌출한 초대형 해체 톱니', '사슬 끝의 커다란 현수 집행 집게', '붉은 유압관과 높이가 다른 검은 연통', '세로로 긴 붉은 권력기와 좁은 감시창');
}

function addLastInhale(ctx, root, n) {
  const { m, features } = ctx;
  const heartAt = sourcePoint(ctx, ctx.id + '-sealed-heart', [0, 0, 0], [0, 4, 0]);
  const heart = group(root, n('imperial-black-heart'), heartAt);
  heart.userData.sourceAnchor = ctx.id + '-sealed-heart';
  sphere(heart, m.ink, n('sealed-black-heart-shell'), [0, 0, 0], [4.2, 4.8, 3.8], 24);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    tube(heart, m.brass, n('heart-gilded-clamp-' + i), [[c * 1.3, -4.3, s * 1.2], [c * 4.4, -1.4, s * 4], [c * 4.1, 2, s * 3.7], [c * 1.45, 4.9, s * 1.3]], .18, 22);
  }
  for (const y of [-1.8, 1.8]) {
    ring(heart, m.ivory, n('heart-pale-binding-' + y), [0, y, 0], 3.95, .23, 'y');
    ring(heart, m.red, n('heart-binding-red-seam-' + y), [0, y + .26, 0], 3.96, .06, 'y');
  }
  sphere(heart, m.glow, n('narrow-pressure-eye'), [-4.18, .8, 0], [.09, .3, 1.45], 16);
  shield(heart, m, n('imperial-heart-lock'), [-4.12, -.7, 0], 2.4, 3.3, [0, -Math.PI / 2, 0]);
  const corona = ring(heart, m.brass, n('crooked-imperial-corona'), [0, 2.9, 0], 5.4, .22, 'y');
  corona.rotation.z = -.18;
  const fallbackSites = [[6.85, 1.65, 0], [-3.43, 1.65, 5.94], [-3.43, 1.65, -5.94]];
  const sites = fallbackSites.map((fallback, i) => sourcePoint(ctx, ctx.id + '-seal-tower-' + i, [0, 0, 0], fallback));
  sites.forEach((at, i) => {
    const tower = group(root, n('great-seal-tower-' + i), at);
    tower.userData.sourceAnchor = ctx.id + '-seal-tower-' + i;
    tower.userData.ornamentAlignment = 'wrap existing tower; three visible tower sites retained';
    for (let layer = 0; layer < 4; layer++) {
      const w = 2.55 - layer * .34;
      box(tower, layer % 2 ? m.ink : m.iron, n('tower-stepped-black-layer-' + i + '-' + layer), [0, .5 + layer * 1.8, 0], [w, 1.8, w]);
      box(tower, m.brass, n('tower-golden-cornice-' + i + '-' + layer), [0, 1.35 + layer * 1.8, 0], [w + .25, .17, w + .25]);
    }
    cone(tower, m.ink, n('palace-seal-roof-' + i), [0, 8.3, 0], 1.9, 2.4, [0, Math.PI / 4, 0], 4);
    ring(tower, m.brass, n('tower-golden-key-ring-' + i), [0, 10.25, 0], .76, .12, 'z');
    cloth(tower, m.ivory, n('tower-wound-seal-cloth-' + i), { at: [0, 7.15, 1.47], width: 1.55, height: 5.9, billow: .35, ragged: true });
    cloth(tower, m.red, n('tower-seal-red-ribbon-' + i), { at: [.32, 7.3, 1.56], width: .3, height: 6.2, billow: .4 });
    const [x, y, z] = at, len = Math.hypot(x - heartAt[0], z - heartAt[2]), dx = (x - heartAt[0]) / len, dz = (z - heartAt[2]) / len;
    tube(root, m.iron, n('great-heart-conduit-' + i), [[heartAt[0] + dx * 3.9, heartAt[1] - .7, heartAt[2] + dz * 3.9], [heartAt[0] + dx * 5.6, y - .8, heartAt[2] + dz * 5.6], [x, y + 2, z]], .27, 22);
    tube(root, m.brass, n('conduit-warm-seam-' + i), [[heartAt[0] + dx * 4, heartAt[1] - .4, heartAt[2] + dz * 4], [heartAt[0] + dx * 5.65, y - .5, heartAt[2] + dz * 5.65], [x + .2, y + 2.2, z]], .065, 22);
    lantern(tower, m, n('seal-tower-watchfire-' + i), [-1.35, 3, 0], .7);
  });
  // A low enclosing ring unifies the three towers without disguising them as a ship.
  const baseY = sites.reduce((sum, at) => sum + at[1], 0) / sites.length;
  ring(root, m.ink, n('broken-palace-circulation-ring'), [heartAt[0], baseY - .5, heartAt[2]], 7.3, .38, 'y');
  for (let i = 0; i < 5; i++) {
    const a = .5 + i * Math.PI * 2 / 5;
    box(root, m.iron, n('floating-imperial-masonry-' + i), [heartAt[0] + Math.cos(a) * 8, baseY - .6, heartAt[2] + Math.sin(a) * 8], [1.4, .8, 1.3], [.1, a, .15]);
  }
  features.push('황궁의 검은 심장을 닮은 거대 봉인 구체', '높이 솟은 3개의 황동 관 봉인탑', '심장을 죄는 황동 갈비와 흰 봉합 띠', '비스듬한 거대 왕관 고리', '탑과 심장을 연결하는 육중한 굴곡 관', '찢긴 흰 봉인 천과 진홍 리본', '함선과 구별되는 저층 순환 고리와 부유 석재');
}

export function addCultBoss(ctx) {
  if (!IDS.has(ctx.id)) return false;
  const n = suffix => ctx.id + '-villain-' + suffix;
  const root = group(ctx.root, n('identity-layer'));
  root.userData = { ...root.userData, visualOnly: true, designLayer: 'villain-v1', sourceModelPreserved: true, gameplayImplemented: false };
  const build = {
    'mission-cult-purifier': addPurifier,
    'mini-funeral-guard': addFuneralGuard,
    'boss-bell-devourer': addBellDevourer,
    'boss-shipyard-ribs': addShipyard,
    'boss-shipwright-command': addShipwright,
    'boss-last-inhale': addLastInhale,
  }[ctx.id];
  build(ctx, root, n);
  return true;
}
