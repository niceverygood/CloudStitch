# Cloudstitch 재현 도구

기존 아트 뷰어는 `outputs/`의 HTML을 바로 열어 볼 수 있습니다. 첫 전장 `battlefield-v1`과 별도6개 판 교전 `encounters-v1`은 저장소 루트의 로컬 HTTP 서버에서 기존 함대 GLB를 읽습니다. 아래 도구는 다른 컴퓨터에서 결과물을 다시 만들고 검사할 때 사용합니다. 무기·VFX·월드 작업대도 보존하며, 이 재현·검사 명령은 유료 이미지 생성이나 Meshy API 호출을 하지 않습니다.

## 준비

Node.js 20 이상과 npm을 설치하고, 저장소를 Git LFS까지 내려받습니다.

```sh
git lfs install
git lfs pull
npm ci
npm run setup:browser
```

Playwright에 설치된 Chromium을 먼저 사용합니다. 없다면 `CHROME_EXECUTABLE_PATH` 환경변수의 실행 파일이나 운영체제의 일반적인 Chrome/Edge 설치 경로를 사용합니다. Linux에서 브라우저 시스템 라이브러리가 없으면 `npx playwright install --with-deps chromium`을 실행합니다. 도구 경로와 입출력 상대 경로는 실행한 디렉터리가 아닌 저장소 루트를 기준으로 해석합니다.

Python 도구 `verify-assets.py`는 Python 3 표준 라이브러리만 사용하며 추가 패키지가 필요하지 않습니다. `python3 tools/verify-assets.py`로 현재 [미디어 목록](../docs/asset-inventory.json)에 기록된 파일의 크기와 SHA-256을 확인합니다. 전체 파일 수와 형식별 집계는 이 inventory를 기준으로 하며 독립 게임 자산 수와 구분합니다. 뷰어 빌드·브라우저 검사는 Python 없이 동작합니다. 원본 작업 폴더의 일회용 패키징 스크립트는 이관하지 않았습니다. 첫 전장 이관은 [전용 프롬프트](../docs/BATTLEFIELD_DESKTOP_CONTINUE-2026-10-18.txt)와 [전용 인수인계](../docs/BATTLEFIELD_DESKTOP_HANDOFF-2026-10-18.md), 별도 교전 이관은 [데스크톱 프롬프트](../docs/DESKTOP_CONTINUE_PROMPT-2026-10-18.txt)를 따릅니다.

## 비행선 뷰어

```sh
npm run build:viewer
npm run verify:viewer
npm run verify:ghosting
```

- 소스: `tools/toon-viewer/viewer.js`, `viewer-template.html`
- 기본 모델: `outputs/selected-airship-toon3d/airship.glb`
- 출력: 같은 폴더의 `viewer.html`, `viewer-v2.html` 두 파일에 같은 내용을 기록합니다.
- HTML에 모델과 Three.js 코드를 내장해 서버·CDN 없이 `file://`에서도 동작합니다.
- `OutlineEffect.autoClear = true`는 회전 잔상을 방지하는 수정입니다. 유지해야 합니다.
- `verify:viewer`는 세 재질 모드, 회전, 확대, 다운로드, 버튼, 모바일 넘침, 외부 요청 유무를 검사합니다.
- `verify:ghosting`은 모드별 120프레임 회전 후의 픽셀과 같은 각도를 지우고 다시 그린 픽셀을 비교합니다.

원본 결과물을 덮어쓰지 않고 시험하려면 입출력을 지정합니다.

```sh
node tools/toon-viewer/build.cjs outputs/selected-airship-toon3d/airship.glb work/verification/build/viewer.html
node tools/qa/viewer.cjs work/verification/build/viewer-v2.html work/verification/portable-viewer
node tools/qa/ghosting.cjs work/verification/build/viewer-v2.html work/verification/portable-ghosting
```

## 시작화면

```sh
npm run verify:title
npm run capture:title
```

검사는 메뉴·키보드·설정·대화상자·모션 감소·모바일 레이아웃을 확인합니다. 캡처는 실제 HTML의 1920×1080 화면을 기본 경로 `outputs/cloudstitch-title-screen/start-screen.png`에 다시 기록합니다. UI 텍스트는 HTML로 유지하고 생성된 로고·배경 PNG는 편집하지 않습니다.

```sh
node tools/title-screen/capture.cjs outputs/cloudstitch-title-screen/index.html work/verification/title-screen/start-screen.png
node tools/qa/title-screen.cjs outputs/cloudstitch-title-screen/index.html work/verification/portable-title
```

기본 검사 기록과 스크린샷은 `work/verification/viewer`, `ghosting`, `title-screen`에 저장되며 Git에 올리지 않습니다. 위 뷰어/시작화면 검사는 UI 시제품 검사이며 별도 교전 기능·캠페인 저장 검증을 뜻하지 않습니다.

## 전체 기획 함대 제작판

소스와 범위는 [fleet/README.md](fleet/README.md), 원문 근거 카탈로그는 `tools/fleet/catalog.json`, 사용자 확인용 갤러리는 `outputs/fleet-v1/index.html`이다. 71개 항목은 핵심 함선24·형태/디자인 변형14·역할/지원29·시설3·기록1이며 고유 정사 선박71척이 아니다. 기존9종 디자인 대안과 선택선 리깅 원형을 보존한다.

```sh
npm run build:fleet -- --resume
npm run capture:fleet
npm run overview:fleet
npm run verify:fleet
npm run verify:fleet-ghosting
# 전체 QA 통과와 문서 마감 뒤
npm run finalize:fleet
```

빌드는 개별 GLB/오프라인 뷰어와 결과 카탈로그, 캡처는 실제 모델 화면, overview는 대표16개 모음, QA는 구조·원문 수·glTF·리깅·동작·브라우저·단일 갤러리 뷰어를 확인한다. 별도 잔상 회귀 검사 후 finalize는 전체 QA 통과와 해시 일치를 확인해 기록·갤러리·manifest를 마감한다. 부분 ID 및 `--structure-only` 검사는 전체 통과와 구분하며 자세한 명령은 전용 README를 따른다. 확정 수는 `modules`, 표현용 배치는 `artModules`로 분리하고7클립 중 실제 지원 장치 동작은 각 `availableActions`를 확인한다. 엔진·치수·충돌·LOD·실제 전투·저장·성능 검증은 후속이다.

전체71개·갤러리의 [독립 검사](../outputs/fleet-v1/verification.json)가 통과했고 glTF 오류·경고0이다. 표시 UI만 수정할 때는 `npm run build:fleet -- --viewers-only`로 기존 GLB SHA를 확인한 뒤 뷰어·갤러리만 다시 번들하고 관련 회귀 검사를 실행한다.

## 첫 전장 플레이 시제품

소스·조작·출처·한계는 [battlefield/README.md](battlefield/README.md)를 따릅니다. 기존 함대 GLB4개를 공유하는 별도 브라우저 플레이 시제품이며 최종 게임 엔진이나 전체 캠페인이 아닙니다. 이동·기관총·포격 예고·부품별 피격·징세정 연결부 절단·하위 묶음 분리·회수/소유권·화물·과적/투하·남쪽 부두 귀환을 시험합니다.

```sh
node tools/battlefield/build.cjs
node --test tools/battlefield/sim.test.mjs
python3 -m http.server 8080 --bind 127.0.0.1
# http://127.0.0.1:8080/outputs/battlefield-v1/
```

서버는 저장소 루트에서 실행합니다. `file://` 직접 열기는 지원하지 않습니다. 서버가 실행된 상태에서 macOS/Linux 셸은 `BATTLEFIELD_URL=http://127.0.0.1:8080/outputs/battlefield-v1/index.html node tools/battlefield/verify.cjs`로 브라우저 검사를 실행합니다. Windows 등에서는 현재 셸의 환경변수 설정 문법을 따릅니다. 출력은 `outputs/battlefield-v1/`, 재검사 로그와 화면은 `work/verification/battlefield/`에 기록합니다. [저장된 검사 기록](../outputs/battlefield-v1/verification.json)은 실제 입력과 시험용 상태 배치를 구분합니다.

인양은 화물 적재이며 장착이 아닙니다. 장착 편집·전체 항구경제/정산·영속저장·캠페인·패드·완성 무기별 효과는 미구현이고 새로고침하면 초기화됩니다. 가속 막대는 회복형 가속 충전량이며 경제 자원 연료F가 아닙니다. 임시 평면 원형 충돌·쌍장치 묶음 판정과 자동 검사를 실제 기기 성능·최종 밸런스·재미 검증으로 해석하지 않습니다. `OutlineEffect.autoClear = true`를 유지합니다.

## 6개 판 교전 시제품

사용법·판별 보스·정사 경계는 [encounters/README.md](encounters/README.md)를 따른다. 기존 함대 GLB를 공유하는 별도 브라우저 전투이며 최종 게임 엔진 프로젝트나 전체 캠페인이 아니다. 일반 적36회와 중간보스6회·최종보스6회를 편성하고 각 판은 전반→중간보스→수동 정비→후반→최종보스→승리로 이어진다.

```sh
npm run build:encounters
npm run verify:encounters
python3 -m http.server 8840 --bind 127.0.0.1
# http://127.0.0.1:8840/outputs/encounters-v1/
```

서버는 저장소 루트에서 실행한다. `file://` 또는 출력 폴더만 서비스하는 서버는 상대 GLB 로딩 방식과 맞지 않는다. 소스는 `tools/encounters/catalog.json`, `core.js`, `scene.js`, `app.js`, `template.html`, `build.cjs`, 검사는 `tools/qa/encounters.cjs`다. 결과는 `outputs/encounters-v1/`, 검사 JSON과 화면은 `work/verification/encounters/`에 기록한다. `--core-only`는 코어 부분 검사이며 전체 브라우저 통과와 구분한다.

키보드/마우스/터치 조작·긴급기동·자동 조준·일시정지·피격·패배·재도전을 시험한다. 중간 무료 완전 수리는 시제품 구제 장치이며 정사 경제가 아니다. 판별 승리 표시만 localStorage에 저장하고 모듈 절단/회수/소유권/화물/장착·양력·경제·캠페인 저장·P1~P4 순환은 이 교전 시제품의 후속이다. 보스는 모두 정사 외형 참고 교전 역할 변형이며 원문 전체 기믹 구현 완료가 아니다. [최종 검사 기록](../outputs/encounters-v1/verification.json)과 manifest에서 코어·공격 규칙·6판 무기 경로·GLB 렌더·브라우저/터치 입력 검사의 통과를 확인한다. 첫 전장의 부품 순환과는 별도 구현이다.

## 무기 작업대

`tools/weapon-workbench/README.md`에 입력 카탈로그·캡처·검사 방법이 있다. `npm run build:weapons`는 실제 GLB를 내장한 오프라인 작업대와 갤러리를 만들고, `npm run verify:weapons`는 무기별 세 표시 모드·잔상·장착 배치·다운로드·컨트롤을 검사한다. 무기 ID로 새 자산만 검사할 수 있다.

```sh
node tools/qa/weapon-workbench.cjs outputs/weapon-modules/index.html work/verification/weapon-01 01-machine-gun
node tools/weapon-workbench/capture.cjs 01-machine-gun
node tools/weapon-workbench/gallery.cjs
node tools/weapon-workbench/overview.cjs
python3 tools/weapon-workbench/package.py
```

`overview.cjs`와 `package.py`는 여섯 종 모두 실제 완료한 뒤 사용한다. 전체 보기는 실제 브라우저 화면을 캡처하고, 패키저는 허용한 파일만 ZIP에 넣은 뒤 원본과 해시를 비교한다. API 인증·유료 생성·기계 부품 분리·게임 전투는 이 도구의 기능이 아니다.

## 전투 효과

`tools/combat-vfx/README.md`에 실제 메시·변환 애니메이션 제작과 작업대 사용법이 있다. `npm run generate:vfx`는 로컬 Three.js 도형과 기존 무기를 조합하며 신규 Meshy·이미지 생성 요청을 하지 않는다. 기존 무기 원본은 보존한다. `npm run build:vfx`, `npm run verify:vfx`, `npm run verify:vfx-sequences`는 두 오프라인 작업대와 검사를 재현한다. PNG 캡처·알파 경계 읽기·갤러리·패키징은 해당 폴더의 도구를 사용한다.

GLB 공식 검사를 다시 실행하려면 별도 로컬 의존성을 준비한다. 이 의존성은 `work/`에 있으며 저장소 원본에 포함되지 않는다.

```sh
npm install --prefix work/vfx-validation --no-save --package-lock=false gltf-validator@2.0.0-dev.3.10
node tools/qa/gltf-vfx.cjs work/vfx-validation/node_modules/gltf-validator
```

공식 검사와 브라우저 검사는 실제 엔진의 피해·충돌·파티클·소켓·성능을 검증하지 않는다. `node tools/qa/combat-vfx-package.cjs`는 전달 ZIP을 새 폴더에 풀어 외부 원본 파일 없이 열리는지 검사한다.

## 자산 생성·패키징 기록

현재 선택선의 별도 리깅 파이프라인은 [airship-rig/README.md](airship-rig/README.md)에 있다. `npm run build:rig`, `npm run verify:rig`, `npm run verify:gltf`를 사용하며, 최종 미리보기 캡처는 `node tools/airship-rig/capture.cjs --video`로 만든다. 기존 뷰어 빌드와 원본 자산은 바꾸지 않는다.

`outputs/`의 `manifest.json`, `prompts.json`, 프롬프트 텍스트와 README가 제작 기록입니다. 원래 `work/`에는 이 컴퓨터 전용 캐시, 브라우저 경로, 생성 서비스의 작업 상태가 섞여 있어 통째로 이관하지 않았습니다. 기존 `toon-viewer` 도구는 GLB 표시 방식만 재현하며, 새 `airship-rig`가 부품 분리·스키닝·애니메이션을 담당합니다. 기존 ZIP은 중복 대용량 파일이므로 저장소의 원본 자산을 사용합니다.

<!-- WORLD-ASSETS-TOOLS BEGIN -->
## 월드 기본팩

`tools/world-assets/README.md`에 실제96자산과7조립 장면의 제작·뷰어·캡처 사용법이 있습니다. 원본·법선 수정본·별도 지붕 보강본을 구분하며 엔진 소켓·충돌·navmesh·LOD·내부·상호작용은 후속 작업입니다. 법선 보정과 지붕 라이너 추가는 서로 다른 단계이며 원래2K텍스처 바이트를 보존합니다. 아래 빌드/검사/문서 도구는 외부 생성·인증·git push를 수행하지 않습니다. 생성/재현 명령은 로컬 산출물을 다시 쓰므로 현재 변경과 원본을 먼저 보존합니다.

```sh
node tools/world-assets/build.cjs
node tools/world-assets/build.cjs outputs/world-assets/scene-catalog.json outputs/world-assets/scenes.html
node tools/world-assets/capture.cjs
node tools/world-assets/gallery.cjs
node tools/qa/world-workbench.cjs outputs/world-assets/index.html work/verification/world-assets outputs/world-assets/catalog.json all 96
node tools/qa/world-workbench.cjs outputs/world-assets/scenes.html work/verification/world-scenes outputs/world-assets/scene-catalog.json all 7
python3 tools/world-assets/handoff.py --dry-run
python3 tools/world-assets/handoff.py --write
python3 tools/verify-assets.py
```

부분 QA는 네 번째 인수의 `all` 대신 쉼표로 구분한 ID를 사용합니다. `gallery.html?overview=1`은 주요 건물6개와7장면만 표시하며 독립96개와 구별합니다. `handoff.py`는 최종 delivery/progress/verification과 실제 모델/해시가 모두 준비됐을 때만 문서·outputs/handoff 사본·현재 자산 inventory를 갱신합니다. `--dry-run`이나 기본 실행은 읽기 전용입니다. 표준 inventory 재계산은 기존 `tools/verify-assets.py --write`를 호출합니다.
<!-- WORLD-ASSETS-TOOLS END -->
