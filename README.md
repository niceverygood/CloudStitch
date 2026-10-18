# Cloudstitch · 클라우드스티치

![Cloudstitch 시작화면](outputs/cloudstitch-title-screen/start-screen.png)

구름 위에서 낡은 비행선을 수리하고, 적의 부품을 인양해 배를 키우며, 잃어버린 기억을 따라가는 싱글플레이어 액션 RPG 프로젝트입니다. 크림색 천, 청록색 기계, 따뜻한 목재와 황동으로 만든 감성적인 손그림 세계를 지향합니다.

현재 저장소는 **게임 기획·스토리보드·무드보드·리깅 에셋·함대 제작판·시작화면과 별도6개 판 브라우저 전투 시제품**을 보관합니다. 전투 시제품은 이동·사격·공격 예고·피격과 판별 두 보스의 교전을 시험합니다. 최종 게임 엔진과 플랫폼은 미정이며 Unity/Godot 프로젝트나 전체 캠페인을 완성한 상태는 아닙니다. 전투 시제품의 최종 통합 검증은 아래 상태 기록을 확인하세요.

정식 제목은 **Cloudstitch**, 한글 음역은 **클라우드스티치**입니다. ‘구름을 꿰매는 배’는 설명 문구입니다. 기존 문서에 남아 있는 ‘검은 부력 / Black Buoyancy’와 ‘홈와드 / Homeward’는 이전 작업명입니다.

## 바로 보기

저장소를 내려받은 뒤 기존 아트 뷰어 HTML은 브라우저로 바로 열 수 있습니다. **6개 판 전투 시제품은 저장소 루트의 로컬 HTTP 서버에서 여세요.** 실행 방법은 [교전 시제품 안내](tools/encounters/README.md)에 있습니다.

| 자료 | 위치 | 확인할 내용 |
|---|---|---|
| 6개 판 전투 시제품 | [항로별 교전](outputs/encounters-v1/index.html) | 일반 적 → 중간보스 → 수동 정비 → 후반 적 → 최종보스, 이동·사격·회피·재도전; 로컬 HTTP 필요 |
| 최신 브랜드 시작화면 | [시작화면](outputs/cloudstitch-title-screen/index.html) | 손그림 로고, 비행선 배경, 한글 메뉴와 짧은 도입 패널 |
| 움직이는 비행선 에셋 v1 | [리깅·애니메이션 미리보기](outputs/airship-rig-v1/viewer.html) | 9개 제어 뼈대, 7개 내장 동작, 부품별 제어와 인양 케이블 |
| 전체 비행선 제작판 | [함대 갤러리](outputs/fleet-v1/index.html) | 주인공·적군·라이벌·보스·민간·기존 디자인 대안, 문서 기준과 제작용 배치 비교 |
| 현재 선택 비행선 | [3D 손그림 뷰어 v2](outputs/selected-airship-toon3d/viewer-v2.html) | 실제 3D 모델 회전·확대, 손그림·셀 명암·원본 재질 비교 |
| 감성판 최종 기획서 | [전체 기획서](outputs/emotional-edition/FINAL-emotional-game-design.html) | 상세 기획 전문과 122장 감성판 보드 |
| 전체 무드보드 비교 | [원본 / 감성판](outputs/emotional-edition/moodboard-comparison.html) | 같은 소재의 두 아트 방향 비교 |
| 비행선 2D 콘셉트 9종 | [입체감 있는 2D 갤러리](outputs/2d-volume-airships/index.html) | 투명 배경 시안 9종과 별도 게임 장면 |
| 초기 3D 디자인 9종 | [3D 옵션 갤러리](outputs/airship-models-9/index.html) | 세 분위기 × 세 형태, GLB 원본과 설계 차이 |
| 이전 기획 통합본 | [기획 원본](outputs/FINAL-game-design-2026-10-17.html) | 기존 작업명으로 저장된 원본·검토·생성 기록 |

GitHub의 파일 화면이 아니라 로컬 브라우저에서 여세요. 아트 뷰어는 모델/기획 열람용이며 전투 시제품과 구분합니다. 시작화면의 ‘새로운 항해’는 도입 패널을 열며 실제 캠페인을 실행하지 않습니다.

## 다른 컴퓨터에서 이어가기

같은 Codex 계정을 사용해도 이 컴퓨터의 로컬 파일이 자동으로 복사되지는 않습니다. Git과 Git LFS를 설치하고 저장소를 내려받으세요.

```sh
git lfs install
git clone https://github.com/niceverygood/CloudStitch.git
cd CloudStitch
git lfs pull
git status
```

PNG·GLB 등 큰 자산은 Git LFS를 사용합니다. 다운로드한 PNG가 열리지 않거나 GLB가 짧은 텍스트로 보이면 `git lfs pull`이 완료되었는지 확인하세요. ZIP은 같은 파일을 묶은 중복 배포물이라 Git에서 제외합니다.

현재 전체 자산 목록은 PNG 358개, GLB 82개, 미리보기 영상 1개로 총441개, 1,705,790,471bytes(약1.706GB)입니다. [자산 목록](docs/asset-inventory.json)에 크기와 SHA-256을 기록했습니다. Python 3가 있으면 `python tools/verify-assets.py`로 다운로드한441개 파일의 무결성을 검사할 수 있습니다. 함대 제작판의 항목별 파일·수치·제작 배치는 `outputs/fleet-v1/catalog.json`을 확인합니다.

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
  airship-rig-v1/            선택 원형을 보존한 리깅·애니메이션 파생본
  fleet-v1/                  전체 기획 함대 제작판·개별 GLB·뷰어·미리보기
  encounters-v1/             기존 함대를 사용하는 별도6개 판 브라우저 교전
  cloudstitch-title-screen/  Cloudstitch 로고·시작화면·원화
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
```

`npm run capture:title`은 시작화면 PNG를 다시 캡처합니다. 위 명령은 기존 뷰어/시작화면용입니다. 별도 교전 시제품은 `npm run build:encounters`, `npm run verify:encounters`로 빌드·검사하고, 저장소 루트에서 `python3 -m http.server 8840 --bind 127.0.0.1` 실행 후 `http://127.0.0.1:8840/outputs/encounters-v1/`을 엽니다. 검사 결과와 중간 화면은 `work/verification/`에 저장합니다.

## 가장 가까운 다음 단계

2026-10-18에 선택 비행선의 별도 [리깅 파생본](outputs/airship-rig-v1/README.txt)을 추가했습니다. 원본의 위치·UV와 11,026삼각형을 보존하고 케이블 960삼각형을 더해 11,986삼각형, 9개 뼈대와 7개 GLB 내장 클립으로 구성했습니다. 부유·순항·선회·돌풍 회복·포탑 조준·인양·포신 반동을 실제 모델로 재생할 수 있습니다. 임시 장착 노드는 위치 검토용이며 실제 치수·충돌·LOD·엔진 재질과 플레이 구현은 후속입니다. 재현은 `npm run build:rig`, 검사는 `npm run verify:rig`와 `npm run verify:gltf`를 사용합니다.

<!-- FLEET_SUMMARY_START -->
전체 기획 함대는 [제작판 갤러리](outputs/fleet-v1/index.html)에서 검토합니다. GLB71개·개별 뷰어71개와 미리보기PNG71개를 만들었고 [전체71개·갤러리 독립 검사](outputs/fleet-v1/verification.json)를 통과했습니다(glTF 오류·경고0). 목록은 고유 정사 선박71척이 아니라 핵심 함선24·형태/디자인 변형14·역할/지원29·시설3·기록1입니다. 모델은 8,192~109,860삼각형, 4~58본, 각7개 내장 클립이며 실제 지원 동작은 장치에 따라 다릅니다. 미정 수는 `modules: null`, 표현용 배치는 `artModules`로 구분합니다. 재현·검사·한계는 [함대 도구 안내](tools/fleet/README.md)를 따릅니다.
<!-- FLEET_SUMMARY_END -->

<!-- ENCOUNTERS_SUMMARY_START -->
[6개 판 교전 시제품](outputs/encounters-v1/index.html)은 기존 함대 GLB로 일반 적36회와 중간보스6회·최종보스6회의 등장을 구성합니다. 키보드/마우스/터치로 이동·사격·긴급기동하고, 피격·패배·재도전과 일시정지를 시험합니다. 모든 보스는 정사 외형을 참고한 교전 역할 변형이며 원문 전체 기믹·서사·결말 완성이 아닙니다. 중간 무료 완전 수리는 이번 시험용 구제이고, 저장은 판별 승리 표시만입니다. 현재는 인수인계 체크포인트로 추가 개발을 멈췄습니다. 코어6판 상태 전환 부분 검사는 통과했고 실제 무기 경로·GLB 렌더·입력·모바일 통합 검사는 마감 중입니다. 실제 교전 미리보기4장을 저장했습니다. [소스·조작·검증 범위](tools/encounters/README.md), [데스크톱 이어가기 프롬프트](outputs/handoff/DESKTOP_CONTINUE_PROMPT-2026-10-18.txt)를 확인하세요.
<!-- ENCOUNTERS_SUMMARY_END -->

다음 개발은 현재 교전 시제품의 조작·가독성을 확인한 뒤 `outputs/67-playable-slice-priorities.txt`의 P1~P4로 이어갑니다. 부품 연결/절단 → 회수/장착 → 양력 위험/복구 → 귀환/정산/저장을 한 항해로 검증하는 순서입니다. 이번 교전에는 이 순환과 정사 경제가 없습니다. 선택 원본은 11,026개 삼각형의 단일 메시로 보존하며, 게임에 가져올 부품·피벗·동작은 위 파생본에서 검토할 수 있습니다.

기존 수치·지역·스킬·스토리 분량은 기획 가설입니다. PNG의 완성도나 뷰어 테스트를 실제 게임의 재미·성능·밸런스 검증으로 해석하지 않습니다.
