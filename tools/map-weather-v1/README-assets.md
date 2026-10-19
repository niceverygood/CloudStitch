# Cloudstitch 날씨 시험장 아트 소스

`createWeatherAssets()`는 실제 THREE 메시와 그룹을 만들며 `{root, stations, update, setMode, setExpression, inspect, dispose}`를 반환한다. 엔진·충돌·피해·기후 판정은 이 파일이 소유하지 않는다. `stations`는 `cloud/updraft/crosswind/lightning/icing/thermal` 키의 Map이다.

- 기존 `tools/map-atmosphere-v1/sky.mjs`의 `sunlit-cloud`, `rising-cloud`, `mist-ribbons`, `storm-front` 네 원형을 읽기 재사용한다. 새 구름 종류로 중복 집계하지 않는다.
- 신규 기능 형태는 민트빛 붓결 상승 흐름, 산호색 봉제 바람자루 관측대, 낙뢰 접지 관측대와 분기 번개, 서리 풍차·고드름 배관·예열 화로, 삼연식 압력 성벽이다. 큰 실루엣·꿀빛 목재·청록 도색·황동 테두리·크림 천을 겹치고 부속은 위상을 달리해 움직인다.
- `update(state, dt)`는 초 단위 `state.time`, `state.weather.lightning.{phase,target}`, `state.weather.thermal.{phase,jetIndex}`, `state.player.{icing,preheating}`를 사용한다. 번개는 경고 시작에 고정된 시뮬레이션 target을 따르고 열풍은 해당 lane의 burst 때만 보인다. 방향·분사 수·판정 폭을 아트에서 새로 정하지 않는다.
- `setMode('painted'|'cel'|'original')`로 정점 채색·셀 명암·표준 무광 재질을 비교한다. `toon`, `handdrawn` 별칭도 받는다. 셀 명암과 외곽선은 런타임 기능이며, 중앙 GLB 정적 스냅샷에 해당 셰이딩이 자동 보존된다고 설명하지 않는다.
- 정적 장면을 중앙 exporter로 내보낼 수 있도록 canvas·외부 이미지·셰이더 주입·외부 I/O를 쓰지 않는다. 움직임은 런타임 메시/그룹 변형이다. 동작 전체를 재현하는 GLB animation clip이나 유체/직물 물리, LOD, 엔진용 collider는 없다.

에셋 원형 생성은 별도 유료 서비스 호출·이미지 생성 없이 로컬 코드로 한다. 새 source2를 덮어쓰는 변경이 아니라 기존 sourceREADY의 읽기 인스턴스다. 소유 쓰기 경계는 `assets.mjs`, `asset-catalog.mjs`, 이 설명 파일 세 개다.

`setExpression('standard'|'dramatic')`은 같은 배치·카메라·날씨 시점에서 표현을 비교한다. 기본값은 `dramatic`이다. `standard`는 1차 원형과 그 업데이트를 보존하며 신규 표현 그룹을 숨긴다. `dramatic`은 2026-10-18 최신 **10배 이상 과감하고 극적이며 풍성하게**라는 지시를 형태와 재료, 예비 동작·분출·여운의 설계로 적용한다. 크기나 피해량 배수가 아니다.

- 상승: 넓게 걷어 올리는 낮은 유입 → 조밀한 나선 → 꽃잎처럼 펼치는 꼭대기 흐름과 씨앗 확산의 3층이다.
- 횡풍: 바람자루가 먼저 반대쪽으로 굽고, 긴 천 흐름이 빠르게 지난 다음, 자루가 반동을 남기며 복원된다.
- 낙뢰: 고정된 sim target 위로 전하 가닥이 모인다. 발광 주줄기·바깥 분기가 낙하하고, 회복 단계에는 옅은 전기 여운이 떠오른다.
- 착빙: 큰 가지 형태의 결정과 엔진 외피의 미세한 설탕 성에를 서로 다른 크기 층으로 만든다. 결정9개·설탕72개는 공유 geometry의 2개 InstancedMesh로 표현한다. 예열하면 말리는 수증기와 포물선 불씨가 따로 움직인다.
- 열풍: 압력등의 박동·노즐의 작은 숨결 → 두껍고 부드러운 주분출·위로 말리는 보조 흐름 → 잿빛 잔류 증기로 끝난다. 실제 위험 lane과 단계는 계속 sim에서 읽는다.

`asset-catalog.mjs`의 `WEATHER_EXPRESSION_PROFILES`가 source1/source2의 비교 목적과 적용 층을 기록한다. `inspect()`는 전체 mesh 수와 현재 visible mesh 수, instance 수를 반영한 삼각형을 구분한다. 원본 sky4 소스는 수정하지 않았다. 최신 표현의 실제 전후 렌더 비교 및 사람의 미술 승인은 중앙 QA 이후에도 별도로 구분한다.

2026-10-18 경량 확인: 두 MJS의 `node --check` 통과. 직접 생성/정점 유한성 확인은 작업 머신 루트에 `three`가 없어서 `ERR_MODULE_NOT_FOUND`로 중단했으며 새 설치를 하지 않았다. 실제 생성 수치·브라우저 렌더·모바일·통합 시뮬레이션은 중앙 QA에서 확인해야 한다. 사람의 미술 승인은 받지 않았다.
