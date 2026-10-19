# 적 함선 한눈에 · READY-r1

담당 채팅: `01a14ec4-81b5-7583-8d51-e35ad3b30d55`. 쓰기 범위는 `tools/enemy-fleet-gallery/`와 `outputs/enemy-fleet-gallery-v1/`다. 총괄·통합의 `outputs/project-command/COORDINATION.txt` 및 JSON을 읽었으며 이후 무거운 QA는 통합의 단일 슬롯으로 인계한다.

## 결과와 범위

- 진입점: `outputs/enemy-fleet-gallery-v1/index.html`. 모든 이미지와 3D 링크는 저장소 상대 경로다.
- 기본19항목: 일반7 / 임무·역할7 / 중간보스·보스·시설5. 목록·세력 필터·검색·큰 카드 보기·두 척 정지 렌더 비교를 제공한다.
- 별도7항목: 협상 가능한 라이벌6척과 함대왕의 비살상 시험1. 항상 적인 것으로 분류하지 않는다.
- 최신 그림 기반6척은 reference-v1, 나머지는 기존 fleet-v2의 실제 렌더·GLB·뷰어를 연결한다.
- 카드의 실제3D는 기존 뷰어 iframe 한 개만 연다. 교체·닫기에 iframe을 제거한다. 모드·회전·확대·클립은 원본 뷰어의 기능이다.
- `overview.png`는 기본19항목의 실제 브라우저 렌더다. `gallery-preview.png`와 `comparison-preview.png`도 새 페이지를 캡처했다.

보스5에는 중간보스1·함선2·시설2가 포함된다. 살아 있는 조선소와 수석 조선공 지휘함은 구별한다. 일반 포격선/방어선은 별도 함명·선체 미정인 역할이다. 미정 보스를 새 항목으로 만들거나 전체71항목을 적군으로 바꾸지 않았다. 카탈로그 수를 캠페인·전투 완성 수로 승격하지 않는다. 비교는 각 칸에 맞춘 외형이며 실제 상대 크기가 아니다.

## 원본 보존과 읽기 의존성

기존 함대·편성·reference·공통코드·package/lock은 수정하지 않았다. 새 생성·유료 호출·commit/push·배포·자동화는 없다. 신규 PNG는 전역 LFS 규칙에 해당한다. 새 소스/출력은 `READY-r1.json`의 `files`에만 들어가며 의존성 자체를 새 산출물로 세지 않는다.

열람/재현 시 필요한 읽기 의존성:

- `outputs/fleet-comparison-v1/inventory.json`, `previews/`: 기존 진영·설명과20개 미리보기.
- `outputs/enemy-fleet-reference-v1/catalog.json`, `previews/`, `ships/`: 최신6척 미리보기·실제 뷰어·GLB.
- `outputs/fleet-v2/ships/`: 나머지20개 뷰어·GLB.
- 캡처/QA의 `tools/lib/runtime.cjs`, `tools/lib/paths.cjs`, 기존 Playwright/브라우저 설치. 공통 변경 요청은 없다.

정확한 기존 자산별 경로·크기·SHA는 이미 작성된 `source-manifest.json`을 읽는다. 이 인계에서 대형 원본 자산을 다시 해시하거나 브라우저를 다시 실행하지 않았다. 통합 import는 상대 경로를 유지하거나 별도 작업 공간에서 명시적으로 경로를 맞춰야 한다. 이 갤러리 폴더만 분리 복사하면 기존 이미지/3D 링크가 끊긴다. 원본 모델·뷰어 갱신 시 소유자 협의 후 새 갤러리 revision으로 다시 인계한다.

## 이미 수행한 검사

협업 단일 슬롯 지시 수신 전에 로컬 검증을 완료했다.

- `verification.json`: 2026-10-18 11:32:57.986Z~11:34:00.885Z, 68/68 PASS.26 모델/미리보기 SHA·경로,26 PNG decode, 목록/검색/필터/두척비교,390px 넘침 검사.
- 대표2척 `enemy-pirate-scout`(최신reference), `enemy-tax-cutter`(기존v2)의 실제GLB·3모드·윤곽선·회전·확대·초기화·화면맞춤·자동회전·모바일 조작.2척×3모드에서120프레임 회전 후 같은 카메라의 clean render와 캔버스 RGBA 비교6건 모두 차이픽셀0. `OutlineEffect.autoClear=true` 확인.
- 외부 요청·페이지/콘솔/HTTP/실패요청0. `capture.json`: file://로 기본19장과 비교이미지 로딩, 외부요청·페이지오류0.
- 이전 exec 세션 QA66952/capture83840은 종료했으며 하네스의 `finally`가 브라우저/서버를 닫았다. launch PID는 별도 저장하지 않았다. 수신 뒤 소유 작업 프로세스가 없는 것도 확인했다.
- `lightweight-checks.json`은 신규 소스 문법/작은JSON·수록수·참조파일 존재만 확인한다. 대형의존성 재해시·브라우저 재실행은 하지 않는다.

선행 검사 하네스는 `tools/enemy-fleet-gallery/qa.cjs`이며 실행 당시 SHA는 `verification.json`의 `harnessSha256`에 있다. 현재 하네스가 이 SHA와 같은지 경량 검사로 확인했다. 소스·현재HTML/카탈로그·보고서·capture 및 PNG 각각의 바이트/SHA는 `READY-r1.json.files`, 이들 사이의 선행 실행 결속과 조건은 같은 manifest의 `priorExecution`을 따른다. 검사 후 UI/입력 데이터 변경은 없고 인계 문서/경량 동결 도구만 추가했다.

선행 실제 브라우저 진입 경로는 `http://127.0.0.1:<임시포트>/outputs/enemy-fleet-gallery-v1/index.html`이다. 하네스가 `server.listen(0, '127.0.0.1')`로 할당한 숫자 포트는 당시 보고서에 보존하지 않았으므로 정확한 포트 번호를 추정하지 않는다. 경로·대상·1440×1080/390×844·DPR1·reduced-motion=reduce 조건은 실행 하네스와 보고서로 확인된다. 로컬파일 캡처는 같은 index의 `file://` URL과 `?sheet=1`을 사용했다. 통합의 새 실제 import URL/실행물/보고서는 통합 담당이 별도 기록한다.

모든26뷰어의 새 QA·장기 성능·실제기기·전투·AI·피해·절단·저장/캠페인 검증은 이 검사의 범위가 아니다. 기존 보고서와 원본은 보존한다.

## 통합에 인계하는 정확한 실행 범위

새소스/출력 확인(브라우저0):

```sh
node tools/enemy-fleet-gallery/freeze.cjs --check
```

통합 담당이 예약한 단일 슬롯에서 기존 QA를 재현할 필요가 있을 때만:

```sh
node tools/enemy-fleet-gallery/qa.cjs
```

QA는 브라우저 한 개·페이지 한 개·뷰어 한 개씩 순차 사용하고 localhost 임시서버를 종료한다. 예상 범위는 위68검사·대표2뷰어·6건120프레임 비교이며 이전 로컬 수행은 약63초였다.26개의 큰GLB해시 I/O를 포함하므로 슬롯 밖에서 실행하지 않는다. 실행하면 현재 보고서를 덮어쓰므로 동결본과 원보고서를 먼저 별도 보존하고, 결과는 통합 전용 경로에서 결속한다. 자동 fullpack/game QA는 없다.

현재 동결 하네스는 `--out`/`--report` 옵션을 지원하지 않는다. 원본 하네스에 옵션을 덧붙여 실행해도 출력 경로가 바뀌지 않으므로 실행하지 않는다. 통합은 이미 통과한68검사·26대형해시·6회전을 자동 반복하지 않고, 새 선별import URL의 링크/부족 범위만 자체 하네스와 별도 보고 경로로 확인한다. 하네스 옵션 추가가 정말 필요해지면 원 보고서·실행 당시 하네스를 보존한 다음 새 revision으로 인계한다.

재빌드/이미지 재캡처는 변경이 생겼을 때만 통합과 조율한다. `build.cjs`는 기존26GLB를 읽어 해시하며 `capture.cjs`는 브라우저를 사용한다. 이 READY에는 새 통합 실행·별도 import·공통 검수 허브 편입 결과가 아직 없다. 통합 검수는 별도 대기다.
