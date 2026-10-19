# Cloudstitch 주인공 상태 도감 인계

소유 범위는 `tools/ship-states/`와 `outputs/ship-states-v1/`입니다. 공통 package/lock,
기획 수치, 다른 소유자의 전장·함대·VFX·음향·항구·저장은 수정하지 않습니다.

사용자 요청의 6항목을 31개 고유 단계로 구현했습니다. `catalog.json`에는 실제 목록과
고유 ID(`normal-00` 등, 성장 `growth-lv01`~`growth-lv09`), 설명, 대표시점과 링크가 있습니다.
31개는 별도 게임 함선이나31개 저장 GLB의 수가 아니라 내장 원형에서 구성하는 외형 단계입니다.
상단6항목/하단31카드와 원형-선택형 동기카메라 작업대를 연결합니다.

실제 입력은 선택 GLB(3,645,884bytes,11,026삼각형)와 기존 `part-map.json`입니다.
GLB SHA는 `dae35b13806d553a8b124d502a81d7dff58c183a266db25efc0d9a060198ce74`이며
원본 텍스처와 삼각형을 보존합니다. `airship-rig-v1`과 무기/VFX는 참고만 했고
그 출력/소스를 수정하거나 파생 리그·기존 무기 GLB를 새 완성 자산으로 세지 않습니다.

아트는 `docs/ART_DIRECTION.txt`의 따뜻한 수공예·손그림 입체3D를 적용합니다.
누적 목재 갑판/난간/보조 기낭/엔진/선수/화물/관측대/깃발/등과 황동 겹판을 만들고,
새 부품에는96×96 절차적 목재·직물·도색금속 붓결을 사용합니다. 원형의 산호 패치와
크림 기낭·원형창·목재 선장실을 유지합니다. 영화의 고유 구조를 복제하지 않습니다.
실제 최종 렌더는 `overview.png`와 QA 보고서에 결속합니다. 사람의 미술 승인은 별도입니다.

동결 뒤 수신한 최신 상시 기준인 ‘10배 이상 과감하고 극적이고 풍성한 표현’도 수락했습니다.
이 v1을 그 새 기준의 최종 이행으로 승격하지 않습니다. 원31개와 기술 PASS/FAIL을 보존하며,
후속 제작은 큰 천 파열·외판 분리의 비대칭, 기낭·갑판의 강한 질량과 여러 높이의 생활 장치,
주화염·방향성 재료 파열·말리는 후행 연기·잔해의 여운을 시간층으로 재설계합니다.
scale나 파편 수만 배수로 늘려 완료라고 하지 않고, 같은 카메라·시점의 v1과 전후 비교합니다.
현재 v1의 동결된 외형과 좁은 기술 검증은 그 후속 표현 검토와 구분합니다.

빌드/경량 검사(저장소 루트, 기존 잠금 의존성 사용):

```sh
node tools/ship-states/verify-source.cjs
node tools/ship-states/build.cjs
```

Node 전용 검사는 실제 GLB의JSON/BIN/accessor/노드변환을 읽으며 텍스처 디코딩은 하지 않습니다.
31형상/원형보존/성장9단계 기하증가/루트 scale1/26루프0=6초/폭발60회 반복·역순을 검사합니다.

통합 예약 슬롯의 브라우저 검사:

```sh
node tools/ship-states/verify.cjs --followup
node tools/ship-states/finalize.cjs
```

첫 전체 검사는31형상·31썸네일·3모드·조작 통과 후 폭발t4 동일시점 픽셀 차이로 실패했습니다.
원 보고서/실패PNG/보존정보는 `initial-*`로 남깁니다. 첫 실행 HTML SHA는 보존했고
그때 하네스 SHA는 미기록입니다. 보존시점 하네스 SHA를 최초 실행 SHA로 주장하지 않습니다.
수정은 폭발 투명 렌더 경로 고정·원본/표시opacity 동기화·6초루프 경계·가시정점프레이밍입니다.
후속은 기존31형상 근거를 참조하며 새31썸네일/6대표/경계포탑/폭발 정역·종료/3잔상120프레임/
GLB·PNG 다운로드/390·768·1440 넘침/외부요청/오류를 확인합니다. 출력 HTML SHA와 최종
보고서/실제 하네스/소스·읽기 의존성·파일크기SHA는 delivery-manifest.json으로 동결합니다.

브라우저는 시작 시 썸네일용 renderer를 한 번 만들고 정리한 뒤 비교 renderer만 유지합니다.
`OutlineEffect.autoClear = true`를 명시했습니다. 루프·폭발은 절대시각 기반입니다.
비교 PNG와 현재 포즈 GLB를 브라우저에서 별도 다운로드합니다. 내보낸 GLB는 정적이며
애니메이션 클립·엔진 셰이더·충돌·LOD가 포함되지 않습니다.

에너지0 폭발은 최신 사용자 요청의 독립 시각 이벤트입니다. 실제 전력0·양력0·연료0,
HP사망 규칙이나 저장 데이터로 연결하지 않았습니다. 피해율·무기/장갑 단계·Lv1~9는
외형 제안입니다. 부품 파열은 물리 시뮬레이션이 아닌 작성한 이동입니다.
새 이미지/유료 Meshy 호출/자동화/배포/commit/push는 없습니다.

최종 ART-REVIEW 인계

`finish-verification.json`은 animationState/crop/transport PASS, exactRaster FAIL입니다.
동일 행렬·재질·카메라에서 pose/update 없이 render()만 반복해도 일부 RGB와alpha 픽셀이
달라집니다. 렌더 없는 getImageData/toDataURL 연속 읽기는 같습니다. 원인은 미확정이며
투명색 합성만의 문제라고 확정하지 않습니다. 4초 종료 프레임은 세 모드 모두 exact PASS입니다.
원 report와 FAIL은 보존하며 임계값으로 PASS를 만들지 않았습니다.

실제 최종 PNG를 보고 투명 화염 위를 덮던 썸네일 윤곽선 한 줄을 수정했습니다.
materialFor의 초기 outline visible에 !source.transparent를 적용했습니다. 실시간 작업대는
resize에서 이미 같은 조건을 적용합니다. 마지막 `capture.cjs` 단일 실행으로 최종HTML의
31개 썸네일 초기화/6카드 실제PNG/오류·외부0을 별도 확인했습니다. 기존 animation/export/
모바일 증거의 HTML SHA와 최종 capture SHA를 구분합니다. 전체 검사를 재실행하지 않았습니다.

`finalize.cjs`는 위 제한을 포함해 `ship-states-v1-ART-REVIEW`를 동결합니다.
`browserPassed:false`, `exactRasterPassed:false`를 그대로 유지하며 사용자 검토 가능한
31단계 외형·동작·다운로드 결과와 정밀 raster 잔여를 구별합니다. 새 표현 목표와
사람의 미술 승인, 게임 연결·엔진 성능 검증은 완료로 표시하지 않습니다.
