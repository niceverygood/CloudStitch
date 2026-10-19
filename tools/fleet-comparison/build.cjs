'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'outputs/fleet-comparison-v1');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const categoryLabels = { 'player-base': '주인공 기본선', 'player-build': '우리 편 장비 구성', 'enemy-archetype': '일반 적', 'enemy-standard': '일반 적', 'faction-style-variant': '세력 외형', rival: '라이벌', 'boss-vessel': '주요 보스 함선', 'boss-facility': '주요 보스 시설', 'mini-boss': '중간보스', 'mission-enemy-role': '임무 적/역할', 'mission-vessel': '이야기/임무 함선', 'civilian-role': '민간/구조 함선', 'historical-record': '기록 속 함선', 'unfinished-vessel': '미완성 골격', 'support-craft': '우리 편 지원정', 'ending-variant': '귀환호 결말 형태', 'preexisting-variant': '초기 디자인 대안' };
async function main() {
  const roster = await import('./roster.mjs');
  const v2 = read('outputs/fleet-v2/catalog.json'), v1 = read('outputs/fleet-v1/catalog.json'), source = read('tools/fleet/catalog.json');
  const originalModels = read('outputs/airship-models-9/model-manifest.json');
  const previews = read('outputs/fleet-comparison-v1/previews.json');
  const originals = new Map(v1.ships.map(ship => [ship.id, ship]));
  const ships = [...v2.ships.map(ship => ({ ...ship, sourceVersion: 'v2' })), ...v1.ships.filter(ship => ship.category === 'preexisting-variant').map(ship => ({ ...ship, sourceVersion: 'v1' }))].map(ship => {
    const prefix = '../fleet-' + ship.sourceVersion + '/', evidence = previews.items.find(item => item.id === ship.id);
    if (!evidence || evidence.modelSha256 !== ship.sha256) throw new Error('Missing current model preview: ' + ship.id);
    const bytes = fs.readFileSync(path.join(out, evidence.previewPath));
    if (sha(bytes) !== evidence.previewSha256) throw new Error('Preview hash mismatch: ' + ship.id);
    for (const key of ['assetPath', 'viewerPath']) if (!fs.existsSync(path.resolve(out, prefix, ship[key]))) throw new Error('Missing linked ' + key + ': ' + ship.id);
    const relation = roster.getAffiliation(ship);
    return {
      id: ship.id, name: ship.name, faction: ship.faction, category: ship.category, sourceVersion: ship.sourceVersion,
      side: relation.side, sideLabel: relation.label, context: relation.context, relationStatus: relation.status,
      role: relation.role || categoryLabels[ship.category] || ship.category, categoryLabel: categoryLabels[ship.category],
      sourceRefs: relation.sourceRefs, description: ship.description, identity: ship.identity,
      previewPath: evidence.previewPath, viewerPath: prefix + ship.viewerPath, assetPath: prefix + ship.assetPath,
      previousViewerPath: ship.sourceVersion === 'v2' ? '../fleet-v1/' + originals.get(ship.id).viewerPath : null,
      modelSha256: ship.sha256, previewSha256: evidence.previewSha256, bytes: ship.bytes, metrics: ship.metrics,
      scaleNote: '각 이미지는 화면에 맞춘 크기입니다. 제작용 상대 크기는 최신 3D 뷰어의 귀환호 비교에서 확인하세요.',
    };
  });
  const ids = new Set(ships.map(ship => ship.id));
  if (ids.size !== 71 || ships.length !== 71 || source.ships.some(ship => !ids.has(ship.id))) throw new Error('Expected all and only the 71 catalog IDs');
  const stages = roster.STAGES;
  for (const stage of stages) for (const key of ['midBoss', 'finalBoss']) if (stage[key]?.assetId && !ids.has(stage[key].assetId)) throw new Error('Unknown stage boss: ' + stage.id + '/' + key);
  fs.mkdirSync(path.join(out, 'originals'), { recursive: true });
  const archiveOriginals = originalModels.models.map(model => {
    const originalPreview = fs.readFileSync(path.join(root, 'outputs/airship-models-9', model.preview));
    const previewPath = 'originals/' + model.id + '.png';
    fs.writeFileSync(path.join(out, previewPath), originalPreview);
    const originalPath = path.join(root, 'outputs/airship-models-9', model.model);
    if (!fs.existsSync(originalPath) || fs.statSync(originalPath).size !== model.bytes) throw new Error('Missing original design GLB: ' + model.id);
    return { id: model.id, name: model.name, previewPath, assetPath: '../airship-models-9/' + model.model, modelSha256: model.sha256, previewSha256: sha(originalPreview), bytes: model.bytes, note: model.review_note, source: 'outputs/airship-models-9/model-manifest.json' };
  });
  const data = {
    version: 'fleet-comparison-ready-2', title: 'Cloudstitch · 우리와 그들의 함대', generatedAt: new Date().toISOString(),
    ships, stages, canonStages: roster.CANON_STAGES || [], archiveOriginals,
    originalGalleryPath: '../airship-models-9/index.html',
    archiveNote: '초기 디자인 대안의 고밀도 생성 원본9개입니다. 위 목록의 v1 리그 해석본과는 다른 출력이며 같은 디자인을 새로운9종 함선으로 세지 않습니다. 원본 렌더 이미지와 실제 GLB를 보존했습니다.',
    scopeNote: '현재 제작 항목 62개와 초기 디자인 대안의 v1 리그 해석 9개를 모두 모았습니다. 원본 고밀도9개도 별도로 볼 수 있습니다. 장비 구성·상태·역할·시설을 포함하며 고유 정사 함선 71종이라는 뜻은 아닙니다.',
    stageNote: '아래 6판은 현재 항해 시제품의 교전 편성입니다. 훈련용 역할과 정사 캠페인 보스는 구분해 표시합니다.',
    stageScopeNote: '아래 6판은 현재 항해 시제품의 교전 편성입니다. 2·3판 등 기존 배를 빌린 보스 역할과 정사 캠페인의 고정 보스는 구분해 표시합니다.',
    fleetScopeNote: '현재 제작 62항목 + 초기 디자인 대안 9개를 모두 표시합니다. 같은 함선의 이전 v1 외형은 좌우 비교 칸에서 열 수 있습니다.',
    counts: { total: ships.length, current: v2.ships.length, alternatives: 9, previews: previews.items.length, originalHighDensity: archiveOriginals.length, bySide: Object.fromEntries(['ally', 'enemy', 'neutral', 'reference'].map(side => [side, ships.filter(ship => ship.side === side).length])) },
    sources: [...new Set([...(roster.SOURCE_REFS || []), ...ships.flatMap(ship => ship.sourceRefs || []), ...stages.flatMap(stage => stage.sourceRefs || [])])],
    preservedFleetV2ManifestSha256: sha(fs.readFileSync(path.join(root, 'outputs/fleet-v2/source-manifest.json'))),
    limits: ['New gallery only. Existing models, viewers, encounters and game progress are unchanged.', 'Affiliation is contextual; civilian/negotiation ships are not automatically hostile.', 'No new combat/collision/socket or boss phase implementation.'],
  };
  const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
  if (!template.includes('/* FLEET_DATA */')) throw new Error('Missing FLEET_DATA marker');
  fs.mkdirSync(out, { recursive: true });
  const html = template.replace('/* FLEET_DATA */', () => JSON.stringify(data).replace(/</g, '\\u003c'));
  fs.writeFileSync(path.join(out, 'index.html'), html);
  fs.writeFileSync(path.join(out, 'inventory.json'), JSON.stringify(data, null, 2) + '\n');
  const record = { version: data.version, builtAt: data.generatedAt, ...data.counts, stages: stages.length, stageBossSlots: stages.reduce((n, s) => n + Boolean(s.midBoss?.assetId) + Boolean(s.finalBoss?.assetId), 0), indexSha256: sha(Buffer.from(html)), frozenV2ManifestSha256: data.preservedFleetV2ManifestSha256 };
  fs.writeFileSync(path.join(out, 'build-report.json'), JSON.stringify(record, null, 2) + '\n');
  process.stdout.write(JSON.stringify(record) + '\n');
}
main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
