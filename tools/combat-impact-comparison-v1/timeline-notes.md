# 장착·권위 타임라인 인계

원본 GLB·sim·integration은 읽기 전용으로 보존했다. 생성·유료 호출·실제 소켓·플레이어 함포 추가는 없다.

`makeTape({weapon:'cannon'|'machinegun',muzzle:{position:[x,y,z],direction:[x,0,z]},miss})`는 기존 battlefield 권위를 한 번 실행해 동결 기록한다. A/B는 같은 tape를 공유하고 `sample(time).projectiles`의 실제 위치만 읽는다. sample은 0.01초 실제 기록의 이전 프레임을 사용하며 별도 보간 물리·충돌·가상 hit를 만들지 않는다. 이벤트는 시간순 fire/hit와 실제 projectile id·방향·법선을 담는다. duration은 보통5.5초이며 함포 miss만 기존 slow projectile 종료까지8.8초다.

기관총은 기존 player fire로 t=0 첫발, 기존0.22초 cooldown으로1.98초까지10발을 발사한다. 2초에 입력을 끊어도 잔여탄은 계속 기존 sim으로 진행하며 마지막 hit는2.44초다. 표적은 HP100000/반경3의 명시적 훈련 hull이며 실제 기존8피해×10=80이다. 표적 HP만 리뷰 시나리오 설정이며 무기 규칙 변경이 아니다.

함포는 현재 player가 기관총만 지원하므로 기존 enemy cannon훈련 actor의 실제 enemy-fire 한 발을 표시 함선으로 매핑한다. 기존1.2초 cooldown+1.3초 telegraph 후 첫발을 표시t=0으로 offset한다. 발사 후 기존 intent API로 다음 공격을 막는다. 기존 player collider 반경3/HP100이 시각 훈련 표적이며 실제9피해로91HP가 된다. 기존 slow training projectile 속도17·반경.65·수명7초를 보존한다. hit시각1.19초/실제 충돌면20.35이며 player용 함포 기능·확정 밸런스가 아니다.

miss는 표적을 사선 옆10만큼 옮긴 실제 미명중 시나리오다. 양 무기 hit0/피해0이며 실제탄 수명·범위 종료를 기다린다. 타깃은 양쪽 모두 포구 앞24·반경3이지만 MG와 cannon은 기존 projectile 반경(.1/.65) 때문에 실제 접촉면이 다르다. 포구방향으로 평면 회전하고 포구XYZ로 평행이동하므로 cannon원래y1.3도 표시 포구높이에 정확히 대응한다.

`createMount(THREE,heroRoot,weaponScene,{weapon})`는 길이15 함선 좌표에 외부 좌현 목재 갑판·황동 고정구·청록 반동레일·대각 지지대·산호 완충재를 더한다. 원GLB는 clone한 인스턴스로 균일하게 함포3/기관총2.5 크기다. 원무기 -X 앞끝 정점 띠에서 포구높이를 추정하며 실제 엔진소켓 확정이 아니다. 함선 root의 위치·회전·scale을 바꾸지 않는다. `frame()` datum은 recoil의 sibling으로 절대시간 pose/scrub/old/new/reducedMotion과 독립한다. 원본 일체형 무기 전체의 시각 반동이며 원포신을 분해 리깅했다고 표시하지 않는다.

최신10배 표현 방향은 짧은 비대칭 사전압축→강한 후퇴와 들림→축이 다른 비틀림→감쇠복구의 시간구조 및 재료별 지지구조로 적용했다. 단일gain/scale 배수의 완료판정이 아니다. 줄인 움직임은 동일 판정/시간으로 운동 진폭만 낮춘다. 실제 화면에서 선체접촉·장착크기·가독성은 통합 브라우저 슬롯에서 확인해야 하며 기술검사와 사람의 미술·손맛 승인은 별개다.

실행: `node --test tools/combat-impact-comparison-v1/timeline.test.mjs`. three는 저장소 또는 기존 `work/combat-vfx-v2/deps` 로컬 의존성을 사용한다. 테스트는 실제 fire/hit수·순서·피해·충돌좌표/법선·동일 tape·miss·원본소스보존·리코일 독립·원자산 자원소유를 검사한다. 브라우저/서버/중앙공통파일을 수정하거나 점유하지 않았다.
