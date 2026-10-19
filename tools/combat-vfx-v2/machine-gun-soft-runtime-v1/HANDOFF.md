# Cloudstitch 부드러운 기관총 · 실전 표시 모듈

새 revision은 `MG-SOFT-RUNTIME-READY1-2026-10-18`이다. 사용자 선택 `machine-gun-soft-v1`의 크림·연한 살구 붓결, 꿀빛 황동 탄환, 세이지 연기와 명중면 정렬을 실제 전투에 연결한다. 원 미리보기, painted-v1, v1-rich, v2는 보존한다. 신규 이미지/3D 생성과 유료 호출은 0이다.

`runtime.js`는 전투 이벤트를 읽는 표시 어댑터다. 사격·피해·탄·충돌·표적·오디오를 만들거나 변경하지 않는다. 실제 소비자 연결과 브라우저 확인은 전장·통합 소유자가 별도 실전 revision에서 수행한다. 이 모듈의 CPU 보고서만으로 설치·미술 승인·게임 전체 완성을 주장하지 않는다.

```js
import { createSoftMachineGunVfx } from './runtime.js';
const soft = createSoftMachineGunVfx(THREE, scene, {
  camera,
  atlasUrl: '../combat-vfx-v2/machine-gun-soft-runtime-v1/textures/soft-vfx-atlas.png',
  materialUrl: '../combat-vfx-v2/machine-gun-soft-runtime-v1/textures/soft-material-atlas.png',
});
await soft.load();
soft.consume(events, simulation.projectiles, generation);
soft.update(simulationDelta, simulation.projectiles, camera);
// simulationDelta = 0 while paused; retry/new voyage: soft.reset(newGeneration).
// Shutdown: soft.dispose(). setCamera(camera) also works.
```

`scene`은 변환 없는 월드 루트여야 한다. 각 효과 root도 identity TRS로 붙으며 내부에 월드 위치·방향을 한 번 적용한다. 기관총 이벤트와 기관총 projectile 목록을 기존 GLB 표시에서 함께 제외한다. 다른 무기의 이벤트/투사체는 기존 담당 모듈로 보낸다. 전역 종료·초기화는 양쪽에 전달한다. 카메라 반동을 별도 적용할 경우 실제 조준 ray는 안정된 기본 카메라가 소유한다.

`player-fire/enemy-fire`의 `seq, projectileId, weaponId:'01-machine-gun', x/y/z, direction{x,y,z}`가 단발 섬광을 만든다. 실제 projectile의 `id, weaponId, x/y/z, vx/vy/vz`가 탄환을 직접 움직인다. 빠진 y만 fire.y 또는 기존 기본 높이 1.3을 사용한다. +Z가 실제 이동 방향이다. 시간에 따른 위치 보간, 가상 비행 수명, 미리보기의 세 발 반복은 없다. `hit`는 실제 접촉 좌표와 0이 아닌 `normal`을 요구한다. 명중 코어와 여섯 잔광 Mesh의 +Y가 그 법선에 맞는다. 연기만 카메라를 향한다.

실제 hit가 있을 때만 .35초 명중 효과가 나온다. 같은 프레임의 후속 `projectile-ended`는 탄환만 제거한다. 빗나감·만료·목록 이탈은 명중 효과를 만들지 않는다. 단발 포구 효과는 .2초다. `combat-cleared/defeat/harbor-return`는 남은 표시를 정리한다. generation/seq/탄환 ID 중복 방지, 최근 종료 영수증 2048개, 종류별 단발32/탄환64/풀24개 상한을 유지한다. 상한 초과는 표시만 생략하며 실제 피해에 관여하지 않는다.

텍스처를 `atlas,metalTexture`로 주입하면 호출자가 소유하며 dispose하지 않는다. 직접 로드한 두 atlas와 인스턴스의 tile clone·geometry·material은 모듈이 정리한다. 비동기 로드 중 dispose와 부분 로드 실패 후 재시도도 정리 대상이다. `metalTexture` 없이 사용하려면 `materialUrl:null`을 명시한다.

상시 아트 기준 `docs/ART_DIRECTION.txt`를 적용한다. 선택된 부드러운 수채화 재료와 곡선 탄환, 섬광·붓결 코어·불씨·연기·목재 파편의 층을 유지했다. 명중면과 조준 가독성을 보존한다. 시각 자산은 이미 Native IAB에서 확인한 soft-v1과 같은 두 atlas다. 새 실제 전투 렌더·시간 연결·가독성은 통합 브라우저 보고서로 구분한다.

경량 검증은 기존 `work/combat-vfx-v2/deps/node_modules`의 Three/esbuild를 사용한다. 설치하지 않는다.

```powershell
$env:NODE_PATH=(Resolve-Path -LiteralPath work/combat-vfx-v2/deps/node_modules).Path
node tools/combat-vfx-v2/machine-gun-soft-runtime-v1/runtime.test.cjs
node tools/combat-vfx-v2/machine-gun-soft-runtime-v1/build.cjs
```

`outputs/combat-vfx-v2/machine-gun-soft-runtime-v1/manifest.json`이 소스·출력·테스트·읽기 의존성의 실제 크기/SHA를 결속한다. 이전 soft-v1의 frozen inventory와 선택 atlas SHA를 대조한다. 브라우저·서버·캡처는 통합 단일 슬롯만 사용한다.
