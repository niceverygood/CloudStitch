Cloudstitch · 적군 대요새 · grand-r2

이 revision은 v1 실제 렌더에서 드러난 얇은 성채와 작은 화면 비중을 보강한다.
기존 tools/enemy-base/와 outputs/enemy-base-v1/의 첫 GLB·HTML·47개 QA·PNG는 그대로 보존한다.
새 소유 범위는 tools/enemy-base/grand-r2/와 outputs/enemy-base-v1/grand-r2/다.

원본 참조
기존 fortress.mjs를 읽기 전용으로 불러오고 model.mjs에서 큰 방어 구조와 미술 레이어를 덧붙인다.
원형의 중앙 황동 종탑·철갑 선체·청록 지붕·검붉은 군기·봉제 부력낭의 정체성을 유지한다.
‘10배 이상 과감함’은 체감·형태 목표이며 삼각형이나 크기의 배수가 아니다.
실제 전후 렌더를 비교하고 사람의 미술 승인은 별도로 남긴다.

준비와 실행 (저장소 루트, 기존 read-only NODE_PATH 또는 정상 의존성)
node tools/enemy-base/grand-r2/prepare.cjs
node tools/enemy-base/grand-r2/generate.cjs --bundle-only
통합 슬롯 배정 후에만:
node tools/enemy-base/grand-r2/generate.cjs
node tools/enemy-base/grand-r2/inspect.cjs
node tools/enemy-base/grand-r2/build.cjs
node tools/enemy-base/grand-r2/qa.cjs
node tools/enemy-base/grand-r2/finalize.cjs

prepare.cjs는 동결 v1 도구를 새 revision 경로로 복사하고 리뷰 구도/전시 높이를 조정한다.
모델·셰이더·리뷰 UI의 원본 v1을 덮어쓰지 않는다.
정적 아트 에셋이며 실제 전투/AI/충돌/소켓/내부/LOD/캠페인/성능 프로파일은 미구현이다.
정점 채색과 무광 GLB 재질, 리뷰 런타임 셀 명암·윤곽선 역할을 구분한다.
검수 의견은 revision별 브라우저 로컬 저장이며 JSON으로 내보낼 수 있다.
