import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Chapter two is built from scratch: living reef, fossil ribs and a nautilus crown.
// No chapter-one geometry is imported. The open harbour is a real empty volume.
export function buildFortress(){
 const root=new T.Group();root.name='Cloudstitch_Crown_of_the_Red_Tide';
 const zones=[['hull','포식자의 산호초','찢긴 암초와 뼈 용골'],['buoyancy','하늘해파리 부력막','늘어진 진주빛 막과 해초 뿌리'],['keep','진주층 거주 테라스','비대칭 패각 회랑과 거주 구역'],['bell_tower','나선 패각 왕관','거대한 입체 앵무조개와 성장선'],['bastions','붉은 산호 포대','속이 빈 산호 나팔 포신과 가지 방벽'],['dock','생체발광 항구','포식자의 관문과 잔교·청록 항로'],['machinery','뼈 기중기와 인양망','대형 골격 기중기와 포획선'],['banners','해초 직물과 장식','찢긴 천·진주 장신구·봉제 무늬']].map(([id,name_ko,description])=>({id,nodeName:id,name_ko,description}));
 for(const z of zones){const g=new T.Group();g.name=z.id;root.add(g);}
 const C={bone:'#d9c9ac',boneShade:'#ad9586',pearl:'#e4cdbc',pearlPink:'#d4b2b1',pearlBlue:'#a0b2bc',coral:'#a94137',coralLight:'#d16b4b',coralDark:'#73313c',reef:'#4c414f',reefDark:'#262a39',wood:'#816047',woodLight:'#ad865e',rope:'#968165',kelp:'#4d6353',kelpDark:'#384b48',cloth:'#cfc0ad',wine:'#75434c',gold:'#bda078',window:'#ffb86c',cyan:'#68d4c8',deepwater:'#173e50',water:'#286b73'};
 const bins=new Map(),mats=new Map();let count=0;
 const V=p=>new T.Vector3(...p),rand=n=>{const q=Math.sin(n*91.317+19.73)*43758.5453;return q-Math.floor(q);};
 function add(g,key,zone,p=[0,0,0],r=[0,0,0]){
  if(g.index){const original=g;g=g.toNonIndexed();original.dispose();}
  g.applyMatrix4(new T.Matrix4().compose(V(p),new T.Quaternion().setFromEuler(new T.Euler(...r)),new T.Vector3(1,1,1)));
  if(!g.attributes.normal)g.computeVertexNormals();const ps=g.attributes.position,ns=g.attributes.normal,colors=new Float32Array(ps.count*3),base=new T.Color(C[key]);
  for(let i=0;i<ps.count;i++){
   const x=ps.getX(i),y=ps.getY(i),z=ps.getZ(i),light=ns.getX(i)*-.48+ns.getY(i)*.74+ns.getZ(i)*.48;
   const luminous=/cyan|window|water$/.test(key),band=luminous?1:(.62+.38*Math.max(0,light));
   const brush=.97+.035*Math.sin(x*3+y*.5+Math.sin(z*2)*.8)+.02*Math.sin(y*12+z*3);
   const nacre=/pearl|bone/.test(key)?Math.sin(x*.6+y*.31+z*.5)*.045:0;
   colors[i*3]=Math.min(1,base.r*band*brush*(1+nacre));colors[i*3+1]=Math.min(1,base.g*band*brush);colors[i*3+2]=Math.min(1,base.b*band*brush*(1-nacre));
  }
  for(const a of Object.keys(g.attributes))if(!['position','normal'].includes(a))g.deleteAttribute(a);
  g.setAttribute('color',new T.BufferAttribute(colors,3));const k=zone+'/'+key;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(g);count++;
 }
 function box(zone,key,x,y,z,w,h,d,ry=0,rz=0){add(new T.BoxGeometry(w,h,d,Math.max(1,Math.ceil(w)),1,Math.max(1,Math.ceil(d))),key,zone,[x,y,z],[0,ry,rz]);}
 function orb(zone,key,x,y,z,sx,sy,sz,seg=12){const g=new T.SphereGeometry(1,seg,8);g.scale(sx,sy,sz);add(g,key,zone,[x,y,z]);}
 function tube(zone,key,points,r=.1,steps=18,sides=6){add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(V)),steps,r,sides,false),key,zone);}
 function rod(zone,key,a,b,r=.08,sides=6){const d=V(b).sub(V(a)),g=new T.CylinderGeometry(r,r,d.length(),sides);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate(...V(a).add(V(b)).multiplyScalar(.5).toArray());add(g,key,zone);}
 // Tapered organically curved horn, closed ends, non-circular cross sections.
 function horn(zone,key,points,r=.8,steps=24,sides=9,flat=1){
  const curve=new T.CatmullRomCurve3(points.map(V)),frames=curve.computeFrenetFrames(steps,false),ps=[],idx=[];
  for(let i=0;i<=steps;i++){const t=i/steps,p=curve.getPointAt(t),q=r*Math.pow(1-t,.72)+.015;
   for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,n=frames.normals[i].clone().multiplyScalar(Math.cos(a)*q),b=frames.binormals[i].clone().multiplyScalar(Math.sin(a)*q*flat);ps.push(...p.clone().add(n).add(b).toArray());}}
  for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j;idx.push(a,a+sides+1,a+1,a+1,a+sides+1,a+sides+2);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setIndex(idx);g.computeVertexNormals();add(g,key,zone);
 }
 function curveArc(rx,rz,y,a,b,n=40){return Array.from({length:n+1},(_,i)=>{const q=a+(b-a)*i/n;return[Math.cos(q)*rx,y,Math.sin(q)*rz];});}
 function crescent(zone,key,y,rx,rz,inner,a=2.15,b=7.27,thick=.5){
  const ps=[],idx=[],N=60,M=5;
  for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){const t=i/N,q=a+(b-a)*t,f=inner+(1-inner)*j/M;ps.push(Math.cos(q)*rx*f,y+.15*Math.sin(q*5)*f,Math.sin(q)*rz*f);}
  for(let j=0;j<M;j++)for(let i=0;i<N;i++){const k=j*(N+1)+i;idx.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setIndex(idx);g.computeVertexNormals();add(g,key,zone);
  tube(zone,'boneShade',curveArc(rx,rz,y-.12,a,b),thick,64,8);tube(zone,'bone',curveArc(rx*inner,rz*inner,y-.12,a,b),thick*.8,64,8);
 }
 // Huge layered crescent reef. The front wedge remains open to a luminous harbour.
 for(let layer=0;layer<4;layer++){
  const rx=29-layer*.9,rz=23-layer*.7,y=2-layer*1.4;crescent('hull',layer%2?'reef':'reefDark',y,rx,rz,.42,2.03,7.4,1.2);
  for(let i=0;i<28;i++){const a=2.03+i/27*5.37,rr=1+rand(i+layer*30)*.05;
   horn('hull',i%4?'reef':'boneShade',[[Math.cos(a)*rx,2,Math.sin(a)*rz],[Math.cos(a)*rx*rr,-4-rand(i)*4,Math.sin(a)*rz*rr],[Math.cos(a)*(rx-3),-8-rand(i+2)*5,Math.sin(a)*(rz-2)]],.9+rand(i+3),12,7);}
 }
 // Nautilus crown: a true closed swept shell, not a spiral drawn on a billboard.
 const center=[5.5,34,-8.5],turns=4.35*Math.PI,segments=220,sides=32,ps=[],idx=[];
 const shellPoint=(t,a,offset=0)=>{const q=t*turns,r=.64*Math.exp(q*.232),th=.22+r*.60,p=[Math.cos(q)*r,Math.sin(q)*r];
  return[center[0]+p[0]+Math.cos(q)*Math.cos(a)*(th+offset),center[1]+p[1]+Math.sin(q)*Math.cos(a)*(th+offset),center[2]+Math.sin(a)*(th+offset)*1.08];};
 for(let i=0;i<=segments;i++)for(let j=0;j<=sides;j++)ps.push(...shellPoint(i/segments,j/sides*Math.PI*2));
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const k=i*(sides+1)+j;idx.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}
 const shell=new T.BufferGeometry();shell.setAttribute('position',new T.Float32BufferAttribute(ps,3));shell.setIndex(idx);shell.computeVertexNormals();add(shell,'pearl','bell_tower');
 // Fine curved growth ribs and nacre bands follow the shell's real volume.
 for(let i=12;i<=95;i++){const t=i/95;const ring=Array.from({length:29},(_,j)=>shellPoint(t,j/28*Math.PI*2,.025));tube('bell_tower',i%5?'boneShade':'pearlPink',ring,i%5?.025:.065,28,5);}
 for(const phi of [.2,1.0,1.65,2.5,3.1,4.7,5.6])tube('bell_tower',phi<3?'pearlBlue':'pearlPink',Array.from({length:121},(_,i)=>shellPoint(i/120,phi,.035)),.045,120,5);
 const mouthCenter=(()=>{const q=turns,r=.64*Math.exp(q*.232);return[center[0]+Math.cos(q)*r,center[1]+Math.sin(q)*r,center[2]];})();
 orb('bell_tower','reefDark',...mouthCenter,6,7,6); // Inner shadow has actual depth behind a thick rim.
 tube('bell_tower','bone',Array.from({length:49},(_,i)=>shellPoint(1,i/48*Math.PI*2,.1)),.18,48,8);

 function rail(zone,points,height=.85){
  tube(zone,'rope',points.map(p=>[p[0],p[1]+height,p[2]]),.065,points.length*2,5);
  tube(zone,'rope',points.map(p=>[p[0],p[1]+height*.43,p[2]]),.045,points.length*2,5);
  for(const p of points)rod(zone,'bone',[p[0],p[1]-.15,p[2]],[p[0],p[1]+height+.13,p[2]],.055);
 }
 function canopy(x,y,z,w,d,h,ry=0){
  const p=[],ids=[],nx=14,nz=12;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const u=i/nx,v=j/nz,xx=(u-.5)*w,zz=(v-.5)*d;
   const yy=h*Math.pow(Math.sin(u*Math.PI),.6)*(.7+.3*Math.cos((v-.5)*Math.PI))+.25*Math.sin(v*9+u*4);
   p.push(xx,yy,zz);}
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*(nx+1)+i;ids.push(k,k+1,k+nx+1,k+1,k+nx+2,k+nx+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ids);g.computeVertexNormals();add(g,'pearlPink','keep',[x,y,z],[0,ry,0]);
  const world=(xx,yy,zz)=>[x+xx*Math.cos(ry)+zz*Math.sin(ry),y+yy,z-xx*Math.sin(ry)+zz*Math.cos(ry)];
  for(let j=0;j<=8;j++){const zz=(j/8-.5)*d;tube('keep',j%2?'boneShade':'bone',Array.from({length:17},(_,i)=>{const u=i/16;return world((u-.5)*w,h*Math.pow(Math.sin(u*Math.PI),.6)*(.7+.3*Math.cos(zz/d*Math.PI))+.1,zz);}),.045,20,5);}
  for(const side of [-1,1])for(const a of [-.4,.4])horn('keep','bone',[world(side*w*.5,-2,a*d),world(side*w*.52,.3,a*d),world(side*w*.4,h*.5,a*d)],.15,12,6);
 }
 function dwelling(x,y,z,w,d,h,ry=0,seed=0){
  // Shell-chamber facade, irregular ivory frames, tiny luminous scale cues.
  orb('keep',seed%2?'boneShade':'pearl',x,y+h*.42,z,w*.52,h*.57,d*.52,12);
  const p=(xx,yy,zz)=>[x+xx*Math.cos(ry)+zz*Math.sin(ry),yy,z-xx*Math.sin(ry)+zz*Math.cos(ry)];
  for(let row=0;row<2;row++)for(let col=0;col<Math.floor(w/.85);col++){
   const xx=-w*.38+col*.85,q=p(xx,y+.55+row*1.2,d*.5+.04);
   orb('keep','reefDark',...q,.23,.49,.1,8);orb('keep',(row+col+seed)%3?'window':'cyan',q[0],q[1],q[2]+.07,.12,.36,.06,8);
   horn('keep','bone',[p(xx-.3,q[1]-.55,d*.5+.05),p(xx-.29,q[1]+.3,d*.5+.06),p(xx,q[1]+.75,d*.5+.05)],.07,12,5);
  }
  canopy(x,y+h,z,w*1.15,d*1.12,1.2+w*.13,ry);
  const front=p(0,y-.1,d*.5+.7);box('keep','wood',...front,w+1,.17,1.5,ry);
  const path=Array.from({length:Math.ceil(w/.45)+1},(_,i)=>p(-w*.5+i*w/Math.ceil(w/.45),y,d*.5+1.4));rail('keep',path);
  for(const side of [-1,1])rod('keep','bone',p(side*w*.4,y-1.5,d*.4),p(side*w*.5,y,d*.5+1.4),.11);
 }
 // Pearl terraces form a rising asymmetrical harbour city, never conventional towers.
 for(const [y,rx,rz,inner,a,b] of [[7,27,21,.68,2.0,7.43],[12,24,18.5,.71,2.1,7.25],[17,21,16,.7,2.25,7.0],[22,17.5,13,.68,2.25,6.9],[27,13.5,10,.62,2.5,6.6],[31,9.5,7.5,.54,2.6,6.7]]){
  crescent('keep','pearl',y,rx,rz,inner,a,b,.3);rail('keep',curveArc(rx,rz,y,a,b,Math.ceil(rx*2.5)));
  rail('keep',curveArc(rx*inner,rz*inner,y,a,b,Math.ceil(rx*1.7)),.65);
  for(let i=0;i<Math.floor(rx*.58);i++){
   const q=a+(b-a)*(i+.5)/Math.floor(rx*.58),x=Math.cos(q)*rx*.84,z=Math.sin(q)*rz*.84;
   dwelling(x,y+.4,z,2.6+rand(i+y)*1.5,2.3+rand(i+7)*1.2,2.2+rand(i+y*2)*1.5,-q+Math.PI/2,i+y);
  }
  for(let i=0;i<Math.ceil(rx/2);i++){const q=a+(b-a)*i/Math.ceil(rx/2),x=Math.cos(q)*rx,z=Math.sin(q)*rz;
   horn('keep','bone',[[x,y-5,z],[x*.95,y-1,z*.95],[x*.82,y+1,z*.82]],.4,16,7);}
 }
 // Strong asymmetrical rib cage frames the giant harbour without covering its void.
 for(const [x,z,h,lean] of [[-27,10,29,8],[-22,17,23,6],[-16,23,18,4],[23,12,22,-7],[28,2,28,-8],[22,-10,31,-7],[-24,-8,24,6],[-14,-19,28,3]]){
  horn('hull','bone',[[x,-3,z],[x*1.04,7,z],[x,18,z-1],[x+lean,h,z-3]],1.5,34,11,.62);
  tube('hull','boneShade',[[x+.2,0,z+.5],[x+.2,10,z+.5],[x+lean*.3,19,z-.5]],.09,28,5);
  for(let i=0;i<8;i++){const yy=3+i*1.4;orb('hull','gold',x+.5,yy,z+.4,.12,.1,.12,8);}
 }
 // Lower jaw is deliberately curved and uneven, with actual individually swept teeth.
 const jaw=Array.from({length:51},(_,i)=>{const a=.08*Math.PI+i/50*.84*Math.PI;return[Math.cos(a)*26,2.3-Math.sin(a)*1.4,Math.sin(a)*24];});
 tube('dock','boneShade',jaw,.72,64,10);
 for(let i=0;i<28;i++){const a=.1*Math.PI+i/27*.8*Math.PI,x=Math.cos(a)*26,z=Math.sin(a)*24,h=3.5+rand(i+9)*6;
  horn('dock',i%4?'bone':'pearlPink',[[x,1,z],[x*.98,h*.7,z-.6],[x*.94,h,z-1.5]],.55+rand(i)*.4,18,8,.7);}
 // Luminous inner basin and stylised rings are geometry, not the review background.
 const basin=new T.CircleGeometry(14.5,80);add(basin,'deepwater','dock',[0,3.1,6],[-Math.PI/2,0,0]);
 for(let i=0;i<18;i++){const r=2+i*.65,pts=Array.from({length:65},(_,j)=>{const a=j/64*Math.PI*2;return[Math.cos(a)*r,3.13,6+Math.sin(a)*r*.62];});tube('dock',i%3?'water':'cyan',pts,.02+i*.001,64,4);}
 for(const [x,y,z] of [[-8,10,8],[8,10,5],[-3,17,-5],[13,18,-1],[0,25,-8]]){
  orb('dock','cyan',x,y,z,.35,1.4,.35);horn('dock','bone',[[x-.6,y-1,z],[x-.7,y+.8,z],[x,y+2,z]],.12,12,6);
 }
 // Timber piers, tiny moored craft and curved bone bridges around the abyssal harbour.
 function pier(x,y,z,w,d,ry=0,zone='dock'){
  box(zone,'wood',x,y,z,w,.2,d,ry);const p=(a,b,c)=>[x+a*Math.cos(ry)+c*Math.sin(ry),y+b,z-a*Math.sin(ry)+c*Math.cos(ry)];
  for(let i=0;i<Math.ceil(d/.35);i++)rod(zone,'woodLight',p(-w/2,.13,-d/2+i*.35),p(w/2,.13,-d/2+i*.35),.022);
  for(const side of [-1,1]){const pts=Array.from({length:Math.ceil(d/.6)+1},(_,i)=>p(side*w/2,.1,-d/2+i*d/Math.ceil(d/.6)));rail(zone,pts);}
  for(const side of [-1,1])horn(zone,'bone',[p(side*w/2,-4,-d/2),p(side*w/2,-1,d*.1),p(side*w/2,.1,d/2)],.25,18,6);
 }
 for(const a of [[-12,5,16,3,12,.45],[12,7,14,4,16,-.5],[-10,10,4,2.2,9,-.3],[10,13,-2,2.5,10,.4],[18,10,8,3,11,-.7]])pier(...a);
 for(const [x,y,z,rx,rz] of [[-5,6.3,10,2.3,.65],[5,5,9,2,.55],[-3,7,2,1.7,.5]]){
  orb('dock','wood',x,y,z,rx,.55,rz);orb('dock','cloth',x,y+1.3,z,rx*.7,.75,rz*.85);rod('dock','rope',[x-rx,y+.2,z],[x+rx,y+.2,z],.06);
 }

 // Branching reef artillery: organic hollow trumpet barrels with flared irregular mouths.
 function trumpet(x,y,z,dir,scale=1){
  const points=[[0,0,0],[0,.5,1.3],[.25,.8,3],[.3,1,5.3]],curve=new T.CatmullRomCurve3(points.map(V));
  const steps=32,S=22,frames=curve.computeFrenetFrames(steps,false),p=[],ids=[];
  for(let layer=0;layer<2;layer++)for(let i=0;i<=steps;i++){
   const t=i/steps,c=curve.getPointAt(t),r=(.55+1.55*Math.pow(t,4))*(layer? .82:1);
   for(let j=0;j<=S;j++){const a=j/S*Math.PI*2,q=r*(1+.12*Math.sin(a*5+t*2)*Math.pow(t,5)),pt=c.clone().addScaledVector(frames.normals[i],Math.cos(a)*q).addScaledVector(frames.binormals[i],Math.sin(a)*q);p.push(pt.x*scale,pt.y*scale,pt.z*scale);}}
  const L=(steps+1)*(S+1);
  for(let layer=0;layer<2;layer++)for(let i=0;i<steps;i++)for(let j=0;j<S;j++){const k=layer*L+i*(S+1)+j;const tri=[k,k+S+1,k+1,k+1,k+S+1,k+S+2];ids.push(...(layer?tri.reverse():tri));}
  for(let j=0;j<S;j++){const k=steps*(S+1)+j;ids.push(k,k+1,k+L,k+1,k+L+1,k+L);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ids);g.computeVertexNormals();add(g,'coral','bastions',[x,y,z],[0,dir,0]);
  const w=(a,b,c)=>[x+(a*Math.cos(dir)+c*Math.sin(dir))*scale,y+b*scale,z+(-a*Math.sin(dir)+c*Math.cos(dir))*scale];
  for(let j=0;j<8;j++){const a=j/8*Math.PI*2;tube('bastions','coralLight',Array.from({length:17},(_,i)=>{const t=i/16,r=.55+1.55*Math.pow(t,4);return w(.2+Math.cos(a)*r,.7+Math.sin(a)*r,5.3*t);}),.045,24,5);}
  orb('bastions','coralDark',...w(0,.5,2.8),.45*scale,.45*scale,.15*scale);
  horn('bastions','coralDark',[[x,y-4,z],[x,y-1,z],[x+Math.sin(dir)*2,y+.5,z+Math.cos(dir)*2]],.8*scale,20,8);
 }
 for(const a of [[-25,12,7,-1.1,1.25],[-18,18,-3,-1.3,.95],[23,15,1,1.2,1.25],[20,21,-9,1.4,1.0],[-17,8,20,-.7,1.0],[17,9,19,.7,1.0]])trumpet(...a);
 function coralBranch(x,y,z,len,seed,depth=0,dir=0){
  const dx=Math.cos(dir)*len*.48,dz=Math.sin(dir)*len*.45,top=[x+dx,y+len,z+dz];
  horn('bastions',depth%2?'coralLight':'coral',[[x,y,z],[x+dx*.15,y+len*.5,z+dz*.3],top],len*.11,12,7);
  if(depth<2)for(let i=0;i<3;i++){const t=.4+i*.22;coralBranch(x+dx*t,y+len*t,z+dz*t,len*(.43+rand(seed+i)*.14),seed*3+i+1,depth+1,dir+(i-1)*1.25+.5);}
 }
 for(const [x,y,z,l,s] of [[-16,30,-13,7.5,1],[9,41,-11,8,2],[18,36,-8,6,3],[21,26,-5,7,4],[-22,15,-8,7,5],[-25,9,2,5,6],[25,10,8,5,7],[-9,30,-15,7,8],[3,41,-10,5,9],[-23,5,15,4,10],[20,7,18,4,11]])coralBranch(x,y,z,l,s,0,s*.8);

 // Skeleton cranes with actual hanging net baskets and one captured miniature craft.
 for(const [x,z,y,side] of [[-27,3,20,-1],[22,-4,23,1]]){
  horn('machinery','bone',[[x,2,z],[x+side*2,y*.65,z],[x+side*6,y,z],[x+side*11,y-1,z+1]],1.1,40,10,.7);
  const end=[x+side*11,y-1,z+1];
  for(const dz of [-.7,.7])tube('machinery','rope',[[x,6,z+dz],[x+side*6,y+1,z+dz],[...end.slice(0,2),end[2]+dz]],.075,24,6);
  for(const dx of [-2.2,2.2])for(const dz of [-1,1])tube('machinery','rope',[[...end],[end[0]+dx,y-8,end[2]+dz]],.055,12,5);
  orb('machinery','wood',end[0],y-8,end[2],3.1,1.1,1.15);orb('machinery','cloth',end[0],y-6.5,end[2],2.7,1.4,.9);
  for(let i=0;i<13;i++){const a=i/13*Math.PI*2;const xx=end[0]+Math.cos(a)*3.4,zz=end[2]+Math.sin(a)*1.4;
   tube('machinery','rope',[[xx,y-6.6,zz],[xx,y-8.5,zz],[end[0],y-9.5,end[2]]],.035,12,4);}
  for(const yy of [y-7,y-8,y-8.8])tube('machinery','rope',Array.from({length:41},(_,i)=>{const a=i/40*Math.PI*2;return[end[0]+Math.cos(a)*3.4,yy,end[2]+Math.sin(a)*1.4];}),.035,40,4);
 }
 // Great translucent-looking (opaque painted) jellyfish veils, torn into streamers.
 function veil(zone,key,x,y,z,w,h,ry=0,seed=0){
  const p=[],ids=[],nx=18,ny=24;
  const pt=(u,t)=>{const xx=(u-.5)*w*(1-.3*t),yy=-h*t+(t>.7?Math.pow((t-.7)/.3,2)*(.8+Math.sin(u*21+seed)*1.2):0),zz=.5*Math.sin(u*7+t*5)+.22*Math.sin(t*13+seed);
   return[x+Math.cos(ry)*xx+Math.sin(ry)*zz,y+yy,z-Math.sin(ry)*xx+Math.cos(ry)*zz];};
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)p.push(...pt(i/nx,j/ny));
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){if(j>20&&(i+seed)%5===0)continue;const k=j*(nx+1)+i;ids.push(k,k+1,k+nx+1,k+1,k+nx+2,k+nx+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ids);g.computeVertexNormals();add(g,key,zone);
  for(const u of [.03,.28,.51,.75,.97])tube(zone,key==='wine'?'gold':'pearlBlue',Array.from({length:26},(_,j)=>pt(u,j/25)),.035,28,5);
  tube(zone,'rope',Array.from({length:20},(_,i)=>pt(i/19,0)),.07,20,5);
  if(zone==='banners')for(let j=0;j<15;j++){const a=pt(.08,j/16),b=pt(.12,(j+.5)/16);rod(zone,'bone',a,b,.018,4);}
 }
 for(let i=0;i<18;i++){const a=2.0+i/17*5.4,x=Math.cos(a)*24,z=Math.sin(a)*18;
  veil('buoyancy',i%3?'pearlPink':'pearlBlue',x,-2,z,3.6+rand(i)*3,7+rand(i+4)*12,-a+Math.PI/2,i);
  for(let j=0;j<3;j++)tube('buoyancy',j%2?'kelp':'kelpDark',[[x+j*.3,-2,z],[x+j*.4,-7,z+.5],[x+Math.sin(i+j),-13-rand(i+j)*10,z+2]],.10+j*.02,22,5);
 }
 for(const [x,y,z,w,h,ry] of [[-24,27,7,3,12,-.4],[18,32,-5,3.5,12,.4],[-12,34,-2,3,10,-.3],[9,25,10,2.5,12,.2],[-17,17,17,3.7,11,0],[23,17,12,3.2,10,.4]])veil('banners','wine',x,y,z,w,h,ry,Math.round(y));
 for(const a of [[-18,22,10,4,8,-.25],[15,25,1,5,10,.2],[-2,29,-4,3.5,8,0]])veil('banners','cloth',...a,4);
 // Pearl jewellery and hanging shell talismans: a different culture's ornament.
 for(let i=0;i<55;i++){const a=2.1+i/54*5.1,x=Math.cos(a)*27,z=Math.sin(a)*21,y=5+rand(i)*6;
  rod('banners','rope',[x,y+2,z],[x,y,z],.035);orb('banners',i%3?'pearl':'cyan',x,y,z,.18,.3,.13,8);
  for(let j=0;j<3;j++)orb('banners',j%2?'gold':'pearlPink',x,y+.5+j*.4,z,.12,.12,.12,8);
 }
 // Small humanoid silhouettes deliberately communicate the city's colossal scale.
 for(const [x,y,z] of [[-12,5.2,20],[12,7.2,18],[14,7.2,19],[-10,10.2,5],[16,10.2,9],[-17,12.2,12]]){
  orb('dock','reefDark',x,y+.35,z,.13,.28,.12,8);orb('dock','boneShade',x,y+.76,z,.1,.12,.1,8);
  for(const side of [-1,1])rod('dock','reefDark',[x+side*.06,y+.15,z],[x+side*.07,y-.08,z],.035,5);
 }
 for(const [id,gs] of bins){const [zone,key]=id.split('/');if(!mats.has(key)){
   const mat=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,side:T.DoubleSide,roughness:1,metalness:0});mat.name='redtide_'+key;
   if(/cyan|window|water$/.test(key)){mat.emissive.set(C[key]);mat.emissiveIntensity=key==='cyan'?.45:.2;}mats.set(key,mat);}
  const g=mergeGeometries(gs,false);g.normalizeNormals();const mesh=new T.Mesh(g,mats.get(key));mesh.name=zone+'__'+key;mesh.userData={semantic_zone:zone,paint:key,authored_components:gs.length};root.getObjectByName(zone).add(mesh);gs.forEach(g=>g.dispose());}
 for(const z of zones){const g=root.getObjectByName(z.id);let triangles=0;g.traverse(n=>{if(n.isMesh)triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;});g.userData={semantic_zone:z.id,triangles};}
 root.userData={revision:'chapter2-r1',title:'적조의 왕관',authored_components:count,original_geometry:true,reference:'chapter2-moodboard-v1',scope:'Static actual 3D art prototype; hidden geometry interpreted; no gameplay/LOD/collision.',art_direction:'Handmade 2D-feeling 3D; 10x audacity through giant organic silhouette, multilevel city, lavish functional layers and material ornament.'};root.updateMatrixWorld(true);return{root,zones};
}
