Cloudstitch · 봉쇄 대성채 reference-r3
2026-10-19 / Asia/Seoul

사용자 첨부 무드보드의 비율·형태·재료를 기준으로 다시 해석한 실제 입체 에셋이다.
원본 첨부는 outputs/enemy-base-v1/reference-r3/reference.png에 보존한다.
넓은 다층 철갑 선체와 기낭, 빽빽하게 겹친 불규칙한 원통탑·지붕·회랑,
큰 외향 함포, 오른쪽 돌출 계류장, 높은 황동 종탑, 검붉은 군기와 흰 봉인천을 우선한다.
원본 v1과 grand-r2는 덮어쓰지 않는다. baseline 형상에서 재사용한 기계·포대·관문을
새 비율로 배치하고 새 건축·철갑·리벳·표면·천 형상을 겹친 별도 revision이다.

실행: 저장소 루트, 기존 three/esbuild/playwright/gltf-validator 설치 또는 NODE_PATH 사용.
node tools/enemy-base/reference-r3/prepare.cjs
node tools/enemy-base/reference-r3/generate.cjs --bundle-only
중앙 슬롯 START 후:
node tools/enemy-base/reference-r3/generate.cjs
node tools/enemy-base/reference-r3/paint.cjs
node tools/enemy-base/reference-r3/inspect.cjs
node tools/enemy-base/reference-r3/build.cjs
node tools/enemy-base/reference-r3/qa.cjs
node tools/enemy-base/reference-r3/finalize.cjs

정점 재료색·그린 듯한 표면·면 명암은 GLB에 들어가며 셀/윤곽은 뷰어 런타임이다.
paint.cjs는 기존 enemy-fleet-reference-v1의 보존된 도색 재료 아틀라스를 재사용한다.
첫 정점색 GLB·구조검사·47항목 검사·대표 PNG는 geometry-baseline/에 별도로 보존한다.
paint는 기존 입력 GLB에 UV와 텍스처를 담는 브라우저 exporter이며 중앙 슬롯이 필요하다.
단일 이미지에 없는 후면·아래·가려진 구조는 제작자의 해석이다. 원화 픽셀과 완전 일치를 주장하지 않는다.
좌표는 상대 설계 단위이며 실제 미터·엔진·성능 예산은 미확정이다.
정적 아트 에셋. 전투·AI·충돌·LOD·내부·파괴·소켓·캠페인은 이 작업 범위에 없다.
‘10배’는 표현의 대담함이며 수치나 규모 배수의 검증 결과가 아니다.
