# Cloudstitch audio-grand-v4 인계

## 목적과 경계

사용자 요청은 모든 효과음의 경박한 인상을 바꾸고, 웅장하고 풍성하며 극적인 표현을 더하는 것이다. 최신 프로젝트 공통 지시 ‘현재보다 10배 이상 과감하게’도 적용한다. 이 수치는 표현 목표이며 gain 배수나 기술 PASS의 승인 점수가 아니다.

소유 범위는 `tools/audio/grand-v4/`, `outputs/audio-grand-v4/`다. v2는 사용자 비교 기준, v3는 이전 기술 초안으로 동결 보존한다. v3를 최신 10배 지시의 최종 이행으로 승격하지 않는다. 이전 박격포 원본 반려와 A/B 미선택 상태, 모든 v4의 사람 청취 승인 대기를 유지한다.

공통 package/lock/LFS/서버 변경0, 담당 브라우저/Native 실행0, 유료 호출0, 실제 게임 설치0. 통합 담당이 공통 서버8840에 선별 import하고 한 슬롯에서 Native 검수한다. 모델은 유지, 추론 medium 및 필요한 신규 검사만 수행한다.

## 실제 구성

- 입력은 최초 원 MP3를 이전 Native Chromium에서 디코딩해 보존한 Float32 49개다. v1/v2 EQ 결과에 누적 처리하지 않는다.
- `base-dsp.mjs`는 동결 v3 DSP와 byte-exact 동일하다. 원재료 음고 낮춤, 저중역 모노 몸통, linked dynamics와 따뜻한 포화, 어두운 반사/확산을 바탕으로 한다.
- v4는 실제 원 라이브러리의 압력·목재·황동/장갑·기계·바람 fragment를 주 접촉에 정렬한다. 그 뒤 재료 잔해와 큰 공간의 확산이 이어진다. 각 stem의 ID/SHA/offset/구간/rate/mix를 기록한다.
- 기관총은 짧은 압력과 마운트/브리치 접촉, 함포는 큰 압력 덩어리와 목재 지지대·황동·기계 반동 및 긴 방출, 박격포는 관 압력·받침 반동·배기를 구별한다. UI는 짧은 물성 접촉, 루프는 지속적인 환경·목재·기계 층으로 구성한다.
- 다른 전체 총성 복사, 독립 발사 박자·음악·대사·oscillator 추가0. 소리 한 번의 내부 재료층이다. 공통 최종 sample peak 목표 .71, 루프10개는 입력 프레임 수를 보존한다. 길이가 늘어난 단발은 실제 연사에서 더 겹칠 수 있다.

`source`/`metrics.source`는 비교용 v2 WAV, `processingSource`/`metrics.processing`은 최초 Float32, `file`/`metrics.output`은 새 v4다. 재료 라이브러리도 이 최초 Float32만 쓴다.

## 실제 비교 제시

검수실은 49쌍 v2↔v4, 전체 클립 RMS 맞춤, 모노/loop/5ms release/최대3cue/.36level 시연, v4 전용 메모/JSON을 제공한다. 게임 mixer가 아니다.

대표5개 실제 청취 파일: `auditions/fire-machinegun-ab.wav`, `fire-cannon-ab.wav`, `mortar-launch-a-ab.wav`, `hit-wood-ab.wav`, `engine-idle-loop-ab.wav`. 각각 앞v2→350ms 무음→뒤v4다. 실제 PCM16 전체 RMS를 같게, 양쪽 peak .65 이내가 되도록 gain을 계산한다. 길이는 각 원래 파일 전체를 보존한다. `audition-catalog.json`에 구간과 gain/SHA를 기록하며, 기술 검증기가 실제 샘플을 별도 검사한다. 이는 LUFS나 사람의 동일 체감음량 보장이 아니다.

## 검증과 한계

`file-verification.json`은 실제49출력/원본 역할별 SHA, v2 121파일·v3 118파일 보존, v3 base byte 동일, donor ID/SHA, pitch+tail 프레임 수식, 유한 PCM/peak/DC/mono/loop 경계, 결정성·주입력/라이브러리 불변·silent gate, 실제 MG6발.22초/3cue 무감쇠 합산과 별도 headroom, 대표5쌍 실제 RMS/gain/peak/무음을 검사한다. 보고서의 raw sum이 unity를 넘으면 그대로 보존하며 실제 UI mixer 결과와 구별한다.

`player-verification.json`은 fake AudioContext 수명/중단/취소/메모 경계이며 Native나 청취 검사가 아니다. Native 하네스는 통합이 새 QA 폴더에서 한 번 수행하는11항목이다: 98WAV 디코딩·각 파일 duration,49쌍 실제 RMS/peak,라벨·메모·다운로드,MG이전/새/AB,모노loop release,실제3cue,390px,오류·dispose·원본보존. 기존 broad v1/v2 검사는 반복하지 않는다.

첫 파일검사는788/799로, 루프10개가 실제로 소비한 donor 길이를 명목값1초로 적은 메타데이터 실패10개와 집계1개를 기록했다. 원 보고서를 `file-verification-before-metadata-fix.json`으로 보존했다. 최종 DSP식 `outputDuration*rate`로30개 stem의 길이 명세만 고쳤으며 실제49WAV SHA는 동일하다. `metadata-correction.json`에 전후 catalog SHA와 변경필드를 기록했다. 통과로 덮어쓴 이력이 아니다.

최종 파일검사799/799 PASS, fake player43/43 PASS다. 출력49WAV21,202,664B/총120.1843초이며 이전49WAV16,582,724B, 대표비교5WAV4,358,644B다. MG1.1424초/함포2.9039초, 루프10개는원길이보존이다. 실제6발.22초간격 무제한합산은6중첩/rawpeak.7276611,1/6headroom후.1212769다. 실제3cue 무감쇠합산은peak1.1469116/22samples>=1을그대로보고하고,1/3headroom후peak.3823039다. 이는실제UI의각.36level/headroom/volume적용과구별한다. 대표5쌍RMS차최대3.19e-8/peak최대.649994다. 최종파일검사는이전실패전후49WAV SHA가동일함도확인했다. Native는통합의별도보고서가생겨야완료다.

표현의 웅장함, 경박함 해소, 무기 식별, 루프 질감, 실제 게임 연사·장기 밸런스와 사람 청취 승인은 남아 있다. 기술 검사 수·RMS·주파수·peak를 ‘10배 승인’으로 쓰지 않는다.

## 재현

```powershell
node tools/audio/grand-v4/prepare.mjs
node tools/audio/grand-v4/render.mjs
node tools/audio/grand-v4/auditions.mjs
node tools/audio/grand-v4/build.mjs
node tools/audio/grand-v4/verify.mjs
node tools/audio/grand-v4/verify-player.mjs
node tools/audio/grand-v4/build.mjs --manifest
# 통합 담당의 단일 Native 슬롯, 이전 기록을 덮지 않는 새 출력 폴더
node tools/audio/grand-v4/verify-browser.cjs --playwright-root <existing-project> --channel chrome --url http://127.0.0.1:8840/outputs/audio-grand-v4/ --out <fresh-QA-folder>
```

읽기 의존성: v2 manifest와49WAV, v3 manifest·117파일, `tools/audio/rich-v2/verify.mjs` 측정 helper, v1 input-catalog의 원MP3 49개, `work/audio/rich-v1/decoding.json`과 Float32 49개. work는 전달·커밋 제외다. 새 PC에서 없으면 통합 담당이 기존 원MP3 hash 확인 후 기존 native decode 도구로 복원한다. API/인증은 필요 없다.

새 WAV103개(이전49+출력49+대표비교5)의 폴더별 LFS 추적은 통합 소유자가 처리한다. 배포manifest는 소유source/output만 포함하며 자기manifest와work는 제외한다. 실제게임오디오 연결은 별도 단일 소비 경로를 정해야 하며, 기존 sim adapter와 새 feedback cue를 동시에 재생해 중복시키지 않는다.
