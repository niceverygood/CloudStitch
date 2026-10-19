import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runtimeAssetDescriptors, WEAPON_VFX } from './vfx-contract.mjs';
import { BATTLEFIELD_VERSION } from './integration.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
function glb(relative, expectedSha) {
  const bytes = fs.readFileSync(path.join(root, relative));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', `${relative}: actual GLB, not LFS pointer`);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (expectedSha) assert.equal(sha256, expectedSha, `${relative}: source hash`);
  return { path: relative, bytes: bytes.length, sha256,
    json: JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8')) };
}

export function verifyBindings() {
  const catalog = readJson('outputs/combat-vfx/catalog.json');
  const recipes = readJson('outputs/combat-vfx/recipes.json');
  const weaponCatalog = readJson('outputs/weapon-modules/catalog.json');
  const sequenceCatalog = readJson('outputs/combat-vfx/sequence-catalog.json');
  const fleet = readJson('outputs/fleet-v1/catalog.json');
  const descriptors = runtimeAssetDescriptors(catalog, recipes), assets = [];
  for (const descriptor of descriptors) {
    const entry = catalog.items.find(e => e.id === descriptor.id);
    const { json, ...record } = glb(`outputs/combat-vfx/${descriptor.model}`, entry.sha256);
    assert.equal(json.animations?.length, 1, 'one authored clip');
    if (descriptor.kind === 'projectile') {
      const carrier = json.nodes.findIndex(n => n.name === descriptor.carrierName);
      assert.ok(carrier >= 0, 'named projectile carrier exists');
      const channels = json.animations[0].channels.filter(c => c.target.node === carrier).map(c => c.target.path);
      assert.ok(channels.includes('translation'), 'demo flight translation detected');
      record.runtimePolicy = 'clone carrier subtree only; do not play translation/scale/end or demo smoke';
      record.carrier = descriptor.carrierName; record.authoredCarrierChannels = channels;
    } else record.runtimePolicy = 'one-shot original AnimationMixer clip';
    assets.push(record);
  }
  const mounted = fleet.ships.find(e => e.id === 'player-homeward');
  const { json: playerJson, ...playerRecord } = glb(`outputs/fleet-v1/${mounted.model}`, mounted.sha256);
  const muzzleIndex = playerJson.nodes.findIndex(n => n.name === 'Muzzle');
  assert.ok(muzzleIndex >= 0, 'rigged selected ship has a muzzle');
  const muzzle = playerJson.nodes[muzzleIndex];
  assert.equal(muzzle.extras?.forward, '-X');
  assert.equal(muzzle.extras?.up, '+Y');
  const parent = playerJson.nodes.find(n => n.children?.includes(muzzleIndex));
  assert.equal(parent?.name, 'GunRecoil');
  assert.ok(playerJson.nodes.some(n => n.name === 'TurretYaw'));
  playerRecord.muzzle = { name: muzzle.name, parent: parent.name, localTranslation: muzzle.translation, forward: '-X', up: '+Y', provisional: true };
  assets.push(playerRecord);
  for (const id of ['01-machine-gun', '02-deck-cannon']) {
    const entry = weaponCatalog.items.find(e => e.id === id);
    const sequence = sequenceCatalog.items.find(e => e.weapon_id === id);
    const { json, ...record } = glb(`outputs/weapon-modules/${entry.model}`, sequence.source_weapon_sha256);
    assert.equal(json.animations?.length || 0, 0);
    record.runtimePolicy = 'preserved independent source; not a real mounted socket';
    assets.push(record);
  }
  return {
    version: BATTLEFIELD_VERSION, status: 'prepared_local_contract_checked_browser_pending',
    originalSourceCommit: 'e65ab87d2af0c4b08e51f312c9eb0998aa895c69',
    checkedAt: new Date().toISOString(), checkedAssets: assets.length, assets,
    weaponBindings: WEAPON_VFX,
    checks: ['catalog and recipe agreement', 'nine selected GLB headers and source hashes', 'actual rig Muzzle ancestry/axis', 'projectile demo movement identified', 'independent weapon originals preserved'],
    limits: ['No browser or engine loading in this check', 'Mount is the provisional selected rig; independent weapon socket finalization remains', 'Only machine-gun/cannon display is connected; four other weapon behaviors remain', 'Planar circle collisions, provisional LU, no persistent save or campaign'],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = verifyBindings();
  if (process.argv.includes('--write')) {
    const out = path.join(root, 'outputs/battlefield-v1/integration-preparation.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ version: report.version, status: report.status, checkedAssets: report.checkedAssets }));
}
