Cloudstitch · 적군 기지 3D 에셋과 로컬 검수 도구

소유 범위: tools/enemy-base/ → outputs/enemy-base-v1/
원화 기준: outputs/enemy-base-moodboard-v2/moodboard.png (읽기 전용)
상시 아트: AGENTS.md, docs/ART_DIRECTION.txt

실행 전
저장소 루트에서 실행한다. Node.js 20 이상과 three, esbuild, playwright,
gltf-validator가 필요하다. 기존 package.json의 three/esbuild/playwright 버전을 따른다.
이 세션은 공통 package/lock이나 설치를 수정하지 않는다. 현재 PC에서는 통합 담당이
확인한 기존 설치를 NODE_PATH로 읽기 전용 사용한다. 절대 캐시 경로는 이 도구의 의존성이 아니다.
새 PC에서는 프로젝트 담당과 의존성을 준비한다. 같은 계정이 로컬 자산을 복사하지 않는다.

재현 (각 단계는 출력물을 갱신하므로 동결된 revision을 먼저 보존)
node tools/enemy-base/generate.cjs --bundle-only
  소스만 work/enemy-base/generator.mjs로 묶는다. GLB export 없음.
node tools/enemy-base/generate.cjs
  실제 정적 3D 형상을 제작하고 GLB로 export한다.
node tools/enemy-base/inspect.cjs
  공식 glTF-Validator와 실제 GLTFLoader로 구조·좌표·그룹·원본 해시를 검사한다.
node tools/enemy-base/build.cjs
  GLB, 비교 원화, Three.js와 조작 코드를 내장한 오프라인 리뷰 페이지를 만든다.
node tools/enemy-base/qa.cjs
  실제 file:// 브라우저로 표시·조작·회전 잔상·원본 다운로드·모바일을 확인한다.

공유 세션 운영
exporter/브라우저/캡처는 outputs/project-command/COORDINATION.txt의 통합 슬롯을 예약한다.
QA 원본은 work/verification/enemy-base-v1/에 기록하고 검수 결과만 소유 출력에 복사한다.
의존성 설치·공통 package/lock·루트 LFS 변경은 통합 담당 소유다.

표현과 범위
실제 입체 메시와 vertex colors, 매트 재질을 GLB에 포함한다.
추가 셀 명암과 윤곽선은 리뷰 런타임 기능이며 GLB만 다른 엔진으로 가져가면 자동 재현되지 않는다.
OutlineEffect.autoClear = true는 명시적으로 유지한다.
구역 그룹은 미술 검수용이다. 실제 게임의 연결 트리·분리·피해·장착 소켓을 확정하지 않는다.
모델은 정적이며 화면의 카메라 회전과 분위기 표현을 GLB 애니메이션으로 주장하지 않는다.
전투, AI, 충돌, navmesh, 내부 탐사, LOD, 엔진 성능·밸런스는 별도 후속 작업이다.

검수 메모
브라우저 로컬 저장소에만 저장된다. 파일별/브라우저별 보관이 달라질 수 있다.
영구 인계에는 리뷰 JSON 내보내기를 사용한다. 외부 서버나 다른 채팅으로 자동 전송하지 않는다.
