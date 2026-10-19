# Cloudstitch 항해 공간 연결자료

기존 맥북 `e65ab87`의 전장·함대·조우 원본을 보존하는 **새 독립 공간 검사안**이다. `tools/battlefield/sim.mjs`가 상태·시간·이동·피해를 소유한다. 이 폴더는 공간 질의와 고정 샘플 배치만 제공하며 전투 루프를 만들지 않는다.

저장소 루트에서 실행한다. 공통 package/lock은 수정하지 않았다.

```sh
node tools/levels/build-data.mjs
node --test tools/levels/adapter.test.mjs
node tools/levels/validate.mjs --write
node tools/levels/build.cjs
```

Node 20 이상이 필요하다. 데이터 생성/공간 검사는 Node 내장 모듈만 사용한다. HTML 빌드는 기존 `esbuild`, `three` 의존성을 사용한다. npm 설치·브라우저 설치는 통합 담당이 맡는다. 새 패키지/잠금 파일은 없다.

통합 담당의 저장소 루트 HTTP 서버에서 `outputs/levels-v1/index.html`을 연다. HTML 코드는 번들돼 있지만 GLB는 원본 상대경로로 공유하므로 `file://` 또는 출력 폴더만 제공하는 서버는 지원하지 않는다. 외부 CDN·API·폰트·추가 생성은 없다.

미리보기에서 공간/항로를 선택하고 진행 슬라이더·회전·바닥 클릭·1LU 키보드 샘플 배치로 검사한다. 이는 물리 이동이 아니다. 원본 선택선을 길이10LU로 표시하고 복원된 징세정을 길이12LU의 정적 비교 대상으로 읽는다. 애니메이션 함대의 동작·피해·등장순서를 구현하지 않는다. 원본 종항 전체 장면 비교는 시각 전용이며 새 독립 배치의 충돌 데이터를 적용한 장면으로 해석하지 않는다.

순서는 선체 → 필수 월드 자산 → 랜드마크 → 선택 구름 → 선택 표적이다. 원본 종항 전체는 사용자가 비교 버튼을 눌렀을 때만 읽는다. 현재 미리보기 캐시는 방문한 선택 GLB 소스를 유지하므로 레벨 전환 뒤의 측정은 따뜻한 캐시 상태일 수 있다.

`level-package.json`의 `levels`와 `assets`를 통합에서 읽는다. `visuals[].assetId`를 `assets[].path`로 해석하고 `longestLU`로 실제 GLB bounds의 가장 긴 축을 균일 정규화한다. `anchor:center`, `position[x,y,z]`, `yawRadians` 순으로 적용한다. 아트 D는 미터가 아니며 원본 장면 비교의 D→LU 변환은 `fullSceneComparison.artFrame`에 따로 있다.

`adapter.mjs`는 좌표 왕복, AABB 배치·연속 sweep, 점유 스폰, 확인용 접점, 가림 프록시를 제공한다. `host-example.mjs`는 `{x,z}`와 두 호스트의 heading 변환을 보여준다. 특히 `battlefieldSpatialInput()`은 기존 circle을 한 번 전달하는 예시다. 원래 world 장애물에 다시 더해 중복 충돌시키지 않는다.

통합 담당만 아래 브라우저 검사를 실행한다. 원본 자산·다른 구현은 변경하지 않고 결과는 `work/verification/levels/`에 남긴다.

```sh
# LEVELS_URL 환경변수를 현재 로컬 서버의 outputs/levels-v1/index.html로 설정
node tools/levels/verify-browser.cjs
```

실시간 관측값은 `window.__levelsPreview.metrics`와 JSON 저장 버튼으로 얻는다. fetch/parse 시간, 현재 모델 메시·렌더 텍스처, 윤곽선 포함 draw/triangles, 선체/표적 5개 가림 레이, 실제 징세정의 투영 bounds를 구분한다. 레이 표본은 GPU 픽셀 면적·사람의 가독성·목표 기기 성능 통과를 의미하지 않는다. 변경 후 `node tools/levels/snapshot.mjs`로 파일 인계 해시를 갱신한다.
