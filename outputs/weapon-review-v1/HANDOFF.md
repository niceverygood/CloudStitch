# Cloudstitch · 무기·장치 통합 리뷰

2026-10-19. 기존6종+신규12종=아트 항목18개를 단일 리뷰로 정리했다. 기존 GLB·원화·뷰어는 읽기 보존하며 신규 GLB는 없다.

열람: 이 폴더의 index.html을 브라우저에서 연다. previews/는 원래 실제GLB렌더의 투명여백만 정리한 700×550 표시용 복사본18장이다. 원본렌더와 실제모델은 기존폴더에 보존하며 상대링크로 연결한다. 전체검토·기존6/신규12·종류·검색·검토상태 필터, 두 항목 나란히비교, 개별확대/원화보기/3D회전뷰어/GLB다운로드, 검토상태/메모/JSON내려받기를 제공한다. 메모는 현재브라우저 localStorage에저장된다. 검수용 메모는 제거했다.

실제검사: 단일Chrome에서18카드·18이미지decode·108로컬링크대상존재, 기존6/신규12·방어1·작살검색2, 두 비교패널, 검토상태필터/메모JSON18개export, 390px페이지/상세모달넘침없음, 페이지오류/실패요청/외부HTTP0. verification.json을따른다. 기존3D뷰어/18GLB의전체재검사는수행하지않았다. 원sourcePNG18/GLB18=36파일의사후SHA가manifest와일치하며Chrome종료후슬롯반환했다.

overview.png는실제전체리뷰캡처, comparison-preview.png는작살포/작살윈치실제비교화면, mobile-preview.png는390px실제화면이다. 직접비교이미지에서기존텍스처붓결과신규정점채색의표면차이가보이며, 이를동일완성도의미술승인으로간주하지않는다.

카드들은각각화면맞춤이므로실제크기/화력비교가아니다. 기존6은단일메시/2K텍스처,신규12는정점색/분리부품이다. 방패를포함한18아트항목으로정사/게임지원18무기라고표현하지않는다. 전부정적모델이며공격애니메이션/충돌/최종소켓/게임설치승인은별도다.

소유: tools/weapon-review/ 및 outputs/weapon-review-v1/만. 원6·신규12폴더/공통package/server수정0. paid/이미지생성/모델export/자동화/배포/commit/push0.
재생성: node tools/weapon-review/build.cjs. 기존로컬의sharp가필요하다. 좁은browser검사: node tools/weapon-review/verify.cjs(중앙slot배정후). 다른PC에서현재설치경로를발견해사용하고캐시절대경로를가정하지않는다.
