Cloudstitch · 봉쇄 대성채 dense-r4 / 2026-10-19

사용자 직접 수정: r3가 단순하고 장난감 같으므로 비대칭 밀집 건축과 낡은 철판·장식을 풍성하게.
상시 최신 10배 방향을 scale 배수가 아닌 큰 형태/중간 기능/작은 재료층으로 적용한다.
큰 형태: 반복 원통탑 교체, 서로 다른 폭과 층수의 비대칭 건물군, 높인 종탑과 지붕 마을.
중간 기능: 돌출 공방/발코니, 공중 회랑, 큰 버팀대, 계단/산업 배관, 시계.
작은 재료: 찢어진 갑옷 치마, 겹친 수선 판금, 리벳/녹흐름/용접선, 창문/등/누빈 깃발.
기존 r3/원화는 읽기 보존. 사방의 실제 부피이며 이미지 프로젝션은 사용하지 않는다.

검증된 기존 설치 또는 NODE_PATH 필요: three 0.180 / esbuild / playwright / gltf-validator.
공유 의존성 신규 설치, package/lock 수정, 서버 시작은 하지 않는다.
먼저 CPU 준비: node tools/enemy-base/dense-r4/generate.cjs --bundle-only
중앙 명시 START 슬롯에서만 순서대로 실행하며 실패 시 중단한다:
node tools/enemy-base/dense-r4/generate.cjs
node tools/enemy-base/dense-r4/paint.cjs
node tools/enemy-base/dense-r4/inspect.cjs
node tools/enemy-base/dense-r4/verify-surface.cjs
node tools/enemy-base/dense-r4/build.cjs
node tools/enemy-base/dense-r4/qa.cjs
finally browser close + source hashes 보존 확인 후 즉시 heavy 슬롯 반환.
node tools/enemy-base/dense-r4/finalize.cjs

paint는 r3에서 보존한 기존 아틀라스만 재사용한다. 최초 정점색 형상 GLB와 manifest는
geometry-baseline/에 보존하지만 이 중간 형상에 대한 별도 브라우저 QA를 주장하지 않는다.
최종 실제 GLB를 공식 검사하고 세 모드/120프레임 잔상/조작/원화/모바일/다운로드를 검사한다.
comparison.html은 실제 r3/r4 PNG를 동일 시점·전체화면 맞춤 조건으로 비교한다.
실제 렌더를 미술 검토하고 기술 PASS와 사용자 미술 승인을 구별한다.
정적 아트 에셋. 엔진 미터/성능 예산 미정. 전투/AI/충돌/LOD/내부/파괴/소켓/애니메이션 없음.
셀/윤곽 효과는 뷰어 런타임이며 OutlineEffect.autoClear=true 유지.
