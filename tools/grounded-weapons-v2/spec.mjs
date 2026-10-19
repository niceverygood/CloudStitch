export const SPEC=[
 ['13-comet-rocket-rack','혜성 로켓 선반','Comet rocket rack','비대칭 세 갈래 레일과 천으로 감싼 소형 로켓','projectile'],
 ['14-disc-slinger','황동 원반 발사기','Brass disc slinger','큰 원반 탄창과 노출된 쌍회전 롤러','projectile'],
 ['15-piston-hammer','증기 피스톤 망치','Steam piston hammer','거대한 납작 망치와 굽은 연결봉·굵은 압력 실린더','melee'],
 ['16-drill-lance','나선 드릴창','Spiral drill lance','층진 원추 드릴과 목재 전진대·벨트 동력','melee'],
 ['17-bomb-dropper','구름방울 투하대','Cloud-drop bomb rack','방울형 투하물 세 개와 선수 밖으로 뻗은 걸쇠 선반','projectile'],
 ['18-salvage-claw','황동 인양 집게','Brass salvage claw','크게 벌어진 세 손가락 집게와 곡선 지지붐·윈치','utility'],
].map(([id,name_ko,name_en,role,category],i)=>({id,order:i+1,name_ko,name_en,role,category,build_method:'original_local_multipart_geometry'}));
export const REFERENCE='outputs/fantasy-weapon-moodboard-v2/moodboard.png';
export const REFERENCE_SHA='d365d79e036b8d33139561b9b17901e2b7ec5b3b93b490ea93ee2964d9b4c372';
