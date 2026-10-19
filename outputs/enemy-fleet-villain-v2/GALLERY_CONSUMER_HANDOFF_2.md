# 적선 통합 소비자 r2

앞선 CONSUMER_SOURCE_READY.json과 gallery.cjs는 그대로 보존한다. 이번 실행 진입점은 gallery-r2.cjs다. 대표2 생산용 SOURCE_READY.json과 실행 순서는 바뀌지 않는다.

변경은 독립 보스의 실제 status `READY-technical-QA-passed-human-art-review-pending` 수용과, 보스 전후 이미지의 조건을 비교 캡션에 표시하는 것이다. 현재 참고6 actual ART READY와 독립 보스 actual READY-r2의 작은 JSON 해시를 직접 확인했다. 큰 GLB·HTML·PNG를 이번 소스 검사에서 읽지 않았다.

기존 캡처는 중복 렌더하지 않는다. adapt-reference6.cjs는 reference-v3의 exact source-manifest/catalog/preview-bindings 3개 SHA를 검증하고 같은 카메라/FloatIdle2초/scale1/원점0 matched6쌍 계약을 확인한다. adapt-independent-boss.cjs는 독립 READY-r2의 exact SHA와 catalog/verification/전후PNG 기록을 확인한다. 각각 --prepare는 JSON만 검사, --execute는 동결된 PNG 바이트를 확인·복사하여 자체 보고서 디렉터리로 포장한다. 소유자 출력 수정0·추가 render/export0이다. 실제 포장은 뒤의 중앙 승인 범위에서 한다.

독립 보스 비교는 **동일 카메라**지만 양쪽이 같은 애니메이션 클립·시간이라는 주장을 하지 않는다. 이전 모델은 별도 mixer 없는 GLB 기본/rest 자세다. 이전 bbox X길이를 기준으로 uniform factor=32/oldX를 적용하고 old XZ중심0/old하단Y를 새하단Y로 맞췄다. 새 모델은 scale1/원좌표/전시클립0초다. 전체 X길이를 같게 맞춘 비교나 실제 미터·게임 크기 비교가 아니다. 이 조건은 원 소유자의 실제 QA 코드/보고서 및 명시 확인에 근거한다.

실행 순서(중앙 승인 후):

```
node tools/enemy-fleet-gallery/villain-v2/adapt-reference6.cjs --execute
node tools/enemy-fleet-gallery/villain-v2/adapt-independent-boss.cjs --execute
node tools/enemy-fleet-gallery/villain-v2/gallery-r2.cjs --prepare --reference-catalog=outputs/enemy-fleet-reference-v3/catalog.json --boss-catalog=outputs/chapter1-boss-review-v1/catalog.json --comparisons=outputs/enemy-fleet-villain-v2/reference6-comparisons-r1/report.json --comparisons=outputs/enemy-fleet-villain-v2/independent-boss-comparison-r1/report.json --comparisons=OWN12_ACTUAL_REPORTS
```

자체12의 실제 보고서는 대표2/다음2/나머지8 등 별도 --comparisons 옵션으로 반복한다. 정확히19 unique source-bound pair가 없으면 통합 소비를 거부한다. 새 갤러리 실행은 모든 모델·미리보기·같은 카메라 전후 PNG가 실제로 준비된 다음 --execute를 지정한다. 실제 갤러리19는 아직 출력하지 않았다. 기술 PASS와 사람의 미술 승인은 계속 분리한다.
