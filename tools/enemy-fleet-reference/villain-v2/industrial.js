/**
 * Industrial villain wrappers. Existing ship geometry, animation controls and
 * weakpoint bones are kept; the additions are visual machinery and armour.
 * No canonical equipment counts, damage, repair amounts or AI are changed.
 */
import { buildUnionSalvage as buildBaseSalvage, buildUnionRepair as buildBaseRepair } from '../industrial.js';
import { THREE, group, box, cyl, sphere, tube, beam, ring, panel } from '../kit.js';
import { blade, chain, eye, describe } from './style.js';

function required(ctx, suffix) {
  const node = ctx.motion.getObjectByName(ctx.id + '-' + suffix);
  if (!node) throw new Error('Industrial villain wrapper requires base node: ' + ctx.id + '-' + suffix);
  return node;
}

/** Broad painted warning surfaces, rather than tiny repeated spike decoration. */
function warningPlate(parent, m, name, at, size, rotation = [0, 0, 0]) {
  const root = group(parent, name, at, rotation);
  panel(root, m.warning, name + '-ochre-plate', [0, 0, 0], [size[0], size[1], .13], [0, 0, 0], m.brass);
  const half = size[0] / 2, height = size[1], stripeWidth = Math.max(.14, height * .35), step = stripeWidth * 2.1;
  for (let x = -half - height; x < half; x += step) {
    const clamp = value => Math.max(-half + .04, Math.min(half - .04, value));
    const points = [[clamp(x), -height * .43], [clamp(x + stripeWidth), -height * .43], [clamp(x + stripeWidth + height * .57), height * .43], [clamp(x + height * .57), height * .43]];
    if (Math.max(...points.map(point => point[0])) - Math.min(...points.map(point => point[0])) < .035) continue;
    blade(root, m.iron, name + '-worn-black-stripe-' + x.toFixed(3), points, .026, [0, 0, .09]);
  }
  return root;
}

function forgedRim(parent, m, name, at, radius, teeth = 14) {
  const root = group(parent, name, at);
  ring(root, m.iron, name + '-thick-ring', [0, 0, 0], radius, .13, 'z');
  for (let index = 0; index < teeth; index++) {
    const angle = index * Math.PI * 2 / teeth;
    box(root, index % 4 === 0 ? m.blood : m.iron, name + '-gear-tooth-' + index, [Math.cos(angle) * radius, Math.sin(angle) * radius, 0], [.23, .31, .16], [0, 0, angle - Math.PI / 2]);
  }
  return root;
}

function wristVice(parent, m, name) {
  const root = group(parent, name);
  warningPlate(root, m, name + '-tool-warning', [0, .54, -.43], [1.38, .29]);
  for (const side of [-1, 1]) {
    const points = [[.19, .23], [.76, .28], [1.04, -.12], [.94, -.84], [.32, -1.53], [.5, -.78], [.3, -.86], [.65, -.39], [.45, -.44], [.56, -.05], [.16, -.04]].map(([x, y]) => [x * side, y]);
    blade(root, m.iron, name + '-opposed-vise-jaw-' + side, points, .32, [0, 0, -.18]);
    blade(root, m.blood, name + '-jaw-outer-backing-' + side, [[.56 * side, .24], [.84 * side, .15], [.99 * side, -.12], [.91 * side, -.73], [.73 * side, -.52], [.75 * side, -.05]], .12, [0, 0, -.25]);
    cyl(root, m.brass, name + '-vice-hinge-' + side, [side * .4, .14, -.42], .17, .14, 'z', 12);
  }
  return root;
}

function demolitionSaw(parent, m, name) {
  const root = group(parent, name, [-.14, -.18, -.55]);
  cyl(root, m.iron, name + '-saw-disc', [0, 0, 0], .88, .13, 'z', 24);
  ring(root, m.brass, name + '-saw-hub-ring', [0, 0, -.1], .32, .06, 'z');
  cyl(root, m.blood, name + '-red-hub', [0, 0, -.16], .18, .12, 'z', 12);
  for (let index = 0; index < 18; index++) {
    const angle = index * Math.PI * 2 / 18;
    const tooth = group(root, name + '-tooth-orientation-' + index, [0, 0, 0], [0, 0, angle]);
    blade(tooth, m.bone, name + '-tooth-' + index, [[.74, -.12], [1.06, -.07], [.91, .16], [.78, .13]], .13, [0, 0, -.07]);
  }
  const hood = [[-.98, .02], [-.98, .35], [-.67, .79], [-.14, 1.04], [.54, .87], [.96, .42], [1.0, .03]];
  blade(root, m.blood, name + '-asymmetric-saw-hood', hood, .3, [0, 0, .03]);
  warningPlate(root, m, name + '-hood-warning', [.05, .59, -.18], [1.0, .25], [0, 0, -.13]);
  return root;
}

function flue(parent, m, name, points, radius) {
  tube(parent, m.iron, name + '-bent-smokestack', points, radius, 18);
  const last = new THREE.Vector3().fromArray(points.at(-1)), previous = new THREE.Vector3().fromArray(points.at(-2));
  const end = group(parent, name + '-outlet', last.toArray());
  end.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), last.sub(previous).normalize());
  cyl(end, m.blood, name + '-outlet-flare', [0, 0, 0], radius * 1.35, .24, 'y', 14, radius * 1.12);
  cyl(end, m.dark, name + '-dark-open-mouth', [0, .14, 0], radius * .98, .04, 'y', 14);
  ring(end, m.brass, name + '-outlet-rim', [0, .15, 0], radius * 1.18, .06, 'y');
  return end;
}

export function buildUnionSalvage(ctx) {
  const built = buildBaseSalvage(ctx);
  const { id, motion, m } = ctx, prefix = id + '-v2';
  const crane = required(ctx, 'two-section-truss-crane');
  const winch = required(ctx, 'weakpoint-exposed-cable-drum');
  const claw = required(ctx, 'three-jaw-salvage-claw');

  // The original claw retains its animated pivot, now carrying heavy serrated
  // forging plates. Three shaped jaws read as a capture machine at a distance.
  for (let index = 0; index < 3; index++) {
    const jaw = claw.getObjectByName(id + '-three-jaw-salvage-claw-jaw-pivot-' + index);
    if (!jaw) throw new Error('Missing preserved salvage jaw pivot ' + index);
    const shape = [[.05, .29], [.76, .4], [1.47, -.06], [1.64, -.58], [1.28, -1.48], [.35, -2.4], [.61, -1.51], [.42, -1.57], [.84, -1.08], [.62, -1.14], [1.03, -.65], [.78, -.68], [.82, -.25], [.1, -.02]];
    blade(jaw, m.iron, prefix + '-serrated-capture-jaw-' + index, shape, .34, [0, 0, -.17]);
    blade(jaw, m.blood, prefix + '-capture-jaw-red-forging-' + index, [[.52, .28], [.89, .27], [1.39, -.16], [1.45, -.58], [1.19, -1.23], [.99, -1.02], [1.13, -.51], [.94, -.13]], .12, [0, 0, -.25]);
    cyl(jaw, m.brass, prefix + '-capture-jaw-bolt-' + index, [.46, .07, -.35], .2, .16, 'z', 12);
  }
  warningPlate(claw, m, prefix + '-claw-load-warning', [0, .36, -.43], [1.2, .3]);
  cyl(claw, m.iron, prefix + '-oversized-locking-collar', [0, .42, 0], .42, .36, 'y', 16);

  // A reinforced first stage and shielded elbow change the large crane masses
  // without filling its distinctive open triangular truss.
  panel(crane, m.blood, prefix + '-crane-shoulder-cheek', [0, .25, -.54], [1.3, 1.05, .24], [0, 0, -.2], m.brass);
  warningPlate(crane, m, prefix + '-crane-shoulder-warning', [-.12, .48, -.69], [.99, .32], [0, 0, -.2]);
  blade(crane, m.iron, prefix + '-elbow-shield', [[-2.36, 2.37], [-2.23, 3.19], [-1.54, 3.49], [-1.08, 2.92], [-1.26, 2.28]], .2, [0, 0, -.48]);
  cyl(crane, m.brass, prefix + '-elbow-oversized-pin', [-1.75, 2.72, -.64], .25, .15, 'z', 14);
  beam(crane, m.blood, prefix + '-crane-reinforced-backbone', [-.27, .42, .1], [-5.55, 7.35, .1], .13);
  chain(crane, m, prefix + '-crane-restraint-chain', [[.28, .4, -.78], [-1.5, 1.3, -.79], [-2.34, 2.55, -.71]], 18);

  // Exposed winch remains the readable weak point; only its rim gains a brutal
  // toothed reduction gear. The cable winding is deliberately not covered.
  forgedRim(winch, m, prefix + '-visible-winch-reduction-gear', [0, 0, -1.58], 1.34, 16);
  for (const side of [-1, 1]) {
    const armor = group(motion, prefix + '-segmented-hull-armour-' + side);
    for (let index = 0; index < 3; index++) {
      const x = -2.95 + index * 2.0, height = index === 1 ? 1.82 : 1.48;
      blade(armor, index === 1 ? m.blood : m.iron, prefix + '-capture-barge-flank-' + side + '-' + index, [[-1, height * .45], [.91, height * .42], [1.1, -.45], [.57, -.94], [-.82, -.73]], .2, [x, -.18, side * 2.38]);
      for (const dx of [-.65, .58]) sphere(armor, m.brass, prefix + '-armour-rivet-' + side + '-' + index + '-' + dx, [x + dx, .28, side * 2.52], [.09, .09, .06], 8);
    }
    const mandible = group(motion, prefix + '-horned-capture-bumper-' + side, [-4.22, -.08, side * 2.12]);
    blade(mandible, m.iron, prefix + '-bow-mandible-' + side, [[.21, -.68], [-.82, -.35], [-1.55, .52], [-2.07, 1.52], [-1.97, 2.26], [-1.56, 1.48], [-.73, 1.02], [.29, .52]], .34);
    blade(mandible, m.blood, prefix + '-mandible-painted-root-' + side, [[.12, -.43], [-.69, -.2], [-1.28, .44], [-1.03, .72], [-.42, .51], [.2, .28]], .12, [0, 0, -.09]);
  }
  const face = group(motion, prefix + '-capture-bow-face', [-5.05, .62, 0], [0, -Math.PI / 2, 0]);
  eye(face, m, prefix + '-left-industrial-watch-slit', [-1.0, .15, .16], [1.35, .12, .14], [0, 0, -.17]);
  eye(face, m, prefix + '-right-industrial-watch-slit', [1.0, .15, .16], [1.35, .12, .14], [0, 0, .17]);
  warningPlate(face, m, prefix + '-front-capture-crossbar', [0, -.42, .22], [3.7, .42]);
  for (const side of [-1, 1]) chain(motion, m, prefix + '-hanging-prison-chain-' + side, [[-4.2, -.55, side * 2.5], [-2.9, -2.67, side * 2.75], [-.62, -1.12, side * 2.5]], 25);
  // The paired horns are broad forged bumper plates; no generic spike rows.
  return describe(built, '포획하는 산업 괴물 — 톱니 집게와 구속 윈치를 가진 인양선', ['three-massive-serrated-capture-jaws', 'reinforced-open-truss-with-armoured-elbow', 'exposed-toothed-winch-reduction-gear', 'paired-forged-mandible-bumpers', 'large-segmented-iron-and-crimson-flanks', 'black-and-ochre-load-warning-panels', 'sagging-restraint-chains', 'narrow-angled-industrial-watch-slits']);
}

export function buildUnionRepair(ctx) {
  const built = buildBaseRepair(ctx);
  const { id, motion, m } = ctx, prefix = id + '-v2';
  const workshop = required(ctx, 'long-multiwindow-workshop');
  const front = required(ctx, 'fore-facing-workshop-windows');
  const highRoot = required(ctx, 'high-side-hydraulic-repair-boom');
  const lowRoot = required(ctx, 'lower-side-hydraulic-repair-boom');
  const highElbow = required(ctx, 'high-side-hydraulic-repair-boom-elbow');
  const lowElbow = required(ctx, 'lower-side-hydraulic-repair-boom-elbow');
  const highBasket = required(ctx, 'high-side-hydraulic-repair-boom-lantern-basket');
  const lowBasket = required(ctx, 'lower-side-hydraulic-repair-boom-lantern-basket');

  // Keep the multiwindow workshop identity while replacing the broad homely
  // glow with shuttered forge slots. No bedroom roof or domestic chimney.
  workshop.traverse(node => {
    if (node.isMesh && node.name.includes('-amber-glass')) { node.material = m.evilGlow; node.scale.y *= .36; }
  });
  for (const side of [-1, 1]) {
    for (let index = 0; index < 4; index++) {
      const x = -2.18 + index * 1.43;
      panel(workshop, m.iron, prefix + '-sloped-forge-window-brow-' + side + '-' + index, [x, 1.48, side * 2.11], [1.27, .35, .13], [0, 0, index < 2 ? -.14 : .14], m.brass);
      panel(workshop, index % 2 ? m.blood : m.iron, prefix + '-lower-forge-armour-' + side + '-' + index, [x, .35, side * 2.02], [1.22, .55, .14], [0, 0, (index % 2 ? 1 : -1) * .055], m.brass);
    }
    beam(workshop, m.iron, prefix + '-heavy-roof-edge-' + side, [-3.18, 2.34, side * 2.08], [3.18, 2.34, side * 2.08], .14);
  }
  for (const side of [-1, 1]) {
    eye(front, m, prefix + '-canted-front-forge-eye-' + side, [side * .91, 1.15, .21], [1.18, .115, .11], [0, 0, side * .19]);
    blade(front, m.blood, prefix + '-front-forge-visor-' + side, [[-.72, .18], [.66, .43], [.72, .64], [-.71, .52]], .14, [side * .91, 1.18, .27], [0, 0, side * .08]);
  }
  warningPlate(front, m, prefix + '-forge-door-warning', [0, .34, .24], [2.8, .3]);

  // Mismatched outboard exhausts stay outside the retained single envelope.
  // Their broad elbows and flared dark mouths change the workshop skyline.
  flue(motion, m, prefix + '-tall-outboard-furnace-stack', [[3.9, 2.58, 2.2], [3.9, 4.45, 2.48], [3.27, 5.14, 2.76]], .34);
  flue(motion, m, prefix + '-short-bent-quench-stack', [[4.46, 2.55, -2.2], [4.46, 3.57, -2.45], [5.17, 3.99, -2.61]], .27);
  for (const [index, at] of [[0, [3.9, 3.12, 2.28]], [1, [4.46, 3.1, -2.34]]]) {
    ring(motion, m.brass, prefix + '-furnace-stack-binding-' + index, at, index ? .32 : .4, .065, 'y');
  }

  // Distinct end tools: an oversized disassembly vice on the high arm and a
  // guarded tooth saw on the low arm. Both are children of existing tool bones.
  wristVice(highBasket, m, prefix + '-high-arm-demolition-vice');
  demolitionSaw(lowBasket, m, prefix + '-low-arm-cutting-saw');
  for (const [name, rootBone, elbowBone] of [['high', highRoot, highElbow], ['low', lowRoot, lowElbow]]) {
    panel(rootBone, m.blood, prefix + '-' + name + '-arm-shoulder-shield', [0, 0, -.39], [.9, .72, .22], [0, 0, -.12], m.brass);
    warningPlate(rootBone, m, prefix + '-' + name + '-shoulder-warning', [0, .12, -.55], [.71, .25], [0, 0, -.12]);
    blade(elbowBone, m.iron, prefix + '-' + name + '-arm-elbow-protector', [[-.4, -.26], [.37, -.3], [.56, .26], [.13, .55], [-.39, .3]], .2, [0, 0, -.37]);
    cyl(elbowBone, m.brass, prefix + '-' + name + '-oversized-elbow-fastener', [0, 0, -.54], .21, .14, 'z', 12);
  }

  // A suspended workshop seal hangs underneath the retained burgundy flag.
  const sign = group(motion, prefix + '-suspended-disassembly-mark', [3.57, 3.52, -2.22]);
  chain(motion, m, prefix + '-workshop-sign-left-chain', [[3.16, 4.05, -2.2], [3.14, 3.88, -2.25], [3.18, 3.72, -2.22]], 5);
  chain(motion, m, prefix + '-workshop-sign-right-chain', [[3.99, 4.05, -2.2], [4.03, 3.87, -2.25], [3.99, 3.72, -2.22]], 5);
  blade(sign, m.blood, prefix + '-forged-hanging-mark', [[-.55, .3], [.55, .3], [.48, -.39], [0, -.72], [-.48, -.39]], .13, [0, 0, -.07]);
  beam(sign, m.bone, prefix + '-mark-crossed-tool-a', [-.28, .12, -.13], [.27, -.36, -.13], .038);
  beam(sign, m.bone, prefix + '-mark-crossed-tool-b', [.28, .12, -.13], [-.27, -.36, -.13], .038);
  ring(sign, m.bone, prefix + '-mark-socket', [0, -.1, -.15], .16, .04, 'z');

  const furnace = group(motion, prefix + '-foredeck-heat-treatment-drum', [-2.28, .88, 1.11]);
  cyl(furnace, m.iron, prefix + '-quench-drum-body', [0, 0, 0], .47, 1.1, 'y', 16);
  for (const y of [-.48, .43]) ring(furnace, m.blood, prefix + '-quench-drum-clamp-' + y, [0, y, 0], .49, .08, 'y');
  warningPlate(furnace, m, prefix + '-quench-drum-warning', [0, .03, -.46], [.64, .3]);
  eye(furnace, m, prefix + '-hot-work-pressure-slit', [0, .38, -.47], [.36, .08, .05], [0, 0, 0]);

  return describe(built, '불길한 해체 공방 — 집게와 톱 수리팔을 가진 이동식 산업 해체선', ['shuttered-orange-forge-windows', 'canted-heavy-workshop-brows', 'crimson-and-iron-workshop-armour', 'asymmetric-outboard-bent-furnace-stacks', 'oversized-high-arm-demolition-vice', 'guarded-low-arm-tooth-saw', 'armoured-existing-hydraulic-joints', 'suspended-crossed-tools-workshop-mark', 'foredeck-warning-banded-heat-treatment-drum']);
}
