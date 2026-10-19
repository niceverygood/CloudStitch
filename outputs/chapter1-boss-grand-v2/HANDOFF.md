# 종을 삼킨 자 · 대장례함 v2

2026-10-19 직접 요청: 훨씬 웅장하고 악당 같은 GLB, 조정 가능한 윤곽선.
소유: tools/chapter1-boss-grand-v2/ → outputs/chapter1-boss-grand-v2/만. 기존 v1·원화·게임 규칙 보존.

큰 형태 변경: 두꺼운 외부 흉갑과 겹침 판금, 두 층의 높은 측포 갑판, 넓어진 철갑 볼과 눈썹/화로 눈, 크게 굽은 엄니 충각, 높고 넓은 부벽 종실, enlarged hollow bell, 양측 어깨 기관탑과 굽은 연통 왕관, 대형 장례 장막.
최신 10배 기준은 크기 배수 하나 대신 위 큰 형태/중간 장치/황동 테두리·리벳·봉인층을 함께 재설계해 적용한다. 미술 승인과 기술 검증은 별도.

GLB: +Yup/-X선수/+X후방, 상대 미술 단위. 6초 전시 종/프로펠러 클립1 유지, 전투 AI·충돌·피해·장착·LOD 미구현.
매트 정점 채색은 GLB 포함. 손그림/셀 명암/윤곽은 뷰어 런타임. OutlineEffect.autoClear=true 유지.
윤곽 켜기/끄기, 두께0~8, 색 선택, 농도0~1 조절. 원화와 v1 모델을 동일 카메라/원 scale1로 토글 비교. 실제 게임 크기 확정 아님.

기존 three/esbuild/playwright/gltf-validator를 NODE_PATH로 읽기 재사용, 설치·공통변경0.
`node tools/chapter1-boss-grand-v2/build.cjs --prepare`: 번들만.
중앙 START 후 `node tools/chapter1-boss-grand-v2/build.cjs --execute`: GLB/내장 HTML.
중앙 START 후 `node tools/chapter1-boss-grand-v2/qa.cjs`: 실제 GLB/3모드/120RAF잔상·조작·모바일390·다운로드·클립·구신비교·윤곽신규조절.
현재 소스 경량 finite 검사 통과. 실제 출력/검사/시각검토는 verification.json과 최종 READY 확인.

실제 결과: export exit0, Chrome155 실제 브라우저51/51 PASS 및 finally close.
GLB 30,004,652바이트 /277,408삼각형/43메시/12재질/6초클립1. 공식 glTF 오류0·경고0·정보0.
실제3모드·3×120RAF잔상0·드래그/휠/시점/초기화/맞춤/자동회전·390px·다운로드/메모·장치동작·동일카메라v1비교·윤곽두께6/색/농도0.4적용 통과. HTTP/페이지 오류0.
source6 사전동결/사후일치, v1 GLB/HTML 원SHA보존. 실제 전체·iso·윤곽조절 PNG를 열어 확인했다.
v1보다 높은 종실·확대한 종·겹흉갑·다층포갑판·큰 엄니/괴수얼굴·왕관연통이 구분된다. 정점색 기반 표면은 원화의 회화적 세부보다 단순하며 사람 미술 승인은 대기다.
윤곽 조절은 HTML 뷰어 표현이며 GLB를 다른 앱에 가져가면 해당 앱에서 별도 설정해야 한다.
