/** Cloudstitch weather slice. All numbers are prototype tunings, not game canon.
 * X/Z is the navigation plane; +Y is altitude. No renderer or external I/O.
 */
export const WEATHER_VERSION = 'map-weather-prototype-1';
export const WEATHER_STEP = 1 / 120;
export const WEATHER_BOUNDS = Object.freeze({ minX: -72, maxX: 72, minZ: -49, maxZ: 49, minY: 3, maxY: 34 });
export const WEATHER_TUNING = Object.freeze({ maxHp: 100, maxSpeed: 11, acceleration: 12, liftSpeed: 4, updraftAcceleration: 8, updraftSpeed: 9, crosswindForce: 6, icingRate: .12, icingThaw: .025, preheatThaw: .42, preheatUse: 25, heatRegen: 12, lightningDamage: 24, lightningRadius: 5.4, thermalDamage: 15, eventLimit: 80 });
const zone = (id, label, x, z, radius, extra = {}) => Object.freeze({ id, label, center: Object.freeze({ x, y: 8, z }), radius, minY: 3, maxY: 27, ...extra });
export const WEATHER_ZONES = Object.freeze([
  zone('cloud', '구름 은폐', -45, -24, 14),
  zone('updraft', '상승기류', 0, -24, 12, { maxY: 34 }),
  zone('crosswind', '횡풍', 45, -24, 15, { direction: Object.freeze({ x: 0, y: 0, z: 1 }) }),
  zone('lightning', '낙뢰 예고', -45, 24, 17, { maxY: 30 }),
  zone('icing', '착빙과 예열', 0, 24, 14),
  zone('thermal', '열풍 통로', 45, 24, 18, { minY: 4, maxY: 13, halfX: 14, halfZ: 10 }),
]);
const Z = Object.fromEntries(WEATHER_ZONES.map(z => [z.id, z]));
const copy = value => JSON.parse(JSON.stringify(value));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const inZone = (z, p) => p.y >= z.minY && p.y <= z.maxY && (z.halfX ? Math.abs(p.x - z.center.x) <= z.halfX && Math.abs(p.z - z.center.z) <= z.halfZ : Math.hypot(p.x - z.center.x, p.z - z.center.z) <= z.radius);
const validPosition = p => ({ x: finite(p?.x), y: finite(p?.y, 8), z: finite(p?.z) });
function event(state, type, zoneId, extra = {}) {
  const entry = { id: ++state.seq, seq: state.seq, generation: state.generation, type, zone: zoneId, time: state.time, ...extra };
  state.events.push(entry);
  if (state.events.length > WEATHER_TUNING.eventLimit) state.events.splice(0, state.events.length - WEATHER_TUNING.eventLimit);
  return entry;
}
function phaseAt(tick, lengths, names) {
  const total = lengths.reduce((a, b) => a + b, 0), cycleIndex = Math.floor(tick / total);
  let offset = tick % total;
  for (let i = 0; i < lengths.length; i++) {
    if (offset < lengths[i]) return { phase: names[i], progress: offset / lengths[i], remaining: (lengths[i] - offset) * WEATHER_STEP, phaseTime: offset * WEATHER_STEP, cycleIndex };
    offset -= lengths[i];
  }
}
function weatherRecords() {
  const records = Object.fromEntries(WEATHER_ZONES.map(z => [z.id, { id: z.id, active: false, inside: false, strength: 0, status: 'outside' }]));
  Object.assign(records.lightning, { phase: 'calm', progress: 0, remaining: .4, phaseTime: 0, cycle: 8, cycleIndex: 0, warningDuration: 2.6, strikeRadius: WEATHER_TUNING.lightningRadius, strikeSerial: 0, target: { ...Z.lightning.center }, _phaseKey: '' });
  Object.assign(records.thermal, { phase: 'calm', progress: 0, remaining: .8, phaseTime: 0, cycle: 6.2, cycleIndex: 0, warningDuration: 2.4, jetIndex: 0, burstSerial: 0, _phaseKey: '', lanes: [18, 24, 30].map(z => ({ x: 45, y: 8, z, halfLength: 14, halfWidth: 1.7, minY: 4, maxY: 13 })) });
  return records;
}
/** Environment-only state: no actor position, HP, movement, or collision authority. */
export function createWeatherEnvironment({ seed = 9173 } = {}) {
  return { version: WEATHER_VERSION, seed: finite(seed, 9173) >>> 0, generation: 1, seq: 0, tick: 0, time: 0, paused: false, accumulator: 0, events: [], weather: weatherRecords() };
}
export function resetWeatherEnvironment(state) {
  const next = createWeatherEnvironment({ seed: state.seed });
  next.generation = (state.generation || 0) + 1;
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, next);
  return state;
}
function environmentTick(state, observer) {
  state.tick += 1; state.time = state.tick * WEATHER_STEP;
  const p = validPosition(observer), w = state.weather;
  for (const z of WEATHER_ZONES) {
    const r = w[z.id]; r.inside = inZone(z, p); r.active = r.inside; r.strength = r.inside ? 1 : 0; r.status = r.inside ? 'inside' : 'outside';
  }
  const lightning = w.lightning;
  Object.assign(lightning, phaseAt(state.tick, [48, 312, 20, 580], ['calm', 'warning', 'strike', 'recovery']));
  const lk = `${lightning.cycleIndex}:${lightning.phase}`;
  if (lk !== lightning._phaseKey) {
    lightning._phaseKey = lk;
    if (lightning.phase === 'warning') {
      // Freeze once. Evasion after this tell never moves the aim marker.
      lightning.target = lightning.inside ? { ...p } : { ...Z.lightning.center };
      event(state, 'lightning-warning', 'lightning', { position: { ...lightning.target }, radius: lightning.strikeRadius, duration: lightning.warningDuration });
    } else if (lightning.phase === 'strike') {
      lightning.strikeSerial += 1;
      event(state, 'lightning-strike', 'lightning', { position: { ...lightning.target }, radius: lightning.strikeRadius, minY: Z.lightning.minY, maxY: Z.lightning.maxY, damage: WEATHER_TUNING.lightningDamage });
    }
  }
  lightning.warning = lightning.phase === 'warning'; lightning.striking = lightning.phase === 'strike'; lightning.status = lightning.phase;
  const thermal = w.thermal;
  Object.assign(thermal, phaseAt(state.tick, [96, 288, 108, 252], ['calm', 'warning', 'burst', 'recovery']));
  thermal.jetIndex = thermal.cycleIndex % thermal.lanes.length;
  const tk = `${thermal.cycleIndex}:${thermal.phase}`;
  if (tk !== thermal._phaseKey) {
    thermal._phaseKey = tk;
    const lane = thermal.lanes[thermal.jetIndex];
    if (thermal.phase === 'warning') event(state, 'thermal-warning', 'thermal', { laneIndex: thermal.jetIndex, position: { x: lane.x, y: lane.y, z: lane.z }, duration: thermal.warningDuration });
    if (thermal.phase === 'burst') {
      thermal.burstSerial += 1;
      event(state, 'thermal-burst', 'thermal', { laneIndex: thermal.jetIndex, position: { x: lane.x, y: lane.y, z: lane.z }, halfLength: lane.halfLength, halfWidth: lane.halfWidth, minY: lane.minY, maxY: lane.maxY, damage: WEATHER_TUNING.thermalDamage });
    }
  }
  thermal.warning = thermal.phase === 'warning'; thermal.burst = thermal.phase === 'burst'; thermal.status = thermal.phase;
}
function accumulate(state, dt, tick) {
  if (state.paused || !Number.isFinite(dt) || dt <= 0) return state;
  state.accumulator += Math.min(dt, .1);
  while (state.accumulator + 1e-10 >= WEATHER_STEP) {
    state.accumulator -= WEATHER_STEP;
    if (Math.abs(state.accumulator) < 1e-10) state.accumulator = 0;
    tick();
  }
  return state;
}
/** Advance the environment clock only. Position is a read-only observer for tells. */
export function advanceWeatherEnvironment(state, dt, observer = Z.lightning.center) {
  return accumulate(state, dt, () => environmentTick(state, observer));
}
export function weatherEventHits(entry, position) {
  const p = validPosition(position);
  if (entry.type === 'lightning-strike') return p.y >= entry.minY && p.y <= entry.maxY && Math.hypot(p.x - entry.position.x, p.z - entry.position.z) <= entry.radius;
  if (entry.type === 'thermal-burst') return p.y >= entry.minY && p.y <= entry.maxY && Math.abs(p.x - entry.position.x) <= entry.halfLength && Math.abs(p.z - entry.position.z) <= entry.halfWidth;
  return false;
}
/** Pure spatial read usable by a different movement/damage authority. */
export function sampleWeather(state, position = state.player) {
  const p = validPosition(position), inside = Object.fromEntries(WEATHER_ZONES.map(z => [z.id, inZone(z, p)]));
  const ice = clamp(finite(position?.icing, finite(state.player?.icing)), 0, 1), l = state.weather.lightning, t = state.weather.thermal;
  const lane = t.lanes[t.jetIndex], thermalInside = p.y >= lane.minY && p.y <= lane.maxY && Math.abs(p.x - lane.x) <= lane.halfLength && Math.abs(p.z - lane.z) <= lane.halfWidth;
  return {
    inside, visibility: inside.cloud ? 0 : 1, hidden: inside.cloud, aimLockAllowed: !inside.cloud,
    wind: { x: 0, y: inside.updraft ? WEATHER_TUNING.updraftAcceleration : 0, z: inside.crosswind ? WEATHER_TUNING.crosswindForce : 0 },
    updraft: inside.updraft ? WEATHER_TUNING.updraftAcceleration : 0,
    icing: { rate: inside.icing ? WEATHER_TUNING.icingRate : -WEATHER_TUNING.icingThaw, speedMultiplier: 1 - .62 * ice, accelerationMultiplier: 1 - .68 * ice },
    heat: { regeneration: WEATHER_TUNING.heatRegen, preheatConsumption: WEATHER_TUNING.preheatUse, thaw: WEATHER_TUNING.preheatThaw },
    lightningWarnings: l.phase === 'warning' ? [{ id: `${state.generation}:lightning:${l.cycleIndex}`, position: { ...l.target }, radius: l.strikeRadius, eta: l.remaining }] : [],
    thermal: { phase: t.phase, jetIndex: t.jetIndex, remaining: t.remaining, inside: thermalInside, footprint: { ...lane } },
    hazards: [ ...(l.phase === 'strike' ? [{ type: 'lightning', position: { ...l.target }, radius: l.strikeRadius }] : []), ...(t.phase === 'burst' ? [{ type: 'thermal', ...lane }] : []) ],
  };
}
export function createWeatherState(options = {}) {
  const state = createWeatherEnvironment(options);
  // Position is an observer snapshot supplied by the game's existing movement
  // authority. Weather owns only the environmental extension fields below.
  state.player = { x: -62, y: 10, z: 0, icing: 0, heat: 100, hidden: false, lock: 1, preheating: false, speedMultiplier: 1, accelerationMultiplier: 1 };
  state._lightningDamageCycle = -1; state._thermalDamageCycle = -1;
  return state;
}
export function resetWeather(state) {
  const generation = (state.generation || 0) + 1, seed = state.seed;
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, createWeatherState({ seed })); state.generation = generation;
  return state;
}
function extensionTick(state, input) {
  const p = state.player, dt = WEATHER_STEP, sample = sampleWeather(state, p);
  p.preheating = Boolean(input.preheat) && p.heat > .5;
  p.heat = clamp(p.heat + (p.preheating ? -WEATHER_TUNING.preheatUse : WEATHER_TUNING.heatRegen) * dt, 0, 100);
  p.icing = clamp(p.icing + (sample.icing.rate - (p.preheating ? WEATHER_TUNING.preheatThaw : 0)) * dt, 0, 1);
  p.speedMultiplier = 1 - .62 * p.icing; p.accelerationMultiplier = 1 - .68 * p.icing;
  const wasHidden = p.hidden;
  p.hidden = sample.hidden; p.lock = p.hidden ? 0 : clamp(p.lock + dt / 1.5, 0, 1);
  if (p.hidden !== wasHidden) event(state, p.hidden ? 'conceal-enter' : 'conceal-exit', 'cloud', { position: { x: p.x, y: p.y, z: p.z } });
  environmentTick(state, p);
  const l = state.weather.lightning, t = state.weather.thermal, lane = t.lanes[t.jetIndex];
  const lightningPulse = { type: 'lightning-strike', position: l.target, radius: l.strikeRadius, minY: Z.lightning.minY, maxY: Z.lightning.maxY };
  if (l.phase === 'strike' && state._lightningDamageCycle !== l.cycleIndex && weatherEventHits(lightningPulse, p)) {
    state._lightningDamageCycle = l.cycleIndex;
    event(state, 'environment-damage-proposal', 'lightning', { source: 'lightning-strike', pulseId: `${state.generation}:lightning:${l.cycleIndex}`, damage: WEATHER_TUNING.lightningDamage, position: { ...l.target } });
  }
  const thermalPulse = { type: 'thermal-burst', position: lane, halfLength: lane.halfLength, halfWidth: lane.halfWidth, minY: lane.minY, maxY: lane.maxY };
  if (t.phase === 'burst' && state._thermalDamageCycle !== t.cycleIndex && weatherEventHits(thermalPulse, p)) {
    state._thermalDamageCycle = t.cycleIndex;
    event(state, 'environment-damage-proposal', 'thermal', { source: 'thermal-burst', pulseId: `${state.generation}:thermal:${t.cycleIndex}`, damage: WEATHER_TUNING.thermalDamage, position: { x: lane.x, y: lane.y, z: lane.z } });
  }
}
/** Advance weather extensions only. The observer position is never integrated.
 * The movement/HP authority supplies input.position and applies sample/proposals.
 */
export function stepWeather(state, input = {}, dt = 0) {
  if (state.paused || !Number.isFinite(dt) || dt <= 0) return state;
  if (input.position) Object.assign(state.player, validPosition(input.position));
  return accumulate(state, dt, () => extensionTick(state, input));
}
/** Observer fixture for tests/review only; never teleports the external actor. */
export function warpWeather(state, id, options = {}) {
  const z = Z[id]; if (!z) throw new Error(`Unknown weather zone: ${id}`);
  const defaultPosition = id === 'thermal' ? { x: 45, y: 8, z: 14 } : { ...z.center };
  const position = options.position || (options.center ? z.center : defaultPosition), p = state.player;
  p.x = clamp(finite(position.x, z.center.x), WEATHER_BOUNDS.minX, WEATHER_BOUNDS.maxX);
  p.y = clamp(finite(position.y, z.center.y), WEATHER_BOUNDS.minY, WEATHER_BOUNDS.maxY);
  p.z = clamp(finite(position.z, z.center.z), WEATHER_BOUNDS.minZ, WEATHER_BOUNDS.maxZ);
  p.hidden = inZone(Z.cloud, p); p.lock = p.hidden ? 0 : 1;
  for (const zone of WEATHER_ZONES) { const r = state.weather[zone.id]; r.inside = inZone(zone, p); r.active = r.inside; r.strength = r.inside ? 1 : 0; }
  event(state, 'warp', id, { position: { x: p.x, y: p.y, z: p.z } });
  return state;
}
export function snapshotWeather(state) {
  const result = copy(state);
  delete result.accumulator; delete result._lightningDamageCycle; delete result._thermalDamageCycle;
  for (const r of Object.values(result.weather)) delete r._phaseKey;
  return result;
}
