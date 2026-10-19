const fs=require('fs'),{SceneGLB,THREE:T}=require('./glb.cjs');
const DURATION=4.2,OFF=.00001;
const box=new T.BoxGeometry(1,1,1),sphere=new T.SphereGeometry(1,16,10),cone=new T.ConeGeometry(1,1,16),cylinder=new T.CylinderGeometry(1,1,1,14),ring=new T.TorusGeometry(1,.035,6,48);
const Q=(axis,angle)=>new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis),angle).toArray();
function buildScene(item,bytes,{atlasBytes}){
 const g=new SceneGLB(bytes),j=g.json,b=g.bounds(),size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3()),s=3/Math.max(size.x,size.y,size.z),classic=item.group==='classic',id=item.source_id;
 g.repairSourceZeroNormals();const norm=g.node('Source_units_normalization',g.weapon,{scale:[s,s,s],translation:[-center.x*s,-b.min.y*s,-center.z*s]});j.nodes[norm].children=g.sourceRoots;j.nodes[g.weapon].children=[norm];if(classic)j.nodes[g.weapon].rotation=Q([0,1,0],Math.PI/2);
 const point=(p)=>new T.Vector3(...p).sub(new T.Vector3(center.x,b.min.y,center.z)).multiplyScalar(s).applyAxisAngle(new T.Vector3(0,1,0),classic?Math.PI/2:0).toArray();
 const added=g.node('Sequence_props_and_painted_effects');
 const atlas=g.atlas(atlasBytes),mats={},tiles={muzzle:[0,0],impact:[1,0],smoke:[0,1],trail:[1,1]};
 const cards={};for(const [key,[col,row]]of Object.entries(tiles)){const geo=new T.PlaneGeometry(1,1),uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,col*.5+.07+uv.getX(i)*.36,row*.5+.07+(1-uv.getY(i))*.36);cards[key]=geo;}
 function node(n,p,pose){return g.node(n,p??added,pose);}
 function mesh(n,geo,c,p,at=[0,0,0],scale=[1,1,1],rotation){return g.mesh(n,geo,c,p??added,{translation:at,scale,...(rotation?{rotation}:{})});}
 function beam(n,a,b,r=.035,color=0xb28a57,p){const v=new T.Vector3(...b).sub(new T.Vector3(...a)),mid=new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5);return mesh(n,cylinder,color,p,mid.toArray(),[r,v.length(),r],new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()).toArray());}
 function pulse(n,start,end,peak=1){g.scale(n,[0,start,start+.055,end-.12,end,DURATION],[OFF,OFF,peak,peak*.8,OFF,OFF]);}
 function card(n,kind,at,start,end,scale=1,parent,rotation=[0,0,0,1]){const a=g.mesh(n,cards[kind],0xffffff,parent??added,{translation:at,rotation},atlas);pulse(a,start,end,scale);return a;}
 function smoke(at,start,count=7,spread=1){for(let i=0;i<count;i++){const t=start+i*.035,a=i*2.399,end=t+.9,p=[at[0]+Math.cos(a)*.12,at[1],at[2]-i*.06];const n=card('Painted_cream_sage_smoke_'+i,'smoke',p,t,end,.9+spread*.18*(i%3),undefined,Q([0,0,1],a));g.move(n,[0,t,t+.65,DURATION],[p,p,[p[0]+Math.cos(a)*spread*.5,p[1]+.7+i*.05,p[2]-.35],p]);}}
 let action='projectile',description='',start=[0,1.3,1.5],contact=[0,1.3,8],hit=1.45,travel=.65,targetKind='wall';
 if(classic){start=[0,1.55,1.4];description='기존 무기 원형의 표시 반동 · 실제 GLB에 포함된 발사 장면';}
 else {
 const origin={
 '01-capacitor-tower':[0,2.45,.2],'02-deck-greatbow':[0,1.6,1.3],'03-repeating-crossbow':[0,1.03,1.15],'04-harpoon-winch':[0,1.25,1.35],'05-small-catapult':[0,2.1,.9],'06-net-launcher':[0,1.45,1.1],'07-folding-shield':[0,1.2,.8],'08-steam-projector':[0,1.5,1.3],'09-side-circular-saw':[.88,1.69,.4],'10-chain-flail':[-.94,1.31,.04],'11-pneumatic-fan':[0,1.4,.9],'12-folding-ram':[0,1.0,1.5],'13-comet-rocket-rack':[0,1.7,1.4],'14-disc-slinger':[0,1.4,1.5],'15-piston-hammer':[0,2.2,1.2],'16-drill-lance':[0,1.29,2.05],'17-bomb-dropper':[0,1.47,.21],'18-salvage-claw':[0,1.5,.8]};start=point(origin[id]);
 }
 contact=[start[0],start[1],8];
 const mode={
 '01-capacitor-tower':'electric','02-deck-greatbow':'arrow','03-repeating-crossbow':'bolts','04-harpoon-winch':'harpoon','05-small-catapult':'lob','06-net-launcher':'net','07-folding-shield':'shield','08-steam-projector':'steam','09-side-circular-saw':'saw','10-chain-flail':'flail','11-pneumatic-fan':'wind','12-folding-ram':'ram','13-comet-rocket-rack':'rocket','14-disc-slinger':'disc','15-piston-hammer':'hammer','16-drill-lance':'drill','17-bomb-dropper':'drop','18-salvage-claw':'claw',
 '01-machine-gun':'mg','02-deck-cannon':'cannon','03-mortar':'lob','04-harpoon':'harpoon','05-chain-shot':'chain','06-flamethrower':'flame'}[id];
 if(['saw','flail','ram','hammer','drill'].includes(mode)){action='melee';contact=[start[0],Math.max(.6,start[1]-.2),start[2]+1.05];}
 if(['harpoon','net','claw'].includes(mode))action='utility';if(mode==='shield')action='defense';if(['wind','steam'].includes(mode))action='pressure';
 if(mode==='drop'){action='drop';targetKind='ground';const lift=2.9;j.nodes[g.weapon].translation=[0,lift,0];start[1]+=lift;contact=[start[0],.15,start[2]];}
 if(mode==='claw'){start=point([.89,1.23,.17]);contact=point([.89,.35,.67]);targetKind='cargo';}
 if(mode==='shield'){contact=[start[0],start[1],start[2]+.3];targetKind='none';}
 if(mode==='saw'){contact=[start[0]+.7,start[1]-.15,start[2]];}
 if(mode==='flail'){contact=[start[0]-.7,.5,start[2]];}
 description=({electric:'코일 충전 → 가지 방전 → 전기 스파크',arrow:'활대 당김 → 대형 화살 → 목재 명중',bolts:'급탄과 활대 반동 → 세 발 연사 → 연속 명중',harpoon:'작살 사출 → 줄 펼침 → 걸림·권양 회수',lob:'예비 장전 → 포물선 투척 → 상부 명중',net:'투망 사출 → 로프망 펼침 → 표적 감싸기',shield:'패널 전개 → 날아오는 탄환 방어 → 접기',steam:'밸브 개방 → 부드러운 증기 분출 → 확산',saw:'톱 회전 → 측면 접근 → 목재 절삭',flail:'사슬추 예비 흔들기 → 내려찍기 → 반동',wind:'풀무 압축 → 날개 회전 → 돌풍과 잎사귀',ram:'지지대 전개 → 충각 전진 → 충격 후 복귀',rocket:'레일 점화 → 삼발 로켓 순차 가속 → 세 차례 충격',disc:'탄창 급탄 → 회전 원반 사출 → 튕기는 불꽃',hammer:'망치 들어올리기 → 피스톤 타격 → 튀어오름',drill:'척 회전 → 드릴창 전진 → 나선 절삭',drop:'걸쇠 해제 → 실제 수직 투하 → 지면 충격',claw:'집게 내리기 → 세 손가락 닫기 → 화물 인양',mg:'급탄 준비 → 리듬 있는 다섯 발 → 연속 명중',cannon:'묵직한 반동 → 포탄 비행 → 목재 분출',chain:'쌍구 탄환과 사슬 회전 → 연결 타격',flame:'압력 준비 → 겹겹의 화염 분사 → 연기 여운'})[mode];
 // Source-only wrappers provide review pivots. No production socket is inferred.
 const bindings=[];
 function part(fragment){const n=g.find(fragment);if(n>=0)bindings.push({semantic:fragment,node:j.nodes[n].name});return n;}
 function rotatePart(fragment,times,angles,axis='x',pivot){let n=part(fragment);if(n<0)return;if(pivot){const parent=j.nodes.findIndex(x=>(x.children||[]).includes(n)),p=node('Review_pivot_'+fragment,parent,{translation:pivot});j.nodes[parent].children=j.nodes[parent].children.filter(x=>x!==n);j.nodes[p].children=[n];const old=j.nodes[n].translation||[0,0,0];j.nodes[n].translation=old.map((v,i)=>v-pivot[i]);n=p;}g.rotate(n,times,angles,axis);}
 function pushPart(fragment,delta,ts=[0,.3,.64,.82,1.3,2.5,3.7,DURATION]){const n=part(fragment);if(n<0)return;const base=j.nodes[n].translation||[0,0,0];g.move(n,ts,[base,base,base.map((v,i)=>v-delta[i]*.18),base.map((v,i)=>v+delta[i]),base.map((v,i)=>v+delta[i]),base,base,base]);}
 if(classic)g.move(g.weapon,[0,.3,.62,.68,.9,1.2,DURATION],[[0,0,0],[0,0,0],[0,0,.05],[0,.015,-.22],[0,0,-.07],[0,0,0],[0,0,0]]);
 if(mode==='arrow')rotatePart('draw_greatbow_assembly',[0,.3,.6,.68,.84,2,4.2],[0,.08,.14,-.08,0,0,0]);
 if(mode==='bolts')rotatePart('draw_horizontal_limb',[0,.5,.65,.73,.82,.9,1.0,1.1,4.2],[0,.08,-.06,.07,-.05,.07,-.05,0,0]);
 if(mode==='lob'&&!classic)rotatePart('throwing_arm_pivot',[0,.3,.6,.72,.9,2.9,4.2],[0,-.35,-.45,1.35,1.45,0,0]);
 if(mode==='harpoon'&&!classic)rotatePart('drum_rope_spool',Array.from({length:22},(_,i)=>i*.2),Array.from({length:22},(_,i)=>i*.7),'x');
 if(mode==='shield')for(let i=1;i<=5;i++)rotatePart('shield_leaf_'+i+'_hinge',[0,.3,.7,2.7,3.7,4.2],[.7*(i-3),.7*(i-3),0,0,.7*(i-3),.7*(i-3)],'y');
 if(mode==='saw'){rotatePart('rotating_toothed_disc',Array.from({length:43},(_,i)=>i*.1),Array.from({length:43},(_,i)=>i*.8),'z');pushPart('articulated_saw_boom',[.65,0,0]);}
 if(mode==='flail')rotatePart('chain_and_forged_weight',[0,.3,.6,.85,1.1,1.45,2.3,3.6,4.2],[0,-.4,-.8,.55,.1,-.25,.15,0,0],'z',[-1,2.84,0]);
 if(mode==='wind'){rotatePart('six_teal_fan_blades',Array.from({length:43},(_,i)=>i*.1),Array.from({length:43},(_,i)=>i*.9),'z');const n=part('pleated_canvas_pressure_bellows');if(n>=0)g.scale(n,[0,.3,.6,.9,1.2,1.5,2,3,4.2],[[1,1,1],[1,1,.6],[1,1,1],[1,1,.55],[1,1,1],[1,1,.55],[1,1,1],[1,1,.7],[1,1,1]]);}
 if(mode==='ram')pushPart('long_folding_ram_body',[0,0,.75]);
 if(mode==='hammer')rotatePart('curved_hammer_boom',[0,.3,.6,.9,1.15,1.4,1.8,3.5,4.2],[0,-.3,-.55,.65,.68,.42,.6,0,0],'x',[0,1.68,-.36]);
 if(mode==='drill'){rotatePart('rotating_spiral_lance',Array.from({length:43},(_,i)=>i*.1),Array.from({length:43},(_,i)=>i*.95),'z');pushPart('rotating_spiral_lance',[0,0,.7]);}
 if(mode==='rocket'){rotatePart('inclined_triple_rail_carriage',[0,.4,.65,.9,1.2,2.2,4.2],[0,-.06,.02,-.04,.01,0,0]);for(let i=0;i<3;i++){const n=part('individual_comet_prop_'+i);if(n<0)continue;const children=[...(j.nodes[n].children||[])],payload=node('Review_loaded_rocket_payload_'+i,n);for(const child of children){if(/rocket_body|pointed_teal_nose|nose_binding|cloth_wrap|tail_fin|exhaust_cap/.test(j.nodes[child].name||'')){j.nodes[n].children=j.nodes[n].children.filter(x=>x!==child);(j.nodes[payload].children??=[]).push(child);}}g.scale(payload,[0,.64+i*.18,.65+i*.18,3.6,3.7,4.2],[1,1,OFF,OFF,1,1]);}}
 if(mode==='disc')rotatePart('tall_open_disc_carousel',[0,.4,.7,1,1.3,2.5,4.2],[0,.3,.6,.9,1.2,1.2,0],'z');
 if(mode==='claw'){pushPart('three_finger_claw',[0,-.75,.5],[0,.3,.6,.9,1.4,2.7,3.7,4.2]);for(let i=0;i<3;i++)rotatePart('curved_gripping_finger_'+i,[0,.6,1.05,1.3,2.6,3.3,4.2],[0,.25,-.6,-.6,-.6,0,0],'x');}
 // A small authored wooden target is separate from the imported weapon.
 const target=node('Review_target',added,{translation:contact});
 if(targetKind==='wall'){for(let i=0;i<5;i++){mesh('Honey_wood_target_plank',box,i%2?0xc99656:0xd7ad70,target,[(i-2)*.39,0,.16],[.37,2.6,.18]);for(let k=0;k<3;k++)beam('Visible_wood_brush_grain',[(i-2)*.39-.1+k*.09,-1.15,.055],[(i-2)*.39-.08+k*.09,1.15,.055],.004,0xb28551,target);}for(const y of[-1.25,1.25])mesh('Teal_iron_target_strap',box,0x4c8077,target,[0,y,.025],[2.1,.10,.15]);}
 if(targetKind==='ground')mesh('Ground_impact_pad',box,0xc49b62,target,[0,-.15,0],[3,.2,3]);
 if(targetKind==='cargo'){mesh('Recoverable_oak_crate',box,0xb78a50,target,[0,0,0],[.65,.65,.65]);for(const x of[-.28,.28])mesh('Crate_brass_strap',box,0xd4b86a,target,[x,0,0],[.055,.72,.72]);g.move(target,[0,1.2,1.5,2.8,3.6,4.2],[contact,contact,contact,point([.89,1.0,.17]),[...contact],contact]);}
 function impact(at,t,strength=1){const group=node('Surface_aligned_impact',added,{translation:[at[0],at[1],at[2]-.07],...(targetKind==='ground'?{rotation:Q([1,0,0],-Math.PI/2)}:{})});card('Painted_contact_core','impact',[0,0,0],t,t+.55,2.3*strength,group);for(let i=0;i<7;i++){const a=i*2.399,n=mesh('Tumbling_wood_splinter',box,i%2?0xcfaa70:0x72917b,group,[0,0,0],[.08,.30,.05]);g.move(n,[0,t,t+.45,t+.95,DURATION],[[0,0,0],[0,0,0],[Math.cos(a)*strength,Math.sin(a)*strength,-.55],[Math.cos(a)*1.3*strength,Math.sin(a)*strength-.65,-.7],[0,0,0]]);g.scale(n,[0,t,t+.02,t+.7,t+.95,DURATION],[OFF,OFF,[.08,.30,.05],[.04,.15,.025],OFF,OFF]);g.rotate(n,[0,t,t+.9,DURATION],[0,a,a+4,0],'z');}smoke(at,t+.08,5,strength);}
 function flash(at,t,size=1){const p=node('Muzzle_bloom',added,{translation:at});for(const angle of[0,Math.PI/2])card('Crossed_painted_muzzle','muzzle',[0,0,0],t,t+.23,size,p,Q([0,1,0],angle));smoke(at,t+.07,3,.35);}
 function projectile(kind,at,offset=0,index=0){const t=.65+offset,end=hit+offset,group=node('Travelling_'+kind+'_'+index,added,{translation:at});
 if(['arrow','bolts','harpoon'].includes(kind)){beam('Wooden_shaft',[0,0,-.5],[0,0,.45],.035,0xc99b57,group);mesh('Forged_point',cone,0x476e72,group,[0,0,.57],[.10,.25,.10],Q([1,0,0],Math.PI/2));for(const x of[-.065,.065])mesh('Coral_arrow_fletching',box,0xb66e57,group,[x,0,-.37],[.09,.03,.22]);}
 else if(kind==='disc'){mesh('Spinning_brass_disc',cylinder,0xd4af62,group,[0,0,0],[.35,.06,.35]);mesh('Disc_centre',cylinder,0x527e7b,group,[0,.04,0],[.13,.08,.13]);g.rotate(group,[0,t,end,2.3,4.2],[0,0,9,14,0],'y');}
 else if(kind==='chain'){for(const x of[-.3,.3])mesh('Linked_iron_ball',sphere,0x58656b,group,[x,0,0],[.19,.19,.19]);beam('Chain_between_balls',[-.3,0,0],[.3,0,0],.025,0xd4af62,group);g.rotate(group,[0,t,end,2,4.2],[0,0,5,7,0],'z');}
 else if(kind==='rocket'){mesh('Canvas_rocket_body',cylinder,0xf3dfb3,group,[0,0,0],[.13,.7,.13],Q([1,0,0],Math.PI/2));mesh('Teal_rocket_nose',cone,0x488783,group,[0,0,.48],[.14,.27,.14],Q([1,0,0],Math.PI/2));for(const a of[0,Math.PI/2,Math.PI,Math.PI*1.5])mesh('Wooden_rocket_fin',box,0xc49052,group,[Math.cos(a)*.12,Math.sin(a)*.12,-.3],[.07,.28,.25],Q([0,0,1],a));card('Painted_exhaust','muzzle',[0,0,-.55],t,end,1,group,Q([0,1,0],Math.PI/2));}
 else if(kind==='net'){for(let i=-3;i<=3;i++){beam('Unfolding_rope_net',[-.75,i*.25,0],[.75,i*.25,0],.016,0xc7ad76,group);beam('Unfolding_rope_net',[i*.25,-.75,0],[i*.25,.75,0],.016,0xc7ad76,group);}for(const x of[-.75,.75])for(const y of[-.75,.75])mesh('Net_corner_weight',sphere,0x526967,group,[x,y,0],[.10,.10,.10]);}
 else {mesh('Painted_projectile',sphere,kind==='mg'?0xd8b05b:0x6c7770,group,[0,0,0],kind==='mg'?[.065,.065,.22]:[.23,.23,.23]);if(kind==='mg')mesh('Teal_bullet_tip',cone,0x4f7d7c,group,[0,0,.25],[.066,.16,.066],Q([1,0,0],Math.PI/2));}
 const mid=at.map((v,i)=>(v+contact[i])*.5);if(kind==='lob')mid[1]+=3.1;
 const arrival=contact.map((v,i)=>i===2?v-.20:v);g.move(group,[0,t,(t+end)*.5,end,2.6+offset,3.7,4.2],[at,at,mid,arrival,arrival,at,at]);
 if(kind==='harpoon')g.move(group,[0,t,(t+end)*.5,end,2.0,3.2,4.2],[at,at,mid,arrival,arrival,at,at]);
 g.scale(group,[0,t,t+.025,end,end+.025,3.6,4.2],[OFF,OFF,kind==='net'?.25:1,kind==='net'?1.2:1,['net','harpoon'].includes(kind)?1:OFF,OFF,OFF]);
 if(kind==='harpoon'){const rope=beam('Extending_recovery_rope',at,contact,.012,0xbea16e);const delta=new T.Vector3(...contact).sub(new T.Vector3(...at)),len=delta.length();j.nodes[rope].translation=at;j.nodes[rope].scale=[.012,OFF,.012];// local Y cylinder, anchored by its moving centre
 g.move(rope,[0,t,end,2,3.2,4.2],[at,at,new T.Vector3(...at).addScaledVector(delta,.5).toArray(),new T.Vector3(...at).addScaledVector(delta,.5).toArray(),at,at]);g.scale(rope,[0,t,end,2,3.2,4.2],[[.012,OFF,.012],[.012,OFF,.012],[.012,len,.012],[.012,len,.012],[.012,OFF,.012],[.012,OFF,.012]]);}
 if(!['net','harpoon'].includes(kind))impact(contact,end,kind==='mg'?.7:kind==='rocket'?1.3:1);else if(kind==='harpoon')impact(contact,end,.5);
 if(!['net','arrow','bolts','harpoon'].includes(kind))flash(at,t,kind==='mg'?.7:1.2);
 return group;}
 if(['mg','bolts','rocket'].includes(mode)){const count=mode==='mg'?5:3;for(let i=0;i<count;i++)projectile(mode,start.map((v,k)=>k===0&&mode==='rocket'?v+(i-1)*.45:v),i*(mode==='mg'?.13:.18),i);}
 else if(['arrow','harpoon','lob','net','disc','chain','cannon'].includes(mode))projectile(mode,start);
 else if(['flame','steam','wind'].includes(mode)){for(let i=0;i<15;i++){const t=.65+i*.055,at=[start[0]+Math.sin(i)*.08,start[1],start[2]+.15+i*.12],n=card('Flowing_'+mode,mode==='flame'?'muzzle':'smoke',at,t,t+.8,mode==='flame'?1.6:1.2);g.move(n,[0,t,t+.7,4.2],[at,at,[at[0]+Math.sin(i)*.4,at[1]+.3,Math.min(contact[2],at[2]+4.2)],at]);}if(mode!=='wind')impact(contact,1.6,mode==='flame'?1.4:.7);else for(let i=0;i<9;i++){const p=[start[0],start[1],start[2]],n=mesh('Wind_carried_coral_leaf',sphere,i%2?0xb87051:0x91a584,undefined,p,[.045,.12,.04]);g.move(n,[0,.8,1.7,2.7,4.2],[p,p,[Math.sin(i)*1.2,p[1]+Math.cos(i)*.7,6],[Math.sin(i)*2,p[1]-1,9],p]);g.scale(n,[0,.8,.85,2.4,2.8,4.2],[OFF,OFF,[.045,.12,.04],[.045,.12,.04],OFF,OFF]);}}
 else if(mode==='electric'){for(let branch=0;branch<3;branch++){const points=Array.from({length:12},(_,i)=>[start[0]+(i===0||i===11?0:Math.sin(i*3.7+branch)*.35),start[1]+Math.sin(i*2.3+branch)*.2,start[2]+(contact[2]-start[2])*i/11]);for(let i=1;i<points.length;i++){const n=beam('Branching_copper_white_arc',points[i-1],points[i],branch===0?.026:.012,branch===0?0xffe7a4:0x9dc8b8);const base=j.nodes[n].scale;g.scale(n,[0,.6,.65,.72,.75,.85,1.0,4.2],[OFF,OFF,base,OFF,base,base,OFF,OFF]);}}impact(contact,.75,1.3);flash(start,.55,1.3);}
 else if(mode==='drop'){const n=part('individual_cloud_drop_prop_1');if(n>=0){const base=j.nodes[n].translation||[0,1.47,.21];g.move(n,[0,.6,.75,1.45,1.6,3.7,4.2],[base,base,[base[0],base[1]-.1,base[2]],[base[0],base[1]-(start[1]-.15)/s,base[2]],[base[0],base[1]-(start[1]-.15)/s,base[2]],base,base]);g.scale(n,[0,1.45,1.5,3.7,3.75,4.2],[1,1,OFF,OFF,1,1]);}impact(contact,1.45,1.5);}
 else if(mode==='shield'){const n=mesh('Incoming_review_bolt',sphere,0x586b6e,undefined,[0,start[1],6],[.09,.09,.28]);g.move(n,[0,.7,1.2,1.5,2.1,4.2],[[0,start[1],6],[0,start[1],6],contact,[contact[0]+1,contact[1]+.4,contact[2]+.8],[contact[0]+2,0,contact[2]+1.6],[0,start[1],6]]);g.scale(n,[0,.7,.72,1.9,2.1,4.2],[OFF,OFF,[.09,.09,.28],[.09,.09,.28],OFF,OFF]);card('Shield_contact_dust','impact',contact,1.2,1.65,1.5);}
 else if(mode!=='claw')impact(contact,mode==='hammer'?1.1:1.25,mode==='hammer'?1.5:.8);
 // Subtle target recoil complements, but never hides, the contact point.
 if(targetKind==='wall')g.move(target,[0,1.1,1.45,1.55,1.8,2.8,4.2],[contact,contact,contact,[contact[0],contact[1],contact[2]+.10],[contact[0],contact[1],contact[2]-.025],contact,contact]);
 // Remove a loaded source arrow while its separate travelling review prop is away.
 for(const f of mode==='arrow'?['loaded_great_arrow']:mode==='harpoon'&&!classic?['loaded_forged_harpoon']:[]){const n=part(f);if(n>=0)g.scale(n,[0,.64,.65,3.6,3.7,4.2],[1,1,OFF,OFF,1,1]);}
 const extras={title:'Cloudstitch',weapon:item.id,name:item.name,action,mode,description,duration:DURATION,fireTime:.65,contactTime:mode==='shield'?1.2:mode==='hammer'?1.1:mode==='electric'?.75:1.45,phases:['anticipation','actuation','travel_or_extension','contact_or_capture','settle'],coordinates:'+Y up; normalized review scale; source coordinates preserved under wrapper',reviewOnly:true,productionSocket:false,gameplayPhysics:false,damage:false,audio:false,standardAnimation:'glTF TRS only; embedded unlit vertex colours and painted planes; no opacity extension or runtime billboards',bindings};
 extras.flameAbundance=require('./flames.cjs').addAbundantFire(g,{mode,start,contact,added});extras.sourceNormalRepairs=g.repairs;return {bytes:g.finish(item.id+'_action',extras),extras,tracks:g.tracks.length,sourcePrefix:g.sourceBin};
}
module.exports={buildScene,DURATION};
