# 함포·기관총 장면 비교 음향 r1

새 범위는 이 audio/와 대응 outputs audio/뿐이다. 기존 v1~v5·원본·이전 반려 이력을 보존한다. 최신 ‘10배 이상 과감함’은 체감 목표이며 gain 배수나 기술 검사 승인과 다르다. 실제 청취·시각 동기·사람 승인은 중앙 브라우저 단일 슬롯에서 진행한다. 유료/API 호출 0, 서버/브라우저 실행 0.

## 기준판

`outputs/audio-v1/previews/fire-cannon.wav`, `fire-machinegun.wav`, `hit-wood.wav`가 기준이다. 기존 절차 합성 시제품을 선택한 비교이며 모든 v5 후보와 비교했다고 주장하지 않는다. 발사 원음을 44.1k stereo로 재표본화하고, 목재 피격은 기존 adapter의 함포 rate .9/gain .95와 MG rate 1.04/gain .72를 적용한다. 재표본화는 linear이며 baseline 소리 질감을 개선하지 않는다. `assets.json`과 `verification.json.inputs`에 원본 경로/해시·변환을 기록한다.

## 새 음향

함포 발사 1.6초: 즉시 한 발의 crack → 하강하는 포구압 → 두꺼운 배기 → 황동 약실/포차 반동 → 목재 포대 공명/마찰 → 두 방향의 작은 공간 반사. 표적 폭발 원재료를 발사음에 섞지 않는다.

함포 목재 착탄 2.1초: 날카로운 접촉 → 비어 있는 판재 충격 → 실제 목재 파열 → 시간차의 갈라지는 나뭇결 → 구부러진 판재/선체 공동 울림 → 늦게 떨어지는 작은 파편. 함포의 낮은 포구압과 다른 골격이다.

MG 발사 .19초: 한 발 crack/짧고 무거운 약실 압력 → 짧은 브리치 → 볼트 복귀/작은 황동음. MG 착탄 .25초: 짧은 목재 물림·갈라짐·미세파편. 각 파형에 반복 총성은 없다. root가 실제 시연의 발사/명중 이벤트마다 각각 재생한다.

최초 녹음 PCM `work/audio/rich-v1/decoded/{hit-wood,hit-engine,machinegun-feed}.wav`의 짧은 조각과 새 deterministic 합성층으로 제작한다. v5 wave, 누적 EQ·gain 증폭을 입력으로 쓰지 않는다. `verification.json.recipes`에 각 층의 출입·길이·레벨·pan을 기록한다. 저음만 키우지 않고 발사/착탄/기계/재료의 역할과 큰 사건/짧은 반복의 시간 대비를 설계했다. 리듬은 .22초 간격 10발(마지막 1.98초)이며 hit +.10초는 오디오 검사 모델이다. 실제 장면의 명중시간은 root 이벤트가 결정한다.

## 비교·소비

`assets.json`은 4종의 old/new/oldMatched/newMatched WAV 경로와 길이, SHA를 제공한다. matched는 각 파일 전체의 stereo RMS를 동일하게 낮추되 peak .60 이하를 지킨다. 서로 다른 길이를 보존하며 LUFS·사람이 느끼는 동일 음량을 보장하지 않는다. 긴 tail의 RMS 평균 효과가 있으므로 짧은 어택의 체감과 전체 사건도 직접 비교한다. 기본 matched=true이며 원출력 비교는 matched=false다. 새 원출력은 peak .72의 단일 scalar 정규화만 적용하며 공통 RMS 강제·압축은 없다.

`player.js`의 `createComparisonAudio(data)`에 id별 `{old,new,oldMatched,newMatched}` base64 WAV를 전달한다. unlock/play/stop/dispose/debug를 제공한다. 단일 context와 master .28, 최대 4 voice(5ms 종료중도 포함), volume 0..1로 제한한다. 초과 cue는 누적/steal 없이 억제한다. stop은 pending play를 취소한다. 원음 최대 .721 기준 최악 동위상 4voice peak 상한 .808이다. 디코딩 후 현재 컨텍스트가 유지되며 dispose가 5ms release 뒤 닫는다. root는 scrub/선택전환/숨김/정지 때 stop을 호출하고 종료 때 dispose를 호출한다. 여러 player를 동시에 만들면 이 단일-player headroom 보장은 합산 전체에 적용되지 않는다.

## 검사와 한계

`node tools/combat-impact-comparison-v1/audio/build.mjs`는 새 경로의 파일만 생성한다. PCM16 재디코드·유한값/peak/종료·whole RMS·10발 fire+hit 합산·최대중첩·입력 SHA 불변을 검사한다. `node tools/combat-impact-comparison-v1/audio/verify-player.mjs`는 fake WebAudio로 context/디코딩 재사용·voice cap·5ms release·pending 취소·dispose를 검사한다. 실제 Native/오디오 재생이 아니다. 원재료 work가 없는 새 PC는 기존 원 MP3를 해당 담당 경로에서 복원해야 재현할 수 있다. 생성된 16 WAV 소비에는 work가 필요 없다.

실제 청감·새 표현 목표 승인·시각 동기·실기기 truepeak는 아직 미확인이다. sim/피해/명중 규칙 변경과 게임 설치는 하지 않는다. WAV LFS 전역규칙은 현재 없으므로 중앙이 필요하면 새 경로만 처리한다.
