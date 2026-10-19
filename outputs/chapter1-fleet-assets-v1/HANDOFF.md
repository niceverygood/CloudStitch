# Cloudstitch · 1막 적군 함대 독립 GLB11

2026-10-19 직접 요청: 적군함대를3D에셋으로. 소유 tools/chapter1-fleet-assets/ → outputs/chapter1-fleet-assets-v1/.
읽기 원화 catalog/PNG: outputs/chapter1-enemy-moodboards-v1/. 선택최종보스 grand-v2 및 기존전체19·게임규칙·공통패키지는 수정하지 않는다.

일반10: 가시까마귀(sc​out), 철턱 들이받이(ram), 검은 관 포격함(cannon), 갈고리 사냥꾼(tow), 장송 방패함(shield), 향로 불씨함(fire), 묘지기 박격함(mortar), 사슬 거미함(chain), 봉인 수복선(repair), 검은 종 지휘정(command).
중간보스1: 장례 집행관(executor). 기존 mini-funeral-guard와의 게임ID대체는 확정하지 않으며 이 함대 아트목록은 chapter1- prefix로 분리한다.

형태: 종류마다 선체길이/폭/깊이·기낭위치·주장치를 다르게 설계했다. 정찰정은긴부리/신호탑, 돌격정은넓은집게턱/쌍엔진, 함포정은대형중공포신/반동방패, 견인정은열린A프레임/윈치/갈고리, 방어정은겹철문방패. 화염정은향로탱크3/배관, 박격함은위로열린대형포구, 사슬정은넓게벌린4붐, 수리정은관절수복팔/부품갑판, 지휘정은나팔군/소형경보종, 중간보스는거대한집게/쌍윈치/장례차양.
최신10배표현은 강한큰주형태/중간기능덩어리/금속·천·황동·리벳·봉제층으로 적용. 작은도형색교체로종류만채우지않는다. 원화대비표면회화세부는단순한코드입체해석이며사람미술승인별도.

각GLB: 실제입체/매트정점색/6초프로펠러전시클립1. +Yup/-Xbow/+Xstern,미터미확정상대미술단위. 실제AI·사격·피해·충돌·절단·장착소켓·LOD·성능최적화미구현. 부위그룹은리뷰용으로게임연결트리명세아님.
HTML은각모델/원화/three를내장하는오프라인뷰어. 회전·확대·초기화/화면맞춤/자동회전·3표시모드·부위숨김/확대·클립·윤곽on/off/두께색농도·GLB다운로드. OutlineEffect.autoClear=true 유지. 셀/윤곽은HTML런타임이며GLB만다른엔진에넣어자동재현안됨.

재현: 기존three/esbuild/playwright/gltf-validator를NODE_PATH제공, 설치/공통변경없음.
`node tools/chapter1-fleet-assets/build.cjs --prepare`: 번들+형상preflight만,export/browser0.
중앙START후 `node tools/chapter1-fleet-assets/build.cjs --execute`: GLB11/뷰어11/갤러리1.
중앙START후 `node tools/chapter1-fleet-assets/qa.cjs`: browser1,11모델순차로딩/3모드/clip·PNG,대표scout/executor윤곽·조작·3×120프레임/390/download,갤러리11카드/오프라인검수.
형상preflight11종유한정점오류0/양의경계/구별되는기하수치통과. 실제GLB/브라우저/미술검토결과는verification/최종READY에기록한다.
유료생성·Meshy·새이미지·외부배포·자동화·commit/push0. 원화·선택최종보스보존.

## 실제 결과

중앙 START 후 source-r2 exact6 사전확인,11 GLB와11뷰어/갤러리실제출력완료.
첫검사 range.fill('.5')의Malformed value로실패. 원raw보존후QA입력표기만'0.5'로수정, 제품모델/뷰어5소스불변/재export0.
후속 Chrome 실제89/89 PASS·exit0·finallyclosed. 전체11실제GLB/3모드/프로펠러클립·PNG,대표정찰/중간보스의윤곽두께색농도/드래그확대맞춤초기화자동회전/3×120프레임잔상0/390px/다운로드SHA,갤러리11실제이미지/모바일/HTTP0·페이지오류0.
glTF-Validator 전체11 오류0·경고0, 빈검수그룹 NODE_EMPTY 정보31개는남아있다(정보0아님).
실제갤러리전체11과정찰/방어/수리/중간보스PNG를직접열어확인. 역할별비율과주장치가구별되나 무드보드보다회화적표면과조각밀도가단순한3D아트초안이다. 미술목표최종달성/사람승인은대기.
SOURCE_READY-r1/r2는보존하고최신SOURCE_FINAL.json에QA한줄정정해시/제품소스불변을기록했다. READY.json flat파일목록으로이관한다.
