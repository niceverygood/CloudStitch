# Cloudstitch 전장 v0.1

사용자가 2026-10-18 요청한 전장 구현. 기존 함대 제작 세션과 파일 소유를 분리한 로컬 브라우저 플레이 시제품이다. 특정 상용 게임 엔진이나 목표 플랫폼을 확정하지 않는다.

## 실행

저장소 루트에서 Node.js 20 이상과 기존 잠금 파일을 사용한다. 의존성이 없다면 `npm ci`를 실행한다.

```sh
node tools/battlefield/build.cjs
python3 -m http.server 8080 --bind 127.0.0.1
```

현재 빌드 기본 출력은 원본을 보존하는 `outputs/battlefield-v2/`다. `http://127.0.0.1:8080/outputs/battlefield-v2/index.html`을 연다. 맥북에서 받은 `outputs/battlefield-v1/`의 기존 실행물은 보존한다. GLB를 HTTP로 불러오므로 file:// 직접 열기는 지원하지 않는다. 파일은 `outputs/fleet-v1/ships/`에서 읽으며 서버 포트는 고정하지 않는다. 새 PC에서는 Git LFS 자산 다운로드도 필요하다. npm 스크립트/패키지/기존 뷰어/GLB/원화/공유 인수인계 파일은 이번 작업에서 변경하지 않는다.

## 조작과 흐름

WASD/방향키 이동, Space 가속, 마우스 조준·클릭 사격, F 인양, H 귀환, Tab 자동 조준 표적 전환, M 전체 항로, 휠 확대, Esc 일시정지. 화면 아래 기관총 버튼을 누르고 있으면 탄속과 적 이동을 고려해 가까운 표적을 자동 조준한다. 모바일은 왼쪽 스틱과 오른쪽 동작 버튼을 사용한다. 효과음은 오른쪽 위에서 켠다.

귀환호로 출항 → 녹슨 징세정의 주황색 골조 24HP를 기관총 3발로 절단 → 외부 갑판/함포/보조 엔진/보조 기낭 묶음 분리 → 거리 10 이내 F 인양 → 남쪽 수선항 청록색 원 안에서 H 귀환. 적 전멸 없이도 화물 1개 이상이면 귀환할 수 있다. 화물이 없으면 적을 모두 무력화해야 귀환한다. 포격 없는 탐색 모드도 제공한다.

기관총 단독 파괴는 형제 엔진을 떼어내지 않는다. 회수는 소유권과 화물 상태만 바꾸며 장착하지 않는다. 같은 묶음을 반복 회수해도 복제/신규 보상이 발생하지 않는다. W50/L65를 시작점으로 사용하고, 실제 화물 무게를 더한다. 과적은 7초 유예 뒤 실패하며 일시정지 화면의 화물 투하로 복구한다. 가속 아래 막대는 이 시제품의 회복형 가속 충전량이며 경제 자원 연료F가 아니다.

## 파일 소유

- `main.js`: 카메라, 렌더, HUD, 입력, 효과와 전장 연결
- `world.js`: 9개 부유섬/4개 원경, 수선항, 부서진 아치, 풍차, 정원, 수채 구름; 새 지역명은 이 시제품의 표시용 제안이다.
- `assets.js`: 기존 GLB 로드/정규화, 실제 포탑 조준, 프로펠러, 메타데이터에 따른 부품 숨김/분리 표시
- `sim.mjs`: 고정 시간 간격 전투, 단일 부모 부품 트리, 피격/차폐/소유권/인양/중량/귀환
- `sim.test.mjs`, `verify.cjs`: 규칙과 브라우저 검증
- `index.html`, `style.css`, `build.cjs`: 표시 소스와 재현 빌드

`OutlineEffect.autoClear = true`를 명시적으로 유지한다. CDN·외부 API·외부 글꼴·유료 생성 요청 없이 저장소 자산만 읽는다.

## 검증

```sh
node --test tools/battlefield/sim.test.mjs
BATTLEFIELD_URL=http://127.0.0.1:8080/outputs/battlefield-v1/index.html node tools/battlefield/verify.cjs
```

브라우저 QA는 `tools/lib/runtime.cjs`의 기존 Playwright 런타임을 사용한다. 실제 입력과 시험용 상태 배치는 보고서에서 구분한다. 결과와 화면은 `work/verification/battlefield/`에 생성하며 사용자 탭과 독립된 브라우저에서 검사한다.

## 구현 범위와 후속

P0 이동/조준과 P1 분리, P2의 회수·소유권·화물을 검증하는 한 전장이다. P2의 장착 편집, P3 전체 복구 체계, P4 항구 경제/정산/영속 저장, 캠페인, 패드 지원, 출항 성장, 무기별 완성 효과는 미구현이다. 귀환 결과창은 이번 항해만 보여 주고 새로고침/종료 시 초기화된다.

충돌은 임시 x/z 평면 원형 판정이며 기획U↔실제미터 확정이 아니다. 징세정만 실제 외부 연결부 묶음이 있고 다른 두 적선은 본래 부품을 선체 직속으로 대응한다. 연합의 쌍엔진·쌍기낭은 각각 묶음 표적이다. 적의 세 무기는 회피 학습용 느린 발사체 한 패턴을 공유한다. 포탑은 실제 조준하지만 정밀 메시 가림/고도/최종 포각·무기별 판정은 후속이다. GLB 원형은 변경하지 않았다.

브라우저 창 크기 검사는 실제 휴대전화 검증이 아니다. 자동 기능 검사는 사람의 재미/난이도/가독성 평가나 목표 기기 성능 통과를 의미하지 않는다. 공개 배포·스토어·저장·외부 업로드는 수행하지 않는다.

## 2026-10-18 데스크톱 연결 준비본

`integration.mjs`는 기존 `sim.mjs` 위의 입력·명령·이벤트 브리지다. 별도 전투 상태를 만들지 않는다. 월드 충돌/스폰, 외부 적 의도, 실제 포구 resolver, 일시정지/재시도, 확정된 항구 loadout 재출항을 받는다. `assets.js`는 실제 함대 카탈로그의 등록 ID와 리그 `Muzzle` 월드 프레임을 제공한다. `vfx.js`는 기존 기관총·함포 GLB 6개를 실제 발사/투사체/명중/종료 이벤트에 표시한다. 나머지 4무기는 자산 매핑만 있다.

기존 `main.js`의 독립 UI는 보존했으므로 그 UI의 임시 탄환/효과가 자동으로 이 새 VFX로 바뀌지는 않는다. 통합 화면은 브리지를 사용하고 VFX를 명시적으로 연결한다. 실행·전체 API·한계·검사·파일 해시는 `HANDOFF.md`와 `handoff-files.json`을 따른다.

```sh
node --test tools/battlefield/sim.test.mjs tools/battlefield/integration.test.mjs tools/battlefield/vfx-contract.test.mjs tools/battlefield/receipt.test.mjs
node tools/battlefield/verify-bindings.mjs
node tools/battlefield/example-adapter.mjs
```

예제의 포구/경계 이동은 명시한 fixture다. 실제 GLB 로딩·포구의 화면 일치·모바일·잔상 검사는 통합 담당이 실행한다. 이번 담당은 npm 설치·브라우저 QA·공통 파일 편집을 수행하지 않는다.
