# Cloudstitch VFX v2 source

저장소 루트에서 실행한다. 원본 `outputs/combat-vfx/`, 무기, 선체를 읽기만 하며 v2 폴더만 쓴다. 공용 패키지/잠금 파일과 타 세션 코드는 수정하지 않는다.

기존 의존성: Three.js0.180.0, esbuild0.25.10, Playwright1.62.1. 일반 환경은 루트의 기존 설치를 재사용한다. 이번 세션은 공용 설치와 충돌하지 않도록 동일 버전을 `work/combat-vfx-v2/deps/`에만 캐시했다. 캐시/원시 Meshy 응답은 Git 제외다. 이 경로를 다른PC에 있다고 가정하지 않는다.

```sh
node tools/combat-vfx-v2/record.cjs baseline
node tools/combat-vfx-v2/generate.cjs representatives
node tools/combat-vfx-v2/generate.cjs all
node tools/combat-vfx-v2/sequences.mjs
node tools/combat-vfx-v2/check.cjs --write --require-all
node tools/combat-vfx-v2/build.cjs --representatives
node tools/combat-vfx-v2/first-preview.cjs
node tools/combat-vfx-v2/qa.cjs --smoke --write
node tools/combat-vfx-v2/record.cjs verify
```

`generate.cjs`와 `sequences.mjs`는 새 v2 파일을 재작성한다. Meshy 유료 작업을 호출하지 않는다. `records.cjs`는 이미 존재하는 로컬 작업 스냅샷에서 승인된 필드만 추려 장부를 작성하며 네트워크 호출이 없다. 다른PC에서는 저장된 장부를 보존한다.

`core.cjs`는 실제 Meshy GLB의 메시/UV/기본색 텍스처를 바이너리로 복사·재사용한다. 붓획은 폭이 변하는 얕은 입체 단면을 곡선에 따라 휘고, 천은 두께 있는 조각으로 만든다. `primary.cjs`/`secondary.cjs`는 효과별 시간·방향·개수를 설계한다. 48개를 각각 유료 생성한 것이 아니다.

GLB에는 표준 translation/rotation/scale 클립이 있다. `extras.runtime_fade={start,peak,end,opacity}`의 시간은 초이며 별도 뷰어 재질 어댑터다. glTF의 재질 애니메이션이나 엔진 파티클이라고 설명하지 않는다. 셀 명암/윤곽선도 뷰어 기능이다. `OutlineEffect.autoClear=true`를 유지한다.

기관총 비교 기본 부착은 현재 리그의 실제 `Muzzle` 노드다. bind pose를 사용하고 +Z 발사축을 선체의 -X로 맞춘다. 해당 소켓은 임시 위치다. 외부 독립 무기 배치는 정확한 엔진 장착이 아닌 근사 시안이다. v1/v2에 동일 초·카메라·배율을 적용하며 모델마다 자동 정규화하지 않는다.

`comparison.html`은 실제 렌더를 확인한 대표6의 자체 포함 오프라인 비교다. 후속 작업은 이 파일과 대표6 GLB를 보존했다. 잔여42효과·6시연은 소스와 실제 GLB를 검토했고, 효과19종과 시연6종을 다시 생성했다. 새 렌더·아트 승인은 아직 없다.

전체54는 `outputs/combat-vfx-v2/review/index.html`의 자체 포함 비교 페이지10개로 나눴다. 각 페이지는 약25~72MB다. `review-render-queue.json`에는 ID별 현재 v1/v2 파일 크기·SHA256, 소스 해시, 샘플 시간, 기대 관측, 루프 경계가 있다. `handoff-inventory.json`은 최종 소스와 산출물 크기·SHA256 목록이다. 대표6의 이전 캡처를 잔여48의 검수 기록으로 세지 않는다.

후속 재현 명령은 다음과 같다. `prepare`는 상태와 큐를 다시 쓰므로 의도한 변경 후에만 사용한다. `build`와 `inventory`는 브라우저를 실행하지 않는다.

```sh
node tools/combat-vfx-v2/review-pack.cjs prepare
node tools/combat-vfx-v2/review-pack.cjs build
node tools/combat-vfx-v2/gallery.cjs
node tools/combat-vfx-v2/preflight.cjs --write
node tools/combat-vfx-v2/review-pack.cjs inventory
node tools/combat-vfx-v2/qa-review.cjs
```

`qa-review.cjs`의 기본 실행은 큐 요약만 출력하고 파일·브라우저를 만들지 않는다. 통합 담당이 단일 브라우저 슬롯을 확보한 뒤 아래처럼 한 묶음씩 실행한다. `--run`에서만 브라우저1개·페이지1개로 순차 캡처한다. `--write`는 검증 기록을 v2 출력 폴더에 저장한다. 대표 대조 항목을 포함하려면 `--include-controls`를 추가한다. 자동 검사는 아트 승인을 기록하지 않는다.

```sh
node tools/combat-vfx-v2/qa-review.cjs --run --batch=mortar-harpoon --write
node tools/combat-vfx-v2/qa-review.cjs --run --id=03-mortar --write
```

모든54를 한 HTML에 넣는 `build.cjs` 기본 빌드는 선택 사항이며 수백MB가 될 수 있다. 기존 `qa.cjs --write` 전체 검사와 `--smoke --write` 대표 검사는 별도 경로다. 이 후속 작업에서 새 브라우저·모바일·다운로드·잔상 검사를 실행하지 않았다.

`check.cjs`는 의존성 없는 이진 구조·표준 TRS·시간에 따른 실제 메시 행렬 검사다. 설치된 Khronos validator가 없으면 그 상태를 명시한다. 이를 공식 Khronos 오류0·경고0으로 바꾸어 말하지 않는다.

`preflight.cjs`는 브라우저 없이 108개 v1/v2 모델 해시, 비교10페이지 해시, 대표 보존, 소스 문법, JSON·로컬 링크, 원본63파일과 공용 파일 보존을 확인한다. `--write`일 때만 `verification/followup-preflight.json`과 최신 원본 보존 기록을 저장한다. 마지막에 `inventory`를 실행해 그 기록까지 해시에 포함한다.

후속 전장 어댑터는 `outputs/combat-vfx-v2/recipes.json`의 effect별 선택과 v1 fallback을 사용해야 한다. 대표6과 전장 필수6은 다르며 base URL을 통째로 바꾸지 않는다. 기존 소비기가 읽는 `recipes.integration_contract`는 v2의 `recipes.lifecycle_contract`에 대응한다. 기존 `<effect-id>_projectile_carrier_0`는 v2 `<effect-id>_moving_payload_0`와 manifest의 `projectile_geometry_subtree`로 명시적으로 매핑해야 한다. 자동 호환 상태가 아니다.

게임에서는 현재 이벤트의 `muzzleFrame` 월드 위치·방향을 기준으로 VFX +Z를 정렬한다. 이미 정규화한 선체 좌표에 원본 리그용 Y=-π/2 회전이나 비교 표시용0.24 보정을 다시 적용하지 않는다. 발사체 내장 Z4 이동은 미리보기용이며 게임 발사체 이동과 중복하지 않는다. 실제 hit만 명중 표시를 일으키고 상태종료/projectile-ended/풀 반환 계약을 따른다. 이 소스는 기존 전장 소비 코드를 변경하지 않는다.
