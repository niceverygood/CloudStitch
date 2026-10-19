import { THREE, group, box, sphere, beam, tube, ring, cone, cloth, gear, cannon, jaw, lantern } from './core.js';

// Industrial villains: local, reversible silhouette studies attached to the source hull.
// Bow is -X; dimensions are in the common 20-unit hull space. Visual fittings are
// decorative studies and do not define weapon slots, colliders, factions or stats.
const TAU = Math.PI * 2;
const INDUSTRIAL_IDS = new Set([
  'enemy-tax-cutter', 'mission-union-guard', 'mission-bridge-tug',
  'role-enemy-artillery', 'role-enemy-defense',
]);

function rivetLine(parent, mat, name, a, b, count = 5, radius = .075) {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? .5 : i / (count - 1);
    sphere(parent, mat, `${name}-${i}`, a.map((v, j) => v + (b[j] - v) * t), [radius, radius, radius], 6);
  }
}

function panel(parent, m, name, at, size, rotation = [0, 0, 0], face = 'z') {
  const g = group(parent, name, at, rotation);
  box(g, m.iron, `${name}-plate`, [0, 0, 0], size);
  if (face === 'x') {
    for (const s of [-1, 1]) {
      box(g, m.brass, `${name}-vertical-${s}`, [-size[0] * .53, 0, s * size[2] * .46], [.085, size[1] * .96, .11]);
      box(g, m.brass, `${name}-horizontal-${s}`, [-size[0] * .54, s * size[1] * .45, 0], [.085, .11, size[2] * .94]);
      rivetLine(g, m.brass, `${name}-rivets-${s}`, [-size[0] * .56, -size[1] * .38, s * size[2] * .36], [-size[0] * .56, size[1] * .38, s * size[2] * .36], 4);
    }
  } else {
    for (const s of [-1, 1]) {
      box(g, m.brass, `${name}-rail-${s}`, [0, s * size[1] * .42, size[2] * .54], [size[0] * .94, .10, .085]);
      rivetLine(g, m.brass, `${name}-rivets-${s}`, [-size[0] * .40, s * size[1] * .33, size[2] * .58], [size[0] * .40, s * size[1] * .33, size[2] * .58], 4);
    }
  }
  return g;
}

function chain(parent, m, name, points, count = 10, radius = .20) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  for (let i = 0; i < count; i++) {
    const p = curve.getPoint(i / Math.max(1, count - 1));
    ring(parent, m.iron, `${name}-${i}`, [p.x, p.y, p.z], radius, radius * .23, i % 2 ? 'x' : 'z');
  }
}

function drum(parent, m, name, at, r, length, axis = 'z') {
  const g = group(parent, name, at);
  const geometry = new THREE.CylinderGeometry(r * .88, r * .88, length, 18, 1);
  const body = new THREE.Mesh(geometry, m.darkWood || m.wood);
  body.rotation.x = axis === 'z' ? Math.PI / 2 : 0;
  body.rotation.z = axis === 'x' ? Math.PI / 2 : 0;
  body.name = `${name}-timber-core`;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  for (let i = -1; i <= 1; i++) {
    const p = axis === 'z' ? [0, 0, i * length * .46] : axis === 'x' ? [i * length * .46, 0, 0] : [0, i * length * .46, 0];
    ring(g, m.brass, `${name}-flange-${i}`, p, r * (i === 0 ? .94 : 1.10), .14, axis);
  }
  for (let i = 0; i < 7; i++) {
    const offset = (i / 6 - .5) * length * .72;
    ring(g, m.ink, `${name}-wound-cable-${i}`, axis === 'z' ? [0, 0, offset] : axis === 'x' ? [offset, 0, 0] : [0, offset, 0], r * .91, .075, axis);
  }
  return g;
}

function hook(parent, m, name, at, scale = 1, rotation = [0, 0, 0]) {
  const g = group(parent, name, at, rotation);
  tube(g, m.iron, `${name}-forged-hook`, [[0, 1.1, 0], [0, .1, 0], [.2, -.8, 0], [1.1, -1.1, 0], [1.65, -.55, 0], [1.5, .05, 0]], .18, 18);
  cone(g, m.brass, `${name}-tip`, [1.49, .12, 0], .20, .55, [0, 0, -.15], 5);
  ring(g, m.brass, `${name}-eye`, [0, 1.45, 0], .36, .12, 'z');
  g.scale.setScalar(scale);
  return g;
}

function pennant(parent, m, name, at, width, height, rotation = [0, 0, 0]) {
  const g = group(parent, name, at, rotation);
  cloth(g, m.red, `${name}-cloth`, { at: [0, 0, 0], width, height, ragged: true, billow: .3, rotation: [0, 0, 0] });
  beam(g, m.brass, `${name}-mast`, [-width * .53, -height, 0], [-width * .53, .5, 0], .07);
  // Simple original crossed stitching, not a borrowed insignia.
  beam(g, m.ivory, `${name}-stitch-a`, [-width * .25, -height * .15, .05], [width * .25, -height * .65, .05], .055);
  beam(g, m.ivory, `${name}-stitch-b`, [width * .25, -height * .15, .06], [-width * .25, -height * .65, .06], .055);
  return g;
}

function taxCutter(ctx, g, n) {
  const { m } = ctx;
  // A tax collector made into a hungry iron cashbox: the jaw is the first read.
  const maw = group(g, `${n}confiscation-maw`, [-9.2, 2.7, 0]);
  panel(maw, m, `${n}upper-ledger-jaw`, [-.9, .8, 0], [3.6, .7, 7.5], [0, 0, -.12], 'x');
  panel(maw, m, `${n}lower-ledger-jaw`, [-1.25, -1.25, 0], [4.4, .75, 8.1], [0, 0, .15], 'x');
  for (let i = 0; i < 7; i++) {
    const z = (i - 3) * 1.07;
    cone(maw, m.ivory, `${n}upper-tooth-${i}`, [-2.3, .08, z], .30, 1.35, [Math.PI, 0, 0], 4);
    cone(maw, m.brass, `${n}lower-tooth-${i}`, [-2.9, -.55, z + .1], .34, 1.5, [0, 0, .15], 4);
  }
  for (const side of [-1, 1]) {
    gear(maw, m.iron, `${n}jaw-hinge-${side}`, [.25, -.2, side * 3.55], .94, 'z');
    beam(g, m.iron, `${n}jaw-piston-${side}`, [-5.3, 3.9, side * 2.3], [-10.5, 1.1, side * 3.65], .22);
    box(g, m.brass, `${n}angry-brow-${side}`, [-10.7, 4.9, side * 2.2], [.65, .3, 2.1], [side * .15, 0, side * .2]);
    box(g, m.glow, `${n}ledger-eye-${side}`, [-10.77, 4.55, side * 2.15], [.22, .27, 1.2]);
    panel(g, m, `${n}cashbox-flank-${side}`, [-3, 2.9, side * 3.35], [6.8, 2.55, .35], [0, side < 0 ? Math.PI : 0, -.08]);
  }
  // Enormous crooked balance carries a sealed debt rather than a fantasy weapon.
  beam(g, m.darkWood || m.wood, `${n}balance-mast`, [2.1, 4, .7], [2.1, 11.6, .7], .27);
  beam(g, m.brass, `${n}crooked-balance`, [-1.7, 11.4, .7], [6.2, 9.8, .7], .24);
  sphere(g, m.brass, `${n}balance-knuckle`, [2.1, 10.62, .7], [.59, .59, .59], 10);
  chain(g, m, `${n}hanging-shackle-chain`, [[-1.7, 11.4, .7], [-1.75, 9.4, .7], [-1.5, 7.3, .7]], 11, .23);
  ring(g, m.iron, `${n}oversized-shackle`, [-1.5, 6.5, .7], .96, .20, 'z');
  box(g, m.brass, `${n}shackle-lock`, [-1.5, 5.7, .7], [1.5, .65, .52]);
  chain(g, m, `${n}balance-weight-chain`, [[6.2, 9.8, .7], [6.35, 8, .7], [6.6, 6.3, .7]], 10, .22);
  sphere(g, m.iron, `${n}debt-counterweight`, [6.6, 5.4, .7], [1.2, 1.3, 1.2], 10);
  ring(g, m.brass, `${n}counterweight-band`, [6.6, 5.4, .7], 1.24, .13, 'y');
  const ledger = group(g, `${n}sealed-tax-ledger`, [4.5, 4.5, -3.8], [0, -.13, -.12]);
  box(ledger, m.darkWood || m.wood, `${n}ledger-book`, [0, 0, 0], [2.9, 3.7, .6]);
  box(ledger, m.ivory, `${n}ledger-pages`, [0, 0, .37], [2.6, 3.35, .12]);
  box(ledger, m.red, `${n}seal-ribbon`, [.5, 0, .46], [.5, 4.2, .10]);
  sphere(ledger, m.red, `${n}wax-seal`, [.5, -.6, .64], [.67, .67, .2], 10);
  box(ledger, m.brass, `${n}wax-sign`, [.5, -.6, .86], [.12, .65, .08], [0, 0, -.28]);
  lantern(g, m, `${n}tax-searchlight`, [-8.6, 5.8, -3.5], .85);
  pennant(g, m, `${n}impound-banner`, [5.8, 8.8, -2.6], 2.6, 3.4, [0, -.12, 0]);
  ctx.features.push('철제 금고처럼 벌어진 거대한 압류 턱', '상아빛 윗니와 어긋난 황동 아랫니', '기울어진 징세 저울과 대형 족쇄', '붉은 봉인 띠를 두른 외장 징세 장부', '보석처럼 낮게 빛나는 가느다란 눈', '녹슨 판금과 목재·황동의 겹구조');
}

function unionGuard(ctx, g, n) {
  const { m } = ctx;
  const ram = group(g, `${n}rhinoceros-prow`, [-8.6, 3.2, 0]);
  sphere(ram, m.iron, `${n}rhino-skull`, [-1.1, 0, 0], [3.15, 1.9, 3.2], 8);
  cone(ram, m.brass, `${n}huge-main-horn`, [-3.8, .25, 0], 1.03, 4.35, [0, 0, Math.PI / 2], 7);
  cone(ram, m.iron, `${n}small-rear-horn`, [-1.55, 1.9, 0], .64, 2.1, [0, 0, .47], 6);
  for (const side of [-1, 1]) {
    panel(g, m, `${n}massive-shoulder-${side}`, [-4.8, 4.1, side * 4.25], [5.5, 5.6, .85], [0, side < 0 ? Math.PI : 0, -.17]);
    panel(g, m, `${n}layered-skirt-${side}`, [1.3, 2.8, side * 3.8], [6.2, 2.4, .55], [0, side < 0 ? Math.PI : 0, .08]);
    box(g, m.red, `${n}shoulder-chevron-${side}`, [-4.8, 4.9, side * 4.8], [3.0, .55, .12], [0, 0, -.22]);
    box(g, m.glow, `${n}watchful-eye-${side}`, [-10.9, 4.4, side * 2.4], [1.35, .28, .16], [0, side < 0 ? Math.PI : 0, -.18]);
    const gallery = group(g, `${n}projecting-battery-${side}`, [.4, 4.4, side * 5.0], [0, side * Math.PI / 2, 0]);
    box(gallery, m.darkWood || m.wood, `${n}battery-deck-${side}`, [0, -.55, 0], [4.0, .65, 2.9]);
    panel(gallery, m, `${n}battery-crown-${side}`, [-.25, .95, 0], [.75, 2.6, 3.4], [0, 0, 0], 'x');
    cannon(gallery, m, `${n}battery-art-${side}`, [-1.0, .2, 0], 1.1, [0, 0, 0]);
    beam(g, m.iron, `${n}battery-brace-${side}`, [2.0, 1.5, side * 2.3], [.6, 3.5, side * 5.5], .19);
    chain(g, m, `${n}shoulder-chain-${side}`, [[-6.5, 6.5, side * 4.4], [-4.2, 6.1, side * 4.9], [-2.0, 6.5, side * 4.5]], 11, .20);
  }
  // The crest follows the hull, leaving the original balloon visible between ribs.
  for (let i = 0; i < 4; i++) {
    const x = -2.6 + i * 2.6;
    box(g, m.iron, `${n}back-armor-${i}`, [x, 7.8 + (i % 2) * .35, 0], [2.1, .45, 4.4], [0, 0, -.04]);
    box(g, m.brass, `${n}back-ridge-${i}`, [x, 8.24 + (i % 2) * .35, 0], [2.2, .42, .75], [0, 0, -.04]);
  }
  panel(g, m, `${n}warden-tower`, [5.6, 6.8, 0], [2.8, 3.5, 3], [0, 0, .06]);
  box(g, m.iron, `${n}visor-roof`, [5.3, 8.7, 0], [3.8, .45, 4.0], [0, 0, -.08]);
  box(g, m.glow, `${n}warden-slit`, [4.1, 7.1, -1.58], [.9, .25, .1]);
  pennant(g, m, `${n}warden-command-banner`, [5.9, 10.4, -1.7], 2, 3.0);
  lantern(g, m, `${n}warden-lamp`, [-3.2, 6.6, -4.6], .9);
  ctx.features.push('코뿔소 두개골 같은 장갑 선수와 과장된 황동 충각', '양옆으로 솟는 거대한 견갑 방패', '선체 밖으로 튀어나온 경비 포대 발코니', '등뼈처럼 겹쳐진 장갑 판금', '작고 좁은 감시탑과 위압적인 눈썹', '붉은 지휘기·사슬·황동 리벳의 군벌 장식');
}

function bridgeTug(ctx, g, n) {
  const { m } = ctx;
  // A stocky bull crane, dominated by its load path and huge cable machinery.
  for (const side of [-1, 1]) {
    const z = side * 3.6;
    beam(g, m.iron, `${n}a-frame-front-${side}`, [-7.3, 2.3, z], [-4.0, 11.8, side * 1.6], .43);
    beam(g, m.darkWood || m.wood, `${n}a-frame-back-${side}`, [1.1, 3.2, z], [-4.0, 11.8, side * 1.6], .34);
    beam(g, m.brass, `${n}a-frame-inlay-${side}`, [-7.32, 2.5, z + side * .36], [-4.0, 11.5, side * 1.9], .075);
    drum(g, m, `${n}huge-winch-${side}`, [1.7, 4.2, side * 3.6], 1.62, 2.25, 'z');
    gear(g, m.iron, `${n}winch-gear-${side}`, [1.7, 4.2, side * 4.9], 1.9, 'z');
    tube(g, m.ink, `${n}taut-lift-cable-${side}`, [[1.7, 5.7, side * 3.6], [-4.0, 12.0, side * 1.6], [-8.7, 8.0, side * 2.2], [-9.0, 3.9, side * 3.0]], .09, 16);
    hook(g, m, `${n}twin-load-hook-${side}`, [-9, 1.5, side * 3.0], 1.15, [0, side * .3, side * -.12]);
    panel(g, m, `${n}broad-muscle-fender-${side}`, [-4.8, 3.1, side * 3.75], [5.1, 2.3, .55], [0, side < 0 ? Math.PI : 0, -.08]);
    tube(g, m.brass, `${n}bull-horn-${side}`, [[-8.6, 4.5, side * 1.6], [-10.1, 4.8, side * 3.1], [-10.5, 6.3, side * 4.2], [-9.9, 7.6, side * 4.3]], .36, 14);
    cone(g, m.ivory, `${n}bull-horn-tip-${side}`, [-9.7, 7.95, side * 4.3], .34, 1.2, [0, 0, -.5], 6);
    lantern(g, m, `${n}load-watch-lantern-${side}`, [-6.8, 4.4, side * 4.1], .9);
  }
  beam(g, m.iron, `${n}top-crane-crossbeam`, [-4.0, 11.8, -2.0], [-4.0, 11.8, 2.0], .45);
  drum(g, m, `${n}top-load-pulley`, [-4.0, 11.8, 0], .78, 3.6, 'z');
  box(g, m.red, `${n}bull-forehead`, [-8.0, 5.4, 0], [1.5, 1.8, 3.0], [0, 0, -.2]);
  ring(g, m.brass, `${n}enormous-bull-nose-ring`, [-9.6, 3.4, 0], 1.05, .24, 'z');
  panel(g, m, `${n}stern-counterweight`, [7.1, 2.2, 0], [3.5, 3.6, 7.0], [0, 0, .09]);
  for (let i = 0; i < 3; i++) box(g, m.brass, `${n}counterweight-band-${i}`, [6.1 + i, 2.2, 0], [.16, 3.8, 7.1]);
  tube(g, m.iron, `${n}crooked-steam-stack`, [[5.6, 4, -2.7], [5.6, 8, -2.7], [6.2, 8.6, -2.7], [7.1, 8.7, -2.7]], .46, 14);
  ring(g, m.brass, `${n}exhaust-mouth`, [7.1, 8.7, -2.7], .54, .13, 'x');
  pennant(g, m, `${n}tug-ragged-standard`, [-3.6, 13.1, 1.6], 2.6, 2.9, [0, .2, 0]);
  ctx.features.push('들소처럼 옆으로 휘어 솟는 두 개의 견인 뿔', '기낭보다 높은 거대한 A형 인양 프레임', '선체 밖으로 불룩한 이중 케이블 윈치', '앞으로 늘어진 쌍갈고리와 팽팽한 견인줄', '중심을 뒤로 잡는 묵직한 계단식 균형추', '황동 코고리와 굽은 굴뚝의 험상궂은 작업선');
}

function artillery(ctx, g, n) {
  const { m } = ctx;
  // A low crescent artillery cradle; the one main barrel owns the entire silhouette.
  const cradle = group(g, `${n}crescent-cradle`, [-2.0, 4.3, 0]);
  for (const side of [-1, 1]) {
    tube(cradle, m.iron, `${n}crescent-cheek-${side}`, [[-7.4, .2, side * 1.9], [-5.0, -.5, side * 4.0], [0, -.65, side * 4.9], [5.0, .1, side * 4.0], [6.1, 1.4, side * 2.1]], .58, 20);
    tube(cradle, m.brass, `${n}crescent-gold-trim-${side}`, [[-7.3, .6, side * 1.9], [-4.9, -.1, side * 4.0], [0, -.25, side * 4.9], [5.0, .5, side * 4.0], [6.0, 1.7, side * 2.1]], .10, 20);
    panel(g, m, `${n}low-gun-flank-${side}`, [-2.3, 3.3, side * 3.6], [8.0, 2.0, .45], [0, side < 0 ? Math.PI : 0, -.04]);
    beam(g, m.iron, `${n}recoil-rail-${side}`, [-7.4, 5.0, side * 1.65], [5.5, 5.0, side * 1.65], .24);
    beam(g, m.brass, `${n}recoil-piston-${side}`, [.5, 5.6, side * 1.9], [7.1, 5.1, side * 2.8], side < 0 ? .36 : .23);
  }
  const barrel = group(g, `${n}great-siege-barrel`, [-5.8, 6.0, 0], [0, 0, -.07]);
  // Solid open-mouth tube via a lathed profile: no black painted end cap.
  const barrelProfile = [
    new THREE.Vector2(1.06, -7.4), new THREE.Vector2(1.34, -7.4),
    new THREE.Vector2(1.34, -6.65), new THREE.Vector2(1.13, -6.4),
    new THREE.Vector2(1.24, 1.6), new THREE.Vector2(1.42, 3.4),
    new THREE.Vector2(0, 4.0), new THREE.Vector2(0, 2.8),
    new THREE.Vector2(.91, 2.4), new THREE.Vector2(1.06, -7.4),
  ];
  const gun = new THREE.Mesh(new THREE.LatheGeometry(barrelProfile, 24), m.iron);
  gun.rotation.z = -Math.PI / 2;
  gun.name = `${n}hollow-huge-calibre-cannon`;
  gun.castShadow = true;
  gun.receiveShadow = true;
  barrel.add(gun);
  for (const [i, x] of [-7.15, -5.8, -2.8, .5, 2.7].entries()) ring(barrel, m.brass, `${n}barrel-binding-${i}`, [x, 0, 0], x < -6 ? 1.39 : 1.30, .16, 'x');
  for (const side of [-1, 1]) gear(barrel, m.iron, `${n}enormous-trunnion-${side}`, [1.1, 0, side * 1.55], 1.55, 'z');
  // Off-centre counter recoil stack makes this vessel unlike the symmetrical tug.
  box(g, m.iron, `${n}heavy-recoil-cassette`, [5.0, 5.0, -3.7], [4.3, 3.1, 2.5], [0, 0, .13]);
  for (let i = 0; i < 5; i++) box(g, m.brass, `${n}recoil-rib-${i}`, [3.4 + i * .75, 5.1, -3.7], [.19, 3.35, 2.65], [0, 0, .13]);
  tube(g, m.iron, `${n}pressure-loop`, [[3.2, 6.4, -2.3], [3.1, 9.1, -3.6], [5.0, 10.1, -3.6], [6.7, 9.1, -3.6], [6.8, 6.0, -3.2]], .25, 20);
  ring(g, m.brass, `${n}giant-pressure-gauge`, [4.5, 8.1, -4.7], .86, .14, 'z');
  sphere(g, m.ivory, `${n}pressure-gauge-face`, [4.5, 8.1, -4.68], [.76, .76, .09], 12);
  beam(g, m.red, `${n}pressure-needle`, [4.5, 8.1, -4.81], [4.12, 8.6, -4.81], .07);
  pennant(g, m, `${n}artillery-battle-cloth`, [4.3, 9.2, 2.8], 3.3, 3.4, [0, .16, 0]);
  lantern(g, m, `${n}gunnery-sight`, [-8.2, 7.7, -1.3], .7);
  ctx.features.push('선체 길이를 뛰어넘는 특대 구경의 속 빈 공성포', '납작하고 넓게 휘어진 반달형 포가', '한쪽만 두껍고 높게 쌓인 반동 완충 장치', '황동 띠로 반복되는 거대한 포신 비례', '굽은 압력 배관과 붉은 바늘 계기', '낮은 측면 장갑과 큼직한 너덜 전투기');
}

function defense(ctx, g, n) {
  const { m } = ctx;
  // Broad three-layer floodgate: transverse width, not a row of generic spikes.
  for (let layer = 0; layer < 3; layer++) {
    const x = -7.8 + layer * 1.45;
    const height = 9.0 - layer * 1.45;
    const halfWidth = 6.8 - layer * .8;
    const wall = group(g, `${n}floodgate-layer-${layer}`, [x, 1.0, 0]);
    for (let section = -2; section <= 2; section++) {
      const z = section * halfWidth * .37;
      const crown = height - Math.abs(section) * .67;
      panel(wall, m, `${n}gate-plate-${layer}-${section}`, [0, crown * .5, z], [.55, crown, halfWidth * .35], [0, section * .035, 0], 'x');
      box(wall, m.ink, `${n}vertical-gate-seam-${layer}-${section}`, [-.33, crown * .5, z], [.08, crown * .88, .10]);
      // Arrowhead crenellations are structural shield crowns, above quiet broad panels.
      cone(wall, layer === 0 ? m.brass : m.iron, `${n}gate-crown-${layer}-${section}`, [0, crown + .42, z], .56, 1.35, [0, 0, 0], 4);
    }
    beam(wall, m.brass, `${n}cross-tie-low-${layer}`, [-.4, 1.2, -halfWidth], [-.4, 1.2, halfWidth], .16);
    beam(wall, m.brass, `${n}cross-tie-high-${layer}`, [-.4, height - 2, -halfWidth * .85], [-.4, height - 2, halfWidth * .85], .14);
    for (const side of [-1, 1]) {
      beam(g, m.iron, `${n}floodgate-rear-buttress-${layer}-${side}`, [x + .2, height * .8, side * halfWidth * .8], [3 + layer, 1.1, side * 2.6], .26);
    }
  }
  // Menacing house-sized lock and a tiny operator room establish the scale joke.
  panel(g, m, `${n}great-gate-lock`, [-8.5, 5.3, 0], [.75, 3.8, 3.3], [0, 0, 0], 'x');
  ring(g, m.brass, `${n}lock-wheel`, [-9.05, 5.7, 0], 1.25, .18, 'x');
  for (let i = 0; i < 5; i++) {
    const angle = i * TAU / 5;
    beam(g, m.brass, `${n}lock-wheel-spoke-${i}`, [-9.1, 5.7, 0], [-9.1, 5.7 + Math.cos(angle) * 1.15, Math.sin(angle) * 1.15], .10);
  }
  box(g, m.ink, `${n}keyhole-stem`, [-9.12, 4.4, 0], [.13, .9, .35]);
  sphere(g, m.ink, `${n}keyhole-round`, [-9.16, 4.96, 0], [.13, .42, .42], 10);
  for (const side of [-1, 1]) {
    drum(g, m, `${n}gate-chain-drum-${side}`, [2.0, 3.4, side * 4.1], 1.0, 1.55, 'z');
    chain(g, m, `${n}gate-hoist-chain-${side}`, [[-7.5, 8.8, side * 5.4], [-2.3, 6.2, side * 5.0], [2.0, 4.4, side * 4.1]], 19, .23);
    lantern(g, m, `${n}gate-warning-lantern-${side}`, [-8.3, 5.0, side * 5.4], 1.05);
  }
  const cabin = group(g, `${n}tiny-gatekeeper-cabin`, [5.2, 6.1, -.8]);
  box(cabin, m.darkWood || m.wood, `${n}cabin-box`, [0, 0, 0], [2.8, 2.5, 2.8]);
  box(cabin, m.red, `${n}cabin-sloped-roof`, [0, 1.4, 0], [3.4, .38, 3.6], [0, 0, -.19]);
  box(cabin, m.glow, `${n}cabin-front-slit`, [-1.43, .2, 0], [.09, .4, 1.5]);
  box(cabin, m.brass, `${n}cabin-window-brow`, [-1.52, .65, 0], [.24, .15, 2]);
  tube(cabin, m.iron, `${n}cabin-chimney`, [[.7, 1.2, .5], [.7, 3.1, .5], [1.4, 3.4, .5]], .20, 12);
  pennant(g, m, `${n}gatekeeper-command-cloth`, [5.6, 9.1, 1.0], 2.1, 2.8);
  ctx.features.push('기체보다 훨씬 넓은 세 겹의 거대한 수문 방패', '앞은 높고 뒤는 낮은 계단식 장갑 실루엣', '금속 가시 관모와 황동 가로보강의 압도적 벽면', '집채만 한 자물쇠와 잠금 핸들', '긴 인양 사슬과 외장 수문 드럼', '방패 뒤에 매달린 작은 붉은 지붕 관제실');
}

export function addIndustrial(ctx) {
  if (!INDUSTRIAL_IDS.has(ctx.id)) return false;
  const n = `${ctx.id}-villain-`;
  const g = group(ctx.root, `${n}industrial-character`, [0, 0, 0]);
  g.userData.artPrototype = true;
  g.userData.simulationChanges = false;
  if (ctx.id === 'enemy-tax-cutter') taxCutter(ctx, g, n);
  else if (ctx.id === 'mission-union-guard') unionGuard(ctx, g, n);
  else if (ctx.id === 'mission-bridge-tug') bridgeTug(ctx, g, n);
  else if (ctx.id === 'role-enemy-artillery') artillery(ctx, g, n);
  else if (ctx.id === 'role-enemy-defense') defense(ctx, g, n);
  return true;
}

