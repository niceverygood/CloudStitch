# 실제 플레이 화면의 항구·저장 연결 계약

2026-10-18 읽기 검토. **문서만 추가**했으며 완료 코드·저장 형식·준비 manifest를 변경하지 않았다. 항해/저장/브라우저 검사를 재실행하지 않았다. 새 화면의 연결 완료나 새 검증 PASS를 선언하는 문서가 아니다.

## 위치와 증거를 구분

| 위치 | 검토 시점의 실제 상태 |
|---|---|
| 공유 checkout의 `tools/harbor/`, `tools/save/`, `tools/shipyard/` | 준비된 도메인 소스. 최신 항구 계약은 `harbor-v1.0.2-ready` |
| 공유 `outputs/harbor-v1/` | 독립 예시. 실제 전장 연결 화면으로 안내하지 않는다 |
| 공유 `outputs/harbor-linked-v1/` | 실제 별도 통합본에서 수집한 두 항해·새 프로세스 복원·저장실패 재시도 증거 |
| 공유 `tools/integration/session.mjs`, `outputs/integration-v1/index.html` | **없음**. 다른 PC/공유 checkout에서 실행 가능하다고 가정하지 않는다 |
| 공유 `tools/levels/playable-session.mjs`, `playable-contract.mjs`, `playable-ui.js`, `playable-renderer.js` | 작업 중인 새 화면 소스 존재 |
| 공유 `outputs/playable-battlefield-v1/index.html` | **아직 없음**. 빌드·연결·새 화면 QA는 미확인 |

검증한 실제 통합 저장소는 이 PC의 `C:/Users/nicev/.codex/worktrees/desktop-integration/CloudStitch`다. 아래 경로는 **그 저장소 루트 기준**이다. 이 절대 경로는 현재 로컬 증거 위치이며 이식 가능한 의존성이 아니다.

- `tools/integration/session.mjs`: `createVoyageController`와 귀환/출항/저장/재시도 소유자.
- `tools/integration/contract.mjs`: version1, XZ/Y-up/+Z, 임시 LU, `saveKey='cloudstitch.integration.v1'`.
- `tools/integration/HANDOFF.md`, `outputs/integration-v1/index.html`: 실제 연결 화면과 실행 안내.
- `outputs/integration-v1/verification.json`: 기존 통합 결과 passed, 규칙134·브라우저21 등 기존 검사 집계. 이 결과를 새 playable 화면의 검사로 옮겨 적지 않는다.

`HANDOFF.md`의 v1.0.0 독립 예시 수치보다 `LINKED_HANDOFF.md`와 `outputs/harbor-linked-v1/`의 v1.0.2 후속 계약을 우선한다. 독립 예시 S284/F34/C3과 실제 입력 검사 S113.5/F40/C2는 다른 시나리오다. 실제 입력 증거는 회수 후 선택 철수하는 두 항해이며 전체 보스 경로 완주가 아니다. 이번에 읽은 통합 session SHA-256은 `04a419d1c7158b65f450ccb23981b2d7ece5137ac35edb1fa1ab250b82f279f8`이다. linked 증거에는 실행 당시 session SHA가 별도로 기록되어 있으므로 이후 표시 필드가 추가된 현재 파일과 같은 바이트라고 주장하지 않는다.

## 새 화면이 호출할 경계

화면은 controller 하나를 만들고 한 프레임 루프에서만 `controller.advance(dt,input)`을 호출한다. 렌더러는 `controller.snapshot()`과 이벤트를 읽는다. `snapshot.sim`, `controller.state`의 HP·좌표·화물·자원을 화면이 직접 변경하지 않는다. 전투 상태/시간/피해는 `tools/battlefield/sim.mjs` 하나가 소유한다.

```js
const controller = await createVoyageController({
  storage: window.localStorage,
  saveKey: CONTRACT.saveKey,
  muzzleResolver, // 표시 리그의 현재 포구; 판정은 battlefield
});
controller.command('depart');
controller.command('salvage');
controller.command('return');
controller.command('store');
controller.previewEquip(partId, slotId);
controller.command('equip', {partId, slotId});
controller.command('repair');
controller.command('save');
controller.command('restore');
controller.command('retry'); // 패배 상태에서만
```

`createVoyageController`의 기본 저장소는 **메모리**다. 새 화면에서 localStorage를 명시하지 않고 영속 저장이라고 안내하면 안 된다. 같은 origin/같은 saveKey의 두 화면을 동시에 출항시키지 않는다. 독립 비교 슬롯이 필요하면 호출 옵션에 별도 키를 명시하고 기존 슬롯을 삭제·자동 이행하지 않는다. 다른 포트·브라우저의 localStorage가 자동 공유되는 것은 아니다.

### 출항·항해 ID

- controller의 `prepareDeparture → 전체 loadout/편성 사전 확인 → 출항 안전 저장 성공 → commitDeparture` 순서를 유지한다. 저장 실패 때 실제 출항/새 항해 ID 소비를 하지 않는다.
- 재실행 시 departure snapshot에 activeVoyage가 있으면 **같은 ID**로 출항 준비부터 재개한다. 새 ID를 만들거나 전투 중 물리 프레임을 복원했다고 안내하지 않는다.
- 현재 통합은 **선내 cargo가 남으면 출항을 거부**한다. `store`로 창고에 내린 뒤 출항한다. 도메인의 화물 중량 계산을 근거로 통합 loadout에 cargo가 자동 전달된다고 가정하지 않는다.
- 파괴된 장착 부품은 수리/보관을 요구한다. 장착 후 실제 출항 loadout도 동일 ID·부모·내구도·중량·예산을 사용한다.
- 이벤트 ID는 `voyageId + battlefield generation + seq`다. 재도전/새 항해 때 지난 이벤트를 새 보상·효과로 재생하지 않는다.

### 귀환 결과와 receipt

레벨의 귀환 접점은 가능 표시만 한다. 현재 전장 원형 귀환 범위는 중심 `(x=0,z=48)`, 반경12LU이며 실제 좌표/자격은 sim/controller가 판정한다. 접점에 닿았다고 자동 victory나 보상 지급을 만들지 않는다.

controller가 `adaptBattlefieldReturn → acceptReturn → return 안전 저장`을 수행한다. 최종 정산 ID는 `${voyageId}:return`이며, raw result는 version1·voyageId·settlementId·outcome·gained/spent/contractReward·recovered/recoveredSockets·damage를 포함한다. 영수증은 voyage/settlement ID·fingerprint·실제 변동·회수 partIds를 가진다. **화면은 새 receipt나 보상량을 만들지 않는다.** 최초 귀환 응답의 `receipt`, `controller.settlement`의 pending raw 결과, `controller.state.settlements`의 확정 원장을 구분한다. 저장 재시도 응답에는 새 receipt가 없을 수 있다.

동일 ID+동일 내용은 한 번 정산, 같은 ID의 다른 내용/같은 항해의 다른 최종 정산 ID는 충돌이다. withdrawn은 확정 회수품과 실제 변동을 보존하고 미완료 계약 보상을 지급하지 않는다. 현재 통합은 신규 전장 보상/연료 소비를 추정하지 않으며 전투 수리의 실제 scrap 차이만 spent.S로 전달한다. 그 지출을 UI가 다시 차감하지 않는다. 출항HP보다 높은 귀환HP는 현재 지원되는 선체의 실제 유상 전투 수리 조건을 도메인이 검사한다.

`command('return').ok === false` 뒤에도 **항상 최신 snapshot을 읽어 표시**한다.

| 반환 후 상태 | 의미·UI 행동 |
|---|---|
| phase sailing / sim.outcome sailing | 위치·회수 조건 등 귀환 거부. reason 표시, 현재 항해 유지 |
| phase sailing / sim.outcome victory | 어댑터/정산 검증 실패. 같은 항해의 결과 처리 상태 유지, 임의 새 ID/항구 성공 연출 금지 |
| phase harbor / dirty true / 정산 원장 존재 | 귀환 정산은 세션에 적용됐지만 저장 실패. 실제 항구 상태와 ‘저장하지 못함’을 함께 표시 |
| phase harbor / dirty false | 안전 저장된 귀환 또는 이미 처리된 동일 귀환. 중복 지급 금지 |

정산 저장 실패는 `save` 또는 동일 세션의 `return`으로 **저장만 재시도**한다. 원장을 지우거나 raw 결과를 새 ID로 다시 지급하지 않는다. 저장 성공 전 페이지를 닫으면 미저장 정산은 마지막 departure 저장에 포함되어 있지 않다. ‘세션에 보존’과 ‘재실행 후 복원 가능’을 같은 성공 표시로 합치지 않는다.

### 부품·소유권·장착

회수 완료된 bundle의 owner/player·status/cargo·salvaged true를 어댑터가 요구한다. 기존 harborPartId는 유지하고 새 노획은 `${voyageId}:battle:${module.id}`로 구분한다. source.originalPartId/assetId/획득 항해를 보존하며 장착·창고·화물 전체에서 ID를 복제하지 않는다.

화물은 자동 장착/판매되지 않는다. `store`는 cargo→warehouse 이동이며, `equip`는 선택한 `slotId`에 묶음 루트를 연결한다. 핵심 hull 하나·부모 하나·순환 없음·소켓 중복 점유 없음·현재 선주 소유를 유지한다. 내부 하위 부모/소켓은 묶음 이동 때 보존한다. `previewEquip`의 before/after와 reasons로 중량·양력·전력을 표시하고 성공 때만 확정한다. 창고는 무게/출력을 배에 더하지 않는다.

노획 장치의 기능 출력은 현재 매핑 미확정으로0이다. 장착된 회수 엔진이 최종 추력·발전 기능까지 구현됐다고 표현하지 않는다. 수리 견적은 미지불이고 `repair` 확정의 실제 복구/실소비만 적용한다. S/F/C는 스크랩/연료/봉인 천으로 분리한다.

### 실패·재도전·마지막 정상 저장

패배 `retry`는 departureCheckpoint의 부품/자원과 **같은 voyageId**로 돌아가며 adapter generation/director run을 새로 시작한다. 과거 적·탄·예고·이벤트를 정리한다. 패배를 새 귀환 정산으로 처리하거나 이전 항해의 확정 원장을 지우지 않는다.

저장 형식은 기존 version1 journal을 그대로 사용한다: `cloudstitch.safe-boundary.journal`, current envelope `cloudstitch.safe-boundary`, schemaVersion1, ISO savedAt, 저장 revision, boundary, state, FNV checksum, 정상 backup 최대3개. domain revision과 저장 revision은 별개이며 `expectedRevision`은 저장 결과의 번호다. sailing 저장은 거부한다.

쓰기 실패는 현재 세션과 마지막 정상 journal을 보존한다. `snapshot.harbor.saveStatus/dirty/canRestore`를 UI에 반영한다. 항구의 미저장 개조/정산은 `restore`로 버리지 못하며, REVISION_CONFLICT만 현재 상태를 `.conflict` 키에 보존한 뒤 최신 정상 저장을 읽는 경로다. 손상/미지원 저장을 빈 게임으로 자동 대체·덮어쓰지 않는다. 정상 백업 복구는 repository의 명시 복구 계약을 따른다. 키 단위 교체는 다중 탭 CAS 잠금·OS fsync·클라우드 저장 보증이 아니다.

## 현재 새 화면의 연결 준비 항목

읽은 시점에 `playable-session.mjs`는 위 통합 session과 **동일 SHA-256**이다. 따라서 그 복사본이 새 화면에서 실제 사용되는지, 이후 별개 controller 구현으로 갈라지지 않는지 통합 담당이 인계 시 확인해야 한다.

현재 `playable-ui.js`는 `./session.mjs`, `./renderer.js`를, `playable-session.mjs`는 `./contract.mjs`를 import한다. 공유 `tools/levels/`의 파일명은 각각 `playable-session.mjs`, `playable-renderer.js`, `playable-contract.mjs`다. 이번에 읽은 `tools/levels/build.cjs`는 기존 `viewer.js → outputs/levels-v1/index.html` 빌드다. **새 entry/alias 또는 경로 보정·출력 생성은 작업 중인 인계 항목**이며 이를 완료된 실행물의 결함이나 새 화면 PASS로 단정하지 않는다. 담당 폴더 밖의 root controller/준비 소스를 덮어써 해결하지 않는다.

다음 인계에는 새 화면 entry→검증된 controller의 연결 경로, 같은 controller만 advance하는 소유권, localStorage/saveKey 선택, command 실패 후 최신 snapshot 표시, 귀환/재시도 ID 유지와 artifact 목록을 명시한다. 새 화면 확인은 통합 담당의 후속 QA로 분리하며, 기존 완료된 두 항해·저장 검사를 이번 문서 때문에 다시 실행할 필요는 없다.

근거: `tools/harbor/HANDOFF.md`, `LINKED_HANDOFF.md`; `outputs/harbor-linked-v1/{source-manifest,verification,return-retry-verification,integration-browser-verification}.json`; 실제 별도 통합본의 `tools/integration/{session,contract}.mjs`, `HANDOFF.md`, `outputs/integration-v1/verification.json`; 공유 `tools/levels/playable-*.mjs`, `playable-ui.js`, `build.cjs`.
