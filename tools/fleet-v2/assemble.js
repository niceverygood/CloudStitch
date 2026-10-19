import * as THREE from 'three';
import { makeDevice } from '../fleet/devices.js';
import { bone, tube, mesh, box, ellipsoid, ring, beam, sculptHull, cloth, makeBalloon, cabin, lattice } from './geometry.js';

const weaponKeys = { machineGuns: 'machinegun', cannons: 'cannon', mortars: 'mortar', harpoons: 'harpoon', chainCannons: 'chainshot', flamethrowers: 'flame' };
const otherKeys = { winches: 'hook', armor: 'armor', repairArms: 'repair', rescueCapsules: 'rescue', smokeEmitters: 'smoke', bell: 'bell', tank: 'tank', rail: 'rail', storage: 'storage', crane: 'crane', sail: 'sail' };

function materialSet(base, palette, id) {
  const m = Object.fromEntries(Object.entries(base).map(([key, value]) => [key, value.clone()]));
  const tint = (key, source, color) => { m[key] = m[source].clone(); m[key].color.set(color); m[key].name = id + ' painted ' + key; };
  tint('trim', 'teal', 0x78a39a); tint('deck', 'wood', 0xe5c188); tint('envelope', 'canvas', 0xfff8df);
  if (palette === 'cult' || palette === 'royal') { tint('metal', 'canvas', 0x8699a1); tint('dark', 'canvas', 0x4b5f6a); tint('trim', 'brass', 0xe1c58a); tint('deck', 'wood', 0x89999b); tint('envelope', 'canvas', 0xf9efd2); }
  if (palette === 'union') { tint('metal', 'metal', 0xb76648); tint('dark', 'metal', 0x424f50); tint('trim', 'metal', 0x548c87); tint('deck', 'metal', 0x9c8770); tint('envelope', 'canvas', 0x8faea5); }
  if (palette === 'ghost') { tint('wood', 'wood', 0x526675); tint('darkWood', 'wood', 0x344750); tint('metal', 'metal', 0x63757b); tint('dark', 'metal', 0x202d3c); tint('trim', 'metal', 0x718e99); tint('deck', 'wood', 0x596c73); tint('envelope', 'canvas', 0x42546a); tint('navy', 'canvas', 0x344257); }
  if (palette === 'salvager') { tint('trim', 'metal', 0xc17c57); tint('envelope', 'canvas', 0xdfcba5); }
  m.glow = new THREE.MeshBasicMaterial({ color: palette === 'ghost' ? 0xb4e1d7 : 0xe9bc70, toneMapped: false }); m.glow.name = id + ' residual paint light';
  return m;
}

export function assembleShipV2(ship, profile, sourceArt, baseMaterials) {
  const scene = new THREE.Scene(); scene.name = 'Cloudstitch_identity_v2_' + ship.id;
  const rigRoot = bone('RigRoot', scene), motion = bone('HullMotion', rigRoot);
  motion.userData = { moduleId: 'root', moduleType: 'assembly', parentId: null };
  const controls = [], m = materialSet(baseMaterials, profile.palette, ship.id), p = profile;
  const art = { ...sourceArt, ...(p.artModules || {}) };
  for (const [key, count] of Object.entries(ship.modules)) if (Number.isInteger(count)) art[key] = count;
  const L = p.length, W = p.width, D = p.depth, family = p.family;
  const style = p.palette === 'union' ? 'union' : p.palette === 'ghost' ? 'ghost' : p.palette === 'cult' ? 'cult' : 'warm';
  const module = (id, type, at = [0, 0, 0], parent = motion) => { const root = bone(id, parent, at); root.userData = { moduleId: id, moduleType: type, parentId: parent.userData?.moduleId || parent.name }; return root; };
  const feature = (suffix, role, at = [0, 0, 0], parent = motion) => { const root = module(ship.id + '-' + suffix, 'structure', at, parent); Object.assign(root.userData, { structuralRole: role, featureId: role }); return root; };
  const device = (type, index, at, scale = 1, parent = motion, extra = {}) => {
    const item = makeDevice(THREE, { id: ship.id + '-' + type + '-' + index, type, materials: m, style: { torn: p.palette === 'ghost' || family === 'wreck-crab', materials: type === 'tank' && p.palette === 'cult' ? { teal: 'dark', metal: 'dark' } : type === 'bell' && p.palette === 'cult' ? { wood: 'trim' } : {} } });
    item.root.position.fromArray(at); item.root.scale.setScalar(scale); parent.add(item.root); item.root.userData.parentId = parent.userData?.moduleId || parent.name; Object.assign(item.root.userData, extra); controls.push(...item.controls);
    if (type === 'sail' && p.palette === 'ghost') {
      const old = []; item.root.traverse(child => { if (child.isMesh && child.name.includes('BowedPaintedSail')) old.push(child); });
      for (const child of old) { const holder = child.parent; child.removeFromParent(); child.geometry.dispose(); const torn = cloth(holder, m, ship.id + '-torn-mast-cloth-' + index, { width: 1.55, height: 1.8, ragged: true, color: 'navy', drape: .22 }); torn.rotation.y = Math.PI / 2; }
    }
    return item;
  };
  const hull = (suffix, opts, at = [0, 0, 0], parent = motion) => { const root = sculptHull(parent, { id: ship.id + '-' + suffix, length: L, width: W, depth: D, materials: m, ...opts }); root.position.fromArray(at); return root; };
  let primary, externalDeck = null;

  if (family === 'shipyard' || ship.id === 'boss-shipyard-ribs') {
    for (let zone = 0; zone < 3; zone++) {
      const z = feature('dock-zone-' + zone, 'horizontalDockZones', [(zone - 1) * 12, 0, 0]);
      for (const side of [-1, 1]) {
        sculptHull(z, { id: ship.id + '-dock-rail-' + zone + '-' + side, length: 12, width: 2.4, depth: 1.4, form: 'barge', materials: m, surface: 'metal' }).position.set(0, -.4, side * 5.6);
        for (let i = 0; i < 4; i++) {
          const x = i * 3 - 4.5;
          tube(z, [[x, 0, side * 6], [x, 4.3, side * 6.4], [x - .35, 8.1, side * 3.7], [x - 1.1, 9.2, side * 2]], .21, m.metal, 'forged-rib-' + zone + '-' + side + '-' + i, 14);
          beam(z, m.trim, 'rib-brace-' + zone + '-' + side + '-' + i, [x, .3, side * 6], [x, 3.2, side * 3.6], .11);
        }
        box(z, m.dark, 'dock-gate-' + zone + '-' + side, [-5.8, 2, side * 4.8], [.35, 4.2, 2]);
        box(z, m.glow, 'gate-worklight-' + zone + '-' + side, [-6, 3.2, side * 4.8], [.08, .35, 1]);
      }
    }
    for (let i = 0; i < 2; i++) device('crane', i + 1, [-11 + i * 4, 0, i ? -5.6 : 5.6], 2.4, motion, { structuralRole: 'stage1HookCranes', featureId: 'stage1HookCranes' });
    for (let i = 0; i < 3; i++) {
      const root = feature('pressure-vent-' + i, 'stage2Vents', [i * 3 - 3, .5, 5.6]);
      mesh(root, new THREE.CylinderGeometry(.75, 1.1, 2.4, 12), m.coral, 'furnace-vent-' + i, [0, 1, 0]);
      const cap = bone(ship.id + '-vent-cap-' + i, root, [0, 2.35, 0]); ring(cap, m.trim, 'vent-rim-' + i, [0, 0, 0], 1.1, .17); controls.push({ bone: cap, role: 'valve', axis: 'x', amplitude: .3 });
    }
    for (let i = 0; i < 2; i++) { const r = feature('cooling-pump-' + i, 'stage2CoolingPumps', [i ? 4 : -4, .2, -5.6]); ellipsoid(r, m.teal, 'pump-pressure-' + i, [0, 1.5, 0], [1.4, 1.8, 1.2]); tube(r, [[0, 1, 0], [0, 3, 1], [2, 3, 1]], .22, m.brass, 'coolant-pipe-' + i, 12); }
    Object.assign(art, Object.fromEntries(Object.keys(art).map(key => [key, 0])), { crane: 2 });
  } else if (family === 'pressure-sanctum' || ship.id === 'boss-last-inhale') {
    const heart = feature('sealed-heart', 'centralSealedHeart', [0, 2, 0]);
    ellipsoid(heart, m.dark, 'folded-pressure-shell', [0, 0, 0], [4.6, 5.1, 4.6], 16);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      tube(heart, [[Math.cos(a) * 1, -4.6, Math.sin(a)], [Math.cos(a) * 4.7, -1, Math.sin(a) * 4.7], [Math.cos(a) * 3.8, 3.3, Math.sin(a) * 3.8], [Math.cos(a) * 1.1, 5.4, Math.sin(a) * 1.1]], .17, m.brass, 'sealed-loom-rib-' + i, 22);
    }
    ring(heart, m.trim, 'central-seal-collar', [0, 0, 0], 4.85, .22); ring(heart, m.canvas, 'cream-seal-band', [0, 1.1, 0], 4.65, .13);
    controls.push({ bone: heart, role: 'envelope', axis: 'y', amplitude: .004 });
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3, x = Math.cos(a) * 13, z = Math.sin(a) * 13;
      const tower = feature('seal-tower-' + i, 'sealingTowers', [x, 0, z]);
      sculptHull(tower, { id: ship.id + '-tower-plinth-' + i, length: 4, width: 4, depth: 1.8, form: 'bastion', materials: m, surface: 'metal' });
      for (let j = 0; j < 3; j++) box(tower, j % 2 ? m.dark : m.metal, 'tower-layer-' + i + '-' + j, [0, 1.4 + j * 1.6, 0], [2.6 - j * .35, 1.7, 2.6 - j * .35]);
      mesh(tower, new THREE.ConeGeometry(1.8, 2.3, 4), m.trim, 'spire-of-pressure-' + i, [0, 6, 0], [0, Math.PI / 4, 0]);
      cloth(tower, m, 'tower-seal-cloth-' + i, { at: [-1.4, 4.8, -1.3], width: 2.6, height: 3.8, color: 'canvas', drape: .28 });
      const connector = feature('heart-connection-' + i, 'heartConnectionPoints', [Math.cos(a) * 4.8, 0, Math.sin(a) * 4.8], heart); ring(connector, m.teal, 'release-seal-' + i, [0, 0, 0], .65, .15);
      tube(motion, [[Math.cos(a) * 4.6, 1, Math.sin(a) * 4.6], [Math.cos(a) * 8, -.8, Math.sin(a) * 8], [x, 2.6, z]], .15, m.rope, 'pressure-tether-' + i, 24);
    }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; const d = feature('cover-' + i, 'movingDebrisCover', [Math.cos(a) * 8, -2, Math.sin(a) * 8]); mesh(d, new THREE.DodecahedronGeometry(1.2), m.metal, 'floating-masonry-' + i); }
    for (let i = 0; i < 2; i++) { const d = feature('repair-pocket-' + i, 'safeRepairPockets', [i ? 15 : -15, -1, 5]); sculptHull(d, { id: ship.id + '-pocket-' + i, length: 4, width: 3, depth: .7, form: 'cradle', materials: m, surface: 'wood' }); device('repair', i + 1, [0, .3, 0], .8, d); }
    Object.assign(art, Object.fromEntries(Object.keys(art).map(key => [key, 0])), { repairArms: 2 });
  } else {
    const twin = /catamaran|industrial-tug|industrial-fortress|rescue-platform|civil-shelter/.test(family);
    const cult = /cult-bastion|cult-cathedral/.test(family);
    const ghost = /ghost-spear|ghost-crown/.test(family);
    const wreck = family === 'wreck-crab';
    const form = cult ? 'bastion' : ghost ? 'blade' : /barge|cargo|fortress|tug/.test(family) ? 'barge' : /crescent/.test(family) ? 'crescent' : 'skiff';
    if (family === 'ghost-crown') {
      for (const side of [-1, 1]) hull('crescent-rail-' + side, { length: L, width: W * .25, depth: D * .72, form: 'crescent', surface: 'metal', open: true }, [side < 0 ? -.5 : .5, 0, side * W * .4]);
      primary = module(ship.id + '-open-crown-bridge', 'hull');
      for (const x of [-L * .27, L * .3]) lattice(primary, m, 'memory-bridge-' + x, [x, .2, -W * .4], [x, .2, W * .4], .16, 7);
      for (let i = 0; i < 3; i++) {
        const cradle = feature('memory-cradle-' + i, 'memoryCradles', [L * (i / 3 - .35), -.8, 0]);
        ring(cradle, m.metal, 'cradle-frame-' + i, [0, 0, 0], 1.05, .12, [0, Math.PI / 2, 0]);
        box(cradle, m.dark, 'sealed-memory-casket-' + i, [0, 0, 0], [1.3, .85, .85]);
        box(cradle, m.glow, 'memory-name-plate-' + i, [-.67, 0, 0], [.03, .25, .35]);
      }
    } else if (twin) {
      for (const side of [-1, 1]) hull('pontoon-' + side, { length: L * .86, width: W * .27, depth: D, form: 'cradle', surface: p.palette === 'union' ? 'metal' : 'wood' }, [side < 0 ? -.3 : .5, -.5, side * W * .37]);
      primary = module(ship.id + '-work-deck', 'hull');
      for (let i = 0; i < 7; i++) { const x = (i / 6 - .5) * L * .7; beam(primary, m.dark, 'cross-deck-girder-' + i, [x, 0, -W * .42], [x, 0, W * .42], .12); }
      box(primary, m.deck, 'central-working-deck', [L * .09, .12, 0], [L * .56, .17, W * .85]);
      if (family === 'industrial-tug') { box(primary, m.dark, 'open-forward-work-well', [-L * .28, -.4, 0], [L * .22, .1, W * .5]); lattice(motion, m, 'left-hoist-boom', [L * .2, .5, -W * .4], [-L * .4, D + 6, -W * .28], .5); }
    } else primary = hull('main-hull', { form, surface: cult || ghost || family === 'tax-barge' ? 'metal' : 'wood', open: wreck });
    if (ghost) {
      for (const side of [-1, 1]) {
        tube(primary, [[-L * .53, .3, side * .15], [-L * .3, -.6, side * W * .5], [L * .33, -.2, side * W * .45], [L * .52, .5, side * W * .13]], .12, m.dark, 'fractured-keel-rail-' + side, 22);
        for (let i = 0; i < 6; i++) { const x = L * (i / 6 - .45); beam(primary, m.metal, 'exposed-rib-' + side + '-' + i, [x, -.4, side * W * .2], [x + L * .08, 1.4 + (i % 3) * .3, side * W * .5], .075); }
      }
      for (let i = 0; i < 5; i++) box(primary, m.glow, 'cold-memory-seam-' + i, [L * (i / 5 - .35), -.3, -W * .48], [L * .07, .035, .05]);
    }
    if (cult) {
      for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
        const x = L * (i / 5 - .4), openHall = family === 'cult-cathedral' && i > 0 && i < 4;
        box(primary, m.dark, 'sloping-casemate-' + side + '-' + i, [x, openHall ? -.6 : .75, side * W * .43], [L * .19, D * (openHall ? .4 : family === 'cult-cathedral' ? .85 : 1.35), .26], [side * -.18, 0, 0]);
        beam(primary, m.brass, 'casemate-gold-frame-' + side + '-' + i, [x, -.8, side * W * .5], [x, D * 1.3, side * W * .33], .055);
      }
      if (p.palette === 'cult' || family === 'cult-cathedral') {
      const high = family === 'cult-cathedral' ? 7.2 : 4.2;
      for (const x of [-L * .25, L * .15]) for (const side of [-1, 1]) beam(motion, m.dark, 'bell-house-pier-' + x + '-' + side, [x, .2, side * W * .28], [x, high, side * W * .22], .15);
      // The bell must remain visible through the hall, including at game distance.
      // Narrow end banners leave the central span open rather than sealing it.
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        const x = L * (family === 'cult-cathedral' ? end * .32 : .25 + end * .06), width = L * (family === 'cult-cathedral' ? .11 : .095);
        cloth(motion, m, 'sealed-ivory-shroud-' + side + '-' + end, { at: [x, high + .4, side * W * .31], width, height: high * .6, color: 'canvas', side, drape: .18 });
        beam(motion, m.brass, 'shroud-top-rail-' + side + '-' + end, [x - width * .5, high + .4, side * W * .31], [x + width * .5, high + .4, side * W * .31], .065);
      }
      }
    }
    if (wreck) {
      for (let i = 0; i < 16; i++) {
        const a = i * 2.399, x = Math.sin(a) * L * .4, z = Math.cos(a) * W * .5;
        box(primary, i % 3 ? m.darkWood : m.deck, 'collapsed-wreck-spar-' + i, [x, .25 + (i % 5) * .2, z], [L * (.14 + i % 3 * .045), .13, .25 + i % 2 * .2], [.08 * (i % 3), a, .1 * (i % 2)]);
      }
      cloth(primary, m, 'collapsed-canvas-net', { at: [0, 1.2, -W * .3], width: L * .7, height: W * .6, horizontal: true, ragged: true, color: 'rope', drape: 1 });
      for (const side of [-1, 1]) lattice(primary, m, 'broken-crab-claw-' + side, [-L * .25, .2, side * W * .28], [-L * .54, 1.4, side * W * .63], .15, 4);
    }
    if (ship.id === 'enemy-tax-cutter') {
      const conn = feature('starboard-connector', 'starboardConnector', [0, .2, W * .5], primary);
      box(conn, m.metal, 'square-cuttable-parent-connector', [0, 0, 1], [1.1, .6, 2.1]);
      externalDeck = feature('external-deck', 'externalDeck', [0, .2, 2.25], conn); box(externalDeck, m.deck, 'tax-external-platform', [0, 0, 0], [4.5, .25, 2.4]); externalDeck.userData.subtreeTypes = ['cannon', 'auxiliaryEngine', 'auxiliaryBalloon'];
    }
    cabin(motion, m, ship.id + '-bridge', p.cabin, controls, style);
    const count = art.balloons || 0, env = p.envelope || {};
    for (let i = 0; i < count; i++) {
      const aux = externalDeck && i === 1;
      const offset = Array.isArray(env.offset) ? env.offset : [env.offset || 0, 0, 0];
      let z = (count === 1 ? 0 : (i - (count - 1) / 2) * W * .65) + (offset[2] || 0), y = (env.height || D + 3.5) + (offset[1] || 0), x = offset[0] || 0;
      if (env.layout === 'triad-low') { z = (i - (count - 1) / 2) * W * .38; y = D + 2 + (i % 2) * .5; }
      if (env.layout === 'low-inline') { x = (i - (count - 1) / 2) * L * .35; z = 0; y = 1.7; }
      if (cult) { y = family === 'cult-cathedral' ? 9 : env.height || 2.8; x = L * .2; }
      const radius = aux ? .8 : env.radius || Math.max(.8, W * .25), length = aux ? 3.7 : env.length || L * .68;
      const b = makeBalloon(aux ? externalDeck : motion, m, ship.id + '-balloon-' + (i + 1), { length, radius, flatten: env.flatten || 1, ragged: env.ragged || ghost, patched: p.palette === 'hero', at: aux ? [0, 3.1, 0] : [x, y, z] }, style, controls);
      if (ghost) b.rotation.z = i % 2 ? -.035 : .035;
      if (aux) b.userData.role = 'auxiliaryBalloon';
      else for (const side of [-1, 1]) for (const end of [-1, 1]) {
        const a = [end * L * .25, .25, side * W * .35], q = [x + end * length * .28, y - radius * .65, z + side * radius * .6];
        beam(motion, m.rope, 'suspension-' + i + '-' + side + '-' + end, a, q, cult ? .08 : .045);
      }
    }
    for (let i = 0; i < (art.engines || 0); i++) {
      const aux = externalDeck && i === 1, z = art.engines === 1 ? 0 : (i - (art.engines - 1) / 2) * W * .67;
      const pos = aux ? [1.3, .4, -.7] : [L * .43, ghost ? -.2 : D * .15, z];
      const e = device('engine', i + 1, pos, family === 'scout-skiff' ? 1.45 : ghost ? 1.25 : cult ? 1.1 : .95, aux ? externalDeck : motion); if (aux) e.root.userData.role = 'auxiliaryEngine';
      if (!aux) lattice(motion, m, 'engine-pylon-' + i, [L * .2, -.15, Math.sign(z) * W * .2], [pos[0] - .2, pos[1], pos[2]], .18, 3);
    }
    let gun = 0; const gunTotal = Object.keys(weaponKeys).reduce((n, key) => n + (art[key] || 0), 0);
    for (const [key, type] of Object.entries(weaponKeys)) for (let i = 0; i < (art[key] || 0); i++) {
      const aux = externalDeck && key === 'cannons';
      let pos = aux ? [-.5, .25, 0] : [-L * .3 + Math.floor(gun / 2) * L * .16, cult ? 1.5 : .25, gunTotal >= 2 ? (gun % 2 ? 1 : -1) * W * .35 : 0];
      if (/industrial-tug/.test(family) && type === 'harpoon') pos = [-L * .44, .2, W * .12];
      if (ghost) pos[1] = -.15;
      const d = device(type, i + 1, pos, family === 'cult-cathedral' ? 1.7 : .95, aux ? externalDeck : motion);
      if (cult && type === 'cannon') d.root.rotation.y = gun % 2 ? -Math.PI / 2 : Math.PI / 2;
      if (aux) { d.root.rotation.y = -Math.PI / 2; d.root.userData.role = 'cannon'; }
      gun++;
    }
    for (const [key, type] of Object.entries(otherKeys)) for (let i = 0; i < (art[key] || 0); i++) {
      const side = i % 2 ? 1 : -1, slot = Math.floor(i / 2);
      let pos = [L * .04 + slot * 1.5, .2, side * W * .38], scale = 1;
      if (type === 'bell') { pos = [family === 'cult-cathedral' ? 0 : cult ? -L * .21 : 0, family === 'cult-cathedral' ? 2.4 : cult ? 1.6 : .3, 0]; scale = family === 'cult-cathedral' ? 4.8 : cult ? 2.2 : 1.2; }
      if (type === 'crane') { pos = [L * .2 - slot * L * .2, .3, side * W * .39]; scale = /industrial-fortress/.test(family) ? 2.7 : /industrial-tug/.test(family) ? 2.1 : 1.3; }
      if (type === 'repair') { pos = [-L * .05 + slot * 1.7, .3, side * W * .35]; scale = /repair-catamaran/.test(family) ? 2 : 1.2; }
      if (type === 'hook') { pos = [-L * .15 + slot * 1.7, .3, side * W * .43]; scale = /tug/.test(family) ? 1.5 : 1; }
      if (type === 'armor') { pos = [-L * .34 + slot * L * .12, -.35, side * W * .45]; scale = cult ? 1.7 : 1.15; }
      if (type === 'sail') { pos = [L * (i / Math.max(1, art[key] - 1) - .5) * .68, .4, side * W * .18]; scale = ghost ? 1.7 : .95; }
      if (type === 'tank') { pos = [L * .2 + slot * .9, .2, side * W * .26]; scale = /industrial/.test(family) ? 1.35 : .95; }
      if (type === 'rescue') { pos = [L * .1 + slot * 1.5, -.45, side * W * .48]; scale = 1; }
      const d = device(type, i + 1, pos, scale);
      if (type === 'armor' && side < 0) d.root.rotation.y = Math.PI;
    }
    if (family === 'ghost-crown') {
      for (let i = 0; i < 7; i++) { const a = i * Math.PI / 6; tube(motion, [[L * .1, 1, Math.cos(a) * W * .42], [L * .2, 4 + Math.sin(a) * 3, Math.cos(a) * W * .7], [L * .05, 8 + Math.sin(a) * 2, Math.cos(a) * W * .78]], .12, m.metal, 'broken-crown-rib-' + i, 12); }
      for (let i = 0; i < 4; i++) cloth(motion, m, 'king-tattered-name-sail-' + i, { at: [L * (i / 4 - .4), 7 + i % 2, -W * .4], width: L * .2, height: 5.2, ragged: true, color: 'navy', drape: .6 });
    }
    if (family === 'industrial-fortress') {
      for (const side of [-1, 1]) lattice(motion, m, 'command-overhead-gantry-' + side, [-L * .33, 6.5, side * W * .48], [L * .4, 6.5, side * W * .48], .4, 10);
      for (const x of [-L * .33, L * .4]) for (const side of [-1, 1]) beam(motion, m.metal, 'gantry-upright-' + x + '-' + side, [x, 0, side * W * .48], [x, 6.5, side * W * .48], .22);
    }
    if (family === 'civil-shelter') {
      const shade = feature('rescue-canopy-frame', 'rescueCanopy', [0, .4, 0]);
      for (const side of [-1, 1]) for (const x of [-L * .25, L * .25]) beam(shade, m.trim, 'canopy-pole-' + side + '-' + x, [x, 0, side * W * .33], [x, 2.1, side * W * .33], .06);
      cloth(shade, m, 'passenger-shelter-canvas', { at: [0, 2.5, W * .34], width: L * .65, height: W * .7, horizontal: true, color: 'canvas', drape: .6 });
      for (let i = 0; i < 4; i++) box(primary, m.wood, 'passenger-bench-' + i, [L * (i / 4 - .34), .35, 0], [.35, .18, W * .52]);
    }
    if (family === 'salvage-junk') {
      for (let i = 0; i < 3; i++) { const side = i % 2 ? 1 : -1; box(primary, m.deck, 'offset-patchwork-terrace-' + i, [L * (i / 3 - .35), .3 + i * .17, side * W * .29], [L * .35, .15, W * .58], [0, side * .09, 0]); lattice(motion, m, 'salvage-fork-' + i, [L * .1, .2, side * W * .24], [-L * .5, 2.4 + i * .5, side * W * .56], .16, 5); }
    }
    if (family === 'industrial-boiler') {
      for (const side of [-1, 1]) { ellipsoid(primary, m.coral, 'dominant-riveted-boiler-' + side, [L * .04, 1.5, side * W * .27], [L * .27, 1.5, W * .22], 20); tube(primary, [[-L * .16, 1.3, side * W * .3], [-L * .27, 2.7, side * W * .3], [L * .13, 2.7, side * W * .3], [L * .28, 1, side * W * .3]], .16, m.brass, 'arched-heat-pipe-' + side, 20); }
    }
    if (family === 'civil-courier') {
      for (const side of [-1, 1]) { const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(L * .25, .3); fin.lineTo(L * .08, 1.9); fin.lineTo(-L * .06, .4); fin.closePath(); const g = new THREE.ExtrudeGeometry(fin, { depth: .07, bevelEnabled: false }); mesh(primary, g, m.trim, 'swept-mail-tail-' + side, [L * .29, .1, side * W * .4], [side * .25, 0, 0]); }
    }
    if (family === 'royal-funeral') {
      for (const side of [-1, 1]) cloth(motion, m, 'long-royal-ivory-pall-' + side, { at: [0, 2.4, side * W * .37], width: L * .81, height: 3.4, color: 'canvas', side, drape: .18 });
      for (let i = 0; i < 5; i++) ring(motion, m.brass, 'ceremonial-seal-' + i, [L * (i / 5 - .4), 1.5, -W * .41], .18, .03, [0, 0, 0]);
    }
    if (family === 'historical-capsule') {
      ring(primary, m.metal, 'heavy-descent-ring', [0, -D * .7, 0], W * .65, .22);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; beam(primary, m.metal, 'descent-cage-' + i, [Math.cos(a) * L * .35, -D, Math.sin(a) * W * .55], [Math.cos(a) * L * .3, D, Math.sin(a) * W * .45], .12); }
    }
    if (ship.id === 'unfinished-stitch-hull') for (let i = 0; i < 7; i++) {
      const x = L * (i / 6 - .5); tube(motion, [[x, -.3, -W * .48], [x, 3, -W * .5], [x, 4, 0], [x, 3, W * .5], [x, -.3, W * .48]], .12, m.brass, 'unfinished-rib-' + i, 16);
    }
  }
  scene.userData = { title: 'Cloudstitch', version: 'fleet-v2', assetId: ship.id, assetName: ship.name, category: ship.category, scopeKind: ship.scopeKind, sourceFiles: ship.sourceFiles, confirmedModules: ship.modules, artModules: art, requiredFeatures: ship.requiredFeatures, structuralFeatures: ship.structuralFeatures, identityFamily: family, identity: p.identity, originalAssetsPreserved: true, authoredUnits: 'fleet-kit', forwardAxis: '-X', upAxis: '+Y', nominalHullLength: L, recommendedFleetScale: 1, scaleNote: 'Visual art LU; gameplay collision and sockets must be reauthored for this changed silhouette.', purpose: 'Distinctly sculpted and rigid-rigged presentation assets. No additional battle simulation.' };
  scene.updateMatrixWorld(true);
  // Bake a restrained, broad paint-value gradient into the new vertices. This
  // keeps rounded volume visible in the unlit hand-drawn view; no PBR gloss.
  const paintLight = new THREE.Vector3(-.35, .85, -.4).normalize(), n = new THREE.Vector3();
  scene.traverse(object => {
    if (!object.isMesh || !object.geometry.attributes.normal) return;
    const normal = object.geometry.attributes.normal, position = object.geometry.attributes.position;
    const colors = new Float32Array(position.count * 3), transform = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const unlitGlow = materials.every(material => material === m.glow);
    for (let i = 0; i < position.count; i++) {
      n.fromBufferAttribute(normal, i).applyMatrix3(transform).normalize();
      const light = Math.max(0, n.dot(paintLight)), stroke = .012 * Math.sin(position.getX(i) * 2.1 + position.getY(i) * 1.6);
      const value = unlitGlow ? 1 : .79 + .20 * light + stroke;
      colors[i * 3] = value; colors[i * 3 + 1] = value; colors[i * 3 + 2] = value;
    }
    object.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    for (const material of materials) material.vertexColors = true;
  });
  return { scene, controls, artModules: art, shape: { ...p, forwardAxis: '-X', upAxis: '+Y' }, style };
}
