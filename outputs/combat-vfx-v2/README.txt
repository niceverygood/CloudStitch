Cloudstitch 전투 효과 v2 · 2026-10-18

바로 열기: comparison.html — 대표6종의 실제 선체/무기 v1/v2 동기화 비교
첫 실제 포구: verification/first-machine-gun-muzzle.png
대표 렌더: verification/smoke-captures/
전체 파일: assets/48 GLB, sequences/6 GLB
잔여 검수 시작: review/index.html — 전체54를 담은 자체 포함 비교10묶음
통합 QA 인계: QA_HANDOFF.txt / review-render-queue.json / handoff-inventory.json

이번 제작은 Meshy 기본형2개(연기·불꽃)의 메시/UV/2K기본색 텍스처를 재사용하고,
효과별 붓획·천·실·파편과 시간 연출을 로컬 작성한 실제 입체 효과다.
기존 v1의 신규 Meshy 작업은0건이며 이번 v2는2건이다.
대표6의 비교 검수와 전체54의 구조 검사를 구분한다.
후속 검토: 잔여42효과·6시연의 소스/실제GLB 검토 완료.
효과19종·시연6종을 재생성했고 최신54파일의 구조/TRS 검사가 통과했다.
대표6 GLB와 기존 comparison.html을 보존했다.
후속 새 렌더0건. 새 비교10페이지는 준비 상태이며 아트 승인은 통합 QA 대기다.
최신 상태는 progress.json / delivery.json / art-review.txt를 확인한다.

비용: 실제 작업 응답 각15크레딧, 합계30. 최초잔액4599→최종4569.
작업ID·operation ID·해시는 production-ledger.json / manifests/에 기록했다.
새 리메시·리텍스처·사람용 자동리깅·54개별 유료 생성은 하지 않았다.
원본54·선체1·무기6·첨부2의63파일은 source-inventory.json으로 보존했다.

GLB 내장: 표준 이동/회전/스케일 애니메이션, 기본색 텍스처 또는 정점색.
별도 런타임: 부드러운 opacity fade, 셀명암, 윤곽선.
extras.runtime_fade는 별도 어댑터가 읽는 초단위 레시피다.
표준GLB만 엔진에 넣으면 시간별 불투명도/윤곽선이 자동 재현되지 않는다.

기관총 기본 비교는 실제 리그Muzzle의 bind pose를 사용한다. 소켓은 임시다.
그외 외부 무기 받침/피격면/수리 위치는 근사 아트 배치다.
카메라/크기/시간은 비교 가설이며 미터·피해·사거리·게임성능 확정값이 아니다.

후속 런타임 연결은 recipes.json의 effect_id별 선택과 v1 fallback을 유지해야 한다.
대표6과 전장 필수6은 다른 묶음이다. base URL을 통째로 바꾸지 않는다.
기존 recipes.integration_contract → v2 recipes.lifecycle_contract의 어댑터가 필요하다.
기존 <id>_projectile_carrier_0 → v2 <id>_moving_payload_0를 명시적으로 매핑한다.
manifest의 projectile_geometry_subtree도 확인한다. 자동 호환 연결은 미완료다.
게임 muzzleFrame 월드 위치/방향이 권위값이다. VFX +Z를 해당 방향에 맞춘다.
정규화된 전장 좌표에 원본 리그 Y=-π/2와 비교용0.24 보정을 중복 적용하지 않는다.
내장 투사체Z4 이동은 시연용이므로 게임 발사체 이동과 중복 적용하지 않는다.
실제충돌/hit만 명중 효과를 선택하고 상태종료/projectile-ended에서 해제한다.
풀 반환은 time/transform/parent/target/endpoints/opacity/loop를 초기화한다.
현재 전장 소비 코드·저장슬롯을 수정하거나 실제전투 연결 완료로 표시하지 않았다.

ID별 SHA/크기·샘플 시간·기대 관측은 review-render-queue.json에 있다.
소스와 실제 산출물 전체 SHA/크기는 handoff-inventory.json에 있다.
qa-review.cjs 기본 실행은 큐 요약만 한다. --run은 통합 브라우저 슬롯에서만 실행한다.
새 렌더/모바일/다운로드/잔상회귀·Khronos·엔진 성능은 통합 QA에 인계한다.
상세 재현: ../../tools/combat-vfx-v2/README.md
원본과 타세션 코드를 보존했으며 git commit/push·배포·새자동화를 하지 않았다.
