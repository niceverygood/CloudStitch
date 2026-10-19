# Cloudstitch 함대·지역 교전 인계

기준: 2026-10-18 한국 시간. 준비 버전 `encounters-integration-v1`, 상태 **READY — 통합 연결용 인계 완료**. 실제 최종 통합 플레이의 브라우저 QA는 통합 담당이 별도로 기록한다.

후속: 사용자 요청으로 실제 항해 접합 검토와 공격 예산 보조 함수 v2를 준비했다. 최신 수정·재현·검증 상태는 `FOLLOWUP-2026-10-18.md`와 `outputs/encounters-integration-v2/verification.json`을 따른다. 아래 v1 SHA 표는 최초 인계 시점의 고정 기록이다.

후속 접합 재검증 완료: 네 가지 재현 문제는 최신 통합 공간에서 해소를 확인했다. 최종 상태는 `outputs/encounters-integration-v2/controller-recheck.json`, 최종 인계 파일 목록·SHA는 같은 폴더의 `final-manifest.json`을 따른다. 앞선 v1/v2 manifest는 당시 준비 시점의 기록이다.

표시 회귀 관측 버전 `encounters-presentation-qa-v1` READY: `scene.getStats().actorModels[]`에 `renderedHeading`(실제 group.rotation.y), `chargeAngle`, `chargeTime`, `angle`을 추가했다. 원본 각도 정보는 마지막 sync 프레임에서 숫자로 복사하며 없는 값은 null이다. 반환 객체를 변경해도 렌더 record나 전투 snapshot을 변경하지 않는다. UI/판정/GLB/타이머 변경은 없다. 통합 담당은 별도 encounters-v2의 실제 DOM 배너와 돌진 각도 fixture를 검사한다. 이 담당은 함수 fixture·구문만 가볍게 확인했다. 파일 해시는 `outputs/encounters-presentation-qa-v1/source-manifest.json`을 따른다.

## 원본 수신과 보존

최초 공유 체크아웃은 `fb850f7`였고 `tools/fleet/`, `tools/encounters/`, `tools/battlefield/`, `tools/airship-rig/`가 없었다. 통합 담당이 맥북 최종 푸시 `e65ab87d2af0c4b08e51f312c9eb0998aa895c69`를 찾아 소스와 LFS 출력의 없는 파일만 복사했다. 당시 누락은 현재 해소됐다. 맥북 결과를 다시 제작한 작업이 아니다. 복사 증거는 통합 담당의 로컬 `work/integration-transfer/source-receipt.json`이며 다른 PC에 이 로컬 로그가 있다고 가정하지 않는다.

원본 독립 전투는 `tools/encounters/core.js`, `catalog.json`과 `outputs/encounters-v1/`로 보존한다. 기존 함대 제작 소스와 GLB/원화/리깅/카탈로그도 보존한다. 원본 `core.js`, 교전 카탈로그, 함대 소스 카탈로그의 SHA256이 e65ab87와 같음을 확인했다. 기존 독립 전투 `createEncounter/update/step`는 최종 플레이에서 호출하지 않는다.

수정한 원본 표시 소스는 두 파일이다. `app.js`는 공격 예고가 있는 동안 중앙 보스 접근 배너를 숨긴다. `scene.js`는 `chargeTime>0` 동안 이동 판정이 사용하는 `chargeAngle`로 선체를 표시한다. 정책 함수는 `presentation-policy.mjs`로 추출했다. `OutlineEffect.autoClear=true`를 유지했다. 원본 출력 `outputs/encounters-v1/`는 다시 빌드하지 않았다. 이 변경의 브라우저 회귀 실행물은 통합 담당이 별도 `outputs/encounters-v2/` 등으로 만들어 검사한다.

## 카탈로그와 편성

원본 `tools/encounters/catalog.json`의 지역 ID·보스 ID·역할·36회 일반 적+12회 보스, 총48회 등장을 그대로 사용한다. 고유 적 모델은18개, 플레이어 포함19개다. 이는 고유 정사 함선48척이라는 뜻이 아니다.

| 지역 ID | 지역 | 일반 전반/후반 | 중간 자산 ID | 최종 자산 ID |
|---|---|---:|---|---|
| stage-01-harbor | 종항 잔해해역 | 2/2 | mini-funeral-guard | boss-bell-devourer |
| stage-02-canyon | 청록빛 상승기류 협곡 | 3/3 | enemy-tax-cutter | enemy-union-salvage |
| stage-03-storm | 천둥 폭풍벽 | 3/3 | mission-bridge-tug | enemy-cult-blockade |
| stage-04-industry | 쇠갈비 공업지대 | 3/4 | enemy-union-repair | boss-shipwright-command |
| stage-05-fog | 이름 없는 함대의 저층 안개 | 3/4 | enemy-ghost-chaser | boss-fleet-king |
| stage-06-palace | 황궁 검은 천정 | 3/3 | mini-funeral-guard | boss-last-inhale |

모든 지역은 `opening → midboss → maintenance → late → finalboss → victory` 순서다. 시작 전 지역 선택은 기존6판 시제품 기능으로 허용한다. 진행 중 `startStage`로 다른 지역에 건너뛸 수 없고 `nextStage`는 승리 후 바로 다음 지역만 시작한다. 실제 캠페인 해금 구현이 필요하면 통합 controller에서 시작 지역을 제한한다.

`attack-intents.mjs`는 기존12역할 정찰·봉쇄·견인·수리·돌진·기습·포격·화염·종·조선소·함대왕·심장을 기술한다. 얇은 작살선/굵은 돌진띠/부채꼴/착탄 원/안전 틈 고리/압력 양 경계를 구별하고, 색·소리만으로 대응하지 않게 아이콘·선 형태를 함께 제공한다. 기존 무기/VFX ID만 연결하며 전용 완성 예고 GLB가 없는 도형은 호스트가 표시한다.

보스의 패턴 전환은 기존 독립 교전의 `choosePattern` 순환/손상 지휘선 변형을 설명하는 데이터다. 정사10/14/31/43의 장치 목표·구조 단계·기억 전달·세 결말을 구현한 것으로 표시하지 않는다. 모든 보스 명세의 `canonEncounterCompleted`는 false다. 필수 단서·지역 진행을 랜덤 드롭이나 완벽 노획에 잠그지 않는다.

## 상태 소유와 호출 계약

최종 상태·시간·이동·사격·충돌·피해·치유는 **battlefield `sim.mjs` 한 곳**이 소유한다. director는 출현 순서와 ID/완료 통보만 관리하며 `update/step`, 좌표 적분, 투사체, HP 상태가 없다. 모델 애니메이션/VFX 시연의 내장 이동을 물리 루트에 중복 적용하지 않는다. 평면은 XZ, +Y 위, 거리는 임시 LU이며 미터가 아니다.

```js
import { createEncounterDirector } from './director.mjs';
const director = createEncounterDirector(catalog, { difficulty: 'normal' });
director.startStage('stage-01-harbor', candidates);
const commands = director.drainCommands();
// clear-combat는 실제 적/위험/입력/지연 작업 제거 뒤에만 승인한다.
director.acknowledgeClearance({
  runId: command.runId, commandId: command.commandId,
  remainingHazards: 0, remainingEnemies: 0,
});
```

`candidates`는 월드가 제공한 `[{id,x,z,safe?,roles?,phases?}]`다. director는 단계 안에서 서로 다른 후보 ID를 사용하고 역할/단계 제한을 매칭한다. 후보 부족은 단계/세대를 바꾸지 않고 오류로 돌려준다. 장애물·선체 반경·플레이어 중첩 검사는 월드/전장 소유다. `safe` 생략은 사용 허용이므로 호스트는 실제 검사를 마친 후보만 전달한다. 고정 좌표가 필요할 때 `exampleSpawnCandidates()`는 검사 전용 예시임을 표시한다.

모든 명령은 `{type,commandId,runId,stageId,phase,...}`다. 주요 종류는 `clear-combat`, `phase-changed`, `spawn-enemy`, `boss-spawned`, `enemy-defeated`, `boss-defeated`, `maintenance-ready`, `region-completed`, `player-defeated`, `pause-changed`다.

`spawn-enemy`에는 `{enemyId,assetId,name,role,tier,x,y:0,z,candidateId,tuning,difficultyTuning,sourceRefs}`가 있다. 현재 battlefield `spawnEnemy`의 `id`에는 `command.enemyId`를 매핑한다. `tuning`은 원본 시제품의 hp/speed/range/recovery/radiusHint/healBudget 가설이다. topology 없는 모델의 모듈 proxy 구성은 통합 controller가 명시하며 새 실제 GLB 부품 분리가 완료된 것으로 표시하지 않는다.

호스트의 전체 피해 처리 후 `enemyDefeated({runId,enemyId})`와 실제 패배가 있다면 `playerDefeated({runId,reason})`를 먼저 전달하고 마지막에 `advance(nextCandidates?)`를 호출한다. 마지막 적과 플레이어가 같은 프레임에 무력화돼도 패배가 우선한다. 공격·단계 처리를 `advance` 전에 마치지 않고 나중에 보내면 안전 경계 이후 패배를 적용할 수 없으므로 이 순서가 필수다.

`continue(candidates?)`는 clear 승인이 끝난 정비에서만 후반으로 간다. `retry(candidates?)`, `reset()`, `nextStage(candidates?)`는 새 runId와 clear barrier를 만든다. 이전 명령/격파/승인은 거절한다. retry의 `restoreCheckpoint:true`는 호스트에게 복구를 요청하는 값이며 director가 플레이어 HP/자원/저장을 복원하는 기능은 아니다.

`clear-combat`는 적·탄체·예고·돌진·견인·효과·수리 부표·누르고 있는 입력과 지연된 스폰/모델 로딩/공격 콜백을 모두 취소한 뒤 승인한다. **pending 작업을 포함해 적0/위험0이 아닐 때 승인하지 않는다.** 같은 runId의 단계 전환도 있으므로 runId 검사만으로 비동기 잔류 콜백이 해결된다고 가정하지 않는다. clear/정비의 공격 토큰은0, 전반/중간보스1, 후반/최종보스2다.

`createBattlefieldEncounterAdapter(director,host)`는 동기 `host.spawnEnemy(command)`, `host.clearCombat(command)→{remainingEnemies,remainingHazards}`와 선택적 `host.onEvent`, `host.setMajorAttackTokens`를 연결하는 예시다. `flush()`로 큐를 소비하며 스폰 거절/오류는 해당 명령을 보존한다. 실제 모델 로딩은 표시 계층에서 처리하고 callback에 Promise를 반환하지 않는다.

## 공격 의도와 현재 전장 한계

```js
describeAttack({ role, tier, attackIndex, healthFraction, telegraphScale, disabledPatterns });
// {pattern, telegraph:{shape,lineStyle,icon,duration,lockBeforeRelease:.4,...},
//  recovery, majorAttackTokenCost:1, movementIntent, damageHint, clip, patternTransition}
describeSupport({ role:'repair', remainingBudget });
```

실제 HP 비율·공격 횟수·시야·대상/방향·예고 및 회복 시간·유한 수리 예산은 호스트가 제공/갱신한다. 파괴된 장치 패턴은 `disabledPatterns`로 취소할 수 있고 자동으로 다른 미예고 공격으로 바뀌지 않는다. 포각/가림과 실제 안전 경로도 호스트가 검사한다.

현재 battlefield `setEnemyIntent`는 `{move:{x,z},attackTarget:{x,z}|null}`만 실행한다. 따라서 `training-intent.mjs`의 `convertAttackIntent({intent,enemy,observedTarget,desiredRange,allowAttack})`가 **기본 예고 포격으로 명시적으로 축소**한다. 정찰 측면 이동/거리 유지/정지 장치 방향 제안만 전달하며 돌진·견인·광역·치유·종/압력 특수 판정과 원본 timing/damageHint는 실제 적용되지 않는다. 결과의 `sourcePattern`과 `executedPattern`을 구별한다. 관측 대상이 없으면 이동0/사격null을 전달하여 실제 숨은 플레이어 위치로 자동 전환하지 않는다. 원본 특수 예고 도형을 실제 판정처럼 덧씌우지 않는다.

기존 독립6판은 원본 특수 전투의 회귀 자료다. 최종 통합 한 항해가 이12역할의 모든 특수 기믹을 구현했다고 기록하지 않는다.

## 파일·실행·검사

추가 소스: `director.mjs`, `attack-intents.mjs`, `example-adapter.mjs`, `training-intent.mjs`, `presentation-policy.mjs`, `director.test.mjs`, `snapshot.mjs`, `../fleet/encounter-assets.mjs`, 이 문서와 `../fleet/HANDOFF.md`. 최소 수정: `app.js`, `scene.js`. 확인용 신규 출력: `outputs/encounters-integration-v1/contract.json`, `example-session.json`, `verification.json`, `README.txt`, `source-manifest.json`.

```sh
node --test tools/encounters/director.test.mjs
node tools/encounters/snapshot.mjs
```

추가 의존성 없음. Node20 이상 표준 라이브러리만 사용한다. 통합 담당에게 권하는 npm script는 `verify:encounter-integration`과 `snapshot:encounter-integration`이며 이 담당은 공통 package/잠금 파일·설치·브라우저를 변경/실행하지 않았다. 기존 `build.cjs`는 원본 v1 출력을 덮어쓰므로 이번 표시 회귀에는 실행하지 않았다.

실제 검사: 16개 Node 검사,6지역 전체48회 시퀀싱·보스 각1회·건너뛰기/중복/정비/패배·retry/reset·후보 매칭·카탈로그/VFX ID·정책 함수·원본 코어의 강제 격파 회귀를 확인했다. 기존19모델은 카탈로그 경로·파일 크기·12바이트 GLB 헤더/버전/총길이만 읽었다. 전체 모델 해시 재계산·실제 GLB 브라우저 로딩·이동/사격의 실전 완주·사람의 재미/밸런스·모바일 실기기 성능 검사가 아니다. 통합 browser와 실제 한 항해 검증은 통합 담당이 수행한다.

파일별 최종 SHA256은 아래 표와 `outputs/encounters-integration-v1/source-manifest.json`에 기록한다. manifest는 자기 해시를 제외하며 이 문서의 최종 해시를 포함한다. 원본/공통 파일은 통합 담당이 이미 복원했으므로 이 담당의 새 파일과 app/scene 수정만 선별 복사한다.

<!-- ENCOUNTER_HANDOFF_HASHES_START -->

| 파일 | SHA256 |
|---|---|
| tools/fleet/encounter-assets.mjs | 08ebaddb4d6d03a82d0ff54cd9898b93baa2796f8fdd753325aac8431209575d |
| tools/fleet/HANDOFF.md | aed645101779b1a85697720a53406d1b014bc0ac7a65e24dedaee2216dc3f2b9 |
| tools/encounters/director.mjs | e8a0cdb2c951994896cc06d35e6a5120fc372d26747e647ca4ee5f6a5f389e4f |
| tools/encounters/attack-intents.mjs | 4ee7c439d3d7a7d991db94f720ab085de33466fb46af9f6d8ab3b5115cca90fd |
| tools/encounters/example-adapter.mjs | d8b9fa82aa0f7483a714a4cbcfacd7140a31166851485b593546f809142c6efb |
| tools/encounters/presentation-policy.mjs | 125b7a641cf75e6fe828abf4d34cb3e8915f7a60c8f527f024db7df05829282e |
| tools/encounters/training-intent.mjs | 75bf8c53db0477fdaf9c8e183c6f67d006551bad8dd3c1e7ed5717a3247a5ea6 |
| tools/encounters/director.test.mjs | e54a12e7de163d8963616dc4013057e0cd33b781ebc2db208a94d090bc2fc821 |
| tools/encounters/snapshot.mjs | c910e2742aec0d45f6a09a99c4d2ceaecaa0bff0982a0bd4bc55d8a425b0553b |
| tools/encounters/app.js | 5f33980b6390d2c0877f4258dff484102413b354efe4908db123e3c0f5926157 |
| tools/encounters/scene.js | eb51cc2cdc2aa4bea0611bde749a3c782ce8c4f46660440b8de3e86b22d3908f |
| outputs/encounters-integration-v1/contract.json | 59020a31ecfd37b383189a11b293ab59884aada14003edf588eb64b269e17eba |
| outputs/encounters-integration-v1/example-session.json | 19dd5c592f8591812df4de8e579919c9383cd4f6f03ff7f3da17d32a953fd356 |
| outputs/encounters-integration-v1/verification.json | 569f9327dac4be0029f2fb1cfd7fec12f60418fd9eda6fd5103eeb870a3afe6d |
| outputs/encounters-integration-v1/README.txt | 40398e6e581ed59175e58973879b7c81252e807c2c530070fed7a51178ec2841 |

<!-- ENCOUNTER_HANDOFF_HASHES_END -->

이 인계는 한 시점의 연결 준비 완료다. 새 유료 생성·모델 재제작·배포·자동화·Git pull/reset/push·새 사용자 채팅을 수행하지 않았다.
