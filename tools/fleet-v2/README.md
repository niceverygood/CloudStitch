# Cloudstitch · 서로 다른 하늘의 함대 v2

주인공·일반 적·보스가 같은 선체와 선장실을 반복하던 v1의 외형을 개선하는 별도 제작판이다. 교단의 절벽 같은 장갑과 종실, 연합의 크레인과 열린 수리 도크, 망령의 긴 파손 선체와 찢어진 천, 거대한 보스 시설을 서로 다른 구조로 만든다. 원화의 감성과 큰 색면을 목표로 하며, 최종 손그림 아트 품질의 승인이나 전투 구현 완료를 뜻하지 않는다.

## 보기

- 새 갤러리: `outputs/fleet-v2/index.html`
- 개별 3D 뷰어: `outputs/fleet-v2/ships/<id>.html`
- 개별 GLB: `outputs/fleet-v2/ships/<id>.glb`
- 실제 모델 캡처: `outputs/fleet-v2/previews/<id>.png`, `<id>-silhouette.png`
- 대표13항목 비교판: `outputs/fleet-v2/fleet-overview.png`, `silhouette-sheet.png`

개별 HTML은 렌더러·해당 GLB·크기 비교용 귀환호를 내장한다. 생성 완료 후 로컬 브라우저에서 열 수 있으며, 갤러리는 로컬 상대 경로를 사용한다. 갤러리의 이전 v1/새 v2 전환은 선택한 뷰어 한 개만 표시한다. 파일이나 캡처가 준비되지 않았거나 모델 해시와 캡처 해시가 다르면 준비 중으로 표시한다. 생성된 실제 파일 수와 검증 결과는 [HANDOFF.md](HANDOFF.md)의 최종 기록을 따른다.

뷰어는 회전·확대·초기화·화면 맞춤·자동 회전, 앞/옆/위 시점, 실루엣 표시, 귀환호와의 상대 크기 비교, 손그림·셀 명암·원본 재질3모드, 윤곽선·뼈대 표시, 재생/정지·시간 탐색·속도 조절을 제공한다. `OutlineEffect.autoClear = true`를 유지해야 한다. 셀 셰이딩과 윤곽선은 뷰어 런타임 표현이며 GLB 임포트만으로 다른 엔진에 자동 재현되지 않는다.

## 범위와 원본

카탈로그의71항목 중 초기 `design-a1`~`design-c3` 디자인 대안9개를 제외한62항목을 유지한다.62는 고유 정사 함선 종류 수가 아니다. 귀환호의 장비 구성과 결말 상태, 세력 스타일, 역할/임무 슬롯, 기록형, 미완성 골격, 지원정과 보스 시설을 포함한다. 선택 귀환호 보존1개와 새 외형 대상61개가 제작 범위다.

`player-homeward`의 v2 바이너리는 **`outputs/fleet-v1/ships/player-homeward.glb`의7클립 리그 파생본을 바이트 동일 복사**한다. 이 파일은11,986삼각형·4,675,348bytes인 v1 자산이다. `outputs/selected-airship-toon3d/airship.glb`의11,026삼각형·단일 메시 원형을 그대로 복사한 것이라는 뜻이 아니다. 선택 원형의 시각과 텍스처를 이어받은 기존 리그 자산이며, 두 원본 파일 모두 변경하지 않는다.

`tools/fleet/`, `outputs/fleet-v1/`, 선택선 원형, 원화, 초기 디자인 대안은 보존한다. v2는 기존의 카탈로그·수작업 질감 아틀라스·장치/리깅 코드를 읽기 전용 의존성으로 재사용한다. 소스 재빌드에는 이 원본들이 필요하다.

각 GLB는 `FloatIdle`, `Cruise`, `BankTurn`, `GustRecovery`, `TurretScan`, `WinchCycle`, `FireBurst`7클립을 내장하는 계약이다. 무장이 없는 배나 시설에서 모든 이름이 실제 포탑/사격 기능을 뜻하지는 않는다. 뷰어는 `availableActions`와 시설 맥락에 따라 가능한 장치 동작을 표시한다. 실사격·피해·AI·회수·승리 판정은 이 동작 시연에 포함되지 않는다.

## 재현

저장소 루트에서 Node.js20 이상과 기존 `package.json`/잠금 파일의 `three`, `esbuild`, `playwright`를 사용한다. npm 설치와 브라우저 준비는 통합 담당이 맡는다. 계정/머신의 `NODE_PATH`나 캐시 경로를 소스·문서에 고정하지 않는다. 기존 `tools/lib/runtime.cjs`는 준비된 Playwright Chromium을 우선 사용하고, 설정한 브라우저나 시스템 Chrome/Edge를 대안으로 찾는다.

```sh
# 전체62항목 생성
node tools/fleet-v2/build.cjs

# 먼저 대표8항목 또는 프로필 대표항목만 생성
node tools/fleet-v2/build.cjs --core
node tools/fleet-v2/build.cjs --showcase

# ID를 지정해 생성; 등호와 쉼표 사용
node tools/fleet-v2/build.cjs --ids=enemy-cult-blockade,boss-bell-devourer

# 동일 빌드 해시와 파일 해시가 맞는 결과 재사용
node tools/fleet-v2/build.cjs --resume

# 실제 모델·실루엣 PNG와 대표13항목 비교판 캡처 (빌드 종료 후 실행)
node tools/fleet-v2/capture.cjs
node tools/fleet-v2/capture.cjs --ids=enemy-cult-blockade,boss-bell-devourer

# 카탈로그로 갤러리만 갱신
node tools/fleet-v2/gallery.cjs

# 새 GLB 구조 검사: --ids 다음 공백 사용
node tools/fleet-v2/verify.mjs --ids player-homeward,enemy-tax-cutter
node tools/fleet-v2/verify.mjs

# 통합 담당의 예약된 단일 브라우저 QA (프리뷰 생성과 구별)
node tools/fleet-v2/browser-qa.cjs

# 현재 파일을 실제 SHA로 봉인; 빌드/캡처/문서 갱신 종료 후 실행
node tools/fleet-v2/snapshot.cjs
```

빌드는 `export.js`를 로컬 builder HTML로 묶은 뒤 브라우저 안의 `GLTFExporter`로 GLB를 만든다. 이 **생성용 브라우저 실행은 브라우저 QA가 아니다.** 캡처도 해당 화면의 렌더 성공을 보여줄 뿐 상호작용·잔상·모바일·지속 실행 검사를 대신하지 않는다. 무거운 전체 생성/캡처와 브라우저 QA는 통합 담당이 순차 실행한다. 중간 builder와 캡처 페이지는 `work/fleet-v2/`에 둔다.

`--resume`는 파이프라인/프로필/원문 모듈 정보 및 기존 결과 해시를 기준으로 한다. 재사용하는 v1 아틀라스나 장치/리깅 코드가 바뀌었을 때는 캐시 판단에만 의존하지 말고 대상 모델을 새로 생성한다. 새 모델이 생성되면 이전 캡처의 `previewSourceSha256`가 달라져 갤러리가 오래된 PNG를 준비 중으로 처리한다.

## 좌표·통합 제한

신규 프로시저 모델은 **-X 전방·+Y 위**, X길이·Z폭을 사용한다. 보존 귀환호는 기존 축과 리그를 그대로 유지한다. `fleet-kit`의 LU는 외형 제작용 임시 단위이며 실제 미터·최종 이동/충돌 규격이 아니다. 화면 맞춤은 각 모델을 정규화하므로 보스의 제작용 상대 크기는 귀환호 비교를 켜서 판단한다. 이 비교에서도 귀환호를 시각 기준10단위로 맞춘 해석이며 전투 크기 확정이 아니다.

카탈로그 `bounds/observedBounds`는 기본 POSITION에 노드 변환을 적용한 정지 경계다. 스키닝·애니메이션 변형·전투 충돌·카메라 가독성·성능 검증을 뜻하지 않는다. 변경된 피벗·외곽·크레인·기낭 때문에 **기존 battlefield 충돌, muzzle/socket, 조준점, 분리 골조를 자동으로 v2 외형에 대체하지 않는다.** 실제 통합 전에 좌표 변환·장착/발사 소켓·충돌·가림을 다시 매핑해야 한다. 현재 battlefield의 상태·시간·사격·피해 소유권은 그대로 유지한다.

`modules`의 정수와 미정 `null`은 원문 카탈로그에서 유지한다. `artModules`는 뷰어 배치 제안이며 정수를 덮어쓰지 않는다. 형태 계열·랜드마크·실루엣 문구는 제작 의도다. 선언과 기하 서명이 있다는 사실만으로 역할 식별이나 손그림 완성도가 통과한 것은 아니다. 실제 전투와 밸런스는 이번 외형 제작에서 검증하지 않았다.

## 보관

PNG·GLB는 저장소 `.gitattributes`의 LFS 규칙을 따른다. 모델과 귀환호를 동시에 내장하는 개별 HTML도 커질 수 있으므로 **커밋 전에 크기 확인과 `outputs/fleet-v2/ships/*.html`의 LFS 추적 설정이 필요**하다. 현행 전역 PNG/GLB 규칙만으로 새 HTML까지 LFS가 적용되지는 않는다. 이 담당 문서는 `.gitattributes`를 변경하지 않는다. `work/`, node_modules, 캐시, ZIP은 커밋하지 않으며 새 푸시·배포는 별도 사용자 요청 범위에 따른다.

설계는 [DESIGN.md](DESIGN.md), 구조 검사 해석은 [QA.md](QA.md), 최종 준비 상태는 [HANDOFF.md](HANDOFF.md)를 따른다.
