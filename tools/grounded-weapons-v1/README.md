# Cloudstitch · 절제한 판타지 무기 12종

사용자가 승인한 `outputs/fantasy-weapon-moodboard-v2/moodboard.png`를 입체로 해석하는 독립 다중 메시 제작 소스다. 기존 6종 무기와 전장 규칙은 수정하지 않는다.

`kit.mjs`의 기초 도형·정점 채색과 `models-a/b/c.mjs`의 부품 조립으로 모델을 만든다. 후면·가려진 작은 구조는 새 3D 해석이며 그림의 정밀 복제는 아니다. `spec.mjs`가 고유 12개 목록과 승인 원화 SHA를 고정한다.

저장소의 Node.js20+ 및 three/esbuild/playwright를 사용한다. 이 머신에서는 통합 담당의 설치된 의존성을 읽기 참조했다. 다른 PC에서 캐시 절대 경로를 재사용하지 않는다. 필요하면 `NODE_PATH`를 현재 사용 가능한 모듈 경로로 설정한다. 공식 검사는 `gltf-validator`가 필요하며 `GLTF_VALIDATOR_PATH`로 현재 설치 위치를 지정할 수 있다. 공통 package/lock은 수정하지 않는다.

```sh
node tools/grounded-weapons-v1/run.cjs inspect
node tools/grounded-weapons-v1/run.cjs export --bundle-only
```

위는 소스 준비다. 실제 export·브라우저는 COORDINATION의 중앙 단일 슬롯 START 이후 실행한다.

```sh
node tools/grounded-weapons-v1/run.cjs export --slot-start
node tools/grounded-weapons-v1/build.cjs
node tools/qa/world-workbench.cjs outputs/grounded-weapons-v1/index.html work/verification/grounded-weapons-v1 outputs/grounded-weapons-v1/catalog.json all 12
node tools/grounded-weapons-v1/capture.cjs --slot-start
node tools/grounded-weapons-v1/gallery.cjs
node tools/grounded-weapons-v1/overview.cjs --slot-start
```

실제 파일은 `outputs/grounded-weapons-v1/assets/`에, 각 파일의 바이트·해시·부품·삼각형·공식 검사 결과는 `manifests/`에 기록된다. 모든 GLB는 +Y위/+Z전면의 상대 설계 단위다. 고유한 이름의 부품 그룹이 있지만 정적이며 애니메이션·조준/장전·충돌·피해·물리·LOD·최종 엔진 소켓은 구현하지 않는다. 셀 명암과 윤곽선은 뷰어 런타임 기능이다.

뷰어는 검증된 `tools/world-assets/viewer.js`/`template.html`을 별도 경로에 복사한 파생본이다. 원본을 수정하지 않았고 `OutlineEffect.autoClear = true`를 유지한다. 사용자 노출 문구·카테고리·공통 보드 참조·빌드를 새 12종에 맞췄다. 공식 GLB검사와 실제 브라우저 검사는 별도 근거이며 사람의 3D 미술 승인은 별도다.
