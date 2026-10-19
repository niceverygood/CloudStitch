# Cloudstitch 주인공 함선 형태 도감

소유 소스는 `tools/ship-states/`, 출력은 `outputs/ship-states-v1/`입니다.
선택 원본과 기존 연결 섬 지도를 읽어 6항목31개의 외형 및 제자리 동작을 표시합니다.

저장소 루트의 기존 잠금 의존성(Three.js0.180.0, esbuild0.25.10, Playwright1.62.1)을 사용합니다.

```sh
node tools/ship-states/build.cjs
node tools/ship-states/verify.cjs
```

로컬 의존성이 다른 위치에 준비되어 있으면 기존 `NODE_PATH`를 사용할 수 있습니다.
소스에 PC별 절대 경로를 저장하지 않습니다. 설치·공통 package/lock 수정은 통합 담당 영역입니다.
브라우저·exporter·캡처는 `outputs/project-command/COORDINATION.txt`의 통합 슬롯으로 예약합니다.

`catalog.js`는 항목·단계·설명, `variants.js`는 원형 삼각형 분리와 누적 외형·절대시각 동작,
`viewer.js`는 단일 비교 renderer와 초기 썸네일 renderer, `template.html`은 한국어 도감 UI입니다.
`build.cjs`는 원본 SHA를 확인하고 모델·코드를 오프라인 HTML에 넣으며 catalog/manifest를 만듭니다.
`verify.cjs`는 실제 브라우저 렌더·시간·조작·잔상·모바일·다운로드를 검사합니다.

`createVariantLibrary(gltf)`는 `create(category, stage)`를 제공합니다. 반환값은
`{root, update(seconds), counts, parts, dispose()}`입니다. 같은 library의 파생형은
원본 분리 geometry를 공유합니다. `library.dispose()`로 전체 자원을 정리합니다.
폭발 update는0~4초, 나머지는6초 루프이며 폭발5단계는 한 타임라인의 대표시점입니다.
모든 원본 삼각형을 보존하고 추가 형상만 별도로 만들며 원본 파일에는 쓰지 않습니다.

실제 플레이/장착/저장 연결, 엔진 임포트 및 성능 검증은 범위 밖입니다.
