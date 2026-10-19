# Cloudstitch 단계별 맵 v1

## 결과와 범위

기존 6지역에 대응하는 독립 항해 맵 6개를 새 경로에 구현했다. 선택 화면, 지형별 추천 항로와 안내점, 실제 카탈로그 GLB 지형, 기존 encounter의 적 출현, 인양·귀환·정산·저장을 연결한다. 원화와 기존 first-voyage 및 integration-v1 소스/산출물은 보존한다.

1. 종항 잔해 삼거리: 중앙 잔해 동쪽 항로와 서쪽 우회
2. 상승기류 사슬 협곡: 두 번 굽는 넓은 협곡
3. 폭풍벽 바깥 인양장: 중앙 암초 양쪽 큰 우회
4. 쇠갈비 공용 작업장: 철골 사이 세로 통로와 가로 교차로
5. 저층 안개 부표길: 엇갈린 잔해와 부표를 따라가는 항로
6. 황궁 외곽 접근로: 외곽 서비스 덱을 바라보는 갈라진 접근로

35개 보수적 충돌 원, 39개 적 출현 후보, 19개 추천 항로를 저작했다. 실제 충돌은 기존 sim의 원형 프록시이며 AABB는 공간 검사 자료다. 수치는 임시 LU이고 미터 환산/성능 예산/엔진 채택을 뜻하지 않는다. 풍압·번개·안개 피해, 새 필수 단서·보상, 이야기 해금, 지역 간 공유 창고/캠페인 진행은 구현하지 않았다. 안내점 번호는 지형 안내이며 전투 완료 조건이 아니다.

## 실행·빌드

기존 통합 checkout의 설치된 esbuild와 renderer/컨트롤러/전장/encounter를 재사용한다. 패키지·잠금 파일 변경이나 설치는 없다.

```powershell
node tools/stage-maps/build.cjs VERIFIED_INTEGRATION_CHECKOUT
node --test tools/stage-maps/maps-data.test.mjs tools/stage-maps/selection.test.mjs tools/stage-maps/session-bridge.test.mjs
node tools/stage-maps/verify-runtime.mjs
node tools/stage-maps/finalize.cjs
```

`outputs/stage-maps-v1/index.html`은 HTTP로 제공해야 한다. `outputs/world-assets/`, 기존 전투 자산과 VFX의 상대 URL을 그대로 사용한다. 배포나 외부 서비스 생성은 없다. 예: 기존 통합 서버의 `/outputs/stage-maps-v1/?map=map-02-canyon`.

## 권한과 연결

`build.cjs`는 기존 `tools/integration/session.mjs` 원문을 수정하지 않는다. 그 importer의 `./contract.mjs`와 `../levels/levels.mjs` 두 import만 새 bridge로 지정한다. 나머지는 검증된 컨트롤러/전장/encounter/renderer를 그대로 묶는다. UI는 검증된 통합 UI를 새 폴더에 복제해 단계 선택과 지도 안내를 추가했다. 하나의 controller, 하나의 advance 루프, 동일 renderer/VFX가 권한을 가진다. 초기 화면·출항·재도전·새 적/인양물 등장 시 renderer.render로 큐를 만든 뒤 whenIdle 완료까지 own presentationLoading/busy 경계로 전투 진행을 기다린다. 기존 renderer에 없는 actorsPending getter를 가정하지 않는다. `OutlineEffect.autoClear=true`는 기존 renderer에서 유지한다.

own `renderer-bridge.mjs`는 원본 renderer의 공개 API를 감싼다. 같은 sim에서 적 ID가 제거되면 기존 reset API로 connector/label을 포함한 표시물만 정리하고 같은 snapshot을 다시 그린다. sim 상태나 시간은 바꾸지 않는다. own 적재 경계가 끝난 뒤 modelErrors가 있으면 전투를 일시정지하고 재불러오기 화면으로 진행을 막는다. 실패한 적 모형이 보이지 않는 상태로 공격하지 않는다. 이 두 표시 보완은 frozen integration-v1 원본에 반영하지 않으며 source-manifest.rendererPolicy에 명시한다.

로딩 오류 화면은 `#loading-screen`의 z-index 12로 일시정지 창보다 위에 표시한다. 정상 화면/저장 133개 브라우저 검사는 이전 동일 JS bundle에서 통과했으며, 이 CSS 표시 수정 뒤 오류 화면의 실제 버튼 hit-test/클릭과 표시 정리는 별도 fault 회귀 보고서로 구분한다.

URL `map`은 6개 저작 ID whitelist다. 항해 중이거나 출항 체크포인트가 남아 있으면 변경 버튼이 비활성이다. 항구에서 현재 항로 저장 성공을 확인한 뒤 URL을 바꾸고 페이지를 새로 연다. 맵마다 독립 초깃값과 별도 저장을 사용하는 시제품이다. 기존 `cloudstitch.integration.v1` 키는 읽거나 쓰지 않는다.

저장 키: `cloudstitch.stage-maps.v1.<mapId>`. 상태의 `route`는 `routeId`, `routeVersion=1`, `stageId`, `levelId`, 전체 seaLevel의 `layoutHash`를 정확히 포함한다. 기존 저장 schemaVersion 1과 원자적 single-key journal은 유지한다. current·모든 backups·conflict sidecar까지 검사하고 불일치/손상이면 원문을 보존한 채 시작을 막는다. 초기 저장 실패도 메모리상의 성공 상태로 시작하지 않는다. UI에서 원본 JSON을 내보낼 수 있다. 자동 재설정/마이그레이션은 없다. FNV는 우발적 불일치 검출용이며 인증이 아니다. 같은 origin의 여러 탭 동시쓰기 CAS는 구현하지 않았다.

## 실제 검증

- 공간·선택·저장 브리지 Node 검사를 `unit-verification.json`에 기록한다.
- `runtime-verification.json`: 6맵 모두 실제 컨트롤러의 다른 stage/level·장애물·적 출현 확인, 출항 저장 복원 후 같은 항해 ID로 재출항.
- 1맵 실제 입력 기반 사격·분리·인양·안전 철수 2회. 각 214 step, 사격 20회·명중 12회·분리/인양 각 1회, 실제 피해 9. 정산 2건·부품 9개·S114/F40/C2. 디스크 journal을 새 Node 프로세스에서 전체 상태 일치로 복원. 중복 귀환과 화물 보관 전 출항 차단 확인.
- HP 수정, 순간이동, fixture 귀환, 새 enemy spawn 주입 없이 기존 pilot의 public 입력을 사용했다. Node의 기본 평면 포구 검증이며 실제 GLB 포구·외관은 브라우저 QA 범위다.
- 모든 보스와 6지역 전체 완주/밸런스 검증을 뜻하지 않는다. 브라우저 보고서는 통합 담당의 별도 `outputs/stage-maps-browser-qa-v1/`에서 확인한다. 이전 integration-v1 QA 결과를 이 새 맵의 QA로 재사용하지 않는다.

## 전달

`source-manifest.json`은 실제 bundle 입력 소스 SHA256과 두 import 교체 범위, 화면 출력 해시를 기록한다. `delivery-manifest.json`은 새 outputs의 산출물 path/bytes/SHA256과 own source 목록을 기록한다. 통합 담당은 새 출력 경로만 hash 확인해 복사하고 기존 integration-v1 manifest/보고서는 변경하지 않는다. READY 이후 수정하면 반드시 다시 빌드·검증·manifest를 발급한다.

브라우저 QA API는 `window.__stageMaps`이며 기존 통합 QA API와 같은 command/snapshot/controller/renderer/whenIdle/capture/dispose 및 선택 map을 제공한다. `setDriverMode(true)`는 제품 RAF의 advance를 멈추고 QA pilot에 명시적으로 입력 슬롯을 넘긴다. 종료 후 false로 돌린다. `loading`으로 own 적재 경계를 확인한다. 출항 적재 중 blur/hidden은 pauseRequested로 예약하고 busy 종료에서 실제 일시정지한다. 직접 state 수정은 피하고 실제 명령·입력으로 확인한다.
