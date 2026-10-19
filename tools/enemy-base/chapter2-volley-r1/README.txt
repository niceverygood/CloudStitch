Cloudstitch · 2탄 적조의 왕관 · 화살 폭우
사용자 직접 요청: 다연장 화살포를 엄청나게 배치해 주변으로 화살을 쏟아내기.

원 기지 모델의 BIN/원mesh/material/image/accessor를 정확 보존한 별도 GLB에
48개 24연장 포대/목재 안장/뼈 버팀대와 4파의 GLB 화살 비행·반동·재장전 클립을 더한다.
192개 공유 배치노드에 각각24개의 실제 화살이 들어 있어 8초 시연에 4608발이다.
배치 내24개는 비행변환을 공유하며 미세한 부채 확장은 표현이다. 물리판정/피해가 아니다.
10배 표현 기준을 다층 포대·방사 포화·연속 파동·반동·잔여 비행·재장전의 강한 리듬으로 적용한다.

기존 NODE_PATH 의존성 three/esbuild/playwright/gltf-validator. 신규 설치/공통 서버 없음.
저장소 루트에서 arm.cjs→inspect.cjs→build.cjs→qa.cjs→finalize.cjs 순서.
중앙 접속 불가 및 현재 유일 active/공유슬롯 available 확인은 출력COORDINATION_NOTE.txt.
한 번에 한 생성/브라우저 작업만 직렬 실행, finally close와 사전/사후 source 보존 대조.
실패는 원본보고서를 보존하고 관련 코드만 수정한다.

뷰어: 재생/일시정지/처음/시간탐색/반복/전체포화범위. OS 줄인동작 설정에서 자동재생하지 않는다.
원본 기지와 게임 sim/무기/VFX 공통소스 불변. 장비 수/전투밸런스/실제 피해 규칙 확정 아님.
음향은 이번 요청에서 새로 만들지 않았다. GLB는 애니메이션1개를 실제 포함한다.
윤곽/셀 명암은 런타임 기능이고 OutlineEffect.autoClear=true를 유지한다.

실제 미술 읽기 후 화살의 네모 편대를 표준 GLB morph weights로 보강했다.
한 배치의 비행변환은 공유하지만 24개 화살별 위치/방향 morph delta가 달라, 포구 이후 앞뒤·좌우로 퍼진다.
추가노드/런타임동적생성 없이 실제 GLB morph/transform만으로 작동한다.
