# Cloudstitch cinematic-v5

사용자 직접 v4 표현 재반려: “훨씬더 10배이상 극적으로 만들어줘 아직도 이해를 못한것 같아”. v4는 기술 동작과 별개로 표현 반려를 유지한다. 최신10배는 질적 체감 목표이며 gain 배수/검사 수/숫자로 승인하지 않는다.

## 새 설계

v3/v4 DSP를 입력으로 쓰지 않는다. 최초 Float32 원재료를 사용하고 새 deterministic 합성 압력/저음 낙하, 짧은 광대역 파열, stereo 난류 분출과 여러 시점의 실제 재료 파편을 새 시간 구조로 배치한다. 27Hz 아래 정리, 압축/포화와 밀도 조절, stereo 확산 잔향이 뒤를 잇는다. 기록 재료와 합성층을 recipe에 별도 명시한다. 새 외부 샘플/API/유료 생성0.

첫 contact0초와10ms내 실제 신호를 유지한다. 긴 전조를 앞에 붙여 실제 발사 반응을 늦추지 않는다. 즉시 첫 충격이 나오고, 압력이 커지는 동안 분출·목재/금속 파열·반동·파편·공간이 뒤에서 전개된다. 실제 게임 설치·sim변경은0이다.

- MG: .76초 한 발, 짧은 강한 crack/압력·브리치/케이싱 재료. waveform 안에 추가 총성을 반복하지 않는다.
- 함포:4.6초, 거대한 저역 압력과 넓은 분출, 여섯 재료의 시간차 파열/잔해,2.75초 RT60 확산.
- 박격포:2.8초, 굵은 tube-thump와 압축 배기. 원 반려음/AB선택 대기는 유지한다.
- 피격/절단/인양: 재료의 첫 접촉과 구조 파열, 낙하 파편·긴 공간을 구분한다.
- 환경10루프: 원 프레임 수 유지, 연속 원재료 층/깊은 기계 pressure/긴 확산, 경계 완화. UI/경고는 원 contour를 포함하며 별도 작은 프로파일이다.

## 실제 청취 제시와 보존

대표3은 `outputs/audio-cinematic-v5/prototype-r1/`에 self-contained로 먼저 동결하고, 함포/MG/박격포의 실제 전후 WAV를 사용자에게 inline 제시했다. 각 파일은 v4→400ms 무음→v5, 전체 stereo RMS를 맞춘다. peak .72 이내로 비교하며 RMS/LUFS/사람 동일 체감음량은 구분한다. 이 대표3은 전체49를 만들 때 덮어쓰지 않는다. source/ 하위는 당시 DSP/생성/검증 코드 provenance snapshot이며 독립 repo 실행물은 아니다.

대표3 파일 검증62/62, fakeplayer43/43. 이는 실제 첫10ms 신호·PCM/RMS/gain/gap/hash·결정성·silent source gate·입력 불변·MG6발 합산 안전성이고 청취 품질 승인/Native가 아니다.

`source`는 반려 v4 비교 파일, `processingSource`는 최초 PCM, `file`은 새 v5이다. 이전 v1~v4, 모든 원FAIL/PASS와 박격포 반려/미선택을 보존한다. 대표동결 manifest와 v4의128+manifest129를 bulk슬롯에서 `preserve.mjs`로 검사한다. 비교문서의 기술PASS가 사용자 표현 반려를 덮지 않는다.

## 실행·역할

소유: tools/audio/cinematic-v5/와 outputs/audio-cinematic-v5/. 공통 package/lock/설치/LFS/서버/Native는 통합만 수행한다. 모델유지·추론medium, 추가agent0, 별도server/browser0. 대표3을 먼저연결하고전체49렌더/hash는통합I/O슬롯에배정한다.

```powershell
node tools/audio/cinematic-v5/render.mjs --ids=fire-machinegun,fire-cannon,mortar-launch-a
node tools/audio/cinematic-v5/auditions.mjs --prototype
node tools/audio/cinematic-v5/build.mjs --prototype
node tools/audio/cinematic-v5/verify.mjs
node tools/audio/cinematic-v5/verify-player.mjs
# snapshot-prototype은 최초에만, 이미동결된폴더가있으면다시실행하지않는다.
# 중앙 bulk I/O 슬롯 이후
node tools/audio/cinematic-v5/render.mjs
node tools/audio/cinematic-v5/auditions.mjs
node tools/audio/cinematic-v5/build.mjs
node tools/audio/cinematic-v5/verify.mjs
node tools/audio/cinematic-v5/preserve.mjs
node tools/audio/cinematic-v5/build.mjs --manifest
# 중앙 Native 단일슬롯과 새 QA폴더에서만
node tools/audio/cinematic-v5/verify-browser.cjs --playwright-root <existing-project> --channel chrome --url http://127.0.0.1:8840/outputs/audio-cinematic-v5/ --out <fresh-separate-QA-folder>
```

runtime은 새v5자체catalog/WAV와소유player3파일만필요하다. 재현은v4catalog/manifest와처음Float32·원decode provenance에읽기의존한다. 새PC는기존원MP3를중앙에서decode한후재현한다. 계정캐시/키는필요없다.

Native는기존검수엔진을쓴새v5 98decode/49pair/개별duration/대표AB/mono-loop/3cue/390px/error/dispose/보존11항목만한다. 새clip시간은각catalog에맞춘다. 기존v4 Native미실행취소를이번요구이행으로세지않는다. 음색·10배체감·장시간게임연사·실기기truepeak/청감/loop의자연스러움은사람검수대기다.
