# 현행 생산: 고유12 + 참조6 + 독립1막보스1

기존 `SOURCE_READY.json`(source-ready1/13후보)과 `HANDOFF.md`는 과거 소스 준비 이력으로 보존한다. 최초 동결은 마지막 경량검사 종료 전 생성되어 `source-preflight.json` 한 파일의 기대SHA가 달라졌다. `FREEZE_ORDER_CORRECTION.json`에 이 소유자 순서 오류를 기록했고 현재보고서는 `source-preflight-r2.json`, 정확한정정인계는 `SOURCE_READY_2.json`이다. 이전보고서 원바이트는 덮어써져 보존되지 않았음을 명시한다. 나머지12 소스/문서 항목은 변하지 않았다.

새 직접 사용자 요청으로 `boss-bell-devourer`의 원화 기반 실제3D는 별도담당 `tools/chapter1-boss-review/` → `outputs/chapter1-boss-review-v1/` 소유다. 현행 소유모델은12개이며 새소비는참조6-v3 + 소유12 + 독립보스1 = 같은ID19개다. 보스의과거generic소스는존재하지만현행export대상이아니다. 같은보스를새종류로늘리지않는다.

## 현행 정확한 명령

- 준비만: `node tools/enemy-fleet-gallery/villain-v1/build-next.cjs --prepare`.
- 통합 단일슬롯의 대표4: `node tools/enemy-fleet-gallery/villain-v1/build-next.cjs --execute --ids=enemy-tax-cutter,mission-cult-purifier,mission-ghost-artillery,boss-last-inhale`.
- 대표4 PNG: `node tools/enemy-fleet-gallery/villain-v1/capture-next.cjs --ids=enemy-tax-cutter,mission-cult-purifier,mission-ghost-artillery,boss-last-inhale`.
- 직접시각검토뒤나머지8: `node tools/enemy-fleet-gallery/villain-v1/build-next.cjs --execute --resume`, 이후 `capture-next.cjs`.

build-next는과거build.cjs를정확한12-ID선택으로만호출하며참고6·새1막보스ID를거부한다. 실제modelscatalog의generic보스행은delegated-readonly로표시한다. 기본build.cjs를--ids없이실행하는과거13생산명령은현행에사용하지않는다. 실제GLB·PNG·UI는중앙슬롯대기이며source준비를완료아트로표시하지않는다.

최신10배과감함은큰주형태/질량·역할장치·겹구조·재료/색·움직임의체감목표다. 실제전후비교가이전의작은증폭판으로보이면새revision으로다시설계한다. 기존실행원형·sim/충돌/장비수/저장과판정은그대로다.

새6-v3와독립보스1의정확READY 후 별도최종gallery소스로19를합친다. `COMPARISON_HANDOFF_2.md`의동일카메라/2초포즈캡처는새 보조소스준비이며, 아직실제비교PNG/미술합격을뜻하지않는다. 현재gallery-next는6-v3 소비준비단계이므로 독립보스정확catalog계약수신후새manifest에소비adapter를함께동결한다. 이때까지과거gallery.cjs를최종19용으로자동실행하지않는다.
