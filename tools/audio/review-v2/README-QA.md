# Cloudstitch SFX 검수 v2: 파일 검사 경계

이 검사는 새 `outputs/audio-review-v2/`의 산출물만 보고서를 갱신한다. 기존 `outputs/audio-v1/` 46파일, 기존 통합 v1, ElevenLabs 기관총 원본은 읽기 참조한다. 공통 package/lock/의존성 및 실제 게임 오디오는 변경하지 않는다.

저장소 루트에서 Node.js로 실행한다. 새 라이브러리나 브라우저가 필요 없다.

```sh
node tools/audio/review-v2/verify.mjs --self-test
node tools/audio/review-v2/verify.mjs
node tools/audio/review-v2/verify.mjs --integration-root <실제-통합-저장소-루트>
```

통합 루트는 이번 PC의 `outputs/handoff/DESKTOP_INTEGRATION_LOCAL-2026-10-18.md`로 확인한다. 다른 PC에도 같은 절대 경로가 있다고 가정하지 않는다. `--root`와 `--output`으로 검수 복사본의 루트/상대 출력 경로를 명시할 수 있다.

`catalog.json`이 없으면 검사하지 않고 종료 코드 1을 반환한다. 생성 도중 실행하면 pending/failed 자산이 남아 완전성 검사는 통과하지 않는다. 생성 완료 뒤 다시 실행한다. 결과는 `outputs/audio-review-v2/file-verification.json`에 저장된다. 수치 PASS를 사람 청취 승인으로 표시하지 않는다.

## 검사하는 내용

- catalog의 고유 ID, 명시적 생성/청취 상태, 용도·종류·loop·eventMapping·출처, 0.5~30초 요청 길이, 최대 450자 생성 prompt.
- playable 상태(`generated_unreviewed`, `existing_reused`)별 실제 로컬 MP3 파일·bytes·SHA256 일치 및 서로 같은 압축 파일이 아닌지 확인.
- 생성 receipt의 실제 HTTP 200/ID/status, 요청 prompt·길이·loop, 출력 bytes/SHA256을 catalog와 대조한다. 재사용 음원은 원본 SHA256과 재생성 없음 표시를 대조한다. audio 폴더의 MP3가 catalog에 빠진 경우도 실패로 기록한다.
- MP3 Layer III의 ID3v2/ID3v1 경계, MPEG1/2/2.5 헤더, sample rate·mono/stereo·bitrate·완전한 연속 프레임·가변 비트레이트·Xing/Info 프레임 수. 압축 프레임 길이가 요청 시간과 맞는지 확인한다. encoder delay/padding을 감안해 0.3초 또는 8% 중 큰 값 이내를 허용한다.
- 페이지에서 직접 연결하는 로컬 HTML/JS/CSS/오디오 파일 존재, literal remote resource/network 참조 및 `eval`/`new Function` 부재. index에서 연결되는 소스만 순회하며, 생성기/API 메타데이터의 외부 문서 주소는 실행 페이지 자원으로 취급하지 않는다.
- JS의 상대 `fetch()`는 HTML 문서 위치, module import는 module 위치를 기준으로 검사한다. 이 차이를 별도 자체 검사로 확인한다.
- 기존 `audio-v1/handoff-files.json`의 46파일 bytes/SHA256 보존. 통합 루트를 주면 통합 delivery manifest, 기존 기관총 delivery manifest, v1의 sourceBoundary 7파일도 대조한다. manifest 자체 해시를 보고하되 manifest 자체의 이전 기준값이 없으면 이전과 같다고 주장하지 않는다.
- parser 자체 검사는 MPEG1/2/2.5·mono·VBR·ID3·Xing 정상 처리와 잘린 프레임·중간 손상·가짜 확장자·stream 형식 변화·경로 탈출 거절을 확인한다. 테스트용 payload는 무음/유효 오디오로 간주하지 않는 프레임 fixture다.

## PASS가 뜻하지 않는 것

Node 내장 코드로 압축 프레임을 읽는 것은 오디오 디코딩이 아니다. 실제 decoded duration, PCM peak/RMS, 무음·클리핑·끝 클릭·loop 이음매를 이 결과로 승인하지 않는다. 정적 literal URL 검사도 런타임 네트워크 캡처를 대체하지 않는다.

Native 브라우저 디코드·재생/정리, OfflineAudioContext의 PCM 측정, 실청·헤드폰·모노·3개 중요 cue 식별, loop 장시간 청취, 최종 게임 UI와 실제 event/command hook은 별도 순차 QA다. 아직 게임에 설치되지 않은 신규 무기·UI 효과는 검수용 음원이며 연결 완료로 세지 않는다. 사람 검수 결과는 청취 화면의 별도 기록으로 남기고 생성 상태와 구분한다.

검수 순서는 낮은 전체 볼륨으로 단품 → 재료/무기 비교 → loop 2회 이상 → 중요 경고+조작/피격+환경 동시 3cue → mono/낮은 dynamic range → 실제 게임 이벤트와 pause/retry/clear/dispose 순서를 권한다. 위험은 볼륨만 크게 하지 않고 천 장력의 변화와 별도 짧은 cue를 들어 확인한다. 시각 경고는 유지한다. 음악·목소리·서사 제작은 이번 SFX 범위에 포함하지 않는다.
