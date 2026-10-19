Cloudstitch · 악당 외형 참고판 v3
2026-10-18 / ART READY / viewer UI QA 중앙 예약 pending

기존 참고판 6척의 새 외형 revision이다. 큰 주형태·기능 장치·재료층·후속 움직임으로 최신 ‘10배 이상 과감하고 극적이며 풍성한’ 기준을 적용한다. 따뜻한 수공예 판타지와 손그림 같은 입체 3D를 지향한다. 단순 크기 배수나 기술 PASS만으로 표현 목표 완료를 선언하지 않는다.

해적의 거대한 빈 턱/단측 사냥돛, 교단의 계층 테라스/열린 종 아치, 인양선의 선체급 낫 턱/포획 쇄기, 수리대의 아치 화로/절단팔, 망령의 초승 낫 척추/후미 누더기/영혼 기관, 위장 잔해의 접힌 대형 덫/밝은 핵으로 실루엣을 구분한다.

현재 상태
- 세 pair 소스 메모리 조립: 유한 기하·약점·원 controls·artModules 유지 PASS 인계.
- 실제 CPU GLB export 6척 완료: export-receipt.json의 exit0, source11/11 전후 SHA 보존, exporter 종료 확인. 모델 경로·바이트·SHA는 해당 영수증에 기록되어 있다.
- 실제 구조검사6/6 PASS: 400824삼각형, 66993056바이트, 43클립, 약점12, 전개관절3, 유한FLOAT8145188값, 외부URI0.
- 실제 일반PNG6/실루엣6/위장전개1/종합판2 및 matched-before/after6쌍 생성 완료. capture/verify/preview binding exit0, code11 전후 보존, browser finally close 확인.
- preview-bindings.json에 PNG SHA와 GLB source SHA 결속. structural-verification.json, capture-receipt.json, matched-execution-receipt.json에 근거 보존.
- 최종 source/dependency manifest freeze는 통합 담당이 수행한다. 뷰어 브라우저 --quick UI QA는 중앙 예약 pending.
- 사람의 미술 승인, 장기 성능·정밀 decoded 잔상, 실제 게임 연결: 별도.

원 id 6개를 유지하고 variantId=<id>--villain-v3, baseVariantId=<id>--villain-v2, baseModelSha256=v2 GLB 해시를 사용한다. 원 modules 정수/미정 null은 유지하며 artModules는 장식 제안이다. 정사 새 적 종류·실제 피해·충돌·socket·AI를 추가하지 않는다. 실제 구조검사에서 원 7클립 이름+위장 AmbushReveal의 총43클립, 약점12, 전개관절3을 확인했다.

전후 비교는 v2/v3의 동일 카메라·화면 범위·원점·scale1·FloatIdle 2초 matched-before/after PNG 6쌍으로 생성했으며 조건 strict 일치를 확인했다. 개별 fit thumbnail은 별도 감상용이다. 최신 10배 체감 목표의 최종 미술 승인은 별도다. 셀 명암/윤곽선은 뷰어 런타임 기능이며 GLB만으로 자동 재현되지 않는다.

v2 ART49 / v1 ART53 / 이전174·95 동결 원본을 보존한다. v1 원화·아틀라스를 읽기 재사용하고 신규 ImageGen/Meshy 호출은 0이다. 이 폴더만 복사해 읽기 의존성을 잃지 않게 한다. 별도19종 갤러리는 나머지13종과 이6종을 읽어 통합하며 같은6모델을 중복 제작하지 않는다.

소스·실행·통합 순서: tools/enemy-fleet-reference/villain-v3/HANDOFF.md
소스 도구: 같은 폴더의 build.cjs, verify.mjs, capture.cjs, browser-qa.cjs --quick.
기존 설치 런타임을 사용하며 새 설치·공통 잠금 파일 변경은 이 작업에 포함하지 않는다. ART READY는 산출물 인계 상태이며 UI QA·사람의 미술 승인 완료를 뜻하지 않는다. 최종 freeze는 실제 manifest·모델/preview 해시·검사 보고서와 함께 통합 담당이 수행한다.
