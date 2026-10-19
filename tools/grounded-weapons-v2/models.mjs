import {makeKit} from '../grounded-weapons-v1/kit.mjs';

// Six new original silhouettes. Fictional prop geometry, no real construction
// specifications, combat rules, effect emitters, or physics implementation.
export function buildWeapon(spec){
 const k=makeKit(spec),{THREE:T,palette:p,root}=k;
 const B=(n,s,v,c=p.honey,g=root)=>k.bevelBox(n,s,v,c,g);
 const beam=(n,a,b,w=.16,d=.16,c=p.honey,g=root)=>k.beam(n,a,b,w,d,c,g);
 const axis=(n,r,h,v,c=p.brass,g=root,dir='z')=>{const m=k.cylinder(n,r,r,h,v,c,g,24);if(dir==='z')m.rotation.x=Math.PI/2;if(dir==='x')m.rotation.z=Math.PI/2;return m;};
 const hoop=(n,r,t,v,c=p.brass,g=root,dir='z')=>{const m=k.ring(n,r,t,v,c,g);if(dir==='z')m.rotation.x=Math.PI/2;if(dir==='x')m.rotation.z=Math.PI/2;return m;};
 function prism(n,pts,d,v,c,g=root){const s=new T.Shape();pts.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const geo=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:1,steps:1});geo.translate(0,0,-d/2);const m=k.mesh(n,geo,c,g);m.position.set(...v);return m;}
 function base(w=2.3,d=1.9){k.deck('separate_deck_sill',w,d,[0,.17,0]);for(const x of[-w*.38,w*.38]){B('deep_teal_skid',[.25,.17,d+.15],[x,.085,0],p.deepTeal);for(const z of[-d*.34,d*.34]){B('brass_anchor_plate',[.36,.075,.29],[x,.25,z],p.brass);k.bolt('deck_lock_pin',[x,.30,z]);}}}
 function wheel(n,v,r,g=root,dir='z'){const a=k.group(n,g);a.position.set(...v);hoop('cast_brass_rim',r,.035,[0,0,0],p.brass,a,dir);axis('hub',.10,.15,[0,0,0],p.deepTeal,a,dir);for(let i=0;i<6;i++){const t=i*Math.PI/3;const end=dir==='x'?[0,Math.sin(t)*r,Math.cos(t)*r]:[Math.cos(t)*r,Math.sin(t)*r,0];beam('spoke',[0,0,0],end,.032,.032,p.brass,a);}return a;}
 function bolts(n,v,r,count,g=root){for(let i=0;i<count;i++){const t=i/count*Math.PI*2;axis(n,.028,.035,[v[0]+Math.cos(t)*r,v[1]+Math.sin(t)*r,v[2]],p.brass,g);}}
 function gauge(v,g=root){const a=k.group('oversized_pressure_gauge',g);a.position.set(...v);axis('brass_case',.19,.09,[0,0,0],p.brass,a);axis('ivory_dial',.155,.015,[0,0,.055],p.cream,a);for(let i=0;i<7;i++){const t=.1+i*.44;const m=B('dial_tick',[.012,.025,.008],[-Math.cos(t)*.12,Math.sin(t)*.12,.068],p.ink,a);m.rotation.z=t-Math.PI/2;}beam('coral_needle',[0,0,.075],[.06,.09,.075],.012,.012,p.coral,a);}
 function hose(n,pts,r=.035,g=root){k.tube(n,pts,r,p.ink,g);}
 function woodGrain(n,pts,g=root){k.tube(n,pts,.006,p.woodDark,g);}
 if(spec.id==='13-comet-rocket-rack'){
  base(2.65,2.1);
  for(const x of[-.92,.92]){beam('rear_tripod_leg',[x,.3,-.73],[x*.75,1.46,-.22],.20,.23);beam('front_tripod_leg',[x,.3,.78],[x*.75,1.46,-.22],.20,.23);axis('tilt_lock_pivot',.2,.16,[x*.83,1.27,-.23],p.brass,root,'x');}
  const rack=k.group('inclined_triple_rail_carriage_STATIC');rack.position.set(0,1.13,-.18);rack.rotation.x=-.25;
  for(const z of[-.64,.58])beam('braced_cross_rail',[-1.17,0,z],[1.17,0,z],.14,.15,p.deepTeal,rack);
  for(let i=0;i<3;i++){
   const x=(i-1)*.72,y=i===1?.24:0,rg=k.group('individual_comet_prop_'+i,rack);rg.position.set(x,y,0);
   k.paintWood('open_wood_launch_rail',[.48,.15,2.05],[0,-.04,0],rg);
   for(const s of[-1,1])B('rail_brass_rim',[.045,.12,2.10],[s*.23,.02,0],p.brass,rg);
   const body=axis('cream_wrapped_rocket_body',.19,1.25,[0,.29,.07],p.cream,rg);body.rotation.x=Math.PI/2;
   // Y cylinder rotated a second time above would flip back; explicitly Z-axis.
   body.rotation.set(Math.PI/2,0,0);
   const nose=k.cone('pointed_teal_nose',.205,.43,[0,.29,.91],i===1?p.coral:p.teal,rg,24);nose.rotation.x=Math.PI/2;
   hoop('brass_nose_binding',.20,.025,[0,.29,.69],p.brass,rg);
   for(let j=0;j<7;j++)hoop('spiral_cloth_wrap_seam',.194,.009,[0,.29,-.48+j*.16],p.woodLight,rg);
   for(let j=0;j<4;j++){const a=j*Math.PI/2;const fin=prism('stout_wood_tail_fin',[[0,0],[.34,-.25],[.30,.22],[0,.43]],.045,[0,.29,-.61],p.honey,rg);fin.rotation.z=a;fin.rotation.x=Math.PI/2;}
   axis('exhaust_cap',.12,.15,[0,.29,-.64],p.iron,rg);
   for(const z of[-.44,.46]){const clamp=hoop('launch_cradle_hoop',.25,.028,[0,.20,z],p.brass,rg);B('cradle_foot',[.40,.1,.10],[0,.06,z],p.teal,rg);}
  }
  wheel('elevation_handwheel',[1.18,.75,-.45],.28,root,'x');B('coral_control_box',[.42,.29,.34],[-.65,.48,-.87],p.coral);gauge([-.65,.76,-.67]);k.cloth('canvas_tool_wrap',.45,.4,[.59,.35,.78]);
 }else if(spec.id==='14-disc-slinger'){
  base(2.55,2.05);
  const aim=k.group('open_disc_feed_carriage_STATIC');
  for(const x of[-.72,.72]){beam('angled_drive_cheek',[x,.3,-.62],[x,1.48,.27],.19,.21);beam('front_support',[x,.3,.71],[x,1.46,.27],.17,.18,p.woodDark);}
  B('teal_roller_housing',[1.72,.32,.58],[0,1.18,.58],p.deepTeal,aim);
  for(const x of[-.43,.43]){axis('large_grip_roller',.27,.47,[x,1.40,.56],p.iron,aim,'y');hoop('roller_brass_cap',.26,.024,[x,1.65,.56],p.brass,aim,'y');for(let j=0;j<12;j++){const a=j*Math.PI/6;B('roller_tread',[.035,.39,.035],[x+Math.cos(a)*.275,1.4,.56+Math.sin(a)*.275],p.woodDark,aim);}}
  const mag=k.group('tall_open_disc_carousel_STATIC');mag.position.set(-.16,1.57,-.39);mag.rotation.z=-.16;
  for(let i=0;i<5;i++){const z=-.32+i*.16;axis('stacked_forged_disc',.63,.055,[0,0,z],i%2?p.brass:p.steel,mag);hoop('disc_engraved_rim',.53,.012,[0,0,z+.035],p.woodDark,mag);axis('disc_central_hole',.10,.062,[0,0,z],p.ink,mag);}
  for(const s of[-1,1])beam('magazine_lateral_guard',[s*.72,.98,-.75],[s*.72,2.15,-.48],.095,.10,p.teal,aim);
  beam('magazine_top_brace',[-.75,2.15,-.48],[.75,2.15,-.48],.09,.10,p.brass,aim);
  for(const s of[-1,1]){B('output_slide',[.13,.13,1.0],[s*.22,1.2,1.02],p.brass,aim);k.paintWood('feed_bed',[.24,.10,.98],[s*.3,1.10,.89],aim);}
  wheel('feed_flywheel',[-1.0,.81,-.32],.40,root,'x');axis('drive_shaft',.07,1.9,[0,.80,-.32],p.iron,root,'x');hose('rounded_drive_belt',[[-1.03,.44,-.31],[-1.03,.81,-.7],[-1.03,1.29,.29],[-1.03,1.42,.56]],.04);k.cloth('coral_service_rag',.4,.32,[.77,.35,-.75]);
 }else if(spec.id==='15-piston-hammer'){
  base(2.6,2.0);
  for(const x of[-.7,.7]){beam('heavy_pivot_tower',[x,.3,-.53],[x,1.92,-.36],.27,.27);beam('rear_tower_stay',[x,.3,-.88],[x,1.53,-.4],.14,.17,p.woodDark);B('tower_brass_crown',[.34,.13,.34],[x,1.91,-.36],p.brass);}
  axis('huge_horizontal_pivot',.18,1.8,[0,1.68,-.36],p.iron,root,'x');
  const arm=k.group('curved_hammer_boom_STATIC');
  for(const x of[-.22,.22]){const a=prism('bent_laminated_hammer_arm',[[-.15,-.5],[.14,-.5],[.20,.2],[.77,1.14],[.51,1.29],[-.01,.4]],.20,[x,1.76,.14],p.honey,arm);a.rotation.y=Math.PI/2;}
  beam('oak_striking_neck',[0,1.8,-.24],[0,2.5,1.09],.32,.32,p.honey,arm);
  const head=k.group('oversized_hammer_head_STATIC',arm);head.position.set(0,2.38,1.17);head.rotation.x=-.28;
  B('cast_teal_hammer_mass',[1.18,.60,.70],[0,0,0],p.teal,head);B('iron_striking_face',[1.26,.18,.78],[0,-.37,0],p.iron,head);B('brass_top_crown',[1.25,.11,.76],[0,.35,0],p.brass,head);
  for(const x of[-.49,.49]){B('heavy_brass_binding',[.10,.73,.76],[x,-.01,0],p.brass,head);for(const z of[-.39,.39])axis('hammer_band_rivet',.035,.04,[x,0,z],p.iron,head);}
  for(const x of[-1.0,1.0]){const g=k.group('fat_steam_piston',root);g.position.set(x,.70,.20);g.rotation.x=.46;axis('cream_pressure_sleeve',.22,.68,[0,0,0],p.cream,g,'y');axis('iron_piston_rod',.095,.90,[0,.64,0],p.steel,g,'y');for(const y of[-.36,.36])hoop('brass_pressure_seal',.24,.04,[0,y,0],p.brass,g,'y');hose('curving_pressure_hose',[[x,.43,.12],[x*1.2,.70,-.16],[x*.9,1.16,-.53]],.06);}
  axis('little_steam_accumulator',.33,.62,[0,.62,-.59],p.copper,root,'y');gauge([.12,1.16,-.43]);wheel('pressure_adjuster',[-.50,.66,.68],.19);k.cloth('cream_safety_cover',.45,.36,[.8,.36,.69]);
 }else if(spec.id==='16-drill-lance'){
  base(2.35,2.45);
  for(const s of[-1,1]){k.paintWood('long_feed_slide',[.24,.24,2.45],[s*.67,.50,.12]);B('brass_slide_cap',[.27,.055,2.5],[s*.67,.65,.12],p.brass);beam('bearing_cheek',[s*.67,.60,.05],[s*.43,1.39,.13],.18,.22,p.teal);}
  const drill=k.group('rotating_spiral_lance_STATIC');drill.position.set(0,1.29,.38);
  axis('large_teal_drive_chuck',.47,.66,[0,0,-.41],p.teal,drill);hoop('chuck_brass_band',.48,.045,[0,0,-.08],p.brass,drill);bolts('chuck_lock_pin',[0,0,-.05],.35,10,drill);
  const core=k.cone('long_tapered_steel_drill',.37,1.68,[0,0,.84],p.steel,drill,36);core.rotation.x=Math.PI/2;
  const helix=[];for(let i=0;i<=150;i++){const t=i/150,r=.40*(1-t)+.018,a=t*Math.PI*2*5;helix.push([Math.cos(a)*r,Math.sin(a)*r,.02+t*1.66]);}
  k.tube('raised_brass_spiral_flight',helix,.058,p.brass,drill);
  axis('rear_drive_motor',.36,.54,[0,1.29,-.82],p.iron);hoop('drive_pulley_rim',.39,.05,[0,1.29,-1.10],p.brass);
  for(const x of[-.7,.7]){axis('feed_roller',.18,.18,[x,.69,-.73],p.brass,root,'x');}
  wheel('large_feed_crank',[1.02,.83,-.58],.39,root,'x');axis('feed_cross_shaft',.065,1.9,[0,.83,-.58],p.iron,root,'x');B('coral_drive_switch',[.36,.18,.27],[-.82,.72,.73],p.coral);hose('heavy_drive_belt',[[-.45,1.28,-.97],[-.55,.63,-.97],[.04,.44,-.97],[.39,.74,-.97],[.39,1.29,-.97]],.035);k.cloth('worn_canvas_motor_shroud',.60,.45,[0,1.64,-.79]);
 }else if(spec.id==='17-bomb-dropper'){
  base(2.75,1.55);
  for(const x of[-1.05,1.05]){beam('tall_release_gantry',[x,.30,-.30],[x,2.43,-.30],.22,.24);beam('gantry_diagonal',[x,.31,.50],[x,1.7,-.3],.17,.17,p.woodDark);B('brass_gantry_foot',[.30,.16,.31],[x,.40,-.30],p.brass);}
  k.paintWood('upper_drop_crossbeam',[2.65,.24,.24],[0,2.39,-.30]);B('teal_lever_rail',[2.59,.10,.30],[0,2.56,-.30],p.teal);
  for(let i=0;i<3;i++){
   const x=(i-1)*.80,z=i===1?.21:0,g=k.group('individual_cloud_drop_prop_'+i);g.position.set(x,1.47,z);
   k.sphere('rounded_drop_body',.37,[0,0,0],i===1?p.coral:p.deepTeal,g,[1,1.20,1]);
   const tail=k.cone('tapered_tail_cap',.26,.49,[0,.58,0],p.iron,g,20);hoop('broad_brass_equator',.38,.032,[0,0,0],p.brass,g,'y');
   for(let j=0;j<4;j++){const a=j*Math.PI/2;const fin=prism('large_wooden_stabilizer',[[0,0],[.27,.16],[.27,.45],[0,.31]],.035,[0,.48,0],p.honey,g);fin.rotation.y=a;}
   hoop('suspension_eye',.09,.023,[0,.91,0],p.brass,g);
   k.tube('open_release_hook',[[x,2.36,-.28],[x,2.2,z],[x+.08,2.08,z],[x+.1,2.18,z]],.045,p.brass);
   const cradle=k.group('wooden_bomb_cradle_'+i);for(const s of[-1,1])beam('curved_cradle_rail',[x+s*.31,.35,z-.35],[x+s*.31,.74,z+.30],.11,.13,p.honey,cradle);
   B('coral_number_marker',[.16,.10,.022],[0,-.04,.37],p.coral,g);
  }
  beam('release_linkage',[-1.19,2.57,-.31],[1.20,2.57,-.31],.05,.06,p.brass);beam('side_release_lever',[1.27,2.52,-.29],[1.46,1.91,.06],.07,.07,p.brass);k.sphere('release_coral_grip',.10,[1.46,1.91,.06],p.coral);k.cloth('canvas_folded_rack_cover',.57,.40,[-.85,.35,.57]);
 }else if(spec.id==='18-salvage-claw'){
  base(2.25,2.1);
  for(const z of[-.36,.36]){prism('arched_crane_cheek',[[-.9,.3],[-.56,.3],[-.40,1.15],[.26,2.17],[.90,2.38],[.98,2.68],[.12,2.45],[-.69,1.33]],.20,[0,0,z],p.honey);woodGrain('arched_timber_grain',[[-.72,.52,z+.12],[-.5,1.25,z+.12],[.2,2.3,z+.12],[.82,2.48,z+.12]]);}
  for(const [x,y]of[[-.63,.78],[-.38,1.54],[.35,2.35]]){B('thick_iron_crane_binding',[.37,.19,.95],[x,y,0],p.iron);for(const z of[-.49,.49])axis('binding_bolt',.04,.04,[x,y,z],p.brass);}
  const claw=k.group('three_finger_claw_STATIC');claw.position.set(.89,1.23,.17);
  axis('fat_teal_claw_collar',.27,.48,[0,.48,0],p.teal,claw,'y');hoop('brass_collar_lip',.29,.045,[0,.27,0],p.brass,claw,'y');
  for(let i=0;i<3;i++){
   const finger=k.group('curved_gripping_finger_'+i,claw);finger.rotation.y=i*Math.PI*2/3;
   prism('broad_copper_finger',[[.10,.34],[.36,.29],[.66,-.06],[.65,-.54],[.45,-.80],[.30,-.75],[.46,-.42],[.42,-.12],[.17,.08]],.16,[0,0,0],p.brass,finger);
   axis('finger_pivot',.13,.21,[.24,.20,0],p.iron,finger);beam('finger_linkage',[.12,.55,-.1],[.42,-.06,-.1],.045,.055,p.steel,finger);B('teal_padded_jaw',[.20,.23,.21],[.43,-.60,0],p.teal,finger);
  }
  k.rope('main_claw_suspension',[[.89,2.51,.16],[.89,2.03,.16],[.89,1.88,.17]]);
  axis('huge_winch_rope_drum',.31,.78,[-.64,.87,-.49],p.woodDark,root,'z');for(let j=0;j<14;j++)hoop('cream_winch_rope',.32,.023,[-.64,.87,-.87+j*.055],p.cream);
  for(const z of[-.93,-.05])axis('large_winch_flange',.40,.065,[-.64,.87,z],p.teal);
  wheel('crane_winch_handwheel',[-.64,.87,-1.04],.28);k.rope('running_crane_line',[[-.64,1.15,-.43],[-.40,1.75,-.35],[.35,2.51,-.12],[.89,2.58,.16]]);axis('top_rope_sheave',.16,.14,[.89,2.55,.16],p.brass);gauge([-.91,1.37,.40]);
 }else throw new Error('Unknown weapon '+spec.id);
 root.userData.name_ko=spec.name_ko;root.userData.art_direction='warm handcrafted cartoon machinery, bold functional silhouettes, moderate fantasy';
 root.userData.source_reference='Original expansion inspired by approved v2 material and style, not pictured in that board';
 root.updateMatrixWorld(true);
 const light=new T.Vector3(-.6,.85,.65).normalize(),normal=new T.Vector3(),world=new T.Vector3(),matrix=new T.Matrix3(),bounds=new T.Box3().setFromObject(root),h=Math.max(.1,bounds.max.y-bounds.min.y);
 root.traverse(n=>{if(!n.isMesh)return;matrix.getNormalMatrix(n.matrixWorld);const col=n.geometry.attributes.color,nor=n.geometry.attributes.normal,pos=n.geometry.attributes.position;for(let i=0;i<col.count;i++){normal.fromBufferAttribute(nor,i).applyMatrix3(matrix).normalize();world.fromBufferAttribute(pos,i).applyMatrix4(n.matrixWorld);const d=normal.dot(light),shade=d>.55?1.10:d>.05?.88:d>-.4?.62:.40,g=.88+.12*Math.min(1,(world.y-bounds.min.y)/h*2.5);col.setXYZ(i,Math.min(1,col.getX(i)*shade*g*1.035),Math.min(1,col.getY(i)*shade*g),Math.min(1,col.getZ(i)*shade*g*.975));}});
 return root;
}
