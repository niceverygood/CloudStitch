# Cloudstitch · 클라우드스티치

![Cloudstitch 시작화면](outputs/cloudstitch-title-screen/start-screen.png)

구름 위에서 낡은 비행선을 수리하고, 적의 부품을 인양해 배를 키우며, 잃어버린 기억을 따라가는 싱글플레이어 액션 RPG 프로젝트입니다. 크림색 천, 청록색 기계, 따뜻한 목재와 황동으로 만든 감성적인 손그림 세계를 지향합니다.

현재 저장소는 **게임 기획·스토리보드·무드보드·3D 형태 실험·시작화면 시제품**을 보관합니다. 실행 가능한 전투 게임이나 Unity/Godot 프로젝트는 아직 없습니다. 게임 엔진도 확정하지 않았습니다.

정식 제목은 **Cloudstitch**, 한글 음역은 **클라우드스티치**입니다. ‘구름을 꿰매는 배’는 설명 문구입니다. 기존 문서에 남아 있는 ‘검은 부력 / Black Buoyancy’와 ‘홈와드 / Homeward’는 이전 작업명입니다.

## 바로 보기

저장소를 내려받은 뒤 아래 HTML을 브라우저로 열면 됩니다.

| 자료 | 위치 | 확인할 내용 |
|---|---|---|
| 최신 브랜드 시작화면 | [시작화면](outputs/cloudstitch-title-screen/index.html) | 손그림 로고, 비행선 배경, 한글 메뉴와 짧은 도입 패널 |
| 현재 선택 비행선 | [3D 손그림 뷰어 v2](outputs/selected-airship-toon3d/viewer-v2.html) | 실제 3D 모델 회전·확대, 손그림·셀 명암·원본 재질 비교 |
| 비행선 장착 무기 | [무기 모음](outputs/weapon-modules/gallery.html) · [3D 작업대](outputs/weapon-modules/index.html) | 독립 무기 GLB의 손그림·셀 명암·원본 재질, 비행선 배치 시안 |
| 전투 효과 48종 | [효과 갤러리](outputs/combat-vfx/gallery.html) · [효과 작업대](outputs/combat-vfx/index.html) | 발사·비행·피격·폭발·상태·방어·수리의 실제 메시 애니메이션 |
| 무기별 공격 시연 | [6가지 공격 시연](outputs/combat-vfx/attack-sequences.html) | 기존 무기와 발사→비행→명중 효과를 연결한 GLB 시연 |
| 월드 기본팩 96종 | [월드 갤러리](outputs/world-assets/gallery.html) · [3D 작업대](outputs/world-assets/index.html) | 주요 건물6·모듈90의 실제3D 외형 원형 |
| 월드 조립 장면 7종 | [지역·지도 조립 비교](outputs/world-assets/scenes.html) | 정사6지역과 지도 디오라마, 독립 자산과 별도 집계 |
| 감성판 최종 기획서 | [전체 기획서](outputs/emotional-edition/FINAL-emotional-game-design.html) | 상세 기획 전문과 122장 감성판 보드 |
| 전체 무드보드 비교 | [원본 / 감성판](outputs/emotional-edition/moodboard-comparison.html) | 같은 소재의 두 아트 방향 비교 |
| 비행선 2D 콘셉트 9종 | [입체감 있는 2D 갤러리](outputs/2d-volume-airships/index.html) | 투명 배경 시안 9종과 별도 게임 장면 |
| 초기 3D 디자인 9종 | [3D 옵션 갤러리](outputs/airship-models-9/index.html) | 세 분위기 × 세 형태, GLB 원본과 설계 차이 |
| 이전 기획 통합본 | [기획 원본](outputs/FINAL-game-design-2026-10-17.html) | 기존 작업명으로 저장된 원본·검토·생성 기록 |

HTML은 미리보기/기획 열람용입니다. GitHub의 파일 화면이 아니라 로컬 브라우저에서 여세요. 시작화면의 ‘새로운 항해’는 도입 패널을 열며 실제 캠페인을 실행하지 않습니다.

## 다른 컴퓨터에서 이어가기

같은 Codex 계정을 사용해도 이 컴퓨터의 로컬 파일이 자동으로 복사되지는 않습니다. Git과 Git LFS를 설치하고 저장소를 내려받으세요.

```sh
git lfs install
git clone https://github.com/niceverygood/CloudStitch.git
cd CloudStitch
git lfs pull
git status
```

PNG·GLB와 큰 무기·VFX·월드 뷰어 HTML 다섯 파일은 Git LFS를 사용합니다. 다운로드한 파일이 짧은 포인터 텍스트로 보이면 `git lfs pull`이 완료되었는지 확인하세요. ZIP은 같은 파일을 묶은 중복 배포물이라 Git에서 제외합니다. 맥북의 열람·개발·QA 준비는 [맥북 시작 안내](outputs/handoff/MACBOOK_START.txt)를 따르세요. macOS에서는 자산 검사를 `python3 tools/verify-assets.py`로 실행합니다.

이관 자산은 PNG 505개와 GLB 181개, 합계 약 1.39 GB입니다. [자산 목록](docs/asset-inventory.json)에 실제 686개 파일의 크기와 SHA-256을 기록했습니다. `python3 tools/verify-assets.py`로 무결성을 검사할 수 있습니다. 이 파일 수에는 원본·법선 수정본·지붕 보강본·합성 장면이 각각 들어가므로 월드 독립96자산과 다릅니다. 2026-10-18 맥북 이관 커밋에는 무기·VFX·월드 자료와 최신 소스·문서를 함께 포함합니다. 실제 원격 반영 커밋은 `git log -1 --oneline`과 `origin/main`으로 확인합니다.

Codex에서 이 저장소 폴더를 열고 [이어가기 프롬프트](docs/CONTINUE_PROMPT.md)를 붙여넣으면 됩니다. 자세한 진행 이력과 제한은 [인수인계 문서](docs/HANDOFF.md), 작업 기준은 [AGENTS.md](AGENTS.md)에 있습니다. 사용자 전달용 사본도 [outputs/handoff](outputs/handoff)에 있습니다.

## 폴더 구조

```text
AGENTS.md                    다음 Codex가 읽을 프로젝트 작업 기준
docs/                        인수인계 문서와 복사할 이어가기 프롬프트
tools/                       선별한 뷰어·시작화면 소스, 빌드·검사 도구
outputs/                     기획 원문과 사용자 확인용 완성 산출물
  emotional-edition/         원본 122장에 대응하는 감성판 무드보드와 기획서
  airship-models-9/          초기 고밀도 3D 비행선 9종
  2d-volume-airships/        입체감 있는 2D 비행선 9종과 제작 방식 비교
  selected-airship-toon3d/   선택한 저밀도 3D 원형과 오프라인 뷰어
  cloudstitch-title-screen/  Cloudstitch 로고·시작화면·원화
  weapon-modules/           비행선과 같은 감성의 독립 3D 무기 원형과 작업대
  combat-vfx/               메시 애니메이션 효과 48종과 기존 무기 합성 시연 6종
  world-assets/             주요 건물6·로컬 모듈90·조립 장면7과 오프라인 작업대
  handoff/                  인수인계 문서 사용자 전달용 사본
```

`work/`는 원래 작업 머신의 중간 파일·의존성 폴더이며 Git에서 제외합니다. 재사용할 소스는 `tools/`로 선별해 보관합니다.

뷰어·시작화면 소스를 수정할 때는 Node.js 20 이상에서 아래 명령을 사용합니다. 상세 내용과 옵션은 [tools/README.md](tools/README.md)를 참고하세요.

```sh
npm ci
npm run setup:browser
npm run build:viewer
npm run verify:viewer
npm run verify:ghosting
npm run verify:title
npm run build:weapons
npm run verify:weapons
```

`npm run capture:title`은 시작화면 PNG를 다시 캡처합니다. 검사 결과와 중간 화면은 `work/verification/`에 저장합니다. 실행 가능한 게임을 만드는 빌드 명령은 아닙니다.

## 가장 가까운 다음 단계

완성 아트를 늘리기 전에 `outputs/67-playable-slice-priorities.txt`의 P0~P4를 기준으로 작은 플레이 시제품을 만듭니다. 이동·조준 → 부품 연결/절단 → 회수/장착 → 양력 위험/복구 → 귀환/정산/저장을 한 항해로 검증하는 순서입니다. 현재 비행선은 11,026개 삼각형의 단일 메시이며 프로펠러·포탑·갈고리의 부품 분리와 피벗 설정이 필요합니다.

기존 수치·지역·스킬·스토리 분량은 기획 가설입니다. PNG의 완성도나 뷰어 테스트를 실제 게임의 재미·성능·밸런스 검증으로 해석하지 않습니다.
