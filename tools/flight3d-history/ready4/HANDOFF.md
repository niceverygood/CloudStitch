# Cloudstitch · 3D 자유 비행

2026-10-18 READY-4. 최신 사용자 요청은 화면을 잡아 카메라를 돌리는 조작을 추가하는 것이다. 제품 URL은 `http://127.0.0.1:8860/outputs/flight3d-v1/index.html`이다.

## READY4 변경과 사용

- 왼쪽 버튼으로 화면/배를 잡아 6 CSS px 이상 끌면 시점이 회전한다. 오른쪽·가운데 버튼과 터치 드래그도 회전한다. 휠 거리와 상단 뒤에서 보기 버튼은 유지한다.
- 왼쪽 버튼을 거의 움직이지 않고 놓으면 한 발을 쏜다. 누르는 순간에는 발사하지 않아 길게 잡았다가 회전해도 의도하지 않은 첫 발이 나오지 않는다. 이전 왼쪽 길게 누르기 연사는 이 잡기 조작으로 바뀌었고, **J 또는 화면 사격 버튼**은 연속 사격을 유지한다.
- 활성 포인터 하나를 캡처한다. 다른 손가락/다중 마우스 버튼의 해제가 원래 잡기를 끊거나 사격으로 바꾸지 않도록 pointerId·buttons를 검사한다. 취소·캡처 상실·일시정지·초점 이탈·초기화는 잡기/대기 사격을 해제한다. 잡기 커서와 안내를 갱신했다.
- W/S 전후진, A/D 선회, Q/E 상승/하강, Shift 가속, Space 제동 및 READY3 부유·관성·카메라 물리는 그대로다. `sim.mjs`, 시뮬레이션/카메라/항로 테스트와 `renderer.js`를 변경하지 않았다.

READY3의 소유 파일29개와 원 manifest는 `tools/flight3d-history/ready3/`·`outputs/flight3d-ready3/`에 원바이트로 보존했다. `outputs/flight3d-ready3/preservation.json`의 경로 대응·SHA30개로 검사한다. 이전 실행은 `outputs/flight3d-ready3/index.html`, 진짜 READY3 브라우저20 근거는 `outputs/flight3d-ready3-browser-qa-v1/`이다. 그 폴더 안의 역사17 보고서를 READY3/4 근거로 주장하지 않는다. 보존된 빌드 스크립트는 canonical 출력 경로를 포함하므로 archive에서 실행하지 않는다.

READY4의 입력 변경 검사는 `verify-grab-browser.cjs`의20개 체크, 결과는 `outputs/flight3d-ready4-browser-qa-v1/`에만 쓴다. 좌잡기/클릭/우·가운데/실제 캡처 상실·다중 버튼/Esc·키보드 reset/J 고도 표적/실제 CDP 터치·버튼 연사를 검사한다. DOM pointercancel·blur는 주입한 이벤트 경로 검사이며 실제 탭 숨김은 이번 범위에서 생략했다. READY3의20·READY2의17은 덮어쓰지 않는다. 소스 보존 검사는6건이며 기존37건의 물리 검사는 해당 파일의 SHA가 그대로인 READY3 증거다. 새 실제 브라우저 결과는 인계 시점 별도 보고서로 결속한다. 구현은 로컬 비행 시제품이며 사람의 조작감·장시간 성능·실기기 검증, 항구·캠페인·저장 연결은 후속 범위다.

상시 아트 기준 `docs/ART_DIRECTION.txt`를 적용한다. 이번은 입력/커서/안내 변경이므로 크림색 천·꿀빛 목재·청록·황동의 기존 선택선, 손그림 셀 명암·윤곽과 감쇠 부유 표현을 보존했다. 새 시각 자산/유료 생성은0이며 원 GLB·재료·풍경을 다시 만들지 않았다. 실제 렌더 확인은 새 브라우저 보고서/캡처 범위이고 이 입력 수정이 자산 전체의 미술 승인을 뜻하지 않는다.

---

## READY3 인계 당시 기록

2026-10-18 READY-3. 최신 사용자 요청: 조작을 더 직관적으로 하고, 정지 중에도 떠 있는 느낌과 이동할 때 관성·휘청임을 더한다.

## 실행과 조작

`node tools/levels/playable-serve.mjs`의 기존 outputs 서버에서 `http://127.0.0.1:8860/outputs/flight3d-v1/index.html`을 연다. 이미8860 서버가 있으면 새 서버를 띄우지 않는다.

- W/S: 배가 향하는 방향으로 전진/후진. A/D: 왼쪽/오른쪽 선회. 카메라 기준 횡이동에서 선체 기준 조타로 바뀌었다.
- Q/E: 상승/하강. Shift: 전진 가속. Space: 관성을 빠르게 줄이는 제동.
- 왼클릭/J: 현재 마우스의3D 조준점으로 사격.
- 오른쪽 드래그: 자유롭게 둘러보기. 정지 중에는 그 시점을 유지하고, 이동·선회하면 잠시 후 뒤쪽 시점으로 부드럽게 돌아간다. 휠은 거리, 상단⌖는 뒤에서 보기다.
- Esc:일시정지. ↻:새 비행. 적 공격은 기본OFF이며 필요할 때 상단에서 켠다.
- 터치는 ▲▼전후진/↶↷선회와 오른쪽 상승·하강·사격·가속 버튼을 사용한다.

서로 다른 고도에 있는5개 고리와 표적5척은 기존3D 실험 구성을 유지한다. 고리 고도는8→26→-6→38→8이다. 현재 중심 거리와 고도를 모두 검사하며 캠페인·인양·항구·영구 저장과는 연결하지 않았다.

## 변경

`sim.mjs`의 선택 `input.helm={throttle,turn,rise,brake}`가 선체 기준 비행을 담당한다. 키를 놓은 프레임에도 `{helm:{}}`를 전달해 조타/속도 감쇠가 적용된다. 기존 `moveX/Y/Z`는 이전 회귀와 명시적 월드 입력을 위해 유지하지만 제품 앱은 두 방식을 함께 쓰지 않는다.

heading은 조타의 각속도로 적분한다. 최대 각속도0.6rad/s,각가속 응답2.8·해제감쇠3.8을 사용하며 속도 방향으로 즉시 꺾지 않는다. 전진14/후진7/가속22,고도11의 임시 속도다. 종·횡 방향 저항으로 선회할 때 기존 운동량이 천천히 휘고, 제동은 추진·조타·고도입력을 억제하며 속도/각속도를 초당7로 감쇠한다.

정지 부유와 가속 피치·선회 뱅크·충돌 휘청임은 동일 고정 시간 간격에서 감쇠 스프링으로 계산한다. `player.attitude`에 roll/pitch/heave와 각 속도를 보유한다. 정지 heave 목표진폭0.18·주기3.4초,상한heave0.35/roll0.15rad/pitch0.12rad다. 물리 XYZ/고리/탄환/카메라 기준점은 이 표시 흔들림과 분리한다. 정지 중에는 선체가 떠 있고 충돌 중심·고도계는 불필요하게 출렁이지 않는다.

renderer는 attitude를 한 번 적용하며 world vx에 따른 예전 기울기는 제거했다. 새 attitude.pitch는 Three Euler X각으로 직접 적용해 가속/상승 시 선수가 들린다. 후방 추적은 heading-π,자유보기는 별도 yaw offset이고 두 각도 모두 ±π는 짧은 각도로 보간/복귀한다. 마우스 조준은 기수/추적 카메라를 돌리지 않는다. focus/arm은 같은3D 장애물로 안전화하고 가까이 붙으면 선체를 잠시 감춘다. `OutlineEffect.autoClear=true`를 유지한다.

이는 질량·항력·감쇠를 단순화한 비행 감각 실험이다. 완전한 공력·부력/압력·중량중심·자유roll/역전 시뮬레이터를 구현했다고 하지 않는다.

## 보존과 자산

이전 READY-2 실행본은 `outputs/flight3d-ready2/index.html`에 별도 보존했다. 컴파일3파일·당시manifest·브라우저17보고서의 SHA는 `preservation.json`에 있다. 루트 통합 담당의 READY2 소스20/QA17 봉인도 그대로이며 새 검사는 별도namespace다. 원래 평면 전장25파일·카메라 비교20파일도 SHA가 동일하다.

GLB는 기존 `fleet-v1`의 player-homeward/ enemy-pirate-scout를 읽고 새 생성·패키지 설치·공유 소스 변경은 없다. delivery-manifest의 `files`는 소유한 새 flight3d 경로뿐이며 `dependencies`4개는 읽기 전용 로더·카탈로그·GLB의 SHA 비교용이다. 의존성을 복사해 원본을 덮어쓰지 않는다.

좌표는 임시단위,Y위,X/Z±110,Y-18..60이다. 충돌은 선체 구반경1.8/표적 구/섬 타원체·박스의 집계 프록시다. 잔디cap/원경/갑판/구름은 장식이다. 원본 포탑은 yaw만 표시하고 정확한3D pitch 포구 소켓은 연결하지 않았다. 실제 탄환은 sim의 프록시 발사점에서XYZ로 이동한다.

## 검사

- Node `sim.test.mjs`31/31:기존월드 입력20회귀+선체전후·조타각관성/미끄러짐·25/60/120FPS·idle bounded부유·가속/선회/충돌spring·정지freeze·Space제동11개. `camera-geometry.test.mjs`5/5도 통과했다.
- `helm-route.test.mjs`1/1:강제 위치 변경/기존월드입력 없이5고리를34.03초/충돌0/HP100으로 통과했다. 도달 가능성 검사이며 사람의 재미 판정이 아니다.
- `verify-source.mjs`5/5:UI34ID/29참조,단일상태소유,원래 전장25·카메라20·READY2 archive5파일 보존.
- 기존 사용자IAB 단일탭에서 READY3 reload/시작,조작표기/실제6GLB/부유자세와console0을 관찰하고 `preview-ready3-iab.jpg`를 저장했다. 단발 d/w는 지속조타 증거가 아니므로 아래 브라우저 검사와 구분한다.
- 최신 브라우저 검사는 준비 시점pending. `verify-helm-browser.cjs`가 실제W/S·A/D·Q/E·제동,보이는선체부유/뱅크,시점,고도표적명중과 모바일 등20개를 검사한다. `FLIGHT3D_URL`과 `FLIGHT3D_QA_OUT`으로 대상을 지정한다. 기본 결과 경로는 `outputs/flight3d-ready3-browser-qa-v1/`이다. 이전READY2의17통과를 새 조타 검증으로 복사하지 않는다.

실행 명령:

```sh
node --test tools/flight3d/sim.test.mjs tools/flight3d/camera-geometry.test.mjs tools/flight3d/helm-route.test.mjs
node tools/flight3d/verify-source.mjs
node tools/flight3d/build.cjs
node tools/flight3d/verify-helm-browser.cjs
```

장시간 성능·실기기·사람의 조작감/공정성,동적 적기동,고도AI,부품절단/인양/항구 저장은 후속 범위다.
