# Cloudstitch 조타·부유 개선본 위치

2026-10-18. 새3D 비행 개선본을 별도 통합 작업 트리의 새 namespace에 원바이트로 이관했다. 공유 소유29파일과 읽기 의존성4의 QA 전후 SHA가 일치했고 원본·기존root READY2는 덮어쓰지 않았다.

- [새 비행 실행](http://127.0.0.1:8840/outputs/flight3d-ready3/index.html)
- [새20검사·화면·인계](http://127.0.0.1:8840/outputs/flight3d-ready3-browser-qa-v1/)
- [이전 READY2 실행](http://127.0.0.1:8840/outputs/flight3d-v1/index.html)
- [음향·함대·통합 시제품 안내](http://127.0.0.1:8840/outputs/desktop-review-qa-v2/)

W/S 전후진·A/D 선회·Q/E 고도·Space 제동·우클릭 관찰, 부유 표시·선회bank·가속pitch·추적 카메라를 실제 브라우저에서 확인했다. 새20/20 통과, desktop/mobile PNG도 열어 확인했다. 짧은 Chrome/390px 검사이며 독립 XYZ 실험이다. 사람 조작감·장시간 성능·항구/화물/저장 연결은 별도다.

shared canonical READY3 manifest `a47437d6d8832b8bccef03881273ff524782854f564a281e84c6c5e57acc4921`의29개는 통합본 `tools/flight3d-ready3/`, `outputs/flight3d-ready3/`에 매핑했다. 제품 코드 텍스트는 바꾸지 않았다. 원manifest의 경로는 원본canonical이므로 `outputs/flight3d-ready3-browser-qa-v1/mapped-import.json`에서 통합본 실제 경로를 찾는다.

이전root READY2 소유20·manifest015a0e28…·검사17은 원래위치 그대로다. 추가20source archive도 새QA `history/ready2-source/`에 있다. shared `outputs/flight3d-ready2/` archive5는 새29에 포함되지 않았고 root에 자동복사하지 않았다. 새29 안의 과거 browser-verification/qa-summary/사진은 역사17 근거다. **새20검사는 `outputs/flight3d-ready3-browser-qa-v1/runtime/browser-verification.json`이다.**

전달63파일·2,990,205바이트 manifest SHA: `43554562f85bc1f08f6cf5b55b1abbde03b1961231899791e1f1823bec14b13c`.
결속보고서 SHA: `5fdcabd7a22efdf7206c971cb48cda656d3e2ba862a19dfc361cdea97c190f83`.

통합본의 `tools/flight3d-ready3-qa/HANDOFF.md`를 따른다. 매핑본 빌드 도구는 canonical 출력 경로를 유지하므로 그대로 재빌드하면 이전출력에 쓸 수 있다. 수정·빌드는 제작담당 canonical 소스에서 새버전을 만든 뒤 다시 인계한다. 이 작업에서 빌드·의존성 설치·commit/push·배포는 하지 않았다. 이 안내 자체는63파일 전달목록 밖의 공유폴더 위치 표식이다.
