# Cloudstitch 데스크톱 검수·3D 비행 위치

2026-10-18. 통합 작업 공간은 현재 앱에 연결된 `codex/desktop-integration` 작업 트리다. 기존 공유 폴더와 패키지는 덮어쓰지 않았다. 다른 PC에는 이 작업 트리를 별도로 전달해야 한다.

- 검수 안내: http://127.0.0.1:8840/outputs/desktop-review-qa-v1/
- 기관총 최초 시안: http://127.0.0.1:8840/outputs/audio-machinegun-elevenlabs-v1/
- 효과음47종: http://127.0.0.1:8840/outputs/audio-review-v2/
- 박격포 발사 A/B: http://127.0.0.1:8840/outputs/audio-mortar-r1/
- 함대 비교: http://127.0.0.1:8840/outputs/fleet-comparison-v1/
- 독립3D 비행: http://127.0.0.1:8840/outputs/flight3d-v1/

8840은 통합 작업 트리 루트에서 `node tools/integration/serve.mjs 8840`으로 제공한다. 포트 변경 시 검수 메모의 localStorage origin도 달라지므로 의견 JSON 내보내기/가져오기를 사용한다. 기존 공유 저장소의 서버를 통합본 서버로 간주하지 않는다.

## 기록

상세 인계는 통합본의 `tools/audio-review-qa/HANDOFF.md`, 요약은 `outputs/desktop-review-qa-v1/verification.json`이다.

- 최초 오디오35검사: 34통과·1실패 보존. 무음 상태 SFX gain 관측값 불일치다.
- 별도 후속8/8: 활성/다음 재생의 Native AudioParam 적용과 박격포3음원 확인. 최종 출력 PCM·청감 측정은 아니다.
- 함대 비교88/88: UI/이미지/선택모델 범위. 원본 고밀도 GLB9는 HEAD만 확인했다.
- 대표 효과 뷰어 조작16/16: 48종 전수/장시간 잔상 검사를 뜻하지 않는다.
- 독립3D 비행17/17: Q/E, 완만한D, 시점회전, 다른 높이 표적 사격. 기존 항구·저장 연결/장시간 성능은 미검증이다.
- 사후 동결: 오디오113·박격포18·함대비교95는 공유본/통합본, 효과85는 통합본만 확인. 본문537+manifest7=544 file-location checks, 불일치0. 대형 함대174·기존211/202 검사는 반복하지 않았다.

검수 QA 전달목록36파일 manifest SHA256: `469f8ed813a51446ea0f7c2acfbefb8619630282636039ff9300bc4812d02ff0`.
요약 SHA256: `bfa9b01be2d564dbd19164fccada50516a1522197e367b217abe0556ae0f0a37`.
3D 비행 READY2 소유20파일 manifest SHA256: `015a0e28694b17f64e3202e3fe4537fe7c9ad98e3b1a7210e154a27b7cb29724`.
3D QA 결속 보고서 SHA256: `d3d89e6d351ae248a21103e3ba9ad53e645d3ea87130ffa3327cd3de627b77c0`.

이 파일 자체는 공유 폴더에서 통합본을 찾는 안내이며36파일 manifest에 포함되지 않는다. 음원 사람 승인·박격포 A/B 선택은 대기이고 게임에 새 음원을 자동 설치하지 않았다. 별도 최신 요청의 풍성한 효과음49는 제작용 Float32 변환까지만 완료했으며 최종 DSP 산출물/Native 검수와 구별한다. API 키·인증은 이 자료에 포함하지 않는다. commit/push/배포는 하지 않았다.
