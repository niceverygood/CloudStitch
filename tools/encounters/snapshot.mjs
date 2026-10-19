// Lightweight, dependency-free contract snapshot; never writes preserved *-v1 art.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createEncounterDirector } from './director.mjs';
import { describeAttack, describeSupport, ROLE_PROFILES, INTENT_VERSION } from './attack-intents.mjs';
import { collectEncounterAssets } from '../fleet/encounter-assets.mjs';
import { exampleSpawnCandidates, createBattlefieldEncounterAdapter } from './example-adapter.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = path.join(root, 'outputs/encounters-integration-v1');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const catalog = read('tools/encounters/catalog.json');
const fleet = read('outputs/fleet-v1/catalog.json');
const now = new Date().toISOString();
const tests = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tools/encounters/director.test.mjs'], { cwd: root, encoding: 'utf8' });
if (tests.status !== 0) { process.stderr.write(tests.stdout + tests.stderr); throw new Error('Encounter contract tests failed'); }
const baseline = {
  'tools/encounters/core.js': '16ad0e70334fd5b7fb4c1cb52206f6f45ee9b64b33ccd61c9e48a289a805a2bf',
  'tools/encounters/catalog.json': 'd20a707fba219927519e409756eec3662e3fe8ea85cb5540c321b05800c95b37',
  'tools/fleet/catalog.json': 'eba0f3f4d838a7acc2d2d5f2144cf5b42f8784802b8776e5167d0e683e7248ba',
};
const preservation = Object.entries(baseline).map(([file, sha256]) => ({ path: file, sha256, preserved: hash(fs.readFileSync(path.join(root, file))) === sha256 }));
if (preservation.some(item => !item.preserved)) throw new Error('Original e65ab87 source changed; review before refreshing this v1 handoff');
const assets = collectEncounterAssets(catalog, fleet);
const director = createEncounterDirector(catalog);
const commands = [], active = new Map();
const adapter = createBattlefieldEncounterAdapter(director, {
  spawnEnemy(command) { active.set(command.enemyId, command); commands.push(command); },
  clearCombat(command) { active.clear(); commands.push(command); return { remainingEnemies: 0, remainingHazards: 0 }; },
  onEvent(command) { commands.push(command); },
});
director.startStage(catalog.stages[0].id, exampleSpawnCandidates()); adapter.flush();
for (let wave = 0; wave < 4; wave++) {
  for (const enemyId of director.snapshot().activeEnemyIds) { active.delete(enemyId); director.enemyDefeated({ runId: director.snapshot().runId, enemyId }); }
  director.advance(); adapter.flush();
  if (director.snapshot().phase === 'maintenance') { director.continue(); adapter.flush(); }
}
const contract = {
  version: INTENT_VERSION, title: 'Cloudstitch', preparedAt: now,
  readiness: 'ready-for-battlefield-integration', sourceCommit: 'e65ab87d2af0c4b08e51f312c9eb0998aa895c69',
  ownership: { sequencing: 'encounters director', spawnPositions: 'world adapter candidates', stateTimeMovementShotsDamage: 'battlefield sim.mjs only', independentRegression: 'tools/encounters/core.js; never instantiate it in final integration' },
  coordinates: { plane: 'XZ', up: '+Y', units: 'provisional LU, not metres', worldCandidateFormat: { id: 'world-safe-point', x: 0, z: -40, safe: true } },
  phaseFlow: ['opening', 'midboss', 'maintenance', 'late', 'finalboss', 'victory'],
  sourceSpawnCounts: { regions: 6, normal: 36, midboss: 6, finalboss: 6, total: 48, distinctEnemyModels: 18, modelsWithPlayer: 19 },
  assetBindings: assets,
  regions: catalog.stages.map(stage => ({ id: stage.id, region: stage.region, opening: stage.opening, midBoss: stage.midBoss, maintenance: catalog.maintenance, late: stage.late, finalBoss: stage.finalBoss, sourceRefs: stage.sourceRefs })),
  roles: Object.keys(ROLE_PROFILES).map(role => ({ role, profile: ROLE_PROFILES[role], name: catalog.enemyRoles[role]?.name, warning: catalog.enemyRoles[role]?.warning, examples: Array.from({ length: 3 }, (_, attackIndex) => describeAttack({ role, tier: 'finalboss', attackIndex })), support: role === 'repair' ? describeSupport({ role, remainingBudget: 36 }) : null })),
  limitations: ['Intent data is not actual special attack execution. Current battlefield host supports only move/attackTarget and basic warned projectiles.', 'Use training-intent.mjs downgrade explicitly; source telegraph shapes must not be displayed as hit geometry when the host cannot execute them.', 'Host acknowledges clear-combat only after pending spawns/loading/attacks, enemy actors and all hazards are cancelled.', 'Initial region selection remains a prototype feature; nextStage is sequential, not a campaign unlock implementation.', 'Canonical boss multi-device goals, rescue checkpoints, story/economy and final balance are not completed by this contract.'],
};
const verification = {
  version: INTENT_VERSION, checkedAt: now, passed: true,
  command: 'node --test tools/encounters/director.test.mjs', tests: Number(tests.stdout.match(/# tests (\d+)/)?.[1]), failures: 0,
  preservedSources: preservation,
  assetSubset: { count: assets.length, checks: ['catalog ID', 'local byte size', '12-byte GLB header/version/declared length'], wholeFileHashRecomputed: false, actualBrowserLoading: false },
  standaloneCoreRegression: 'Forced defeat hooks for six stages; not real-weapon playthrough or fun/balance verification',
  presentation: 'Banner/charge pure policies tested and wired in app.js/scene.js; actual browser QA delegated to integration owner',
  completeIntegrationBrowserVerifiedHere: false, testOutput: tests.stdout,
};
fs.mkdirSync(out, { recursive: true });
const write = (file, value) => fs.writeFileSync(path.join(out, file), JSON.stringify(value, null, 2) + '\n');
write('contract.json', contract);
write('example-session.json', { version: INTENT_VERSION, note: 'Artificial positions and forced defeat notifications. Ordering example only; no second combat simulation.', commands, final: director.snapshot() });
write('verification.json', verification);
fs.writeFileSync(path.join(out, 'README.txt'), 'Cloudstitch 함대·교전 통합 계약 v1\n\n기존 맥북 함대/6판 원본을 보존한 연결 데이터·예시다. 최종 이동·시간·사격·피해는 battlefield sim.mjs 한 곳이 수행한다.\ncontract.json: 기존 ID·6지역·12역할·예고/패턴 의도\nexample-session.json: 강제 격파 통보를 사용한 순서 예시. 실제 플레이 화면/실전 검증 아님.\nverification.json: 가벼운 계약/정책/원본보존/19모델 헤더·크기 검사. 전체 자산 해시·브라우저 QA 아님.\nsource-manifest.json: 담당 인계 파일 SHA256\n\n현재 battlefield의 move/attackTarget 어댑터는 기본 예고 포격만 실행한다. 원본 돌진·견인·광역·수리·보스 패턴 데이터는 실행 구현과 구별한다.\n상세: tools/encounters/HANDOFF.md\n재현: node tools/encounters/snapshot.mjs (이 integration-v1 기록만 갱신)\n');
const files = [
  'tools/fleet/encounter-assets.mjs', 'tools/fleet/HANDOFF.md',
  ...['director.mjs', 'attack-intents.mjs', 'example-adapter.mjs', 'presentation-policy.mjs', 'training-intent.mjs', 'director.test.mjs', 'snapshot.mjs', 'app.js', 'scene.js', 'HANDOFF.md'].map(file => `tools/encounters/${file}`),
  ...['contract.json', 'example-session.json', 'verification.json', 'README.txt'].map(file => `outputs/encounters-integration-v1/${file}`),
];
write('source-manifest.json', { version: INTENT_VERSION, capturedAt: now, status: 'ready', excludesSelfHash: true, files: files.filter(file => fs.existsSync(path.join(root, file))).map(file => { const bytes = fs.readFileSync(path.join(root, file)); return { path: file, bytes: bytes.length, sha256: hash(bytes) }; }) });
process.stdout.write(JSON.stringify({ status: 'ready', version: INTENT_VERSION, tests: verification.tests, assetHeaders: assets.length, sourcePreserved: true, output: 'outputs/encounters-integration-v1' }) + '\n');
