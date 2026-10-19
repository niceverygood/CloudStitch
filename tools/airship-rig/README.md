# Cloudstitch 비행선 리깅 파이프라인

기존 선택 GLB를 원본 그대로 보존하고 `outputs/airship-rig-v1/`에 별도 파생 자산을 생성합니다. 유료 모델 생성·자동 리깅 API는 사용하지 않습니다.

```sh
npm ci
npm run build:rig
npm run verify:rig
npm run verify:gltf
```

`build.cjs`는 Playwright 브라우저의 GLTFLoader/GLTFExporter로 텍스처를 포함한 GLB를 만들고 코드와 모델을 내장한 오프라인 뷰어를 묶습니다. 브라우저 준비는 기존 `npm run setup:browser`를 사용합니다. 중간 빌더는 `work/rig-build/`에만 저장합니다. `--model-only`는 뷰어를 갱신하지 않는 진단용 옵션입니다.

`part-map.json`은 원본 SHA와 전체 11,026삼각형의 연결 섬 지도를 담습니다. POSITION이 같은 정점을 연결성 분석에서만 용접하여 141개 섬을 찾았으며, 내보낼 때는 UV 이음새의 정점을 유지합니다. 부품을 공간 상자로 자르거나 원본 삼각형을 삭제하지 않습니다. 원본 해시가 달라지면 빌드는 중단됩니다.

`rig.js`는 8개 원본 부품군, 3가닥 인양 케이블, 9개 이름 있는 뼈대와 임시 장착 노드를 구성합니다. 기계 부품은 rigid weight 1, 지지 로프와 케이블은 최대 2개의 영향을 사용합니다. glTF에 실제 JOINTS_0, WEIGHTS_0, inverseBindMatrices를 내보냅니다. 원본 좌표 +Y 위/-X 전방을 보존하며 미터 규격은 설정하지 않습니다.

`motion.js`는 7개 전체 포즈 루프를 생성합니다. 120Hz 샘플과 닫힌 변환/속도 경계를 사용하며 회전 샘플은 최대 약 12도여서 프로펠러의 여러 바퀴가 역회전으로 보간되지 않습니다. `captureMotionBindPose` 후 `createMotionClips`를 호출해야 피벗을 보존합니다. 클립은 각각 전체 제어 포즈이므로 additive로 겹치지 않습니다. 실제 물리 시뮬레이션이나 이동 경로가 아니라 아트용 제자리 동작입니다.

`viewer.js`/`viewer-template.html`은 실제 내장 GLB와 AnimationMixer를 재생합니다. `OutlineEffect.autoClear = true`를 유지합니다. 모델/동작을 수정하면 `verify:rig`와 `verify:gltf`를 모두 다시 실행하고 `verification.json`을 갱신합니다. 최종 검사는 원본 P+UV 삼각형 멀티셋, 스킨 정점과 변형, 루프 경계, 기구 움직임, 모드, 정지 상태 회전 잔상, 모바일 넘침, 다운로드와 외부 요청을 확인합니다.

`node tools/airship-rig/capture.cjs --video`는 실제 렌더를 3개 PNG와 33초 WebM으로 캡처합니다. `npm run verify:rig-video`로 7개 시점의 실제 영상 디코드를 검사한 뒤 `node tools/airship-rig/finalize.cjs`를 실행하면 성공한 QA/규격/영상 결과를 최종 폴더로 복사하고 파일 해시를 기록합니다. 미리보기 영상도 `.gitattributes`의 LFS 규칙과 자산 무결성 목록으로 관리합니다. 새 캡처 후에는 `python3 tools/verify-assets.py --write`로 목록을 갱신하고 일반 검사를 실행합니다.

Khronos glTF Validator는 잠금 파일의 `gltf-validator` 패키지를 사용하며 별도 서버로 자산을 전송하지 않습니다. 공식 도구 설명: https://github.com/KhronosGroup/glTF-Validator

현재 한계는 `outputs/airship-rig-v1/README.txt`를 따릅니다. 엔진 셰이더·충돌·LOD·절단 게임 로직·실기기 성능은 이 검사의 범위가 아닙니다.
