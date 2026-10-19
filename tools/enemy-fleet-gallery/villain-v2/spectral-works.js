import {THREE,group,mesh,box,sphere,beam,tube,ring,cloth,balloon,engine,control,plate,gun,chain,gear,claw,lantern,threat} from './core.js';

// Entire replacement silhouettes. No source GLB, original modules, or sim values enter here.
function wing(parent,mat,name,points,at=[0,0,0],holes=[]){
 const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
 for(const outline of holes)shape.holes.push(new THREE.Path(outline.map(([x,z])=>new THREE.Vector2(x,-z))));
 const geo=new THREE.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:false,curveSegments:10});geo.rotateX(Math.PI/2);
 return mesh(parent,geo,mat,name,at);
}
function rivets(parent,m,n,from,to,count=7){for(let i=0;i<count;i++){const t=i/(count-1);sphere(parent,m.brass,n+i,from.map((v,j)=>v+(to[j]-v)*t),[.085,.085,.085],8);}}
function cage(parent,m,n,at,size){
 const g=group(parent,n,at),[w,h,d]=size;
 box(g,m.darkWood,n+'-floor',[0,-h/2,0],[w,.22,d]);box(g,m.iron,n+'-roof',[0,h/2,0],[w+.3,.2,d+.3]);
 for(const s of [-1,1])for(let i=0;i<5;i++)beam(g,m.iron,n+'-bars-'+s+'-'+i,[-w/2+i*w/4,-h/2,s*d/2],[-w/2+i*w/4,h/2,s*d/2],.065);
 for(const s of [-1,1])for(const z of [-1,1])beam(g,m.brass,n+'-corner-'+s+z,[s*w/2,-h/2,z*d/2],[s*w/2,h/2,z*d/2],.1);
 return g;
}
function saw(parent,m,n,at,r=3){
 const g=group(parent,n,at);mesh(g,new THREE.CylinderGeometry(r*.83,r*.83,.38,32),m.iron,n+'-disc',[0,0,0],[Math.PI/2,0,0]);
 ring(g,m.brass,n+'-inner',[0,0,.24],r*.6,.12,'z');sphere(g,m.dark,n+'-hub',[0,0,.3],[.42,.42,.27]);
 for(let i=0;i<18;i++){const a=i*Math.PI/9;plate(g,m.ivory,n+'-serrated-tooth-'+i,[[0,-.24],[.65,0],[.12,.35]],.46,[Math.cos(a)*r*.82,Math.sin(a)*r*.82,0],[0,0,a]);}
 return g;
}
function shrike(ctx){
 const {motion:p,m,controls,id}=ctx,n=id+'-bold-',body=group(p,n+'shrike');
 // Long, hollow split beak rather than a conventional gondola and central envelope.
 for(const s of [-1,1]){
  const rail=tube(body,m.darkWood,n+'curved-beak-'+s,[[-13,.7,s*.23],[-9,1,s*1.3],[-3,.4,s*2],[3,-.5,s*1.5],[7,.1,s*.7]],.65,30);
  tube(body,m.brass,n+'beak-edge-'+s,[[-13,1.15,s*.25],[-9,1.5,s*1.4],[-3,1.05,s*2.2],[3,.1,s*1.7],[7,.55,s*.7]],.1,24);
  wing(body,m.ink,n+'swept-black-wing-'+s,[[-5,s*1.6],[-1,s*3.1],[4,s*10.8],[6,s*9.8],[4.2,s*7.5],[7.6,s*7.6],[4,s*4.2],[5,s*1.6]],[0,.6,0]);
  for(let k=0;k<3;k++)tube(body,m.iron,n+'wing-fingers-'+s+'-'+k,[[-3+k,1,s*1.6],[1+k,1.6,s*(4+k)],[4+k*.75,.7,s*(8+k*.6)]],.1,16);
  for(let k=0;k<5;k++)beam(body,m.ivory,n+'wing-stitches-'+s+'-'+k,[1+k*.6,.77,s*(4.1+k*.6)],[1.3+k*.6,.77,s*(4.5+k*.6)],.045);
  const tail=wing(body,m.red,n+'fork-tail-'+s,[[4,s*.8],[12,s*4.1],[9,s*.25],[7,s*.1]],[0,1.2,0]);
  control(controls,tail,'sway','x',s*.055);
 }
 for(let i=0;i<6;i++)box(body,m.wood,n+'cross-step-'+i,[-5+i*1.9,.4,0],[.75,.25,3.6-i*.25],[0,0,-.04]);
 plate(body,m.iron,n+'hooked-upper-beak',[[-14,1],[-10,2.1],[-6,1.8],[-9,.9],[-12,.6]],.48,[0,0,-.24]);
 const crest=group(body,n+'crooked-listening-crest',[-1,1.1,0]);
 tube(crest,m.darkWood,n+'mast',[[0,0,0],[.7,4,0],[-.3,8.5,0],[1.1,11,0]],.24,20);
 plate(crest,m.ink,n+'head-crest',[[-.4,5],[1.8,11.5],[3,9.8],[1.7,7.4],[2.5,5.5]],.35,[0,0,-.18]);
 for(let i=0;i<3;i++){const ears=group(crest,n+'listening-dish-'+i,[.3+i*.25,5+i*2,0],[0,0,.3]);ring(ears,m.brass,n+'ear-rim-'+i,[0,0,0],.75+i*.16,.12,'x');sphere(ears,m.ink,n+'ear-cup-'+i,[.15,0,0],[.25,.7+i*.12,.7+i*.12]);}
 threat(ctx,crest,'z',-.2);
 balloon(body,m,n+'small-left-stitched-lung',{length:5,radius:1.2,at:[2,3,-3],material:'red',flatten:.85},controls);
 balloon(body,m,n+'tall-right-stitched-lung',{length:3.5,radius:1.7,at:[3.5,4,2.9],material:'gray',flatten:1.3},controls);
 for(const s of [-1,1]){beam(body,m.rope,n+'lung-stay-'+s,[1,1,s*1.5],[3,4,s*3],.1);engine(body,m,n+'needle-thruster-'+s,{at:[6.4,.4,s*2],scale:s<0?.8:1.1},controls);lantern(body,m,n+'predator-eye-'+s,[-7,1.6,s*1.25],.45);}
 const talon=claw(body,m,n+'snatching-belly-claw',[-5,-1.2,0],1.35);threat(ctx,talon,'z',-.28);
 cloth(body,m.red,n+'ragged-signal-scarf',{at:[1,8,.2],width:2,height:5,ragged:true,billow:.7,rotation:[0,.25,-.55]});
 return {theme:'갈라진 긴 부리와 검은 날개로 먹잇감을 훔치는 도적 맹금 정찰선',features:['기존 선체 없이 만든 길고 속 빈 갈고리 부리','검은 천의 크게 뒤로 꺾인 날개와 두 갈래 꼬리','비뚤어진 청음 볏과 크기가 다른 봉합 부력 주머니','발톱·눈등·붉은 신호천이 만드는 포식자의 얼굴','날개 뼈대와 황동 봉합선에 남은 수공예 흔적','청음 볏과 집게의 위협 동작'],artModules:{openSplitBeak:1,sweptWings:2,unequalLungs:2,listeningCrest:1,snatchClaw:1,simulationModules:0}};
}
function ghost(ctx){
 const {motion:p,m,controls,id}=ctx,n=id+'-bold-',body=group(p,n+'skeletal-manta');
 // Two separated crescent forks and real holes in the broad linen membranes.
 for(const s of [-1,1]){
  tube(body,m.ivory,n+'crescent-bone-'+s,[[-10,1,s*1.2],[-6,2,s*5],[-1,2.3,s*8.4],[5,1,s*9.2],[9,0,s*5.4]],.48,34);
  const membrane=wing(body,s<0?m.gray:m.canvas,n+'missing-linen-wing-'+s,[[-8,s*1.6],[-5,s*5],[-1,s*8.2],[4.5,s*8.5],[1.5,s*5.5],[4.5,s*5.1],[2.1,s*3.2],[5,s*2],[.5,s*.9]], [0,1.4,0],s<0?[[[-3,s*3],[-1,s*4.5],[.7,s*4.1],[.2,s*2.7]]]:[[[-4,s*3.2],[-2,s*5.4],[0,s*5.5],[-.5,s*3.4]],[[1,s*6.2],[2,s*7.1],[2.8,s*6.8]]]);
  control(controls,membrane,'sway','x',s*.035);
  for(let i=0;i<4;i++)tube(body,m.ivory,n+'exposed-wing-rib-'+s+'-'+i,[[-5+i*2,1,s*1.2],[-3+i*1.8,1.8,s*3.8],[-1+i*1.7,1.7,s*(6.5-i*.3)]],.14,18);
  for(let i=0;i<3;i++)cloth(body,m.gray,n+'tattered-wing-remnant-'+s+'-'+i,{at:[2+i*1.9,1,s*(5+i*.7)],width:1.2,height:2.3+i*.5,ragged:true,billow:.2,rotation:[0,s*.5,.25]});
  tube(body,m.cold,n+'ice-fissure-'+s,[[-6,1.6,s*3.1],[-4.6,1.65,s*4],[-3.2,1.65,s*3.6],[-2.1,1.65,s*4.6]],.045,12);
 }
 const spine=group(body,n+'spinal-siege-cannon',[1,.8,0]);
 gun(spine,m,n+'massive-central-bore',{at:[-1,0,0],scale:1.7,barrelRadius:.73,barrelLength:6.5},controls);
 for(let i=0;i<7;i++){const x=-3+i*1.5;sphere(spine,m.iron,n+'vertebra-'+i,[x,-.2,0],[.55,.65,.9]);for(const s of [-1,1])tube(spine,m.ivory,n+'spine-rib-'+s+i,[[x,-.1,s*.6],[x+.5,-1.2,s*1.8],[x+1,-1.7,s*1.3]],.16,14);}
 threat(ctx,spine,'z',-.13);
 const lance=group(body,n+'curved-guard-tail',[5,0,0]);
 tube(lance,m.ivory,n+'long-tail-bone',[[0,0,0],[3,-.3,0],[6,1,0],[8.5,4,0],[8,6,0]],.33,26);
 for(let i=0;i<4;i++)tube(lance,m.iron,n+'tail-guard-'+i,[[1+i*1.4,0,0],[2+i*1.2,1.8,1.5],[3+i*1.1,2.4,0],[2+i*1.2,1.8,-1.5]],.13,20);
 threat(ctx,lance,'y',.2);
 for(const s of [-1,1]){engine(body,m,n+'frost-engine-'+s,{at:[5,-.4,s*3],scale:.8},controls);chain(body,m,n+'hanging-wreck-chain-'+s,[[1,1,s*6.8],[1,-2,s*6.8],[3,-3,s*5.3]],12);sphere(body,m.cold,n+'cold-eye-'+s,[-7.5,1.4,s*1.5],[.18,.22,.4]);}
 return {theme:'깨진 초승달 뼈대와 찢어진 아마포 날개를 가진 유령 가오리 포대',features:['양옆이 벌어진 초승달형 뼈대와 넓은 가오리 윤곽','아마포 막을 실제로 뚫은 비대칭 빈 구멍','허리 전체를 관통하는 거대한 척추포','가늘고 차가운 균열빛과 늘어진 잔해 사슬','뒤로 말려 올라가는 긴 뼈창과 보호 갈비','가오리 날개와 척추포의 분리된 움직임'],artModules:{crescentSpars:2,perforatedLinenWings:2,spineCannon:1,guardLance:1,simulationModules:0}};
}
function shipyard(ctx){
 const {motion:p,m,controls,id}=ctx,n=id+'-bold-',yard=group(p,n+'whale-carcass-drydock');
 // Open facility: passage width 7 and roof void are deliberately kept free.
 for(const s of [-1,1]){
  tube(yard,m.darkWood,n+'outer-keel-'+s,[[-11,-2,s*4.7],[-7,-2.5,s*6], [3,-2.3,s*6.2],[10,-1.5,s*4.7]],.7,30);
  for(let i=0;i<6;i++){
   const x=-8+i*3.2,h=[7,10,8.8,12,9.4,6.4][i],z=5.3+(i%2)*.5;
   tube(yard,m.ivory,n+'colossal-open-rib-'+s+'-'+i,[[x,-2,s*z],[x-.3,2,s*(z+1.3)],[x+.4,h*.7,s*(z+.2)],[x+1,h,s*2.9]],.37+(i%3)*.08,28);
   tube(yard,m.brass,n+'rib-iron-repair-'+s+'-'+i,[[x,-1.4,s*(z+.12)],[x-.1,1.2,s*(z+1.2)],[x+.2,2.5,s*(z+1.3)]],.13,14);
  }
  box(yard,m.darkWood,n+'layered-work-platform-'+s,[0,-1.4,s*6.5],[18,.55,3.3]);
  box(yard,m.iron,n+'upper-machine-walkway-'+s,[2,2.2,s*7.3],[11,.35,2]);
  for(let i=0;i<9;i++)beam(yard,m.iron,n+'rail-post-'+s+i,[-8+i*2,-1.1,s*8],[-8+i*2,.1,s*8],.08);
  beam(yard,m.brass,n+'continuous-rail-'+s,[-8,.1,s*8],[8,.1,s*8],.08);
  cage(yard,m,n+'suspended-prison-'+s,[s<0?-4:3,3.8,s*7.5],[3.3,3,2.2]);
  chain(yard,m,n+'cage-cradle-'+s,[[s<0?-4:3,7,s*6],[s<0?-4:3,5.4,s*7.5]],9);
  balloon(yard,m,n+'external-buoyancy-bladder-'+s,{at:[1,-3,s*7],length:10,radius:1.5,flatten:.85,material:'gray'},controls);
  engine(yard,m,n+'yard-engine-'+s,{at:[8,-.8,s*6],scale:1.25},controls);
  lantern(yard,m,n+'watch-lantern-'+s,[-9,1,s*6],.7);
 }
 // Gate jaws at both open ends do not bridge or cap the central channel.
 for(const x of [-10,10])for(const s of [-1,1]){
  const gate=group(yard,n+'gate-'+x+'-'+s,[x,-.6,s*4.9]);
  tube(gate,m.iron,n+'crooked-gate-bone-'+x+s,[[0,0,0],[0,2,s*.7],[x<0?-1:1,4,-s*1.3],[x<0?-2:2,3.5,-s*2]],.33,20);
  for(let i=0;i<3;i++)plate(gate,m.ivory,n+'gate-fang-'+x+s+i,[[0,0],[-.65,1.3],[.3,.7]],.35,[0,1+i*.75,-s*.6],[0,s*.5,0]);
  if(x<0)threat(ctx,gate,'y',s*.24);
 }
 const cutter=saw(yard,m,n+'salvage-saw',[5,3.1,8.7],1.6);control(controls,cutter,'rotor','z',Math.PI*2);
 for(let i=0;i<3;i++){const x=-5+i*4;chain(yard,m,n+'empty-hook-line-'+i,[[x,8+i%2,3.1],[x,4+i%2,3.1]],12);tube(yard,m.iron,n+'meat-hook-'+i,[[x,4+i%2,3.1],[x-.6,3+i%2,3.1],[x+.2,2.7+i%2,3.1],[x+.55,3.4+i%2,3.1]],.14,16);}
 return {theme:'거대한 고래의 빈 골격을 감옥과 해체 설비로 바꾼 부유 건선거',features:['배가 드나드는 넓은 중앙 통로와 열린 지붕','높이와 굽음이 다른 거대한 고래 갈비 기둥','두꺼운 외곽 용골과 위아래로 겹친 작업 발판','양 끝을 움켜쥐는 독립 집게문과 포로 감옥','실제 빈 공간에 매달린 해체 갈고리와 절단 톱','통로 밖 낮은 부력 주머니와 작업등'],artModules:{openPassage:1,curvedRibPiers:12,prisonCages:2,clawGates:4,salvageSaw:1,simulationModules:0}};
}
function command(ctx){
 const {motion:p,m,controls,id}=ctx,n=id+'-bold-',fort=group(p,n+'execution-throne-fortress');
 // A heavy, wide amphitheatre of timber and iron; the body is the throne.
 wing(fort,m.iron,n+'wide-armored-foundation',[[-10,-5],[-8,-8],[4,-9],[9,-6],[10,4],[5,8],[-7,7],[-11,2]],[0,-1.6,0]);
 for(const s of [-1,1]){
  box(fort,m.darkWood,n+'deep-armored-armrest-'+s,[0,.2,s*5.7],[15,3.2,3.3]);
  box(fort,m.iron,n+'armrest-iron-cap-'+s,[-.4,2,s*5.7],[15.5,.6,3.7]);
  for(let i=0;i<5;i++)plate(fort,m.iron,n+'overlapping-side-armor-'+s+i,[[-1.8,-1.2],[1.5,-.8],[1.9,1.2],[-1.1,1.8]],.3,[-6+i*3,0,s*7.45],[0,s*Math.PI/2,0]);
  balloon(fort,m,n+'low-captive-armored-bag-'+s,{at:[0,-2.1,s*5.8],length:11,radius:1.65,flatten:.75,material:'red'},controls);
  for(let i=0;i<4;i++)box(fort,m.iron,n+'bag-armor-hoop-'+s+i,[-4.5+i*3,-2,s*5.8],[.25,2.9,3.1]);
  engine(fort,m,n+'asymmetric-engine-tower-'+s,{at:[7,s<0?.8:2.2,s*6.6],scale:s<0?1.65:2.2},controls);
  for(let i=0;i<4;i++){box(fort,m.brass,n+'hot-vent-'+s+i,[3+i,2.4,s*5.7],[.5,.12,1.5]);lantern(fort,m,n+'judgement-lamp-'+s+i,[-7+i*3,.9,s*7.6],.4);}
 }
 // Deep stairwell and flared crown bridge rise from the fortress itself.
 for(let i=0;i<6;i++)box(fort,i%2?m.iron:m.wood,n+'throne-stair-'+i,[-7+i*1.7,-.9+i*.48,0],[2.7,.5,7-i*.55]);
 box(fort,m.darkWood,n+'throne-house',[5,4.4,0],[5,7.2,8]);
 box(fort,m.iron,n+'crown-balcony',[3.3,6.3,0],[7,.6,10.3]);
 plate(fort,m.iron,n+'crown-bridge-face',[[-2,-3],[-3.2,3],[-2.2,5],[-1.3,3],[0,6],[1,3],[2.5,5],[3.3,2.8],[2.8,-3]],.8,[6.3,7.6,-.4],[0,Math.PI/2,0]);
 for(const s of [-1,1]){tube(fort,m.brass,n+'throne-curled-shoulder-'+s,[[4,5,s*3],[2,8,s*4.5],[3,10,s*4.8],[5,10.7,s*3.7]],.28,22);box(fort,m.glow,n+'glowering-bridge-eye-'+s,[2.25,7.2,s*2.6],[.12,.45,2]);}
 // One enormous geared cleaver crane and a different, low saw gantry.
 const cleaver=group(fort,n+'execution-cleaver-crane',[3,3,-6]);
 tube(cleaver,m.iron,n+'crane-swan-neck',[[0,0,0],[2,5,0],[1,10,0],[-5,11.5,0],[-9,9.5,0]],.55,26);
 for(const a of [[1.6,4.8,0],[.8,9.5,0],[-4.5,11,0]])gear(cleaver,m.brass,n+'crane-geared-knuckle-'+a[1],a,1.1,'z');
 chain(cleaver,m,n+'cleaver-chain',[[-8.7,9.7,0],[-8.7,5.7,0]],13);
 plate(cleaver,m.iron,n+'gigantic-cleaver',[[-3,2],[2.7,2],[3,-1],[1,-3],[-3,-1]],.65,[-8.7,3.8,-.3]);
 plate(cleaver,m.ivory,n+'cleaver-polished-edge',[[-3,-1],[1,-3],[3,-1],[1.7,-3.6],[-3.1,-1.6]],.7,[-8.7,3.8,-.33]);
 threat(ctx,cleaver,'z',-.19);
 const sawArm=group(fort,n+'serrated-dismantling-arm',[-3,2.8,6]);
 tube(sawArm,m.darkWood,n+'saw-elbow',[[0,0,0],[-2,3,0],[-5,3.6,1],[-7,1.3,1]],.55,24);
 gear(sawArm,m.brass,n+'saw-drive-wheel',[-2,3,.5],1.25,'z');
 const rotor=saw(sawArm,m,n+'enormous-dismantling-saw',[-7,0,1],3.1);control(controls,rotor,'rotor','z',Math.PI*2);threat(ctx,sawArm,'y',-.2);
 for(const s of [-1,1]){tube(fort,m.iron,n+'factory-chimney-'+s,[[7,6,s*2.7],[8,9,s*2.7],[7.5,12+s,s*3]],.45,20);ring(fort,m.brass,n+'chimney-lip-'+s,[7.5,12+s,s*3],.55,.15,'y');}
 cloth(fort,m.red,n+'torn-royal-apron',{at:[3,6.1,-5.2],width:5.6,height:5.4,ragged:true,billow:.3});
 rivets(fort,m,n+'front-great-rivets-',[-10,-.8,-4],[-10,-.8,4],9);
 return {theme:'기어 달린 참수 도구를 왕관처럼 든 거대한 해체 지휘 왕좌 요새',features:['깊은 목재·철갑 팔걸이 자체가 되는 넓은 왕좌형 몸체','중앙의 층진 계단과 거대한 왕관 함교','목을 길게 구부린 기어 크레인과 매달린 거대 절단날','반대편의 낮고 두꺼운 해체 원형톱 팔','낮게 가둔 장갑 부력 주머니와 불균형 거대 엔진','두 절단 장치의 독립 위협 동작과 찢긴 붉은 의장천'],artModules:{throneFortress:1,crownBridge:1,gearedCleaverCrane:1,dismantlingSaw:1,armoredLowBags:2,simulationModules:0}};
}
export function buildSpectralWorks(ctx){
 switch(ctx.id){
  case 'mission-guard-scout':return shrike(ctx);
  case 'mission-ghost-artillery':return ghost(ctx);
  case 'boss-shipyard-ribs':return shipyard(ctx);
  case 'boss-shipwright-command':return command(ctx);
  default:return null;
 }
}
