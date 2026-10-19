/**
 * Actual integration return/save failure check. Uses authored runSortie inputs.
 * No HP, position, cargo, settlement or simulation state is written by this QA.
 * Usage: node tools/harbor/verify-return-retry.mjs [INTEGRATION_ROOT]
 * ROOT defaults to cwd; evidence is emitted beside this script's source repo.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const self = fileURLToPath(import.meta.url);
const sourceRoot = path.resolve(path.dirname(self), '../..');
const root = path.resolve(process.argv[2] || process.cwd());
const outFile = path.join(sourceRoot, 'outputs/harbor-linked-v1/return-retry-verification.json');
const sourcePaths = [
  'tools/integration/session.mjs',
  'tools/integration/pilot.mjs',
  'tools/integration/contract.mjs',
  'tools/battlefield/sim.mjs',
  'tools/battlefield/integration.mjs',
  'tools/harbor/core.mjs',
  'tools/harbor/adapters.mjs',
  'tools/shipyard/shipyard.mjs',
  'tools/save/save.mjs',
  'tools/encounters/director.mjs',
  'tools/encounters/attack-budget.mjs',
  'tools/levels/levels.mjs',
];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceHashes = () => sourcePaths.map(relative => ({
  path: relative,
  sha256: digest(fs.readFileSync(path.join(root, relative))),
}));
const clone = value => JSON.parse(JSON.stringify(value));
const checks = [];
const checked = (name, detail) => checks.push({ name, passed: true, detail });
const report = {
  version: 'harbor-return-retry-v1',
  passed: false,
  generatedAt: new Date().toISOString(),
  scope: 'Actual integrated controller and sim using runSortie movement/fire/salvage/return inputs, with injected storage write failure after actual cargo recovery.',
  directHpEdits: false,
  teleports: false,
  directCargoEdits: false,
  fixtureReturns: false,
  browser: false,
  filesystemFaultExperiment: false,
  checks,
  limitations: [
    'Synchronous in-memory localStorage-style adapter; this does not verify browser quota behavior or OS filesystem durability.',
    'Automated safe retreat in the authored first region, not a complete boss route or human playtest.',
    'A fresh controller is recreated in the same Node process; this check does not terminate the application process.',
  ],
};

try {
  const beforeHashes = sourceHashes();
  report.sourceHashes = beforeHashes;
  report.verifier = { path: 'tools/harbor/verify-return-retry.mjs', sha256: digest(fs.readFileSync(self)) };
  const { createVoyageController } = await import(pathToFileURL(path.join(root, 'tools/integration/session.mjs')).href);
  const { runSortie } = await import(pathToFileURL(path.join(root, 'tools/integration/pilot.mjs')).href);
  const { CONTRACT } = await import(pathToFileURL(path.join(root, 'tools/integration/contract.mjs')).href);

  const values = new Map();
  let failWrites = false;
  let successfulWrites = 0;
  let failedWrites = 0;
  const storage = {
    getItem(key) { return values.get(String(key)) ?? null; },
    setItem(key, value) {
      if (failWrites) { failedWrites += 1; throw new Error('QA simulated write failure'); }
      values.set(String(key), String(value));
      successfulWrites += 1;
    },
  };
  const controller = await createVoyageController({ storage });
  assert.equal(controller.snapshot().phase, 'harbor');
  assert.equal(controller.state.settlements.length, 0);
  let failureArmed = false;
  let departureRaw = null;
  let departureRevision = null;
  let cargoAtArm = null;
  const pilotResult = runSortie(controller, {
    maxSteps: 6000,
    dt: .05,
    onStep(snapshot) {
      if (!failureArmed && snapshot.phase === 'sailing' && snapshot.sim?.cargo.length > 0) {
        departureRaw = storage.getItem(CONTRACT.saveKey);
        assert.ok(departureRaw, 'a departure boundary must exist before real cargo recovery');
        const departureJournal = JSON.parse(departureRaw);
        assert.equal(departureJournal.current.boundary, 'departure');
        assert.equal(departureJournal.current.state.settlements.length, 0);
        departureRevision = departureJournal.current.revision;
        cargoAtArm = clone(snapshot.sim.cargo);
        assert.ok(cargoAtArm.every(bundle => bundle.salvaged && bundle.status === 'cargo' && bundle.modules.length));
        failWrites = true;
        failureArmed = true;
      }
    },
  });
  assert.equal(failureArmed, true, 'actual runSortie must recover cargo before the injected write failure');
  assert.equal(pilotResult.done, true, JSON.stringify(pilotResult));
  assert.equal(pilotResult.returned, false, 'pilot must expose the failed return save');
  assert.match(pilotResult.reason, /저장하지 못/);
  assert.equal(controller.snapshot().phase, 'harbor');
  assert.equal(controller.snapshot().harbor.dirty, true);
  assert.equal(controller.battlefield.state.outcome, 'victory');
  assert.equal(controller.battlefield.state.endReason, 'safe-retreat-with-cargo');
  assert.equal(controller.state.settlements.length, 1);
  assert.equal(controller.state.activeVoyage, null);
  const settledSession = clone(controller.state);
  const settledParts = settledSession.parts;
  const cargoParts = settledParts.filter(part => part.location === 'cargo');
  assert.ok(cargoParts.length > 0, 'real recovered parts must remain in the unsaved harbor session');
  assert.equal(new Set(settledParts.map(part => part.id)).size, settledParts.length);
  assert.ok(cargoParts.every(part => part.ownerId === settledSession.ownerId));
  const returnedOriginalIds = cargoParts.map(part => part.source.originalPartId).sort();
  const fieldOriginalIds = cargoAtArm.flatMap(bundle => bundle.modules.map(module => module.id)).sort();
  assert.deepEqual(returnedOriginalIds, fieldOriginalIds, 'all real recovered cargo modules must remain in harbor');
  assert.equal(storage.getItem(CONTRACT.saveKey), departureRaw);
  assert.equal(failedWrites, 1, 'automatic return save failed once');
  checked('actual-return-auto-save-failure-preserves-session-and-departure', {
    outcome: controller.battlefield.state.endReason,
    departureRevision,
    ledgerCount: 1,
    cargoBundles: cargoAtArm.length,
    cargoParts: cargoParts.length,
    partIds: cargoParts.map(part => part.id),
    resources: clone(settledSession.resources),
    failedWrites,
    pilot: clone(pilotResult),
    simulatedSeconds: controller.battlefield.state.time,
  });

  const failedRetry = controller.command('return');
  assert.equal(failedRetry.ok, false);
  assert.match(failedRetry.reason, /저장하지 못/);
  assert.equal(controller.snapshot().phase, 'harbor');
  assert.equal(controller.snapshot().harbor.dirty, true);
  assert.equal(failedWrites, 2);
  assert.deepEqual(clone(controller.state), settledSession);
  assert.equal(storage.getItem(CONTRACT.saveKey), departureRaw);
  checked('repeated-return-with-write-failure-remains-unsaved-without-duplicate-ledger', {
    reason: failedRetry.reason,
    failedWrites,
    ledgerCount: controller.state.settlements.length,
    rawDepartureUnchanged: true,
  });

  const writesBeforeRestore = { successfulWrites, failedWrites };
  const blockedRestore = controller.command('restore');
  assert.equal(blockedRestore.ok, false);
  assert.match(blockedRestore.reason, /먼저 저장/);
  assert.deepEqual(clone(controller.state), settledSession);
  assert.equal(controller.snapshot().harbor.dirty, true);
  assert.equal(storage.getItem(CONTRACT.saveKey), departureRaw);
  assert.deepEqual({ successfulWrites, failedWrites }, writesBeforeRestore);
  checked('dirty-restore-is-blocked-and-cannot-discard-settled-recovery', { reason: blockedRestore.reason });

  failWrites = false;
  const savedRetry = controller.command('return');
  assert.equal(savedRetry.ok, true, JSON.stringify(savedRetry));
  assert.equal(controller.snapshot().phase, 'harbor');
  assert.equal(controller.snapshot().harbor.dirty, false);
  assert.equal(controller.state.settlements.length, 1);
  assert.deepEqual(clone(controller.state), settledSession);
  const committedRaw = storage.getItem(CONTRACT.saveKey);
  assert.notEqual(committedRaw, departureRaw);
  const committedJournal = JSON.parse(committedRaw);
  assert.equal(committedJournal.current.boundary, 'return');
  assert.equal(committedJournal.current.revision, departureRevision + 1);
  assert.deepEqual(committedJournal.current.state, settledSession);
  assert.equal(committedJournal.backups[0].boundary, 'departure');
  assert.equal(successfulWrites, 2, 'one departure and one successful return write');
  checked('retry-after-storage-recovery-commits-existing-session-exactly-once', {
    returnRevision: committedJournal.current.revision,
    successfulWrites,
    failedWrites,
    ledgerCount: controller.state.settlements.length,
    preservedDepartureBackup: true,
  });

  assert.equal(controller.command('return').ok, true);
  assert.deepEqual(clone(controller.state), settledSession);
  assert.equal(storage.getItem(CONTRACT.saveKey), committedRaw);
  assert.equal(successfulWrites, 2);
  const freshController = await createVoyageController({ storage });
  assert.equal(freshController.snapshot().phase, 'harbor');
  assert.equal(freshController.snapshot().harbor.dirty, false);
  assert.equal(freshController.state.settlements.length, 1);
  assert.deepEqual(clone(freshController.state), settledSession);
  assert.equal(freshController.repository.inspect().current.revision, departureRevision + 1);
  assert.equal(freshController.command('restore').ok, true);
  assert.deepEqual(clone(freshController.state), settledSession);
  assert.equal(storage.getItem(CONTRACT.saveKey), committedRaw);
  checked('fresh-controller-restores-exact-state-ledger-ownership-and-parts', {
    ledgerCount: freshController.state.settlements.length,
    partCount: freshController.state.parts.length,
    cargoCount: freshController.state.parts.filter(part => part.location === 'cargo').length,
    resources: clone(freshController.state.resources),
    fullStateExact: true,
    postSuccessReturnWrites: 0,
  });

  const afterHashes = sourceHashes();
  assert.deepEqual(afterHashes, beforeHashes, 'target source changed during verification; rerun against a stable source snapshot');
  report.sourceSnapshotStable = true;
  report.passed = true;
} catch (error) {
  report.error = { name: error.name, code: error.code ?? null, message: error.message };
  process.exitCode = 1;
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
