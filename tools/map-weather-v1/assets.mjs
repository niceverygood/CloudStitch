import * as THREE from 'three';
import { makeWorldKit } from '../world-assets/core.mjs';
import { assets as skySpecs, build as buildSky } from '../map-atmosphere-v1/sky.mjs';
import { WEATHER_ASSET_CATALOG, WEATHER_ASSET_LIMITS, WEATHER_EXPRESSION_PROFILES } from './asset-catalog.mjs';

const P={cream:0xffedc7, ivory:0xfff8e5, honey:0xc18c58, wood:0x80573f,
  brass:0xd3a25b, teal:0x548e88, dark:0x2f5559, coral:0xd57660, ink:0x30434e,
  mint:0xb6e7cf, mintLight:0xe4f8d5, ice:0xa5d9e0, frost:0xe4f1e8,
  orange:0xffb451, fire:0xf4743c, purple:0x596078, coal:0x4a4c50};
const TAU=Math.PI*2;

/** Real reusable scene geometry; animation is driven only by simulation state. */
export function createWeatherAssets() {
  const root=new THREE.Group();root.name='cloudstitch_weather_course_assets';
  root.userData={type:'weather-test-art',...WEATHER_ASSET_LIMITS};
  const stations=new Map(),mixers=[],materials=new Set(),geometries=new Set(),animations=[];
  const modeMaterials=new Map(),originalMaterials=new WeakMap();let currentMode='painted',currentExpression='dramatic',lastTime=0,disposed=false;
  let serial=0,reusedColorComponentsClamped=0;
  const colorScratch=new THREE.Color();
  const dyn={},dramaticGroups=[];

  function group(name,parent=root,pos=[0,0,0]) {const g=new THREE.Group();g.name=name;g.position.set(...pos);parent.add(g);return g;}
  function dramaticGroup(name,parent,pos=[0,0,0]) {const g=group(name,parent,pos);g.userData.expressionProfile='dramatic';dramaticGroups.push(g);return g;}
  function ownOpacity(m) {m.material=m.material.clone();materials.add(m.material);return m;}
  function material(color,opacity=1,glow=false) {
    const m=new THREE.MeshBasicMaterial({color,vertexColors:true,side:THREE.DoubleSide,
      transparent:opacity<1,opacity,depthWrite:opacity>=1,toneMapped:!glow});
    m.userData={weatherMaterial:true,glow,baseOpacity:opacity};materials.add(m);return m;
  }
  const materialCache=new Map();
  function mat(color,opacity=1,glow=false) {const key=[color,opacity,glow].join('_');if(!materialCache.has(key))materialCache.set(key,material(color,opacity,glow));return materialCache.get(key);}
  function painted(geometry) {
    const geo=geometry.index?geometry.toNonIndexed():geometry;
    if(geo!==geometry)geometry.dispose();geo.computeVertexNormals();
    const p=geo.attributes.position,n=geo.attributes.normal,c=[];
    for(let i=0;i<p.count;i++) {
      const lit=n.getX(i)*-.3+n.getY(i)*.82+n.getZ(i)*.35;
      const shade=THREE.MathUtils.clamp((lit>.45?1:lit>-.2?.91:.73)*(1+.025*Math.sin(p.getX(i)*6.2+p.getY(i)*4+p.getZ(i)*8.7)),0,1);
      c.push(shade,shade,shade);
    }
    geo.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geometries.add(geo);return geo;
  }
  function mesh(name,geometry,color,parent,pos=[0,0,0],opacity=1,glow=false) {
    const m=new THREE.Mesh(painted(geometry),mat(color,opacity,glow));m.name=`weather_${name}_${serial++}`;
    m.position.set(...pos);parent.add(m);return m;
  }
  function box(name,size,pos,color,parent,rz=0){const m=mesh(name,new THREE.BoxGeometry(...size),color,parent,pos);m.rotation.z=rz;return m;}
  function sphere(name,scale,pos,color,parent,opacity=1) {const m=mesh(name,new THREE.IcosahedronGeometry(1,1),color,parent,pos,opacity);m.scale.set(...scale);return m;}
  function cylinder(name,r1,r2,height,pos,color,parent,axis='y') {
    const m=mesh(name,new THREE.CylinderGeometry(r1,r2,height,12),color,parent,pos);
    if(axis==='x')m.rotation.z=Math.PI/2;if(axis==='z')m.rotation.x=Math.PI/2;return m;
  }
  function tube(name,points,radius,color,parent,opacity=1,glow=false) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    return mesh(name,new THREE.TubeGeometry(curve,Math.max(6,points.length*3),radius,5,false),color,parent,[0,0,0],opacity,glow);
  }
  function ribbon(name,points,width,color,parent,opacity=.55) {
    const verts=[],indices=[],curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const t=new THREE.Vector3(),s=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
    const segments=Math.max(18,points.length*3);
    for(let i=0;i<=segments;i++) {
      const u=i/segments,p=curve.getPoint(u);curve.getTangent(u,t);s.crossVectors(t,up).normalize();
      if(s.lengthSq()<.001)s.set(1,0,0);
      const w=width*(.3+.7*Math.sin(Math.PI*u));
      verts.push(p.x-s.x*w,p.y-s.y*w,p.z-s.z*w,p.x+s.x*w,p.y+s.y*w,p.z+s.z*w);
      if(i<segments){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);
    return mesh(name,geo,color,parent,[0,0,0],opacity,true);
  }
  function register(id) {
    const spec=WEATHER_ASSET_CATALOG.find(a=>a.id===id),g=group(`weather_station_${id}`,root,spec.center);
    g.userData={...spec,fixture:'visual-only; simulation owns interactions'};stations.set(id,g);return g;
  }
  function reuseSky(id,parent,scale,pos=[0,0,0],yaw=0) {
    const spec=skySpecs.find(a=>a.id===id),kit=makeWorldKit(spec),result=buildSky(spec,kit);
    kit.root.userData.weatherReuse=true;kit.root.userData.source='tools/map-atmosphere-v1/sky.mjs';
    kit.root.position.set(...pos);kit.root.scale.set(...scale);kit.root.rotation.y=yaw;parent.add(kit.root);
    const mixer=new THREE.AnimationMixer(kit.root);
    for(const clip of result.clips||[]){mixer.clipAction(clip).play();animations.push(clip);}
    mixers.push(mixer);
    kit.root.traverse(o=>{if(!o.isMesh)return;
      // Keep the authored recipe untouched. This consumer's GLB-ready geometry
      // uses the standard COLOR_0 range even when a source brush highlight is HDR.
      const color=o.geometry.attributes.color;
      if(color&&color.array.some(v=>v<0||v>1)){
        o.geometry=o.geometry.clone();const c=o.geometry.attributes.color;
        for(let i=0;i<c.array.length;i++){const v=c.array[i],clamped=THREE.MathUtils.clamp(v,0,1);if(clamped!==v)reusedColorComponentsClamped++;c.array[i]=clamped;}
        c.needsUpdate=true;
      }
      geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
    return kit.root;
  }
  function lamp(name,parent,pos,color=P.orange,scale=1) {
    const g=group(name,parent,pos);g.scale.setScalar(scale);
    cylinder('lantern_lower_brass',.42,.5,.22,[0,-.44,0],P.brass,g);
    cylinder('lantern_upper_brass',.36,.45,.18,[0,.43,0],P.brass,g);
    const core=sphere('soft_lantern_glow',[.3,.4,.3],[0,0,0],color,g);
    for(let i=0;i<3;i++){const a=i/3*TAU;box('lantern_cage',[.055,.82,.055],[Math.cos(a)*.32,0,Math.sin(a)*.32],P.dark,g);}
    return {g,core};
  }
  function deck(parent,pos,width,depth) {
    const g=group('carved_honey_wood_observation_deck',parent,pos);
    for(let i=0;i<6;i++) {
      const x=(i/5-.5)*(width-width/6);
      box('rounded_plank',[width/6-.06,.4,depth],[x,0,0],i%3?P.honey:0xe1b47d,g);
      box('hand_painted_woodgrain',[.035,.015,depth*.66],[x+.15,.208,.1],P.wood,g);
    }
    for(const side of [-1,1]) {
      box('teal_deck_fascia',[width+.4,.42,.25],[0,-.14,side*depth*.5],P.teal,g);
      for(const z of [-.37,.37]) {
        cylinder('brass_trimmed_post',.18,.25,2.4,[side*(width*.5-.2),1.25,z*depth],P.wood,g);
        sphere('post_brass_cap',[.26,.16,.26],[side*(width*.5-.2),2.5,z*depth],P.brass,g);
      }
      tube('hanging_rope_rail',[[side*(width*.5-.2),2.2,-depth*.37],[side*(width*.5-.2),1.75,0],[side*(width*.5-.2),2.2,depth*.37]],.07,P.cream,g);
    }
    const rock=mesh('hanging_platform_rock',new THREE.ConeGeometry(width*.58,5.2,7),0x858981,g,[0,-2.8,0]);rock.rotation.z=Math.PI;
    box('underslung_wood_brace',[width*.65,.3,.4],[0,-1,0],P.wood,g,.12);
    return g;
  }

  // All four cloud forms are read-only instances of the existing 24-asset source.
  const cloud=register('cloud');
  dyn.cloud=reuseSky('sunlit-cloud',cloud,[4.6,4.3,7.2],[0,-1,0]);
  dyn.cloud.userData.newCloudAssetCount=0;
  const updraft=register('updraft');
  dyn.updraftCloud=reuseSky('rising-cloud',updraft,[5.3,5.3,5.3],[0,7,0]);
  dyn.updraftRibbons=group('animated_mint_brush_helixes',updraft);
  for(let j=0;j<4;j++) {
    const pts=[];
    for(let i=0;i<=24;i++) {
      const u=i/24,a=u*TAU*1.6+j*TAU/4,r=6.7+Math.sin(u*Math.PI)*1.1;
      pts.push([Math.cos(a)*r,-5+u*30,Math.sin(a)*r]);
    }
    ribbon('rising_curled_wind_brush',pts,j%2?.24:.5,j%2?P.mintLight:P.mint,dyn.updraftRibbons,j%2?.72:.36);
  }
  dyn.seeds=[];
  const seedGeo=painted(new THREE.OctahedronGeometry(.13));
  for(let i=0;i<24;i++) {
    const m=new THREE.Mesh(seedGeo,mat(i%3?P.mintLight:P.brass,.8,true));m.name=`updraft_floating_seed_${i}`;dyn.updraftRibbons.add(m);dyn.seeds.push(m);
  }

  const crosswind=register('crosswind');
  dyn.crosswindMist=reuseSky('mist-ribbons',crosswind,[3.9,2.8,5.2],[0,-2,0],Math.PI/2);
  const observation=deck(crosswind,[12,-5,-9],7,7);
  cylinder('windsock_carved_mast',.16,.26,9.5,[-1,4.8,-1],P.wood,observation);
  cylinder('windsock_mast_brass_collar',.29,.29,.3,[-1,7,-1],P.brass,observation);
  box('windsock_weather_vane_arm',[2.7,.18,.18],[.2,8.4,-1],P.brass,observation);
  dyn.sock=group('coral_and_cream_sewn_windsock',observation,[1.4,8.3,-1]);
  dyn.sockSections=[];
  for(let j=0;j<7;j++) {
    const r0=.87-j*.095,r1=.87-(j+1)*.095,len=.72;
    const g=mesh('sewn_windsock_stripe',new THREE.CylinderGeometry(r1,r0,len,14,1,true),j%2?P.cream:P.coral,dyn.sock,[0,0,j*.69]);
    g.rotation.x=Math.PI/2;g.userData.baseZ=j*.69;dyn.sockSections.push(g);
  }
  for(const sign of [-1,1])tube('windsock_rope_bridle',[[0,0,-1],[sign*.76,0,0]],.045,P.cream,dyn.sock);
  dyn.streamers=[];
  for(let j=0;j<5;j++) {
    const pts=[];for(let i=0;i<8;i++)pts.push([(j-2)*4+Math.sin(i*.9+j)*.45,1+j%2,-13+i*3.7]);
    const r=ribbon('horizontal_cream_crosswind_streamer',pts,.17+j%2*.1,j%2?P.cream:P.mintLight,crosswind,.56);dyn.streamers.push(r);
  }
  lamp('wind_observatory_lantern',observation,[2.3,2.1,2.2],P.orange,.75);

  const lightning=register('lightning');
  dyn.storm=reuseSky('storm-front',lightning,[4.7,4.8,5.5],[0,15,0]);
  const rod=deck(lightning,[-13,-5,7],4.2,5);
  cylinder('lightning_copper_grounding_column',.25,.5,8,[0,4.2,0],P.brass,rod);
  const prong=new THREE.Vector3();
  for(let i=0;i<3;i++){prong.set(Math.cos(i/3*TAU),0,Math.sin(i/3*TAU));tube('forked_lightning_crown',[[0,7.7,0],[prong.x*.9,8.6,prong.z*.9],[prong.x*.8,9.8,prong.z*.8]],.09,P.brass,rod);}
  dyn.stormLamp=lamp('blue_storm_warning_lantern',rod,[0,5.5,0],P.ice,1.25);
  dyn.bolt=group('fixed_target_lightning_discharge',lightning);
  const boltPts=[[0,0,0],[.9,3,-.2],[-.3,5,.3],[1.6,7,.1],[-.6,10,-.4],[.7,13,.2],[0,18,0]];
  tube('lightning_outer_blue_brush',boltPts,.25,0x93d9ff,dyn.bolt,.5,true);
  tube('lightning_cream_hot_core',boltPts,.085,P.ivory,dyn.bolt,1,true);
  for(let i=0;i<3;i++)tube('branched_lightning_fork',[[1-i*.3,7+i*3,0],[2.6+i*.7,8.7+i*3,.6],[2.3+i,10.2+i*3,1.1]],.055,0xe0eafa,dyn.bolt,.88,true);
  dyn.bolt.visible=false;

  const icing=register('icing');
  const frostMill=group('frost_windmill_and_ice_pipe',icing,[-10,-4,-1]);
  cylinder('teal_frozen_tower',1.2,1.7,5.2,[0,0,0],P.teal,frostMill);
  cylinder('snowy_brass_roof_lip',1.8,1.8,.3,[0,2.6,0],P.frost,frostMill);
  const roof=mesh('snow_capped_conical_roof',new THREE.ConeGeometry(1.9,1.5,8),P.ice,frostMill,[0,3.35,0]);roof.rotation.y=.2;
  dyn.mill=group('frost_weighted_windmill_rotor',frostMill,[0,1.5,1.5]);
  cylinder('brass_windmill_axle',.5,.6,1.3,[0,0,0],P.brass,dyn.mill,'z');
  for(let i=0;i<4;i++) {
    const b=group('canvas_blade_with_frozen_edge',dyn.mill);b.rotation.z=i/4*TAU+.18;
    box('long_windmill_blade_spar',[.21,4.2,.16],[0,2.05,.1],P.wood,b);
    box('wide_cream_sewn_blade',[1.1,2.5,.12],[.28,2.5,.12],P.cream,b,.09);
    box('teal_painted_blade_tip',[1.15,.4,.16],[.36,3.85,.14],P.teal,b,.09);
    tube('thick_frosted_blade_ridge',[[-.35,1.2,.24],[-.38,2.3,.24],[-.2,3.8,.24]],.13,P.frost,b);
  }
  tube('bent_teal_freezing_pipe',[[0,-1,0],[3,-1,0],[3,2,0],[6,2,0],[6,-1,0]],.5,P.dark,frostMill);
  tube('frost_pipe_upper_ridge',[[3,2.5,0],[4.2,2.53,0],[6,2.5,0]],.18,P.frost,frostMill);
  dyn.icicles=group('crystalline_hanging_icicle_sculpture',frostMill);
  for(let i=0;i<11;i++) {
    const m=mesh('asymmetric_hanging_blue_icicle',new THREE.ConeGeometry(.15+(i%3)*.06,.7+(i%4)*.35,5),i%2?P.frost:P.ice,dyn.icicles,[2.9+i*.31,1.6-(i%4)*.16,.25]);m.rotation.z=Math.PI;
  }
  sphere('scalloped_snow_bank',[2.5,.7,2],[-.5,-2.7,.5],P.frost,frostMill);
  const heater=deck(icing,[10,-5,1],6.2,6.5);
  cylinder('brass_heater_pressure_boiler',1.2,1.4,3.4,[0,2,0],P.brass,heater);
  cylinder('boiler_coral_lower_band',1.43,1.43,.5,[0,.6,0],P.coral,heater);
  cylinder('teal_boiler_hat',1.5,1.5,.3,[0,3.8,0],P.teal,heater);
  tube('heater_crooked_chimney',[[0,3.8,0],[0,5.4,0],[1,5.8,0]],.35,P.dark,heater);
  box('heater_cream_firebox_frame',[1.7,1.6,.6],[0,1.7,1.25],P.brass,heater);
  dyn.firebox=box('coral_firebox_glow',[1.25,1.12,.06],[0,1.7,1.59],P.fire,heater);
  for(let i=0;i<4;i++)box('firebox_dark_grille',[.08,1.15,.09],[(i-1.5)*.28,1.7,1.65],P.dark,heater);
  tube('brass_heater_pressure_pipe',[[1,2.8,0],[2,2.8,0],[2,1,0]],.14,P.brass,heater);
  dyn.heaterLamp=lamp('preheat_status_lamp',heater,[-2.2,2.4,1.8],P.orange,.8);
  dyn.embers=[];
  for(let i=0;i<10;i++) {
    const e=sphere('rising_amber_preheat_ember',[.08,.2,.08],[0,0,0],i%2?P.fire:P.orange,heater,.8);dyn.embers.push(e);
  }

  const thermal=register('thermal');
  const fortress=group('three_lane_thermal_pressure_fortress',thermal,[18,-4,0]);
  // A stepped wall and pipe network leave the playable corridor open at X -14..14.
  for(let i=0;i<3;i++) {
    const z=(i-1)*6;
    box('different_height_teal_fortress_buttress',[3.2,8+i%2*2,4.9],[1,.5+i%2,z],i%2?P.dark:P.teal,fortress);
    box('honey_wood_walkway',[4.9,.45,5.6],[.1,4.8+i%2,z],P.honey,fortress);
    cylinder('brass_pressure_reservoir',1.15,1.15,5.3,[2.6,.3,z],P.brass,fortress);
    tube('curved_pressure_feed_pipe',[[2.6,3.3,z],[2.6,5.5+i%2,z],[.2,5.5+i%2,z],[.2,2.8,z]],.26,P.brass,fortress);
    for(let j=0;j<3;j++)box('fortress_coral_brick_seam',[.12,.28,4.8],[-.64,-1.8+j*1.7,z],P.coral,fortress);
  }
  tube('horizontal_reinforced_pressure_manifold',[[2,1.2,-7.6],[2,1.2,0],[2,1.2,7.6]],.42,P.dark,fortress);
  dyn.nozzles=[];dyn.jets=[];dyn.pressureLamps=[];
  for(let i=0;i<3;i++) {
    const z=(i-1)*6;
    const nozzle=group(`thermal_nozzle_lane_${i}`,fortress,[-1.3,4,z]);
    cylinder('large_vent_brass_collar',1.55,1.55,.38,[0,0,0],P.brass,nozzle,'x');
    cylinder('dark_ceramic_vent_barrel',1.1,1.32,2.1,[-.9,0,0],P.ink,nozzle,'x');
    cylinder('copper_vent_mouth',1.33,1.33,.27,[-2,0,0],P.coral,nozzle,'x');
    const hot=cylinder('recessed_orange_pressure_core',1.02,1.02,.09,[-2.18,0,0],P.fire,nozzle,'x');dyn.nozzles.push(hot);
    dyn.pressureLamps.push(lamp(`lane_${i}_amber_pressure_lamp`,fortress,[-1.4,6.4,z],P.orange,.95));
    const jet=group(`thermal_burst_lane_${i}`,thermal,[14,0,z]);dyn.jets.push(jet);
    const pts=[];for(let j=0;j<10;j++)pts.push([-j*3.1,Math.sin(j*.9)*.3,Math.sin(j*1.5)*.23]);
    const outer=tube('orange_heat_brush_volume',pts,.8,P.fire,jet,.3,true);outer.scale.set(1,1.55,1.35);
    tube('golden_hot_jet_inner',pts,.34,P.orange,jet,.65,true);
    ribbon('cream_hot_jet_streak',pts,.15,P.ivory,jet,.82);
    for(let j=0;j<6;j++)sphere('rolling_hot_pressure_lobe',[1.5,.75,.9],[-j*4.8-.8,Math.sin(j)*.25,Math.cos(j)*.4],j%2?P.orange:P.fire,jet,.23);
    jet.visible=false;
  }

  // SOURCE2 expression layers. SOURCE1 fixtures above and their standard timing remain intact.
  // These are staged brush forms, cloth reactions and material aftermath, never hazard colliders.
  const cloudDrama=dramaticGroup('dramatic_cloud_entry_veils',cloud);dyn.cloudVeils=[];
  for(let j=0;j<3;j++) {
    const pts=[];for(let i=0;i<=14;i++){const u=i/14;pts.push([-17+u*34,1.5+j*.65+Math.sin(u*Math.PI)*2.4,Math.sin(u*Math.PI*1.5+j)*3+(j-1)*4]);}
    dyn.cloudVeils.push(ribbon('broad_sweeping_cloud_entry_veil',pts,.55+j*.18,j%2?P.ivory:P.mintLight,cloudDrama,.21));
  }
  const upDrama=dramaticGroup('dramatic_three_stage_updraft',updraft);
  dyn.upInlet=group('low_inlet_scooping_brushes',upDrama);dyn.upCrown=group('open_petalled_outflow',upDrama);
  for(let j=0;j<3;j++) {
    const a=j/3*TAU,pts=[];
    for(let i=0;i<=16;i++){const u=i/16,r=16-u*9,aa=a+u*1.35;pts.push([Math.cos(aa)*r,-5+u*u*7,Math.sin(aa)*r]);}
    ribbon('low_sweeping_inlet_scoop',pts,.9,P.mint,dyn.upInlet,.32);
    const crown=[];for(let i=0;i<=16;i++){const u=i/16,r=6.8+u*8,aa=a+u*.85;crown.push([Math.cos(aa)*r,23+Math.sin(u*Math.PI*.8)*5,Math.sin(aa)*r]);}
    ribbon('broad_outflow_petalled_brush',crown,1.05,j%2?P.cream:P.mintLight,dyn.upCrown,.42);
  }
  const windDrama=dramaticGroup('dramatic_crosswind_prepare_gust_rebound',crosswind);dyn.gustCloths=[];
  for(let j=0;j<3;j++) {
    const pts=[];for(let i=0;i<=18;i++){const u=i/18;pts.push([(j-1)*6+Math.sin(u*TAU*1.2+j)*1.15,2.2+Math.sin(u*TAU+j)*.7,-20+u*40]);}
    const r=ownOpacity(ribbon('long_fast_tapered_gust_cloth',pts,.5+j%2*.32,j%2?P.ivory:P.mintLight,windDrama,.55));dyn.gustCloths.push(r);
  }
  const stormDrama=dramaticGroup('dramatic_charge_strike_afterglow',lightning);
  dyn.charge=group('separate_electric_charge_strands_converging',stormDrama);dyn.chargeStrands=[];
  for(let j=0;j<5;j++) {
    const a=j/5*TAU,pts=[];
    for(let i=0;i<=12;i++){const u=i/12,r=14*(1-u)*(1-u)+1.2;pts.push([Math.cos(a+u)*r,13+u*3+Math.sin(u*Math.PI)*2,Math.sin(a+u)*r]);}
    dyn.chargeStrands.push(ownOpacity(ribbon('electric_prewarning_gathering_filament',pts,.22,j%2?P.ice:P.ivory,dyn.charge,.55)));
  }
  dyn.strikeForks=group('expanded_lightning_branching_canopy',stormDrama);
  for(let j=0;j<4;j++) {
    const a=j/4*TAU,r=5.2;
    tube('angular_outward_strike_fork',[[.2,2,0],[Math.cos(a)*2,5,Math.sin(a)*2],[Math.cos(a+.2)*r,7.5,Math.sin(a+.2)*r],[Math.cos(a)*r*.85,10,Math.sin(a)*r*.85]],.105,j%2?P.ivory:P.ice,dyn.strikeForks,.9,true);
  }
  dyn.afterglow=group('pale_electrical_afterglow_rising_veils',stormDrama);dyn.afterglowStrokes=[];
  for(let j=0;j<3;j++) {
    const a=j/3*TAU,pts=[];for(let i=0;i<=12;i++){const u=i/12,r=.5+u*4.4;pts.push([Math.cos(a+u*1.6)*r,u*9,Math.sin(a+u*1.6)*r]);}
    dyn.afterglowStrokes.push(ownOpacity(ribbon('lingering_lightning_afterglow_veil',pts,.45,P.ice,dyn.afterglow,.32)));
  }

  const frostDrama=dramaticGroup('dramatic_sugar_frost_crystal_engine',frostMill);
  const engine=group('frost_loaded_handmade_engine',frostDrama,[4,-1.1,1.4]);
  cylinder('frozen_engine_teal_housing',1.25,1.6,1.9,[0,0,0],P.teal,engine,'z');
  cylinder('frozen_engine_brass_rounded_rim',1.55,1.55,.28,[0,0,1.05],P.brass,engine,'z');
  for(let j=0;j<4;j++){const blade=box('frozen_engine_impeller_blade',[.5,2.2,.18],[0,0,1.3],P.dark,engine);blade.rotation.z=j/4*Math.PI;}
  // A branching fern-like crystal silhouette, rather than repeated cones.
  const crystalShape=new THREE.Shape();
  const crystalOutline=[[0,0],[-.28,.45],[-.9,.5],[-.45,.8],[-1.1,1.25],[-.38,1.22],[-.7,1.95],[-.2,1.67],[0,2.8],[.2,1.67],[.7,1.95],[.38,1.22],[1.1,1.25],[.45,.8],[.9,.5],[.28,.45]];
  crystalOutline.forEach(([x,y],i)=>i?crystalShape.lineTo(x,y):crystalShape.moveTo(x,y));crystalShape.closePath();
  const crystalGeo=painted(new THREE.ExtrudeGeometry(crystalShape,{depth:.12,bevelEnabled:false}));
  const crystalFans=new THREE.InstancedMesh(crystalGeo,mat(P.ice,.88),9);crystalFans.name='large_branching_rime_crystal_fans';frostDrama.add(crystalFans);
  const transform=new THREE.Object3D();
  for(let i=0;i<9;i++) {
    const a=i*2.399;transform.position.set(3.4+Math.cos(a)*1.6,.8+(i%3)*.8,.5+Math.sin(a)*1.8);
    transform.rotation.set((i%3-.5)*.25,a,(i%2?1:-1)*.35);transform.scale.setScalar(.65+(i%4)*.3);transform.updateMatrix();crystalFans.setMatrixAt(i,transform.matrix);
  }
  const sugarGeo=painted(new THREE.OctahedronGeometry(.1));
  const sugar=new THREE.InstancedMesh(sugarGeo,mat(P.frost),72);sugar.name='fine_sugar_rime_on_engine_cowl';engine.add(sugar);
  for(let i=0;i<72;i++) {
    const a=i*2.399,r=1.32+(i%4)*.055;transform.position.set(Math.cos(a)*r,Math.sin(a)*r,-.7+(i%9)*.23);
    transform.rotation.set(a,a*.5,a*.7);transform.scale.set(.6+(i%3)*.55,1.1+(i%5)*.35,.7);transform.updateMatrix();sugar.setMatrixAt(i,transform.matrix);
  }
  dyn.crystalFans=crystalFans;
  const steamDrama=dramaticGroup('dramatic_preheat_steam_curls',icing,[10,-.5,1]);dyn.preheatSteam=[];
  for(let j=0;j<4;j++) {
    const pts=[];for(let i=0;i<=16;i++){const u=i/16,a=u*TAU*1.1+j*1.5,r=.4+u*2.4;pts.push([Math.cos(a)*r,u*10,Math.sin(a)*r]);}
    dyn.preheatSteam.push(ownOpacity(ribbon('warm_thawing_steam_scroll',pts,.55+j%2*.3,j%2?P.ivory:0xc9dce1,steamDrama,.3)));
  }

  const heatDrama=dramaticGroup('dramatic_pressure_release_and_ash',thermal);
  dyn.heatLayers=[];
  function taperedJet(name,parent,color,opacity,radius) {
    const pts=[],idx=[],segments=26,sides=9;
    for(let i=0;i<=segments;i++) {
      const u=i/segments,r=radius*(.32+.78*Math.sin(Math.min(1,u*1.15)*Math.PI*.78));
      for(let j=0;j<=sides;j++){const a=j/sides*TAU,brush=1+.085*Math.sin(i*.8+j*1.7);pts.push(-u*28,Math.cos(a)*r*1.35*brush+Math.sin(u*9)*.14,Math.sin(a)*r*brush);}
      if(i<segments)for(let j=0;j<sides;j++){const k=i*(sides+1)+j;idx.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));geo.setIndex(idx);
    return ownOpacity(mesh(name,geo,color,parent,[0,0,0],opacity,true));
  }
  for(let lane=0;lane<3;lane++) {
    const z=(lane-1)*6,g=group(`dramatic_thermal_lane_${lane}`,heatDrama,[14,0,z]);
    const release=group('thick_tapered_heat_brush_and_scrolls',g),warning=group('nozzle_pressure_breaths',g),ash=group('grey_residual_heat_vapor',g);
    const sheath=taperedJet('soft_broad_thermal_pressure_sheath',release,P.fire,.25,1.55);
    const body=taperedJet('golden_tapered_thermal_main_body',release,P.orange,.52,1.05);
    const scrolls=[],ashStrokes=[],breaths=[];
    for(let side of [-1,1]) {
      const pts=[];for(let i=0;i<=18;i++){const u=i/18;pts.push([-u*28,Math.sin(u*TAU*1.3)*.4+Math.pow(u,5)*3,side*(.5+Math.sin(u*Math.PI)*.7)]);}
      scrolls.push(ownOpacity(ribbon('curling_sideflow_thermal_scroll',pts,.45,P.ivory,release,.42)));
      breaths.push(ownOpacity(ribbon('small_anticipation_pressure_puff',[[0,0,side*.4],[-1,.3,side*.8],[-2.5,1.2,side],[-2.1,2.1,side*.5]],.35,0xd5d9cf,warning,.38)));
    }
    for(let j=0;j<3;j++) {
      const pts=[];for(let i=0;i<=14;i++){const u=i/14;pts.push([-2-u*25,1+Math.sin(u*TAU*1.1+j)*.55+u*2,(j-1)*.85+Math.sin(u*TAU+j)*.35]);}
      ashStrokes.push(ownOpacity(ribbon('lingering_ash_colored_vapor_scroll',pts,.75,j%2?0xa4aba7:0xc4c5b5,ash,.28)));
    }
    dyn.heatLayers.push({g,release,warning,ash,sheath,body,scrolls,ashStrokes,breaths});
  }

  function update(state={},dt=0) {
    if(disposed)return;
    const time=Number.isFinite(state.time)?state.time:lastTime+Math.max(0,dt);lastTime=time;
    for(const mixer of mixers)mixer.update(Math.max(0,Math.min(dt,.2)));
    const weather=state.weather||{},player=state.player||{};
    dyn.updraftRibbons.rotation.y=time*.27;
    dyn.updraftRibbons.position.y=Math.sin(time*.6)*.25;
    dyn.seeds.forEach((m,i)=>{const u=((time*.11+i/24)%1+1)%1,a=i*2.399+time*.55,r=3.4+(i%6)*.8;m.position.set(Math.cos(a)*r,-5+u*30,Math.sin(a)*r);m.rotation.set(time*.4+i,time*.7,0);m.scale.setScalar(.6+Math.sin(u*Math.PI)*.8);});
    dyn.sock.rotation.y=.03+Math.sin(time*.8)*.05;
    dyn.sockSections.forEach((s,i)=>{s.position.x=Math.sin(time*3.3-i*.6)*.055*i;s.position.y=Math.sin(time*4-i*.7)*.035*i;s.position.z=s.userData.baseZ;s.rotation.x=Math.PI/2+Math.cos(time*4-i*.7)*.035;s.rotation.z=Math.sin(time*3.3-i*.6)*.025*i;});
    dyn.streamers.forEach((r,i)=>{r.position.z=Math.sin(time*.9+i)*1.8;r.position.y=Math.sin(time*1.2+i)*.2;});
    const storm=weather.lightning||{},phase=storm.phase||'calm';
    dyn.bolt.visible=phase==='strike';
    if(storm.target){dyn.bolt.position.set(storm.target.x-lightning.position.x,(storm.target.y??8)-lightning.position.y,storm.target.z-lightning.position.z);}
    dyn.bolt.rotation.y=Math.floor(time*9)*.618;
    dyn.bolt.scale.setScalar(phase==='strike'?.85+Math.sin(time*65)*.12:1);
    dyn.stormLamp.core.scale.setScalar(phase==='warning'?.85+Math.sin(time*9)*.25:phase==='strike'?1.5:1);
    const icingState=weather.icing||{},ice=Math.max(0,Math.min(1,player.icing||icingState.strength||0));
    dyn.mill.rotation.z-=Math.max(0,dt)*(1.35-ice*1.1);
    dyn.icicles.scale.y=.7+ice*.5;
    const preheating=Boolean(player.preheating||icingState.preheating);
    dyn.firebox.scale.set(1,.94+Math.sin(time*7)*.055,1);
    dyn.heaterLamp.core.scale.setScalar(preheating?1.3+Math.sin(time*7)*.13:1);
    dyn.embers.forEach((e,i)=>{const u=(time*.22+i/10)%1;e.position.set(Math.sin(i*2.1+time)*.75,3+u*3.5,Math.cos(i*1.9)*.6);e.scale.setScalar((1-u)*(preheating?1.8:1));});
    const thermalState=weather.thermal||{},lane=Number.isInteger(thermalState.jetIndex)?thermalState.jetIndex:0;
    dyn.jets.forEach((jet,i)=>{
      const active=i===lane&&thermalState.phase==='burst';jet.visible=active;
      const pulse=.93+Math.sin(time*23+i)*.055;jet.scale.set(1,pulse,1/pulse);
      const warning=i===lane&&thermalState.phase==='warning';
      dyn.nozzles[i].scale.setScalar(active?1.07:warning?1+.06*Math.sin(time*13):1);
      dyn.pressureLamps[i].core.scale.setScalar(active?1.5:warning?1+Math.sin(time*10)*.26:.75);
    });
    // Expression profile changes art only; all weather targets, phases and lanes come from sim.
    const dramatic=currentExpression==='dramatic';
    dyn.cloudVeils.forEach((r,i)=>{r.position.x=Math.sin(time*.24+i)*1.4;r.position.y=Math.sin(time*.42+i)*.35;});
    dyn.upInlet.rotation.y=-time*.16;dyn.upCrown.rotation.y=time*.12;
    dyn.upCrown.position.y=Math.sin(time*.7)*.65;
    if(dramatic) {
      dyn.seeds.forEach((m,i)=>{
        const u=((time*.13+i/24)%1+1)%1,a=i*2.399+time*.8;
        // Enter low, rise tightly, then spread radially over the open crown.
        const spread=Math.max(0,(u-.75)/.25),r=4.3+(i%4)*.55+spread*7;
        m.position.set(Math.cos(a)*r,-5+u*31-spread*spread*1.5,Math.sin(a)*r);m.scale.setScalar((.6+Math.sin(u*Math.PI)*.8)*(1-spread*.5));
      });
      const cycle=((time%6)+6)%6,prepare=cycle<1.3,gust=cycle>=1.3&&cycle<3.4;
      const gustStrength=prepare?cycle/1.3:gust?1:Math.exp(-(cycle-3.4)*2.1);
      dyn.sock.rotation.x=prepare?-.16*gustStrength:gust?.13+Math.sin(time*10)*.035:Math.sin((cycle-3.4)*7)*Math.exp(-(cycle-3.4)*2)*.16;
      dyn.sock.rotation.y=prepare?-.1*gustStrength:Math.sin(time*1.4)*.045;
      dyn.sockSections.forEach((s,i)=>{
        const bend=prepare?-gustStrength*.12*i:Math.sin(time*(gust?9:3)-i*.8)*.04*i*(.25+gustStrength);
        s.position.x=bend;s.position.y=prepare?-.045*i*i*(1-gustStrength*.45):Math.sin(time*7-i*.9)*.05*i*gustStrength;
        s.position.z=s.userData.baseZ*(prepare?.78+.13*gustStrength:1);s.rotation.z=bend*.35;
      });
    } else dyn.sock.rotation.x=0;
    const windCycle=((time%6)+6)%6,windEnvelope=windCycle<1.3?.08:windCycle<3.4?Math.sin((windCycle-1.3)/2.1*Math.PI)*.8+.2:Math.exp(-(windCycle-3.4)*2)*.25;
    dyn.gustCloths.forEach((r,i)=>{r.position.z=((time*(9+i)-i*3)%9)-4.5;r.position.x=Math.sin(time*5+i)*.3;r.material.opacity=.55*windEnvelope;r.scale.y=.8+windEnvelope*.45;});
    const lightningProgress=THREE.MathUtils.clamp(storm.progress??0,0,1);
    for(const g of [dyn.charge,dyn.strikeForks,dyn.afterglow])g.position.copy(dyn.bolt.position);
    dyn.charge.visible=phase==='warning';dyn.strikeForks.visible=phase==='strike';dyn.afterglow.visible=phase==='recovery';
    dyn.charge.scale.set(1-lightningProgress*.6,1,1-lightningProgress*.6);
    dyn.charge.rotation.y=time*.28+lightningProgress*.7;
    dyn.chargeStrands.forEach((r,i)=>{r.material.opacity=(.18+.5*lightningProgress)*(.75+.25*Math.sin(time*5+i));r.position.y=Math.sin(time*3+i)*.3;});
    dyn.strikeForks.rotation.y=dyn.bolt.rotation.y;dyn.strikeForks.scale.y=.9+Math.sin(time*18)*.06;
    dyn.afterglow.position.y+=lightningProgress*1.5;dyn.afterglow.rotation.y=time*.2;
    dyn.afterglowStrokes.forEach((r,i)=>{r.material.opacity=.32*(1-lightningProgress);r.position.y=Math.sin(time*1.3+i)*.25;});
    dyn.crystalFans.rotation.z=Math.sin(time*.22)*.018;
    dyn.preheatSteam.forEach((r,i)=>{
      const u=(time*.15+i*.25)%1;r.position.y=u*2.8;r.rotation.y=time*.08+i*.17;
      r.material.opacity=(preheating?.36:.075)*Math.sin(u*Math.PI);r.scale.set(1+u*.3,1+u*.15,1+u*.3);
    });
    if(dramatic)dyn.embers.forEach((e,i)=>{const u=(time*(preheating?.54:.18)+i/10)%1,a=i*2.399;e.position.set(Math.sin(a)*u*(preheating?2.8:1),3+u*(preheating?8:3)-u*u*(preheating?3:1),Math.cos(a)*u*2);e.scale.setScalar((1-u)*(preheating?1.6:.65));});
    const heatProgress=THREE.MathUtils.clamp(thermalState.progress??0,0,1);
    dyn.heatLayers.forEach((h,i)=>{
      const selected=i===lane,burst=selected&&thermalState.phase==='burst',warning=selected&&thermalState.phase==='warning',recovery=selected&&thermalState.phase==='recovery';
      h.release.visible=burst;h.warning.visible=warning;h.ash.visible=recovery;
      // Anticipation stays at the nozzle; the main body opens rapidly and the ash survives it.
      h.release.scale.x=.22+.78*Math.min(1,heatProgress*7);
      h.body.material.opacity=.5+Math.sin(time*11+i)*.035;h.sheath.material.opacity=.23+Math.sin(time*8)*.025;
      h.scrolls.forEach((r,j)=>{r.position.y=Math.sin(time*6-j)*.2;r.material.opacity=.38+.06*Math.sin(time*4+j);});
      h.breaths.forEach((r,j)=>{const beat=.5+.5*Math.sin(time*(3+heatProgress*5)-j*.9);r.scale.set(.45+heatProgress*.55,.65+beat*.45,1);r.material.opacity=(.16+beat*.25)*(.3+heatProgress*.7);});
      h.ash.position.y=heatProgress*2.4;h.ashStrokes.forEach((r,j)=>{r.material.opacity=.28*(1-heatProgress);r.position.z=Math.sin(time*.7+j)*.22;r.scale.y=1+heatProgress*.35;});
      if(dramatic&&warning)dyn.pressureLamps[i].core.scale.setScalar(.7+Math.pow(.5+.5*Math.sin(time*(4+heatProgress*9)),3)*.85);
    });
  }

  function setExpression(expression='dramatic') {
    if(!Object.hasOwn(WEATHER_EXPRESSION_PROFILES,expression))return currentExpression;
    currentExpression=expression;
    for(const g of dramaticGroups)g.visible=expression==='dramatic';
    root.userData.expressionProfile=WEATHER_EXPRESSION_PROFILES[expression];
    return currentExpression;
  }

  function setMode(mode='painted') {
    const normalized=mode==='toon'?'cel':mode==='handdrawn'?'painted':mode;
    if(!['painted','cel','original'].includes(normalized))return currentMode;
    currentMode=normalized;
    root.traverse(o=>{
      if(!o.isMesh)return;
      if(!originalMaterials.has(o))originalMaterials.set(o,o.material);
      const source=originalMaterials.get(o);
      if(normalized==='painted'){o.material=source;return;}
      function convert(m) {
        if(m.userData?.glow||m.transparent)return m;
        let variants=modeMaterials.get(m);if(!variants){variants={};modeMaterials.set(m,variants);}
        if(!variants[normalized]) {
          const params={color:m.color?.clone()||colorScratch.set(0xffffff).clone(),vertexColors:!!m.vertexColors,side:m.side};
          variants[normalized]=normalized==='cel'?new THREE.MeshToonMaterial(params):new THREE.MeshStandardMaterial({...params,roughness:.92,metalness:0});materials.add(variants[normalized]);
        }
        return variants[normalized];
      }
      o.material=Array.isArray(source)?source.map(convert):convert(source);
    });
    return currentMode;
  }
  function inspect() {
    const byStation={};let meshes=0,triangles=0,vertices=0,visibleMeshes=0;
    function isVisible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
    for(const [id,g] of stations) {
      let localMeshes=0,localTriangles=0,localVisible=0;g.updateMatrixWorld(true);
      g.traverse(o=>{if(!o.isMesh)return;localMeshes++;if(isVisible(o)){localVisible++;visibleMeshes++;}const p=o.geometry.attributes.position,instances=o.isInstancedMesh?o.count:1;localTriangles+=(o.geometry.index?.count||p.count)/3*instances;vertices+=p.count*instances;});
      const bounds=new THREE.Box3().setFromObject(g);byStation[id]={meshes:localMeshes,visibleMeshes:localVisible,triangles:Math.round(localTriangles),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
      meshes+=localMeshes;triangles+=localTriangles;
    }
    return {mode:currentMode,expression:currentExpression,expressionProfile:WEATHER_EXPRESSION_PROFILES[currentExpression],meshes,visibleMeshes,triangles:Math.round(triangles),vertices,byStation,reusedColorComponentsClamped,reusedCloudAssets:4,newCloudAssetCount:0,originalFixtureAssemblies:5,limits:WEATHER_ASSET_LIMITS};
  }
  function dispose() {
    if(disposed)return;disposed=true;
    for(const mixer of mixers){mixer.stopAllAction();mixer.uncacheRoot(mixer.getRoot());}
    for(const geo of geometries)geo.dispose();for(const m of materials)m.dispose();root.clear();
  }
  setExpression('dramatic');update({time:0,weather:{},player:{}},0);
  return {root,stations,update,setMode,setExpression,dispose,inspect};
}
