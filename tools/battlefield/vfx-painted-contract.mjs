import { runtimeAssetDescriptors } from './vfx-contract.mjs';

const VERSION_BASE = Object.freeze({ v1: '../combat-vfx/', v2: '../combat-vfx-v2/' });
const CONTRACT_KEYS = Object.freeze(['collision_authority', 'movement_authority', 'muzzle_axis',
  'target_normal_axis', 'loop_stop', 'pooling', 'time_size', 'ownership', 'material_selection']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positive = value => Number.isFinite(value) && value > 0;
const sameDuration = (a, b) => positive(a) && positive(b) && Math.abs(a - b) <= 1e-5;
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const version = value => value === 'v1' || value === 'v2';
const failure = (id, message) => { throw new Error(`${id}: ${message}`); };

function validateV2Contract(catalog, recipes) {
  if (!Array.isArray(catalog?.items) || !Array.isArray(recipes?.effects)) {
    throw new Error('v2 catalog.items / recipes.effects가 필요합니다.');
  }
  if (recipes.schema_version !== 2 || !isObject(recipes.lifecycle_contract) ||
      CONTRACT_KEYS.some(key => typeof recipes.lifecycle_contract[key] !== 'string' ||
        !recipes.lifecycle_contract[key].trim())) {
    throw new Error('v2 schema_version=2 / lifecycle_contract가 유효하지 않습니다.');
  }
  // The v2 lifecycle_contract has the same collision/movement/anchor/pooling
  // meaning as v1 integration_contract. Normalize it only inside this adapter;
  // never rename or mutate the authored source recipes.
  return { integration_contract: recipes.lifecycle_contract, effects: recipes.effects };
}

function v2Descriptor(base, catalog, normalized) {
  const { id, weaponId, kind } = base;
  const entries = catalog.items.filter(entry => entry?.id === id);
  const rules = normalized.effects.filter(recipe => recipe?.id === id);
  if (entries.length !== 1 || rules.length !== 1) failure(id, 'v2 기록이 누락되거나 중복되었습니다.');
  const entry = entries[0], recipe = rules[0];
  if (entry.weapon_id !== weaponId || recipe.weapon_id !== weaponId ||
      (entry.original_id !== undefined && entry.original_id !== id) ||
      (recipe.effect_id !== undefined && recipe.effect_id !== id) ||
      (recipe.original_id !== undefined && recipe.original_id !== id)) {
    failure(id, 'v2 ID / weapon_id가 일치하지 않습니다.');
  }
  // The fixed directory and exact semantic filename prohibit traversal, remote
  // URLs and choreography sequences from being selected as runtime effects.
  if (entry.model !== `assets/${id}.glb` || recipe.model !== entry.model) {
    failure(id, 'v2 model은 같은 ID의 assets/<id>.glb여야 합니다.');
  }
  const expectedMode = kind === 'hit' ? 'impact-surface' : kind;
  if (recipe.attachment?.mode !== expectedMode || entry.loop !== false || recipe.loop !== false ||
      !sameDuration(entry.duration, recipe.duration_seconds)) {
    failure(id, 'v2 부착 / loop / duration 기록이 일치하지 않습니다.');
  }
  if (!isObject(recipe.clip) || recipe.clip.name !== id || recipe.clip.loop !== false ||
      !sameDuration(entry.duration, recipe.clip.duration)) {
    failure(id, 'v2 clip 이름 / 길이 / loop 기록이 일치하지 않습니다.');
  }
  if (!validHash(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) {
    failure(id, 'v2 SHA-256 / byte length 기록이 유효하지 않습니다.');
  }
  const carrierName = kind === 'projectile' ? `${id}_moving_payload_0` : null;
  if (kind === 'projectile' && (recipe.projectile_geometry_subtree !== carrierName ||
      recipe.motion_owner !== 'battlefield')) {
    failure(id, 'v2 투사체 subtree / battlefield 이동 소유권이 일치하지 않습니다.');
  }
  if (kind !== 'projectile' && recipe.motion_owner !== 'attachment_transform') {
    failure(id, 'v2 단발 효과의 attachment_transform 소유권이 일치하지 않습니다.');
  }
  return Object.freeze({ ...base, carrierName, assetVersion: 'v2', baseUrl: VERSION_BASE.v2,
    clipName: recipe.clip.name, sha256: entry.sha256.toLowerCase(), byteLength: entry.bytes,
    runtimeFade: true, scale: 1,
    visualReviewed: entry.visual_reviewed === true && recipe.visual_reviewed === true,
    reviewStatus: typeof recipe.review_status === 'string' ? recipe.review_status : 'unspecified' });
}

/**
 * Display-only, per-effect selection for the six existing MG/cannon bindings.
 * v1 remains the default. An explicit v2 preference enables prototype runtime
 * testing even when visualReviewed=false; the returned review metadata does not
 * claim art approval. Invalid/missing v2 metadata falls back per effect. Actual
 * bytes, clip names/duration and carrier nodes still need loader-side checks.
 */
export function selectRuntimeAssets({ v1Catalog, v1Recipes, v2Catalog, v2Recipes,
  preferVersion = 'v1', effectVersions = {} } = {}) {
  if (!version(preferVersion)) throw new TypeError('preferVersion은 v1 또는 v2여야 합니다.');
  if (!isObject(effectVersions)) throw new TypeError('effectVersions는 effect ID별 버전 객체여야 합니다.');
  // A valid complete v1 set is always required so fallback cannot hide a broken
  // baseline or change battlefield's supported weapons.
  const bases = runtimeAssetDescriptors(v1Catalog, v1Recipes).map(descriptor => {
    const entry = v1Catalog.items.find(item => item.id === descriptor.id);
    return Object.freeze({ ...descriptor, assetVersion: 'v1', baseUrl: VERSION_BASE.v1,
      runtimeFade: false, scale: 1,
      ...(validHash(entry.sha256) ? { sha256: entry.sha256.toLowerCase() } : {}),
      ...(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 ? { byteLength: entry.bytes } : {}) });
  });
  const knownIds = new Set(bases.map(descriptor => descriptor.id));
  for (const [id, selected] of Object.entries(effectVersions)) {
    if (!knownIds.has(id) || !version(selected)) {
      throw new TypeError(`effectVersions의 ID / 버전이 유효하지 않습니다: ${id}`);
    }
  }
  let normalized, contractError;
  if (bases.some(base => (Object.hasOwn(effectVersions, base.id) ? effectVersions[base.id] : preferVersion) === 'v2')) {
    try { normalized = validateV2Contract(v2Catalog, v2Recipes); }
    catch (error) { contractError = error.message; }
  }
  return bases.map(base => {
    const selected = Object.hasOwn(effectVersions, base.id) ? effectVersions[base.id] : preferVersion;
    if (selected === 'v1') return base;
    try {
      if (contractError) throw new Error(contractError);
      return v2Descriptor(base, v2Catalog, normalized);
    } catch (error) {
      return Object.freeze({ ...base, fallbackReason: `v2 선택 실패: ${error.message}` });
    }
  });
}

/**
 * Evaluate node extras.runtime_fade in clip seconds, matching the v2 viewer's
 * triangular fade. opacity is the evaluated multiplier (before base material
 * opacity). This does not advance animation or establish projectile lifetime.
 */
export function fadeAtTime(recipe, seconds) {
  if (!isObject(recipe) || !Number.isFinite(seconds)) {
    throw new TypeError('runtime_fade와 유한한 seconds가 필요합니다.');
  }
  const { start, peak, end } = recipe, maximum = recipe.opacity ?? 1;
  if (![start, peak, end, maximum].every(Number.isFinite) ||
      start < 0 || peak < start || end < peak || maximum < 0 || maximum > 1) {
    throw new TypeError('runtime_fade는 0≤start≤peak≤end와 0..1 opacity가 필요합니다.');
  }
  const amount = seconds < start || seconds >= end ? 0 : seconds < peak
    ? (seconds - start) / Math.max(peak - start, .00001)
    : (end - seconds) / Math.max(end - peak, .00001);
  return { start, peak, end, opacity: maximum * Math.max(0, Math.min(1, amount)) };
}
