# 악당 외형 강화 · 새19 통합 / 신규13 소스 인계

사용자 최신 요청: 기존 적선을 훨씬 악당답게 만들고 세력과 기체의 캐릭터·특성을 과할 정도로 드러낸다. 공통 `docs/ART_DIRECTION.txt`의 따뜻한 수공예 판타지·손그림 같은3D·과장된 볼륨과 장식을 적용한다.

## 소유와 분업

- 이 채팅: `tools/enemy-fleet-gallery/villain-v1/` → `outputs/enemy-fleet-villain-v1/`. 새13개 형상과 새19개 통합 갤러리.
- 함대 담당: `outputs/enemy-fleet-reference-v2/`의 동일ID 기본6개. 새6개를 이 채팅에서 다시 생성하지 않는다.
- 기존 `enemy-fleet-gallery-v1/READY-r1.json`의17파일과 모든 원함대·원화·기존 검증은 보존한다.
- 공통package/lock/기존모델·진영·편성·sim·저장 쓰기0. 새유료/AI이미지생성0.

신규13 whitelist는 `build.cjs`와 `SOURCE_READY.json`에 고정한다. reference6의새catalog·실제GLB·preview·viewer가 준비되면 `gallery.cjs`가 읽기참조로 결합한다. 같은ID의 새버전을 독립19+6기체로 중복 계산하지 않는다. 보스 시설·임무 역할과 협상가능7항목의 기존 분류를 유지한다.

## 형태·재료·표현

신규13은 기존v2GLB·클립을 읽어, 각 선체의X길이를18상대단위로 해석한 좌표에 고유 입체 주역장치와 장식을 더하고 새GLB로 내보낸다. 실제미터·충돌크기 규격이 아니다. 기존텍스처·골조·클립을 이어받고 새추가형상은 기존 손그림 재료 아틀라스를 재사용한다.

- 징세정: 철제 집게턱·거대 봉인패·사슬 저울과 불균형 보강선체.
- 연합 경비선: 코뿔소 선수·장갑 망토·큰 돌출 측포대.
- 교량 견인정: 들소 같은 A프레임·이중 윈치·쌍갈고리.
- 경비 정찰선: 길게 갈라진 때까치 부리·검은 두꼬리·비대칭 신호탑·붉은 리본.
- 교단 정화선: 흰 봉인 아치·향로 탱크 열·검은 집행 구조.
- 망령 포격선: 쥐가오리 늑골 날개·척추 포신·파손천·푸른 혼등.
- 일반 포격 역할: 반달 포대·특대 중공 포신·두꺼운 반동 보강.
- 일반 방어 역할: 기체보다 넓은 삼층 수문방패·거대 자물쇠·작은 관제실.
- 장례 경비: 장례마차·관형 장갑·작은 종.
- 장례전함: 열린 종실·속 빈 거대 종·장례 왕관과 검은 충각.
- 살아 있는 조선소: 배가 통과할 수 있는 열린 감옥 늑골·현수 구조물.
- 조선공 지휘함: 크레인 왕좌·긴 해체팔·큰 원형 톱.
- 마지막 들숨: 1심장·3봉인탑 장치 정체성과 황동 조임 구조·비스듬한 왕관고리.

검은 철·진홍 천·마모 목재·황동과 차가운 망령색의 대비로 인상을 강화한다. PBR광택 대신 실제붓결 텍스처, 부드러운 정점명암, 뷰어의 단순 셀명암·읽히는 윤곽을 유지한다. 새장식은 실제장비수·피해·AI·시스템변경으로 취급하지 않는다.

## 현재 경량 검사와 실제 렌더 경계

`source-preflight.json`: 신규13의 합성 추가기하 생성 API를 실제 실행해 ID당 처리함수1·특징5개이상·유한정점/경계·이름중복0·누락재질0을 확인했다. 브라우저0·Exporter0·원본GLB읽기0이다. `build.cjs --prepare`의 전체 번들 파싱도 통과했다. 이는 원본과 합친 실제 외형·후면·장치 가림·예쁜 손그림·미술 승인 통과가 아니다.

최종실제GLB/클립/캡처/모드·조작·모바일·잔상·외부요청 검사는 통합의 예약된 단일 슬롯에서 진행해야 한다. 셀명암·윤곽은 뷰어 런타임이며 GLB만 다른엔진에 가져가 동일 표현을 보장하지 않는다. 원본뷰어 소스의 `OutlineEffect.autoClear = true`를 보존한다.

## 실행 순서 · 통합 단일 슬롯 전용

기존workspace esbuild/three와 Playwright를 NODE_PATH로 제공한다. 머신별경로는 소스에 고정하지 않는다. 설치와공통변경은 통합담당만 한다.

1. `node tools/enemy-fleet-gallery/villain-v1/build.cjs --prepare` : 번들만, 모델읽기0/browser0.
2. 대표5 먼저: `node tools/enemy-fleet-gallery/villain-v1/build.cjs --execute --ids=enemy-tax-cutter,mission-cult-purifier,mission-ghost-artillery,boss-bell-devourer,boss-last-inhale`.
3. 대표5 실제PNG: `node tools/enemy-fleet-gallery/villain-v1/capture.cjs --ids=enemy-tax-cutter,mission-cult-purifier,mission-ghost-artillery,boss-bell-devourer,boss-last-inhale`.
4. 담당이 실제 렌더를 보고 큰주역형태·부피·겹침·명중/약점가독성·원본대비를 확인한 뒤 나머지8: `build.cjs --execute --resume`. 소스변경 시 새pipeline hash로 갱신하므로 부분수정여부를 협의한다. 장례전함은 기존종 하단에 새종·종실을 정렬했고 마지막들숨은 기존1심장·3탑 위치에 장식랩핑하므로 이두개의 실제중복/가림을 우선확인한다.
5. `node tools/enemy-fleet-gallery/villain-v1/capture.cjs` : 신규13만 캡처. reference6은 함대owner의완료캡처를재사용한다.
6. reference6 READY후 `node tools/enemy-fleet-gallery/villain-v1/gallery.cjs` : 새19전부준비/캡처hash일치 때만 최종gallery작성. 미완료를이전외형으로몰래대체하지않는다.
7. `node tools/enemy-fleet-gallery/villain-v1/capture-gallery.cjs` : 실제19한장/이전새비교/390px검사. 그 뒤 통합의좁은실모델·3모드·윤곽·조작·클립·요청/잔상확인 결과를별도보고서에기록한다.

단계2~7은 브라우저·Exporter·새GLB/원본해시I/O가 있으므로 담당이 단독으로 실행하지 않는다. 기존68QA를자동중복하지 않고 새모델/새경로에 필요한범위를검사한다. 모델생성은 실제전투설치가 아니다.

`models.json`은이채팅새13, `catalog.json`은새6의읽기참조+새13+기존상황별7의통합목록이다. 현재소스인계와 최종실제파일READY를 구별하며 실제GLB가아직없다면 제작완료라고표시하지않는다. 기존capture/report를덮어쓰지않고 새폴더에보존한다.
