Cloudstitch · 기관총의 부드러운 손그림 효과 · 2026-10-18

index.html: 새 부드러운 표시. 상단 링크로 이전 강한 효과와 전체 작업대로 돌아간다.
사용자 요청의 따뜻한 손그림 판타지 애니메이션 인상을 크림빛·살구색·세이지색,
수채 재질과 둥글게 퍼지는 움직임으로 옮겼다. 기존 작품의 캐릭터·장면·로고는 없다.

이번 변경
- 새 투명 효과 atlas: 둥근 포구 퍼프 / 옅은 살구색 타격 / 크림·세이지 연기 / 짧은 탄흔.
- 새 재질 atlas: 차분한 황동 / 부드러운 청록 / 밝은 나무 / 옅은 청회색 강철.
- 불티14→6, 연기5→4, 나무 조각5→3. 강한 가산 발광을 제거했다.
- 피격 중심은 작고 둥글게, 연기는 늦고 느리게 확장하며 사라진다.
- 탄체 크기와 잔광도 줄이고 거친 금속 스크래치를 부드러운 붓결로 바꿨다.
- 충격 무늬와 불티는 실제 표적 법선에 평행한 평면 메시다. 카메라를 따라 돌지 않는다.
  연기는 입체감을 위해 billboard를 사용한다. 앞서 수정한 표면 고정을 유지했다.

보존/경계
기존 machine-gun-painted-v1과 v1-review, v2 원본/장부를 보존했다. 새 폴더만 작성했다.
실제 무기 모델은 이전 원본을 읽는다. 다운로드 버튼도 이전 v1 GLB를 제공한다.
새 연출은 이미지+3D탄체+수동 update/opacity 조합이며 전체 새 GLB가 아니다.
3연사는 시각 검수용이다. 실제 피해·충돌·전장 연결·게임 성능을 변경한 것은 아니다.
새 Meshy 작업0. 새 이미지는 built-in image_gen으로 생성했고 원본 바이트/alpha를 보존했다.
선택 자산2장과 생성 시도/프롬프트는 textures/*prompt.json 및 manifest.json을 따른다.
효과 PNG의 넓은 투명 여백은 런타임 UV로만 좁혀 읽기 쉬운 크기를 유지한다.
원본 이미지의 픽셀·알파를 잘라내거나 다시 칠하지 않았다.

검수
명중 → 피격 가까이, 탄환 가까이, 시간 이동·프레임 이동·이전v1 좌우 비교가 가능하다.
verification/geometry.json은 표면 법선·시점 변경·시간 왕복·종료를 검사한다.
실제 브라우저의 확인 범위와 캡처는 verification/browser-review.json을 따른다.
이 확인은 사용자의 최종 아트 승인이나 전체 모바일/게임 성능 검수가 아니다.
OutlineEffect.autoClear=true와 반투명 효과 윤곽선 제외를 유지한다.

소스/재현 (저장소 루트, 기존 Three.js/esbuild 재사용)
node tools/combat-vfx-v2/machine-gun-soft-v1/build.cjs
node tools/combat-vfx-v2/machine-gun-soft-v1/verify.cjs --write
공용 package/lock/의존성, 타 세션 폴더와 기존 자산을 수정하지 않는다.

선택 이미지
textures/soft-vfx-atlas.png · textures/prompt.json
textures/soft-material-atlas.png · textures/material-prompt.json
무기 기준: outputs/weapon-modules/01-machine-gun/reference.png
