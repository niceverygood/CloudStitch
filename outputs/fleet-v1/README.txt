Cloudstitch · 클라우드스티치 — 비행선 에셋 제작판 v1
기준일: 2026-10-18

열어보기
index.html을 브라우저에서 연다. 서버나 CDN 없이 로컬에서 확인하는 제작 검토 갤러리다.
주인공 → 적군 → 라이벌 → 보스 → 민간·서사 → 기존 디자인 대안 순서로 찾고, 구분·세력·검색을 사용한다.
선택한 한 척만 3D 뷰어로 불러오며 다음 선택 때 이전 뷰어를 제거한다. 썸네일은 지연 로딩한다.

현재 생성 결과
GLB71개, 개별 오프라인 뷰어71개, 실제 미리보기PNG71개.
삼각형 8,192~109,860개, 제어 본 4~58개, 각7개 내장 클립.
GLB 합계 512,660,524bytes(약512.66MB).

검증 상태
전체71개 GLB·개별 뷰어·미리보기와 갤러리 독립 QA 통과.
passed=true / fullCorpusPassed=true / coverage.complete=true / failures=0.
glTF 오류·경고0, 브라우저 JS오류·외부 요청·모바일 넘침0.
보존 검사 대상 원본15개 SHA와 선택 귀환호의 지오메트리·텍스처·동작 바이너리 불변.
갤러리는 최대1개 iframe을 유지했고 실제 모델의 표현 모드·7개 내장 클립을 검사했다.
대표 징세정의 공유 뷰어는3모드 각각60프레임 회전 후 새 렌더와 차이0픽셀·JS오류0.
전체 결과는 verification.json, 대표 잔상 회귀는 ghosting-verification.json에서 확인한다.
최종 표시 문구 대표3개 회귀와 실제 로컬 HTTP 갤러리도 통과했다. labels-verification.json을 확인한다.
glTF 정보70건은 공유1536×1024 아틀라스의 NPOT 크기 안내이며 오류·경고가 아니다.
이 결과는 자산·리깅·표현 검수이며 실제 전투·물리·저장·엔진/실기기 성능 통과를 뜻하지 않는다.

71개 항목의 범위
핵심 함선24: 귀환호1·장비 빌드6·일반 적6·표준 징세정1·라이벌6·보스 함선3·미니보스1.
형태·디자인 변형14: 세력 스타일3·귀환호 결말 상태2·기존 A1~C3 대안9.
역할·지원29: 임무 적 역할7·서사/임무선12·민간 역할9·독립 구조정1.
시설3: 조선소·최종 순환 장치·미완성 접합선 골격.
기록1: 기록에만 등장하는 오래된 강하선.
이는 고유 정사 선박71척이 아니다. 핵심24에도 같은 귀환호의 장비 구성이 들어 있다.
후반 보스·역사·결말은 ‘후반 설정’으로 표시하며 로컬 검토에서는 숨기지 않는다.

문서 기준과 제작 제안
catalog.json의 modules 정수는 원문에서 확인한 수, null은 미정이다. 미정을0개로 해석하지 않는다.
artModules와 shapeProposal은 이번 모델의 제작용 배치/형태 제안이며 확정 게임 사양이 아니다.
기존9종의 생성 프롬프트 의도는 designIntentModules로 따로 기록한다.
sourceFiles·scopeKind·definitionLevel·variantOf·reuseCandidate·aliases·exclusions를 함께 읽는다.

원본 보존과 제작 방식
선택 귀환호는 이전 airship-rig-v1 GLB의 지오메트리·텍스처·동작 바이너리를 보존하고 식별용 JSON만 보완했다.
다른 항목은 공유 손그림 아틀라스와 공통 선체·기낭·선장실·장치 키트로 재구성한 새 3D 해석이다.
기존 고밀도 GLB9종, 2D 콘셉트9종, 선택 원형·리깅 원본, 원본122장/감성판122장 보드를 덮어쓰지 않았다.
handpainted-atlas-v2.png가 현재 공유 붓질 아틀라스이며 이전 아틀라스도 보존한다.
손그림·셀 명암·윤곽선은 이 HTML 뷰어의 표시 기능이다. 다른 엔진에서 GLB만 열면 자동 재현되지 않는다.

동작
FloatIdle: 잔잔한 정박
Cruise: 느긋한 순항
BankTurn: 관성 있는 선회
GustRecovery: 돌풍과 자세 회복
TurretScan: 포탑 탐색
WinchCycle: 인양·수리팔·크레인·레일 작업
FireBurst: 포신 반동·종·밸브 등 장치 반응
내장 클립7개와 실제 지원 장치 동작은 구분한다. 자산별 availableActions는4~7개이며 장비가 없는 프로필은 중립/주변 움직임만 가진다.
드래그 회전·휠 확대·오른쪽 드래그 이동, 시간/속도, 재생/정지, 뼈대, 윤곽선과 세 재질 모드를 사용할 수 있다.

파일
index.html: 전체 갤러리
catalog.json: 원문 근거와 실제 생성 파일·수치·제작 제안
ships/<id>.glb: 실제 스키닝/동작 내장 에셋
ships/<id>.html: 모델과 코드를 내장한 개별 오프라인 뷰어
previews/<id>.png: 개별 뷰어의 실제 모델 화면 캡처
fleet-overview.png: 전체 제작 항목 중 대표16개 실제 미리보기 모음
verification.json / ghosting-verification.json / labels-verification.json / manifest.json: 최종 검사·대표 잔상 회귀·자산 기록

재현 명령 — 저장소 루트
npm run build:fleet -- --resume
npm run capture:fleet
npm run overview:fleet
npm run verify:fleet
npm run verify:fleet-ghosting
전체 QA 통과와 현재 README 검증 상태 기록 뒤: npm run finalize:fleet
표시 문구만 수정할 때: npm run build:fleet -- --viewers-only
이 명령은 기존 GLB SHA를 확인하고 개별 뷰어와 갤러리만 다시 만든다. GLB를 재생성하지 않는다.
상세한 준비·부분 검사·파일 역할은 tools/fleet/README.md를 따른다. 로컬 재현 명령은 유료 생성 API를 호출하지 않는다.

남은 한계
현재는 아트용 제자리 동작과 제작 검토 에셋이다. 엔진·플랫폼·실제 미터 치수·기획U 변환·소켓 규격·충돌·LOD·동시 표시 성능 예산은 미정이다.
비행 물리·전투 판정·AI·연결부 절단·소유권·회수/장착·양력·경제·저장·실기기 성능·플레이테스트가 구현/검증된 게임으로 설명하지 않는다.
역할만 정해진 민간/임무선과 기록형의 구체 외형은 제작 제안이다. 공개용 자료에 쓸 때는 후반 설정과 구현 상태를 다시 확인한다.
