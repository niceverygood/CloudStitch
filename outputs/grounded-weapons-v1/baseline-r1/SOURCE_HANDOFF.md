# Cloudstitch · 절제한 판타지 무기 12종

상태: SOURCE_READY-r1. 새 다중 메시 소스12종·좌표검사 완료. GLB/브라우저는 중앙 슬롯 START 대기.

사용자 직접 요청: 승인한 `outputs/fantasy-weapon-moodboard-v2/moodboard.png`를 3D 에셋으로 제작.
이전 보드는 너무 판타지라는 수정 후 전기탑·활·쇠뇌·기계 장치 중심으로 확정됐다. 그 최신 절제를 유지하며 수공예 목재/황동/청록·크림천·산호수선·풍성한 기능 구조와 손그림 같은 입체감을 적용한다.
소유 쓰기는 `tools/grounded-weapons-v1/`와 `outputs/grounded-weapons-v1/`뿐. 기존 6무기·원GLB·VFX·전장·공통 package/lock·서버를 수정하지 않는다. Meshy/새이미지 호출0.

소스 검증: 실제 THREE geometry12개 생성, 302,988삼각형·2,147개 분리 메시. 전부 유한 정점·법선·색·월드행렬·경계, glTF 색0~1 확인. 이는 메모리 소스검사로 실제 GLB/3D렌더 검사가 아니다.
모델은 구분된 정적 부품 그룹이며 +Y위/+Z전면·상대 설계 단위다. 후면·가려진 구조는 승인한 한 장의 보드를 바탕으로 새로 해석했다.
애니메이션·실제 조준/발사·collider·피해/상태·물리·LOD·엔진 소켓·밸런스·게임 설치는 없다.

실행: `tools/grounded-weapons-v1/README.md` 참조.
중앙이 허용한 슬롯에서 CPUexport(약1분 이내 예상, 실측 아님) → 오프라인 뷰어 build → 기존 world-workbench 하네스의12실제로딩/36모드/12다운로드·대표전기탑3모드120회전/조작/검색/390px/외부요청 →12대표PNG·3후면PNG 캡처(약3~5분 예상) → 실제PNG갤러리 build를 수행한다.
`run.cjs export --bundle-only`는 성공했고 exporter는 아직 실행하지 않았다.
공식 validator와 GLTFLoader roundtrip을 export시에 수행하도록 묶었다. 원화 SHA를 실행 전후 검증한다.
통합에 정확한 SOURCE_READY 파일·읽기 의존성·명령을 인계한 뒤 START를 기다린다.

보존/한계: v1/v2보드와 기존 모델은 보존한다. 12새아트자산을 정사무기12종·게임지원무기12종·장착완료로 집계하지 않는다. 생성 후 사람의 3D 미술 승인은 별도다. commit/push/자동화/외부배포 없음.
