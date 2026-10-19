# 항구·개조·정산·저장 인계

준비 버전: **harbor-v1.0.0-ready**. 2026-10-18 한국 시간 기준, 아래 파일의 한 시점 인계입니다. 통합 담당이 이후 실제 연결/브라우저 검증을 수행합니다. 이 담당은 원본·공통 package/잠금 파일·의존성·다른 담당 폴더를 수정하지 않았습니다. commit/push/배포·유료 생성은 하지 않았습니다.

## 원본 확인과 범위

시작 HEAD는 `fb850f7`, git status는 clean이었으며 `README.md`, `docs/HANDOFF.md`, `docs/CONTINUE_PROMPT.md`, `AGENTS.md`를 읽었습니다. 처음에는 `tools/airship-rig/`, `tools/fleet/`, `tools/battlefield/`, `tools/encounters/`와 각 `outputs/*-v1/`가 없었습니다. 통합 담당이 원격 `e65ab87`의 맥북 원본을 찾고 없는 파일만 공유 저장소로 복원했습니다. 복원 receipt는 `work/integration-transfer/source-receipt.json`이며 Git 제외 중간 기록입니다. **이 담당은 맥북 결과를 재제작하거나 이관했다고 주장하지 않습니다.**

`tools/harbor/`, `tools/shipyard/`, `tools/save/`와 `outputs/harbor-v1/`는 원격에도 없던 **새 요청 범위**입니다. 원본 전장/함대/리그/encounter를 대체하지 않습니다. 맡은 범위 내 현재 누락된 맥북 원본 경로는 없습니다. 다만 엔진·표준 소켓·실제 게임 저장 형식은 여전히 미확정입니다.

## 실행과 파일

```sh
node tools/harbor/build.mjs
node --test tools/harbor/core.test.mjs tools/shipyard/shipyard.test.mjs tools/save/save.test.mjs
node tools/harbor/verify.mjs
node tools/harbor/finalize.mjs
```

Node 20 이상과 built-in 모듈만 필요합니다. npm 설치나 추가 의존성은 **0**입니다. 통합 담당이 선택해서 추가할 수 있는 npm scripts: `build:harbor=node tools/harbor/build.mjs`, `verify:harbor=node --test tools/harbor/core.test.mjs tools/shipyard/shipyard.test.mjs tools/save/save.test.mjs && node tools/harbor/verify.mjs`. 공통 package는 수정하지 않았습니다.

| 파일 | 역할 |
|---|---|
| `tools/harbor/fixtures.mjs` | 독립 시작선·귀환 예시 데이터 |
| `tools/harbor/core.mjs` | 상태 검증, 출항 준비/확정, 중복 방지 귀환 정산, 화물 보관 |
| `tools/harbor/adapters.mjs` | 종항 카탈로그 접점, 읽기 전용 전장 귀환 변환/출항 manifest |
| `tools/harbor/app.mjs`, `template.html` | 한국어 예시 UI |
| `tools/harbor/build.mjs` | 의존성 없는 고정 ESM subset 번들러, 별도 HTML 생성 |
| `tools/harbor/core.test.mjs`, `verify.mjs` | 규칙/어댑터 검사와 Node DOM shim UI callback 검사 |
| `tools/shipyard/shipyard.mjs`, `shipyard.test.mjs` | 장착 트리·예산·수리 견적/실소비 |
| `tools/save/save.mjs`, `save.test.mjs` | 버전형 안전경계 journal·백업·명시복구·저장장애 검사 |
| `outputs/harbor-v1/index.html` | 열어볼 독립 시제품 |
| `outputs/harbor-v1/world-contacts.json` | 카탈로그로 확인한 항구 접점 |
| `outputs/harbor-v1/verification.json`, `delivery-summary.json`, `file-manifest.json` | 예시 검증 범위·인계 스냅샷·전체 선별 파일 크기/해시 |

## 상태 계약

```js
{
  schemaVersion: 1, profileId: 'example-captain', ownerId: 'player', revision: 0,
  phase: 'harbor', // harbor | sailing | debrief
  boundary: 'harbor', // harbor | departure | return
  voyageSequence: 0,
  activeVoyage: null, // {id, departureResources:{S,F,C}}
  resources: {S:120,F:40,C:2}, settlements: [], repairReceipts: [],
  ship: {id:'player-homeward',rootId:'homeward:hull',passengerWeight:0,
    sockets:[{id:'E2',parentId:'homeward:hull',kinds:['engine'],enabled:true}]},
  parts: [{id,kind,name,hp,maxHp,weight,lift,powerSupply,powerDemand,ownerId,
    source:{originId,assetId,acquiredVoyageId},
    location:'installed',parentId:null,socketId:null}]
}
```

위 코드는 필드 모양입니다. 실제 완전한 시작값은 `createExampleState()`를 사용하세요. `part.id`는 장착·화물·창고 전체에서 하나이며 부모는 문자열 하나 또는 null입니다. 핵심 hull 루트 외 모든 장착 부품은 실제 등록된 소켓과 단일 부모를 거쳐 루트에 도달해야 합니다. 분리 묶음 내부 부모 링크를 유지하고 묶음 루트만 null로 만듭니다. 부품 출처의 originId는 같은 출처 묶음에서 반복될 수 있습니다. assetId는 문자열이며 실제 카탈로그 참조 또는 명시적 `independent-example-wreck` 표시입니다.

시작선 예시는 문서50의 합산 W50/L65/발전14/소비10을 재현합니다. 회수 예시와 손상은 별도 가정입니다. 화물은 중량만 더하고 창고는 무게/출력을 더하지 않습니다. 기낭만 50% 미만 HP에서 선형 양력 감소를 적용합니다. 다른 활성 장치 출력은 HP>0일 때 주어진 값을 사용합니다. 과전력 장착을 거부하는 엄격한 항구 예시 정책이며, 전장 지원 장비 우선순위 shedding의 최종 규칙은 아닙니다.

## 공개 API와 호출 순서

모든 domain 함수는 원본 입력을 바꾸지 않고 성공 후보 `state`를 반환합니다. 실패는 `ok:false`와 `message` 또는 `reasons:string[]`입니다.

```js
createExampleState() // complete independent fixture
validateState(state) // string[]; empty = format/identity/tree valid, not flight-ready
prepareDeparture(state) // {ok,state,voyageId}; phase harbor, boundary departure
repo.save(prepared.state,{expectedRevision:saveRevision,boundary:'departure'})
commitDeparture(prepared.state) // only after successful save; {ok,state,voyageId}
acceptReturn(sailingState,result) // {ok,state,receipt,duplicate?}; phase debrief
repo.save(returned.state,{expectedRevision:saveRevision,boundary:'return'})
storeCargo(state) // cargo -> warehouse, preserving all bundle IDs/internal links

computeBudget(state) // installedWeight,cargoWeight,passengerWeight,weight,lift,
  // powerSupply,powerDemand,liftMargin,powerMargin,canLift,hasPower
previewInstall(state,partId,socketId) // {ok,reasons,before,after,partIds,state?}
installPart(state,partId,socketId) // same; increments domain revision
removePart(state,partId,{destination:'warehouse'}) // entire subtree
quoteRepair(state,partIds?) // unpaid {ok,quoteId,revision,fingerprint,partIds,recovery,cost}
confirmRepair(state,quote) // {ok,state,actualCost,recovery,...}; one receipt
departureReasons(state) // string[]
```

출항 준비 상태를 저장한 뒤 재실행하면 동일 activeVoyage에서 commitDeparture로 이어갑니다. 새 voyage ID를 다시 발급하지 않습니다. prepareDeparture는 진행/준비 중 항해를 거부합니다. commitDeparture도 장비·예산을 다시 검사합니다. domain 코드 자체는 저장 성공을 알 수 없으므로 **호출자가 저장 성공 뒤 commit을 호출할 책임**이 있습니다. 저장 실패를 무시하고 실제 출항하지 마세요.

귀환 결과 버전1:

```js
{version:1,voyageId,settlementId,outcome:'completed', // or withdrawn
 evidence:'independent-example', // or battlefield-adapter
 gained:{S,F,C},spent:{S,F,C},contractReward:{S,F,C},
 recovered:[/* owned player, location cargo, source.acquiredVoyageId=voyageId */],
 recoveredSockets:[/* incoming bundle internal sockets only */],
 damage:[{partId:'homeward:hull',hp:76}]}
```

현장 자원 변동은 이 결과에서 **한 번만** 적용합니다. 현재 항구 자원에 이미 반영한 지출을 다시 전달하면 이중 차감되므로 통합 controller가 적용 지점을 하나로 유지하세요. 정산 fingerprint는 키 순서가 정규화된 원문 JSON입니다. 동일 항해+정산+내용은 `duplicate:true`이며 상태를 그대로 돌려줍니다. 같은 항해의 다른 최종 정산 ID 또는 같은 정산 ID의 다른 내용은 충돌 거부입니다. 철수는 gained-spent와 확정 회수품만 보존하고 계약 보상0입니다. 회수는 장착이나 판매가 아닙니다. 보상·원장·귀환 안전경계를 같은 snapshot으로 저장하세요.

수리 비용은 문서18의 `ceil(전체 실제 복구 HP × 0.25) S`를 이 예시에 명시적으로 적용합니다. 견적 조회는 revision/자원/HP를 바꾸지 않습니다. 확정 시 현재 revision/HP/금액을 재검사하여 이전·변조·중복 견적을 거부합니다. 연료/봉인 천 단위를 S에 섞지 않습니다. 출항 최소5F와 작동 엔진·기낭·기관총·갈고리 요구는 **예시 정책**입니다. 출항 때 연료를 미리 차감하지 않고 귀환 spent로 실제 소비를 한 번만 전달합니다.

## 전장·월드 연결

`tools/battlefield/sim.mjs`가 유일한 전장 상태·시간·피해 소유자입니다. 이 담당의 어댑터는 sim을 변경하거나 step을 호출하지 않습니다.

```js
adaptBattlefieldReturn(sim,{
  voyageId,settlementId,ownerId:'player',rootId:'homeward:hull',
  installedParts:state.parts.filter(p=>p.location==='installed'),
  gained:{S:0,F:0,C:0},spent:{S:0,F:0,C:0},contractReward:{S:0,F:0,C:0}
}) // {ok,result} -> acceptReturn
createDepartureManifest(state) // IDs, installed, cargo, sockets, resources; no sim mutation
createWorldContacts(assetCatalog,sceneCatalog) // {ok,contacts,scene,errors,version:1}
```

귀환은 sim.outcome victory이고 endReason battle-cleared 또는 safe-retreat-with-cargo일 때만 받습니다. 후자는 withdrawn으로 변환합니다. bundle은 owner/player·status/cargo·salvaged true를 요구합니다. module.harborPartId가 있으면 ID를 보존하고, 없으면 `${voyageId}:battle:${module.id}`로 새 노획 개체를 구분합니다. source.originalPartId에 기존 전장 ID를 보존합니다. 내부 parent/socket 링크와 incoming 소켓을 유지합니다. sim.player.modules의 harborPartId||id로 설치 부품 손상을 옮기고 installedParts가 있으면 미등록 proxy를 제외합니다. 없던 root는 player.hp로 보완합니다.

기존 전장은 S/F/C 경제와 노획 장치별 기능 출력표가 없습니다. **기본 보상/지출과 노획 양력/발전/소비는0**입니다. 실제 전장 수치를 추정해 보상을 만들지 않습니다. 기능 출력을 가진 장착을 연결하려면 통합 담당이 검증한 카탈로그 mapping을 명시적으로 제공해야 합니다. 회수한 기존 소유 ID가 이미 상태에 있다면 복제하지 않고 충돌로 거부합니다. 자기 부품 방출/재회수 이동은 향후 위치 상태 계약 확장이 필요합니다.

월드 접점은 종항 jonghang-harbor 안의 공방 repair-workshop / 천시장 canvas-market / 창고 storage-chest / 출항 dock-endcap입니다. 이들은 카탈로그로 확인한 semantic 접점이며 authoring된 3D interaction 좌표·collider·도착 판정은 없습니다. 좌표 통합은 XZ/Y-up, 시제품 LU이며 미터가 아닙니다. UI에서 원화 대신 기존 scene-preview를 재사용합니다. 종항을 새로 생성하지 않았습니다. 천시장 매매·제작·봉인, 구조인원 개별 명부·캠페인·패배 checkpoint 전체는 미구현입니다.

## 저장 형식과 오류

```js
const repo=createSaveRepository({storage,key:'cloudstitch.harbor.v1',validateState});
repo.load(); repo.save(state,{expectedRevision,boundary});
repo.inspect(); repo.exportCurrent();
repo.recoverBackup({revision,expectedRevision}); // explicit only
```

storage는 동기 getItem/setItem을 제공하며, **setItem 실패 때 기존 값이 그대로인 localStorage 키 단위 교체 계약**을 요구합니다. 한 키에 journal 전체를 저장합니다.

```js
{format:'cloudstitch.safe-boundary.journal',version:1,
 current:{format:'cloudstitch.safe-boundary',version:1,revision:1,
   savedAt:'ISO UTC',boundary:'harbor',state:{schemaVersion:1,...},checksum:'fnv1a32:...'},
 backups:[/* newest first, max 3 valid prior envelopes */]}
```

저장 revision과 domain state.revision은 별개입니다. load/save 결과의 revision을 expectedRevision에 사용하세요. 수치·JSON 손실·순환·부품/소유권/트리·원장·버전·checksum을 검사합니다. schemaVersion1과 phase harbor/debrief만 저장합니다. sailing 저장은 거부합니다. 불러오기 실패를 새 게임으로 자동 대체하거나 잘못된 JSON/미지원 버전/손상 백업을 덮어쓰지 않습니다. 현재 손상+정상 백업은 RECOVERY_AVAILABLE이며 load/save를 중단합니다. recoverBackup을 명시 호출하면 손상 원문을 별도 quarantine 키에 보존/읽기 확인 후 정상 사본으로 복구합니다. 원문 보존·주쓰기·동시 변경 검사 실패 시 덮어쓰지 않습니다.

FNV는 사고 검출용이며 보안 서명이 아닙니다. expectedRevision은 오래된 저장 작업을 거부하는 검사이며 cross-tab CAS lock이 아닙니다. 동시 쓰기 잠금·OS 파일의 원자교체/fsync·클라우드 충돌·브라우저/기기 간 동기화·버전 migration·파일 import는 미구현입니다. 실제 브라우저 주소/기기에 종속됩니다. UI는 저장 실패와 마지막 실제 성공 시각, 미저장 세션 변경을 별도로 표시하고 재시도/원문 다운로드/명시복구를 제공합니다.

## 검증과 한계

규칙 검사 **45/45**: 항구9, 개조11, 저장25. Node builtins 테스트입니다. 두 번 출항→귀환→보관→첫 회수 엔진 장착→실수리→저장→repository 재생성 후 최종 **S284/F34/C3, 정산2, 부품9(장착6/창고3)**를 확인했습니다. 동일 두 귀환을 다시 전달해도 변화가 없습니다. 예시 한 회 지출은 수리26S, 귀환 net+108S/-3F이며 첫 항해만 C+1입니다. UI callback shim에서는 엔진 장착 없이 같은 자원/부품 수를 확인했습니다.

중복/변조 정산·foreign owner·부품ID중복·부모순환·소켓점유·호환·양력/전력부족·묶음분리·기낭출력·견적중복/변조·읽기/쓰기/복구실패·최대3백업·손상원문/미지원버전 덮어쓰기방지·낡은 revision·저장실패 후 보상재적용없는 재시도를 검사했습니다. 카탈로그4접점, 전장형 fixture의 parent tree/모듈 HP mapping도 확인했습니다.

`verify.mjs`는 생성 HTML의 JS 문법/외부 URL 부재와 Node DOM shim에서 독립 예시 버튼 callback 두 순환을 검사합니다. **브라우저 렌더/모바일/키보드/다운로드·실제 파일 저장장애·실제 전장 항해 검증은 이 담당이 수행하지 않았습니다.** 다중 브라우저 QA와 실제2항해 controller 검증은 통합 담당 범위입니다. 맥북 실제 gameplay를 이 검사로 통과 처리하지 않습니다. 기존 GLB/PNG 해시/전체자산/리그/뷰어 QA도 실행하지 않았습니다.

## 준비 완료 파일 해시

아래 해시는 finalize 실행 시 해당 준비 버전의 선별 파일을 대상으로 생성합니다. HANDOFF 자신과 manifest 자기 해시는 이 표에서 제외하며 전체 선별 목록은 `outputs/harbor-v1/file-manifest.json`을 사용합니다.

<!-- HARBOR-HASHES START -->
| 경로 | bytes | SHA-256 |
|---|---:|---|
| `outputs/harbor-v1/README.md` | 2580 | `99720acdb784060bd5ed302100998b655ddac332fc046da1612f47c1ac017dc0` |
| `outputs/harbor-v1/delivery-summary.json` | 674 | `6c50669e4cdf40cef59a9508be4efdff512f1a07cb577094079918f5def8483b` |
| `outputs/harbor-v1/index.html` | 81917 | `fe10017cfce5d36f7e7f137ea9a47280d0083bea3e9dcb2df28f9b2873f9d1d7` |
| `outputs/harbor-v1/verification.json` | 449 | `e53866df9c4da7f03f96491f90956b295b73e7667d63aa5fd6313fdd7a87dec6` |
| `outputs/harbor-v1/world-contacts.json` | 1872 | `3aa1eaeb390c231be2c9c3379ab484ea5ba694960ff085b30f8b769718349145` |
| `tools/harbor/adapters.mjs` | 5651 | `08443b1b9ca75c2918264eaf8d540968c6b0ed6b4513b2e2ef03a80be7483f71` |
| `tools/harbor/app.mjs` | 12797 | `8a9559c48dc3441a33ca55286900fc958371e58e1dbe411ea519f486dc57e564` |
| `tools/harbor/build.mjs` | 2154 | `18dcd9bc8e5e3bc3d9d9dd51413d701875d7907d8520eb297b7a25a3b92e0277` |
| `tools/harbor/core.mjs` | 9371 | `31a5c2c5c640f68530aaf36ef9735075236bb62d1a5b007cab746804867b5aa7` |
| `tools/harbor/core.test.mjs` | 8633 | `a7786a38b319a8251f5f55e4b8ae73a67489c73c681d1b42a24d7372de165786` |
| `tools/harbor/finalize.mjs` | 2391 | `a0750af8422346ad464fe83988d1e304a0723ed2482dff6b4bc7e912893c1e77` |
| `tools/harbor/fixtures.mjs` | 2891 | `e70474fdb940c021b4abd9230f4a41f722a14d36cc04deac4cf0286d1a409930` |
| `tools/harbor/template.html` | 8174 | `e2c4934e68c7d806ab1990ba306881b4a151990966d54ed75498b00ccb745288` |
| `tools/harbor/verify.mjs` | 2645 | `6d504e176ce9e2a2634aab544d80e73b52278e0221cdd9d78e6763bd2dfb7df8` |
| `tools/save/save.mjs` | 20307 | `8d975cd44dcc88590e96a8fd2ba6772051a9f3051cff669688c0ba3be3073414` |
| `tools/save/save.test.mjs` | 18792 | `5616001aeffa25878143bafbc1681cbe8611daa7ca66d3bbf6f4b5bea2200e75` |
| `tools/shipyard/shipyard.mjs` | 20788 | `f8fbff57326935c9412f99c2e9b4ef4215770588b3220586654eb5d6e8bb81a3` |
| `tools/shipyard/shipyard.test.mjs` | 10947 | `d5c46b888c79d18722e168b3f29d2144d1da754c836b4b6de07f2183344cd71b` |
<!-- HARBOR-HASHES END -->
