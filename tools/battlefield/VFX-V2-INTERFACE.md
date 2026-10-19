# Cloudstitch VFX v2 연결 검토

작성·갱신일 2026-10-18. 기준: `vfx.js`, `vfx-contract.mjs`, `assets.js`, `sim.mjs`, `HANDOFF.md`, v1/v2 recipes와 v2 `progress.json`, `progress-summary.json`, `art-review.txt`, `integration-handoff.json`. **읽기 검토·후속 연결 명세이며 새 adapter의 구현 완료 기록이 아니다.** 54개 v2 GLB의 실제 파일·구조 확인과 대표6의 시각 검토를 전체 아트/런타임 완료와 구별한다. 기존 전투 권위/기본 v1 선택은 유지한다. 새 아트는 `tools/combat-vfx-v2/`, `outputs/combat-vfx-v2/` 담당이 제작하고, 통합 담당이 버전 선택 adapter를 소유한다.

## 1. 현재 필수 6개와 대표 6개의 차이

기존 `createCombatVfx()`는 다음 6개를 모두 검증·로드한다. 효과 semantic ID는 유지하고 버전은 asset set/metadata로 구분한다.

| weapon_id | 발사 / attachment.mode | 비행 / attachment.mode | 명중 / attachment.mode |
|---|---|---|---|
| `01-machine-gun` | `machine-gun-muzzle` / muzzle | `machine-gun-projectile` / projectile | `machine-gun-hit` / impact-surface |
| `02-deck-cannon` | `cannon-muzzle` / muzzle | `cannon-projectile` / projectile | `cannon-hit` / impact-surface |

각 catalog 항목과 recipe는 ID/weapon_id/model이 일치해야 한다. model은 현재 `assets/<id>.glb` 형식, loop=false, 양수 duration이다. 실제 GLB의 단발 clip 이름·길이·재질/텍스처·축·아트 배율은 manifest로 기록한다. 생성 성공이나 파일 존재를 아트 승인으로 세지 않는다.

새 제작의 대표 6종은 위 런타임 필수 6개와 다르다.

| v2 대표 ID | 현재 연결 가능 범위 | 추가로 필요한 작업 |
|---|---|---|
| machine-gun-muzzle | 기관총 발사 효과의 같은 ID 교체 | effect별 버전 선택 adapter |
| cannon-hit | 함포 실제 충돌 효과의 같은 ID 교체 | effect별 버전 선택 adapter |
| smoke-puff | 기존 런타임 소비 없음 | 실제 배기/잔연기 trigger와 attachment, 수명 정의 |
| flamethrower-stream | 무기 매핑만 있고 runtimeSupported=false | 실제 유효 분사 start/update/stop, 호스트/포구 추적, 원뿔 접촉 판정 |
| shield-pulse | 기존 런타임 소비 없음 | 실제 방어 반응과 호스트 anchor/취소 처리 |
| repair-stitch | player-repaired 이벤트는 있으나 VFX 소비 없음 | 복구 대상 anchor·실제 restored>0 조건·재시도/호스트 제거 취소 |

현재 v2는 효과48+공격시연6, 총54개 GLB가 실제 생성됐고 구조 확인 기록도54개다. 위 기관총/함포 필수6개도 catalog와 실제 파일에 모두 있다. 시각 비교 검토는 대표6개이며, 나머지42효과+6시연의 시각 검수와 전체 전투 통합은 아직 남아 있다. 파일 부재를 가정하지 않으며, 구조 확인을 전체 아트 승인이나 런타임 교체 완료로 기록하지 않는다.

## 2. 경로·선택 adapter의 정합성 결함

현재 `vfx.js`는 `ASSET_BASE='../combat-vfx/'`가 고정이고 factory에 assetBase/selector 옵션이 없다. `runtimeAssetDescriptors()`는 위 6개의 catalog/recipe를 전부 요구한다. v2에는 필수6개가 모두 있지만 **base URL만 바꿔도 다음 실제 schema/node 차이로 바로 호환되지 않는다.** model에 `../combat-vfx-v2/...`를 넣는 방식도 현재 model 경로 검사를 통과하지 못한다.

| 항목 | 현재 v1 loader의 기대 | 현재 v2 데이터 | 필요한 adapter 처리 |
|---|---|---|---|
| 최상위 레시피 계약 | `recipes.integration_contract` | `recipes.lifecycle_contract` | 계약 의미를 검증해 내부 표현으로 정규화. 원본 v1/v2 JSON을 임의 개명하지 않음 |
| 투사체 형상 node | `<id>_projectile_carrier_0` | `<id>_moving_payload_0` | v2 recipe의 `projectile_geometry_subtree`를 실제 GLB에서 확인해 선택 |
| 비행 표시의 별도 꼬리 | carrier 하위만 사용, 시연 형제 연기 배제 | `<id>_painted_velocity_tail_2` 등의 별도 시연 wrapper | 실제 이동형 표시에서는 제외하거나 실제 경로로 별도 구동. 내장 translation 이중 적용 금지 |

현재 validator는 lifecycle_contract만 있는 v2 recipe를 integration_contract 누락으로 먼저 거부한다. 이를 정규화해도 고정 carrier 이름을 그대로 쓰면 투사체 node 찾기에 실패한다. MG/cannon 두 projectile GLB의 moving_payload/painted_velocity_tail 이름을 JSON으로 직접 확인했다. 이 검토는 데이터/파일 읽기이며 새 adapter 실행이나 브라우저 통합 검사가 아니다. 일부만 제공하는 후속 catalog도 여전히 필수6 전체 검사를 통과하지 못하므로 effect별 혼합 선택은 별도 adapter에서 처리한다.

통합 담당은 각 semantic ID에 대해 준비·검증된 v2가 있을 때만 선택하고, 나머지는 v1으로 돌리는 별도 adapter를 제공해야 한다. 기본 선택은 v1이다. 파일 존재만으로 자동 승격하지 않는다. `assetSet`, `source_model`, `actual_model`, `motion_owner`, `clip`, `scale`, `anchor`, `stop/reset`, `review_status`를 명시해 선택의 근거를 남긴다. 이 필드는 제안 계약이며 현재 factory가 이미 해석하는 API가 아니다.

두 페이지가 `outputs/<page>/index.html` 깊이이면 sibling v1/v2 경로가 가능하다. 더 깊은 경로의 페이지는 동일 상대 URL을 그대로 복사하지 말고 현재 문서 URL 기준으로 검증한다. GLB는 내장 리소스를 우선하고 CDN/계정별 경로/외부 텍스처에 의존하지 않는다. 통합 실행본은 별도 worktree에 있으므로 공유 checkout의 v2 파일이 서버에 자동 반영된다고 가정하지 않는다.

현재 v2 공유 폴더에는 `assets/`48개, `sequences/`6개, catalog/recipes 및 `comparison.html`, `gallery.html`이 있다. `progress.json`은 structure_verified=54, 대표 비교6개, runtime_integrated=[], full_scope_art_complete=false, full_scope_runtime_complete=false를 구분한다. `art-review.txt`는 대표6의 실제 선체 비교 렌더와 가림/명암 보정을 기록한다. 전체54의 아트나 게임 적용이 끝났다고 설명하지 않는다. 원본63파일 보존 확인과 나머지42+6 시각 검수는 v2 담당이 계속 소유한다.

## 3. 실제 anchor와 좌표

전장은 XZ 평면, +Y 위, 게임 전방 +Z이고 거리/배율은 시제품 LU다. 미터나 기획U 환산이 아니다. `loadShip()`은 원본 -X 전방을 Y축 +90도로 정규화하고 실제 bounds의 X 길이로 targetLength(기본10)를 맞춘다.

플레이어는 `aimAt(worldDx,worldDz,heading)`와 최신 wrapper 위치/회전을 적용한 뒤 `muzzleFrame()`의 월드 `position/direction`을 `muzzleResolver`로 전달한다. native `Muzzle`의 -X축을 월드 방향으로 변환한다. `muzzleOffset()`은 group 로컬 좌표이므로 월드 이벤트에 직접 넣지 않는다. 한 프레임 이전의 렌더 transform을 읽지 않도록 physics 사격 직전에 현재 상태로 맞춘다.

`Muzzle`은 선택 비행선 리그에 지정한 provisional 소켓이다. 독립 `weapon-modules` GLB는 자동으로 이 소켓에 장착된 상태가 아니다. sequence-catalog의 approximate_muzzle도 합성 시연 좌표이며 실제 원본/리그 로컬 위치로 복사하지 않는다. model pose·scale을 바꾸면 같은 카메라의 선체/포신/섬광 겹침을 재검토한다.

**현재 적 함포는 실제 Muzzle anchor가 아니다.** `enemy-fire`는 `moduleWorldPosition(enemy,cannon)`의 평면 중심과 y=1.3을 사용한다. 플레이어 muzzleResolver만 연결돼 있다. 적 포구를 고치려면 별도 적 소켓 resolver와 같은 tick의 방향/가림 판정을 통합 담당이 연결해야 한다. 기존 느린 cannon 훈련탄 표시는 모든 적의 실제 장비 패턴 완성이 아니다.

포구 표시의 +Z는 실제 발사축이다. 피격 표시는 +Y=접촉 표면 바깥 법선, +Z=입사 방향의 접선 투영이다. 정면 충돌로 접선이 없어지면 안정된 접선을 선택한다. 월드 +Y를 모든 충돌 법선으로 고정하지 않는다. 전투 투사체 이동은 아직 planar이며 y축 탄도를 구현했다고 설명하지 않는다.

현재 normal은 GLB의 정밀 메시 법선이 아니라 swept circle 평면 프록시의 법선이다. 현재 이벤트에는 hostForward가 없어 레시피의 호스트 전방 투영 fallback을 자동 사용하지 않는다. 수리 이벤트도 restored/scrapSpent만 있고 복구 표면 위치·법선·hostId는 없어 수리 표시 adapter가 실제 복구 대상에서 anchor를 제공해야 한다.

## 4. 이벤트·재생·이동 소유권

발사 이벤트 `player-fire/enemy-fire`는 `seq,projectileId,weaponId,x,y,z,direction`을 제공하고, 실제 충돌 `hit`는 같은 ID와 `normal,target,enemyId?/moduleId?`를 제공한다. `projectile-ended`는 충돌/사거리·TTL/귀환/패배/clear 경계에서 탄환 표시를 종료한다. 시연 clip 시간은 충돌·피해를 발생시키지 않는다. 큰 고유 명중/재질 피격/폭발을 한 접촉에 모두 겹치지 않는다.

현재 v1 loader는 `<effect-id>_projectile_carrier_0` node 하위만 복제한다. clip을 재생하지 않고 carrier translation/scale/rotation을 초기화한 형상을 sim 위치·속도축에 배치한다. 원본의 0→4 로컬 이동, 끝 scale=.001, 형제 전시 연기는 모두 배제한다. v2는 실제 `<effect-id>_moving_payload_0`를 사용하고 recipe의 `projectile_geometry_subtree`/`projectile_adapter`가 해당 subtree 복제·TRS 초기화·시연 clip 미재생을 명시한다. 별도 painted_velocity_tail wrapper의 시연 이동도 실제 physics와 중복하지 않는다. 새 adapter가 이 node/geometry 차이를 해석해야 하며 현재 v1 loader가 자동 지원하는 것은 아니다. 전체 translation을 제거하면 탄피·파편 애니메이션도 사라지므로 이동 소유 노드만 다룬다.

투사체의 motion_owner는 battlefield, 포구/충격의 로컬 모양 연출은 GLB clip이다. 합성 `sequences/*.glb`는 전체 공격 시연이며 실제 충돌 표시 소스로 사용하지 않는다. 박격포의 내장 호/작살 전시 줄/화염 타임라인은 각각 실제 탄도·케이블·분사 판정과 별개다. 나머지 4무기의 실제 판정은 미구현이다.

포구/명중은 실제 원본 단발 AnimationMixer clip을 재생하고 clip 끝에 풀로 반환한다. 현재 v1 단발 root는 이벤트 위치에 고정되며 host follow/cancel을 하지 않는다. **VFX API를 단독 사용하면** clearCombat은 탄환만 종료해 이미 생긴 one-shot이 clip 끝까지 남을 수 있다. **기존 통합 renderer는 combat-cleared에서 effects.reset()을 호출해 단발 효과도 제거한다.** 이는 모듈 단독 사용의 한계이며 통합본의 잔류 결함으로 해석하지 않는다. 움직이는 선체 부착·상태형 v2는 별도 host 갱신/제거/즉시 취소를 추가해야 한다. flamethrower-stream의 loop는 실제 분사 유효 상태가 끝나면 중지하며 연료·피해·상태 시간을 늘리지 않는다.

## 5. pause·reset·자원 소유

pause에서는 VFX update dt=0, battlefield advance도 정지한다. retry/depart의 새 generation에서 `vfx.reset()`을 호출하고 이전 state 참조·event cursor를 버린다. 세대 전환 없이 seq가 초기화되면 이벤트가 누락된다. cursor/최근 terminal receipt는 표시 중복 방지용이며 피해 권위를 대신하지 않는다.

풀 반환: action stop/reset/time0, mixer stop/time0, 원래 child TRS, 표시 root 위치/회전/scale/visible, 부모/host/projectile/endpoint 참조를 모두 초기화한다. v2의 per-instance opacity/shader uniform/texture-frame/상태 loop를 추가하면 그 값도 reset한다. 공유 원본 material을 직접 변경해 다른 풀 인스턴스까지 변색시키지 않는다. 원본 GLB·cached geometry/map은 보존하고 새로 소유한 자원만 해제한다.

`assets.js` 후속0.2.2는 loadShip 인스턴스 고유 skeleton/boneTexture만 Set으로 중복 제거해 dispose한다. cached geometry/map은 유지한다. 분리 잔해 clone skeleton은 그 clone을 소유한 renderer가 별도로 해제한다.

## 6. 대표 묶음의 검수 기준

같은 실제 비행선/무기, 카메라·배율·재생 시각으로 v1/v2를 비교한다. 크림색 연기와 황동빛 불꽃, 편안한 청록, 산호색 포인트, 붓 면과 2~3단 명암이 선체와 이어져야 한다. 연기/화염/수리의 방향·리듬·실루엣을 구별하고 연결부·표적을 가리지 않는 실제 화면 크기로 검토한다. 현재 구형 갤러리의 다면체/원뿔/토러스 반복은 사용자에게 부적합 판정을 받은 비교 원본이다.

파일/clip/loop/stop/reset/축/해시 검사와 아트 승인 결과를 별도로 기록한다. 실제 GLB·텍스처 로딩, 발사→실제 이동→접촉→표시 종료, pause/retry, 작은 화면, 외부 요청 없음, OutlineEffect.autoClear=true/잔상은 통합 담당이 검증한다. 이 문서를 썼다고 새 VFX 아트나 여섯 무기/전체54개 통합이 완료된 것은 아니다.

기존 loader는 첫 clip을 사용하며 recipe.duration_seconds/catalog duration/실제 clip 길이의 일치나 clip 이름·hash를 런타임에서 검증하지 않는다. v1 전용 verify-bindings 검사를 v2 검증 완료로 확대하지 않는다. 새 adapter의 선택 전 검사에 이 값을 포함한다. 효과 원본 재질을 그대로 사용하므로 선체의 toon 변환을 자동 상속하지 않는다. 새 Meshy 텍스처·재질·조명에서도 회화적 외형을 직접 확인한다.
