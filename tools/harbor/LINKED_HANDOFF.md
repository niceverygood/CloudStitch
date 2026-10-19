# 항구 전장 연결 후속 인계

소스 준비 버전 **harbor-v1.0.2-ready**. 이전 `outputs/harbor-v1/`와 그 v1.0.0 인계 manifest는 당시 독립 예시 이력으로 보존합니다. 새 소스 해시는 `outputs/harbor-linked-v1/source-manifest.json`입니다.

수정은 소유 범위 안의 네 파일입니다.

- `tools/shipyard/shipyard.mjs`: 선택 장착부품 HP0을 출항 전에 구체 이유로 거부합니다. 전장 loadout 생성 실패 뒤 출항 상태에 갇히는 경로를 차단합니다.
- `tools/harbor/core.mjs`: 저장된 출항 준비 상태에서 보관 동작 후 같은 항해 ID와 departure 경계를 유지합니다. activeVoyage/phase/boundary 모순은 저장 형식 검증에서 거부합니다.
- `tools/harbor/adapters.mjs`, `core.mjs`: 출항 때보다 높은 귀환HP는 현 전장이 지원하는 핵심 선체에 한해 actual spent.S가 순복구HP×0.5 이상일 때 허용합니다. 전장 수리 지출 없이 HP가 증가하거나 다른 부품 HP가 증가하면 거부합니다. 전장 호출자가 권위 상태의 실제 scrap 차이를 spent로 제공할 책임이 있습니다. 이벤트 링을 합산하지 않습니다.
- `tools/harbor/core.test.mjs`: 위 경계 회귀와 유상 현장수리 복구 검사를 추가했습니다. 규칙 총48건(항구12+개조11+저장25) 통과입니다.

root 통합의 `tools/integration/session.mjs` / `pilot.mjs` / 렌더러는 이 담당이 수정하지 않습니다. root가 화물 보관 출항 gate, 현장 수리의 실제 scrap 지출 반영, 실패한 귀환 저장 재시도와 전장 생성 실패 rollback을 담당합니다.

## 실제 연결 검사

```sh
node tools/harbor/verify-linked.mjs PATH_TO_INTEGRATED_REPOSITORY
node tools/harbor/finalize-linked.mjs
```

통합 source를 현재 checkout에 합쳤다면 경로 인수를 생략할 수 있습니다. 테스트는 root의 `createVoyageController`와 `runSortie`를 직접 가져옵니다. 새 별도 시뮬레이터를 만들지 않습니다.

`verify-linked.mjs`는 첫 지역의 실제 이동/조준/발사/충돌→절단→인양→부두 귀환→정산저장→화물보관→수리/회수엔진 장착→저장/재출항을 두 번 실행합니다. HP 직접 편집·teleport·예시 귀환 데이터·별도 적 spawn을 사용하지 않습니다. root pilot이 실제 전장 입력을 자동으로 공급합니다. 두 교전은 회수 후 선택 철수이며 중간/최종 보스 전체 구간 완주가 아닙니다.

출항 준비 안전 저장을 새 controller에서 같은 항해 ID로 재개하는 경로, 화물 미보관 출항 거부, 항구 dirty rollback 거부, 실제 회수 엔진 E2 장착과 다음 전장 loadout 포함, 귀환 자동저장, 같은 정산 재전달 불변을 확인합니다. 마지막 journal은 `work/verification/harbor-linked/`의 새 실행 폴더에만 기록하고 **새 Node 프로세스**를 시작해 동일 부품/자원/2정산 상태를 다시 읽습니다. 이 파일 저장 어댑터는 검사 전용이며 제품 파일 저장 설계 확정을 의미하지 않습니다.

첫 항해에서 실제 피격 후 battlefield repair 명령으로 5HP를 복구하며 발생한 스크랩 지출도 귀환 원장에 한 번 반영되는지 확인합니다. HP를 직접 덮어쓰거나 자원을 지급하지 않습니다.

결과 `outputs/harbor-linked-v1/verification.json`은 실제 사용한 통합 source SHA-256, 입력 계수, 각 항해 자원/부품 수, 새 프로세스 재개 결과를 기록합니다. 검사 성공 때만 `passed:true` 파일을 씁니다. source 준비 manifest와 실제 실행 성공 보고서는 구분합니다.

Node의 기본 임시 평면 포구를 사용하는 통합 상태 검증입니다. GLB 포구·3D 렌더·키보드/마우스·브라우저 localStorage/reload·모바일·잔상 검사는 root 통합 브라우저 QA를 따릅니다. 원본 아트·게임 엔진 확정·전체 캠페인/밸런스 검증을 완료했다고 주장하지 않습니다.
