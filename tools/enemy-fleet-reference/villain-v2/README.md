# Cloudstitch · 악당 외형 v2

사용자의 “적군을 훨씬 더 악당처럼 보이게” 요청에 따라 기존 참고 그림 기반 적 함선 6개의 외형을 강화하는 별도 제작판이다. 결과 폴더는 `outputs/enemy-fleet-reference-v2/`다. 원래 ID와 장비 기획을 유지하고, 새 변형은 `variantId`로 구분한다.

현재 인계 상태는 **소스 준비 완료 / 실제 GLB·캡처·구조·브라우저 검증 pending**이다. 실행 결과와 최종 파일 해시는 통합 담당이 예약된 검증 뒤 기록한다. 이 문서의 명령이나 검사 도구가 존재하는 것만으로 실행 통과를 뜻하지 않는다.

## 외형과 보존 범위

[상시 아트 디렉션](../../../docs/ART_DIRECTION.txt)을 적용한다. 손으로 만든 목재·직물·도색 금속의 붓결, 겹겹의 부피와 과장된 기능 장치, 세력마다 다른 색을 살린다. 큰 형태와 쉬는 면을 유지하며 역할에 맞는 풍성함을 더한다.

| 원래 함선 ID | 악당 외형의 중심 |
|---|---|
| `enemy-pirate-scout` | 날카로운 해적 정찰선의 선수·엔진·깃발과 공격적인 장갑 |
| `enemy-cult-blockade` | 무거운 의례 장갑·봉인통·종을 가진 교단 봉쇄선 |
| `enemy-union-salvage` | 톱니 포획 집게·노출 감속 기어·구속 사슬을 가진 산업 인양선 |
| `enemy-union-repair` | 좁은 주황 공방 창·집게와 톱 수리팔·비대칭 연통을 가진 해체 공방 |
| `enemy-ghost-chaser` | 찢어진 천·큰 저주형 외곽 구조·차가운 잔광을 가진 추격선 |
| `enemy-disguised-wreck` | 위장 잔해와 전개 외피의 위협적인 골조·장갑 |

같은 가시를 반복해서 붙이는 방식 대신 각 배의 기능을 크게 읽히게 한다. 인양선의 청록 기낭과 대형 드럼, 수리선의 긴 공방·관절팔·기존 신호 깃발, 위장선의 세 전개 관절 같은 원래 정체성을 유지한다. 특정 작품의 고유 캐릭터·로고·장면을 복제하지 않는다.

- 기존 참고판 `outputs/enemy-fleet-reference-v1/`의 6개 모델과 당시 동결 53파일, `outputs/fleet-v2/`의 동결 174파일, `outputs/fleet-comparison-v1/`의 동결 95파일은 보존한다. 파일 수는 해당 인계 스냅샷의 범위이며 고유 함종 수가 아니다.
- 기획 근거 `tools/fleet/catalog.json`의 `modules` 정수와 미정 `null`을 유지한다. 새 장식·톱·집게·연통은 아트 해석이며 무장 수, 슬롯, 피해량, 수리량이나 장비 규칙에 자동 반영하지 않는다.
- 표준 7클립과 위장선의 추가 `AmbushReveal`을 유지한다. 6척의 실제 클립 합계 목표는 43개다. `metrics.clips`는 기본 7클립 통계이며 추가 전개는 `observedClips`와 실제 GLB에서 확인한다.
- 기존 약점 12개와 위장 전개 관절 3개를 보존한다. 약점 표시는 외형 위치 안내이며 실제 피해·절단·수리·기습 AI 연결은 이 작업에서 구현하지 않는다.

## 소스와 읽기 의존성

새 `scout-cult.js`, `industrial.js`, `ghost-wreck.js`는 상위 폴더의 기존 제작 함수를 호출한 뒤 새 장갑·기능 장치·장식을 더하는 wrapper다. `style.js`가 세력별 도색과 판금·사슬·눈 틈 등의 공통 표현을 제공한다. 원본 소스와 원래 GLB를 덮어쓰지 않는다.

기존 `kit.js`, `tools/fleet/rigging.js`, 참고판의 뷰어·약점 표시 코드를 읽어 재사용한다. 추가 기하의 움직이는 장식은 관련 관절 아래에 붙이며 약점 뼈대의 이름을 유지한다. 실제 GLB의 재질·텍스처와 HTML 뷰어의 셀 명암·윤곽선은 구분한다. `OutlineEffect.autoClear = true`를 유지해야 한다.

새 유료 생성은 **ImageGen 0회 / Meshy 0회**다. 기준 원화와 손그림 아틀라스는 아래의 기존 파일을 읽는다.

- `outputs/enemy-fleet-reference-v1/reference.png`
- `outputs/enemy-fleet-reference-v1/painted-atlas.png`
- 이전 모습: `outputs/enemy-fleet-reference-v1/previews/<id>.png`
- 귀환호 크기 비교: `outputs/fleet-v1/ships/player-homeward.glb`

새 출력 폴더만 따로 옮기면 원화·이전 미리보기의 상대 경로가 끊긴다. 다른 PC에서는 저장소와 필요한 LFS 자산을 함께 준비한다. 공통 `package.json`, 잠금 파일과 의존성을 이 작업에서 바꾸지 않는다.

## 재현 명령

저장소 루트에서 기존 Node.js 20 이상·의존성·브라우저 런타임을 사용한다. 빌드와 캡처도 브라우저를 사용하므로 통합 담당이 예약한 슬롯에서 아래 순서로 실행한다. 새 패키지 설치나 공통 스크립트 수정은 필요하지 않다.

```sh
node tools/enemy-fleet-reference/villain-v2/build.cjs --resume
node tools/enemy-fleet-reference/villain-v2/verify.mjs
node tools/enemy-fleet-reference/villain-v2/capture.cjs
node tools/enemy-fleet-reference/villain-v2/browser-qa.cjs --quick
```

부분 제작에는 `build.cjs --ids=<id>,<id>`와 `capture.cjs --ids=<id>,<id>`를 쓸 수 있다. 구조 검사는 새 6척 전체를 대상으로 한다. 브라우저 QA의 `--ids=`는 개별 뷰어 검사만 줄이고, 갤러리 검사는 여전히 6카드·6모달을 연다. `--gallery-only`는 개별 뷰어 검사를 생략한다. 부분 실행을 6척 전체 검증으로 표시하지 않는다.

뷰어만 다시 묶으려면 `viewers.cjs`, 현재 카탈로그로 갤러리만 갱신하려면 `gallery.cjs`를 사용한다. 모델이 바뀐 뒤에는 실제 새 GLB 캡처로 `previewSourceSha256`을 갱신해야 한다.

| 결과 | 위치 |
|---|---|
| 모델·개별 오프라인 뷰어 | `outputs/enemy-fleet-reference-v2/ships/<id>.glb`, `<id>.html` |
| 제작 목록·이전/새 모습 갤러리 | 같은 폴더의 `catalog.json`, `index.html` |
| 실제 캡처·실루엣·전개 모습 | `previews/`, `capture-receipt.json` |
| 구조 검사 | `structural-verification.json` |
| 브라우저 QA | `browser-verification.json` |
| 중간 파일·QA 스크린샷 | `work/enemy-fleet-reference-v2/`, `work/enemy-fleet-reference-v2-browser-qa/` |

구조 검사는 실제 GLB의 리소스·수치·리그·약점·클립·해시를 확인한다. 브라우저 QA는 실제 로드·세 표시 모드·조작·약점 토글·전개/복원·모바일·외부 요청·갤러리를 확인한다. 정밀 회전 잔상, 장기 성능과 사람의 아트 승인은 별도 범위다.

## 외부 갤러리 계약

외부 적·보스 갤러리는 별도 대표 13항목과 이 새 6변형을 읽어 함께 보여줄 수 있다. 이 조합을 새 고유 정사 함종 19종으로 세지 않는다. 원래 ID가 겹치므로 목록의 고유 키는 `variantId`와 출처를 사용한다.

| 필드 | 의미 |
|---|---|
| `id` | 원래 적 역할 ID. 기획·약점 연결용이며 버전 간 같음 |
| `variantId` | `<id>--villain-v2`. 새 외형의 고유 키 |
| `baseVariantId` | `<id>--reference-v1`. 비교할 이전 외형 |
| `baseModelSha256` | 이전 참고판 모델의 SHA-256. 현재 새 모델 해시가 아님 |
| `sha256`, `bytes` | 새 GLB의 실제 해시와 크기 |
| `assetPath`, `viewerPath`, `previewPath` | 현재 카탈로그 폴더 기준의 새 파일 상대 경로 |
| `beforePreviewPath` | 같은 기준의 `../enemy-fleet-reference-v1/previews/<id>.png` |
| `previewSourceSha256` | 미리보기에 사용한 새 GLB 해시. `sha256`과 같아야 최신 이미지 |
| `villainTheme`, `features`, `referenceNotes` | 외형 의도와 제작 해석 |
| `weakpoints`, `deployRig`, `availableActions`, `observedClips` | 실제 리그·장치 및 전개 표시 계약 |
| `modules`, `artModules` | 원문 사양과 별도 아트 배치를 구분하는 필드 |

외부 갤러리는 `status === 'asset-built'`와 파일 존재를 확인한 뒤 뷰어를 연다. 새 미리보기는 `previewSourceSha256 === sha256`이고 PNG가 존재할 때만 표시한다. 준비되지 않은 이미지는 준비 중으로 표시한다. 이전 미리보기를 새 외형의 이미지로 대체하지 않는다. 두 모델을 나란히 비교할 때는 이미지를 사용하고 실제 3D는 선택한 한 척만 로드한다.

이번 새 모델 revision의 예약 QA는 `--quick` 범위로 실행한다. 새6 로딩/3모드/약점ON-OFF/모바일, 위장선 대표 공통조작과 전개 원복, 망령 대표 3모드×120실제RAF 회전 캡처, 갤러리6 이전/현재 선택과 대표 모달1을 확인한다. 보존한43클립은 실제 GLB 구조로 검사하며 기존273 UI 전수를 자동 반복하지 않는다. 정밀픽셀 잔상·장기·사람의 아트 승인은 별도다.


최종 아트 인계 상태 (2026-10-18)
- 새6GLB/개별뷰어6/이전·현재갤러리 생성 완료. 같은6원ID의새variant이며원문/편성/sim변경0.
- 실제구조검사6/6 PASS: 고유기하6,330,732삼각형,60,243,536바이트,유한FLOAT6,816,228값,실제43클립/약점12/전개3본/외부URI0.
- 실제GLB정지PNG6·실루엣6·위장전개1·종합판2캡처완료. 6 previewSourceSha256=sha256.
- 직접렌더검토에서붉은맹금충각/거대종·왕관장갑/포획집게·해체톱/갈비골조·누더기날개/덫아가리구분확인. 원화급최종미술승인은별도.
- exporter/capture각exit0,finallyclose,실행전후소스14 SHA변화0영수증보존.
- 새변형에한정한브라우저 --quick QA는통합예약대기. 기존273전수는재실행하지않음.
- source-manifest.json은freeze.cjs로봉인. 기존세manifest와실제로읽는의존성만재해시하며과거174/95전체corpus재검사를주장하지않음.
- 실제피해/절단/회수/충돌/socket/기습AI·장기성능과정밀decoded잔상은미연결/미검증.
