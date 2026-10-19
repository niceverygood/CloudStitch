# Cloudstitch · 함포 한 발 / 기관총 2초 연사 비교

사용자 요청: 실제 함선에 발사체·임팩트·반동·소리를 연결하고 기존판과 같은 조건으로 비교한다. 최신 ‘10배 이상 과감함’은 체감 목표다. 크기·gain 배수 또는 기술 검사 수로 미술·청감 승인을 선언하지 않는다.

## 실행

`outputs/combat-impact-comparison-v1/index.html`을 브라우저에서 연다. 모델·텍스처·음원·코드가 포함된 단일 오프라인 HTML이다. 추가 서버·API·유료 호출이 필요 없다. ‘소리와 함께 재생’을 누른 뒤 기존/신규 소리와 비교 음량 보정을 선택한다. 속도 변경·시간 이동은 무음이고, 정지·선택 전환·탭 숨김에는 소리를 종료한다.

저장소 루트의 `npm ci`로 준비한 Three.js/esbuild/Playwright를 우선 사용한다. 현재 PC의 기존 작업 의존성은 보조 탐색 경로일 뿐이다. 설치나 공통 package/lock 변경은 이 작업에서 수행하지 않았다.

```powershell
node tools/combat-impact-comparison-v1/build.cjs
node --test tools/combat-impact-comparison-v1/timeline.test.mjs
node tools/combat-impact-comparison-v1/audio/verify-player.mjs
node tools/combat-impact-comparison-v1/qa.cjs --out=verification-new
node tools/combat-impact-comparison-v1/qa-timing.cjs
```

브라우저 검사는 실행 시 localhost 임시 서버와 Chrome 하나를 사용하고 finally에서 둘 다 닫는다. 협업 중에는 다른 검수와 중첩하지 않는다. 기존 검수 폴더는 보존하고 새 `--out`을 지정한다. 원 음향 재제작에는 audio/README의 최초 PCM 의존성이 필요하지만, 생성 WAV의 사용과 HTML 빌드에는 해당 work 파일이 필요 없다.

## 무엇이 달라졌나

- 함포: 압축된 접촉점, 크림빛 고온 핵, 표면을 타는 큰 비대칭 곡선 붓꽃, 늦게 말리는 세이지 연기와 재료 조각. 기관총: 짧은 분출과 빠른 종료, 굵고 짧은 탄도 꼬리, 겹치는 명중에도 다음 발의 시작을 남기는 리듬.
- 실제 GLB 원무기를 원형 받침·목재 갑판·황동 보강대에 올렸다. 지지대 끝은 원 함선 HullAndCabin 삼각면 raycast로 연결한다. 화면의 원래 큰 방패·전개 받침발은 보존한 star4-artillery 원본의 구성이다.
- 반동은 새 무기 복제본의 표현 그룹에서만 움직인다. 판정 포구는 별도 datum으로 고정한다. 기존의 작은 반동과 신규의 빠른 밀림·작은 들림·감쇠 복구를 비교한다. 단일 메시 무기를 포신 부품별로 분해·리깅한 결과는 아니다.
- 발사 압력과 표적 파열의 음색을 분리했다. 함포는 약실·배기·포대 공명, 목재 착탄은 판재 충격·파열·낙하 파편, 기관총은 짧은 crack·브리치·볼트·작은 목재 물림을 시간차로 만든다. 원 v5 DSP 파일에 gain/EQ를 누적하지 않았다.

## 기준판과 권위

함선은 `outputs/ship-states-v1/star4-assets-v1/star4-artillery.glb`, 무기는 `outputs/weapon-modules/01-machine-gun/weapon.glb`와 `02-deck-cannon/weapon.glb`를 읽는다. 기존 기관총은 기존 soft-v1 표현 모듈과 soft-runtime 원화, amount1.5의 단일 muzzle/projectile/hit 모드다. attack 모드의 시각 복제 3발은 사용하지 않는다. 함포 기준은 combat-vfx v1 실제 효과 GLB 3개이며 내장 carrier 이동을 상쇄하고 실제 발사체 좌표만 따른다. 음향 기준은 audio-v1 발사와 목재 피격 원음이다. 최신 v5 후보 전체에 대한 승리 주장이나 모든 과거 버전 비교는 아니다.

한 번 기록한 `tools/battlefield/sim.mjs`와 integration의 실제 이벤트·발사체 snapshot을 양쪽이 공유한다. MG는 0.22초 간격으로 `[0,2)`에 10발을 쏘고 잔여 탄환이 2.44초까지 명중한다. 함포는 현 player가 MG만 지원하므로 기존 enemy 훈련 함포 actor를 화면의 귀환호에 대응한다. 실제 발사부터 1.19초에 명중하며 피해9를 그대로 사용한다. 고내구도 MG 훈련 표적에는 80피해, 빗나감은 양쪽 모두 0명중이다. 전투 엔진·캠페인에 플레이어 함포를 새로 구현한 결과는 아니다.

표적은 원형 판정에 대응하는 목재 시험 선체다. 실제 GLB 삼각면 충돌이나 선체 영구 파괴를 구현하지 않았다. 순간 파편·표시 흔들림을 손상 규칙으로 해석하지 않는다. 명중 법선·탄체 중심·발사 방향과 실제 종료는 기존 권위를 따른다.

## 보존·검증

새 쓰기 경로는 이 tools/와 대응 outputs/뿐이다. 원 함선·무기·VFX·원화·음원·sim·공통 패키지·다른 담당 출력은 읽기만 했다. `baseline-inputs.json`/manifest에 원본 11개 크기·SHA를 고정하고 재빌드 시 바뀌면 실패시킨다. nested outputs/.gitattributes로 새 대형 HTML과 이 경로의 WAV만 LFS 적용한다. commit/push/다른 채팅 메시지/유료 생성은 수행하지 않았다.

최초 `verification/`은 포구 가림·초기 미술 캡처와 blob URL 오분류 실패를 보존한다. `verification-r2/`는 장착 노출과 새 형태의 재확인, `verification-final/`은 31개 실제 브라우저 검사(실제 GLB, 16 WAV decode, MG 10발/10피격 cue, pause/dispose, miss, 세 표시 모드, 390/768, 반복 교체 자원 해제, 모드별 실제120프레임 회전 후 동일 출력)를 기록한다. 후속 타이밍 변경의 영향 검사는 별도 보고서로 구분한다. 스크린샷은 root가 직접 확인했다. 기술 통과는 사람의 미술·청감·손맛 승인이 아니다.

`audio/comparison-cannon.wav`, `audio/comparison-machinegun-2s.wav`는 실제 같은 이벤트의 **기존 → 0.4초 무음 → 신규** 청취 비교다. 전체 클립 stereo RMS 감쇠 보정이며 LUFS 또는 동일 체감 음량을 보장하지 않는다.

연사 박자는 각 실제 이벤트의 sample index를 한 AudioBuffer에 배치해 GPU 프레임과 분리한다. 화면은 해당 source의 예정 시작 시각과 같은 절대 clock을 사용한다. pause/resume에는 남은 실제 cue와 직전 소리의 tail을 현재 offset부터 구성하며 추가 발사 이벤트를 만들지 않는다. 실제 오프라인 file URL, Native sequence, 렌더 stall 이후 clock, decode 중 취소와 남은 tail은 `verification-timing/browser.json`에서 별도 검사한다.
