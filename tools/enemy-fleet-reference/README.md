# Cloudstitch · 첨부 컨셉 기반 적 함선6종

사용자가 제공한6패널 함선 시트를 기준으로, 서로 다른 외곽 형태·기낭·장갑·크레인·수리 공방·찢어진 천을 독립3D 메시와 리그로 구성한 새 제작판이다. 실제 GLB6개를 `outputs/enemy-fleet-reference-v1/`에 보관한다. 기존 `fleet-v1`, `fleet-v2`, 전체 함대 비교와 원화는 보존한다. 첫6개 출력의 정식 구조 검사와 실제 정지 캡처를 완료했으며, 시각 검토에서 발견한 교단·망령2모델의 보완분은 **재내보내기·재확인 대기 중**이다. 세밀한 UI 브라우저 QA와 최종 READY도 대기 중이다.

## 확인할 파일

| 경로 | 내용 |
|---|---|
| `outputs/enemy-fleet-reference-v1/index.html` |6척 갤러리·첨부 그림의 대응 패널과 실제 모델 비교 |
| `outputs/enemy-fleet-reference-v1/ships/<id>.html` | 해당 GLB·렌더러·크기 비교용 귀환호를 내장한 개별 뷰어 |
| `outputs/enemy-fleet-reference-v1/ships/<id>.glb` | 독립3D·재질·텍스처·리그·애니메이션 |
| `outputs/enemy-fleet-reference-v1/reference.png` | 사용자가 제공한 기준 시트 보존본 |
| `outputs/enemy-fleet-reference-v1/painted-atlas.png` | 이번 제작에 사용하는 새 손그림 재료 아틀라스 |
| `outputs/enemy-fleet-reference-v1/catalog.json` | ID·원문 모듈 명세·제작 수량·약점 노드·특징·해시·현재 상태 |
| `outputs/enemy-fleet-reference-v1/previews/` | 실제 GLB 캡처용 경로. 최종 캡처 수와 해시는 통합 담당 기록 참조 |
| `outputs/enemy-fleet-reference-v1/structural-verification.json` | 첫6개 출력의 정식 구조 검사 결과. 보완2모델 반영 후 다시 확인 필요 |
| `outputs/enemy-fleet-reference-v1/capture-receipt.json` | 실제 정지6장·실루엣6장·위장 전개1장 캡처 기록 |
| `outputs/enemy-fleet-reference-v1/README.txt` | 사용자 열람 안내와 검증 상태 |

개별 HTML은 모델과 런타임을 내장하며, 갤러리는 같은 출력 폴더의 기준 PNG·캡처·뷰어를 상대 경로로 읽는다. 생성된 폴더 구조를 유지해 로컬 브라우저에서 연다. 외부 CDN을 사용하지 않는 구성이다. 실제 외부 요청 없음·파일 로딩·조작 통과 여부는 최종 브라우저 검사로 별도 확인한다.

##6척의 구별

| ID | 함선 | 주요 외형 | 약점 표시의 의도 |
|---|---|---|---|
| `enemy-pirate-scout` | 해적 정찰선 | 황토 기낭·뾰족한 목재 스키프·붉은 충각/지느러미·해골 깃발·큰 황동 엔진·낮은 개방 조타대 | 노출 후방 엔진 |
| `enemy-cult-blockade` | 교단 봉쇄선 | 검은 격자 판금 절벽·높이 다른 수직 봉인통·흰 장막2장·좁은 중앙 종·측면 포대 | 후방 추진부·종 지지대 |
| `enemy-union-salvage` | 연합 인양선 | 청록 기낭·큰 케이블 드럼·대각 철골 크레인·세 발 집게 | 케이블 드럼·인양 장치 |
| `enemy-union-repair` | 연합 수리선 | 창이 많은 긴 작업 공방·푸른 깃발·관절 수리팔·따뜻한 작업등·늘어진 케이블 | 수리 장치 |
| `enemy-ghost-chaser` | 망령 추격선 | 길고 가는 창선수·회색 누더기 기낭·찢긴 천·노출 골조·차가운 잔광 | 측면 연결부 |
| `enemy-disguised-wreck` | 위장 잔해선 | 무너진 폐목재·처진 천 외피·안쪽 기낭/함포/엔진·전개하는 외피 | 은닉 추진부 |

약점의 정확한 이름과 대상 노드는 각 GLB의 `userData.weakpoints` 및 카탈로그를 따른다. 뷰어의 ‘약점 위치 보기’는 해당 노드에 시각 표식을 붙인다. 실제 피해 판정·절단·회수·AI·약점 배율·충돌은 기존 전투에 연결하지 않았다. 표시된 약점이나 함포 동작이 실제 전투 기능의 완료를 뜻하지 않는다.

공통7클립 `FloatIdle`, `Cruise`, `BankTurn`, `GustRecovery`, `TurretScan`, `WinchCycle`, `FireBurst`를 사용한다. 위장 잔해선에는 외피 리그를 여는 `AmbushReveal`이 추가된다. ‘위장 상태/기동 전개’는 외형 자세 시범이며 잠복 탐지·기습 발동·공격/피해 상태를 바꾸지 않는다. 실제 클립 재생과 지원 동작은 최종 뷰어 검사에서 확인한다.

## 재현 소스와 명령

- `kit.js`: 새 재료 로딩·공통 기하 도구·엔진/포대·정점 명암. 기존 선체/기낭 저수준 도구를 읽기 전용으로 재사용한다.
- `scout-cult.js`, `industrial.js`, `ghost-wreck.js`: 서로 다른6척의 형상과 약점 메타데이터.
- `export.js`: 조립·이름/약점 노드 검사·기존 리깅 도구 재사용·GLB 내보내기.
- `build.cjs`: 새 GLB 생성·카탈로그·개별 뷰어·갤러리 작성.
- `viewers.cjs`, `viewer-base.js`, `viewer-template.html`, `enhance.js`:3표시 모드·윤곽선·7클립·약점/전개·크기 비교 뷰어.
- `gallery.cjs`, `gallery-template.html`:6척 목록과 기준 그림 비교.
- `capture.cjs`, `verify.mjs`: 실제 작성·실행된 캡처와 정식 구조 검사 도구. 첫6개 출력 검사/촬영을 완료했으며 보완2모델의 재내보내기 후 재실행이 필요하다.
- `browser-qa.cjs`: 작성 READY. 로딩·조작·클립·약점/전개·모바일·갤러리 iframe 수를 확인하는 세밀 UI 검사이며 아직 실행하지 않았다. 정확한 회전 잔상 픽셀 회귀는 이 도구의 범위 밖이다.
- `seal.cjs`: 준비된 최종 인계 도구. 기존 동결 패키지 보존·최종 보고서·파일 해시를 기록하며 최종 실행/READY 판정은 통합 담당이 맡는다.

Node.js20 이상과 기존 `three`, `esbuild`, `playwright` 의존성 및 준비된 브라우저를 사용한다. 통합 담당은 기존 설치 또는 외부 런타임을 사용할 수 있다. 필요하면 해당 환경의 `NODE_PATH`를 설정하되 머신별 절대 경로·계정별 캐시를 문서/저장소에 고정하지 않는다. 공통 package/잠금 파일 변경이나 의존성 설치는 이 문서의 작업에 포함하지 않는다.

저장소 루트에서 실행한다.

```sh
node tools/enemy-fleet-reference/build.cjs
node tools/enemy-fleet-reference/build.cjs --ids=enemy-pirate-scout,enemy-cult-blockade
node tools/enemy-fleet-reference/build.cjs --resume
node tools/enemy-fleet-reference/viewers.cjs
node tools/enemy-fleet-reference/gallery.cjs
```

첫 출력에서 실행한 캡처/구조 검사 명령과, 통합 담당이 예약 순서에 따라 실행할 UI QA/최종 인계 명령은 다음과 같다. 보완2모델의 재내보내기와 캡처/구조 재검사를 마친 뒤 최종 보고서로 판정한다.

```sh
node tools/enemy-fleet-reference/capture.cjs
node tools/enemy-fleet-reference/verify.mjs
node tools/enemy-fleet-reference/browser-qa.cjs
node tools/enemy-fleet-reference/seal.cjs
```

`build.cjs`는 생성용 로컬 builder 페이지에서 `GLTFExporter`를 실행한다. 생성에 사용한 브라우저와 PNG 캡처는 최종 상호작용·잔상·모바일·지속 실행 QA와 구별한다. 생성 중간 파일은 `work/enemy-fleet-reference/`에 둔다. `--resume`는 기록된 파이프라인/결과 해시가 같은 자산을 재사용한다. 원문 모듈이나 읽기 전용 공통 도구가 달라지면 재개 캐시만으로 갱신 완료를 판단하지 않는다.

## 원문·수량·생성 기록

6척은 기존 `tools/fleet/catalog.json`의 동일 ID를 사용한다. 원문09/25/65는 역할과 재료를 정하며, 이6항목의 `modules` 수량은 `null`이다. 카탈로그/GLB의 `confirmedModules`는 이를 유지한다. 탱크4개·측포3문·기낭1개 등 실제로 보이는 수는 첨부 그림을 재해석한 `artModules`다. 기획의 확정 수나 새 전투/밸런스 명세로 채택하지 않는다.

이번 신규 재료 생성은 **내장 이미지 생성1건**, **Meshy 호출0건**이다. `painted-atlas.png`를 새로 만들고 소스가 독립3D 기하를 조립했다. 생성 기준 이미지는 `reference.png`로 보존한다. 기존 유료 모델을 덮어쓰거나 새 유료 Meshy 생성을 실행하지 않았다.

## 현재 검증 상태와 한계

| 항목 | 상태 |
|---|---|
|6척 GLB 생성·개별 뷰어/갤러리 파일 작성 | 완료. 교단 판금/종·망령 균열/찢김 보완2개를 재내보내고 갤러리 반영 |
| 최종6개 정식 구조 검사 | PASS · `structural-verification.json`: 실제43클립·약점12노드·고유 기하6개·유한 float 5,138,264값·외부 리소스 URI0 확인. 브라우저 요청 검사와 구별 |
| 실제 PNG 캡처 | 정지6장·실루엣6장·위장 전개1장, 총13장과 종합판2개. 보완2개도 재캡처했고 catalog의6개 previewSourceSha256이 실제 GLB와 일치. capture-receipt는 마지막2개 캡처 실행 기록 |
| 기준 그림과 시각 검토 | 첫6개에서 판금 가림·약한 잔광을 발견해 수정, 최종2개 실제 렌더로 확인. 원화 장식 밀도/손그림 완성도 최종 사용자 승인 별도 |
| 최종6개 규모 | 256,240삼각형·GLB 51,692,264바이트. 성능 예산 미확정 |
| 세밀 UI 브라우저 QA | `browser-qa.cjs` 작성 READY·미실행. 모드/회전/클립/약점/AmbushReveal/모바일/외부·실패 요청의 최종 통과를 주장하지 않음 |
| 독립 회전 잔상 픽셀 회귀 | not-run. `autoClear=true` 소스 유지와 실제 잔상 회귀 통과를 구별 |
| 최종 파일/해시 봉인·READY | `seal.cjs` 준비·최종 실행 대기. 최종 결과는 통합 담당 기입 |
| 실제 전투·피해·절단·AI·밸런스 | 미연결·미검증 |

좌표는 -X 전방·+Y 위의 임시 아트 LU다. 실미터·엔진 소켓 규격·최종 충돌 크기로 쓰지 않는다. 변경된 선체·피벗·무장 때문에 기존 battlefield 충돌·muzzle/socket·조준점·포각·분리 트리를 자동으로 대체하지 않는다. 손그림·셀 명암·윤곽선은 뷰어 표현이며 다른 엔진에 GLB를 넣는 것만으로 자동 재현되지 않는다. `OutlineEffect.autoClear = true`를 유지한다.

첨부 그림과 선택 귀환호의 손그림 완성도에 어느 정도 도달했는지는 실제 캡처와 사용자 검토가 필요하다. 구조 검사만으로 아트 품질·역할 가독성·성능을 통과했다고 기록하지 않는다. PNG/GLB는 저장소 LFS 규칙을 따르고, 큰 내장 HTML은 커밋 전 별도 LFS 추적을 확인한다. work/node_modules/캐시/ZIP은 커밋하지 않는다.
