Cloudstitch 함대·교전 통합 계약 v1

기존 맥북 함대/6판 원본을 보존한 연결 데이터·예시다. 최종 이동·시간·사격·피해는 battlefield sim.mjs 한 곳이 수행한다.
contract.json: 기존 ID·6지역·12역할·예고/패턴 의도
example-session.json: 강제 격파 통보를 사용한 순서 예시. 실제 플레이 화면/실전 검증 아님.
verification.json: 가벼운 계약/정책/원본보존/19모델 헤더·크기 검사. 전체 자산 해시·브라우저 QA 아님.
source-manifest.json: 담당 인계 파일 SHA256

현재 battlefield의 move/attackTarget 어댑터는 기본 예고 포격만 실행한다. 원본 돌진·견인·광역·수리·보스 패턴 데이터는 실행 구현과 구별한다.
상세: tools/encounters/HANDOFF.md
재현: node tools/encounters/snapshot.mjs (이 integration-v1 기록만 갱신)
