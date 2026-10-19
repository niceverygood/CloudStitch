// Grounded workshop weapons, matching approved moodboard v2. Static art only.
// Large functional silhouettes and layered craft materials, without magical ornaments.
export function buildB(id,k) {
  const {THREE:T,palette:p}=k;
  const B=(n,s,v,c=p.honey,g=k.root)=>k.bevelBox(n,s,v,c,g);
  const beam=(n,a,b,w=.16,d=.16,c=p.honey,g=k.root)=>k.beam(n,a,b,w,d,c,g);
  const axis=(n,r,h,v,c=p.brass,g=k.root)=>{const m=k.cylinder(n,r,r,h,v,c,g,24);m.rotation.z=Math.PI/2;return m;};
  const frontDisk=(n,r,h,v,c,g=k.root)=>{const m=k.cylinder(n,r,r,h,v,c,g,24);m.rotation.x=Math.PI/2;return m;};
  const boltFront=(x,y,z,g=k.root)=>frontDisk('hammered_brass_rivet',.032,.025,[x,y,z],p.brass,g);
  const base=(w=2.3,d=2.0)=>{
    k.deck('mounting_planks',w,d,[0,.18,0]);
    for(const x of [-w*.43,w*.43]){B('skid_runner',[.19,.18,d+.18],[x,.09,0],p.woodDark);for(const z of [-d*.4,d*.4]){B('teal_mount_shoe',[.32,.19,.31],[x,.25,z],p.deepTeal);k.bolt('deck_fastener',[x,.35,z]);}}
  };
  const wrap=(n,x,y,z,r=.14)=>{for(let i=0;i<5;i++)axis(n,r,.025,[x+(i-2)*.032,y,z],p.cream);};
  const wheel=(n,x,y,z,r=.3,parent=k.root)=>{
    const g=k.group(n,parent);g.position.set(x,y,z);
    const rim=k.ring('wheel_rim',r,.034,[0,0,0],p.brass,g);rim.rotation.z=Math.PI/2;
    axis('wheel_hub',.095,.12,[0,0,0],p.deepTeal,g);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;beam('wheel_spoke',[0,0,0],[0,Math.sin(a)*r,Math.cos(a)*r],.035,.035,p.brass,g);}
    return g;
  };
  if(id==='05-small-catapult'){
    base(2.15,2.05);
    for(const x of [-.73,.73]){
      beam('A_frame_front',[x,.29,.72],[x,1.95,-.05],.21,.22);
      beam('A_frame_back',[x,.29,-.83],[x,1.95,-.05],.21,.22);
      beam('A_frame_low_brace',[x,.56,-.68],[x,.56,.61],.13,.15,p.woodDark);
      for(const z of [-.77,.66])B('brass_foot_collar',[.27,.14,.27],[x,.37,z],p.brass);
      axis('axle_cheek_plate',.22,.09,[x,1.68,-.04],p.deepTeal);
      axis('axle_cap',.10,.12,[x*1.09,1.68,-.04],p.brass);
    }
    axis('throwing_axle',.095,1.8,[0,1.68,-.04],p.woodDark);
    beam('upper_crossbar',[-.91,1.98,-.05],[.91,1.98,-.05],.17,.17,p.honey);
    const arm=k.group('throwing_arm_pivot');arm.position.set(0,1.68,-.04);arm.rotation.x=-.65;
    B('laminated_spoon_arm',[.24,.19,2.13],[0,0,.24],p.honey,arm);
    B('arm_underside_iron',[.27,.045,1.3],[0,-.11,.08],p.deepTeal,arm);
    for(const z of [-.65,-.12,.46])B('arm_brass_strap',[.29,.24,.095],[0,0,z],p.brass,arm);
    const bowl=new T.SphereGeometry(.45,24,10,0,Math.PI*2,Math.PI/2,Math.PI/2);
    const cup=k.mesh('open_wooden_spoon_cup',bowl,p.woodLight,arm);cup.position.set(0,.12,1.23);cup.scale.set(1,.55,1.05);
    const rim=k.ring('spoon_bowl_thick_rim',.45,.042,[0,.12,1.23],p.woodDark,arm);rim.scale.z=1.05;
    axis('rope_winch_spindle',.13,1.4,[0,.63,.74],p.woodDark);
    wrap('rope_wound_on_winch',0,.63,.74,.16);
    wheel('winch_handwheel',.91,.63,.74,.28);
    beam('crank_handle',[1.02,.63,.74],[1.02,.37,.74],.06,.06,p.brass);
    axis('crank_grip',.055,.18,[1.10,.37,.74],p.woodDark);
    k.rope('cocking_rope',[[0,.64,.74],[0,1.08,.53],[0,1.80,-.49]]);
    k.rope('torsion_rope', [[-.73,1.68,-.04],[-.35,1.57,.06],[.35,1.57,.06],[.73,1.68,-.04]]);
    for(const [x,z,r] of [[-.57,1.00,.25],[-.17,1.02,.29],[.27,1.02,.22]]){
      k.sphere('cloth_practice_sack',r,[x,.45,z],p.cream,k.root,[1,1.2,.95]);
      const tie=k.ring('sack_neck_binding',r*.24,.025,[x,.45+r,z],p.woodDark);
      k.rope('stitched_sack_seam',[[x-r*.7,.42,z+.10],[x,.64,z+.18],[x+r*.6,.45,z+.10]]);
    }
    return true;
  }
  if(id==='06-net-launcher'){
    base(2.45,1.9);
    const cradle=k.group('net_cradle_elevation_pivot');
    // A broad inclined lattice is actual tubular rope geometry, open between strands.
    const netPoint=(u,v)=>[(u-.5)*1.93,.55+v*1.43-.09*Math.sin(u*Math.PI)*Math.sin(v*Math.PI),.75-v*1.12];
    for(const u of [0,1]){
      const a=netPoint(u,0),b=netPoint(u,1);
      beam('heavy_launch_side_rail',a,b,.18,.21,p.honey,cradle);
      axis('upper_launch_roller',.17,.18,[b[0],b[1],b[2]],p.brass,cradle);
      beam('back_brace',[a[0],.30,-.73],[b[0],b[1]-.12,b[2]],.14,.16,p.woodDark,cradle);
    }
    for(const v of [0,1])beam('roller_crossbar',netPoint(0,v),netPoint(1,v),.14,.14,p.woodDark,cradle);
    for(let i=0;i<=10;i++){
      const u=i/10,points=[];for(let j=0;j<=6;j++)points.push(netPoint(u,j/6));
      k.tube('net_longitudinal_rope',points,.023,p.cream,cradle);
    }
    for(let j=0;j<=8;j++){
      const v=j/8,points=[];for(let i=0;i<=8;i++)points.push(netPoint(i/8,v));
      k.tube('net_transverse_rope',points,.023,p.cream,cradle);
    }
    for(const u of [0,1])for(let j=0;j<=5;j++){
      const q=netPoint(u,j/5);q[0]+=(u-.5)*.20;
      k.sphere('cast_net_edge_weight',.105,q,p.ink,cradle,[1,1.12,1]);
      const tie=netPoint(u,j/5);k.rope('weight_lashing',[tie,q],cradle);
    }
    for(const u of [0,1])for(const v of [0,1]){const q=netPoint(u,v);k.sphere('net_corner_weight',.145,[q[0],q[1]-.12,q[2]+.04],p.ink,cradle);}
    axis('lower_winding_drum',.14,2.05,[0,.48,.82],p.honey);
    for(let i=0;i<9;i++)axis('wound_retrieval_line',.16,.028,[(i-4)*.045,.48,.82],p.cream);
    wheel('net_winch_wheel',1.12,.49,.80,.26);
    B('release_latch',[.13,.26,.16],[-1.05,.68,.70],p.brass);
    B('coral_repair_binding',[.20,.075,.28],[.83,.68,.58],p.coral);
    return true;
  }
  if(id==='07-folding-shield'){
    base(2.9,1.1);
    // Five separate convex planked leaves, slightly zigzagged around real hinge axes.
    for(let i=0;i<5;i++){
      const leaf=k.group(`shield_leaf_${i+1}_hinge`);leaf.position.set((i-2)*.56,.36,0);leaf.rotation.y=(i%2?-.16:.16);
      const w=.56,h=1.98;
      const curved=(name,x0,x1,y0,y1,color,zoff=0)=>{
        const points=[],idx=[],nx=6;
        for(let y=0;y<2;y++)for(let s=0;s<=nx;s++){const x=x0+(x1-x0)*s/nx;points.push(x,y?y1:y0,.10*Math.cos(x/w*Math.PI)+zoff);}
        for(let s=0;s<nx;s++){const a=s,b=s+1,c=s+nx+1,d=c+1;idx.push(a,b,c,b,d,c);}
        const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(points,3));geom.setIndex(idx);return k.mesh(name,geom,color,leaf);
      };
      for(let j=0;j<3;j++){
        const x=(j-1)*w/3;
        B('shield_wood_plank',[w/3-.008,h,.105],[x,h/2,0],p.woodDark,leaf);
        curved('convex_teal_enamel_plank',x-w/6+.008,x+w/6-.008,.06,h-.06,j%2?p.teal:p.deepTeal,.042);
        k.tube('paint_wear_vertical',[[x-.035,.32,.13],[x-.045,.70,.15],[x-.025,1.05,.14]],.008,p.woodLight,leaf);
      }
      for(const x of [-w/2+.026,w/2-.026])B('brass_edge_binding',[.055,h+.05,.14],[x,h/2,.02],p.brass,leaf);
      for(const y of [.08,h-.08]){
        curved('curved_brass_edge_rail',-w/2,w/2,y-.055,y+.055,p.brass,.065);
        for(const x of [-.19,.19])boltFront(x,y,.17,leaf);
      }
      frontDisk('brass_shield_boss',.115,.07,[0,1.02,.20],p.brass,leaf);
      k.sphere('raised_shield_boss',.10,[0,1.02,.24],p.amber,leaf,[1,1,.50]);
      for(const y of [.46,1.52]){
        B('hinge_mount_strap',[.22,.07,.08],[w/2-.04,y,.03],p.brass,leaf);
        k.cylinder('hinge_pin',.041,.041,.23,[w/2+.02,y,.025],p.ink,leaf,12);
        B('rear_leather_grip',[.18,.07,.09],[0,y,-.12],p.woodDark,leaf);
      }
      beam('rear_folding_prop',[0,.10,-.47],[0,1.20,-.07],.07,.08,p.honey,leaf);
      // Asymmetric clipped brass corner overlays.
      for(const sign of [-1,1]){const shape=new T.Shape();shape.moveTo(sign*.27,.02);shape.lineTo(sign*.08,.02);shape.lineTo(sign*.27,.24);shape.closePath();const m=k.mesh('corner_gusset',new T.ExtrudeGeometry(shape,{depth:.028,bevelEnabled:false}),p.brass,leaf);m.position.z=.15;}
    }
    return true;
  }
  if(id==='08-steam-projector'){
    base(2.45,1.9);
    const boiler=k.group('pressure_boiler');boiler.position.set(-.15,1.05,-.10);
    const shell=k.mesh('rounded_copper_boiler',new T.SphereGeometry(.78,28,18),p.copper,boiler);shell.scale.set(1,1,.93);
    for(const yy of [-.45,.06,.47]){
      const rr=Math.sqrt(.78*.78-yy*yy);
      const ring=k.ring('riveted_boiler_hoop',rr,.045,[0,yy,0],p.brass,boiler);ring.scale.z=.93;
      for(let i=0;i<12;i++){const a=i*Math.PI/6;k.sphere('boiler_seam_rivet',.032,[Math.cos(a)*rr,yy,Math.sin(a)*rr*.93],p.brass,boiler);}
    }
    for(const x of [-.68,.42]){beam('boiler_cradle_leg',[x,.30,-.62],[x,.69,-.4],.17,.17,p.deepTeal);beam('boiler_cradle_front',[x,.30,.55],[x,.69,.27],.17,.17,p.deepTeal);}
    const nozzle=k.group('projector_nozzle_yaw');nozzle.position.set(-.15,1.10,.52);
    frontDisk('nozzle_flange',.38,.13,[0,0,0],p.brass,nozzle);
    frontDisk('teal_nozzle_sleeve',.29,.30,[0,0,.18],p.deepTeal,nozzle);
    const nozzleGeom=new T.CylinderGeometry(.24,.18,.54,24,1,true);nozzleGeom.rotateX(Math.PI/2);
    const pipe=k.mesh('open_short_brass_nozzle',nozzleGeom,p.brass,nozzle);pipe.position.z=.56;
    const bore=frontDisk('dark_nozzle_inner_bore',.155,.03,[0,0,.38],p.ink,nozzle);
    const lip=k.ring('flared_muzzle_lip',.24,.035,[0,0,.84],p.brass,nozzle);lip.rotation.x=Math.PI/2;
    for(let i=0;i<8;i++){const a=i*Math.PI/4;boltFront(Math.cos(a)*.32,Math.sin(a)*.32,.085,nozzle);}
    // Actual hollow lip and recessed bore distinguish this from a closed solid cylinder.
    k.tube('pressure_gauge_stem',[[.19,1.62,-.14],[.32,1.94,-.14],[.53,2.02,-.14]],.045,p.brass);
    const gauge=k.group('pressure_gauge');gauge.position.set(.53,2.09,-.11);
    frontDisk('gauge_brass_housing',.22,.10,[0,0,0],p.brass,gauge);
    frontDisk('cream_gauge_face',.183,.018,[0,0,.061],p.cream,gauge);
    for(let i=0;i<9;i++){const a=-.22+i*Math.PI/8;const m=B('gauge_tick',[.012,.040,.009],[-Math.cos(a)*.145,Math.sin(a)*.145,.078],p.ink,gauge);m.rotation.z=a-Math.PI/2;}
    beam('gauge_needle',[0,0,.085],[.07,.10,.085],.014,.013,p.coral,gauge);
    k.cylinder('valve_stem',.045,.045,.23,[-.38,1.83,-.18],p.brass);
    const valve=k.group('handwheel_valve');valve.position.set(-.38,1.97,-.18);
    k.ring('coral_valve_wheel',.20,.032,[0,0,0],p.coral,valve);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;beam('valve_spoke',[0,0,0],[Math.cos(a)*.19,0,Math.sin(a)*.19],.025,.025,p.brass,valve);}
    k.tube('side_return_pipe',[[-.81,1.19,-.15],[-1.02,1.19,-.15],[-1.02,.54,-.15],[-.80,.41,.25],[-.50,.41,.25]],.075,p.brass);
    for(let i=0;i<3;i++){const y=.67+i*.12;const ring=k.ring('pipe_union_nut',.09,.022,[-1.02,y,-.15],p.ink);}
    B('firebox',[.69,.33,.62],[-.15,.41,-.08],p.deepTeal);
    frontDisk('firebox_door',.20,.055,[-.15,.43,.26],p.ink);
    for(let i=0;i<4;i++)B('firebox_air_slot',[.24,.018,.02],[-.15,.37+i*.044,.30],p.brass);
    B('service_tray',[.47,.12,.50],[.80,.43,-.57],p.honey);
    k.cloth('maintenance_rag',.40,.35,[.80,.51,-.57]);
    return true;
  }
  return false;
}
