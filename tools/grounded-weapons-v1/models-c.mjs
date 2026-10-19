// Board v2, cells 09–12: grounded workshop machines. Static multipart study.
// Bold silhouettes come from useful mechanisms, never magic or particle effects.
export function buildC(id,k) {
  const {THREE:T,palette:p,root}=k;
  const iron=p.iron??p.navy, steel=p.steel??0x68757b;
  function prism(name,pts,depth,pos,color,parent=root,bevel=.018){
    const s=new T.Shape();pts.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
    const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:bevel});
    g.translate(0,0,-depth/2);const m=k.mesh(name,g,color,parent);m.position.set(...pos);return m;
  }
  function axle(name,r,len,pos,color,parent=root){const m=k.cylinder(name,r,r,len,pos,color,parent,32);m.rotation.x=Math.PI/2;return m;}
  function hoop(name,r,t,pos,color,parent=root){const m=k.ring(name,r,t,pos,color,parent);m.rotation.x=Math.PI/2;return m;}
  function beam(name,a,b,w,d,color,parent=root){
    const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av);
    const m=k.bevelBox(name,[w,v.length(),d],av.add(bv).multiplyScalar(.5).toArray(),color,parent);
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;
  }
  function faceBolts(name,r,z,n,parent=root,y=0,x=0){for(let i=0;i<n;i++){
    const a=i*Math.PI*2/n;axle(name,.028,.045,[x+Math.cos(a)*r,y+Math.sin(a)*r,z],p.brass,parent);
  }}
  function foot(w,d){
    k.deck('oak_mounting_sill',w,d,[0,.12,0]);
    for(const x of [-w*.39,w*.39])for(const z of [-d*.34,d*.34]){
      k.bevelBox('cast_teal_deck_shoe',[.29,.22,.32],[x,.15,z],p.deepTeal);
      k.bolt('shoe_fastener',[x,.265,z]);
    }
  }
  function journal(x,y,z,r=.15,parent=root){
    axle('iron_journal',r,.27,[x,y,z],iron,parent);axle('brass_bearing_face',r*.76,.3,[x,y,z+.03],p.brass,parent);
    axle('hex_axle_cap',r*.37,.34,[x,y,z+.045],p.woodDark,parent);
    faceBolts('bearing_rivet',r*.55,z+.195,6,parent,y,x);
  }
  function collar(name,pos,size,color,parent=root){k.bevelBox(name,size,pos,color,parent);}
  if(id==='09-side-circular-saw'){
    foot(1.55,1.15);
    for(const z of [-.37,.37]){
      beam('tall_oak_pivot_post',[-.83,.23,z],[-.83,2.27,z],.23,.22,p.honey);
      beam('slanting_post_strut',[-.23,.25,z],[-.83,1.66,z],.14,.16,p.woodDark);
      collar('post_iron_heel',[-.83,.43,z],[.28,.24,.27],iron);
      collar('post_brass_crown',[-.83,2.12,z],[.28,.14,.27],p.brass);
      k.bolt('post_top_bolt',[-.83,2.2,z]);
    }
    const arm=k.group('articulated_saw_boom_STATIC');
    for(const z of [-.24,.24]){
      prism('curved_oak_cheek',[[-1.01,1.38],[-.88,1.65],[.89,1.85],[.99,1.56],[.28,1.39]],.13,[0,0,z],p.honey,arm);
      k.tube('wood_grain_swoop',[[-.87,1.5,z+.075],[-.2,1.54,z+.075],[.72,1.69,z+.075]],.009,p.woodDark,arm);
      beam('brass_edge_reinforcement',[-.82,1.64,z],[.76,1.82,z],.055,.17,p.brass,arm);
    }
    journal(-.82,1.55,0,.22,arm);journal(.78,1.69,0,.22,arm);
    const blade=k.group('rotating_toothed_disc_STATIC',arm);blade.position.set(.88,1.69,.36);
    axle('tempered_saw_body',.83,.075,[0,0,0],steel,blade);
    const teeth=32;
    for(let i=0;i<teeth;i++){
      const a=i*Math.PI*2/teeth,r=.8;
      const m=prism('hook_cutting_tooth',[[0,0],[.17,.055],[.12,.20],[-.035,.11]],.065,[r*Math.cos(a),r*Math.sin(a),0],p.silver??0x9aa9a9,blade,.006);m.rotation.z=a-Math.PI/2;
    }
    hoop('annular_blade_forging',.66,.018,[0,0,.05],p.silver??0x9aa9a9,blade);
    axle('wide_brass_clamp_hub',.27,.16,[0,0,.025],p.brass,blade);faceBolts('blade_lock_rivets',.19,.12,8,blade);
    axle('axle_nose',.1,.22,[0,0,.055],iron,blade);
    // Open upper guard: the cutting edge remains readable below.
    const guard=prism('upper_teal_blade_guard',[[-.84,0],[-.76,.43],[-.43,.77],[.12,.89],[.64,.62],[.85,.16],[.69,.16],[.5,.5],[.05,.69],[-.36,.59],[-.61,.3],[-.66,0]],.13,[.88,1.69,.36],p.teal,arm,.012);
    for(let i=0;i<7;i++){const a=.25+i*.42;axle('guard_brass_rivet',.027,.16,[.88+Math.cos(a)*.77,1.69+Math.sin(a)*.77,.44],p.brass,arm);}
    axle('lower_drive_pulley',.34,.14,[-.82,.86,-.46],p.brass);
    axle('upper_boom_pulley',.21,.14,[-.82,1.55,-.46],iron,arm);
    k.tube('taut_leather_drive_belt',[[-1.13,.86,-.49],[-1.02,1.55,-.49],[-.82,1.75,-.49],[-.62,1.55,-.49],[-.51,.86,-.49],[-.82,.55,-.49]],.034,p.woodDark,root,true);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;const t=k.box('drive_gear_tooth',[.09,.11,.1],[-.82+.39*Math.cos(a),.86+.39*Math.sin(a),-.44],iron);t.rotation.z=a;}
    k.tube('control_handle',[[-.98,1.67,-.22],[-1.24,1.91,-.22],[-1.3,1.91,.14]],.04,p.brass);
    axle('coral_handle_grip',.065,.32,[-1.3,1.91,0],p.coral);
  } else if(id==='10-chain-flail'){
    foot(1.7,1.3);
    const boom=k.group('curved_lifting_boom_STATIC');
    for(const z of [-.23,.23]){
      prism('laminated_arch_oak',[[.49,.28],[.94,.31],[.87,1.26],[.57,2.1],[-.05,2.66],[-.91,2.95],[-1.14,2.83],[-.18,2.39],[.23,1.89],[.45,1.16]],.24,[0,0,z],p.honey,boom);
      for(let j=0;j<3;j++)k.tube('arched_grain',[[.63+j*.045,.58,z+.13],[.58+j*.04,1.35,z+.13],[.23+j*.04,2.1,z+.13],[-.61+j*.04,2.68,z+.13]],.008,j%2?p.woodLight:p.woodDark,boom);
      beam('base_diagonal_support',[-.12,.28,z],[.65,1.4,z],.17,.2,p.woodDark,boom);
    }
    for(const [x,y,rot] of [[.66,.55,0],[.65,1.26,-.2],[.32,2.18,-.65],[-.72,2.78,-1.1]]){
      const band=k.bevelBox('dark_boom_strap',[.5,.18,.78],[x,y,0],iron,boom);band.rotation.z=rot;
      for(const z of [-.43,.43])axle('strap_rivet',.043,.045,[x-.13,y,z],p.brass,boom);
    }
    journal(.66,.43,0,.24,boom);journal(-.99,2.84,0,.17,boom);
    const hanging=k.group('chain_and_forged_weight_STATIC');
    for(let i=0;i<6;i++){
      const link=k.mesh('interlocking_oval_chain_link',new T.TorusGeometry(.095,.028,7,18),iron,hanging);link.position.set(-1.01+i*.012,2.69-i*.14,.04);link.scale.y=1.38;if(i%2)link.rotation.y=Math.PI/2;
    }
    const weight=k.group('heavy_rope_lashed_weight_STATIC',hanging);weight.position.set(-.94,1.31,.04);
    k.sphere('forged_iron_weight',.47,[0,0,0],iron,weight,[1.05,1,.98]);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,pts=[];for(let j=0;j<=32;j++){const b=j*Math.PI*2/32;pts.push([Math.cos(a)*Math.sin(b)*.49,Math.cos(b)*.49,Math.sin(a)*Math.sin(b)*.49]);}
      k.tube('rope_meridian_lashing',pts,.025,p.cream,weight,true);
    }
    for(const y of [-.27,0,.27]){const r=Math.sqrt(.49*.49-y*y);k.ring('rope_equator_lashing',r,.026,[0,y,0],p.woodLight,weight);}
    axle('winch_drum',.22,.7,[.6,.85,-.54],p.woodDark);
    for(let i=0;i<12;i++)hoop('winch_coiled_rope',.225,.018,[.6,.85,-.86+i*.055],p.cream);
    for(const z of [-.96,-.16])axle('winch_brass_flange',.28,.055,[.6,.85,z],p.brass);
    beam('winch_crank',[.6,.85,-1.01],[.9,1.06,-1.01],.055,.055,p.brass);
    axle('crank_wood_grip',.06,.22,[.9,1.06,-1.1],p.coral);
    k.rope('load_control_rope',[[.57,1.03,-.6],[.28,1.91,-.48],[-.18,2.56,-.29],[-1,2.9,-.15]]);
    const flag=k.cloth('small_repaired_canvas',.38,.46,[.88,1.6,-.24]);flag.rotation.z=Math.PI/2;
  } else if(id==='11-pneumatic-fan'){
    foot(1.85,1.9);
    for(const x of [-.63,.63]){
      beam('splayed_drum_cradle',[x,.24,-.7],[x*.8,1.13,-.48],.19,.22,p.honey);
      beam('front_drum_cradle',[x,.24,.69],[x*.8,1.13,.54],.19,.22,p.honey);
    }
    const drum=k.group('circular_wood_drum_STATIC');drum.position.set(0,1.37,.48);
    axle('dark_open_fan_throat',.91,.29,[0,0,0],p.ink,drum);
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8;const stave=k.bevelBox('individual_drum_stave',[.19,.19,.4],[Math.cos(a)*.95,Math.sin(a)*.95,0],i%3?p.honey:p.woodLight,drum);stave.rotation.z=a;
    }
    hoop('front_brass_drum_rim',1.005,.048,[0,0,.23],p.brass,drum);
    hoop('rear_iron_drum_rim',1.005,.037,[0,0,-.22],iron,drum);
    const fan=k.group('six_teal_fan_blades_STATIC',drum);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      const b=prism('broad_curved_enamel_blade',[[.13,-.11],[.43,-.22],[.83,-.14],[.91,.1],[.83,.3],[.48,.25],[.18,.09]],.035,[0,0,.2],i%2?p.teal:p.deepTeal,fan,.012);b.rotation.z=a;b.rotation.y=.17;
      const rib=k.group('blade_brass_rib',fan);rib.rotation.z=a;
      beam('blade_stiffening_rib',[.22,.005,.235],[.81,.12,.235],.025,.025,p.brass,rib);
      axle('blade_root_pin',.035,.06,[.29,.015,.24],p.brass,rib);
    }
    axle('brass_fan_hub',.25,.25,[0,0,.25],p.brass,fan);
    axle('teal_hub_cap',.15,.3,[0,0,.28],p.teal,fan);faceBolts('hub_screw',.19,.4,8,fan);
    // Pleated cream bellows tapered rearward; rings are structural folds.
    const bellows=k.group('pleated_canvas_pressure_bellows_STATIC');
    const profile=[];for(let i=0;i<=20;i++){const t=i/20;profile.push(new T.Vector2(.84-t*.29+(i%2?-.055:.035),t*1.3));}
    const fabric=k.mesh('continuous_cream_accordion_canvas',new T.LatheGeometry(profile,48),p.cream,bellows);fabric.rotation.x=-Math.PI/2;fabric.position.set(0,1.37,.16);
    for(let i=0;i<11;i++)hoop('bellows_fold_seam',.875-i*.029,.012,[0,1.37,.16-i*.13],p.woodLight,bellows);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;const pts=[];for(let j=0;j<6;j++){const t=j/5,r=.89-t*.29;pts.push([Math.cos(a)*r,1.37+Math.sin(a)*r,.18-t*1.3]);}
      k.tube('longitudinal_canvas_tie',pts,.019,p.woodDark,bellows);
    }
    axle('rear_pressure_cap',.59,.12,[0,1.37,-1.2],p.honey);hoop('rear_cap_brass_band',.59,.036,[0,1.37,-1.28],p.brass);
    faceBolts('front_rim_fastener',1.01,.755,16,root,1.37,0);
    const patch=k.cloth('coral_canvas_repair',.3,.32,[.64,1.87,-.43],bellows);patch.rotation.z=-.85;
    k.tube('bent_pressure_pipe',[[.58,.44,-.6],[.94,.58,-.7],[1.02,1.04,-1.04],[.52,1.37,-1.18]],.065,p.brass);
    const crank=hoop('coral_pressure_valve',.16,.028,[.99,.8,-.79],p.coral);crank.rotation.y=.4;
    beam('valve_crossbar',[.84,.8,-.79],[1.14,.8,-.79],.025,.025,p.brass);
  } else if(id==='12-folding-ram'){
    foot(1.65,2.02);
    for(const x of [-.61,.61]){
      beam('rear_pivot_upright',[x,.22,-.82],[x,2.17,-.82],.22,.22,p.honey);
      collar('post_iron_foot',[x,.42,-.82],[.29,.25,.29],iron);
      beam('folding_diagonal_brace',[x,.37,.64],[x,1.94,-.75],.16,.18,p.honey);
      beam('lower_folding_link',[x,.34,-.75],[x,1.17,.49],.14,.17,p.woodDark);
      for(const [y,z] of [[.39,.6],[1.17,.49],[1.96,-.78]]){
        const pin=k.cylinder('hinge_locking_pin',.085,.085,.37,[x,y,z],p.brass,root,16);pin.rotation.z=Math.PI/2;
        const washer=k.ring('locking_pin_retainer',.105,.022,[x+(x<0?-.2:.2),y,z],iron);washer.rotation.z=Math.PI/2;
      }
    }
    const ram=k.group('long_folding_ram_body_STATIC');
    // Long tapering wooden wedge, wider and taller at the rear.
    const body=prism('tapered_laminated_oak_ram',[[-.57,-.48],[.57,-.48],[.43,.43],[-.43,.43]],1.9,[0,1.26,-.05],p.honey,ram,.04);
    for(let i=0;i<5;i++){
      const y=.88+i*.16;
      for(const side of [-1,1]){
        k.tube('long_wood_lamination',[[side*.55,y,-.95],[side*.54,y+.025,-.3],[side*.5,y+.045,.67]],.011,i%2?p.woodDark:p.woodLight,ram);
      }
    }
    // Triangular iron nose in side profile, extruded across the beam width.
    const nose=prism('forged_triangular_steel_striking_tip',[[-.37,-.46],[-.37,.43],[.58,-.13]],.94,[0,0,0],iron,ram,.023);
    nose.rotation.y=-Math.PI/2;nose.position.set(0,1.26,1.13);
    for(const x of [-.49,.49]){
      const plate=prism('brass_edge_of_nose',[[-.38,-.45],[-.38,.42],[.56,-.13],[.39,-.1],[-.31,.3],[-.31,-.36]],.028,[0,0,0],p.brass,ram,.004);plate.rotation.y=-Math.PI/2;plate.position.set(x,1.26,1.13);
      for(const [y,z] of [[.94,.87],[1.52,.87],[1.16,1.42]]){const riv=k.cylinder('nose_forging_rivet',.037,.037,.035,[x*1.04,y,z],p.silver??0x9aa9a9,ram,12);riv.rotation.z=Math.PI/2;}
    }
    for(const z of [-.71,.26]){
      collar('iron_ram_wrap',[0,1.25,z],[1.2,.97,.12],iron,ram);
      for(const x of [-.61,.61])for(const y of [.92,1.55]){const pin=k.cylinder('wrap_rivet',.035,.035,.035,[x,y,z],p.brass,ram,12);pin.rotation.z=Math.PI/2;}
    }
    axle('rear_fold_pivot',.17,.98,[0,1.85,-.82],p.brass);
    k.rope('upper_tension_rope',[[-.61,2.17,-.84],[-.62,1.95,-.05],[-.59,1.71,.53]]);
    k.rope('upper_tension_rope',[[.61,2.17,-.84],[.62,1.95,-.05],[.59,1.71,.53]]);
    k.tube('release_lever',[[.82,.57,-.6],[.92,.84,-.5],[.88,1.11,-.47]],.035,p.brass);
    k.sphere('coral_release_grip',.08,[.88,1.11,-.47],p.coral);
    k.bevelBox('small_teal_service_cover',[.24,.36,.035],[.1,1.77,-1.04],p.teal);
  } else throw new Error('Unsupported C weapon: '+id);
  root.userData.reference='outputs/fantasy-weapon-moodboard-v2/moodboard.png, cells 09–12';
  root.userData.art_intent='Grounded handmade mechanical weapon: dominant useful silhouette, layered wood/teal/brass/cloth. Latest request limits supernatural exaggeration.';
  root.userData.limitations='Static multipart visual study only; named moving assemblies have no rig, animation, collision, or gameplay.';
  return root;
}
