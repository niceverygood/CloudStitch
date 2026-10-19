import test from 'node:test';
import assert from 'node:assert/strict';
import * as current from './sim.mjs';
import * as previous from '../flight3d-history/ready5/sim.mjs';

function sample(api, turn = 1, rise = 1) {
  const s = api.createFlightState(); s.obstacles = []; s.gates = [];
  const advance = (seconds, helm) => {
    for (let n = 0; n < Math.round(seconds * 120); n++) api.stepFlight(s, 1 / 120, { helm });
  };
  advance(2, { throttle: 1 });
  advance(1.5, { throttle: 1, turn });
  const bank = s.player.attitude.roll;
  const v = api.createFlightState(); v.obstacles = []; v.gates = [];
  let loadedHeave = 0, rebound = 0;
  for (let n = 0; n < 144; n++) {
    api.stepFlight(v, 1 / 120, { helm: { rise } });
    loadedHeave = Math.min(loadedHeave, v.player.attitude.heave * rise);
  }
  const y = v.player.y, vy = v.player.vy;
  for (let n = 0; n < 240; n++) {
    api.stepFlight(v, 1 / 120, { helm: {} });
    rebound = Math.max(rebound, v.player.attitude.heave * rise);
  }
  return { bank, loadedHeave, rebound, coast: (v.player.y - y) * rise, vy: vy * rise };
}

test('same helm sequence banks much more visibly in both directions', t => {
  for (const direction of [-1, 1]) {
    const before = sample(previous, direction), after = sample(current, direction);
    assert.ok(Math.abs(after.bank) > Math.abs(before.bank) * 3);
    assert.ok(after.bank * direction < -0.30 && Math.abs(after.bank) < 0.46);
    t.diagnostic(JSON.stringify({ direction, before, after }));
  }
});

test('lift changes load the suspension, rebound on release, and retain vertical momentum', () => {
  for (const rise of [-1, 1]) {
    const before = sample(previous, 1, rise), after = sample(current, 1, rise);
    assert.ok(after.loadedHeave < -0.25, 'hull lags opposite the vertical acceleration');
    assert.ok(after.rebound > 0.25, 'release visibly rebounds in the opposite direction');
    assert.ok(after.coast > before.coast * 1.15, 'actual vertical inertia increases');
    assert.ok(after.vy > 6 && after.vy < before.vy, 'lift builds gradually');
  }
});
