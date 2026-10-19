# 극적인 대포·작살 비교 작업대

기존 원본과 이전 2.6배 이하 프로파일을 보존하는 새 revision이다. 사용자 최신 ‘10배 이상 과감함’을 크기 배수로 계산하지 않고 큰 붓꽃·휘어진 압력 꽃잎·재료 파열·말리는 연기·해방 반동·밧줄의 관성으로 재구성한다. 따뜻한 수공예 판타지와 손그림처럼 보이는 입체 3D 방향을 따른다. 실제 전투 규칙이나 피해량은 바꾸지 않는다.

새 표현의 대표는 대포와 작살 두 무기다. 대포 발사/명중 2종은 ../dramatic-vfx-v1/cannon-stage.mjs의 서로 다른 시간층과 실루엣을 사용한다. 오른쪽은 .78초/1.10초, 왼쪽은 원본 .60초/.75초까지만 보인다. 같은 사건시각·카메라·배치로 비교하며 오른쪽의 추가 시간은 잔해·연기 여운이다. 실제 함선18 대비 작업대5.2의 크기를 맞추기 위해 stage 평가 뒤 .24 배치를 적용한다. 이 배치값은 강화 배수가 아니다.

작살 발사 오른쪽은 기존 실제 carrier 5메시 1개와 cream rope 1개다. 0~.28초 장전 긴장, .28초 공통 발사, 짧고 큰 -.24 시각 반동, 4.8 자산단위 +Z 가속 이동, 1.52~1.70초 축소 종료다. 왼쪽 기존 발사 클립 역시 .28초부터 원래 속도로 .35초만 실행한다. 하나의 지속 BufferGeometry 밧줄이 느슨한 두 바퀴 감김→큰 S 채찍→펴진 꼬리로 변하고 양 끝점은 발사기와 실제 작살 뒤끝을 따른다. 기존 원본 tether는 숨긴다. 청록/크림의 작은 수채 붓부채와 바람층은 기계적 해방감을 보충한다. 폭발·추가 발사체·명중·걸림·견인·실제 작살 전투는 구현하지 않는다.

전체 카탈로그 48종을 유지한다. 대포2+작살발사1을 제외한 45종은 이전 impactful 프로파일 그대로이며 새 10배 기준 완료로 표시하지 않는다. 작살 비행 독립 효과도 이 보존 범위다.

읽기 의존성은 기존 combat-vfx GLB/catalog, weapon-modules GLB/catalog, selected-airship-toon3d/airship.glb, combat-vfx-v2/machine-gun-soft-runtime-v1/textures/soft-vfx-atlas.png와 기존 프로파일이다. atlas는 초기 한 번 읽고 stage 재료와 작살 UV 인스턴스에 공유한다. 선택 전환 시 stage/작살의 소유 geometry/material/clone texture를 정리하며 최종 dispose에서 caller atlas를 정리한다. 원본 GLB/PNG와 동결 소스는 덮어쓰지 않는다.

빌드: esbuild/three가 저장소 의존성 또는 NODE_PATH에 있는 상태에서 node tools/battlefield/dramatic-preview-v1/build.cjs. 기본 출력은 outputs/combat-dramatic-v1/preview.html?effect=cannon-hit 이다. 외부 요청은 차단하고 형제 폴더 자산만 사용한다. 빌드·브라우저는 통합 담당이 순서대로 실행한다.

접근점: window.__dramaticVfxPreview / __dramaticVfxStats 및 기존 __richVfxPreview/Stats, __impactfulVfxPreview/Stats 별칭. 작살 active.effects[1].context는 carrier/actor/rope/state/ropeStart/ropeEnd를 제공한다. stats에는 phase, projectileCount, recoilZ, ropeEndpoints가 표시된다. 대포는 active.effects[1].stage 및 stats.lanes[1].dramaticStage를 제공한다. 세 모드·윤곽·동일 카메라·정지/역방향 스크럽·속도·회전·확대·초기화·화면 맞춤·반복·좁은 화면 구성을 보존하고 OutlineEffect.autoClear=true를 유지한다.

담당 경량 검사: node --check preview.js/build.cjs, node --test harpoon-motion.test.mjs 9/9 PASS. 순수 시간표·단일 carrier·발사 동시성·한 줄의 coil/whip/직선과 양 끝 보존·반동 복귀·끝 숨김·정지/역방향 표본을 검사했다. 이는 CPU/문법 증거다. 실제 렌더의 미술·강도·손맛 승인, 48종 로딩, 세 모드/윤곽, 빠른 전환·자원 plateau, atlas/방향/가림, 조작/모바일/외부요청/잔상은 통합 QA 및 사람의 승인 대기다.


READY2 소스 감사 보완: 대포 debug() 표본을 통계에 저장하고, 정지 중 카메라 change에서도 같은 절대시간을 재평가해 대포와 작살의 붓카드가 카메라를 향하게 한다. 재생 상태와 시간은 변하지 않는다. 장전 preload를 포함한 실제 무기의 표시 이동량으로 밧줄 시작점을 맞춘다. 대표 3종과 보존 45종의 오른쪽 제목을 동적으로 구분한다. 순수 모션 helper는 바꾸지 않았으며 모션 시험을 중복 실행하지 않았다. preview.js/build.cjs 문법 검사만 다시 통과했다. 빌드·브라우저는 실행하지 않았다.
