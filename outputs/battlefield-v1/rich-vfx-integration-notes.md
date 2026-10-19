# v1 효과 확대 후속 기록

사용자 선택에 따라 기존 v1의 형태·색을 유지하며 크기와 작은 보조 효과 층을 조정했다. 원본 GLB·원화·기존 v1/v2 출력은 보존한다. 준비 소스: `tools/battlefield/rich-vfx-handoff.json` (`43a3ca2d3ca630a474f36d4a453008b8a93a29189191229e7c6017b6413d80b7`).

- 포구 1.4배, 탄체 1.35배, 명중 1.5배, 폭발·연기 1.6배, 상태·지원 1.3배.
- 포구·명중·연기 등의 보조 층은 같은 v1 GLB의 작은 지연 복제다. 원본 클립 종료 시 함께 반환한다.
- 투사체·작살줄·회수·장착·수리·지속 상태의 의미를 복제하지 않는다. 전투의 HP·피해·충돌 반경·사거리·시간은 그대로다.
- 효과별 활성 단발 32개/활성 투사체 64개/비활성 풀 24개 제한은 **original과 rich 양모드에 공통 적용**한다. 과부하에서는 표시만 생략하고 drop 수를 기록한다. 기본 original은 형태·색·배율 1을 유지하지만, 과부하 표시 정책까지 이전 구현과 완전히 동일하다는 뜻은 아니다.
- 48종은 비행선 위 원본/확대 외형 비교를 제공한다. 실제 전투 연결은 기관총·함포의 6효과다.

검증: Node 72/72(기존48+profile10+실제 Three runtime14; runtime은 상위1+하위13), 실제 GLB 바인딩·해시9/9. 실제 sim 단발 피해·중복/구세대 차단·풀 복원·100발 표시 상한·해제를 확인했다. 이는 실제 브라우저 렌더나 게임 전체 성능 인증과 구별한다.

통합 담당이 별도 `outputs/integration-rich-vfx-v1/`와 `outputs/battlefield-rich-vfx-v1/preview.html` 빌드를 완료했다. 실제 전투 13/13, 48종 로드·대표 3모드·모바일·요청 검사 66/66이 통과했다. 추가 화면 검토에서 표적판 뒤에 가리던 명중 효과를 발견해 비교 화면의 초기 카메라만 입사면 쪽으로 보정했다. preview 0.1.1 인계는 `a5cd43acce2903c882196f60ed844b3c12fe53c4a872f46312a9daa8495bfd6f`이며, 기존 0.1.0 인계와 변경 전 3파일은 `tools/battlefield/history/v1-rich-0.1.0/`에 보존했다. 실제 전투 런타임은 변경하지 않았다. 카메라·초점·390px 모바일 후속 5/5도 통과했다.

실제 hit 뒤 0.10 sim초를 진행한 확대 화면 4장을 추가했다. 보충 검사 8개 중 7개 통과, 반복 렌더의 PNG 완전 일치 1개는 실패 기록을 유지했다. 별도 고정 시계·좌표의 raw WebGL 검사에서는 16회 후 2픽셀/최대 채널차 1, 64회 후 차이 0픽셀을 확인했다. 이를 원래 엄격한 PNG 검사의 통과로 바꾸지 않았다. `OutlineEffect.autoClear=true`와 renderer clear를 유지했다.

최종 보고서: 통합 담당 checkout의 `tools/integration-rich/HANDOFF.md`, `outputs/integration-rich-vfx-v1/{verification.json,verification-browser.json,impact-verification.json,fixed-clear-verification.json,delivery-manifest.json}`, `outputs/battlefield-rich-vfx-v1/{verification-browser.json,camera-verification.json}`. 보호 대상 기존 202파일 변경 0을 확인했다. 새 두 URL은 HTTP 200으로 확인했고 이 채팅의 Codex 브라우저 패널에 열기를 요청했다.

유료 생성·의존성 설치·push·배포는 수행하지 않았다.
