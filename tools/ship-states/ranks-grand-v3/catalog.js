export const BRANCHES=[{id:'mobility',name:'기동 · 바람길잡이'},{id:'artillery',name:'포격 · 철갑형'},{id:'salvage',name:'인양 · 구름 예인선'}];
export const KITS={mobility:['','공통 항해선','확장 선체 · 고정 활공돛','복층 갑판 · 삼분할 활공돛','삼중 부양낭 · 다단 추진대','거대 기함 · 사중 부채 날개 · 다중 추진대'],artillery:['','공통 항해선','선수 단포 · 곡면 방호','회전 약실 · 급탄 캐러셀','반동 레일 · 전개 지지대','통합 쌍포 · 장전부와 중첩 장갑'],salvage:['','공통 항해선','U자 예인 받침 · 케이블 드럼','접이식 크레인 · 인양 슬링','전개식 회수 도크 · 화물 플랫폼','복합 정비 작업 팔 · 개방형 공방']};
export const TYPES=[{id:'starter-r1',branch:'starter',rank:1,name:'귀환호 · 첫 항해',kit:'항해등 · 곡선 난간 · 돛대 차양',file:'returnship-r1.glb'},...[2,3,4,5].flatMap(rank=>BRANCHES.map(b=>({id:b.id+'-r'+rank,branch:b.id,rank,name:b.name,kit:KITS[b.id][rank],file:`${b.id}-r${rank}.glb`})) )];
export const previousId=id=>{const t=TYPES.find(t=>t.id===id);return t.rank<=2?'starter-r1':`${t.branch}-r${t.rank-1}`;};

