export const SPEC = [
  ['01-capacitor-tower','축전 전기탑','Capacitor tower','도자기 애자 두 기둥, 구리 코일과 축전 계기함','electrical'],
  ['02-deck-greatbow','갑판 대궁','Deck greatbow','높은 리커브 활대, 당김 장치와 물리 화살','projectile'],
  ['03-repeating-crossbow','연발 쇠뇌','Repeating crossbow','낮고 넓은 활대와 볼트 급탄 선반','projectile'],
  ['04-harpoon-winch','작살 윈치','Harpoon winch','개방형 작살 가이드와 감긴 밧줄 드럼','utility'],
  ['05-small-catapult','소형 투석기','Small catapult','A형 골조와 숟가락 투척팔, 권양기','projectile'],
  ['06-net-launcher','투망 발사대','Net launcher','벌어진 발사틀, 실제 격자 로프망과 모서리 추','utility'],
  ['07-folding-shield','접이식 방패','Folding shield','겹친 곡면 목재 패널과 힌지 보강','defense'],
  ['08-steam-projector','증기 분사기','Steam projector','둥근 압력 보일러와 계기, 짧은 분사구','pressure'],
  ['09-side-circular-saw','측면 회전톱','Side circular saw','측면 지지팔과 톱니 원반, 벨트와 기어','melee'],
  ['10-chain-flail','사슬추 타격기','Chain flail','굽은 목재 붐, 실제 연결 고리와 묵직한 추','melee'],
  ['11-pneumatic-fan','공압 바람개비','Pneumatic fan','청록 날개와 크림 주름 풀무, 목재 드럼','pressure'],
  ['12-folding-ram','접이식 충각','Folding ram','목재 쐐기와 강철촉, 접이식 지지대','melee'],
].map(([id,name_ko,name_en,role,category],i)=>({id,order:i+1,name_ko,name_en,role,category,build_method:'original_local_multipart_geometry'}));
export const REFERENCE='outputs/fantasy-weapon-moodboard-v2/moodboard.png';
export const REFERENCE_SHA='d365d79e036b8d33139561b9b17901e2b7ec5b3b93b490ea93ee2964d9b4c372';
