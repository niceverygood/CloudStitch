// Cloudstitch atmospheric assets. Relative design units, Y up, Z front.
// Expression revision: latest 2026-10-18 direction calls for over tenfold bolder
// perceived drama through primary silhouette, middle layers and delayed rhythm.
// This is an art target, not a multiplier to asset scale, damage or particle count.
// Geometry and actual transform clips are exported independently of the viewer.
export const assets = [
  {id:'sunlit-cloud',name_ko:'햇살 이불구름',category:'clouds',role:'항로 양옆을 풍성하게 감싸는 넓고 낮은 구름 둑',motion_ko:'서로 다른 속도로 솟고 가라앉는 세 겹의 구름 숨결'},
  {id:'mist-ribbons',name_ko:'골짜기 안개리본',category:'clouds',role:'공중섬 사이에 가늘고 길게 흐르는 층층의 안개 길',motion_ko:'다섯 줄의 안개가 시차를 두고 옆으로 흐르고 늘어남'},
  {id:'rising-cloud',name_ko:'소용돌이 상승구름',category:'clouds',role:'빈 중심 통로를 감싸며 솟는 나선형 수직 지형 표식',motion_ko:'나선의 층이 서로 다르게 부풀고 떠오르는 완만한 흐름'},
  {id:'storm-front',name_ko:'먹구름 모루전선',category:'clouds',role:'항로 멀리 보이는 수평 모루와 비의 장막',motion_ko:'상층과 아랫층의 느린 대류, 여러 비 장막의 엇갈린 낙하'},
  {id:'harbor-gull',name_ko:'항구 흰깃갈매기',category:'birds',role:'계류기둥·밧줄과 함께 항구의 생활감을 채우는 큰 새',motion_ko:'두 날개를 크게 펼쳤다 접는 갈매기 날갯짓과 몸의 들썩임'},
  {id:'wind-swallows',name_ko:'바람꼬리제비 떼',category:'birds',role:'긴 제비꼬리와 낫 모양 날개로 항로의 흐름을 드러내는 세 마리',motion_ko:'세 마리의 날개가 위상을 달리해 빠르게 퍼덕이고 몸이 기울어짐'},
  {id:'ridge-raptor',name_ko:'능선 황금수리',category:'birds',role:'절벽 보초바위와 둥지 위에서 넓은 날개를 펴는 큰 맹금',motion_ko:'깊고 느린 날갯짓, 날개 끝과 꼬리의 뒤따르는 움직임'},
  {id:'cliff-songbirds',name_ko:'벼랑 꽃가지새',category:'birds',role:'꽃 핀 가지·둥지·이끼와 함께 근경을 채우는 둥근 두 마리',motion_ko:'두 마리의 짧은 날개가 번갈아 펼쳐지고 고개와 몸이 작게 움직임'}
];

export function build(spec,k) {
  const {THREE,root,palette:p,mesh,group,box,bevelBox,cylinder,sphere,tube,rope,random}=k;
  const clips=[];
  let serial=0;
  const C={sun:0xfff3d6,cream:0xfff8e9,peach:0xf4d6bc,shade:0xc5d9da,
    mist:0xdbe9e1,mistBlue:0xb9d1d4,mistGold:0xf3ead0,
    storm:0x647183,stormTop:0x8c97a6,stormDeep:0x414d65,rain:0x90abb9,
    gull:0xf4edda,gullWing:0xd1d7cf,gullDark:0x465a63,beak:0xe5b661,
    swallow:0x31566b,swallowBlue:0x4f8593,swallowCream:0xe8dcc2,swallowCoral:0xcc795d,
    raptor:0x967048,raptorWing:0x765a40,raptorTip:0x4c4540,raptorGold:0xcda35d,
    songBlue:0x6d9b9d,songGold:0xd8a35f,songWing:0x437277};

  function at(g,pos,scale=null) {g.position.set(...pos);if(scale)g.scale.set(...scale);return g;}
  function quatTrack(g,times,angles) {
    const values=angles.flatMap(a=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...a)).toArray());
    return new THREE.QuaternionKeyframeTrack(`${g.name}.quaternion`,times,values);
  }
  function vectorTrack(g,property,times,values) {return new THREE.VectorKeyframeTrack(`${g.name}.${property}`,times,values.flat());}
  function volume(name,pos,scale,color,parent=root,seed=0,detail=12) {
    const geo=new THREE.SphereGeometry(1,detail,9),a=geo.attributes.position;
    for(let i=0;i<a.count;i++) {
      const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
      const wave=1+.055*Math.sin(x*5.1+seed)*Math.cos(z*4.2-seed)+.026*Math.sin(y*7+z*3+seed);
      // Wind skews each cushion; lower surfaces are flatter than the piled crown.
      a.setXYZ(i,x*wave+.09*y*y,y*wave*(y<-.3?.91:1),z*wave+.055*Math.sin(y*4+seed));
    }
    geo.computeVertexNormals();
    const smooth=geo.toNonIndexed(),m=mesh(name,geo,color,parent),g=m.geometry;
    const n=smooth.getAttribute('normal'),col=[],base=new THREE.Color(color);
    for(let i=0;i<n.count;i++) {
      const lit=.79+.24*Math.max(0,n.getX(i)*-.27+n.getY(i)*.86+n.getZ(i)*.33);
      const cc=base.clone().multiplyScalar(lit);
      col.push(cc.r,cc.g,cc.b);
    }
    g.setAttribute('normal',n.clone());g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    at(m,pos,scale);return m;
  }
  function breathing(name,groups,duration=10,amplitude=.1) {
    const tracks=[],ts=[0,duration*.25,duration*.5,duration*.75,duration];
    groups.forEach((g,i)=>{
      const base=g.position.clone(),phase=i*1.47;
      const vals=ts.map(t=>{
        const a=Math.sin(t/duration*Math.PI*2+phase)-Math.sin(phase);
        return [base.x+a*amplitude*.4,base.y+a*amplitude,base.z+a*amplitude*.25];
      });
      tracks.push(vectorTrack(g,'position',ts,vals));
      const sv=ts.map(t=>{const a=(Math.cos(t/duration*Math.PI*2+phase)-Math.cos(phase))*.025;return[1+a,1-a*.3,1+a*.5];});
      tracks.push(vectorTrack(g,'scale',ts,sv));
    });
    clips.push(new THREE.AnimationClip(name,duration,tracks));
  }

  function cloudSun() {
    const under=group('wide_crescent_saddle'),middle=group('golden_saddle_rim'),top=group('three_asymmetric_giant_crowns'),satellites=group('detached_satellite_bank');
    // A low crescent makes the high crown readable; the shallow middle is open.
    for(let i=0;i<13;i++){
      const t=i/12,x=(t-.5)*8.6,z=Math.cos((t-.5)*Math.PI)*.75;
      volume('pearl_saddle_foundation',[x,-.45+Math.abs(t-.5)*.35,z],[1.02,.48,.9],i%3?C.shade:C.peach,under,i*.6);
    }
    for(let i=0;i<11;i++){
      const t=i/10,x=(t-.5)*8.25,z=-.25+Math.sin(t*Math.PI)*.75;
      const lip=.28+Math.pow(Math.abs(t-.5)*2,1.8)*.9;
      volume('curving_sunlit_saddle_rim',[x,lip,z],[.86,.57+Math.abs(t-.5)*.45,.72],i%4===0?C.peach:C.sun,middle,i*.7);
    }
    const crowns=[[-2.0,1.45,-.3,1.15,1.7,1.0],[.15,2.0,-.47,1.4,2.2,1.06],[2.25,.95,-.32,1.22,1.25,.92]];
    crowns.forEach((c,i)=>{
      volume('giant_upward_crown',c.slice(0,3),c.slice(3),C.cream,top,i+4,14);
      volume('peach_crown_inner_shoulder',[c[0]-.55,c[1]-.6,c[2]+.32],[.85,.91,.83],C.peach,top,i);
      volume('ivory_crown_windward_roll',[c[0]+.48,c[1]+.4,c[2]+.15],[.77,1.0,.71],C.cream,top,i+2);
    });
    for(let i=0;i<7;i++)volume('middle_crown_scallops',[-2.9+i*.95,.45+Math.sin(i*.8)*.35,.88],[.7,.66,.56],i%3?C.sun:C.cream,middle,i);
    for(let i=0;i<5;i++){
      const x=-4.7+i*2.3,z=i%2?2.15:-1.8,y=-.72+(i%3)*.15;
      volume('separate_satellite_cushion',[x,y,z],[.67,.24,.45],i%2?C.mistGold:C.cream,satellites,i);
      volume('satellite_small_curl',[x+.5,y+.13,z+.08],[.39,.29,.32],C.cream,satellites,i+1);
    }
    breathing('crowned_cloud_saddle_breath',[under,middle,top,satellites],15,.14);
  }

  function cloudMist() {
    const layers=[];
    let hazeMaterial;
    for(let j=0;j<5;j++) {
      const g=group(`interlacing_S_ribbon_${j}`);g.position.set((j%2)*.6,(j-2)*.31,(j-2)*.55);layers.push(g);
      for(let i=0;i<9;i++) {
        const t=i/8,angle=t*Math.PI*2.1+j*.65,x=(t-.5)*10;
        const curve=Math.sin(angle)*(j%2?1.05:.8),height=Math.cos(angle)*.18;
        const m=volume('long_translucent_mist_turn',[x,height,curve],[1.04,.085+Math.sin(t*Math.PI)*.08,.23+Math.sin(t*Math.PI)*.15],j%3===0?C.mistGold:j%2?C.mist:C.mistBlue,g,j*.7+i);
        m.rotation.y=-Math.cos(angle)*.65;
        if(j%2){if(!hazeMaterial){hazeMaterial=m.material.clone();hazeMaterial.transparent=true;hazeMaterial.opacity=.57;hazeMaterial.depthWrite=false;}m.material=hazeMaterial;}
      }
      volume('detached_ribbon_vapor_tip',[5.4,.1,Math.sin(j*.65)*.8],[.85,.042,.11],C.mist,g,j);
    }
    const ts=[0,4,8,12,16],tracks=[];
    layers.forEach((g,i)=>{
      const b=g.position.clone();
      tracks.push(vectorTrack(g,'position',ts,ts.map(t=>[b.x+Math.sin(t/16*Math.PI*2+i)*.18-Math.sin(i)*.18,b.y+Math.sin(t/16*Math.PI*2+i)*.025-Math.sin(i)*.025,b.z])));
      tracks.push(vectorTrack(g,'scale',ts,ts.map(t=>[1+.025*(Math.sin(t/16*Math.PI*2+i)-Math.sin(i)),1,1])));
    });
    clips.push(new THREE.AnimationClip('layered_mist_stream',16,tracks));
  }

  function cloudRising() {
    const gs=[group('low_great_spiral_curl'),group('high_great_spiral_curl'),group('broken_wind_crown'),group('thin_spiral_tail')];
    for(let i=0;i<33;i++) {
      const t=i/32,angle=t*Math.PI*4.0,r=1.65+.35*Math.sin(t*8),y=t*7.5-3.6;
      const scale=.45+Math.pow(Math.sin(t*Math.PI),2)*.56;
      const m=volume('large_wind_swept_spiral_roll',[Math.cos(angle)*r,y,Math.sin(angle)*r],[scale*.9,.4+scale*.13,scale*1.35],i%4===0?C.mistGold:i%3===0?C.shade:C.cream,gs[t<.5?0:1],i*.45);
      m.rotation.y=-angle;
    }
    for(let i=0;i<5;i++) {
      const a=i/7*Math.PI*2+.4;
      const m=volume('broken_open_crown_curl',[Math.cos(a)*1.9,3.8+(i%2)*.27,Math.sin(a)*1.9],[1.0,.32,.56],C.sun,gs[2],i);m.rotation.y=-a;
    }
    for(let i=0;i<16;i++){
      const t=i/15,a=t*Math.PI*4+.95,r=2.2+.2*Math.sin(t*6);
      const m=volume('fine_unraveling_spiral_tail',[Math.cos(a)*r,t*8-3.8,Math.sin(a)*r],[.55,.11,.18],i%2?C.mistBlue:C.mistGold,gs[3],i);m.rotation.y=-a;
    }
    breathing('open_spiral_layered_convection',gs,14,.2);
  }

  function cloudStorm() {
    const shelf=group('broad_anvil'),tower=group('sloping_storm_tower'),low=group('hanging_dark_base');
    for(let i=0;i<15;i++) {
      const t=i/14,x=(t-.5)*11.5;
      volume('immense_horizontal_anvil',[x,1.6+Math.sin(i*.4)*.2,Math.sin(i*1.4)*.48],[1.05,.45+Math.sin(t*Math.PI)*.45,.95],i%4?C.stormTop:0xaab4b9,shelf,i);
    }
    for(let i=0;i<13;i++) {
      const a=i*2.37;
      const side=i%2?1:-1;
      volume('two_towers_flanking_open_light_gap',[side*(1.4+Math.cos(a)*.48),-.12+i*.08,Math.sin(a)*.7],[.85,.9,.83],i%3?C.storm:C.stormTop,tower,i*.8);
    }
    for(let i=0;i<10;i++){
      const side=i<5?-1:1,t=(i%5)/4;
      volume('dark_lower_fringe_leaving_center_open',[side*(1.2+t*2.7),-.9+Math.sin(i)*.15,Math.sin(i*2.1)*.5],[.82,.42,.8],C.stormDeep,low,i);
    }
    volume('sunlit_edge_of_open_gap',[-.55,.12,.11],[.22,.88,.6],C.mistGold,tower,5);
    const rainGroups=[];
    for(let j=0;j<3;j++) {
      const rg=group(`rain_sheet_${j}`);rainGroups.push(rg);
      for(let i=0;i<12;i++) {
        const side=i<6?-1:1,t=(i%6)/5;
        const x=side*(1.1+t*3.15)+(j-1)*.08,z=(j-1)*.6+(random()-.5)*.18;
        const len=1.2+random()*2.0,yy=-1.25-random()*.45;
        tube('painted_diagonal_rain',[[x,yy,z],[x-.13,yy-len*.5,z+.04],[x-.27,yy-len,z+.08]],.012+random()*.009,j===1?C.rain:0x738b9f,rg);
      }
    }
    breathing('storm_slow_convection',[shelf,tower,low],16,.06);
    const ts=[0,1.5,3,4.5,6],tracks=[];
    rainGroups.forEach((g,i)=>tracks.push(vectorTrack(g,'position',ts,ts.map(t=>[Math.sin(t/6*Math.PI*2+i)*.02-Math.sin(i)*.02,Math.sin(t/6*Math.PI*2+i)*.16-Math.sin(i)*.16,0]))));
    clips.push(new THREE.AnimationClip('rain_curtain_drift',6,tracks));
  }

  // Feather is a convex, slightly keeled solid leaf with a pointed silhouette.
  // Its local Y axis points out along the quill and local Z faces the viewer.
  function feather(name,width,length,color,parent,curve=0) {
    const pts=[[-width*.28,0,0],[-width*.55,length*.28,.014],[-width*.4,length*.68,.02],
      [curve,length,0],[width*.39,length*.65,.02],[width*.5,length*.23,.014],[width*.25,0,0]];
    const v=[],idx=[];pts.forEach(a=>v.push(...a));
    v.push(curve*.3,length*.46,.055);v.push(curve*.3,length*.46,-.028);
    for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length;idx.push(7,i,j,8,j,i);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex(idx);
    return mesh(name,geo,color,parent);
  }
  function wing(style,side,parent,size=1) {
    const g=group(`${style}_articulated_${side<0?'left':'right'}_wing`,parent);
    g.position.set(side*.16,.04,-.025);g.scale.setScalar(size);
    const narrow=style==='swallow',broad=style==='raptor',round=style==='song';
    const span=narrow?1.64:broad?2.2:round?.78:1.86;
    const chord=narrow?.34:broad?.94:round?.56:.76;
    const primary=style==='swallow'?C.swallow:style==='raptor'?C.raptorTip:style==='song'?C.songWing:C.gullDark;
    const upper=style==='swallow'?C.swallowBlue:style==='raptor'?C.raptorWing:style==='song'?C.songBlue:C.gullWing;
    const shoulder=style==='swallow'?C.swallow:style==='raptor'?C.raptorGold:style==='song'?C.songGold:C.gull;
    // Primary silhouette: a broad bent shoulder, middle fan and separated tips.
    // The tip fan has its own pivot and follows the heavy shoulder with delay.
    const tip=group('independently_delayed_outer_feather_fan',g);tip.position.set(side*span*.54,-.025,0);g.tipMotion=tip;
    const panelPoints=[0,.1,0, side*span*.27,.27,.015, side*span*.58,.18,.005,
      side*span*.84,-.08,-.015, side*span*.59,-chord*.32,.02, side*span*.17,-chord*.26,.025, 0,-.11,.02];
    const panel=new THREE.BufferGeometry();panel.setAttribute('position',new THREE.Float32BufferAttribute(panelPoints,3));panel.setIndex([0,1,5,1,2,5,2,4,5,2,3,4,0,5,6]);
    mesh('large_bowed_feathered_shoulder',panel,upper,g);
    tube('arched_soft_leading_edge',[[0,.11,.05],[side*span*.28,.25,.04],[side*span*.59,.16,.025],[side*span*.8,-.015,0]],chord*.09,shoulder,g);
    // Separate long finger feathers overlap along the swept outer wing.
    const count=round?7:10;
    for(let i=0;i<count;i++) {
      const t=i/(count-1),x=.1+t*span*.82,y=-.025-t*.16;
      const f=feather('large_separated_primary_feather',chord*(broad?.37:.32),chord*(.86+Math.sin(t*Math.PI)*.71)+t*(narrow?.66:.28),i%3===0?upper:primary,tip,side*.055);
      f.position.set(side*(x-span*.54),y+.025,.008);f.rotation.z=side*(-1.06+t*(narrow?-.72:.5));
      f.rotation.x=-.1+t*.14;
    }
    for(let i=0;i<(round?6:9);i++) {
      const t=i/(round?5:8);
      const f=feather('middle_layer_overlapping_secondary',chord*.43,chord*(.78+t*.12),i%3===0?shoulder:upper,g);
      f.position.set(side*(.045+t*span*.69),.08,.065);f.rotation.z=side*(-.85-t*.27);
    }
    for(let i=0;i<(round?4:7);i++) {
      const t=i/(round?3:6),f=feather('small_upper_shoulder_covert',chord*.36,chord*.55,shoulder,g);
      f.position.set(side*(.03+t*span*.51),.17,.1);f.rotation.z=side*-1.05;
    }
    // A rounded leading edge bridges the separate quills without hiding them.
    volume('plush_wing_shoulder_mass',[side*span*.21,.1,.02],[span*.3,chord*.27,.13],shoulder,g,side,10);
    return g;
  }
  function beak(parent,length,width,color=C.beak,hooked=false) {
    const v=[-width,0,.12,width,0,.12,0,width*.75,.12,0,-width*.55,.12,0,hooked?-width*.34:0,.12+length];
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex([0,2,4,2,1,4,1,3,4,3,0,4,0,3,2,2,3,1]);
    return mesh('warm_tapered_beak',geo,color,parent);
  }
  function feet(parent,bodyY,spread=.1,color=C.beak) {
    for(const s of [-1,1]) {
      const x=s*spread;
      tube('slender_bird_leg',[[x,bodyY,0],[x,bodyY-.18,.02]],.018,color,parent);
      for(let j=0;j<3;j++)tube('curved_gripping_toe',[[x,bodyY-.17,.02],[x+(j-1)*.052,bodyY-.2,.1],[x+(j-1)*.07,bodyY-.21,.13]],.013,color,parent);
    }
  }
  function bird(style,parent,pos=[0,0,0],size=1,yaw=0,index=0) {
    const g=at(group(`${style}_bird_${index}`,parent),pos);g.scale.setScalar(size);g.rotation.y=yaw;
    const rap=style==='raptor',sw=style==='swallow',song=style==='song';
    const colors=rap?[C.raptor,C.raptorGold,C.raptorTip]:sw?[C.swallow,C.swallowCream,C.swallowCoral]:song?[C.songBlue,C.songGold,C.songWing]:[C.gull,C.gull,C.gullDark];
    const body=group('plump_body',g);
    volume('volume_painted_body',[0,0,0],[song?.31:rap?.35:sw?.22:.29,song?.35:rap?.55:sw?.32:.43,song?.27:rap?.31:.27],colors[0],body,.3,14);
    volume('contrasting_rounded_breast',[0,-.045,.16],[song?.25:rap?.29:sw?.17:.24,song?.29:rap?.38:sw?.25:.34,.13],colors[1],body,.7,12);
    for(let i=0;i<5;i++){
      const f=feather('long_scalloped_mantle_feather',rap?.17:.12,rap?.32:song?.19:.24,i%2?colors[0]:colors[1],body);
      f.position.set((i-2)*.075,.17-Math.abs(i-2)*.035,.21);f.rotation.z=Math.PI+(i-2)*.12;
    }
    // Individual chest markings suggest hand painted feather scales.
    for(let row=0;row<3;row++)for(let i=0;i<3;i++) {
      const x=(i-1)*.085,y=.04-row*.075;
      const f=feather('breast_scalloped_mark',.062,.09,rap?(row%2?C.raptor:C.raptorGold):song?0xf0c58b:sw?0xd7ceae:0xe5dfca,body);
      f.position.set(x,y,.236-Math.abs(x)*.15);f.rotation.z=Math.PI;
    }
    const head=group('head',g);head.position.set(0,song?.34:rap?.5:sw?.3:.45,rap?.06:.13);
    volume('rounded_head',[0,0,0],[song?.205:rap?.21:.17,song?.2:rap?.205:.18,song?.18:rap?.18:.165],rap?C.raptorGold:sw?C.swallow:song?C.songBlue:C.gull,head,.5,14);
    if(sw)volume('coral_throat',[0,-.075,.12],[.11,.09,.04],C.swallowCoral,head,.3,10);
    if(song||!sw&&!rap)for(const s of [-1,1]){
      volume('storybook_plush_cheek',[s*.13,-.055,.075],[song?.11:.085,.1,.07],song?0xe7b56f:C.cream,head,s,10);
      for(let i=0;i<3;i++){const f=feather('swept_cheek_plume',.045,.14+i*.025,song?C.songGold:C.gull,head,s*.025);f.position.set(s*.13,-.02-i*.028,.04);f.rotation.z=s*1.3;}
    }
    for(const s of [-1,1]) {
      volume('cream_eye_ring',[s*.131,.035,.107],[.062,.065,.024],rap?0xe8cb83:song?0xf4d59b:C.cream,head,.1,10);
      volume('dark_lively_eye',[s*.142,.038,.127],[.035,.04,.018],p.ink,head,.7,10);
      volume('painted_eye_glint',[s*.15,.051,.142],[.01,.012,.007],p.ivory,head,.3,8);
      if(rap){const brow=bevelBox('stern_golden_brow',[.125,.032,.05],[s*.12,.095,.135],C.raptorWing,head);brow.rotation.z=s*.17;}
    }
    beak(head,rap?.17:sw?.085:song?.11:.22,rap?.07:sw?.055:song?.065:.06,rap?C.raptorGold:C.beak,rap);
    if(rap) {
      const tip=feather('hooked_beak_tip',.053,.085,C.raptorTip,head);tip.position.set(0,-.01,.275);tip.rotation.x=Math.PI*.7;
      for(let i=0;i<3;i++){const f=feather('head_crest_feather',.07,.14,C.raptor,head);f.position.set((i-1)*.06,.14,-.045);f.rotation.x=-.4;}
    }
    const left=wing(style,-1,g),right=wing(style,1,g);
    // Fan tail is a separate group so the long split swallow tail can follow the wing beat.
    const tail=group('layered_tail_fan',g);tail.position.set(0,-.2,-.16);tail.rotation.x=-.52;
    const tc=sw?4:song?5:7;
    for(let i=0;i<tc;i++) {
      const t=i/(tc-1)-.5,split=sw?Math.pow(Math.abs(t)*2,2)*.94:.08;
      const f=feather('separate_tail_feather',sw?.105:song?.13:rap?.2:.15,sw?.42+split:song?.38:rap?.78:.57,i%2?colors[0]:colors[2],tail,t*.14);
      f.rotation.z=Math.PI+t*(sw?.65:rap?.72:1.1);f.position.x=t*.16;
    }
    feet(g,song?-.26:rap?-.39:-.28,rap?.115:song?.085:.08,rap?C.raptorGold:C.beak);
    return {g,head,left,right,tail,style};
  }
  function birdClip(name,birds,duration=2.8,depth=.58) {
    const knots=[0,.12,.25,.37,.49,.61,.76,.9,1],ts=knots.map(t=>t*duration),tracks=[];
    const rhythms={gull:[-.12,-.32,.9,.42,-.8,-.2,.04,.04,-.12],
      raptor:[0,-.16,.55,.85,-.55,-.08,0,0,0],
      swallow:[0,.95,-.9,.65,-.85,.55,-.68,.35,0],
      song:[0,-.22,.95,-.85,.7,-.55,0,0,0]};
    function sample(values,t){t=((t%1)+1)%1;let j=0;while(j<knots.length-2&&t>knots[j+1])j++;return THREE.MathUtils.lerp(values[j],values[j+1],(t-knots[j])/(knots[j+1]-knots[j]));}
    birds.forEach((b,i)=>{
      const phase=i*.16,profile=rhythms[b.style];
      for(const [wingg,side] of [[b.left,-1],[b.right,1]]) {
        tracks.push(quatTrack(wingg,ts,knots.map(t=>[.1*sample(profile,t+phase),.035*side*sample(profile,t+phase-.04),side*(.07+sample(profile,t+phase)*depth)])));
        tracks.push(quatTrack(wingg.tipMotion,ts,knots.map(t=>[.09*sample(profile,t+phase-.1),.025*side,side*sample(profile,t+phase-.085)*depth*.43])));
      }
      const base=b.g.position.clone();
      tracks.push(vectorTrack(b.g,'position',ts,knots.map(t=>[base.x,base.y+.075*(sample(profile,t+phase-.11)-sample(profile,phase-.11)),base.z])));
      tracks.push(quatTrack(b.tail,ts,knots.map(t=>[-.52+.22*sample(profile,t+phase-.15),0,.07*sample(profile,t+phase-.08)])));
      tracks.push(quatTrack(b.head,ts,knots.map(t=>[.045*sample(profile,t+phase-.05),.1*(sample(profile,t+phase)-sample(profile,phase)),.04*sample(profile,t+phase)])));
    });
    clips.push(new THREE.AnimationClip(name,duration,tracks));
  }
  function twigNest(parent,pos,scale=.6) {
    const g=at(group('woven_twig_nest',parent),pos);g.scale.setScalar(scale);
    for(let layer=0;layer<2;layer++)for(let i=0;i<12;i++) {
      const a=i/12*Math.PI*2,r=.48-layer*.04;
      tube('individual_interlaced_twig',[[Math.cos(a-.3)*r,layer*.08,Math.sin(a-.3)*r],[Math.cos(a)*r,.07+layer*.08,Math.sin(a)*r],[Math.cos(a+.3)*r,layer*.08,Math.sin(a+.3)*r]],.023,i%3?p.woodDark:p.woodLight,g);
    }
    volume('warm_nest_center',[0,.015,0],[.38,.075,.32],p.earth,g,1,10);
    for(let i=0;i<3;i++)volume('cream_speckled_egg',[(i-1)*.12,.12,(i%2)*.08],[.065,.09,.065],i%2?p.cream:0xd5dfc4,g,i,10);
  }
  function leaf(name,pos,scale,color,parent,rz=0) {
    const f=feather(name,.2*scale,.38*scale,color,parent,.055*scale);f.position.set(...pos);f.rotation.z=rz;f.rotation.x=.4;return f;
  }
  function flowers(parent,pos,scale=.5) {
    const g=at(group('five_petalled_cliff_flower',parent),pos);g.scale.setScalar(scale);
    for(let i=0;i<5;i++) {
      const a=i/5*Math.PI*2;
      volume('rounded_coral_petal',[Math.cos(a)*.11,Math.sin(a)*.11,0],[.09,.12,.024],i%2?p.flower:0xe3af8b,g,i,8);
    }
    volume('pollen_golden_center',[0,0,.035],[.06,.06,.025],p.amber,g,1,8);
  }
  function harborGull() {
    const dock=group('handmade_mooring_perch');
    cylinder('weathered_mooring_post',.2,.24,1.15,[0,-.95,0],p.wood,dock,12);
    cylinder('teal_painted_post_cap',.25,.25,.12,[0,-.34,0],p.teal,dock,12);
    cylinder('brass_cap_edge',.257,.257,.035,[0,-.27,0],p.brass,dock,14);
    for(let i=0;i<4;i++){const a=i/4*Math.PI*2;tube('deep_post_wood_grain',[[Math.cos(a)*.206,-1.42,Math.sin(a)*.206],[Math.cos(a+.08)*.215,-.95,Math.sin(a+.08)*.215],[Math.cos(a)*.208,-.5,Math.sin(a)*.208]],.009,p.woodDark,dock);}
    for(let i=0;i<3;i++) {
      const pts=[];for(let j=0;j<=16;j++){const a=j/16*Math.PI*2;pts.push([Math.cos(a)*.235,-.54+i*.044,Math.sin(a)*.235]);}rope('thick_coiled_mooring_rope',pts,dock);
    }
    rope('hanging_rope_tail',[[.23,-.5,0],[.42,-.73,.06],[.42,-1.15,.03],[.33,-1.35,.01]],dock);
    const penn=group('coral_harbor_tie',dock);penn.position.set(-.17,-.65,0);
    const f=feather('frayed_coral_pennant',.23,.58,p.coral,penn,.1);f.rotation.z=2.85;f.rotation.x=.35;
    const bird1=bird('gull',root,[0,.25,0],1,0);
    birdClip('harbor_gull_anticipation_sweep_and_glide',[bird1],4.6,.74);
  }
  function windSwallows() {
    const b1=bird('swallow',root,[-.1,.45,.32],.9,.14,0);
    const b2=bird('swallow',root,[-1.35,-.22,-.35],.64,-.15,1);
    const b3=bird('swallow',root,[1.18,-.05,-.65],.57,.25,2);
    // A few scattered petals give the moving flock a wind direction without a solid platform.
    for(let i=0;i<8;i++) {
      const f=feather('loose_windborne_petal',.055,.12,i%2?p.flower:p.cream,root,.025);
      f.position.set((random()-.5)*3.1,-.6+random()*.5,(random()-.5)*1.2);f.rotation.set(random()*1.5,random()*2,random()*3);
    }
    birdClip('swallow_trio_rapid_split_tail_wingbeats',[b1,b2,b3],1.45,.96);
  }
  function ridgeRaptor() {
    const perch=group('wild_ridge_perch');
    const g=new THREE.CylinderGeometry(.57,.81,1.25,7,2);const a=g.attributes.position;
    for(let i=0;i<a.count;i++){const y=a.getY(i);a.setX(i,a.getX(i)+Math.sin(y*3.7)*.1);a.setZ(i,a.getZ(i)+Math.cos(y*4.5)*.06);}g.computeVertexNormals();
    at(mesh('leaning_layered_stone',g,p.stone,perch),[0,-1.1,0]);
    for(let i=0;i<5;i++){const ang=i/5*Math.PI*2;volume('soft_lichen_shelf',[Math.cos(ang)*.42,-.53,Math.sin(ang)*.37],[.26,.055,.23],i%2?p.sage:p.moss,perch,i,10);}
    tube('old_crooked_sentry_branch',[[-.4,-.65,0],[-.2,-.35,0],[.35,-.28,-.08],[.65,-.04,-.1]],.065,p.woodDark,perch);
    twigNest(perch,[-.21,-.4,-.12],.7);
    leaf('ridge_leaf',[-.38,-.49,.3],.9,p.sage,perch,.8);leaf('ridge_leaf',[.31,-.51,.24],.7,p.leaf,perch,-.5);
    const b=bird('raptor',root,[.02,.35,0],1.08,0);
    birdClip('ridge_raptor_heavy_stroke_and_long_glide',[b],5.5,.64);
  }
  function cliffSongbirds() {
    const branch=group('blossom_branch_and_nest');
    tube('crooked_main_bough',[[-1.28,-.65,.04],[-.75,-.4,0],[-.2,-.33,.03],[.5,-.26,-.04],[1.18,-.05,0]],.092,p.woodDark,branch);
    tube('warm_branch_top_glint',[[-1.2,-.59,.08],[-.72,-.34,.06],[-.15,-.27,.08],[.45,-.2,.015],[1.1,.005,.055]],.016,p.woodLight,branch);
    for(let i=0;i<5;i++) {
      const x=-1+i*.5,y=-.42+i*.07,s=i%2?1:-1;
      tube('forked_flower_twig',[[x,y,0],[x+s*.14,y+.18,-.05],[x+s*.29,y+.26,-.09]],.025,p.wood,branch);
      leaf('broad_sage_leaf',[x+s*.12,y+.15,-.04],.65,i%2?p.sage:p.leaf,branch,-s*.7);
      flowers(branch,[x+s*.27,y+.29,-.065],.55);
    }
    twigNest(branch,[.16,-.33,.04],.65);
    for(let i=0;i<5;i++)volume('clinging_moss_cushion',[-.95+i*.47,-.41+i*.07,.025],[.14,.07,.13],i%2?p.sage:p.moss,branch,i,8);
    const b1=bird('song',root,[-.65,.06,.11],.82,-.21,0),b2=bird('song',root,[.72,.24,.04],.69,.25,1);
    birdClip('cliff_songbirds_double_flutter_and_rest',[b1,b2],2.9,.91);
  }
  const factories={'sunlit-cloud':cloudSun,'mist-ribbons':cloudMist,'rising-cloud':cloudRising,'storm-front':cloudStorm,
    'harbor-gull':harborGull,'wind-swallows':windSwallows,'ridge-raptor':ridgeRaptor,'cliff-songbirds':cliffSongbirds};
  if(!factories[spec.id])throw new Error(`Unknown atmospheric sky asset: ${spec.id}`);
  factories[spec.id]();
  root.userData.implementation='Handmade vertex-painted 3D geometry with actual animated internal transforms; no collisions or gameplay.';
  root.userData.motion=spec.motion_ko;
  root.userData.artDirection='Soft hand-painted volume, layered warm color and exaggerated distinct silhouettes; original Cloudstitch design.';
  root.userData.expressionRevision='2026-10-18: over tenfold bolder perceived expression target. Giant primary silhouettes, medium overlapping layers, small painted details and anticipation/stroke/glide/delayed-tip rhythm; no gameplay change.';
  return {clips};
}
