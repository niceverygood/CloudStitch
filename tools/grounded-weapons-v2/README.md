# Cloudstitch 추가 무기·장치 6종

사용자 “무기 더 만들어줘”의 승인된 기계수공예·만화풍을 연장한 독립 디자인이다. 원보드의 재료/톤을 참조했지만 이 6종은 원보드에 직접 그려진 항목이 아니다. 로켓 선반·원반 발사기·피스톤 망치·드릴창·투하대·인양 집게를 신규 다중메시로 작성한다.

기존 tools/grounded-weapons-v1/kit.mjs를 읽기 재사용한다. exporter/viewer/capture 등은 v1에서 별도 복사하고 6종 경로/목록에 맞췄다. 이전 파일은 수정하지 않았다. Node/three/esbuild/gltf-validator/playwright/sharp의 현재 설치를 사용하며 NODE_PATH 및 GLTF_VALIDATOR_PATH는 로컬에서 확인한 경로로 설정한다.

```sh
node tools/grounded-weapons-v2/run.cjs inspect
```

중앙 단일 슬롯 START 이후:

```sh
node tools/grounded-weapons-v2/run.cjs export --slot-start
node tools/grounded-weapons-v2/build.cjs
node tools/qa/world-workbench.cjs outputs/grounded-weapons-v2/index.html work/verification/grounded-weapons-v2 outputs/grounded-weapons-v2/catalog.json all 6
node tools/grounded-weapons-v2/capture.cjs --slot-start
node tools/grounded-weapons-v2/gallery.cjs
node tools/grounded-weapons-v2/overview.cjs --slot-start
node tools/grounded-weapons-v2/build-review.cjs
```

전체 리뷰는 outputs/weapon-review-v2/에 생성한다. 기존18 이미지/GLB/뷰어와 새6 파일을 상대경로로 읽으며 원18 재생성/복사/이동이 없다. 기존 리뷰의 메모 ID와 브라우저 저장 키를 유지한다. 원화의 개별 디자인 승인을 새6에 자동 적용하지 않는다.

전부 정적 허구 게임소품이며 애니메이션·게임 규칙·충돌·실제제작 치수·전투·장착은 없다. 기계 구조는 시각적 해석이다. 무기·방어/인양장치를 포함한24아트항목과24개실전무기를 구별한다.
