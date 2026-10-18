# Cloudstitch 재현 도구

기존 결과물은 `outputs/`의 HTML을 바로 열어 볼 수 있습니다. 아래 도구는 다른 컴퓨터에서 뷰어를 수정하고 다시 만들거나 같은 검사를 실행할 때 사용합니다. 유료 이미지 생성이나 Meshy API 호출은 하지 않습니다.

## 준비

Node.js 20 이상과 npm을 설치하고, 저장소를 Git LFS까지 내려받습니다.

```sh
git lfs install
git lfs pull
npm ci
npm run setup:browser
```

Playwright에 설치된 Chromium을 먼저 사용합니다. 없다면 `CHROME_EXECUTABLE_PATH` 환경변수의 실행 파일이나 운영체제의 일반적인 Chrome/Edge 설치 경로를 사용합니다. Linux에서 브라우저 시스템 라이브러리가 없으면 `npx playwright install --with-deps chromium`을 실행합니다. 도구 경로와 입출력 상대 경로는 실행한 디렉터리가 아닌 저장소 루트를 기준으로 해석합니다.

Python 도구 `verify-assets.py`는 Python 3 표준 라이브러리만 사용하며 추가 패키지가 필요하지 않습니다. `python tools/verify-assets.py`로 291개 PNG/GLB의 크기와 SHA-256을 확인할 수 있습니다. 뷰어 빌드·브라우저 검사는 Python 없이 동작합니다. 원본 작업 폴더의 일회용 패키징 스크립트는 이관하지 않았습니다.

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

기본 검사 기록과 스크린샷은 `work/verification/viewer`, `ghosting`, `title-screen`에 저장되며 Git에 올리지 않습니다. 검사를 실행하면 UI 시제품을 검사하는 것이며 실제 전투·저장 시스템의 구현이나 검증을 뜻하지 않습니다.

## 자산 생성·패키징 기록

`outputs/`의 `manifest.json`, `prompts.json`, 프롬프트 텍스트와 README가 제작 기록입니다. 원래 `work/`에는 이 컴퓨터 전용 캐시, 브라우저 경로, 생성 서비스의 작업 상태가 섞여 있어 통째로 이관하지 않았습니다. 이 도구는 기존 GLB를 표시하는 방식만 재현하며 모델 자체의 리깅·분리·애니메이션을 생성하지 않습니다. 기존 ZIP은 중복 대용량 파일이므로 저장소의 원본 자산을 사용합니다.
