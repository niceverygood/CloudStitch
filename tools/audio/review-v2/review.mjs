export const REVIEW_SCHEMA = 'cloudstitch-audio-review/v2';
export const DEFAULT_SETTINGS = Object.freeze({master: .45, sfx: .65, ambience: .30, mute: false, mono: false, lowDynamic: false});
export const CATEGORY_LABELS = Object.freeze({weapon: '무기', impact: '피격·재료', salvage: '절단·인양', ambience: '항해·환경', warning: '위험 경고', harbor: '항구', ui: '조작·UI'});
const DECISIONS = Object.freeze({unreviewed: ['○', '검수 전'], approved: ['✓', '승인'], revision: ['↺', '수정 요청'], hold: ['—', '보류']});
const STATUS_LABELS = {generated_unreviewed: '신규 생성 · 검수 전', existing_reused: '기존 음원 · 재사용', failed: '생성 실패', pending: '생성 대기'};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const durationText = seconds => Number.isFinite(Number(seconds)) ? `${Number(seconds).toFixed(2)}초` : '길이 미확인';
const clockText = seconds => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;
const available = asset => ['generated_unreviewed', 'existing_reused'].includes(asset.status) && safeAssetFile(asset.file);

export function sanitizeSettings(input = {}) {
  const out = {...DEFAULT_SETTINGS};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const key of ['master', 'sfx', 'ambience']) if (typeof input[key] === 'number' && Number.isFinite(input[key])) out[key] = clamp(input[key], 0, 1);
  for (const key of ['mute', 'mono', 'lowDynamic']) if (typeof input[key] === 'boolean') out[key] = input[key];
  return out;
}

export function safeAssetFile(file) {
  return typeof file === 'string' && /^audio\/[A-Za-z0-9_./-]+\.(?:wav|mp3|ogg|m4a|flac)$/i.test(file) && !file.split('/').includes('..') && !file.includes('//');
}

export function validateReviewImport(payload, assets, version) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.schema !== REVIEW_SCHEMA) throw new Error('이 화면에서 내보낸 검수 JSON이 아닙니다.');
  if (payload.catalogVersion !== version) throw new Error('카탈로그 버전이 다릅니다. 같은 버전의 검수 파일을 선택해 주세요.');
  if (!Array.isArray(payload.decisions) || payload.decisions.length > assets.length) throw new Error('검수 항목 수가 카탈로그 범위를 벗어납니다.');
  const known = new Map(assets.map(a => [a.id, a]));
  const out = Object.create(null);
  for (const item of payload.decisions) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !known.has(item.id) || Object.hasOwn(out, item.id)) throw new Error('알 수 없거나 중복된 음원 ID가 있습니다.');
    if (!Object.hasOwn(DECISIONS, item.decision)) throw new Error('검수 판정 값이 올바르지 않습니다.');
    if (typeof item.note !== 'string' || item.note.length > 4000) throw new Error('검수 메모는 4,000자 이내의 글이어야 합니다.');
    const asset = known.get(item.id);
    if (item.sha256 && asset.sha256 && item.sha256 !== asset.sha256) throw new Error('같은 ID의 음원이 변경되어 가져올 수 없습니다.');
    out[item.id] = {decision: item.decision, note: item.note, heard: Number.isInteger(item.heard) ? clamp(item.heard, 0, 100000) : 0};
  }
  return out;
}

export function measureBuffer(buffer) {
  let peak = 0, square = 0, first = 0, last = 0, seam = 0, headPeak = 0, tailPeak = 0;
  const edge = Math.min(buffer.length, Math.max(1, Math.round(buffer.sampleRate * .01)));
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      if (!Number.isFinite(data[i])) throw new Error('유한하지 않은 오디오 샘플이 있습니다.');
      const abs = Math.abs(data[i]); peak = Math.max(peak, abs); square += data[i] * data[i];
      if (i < edge) headPeak = Math.max(headPeak, abs);
      if (i >= data.length - edge) tailPeak = Math.max(tailPeak, abs);
    }
    first = Math.max(first, Math.abs(data[0] || 0));
    last = Math.max(last, Math.abs(data[data.length - 1] || 0));
    seam = Math.max(seam, Math.abs((data[data.length - 1] || 0) - (data[0] || 0)));
  }
  return {duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels, frames: buffer.length, peak, rms: Math.sqrt(square / Math.max(1, buffer.length * buffer.numberOfChannels)), firstAbs: first, lastAbs: last, seamDelta: seam, head10msPeak: headPeak, tail10msPeak: tailPeak, finite: true};
}

export class ReviewAudioEngine {
  constructor({onChange = () => {}, onStarted = () => {}, contextFactory, fetcher = (...args) => fetch(...args), settings = {}} = {}) {
    this.settings = sanitizeSettings(settings); this.onChange = onChange; this.onStarted = onStarted; this.contextFactory = contextFactory; this.fetcher = fetcher;
    this.context = null; this.cache = new Map(); this.voices = new Map(); this.releases = new Map(); this.assetEpoch = new Map(); this.epoch = 0; this.groupEpoch = {sfx: 0, ambience: 0}; this.nextVoice = 1; this.pending = 0; this.hidden = false; this.disposed = false; this.lastError = null; this.lastReason = 'initial'; this.createdSources = 0;
  }
  async unlock() {
    if (this.disposed) throw new Error('종료된 오디오입니다. 화면을 새로 열어 주세요.');
    if (this.hidden) return false;
    if (!this.context) {
      const factory = this.contextFactory || (() => new (globalThis.AudioContext || globalThis.webkitAudioContext)());
      this.context = factory(); const c = this.context;
      this.buses = {sfx: c.createGain(), ambience: c.createGain()}; this.master = c.createGain(); this.compressor = c.createDynamicsCompressor(); this.limiter = c.createWaveShaper();
      const curve = new Float32Array(4096); for (let i = 0; i < curve.length; i++) { const x = i * 2 / (curve.length - 1) - 1; curve[i] = .94 * Math.tanh(1.25 * x) / Math.tanh(1.25); }
      this.limiter.curve = curve; this.limiter.oversample = '2x'; this.buses.sfx.connect(this.master); this.buses.ambience.connect(this.master); this.master.connect(this.compressor); this.compressor.connect(this.limiter); this.limiter.connect(c.destination);
      c.onstatechange = () => this.onChange(); this.applySettings(true);
    }
    if (this.context.state === 'suspended' || this.context.state === 'interrupted') await this.context.resume();
    if (this.disposed || this.hidden || this.context.state === 'closed') return false;
    this.onChange(); return this.context.state === 'running';
  }
  setSettings(patch) {
    const previous = this.settings; this.settings = sanitizeSettings({...previous, ...patch});
    if ((!previous.mute && this.settings.mute) || previous.mono !== this.settings.mono) this.stopAll(this.settings.mute ? 'mute' : 'mono changed');
    this.applySettings(); this.onChange(); return {...this.settings};
  }
  applySettings(immediate = false) {
    if (!this.context) return;
    const c = this.context; const set = (param, value) => { param.cancelScheduledValues(c.currentTime); if (immediate) param.setValueAtTime(value, c.currentTime); else param.setTargetAtTime(value, c.currentTime, .015); };
    const duck = [...this.voices.values()].some(v => v.group === 'sfx') ? .55 : 1;
    set(this.master.gain, this.settings.mute ? 0 : this.settings.master); set(this.buses.sfx.gain, this.settings.sfx); set(this.buses.ambience.gain, this.settings.ambience * duck);
    set(this.compressor.threshold, this.settings.lowDynamic ? -28 : -18); set(this.compressor.knee, this.settings.lowDynamic ? 20 : 12); set(this.compressor.ratio, this.settings.lowDynamic ? 8 : 4); set(this.compressor.attack, .003); set(this.compressor.release, this.settings.lowDynamic ? .18 : .12);
  }
  async decode(asset) {
    if (!this.context) throw new Error('먼저 오디오 활성화 버튼을 눌러 주세요.');
    if (!available(asset)) throw new Error('아직 재생 가능한 음원 파일이 없습니다.');
    if (this.cache.has(asset.id)) return this.cache.get(asset.id);
    const promise = (async () => {
      const response = await this.fetcher(asset.file, {credentials: 'same-origin'});
      if (!response.ok) throw new Error(`음원을 읽지 못했습니다 (${response.status}).`);
      const bytes = await response.arrayBuffer(); if (bytes.byteLength > 24 * 1024 * 1024) throw new Error('검수 파일 크기 제한을 넘었습니다.');
      const buffer = await this.context.decodeAudioData(bytes); const metrics = measureBuffer(buffer);
      if (buffer.duration <= 0 || buffer.duration > 180 || buffer.numberOfChannels > 8) throw new Error('음원 길이 또는 채널 수가 검수 범위를 벗어납니다.');
      const decoded = {buffer, metrics, variants: new Map()}; promise.decoded = decoded; return decoded;
    })();
    this.cache.set(asset.id, promise);
    try { return await promise; } catch (error) { if (this.cache.get(asset.id) === promise) this.cache.delete(asset.id); this.lastError = error.message; throw error; }
  }
  normalized(decoded, mono = this.settings.mono) {
    const key = mono ? 'mono' : 'original'; if (decoded.variants.has(key)) return decoded.variants.get(key);
    const raw = decoded.buffer, channels = mono ? 1 : raw.numberOfChannels;
    const buffer = this.context.createBuffer(channels, raw.length, raw.sampleRate); let peak = 0;
    for (let c = 0; c < channels; c++) {
      const out = buffer.getChannelData(c);
      if (mono) { for (let source = 0; source < raw.numberOfChannels; source++) { const input = raw.getChannelData(source); for (let i = 0; i < out.length; i++) out[i] += input[i] / raw.numberOfChannels; } }
      else out.set(raw.getChannelData(c));
      for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
    }
    if (peak < 1e-8) throw new Error('무음에 가까운 음원입니다. 원본을 확인해 주세요.');
    const gain = .7 / peak; for (let c = 0; c < channels; c++) { const out = buffer.getChannelData(c); for (let i = 0; i < out.length; i++) out[i] *= gain; }
    decoded.variants.set(key, buffer); return buffer;
  }
  canPlay(epoch, group, groupEpoch) { return !this.disposed && !this.hidden && !this.settings.mute && this.context?.state === 'running' && this.epoch === epoch && this.groupEpoch[group] === groupEpoch; }
  async play(asset, {loop = false, group = asset.category === 'ambience' ? 'ambience' : 'sfx', burst = false, priority = Number.isFinite(asset.priority) ? asset.priority : asset.category === 'warning' ? 3 : 2} = {}) {
    const epoch = this.epoch, groupEpoch = this.groupEpoch[group], assetEpoch = this.assetEpoch.get(asset.id) || 0;
    if (!this.canPlay(epoch, group, groupEpoch)) return null;
    const existing = [...this.voices.values()].find(v => v.asset.id === asset.id && v.loop && loop && v.group === group); if (existing) return existing;
    this.pending++; this.onChange();
    try {
      const decoded = await this.decode(asset); if (!this.canPlay(epoch, group, groupEpoch) || (this.assetEpoch.get(asset.id) || 0) !== assetEpoch) return null;
      let buffer = this.normalized(decoded);
      if (burst) {
        const mixed = this.context.createBuffer(buffer.numberOfChannels, Math.ceil((buffer.duration + .22 * 5) * buffer.sampleRate), buffer.sampleRate); let peak = 0;
        for (let c = 0; c < buffer.numberOfChannels; c++) { const target = mixed.getChannelData(c), source = buffer.getChannelData(c); for (let n = 0; n < 6; n++) { const offset = Math.round(n * .22 * buffer.sampleRate); for (let i = 0; i < source.length; i++) target[i + offset] += source[i]; } for (let i = 0; i < target.length; i++) peak = Math.max(peak, Math.abs(target[i])); }
        if (peak > 0) for (let c = 0; c < mixed.numberOfChannels; c++) { const data = mixed.getChannelData(c); for (let i = 0; i < data.length; i++) data[i] *= .7 / peak; } buffer = mixed;
      }
      return this.start(asset, buffer, {loop, group, priority});
    } finally { this.pending--; this.onChange(); }
  }
  async playMany(assets) {
    this.stopGroup('sfx', 'three cue audition'); const epoch = this.epoch, groupEpoch = this.groupEpoch.sfx;
    if (!this.canPlay(epoch, 'sfx', groupEpoch)) return [];
    this.pending++; this.onChange();
    try {
      const decoded = await Promise.all(assets.slice(0, 3).map(asset => this.decode(asset))); if (!this.canPlay(epoch, 'sfx', groupEpoch)) return [];
      const when = this.context.currentTime + .03;
      return assets.slice(0, 3).map((asset, i) => this.start(asset, this.normalized(decoded[i]), {loop: false, group: 'sfx', priority: asset.category === 'warning' ? 3 : 2, when}));
    } finally { this.pending--; this.onChange(); }
  }
  start(asset, buffer, {loop, group, priority = 2, when = this.context.currentTime + .01}) {
    if (this.hidden || this.disposed || this.settings.mute || this.context.state !== 'running') return null;
    if (loop) { const existing = [...this.voices.values()].find(v => v.asset.id === asset.id && v.group === group && v.loop); if (existing) return existing; }
    priority = clamp(Number(priority) || 2, 0, 3);
    const groupVoices = [...this.voices.values()].filter(v => v.group === group); const limit = group === 'ambience' ? 2 : 3;
    if (groupVoices.length >= limit) { const victim = groupVoices.sort((a, b) => a.priority - b.priority || a.id - b.id)[0]; if (victim.priority > priority) return null; this.stopVoice(victim); }
    const source = this.context.createBufferSource(), gain = this.context.createGain(); source.buffer = buffer; source.loop = loop;
    source.connect(gain); gain.connect(this.buses[group]); gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(1, when + Math.min(.012, buffer.duration / 4));
    if (!loop) { const end = when + buffer.duration; gain.gain.setValueAtTime(1, Math.max(when + .012, end - .018)); gain.gain.linearRampToValueAtTime(0, end); }
    let resolve; const done = new Promise(r => { resolve = r; }); const voice = {id: this.nextVoice++, asset, buffer, source, gain, loop, group, priority, start: when, duration: buffer.duration, done, resolve, stopped: false};
    source.onended = () => this.cleanupVoice(voice); this.voices.set(voice.id, voice); this.createdSources++; this.applySettings(); source.start(when); this.onStarted(voice); this.onChange(); return voice;
  }
  cleanupVoice(voice) {
    this.voices.delete(voice.id); this.releases.delete(voice.id); try { voice.source.disconnect(); voice.gain.disconnect(); } catch { /* Already disconnected. */ }
    if (!voice.stopped) voice.stopped = true; voice.resolve(); this.applySettings(); this.onChange();
  }
  stopVoice(voice, fade = .018) {
    if (!voice || voice.stopped) return; voice.stopped = true; this.voices.delete(voice.id); this.releases.set(voice.id, voice);
    const now = this.context.currentTime;
    try { voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setValueAtTime(voice.gain.gain.value, now); voice.gain.gain.linearRampToValueAtTime(0, now + fade); voice.source.stop(now + fade + .002); } catch { this.cleanupVoice(voice); }
    voice.resolve();
    while (this.releases.size > 12) { const oldest = this.releases.values().next().value; try { oldest.source.stop(); } catch { /* Finished. */ } this.cleanupVoice(oldest); }
    this.applySettings(); this.onChange();
  }
  stopGroup(group, reason = 'group stop') { this.groupEpoch[group]++; for (const v of [...this.voices.values()]) if (v.group === group) this.stopVoice(v); this.lastReason = reason; }
  stopAsset(id) { this.assetEpoch.set(id, (this.assetEpoch.get(id) || 0) + 1); for (const v of [...this.voices.values()]) if (v.asset.id === id) this.stopVoice(v); }
  stopAll(reason = 'all stop') { this.epoch++; this.groupEpoch.sfx++; this.groupEpoch.ambience++; for (const v of [...this.voices.values()]) this.stopVoice(v); this.lastReason = reason; this.onChange(); }
  setHidden(hidden) { this.hidden = hidden; if (hidden) { this.stopAll('tab hidden'); void this.context?.suspend().catch(() => {}); } this.onChange(); }
  async inspectAll(assets, {release = false} = {}) {
    if (!this.context) throw new Error('첫 클릭으로 오디오를 활성화한 뒤 실행해 주세요.');
    const results = [];
    for (const asset of assets) {
      if (!available(asset)) { results.push({id: asset.id, status: 'unavailable', assetStatus: asset.status}); continue; }
      try { const decoded = await this.decode(asset); results.push({id: asset.id, status: 'decoded', ...decoded.metrics, catalogDuration: asset.duration, bytes: asset.bytes, sha256: asset.sha256, playbackNormalizationTarget: .7}); }
      catch (error) { results.push({id: asset.id, status: 'error', message: error.message}); }
      if (release && ![...this.voices.values()].some(v => v.asset.id === asset.id)) this.cache.delete(asset.id);
    }
    return {schema: 'cloudstitch-audio-decode-inspection/v1', generatedAt: new Date().toISOString(), method: 'Native AudioContext.decodeAudioData only; no playback', humanListening: 'not performed by this inspection', results};
  }
  debug() {
    return {contextState: this.context?.state || 'locked', hidden: this.hidden, disposed: this.disposed, settings: {...this.settings}, voices: [...this.voices.values()].map(v => ({id: v.id, assetId: v.asset.id, loop: v.loop, group: v.group, duration: v.duration, start: v.start})), releaseCount: this.releases.size, pending: this.pending, cacheCount: this.cache.size, createdSources: this.createdSources, epoch: this.epoch, lastReason: this.lastReason, lastError: this.lastError, metrics: Object.fromEntries([...this.cache].filter(([, p]) => p.decoded).map(([id, p]) => [id, p.decoded.metrics]))};
  }
  async whenIdle(timeout = 10000) { const started = Date.now(); while (this.pending || [...this.voices.values()].some(v => !v.loop)) { if (Date.now() - started > timeout) return false; await new Promise(resolve => setTimeout(resolve, 25)); } return true; }
  async dispose() { if (this.disposed) return; this.stopAll('dispose'); this.disposed = true; for (const v of [...this.releases.values()]) { try { v.source.stop(); } catch { /* Finished. */ } this.cleanupVoice(v); } this.cache.clear(); this.assetEpoch.clear(); if (this.context && this.context.state !== 'closed') await this.context.close(); this.onChange(); }
}

async function boot() {
  const $ = id => document.getElementById(id); let catalog, assets = [], filtered = [], selectedId = '', category = 'all', sequence = null, sequenceToken = 0, drawBuffer = null, lastDraw = 0, storageAvailable = true;
  const review = Object.create(null); const settingsKey = 'cloudstitch:audio-review:v2:settings'; let storageKey;
  const notice = (message, error = false) => { $('notice').textContent = message; $('notice').classList.toggle('error', error); };
  const current = () => assets.find(a => a.id === selectedId);
  let storedSettings;
  try { storedSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}'); } catch { storedSettings = {}; storageAvailable = false; }
  const engine = new ReviewAudioEngine({settings: storedSettings, onChange: renderRuntime, onStarted: voice => {
    const row = getReview(voice.asset.id); row.heard = Math.min(100000, row.heard + 1); saveReview(); renderReviewSummary();
    if (voice.asset.id === selectedId) { drawBuffer = voice.buffer; drawWaveform(); renderMetadata(); $('heard-count').textContent = `이 기기에서 ${row.heard}회 재생 시작`; }
  }});
  function getReview(id) { return review[id] || (review[id] = {decision: 'unreviewed', note: '', heard: 0}); }
  function payload() { return {schema: REVIEW_SCHEMA, catalogVersion: catalog.version, exportedAt: new Date().toISOString(), decisions: assets.map(a => ({id: a.id, sha256: a.sha256 || null, ...getReview(a.id)}))}; }
  function saveReview() {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(payload())); $('save-state').textContent = '이 브라우저에 저장됨'; }
    catch { storageAvailable = false; $('save-state').textContent = '로컬 저장 불가 · JSON 내보내기를 이용해 주세요'; }
  }
  function saveSettings() { try { localStorage.setItem(settingsKey, JSON.stringify(engine.settings)); } catch { storageAvailable = false; notice('설정은 현재 화면에 적용됐습니다. 로컬 저장이 제한되어 있습니다.'); } }
  async function unlock() { try { return await engine.unlock(); } catch (error) { notice(error.message, true); return false; } }
  function cancelSequence(stop = false) {
    sequenceToken++; if (sequence) { sequence.cancelled = true; if (sequence.timer) clearTimeout(sequence.timer); sequence.wake?.(); sequence = null; }
    if (stop) engine.stopGroup('sfx', 'sequence cancelled'); $('stop-sequence').hidden = true; $('sequence-status').textContent = '선택한 범주·검색 결과 기준';
  }
  function stopAll(reason = 'manual stop') { cancelSequence(); engine.stopAll(reason); notice(reason === 'tab hidden' ? '탭을 숨겨 모든 소리를 정리했습니다. 다시 듣기는 버튼을 눌러 주세요.' : '모든 소리를 정지했습니다.'); }
  function renderRuntime() {
    const debug = engine.debug(); const muted = engine.settings.mute; const running = debug.contextState === 'running' && !debug.hidden;
    $('unlock').dataset.state = muted ? 'muted' : running ? 'running' : 'locked'; $('audio-state').textContent = muted ? '음소거 중' : running ? '오디오 활성화' : debug.hidden ? '탭 숨김 · 일시 정지' : '오디오 잠김 · 클릭하여 활성화';
    $('output-hint').textContent = `${debug.voices.filter(v => v.group === 'sfx').length}/3 효과음 · ${debug.voices.filter(v => v.group === 'ambience').length}/2 환경음`;
    const loops = debug.voices.filter(v => v.group === 'ambience'); $('active-ambience').textContent = loops.length ? `재생 중: ${loops.map(v => assets.find(a => a.id === v.assetId)?.label || v.assetId).join(' + ')}` : '재생 중인 환경음 없음';
    const loopOn = loops.some(v => v.assetId === $('ambience-select').value); $('toggle-ambience').textContent = loopOn ? '이 환경음 끄기' : '환경음 켜기';
  }
  function renderSettings() {
    for (const [key, id] of [['master', 'master-volume'], ['sfx', 'sfx-volume'], ['ambience', 'ambience-volume']]) { $(id).value = String(Math.round(engine.settings[key] * 100)); $(`${key}-output`).textContent = `${Math.round(engine.settings[key] * 100)}%`; }
    for (const [key, id] of [['mute', 'mute'], ['mono', 'mono'], ['lowDynamic', 'low-dynamic']]) $(id).checked = engine.settings[key];
    renderRuntime();
  }
  function renderFilters() {
    $('filters').replaceChildren();
    for (const [key, label] of [['all', '전체'], ...Object.entries(CATEGORY_LABELS)]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'filter'; button.textContent = label; button.setAttribute('aria-pressed', String(category === key));
      button.addEventListener('click', () => { category = key; cancelSequence(true); renderFilters(); renderList(); }); $('filters').append(button);
    }
  }
  function renderList() {
    const search = $('search').value.trim().toLocaleLowerCase();
    filtered = assets.filter(a => (category === 'all' || a.category === category) && (!search || [a.id, a.label, a.description, ...(a.eventMapping?.events || [])].join(' ').toLocaleLowerCase().includes(search)));
    $('filtered-count').textContent = `${filtered.length}개`; const list = $('asset-list'); list.replaceChildren();
    if (!filtered.length) { const empty = document.createElement('p'); empty.className = 'empty-list'; empty.textContent = '조건에 맞는 소리가 없습니다.'; list.append(empty); }
    filtered.forEach(a => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'asset-button'; button.dataset.assetId = a.id; button.setAttribute('aria-pressed', String(selectedId === a.id));
      const order = document.createElement('span'); order.className = 'asset-order'; order.textContent = String(assets.indexOf(a) + 1).padStart(2, '0');
      const text = document.createElement('span'); text.className = 'asset-text'; const title = document.createElement('span'); title.className = 'asset-title'; title.textContent = a.label || a.id;
      const meta = document.createElement('span'); meta.className = 'asset-meta'; meta.textContent = `${CATEGORY_LABELS[a.category] || a.category} · ${durationText(a.duration)}${a.loop ? ' · 반복용' : ''}${available(a) ? '' : ` · ${STATUS_LABELS[a.status] || '재생 대기'}`}`; text.append(title, meta);
      const decision = getReview(a.id).decision; const mark = document.createElement('span'); mark.className = `asset-decision ${decision}`; mark.textContent = DECISIONS[decision][0]; mark.setAttribute('aria-label', DECISIONS[decision][1]); button.append(order, text, mark);
      button.addEventListener('click', () => select(a.id)); list.append(button);
    });
  }
  function select(id, {keepSequence = false} = {}) {
    const asset = assets.find(a => a.id === id); if (!asset) return false;
    if (!keepSequence) cancelSequence(true); selectedId = id; const row = getReview(id);
    $('selected-title').textContent = asset.label || id; $('selected-category').textContent = `02 / ${CATEGORY_LABELS[asset.category] || asset.category}`; $('selected-description').textContent = asset.description || '';
    $('selected-status').textContent = STATUS_LABELS[asset.status] || asset.status; $('selected-status').classList.toggle('failed', !available(asset)); $('play-selected').disabled = !available(asset); $('repeat-selected').checked = Boolean(asset.loop);
    $('heard-count').textContent = row.heard ? `이 기기에서 ${row.heard}회 재생 시작` : '아직 재생하지 않음'; $('review-note').value = row.note; for (const input of document.querySelectorAll('input[name=decision]')) input.checked = input.value === row.decision;
    drawBuffer = engine.cache.get(id)?.decoded?.buffer || null; renderMetadata(); drawWaveform(); renderList(); return true;
  }
  function renderMetadata() {
    const a = current(); if (!a) return; const decoded = engine.cache.get(a.id)?.decoded; const metrics = decoded?.metrics; const source = a.source || {}; const mapping = a.eventMapping || {};
    $('track-time').textContent = `0:00 / ${durationText(metrics?.duration || a.duration)}`; $('track-format').textContent = metrics ? `${metrics.channels === 1 ? 'MONO' : `${metrics.channels} CH`} · ${(metrics.sampleRate / 1000).toFixed(1)} kHz` : (typeof a.format === 'string' ? a.format : a.file?.split('.').pop()?.toUpperCase()) || '—';
    const rows = [['ID', a.id], ['카탈로그 상태', STATUS_LABELS[a.status] || a.status], ['파일', a.file || '없음'], ['길이 · 반복', `${durationText(metrics?.duration || a.duration)} · ${a.loop ? '반복용' : '단발'}`], ['크기', Number.isFinite(a.bytes) ? `${a.bytes.toLocaleString()} bytes` : '미기록'], ['SHA256', a.sha256 || '미기록'], ['출처', [source.provider, source.model, source.origin, source.note].filter(Boolean).join(' · ') || '카탈로그 참조'], ['권리 · 용도', source.license || source.rights || source.usageRights || a.rights || catalog.rights || '카탈로그의 출처·권리 기록을 확인해 주세요.'], ['생성 프롬프트', source.prompt || a.prompt || source.request?.text || source.generation?.prompt || '이전 음원 재사용 또는 카탈로그 상세 참조'], ['게임 연결', [mapping.status || '미기록', ...(Array.isArray(mapping.events) ? mapping.events : [])].join(' · ')], ['연결 조건', mapping.note || '미기록'], ['브라우저 수치', metrics ? `raw peak ${metrics.peak.toFixed(5)} · RMS ${metrics.rms.toFixed(5)} · seam Δ ${metrics.seamDelta.toFixed(5)}\n재생 peak 목표 0.70, 출력은 현재 믹서·압축·리미터를 거칩니다.` : '재생 또는 파일 수치 검사 후 표시됩니다.']];
    const dl = $('metadata'); dl.replaceChildren(); for (const [key, value] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = key; dd.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); dl.append(dt, dd); }
    const link = $('download-audio'); if (available(a)) { link.href = a.file; link.download = a.file.split('/').pop(); link.setAttribute('aria-disabled', 'false'); } else { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); }
  }
  function renderReviewSummary() {
    const counts = {approved: 0, revision: 0, hold: 0, unreviewed: 0}; for (const a of assets) counts[getReview(a.id).decision]++;
    $('review-progress').textContent = `${assets.length - counts.unreviewed} / ${assets.length} 검수`; $('review-counts').replaceChildren();
    for (const [id, count] of Object.entries(counts)) { const span = document.createElement('span'); span.textContent = `${DECISIONS[id][0]} ${DECISIONS[id][1]} ${count}`; $('review-counts').append(span); }
  }
  function drawWaveform() {
    const canvas = $('waveform'), width = canvas.clientWidth || 600, height = 140, ratio = Math.min(2, globalThis.devicePixelRatio || 1); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.scale(ratio, ratio); ctx.clearRect(0, 0, width, height);
    $('waveform-empty').hidden = Boolean(drawBuffer); if (!drawBuffer) return;
    const voice = [...engine.voices.values()].find(v => v.asset.id === selectedId); const elapsed = voice ? Math.max(0, engine.context.currentTime - voice.start) : 0; const fraction = voice ? (voice.loop ? (elapsed % voice.duration) / voice.duration : Math.min(1, elapsed / voice.duration)) : 0;
    const bars = Math.max(20, Math.floor(width / 4)), data = drawBuffer.getChannelData(0), step = Math.max(1, Math.floor(data.length / bars));
    ctx.strokeStyle = '#dce4d9'; ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
    for (let bar = 0; bar < bars; bar++) { let min = 0, max = 0; for (let i = bar * step; i < Math.min(data.length, (bar + 1) * step); i++) { min = Math.min(min, data[i]); max = Math.max(max, data[i]); } const x = bar * width / bars; ctx.fillStyle = bar / bars < fraction ? '#b18b4e' : '#497870'; ctx.fillRect(x, height / 2 - max * 72, Math.max(1, width / bars - 1.6), Math.max(1, (max - min) * 72)); }
    if (voice) $('track-time').textContent = `${clockText(voice.loop ? elapsed % voice.duration : elapsed)} / ${durationText(voice.duration)}${voice.loop ? ' · 반복 중' : ''}`;
  }
  async function playSelected() {
    cancelSequence(); const asset = current(); if (!asset || !available(asset)) return;
    if (!await unlock()) return; if (engine.settings.mute) { notice('음소거를 해제하면 들을 수 있습니다.'); return; }
    const loop = $('repeat-selected').checked, group = asset.category === 'ambience' ? 'ambience' : 'sfx'; engine.stopGroup('sfx', 'single audition');
    try { const voice = await engine.play(asset, {loop, group}); if (voice) notice(`${asset.label || asset.id}${loop ? ' · 반복' : ''} 재생 중`); }
    catch (error) { notice(error.message, true); }
  }
  function populateSelect(id, options, hint) {
    const selectEl = $(id); selectEl.replaceChildren();
    if (!options.length) { const option = document.createElement('option'); option.value = ''; option.textContent = '재생 가능한 음원 없음'; selectEl.append(option); selectEl.disabled = true; return; }
    selectEl.disabled = false; for (const asset of options) { const option = document.createElement('option'); option.value = asset.id; option.textContent = asset.label || asset.id; selectEl.append(option); }
    if (hint) { const chosen = options.find(a => hint.test(`${a.id} ${a.label}`)); if (chosen) selectEl.value = chosen.id; }
  }
  async function playMachinegun(burst) {
    const asset = assets.find(a => available(a) && a.id === 'fire-machinegun') || assets.find(a => available(a) && /machine.?gun|기관총/i.test(`${a.id} ${a.label}`));
    if (!asset) { notice('기관총 기준음이 카탈로그에 없습니다.'); return; } cancelSequence(true); select(asset.id); if (!await unlock()) return;
    try { const voice = await engine.play(asset, {group: 'sfx', burst}); if (voice) notice(burst ? '검수용 기관총 6연사 · 0.22초 간격 · 실제 게임 이벤트가 아닙니다.' : '기존 기관총 단발 기준음을 듣습니다.'); } catch (error) { notice(error.message, true); }
  }
  async function playSequence() {
    cancelSequence(true); if (!await unlock()) return; if (engine.settings.mute) { notice('음소거를 해제한 뒤 순차 듣기를 시작해 주세요.'); return; }
    const list = filtered.filter(available); if (!list.length) return;
    const own = {token: ++sequenceToken, cancelled: false, timer: null, wake: null}; sequence = own; $('stop-sequence').hidden = false;
    for (let i = 0; i < list.length; i++) {
      if (own.cancelled || sequenceToken !== own.token || document.hidden) break;
      select(list[i].id, {keepSequence: true}); $('sequence-status').textContent = `${i + 1} / ${list.length} · 반복음은 한 번씩`; engine.stopGroup('sfx', 'sequence next');
      try { const voice = await engine.play(list[i], {group: 'sfx', loop: false}); if (voice) await voice.done; } catch (error) { notice(`${list[i].label}: ${error.message}`, true); }
      if (own.cancelled || sequenceToken !== own.token || document.hidden) break;
      await new Promise(resolve => { own.wake = resolve; own.timer = setTimeout(resolve, 400); }); own.timer = null; own.wake = null;
    }
    if (sequence === own) { sequence = null; $('stop-sequence').hidden = true; $('sequence-status').textContent = '현재 목록 순차 듣기 완료'; }
  }
  function downloadJson(value, filename) { const blob = new Blob([JSON.stringify(value, null, 2) + '\n'], {type: 'application/json'}), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  document.addEventListener('pointerdown', () => { void unlock(); }, {capture: true}); document.addEventListener('keydown', event => { if (!event.repeat) void unlock(); }, {capture: true});
  $('unlock').addEventListener('click', () => { void unlock(); }); $('stop-all').addEventListener('click', () => stopAll()); $('play-selected').addEventListener('click', () => { void playSelected(); }); $('stop-selected').addEventListener('click', () => { cancelSequence(true); engine.stopAsset(selectedId); });
  for (const [key, id] of [['master', 'master-volume'], ['sfx', 'sfx-volume'], ['ambience', 'ambience-volume']]) $(id).addEventListener('input', () => { engine.setSettings({[key]: Number($(id).value) / 100}); renderSettings(); saveSettings(); });
  for (const [key, id] of [['mute', 'mute'], ['mono', 'mono'], ['lowDynamic', 'low-dynamic']]) $(id).addEventListener('change', () => { cancelSequence(); engine.setSettings({[key]: $(id).checked}); renderSettings(); saveSettings(); if (key === 'mono') notice('모노 설정이 적용됐습니다. 다시 듣기를 눌러 비교해 주세요.'); });
  $('search').addEventListener('input', () => { cancelSequence(true); renderList(); });
  for (const [id, delta] of [['previous', -1], ['next', 1]]) $(id).addEventListener('click', () => { if (!filtered.length) return; const index = filtered.findIndex(a => a.id === selectedId); select(filtered[(index < 0 ? 0 : index + delta + filtered.length) % filtered.length].id); });
  $('play-sequence').addEventListener('click', () => { void playSequence(); }); $('stop-sequence').addEventListener('click', () => cancelSequence(true));
  for (const input of document.querySelectorAll('input[name=decision]')) input.addEventListener('change', () => { if (!current()) return; getReview(selectedId).decision = input.value; saveReview(); renderList(); renderReviewSummary(); });
  $('review-note').addEventListener('input', () => { if (!current()) return; getReview(selectedId).note = $('review-note').value; saveReview(); });
  $('export-review').addEventListener('click', () => { if (catalog) { saveReview(); downloadJson(payload(), `Cloudstitch-audio-review-${catalog.version.replace(/[^\w.-]/g, '_')}.json`); notice('현재 판정과 메모를 검수 JSON으로 내보냈습니다.'); } });
  $('import-review').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { if (file.size > 2 * 1024 * 1024) throw new Error('검수 JSON은 2MB 이내여야 합니다.'); const incoming = validateReviewImport(JSON.parse(await file.text()), assets, catalog.version); for (const [id, value] of Object.entries(incoming)) review[id] = value; saveReview(); renderList(); renderReviewSummary(); if (selectedId) select(selectedId); notice(`${Object.keys(incoming).length}개 음원의 검수 결과를 가져왔습니다.`); }
    catch (error) { notice(`가져오기 실패: ${error.message}`, true); } finally { event.target.value = ''; }
  });
  $('inspect-files').addEventListener('click', async () => {
    if (!await unlock()) return; $('inspect-files').disabled = true; notice('파일을 하나씩 디코딩하고 수치를 읽습니다. 소리는 재생하지 않습니다.');
    try { const result = await engine.inspectAll(assets); result.catalogVersion = catalog.version; downloadJson(result, `Cloudstitch-audio-metrics-${catalog.version.replace(/[^\w.-]/g, '_')}.json`); renderMetadata(); drawBuffer = engine.cache.get(selectedId)?.decoded?.buffer || drawBuffer; drawWaveform(); notice(`${result.results.filter(r => r.status === 'decoded').length}개 파일 디코딩 수치를 내보냈습니다. 청취 판정은 변경하지 않았습니다.`); } catch (error) { notice(error.message, true); } finally { $('inspect-files').disabled = false; }
  });
  $('machinegun-single').addEventListener('click', () => { void playMachinegun(false); }); $('machinegun-burst').addEventListener('click', () => { void playMachinegun(true); });
  $('play-three').addEventListener('click', async () => {
    cancelSequence(true); if (!await unlock()) return; const three = ['cue-warning', 'cue-impact', 'cue-weapon'].map(id => assets.find(a => a.id === $(id).value)).filter(Boolean);
    if (three.length !== 3) { notice('세 범주에 모두 재생 가능한 음원이 필요합니다.'); return; }
    try { const voices = await engine.playMany(three); if (voices.length) notice('위험·충격·발사 3종을 동시에 듣습니다. 실제 게임 이벤트 재생은 아닙니다.'); } catch (error) { notice(error.message, true); }
  });
  $('toggle-ambience').addEventListener('click', async () => {
    const id = $('ambience-select').value, asset = assets.find(a => a.id === id); if (!asset) return; const existing = [...engine.voices.values()].find(v => v.asset.id === id && v.group === 'ambience'); if (existing) { engine.stopVoice(existing); return; }
    if (!await unlock()) return; try { await engine.play(asset, {loop: true, group: 'ambience', priority: 1}); } catch (error) { notice(error.message, true); }
  });
  $('ambience-select').addEventListener('change', renderRuntime); $('stop-ambience').addEventListener('click', () => engine.stopGroup('ambience', 'ambience stop'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelSequence(); notice('탭을 숨겨 소리를 정리했습니다. 다시 표시해도 자동 재생하지 않습니다.'); } engine.setHidden(document.hidden); });
  window.addEventListener('pagehide', () => { cancelSequence(); void engine.dispose(); });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  window.addEventListener('resize', () => drawWaveform()); if (globalThis.ResizeObserver) new ResizeObserver(() => drawWaveform()).observe($('waveform'));
  function frame(now) { if (now - lastDraw > 100 && !document.hidden) { if (engine.voices.size) drawWaveform(); lastDraw = now; } requestAnimationFrame(frame); } requestAnimationFrame(frame);
  renderSettings();
  try {
    const response = await fetch('./catalog.json', {credentials: 'same-origin'}); if (!response.ok) throw new Error(`카탈로그 응답 ${response.status}`); catalog = await response.json();
    if (!catalog || !Array.isArray(catalog.assets) || catalog.assets.length > 250 || typeof catalog.version !== 'string') throw new Error('카탈로그 형식이 올바르지 않습니다.');
    const ids = new Set(); for (const asset of catalog.assets) { if (!asset || typeof asset.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$/.test(asset.id) || ids.has(asset.id)) throw new Error('카탈로그 ID가 올바르지 않습니다.'); ids.add(asset.id); }
    assets = catalog.assets; storageKey = `cloudstitch:audio-review:v2:${catalog.version}`;
    try { const stored = localStorage.getItem(storageKey); if (stored) Object.assign(review, validateReviewImport(JSON.parse(stored), assets, catalog.version)); } catch { storageAvailable = false; notice('저장된 검수 데이터가 손상되어 기본값으로 열었습니다. 현재 결과는 JSON으로 보존할 수 있습니다.'); }
    $('collection-count').textContent = `${assets.filter(available).length}종 청취 가능 / 전체 ${assets.length}종`; $('collection-version').textContent = catalog.version;
    populateSelect('cue-warning', assets.filter(a => a.category === 'warning' && available(a)), /lift|양력|critical|긴급/i); populateSelect('cue-impact', assets.filter(a => a.category === 'impact' && available(a)), /wood|목재/i); populateSelect('cue-weapon', assets.filter(a => a.category === 'weapon' && available(a)), /cannon|함포/i); populateSelect('ambience-select', assets.filter(a => a.category === 'ambience' && available(a)), /wind|바람/i);
    renderFilters(); renderList(); renderReviewSummary(); if (assets.length) select(assets[0].id); if (!storageAvailable) $('save-state').textContent = '로컬 저장 확인 필요 · JSON 내보내기 가능';
    window.__audioReview = {get debug() { return {...engine.debug(), catalogVersion: catalog.version, selectedId, sequenceActive: Boolean(sequence), decisions: Object.fromEntries(assets.map(a => [a.id, {...getReview(a.id)}]))}; }, getDebug: () => window.__audioReview.debug, stopAll, select, play: async id => { if (!select(id)) throw new Error('알 수 없는 음원 ID입니다.'); await playSelected(); }, whenIdle: timeout => engine.whenIdle(timeout), inspectAll: options => engine.inspectAll(assets, options), dispose: () => engine.dispose(), getCatalog: () => structuredClone(catalog)};
  } catch (error) { notice(`화면 준비 실패: ${error.message}`, true); $('collection-count').textContent = '카탈로그를 읽지 못했습니다'; }
}

if (typeof document !== 'undefined') void boot();
