# Cloudstitch audio-rich-v2 인계

## 범위와 소유

최신 사용자 요청: ‘전체적으로 중저음이 좀더 강화 되었으면 좋겠어’. 기존 풍성 v1의49개 WAV(효과음47종+박격포AB2후보)를 입력으로 새 중저음 강화49WAV를 만들었다. v1의126파일과 자체manifest를 보존했다.

- 쓰기 소유: `tools/audio/rich-v2/`, `outputs/audio-rich-v2/`
- 읽기 입력: `outputs/audio-rich-v1/catalog.json`, `enhanced/*.wav`, 해당 delivery manifest
- work: `work/audio/rich-v2/previous-boundary.json` (전달·커밋 제외)
- 공통 package/lock/설치/기존 소스 변경0, API/유료생성0, 새 oscillator0, 게임설치0
- 새 주인공 상태/폭발 시연과의 hookup0. 실제 전투 이벤트·기존sim·저장은 변경하지 않는다.

COORDINATION.txt/json의 총괄·통합 소유 경계를 적용한다. 개별8867 preview서버는 지침 수신 전 HTTP검사용으로 사용한 뒤 종료했다. 최종 열람은 통합 담당이 선별 import한 `http://127.0.0.1:8840/outputs/audio-rich-v2/`를 사용한다. Native/브라우저/공통서버는 통합의 단일 슬롯으로만 실행한다.

## 처리

`dsp.mjs` SHA256 `ae6dc13349f5a892c8fd848db70c43ec5a5adbe787f8e63bdcdf143d25065a8a`.

v1에서 만들어 둔 질감·반사·기존 저음층은 입력 WAV에 포함되어 있다. 이번 단계는35Hz highpass →90~118Hz low shelf(+1.15~2.5dB) →148~337Hz 넓은 body peaking EQ(+3.05~5dB) 순서다. 무기·충돌·목재·기계·천·경고·UI를 재질별로 구별한다. 기존 소리에 없던 음·리듬·장시간 rumble이나 추가 꼬리는 만들지 않는다.

전체 RMS를 다시 맞춰 EQ를 상쇄하지 않는다. 최종 peak.74를 넘을 때 공통 downward gain만 적용한다. 출력49개는 전부 동일 프레임 수·44.1kHz·stereo·PCM16이며 합계16,582,724B이다. 실제 PCM16 최대 sample peak.7399902344, clipping0이다. 입력 v1복사49개도16,582,724B이며 largest WAV1,058,444B이다. WAV LFS설정은 공통 소유자에게 요청한 상태이며 이 소유 폴더에는 별도 LFS설정 파일을 추가하지 않았다.

루프는 반복 입력으로 필터 상태를 충분히 예열하고5ms 경계 crossblend를 적용한다. 단발은 짧은 가장자리 fade를 사용한다. 길이 보존과 별개로 QA에서 경계 sample/첫끝5ms RMS·peak·maxStep·중앙 구간비를 각각 기록했다. sample seam은0이며 기존 warning loop의 내부 큰 step은 원본에도 존재하므로 별도 관측으로 유지했다. 이 수치는 사람의 무봉합·클릭 잡음 부재 승인과 다르다.

## 비교 UI

동일 RMS 비교의 두 입력은 `original/id.wav`(이전 풍성 v1)와 `enhanced/id.wav`(새 중저음 v2)다. 재생 때 Native 디코딩된 양쪽 peak/RMS로 공통 목표RMS를 구하고 peak.8을 넘지 않게 한다. 화면 자체에서는 추가 EQ를 적용하지 않는다. 이전 버전과 이번 WAV를 직접 비교할 수 있다.

검증된 v1 플레이어의5ms release→1ms여유 stop→onended disconnect·active/releasing headroom·숨김·dispose 정리를 재사용한다. v2의 schema/localStorage namespace/catalogSHA는 이전 메모와 분리한다. 이전WAV와 새WAV를 모두 다운로드할 수 있다. 기존 `fire-mortar` 수정 요청, AB 후보 미선택, 전49후보 사람승인 전/게임미적용 상태를 유지한다.

## 실제 자체검사

- `file-verification.json`: **448/448 PASS**. 실제49PCM과 exact 이전WAV복사 SHA·source127보존·동일frames/channel/rate·finite/clip·mono·단순gain외변화·대역비·루프경계·tone fixture·6연사.
- 독립 대역 근사 계측: 같은 RMS 기준100~350Hz 에너지비는49/49 증가, +1.4395%~+144.2434%. 80~350Hz는+0.8832%~+143.9163%. 이미 중저음에 집중된 소스는 비율 증가가 작다. 이 수치를 전체 음량 증가·청감 개선·LUFS로 해석하지 않는다.
- 실제 기관총 WAV6발,0.22초 간격, 전체 꼬리 보존/퇴출0/최대4중첩/finite, rawpeak.7399902/RMS.1044557, 보수적고정1/4 headroom후peak.1849976. 실제 전투 mixer나 Native 출력은 아니다.
- `player-verification.json`: **43/43 PASS**, 시간 진행 fake AudioContext의 기존 정리 엔진과 v2 schema/template 검증. Native 재생 검사와 구분한다.
- `http-verification.json`: **107/107 PASS**, 임시 own8867서버에서98WAV 실제 bodySHA·크기·MIME/모듈·CSS/경로경계/read-only 확인. 서버는 이후 종료했다.

sample peak는 true peak가 아니다.48k Native 리샘플링의 overshoot는 원PCM sample peak와 구별하며 실제 pairNormalization의.8 headroom을 따로 확인한다. 이전v1 Native 원실패·후속8은 그대로 보존하고 이번검사로 덮어쓰지 않는다. 사람 청취·중저음 취향·경고 식별/실전밸런스·게임적용은 미완료다.

## 재현·전달

```powershell
node tools/audio/rich-v2/prepare.mjs
node tools/audio/rich-v2/render.mjs
node tools/audio/rich-v2/verify.mjs
node tools/audio/rich-v2/verify-player.mjs
node tools/audio/rich-v2/build.mjs --manifest
# 통합 단일 Native 슬롯에서, 새 별도 QA폴더에만 출력
node tools/audio/rich-v2/verify-browser.cjs --playwright-root <existing-playwright-project> --channel chrome --url http://127.0.0.1:8840/outputs/audio-rich-v2/ --out <fresh-separate-QA-directory>
```

Native하네스는 새49쌍의98WAV디코드/실제RMS·peak.8/대표v1·v2·AB/mono loop·release/390px·오류/원본보존으로 제한한10항목이다. 처음탐색은 domcontentloaded60초로 하고,기존상태QA 전체를 반복하지 않는다. raw native buffer는 기기리샘플링 영향이 있으므로.99이내/finite와 정규화 후.8을 구별한다. 이미 파일이 있는 --out은 실패 증거를 덮어쓰지 않고 거절한다. 브라우저는 finally에서 종료한다.

새manifest는 소유 source/output만 포함하고 자기 자신은 제외한다. work와 기존v1은 읽기의존성이다. API 키·토큰·계정캐시는 포함하지 않는다. 이전manifest `outputs/audio-rich-v1/delivery-manifest.json` SHA는 `9a50e6f105ff5497795fb33095cbc0dc71f2df88ac062372e6c6028e85709523`로 고정한다. 통합은 exact manifest/하네스 SHA 대조 후 선별 import하고 새Native 보고서·사후소스보존과 결속한다.
