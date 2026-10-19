import { THREE, group, mesh, box, sphere, beam, tube, ring, cloth, balloon, engine, control, plate, chain, gear, lantern, threat } from './core.js';

// Complete replacement silhouettes built in an empty scene. These are display
// proposals: no original GLB, attachment, weapon or simulation state is changed.
const IDS = new Set(['mission-cult-purifier', 'mini-funeral-guard', 'role-enemy-defense', 'boss-last-inhale']);
const TAU = Math.PI * 2;
function lathe(p, material, name, at, profile, rotation) {
  return mesh(p, new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r,y)), 24), material, name, at, rotation);
}
function arch(p, material, name, at, width, height, radius=.22, lean=0) {
  const points=[];
  for(let i=0;i<=24;i++) {
    const a=Math.PI*i/24;
    points.push([at[0]+lean*Math.sin(a),at[1]+height*Math.sin(a),at[2]+width*Math.cos(a)]);
  }
  return tube(p,material,name,points,radius,40);
}
function seal(p,m,n,at,r=1) {
  const g=group(p,n,at);
  mesh(g,new THREE.CylinderGeometry(r,r*.82,.28,12),m.red,n+'-wax',[0,0,0],[Math.PI/2,0,0]);
  ring(g,m.brass,n+'-rim',[0,0,.17],r*.72,.07,'z');
  plate(g,m.ivory,n+'-mark',[[-.22,-.55],[.22,-.55],[.15,.1],[.46,.3],[0,.65],[-.46,.3],[-.15,.1]],.1,[0,0,.22]);
  return g;
}
function mask(p,m,n,at,s=1) {
  const g=group(p,n,at);
  sphere(g,m.ivory,n+'-face',[0,0,0],[s*.45,s*.95,s*.72]);
  plate(g,m.dark,n+'-slit',[[-.55,-.1],[.55,-.1],[.32,.16],[-.32,.16]],.15,[-s*.36,s*.23,0],[0,Math.PI/2,0]);
  tube(g,m.brass,n+'-tear',[[0,.2,-s*.6],[-.1,-s*.5,-s*.6],[-.4,-s*.9,-s*.4]],.07);
  return g;
}
function censer(p,m,n,at,s=1) {
  const g=group(p,n,at);
  lathe(g,m.iron,n+'-bowl',[0,0,0],[[0,-1.8*s],[.6*s,-1.55*s],[1.5*s,-.7*s],[1.6*s,0],[1.25*s,.45*s],[.8*s,.7*s],[.65*s,1.2*s],[0,1.4*s]]);
  ring(g,m.brass,n+'-lip',[0,0,0],1.6*s,.16*s,'y');
  sphere(g,m.glow,n+'-fire',[0,.3*s,0],[1.1*s,.3*s,1.1*s]);
  for(let k=0;k<6;k++) {
    const a=k*TAU/6;
    tube(g,m.brass,n+'-cage-'+k,[[1.45*s*Math.cos(a),0,1.45*s*Math.sin(a)],[s*Math.cos(a),s, s*Math.sin(a)],[0,1.65*s,0]],.1*s);
  }
  for(const z of [-1,1]) chain(g,m,n+'-suspension-'+z,[[0,1.5*s,z*.9*s],[0,3*s,z*.6*s],[0,4*s,0]],9);
  return g;
}

function purifier(ctx,n) {
  const {motion,m,controls}=ctx;
  const cathedral=group(motion,n+'suspended-cathedral');
  // No box deck: a long hollow reliquary hangs between two enormous open ribs.
  for(const x of [-6,-1,5]) {
    arch(cathedral,m.iron,n+'flying-rib-'+x,[x,1.5,0],4.6,9,.42,x===5?1:-.5);
    arch(cathedral,m.brass,n+'rib-inlay-'+x,[x-.05,1.6,0],4.3,8.6,.09);
    for(const z of [-4.6,4.6]) beam(cathedral,m.iron,n+'rib-foot-'+x+'-'+z,[x,1.5,z],[x-1,-1,z*.7],.38);
  }
  for(const z of [-3.6,3.6]) {
    tube(cathedral,m.iron,n+'hollow-keel-'+z,[[-9,.8,z*.45],[-6,-.7,z], [2,-1.1,z],[7,1,z*.75]],.58);
    cloth(cathedral,m.ivory,n+'folded-shroud-'+z,{at:[0,5,z],width:10,height:5.2,ragged:true,billow:.8,rotation:[0,0,z>0?.06:-.06]});
    tube(cathedral,m.red,n+'shroud-blood-edge-'+z,[[-5,7.3,z],[-3,2.5,z+.3],[2,3,z+.5],[5,6.8,z]],.22);
  }
  // Asymmetric organ seals become the dominant skyline, not ordinary towers.
  [[-3,3.8,1.5,8.5],[2,2.8,-1.2,11],[5,2.2,1.5,5.8]].forEach(([x,y,z,h],i)=>{
    const pipe=group(cathedral,n+'organ-seal-'+i,[x,y,z],[0,0,(i-1)*.12]);
    lathe(pipe,m.dark,n+'organ-body-'+i,[0,0,0],[[1.4,0],[1.7,.6],[1.1,1.1],[1.1,h-1],[1.55,h-.5],[1.55,h],[1.05,h+.4]]);
    for(const yy of [1.1,h-1]) ring(pipe,m.brass,n+'organ-collar-'+i+'-'+yy,[0,yy,0],1.15,.16,'y');
    seal(pipe,m,n+'organ-writ-'+i,[0,h*.65,1.2],.8);
    for(const dz of [-.45,.45]) tube(pipe,m.brass,n+'organ-key-'+i+'-'+dz,[[0,1.1,dz],[1.5,1.7,dz],[1.5,3,dz]],.13);
  });
  [[-6,-4.2,0,1.55],[.5,-4.7,-1.4,1.25],[6,-2.9,1.2,1.05]].forEach(([x,y,z,s],i)=>{
    const c=censer(cathedral,m,n+'great-censer-'+i,[x,y,z],s);
    threat(ctx,c,'z',.09+i*.025);
    beam(cathedral,m.iron,n+'censer-yoke-'+i,[x,2,z],[x,y+4*s,z],.16);
  });
  balloon(cathedral,m,n+'buried-aft-bag',{length:9,radius:2.4,at:[6,7,0],material:'gray',flatten:.75,net:true},controls);
  mask(cathedral,m,n+'judgement-prow',[-9,1.5,0],1.4);
  return {theme:'검은 향로 성당 / 정화선',features:['선체 대신 빈 공간을 품는 세 겹의 거대한 철골 아치','높이와 굵기가 다른 비대칭 봉인 오르간 세 관','주황 불심을 품은 거대 향로 세 개가 아래로 매달림','상아 수의의 넓은 면과 진홍 접힌 가장자리','선수 가면과 뒤에 묻힌 낮은 부력 주머니','향로가 서로 다른 진폭으로 흔들리는 위협 시연'],artModules:{proposal:true,primary:'open-censer-cathedral',secondary:'three-asymmetric-seal-organs',motion:'three-suspended-censers'}};
}

function funeral(ctx,n) {
  const {motion,m,controls}=ctx;
  const coach=group(motion,n+'coffin-coach');
  // Coffin plan is tapered at both ends, with a high shoulder near its head.
  const outline=[[-8,-1.2],[-5,-3.4],[3,-3.4],[7,-1.7],[8,0],[7,1.7],[3,3.4],[-5,3.4],[-8,1.2]];
  plate(coach,m.darkWood,n+'coffin-vessel',outline,2.2,[0,-.4,0],[Math.PI/2,0,0]);
  tube(coach,m.brass,n+'coffin-beading',outline.concat([outline[0]]).map(([x,z])=>[x,.8,z]),.18);
  plate(coach,m.red,n+'coffin-velvet',outline.map(([x,z])=>[x*.9,z*.86]),.15,[0,.85,0],[Math.PI/2,0,0]);
  for(const x of [-4.5,4.7]) for(const z of [-4,4]) {
    const wheel=group(coach,n+'processional-wheel-'+x+'-'+z,[x,-1.3,z]);
    ring(wheel,m.iron,wheel.name+'-rim',[0,0,0],2.85,.42,'z');
    ring(wheel,m.brass,wheel.name+'-edge',[0,0,z>0?.13:-.13],2.62,.09,'z');
    sphere(wheel,m.brass,wheel.name+'-hub',[0,0,0],[.5,.5,.45]);
    for(let i=0;i<8;i++) { const a=i*TAU/8; beam(wheel,m.iron,wheel.name+'-spoke-'+i,[0,0,0],[2.6*Math.cos(a),2.6*Math.sin(a),0],.14); }
    control(controls,wheel,'funeral-wheel','z',.09);
  }
  // A swept, pointed canopy curves back over the coffin, crimson inside.
  for(const z of [-2.7,2.7]) {
    tube(coach,m.iron,n+'canopy-sweep-'+z,[[-6,1,z],[-5,4.8,z],[0,7.7,z*.75],[5,6.6,z*.5],[7.5,4,z*.3]],.3);
    cloth(coach,m.dark,n+'mourning-canopy-'+z,{at:[0,6,z*.65],width:11,height:4.5,billow:1.35,ragged:true,rotation:[0,0,-.17]});
    cloth(coach,m.red,n+'crimson-canopy-lining-'+z,{at:[-.2,5.7,z*.65],width:9.8,height:3.6,billow:1.15,ragged:true,rotation:[0,0,-.17]});
    balloon(coach,m,n+'low-stitch-bag-'+z,{length:9,radius:1.15,at:[.5,1.7,z*1.6],material:'gray',flatten:.7,net:true},controls);
  }
  mask(coach,m,n+'solitary-prow-mask',[-8.1,1.5,0],1.65);
  const bell=group(coach,n+'single-funeral-bell',[-4.5,4.3,0]);
  lathe(bell,m.brass,n+'bell-mouth',[0,0,0],[[1.1,-.6],[1.15,-.4],[.7,.2],[.45,1],[.2,1.2],[0,1.2]]);
  sphere(bell,m.dark,n+'bell-tongue',[0,-.6,0],[.18,.4,.18]);
  threat(ctx,bell,'z',.22);
  for(const z of [-2.6,2.6]) chain(coach,m,n+'coffin-hanging-chain-'+z,[[-6,.6,z],[-3,-1.9,z],[2,-2.2,z],[6,.6,z]],16);
  seal(coach,m,n+'coffin-order',[5,1.4,0],1.1);
  engine(coach,m,n+'coach-stern-thruster',{at:[7,.2,0],scale:.65},controls);
  return {theme:'네 바퀴 장송 마차 / 장례 호위',features:['양끝이 좁고 어깨가 벌어진 관 형태의 비행 차체','차체 바깥으로 드러나는 네 개의 거대 살바퀴','뒤로 쓸린 검은 차양 안쪽의 진홍 안감','좌우 낮게 붙은 봉합 부력 주머니','고독한 작은 종 하나와 상아 장례 가면','늘어진 관 운반 사슬과 밀랍 명령 봉인'],artModules:{proposal:true,primary:'flying-coffin-coach',secondary:'four-procession-wheels',motion:'solitary-funeral-bell'}};
}

function defense(ctx,n) {
  const {motion,m,controls}=ctx;
  const wall=group(motion,n+'flying-portcullis');
  // The frontal wall spans Z. Three bowed layers replace any boat-shaped bow.
  for(let layer=0;layer<3;layer++) {
    const x=layer*1.3;
    for(let i=0;i<9;i++) {
      const z=(i-4)*1.75, curve=Math.abs(z)*.21;
      const tooth=[[-.62,-3.6],[-.3,-5.1],[.15,-5.6],[.62,-3.6],[.62,3.2],[.25,4.7],[-.35,4.3],[-.62,3.2]];
      plate(wall,layer===1?m.gray:m.iron,n+'curved-gate-bar-'+layer+'-'+i,tooth,.6,[x+curve,3.4,z],[0,Math.PI/2,0]);
    }
    for(const y of [1,4.5,7]) tube(wall,m.iron,n+'bowed-crossrail-'+layer+'-'+y,[[x+1.7,y,-8],[x+.4,y,-4],[x,y,0],[x+.4,y,4],[x+1.7,y,8]],.38);
  }
  for(const z of [-1,1]) {
    const wing=group(wall,n+'folded-shield-'+z,[1,3,z*7.7],[0,z*.42,0]);
    plate(wing,m.dark,wing.name+'-panel',[[-3,-2.8],[-2,3],[.7,4.3],[2,2.4],[2,-3],[0,-4.8]],.85,[0,0,0],[0,Math.PI/2,0]);
    for(const dy of [-1.5,1,2.7]) beam(wing,m.brass,wing.name+'-ridge-'+dy,[-.55,dy,-2.5],[-.55,dy,2.1],.16);
    seal(wing,m,wing.name+'-writ',[-.55,.5,0],.75);
    balloon(wall,m,n+'rear-bulwark-bag-'+z,{length:9,radius:2.8,at:[6,6,z*4.7],material:'gray',net:true},controls);
    engine(wall,m,n+'wall-pusher-'+z,{at:[7,0,z*5],scale:.75},controls);
  }
  const lock=group(wall,n+'enormous-lock',[-1.3,3.7,0],[0,Math.PI/2,0]);
  plate(lock,m.brass,n+'lock-housing',[[-2,-2.5],[-2.8,0],[-1.8,2],[0,2.6],[1.8,2],[2.8,0],[2,-2.5]],.8);
  ring(lock,m.iron,n+'lock-bow',[0,2.3,0],1.6,.4,'z');
  sphere(lock,m.dark,n+'lock-keyhole',[0,.45,.5],[.6,.8,.15]);
  plate(lock,m.dark,n+'lock-keyhole-slot',[[-.25,0],[.25,0],[.5,-1.5],[-.5,-1.5]],.18,[0,0,.5]);
  const key=group(wall,n+'gate-key',[-2.5,-.6,2],[0,0,-.35]);
  ring(key,m.brass,n+'key-handle',[0,0,0],1,.2,'x');
  beam(key,m.brass,n+'key-shaft',[0,0,0],[0,-3.2,0],.22);
  for(const y of [-2,-2.7]) box(key,m.brass,n+'key-bit-'+y,[0,y,.5],[.35,.3,1.1]);
  threat(ctx,key,'z',.1);
  box(wall,m.darkWood,n+'tiny-rear-watch-cabin',[6,2,0],[2.5,2.6,2.1]);
  sphere(wall,m.red,n+'watch-cabin-hood',[6,3.5,0],[1.8,.6,1.7]);
  lantern(wall,m,n+'watch-light',[4.7,2.2,0],.55);
  return {theme:'봉인 관문 / 방어 특화',features:['일반 선수 대신 넓게 휘어진 삼중 철제 낙하문','층마다 뒤로 물러난 곡면 레일과 날카로운 하단 이빨','중앙의 거대한 황동 자물쇠와 매달린 열쇠','접혀 돌아가는 좌우 중장갑 방패 날개','성벽 뒤에 숨은 두꺼운 회색 기낭','후방 감시실의 작은 등불과 느린 열쇠 흔들림'],artModules:{proposal:true,primary:'three-layer-bowed-portcullis',secondary:'central-lock-folded-shields',motion:'hanging-gate-key'}};
}

function lastInhale(ctx,n) {
  const {motion,m,controls}=ctx;
  const machine=group(motion,n+'sealed-machine-facility');
  // One closed mechanical egg; no anatomy, creature limbs or organic god.
  const heart=group(machine,n+'single-mechanical-egg',[0,3.8,0]);
  lathe(heart,m.dark,n+'egg-shell',[0,0,0],[[0,-5],[1.8,-4.5],[3.7,-3.1],[4.5,-.6],[4.1,2.7],[2.8,5],[1.1,6.4],[0,6.8]]);
  for(const y of [-3,0,3.2]) ring(heart,m.iron,n+'egg-pressure-band-'+y,[0,y,0],y===0?4.5:3.5,.24,'y');
  for(const z of [-1,1]) tube(heart,m.brass,n+'egg-weld-'+z,[[-1,-4,z*1.4],[-3,-1,z*2.8],[-2,3,z*2.6],[0,6,z*.6]],.13);
  seal(heart,m,n+'heart-primary-lock',[0,.4,4.5],1.4);
  // Angular crown blades bend inward toward the lock, rather than cone spires.
  for(let i=0;i<7;i++) {
    const a=i*TAU/7, r=2.7;
    const blade=plate(heart,m.iron,n+'crown-blade-'+i,[[-.55,0],[.65,0],[.8,2.1],[.15,3.3],[-.3,1.8]],.3,[r*Math.cos(a),4.7,r*Math.sin(a)],[0,-a,0]);
    blade.rotation.z=.2;
  }
  threat(ctx,heart,'y',.035);
  // Broken orbital scaffold leaves three large open gaps around the heart.
  for(const [start,end] of [[.1,1.5],[2,3.7],[4.3,5.7]]) {
    const pts=[]; for(let j=0;j<=24;j++) {const a=start+(end-start)*j/24;pts.push([8.5*Math.cos(a),-.3+1.1*Math.sin(a*2),7.4*Math.sin(a)]);}
    tube(machine,m.iron,n+'broken-circulation-ring-'+start,pts,.6,40);
    tube(machine,m.brass,n+'ring-inlay-'+start,pts.map(([x,y,z])=>[x,y+.45,z]),.12,40);
    for(const a of [start,end]) sphere(machine,m.red,n+'ruptured-ring-end-'+a,[8.5*Math.cos(a),-.3+1.1*Math.sin(a*2),7.4*Math.sin(a)],[.7,.7,.7]);
  }
  const towers=[{at:[-6,-.2,-4],h:12,r:1.7,twist:.7},{at:[5,-.2,-5.8],h:8.8,r:2.2,twist:-.5},{at:[5.4,0,5.4],h:14,r:1.25,twist:1.1}];
  towers.forEach(({at,h,r,twist},i)=>{
    const t=group(machine,n+'seal-tower-'+i,at);
    // A winding pressure duct is the tower silhouette, capped by a broad seal.
    const path=[];
    for(let j=0;j<=30;j++) {const f=j/30,a=f*4+twist;path.push([Math.sin(a)*r*.58,f*h,Math.cos(a)*r*.58]);}
    tube(t,m.iron,n+'winding-tower-body-'+i,path,r*.7,50);
    for(let j=0;j<4;j++) {
      const y=h*j/4,a=j+twist;
      ring(t,m.brass,n+'tower-stepped-collar-'+i+'-'+j,[Math.sin(a)*r*.58,y,Math.cos(a)*r*.58],r*(1.05-j*.08),.18,'y');
    }
    lathe(t,m.iron,n+'seal-cap-'+i,[Math.sin(4+twist)*r*.58,h-.2,Math.cos(4+twist)*r*.58],[[r*.5,0],[r*1.5,.3],[r*1.5,.7],[r*.9,1.2],[0,1.5]]);
    seal(t,m,n+'tower-seal-'+i,[0,h*.7,r],r*.7);
    cloth(t,m.ivory,n+'slumped-writ-cape-'+i,{at:[.3,h*.61,r+.25],width:r*2.8,height:h*.64,billow:.65,ragged:true,rotation:[0,0,(i-1)*.16]});
    tube(machine,m.red,n+'circulation-pipe-'+i,[[at[0],1,at[2]],[at[0]*.7,2.5,at[2]*.8],[at[0]*.4,3,at[2]*.5]],.4);
  });
  for(const z of [-1,1]) {
    tube(machine,m.iron,n+'heart-retaining-claw-'+z,[[-6,-1,z*5],[-5,1,z*4.8],[-4.2,5,z*3.8],[-2,6.7,z*2.6],[-.8,6.3,z*2.1]],.55);
    tube(machine,m.brass,n+'claw-edge-'+z,[[-5,1,z*5],[-4,4.8,z*4],[-2,6.5,z*2.9]],.13);
    engine(machine,m,n+'facility-pump-'+z,{at:[7,-2,z*2.6],scale:.9},controls);
  }
  const valve=group(machine,n+'lower-pressure-valve',[-4,-2,0]);
  gear(valve,m.brass,n+'valve-wheel',[0,0,0],1.6,'x');
  threat(ctx,valve,'x',.15);
  return {theme:'최후의 들숨 / 봉인된 기계 시설',features:['유기체가 아닌 단 하나의 검은 압력 달걀 심장','높이와 굵기·감김 방향이 다른 봉인 탑 정확히 세 개','서로 끊긴 부유 순환 고리로 열린 시야 확보','안으로 굽은 왕관 칼날과 상아 봉인 수의 세 장','심장을 붙잡는 곡선 고정 발톱과 진홍 순환 배관','미세한 압력 심장 회전과 저속 황동 밸브 위협 시연'],artModules:{proposal:true,primary:'one-black-mechanical-egg',secondary:'three-nonuniform-winding-seal-towers',tertiary:'broken-open-circulation-ring',motion:'pressure-heart-and-valve'}};
}

export function buildCult(ctx) {
  if(!IDS.has(ctx.id)) return null;
  const n=ctx.id+'-bold-';
  if(ctx.id==='mission-cult-purifier') return purifier(ctx,n);
  if(ctx.id==='mini-funeral-guard') return funeral(ctx,n);
  if(ctx.id==='role-enemy-defense') return defense(ctx,n);
  return lastInhale(ctx,n);
}
