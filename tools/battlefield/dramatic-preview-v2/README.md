# 극적인 전투 효과 비교 v2

v1 및 그 출력/검수본을 보존하고 새 6파일을 분기했다. 대포의 원본과 새 주형태·명암·긴 연기를 같은 카메라·절대 사건시간·접점에서 비교한다. 사용자 최신 ‘10배 이상 과감함’은 큰 형태와 재료·시간층의 재설계 목표이며 크기나 피해 배수가 아니다. 따뜻한 수공예 판타지와 손그림처럼 보이는 입체 3D 방향을 유지한다.

대포는 ../dramatic-vfx-v2/cannon-stage.mjs의 같은 API 및 CANNON_STAGE_DURATIONS를 사용한다(통합 예정 muzzle .95초/hit 1.60초). 실제 소비자 tools/integration-dramatic-v1/renderer.js의 initialize에서 shipAsset('player-homeward',10)을 사용함을 통합 worktree에서 읽어 확인했다. 비교 함선은 normalize(...,5.2,...)이므로 양쪽 대포 형상에 정확히 5.2/10=.52를 적용한다. 왼쪽 original wrapper와 오른쪽 stage root의 geometry/로컬 이동만 같은 .52로 변환하고, world muzzle/target 접점은 기존 target=muzzle+(0,0,4*.32)로 보존한다. root.position은 평가된 같은 frame XYZ 그대로다. 원본 clip 속도/시간 .60초·.75초와 normal -Z는 유지한다. 이 기본 모드는 실제 게임 상대크기 비교이며 stats.comparisonMode='runtime-player-10-to-preview-5.2', comparisonScale=.52이다. 이전 뷰어 길이18은 이 소비자의 기준이 아니므로 사용하지 않는다. 새 주질량6~8LU면3.12~4.16world로 선체5.2의60~80%, 압력날개/파편 전체12~14LU면6.24~7.28world다. 실제 투영 가독성과 강도는 렌더 확인이 필요하다. 다른45종·작살의 기존 .32 표시와 프로파일은 바꾸지 않는다. 조준·충돌·피해·실제 게임 권위는 변경하지 않는다.

원본 함포 명중의 .19초 가독성 진단:
- 통합 담당이 제공한 cannon-hit-paired-age-019.png를 정지 이미지로 읽었다. 작은 왼쪽 효과와 불투명 표적판이 겹쳐 중심 형상을 읽기 어려웠다.
- cannon-hit.glb 한 파일의 JSON/버퍼만 읽어 .19초 선형 scale/translation을 표본했다. 주 puff scale .923478, burst_2 scale .868349/translation [.269429,.243040,.036301]이므로 원점 고정이나 0 scale가 아니다. 소스 mixer는 action.reset 후 mixer.setTime 절대표본이다. 이번 작업에서 실제 GLTFLoader/mixer CPU 실행은 하지 않았다.
- 원본 puff 지름 .44LU × scale .923478 × baseScale .32 ≈ .130world, 기존 표적 .43×.37world/두께 .035world이다. 작은 원본을 판의 평면·두께와 겹치게 두어 중심을 일부 가리고 판의 넓은 갈색 면이 시각적으로 우세했다. normal +Y→world -Z 회전과 초기 카메라의 -Z 성분은 기존대로 유지했다.
- v2의 cannon-hit에 한해서 양쪽 모두 중앙이 빈 .235 반경/.003 두께 표적 테두리를 사용한다. 반투명·depthWrite=false인 가는 링으로 표적의 중앙 채움과 깊이 가림을 제거했다. 링의 가는 선 자체는 여전히 보인다. 원본 GLB geometry 자체·normal·world XYZ·clip 시각은 바꾸지 않았으며 양쪽 대포의 표시 scale만 실제 게임 비율 .52로 함께 맞췄다. 다른 효과를 선택하면 기존 불투명 판을 복구한다. 실제 전투 물체를 투명하게 만든 작업이 아니다.
- 원본 GLB 자체의 상대적인 작은 형상은 보존했다. 가림 제거가 실제 화면의 가독성 해결인지, 새 효과가 충분히 대담한지는 통합 paired 렌더에서 확인해야 한다.

작살 helper/시험은 v1에서 바이트 그대로 복사했다. 기존 carrier 5메시 1개, 연속 BufferGeometry 밧줄 1개, old tether 숨김, 장전→.28초 공통 발사→강한 표시 반동→S 채찍→긴 관성→1.70초 종료 숨김을 유지한다. 장전 preload까지 포함한 표시 무기 위치로 ropeStart를 맞춘다. 실제 명중·걸림·견인·전투는 없다. 새 ricochet 코드와 파일은 만들지 않았다.

전체48 중 대포2+작살발사1만 대표 새 연출이며 나머지45는 이전 impactful 프로파일 그대로다. 제목도 대표3종은 새 극적 연출, 나머지45는 이전 풍성 프로파일로 구분한다. 정지 상태의 OrbitControls change도 같은 time을 재평가하여 붓카드를 카메라에 맞추고 재생상태·시간은 바꾸지 않는다. stage.debug() 결과를 stats에 저장한다. 세 재질모드/OutlineEffect.autoClear=true/회전·확대·맞춤·초기화/모바일 구조/자원 정리를 보존한다.

읽기 의존성: 기존 combat-vfx GLB/catalog, weapon-modules GLB/catalog, selected-airship-toon3d/airship.glb, combat-vfx-v2/machine-gun-soft-runtime-v1/textures/soft-vfx-atlas.png 및 기존 프로파일. atlas는 초기1회 읽고 최종dispose에서 정리한다. stage와 작살은 자신의 geometry/material/clone texture만 정리한다.

빌드 명령은 node tools/battlefield/dramatic-preview-v2/build.cjs 이고 기본 출력은 outputs/combat-dramatic-v2/preview.html?effect=cannon-hit 이다. esbuild/three가 저장소 또는 NODE_PATH에 있어야 한다. 외부 요청은 차단하고 형제 폴더 자산만 사용한다. 접근점 window.__dramaticVfxPreview/Stats는 유지하며 stats.source='dramatic-v2'이다. 기존 rich/impactful 별칭도 보존한다.

담당 검사: preview.js/build.cjs node --check 통과. helper9시험은 이전 통과본과 바이트 동일하므로 중복 실행하지 않았다. 빌드/browser/GPU/전체 자산 검사는 실행하지 않았다. PNG1 읽기와 원본 GLB1 raw 표본만 수행했다. 실제 렌더·미술·강도·손맛 승인, 48종 로딩/세모드/정지회전/전환·리소스 plateau/방향·가림/모바일·외부요청·잔상은 통합 QA 및 사람 승인 대기다.

