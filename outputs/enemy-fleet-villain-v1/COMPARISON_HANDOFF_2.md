# 새19 갤러리 · 최신10배 표현/동일카메라 비교 인계

이 인계는 최신 `docs/ART_DIRECTION.txt`의 **10배 이상 과감하고 극적이며 풍성한 체감**과 같은 카메라·이벤트 조건의 실제 전후 비교를 위한 새 보조 소스다. 수치/scale/입자수를10배 곱하거나 기술PASS로 미술승인을 대신하지 않는다. 과거13후보의모델소스는그대로이며경량보고서동결순서FAIL은SOURCE_READY_2에서정정했다. 현재실제생산은SOURCE_READY_3의12개이며reference6-v3와독립1막보스1은읽기소비한다. reference6의v2 ARTREADY1도 이전기술checkpoint로 보존한다.

## 분업과 입력

- 소유12의 실제 모델은 `build-next.cjs`를 통합 단일슬롯에서 실행하고 대표4 실제PNG를 먼저 직접 검토한다. 장례전함중복export를거부하며새보스는읽기소비한다. 아직 source-ready는실제모델완료/최신미술목표이행이 아니다.
- 함대owner가 새 `outputs/enemy-fleet-reference-v3/`에 기본6을 별도 재설계한다. 그variant를읽기참조해전체19의새revision으로합친다. 같은sourceID를새종류로늘리지않는다.
- `gallery-next.cjs`는6-v3계약초안이며,독립보스의정확catalog수신후consumer를추가동결해야하므로이보조READY의실행파일에는아직포함하지않는다. 6의before=v2/after=v3와소유12의before=원v2/after=새12,새보스의명시적before를정확히묶는다. 실제준비되지않은모델을예전외형으로몰래대체하지않는다.
- 목재/천/황동의손그림재료와세력팔레트,크고다른주형태·중간기능장치·장식층을함께비교한다. sim수치·장비수·충돌·AI·캠페인/저장권위는유지한다.

## 새 소스/실행 순서

1. **즉시필요한소유대표4비교**: 모델4의실제export뒤 `node tools/enemy-fleet-gallery/villain-v1/comparison-r2/pairs-from-models.cjs --ids=enemy-tax-cutter,mission-cult-purifier,mission-ghost-artillery,boss-last-inhale --out=outputs/enemy-fleet-villain-v1/pairs-initial4-r2.json`. 아래capture에이JSON과새 `comparisons-initial4-r2` 출력경로를주면기본6/새보스준비와독립적으로실제같은카메라전후를직접검토할수있다. pairs생성은JSON만읽고GLBbytes/browser0이다.
2. **후속최종19소비초안**: 새12 실제GLB/preview와reference6-v3·새보스 READY후 최종consumer를동결해 `gallery-next.cjs --pairs-only`로19pair입력을생성한다. 아직이최종consumer는독립보스계약대기다.
   - 기본 reference=`outputs/enemy-fleet-reference-v3/catalog.json`. `--reference=`로정확한repository-relative catalog를지정할수있다.
   - JSON/경로존재만읽어 `outputs/enemy-fleet-villain-v1/comparison-pairs-r2.json`을만든다. 큰GLBbyte읽기·해시·브라우저0.
3. 통합의예약된단일슬롯에서 `node tools/enemy-fleet-gallery/villain-v1/comparison-r2/capture.cjs --pairs=outputs/enemy-fleet-villain-v1/comparison-pairs-r2.json --out=outputs/enemy-fleet-villain-v1/comparisons-r2`(대표4는위JSON/출력명을대입).
   - 준비만검사하려면 `--prepare`. JSON검증/메모리번들만하며GLB·브라우저·출력생성0.
   - 실제실행은브라우저1/페이지1/각전후쌍순차. 원본은읽기만하고서로다른실제GLB의native좌표·크기를따로정규화하지않는다.
   - 전후의2초FloatIdle 포즈에서두장면경계를합쳐카메라/target/정사영범위/빛/재질처리/DPR1을하나로고정한다. 전방-X를보는사선시점이다. FloatIdle없음은기록한다.
   - id별before.png/after.png/pair.png와report.json에실제입력바이트SHA·카메라/포즈·경계·PNG SHA·차이/내용픽셀·오류/외부요청을기록한다. 출력폴더가이미있으면덮어쓰지않고새revision경로가필요하다.
4. 보스consumer계약완료뒤 최종 `gallery-next.cjs --comparison-dir=outputs/enemy-fleet-villain-v1/comparisons-r2`를별도READY로인계한다.
   - report의id/전후입력SHA/카메라동일/기술PASS와각PNG를맞춘뒤새19갤러리에실제같은카메라전후이미지를연결한다.
   - 기본19/일반7·임무7·보스시설5와별도라이벌·시험7,단일3D모달은유지한다. 전후드롭다운은같은기체로함께바뀐다.
5. 통합슬롯에서기존 `capture-gallery.cjs`로19한장/대표전후/390px를촬영한다. 새모델·새화면에대한필요한좁은조작·3모드·윤곽·클립·외부요청·잔상검사를별도기록하고기존68을자동반복하지않는다.

## 실제 확인/남은 한계

새보조소스의문법과메모리번들만검사했다. 브라우저/실제GLB/동일카메라PNG는아직실행하지않았다. source모델·원본·동결PASS/FAIL·SOURCE_READY1은그대로다. 비교의픽셀변화는실제형태차이근거이며10배체감이나사람미술승인자동통과가아니다. 대표5중장례전함종실과마지막들숨1심장·3탑의중복/가림,새주형태의압도적차이와독자성은담당이실제이미지로확인후부족하면새revision으로보완한다.
