import { THREE, group, mesh, box, cyl, sphere, tube, beam, ring, panel, balloon, cloth, engine, cannon, lantern, control } from './kit.js';

// Reference-driven, independent art LU. -X bow / +Y up. No old asset writes.
// Both source ships have only null module counts; counts here are visual proposals.
const atName = (id, suffix) => `${id}-${suffix}`;
const material = (source, color, name) => { const m = source.clone(); m.color.set(color); m.name = name; return m; };

function skiffHull(parent, m, id) {
  const root = group(parent, atName(id, 'sharp-timber-hull'));
  root.userData = { moduleId: root.name, moduleType: 'hull', referenceRole: 'needle timber skiff' };
  const stations = [[-5.5,.055,.52],[-4.5,.48,.23],[-2.9,.94,.04],[-.5,1.25,0],[1.8,1.12,.08],[3.4,.73,.22],[4.05,.38,.45]];
  const rows = 10, positions = [], uv = [], indices = [];
  const point = (s,j) => {
    const a=2*Math.PI*j/rows, top=Math.sin(a)>0;
    return [s[0],s[2]+(top?.045:-1.25)*Math.abs(Math.sin(a)),Math.cos(a)*s[1]];
  };
  for(let i=0;i<stations.length;i++)for(let j=0;j<=rows;j++) { positions.push(...point(stations[i],j%rows));uv.push(i/(stations.length-1),j/rows); }
  for(let i=0;i<stations.length-1;i++)for(let j=0;j<rows;j++) {const a=i*(rows+1)+j,b=a+rows+1;indices.push(a,b,b+1,a,b+1,a+1);}
  for(const [s,reverse]of [[0,true],[stations.length-1,false]]){
    const center=positions.length/3;positions.push(stations[s][0],stations[s][2]-.5,0);uv.push(.5,.5);
    for(let j=0;j<rows;j++){const a=s*(rows+1)+j;indices.push(center,reverse?a+1:a,reverse?a:a+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  mesh(root,geometry,m.wood,atName(id,'closed-curved-timber-shell'));
  for(const side of [-1,1]) {
    for(let j=0;j<4;j++) {
      const v=j/4,points=stations.map(s=>[s[0],s[2]-v*1.1,side*s[1]*Math.sqrt(1-v*v)*1.01]);
      tube(root,j===0?m.brass:m.darkWood,atName(id,`timber-strake-${side}-${j}`),points,j===0?.055:.025,28);
    }
    for(let i=1;i<stations.length-1;i++) {
      const [x,w,y]=stations[i];beam(root,m.brass,atName(id,`hull-rib-${side}-${i}`),[x,y-.05,side*w*1.012],[x+.12,y-1.05,side*w*.58],.036);
      for(let row=0;row<3;row++)sphere(root,m.brass,atName(id,`hull-rivet-${side}-${i}-${row}`),[x,y-.12-row*.3,side*w*(1-row*.07)],[.045,.045,.035],8);
    }
  }
  for(let i=0;i<14;i++) {
    const x=-4.7+i*.61,near=stations.reduce((a,b)=>Math.abs(a[0]-x)<Math.abs(b[0]-x)?a:b);
    box(root,i%3?m.wood:m.darkWood,atName(id,'deck-plank-'+i),[x,near[2]+.05,0],[.58,.055,near[1]*1.88]);
  }
  tube(root,m.darkWood,atName(id,'long-sharp-keel'),stations.map(s=>[s[0],s[2]-1.28,0]),.075,28);
  return root;
}

function extrudedFin(parent,m,id,points,z,depth=.08) {
  const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});
  return mesh(parent,g,m,id,[0,0,z-depth/2]);
}

function scoutFlag(parent,m,id) {
  const mast=group(parent,atName(id,'pirate-flag-mast'),[2.75,.35,-.26]);
  cyl(mast,m.darkWood,atName(id,'tall-flag-pole'),[0,3.65,0],.065,7.3,'y',10);
  sphere(mast,m.brass,atName(id,'flag-pole-finial'),[0,7.42,0],[.12,.17,.12],10);
  cloth(mast,m.red,atName(id,'red-skull-flag'),{at:[1.03,7.14,0],width:2.05,height:1.27,ragged:true,billow:.12});
  // Small opaque cut-paper emblem, intentionally visible from both sides.
  for(const side of [-1,1]) {
    const z=side*.13;
    const badge=group(mast,atName(id,'skull-emblem-'+side),[.82,6.5,z]);
    sphere(badge,m.ivory,atName(id,'skull-top-'+side),[0,.12,0],[.27,.28,.025],14);
    box(badge,m.ivory,atName(id,'skull-jaw-'+side),[0,-.14,0],[.33,.19,.05]);
    for(const s of [-1,1])sphere(badge,m.dark,atName(id,`skull-eye-${side}-${s}`),[s*.115,.135,side*.032],[.07,.08,.014],10);
    extrudedFin(badge,m.dark,atName(id,'skull-nose-'+side),[[-.045,.02],[.045,.02],[0,-.075]],side*.035,.012);
    for(const sign of [-1,1]) {
      const a=[-.38,-.34*sign,0],b=[.38,.34*sign,0];
      beam(badge,m.ivory,atName(id,`crossbone-${side}-${sign}`),a,b,.036);
      for(const [k,p]of [a,b].entries())sphere(badge,m.ivory,atName(id,`crossbone-tip-${side}-${sign}-${k}`),p,[.065,.065,.035],8);
    }
  }
  return mast;
}

export function buildPirateScout(ctx) {
  const {id,motion,m,controls}=ctx;
  const timber=skiffHull(motion,m,id);
  const ochre=material(m.canvas,0xd3b070,atName(id,'ochre-handpainted-canvas'));
  const scoutM={...m,canvas:ochre};
  const bag=balloon(motion,scoutM,atName(id,'ochre-scout-envelope'),{length:8.2,radius:1.5,flatten:1.05,at:[-.55,4.35,0],material:'canvas',net:true},controls);
  bag.userData={...bag.userData,moduleId:bag.name,moduleType:'balloon'};
  // A few long diagonal rope strands distinguish hand-tied netting from bands.
  for(const side of [-1,1])for(const x of [-2.9,-.3,2.2]) {
    tube(motion,m.rope,atName(id,`hanging-rig-${side}-${x}`),[[x-.2,3.75,side*1.18],[x+.1,2.15,side*1.1],[x+.3,.36,side*.9]],.035,12);
    tube(motion,m.rope,atName(id,`cross-tie-${side}-${x}`),[[x-.7,4.95,side*1.1],[x,4.4,side*1.5],[x+.6,3.65,side*1.03]],.024,16);
  }
  const ram=group(motion,atName(id,'red-lance-bow'),[-5.05,.04,0]);
  const ramShape=new THREE.ConeGeometry(.32,2.55,6);ramShape.rotateZ(Math.PI/2);
  mesh(ram,ramShape,m.red,atName(id,'red-spearhead'),[-.85,0,0]);
  cyl(ram,m.brass,atName(id,'ram-brass-ferrule'),[.18,0,0],.35,.36,'x',12);
  ring(ram,m.dark,atName(id,'ram-iron-collar'),[.38,0,0],.31,.045,'x');
  for(const side of [-1,1]) {
    extrudedFin(motion,m.red,atName(id,'red-underfin-front-'+side),[[-3.7,-.7],[-2.8,-1],[-3.2,-2.05],[-4.15,-1.4]],side*.75,.1);
    extrudedFin(motion,m.brass,atName(id,'brass-underfin-rear-'+side),[[1.1,-.8],[2,-1],[1.55,-2],[.7,-1.45]],side*.75,.08);
    for(const x of [-3.8,-2.4,-.9,.6])beam(motion,m.darkWood,atName(id,`light-rail-${side}-${x}`),[x,.35,side*1.1],[x,.82,side*1.13],.033);
    tube(motion,m.rope,atName(id,'open-deck-rail-'+side),[[-4.2,.78,side*.6],[-2.7,.82,side*1.11],[.7,.83,side*1.12],[2.5,.95,side*.8]],.028,20);
  }
  // Open bridge: wheel + low windshield only, no enclosed house or roof.
  const helm=group(motion,atName(id,'low-open-bridge'),[2.1,.27,0]);
  box(helm,m.darkWood,atName(id,'helm-plinth'),[0,.23,0],[.55,.46,.7]);
  ring(helm,m.brass,atName(id,'open-steering-wheel'),[-.24,.79,0],.28,.04,'x');
  for(let i=0;i<6;i++){const a=i*Math.PI/3;beam(helm,m.brass,atName(id,'wheel-spoke-'+i),[-.24,.79,0],[-.24,.79+Math.sin(a)*.28,Math.cos(a)*.28],.022);}
  box(helm,m.glass,atName(id,'tiny-helm-windscreen'),[-.65,.69,0],[.045,.37,.9],[0,0,.16]);
  const engineM={...m,teal:m.brass,metal:m.brass};
  const rear=engine(motion,engineM,atName(id,'exposed-brass-stern-engine'),{at:[4.05,-.05,0],scale:1.12},controls);
  rear.userData={...rear.userData,moduleId:rear.name,moduleType:'engine',weakpoint:true};
  ring(motion,m.dark,atName(id,'large-engine-outer-rim'),[4.4,.04,0],1.08,.13,'x');
  ring(motion,m.brass,atName(id,'engine-engraved-bezel'),[4.45,.04,0],.92,.045,'x');
  for(let i=0;i<8;i++){const a=i*Math.PI/4;sphere(motion,m.brass,atName(id,'stern-rim-bolt-'+i),[4.48,Math.sin(a)*1.02+.04,Math.cos(a)*1.02],[.06,.06,.06],8);}
  const gun=cannon(motion,m,atName(id,'forward-light-machinegun'),{at:[-1.85,.43,0],scale:.84,kind:'machinegun'},controls);
  gun.userData={...gun.userData,moduleId:gun.name,moduleType:'machinegun'};
  scoutFlag(motion,m,id);
  lantern(motion,m,atName(id,'skiff-bow-lantern'),[-4.2,-.05,-.38],.22);
  return {
    artModules:{balloons:1,engines:1,machineGuns:1},
    weakpoints:[{id:'rear-engine',nodeName:rear.name,label:'노출 후방 엔진',kind:'engine'}],
    features:['황토 타원 기낭과 밧줄망','뾰족한 목재 스키프·붉은 충각','아래로 뻗은 붉은/황동 지느러미','큰 황동 후방 엔진','붉은 해골 깃발','지붕 없는 낮은 개방 조타대','전방 경량 기관총'],
    referenceNotes:'첨부 시트1의 실루엣과 재료를 새3D로 해석. 선수 -X·위 +Y·임시LU. 원문09/25/65의 기관총·엔진 역할만 확정이며 개수는 전부 미정이므로 표시 수는 artModules 제안이다.',
  };
}

function darkCliffHull(parent,m,id) {
  const root=group(parent,atName(id,'black-plated-cliff-hull'));
  root.userData={moduleId:root.name,moduleType:'hull',referenceRole:'armored blockade cliff'};
  const outline=[[-5.6,-1.8],[-4.7,-2.55],[3.7,-2.55],[5,-1.8],[5,1.8],[3.7,2.55],[-4.7,2.55],[-5.6,1.8]];
  const shape=new THREE.Shape();outline.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:3.25,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:1});g.rotateX(Math.PI/2);
  mesh(root,g,m.dark,atName(id,'coffin-shaped-closed-armor-core'),[0,1.05,0]);
  for(const side of [-1,1]) {
    for(let row=0;row<3;row++)for(let col=0;col<7;col++) {
      const x=-4.2+col*1.38,y=.59-row*1.02;
      // Core bevel reaches |Z|=2.67. Plate and rivet faces sit outside it.
      // panel() places rivets on local +Z, so flip the port-side panel frame.
      panel(root,(row+col)%3?m.metal:m.dark,atName(id,`side-armor-${side}-${row}-${col}`),[x,y,side*2.77],[1.32,.94,.11],[0,side<0?Math.PI:0,0],m.brass);
    }
    beam(root,m.brass,atName(id,'side-horizontal-gold-rail-'+side),[-4.8,1.13,side*2.86],[4.3,1.13,side*2.86],.065);
    for(const x of [-4.6,-2.4,0,2.4,4.4])beam(root,m.dark,atName(id,`external-buttress-${side}-${x}`),[x,-2.05,side*2.83],[x,2.2,side*2.92],.09);
  }
  // Broad front wall is the primary read; it is not a pointed wooden prow.
  for(let z=0;z<3;z++)for(let row=0;row<4;row++) {
    // The front face is -X. Rotate its local rivet face towards that exterior.
    panel(root,row%2?m.dark:m.metal,atName(id,`vertical-bow-wall-${row}-${z}`),[-5.82,-1.64+row*1.05,(z-1)*1.33],[1.25,.98,.14],[0,-Math.PI/2,0],m.brass);
  }
  for(const y of [-2.15,-1.11,-.06,.99,2.03])beam(root,m.brass,atName(id,'exposed-bow-gold-seam-'+y),[-5.94,y,-1.98],[-5.94,y,1.98],.035);
  for(const z of [-1.98,1.98])beam(root,m.dark,atName(id,'outer-bow-wall-buttress-'+z),[-5.97,-2.2,z],[-5.97,2.14,z],.08);
  box(root,m.dark,atName(id,'low-flat-top-deck'),[-.3,1.12,0],[9.7,.18,4.9]);
  for(let i=0;i<9;i++)box(root,m.brass,atName(id,'deck-armor-seam-'+i),[-4.6+i*1.1,1.225,0],[.028,.018,4.7]);
  tube(root,m.dark,atName(id,'coffin-deep-keel'),[[-5.3,-1.8,0],[-3,-2.6,0],[2.9,-2.5,0],[4.8,-1.8,0]],.16,18);
  return root;
}

function verticalSealTank(parent,m,id,index,at,height) {
  const root=group(parent,atName(id,'vertical-seal-tank-'+index),at);
  root.userData={moduleId:root.name,moduleType:'structure',structuralRole:'sealedPressureTank'};
  cyl(root,m.dark,atName(id,'tank-body-'+index),[0,height/2,0],.68,height,'y',18,.63);
  sphere(root,m.metal,atName(id,'tank-rounded-cap-'+index),[0,height,0],[.65,.22,.65],16);
  cyl(root,m.dark,atName(id,'tank-foot-'+index),[0,.09,0],.77,.18,'y',18);
  for(const ratio of [.12,.41,.7,.96]) {
    ring(root,m.brass,atName(id,`tank-band-${index}-${ratio}`),[0,height*ratio,0],.69,.045,'y');
    for(let i=0;i<6;i++){const a=i*Math.PI/3;sphere(root,m.brass,atName(id,`tank-band-rivet-${index}-${ratio}-${i}`),[Math.cos(a)*.71,height*ratio,Math.sin(a)*.71],[.045,.045,.045],8);}
  }
  for(const side of [-1,1])beam(root,m.metal,atName(id,`tank-edge-${index}-${side}`),[side*.39,.2,-.58],[side*.39,height-.15,-.58],.027);
  // Small cream notches read as restrained seal marks rather than UI text.
  for(let i=0;i<2;i++)box(root,m.ivory,atName(id,'tank-seal-mark-'+index+'-'+i),[0,height*(.58+i*.08),-.691],[.11,.12,.013],[0,0,i?.45:-.45]);
  return root;
}

function exposedBell(parent,m,id,controls) {
  const support=group(parent,atName(id,'open-central-bell-support'),[-3.05,1.35,0]);
  for(const side of [-1,1])beam(support,m.dark,atName(id,'bell-post-'+side),[0,0,side*.76],[0,4.6,side*.76],.09);
  beam(support,m.brass,atName(id,'bell-top-yoke'),[0,4.65,-.87],[0,4.65,.87],.095);
  sphere(support,m.brass,atName(id,'bell-yoke-knob'),[0,4.9,0],[.12,.17,.12],10);
  const pivot=group(support,atName(id,'exposed-hanging-bell'),[-.32,3.8,0]);
  pivot.scale.setScalar(1.2);
  beam(support,m.brass,atName(id,'forward-bell-hanger'),[0,4.62,0],[-.32,4.46,0],.055);
  const p=[[.07,.55],[.19,.5],[.24,.37],[.27,.08],[.34,-.2],[.5,-.48],[.58,-.54],[.59,-.64],[.49,-.67],[.43,-.55],[.31,-.27],[.22,.02],[.18,.35],[.1,.41]];
  const g=new THREE.LatheGeometry(p.map(([r,y])=>new THREE.Vector2(r,y)),28);
  mesh(pivot,g,m.brass,atName(id,'open-bottom-bell-shell'));
  ring(pivot,m.brass,atName(id,'bell-lip'),[0,-.6,0],.58,.04,'y');
  cyl(pivot,m.dark,atName(id,'bell-clapper-stem'),[0,-.13,0],.026,.89,'y',8);
  sphere(pivot,m.dark,atName(id,'bell-clapper-head'),[0,-.61,0],[.1,.14,.1],12);
  control(controls,pivot,'bell','z',.08);
  return support;
}

export function buildCultBlockade(ctx) {
  const {id,motion,m,controls}=ctx;
  const hull=darkCliffHull(motion,m,id);
  const tanks=[[-2.5,1.25,-1.65,4.2],[-.2,1.25,-1.7,5.1],[2.2,1.25,1.65,4.75],[3.6,1.25,-1.7,3.6]];
  tanks.forEach(([x,y,z,h],i)=>verticalSealTank(motion,m,id,i+1,[x,y,z],h));
  const bell=exposedBell(motion,m,id,controls);
  // Two side veils leave the negative-X central bell corridor open.
  for(const side of [-1,1]) {
    const at=[.55,6.05,side*1.25];
    cloth(motion,m.ivory,atName(id,'ivory-seal-shroud-'+side),{at,width:5.6,height:4.3,ragged:true,billow:.18});
    beam(motion,m.brass,atName(id,'shroud-top-rail-'+side),[-2.5,6.11,side*1.25],[3.55,6.11,side*1.25],.055);
    for(const x of [-1.9,2.9])tube(motion,m.rope,atName(id,`shroud-suspension-${side}-${x}`),[[x,6.1,side*1.25],[x+.2,6.55,side*1.75],[x+.5,6.25,side*1.7]],.032,10);
    // Black central ribbon and tapering lower seal tail; no faux readable text.
    cloth(motion,m.dark,atName(id,'seal-dark-vertical-ribbon-'+side),{at:[.65,5.5,side*1.31],width:.15,height:2.7,ragged:false,billow:.02});
    extrudedFin(motion,m.dark,atName(id,'seal-mark-chevron-'+side),[[.27,4.45],[.65,4.1],[1.03,4.45],[.65,3.75]],side*1.32,.018);
  }
  // Keep envelope small and behind the tall tanks; tank tops dominate skyline.
  const lowCanvas=material(m.canvas,0xb4a88c,atName(id,'hidden-lift-canvas'));
  const bag=balloon(motion,{...m,canvas:lowCanvas},atName(id,'small-rear-lift-bag'),{at:[3.1,.08,0],length:3.5,radius:.8,flatten:.8,material:'canvas',net:true},controls);
  bag.userData={...bag.userData,moduleId:bag.name,moduleType:'balloon',referenceRole:'partly hidden rear lift'};
  const rear=engine(motion,m,atName(id,'small-exposed-rear-engine'),{at:[5.1,-.37,0],scale:.55},controls);
  rear.userData={...rear.userData,moduleId:rear.name,moduleType:'engine',weakpoint:true};
  const guns=[];
  for(let i=0;i<3;i++) {
    const mount=group(motion,atName(id,'side-cannon-platform-'+i),[-2.8+i*2.65,1.33,-2.8]);
    box(mount,m.dark,atName(id,'gun-casemate-'+i),[0,-.05,0],[1.58,.45,.84]);
    const gun=cannon(mount,m,atName(id,'side-cannon-'+(i+1)),{at:[0,.14,-.1],scale:.82,rotation:[0,-Math.PI/2,0],kind:'cannon'},controls);
    gun.userData={...gun.userData,moduleId:gun.name,moduleType:'cannon'};guns.push(gun);
    for(const side of [-1,1])sphere(mount,m.brass,atName(id,`gun-platform-bolt-${i}-${side}`),[side*.61,.19,.25],[.055,.055,.055],8);
  }
  const smoke=group(motion,atName(id,'small-rear-smoke-stack'),[4.15,1.24,.9]);
  cyl(smoke,m.dark,atName(id,'smoke-pipe'),[0,.75,0],.19,1.5,'y',12);
  ring(smoke,m.brass,atName(id,'smoke-mouth-rim'),[0,1.5,0],.2,.035,'y');
  lantern(motion,m,atName(id,'stern-cult-lantern'),[4.62,1.4,-1.9],.23);
  return {
    artModules:{balloons:1,engines:1,cannons:3,armor:12,smokeEmitters:1,bell:1,tank:4},
    weakpoints:[{id:'rear-engine',nodeName:rear.name,label:'후방 추진부',kind:'engine'},{id:'bell-support',nodeName:bell.name,label:'노출 종 지지대',kind:'structure'}],
    features:['검은 격자 판금의 넓은 절벽 선수','서로 높이가 다른 수직 봉인통4개','두 장의 흰 봉인 장막','중앙 열린 통로의 좁은 황동 종','후방에 낮게 숨은 작은 기낭','작은 노출 후방 엔진','한쪽 측면 함포3문','천 아래에도 노출된 연결 골조'],
    referenceNotes:'첨부 시트2의 검은 수직 통·중장갑·봉인천·중앙 종을 실제3D로 해석. 큰 기낭/코티지를 제거하고 통이 실루엣을 지배한다. 원문09/25/65의 봉쇄·함포·장갑·종·연막 역할만 확정이며 수량은 전부 미정이다. 탱크4/포3/기낭1 등은 reference artModules 제안이며 전투·정사 보스 편성과 무관하다.',
  };
}
