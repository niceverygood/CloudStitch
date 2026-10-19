# v1 효과 확대 비교 작업대

최신 사용자 선택인 **v1 모양·색 유지 + 더 크고 풍성한 표시**를 비행선과 함께 비교한다. 새 소스 4개만 추가하며 기존 runtime, v1/v2 GLB, 동결 출력, 공통 package는 수정하지 않는다.

통합 담당의 단일 빌드·브라우저 슬롯에서 저장소 루트 기준 실행한다. 별도 npm 의존성은 없고 기존 esbuild/three를 사용한다.

```sh
node tools/battlefield/build-rich-preview.cjs
```

출력: `outputs/battlefield-rich-vfx-v1/preview.html`, `rich-preview.js`. HTTP로 저장소 루트를 제공해 열어야 한다. HTML을 파일로 직접 여는 방식은 fetch 보안 제한으로 지원하지 않는다.

## 입력과 표시 규칙

- 런타임에 `../combat-vfx/catalog.json`의 기본 48개를 선택 목록에 넣고 실제 `assets/{id}.glb`를 읽는다. 합성 공격 시연 6개는 이 목록에 섞지 않는다.
- `../selected-airship-toon3d/airship.glb`, `../weapon-modules/catalog.json` 및 해당 기존 무기 GLB를 읽는다. GLB는 복제해서 표시하며 원본을 저장하거나 덮어쓰지 않는다. 모든 요청은 같은 origin 또는 GLB 내부 data/blob 리소스로 제한한다. CDN·원격 폰트·이미지는 없다.
- 선체·독립 무기의 원본 -X 전방을 표시 +Z 전방, +Y 위로 돌린다. 선체 길이 5.2, 효과 기본 배율 0.32는 작업대 표시값이며 미터나 엔진 소켓 규격이 아니다. 무기는 선체 옆 외부 받침에 놓는다. 포구는 실제 메시 전방 끝점들의 평균을 표시 변환한 근사점이다.
- 오른쪽은 `getRichProfile(id)`의 `scale`을 효과 그룹 전체에 적용한다. `echoes`는 같은 GLB의 독립 clone/mixer로 표시한다. `delay`초 후 시작하며 `echo.scale`은 주 효과 대비 배율, `rotation`은 로컬 Y축 라디안, `offset[3]`는 전체 표시 배율 전의 자산 로컬 좌표다.
- 양쪽은 실제 첫 클립의 같은 초 단위 시간을 쓴다. echo 지연이 있어도 수명을 늘리지 않으며, 원본 clip duration에서 모두 숨긴다. UI 반복은 작업대 공통 시계만 되감는다. 상태 효과도 한 주기를 비교하며 실제 host loop/stop API가 아니다.
- 투사체는 echo가 없다. 내장 GLB 비행 translation을 양쪽에서 동일한 작업대 궤적으로 재생한다. 오른쪽의 확대가 이동 거리를 늘리지 않도록 position 애니메이션 노드의 표시 translation에 역배율을 적용한다. 작살의 별도 scale-only `tether_growth` 노드는 줄 길이 Z만 역배율로 보정해 끝점 거리를 유지하고, 두께 XY는 확대한다. 탄체·정적 자식 형상은 커지지만 별도 비행 이동을 더하지 않는다. 실제 runtime에서는 sim이 이동을 소유하며 이 작업대 함수를 쓰지 않는다.
- 손그림/셀 명암/원본 3모드, 윤곽선, 재생·일시정지·되감기·스크럽·속도, 전체 선체·효과 초점, 회전·확대·초기화·자동 회전을 제공한다. `OutlineEffect.autoClear = true`를 명시한다.
- 초기 카메라는 표적의 입사면 쪽(+X/+Y/-Z)에서 본다. 실제 GLB의 정상 애니메이션도 반대쪽 카메라에서는 표적판 뒤에 가려지는 문제가 있어 표시 시점만 보정했다. 표적 법선·원본 형상·재생 시간은 유지한다.

## 통합 담당 확인 항목

이 작성 담당은 `node --check`로 JS·빌드 스크립트 2개 문법 검사, JS의 직접 DOM ID 참조 23개와 HTML 정합성을 확인했다. 기관총 투사체 GLB의 실제 carrier/translation 채널 이름도 읽어 확인했다. 빌드·브라우저·npm은 실행하지 않았다. 소스 준비를 실제 GLB 렌더나 시각 검수 완료로 표현하지 않는다.

1. 48개 선택 모두 실제 GLB·클립 로드. 기본 MG/함포 6개 포함. 손그림·셀·원본 모드 전환 시 양쪽 선체·효과가 함께 변경되는지 확인.
2. 원본/확대가 같은 anchor와 시간인지, rich 형상·echo가 더 풍성하되 끝 시점에는 모두 숨는지 확인. 투사체 carrier 월드 위치 차이가 작은지 debug API로 확인.
3. pause 중 시간이 정지하고, 스크럽·되감기·새 효과 선택에 이전 효과가 남지 않는지 확인. 빠른 선택은 ticket으로 늦은 로드를 버린다.
4. 전체 선체·효과 초점·회전·확대·자동 회전·reset, 실제 선체가 효과에 지나치게 가려지지 않는지 확인.
5. 390px 모바일 넘침, 로컬 요청만 있는지, 페이지 오류/실패 요청, 120프레임 회전 후 잔상 확인.
6. 같은 효과를 재선택해 geometry/texture가 계속 증가하지 않는지 확인. 교체된 효과/무기의 clone skeleton·mixer·고유 geometry/material/texture를 해제한다. 유지되는 선체 자원은 두 lane이 공유한다. 초기 자료 로딩 실패 시에도 이미 준비된 자원과 뒤늦게 완료된 로드를 정리한다.

QA 인터페이스: `window.__richVfxPreview`와 `window.__richVfxStats`. API는 `selectEffect(id)`, `setTime(seconds)`, `setPlaying(bool)`, `setLoop(bool)`, `setSpeed(value)`, `setMode(name)`, `setOutline(bool)`, `setFocus(bool)`, `setAutoRotate(bool)`, `setBackground(bool)`, `reset()`, `fit()`, `render()`, `dispose()`. `stats.lanes[].carrierWorldPosition`는 투사체 전시 이동 비교용이며 충돌 데이터가 아니다.

이 화면은 48종의 **외형 작업대**다. 실제 사격→이동→충돌→피해→명중→종료는 별도 전장 통합 화면과 sim 소유 상태로 검증한다.
