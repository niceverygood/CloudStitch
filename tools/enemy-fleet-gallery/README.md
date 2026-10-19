# 적 함선 한눈에

기존 적 함선의 실제 GLB 정지 렌더를 모은 가벼운 오프라인 갤러리다. 새 이미지·모델 생성이나 기존 자산 변경 없이 최신 그림 기반6척과 기존 함대v2 외형을 연결한다.

```sh
node tools/enemy-fleet-gallery/build.cjs
node tools/enemy-fleet-gallery/capture.cjs
node tools/enemy-fleet-gallery/qa.cjs
```

저장소 루트의 Node.js20+ 환경과 기존 Playwright 의존성을 사용한다. 빌드는 Node 표준 라이브러리만 사용하며, 캡처/QA는 `tools/lib/runtime.cjs`의 브라우저 검색 규칙을 따른다. 런타임의 외부 패키지는 필요할 때 환경변수 `NODE_PATH`로 지정하며 머신별 경로를 소스에 고정하지 않는다.

- 결과: `outputs/enemy-fleet-gallery-v1/index.html`, `catalog.json`, `source-manifest.json`.
- 한 장 이미지: 같은 폴더 `overview.png`. `index.html?sheet=1`을 실제 브라우저에서 렌더한다.
- 원본: `fleet-comparison-v1/inventory.json`의 진영 분류. 기본6척만 `enemy-fleet-reference-v1/catalog.json`의 최신 외형·해시·미리보기로 연결한다.
- 범위: 일반7 + 임무·역할7 + 중간보스/보스/시설5 = 적19항목. 라이벌6 + 함대왕의 시험1은 상황별7항목이다. 모두 별개의 정사 함선이라는 뜻은 아니다.
- 목록은 PNG만 읽고, 클릭하면 기존 오프라인 3D 뷰어 한 개를 연다. 닫거나 교체할 때 iframe을 제거한다. 기존 뷰어·모델·재질·클립은 수정하지 않는다.
- 두 척 비교는 화면 맞춤 정지 렌더다. 각 배의 실제 회전·확대·표시 모드는 기존3D 뷰어에서 확인한다.
- QA는26개 자산 경로·해시·이미지와 목록 조작, 대표2뷰어를 확인한다. 모든26뷰어의 게임·성능 검증으로 확대하지 않는다.

산출물은 기존 출력과 별도 보존한다. PNG는 저장소 전역 LFS 규칙을 따른다. 외부 서비스·새 자동화·배포·commit/push를 수행하지 않는다.
