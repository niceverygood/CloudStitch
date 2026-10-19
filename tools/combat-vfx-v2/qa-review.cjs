/* Residual VFX art-review capture harness; no browser without explicit --run.
 * node tools/combat-vfx-v2/qa-review.cjs
 * node tools/combat-vfx-v2/qa-review.cjs --run --batch=weapon-a [--write]
 * node tools/combat-vfx-v2/qa-review.cjs --run --id=cannon-muzzle [--write]
 * Representative controls are excluded unless --include-controls is explicit.
 * --write stores evidence in outputs/; otherwise --run writes only work/.
 * Captures and technical checks never set an effect's art-review approval.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '../..');
const QUEUE = 'outputs/combat-vfx-v2/review-render-queue.json';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(ROOT, file).split(path.sep).join('/');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const short = value => String(value).slice(0, 2000);
const safeName = value => String(value).replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 120);

function options(argv) {
  const result = { run: false, write: false, controls: false, batch: null, id: null, help: false };
  for (const arg of argv) {
    if (arg === '--run') result.run = true;
    else if (arg === '--write') result.write = true;
    else if (arg === '--include-controls') result.controls = true;
    else if (arg === '--help' || arg === '-h') result.help = true;
    else if (arg.startsWith('--batch=')) result.batch = arg.slice(8);
    else if (arg.startsWith('--id=')) result.id = arg.slice(5);
    else throw new Error('Unknown argument: ' + arg);
  }
  return result;
}
function repoFile(value) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value)) throw new Error('Expected a repository-relative file path.');
  const resolved = path.resolve(ROOT, value), rel = path.relative(ROOT, resolved);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw new Error('Path escapes repository: ' + value);
  if (!fs.statSync(resolved).isFile()) throw new Error('Not a file: ' + value);
  return resolved;
}
function selectQueue(queue, opt) {
  if (!Array.isArray(queue.items) || !Array.isArray(queue.batches)) throw new Error('Queue requires items and batches arrays.');
  const seen = new Set();
  for (const item of queue.items) {
    if (!item.id || seen.has(item.id) || !['effect', 'sequence'].includes(item.kind) || typeof item.page !== 'string') throw new Error('Invalid or duplicate review item: ' + item.id);
    seen.add(item.id);
  }
  const requestedBatch = opt.batch && queue.batches.find(batch => batch.id === opt.batch);
  if (opt.batch && !requestedBatch) throw new Error('Unknown batch: ' + opt.batch);
  if (opt.id && !queue.items.some(item => item.id === opt.id)) throw new Error('Unknown effect/sequence ID: ' + opt.id);
  const selected = queue.items.filter(item =>
    (opt.controls || !item.is_representative_control) &&
    (!opt.id || item.id === opt.id) &&
    (!requestedBatch || item.page === requestedBatch.page));
  if (!selected.length) throw new Error('No selected items. Representative controls require --include-controls.');
  return selected;
}
function queuedPageHash(queue, item) {
  const batch = queue.batches.find(value => value.page === item.page);
  const value = item.page_sha256 || batch?.page_sha256 || batch?.sha256;
  if (!/^[0-9a-f]{64}$/i.test(value || '')) throw new Error('Missing built-page SHA256 for ' + item.page + '. Rebuild/finalize the queue before --run.');
  return value.toLowerCase();
}
function modelEvidence(descriptor) {
  if (!descriptor || !Number.isSafeInteger(descriptor.bytes) || descriptor.bytes <= 0 || !/^[0-9a-f]{64}$/i.test(descriptor.sha256 || '')) throw new Error('Model descriptor requires path, bytes and SHA256.');
  const filename = repoFile(descriptor.path), bytes = fs.readFileSync(filename), sha256 = hash(bytes);
  if (bytes.length !== descriptor.bytes || sha256 !== descriptor.sha256.toLowerCase()) throw new Error('Queued model is stale: ' + descriptor.path);
  if (bytes.length < 28 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid GLB2 header: ' + descriptor.path);
  let cursor = 12, json, bin;
  while (cursor < bytes.length) {
    if (cursor + 8 > bytes.length) throw new Error('Incomplete GLB chunk header.');
    const length = bytes.readUInt32LE(cursor), type = bytes.readUInt32LE(cursor + 4); cursor += 8;
    if (cursor + length > bytes.length) throw new Error('Incomplete GLB chunk.');
    if (type === 0x4e4f534a) json = JSON.parse(bytes.subarray(cursor, cursor + length).toString('utf8'));
    if (type === 0x004e4942) bin = bytes.subarray(cursor, cursor + length);
    cursor += length;
  }
  if (!json || !bin || !json.animations?.length) throw new Error('Expected embedded animated GLB: ' + descriptor.path);
  if ([...(json.images || []), ...(json.buffers || [])].some(value => value.uri)) throw new Error('External GLB resource: ' + descriptor.path);
  const durations = json.animations.map(animation => {
    let duration = 0;
    if (!animation.channels?.length) throw new Error('GLB clip has no channels.');
    for (const sampler of animation.samplers) {
      const accessor = json.accessors[sampler.input], view = json.bufferViews[accessor.bufferView];
      if (accessor.type !== 'SCALAR' || accessor.componentType !== 5126 || accessor.sparse) throw new Error('Expected ordinary float clip times.');
      const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0), stride = view.byteStride || 4;
      for (let i = 0; i < accessor.count; i++) { const time = bin.readFloatLE(offset + stride * i); if (!Number.isFinite(time) || time < 0) throw new Error('Invalid animation time.'); duration = Math.max(duration, time); }
    }
    if (!(duration > 0)) throw new Error('GLB clip duration must be positive.');
    return duration;
  });
  return { path: descriptor.path, bytes: bytes.length, sha256, clip_names: json.animations.map(value => value.name || null), clip_durations: durations, first_clip_duration: durations[0], embedded_resources: true };
}
function cameraSignature(camera) { return hash(JSON.stringify(camera)); }
async function sample(page, seconds) {
  const result = await page.evaluate(seconds => {
    const api = window.__vfxV2;
    api.setPlaying(false); api.setTime(Math.min(Math.max(seconds, 0), api.duration)); api.renderClean();
    const round = value => Math.round(value * 1e6) / 1e6;
    const roots = api.roots.map(root => {
      root.updateMatrixWorld(true);
      const state = [], lower = [Infinity, Infinity, Infinity], upper = [-Infinity, -Infinity, -Infinity];
      let finite = true, meshes = 0, positiveOpacityMeshes = 0, opacityMin = Infinity, opacityMax = -Infinity;
      root.traverse(node => {
        const trs = [...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()];
        if (!trs.every(Number.isFinite)) finite = false;
        state.push([node.name, ...trs.map(round)]);
        if (!node.isMesh) return;
        meshes++;
        if (!node.matrixWorld.elements.every(Number.isFinite)) finite = false;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        const opacity = materials.map(material => material.opacity);
        if (!opacity.every(Number.isFinite)) finite = false;
        for (const value of opacity) { opacityMin = Math.min(opacityMin, value); opacityMax = Math.max(opacityMax, value); }
        if (opacity.some(value => value > .01)) positiveOpacityMeshes++;
        state.push([...node.matrixWorld.elements.map(round), ...opacity.map(round)]);
        node.geometry.computeBoundingBox();
        const bounds = node.geometry.boundingBox?.clone().applyMatrix4(node.matrixWorld);
        if (!bounds || bounds.isEmpty()) { finite = false; return; }
        const lo = bounds.min.toArray(), hi = bounds.max.toArray();
        if (![...lo, ...hi].every(Number.isFinite)) finite = false;
        for (let i = 0; i < 3; i++) { lower[i] = Math.min(lower[i], lo[i]); upper[i] = Math.max(upper[i], hi[i]); }
      });
      return { finite: finite && meshes > 0 && [...lower, ...upper].every(Number.isFinite), meshes, positiveOpacityMeshes, opacity_range: [opacityMin, opacityMax], bounds: { min: lower, max: upper }, trs_opacity_state: JSON.stringify(state) };
    });
    const camera = { position: api.camera.position.toArray(), quaternion: api.camera.quaternion.toArray(), projection: api.camera.projectionMatrix.elements.slice(), target: api.controls.target.toArray() };
    return { requested_seconds: seconds, seconds: api.currentTime, duration: api.duration, ready: api.ready, paused: !api.stats.playing, outline_auto_clear: api.effect.autoClear === true, camera, roots };
  }, seconds);
  result.camera_sha256 = cameraSignature(result.camera);
  result.roots = result.roots.map(({ trs_opacity_state, ...root }) => ({ ...root, trs_opacity_sha256: hash(trs_opacity_state) }));
  if (!result.ready || !result.paused || !result.outline_auto_clear || result.roots.length !== 2 || result.roots.some(root => !root.finite)) throw new Error('Invalid actual transform/bounds/opacity sample.');
  return result;
}
function sampleTimes(values, duration) {
  const source = Array.isArray(values) && values.length ? values : [0, duration * .2, duration * .5, duration * .8, duration];
  if (source.some(value => !Number.isFinite(value))) throw new Error('Sample times must be finite seconds.');
  return [...new Set(source.map(value => Math.round(Math.min(Math.max(value, 0), duration) * 1e6) / 1e6))].sort((a, b) => a - b);
}
function shotTimes(times, duration) {
  const interior = times.filter(value => value > 0 && value < duration - 1e-6), candidates = interior.length ? interior : times;
  if (candidates.length <= 3) return candidates;
  return [...new Set([candidates[0], candidates[Math.floor(candidates.length / 2)], candidates[candidates.length - 1]])];
}
function cleanURL(value) {
  try { const url = new URL(value); return url.protocol === 'file:' ? relative(require('node:url').fileURLToPath(url)) : url.origin + url.pathname; }
  catch { return short(value); }
}
async function capture(page, filename) {
  await page.locator('#stage').screenshot({ path: filename });
  const bytes = fs.readFileSync(filename);
  return { path: relative(filename), bytes: bytes.length, sha256: hash(bytes) };
}

async function main() {
  const opt = options(process.argv.slice(2));
  if (opt.help) { console.log('Queue summary only by default. Use --run [--batch=id | --id=id] [--include-controls] [--write] only in the integration browser slot. No installs; --write chooses outputs evidence, otherwise work. Captures never approve art.'); return; }
  if (!fs.existsSync(path.join(ROOT, QUEUE))) {
    if (opt.run) throw new Error('Review queue is not ready: ' + QUEUE);
    console.log(JSON.stringify({ status: 'queue_not_ready', queue: QUEUE, browser_started: false, writes: false })); return;
  }
  const queueFile = repoFile(QUEUE), queueBytes = fs.readFileSync(queueFile), queue = read(queueFile), selected = selectQueue(queue, opt);
  const groups = [...new Set(selected.map(item => item.page))].map(page => ({ page, batch_id: queue.batches.find(batch => batch.page === page)?.id || null, items: selected.filter(item => item.page === page) }));
  if (!opt.run) {
    console.log(JSON.stringify({ status: 'queue_summary_only', queue: QUEUE, queue_sha256: hash(queueBytes), browser_started: false, writes: false, controls_included: opt.controls, selected_items: selected.length, selected_effects: selected.filter(item => item.kind === 'effect').length, selected_sequences: selected.filter(item => item.kind === 'sequence').length, batches: groups.map(group => ({ id: group.batch_id, page: group.page, ids: group.items.map(item => item.id), page_sha256: queue.batches.find(batch => batch.page === group.page)?.page_sha256 || null })), art_review_status: 'pending_fresh_render_and_direct_review' }, null, 2)); return;
  }
  const runID = new Date().toISOString().replace(/[:.]/g, '-'), label = safeName(opt.id || opt.batch || 'remaining48');
  const directory = path.join(ROOT, opt.write ? 'outputs/combat-vfx-v2/verification/residual' : 'work/combat-vfx-v2/verification/residual', runID + '-' + label);
  const reportFile = path.join(directory, 'report.json'); fs.mkdirSync(directory, { recursive: true });
  const report = { schema_version: 1, game_title: 'Cloudstitch', status: 'preflight', started_at_utc: new Date().toISOString(), queue: QUEUE, queue_sha256: hash(queueBytes), source: { path: relative(__filename), bytes: fs.statSync(__filename).size, sha256: hash(fs.readFileSync(__filename)) }, controls_included: opt.controls, selected_count: selected.length, pages: [], items: [], errors: [], console_errors: [], external_requests: [], failed_requests: [], technical_passed: false, art_approved: false, art_review_status: 'pending_direct_capture_review', pending: ['Direct human/model review of captured silhouettes, pacing, occlusion and expected observations.', 'Full three-mode ghosting/mobile/download QA remains integration-owned and is not performed by this narrow capture harness.', 'Actual gameplay binding, collision authority, state lifetime and pool reset validation remain integration-owned.'] };
  let browser, page, context = { batch: null, id: null };
  const saveReport = () => fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  try {
    // Hash every chosen file before loading the optional browser dependency.
    const evidence = new Map();
    for (const group of groups) {
      const filename = repoFile(group.page), bytes = fs.readFileSync(filename), actual = hash(bytes), expected = queuedPageHash(queue, group.items[0]);
      if (actual !== expected) throw new Error('Queued comparison page is stale: ' + group.page);
      report.pages.push({ batch_id: group.batch_id, page: group.page, bytes: bytes.length, sha256: actual, queued_sha256: expected, matches_queue: true });
      for (const item of group.items) {
        if (queuedPageHash(queue, item) !== actual) throw new Error('Conflicting item/page hash: ' + item.id);
        evidence.set(item.id, { v1: modelEvidence(item.v1), v2: modelEvidence(item.v2) });
      }
    }
    const { launchBrowser } = require('../lib/runtime.cjs');
    browser = await launchBrowser({ args: ['--enable-unsafe-swiftshader'] });
    page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    page.on('pageerror', error => report.errors.push({ ...context, message: short(error.message) }));
    page.on('console', message => { if (message.type() === 'error') report.console_errors.push({ ...context, message: short(message.text()) }); });
    page.on('request', request => { if (/^https?:/i.test(request.url())) report.external_requests.push({ ...context, url: cleanURL(request.url()) }); });
    page.on('requestfailed', request => report.failed_requests.push({ ...context, url: cleanURL(request.url()), error: short(request.failure()?.errorText || 'Request failed') }));
    report.status = 'capturing_technical_evidence';
    for (const group of groups) {
      context = { batch: group.batch_id, id: null };
      if (hash(fs.readFileSync(repoFile(group.page))) !== report.pages.find(value => value.page === group.page).sha256) throw new Error('Comparison page changed after preflight: ' + group.page);
      await page.goto(pathToFileURL(repoFile(group.page)).href, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__vfxV2Ready || window.__vfxV2Stats?.error, null, { timeout: 120000 });
      const ready = await page.evaluate(() => ({ ready: window.__vfxV2Ready, error: window.__vfxV2Stats?.error, ids: window.__vfxV2?.availableItems.map(item => item.id) || [] }));
      if (!ready.ready) throw new Error(ready.error || 'Comparison page did not initialize.');
      for (const item of group.items) {
        context = { batch: group.batch_id, id: item.id };
        const model = { id: item.id, kind: item.kind, page: item.page, page_sha256: report.pages.find(value => value.page === item.page).sha256, is_representative_control: Boolean(item.is_representative_control), expected_observations: item.expected_observations || [], queued_sample_times_seconds: item.sample_times_seconds || [], source_models: evidence.get(item.id), status: 'loading', technical_passed: false, art_approved: false, samples: [], screenshots: [] };
        report.items.push(model);
        try {
          if (!ready.ids.includes(item.id)) throw new Error('Queued ID is absent from built page.');
          await page.evaluate(async id => { const api = window.__vfxV2; if (!await api.selectEffect(id)) throw new Error('Effect selection failed.'); api.setPlaying(false); api.setLoop(false); api.setAutoRotate(false); api.controls.enableDamping = false; api.setMode('handdrawn'); api.setBackground(false); api.reset(); api.renderClean(); }, item.id);
          model.actual = await page.evaluate(async () => {
            const api = window.__vfxV2;
            return { ready: api.ready, duration: api.duration, outline_auto_clear: api.effect.autoClear === true, stats: window.__vfxV2Stats.lanes, anchors: api.stats.anchors, models: await Promise.all(api.models.map(async (value, index) => ({ lane: index ? 'v2' : 'v1', bytes: value.bytes.byteLength, sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', value.bytes))].map(byte => byte.toString(16).padStart(2, '0')).join(''), clip_duration: value.duration }))) };
          });
          if (!model.actual.ready || !model.actual.outline_auto_clear || !(model.actual.duration > 0) || model.actual.stats?.length !== 2 || model.actual.models.length !== 2) throw new Error('Viewer/model readiness failed.');
          if (Math.abs(model.actual.duration - Math.max(model.source_models.v1.first_clip_duration, model.source_models.v2.first_clip_duration)) > 1e-5) throw new Error('Comparison duration differs from queued clip durations.');
          for (const actual of model.actual.models) {
            const expected = model.source_models[actual.lane], stats = model.actual.stats[actual.lane === 'v1' ? 0 : 1];
            if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256 || stats.sourceBytes !== expected.bytes || stats.sha256 !== expected.sha256 || !stats.texturesReady || !stats.clipCount || !stats.trackCount || !(stats.duration > 0) || Math.abs(actual.clip_duration - expected.first_clip_duration) > 1e-5 || Math.abs(stats.duration - expected.first_clip_duration) > 1e-5) throw new Error('Actual embedded GLB/texture/clip differs from queued source: ' + actual.lane);
          }
          const times = sampleTimes(item.sample_times_seconds, model.actual.duration);
          for (const seconds of times) model.samples.push(await sample(page, seconds));
          if (new Set(model.samples.map(value => value.camera_sha256)).size !== 1) throw new Error('Full-game camera changed between sampled times.');
          model.v2_unique_trs_opacity_signatures = new Set(model.samples.map(value => value.roots[1].trs_opacity_sha256)).size;
          model.motion_signature_changed = model.v2_unique_trs_opacity_signatures > 1;
          if (times.length > 1 && !model.motion_signature_changed) throw new Error('Suggested times produced no v2 TRS/opacity change; inspect queue times.');
          for (const seconds of shotTimes(times, model.actual.duration)) {
            const state = await sample(page, seconds), filename = path.join(directory, safeName(item.id) + '-t' + seconds.toFixed(4).replace('.', '_') + '-game.png');
            model.screenshots.push({ type: 'game', seconds: state.seconds, camera_sha256: state.camera_sha256, ...(await capture(page, filename)) });
          }
          const middle = times[Math.floor(times.length / 2)];
          await sample(page, middle);
          await page.evaluate(() => { const api = window.__vfxV2; api.focusEffect(); api.renderClean(); });
          const detail = await sample(page, middle), filename = path.join(directory, safeName(item.id) + '-t' + middle.toFixed(4).replace('.', '_') + '-detail.png');
          model.screenshots.push({ type: 'detail', seconds: detail.seconds, camera_sha256: detail.camera_sha256, ...(await capture(page, filename)) });
          model.technical_passed = true; model.status = 'captured_technical_only_requires_art_review';
        } catch (error) { model.status = 'technical_capture_failed'; model.failure = short(error.message); }
        saveReport();
        console.log(JSON.stringify({ id: item.id, status: model.status, samples: model.samples.length, captures: model.screenshots.length, art_approved: false, failure: model.failure }));
      }
    }
    report.technical_passed = report.items.length === selected.length && report.items.every(item => item.technical_passed) && !report.errors.length && !report.console_errors.length && !report.external_requests.length && !report.failed_requests.length;
    report.status = report.technical_passed ? 'captured_technical_only_requires_art_review' : 'technical_capture_failed';
    if (!report.technical_passed) process.exitCode = 1;
  } catch (error) { report.status = 'technical_capture_failed'; report.failure = short(error.message); process.exitCode = 1; }
  finally {
    report.finished_at_utc = new Date().toISOString();
    report.browser_close = { status: browser ? 'pending' : 'not_started' };
    // Preserve evidence even if browser.close fails; always await cleanup.
    try { saveReport(); }
    finally {
      if (browser) {
        try { await browser.close(); report.browser_close = { status: 'closed' }; }
        catch (error) { report.browser_close = { status: 'failed', message: short(error.message) }; process.exitCode = 1; }
      }
      saveReport();
    }
    console.log(JSON.stringify({ status: report.status, technical_passed: report.technical_passed, art_approved: false, selected: selected.length, captured: report.items.filter(item => item.technical_passed).length, report: relative(reportFile), failure: report.failure, browser_close: report.browser_close }, null, 2));
  }
}
main().catch(error => { console.error(short(error.stack)); process.exitCode = 1; });
