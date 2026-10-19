export const DURATION=6;
export const BRANCHES={
 mobility:{name:'기동 · 쇠뇌 끊어쏘기',launch:[.8,1.03,1.26],travel:.45,recovery:3.4,targetX:-1.48,pan:-.12,source:/ready_bolt_[012]_/,mechanism:/draw_horizontal_limb/},
 artillery:{name:'포격 · 로켓 순차 발사',launch:[.9,1.2,1.5],travel:.65,recovery:3.9,targetX:-1.48,pan:.08,source:/individual_comet_prop_[012]_/,mechanism:/inclined_triple_rail_carriage/},
 salvage:{name:'인양 · 작살 타격과 장력',launch:[.95],travel:.7,recovery:3.6,targetX:-1.48,pan:.16,source:/loaded_forged_harpoon/,mechanism:/drum_rope_spool/},
};
export function eventsFor(branch){const b=BRANCHES[branch],list=[];b.launch.forEach((launch,i)=>{list.push({id:branch+'-'+i+'-launch',shot:i,phase:'launch',time:launch},{id:branch+'-'+i+'-flight',shot:i,phase:'flight',time:launch+.06},{id:branch+'-'+i+'-hit',shot:i,phase:'hit',time:launch+b.travel});});list.push({id:branch+'-recovery',phase:'recovery',time:b.recovery});return list.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));}
export const pulse=(age,attack=.04,decay=.3)=>age<0?0:age<attack?Math.sin(age/attack*Math.PI/2):Math.exp(-(age-attack)/decay)*Math.cos((age-attack)*13);
export function sweptTargetCrossing(origin,tip,faceX){return origin[0]>faceX&&tip[0]<=faceX+1e-6;}
