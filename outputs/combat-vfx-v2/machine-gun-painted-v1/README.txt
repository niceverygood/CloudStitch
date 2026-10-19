Cloudstitch · 기관총 손그림 탄환과 피격 · 2026-10-18

열기: index.html (자체 포함, 로컬 HTTP 또는 브라우저에서 열기)
현재 앱 미리보기: http://127.0.0.1:8842/outputs/combat-vfx-v2/machine-gun-painted-v1/index.html
이 주소는 현재 로컬 서버 기준이며 다른 PC에서 같은 포트를 가정하지 않는다.

변경
- 실제 기관총 모델과 v1 원본을 보존하고 새 기관총 표시만 별도 제작했다.
- 단순 원뿔/막대 탄환을 황동 붓결 탄체·짧은 강철 촉·황동 밴드로 교체했다.
- 내장 image_gen으로 생성한 투명 포구/타격/연기/궤적 atlas와 재질 atlas를 사용했다.
- 중심 타격·비대칭 파편·금빛 붓조각·뒤늦게 퍼지는 연기를 절대시간으로 연출한다.
- 새 타격 무늬와 금빛 조각은 표적의 실제 표면 법선에 맞춘 평면 메시다.
  카메라를 향해 회전하는 billboard로 충격 면을 만들지 않는다. 연기만 billboard다.
- 실제 원본 시연의 표적 노드와 목재 두께에서 접촉점/바깥 법선을 구한다.
  표면 바깥 최소0.018 시연 단위의 작은 간격을 두어 z-fighting을 피한다.
- 탄환 가까이는 비행 중간으로 이동, 피격 가까이는 접촉 중심을 확대한다.
- 이전v1/새손그림/좌우비교, 정지·프레임·속도·시간 이동과 캡처를 제공한다.

원래 v1 48효과/6시연, 이전 v2 54파일/비교/장부, 기존 v1-review는 보존했다.
신규 image_gen2건, Meshy0건. textures의 PNG 원본 alpha/바이트를 편집 없이 보존했다.
셀의 희미한 alpha 흔적은 runtime alphaTest=.045로 제거한다. 이미지 재편집이 아니다.

검증
verification/geometry.json: 3카메라×4시간/모드, 246평면의 표면 평행성·정역스크럽·종료.
법선 abs(dot)=1, 카메라 변경에 따른 평면 정점 이동0, 모든 평면이 표면 바깥이다.
verification/impact-surface-fixed.jpg: 실제 앱 브라우저에서 명중1.04초/피격 확대.
verification/projectile-texture.jpg: 실제 앱 브라우저 비행0.485초/탄환 확대.
verification/browser-console.json: 해당 탭의 오류/경고 표본0.
원본/새버전 비교와 별개로 사용자 최종 아트 승인은 받지 않았다.
모바일 전체회귀·모든 카메라/시간의 이미지 비교·게임 성능은 이 검수 범위 밖이다.

구현 경계
이 폴더의 새 효과는 textured3D+투명이미지+수동 update/opacity 연출이다.
다운로드 버튼은 이전 v1 GLB다. 새 효과 전체를 저장한 GLB라고 설명하지 않는다.
공격의3연사는 검수용 시각 복사이며 실제 사격/충돌 이벤트를 추가하지 않는다.
실제 전장 연결·피해·사거리·충돌은 변경하지 않았다. 외부 메시지·배포·push 없음.
OutlineEffect.autoClear=true 유지. 효과 이미지/반투명 메시의 윤곽선 패스는 제외한다.

프롬프트/생성 방식
textures/prompt.json: 포구/피격/연기/궤적 이미지, built-in image_gen, 투명배경.
textures/material-prompt.json: 황동/청록/목재/강철 재질, built-in image_gen, 불투명.
두 원본 PNG는 textures/painted-vfx-atlas.png, painted-material-atlas.png.
무기 기준: outputs/weapon-modules/01-machine-gun/reference.png
액션 가독성 참고: https://store.steampowered.com/app/3624140/Wanderburg/
이 게임의 고유 자산·캐릭터·로고·장면은 복제하지 않았다.

재현 (저장소 루트, 기존 Three.js/esbuild 재사용)
node tools/combat-vfx-v2/machine-gun-painted-v1/build.cjs
node tools/combat-vfx-v2/machine-gun-painted-v1/verify.cjs --write
공용 의존성/잠금 파일을 변경하지 않는다.
