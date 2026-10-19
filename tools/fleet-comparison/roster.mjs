/**
 * Cloudstitch fleet comparison roster, 2026-10-18.
 * Read-only presentation data. No GLB changes, encounter mutation or simulation.
 * Snapshot source: tools/encounters/catalog.json + tools/stage-maps/maps.mjs.
 * “Confirmed” below means a source assignment exists, never gameplay/art approval.
 */
export const ROSTER_VERSION = 'fleet-comparison-roster-1.0.0';
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
const CATALOG = 'tools/fleet/catalog.json';
const ENCOUNTERS = 'tools/encounters/catalog.json';
const PLANNING = name => 'outputs/' + name;
const ref = (side, label, status, context, role, sourceRefs = []) => ({ side, label, status, context, role, sourceRefs });
export const CATALOG_SCOPE = freeze({
  source: CATALOG, v1Catalog: 'outputs/fleet-v1/catalog.json', v2Catalog: 'outputs/fleet-v2/catalog.json',
  sourceEntries: 71, activeV2Entries: 62, originalDesignAlternatives: 9,
  entryCountIsUniqueHullCount: false,
  originalDesignIds: ['design-a1','design-a2','design-a3','design-b1','design-b2','design-b3','design-c1','design-c2','design-c3'],
  note: '71개는 역할·장비 구성·세력 스타일·결말·시설·기록·미완성 골격·기존 대안을 포함한 제작 카탈로그다. 원9대안도 비교 목록에 보존하며 v2 신규 모델로 세지 않는다.',
  presentationOnly: true,
});

const AFFILIATION_OVERRIDES = freeze({
  'story-mara-repair': ref('ally','우리편 · 동료 구조 대상','source-confirmed-context','프롤로그 마라와 피난민이 탄 수리선. 구조 대상이며 전투 동료 함선 AI 또는 플레이어 소유를 뜻하지 않는다.','동료 수리선·구조 대상',[PLANNING('17-prologue-mission-script.txt')]),
  'story-or-ship': ref('ally','우리편 · 원거리 엄호','source-confirmed-context','1막 M1에서 오르의 배가 원거리 엄호한 뒤 합류 대화한다. 모든 출항에 동행하는 함대 기능은 미구현이다.','동료 엄호선',[PLANNING('23-act1-main-quests.txt')]),
  'boss-fleet-king': ref('neutral','상황별 · 왕의 시험 상대','context-dependent','3막 왕의 시험에서는 대련 상대지만 목표는 왕 살해가 아니라 봉인 연결부 절단·기억 회수/전달이다. 이후 함대가 탈출 항로를 열어 준다. 훈련판에서는 적 슬롯을 사용한다.','비살상 시험 보스·후속 협력',[PLANNING('31-act3-main-quests.txt'),ENCOUNTERS]),
  'story-compressor-wreck': ref('neutral','중립 · 승객 구조·격리 대상','source-confirmed-context','압축기와 승객이 있는 동일 난파선의 격리 상태를 포함한다. 자동 방어 포대가 켜지는 사건을 승객 전체의 적대성으로 확장하지 않는다.','구조 난파선·격리선',[PLANNING('23-act1-main-quests.txt')]),
  'story-cult-storage': ref('neutral','상황별 · 대화·장치 확보','context-dependent','1막 M3 교단 경로에서 호위·대화·봉인실 접근이 가능하다. 소속만으로 적군 확정하지 않는다.','교단 보관·봉인 지원선',[PLANNING('23-act1-main-quests.txt')]),
  'story-union-cooling': ref('neutral','상황별 · 장치·노동자 구조','context-dependent','1막 M3 냉각 장치 인양과 노동자 구조 경로의 배. 연합 상층과 노동자를 동일한 적으로 묶지 않는다.','냉각 장치 임무선',[PLANNING('23-act1-main-quests.txt')]),
  'story-mothers-escort': ref('neutral','상황별 · 교섭·기록의 배','context-dependent','3막 O1의 옛 호위선. 자동 방어 전원 차단 후 안전 대화와 기록 회수이며 선체 격파가 목표가 아니다.','옛 호위선·증언자',[PLANNING('31-act3-main-quests.txt')]),
  'story-turret-owner': ref('neutral','상황별 · 반환·교섭 상대','context-dependent','원래 선장의 포탑 반환·조사·협상 사건. 반환 선택과 기존 관계에 따라 협력하며 자동 적대 지정하지 않는다.','기억 포탑의 주인',[PLANNING('20-faction-quest-chains.txt'),PLANNING('31-act3-main-quests.txt')]),
  'story-cult-transport': ref('neutral','상황별 · 호위 대상','source-confirmed-context','세력 임무 A1의 교단 수송선 호위 대상. 교단 전투선과 구별한다.','봉인통 수송·호위 대상',[PLANNING('20-faction-quest-chains.txt')]),
  'story-union-contact': ref('neutral','상황별 · 연락·초대','context-dependent','2막 N1의 연락선. 환대·제안의 도입 역할이며 이 배의 적대/전투 배정은 없다.','연합 연락선',[PLANNING('27-act2-main-quests.txt')]),
  'story-union-carrier': ref('neutral','중립 · 호위 대상','source-confirmed-context','2막 N1 고장난 운반선 호위 대상. 연합 맥락의 배라는 이유로 적군 지정하지 않는다.','고장난 운반선·호위',[PLANNING('27-act2-main-quests.txt')]),
  'story-morning': ref('neutral','중립 · 구호 수송 기록','source-confirmed-context','구호 수송과 기억 엔진 임무의 배. 적 출현 또는 플레이어 소유 함선으로 배정하지 않았다.','구호 수송선',[PLANNING('56-memory-engine-quest.txt'),PLANNING('11-loot-memories-curses.txt')]),
  'story-royal-funeral': ref('neutral','미정 · 왕실 조사 대상','unassigned-combat-allegiance','4막 P2에서 기록을 조사하는 왕실 장례선. 현재 전투 진영과 적 스폰 배정은 미정이다.','왕실 장례 기록 조사',[PLANNING('35-act4-palace-truth.txt')]),
  'civil-ghost-signal': ref('neutral','중립 · 교섭·구조 신호','context-dependent','먼저 쏘지 않은 망령선과 교섭·구조 신호의 역할이다. 남색 천이나 유령 세력만으로 적군 표식하지 않는다.','교섭·구조 신호선',[PLANNING('20-faction-quest-chains.txt'),PLANNING('22-regional-side-events.txt')]),
  'civil-salvager': ref('neutral','상황별 · 경쟁·상호 구조','context-dependent','경쟁 인양꾼과 자원 갈등이 있지만 서로 구조하고 임시 계류장에 협력한다. 경쟁은 상시 전투 적대를 뜻하지 않는다.','경쟁 인양꾼',[PLANNING('20-faction-quest-chains.txt'),PLANNING('22-regional-side-events.txt')]),
  'civil-evacuation': ref('neutral','중립 · 보호·구조 대상','source-confirmed-context','첫 보스와 결말의 피난/구조 민간선. 보호 대상이지만 플레이어가 조종하는 아군 전투함을 뜻하지 않는다.','주민 피난·구조선',[PLANNING('10-first-boss.txt'),PLANNING('68-bell-boss-arena.txt'),PLANNING('98-ending-aftermath.txt')]),
  'record-descent-ship': ref('reference','기록 · 과거 탐사선','historical-reference','에다 개인 임무의 오래된 강하선 기록. 현재 운용 진영·출현 적 함선 배정이 아니다.','역사 기록형',[PLANNING('62-eda-personal-quest.txt')]),
  'unfinished-stitch-hull': ref('reference','참고 · 미완성 골격','unfinished-reference','2막 검사실의 미완성 접합선 골격. 독립 운용 함선이나 아군/적군 전투체로 확정하지 않는다.','제작 중 골격',[PLANNING('27-act2-main-quests.txt')]),
});

const RIVAL_CONTEXT = freeze({
  'rival-change': '벨라는 항복 후 거래하고 생존하면 이동 상인 후보다. 초반 선택 사냥 배치이며 전 판 필수 적이 아니다.',
  'rival-debts-end': '카르는 윈치 파괴 후 협상하거나 거짓 빚 문서로 전투를 단축할 수 있다. 지역 고정 중간보스로 배정되지 않았다.',
  'rival-quiet-answer': '세라는 구조 기록과 증거로 휴전 가능하며4막에도 관계가 반영된다. 교단 소속만으로 상시 적군 확정하지 않는다.',
  'rival-night-shift': '하덴은 노동자 구조에 따라 협상 경로가 있다. 4판 후반의 동일 assetId는 화염 작업선 역할 변형이며 하덴 본인의 필수 출현/사망이 아니다.',
  'rival-go-first': '로웬은 오래된 편지 전달로 적대를 해제할 수 있다. 모든 망령선을 적으로 확대하지 않는다.',
  'rival-unfinished': '이브렌은 생존시키면 독립 조선공 후보다.2~4막 교차 등장 구상이며 특정6판 고정 보스가 아니다.',
});

/** Four UI buckets. Neutral also covers contextual and unassigned; label/context carry the distinction. */
export function getAffiliation(ship) {
  const item = typeof ship === 'string' ? { id: ship } : ship || {};
  const id = item.id || '', category = item.category || '';
  const sourceRefs = [...new Set([CATALOG,...(item.sourceFiles || [])])];
  let result;
  if (AFFILIATION_OVERRIDES[id]) result = AFFILIATION_OVERRIDES[id];
  else if (RIVAL_CONTEXT[id]) result = ref('neutral','상황별 · 라이벌·협상 가능','context-dependent',RIVAL_CONTEXT[id],'선택 라이벌·중간보스',[PLANNING('32-rival-captains.txt')]);
  else if (id.startsWith('design-') || category === 'preexisting-variant') result = ref('reference','참고 · 초기 디자인 대안','design-reference','기존 A1~C3 디자인 탐색9개. 고유 정사 함선·적 배정·새 v2 제작으로 세지 않으며 원본을 보존한다.','초기 디자인 대안',['outputs/airship-models-9/designs.json','outputs/airship-models-9/model-manifest.json']);
  else if (id.startsWith('player-') || id.startsWith('ending-') || id === 'support-independent-rescue') result = ref('ally','우리편 · 플레이어/지원','source-confirmed',category === 'ending-variant' || id.startsWith('ending-') ? '귀환호의 대안 결말 상태. 별도 신규 고유 함선이 아니며 결말 구현 완료를 뜻하지 않는다.' : id === 'support-independent-rescue' ? '플레이어 지원 장비의 독립 추진 구조정. 구조 바스켓 자체와 구별한다.' : '귀환호 또는 귀환호의 장비 빌드다. 플레이어 한 척의 구성들이며 동시에 존재하는 아군 함대 수를 뜻하지 않는다.',id === 'support-independent-rescue' ? '구조 지원정' : id.startsWith('ending-') ? '귀환호 결말 상태' : id === 'player-homeward' ? '플레이어 기본선' : '귀환호 장비 구성');
  else if (category === 'faction-style-variant' || id.startsWith('faction-')) result = ref('neutral','미정 · 세력 외형 스타일','unassigned-combat-allegiance','65번의 재료/골조 외형 스타일이다. 개별 함선명·해당 세력 전체의 적대·특정 판 출현을 확정하지 않는다.','세력 외형 변형',[PLANNING('65-enemy-modular-anatomy.txt'),PLANNING('20-faction-quest-chains.txt')]);
  else if (id.startsWith('enemy-') || id.startsWith('mission-') || id.startsWith('role-enemy-') || id.startsWith('mini-') || id.startsWith('boss-') || ['enemy-archetype','enemy-standard','mission-enemy-role','mini-boss','boss-vessel','boss-facility'].includes(category)) result = ref('enemy','적군 · 교전 상대 역할','source-confirmed-role','명시된 적/보스/경비 교전 역할이다. 같은 세력의 민간·협상선까지 적으로 확장하지 않는다. 시제품 무력화와 정사 선장 사망/결말은 별개다.',category === 'boss-facility' ? '보스 시설' : id.startsWith('boss-') ? '보스 함선' : id.startsWith('mini-') ? '중간보스 외형' : '일반 적·임무 교전 역할');
  else if (category === 'civilian-role' || id.startsWith('civil-')) result = ref('neutral','중립 · 민간·임무 대상','source-confirmed-context','민간·상인·호위·연구·우편 역할이다. 임무에서 보호/협력할 수 있지만 상시 전투 아군이나 고정 적군으로 배정하지 않는다.','민간 역할');
  else result = ref('neutral','미정 · 개별 사건 확인 필요','unassigned-combat-allegiance','진영 배정 근거가 없다. 역할명·소속·색만으로 아군 또는 적군으로 추정하지 않는다.',item.category || '미배정 역할');
  return {...result,sourceRefs:[...new Set([...sourceRefs,...result.sourceRefs])]};
}

/** Fixed read-only snapshot; validate against encounter source when rebuilding comparison data. */
const STAGE_SOURCE = [
  {
    "id": "stage-01-harbor",
    "name": "1 · 종항 잔해해역",
    "region": "종항 잔해해역",
    "sourceRefs": [
      "outputs/08-world-map.txt",
      "outputs/33-level-layouts.txt",
      "outputs/25-enemy-ai-encounters.txt",
      "outputs/48-mission-composition-rules.txt",
      "outputs/112-system-rules-reference.txt",
      "outputs/114-production-decision-register.txt",
      "outputs/17-prologue-mission-script.txt",
      "outputs/23-act1-main-quests.txt",
      "outputs/40-demo-flow-playtest.txt",
      "outputs/10-first-boss.txt",
      "outputs/68-bell-boss-arena.txt"
    ],
    "sourceLayouts": [
      "L1 잔해 삼거리",
      "L6 종항 외곽 방어"
    ],
    "opening": [
      {
        "assetId": "enemy-pirate-scout",
        "role": "scout",
        "count": 2,
        "name": "해적 정찰선"
      }
    ],
    "late": [
      {
        "assetId": "enemy-pirate-scout",
        "role": "scout",
        "count": 1,
        "name": "해적 정찰선"
      },
      {
        "assetId": "enemy-cult-blockade",
        "role": "blockade",
        "count": 1,
        "name": "교단 봉쇄선"
      }
    ],
    "midBoss": {
      "assetId": "mini-funeral-guard",
      "role": "blockade",
      "name": "소형 장례 경비선",
      "sourceKind": "prototypeCommander",
      "sourceRefs": [
        "outputs/40-demo-flow-playtest.txt",
        "outputs/25-enemy-ai-encounters.txt"
      ],
      "roleVariantOf": "mini-funeral-guard",
      "mechanics": [
        "느린 방향 전환 뒤 부채꼴 포격",
        "발사 전 포신 방향과 경계 고정",
        "장전 뒤 후방 접근 기회"
      ],
      "sourceConcept": "원문 데모 미니보스 외형을 이번 판의 중간 교전 역할로 편성",
      "originalBossVisual": true,
      "canonEncounterCompleted": false
    },
    "finalBoss": {
      "assetId": "boss-bell-devourer",
      "role": "bell",
      "name": "종을 삼킨 자",
      "sourceKind": "prototypeCommander",
      "sourceRefs": [
        "outputs/10-first-boss.txt",
        "outputs/68-bell-boss-arena.txt",
        "outputs/91-boss-attack-readability.txt"
      ],
      "roleVariantOf": "boss-bell-devourer",
      "mechanics": [
        "측면 포격 예고와 회복 틈",
        "넓은 충격파 띠에 안전 간격 유지",
        "종소리 없이도 경계·HUD로 대응"
      ],
      "sourceConcept": "원문 첫 본편 보스의 외형·경고 언어를 참고한 교전 역할",
      "originalBossVisual": true,
      "canonEncounterCompleted": false
    },
    "designNote": "L1과L6를 하나의 시험 판에 묶는 편성은 이번 사용자 요청에 따른 제작용 흐름이다. 프롤로그 전체·승객 구조·종 지지대 공략·마지막45초 구조 성공을 구현 완료한 것으로 기록하지 않는다.",
    "map": {
      "id": "map-01-harbor",
      "name": "1 · 종항 잔해 삼거리"
    }
  },
  {
    "id": "stage-02-canyon",
    "name": "2 · 청록빛 상승기류 협곡",
    "region": "청록빛 상승기류 협곡",
    "sourceRefs": [
      "outputs/08-world-map.txt",
      "outputs/33-level-layouts.txt",
      "outputs/25-enemy-ai-encounters.txt",
      "outputs/48-mission-composition-rules.txt",
      "outputs/112-system-rules-reference.txt",
      "outputs/114-production-decision-register.txt",
      "outputs/28-weather-and-hazards.txt",
      "outputs/65-enemy-modular-anatomy.txt",
      "outputs/102-advanced-encounter.txt",
      "outputs/103-bridge-mission-script.txt"
    ],
    "sourceLayouts": [
      "L2 사슬 협곡"
    ],
    "opening": [
      {
        "assetId": "enemy-pirate-scout",
        "role": "scout",
        "count": 2,
        "name": "협곡 정찰선"
      },
      {
        "assetId": "enemy-union-salvage",
        "role": "salvage",
        "count": 1,
        "name": "연합 인양선"
      }
    ],
    "late": [
      {
        "assetId": "enemy-union-salvage",
        "role": "salvage",
        "count": 1,
        "name": "연합 인양선"
      },
      {
        "assetId": "enemy-tax-cutter",
        "role": "artillery",
        "count": 1,
        "name": "녹슨 징세정"
      },
      {
        "assetId": "enemy-union-repair",
        "role": "repair",
        "count": 1,
        "name": "연합 수리선"
      }
    ],
    "midBoss": {
      "assetId": "enemy-tax-cutter",
      "role": "artillery",
      "name": "협곡 관문 지휘정",
      "sourceKind": "prototypeCommander",
      "sourceRefs": [
        "outputs/65-enemy-modular-anatomy.txt",
        "outputs/102-advanced-encounter.txt",
        "outputs/25-enemy-ai-encounters.txt"
      ],
      "roleVariantOf": "enemy-tax-cutter",
      "mechanics": [
        "방향 고정 뒤 느린 포탄",
        "포격 뒤 회복 중 측후방 접근",
        "사격 위험과 안전 우회가 함께 보임"
      ],
      "sourceConcept": "표준 징세정 외형의 새 제작용 지휘 역할. 새 고유 정사 함명을 추가하지 않음",
      "originalBossVisual": false,
      "canonEncounterCompleted": false
    },
    "finalBoss": {
      "assetId": "enemy-union-salvage",
      "role": "salvage",
      "name": "사슬협곡 인양 지휘선",
      "sourceKind": "prototypeCommander",
      "sourceRefs": [
        "outputs/09-enemies.txt",
        "outputs/25-enemy-ai-encounters.txt",
        "outputs/33-level-layouts.txt"
      ],
      "roleVariantOf": "enemy-union-salvage",
      "mechanics": [
        "작살의 얇은 선과 발사 방향 표시",
        "견인 중 입력 전체 봉쇄 금지",
        "케이블 공격 뒤 긴 회복 틈"
      ],
      "sourceConcept": "일반 인양선 외형의 새 제작용 최종 교전 역할",
      "originalBossVisual": false,
      "canonEncounterCompleted": false
    },
    "designNote": "원문L2는 민간선 호위 전장이고 별도 협곡 정사 보스는 없다. 이번 중간/최종 지휘선은 전투 시제품용 역할 변형이며 민간선 호위AI·실제 케이블 절단·회수 기능 구현 여부와 별도로 검수한다.",
    "map": {
      "id": "map-02-canyon",
      "name": "2 · 상승기류 사슬 협곡"
    }
  },
  {
    "id": "stage-03-storm",
    "name": "3 · 천둥 폭풍벽",
    "region": "천둥 폭풍벽",
    "sourceRefs": [
      "outputs/08-world-map.txt",
      "outputs/33-level-layouts.txt",
      "outputs/25-enemy-ai-encounters.txt",
      "outputs/48-mission-composition-rules.txt",
      "outputs/112-system-rules-reference.txt",
      "outputs/114-production-decision-register.txt",
      "outputs/28-weather-and-hazards.txt",
      "outputs/91-boss-attack-readability.txt",
      "outputs/102-advanced-encounter.txt"
    ],
    "sourceLayouts": [
      "L3 폭풍 인양장"
    ],
    "opening": [
      {
        "assetId": "enemy-pirate-scout",
        "role": "scout",
        "count": 1,
        "name": "폭풍 정찰선"
      },
      {
        "assetId": "enemy-union-salvage",
        "role": "salvage",
        "count": 1,
        "name": "인양선"
      },
      {
        "assetId": "enemy-ghost-chaser",
        "role": "charger",
        "count": 1,
        "name": "망령 추격선"
      }
    ],
    "late": [
      {
        "assetId": "enemy-cult-blockade",
        "role": "blockade",
        "count": 1,
        "name": "교단 봉쇄선"
      },
      {
        "assetId": "role-enemy-artillery",
        "role": "artillery",
        "count": 1,
        "name": "폭풍 포격선"
      },
      {
        "assetId": "enemy-disguised-wreck",
        "role": "ambush",
        "count": 1,
        "name": "위장 잔해선"
      }
    ],
    "midBoss": {
      "assetId": "mission-bridge-tug",
      "role": "salvage",
      "name": "폭풍 견인대장",
      "sourceKind": "prototypeCommander",
      "sourceRefs": [
        "outputs/102-advanced-encounter.txt",
        "outputs/103-bridge-mission-script.txt",
        "outputs/28-weather-and-hazards.txt"
      ],
      "roleVariantOf": "mission-bridge-tug",
      "mechanics": [
        "먼 윈치의 준비 동작과 작살 방향 예고",
        "견인 뒤 선회/회복 틈",
        "환경과 공격이 모든 회피 방향을 동시에 막지 않음"
      ],
      "sourceConcept": "교량 견인정 외형의 폭풍 판 제작용 지휘 역할",
      "originalBossVisual": false,
      "canonEncounterCompleted": false
    },
    "finalBoss": {
      "assetId": "enemy-cult-blockade",
      "role": "blockade",
      "name": "폭풍 봉쇄 지휘선",
      "sourceKind": "prototypeCommander",
      "sourceRefs": [
        "outputs/09-enemies.txt",
        "outputs/25-enemy-ai-encounters.txt",
        "outputs/28-weather-and-hazards.txt"
      ],
      "roleVariantOf": "enemy-cult-blockade",
      "mechanics": [
        "넓은 측면 포격과 긴 재장전",
        "돌아가는 선체와 포신이 같은 방향을 가리킴",
        "공격 종료 뒤 분명한 회피·반격 기회"
      ],
      "sourceConcept": "일반 봉쇄선 외형의 새 제작용 최종 교전 역할",
      "originalBossVisual": false,
      "canonEncounterCompleted": false
    },
    "designNote": "원문L3는 인양·철수 선택 전장이며 이 지역의 정사 중간/최종 보스는 확정하지 않았다. 폭풍 화면 효과와 실제 낙뢰·횡풍·착빙 판정 구현을 혼동하지 않는다. 이 판의 지휘선 두 척은 새 제작용 역할이다.",
    "map": {
      "id": "map-03-storm",
      "name": "3 · 폭풍벽 바깥 인양장"
    }
  },
  {
    "id": "stage-04-industry",
    "name": "4 · 쇠갈비 공업지대",
    "region": "쇠갈비 공업지대",
    "sourceRefs": [
      "outputs/08-world-map.txt",
      "outputs/33-level-layouts.txt",
      "outputs/25-enemy-ai-encounters.txt",
      "outputs/48-mission-composition-rules.txt",
      "outputs/112-system-rules-reference.txt",
      "outputs/114-production-decision-register.txt",
      "outputs/27-act2-main-quests.txt",
      "outputs/14-living-shipyard-boss.txt",
      "outputs/28-weather-and-hazards.txt",
      "outputs/91-boss-attack-readability.txt"
    ],
    "sourceLayouts": [
      "L4 공업 환기실",
      "14의 진입 정비장·환기실·발사 도크"
    ],
    "opening": [
      {
        "assetId": "mission-union-guard",
        "role": "artillery",
        "count": 1,
        "name": "연합 경비선"
      },
      {
        "assetId": "enemy-union-repair",
        "role": "repair",
        "count": 1,
        "name": "연합 수리선"
      },
      {
        "assetId": "enemy-union-salvage",
        "role": "salvage",
        "count": 1,
        "name": "연합 인양선"
      }
    ],
    "late": [
      {
        "assetId": "mission-union-guard",
        "role": "artillery",
        "count": 2,
        "name": "연합 경비선"
      },
      {
        "assetId": "rival-night-shift",
        "role": "flame",
        "count": 1,
        "name": "화염 작업선 역할 변형"
      },
      {
        "assetId": "enemy-union-repair",
        "role": "repair",
        "count": 1,
        "name": "연합 수리선"
      }
    ],
    "midBoss": {
      "assetId": "enemy-union-repair",
      "role": "repair",
      "name": "도크 수리 지휘정",
      "sourceKind": "prototypeCommander",
      "sourceRefs": [
        "outputs/14-living-shipyard-boss.txt",
        "outputs/25-enemy-ai-encounters.txt"
      ],
      "roleVariantOf": "enemy-union-repair",
      "mechanics": [
        "손상 동료를 향한 눈에 보이는 수리 연결",
        "무한 수리·전투 무한 반복 금지",
        "기동과 지원 대상 선택으로 역할 구분"
      ],
      "sourceConcept": "원문 조선소 수리선의 새 제작용 중간 지휘 역할",
      "originalBossVisual": false,
      "canonEncounterCompleted": false
    },
    "finalBoss": {
      "assetId": "boss-shipwright-command",
      "role": "shipyard",
      "name": "수석 조선공의 지휘함",
      "sourceKind": "prototypeCommander",
      "sourceRefs": [
        "outputs/14-living-shipyard-boss.txt",
        "outputs/27-act2-main-quests.txt",
        "outputs/91-boss-attack-readability.txt"
      ],
      "roleVariantOf": "boss-shipwright-command",
      "mechanics": [
        "충각의 굵은 진행 띠",
        "외곽 포격과 작살의 별도 경고",
        "장치 공격 뒤 핵심부 반격 틈"
      ],
      "sourceConcept": "거신의 늑골3단계 지휘함 외형을 참고한 단독 교전 역할",
      "originalBossVisual": true,
      "canonEncounterCompleted": false
    },
    "designNote": "거신의 늑골 전체시설·격벽 퍼즐·환기구3개/펌프2개 공략·노동자 구조를 이 전투판의 완료로 대신하지 않는다. 야간조 GLB를 쓰는 화염 작업선은 하덴의 정사 필수 등장/사망이 아니라 시각 에셋을 빌린 적 역할 변형이다.",
    "map": {
      "id": "map-04-industry",
      "name": "4 · 쇠갈비 공용 작업장"
    }
  },
  {
    "id": "stage-05-fog",
    "name": "5 · 이름 없는 함대의 저층 안개",
    "region": "이름 없는 함대의 저층 안개",
    "sourceRefs": [
      "outputs/08-world-map.txt",
      "outputs/33-level-layouts.txt",
      "outputs/25-enemy-ai-encounters.txt",
      "outputs/48-mission-composition-rules.txt",
      "outputs/112-system-rules-reference.txt",
      "outputs/114-production-decision-register.txt",
      "outputs/31-act3-main-quests.txt",
      "outputs/20-faction-quest-chains.txt",
      "outputs/39-story-canon-timeline.txt",
      "outputs/91-boss-attack-readability.txt"
    ],
    "sourceLayouts": [
      "L5 안개 묘지",
      "31 O4의 왕의 시험"
    ],
    "opening": [
      {
        "assetId": "enemy-ghost-chaser",
        "role": "charger",
        "count": 2,
        "name": "망령 추격선"
      },
      {
        "assetId": "enemy-disguised-wreck",
        "role": "ambush",
        "count": 1,
        "name": "위장 잔해선"
      }
    ],
    "late": [
      {
        "assetId": "mission-ghost-artillery",
        "role": "artillery",
        "count": 2,
        "name": "망령 포격선"
      },
      {
        "assetId": "enemy-ghost-chaser",
        "role": "charger",
        "count": 1,
        "name": "망령 추격선"
      },
      {
        "assetId": "mission-cult-purifier",
        "role": "flame",
        "count": 1,
        "name": "도크 정화선 역할 변형"
      }
    ],
    "midBoss": {
      "assetId": "enemy-ghost-chaser",
      "role": "charger",
      "name": "안개 돌격대장",
      "sourceKind": "prototypeCommander",
      "sourceRefs": [
        "outputs/25-enemy-ai-encounters.txt",
        "outputs/31-act3-main-quests.txt"
      ],
      "roleVariantOf": "enemy-ghost-chaser",
      "mechanics": [
        "돛과 잔광으로 돌진 준비 표시",
        "굵은 직선 경고 뒤 목표 고정",
        "돌진 종료 뒤 관성 회복과 측면 노출"
      ],
      "sourceConcept": "일반 망령 추격선의 새 제작용 중간 지휘 역할",
      "originalBossVisual": false,
      "canonEncounterCompleted": false
    },
    "finalBoss": {
      "assetId": "boss-fleet-king",
      "role": "king",
      "name": "죽은 함대 왕의 배",
      "sourceKind": "prototypeCommander",
      "sourceRefs": [
        "outputs/31-act3-main-quests.txt",
        "outputs/91-boss-attack-readability.txt"
      ],
      "roleVariantOf": "boss-fleet-king",
      "mechanics": [
        "이동 포격과 견인 작살의 서로 다른 선",
        "공격마다 한 방향 이상 회피 공간",
        "케이블 방향과 회복 틈"
      ],
      "sourceConcept": "왕의 시험 외형·공격 언어를 참고한 교전 역할",
      "originalBossVisual": true,
      "canonEncounterCompleted": false
    },
    "designNote": "원문O4 목표는 왕을 죽이는 것이 아니라 봉인 연결부와 기억 모듈 회수·전달이다. 이 시제품의 체력0/무력화 승리는 왕의 정사 사망이나 기억3개 반환 완료를 뜻하지 않는다. 정화선의 화염 역할도 미정 원문무장이 아닌 이번 제작용 배치다. 비적대 망령선 전체를 적으로 규정하지 않는다.",
    "map": {
      "id": "map-05-fog",
      "name": "5 · 저층 안개 계류등 항로"
    }
  },
  {
    "id": "stage-06-palace",
    "name": "6 · 황궁 검은 천정",
    "region": "황궁 검은 천정",
    "sourceRefs": [
      "outputs/08-world-map.txt",
      "outputs/33-level-layouts.txt",
      "outputs/25-enemy-ai-encounters.txt",
      "outputs/48-mission-composition-rules.txt",
      "outputs/112-system-rules-reference.txt",
      "outputs/114-production-decision-register.txt",
      "outputs/35-act4-palace-truth.txt",
      "outputs/43-final-boss-encounter.txt",
      "outputs/15-endings-and-final-mission.txt",
      "outputs/91-boss-attack-readability.txt"
    ],
    "sourceLayouts": [
      "43 황궁 외곽 원형 항로·심장·봉인탑3개"
    ],
    "opening": [
      {
        "assetId": "enemy-cult-blockade",
        "role": "blockade",
        "count": 1,
        "name": "교단 잔존 봉쇄선"
      },
      {
        "assetId": "mission-cult-purifier",
        "role": "flame",
        "count": 1,
        "name": "정화선 역할 변형"
      },
      {
        "assetId": "role-enemy-artillery",
        "role": "artillery",
        "count": 1,
        "name": "황궁 경비 포격선"
      }
    ],
    "late": [
      {
        "assetId": "enemy-cult-blockade",
        "role": "blockade",
        "count": 1,
        "name": "교단 잔존 봉쇄선"
      },
      {
        "assetId": "mission-ghost-artillery",
        "role": "artillery",
        "count": 1,
        "name": "회수 포격선 역할 변형"
      },
      {
        "assetId": "enemy-ghost-chaser",
        "role": "charger",
        "count": 1,
        "name": "추격선 역할 변형"
      }
    ],
    "midBoss": {
      "assetId": "mini-funeral-guard",
      "role": "bell",
      "name": "황궁 외곽 종 관문함",
      "sourceKind": "prototypeCommander",
      "sourceRefs": [
        "outputs/40-demo-flow-playtest.txt",
        "outputs/35-act4-palace-truth.txt",
        "outputs/91-boss-attack-readability.txt"
      ],
      "roleVariantOf": "mini-funeral-guard",
      "mechanics": [
        "측면 포격 전 포신 경고",
        "종/장치 반응과 넓은 압력 경계",
        "회복 틈에 관문함 반격"
      ],
      "sourceConcept": "소형 장례 경비선 외형을 빌린 새 제작용 황궁 관문 역할",
      "originalBossVisual": true,
      "canonEncounterCompleted": false
    },
    "finalBoss": {
      "assetId": "boss-last-inhale",
      "role": "heart",
      "name": "마지막 들숨 · 봉인 심장",
      "sourceKind": "prototypeCommander",
      "sourceRefs": [
        "outputs/43-final-boss-encounter.txt",
        "outputs/35-act4-palace-truth.txt",
        "outputs/91-boss-attack-readability.txt"
      ],
      "roleVariantOf": "boss-last-inhale",
      "mechanics": [
        "직선/부채꼴 압력 예고",
        "장력 공격의 고정점·방향 표시",
        "넓은 공격 사이 안전한 회전 방향 유지"
      ],
      "sourceConcept": "원숨 순환 장치의 시설 외형을 참고한 최종 교전 역할",
      "originalBossVisual": true,
      "canonEncounterCompleted": false
    },
    "designNote": "황궁은33번L6가 아니라43번 별도 전장이다. 표시용 봉인 기둥3개와 실제 원문3탑/코어/연결점 단계 공략을 혼동하지 않는다. 최종 교전 승리는3결말 구현/황녀 처형/세계 전체 사건 완료를 뜻하지 않는다. 화면의 검은 비와 실제 환경 판정은 별도 구현 항목이다.",
    "map": {
      "id": "map-06-palace",
      "name": "6 · 황궁 외곽 서비스 구역"
    }
  }
];

const notAssigned = note => ({assetId:null,name:'정사 고정 보스 미배정',status:'unspecified',statusLabel:'미배정',evidenceStatus:'unassigned',note,sourceRefs:[PLANNING('33-level-layouts.txt'),ENCOUNTERS]});
const canonicalBoss = (assetId,name,note,sourceRefs,status='정사 기획') => ({assetId,name,status,evidenceStatus:'source-confirmed-plan',note,sourceRefs});

/** Six regional reference rows, not six acts, complete campaign geography or implemented campaign. */
export const CANON_STAGES = freeze([
  { id:'stage-01-harbor',name:'종항 잔해해역 · 1막/데모 참조',region:'종항 잔해해역',
    midBoss:notAssigned('데모40의 소형 장례 경비선은 데모 미니보스이며 본편 종항의 고정 중간보스로 별도 확정한 것은 아니다.'),
    finalBoss:canonicalBoss('boss-bell-devourer','종을 삼킨 자','1막 M5와10/68의 첫 본편 보스. 종실·지지대·견인·마지막45초 민간선 구조를 포함하는 별도 설계다.',[PLANNING('23-act1-main-quests.txt'),PLANNING('10-first-boss.txt'),PLANNING('68-bell-boss-arena.txt')]),
    canonBosses:[canonicalBoss('boss-bell-devourer','종을 삼킨 자','종항을 봉쇄하는 거대한 장례 전함. 훈련판 체력전과 본편 전체 사건을 구별한다.',[PLANNING('10-first-boss.txt'),PLANNING('23-act1-main-quests.txt')])],
    demoBosses:[canonicalBoss('mini-funeral-guard','소형 장례 경비선','40번30~40분 데모의 미니보스. 거대 첫 보스는 데모에서는 티저다.',[PLANNING('40-demo-flow-playtest.txt')],'데모 기획')],
    sourceRefs:[PLANNING('08-world-map.txt'),PLANNING('33-level-layouts.txt'),PLANNING('40-demo-flow-playtest.txt'),PLANNING('23-act1-main-quests.txt')]
  },
  { id:'stage-02-canyon',name:'청록빛 상승기류 협곡 · 호위 전장 참조',region:'청록빛 상승기류 협곡',
    midBoss:notAssigned('L2는 민간선 호위·정찰선·인양선 전장이다. 독립 정사 중간보스 assetId가 배정되지 않았다.'),
    finalBoss:notAssigned('협곡의 독립 정사 최종보스는 명시되지 않았다. 현행 두 지휘정은 교전 시제품 편성이다.'),
    canonBosses:[],sourceRefs:[PLANNING('08-world-map.txt'),PLANNING('33-level-layouts.txt'),ENCOUNTERS]
  },
  { id:'stage-03-storm',name:'천둥 폭풍벽 · 인양/철수 전장 참조',region:'천둥 폭풍벽',
    midBoss:notAssigned('L3는 폭풍 속 인양·욕심·철수 선택 전장이다. 독립 정사 중간보스 assetId가 배정되지 않았다.'),
    finalBoss:notAssigned('폭풍 지역의 독립 정사 최종보스는 명시되지 않았다. 견인대장·봉쇄 지휘선은 현행 교전 시험용 역할이다.'),
    canonBosses:[],sourceRefs:[PLANNING('08-world-map.txt'),PLANNING('33-level-layouts.txt'),PLANNING('28-weather-and-hazards.txt'),ENCOUNTERS]
  },
  { id:'stage-04-industry',name:'쇠갈비 공업지대 · 2막 조선소',region:'쇠갈비 공업지대',
    midBoss:notAssigned('중앙 수리선·해체 크레인·펌프는 장치/지원 역할이다. 도크 수리 지휘정을 독립 정사 중간보스로 확정하지 않았다.'),
    finalBoss:canonicalBoss('boss-shipyard-ribs','거신의 늑골 · 살아 있는 조선소','2막 N5 전체 보스는3구역 시설이다. 수석 조선공의 지휘함은 그3단계에서 크레인과 결합한다.',[PLANNING('14-living-shipyard-boss.txt'),PLANNING('27-act2-main-quests.txt')]),
    canonBosses:[
      canonicalBoss('boss-shipyard-ribs','거신의 늑골 · 살아 있는 조선소','3구역 수평 도크·해체 크레인·환기구3·펌프2·탈출/구조를 가진 전체 보스 시설.',[PLANNING('14-living-shipyard-boss.txt'),PLANNING('27-act2-main-quests.txt')]),
      canonicalBoss('boss-shipwright-command','수석 조선공의 지휘함','별도 지역 최종보스가 아니라 조선소3단계의 지휘함/크레인 결합체. 현행4판에서는 단독 최종 교전 역할로 차용한다.',[PLANNING('14-living-shipyard-boss.txt'),ENCOUNTERS])
    ],sourceRefs:[PLANNING('08-world-map.txt'),PLANNING('14-living-shipyard-boss.txt'),PLANNING('27-act2-main-quests.txt'),PLANNING('33-level-layouts.txt')]
  },
  { id:'stage-05-fog',name:'저층 안개 · 3막 왕의 시험',region:'이름 없는 함대의 저층 안개',
    midBoss:notAssigned('망령 추격선·포격선 조우는 있지만 안개 돌격대장은 일반 추격선의 시제품 지휘 역할이다.'),
    finalBoss:canonicalBoss('boss-fleet-king','죽은 함대 왕의 배 · 왕의 시험','O4 목표는 왕 체력0이 아니라3봉인 연결부와 기억 모듈 회수·전달이다. 왕은 후속 탈출을 돕는다.',[PLANNING('31-act3-main-quests.txt')],'정사 시험 전투'),
    canonBosses:[canonicalBoss('boss-fleet-king','왕의 시험','고정 악당/사망 판정이 아닌 대련과 기억 증명. 비적대 망령선의 교섭과 구별한다.',[PLANNING('31-act3-main-quests.txt'),PLANNING('20-faction-quest-chains.txt')],'정사 시험 전투')],
    sourceRefs:[PLANNING('08-world-map.txt'),PLANNING('31-act3-main-quests.txt'),PLANNING('33-level-layouts.txt')]
  },
  { id:'stage-06-palace',name:'황궁 검은 천정 · 4막/최종 항해',region:'황궁 검은 천정',
    midBoss:notAssigned('교단 잔존선·궁전 자동 포대·장치는 있으나 황궁 외곽 종 관문함을 고정 정사 중간보스로 배정하지 않았다.'),
    finalBoss:canonicalBoss('boss-last-inhale','마지막 들숨 · 원숨 순환 장치','43번 별도 최종 전장. 중앙 기계 봉인 심장·외곽3탑·3연결점이며 황녀 처형이나 인간형 신 격파가 아니다.',[PLANNING('43-final-boss-encounter.txt'),PLANNING('35-act4-palace-truth.txt')]),
    canonBosses:[canonicalBoss('boss-last-inhale','마지막 들숨','압력·장력·봉인 장치 전투 후 세 결말 선택 준비. L6 종항 방어와 다른 전장이다.',[PLANNING('43-final-boss-encounter.txt'),PLANNING('35-act4-palace-truth.txt')])],
    sourceRefs:[PLANNING('08-world-map.txt'),PLANNING('35-act4-palace-truth.txt'),PLANNING('43-final-boss-encounter.txt')]
  },
]);

const canonById = new Map(CANON_STAGES.map(stage=>[stage.id,stage]));
function prototypeBoss(spec, stageId, slot) {
  const newlyAssigned = stageId==='stage-06-palace' && slot==='midBoss' || !spec.originalBossVisual;
  return {
    ...spec,status:'prototype-assignment',statusLabel:'현행 6판 편성',evidenceStatus:'source-confirmed-prototype',
    campaignStatus:newlyAssigned?'제작용 배정 제안':'정사 외형 차용 · 캠페인 전체 아님',
    note:spec.sourceConcept+' · '+(newlyAssigned?'별도 신규 정사 보스 또는 해당 인물의 필수 출현으로 확정하지 않는다.':'전체 정사 장치/서사 완료와 구별한다.'),
    canonEncounterCompleted:false,trainingSide:'enemy',sourceRefs:[ENCOUNTERS,...spec.sourceRefs],
  };
}

/** Actual six prototype lineups. No extra ships or unique boss models are invented. */
export const STAGES = freeze(STAGE_SOURCE.map((stage,index)=>{
  const canon=canonById.get(stage.id);
  const normal=spec=>({...spec,status:'현행 6판 편성',evidenceStatus:'source-confirmed-prototype',trainingSide:'enemy',sourceRefs:[ENCOUNTERS,...stage.sourceRefs],
    note:spec.assetId==='rival-night-shift'?'야간조 GLB를 빌린 화염 작업선 역할. 하덴 본인 등장·사망·영구 적대 확정 아님.':spec.assetId==='mission-cult-purifier'&&spec.role==='flame'?'원문에 무장 수가 미정인 정화선의 시제품 화염 역할 변형. 정사 무장 확정 아님.':'같은 assetId의 교전 역할/횟수이며 고유 함종 수가 아니다.'});
  return {
    id:stage.id,order:index+1,name:stage.name,region:stage.region,scope:'six-stage-prototype',scopeLabel:'현행6판 교전/훈련 세트',
    mapId:stage.map?.id||null,mapName:stage.map?.name||null,mapScope:'공간 제안은 stageId로 현행 encounter를 재사용한다. 캠페인 지리·순서·보스를 새로 확정하지 않는다.',
    opening:stage.opening.map(normal),late:stage.late.map(normal),
    midBoss:prototypeBoss(stage.midBoss,stage.id,'midBoss'),finalBoss:prototypeBoss(stage.finalBoss,stage.id,'finalBoss'),
    canonBosses:canon.canonBosses,canonicalMidBoss:canon.midBoss,canonicalFinalBoss:canon.finalBoss,demoBosses:canon.demoBosses||[],
    sourceLayouts:stage.sourceLayouts,sourceRefs:[ENCOUNTERS,'tools/stage-maps/maps.mjs',...stage.sourceRefs],
    designNote:stage.designNote,canonEncounterCompleted:false,
  };
}));

export const ROSTER_NOTES = freeze({
  allegiance:'우리편/적군/중립·상황별·미정/참고의 비교용 분류다. 세계관 세력색을 전투 진영과 동일시하지 않는다. 개별 출현의 trainingSide는 작품 전체의 적대성보다 좁은 의미다.',
  noInventedBosses:'모든 현행 보스 슬롯은 기존 카탈로그 ID를 재사용한다.2/3지역 정사 보스와 각 지역 고정 중간보스는 미배정으로 남긴다.',
  sourceAuthority:'사용자 최신 요청 →112/114 →39/107·19/65·각 상세 기획. source-confirmed는 소스에 적혀 있다는 뜻이며 아트 승인·전투 검증 통과가 아니다.',
  sixRegionsAreNotSixActs:'08의6지역과33의 L1~L6 기본 배치는1:1이 아니다. L6는 종항 외곽 방어다. 황궁은43의 별도 최종 전장이다.',
  prototypeScope:'현행6판은 일반 적→중간 역할→정비→후반 적→최종 역할로 재편성한 시험판이다. 정사 프롤로그·4막·최종 항해 전체 캠페인과 다르다.',
  levelOwnership:'tools/levels/levels.mjs는 first-voyage와종항의 공간/후보를 제공한다. tools/stage-maps/maps.mjs는6항로의 공간을 제공하고 선택 stageId로 encounter를 연결한다. 등장 순서/역할은 encounter가 소유한다.',
  unchangedAssets:'이 파일은 비교 데이터만 작성한다. freeze된 fleet-v2174파일·v1원본·공통 의존성·전투 소스·GLB·PNG를 수정하지 않는다.',
  sourceSnapshot:'STAGE_SOURCE는 작성 시점 카탈로그와stage-map의 읽기 전용 스냅샷이다. 편성이 달라지면 원문 대조 후 이 비교 데이터를 갱신한다.',
});

export function getStageRoster(id) { return STAGES.find(stage=>stage.id===id)||null; }

