/**
 * Cloudstitch fleet v2: deliberately different silhouettes, not new canon ships.
 * Coordinates are local art LU: X length (bow at -X), Y up, Z width.
 * Every dimension, placement and artModules count below is an art proposal.
 * catalog.modules integer values always win; null never becomes canon zero.
 * The selected player-homeward GLB and all nine design-* originals are preserved.
 */
export const PROFILE_VERSION = 'fleet-identity-2.0.0';

export const PALETTES = Object.freeze({
  hero: { wood:'#b47d48', canvas:'#ead6a7', metal:'#536c67', brass:'#b58c4d', teal:'#397e7a', rope:'#897552', dark:'#37484a', coral:'#c88468', glow:'#e8b36c' },
  cult: { wood:'#675b50', canvas:'#e3ddc4', metal:'#363c42', brass:'#b79859', teal:'#667c7b', rope:'#6a6254', dark:'#252d34', coral:'#886553', glow:'#e4bd73' },
  union: { wood:'#79654b', canvas:'#8caaa1', metal:'#a15d43', brass:'#ac8d56', teal:'#426f6d', rope:'#675b43', dark:'#343f42', coral:'#bd754f', glow:'#e5a05e' },
  ghost: { wood:'#575c60', canvas:'#45596f', metal:'#65757d', brass:'#9a936c', teal:'#68a3ae', rope:'#777a74', dark:'#2b394b', coral:'#807173', glow:'#9bcbd0' },
  salvager: { wood:'#997044', canvas:'#c2b085', metal:'#787667', brass:'#a58858', teal:'#557e77', rope:'#79644c', dark:'#484a44', coral:'#aa6b50', glow:'#d7bb83' },
  civil: { wood:'#bd8c55', canvas:'#e6cf9e', metal:'#7c8e86', brass:'#b49764', teal:'#668f82', rope:'#8a7651', dark:'#58655d', coral:'#c08b74', glow:'#f2d19c' },
  royal: { wood:'#80684f', canvas:'#e4dfce', metal:'#626b73', brass:'#c0a064', teal:'#697d86', rope:'#8f866d', dark:'#3e4654', coral:'#a58b8e', glow:'#e7c98b' },
});

/** Family is geometry, not a material preset. Do not route these to one boat. */
export const FAMILIES = Object.freeze({
  'selected-original': { body:'selected original GLB', invariant:'귀환호 원본의 실루엣·그림·삼각 패치 보존' },
  'hero-build': { body:'warm keel, asymmetric extensions', invariant:'작은 뒤 선장실·원형창·산호 삼각 패치는 보존하되 빌드마다 갑판 폭과 기낭 배치가 다름' },
  'scout-skiff': { body:'narrow swept skiff', invariant:'낮은 선수, 작은 개방 조타대, 큰 꼬리 추진기; 집 같은 선장실 없음' },
  'cult-bastion': { body:'coffin-shaped armored cliff', invariant:'넓은 수직 판금 방패·낮은 기낭·전방은 막히고 후방 추진부는 노출' },
  'industrial-tug': { body:'blunt asymmetric work hull', invariant:'한쪽으로 큰 철골 크레인·노출 윈치·짧고 뭉툭한 선수' },
  'repair-catamaran': { body:'two pontoons, empty central work bay', invariant:'두 선체 사이 빈 공간·옆으로 뻗는 수리팔; 중앙에 코티지 금지' },
  'ghost-spear': { body:'thin broken spear with swept ribs', invariant:'아주 긴 선수·얇은 선체·갈라진 돛과 잔광; 물리 부품은 불투명' },
  'wreck-crab': { body:'radial wreck, broken ribs', invariant:'중심을 감싼 부서진 조각·벌어진 집게 갑판, 완전한 선장실 없음' },
  'tax-barge': { body:'lopsided side deck barge', invariant:'우현 굵은 골조와 외부 갑판 묶음·작은 보조 기낭이 육안으로 분리됨' },
  'cult-cathedral': { body:'deep funeral hull, open central belfry', invariant:'배 자체가 종실·수직 봉인통·천 덮개이며 작은 배를 단순 확대하지 않음' },
  'industrial-fortress': { body:'block-built fortress and crane bridge', invariant:'낮고 넓은 철제 성채·양옆 공업 팔·외부 배관' },
  'ghost-crown': { body:'crescent keel, crown of broken masts', invariant:'다중 파손 돛대가 왕관을 이루고 중앙은 비어 기억 모듈을 가리지 않음' },
  shipyard: { body:'open three-zone dock facility', invariant:'3개 수평 도크와 갈비뼈 구조·출입구·크레인; 선박처럼 닫힌 선수 없음' },
  'pressure-sanctum': { body:'circular seal apparatus', invariant:'기계 봉인 심장1·외곽 봉인탑3; 인간 장기나 인간형 신이 아님' },
  'civil-cargo': { body:'flat open cargo raft', invariant:'큰 적재 갑판·반복 화물 덩어리·낮은 조타실; 무장 전함과 구별' },
  'civil-courier': { body:'small light mail runner', invariant:'작은 달걀 기낭·기울어진 꼬리·우편/신호 표지·열린 앞 갑판' },
  'civil-shelter': { body:'wide shelter, low twin hull', invariant:'구조용 캐노피·열린 승선 공간·따뜻한 신호등' },
  'salvage-junk': { body:'stepped patchwork deck', invariant:'불균형 목재 층·밧줄·철판 수선; 공통폭 연결 골조는 읽힘' },
  'industrial-boiler': { body:'squat boiler carrier', invariant:'보호 원통·굵은 열풍 배관·굴뚝이 선체보다 먼저 읽힘' },
  'royal-funeral': { body:'long ceremonial coffin', invariant:'긴 흰 장막·낮은 의례 갑판·작은 왕실 문장, 거대 교단 종실 없음' },
  'historical-capsule': { body:'deep reinforced descent capsule', invariant:'두꺼운 하강 프레임·케이지·관측창; 현대 민간선과 다른 수직 비례' },
});

const E = (layout, length, radius, height, extra={}) => ({layout,length,radius,height,flatten:1,offset:[0,0,0],ragged:false,...extra});
const C = (shape, position, scale) => ({shape,position,scale});
const P = (id, family, dimensions, envelope, cabin, landmarks, palette, silhouette, extra={}) => ({
  id,family,length:dimensions[0],width:dimensions[1],depth:dimensions[2],bow:0.35,stern:0.1,
  envelope,cabin,landmarks,palette,
  artModules:{balloons:envelope.layout==='none'?0:envelope.layout==='triad-low'?3:envelope.layout==='side-twin'?2:1},
  artModuleAuthority:'visual prototype proposal only; catalog.modules integers override these counts',
  identity:{silhouette,material:PALETTES[palette]===PALETTES.hero?'크림 천·꿀빛 목재·청록·산호 수선':family==='pressure-sanctum'?'검은 압력·흰 봉인판·낡은 황동':palette==='cult'?'흰 봉인천·검은 통·황동 종':palette==='union'?'적갈 방청 철골·청록 작업등·황동':palette==='ghost'?'찢어진 남색 천·낡은 금속·차가운 잔광':'목재·천·사용 흔적',readability:'외곽 형태 → 역할 랜드마크 → 노출 골조 순으로 읽힘'},
  ...extra,
});

const entries = [
  P('player-homeward','selected-original',[10,3,1.6],E('single-high',9,1.4,4),C('cottage',[2.8,0,0],[2.1,1.3,1.6]),['coral-triangle','round-window','home-lantern'],'hero','작은 집을 매단 편안한 크림색 배',{preserveOriginal:true,showcasePriority:1,artModules:{balloons:1,engines:1,machineGuns:1,winches:1}}),
  P('player-cloud-scout','hero-build',[9.2,2.7,1.15],E('single-high',8.8,1.18,3.6),C('cottage',[2.45,0,0],[1.8,1.25,1.45]),['coral-triangle','scout-mast','tail-fin'],'hero','귀환호의 작은 집과 패치를 지닌 가벼운 정찰 빌드',{artModules:{balloons:1,engines:1,machineGuns:1,winches:1,smokeEmitters:1}}),
  P('player-mixed-raider','hero-build',[11.5,4,1.7],E('side-twin',9,1.12,3.55),C('cottage',[3.5,0,-.65],[2.1,1.45,1.75]),['coral-triangle','split-bow','offset-gun-deck'],'hero','쌍기낭 사이 열린 갑판과 비대칭 습격 포대',{artModules:{balloons:2,engines:2,machineGuns:2,cannons:1,winches:1,armor:1}}),
  P('player-broadside','hero-build',[15.2,6.6,2.4],E('triad-low',10.4,1.2,4.2),C('cottage',[5.2,.2,0],[2.4,1.45,2]),['coral-triangle','wide-broadside','layered-bulwark'],'hero','가로로 넓어진 세 기낭·반복 측면 포대·작은 집의 대비',{artModules:{balloons:3,engines:2,cannons:3,winches:1,armor:4}}),
  P('player-rescue-workshop','hero-build',[13.3,6.9,1.75],E('triad-low',9.5,1.1,3.9),C('cottage',[4.2,0,-1.75],[2.3,1.35,1.65]),['coral-triangle','open-work-bay','rescue-canopy','paired-repair-arms'],'hero','빈 작업 갑판과 구조 공간을 중심으로 옆으로 펼쳐진 공방',{artModules:{balloons:3,engines:3,cannons:1,harpoons:1,winches:1,armor:2,repairArms:2,rescueCapsules:1}}),
  P('player-control','hero-build',[11.2,5.5,1.8],E('side-twin',8.7,1.1,3.3),C('cottage',[3.5,.35,0],[2,1.55,1.8]),['coral-triangle','signal-fan','split-gun-decks'],'hero','넓은 양팔 갑판과 부채꼴 신호 마스트',{artModules:{balloons:2,engines:2,mortars:1,chainCannons:2,winches:1,armor:2,smokeEmitters:1}}),
  P('player-close-flame','hero-build',[10.6,4.8,2],E('side-twin',7.8,1.1,3.7),C('cottage',[3.3,.15,0],[1.9,1.25,1.65]),['coral-triangle','shielded-bow','paired-heat-pipes'],'hero','앞이 둔중한 방열 선수와 후방 작은 집',{artModules:{balloons:2,engines:2,flamethrowers:2,winches:1,armor:3,smokeEmitters:1}}),

  P('enemy-pirate-scout','scout-skiff',[8.8,1.9,.85],E('single-high',6.9,1,2.8,{flatten:.78,offset:[.3,0,0]}),C('open-helm',[2.1,.05,0],[1.2,.7,.95]),['needle-bow','swept-tail','pirate-pennant','oversized-tail-engine'],'salvager','바늘 같은 선수와 낮은 개방 조타대의 작은 정찰정',{showcasePriority:2,artModules:{balloons:1,engines:1,machineGuns:1},bow:.12}),
  P('enemy-cult-blockade','cult-bastion',[10.8,5.5,3.15],E('side-twin',6.9,1.15,2.65,{flatten:.8}),C('armored-slab',[2.5,.65,0],[2.2,1.1,2.7]),['cliff-bow-armor','hanging-bell','seal-drapes','exposed-rear-engine'],'cult','앞은 넓은 절벽 방패·뒤는 작은 추진부인 낮고 무거운 봉쇄선',{showcasePriority:3,artModules:{balloons:2,engines:2,cannons:3,armor:6,smokeEmitters:1},bow:.08}),
  P('enemy-union-salvage','industrial-tug',[9.2,4.5,2.4],E('single-high',6.8,1.35,3.2,{offset:[1.1,0,-.6]}),C('gantry-booth',[2.3,.3,-1.05],[1.7,1.9,1.4]),['diagonal-crane','exposed-winch-drum','hook-claw','square-stern'],'union','고개를 뻗은 비대칭 크레인과 굵은 드럼이 선체 바깥을 지배',{showcasePriority:4,artModules:{balloons:1,engines:2,harpoons:1,winches:1},bow:.1}),
  P('enemy-union-repair','repair-catamaran',[8.2,6.2,1.45],E('side-twin',6.8,1.05,2.6),C('workshop',[2.5,.25,-1.6],[1.9,1.6,1.5]),['open-work-bay','paired-repair-arms','welding-lantern','bridge-gantry'],'union','두 평행 선체 사이 비어 있는 수리 도크와 벌어진 작업팔',{showcasePriority:5,artModules:{balloons:2,engines:2,repairArms:2},bow:.15}),
  P('enemy-ghost-chaser','ghost-spear',[13.5,1.7,1.05],E('low-inline',9.6,.95,2.4,{ragged:true,flatten:.7}),C('lantern-pod',[4.1,.1,0],[1.15,.85,.9]),['spear-bow','torn-sails','trailing-ribs','cold-lanterns'],'ghost','찢긴 긴 창끝·낮은 잔광 기낭·뒤로 흘러가는 갈비뼈',{showcasePriority:6,artModules:{balloons:1,engines:2},bow:.1}),
  P('enemy-disguised-wreck','wreck-crab',[7.8,7.6,2.75],E('single-high',4.7,.85,1.95,{ragged:true,flatten:.65,offset:[1.4,0,-1.4]}),C('none',[0,0,0],[0,0,0]),['radial-wreck-ribs','folded-claw-decks','broken-canvas','hidden-engine'],'ghost','찌그러진 둥근 잔해 덩어리에서 두 갑판 집게가 벌어짐',{showcasePriority:7,artModules:{balloons:1,engines:1,cannons:2},bow:0}),
  P('enemy-tax-cutter','tax-barge',[10.4,4.2,1.85],E('side-twin',7.2,1.05,3.2,{asymmetric:true}),C('gantry-booth',[2.8,.15,-.7],[1.7,1.2,1.6]),['starboard-subtree','connector-frame','external-gun-deck','auxiliary-envelope'],'union','우현 한쪽만 튀어나온 포대·엔진·보조 기낭 묶음',{showcasePriority:8,artModules:{balloons:2,engines:2,cannons:1},structuralFeatures:{rootHull:1,starboardConnector:1,externalDeck:1,externalDeckSubtree:['cannon','auxiliaryEngine','auxiliaryBalloon']}}),
  P('faction-cult-modular','cult-bastion',[9.7,4.8,2.8],E('side-twin',6.5,1,2.6),C('seal-vault',[1.7,.3,0],[2.5,1.3,2.2]),['seal-drapes','black-seal-tanks','hanging-bell','visible-connectors'],'cult','흰 가리개 아래 검은 통과 넓은 장갑, 골조는 노출',{artModules:{balloons:2,engines:1,cannons:1,armor:3},scopeNote:'세력 외형 스타일이며 새 고유 함종 아님'}),
  P('faction-ghost-modular','ghost-spear',[11.8,2.6,1.1],E('low-inline',8.5,1.02,2.7,{ragged:true}),C('lantern-pod',[3.7,.15,-.35],[1.4,.9,1.2]),['torn-sails','cold-lanterns','visible-connectors','broken-stern'],'ghost','찢어진 돛 아래 불투명한 가는 골조와 차가운 잔광',{artModules:{balloons:1,engines:1,cannons:1},scopeNote:'세력 외형 스타일이며 새 고유 함종 아님'}),
  P('faction-salvager-modular','salvage-junk',[10.1,4.3,1.6],E('side-twin',6.6,.95,3.2,{asymmetric:true}),C('patchwork-shed',[2.7,.1,-.6],[1.8,1.1,1.6]),['stepped-plank-decks','rope-outriggers','mixed-armor','visible-connectors'],'salvager','목재 층과 교체 판금이 비대칭으로 어긋난 인양 작업선',{artModules:{balloons:2,engines:1,cannons:2,winches:1},scopeNote:'세력 외형 스타일이며 새 고유 함종 아님'}),

  P('rival-change','salvage-junk',[7.8,5.8,1.65],E('single-high',5.8,1.5,3.1,{flatten:.8}),C('market-booth',[1.9,.2,-1.25],[2,1.3,1.65]),['folding-barrier','market-awning','wide-coinlike-deck'],'salvager','작고 넓은 둥근 갑판과 펼치는 가림막, 상인의 비대칭 차양',{artModules:{balloons:1,engines:1,armor:2}}),
  P('rival-debts-end','industrial-tug',[11.2,4.3,2.35],E('side-twin',7.6,1.05,3),C('gantry-booth',[3.6,.2,0],[1.8,1.7,1.6]),['twin-winch-drums','low-tow-yoke','stern-cannon'],'salvager','낮은 견인 멍에와 나란한 두 드럼이 앞갑판을 차지',{artModules:{balloons:2,engines:2,winches:2,cannons:1}}),
  P('rival-quiet-answer','cult-bastion',[8.6,4.6,2.3],E('side-twin',5.4,.85,2.45),C('seal-vault',[2.5,.15,0],[1.7,.9,1.75]),['oversized-bell','small-white-canopy','thin-seal-veil'],'cult','작은 흰 천과 선체만큼 큰 중앙 종의 불균형',{artModules:{balloons:2,engines:1,cannons:1,smokeEmitters:1}}),
  P('rival-night-shift','industrial-boiler',[11.5,5.6,2.8],E('side-twin',7,1.02,2.6,{flatten:.8}),C('furnace-booth',[3.4,.7,-.7],[2,1.2,1.8]),['shielded-boilers','paired-heat-pipes','triple-stack','furnace-window'],'union','둥근 보호 보일러와 열풍 배관, 높이 다른 굴뚝',{artModules:{balloons:2,engines:2,flamethrowers:2,armor:2}}),
  P('rival-go-first','ghost-spear',[14.8,1.9,.9],E('low-inline',10.5,.85,2.2,{ragged:true,flatten:.65}),C('lantern-pod',[4.5,0,0],[1,.75,.9]),['split-spear-bow','single-mast','cold-lanterns','streaming-shroud'],'ghost','어느 배보다 길고 얇은 갈라진 창끝, 뒤로 길게 흐르는 장막',{artModules:{balloons:1,engines:2},bow:.05}),
  P('rival-unfinished','salvage-junk',[11,4.6,1.4],E('side-twin',6.9,1,3.1,{asymmetric:true}),C('patchwork-shed',[3.1,.15,-1],[1.7,1.2,1.4]),['unfinished-frame','assembly-rail','open-storage','coral-small-patch'],'salvager','귀환호를 닮으려다 뼈대·레일·빈 장착부가 드러난 비대칭 작업선',{artModules:{balloons:2,engines:1,cannons:1,winches:1},scopeNote:'귀환호와 닮았다는 문서 특성을 유지하되 완성 원형을 복제하지 않음'}),

  P('boss-bell-devourer','cult-cathedral',[28,11.6,6.7],E('side-twin',18,2.2,7.1,{flatten:1.1}),C('open-belfry',[0,.6,0],[8.6,8.2,6.3]),['central-bell-hall','cathedral-buttresses','seal-tower-row','funeral-drapes','broadside-batteries'],'cult','배가 아니라 거대한 종을 둘러싼 장례 성당, 깊은 선체와 중앙 열린 종실',{showcasePriority:9,artModules:{balloons:2,engines:4,cannons:6,winches:2,armor:6},bow:.05,bossScaleReference:{relativeToHomewardLength:2.8,meaning:'미터·전투 충돌 규격 미확정, 갤러리의 상대 아트 크기'},structuralFeatures:{centralBellHall:1}}),
  P('boss-shipyard-ribs','shipyard',[45,29,9],E('none',0,0,0),C('dock-control',[16,2,-10],[5,5,4]),['three-open-docks','rib-arches','paired-claw-cranes','three-vents','two-cooling-pumps','launch-gate'],'union','배가 통과할 만큼 빈 3구역 조선소와 거대한 갈비뼈형 벽',{showcasePriority:10,artModules:{balloons:0,engines:0},structuralFeatures:{horizontalDockZones:3,stage1HookCranes:2,stage2Vents:3,stage2CoolingPumps:2},scopeNote:'보스 시설; 고유 함선으로 집계하지 않음'}),
  P('boss-shipwright-command','industrial-fortress',[18.7,10.2,4.9],E('side-twin',12,1.8,4.7,{flatten:.85}),C('control-bridge',[4,1.4,0],[4.5,2.6,4.4]),['crane-coupling','twin-industrial-arms','ram-bow','exposed-switchboard'],'union','도크에 결합하는 넓은 철제 지휘 성채와 양옆 작업팔',{showcasePriority:11,artModules:{balloons:2,engines:3,cannons:4,harpoons:2,armor:4},bow:.05}),
  P('boss-fleet-king','ghost-crown',[26,10.6,3.7],E('side-twin',15.5,1.65,5.7,{ragged:true,flatten:.75}),C('crown-throne',[5.3,.7,0],[3.8,3.8,3.4]),['crown-of-broken-masts','crescent-keel','three-memory-cradles','long-name-banners','cold-lanterns'],'ghost','초승달처럼 열린 거대 선체 위 파손 돛대 왕관과 긴 이름 휘장',{showcasePriority:12,artModules:{balloons:2,engines:3,harpoons:3,cannons:2},structuralFeatures:{memoryCradles:3},scopeNote:'외형은31의 왕·기억 모듈 시험에서 해석한 아트 제안이며 새로운 정사 함명 아님'}),
  P('boss-last-inhale','pressure-sanctum',[39,39,10],E('none',0,0,0),C('none',[0,0,0],[0,0,0]),['sealed-mechanical-heart','three-seal-towers','three-heart-connectors','pressure-rings'],'cult','중앙 기계 봉인 심장과 세 탑이 원을 이루는 거대한 순환 장치',{showcasePriority:13,artModules:{balloons:0,engines:0},structuralFeatures:{centralSealedHeart:1,sealingTowers:3,heartConnectionPoints:3,movingDebrisCover:4,safeRepairPockets:2},scopeNote:'보스 시설·개발용 스포일러; 검은 압력 표현이며 생물 장기 아님'}),
  P('mini-funeral-guard','cult-bastion',[8.9,4.4,2.55],E('side-twin',5.6,.9,2.3),C('armored-slab',[2.1,.35,0],[1.9,1.3,2.2]),['single-guard-bell','stepped-bow-armor','short-funeral-veil'],'cult','짧고 높은 앞 장갑과 작은 종 하나, 보스의 열린 종실은 없음',{artModules:{balloons:2,engines:1,cannons:2,armor:3}}),

  P('mission-union-guard','industrial-fortress',[10.4,5.1,2.6],E('side-twin',6.5,1,2.8),C('control-bridge',[2.8,.45,0],[2.2,1.3,2.6]),['box-bulwark','small-smokestacks','side-gun-platforms'],'union','직선 판금과 낮은 박스 조타실·넓은 측면 경비 갑판',{artModules:{balloons:2,engines:2,cannons:2,armor:3}}),
  P('mission-bridge-tug','industrial-tug',[7.7,3.8,1.8],E('single-high',5.9,1.1,2.5),C('gantry-booth',[2.1,.1,-.8],[1.3,1.25,1.1]),['tow-a-frame','single-winch-drum','reinforced-keel'],'salvager','짧은 작업선 뒤로 삐져나온 큰 A자 견인 프레임',{artModules:{balloons:1,engines:1,winches:1}}),
  P('mission-guard-scout','scout-skiff',[7.6,2.15,.95],E('single-high',5.7,.9,2.5,{flatten:.8}),C('open-helm',[1.9,.1,0],[1,.75,1.1]),['forked-tail','signal-pennant','small-lookout'],'union','낮은 선수와 갈라진 꼬리·위로 가는 정찰 신호봉',{artModules:{balloons:1,engines:1}}),
  P('mission-cult-purifier','cult-bastion',[12.2,4.6,3.1],E('side-twin',8.1,1.1,3.05),C('seal-vault',[3.1,.7,0],[2.8,1.5,2.5]),['tall-black-seal-tanks','long-white-veil','seal-arch'],'cult','길쭉한 검은 봉인통 열과 흰 장막이 쌓인 정화 작업선',{artModules:{balloons:2,engines:1}}),
  P('mission-ghost-artillery','ghost-spear',[12.7,3.6,1.5],E('side-twin',8.2,1,3,{ragged:true,flatten:.75}),C('lantern-pod',[3.9,.25,0],[1.5,1,1.3]),['broken-gun-wings','torn-sails','cold-lanterns'],'ghost','날개처럼 벌어진 파손 포대와 길게 남은 선수',{artModules:{balloons:2,engines:1,cannons:2}}),
  P('role-enemy-artillery','tax-barge',[11.1,4.7,1.95],E('side-twin',7.2,1.05,3.2),C('open-helm',[3.2,.15,0],[1.4,.8,1.8]),['broadside-platform','low-ammo-locker','barge-bow'],'salvager','선체 바깥으로 돌출된 두꺼운 측면 포대와 낮은 조타대',{artModules:{balloons:2,engines:1,cannons:2},scopeNote:'역할 슬롯이며 새 고유 함선 외형 확정 아님'}),
  P('role-enemy-defense','cult-bastion',[9.8,6.1,2.7],E('side-twin',6.4,1.1,2.65),C('armored-slab',[2.3,.5,0],[2,1,2.5]),['wide-shield-wall','recessed-control-slit','armored-pontoons'],'salvager','가로로 긴 판금 방벽과 그 뒤에 숨은 낮은 조타실',{artModules:{balloons:2,engines:1,armor:5},scopeNote:'소속 미정 방어 역할; 교단 고유 종·봉인 문양을 추가하지 않음'}),

  P('story-mara-repair','repair-catamaran',[8.5,5.3,1.25],E('side-twin',6.1,.85,2.6),C('workshop',[2.3,.1,-1.4],[1.8,1.3,1.45]),['canvas-tool-awning','open-work-bay','single-repair-jib'],'civil','낮고 따뜻한 공방 천막·작업칸이 빈 작은 쌍동선',{artModules:{balloons:2,engines:1,repairArms:1}}),
  P('story-or-ship','salvage-junk',[9.1,4.9,1.55],E('single-high',6.5,1.25,3.1,{offset:[.6,0,-.7]}),C('patchwork-shed',[2.2,.15,-1],[1.8,1.4,1.5]),['open-tool-rack','rope-outriggers','workbench-canopy'],'salvager','옆으로 열린 작업대와 두꺼운 밧줄, 한쪽으로 기운 작은 공방선',{artModules:{balloons:1,engines:1},scopeNote:'정확한 선체가 없는 인물 임무 슬롯의 아트 제안'}),
  P('story-compressor-wreck','industrial-boiler',[10.3,4.2,2.9],E('single-high',6.7,1,2.6,{ragged:true,flatten:.75}),C('broken-booth',[2.7,.15,-.85],[1.7,1.2,1.3]),['fractured-compressor','broken-pressure-pipes','quarantine-frame','collapsed-bow'],'salvager','기울어진 압축기 원통과 끊어진 배관이 남은 난파 작업선',{artModules:{balloons:1,engines:1}}),
  P('story-cult-storage','cult-bastion',[13.2,5.3,2.45],E('side-twin',8.7,1.15,3.1),C('seal-vault',[4,.3,0],[2.2,1.4,2.4]),['sealed-container-row','covered-cargo-vault','short-seal-banners'],'cult','낮고 긴 밀폐 보관 갑판·검은 봉인통과 흰 덮개',{artModules:{balloons:2,engines:1}}),
  P('story-union-cooling','industrial-boiler',[12.8,5.1,2.5],E('side-twin',7.8,1.05,2.8),C('furnace-booth',[3.8,.4,-1],[1.9,1.2,1.7]),['cooling-radiator-fan','paired-cooling-tanks','looped-pipes'],'union','평행 냉각통과 부채꼴 방열판·둥글게 돌아오는 배관',{artModules:{balloons:2,engines:1}}),
  P('story-mothers-escort','ghost-spear',[13.1,3.1,1.45],E('side-twin',8.8,1.05,3.2,{ragged:true}),C('lantern-pod',[4.1,.2,0],[1.7,1.1,1.5]),['old-escort-shield','torn-signal-cloth','cold-lanterns','signal-mast'],'ghost','오래된 호위 방패와 찢긴 신호천, 길고 고요한 파손 선체',{artModules:{balloons:2,engines:1},scopeNote:'31의 옛 호위선이며 귀환호 원형 복제 금지'}),
  P('story-turret-owner','ghost-spear',[10.9,3.9,1.65],E('single-high',7.4,1.1,2.9,{ragged:true}),C('lantern-pod',[3,.15,-.7],[1.6,.95,1.4]),['empty-turret-plinth','family-signal-cloth','cold-lanterns'],'ghost','비어 있는 큰 포탑 받침과 작은 신호천이 남은 짧은 망령선',{artModules:{balloons:1,engines:1},scopeNote:'포탑 반환 사건의 동일 배; 포탑 부재는 아트 제안이며 서사 상태와 연동 필요'}),
  P('story-cult-transport','civil-cargo',[15.1,5.8,2.2],E('side-twin',10,1.2,3.9),C('seal-vault',[4.8,.25,0],[2.4,1.35,2.8]),['long-sealed-hold','black-seal-tanks','white-cargo-veil'],'cult','성당이 없는 긴 밀폐 화물 선체와 흰 봉인 덮개',{artModules:{balloons:2,engines:2}}),
  P('story-union-contact','civil-courier',[8.5,2.5,1.15],E('single-high',6.2,.92,2.7,{flatten:.85}),C('signal-booth',[2.2,.1,0],[1.4,1.2,1.25]),['union-signal-mast','wire-aerial','forked-tail'],'union','높은 가는 안테나와 낮은 산업 조타부의 소형 연락선',{artModules:{balloons:1,engines:1}}),
  P('story-union-carrier','civil-cargo',[14.3,6.5,2.1],E('side-twin',9.2,1.1,3.2),C('gantry-booth',[4.8,.25,-1.7],[2.2,1.7,1.8]),['cargo-rail-grid','stalled-hoist','broken-tail-engine','large-open-hold'],'union','커다란 빈 적재칸과 멈춘 호이스트·찌그러진 꼬리 추진부',{artModules:{balloons:2,engines:2}}),
  P('story-morning','civil-shelter',[12.1,6.6,1.6],E('side-twin',8.2,1.1,3.5),C('shelter-cabin',[3.4,.1,-1.5],[2.2,1.5,1.8]),['sunrise-canopy','passenger-rails','warm-rescue-lanterns'],'civil','따뜻한 아침색 캐노피 아래 넓게 열린 구호 갑판',{artModules:{balloons:2,engines:2}}),
  P('story-royal-funeral','royal-funeral',[20,6.6,3.1],E('side-twin',13.8,1.35,4.6),C('ceremonial-pavilion',[4.4,.7,0],[4.5,2.6,3.7]),['long-funeral-veil','ceremonial-bier','slender-gold-poles'],'royal','가늘고 긴 의례 선체·흰 장막과 낮은 왕실 정자',{artModules:{balloons:2,engines:2},scopeNote:'왕실 장례선은 교단 첫 보스와 다른 의례선'}),

  P('civil-maintenance','repair-catamaran',[7.3,4.5,1.15],E('side-twin',5.4,.75,2.2),C('workshop',[1.9,.1,-1.1],[1.4,1.1,1.2]),['small-service-awning','open-tool-rack','short-repair-jib'],'civil','두 낮은 선체와 작은 수리 차양, 전투용 크레인 없음',{artModules:{balloons:2,engines:1,repairArms:1}}),
  P('civil-transport','civil-cargo',[12.8,5.7,1.65],E('side-twin',8.5,1.05,3.2),C('cargo-booth',[3.9,.1,0],[2.1,1.25,2.2]),['covered-cargo-hold','passenger-rails','low-flat-bow'],'civil','폭넓은 평평한 선수와 덮개 화물칸, 낮은 중앙 조타부',{artModules:{balloons:2,engines:1}}),
  P('civil-merchant','civil-cargo',[11.6,6.1,1.75],E('side-twin',7.9,1.05,3.2),C('market-booth',[2.9,.2,-1.5],[2,1.35,1.8]),['striped-market-awning','crate-terraces','side-loading-ramp'],'civil','계단식 상자 더미·줄무늬 차양·옆으로 나온 적재 경사로',{artModules:{balloons:2,engines:1}}),
  P('civil-relief','civil-shelter',[10.8,6.3,1.4],E('side-twin',7.4,1.05,3),C('shelter-cabin',[3.1,.1,-1.4],[2,1.3,1.7]),['rescue-canopy','supply-lockers','warm-rescue-lanterns'],'civil','낮은 두 선체·큰 구조 천막·비어 있는 승선 갑판',{artModules:{balloons:2,engines:1}}),
  P('civil-research','historical-capsule',[10.1,4.9,2.4],E('side-twin',6.6,.95,3.3),C('observation-dome',[2,.4,0],[2.5,1.8,2.5]),['lightning-mast','observation-cage','coil-instruments'],'civil','가는 피뢰침과 둥근 관측창·외부 측정 코일',{artModules:{balloons:2,engines:1}}),
  P('civil-salvager','salvage-junk',[9.6,5.3,1.7],E('side-twin',6.6,.95,2.9,{asymmetric:true}),C('patchwork-shed',[2.6,.15,-1],[1.7,1.2,1.5]),['forked-salvage-boom','rope-outriggers','loose-patchwork-sails'],'salvager','갈라진 인양 붐과 어긋난 목재 갑판, 바깥으로 굽은 밧줄 지지대',{artModules:{balloons:2,engines:1,winches:1}}),
  P('civil-mail','civil-courier',[8.8,2.7,1.05],E('single-high',6.6,1,2.8,{flatten:.88}),C('mail-pod',[2.1,.05,0],[1.6,1.05,1.35]),['mail-satchel-lockers','postal-pennant','split-tail-fin'],'civil','우편 가방형 측면 함과 제비꼬리·달걀 기낭의 작은 배',{artModules:{balloons:1,engines:1}}),
  P('civil-ghost-signal','ghost-spear',[9.5,2.7,1.2],E('low-inline',6.6,.9,2.5,{ragged:true}),C('lantern-pod',[2.7,.05,0],[1.5,1,1.25]),['white-negotiation-lantern','lowered-sails','open-signal-deck'],'ghost','돛을 낮추고 흰 교섭등을 높이 든 작은 파손선',{artModules:{balloons:1,engines:1},scopeNote:'대화 가능 신호 외형, 적대 세력 전체를 공격 대상으로 만들지 않음'}),
  P('civil-evacuation','civil-shelter',[13.3,7.2,1.6],E('side-twin',8.9,1.15,3.4),C('shelter-cabin',[4.1,.1,-1.8],[2.3,1.4,1.9]),['wide-passenger-canopy','boarding-stairs','lifeline-rails','warm-rescue-lanterns'],'civil','넓은 천막과 낮은 승선 계단·갑판을 둘러싼 구조 밧줄',{artModules:{balloons:2,engines:2}}),
  P('record-descent-ship','historical-capsule',[8.8,3.7,3.8],E('single-high',5.8,1,3.6,{flatten:1.2}),C('observation-dome',[1.3,.4,0],[2.2,2,2.3]),['descent-cage','heavy-keel-ring','old-survey-mast'],'salvager','수직으로 깊은 케이지 선체와 두꺼운 하강 링·관측창',{artModules:{balloons:1,engines:1},scopeNote:'과거 기록용 슬롯이며 새 운용 함종 아님'}),
  P('unfinished-stitch-hull','salvage-junk',[10.5,3.6,1.6],E('none',0,0,0),C('unfinished-frame',[3,.05,0],[2.1,1.5,1.8]),['bare-keel-ribs','empty-cabin-frame','assembly-rail','empty-sockets'],'union','귀환호를 닮은 길이·뒤 선장실 자리만 남은 빈 접합 골격',{artModules:{balloons:0,engines:0},scopeNote:'미완성 골격; 완성 선체나 새 적으로 집계하지 않음'}),
  P('support-independent-rescue','civil-shelter',[4.9,3.7,.85],E('single-high',3.7,.7,1.85,{flatten:.8}),C('open-helm',[1.3,0,-.65],[.7,.55,.65]),['rescue-basket-deck','short-canopy','small-tail-engine'],'hero','작은 바구니 갑판·짧은 구조 차양·낮은 독립 추진정',{artModules:{balloons:1,engines:1,rescueCapsules:1},scopeNote:'독립 추진 구조정, 장비 바스켓 자체와 구별'}),
  P('ending-mobile-harbor','hero-build',[22,13,3.1],E('triad-low',14.5,1.8,5.9),C('cottage',[6.5,.4,-2.7],[3.1,2.1,2.6]),['coral-triangle','mooring-wings','small-boat-berths','home-table-canopy'],'hero','작은 집을 보존한 넓은 이동항구·양옆 계류 날개와 손님 배 자리',{artModules:{balloons:3,engines:3},scopeNote:'귀환호의 결말 상태 아트 제안; 신규 고유 함선 아님'}),
  P('ending-light-descent','hero-build',[7.4,2.6,1.1],E('single-high',5.7,.9,2.65),C('cottage',[1.9,0,0],[1.55,1.1,1.35]),['coral-triangle','home-table','empty-foredeck','small-home-lantern'],'hero','식탁·휘장·빈 앞갑판이 남은 작아진 귀환호',{artModules:{balloons:1,engines:1},scopeNote:'귀환호의 결말 상태 아트 제안; 신규 고유 함선 아님'}),
];

export const PROFILES = Object.freeze(Object.fromEntries(entries.map(p => [p.id,p])));
export const SHOWCASE_IDS = Object.freeze(entries.filter(p=>p.showcasePriority).sort((a,b)=>a.showcasePriority-b.showcasePriority).map(p=>p.id));
export const LANDMARK_CODES = Object.freeze([...new Set(entries.flatMap(p=>p.landmarks))].sort());
export function getProfile(id) {
  const profile=PROFILES[id];
  if (!profile) throw new Error(`No v2 identity profile for ${id}; design-* originals intentionally excluded`);
  return profile;
}

/** Preserve explicit canonical counts. Fallback counts are prototype art only. */
export function resolveArtModules(ship, fallback={}) {
  const proposed={...fallback,...getProfile(ship.id).artModules};
  for(const [key,value] of Object.entries(ship.modules||{})) if(Number.isInteger(value)) proposed[key]=value;
  return proposed;
}
