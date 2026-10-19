Cloudstitch · 적 함선6종 최종 조작 검사
2026-10-18

이 기록은 적 함선 ART READY1 봉인 이후 통합 담당이 실행한 실제 Chrome 검사입니다.
outputs/enemy-fleet-reference-v1/README.txt와 source-manifest.json의 UI검사 대기 상태는 아트 인계 시점 기록입니다.
그 파일들의 원본53개를 그대로 동결해 검사했고, 최종 결과는 이 폴더의 verification.json을 따릅니다.

결과: 273/273 PASS.
- 직접 모델6개와 갤러리6개 모델 로딩
- 손그림/셀 명암/원본 재질, OutlineEffect.autoClear=true
- 실제43클립, 약점12곳 표시 켜기/끄기, 위장 외피3뼈대 전개/원복
- 시점/회전/확대/맞춤/초기화/자동 회전
- 390픽셀 모바일 폭, 갤러리 선택/비교/동시 iframe최대1/닫기
- 브라우저 오류·콘솔 오류·실패 요청·HTTP오류·외부 요청0

screenshots/에 통합 담당이 보존한 실제 갤러리 desktop/mobile 화면이 있습니다.
../enemy-fleet-reference-source-finalization-v1/verification.json은 검사 전후 아트53파일의 SHA일치와 검사하네스/원보고서 해시를 결속합니다.
아트 manifest SHA256: 679421632594a7864b1790aecd85267580ad362bf96ee966879c479d5cf62d8f
검사 하네스: tools/enemy-fleet-reference/browser-qa.cjs
하네스 SHA256: bf8b09948a39b458dd2f5214dcdc2ad24d3ae5ce1b0b995a5d9d135fc9680054
원보고서 SHA256: 3aa016401bba98dfa3f53fb80ec7d93092a098a818252ae30e82330a2d81bf77

한계: 정밀 회전 잔상 픽셀 회귀는 not-run입니다. 장시간 성능·실기 모바일·다른 브라우저·게임 플레이는 검사하지 않았습니다.
약점 피해/절단·소켓·충돌·기습 AI는 기존 전투에 연결하지 않았습니다.
역할별 실루엣은 구별되지만, 첨부 원화의 회화성·소부품 밀도·망령 광채의 완전 재현이나 최종 아트 승인은 별도입니다.
새 재료 아틀라스는 내장 이미지 생성1건으로 만들었고 실제3D는 코드로 조립했습니다. 원화/프롬프트는 ../enemy-fleet-reference-v1/에 보존했습니다.
