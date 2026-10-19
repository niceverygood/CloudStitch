# Cloudstitch · 이어지는 여섯 항로 v1

현재 전달 revision은 2다. 저장/schema/6지도/전투 수치는 revision1과 동일하며 아래의 실제 포구 조준 정합·QA 진전 집계만 보완한다. 최신 10배 체감 아트/음향 기준을 읽었으나 이번 기능 교정을 그 표현 목표의 완료로 표시하지 않는다. 항구/귀환/수리 표현 재설계와 실제 전후 비교는 별도 소유 revision에서 다루며 정산/저장 규칙을 표현으로 바꾸지 않는다.

## 목적과 실제 동작

사용자 요청인 1→6 순차 항해와 함선·장착품·창고·화물·자원·진행의 공유 저장을 새 실행 경로에 구현했다. 기존 `outputs/stage-maps-v1/`의 독립 항해와 6개 저장 키, 동결 integration 원문·원화는 보존한다. 새 소유 범위는 `tools/voyage-campaign/`, `outputs/voyage-campaign-v1/`다.

1. 새 연속 항해는 종항 1단계에서 시작한다. 카드에는 현재·완료·잠김을 표시하고 임의 단계 점프를 제공하지 않는다.
2. 각 단계에서 opening→midboss→수동 maintenance→late→finalboss→victory를 마친 뒤 남쪽 귀환 원 안에서 귀환한다.
3. 실제 안전 귀환 정산과 해당 단계 완료를 한 journal write로 저장한다. 조기 철수는 같은 단계에 남고 회수품·실제 지출·손상만 정산한다.
4. 화물·장착·정비를 정리하고 변경을 저장한 다음 ‘다음 항로’를 누르면 현재 재산을 그대로 보존한 다음 단계 후보를 저장한다. 성공한 경우에만 맵과 커서를 교체한다. 화물 자체는 단계 이동으로 삭제되지 않으며 출항 전 보관 규칙을 유지한다.
5. 6단계 귀환 완료 후 최종 완료 상태가 남고 같은 항구에서 창고·장착·수리·저장을 계속 사용할 수 있다. 추가 단계나 새 게임 자동 초기화는 없다.

기존 선택선·6지도·지역 프리뷰·손그림 renderer를 읽기 재사용한다. 크림 천·꿀빛 목재·청록·황동과 편안한 명암·윤곽의 상시 아트 방향을 유지한다. 새 이미지/3D 생성, 유료 작업, 원본 재제작은 없으며 신규 시각 자산의 미술 승인을 주장하지 않는다.

## 저장 계약

- 단일 키: `cloudstitch.voyage-campaign.v1`. 기존 integration 및 단계별 키를 읽거나 변경하지 않는다. 예외는 사용자가 ‘이전 기록 가져오기’를 눌렀을 때 선택한 단일 단계 저장을 읽기 복사하는 경우다.
- 기존 `schemaVersion:1` 항구 상태의 ship/parts/resources/settlements/repairReceipts/voyageSequence/profileId/ownerId를 한 상태로 유지한다. 새 항해 ID는 동일 선장의 전역 voyageSequence를 계속 증가시킨다. 단계 이동으로 예시 함선이나 자원을 다시 만들지 않는다.
- `campaign={version:1,campaignId:'cloudstitch-six-v1',manifestHash,currentStageIndex,completedStages}`. currentStageIndex는 0~5다. manifestHash는 6개 지도 binding 전체의 FNV-1a다. state.route는 현재 지도 ID/routeVersion/stageId/levelId/layoutHash와 정확히 일치한다.
- completedStages는 1단계부터 연속된 prefix이며 각 항목은 stageId/levelId/layoutHash/voyageId/settlementId/proof를 갖는다. proof는 phase victory와 중간·최종보스 격파 각 1회다. 같은 전장 귀환 completed receipt가 실제 원장에 있어야 한다. 중복·건너뛰기·다른 항해/지도/버전·지형 hash 불일치는 거부한다.
- 현재와 모든 백업은 각 체크포인트 자신의 단계 기준으로 검증한다. 이전 단계의 정상 백업은 허용하고 손상된 current/backup/conflict는 원문을 보존하며 자동 재설정하지 않는다. FNV는 우발적 손상 검출이며 인증이 아니다. 기존 단일 키 원자적 저장/최대 백업 정책을 유지하고 탭 간 CAS는 추가하지 않는다.
- 출항은 prepare→편성/전장 사전 확인→departure 저장 성공→commit 순서다. 항해 중 재실행은 **저장된 같은 단계·같은 항해 ID의 출항 직전**으로 돌아온다. 전투 프레임·적 잔여 HP·중간 정비 시점 자체를 저장하는 기능은 없다. 단계 완료와 항구 재산은 안전 지점에서 저장된다.
- 귀환 저장 실패면 새 정산·완료 후보는 메모리에 dirty로 유지하고 다음 단계/재출항을 막는다. 같은 return/save 재시도만 정상 저장하고 중복 지급·중복 완료하지 않는다. 재실행하면 마지막 정상 departure 체크포인트가 복원된다. 미저장 결과가 디스크에 보존된 것으로 표시하지 않는다.
- next-stage/import는 후보 저장 실패 시 live 상태·맵을 바꾸지 않는다. 다른 탭의 revision 충돌도 덮어쓰지 않는다. 기존 dirty restore 제한과 충돌 sidecar 보존을 유지한다.

## 이전 독립 기록 가져오기

첫 출항 전 전용 선택 UI에서 이전 6개 독립 저장 중 **한 기록**을 선택할 수 있다. 해당 journal 전체와 route binding을 검증하고 활성 항해가 없는 harbor/debrief만 받아 함선·부품·소켓·화물·창고·자원·원장·순번을 그대로 복사한다. 연속 진행은 1단계부터 시작하며 이전 독립 전투를 캠페인 완료로 해석하지 않는다. `campaignImport`에 출처 지도와 domain revision을 남긴다. 서로 독립된 6개 원장은 자동 합치지 않는다. 이미 연속 항해를 시작한 기록은 교체하지 않는다. 가져오기 실패 시 양쪽 원문을 보존한다.

## 권한과 읽기 의존성

`session.mjs`는 frozen `tools/integration/session.mjs`에서 파생했다. 원본 SHA와 정책을 source-manifest.controllerOrigin에 기록하며 원문 파일은 수정하지 않는다. 새 controller가 공유 ledger/진행/완료 후보를 소유하고 기존 battlefield adapter/sim이 시간·이동·HP·피해·분리·회수·귀환을, encounter director가 등장/교전 순서를 소유한다. 완료 판정은 같은 stage의 director victory + clearance 없음 + activeEnemyIds 0 + 중간·최종보스 격파 각1과 안전 귀환 정산을 함께 요구한다. sim의 battle-cleared 하나만으로 단계를 해금하지 않는다.

읽기 의존성: 기존 stage-maps/maps.mjs·renderer-bridge.mjs, 항구 core/adapters/fixtures, shipyard, save, 검증 통합 checkout의 sim/adapter/encounter catalog·director·attack intents/budget/contract/levels/base renderer/VFX. 추가 적의 aggregate proxies와 warned training shots를 유지한다. 독립 XYZ 비행 실험·주인공 상태 갤러리·새 적 아트를 자동 게임 설치하지 않는다. 전투 수치·보상·충돌을 새로 정하지 않는다.

UI는 하나의 controller와 advance 루프를 사용한다. map 변경은 renderer.reset과 render→whenIdle 경계를 거친다. 새 적/화물 적재 중 시간이 멈추고 modelErrors는 재불러오기 화면으로 차단한다. blur/hidden이 busy 중 발생해도 pause를 예약한다. 오류 화면 z-index12로 실제 재불러오기 버튼이 pause 창보다 위에 표시된다. 같은 sim의 적 ID 제거 때 기존 renderer bridge가 연결부/label을 정리한다. `OutlineEffect.autoClear=true`를 유지한다.

### Revision1 실제 GLB 실패와 revision2 교정

revision1(source6197d914…/delivery8ce50780…)의 Node 6단계 입력은 통과했지만 실제 GLB 포구 브라우저에서는 첫 중간보스가 HP96을 유지하며 pilot timeout이었다. 원FAIL 보고서는 통합 QA의 `runtime/browser-verification.json`으로 보존한다. opening 2척만 격파했으며 이 실패를 6단계 브라우저 통과로 합산하지 않는다. pilot의 이전 hits에는 장애물 충돌이 섞였다는 한계도 확인했다.

기존 player GLB 포탑은 배 중심에서 약3LU 앞쪽에 있지만 base aimAt는 배 중심→target 방향으로 회전한다. 옆으로 움직이는 자세에서는 실제 포구 ray가 조준선과 평행하게 치우칠 수 있다. revision2의 own renderer는 playerAsset.aimAt 인스턴스만 감싸 실제 세계 포구 위치를 읽고 target−socket 방향으로 yaw 입력을 최대8회 정합한다. 발사 프레임은 기존 GLB의 실제 position/direction을 그대로 반환하며 새 광선 합성, model/공통 loader/renderer 원문·sim 피해·충돌 변경은 없다. 같은 교정이 화면의 포탑과 실제 발사 resolver 모두에 적용된다. stats.socketAim으로 수렴·오차를 관찰할 수 있다.

분리된 analytic socket 검사는 128개 선체방향/목표방향/거리 조합에서 기존96개가 root 반경1.7 밖으로 빗나가는 경우를 재현하고 최대0.00185LU/5회 이내 정합했다. 실제 GLB 브라우저 확인은 별도다. pilot은 module hit만 명중·진전으로 세고 obstacleHits를 별도 기록한다. 타임아웃 확대·HP 수정·강제 승리로 교정을 대체하지 않는다.

## 실행·검사

```powershell
node tools/voyage-campaign/build.cjs VERIFIED_INTEGRATION_CHECKOUT
node --test tools/voyage-campaign/campaign.test.mjs tools/voyage-campaign/storage.test.mjs
node tools/voyage-campaign/verify-session.mjs
node tools/voyage-campaign/finalize.cjs
```

공통 의존성을 새로 설치하지 않고 검증 checkout의 esbuild를 재사용한다. HTTP 진입점은 `/outputs/voyage-campaign-v1/`. 기존 world/fleet/VFX 상대 경로가 필요하며 file:// 직접 실행은 지원하지 않는다. URL query는 진행 권위가 아니며 저장된 currentStageIndex로 재개한다.

Node 단위 검사는 synthetic core receipt fixture를 사용해 규칙·실패·불변성을 확인한다. 실제 입력 검증은 별도 `runtime-verification.json`이다. 6개 지역의 네 교전 구간과 수동 정비·안전 귀환, 적 48척의 실제 피해/격파를 거쳐 순차 완료했다. 첫 항해에서 실제 적 탄 피해를 받고 실제 항구 수리비 S3을 지출했다. 회수 엔진 E2 장착·창고 누적·S117/F40/C2·부품17개를 6단계 끝까지 유지했고 6번의 departure 복원과 새 Node 프로세스 최종 상태 exact restore를 확인했다. 조기 철수 해금 차단, 실제 패배 후 같은 항해 retry, 실제 승리 후 귀환 저장 실패/재시도, 단계 전환 저장 실패/중복 전환, 안전 이전 기록 가져오기/실패 원본 보존도 검사했다. HP/적 HP 수정·순간이동·인위적 격파·가짜 귀환 없이 공개 입력을 사용했다.

이는 기존 6지역 **전투 시제품** 순차 항해 검증이다. 정사 보스 전체 기믹·기억/대화·결말·완성된 이야기 캠페인 구현이나 밸런스 확정을 뜻하지 않는다. Node의 평면 포구와 실제 GLB 포구의 차이는 브라우저 QA에서 구분한다. 브라우저 결과는 통합 담당의 별도 `outputs/voyage-campaign-browser-qa-v1/`에 기록하며 이전 stage-maps의 133/6 결과를 새 완료 수로 재사용하지 않는다.

## 브라우저 인계와 동결

`window.__campaign`: ready, command(type,payload), snapshot, controller, renderer, stats, map getter, whenIdle, setDriverMode, loading, capture, dispose. `campaign.js`는 제품, `qa-driver.js`는 명시적으로 불러올 QA 전용이다. 후자는 `window.campaignQA.run({qa,depart:true})`로 실제 입력 한 단계 완주를 수행한다. 실행 중 setDriverMode(true)로 제품 RAF의 advance 슬롯을 넘겨받고 새 단계·적 적재를 await한다. 종료 시 슬롯을 반환한다. simulation fixture와 실제 입력 증거를 섞지 않는다.

통합 QA 요청: 실제 첫 출항→full victory/return→보관/수리/장착/저장→next-stage→6단계 종료 및 refresh 재개, 같은 함선/ID/창고/자원 유지, 단계 점프/중복 완료 차단, 귀환/next 저장 실패 복구, 출항 재실행·실제패배 retry, 이전 기록 import/원본 보존, model abort/blur/connector 정리, 모바일 넘침/외부요청/404/page errors. 기존 integration·stage-maps 산출물과 저장 raw는 그대로 보존한다. 무거운 브라우저/공통 서버/의존성은 통합 단일 슬롯에서 수행한다.

delivery-manifest는 own source와 출력의 repo-relative 경로·크기·SHA256이다. source-manifest는 실제 bundle 입력과 원본 controller 출처 hash다. runtime은 해당 source-manifest hash에 결속한다. READY 후에는 동결하며 수정 필요 시 새 revision 전체를 재발급한다.
