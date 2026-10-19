Cloudstitch · 소리 작업대 v1
READY: audio-v1.0.0-ready — 다음 통합용 구현 준비. 최종 사운드/브라우저 청취 QA 완료 아님.

저장소 루트에서 Node 22 이상:
  node tools/audio/serve.mjs 8852
열기: http://127.0.0.1:8852/outputs/audio-v1/
첫 클릭/키 입력으로 Web Audio를 활성화한 뒤 들어보기/반복 듣기.
전체·효과·환경 볼륨, 음소거, 모노, 작은 음량 차이, 정지/일시정지 제공.
파일만 이중클릭하는 file:// 방식 대신 로컬 HTTP로 실행한다.

18종의 임시 절차 합성: 기관총/함포, 목재/천/장갑/엔진 피격,
연결부 절단, 묶음 분리, 인양·회수, 엔진/바람/양력 장력 loop,
짧은 양력 경고, 귀환, 항구 수리/장착, 저장 성공/실패.
WAV는22050Hz mono PCM16, 총604,966bytes. 외부 음원/다운로드/유료 생성 없음.
결정적 seed의 로컬 코드 합성이며 최종 녹음·Foley·상용 음원으로 표시하지 않는다.
음악·음성·서사 연출은 기존 기획을 보존하는 후속 범위다.

독립 host:
  node tools/audio/serve.mjs 8852 --integration-root "실제 통합 저장소 루트"
  http://127.0.0.1:8852/tools/audio/host.html
통합 루트 위치는 outputs/handoff/DESKTOP_INTEGRATION_LOCAL-2026-10-18.md 참고.
동결 controller를 복제하지 않고 서버의 읽기 경로로 가져온다.
별도 controller 메모리 저장소를 사용하므로 기존 통합 origin 저장슬롯을 쓰지 않는다.
이 host는 최종 플레이 UI가 아닌 실제 입력/발사/충돌 이벤트 연결 예시다.

catalog.json: ID/용도/정확한 이벤트 조건/seed/길이/출처·권리/포맷/bytes/SHA256.
verification.json: 실제 가벼운 검사와 미검사 구분.
handoff-files.json: 모든 담당 소스/출력과 읽기 소스 경계의 SHA256/bytes.
상세 입출력·수명·통합 변경 요청: tools/audio/HANDOFF.md.

사람의 청취, 여러 브라우저/스피커/헤드폰, OfflineAudioContext 수치,
실제 통합 화면과 장시간 오디오 QA는 통합 담당의 순차 검사 대기다.
수치 peak/RMS 통과만으로 재료 식별·경고 가독성·편안함을 보장하지 않는다.
