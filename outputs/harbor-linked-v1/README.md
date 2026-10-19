# Cloudstitch · 실제 전장–항구 연결 검사

현재 통합 controller와 `tools/battlefield/sim.mjs`를 사용해 실제 입력으로 두 번 출항·교전·절단·인양·귀환했습니다. 회수 후 선택 철수하는 짧은 순환이며 중간/최종 보스 전체 경로의 완주 검사는 아닙니다.

`verification.json`은 2026-10-18의 `harbor-v1.0.2-ready` + `battlefield-authority-0.2.1` 통합 source를 대상으로 한 결과입니다. 사용한 각 소스의 SHA-256을 함께 기록했습니다. 예시 귀환 데이터, HP 직접 변경, 위치 순간이동, 별도 적 생성은 사용하지 않았습니다.

| 검사 | 실제 결과 |
|---|---|
| 첫 항해 | 실제 발사16·명중15·절단1·인양1, 적탄 피해18 |
| 현장 수리 | 실제 5HP 복구, S2.5 소비가 귀환 원장에 반영 |
| 항구 정비 | 남은13HP를 S4로 수리, 회수 엔진 E2 장착 |
| 두 번째 항해 | 실제 발사17·명중17·절단1·인양1, E2 장착이 전장 loadout에 유지 |
| 최종 자원 | S113.5 / F40 / C2, 전장 보상·연료 소비를 임의로 추가하지 않음 |
| 최종 상태 | 부품10개, 정산2건, 고유ID·소유권 유지 |
| 새 프로세스 | 파일에 저장한 journal을 새 Node 프로세스에서 읽어 전체 상태 일치 |
| 동일 귀환 재전달 | 부품·자원·정산 수 불변 |
| 안전 경계 | 준비한 동일 항해ID 재개, 화물 미보관 출항 거부, 미저장 항구 변경 rollback 거부 |

규칙 검사48건과 이 실제 연결 검사는 별개입니다. `source-manifest.json`은 7개 소스의 고정 준비 버전이며 `verification.json`은 그 소스가 실제 통합 controller에서 동작한 실행 결과입니다. 이전 `outputs/harbor-v1/`의 S284/F34/C3은 독립 예시로 다른 시나리오입니다.

`return-retry-verification.json`의 추가5단계도 통과했습니다. 실제 인양 뒤 귀환 자동저장을 실패시켜도 현재 정산1건·화물2부품·마지막 출항저장이 유지됐습니다. 쓰기 실패 중 귀환 재시도는 계속 실패로 표시하고 미저장 상태 불러오기는 거부합니다. 저장소를 복구한 뒤 귀환을 다시 눌러 정산 재적용 없이 저장했고, 새 controller의 상태가 일치했습니다. 이 장애 검사는 모의 저장소의 쓰기 실패 주입이며 OS/브라우저 저장장치 장애를 실제 발생시킨 검사는 아닙니다.

실행은 저장소 루트에서 합니다.

```sh
node tools/harbor/verify-linked.mjs PATH_TO_INTEGRATED_REPOSITORY
node tools/harbor/verify-return-retry.mjs PATH_TO_INTEGRATED_REPOSITORY
```

실제 제품 화면은 통합 담당의 `outputs/integration-v1/index.html`입니다. 이 폴더는 검사 보고서이며 별도 게임 화면이 아닙니다. 이 Node 검사에서는 임시 평면 포구를 사용합니다. 실제 GLB 포구·브라우저 reload/localStorage·표시/입력·5분 렌더·다중 브라우저 결과는 통합 담당의 브라우저 QA 보고서를 확인하세요.

통합 담당의 최종 브라우저 보고서를 `integration-browser-verification.json`으로 복사해 대조했습니다. **21/21 통과, 페이지 오류·외부 요청·실패 요청0**입니다. Chrome 실제 두 항해/GLB Muzzle·명중VFX/수리 실소비/장착/브라우저 새로고침 복원/잔상/모바일 가로 넘침/5분 지속 렌더링과 Edge 자산·효과·일시정지를 포함합니다. 이 브라우저 검사는 통합 담당이 실행했으며 이 담당은 완료 보고서와 실제 preview를 읽어 확인했습니다.
