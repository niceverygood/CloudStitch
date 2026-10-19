# Cloudstitch 함대 v2 구조 검사

이 도구는 새 `outputs/fleet-v2/` GLB와 카탈로그의 가벼운 구조 검사다. 원본 v1 전체 자산·PNG·브라우저를 검사하지 않으며, 손그림 품질·역할 식별·보스 위압감에 대한 사람의 시각 승인이 아니다. v1과 기존 통합 산출물을 수정하지 않는다.

```sh
node tools/fleet-v2/verify.mjs --ids player-homeward,enemy-tax-cutter
node tools/fleet-v2/verify.mjs
```

기본 보고서는 `outputs/fleet-v2/verification-structure.json`이다. 부분 검사는 `selection.completeV2ModelInspection:false`로 남기며, 부분 통과를 전체 모델 통과로 읽지 않는다. 같은 보고서를 갱신하므로 정식 전체 검사 기록이 필요하면 통합 담당이 최종 실행 시점을 정한다. 추가 npm 패키지는 필요 없다.

도구 준비 시점에는 구문·도움말과 메모리 합성 GLB의 8개 검사를 통과했다. 헤더/길이 손상, 위치 min/max 불일치, 인덱스 범위 초과를 거절하고 재질 색 변경은 기하 서명을 유지하며 실제 위치 변경은 서명을 바꾸는지 확인했다. 이 기록은 실제 v2 모델 통과 기록이 아니다. 실제 대표 모델 결과는 빌드 뒤 위 보고서를 확인한다.

## 카탈로그와 원본 보존

- 원본 근거는 `tools/fleet/catalog.json`, 비교 기준은 `outputs/fleet-v1/catalog.json`이다. 원본 파일을 다시 쓰지 않는다.
- 기존 `design-a1`부터 `design-c3`까지 정확한 9개 디자인 대안만 제외한다. 나머지 62개 원본 ID와 카테고리를 유지한다. 62는 고유 정사 선체 종류 수라는 뜻이 아니다.
- `modules`의 확정 정수와 미정 `null`을 그대로 유지한다. `artModules`는 별도 제작 배치이며 확정 정수를 변경하지 못한다. 미정값을 제작 수량으로 승격하지 않는다.
- 모델은 같은 ID의 `ships/<id>.glb`다. `player-homeward`는 기존 7클립 리깅을 포함한 `outputs/fleet-v1/ships/player-homeward.glb`의 바이트 동일 복사본이어야 한다. 사용한 이 원본 한 개만 읽고 SHA256을 비교한다.
- 새 모델의 방향·좌표 계약은 +Y 위, -X 전방, 임시 `fleet-kit` 단위다. GLB 자체의 숫자만으로 전방 방향이나 미터 환산을 확정할 수 없으므로 이 의미는 빌더·뷰어의 계약과 시각 검토로 확인한다.

## 새 GLB 검사 범위

GLB 2 헤더·파일 길이·청크 정렬·단일 내장 버퍼, 외부 이미지 요청 없음, bufferView/accessor 범위·stride·sparse 인덱스, POSITION의 유한 값과 실제 min/max, 인덱스 범위, 프리미티브·재질 참조, 노드 부모/순환/TRS, 스킨·애니메이션 참조와 기존 7개 클립 이름을 확인한다. 선택한 새 GLB만 순차로 연다. Khronos 전체 validator나 렌더링·재생 검증을 대체하지 않는다.

보고서의 모델 정보는 삼각형·메시·프리미티브·노드·스킨·재질·이미지·접근자 수, 각 프리미티브 위치 경계, 정지 노드 경계다. 경계는 기본 POSITION에 노드 변환을 적용한 값이며, 실제 스키닝/애니메이션/카메라 실루엣/충돌/성능이 아니다. 축 비율도 화면에서의 읽힘 점수가 아니다.

카탈로그에 `bounds` 또는 `observedBounds`가 있으면 실제 `staticNodeBounds`와 일치해야 한다. `declaredSilhouette`가 있으면 같은 설계 선언인 `readableSilhouette`와 일치해야 한다. 이 비교는 관측된 경계와 작성자의 의도를 혼동하지 않기 위한 검사이며, 선언된 랜드마크가 화면에서 충분히 읽힌다는 판정은 아니다.

## 실루엣 근거와 비교

선택선 외 새 항목은 `identityFamily`, `geometrySignature`, `readableSilhouette`를 기록한다. 동일 필드를 `redesign` 객체 아래 두어도 읽는다. 앞의 둘은 비어 있지 않은 문자열, 마지막은 비어 있지 않은 설계 설명/객체다.

선언한 geometrySignature와 별도로 실제 POSITION·인덱스 스트림의 SHA256을 `observedGeometrySignature`로 계산하고 두 값의 일치를 확인한다. 빌더는 `inspectGlb(buffer).observedGeometrySignature`를 사용해 같은 계산 규칙을 적용한다. 이는 새 GLB의 기하 동일성 탐지이며 전체 파일 해시나 미학 점수가 아니다. 같은 관측값은 중복 그룹으로 표시해 의도한 재사용인지 검토한다. 가족 이름이 같다는 이유만으로 오류 처리하지 않는다.

v1 비교는 기존 카탈로그의 style·shapeProposal·삼각형·메시 수를 사용한다. v1에 새 실루엣 지표가 없으면 `null`과 `baselineSilhouetteMeasured:false`로 명시한다. 오래된 원본 GLB를 추가로 열어 비교 측정한 것처럼 기록하지 않는다.

시각 검토에서는 09/65번의 먼 거리 역할 식별, 굵은 부모 골조와 장식 구분, 선택 귀환호의 크림 천·꿀빛 목재·청록 기계와 손그림 느낌을 따로 확인한다. 장례전함은 종실·측면 포대·후방 추진·인양, 조선소는 3구역 시설과 지휘함의 구별, 마지막 들숨은 중앙 장치·외곽 3탑·안전 경로가 읽혀야 한다. 정사 보스의 단계와 구조·서사 완성을 GLB 검사 통과로 표시하지 않는다.

## ART READY-1 실제 기록

모델 보정 종료 뒤 전체62개 구조검사를1회 실행해 모델62/카탈로그251검사가 통과했다. 보고서SHA256은 `91713b964e391efb2a64c9336498b070f95311f3165a0847faf1a7020e108f43`이다. 이후 캡처/QA상태 메타데이터만 갱신했으며 모델 바이너리는 변경하지 않았다.

대표13 모델은 단일 Chrome에서 일반/실루엣 정지 PNG26개와 비교판2개를 실제 생성했다. 이는 손그림 모드/FloatIdle 일시정지2초 프레임의 생성 성공이며 전체3모드/7클립/인터랙션/잔상/모바일 QA 통과가 아니다.

`browser-qa.cjs`는 통합 담당의 예약된 단일 브라우저 슬롯용이다. 구문·도움말만 확인했고 이 제작 담당은 실행하지 않았다. 기본13대표, `--ids=`는 부분 검사다. 출력은 `outputs/fleet-v2/verification-browser.json`이며 부분 결과를 전체 통과로 읽지 않는다. 고정 프레임 두 PNG의 바이트 비교는 반복성 보조이며 디코딩 픽셀 잔상·회전 중 잔상·장기 성능·최종 아트 승인을 대신하지 않는다.
