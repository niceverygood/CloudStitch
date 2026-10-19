# Cloudstitch · 극적인 함포와 작살 대표 연출

최신 `AGENTS.md`·`docs/ART_DIRECTION.txt`의 ‘현재보다 10배 이상 과감함’을 **표현 설계의 목표**로 적용한다. 앞선 impactful의 2~2.6배 프로필과 기술 PASS는 이전 revision으로 보존한다. 본 패키지는 단순히 그 scale·입자 수를 다시 곱한 결과가 아니다. 한 번의 사건을 접촉·분출·재료 파열·말리는 연기·잔불·반동 회복으로 나눴다. 현재 대표는 함포 발사·명중과 작살 발사이며, 나머지 45종을 새 기준까지 모두 완성했다고 표시하지 않는다.

## 형태·재료·시간

함포 명중은 짙은 먹색 접촉 자국과 크림 별 → 굵고 굽은 비대칭 붓꽃잎7개 → 중간 크기 목재/산호색 파편10개 → 크림·세이지 연기7덩어리 → 작은 황동빛 잔불9개로 구성한다. 큰 형태·중간 재료·작은 불씨의 크기와 출입 시점을 구별한다. 완전한 동심원이나 네온 원판으로 덮지 않는다. 같은 무기색과 승인된 부드러운 수채화 아틀라스를 재사용한다. 기본 광택·PBR 반사 대신 unlit 색·알파 붓면·입체 공간 배치를 쓴다.

- 함포 발사0.78초: 0~0.045초 압축된 주형태, 짧고 긴 방향성 붓섬광, 옆으로 갈라지는 압력 획, 후속 연기.
- 함포 명중1.10초: 0~0.06초 접촉, 0.06~0.30초 분출, 0.15~0.85초 말리는 연기, 이후 잔불/소멸. 가장 큰 폭은 실제 게임 표시단위 약5~7이며 피해 범위와 무관하다.
- 작살1.70초: 0~0.28초 장전/장력, 0.28초 양쪽 공통 발사, 레일 반동과 하나의 작살 가속, 감긴 줄→S자 채찍→길게 펴지는 줄, 회복·종료. 실제 걸림/견인 판정은 없다.

작살의 정확한 종료 시각·표본은 `dramatic-preview-v1/harpoon-motion.mjs`를 기준으로 한다. 새로운 부품/물리 소켓이 생긴 것이 아니라 기존 단일 메시 무기와 carrier의 표시 동작이다.

## 실전 소비 API

```js
import { createCombatVfx } from '../impactful-vfx-v1/vfx.js';
import { createCombatPresentation } from '../impactful-vfx-v1/presentation.mjs';
import { createDramaticCannonVfx } from './cannon-runtime.mjs';
import { createCombatFeedback } from './feedback.mjs';

const carriers = createCombatVfx(THREE, scene, {presentation:'impactful', effectScale:1});
const cannon = createDramaticCannonVfx(THREE, scene, {
  projectileVfx: carriers, camera, reducedMotion,
  // atlas를 주입하면 호출자 소유로 유지. 생략하면 로컬 PNG를 직접 로드.
});
const feedback = createCombatFeedback({reducedMotion});
const effects = createCombatPresentation({
  meshVfx:cannon, softMachineGunVfx, feedback, camera,
});
await effects.load();
effects.consume(actualEvents, sim.projectiles, generation);
effects.update(simDelta, sim.projectiles, camera);
const display = effects.sampleFeedback();
```

기존 impactful composite의 한 사건·한 표시 라우팅을 유지한다. 기관총은 별도 동결된 soft runtime 한 경로로만 간다. 함포의 fire/hit은 새 stage가 담당하고 기존 메시 모듈에는 actual 투사체 배열과 종료 이벤트를 전달한다. 내장 전시 궤적·가짜 3발·새 충돌·피해·HP·사거리 변경은 없다.

새 함포는 **active12·pool12**이며 한 stage는37개 유한한 textured mesh다. 투사체의 활성/종료·풀은 주입한 기존 모듈이 소유한다. 이벤트 seq/세대/shot 영수증을 검사하고 caller atlas를 수정하거나 처분하지 않는다. 직교 카메라의 붓면은 실제 camera quaternion을 따라 평행하게 정렬한다. root +Y 접촉 법선/+Z 발사 방향은 실제 입력을 유지한다. 잘못된 frame은 자원 할당 전에 거부하고, 자식 dispose 실패에도 자체 자원을 정리한다.

카메라·반동은 기존 통합 계약대로 **안정된 base camera로 조준한 후 최종 draw에만** 한 번 적용한다. muzzle resolver 전에 이전 표시 반동을 복구한다. 새 feedback는 함포 압축→해방→역방향 회복, 명중 접촉→반발→여운의 절대 age 곡선을 쓴다. 최대0.45 sim초 안에 끝나고 cameraXZ0.65/Y0.30·roll0.04rad·zoom0.035·무기반동0.60으로 제한한다. reducedMotion은 camera/roll/zoom0이다. 입력 지연이나 실제 시간 정지를 만들지 않는다.

## 음향 동기와 현재 한계

`feedback.drainCues()`는 실제 player-fire/enemy-fire/hit 하나에 큐 하나를 반환한다. `{id,generation,seq,eventTime,type,weaponId,position,normal?}`이며 최대64개다. 적 발사 큐는 플레이어 반동/조준을 바꾸지 않는다. 이 함수는 **오디오를 재생하지 않는다**. 통합이 원 실제-event 오디오 adapter와 큐 경로를 동시에 소리에 연결하면 중복이므로 하나만 선택한다.

음향 소유자의 grand-v4는 아직 청감 검수 후보이며 실제 게임에 자동 설치하지 않는다. 반려된 박격포를 자동 선택하지 않는다. 시각·동작·이벤트 시각의 동기 계약은 제공하지만 새 음원 재생/음량 맞춘 청감 A/B 완료를 이 패키지의 검사로 주장하지 않는다.

## 같은 조건의 비교

```sh
node tools/battlefield/dramatic-preview-v1/build.cjs
```

새 `outputs/combat-dramatic-v1/preview.html`에서 함포 포구/명중과 작살을 고를 수 있다. 왼쪽은 기존 v1, 오른쪽은 대표 재설계이며 같은 camera·배치·사건 시각으로 비교한다. 함포 후속 연기는 원 클립보다 길고, UI 타임라인을 양쪽 중 긴 연출에 맞춘다. 작살은 공통 발사0.28초 이전의 준비 동작도 보여준다. 나머지45종은 이전 impactful의 비교이며 최신 대표 설계까지 일괄 재제작하지 않았다.

대표 비교 권장: 함포 명중0.04/0.19/0.55/0.95초, 포구0.04/0.09/0.40초, 작살0.16/0.34/0.65/1.20초. 전체 선체와 효과 가까이 두 시야, 손그림·셀·원본 모드,390px 화면을 확인한다. 실제 함포 shotID·좌표·HP 변화와 stage 종료도 별도 실전 화면에서 확인한다.

## 실행 근거와 남은 작업

소스 담당 CPU: 함포 stage/runtime13건, feedback20건, 작살 모션9건 총42건 통과. 실제 Three 주입 texture·직교2camera×2법선×2원점·자원 처분·한 이벤트 한 stage·pause/세대/reset·입력 불변·유한 상한을 확인했다. 이는 실제 PNG 아틀라스의 화면 미술 승인이나 browser 렌더 검사가 아니다.

신규 소스만 동결하고 이전 원화·GLB·수정 전 FAIL/PASS·impactful15·soft runtime·canonical sim은 보존한다. 설치·유료 생성·export·브라우저 검사는 소스 담당이 실행하지 않았다. 기존 작살 IAB 열람은 별도 이전 슬롯에서 반환했다. 정확한 파일·읽기 의존성·검사 수는 manifest를 사용하며, 실제 기술/전후 미술 제시 결과는 통합의 새 보고서에서 구분한다.
