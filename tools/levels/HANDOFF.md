# 월드 배치 인계 — 2026-10-18 ready-4 준비 스냅샷

상태: **ready-for-integration / 공간 데이터·소스·독립 미리보기 빌드 인계 완료**. 브라우저 실측/통합 플레이는 통합 담당 소유이며 이 스냅샷에서는 미실행이다. 인계 파일 목록·바이트·SHA-256은 `outputs/levels-v1/handoff-files.json`에 기록한다. 이 문서 자체도 목록에 들어가며 해시 manifest 자체는 자기 해시 순환 때문에 제외한다.

## 보존한 원본과 작업 범위

시작 시 HEAD `fb850f7`, git status 변경 없음, `tools/levels` 없음이었다. 처음에는 맥북 `tools/airship-rig`, `tools/fleet`, `tools/battlefield`, `tools/encounters`와 해당 `outputs/*-v1`이 없었다. 통합 담당이 원격 `e65ab87d2af0c4b08e51f312c9eb0998aa895c69`을 찾고 없는 파일만 복사해 복원했다. 현재 그 경로는 존재한다. 이 담당은 맥북 원본을 재제작하거나 그 원본 이관을 직접 수행했다고 표시하지 않는다.

추가한 파일은 `tools/levels/`와 `outputs/levels-v1/`뿐이다. 공통 package/lock·다른 담당 구현·원화·GLB·96자산/7장면·원본/법선 수정/지붕 보강본을 수정하지 않았다. commit/push/배포·유료 생성·npm 설치·자체 전투 루프는 수행하지 않았다.

## 연결 데이터와 좌표

- 결과: `outputs/levels-v1/level-package.json`의 `first-voyage`, `jonghang-harbor` 두 레벨.
- 프레임: `levels-lu-yup-v1`, Y-up, XZ 평면, +Z 전방, LU 임시 단위. 미터·기획 U·최종 엔진 치수는 미확정.
- `adapter.toBattlefield([x,y,z])`는 `{x,z}`를 반환한다. `fromBattlefield`는 고도를 명시해 복구한다. 화면용 `{x,y}`는 `toScreenPlane/fromScreenPlane`으로 분리했다.
- 기존 battlefield heading0은 +Z다. 기존 encounters의 `[-cos(angle),-sin(angle)]` 방향은 `thetaLevels=-angle-PI/2`로 변환한다. `host-example.mjs`에 두 방향 변환이 있다.
- `coordinateProfiles.battlefield`는 현재 전장 좌표 identity다. `harborArt` D→LU 배율3은 선택 원본 종항 시각 비교 전용이다. `encountersExample` 배율0.2는 예시이며 작은 조우 전장에 자동 채택하지 않는다.
- 시각 모델 `visuals`와 `colliders`는 별개다. 시각은 카탈로그 선택 GLB를 중심 정렬→가장 긴 축 `longestLU`로 균일 배율→yaw→position한다. D의 기획 제안 치수를 실제 미터로 취급하지 않는다.

## 충돌·통로·스폰

선택 원본 GLB 실제 POSITION accessor bounds를 확인했다. 긴 축은 X, 원본 선수 방향 -X→π/2 회전→+Z다. 전장의 기존 표시 길이10LU에 맞추면 폭3.01235LU, 높이5.47888LU, 회전 외접 직경10.443862LU다. 단순 `max(길이,폭)` 대신 `hypot(길이/2,폭/2)` 반경을 써 대각 회전을 포함한다. 이 정적 선체 기준은 추가 장착품·최대 보스 크기를 보증하지 않는다.

첫 전장은 기존 `world.js`의 장애물8개 XZ 위치·원형 반경을 `legacyCircleXZ`로 보존했다. 별도 AABB는 보수 공간 검사안이며 기존 circle physics를 조용히 바꾸는 자료가 아니다. 새 항구는 공방·시장 양쪽 배치와 중앙 통로를 독립 제안한다. 갑판은 비행 평면 아래 collider로 구분했다.

주항로·동쪽 우회·귀환 접근·항구 진입·출항 5통로는 모두18LU다. 회전 외접 폭 대비1.7235배, 여유7.5561LU다. 선체뿐 아니라 선언된18LU 통로 튜브 전체와 경계를 연속 AABB slab sweep으로 검사했다. 실제 GLB bounds를 center/longestLU/yaw로 변환한 **별도의 시각 envelope**에서도5통로의 선체/전체18LU sweep을 확인했다. 이 검사는 정밀 메시 물리 판정이 아니다. ready-2는 부두 난간을 비행 평면 아래로 낮추고 부표·서비스 소품을 통로 밖으로 옮겼으며 동쪽 우회를 실제 섬 외형에 맞춰 보정한 스냅샷이다. 회전 포켓 반경9LU 세 곳도 확인했다. 접촉은 충돌로 친다. 초기 접촉/겹침에서 이탈하는 sweep은 t=0일 수 있으므로 **이동 응답·탈출 처리는 battlefield 소유**다.

공간 앵커6개는 점유·경계·고정 장애물을 질의한다. **등장 순서/적 종류/타이밍은 encounters 소유**다. 한 척 확정 직후 점유를 예약하고 다음 질의를 해야 한다. 기존 징세정 (-28,-12)은 새 full-ship 보수 AABB에 겹침이 있어 예상 advisory로 남겼고 원본은 그대로다. 대안 앵커 (-32,-16)은 제안이며 자동 적용하지 않는다. 징세정 실제 표시 길이12LU는 독립 미리보기의 정적 표적 비교이며 스폰 검사 통과가 아니라 별도 시각 크기 관측 대상이다.

## 귀환·상호작용 소유권

전장 귀환 위치(0,0,48)와 기존 host 원 반경12를 메타데이터로 유지했다. 새 상자 접점은 availability 표시만 한다. 화물/적 무력화에 따른 귀환 자격은 기존 sim 규칙이 우선한다. 접점과 선체가 겹친다는 이유로 자동 귀환하지 않는다.

항구에서 `harbor:repair`, `harbor:storage`, `harbor:settlement`, `encounters:departure` 접점을 같은 정박 포켓에서 고를 수 있다. 모두 `requiresConfirmation:true`다. 공방/창고/제작/수리/정산 ID/중복 지급 방지/안전 저장은 harbor에 넘기며 이 코드가 자원·소유권·캠페인 상태를 바꾸지 않는다.

## 카메라·로딩·측정

55도 정사영 검사 카메라, 선체/표적 각5개 평행 ray 표본으로 실제 모델 가림을 관측한다. 선체 yaw를 sample에 적용한다. 가리면 시각 인스턴스 재질만 투명화하며 충돌/피해 규칙은 바꾸지 않고 맑아지면 복원한다. `OutlineEffect.autoClear=true`를 명시했다.

필수 먼저·랜드마크 다음·선택 장식 후순위 로딩이다. 월드18종을 참조하며 원본 종항 전체 GLB는 사용자가 비교할 때만 로딩한다. 전체 장면은28,270,444bytes/1,634메시/165,329삼각형/6×2K 텍스처다. 내장 `@selected-airship`를 제외해 선체 중복을 막는다. `@suspension-beam/link`는 가림 대상 식별자로 보존했다. 가린 뒤 숨겨도 원본 전송량은 줄지 않는다. 새 독립 배치의 충돌을 원본 전체 비교 장면에 적용했다고 표시하지 않는다.

미리보기 관측 JSON은 fetch·parse/image decode 시간(첫 GPU 업로드 완료와 별개), 현재 모델 메시, renderer 텍스처/geometry, 윤곽 패스 포함 draw/triangles,5개 ray 가림, 표적 진단 원 투영 크기, 실제 복원 징세정 GLB bounds 투영 픽셀을 제공한다. 캐시를 유지하므로 cold/warm 구분은 loadLog와 QA phase를 확인한다. 소스 파일 구조 합계는 `spatial-verification.json.structuralEstimates`; 실측값으로 표현하지 않는다.

## 실제 수행한 검증

- `node --test tools/levels/adapter.test.mjs`:6건 통과. offset/yaw/scale 왕복, {x,z}/화면 bridge, 얇은 벽 고속 sweep, 점유 스폰, 무부작용 접점/카메라, 중심선만 맑은 좁은 통로 거부.
- `node tools/levels/validate.mjs --write`:336 assertions 통과, 실패0, 예상 기존 anchor advisory1. 실제 선택 GLB header/JSON/크기·카탈로그 참조,96/7 보존 수,5통로·6스폰·14 hero variant 경로와 hash기록, 선체 실제 accessor 측정, 실제 월드 시각 bounds의18LU 여유, trigger owner 확인. 전체 자산 binary hash 검사가 아니다. 선택 원본 선체만 build-data에서 SHA를 직접 대조했다.
- `node tools/levels/build.cjs`:독립 HTML 번들 생성 성공. 의존성은 통합 worktree의 기존 설치를 일회성 NODE_PATH로 읽었고 새 설치/공통 변경은 없다. 산출물에는 캐시 절대경로가 없다.
- 소스/빌드/브라우저검사 스크립트 Node 구문 검사 통과. 브라우저 실행·실제 GPU/픽셀 QA·모바일 기기·게임 플레이는 이 담당이 수행하지 않았다.

ready-3: 통합 담당의 독립 레벨 브라우저 실행은 두 레벨·통로·6 yaw·이미지 캡처까지 진행했으나 원본 종항 비교 버튼 클릭에서 중단됐다. `#full-scene`은 기본 닫힌 `<details>` 안에 있는데 검사 코드가 summary를 열지 않아 hidden timeout이 발생한 것이 원인이다. 검사 코드만 사용자와 같은 summary 클릭을 먼저 하도록 수정했다. 예외 발생 시에도 완료한 관측과 중단 원인을 `summary.json`에 남기도록 보완했다. 공간 데이터·뷰어·시각 자산은 변경하지 않았다. 전체 독립 브라우저 PASS는 통합 담당의 재실행 결과로 확정해야 한다.

ready-4: 통합 담당의 ready-3 재실행에서 독립 레벨 브라우저22/22 PASS, 오류·외부 요청·실패 로컬 요청0을 확인했다. 이후 독립 자원 감사에서 같은 레벨 재선택 시 텍스처 수62→122 증가가 관측됐다. `paintedClone`의 복제 SkinnedMesh가 렌더 시 만든 boneTexture를 기존 `disposeInstance`가 해제하지 않는 것이 원인이다. 복제 root를 순회해 고유 skeleton을 Set으로 모으고 `skeleton.dispose()`를 각각 한 번 호출하도록 좁게 수정했다. 기존 인스턴스 재질 해제를 유지하며 소스 캐시의 공유 geometry·map texture는 해제하지 않는다. 레벨 데이터·race 방지·ready-3 비교 패널 검사 수정은 보존했다.

새 전장 플레이 소스 `playable-*`는 별도 작업이므로 v1 snapshot에서 basename `^playable-`를 제외한다. v1 인계 목록은 기존17파일을 유지한다. ready-4의 Node 구문 검사·adapter6건·공간336항목·독립 v1 빌드를 이 담당이 다시 확인했다. 메모리 안에서 실제 Three.js SkinnedMesh와 SkeletonUtils 복제본을 만들고 같은 skeleton을 두 메시가 참조하는 회귀 검사를 실행했다. clone skeleton dispose1회·boneTexture dispose1회, 원본 skeleton/geometry/map/material dispose0회를 확인했다. 검사 파일·공통 의존성은 추가하지 않았다. 재선택 후 GPU 텍스처 수가 안정화하는지의 실제 브라우저 재검사는 통합 담당 소유이며 이 수정만으로 PASS라고 선언하지 않는다.

## 통합 담당의 다음 실행

공통 의존성이 준비된 통합 worktree에서 이 스냅샷의 두 폴더만 복사하고 `node tools/levels/build.cjs`, `node tools/levels/validate.mjs --write`를 실행한다. 추가 npm 의존성은 없다. 선택 npm scripts는 `build:levels`, `verify:levels`(adapter test+validate), `verify:levels-browser`를 기존 package에 통합 담당이 추가할 수 있다.

현재 로컬 root 서버에 LEVELS_URL을 설정해 `node tools/levels/verify-browser.cjs`를 통합 담당이 실행한다. 결과는 `work/verification/levels/summary.json`과 PNG다. cold ready·두 레벨·6개 yaw·실제GLB·원본 scene 전환 복귀·모바일 overflow·외부 요청/오류/로딩 실패와 관측값을 기록한다. 이 검사도 사람의 가독성·정식 성능 예산·재미/밸런스 통과와는 다르다.

통합 `outputs/integration-v1`은 레벨 JSON의 시각·프록시·앵커·접점을 선택해서 연결한다. `sim.mjs`를 또 다른 시간 루프와 함께 실행하지 않는다. 기존 월드의 circle8을 새 bridge로 공급한다면 원래 장애물 목록에 중복 추가하지 않는다. harbor AABB를 circle로 임의 환산하지 말고 호스트 충돌 어댑터를 선택한다. 최종 엔진/플랫폼/성능 예산·정밀 메시충돌·OBB·LOD·navmesh·대형 함대·조준 가독성 인간 관찰은 남은 범위다.
