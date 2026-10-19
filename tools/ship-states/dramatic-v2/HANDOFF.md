# Cloudstitch 30레벨 진화와 6유형 극적 표현

직접 사용자 요청: Lv1~30 점진 진화, 이어서 주인공 함선 모든 유형을 훨씬 과감하고 극적으로 표현.
새 소유는 `tools/ship-states/evolution30/`, `tools/ship-states/dramatic-v2/`와
각각 `outputs/ship-states-v1/` 아래 같은 하위 디렉터리입니다. 기존v1/선택원본/공통파일은 보존합니다.

`evolution30/variants.js`는 기존 원형 factory를 읽고30개 누적 모듈과6초 프로펠러 루프를 작성합니다.
큰 주형태(삼중 선체/상층 쌍기낭/왕관 기낭), 중간 기능(갑판/공방/생활관/추진/등대),
작은 생활층(난간/등/화분/봉제/황동/깃발)을 계층화했습니다. root scale1, 소스11,026tri 보존.
병합한 추가 면과 회전 부품을 합쳐 L30은114,722tri/91mesh입니다. 게임 성능예산 확정값이 아닙니다.

`dramatic-v2/variants.js`는 성장30 외에 평소/피해/무장/장갑/폭발을 따로 재설계합니다.
대형 기계·찢김/기낭처짐·하부판/엔진분리·곡면 방패·중함포·작살·전조→분출→파열→여운을
원본과 다른 큰 덩어리/방향/리듬으로 만들었습니다. 단순 root 확대/색만 변경한 반복은 아닙니다.
v1·직전 단계·원래 배를 같은 시점/배율로 비교합니다. v1 폭발은4초를6초 비율로 매핑합니다.
최신 강도 요구의 실제 시각 제안이며 사람의 ‘충분히 과감함’ 미술 승인은 별도입니다.

API: `createVariantLibrary(gltf).create(category,stage)` → `{root,parts,counts,update,dispose}`.
evolution30: e1~e6 각stage0~4 = Lv1~30. dramatic-v2: normal3/damage4/weapons5/armor5/growth30/explosion5.
dramatic-v2는 `original`과 `v1-카테고리`를 비교용으로 지원합니다. 축+Y 위/-X 전방, source 길이~.95,
미터·엔진용 socket 미정. 표준재질·기하와 파생 동작은 뷰어 시제품입니다.
VFX 소비자는 성장형 `parts.TurretAssembly`/`parts.GunBarrel`을 숨겨 기존 포탑을 대체할 수 있습니다.
W1원형중심[-.2868655,-.103,.0097655], 원포구[-.436768,-.027588,-.001953]은 시연 추정좌표입니다.
원 무기/새 procedural 포대와 실제 무기GLB의 포구를 혼동하지 않습니다.

```sh
node tools/ship-states/evolution30/verify-source.cjs
node tools/ship-states/evolution30/build.cjs
node tools/ship-states/dramatic-v2/verify-source.cjs
node tools/ship-states/dramatic-v2/build.cjs
# 통합 예약 슬롯에서만
node tools/ship-states/dramatic-v2/verify.cjs
```

기존 package/lock와 준비된 NODE_PATH를 읽기 사용하며 공통 설치·변경은 없습니다.
경량 검사는 실제 선택GLB를 읽어30/52형상·root1·성장별추가기하·47루프·폭발60정역·원본SHA를 검사합니다.
브라우저 하네스는 단일browser/page에서52실표시/썸네일/비교·진화·조작·3잔상·GLB·폭발종료·모바일,
6대표 전후PNG/52도감 및 별도30도감 열기를 검사합니다. 실제 게임/엔진성능·미술 승인은 아닙니다.
v1의 exactRaster FAIL은 별도 원형 기록이며 새 버전에 자동 합산·PASS 처리하지 않습니다.
HP·에너지·레벨·세이브·sim/무기판정·오디오 변경0, 유료 생성0, 배포·commit·push0.

## 실제 QA와 수정 범위
첫 전체 실행은 HTML a79c6fee…에서 기능52/좌우표시/3×120잔상0/조작/GLB/반응형/별도30뷰어 PASS였습니다.
그러나 실제 비교 PNG의 폭발에서 잔해가 커다란 목재 상자로 보이는 미술 오류를 발견했습니다.
그 원raw·manifest·폭발PNG·overview·52도감은 qa-initial/에 보존합니다. 기능 PASS를 미술 PASS로 간주하지 않습니다.
수정은 dramatic-v2/variants.js의 smoothstep 인수 순서와 splinter/ribbon 초기scale 유지 두 부분입니다.
최종 HTML은 5c72e73fb87d64f663a0ff7d1a4f4f7c78bab18dd84b439313a6dc5a737c6571입니다.
verify-explosion.cjs는 수정 범위만 6시점×3모드로 다시 확인합니다. 최종 verification-explosion.json의 결과를 따릅니다.
전체52와 성장·조작·불투명 잔상 검사는 변경 없는 입력의 첫 실행 근거를 상속하며 다시 실행했다고 주장하지 않습니다.
