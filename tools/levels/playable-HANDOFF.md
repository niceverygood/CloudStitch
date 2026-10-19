# Cloudstitch 실제 전장 화면 인계

준비 버전: **playable-battlefield-v1 / READY-3 / 2026-10-18**. 새 사용자 요청 “전장 제대로 구현해줘”에 따른 한 전장·한 항구의 플레이 화면이다. 기존 공간 검사 `outputs/levels-v1/`, 맥북 전장 `battlefield-v1`, 회귀용 `battlefield-v2`, 통합 `integration-v1`, 원화·GLB와 공통 package/lock을 보존한다. 기존 v1 공간 뷰어 자원 수정 ready-4와 별도로 인계한다.

## 결과와 실행

- 소스: `tools/levels/playable-*`.
- 실행물: `outputs/playable-battlefield-v1/index.html`, `playable.js`, `style.css`.
- 데이터/코어: 기존 `tools/levels/levels.mjs`, `tools/battlefield/{sim,integration,assets,vfx,world}`, `tools/encounters`, `tools/harbor`, `tools/shipyard`, `tools/save`를 상대경로로 재사용.
- 인계 파일/바이트/SHA: `outputs/playable-battlefield-v1/handoff-files.json`.

```sh
node --test tools/levels/playable-presentation.test.mjs tools/levels/playable-session.test.mjs
node tools/levels/playable-verify-source.mjs
node tools/levels/playable-build.cjs
node tools/levels/playable-serve.mjs
```

서버 기본 주소는 `http://127.0.0.1:8860/outputs/playable-battlefield-v1/index.html`이다. `PLAYABLE_PORT`로 포트를 바꿀 수 있다. 저장소 root HTTP 서버에서도 같은 출력 경로를 사용한다. 서버는127.0.0.1에만 bind하고 `outputs/` 내부의 허용 확장자만 읽는다. `file://` 직접 열기는 공유 GLB 로딩을 지원하지 않는다. 새 npm 의존성/설치는 없다. 기존 three/esbuild/Playwright를 사용하며 패키지와 무거운 QA는 통합 담당 소유다.

## 플레이와 표현

전체 화면 전장, 가까운55도 정사영 카메라, 작은 선체/기동 HUD·목표·항로 수첩을 제공한다. READY-2는 좁은 세로 화면에서 배만 보이고 적은 화면 밖에서 포격하던 구도를 개선해 가까운 위협을 포함하도록 카메라를24~44 half-height 범위로 자동 조절한다. 여전히 화면 밖인 포격 예고는 가장자리에 고정해 표시한다. 전투 사거리·피해·등장 규칙을 카메라에 따라 바꾸지는 않는다. 기술 격자·충돌 상자·아트 단위 수치를 기본 플레이에서 제거했다. 원본 입체 전장 `createWorld(THREE)`의 부유섬·난파 유적·풍차·정원·목재 부두·원경·구름을 표시 전용으로 재사용한다. 기존 아트 카탈로그 부표·난파 표식·항구 GLB도 실제 로딩한다. 시각 모델의 중심 정렬 후 별도 정규화 그룹에 크기를 적용해 위치가 밀리는 문제를 보정했다. 기존 world 함수가 반환하는 장애물은 **다시 주입하지 않는다**.

WASD/방향키 이동, 마우스 조준·클릭/J 사격, Space 가속, T 표적 전환, F 인양, H 귀환, M 항로 보기, 휠 확대, Esc 일시정지. 터치 화면은 이동 패드와 사격/가속/인양/귀환 버튼을 사용한다. 항구에서는 출항 버튼이나 공방 서랍을 사용한다. 회수 화물→창고→장착/수리→저장→재출항은 기존 거래 코어에 연결돼 있다.

목표 안내는 살아 있는 적/연결부→떠다니는 회수품→종항 귀환으로 바뀐다. 화면 밖 목표는 방향 화살표로 안내한다. 안내 함수는 상태를 읽기만 하며 적을 죽이거나 화물을 자동 회수하지 않는다. 실제 피격에는 짧은 산호색 화면 가장자리 효과를 표시한다. 적 GLB를 준비하는 동안 제품 입력 RAF가 전투 시간을 진행하지 않아 보이지 않는 적에게 공격받는 로딩 구간을 줄인다.

READY-2는 적 GLB 실패 시 pending만 사라져 전투가 진행되는 경계를 막는다. fleet modelErrors가 있으면 controller pause로 전투를 멈추고 일시정지 화면 위에 명시적 재로딩 버튼을 표시한다. 저장된 출항 경계를 다시 읽으며 실패 중 상태를 새 정상 저장으로 덮어쓰지 않는다. 같은 sim의 clear→새 wave에서도 사라진 actor ID에 속한 connector 링/label을 독립적으로 제거한다. 이 두 경계의 실제 로딩 실패/clear 브라우저 검증은 통합 담당의 targeted QA 대상이다.

READY-3의 기능 변경은 label 배치 한 곳이다. 좁은390×844 화면에서 예고 label의 중심만12% 가장자리에 고정해 왼쪽10px가 잘린 통합 QA 결과를 반영한다. 실제 label 폭/높이와 translate(-50%,-100%)를 고려해 네 가장자리8px 안쪽으로 배치한다. 전투·시간·저장·자원 수명은 변경하지 않는다.

## 상태·좌표·저장 소유

`playable-session.mjs`는 통합 담당이 검증한 controller의 보존된 복사 기반이다. **sim.mjs가 이동·시간·피해·투사체·부품·화물의 유일한 권위**다. encounters는 등장 순서/의도만, harbor/shipyard/save는 기존 거래/저장만 소유한다. 새 물리·피해 루프를 만들지 않았다. 하나의 controller를 제품 입력 RAF에서만 advance한다. renderer는 snapshot·events를 읽는다.

축은 XZ/+Y, heading0=+Z, 임시LU다. 원본 함대 -X 전방은 π/2 표시 변환으로 +Z에 맞춘다. player 표시 길이10, 기본 sim collider radius3, 인양 반경10, 귀환(0,48)/반경12는 기존 계약을 유지한다. 회전 외접 직경10.443862의 공간 검사와 gameplay radius3의 집계 프록시는 다른 범위다. 정밀 메시/OBB 충돌·고도 물리는 구현했다고 하지 않는다.

초기 UI는 명시적으로 localStorage를 controller에 전달한다. 저장 키는 **`cloudstitch.playable-battlefield.v1`**, 기존 `cloudstitch.integration.v1`를 덮어쓰지 않는다. 귀환 명령이 저장 실패 때문에 `ok:false`라도 UI는 최신 snapshot의 phase/dirty/정산 상태를 읽는다. 회수와 장착을 혼동하거나 중복 지급하지 않는 기존 정책을 유지한다.

향후 단계 맵 hook: `createVoyageController({stageId,seaLevel,harborLevel,storage,saveKey,muzzleResolver})`. `worldLevel`은 seaLevel의 호환 별칭이다. 새 맵은 기존 `visuals/colliders/spawnAnchors/triggers/playerStart` 계약을 따라야 하며 XZ circle은 `legacyCircleXZ`, 귀환은 `hostLegacyCircleXZ`를 명시한다. stage/route 선택과 activeVoyage의 저장 복원 정책은 후속 통합에서 함께 정해야 한다. 현재 UI는 첫 지역 한 항해만 보여 주며6개 지역 완성을 주장하지 않는다.

## 리소스와 표시

`OutlineEffect.autoClear=true`를 유지한다. clone 스켈레톤은 인스턴스가 제거될 때 고유 skeleton Set으로 정리한다. 공유 소스 geometry/texture를 dispose하지 않는다. 회수 묶음 재질은 독립 복사로 보유해 적 인스턴스 제거와 분리하고 종료 시 정리한다. 새 레벨의 실제 source cache와 GPU plateau는 별도 브라우저 측정 대상이다.

`window.__playableBattlefield`(기존 QA 호환 alias `__integration`)는 controller/snapshot/stats/capture/whenIdle를 제공한다. `setDriverMode(true)`는 QA 자동 입력 동안 제품 RAF advance를 멈추는 명시적 전용 경계다. QA pilot이 같은 controller를 가속 입력으로 검증할 때 두 advancer가 함께 실행되지 않는다. 정상 사용자 흐름에서는 false이고 별도 전투 시뮬레이터가 아니다.

## 실제 검증과 남은 확인

- 순수 안내/목표·표적·방향 표시6테스트 통과. 살아 있는 선택 표적 복구, 회수품/화물 귀환 우선순위, 정비/패배 분리, 화면 밖 화살표 경계, 마지막 적 무력화 뒤 미회수 잔해 안내, 살아 있는 attached connector 유무에 따른 선체/연결부 안내 확인.
- controller7테스트 통과: 실제 이동/사격/인양/귀환 입력 두 항해, 정산/부품 중복 방지, 수리/장착/새 controller 저장 복원, 일시정지, 저장 실패/손상/충돌, 실제 포격 패배/재시도. 시간은 가속했고 teleport/직접 피해/강제 승리를 주입하지 않았다. 결과 `rules-verification.json`.

QA pilot은 선체 바깥쪽을 공격해 부품 분리를 유도한다. `bundle-detached`를 확인했다는 이유로 연결부를 직접 조준해 명중한 브라우저 증거로 확장하지 않는다. 통합 담당의 READY-2 정상 브라우저18/18 PASS, 표적 검사23/24 PASS를 각각 보존했다. GLB 실패/실제 재로딩·자연 패배/재시도·4회 warm 왕복 GPU plateau·명시적 tax 표시 fixture clear·안내 조건은 통과했다. 남은1건인 좁은 화면 label 잘림만 READY-3에서 보정했으며 카메라/예고 표적 재검사를 기다린다.
- Node 구문·상대 import·HTML ID/명령 계약·기존 의존 파일 hash 기록과 빌드 확인. 결과 `source-verification.json`, `build-manifest.json`.
- 사용자의 현재 인앱 브라우저에서 기본 항구→실제 출항·적 표시/피격·패배→재시도·일시정지 화면을 확인했다. 이는 전체 전투/저장 브라우저 회귀 완료를 의미하지 않는다.
- **무거운 브라우저 QA는 준비 시점 pending**이다. 통합 담당이 아래를 실행하고 `browser-verification.json`을 확정한다. 기존 통합21/21·공간22/22 결과를 이 새 화면의 통과로 복사하지 않는다.

```sh
# PLAYABLE_URL=<현재root서버>/outputs/playable-battlefield-v1/index.html
node tools/levels/playable-verify-browser.cjs
```

한 Chrome 호환 세션에서 실제 키보드 이동/정지, 두 가속 입력 항해의 실제 GLB 포구·VFX·분리/인양/귀환·공방/저장/reload, 잔상·모바일 넘침·오류/외부 요청·로딩 실패를 기록한다. 결과는 outputs의 새 검사 JSON/PNG이며 중간 paused 화면은 `work/verification/playable-battlefield/`다. 인간의 재미·공정성·가독성·실기기/성능 예산·전체 보스 기믹/캠페인·정식 엔진 채택은 남은 범위다.
