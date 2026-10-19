# Cloudstitch · 바람과 폭풍 시험 항로

2026-10-18. 사용자 첨부의 여섯 환경 효과를 조종 가능한 항로로 구현한다. 기존 ‘맵 요소 무드보드 기획’의 구름·섬·새·항로 소품 소스를 읽기 재사용한다.

## 구현

- 구름 은폐: 실제 전장 AI의 기존 조준 예고를 취소하고 구름 안에서 재획득을 막는다. 수동 조준과 발사는 보존한다.
- 상승기류: 전장 권위 tick에서 고도·수직 속도를 갱신한다.
- 횡풍: 바람자루의 +Z 방향으로 배가 밀리고 반대 조작으로 버틸 수 있다. XZ 바람은 시험용 흐름 속도, 상승력은 별도 수직 가속도다.
- 낙뢰: 2.6초 전조에서 위치를 고정하고 최종 선박 위치가 위험 범위 안이면 선체에 피해 24를 한 번 적용한다.
- 착빙/예열: 전장 player의 착빙·열 여력만 적분한다. 이동/가속이 느려지며 F를 누르면 착빙을 녹인다. 소진 뒤 F를 놓고 충전한다.
- 열풍: 세 통로를 번갈아 예고하고 분사한다. 지속 중 늦게 진입해도 pulse당 한 번 피해 15를 적용한다. 빈 틈이나 고도 14 이상으로 피할 수 있다.

수치·크기·좌표는 로컬 시험용이며 확정 기획/밸런스가 아니다. Y 3~34의 제한된 환경 고도 시험이다. 기존 전장의 탄·장애물은 XZ 단순 충돌이며 3D 탄 회피나 완성 캠페인으로 표시하지 않는다.

## 단일 상태와 원본 보존

`authority.mjs`는 canonical `tools/battlefield/sim.mjs`를 읽기 참조해 만든 **별도 opt-in 권위 revision**이다. 같은 state/한 tick에서 조종·환경 율·고도·충돌·AI 조준·피해·패배를 계산한다. canonical 소스와 기존 통합 실행물은 바꾸지 않는다. `prepare-authority.cjs`는 소스 SHA를 기록하고 검토한 anchor만 새 소스에 반영한다. 기존 소스가 바뀌면 차이를 먼저 검토해야 한다.

`adapter.mjs`의 실제 연결 API는 `createAuthoritativeWeatherPort().advance({generation,frame,dt,time,player,input})`다. 전달된 절대 시각을 쓰며 player 위치/HP/열/착빙을 적분하지 않는다. 공간/율/가시성/위험 shape 제안만 반환한다. 최종 위치 피격과 source별 단조 seq receipt는 권위 tick이 처리한다. `createWeatherController`는 이전 규칙 검사 fixture이며 실제 시험장에 사용하지 않는다.

`session.mjs`는 이 별도 권위 revision만 advance한다. renderer와 app은 snapshot을 읽고 조작/시험용 이동 명령을 전달한다. renderer가 좌표나 HP를 고치거나 두 sim을 함께 돌리지 않는다. 일시정지·패배에서 시계가 멎고 초기화는 generation/receipt/전조/착빙/HP를 새로 만든다.

## 아트와 에셋

크림 천·청록 기계·꿀빛 목재·황동·산호 수선 천의 따뜻한 수공예, 손그림 같은 입체3D를 따른다. 최신 ‘10배 이상 과감·극적·풍성한 표현’ 기준으로 상승 3층, 횡풍 준비→돌풍→복원, 낙뢰 수렴→분기→잔광, 가지 성에/엔진 서리→예열 증기, 열풍 압력→굵은 주류/말림→잔류 증기를 설계했다. `standard`/`dramatic`은 같은 시간·시점에서 비교 가능하다. 기술 PASS는 사람의 미술·손맛 승인이 아니다.

구름 4종은 map-atmosphere 원본 recipe를 재사용한다. 신규 고유 기능 조립은 5종이며, 중앙 export의 6 GLB는 재사용 구름을 포함한 **정적 구역 조립 스냅샷**이다. glTF animation clip이나 엔진 particle이 아니다. 실제 움직임/상태 표현은 `assets.mjs` 런타임, 윤곽/세 표현 모드는 renderer 기능이다. 선택 비행선 GLB는 원본 바이트를 내장하며 원본 파일은 보존한다.

신규 AI 이미지/유료 Meshy/외부 음원은 호출하지 않았다. 첨부 원화는 `outputs/map-weather-v1/references/user-weather-board.png`로 보존했다. 본 묶음에 새 음향은 없으며 환경 이벤트를 음향 담당이 소비할 수 있다.

## 실행과 중앙 검사

1. 필요하면 기존 잠금 파일의 의존성을 준비한다. 이 담당은 설치하지 않는다. 기존 runtime을 읽기 재사용할 때 `CLOUDSTITCH_NODE_MODULES`로 node_modules 디렉터리를 지정한다.
2. `node --test tools/map-weather-v1/sim.test.mjs tools/map-weather-v1/authority.test.mjs`
3. 중앙 슬롯에서 `node tools/map-weather-v1/build.cjs`
4. 중앙 슬롯에서 `node --no-warnings --experimental-loader ./tools/map-atmosphere-v1/deps-loader.mjs tools/map-weather-v1/export.mjs`
5. 서버의 `outputs/map-weather-v1/index.html`을 연다. central 8840/shared 8860 중 실제 인계된 위치를 사용한다.
6. 중앙 슬롯에서 `node tools/map-weather-v1/verify-browser.cjs` (`CLOUDSTITCH_WEATHER_URL`로 URL 지정).

실행 결과는 `outputs/map-weather-v1/qa/report.json`, 실제 캡처·asset-catalog·build-manifest와 함께 확인한다. 작성 시점 소스 검사 23/23 PASS(환경15 + actual authority8), 브라우저/GLB export는 아직 미실행이다. 최신 결과는 출력의 `verification.json`으로 갱신한다.

검사 범위: 기본옵션 off의 canonical 차등 회귀, 실제 HP/고도/이동/AI 은폐/착빙·예열, 낙뢰 회피·열풍 늦은 진입·초기화·pause·패배, 실제 GLB/세 모드/윤곽선·조작·모바일·잔상·외부 요청. 최종 엔진 성능/전체 캠페인/저장/사용자 승인과 구분한다.

초기 브라우저의 HTML 문자열 치환 문법 실패와 다음 실행의 MSAA 엄격 픽셀 실패를 `outputs/map-weather-v1/history/`에 보존했다. 빌드는 callback 치환으로 원 JS 문자열을 보존한다. 얇은 반투명 리본에서 두 번의 깨끗한 MSAA 렌더끼리도 48픽셀 차이가 나던 문제는 single-sample 버퍼+최소 1.5배 해상도 축소 표시로 보완했다. `OutlineEffect.autoClear=true`와 엄격한 0픽셀 비교는 유지한다. 정지 상태 시점 변경의 즉시 재렌더와 계기 라벨 폭도 보완했다. 런타임 동작·이동/피해 수치 변경은 없다.

## 현재 연결 범위

새 시험 항로는 실제 전장 권위 revision을 사용한다. 기존 항해·캠페인·저장된 항로 전체에 자동 설치하지 않았다. 중앙 허브/기존 맵 모음에는 이 독립 시험 항로 진입 링크로 연결한다. 향후 canonical 승격은 별도 owner 검토와 회귀가 필요하다.
