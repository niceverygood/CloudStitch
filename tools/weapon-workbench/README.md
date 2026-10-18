# Cloudstitch 무기 작업대

완료한 독립 GLB들을 기존 비행선과 같은 손그림/셀 명암/원본 재질로 비교하는 오프라인 뷰어다. 기존 비행선 뷰어와 모델은 수정하지 않는다.

저장소 루트에서 실행한다. 의존성은 루트 `package.json`의 Three.js·esbuild·Playwright를 사용한다.

```sh
npm ci
node tools/weapon-workbench/build.cjs outputs/weapon-modules/catalog.json
node tools/qa/weapon-workbench.cjs outputs/weapon-modules/index.html
node tools/qa/weapon-workbench.cjs outputs/weapon-modules/index.html work/verification/weapon-01 01-machine-gun
node tools/weapon-workbench/capture.cjs 01-machine-gun
node tools/weapon-workbench/gallery.cjs
```

빌드의 두 번째 인수는 출력 HTML, 검사의 두 번째 인수는 검사 결과 폴더, 세 번째 인수는 검사할 무기 ID다. 무기 ID를 생략하면 모든 완료 모델을 검사한다. 기본 출력은 `outputs/weapon-modules/index.html`, 기본 검사 결과는 `work/verification/weapon-workbench/`다. HTML에 모델·텍스처·기준 이미지·Three.js 코드를 내장하므로 `file://`에서 서버와 외부 요청 없이 작동한다.

## 입력 형식

카탈로그의 파일 경로는 카탈로그 JSON이 있는 폴더를 기준으로 해석한다.

```json
{
  "game_title": "Cloudstitch",
  "selected_ship": "../selected-airship-toon3d/airship.glb",
  "items": [
    {
      "id": "01-machine-gun",
      "name_ko": "갑판 회전식 기관총",
      "name_en": "Deck Machine Gun",
      "model": "01-machine-gun/weapon.glb",
      "reference": "01-machine-gun/reference.png",
      "description": "무기의 용도와 디자인 설명"
    }
  ]
}
```

실제 파일이 있고 GLB 헤더가 유효한 모델만 선택 가능하다. `status`가 `pending`, `generating`, `failed`인 항목은 선택할 수 없다. 완료 자산이 하나도 없으면 빌드가 실패한다. PNG 기준 이미지는 선택 사항이다. 입력 카탈로그의 인증 정보나 임의 필드는 HTML로 복사하지 않는다.

항목별 선택 옵션:

| 키 | 의미 |
|---|---|
| `role`, `description` | 화면에 표시하는 용도·디자인 설명 |
| `display_rotation` | 독립 뷰 기본 회전, 도 단위 `[x,y,z]` |
| `mount_rotation` | 장착 배치 회전, 도 단위 `[x,y,z]`; 생략하면 독립 뷰 회전 사용 |
| `mount_length` | 장착 시 최대 길이, 기본 `0.65`; 선체 최대 길이는 `4`로 정규화 |
| `mount_scale` | 장착 크기 배수, 기본 `1` |
| `mount_position` | 정규화한 선체 중심 기준 임시 지지대 위치 `[x,y,z]` |

원본의 좌표·형상·재질은 GLB 다운로드에 그대로 보존한다. 정규화, 회전, 장착 크기와 셀/윤곽선은 뷰어 런타임 표현이며 엔진용 피벗이나 리깅을 GLB에 추가하지 않는다.

## 장착 배치의 범위

장착 배치는 선체 옆 외부 지지대 위에서 상대 크기와 위치를 보는 시안이다. 기존 선체의 포탑은 원본 일체형 모델에 포함되어 있어 보존한다. 지지대는 단순 Three.js 도형으로 만든 비교 도구다. 최종 소켓·부품 분리·포탑 피벗·반동·충돌·무게중심 검증의 완료를 의미하지 않는다.

`OutlineEffect.autoClear = true`를 유지한다. renderer의 autoClear 설정만으로 회전 잔상이 해결된다고 가정하지 않는다.

## 검증과 캡처

검사 도구는 각 완료 모델의 실제 GLB/텍스처 디코딩, 세 표시 모드, 120프레임 자동 회전 후 같은 각도의 새 렌더와 차이 픽셀 0, 선체 배치 비교, GLB 다운로드, 회전·확대·초기화·화면 맞춤·윤곽선 설정, 모바일 넘침과 외부 요청 여부를 확인한다. 결과는 모델별 스크린샷과 `qa-result.json`으로 저장한다. 모델 아트의 완성도와 게임 플레이 성능은 별도 검토 대상이다.

브라우저 자동화에는 `window.__weaponReady`, `window.__weaponStats`, `window.__weaponWorkbench`가 노출된다. Workbench는 `selectWeapon(id)`, `setMode(mode)`, `setMounted(boolean)`, `reset()`, `fit()`, `setAutoRotate(boolean)`을 제공한다. `renderer.domElement`를 캡처하면 투명 배경의 무기 미리보기를 얻는다.

캡처 도구의 인수는 `[무기ID] [출력폴더] [카탈로그경로] [뷰어HTML]` 순서다. 기본적으로 해당 무기의 GLB 폴더에 `preview-handdrawn.png`, `preview-cel.png`, `preview-original.png`, `preview-mounted.png`를 브라우저 렌더로 저장한다. WebGL 캔버스의 PNG 픽셀을 직접 저장하므로 HTML 버튼과 설명 글씨가 들어가지 않으며 투명 배경을 보존한다. 무기 ID를 생략하면 모든 완료 모델을 캡처한다. 출력 폴더를 지정하면 원래 자산 폴더를 덮어쓰지 않는다. 세 독립 미리보기는 각각 기본 시점을 초기화하고 카메라 값이 같은지 확인하며, 잔상 검사 후 회전된 각도를 재사용하지 않는다. 캡처는 PNG 원화를 편집하거나 GLB를 변형하지 않는다.

## 전체 모음

`gallery.cjs [카탈로그경로] [출력HTML]`은 완료한 실제 GLB와 손그림 렌더 PNG가 모두 있는 항목만 `outputs/weapon-modules/gallery.html`에 표시한다. 대기·생성 중·실패 항목을 완료 카드로 표시하지 않는다. 카드에는 브라우저 3D 렌더, 이름·역할·삼각형 수, 기준 그림과 GLB 다운로드, 해당 무기를 자동으로 선택하는 작업대 링크가 있다. `index.html?weapon=01-machine-gun`처럼 무기 ID를 전달하며, 알 수 없거나 미완료 ID는 첫 가용 모델로 돌아간다.

`npm run build:weapons`는 작업대와 갤러리를 순서대로 빌드한다. `npm run verify:weapons -- [HTML] [검사폴더] [무기ID]`와 `npm run capture:weapons -- [무기ID] [출력폴더] [카탈로그] [HTML]`도 사용할 수 있다. 새 모델을 등록했다면 작업대를 빌드하고 해당 무기 렌더를 캡처한 다음 갤러리를 재생성한다. 원화와 이전 산출물을 보존해야 할 때는 별도 출력 폴더를 지정한다.

6종 모두 완료한 뒤 `node tools/weapon-workbench/overview.cjs`로 카드·로컬 링크·이미지 로딩·모바일 레이아웃을 검사하고 실제 브라우저의 전체 화면을 `overview.png`로 캡처한다. `python tools/weapon-workbench/package.py`는 완료 상태와 검사를 확인한 뒤 허용한 파일만 ZIP으로 묶고 모든 항목의 바이트 수와 SHA256을 원본에 대조한다. 인증 정보·생성 세션 상태·원본 응답·work는 패키지에서 제외한다. ZIP 안의 내장 HTML은 독립적으로 열리지만 카탈로그로 재빌드할 때는 저장소 소스와 원본 비행선 GLB가 필요하다.

`node tools/qa/weapon-package.cjs [ZIP경로] [선택SHA256]`은 ZIP을 새 work 폴더에 추출하고 파일 해시·갤러리·한 모델과 내장 선체를 검사한다. 기존 파일을 삭제하지 않고 ZIP 밖의 선체 파일 없이 실행되는지 확인한다. 이전 개별 무기 검사 전체를 반복하는 명령은 아니다.
