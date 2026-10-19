# Cloudstitch audio-grand-v3 인계

## 목적·경계

사용자 최신 직접 요청: 모든 효과음이 경박하므로 전체적으로 웅장하고 풍성하게, 극적인 표현을 더한다. 최초 생성 MP3의 보존 Float32 PCM에서49개를 새 재료 체인으로 구성했다. 비교 대상은 앞선중저음 v2 WAV이다.

- 소유: `tools/audio/grand-v3/`, `outputs/audio-grand-v3/`
- 이전보존: v2 manifest `26cb7743a373c99126fab156fa80c9927bea2904a4757406a73067e3198db823`의120파일+자체manifest=121
- 입력/읽기의존성: v2 enhanced49WAV, v1 input-catalog의 최초MP349개 및 native decode receipt와 Float32중간물
- work: `work/audio/grand-v3/`와 기존 `work/audio/rich-v1/decoded/`; 전달·커밋 제외
- 공통 package/lock/설치/LFS/서버 수정0, 브라우저·Native 자체실행0, API·유료생성0, 실제게임 hookup0

COORDINATION과 ART_DIRECTION을 적용한다. 목재·황동·천·포신·기계의 구별과 풍성한 층/여운을 소리의 재질로 반영했다. 새 시각 자산은 만들지 않았고, 규칙 적용을 이유로 동결 자산을 다시 생성하지 않았다. 주인공 폭발 시연의 시간축·실제 전투 이벤트와 자동 연결하지 않는다.

## 처리와 실제 변화

DSP `dsp.mjs` SHA `1b6dcc001725656f752fc6271fd3ef7957a5c68e91d8a233b33bc5df6794bd90`.

원 MP3를 Native Chromium으로 디코딩해 보존한 IEEE_FLOAT32 자료를 재사용한다. 새 native decode/API 요청은 없다. v1/v2 EQ처리를 입력에 누적하지 않는다. `processingSource`는 이 최초PCM/원MP3/receipt 연결이고, `source`는 A/B비교용 v2 WAV이다. `metrics.source`도 비교v2, `metrics.processing`과`metrics.original`은 최초PCM,`metrics.output`은새v3로구분한다.

- 재질별 pitchRatio .72~.94로 재료의 실제 음고를 낮춘다. 단발은 source resampling으로 전체 소리를 보존하면서 길어지고, loop는 두창 순환 pitch 처리로 원래 프레임 수를 유지한다.
- 35Hz highpass,4.0~6.7kHz lowpass와2.6kHz이상 부드러운 shelf감쇠로 날카로운 고역을 줄인다.
- 원음에서 만든 모노 재료핵을118~270Hz중심/680Hz lowpass로 두텁게 겹친다. 저음의 위상상쇄를 줄이는 모노 reference fallback을 기록한다.
- linked envelope 압축·따뜻한 포화·소스 어택 보강으로 몸통 밀도와 충격 윤곽을 조절한다.
- 짧고 조밀한 반사와 어두운 피드백 지연/두 allpass확산으로 공간을 만든다. 단발 추가 tail은.035~.67초이며 소리마다 다르다. MG는짧게, 함포/폭발은더길게 둔다.
- 피크 목표.72로 공통 레벨을 보정한다. 새 총성·독립 박자·음악·음성·정현파 oscillator는 추가하지 않는다. 소리에서 유래한 필터·공간 층이다.

입력비교v2 WAV49개16,582,724B, 새PCM16 WAV49개19,294,884B. 출력44.1kHz/stereo이며 개별실측최대 samplepeak.7199707,클리핑0/DC최대.000152643이다. 루프10개는원래길이보존·경계sample0이며 단발은pitch와여운에따라길이가변한다. 같은발사쿨다운에서소리가더겹칠수있으나게임규칙/실제audioadapter는수정하지않았다.

## 비교·검수

이전v2 WAV와새v3 WAV를 별도파일로제공한다. 기본RMS맞춤은 전체클립평균이며Native디코딩후쌍의실제peak를사용해.8이내로한다. 길이와다이내믹이다르므로 RMS값을사람의동일한체감음량·웅장함으로승인하지않는다. 화면의추가EQ는없다.

기존검증된5ms release→1ms여유 stop→onended정리,active/releasing headroom,모노/숨김/비동기취소/최대3시연을재사용한다. v3의schema `cloudstitch-audio-grand-review/v3`와 `cloudstitch:audio-grand:v3:*` 저장공간은기존메모와분리한다. SHA/버전이같은검수JSON만읽는다.

최초 박격포 발사 반려·AB후보 미선택, 이전톤이 경박하다는 최신 피드백은 유지한다. 전49v3는새청취후보이며숫자로음색승인하지않는다. 이전기술적PASS는이번v3의취향승인을의미하지않는다.

## 실제 자체검사·한계

`file-verification.json` **646/646 PASS**:

- 실제49 PCM16·비교v2 exactcopy·원Float32·최초MP3·decode receipt SHA/ID/frame연결 및v2의121개보존
- pitch/tail 수식,루프프레임·경계/첫끝구간,peak/finite/DC/edges/mono 및출처별역할분리
- fixture4/4: 실제880Hz tone이함포recipe.73에따라642Hz로이동,결정성/입력불변/프레임·loop·tail안전
- MG6발.22초간격 무제한합산:시작6/퇴출0/최대5중첩,rawpeak.7201538/RMS.1383366. 고정1/4후peak.1800385,실중첩역수1/5후.1440308
- 대표3cue 무감쇠raw합산은peak1.1017761/13samples>=1을그대로보고한다. 이는사용자플레이어나게임mixer가아니며,1/3headroom후peak.3672587/클립없음이다. 개별파일클리핑0과별개다. 실제UI는각.36level과headroom·전체volume을적용한다.

`player-verification.json` **43/43 PASS**: 시간진행fake AudioContext의재생·5msrelease·숨김·취소·메모/DOM경계이다. Native출력이나사람청취가아니다.

Native하네스는새49쌍98WAV디코딩/개별duration/49쌍RMS·peak.8/대표MGv2-v3-AB/mono loop release/실제3cue source3/390px/오류·보존의11항목이다. 실제3cue의사람식별이나미술·음색승인은포함하지않는다. 48k리샘플링peak는원PCM samplepeak와구별한다. 기존v1/v2 Native실패·후속·최종보고서는반복하거나덮어쓰지않는다.

후속필요: 사람의웅장함·경박함해소·단발타이밍·loop질감·3cue식별/장시간게임밸런스검수와선택. 새게임설치/소켓/실제효과동기화는이번범위에없다.

## 재현·인계

```powershell
node tools/audio/grand-v3/prepare.mjs
node tools/audio/grand-v3/render.mjs
node tools/audio/grand-v3/verify.mjs
node tools/audio/grand-v3/verify-player.mjs
node tools/audio/grand-v3/build.mjs --manifest
# 통합 담당 단일 Native 슬롯에서만 실행, 별도빈QA폴더를지정
node tools/audio/grand-v3/verify-browser.cjs --playwright-root <existing-playwright-project> --channel chrome --url http://127.0.0.1:8840/outputs/audio-grand-v3/ --out <fresh-separate-QA-directory>
```

새PC에기존work자료가없으면먼저기존MP349와SHA를검사하고,통합담당이`tools/audio/rich-v1/decode-native.cjs`로읽기의존성원본을Float32로다시변환한다. 계정캐시나API키가필요한과정이아니다. 새grand manifest는자기소유source/output만포함하고work·자기manifest는제외한다. 사용자열람경로는통합선별import후`http://127.0.0.1:8840/outputs/audio-grand-v3/`이다. 공통서버/LFS/패키지는통합소유자가처리하며새WAV원본49+출력49만해당폴더별LFS추적이필요하다.
