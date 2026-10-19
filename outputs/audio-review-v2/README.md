# Cloudstitch · 전체 SFX 검수실

**47종: 신규 ElevenLabs 46종 + 기존 기관총 1종 재사용.** 음악·목소리 제외, 실제 게임 설치 전 검수용 음원입니다.

저장소 루트에서:

```sh
node tools/audio/review-v2/serve.mjs 8864
```

[소리 검수실](http://127.0.0.1:8864/outputs/audio-review-v2/)에서 첫 클릭 후 듣습니다. 단독/반복·범주 순차 청취·기관총 연사·3개 cue 겹침·환경음 비교, 볼륨/모노/작은 음량 차이를 제공합니다.

각 소리에 **승인·수정 요청·보류·메모**를 남기고 **검수 JSON 내보내기**로 저장하세요. 브라우저 내 저장은 같은 origin(프로토콜·주소·포트)에서만 유지됩니다. 다른 브라우저/주소/포트에서는 JSON 가져오기를 사용합니다. 생성 완료와 사람 청취 승인·게임 설치는 구별합니다.

- `catalog.json`: 47개 ID·분류·목적·길이·loop·실제 매핑/연결 대기·출처/모델·프롬프트·MP3 bytes/SHA.
- `audio/*.mp3`: 원본 MP3 합계 1,479,066 bytes. 원본을 덮어쓰지 않고 화면의 별도 buffer에서 음량을 맞춥니다.
- `generation/`: 신규 46개의 실제 요청·응답 기록(인증 정보 없음). 재사용 기관총은 원본 SHA를 source로 명시합니다.
- `generation-summary.json`: 생성 46 / 재사용 1 / 실패 0 / 대기 0. API 응답 character-cost 합계 890(청구 금액 아님).
- `file-verification.json`, `http-verification.json`: 실제 경량 파일/압축 프레임/해시/HTTP 검사. Native·청감은 별도입니다.
- `player-verification.json`: fake Web Audio의 재생·정지·반복·검수 JSON 검사 32/32 통과. 실제 브라우저 출력과 사람 청취는 별도입니다.
- `delivery-manifest.json`: 담당 소스/출력 전체 bytes/SHA. 자세한 연결/한계는 [HANDOFF](../../tools/audio/review-v2/HANDOFF.md)를 참조하세요.

무기 14·피격 7·분리/회수 5·환경 6·경고 4·항구 5·UI 6입니다. 현재 게임에 없는 무기의 고유 공격/장전·케이블/진행·UI hook은 연결 대기 상태로 표시했습니다. 모든 음원은 검수 후보이며 사람이 듣기 전에 최종 품질로 승인하지 않습니다. 기존 합성 18종과 기존 통합 원본은 보존했습니다.
