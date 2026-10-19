import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeatherState, stepWeather, resetWeather, warpWeather, snapshotWeather, sampleWeather, WEATHER_ZONES, WEATHER_TUNING, weatherEventHits } from './sim.mjs';
import { createWeatherController, createWeatherProposalConsumer, createAuthoritativeWeatherPort } from './adapter.mjs';
const at = id => ({ ...WEATHER_ZONES.find(z => z.id === id).center });
function run(state, seconds, input = {}, dt = .05) {
  const count = Math.round(seconds / dt);
  for (let i = 0; i < count; i++) stepWeather(state, input, dt);
  return state;
}
function runController(controller, seconds, position, input = {}) {
  const frames = [];
  for (let i = 0; i < Math.round(seconds / .05); i++) frames.push(controller.advance(.05, { position, ...input }));
  return frames;
}

test('cloud blocks hostile visibility/lock within volume and restores on exit', () => {
  const s = createWeatherState();
  run(s, .1, { position: at('cloud') });
  assert.equal(s.player.hidden, true); assert.equal(s.player.lock, 0);
  assert.equal(sampleWeather(s).visibility, 0); assert.equal(sampleWeather(s).aimLockAllowed, false);
  run(s, 1.6, { position: { x: -62, y: 10, z: 0 } });
  assert.equal(s.player.hidden, false); assert.equal(s.player.lock, 1);
  assert.equal(sampleWeather(s, { ...at('cloud'), y: 29 }).hidden, false);
  assert.deepEqual(s.events.filter(e => e.type.startsWith('conceal')).map(e => e.type), ['conceal-enter', 'conceal-exit']);
});

test('updraft and visible crosswind propose forces only inside their own bounds', () => {
  const s = createWeatherState();
  const rising = sampleWeather(s, at('updraft'));
  assert.equal(rising.updraft, WEATHER_TUNING.updraftAcceleration);
  assert.deepEqual(rising.wind, { x: 0, y: 8, z: 0 });
  assert.equal(sampleWeather(s, { ...at('updraft'), x: 13 }).updraft, 0);
  assert.equal(sampleWeather(s, { ...at('updraft'), y: 35 }).updraft, 0);
  assert.deepEqual(sampleWeather(s, at('crosswind')).wind, { x: 0, y: 0, z: WEATHER_TUNING.crosswindForce });
  assert.equal(sampleWeather(s, { ...at('crosswind'), z: -8 }).wind.z, 0);
  assert.equal(sampleWeather(s, { ...at('crosswind'), y: 2 }).wind.z, 0);
});

test('weather never integrates movement or applies HP; observations are copied', () => {
  const s = createWeatherState(), external = { ...at('crosswind'), hp: 100 };
  run(s, 4, { position: external, x: 1, z: 1, lift: 1 });
  assert.deepEqual(external, { ...at('crosswind'), hp: 100 });
  assert.deepEqual({ x: s.player.x, y: s.player.y, z: s.player.z }, at('crosswind'));
  assert.equal('hp' in s.player, false); assert.equal('vx' in s.player, false);
});

test('lightning locks one target for a >=2s tell and issues one bounded damage proposal', () => {
  const c = createWeatherController(), start = at('lightning');
  runController(c, .5, start);
  const target = c.state.weather.lightning.target;
  assert.deepEqual(target, start); assert.equal(c.state.weather.lightning.phase, 'warning');
  const safe = { ...start, x: start.x + 10 };
  const dodged = runController(c, 2.6, safe);
  assert.deepEqual(c.state.weather.lightning.target, target);
  assert.equal(dodged.flatMap(f => f.proposals).length, 0);
  const events = c.state.events, warning = events.find(e => e.type === 'lightning-warning'), strike = events.find(e => e.type === 'lightning-strike');
  assert.ok(strike.time - warning.time >= 2.59);
  assert.equal(events.filter(e => e.type === 'lightning-strike').length, 1);
  assert.equal(weatherEventHits(strike, start), true);
  assert.equal(weatherEventHits(strike, { ...start, y: 31 }), false);
  c.reset();
  const standing = runController(c, 3.5, start).flatMap(f => f.proposals);
  assert.equal(standing.length, 1); assert.equal(standing[0].damage, 24);
});

test('icing slows rates; held preheat thaws it while using a regenerating resource', () => {
  const s = createWeatherState();
  run(s, 5, { position: at('icing') });
  assert.ok(s.player.icing > .59); assert.ok(s.player.speedMultiplier < .64); assert.ok(s.player.accelerationMultiplier < .60);
  const iceBefore = s.player.icing;
  run(s, 1, { position: at('icing'), preheat: true });
  assert.ok(s.player.icing < iceBefore - .29); assert.ok(s.player.heat < 76); assert.equal(s.player.preheating, true);
  const heatBefore = s.player.heat;
  run(s, 1, { position: { x: -62, y: 10, z: 0 } });
  assert.ok(s.player.heat > heatBefore); assert.equal(s.player.preheating, false);
  run(s, 40, { position: at('icing'), preheat: true });
  assert.ok(s.player.heat >= 0 && s.player.heat <= 100); assert.ok(s.player.icing >= 0 && s.player.icing <= 1);
});

test('thermal warning precedes one burst pulse; gaps and altitude clear the hazard', () => {
  const c = createWeatherController(), lane = { x: 45, y: 8, z: 18 };
  const frames = runController(c, 4.5, lane), hits = frames.flatMap(f => f.proposals);
  assert.equal(hits.length, 1); assert.equal(hits[0].damage, 15);
  const warning = c.state.events.find(e => e.type === 'thermal-warning'), burst = c.state.events.find(e => e.type === 'thermal-burst');
  assert.ok(burst.time - warning.time >= 2.39);
  assert.equal(weatherEventHits(burst, { ...lane, z: 21 }), false);
  assert.equal(weatherEventHits(burst, { ...lane, y: 14 }), false);
  assert.equal(weatherEventHits(burst, { ...lane, x: 60 }), false);
  c.reset(); assert.equal(runController(c, 4.5, { ...lane, z: 21 }).flatMap(f => f.proposals).length, 0);
  c.reset(); assert.equal(runController(c, 4.5, { ...lane, y: 14 }).flatMap(f => f.proposals).length, 0);
});

test('entering a sustained thermal burst late issues one pulse, never per-frame damage', () => {
  const c = createWeatherController(), lane = { x: 45, y: 8, z: 18 }, gap = { ...lane, z: 21 };
  runController(c, 3.45, gap);
  assert.equal(c.state.weather.thermal.phase, 'burst');
  const hits = runController(c, .15, lane).flatMap(f => f.proposals);
  assert.equal(hits.length, 1); assert.equal(hits[0].damage, 15);
  runController(c, .1, gap);
  assert.equal(runController(c, .15, lane).flatMap(f => f.proposals).length, 0);
});

test('fixed-step extensions/events are identical for different dt partitions', () => {
  const a = createWeatherState({ seed: 4 }), b = createWeatherState({ seed: 4 });
  const input = { position: at('icing'), preheat: true };
  run(a, 16, input, .1); run(b, 16, input, 1 / 60);
  assert.deepEqual(snapshotWeather(a), snapshotWeather(b));
  const time = a.time; stepWeather(a, input, 99); assert.ok(a.time - time <= .10000001);
  const before = snapshotWeather(a); stepWeather(a, input, NaN); stepWeather(a, input, -1); assert.deepEqual(snapshotWeather(a), before);
});

test('pause holds clocks/resources/events, reset drops old tell and increments generation', () => {
  const s = createWeatherState(); run(s, 1, { position: at('lightning') });
  s.paused = true; const paused = snapshotWeather(s);
  run(s, 3, { position: at('icing'), preheat: true }); assert.deepEqual(snapshotWeather(s), paused);
  const generation = s.generation; resetWeather(s);
  assert.equal(s.generation, generation + 1); assert.equal(s.time, 0); assert.equal(s.events.length, 0); assert.equal(s.paused, false);
  assert.equal(s.weather.lightning.phase, 'calm'); assert.equal(s.player.icing, 0); assert.equal(s.player.heat, 100);
  assert.throws(() => warpWeather(s, 'bad'), /Unknown/);
  warpWeather(s, 'icing'); assert.deepEqual({ x: s.player.x, y: s.player.y, z: s.player.z }, at('icing'));
});

test('controller prevents duplicate clock frames; proposal consumer applies each pulse once', () => {
  const c = createWeatherController(), consumer = createWeatherProposalConsumer(), external = { ...at('lightning'), hp: 100 };
  let hitFrame;
  for (let i = 0; i < 70; i++) {
    const frame = c.advance(.05, { position: external, frameId: i });
    for (const proposal of consumer.consume(frame)) external.hp -= proposal.damage;
    if (frame.proposals.length) hitFrame = frame;
    const time = c.time, duplicate = c.advance(.05, { position: external, frameId: i });
    assert.equal(duplicate.duplicateFrame, true); assert.equal(c.time, time);
  }
  assert.equal(external.hp, 76); assert.equal(consumer.consume(hitFrame).length, 0);
  const snapshot = c.state; snapshot.player.icing = 999; assert.notEqual(c.state.player.icing, 999);
  assert.throws(() => c.sampleAt(external, 999), /controller time/);
  c.pause(); const time = c.time; c.advance(.1, { position: external }); assert.equal(c.time, time);
  c.reset(); assert.equal(c.time, 0); assert.equal(c.state.events.length, 0); assert.equal(consumer.consume(hitFrame).length, 0);
  consumer.consume(c.advance(.05, { position: external }));
  assert.equal(consumer.consume(hitFrame).length, 0);
  c.dispose(); assert.throws(() => c.advance(.1, { position: external }), /disposed/);
});

test('event history and controller receipts remain bounded across long runs', () => {
  const c = createWeatherController();
  for (let i = 0; i < 14000; i++) c.advance(.1, { position: { x: 0, y: 30, z: 0 }, frameId: i });
  assert.ok(c.state.events.length <= WEATHER_TUNING.eventLimit);
  assert.ok(c.state.seq > WEATHER_TUNING.eventLimit);
  const time = c.time;
  assert.equal(c.advance(.1, { position: at('cloud'), frameId: 0 }).duplicateFrame, true);
  assert.equal(c.time, time);
  assert.throws(() => c.advance(.1, { position: at('cloud'), frameId: 'old' }), /monotonic/);
});

test('authority port observes fractional absolute time without quantizing or integrating dt', () => {
  const port = createAuthoritativeWeatherPort();
  const result = port.advance({ generation: 1, frame: 1, dt: 0.073, time: 0.01, player: { ...at('icing'), icing: .4, heat: 42 }, input: { preheat: true } });
  assert.equal(result.time, .01); assert.equal(port.snapshot().time, .01);
  assert.equal(result.player.icing, .4); assert.equal(result.player.heat, 42);
  assert.equal(result.icing.rate, .12); assert.equal(result.icing.speedMultiplier, 1 - .62 * .4);
  assert.equal(result.icing.accelerationMultiplier, 1 - .68 * .4);
  assert.equal(result.heat.regen, 12); assert.equal(result.heat.consumption, 25); assert.equal(result.heat.thaw, .42);
  const earlier = port.sampleAt(at('lightning'), .001);
  assert.equal(earlier.time, .001); assert.equal(port.snapshot().time, .01);
  const warning = port.sampleAt(at('lightning'), .41);
  assert.equal(warning.weather.lightning.phase, 'warning'); assert.ok(Math.abs(warning.weather.lightning.remaining - 2.59) < 1e-12);
});

test('authority port never mutates or integrates the actor/extensions, including held preheat', () => {
  const port = createAuthoritativeWeatherPort(), actor = { ...at('icing'), icing: .7, heat: 60, hp: 100, vx: 4, vy: 0, vz: 2, lock: .25 };
  const original = structuredClone(actor);
  for (let i = 0; i < 500; i++) port.advance({ generation: 1, frame: i, time: i * .01, dt: .01, player: actor, input: { preheat: true, x: 1, lift: 1 } });
  assert.deepEqual(actor, original);
  assert.equal(port.snapshot().player.icing, .7); assert.equal(port.snapshot().player.heat, 60); assert.equal(port.snapshot().player.lock, .25);
  assert.equal('hp' in port.snapshot().player, false); assert.equal('vx' in port.snapshot().player, false);
  const snapshot = port.snapshot(); snapshot.player.heat = 0; snapshot.weather.thermal.lanes[0].x = -99;
  assert.equal(port.snapshot().player.heat, 60); assert.equal(port.snapshot().weather.thermal.lanes[0].x, 45);
});

test('authority hazards are unfiltered geometry; frozen lightning and sustained thermal use stable pulse receipts', () => {
  const port = createAuthoritativeWeatherPort(), target = { ...at('lightning'), x: -43 }, safe = { x: -69, y: 33, z: 0 };
  port.advance({ generation: 2, frame: 0, time: .4, dt: .01, player: target });
  port.advance({ generation: 2, frame: 1, time: 2.99, dt: .01, player: safe });
  const lightning = port.advance({ generation: 2, frame: 2, time: 3.001, dt: .011, player: safe });
  assert.equal(lightning.proposals.length, 1); assert.deepEqual(lightning.proposals[0].shape, { type: 'circle', x: -43, z: 24, radius: 5.4, minY: 3, maxY: 30 });
  assert.equal(lightning.proposals[0].damage, 24); assert.deepEqual(port.snapshot().weather.lightning.target, target);
  assert.equal(port.advance({ generation: 2, frame: 3, time: 3.02, dt: .019, player: target }).proposals.length, 0);
  const burst = port.advance({ generation: 2, frame: 4, time: 3.25, dt: .1, player: safe });
  const late = port.advance({ generation: 2, frame: 5, time: 3.7, dt: .1, player: { x: 45, y: 8, z: 18 } });
  assert.equal(burst.proposals.length, 1); assert.equal(late.proposals.length, 1);
  assert.deepEqual(late.proposals[0], burst.proposals[0]);
  assert.deepEqual(late.proposals[0].shape, { type: 'box', x: 45, z: 18, halfX: 14, halfZ: 1.7, minY: 4, maxY: 13 });
  assert.equal(port.advance({ generation: 2, frame: 6, time: 4.11, dt: .1, player: safe }).proposals.length, 0);
});

test('authority port rejects stale frame/generation/time, holds pause and resets exact generation', () => {
  const port = createAuthoritativeWeatherPort(), actor = { ...at('cloud'), icing: .2, heat: 80 };
  port.advance({ generation: 4, frame: 5, time: .01, dt: .01, player: actor });
  const original = port.snapshot();
  assert.equal(port.advance({ generation: 4, frame: 4, time: .02, dt: .01, player: at('icing') }).duplicateFrame, true);
  assert.equal(port.advance({ generation: 3, frame: 999, time: 10, dt: .1, player: at('icing') }).staleGeneration, true);
  assert.equal(port.advance({ generation: 4, frame: 6, time: 0, dt: .01, player: actor }).staleTime, true);
  assert.deepEqual(port.snapshot(), original);
  port.pause(); const paused = port.snapshot();
  const held = port.advance({ generation: 4, frame: 6, time: .9, dt: .1, player: at('icing') });
  assert.equal(held.time, paused.time); assert.equal(held.proposals.length, 0); assert.equal(port.snapshot().player.icing, .2);
  port.pause(false);
  const reset = port.reset({ generation: 8, time: .01, player: actor });
  assert.equal(reset.generation, 8); assert.equal(reset.time, .01); assert.equal(reset.events.length, 0); assert.equal(reset.seq, 0);
  assert.throws(() => port.reset({ generation: 8 }), /increase/);
  const fresh = port.advance({ generation: 9, frame: 0, time: .001, dt: .001, player: actor });
  assert.equal(fresh.generation, 9); assert.equal(fresh.time, .001);
  assert.equal(port.advance({ generation: 8, frame: 999, time: 99, dt: .1, player: actor }).staleGeneration, true);
  port.dispose(); assert.throws(() => port.sampleAt(actor), /disposed/);
});
