import { buildGhostChaser as buildGhostBase, buildDisguisedWreck as buildWreckBase } from '../ghost-wreck.js';
import { THREE, group, box, sphere, tube, beam, ring, cloth, lantern, control } from '../kit.js';
import { blade, spike, chain, eye, describe } from './style.js';

// These wrappers add threatening, handmade silhouettes. The original source,
// existing weakpoint IDs, camouflage pivots and their deployment contract stay
// intact. Added blades, teeth, eyes and lamps are visual art, never new weapons.

function ghostWing(ctx, side, paleBone) {
  const { id, motion, m, controls } = ctx, name = id + '-v2-curse-wing-' + side;
  const wing = group(motion, name, [.2, 4.2, side * 1.78], [side * .5, side * -.13, .08]);
  blade(wing, m.gray, name + '-broad-hooked-linen', [[-.4, .8], [2.1, 2], [4.8, 1.7], [7.2, .48], [5.8, .12], [6.1, -.45], [4.8, -.13], [4.75, -1.1], [3.7, -.72], [2.8, -2.12], [2.2, -.78], [.6, -1.18], [.9, -.16], [-.4, -.35]], .055, [0, 0, side < 0 ? -.055 : 0]);
  tube(wing, paleBone, name + '-bent-leading-spine', [[-.6, .77, 0], [1.1, 1.85, 0], [3.3, 2.06, 0], [5.7, 1.25, 0], [7.35, .45, 0]], .12, 28);
  for (let index = 0; index < 4; index++) {
    const x = index * 1.45 + .45;
    tube(wing, m.iron, name + '-crooked-rib-' + index, [[x, 1.5, -.015], [x + .25, .5, .08], [x + .67, -.55 - index % 2 * .5, .07]], .065, 13);
    for (let stitch = 0; stitch < 4; stitch++) beam(wing, m.rope, name + '-ragged-seam-' + index + '-' + stitch, [x + .12 + stitch * .13, .28, side * .055], [x + .05 + stitch * .13, .05, side * .055], .022);
  }
  spike(wing, paleBone, name + '-hooked-tip', [6.35, .9, 0], [7.9, -.1, 0], .21);
  control(controls, wing, 'sail', 'x', .023);
  return wing;
}

export function buildGhostChaser(ctx) {
  const built = buildGhostBase(ctx), { id, motion, m, controls } = ctx;
  const paleBone = m.bone.clone(); paleBone.color.setHex(0xc2d0cd); paleBone.name = id + '-v2-cold-painted-bone';
  const cyan = m.evilGlow || m.coldGlow;
  const crest = group(motion, id + '-v2-executioner-spine');
  tube(crest, paleBone, id + '-v2-large-crooked-dorsal-spine', [[-6.7, 4.3, 0], [-4.7, 7.15, 0], [-1.3, 7.72, 0], [2.2, 7.3, 0], [5.3, 5.9, 0], [7.3, 3.35, 0]], .17, 32);
  for (const side of [-1, 1]) {
    ghostWing(ctx, side, paleBone);
    for (let index = 0; index < 4; index++) {
      const x = -4.8 + index * 2.6;
      tube(crest, index % 2 ? m.iron : paleBone, id + '-v2-big-bending-spine-rib-' + side + '-' + index, [[x, .18, side * .91], [x + .24, 2.6, side * 2.37], [x + .58, 5.1, side * 2.72], [x + .9, 7.24 - index * .19, side * 1.42], [x + 1.7, 7.72 - index * .18, side * .5]], .115, 24);
      ring(crest, m.iron, id + '-v2-rib-stitched-collar-' + side + '-' + index, [x + .25, 2.72, side * 2.35], .19, .037, 'x');
      if (index < 3) spike(crest, paleBone, id + '-v2-rib-horn-' + side + '-' + index, [x + .83, 7.12, side * 1.54], [x + 1.7, 8.38 - index * .23, side * 1.87], .17);
    }
    const jaw = group(motion, id + '-v2-executioner-spear-jaw-' + side);
    tube(jaw, m.iron, id + '-v2-long-forged-jaw-' + side, [[-5.8, -.15, side * 1.08], [-8.2, .08, side * .87], [-10.2, .5, side * .53], [-11.9, .73, side * .06]], .12, 25);
    tube(jaw, cyan, id + '-v2-cyan-spear-edge-' + side, [[-5.4, -.05, side * 1.19], [-7.8, .25, side * .97], [-10.1, .63, side * .61], [-11.9, .76, side * .09]], .065, 25);
    for (let tooth = 0; tooth < 5; tooth++) {
      const x = -6.4 - tooth * 1.03, z = side * (1.08 - tooth * .17);
      spike(jaw, tooth % 2 ? cyan : paleBone, id + '-v2-cursed-spear-tooth-' + side + '-' + tooth, [x, .11 + tooth * .11, z], [x - .48, -.58 + tooth * .19, z - side * .2], .105 + tooth * .009);
    }
    eye(jaw, { ...m, evilGlow: cyan }, id + '-v2-cold-hunter-eye-' + side, [-5.2, .34, side * 1.3], [1.55, .13, .085], [0, 0, side * -.16]);
    for (let index = 0; index < 2; index++) {
      const lampRoot = group(motion, id + '-v2-floating-curse-lamp-' + side + '-' + index, [-2.7 + index * 5.3, -1.8 - index * .42, side * (2.6 + index * .38)]);
      chain(lampRoot, m, id + '-v2-curse-lamp-chain-' + side + '-' + index, [[0, 1.1, 0], [.25, .2, side * .17], [0, -.58, 0]], 9);
      lantern(lampRoot, { ...m, glow: cyan }, id + '-v2-curse-lantern-' + side + '-' + index, [0, -.87, 0], .42);
      spike(lampRoot, paleBone, id + '-v2-curse-lantern-fang-' + side + '-' + index, [0, -1.1, 0], [.12, -1.8, 0], .095);
      control(controls, lampRoot, 'sail', 'z', .033);
    }
  }
  // Bone-grey claws and torn grey sails keep this ghost distinct from the
  // crimson/soot palette of the other villains; cyan is confined to edges/gaps.
  return describe(built, '뼈회색 처형자 창과 유령 가오리 날개, 냉청록 저주등', [
    'large-hooked-bone-spine-and-ribs', 'broad-swept-ragged-grey-manta-wings',
    'long-cyan-toothed-executioner-prow', 'four-suspended-cold-curse-lanterns',
    'grey-linen-envelope-remains-visible-between-ribs',
  ]);
}

function wreckJaw(ctx, fold, side) {
  const { id, m } = ctx, name = id + '-v2-trap-jaw-' + side;
  const jaw = group(fold, name);
  tube(jaw, m.iron, name + '-bent-harpoon-gullet', [[-4.1, -.25, side * 1.45], [-5.8, .7, side * 2.02], [-6.25, 2.5, side * 1.57], [-5.4, 4.03, side * .72], [-4.35, 3.28, side * .15]], .2, 29);
  tube(jaw, m.wood, name + '-warped-wooden-mandible', [[-3.6, -.7, side * 1.37], [-5.15, -.12, side * 1.96], [-6.1, 1.35, side * 1.92]], .15, 20);
  for (let index = 0; index < 5; index++) {
    const t = index / 4, y = .37 + t * 2.78, x = -5.9 + Math.abs(t - .5) * .8;
    spike(jaw, index % 2 ? m.bone : m.iron, name + '-hooked-mouth-tooth-' + index, [x, y, side * (1.72 - t * .5)], [x - .12, y -.22, side * (.36 - t * .24)], .14 + index % 2 * .045);
  }
  for (let plate = 0; plate < 4; plate++) {
    const x = -2.9 + plate * 1.92, z = side * (2.2 - plate % 2 * .2);
    blade(jaw, plate % 2 ? m.iron : m.wood, name + '-asymmetric-stapled-scrap-' + plate, [[-.7, -.36], [-.4, .9], [.63, .52], [1.02, -.23], [.33, -.61]], .1, [x, 1.65 + plate % 2 * .56, z], [side * .15, 0, (plate % 2 ? -.28 : .2)]);
    for (let stitch = 0; stitch < 3; stitch++) beam(jaw, m.rope, name + '-crude-shell-stitch-' + plate + '-' + stitch, [x -.4 + stitch * .3, 1.47 + plate % 2 * .56, z + side * .1], [x -.3 + stitch * .3, 1.83 + plate % 2 * .56, z + side * .1], .035);
    spike(jaw, m.iron, name + '-splayed-scrap-spike-' + plate, [x, 2.1 + plate % 2 * .5, z], [x + .7, 3.23 + plate % 2 * .6, z + side * .44], .15);
  }
  for (let index = 0; index < 2; index++) {
    const at = [1.2 + index * 2.2, 1.2 + index * .7, side * 2.18];
    const dead = group(jaw, name + '-dead-lamp-' + index, at);
    lantern(dead, { ...m, glow: m.dark }, name + '-cold-dead-lantern-' + index, [0, 0, 0], .33);
    chain(dead, m, name + '-dead-lamp-slack-chain-' + index, [[0, .73, 0], [.14, 1, .03], [.4, 1.32, 0]], 6);
  }
  return jaw;
}

export function buildDisguisedWreck(ctx) {
  const built = buildWreckBase(ctx), { id, motion, m } = ctx;
  const folds = built.deployRig?.nodeNames.map(name => ctx.scene.getObjectByName(name));
  if (!folds || folds.length !== 3 || folds.some(node => !node)) throw new Error('Original camouflage deployment bones are required');
  wreckJaw(ctx, folds[0], -1); wreckJaw(ctx, folds[1], 1);
  // Outer additions inherit the SAME three original pivots. Nothing is left
  // hanging over the mouth when the original AmbushReveal clip opens them.
  const curtain = folds[2], name = id + '-v2-stitched-bow-mask';
  blade(curtain, m.wood, name + '-broken-mask-board', [[-1.6, .15], [-1.1, .8], [.15, .43], [.9, 1.04], [1.6, -.12], [.64, -.72], [-.32, -.37], [-1.08, -.81]], .14, [0, -.66, -.1], [0, Math.PI / 2, -.09]);
  for (let index = 0; index < 5; index++) beam(curtain, m.rope, name + '-uneven-staple-' + index, [-.12, -1.12 + index * .25, -.81 + index * .33], [.15, -.98 + index * .25, -.7 + index * .33], .035);
  const interior = group(motion, id + '-v2-red-inner-threat');
  for (const side of [-1, 1]) {
    eye(interior, m, id + '-v2-inner-trap-eye-' + side, [-2.32, .9, side * 1.36], [1.45, .19, .095], [0, 0, side * -.2]);
    tube(interior, m.blood, id + '-v2-inner-rust-brow-' + side, [[-3.3, 1.22, side * 1.34], [-2.7, 1.32, side * 1.52], [-1.6, 1.05, side * 1.39]], .09, 14);
    const claw = group(interior, id + '-v2-inner-iron-claw-' + side);
    tube(claw, m.iron, id + '-v2-claw-crooked-wrist-' + side, [[-1.7, -.12, side * 1.18], [-3.18, -.4, side * 1.9], [-4.6, -.55, side * 1.75]], .17, 18);
    for (let finger = 0; finger < 3; finger++) {
      const y = -.55 + (finger - 1) * .39;
      tube(claw, m.iron, id + '-v2-claw-curved-finger-' + side + '-' + finger, [[-4.2, y, side * (1.77 + (finger - 1) * .15)], [-5.15, y -.32, side * 1.9], [-5.62, y -.15, side * 1.31]], .09, 16);
      spike(claw, m.bone, id + '-v2-claw-finger-tip-' + side + '-' + finger, [-5.59, y -.15, side * 1.32], [-5.78, y + .05, side * .89], .085);
    }
    for (let tooth = 0; tooth < 4; tooth++) spike(interior, tooth % 2 ? m.bone : m.iron, id + '-v2-inner-hull-fang-' + side + '-' + tooth, [-2.3 + tooth * 1.38, -.55, side * .88], [-2.55 + tooth * 1.38, -1.45 - tooth % 2 * .28, side * .59], .13);
  }
  sphere(interior, m.iron, id + '-v2-closed-gear-jaw-hub', [-3.8, -.44, 0], [.46, .7, .7], 12);
  built.deployRig.description += ' 악당 외형의 아가리·봉합 폐철판·죽은 등도 기존 외피3본의 자식으로 전개하며, 내부 눈·이빨·집게는 표시용 장식이다.';
  return describe(built, '둥근 폐선으로 위장한 봉합 덫의 아가리와 안쪽 붉은 눈·쇠집게', [
    'folding-hooked-trap-mandibles', 'crooked-harpoon-mouth-and-bone-teeth',
    'asymmetric-stapled-scrap-shell', 'dead-lamps-on-the-folding-shell',
    'concealed-rust-red-threat-eyes', 'two-hidden-three-finger-iron-claws',
    'original-three-deployment-bones-and-weakpoints-preserved',
  ]);
}
