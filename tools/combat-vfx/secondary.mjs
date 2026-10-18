// Secondary Cloudstitch combat effects, orders 27–48.
// Meshes and transform tracks only; collisions, damage and audio belong to the game.
export function buildSecondary(spec, kit) {
  const {root, group, puff, box, cone, cylinder, ring, tube, beam, motion, P, random} = kit;
  const TAU = Math.PI * 2;
  const supported = new Set([
    'small-explosion', 'large-explosion', 'airburst', 'shrapnel-burst',
    'smoke-puff', 'steam-vent', 'smoldering-fire', 'ember-drift',
    'burning-state', 'heavy-smoke-state', 'gas-leak-state', 'overheat-state',
    'short-circuit-state', 'engine-stall-state', 'envelope-rupture-state',
    'module-detach-state', 'shield-pulse', 'armor-block', 'repair-stitch',
    'healing-pulse', 'salvage-tether', 'mount-lock'
  ]);
  if (!supported.has(spec.id)) throw new Error(`Unsupported secondary effect: ${spec.id}`);

  // Explicitly match the endpoints of loops. Most traveling marks disappear
  // before resetting, avoiding a visible jump or a rapidly flashing light.
  function anim(node, data) {
    const d = {...data};
    for (const key of ['positions', 'scales', 'rotations']) {
      if (!d[key]) continue;
      d[key] = d[key].map(v => Array.isArray(v) ? [...v] : v);
      if (spec.loop) {
        const v = d[key][0];
        d[key][d[key].length - 1] = Array.isArray(v) ? [...v] : v;
      }
    }
    motion(node, d);
  }
  function pulse(node, start=.02, peak=.22, end=.95, size=1) {
    anim(node, {times:[0,start,peak,end,1],scales:[.001,.001,size,.001,.001]});
  }
  function placed(mesh, p=[0,0,0], r=[0,0,0], s=null) {
    mesh.position.set(...p); mesh.rotation.set(...r);
    if (s) mesh.scale.set(...s);
    return mesh;
  }
  function arc(r, from, to, y, steps=16) {
    return Array.from({length:steps+1},(_,i) => {
      const a = from + (to-from)*i/steps;
      return [Math.cos(a)*r,y,Math.sin(a)*r];
    });
  }
  function shardCloud({parent=root, count=12, radius=1.4, height=1, color=P.brass,
      start=.05, end=.9, origin=[0,0,0], thin=false}={}) {
    for (let i=0;i<count;i++) {
      const a = i/count*TAU + random()*.3;
      const r = radius*(.55+random()*.45);
      const h = height*(.4+random()*.6);
      const g = group('flying_shard',parent);
      placed(box(thin?.035:.08+random()*.09,thin?.28:.11+random()*.13,.055,color,g),[0,0,0],[a*.3,a,a]);
      const mid = start+(end-start)*.28;
      const out = [origin[0]+Math.cos(a)*r,origin[1]+h*.15,origin[2]+Math.sin(a)*r];
      anim(g,{times:[0,start,mid,end,1],
        positions:[origin,origin,[origin[0]+Math.cos(a)*r*.4,origin[1]+h,origin[2]+Math.sin(a)*r*.4],out,out],
        scales:[.001,.001,1,.001,.001],
        rotations:[[0,0,0],[0,0,0],[a*.4,1.2,a*.5],[1.8,a,3],[1.8,a,3]]});
    }
  }
  // All packets have an empty first/last frame and a broad, slow middle phase.
  function plume({parent=root,count=7,color=P.smoke,radius=.28,spread=.45,rise=1.7,
      origin=[0,0,0],start=.03,end=.96,drift=[0,0,0],verticalStretch=1}={}) {
    for (let i=0;i<count;i++) {
      const phase = i/Math.max(1,count-1);
      const s = start+phase*.16, e = Math.min(.99,end+phase*.025);
      const a = random()*TAU, lateral = spread*(.3+random()*.7);
      const g = group('painted_plume_packet',parent);
      placed(puff(radius*(.72+random()*.5),color,g,1),[0,0,0],[random(),random(),random()],[1,verticalStretch,1]);
      const x = Math.cos(a)*lateral, z=Math.sin(a)*lateral;
      const first=[origin[0]+x*.15,origin[1],origin[2]+z*.15];
      const middle=[origin[0]+x*.6+drift[0]*.4,origin[1]+rise*.35+drift[1]*.4,origin[2]+z*.6+drift[2]*.4];
      const last=[origin[0]+x+drift[0],origin[1]+rise+drift[1],origin[2]+z+drift[2]];
      anim(g,{times:[0,s,s+.13,(s+e)*.5,e,1],
        positions:[first,first,middle,last,last,last],
        scales:[.001,.001,.65,1.18,.001,.001],
        rotations:[[0,0,0],[0,0,0],[.1,a*.2,.1],[.25,a*.5,.15],[.35,a*.7,.2],[.35,a*.7,.2]]});
    }
  }
  function emberCloud({count=12,origin=[0,.2,0],spread=.65,rise=1.6,parent=root}={}) {
    for(let i=0;i<count;i++) {
      const g=group('rising_ember',parent), a=random()*TAU, r=spread*(.25+random()*.75);
      placed(puff(.025+random()*.025,i%3===0?P.cream:P.amber,g,0),[0,0,0],[0,0,0],[1,1.6,.75]);
      const s=.03+i/count*.25,e=.86+i/count*.09;
      anim(g,{times:[0,s,s+.12,e,1],
        positions:[origin,origin,[origin[0]+Math.cos(a)*r*.35,origin[1]+rise*.25,origin[2]+Math.sin(a)*r*.35],
          [origin[0]+Math.cos(a)*r,origin[1]+rise,origin[2]+Math.sin(a)*r],[origin[0]+Math.cos(a)*r,origin[1]+rise,origin[2]+Math.sin(a)*r]],
        scales:[.001,.001,1,.001,.001],rotations:[[0,0,0],[0,0,0],[.4,.5,.3],[1,1,.8],[1,1,.8]]});
    }
  }
  function fireTongues({parent=root,count=7,radius=.38,height=1,origin=[0,0,0],hotCore=true}={}) {
    const fire=group('coral_fire_cluster',parent);fire.position.set(...origin);
    for(let i=0;i<count;i++) {
      const a=i/count*TAU, r=radius*(i===0?.1:.5+random()*.5);
      const g=group('slow_fire_tongue',fire);
      const h=height*(.58+random()*.42);
      placed(cone(.13+random()*.08,h,i%3===0?P.hot:P.coral,g,5),[0,h*.5,0],[.1,0,.1],[1,1,.75]);
      if(hotCore && i%2===0)placed(cone(.065,h*.55,P.cream,g,4),[0,h*.27,.025]);
      const p=[Math.cos(a)*r,0,Math.sin(a)*r];
      anim(g,{times:[0,.24,.52,.78,1],positions:[p,[p[0]+.045,0,p[2]],[p[0]-.04,0,p[2]+.03],p,p],
        scales:[[.8,.75,.8],[1,1.1,1],[.85,.9,.85],[.95,1,.95],[.8,.75,.8]],
        rotations:[[0,a,.06],[.05,a,.15],[-.05,a,-.1],[.02,a,.02],[0,a,.06]]});
    }
    return fire;
  }
  function explosion({size=1,origin=[0,0,0],air=false,shrapnel=false}={}) {
    const ex=group('layered_explosion');ex.position.set(...origin);
    const core=group('cream_impact_core',ex);puff(size*.28,P.cream,core,1);
    pulse(core,.02,.14,.5,1);
    for(let i=0;i<(size>1?10:7);i++) {
      const a=i/(size>1?10:7)*TAU, g=group('coral_explosion_petal',ex);
      puff(size*(.23+random()*.08),i%3===0?P.hot:P.coral,g,1);
      const d=size*(.48+random()*.17);
      anim(g,{times:[0,.04,.23,.64,1],
        positions:[[0,0,0],[0,0,0],[Math.cos(a)*d,.12+Math.abs(Math.sin(a))*size*.2,Math.sin(a)*d],
          [Math.cos(a)*d*1.4,.35*size,Math.sin(a)*d*1.4],[Math.cos(a)*d*1.4,.35*size,Math.sin(a)*d*1.4]],
        scales:[.001,.001,1,.001,.001]});
    }
    const wave=group('cream_pressure_ring',ex);ring(size*.65,.035*size,P.cream,wave,'y');
    anim(wave,{times:[0,.06,.3,.7,1],scales:[.001,.001,[1,.55,1],[1.85,.12,1.85],.001]});
    if(air) {
      const vertical=group('airburst_vertical_hoop',ex);
      ring(size*.6,.028*size,P.amber,vertical,'z');pulse(vertical,.06,.34,.72,1.5);
    }
    shardCloud({parent:ex,count:shrapnel?24:(size>1?20:11),radius:size*(shrapnel?2.1:1.45),height:size*.95,color:P.brass,thin:shrapnel});
    if(shrapnel)shardCloud({parent:ex,count:7,radius:size*1.9,height:size*.8,color:P.wood,thin:false,start:.09,end:.96});
    plume({parent:ex,count:size>1?10:6,radius:size*.23,spread:size*.8,rise:size*1.45,
      color:air?P.smoke:P.darkSmoke,start:.2,end:.97});
  }

  switch(spec.id) {
    case 'small-explosion':
      explosion({size:.78,origin:[0,.12,0]});
      break;
    case 'large-explosion':
      explosion({size:1.45,origin:[0,.22,0]});
      break;
    case 'airburst':
      explosion({size:1.05,origin:[0,1.05,0],air:true});
      break;
    case 'shrapnel-burst':
      explosion({size:.88,origin:[0,.25,0],shrapnel:true});
      break;
    case 'smoke-puff': {
      const center=group('initial_smoke_bloom');puff(.4,P.smoke,center,1);
      pulse(center,.02,.18,.65,1);
      plume({count:9,color:P.smoke,radius:.29,spread:.75,rise:.85,start:.04});
      break;
    }
    case 'steam-vent': {
      const nozzle=group('teal_steam_vent');
      placed(cylinder(.18,.2,P.deepTeal,nozzle,10),[0,.1,0]);
      placed(ring(.18,.033,P.brass,nozzle),[0,.21,0]);
      plume({count:10,color:P.ivory,radius:.21,spread:.25,rise:2.2,origin:[0,.22,0],verticalStretch:1.5});
      for(let i=0;i<3;i++) {
        const curl=group('cream_steam_curl');
        tube([[-.1,0,0],[.08,.18,.03],[-.05,.38,0],[.12,.58,-.03]],.022,P.cream,curl);
        const x=(i-1)*.2;
        anim(curl,{times:[0,.08+i*.07,.3+i*.06,.86,1],positions:[[x,.2,0],[x,.2,0],[x,.7,.04],[x,1.65,.1],[x,1.65,.1]],scales:[.001,.001,1,.001,.001]});
      }
      break;
    }
    case 'smoldering-fire': {
      const bed=group('charred_wood_embers');
      for(let i=0;i<4;i++)placed(box(.65,.08,.13,i%2?P.navy:P.wood,bed),[(i%2-.5)*.24,.08,0],[0,i*.8,0]);
      fireTongues({count:4,radius:.25,height:.44,origin:[0,.12,0],hotCore:false});
      plume({count:6,color:P.darkSmoke,radius:.18,spread:.35,rise:1.2,origin:[0,.25,0]});
      emberCloud({count:6,spread:.4,rise:.9});
      break;
    }
    case 'ember-drift':
      emberCloud({count:22,origin:[0,.05,0],spread:1.05,rise:2});
      break;
    case 'burning-state':
      fireTongues({count:8,radius:.43,height:1.05});
      plume({count:7,color:P.darkSmoke,radius:.23,spread:.5,rise:1.8,origin:[0,.6,0],start:.08});
      emberCloud({count:10,origin:[0,.5,0],spread:.55,rise:1.55});
      break;
    case 'heavy-smoke-state': {
      const core=group('dense_navy_smoke');
      for(let i=0;i<4;i++)placed(puff(.31,i%2?P.navy:P.darkSmoke,core,1),[Math.cos(i*1.6)*.19,.25+i*.15,Math.sin(i*1.6)*.15]);
      anim(core,{times:[0,.3,.65,1],scales:[.85,1.05,.93,.85],rotations:[[0,0,0],[.04,.15,.02],[-.03,-.1,-.02],[0,0,0]]});
      plume({count:12,color:P.navy,radius:.38,spread:.7,rise:2.2,origin:[0,.35,0]});
      plume({count:5,color:P.darkSmoke,radius:.24,spread:.85,rise:1.6,origin:[0,.25,0],drift:[.35,0,.1]});
      break;
    }
    case 'gas-leak-state': {
      const leak=group('teal_gas_nozzle');
      placed(cylinder(.13,.16,P.brass,leak,8),[0,.08,0]);
      placed(ring(.12,.024,P.deepTeal,leak),[0,.17,0]);
      plume({count:11,color:P.lightTeal,radius:.23,spread:.55,rise:.6,origin:[0,.2,0],drift:[.95,.18,.2]});
      for(let i=0;i<4;i++) {
        const wisp=group('gas_sinuous_wisp');
        tube([[0,0,0],[.2,.12,.08],[.45,.15,-.04],[.7,.32,.1]],.03,i%2?P.teal:P.lightTeal,wisp);
        anim(wisp,{times:[0,.06+i*.04,.35+i*.04,.94,1],positions:[[0,.2,0],[0,.2,0],[.3,.35,(i-1.5)*.12],[1,.55,(i-1.5)*.2],[1,.55,(i-1.5)*.2]],scales:[.001,.001,1,.001,.001]});
      }
      break;
    }
    case 'overheat-state': {
      const heat=group('hot_copper_coil');
      placed(cylinder(.27,.24,P.deepTeal,heat,10),[0,.14,0]);
      for(let i=0;i<3;i++)placed(ring(.27,.03,i===1?P.coral:P.brass,heat),[0,.06+i*.09,0]);
      for(let i=0;i<4;i++) {
        const mark=group('slow_heat_wave');
        const x=(i-1.5)*.17;
        tube([[0,0,0],[-.055,.17,0],[.05,.34,0],[-.025,.53,0]],.026,i%2?P.coral:P.hot,mark);
        anim(mark,{times:[0,.12+i*.035,.4+i*.03,.9,1],positions:[[x,.28,0],[x,.28,0],[x,.55,0],[x,1.15,0],[x,1.15,0]],scales:[.001,.001,1,.001,.001]});
      }
      plume({count:4,color:P.cream,radius:.13,spread:.3,rise:1.15,origin:[0,.4,0],start:.1});
      break;
    }
    case 'short-circuit-state': {
      const terminal=group('brass_electric_terminals');
      placed(box(.6,.1,.3,P.deepTeal,terminal),[0,.05,0]);
      for(const x of [-.23,.23])placed(cylinder(.055,.18,P.brass,terminal,8),[x,.17,0]);
      for(let i=0;i<5;i++) {
        const branch=group('slow_electric_branch');
        const z=(i-2)*.09;
        tube([[-.23,.27,z],[-.13,.4,z+.025],[-.03,.32,z], [.08,.46,z-.025],[.15,.33,z],[.23,.27,z]],.018,i%2?P.amber:P.lightTeal,branch);
        pulse(branch,.06+i*.035,.3+i*.035,.92,1);
      }
      shardCloud({count:7,radius:.55,height:.7,color:P.amber,start:.14,end:.88,origin:[0,.3,0],thin:true});
      plume({count:3,color:P.smoke,radius:.12,spread:.25,rise:.8,origin:[0,.28,0],start:.3});
      break;
    }
    case 'engine-stall-state': {
      const body=group('teal_stalled_engine');
      placed(cylinder(.3,.4,P.teal,body,10),[0,.32,0],[Math.PI/2,0,0]);
      placed(ring(.3,.055,P.brass,body,'z'),[0,.32,.22]);
      placed(box(.72,.08,.5,P.wood,body),[0,.06,0]);
      const rotor=group('hesitating_propeller');rotor.position.set(0,.32,.29);
      puff(.08,P.brass,rotor,0);
      for(let i=0;i<3;i++) {
        const blade=group('propeller_blade',rotor);blade.rotation.z=i*TAU/3;
        placed(box(.1,.48,.055,P.woodLight,blade),[0,.27,0],[0,0,.12]);
      }
      anim(rotor,{times:[0,.18,.4,.64,.82,1],rotations:[[0,0,0],[0,0,.85],[0,0,1.25],[0,0,1.08],[0,0,.4],[0,0,0]]});
      plume({count:8,color:P.navy,radius:.18,spread:.4,rise:.8,origin:[0,.34,-.24],drift:[-.45,.25,-.3],start:.18});
      break;
    }
    case 'envelope-rupture-state': {
      const seam=group('ruptured_cream_cloth');
      for(const side of [-1,1]) {
        const panel=group('separating_envelope_panel',seam);
        placed(box(.44,.035,.7,side<0?P.cream:P.ivory,panel),[0,0,0],[0,0,0]);
        for(let i=0;i<4;i++)placed(cone(.11,.22,i%3?P.cream:P.coral,panel,3),[-side*.2,0,(i-1.5)*.16],[0,0,side*Math.PI/2],[1,1,.12]);
        anim(panel,{times:[0,.18,.48,.82,1],positions:[[side*.2,.65,0],[side*.24,.65,0],[side*.42,.7,0],[side*.46,.63,0],[side*.2,.65,0]],rotations:[[0,0,0],[0,0,side*.05],[0,.08,side*.18],[0,-.03,side*.13],[0,0,0]]});
      }
      for(let i=0;i<8;i++) {
        const g=group('torn_fabric_scrap');
        placed(cone(.11+random()*.06,.25+random()*.12,i%3===0?P.coral:P.cream,g,3),[0,0,0],[0,0,.5],[1,1,.12]);
        const a=i/8*TAU, end=[Math.cos(a)*1.05,.2+random()*.7,Math.sin(a)*.9];
        anim(g,{times:[0,.08,.3,.95,1],positions:[[0,.65,0],[0,.65,0],[end[0]*.35,1+random()*.3,end[2]*.35],end,end],scales:[.001,.001,1,.001,.001],rotations:[[0,0,0],[0,0,0],[.3,a,.4],[1,a*1.5,1.8],[1,a*1.5,1.8]]});
      }
      plume({count:7,color:P.ivory,radius:.13,spread:.25,rise:1.2,origin:[0,.65,0],drift:[.1,.3,0],start:.12});
      break;
    }
    case 'module-detach-state': {
      const socket=group('empty_brass_connection');
      placed(ring(.24,.05,P.brass,socket),[0,.08,0]);
      for(let i=0;i<4;i++) {const a=i/4*TAU;placed(box(.12,.12,.1,P.deepTeal,socket),[Math.cos(a)*.25,.08,Math.sin(a)*.25],[0,-a,0]);}
      const detached=group('detaching_teal_wood_frame');
      placed(box(.6,.09,.45,P.wood,detached),[0,.08,0]);
      for(const x of [-.25,.25])beam([x,.12,-.17],[x,.5,-.17],.035,P.brass,detached);
      beam([-.25,.5,-.17],[.25,.5,-.17],.035,P.teal,detached);
      placed(box(.24,.25,.18,P.teal,detached),[0,.27,.03]);
      placed(cylinder(.07,.06,P.brass,detached,8),[0,.27,.15],[Math.PI/2,0,0]);
      anim(detached,{times:[0,.1,.34,.8,1],positions:[[0,.13,0],[0,.2,0],[.35,.6,.25],[1,.2,.75],[1,.2,.75]],scales:[1,1,1,.001,.001],rotations:[[0,0,0],[0,0,.06],[.2,.25,.3],[.6,.8,.85],[.6,.8,.85]]});
      shardCloud({count:8,radius:.85,height:.55,color:P.brass,start:.12,end:.8,origin:[0,.22,0]});
      plume({count:4,color:P.smoke,radius:.15,spread:.4,rise:.7,start:.17});
      break;
    }
    case 'shield-pulse': {
      const shield=group('teal_hemisphere_wire');
      placed(ring(.87,.027,P.teal,shield),[0,.08,0]);
      // Rib arcs form an open protective hemisphere rather than an opaque ball.
      for(let j=0;j<5;j++) {
        const a=j/5*Math.PI, pts=[];
        for(let i=0;i<=16;i++){const t=i/16*Math.PI;pts.push([Math.cos(t)*Math.cos(a)*.87,.08+Math.sin(t)*.87,Math.cos(t)*Math.sin(a)*.87]);}
        tube(pts,.018,j%2?P.teal:P.lightTeal,shield);
      }
      anim(shield,{times:[0,.12,.32,.74,1],scales:[.001,.7,1,1.06,.001]});
      for(let i=0;i<3;i++) {
        const ripple=group('shield_hit_ripple');
        ring(.19+i*.1,.025-i*.004,i%2?P.cream:P.lightTeal,ripple,'z');
        ripple.position.set(.28,.52,.73);
        pulse(ripple,.2+i*.065,.4+i*.065,.91,1.15);
      }
      break;
    }
    case 'armor-block': {
      const plate=group('teal_brass_armor_plate');
      placed(box(.75,.08,.55,P.deepTeal,plate),[0,.08,0],[0,0,.06]);
      for(const x of [-.28,.28])for(const z of [-.19,.19])placed(puff(.045,P.brass,plate,0),[x,.14,z]);
      anim(plate,{times:[0,.2,.32,.55,1],positions:[[0,0,0],[0,-.045,0],[0,.035,0],[0,0,0],[0,0,0]]});
      const chip=group('armor_cream_contact');placed(cone(.19,.38,P.cream,chip,5),[0,.3,0],[0,0,.3]);
      pulse(chip,.03,.15,.42,.8);
      shardCloud({count:13,radius:1.1,height:.28,color:P.brass,start:.04,end:.75,origin:[0,.15,0],thin:true});
      const scrape=group('armor_coralscrape');
      tube([[-.22,.15,-.06],[-.07,.16,.04],[.1,.15,.06],[.22,.15,.11]],.019,P.coral,scrape);
      pulse(scrape,.06,.25,.94,1);
      break;
    }
    case 'repair-stitch': {
      const fabric=group('repair_split_patch');
      for(const side of [-1,1])placed(box(.42,.025,.8,side<0?P.cream:P.coral,fabric),[side*.24,.04,0]);
      const stitches=8;
      for(let i=0;i<stitches;i++) {
        const z=-.34+i*.095, g=group('cream_thread_stitch');
        tube([[-.13,.075,z-.02],[0,.14,z],[.13,.075,z+.02]],.016,P.cream,g);
        const start=.06+i*.075, peak=start+.07;
        anim(g,{times:[0,start,peak,.9,1],scales:[.001,.001,1,1,spec.loop?.001:1]});
      }
      const needle=group('teal_repair_needle');
      placed(cone(.024,.36,P.teal,needle,5),[0,.12,0],[0,0,Math.PI/2]);
      placed(ring(.025,.009,P.brass,needle,'z'),[-.19,.12,0]);
      anim(needle,{times:[0,.1,.22,.34,.46,.58,.7,.84,1],
        positions:[[0,.12,-.48],[-.12,.11,-.34],[.12,.16,-.24],[-.12,.11,-.14],[.12,.16,-.04],[-.12,.11,.06],[.12,.16,.16],[0,.22,.39],[0,.22,.48]],
        scales:[.001,1,1,1,1,1,1,1,.001],
        rotations:[[0,0,0],[0,.15,0],[0,-.15,0],[0,.15,0],[0,-.15,0],[0,.15,0],[0,-.15,0],[0,0,0],[0,0,0]]});
      for(let i=0;i<3;i++) {
        const knot=group('repair_teal_confirmation');
        placed(puff(.045,P.lightTeal,knot,0),[(i-1)*.25,.17,.43]);
        pulse(knot,.7+i*.03,.82+i*.025,.99,1);
      }
      break;
    }
    case 'healing-pulse': {
      for(let i=0;i<3;i++) {
        const halo=group('gentle_healing_halo');
        ring(.5,.025,i%2?P.cream:P.lightTeal,halo,'y');
        const s=.03+i*.12;
        anim(halo,{times:[0,s,s+.18,.92,1],positions:[[0,.04,0],[0,.04,0],[0,.3+i*.12,0],[0,1.4+i*.1,0],[0,1.4+i*.1,0]],scales:[.001,.001,1,1.35,.001]});
      }
      for(let i=0;i<7;i++) {
        const leaf=group('healing_teal_leaf');const a=i/7*TAU;
        placed(puff(.09,i%2?P.lightTeal:P.cream,leaf,0),[0,0,0],[0,0,-.35],[.6,1.5,.45]);
        const p=[Math.cos(a)*.48,.12,Math.sin(a)*.48];
        anim(leaf,{times:[0,.05+i*.02,.32,.9,1],positions:[p,p,[p[0]*.9,.7,p[2]*.9],[p[0]*.5,1.5,p[2]*.5],[p[0]*.5,1.5,p[2]*.5]],scales:[.001,.001,1,.001,.001]});
      }
      break;
    }
    case 'salvage-tether': {
      const winch=group('brass_salvage_winch');
      placed(cylinder(.16,.3,P.brass,winch,10),[0,.16,0],[0,0,Math.PI/2]);
      for(const x of [-.18,.18])placed(box(.075,.28,.28,P.teal,winch),[x,.14,0]);
      // Visible rope sections deploy in sequence. This is a visual tether,
      // not a simulated rope or an actual physics constraint.
      for(let i=0;i<12;i++) {
        const seg=group('deploying_cream_rope');
        const z=.12+i*.15;
        tube([[0,.16,z],[.025,.15,z+.05],[-.015,.16,z+.1],[0,.16,z+.16]],.022,P.cream,seg);
        const s=.04+i*.045;
        anim(seg,{times:[0,s,s+.06,.88,1],scales:[.001,.001,1,1,spec.loop?.001:1]});
      }
      const hook=group('moving_brass_salvage_hook');
      tube([[0,.16,0],[0,.16,.18],[.08,.16,.25],[.17,.16,.2],[.14,.16,.11]],.035,P.brass,hook);
      placed(ring(.055,.02,P.brass,hook,'z'),[0,.16,-.05]);
      anim(hook,{times:[0,.08,.66,.87,1],positions:[[0,0,.1],[0,0,.2],[0,0,1.89],[0,0,1.89],[0,0,1.89]],scales:[.001,1,1,1,spec.loop?.001:1],rotations:[[0,0,0],[0,0,.1],[0,0,0],[0,0,-.08],[0,0,0]]});
      const catchMark=group('tether_catch_coral_chip');
      placed(box(.28,.13,.23,P.wood,catchMark),[0,.16,2.08]);
      pulse(catchMark,.65,.79,.99,1);
      break;
    }
    case 'mount-lock': {
      const collar=group('teal_mount_ring');
      placed(ring(.48,.065,P.teal,collar),[0,.12,0]);
      placed(ring(.32,.025,P.deepTeal,collar),[0,.12,0]);
      for(let i=0;i<4;i++) {
        const a=i/4*TAU, jaw=group('converging_brass_lock_jaw');
        placed(box(.16,.13,.23,P.brass,jaw),[0,0,0],[0,-a,0]);
        placed(box(.08,.08,.08,P.cream,jaw),[0,.08,-.06]);
        const far=[Math.cos(a)*.78,.15,Math.sin(a)*.78],near=[Math.cos(a)*.43,.15,Math.sin(a)*.43];
        anim(jaw,{times:[0,.1,.5,.85,1],positions:[far,far,near,near,near],scales:[.001,1,1,1,spec.loop?.001:1]});
      }
      const check=group('teal_lock_check_shape');
      beam([-.16,.45,.025],[-.03,.32,.025],.037,P.lightTeal,check);
      beam([-.03,.32,.025],[.24,.6,.025],.037,P.lightTeal,check);
      pulse(check,.48,.67,.98,1);
      const confirm=group('cream_mount_confirmation_ring');
      placed(ring(.53,.022,P.cream,confirm),[0,.12,0]);
      pulse(confirm,.5,.72,.96,1.18);
      break;
    }
  }
  root.userData.visual_style='Cloudstitch flat vertex paint: cream, coral, teal, brass and wood; no text, no rapid light flashing.';
  root.userData.secondary_effect=true;
  return root;
}
