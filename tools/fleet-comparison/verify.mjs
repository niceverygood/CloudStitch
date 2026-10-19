import { readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = 'outputs/fleet-comparison-v1';
const FROZEN_V2_SHA256 = '916c3e9790818490ee6d4457b7e41d8fe23cc49130996f64512a3c2a2657f68e';
const ALTERNATIVES = ['design-a1', 'design-a2', 'design-a3', 'design-b1', 'design-b2', 'design-b3', 'design-c1', 'design-c2', 'design-c3'];
const SIDES = ['ally', 'enemy', 'neutral', 'reference'];
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const stable = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const same = (left, right) => stable(left) === stable(right);
const nonempty = value => typeof value === 'string' && Boolean(value.trim());
const asArray = value => Array.isArray(value) ? value : [];
const textOf = value => typeof value === 'string' ? value : stable(value) || '';
const slotAt = (stage, key) => stage?.[key] ?? stage?.[key.toLowerCase()];
const assetIdOf = slot => slot?.assetId ?? slot?.shipId ?? null;

function contained(root, relative) {
  if (!nonempty(relative) || path.isAbsolute(relative) || /^(?:[a-z]+:|[\\/])/i.test(relative) || relative.includes('\\')) throw new Error('Expected a repository-relative POSIX path');
  const absolute = path.resolve(root, relative), distance = path.relative(root, absolute);
  if (distance === '..' || distance.startsWith('..' + path.sep) || path.isAbsolute(distance)) throw new Error('Path escapes the expected directory');
  return absolute;
}

function parseEmbeddedData(html) {
  const match = /\bconst\s+embeddedData\s*=\s*\[/.exec(html);
  if (!match) throw new Error('Missing const embeddedData = [ ... ][0] contract');
  let index = match.index + match[0].length;
  while (/\s/.test(html[index] || '') && index < html.length) index++;
  if (html[index] !== '{') throw new Error('Comparison HTML does not embed a JSON object');
  const start = index; let depth = 0, quoted = false, escaped = false;
  for (; index < html.length; index++) {
    const char = html[index];
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue; }
    if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) { const end = index + 1; if (!/^\s*\]\[0\]\s*;/.test(html.slice(end))) throw new Error('Unexpected comparison JSON trailer'); return { data: JSON.parse(html.slice(start, end)), code: html.slice(0, start) + '{}' + html.slice(end) }; }
    }
  }
  throw new Error('Truncated embedded comparison JSON');
}

function inspectPng(bytes) {
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(PNG_MAGIC) || bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.readUInt32BE(8) !== 13) throw new Error('Invalid PNG signature/IHDR');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width > 16384 || height > 16384) throw new Error('Invalid or excessive PNG dimensions');
  let offset = 8, hasIDAT = false, chunks = 0, ended = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('Truncated PNG chunk');
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    if (offset + 12 + length > bytes.length) throw new Error('PNG chunk exceeds file');
    chunks++; if (type === 'IDAT') hasIDAT = true;
    offset += 12 + length;
    if (type === 'IEND') { if (length !== 0 || offset !== bytes.length) throw new Error('Invalid PNG IEND/trailing bytes'); ended = true; break; }
  }
  if (!ended || !hasIDAT) throw new Error('PNG lacks IDAT/IEND');
  return { bytes: bytes.length, width, height, chunks, sha256: sha256(bytes), scope: 'Header/chunk extent/hash only; not decoded pixels or visual approval' };
}

function referencePaths(value, found = new Set(), active = false) {
  if (typeof value === 'string') { if (active && /^(?:outputs|tools|docs)\/[A-Za-z0-9_./-]+(?:\.[A-Za-z0-9]+)$/.test(value)) found.add(value); return found; }
  if (Array.isArray(value)) { for (const item of value) referencePaths(item, found, active); return found; }
  if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) referencePaths(item, found, active || /^(?:sources|sourceRefs|sourceFiles|references|refs|path|file)$/.test(key));
  return found;
}

/** Inspect only the new comparison PNGs/data, source catalog declarations and one frozen manifest. */
export async function verifyComparison({ repoRoot = ROOT, writeReport = true } = {}) {
  const report = { version: 'fleet-comparison-structure-3', checkedAt: new Date().toISOString(), passed: false, scope: 'New 71-item comparison plus separate nine raw-design references; data/PNG/link/static policy and canonical-slot exposure source verification', checks: [], previews: [], archiveOriginals: [], stageBossSlots: [], canonicalSlots: [], canonicalPending: [], references: [], errors: [], warnings: [],
    modelFilesRehashed: 0, originalPreviewFilesRehashed: 0, frozenV2FilesHashed: ['outputs/fleet-v2/source-manifest.json'], browserVerified: false, decodedPngPixelsVerified: false, visualPreferencePassed: null, canonOrGameplayCompleted: false };
  const check = (name, passed, detail) => { report.checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) }); if (!passed) report.errors.push(name); };
  const json = async relative => JSON.parse(await readFile(contained(repoRoot, relative), 'utf8'));
  try {
    const [inventory, previews, source, v1, v2, encounters, originalModels, frozenManifest, html] = await Promise.all([
      json(OUTPUT + '/inventory.json'), json(OUTPUT + '/previews.json'), json('tools/fleet/catalog.json'), json('outputs/fleet-v1/catalog.json'), json('outputs/fleet-v2/catalog.json'), json('tools/encounters/catalog.json'),
      json('outputs/airship-models-9/model-manifest.json'),
      readFile(contained(repoRoot, 'outputs/fleet-v2/source-manifest.json')), readFile(contained(repoRoot, OUTPUT + '/index.html'), 'utf8'),
    ]);
    const expectedIds = asArray(source.ships).map(s => s.id).sort(), inventoryIds = asArray(inventory.ships).map(s => s.id).sort(), previewIds = asArray(previews.items).map(s => s.id).sort();
    check('Source catalog defines 71 unique source IDs', expectedIds.length === 71 && new Set(expectedIds).size === 71);
    check('Comparison contains exactly all 71 source IDs', same(expectedIds, inventoryIds) && new Set(inventoryIds).size === 71, { total: inventoryIds.length });
    check('Previews contain exactly those 71 IDs', same(expectedIds, previewIds) && new Set(previewIds).size === 71, { total: previewIds.length });
    const alternatives = asArray(source.ships).filter(s => s.category === 'preexisting-variant' || s.definitionLevel === 'design-alternative').map(s => s.id).sort();
    check('Exactly nine original design alternatives are retained', same(alternatives, [...ALTERNATIVES].sort()), alternatives);
    const retained = expectedIds.filter(id => !ALTERNATIVES.includes(id));
    check('V2 source IDs are exactly the other 62 entries', retained.length === 62 && same(asArray(v2.ships).map(s => s.id).sort(), retained));
    check('Inventory totals explicitly distinguish 62 current + 9 alternatives', inventory.counts?.total === 71 && inventory.counts.current === 62 && inventory.counts.alternatives === 9 && inventory.counts.previews === 71 && previews.actualCount === 71, inventory.counts);
    check('Version/source labels are present', nonempty(inventory.version) && inventory.version.startsWith('fleet-comparison-') && nonempty(previews.version));
    const frozenHash = sha256(frozenManifest);
    check('Frozen v2 source-manifest retains the agreed exact SHA256', frozenHash === FROZEN_V2_SHA256, { expected: FROZEN_V2_SHA256, observed: frozenHash });
    check('Inventory records that same frozen manifest SHA256', inventory.preservedFleetV2ManifestSha256 === FROZEN_V2_SHA256);
    const countNote = inventory.scopeNote || '';
    check('71 entries are explicitly distinguished from unique canonical hulls', /(?:71|항목|entries)/i.test(countNote) && /(?:고유|unique)/i.test(countNote) && /(?:아니|아닙|않|다르|not)/i.test(countNote));
    check('Main-list design alternatives are labelled v1 rig interpretations', /(?:v1|리그|리깅)/i.test(countNote) && /(?:리그|리깅|rig)/i.test(countNote));
    check('Prototype encounter assignments are distinguished from campaign bosses', /(?:훈련|시제품|prototype)/i.test(inventory.stageNote || '') && /(?:정사|캠페인|canon)/i.test(inventory.stageNote || ''));
    check('Gallery scope leaves combat/collision/socket implementation pending', Array.isArray(inventory.limits) && /(?:combat|전투|collision|충돌|socket|소켓)/i.test(textOf(inventory.limits)) && /(?:unchanged|no new|pending|별도|미구현|변경하지)/i.test(textOf(inventory.limits)));

    const v1ById = new Map(asArray(v1.ships).map(s => [s.id, s])), v2ById = new Map(asArray(v2.ships).map(s => [s.id, s])), previewById = new Map(asArray(previews.items).map(s => [s.id, s]));
    for (const ship of asArray(inventory.ships)) {
      const version = ALTERNATIVES.includes(ship.id) ? 'v1' : 'v2', origin = (version === 'v1' ? v1ById : v2ById).get(ship.id), evidence = previewById.get(ship.id), entry = { id: ship.id, sourceVersion: ship.sourceVersion, passed: false, errors: [] };
      report.previews.push(entry);
      try {
        if (!origin || !evidence) throw new Error('Missing source catalog or preview entry');
        if (ship.sourceVersion !== version || evidence.sourceVersion !== version) entry.errors.push('Wrong v1/v2 provenance');
        if (ship.category !== origin.category || ship.name !== origin.name) entry.errors.push('Source model ID/name/category was changed');
        if (!isHash(origin.sha256) || ship.modelSha256 !== origin.sha256 || evidence.modelSha256 !== origin.sha256) entry.errors.push('Model SHA declarations do not match source catalog');
        if (!isHash(ship.previewSha256) || evidence.previewSha256 !== ship.previewSha256) entry.errors.push('Inventory/previews PNG SHA declarations differ');
        const expectedPreview = `previews/${ship.id}.png`, expectedAsset = `../fleet-${version}/ships/${ship.id}.glb`, expectedViewer = `../fleet-${version}/ships/${ship.id}.html`;
        if (ship.previewPath !== expectedPreview || evidence.previewPath !== expectedPreview || ship.assetPath !== expectedAsset || ship.viewerPath !== expectedViewer) entry.errors.push('Unexpected preview/model/viewer path');
        if (version === 'v2' && ship.previousViewerPath !== `../fleet-v1/ships/${ship.id}.html` || version === 'v1' && ship.previousViewerPath != null) entry.errors.push('Unexpected previous-version viewer link');
        for (const [key, expectedPath] of [['assetPath', expectedAsset], ['viewerPath', expectedViewer]]) {
          const absolute = contained(repoRoot, path.posix.join(OUTPUT, expectedPath)), actual = await stat(absolute);
          if (!actual.isFile() || actual.size <= 0) entry.errors.push(`${key} is not a nonempty file`);
          if (key === 'assetPath' && (actual.size !== origin.bytes || ship.bytes !== origin.bytes)) entry.errors.push('Model byte length differs from source catalog');
        }
        if (version === 'v2') { const previous = await stat(contained(repoRoot, `outputs/fleet-v1/ships/${ship.id}.html`)); if (!previous.isFile()) entry.errors.push('Previous viewer is not a file'); }
        const bytes = await readFile(contained(repoRoot, OUTPUT + '/' + expectedPreview)); entry.png = inspectPng(bytes);
        if (entry.png.sha256 !== ship.previewSha256 || entry.png.sha256 !== evidence.previewSha256) entry.errors.push('Actual comparison PNG SHA differs from declarations');
        if (version === 'v1' && evidence.method !== 'preserved-v1-design-alternative-thumbnail') entry.errors.push('Design-interpretation thumbnail must be labelled preserved v1');
        if (version === 'v2' && !['copied-current-model-sha-matched-v2-thumbnail', 'actual-paused-v2-GLB-render'].includes(evidence.method)) entry.errors.push('Unrecognized current-model thumbnail evidence');
        entry.method = evidence.method;
        if (version === 'v1') entry.methodNote = 'Preserved fleet-v1 rig interpretation thumbnail; not the original high-density A1-C3 generated-model render';
        if (evidence.method === 'actual-paused-v2-GLB-render' && (evidence.state?.assetId !== ship.id || evidence.state?.ready !== true || evidence.state?.outlineAutoClear !== true)) entry.errors.push('Actual capture state is not ready/same-ID/outline-cleared');
        if (!SIDES.includes(ship.side) || !nonempty(ship.sideLabel) || !nonempty(ship.context) || !nonempty(ship.relationStatus)) entry.errors.push('Missing contextual affiliation/evidence status');
        if (version === 'v1' && ship.side !== 'reference') entry.errors.push('Original alternatives must be reference entries, not new canonical opponents');
        if (ship.side === 'enemy' && ['civilian-role', 'historical-record', 'unfinished-vessel', 'ending-variant'].includes(ship.category)) entry.errors.push('Civilian/record/build-state entry was automatically classified hostile');
        if (!Array.isArray(ship.sourceRefs) || !ship.sourceRefs.length) entry.errors.push('Missing affiliation source references');
        if (!nonempty(ship.scaleNote) || !/(?:미터|metre|meter|상대|화면)/i.test(ship.scaleNote)) entry.errors.push('Missing fitted-image/relative-scale qualification');
      } catch (error) { entry.errors.push(error.message); }
      entry.passed = entry.errors.length === 0;
      if (!entry.passed) report.errors.push(`${ship.id}: ${entry.errors.join('; ')}`);
    }
    const rawIds = ALTERNATIVES.map(id => id.slice(7).toUpperCase()).sort(), sourceRawIds = asArray(originalModels.models).map(model => model.id).sort(), archiveIds = asArray(inventory.archiveOriginals).map(model => model.id).sort();
    check('Raw source manifest defines the same original nine A1-C3 designs', same(rawIds, sourceRawIds) && originalModels.total_models === 9);
    check('Separate raw archive contains exactly those nine originals', same(rawIds, archiveIds) && new Set(archiveIds).size === 9 && inventory.counts?.originalHighDensity === 9);
    check('Raw archive and rig interpretations are explicitly distinguished without inventing new hulls', /(?:고밀도|high-density)/i.test(inventory.archiveNote || '') && /(?:리그|리깅|rig)/i.test(inventory.archiveNote || '') && /(?:새로운|새|new)/i.test(inventory.archiveNote || '') && /(?:않|아니|아닙|not)/i.test(inventory.archiveNote || ''));
    check('Original gallery link points to the preserved source gallery', inventory.originalGalleryPath === '../airship-models-9/index.html');
    const sourceGallery = await stat(contained(repoRoot, 'outputs/airship-models-9/index.html'));
    check('Original high-density gallery exists', sourceGallery.isFile() && sourceGallery.size > 0);
    const rawById = new Map(asArray(originalModels.models).map(model => [model.id, model]));
    for (const model of asArray(inventory.archiveOriginals)) {
      const entry = { id: model.id, passed: false, errors: [], originalModelRehashed: false }; report.archiveOriginals.push(entry);
      try {
        const original = rawById.get(model.id); if (!original) throw new Error('Unknown original design ID');
        const expectedAsset = '../airship-models-9/' + original.model, expectedPreview = 'originals/' + model.id + '.png';
        if (model.name !== original.name || model.previewPath !== expectedPreview || model.assetPath !== expectedAsset) entry.errors.push('Original name/preview/model path differs from source manifest');
        if (!isHash(original.sha256) || model.modelSha256 !== original.sha256 || model.bytes !== original.bytes) entry.errors.push('Raw model SHA/byte declarations differ from source manifest');
        const actualModel = await stat(contained(repoRoot, 'outputs/airship-models-9/' + original.model));
        if (!actualModel.isFile() || actualModel.size !== original.bytes) entry.errors.push('Raw GLB is missing or has the wrong byte length');
        const sourcePreview = await stat(contained(repoRoot, 'outputs/airship-models-9/' + original.preview));
        if (!sourcePreview.isFile() || sourcePreview.size <= 0) entry.errors.push('Original render image is missing');
        const bytes = await readFile(contained(repoRoot, OUTPUT + '/' + expectedPreview)); entry.png = inspectPng(bytes);
        if (!isHash(model.previewSha256) || entry.png.sha256 !== model.previewSha256) entry.errors.push('Actual copied raw-design PNG SHA differs from inventory');
        if (bytes.length !== sourcePreview.size) entry.errors.push('Copied raw-design PNG byte length differs from source render');
        if (model.source !== 'outputs/airship-models-9/model-manifest.json' || !nonempty(model.note)) entry.errors.push('Missing raw-model provenance/review note');
      } catch (error) { entry.errors.push(error.message); }
      entry.passed = entry.errors.length === 0; if (!entry.passed) report.errors.push(`raw-original/${model.id}: ${entry.errors.join('; ')}`);
    }
    const bySide = Object.fromEntries(SIDES.map(side => [side, asArray(inventory.ships).filter(s => s.side === side).length]));
    check('Affiliation summary matches every contextual row', same(inventory.counts?.bySide, bySide), bySide);
    const stageIds = asArray(inventory.stages).map(stage => stage.id);
    check('Exactly the six preserved encounter stages appear in their source order', same(stageIds, asArray(encounters.stages).map(stage => stage.id)) && stageIds.length === 6);
    for (const stage of asArray(inventory.stages)) {
      const original = asArray(encounters.stages).find(s => s.id === stage.id);
      for (const key of ['midBoss', 'finalBoss']) {
        const slot = slotAt(stage, key), id = assetIdOf(slot), sourceSlot = slotAt(original, key), row = { stageId: stage.id, slot: key, assetId: id, passed: true, errors: [] };
        if (!id || !inventoryIds.includes(id) || id !== sourceSlot?.assetId) row.errors.push('Asset ID does not match the preserved prototype assignment');
        if (slot?.confirmed === true || slot?.canonEncounterCompleted === true || slot?.canonicalCompleted === true) row.errors.push('Training assignment incorrectly claims canonical completion');
        const assignmentText = textOf({ status: slot?.status, sourceKind: slot?.sourceKind, assignmentType: slot?.assignmentType, note: slot?.note, scopeNote: slot?.scopeNote });
        if (!/(?:prototype|training|훈련|시제품)/i.test(assignmentText)) row.errors.push('Prototype/training assignment label is missing');
        if (!slot?.sourceRefs?.length && !stage.sourceRefs?.length) row.errors.push('Boss assignment source references are missing');
        row.passed = row.errors.length === 0; report.stageBossSlots.push(row); if (!row.passed) report.errors.push(`${stage.id}/${key}: ${row.errors.join('; ')}`);
      }
    }
    check('All twelve stage boss slots are explicit prototype references', report.stageBossSlots.length === 12 && report.stageBossSlots.every(slot => slot.passed));
    check('Canonical campaign mapping is represented separately', Array.isArray(inventory.canonStages) && inventory.canonStages.length > 0 && Array.isArray(inventory.stages));
    const roster = await import(pathToFileURL(contained(repoRoot, 'tools/fleet-comparison/roster.mjs')).href);
    const sourceCanonical = asArray(roster.CANON_STAGES), canonicalIds = asArray(inventory.canonStages).map(stage => stage.id);
    check('Canonical reference rows contain the same six stage IDs in source order', canonicalIds.length === 6 && same(canonicalIds, sourceCanonical.map(stage => stage.id)) && same(canonicalIds, stageIds));
    const primaryFields = slot => ({ assetId: assetIdOf(slot), name: slot?.name, status: slot?.status, note: slot?.note, sourceRefs: slot?.sourceRefs });
    for (const stage of asArray(inventory.canonStages)) {
      const original = sourceCanonical.find(item => item.id === stage.id);
      for (const key of ['midBoss', 'finalBoss']) {
        const slot = slotAt(stage, key), sourceSlot = slotAt(original, key), id = assetIdOf(slot), entry = { stageId: stage.id, slot: key, assetId: id, expectedUiStatus: !id || slot?.status === 'unspecified' ? 'unspecified' : 'assigned', passed: false, errors: [] };
        if (!Object.hasOwn(stage, key) || !slot || typeof slot !== 'object' || !Object.hasOwn(slot, 'assetId')) entry.errors.push('Canonical mid/final slot must be explicit, including null assetId for unassigned slots');
        if (!original || !sourceSlot || !same(primaryFields(slot), primaryFields(sourceSlot))) entry.errors.push('Canonical slot differs from the read-only roster source mapping');
        if (id && !inventoryIds.includes(id)) entry.errors.push('Assigned canonical slot points to a missing catalog ID');
        if (!id && (slot?.status !== 'unspecified' || !nonempty(slot?.note))) entry.errors.push('Unassigned canonical slot must retain unspecified status and its explanation');
        if (slot?.canonEncounterCompleted === true || slot?.gameplayImplemented === true) entry.errors.push('Canonical reference incorrectly claims completed gameplay');
        entry.passed = entry.errors.length === 0; report.canonicalSlots.push(entry);
        if (!entry.passed) report.errors.push(`${stage.id}/canonical-${key}: ${entry.errors.join('; ')}`);
      }
    }
    check('Canonical data retains all six midBoss and six finalBoss reference slots', report.canonicalSlots.length === 12 && report.canonicalSlots.filter(slot => slot.slot === 'midBoss').length === 6 && report.canonicalSlots.filter(slot => slot.slot === 'finalBoss').length === 6 && report.canonicalSlots.every(slot => slot.passed));
    function inspectCanonical(value, location) {
      if (Array.isArray(value)) { value.forEach((item, index) => inspectCanonical(item, `${location}[${index}]`)); return; }
      if (!value || typeof value !== 'object') return;
      if (Object.hasOwn(value, 'assetId') || Object.hasOwn(value, 'shipId')) {
        const id = assetIdOf(value), status = textOf(value.status ?? value.assignmentStatus ?? value.definitionStatus), pending = !id || /(?:pending|unspecified|unconfirmed|unknown|미정|미확정|확인.?중)/i.test(status);
        if (id && !inventoryIds.includes(id)) report.errors.push(`${location}: canonical reference points to unknown ID ${id}`);
        if (!id && !/(?:pending|unspecified|unconfirmed|unknown|미정|미확정|확인.?중)/i.test(textOf(value))) report.errors.push(`${location}: empty canonical slot is not explicitly pending`);
        if (value.canonEncounterCompleted === true || value.gameplayImplemented === true) report.errors.push(`${location}: canonical mapping incorrectly claims game completion`);
        if (pending) report.canonicalPending.push({ location, assetId: id, status: value.status ?? null, note: value.note ?? value.scopeNote ?? null });
      }
      for (const [key, child] of Object.entries(value)) if (child && typeof child === 'object') inspectCanonical(child, location + '.' + key);
    }
    inspectCanonical(inventory.canonStages, 'canonStages');
    const refs = [...referencePaths({ ships: inventory.ships, stages: inventory.stages, canonStages: inventory.canonStages, sources: [...asArray(inventory.sources), 'outputs/airship-models-9/model-manifest.json'] })].sort();
    check('Inventory contains concrete local source reference paths', refs.length > 0);
    for (const relative of refs) { let passed = false; try { passed = (await stat(contained(repoRoot, relative))).isFile(); } catch {} report.references.push({ path: relative, passed }); if (!passed) report.errors.push('Missing source reference: ' + relative); }

    const embedded = parseEmbeddedData(html), code = embedded.code;
    check('Rendered HTML embeds exactly the checked inventory', same(embedded.data, inventory));
    check('Comparison uses the two named image panes', (code.match(/\bid=["']picture-(?:left|right)["']/g) || []).length === 2 && /image\(\$\('picture-'\s*\+\s*pane\),\s*ship/.test(code));
    check('Image helper creates lazy local img elements', /element\(['"]img['"]\)/.test(code) && /picture\.src\s*=\s*preview/.test(code) && /picture\.loading\s*=\s*['"]lazy['"]/.test(code));
    check('No eager iframe or WebGL renderer is embedded in the comparison shell', !/<iframe\b/i.test(code) && !/new\s+(?:THREE\.)?(?:WebGLRenderer|WebGPURenderer)\s*\(/.test(code));
    check('Only one dynamic iframe creation site is present', (code.match(/(?:element|createElement)\(['"]iframe['"]\)/g) || []).length === 1);
    const opening = /function\s+open3D\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/.exec(code)?.[1] || '';
    check('Opening 3D clears the previous host before creating its sole iframe', opening.indexOf('host.replaceChildren()') >= 0 && opening.indexOf('host.replaceChildren()') < opening.search(/(?:element|createElement)\(['"]iframe['"]\)/) && /frame\.src\s*=\s*viewerPath/.test(opening));
    check('Closing 3D removes its iframe', /function\s+close3D\([^)]*\)\s*\{[^}]*\$\(['"]viewer-host['"]\)\.replaceChildren\(\)/.test(code) && /addEventListener\(['"]close['"],[^;]*replaceChildren\(\)/.test(code));
    check('Canonical and prototype sections both consume their separate data', /data\.canonStages/.test(code) && /data\.stages/.test(code));
    const canonStart = code.indexOf('const canonicalStages'), canonEnd = code.indexOf("$('canon-list').replaceChildren", canonStart), canonicalSource = canonStart >= 0 && canonEnd > canonStart ? code.slice(canonStart, canonEnd) : '';
    const canonicalSourceChecks = {
      everyStage: /canonicalStages\.flatMap\(stage\s*=>\s*\{/.test(canonicalSource),
      bothPrimarySlots: /const\s+primary\s*=\s*\[\s*\[\s*['"]midBoss['"][^\]]*\]\s*,\s*\[\s*['"]finalBoss['"][^\]]*\]\s*\]\.map\(\(\[\s*slot\s*,\s*slotLabel\s*\]/.test(canonicalSource),
      mapsSourceSlot: /\.\.\.\(stage\[slot\]\s*\|\|/.test(canonicalSource) && /stageId:\s*stage\.id/.test(canonicalSource) && /regionName:\s*stage\.name,\s*slot,\s*slotLabel/.test(canonicalSource),
      retainsPrimaryAndComponents: /return\s*\[\s*\.\.\.primary\s*,\s*\.\.\.components\s*\]/.test(canonicalSource) && /slot:\s*['"]component['"]/.test(canonicalSource),
      stageMarker: /\.dataset\.canonStageId\s*=\s*boss\.stageId/.test(canonicalSource),
      slotMarker: /\.dataset\.canonSlot\s*=\s*boss\.slot/.test(canonicalSource),
      statusMarker: /\.dataset\.canonStatus\s*=\s*status/.test(canonicalSource),
      nullStatusVisible: /const\s+status\s*=\s*!slotAssetId\(boss\)\s*\|\|\s*boss\.status\s*===\s*['"]unspecified['"]\s*\?\s*['"]unspecified['"]\s*:\s*['"]assigned['"]/.test(canonicalSource),
      primaryLabelsVisible: /button\.append\(element\(['"]strong['"][\s\S]*boss\.slotLabel/.test(canonicalSource) && /status\s*===\s*['"]unspecified['"]\s*\?\s*['"]미확정['"]/.test(canonicalSource),
      appendsEveryMappedRow: /for\s*\(const\s+boss\s+of\s+canonical\)/.test(canonicalSource) && /list\.append\(button\)/.test(canonicalSource),
    };
    check('Canonical source loops over both primary slots rather than flattening only assigned bosses', canonicalSourceChecks.everyStage && canonicalSourceChecks.bothPrimarySlots && canonicalSourceChecks.mapsSourceSlot && canonicalSourceChecks.retainsPrimaryAndComponents, canonicalSourceChecks);
    check('Canonical source exposes stage/slot/status markers for each rendered row', canonicalSourceChecks.stageMarker && canonicalSourceChecks.slotMarker && canonicalSourceChecks.statusMarker && canonicalSourceChecks.appendsEveryMappedRow);
    check('Canonical source visibly labels unspecified mid/final slots', canonicalSourceChecks.nullStatusVisible && canonicalSourceChecks.primaryLabelsVisible);
    report.canonicalUiContract = { evidence: 'Static HTML JavaScript source only; no DOM/browser observation', browserConfirmed: false, expectedPrimarySlotsFromData: report.canonicalSlots.length, expectedUnspecifiedPrimarySlotsFromData: report.canonicalSlots.filter(slot => slot.expectedUiStatus === 'unspecified').length,
      markerNames: ['data-canon-stage-id', 'data-canon-slot', 'data-canon-status'], allowedSlotMarkers: ['midBoss', 'finalBoss', 'component'], allowedStatusMarkers: ['unspecified', 'assigned'], sourceChecks: canonicalSourceChecks };
    check('Raw original references have their own gallery section', /data\.archiveOriginals/.test(code) && /data\.originalGalleryPath/.test(code) && /airship-models-9/.test(code));
    check('Preview loading does not eagerly invoke the 3D opener', !/^\s*open3D\s*\(/m.test(code));
    check('Comparison shell has no external resource script/style URL', !/<(?:script|link|iframe|img)\b[^>]*(?:src|href)=["'](?:https?:)?\/\//i.test(code));
    report.summary = { totalEntries: inventoryIds.length, currentV2: asArray(inventory.ships).filter(s => s.sourceVersion === 'v2').length, archivedAlternativesV1: asArray(inventory.ships).filter(s => s.sourceVersion === 'v1').length, actualPngsInspected: report.previews.length, pngsPassed: report.previews.filter(item => item.passed).length,
      captureMethods: Object.fromEntries([...new Set(report.previews.map(item => item.method).filter(Boolean))].map(method => [method, report.previews.filter(item => item.method === method).length])), separateRawOriginalReferences: report.archiveOriginals.length, rawOriginalPngsPassed: report.archiveOriginals.filter(item => item.passed).length, totalNewComparisonPngsInspected: report.previews.length + report.archiveOriginals.length, stages: stageIds.length, prototypeBossSlots: report.stageBossSlots.length, canonicalGroups: asArray(inventory.canonStages).length, canonicalPrimarySlotsInData: report.canonicalSlots.length, explicitCanonicalPendingSlots: report.canonicalPending.length, canonicalSourceExposureContractPassed: Object.values(canonicalSourceChecks).every(Boolean), canonicalBrowserExposureVerified: false, localReferences: refs.length, frozenV2ManifestSha256: frozenHash, bySide };
    report.warnings.push('71 counts catalog entries including configurations, variants, roles, facilities, records and nine preserved design alternatives; it does not count unique canonical hulls.');
    report.warnings.push('Model SHAs are source catalog declarations plus file existence/length checks. Original model/PNG corpus files were not rehashed; the frozen manifest alone is rehashed.');
    report.warnings.push('The nine fleet-v1 design-* entries are rigged interpretations. Separate high-density A1-C3 raw originals are references to those same designs, not nine additional canonical hulls. Their GLBs were not read or rehashed.');
    report.warnings.push('Two-image/one-iframe policy is static source evidence. Live rendering, interactions, GLB loading, iframe teardown, mobile layout, decoded pixels and visual preference require separate browser review.');
    report.warnings.push('Canonical stage/slot/status markers and the two-primary-slot render loop are checked in source. Expected slot counts come from data and do not claim the browser actually displayed those rows; DOM assertions remain separate.');
  } catch (error) { report.errors.push(error.message); }
  report.passed = report.errors.length === 0;
  if (writeReport) await writeFile(contained(repoRoot, OUTPUT + '/verification-structure.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

async function main() {
  if (process.argv.slice(2).some(arg => !['--help', '-h'].includes(arg))) throw new Error('Only --help is supported; this comparison check always inspects 71 main-list PNGs and nine copied raw-reference PNGs');
  if (process.argv.length > 2) { console.log('node tools/fleet-comparison/verify.mjs\nChecks comparison inventory/71 main + 9 raw-reference PNG hashes/source links/6 prototype stages/static two-image-one-iframe policy and the one frozen v2 manifest. No browser or original model rehash.\nWrites outputs/fleet-comparison-v1/verification-structure.json'); return; }
  const report = await verifyComparison(); console.log(JSON.stringify({ passed: report.passed, summary: report.summary, errors: report.errors, report: OUTPUT + '/verification-structure.json' })); if (!report.passed) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
