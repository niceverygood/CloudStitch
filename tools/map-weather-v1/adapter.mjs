/** Weather ports. Production uses createAuthoritativeWeatherPort below.
 * createWeatherController/createWeatherAdapter and its proposal consumer are
 * preserved isolated prototype fixtures, including their resource extensions.
 */
import { createWeatherState, createWeatherEnvironment, stepWeather, resetWeather, sampleWeather, snapshotWeather, WEATHER_VERSION, WEATHER_ZONES, WEATHER_TUNING } from './sim.mjs';
const copy = value => JSON.parse(JSON.stringify(value));

/** Isolated prototype fixture; production must use the authoritative port. */
export function createWeatherController(options = {}) {
  const state = createWeatherState(options);
  let observer = { x: -62, y: 10, z: 0 }, disposed = false, lastSeq = 0, lastFrameId = -1;
  function assertLive() { if (disposed) throw new Error('Weather controller disposed'); }
  function read(position = observer) {
    const sample = sampleWeather(state, position);
    return { version: WEATHER_VERSION, generation: state.generation, seq: state.seq, time: state.time, paused: state.paused, player: copy(state.player), ...sample };
  }
  function sampleAt(position, time = state.time) {
    assertLive();
    // Sampling cannot advance the clock, replay pulses, or create a second timeline.
    if (Math.abs(time - state.time) > 1e-7) throw new RangeError('sampleAt time must equal the controller time; call update once to advance');
    return read(position);
  }
  function update(dt, position = observer, { frameId, preheat = false } = {}) {
    assertLive();
    if (frameId !== undefined && (!Number.isSafeInteger(frameId) || frameId < 0)) throw new RangeError('frameId must be a monotonic nonnegative integer');
    if (frameId !== undefined && frameId <= lastFrameId) return { ...read(position), proposals: [], events: [], duplicateFrame: true };
    if (frameId !== undefined) lastFrameId = frameId;
    observer = { x: position.x, y: position.y ?? 8, z: position.z };
    stepWeather(state, { position: observer, preheat }, dt);
    const fresh = state.events.filter(e => e.seq > lastSeq);
    if (fresh.length) lastSeq = fresh.at(-1).seq;
    const proposals = fresh.filter(e => e.type === 'environment-damage-proposal').map(e => ({ id: `${state.generation}:${e.seq}`, pulseId: e.pulseId, generation: state.generation, seq: e.seq, type: 'environment-damage', source: e.source, zone: e.zone, damage: e.damage, position: copy(e.position), time: e.time }));
    return { ...read(position), proposals, events: copy(fresh) };
  }
  return {
    get state() { return snapshotWeather(state); },
    get time() { return state.time; },
    sampleAt, update,
    advance(dt, input = {}) {
      assertLive();
      if (input.paused !== undefined) state.paused = Boolean(input.paused);
      return update(dt, input.position || observer, { frameId: input.frameId, preheat: input.preheat });
    },
    pause(value = true) { assertLive(); state.paused = Boolean(value); return read(); },
    reset() { assertLive(); resetWeather(state); observer = { x: -62, y: 10, z: 0 }; lastSeq = 0; lastFrameId = -1; return read(); },
    dispose() { disposed = true; state.events.length = 0; },
  };
}

/** Prototype fixture inbox; not the authoritative port's final-pose pulse inbox.
 * Receipts are scoped to generation and bounded. An older generation is rejected.
 */
export function createWeatherProposalConsumer() {
  let generation = 0, lastFrameSeq = -1, lastDamageSeq = -1;
  return {
    consume(frame) {
      if (!frame || !Number.isInteger(frame.generation) || frame.generation < generation) return [];
      if (frame.generation > generation) { generation = frame.generation; lastFrameSeq = lastDamageSeq = -1; }
      if (frame.seq <= lastFrameSeq) return [];
      const fresh = [];
      for (const p of [...(frame.proposals || [])].sort((a, b) => a.seq - b.seq)) {
        if (p.generation !== generation || p.seq <= lastDamageSeq) continue;
        lastDamageSeq = p.seq; fresh.push(copy(p));
      }
      lastFrameSeq = frame.seq;
      return fresh;
    },
    reset() { generation = 0; lastFrameSeq = lastDamageSeq = -1; },
  };
}
export const createWeatherAdapter = createWeatherController;

const zonesById = Object.fromEntries(WEATHER_ZONES.map(z => [z.id, z]));
function phaseAtAbsoluteTime(time, lengths, names) {
  const duration = lengths.reduce((a, b) => a + b, 0);
  const cycleIndex = Math.floor((time + 1e-10) / duration);
  let phaseTime = Math.max(0, time - cycleIndex * duration);
  for (let i = 0; i < lengths.length; i++) {
    if (phaseTime < lengths[i] - 1e-10 || i === lengths.length - 1) return { phase: names[i], phaseTime, progress: Math.max(0, Math.min(1, phaseTime / lengths[i])), remaining: Math.max(0, lengths[i] - phaseTime), cycleIndex };
    phaseTime -= lengths[i];
  }
}
const isInsideZone = (zone, p) => p.y >= zone.minY && p.y <= zone.maxY && (zone.halfX ? Math.abs(p.x - zone.center.x) <= zone.halfX && Math.abs(p.z - zone.center.z) <= zone.halfZ : Math.hypot(p.x - zone.center.x, p.z - zone.center.z) <= zone.radius);
function observerCopy(player = {}) {
  const result = {};
  // These are observations, never authority-owned values or integrated state.
  for (const key of ['x', 'y', 'z', 'icing', 'heat', 'hidden', 'lock', 'preheating', 'speedMultiplier', 'accelerationMultiplier']) if (player[key] !== undefined) result[key] = player[key];
  return { x: 0, y: 8, z: 0, icing: 0, heat: 100, ...result };
}

/** Production port for the battlefield's single clock/movement/resource/HP authority.
 * advance accepts the authoritative absolute time, frame and observed extensions.
 * It never integrates dt, coordinates, heat, ice, lock, or HP. Damage is an
 * unfiltered geometry proposal; the battlefield checks the final pose and keeps
 * pulseId receipts. Thermal repeats a pulse proposal through its active interval
 * so entering a visible beam late still works. No proposal means no damage.
 */
export function createAuthoritativeWeatherPort(options = {}) {
  let state, lastFrame = -1, lastTime, disposed = false, lightningTargetCycle = -1;
  let lightningPulse, thermalPulse;
  const seed = options.seed;
  function assertLive() { if (disposed) throw new Error('Weather authority port disposed'); }
  function initialize(generation, time = 0, player) {
    state = createWeatherEnvironment({ seed }); state.generation = generation; state.time = time;
    state.player = observerCopy(player); lastFrame = -1; lastTime = undefined;
    lightningTargetCycle = -1; lightningPulse = thermalPulse = undefined;
    state.weather = recordPhases(time, state.player);
  }
  initialize(options.generation ?? 0, options.time ?? 0, options.player);
  function emit(type, zone, extra = {}) {
    const e = { generation: state.generation, id: ++state.seq, seq: state.seq, time: state.time, type, zone, ...extra };
    state.events.push(e); if (state.events.length > WEATHER_TUNING.eventLimit) state.events.shift(); return e;
  }
  function recordPhases(time, player, freeze = false) {
    const weather = copy(state.weather);
    for (const zone of WEATHER_ZONES) Object.assign(weather[zone.id], { inside: isInsideZone(zone, player), active: isInsideZone(zone, player), strength: isInsideZone(zone, player) ? 1 : 0, status: isInsideZone(zone, player) ? 'inside' : 'outside' });
    const l = weather.lightning, t = weather.thermal;
    Object.assign(l, phaseAtAbsoluteTime(time, [.4, 2.6, 1 / 6, 29 / 6], ['calm', 'warning', 'strike', 'recovery']));
    Object.assign(t, phaseAtAbsoluteTime(time, [.8, 2.4, .9, 2.1], ['calm', 'warning', 'burst', 'recovery']));
    const warningHasBegun = time >= l.cycleIndex * 8 + .4 - 1e-10;
    if (lightningTargetCycle !== l.cycleIndex) {
      l.target = { ...zonesById.lightning.center };
      if (freeze && warningHasBegun) {
        l.target = l.inside ? { x: player.x, y: player.y, z: player.z } : { ...zonesById.lightning.center };
        lightningTargetCycle = l.cycleIndex;
      }
    }
    l.status = l.phase; l.warning = l.phase === 'warning'; l.striking = l.phase === 'strike';
    t.jetIndex = t.cycleIndex % t.lanes.length; t.status = t.phase; t.warning = t.phase === 'warning'; t.burst = t.phase === 'burst';
    return weather;
  }
  function geometry(source, weather) {
    if (source === 'lightning-strike') {
      const l = weather.lightning;
      return { type: 'circle', x: l.target.x, z: l.target.z, radius: l.strikeRadius, minY: zonesById.lightning.minY, maxY: zonesById.lightning.maxY };
    }
    const lane = weather.thermal.lanes[weather.thermal.jetIndex];
    return { type: 'box', x: lane.x, z: lane.z, halfX: lane.halfLength, halfZ: lane.halfWidth, minY: lane.minY, maxY: lane.maxY };
  }
  function sampleAt(position = state.player, time = state.time) {
    assertLive(); if (!Number.isFinite(time) || time < 0) throw new RangeError('Weather sample time must be finite and nonnegative');
    const player = observerCopy({ ...state.player, ...position }), weather = recordPhases(time, player);
    const sample = sampleWeather({ ...state, time, player, weather }, player);
    // Resource rates are proposals. The authority decides whether preheat can run.
    sample.heat = { ...sample.heat, regen: WEATHER_TUNING.heatRegen, consumption: WEATHER_TUNING.preheatUse };
    return { ...sample, generation: state.generation, seq: state.seq, time, paused: state.paused, weather, player };
  }
  function snapshot() {
    assertLive();
    const out = { version: `${WEATHER_VERSION}-authority`, generation: state.generation, seq: state.seq, frame: lastFrame, time: state.time, paused: state.paused, weather: copy(state.weather), player: copy(state.player), events: copy(state.events) };
    for (const w of Object.values(out.weather)) delete w._phaseKey;
    return out;
  }
  function advance(args = {}) {
    assertLive();
    const { generation = state.generation, frame, time, dt = 0, player = state.player, input = {} } = args;
    if (!Number.isSafeInteger(generation) || generation < 0 || !Number.isSafeInteger(frame) || frame < 0) throw new RangeError('generation/frame must be nonnegative integers');
    if (!Number.isFinite(time) || time < 0 || !Number.isFinite(dt) || dt < 0) throw new RangeError('time/dt must be finite and nonnegative');
    if (generation < state.generation) return { ...sampleAt(), proposals: [], hazards: [], events: [], staleGeneration: true };
    if (generation > state.generation) initialize(generation, 0, player);
    if (frame <= lastFrame) return { ...sampleAt(), proposals: [], hazards: [], events: [], duplicateFrame: true };
    if (lastTime !== undefined && time < lastTime - 1e-10) return { ...sampleAt(), proposals: [], hazards: [], events: [], staleTime: true };
    lastFrame = frame;
    if (args.paused !== undefined) state.paused = Boolean(args.paused);
    if (state.paused) return { ...sampleAt(), proposals: [], hazards: [], events: [] };
    const previousWeather = state.weather, oldSeq = state.seq, previousTime = lastTime;
    state.time = time; state.player = observerCopy(player);
    state.input = { preheat: Boolean(input.preheat) }; // observation only, no resource effect
    state.weather = recordPhases(time, state.player, true);
    const l = state.weather.lightning, t = state.weather.thermal;
    if (l.phase === 'warning' && (previousWeather.lightning.phase !== 'warning' || previousWeather.lightning.cycleIndex !== l.cycleIndex)) emit('lightning-warning', 'lightning', { position: { ...l.target }, duration: l.remaining, radius: l.strikeRadius });
    if (t.phase === 'warning' && (previousWeather.thermal.phase !== 'warning' || previousWeather.thermal.cycleIndex !== t.cycleIndex)) emit('thermal-warning', 'thermal', { laneIndex: t.jetIndex, duration: t.remaining });
    const strikeAt = l.cycleIndex * 8 + 3;
    const crossedStrike = previousTime !== undefined && previousTime < strikeAt - 1e-10 && time >= strikeAt - 1e-10;
    const proposals = [];
    if ((l.phase === 'strike' || crossedStrike) && lightningPulse?.pulseId !== `${generation}:lightning:${l.cycleIndex}`) {
      const e = emit('lightning-strike', 'lightning', { position: { ...l.target }, radius: l.strikeRadius });
      l.strikeSerial = (l.strikeSerial || 0) + 1;
      lightningPulse = { generation, seq: e.seq, pulseId: `${generation}:lightning:${l.cycleIndex}`, type: 'environment-damage', source: 'lightning-strike', zone: 'lightning', damage: WEATHER_TUNING.lightningDamage, shape: geometry('lightning-strike', state.weather), time: strikeAt };
      proposals.push(copy(lightningPulse));
    }
    if (t.phase === 'burst') {
      const pulseId = `${generation}:thermal:${t.cycleIndex}`;
      if (thermalPulse?.pulseId !== pulseId) {
        const e = emit('thermal-burst', 'thermal', { laneIndex: t.jetIndex }); t.burstSerial = (t.burstSerial || 0) + 1;
        thermalPulse = { generation, seq: e.seq, pulseId, type: 'environment-damage', source: 'thermal-burst', zone: 'thermal', damage: WEATHER_TUNING.thermalDamage, shape: geometry('thermal-burst', state.weather), time: t.cycleIndex * 6.2 + 3.2 };
      }
      proposals.push(copy(thermalPulse));
    }
    lastTime = time;
    return { ...sampleAt(), proposals, hazards: copy(proposals), events: copy(state.events.filter(e => e.seq > oldSeq)) };
  }
  function reset(args = {}) {
    assertLive(); const generation = args.generation ?? state.generation + 1;
    if (!Number.isSafeInteger(generation) || generation <= state.generation) throw new RangeError('reset generation must increase');
    if (args.time !== undefined && (!Number.isFinite(args.time) || args.time < 0)) throw new RangeError('reset time must be finite and nonnegative');
    initialize(generation, args.time ?? 0, args.player); state.weather = recordPhases(state.time, state.player); return snapshot();
  }
  return { advance, sampleAt, snapshot, reset,
    pause(value = true) { assertLive(); state.paused = Boolean(value); return snapshot(); },
    dispose() { disposed = true; state.events.length = 0; lightningPulse = thermalPulse = undefined; },
  };
}
