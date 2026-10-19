# Cloudstitch 전체 효과음 검수 묶음 v2

2026-10-18 한국 시간. 사용자가 기존 ElevenLabs 기관총 시안을 본 뒤 **“기타 필요한 음향효과를 전체 만들어서 검수 할수 있게 해줘”**라고 직접 요청한 범위다. 기존 기관총 원본을 재사용하고 필요한 나머지 SFX를 같은 서비스로 생성했다. 음악·음성은 포함하지 않는다. 최종 게임에는 설치하지 않았다.

## 실제 생성 결과

- 총 47종: **신규 46 + 기존 기관총 재사용 1**, 생성 실패 0 / 대기 0.
- 무기 14·피격/재료 7·분리/회수 5·항해 환경 6·위험 4·항구 5·UI 6. 개별 ID/길이/loop/요청 프롬프트/매핑은 `outputs/audio-review-v2/catalog.json`과 `sound-plan.mjs`에 있다.
- 요청 길이 합계 89.8초(재사용 0.8초 포함), 개별 0.5~6초, loop 후보 10개. 원본 MP3는 총 1,479,066 bytes다. provider는 `ElevenLabs`, model은 `eleven_text_to_sound_v2`, 요청 format은 `mp3_44100_128`이다.
- 신규 API 성공 46건, 중복 유료 생성 0건, 유효 API 실패 0건. 응답 `character-cost`의 합계는 890이며 청구 통화 금액을 뜻하지 않는다. 별도 계정 청구 내역을 조회하지 않았다.
- `generation/<id>.json` 46개에 실제 request/HTTP 상태/가능한 provider request ID/시간/bytes/SHA/사용량을 보존한다. 기존 기관총은 원래 `generation.json`의 prompt와 SHA를 source에 기록한다. key·인증 헤더 값·계정 캐시는 보존하지 않는다.
- 이번 동기형 API 응답에서 조회한 `request-id`/`x-request-id` 헤더는 없었으므로 provider job ID를 만들어 넣지 않았다. 각 요청은 로컬 cue ID·응답 시각·원본 SHA와 성공 receipt로 구별한다.
- 초기 7종 성공 뒤 OneDrive의 catalog rename EPERM으로 로컬 인덱싱이 중단됐다. 각 성공 receipt와 MP3를 대조해 누락 2항목을 복구했으며 `catalog-recovery.json`에 기록했다. 해당 요청을 다시 보내지 않았다. API 재시도와 로컬 파일 저장 재시도는 구별한다.

생성 원본 MP3는 수정하지 않았다. 기존 기관총의 stereo MP3도 바꾸지 않았다. 원본 WAV/6발 청취 WAV는 기존 기관총 폴더에 보존하고, 이 묶음에서는 MP3만 검증 복사했다. 새 47종의 고정 mono WAV/편집 WAV를 생성한 것으로 표시하지 않는다. 화면은 decode한 별도 buffer에서 mono/peak 정규화/연사 fixture를 만들며 디스크 원본을 덮어쓰지 않는다.

## 실행과 검수

저장소 루트, Node 22 이상, 새 의존성 없음:

```sh
node tools/audio/review-v2/build.mjs
node tools/audio/review-v2/serve.mjs 8864
```

`http://127.0.0.1:8864/outputs/audio-review-v2/`를 연다. 생성 서비스에 접속하지 않고 로컬 파일만 재생한다. 첫 클릭 이후 Web Audio를 활성화하며 자동 재생은 없다. 저장소 복사본을 사용할 때도 root 상대 경로를 유지한다. server는 127.0.0.1과 검수용 두 폴더에만 한정하며 Windows의 인코딩된 역슬래시 경로 탈출도 거부한다.

목록에서 단독 재생·반복·이전/다음·범주별 차례 듣기, 검색/7범주 필터, 전체/SFX/환경음·음소거·모노·작은 음량 차이, 모두 정지, 파형/길이/출처/프롬프트/게임 매핑/원본 다운로드를 제공한다. 각 소리에 **승인/수정 요청/보류/검수 전**과 메모를 기록한다. 판정과 청취 횟수는 생성 상태와 분리한다. 현재 브라우저 origin(프로토콜·주소·포트가 같은 범위)의 별도 localStorage namespace에 저장하며 검수 JSON 내보내기/가져오기로 보존한다. 원래 게임 저장키를 쓰지 않는다. 새 주소·다른 포트·다른 브라우저로 결과가 자동 동기화되지는 않는다.

비교 기능은 기관총 1발/6발(0.22초 간격), 선택한 3개 cue 겹침, 선택한 환경 loop 위에 단발 재생이다. **수동 청취 fixture**이며 게임 피해/항해 ID/보상을 만들지 않는다. 다른 무기의 장전 시간·간격을 새 게임 규칙으로 확정하지 않았다.

재생용 buffer는 원본을 decode한 후 각 peak를 0.7로 맞추며 기본 master 0.45/SFX 0.65/환경 0.30, compressor/limiter를 거친다. mono는 stereo 평균 뒤 정규화한다. 개별 음량값은 출시 믹스가 아니다. 실제 loop seam의 청감은 승인 대기이며 생성 API의 loop 요청을 사람이 들은 seamless 완료로 표시하지 않는다. 시작/종료 gain fade와 stop/숨김/페이지 dispose로 예약·단발·반복을 정리한다. 검수 중 대기하던 decode가 늦게 끝나도 정지 이전 소리가 다시 재생되지 않도록 epoch로 차단한다. 중요한 SFX는 동시 3개 + 환경 2개이며 release tail은 별도 제한한다.

## 생성/보존/연결 경계

새 소유 범위는 `tools/audio/review-v2/`, `outputs/audio-review-v2/`다. 기존 `audio-v1` 46파일·동결 통합 39파일·기존 기관총 7파일 및 읽기 sourceBoundary 7개는 manifest 대조로 보존한다. 공통 package/잠금/의존성/LFS·다른 담당 코드·저장·원화는 변경하지 않았다. MP3 LFS filter는 현재 unspecified이며 전체 원본이 약 1.48 MB이므로 공통 규칙 변경은 요청하지 않았다.

catalog의 `eventMapping.status`는 source event/snapshot/command가 존재하는 경우와 future/UI hook이 필요한 경우를 구분하지만 **새 음원이 설치되었다는 표시는 아니다**. 현재 실제 발사는 기관총/훈련 함포이며, hit는 module lookup으로 재료를 대체한다. 박격포/작살/사슬/화염의 고유 탄도·상태·케이블·장전 hook·인양 진행·전용 UI hover 등은 후속 연결 대기다. 절단은 module-destroyed.connector, 묶음 분리는 bundle-detached, 회수는 salvaged를 기준으로 구별한다. 위험은 weight > lift와 천 장력으로 판단하며 귀환/수리/장착/저장은 실제 상태 전환/결과 뒤 연결해야 한다. 고정 시연 시간으로 피해음을 발생시키지 않는다.

향후 설치 시 기존 battlefield 하나의 이동/시간/피해 권위와 항해 ID + generation + seq 중복 차단을 유지하고, 기존 audio-v1 어댑터를 참조해 새 revision에서 승인 음원만 선택한다. 자동 저장 성공음은 실제 저장 결과 hook이 연결되기 전까지 대기다. 이번 검수 묶음이 기존 오디오 READY나 동결 전장을 교체하지 않는다.

## 파일검사와 남은 검수

```sh
node tools/audio/review-v2/verify.mjs --self-test
node tools/audio/review-v2/verify.mjs --integration-root "실제 통합 저장소 루트"
node tools/audio/review-v2/verify-http.mjs
node tools/audio/review-v2/verify-player.mjs
node tools/audio/review-v2/build.mjs --manifest
```

`file-verification.json`은 47개 실파일/해시/고유 ID/길이·prompt/MP3 Layer III 연속 프레임/페이지 로컬 참조/기존 파일 보존 및 parser fixture 13개를 기록한다. 파일 검사는 1193/1193, HTTP 검사는 55건을 통과했다. 압축 프레임 duration에는 encoder padding이 포함되어 요청 시간과 차이가 있으며 Native decode와 구별한다. HTTP 검사는 GET/MIME/음원 해시와 경로 거부를 확인한다. 재실행 시 최종 JSON의 수치를 확인한다.

`player-verification.json`은 fake AudioContext와 합성 PCM fixture로 32/32 검사를 통과했다. 설정·검수 JSON의 손상/버전/ID/hash 검증, 원본·모노 peak 정규화, 잠금, 대기 중 stop/숨김/음소거 뒤 재생 차단, 동시 loop 중복 방지, 중요도와 발음 상한, dispose/unlock 경쟁 상태를 확인했다. 실제 생성 MP3의 Native decode·DOM 화면·청취 검증을 대신하지 않는다.

`review.mjs`의 `window.__audioReview.inspectAll({release:true})`는 Native AudioContext.decodeAudioData로 47개를 재생 없이 읽고 duration/channels/sampleRate/peak/RMS/finite/seam 지표를 반환한다. 화면의 파일 수치 검사도 JSON을 내보낸다. **실행 도구 준비와 실행 완료는 별개**다. 수치가 정상이어도 음색·재료·과한 잔향·과한 어택·정확한 단발 수·loop 이음매·경고 식별·모노·헤드폰 편안함은 사람 검수가 필요하다.

Native/브라우저 대량 decode·플레이백/모바일/network/자원 수명 QA는 기존 통합 담당의 단독 슬롯으로 인계한다. 담당이 현재 실행 중인 v1rich 실전 QA·함대 미리보기 QA와 겹쳐 브라우저를 띄우지 않았다. 별도 보고서를 받기 전 Native 검사를 완료로 표시하지 않는다. 사람이 승인하기 전 47개 모두 generated/unreviewed 또는 existing/reused 상태다. 음악·음성·최종 게임 설치는 별도 요청/후속 통합 범위다.

## 인계

전체 파일 색인은 `outputs/audio-review-v2/delivery-manifest.json`이다. 자신의 manifest를 제외한 담당 소스/원본/생성 기록/화면/검사/문서의 repo 상대 path·bytes·SHA256을 기록한다. 소스 해시 대조 후 새 독립 출력으로 선별 import한다. 기존 통합 폴더나 공통 설정을 일괄 복사하지 않는다. 8840 통합 서버에서 보려면 이 두 새 폴더만 같은 상대 경로로 선택 반영할 수 있다.

generation 도구는 실제 유료 생성을 하므로 단순 build/QA에 포함하지 않았다. 입력 key는 echo 없는 stdin으로 메모리에만 들어오고 환경·argv·파일·문서·출력에 쓰지 않는다. 성공 파일/receipt를 복원·검증하고, 이전 attempt가 있는 실패/불명확 결과는 자동 재요청하지 않는다. 검수 수정 요청은 즉시 유료 재생성을 뜻하지 않으며 확인된 수정 방향에 따라 다음 revision을 만든다.
