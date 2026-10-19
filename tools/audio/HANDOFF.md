# Cloudstitch 음향효과·오디오 v1

2026-10-18 한국 시간. **READY `audio-v1.0.0-ready`**: 다음 통합 revision에 연결할 구현 준비본이다. 실제 들을 수 있는 Web Audio 라이브러리·18 WAV·독립 청취 화면·읽기 어댑터·동결 controller host 예시가 있다. 현재 동결 통합 UI에 설치했다거나 사람이 최종 청취를 마쳤다는 뜻은 아니다.

소유 범위는 `tools/audio/`, `outputs/audio-v1/`, `work/audio/`다. 기존 변경·미추적 파일, 원화, 동결 v1 및 다른 담당 소스를 보존했다. 공통 package/잠금/의존성/LFS 설정 변경, pull/reset/일괄 복사, 새 채팅/자동화/외부 배포/유료 서비스는 수행하지 않았다.

## 실행과 재현

저장소 루트에서 Node 22 이상. 새 의존성이 없다.

```sh
node tools/audio/serve.mjs 8852
```

`http://127.0.0.1:8852/outputs/audio-v1/`에서 첫 클릭/키 입력 후 청취한다. `file://` 직접 열기 대신 저장소의 오디오 파일들을 로컬 HTTP로 제공한다. 서버는 127.0.0.1에만 바인딩하며 오디오 담당 경로만 제공한다. 브라우저를 자동 실행하지 않는다.

```sh
node tools/audio/generate.mjs
node tools/audio/verify-all.mjs "실제 통합 저장소 루트"
node tools/audio/finalize.mjs "실제 통합 저장소 루트"
node tools/audio/serve.mjs 8852 --integration-root "실제 통합 저장소 루트"
```

통합 루트의 이번 PC 위치는 `outputs/handoff/DESKTOP_INTEGRATION_LOCAL-2026-10-18.md`에 있다. 다른 PC에서 같은 절대 경로를 가정하지 않는다. host는 `/tools/audio/host.html`이다. 서버는 해당 root의 `tools/`를 `/integration-source/tools/`로 읽기 제공한다. host는 동결 `session.mjs`를 native ES module/JSON module로 가져오며 복제·편집·번들 교체를 하지 않는다. 현대 Chromium의 JSON module 지원이 필요하며 Safari/Firefox 호환은 미검사다. 자체 controller의 기본 메모리 저장소를 쓰므로 기존 통합 localStorage 저장키에 쓰지 않는다. WASD/J/Space/조준과 실제 command를 기존 controller로 전달하는 평면 연결 예시이며 최종 플레이 화면을 대체하지 않는다.

`generate`는 담당 WAV/catalog/PCM 보고서를 다시 쓴다. `verify-all`은 Node 검사 보고서를 갱신한다. frozen root를 생략하면 어댑터의 실제 소스 fixture와 controller 연결 검사를 생략한다. 최종 READY 생성은 실제 controller 보고서의 경계 해시를 필요로 한다. 공통 npm script는 추가하지 않았으며 필요하면 통합자가 위 명령만 공통 설정에 선택 반영한다.

## 방향과 실제 산출물

`outputs/34-sound-music-direction.txt`, `outputs/16-audio-accessibility-production.txt`는 기존 기획·레퍼런스이며 실제 음원 파일이 아니다. 저장소에서 기존 WAV/MP3/OGG/FLAC를 발견하지 못했다. 따뜻한 목재 충격, 천·밧줄, 황동 장치, 부드러운 모터·바람을 로컬 결정적 합성으로 만들었다. 음악·목소리·서사 전체는 후속 범위로 보존한다.

먼저 기관총·함포·목재·천·절단·회수 6종의 서로 다른 envelope/재료/길이를 PCM으로 확인한 뒤 18종으로 확장했다. 금속 비정수 모드, 목재 공명과 가시, 대역 천 찢김과 플러터, 저역 압력과 반동, 래칫·걸쇠를 별도 조합한다. 같은 잡음의 음높이만 바꾼 목록이 아니다. 세 변주는 seed+0/7919/15838이며 미세 재생률과 함께 사용한다.

`outputs/audio-v1/catalog.json`에 ID·용도·실제 event 조건·길이·seed·출처·이용권리·format·bytes·SHA256·임시 상태를 기록했다. 22050Hz mono PCM16 WAV18개, 합604,966bytes, 가장 큰 파일88,244bytes. WAV의 현재 Git LFS filter는 unspecified다. 작은 전체 묶음이라 공통 LFS 변경을 하지 않았다. 긴 ambience 파일을 저장하지 않고 2초 루프를 쓴다. 모든 음색은 **임시 절차 합성 시제품**이며 최종 녹음/상용 사운드가 아니다.

## API와 연결 경계

`runtime.mjs`: `createAudioEngine({contextFactory?,storage?,now?})` → `unlock()`, `play(id,{pan,gain,rate,variantKey,priority})`, `setLoop(id,on,{rate,gain})`, `setPaused(bool)`, `clear(reason)`, `setSettings(patch)`, `settings()`, `debug()`, `dispose()`.

`synthesis.mjs`: `SOUND_DEFINITIONS`, `synthesize(id,{sampleRate=22050,seed?})` → `{samples:Float32Array,sampleRate,duration}`. Node와 브라우저가 같은 PCM 합성 코드를 재사용한다. WAV를 fetch/decode하지 않아 네트워크 오디오 요청이 필요 없다.

`adapter.mjs`: `createAudioAdapter({audio,onCue?})` → `consume(events,snapshot,context)`, `update(snapshot,context)`, `commandResult(type,result,snapshot,context)`, `setHidden(bool)`, `reset(context)`, `dispose()`, `debug()`.

context는 **같은 현재 snapshot에서 얻은 `{voyageId,generation,camera}`**다. `snapshot.voyageId`와 `controller.battlefield.generation`을 전달한다. session snapshot 및 renderer event에는 generation이 없으므로 추측하거나 상수1을 쓰지 않는다. 어댑터는 전장 모듈을 import하거나 drain/advance/dispatch하지 않는다. 이미 UI/renderer가 읽은 동일 이벤트 배열을 공유하며 VFX의 이벤트를 빼앗지 않는다.

```js
const context = () => ({
  voyageId: controller.snapshot().voyageId,
  generation: controller.battlefield?.generation,
  camera: renderer.stats().camera,
});
// renderer 이벤트가 실제 표시된 프레임에 같은 배열을 읽기 전달한다.
const unsubscribe = renderer.onEvents((events, snapshot) =>
  bridge.consume(events, snapshot, context()));
// 매 프레임 snapshot 상태로 pause/loop/map 경계를 갱신한다.
bridge.update(controller.snapshot(), context());
// 실제 명령 완료 뒤: 먼저 경계 갱신, 이후 다음 simulation tick.
const result = await controller.command(type, payload);
const snapshot = controller.snapshot();
bridge.commandResult(type, result, snapshot, context());
// salvage/return 같은 명령 직후 snapshot.events는 이전 drain일 수 있다.
bridge.consume(snapshot.sim?.events || [], snapshot, context());
// visibilitychange -> bridge.setHidden(document.hidden)
// dispose -> unsubscribe(); bridge.dispose(); audio.dispose();
```

재개 명령 직후 advance 전에 update/commandResult를 호출한다. 숨김 동안 host가 simulation을 진행하지 않으며 입력과 accumulator도 정리한다. 중도 연결은 `reset({...context(),baselineSeq:snapshot.sim?.eventSeq||0})`로 현재 기록을 기준으로 삼고 과거 명중을 건너뛴다. restore는 기존 generation1을 재사용할 수 있어 명시 reset이 필요하다. 미래 이벤트에 넘길 context를 오래된 snapshot과 섞지 않는다. 정확한 읽은 소스7개 SHA/bytes는 `handoff-files.json`의 sourceBoundary 및 `controller-verification.json`에 있다.

## 실제 event와 연결 대기

| 원본 event/상태 | 오디오 규격 |
|---|---|
| `player-fire`, `enemy-fire` | weaponId `01-machine-gun`→기관총, `02-deck-cannon`→함포. 실제 탄 발사 때만 재생. 적 함포는 trainingPattern 간이탄 |
| `hit` | 실제 충돌 때 target/moduleId/enemyId로 현재·분리·화물 module.type 읽기. balloon→천, engine→엔진, 무기/connector→금속 대체, 나머지→목재 대체 |
| hit의 weaponId | 같은 재료 recipe에 기관총 gain×.72/rate1.04, 함포 gain×.95/rate.9. 다른 무기 ID는 새 고유 공격음으로 위장하지 않음 |
| `module-destroyed` + moduleType `connector` | 연결부 절단. 가짜 `connector-cut` 전장 event 없음 |
| `bundle-detached` / `salvaged` | 묶음 분리 / 회수 성공을 구별. 인양 진행 전용 event는 없어 진행 loop 연결 대기 |
| `player-repaired` + restored>0 | 실제 복구 cue, player anchor. 현재 session에는 현장 수리 command가 없어 원본 sim reader 지원 규격 |
| `combat-cleared` | 예약/단발/loop 정리. 같은 generation의 seq highwater는 유지. 아직 항해 중이면 다음 상태 sync에서 ambience 재개 |
| `sim.player.weight > lift` | 천 장력 loop + 진입 짧은 경고. 전용 위험 event를 만들지 않음. 체감 위험은 볼륨 상승 대신 장력 박자/속도로 변화 |
| 실제 sailing→harbor 또는 outcome→victory | 귀환 cue 단1회. 저장 실패와 실제 귀환은 구별 |
| 실제 `repair/equip/save` command 결과 | ok=true 각각 수리/장착/저장, false 실패. UI 클릭/견적은 무음. 자동저장 결과 별도 bridge는 연결 대기 |

원본 `hit`에는 authored material이 없으며 obstacle은 목재 대체음이다. 실제 장갑 재질/다른 무기 4종의 고유 탄도·피해·오디오, 별도 장전·조준·케이블 진행 상태, 사전 균열 예고는 후속 계약이다. 손상 event 없이 타임라인으로 명중음을 만들지 않는다. 필수 시각 경고를 소리로 대체하지 않는다.

## 믹스와 수명

첫 gesture 이후 AudioContext를 만들고 resume한다. 잠금/음소거/일시정지 동안 요청을 버리며 재개 때 queue를 재생하지 않는다. 전체/SFX/환경 볼륨, 음소거, 모노(center mono PCM), 낮은 동적 범위를 제공한다. 설정 손상은 기본값으로 복구하며 설정 저장 실패는 화면에 표시하고 세션 적용은 유지한다.

총 논리 voice 상한12, **위험+조작+피격 등 priority≥2 동시3**, 고정 loop최대3, buffer cache64, release tail24, ID별 연사 간격. 우선순위3은 즉시 위험이며 낮은 priority를 먼저 정리한다. 중요 cue가 있으면 환경음을 낮추고 compressor/soft limiter를 거친다. 12ms 정리 release tail은 논리 voice와 구분하며 최대24로 제한한다. max overlap 식별/청감은 아직 사람 검수가 필요하다.

loop는 상태 전환에서 시작/종료하고 속도·장력 변경은 양자화한 gain/rate만 갱신한다. 매 프레임 새로운 source를 만들지 않는다. 잠금·음소거로 실패한 loop start를 성공으로 cache하지 않으며 unlock/unmute 뒤 실제 runtime loop를 확인해 복구한다. engine/wind는 임시 XZ 속도에 따라 박자와 대역을 변화시키며 위험은 천 장력 패턴을 쓴다.

항해ID+generation+단조seq highwater로 중복/순서를 차단한다. per-shot Map이 없고 retired identity최대8·loop3만 보유한다. 숨김/일시정지/정비 동안 cursor는 앞으로 소모한다. 재시도/복원/출항은 명시 reset+baseline, 패배/귀환/맵 전환은 phase 경계 정리, dispose는 source/node/cache를 해제한다. 같은 세대 clear로 cursor를0으로 되돌리지 않는다. identity는 반드시 host의 최신 context가 권위이며 임의 과거 snapshot을 현재처럼 전달하지 않는다.

거리 감쇠는 player anchor와 source의 XZ LU 거리 `max(.12,1/(1+(d/22)^2))`, pan은 camera의 투영 오른쪽으로 dot/28을 −1..1로 제한한다. camera position/target 또는 right벡터를 받으며 fallback은 −Z를 보는 카메라의 +X=오른쪽이다. frozen renderer camera offset `[0,55,38.51]`은 이 방향이다. LU는 미터나 최종 공간음향 규격이 아니다. 가림/높이/잔향/도플러는 미구현이다.

## 실제 검사와 미검사

정식 집계는 `outputs/audio-v1/verification.json`과 개별 보고서를 따른다.

- Node PCM18종: seed결정성·변주·finite·길이·peak/RMS·끝점/edge·WAV bytes/hash 검사. 최대peak 약.64, 최소RMS 약.0443, 전체604,966bytes. 대표6개를 먼저 검사했다.
- runtime fake AudioContext17/17: unlock/음소거 backlog 없음, important3/voice12/critical3, 연사제한, loop1500갱신=3source, pause/clear/dispose, 손상설정, mono, unlock경쟁·dispose경쟁, rate 제한.
- adapter34/34: 중복/섞인순서/새generation/과거context/숨김·정비·재개/clear cursor유지/loop복구/명령결과/재료·무기/읽기보존/유한메모리. 실제 battlefield source fixture의 탄/충돌, 명시 connector강제손상·fixture위치 후 salvage/return은 실제 입력 항해와 구별한다.
- 별도 controller8/8: 실제 출항과 이동/조준/발사 입력216tick에서 player-fire16·enemy-fire1·hit13·bundle-detached1 관측. 원본 상태와 읽은 소스7개 SHA 보존, 반복 전달·pause/resume·dispose 검증. 강제 절단 타임라인이 아닌 실제 swept collision이다. 전체 항해/귀환 플레이 검증은 아니다.
- 로컬HTTP35/35: 화면/module/JSON/WAV/읽기mount 응답과 MIME, RIFF, 경로범위 거부 확인. 브라우저 렌더/오디오 재생 검증이 아니다.

**미검사**: native Web Audio·OfflineAudioContext, 실제 소리 출력/사람 청취, Chrome/Edge/Safari/Firefox, 모바일·스피커·헤드폰·모노의 경고 식별, 최종 통합 화면 command UI, 6맵 전환, 장시간 audio·CPU·hardware latency. PCM끝점 수치만으로 클릭 없음/편안함/재료 식별을 확정하지 않는다. 2초 loop에는 총10ms 얕은 taper가 있어 반복 청감을 확인해야 한다.

`/tools/audio/offline-check.html`은18종×3변주를 실제 OfflineAudioContext로 렌더해 peak/RMS/길이/끝점/seam JSON을 내려받는 실행 도구다. 현재 결과는 미실행이다. 재생률1·상수기본gain의 단일 cue경로를 측정하며 시작ramp/거리pan/ducking/동시혼합/실제 engine scheduling 측정과 구별한다.

## 다음 통합 요청과 QA 순서

동결 v1을 자동 교체하지 않는다. 통합자가 READY manifest 전파일 SHA/bytes를 대조한 후 담당 폴더를 다음 revision에 선택 반영한다. renderer.onEvents와 snapshot lifecycle, 실제 command 결과에 위 bridge를 추가하고 설정 panel을 UI에 mount한다. 오디오는 피해/시간/이동/보상/항해ID를 생성·변경하지 않는다. 기존 VFX drain이나 controller 저장키를 교체하지 않는다.

공통 변경 요청은 위 import/bridge/panel wiring과 선택 npm명령뿐이며 새 dependency/LFS 변경은 필요 없다. 자동 저장 소리에는 실제 저장결과 hook을 별도로 요청한다. 현재 자동저장 성공음 연결 완료로 표시하지 않는다. 실제 material 전용 필드·장전/인양진행·다른무기 event가 생기면 별도 계약을 받아 확장한다.

무거운 브라우저/음향 QA는 통합 담당에게 인계한다. 현재 순서는 새 플레이 화면→READY 단계맵→오디오다. 새 renderer/동결v1과 동시에 별도 브라우저를 띄워 검사하지 않았다. 오디오 QA에서는 gesture gate/설정, 실제 포구발사→탄충돌, 중복전달, 수리·장착·저장 실패, pause/숨김/retry/패배/정비/귀환/맵전환의 정리, 모노/작은음량차이와 시각경고, 3cue청취, Offline수치, 모바일overflow·외부요청을 확인한다. 청감 수정 뒤 READY를 새 revision/hash로 갱신한다.

전파일 manifest는 `outputs/audio-v1/handoff-files.json`이다. manifest자체를 제외한 모든 담당 소스·출력의 SHA256/bytes 및 읽기 sourceBoundary를 담는다. manifest자체 제외는 자기해시 순환을 피하기 위한 명시사항이다. 사용자의 검토/통합 전 원본이나 다른 담당 폴더를 일괄 덮어쓰지 않는다.
