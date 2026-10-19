Cloudstitch 항로 환경 에셋 v1 · 대담한 표현 r2

소유 소스: tools/map-atmosphere-v1/ ; 산출물: outputs/map-atmosphere-v1/
원본 보존: 기존 world-assets/core.mjs는 읽기 재사용하며 기존96자산·맵·비행·공통package/lock을 변경하지 않는다.
새24 논리에셋: 공중섬6 / 식생2 / 구름4 / 새4 / 항로·생활소품8.
최신10배 이상 과감함은 큰 실루엣·기능 구조·재료층·동작 리듬의 체감 목표다. 실제10배 미술 승인으로 자동 표시하지 않는다.
baseline-r1/의 세 원본 모듈을 보존하며 root-garden/wind-tree/sunlit-cloud/harbor-gull/mail-balloon/lightning-mast 6개만 비교용 GLB로 따로 저장한다.
신규 논리에셋24와 비교revision GLB6은 별도 집계한다. 실제 같은 카메라·동일 아트 단위·동일 정규화·t=0로 전후PNG12개를 비교한다.
새 여러 마리나 풍등 여러 개를 담은 한 GLB도 논리에셋 한 개다. 조립 장면 추가0.

재현(저장소 npm 의존성이 준비된 환경):
  node tools/map-atmosphere-v1/generate.mjs
  node tools/map-atmosphere-v1/verify.mjs
  node tools/map-atmosphere-v1/build.cjs
  node tools/map-atmosphere-v1/verify-browser.cjs

공용 설치를 읽기 참조하는 경우:
  CLOUDSTITCH_NODE_MODULES에 실제 확인한 node_modules 절대경로를 로컬 환경변수로 설정한다.
  node --no-warnings --experimental-loader ./tools/map-atmosphere-v1/deps-loader.mjs tools/map-atmosphere-v1/generate.mjs
  node --no-warnings --experimental-loader ./tools/map-atmosphere-v1/deps-loader.mjs tools/map-atmosphere-v1/verify.mjs
  node tools/map-atmosphere-v1/build.cjs
  node tools/map-atmosphere-v1/verify-browser.cjs
의존성: three 0.180.x, esbuild, playwright, gltf-validator. 기존 승인된 설치를 사용하며 새 설치나 공통설정을 자동 수정하지 않는다.
브라우저 하네스는 Chrome 기본채널을 사용한다. CLOUDSTITCH_BROWSER_CHANNEL로 사용 가능한 채널을 지정할 수 있다.
선택 인수: verify-browser.cjs [검수할 index.html의 HTTP 또는 file URL]

첫 build에는 미리보기가 비어 있다. verify-browser는 24개 실제 모델을 한 번씩 읽어 PNG24개를 캡처한 뒤 같은 build.cjs로 최종 HTML을 갱신한다.
그 뒤 대표6의 전후 비교와 3종 대표×3모드의120프레임 잔상, 새의 실제 움직임, 필터·검색·탭·모바일·시점·맞춤·회전·다운로드를 확인한다.
format-verification은 실제 GLB/Khronos/각 클립의 노드 변화를 검사한다. 두 결과를 합쳐 실제 검수 범위를 기록한다.
캡처와 export는 COORDINATION 단일 슬롯 예약 안에서만 실행한다. 준비중 소스의 메모리 조립/유한수 검사는 실제 파일·렌더 통과와 구분한다.

공통 아트: 과장된 비대칭 덩어리와 겹구조, 목재/수선천/황동/청록, 붓결 같은 정점 명암과 선명한 실루엣.
로컬 직접 모델링의 실제 입체 메시와 glTF transform clips이며, AI 무드보드의 회화적 디테일을 완전히 재현한 최종 아트는 아니다.
outlineEffect.autoClear=true를 명시 유지한다. 셀 명암·윤곽선은 리뷰창 런타임 표현이다.
충돌, LOD, 엔진 소켓, 실제 맵 배치, 유체/천 물리, 새 AI, 피해/보상/상호작용/캠페인은 구현하지 않는다.
