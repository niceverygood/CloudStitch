# Cloudstitch 전투 효과 3D 작업대

실제 여러 노드와 변환 애니메이션이 있는 GLB의 외형·시간·움직임을 확인하는 오프라인 작업대다. 실제 게임의 충돌 판정·피해·무기 소켓·성능 검증은 포함하지 않는다. 무기 원본 GLB와 카탈로그는 수정하지 않는다.

저장소 루트의 Three.js·esbuild·Playwright 의존성을 사용한다.

```sh
node tools/combat-vfx/build.cjs
node tools/combat-vfx/capture.cjs EFFECT_ID
```

빌드 인수는 `[카탈로그경로] [출력HTML]`이며 기본값은 `outputs/combat-vfx/catalog.json`, `outputs/combat-vfx/index.html`이다. 실제 GLB를 코드와 함께 base64로 내장한다. 외부 버퍼·텍스처 URI가 있는 GLB는 거절한다. HTML은 `file://`에서 CDN·서버·원본 무기·선체 파일 없이 작동한다.

카탈로그의 `items`에는 다음 필드를 사용한다. `model`과 `preview`는 카탈로그 폴더 기준 상대 경로다. 완료한 실제 모델 파일만 선택할 수 있다.

```json
{
  "items": [{
    "id": "machine-gun-muzzle",
    "order": 1,
    "name_ko": "기관총 총구 섬광",
    "name_en": "Machine Gun Muzzle Flash",
    "category": "muzzle",
    "model": "assets/machine-gun-muzzle.glb",
    "duration": 0.6,
    "loop": false,
    "purpose": "짧은 섬광과 연기로 발사 방향을 읽게 한다.",
    "weapon_id": "01-machine-gun",
    "preview": "previews/machine-gun-muzzle.png"
  }]
}
```

## 실제 애니메이션과 표시

- GLTFLoader가 읽은 첫 번째 실제 애니메이션 클립을 AnimationMixer로 재생한다. 실제 클립 길이가 시간 기준이며, 카탈로그의 길이를 가짜 애니메이션으로 대신하지 않는다. 클립이 여러 개이면 첫 클립이 기본 재생 대상이고 클립 수를 표시한다. 애니메이션 없는 정적 GLB는 그 상태를 명시하고 재생을 비활성화한다.
- 기본 자동 재생과 반복 미리보기다. 짧은 단발 효과도 반복해 볼 수 있지만 원본 레시피의 loop 값은 바꾸지 않는다. 일시정지·처음부터·반복·속도·시간 스크럽을 지원한다. 반복을 끈 유한 효과는 마지막 프레임에서 멈춘다. 스크럽으로 정확히 마지막 시간을 선택해도 0초로 감기지 않는다. 반복은 작업대 시계에서 처리하며, 각 시간의 실제 GLB 클립을 평가한다.
- 0초에 스케일이 0인 효과를 위해 전체 실제 클립을 25개 시점에서 샘플링한 범위로 화면을 맞춘다. 이것은 검사용 기본 화면 맞춤이며 복잡한 움직임의 완벽한 보수적 경계를 보장하지 않는다. 원본 좌표와 GLB 파일은 변경하지 않고 표시용 상위 그룹만 정규화한다.
- 루트 +Y 위, +Z 전방을 유지한다. 충돌 효과의 +Y는 표면 법선 방향이다. 선택적 목재·금속·천 표적은 원본 효과의 원점 아래에 놓은 비교 도형이며 실제 적이나 충돌 판정이 아니다.
- GLB의 vertex colors, unlit 재질과 투명도를 그대로 사용한다. 윤곽선은 기본으로 끄며 켤 수 있다. `OutlineEffect.autoClear = true`를 유지해 애니메이션 잔상을 방지한다. 크림/짙은 청록 배경을 비교할 수 있다.

`index.html?effect=EFFECT_ID`는 해당 효과를 선택한다. 잘못된 ID는 첫 완료 효과로 돌아간다. 무기별 필터, 회전·확대·초기 시점·화면 맞춤·자동 회전, 원본 GLB 다운로드도 제공한다.

## 자동화 API

`window.__vfxReady`, `window.__vfxStats`, `window.__vfxWorkbench`를 노출한다. Stats에는 실제 삼각형·메시·노드·텍스처 준비·클립·트랙·애니메이션 노드 수와 현재 시간·길이·재생/반복/속도가 기록된다.

Workbench 메서드:

- `await selectEffect(id)`
- `setTime(seconds)` — 해당 실제 시간을 평가하고 재생을 일시정지한다.
- `setPlaying(boolean)`, `setLoop(boolean)`, `setSpeed(number)`
- `reset()` — 카메라만 초기화하고 자동 회전을 끈다. 애니메이션 시간을 되감지 않는다.
- `fit()`, `setAutoRotate(boolean)`, `setBackground('cream'|'deepteal')`, `setTarget('none'|'wood'|'metal'|'cloth')`

`root`, `mixer`, `action`, `camera`, `controls`, `renderer`, `effect`, `scene`, `selected`, `availableItems`도 접근할 수 있다. `root`는 원본 GLB 장면을 포함한 표시용 그룹이다.

## 대표 프레임 캡처

```sh
node tools/combat-vfx/capture.cjs [효과ID] [출력폴더] [카탈로그경로] [뷰어HTML] [시간비율]
```

ID를 생략하면 완료한 모든 효과를 캡처한다. 기본 시간은 실제 클립 길이의 35%다. 카메라를 초기화하고 반복·자동 회전을 멈춘 뒤 실제 GLB 클립 시간을 고정한다. 비교 표적은 끈다. WebGL 캔버스 PNG 픽셀을 직접 저장하므로 HTML 글씨·버튼이 들어가지 않고 투명 배경이 보존된다. 원화나 기존 PNG를 후편집하지 않는다.

기본 출력은 카탈로그 각 항목의 `preview` 경로다. 별도 출력 폴더를 주면 `ID.png`로 저장해 기존 산출물을 보존한다. 대표 시점에 효과가 의도적으로 비어 있다면 아트 담당자가 시간비율을 선택해 다시 캡처한다. 이 캡처 도구는 게임 플레이·성능·프레임 간 잔상의 검증을 대신하지 않는다.
