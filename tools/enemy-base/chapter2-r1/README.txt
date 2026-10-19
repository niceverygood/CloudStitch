Cloudstitch · 2탄 적군 기지 · 적조의 왕관 chapter2-r1
사용자 요청: 2탄 무드보드에 맞춘 실제 3D, 1탄보다 화려한 표현.
1탄 모델을 재사용하지 않고 패각/뼈/산호/직물/테라스/항구의 새 입체 형상을 작성했다.
10배 방향은 거대한 나선/포식자 실루엣, 중간 기능층의 거주/교량/포대/기중기,
작은 창/진주/밧줄/성장선/재료 붓결을 겹치는 방향이다. 단일 scale 배수가 아니다.

기존 three/esbuild/playwright/gltf-validator 설치 또는 NODE_PATH 사용. 신규 설치 없음.
CPU 준비: node tools/enemy-base/chapter2-r1/generate.cjs --bundle-only
중앙 명시 START 슬롯에서만 순서대로 실행, 실패 시 중단하고 원 보고서 보존:
node tools/enemy-base/chapter2-r1/generate.cjs
node tools/enemy-base/chapter2-r1/paint.cjs
node tools/enemy-base/chapter2-r1/inspect.cjs
node tools/enemy-base/chapter2-r1/verify-surface.cjs
node tools/enemy-base/chapter2-r1/build.cjs
node tools/enemy-base/chapter2-r1/qa.cjs
브라우저 finallyclose와 source/readonly 사후 대조 후 즉시 슬롯 반환.
node tools/enemy-base/chapter2-r1/finalize.cjs
실제 PNG 미술 읽기와 문서 포장은 슬롯 반환 후 진행한다.

paint는 별도 이미지 생성 없이 결정적 canvas 붓결로 자체1024x1024 아틀라스 1장을 만들고
UV와 함께 실제 GLB에 내장한다. 원 정점색/위치/법선을 유지하고 표면 전후를 정확 대조한다.
원 정점색 GLB/manifest는 geometry-baseline/에 보존, 중간본의 별도 browser PASS는 주장하지 않는다.
본 출력은 정적 아트 시제품. 실제 전투/AI/파괴/충돌/LOD/장착 소켓/내부/애니메이션 미구현.
윤곽선/셀 명암은 뷰어 런타임이며 OutlineEffect.autoClear=true 유지.
무드보드 일치와 사람의 미술 승인, 형식/화면 기술 검증은 별개이다.

복구: 최초 paint의 browser target closed를 보존하며 메모리 압력은 가설이다.
새 재현은 generate→index-exact→paint→inspect→verify-surface→build→qa 순서.
이번 복구는 원 geometry-baseline을 입력으로 index-exact부터 시작하며 재generate하지 않는다.
index-exact는 position/normal/color와 최초 triangle UV식 결과의 비트를 유지하고 완전히 같은 속성만 묶는다.
indexed 중간 형상은 surface-baseline에 보존, paint 이후 UV/color/indices까지 정확히 대조한다.
