# Cloudstitch 비행선 에셋 제작 도구

기획의 함선·역할·시설을 공통 3D 모듈로 재구성하고 리깅과 동작을 내장하는 로컬 제작 파이프라인이다. 결과 갤러리는 `outputs/fleet-v1/index.html`, 원문 근거 카탈로그는 `tools/fleet/catalog.json`이다. 이 도구는 실제 전투·경제·절단·저장 게임을 구현하지 않는다.

## 71개 항목의 의미

71개는 서로 다른 정사 선박 71척이 아니다. 같은 배의 장비 구성, 세력 스타일과 결말 상태, 이름만 정해진 역할, 보스 시설과 기존 디자인 대안을 함께 보관한다.

| 갤러리 구분 | 항목 수 | 범위 |
|---|---:|---|
| 핵심 함선 | 24 | 기본 귀환호1, 플레이어 빌드6, 일반 적6, 표준 징세정1, 라이벌6, 보스 함선3, 데모 미니보스1 |
| 형태·디자인 변형 | 14 | 세력 스타일3, 귀환호 결말 상태2, 기존 A1~C3 디자인 대안9 |
| 역할·지원 | 29 | 임무 적 역할7, 서사·임무 함선12, 민간 역할9, 독립 구조정1 |
| 시설 | 3 | 조선소·최종 순환 장치의 보스 시설2, 미완성 접합선 골격1 |
| 기록 | 1 | 항해일지에만 등장하는 오래된 강하선 |

24개 핵심 항목에도 같은 귀환호의 장비 구성이 포함되므로 이를 고유 선체 24종이라고 확정하지 않는다. 기존 기획의 핵심26개는 위의 핵심 함선24개와 보스 시설2개를 합친 범위다. `scopeKind`, `definitionLevel`, `variantOf`, `reuseCandidate`, `aliases`, `exclusions`로 상태·중복·재사용 가능성을 구분한다. 후반 보스·역사·결말은 로컬 검토 갤러리에 ‘후반 설정’으로 표시한다.

## 원본과 새 제작 해석

- 선택 귀환호는 `outputs/airship-rig-v1/airship-rigged.glb`의 지오메트리·텍스처·동작 바이너리를 보존하고 함대 식별용 JSON 메타데이터를 덧붙인다. 원본 파일을 덮어쓰지 않는다.
- 나머지 항목은 공통 선체·기낭·선장실·기계 장치 키트로 만든 새 3D 해석이다. 초기 고밀도 GLB 9개를 정사 함대 전체로 간주하거나 그대로 복제한 것이 아니다.
- 공유 손그림 아틀라스는 `outputs/fleet-v1/handpainted-atlas-v2.png`다. 이전 아틀라스와 선택 원화·3D 원본, 122장 원본/122장 감성판 보드를 보존한다. 빌드·캡처·QA 명령은 유료 생성 API를 호출하지 않는다.
- 크림 천·꿀빛 목재·청록 기계·황동·산호색 수선 천을 기본으로 하고 세력별 재료와 실루엣을 바꾼다. 셀 명암과 윤곽선은 HTML 뷰어의 런타임 효과이며 GLB를 다른 엔진에 넣는 것만으로 자동 재현되지 않는다.
- 문서에 외형이나 장비 수가 없는 역할형은 제작 제안을 함께 남긴다. 역할명이나 생성 이미지의 숫자를 최종 사양으로 채택하지 않는다.

`modules`는 원문에서 확인한 수만 정수로 기록한다. `null`은 미정이며 0개와 다르다. `artModules`와 `shapeProposal`은 현재 모델의 제작용 배치·형태 제안이다. 기존9종의 프롬프트 의도는 `designIntentModules`로 분리한다. `requiredFeatures`는 기능·형태의 존재 조건, `structuralFeatures`는 봉인탑3개 등 특수 구조의 문서 기준이다.

## 리깅과 일곱 클립

공통 프로필은 `FloatIdle` 정박, `Cruise` 순항, `BankTurn` 선회, `GustRecovery` 돌풍 회복, `TurretScan` 포탑 탐색, `WinchCycle` 인양·지원 작업, `FireBurst` 포격·장치 반응이다. 기계 부품은 단일 가중치의 강체 스키닝으로 움직이며 회전축·피벗·장치별 제어 본을 사용한다.

모든 프로필을 가진 것과 모든 장치를 가진 것은 다르다. 장비가 없는 동작은 중립 채널/주변 움직임만 남고, 실제 지원 동작은 자산별 `availableActions`로 구분한다. 크레인·수리팔·레일은 인양/지원 프로필, 종·밸브·포신은 장치 반응 프로필을 사용한다. 시설·기록형도 아트 미리보기용 동작이며 실제로 항해하거나 공격하는 게임 로직의 증거가 아니다.

## 재현

저장소 루트에서 Node.js20 이상과 npm을 사용한다. 원본 및 공유 아틀라스가 LFS 포인터 상태라면 먼저 실제 파일을 내려받는다.

```sh
git lfs pull
npm ci
npm run setup:browser
npm run build:fleet -- --resume
npm run capture:fleet
npm run overview:fleet
npm run verify:fleet
npm run verify:fleet-ghosting
# 전체 QA 통과와 문서 마감 뒤에만 실행
npm run finalize:fleet
```

`build.cjs`는 `outputs/fleet-v1/ships/<id>.glb`, 개별 오프라인 뷰어, 결과 `catalog.json`과 `index.html`을 만든다. `--resume`은 현재 소스·아틀라스·입력 명세의 해시와 기존 GLB 해시가 일치할 때만 해당 모델을 재사용한다. 원문 카탈로그의 `planned`와 결과 카탈로그의 `asset-built`를 구분한다. `capture.cjs`는 개별 뷰어의 실제 모델 화면을 `previews/<id>.png`로 캡처한다.

```sh
node tools/fleet/build.cjs --ids=player-homeward,enemy-tax-cutter --resume
node tools/fleet/capture.cjs --ids=player-homeward,enemy-tax-cutter
node tools/qa/fleet.cjs outputs/fleet-v1 work/verification/fleet-subset tools/fleet/catalog.json --ids=player-homeward,enemy-tax-cutter
node tools/qa/fleet.cjs outputs/fleet-v1 work/verification/fleet-structure tools/fleet/catalog.json --structure-only
```

`overview:fleet`는 전체 목록의 대표16항목을 실제 PNG로 모아 `outputs/fleet-v1/fleet-overview.png`를 만든다. `verify:fleet-ghosting`은 공유 뷰어의 대표 징세정에서 세 재질 모드의60프레임 회전 후 새 렌더와 비교한다. 이 대표 잔상 회귀 검사와 전체71개 브라우저 검사는 범위가 다르다.

`finalize:fleet`는 전체 QA의 `passed`/`fullCorpusPassed`, 모든 자산 해시와 미리보기 원본 해시가 맞을 때만 결과 카탈로그를 통과 상태로 마감한다. `verification.json`과 존재하는 통과 잔상 기록을 복사하고 최신 갤러리와 `manifest.json`을 다시 만든다. 실패나 부분 검사로 강제 마감하지 않는다. `README.txt`도 manifest 해시에 들어가므로 검증 상태 문구를 실제 결과로 갱신한 뒤 최종 마감을 실행한다.

표시 문구나 뷰어 UI만 수정할 때는 다음 명령을 사용한다. 기존 GLB가 결과 카탈로그의 SHA와 같은지 확인하고 개별 뷰어와 갤러리만 다시 번들한다. 모델 지오메트리·텍스처·동작 바이너리는 재생성하지 않는다. UI 변경에 맞는 브라우저 회귀 검사를 별도로 실행하고 필요하면 전체 검사·마감을 갱신한다.

```sh
npm run build:fleet -- --viewers-only
```

부분 ID/구조 검사는 전체71개 검수 통과와 다르다. 전체 검사는 ID·파일·모듈 수·필수 형태·본/스킨/애니메이션·glTF 진단·원본 보존을 검사하고, 실제 브라우저 로딩·클립·표현 모드·갤러리·모바일·외부 요청을 확인한다. 검사 기록은 기본 `work/verification/fleet/qa-result.json`에 남는다. 최종 제작·검사 증거는 결과 폴더의 기록과 함께 확인한다.

## 파일 역할

| 소스 | 역할 |
|---|---|
| `catalog.json` | 원문 근거·범위·확정 수·미정 값 |
| `body.js`, `devices.js` | 공통 선체·기낭·선장실·장치 키트 |
| `assemble.js` | 항목별 형태와 `artModules` 제작 제안 |
| `rigging.js` | 강체 스키닝·본 제어·완전 자세 클립 |
| `selected.cjs` | 선택 귀환호의 기존 바이너리 보존 |
| `export.js`, `build.cjs` | GLB 내보내기와 오프라인 번들 |
| `viewer.js`, `viewer-template.html` | 개별 GLB 재생·표현·동작 제어 |
| `gallery-template.html` | 목록·검색·문서 기준/제작 배치 비교·단일 뷰어 |
| `capture.cjs`, `tools/qa/fleet.cjs` | 실제 화면 캡처와 독립 검사 |
| `overview.cjs` | 대표16항목의 실제 미리보기 모음 |
| `tools/qa/fleet-ghosting.cjs` | 공유 뷰어의 대표 잔상 회귀 검사 |
| `finalize.cjs` | 전체 QA 통과 확인·결과 기록 복사·갤러리/manifest 마감 |

갤러리는 썸네일을 지연 로딩하고 선택한 한 척의 iframe만 유지한다. 항목 선택마다 이전 iframe을 제거하고 새 뷰어로 바꾸며 71개 GLB를 한 페이지에 모두 내장하거나 동시에 로딩하지 않는다. 개발 확인 API는 `window.__fleetViewer.selectShip(id)`, `currentId`, `loadedViewers`, `catalog`다.

## 현재 집계와 한계

<!-- FLEET_METRICS_START -->
실제 생성 결과는 GLB71개와 개별 오프라인 뷰어71개, 실제 미리보기PNG71개다. 모델별 삼각형은 8,192~109,860개, 제어 본은4~58개이며 모두7개 내장 클립을 갖는다. GLB 합계는512,660,524bytes(약512.66MB)다. 지원 장치 동작은 항목별4~7개로 구분한다.

전체71개와 갤러리의 독립 QA가 통과했다(`passed=true`, `fullCorpusPassed=true`, 실패0). 모든 GLB의 glTF 오류·경고0, 브라우저 JS오류·외부 요청·모바일 넘침0을 확인했다. 보존 검사 대상 원본15개 SHA와 선택 귀환호의 지오메트리·텍스처·동작 바이너리도 그대로였다. 갤러리는 최대1개 iframe을 유지했다. [전체 검사 기록](../../outputs/fleet-v1/verification.json)을 확인한다.

공유 뷰어의 대표 징세정은 세 재질 모드에서 각각60프레임 회전 후 같은 카메라의 새 렌더와 차이0픽셀, JS오류0을 확인했다. 이 대표 잔상 회귀 검사와 전체71개 자산·브라우저 QA는 별도 범위다. [대표 잔상 검사 기록](../../outputs/fleet-v1/ghosting-verification.json)을 확인한다.


최종 UI 문구의 대표3개 회귀 검사와 실제 로컬 HTTP 갤러리 확인도 통과했다. [표시 문구 검사 기록](../../outputs/fleet-v1/labels-verification.json)을 확인한다. glTF 정보70건은 공유1536×1024 아틀라스의 NPOT 크기 안내이며 오류·경고가 아니다. 최종 표시 번들은 GLB를 바꾸지 않고 다시 생성했다.
<!-- FLEET_METRICS_END -->

엔진·플랫폼·실제 미터 치수·U 변환·소켓 규격·충돌·LOD·동시 표시 성능 예산은 미정이다. 선택 귀환호와 공통 키트의 화면상 축척을 맞추는 제안이 있어도 물리 치수 확정으로 해석하지 않는다. 현재 동작은 아트용 제자리 루프이며 절단·회수 소유권·장착·사격 판정·AI·양력·경제·저장·실기기 성능은 후속 구현과 검증 대상이다.
