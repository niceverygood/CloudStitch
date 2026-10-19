# Cloudstitch · 비행선 무기 공방 12종 · READY-r2

기준일: 2026-10-19 (Asia/Seoul). 실제 GLB12·실제렌더PNG15·갤러리·오프라인3D작업대 완료. 사용자 3D미술승인 대기.

최신 직접 요청: “실제 GLB 파일과 미리보기 만들어줘 무드보드처럼 만화적상상이 가미된 과감한 연출이 필요해”.
승인v2보드의 절제한 판타지·기계원리를 유지하고 긴 활대/두꺼운 애자/큰 로프드럼/전개방패/큰 톱원반/굽은붐/풍성한 주름풀무/쐐기로 실루엣을 구별했다.
목재·황동·청록·크림천·산호수선의 재료층을 표현했다. r2는 조립좌표 기준 명암을 정점색으로 구워 입체감을 보강했고 실제미리보기의 투명여백을 잘랐다.

열람:
- gallery.html: 실제GLB렌더12카드, 개별3D/GLB다운로드.
- index.html: 모델/라이브러리/보드가내장된 오프라인작업대. 회전·확대·이동·맞춤·초기화·자동회전·3모드·전후상단사선·윤곽·배경.
- overview.png: 실제갤러리 전체캡처.
- assets/*.glb: 독립 정적 다중메시12개, 최종합계34,886,524bytes.
- previews/*.png: 실제WebGL 대표12+대궁/방패/톱후면3=15장.
- catalog.json / manifests/*.json: 크기·SHA·삼각형·메시·경계·공식검사.
- glb-verification.json / browser-verification.json / capture-verification.json / gallery-verification.json: 개별근거.

실제검사:
최종302,988삼각형·2,147메시. 정점채색/매트재질·텍스처0·애니메이션0. GLTFExporter→실제GLTFLoader 재로딩에서 메시/삼각형 일치·유한좌표/법선/행렬/경계·색0~1. 공식glTF12개 오류0·경고0.
팬에서 exporter가비단위법선을정규화했다는진단이있었고 출력공식검사는통과했다.
브라우저12로딩/36모드/12다운로드SHA일치. 대표전기탑만3모드각120프레임회전후깨끗한렌더대조 변경픽셀0·카메라동일·OutlineEffect.autoClear=true.
드래그/휠/맞춤/초기화/자동회전/시점/윤곽/검색·분류/버튼다운로드·390px모바일넘침0·페이지/console오류0·실패/외부HTTP요청0.
갤러리12이미지decode·12카드·36링크·390px넘침0. 최종렌더후GLB12/원화SHA보존.
Chrome/exporter 종료·필수post대조후 총괄에heavy슬롯반환. 사람미술승인·게임성능승인과기술검사는구별한다.

보존:
기존무기6/원GLB/VFX/전장/공통package/서버·v1/v2원화 수정0. 새이미지/paidMeshy0·배포/commit/push0.
첫실제출력은baseline-r1/에 GLB12·PNG15·manifest/catalog·browser검사·작업대캡처로보존했다.
원소스snapshot은work/grounded-weapons-v1/source-r1/, 원초기내장HTML은work/grounded-weapons-v1/index-baseline-r1.html에보존(work는타PC이관대상아님).
SOURCE_READY-r1.json은이전대기기록으로최종소스manifest가아니다. READY-r2.json이현재인계다.
r1/r2는동일형상/시점의정점명암보완이다. r2PNG는추가로여백만잘라캔버스치수가다르다.

한계:
실제입체정적아트이며 애니메이션·실제조준/공격/피격/폭발/음향·충돌·피해·물리·LOD·엔진표준소켓은없다. 구분된부품그룹을동작리그/파괴트리/게임장착완료로해석하지않는다.
정밀붓결텍스처맵은없고 정점색·기하학적나뭇결·단순명암으로표현했다. 셀명암/윤곽은뷰어런타임이며 GLB임포트만으로자동재현되지않는다.
가려진후면·소형기구는새해석이다. 최종함선소켓치수·중량/전력·성능/밸런스는미정이다.
기술완료와 사람의최종미술/게임승인은구별한다.
