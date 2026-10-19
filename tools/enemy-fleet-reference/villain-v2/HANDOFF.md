# 악당 외형 v2 인계

기준일: 2026-10-18. 인계 버전: `enemy-reference-villain-2` / **source-ready, artifacts-pending**.

사용자의 적군 외형 강화 요청에 따라 참고판 6척을 새 wrapper로 확장했다. 새 출력은 `outputs/enemy-fleet-reference-v2/`다. 별도 대표 13항목과 합쳐 보여주는 갤러리는 이 카탈로그를 읽는 전시 계층이며, 현재 전투의 모델·피해·AI·장착·저장 규칙을 자동 교체하지 않는다.

## 준비한 변경

`style.js`와 세 wrapper가 기존 기본 제작 함수를 호출한 뒤 큰 장갑·기능 장치·장식과 세력별 도색을 추가한다. 인양선은 포획 집게·구속 드럼·철제 범퍼, 수리선은 해체용 집게·톱·공방 차양·비대칭 연통으로 구별했다. 다른 네 척도 원래 정찰·봉쇄·망령·위장 형태를 보존한 외형 변형이다.

`docs/ART_DIRECTION.txt`의 따뜻한 수공예·손그림 명암, 과장되고 풍성한 큰 구조, 서로 다른 실루엣과 세력별 색을 적용하는 범위다. 같은 가시의 반복만으로 악역을 표현하지 않는다. 최종 스타일 적합성은 실제 렌더와 사용자의 시각 확인이 남아 있다.

기존 참고판 원화·아틀라스·6모델과 동결 53파일, 함대 v2 동결 174파일, 비교판 동결 95파일을 보존한다. 이 숫자는 기존 인계 스냅샷의 파일 범위다. 이번 신규 ImageGen·Meshy 호출은 각각 0회다.

## 유지할 계약

- 원래 적 ID 6개와 `tools/fleet/catalog.json`의 이름·분류·출처·`modules` 정수/미정 `null`을 유지한다. 새 기하 장식과 `artModules`는 별도 제작 제안이다.
- 표준 7클립을 유지하고 위장선만 `AmbushReveal`을 추가한다. 목표는 실제 총 43클립, 기존 약점 12개, 위장 전개 관절 3개다. `metrics.clips`는 7클립 기본 통계이며 전체 실제 목록은 `observedClips`로 확인한다.
- 약점 노드 이름과 기존 관절을 보존한다. 움직이는 장식은 해당 크레인·드럼·집게·수리팔·전개 뼈대 아래에 붙인다. 표시용 전개를 기습 AI나 충돌 전환으로 설명하지 않는다.
- 좌표는 새 모델 기준 -X 전방/+Y 위의 제작용 상대 LU다. 미터·충돌체·성능 예산으로 확정하지 않는다. 윤곽선과 셀 명암은 뷰어 런타임 기능이며 `OutlineEffect.autoClear = true`를 유지한다.

## 의존성과 외부 읽기

상위 `kit.js`, 기존 기본 제작 함수와 `tools/fleet/rigging.js`, 참고판의 뷰어/약점 표시 코드를 읽어 사용한다. 기존 `outputs/enemy-fleet-reference-v1/reference.png`, `painted-atlas.png`, `previews/<id>.png`는 상대 경로 읽기 의존성이다. 귀환호 크기 비교는 `outputs/fleet-v1/ships/player-homeward.glb`를 사용한다. 공통 의존성·잠금 파일을 수정하거나 새 설치를 수행하지 않았다.

외부 갤러리는 새 `catalog.json`의 `ships`를 읽는다. `id`는 기존 역할 ID이고 고유 변형 키는 `<id>--villain-v2`인 `variantId`다. `baseVariantId`는 `<id>--reference-v1`, `baseModelSha256`은 이전 GLB 해시다. `beforePreviewPath`는 이전 모습이며 새 `previewPath`와 구별한다. 새 PNG는 `previewSourceSha256 === sha256`과 실제 파일 존재를 확인한다. 같은 원래 ID를 가진 항목을 단일 `Map(id)`로 덮어쓰지 않는다.

모델·뷰어·미리보기 경로는 카탈로그 폴더 기준이다. 원화·아틀라스·이전 이미지에는 `../enemy-fleet-reference-v1/`가 쓰인다. 새 폴더만 단독 복사해 원래 의존성을 잃지 않게 한다. 나란한 비교는 이미지로 보여주고 실제 3D는 한 번에 한 뷰어만 연다.

## 확인한 것과 대기 중인 것

| 항목 | 이 문서 작성 시점 |
|---|---|
| 산업 2 wrapper 구문 검사 | 통과 |
| 산업 2 wrapper 메모리 조립 | 통과: NaN·중복 이름·약점 누락 0, 기존 controls·`artModules`·약점 메타데이터 유지 |
| 새 6 GLB 내보내기·실제 바이너리 | pending — 통합 슬롯에서 실행 예정 |
| 새 캡처·실루엣·위장 전개 이미지 | pending |
| `structural-verification.json` | pending — 실제 새 GLB 생성 뒤 검사 |
| `browser-verification.json` | pending — 이 인계에서 브라우저 미실행 |
| 실제 외형·풍성함·가독성 확인 | pending — 통합 담당의 정지 렌더와 사용자 확인 |
| 새 READY manifest·기존 동결 해시 대조 | pending — 통합 담당 최종 기록 |

산업 2종의 메모리 검사는 모델 생성 함수를 메모리에서 조립한 준비 검사다. 텍스처 픽셀·GLB 스킨·애니메이션·카메라·실제 브라우저 통과 기록이 아니다. 다른 4종이나 전체 실행물의 통과로 확대하지 않는다.

## 통합 담당의 다음 순서

저장소 루트에서 기존 런타임을 준비하고 브라우저 슬롯을 조정한 뒤 순차 실행한다.

```sh
node tools/enemy-fleet-reference/villain-v2/build.cjs --resume
node tools/enemy-fleet-reference/villain-v2/verify.mjs
node tools/enemy-fleet-reference/villain-v2/capture.cjs
node tools/enemy-fleet-reference/villain-v2/browser-qa.cjs --quick
```

`build.cjs`와 `capture.cjs`도 브라우저를 사용한다. 동시 실행하지 않는다. 구조 검사는 전체 6척용이며, 브라우저의 `--ids=` 부분 검사와 `--gallery-only`는 그 범위를 보고서에 구분한다. 실행 전에는 `node --check`와 도구의 `--help`만으로 준비 상태를 확인할 수 있다.

구조 검사는 실제 해시·수치·스킨·약점·클립·참조를, 브라우저 검사는 실제 로드·세 모드·조작·모바일·약점 켜기/끄기·전개 복원·갤러리 단일 뷰어를 확인한다. 정밀 잔상·장기 성능·게임 플레이·아트 승인을 이 결과에 포함하지 않는다.

새 모델 해시와 새 캡처가 일치하는지 확인하고 최종 manifest를 봉인한 뒤 외부 갤러리 담당에게 카탈로그·버전 키·파일 해시를 전달한다. 그 시점의 실제 수치와 검사 파일·미완 한계로 이 문서의 pending 상태를 갱신한다. 기존 동결 산출물에는 다시 쓰지 않는다.

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
