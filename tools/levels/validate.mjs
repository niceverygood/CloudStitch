/** Validate the generated spatial proposal; never mutate source assets or hosts.
 * Node built-ins only. --write saves the report, otherwise stdout is read-only.
 * Catalog hashes are recorded, not recomputed across the asset collection.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { levels as sourceLevels, coordinateProfiles } from './levels.mjs';
import { boxAt, intersectsAABB, placementReport, availableSpawns, corridorReport, segmentAABB, validateFrame } from './adapter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGE = 'outputs/levels-v1/level-package.json';
const OUTPUT = 'outputs/levels-v1/spatial-verification.json';
const EPSILON = 1e-7;
const readJSON = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, ''));
const finiteVector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const finiteBox = value => finiteVector(value?.min) && finiteVector(value?.max) && value.min.every((n, i) => n <= value.max[i]);
const equalNumber = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
const equalVector = (a, b) => finiteVector(a) && finiteVector(b) && a.every((n, i) => equalNumber(n, b[i]));
const validSHA = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);

function safePath(relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Expected repository-relative path.');
  const absolute = path.resolve(ROOT, relative), within = path.relative(ROOT, absolute);
  if (within === '..' || within.startsWith(`..${path.sep}`)) throw new Error(`Path leaves repository: ${relative}`);
  return absolute;
}

/** Read the 20-byte header and JSON chunk only; do not scan BIN or hash GLBs. */
function selectedGLB(relative) {
  const absolute = safePath(relative), stat = fs.statSync(absolute), fd = fs.openSync(absolute, 'r');
  try {
    const header = Buffer.alloc(20);
    if (fs.readSync(fd, header, 0, 20, 0) !== 20) throw new Error(`Truncated GLB header: ${relative}`);
    const magic = header.readUInt32LE(0), version = header.readUInt32LE(4), declaredBytes = header.readUInt32LE(8), jsonBytes = header.readUInt32LE(12), jsonType = header.readUInt32LE(16);
    if (magic !== 0x46546c67 || version !== 2 || declaredBytes !== stat.size || jsonType !== 0x4e4f534a || jsonBytes % 4 !== 0 || jsonBytes + 20 > stat.size || jsonBytes > 16 * 1024 * 1024) throw new Error(`Invalid GLB v2 header: ${relative}`);
    const json = Buffer.alloc(jsonBytes);
    if (fs.readSync(fd, json, 0, jsonBytes, 20) !== jsonBytes) throw new Error(`Truncated GLB JSON: ${relative}`);
    return { record: { path: relative, actualBytes: stat.size, declaredBytes, jsonBytes, headerValid: true, binaryHashComputed: false }, json: JSON.parse(json.toString('utf8')) };
  } finally { fs.closeSync(fd); }
}

function boxGap(a, b) {
  return Math.hypot(...a.min.map((n, i) => Math.max(0, n - b.max[i], b.min[i] - a.max[i])));
}

/** Transform measured source bounds as the preview does: anchor, longest scale,
 * then yaw and position. Absolute rotation gives a conservative visual AABB.
 * This is separate from authored simple colliders and is not mesh physics.
 */
function visualEnvelope(visual, asset) {
  if (!finiteBox(asset?.bounds)) throw new Error(`Missing measured visual bounds: ${visual.assetId}`);
  const rawSize = asset.bounds.max.map((n, i) => n - asset.bounds.min[i]);
  const longest = Math.max(...rawSize);
  if (!(longest > 0)) throw new Error(`Zero-sized visual bounds: ${visual.assetId}`);
  const scale = visual.longestLU / longest, half = rawSize.map(n => n * scale / 2);
  const c = Math.abs(Math.cos(visual.yawRadians)), s = Math.abs(Math.sin(visual.yawRadians));
  const halfExtents = [c * half[0] + s * half[2], half[1], s * half[0] + c * half[2]];
  const center = visual.position.map((n, i) => n + (visual.anchor === 'ground-center' && i === 1 ? half[1] : 0));
  return { visualId: visual.id, assetId: visual.assetId, priority: visual.priority, sourceBounds: asset.bounds, sourceScale: scale, anchor: visual.anchor, yawRadians: visual.yawRadians, center, halfExtents, bounds: boxAt(center, halfExtents) };
}

export function verifySpatialPackage() {
  const report = {
    schemaVersion: 1, gameTitle: 'Cloudstitch', package: PACKAGE,
    status: 'checking-spatial-data-invariants', passed: false, assertions: 0, failures: [], advisories: [],
    scope: 'Selected GLB header/JSON/size and catalog hash records; generated spatial data invariants. No source mutation, whole-asset hash scan, browser or gameplay validation.',
    counts: {}, selectedAssets: [], preservedHeroVariants: [], player: null, levels: [], structuralEstimates: [],
    runtimeMeasurements: { status: 'pending-integrated-browser-QA', loadTimesMs: null, simultaneousMeshCount: null, textureMemoryBytes: null, targetPixels: null, pixelOcclusion: null, note: 'Catalog structure estimates below are not runtime measurements.' }
  };
  const check = (condition, code, details = {}) => {
    report.assertions++;
    if (!condition) report.failures.push({ code, ...details });
    return Boolean(condition);
  };
  const attempt = (section, fn) => { try { return fn(); } catch (error) { check(false, 'section-exception', { section, message: error.message }); return null; } };
  const uniqueIds = (items, scope) => {
    const ids = items.map(item => item.id);
    check(ids.every(id => typeof id === 'string' && id.length > 0) && new Set(ids).size === ids.length, 'unique-valid-ids', { scope });
    return new Set(ids);
  };
  const pkg = attempt('read-package', () => readJSON(PACKAGE));
  const world = attempt('read-world-catalog', () => readJSON('outputs/world-assets/catalog.json'));
  const scenes = attempt('read-scene-catalog', () => readJSON('outputs/world-assets/scene-catalog.json'));
  const shipManifest = attempt('read-player-manifest', () => readJSON('outputs/selected-airship-toon3d/manifest.json'));
  if (!pkg || !world || !scenes || !shipManifest) return finish();
  const catalog = new Map(world.items.map(item => [item.id, item]));
  for (const item of scenes.items) catalog.set(`scene:${item.id}`, item);
  const selected = new Map((pkg.assets || []).map(item => [item.id, item]));

  attempt('catalog-and-package', () => {
    report.counts = { independentWorldAssets: world.items.length, preservedScenes: scenes.items.length, selectedReferences: pkg.assets.length, levels: pkg.levels.length, corridors: pkg.levels.reduce((n, l) => n + l.corridors.length, 0), spawnAnchors: pkg.levels.reduce((n, l) => n + l.spawnAnchors.length, 0) };
    check(world.items.length === 96 && pkg.independentWorldAssetCount === 96, 'world-count-96');
    check(scenes.items.length === 7 && pkg.preservedSceneCount === 7, 'scene-count-7');
    check(report.counts.levels === 2 && report.counts.corridors === 5 && report.counts.spawnAnchors === 6, 'proposal-counts-2-levels-5-corridors-6-spawns', report.counts);
    uniqueIds(world.items, 'world-catalog'); uniqueIds(scenes.items, 'scene-catalog'); uniqueIds(pkg.assets, 'selected-assets'); uniqueIds(pkg.levels, 'levels');
    check(JSON.stringify(pkg.levels) === JSON.stringify(sourceLevels), 'generated-levels-match-source', { remedy: 'Run node tools/levels/build-data.mjs after changing levels.mjs.' });
    check(JSON.stringify(pkg.coordinateProfiles) === JSON.stringify(coordinateProfiles), 'generated-coordinate-profiles-match-source');
    for (const [id, frame] of Object.entries(pkg.coordinateProfiles)) attempt(`frame:${id}`, () => validateFrame(frame));
  });

  for (const asset of pkg.assets || []) attempt(`selected-asset:${asset.id}`, () => {
    const expected = catalog.get(asset.id);
    if (!check(Boolean(expected), 'selected-catalog-reference-exists', { assetId: asset.id })) return;
    const expectedPath = `outputs/world-assets/${expected.model}`;
    check(asset.path === expectedPath, 'selected-model-is-catalog-choice', { assetId: asset.id, actual: asset.path, expected: expectedPath });
    check(validSHA(asset.sha256) && asset.sha256 === expected.sha256, 'catalog-hash-record-matches', { assetId: asset.id });
    const inspected = selectedGLB(asset.path);
    check(inspected.record.actualBytes === asset.bytes && asset.bytes === expected.bytes, 'selected-glb-size-matches', { assetId: asset.id });
    check(finiteBox(asset.bounds), 'selected-asset-finite-bounds', { assetId: asset.id });
    for (const key of ['triangles', 'meshCount', 'textureCount']) check(Number.isInteger(asset[key]) && asset[key] >= 0, 'finite-structural-count', { assetId: asset.id, field: key });
    report.selectedAssets.push({ id: asset.id, ...inspected.record, catalogSHA256: expected.sha256, hashRecordMatches: asset.sha256 === expected.sha256, hashValidation: 'not-recomputed' });
  });

  attempt('preserved-original-normal-roof-variants', () => {
    const heroes = world.items.filter(item => item.build_method === 'hero_meshy');
    check(heroes.length === 6, 'six-preserved-hero-sources');
    for (const item of heroes) {
      const directory = path.posix.dirname(item.source_model);
      const variants = [{ variant: 'original', path: `outputs/world-assets/${item.source_model}`, catalogSHA256: item.source_sha256 }, { variant: 'normal-repaired', path: `outputs/world-assets/${directory}/model-repaired.glb`, catalogSHA256: item.normal_repair?.repaired_sha256 }];
      if (item.roof_repair) variants.push({ variant: 'roof-reinforced', path: `outputs/world-assets/${item.roof_repair.repaired_source.model}`, catalogSHA256: item.roof_repair.repaired_source.sha256 });
      for (const variant of variants) attempt(`preserved:${variant.path}`, () => {
        const bytes = fs.statSync(safePath(variant.path)).size;
        check(bytes > 20 && validSHA(variant.catalogSHA256), 'preserved-variant-path-and-hash-record', { assetId: item.id, path: variant.path });
        report.preservedHeroVariants.push({ assetId: item.id, ...variant, bytes, checked: 'path-and-size-only', binaryHashComputed: false });
      });
    }
    check(report.preservedHeroVariants.length === 14, 'preserved-6-original-6-normal-2-roof-variants');
    for (const id of ['harbor-inn', 'repair-workshop']) check(report.preservedHeroVariants.filter(item => item.assetId === id).length === 3, 'three-preserved-roof-variants', { assetId: id });
  });

  const playerHalfExtents = attempt('actual-player-metadata', () => {
    const player = pkg.player, inspected = selectedGLB(player.path), gltf = inspected.json;
    const primitive = gltf.meshes?.[0]?.primitives?.[0], accessor = gltf.accessors?.[primitive?.attributes?.POSITION];
    const measuredBounds = { min: accessor?.min, max: accessor?.max };
    const rootIds = gltf.scenes?.[gltf.scene || 0]?.nodes || [], rootNode = gltf.nodes?.[rootIds[0]];
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    check(gltf.meshes?.length === 1 && gltf.meshes[0].primitives.length === 1 && rootIds.length === 1 && gltf.nodes?.length === 1 && rootNode?.mesh === 0 && (!rootNode.matrix || rootNode.matrix.every((n, i) => equalNumber(n, identity[i]))) && !rootNode.translation && !rootNode.rotation && !rootNode.scale, 'selected-player-accessor-bounds-use-identity-transform');
    if (!check(finiteBox(measuredBounds), 'actual-player-finite-accessor-bounds')) throw new Error('Player POSITION bounds unavailable.');
    check(equalVector(measuredBounds.min, player.originalBounds.min) && equalVector(measuredBounds.max, player.originalBounds.max), 'player-package-bounds-match-actual-glb-json');
    check(inspected.record.actualBytes === player.bytes && player.bytes === shipManifest.model_bytes && player.sha256 === shipManifest.sha256 && validSHA(player.sha256), 'player-size-and-manifest-hash-record-match');
    const rawSize = measuredBounds.max.map((n, i) => n - measuredBounds.min[i]), scale = player.lengthLU / rawSize[0];
    const widthLU = rawSize[2] * scale, heightLU = rawSize[1] * scale, turnRadiusLU = Math.hypot(player.lengthLU / 2, widthLU / 2), half = [turnRadiusLU, heightLU / 2, turnRadiusLU];
    check(equalVector(player.rawSize, rawSize) && equalNumber(player.lengthLU, 10) && equalNumber(player.widthLU, widthLU) && equalNumber(player.heightLU, heightLU) && equalNumber(player.turnRadiusLU, turnRadiusLU) && equalVector(player.conservativeHalfExtents, half), 'actual-player-conservative-rotation-envelope');
    check(rawSize[0] > rawSize[1] && rawSize[0] > rawSize[2] && equalNumber(player.normalizeYawRadians, Math.PI / 2), 'player-longitudinal-x-axis-explicit-normalization');
    report.player = { ...inspected.record, catalogSHA256: shipManifest.sha256, hashValidation: 'manifest-record-not-recomputed', measuredBounds, measurement: 'actual GLB POSITION accessor bounds under identity root; no binary geometry rescan', lengthLU: player.lengthLU, widthLU, heightLU, turnRadiusLU, rotatingDiameterLU: 2 * turnRadiusLU, conservativeHalfExtents: half, metersApproved: false };
    return half;
  });

  if (playerHalfExtents) for (const level of pkg.levels || []) attempt(`level:${level.id}`, () => {
    const result = {
      id: level.id, corridors: [], turningPockets: [], spawns: [], triggers: [],
      camera: { status: 'proxy-policy-validated-rendered-occlusion-pending' },
      actualVisualEnvelopeChecks: {
        method: 'Measured asset bounds transformed by center/ground anchor, longestLU and absolute yaw rotation; continuous expanded-AABB segment tests. Separate from simple colliders; conservative visual-envelope inspection, not precise mesh physics.',
        excludedDecorations: level.visuals.filter(visual => visual.priority === 'decoration').map(visual => visual.id),
        excludedStaticDiagnostics: ['referenceTargets', 'fleet readability targets', 'selected reference ship as a world obstacle'],
        envelopes: [], corridors: []
      }
    };
    report.levels.push(result);
    check(level.frameId === pkg.frameId && finiteBox(level.bounds), 'level-frame-and-bounds-valid', { levelId: level.id });
    validateFrame(level.artFrame);
    const visualIds = uniqueIds(level.visuals, `${level.id}:visuals`);
    uniqueIds(level.colliders, `${level.id}:colliders`); uniqueIds(level.spawnAnchors, `${level.id}:spawns`); uniqueIds(level.triggers, `${level.id}:triggers`); uniqueIds(level.corridors, `${level.id}:corridors`); uniqueIds(level.turningPockets, `${level.id}:turning-pockets`);
    for (const visual of level.visuals) check(selected.has(visual.assetId) && finiteVector(visual.position) && Number.isFinite(visual.yawRadians) && Number.isFinite(visual.longestLU) && visual.longestLU > 0 && ['center', 'ground-center'].includes(visual.anchor) && ['required', 'landmark', 'decoration'].includes(visual.priority), 'valid-visual-asset-and-finite-transform', { levelId: level.id, visualId: visual.id });
    const visualEnvelopes = level.visuals.filter(visual => visual.priority !== 'decoration').map(visual => visualEnvelope(visual, selected.get(visual.assetId)));
    result.actualVisualEnvelopeChecks.envelopes = visualEnvelopes;
    for (const collider of level.colliders) {
      check(finiteVector(collider.center) && finiteVector(collider.halfExtents) && collider.halfExtents.every(n => n >= 0) && ['solid', 'camera-only'].includes(collider.kind) && typeof collider.occludesCamera === 'boolean', 'valid-simple-collider', { levelId: level.id, colliderId: collider.id });
      check(Array.isArray(collider.visualIds) && collider.visualIds.length > 0 && new Set(collider.visualIds).size === collider.visualIds.length && collider.visualIds.every(id => visualIds.has(id)), 'collider-visual-references-unique-and-valid', { levelId: level.id, colliderId: collider.id });
      check(!collider.occludesCamera || collider.cameraPolicy === 'fade-visual-only', 'camera-fade-keeps-physical-collider', { levelId: level.id, colliderId: collider.id });
    }
    check(finiteVector(level.playerStart?.position) && Number.isFinite(level.playerStart?.headingRadians), 'finite-player-start', { levelId: level.id });
    const start = placementReport(level, level.playerStart.position, playerHalfExtents);
    check(start.insideBounds && start.solidIds.length === 0, 'player-start-clear', { levelId: level.id, ...start });
    check(finiteVector(level.camera.followOffsetLU) && Number.isFinite(level.camera.halfHeightLU) && level.camera.halfHeightLU > 0 && Number.isFinite(level.camera.elevationDegrees) && level.camera.fadeOpacity > 0 && level.camera.fadeOpacity < 1 && level.camera.restoreOnClear === true && ['center', 'top', 'left', 'right'].every(sample => level.camera.occlusionSamples.includes(sample)), 'camera-policy-finite-and-multiple-samples', { levelId: level.id });
    for (const corridor of level.corridors) {
      check(corridor.points.length >= 2 && corridor.points.every(finiteVector), 'finite-corridor-points', { levelId: level.id, corridorId: corridor.id });
      const measured = corridorReport(level, corridor, playerHalfExtents), turningWidthRatio = corridor.widthLU / (2 * playerHalfExtents[0]);
      check(equalNumber(corridor.widthLU, 18) && turningWidthRatio >= 1.5, 'corridor-18-lu-and-1-point-5-rotating-width', { levelId: level.id, corridorId: corridor.id, turningWidthRatio });
      check(measured.bodyClear && measured.envelopeClear && measured.clear, 'corridor-full-envelope-and-continuous-sweep-clear', { levelId: level.id, corridorId: corridor.id, measured });
      result.corridors.push({ ...measured, turningWidthRatio, minimumRequiredWidthLU: 1.5 * 2 * playerHalfExtents[0], measurement: 'continuous expanded-AABB slab casts for body and full 18 LU corridor envelope' });
      const envelopeHalf = [corridor.widthLU / 2, playerHalfExtents[1], corridor.widthLU / 2];
      const segments = corridor.points.slice(1).map((end, index) => {
        const start = corridor.points[index];
        const bodyHits = visualEnvelopes.flatMap(visual => {
          const hit = segmentAABB(start, end, visual.bounds, playerHalfExtents);
          return hit ? [{ visualId: visual.visualId, assetId: visual.assetId, ...hit }] : [];
        }).sort((a, b) => a.t - b.t);
        const envelopeHits = visualEnvelopes.flatMap(visual => {
          const hit = segmentAABB(start, end, visual.bounds, envelopeHalf);
          return hit ? [{ visualId: visual.visualId, assetId: visual.assetId, ...hit }] : [];
        }).sort((a, b) => a.t - b.t);
        return { index, start, end, bodyHits, envelopeHits };
      });
      const bodyClear = segments.every(segment => segment.bodyHits.length === 0), envelopeClear = segments.every(segment => segment.envelopeHits.length === 0);
      result.actualVisualEnvelopeChecks.corridors.push({ id: corridor.id, widthLU: corridor.widthLU, bodyHalfExtents: playerHalfExtents, envelopeHalfExtents: envelopeHalf, bodyClear, envelopeClear, segments });
      check(bodyClear, 'rotating-ship-sweep-clear-of-actual-visual-envelopes', { levelId: level.id, corridorId: corridor.id, segments: segments.filter(segment => segment.bodyHits.length) });
      check(envelopeClear, 'full-18-lu-corridor-clear-of-actual-visual-envelopes', { levelId: level.id, corridorId: corridor.id, segments: segments.filter(segment => segment.envelopeHits.length) });
    }
    for (const pocket of level.turningPockets) {
      check(finiteVector(pocket.center) && Number.isFinite(pocket.radiusLU) && pocket.radiusLU > 0, 'finite-turning-pocket', { levelId: level.id, pocketId: pocket.id });
      const placement = placementReport(level, pocket.center, [pocket.radiusLU, playerHalfExtents[1], pocket.radiusLU]), ratio = pocket.radiusLU / playerHalfExtents[0];
      check(ratio >= 1.5 && placement.insideBounds && placement.solidIds.length === 0, 'turning-pocket-envelope-clear-and-1-point-5-radius', { levelId: level.id, pocketId: pocket.id, ratio, ...placement });
      result.turningPockets.push({ id: pocket.id, radiusLU: pocket.radiusLU, rotatingRadiusRatio: ratio, ...placement });
    }
    const baseline = availableSpawns(level, playerHalfExtents);
    for (const anchor of level.spawnAnchors) {
      check(finiteVector(anchor.position) && Number.isFinite(anchor.headingRadians) && Array.isArray(anchor.tags) && anchor.tags.length > 0, 'finite-tagged-spawn', { levelId: level.id, spawnId: anchor.id });
      const available = baseline.find(item => item.id === anchor.id), occupied = availableSpawns(level, playerHalfExtents, [{ id: 'reserved-reference-ship', position: anchor.position, halfExtents: playerHalfExtents }]).find(item => item.id === anchor.id);
      const placement = placementReport(level, anchor.position, playerHalfExtents), body = boxAt(anchor.position, playerHalfExtents);
      const pairwiseOverlaps = level.spawnAnchors.filter(other => other.id !== anchor.id && intersectsAABB(body, boxAt(other.position, playerHalfExtents))).map(other => other.id);
      const nearestSolidGapLU = Math.min(...level.colliders.filter(item => item.kind === 'solid').map(item => boxGap(body, boxAt(item.center, item.halfExtents))));
      check(available?.available && placement.insideBounds && placement.solidIds.length === 0 && pairwiseOverlaps.length === 0, 'spawn-boundary-solid-and-other-anchor-clearance', { levelId: level.id, spawnId: anchor.id, ...placement, pairwiseOverlaps });
      check(occupied?.available === false && occupied.occupiedIds.includes('reserved-reference-ship'), 'spawn-rejects-reserved-full-ship-occupancy', { levelId: level.id, spawnId: anchor.id });
      result.spawns.push({ id: anchor.id, position: anchor.position, availableWhenEmpty: available.available, blockedByReservation: !occupied.available, ...placement, pairwiseOverlaps, nearestSolidGapLU: Number.isFinite(nearestSolidGapLU) ? nearestSolidGapLU : null });
    }
    for (const trigger of level.triggers) {
      const expectedOwner = trigger.type === 'departure-request' ? 'encounters' : 'harbor';
      check(finiteVector(trigger.center) && finiteVector(trigger.halfExtents) && trigger.halfExtents.every(n => n > 0) && trigger.requiresConfirmation === true && trigger.owner === expectedOwner, 'confirmed-trigger-with-explicit-owner', { levelId: level.id, triggerId: trigger.id, expectedOwner });
      const validTarget = trigger.type === 'return-request' ? pkg.levels.some(other => other.id === trigger.target) : trigger.type === 'departure-request' ? trigger.target === 'encounters:departure' : trigger.type === 'harbor-interaction' && ['harbor:repair', 'harbor:storage', 'harbor:settlement'].includes(trigger.target);
      check(validTarget, 'trigger-target-valid', { levelId: level.id, triggerId: trigger.id });
      check(level.spawnAnchors.some(anchor => intersectsAABB(boxAt(anchor.position, playerHalfExtents), boxAt(trigger.center, trigger.halfExtents))), 'trigger-reachable-from-declared-spawn', { levelId: level.id, triggerId: trigger.id });
      result.triggers.push({ id: trigger.id, type: trigger.type, owner: trigger.owner, target: trigger.target, requiresConfirmation: trigger.requiresConfirmation, effectsExecuted: false });
    }
    for (const anchor of level.legacyHostAnchors || []) {
      const placement = placementReport(level, anchor.position, playerHalfExtents), expected = equalVector(anchor.position, [-28, 0, -12]);
      if (expected) {
        check(placement.insideBounds && placement.solidIds.includes('terrain-solid-0'), 'expected-legacy-host-conservative-overlap-present', { levelId: level.id, anchorId: anchor.id, ...placement });
        report.advisories.push({ code: 'expected-legacy-host-anchor-overlap', levelId: level.id, anchorId: anchor.id, position: anchor.position, ...placement, expected: true, note: 'The (-28,-12) original host anchor overlaps the new conservative full-ship AABB. This advisory does not modify host radius, original physics or spawn order; encounters owns adoption of the alternative anchor.' });
      } else check(placement.insideBounds && placement.solidIds.length === 0, 'other-legacy-host-anchor-clear', { levelId: level.id, anchorId: anchor.id, ...placement });
    }
    if (level.fullSceneComparison) {
      const comparison = level.fullSceneComparison;
      check(selected.has(comparison.assetId) && comparison.excludeRootNameIncludes.includes('@selected-airship') && ['@suspension-beam', '@suspension-link'].every(value => comparison.cameraFadeRootNameIncludes.includes(value)), 'full-scene-excludes-duplicate-ship-and-identifies-suspension-occluders', { levelId: level.id });
      validateFrame(comparison.artFrame);
    }
    const ids = [...new Set(level.visuals.map(item => item.assetId))], sources = ids.map(id => selected.get(id));
    report.structuralEstimates.push({ levelId: level.id, status: 'catalog-estimate-not-runtime-measurement', visualInstances: level.visuals.length, uniqueAssetSources: ids.length, sourceBytesWithPlayer: sources.reduce((n, item) => n + item.bytes, pkg.player.bytes), meshInstancesWithPlayer: level.visuals.reduce((n, visual) => n + selected.get(visual.assetId).meshCount, pkg.player.meshCount), trianglesWithPlayer: level.visuals.reduce((n, visual) => n + selected.get(visual.assetId).triangles, pkg.player.triangles), textureSourceCountWithPlayer: sources.reduce((n, item) => n + item.textureCount, pkg.player.textureCount), exclusions: 'No helpers, outline pass, attachments, decoder overhead or GPU allocations included. Hidden visual roots do not reduce full-scene transfer size.' });
  });
  check(report.advisories.filter(item => item.code === 'expected-legacy-host-anchor-overlap').length === 1, 'one-explicit-expected-legacy-overlap-advisory');
  return finish();

  function finish() {
    report.passed = report.failures.length === 0;
    report.status = report.passed ? 'passed-spatial-data-invariants' : 'failed-spatial-data-invariants';
    return report;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = verifySpatialPackage();
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(path.join(ROOT, OUTPUT)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, OUTPUT), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ passed: report.passed, assertions: report.assertions, counts: report.counts, expectedAdvisories: report.advisories.length, failures: report.failures, output: process.argv.includes('--write') ? OUTPUT : null, runtimeMeasurements: report.runtimeMeasurements.status }));
  if (!report.passed) process.exitCode = 1;
}
