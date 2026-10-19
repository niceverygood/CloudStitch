# 2026-10-18 데스크톱 인수인계

이 문서는 첫 전장 구현 세션을 중단하고 현재 작업을 Git에 보관하는 시점의 보충 인계다. 기존 원문과 다른 세션의 작업을 보존한다. 다음 PC에 붙일 전문은 `docs/BATTLEFIELD_DESKTOP_CONTINUE-2026-10-18.txt`다.

## 현재 전장

`outputs/battlefield-v1/index.html`과 `tools/battlefield/README.md`가 이번 세션의 실행물·소스 기준이다. 기존 함대 GLB 4개를 읽어 구름 바다와 부유섬 9개/원경 4개, 귀환 부두, 이동·기관총·회피 가능한 공격 예고·부품 피격·골조 하위 묶음 분리·인양/화물/소유권·과적 유예/투하·귀환 결과를 연결했다. 실제 포탑 조준과 프로펠러가 동작한다.

최종 검수에서 파괴된 함포가 뒤늦은 갑판 분리 때 다시 나타나던 표시, 시작/일시정지 화면의 Tab 접근, 전체지도 이후 재시작 배율을 수정했다. 규칙 검사16개를 통과했고 브라우저 최종 상세 결과는 `outputs/battlefield-v1/verification.json`에서 번들 SHA와 함께 확인한다. 실제 입력 검사와 시험용 위치/위험 상태 배치를 분리해 기록했다. 모바일 검사는390×844 터치 에뮬레이션이며 실제 휴대전화 성능 인증이 아니다.

P0/P1과P2의 회수·화물까지의 시제품이다. 장착 편집·전체 항구경제/정산·영속저장·캠페인·패드·무기별 완성 효과는 없다. 새로고침하면 초기화된다. 충돌은 임시 평면 원이며 연합의 쌍엔진/쌍기낭은 각각 하나의 집계 표적이다. 전장 지명/거리/밸런스는 표시·검증용 제안이다.

## 별도 세션 자료

`outputs/fleet-v1/`의71항목 GLB/뷰어/미리보기와 리깅 파생본, 원화는 기존 작업으로 보존한다. `outputs/encounters-v1/`의6판 교전은 별도 소스 `tools/encounters/`와 검사를 갖는다. 이번 첫 전장과 동일 구현이나 합쳐진 캠페인으로 설명하지 않는다. encounters의 최종 마감 상태는 해당 README/manifest/verification을 다시 읽는다.

원격 main에는 이 컴퓨터에 없던 `weapon-modules`(도구 `weapon-workbench`), `combat-vfx`, `world-assets`와 관련 도구/문서가 먼저 추가되어 있었다. 원격 이력을 보존하면서 병합한다. 새로 받은 PC에서는 Git LFS를 사용해 전체 자산을 다운로드한다. 과거441개/686개 같은 집계는 각각 이전 시점의 자산 목록이며 현재 합계는 `docs/asset-inventory.json`을 따른다.

## 실행

저장소 루트에서 `npm ci`, `node tools/battlefield/build.cjs`, `node --test tools/battlefield/sim.test.mjs`를 실행한다. `python3 -m http.server 8080 --bind 127.0.0.1`로 저장소 루트를 제공하고 `http://127.0.0.1:8080/outputs/battlefield-v1/index.html`을 연다. Windows에서는 `python` 명령을 사용할 수 있다. 로컬 포트59306은 이전 컴퓨터의 일시적 서버이며 새 PC에 자동 복원되지 않는다.

`npm run setup:browser`는 검사용 Chromium 준비다. `BATTLEFIELD_URL`을 실제 서버 주소로 설정하고 `node tools/battlefield/verify.cjs`를 실행하면 독립 브라우저에서 재검사한다. `work/`, 의존성, 로컬 로그/캐시, ZIP은 커밋 대상이 아니다.

## 재개 원칙

처음에는 다운로드·빌드·실제 실행 상태만 복원하고 다음 사용자 지시를 따른다. 대규모 새 콘텐츠·엔진 전환·유료 생성·배포·과거 자동화를 재개하지 않는다. 기획 정사와 미확정 값은112/114와 분야별 기준, 신규 전장 구현은 해당 소스/검증 기록을 확인한다. `OutlineEffect.autoClear=true`를 유지한다.

전송 전 자산 대조: 전체 미디어841개 중 이 컴퓨터의 실제파일446개는 크기/SHA를 검증했고, 원격에서 병합한395개는 Git LFS 포인터의 크기/SHA를 inventory와 대조했다. 새 PC에서 `git lfs pull` 후 `python tools/verify-assets.py`로 전체 실파일을 다시 검사한다.
