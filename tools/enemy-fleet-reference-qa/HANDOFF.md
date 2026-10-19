# Cloudstitch 새 적함선6종 독립 QA

2026-10-18. 기존 함대174·비교95·통합 시제품을 보존하고, 새 `enemy-fleet-reference` 패키지만 통합 작업 트리에 이관했다. 사용자 첨부 콘셉트는 원본 `reference.png`로 보존한다.

## 열기

- [새 적함선6종](http://127.0.0.1:8840/outputs/enemy-fleet-reference-v1/index.html)
- [브라우저 보고서](../../outputs/enemy-fleet-reference-browser-qa-v1/verification.json)
- [소스 사후 대조·증거 결속](../../outputs/enemy-fleet-reference-source-finalization-v1/verification.json)
- [이관 receipt](../../outputs/next-ready-imports/enemy-reference-ready1.json)

루트 HTTP 서버는 `node tools/integration/serve.mjs 8840`이다. 기존 작업 공간의 경로나 서버로 바꿔 읽는 경우 실제 SHA를 먼저 비교한다.

## 실제 검증

Chrome1개·페이지1개에서 새 모델6개의 직접 뷰어와 갤러리 모달6개를 순차 검사했다. **273/273 통과**, 페이지·콘솔·HTTP·외부·요청 실패0이다. 세 표시 모드, 실제 포함된43클립, 약점 표시12개 ON/OFF, 위장 잔해 전개3관절의 변화와 원복, 회전·확대·화면 맞춤·초기화, 390px 화면을 확인했다. 갤러리는 한 번에 뷰어 iframe1개를 유지한다. `OutlineEffect.autoClear`의 실제 값도 확인했다.

정식 소유53파일·176,610,938바이트와 manifest 원바이트를 이관했고, QA 이후53파일의 크기·SHA가 모두 일치했다. manifest SHA256은 `679421632594a7864b1790aecd85267580ad362bf96ee966879c479d5cf62d8f`, 실행 하네스는 `bf8b09948a39b458dd2f5214dcdc2ad24d3ae5ce1b0b995a5d9d135fc9680054`다. 원본53에는 손대지 않고 새 폴더별 `.gitattributes`로 내장 GLB를 담은 `ships/*.html`의 LFS 규칙만 추가했다. PNG·GLB·대형 HTML의 실제 `filter:lfs`를 확인했다. 커밋·푸시는 하지 않았다.

소스 문서 상단에 남은 ‘보완2척 재내보내기 대기’는 과거 문구다. 교단 판금과 망령 균열의 보완·2척 재내보내기·재캡처는 완료했고, 최종 catalog와 PNG의 source SHA가 일치하는 위 manifest 버전을 검사했다. 동결 소스의 문구는 수정하지 않으며 이 별도 인계의 완료 기록이 그 대기 문구를 대체한다.

정식 브라우저 보고서 SHA256은 `3aa016401bba98dfa3f53fb80ec7d93092a098a818252ae30e82330a2d81bf77`, 사후 결속 보고서는 `8314ef2ca76681217a2c4cbf4d5731e89366da0f745c28fa5b02a56d4092469d`다. 브라우저 종료 후 원래 `work/` 캡처는 보존하고, 확인용 데스크톱·모바일 PNG 사본은 별도 QA 출력 `screenshots/`에 두었다.

## 해석과 한계

원참고 보드와 실제6종 overview를 직접 열어 역할별 실루엣의 차이를 확인했다. 이 결과는 원화의 회화적 명암·세부 밀도·망령 광채·전체 아트 방향의 사용자 승인을 뜻하지 않는다. 각 함선은 개별 화면 맞춤으로 표시하므로 이미지 크기를 공통 미터나 게임 상대 크기로 채택하지 않는다.

정밀 회전 잔상 비교는 `not-run`이다. 장시간 자원 안정화·성능 예산·실기기·다른 브라우저를 검사하지 않았다. 약점 마커는 표시와 관절 위치 원형이며 실제 피해·충돌·소켓·부품 절단 규격이 아니다. FireBurst 등의 클립 존재는 실제 투사체·피해·AI·보스 패턴 완료를 뜻하지 않는다. 없는 장치 버튼이 비활성인 경우는 정상 처리했다. 새6종을 최종 battlefield나 저장 데이터에 자동 교체하지 않았다.

재실행이 필요하면 새 보고서 경로를 지정한다. 현재 결과를 단순 열람하려고 검사·생성·캡처를 반복하지 않는다.

```powershell
node tools/enemy-fleet-reference/browser-qa.cjs --report=outputs/enemy-fleet-reference-browser-qa-v2/verification.json
```
