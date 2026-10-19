# 적군 함대 디테일 개선 v2

직접 피드백: 전체적으로 디테일이 너무 떨어짐. v1은 기술PASS/미술부족 원본으로 보존한다.
소유 tools/chapter1-fleet-detail-v2/ → outputs/chapter1-fleet-detail-v2/만. 기존모델/정사/단일sim 변경0.

우선 대표3(scout/command/executor), 실제렌더/원무드보드/동일카메라v1을 비교해밀도를확인후나머지8을적용한다.
보강: 둥근모서리의두꺼운부재, 겹판금/리벳/골조/받침, 실제기낭지지대와버클/봉제·수선조각, 엔진냉각구/보호링/배관, 정찰정함교·관측우리·가이라인, 지휘정다층함교/창/발코니/나팔지지·기어·조명, 중간보스곡면차양/금속늑골/두꺼운집게힌지·유압관·쌍윈치케이블/톱니.
더작은리벳만늘린것이아니라중간기능구조와재료층을보강한다. 최신10배표현의사용자체감은사람미술검토별도다.

표면: GLB에내장되는실제512pxPNG5장(금속판/직물직조·봉제/목재결/황동붓결/도색)을로컬코드로제작, UV와baseColorTexture기록. 유료생성0. 매트정점색과결합, 셀·윤곽은HTML런타임. OutlineEffect.autoClear=true유지.
GLB메시/6초프로펠러클립/좌표는v1과같은의미며콜라이더·장착·AI·피해·LOD미구현. 단순비교용미술단위.

기존Node three/esbuild/playwright+pngjs(워크스페이스번들) NODE_PATH읽기사용. 설치/공통변경없음.
`node tools/chapter1-fleet-detail-v2/build.cjs --prepare`: 대표3기하finite/bounds,export/browser0.
중앙START후 `node tools/chapter1-fleet-detail-v2/build.cjs --execute`→`node tools/chapter1-fleet-detail-v2/qa.cjs`.
대표3모델텍스처/3모드/clip/PNG,기본조작/윤곽/390/다운로드/120프레임잔상, 별도구본페이지에서동일camera/target/frustum의원새PNG.
승인된표현개선범위의소스결정뒤 `FLEET_ALL=1`로같은build를실행하면11종출력(실행은별도슬롯).
정적산출/미술승인은실제렌더후기록한다. 현재기하대표3 finite0오류,bundle통과는시각통과가아니다.

## 실제 결과

대표3: SOURCE_READY-representatives-r1 exact7+원v1 GLB3보존,실제GLB5PNG맵/3모드/clip/controls/윤곽·모바일/120clean·다운로드/동일camera이전비교53/53 PASS,exit0/finallyClosed.
근접: CLOSEUP_READY source/대상3HTML/GLB핀보존,실제3ship×3group=9PNG,맵20/24/32메시존재확인,errors0/finallyClosed. full53재실행0.
잔여8: SOURCE_READY-r2 exact8/대표3GLB보존후 FLEET_REMAINING=1로8개만export. 실8load·maps·3mode·clipPNG+최종gallery11 61/61 PASS,exit0/finallyClosed. 대표3재export/검수반복0.
전체11 glTF-Validator 오류0/경고0,정보49(빈그룹/사용되지않는이미지등)남음. 정보0으로표현하지않는다.

실제갤러리11/대표3전후/근접9중함교·기낭·집행윈치/잔여견인·화염·수리PNG를직접읽었다.
기능층(지지·골조·함교·기어·접합·봉제·윈치)이v1보다읽히나큰흑청면/U자장식반복/황동표면패턴/무드보드조각밀도부족은남아있다. 원화동급최종완성/최신미술목표달성/사람미술승인아님.
comparison.html에서원새동일camera/viewport/frustum·원scale1·정지자세PNG와접합부9확대PNG를확인한다. 3종의v1은기본rest,new는clip0초이며실제게임스케일비교아님.
대표3원출력은유지,현재catalog에기존3+나머지8을병합했다. source r2는나머지8분기추가/선택export·QA필터만,대표기하/renderer불변이다.
삼각형/파일크기가커진아트리뷰에셋이며런타임최적화예산·LOD는미구현. 모든GLB는5개실제512px재료PNG를포함하나엠버는텍스처미사용.
