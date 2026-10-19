import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Cloudstitch / the Tollkeeper's Bastion.
// Original, fully volumetric architecture. Values are relative design units,
// not a gameplay scale, equipment count, socket contract or engine budget.
const PALETTE = {
  iron: '#29383e', ironLight: '#445258', ironDark: '#19272e', ironBlue: '#354a54',
  brass: '#b89551', brassLight: '#e5bf72', brassDark: '#786345',
  teal: '#28666b', tealLight: '#478b87', tealDark: '#19494f',
  plaster: '#d6c6a5', plasterLight: '#e7d9bb', plasterShade: '#aaad99',
  canvas: '#d4c39f', canvasShade: '#aea584', canvasPatch: '#e4d4af',
  wood: '#8f6341', woodLight: '#bb8853', woodDark: '#5c4535',
  red: '#863e36', redLight: '#ab5343', redDark: '#572d31',
  glass: '#ffbd60', glassDark: '#b96836', soot: '#3e4544',
};

export function buildFortress() {
  const root = new THREE.Group();
  root.name = 'Cloudstitch_Tollkeepers_Bastion';
  root.userData = {
    title_ko: '봉쇄자의 공중 요새', title_en: "Tollkeeper's Bastion",
    asset_type: 'static_3d_art_prototype', revision: 1,
    coordinates: '+Y up; +Z fortified dock / front; relative design units',
    original_design: true, texture_method: 'baked vertex-painted materials',
    limitations: 'No gameplay, collider, navmesh, interior, LOD, animation, rig or engine sockets.',
  };
  const zones = [
    { id: 'hull', name_ko: '철갑 선체', nodeName: 'hull', description: '겹 판금·황동 리벳·하부 용골을 가진 먹색의 부유 선체' },
    { id: 'buoyancy', name_ko: '봉제 부력낭', nodeName: 'buoyancy', description: '크림색 수선 천과 조임 띠가 있는 하부 부력낭' },
    { id: 'keep', name_ko: '성채와 겹지붕', nodeName: 'keep', description: '비대칭 회랑·청록 겹지붕·따뜻한 창·겹겹의 보강대' },
    { id: 'bell_tower', name_ko: '봉쇄의 종탑', nodeName: 'bell_tower', description: '열린 철제 우리와 커다란 황동 종, 층진 첨탑' },
    { id: 'bastions', name_ko: '외향 포대', nodeName: 'bastions', description: '가시 난간과 독립 실루엣을 가진 여섯 개의 경계 함포' },
    { id: 'dock', name_ko: '봉쇄 관문과 계류장', nodeName: 'dock', description: '철창 관문·목재 선창·늘어진 사슬·기중기와 인양물' },
    { id: 'machinery', name_ko: '기관·배관·연통', nodeName: 'machinery', description: '그을린 공장 굴뚝과 배관, 황동 팬과 압력통' },
    { id: 'banners', name_ko: '검붉은 봉제 깃발', nodeName: 'banners', description: '독창적인 봉쇄 매듭 문양과 꿰맨 가장자리를 가진 굴곡 천' },
  ];
  const parts = new Map(zones.map(z => [z.id, new Map()]));
  const materials = new Map();
  let count = 0;
  const colorCache = Object.fromEntries(Object.entries(PALETTE).map(([k, c]) => [k, new THREE.Color(c)]));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const euler = new THREE.Euler();
  const v = a => new THREE.Vector3(...a);
  const frac = t => t - Math.floor(t);
  const noise = (x, y, z) => frac(Math.sin(x * 12.9898 + y * 78.233 + z * 33.713) * 43758.5453);

  function material(key) {
    if (!materials.has(key)) {
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true,
        roughness: 1, metalness: 0, side: THREE.DoubleSide });
      m.name = `paint_${key}`;
      m.userData = { palette: PALETTE[key], finish: 'matte vertex-painted', original_material: true };
      if (key === 'glass') { m.emissive.set('#ad5320'); m.emissiveIntensity = .32; }
      materials.set(key, m);
    }
    return materials.get(key);
  }

  function add(geometry, key, zone, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], paint = 1) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    pos.set(...p); euler.set(...r); quaternion.setFromEuler(euler); scl.set(...s);
    matrix.compose(pos, quaternion, scl); g.applyMatrix4(matrix);
    // Small per-facet color changes and long coordinate strokes give paint an
    // actual material footprint in the GLB, independent of the review shader.
    if (!g.attributes.normal) g.computeVertexNormals();
    const ps = g.attributes.position, ns = g.attributes.normal;
    const colors = new Float32Array(ps.count * 3);
    const base = colorCache[key];
    for (let i = 0; i < ps.count; i += 3) {
      const cx = (ps.getX(i) + ps.getX(i + 1) + ps.getX(i + 2)) / 3;
      const cy = (ps.getY(i) + ps.getY(i + 1) + ps.getY(i + 2)) / 3;
      const cz = (ps.getZ(i) + ps.getZ(i + 1) + ps.getZ(i + 2)) / 3;
      let nx = (ns.getX(i) + ns.getX(i + 1) + ns.getX(i + 2)) / 3;
      let ny = (ns.getY(i) + ns.getY(i + 1) + ns.getY(i + 2)) / 3;
      let nz = (ns.getZ(i) + ns.getZ(i + 1) + ns.getZ(i + 2)) / 3;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      let light = nx * -.35 + ny * .82 + nz * .45;
      if (key.startsWith('red') || key.startsWith('canvas')) light = Math.abs(light) * .8 + .1;
      // Broad value bands are stored in the GLB itself, retaining volume when
      // the review uses a light-independent MeshBasicMaterial for painted mode.
      const band = light > .52 ? 1.10 : light > .04 ? .94 : .76;
      const shade = paint * band * (.94 + .075 * noise(cx * .31, cy * .43, cz * .35)
        + .025 * Math.sin(cx * 5.1 + cy * .18 + cz * 1.7));
      const warm = light > .52 ? 1.018 : light < .04 ? .985 : 1;
      const cool = light < .04 ? 1.025 : light > .52 ? .985 : 1;
      for (let j = 0; j < 3; j++) {
        colors[(i + j) * 3] = Math.min(1, base.r * shade * warm);
        colors[(i + j) * 3 + 1] = Math.min(1, base.g * shade);
        colors[(i + j) * 3 + 2] = Math.min(1, base.b * shade * cool);
      }
    }
    for (const attr of Object.keys(g.attributes)) if (!['position', 'normal'].includes(attr)) g.deleteAttribute(attr);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const bucket = parts.get(zone);
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key).push(g); count++;
  }

  function box(zone, key, x, y, z, w, h, d, rz = 0, ry = 0) {
    add(new THREE.BoxGeometry(w, h, d), key, zone, [x, y, z], [0, ry, rz]);
  }
  function cyl(zone, key, x, y, z, rt, rb, height, sides = 12, rot = [0, 0, 0], open = false) {
    add(new THREE.CylinderGeometry(rt, rb, height, sides, 1, open), key, zone, [x, y, z], rot);
  }
  function sphere(zone, key, x, y, z, rx, ry, rz, seg = 16, rows = 10) {
    add(new THREE.SphereGeometry(1, seg, rows), key, zone, [x, y, z], [0, 0, 0], [rx, ry, rz]);
  }
  function torus(zone, key, x, y, z, radius, tube, rot = [Math.PI / 2, 0, 0], arc = Math.PI * 2, segments = 24) {
    add(new THREE.TorusGeometry(radius, tube, 4, segments, arc), key, zone, [x, y, z], rot);
  }
  function rod(zone, key, a, b, radius = .06, sides = 6) {
    const av = v(a), bv = v(b), dir = bv.clone().sub(av);
    const g = new THREE.CylinderGeometry(radius, radius, dir.length(), sides, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    g.applyQuaternion(q); g.translate(...av.add(bv).multiplyScalar(.5).toArray()); add(g, key, zone);
  }
  function tube(zone, key, points, radius = .09, radial = 6, steps = 26) {
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v)), steps, radius, radial, false), key, zone);
  }
  function ringEllipse(zone, key, rx, rz, y, tubeSize = .08, offset = [0, 0]) {
    const points = Array.from({ length: 33 }, (_, i) => {
      const a = i / 32 * Math.PI * 2; return [offset[0] + Math.cos(a) * rx, y, offset[1] + Math.sin(a) * rz];
    });
    tube(zone, key, points, tubeSize, 4, 32);
  }
  function spikes(zone, key, x, z, y, radius, n = 10, height = .8) {
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2;
      cyl(zone, key, x + Math.cos(a) * radius, y + height / 2, z + Math.sin(a) * radius, 0, .14, height, 5);
    }
  }
  function plankLines(zone, x, y, z, w, d, key = 'woodDark') {
    for (let i = 0; i <= Math.floor(w / .48); i++) box(zone, key, x - w / 2 + i * .48, y, z, .025, .025, d);
  }
  function panel(zone, key, vertices) {
    const p = []; for (let i = 1; i < vertices.length - 1; i++) p.push(...vertices[0], ...vertices[i], ...vertices[i + 1]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals(); add(g, key, zone);
  }

  // Broad overlapping panels form an actual armored cup, with a fully modeled
  // underside rather than a stage facing a single camera.
  const hullProfile = [[6.5, -5.2, 5.1], [10.4, -4.1, 8.15], [12.8, -1.8, 10.0], [14.1, 2.4, 11.2], [13.8, 4.1, 11.0]];
  for (let ring = 0; ring < hullProfile.length - 1; ring++) {
    for (let i = 0; i < 32; i++) {
      const a = i / 32 * Math.PI * 2, b = (i + 1) / 32 * Math.PI * 2;
      const lo = hullProfile[ring], hi = hullProfile[ring + 1];
      const p0 = [lo[0] * Math.cos(a), lo[1], lo[2] * Math.sin(a)];
      const p1 = [lo[0] * Math.cos(b), lo[1], lo[2] * Math.sin(b)];
      const p2 = [hi[0] * Math.cos(b), hi[1], hi[2] * Math.sin(b)];
      const p3 = [hi[0] * Math.cos(a), hi[1], hi[2] * Math.sin(a)];
      panel('hull', i % 5 === 0 ? 'ironBlue' : i % 3 === 0 ? 'ironLight' : 'iron', [p3, p2, p1, p0]);
      if (ring > 0) {
        rod('hull', 'ironDark', p0, p3, .065);
        for (const t of [.14, .85]) {
          const mid = p0.map((p, c) => p * (1 - t) + p3[c] * t);
          sphere('hull', 'brassDark', ...mid, .085, .085, .085, 6, 4);
        }
      }
    }
  }
  // Seal both ends of the hull's sheeted shell.
  cyl('hull', 'ironDark', 0, -5.21, 0, 1, 1, .2, 32, [0, 0, 0]);
  add(new THREE.CylinderGeometry(1, 1, .22, 48), 'wood', 'hull', [0, 4.05, 0], [0, 0, 0], [13.75, 1, 10.92]);
  add(new THREE.CylinderGeometry(1, 1, .15, 48), 'ironDark', 'hull', [0, -5.22, 0], [0, 0, 0], [6.5, 1, 5.1]);
  for (const [rx, y, rz] of hullProfile.slice(1)) {
    ringEllipse('hull', 'ironDark', rx + .08, rz + .08, y, .18);
    ringEllipse('hull', 'brassDark', rx + .15, rz + .15, y + .12, .055);
  }
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    const x = Math.cos(a) * 13.88, z = Math.sin(a) * 11.1;
    cyl('hull', 'ironDark', x, 4.9, z, .11, .2, 1.8, 6);
    cyl('hull', 'brass', x, 5.65, z, 0, .18, .7, 6);
    if (i % 3 !== 0) {
      const b = (i + 1) / 24 * Math.PI * 2;
      rod('hull', 'brassDark', [x, 5.12, z], [Math.cos(b) * 13.88, 5.12, Math.sin(b) * 11.1], .07);
    }
  }
  // Under-keel armor fins and hanging mooring loops break the silhouette.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = -6.8 + i * 4.2;
      const x = side * (11.0 + (i === 1 || i === 2 ? 1.1 : -.2));
      panel('hull', 'ironDark', [[x, 1.3, z - 1.0], [x + side * 1.3, -3.4, z], [x, -5.4, z + .6], [x - side * .4, -.5, z + 1.0]]);
      rod('hull', 'brassDark', [x, .5, z], [x + side * .4, -4.2, z], .1);
    }
  }

  // Five quilted buoyancy chambers sit below the armor, partially exposed.
  const sacs = [
    [-8.7, -3.7, 1.8, 3.8, 2.8, 5.9], [8.8, -3.65, .8, 3.7, 2.8, 6.5],
    [-3.5, -5.0, 0, 3.5, 2.65, 6.5], [3.0, -5.0, -1.4, 3.6, 2.55, 6.3], [0, -4.0, -7.0, 5.2, 2.8, 3.0],
  ];
  for (const [x, y, z, rx, ry, rz] of sacs) {
    sphere('buoyancy', 'canvas', x, y, z, rx, ry, rz, 24, 12);
    for (let i = -2; i <= 2; i++) {
      const t = i / 3, sy = Math.sqrt(1 - t * t);
      const points = Array.from({ length: 41 }, (_, k) => {
        const a = k / 40 * Math.PI * 2;
        return [x + rx * sy * Math.cos(a) * 1.006, y + ry * sy * Math.sin(a) * 1.006, z + rz * t];
      });
      tube('buoyancy', i % 2 ? 'canvasShade' : 'brassDark', points, i % 2 ? .035 : .067, 4, 32);
      for (let j = 0; j < 18; j++) {
        const a = j / 18 * Math.PI * 2;
        const q = [x + rx * sy * Math.cos(a) * 1.014, y + ry * sy * Math.sin(a) * 1.014, z + rz * t];
        rod('buoyancy', 'woodDark', [q[0] - .06, q[1], q[2] - .06], [q[0] + .06, q[1], q[2] + .06], .018, 4);
      }
    }
    for (const a of [.42, 2.2, 3.8, 5.4]) {
      const xx = x + Math.cos(a) * rx * .86, zz = z + Math.sin(a) * rz * .75;
      rod('buoyancy', 'brassDark', [xx, y - ry * .3, zz], [xx * 1.025, 1.0, zz * 1.025], .08, 6);
    }
    // Small rectangular patches are fitted to the outward-facing visible cloth.
    box('buoyancy', 'canvasPatch', x + rx * .78, y - .7, z + .7, .09, .72, 1.0, -.18);
  }

  function windowRect(zone, x, y, z, w = .48, h = 1.25, ry = 0) {
    const place = (dx, dy, dz) => [x + dx * Math.cos(ry) + dz * Math.sin(ry), y + dy, z - dx * Math.sin(ry) + dz * Math.cos(ry)];
    const frame = (key, dx, dy, dz, ww, hh, dd) => box(zone, key, ...place(dx, dy, dz), ww, hh, dd, 0, ry);
    frame('woodDark', 0, 0, 0, w + .2, h + .2, .18);
    frame('glassDark', 0, 0, .105, w, h, .08);
    frame('glass', -.02, .04, .16, w * .68, h * .82, .06);
    frame('brassDark', 0, 0, .21, .065, h, .06);
    frame('woodDark', 0, .10, .23, w, .07, .06);
    frame('brass', 0, h / 2 + .11, .13, w + .25, .10, .28);
    frame('woodDark', 0, -h / 2 - .09, .18, w + .28, .1, .4);
  }

  function turretRoof(zone, x, y, z, radius, height, sides = 12, lean = .22) {
    const profile = [[1.08, 0], [1.16, .12], [.99, .22], [.79, .42], [.54, .65], [.29, .84], [.07, 1.0]];
    const verts = [], indices = [];
    for (let j = 0; j < profile.length; j++) for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2, [r, yy] = profile[j];
      verts.push(x + Math.cos(a) * radius * r + lean * yy, y + height * yy, z + Math.sin(a) * radius * r);
    }
    for (let j = 0; j < profile.length - 1; j++) for (let i = 0; i < sides; i++) {
      const a = j * sides + i, b = j * sides + (i + 1) % sides;
      indices.push(a, b + sides, b, a, a + sides, b + sides);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(indices); g.computeVertexNormals();
    add(g, 'teal', zone);
    ringEllipse(zone, 'brassDark', radius * 1.13, radius * 1.13, y + height * .1, .075, [x, z]);
    for (const j of [2, 3, 4]) {
      const [r, yy] = profile[j]; ringEllipse(zone, j === 3 ? 'tealLight' : 'tealDark', radius * r, radius * r, y + height * yy, .034, [x + lean * yy, z]);
    }
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2;
      const pts = profile.map(([r, yy]) => [x + Math.cos(a) * radius * r + lean * yy, y + height * yy, z + Math.sin(a) * radius * r]);
      tube(zone, i % 2 ? 'tealDark' : 'brassDark', pts, i % 2 ? .028 : .043, 3, profile.length);
      for (const j of [2, 3, 4]) {
        const [r, yy] = profile[j]; sphere(zone, 'brassDark', x + Math.cos(a) * radius * r + lean * yy, y + height * yy + .025, z + Math.sin(a) * radius * r, .045, .045, .045, 6, 3);
      }
    }
    cyl(zone, 'brass', x + lean, y + height + .28, z, .05, .13, .65, 8);
    cyl(zone, 'brassDark', x + lean, y + height + .75, z, 0, .14, .6, 6);
  }

  function gableRoof(zone, x, y, z, w, d, h, lean = .25) {
    const verts = [
      [x - w / 2, y, z + d / 2], [x + w / 2, y, z + d / 2], [x + lean, y + h, z + d / 2],
      [x - w / 2, y, z - d / 2], [x + lean, y + h, z - d / 2], [x + w / 2, y, z - d / 2],
    ];
    panel(zone, 'tealDark', verts.slice(0, 3)); panel(zone, 'tealDark', verts.slice(3));
    for (const side of [-1, 1]) {
      const sheet = [[x + lean, y + h, z - d / 2], [x + side * w / 2, y, z - d / 2], [x + side * w / 2, y, z + d / 2], [x + lean, y + h, z + d / 2]];
      panel(zone, 'teal', side > 0 ? sheet.reverse() : sheet);
      for (let i = 0; i <= Math.floor(d / .62); i++) {
        const zz = z - d / 2 + i * .62;
        rod(zone, i % 4 === 0 ? 'tealLight' : 'tealDark', [x + side * w / 2, y + .03, zz], [x + lean, y + h + .03, zz], .036, 5);
      }
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        rod(zone, 'tealDark', [x + side * w / 2 * (1 - t) + lean * t, y + h * t + .025, z - d / 2], [x + side * w / 2 * (1 - t) + lean * t, y + h * t + .025, z + d / 2], .025, 5);
      }
      rod(zone, 'brassDark', [x + side * w / 2, y, z + d / 2], [x + lean, y + h, z + d / 2], .09);
      rod(zone, 'brassDark', [x + side * w / 2, y, z - d / 2], [x + lean, y + h, z - d / 2], .09);
      rod(zone, 'brass', [x + side * w / 2, y, z - d / 2], [x + side * w / 2, y, z + d / 2], .085);
    }
    rod(zone, 'brass', [x + lean, y + h, z - d / 2 - .15], [x + lean, y + h, z + d / 2 + .15], .10);
  }

  function tower(zone, x, z, bottom, radius, height, roofH, options = {}) {
    const sides = options.sides || 12, top = bottom + height;
    cyl(zone, 'plasterShade', x, bottom + height / 2, z, radius * .93, radius * 1.02, height, sides);
    // Broad light plaster strips remain as calm areas between iron fittings.
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2;
      if (i % 3 !== 0) {
        const b = a + Math.PI * 2 / sides;
        panel(zone, i % 2 ? 'plaster' : 'plasterLight', [[x + Math.cos(a) * radius * .93, top - .25, z + Math.sin(a) * radius * .93], [x + Math.cos(b) * radius * .93, top - .25, z + Math.sin(b) * radius * .93], [x + Math.cos(b) * radius, bottom + .45, z + Math.sin(b) * radius], [x + Math.cos(a) * radius, bottom + .45, z + Math.sin(a) * radius]]);
      }
      if (i % 3 === 0) rod(zone, 'ironDark', [x + Math.cos(a) * radius * 1.025, bottom, z + Math.sin(a) * radius * 1.025], [x + Math.cos(a) * radius * .95, top, z + Math.sin(a) * radius * .95], .055);
    }
    for (const yy of [bottom + .45, bottom + height * .52, top - .28]) {
      ringEllipse(zone, 'ironDark', radius * (yy < bottom + 1 ? 1.04 : .97), radius * (yy < bottom + 1 ? 1.04 : .97), yy, .10, [x, z]);
      ringEllipse(zone, 'brassDark', radius * .99, radius * .99, yy + .12, .045, [x, z]);
    }
    const windowLevels = height > 10 ? [bottom + height * .34, bottom + height * .73] : [bottom + height * .61];
    for (const yy of windowLevels) for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + .15;
      windowRect(zone, x + Math.sin(a) * radius * .995, yy, z + Math.cos(a) * radius * .995, radius * .28, Math.min(1.4, height * .19), a);
    }
    turretRoof(zone, x, top, z, radius * 1.12, roofH, sides, options.lean || .15);
    if (options.balcony) {
      cyl(zone, 'woodDark', x, top - 1.1, z, radius * 1.4, radius * 1.4, .22, sides);
      ringEllipse(zone, 'brassDark', radius * 1.38, radius * 1.38, top - .25, .065, [x, z]);
      for (let i = 0; i < sides; i++) {
        const a = i / sides * Math.PI * 2;
        rod(zone, 'ironDark', [x + Math.cos(a) * radius * 1.36, top - 1.05, z + Math.sin(a) * radius * 1.36], [x + Math.cos(a) * radius * 1.36, top - .2, z + Math.sin(a) * radius * 1.36], .055);
      }
    }
  }

  // Main keep: irregular vertical volumes, deep eaves and an inhabited rear.
  box('keep', 'plaster', -1.4, 10.2, -2.0, 8.9, 12.1, 7.0);
  box('keep', 'ironDark', -1.4, 4.65, -2.0, 9.2, 1.0, 7.4);
  for (const yy of [5.8, 9.8, 14.9]) {
    box('keep', 'woodDark', -1.4, yy, -2.0, 9.1, .22, 7.3);
    box('keep', 'brassDark', -1.4, yy + .18, 1.7, 9.3, .075, .12);
    box('keep', 'brassDark', -1.4, yy + .18, -5.7, 9.3, .075, .12);
  }
  for (const xx of [-5.7, -3.2, .3, 2.9]) {
    box('keep', 'woodDark', xx, 10.2, 1.56, .18, 11.7, .22);
    box('keep', 'woodDark', xx, 10.2, -5.56, .18, 11.7, .22);
    if (xx !== -3.2) for (const yy of [7.65, 12.5]) {
      windowRect('keep', xx + .75, yy, 1.67, .67, 1.6);
      windowRect('keep', xx + .75, yy, -5.67, .6, 1.5, Math.PI);
    }
  }
  for (const xx of [-5.95, 3.15]) for (const zz of [-4, -.6]) {
    windowRect('keep', xx, 12.2, zz, .64, 1.65, xx < 0 ? -Math.PI / 2 : Math.PI / 2);
    windowRect('keep', xx, 7.6, zz, .60, 1.4, xx < 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  gableRoof('keep', -1.55, 16.25, -2.0, 10.4, 8.6, 4.55, -.55);
  tower('keep', -5.6, 2.6, 4.1, 1.55, 10.5, 4.1, { balcony: true });
  tower('keep', 5.0, 1.1, 4.1, 1.72, 12.0, 4.9, { lean: -.23 });
  tower('keep', -5.1, -6.1, 4.1, 1.7, 14.8, 4.75, { balcony: true, lean: -.12 });
  tower('keep', 4.8, -6.0, 4.1, 1.42, 11.7, 3.9);
  // Lower inhabited galleries step outward, rather than duplicating one tower.
  box('keep', 'plasterShade', -7.7, 7.65, -1.0, 4.5, 6.9, 5.0);
  gableRoof('keep', -7.7, 11.25, -1, 5.6, 6.2, 3.0, -.35);
  box('keep', 'woodDark', -7.7, 7.25, 1.60, 4.8, .20, .26);
  for (const xx of [-9.1, -7.7, -6.3]) windowRect('keep', xx, 8.6, 1.57, .55, 1.2);
  box('keep', 'plaster', 7.2, 7.15, -3.1, 4.2, 5.9, 5.6);
  gableRoof('keep', 7.2, 10.2, -3.1, 5.2, 6.5, 2.45, .4);
  for (const zz of [-4.8, -3.2, -1.6]) windowRect('keep', 9.35, 8.0, zz, .5, 1.20, Math.PI / 2);
  tower('keep', -2.6, 5.4, 4.1, 1.2, 6.8, 3.1);
  tower('keep', 7.6, 5.1, 4.1, 1.35, 7.2, 3.15);
  // Long upper front gallery and full rear balcony with braces and railings.
  for (const [cx, cy, cz, width] of [[-.6, 11.2, 3.05, 7.5], [-1.2, 8.6, -7.05, 8.3], [-7.9, 6.4, 2.2, 4.3]]) {
    box('keep', 'wood', cx, cy, cz, width, .28, 1.55);
    plankLines('keep', cx, cy + .15, cz, width, 1.55);
    for (const xx of [-width / 2 + .1, width / 2 - .1]) {
      rod('keep', 'woodDark', [cx + xx, cy - 1.35, cz - .55], [cx + xx, cy - .1, cz + .6], .10);
    }
    for (let i = 0; i <= Math.floor(width / .52); i++) {
      const xx = cx - width / 2 + i * .52;
      rod('keep', 'ironDark', [xx, cy + .18, cz + .78], [xx, cy + 1.15, cz + .78], .04);
      if (i % 3 === 0) cyl('keep', 'brassDark', xx, cy + 1.3, cz + .78, 0, .09, .3, 5);
    }
    rod('keep', 'brassDark', [cx - width / 2, cy + 1.12, cz + .78], [cx + width / 2, cy + 1.12, cz + .78], .065);
  }
  // Diagonal timber supports and repaired plaster boards.
  for (const xx of [-5.55, -2.8, .2, 2.7]) {
    rod('keep', 'woodDark', [xx, 9.9, 1.69], [xx + .8, 11.3, 1.69], .09);
    rod('keep', 'woodDark', [xx, 14.8, -5.69], [xx + .8, 13.3, -5.69], .08);
  }
  box('keep', 'canvasPatch', -3.95, 6.2, 1.75, .9, 1.3, .08, .1);

  // Tall open bell cage: a focal object that is readable through all four sides.
  const bx = 1.9, bz = -1.7, cageY = 21.1, cageTop = 28.9, cageW = 2.0;
  box('bell_tower', 'plasterShade', bx, 18.0, bz, 3.9, 6.2, 3.9);
  for (const yy of [15.4, 18.5, 20.8, 28.55]) {
    box('bell_tower', 'ironDark', bx, yy, bz, 4.55, .25, 4.55);
    box('bell_tower', 'brassDark', bx, yy + .18, bz, 4.65, .085, 4.65);
  }
  for (const side of [-1, 1]) {
    windowRect('bell_tower', bx + side * 2.02, 18.0, bz, .54, 1.8, side * Math.PI / 2);
    windowRect('bell_tower', bx, 18.0, bz + side * 2.02, .54, 1.8, side > 0 ? 0 : Math.PI);
  }
  for (const dx of [-cageW, cageW]) for (const dz of [-cageW, cageW]) {
    cyl('bell_tower', 'ironDark', bx + dx, (cageY + cageTop) / 2, bz + dz, .15, .24, cageTop - cageY, 8);
    for (const yy of [21.4, 24.4, 28.3]) {
      cyl('bell_tower', 'brassDark', bx + dx, yy, bz + dz, .26, .26, .25, 8);
      sphere('bell_tower', 'brass', bx + dx, yy + .3, bz + dz, .16, .16, .16, 8, 5);
    }
    turretRoof('bell_tower', bx + dx, 28.8, bz + dz, .44, 1.6, 8, dx * .07);
  }
  for (const side of [-1, 1]) for (const back of [false, true]) {
    const zz = bz + side * 2;
    const ax = back ? bx + side * 2 : bx - 2;
    const end = back ? [bx + side * 2, 27.75, bz + 2] : [bx + 2, 27.75, zz];
    const start = back ? [ax, 27.75, bz - 2] : [bx - 2, 27.75, zz];
    rod('bell_tower', 'brassDark', start, end, .095);
    for (const t of [-1.25, 0, 1.25]) {
      const xx = back ? bx + side * 2 : bx + t, z = back ? bz + t : zz;
      rod('bell_tower', 'ironDark', [xx, 21.1, z], [xx, 22.4, z], .045);
    }
    const left = back ? [ax, 26.8, bz - 2] : [bx - 2, 26.8, zz];
    const mid = back ? [ax, 28.2, bz] : [bx, 28.2, zz];
    const right = back ? [ax, 26.8, bz + 2] : [bx + 2, 26.8, zz];
    tube('bell_tower', 'ironDark', [left, mid, right], .14, 7, 16);
  }
  // Bell profile, with a real flared mouth, dark hollow and hanging clapper.
  const bellProfile = [new THREE.Vector2(1.22, -1.5), new THREE.Vector2(1.36, -1.38), new THREE.Vector2(1.2, -1.17), new THREE.Vector2(.95, -.60), new THREE.Vector2(.82, .30), new THREE.Vector2(.67, 1.05), new THREE.Vector2(.38, 1.35), new THREE.Vector2(.12, 1.4)];
  add(new THREE.LatheGeometry(bellProfile, 24), 'brass', 'bell_tower', [bx, 24.45, bz]);
  cyl('bell_tower', 'brassDark', bx, 23.08, bz, 1.14, 1.14, .075, 24);
  torus('bell_tower', 'brassLight', bx, 23.02, bz, 1.31, .10);
  for (const yy of [24.1, 24.35, 25.32]) torus('bell_tower', 'brassLight', bx, yy, bz, yy > 25 ? .66 : .88, .035);
  rod('bell_tower', 'ironDark', [bx, 26.9, bz], [bx, 25.8, bz], .12);
  torus('bell_tower', 'brassDark', bx, 26.0, bz, .25, .08, [0, 0, 0]);
  rod('bell_tower', 'ironDark', [bx, 23.25, bz], [bx + .08, 22.5, bz + .1], .075);
  sphere('bell_tower', 'brassDark', bx + .08, 22.45, bz + .1, .21, .24, .21, 10, 6);
  turretRoof('bell_tower', bx, 28.9, bz, 3.15, 6.0, 12, -.25);
  // Four high finials and connecting crest ornament.
  for (const side of [-1, 1]) {
    rod('bell_tower', 'brassDark', [bx, 32.7, bz], [bx + side * 1.2, 33.5, bz], .06);
    cyl('bell_tower', 'brass', bx + side * 1.2, 33.75, bz, 0, .14, .6, 6);
  }

  function cannon(x, z, angle, size = 1) {
    const zone = 'bastions', baseY = 6.5;
    cyl(zone, 'ironDark', x, 4.95, z, 2.5 * size, 2.65 * size, 1.6, 14);
    cyl(zone, 'ironBlue', x, 6.0, z, 2.62 * size, 2.62 * size, .62, 14);
    ringEllipse(zone, 'brassDark', 2.68 * size, 2.68 * size, 6.3, .09, [x, z]);
    ringEllipse(zone, 'ironDark', 2.66 * size, 2.66 * size, 5.0, .10, [x, z]);
    spikes(zone, 'ironDark', x, z, 6.3, 2.6 * size, 12, .7 * size);
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      sphere(zone, 'brassDark', x + Math.cos(a) * 2.66 * size, 6.03, z + Math.sin(a) * 2.66 * size, .085, .085, .085, 6, 4);
    }
    const trans = (a, b, c) => [x + (a * Math.cos(angle) + c * Math.sin(angle)) * size, baseY + b * size, z + (-a * Math.sin(angle) + c * Math.cos(angle)) * size];
    const localBox = (key, a, b, c, w, h, d) => box(zone, key, ...trans(a, b, c), w * size, h * size, d * size, 0, angle);
    localBox('woodDark', 0, .18, -.3, 2.5, .4, 2.9);
    localBox('brassDark', -1, .65, -.3, .25, 1.15, 1.6);
    localBox('brassDark', 1, .65, -.3, .25, 1.15, 1.6);
    for (const xx of [-1.15, 1.15]) {
      const pp = trans(xx, .38, -.6);
      cyl(zone, 'ironDark', ...pp, .57 * size, .57 * size, .26 * size, 12, [Math.PI / 2, angle + Math.PI / 2, 0]);
      sphere(zone, 'brass', ...pp, .16 * size, .16 * size, .16 * size, 8, 5);
    }
    const barrel = (key, c, r1, r2, length, open = false) => {
      const pp = trans(0, 1.2 + .04 * c, c);
      const g = new THREE.CylinderGeometry(r1 * size, r2 * size, length * size, 18, 1, open);
      g.rotateX(Math.PI / 2 - .04); g.rotateY(angle);
      add(g, key, zone, pp);
    };
    barrel('iron', .9, .56, .83, 4.9, true);
    barrel('ironDark', 3.1, .6, .64, .34, true);
    barrel('ironDark', 2.78, .48, .48, .08, false);
    barrel('brassDark', -.9, .84, .84, .24);
    barrel('brass', .05, .75, .75, .18);
    barrel('brassDark', 2.1, .63, .63, .21);
    const breech = trans(0, 1.16, -1.6); sphere(zone, 'ironDark', ...breech, .82 * size, .83 * size, .68 * size, 14, 8);
    const handle = trans(0, 1.15, -2.3); sphere(zone, 'brassDark', ...handle, .22 * size, .22 * size, .22 * size, 8, 5);
    for (const c of [-.9, .05, 2.1]) for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, r = c > 1 ? .66 : c < 0 ? .87 : .78;
      const pp = trans(Math.cos(a) * r, 1.2 + Math.sin(a) * r, c);
      sphere(zone, 'brassLight', ...pp, .055, .055, .055, 6, 3);
    }
    // Triangular armor aprons point below each circular battlement.
    const out = trans(0, -1.3, 2.65), low = trans(0, -5.1, 2.95);
    panel(zone, 'ironBlue', [trans(-1.0, -1.0, 2.65), out, trans(1.0, -1.0, 2.65), low]);
    rod(zone, 'brassDark', out, low, .08);
  }
  cannon(-11.6, 5.8, -.85, 1.15);
  cannon(11.4, 5.0, .93, 1.11);
  cannon(-11.4, -5.2, -2.2, 1.0);
  cannon(11.2, -5.4, 2.22, 1.0);
  cannon(-4.6, -10.0, -2.85, .83);
  cannon(4.9, -9.9, 2.84, .83);

  // Front gate: arch contour, timber gate inset, separate iron portcullis.
  const gateZ = 9.15;
  box('dock', 'ironBlue', -3.45, 7.05, gateZ, 2.0, 6.0, 2.7);
  box('dock', 'ironBlue', 3.45, 7.05, gateZ, 2.0, 6.0, 2.7);
  box('dock', 'plasterShade', 0, 10.0, gateZ, 6.15, 1.05, 2.3);
  const archPts = [[-2.48, 4.35, gateZ + 1.42], [-2.48, 7.7, gateZ + 1.42], [-1.95, 9.0, gateZ + 1.42], [0, 10.2, gateZ + 1.42], [1.95, 9.0, gateZ + 1.42], [2.48, 7.7, gateZ + 1.42], [2.48, 4.35, gateZ + 1.42]];
  tube('dock', 'brassDark', archPts, .21, 8, 32);
  tube('dock', 'ironDark', archPts.map(([x, y, z]) => [x * 1.12, y + .04, z - .15]), .19, 8, 32);
  box('dock', 'woodDark', 0, 6.62, gateZ + .98, 4.70, 4.9, .18);
  for (let i = -5; i <= 5; i++) {
    const x = i * .42;
    const top = 9.4 - Math.abs(x) * .43;
    box('dock', 'ironDark', x, (top + 4.2) / 2, gateZ + 1.2, .11, top - 4.2, .18);
    cyl('dock', 'ironDark', x, 4.14, gateZ + 1.2, .09, 0, .4, 5);
  }
  for (const yy of [4.8, 5.85, 6.9, 7.95]) box('dock', 'ironDark', 0, yy, gateZ + 1.32, 4.6, .13, .15);
  for (const side of [-1, 1]) {
    tower('dock', side * 3.6, gateZ, 4.1, 1.2, 6.2 + (side < 0 ? .6 : 0), 2.8, { sides: 10 });
    windowRect('dock', side * 3.6, 7.5, gateZ + 1.25, .40, 1.25);
    for (const yy of [5.4, 8.5]) {
      box('dock', 'brass', side * 2.9, yy, gateZ + 1.63, .16, .6, .16);
      sphere('dock', 'glass', side * 2.9, yy, gateZ + 1.75, .13, .27, .13, 8, 6);
    }
  }
  gableRoof('dock', 0, 10.15, gateZ, 5.7, 3.3, 2.0, -.2);
  box('dock', 'wood', 0, 4.28, 15.0, 7.2, .42, 10.8);
  box('dock', 'woodDark', 0, 3.86, 15.0, 7.45, .38, 10.9);
  plankLines('dock', 0, 4.50, 15.0, 7.2, 10.8);
  for (let i = 0; i < 9; i++) {
    const z = 10.0 + i * 1.28;
    box('dock', 'woodDark', 0, 4.51, z, 7.2, .023, .028);
    for (const side of [-1, 1]) {
      box('dock', 'ironDark', side * 3.64, 4.68, z, .25, 1.8, .32);
      cyl('dock', 'brassDark', side * 3.64, 5.78, z, 0, .22, .55, 6);
      box('dock', 'brassDark', side * 3.65, 4.35, z, .31, .27, .4);
      if (i < 8 && i !== 2) {
        tube('dock', 'brassDark', [[side * 3.65, 5.3, z], [side * 3.65, 5.02, z + .64], [side * 3.65, 5.3, z + 1.28]], .055, 5, 10);
      }
    }
  }
  // Deep diagonal struts make the projecting dock believable from below.
  for (const side of [-1, 1]) for (const z of [12.2, 16.5, 19.6]) {
    rod('dock', 'woodDark', [side * 3.0, 3.7, z], [side * 4.4, .2, 9.4], .23, 6);
    rod('dock', 'brassDark', [side * 3.0, 3.8, z], [side * 4.4, .4, 9.4], .08, 6);
  }

  function chain(zone, points, linkR = .20, n = 28) {
    const curve = new THREE.CatmullRomCurve3(points.map(v));
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), p = curve.getPoint(t), tangent = curve.getTangent(t);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      const g = new THREE.TorusGeometry(linkR, linkR * .25, 3, 8);
      g.scale(.8, 1.25, 1); if (i % 2) g.rotateY(Math.PI / 2);
      g.applyQuaternion(q); g.translate(...p.toArray()); add(g, 'brassDark', zone);
    }
  }
  for (const side of [-1, 1]) {
    chain('dock', [[side * 3.3, 9.2, 10.0], [side * 3.4, 7.1, 13.5], [side * 3.5, 4.8, 19.6]], .17, 38);
    chain('hull', [[side * 10.5, 1.6, 7.4], [side * 11, -3.2, 7.8], [side * 9.0, -5.1, 8.7]], .20, 28);
    chain('hull', [[side * 5.0, -2.8, -9.4], [side * 5.2, -6.7, -9.4], [side * 5.5, -7.6, -9.4]], .18, 23);
    torus('hull', 'ironDark', side * 5.5, -8.0, -9.4, .42, .12, [0, 0, 0], Math.PI * 1.6, 16);
  }
  // An asymmetric dock crane, its trussed boom and hanging salvage basket.
  const craneX = 6.3, craneZ = 11.0;
  cyl('dock', 'ironDark', craneX, 5.0, craneZ, 1.0, 1.2, 1.8, 12);
  cyl('dock', 'brassDark', craneX, 5.7, craneZ, .8, .8, .18, 12);
  rod('dock', 'woodDark', [craneX, 5.1, craneZ], [craneX + .25, 10.8, craneZ], .24, 8);
  rod('dock', 'ironDark', [craneX - .6, 5.2, craneZ], [craneX + .3, 10.2, craneZ], .12);
  const ba = [craneX, 9.2, craneZ], bb = [10.8, 12.25, 15.4];
  const bu = [craneX, 10.35, craneZ], bv = [10.8, 12.9, 15.4];
  rod('dock', 'woodDark', ba, bb, .21, 6); rod('dock', 'brassDark', bu, bv, .12, 6);
  for (let i = 0; i < 5; i++) {
    const t = i / 5, u = (i + 1) / 5;
    const a = ba.map((p, j) => p * (1 - t) + bb[j] * t);
    const b = bu.map((p, j) => p * (1 - u) + bv[j] * u);
    const c = ba.map((p, j) => p * (1 - u) + bb[j] * u);
    rod('dock', 'ironDark', a, b, .06); rod('dock', 'ironDark', b, c, .06);
  }
  torus('dock', 'brass', ...bb, .35, .09, [0, Math.PI / 4, 0]);
  chain('dock', [bb, [10.8, 8.6, 15.4], [10.8, 7.4, 15.4]], .13, 29);
  const basketX = 10.8, basketY = 6.3, basketZ = 15.4;
  sphere('dock', 'soot', basketX, basketY, basketZ, .9, .72, .8, 10, 6);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    rod('dock', 'brassDark', [basketX + Math.cos(a) * .82, basketY - .45, basketZ + Math.sin(a) * .82], [basketX + Math.cos(a) * .60, basketY + .8, basketZ + Math.sin(a) * .6], .045);
    rod('dock', 'ironDark', [basketX + Math.cos(a) * .6, basketY + .8, basketZ + Math.sin(a) * .6], [basketX, basketY + 1.1, basketZ], .04);
  }
  ringEllipse('dock', 'brassDark', .78, .78, basketY - .35, .06, [basketX, basketZ]);
  ringEllipse('dock', 'brassDark', .75, .75, basketY + .35, .05, [basketX, basketZ]);
  // Crates, tied rope rolls and a cargo barrel, kept away from the access line.
  for (const [xx, zz, ww, hh] of [[-2.5, 16.7, 1.0, 1.1], [-2.7, 18.2, .8, .8], [2.5, 12.1, .8, .9]]) {
    box('dock', 'wood', xx, 4.5 + hh / 2, zz, ww, hh, ww);
    for (const yy of [4.57, 4.5 + hh - .07]) box('dock', 'woodDark', xx, yy, zz + ww / 2 + .02, ww, .12, .08);
    for (const s of [-1, 1]) box('dock', 'woodDark', xx + s * (ww / 2 - .06), 4.5 + hh / 2, zz + ww / 2 + .03, .10, hh, .09);
    rod('dock', 'brassDark', [xx - ww / 2, 4.55, zz + ww / 2 + .08], [xx + ww / 2, 4.5 + hh - .05, zz + ww / 2 + .08], .04);
  }
  cyl('dock', 'woodLight', -2.65, 5.2, 13.2, .42, .45, 1.35, 12);
  for (const yy of [4.7, 5.4, 5.7]) torus('dock', 'ironDark', -2.65, yy, 13.2, .43, .04);
  for (let i = 0; i < 4; i++) torus('dock', 'canvasShade', 2.3, 4.58 + i * .055, 17.4, .35 - i * .045, .055);

  // Rear factory stack, pressure cylinders, pipes and ventilator wheels.
  for (const [x, z, h, radius] of [[-1.7, -7.3, 18.6, .75], [.25, -7.8, 20.0, .85], [2.0, -7.5, 16.5, .6]]) {
    cyl('machinery', 'ironLight', x, 4.1 + h / 2, z, radius * .85, radius, h, 12);
    for (const yy of [5.2, 9.0, 14.2, 4.1 + h - .6]) {
      cyl('machinery', 'brassDark', x, yy, z, radius * 1.1, radius * 1.1, .22, 12);
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2;
        sphere('machinery', 'brass', x + Math.cos(a) * radius * 1.12, yy, z + Math.sin(a) * radius * 1.12, .06, .06, .06, 6, 3);
      }
    }
    cyl('machinery', 'ironDark', x, 4.1 + h, z, radius * 1.2, radius * 1.2, .4, 12, [0, 0, 0], true);
    cyl('machinery', 'soot', x, 4.1 + h - .28, z, radius * .85, radius * .85, .06, 12);
    cyl('machinery', 'brassDark', x, 4.1 + h + .25, z, radius * 1.4, radius * 1.0, .25, 12, [0, 0, 0], true);
  }
  for (const side of [-1, 1]) {
    const x = side * 9.9;
    cyl('machinery', 'tealDark', x, 6.2, -2.0, .82, .82, 4.2, 12);
    sphere('machinery', 'teal', x, 8.3, -2.0, .82, .32, .82, 12, 6);
    sphere('machinery', 'teal', x, 4.1, -2.0, .82, .32, .82, 12, 6);
    for (const yy of [4.5, 6.2, 7.9]) torus('machinery', 'brassDark', x, yy, -2, .84, .08);
    tube('machinery', 'brassDark', [[x, 8.5, -2], [x, 9.3, -2], [side * 8, 9.3, -2.0], [side * 8, 10.4, -2]], .14, 8, 18);
    tube('machinery', 'ironDark', [[x, 4.9, -2.7], [side * 11.0, 4.9, -3.8], [side * 11, 2.8, -3.8], [side * 11, 1.1, -4.0]], .19, 8, 18);
    // Horizontal duct and a large fan with broad sculpted blades.
    const fx = side * 12.5, fy = -.1, fz = -.9;
    cyl('machinery', 'ironDark', fx, fy, fz, 1.35, 1.35, 1.25, 16, [0, 0, Math.PI / 2]);
    torus('machinery', 'brassDark', fx + side * .66, fy, fz, 1.30, .13, [0, Math.PI / 2, 0]);
    sphere('machinery', 'brass', fx + side * .72, fy, fz, .18, .25, .25, 10, 7);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const px = fx + side * .72;
      panel('machinery', i % 2 ? 'teal' : 'tealLight', [[px, fy + Math.cos(a) * .22, fz + Math.sin(a) * .22], [px + side * .08, fy + Math.cos(a + .22) * 1.17, fz + Math.sin(a + .22) * 1.17], [px, fy + Math.cos(a + .68) * 1.08, fz + Math.sin(a + .68) * 1.08], [px - side * .08, fy + Math.cos(a + .55) * .36, fz + Math.sin(a + .55) * .36]]);
    }
  }
  // Looped wall pipes, exterior ladders and original valve wheels.
  tube('machinery', 'brassDark', [[-4.7, 5.0, -5.8], [-4.7, 12, -5.8], [-3.9, 13.1, -5.8], [-2.6, 13.1, -5.8], [-2.6, 17.4, -5.8]], .11, 7, 30);
  tube('machinery', 'ironDark', [[6.4, 4.8, -6.4], [7.4, 5.6, -6.4], [7.4, 11.6, -6.4], [5.7, 12.4, -6.4]], .16, 8, 24);
  for (const xx of [-4.15, -3.45]) rod('machinery', 'ironDark', [xx, 4.7, -5.95], [xx, 13.4, -5.95], .055);
  for (let i = 0; i < 19; i++) rod('machinery', 'brassDark', [-4.15, 4.8 + i * .45, -5.95], [-3.45, 4.8 + i * .45, -5.95], .04);
  for (const [x, y, z] of [[7.5, 6.7, -6.4], [-2.6, 10.4, -5.85]]) {
    torus('machinery', 'redDark', x, y, z - .18, .42, .06, [0, 0, 0], Math.PI * 2, 18);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2;
      rod('machinery', 'brassDark', [x, y, z - .18], [x + Math.cos(a) * .4, y + Math.sin(a) * .4, z - .18], .035);
    }
  }

  // Cloth surface follows a custom waved grid. Motif and stitches follow the
  // same parametric sheet; these are actual 3D lines, not a picture billboard.
  function banner(x, y, z, width, length, angle = 0, variant = 0) {
    const zone = 'banners', nx = 9, ny = 15;
    const local = (u, t, offset = 0) => {
      const xx = (u - .5) * width + Math.sin(t * 2.4) * .30 * t;
      let yy = -length * t;
      if (t > .86) yy += Math.pow((t - .86) / .14, 2) * (.15 + .4 * Math.sin(u * 5 * Math.PI + variant));
      const zz = Math.sin(u * Math.PI * 2.5 + t * 3.2 + variant) * (.10 + t * .18) + Math.sin(t * 4.1) * .28 + offset;
      return [x + xx * Math.cos(angle) + zz * Math.sin(angle), y + yy, z - xx * Math.sin(angle) + zz * Math.cos(angle)];
    };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const u = i / nx, t = j / ny;
      panel(zone, (i === 0 || i === nx - 1) ? 'redDark' : (i + j) % 11 === 0 ? 'redLight' : 'red', [local(u, t), local(u + 1 / nx, t), local(u + 1 / nx, t + 1 / ny), local(u, t + 1 / ny)]);
    }
    rod(zone, 'ironDark', [x, Math.max(4.15, y - length - 1.1), z - .16], [x, y + 1.65, z - .16], .07);
    const left = local(-.1, -.01), right = local(1.1, -.01);
    rod(zone, 'brassDark', left, right, .075);
    for (const pp of [left, right]) { sphere(zone, 'brass', ...pp, .13, .13, .13, 8, 5); cyl(zone, 'ironDark', pp[0], pp[1] + .23, pp[2], 0, .10, .4, 5); }
    for (const u of [.08, .92]) {
      const ps = Array.from({ length: 25 }, (_, i) => local(u, .03 + i / 24 * .91, .025));
      tube(zone, 'redLight', ps, .017, 4, 24);
      for (let k = 0; k < 18; k++) {
        const t = .05 + k * .048;
        rod(zone, 'canvasShade', local(u - .018, t, .042), local(u + .02, t + .013, .042), .013, 4);
      }
    }
    // The 'severed mooring knot': an original angular vertical seam crossed by
    // two broken diagonal loops, deliberately avoiding any borrowed insignia.
    const strokes = [
      [[.5, .23], [.5, .69]], [[.33, .32], [.65, .46]], [[.64, .33], [.34, .51]],
      [[.34, .53], [.65, .65]], [[.50, .67], [.38, .77]], [[.50, .67], [.63, .76]],
    ];
    for (const [a, b] of strokes) {
      const ps = Array.from({ length: 7 }, (_, k) => { const t = k / 6; return local(a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, .05); });
      tube(zone, 'canvasPatch', ps, width * .024, 4, 6);
    }
    const patch = [local(.70, .79, .045), local(.89, .79, .045), local(.90, .87, .045), local(.70, .87, .045)];
    if (variant % 2 === 0) panel(zone, 'redLight', patch);
  }
  banner(-5.5, 20.5, 3.95, 1.7, 7.5, -.08, 0);
  banner(5.6, 23.5, 1.3, 2.15, 9.5, .50, 1);
  banner(-10.7, 12.0, 4.1, 1.55, 6.0, -.30, 2);
  banner(10.2, 13.6, 4.0, 1.55, 6.1, .32, 3);
  banner(-1.6, 12.4, 10.92, 1.22, 5.7, -.02, 4);
  banner(-6.0, 17.7, -7.75, 1.45, 6.0, Math.PI, 1);
  banner(5.7, 14.7, -7.5, 1.4, 5.9, Math.PI + .25, 2);
  // Long pennant on the mast, heavy below and loose at the split tail.
  rod('banners', 'ironDark', [-10.5, 4.2, -3.0], [-10.5, 18.1, -3.0], .085);
  banner(-10.45, 16.3, -2.9, 1.4, 5.6, -.45, 3);

  // Additional structural hand-painted accents; sparse, intentional scratches
  // provide rhythm without an image texture or excessive microgeometry.
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2;
    const x = Math.cos(a) * 13.9, z = Math.sin(a) * 11.07;
    if (i % 2) rod('hull', 'ironLight', [x, .6 + (i % 3) * .15, z], [x * .996, 1.2 + (i % 4) * .16, z * .996], .023, 4);
  }
  for (const z of [-6.7, 5.4]) for (const x of [-6.8, 6.8]) {
    cyl('keep', 'ironDark', x, 4.5, z, .17, .22, .7, 7);
    sphere('keep', 'glass', x, 5.13, z, .16, .24, .16, 8, 6);
    cyl('keep', 'brassDark', x, 5.45, z, 0, .3, .24, 8);
    torus('keep', 'ironDark', x, 5.65, z, .12, .035, [0, 0, 0], Math.PI * 2, 8);
  }

  // Consolidate geometry by semantic zone and material. The review can still
  // isolate architectural systems; GLB traversal remains small and predictable.
  for (const zone of zones) {
    const group = new THREE.Group(); group.name = zone.nodeName;
    group.userData = { id: zone.id, name_ko: zone.name_ko, description: zone.description, semantic_group: true };
    let triangles = 0;
    for (const [key, geometries] of parts.get(zone.id)) {
      const merged = mergeGeometries(geometries, false);
      if (!merged) throw new Error(`Cannot merge zone ${zone.id}/${key}`);
      merged.computeBoundingBox(); merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material(key));
      mesh.name = `${zone.id}__${key}`;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData = { semantic_zone: zone.id, paint: key, authored_components: geometries.length };
      triangles += merged.attributes.position.count / 3;
      group.add(mesh); for (const g of geometries) g.dispose();
    }
    group.userData.triangles = triangles; root.add(group);
  }
  root.userData.authored_components = count;
  root.updateMatrixWorld(true);
  return { root, zones };
}
