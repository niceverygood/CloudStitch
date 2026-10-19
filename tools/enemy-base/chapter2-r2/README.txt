Cloudstitch · 적조의 왕관 chapter2-r2

사용자 요청: 2탄 무드보드에 맞춘 실제3D, 1탄보다 화려하게.
r1은 기술49PASS와 별도로 실제 미술 읽기에서 큰 검은 패각 입구와 둥근 집의 장난감 인상을 발견해 보존했다.
r2: 입체 나선에 진주층 부채 장식캡, 각진 패각 거주 파사드와 어두운 홈, 큰 측면 전당/공중 교량,
전면 넓은 산호 팬, 볼륨 있는 화석 장갑과 풍부한 색/명도층을 적용한다. 10배는 표현 계층의 대담함이다.
원화와 1탄/r1은 보존.

기존 three/esbuild/playwright/gltf-validator 또는 NODE_PATH 사용. 신규설치 없음.
CPU prepare: node tools/enemy-base/chapter2-r2/generate.cjs --bundle-only
명시 중앙 START 후: generate→index-exact→paint→inspect→verify-surface→build→qa 각 .cjs 순서.
중복정점은 모든position/normal/color/triangleUV 비트가 같은 경우만 묶고 triangle순서로 전수확장대조.
paint는 동일UV를 유지하며 자체1024POT 결정적canvas 재료아틀라스를 GLB에 내장한다.
geometry-baseline은 최초 비색인, surface-baseline은 색인 중간. 원본은 덮어쓰지 않는다.
finallyclose/source-preservation후 RETURN먼저, 이후 finalize.cjs/실PNG미술읽기/납품.
세모드/ghost120/조작/texture/UV/모바일/download49검사는 기술검증, 사용자 미술승인은 별도.
정적 아트 시제품이며 전투/AI/충돌/LOD/내부/소켓/파괴/애니메이션은 없음. 엔진/스케일/예산 미정.
