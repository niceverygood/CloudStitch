import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HARPOON_DURATION, HARPOON_LAUNCH_SOURCE_DURATION, HARPOON_TIMING,
  sampleHarpoonLaunch,
} from './harpoon-motion.mjs';

test('loaded harpoon is visible before release, with no launch ring or recoil', () => {
  for (const time of [0, .08, HARPOON_TIMING.release - .001]) {
    const state = sampleHarpoonLaunch(time);
    assert.equal(state.phase, 'loaded');
    assert.equal(state.projectileVisible, true);
    assert.equal(state.projectileCount, 1);
    assert.equal(state.projectileZ, 0);
    assert.equal(state.projectileScale, 1);
    assert.equal(state.launchVisible, false);
    assert.equal(state.launchClipTime, 0);
    assert.ok(state.recoilZ === 0);
  }
});

test('release, flight and end have explicit phase boundaries', () => {
  const cases = [
    [HARPOON_TIMING.release, 'release'],
    [HARPOON_TIMING.flight, 'flight'],
    [HARPOON_TIMING.flightEnd, 'tail'],
    [HARPOON_DURATION, 'finished'],
  ];
  for (const [time, phase] of cases) {
    const state = sampleHarpoonLaunch(time);
    assert.equal(state.phase, phase);
    assert.match(state.phaseLabel, /[가-힣]/);
  }
});

test('original launch clip runs once at its original rate after release', () => {
  const start = HARPOON_TIMING.release;
  const sourceEnd = start + HARPOON_LAUNCH_SOURCE_DURATION;
  assert.equal(sampleHarpoonLaunch(start).launchVisible, true);
  assert.ok(Math.abs(sampleHarpoonLaunch(start + .14).launchClipTime - .14) < 1e-12);
  assert.equal(sampleHarpoonLaunch(sourceEnd).launchVisible, false);
  assert.equal(sampleHarpoonLaunch(1).launchClipTime, HARPOON_LAUNCH_SOURCE_DURATION);
});

test('one carrier follows one bounded forward path, with a settled endpoint', () => {
  let previous = 0;
  for (let step = 0; step <= 250; step++) {
    const state = sampleHarpoonLaunch(step / 200);
    assert.ok(state.projectileZ >= previous);
    assert.ok(state.projectileZ >= 0 && state.projectileZ <= 4);
    assert.ok(state.projectileCount === 0 || state.projectileCount === 1);
    assert.equal(state.projectileVisible, state.projectileCount === 1);
    previous = state.projectileZ;
  }
  assert.equal(sampleHarpoonLaunch(HARPOON_TIMING.release).projectileZ, 0);
  assert.equal(sampleHarpoonLaunch(HARPOON_TIMING.flightEnd).projectileZ, 4);
  assert.equal(sampleHarpoonLaunch(HARPOON_DURATION).projectileZ, 4);
});

test('recoil moves the display backward then returns exactly to its base pose', () => {
  assert.equal(sampleHarpoonLaunch(HARPOON_TIMING.recoilPeak).recoilZ, -.12);
  for (const time of [HARPOON_TIMING.recoilEnd, .8, HARPOON_DURATION]) {
    assert.ok(sampleHarpoonLaunch(time).recoilZ === 0);
  }
  for (let step = 0; step <= 250; step++) {
    const recoil = sampleHarpoonLaunch(step / 200).recoilZ;
    assert.ok(recoil <= 0 && recoil >= -.12);
  }
});

test('one rope changes from slack to taut as travel starts and shares end shrink', () => {
  const loaded = sampleHarpoonLaunch(0), flying = sampleHarpoonLaunch(.5);
  assert.ok(loaded.ropeSag > flying.ropeSag);
  assert.equal(loaded.ropeTension, 0);
  assert.equal(flying.ropeTension, 1);
  assert.equal(loaded.ropeExtension, 0);
  assert.equal(sampleHarpoonLaunch(.9).ropeExtension, 1);
  for (const time of [0, .16, .4, 1.15, 1.2, HARPOON_DURATION]) {
    const state = sampleHarpoonLaunch(time);
    assert.equal(state.ropeScale, state.projectileScale);
    assert.equal(state.ropeVisible, state.projectileVisible);
  }
  assert.equal(sampleHarpoonLaunch(1.15).projectileScale, 1);
  assert.ok(sampleHarpoonLaunch(1.2).projectileScale > 0);
  assert.ok(sampleHarpoonLaunch(1.2).projectileScale < 1);
  assert.equal(sampleHarpoonLaunch(HARPOON_DURATION).projectileScale, 0);
  assert.equal(sampleHarpoonLaunch(HARPOON_DURATION).projectileCount, 0);
});

test('pause and reverse scrubbing return exactly the same immutable sample', () => {
  const original = sampleHarpoonLaunch(.43);
  sampleHarpoonLaunch(1.2); sampleHarpoonLaunch(.05);
  assert.deepEqual(sampleHarpoonLaunch(.43), original);
  assert.deepEqual(sampleHarpoonLaunch(.43), original);
  assert.equal(Object.isFrozen(original), true);
  assert.equal(Object.isFrozen(HARPOON_TIMING), true);
  assert.throws(() => { original.projectileZ = 999; }, TypeError);
});

test('out of range time clamps, invalid input cannot poison transforms', () => {
  assert.deepEqual(sampleHarpoonLaunch(-999), sampleHarpoonLaunch(0));
  assert.deepEqual(sampleHarpoonLaunch(999), sampleHarpoonLaunch(HARPOON_DURATION));
  for (const value of [NaN, Infinity, -Infinity, undefined, null, '.2', {}, []]) {
    assert.throws(() => sampleHarpoonLaunch(value), TypeError);
  }
  for (let step = 0; step <= 250; step++) {
    const state = sampleHarpoonLaunch(step / 200);
    for (const value of Object.values(state)) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value));
    }
    assert.equal('damage' in state, false);
    assert.equal('hit' in state, false);
    assert.equal('latch' in state, false);
  }
});
