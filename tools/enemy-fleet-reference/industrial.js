/**
 * Two industrial silhouettes authored from the user supplied six-ship sheet.
 * Local art coordinates: bow -X, up +Y. Counts below are art proposals only:
 * both source catalog entries leave all module counts null / undecided.
 */
import { THREE, group, mesh, box, cyl, sphere, tube, beam, ring, panel, hull, balloon, cloth, engine, cannon, lantern, control } from './kit.js';

const point = (a, b, t) => a.map((value, index) => value + (b[index] - value) * t);
const add = (a, b) => a.map((value, index) => value + b[index]);
const roleNode = (ctx, name, at, role, axis, amplitude, extra) => {
  const node = group(ctx.motion, ctx.id + '-' + name, at);
  control(ctx.controls, node, role, axis, amplitude, extra || {});
  return node;
};

function railing(parent, m, name, length, width, y, options = {}) {
  const left = options.from ?? -length * .43, right = options.to ?? length * .43;
  for (const side of [-1, 1]) {
    const z = side * width * .47;
    for (let index = 0; index <= 8; index++) {
      const x = left + (right - left) * index / 8;
      beam(parent, m.dark, name + '-post-' + side + '-' + index, [x, y, z], [x, y + .72, z], .055);
      sphere(parent, m.brass, name + '-cap-' + side + '-' + index, [x, y + .74, z], [.075, .075, .075], 8);
    }
    beam(parent, m.wood, name + '-handrail-' + side, [left, y + .71, z], [right, y + .71, z], .075);
    tube(parent, m.rope, name + '-safety-line-' + side, [[left, y + .33, z], [left + (right - left) * .3, y + .28, z], [right, y + .34, z]], .025);
  }
}

function deck(parent, m, name, length, width, y) {
  for (let index = 0; index < 17; index++) {
    const x = (index / 16 - .5) * length * .9;
    const taper = .72 + .28 * Math.sin(Math.PI * index / 16);
    box(parent, index % 4 === 0 ? m.darkWood : m.wood, name + '-plank-' + index, [x, y, 0], [length * .9 / 17 * .97, .085, width * taper]);
  }
}

/** A boxed lattice boom with depth; two longitudinal faces remain open. */
function truss(parent, m, name, a, b, width = .56, depth = .5) {
  const direction = new THREE.Vector3().fromArray(b).sub(new THREE.Vector3().fromArray(a)).normalize();
  const normal = new THREE.Vector3(-direction.y, direction.x, 0).normalize().multiplyScalar(width / 2);
  const corners = [];
  for (const side of [-1, 1]) for (const face of [-1, 1]) {
    const offset = [normal.x * side, normal.y * side, depth * face / 2];
    const start = add(a, offset), end = add(b, offset);
    corners.push({ side, face, start, end });
    beam(parent, side > 0 ? m.metal : m.dark, name + '-longeron-' + side + '-' + face, start, end, .09);
  }
  const count = Math.max(4, Math.ceil(new THREE.Vector3().fromArray(a).distanceTo(new THREE.Vector3().fromArray(b)) / .65));
  for (const face of [-1, 1]) {
    const plus = corners.find(corner => corner.side === 1 && corner.face === face), minus = corners.find(corner => corner.side === -1 && corner.face === face);
    for (let index = 0; index < count; index++) {
      const t0 = index / count, t1 = (index + 1) / count;
      beam(parent, m.brass, name + '-web-' + face + '-' + index, point(index % 2 ? plus.start : minus.start, index % 2 ? plus.end : minus.end, t0), point(index % 2 ? minus.start : plus.start, index % 2 ? minus.end : plus.end, t1), .045);
      beam(parent, m.dark, name + '-stile-' + face + '-' + index, point(plus.start, plus.end, t0), point(minus.start, minus.end, t0), .045);
    }
  }
  for (const end of [a, b]) for (const side of [-1, 1]) {
    const center = add(end, [normal.x * side, normal.y * side, 0]);
    beam(parent, m.brass, name + '-cross-cap-' + end.join('_') + '-' + side, add(center, [0, 0, -depth / 2]), add(center, [0, 0, depth / 2]), .08);
  }
}

function chain(parent, m, name, from, to, links = 18) {
  const assembly = group(parent, name, from);
  const end = new THREE.Vector3().fromArray(to).sub(new THREE.Vector3().fromArray(from));
  for (let index = 0; index < links; index++) {
    const at = end.clone().multiplyScalar(index / Math.max(links - 1, 1));
    const geometry = new THREE.TorusGeometry(.105, .031, 5, 12);
    geometry.scale(1, 1.32, 1);
    mesh(assembly, geometry, index % 3 === 0 ? m.brass : m.dark, name + '-link-' + index, at.toArray(), [0, index % 2 ? Math.PI / 2 : 0, 0]);
  }
  return assembly;
}

function claw(parent, m, name, at) {
  const root = group(parent, name, at);
  cyl(root, m.brass, name + '-swivel', [0, .4, 0], .15, .55, 'y');
  sphere(root, m.metal, name + '-forged-hub', [0, .12, 0], [.35, .32, .35], 12);
  for (let index = 0; index < 3; index++) {
    const shape = new THREE.Shape();
    shape.moveTo(.13, .23); shape.quadraticCurveTo(.7, .32, 1.02, -.26);
    shape.quadraticCurveTo(.85, -.91, .22, -1.66);
    shape.quadraticCurveTo(.5, -.83, .51, -.39);
    shape.lineTo(.04, -.04); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .16, bevelEnabled: true, bevelSize: .035, bevelThickness: .03, bevelSegments: 1, steps: 1, curveSegments: 9 });
    const jaw = group(root, name + '-jaw-pivot-' + index, [0, 0, 0], [0, index * Math.PI * 2 / 3, 0]);
    mesh(jaw, geometry, m.dark, name + '-jaw-' + index, [0, 0, -.08]);
    cyl(jaw, m.brass, name + '-jaw-pin-' + index, [.37, .03, .02], .1, .25, 'z', 12);
  }
  return root;
}

function plateBelt(parent, m, name, length, width, y) {
  for (const side of [-1, 1]) for (let index = 0; index < 8; index++) {
    const x = (index / 7 - .5) * length * .83;
    const z = side * width * (.43 + .035 * Math.sin(index / 7 * Math.PI));
    const plate = panel(parent, index % 3 === 0 ? m.metal : m.red, name + '-patch-' + side + '-' + index, [x, y, z], [length / 8 * .91, .83 + (index % 2) * .2, .1], [0, 0, (index % 3 - 1) * .035], m.brass);
    plate.userData.referenceFeature = 'individually riveted redbrown work hull';
  }
}

function mooringEyes(parent, m, name, at) {
  for (const side of [-1, 1]) {
    cyl(parent, m.dark, name + '-bollard-' + side, add(at, [0, 0, side * .3]), .1, .42, 'y', 10);
    beam(parent, m.brass, name + '-bollard-cross-' + side, add(at, [-.25, .14, side * .3]), add(at, [.25, .14, side * .3]), .075);
  }
}

function workWindow(parent, m, name, x, y, z, width = 1, height = 1.05) {
  box(parent, m.darkWood, name + '-recess', [x, y, z], [width + .16, height + .16, .1]);
  box(parent, m.glow, name + '-amber-glass', [x, y, z + Math.sign(z || 1) * .07], [width, height, .035]);
  for (const side of [-1, 1]) box(parent, m.wood, name + '-jamb-' + side, [x + side * (width / 2 + .035), y, z + Math.sign(z || 1) * .1], [.1, height + .2, .1]);
  for (const side of [-1, 1]) box(parent, m.brass, name + '-sill-' + side, [x, y + side * (height / 2 + .035), z + Math.sign(z || 1) * .1], [width + .2, .075, .11]);
  box(parent, m.darkWood, name + '-center-mullion', [x, y, z + Math.sign(z || 1) * .12], [.055, height, .08]);
  box(parent, m.darkWood, name + '-cross-mullion', [x, y + .05, z + Math.sign(z || 1) * .12], [width, .055, .08]);
}

function hydraulic(parent, m, name, a, b) {
  const half = point(a, b, .57);
  beam(parent, m.dark, name + '-cylinder-housing', a, half, .12);
  beam(parent, m.brass, name + '-bright-piston', half, b, .065);
  sphere(parent, m.brass, name + '-eye-a', a, [.15, .15, .15], 10);
  sphere(parent, m.brass, name + '-eye-b', b, [.13, .13, .13], 10);
}

function repairBasket(parent, m, name, at) {
  const root = group(parent, name, at);
  box(root, m.metal, name + '-square-base', [0, -.35, 0], [.85, .13, .78]);
  box(root, m.red, name + '-hood', [0, .38, 0], [.95, .12, .85]);
  for (const x of [-.34, .34]) for (const z of [-.3, .3]) beam(root, m.dark, name + '-cage-' + x + '-' + z, [x, -.3, z], [x, .36, z], .04);
  lantern(root, m, name + '-work-lamp', [0, .03, 0], .42);
  cyl(root, m.brass, name + '-tool-nozzle', [0, -.58, 0], .1, .5, 'y', 10, .055);
  return root;
}

/** One articulated boom, the end basket carried by its actual second pivot. */
function repairBoom(ctx, name, at, first, second, hanging) {
  const { id, motion, m, controls } = ctx;
  const root = group(motion, id + '-' + name, at);
  const elbow = group(root, id + '-' + name + '-elbow', first);
  control(controls, root, 'shoulder', 'z', .035);
  control(controls, elbow, 'elbow', 'z', -.06, { phase: .6 });
  for (const z of [-.13, .13]) {
    beam(root, m.metal, id + '-' + name + '-upper-box-' + z, [0, 0, z], add(first, [0, 0, z]), .13);
    beam(elbow, m.metal, id + '-' + name + '-forearm-box-' + z, [0, 0, z], add(second, [0, 0, z]), .11);
  }
  for (const [parent, suffix, pointAt] of [[root, 'shoulder', [0, 0, 0]], [elbow, 'elbow', [0, 0, 0]], [elbow, 'wrist', second]]) {
    cyl(parent, m.dark, id + '-' + name + '-' + suffix + '-joint', pointAt, .25, .52, 'z');
    cyl(parent, m.brass, id + '-' + name + '-' + suffix + '-bolt', add(pointAt, [0, 0, -.29]), .13, .08, 'z');
    ring(parent, m.brass, id + '-' + name + '-' + suffix + '-rim', add(pointAt, [0, 0, -.29]), .23, .035, 'z');
  }
  hydraulic(root, m, id + '-' + name + '-upper-hydraulic', [.28, -.06, -.3], add(point([0, 0, 0], first, .77), [.19, -.17, -.3]));
  hydraulic(elbow, m, id + '-' + name + '-lower-hydraulic', [.22, .13, -.27], add(point([0, 0, 0], second, .8), [.04, .16, -.27]));
  tube(root, m.rope, id + '-' + name + '-supply-hose-upper', [[0, -.2, .24], add(point([0, 0, 0], first, .35), [.18, -.22, .24]), add(first, [.2, .1, .24])], .045);
  tube(elbow, m.rope, id + '-' + name + '-supply-hose-lower', [[.1, .1, .24], add(point([0, 0, 0], second, .5), [0, .25, .24]), add(second, [0, 0, .24])], .045);
  const tool = add(second, [0, -hanging, 0]);
  chain(elbow, m, id + '-' + name + '-basket-chain', second, tool, Math.max(4, Math.ceil(hanging / .17)));
  repairBasket(elbow, m, id + '-' + name + '-lantern-basket', tool);
  return { root, elbow, endpoint: add(at, add(first, tool)) };
}

export function buildUnionSalvage(ctx) {
  const { id, motion, m, controls } = ctx;
  const body = hull(motion, { ...m, metal: m.red }, id + '-redbrown-work-barge', { length: 10.8, width: 4.7, depth: 2.6, at: [.15, -.2, 0], bow: .16, style: 'metal' });
  deck(motion, m, id + '-open-work-deck', 10.2, 4.35, .2);
  plateBelt(motion, m, id + '-heavy-rivet-belt', 10.1, 4.7, -.1);
  railing(motion, m, id + '-work-rails', 10.7, 4.5, .24);
  for (const z of [-1.65, 1.65]) {
    for (const x of [1.2, 4.1]) {
      beam(motion, m.dark, id + '-open-gantry-post-' + x + '-' + z, [x, .25, z], [x, 3.85, z], .095);
      beam(motion, m.brass, id + '-open-gantry-brace-' + x + '-' + z, [x, .55, z], [x + (x < 2 ? .6 : -.6), 2.45, z], .045);
    }
    beam(motion, m.dark, id + '-aft-gantry-top-' + z, [1.2, 3.85, z], [4.1, 3.85, z], .11);
  }
  for (const x of [1.2, 4.1]) beam(motion, m.dark, id + '-open-gantry-cross-' + x, [x, 3.85, -1.65], [x, 3.85, 1.65], .095);
  // Open iron working gantry, with a low sloping rain cover rather than a house.
  panel(motion, m.dark, id + '-open-helm-weather-cover', [3.1, 2.55, -.35], [2.5, .12, 2.5], [0, 0, .06], m.brass);
  box(motion, m.wood, id + '-helm-console', [3.3, 1, -.35], [1.15, .8, .7]);
  ring(motion, m.brass, id + '-industrial-helm-wheel', [2.9, 1.53, -.75], .27, .038, 'z');
  const envelope = balloon(motion, m, id + '-single-teal-netted-envelope', { length: 7.5, radius: 1.62, at: [2.05, 5.22, 0], flatten: .97, material: 'teal', net: true, ragged: false }, controls);
  for (const side of [-1, 1]) for (const x of [-.3, 1.8, 4.2]) tube(motion, m.rope, id + '-envelope-suspension-' + side + '-' + x, [[x, 4.75, side * 1.15], [x, 2.8, side * 1.65], [x, .35, side * 2.1]], .032);

  const winch = roleNode(ctx, 'weakpoint-exposed-cable-drum', [-.65, 1.33, -.35], 'drum', 'z', .18);
  cyl(winch, m.dark, id + '-drum-core', [0, 0, 0], .97, 2.55, 'z', 24);
  for (let index = 0; index < 17; index++) ring(winch, m.rope, id + '-coiled-drum-cable-' + index, [0, 0, (index / 16 - .5) * 2.5], 1.02, .052, 'z');
  for (const side of [-1, 1]) {
    cyl(winch, m.brass, id + '-drum-flange-' + side, [0, 0, side * 1.34], 1.22, .12, 'z', 24);
    cyl(winch, m.dark, id + '-drum-recess-' + side, [0, 0, side * 1.415], .96, .04, 'z', 20);
    ring(winch, m.brass, id + '-drum-face-ring-' + side, [0, 0, side * 1.45], .96, .08, 'z');
    cyl(winch, m.brass, id + '-drum-axle-' + side, [0, 0, side * 1.5], .2, .2, 'z', 16);
    for (let spoke = 0; spoke < 6; spoke++) { const angle = spoke * Math.PI / 3; beam(winch, m.brass, id + '-drum-spoke-' + side + '-' + spoke, [.2 * Math.cos(angle), .2 * Math.sin(angle), side * 1.46], [.82 * Math.cos(angle), .82 * Math.sin(angle), side * 1.46], .055); }
  }
  for (const side of [-1, 1]) panel(motion, m.metal, id + '-winch-bearing-stand-' + side, [-.65, .65, -.35 + side * 1.58], [1.4, .9, .16], [0, 0, 0], m.brass);

  const crane = roleNode(ctx, 'two-section-truss-crane', [-1.55, .5, .9], 'crane', 'z', .025);
  const knee = [-1.75, 2.72, 0], tip = [-5.42, 7.25, 0];
  truss(crane, m, id + '-crane-lower-section', [0, 0, 0], knee, .68, .62);
  truss(crane, m, id + '-crane-upper-section', knee, tip, .59, .58);
  for (const [suffix, at, radius] of [['foot', [0, 0, 0], .43], ['elbow', knee, .34], ['tip', tip, .28]]) {
    cyl(crane, m.dark, id + '-crane-' + suffix + '-bearing', at, radius, .85, 'z', 20);
    ring(crane, m.brass, id + '-crane-' + suffix + '-gold-rim', add(at, [0, 0, -.46]), radius * .85, .05, 'z');
  }
  tube(motion, m.dark, id + '-crane-main-stay', [[3.8, 3.95, .9], [-2.8, 7.7, .9], [-6.97, 7.75, .9]], .042);
  tube(crane, m.rope, id + '-winch-to-tip-cable', [[.9, .8, -.4], [-1.38, 3.2, -.4], add(tip, [.07, .18, -.4])], .055);
  const hangingTop = add(tip, [-.09, -.2, 0]), hangingEnd = add(tip, [-.09, -3.25, 0]);
  chain(crane, m, id + '-long-hoist-chain', hangingTop, hangingEnd, 19);
  const grab = claw(crane, m, id + '-three-jaw-salvage-claw', add(hangingEnd, [0, -.2, 0]));
  control(controls, grab, 'hook', 'z', .06);

  const harpoon = cannon(motion, m, id + '-low-foredeck-harpoon', { at: [-3.85, .65, -1.7], scale: .76, rotation: [0, -.12, 0], kind: 'harpoon' }, controls);
  for (const side of [-1, 1]) engine(motion, m, id + '-aft-work-engine-' + side, { at: [4.45, -.35, side * 1.95], scale: .7, rotation: [0, 0, 0] }, controls);
  mooringEyes(motion, m, id + '-aft-mooring', [4.35, .5, 0]);
  for (const side of [-1, 1]) { lantern(motion, m, id + '-gantry-work-lamp-' + side, [2.15, 1.65, side * 1.88], .3); tube(motion, m.dark, id + '-underslung-service-hose-' + side, [[-2.2, -.5, side * 2.05], [-.8, -2.5, side * 2.35], [2.2, -1.6, side * 2.03]], .052); }
  box(motion, m.red, id + '-open-tool-chest', [2.35, .7, 1.05], [1.4, .9, .7]);
  return {
    artModules: { balloons: 1, engines: 2, harpoons: 1, winches: 1, crane: 1, repairArms: 0 },
    weakpoints: [{ id: id + '-weak-cable-drum', nodeName: winch.name, label: '노출 케이블 드럼', kind: 'winch' }, { id: id + '-weak-hoist-chain', nodeName: crane.name, label: '크레인·견인 케이블', kind: 'crane' }],
    features: ['single-teal-netted-envelope', 'deep-riveted-redbrown-work-barge', 'open-iron-working-gantry', 'oversized-exposed-cable-drum', 'two-section-diagonal-truss-crane', 'long-hanging-chain', 'three-forged-jaw-claw', 'low-visible-harpoon'],
    referenceNotes: '사용자 6종 그림의 3번 인양선. 단일 청록 기낭·적갈색 작업 선체·선수 밖으로 솟은 철골 크레인·거대 드럼·매달린 3발 집게를 우선했다. 집형 선장실과 쌍동선은 사용하지 않았다. 부품 수·상대 치수는 제작 제안이며 원문 modules=null을 변경하지 않는다.',
  };
}

export function buildUnionRepair(ctx) {
  const { id, motion, m, controls } = ctx;
  const body = hull(motion, m, id + '-single-deep-workshop-hull', { length: 11.2, width: 4.6, depth: 2.35, at: [.15, -.2, 0], bow: .38, style: 'wood' });
  deck(motion, m, id + '-working-deck', 10.6, 4.35, .23);
  plateBelt(motion, m, id + '-redbrown-workshop-patches', 10.2, 4.55, -.12);
  railing(motion, m, id + '-foredeck-safety-rail', 10.6, 4.5, .28, { from: -4.8, to: -.8 });
  const workshop = group(motion, id + '-long-multiwindow-workshop', [1.65, .35, 0]);
  box(workshop, m.darkWood, id + '-workshop-long-body', [0, 1.05, 0], [5.9, 2.1, 3.7]);
  for (let index = 0; index < 12; index++) {
    const y = .12 + index * .165;
    for (const side of [-1, 1]) box(workshop, index % 3 ? m.wood : m.red, id + '-workshop-horizontal-cladding-' + side + '-' + index, [0, y, side * 1.88], [5.92, .14, .085]);
  }
  for (const side of [-1, 1]) for (let index = 0; index < 4; index++) workWindow(workshop, m, id + '-workshop-window-' + side + '-' + index, -2.18 + index * 1.43, 1.16, side * 1.95, 1.05, 1.25);
  panel(workshop, m.dark, id + '-workshop-low-flat-metal-roof', [0, 2.2, 0], [6.25, .16, 4.15], [0, 0, 0], m.brass);
  box(workshop, m.wood, id + '-roof-wood-rim-near', [0, 2.33, -2.04], [6.32, .18, .13]);
  box(workshop, m.wood, id + '-roof-wood-rim-far', [0, 2.33, 2.04], [6.32, .18, .13]);
  for (const x of [-2.88, 2.88]) for (const side of [-1, 1]) beam(workshop, m.brass, id + '-shop-corner-binding-' + x + '-' + side, [x, .03, side * 1.94], [x, 2.23, side * 1.94], .055);
  const front = group(workshop, id + '-fore-facing-workshop-windows', [-2.99, 0, 0], [0, -Math.PI / 2, 0]);
  for (const x of [-.9, .9]) workWindow(front, m, id + '-front-window-' + x, x, 1.17, .02, 1.2, 1.25);
  box(workshop, m.red, id + '-rear-service-door', [3.02, 1, .55], [.08, 1.85, .95]);
  box(motion, m.wood, id + '-open-foredeck-workbench', [-2.2, .9, 1.1], [1.8, .18, 1.0]);
  for (const x of [-2.8, -1.6]) beam(motion, m.dark, id + '-workbench-foot-' + x, [x, .3, 1.1], [x, .85, 1.1], .07);
  ring(motion, m.rope, id + '-foredeck-coiled-cable', [-3.65, .34, .7], .5, .08, 'y');

  const envelope = balloon(motion, m, id + '-single-cream-netted-envelope', { length: 9.25, radius: 1.7, at: [.65, 5.75, 0], flatten: 1.04, material: 'canvas', net: true, ragged: false }, controls);
  for (const side of [-1, 1]) for (const x of [-2.8, -.1, 2.7, 4.4]) {
    beam(motion, m.dark, id + '-balloon-support-strut-' + x + '-' + side, [x, 2.65, side * 1.7], [x, 4.5, side * 1.25], .065);
    tube(motion, m.rope, id + '-balloon-rigging-' + x + '-' + side, [[x, 5.35, side * 1.45], [x, 3.7, side * 1.65], [x, .45, side * 2.1]], .029);
  }
  // A large vertical blue signal cloth, deliberately unlike a cottage roof.
  beam(motion, m.darkWood, id + '-blue-flag-mast', [4.5, .4, -1.95], [4.5, 7.25, -1.95], .075);
  beam(motion, m.brass, id + '-blue-flag-yard', [2.58, 6.95, -1.95], [4.65, 6.95, -1.95], .055);
  cloth(motion, m.blue, id + '-large-workshop-blue-flag', { at: [3.55, 6.9, -2.0], width: 1.8, height: 2.8, ragged: false, rotation: [0, 0, .015], horizontal: false, billow: .12 });
  const flagMark = group(motion, id + '-flag-engineers-mark', [3.55, 5.52, -2.13]);
  ring(flagMark, m.ivory, id + '-flag-mark-ring', [0, 0, 0], .3, .035, 'z');
  beam(flagMark, m.ivory, id + '-flag-mark-spine', [0, -.69, 0], [0, .69, 0], .028);
  for (const side of [-1, 1]) { beam(flagMark, m.ivory, id + '-flag-mark-cross-' + side, [side * .55, .12, 0], [0, .12, 0], .028); beam(flagMark, m.ivory, id + '-flag-mark-chevron-' + side, [side * .34, -.4, 0], [0, -.17, 0], .028); }

  const highArm = repairBoom(ctx, 'high-side-hydraulic-repair-boom', [-1.45, .6, -1.75], [-.65, 2.8, -.25], [-2.3, -.45, -.45], 1.05);
  const lowArm = repairBoom(ctx, 'lower-side-hydraulic-repair-boom', [-1.05, -.9, 1.8], [-.85, -1.8, .6], [-2.55, -.25, .35], .25);
  tube(motion, m.dark, id + '-long-u-shaped-near-supply-cable', [[1.25, -.45, -2.03], [.5, -2.9, -2.6], [-2.5, -3.1, -2.75], [-4.4, .05, -2.45]], .065, 36);
  tube(motion, m.dark, id + '-long-u-shaped-far-supply-cable', [[2.65, -.4, 2.05], [1.8, -3.2, 2.55], [-2.3, -4.5, 2.8], [-4.45, -2.25, 2.75]], .055, 36);
  for (const side of [-1, 1]) {
    engine(motion, m, id + '-rear-service-engine-' + side, { at: [4.55, -.35, side * 1.85], scale: .66, rotation: [0, 0, 0] }, controls);
    lantern(motion, m, id + '-workshop-corner-light-' + side, [4.65, 1.65, side * 1.94], .36);
    lantern(motion, m, id + '-foredeck-work-light-' + side, [-2.1, 1.4, side * 1.85], .27);
  }
  for (let index = 0; index < 3; index++) box(motion, index % 2 ? m.metal : m.red, id + '-underslung-tools-' + index, [.3 + index * 1.1, -1.85, -.2], [.7, .6, .8]);
  mooringEyes(motion, m, id + '-fore-mooring', [-4.45, .5, .25]);
  return {
    artModules: { balloons: 1, engines: 2, repairArms: 2, rescueCapsules: 0, cannons: 0, harpoons: 0 },
    weakpoints: [{ id: id + '-weak-repair-apparatus', nodeName: highArm.root.name, label: '측면 수리 장치', kind: 'repair' }, { id: id + '-weak-lower-repair-joint', nodeName: lowArm.root.name, label: '하부 수리팔 관절', kind: 'repair' }],
    features: ['single-cream-netted-envelope', 'single-deep-wood-and-redbrown-hull', 'long-warm-multiwindow-workshop-bridge', 'low-flat-workshop-roof', 'large-blue-engineers-flag', 'two-articulated-hydraulic-repair-booms', 'hanging-lantern-tool-baskets', 'deep-u-shaped-supply-cables', 'warm-working-lights'],
    referenceNotes: '사용자 6종 그림의 4번 수리선. 크림색 단일 기낭·가로로 긴 다중창 공방·큰 청색 깃발·양측 유압 수리팔·따뜻한 작업등 바스켓·늘어진 연결선을 우선했다. 기존 v2 쌍동선이나 주거용 코티지 형태를 복사하지 않았다. 장치 수와 치수는 현재 그림을 해석한 제작 제안이며 실제 수리 AI·연결선 물리·충돌 규격이 아니다.',
  };
}
