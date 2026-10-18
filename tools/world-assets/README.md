# Cloudstitch 월드 에셋·조립 장면 3D 작업대

실제 GLB의 형태·색·조립을 회전해서 확인하는 오프라인 도구다. Meshy 주요 모델의 2K 텍스처와 로컬 제작 부품의 vertex colors를 모두 유지한다. 실제 게임의 충돌·LOD·배치·성능 검증은 포함하지 않는다. 기존 무기·전투 VFX·카탈로그·원화는 수정하지 않는다.

저장소 루트의 Three.js·esbuild·Playwright를 사용한다.

```sh
node tools/world-assets/build.cjs
node tools/world-assets/build.cjs outputs/world-assets/scene-catalog.json outputs/world-assets/scenes.html
node tools/world-assets/capture.cjs ASSET_ID
```

빌드 인수는 `[카탈로그경로] [출력HTML]`이다. 기본값은 `outputs/world-assets/catalog.json`, `outputs/world-assets/index.html`이다. 입력 파일 이름이 `scene-catalog.json`이면 기본 출력은 `scenes.html`이다. GLB·Three.js·기준 PNG를 HTML 안에 내장하므로 `file://`에서 서버·CDN·원본 파일 다운로드 없이 실행된다. 외부 버퍼·텍스처 URI가 있는 GLB는 거절한다.

## 입력과 원본 보존

카탈로그 `items`의 필드:

```json
{
  "id": "example-building",
  "order": 1,
  "name_ko": "구름 항구 건물",
  "name_en": "Cloud Harbor Building",
  "category": "architecture",
  "model": "assets/example-building.glb",
  "preview": "previews/example-building.png",
  "role": "항구의 시각 기준이 되는 건물",
  "build_method": "local vertex paint",
  "status": "completed_mesh_prototype"
}
```

파일 경로는 카탈로그 폴더 기준이다. 실제 GLB가 없는 항목과 pending/generating/failed 항목은 선택할 수 없다. 애니메이션 유무와 삼각형·텍스처 수는 로딩한 실제 GLB에서 계산한다. 카탈로그 수치를 구현 완료로 대신하지 않는다.

각 모델은 표시용 상위 그룹에서 최대 길이 4로 정규화하고 바닥을 Y=0, X/Z 중심을 0에 맞춘다. 원본 GLB의 좌표·부품·원점·텍스처·애니메이션은 다운로드 바이트에 그대로 보존한다. 이 변환은 엔진용 피벗·충돌·바닥 배치를 확정하는 편집이 아니다.

기준 PNG는 선택 사항이다. `reference` 또는 `reference_png` 필드, `references/ID.png`, `hero/ID/reference.png`, `hero-models/ID/reference.png` 중 실제 있는 첫 파일을 내장한다. 화면에는 선택한 모델 한 개의 기준 그림만 표시한다. PNG 기준 그림과 회전 가능한 GLB를 동일한 결과물로 주장하지 않는다.

## 표시와 조작

- 손그림: MeshBasicMaterial로 텍스처·vertex colors·투명도를 유지한다.
- 셀 명암: 같은 색 정보에 세 단계 gradient 명암을 적용한다.
- 원본 재질: GLB의 원래 재질을 표시한다.
- `OutlineEffect.autoClear = true`를 명시해 회전 잔상을 방지한다.
- 카테고리·검색·선택, 회전·확대·이동·초기 시점·현재 범위 맞춤·자동 회전, 윤곽선·두께, 크림/짙은 청록 배경, 바운딩박스와 좌표축을 제공한다.
- 전면은 +Z에서, 후면은 -Z에서, 위는 +Y에서 본다. 사선은 기본 시점이다. 위 시점은 OrbitControls의 pole 문제를 피하는 작은 Z 오프셋만 사용한다.
- 화면 맞춤은 현재 실제 모델의 Box3 범위를 사용한다. 애니메이션이 있다면 현재 프레임이 기준이다. 애니메이션이 없으면 ‘애니메이션 없음’을 표시하며 가짜 움직임을 만들지 않는다. 있으면 첫 실제 클립을 AnimationMixer로 재생·일시정지한다.

`index.html?asset=ID`와 `scenes.html?asset=ID`로 해당 모델을 바로 선택한다. 잘못된 ID는 첫 완료 모델로 돌아간다.

## 자동화 API

`window.__worldReady`, `window.__worldStats`, `window.__worldWorkbench`를 제공한다. Stats에는 실제 메시·노드·삼각형·vertex color 메시·재질·텍스처 준비·클립 수·현재 범위가 기록된다.

Workbench 메서드는 `await selectAsset(id)`, `setMode('handdrawn'|'cel'|'original')`, `reset()`, `fit()`, `setAutoRotate(boolean)`, `setBackground('cream'|'deepteal')`, `setView('front'|'back'|'top'|'iso')`다. 실제 애니메이션이 있으면 `setPlaying(boolean)`, `setTime(seconds)`도 사용할 수 있다. `renderer`, `effect`, `camera`, `controls`, `root`, `scene`, `mixer`, `selected`, `availableItems`를 노출한다.

## 깨끗한 실제 3D 렌더 캡처

```sh
node tools/world-assets/capture.cjs [ID] [출력폴더] [카탈로그경로] [뷰어HTML]
node tools/world-assets/capture.cjs SCENE_ID work/scene-review outputs/world-assets/scene-catalog.json outputs/world-assets/scenes.html
```

ID를 생략하면 실제 완료 모델을 모두 캡처한다. 기본 출력은 각 항목의 `preview` 경로이며, 별도 출력 폴더를 지정하면 원본 산출물을 덮어쓰지 않고 `ID.png`로 저장한다. 손그림·사선 시점으로 초기화하고 자동 회전·바운딩박스·좌표축을 끈다. 실제 애니메이션이 있으면 35% 시점에 고정한다.

WebGL 캔버스의 PNG 픽셀을 직접 저장하므로 HTML 글씨·버튼이 들어가지 않으며 투명 배경을 보존한다. 기존 PNG나 원화를 후편집하지 않는다. 이 정지 렌더의 출처는 실제 GLB이며 같은 HTML에서 자유롭게 돌려 확인할 수 있다.
