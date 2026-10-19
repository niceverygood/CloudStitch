# 현재 파일의 이식용 스냅샷

`portable_snapshot.py`는 Python 3.10 이상과 로컬 Git만 사용하는 표준라이브러리 도구다. 네트워크·브라우저·계정 캐시·인증·commit·push·원본 수정 없이 현재 작업 파일을 선택한다. 사용량을 조회하거나 자동화를 등록하는 도구는 아니다. 사용량 감시와 채팅별 인계 문서는 별도 절차다.

저장소 루트에서 실행한다. macOS/Linux에서는 `python` 대신 `python3`를 사용한다.

```sh
python tools/handoff/portable_snapshot.py
```

기본 실행은 Git의 tracked 파일과 ignored가 아닌 untracked 파일의 경로·stat·HEAD만 읽어 JSON을 표준 출력한다. 파일 본문 읽기·해시·복사·결과 디렉터리 생성은 하지 않는다. 이 출력은 파일 동결 완료 증거가 아니다.

실제 복사는 명시적으로 요청한다.

```sh
python tools/handoff/portable_snapshot.py --export
python tools/handoff/portable_snapshot.py --workspace . --workspace ../other-worktree --export
```

`--workspace`를 지정하면 그 목록만 대상이며, 각 값은 Git worktree의 루트여야 한다. 순서대로 `workspace-001/`, `workspace-002/` 아래에 각각 상대 경로를 유지한다. 서로 다른 worktree의 동명 파일을 합치지 않는다. 목록을 지정하지 않으면 현재 디렉터리 하나가 대상이다. 각 workspace가 무엇인지 채팅 인계 문서에 같은 순서로 기록한다. 문서의 절대 경로를 새 컴퓨터의 의존성으로 삼지 않는다.

첫 workspace의 `outputs/handoff/usage-portable-<UTC 타임스탬프>/`를 새로 생성한다. 기존 산출물은 덮어쓰지 않는다. 성공 결과는 `project-files.zip`과 `manifest.json`이다. PNG/GLB가 많은 저장소를 위해 ZIP은 압축 없이 저장하며, 실제 파일 복사와 ZIP 재읽기 해시는 대형 I/O다. 현재 프로젝트의 통합 담당 슬롯과 작업 중인 파일을 먼저 조율한다. 이전 `usage-portable-*` 스냅샷은 다시 포함하지 않는다.

manifest에는 workspace별 HEAD·선별 수/바이트·제외 경로/이유, 각 ZIP 멤버의 크기·SHA-256·LFS 포인터 여부와 ZIP 자체의 크기·SHA-256이 있다. `selectedSubset: true`는 제외 규칙을 적용한 **선별 파일 묶음**임을 명시한다. `COMPLETE`는 이 선별 범위의 복사가 안정적으로 끝났다는 뜻이며 프로젝트 전체·모든 채팅·계정 상태까지 완전 보존했다는 뜻이 아니다. source 절대 경로나 remote URL·Git 설정은 기록하지 않는다. 스냅샷은 현재 파일 내용을 보존하며 Git 저장소/브랜치/스테이징 상태를 복제하지 않는다. 미커밋 수정과 비ignored untracked 파일도 포함되므로 HEAD는 파일 내용과 일치한다는 뜻이 아니다.

출력의 `status: COMPLETE`, 종료 코드 0과 manifest를 함께 확인한다. 복사 직전·파일 디스크립터·복사 직후와 전체 작업 종료 시점의 stat/선별 목록/HEAD를 비교한다. 변동·검사 실패·실제 자산 대신 LFS 포인터가 있으면 `INCOMPLETE`, 종료 코드 2이며 ZIP은 `project-files.PARTIAL.zip`으로 남는다. 실패 중 이미 기록된 데이터가 있을 수 있으므로 PARTIAL 파일을 전달하지 않는다. 원인을 해결하고 새 스냅샷을 만든다. `COMPLETE`도 실행 순간 사이의 변경을 절대 막는 파일시스템 원자적 스냅샷은 아니다. 모든 관련 세션이 쓰기를 마친 뒤 생성해야 한다.

제외 기준은 보수적이다.

- `.git`, `work`, `node_modules`, `.codex`, 계정/의존성/브라우저 캐시와 심볼릭 링크·비정규 파일을 제외한다. 일반 프로젝트의 `state`, `runtime`, `sessions`, `auth` 디렉터리는 이름만으로 제외하지 않는다.
- `.env*`, 키/인증서/로컬 DB와 기존 ZIP/tar/bundle을 제외한다. `.example`, `.sample`, `.template`로 끝나는 환경/인증 템플릿은 파일명 예외이며 콘텐츠 검사 대상이다. 인증·token·secret·key·state·session 관련 이름도 일반 구현/문서 확장자 `.js/.mjs/.cjs/.ts/.tsx/.py/.html/.css/.md/.txt`이면 포함해 콘텐츠를 검사한다. 이외의 해당 파일명(예: `tokens.json`, `session.sqlite`)은 제외한다. `.env`와 실제 키/인증서 확장자의 제외는 구현 확장자 예외보다 우선한다.
- 내보낼 때 본문에서 일부 알려진 키 형식·private key·긴 Bearer 값·URL 내 인증을 검사하며 발견하면 중단한다. 비밀 값은 출력하지 않는다. 임의 형식의 비밀을 모두 탐지한다는 보장은 없으므로 배포 전 사람이 선별 목록과 필요한 문서를 확인한다.
- `tools/integration/session.mjs`, `runtime/state.ts`, `auth/login.py` 같은 구현은 포함된다. `state.json`이나 `cache/` 안의 소스처럼 보수적인 규칙 때문에 빠지는 실제 프로젝트 파일도 있을 수 있다. manifest 제외 목록을 검토하고 별도 안전한 소스 정리 후 재생성한다. ignored 파일은 tracked가 아니라면 선택하지 않는다. 모든 제외 항목을 복원했다고 표시하지 않는다.

Git bundle은 제공하지 않는다. 과거 커밋의 인증 흔적까지 무심코 이동할 수 있고 LFS 실물도 담지 못하기 때문이다. 이 도구는 현재 파일과 인계 문서를 옮기는 용도다. Git 이력이 필요하면 별도로 검토한 원격 저장소를 clone하고 LFS를 준비한 다음, 기존 변경을 보존하며 스냅샷을 별도 폴더에서 비교한다.

받는 컴퓨터에서는 도구와 manifest 경로를 지정해 먼저 검증한다. Git은 필요하지 않다.

```sh
python tools/handoff/portable_snapshot.py --verify outputs/handoff/usage-portable-<timestamp>/manifest.json
```

이 명령은 압축을 풀거나 파일을 쓰지 않고 ZIP 자체와 내부 모든 파일의 SHA-256·크기·파일 목록을 재검증한다. 성공은 `VERIFIED`와 종료 코드 0, 실패는 종료 코드 2다. 검증 자체도 ZIP을 읽는 대형 I/O이므로 해당 슬롯을 사용한다. manifest 자체의 진위/서명까지 검증하지는 않는다. 성공 후 ZIP을 빈 임시 폴더에 푼다. ZIP에는 인증이 포함되지 않아야 하며 필요한 로그인과 키는 새 계정에서 다시 준비한다. 새 프로젝트로 열어 `AGENTS.md`, `docs/HANDOFF.md`, `docs/CONTINUE_PROMPT.md`와 채팅별 인계를 읽는다. 파일/문맥 이관은 다른 계정에서 기존 native 채팅 ID를 그대로 재개하는 기능이 아니다. 채팅 ID는 출처 참조이며 새 채팅에 인계 내용을 전달해 작업을 이어간다.

작은 임시 Git fixture 검사만 실행하려면 다음을 사용한다. 실제 프로젝트 자산을 복사하거나 해시하지 않는다.

```sh
python -B -m unittest discover -s tools/handoff -p test_portable_snapshot.py
```
