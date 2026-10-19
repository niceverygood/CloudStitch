/* Cloudstitch route-life props, dramatic revision r2 (2026-10-18).
 * Applies the user's latest "10배 이상 과감/극적/풍성" expression target through
 * large asymmetric functional masses, overlapping cloth, tiered timber and
 * independently delayed motion. This is not a uniform scale/part-count change.
 * Original, untextured vertex-painted geometry.
 * Visual concept assemblies only: no loot, collision, economy, or mission rules.
 * Dependency and GLB export are owned by the map-atmosphere integration harness.
 */

export const assets = [
  { id:'mail-balloon', name_ko:'바람우편 부양낭', category:'props', role:'크림 기낭과 수선 천 아래 가죽 우편 가방이 매달린 항로의 작은 생활 장면.', motion_ko:'우편 가방이 줄 아래에서 천천히 흔들립니다.' },
  { id:'patch-envelope', name_ko:'항로 기낭 수선대', category:'props', role:'찢어진 소형 부양낭과 수선 천·실패·고정끈을 보여 주는 정비 소품.', motion_ko:'정적 수선대. 완성 함선이나 실제 수리 기능은 아닙니다.' },
  { id:'lightning-mast', name_ko:'나선 피뢰 관측주', category:'props', role:'겹절연체와 구리봉, 보호망, 케이블을 갖춘 폭풍 항로의 시각 표지.', motion_ko:'정적 관측주. 번개 포집·피해·전력 기능은 구현하지 않습니다.' },
  { id:'cargo-crane', name_ko:'목재 항로 하역기', category:'props', role:'겹목재 받침과 황동 윈치·도르래·그물 상자가 읽히는 작은 크레인.', motion_ko:'매달린 화물과 아래 고리가 관성으로 조금씩 흔들립니다.' },
  { id:'lantern-buoy', name_ko:'왕관등 항로 부표', category:'props', role:'작은 부력낭과 왕관형 황동등·리본·균형추가 층을 이루는 항로 등.', motion_ko:'전체 부표가 떠오르고 내려오며 긴 리본이 늦게 따라 흔들립니다.' },
  { id:'wind-ribbon-mast', name_ko:'겹리본 풍향 표주', category:'props', role:'여러 높이의 천 리본, 깃털 풍향계와 황동 종을 가진 바람 표지.', motion_ko:'리본과 작은 종이 엇갈린 주기로 흔들립니다.' },
  { id:'supper-deck', name_ko:'한 잔 쉬어가는 갑판', category:'props', role:'접이 탁자·주전자·잔·빈 의자·수선 차양·등을 겹친 작은 생활 갑판.', motion_ko:'차양 아래 황동등이 작게 흔들립니다. 인물은 포함하지 않습니다.' },
  { id:'star-lanterns', name_ko:'별길 종이풍등', category:'props', role:'크기가 다른 종이풍등 세 개와 대나무 갈비·별지도 기구를 묶은 야간 소품.', motion_ko:'세 풍등이 서로 다른 높이와 리듬으로 천천히 떠 있습니다.' },
];

export function build(spec, k) {
  const {THREE,root,palette:p,mesh,group,box,bevelBox,cylinder,sphere,tube,rope,deck,cloth}=k;
  const clips=[];
  const leather=0x946044, leatherDark=0x623f33, copper=0xb66c45;
  const cream=p.cream, brass=p.brass, teal=p.teal, coral=p.coral;
  const up=new THREE.Vector3(0,1,0);

  const at=(g,v)=>{g.position.set(...v);return g;};
  function round(name,r,w,pos,col=brass,parent=root,horizontal=false){
    const m=mesh(name,new THREE.TorusGeometry(r,w,5,28),col,parent);
    m.position.set(...pos);if(horizontal)m.rotation.x=Math.PI/2;return m;
  }
  function orb(name,pos,scale,col=cream,parent=root){
    const m=mesh(name,new THREE.SphereGeometry(1,24,14),col,parent);
    m.position.set(...pos);m.scale.set(...scale);return m;
  }
  function beam(name,a,b,width,col=brass,parent=root,wood=false){
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);
    const m=wood?bevelBox(name,[width,d.length(),width],av.add(bv).multiplyScalar(.5).toArray(),col,parent)
      :cylinder(name,width,width,d.length(),av.add(bv).multiplyScalar(.5).toArray(),col,parent,10);
    m.quaternion.setFromUnitVectors(up,d.normalize());return m;
  }
  function swing(target,axis,amp,duration=5,phase=0){
    const times=[0,.10,.24,.43,.63,.82,1].map(t=>t*duration);
    const pattern=[0,-.2,1,-.56,.3,-.12,0];
    const values=[];const q0=target.quaternion.clone();
    for(let i=0;i<times.length;i++){
      const wave=pattern[i]*Math.cos(phase)+Math.sin(i/6*Math.PI*2)*Math.sin(phase)*.55;
      const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis).normalize(),wave*amp);
      q.premultiply(q0);values.push(...q.toArray());
    }
    clips.push(new THREE.AnimationClip(`${spec.id}_gentle_swing_${clips.length}`,duration,[new THREE.QuaternionKeyframeTrack(`${target.name}.quaternion`,times,values)]));
  }
  function float(target,height,duration=6,phase=0){
    const base=target.position.clone(),times=[0,duration*.25,duration*.5,duration*.75,duration],values=[];
    for(let i=0;i<5;i++)values.push(base.x,base.y+Math.sin(i*Math.PI*.5+phase)*height,base.z);
    clips.push(new THREE.AnimationClip(`${spec.id}_floating_${clips.length}`,duration,[new THREE.VectorKeyframeTrack(`${target.name}.position`,times,values)]));
  }
  function sailWing(name,pos,w,h,col,parent=root){
    const g=at(group(name,parent),pos),vertices=[],indices=[],nx=12,ny=6;
    const sample=(u,v)=>[u*w,Math.sin(u*Math.PI*.8)*h*.52+v*h*Math.pow(Math.sin(Math.PI*u),.6),Math.sin(u*Math.PI)*.33*w+Math.sin(v*Math.PI)*.12*w];
    for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)vertices.push(...sample(x/nx,y/ny-.5));
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=y*(nx+1)+x;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);
    mesh('broad_bowed_handmade_sail',geo,col,g);
    for(const v of [-.5,0,.5])tube('large_curved_sail_seam',Array.from({length:9},(_,i)=>sample(i/8,v)),.014,p.woodLight,g);
    for(const u of [.22,.5,.77])tube('sail_batten',Array.from({length:5},(_,i)=>sample(u,i/4-.5)),.018,brass,g);
    return g;
  }
  function copperSpiral(name,center,radius,height,turns,parent=root){
    const points=[];for(let i=0;i<=56;i++){const t=i/56,a=t*Math.PI*2*turns;points.push([center[0]+Math.cos(a)*radius,center[1]+t*height,center[2]+Math.sin(a)*radius]);}
    return tube(name,points,.047,copper,parent);
  }
  function crescent(name,pos,r,col,parent=root){
    const shape=new THREE.Shape();shape.absarc(0,0,r,Math.PI*.32,Math.PI*1.68,false);
    shape.bezierCurveTo(-r*.46,-r*.54,-r*.46,r*.54,Math.cos(Math.PI*.32)*r,Math.sin(Math.PI*.32)*r);
    const m=mesh(name,new THREE.ExtrudeGeometry(shape,{depth:r*.16,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:r*.025,bevelThickness:r*.025,curveSegments:16}),col,parent);m.position.set(...pos);return m;
  }
  function stitchedPatch(name,pos,size,parent=root,rotation=0){
    const g=at(group(name,parent),pos);g.rotation.z=rotation;
    bevelBox('coral_patch_cloth',[size[0],size[1],.022],[0,0,.008],coral,g);
    for(const s of [-1,1]){
      for(let i=0;i<6;i++){
        const x=(i/5-.5)*size[0]*.87;
        const stitch=box('cream_cross_stitch',[.024,.065,.012],[x,s*size[1]*.49,.027],cream,g);stitch.rotation.z=.25;
      }
      for(let i=0;i<4;i++){
        const y=(i/3-.5)*size[1]*.75;
        const stitch=box('cream_side_stitch',[.07,.02,.012],[s*size[0]*.48,y,.027],cream,g);stitch.rotation.z=-.18;
      }
    }
    return g;
  }
  function balloon(name,pos,scale,parent=root,patch=true){
    const g=at(group(name,parent),pos);g.scale.set(...scale);
    orb('voluminous_canvas',[0,0,0],[1,1.16,.86],cream,g);
    // Bulging gore panels are traced by curved stitched ropes, not hard stripes.
    for(let a=0;a<8;a++){
      const angle=a*Math.PI/4,pts=[];
      for(let j=0;j<=10;j++){
        const t=.1+(Math.PI-.2)*j/10;
        pts.push([Math.sin(t)*Math.sin(angle)*1.006,Math.cos(t)*1.168,Math.sin(t)*Math.cos(angle)*.866]);
      }
      tube('curved_balloon_gore',pts,.011,p.woodLight,g);
    }
    cylinder('gathered_balloon_neck',.18,.13,.26,[0,-1.14,0],p.honey,g,16);
    round('brass_neck_collar',.16,.035,[0,-1.21,0],brass,g,true);
    if(patch)stitchedPatch('large_visible_repair',[.24,-.02,.835],[.48,.48],g,-.16);
    // Small tan tabs are painted canvas reinforcements around the skirt.
    for(const x of [-.55,.55])for(const z of [-.47,.47])
      bevelBox('rigging_canvas_tab',[.12,.24,.055],[x,-.82,z],p.woodLight,g);
    return g;
  }
  function pendantLantern(name,pos,parent=root,size=1){
    const g=at(group(name,parent),pos);g.scale.setScalar(size);
    round('lantern_top_eye',.085,.02,[0,.4,0],brass,g);
    cylinder('curved_teal_lantern_roof',.04,.25,.19,[0,.25,0],teal,g,12);
    orb('warm_painted_glow',[0,-.02,0],[.18,.26,.18],p.amber,g);
    cylinder('lantern_base',.22,.17,.09,[0,-.29,0],brass,g,12);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3,x=Math.sin(a)*.19,z=Math.cos(a)*.19;
      beam('curved_lantern_rib',[x,-.27,z],[x,.2,z],.018,brass,g);
    }
    round('lantern_mid_brace',.195,.014,[0,-.06,0],brass,g,true);
    return g;
  }
  function ribbon(name,pos,length,width,col,parent=root){
    const g=at(group(name,parent),pos),verts=[],idx=[],rows=10;
    for(let j=0;j<=rows;j++){
      const t=j/rows,center=Math.sin(t*5)*.13*length,depth=Math.sin(t*6.5)*.13*length;
      const taper=1-t*.3;
      for(const s of [-1,1])verts.push(center+s*width*.5*taper,-t*length+(j===rows?width*.23:0),depth+s*width*.08*Math.sin(t*4));
    }
    for(let i=0;i<rows;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(idx);
    mesh('fluttering_fabric',geo,col,g);
    const edge=[];for(let j=0;j<=rows;j++){const o=j*6;edge.push([verts[o],verts[o+1],verts[o+2]]);}
    tube('ribbon_stitched_edge',edge,.008,p.woodLight,g);
    return g;
  }
  function crate(name,pos,parent=root,size=[.8,.65,.7]){
    const g=at(group(name,parent),pos),[w,h,d]=size;
    bevelBox('soft_crate_core',[w,h,d],[0,0,0],p.woodDark,g);
    for(let i=0;i<4;i++){
      const x=(i/3-.5)*w*.75;
      bevelBox('front_crate_plank',[w*.23,h,.055],[x,0,d*.5],i%2?p.honey:p.woodLight,g);
      bevelBox('rear_crate_plank',[w*.23,h,.055],[x,0,-d*.5],p.honey,g);
      box('front_plank_grain',[.012,h*.6,.007],[x+.027,.025,d*.5+.032],p.woodDark,g);
    }
    for(const x of [-w*.38,w*.38]){
      bevelBox('crate_binding_strap',[.055,h+.035,d+.09],[x,0,0],teal,g);
      for(const y of [-h*.3,h*.3])cylinder('crate_brass_stud',.025,.025,.02,[x,y,d*.5+.06],brass,g,8).rotation.x=Math.PI/2;
    }
    const brace=bevelBox('diagonal_wood_brace',[w*.97,.075,.045],[0,0,d*.5+.055],p.honey,g);brace.rotation.z=.52;
    return g;
  }
  function ropeCoil(name,pos,r=.2,parent=root){
    const pts=[];for(let i=0;i<=60;i++){const t=i/60,a=t*Math.PI*6,rad=r*(1-t*.55);pts.push([Math.cos(a)*rad,.014*Math.sin(t*Math.PI),Math.sin(a)*rad]);}
    const g=at(group(name,parent),pos);tube('coiled_hemp_rope',pts,.018,cream,g);return g;
  }
  function spool(name,pos,parent=root){
    const g=at(group(name,parent),pos);
    cylinder('wood_spool_top',.15,.15,.045,[0,.14,0],p.woodLight,g);
    cylinder('thick_coiled_thread',.105,.105,.25,[0,0,0],coral,g,16);
    cylinder('wood_spool_bottom',.15,.15,.045,[0,-.14,0],p.honey,g);
    for(let i=0;i<4;i++)round('thread_loop',.107,.01,[0,(i-1.5)*.047,0],p.flower,g,true);
    return g;
  }

  if(spec.id==='mail-balloon'){
    balloon('cream_mail_float',[0,1.38,0],[1.18,1.18,1.12]);
    const broadLeft=sailWing('great_crescent_tail_port',[-.65,1.22,-.12],2.05,1.34,coral);broadLeft.rotation.y=Math.PI-.22;broadLeft.rotation.z=-.1;
    const broadRight=sailWing('high_cream_tail_starboard',[.62,1.65,-.1],1.6,1.04,p.ivory);broadRight.rotation.y=.2;broadRight.rotation.z=.18;
    const lowerFin=sailWing('lower_teal_stabiliser',[-.3,.7,-.3],1.3,.66,teal);lowerFin.rotation.y=-.15;lowerFin.rotation.z=-.55;
    tube('oversized_outer_balloon_harness',[[-.86,2.1,.63],[-1.17,1.18,.42],[-.83,.3,.38],[0,-.05,.25],[.83,.3,.38],[1.17,1.18,.42],[.86,2.1,.63]],.033,leather);
    swing(broadLeft,[0,1,0],.15,7,.9);swing(broadRight,[0,1,0],.11,7.6,1.5);swing(lowerFin,[1,0,0],.12,6.1,.2);
    const hanging=at(group('suspended_satchel_pivot'),[0,-.04,0]);
    const bag=at(group('large_leather_postbag',hanging),[0,-1.42,0]);bag.rotation.z=-.065;
    bevelBox('rounded_leather_satchel',[1.16,.91,.48],[0,0,0],leather,bag);
    orb('soft_bag_bottom',[0,-.34,0],[.55,.23,.225],leather,bag);
    const flap=bevelBox('oversized_rounded_flap',[1.18,.46,.08],[0,.23,.27],leatherDark,bag);flap.rotation.x=.05;
    tube('flap_cream_seam',[[-.52,.4,.322],[-.49,.09,.331],[0,-.03,.332],[.49,.09,.331],[.52,.4,.322]],.012,p.woodLight,bag);
    for(const x of [-.33,.33]){
      bevelBox('long_bag_strap',[.13,.91,.045],[x,.01,.34],p.honey,bag);
      round('round_brass_buckle',.09,.027,[x,-.02,.382],brass,bag);
      beam('buckle_tongue',[x,-.085,.382],[x,.045,.382],.012,brass,bag);
      for(let i=0;i<3;i++)sphere('leather_punch_hole',.015,[x,-.18-i*.075,.369],leatherDark,bag);
    }
    // Separate curved carry handle and side gussets keep the satchel volumetric.
    tube('arched_leather_carry_handle',[[-.25,.46,0],[-.23,.72,0],[0,.8,0],[.23,.72,0],[.25,.46,0]],.042,leatherDark,bag);
    for(const s of [-1,1]){
      bevelBox('padded_bag_gusset',[.07,.65,.4],[s*.58,-.04,0],p.honey,bag);
      round('rigging_satchel_eye',.09,.025,[s*.52,.49,0],brass,bag);
      rope('suspending_mail_rope',[[s*.65,.45,.53],[s*.72,-.5,.28],[s*.53,-.89,0]],hanging);
      rope('rear_suspending_mail_rope',[[s*.65,.45,-.53],[s*.7,-.49,-.26],[s*.53,-.89,0]],hanging);
      for(let i=0;i<6;i++)box('hand_sewn_bag_edge',[.035,.011,.011],[s*.55,-.3+i*.11,.3],cream,bag);
    }
    const tag=at(group('paper_tag',bag),[.61,.2,.25]);tag.rotation.z=-.3;
    bevelBox('blank_postal_tag',[.25,.34,.018],[0,-.11,0],cream,tag);
    round('tag_reinforced_eye',.025,.009,[0,.02,.016],brass,tag);
    rope('tag_twine',[[0,.08,0],[.04,.16,0],[-.04,.23,0]],tag);
    for(const q of [{x:-.7,y:-.12,w:.47,h:.65,z:.08},{x:.68,y:.04,w:.42,h:.47,z:.08}]){
      const pouch=at(group('layered_outboard_mail_pouch',bag),[q.x,q.y,q.z]);pouch.rotation.z=q.x<0?-.16:.2;
      bevelBox('bulky_secondary_leather_pouch',[q.w,q.h,.39],[0,0,0],q.x<0?teal:leather,pouch);
      orb('pouch_soft_flap',[0,q.h*.31,.2],[q.w*.52,q.h*.22,.06],leatherDark,pouch);
      bevelBox('large_pouch_strap',[.09,q.h*.78,.035],[0,-.015,.25],p.honey,pouch);
      round('pouch_oval_buckle',.07,.023,[0,-.07,.29],brass,pouch);
      tube('wide_satchel_side_handle',[[-.16,q.h*.4,0],[-.11,q.h*.7,0],[.11,q.h*.7,0],[.16,q.h*.4,0]],.026,leatherDark,pouch);
    }
    // No fake writing, emblem, or system meaning is assigned to the tag.
    swing(hanging,[0,0,1],.085,6);swing(tag,[0,1,0],.12,4.8);
  }

  if(spec.id==='patch-envelope'){
    const stand=at(group('repair_frame'),[0,-.75,0]);
    deck('small_work_platform',3.2,2.1,[0,0,0],stand);
    for(const x of [-1.2,1.2]){
      beam('arched_repair_frame_front',[x,.07,.71],[x,2.52,.53],.1,teal,stand,true);
      beam('repair_frame_rear_foot',[x,-.12,-.85],[x,1.45,-.28],.07,p.honey,stand,true);
      beam('repair_frame_diagonal',[x,1.9,.53],[x,0,-.75],.045,brass,stand);
      round('frame_rope_eye',.085,.02,[x,2.5,.56],brass,stand);
    }
    beam('upper_crossbar',[-1.3,2.58,.51],[1.3,2.58,.51],.085,p.honey,stand,true);
    // An incomplete cloth envelope has a visibly jagged opening and exposed hoops.
    const envelope=at(group('torn_small_envelope',stand),[0,1.57,0]);envelope.rotation.z=-.16;
    const verts=[],idx=[],segs=20,rows=9;
    for(let y=0;y<=rows;y++){
      const t=y/rows,rad=.42+.43*Math.sin(t*Math.PI*.92),yy=(t-.5)*1.55;
      for(let a=0;a<=segs;a++){
        const angle=a/segs*Math.PI*1.69+.48;
        const tear=a===segs?((y%3)-1)*.1:0;
        verts.push(Math.sin(angle)*(rad+tear),yy,Math.cos(angle)*(rad+tear)*.82);
      }
    }
    for(let y=0;y<rows;y++)for(let a=0;a<segs;a++){
      const q=y*(segs+1)+a;idx.push(q,q+segs+1,q+1,q+1,q+segs+1,q+segs+2);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(idx);
    mesh('open_ripped_canvas_envelope',geo,cream,envelope);
    for(const y of [-.52,0,.52])round('exposed_internal_hoop',.64-.15*Math.abs(y),.016,[0,y,0],p.honey,envelope,true).scale.z=.82;
    for(let i=0;i<5;i++){
      const a=-Math.PI*.75+i*.37,pts=[];
      for(let j=0;j<=6;j++){const t=j/6,rad=.42+.43*Math.sin(t*Math.PI*.92);pts.push([Math.sin(a)*rad,(t-.5)*1.55,Math.cos(a)*rad*.83]);}
      tube('visible_envelope_gore',pts,.012,p.woodLight,envelope);
    }
    stitchedPatch('half_sewn_repair_patch',[.35,.13,.65],[.55,.54],envelope,-.18);
    const tornWing=sailWing('opened_giant_envelope_panel',[-.25,.22,.26],1.6,1.18,cream,envelope);tornWing.rotation.y=-.55;tornWing.rotation.z=.25;
    const backing=sailWing('folded_coral_backing_panel',[-.3,-.22,.12],1.35,.95,coral,envelope);backing.rotation.y=Math.PI+.3;backing.rotation.z=-.25;
    tube('exposed_large_envelope_rib',[[-1.3,.55,.2],[-.88,1.18,-.02],[0,1.38,-.1],[.88,1.18,-.02],[1.4,.43,.3]],.038,p.honey,envelope);
    for(const s of [-1,1]){
      beam('foldout_repair_sawhorse',[s*1.35,.08,.92],[s*1.75,1.36,.22],.075,p.honey,stand,true);
      beam('foldout_repair_sawhorse_return',[s*1.85,.08,-.57],[s*1.75,1.36,.22],.075,p.honey,stand,true);
      beam('foldout_canvas_support',[s*1.7,1.4,.2],[s*.94,2.1,.15],.04,brass,stand);
      round('large_folding_hinge',.13,.03,[s*1.75,1.32,.28],brass,stand);
    }
    tube('hanging_open_suture',[[.56,.36,.69],[.81,.26,.7],[.86,-.12,.67],[.61,-.15,.68]],.013,coral,envelope);
    for(const s of [-1,1])rope('frame_holding_tie',[[s*1.2,2.49,.55],[s*.92,2.11,.12],[s*.56,2,.04]],stand);
    const folded=cloth('spare_repair_canvas',.75,.57,[-.75,.08,-.55],stand);folded.rotation.z=.12;
    spool('large_thread_spool',[.82,.28,.58],stand);
    spool('small_thread_spool',[1.12,.22,.2],stand).scale.setScalar(.7);
    ropeCoil('loose_tying_rope',[-.85,.11,.6],.27,stand);
    const toolbox=at(group('open_needle_box',stand),[.6,.12,-.65]);
    bevelBox('needle_box_tray',[.75,.16,.4],[0,0,0],teal,toolbox);
    bevelBox('needle_box_dark_inner',[.61,.03,.28],[0,.09,0],p.woodDark,toolbox);
    const lid=bevelBox('open_wood_toolbox_lid',[.76,.045,.4],[0,.24,-.32],p.woodLight,toolbox);lid.rotation.x=-.9;
    beam('large_curved_needle',[-.25,.13,.07],[.2,.13,-.06],.009,brass,toolbox);
    round('needle_eye',.035,.009,[-.24,.13,.07],brass,toolbox,true);
  }

  if(spec.id==='lightning-mast'){
    const base=at(group('storm_pedestal'),[0,-1.85,0]);
    deck('storm_mast_deck',2.65,2.25,[0,0,0],base);
    for(const x of [-.8,.8])for(const z of [-.66,.66]){
      beam('splayed_mast_support',[x,.08,z],[x*.3,1.05,z*.3],.075,teal,base,true);
      cylinder('copper_deck_foot',.15,.17,.11,[x,.1,z],copper,base,10);
    }
    cylinder('teal_mast_pedestal',.43,.61,.5,[0,.3,0],teal,base,16);
    cylinder('mast_copper_collar',.39,.43,.15,[0,.64,0],copper,base,20);
    cylinder('central_brass_spine',.065,.11,3.74,[0,2.42,0],brass,base,12);
    for(const x of [-.65,0,.65]){
      const height=x===0?3.6:2.65;
      cylinder('insulator_stack_spindle',.045,.045,height-.4,[x,(height+.4)/2,0],copper,base,12);
      for(let i=0;i<(x===0?11:8);i++){
        const y=.94+i*.19;
        cylinder('flared_cream_ceramic_skirt',.12,.23,.115,[x,y,0],p.ivory,base,16);
        round('insulator_painted_rim',.218,.015,[x,y-.04,0],p.stoneLight,base,true);
      }
      cylinder('copper_stack_crown',.16,.18,.13,[x,height-.12,0],copper,base,12);
      const tip=mesh('pointed_copper_terminal',new THREE.ConeGeometry(.085,.42,12),copper,base);tip.position.set(x,height+.16,0);
      orb('terminal_brass_bead',[x,height-.01,0],[.12,.12,.12],brass,base);
    }
    copperSpiral('grand_central_copper_helix',[0,1.1,-.08],.49,2.75,4.2,base);
    copperSpiral('asymmetric_left_helix',[-.96,.8,-.14],.32,1.85,2.7,base);
    copperSpiral('high_side_capture_helix',[.94,1.28,-.18],.33,2.12,3.1,base);
    for(const y of [1.08,1.82,2.56,3.3]){
      cylinder('oversized_disk_insulator',.31,.46,.16,[0,y,-.08],p.ivory,base,20);
      round('broad_disk_copper_lip',.445,.025,[0,y-.055,-.08],copper,base,true);
    }
    tube('swept_copper_left_terminal',[[-.35,2.2,-.13],[-1.25,2.45,-.13],[-1.5,3.33,-.13],[-1.26,4.04,-.13]],.075,copper,base);
    tube('swept_copper_right_terminal',[[.35,2.85,-.13],[1.3,3.1,-.13],[1.58,3.87,-.13],[1.38,4.42,-.13]],.065,copper,base);
    for(const q of [[-1.26,4.04,-.13],[1.38,4.42,-.13]]){
      orb('large_terminal_bulb',q,[.16,.2,.16],brass,base);
      cylinder('long_fine_terminal_tip',.017,.058,.58,[q[0],q[1]+.38,q[2]],copper,base,10);
    }
    beam('wide_arched_coil_crossarm',[-1.05,.8,-.15],[1.04,1.25,-.15],.075,teal,base,true);
    beam('wide_enamel_crossarm',[-.9,.75,0],[.9,.75,0],.085,teal,base,true);
    // Open mesh on the lower front guards the coils while leaving their silhouette visible.
    for(const x of [-1.04,1.04])beam('windmesh_sidepost',[x,.15,.55],[x,1.22,.55],.038,copper,base);
    for(const y of [.2,.45,.7,.95,1.2])beam('windmesh_horizontal',[-1.04,y,.55],[1.04,y,.55],.013,brass,base);
    for(let i=0;i<9;i++)beam('windmesh_vertical',[-.96+i*.24,.2,.55],[-.96+i*.24,1.2,.55],.012,brass,base);
    for(const x of [-.65,.65]){
      tube('sagging_storm_cable',[[x,2.58,-.03],[x+.13,2.2,-.23],[x+.18,.65,-.32],[x*1.4,.2,-.7]],.036,p.ink,base);
      rope('taut_mast_guy',[[0,3.6,0],[x*1.65,.12,-.85]],base);
    }
    const gauge=at(group('enclosed_brass_gauge',base),[.55,.6,.3]);
    cylinder('gauge_body',.2,.2,.09,[0,0,0],brass,gauge,20).rotation.x=Math.PI/2;
    cylinder('cream_gauge_face',.16,.16,.012,[0,0,.055],cream,gauge,20).rotation.x=Math.PI/2;
    beam('single_gauge_pointer',[0,0,.07],[.08,.1,.07],.012,p.ink,gauge);
    for(let i=0;i<7;i++){const a=-Math.PI*.68+i*Math.PI*.23;beam('painted_gauge_tick',[Math.sin(a)*.115,Math.cos(a)*.115,.071],[Math.sin(a)*.14,Math.cos(a)*.14,.071],.006,p.ink,gauge);}
    ropeCoil('grounding_cable_coil',[-.75,.12,-.5],.26,base);
  }

  if(spec.id==='cargo-crane'){
    const base=at(group('crane_assembly'),[-.45,-1.45,0]);
    deck('layered_crane_plinth',2.6,2,[0,0,0],base);
    for(const z of [-.63,.63]){
      beam('heavy_laminated_crane_post',[-.55,.1,z],[-.55,3.0,z],.19,p.honey,base,true);
      beam('diagonal_rear_crane_brace',[-1.05,.15,z],[-.55,2.05,z],.12,p.woodDark,base,true);
      beam('long_upper_jib',[-.74,2.97,z],[2.0,3.22,z*.5],.14,p.woodLight,base,true);
      beam('lower_jib_brace',[-.55,1.72,z],[1.5,3.15,z*.52],.09,p.honey,base,true);
      for(const y of [.5,1.15,1.8,2.5])bevelBox('copper_post_binding',[.44,.11,.43],[-.55,y,z],copper,base);
      for(let i=0;i<3;i++)box('painted_post_grain',[.012,1.06,.01],[-.57+i*.06,1.6,z+.103],p.woodDark,base);
    }
    beam('crane_front_crosshead',[-.55,2.97,-.8],[-.55,2.97,.8],.11,teal,base,true);
    tube('great_curved_laminated_crane_backbone',[[-.88,.14,-.03],[-1.12,1.25,-.03],[-1.03,2.75,-.03],[-.18,3.72,-.03],[1.27,3.91,-.03],[2.19,3.36,-.03]],.18,p.honey,base);
    tube('teal_curved_backbone_strap',[[-.88,.16,.16],[-1.11,1.25,.16],[-1.02,2.73,.16],[-.17,3.7,.16],[1.27,3.88,.16],[2.17,3.36,.16]],.039,teal,base);
    const auxiliary=at(group('outboard_auxiliary_winch',base),[-1.17,1.21,.83]);
    cylinder('large_auxiliary_rope_drum',.27,.27,.6,[0,0,0],cream,auxiliary,16).rotation.x=Math.PI/2;
    for(const z of [-.35,.35])round('auxiliary_winch_brass_flange',.36,.045,[0,0,z],brass,auxiliary);
    beam('asymmetric_auxiliary_handle',[0,0,.43],[-.35,.26,.43],.039,brass,auxiliary);
    beam('large_auxiliary_wood_grip',[-.35,.26,.43],[-.35,.26,.73],.065,p.woodDark,auxiliary);
    rope('supporting_auxiliary_jib_line',[[-1.17,1.4,.83],[-1.0,3.0,.49],[1.4,3.85,.2],[2.1,3.35,.2]],base);
    beam('far_pulley_axle',[2.0,3.24,-.46],[2.0,3.24,.46],.07,brass,base);
    for(const z of [-.36,.36]){
      round('heavy_tip_pulley',.21,.047,[2,3.22,z],brass,base);
      cylinder('pulley_wood_core',.15,.15,.09,[2,3.22,z],p.woodDark,base,16).rotation.x=Math.PI/2;
    }
    const winch=at(group('oversized_hand_winch',base),[-.55,.75,.15]);
    const barrel=cylinder('winch_rope_drum',.3,.3,.91,[0,0,0],p.woodDark,winch,16);barrel.rotation.x=Math.PI/2;
    for(let i=0;i<8;i++)round('thick_drum_rope_wrap',.31,.033,[0,0,-.37+i*.105],cream,winch);
    for(const z of [-.5,.5]){
      const flange=cylinder('teal_winch_flange',.4,.4,.07,[0,0,z],teal,winch,16);flange.rotation.x=Math.PI/2;
      for(let i=0;i<6;i++){const a=i*Math.PI/3;beam('brass_winch_spoke',[0,0,z+.04],[Math.cos(a)*.31,Math.sin(a)*.31,z+.04],.022,brass,winch);}
    }
    beam('winch_handle_arm',[0,0,.61],[.42,.24,.61],.04,brass,winch);
    beam('wood_winch_handle',[.42,.24,.61],[.42,.24,.93],.075,p.honey,winch);
    rope('upward_running_hoist',[[-.25,.9,.2],[-.14,2.9,.3],[1.95,3.4,.31]],base);
    const load=at(group('suspended_load_pivot',base),[2,3.22,0]);
    rope('double_hoist_drop',[[0,0,.3],[0,-1.27,.24]],load);
    rope('rear_hoist_drop',[[0,0,-.3],[0,-1.27,-.24]],load);
    round('large_load_hook_eye',.095,.028,[0,-1.36,.03],brass,load);
    tube('open_curved_cargo_hook',[[0,-1.42,.03],[-.12,-1.54,.03],[-.11,-1.72,.03],[.06,-1.76,.03],[.16,-1.64,.03]],.037,brass,load);
    crate('suspended_plank_cargo',[0,-2.22,0],load,[1.0,.78,.83]);
    deck('two_tier_hanging_cargo_shelf',1.33,1.16,[0,-2.69,0],load);
    deck('upper_hanging_cargo_frame',1.33,1.16,[0,-1.75,0],load);
    for(const x of [-.6,.6])for(const z of [-.51,.51])beam('two_tier_cargo_cage_post',[x,-2.68,z],[x,-1.73,z],.047,teal,load);
    crate('offset_top_small_delivery_box',[-.28,-1.5,-.11],load,[.58,.45,.64]);
    for(const x of [-.42,.42])for(const z of [-.35,.35])rope('four_corner_sling',[[0,-1.69,0],[x,-1.89,z],[x,-2.61,z]],load);
    for(const x of [-.4,.4])rope('under_crate_sling',[[x,-1.88,.4],[x,-2.66,.42],[x,-2.67,-.42],[x,-1.88,-.4]],load);
    ropeCoil('crane_spare_rope',[-.1,.12,-.56],.29,base);
    pendantLantern('crane_evening_lamp',[-.58,2.2,.95],base,.58);
    swing(load,[0,0,1],.065,6.4);
  }

  if(spec.id==='lantern-buoy'){
    const buoy=at(group('floating_crown_buoy'),[0,.3,0]);
    balloon('small_patched_buoy_float',[0,1.3,0],[.77,.71,.76],buoy,true);
    for(const s of [-1,1]){
      rope('buoy_suspension_front',[[s*.43,.72,.35],[s*.5,-.11,.34],[s*.36,-.33,.28]],buoy);
      rope('buoy_suspension_back',[[s*.43,.72,-.35],[s*.5,-.11,-.34],[s*.36,-.33,-.28]],buoy);
    }
    const lamp=pendantLantern('large_crowned_route_lantern',[0,-.64,0],buoy,1.8);
    for(const q of [{r:.58,y:.36,c:teal},{r:.49,y:.54,c:brass},{r:.35,y:.72,c:teal}]){
      cylinder('grand_pagoda_lantern_canopy',.055,q.r,.19,[0,q.y,0],q.c,lamp,16);
      round('layered_lantern_roof_eave',q.r,.025,[0,q.y-.095,0],brass,lamp,true);
    }
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3+.3,x=Math.cos(a)*.98,z=Math.sin(a)*.98;
      const side=balloon('three_way_balancing_air_pod',[x,1.08,z],[.37,.43,.37],buoy,i===0);
      beam('triangular_buoy_outrigger',[x*.3,.48,z*.3],[x,.77,z],.043,brass,buoy);
      rope('upper_pod_tying_line',[[x*.35,1.7,z*.35],[x,1.1,z]],buoy);
      swing(side,[0,0,1],.08,7+i*.6,i*.5);
    }
    round('wide_crown_rim',.45,.032,[0,.49,0],brass,lamp,true);
    for(let i=0;i<7;i++){
      const a=i*Math.PI*2/7;
      tube('flared_crown_point',[[Math.sin(a)*.29,.32,Math.cos(a)*.29],[Math.sin(a)*.45,.64,Math.cos(a)*.45],[Math.sin(a+.28)*.4,.47,Math.cos(a+.28)*.4]],.02,brass,lamp);
      orb('crown_tip_bead',[Math.sin(a)*.45,.64,Math.cos(a)*.45],[.04,.04,.04],p.amber,lamp);
    }
    const ribbonA=ribbon('long_coral_streamer',[-.56,-.14,.1],1.55,.22,coral,buoy);
    const ribbonB=ribbon('teal_split_streamer',[.53,-.2,-.03],1.28,.18,teal,buoy);
    const weight=at(group('hanging_balance_weight',buoy),[0,-1.37,0]);
    rope('weight_suspension',[[0,0,0],[.04,-.38,0]],weight);
    orb('acorn_balance_weight',[.04,-.65,0],[.17,.28,.17],p.woodDark,weight);
    cylinder('brass_weight_cap',.18,.21,.11,[.04,-.46,0],brass,weight);
    round('weight_lower_ring',.1,.024,[.04,-.91,0],brass,weight);
    float(buoy,.12,6.8);swing(ribbonA,[0,0,1],.16,4.8,.7);swing(ribbonB,[1,0,0],.14,5.6,1.1);
  }

  if(spec.id==='wind-ribbon-mast'){
    const post=at(group('wind_standard'),[0,-1.8,0]);
    const base=deck('tiny_wind_marker_deck',1.8,1.5,[0,0,0],post);base.rotation.y=.12;
    cylinder('octagonal_teal_socket',.27,.42,.45,[0,.24,0],teal,post,8);
    cylinder('tapered_tall_wood_mast',.065,.115,3.6,[0,2.1,0],p.honey,post,12);
    for(let i=0;i<5;i++)round('mast_rope_collar',.115-i*.007,.017,[0,.65+i*.63,0],cream,post,true);
    for(const x of [-.65,.65])rope('marker_guy_lines',[[0,2.7,0],[x,.1,-.48]],post);
    const levels=[{y:3.35,x:1.04,l:1.08,c:coral},{y:2.64,x:-.86,l:.91,c:teal},{y:1.94,x:.74,l:.74,c:p.amber}];
    for(let i=0;i<levels.length;i++){
      const q=levels[i];beam('asymmetric_banner_crossarm',[-q.x*.3,q.y,0],[q.x,q.y,0],.035,brass,post);
      orb('crossarm_finial',[q.x,q.y,0],[.075,.075,.075],brass,post);
      for(let j=0;j<3;j++){
        const x=q.x*(.33+j*.27),r=ribbon('individual_loose_wind_ribbon',[x,q.y-.025,.03],q.l*(1-j*.12)*1.25,.32+i*.025,j===1?p.cream:q.c,post);
        swing(r,[1,0,1],.12+j*.035,4.6+i*.7+j*.3,j*.45);
      }
      const bell=at(group('brass_tell_bell',post),[q.x*.84,q.y-.36,-.1]);
      rope('bell_short_cord',[[0,.32,0],[0,.04,0]],bell);
      cylinder('flared_hollow_bell',.065,.12,.16,[0,-.04,0],brass,bell,14);
      round('bell_open_lip',.115,.018,[0,-.12,0],p.amber,bell,true);
      sphere('visible_bell_clapper',.036,[0,-.17,0],p.woodDark,bell);
      swing(bell,[0,0,1],.12,3.4+i*.4,.3*i);
    }
    const vane=at(group('feather_wind_vane',post),[0,4.02,0]);
    const greatLeft=sailWing('grand_hyperbolic_wind_wing_left',[0,3.2,-.12],1.82,1.1,teal,post);greatLeft.rotation.y=Math.PI-.15;greatLeft.rotation.z=.05;
    const greatRight=sailWing('grand_hyperbolic_wind_wing_right',[0,3.38,-.12],2.15,1.24,cream,post);greatRight.rotation.y=.12;greatRight.rotation.z=.2;
    swing(greatLeft,[0,1,0],.21,8.1,.4);swing(greatRight,[0,1,0],.17,8.8,1.2);
    cylinder('wind_vane_pivot',.08,.09,.25,[0,-.12,0],brass,vane,12);
    beam('curved_vane_stem',[-.65,0,0],[.81,0,0],.027,copper,vane);
    const shape=new THREE.Shape();shape.moveTo(-.7,0);shape.bezierCurveTo(-.94,.34,-1.09,.36,-1.18,.24);shape.bezierCurveTo(-1.25,.04,-.99,-.17,-.7,0);
    const feather=mesh('broad_cream_weather_feather',new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false,curveSegments:8}),cream,vane);feather.position.z=-.015;
    for(let i=0;i<5;i++)beam('vane_feather_brass_vein',[-.74-i*.075,.02,0],[-.84-i*.068,.19-i*.012,0],.009,brass,vane);
    const arr=new THREE.Shape();arr.moveTo(.83,0);arr.lineTo(.55,.16);arr.lineTo(.55,-.16);arr.closePath();
    mesh('teal_weather_arrow',new THREE.ExtrudeGeometry(arr,{depth:.035,bevelEnabled:false}),teal,vane);
    swing(vane,[0,1,0],.28,8.2);
    ropeCoil('marker_service_rope',[.46,.09,.28],.21,post);
  }

  if(spec.id==='supper-deck'){
    const life=at(group('empty_resting_deck'),[0,-1.05,0]);
    deck('life_plank_deck',3.65,2.75,[0,0,0],life);
    // A low hull-like rim gives a complete floating set silhouette without a ship.
    for(const z of [-1.31,1.31]){
      beam('upper_side_rail',[-1.68,.69,z],[1.68,.69,z],.035,brass,life);
      for(const x of [-1.65,-.8,.8,1.65])beam('rounded_rail_spindle',[x,.08,z],[x,.71,z],.035,teal,life);
    }
    for(const x of [-1.46,1.46]){
      beam('awning_tall_post',[x,.05,-.88],[x,2.58,-.88],.062,p.honey,life,true);
      beam('awning_front_short_post',[x,.05,.92],[x,2.25,.92],.06,p.honey,life,true);
      beam('awning_raking_side',[x,2.58,-.91],[x,2.25,.96],.045,brass,life);
    }
    const cover=cloth('large_cream_repaired_awning',3.3,2.16,[0,2.54,0],life);cover.rotation.x=.15;
    const upperCanopy=cloth('dramatic_high_offset_canopy',2.45,1.9,[-.4,3.2,-.42],life);upperCanopy.rotation.z=.14;upperCanopy.rotation.x=-.13;
    const lowCanopy=cloth('low_outboard_balcony_canopy',1.36,1.47,[1.66,2.02,.1],life);lowCanopy.rotation.z=-.19;
    for(const x of [-1.5,.72])beam('high_canopy_forked_support',[x,.1,-1.02],[x,3.35,-.88],.065,p.honey,life,true);
    deck('outboard_tea_balcony',1.04,1.7,[2.1,-.1,.09],life);
    for(const z of [-.68,.83]){
      beam('balcony_arched_rail',[1.65,.68,z],[2.54,.83,z],.04,brass,life);
      for(const x of [1.72,2.11,2.51])beam('balcony_rounded_post',[x,-.04,z],[x,.8,z],.04,teal,life);
    }
    beam('balcony_outboard_toprail',[2.54,.83,-.68],[2.54,.83,.83],.044,brass,life);
    for(const z of [-.83,.95]){
      bevelBox('long_wood_flower_trough',[.85,.25,.27],[1.84,.18,z],p.honey,life);
      bevelBox('trough_dark_soil',[.75,.025,.2],[1.84,.31,z],p.soil,life);
      for(let i=0;i<4;i++){
        const x=1.53+i*.2;beam('large_bending_flower_stem',[x,.32,z],[x+.06,.65+(i%2)*.09,z],.012,p.pine,life);
        sphere('large_leaf_blade',1,[x-.06,.5,z],p.green,life,[.13,.055,.065]);
        sphere('flower_soft_coral_head',1,[x+.06,.68+(i%2)*.09,z],i%2?p.flower:coral,life,[.09,.075,.085]);
      }
    }
    // Little scallops soften the foreground edge and carry the warm palette.
    for(let i=0;i<9;i++)orb('awning_scalloped_drop',[-1.47+i*.365,2.27,1.08],[.19,.15,.035],i%3===0?coral:cream,life);
    for(const x of [-1.47,1.47])rope('awning_tied_front_edge',[[x,2.28,.98],[x,2.02,1.02],[x+.07,1.92,.95]],life);
    const table=at(group('folding_tea_table',life),[.04,.83,.09]);
    deck('individual_tabletop_boards',1.62,1.02,[0,0,0],table);
    for(const z of [-.35,.35]){
      beam('folding_table_leg_a',[-.6,-.05,z],[.53,-.76,z],.044,p.woodDark,table);
      beam('folding_table_leg_b',[.6,-.05,z],[-.53,-.76,z],.044,p.woodDark,table);
      cylinder('table_brass_hinge',.065,.065,.04,[0,-.39,z],brass,table,10).rotation.x=Math.PI/2;
    }
    const runner=cloth('small_teal_table_runner',.43,.94,[.12,.06,0],table);runner.rotation.y=.04;
    // Cloth helper has cream canvas; teal folded napkins provide a material accent.
    bevelBox('folded_teal_napkin',[.3,.045,.23],[-.48,.075,.12],teal,table);
    const kettle=at(group('round_tea_kettle',table),[-.12,.15,-.04]);
    orb('bulbous_copper_kettle',[0,.19,0],[.22,.21,.22],copper,kettle);
    cylinder('kettle_brass_lid',.13,.17,.055,[0,.39,0],brass,kettle,16);
    sphere('kettle_lid_teal_knob',.055,[0,.45,0],teal,kettle);
    tube('kettle_curled_spout',[[.16,.17,0],[.29,.24,0],[.34,.38,0],[.4,.4,0]],.048,copper,kettle);
    tube('large_kettle_arch_handle',[[-.18,.26,0],[-.2,.57,0],[0,.66,0],[.2,.56,0],[.19,.28,0]],.026,p.woodDark,kettle);
    kettle.scale.set(1.65,1.65,1.65);kettle.position.x=-.03;
    for(const x of [-.5,.52]){
      const cup=at(group('tea_cup_and_saucer',table),[x,.13,-.22]);
      cylinder('cream_saucer',.18,.2,.025,[0,0,0],cream,cup,16);
      cylinder('small_glazed_teacup',.095,.065,.14,[0,.085,0],p.ivory,cup,16);
      cylinder('painted_tea_surface',.08,.08,.009,[0,.16,0],leather,cup,16);
      round('small_teacup_handle',.06,.014,[.104,.09,0],teal,cup);
    }
    function chair(name,pos,angle){
      const g=at(group(name,life),pos);g.rotation.y=angle;
      deck('chair_worn_seat',.62,.57,[0,.48,0],g);
      for(const x of [-.24,.24])for(const z of [-.21,.21])beam('chair_splayed_leg',[x,.46,z],[x*1.18,.04,z*1.17],.035,p.honey,g);
      for(const x of [-.26,.26])beam('chair_backpost',[x,.4,-.23],[x,1.14,-.32],.04,p.woodDark,g);
      for(const y of [.82,1.05])bevelBox('curved_backrest_board',[.61,.15,.055],[0,y,-.3],teal,g);
      return g;
    }
    chair('left_empty_tea_chair',[-1.17,0,.15],-Math.PI/2+.12);
    chair('right_empty_tea_chair',[1.19,0,.08],Math.PI/2-.1);
    const lamp=at(group('awning_lamp_pivot',life),[.82,2.36,-.15]);
    rope('lamp_suspension_cord',[[0,0,0],[0,-.23,0]],lamp);
    pendantLantern('rest_stop_lamp',[0,-.52,0],lamp,.72);
    const basket=at(group('cloth_lined_bread_basket',life),[-1.34,.16,-.87]);
    orb('woven_basket_bowl',[0,.15,0],[.28,.2,.23],p.honey,basket);
    round('basket_oval_rim',.25,.025,[0,.28,0],cream,basket,true).scale.z=.85;
    for(let i=0;i<4;i++)orb('soft_round_bread',[-.14+i*.09,.32,(i%2)*.09-.04],[.09,.06,.08],p.woodLight,basket);
    ropeCoil('deck_evening_rope',[1.42,.12,-.9],.2,life);
    swing(lamp,[0,0,1],.06,5.8);
  }

  if(spec.id==='star-lanterns'){
    const scene=at(group('star_chart_station'),[0,-1.2,0]);
    deck('small_astronomy_platform',2.6,1.7,[0,0,0],scene);
    // A physical, blank engraved star instrument grounds the three paper lanterns.
    const instrument=at(group('brass_star_chart_instrument',scene),[-.48,.65,.05]);instrument.rotation.z=-.22;
    const moon=at(group('great_crescent_navigation_armature',scene),[-.7,1.55,-.34]);moon.rotation.z=-.3;
    crescent('large_cream_crescent_observation_arc',[0,0,0],.9,cream,moon);
    round('grand_armillary_outer_orbit',.82,.035,[0,0,.1],brass,moon);
    const tiltedOrbit=round('grand_armillary_tilted_orbit',.66,.025,[0,0,.1],teal,moon);tiltedOrbit.rotation.y=.9;
    const secondOrbit=round('grand_armillary_cross_orbit',.63,.023,[0,0,.1],brass,moon);secondOrbit.rotation.x=.9;
    orb('oversized_celestial_globe',[0,0,.1],[.24,.24,.24],p.lightTeal,moon);
    beam('moon_instrument_pedestal',[0,-1.48,0],[0,-.76,0],.075,p.honey,moon);
    swing(tiltedOrbit,[0,1,0],.25,12.6,.4);
    for(const x of [-.43,.43])beam('chart_tripod_side',[x,-.57,-.22],[0,.02,0],.042,p.woodDark,instrument);
    beam('chart_tripod_front',[0,-.57,.42],[0,.02,0],.042,p.woodDark,instrument);
    const chart=at(group('tilted_star_disk',instrument),[0,.05,0]);chart.rotation.x=-.65;
    cylinder('dark_teal_chart_disk',.52,.52,.06,[0,0,0],p.deepTeal,chart,28);
    round('thick_chart_brass_frame',.5,.034,[0,.05,0],brass,chart,true);
    round('chart_inner_orbit',.34,.009,[0,.042,0],p.woodLight,chart,true);
    round('chart_small_orbit',.19,.008,[0,.045,0],p.woodLight,chart,true);
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;beam('chart_radial_tick',[Math.cos(a)*.43,.047,Math.sin(a)*.43],[Math.cos(a)*.48,.047,Math.sin(a)*.48],.008,brass,chart);
    }
    for(const q of [[-.25,-.12],[.08,.2],[.24,-.2],[-.17,.3],[.02,-.35]])sphere('painted_star_pin',.022,[q[0],.052,q[1]],cream,chart);
    beam('chart_pointer',[0,.073,0],[.3,.073,.18],.014,brass,chart);
    sphere('chart_pointer_hub',.045,[0,.073,0],brass,chart);
    ropeCoil('unused_launch_twine',[.77,.08,.28],.25,scene);
    function paperLantern(name,pos,scale,col,phase){
      const g=at(group(name,scene),pos);g.scale.setScalar(scale);
      // Lathed hand-shaped body, open at both ends, with a narrow lower collar.
      const profile=[new THREE.Vector2(.21,-.65),new THREE.Vector2(.48,-.48),new THREE.Vector2(.65,-.1),new THREE.Vector2(.61,.36),new THREE.Vector2(.37,.7),new THREE.Vector2(.07,.8)];
      mesh('bulbous_warm_paper_shell',new THREE.LatheGeometry(profile,24),col,g);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,pts=profile.map(q=>[Math.sin(a)*(q.x+.006),q.y,Math.cos(a)*(q.x+.006)]);
        tube('fine_bamboo_paper_rib',pts,.009,p.woodLight,g);
      }
      for(const q of [[.22,-.63],[.65,-.1],[.37,.7]])round('paper_lantern_bamboo_hoop',q[0],.012,[0,q[1],0],p.honey,g,true);
      // Paper overlap and small patches show workmanship without writing.
      for(let j=0;j<6;j++)box('vertical_paper_seam',[.009,.042,.008],[.08,-.36+j*.13,.45],p.ivory,g);
      cylinder('small_open_bottom_ring',.205,.205,.048,[0,-.66,0],brass,g,20);
      for(const s of [-1,1])beam('burner_crossbar',[s*.2,-.68,-.1],[s*-.2,-.68,.1],.01,p.honey,g);
      orb('tiny_painted_warm_flame',[0,-.62,0],[.04,.085,.04],p.amber,g);
      rope('hanging_lantern_string',[[0,-.7,0],[.07,-1.06,.02],[.02,-1.44,.04]],g);
      float(g,.13,6+phase,phase*.8);swing(g,[0,0,1],.055,7.2+phase,phase);
      return g;
    }
    paperLantern('large_near_paper_lantern',[.72,2.45,.1],1.05,p.amber,.3);
    paperLantern('middle_coral_paper_lantern',[-.86,3.13,-.5],.73,coral,1.1);
    paperLantern('small_cream_paper_lantern',[1.35,3.48,-.47],.5,cream,2.0);
    // Tied loops at the launching tray stay small enough to preserve the airy gap.
    spool('launch_twine_spool',[.78,.22,-.4],scene).scale.setScalar(.68);
  }

  if(!assets.some(a=>a.id===spec.id))throw new Error(`Unknown route prop: ${spec.id}`);
  root.userData.animation_scope='Authored transform keyframes, visual loops only; no engine interaction or physics.';
  root.userData.palette='Cream canvas, honey wood, teal enamel, coral repair cloth and matte brass; baked vertex shading.';
  root.userData.expression_revision='r2: latest 10x-or-more dramatic expression brief; silhouette, functional mass hierarchy, asymmetry, layered cloth and delayed settling motion. Human art approval remains separate.';
  root.userData.asset_role=assets.find(a=>a.id===spec.id)?.role;
  return {clips};
}
