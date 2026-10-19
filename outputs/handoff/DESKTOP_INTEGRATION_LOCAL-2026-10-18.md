# Cloudstitch 로컬 통합 위치와 인계

2026-10-18 데스크톱 통합·QA 결과는 아래 별도 Git 작업 공간에 있다. 현재 공유 폴더의 개발 중 파일을 덮어쓰지 않기 위해 결과를 여기에 분리했다.

- 실제 통합 루트: `C:/Users/nicev/.codex/worktrees/desktop-integration/CloudStitch`
- 공유 개발 루트: `C:/Users/nicev/OneDrive/문서/CloudStitch`
- 통합 브랜치: `codex/desktop-integration`
- 맥북 이관 기준: `e65ab87d2af0c4b08e51f312c9eb0998aa895c69`
- 실행 화면: `http://127.0.0.1:8840/outputs/integration-v1/`
- 실행 명령: 통합 루트에서 `npm ci`, `npm run build:integration`, `npm start` (Node 22 이상).

위 절대 경로는 이번 PC의 실제 위치 기록이다. 다른 PC에도 같은 경로가 있다고 가정하지 않는다.

상세 인계는 통합 루트의 `tools/integration/HANDOFF.md`, 전체 결과는 `outputs/integration-v1/verification.json`에 기록한다. 자산841개 실파일/기존686개 보존 대조는 `migration.json`, 담당 READY 해시는 `handoffs.json`, 통합 코드·번들·문서의 최종 해시는 `delivery-manifest.json`에 있다. 모두 `outputs/integration-v1/` 아래다. 작업 범위는 첫 전장과 종항의 실제 입력 기반 두 번 회수·귀환, 항구 정산·수리·장착·안전 저장·복원까지인 로컬 시제품이다. 전체 무기·특수 보스·캠페인은 후속 범위다.

통합자에게는 공유 checkout을 일괄 pull/reset하거나 덮어쓰는 방식 대신, 별도 작업 공간의 결과를 기준으로 선별 인계한다. 먼저 양쪽 `git status`와 위 해시 기록을 확인한다. `tools/integration/`, `outputs/integration-v1/`, 공통 package/잠금/README 변경을 비교하고 별도 작업 공간에서 병합한다. 이미 존재하는 파일과 package 설정은 비교 없이 복사하지 않는다. 현재 브라우저 저장은 이 origin의 localStorage에 있으므로 새 주소·다른 브라우저에서는 자동으로 이어지지 않는다.

원본 맥북 소스43개·출력250개의 공유 폴더 보충은 없는 파일만 복사한 작업이며 receipt는 공유 루트의 `work/integration-transfer/`에 있다. 이번 신규 통합 결과를 공유 폴더에 일괄 복사한 것은 아니다.

후속 사용자 요청의 함대 v2·월드 플레이 화면 v2·VFX v2·단계별 맵은 별도 READY 버전으로 인계하여 다음 통합에서 연결한다. 이번 검증 완료본을 자동 교체하지 않는다. 전장의 상태·시간·피해 소유권은 battlefield 한 곳에 유지한다. 다른 단계 선택은 route ID·저장키·항해 체크포인트도 함께 검증해야 한다.
