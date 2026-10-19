Cloudstitch · 적조 사냥함대 3D 에셋
2026-10-19 / Asia/Seoul

직접 요청: 앞서 만든 무드보드의 일반8종+중간보스1종을 실제3D로 제작하고 디테일을 최대한 살린다.
소유: tools/chapter2-fleet-assets/ → outputs/chapter2-fleet-assets-v1/.
기획·원화·기존1탄·기지·주인공·공통 패키지와 게임 로직은 읽기 참조만 한다.

보기
index.html: 실제 GLB 렌더 갤러리. 생성·캡처가 완료된 뒤 사용한다.
ships/<kind>.html: 각 모델/원화/런타임을 내장한 오프라인3D 검토. 회전·확대·화면 맞춤·표시 모드·구조별 표시·GLB 다운로드.
ships/<kind>.glb: 독립3D 모델. 실제 기하·정점색·UV·붓결 텍스처와 전시용 장치 클립.
previews/: 실제 GLB 캡처. 무드보드 PNG를 렌더 결과로 대체 표기하지 않는다.
textures/handpainted-atlas.png: 이번 소스의 결정적 붓결·직조·목결·패각·산호 표면 아틀라스.
catalog.json: 모델별 수치/해시/원화·역할·형태 기록.
gltf-validation.json: 실제 GLB 구조와 공식 규격 검사 결과.
verification.json: 실제 로딩·표시·조작·캡처·오프라인·대표 잔상 검사 결과.
SOURCE_READY.json: export 전 CPU 소스/원화 핀과 기하 census. 실제 GLB 검증 결과가 아니다.

무드보드 디테일의 해석
패각 판은 실제 휘어진 두께·구멍·테두리·성장선·빛깔 층을 만든다.
산호 포신은 내부가 빈 곡선 포구·입술·가지·포미/반동 받침이 실제 입체다.
윈치는 감긴 나선 줄·드럼·스포크·지지대, 천은 휜 면·가장자리 줄·봉제·기치, 기낭은 고어선·띠·버클로 분리한다.
목조 갑판·난간·캐빈 창·사다리·작업등·작업팔·부모 지지대 등 중간 기능층을 둔다.
최신10배 표현은 큰 실루엣·빈 공간·겹구조·재료의 대비로 적용한다. 기술 검사와 사람 미술 승인은 별도다.

종류
needle 붉은바늘 정찰정 / capture 집게갈고리 포획선 / shield 거울패각 방패함 / trumpet 적산호 나팔함.
conch 소라 곡사함 / lantern 해파리 등불함 / chain 톱지느러미 사슬정 / weaver 진주 실잣기 수복선.
gatekeeper 적조의 문지기.

범위와 한계
가려진 뒤/아래·접합 구조는 한 장의 원화에서 입체로 해석했다. 원화의 모든 선·부속을 픽셀 단위로 복제한 결과는 아니다.
무드보드 속 장식/포대/승무원 수는 실제 게임의 슬롯/무장 수·수치가 아니다.
좌표는 +Y 위/-X 선수의 임시 미술 단위. 미터·소켓 규격·게임 충돌 크기로 사용하지 않는다.
실제 AI·사격·피해·절단·회수·물리·장착·저장·캠페인·LOD·최종 성능 예산은 이번 작업에서 확정하지 않는다.
전시용 프로펠러·윈치 클립은 게임 전투·무기 작동의 구현을 뜻하지 않는다.
손그림/셀/윤곽선은 뷰어 런타임 효과다. 다른 엔진에 GLB를 넣는 것만으로 자동 재현되지 않는다.
새 Meshy·이미지 생성·유료 호출 없이 로컬 원본 기하와 결정적 재료 텍스처로 제작한다.

재현
기존 three/esbuild/playwright/gltf-validator 설치를 NODE_PATH로 제공한다. 현재 PC의 캐시 경로를 소스에 고정하지 않는다.
node tools/chapter2-fleet-assets/build.cjs --prepare : CPU 원형 census와 번들 준비. export/browser 없음.
중앙 명시 START 후 순서대로:
node tools/chapter2-fleet-assets/build.cjs --execute
node tools/chapter2-fleet-assets/verify.cjs
node tools/chapter2-fleet-assets/qa.cjs
개별 재생성: --execute --ids=<kind>. 뷰어만 재빌드: --review-only.
프로세스/브라우저 finally 종료와 source/readOnly 핀 사후 대조 후 heavy 슬롯을 반환한다.
실제검증 현황은 최종 HANDOFF/READY와 보고서의 실제 passed/미실행 범위로 판단한다.
