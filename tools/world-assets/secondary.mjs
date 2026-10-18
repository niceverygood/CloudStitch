// Original static Cloudstitch environment modules, vegetation/props/navigation/
// interactables. Every object is actual geometry, not a billboard or a game system.
export function buildSecondary(spec,k) {
  const {THREE,root,palette:P,group,mesh,box,bevelBox,cylinder,cone,sphere,ring,tube,deck,window:porthole,cloth,rope,bolt,paintWood,random}=k;
  const TAU=Math.PI*2;
  const at=(object,pos,rot=null,scale=null)=>{object.position.set(...pos);if(rot)object.rotation.set(...rot);if(scale)object.scale.set(...scale);return object;};
  function beam(name,a,b,r,color,parent=root) {
    const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),m=cylinder(name,r,r,va.distanceTo(vb),va.clone().add(vb).multiplyScalar(.5).toArray(),color,parent,8);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.sub(va).normalize());return m;
  }
  function soil(name,r=.5,parent=root){return sphere(name,r,[0,.055,0],P.earth,parent,[1,.17,.85]);}
  function leaf(name,pos,size=.28,rot=[0,0,0],color=P.sage,parent=root){return at(sphere(name,size,pos,color,parent,[.45,1,.16]),pos,rot);}
  function roots(name,base=.3,count=5,parent=root){
    for(let i=0;i<count;i++){const a=i/count*TAU;const r=base*(1.5+random()*.4);tube(name,[[0,.18,0],[Math.cos(a)*r*.55,.06,Math.sin(a)*r*.55],[Math.cos(a)*r,0,Math.sin(a)*r]],.055,P.honey,parent);}
  }
  function canopy(name,pos,radius,scale=[1,.8,1],color=P.green,parent=root){
    sphere(name,radius,pos,color,parent,scale);
    for(let i=0;i<3;i++){const a=i/3*TAU+.3;sphere(name+'_bud',radius*.45,[pos[0]+Math.cos(a)*radius*.6,pos[1]+radius*.14,pos[2]+Math.sin(a)*radius*.55],i%2?P.sage:P.pine,parent,[1,.85,1]);}
  }
  function flower(name,pos,color,parent=root){
    const f=group(name,parent);f.position.set(...pos);
    for(let i=0;i<5;i++){const a=i/5*TAU;at(sphere('rounded_petal',.085,[Math.cos(a)*.1,0,Math.sin(a)*.1],color,f,[.8,.45,1.2]),[Math.cos(a)*.1,0,Math.sin(a)*.1],[0,-a,0]);}
    sphere('flower_center',.05,[0,.035,0],P.amber,f,[1,.6,1]);return f;
  }
  function pot(name,radius=.45,height=.6,color=P.teal,parent=root){
    const points=[[0,0],[radius*.72,0],[radius*.95,height*.12],[radius,height*.8],[radius*1.05,height],[radius*.88,height],[radius*.81,height*.15],[0,height*.15]].map(([r,y])=>new THREE.Vector2(r,y));
    return mesh(name,new THREE.LatheGeometry(points,12),color,parent);
  }
  function barrel(name,parent=root,height=1.2,radius=.45){
    const b=group(name,parent),profile=[[0,0],[radius*.8,0],[radius*.93,.12*height],[radius,.5*height],[radius*.93,.9*height],[radius*.8,height],[0,height]].map(([r,y])=>new THREE.Vector2(r,y));
    mesh('bulging_wood_staves',new THREE.LatheGeometry(profile,12),P.honey,b);
    for(const y of [.17,.82])ring('brass_barrel_band',radius*(y===.17?.96:.97),.028,[0,height*y,0],P.brass,b);
    cylinder('planked_barrel_lid',radius*.79,radius*.79,.035,[0,height+.01,0],P.woodLight,b,12);
    for(let i=-2;i<=2;i++)box('lid_wood_seam',[.009,.006,radius*(Math.abs(i)===2?1:1.4)],[i*radius*.27,height+.032,0],P.woodDark,b);
    cylinder('small_brass_bung',.07,.07,.04,[radius*.25,height+.05,0],P.brass,b,8);
    for(let i=0;i<12;i++){const a=i/12*TAU;tube('stave_joint',[[Math.cos(a)*radius*.925,height*.13,Math.sin(a)*radius*.925],[Math.cos(a)*radius*1.004,height*.5,Math.sin(a)*radius*1.004],[Math.cos(a)*radius*.925,height*.87,Math.sin(a)*radius*.925]],.006,P.woodDark,b);}
    return b;
  }
  function crate(name,parent=root,w=1.15,h=.95,d=.9){
    const c=group(name,parent);
    for(const sign of [-1,1]){
      for(let i=0;i<4;i++)paintWood('crate_horizontal_plank',[w,.17,.065],[0,.13+i*(h-.2)/3,sign*d*.5],c);
      for(let i=0;i<4;i++)paintWood('crate_side_plank',[.065,.17,d],[sign*w*.5,.13+i*(h-.2)/3,0],c);
      for(const z of [-d*.47,d*.47])bevelBox('teal_corner_brace',[.075,h,.09],[sign*w*.49,h*.5,z],P.teal,c);
      for(const y of [.09,h-.09]){bevelBox('teal_front_band',[w+.08,.08,.07],[0,y,sign*(d*.5+.04)],P.teal,c);for(const x of [-w*.42,w*.42])bolt('crate_brass_nail',[x,y+.045,sign*d*.5],c);}
    }
    deck('crate_lid',w,d,[0,h,0],c);
    const diagonal=bevelBox('diagonal_wood_brace',[w*.85,.1,.06],[0,h*.5,d*.5+.08],P.woodLight,c);diagonal.rotation.z=.57;
    return c;
  }
  function lantern(name,parent=root,stand=false){
    const g=group(name,parent),base=stand?.85:0;
    if(stand){cylinder('teal_lantern_pole',.055,.085,.9,[0,.45,0],P.teal,g,10);bevelBox('lantern_foot',[.4,.06,.4],[0,.03,0],P.deepTeal,g);for(const x of [-.14,.14])for(const z of [-.14,.14])bolt('lantern_foot_bolt',[x,.06,z],g);}
    cylinder('warm_cream_lantern_glass',.17,.17,.35,[0,base+.29,0],P.cream,g,8);
    for(let i=0;i<4;i++){const a=i/4*TAU;beam('brass_lantern_bar',[Math.cos(a)*.18,base+.1,Math.sin(a)*.18],[Math.cos(a)*.18,base+.48,Math.sin(a)*.18],.018,P.brass,g);}
    cylinder('brass_lantern_floor',.2,.21,.055,[0,base+.1,0],P.brass,g,8);
    cone('teal_lantern_roof',.24,.15,[0,base+.54,0],P.teal,g,8);
    sphere('brass_lantern_roof_knob',.045,[0,base+.64,0],P.brass,g);
    const handle=ring('lantern_carrying_loop',.1,.018,[0,base+.73,0],P.brass,g);handle.rotation.x=Math.PI/2;
    if(!stand)rope('short_hanging_loop',[[0,.83,0],[.045,.93,0],[0,1,0]],g);
    return g;
  }
  function table(name,parent=root,w=1.9,d=1,h=1){
    const t=group(name,parent);paintWood('table_warm_top',[w,.13,d],[0,h,0],t);
    for(const x of [-w*.38,w*.38])for(const z of [-d*.35,d*.35]){
      bevelBox('teal_table_leg',[.12,h,.12],[x,h*.5,z],P.teal,t);
      cylinder('brass_leg_foot',.09,.09,.06,[x,.045,z],P.brass,t,8);
    }
    for(const z of [-d*.33,d*.33])box('wood_table_crossrail',[w*.8,.08,.065],[0,.35,z],P.honey,t);
    return t;
  }
  function hammer(name,pos,parent=root,scale=1){
    const g=group(name,parent);g.position.set(...pos);g.scale.setScalar(scale);
    cylinder('wood_hammer_handle',.045,.055,.65,[0,.325,0],P.honey,g,8);
    bevelBox('teal_hammer_head',[.39,.18,.18],[0,.66,0],P.teal,g);
    ring('brass_hammer_collar',.057,.012,[0,.55,0],P.brass,g);
    return g;
  }
  function wrench(name,pos,parent=root,scale=1){
    const g=group(name,parent);g.position.set(...pos);g.scale.setScalar(scale);
    bevelBox('brass_wrench_shank',[.075,.5,.05],[0,.25,0],P.brass,g);
    const head=mesh('open_wrench_jaw',new THREE.TorusGeometry(.13,.04,4,14,Math.PI*1.5),P.brass,g);head.position.y=.57;head.rotation.z=Math.PI*.25;
    sphere('wrench_handle_end',.055,[0,0,0],P.brass,g,[.9,1,.6]);return g;
  }
  function vise(name,pos,parent=root){
    const g=group(name,parent);g.position.set(...pos);
    bevelBox('brass_vise_base',[.48,.07,.35],[0,.035,0],P.brass,g);
    for(const x of [-.17,.17])bevelBox('vise_jaw',[.1,.25,.28],[x,.18,0],P.teal,g);
    const screw=cylinder('brass_vise_thread',.032,.032,.62,[0,.15,0],P.brass,g,8);screw.rotation.z=Math.PI/2;
    beam('vise_crank',[-.34,.02,0],[-.34,.3,0],.022,P.brass,g);
    sphere('vise_crank_end',.035,[-.34,.3,0],P.honey,g);return g;
  }
  function bench(name,parent=root){
    const b=group(name,parent);
    for(const z of [-.18,.03,.24])paintWood('bench_seat_plank',[2.1,.08,.19],[0,.52,z],b);
    for(const x of [-.75,.75])for(const z of [-.16,.22])bevelBox('bench_teal_leg',[.1,.52,.1],[x,.26,z],P.teal,b);
    for(const x of [-.75,.75])bevelBox('bench_back_upright',[.09,.72,.09],[x,.65,-.23],P.deepTeal,b);
    for(const y of [.83,1.02]){paintWood('bench_back_plank',[2,.14,.07],[0,y,-.23],b);for(const x of [-.75,.75]){const boltG=bolt('bench_back_bolt',[x,y,-.18],b);boltG.rotation.x=Math.PI/2;}}
    beam('bench_cross_stretcher',[-.75,.2,.12],[.75,.2,.12],.035,P.honey,b);return b;
  }
  function roofCap(name,pos,w,parent=root){
    const g=group(name,parent);g.position.set(...pos);
    for(const side of [-1,1]){const panel=bevelBox('teal_sloped_roof',[w,.07,.29],[0,0,side*.13],P.teal,g);panel.rotation.x=side*.4;}
    cylinder('roof_brass_ridge',.025,.025,w,[0,.065,0],P.brass,g,8).rotation.z=Math.PI/2;return g;
  }
  function panelStand(name,parent=root,w=1.6,h=1.8){
    const g=group(name,parent);
    for(const x of [-w*.36,w*.36]){
      bevelBox('wood_sign_leg',[.1,h,.1],[x,h*.5,0],P.honey,g);
      bevelBox('teal_leg_foot',[.3,.055,.4],[x,.035,0],P.teal,g);
    }
    paintWood('warm_sign_panel',[w,.75,.09],[0,h*.68,0],g);
    roofCap('sign_roof',[0,h-.07,0],w+.15,g);return g;
  }
  function compass(name,pos,parent=root,r=.52){
    const g=group(name,parent);g.position.set(...pos);
    cylinder('teal_compass_pedestal',r,r,.08,[0,.04,0],P.teal,g,16);
    ring('brass_compass_circumference',r*.93,.022,[0,.09,0],P.brass,g);
    for(let i=0;i<8;i++){
      const a=i/8*TAU,len=i%2?r*.58:r*.86;
      const tip=cone('compass_direction_point',i%2?.055:.09,len,[Math.sin(a)*len*.5,.105,Math.cos(a)*len*.5],i===0?P.coral:i%2?P.cream:P.brass,g,4);
      tip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.sin(a),0,Math.cos(a)));tip.scale.z=.24;
    }
    sphere('compass_center_cap',.07,[0,.13,0],P.brass,g,[1,.45,1]);return g;
  }
  function mapSurface(name,parent=root,w=1.7,d=1.1){
    const g=group(name,parent);
    box('cream_chart',[w,.018,d],[0,0,0],P.cream,g);
    for(const x of [-w*.48,w*.48]){const curl=cylinder('rolled_map_edge',.04,.04,d,[x,.025,0],P.ivory,g,10);curl.rotation.x=Math.PI/2;}
    tube('teal_drawn_route',[[-w*.32,.018,-d*.24],[-w*.13,.018,d*.17],[w*.1,.018,-d*.1],[w*.32,.018,d*.25]],.012,P.teal,g);
    for(const [x,z] of [[-w*.32,-d*.24],[-w*.13,d*.17],[w*.1,-d*.1],[w*.32,d*.25]])ring('brass_chart_node',.045,.01,[x,.022,z],P.brass,g);
    return g;
  }
  function winch(name,parent=root){
    const g=group(name,parent);paintWood('winch_wood_foot',[1.45,.12,1.05],[0,.06,0],g);
    for(const x of [-.5,.5]){
      bevelBox('teal_drum_frame',[.12,.8,.55],[x,.46,0],P.teal,g);
      for(const z of [-.35,.35])beam('winch_frame_brace',[x,.13,z],[x,.73,0],.035,P.deepTeal,g);
    }
    cylinder('cream_rope_drum',.25,.25,.82,[0,.6,0],P.cream,g,12).rotation.z=Math.PI/2;
    for(const x of [-.44,.44]){const flange=cylinder('brass_drum_flange',.31,.31,.06,[x,.6,0],P.brass,g,12);flange.rotation.z=Math.PI/2;}
    const winding=[];for(let i=0;i<=70;i++){const f=i/70,a=f*TAU*5;winding.push([-.4+f*.8,.6+Math.cos(a)*.26,Math.sin(a)*.26]);}
    tube('visible_cream_rope_winding',winding,.021,P.ivory,g);
    rope('winch_loose_rope',[[0,.6,.27],[.1,.25,.55],[.4,.1,.75],[.65,.1,.75]],g);
    beam('winch_brass_crank',[.63,.6,0],[.63,.88,.1],.03,P.brass,g);
    cylinder('wood_crank_grip',.045,.045,.19,[.74,.88,.1],P.honey,g,8).rotation.z=Math.PI/2;return g;
  }

  switch(spec.id) {
    // Vegetation: broad, readable organic masses with actual branches/leaves.
    case 'tree-round': {
      soil('tree_root_soil',.55);roots('exposed_tree_roots',.4,6);
      tube('curving_honey_tree_trunk',[[0,0,0],[-.12,.9,.03],[.08,1.8,0],[0,2.65,.05]],.18,P.honey);
      for(let i=0;i<4;i++){const a=i/4*TAU;tube('thick_canopy_branch',[[0,1.6,0],[Math.cos(a)*.45,2.1,Math.sin(a)*.4],[Math.cos(a)*.67,2.55,Math.sin(a)*.65]],.08,P.honey);}
      canopy('large_round_crown',[0,2.9,0],.9,[1,.85,1],P.pine);
      canopy('side_round_crown',[-.55,2.65,.3],.55,[1,.85,1],P.green);break;
    }
    case 'tree-windswept': {
      soil('wind_tree_soil',.55);roots('wind_tree_roots',.4,5);
      tube('leaning_wind_tree_trunk',[[0,0,0],[.12,.85,0],[.45,1.65,.02],[1,2.5,.08]],.16,P.honey);
      for(let i=0;i<3;i++)tube('wind_stretched_branch',[[.25,1.5,0],[.65+i*.2,2.0,(i-1)*.25],[1.35+i*.12,2.35,(i-1)*.3]],.065,P.honey);
      canopy('pressed_windward_crown',[1.1,2.65,0],.85,[1.55,.5,.95],P.pine);
      canopy('windward_small_leaves',[.45,2.25,.3],.42,[1.3,.6,.9],P.green);break;
    }
    case 'tree-tall': {
      soil('tall_tree_soil',.5);roots('tall_tree_roots',.4,5);
      tube('tall_honey_tree_trunk',[[0,0,0],[.1,1.4,.03],[-.04,2.8,0],[.08,4.2,.04]],.14,P.honey);
      for(let i=0;i<4;i++){const y=1.7+i*.7,s=i%2?-1:1;beam('tall_tree_branch',[0,y-.3,0],[s*.48,y,.15],.055,P.honey);canopy('layered_tall_crown',[s*.3,y+.2,.1],.65-i*.07,[1,.68,.9],i%2?P.green:P.pine);}
      canopy('upper_tall_crown',[.08,4.35,.04],.5,[.85,1.1,.85],P.sage);break;
    }
    case 'tree-stump': {
      roots('stump_roots',.42,7);cylinder('old_wood_stump',.4,.54,.72,[0,.36,0],P.honey,root,11);
      cylinder('light_cut_wood_face',.39,.39,.025,[0,.73,0],P.woodLight,root,12);
      for(const r of [.12,.23,.32])ring('stump_growth_ring',r,.008,[0,.746,0],P.woodDark);
      tube('stump_cut_crack',[[.04,.748,.05],[.13,.748,.15],[.3,.748,.18]],.009,P.woodDark);
      for(let i=0;i<4;i++)sphere('stump_moss',.18,[Math.cos(i)*.44,.15,Math.sin(i)*.4],P.moss,root,[1,.35,.8]);break;
    }
    case 'bush-round': {
      soil('bush_soil',.5);for(let i=0;i<5;i++){const a=i/5*TAU;beam('short_bush_branch',[0,.1,0],[Math.cos(a)*.3,.45,Math.sin(a)*.3],.035,P.honey);sphere('rounded_bush_mass',.42,[Math.cos(a)*.28,.46+random()*.15,Math.sin(a)*.28],i%2?P.green:P.pine,root,[1,.8,1]);}
      sphere('light_bush_crown',.43,[0,.74,0],P.sage,root,[1,.7,1]);break;
    }
    case 'bush-long': {
      for(let i=0;i<6;i++){const x=(i-2.5)*.38;beam('hedge_short_branch',[x,0,0],[x,.4,0],.035,P.honey);sphere('connected_hedge_crown',.4,[x,.48,Math.sin(i)*.08],i%3===0?P.sage:P.green,root,[1,.85,.9]);}
      for(let i=0;i<3;i++)sphere('hedge_exposed_root',.17,[(i-1)*.8,.05,0],P.earth,root,[1,.3,.8]);break;
    }
    case 'grass-tuft': {
      soil('tuft_soil',.23);for(let i=0;i<12;i++){const a=i/12*TAU,h=.3+random()*.4;const g=group('rounded_grass_blade');leaf('grass_blade',[0,h*.5,0],h*.5,[0,0,0],i%3?P.green:P.sage,g);g.rotation.set(Math.sin(a)*.35,a,Math.cos(a)*.35);g.position.set(Math.cos(a)*.08,.02,Math.sin(a)*.08);}break;
    }
    case 'reed-clump': {
      soil('reed_soil',.35);for(let i=0;i<7;i++){const x=(random()-.5)*.5,z=(random()-.5)*.4,h=1.05+random()*.6;beam('long_reed_stem',[x,.05,z],[x+.05,h,z],.015,P.pine);sphere('cream_reed_seed_head',.1,[x+.05,h+.12,z],P.cream,root,[.65,1.8,.65]);leaf('reed_side_leaf',[x+.1,h*.4,z],.35,[0,.3,-.55],P.sage);}break;
    }
    case 'hanging-vine': {
      bevelBox('vine_upper_bracket',[.8,.08,.18],[0,2.5,0],P.honey);
      for(let j=0;j<3;j++){const x=(j-1)*.3,len=1.8+j*.25;tube('descending_curved_vine',[[x,2.5,0],[x+.12,2.0,.05],[x-.08,1.3,.12],[x+.05,2.5-len,.02]],.022,P.pine);for(let i=0;i<7;i++){const y=2.25-i*len/7,s=i%2?1:-1;leaf('hanging_vine_leaf',[x+s*.12,y,.06],.2,[.1,0,s*-.75],i%3?P.green:P.sage);}}
      break;
    }
    case 'flower-planter': {
      const w=1.65,d=.63;bevelBox('planter_bottom',[w,.08,d],[0,.05,0],P.honey);
      for(const z of [-d*.5,d*.5])for(let y=0;y<2;y++)paintWood('planter_side_plank',[w,.15,.06],[0,.15+y*.16,z]);
      for(const x of [-w*.5,w*.5]){bevelBox('planter_end',[.07,.38,d],[x,.22,0],P.teal);for(const z of [-d*.4,d*.4])bolt('planter_corner_brass',[x,.43,z]);}
      box('planter_soil',[w*.94,.06,d*.8],[0,.32,0],P.soil);
      for(let i=0;i<8;i++){const x=(i-3.5)*.18,z=Math.sin(i*2)*.13,h=.62+random()*.22;beam('flower_stem',[x,.34,z],[x,h,z],.012,P.pine);flower('coral_cream_blossom',[x,h,z],i%2?P.coral:P.ivory);leaf('planter_leaf',[x+.055,.5,z],.14,[0,0,-.6],P.green);}break;
    }
    case 'moss-cluster': {
      for(let i=0;i<9;i++){const a=i/9*TAU,r=.25+random()*.26;sphere('low_irregular_moss',.22+random()*.13,[Math.cos(a)*r,.08,Math.sin(a)*r*.7],i%3?P.moss:P.sage,root,[1,.35,.8]);}break;
    }
    case 'potted-sapling': {
      pot('teal_sapling_pot',.35,.52,P.teal);ring('brass_pot_rim',.365,.025,[0,.52,0],P.brass);cylinder('sapling_soil',.3,.3,.02,[0,.45,0],P.soil,root,12);
      tube('young_sapling_trunk',[[0,.45,0],[.05,1,0],[-.05,1.4,.02]],.04,P.honey);
      canopy('young_sapling_crown',[0,1.55,0],.36,[1,.8,.9],P.green);
      for(const x of [-.37,.37])rope('cream_pot_handle',[[x,.22,-.12],[x*1.2,.37,0],[x,.22,.12]]);break;
    }

    // Portable props and recognizable harbor furniture.
    case 'crate-wood':crate('wood_supply_crate');break;
    case 'barrel-brass-banded':barrel('brass_banded_storage_barrel');break;
    case 'canvas-roll': {
      cylinder('thick_cream_canvas_roll',.29,.29,1.5,[0,.3,0],P.cream,root,16).rotation.z=Math.PI/2;
      for(const x of [-.76,.76]){
        const spiral=[];for(let i=0;i<=32;i++){const a=i/32*TAU*2,r=.04+i/32*.23;spiral.push([x,.3+Math.cos(a)*r,Math.sin(a)*r]);}tube('canvas_spiral_end',spiral,.012,P.woodLight);
      }
      for(const x of [-.44,.44]){const strap=ring('coral_canvas_tie',.3,.035,[x,.3,0],P.coral);strap.rotation.z=Math.PI/2;bevelBox('canvas_brass_buckle',[.12,.07,.09],[x,.6,.02],P.brass);}break;
    }
    case 'rope-coil': {
      for(let i=0;i<5;i++)ring('cream_coiled_rope',.22+i*.065,.025,[0,.065+i*.018,0],P.cream);
      rope('loose_rope_coil_tail',[[.52,.14,0],[.63,.05,.25],[.45,.03,.48],[.75,.03,.55]]);cylinder('rope_tail_brass_cap',.027,.027,.06,[.75,.035,.55],P.brass,root,8).rotation.x=Math.PI/2;break;
    }
    case 'mooring-ring': {
      bevelBox('mooring_teal_plate',[.55,.06,.38],[0,.03,0],P.teal);for(const x of [-.2,.2])for(const z of [-.12,.12])bolt('mooring_plate_screw',[x,.06,z]);
      cylinder('mooring_hinge',.065,.065,.22,[0,.12,0],P.brass,root,8).rotation.z=Math.PI/2;
      const r=ring('thick_brass_mooring_ring',.2,.045,[0,.29,0],P.brass);r.rotation.x=Math.PI/2;break;
    }
    case 'dock-bollard': {
      bevelBox('brass_bollard_foot',[.6,.08,.5],[0,.04,0],P.brass);cylinder('wood_bollard_post',.17,.21,.65,[0,.4,0],P.honey,root,12);
      bevelBox('teal_bollard_horns',[.76,.14,.22],[0,.77,0],P.teal);for(const x of [-.32,.32])sphere('rounded_horn_tip',.11,[x,.78,0],P.teal,root,[.8,.7,1]);
      for(let i=0;i<3;i++)ring('bollard_rope_wrap',.195,.018,[0,.26+i*.065,0],P.cream);break;
    }
    case 'lantern-hanging':lantern('hanging_warm_lantern');break;
    case 'lantern-standing':lantern('standing_warm_lantern',root,true);break;
    case 'cargo-basket': {
      pot('open_woven_basket',.47,.57,P.honey);for(let i=0;i<4;i++)ring('basket_horizontal_weave',.4+i*.015,.018,[0,.1+i*.135,0],P.woodLight);
      for(let i=0;i<14;i++){const a=i/14*TAU;beam('basket_upright_weave',[Math.cos(a)*.37,.05,Math.sin(a)*.37],[Math.cos(a)*.48,.58,Math.sin(a)*.48],.015,P.woodDark);}
      for(const x of [-.47,.47])rope('basket_cream_handle',[[x,.43,-.16],[x*1.13,.83,0],[x,.43,.16]]);
      bevelBox('basket_coral_repair',[.2,.15,.016],[0,.33,.475],P.coral);break;
    }
    case 'tool-rack': {
      const g=panelStand('tool_rack_frame',root,1.45,1.55);
      for(const x of [-.43,0,.43])cylinder('teal_tool_peg',.035,.035,.12,[x,1.22,.12],P.teal,g,8).rotation.x=Math.PI/2;
      wrench('hanging_brass_wrench',[-.43,.63,.15],g,.8);hammer('hanging_wood_hammer',[0,.62,.16],g,.8);
      const saw=group('short_saw',g);saw.position.set(.43,.75,.17);bevelBox('saw_teal_handle',[.15,.16,.05],[0,0,0],P.teal,saw);box('brass_saw_blade',[.4,.12,.025],[0,-.17,0],P.brass,saw);for(let i=0;i<6;i++)cone('saw_tooth',.026,.045,[(i-2.5)*.06,-.25,0],P.brass,saw,3).rotation.z=Math.PI;break;
    }
    case 'workbench-static': {
      const t=table('static_workbench',root,2.0,1.05,1);deck('workbench_low_shelf',1.65,.75,[0,.28,0],t);vise('fixed_workbench_vise',[.48,1.075,.15],t);box('cream_bench_pad',[.6,.014,.45],[-.45,1.075,0],P.cream,t);break;
    }
    case 'fuel-canister': {
      bevelBox('rounded_teal_canister',[.68,.75,.5],[0,.4,0],P.teal);
      for(const y of [.13,.64])bevelBox('coral_canister_band',[.7,.065,.52],[0,y,0],P.coral);
      cylinder('brass_canister_cap',.085,.085,.09,[.2,.84,0],P.brass,root,10);
      tube('teal_canister_handle',[[-.24,.76,0],[-.24,.98,0],[.11,.98,0],[.11,.76,0]],.035,P.deepTeal);
      for(let i=0;i<4;i++)cylinder('cream_handle_wrap',.042,.042,.025,[-.14+i*.045,.98,0],P.cream,root,8).rotation.z=Math.PI/2;break;
    }
    case 'scrap-bin': {
      pot('teal_open_scrap_bin',.48,.53,P.teal);ring('brass_scrap_bin_rim',.5,.028,[0,.53,0],P.brass);
      for(let i=0;i<9;i++){const x=(random()-.5)*.65,z=(random()-.5)*.6;const p=bevelBox('visible_scrap_piece',[.1+random()*.15,.18+random()*.28,.08],[x,.45+random()*.18,z],i%3?P.brass:P.woodLight);p.rotation.set(random()*.5,random()*2,(random()-.5)*1.4);}
      for(const x of [-.52,.52])rope('scrap_bin_short_handle',[[x,.28,-.1],[x*1.18,.4,0],[x,.28,.1]]);break;
    }
    case 'table-round': {
      cylinder('round_planked_table_top',.82,.82,.13,[0,1,0],P.honey,root,16);ring('table_brass_edge',.8,.018,[0,1.055,0],P.brass);
      cylinder('thick_table_pedestal',.12,.19,.85,[0,.49,0],P.teal,root,10);
      for(let i=0;i<2;i++)bevelBox('crossed_table_foot',[1.12,.12,.18],[0,.08,0],P.honey).rotation.y=i*Math.PI/2;
      for(let i=-2;i<=2;i++)box('round_table_plank_joint',[.008,.006,i===0?1.54:1.25],[i*.25,1.069,0],P.woodDark);break;
    }
    case 'bench-wood':bench('wood_harbor_bench');break;
    case 'market-stall': {
      const t=table('market_wood_counter',root,2.25,1.1,.95);deck('market_low_shelf',2,.8,[0,.22,0],t);
      for(const x of [-1.1,1.1])for(const z of [-.48,.48])cylinder('stall_canopy_post',.045,.06,2.35,[x,1.18,z],P.honey,t,8);
      cloth('sagging_market_canopy',2.55,1.55,[0,2.38,0],t);
      for(const x of [-1.1,1.1])ring('brass_canopy_corner',.07,.016,[x,2.4,.48],P.brass,t);
      for(let i=0;i<7;i++)paintWood('stall_front_vertical_plank',[.29,.55,.055],[(i-3)*.31,.63,.55],t);break;
    }
    case 'cooking-pot': {
      for(let i=0;i<3;i++){const a=i/3*TAU;beam('wood_pot_stand',[Math.cos(a)*.3,.05,Math.sin(a)*.3],[Math.cos(a)*.35,.6,Math.sin(a)*.35],.06,P.honey);}
      const potG=group('rounded_teal_cooking_pot');potG.position.y=.5;pot('teal_cooking_bowl',.45,.5,P.teal,potG);cone('cooking_pot_lid',.46,.14,[0,.57,0],P.teal,potG,12);sphere('brass_lid_grip',.07,[0,.68,0],P.brass,potG);
      for(const x of [-.47,.47]){const r=ring('brass_pot_handle',.13,.025,[x,.35,0],P.brass,potG);r.rotation.x=Math.PI/2;}
      tube('brass_ladle_handle',[[.2,1.15,0],[.28,1.4,.02],[.4,1.38,.02]],.018,P.brass);sphere('cream_ladle_cup',.09,[.17,1.1,0],P.cream,root,[1,.45,1]);break;
    }
    case 'empty-bell-frame': {
      for(const x of [-.92,.92]){paintWood('old_bell_frame_upright',[.17,2.8,.2],[x,1.4,0]);bevelBox('bell_frame_teal_foot',[.6,.1,.7],[x,.06,0],P.teal);beam('bell_frame_foot_brace',[x,.12,.3],[x,.8,0],.05,P.honey);}
      tube('curved_empty_bell_arch',[[-1,2.72,0],[-.65,3.05,0],[0,3.14,0],[.65,3.05,0],[1,2.72,0]],.11,P.honey);
      const hook=ring('empty_brass_bell_hanger',.13,.028,[0,2.89,0],P.brass);hook.rotation.x=Math.PI/2;
      rope('short_unattached_bell_rope',[[.15,2.87,0],[.18,2.56,.03],[.08,2.34,.02]]);break;
    }

    // Navigation symbols are solid objects, with no invented text or UI claims.
    case 'world-map-table': {
      const t=table('world_map_chart_table',root,3.25,2.2,1);const chart=mapSurface('open_cream_world_chart',t,2.9,1.85);chart.position.y=1.08;
      for(const x of [-1.5,1.5])for(const z of [-.98,.98])bolt('chart_table_brass_corner',[x,1.075,z],t);
      const pen=cylinder('brass_map_pen',.018,.018,.6,[.98,1.13,.35],P.brass,t,6);pen.rotation.set(Math.PI/2,0,.4);compass('chart_corner_compass',[-1.05,1.09,.6],t,.24);break;
    }
    case 'route-node': {
      cylinder('hex_teal_route_pedestal',.27,.31,.14,[0,.07,0],P.teal,root,6);sphere('cream_route_landmark',.16,[0,.34,0],P.cream,root,[1,1.3,1]);ring('brass_route_halo',.19,.02,[0,.37,0],P.brass);
      cone('coral_forward_route_point',.055,.16,[0,.17,.24],P.coral,root,4).rotation.x=Math.PI/2;break;
    }
    case 'route-segment': {
      beam('thick_brass_route_connection',[0,.1,-.65],[0,.1,.65],.035,P.brass);
      for(const z of [-.65,.65]){ring('brass_route_endpoint',.09,.018,[0,.1,z],P.brass);cylinder('teal_route_foot',.11,.11,.04,[0,.025,z],P.teal,root,8);}
      for(let i=0;i<3;i++)rope('route_middle_cream_knot',[[-.045,.1,-.08+i*.07],[0,.16,-.08+i*.07],[.045,.1,-.08+i*.07]]);break;
    }
    case 'route-fork': {
      const ends=[[0,.12,-.6],[-.5,.12,.48],[.5,.12,.48]];
      for(const end of ends){tube('brass_route_fork_arm',[[0,.12,0],[end[0]*.5,.12,end[2]*.4],end],.035,P.brass);cylinder('teal_fork_endcap',.085,.085,.04,end,P.teal,root,8);}
      ring('cream_route_fork_knot',.08,.018,[0,.13,0],P.cream);cylinder('route_fork_underfoot',.13,.16,.07,[0,.04,0],P.deepTeal,root,8);break;
    }
    case 'route-gate': {
      for(const x of [-.45,.45]){bevelBox('teal_route_gate_column',[.11,.95,.16],[x,.48,0],P.teal);bevelBox('brass_route_gate_foot',[.28,.06,.3],[x,.03,0],P.brass);}
      tube('teal_route_gate_arch',[[-.45,.94,0],[-.25,1.16,0],[0,1.22,0],[.25,1.16,0],[.45,.94,0]],.065,P.teal);
      bevelBox('cream_route_gate_panel',[.5,.22,.05],[0,.97,.04],P.cream);cone('gate_forward_triangle',.08,.16,[0,.97,.1],P.coral,root,3).rotation.x=Math.PI/2;break;
    }
    case 'compass-rose':compass('solid_compass_rose',[0,0,0]);break;
    case 'wind-vane': {
      bevelBox('vane_teal_foot',[.4,.07,.4],[0,.035,0],P.teal);cylinder('vane_brass_axis',.025,.045,1.5,[0,.8,0],P.brass,root,8);ring('vane_mid_collar',.08,.018,[0,1.23,0],P.brass);
      beam('teal_wind_arrow_shaft',[-.57,1.58,0],[.47,1.58,0],.028,P.teal);cone('teal_wind_arrow_head',.13,.28,[.57,1.58,0],P.teal,root,3).rotation.z=-Math.PI/2;
      const tail=bevelBox('cream_wind_tail',[.28,.25,.035],[-.48,1.58,0],P.cream);tail.rotation.z=.12;sphere('vane_brass_axis_cap',.065,[0,1.68,0],P.brass);break;
    }
    case 'signal-flag': {
      cylinder('wood_flag_mast',.025,.045,2,[0,1,0],P.honey,root,9);bevelBox('flag_teal_foot',[.45,.06,.4],[0,.03,0],P.teal);
      const f=cloth('cream_coral_signal_flag',1,.65,[.52,1.64,0]);f.rotation.x=Math.PI/2;
      for(const y of [1.34,1.96]){ring('brass_flag_attachment',.055,.012,[0,y,0],P.brass);rope('flag_cream_tie',[[0,y,0],[.09,y+.025,0],[.12,y-.04,0]]);}sphere('flag_mast_finial',.065,[0,2.06,0],P.brass);break;
    }
    case 'beacon-buoy': {
      sphere('rounded_teal_buoy_float',.48,[0,.22,0],P.teal,root,[1,.45,1]);ring('brass_float_rim',.44,.035,[0,.25,0],P.brass);cylinder('buoy_lantern_pole',.04,.06,.55,[0,.58,0],P.brass,root,8);
      const l=lantern('beacon_lantern');l.position.y=.77;for(const x of [-.43,.43]){const r=ring('buoy_mooring_loop',.075,.02,[x,.22,0],P.brass);r.rotation.x=Math.PI/2;}break;
    }
    case 'harbor-sign': {
      const g=panelStand('harbor_direction_frame',root,1.4,1.7);const r=ring('abstract_brass_harbor_mark',.21,.03,[0,1.15,.09],P.brass,g);r.rotation.x=Math.PI/2;
      cylinder('cream_harbor_mark_center',.075,.075,.025,[0,1.15,.1],P.cream,g,10).rotation.x=Math.PI/2;break;
    }
    case 'warning-arch': {
      for(const x of [-1.3,1.3]){paintWood('warning_wood_column',[.17,2.6,.2],[x,1.3,0]);bevelBox('warning_teal_foot',[.5,.08,.5],[x,.04,0],P.teal);for(const y of [.28,1.7])bevelBox('warning_brass_column_band',[.2,.06,.23],[x,y,0],P.brass);}
      paintWood('warning_top_crossbeam',[2.95,.17,.22],[0,2.65,0]);bevelBox('cream_warning_panel',[2.45,.32,.08],[0,2.24,.03],P.cream);
      for(let i=0;i<6;i++)bevelBox('coral_warning_division',[.11,.27,.017],[(i-2.5)*.37,2.24,.08],P.coral).rotation.z=-.35;break;
    }
    case 'boundary-marker': {
      cylinder('short_teal_boundary_post',.17,.23,.85,[0,.44,0],P.teal,root,10);ring('brass_boundary_collar',.19,.035,[0,.7,0],P.brass);cylinder('brass_boundary_base',.28,.28,.07,[0,.035,0],P.brass,root,10);
      bevelBox('cream_boundary_mark',[.13,.29,.02],[0,.42,.18],P.cream).rotation.z=.15;cone('coral_boundary_cap',.2,.19,[0,.94,0],P.coral,root,10);break;
    }

    // Interaction candidates: recognizable physical contact points, static only.
    case 'repair-station': {
      const t=table('repair_station_table',root,2.1,1.2,1.05);deck('repair_low_shelf',1.8,.85,[0,.3,0],t);vise('brass_repair_station_vise',[.55,1.125,0],t);
      const patch=cloth('cream_repair_pad',.75,.6,[-.45,1.13,.1],t);patch.scale.y=.35;const h=hammer('coral_repair_tools',[-.78,1.17,-.26],t,.55);h.rotation.x=Math.PI/2;break;
    }
    case 'crafting-anvil': {
      cylinder('wood_anvil_stump',.4,.48,.7,[0,.35,0],P.honey,root,12);for(const y of [.14,.56])ring('brass_anvil_stump_band',.43,.025,[0,y,0],P.brass);
      const shape=new THREE.Shape();shape.moveTo(-.62,.25);shape.lineTo(-.18,.25);shape.lineTo(-.18,-.1);shape.lineTo(-.32,-.24);shape.lineTo(.28,-.24);shape.lineTo(.18,-.1);shape.lineTo(.18,.25);shape.lineTo(.52,.25);shape.lineTo(.73,.36);shape.lineTo(.43,.44);shape.lineTo(-.62,.44);shape.closePath();
      const anvil=mesh('rounded_teal_anvil',new THREE.ExtrudeGeometry(shape,{depth:.4,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025}),P.teal);anvil.position.set(0,.96,-.2);
      const h=hammer('crafting_hammer',[.4,.1,.35],root,.75);h.rotation.z=-.45;paintWood('anvil_side_tool_board',[.4,.08,.55],[-.48,.1,.15]);break;
    }
    case 'mission-board': {
      const g=panelStand('mission_notice_frame',root,1.8,2.25);paintWood('tall_notice_panel',[1.8,1.15,.1],[0,1.5,0],g);
      for(let i=0;i<4;i++){const x=(i%2-.5)*.7,y=1.2+Math.floor(i/2)*.5;bevelBox('blank_cream_mission_paper',[.5,.38,.018],[x,y,.075],P.cream,g).rotation.z=(i%2?1:-1)*.05;sphere('brass_notice_tack',.026,[x,y+.14,.1],P.brass,g,[1,1,.4]);}
      bevelBox('coral_notice_corner',[.12,.32,.018],[.65,1.9,.09],P.coral,g).rotation.z=-.3;break;
    }
    case 'trade-counter': {
      const t=table('trade_wood_counter',root,2.2,1,1);for(let i=0;i<6;i++)paintWood('counter_front_plank',[.31,.64,.05],[(i-2.5)*.34,.66,.5],t);box('cream_trade_pad',[.65,.012,.55],[-.55,1.075,.06],P.cream,t);
      cylinder('teal_scale_pedestal',.12,.16,.08,[.48,1.12,0],P.teal,t,10);cylinder('brass_scale_axis',.025,.04,.5,[.48,1.4,0],P.brass,t,8);beam('brass_balance_beam',[.05,1.65,0],[.92,1.65,0],.025,P.brass,t);
      for(const x of [.1,.86]){const bowl=pot('brass_balance_pan',.16,.1,P.brass,t);bowl.position.set(x,1.25,0);for(const z of [-.1,.1])rope('cream_scale_pan_suspension',[[x,1.65,0],[x,1.31,z]],t);}
      cone('small_brass_scale_weight',.07,.14,[.1,1.41,0],P.brass,t,8);break;
    }
    case 'storage-chest': {
      const c=group('wood_storage_chest');paintWood('chest_wood_body',[1.45,.6,.94],[0,.33,0],c);
      const lid=mesh('curved_wood_chest_lid',new THREE.CylinderGeometry(.47,.47,1.45,12,1,false,0,Math.PI),P.honey,c);lid.position.y=.63;lid.rotation.z=Math.PI/2;
      for(const x of [-.48,.48]){const band=mesh('curved_teal_chest_band',new THREE.TorusGeometry(.48,.035,4,12,Math.PI),P.teal,c);band.position.set(x,.63,0);band.rotation.y=Math.PI/2;bevelBox('vertical_teal_chest_band',[.08,.56,.97],[x,.33,0],P.teal,c);}
      bevelBox('brass_chest_lockplate',[.2,.2,.06],[0,.57,.51],P.brass,c);const lock=ring('chest_lock_loop',.065,.018,[0,.48,.55],P.brass,c);lock.rotation.x=Math.PI/2;
      for(const x of [-.48,.48])bevelBox('brass_chest_hinge',[.13,.14,.06],[x,.62,-.49],P.brass,c);
      for(const x of [-.76,.76]){const handle=ring('chest_carrying_handle',.11,.022,[x,.35,0],P.brass,c);handle.rotation.z=Math.PI/2;}break;
    }
    case 'departure-console': {
      const t=table('departure_console_stand',root,1.5,1.1,.95),panel=group('tilted_departure_panel',t);panel.position.y=1.12;panel.rotation.x=-.23;
      paintWood('slanted_wood_chart_panel',[1.75,.1,1.3],[0,0,0],panel);const chart=mapSurface('departure_cream_chart',panel,1.55,1.08);chart.position.y=.06;
      compass('departure_brass_compass',[.47,.09,.28],panel,.2);for(const x of [-.87,.87])rope('cream_console_grip',[[x,.02,-.2],[x*1.12,.08,0],[x,.02,.2]],panel);break;
    }
    case 'memory-desk': {
      const t=table('memory_wood_desk',root,1.95,1.1,1);box('cream_desk_runner',[1.5,.014,.65],[0,1.075,0],P.cream,t);
      bevelBox('closed_cream_memory_journal',[.62,.12,.42],[-.32,1.15,.18],P.cream,t);bevelBox('coral_journal_spine',[.045,.14,.45],[-.62,1.15,.18],P.coral,t);
      bevelBox('teal_record_box',[.38,.32,.35],[.54,1.23,-.2],P.teal,t);const obs=ring('brass_observation_ring',.23,.035,[.52,1.66,-.19],P.brass,t);obs.rotation.x=Math.PI/2;beam('observation_ring_post',[.52,1.4,-.19],[.52,1.55,-.19],.025,P.brass,t);
      const l=lantern('small_memory_lamp',t);l.position.set(-.65,1.075,-.3);l.scale.setScalar(.52);break;
    }
    case 'mooring-winch':winch('mooring_rope_winch');break;
    case 'salvage-crane': {
      deck('crane_wood_base',1.75,1.3,[0,.08,0]);cylinder('brass_crane_turntable',.42,.5,.12,[0,.2,0],P.brass,root,12);
      tube('curved_teal_crane_boom',[[0,.28,0],[0,2.35,0],[.3,2.8,0],[1.15,3.1,0]],.11,P.teal);
      beam('crane_diagonal_brace',[-.38,.28,0],[0,1.75,0],.06,P.deepTeal);beam('upper_crane_brace',[0,2.1,0],[1.05,3,0],.04,P.brass);
      const drum=cylinder('crane_brass_winch',.2,.2,.46,[0,.82,.17],P.brass,root,10);drum.rotation.z=Math.PI/2;
      rope('crane_lifting_rope',[[0,.82,.38],[.05,2.35,.15],[1.15,3.1,.03],[1.15,1.32,.03]]);
      tube('brass_salvage_crane_hook',[[1.15,1.35,.03],[1.15,1.11,.03],[1.3,1.04,.03],[1.43,1.16,.03],[1.39,1.27,.03]],.035,P.brass);
      const pin=ring('crane_upper_pulley',.12,.025,[1.15,3.1,0],P.brass);pin.rotation.x=Math.PI/2;break;
    }
    case 'fuel-pump': {
      paintWood('fuel_pump_wood_base',[1.05,.1,.8],[0,.05,0]);cylinder('rounded_teal_fuel_reservoir',.34,.4,.88,[0,.54,0],P.teal,root,12);for(const y of [.18,.86])ring('fuel_tank_brass_band',.37,.025,[0,y,0],P.brass);
      cylinder('brass_hand_pump',.085,.1,.48,[0,1.18,0],P.brass,root,10);cylinder('pump_piston_rod',.025,.025,.25,[0,1.53,0],P.brass,root,8);bevelBox('wood_pump_handle',[.65,.075,.08],[0,1.66,0],P.honey);
      tube('short_curved_teal_fuel_hose',[[.1,1.15,0],[.55,1.06,.1],[.61,.32,.13],[.42,.23,.32]],.035,P.deepTeal);beam('brass_fuel_nozzle',[.42,.23,.32],[.58,.4,.35],.028,P.brass);break;
    }
    case 'lift-platform': {
      deck('lift_wood_platform',2.15,1.6,[0,.3,0]);
      for(const x of [-1.04,1.04]){bevelBox('teal_lift_guide',[.12,2.9,.16],[x,1.5,-.55],P.teal);const pulley=ring('brass_lift_upper_pulley',.13,.028,[x,3.04,-.55],P.brass);pulley.rotation.x=Math.PI/2;rope('lift_cream_support_rope',[[x,.35,-.5],[x,3.05,-.5],[x,.2,-.66]]);}
      bevelBox('teal_lift_crossframe',[2.25,.12,.18],[0,2.98,-.55],P.deepTeal);
      for(const x of [-.93,.93]){beam('lift_low_railing_post',[x,.36,.6],[x,.95,.6],.025,P.brass);beam('lift_railing_side',[x,.95,-.45],[x,.95,.6],.025,P.brass);}break;
    }
    case 'safety-anchor': {
      paintWood('anchor_wood_foot',[1.25,.12,.85],[0,.06,0]);bevelBox('teal_anchor_locking_cradle',[.42,.3,.32],[0,.26,0],P.teal);
      beam('brass_anchor_shaft',[0,.35,0],[0,1.4,0],.055,P.brass);beam('anchor_crossbar',[-.46,1.12,0],[.46,1.12,0],.045,P.brass);
      const crown=ring('anchor_upper_rope_eye',.12,.032,[0,1.5,0],P.brass);crown.rotation.x=Math.PI/2;
      for(const sign of [-1,1]){tube('rounded_anchor_fluke',[[0,.47,0],[sign*.3,.36,0],[sign*.53,.5,0],[sign*.52,.78,0]],.065,P.brass);const tip=cone('anchor_upturned_fluke_point',.12,.25,[sign*.5,.83,0],P.brass,root,4);tip.rotation.z=sign*.3;}
      rope('anchor_short_cream_tether',[[0,1.62,0],[.25,1.25,.12],[.65,.35,.12],[.45,.14,.32]]);bevelBox('anchor_brass_latch',[.2,.07,.08],[0,.43,.2],P.brass);break;
    }
    default:throw new Error('Secondary world asset not implemented: '+spec.id);
  }
  root.userData.build_method='Original local parametric 3D assembly with face-painted unlit geometry.';
  root.userData.gameplay='Static visual prototype only; interaction, collision, growth, wind and resource transfers are not implemented.';
  return root;
}
