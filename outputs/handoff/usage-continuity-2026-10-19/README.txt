사용량 임계치 인수인계 · Cloudstitch
작성: 2026-10-19 KST / 5% 미만이 되기 전에 만든 기본 인계

현재 확인
남은 Codex 사용량69%(사용31%,7일창). 아직 임계치 미충족.
30분 간격 점검 자동화 ID5 ‘사용량 5% 미만 인수인계’ ACTIVE.
유효 한도창 중 remaining=max(0,100-usedPercent)<5일 때만 최신 인계를 동결한다.
정확히5%는 조건 미충족, 조회불가/null을0으로 추정하지 않는다.
이번에는 문서·세션목록·이식 도구를 준비했다. 전체 프로젝트 ZIP·새PC 복구 검증은 아직 실행하지 않았다.

읽을 파일
CONTINUE_HERE.txt: 새 계정/컴퓨터에서 붙여넣기.
CLOUDSTITCH_SESSIONS.txt/.json: 관련19채팅 담당·최근요청·진행·실패·다음 단계.
RESUME_PROMPTS.json: 역할별 새 채팅용 프롬프트.
OTHER_SESSIONS.txt/.json: 다른게임·이전연결·기획33채팅의 요약/목록.
SESSION_REGISTRY.json: 조회한 전체목록·원제목·범위와 누락.
MONITOR_POLICY.json: 정확한 조건·자동화·관측·중복방지 상태.
tools/handoff/README.md: 실제파일 ZIP/manifest 생성·검증·제외목록.
WORKSPACE_METADATA.json: 실제 두폴더의 선별파일 메타데이터(합계약14.3GB). 자산본문/해시/복사는 실행하지 않았다.

반드시 구분할 두 작업공간
workspace-001=현재 공유개발 저장소 / main / HEAD fb850f72f544ef5b4fbb9ddb52462db22ed3c5bd.
workspace-002=별도 통합 checkout / codex/desktop-integration / HEAD e65ab87d2af0c4b08e51f312c9eb0998aa895c69.
현재 실제위치는 git worktree list --porcelain으로 찾는다. 이PC 기록은 outputs/project-command/local-locations.json과 outputs/handoff/DESKTOP_INTEGRATION_LOCAL-2026-10-18.md에 있다. 이전 절대경로가 새PC에도 있다고 가정하지 않는다.
공유에는 AGENTS.md/.gitattributes 수정과 다수 미추적 tools/outputs가 있다. 원격 clone만으로 최신자료가 생기지 않는다. 두 폴더를 합쳐 덮어쓰지 않는다.

현재 프로젝트
기본 README/docs의 일부 ‘전투 없음’은 초기기록이다. 별도 통합에는 첫지역의 실제 출항·회수·귀환2회와 항구·저장 복원 시제품/보고가 있다. 전체 캠페인/모든무기/최종엔진 완성은 아니다.
최신 작업에는 1·2탄 보스 기준 세계관10탄 이상,2탄 함대기획/기지3D,1탄 함대3D,인양계열 외형,장착무기 공격시연/24음향,10배 공격비교가 있다. 세션별 최신직접요청이 옛 공통상태표보다 우선한다.

실제 파일을 옮길 때
1. git status와 git worktree list --porcelain으로 양쪽 위치와 변경 확인.
2. 현재 쓰기/중앙 대형I/O 슬롯 확인. 다른채팅을 임의 중단·재개하거나 메시지 보내지 않는다.
3. Python3.10+로 공유 저장소 루트에서:
   python tools/handoff/portable_snapshot.py --workspace . --workspace "<확인한 통합 checkout>" --export
   macOS/Linux는 python3 사용.
4. 새 outputs/handoff/usage-portable-<UTC>/의 manifest와 ZIP을 확인한다.
5. COMPLETE/종료0이어도 제외목록을 검토한다. drift/LFS포인터/비밀의심/읽기실패는 INCOMPLETE/종료2다. PARTIAL은 완전이관으로 전달하지 않는다.
6. 받는PC에서 python tools/handoff/portable_snapshot.py --verify "<snapshot폴더>/manifest.json"으로 ZIP과 내부파일 크기·SHA256을 확인하고 빈 폴더에 풀어 두 workspace를 따로 연다.
7. 사용자가 원하는 개인 저장매체/권한있는 경로로 패키지와 이 기본인계 폴더를 옮긴다. 외부업로드·공개공유·Git push는 수행하지 않았다.

다른 계정·컴퓨터
파일·문맥 이관이며 이전 native 채팅ID/모든원문/계정로그인/플러그인 연결의 자동복원이 아니다. 새 채팅에 역할별 resumePrompt를 붙여넣는다.
인증/API키/서명키/계정캐시/node_modules/work/.git/브라우저localStorage는 옮기지 않는다. 새 계정의 권한·의존성은 별도 준비한다.
Git 이력이 필요하면 검토한 원격저장소를 별도 clone하고 git lfs pull한 후 스냅샷과 비교한다. 기존 수정 위에 무작정 덮어쓰지 않는다.
다른게임의 위치는 과거PC 단서다. OTHER_SESSIONS 문맥은 보존했지만 확인되지 않은 다른PC의 소스까지 백업한 것은 아니다.
목록도구는 비보관 최근50개 상한이다. 보관목록은 끝까지 조회했지만 더오래된 비보관/접근불가 호스트/다른계정/첨부원본은 누락될 수 있다. 전체원문 완전백업이라고 표시하지 않는다.
원FAIL·미술/청감 미승인·중단·PAUSED 지시를 유지한다. 이관으로 개발자동화/배포/유료생성/타채팅전송을 재가동하지 않는다.

점검 한계
컴퓨터와 로컬앱이 켜져 있고 접근권한·남은사용량이 있어야 실행된다. 30분 사이 소진/앱종료 시 임계치 즉시감지나 소진전 완료는 보장하지 않는다. 그래서 기본인계와 수동도구를 먼저 준비했다.
변화없는 점검은 알리지 않고 같은 한도주기에 대형패키지를 반복하지 않는다.
공식 예약 안내: https://learn.chatgpt.com/docs/automations?surface=app

