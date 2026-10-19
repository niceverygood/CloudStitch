# Cloudstitch · 더 강한 전투 표현

최신 직접 요청은 기존 v1의 어울리는 형태를 유지하며 효과를 더 풍성하고 과감하게 만들고 조작감·타격감을 강화하는 것이다. 직전 요청인 읽히지 않는 작살 발사도 함께 개선한다. 기존 v1/v2 GLB·원화·rich 실행물·12파일 인계는 덮어쓰지 않는다. 신규 소스는 `tools/battlefield/impactful-vfx-v1/`와 `tools/battlefield/harpoon-launch-readable-v1/`에만 둔다.

## 적용한 아트

`docs/ART_DIRECTION.txt`의 따뜻한 수공예 판타지, 2D 손그림처럼 보이는 입체적 3D, 약간 과장되고 화려한 볼륨과 리듬을 적용했다. v1의 크림·청록·황동·목재 색과 원본 메시를 재사용한다. 발사 2.0~2.1배, 탄체 1.65배, 명중 2.3~2.45배, 큰 폭발 최대 2.6배로 키운다. 작은 지연 층을 최대 3개 더하고 방향별 폭·높이 대비를 준다. 실제 투사체와 작살·회수·장착·수리·지속 상태의 의미를 복제하지 않는다.

이 수치는 렌더 배율이다. 피해·사거리·충돌 반경·쿨다운·HP·탄 좌표·조준 권위는 바꾸지 않는다. 원본 모서리 형태를 새 수채화 텍스처로 재제작한 결과는 아니다. 최신 부드러운 기관총 아트는 VFX 담당의 별도 `machine-gun-soft-runtime-v1`에서 제공하며 실전에는 그것을 우선 사용한다.

## 런타임 모듈

```js
import { createCombatVfx } from './impactful-vfx-v1/vfx.js';
import { createCombatFeedback } from './impactful-vfx-v1/feedback.mjs';
import { createCombatPresentation } from './impactful-vfx-v1/presentation.mjs';

const meshVfx = createCombatVfx(THREE, scene, {
  presentation: 'impactful', effectScale: 1,
});
const feedback = createCombatFeedback({ reducedMotion });
const presentation = createCombatPresentation({
  meshVfx, softMachineGunVfx, feedback, camera,
});
await presentation.load();
presentation.consume(events, sim.projectiles, generation);
presentation.update(simulatedDeltaSeconds, sim.projectiles, camera);
const response = presentation.sampleFeedback();
```

메시 factory의 기본값은 impactful이며 명시한 original/rich도 기존 배율을 유지한다. `effectScale`은 1을 사용하고 크기를 또 곱하지 않는다. 기존 6 GLB만 로드한다. 실제 탄환은 원래 carrier 자식만 쓰며 전시 비행 클립을 재생하지 않는다. 명중은 실제 hit 이벤트에서 한 번만 생성한다. 모든 echo는 원본 clip 종료 시 함께 반환한다. 활성 단발32/효과·투사체64/효과·비활성 풀24/효과는 구별되며 모든 표시 모드에 공통이다. 초과 시 표시만 생략하고 통계를 남긴다.

composite는 부드러운 기관총이 주입되면 기관총 이벤트와 기관총 실제 탄 배열을 **양쪽 모두** 메시 경로에서 제외한다. 함포 등은 메시 경로로 보낸다. 부드러운 기관총을 생략하면 기존 메시만 소비한다. 각 원본 renderer의 load/consume/update/reset/dispose/debug 계약을 유지한다. module-hit 뒤 같은 프레임 projectile-ended는 탄체를 없애되 생성된 단발 hit 클립의 수명은 유지해야 한다.

`softMachineGunVfx`는 VFX 담당의 `createSoftMachineGunVfx(THREE, scene, { camera, ... })` 결과다. 실제 카메라를 `setCamera`/update에 연결해 면 정렬을 유지한다. 아틀라스 경로·해시·CPU검증은 그 담당의 별도 정확한 READY를 사용한다. 이 인계가 아직 동결되지 않은 다른 담당 소스를 수정하거나 검증 완료로 선언하지 않는다.

## 반동·화면 반응 연결

`createCombatFeedback`는 카메라나 배우를 직접 쓰지 않는다. 같은 전투 이벤트와 **sim 시간 차이 하나**를 읽고 다음 표시값만 반환한다.

```js
{ cameraOffset: {x,y,z}, roll, zoomKick,
  weaponRecoil, recoilOffset: {x,y,z}, aimDirection: {x,y,z},
  flash, playerFlash, hitFlash, activePulses }
```

펄스는 최대32개, 영수증은2048개, 최대0.34 sim초 안에 감쇠한다. camera XZ축0.22/Y0.12, roll0.025rad, zoomKick0.02, 무기반동0.4 표시단위로 제한한다. reducedMotion에서는 camera/roll/zoom을0으로 하고 나머지를 절제한다. 실제 오디오나 피해·시간 정지는 만들지 않는다. 명중 강조색을 화면에 소비할 경우 강도를 그대로 불투명도에 쓰지 말고 조준과 약점이 보이는 작은 영역/낮은 알파로 소비한다.

통합 renderer의 책임:

1. 매 프레임 이전 표시 offset을 제거하고 권위 pose와 base camera를 먼저 계산한다. **aim ray는 흔들리지 않는 base camera**를 사용한다.
2. 실제 포구 계산에서 이전 표시 반동이 섞이지 않게 한다. 실제 muzzle resolver 전에 표시 offset을 복구하거나 분리된 표시 계층을 사용한다. 단일 메시 함선 전체를 기계 부품으로 분리했다고 설명하지 않는다.
3. consume/update는 sim 시간 차이로 한 번씩 호출한다. pause/반복 draw/QA 수동 render에는 dt0이다.
4. 최종 draw에 표시 offset·roll·zoom·반동을 한 번 얹고 다음 프레임 base부터 재계산한다. 누적 덧셈·반복 zoom 곱을 하지 않는다.
5. retry/depart/clear/defeat/harbor 전환·화면 종료에서 reset/dispose한다. 세대는 cursor보다 먼저 검사한다. 실제 시뮬레이션이나 입력, 공통 renderer 원본은 이 담당이 수정하지 않는다.

## 48종 비교와 작살 문맥

```sh
node tools/battlefield/harpoon-launch-readable-v1/build.cjs
```

새 출력은 `outputs/combat-impactful-v1/preview.html?effect=harpoon-launch`이다. 왼쪽은 기존 v1, 오른쪽은 더 강한 표시다. 다른47종은 기존 원본 clip 수명과 같은 궤적을 유지한다.

기존 harpoon-launch는 0.35초 청록 고리1개·크림 연기4개만 포함하며 실제 작살/줄/레일/발사기 반동은 없다. 새 오른쪽은 기존 harpoon-projectile의 촉5메시 carrier1개, 크림 밧줄1개, 발사기 표시 반동을 연결한다. 0~0.16초 장전 모습을 보이고, 0.16초에 원 발사 클립을 시작하며 0.90초까지 같은 +Z로 나아가고 1.25초에 종료한다. 움직임과 밧줄 두 끝점은 전체 효과 배율과 분리한다. 실제 충돌·걸림·견인이나 작살 게임 플레이는 구현하지 않는다.

## 실제 검사와 남은 한계

프로필9건, 실제 Three 런타임15건(상위1+하위14), 표시 feedback13건, composite14건, 작살 순수 모션8건으로 신규 Node 검사59건을 통과했다. composite는 MG 한 경로 라우팅·입력 불변·무기ID 복원·구세대/clear/terminal/pause·실패 정리·active-only 참조와 supportedWeapons 합집합으로 호스트 기본 탄환 중복 표시 억제를 확인했다. 소스 담당은 npm·빌드·export·유료 생성을 실행하지 않았다. 기존 작살을 보는 IAB 짧은 열람 슬롯은 반환했고, 신규 렌더 브라우저 검사는 통합 담당에 남긴다. 정확한 수·해시는 최종 manifest를 확인한다.

부드러운 MG 별도 READY: `outputs/combat-vfx-v2/machine-gun-soft-runtime-v1/manifest.json`, SHA256 `97c285c820a6053ee2ea67d6393a481005a284f217726e5706e5bdc4b1badcaf`. 해당 패키지 CPU14건(상위1+하위13)은 VFX 소유자가 수행한 별도 범위다. 본 패키지59건과 합쳐 같은 검사 묶음으로 표기하지 않는다.

통합의 좁은 확인 범위는 actual MG/함포 발사→같은 ID/좌표→실제 단발 피해→명중→종료, 부드러운MG와메시MG 중복0, base camera aim/실제 포구 불변, 반동·화면 반응의 발생·0.34초 안 회수·pause/retry/reset/reducedMotion, 작살 4시점의 촉·줄·반동 가독성, 대표 발사/명중/연기 3모드·모바일·외부요청·잔상이다. 기술 검사 통과를 사람의 아트·타격감 승인으로 쓰지 않는다.
