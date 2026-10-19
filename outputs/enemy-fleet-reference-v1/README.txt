Cloudstitch · 첨부 컨셉 기반 여섯 적 함선
기준일: 2026-10-18

사용자가 제공한6패널 시트의 실루엣·재료·약점 그림을 기준으로 서로 다른 독립3D GLB6개를 만든 외형 제작판입니다.
기존 함대v1/v2·전체 함대 비교·원화는 보존합니다.
첫6개 출력의 정식 구조 검사와 실제 정지 캡처를 완료했습니다.
시각 검토에서 발견한 교단·망령2모델의 보완분은 재내보내기/재확인 대기 중입니다.
세밀 UI 브라우저 QA와 최종 READY는 아직 대기 중입니다.

보기
- index.html:6척 갤러리, 첨부 그림의 해당 패널과 실제 모델 비교
- ships/<id>.html: GLB와 렌더러를 내장한 개별3D 뷰어
- ships/<id>.glb: 독립3D 메시·재질·텍스처·리그·애니메이션
- reference.png: 사용자 기준 시트 보존본
- painted-atlas.png: 새 손그림 재료 아틀라스
- catalog.json: 실제 ID·특징·약점 노드·제작 수량·해시·현재 상태
- previews/: 실제 GLB 캡처용 경로. 최종 파일과 검증은 통합 담당이 기록합니다.
- structural-verification.json: 첫6개 출력 구조 PASS 기록. 보완2모델 반영 후 재확인 필요
- capture-receipt.json: 실제 정지6장·실루엣6장·위장 전개1장 촬영 기록

폴더 구조를 유지해 index.html 또는 개별 뷰어를 로컬 브라우저에서 엽니다.
개별 HTML은 모델/런타임/비교용 귀환호를 내장하고 갤러리는 로컬 상대 경로를 사용합니다.
외부 CDN 없이 구성했으며, 실제 요청·로딩·조작 통과는 최종 브라우저 검사에서 별도로 확인합니다.

여섯 척
1. 해적 정찰선 / enemy-pirate-scout
   황토 기낭, 뾰족한 목재 배와 붉은 충각/지느러미, 해골 깃발, 큰 황동 후방 엔진, 개방 조타대.
2. 교단 봉쇄선 / enemy-cult-blockade
   검은 격자 판금 절벽, 높이 다른 수직 봉인통, 흰 장막, 좁은 중앙 종과 측면 포대.
3. 연합 인양선 / enemy-union-salvage
   청록 기낭, 큰 케이블 드럼, 대각 철골 크레인과 세 발 집게.
4. 연합 수리선 / enemy-union-repair
   긴 작업 공방과 푸른 깃발, 관절 수리팔, 따뜻한 작업등과 케이블.
5. 망령 추격선 / enemy-ghost-chaser
   긴 창선수, 회색 누더기 기낭과 찢긴 천, 골조 사이 차가운 잔광.
6. 위장 잔해선 / enemy-disguised-wreck
   폐목재와 처진 천 외피 안에 기낭·함포·엔진을 숨긴 배. 외피가 벌어지는 리그를 포함합니다.

약점과 움직임
‘약점 위치 보기’는 GLB의 실제 대상 노드에 시각 표식을 붙입니다.
후방 엔진·드럼·수리 장치·측면 골조 등은 그림의 공략 의도를 보여주는 표시입니다.
실제 피해·약점 배율·절단·회수·충돌·기습 AI와는 연결하지 않았습니다.

기본7클립: FloatIdle / Cruise / BankTurn / GustRecovery / TurretScan / WinchCycle / FireBurst.
위장 잔해선에는 AmbushReveal이 추가됩니다.
‘위장 상태/기동 전개’는 외피 리그 자세 시범이며 잠복 탐지·기습 발동·사격/피해 상태를 변경하지 않습니다.
실제 클립/버튼 동작은 최종 브라우저 검증 대기 항목입니다.

제작과 원문 수량
이번 신규 재료 생성: 내장 이미지 생성1건, Meshy 호출0건.
painted-atlas.png를 새로 만들고 재사용 가능한 소스가 독립3D 기하를 조립했습니다.
6척은 기존 함대 카탈로그의 동일 ID이며, 원문09/25/65의 역할을 유지합니다.
이6항목의 원문 modules 수량은 null(미정)이고 카탈로그/GLB confirmedModules에 이를 보존합니다.
화면의 탱크·포·기낭 수량은 artModules의 제작 해석입니다. 기획 확정 수량·최종 밸런스가 아닙니다.

소스와 재현
저장소 루트 기준 tools/enemy-fleet-reference/README.md에서 상세 내용을 확인합니다.
build.cjs는 새 GLB/개별 뷰어/갤러리를 생성합니다.
viewers.cjs와 gallery.cjs는 각각 뷰어와 갤러리를 갱신합니다.
capture.cjs와 verify.mjs는 실제 작성/실행된 캡처·정식 구조 검사 도구입니다.
첫6개 출력 검사/촬영을 마쳤으며 보완2모델 재내보내기 후 재실행이 필요합니다.
browser-qa.cjs는 작성 READY이고 세밀 UI 검사 실행은 대기 중입니다.
seal.cjs는 최종 파일 해시/기존 동결 패키지 보존/보고서 인계를 위해 준비됐으며 root가 최종 READY를 마감합니다.

node tools/enemy-fleet-reference/build.cjs
node tools/enemy-fleet-reference/build.cjs --ids=enemy-pirate-scout,enemy-cult-blockade
node tools/enemy-fleet-reference/build.cjs --resume
node tools/enemy-fleet-reference/viewers.cjs
node tools/enemy-fleet-reference/gallery.cjs

첫 출력에서 실행한 캡처/구조 검사와 통합 담당이 순차 실행할 UI QA/최종 인계 명령:
node tools/enemy-fleet-reference/capture.cjs
node tools/enemy-fleet-reference/verify.mjs
node tools/enemy-fleet-reference/browser-qa.cjs
node tools/enemy-fleet-reference/seal.cjs

Node.js20+와 기존 three/esbuild/playwright 런타임을 사용합니다.
통합 담당은 외부 의존성 런타임과 NODE_PATH를 사용할 수 있습니다. 머신별 경로를 문서에 고정하지 않습니다.
생성용 브라우저 실행·PNG 캡처·구조 검사는 실제 조작/잔상/모바일/지속 실행 QA와 구별합니다.

현재 상태 — 통합 담당 최종 기입
-6척 GLB·뷰어·갤러리: 생성 완료. 교단 판금/종·망령 균열/찢김 보완2개도 재내보내기·대표 렌더 반영 완료
-최종6개 출력 정식 구조: PASS. 실제43클립, 약점12노드, 고유 기하6개, 유한float 5,138,264값, 외부 리소스 URI0
-구조 검사의 외부URI0은 실제 브라우저 네트워크 요청0을 뜻하지 않습니다.
-실제 PNG: 정지6장·실루엣6장·위장 전개1장, 총13장 촬영 완료. 종합판 생성
-시각 검토: 첫6개에서 발견한 판금 가림과 약한 잔광을 수정했고, 보완2개를 재캡처해 확인. 원화의 장식 밀도/손그림 완성도에 대한 최종 사용자 승인은 별도
-최종6모델 합계: 256,240삼각형 / GLB 51,692,264바이트. 게임 성능 예산은 미확정
-세밀 UI browser-qa.cjs: 작성 READY·미실행. 모드/회전/클립/약점/전개/모바일/요청 검사 최종 통과를 주장하지 않음
-독립 회전 잔상 픽셀 회귀: not-run. autoClear=true 소스 유지와 검사 통과를 구별
-seal.cjs 최종 파일/해시 봉인과 READY: 준비·최종 실행 대기, 통합 담당 기입
-실제 전투·피해·절단·AI·밸런스: 미연결·미검증

한계
-좌표는 -X 전방/+Y 위의 임시 아트LU이며 실미터·충돌·소켓 규격은 미확정입니다.
-기존 battlefield 충돌·muzzle/socket·조준점·포각·분리 트리는 자동 대체하지 않습니다.
-손그림·셀 명암·윤곽선은 뷰어 런타임 표현입니다. GLB의 다른 엔진 임포트만으로 같은 효과를 보장하지 않습니다.
-OutlineEffect.autoClear = true를 유지합니다.
-첨부 그림/선택 귀환호 수준의 손그림 품질과 게임 거리 역할 식별은 실제 화면/사용자 검토가 필요합니다.
-구조 검사를 시각 품질·게임 재미·최종 성능 검증으로 확대하지 않습니다.
-PNG/GLB와 큰 내장 HTML의 Git LFS 규칙을 확인합니다. 원본·공통 의존성·이전 문서는 변경하지 않습니다.
