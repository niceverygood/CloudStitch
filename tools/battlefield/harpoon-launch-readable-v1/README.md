# 더 강한 v1 효과 비교와 작살 발사 맥락

기존 `rich-preview.js/html`과 모든 v1 GLB를 보존하는 별도 작업대다. 왼쪽은 원본, 오른쪽은 `../impactful-vfx-v1/profiles.mjs`의 표시 전용 크기·늘임·작은 겹침을 사용한다. 전체 48종을 선택할 수 있다. 피해·충돌·발사체 권위·세이브는 변경하지 않는다.

작살 발사는 원본 청록 고리와 크림 연기만으로 레일에서 작살이 튀어나오는 뜻이 읽히지 않았다. 오른쪽은 기존 `harpoon-projectile.glb`의 실제 작살 5메시를 단 한 개 재사용한다. 원본 이동 클립을 실행하지 않고 고정 시연 경로를 적용한다. 무기 전체의 짧은 시각 반동과 양 끝점을 따라가는 크림 밧줄 하나를 더한다. 표적·피격·걸림·견인·실제 작살 전투는 구현하지 않는다.

오른쪽 작살 시연은 장전된 모습 0~0.16초, 발사와 반동 0.16초, 비행 0.16~0.90초, 1.15~1.25초 축소 종료다. 원본 발사 클립은 0.16초부터 기존 속도로 0.35초만 재생한다. 왼쪽 원본은 기존 0.35초 후 숨긴다. 나머지 47종의 클립 길이와 배치는 기존 작업대와 같다. 작살과 줄의 크기가 이동 거리나 줄 끝점에 중복 적용되지 않는다.

`node --test tools/battlefield/harpoon-launch-readable-v1/harpoon-motion.test.mjs`는 순수 타임라인의 장전·발사·1개 투사체·반동 복귀·줄·클립 속도·정지/역방향 스크럽·입력 범위를 검사한다. 브라우저에서 실제 GLB 로딩, 세 재질 모드, 빠른 선택 전환과 정리, 반동/줄 끝점, 모바일, 윤곽선 잔상은 통합 담당의 별도 QA 대상이다.

빌드: 저장소 의존성 또는 `NODE_PATH`에 esbuild/three가 있는 상태에서 `node tools/battlefield/harpoon-launch-readable-v1/build.cjs`를 실행한다. 기본 출력은 `outputs/combat-impactful-v1/preview.html`이다. 외부 요청 없이 형제 폴더의 기존 GLB를 읽는다. `OutlineEffect.autoClear = true`를 유지한다.

검수 접근점: `window.__impactfulVfxPreview`, `window.__impactfulVfxStats`. 기존 검수 호환용 `__richVfxPreview`, `__richVfxStats` 별칭도 제공한다. 작살 구성의 `active.effects[1].context`는 실제 carrier, actor, rope, 현재 순수 표본, 줄 두 끝점을 제공한다. 밧줄은 고정 BufferGeometry를 갱신하므로 프레임마다 geometry를 생성하지 않는다.
