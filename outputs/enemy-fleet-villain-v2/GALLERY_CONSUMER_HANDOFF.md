# 적선 19종 소비 계약

이 문서는 producer SOURCE_READY.json과 별도의 소비자 준비다. 실제 모델 19종이나 렌더 완료를 뜻하지 않는다.

tools/enemy-fleet-gallery/villain-v2/gallery.cjs는 참고6 최신 villain-v3 catalog, 자체12 dominant-form-rebuild-v2 models.json, 독립 boss-bell-devourer 1개 chapter1-boss-review-v1 catalog를 받아 정확히19종만 통합한다. 기존 ID와 기획 세력·분류는 유지한다. 새 보스와 참고6는 생성하지 않는다.

각 실제 catalog 항목은 assetPath/viewerPath/previewPath와 sha256/previewSha256/previewSourceSha256(현재 모델 SHA 일치)을 제공해야 한다. 독립 보스는 실제 boss.glb/index.html과 실제 PNG 경로를 제공해야 한다. SOURCE_READY는 이 계약의 actual READY가 아니다.

--comparisons=repo/report.json은 필수이며 분할 보고서를 여러 번 지정할 수 있다. 합계 정확19 unique 항목의 passed/sameCamera, 전후 GLB SHA, 전후 PNG SHA를 검사한다. 자체12와 독립 보스의 before는 원 fleet-v2, 참고6는 소유자 v3 catalog의 baseModelSha256에 해당하는 v2다. 비교창은 보고서 위치의 id/before.png·after.png를 쓰며 모델 카드 미리보기는 별도로 현재 모델과 결합한다.

--prepare는 JSON만 읽고 자산·브라우저·출력을 만들지 않는다. --execute는 실제 GLB·PNG·뷰어를 해시/형식 검사한 뒤 새 outputs/enemy-fleet-gallery-v2/를 생성한다. 기존 출력이 있으면 거부한다. GLB는 갤러리에 내장하지 않고 선택한 3D 뷰어 한 iframe만 지연 로딩한다. 필터·검색·같은 기체의 전후 비교를 제공한다.

bind-previews.cjs는 자체12의 이미 완료된 실제 비교 after.png를 models.json에 결합한다. 추가 캡처를 하지 않는다. --prepare는 JSON 결합만 확인하고 --execute는 PNG SHA/형식 확인 후 모델 catalog만 갱신한다. 대표2/다음2/나머지8 순차 보고서에 각각 적용할 수 있다.

구문 및 어댑터 합성 JSON 검사는 완료했다. 실제19 모델·PNG와 비교 보고서가 아직 모이지 않아 소비 실행0이다. 실제 갤러리 출력·브라우저/모바일/링크/필터·잔상 검수와 사람의 미술 판단은 이후 중앙 단일 슬롯에서 수행한다. 원 gallery-v1/frozen17·원 GLB·원 PNG는 보존한다.
