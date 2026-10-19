# Cloudstitch 전장 연결 인계

준비 완료 스냅샷: **battlefield-authority-0.2.2 / READY 2026-10-18**. 전투 API 계약 버전은 변경 없이 `battlefield-authority-0.2.1`이다.
이는 한 시점의 소스·경량검사 인계 완료다. 통합 화면의 브라우저 QA·전체 게임 완성을 뜻하지 않는다.

## 원본 수신과 소유 범위

최초 확인 HEAD는 `fb850f7`, 담당 소스/출력 폴더는 없었고 작업 트리는 깨끗했다. 통합 담당이 원격 `e65ab87d2af0c4b08e51f312c9eb0998aa895c69`에서 맥북 원본을 찾아 기존 파일과 충돌 없이 전달했다. `tools/battlefield/` 원본을 이어 수정했다. 누락본을 대체 제작한 결과가 아니다.

원본 `outputs/battlefield-v1/{index.html,battlefield.js,style.css,preview.png,manifest.json,verification.json,README.txt}`와 기존 모든 GLB·원화를 덮어쓰지 않았다. 새 `integration-preparation.json`과 `receipt-stress.json`을 추가했다. `build.cjs` 기본 출력은 `outputs/battlefield-v2/`; 통합 화면은 통합 담당의 `outputs/integration-v1/`를 사용한다. 이 담당은 빌드·npm 설치·브라우저 검사·공통 package/lock/docs·다른 담당 폴더를 수정하지 않았다.

## 기준 상태

**sim.mjs가 유일한 전투 상태·시간·HP·부품 부모·투사체·화물·승패 소유자다.** `integration.mjs`는 같은 상태의 명령 브리지다. encounters는 스폰과 의도만 전달하고 자신의 시뮬레이터를 함께 진행하지 않는다. 렌더/VFX는 상태와 이벤트를 읽는다.

축은 XZ 평면, +Y 위, 게임 전방 +Z다. 거리·속도는 임시 LU이며 미터나 기획U 변환이 아니다. GLB의 원래 -X 전방은 표시 정규화와 소켓 프레임에서 변환한다.

## 생성과 입출력

```js
import { createBattlefieldAdapter } from './integration.mjs';
const battle = createBattlefieldAdapter({
  world: {
    obstacles: [{ id: 'rock', x: 15, z: 0, radius: 4 }],
    playerSpawn: { x: 0, z: 35 }, harbor: { id: 'home', x: 0, z: 48, radius: 12 },
  },
  enemySpawns: [{ id: 'wave1-tax', assetId: 'enemy-tax-cutter', x: -28, z: -12 }],
  loadout: { hp: 100, maxHp: 100, baseWeight: 50, lift: 65,
    powerOutput: 14, powerDraw: 10, scrap: 30 },
  muzzleResolver: ({ player, target, time }) => actualRigFrame(player, target, time),
});
battle.advance(dt, { moveX, moveZ, aimX, aimZ, fire, boost });
const state = battle.state;        // 읽는 권위 상태, 복제 시뮬레이터 금지
const snapshot = battle.snapshot(); // 함수 제외 JSON 복사 + version/generation
const events = battle.drainEvents(); // 별도 seq 커서, generation 포함
```

`muzzleResolver` 반환: `{position:{x,y,z},direction:{x,y,z},source}`. `assets.js`의 `loadShip(THREE,id,length)` 반환에서 `aimAt(dx,dz,heading)` 후 실제 현재 wrapper 위치/회전을 적용하고 `muzzleFrame()`을 호출한다. 네이티브 `Muzzle`의 -X축을 월드 방향으로 변환한다. 소켓은 리깅 당시의 provisional 위치다. 독립 `weapon-modules` 원본의 실제 장착/포신분리가 확정된 것은 아니다. resolver를 생략한 원본 UI는 기존 임시 포구를 사용한다. 실제 이동·회전 후의 최신 프레임을 제공해야 한 프레임 지연이 없다. 평면 판정은 y축 탄도를 다루지 않는다.

`advance()`는 같은 state를 반환한다. `retry()`/`depart()`는 새 state를 생성하므로 이전 참조를 버리고 getter를 다시 읽는다. 재시도는 출항 체크포인트로 복원하고 세대를 증가시키며 시간/HP/탄환/화물/이벤트를 초기화한다. `depart({world?,enemySpawns?,loadout,muzzleResolver?})`는 승리 귀환 후 확정된 항구 loadout을 받아 새 항해를 시작한다. 영속 저장·항구 정산 거래는 여기에서 만들지 않는다.

loadout의 scalar는 `hp/maxHp/baseWeight/lift/powerOutput/powerDraw/crewWeight/scrap`이다. baseWeight는 scalar 방식에서는 구조인원을 이미 포함한 합계다. `modules`를 제공하면 각 항목은 `{id,key,parentId,type,hp,maxHp,localX,localZ,radius,weight,lift?,powerOutput?,powerDraw?}`이며 하나의 root(`key:'root'`)와 단일 부모 트리가 필요하다. 이때 baseWeight는 부품 합+crewWeight이고 양력은 부양장치 HP 50% 미만 선형 감소를 반영한다. 전력은 출력/소비/초과 표시 예산이며 지원장비 우선순위나 연료 경제는 미구현이다. 플레이어 피격은 아직 선체 집계 프록시이며 플레이어 개별 모듈 충돌/절단 전체가 구현된 것은 아니다.

## 명령·월드·디렉터

`dispatch({id,type,...,generation?}) → {ok,value,reason?,generation}`. id는 세션 전체에서 고유한 문자열로 만든다. 같은 id/동일 payload 재전송은 기존 receipt를 반환하며 재실행하지 않는다. 다른 payload는 `command-id-conflict`, 새로 온 구세대 명령은 `stale-generation`이다. 처리 완료한 retry receipt의 재전송은 기존 성공 결과만 돌려주며 재시도하지 않는다.

| type | 추가 입력 | 동작 |
|---|---|---|
| pause / resume | 없음 | sim 시간·피해·탄환·유예 정지/재개 |
| salvage | 없음 | 거리 내 살아 있는 묶음을 한 번 화물로 회수, 자동 장착 없음 |
| drop-cargo | 없음 | 동일 ID 화물 투하, 자기 화물 재회수 보상 중복 없음 |
| repair | hp | 실제 복구 HP만큼 임시 0.5S/HP 과금, 이미 회복한 양은 청구 안 함 |
| return | 없음 | 실제 항구 범위 + 화물 또는 적 무력화 조건, 남은 탄환 취소 |
| spawn | enemy | `{id,assetId,name?,role?,tier?,x,z,modules?}` |
| intent | enemyId,intent | `{move:{x,z},attackTarget:{x,z}\|null}`, null이면 원본 훈련 AI 복귀 |
| world | world | 검증된 장애물/항구/플레이어 위치 갱신; 실패 시 부분 적용 없음 |
| clear-combat | reason? | 단계 경계에서 적/경고/탄환/completedProjectiles 비우기, 항해/플레이어/화물/잔해 유지 |
| retry / depart | depart는 config | 체크포인트 복원 / 새 확정 항구 loadout 출항 |

직접 함수는 `sim.mjs`의 `configureWorld/spawnEnemy/setEnemyIntent/setPaused/repairPlayer/clearCombat`이다. 원본 3적 이외의 fleet ID는 명시적 `modules` 트리를 전달해야 한다. 임의 보스에 징세정 연결 트리를 복사하지 않는다. 렌더 loader는 실제 `outputs/fleet-v1/catalog.json.ships`의 `model=ships/{id}.glb` 등록 ID를 허용한다. `key:'cannon'` 하나가 느린 훈련 포격을 담당하며 전체 보스 패턴/모든 장착 무기 동시 실행을 뜻하지 않는다.

role/tier는 ASCII 영문으로 시작하는 최대 48자 영문·숫자·밑줄·하이픈 태그를 검증해 그대로 보존한다. 표시 계층의 보스 판별 메타데이터이며 새 전투 능력을 만들지 않는다. 공격 예산이 attackTarget=null로 포격을 대기시켜도 cooldown은 매 tick 감소한다. pause에서는 cooldown도 정지한다.

clear barrier 뒤에 director `acknowledgeClearance`를 호출한다. 적/부품 ID 등록 이력은 같은 항해 안에서 유지하므로 clear 뒤에도 같은 actor나 이미 잔해/화물에 남은 부품 ID를 다시 생성할 수 없다. 정비는 pause로 시간 정지, 사용자 선택 후 resume한다. director 승리와 최종 귀환/정산 정책은 통합 담당이 연결한다. 단계를 진행하려고 sim 배열을 외부에서 직접 비우지 않는다.

## 이벤트와 실제 공격 순환

이벤트 공통값: `id/seq/time/type`. 브리지 drain에는 generation이 추가된다. 기존 이벤트는 `module-destroyed/bundle-detached/enemy-defeated/salvaged/cargo-dropped/bundle-lost/victory/defeat`; 새 연결 이벤트는 `enemy-spawned/player-repaired/combat-cleared/projectile-ended`다.

유효 사격에 `player-fire/enemy-fire`가 발생하며 `projectileId,weaponId,x,y,z,direction,muzzleSource?`를 담는다. 이동은 sim이 소유하고 earliest swept circle 접촉에서만 `hit`가 발생한다. hit에는 같은 projectileId와 실제 접촉 `normal/direction/target/enemyId?/moduleId?`를 담는다. 피해는 모듈별 한 번, 한 투사체 충돌 뒤 `projectile-ended`로 끝난다. TTL/영역 종료/귀환/패배/clear 경계도 종료 이벤트를 보낸다. 아트 타임라인은 충돌을 만들지 않는다. 같은 shot ID의 같은 프레임/뒤늦은 재전달은 중복 피해·명중·집계를 막는다.

```js
import { createCombatVfx } from './vfx.js';
const vfx = createCombatVfx(THREE, scene);
await vfx.load();
vfx.consume(battle.drainEvents(), battle.state.projectiles);
vfx.update(paused ? 0 : dt, battle.state.projectiles);
// retry/depart 때 vfx.reset(); 종료/화면 해제 때 vfx.dispose();
```

`load/consume/update/reset/dispose/debug`를 제공한다. 기본 URL은 sibling `../combat-vfx/`; HTTP로 저장소를 제공한다. 기관총·함포 6 GLB를 catalog/recipes에서 확인해 로드한다. 비행은 `projectile_carrier` 하위 형상만 복제하고 내장 translation·종료scale·전시 연기를 모두 적용하지 않는다. 포구/명중은 원본 단발 클립, 접촉 +Y=표면법선/+Z=접선 방향이다. 명중효과 하나만 선택한다. 모든 6무기 매핑은 있으나 나머지 4무기의 범위/상태/케이블/분사 판정은 후속이다. enemy 훈련탄의 cannon 표시는 실제 해당 적 장비의 완성 패턴을 뜻하지 않는다.

풀 반환은 action stop/reset/time0, mixer 정지, 원본 child transform, 표시 root transform, 부모/끝점/host/projectile 참조를 초기화한다. 종료한 shot의 fired/fireEvents 참조는 즉시 해제하고 terminal receipt는 최근 2048개만 유지한다. 오래된 이벤트는 seq 커서가 차단한다. VFX seq 커서와 terminal/fired ID는 reset에서 초기화한다. 기존 독립 main.js의 임시 시각효과는 보존했으며 새 API 연결은 통합 화면에서 수행한다.

## 실행과 실제 검사

추가 의존성은 없다. Node.js 20+; 표시 모듈은 기존 three/GLTFLoader, 번들은 기존 esbuild를 쓴다. 공통 npm scripts 편집은 통합 담당만 한다. 필요하다면 `verify:battlefield-core`에 다음 명령을 등록한다.

```sh
node --test tools/battlefield/sim.test.mjs tools/battlefield/integration.test.mjs tools/battlefield/vfx-contract.test.mjs tools/battlefield/receipt.test.mjs
node tools/battlefield/verify-bindings.mjs
node tools/battlefield/example-adapter.mjs
```

현재 경량 검사 **48/48** 통과: 원본16, 새 authority15, VFX계약10, 후속 receipt/metadata/cooldown7. 부모 절단/함포 단독파괴/중복 피해·회수/실제 이동과 swept 접촉/자기 선체 가림/종료/pause/retry/세대/clear barrier/월드 입력/수리/출항 예산을 확인했다. 10,000회 효과 lifecycle 루프에서도 active0/terminal2048/필드추가0을 확인했다. 바인딩 검사9 GLB는 헤더·원본 해시·실제 Muzzle 부모/축·캐리어 이동키·catalog/recipes 일치를 확인했다. 이는 Three.js 실제 브라우저 로딩 검사가 아니다.

독립 예제는 명시한 포구 fixture로 기관총 3발→골조 절단→HP 보존된 함포 포함 묶음→인양→항구 귀환→세대2 재출항을 실행했다. 예제의 경계 위치 배치는 fixture teleport이며 실제 사용자 이동 QA로 세지 않는다.

브라우저/다운로드/모바일 넘침/OutlineEffect.autoClear·잔상/실제 포구 화면 일치 검사는 통합 담당의 책임이다. 새 유료 생성·push·배포는 하지 않았다. 별도 상용 엔진·플랫폼·성능·최종 밸런스를 확정하지 않는다.

## 0.2.1 후속 변경과 기록 한도

0.2.0 READY는 통합 담당이 복사한 이전 스냅샷이다. 0.2.1은 장기 연사에서 종료·피해 기록이 항해 길이만큼 증가하던 문제를 수정한다. `completedProjectiles/damageReceipts`와 해당 lookup은 각각 최근 4096개 고정 ring이다. `completedProjectileCursor/damageReceiptCursor`가 덮어쓸 슬롯을 가리키므로 배열은 랩 이후 시간순 목록이 아니다. 조회/삽입 비용은 항해 길이에 비례하지 않는다.

내부 `shot-N` namespace는 battlefield 발급 전용이다. `nativeIssuedHighWater`는 발급 번호 상한, `nativeActiveProjectiles[id].targets`는 현재 살아 있는 탄환과 이미 피해를 준 모듈을 보존한다. 늦게 끝나는 옛 탄환도 활성 등록이 있으면 정상 이동하며, 미발급·종료 ID는 최근 ring에서 사라진 뒤에도 같은 항해 세대에서 재진입할 수 없다. 여러 대상에 한 공격을 적용할 때는 모든 피해를 처리한 뒤 탄환을 종료한다. 살아 있는 탄환의 동일 대상 receipt는 최근 ring과 별개로 종료까지 유지한다. 종료/cancel에서 활성 기록을 해제한다.

clearCombat은 활성 기록/최근 종료 ring을 비우되 발급 상한을 유지한다. raw projectile 배열을 외부에서 주입하는 API는 없다. 재시도/재출항은 새 세대이므로 이전 세대 명령은 generation 검사로 막고, raw state/old projectile 객체를 새 세대에 주입하지 않는다. 임의 custom damageId/fixture projectile ID의 정확한 중복 차단은 최근 4096개 범위다. 무한히 지연된 임의 문자열 ID까지 고정 메모리로 영구 저장한다고 주장하지 않는다.

후속7검사는 20분(72,000 tick) 실제 sim.advance 연사에서 5,143발/5,142명중/활성1(최대2), 기록·lookup 각4096, sim/player/enemy/root 필드 키 증가0을 확인했다. 1초 추가 진행 후 5,143명중/활성0이다. 처음 탄환의 최근 기록이 실제로 사라진 뒤 clone2개와 직접 피해 재전송을 거부했다. clear 뒤 새 표적/미발급 native ID/역순 TTL/살아 있는 한 공격의 3대상 및 5,000개 generic receipt eviction 뒤 같은 대상 재피해/role-tier 검증/공격 대기 중 cooldown 복구를 확인했다. 상세는 `outputs/battlefield-v1/receipt-stress.json`이다. 이 시간은 headless 논리 시뮬레이션이며 20분 브라우저 플레이나 렌더 성능 인증이 아니다.

## 0.2.2 인스턴스 자원 해제와 v2 연결 검토

코드 수정은 assets.js 한 파일이다. cloneSkeleton으로 생성한 인스턴스 고유 skeleton을 Set으로 수집하고 loadShip.dispose에서 skeleton.dispose를 중복 없이 실행한다. 이중 dispose guard도 적용했다. Three.js의 skeleton.dispose는 boneTexture를 해제하고 null로 만든다. 캐시 공유 geometry/map과 원본 skeleton은 해제하지 않는다. 분리 잔해 clone은 그 renderer가 해제한다.

가벼운 실제 Three.js 검사는 skinned mesh2개를 복제하고 boneTexture를 생성한 뒤 dispose2회를 실행했다. clone texture 해제2, 원본 skeleton texture/공유 map/geometry 해제0을 확인했다. GLB fetch만 fixture이며 GPU/browser 할당 검사는 아니다. 통합 담당이 실제 반복 생성/폐기 시 renderer 자원 plateau를 검사한다. 기존 core48 검사는 코드가 바뀌지 않았으며 이번 좁은 자원 검사와 구분한다. 테스트 임시 소스는 work/battlefield-skeleton-check.mjs로 커밋 대상이 아니다.

새 VFX-V2-INTERFACE.md는 별도 아트 담당의 대표6종을 연결하는 읽기 검토다. 필수 런타임6개와 대표6개의 차이, 부분 v2 선택/fallback, 실제 플레이어 포구·적 함포 프록시, host/state lifecycle, 내장 이동 소유권·reset·검사 공백을 기록했다. 새 아트나 버전 선택 adapter를 구현했다고 표시하지 않는다. 기존 v1은 기본값이며 실제 v2 아트 제작은 combat-vfx-v2 담당 범위다.

## 준비 파일과 SHA-256

아래 목록은 이 READY 시점의 파일이며, 자기 파일을 제외한 전체 receipt는 `handoff-files.json`에 있다. 인계 후 변경은 새 버전·새 해시로 전달한다.

| 파일 | SHA-256 |
|---|---|
| `tools/battlefield/assets.js` | `624532b463d498c5b0ad3ccc1c2ade75ea903af819b6871b6c0fb6aff0f3834b` |
| `tools/battlefield/build.cjs` | `60dc61e4afe76318df72a31f19730f02d8b2454070afadc09c363d7fd0f49773` |
| `tools/battlefield/example-adapter.mjs` | `a71058450d56fc3cd1d470834300e265116f55fcdfbf64737bf80c0372cd9bac` |
| `tools/battlefield/index.html` | `401e61b3b1a972e00e8d0dbf22258c05e5eec1523786e8e886630a307d202df2` |
| `tools/battlefield/integration.mjs` | `39cf6a211874b56ba5769ec6103c4db7665273376934abd54fab6a421dd2fe7f` |
| `tools/battlefield/integration.test.mjs` | `285f24708bc69869f24bcb5abb604ce8f157d86c0f9114c408c87aca35b51ea2` |
| `tools/battlefield/main.js` | `43f60c65f48045112ff1a080b6e9b193d7c14763c2446a08fda5f67a398c0d17` |
| `tools/battlefield/README.md` | `9ff13112248a01d5fbe50036792f19298e7ea2a675946aac2d0a393015960e08` |
| `tools/battlefield/receipt.test.mjs` | `47574696e65bf1a57d1266a5078a36e6cd092030ba72b3dc3c1f72440289c958` |
| `tools/battlefield/sim.mjs` | `49d915d5f906857f28ec2bb6109a97c2739091c8d8b1ecd336768fd393a7fce7` |
| `tools/battlefield/sim.test.mjs` | `63de8c7cfd49f0ed5df04298ee490ea96de23cfe36e3c8a1869528432448990f` |
| `tools/battlefield/style.css` | `f62e71e4fc0e39a836b348f22654b1e6191f895bfeb7bb47d516be91ec835c59` |
| `tools/battlefield/verify-bindings.mjs` | `a666a1815759c24f6032d4d20c757f1608ee73fe9d394308329a09deab384aa9` |
| `tools/battlefield/verify.cjs` | `385d659cc568acce0c0f76e68d27cea3584843f49096eba6e4bfee55a3ee2072` |
| `tools/battlefield/vfx-contract.mjs` | `d8d173bd83830cdbb37802523a959e0cef2c41d57e55b0918055ccc8372f23c4` |
| `tools/battlefield/vfx-contract.test.mjs` | `618a38236c90b90471edeb3c82cde2aee9a5b5006e1ffa4b87a865ad51edc8e2` |
| `tools/battlefield/VFX-V2-INTERFACE.md` | `39ae3acc1e6cdb84e15e531d35c5e4a5bb3cf4aca94e7386ed3f0123c1174d8e` |
| `tools/battlefield/vfx.js` | `982595ffa38eff702bb7133aa61639b786cd098e724da891400ad5e12c200813` |
| `tools/battlefield/world.js` | `7260d294fd8a97cc6f13202e3f1d6f7b51db9837905acb850874833a6133f13e` |
| `outputs/battlefield-v1/integration-preparation.json` | `3630a2c9ede1b5d051614468afa069691768b789ab75b27cb872c685d402c434` |
| `outputs/battlefield-v1/receipt-stress.json` | `c678b0834045b6feadd9eaed310e66c1b03df47672e7b4d441aec5b753b5131b` |
