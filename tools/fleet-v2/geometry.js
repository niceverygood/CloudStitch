import * as THREE from 'three';
import { bone, tube, makeEnvelope, makeCabin } from '../fleet/body.js';

export { bone, tube };

export function mesh(parent, geometry, material, name, at = [0, 0, 0], rotation = [0, 0, 0]) {
  const uv = geometry.attributes.uv;
  if (uv) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (let i = 0; i < uv.count; i++) { a = Math.min(a, uv.getX(i)); b = Math.min(b, uv.getY(i)); c = Math.max(c, uv.getX(i)); d = Math.max(d, uv.getY(i)); }
    if (a < 0 || b < 0 || c > 1 || d > 1) for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - a) / Math.max(c - a, .0001), (uv.getY(i) - b) / Math.max(d - b, .0001));
  }
  const item = new THREE.Mesh(geometry, material); item.name = name;
  item.position.fromArray(at); item.rotation.fromArray(rotation); parent.add(item); return item;
}
export function box(parent, m, name, at, size, rotation = [0, 0, 0]) { return mesh(parent, new THREE.BoxGeometry(...size), m, name, at, rotation); }
export function ellipsoid(parent, m, name, at, size, detail = 20) { const g = new THREE.SphereGeometry(1, detail, Math.max(10, detail / 2)); g.scale(...size); return mesh(parent, g, m, name, at); }
export function ring(parent, m, name, at, radius, thickness = .08, rotation = [Math.PI / 2, 0, 0]) { return mesh(parent, new THREE.TorusGeometry(radius, thickness, 6, 28), m, name, at, rotation); }
export function beam(parent, m, name, a, b, radius = .07) { return tube(parent, [a, b], radius, m, name, 2); }

const profiles = {
  skiff: [[0, .03, .8, .3], [.15, .42, .22, .7], [.38, .88, 0, 1], [.66, 1, .02, .92], [.87, .75, .1, .66], [1, .35, .23, .42]],
  barge: [[0, .65, .12, .85], [.13, .98, .05, 1], [.4, 1, 0, 1], [.72, 1, 0, 1], [.92, .92, .08, .9], [1, .73, .16, .75]],
  blade: [[0, .015, .55, .18], [.22, .3, .1, .6], [.5, .72, 0, .8], [.77, 1, .12, 1], [.92, .57, .3, .66], [1, .12, .48, .25]],
  bastion: [[0, .58, 1.05, .8], [.12, .95, .5, 1.25], [.4, 1, .12, 1.45], [.7, .95, .18, 1.35], [.91, .82, .5, 1], [1, .6, .85, .85]],
  crescent: [[0, .04, 1, .2], [.2, .7, .4, .65], [.45, 1, 0, 1], [.7, .8, .4, .9], [.9, .4, 1, .6], [1, .02, 1.4, .2]],
  cradle: [[0, .25, .25, .55], [.15, .75, .05, .8], [.4, 1, 0, 1], [.7, 1, .08, 1], [.9, .75, .2, .8], [1, .35, .3, .55]],
};

/** A different waterline and section topology for each architectural family.
 * -X is the bow. Flattened decks, rounded bilges and raised stems remain closed.
 */
export function sculptHull(parent, { id, length, width, depth, form = 'skiff', materials, surface = 'wood', keel = 'darkWood', open = false }) {
  const root = bone(id, parent); root.userData = { moduleId: id, moduleType: 'hull', parentId: parent.userData?.moduleId || parent.name };
  const stations = profiles[form] || profiles.skiff, ringCount = 12, vertices = [], uvs = [], indices = [];
  const at = (s, j) => {
    const [t, w, rise, d] = s, angle = 2 * Math.PI * j / ringCount;
    const z = Math.cos(angle) * width * .5 * w;
    const y = rise + (Math.sin(angle) > 0 ? Math.sin(angle) * depth * .06 : Math.sin(angle) * depth * d);
    return [(t - .5) * length, y, z];
  };
  for (const s of stations) for (let j = 0; j <= ringCount; j++) { vertices.push(...at(s, j % ringCount)); uvs.push(s[0], j / ringCount); }
  for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < ringCount; j++) {
    const a = i * (ringCount + 1) + j, b = a + ringCount + 1; indices.push(a, b, b + 1, a, b + 1, a + 1);
  }
  for (const [i, reverse] of [[0, false], [stations.length - 1, true]]) {
    const c = vertices.length / 3, s = stations[i]; vertices.push((s[0] - .5) * length, s[2] - depth * s[3] * .25, 0); uvs.push(.5, .5);
    for (let j = 0; j < ringCount; j++) { const a = i * (ringCount + 1) + j; indices.push(c, reverse ? a + 1 : a, reverse ? a : a + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals();
  mesh(root, g, materials[surface], id + '-sculpted-shell');
  const sample = t => {
    let i = stations.findIndex(s => s[0] >= t); i = Math.max(1, i < 0 ? stations.length - 1 : i);
    const a = stations[i - 1], b = stations[i], u = (t - a[0]) / (b[0] - a[0]);
    return [t, THREE.MathUtils.lerp(a[1], b[1], u), THREE.MathUtils.lerp(a[2], b[2], u), THREE.MathUtils.lerp(a[3], b[3], u)];
  };
  // Painterly bands and individual strakes describe curved volume rather than
  // copying the cottage hull. Rivets/edges stay broad enough for game distance.
  for (const side of [-1, 1]) {
    for (const v of [.06, .32, .65]) {
      const pts = Array.from({ length: 25 }, (_, i) => { const s = sample(i / 24); return [(s[0] - .5) * length, s[2] - depth * s[3] * v, side * width * .5 * s[1] * Math.sqrt(1 - v * v) * 1.015]; });
      tube(root, pts, v === .06 ? .095 : .035, materials[v === .06 ? 'trim' : keel], id + '-long-strake-' + side + '-' + v, 32);
    }
    for (let i = 1; i < 9; i++) {
      const s = sample(i / 10), x = (s[0] - .5) * length;
      beam(root, materials.trim, id + '-rib-' + side + '-' + i, [x, s[2] - .12, side * s[1] * width * .504], [x, s[2] - depth * s[3] * .68, side * s[1] * width * .36], .035);
      ellipsoid(root, materials.brass, id + '-rivet-' + side + '-' + i, [x, s[2] - .18, side * s[1] * width * .51], [.045, .045, .045], 8);
    }
  }
  if (!open) for (let i = 0; i < 16; i++) {
    const s = sample((i + .5) / 16);
    box(root, materials.deck, id + '-deck-plank-' + i, [(s[0] - .5) * length, s[2] + depth * .055, 0], [length / 16 * .98, .065, width * s[1] * .95]);
  }
  return root;
}

export function cloth(parent, materials, id, { at = [0, 0, 0], width = 4, height = 3, ragged = false, side = 1, color = 'canvas', drape = .4, horizontal = false } = {}) {
  const points = [], uv = [], ix = [], nx = 16, ny = 6;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / ny, edge = ragged ? (.25 + .4 * (i % 4 === 0 ? 1 : i % 3 === 0 ? .1 : .65)) * Math.pow(v, 4) : .07 * Math.sin(u * Math.PI * 4) * v;
    const x = (u - .5) * width, y = -v * height + edge;
    const z = side * (Math.sin(u * Math.PI * 5) * .09 + Math.sin(u * Math.PI) * drape * v);
    points.push(horizontal ? x : x, horizontal ? z : y, horizontal ? y : z); uv.push(u, 1 - v);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; ix.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ix); g.computeVertexNormals();
  return mesh(parent, g, materials[color], id, at);
}

export function makeBalloon(parent, materials, id, spec, style, controls) {
  const e = makeEnvelope({ id, materials: { ...materials, canvas: materials.envelope }, length: spec.length, radius: spec.radius, flatten: spec.flatten || 1, style: 'warm', patched: Boolean(spec.patched) });
  e.root.position.fromArray(spec.at); parent.add(e.root); e.root.userData.parentId = parent.userData?.moduleId || parent.name; controls.push(...e.controls);
  if (spec.ragged) {
    for (const side of [-1, 1]) cloth(e.flex, materials, id + '-shredded-wrap-' + side, { at: [0, spec.radius * .35, side * spec.radius * .7], width: spec.length * .83, height: spec.radius * 1.5, ragged: true, side, color: 'navy', drape: .35 });
    for (let i = 0; i < 4; i++) ring(e.flex, materials.glow, id + '-cold-seam-' + i, [spec.length * (i / 5 - .3), 0, 0], spec.radius * .92, .018, [0, Math.PI / 2, 0]);
  }
  for (const side of [-1, 1]) {
    const a = [-spec.length * .22, -spec.radius * .65, side * spec.radius * .55], b = [spec.length * .22, -spec.radius * .65, side * spec.radius * .55];
    beam(e.flex, materials.rope, id + '-under-cradle-' + side, a, b, .045);
  }
  return e.root;
}

export function cabin(parent, materials, id, spec, controls, style) {
  const at = spec.position || [2, .15, 0], size = spec.scale || [2.2, 1.3, 1.8], [L, H, W] = size;
  if (spec.shape === 'none') return null;
  if (spec.shape === 'cottage') {
    const c = makeCabin({ id, materials, length: L, height: H, width: W, style }); c.root.position.fromArray(at); parent.add(c.root); return c.root;
  }
  const root = bone(id, parent, at); root.userData = { moduleId: id, moduleType: 'cabin', parentId: parent.userData?.moduleId || parent.name };
  if (/crown-throne/.test(spec.shape)) {
    for (const side of [-1, 1]) tube(root, [[-L * .35, 0, side * W * .45], [-L * .2, H * .6, side * W * .6], [L * .15, H * 1.2, side * W * .3]], .1, materials.metal, id + '-broken-throne-arch-' + side, 14);
    cloth(root, materials, id + '-throne-name-shroud', { at: [0, H * 1.05, W * .3], width: L * .7, height: H * .8, ragged: true, color: 'navy', drape: .25 });
    ellipsoid(root, materials.glow, id + '-memory-lantern', [0, H * .5, 0], [.16, .25, .16], 12);
  } else if (/open-belfry/.test(spec.shape)) {
    for (const x of [-L * .43, L * .43]) for (const z of [-W * .43, W * .43]) {
      beam(root, materials.dark, id + '-belfry-pier-' + x + '-' + z, [x, 0, z], [x, H * .85, z], .24);
      beam(root, materials.brass, id + '-pier-edge-' + x + '-' + z, [x - .13, 0, z - .13], [x - .13, H * .84, z - .13], .045);
    }
    for (const side of [-1, 1]) tube(root, [[-L * .44, H * .75, side * W * .43], [-L * .2, H * .98, side * W * .46], [0, H * 1.12, side * W * .46], [L * .2, H * .98, side * W * .46], [L * .44, H * .75, side * W * .43]], .24, materials.metal, id + '-open-gothic-arch-' + side, 24);
    for (const x of [-L * .43, L * .43]) beam(root, materials.dark, id + '-cross-top-' + x, [x, H * .85, -W * .43], [x, H * .85, W * .43], .22);
    cloth(root, materials, id + '-belfry-roof-pall', { at: [0, H * 1.05, W * .48], width: L * 1.1, height: W * .96, horizontal: true, color: 'canvas', drape: .4 });
  } else if (/unfinished-frame/.test(spec.shape)) {
    for (const x of [-L * .5, L * .5]) for (const z of [-W * .5, W * .5]) beam(root, materials.metal, id + '-empty-cabin-stud-' + x + '-' + z, [x, 0, z], [x, H, z], .055);
  } else if (/open-helm/.test(spec.shape)) {
    box(root, materials.darkWood, id + '-helm-plinth', [0, H * .25, 0], [L * .5, H * .5, W * .6]);
    const wheel = ring(root, materials.brass, id + '-open-steering-wheel', [-L * .24, H * .9, 0], W * .3, .035, [0, Math.PI / 2, 0]);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; beam(root, materials.brass, id + '-wheel-spoke-' + i, [-L * .24, H * .9, 0], [-L * .24, H * .9 + Math.sin(a) * W * .3, Math.cos(a) * W * .3], .02); }
    box(root, materials.glass, id + '-small-forward-windscreen', [-L * .4, H * .62, 0], [.06, H * .6, W * 1.05], [0, 0, -.18]);
  } else if (/gantry|workshop|hangar/.test(spec.shape)) {
    for (const x of [-L * .4, L * .4]) for (const z of [-W * .4, W * .4]) beam(root, materials.metal, id + '-stanchion-' + x + '-' + z, [x, 0, z], [x, H, z], .08);
    const shape = new THREE.Shape(); shape.moveTo(-W * .6, 0); shape.quadraticCurveTo(0, H * .5, W * .6, 0); shape.lineTo(W * .6, .12); shape.quadraticCurveTo(0, H * .5 + .12, -W * .6, .12); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: L * 1.1, bevelEnabled: false, curveSegments: 12 }); g.rotateY(Math.PI / 2); g.translate(-L * .55, H, 0);
    mesh(root, g, materials.trim, id + '-workshop-vault');
    box(root, materials.dark, id + '-rear-toolwall', [L * .42, H * .4, 0], [.15, H * .8, W * .9]);
    for (let i = 0; i < 4; i++) box(root, materials.brass, id + '-tool-' + i, [L * .33, H * (.2 + i * .12), (i % 2 ? 1 : -1) * W * .2], [.07, .07, W * .3]);
  } else if (/tower|spire|chapel/.test(spec.shape)) {
    for (let i = 0; i < 3; i++) box(root, i % 2 ? materials.dark : materials.metal, id + '-tower-tier-' + i, [i * L * .06, H * (.15 + i * .25), 0], [L * (1 - i * .18), H * .3, W * (1 - i * .18)]);
    mesh(root, new THREE.ConeGeometry(W * .65, H * .6, 4), materials.trim, id + '-spire-cap', [L * .12, H * 1.02, 0], [0, Math.PI / 4, 0]);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) box(root, materials.glass, id + '-gothic-slit-' + side + '-' + i, [(i - 1) * L * .18, H * .52, side * W * .41], [.12, H * .38, .04]);
  } else if (/lantern|cage|observatory|observation|dome/.test(spec.shape)) {
    mesh(root, new THREE.CylinderGeometry(W * .4, W * .55, H, 8), materials.dark, id + '-lantern-core', [0, H * .5, 0]);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; beam(root, materials.trim, id + '-cage-' + i, [Math.cos(a) * L * .4, 0, Math.sin(a) * W * .5], [Math.cos(a) * L * .28, H * 1.25, Math.sin(a) * W * .35], .055); }
    ring(root, materials.glow, id + '-lantern-glow', [0, H * .72, 0], W * .42, .075);
    mesh(root, new THREE.ConeGeometry(W * .65, H * .4, 8), materials.navy, id + '-lantern-cap', [0, H * 1.13, 0]);
  } else {
    // Low sloping pilothouse/armoured bridge: no rear cottage silhouette.
    const shape = new THREE.Shape(); shape.moveTo(-L * .5, 0); shape.lineTo(-L * .4, H * .6); shape.lineTo(-L * .05, H); shape.lineTo(L * .45, H * .78); shape.lineTo(L * .5, 0); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -W * .5);
    mesh(root, g, materials.metal, id + '-visor-bridge');
    for (const side of [-1, 1]) { box(root, materials.glass, id + '-visor-' + side, [-L * .06, H * .67, side * (W * .5 + .085)], [L * .62, H * .13, .035]); beam(root, materials.brass, id + '-visor-rim-' + side, [-L * .4, H * .8, side * W * .55], [L * .3, H * .73, side * W * .55], .04); }
  }
  return root;
}

export function lattice(parent, materials, id, a, b, width = .5, sections = 7) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), off = new THREE.Vector3(0, 0, width);
  for (const s of [-1, 1]) beam(parent, materials.metal, id + '-rail-' + s, A.clone().addScaledVector(off, s).toArray(), B.clone().addScaledVector(off, s).toArray(), .09);
  for (let i = 0; i < sections; i++) {
    const p = A.clone().addScaledVector(d, i / sections), q = A.clone().addScaledVector(d, (i + 1) / sections);
    beam(parent, materials.trim, id + '-truss-' + i, p.clone().addScaledVector(off, i % 2 ? 1 : -1).toArray(), q.clone().addScaledVector(off, i % 2 ? -1 : 1).toArray(), .055);
  }
}
