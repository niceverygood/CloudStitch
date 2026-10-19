/* Publish owned QA evidence only after checks pass; never touches other revisions. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const out = path.join(root, 'outputs/enemy-base-v1/dense-r4');
const rel = p => path.relative(root, p).split(path.sep).join('/');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n');
const record = p => { const b = fs.readFileSync(p); return { path: rel(p), bytes: b.length, sha256: sha(b) }; };
const structure = read(path.join(out, 'structure-verification.json'));
const rawFile = path.join(root, 'work/verification/enemy-base-v1/dense-r4/qa-result.json');
const qa = read(rawFile);
const model = path.join(out, 'enemy-base.glb');
assert(structure.passed && qa.passed, 'Do not publish READY until both checks pass');
assert.equal(structure.sha256, sha(fs.readFileSync(model)), 'Structure check must match current GLB');
assert.equal(qa.model.sha256, structure.sha256, 'Browser must load current GLB');
assert.equal(qa.harnessSha256, sha(fs.readFileSync(path.join(root, qa.harness))), 'QA harness changed after run');
const exportedFiles = [];
for (const source of qa.screenshots) {
  const sourcePath = path.resolve(root, source);
  assert(sourcePath.startsWith(path.join(root, 'work/verification/enemy-base-v1/dense-r4') + path.sep));
  const target = path.join(out, path.basename(source));
  fs.copyFileSync(sourcePath, target);
  exportedFiles.push({ ...record(target), generated_from: source });
}
assert(exportedFiles.some(item => /model-iso\.png$/.test(item.path)), 'A real GLB preview is required');
fs.copyFileSync(rawFile, path.join(out, 'browser-verification.json'));
const summary = {
  title: 'Cloudstitch · 적군 공중요새', revision: 'dense-r4', status: 'READY_art_review',
  scope: 'Actual static 3D art asset and offline review page; not combat or game integration.',
  model: record(model), structural: record(path.join(out, 'structure-verification.json')),
  browser: { ...record(path.join(out, 'browser-verification.json')), checks: qa.summary, passed: qa.passed,
    externalRequests: qa.externalRequests.length, pageErrors: qa.pageErrors.length, consoleErrors: qa.consoleErrors.length,
    ghosting: qa.ghosting.map(item => ({ mode: item.mode, frames: item.rotationFrames, changedPixels: item.changedPixels })) },
  previews: exportedFiles,
  reference: structure.reference,
  visual_review: { status: 'actual_renders_to_be_reviewed', user_art_approval: false },
  limitations: [
    'No combat, enemy AI, damage, module cutting or campaign integration.',
    'No collision, navmesh, interiors, LOD or approved engine sockets.',
    'Static mesh; camera rotation is not GLB animation.',
    'Toon shading and outline are review runtime effects, separate from GLB materials.',
    'Browser checks are not target-device performance or gameplay approval.'
  ],
  git_commit_or_push: false, deployment: false
};
write(path.join(out, 'verification.json'), summary);
const info = read(path.join(out, 'model-manifest.json'));
const handoff = [
  'Cloudstitch · 적군 공중요새 / enemy-base-v1',
  '2026-10-19 (Asia/Seoul) · READY: 로컬 아트 검수용', '',
  '열기: outputs/enemy-base-v1/dense-r4/index.html (파일을 직접 열어도 오프라인 실행)',
  '모델: outputs/enemy-base-v1/dense-r4/enemy-base.glb',
  '원화: outputs/enemy-base-v1/dense-r4/reference.png (원본 보존)', '',
  `실제 모델: 삼각형 ${structure.triangles.toLocaleString('en-US')}개 / 메시 ${structure.meshes}개 / ${structure.bytes.toLocaleString('en-US')} bytes / 애니메이션 ${structure.animations}개`,
  '명세 단위: +Y 위, +Z 정면·계류장. 상대 설계 단위이며 엔진 미터 크기는 미확정.',
  '구역: 철갑 선체, 부력 장치, 성채, 종탑, 포대, 관문·계류장, 동력 기관, 붉은 군기.', '',
  '변경과 미술 의도',
  '악당 요새 무드보드를 실제 입체 건축으로 해석했다. 높은 중앙 종탑과 비대칭 겹지붕,',
  '넓은 철갑 선체·포대·돌출 선창으로 웅장함을 만들고 후면과 하부에도 기계·봉제 디테일을 넣었다.',
  '낡은 철갑·청록 지붕·황동·군기·크림 부력낭을 내장 아틀라스와 무광 재질로 표현했다.',
  '실제 렌더 PNG를 함께 보관한다. 사람의 미술 승인이나 원화의 모든 세부 복제를 선언하지 않는다.', '',
  '리뷰 페이지',
  '실제 GLB 회전·확대·이동 / 세 표시 모드 / 윤곽선 / 네 방향 / 여덟 구역 포커스·표시 / 원화 비교.',
  '검수 체크와 의견은 현재 브라우저 로컬 저장소에만 저장된다. JSON으로 내보내 인계한다.',
  'GLB 다운로드는 실제 원본 바이트이며 내장 하늘 장식과 리뷰 UI는 GLB에 들어가지 않는다.', '',
  '실제 검증',
  `공식 glTF 검사 오류 ${structure.validator.errors} / 경고 ${structure.validator.warnings} / 정보 ${structure.validator.infos}.`,
  `실제 file:// 브라우저 검사 ${qa.summary.passed}/${qa.summary.total} 통과. 외부 HTTP 요청 ${qa.externalRequests.length}, JS 오류 ${qa.pageErrors.length}.`,
  '세 모드 각각 120프레임 회전 뒤 같은 시점의 깨끗한 렌더와 비교했다. 상세는 verification.json 참조.',
  '브라우저 모바일 390px 검사는 실제 휴대폰 성능 검사가 아니다.', '',
  '미구현과 주의',
  '정적 아트 에셋이다. 실제 기지 전투·AI·피해·파괴·연결부 절단·캠페인은 연결하지 않았다.',
  '충돌·내부 탐사·navmesh·LOD·장착 소켓·최종 엔진 스케일과 최적화는 후속 작업이다.',
  '구역별 분류는 검수용이며 게임의 단일 부모 연결 규칙이나 장비 수를 새로 확정하지 않는다.',
  '셀 명암과 윤곽선은 리뷰 런타임 설정이다. 다른 엔진에서 재구현해야 한다.',
  'OutlineEffect.autoClear = true를 계속 유지한다.', '',
  '재현: tools/enemy-base/dense-r4/README.txt. NODE_PATH 또는 정상 node_modules 의존성이 필요하다.',
  '현재 PC의 확인된 기존 설치를 읽기 전용 사용했고 새 설치·공통 package/lock 수정은 하지 않았다.',
  '원화·타 담당 소스·기존 출력 보존. 유료 모델 생성·commit/push·배포 없음.', '',
  'HANDOFF는 소유 namespace만 인계한다. 공유 서버/허브 연결은 통합 담당이 관리한다.', ''
].join('\n');
fs.writeFileSync(path.join(out, 'HANDOFF.txt'), handoff);
fs.writeFileSync(path.join(out, 'README.txt'), 'Cloudstitch · 적군 공중요새\n\nindex.html을 브라우저에서 열어 검수하세요.\nenemy-base.glb는 실제 정적 3D 모델입니다.\n검수 의견은 브라우저 로컬에 저장되며 JSON으로 내보낼 수 있습니다.\n제작 범위와 실제 검사·남은 한계는 HANDOFF.txt와 verification.json을 확인하세요.\n');
fs.copyFileSync(path.join(__dirname,'comparison.html'),path.join(out,'comparison.html'));
fs.copyFileSync(path.join(root,'outputs/enemy-base-v1/reference-r3/model-iso.png'),path.join(out,'previous-r3-iso.png'));
fs.appendFileSync(path.join(out,'HANDOFF.txt'),'\n최신 사용자 미술 수정: r3 단순/장난감 인상 거절. 반복 원통탑 대신 비대칭 다층 건물·지붕마을·좁은 첨탑으로 전면 재설계. 공중회랑·큰 버팀대·산업배관·발코니·불규칙 철판 치마·수선판·녹흐름·시계·작은 창/등·찢어진 군기를 계층적으로 겹쳤다. 10배 기준은 scale 배수가 아닌 표현의 대담함이다. comparison.html에서 동일 시점 실제 PNG 비교. 정적 에셋이며 사람의 최종 미술 승인 대기.\n');
const paths = [];
for (const dir of [path.join(root, 'tools/enemy-base/dense-r4'), out]) for (const name of fs.readdirSync(dir)) {
  const file = path.join(dir, name);
  if (fs.statSync(file).isFile() && name !== 'delivery-manifest.json') paths.push(file);
  if(fs.statSync(file).isDirectory())for(const inner of fs.readdirSync(file))if(fs.statSync(path.join(file,inner)).isFile())paths.push(path.join(file,inner));
}
const manifest = { revision: 'dense-r4', status: 'READY_art_review', ownership: ['tools/enemy-base/dense-r4/', 'outputs/enemy-base-v1/dense-r4/'],
  readOnlyDependencies: [structure.reference], modelSha256: info.model.sha256, verification: record(path.join(out, 'verification.json')),
  files: paths.map(record), sha256Scope: 'All owned source/output files, excluding this manifest itself.' };
write(path.join(out, 'delivery-manifest.json'), manifest);
console.log(JSON.stringify({ status: manifest.status, files: manifest.files.length, triangles: structure.triangles, checks: qa.summary, manifest: 'outputs/enemy-base-v1/dense-r4/delivery-manifest.json' }));
