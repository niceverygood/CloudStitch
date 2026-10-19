import * as T from 'three';
import {createKit} from './kit.mjs';

export const ROSTER=[
 {id:'C2-01',kind:'needle',name:'붉은바늘 정찰정',role:'정찰 · 기관총',board:'fleet-hunters-4.png',panel:'top-left',shape:'long needle hull, swept stitched fins'},
 {id:'C2-02',kind:'capture',name:'집게갈고리 포획선',role:'포획 · 작살과 윈치',board:'fleet-hunters-4.png',panel:'top-right',shape:'open C-shaped fossil crane and capture cradle'},
 {id:'C2-03',kind:'shield',name:'거울패각 방패함',role:'전면 장갑 · 기관총',board:'fleet-hunters-4.png',panel:'bottom-left',shape:'upright overlapping perforated scallop fan'},
 {id:'C2-04',kind:'trumpet',name:'적산호 나팔함',role:'측면 중포격',board:'fleet-hunters-4.png',panel:'bottom-right',shape:'low broadside deck and dominant hollow coral trumpet'},
 {id:'C2-05',kind:'conch',name:'소라 곡사함',role:'곡사 · 박격포',board:'fleet-specialists-4.png',panel:'top-left',shape:'tilted volumetric conch mortar and suspended shell basket'},
 {id:'C2-06',kind:'lantern',name:'해파리 등불함',role:'근접 화염',board:'fleet-specialists-4.png',panel:'top-right',shape:'wide stitched bell canopy and hanging furnace gondola'},
 {id:'C2-07',kind:'chain',name:'톱지느러미 사슬정',role:'추진 방해 · 사슬탄',board:'fleet-specialists-4.png',panel:'bottom-left',shape:'broad low wedge, fixed rib fins, linked shot and chain reel'},
 {id:'C2-08',kind:'weaver',name:'진주 실잣기 수복선',role:'기계식 제한 수복',board:'fleet-specialists-4.png',panel:'bottom-right',shape:'asymmetric sewn pearl buoyancy cluster and repair arm/spool'},
 {id:'C2-MINI-01',kind:'gatekeeper',name:'적조의 문지기',role:'중간보스 · 관문 호위함',board:'miniboss-gatekeeper.png',panel:'hero-left',shape:'open inverted-U fossil arch, asymmetric capture and cannon decks'}
];
const CONFIG={needle:[18,1.45,1.2],capture:[15,2.7,1.8],shield:[11,2.7,1.7],trumpet:[15,3.4,1.9],conch:[12,2.7,2.0],lantern:[12,2.7,1.7],chain:[15,3.9,1.3],weaver:[14,2.9,2.0],gatekeeper:[24,4.2,2.8]};

export function buildShip(kind){
 const K=createKit(kind),{root,node,add,meshGrid,box,orb,cyl,ring,tube,rod,bolt,twisted,rail,deck,hull,leaf,pod,sail,canopy,cabin,mast,lantern,engine,winch,chain,hook,harpoon,net,coral,stairs}=K;
 const [L,W,D]=CONFIG[kind]||[];if(!L)throw Error('Unknown ship kind '+kind);hull(L,W,D);
 const large=kind==='gatekeeper',deckY=.65;
 // Common craft-language: cabin, working deck, shaped shell shrouds, lower saddles.
 cabin([L*.26,.7,-W*.12],large?3.3:2.2,large?2.5:1.9,large?3.7:2.3);
 stairs('keep',[L*.04,.7,W*.45],[L*.23,2.7,W*.45],large?1:.65);
 const sideCount=kind==='needle'?7:large?10:6;
 for(const side of[-1,1])for(let i=0;i<sideCount;i++){
  const x=(i/(sideCount-1)-.5)*L*.81,zz=side*W*(.67+.16*Math.sin(i/(sideCount-1)*Math.PI)),h=(large?4.8:kind==='needle'?3.5:3.8)*(1+.12*Math.sin(i*2));
  leaf('hull',[x,.04,zz],L/sideCount*.88,h,{rot:[side*.11,side<0?Math.PI:0,(i%2?.21:-.23)],key:i%4===0?'rose':'pearl',holes:i%3===0?2:0,bulge:.38,seed:i});
 }
 // Visible structural saddles connect buoyancy to the keel; no floating ornaments.
 for(const side of[-1,1]){
  if(kind!=='lantern'&&kind!=='weaver')pod([L*.06,-D*.85,side*W*.61],[L*.26,.87+(large?.55:0),.70+(large?.55:0)]);
  for(const x of[-L*.23,L*.23]){rod('buoyancy','brass',[x,-D*.85,side*W*.61],[x,.45,side*W*.73],.065);ring('buoyancy','brass',[x,-D*.65,side*W*.8],.13,.035,[0,Math.PI/2,0]);}
  engine([L*.44,-.05,side*W*.64],large?1.5:kind==='needle'?.75:1.0);
 }
 for(const side of[-1,1])for(const x of[-L*.34,L*.18])lantern([x,-.15,side*(W+.12)],side>0?'cyan':'amber',large?1.35:.9);
 // Raised forecastle with real stairs and an under-deck service gallery.
 deck('hull',[-L*.23,1.13,0],L*.28,W*1.28,false);
 stairs('hull',[-L*.02,.62,-W*.30],[-L*.15,1.18,-W*.30],.55);
 for(const side of[-1,1]){
  const points=Array.from({length:8},(_,j)=>[-L*.31+j*L*.62/7,-D*.02,side*W*.95]);
  for(const p of points)rod('hull','bone',[p[0],-D*.30,p[2]*.83],[p[0],.6,p[2]],.06);
  for(let j=0;j<3;j++){const x=-L*.18+j*L*.18;sail([x,.40,side*(W+.08)],large?1.8:1.25,large?3.0:1.7,[0,side<0?Math.PI:0,side*.08],'wine','triangle');}
 }

 function littleGun(at,s=1){const[x,y,z]=at;box('bastions','wood',[x,y-.26,z],[1.1*s,.24*s,.8*s]);for(const zz of[-.17,.17]){cyl('bastions','metal',[x-.55*s,y,z+zz*s],.075*s,.11*s,1.8*s,[0,0,Math.PI/2],true,12);for(const xx of[-1.4,-.4])ring('bastions','brass',[x+xx*s,y,z+zz*s],.11*s,.025*s,[0,Math.PI/2,0],12);}box('bastions','brass',[x+.18*s,y+.1*s,z+.42*s],[.44*s,.4*s,.28*s]);for(let j=0;j<9;j++)cyl('bastions','edge',[x+.4*s-j*.065*s,y+.16*s,z+.5*s],.022*s,.022*s,.16*s,[Math.PI/2,0,0],false,6);}
 function externalDeck(at,l,w){deck('bastions',at,l,w,false);for(const x of[-l*.32,l*.32]){const p=[at[0]+x,at[1]-.1,at[2]],q=[at[0]+x,-.3,Math.sign(at[2])*W*.55];rod('bastions','bone',q,p,.20);ring('bastions','brass',[p[0],p[1],p[2]],.22,.055,[0,0,Math.PI/2]);}}
 function collarPath(z,pts,rad=.6){const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),frames=curve.computeFrenetFrames(72,false);add(meshGrid(24,72,(u,t)=>{const a=u*Math.PI*2,f=Math.round(t*72),r=rad*(.94+.17*Math.sin(t*5*Math.PI)+.055*Math.sin(t*17*Math.PI))*(1+.045*Math.sin(a*5+t*13));return curve.getPointAt(t).add(frames.normals[f].clone().multiplyScalar(Math.cos(a)*r)).add(frames.binormals[f].clone().multiplyScalar(Math.sin(a)*r*.90)).toArray();}),'bone',z);tube(z,'rose',pts.map(p=>[p[0],p[1]-.12,p[2]+rad*.65]),.05,60,5);for(let j=1;j<9;j++){const t=j/9,p=curve.getPointAt(t),d=curve.getTangentAt(t),g=new T.TorusGeometry(rad*1.05,.075,6,32);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),d));add(g,'brass',z,p.toArray());for(const sign of[-1,1])bolt(z,[p.x,p.y,p.z+sign*rad],.075);}}
 function rigSail(x,y,h,w){mast(x,y,h);sail([x-.25,y+h*.80,.06],w,h*.60,[0,0,-.12],'wine',kind==='needle'?'triangle':'square');}

 switch(kind){
 case 'needle':{
  // Curved pointed keel continues into an unmistakably thin bow, not a box wedge.
  const sh=new T.Shape();sh.moveTo(-L*.81,.2);sh.bezierCurveTo(-L*.58,.6,-L*.25,1,-L*.12,.8);sh.lineTo(-L*.25,-.3);sh.bezierCurveTo(-L*.58,-.45,-L*.75,-.1,-L*.81,.2);
  const g=new T.ExtrudeGeometry(sh,{depth:.22,bevelEnabled:true,bevelSize:.05,bevelThickness:.05,bevelSegments:2});add(g,'bone','keep',[0,0,-.11]);
  rigSail(-2,.8,5.2,5.0);mast(3,.8,4.1);sail([3,4.1,-.06],4.6,3,[0,0,-.23],'wine','triangle');
  deck('keep',[L*.17,2.0,0],L*.28,1.8,false);for(const x of[L*.05,L*.29])for(const s of[-1,1])rod('keep','bone',[x,.7,s*.75],[x,2.0,s*.75],.065);
  for(const s of[-1,1]){const sailId=sail([L*.31,.8,s*W],4.2,2.3,[0,s*.15,s<0?.4:-.4],'wine','triangle');rod('banners','bone',[L*.20,.8,s*W],[L*.48,1.8,s*W*1.8],.065);twisted('banners',[[L*.48,1.8,s*W*1.8],[L*.40,-.2,s*W*1.5],[L*.20,.8,s*W]],.022);}
  externalDeck([-2,1.1,1.7],3,.9);littleGun([-2,1.5,1.7],.9);pod([1.5,1.25,-.6],[3.3,.47,.5]);
  break;}
 case 'capture':{
  // C is open toward the bow and remains open above the capture cradle.
  const path=[[4,1,-.2],[4.4,5.3,-.2],[2.3,8.6,-.2],[-2,9.2,-.2],[-6.4,7.6,-.2],[-8.6,5.7,-.2]];collarPath('dock',path,.43);
  for(let i=0;i<7;i++)leaf('dock',[3.7-i*1.65,7.5+Math.sin(i/6*Math.PI)*1.25,-.18],1.8,3.5,{rot:[0,0,Math.PI/2-.1+i*.14],holes:1,bulge:.35});
  winch([1.7,2.1,2.4],1.65);externalDeck([-4.4,1.0,2.5],5.5,1.5);harpoon([-5.1,1.55,2.55],1.35);
  twisted('dock',[[-8.6,5.7,-.2],[-7.9,4.5,0],[-6.2,2,2.5],[1.8,2.8,2.4]],.065);net('dock',[-4,5.1,-.18],5.3,3.1);chain('dock',[-7.3,7,0],[-7.3,4.4,0],13,.16);hook('dock',[-7.3,4.3,0],.75);
  mast(2.7,1,6.6,-1.1);sail([1,6.7,-1.0],5,3.7,[0,0,.08]);deck('dock',[-4,-.35,-.3],6.0,3.0,false);for(const s of[-1,1])rod('dock','bone',[-6,-.5,s*1.45],[-6,1,s*1.45],.11);
  break;}
 case 'shield':{
  const shieldPivot=node('ScallopShield','keep',[-4.6,1.1,0]);for(let i=-4;i<=4;i++){const a=i*.17;leaf(shieldPivot,[.08*Math.abs(i),2.8-Math.abs(i)*.07,i*.44],1.45,7.0-Math.abs(i)*.22,{rot:[0,-Math.PI/2,-a],key:i%3?'pearl':'rose',holes:3,bulge:.38,seed:i+5});}
  for(const s of[-1,1]){rod('keep','bone',[-4.3,4.1,s*2.6],[-1,.8,s*1.8],.14);rod('keep','brass',[-4.5,2.8,s*1.4],[-2,.8,s*2],.075);}
  externalDeck([-4,2.8,.1],1.7,1.1);littleGun([-4.6,3.05,0],1.1);canopy([1,3.2,0],3.5,2.5,1.1);mast(2.8,.9,4.5,-1.5);sail([2,5,-1.6],2.7,2.2,[0,0,.1]);
  break;}
 case 'trumpet':{
  externalDeck([-1.1,1.6,3.5],7.5,2.9);coral('bastions',[-1.5,3.0,3.8],1.7,[0,.13,1]);
  for(const x of[-3,0,2]){box('bastions','wood',[x,2.05,3.7],[.25,.20,3.4]);rod('bastions','brass',[x,1.7,2.3],[x,2.7,4.3],.075);}cyl('bastions','brass',[-1.5,2.5,3.7],.9,.95,.28);
  canopy([-.5,4.7,-.45],7,3.2,1.6);mast(1.2,1,6,-1.0);sail([1.5,6,-1.2],4,3.4,[0,0,-.1]);
  for(const s of[-1,1])for(let i=0;i<4;i++)leaf('bastions',[-4+i*2,1.4,s*W*.9],1.9,3.0,{holes:2,rot:[s*.1,s<0?Math.PI:0,-.10],key:i%2?'pearl':'rose'});
  break;}
 case 'conch':{
  const shell=node('ConchCradle','bastions',[-1.1,4,0],[0,0,-.46]);
  // Real closed spiral sweep behind the flared conch mouth; no flat spiral decal.
  const turn=3.75*Math.PI,sp=[];for(let i=0;i<=160;i++){const t=i/160,q=t*turn,r=.13*Math.exp(q*.235);sp.push([Math.cos(q)*r,Math.sin(q)*r,0]);}tube(shell,'pearl',sp,.40,180,16);for(let j=0;j<8;j++){const q=j/8*Math.PI*2;leaf(shell,[Math.cos(q)*1.05,.15+Math.sin(q)*1.05,.32],.8,2.4,{rot:[0,0,q+Math.PI/2],holes:0,bulge:.19,key:j%2?'rose':'pearl'});}
  const cup=meshGrid(40,35,(u,v)=>{const a=u*Math.PI*2,r=.62+Math.pow(v,1.7)*1.15;return[Math.cos(a)*r,v*3.2,Math.sin(a)*r];});add(cup,'pearl',shell,[0,0,0]);
  const inner=meshGrid(40,35,(u,v)=>{const a=u*Math.PI*2,r=.52+Math.pow(v,1.7)*1.12;return[Math.cos(a)*r,v*3.2,Math.sin(a)*r];});add(inner,'coralInner',shell);ring(shell,'bone',[0,3.2,0],1.76,.12,[Math.PI/2,0,0],40);cyl(shell,'dark',[0,.25,0],.6,.6,.06);
  for(let j=0;j<12;j++){const a=j/12*Math.PI*2;const pts=[];for(let i=0;i<=24;i++){const v=i/24,r=.64+Math.pow(v,1.7)*1.15;pts.push([Math.cos(a)*r,v*3.2,Math.sin(a)*r]);}tube(shell,j%3?'rose':'bone',pts,.035,28,5);}
  for(const s of[-1,1]){rod('bastions','brass',[-3,.7,s*2],[-1,5.5,s*1.2],.15);ring('bastions','brass',[-1,4,s*1.7],.55,.12);}
  const basket=node('AmmunitionBasket','dock',[1.4,-2.3,3.5]);ring(basket,'brass',[0,.6,0],1.15,.065,[Math.PI/2,0,0]);ring(basket,'brass',[0,-.7,0],.7,.065,[Math.PI/2,0,0]);for(let j=0;j<14;j++){const a=j/14*Math.PI*2;rod(basket,'wood',[Math.cos(a)*.7,-.7,Math.sin(a)*.7],[Math.cos(a)*1.15,.6,Math.sin(a)*1.15],.035);}for(let j=0;j<7;j++)orb(basket,'metal',[Math.cos(j*2.3)*.55,.2+j%2*.3,Math.sin(j*2.3)*.55],[.24,.31,.24]);chain('dock',[1.4,4.3,3.5],[1.4,-1.7,3.5],22,.14);
  mast(2,.8,6,-1);sail([2,6,-1.3],3.8,3.3,[0,0,.15]);winch([2,2,2],.85);pod([3,2,-1],[2.4,1.1,1]);
  break;}
 case 'lantern':{
  const at=[0,6.6,0],rx=6.8,rz=4.6,hh=3.6;
  // A real broad bell envelope with volume and individually stitched gore seams.
  const bell=meshGrid(64,34,(u,v)=>{const a=u*Math.PI*2,p=v*Math.PI*.78,rr=Math.sin(p);return[Math.cos(a)*rx*rr,hh*Math.cos(p),Math.sin(a)*rz*rr];});add(bell,'cloth','buoyancy',at);
  for(let j=0;j<14;j++){const a=j/14*Math.PI*2,pts=[];for(let i=0;i<=36;i++){const p=i/36*Math.PI*.78;pts.push([Math.cos(a)*rx*Math.sin(p)*1.01,at[1]+hh*Math.cos(p),Math.sin(a)*rz*Math.sin(p)*1.01]);}tube('buoyancy',j%2?'wine':'rope',pts,.048,40,5);for(let i=4;i<31;i+=2){const p=pts[i];rod('buoyancy','wine',[p[0]-.045,p[1]+.025,p[2]],[p[0]+.045,p[1]-.025,p[2]],.026,4);}}
  for(let j=0;j<12;j++){const a=j/12*Math.PI*2;leaf('buoyancy',[Math.cos(a)*rx*1.015,6.9,Math.sin(a)*rz*1.015],1.9,3.8,{rot:[-.24,-a+Math.PI/2,0],holes:1,bulge:.40});rod('buoyancy','brass',[Math.cos(a)*rx*.56,4.4,Math.sin(a)*rz*.56],[Math.cos(a)*W*.7,.7,Math.sin(a)*W*.7],.035);}
  for(const side of[-1,1])sail([side*3.4,9.0,side*1.0],4.8,3.3,[0,side*.2,side*.15],'wine','triangle');
  canopy([0,4.0,0],5,3.2,1.8);box('machinery','dark',[-.5,1.5,.3],[2.3,1.7,2]);for(const s of[-1,1])for(let j=0;j<4;j++){box('machinery','amber',[-1.2+j*.45,1.65,s*1.32],[.22,.7,.05]);rod('machinery','brass',[-1.2+j*.45,1.2,s*1.36],[-1.2+j*.45,2.1,s*1.36],.03);}
  orb('machinery','brass',[1.2,-.2,3],[.85,1.0,.85]);coral('bastions',[-1.6,1.8,2.4],.6,[-1,0,.25]);for(const s of[-1,1]){const pts=[[1.2,-.2,3],[-.2,-.5,s*3.9],[-2,-.1,s*4.0],[-2.3,1.8,2.4]];tube('machinery','wine',pts,.11,30,8);tube('machinery','brass',pts,.035,30,6);ring('machinery','brass',[-.2,-.5,s*3.9],.22,.045);}
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;chain('banners',[Math.cos(a)*4.7,3.5,Math.sin(a)*3.0],[Math.cos(a)*4.9,-.8-i%3*.3,Math.sin(a)*3.1],15,.10);lantern([Math.cos(a)*4.9,-1.1-i%3*.3,Math.sin(a)*3.1],i%2?'amber':'cyan',.9);}
  break;}
 case 'chain':{
  // Fixed wing-rib spread is broad in plan view, different from the needle scout.
  for(const s of[-1,1])for(let j=0;j<4;j++){
   const x=-5+j*2.2,tip=[x-1,3.1,s*(W+2.0-j*.18)];leaf('keep',[x,1.9,s*(W+.25)],1.4,4.8-j*.3,{rot:[s*.33,s<0?Math.PI:0,-.38],holes:1,bulge:.24});rod('keep','bone',[x,.65,s*W*.5],tip,.10);twisted('banners',[tip,[x+1.5,1.6,s*W],[x,.65,s*W*.5]],.025);
  }
  winch([-.7,1.8,0],1.4);externalDeck([-5.2,1.0,0],3.3,3.8);for(const s of[-1,1]){orb('bastions','metal',[-6.0,1.8,s*.85],[.46,.46,.46],18);ring('bastions','brass',[-6,1.8,s*.85],.47,.035,[0,Math.PI/2,0]);for(const z of[-1.3,1.3])rod('bastions','brass',[-7,1.3,s*.85+z*.2],[-3.6,1.3,s*.85+z*.2],.065);}chain('bastions',[-6,1.8,-.45],[-6,1.8,.45],7,.12);
  mast(1.7,.8,5);sail([1.1,5,0],5.8,3,[0,0,-.2],'wine','triangle');canopy([3,3,0],3.2,2.5,.8);break;}
 case 'weaver':{
  // Sewn pearl bladders in their own asymmetric load-bearing cradle.
  for(const [i,p]of [[0,[3,4.0,-2.3]],[1,[3.8,6.3,-1.8]],[2,[2.9,8.4,-1.6]]]){pod(p,[1.6,1.6,1.5],'buoyancy',i%2?'rose':'pearl');for(const side of[-1,1])tube('buoyancy','bone',[[p[0]-1.5,p[1],p[2]+side*.7],[p[0],p[1]-1.5,p[2]+side*1.2],[p[0]+1.5,p[1],p[2]+side*.7]],.065,20,6);rod('buoyancy','brass',[2,1,-1.2],[p[0],p[1]-1.4,p[2]],.08);}
  const arm=[[1,1.1,2.6],[1,5.8,3.3],[-3.8,7.2,4.2],[-8.5,5.4,4.2]];for(let i=0;i<arm.length-1;i++){rod('dock','brass',arm[i],arm[i+1],.14);const a=arm[i],b=arm[i+1];rod('dock','dark',[a[0],a[1]-.22,a[2]-.2],[b[0],b[1]-.22,b[2]-.2],.075);for(let j=1;j<5;j++){const u=j/5,p=a.map((v,k)=>v+(b[k]-v)*u);ring('dock','brass',p,.18,.035);}}for(const p of arm)ring('dock','brass',p,.38,.11);const end=arm.at(-1);for(const s of[-1,1])tube('dock','bone',[end,[end[0]-.7,end[1]-.3,end[2]+s*.4],[end[0]-.9,end[1]-.9,end[2]+s*.19]],.09,16,6);
  winch([-.8,2.2,2.0],1.1);const spool=node('CanvasSpool','dock',[-1,2.5,0]);cyl(spool,'cloth',[0,0,0],1.2,1.2,2.7,[Math.PI/2,0,0]);for(const z of[-1.45,1.45])cyl(spool,'woodLight',[0,0,z],1.45,1.45,.13,[Math.PI/2,0,0]);for(let i=0;i<32;i++)ring(spool,i%3?'rope':'cloth',[0,0,-1.3+i*2.6/31],1.21,.022);tube('dock','cloth',[[-1,2.5,0],[-1,5,2],[-3.1,5.8,3.7],end],.05,30,5);
  canopy([-.6,4,-.4],6,3,1.1);sail([-.6,3.6,2.4],4,2.8,[0,0,.05]);externalDeck([-2,1.1,3],5,1.4);stairs('dock',[-4,.7,2.5],[-1,2.2,2.5],.7);net('dock',[3,3.3,2.7],2.5,2.6);break;}
 case 'gatekeeper':{
  const path=[[-7.0,1.3,0],[-7.2,6.1,0],[-5.3,11.3,0],[-1.6,14,0],[3.0,13.0,0],[6.5,8.6,0],[7.0,1.1,0]];collarPath('bell_tower',path,.72);
  for(let i=0;i<10;i++){const t=i/9,q=new T.CatmullRomCurve3(path.map(p=>new T.Vector3(...p))).getPointAt(.06+t*.88);leaf('bell_tower',[q.x,q.y+.15,.24],2.6,4.4,{rot:[0,0,(t-.5)*-2.7],holes:2,bulge:.48,key:i%3?'pearl':'rose'});}
  // Two visible independently mounted outboard branches, with stout parent beams.
  externalDeck([-7.0,1.5,3.1],7.0,2.8);winch([-7,3.1,3.0],2.0);harpoon([-9,3,3.0],1.55);
  const crane=[[-5,1.6,2.7],[-5.7,6.7,2.6],[-8.7,7.7,2.4],[-11.4,6.2,2.3]];collarPath('dock',crane,.30);chain('dock',[-11.4,6.2,2.3],[-11.4,3.4,2.3],15,.15);hook('dock',[-11.4,3.2,2.3],.9);twisted('dock',[[-11.4,6.2,2.3],[-10.8,4.9,2.8],[-7,4.1,3]],.07);
  externalDeck([1.2,2.0,4.5],8,3.3);coral('bastions',[-.5,4.0,4.8],1.8,[-.3,.12,1]);coral('bastions',[4.0,3.0,4.7],.85,[0,.1,1]);
  for(const side of[-1,1]){for(const x of[-3.9,3.8])sail([x,11.6,side*.85],2.8,5.4,[0,side*.04,x<0?.14:-.14]);for(const x of[-6,6]){leaf('hull',[x,-2,side*3.5],2.4,5.4,{rot:[side*.12,side<0?Math.PI:0,x<0?.17:-.17],holes:3,bulge:.4});lantern([x,-4,side*3.6],'cyan',1.6);}}
  deck('keep',[3.2,3.3,-.25],7.0,5.5,false);for(const x of[.7,3.1,5.6])for(const s of[-1,1])rod('keep','bone',[x,.7,s*2.4],[x,3.3,s*2.4],.15);
  canopy([5.4,5.0,-1.0],6.0,3.5,1.4);cabin([5.0,3.7,-1.3],3,2.3,3);stairs('keep',[2,1,0],[5,3.8,0],1.0);
  pod([-5,-3.3,0],[4.0,1.3,2.4]);pod([5,-3.2,0],[3.8,1.3,2.5]);net('dock',[-7,2,-1.3],4.0,4);break;}
 }
 // Close-view material/working-life detail: storage, ladders, valves, cleats.
 for(let i=0;i<(large?12:6);i++){
  const x=-L*.29+i*L*.57/(large?11:5),side=i%2?1:-1,z=side*W*.59;box('hull','woodLight',[x,.83,z],[.36,.34,.42]);for(const dx of[-.15,.15])rod('hull','brass',[x+dx,.68,z-.22],[x+dx,1.02,z-.22],.022);ring('hull','rope',[x,1.06,z],.10,.025,[Math.PI/2,0,0],14);
 }
 for(const side of[-1,1]){const x=L*.34,z=side*W*.57;rod('machinery','brass',[x,.8,z],[x,2.1,z],.07);ring('machinery','brass',[x,1.8,z+.1],.18,.028);for(let i=0;i<8;i++){const a=i*Math.PI/4;rod('machinery','brass',[x,1.8,z+.1],[x+Math.cos(a)*.16,1.8+Math.sin(a)*.16,z+.1],.013);}}
 const result=K.finish();root.userData.artReference=ROSTER.find(r=>r.kind===kind).board;root.userData.functionalHierarchy='Root ship with visual zones and independent device pivots; not a gameplay parent/socket tree';return result;
}
