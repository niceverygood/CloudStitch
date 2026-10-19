// Cloudstitch grounded armaments: hardware only, no combat or VFX.
// Y up, +Z front. Independent named mechanism groups are static assembly anchors.
export function buildA(id,k){
  const {THREE:T,palette:p}=k;
  const c={wood:p.honey,light:p.woodLight,dark:p.woodDark,teal:p.teal,deep:p.deepTeal,
    brass:p.brass,cream:p.cream,coral:p.coral,steel:0x65777a,copper:0xb76b3d,ink:p.ink};
  const beam=(name,a,b,w,d,color,parent)=>{
    const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);
    const m=k.bevelBox(name,[w,delta.length(),d],av.add(bv).multiplyScalar(.5).toArray(),color,parent);
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return m;
  };
  const axis=(name,r,h,pos,color,parent,dir='x',segments=20)=>{
    const m=k.cylinder(name,r,r,h,pos,color,parent,segments);
    if(dir==='x')m.rotation.z=Math.PI/2;if(dir==='z')m.rotation.x=Math.PI/2;return m;
  };
  const circle=(name,r,th,pos,color,parent,dir='x')=>{
    const m=k.ring(name,r,th,pos,color,parent);
    if(dir==='x')m.rotation.z=Math.PI/2;if(dir==='z')m.rotation.x=Math.PI/2;return m;
  };
  const rivet=(pos,parent,dir='y')=>{
    const m=axis('square_head_rivet',.027,.026,pos,c.brass,parent,dir,6);return m;
  };
  const base=(name,w=2.3,d=2.0)=>{
    const g=k.group(name);
    for(const x of [-w*.35,w*.35]){
      k.bevelBox('teal_mounting_skid',[.3,.19,d],[x,.12,0],c.deep,g);
      for(const z of [-d*.36,d*.36]){k.bevelBox('brass_anchor_shoe',[.41,.13,.32],[x,.16,z],c.brass,g);rivet([x,.24,z],g);}
    }
    k.deck('individual_wood_plinth',w,d-.12,[0,.29,0],g);
    for(const z of [-d*.29,d*.29])k.bevelBox('cross_mount_rail',[w+.12,.14,.13],[0,.4,z],c.teal,g);
    return g;
  };
  const handwheel=(name,pos,r,parent)=>{
    const g=k.group(name,parent);g.position.set(...pos);
    circle('cast_handwheel_rim',r,.035,[0,0,0],c.brass,g,'x');axis('wheel_hub',.1,.17,[0,0,0],c.brass,g);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;beam('wheel_spoke',[0,0,0],[0,Math.cos(a)*r,Math.sin(a)*r],.035,.035,c.brass,g);}
    axis('turned_wood_crank',.045,.23,[.11,r,0],c.dark,g);return g;
  };
  const arrow=(name,pos,len,parent,harpoon=false)=>{
    const g=k.group(name,parent);g.position.set(...pos);
    axis('timber_arrow_shaft',harpoon?.062:.024,len,[0,0,0],harpoon?c.wood:c.dark,g,'z');
    const shape=new T.Shape();const w=harpoon?.23:.07;
    shape.moveTo(0,.3);shape.lineTo(-w,-.12);shape.lineTo(-w*.32,-.07);shape.lineTo(0,-.16);shape.lineTo(w*.32,-.07);shape.lineTo(w,-.12);shape.closePath();
    const geo=new T.ExtrudeGeometry(shape,{depth:harpoon?.07:.018,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:1,steps:1});
    geo.rotateX(Math.PI/2);
    const head=k.mesh('forged_point_and_barbs',geo,c.steel,g);head.position.z=len*.5;
    for(const a of [0,Math.PI/2]){const f=k.bevelBox('tail_vane',[.15,.018,.23],[0,0,-len*.35],c.coral,g);f.rotation.z=a;}
    return g;
  };
  const banner=(parent,pos)=>{
    const g=k.group('small_canvas_safety_wrap',parent);g.position.set(...pos);
    const cl=k.cloth('cream_coral_sewn_wrap',.3,.36,[0,0,0],g);cl.rotation.x=Math.PI/2;
  };
  if(id==='01-capacitor-tower'){
    const g=base('electrical_insulated_base',2.4,1.75);
    for(const [j,x] of [-.57,.57].entries()){
      const h=j===0?2.85:2.45, tower=k.group('porcelain_coil_tower_'+j,g);
      axis('flared_enamel_pedestal',.24,.64,[x,.71,0],c.teal,tower,'y');
      k.cylinder('tapered_pedestal',.22,.35,.46,[x,.63,0],c.deep,tower,16);
      axis('brass_lower_collar',.27,.13,[x,1.02,0],c.brass,tower,'y');
      axis('insulator_spindle',.11,h-1.13,[x,(h+1.13)/2,0],c.copper,tower,'y');
      const n=j===0?7:6;
      for(let i=0;i<n;i++){
        const y=1.19+i*.205;
        k.cylinder('cream_ceramic_skirt',.29,.35,.12,[x,y,0],c.cream,tower,28);
        axis('porcelain_neck',.18,.12,[x,y+.09,0],c.cream,tower,'y',24);
        circle('copper_winding',.255,.029,[x,y+.14,0],c.copper,tower,'y');
      }
      axis('brass_top_crown',.23,.13,[x,h-.15,0],c.brass,tower,'y');
      k.sphere('polished_copper_terminal',.18,[x,h+.04,0],c.copper,tower,[1,.95,1]);
      for(const s of [-1,1])beam('pedestal_brace',[x+s*.31,.42,.29],[x+s*.19,.94,.12],.085,.09,c.brass,tower);
      for(const z of [-.23,.23])rivet([x,.44,z],tower);
      banner(tower,[x,.75,.27]);
    }
    k.bevelBox('switchboard_timber_case',[.69,.46,.42],[0,.68,.48],c.dark,g);
    k.bevelBox('teal_instrument_face',[.62,.36,.045],[0,.72,.71],c.teal,g);
    for(const x of [-.19,.19]){
      axis('ivory_dial',.085,.025,[x,.76,.745],c.cream,g,'z');
      beam('dial_needle',[x,.76,.77],[x+.025,.81,.77],.01,.01,c.ink,g);
      axis('switch_stem',.025,.11,[x,.57,.76],c.brass,g,'z');
      k.sphere('coral_switch_handle',.046,[x,.57,.83],c.coral,g);
      k.tube('heavy_insulated_wire',[[x,.49,.5],[x*2,.48,.3],[x*3,.7,.1]],.045,c.ink,g);
    }
    axis('horizontal_bus_bar',.046,1.1,[0,.98,-.17],c.copper,g,'x');
    k.root.userData.mechanisms=['porcelain coil towers','manual electrical switchboard'];return k.root;
  }
  if(id==='02-deck-greatbow'){
    const g=base('greatbow_swivel_platform',2.2,2.15);
    axis('turntable',.63,.14,[0,.49,0],c.deep,g,'y',28);
    circle('azimuth_brass_track',.59,.032,[0,.58,0],c.brass,g,'y');
    const aim=k.group('aim_elevation_cradle',g);
    for(const s of [-1,1]){
      beam('angled_timber_cheek',[s*.55,.59,-.37],[s*.37,1.36,.04],.22,.24,c.wood,aim);
      beam('rear_diagonal_brace',[s*.55,.57,-.8],[s*.38,1.25,.02],.13,.15,c.dark,aim);
      axis('brass_elevation_pivot',.19,.16,[s*.45,1.25,.02],c.brass,aim);
      rivet([s*.56,1.25,.02],aim,'x');
    }
    const bow=k.group('draw_greatbow_assembly',aim);bow.position.set(0,1.26,0);bow.rotation.x=-.2;
    k.paintWood('long_arrow_bed',[.25,.2,2.25],[0,.08,.03],bow);
    for(const x of [-.15,.15])k.bevelBox('brass_bed_rail',[.032,.07,2.16],[x,.18,.03],c.brass,bow);
    // Tall recurved bow: laminated curved limbs in a vertical plane.
    for(const sign of [-1,1]){
      const points=[[0,0,.65],[0,sign*.35,.55],[0,sign*.76,.25],[0,sign*1.12,.13],[0,sign*1.34,.35]];
      k.tube('laminated_recurve_wood',points,.105,c.wood,bow);
      k.tube('dark_limb_lamination',points.map(([x,y,z])=>[x-.075,y,z]),.024,c.dark,bow);
      for(let j=1;j<4;j++){
        const pt=points[j];axis('limb_brass_binding',.12,.09,[pt[0],pt[1],pt[2]],c.brass,bow,'y');
      }
      k.rope('taut_bowstring',[[0,sign*1.34,.35],[0,.21,-.87]],bow);
      axis('end_pulley',.1,.14,[0,sign*1.29,.33],c.brass,bow);
    }
    arrow('loaded_great_arrow',[0,.25,.01],1.9,bow);
    k.bevelBox('trigger_block',[.38,.28,.37],[0,.02,-.72],c.teal,bow);
    handwheel('draw_ratchet_wheel',[.38,1.02,-.53],.25,aim);
    k.rope('winding_line',[[.32,1.01,-.53],[.06,1.33,-.85]],aim);
    for(let i=0;i<4;i++)arrow('spare_arrow_'+i,[-.82+i*.13,.72,-.41],.9,g);
    k.bevelBox('spare_arrow_rack',[.65,.13,.2],[-.63,.67,-.66],c.teal,g);
    banner(g,[-.53,.89,-.74]);return k.root;
  }
  if(id==='03-repeating-crossbow'){
    const g=base('low_repeater_chassis',2.65,2.2);
    const aim=k.group('aim_low_crossbow_carriage',g);
    for(const x of [-1.02,1.02]){
      k.paintWood('wide_carriage_cheek',[.18,.46,1.7],[x,.67,0],aim);
      k.bevelBox('teal_cheek_cap',[.22,.1,1.78],[x,.91,0],c.teal,aim);
      for(const z of [-.66,.66]){k.bevelBox('corner_brass_guard',[.23,.37,.13],[x,.71,z],c.brass,aim);rivet([x,.94,z],aim);}
    }
    k.paintWood('horizontal_bolt_magazine',[1.87,.16,1.52],[0,.81,-.03],aim);
    for(let i=0;i<8;i++){
      const x=(i-3.5)*.215;
      k.bevelBox('open_bolt_channel',[.035,.1,1.6],[x-.084,.94,0],c.dark,aim);
      arrow('ready_bolt_'+i,[x,.99,.03],1.35,aim);
    }
    for(const z of [-.62,.54]){
      k.bevelBox('magazine_brass_crossbar',[2,.07,.07],[0,1.06,z],c.brass,aim);
      for(const x of [-.9,.9])rivet([x,1.11,z],aim);
    }
    const draw=k.group('draw_horizontal_limb',aim);
    k.tube('broad_horizontal_recurve',[[-1.42,.84,.48],[-1.11,.78,.29],[-.65,.78,.36],[0,.79,.58],[.65,.78,.36],[1.11,.78,.29],[1.42,.84,.48]],.085,c.wood,draw);
    k.rope('continuous_horizontal_string',[[-1.42,.84,.48],[0,.96,-.7],[1.42,.84,.48]],draw);
    for(const x of [-1.13,1.13])axis('brass_limb_pulley',.12,.1,[x,.83,.34],c.brass,draw,'y');
    axis('feed_shaft',.07,2.24,[0,.62,-.5],c.steel,aim);
    for(let i=0;i<8;i++)axis('feed_cam_'+i,.1,.07,[(i-3.5)*.215,.62,-.5],c.brass,aim);
    handwheel('repeater_feed_crank',[1.3,.63,-.51],.23,aim);
    k.bevelBox('rear_trigger_cover',[.45,.21,.29],[0,.61,-.84],c.teal,aim);
    k.rope('rear_leather_tension_tie',[[-.84,.99,-.75],[-.83,.64,-.8],[.84,.64,-.8],[.84,.99,-.75]],aim);
    banner(aim,[-1.07,.63,-.11]);return k.root;
  }
  if(id==='04-harpoon-winch'){
    const g=base('winch_heavy_skids',2.45,2.35);
    const drum=k.group('drum_rope_spool',g);
    axis('rope_drum_core',.43,1.22,[0,1.04,-.2],c.dark,drum);
    for(const s of [-1,1]){
      axis('wood_drum_flange',.61,.13,[s*.7,1.04,-.2],c.wood,drum,'x',28);
      circle('brass_flange_rim',.57,.036,[s*.78,1.04,-.2],c.brass,drum);
      axis('central_axle',.14,.3,[s*.82,1.04,-.2],c.steel,drum);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;rivet([s*.78,1.04+Math.sin(a)*.45,-.2+Math.cos(a)*.45],drum,'x');
      }
      k.paintWood('axle_trestle',[.22,.78,.34],[s*.85,.74,-.2],g);
      beam('slanted_bearing_stay',[s*.93,.45,.43],[s*.85,1.12,-.2],.15,.15,c.teal,g);
      k.bevelBox('bearing_housing',[.3,.29,.36],[s*.85,1.02,-.2],c.deep,g);
    }
    const pts=[];
    for(let i=0;i<=440;i++){
      const t=i/440,a=t*Math.PI*2*21;pts.push([-.6+t*1.2,1.04+Math.cos(a)*.46,-.2+Math.sin(a)*.46]);
    }
    // Explicit helical geometry preserves close winding rather than a smoothed approximation.
    const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)),false,'centripetal');
    k.mesh('twenty_one_rope_windings',new T.TubeGeometry(curve,560,.038,6,false),c.cream,drum);
    const guide=k.group('aim_open_harpoon_guide',g);
    for(const s of [-1,1])beam('guide_upright',[s*.31,.49,.61],[s*.21,1.81,.44],.15,.17,c.wood,guide);
    for(const z of [-.42,.63]){
      k.bevelBox('open_guide_bridge',[.58,.14,.17],[0,1.77,z],c.teal,guide);
      for(const s of [-1,1]){k.bevelBox('guide_lip',[.08,.17,.19],[s*.24,1.89,z],c.brass,guide);rivet([s*.24,1.99,z],guide);}
    }
    arrow('loaded_forged_harpoon',[0,1.94,.18],2.05,guide,true);
    k.rope('harpoon_tether_lead',[[0,1.94,-.79],[0,1.7,-.95],[.24,1.29,-.71]],guide);
    handwheel('winch_brake_handwheel',[1.12,1.04,-.2],.41,g);
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;const tooth=k.bevelBox('ratchet_tooth',[.08,.12,.1],[-1,1.04+Math.cos(a)*.28,-.2+Math.sin(a)*.28],c.brass,g);tooth.rotation.x=-a;
    }
    beam('ratchet_pawl',[-1,.68,-.35],[-1,1.01,-.49],.07,.09,c.steel,g);
    k.sphere('brake_lever_handle',.08,[-1,.65,-.38],c.coral,g);
    banner(g,[.86,.67,.21]);return k.root;
  }
  throw new Error('Unknown buildA weapon: '+id);
}
