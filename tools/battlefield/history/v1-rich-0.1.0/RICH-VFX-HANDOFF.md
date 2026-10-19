# Cloudstitch · v1 효과 확대 연결

사용자 최신 선택: **v1의 형태와 색을 유지하고 더 크고 풍성하게 표시한다.** v2 아트로 전환하지 않는다. 원본 GLB·카탈로그·기존 출력은 보존한다. 이 문서는 새 `rich-vfx-handoff.json`에 대응하며 이전 `handoff-files.json`의 동결 스냅샷과 구별한다.

## 실제 전투 연결

```js
const vfx = createCombatVfx(THREE, scene, { presentation: 'rich' });
await vfx.load();
vfx.consume(events, battle.state.projectiles, battle.generation);
vfx.update(simulatedDeltaSeconds, battle.state.projectiles);
// retry/depart/clear-combat 경계에서는 vfx.reset(nextGeneration)
// 화면 해제에서는 vfx.dispose()
```

기본 호출은 계속 `presentation:'original'`이다. `rich`는 기관총·함포의 기존 6 GLB를 그대로 사용한다. 포구 1.4배, 탄체 1.35배, 명중 1.5배이며 포구·명중에 작은 지연 복제 1~2개를 더한다. 추가 `effectScale`은 기본 1을 사용한다. 별도로 1.45 등을 다시 곱하지 않는다. echo 회전은 효과 로컬 +Y축이다. 모든 복제는 원본 단발 클립의 종료 시점에 함께 반환한다.

기존 sim·피해량·충돌 반경·사거리·발사 주기·전투 시간에는 손대지 않는다. 이동은 원래 `projectile_carrier` 자식 형상에 실제 sim 위치만 적용하며 GLB 전시용 비행 애니메이션을 재생하지 않는다. 명중은 실제 hit 이벤트 한 번에서만 생성한다. echo는 새로운 fire/hit 이벤트나 투사체를 만들지 않는다. raw sim을 사용하는 소비자는 기존과 같이 세대 경계에서 reset해야 한다. 세대를 전달하면 이전 세대의 높은 seq도 현재 이벤트 커서를 전진시키지 못한다.

`update()`의 dt는 **sim 시간 차이**를 사용한다. pause/패배/다른 수동 render에는 0을 전달한다. 화면 RAF 시간과 driver의 수동 render를 각각 더하지 않는다. 전투 API 계약은 기존 `battlefield-authority-0.2.1` 그대로다.

## 표시 한도와 검사 값

효과별 활성 단발 32개, 활성 투사체 64개, 비활성 풀 24개로 한도를 구별한다. 활성 한도를 넘으면 표시만 생략한다. sim 피해·이동·종료는 바꾸지 않는다. 풀 한도 초과 clone은 mixer를 해제한다. scene 공유 geometry/material/texture는 source dispose에서 한 번만 해제한다.

`debug().perEffect[id]`는 `spawned/active/peak/pooled/maxPooled/layerCount/meshPerInstance/activeLayers/activeMeshes/maxActive/maxLayers/maxMeshes/dropped/culled`를 제공한다. `spawned`는 재사용을 포함한 표시 횟수다. `activeVisualLayers`는 지연 중인 층도 포함한 할당 수다. reset은 활동 표시·이벤트 참조·세대 커서·통계를 비우며 유효한 비활성 풀은 재사용한다.

## 48종 외형 비교

`vfx-rich-profiles.mjs`가 기존 카탈로그 48개 ID 모두의 표시 크기를 정의한다. 연기·폭발은 1.6배, 재질 피격은 1.5배, 상태·방어·수리는 1.3배다. 투사체·지속 상태·작살·회수·장착·수리 표시는 중복 행동을 암시하는 echo를 넣지 않는다.

`node tools/battlefield/build-rich-preview.cjs`는 새 `outputs/battlefield-rich-vfx-v1/preview.html`을 만든다. 기존 선체·독립 무기와 48개 원본 GLB를 같은 시계로 비교하는 작업대다. 내장 탄환 궤적은 전시용이며 실제 전투 충돌을 뜻하지 않는다. 실행과 실제 브라우저 QA는 통합 담당이 맡는다. 원본 뷰어·v1/v2 산출물을 덮어쓰지 않는다.

## 검증과 한계

기존 전투·receipt·VFX 계약 48건, 새 48종 profile 검사 10건, 실제 Three.js runtime 검사 14건(상위 1+하위 13), 총 Node 검사 72건과 실제 9 GLB 바인딩·해시 검사를 통과했다. mixer·clip 종료·좌표 권한·실제 sim 단발 피해·중복/구세대 차단·풀 TRS 복원·100발 상한·해제를 `vfx-runtime.test.mjs`로 검증했다. `BATTLEFIELD_DEPENDENCY_ROOT`는 이미 three가 설치된 checkout 경로로 지정할 수 있다. 최종 파일 해시는 `rich-vfx-handoff.json`을 확인한다.

전체 48종은 외형 비교 대상이고 실제 전투 연결 범위는 기관총·함포 6종이다. 나머지 4무기의 범위·견인·상태·분사 전투 구현을 완료했다고 표현하지 않는다. 별도 상용 엔진·성능 예산·최종 밸런스 확정도 아니다. 새 유료 이미지/3D 생성, push, 배포는 수행하지 않는다. 브라우저 검사 결과는 통합 담당의 새 결과 문서에서 확인한다.
