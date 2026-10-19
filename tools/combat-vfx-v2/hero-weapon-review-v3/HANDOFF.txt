Cloudstitch 최신 주인공 함선 사격 리뷰 v3
최신 '주인공 함선 형태 단계별 구현'의 4성 포격형 실제 GLB를 읽기 연결.
star4-artillery SHA619cc056ad7eca05faf9d6f90070fa6b8d493f8d925c76cf3ba2e602cc732e16.
함선 원본·기존 v1/v2 보존. 신규 외부 장착대는 리뷰 시안이며 표준 소켓이 아니다.
실 기관총 GLB + 기존 부드러운 손그림 효과. 게임 공통 sim만 발사·탄환·충돌·피해 권위를 가진다.
한 발/연사/속도/정면·옆면·빗나감/3표시모드/4카메라 지원.
발사·비행·명중 장면 버튼은 같은 실제 sim을 초기화하고 각 시점까지 실행해 정지한다.
CPU검사 source-verification.json: 실제GLB 포구좌표/반동의 권위불변/발사→명중1/HP99992/면normal PASS.
실브라우저 검수는 별도 browser-verification.json 존재 시 그 근거만 참고한다.
캠페인·성장·생산장착 구현이 아니다. 별도 최신 극적 강화판 미술승인과 구별한다.
실행: 독립 index.html, 모든 GLB/텍스처 포함/네트워크 의존 없음.
빌드: NODE_PATH 기존 work/combat-vfx-v2/deps/node_modules, node tools/combat-vfx-v2/hero-weapon-review-v3/build.cjs.
