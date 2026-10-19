# Cloudstitch · 종을 삼킨 자 · 독립 3D 리뷰 v1

직접 사용자 요청: 보스 구현 및 리뷰. 신규 소유는 `tools/chapter1-boss-review/` → `outputs/chapter1-boss-review-v1/`.
기존 함대19/이전13의 보스와 원화·정사·sim·공통패키지는 읽기 보존한다.

원화 `outputs/chapter1-final-boss-moodboard-v1/moodboard.png`를 독립 입체 모델로 해석한다.
최신 10배 이상 대담한 표현 기준은 큰 괴수형 철갑 턱과 굽은 엄니 충각, 부풀린 다중 기낭, 열린 거대 황동 종실, 겹포대·비대칭 연통 왕관·윈치로 구체화했다.
먹청 철갑/검붉은 장막/크림 천/청록 기관/황동을 매트한 정점 채색과 좌표 붓결·단계 명암으로 표현한다.
그림 일대일 복제나 사람의 미술 승인은 아니다. 실제 렌더 확인 전에는 외형 검수 통과라고 하지 않는다.

8개 검수 그룹은 철갑 선체/기낭/괴수형 선수/중앙 종실/포대/인양 장치/기관/장막이다.
속이 빈 LatheGeometry 종과 실제 종추, 구부러진 테이퍼 충각, 전체 후면·하부를 모델링했다.
GLB에는 6초 전시용 클립1개(종 지지 피벗1+프로펠러3의 quaternion 트랙4)를 포함한다.
좌표: +Y 위, -X 선수, +X 후방기관. 치수는 상대 미술 단위이며 미터/장착/충돌 크기 명세가 아니다.

검수 화면: 실제 GLB를 내장하고 회전/확대/이동/맞춤/초기화/자동회전, 손그림·셀·원본 재질, 윤곽, 부위별 확대/숨김, 장치 동작, 원화 비교, 로컬 의견/JSON, GLB 다운로드를 제공한다.
이전 `outputs/fleet-v2/ships/boss-bell-devourer.glb`를 독립 로딩하고 길이32 기준으로 정규화해 동일 카메라에서 토글 비교한다. 실제 게임 크기 비교가 아니다.
추가 셀 명암·윤곽은 HTML 런타임 기능. `OutlineEffect.autoClear = true` 유지.

경량 preflight: 형상 생성·중복명/유한정점/양의 경계/8그룹/클립1·트랙4 검사. exporter/browser 없이 실행 가능.
실제 exporter·브라우저·캡처·무거운 QA는 중앙 단일 슬롯에서 실행한다.
실제 검사 결과는 `verification.json`과 `model-manifest.json`을 확인한다. 파일이 없으면 아직 소스 READY 단계다.

실행 (기존 three/esbuild/playwright/gltf-validator 설치를 NODE_PATH로 제공, 설치/공통파일 변경 없음):

1. `node tools/chapter1-boss-review/prepare.cjs` (기존 기지 리뷰 UI 읽기 fork, 새 소유 경로만 작성)
2. `node tools/chapter1-boss-review/build.cjs --prepare` (번들만)
3. 예약 슬롯에서 `node tools/chapter1-boss-review/build.cjs --execute` (GLB+오프라인 리뷰)
4. 예약 슬롯에서 `node tools/chapter1-boss-review/qa.cjs` (실제모델/3모드/조작/모바일/다운로드/잔상/클립/이전비교)

예산: 보스1 모델 export, 브라우저1 컨텍스트, 120프레임×3모드 잔상, 대표/세부/동일카메라 전후 PNG, 모바일390px. 새 전체686자산 검사 없음.
미구현: 실제 보스전/AI/피해/회수/절단/물리/장착소켓/LOD/엔진통합/성능 예산. 포대 수·치수·연출 강도는 전투 수치가 아니다.
추가 Meshy·AI 이미지·유료 API 호출0. 동결 기존 결과와 원화 유지. commit/push/배포 없음.

## 실제 결과 · output-r2

중앙 START 후 source-r3 8/8 사전·사후 SHA 일치. export exit0, 실제 Chrome155 브라우저 QA exit0 / 49/49 PASS, finally 브라우저 종료.
실제 GLB: 21,826,096바이트, 201,696삼각형/41메시/12재질/텍스처0, 6초 전시 클립1개·트랙4개.
공식 glTF-Validator 오류0/경고0/정보0. 실제 GLB 로딩·3표시모드·3×120프레임 잔상(diff0)·회전/확대/맞춤/초기화·윤곽·390px 넘침0·클립 동작·동일 카메라 이전 비교·메모/다운로드 검사를 통과했다. 외부HTTP·페이지 오류0.
실제 iso/후면/종실/전체 화면 PNG를 직접 확인했다. 큰 철갑 선수·엄니·기낭·황동 종과 추진부는 입체로 읽힌다.
다만 원화 대비 판금 표면의 붓결·장식 밀도와 조각적인 덩어리가 단순하며, 첫 리뷰 시안이다. 최신 ‘10배’ 미술 목표 달성이나 사람의 미술 승인으로 표시하지 않는다.
`catalog.json`은 저장소 루트 상대 경로 계약이며 실제 GLB SHA와 previewSourceSha256이 같다. `READY-r2.json`이 현재 최종 파일 목록이며 이전 READY-r1은 포장 이력으로 보존한다.
리뷰 페이지를 Codex 브라우저에 열기 요청했고 queued 응답을 받았다. 파일 자체는 오프라인 file://로 실제 검수했다.
