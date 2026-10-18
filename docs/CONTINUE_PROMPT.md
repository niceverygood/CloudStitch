# 데스크톱 Codex 이어가기 프롬프트 · 2026-10-18 체크포인트

추가 개발을 멈추고 현재 작업을 옮기는 인수인계입니다. 바로 복사할 짧은 독립 프롬프트는 [DESKTOP_CONTINUE_PROMPT-2026-10-18.txt](../outputs/handoff/DESKTOP_CONTINUE_PROMPT-2026-10-18.txt)에 있습니다. Git 원격 반영 브랜치/커밋은 최종 push 확인 뒤 기록합니다. 아래 내용을 저장소를 연 Codex 채팅에 붙여넣으세요.

---

이 저장소의 **Cloudstitch · 클라우드스티치** 게임 작업을 현재 체크포인트부터 이어가줘. 먼저 인수인계 상태를 확인하고 사용자의 다음 요청에 따라 개발해줘.

저장소: https://github.com/niceverygood/CloudStitch

같은 Codex 계정의 다른 컴퓨터에서 옮겨온 프로젝트야. 이전 채팅이나 이전 Windows 절대 경로, Temp 이미지, Codex 캐시가 이 컴퓨터에 있다고 가정하지 말고 **현재 저장소 파일을 사실 기준으로** 삼아줘.

먼저 `git status`를 확인해서 기존 수정 사항을 보존하고, `AGENTS.md`, `README.md`, `docs/HANDOFF.md`를 읽어줘. Git LFS 자산이 포인터 상태이면 필요한 실제 파일을 내려받아. 아직 clone하지 않았다면 아래 절차로 준비해줘. 이미 해당 저장소에서 작업 중이면 중복 clone하지 마.

```sh
git lfs install
git clone https://github.com/niceverygood/CloudStitch.git
cd CloudStitch
git lfs pull
npm ci
npm run setup:browser
python3 -m http.server 8840 --bind 127.0.0.1
```

Node.js20 이상이 필요해. 서버는 저장소 루트에서 실행하고 `http://127.0.0.1:8840/outputs/encounters-v1/`을 열어줘. 새 교전은 HTTP 상대 경로로 기존 함대 GLB를 읽어야 하므로 `file://` 또는 출력 폴더만 서비스하는 서버와 달라.

현재 확정 사항과 작업 상태:

- 작품의 정식 영문 제목은 **Cloudstitch**, 한글 음역은 **클라우드스티치**야. ‘구름을 꿰매는 배’는 설명 문구야. GitHub 폴더 이름의 `CloudStitch`와 작품 표기를 구분해줘. 검은 부력 / Black Buoyancy, 홈와드 / Homeward는 이전 작업명이므로 새 산출물에는 공식명을 사용하되 과거 기획과 생성 기록은 보존해줘.
- 비행선을 조립·수리하고 적의 부품을 절단·인양해 배를 키우며 기억의 주인을 찾아가는 싱글플레이어 액션 RPG를 기획했어. 따뜻하고 감성적인 손그림, 입체감 있는2D 느낌이 핵심이야. 실제3D를 쓰더라도 사실적인 광택보다 그림처럼 보이게 만들고 싶어.
- 현재 저장소는 상세 기획·무드보드·실제3D 원형·뷰어·시작화면과 **별도6개 판 브라우저 전투 시제품**이야. 이동·사격·공격 예고·피격과 두 보스 교전이 있는 시제품이며, 최종 엔진·플랫폼은 미정이고 전체 캠페인은 없어. Unity/Godot 채택을 이미 확정했다고 쓰지 마. 최신 통합 검사 상태를 실제 보고서에서 확인해줘.
- `outputs/emotional-edition/FINAL-emotional-game-design.html`은 감성판 최종 기획서야. 원본122장과 감성판122장을 보존했으며 상세 기획·검토114개가 있어. 전체 보드 비교는 `outputs/emotional-edition/moodboard-comparison.html`, 기존 기획 전문은 `outputs/FINAL-game-design-2026-10-17.html`에 있어.
- `outputs/airship-models-9/index.html`은 초기 고밀도3D 비행선9종, `outputs/2d-volume-airships/index.html`은 입체감 있는2D 정지 시안9종과 게임 장면이야. 2D 시안은 완성 스프라이트 시트가 아니야.
- 현재 선택 비행선 기준 그림은 `outputs/selected-airship-toon3d/reference.png`, 실제 모델은 같은 폴더의 `airship.glb`, 최신 뷰어는 `viewer-v2.html`이야. 모델은11,026삼각형, 단일 메시/재질,2K텍스처, 애니메이션 없음이야. 프로펠러·포탑·갈고리는 부품 분리와 피벗·장착 위치 정리가 필요해. 전체 선체에 캐릭터용 뼈대 리깅부터 할 필요는 없어.
- 2026-10-18 이후 별도 리깅 파생본은 `outputs/airship-rig-v1/airship-rigged.glb`와 `viewer.html`이야. 원본은 보존됐고, 파생본은9개 제어 뼈대·7개 실제 내장 클립·11,986삼각형이야. `README.txt`, `manifest.json`, `verification.json`, `gltf-validation.json`을 확인하고 `tools/airship-rig/`의 소스로 이어가줘. 원본의 단일메시/애니메이션없음 설명과 구분해줘. 임시 소켓·제자리 동작이며 게임 물리·충돌·LOD·엔진 적용은 후속이야.
- 전체 함대 에셋 제작판은 `outputs/fleet-v1/index.html`과 같은 폴더의 결과 `catalog.json`을 확인해줘. 원문 근거는 `tools/fleet/catalog.json`, 재현은 `tools/fleet/README.md`야. 71개는 고유 정사 선체71종이 아니라 핵심 함선24·형태/디자인 변형14·역할/지원29·시설3·기록1이야. 기존 A1~C3 원본과 선택선 리깅은 보존했고 새 공통 키트 해석을 별도로 만들었어. `modules`의 null을0으로 바꾸지 말고 확정 수와 `artModules`/`shapeProposal` 제작 제안을 구분해줘. GLB71개·개별뷰어71개·실제PNG71개가 있고, 최신 집계는8,192~109,860삼각형·4~58본·각7클립이야. 전체71개·갤러리 독립 QA는통과했고glTF 오류·경고0이야. `outputs/fleet-v1/verification.json`과 실제 metrics·QA 상태를 현재 파일에서 다시 확인해줘. overview/finalize/대표잔상검사 명령과 실행 순서는 전용 README를 따르고 전체 QA 이전에 마감하지 마. 후반 설정과 결말/역사 항목은 로컬 검토용으로 표시돼 있고 실제 게임 이벤트가 구현된 것은 아니야.
- 별도 교전은 `outputs/encounters-v1/index.html`, 소스/근거는 `tools/encounters/`, 사용법은 `tools/encounters/README.md`야. 지역6개를6판으로 재편성했고 일반 적36회와 중간보스6회·최종보스6회가 등장해. 고유 함선48종이라는 뜻이 아니야. 모든 보스는 정사 외형 참고 교전 역할 변형(`prototypeCommander`)이며 전체 정사 기믹·사망·결말을 완성한 것이 아니야. 흐름은 일반 적→중간보스→수동 정비→후반 적→최종보스→승리야. WASD/방향키, 마우스/J 사격, Space 기동, 자동 조준, 터치 조이스틱/사격/기동, 일시정지, 피격·패배·재도전을 제공해. 무료 완전 수리는 교전 시험용 구제이고 정사 경제가 아니야. 저장은 `cloudstitch-encounters-v1-wins` localStorage의 판별 승리 표시뿐이며 전투 상태/캠페인 이어하기는 없어. 빌드는 `npm run build:encounters`, 검사는 `npm run verify:encounters`야. 모듈 절단/회수/소유권/화물/장착/양력/경제/정산 등P1~P4는 후속이야. 현재 소스·번들 HTML·카탈로그·manifest와 실제 PNG4장(`preview-battle.png`, `preview-boss.png`, `preview-palace.png`, `preview-mobile.png`)을 보존해줘.
- 현재 교전 코어6판의 상태 전환·보스 각1회 등장·정비·패배/재도전 부분 검사는 통과했어. 실제 무기 경로 완주와 렌더/입력/GLB/모바일 통합 검사는 이 체크포인트에서 마감 중이야. `--core-only` 통과를 전체 통과로 읽지 말고 `outputs/encounters-v1/verification.json`, `manifest.json`과 실제 재실행 결과를 확인해줘.
- 다음 후보2개는 이번에 추가 수정하지 않고 넘겼어. `app.js`의 중앙 보스 접근 배너가 첫 공격 예고와 겹칠 수 있으므로 `s.telegraphs.length > 0`일 때 배너를 숨기는 방향을 검토해줘. `scene.js`의 충각 중 선체 표시 방향은 플레이어 추적 방향보다 `e.chargeAngle`에 고정하는 방향을 검토해줘. 현재 수정 완료로 표시하지 말고 실제 재현부터 해줘.
- `tools/battlefield/`, `outputs/battlefield-v1/`는 다른 동시 작업 범위이므로 이 교전 체크포인트의 구현·검증에 섞지 마. 파일이 있으면 출처와 별도 인수인계를 먼저 확인해줘.
- 뷰어는 손그림/셀 명암/원본 재질의 세 모드와 회전·확대가 가능해. 회전 잔상은 `outlineEffect.autoClear = true`를 명시해 수정했고 세 모드의120프레임 회전 후 새 렌더와 차이 픽셀0을 확인했어. 그 설정을 보존하고 수정하면 회귀 검사해줘. 셀/윤곽선은 뷰어 런타임 효과라 GLB만 엔진에 가져가면 자동 재현되는 것은 아니야.
- 최신 로고/시작화면은 `outputs/cloudstitch-title-screen/index.html`, `cloudstitch-logo.png`, `title-background.png`, `start-screen.png`야. 크림색 천, 청록색 기계, 꿀빛 목재, 황동, 산호색 수선 천과 아침 구름 하늘의 감성이야. 해당 시작화면의 ‘새로운 항해’는 짧은 도입 패널만 열고 전투·저장·캠페인을 실행하지 않아. 별도6판 교전과 구분해줘.
- 시스템 기준은 `outputs/112-system-rules-reference.txt`, 미확정 제작 결정은 `outputs/114-production-decision-register.txt`, 첫 구현 순서는 `outputs/67-playable-slice-priorities.txt`를 읽어줘. 정사39/107, 모듈19/65, 무기21/72, 스킬49, 기본선50, 인물52, 용어51, 수정검토 `outputs/visual-review-notes.txt`가 초기 이미지보다 우선이야.
- 현재 전체 바이너리 자산 목록은441개(PNG358·GLB82·WebM1), 약1.706GB야. `docs/asset-inventory.json`과 `python tools/verify-assets.py`로 확인해줘. 함대 카탈로그71항목과 전체 파일441개를 혼동하지 마.
- 전투·무기·스킬·지역·스토리 분량과 수치는 기획 가설이야. 파일 검사나 뷰어 QA를 게임 플레이·성능·밸런스 검증으로 과장하지 마.

작업 방식:

1. 위 최신 시작화면·선택 비행선 뷰어·교전 시제품·기획 기준을 읽거나 열어서 현재 상태를 짧게 정리해줘. 교전은 저장소 루트의 로컬 HTTP로 실제 GLB 로딩과 최신 QA를 확인해줘. 실제 파일과 이 설명이 다르면 차이를 명시하고 파일 근거로 정리해줘.
2. 지금은 다른 PC로 옮기는 체크포인트야. 먼저 현재 교전의 로딩·조작·가독성과 검사 상태를 짧게 보고하고 사용자의 다음 요청을 기다려줘. 이 인수인계 자체를 추가 개발이나 재생성 지시로 해석하지 마. 개발 요청이 오면 미완성P0 조건과 P1~P4의 작은 항해 범위를 먼저 맞추고 최종 엔진/플랫폼 선택을 확정된 과거 사실로 쓰지 마.
3. 권장 순서는 이동/조준·카메라 → 단일 부모 모듈 연결/절단 → 갈고리 회수·소유권·화물·장착 → 양력 위험과 복구 → 항구 귀환·정산·저장 → 한 동료와 한 기억이야. 엔진이 확정되면 같은 규칙을 검증할 수 있는 작은 항해부터 구현해줘.
4. 기존 이미지·GLB·기획 전문·생성 기록을 보존해줘. 사용자 산출물은 `outputs/`, 재사용 소스·빌드/검사는 `tools/`, 중간 파일은 `work/`를 사용해. 경로는 저장소 기준으로 만들어 다른PC에서도 실행할 수 있게 해줘.
5. API키·토큰·인증 정보를 출력하거나 커밋하지 마. 현재 인수인계 때문에 새 유료Meshy 작업이나 무드보드를 자동 생성하지 마. 내가 새 이미지/모델 생성을 요청하면 그 작업 범위에서 진행해줘.
6. 이전8분 간격 자정 자동화는 종료되었어. 재개하거나 새 자동화·외부 메시지·별도 채팅·배포를 만들지 마. ZIP과node_modules는 저장소에서 제외하고 큰 자산은 기존LFS 규칙을 따라줘.
7. 결과는 한국어로 설명하고 무엇이 구현됐는지, 실제 검사 범위·현재 상태·남은 한계를 알려줘. 우선 파일을 읽고 새 PC에서 현재 체크포인트가 그대로 열리는지 확인하는 것부터 시작해줘.

---
