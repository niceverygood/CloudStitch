Cloudstitch · 첫 바람의 항로 — 전장 v0.1
2026-10-18 / 로컬 플레이 시제품

저장소를 HTTP로 제공한 뒤 outputs/battlefield-v1/index.html을 연다.
예: python3 -m http.server 8080 --bind 127.0.0.1
주소: http://127.0.0.1:8080/outputs/battlefield-v1/index.html
file:// 직접 열기는 지원하지 않는다. 기존 fleet-v1/ships/의 실제 GLB 4개가 필요하다.

WASD/방향키 이동 · Space 가속 · 마우스 조준/클릭 사격
기관총 버튼 길게 누르기: 가까운 표적 자동 조준
Tab 표적 전환 · F 인양 · H 남쪽 부두 귀환 · M 항로 · 휠 확대 · Esc 멈춤
모바일: 왼쪽 스틱과 오른쪽 동작 버튼. 효과음은 오른쪽 위에서 켠다.

구름과 부유섬 사이에서 적의 예고 사격을 피하고 주황색 연결부를 끊는다.
거리10 이내에서 분리된 부품 묶음을 인양하고 남쪽 부두의 청록색 원 안에서 귀환한다.
인양은 화물 적재이며 자동 장착이 아니다. 화물이 있으면 적 전멸 없이도 귀환할 수 있다.
과적은7초 유예이며 Esc 화면의 화물 투하로 복구한다. 일시정지 중 위험 타이머도 멈춘다.

기존 함대 GLB/원화/뷰어를 보존하고 별도 소스 tools/battlefield/와 별도 출력에만 구현했다.
실제 3D/부품표시는 기존 에셋을 읽으며 새 유료 모델/이미지 생성은 하지 않았다.
전장 지형·지역명·수치·충돌은 이번 플레이 검증용 제안이다. 최종 엔진·치수·성능 예산은 미정이다.

이번 구현: 이동/조준/포격예고/피격/연결부분리/인양·소유권/화물/과적·투하/귀환 결과.
미구현: 장착 편집, 전체 항구경제/정산, 영속저장, 캠페인, 패드, 최종 무기별 효과/정밀물리.
새로고침하면 초기화된다. 귀환 결과를 저장이나 전체 게임 완성으로 해석하지 않는다.

재현: node tools/battlefield/build.cjs
규칙검사: node --test tools/battlefield/sim.test.mjs
브라우저검사: BATTLEFIELD_URL=<로컬주소> node tools/battlefield/verify.cjs
자세한 출처·검증·한계: tools/battlefield/README.md
