export const BRANCHES=[{id:'mobility',name:'기동 · 바람길잡이'},{id:'artillery',name:'포격 · 철갑형'},{id:'salvage',name:'인양 · 구름 예인선'}];
export const KITS={mobility:['','공통 항해선','확장 선체 · 고정 활공돛','복층 갑판 · 삼분할 활공돛','삼중 부양낭 · 다단 추진대','거대 기함 · 사중 부채 날개 · 다중 추진대'],artillery:['','공통 항해선','단포 선회대 · 포방패 · 측면 탄약함','삼각 회전 약실 · 캐러셀 · 곡선 급탄로','장거리 공성포 · 노출 반동 레일 · 완충기','상하 분리 포탑 · 측면 포좌 · 탄약 승강기'],salvage:['','공통 항해선','쌍 관절 집게 · 황동 인양 릴','거대 아치 크레인 · 공방 차양','대형 인양 집게 · 장식 화물 요람','황동 공방 기함 · 왕관 문장 · 다층 인양장치']};
export const TYPES=[{id:'starter-r1',branch:'starter',rank:1,name:'귀환호 · 첫 항해',kit:'항해등 · 곡선 난간 · 돛대 차양',file:'returnship-r1.glb'},...[2,3,4,5].flatMap(rank=>BRANCHES.map(b=>({id:b.id+'-r'+rank,branch:b.id,rank,name:b.name,kit:KITS[b.id][rank],file:`${b.id}-r${rank}.glb`})) )];
export const previousId=id=>{const t=TYPES.find(t=>t.id===id);return t.rank<=2?'starter-r1':`${t.branch}-r${t.rank-1}`;};



