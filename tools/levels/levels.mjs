// New opt-in spatial layer. Existing battlefield world/sim and all GLBs stay intact.
const visual = (id, assetId, position, longestLU, priority = 'required', yawRadians = 0) => ({ id, assetId, position, longestLU, priority, yawRadians, anchor: 'center' });
const solid = (id, center, halfExtents, visualIds) => ({ id, kind: 'solid', center, halfExtents, visualIds, occludesCamera: true, cameraPolicy: 'fade-visual-only' });
const frameId = 'levels-lu-yup-v1';
const camera = { elevationDegrees: 55, projection: 'orthographic', halfHeightLU: 35, followOffsetLU: [0, 55, 38.51], occlusionSamples: ['center', 'top', 'left', 'right'], fadeOpacity: .22, restoreOnClear: true };
export const coordinateProfiles = {
  battlefield: { origin: [0, 0, 0], unitsPerArtUnit: 1, yawRadians: 0, hostUnitsPerLU: 1, note: 'Existing battlefield XZ coordinates; LU is provisional and not meters.' },
  harborArt: { origin: [0, -4, 64], unitsPerArtUnit: 3, yawRadians: 0, note: 'Optional full-scene art comparison only. It does not transform the independent layout/colliders.' },
  encountersExample: { origin: [0, 0, 0], unitsPerArtUnit: .2, yawRadians: 0, hostUnitsPerLU: .2, note: 'Scale example only; ±18×±12 encounter arena needs its own spawn/obstacle review. Do not adopt automatically.' }
};

const legacyObstacles = [
  [-15, -5, 8.4, 'island-rock-tall', 25], [40, 5, 8, 'island-grass-medium', 24], [-49, 26, 10, 'island-grass-medium', 28],
  [-51, -48, 8.8, 'island-rock-small', 23], [44, -64, 10.4, 'island-grass-medium', 28], [-8, -77, 6.4, 'island-rock-small', 18],
  [73, 43, 8, 'island-grass-small', 22], [-78, -8, 6.8, 'island-grass-small', 19]
];

export const levels = [
  {
    id: 'first-voyage', name: '첫 항해 · 종항 잔해해역 공간 검사', frameId,
    provenance: { sourceWorld: 'tools/battlefield/world.js', sourceSimulation: 'tools/battlefield/sim.mjs', inheritedCommit: 'e65ab87d2af0c4b08e51f312c9eb0998aa895c69', status: 'new-independent-spatial-proposal', note: 'Existing positions and circle radii are retained as provenance. AABBs are conservative inspection proxies, not a silent host physics replacement.' },
    bounds: { min: [-90, -10, -90], max: [90, 10, 90] }, flightY: 0, artFrame: coordinateProfiles.battlefield,
    playerStart: { position: [0, 0, 35], headingRadians: Math.PI }, camera,
    visuals: [
      ...legacyObstacles.map(([x, z, r, assetId, longestLU], i) => visual(`terrain-${i}`, assetId, [x, -6, z], longestLU)),
      visual('wreck-marker', 'wreckage-shoal', [-15, -1, -5], 12, 'landmark'),
      visual('return-buoy-west', 'beacon-buoy', [-12, -1, 48], 4), visual('return-buoy-east', 'beacon-buoy', [12, -1, 48], 4),
      visual('north-beacon', 'boundary-marker', [-8, 5, -77], 5, 'landmark'),
      visual('cloud-west', 'cloud-bank', [-55, -25, -20], 45, 'decoration'), visual('cloud-east', 'cloud-bank', [55, -25, 0], 50, 'decoration')
    ],
    colliders: legacyObstacles.map(([x, z, radius], i) => ({ ...solid(`terrain-solid-${i}`, [x, 0, z], [radius, 9, radius], [`terrain-${i}`, ...(i === 0 ? ['wreck-marker'] : [])]), legacyCircleXZ: { x, z, radius }, note: 'Legacy planar avoidance footprint. Visual mesh and proxy are intentionally independent.' })),
    spawnAnchors: [
      { id: 'player-entry', position: [0, 0, 35], headingRadians: Math.PI, tags: ['player', 'entry'] },
      { id: 'west-patrol', position: [-32, 0, -16], headingRadians: 0, tags: ['enemy', 'opening-candidate'], note: 'Shifted proposal from legacy (-28,-12) to leave conservative full-ship rotation room; encounters owns acceptance and order.' },
      { id: 'east-patrol', position: [28, 0, -27], headingRadians: 0, tags: ['enemy', 'opening-candidate'] },
      { id: 'north-target', position: [5, 0, -52], headingRadians: 0, tags: ['enemy', 'objective-candidate'] }
    ],
    legacyHostAnchors: [{ id: 'tax-1', position: [-28, 0, -12] }, { id: 'scout-1', position: [28, 0, -27] }, { id: 'salvager-1', position: [5, 0, -52] }],
    triggers: [{ id: 'return-to-jonghang', type: 'return-request', center: [0, 0, 48], halfExtents: [8, 5, 8], target: 'jonghang-harbor', requiresConfirmation: true, hostLegacyCircleXZ: { x: 0, z: 48, radius: 12 }, owner: 'harbor', note: 'Query advertises docking availability; battlefield existing return eligibility remains authoritative.' }],
    corridors: [
      { id: 'main-flight', name: '주 항로', widthLU: 18, points: [[0, 0, 35], [14, 0, 22], [14, 0, -36], [5, 0, -52]] },
      { id: 'east-bypass', name: '동쪽 넓은 우회', widthLU: 18, points: [[0, 0, 35], [27, 0, 30], [51, 0, 23.9], [62, 0, 23.9], [62, 0, -28], [20, 0, -39], [5, 0, -52]] },
      { id: 'return-approach', name: '귀환 접근', widthLU: 18, points: [[14, 0, 22], [0, 0, 35], [0, 0, 48]] }
    ],
    turningPockets: [{ id: 'return-turn', center: [0, 0, 35], radiusLU: 9 }, { id: 'north-turn', center: [5, 0, -52], radiusLU: 9 }],
    referenceTargets: [{ id: 'readability-target', position: [5, 0, -52], radiusLU: 2, note: 'Diagnostic target only; no enemy, damage or boss completion.' }]
  },
  {
    id: 'jonghang-harbor', name: '종항 · 귀환·정비 접점 공간 검사', frameId,
    provenance: { sceneReference: 'outputs/world-assets/scenes/jonghang-harbor.glb', status: 'new-independent-priority-layout', note: 'Small independent asset layout follows existing harbor art. Full source scene is preserved as an optional comparison; this layout is not its replacement.' },
    bounds: { min: [-45, -10, 20], max: [45, 30, 90] }, flightY: 0, artFrame: coordinateProfiles.battlefield,
    playerStart: { position: [0, 0, 40], headingRadians: 0 }, camera: { ...camera, halfHeightLU: 28 },
    visuals: [
      visual('dock-main', 'dock-straight', [0, -9, 64], 20), visual('dock-end', 'dock-endcap', [0, -7, 56], 9),
      visual('platform-west', 'platform-square', [-17, -7, 66], 19), visual('platform-east', 'platform-square', [17, -7, 66], 19),
      visual('service-console', 'departure-console', [-11, -3.3, 56], 3), visual('repair-point', 'repair-station', [-13, -3, 59], 4),
      visual('storage-point', 'storage-chest', [13, -3, 59], 4), visual('mooring-point', 'mooring-ring', [11, -3, 56], 3),
      visual('workshop', 'repair-workshop', [-17, 0, 67], 14, 'landmark'), visual('market', 'canvas-market', [17, 0, 67], 14, 'landmark'),
      visual('lighthouse', 'beacon-lighthouse', [28, 6, 72], 20, 'landmark'),
      visual('harbor-cloud', 'cloud-bank', [0, -25, 68], 70, 'decoration')
    ],
    colliders: [solid('workshop-space', [-17, 1, 67], [6, 9, 8], ['workshop']), solid('market-space', [17, 1, 67], [6, 9, 8], ['market']), solid('lighthouse-space', [28, 7, 72], [4, 13, 4], ['lighthouse']), solid('deck-below-flight', [0, -8, 70], [28, 3, 15], ['dock-main', 'dock-end', 'platform-west', 'platform-east'])],
    spawnAnchors: [{ id: 'harbor-arrival', position: [0, 0, 40], headingRadians: 0, tags: ['player', 'return'] }, { id: 'harbor-berth', position: [0, 0, 52], headingRadians: 0, tags: ['player', 'berth'] }],
    triggers: [
      { id: 'harbor-repair', type: 'harbor-interaction', center: [0, 0, 52], halfExtents: [6, 5, 7], target: 'harbor:repair', requiresConfirmation: true, owner: 'harbor' },
      { id: 'harbor-storage', type: 'harbor-interaction', center: [0, 0, 52], halfExtents: [6, 5, 7], target: 'harbor:storage', requiresConfirmation: true, owner: 'harbor' },
      { id: 'harbor-settlement', type: 'harbor-interaction', center: [0, 0, 52], halfExtents: [6, 5, 7], target: 'harbor:settlement', requiresConfirmation: true, owner: 'harbor' },
      { id: 'harbor-departure', type: 'departure-request', center: [0, 0, 52], halfExtents: [6, 5, 7], target: 'encounters:departure', requiresConfirmation: true, owner: 'encounters' }
    ],
    corridors: [{ id: 'harbor-approach', name: '귀환 진입', widthLU: 18, points: [[0, 0, 32], [0, 0, 40], [0, 0, 52]] }, { id: 'harbor-departure', name: '출항 통로', widthLU: 18, points: [[0, 0, 52], [0, 0, 40], [0, 0, 32]] }],
    turningPockets: [{ id: 'harbor-turn', center: [0, 0, 45], radiusLU: 9 }],
    referenceTargets: [{ id: 'mooring-marker', position: [0, 0, 52], radiusLU: 2, note: 'Spatial marker. No automatic harbor operation.' }],
    fullSceneComparison: { assetId: 'scene:jonghang-harbor', artFrame: coordinateProfiles.harborArt, excludeRootNameIncludes: ['@selected-airship'], cameraFadeRootNameIncludes: ['@suspension-beam', '@suspension-link'], note: 'Full scene includes a ship copy; exclude it. Hiding roots does not reduce file transfer. Full-scene collision is not authored by this proposal.' }
  }
];
