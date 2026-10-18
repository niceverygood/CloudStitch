/**
 * Cloudstitch airship motion library. No renderer or network dependency.
 *
 * Contract
 * - createMotionClips(THREE, options?) returns seven complete, mutually exclusive
 *   AnimationClips. Cross-fade between profiles; do not play them additively.
 * - Animated node names must be unique. +Y is up, ship longitudinal axis is X.
 * - Supply bindPose when animated nodes have non-identity bind transforms:
 *   { HullMotion: { position:[x,y,z], quaternion:[x,y,z,w], scale:[x,y,z] }, ... }.
 *   Positions add to bind position, rotations post-multiply bind rotation,
 *   and scales multiply bind scale. No pivot translation is discarded.
 * - PropellerSpin rotates around local X by default. Set propellerAxis to
 *   'x', 'y', or 'z' for a differently oriented shaft. WinchDrum defaults to X.
 * - unitScale scales all translations. The defaults suit a ship about 1 unit
 *   long. hookTravel is a local-unit payout distance before unitScale.
 * - These are authored presentation loops, not a flight-physics simulation.
 *   Root world travel is intentionally left to gameplay code.
 * - Every track is linear, supported by glTF. Dense quaternion samples preserve
 *   complete propeller/drum revolutions. End transforms and first/last sampled
 *   tangents agree, including quaternion sign continuity for spinning shafts.
 */

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

export const MOTION_PROFILES = Object.freeze([
  { name: 'FloatIdle', duration: 10, label: '잔잔한 정박', rpm: 120 },
  { name: 'Cruise', duration: 8, label: '느긋한 순항', rpm: 240 },
  { name: 'BankTurn', duration: 12, label: '관성 있는 선회', rpm: 240 },
  { name: 'GustRecovery', duration: 12, label: '돌풍과 자세 회복', rpm: 210 },
  { name: 'TurretScan', duration: 12, label: '포탑 탐색', rpm: 180 },
  { name: 'WinchCycle', duration: 16, label: '갈고리 내림과 회수', rpm: 120 },
  { name: 'FireBurst', duration: 8, label: '포격 반동', description: '짧은 후퇴와 천천히 돌아오는 포신', rpm: 240 },
]);

const NODES = [
  'RigRoot', 'HullMotion', 'EnvelopeFlex', 'EngineVibration',
  'PropellerSpin', 'TurretYaw', 'GunRecoil', 'WinchDrum', 'HookSwing',
];

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smootherstep = (value) => {
  const x = clamp01(value);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

function bump(u, start, end) {
  if (u <= start || u >= end) return 0;
  return Math.sin(Math.PI * (u - start) / (end - start)) ** 4;
}

function payout(u) {
  if (u < 0.1) return 0;
  if (u < 0.36) return smootherstep((u - 0.1) / 0.26);
  if (u < 0.49) return 1;
  if (u < 0.87) return 1 - smootherstep((u - 0.49) / 0.38);
  return 0;
}

function recoilPulse(time, start, retreat = 0.085, recovery = 0.24) {
  const elapsed = time - start;
  if (elapsed <= 0 || elapsed >= retreat + recovery) return 0;
  if (elapsed < retreat) return smootherstep(elapsed / retreat);
  return 1 - smootherstep((elapsed - retreat) / recovery);
}

function makeBind(THREE, pose = {}) {
  const result = {};
  for (const name of NODES) {
    const node = pose[name] ?? {};
    result[name] = {
      position: new THREE.Vector3().fromArray(node.position ?? [0, 0, 0]),
      quaternion: new THREE.Quaternion().fromArray(node.quaternion ?? [0, 0, 0, 1]).normalize(),
      scale: new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]),
    };
  }
  return result;
}

/** Capture local transforms before starting any AnimationMixer action. */
export function captureMotionBindPose(root) {
  const pose = {};
  for (const name of NODES) {
    const node = root.getObjectByName(name);
    if (!node) throw new Error(`Cloudstitch motion node is missing: ${name}`);
    pose[name] = {
      position: node.position.toArray(),
      quaternion: node.quaternion.toArray(),
      scale: node.scale.toArray(),
    };
  }
  return pose;
}

/**
 * Samples of periodic analytic motion use matching seam tangents. glTF linear
 * interpolation cannot carry analytic derivatives, so the final adjacent sample
 * is mirrored from the first increment. This only corrects a sub-frame O(dt²)
 * difference while making velocity at the loop boundary agree exactly.
 */
function closeVectorLoop(values, size) {
  const end = values.length - size;
  for (let c = 0; c < size; c += 1) {
    values[end + c] = values[c];
    values[end - size + c] = 2 * values[c] - values[size + c];
  }
}

function closeQuaternionLoop(THREE, values) {
  const end = values.length - 4;
  const first = new THREE.Quaternion().fromArray(values, 0);
  const second = new THREE.Quaternion().fromArray(values, 4);
  const last = new THREE.Quaternion().fromArray(values, end);
  // Preserve the lifted quaternion path: an odd revolution ends at -q0.
  const sign = first.dot(last) < 0 ? -1 : 1;
  last.copy(first);
  if (sign < 0) last.set(-last.x, -last.y, -last.z, -last.w);
  last.toArray(values, end);
  const firstIncrement = first.clone().invert().multiply(second).normalize();
  last.multiply(firstIncrement.invert()).normalize().toArray(values, end - 4);
}

function samplePose(THREE, profile, u, options) {
  const phase = TAU * u;
  const fwd = options.forwardSign < 0 ? -1 : 1;
  const scale = options.unitScale;
  // Harmonic components share the complete loop but differ in phase/frequency.
  // The envelope leads the hanging equipment, giving the hull convincing mass.
  let bob = 0.018 * Math.sin(phase) + 0.004 * Math.sin(2 * phase + 0.45);
  let sway = 0.007 * Math.sin(phase + 0.7);
  let roll = 0.75 * Math.sin(phase + 0.38) + 0.18 * Math.sin(2 * phase);
  let pitch = 0.48 * Math.sin(phase - 0.42);
  let yaw = 0.35 * Math.sin(phase + 0.9);
  let hookRoll = -2.1 * Math.sin(phase - 0.6) - 0.3 * Math.sin(2 * phase - 0.8);
  let hookPitch = 1.3 * Math.sin(phase - 0.9);
  let turret = 2.2 * Math.sin(phase - 0.3);
  let deployed = 0;
  let gunRecoil = 0;
  let surge = 0;

  if (profile.name === 'Cruise') {
    bob *= 0.65;
    sway *= 0.5;
    pitch = -1.2 + 0.38 * Math.sin(phase - 0.45) + 0.12 * Math.sin(3 * phase);
    roll *= 0.65;
    hookRoll *= 0.7;
    hookPitch = 1.8 + 0.9 * Math.sin(phase - 0.85);
  } else if (profile.name === 'BankTurn') {
    // Banking follows steering rate with a small inertial lag. Both left and
    // right turns are included; the clip returns without a hard heading snap.
    yaw = 19 * Math.sin(phase);
    roll = -6.2 * Math.cos(phase - 0.18);
    pitch = -0.7 + 0.65 * Math.sin(2 * phase - 0.2);
    bob += 0.009 * Math.sin(2 * phase - 0.2);
    sway += 0.018 * Math.sin(phase - 0.25);
    hookRoll = 6.5 * Math.cos(phase - 0.58) + 1.2 * Math.sin(2 * phase - 0.9);
    hookPitch = 1.4 * Math.sin(2 * phase - 0.7);
    turret = -7 * Math.sin(phase - 0.2);
  } else if (profile.name === 'GustRecovery') {
    const gust = bump(u, 0.12, 0.44);
    const recoveryWindow = bump(u, 0.32, 0.91);
    const recovery = recoveryWindow * Math.sin(TAU * 3.2 * (u - 0.32))
      * Math.exp(-3.4 * Math.max(0, u - 0.32));
    bob += 0.032 * gust - 0.014 * recovery;
    sway += 0.04 * gust - 0.012 * recovery;
    roll += 7 * gust - 3.2 * recovery;
    pitch += 2.8 * gust + 1.4 * recovery;
    yaw += 3.5 * gust - 1.4 * recovery;
    hookRoll += -9 * bump(u, 0.16, 0.53) + 6 * recovery;
    hookPitch += 3.5 * bump(u, 0.17, 0.55) - 2.5 * recovery;
  } else if (profile.name === 'TurretScan') {
    // A rounded dwell at either extreme avoids the metronomic look of a
    // triangle-wave mechanical scan. No firing/recoil is implied by scanning.
    turret = 28 * Math.sin(phase) + 2.8 * Math.sin(3 * phase);
    yaw *= 0.5;
  } else if (profile.name === 'WinchCycle') {
    deployed = payout(u);
    // Lower/retrieve acceleration excites a delayed, damped pendulum. The
    // quiet intervals retain the ambient drift rather than freezing the hook.
    const lowerSwing = bump(u, 0.11, 0.49) * Math.sin(TAU * 2.4 * (u - 0.11));
    const raiseSwing = bump(u, 0.5, 0.94) * Math.sin(TAU * 2.1 * (u - 0.5));
    hookRoll += 4.8 * lowerSwing + 3.3 * raiseSwing;
    hookPitch += 2.6 * lowerSwing - 1.8 * raiseSwing;
    bob -= 0.006 * deployed;
    pitch -= 0.35 * deployed;
    turret *= 0.25;
  } else if (profile.name === 'FireBurst') {
    const time = u * profile.duration;
    let hullRecoil = 0;
    for (const shot of [2.4, 2.8, 3.2]) {
      gunRecoil += recoilPulse(time, shot);
      // The heavier hull responds after the gun, then settles more slowly.
      hullRecoil += recoilPulse(time, shot + 0.055, 0.12, 0.52);
    }
    surge = 0.0012 * hullRecoil;
    pitch -= 0.22 * hullRecoil;
    bob -= 0.0008 * hullRecoil;
    hookPitch += 0.35 * hullRecoil;
    turret = 8 * Math.sin(phase - 0.3);
  }

  const q = (x, y, z) => new THREE.Quaternion().setFromEuler(
    new THREE.Euler(x * RAD, y * RAD, z * RAD, 'YXZ'),
  );
  const shaft = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  // Integer revolutions are essential for a closed loop with uniform speed.
  const revolutions = Math.round(profile.rpm * profile.duration / 60);
  const vibrationCycles = Math.round(profile.duration * 10);
  const vibration = TAU * vibrationCycles * u;
  const envelopeBreath = Math.sin(phase + 0.25);
  return {
    RigRoot: { position: [0, 0, 0], quaternion: q(0, 0, 0) },
    HullMotion: {
      position: [surge * scale, bob * scale, sway * scale],
      quaternion: q(roll, yaw, pitch * fwd),
    },
    EnvelopeFlex: {
      // At most 0.14% stretch; the painted cream envelope keeps its silhouette.
      scale: [1 - 0.0007 * envelopeBreath, 1 + 0.0014 * envelopeBreath, 1 - 0.0007 * envelopeBreath],
      quaternion: q(0.08 * Math.sin(phase - 0.15), 0, 0.07 * Math.sin(phase - 0.35)),
    },
    EngineVibration: {
      position: [0.00022 * Math.sin(vibration) * scale, 0.00028 * Math.sin(vibration + 0.4) * scale, 0],
      quaternion: q(0.045 * Math.sin(vibration), 0, 0.035 * Math.sin(vibration + 0.5)),
    },
    PropellerSpin: {
      quaternion: new THREE.Quaternion().setFromAxisAngle(shaft[options.propellerAxis], TAU * revolutions * u * options.propellerDirection),
    },
    TurretYaw: { quaternion: q(0, turret, 0) },
    // The painted gun points along -X; recoil moves it toward +X.
    GunRecoil: { position: [0.008 * gunRecoil * scale, 0, 0], quaternion: q(0, 0, 0) },
    WinchDrum: {
      quaternion: new THREE.Quaternion().setFromAxisAngle(shaft[options.winchAxis], -TAU * 3 * deployed),
    },
    HookSwing: {
      position: [0, -options.hookTravel * deployed * scale, 0],
      quaternion: q(hookRoll, 0.6 * Math.sin(phase - 1.1), hookPitch * fwd),
    },
  };
}

export function createMotionClips(THREE, providedOptions = {}) {
  const options = {
    forwardSign: -1,
    unitScale: 0.5,
    hookTravel: 0.11,
    sampleRate: 120,
    propellerAxis: 'x',
    propellerDirection: 1,
    winchAxis: 'x',
    ...providedOptions,
  };
  for (const key of ['propellerAxis', 'winchAxis']) {
    if (!['x', 'y', 'z'].includes(options[key])) throw new Error(`Invalid ${key}: ${options[key]}`);
  }
  if (!(Number.isFinite(options.unitScale) && options.unitScale > 0)) throw new Error('unitScale must be positive');
  if (!(Number.isFinite(options.hookTravel) && options.hookTravel >= 0)) throw new Error('hookTravel must be nonnegative');
  if (!(Number.isFinite(options.sampleRate) && options.sampleRate >= 30)) throw new Error('sampleRate must be at least 30 Hz');
  if (![1, -1].includes(options.propellerDirection)) throw new Error('propellerDirection must be 1 or -1');
  const bind = makeBind(THREE, options.bindPose);

  return MOTION_PROFILES.map((profile) => {
    // At least 12 samples/revolution (30 degrees), well below 180 degrees.
    const rate = Math.max(options.sampleRate, Math.ceil(profile.rpm / 60 * 12));
    const steps = Math.ceil(profile.duration * rate);
    const times = Array.from({ length: steps + 1 }, (_, i) => profile.duration * i / steps);
    const channels = new Map();
    for (let i = 0; i <= steps; i += 1) {
      const pose = samplePose(THREE, profile, i / steps, options);
      for (const [name, components] of Object.entries(pose)) {
        for (const [property, value] of Object.entries(components)) {
          const key = `${name}.${property}`;
          if (!channels.has(key)) channels.set(key, []);
          const values = channels.get(key);
          if (property === 'quaternion') {
            bind[name].quaternion.clone().multiply(value).normalize().toArray(values, values.length);
          } else if (property === 'position') {
            bind[name].position.clone().add(new THREE.Vector3().fromArray(value)).toArray(values, values.length);
          } else if (property === 'scale') {
            bind[name].scale.clone().multiply(new THREE.Vector3().fromArray(value)).toArray(values, values.length);
          }
        }
      }
    }
    const tracks = [];
    for (const [name, values] of channels) {
      const quaternion = name.endsWith('.quaternion');
      if (quaternion) closeQuaternionLoop(THREE, values);
      else closeVectorLoop(values, 3);
      const Track = quaternion ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
      tracks.push(new Track(name, times, values, THREE.InterpolateLinear));
    }
    const clip = new THREE.AnimationClip(profile.name, profile.duration, tracks);
    clip.userData = {
      label: profile.label,
      description: profile.description ?? profile.label,
      loop: true,
      fullPose: true,
      sampleRate: steps / profile.duration,
      propellerRPM: profile.rpm,
      rootTravel: false,
      hookPayout: profile.name === 'WinchCycle' ? options.hookTravel * options.unitScale : 0,
    };
    return clip;
  });
}
