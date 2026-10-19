/**
 * Display contract only. Battlefield owns shots, contacts, damage and ownership.
 * The other four mappings describe existing art; they do not implement weapons.
 */
const mapping = (muzzle, projectile, hit, runtimeSupported = false, delivery = 'projectile') =>
  Object.freeze({ muzzle, projectile, hit, runtimeSupported, delivery });

export const WEAPON_VFX = Object.freeze({
  '01-machine-gun': mapping('machine-gun-muzzle', 'machine-gun-projectile', 'machine-gun-hit', true),
  '02-deck-cannon': mapping('cannon-muzzle', 'cannon-projectile', 'cannon-hit', true),
  '03-mortar': mapping('mortar-launch', 'mortar-projectile', 'mortar-hit'),
  '04-harpoon': mapping('harpoon-launch', 'harpoon-projectile', 'harpoon-hit'),
  '05-chain-shot': mapping('chain-shot-launch', 'chain-shot-projectile', 'chain-shot-hit'),
  '06-flamethrower': mapping('flamethrower-ignite', 'flamethrower-stream', 'flamethrower-hit', false, 'cone'),
});

export const RUNTIME_WEAPON_IDS = Object.freeze(Object.keys(WEAPON_VFX).filter(id => WEAPON_VFX[id].runtimeSupported));
export const DEFAULT_PROJECTILE_HEIGHT = 1.3;

/** Active shots plus a bounded recent terminal receipt window, never a history of the voyage. */
export function createShotReceipts(capacity = 2048) {
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Invalid projectile receipt capacity');
  const active = new Set(), ended = new Set();
  return {
    hasFired(id) { return active.has(id); },
    hasEnded(id) { return ended.has(id); },
    start(id) { if (active.has(id) || ended.has(id)) return false; active.add(id); return true; },
    end(id) {
      active.delete(id); ended.add(id);
      while (ended.size > capacity) ended.delete(ended.values().next().value);
    },
    reset() { active.clear(); ended.clear(); },
    get activeCount() { return active.size; },
    get terminalCount() { return ended.size; },
    capacity,
  };
}

export function getWeaponVfx(weaponId) {
  return Object.hasOwn(WEAPON_VFX, weaponId) ? WEAPON_VFX[weaponId] : null;
}

export function projectileCarrierName(effectId) {
  return `${effectId}_projectile_carrier_0`;
}

/** Validate catalog/recipe agreement before loading only the six supported GLBs. */
export function runtimeAssetDescriptors(catalog, recipes) {
  if (!Array.isArray(catalog?.items) || !Array.isArray(recipes?.effects) || !recipes?.integration_contract) {
    throw new Error('전투 VFX catalog.items / recipes.effects / integration_contract가 필요합니다.');
  }
  const result = [];
  for (const weaponId of RUNTIME_WEAPON_IDS) {
    for (const kind of ['muzzle', 'projectile', 'hit']) {
      const id = WEAPON_VFX[weaponId][kind];
      const entries = catalog.items.filter(item => item.id === id);
      const rules = recipes.effects.filter(item => item.id === id);
      if (entries.length !== 1 || rules.length !== 1) throw new Error(`전투 VFX 기록이 누락되거나 중복되었습니다: ${id}`);
      const entry = entries[0], recipe = rules[0];
      if (entry.weapon_id !== weaponId || recipe.weapon_id !== weaponId || entry.model !== recipe.model ||
          !/^assets\/[a-z0-9-]+\.glb$/.test(entry.model) || entry.loop !== false || recipe.loop !== false ||
          !Number.isFinite(entry.duration) || entry.duration <= 0) {
        throw new Error(`전투 VFX 카탈로그와 레시피가 일치하지 않습니다: ${id}`);
      }
      const expectedMode = kind === 'hit' ? 'impact-surface' : kind === 'muzzle' ? 'muzzle' : 'projectile';
      if (recipe.attachment?.mode !== expectedMode) throw new Error(`전투 VFX 부착 규격이 다릅니다: ${id}`);
      result.push(Object.freeze({ id, weaponId, kind, model: entry.model, catalogDuration: entry.duration,
        carrierName: kind === 'projectile' ? projectileCarrierName(id) : null,
        endCondition: recipe.semantic_end_condition }));
    }
  }
  return result;
}

/** seq is independent of the caller's audio/UI cursor. Reset at retry. */
export function createEventCursor() {
  let sequence = 0;
  return {
    take(events = []) {
      if (!Array.isArray(events)) throw new TypeError('VFX events는 배열이어야 합니다.');
      const pending = events.filter(event => Number.isSafeInteger(event?.seq) && event.seq > sequence)
        .slice().sort((a, b) => a.seq - b.seq);
      const accepted = [];
      for (const event of pending) {
        if (event.seq <= sequence) continue;
        sequence = event.seq;
        accepted.push(event);
      }
      return accepted;
    },
    reset() { sequence = 0; },
    get sequence() { return sequence; },
  };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = vector => {
  const length = Math.hypot(...vector);
  return length > 1e-8 ? vector.map(value => value / length) : null;
};
const vector = value => value && [value.x, value.y, value.z].every(Number.isFinite) ? [value.x, value.y, value.z] : null;
const stableTangent = normal => {
  const candidate = Math.abs(normal[2]) < .9 ? [0, 0, 1] : [1, 0, 0];
  const along = dot(candidate, normal);
  return normalize(candidate.map((value, i) => value - normal[i] * along));
};

/** +Z follows actual travel; +Y is a stable perpendicular up direction. */
export function flightBasis(direction) {
  const forward = normalize(vector(direction) || [0, 0, 1]) || [0, 0, 1];
  const referenceUp = Math.abs(forward[1]) < .99 ? [0, 1, 0] : [1, 0, 0];
  const right = normalize(cross(referenceUp, forward));
  return { right, up: normalize(cross(forward, right)), forward };
}

/** +Y is the contact normal, +Z is incoming direction projected onto the surface. */
export function impactBasis(normal, direction) {
  const up = normalize(vector(normal) || []);
  if (!up) throw new Error('명중 VFX에는 실제 접촉의 유한한 단위 법선 방향이 필요합니다.');
  const incoming = vector(direction) || [0, 0, 1];
  const along = dot(incoming, up);
  const forward = normalize(incoming.map((value, i) => value - up[i] * along)) || stableTangent(up);
  return { right: normalize(cross(up, forward)), up, forward };
}

/** The display never integrates velocity or uses a GLB timeline as shot lifetime. */
export function projectilePose(projectile, fireEvent = {}) {
  if (!Number.isFinite(projectile?.x) || !Number.isFinite(projectile?.z)) {
    throw new Error('투사체 VFX에는 battlefield의 유한한 x/z 좌표가 필요합니다.');
  }
  const velocity = { x: Number.isFinite(projectile.vx) ? projectile.vx : 0,
    y: Number.isFinite(projectile.vy) ? projectile.vy : 0,
    z: Number.isFinite(projectile.vz) ? projectile.vz : 0 };
  const moving = Math.hypot(velocity.x, velocity.y, velocity.z) > 1e-8;
  return { position: [projectile.x, Number.isFinite(projectile.y) ? projectile.y :
    Number.isFinite(fireEvent.y) ? fireEvent.y : DEFAULT_PROJECTILE_HEIGHT, projectile.z],
    basis: flightBasis(moving ? velocity : fireEvent.direction) };
}
