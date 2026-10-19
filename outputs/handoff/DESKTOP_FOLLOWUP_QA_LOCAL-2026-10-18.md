# Cloudstitch 후속 독립 QA 위치

2026-10-18. 이번 PC에서 확인한 통합 작업 공간은 `C:/Users/nicev/.codex/worktrees/desktop-integration/CloudStitch`다. 다른 PC에도 이 경로가 있다고 가정하지 않는다. 공유 개발 checkout을 일괄 덮어쓰지 않고 새 전장·단계 맵·효과음·함대 아트의 READY 버전을 이 별도 작업 공간에서 순차 검사했다.

통합 루트 기준:

- 실행·범위·검증·한계: `tools/integration-followup/HANDOFF.md`
- 독립 보고서와 READY 해시 집계: `outputs/integration-followup-v1/verification.json`, SHA256 `fcf61a3de21a0f21efc1b24768d1666b6de9f5f37cf43fbc6026b2ac649bff17`
- 통합 담당 도구·문서·공통 LFS 변경·집계12파일 색인: `outputs/integration-followup-v1/delivery-manifest.json`, SHA256 `cf261e80f979d3fa6a7d6dd490c2e33646cf316c64ae492d8821bdf8e23a7783`

집계는 무결성과 증거 연결을 확인한 기록이며 전체 QA를 하나의 PASS로 만들지 않는다. 원래 전장 READY-2의23/24와 위치 수정 READY-3의11/11은 구분했다. 함대553개 중25개 정지 PNG 바이트 불일치는 FAIL로 남겼고, 별도 고정 자세25쌍에서6~8pixels·채널 최대1/255 차이를 기록했다. 효과음 native33 안의 Offline54표본을 추가 독립 검사처럼 합산하지 않았다. 자연 패배·동일 항해 재시도의 음향 검사는 별도23개다.

서버 실행 중 링크:

- 새 전장: `http://127.0.0.1:8840/outputs/playable-battlefield-v1/`
- 단계 맵: `http://127.0.0.1:8840/outputs/stage-maps-v1/`
- 함대 갤러리: `http://127.0.0.1:8840/outputs/fleet-v2/`
- 효과음 작업대: `http://127.0.0.1:8853/outputs/audio-v1/`, **소리 켜기**로 활성화.

음향의 최종 게임 UI 설치·자동저장 성공 hook, 사람 청취·아트 승인,6지역/보스 완주와 장시간 성능 인증은 남아 있다. 새 VFX는 최종 READY를 별도로 받아야 한다. Chrome QA는 종료했으며 HTTP 서버만 유지했다.

기존 v1의39파일과 원본을 보존했다. 함대 originalInputs의 package/lock은 공유와 통합의 버전이 달라 통합 동결 SHA를 확인하고 유지했으며 설치·복사를 하지 않았다. 통합 `.gitattributes`의 `outputs/fleet-v2/ships/*.html filter=lfs diff=lfs merge=lfs -text` 단일 규칙은 향후 공유에 선별 반영할 항목이다. 전체 공통파일을 비교 없이 복사하지 않는다. 커밋·push·배포는 하지 않았다.
