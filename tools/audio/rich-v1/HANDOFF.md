# Cloudstitch audio-rich-v1 인계

## 범위와 상태

사용자 요청: 전체 효과음을 더 풍성하고 극적으로 만들고 저음을 살짝 가미한다. 기존 ElevenLabs 기반 47종과 박격포 A·B 후보 2종을 재생성 없이 오프라인 PCM으로 보강했다. 논리적 효과음은 47종, 비교용 소스·새 출력은 각각 49개다.

- 새 소스·도구: `tools/audio/rich-v1/`
- 새 검수 산출물: `outputs/audio-rich-v1/`
- 디코딩 중간물: `work/audio/rich-v1/` (전달·커밋 제외)
- 열람: `node tools/audio/rich-v1/serve.mjs 8866`, `http://127.0.0.1:8866/outputs/audio-rich-v1/`
- API 요청·유료 생성·의존성 설치·게임 소스 수정: 0
- 게임 설치 및 사람 청취 승인: 미완료

원 `fire-mortar` 발사음은 사용자에게 부적합 판정을 받은 상태를 유지한다. `mortar-launch-a/b`는 선택 전 후보다. 새 보강본은 모두 검수 전이며 기존 승인을 승계하거나 자동 승인하지 않는다.

## 실제 처리

Native Chromium `OfflineAudioContext.decodeAudioData`로 보존 MP3를 44.1kHz float PCM으로 변환했다. 원본 디코더의 1 초과 샘플을 중간물에서 자르지 않도록 IEEE_FLOAT32 WAV로 보존한다. 이 변환은 실제 재생이나 사람 청취 검사와 별개다.

`dsp.mjs`는 49개 ID별 레시피를 사용한다. 원래 공격 순간을 기준으로 재료 대역 공명, 병렬 부드러운 포화, 얇은 고역 질감, 7~40ms 양의 짧은 반사, 짧은 60~100Hz 저음층을 더한다. 새 발사 횟수나 환경 루프의 별도 박자를 만들지 않는다. 35Hz 아래를 정리하고 최종 sample peak 목표를 .79로 제한한다. 단발의 추가 길이는 최대 .18초, 루프는 원본 프레임 수를 유지한다.

추가 저음층 에너지는 보정한 소스 에너지 대비 최대 2.4%이며 루프 .4%, UI .3%, 경고 .4% 상한을 적용한다. 이는 추가 레이어의 수치 예산이며 체감 저음량이나 전체 원본 대비 저역 에너지 상승률이 아니다. 원본과 출력의 LF proxy는 필터 정리·정규화 영향으로 감소할 수도 있다. DSP 지표의 LF는160Hz 2차LP, 독립 파일검사의 LF는180Hz 1차LP 근사치이므로 서로 직접 동등한 수치로 비교하지 않는다.

출력은 49개 stereo 44.1kHz PCM16 WAV, 합계16,582,724B, 실제 최대 sample peak .789978이다. 원본 복사49 MP3는1,502,974B이다. 가장 큰 WAV는1,058,444B이며 기존 `.gitattributes`에서 WAV의 LFS filter는 지정되지 않았다. 공통 LFS 규칙은 수정하지 않았다.

원본의 크기가 서로 크게 다르므로 raw RMS 상승을 음색 개선의 증거로 사용하면 안 된다. 비교 플레이어는 쌍별 공통 RMS 목표(min .18 및 양쪽 peak .8 상한)를 사용한다. 모노는 양채널 평균이다. 외부 EQ 없이 새 WAV에 담긴 처리를 재생한다. 기본 전체 음량은 .4다. 다중 시연은 활성 최대3voice와 level합 headroom을 사용한다. 이 미리보기의 상한을 실제 연사 전체 중첩과 동일하게 취급하면 안 된다.

정지·A/B전환·voice 교체는5ms release fade 후1ms 여유를 두고 stop하며 onended 뒤 disconnect한다. release 중인 소스도 headroom에 포함하고 새 소스는 release stop 뒤 시작한다. 예약 여유는3ms ramp, 회복은12ms 평활이다. hidden·dispose·whenIdle은 release 완료까지 정리를 기다리며, interrupted/suspended 기기에서 onended가 멈추면80ms watchdog이 정리한다. 이 예약 검증 자체는 사람이 듣는 클릭 잡음 부재를 보증하지 않는다.

## 검수 UI

49개 검색·범주·원본/새 버전 A/B·동일 RMS 비교·모노·반복·정지·순차 재생·경고/피격/발사3종 동시 시연·MP3/WAV 다운로드를 지원한다. 탭 숨김·정지·설정 변경·이동 시 예약과 비동기 디코드 결과가 뒤늦게 재생되지 않게 취소한다.

검수 메모는 `cloudstitch:audio-rich:v1:...` 별도 namespace에 저장한다. JSON import는 schema, catalog version/fingerprint, 전체 ID·원본 SHA·새 WAV SHA가 일치해야 한다. 기존47 검수실과 박격포 비교실의 메모·파일은 건드리지 않는다. 서버는127.0.0.1의 두 새 폴더에 GET/HEAD만 제공한다.

## 재현과 검사

```powershell
node tools/audio/rich-v1/prepare.mjs
# 아래 변환은 통합 담당의 단일 Native 브라우저 슬롯에서 실행한다.
node tools/audio/rich-v1/decode-native.cjs --playwright-root <existing-playwright-project>
node tools/audio/rich-v1/render.mjs
node tools/audio/rich-v1/verify-dsp.mjs
node tools/audio/rich-v1/verify.mjs
node tools/audio/rich-v1/verify-player.mjs
node tools/audio/rich-v1/verify-mix.mjs
node tools/audio/rich-v1/build.mjs
node tools/audio/rich-v1/serve.mjs 8866
# 별도 터미널
node tools/audio/rich-v1/verify-http.mjs
node tools/audio/rich-v1/build.mjs --manifest
# 최종 Native UI 검사: 통합 담당 단일 슬롯에서, 별도 보고 폴더에 기록
node tools/audio/rich-v1/verify-browser.cjs --playwright-root <existing-playwright-project> --channel chrome --url http://127.0.0.1:8866/outputs/audio-rich-v1/ --out outputs/audio-rich-browser-qa-v1
```

- `file-verification.json`: 실제49 PCM16/원본49 SHA/float중간물 SHA·독립계측/프레임·채널/단순gain외 변화/꼬리·경계·유한값/저음 예산, **592/592 PASS**.
- `dsp-verification.json`: 결정성·입력 보존·설정·테일·루프·저음 예산 등 fixture, **26/26 PASS**.
- `player-verification.json`: 시간 진행·예약 stop/onended를 구현한 fake AudioContext의 재생·release정리·취소·priority·cache·hidden/suspend·메모 경계, **43/43 PASS**. Native 재생 검사가 아니다.
- `http-verification.json`:98개 음원의 실제 HTTP body SHA·크기·MIME와 엔트리·의존성·경로·read-only, **107/107 PASS**.
- `mix-verification.json`: 실제 PCM의 preview3voice·release·headroom/3cue4조합/모노 모델과 **별도의 uncapped6발**을 구분해 **31/31 PASS**. 최대 preview혼합 peak .790975,3cue .496625,49종 최소 mono RMS 보존율 .5770. 별도6발은 .22초 간격·전체 .845초 꼬리 보존·6시작·퇴출0·최대4중첩이며 raw peak stereo.789978/mono.757446,보수적고정1/4headroom후최대.197495이다. LFproxy와부착bass6공격의시각도기록한다. 실제 전투 믹스나 청취 승인,임의 미래 조합 전체의 보증이 아니다.
- 최종 Native UI 검사는 `verify-browser.cjs`를 통합 담당의 단일 슬롯에서 실행하고 별도 `outputs/audio-rich-browser-qa-v1/`에 보고한다. 새49쌍(원본/보강98파일)의 Native 디코딩은 이 UI에서 전49쌍의 RMS정규화를 비교하기 위한 범위이며 이전47 QA의 재실행이 아니다. 보호 범위는 새전달manifest/파일과직접참조49원MP3만이다. `decoding.json`은 제작용 디코딩 기록이며 이 최종 검사를 대신하지 않는다.

모든 수치 검사는 사람의 풍성함·극적 느낌·저음 취향 승인과 다르다. Sample peak는 inter-sample true peak나 LUFS가 아니다. 원래 재질 인지·경고 식별·실전밸런스·실제 게임 설치는 후속이다.

## 원본 보존 및 전달 경계

기존 manifest와 실제113·18·46파일을 재검사해 동일함을 확인했다. 원본·기존 검수 소스·게임 통합본·공통 패키지·이전 실패 보고서는 수정하지 않았다.

| 보호 manifest | SHA256 |
| --- | --- |
| `outputs/audio-review-v2/delivery-manifest.json` | `7b28cb10dee8b8654517be78a9f5529f9a3da165e61effa6624920cf01ebbfd9` |
| `outputs/audio-mortar-r1/delivery-manifest.json` | `d26e06f53b14d37a01613ae7b2e94768fe82cd23bbcde172b51ae661f3d8ae2e` |
| `outputs/audio-v1/handoff-files.json` | `f13f36398d8a52536b4c5885050d29de634b82391d591ae2a91f4204a84dccd6` |

새 delivery manifest는 새 tools/output 폴더만 해시하며 자기 자신과 work중간물을 제외한다. 통합 담당은 SHA 검증 후 선별 복사하고 기존 게임에 자동 연결하지 않는다. 기존 mortar 피드백과 A/B 미선택 상태는 그대로 전달한다. API 키·인증 헤더·계정 캐시는 전달하지 않는다.
