# Cloudstitch · 구름 속 여섯 항로 / spatial v1

## 사용자 요청과 실제 구현

사용자는 이미 만든 마우스 잡기 회전·줌의 3D 공간에 여섯 맵을 배치하라고 정정했다. 앞선 voyage-campaign-ready2의 기술 PASS를 이 공간 의도의 완료로 재사용하지 않는다.

- 화면 전체의 실제 perspective 3D 공간에 기존 여섯 지역의 GLB 지형·랜드마크와 항로·목적지·귀환 표식을 배치한다. 고정 시점의 카드 화면 대신 캔버스가 중심이고, 항구/창고와 항로 수첩은 위에 여는 서랍이다.
- 좌/우/가운데 잡기 또는 터치로 수평 360도·위/아래를 둘러본다. 휠은 거리 14~240, 전체 보기는 지역에 맞춤, ‘뒤에서’는 함선 시점으로 복귀한다. 왼쪽6 CSS px 미만 놓기는 단발, 드래그는 발사하지 않는다. J/사격 버튼은 연사다. WASD는 현재 카메라 방향의 XZ 항해다.
- 첫 화면부터 현재 지역의 공간을 볼 수 있다. ‘공간 둘러보기’의 여섯 미리보기는 표시만 바꾸고 잠금·함선·진행·저장을 변경하지 않는다. 출항/다음 단계/기록 불러오기는 현재 권위 항로로 돌아온다.
- READY4의 검증된 grab 정책과 perspective camera 수치, READY5의 동결 구름/공중소품/정원섬 환경을 읽기 재사용한다. READY5의 원 환경 browser15는 재사용 당시 대기 중이므로 검증 완료로 부르지 않는다. 원 manifest ab210425…에 포함된10파일을 원바이트 snapshot했다. source45 전체를 새로 제작/검수한 것으로 집계하지 않는다.

최신 따뜻한 수공예 판타지·손그림 같은2D 인상의3D와 ‘10배 이상 과감하고 풍성함’ 기준은 가까운 공중 생활 소품/구름층과 큰 원경/층진 정원섬의 깊이 대비로 재사용한다. 기존 원본/GLB/셀 재료를 보존하고 새 유료 생성0이다. 카메라 접속 작업을 모든 새 아트의 표현 목표나 사람의 미술 승인 완료로 표시하지 않는다.

## 단일 권위와 좌표

게임과 저장 권위는 기존 `tools/voyage-campaign/session.mjs`와 검증 checkout의 battlefield/encounter다. 원 controller·sim·원renderer·flight3d app은 수정하지 않는다. 두 번째 flight state/step/RAF를 시작하지 않는다. snapshot한 flight sim은 camera-geometry의 순수 distance/sweep 함수 의존성으로만 쓰며 비행 state나 시간을 만들지 않는다.

`spatial-contract.mjs`: Y-up, world XZ = 기존 지역 local XZ, 원점[0,0,0], 배율1, 실제 항해 높이Y0. 기존 물리의 XYZ 비행 채택/피해/장착/보상 변경은 없다. 지형의 높이·구름/소품은 실제3D 표시이고 기존 전투 이동/충돌은 XZ다. 지역의 실제 visual.position과 collider.center/halfExtents를 그대로 사용한다. 카메라는 같은 collider를 읽기 box로 바꿔 안전화한다. 카메라의 ray→Y0 plane→local XZ와 실제 GLB Muzzle의 world XZ가 같은 frame을 사용한다. 기존 실제 socket yaw 교정을 유지한다. 투사체/HP/위협/회수 위치를 카메라에 맞춰 재작성하지 않는다.

새 base-renderer는 frozen integration renderer의 소유 파생본이다. `provenance.json`의 출처 SHA와10개 snapshot 경계를 따른다. 원고정 카메라/원작업/기존 READY2·독립 stage-maps는 보존한다. actor 제거 때 기존 bridge의 정리, GLB 적재 차단과 `OutlineEffect.autoClear=true`를 유지한다.

## 저장

새 화면도 **같은 origin의 같은 `cloudstitch.voyage-campaign.v1`** 한 키만 사용한다. 새 별도 진행 키나 암묵적 이관/초기화가 없다. 기존 캠페인 저장을 그대로 읽고 같은 함선·장착품·창고·자원·단계 cursor를 쓴다. 원 stage-maps 키는 기존 명시 가져오기 외에 변경하지 않는다. 회전/줌/미리보기는 저장을 쓰지 않는다. 카메라 자체의 영구 저장은 추가하지 않았다. 항해 중 재실행은 원래대로 같은 단계/항해ID의 출항 checkpoint다.

## 검사·실행

새 Node6/6: 여섯 지역의 world/local/충돌체 identity·원 데이터 불변·결정적 구름층, 카메라 기준 이동의 방향/속도, 클릭/드래그 임계값·원위치 복귀 오발 차단·다중 pointer/button·터치 orbit. 원 Node26/실제6항해48격파를 다시 실행하지 않았다.

```powershell
node --test tools/voyage-spatial/spatial.test.mjs
node tools/voyage-spatial/build.cjs VERIFIED_INTEGRATION_CHECKOUT
```

HTTP 실행은 `/outputs/voyage-spatial-v1/`. 기존 fleet/world/VFX 상대 경로와 검증 checkout의 기존 esbuild/three를 사용하며 새 설치/서버는 만들지 않는다.

`verify-browser.cjs`는 중앙 단일 슬롯용이며 실행 전 정확한 source/output import가 필요하다. 기본12개: 실제 perspective 전체 화면/단일 controller, 여섯 실제 공간 미리보기와 무저장, 좌우가운데/휠/fit/reset, screen ray roundtrip, pause중 실제drag 오발0, 회전/줌 후 실제 UI 명중, 실제 GLB 포구의 첫1항해6격파/귀환, 다음지역 자산 exact carry와refresh, 이전 실제6완료 state의 분리된 persistence fixture,60회전 잔상0,390px/CDP touch, 외부/예기치않은 오류0. 기존6항해48을 신규 성공 수로 합산하지 않는다.

옛6완료 state는 root의 보존 actual report에서 읽어 새 controller repository의 정상 검증/저장으로 올린 뒤 reload하는 **저장 호환 fixture**다. 이 fixture로 새 전투를 완료했다고 주장하지 않는다. 실제 첫 항해는 HP/위치/승리 주입 없이 UI와 원 public pilot을 쓴다. 원 import/save-fault matrix는 변하지 않은 controller의 이전 증거로 남긴다. 실제 phone/장기 성능·정사 보스 전체/사람 조작감·미술 승인과 별도다.

환경 source10 보존과 bundle 입력38의 SHA를 source-manifest에 기록했다. 새 browser는 준비 시점 미실행이다. SOURCE_READY 후 소스/출력 동결, 중앙이 source·driver·actual report·사후 SHA를 결속한다. 새 오류가 있으면 원FAIL을 보존하고 소유 revision을 새로 낸다.
