# Cloudstitch 최신 음향·적함선 검수 위치

2026-10-18. 기존 자료는 보존했고 최종 검사는 별도 통합 작업 트리에서 실행했다. 이전 `DESKTOP_REVIEW_QA_LOCAL-2026-10-18.md`와 그 전달목록은 그대로 둔다.

- [최신 로컬 시제품 안내](http://127.0.0.1:8840/outputs/desktop-review-qa-v2/)
- [풍성한 효과음49쌍](http://127.0.0.1:8840/outputs/audio-rich-v1/)
- [음향 QA 상세](http://127.0.0.1:8840/outputs/audio-rich-qa-summary-v1/)
- [새 적함선6종](http://127.0.0.1:8840/outputs/enemy-fleet-reference-v1/index.html)

음향은 원본/보강98개 유한 디코딩과49쌍 RMS 목표를 확인했다. 최초 시간초과1/2·다음21/24의3실패는 보존하고, 다음 실제 재생 음량·생성 여부별 context종료·실제source회수·기관총6발을 확인한 별도후속8/8을 구분했다. 음색·박격포 A/B 선택과 게임 설치는 대기다.

새 함선은 Chrome1개·페이지1개에서 뷰어/리그273/273을 통과했다. 별도 망령1척의3모드180RAF씩 회전 후 PNG를 직접 봤고 뚜렷한 누적 잔상은 보이지 않았다. 별도수치5검사와 정밀decoded/장기/6척전수 미검증을 구분한다. 전투·충돌·소켓·피해·AI·미술 승인으로 확대하지 않는다.

동결 음향126·적함선53의 사후 SHA가 일치했다. 새 경로별 `.gitattributes`만 추가해 WAV/MP3 및 내장GLB HTML의 LFS를 확인했다. 소스 manifest본문·기존 공통 설정·이전 QA보고서는 바꾸지 않았다.

최신 QA 전달목록 `outputs/desktop-review-qa-v2/delivery-manifest.json`:36파일·3,673,936바이트, SHA `cfb51dcd79fbf589408d53612237a2b43f1099d80c173a9368b6821f7041605b`.
요약 SHA `cc00487b780ebf66c73b3786ba444318ea791afc302f4a2e050a68b5448e9b1c`.
회전 추가근거 `outputs/enemy-reference-rotation-qa-v1/delivery-manifest.json`:6파일, SHA `1aa051ff37587fef88c0530a229ed6c555cb08708bd01de15674a27b52f8d511`.

다른 PC에는 이 통합 작업 트리와 각각 참조된 소스 패키지를 전달해야 한다. 이 안내 파일은 위전달목록에 포함되지 않는다. API키·인증·work캐시·node_modules는 전달물에서 제외한다. commit/push/배포는 하지 않았다. 후속 조타·부유 3D 개선은 별도 작업으로 인계한다.
