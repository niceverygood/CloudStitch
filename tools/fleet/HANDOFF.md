# Cloudstitch 함대 연결 인계

2026-10-18, `encounters-integration-v1` **READY**. 상세 API와 검사·파일 해시는 `tools/encounters/HANDOFF.md` 및 `outputs/encounters-integration-v1/source-manifest.json`을 따른다.

최초 fb850f7 체크아웃에 없던 `tools/fleet/`, `outputs/fleet-v1/` 원본은 통합 담당이 맥북 e65ab87/LFS에서 복사했다. 현재 누락은 해소됐다. 원본 함대 제작·GLB·클립·아틀라스를 다시 만들지 않았다. 소스 `catalog.json`의 SHA256은 원격 원본과 같다.

새 `encounter-assets.mjs`는 **생성 결과** `outputs/fleet-v1/catalog.json`의 `ships`를 받아 `resolveEncounterAsset(catalog,id)`와 `collectEncounterAssets(encounters,fleet)`로 기존 assetId/modelPath/해시 메타데이터/사용 가능 클립을 제공한다. `tools/fleet/catalog.json`은 planned 원문 기준이며 모델 경로가 없어 resolver 입력으로 쓸 수 없다.

교전6판이 사용하는 고유 적 모델은18개, 플레이어 포함19개다. 카탈로그 ID 일치와 실제19파일의 크기·GLB 헤더를 가볍게 검사했다. 이번 담당이 전체71모델을 다시 해시/렌더링하거나 기존 전체QA를 재인증한 결과가 아니다.

원본 authoredUnits/fleet-kit와 recommendedFleetScale은 참고다. battlefield는 XZ/Y-up의 임시 LU 축척과 실제 collider/topology를 따로 결정한다. 내장 FloatIdle/Cruise/BankTurn/WinchCycle/FireBurst 등의 시연은 시각 클립이며 물리 이동·사격·수리·소유권을 갱신하지 않는다. 모듈 proxy를 새로 대응한 것과 실제 GLB 부품 분리 완료를 구별한다.

새 의존성·유료 생성·LFS 자산 추가·빌드·브라우저 QA·공통 package 수정은 없다. 최종 플레이의 상태·시간·피해는 battlefield 한 곳만 소유한다.

## 후속 외형 제작판 — 함대 v2

2026-10-18 사용자가 주인공·적·보스의 실루엣 개성을 요청해 별도 `tools/fleet-v2/`, `outputs/fleet-v2/`를 추가했다. 위의 ‘새 자산/빌드 없음’은 최초 교전 연결 작업의 기록이며 이 후속 제작을 포함하지 않는다.

새 카탈로그는 초기 디자인 대안9개를 제외한62제작 항목(선택 귀환호의 기존 리그 파생본 보존1·새 외형61)이다. 기존 ID를 유지하며 장비/상태/시설 변형을 포함하므로62고유 정사 함선이 아니다. v1의 카탈로그·GLB·뷰어와 기존 교전 연결은 대체하지 않았다.

준비 버전·실제 생성/캡처·구조검사·브라우저QA 한계·파일 SHA는 `tools/fleet-v2/HANDOFF.md`와 `outputs/fleet-v2/source-manifest.json`을 따른다. 새 모델의 -X 전방/+Y 위 축, 임시 LU와 정지 bounds를 기존 battlefield 충돌/발사점/socket으로 자동 채택하지 않는다. 개별 매핑과 실제 항해 검증은 통합 담당의 후속 작업이며 battlefield의 유일한 전투 상태 소유권을 유지한다.
