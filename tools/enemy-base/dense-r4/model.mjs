import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildFortress as previous} from '../reference-r3/model.mjs';

// A NEW architectural composition, not an enlargement of the repeated drum towers.
// Hierarchy: one offset belfry, three unequal citadel masses, inhabited roof villages,
// exterior galleries and flying braces, then scars/fasteners at hand-sized scale.
export function buildFortress(){
 const {root,zones}=previous();
 const oldKeep=root.getObjectByName('keep');
 for(const n of [...oldKeep.children]){oldKeep.remove(n);n.geometry?.dispose();}
 root.getObjectByName('bell_tower').traverse(n=>{if(n.isMesh)n.geometry.translate(4,10,-3);});
 const P={iron:'#37414b',ironlight:'#62676b',dark:'#212b32',rust:'#815444',brass:'#a58b58',gold:'#d2ae69',plaster:'#aaa99b',plasterlight:'#cec5af',wood:'#81624a',grain:'#493e34',teal:'#2e5358',tile:'#487274',red:'#713337',cream:'#cec0a1',glass:'#ed9a39',glassdark:'#493f32'};
 const bins=new Map(),materials=new Map();let count=0;
 const v=p=>new T.Vector3(...p),rand=n=>{const f=Math.sin(n*127.13+37.3)*43758.5453;return f-Math.floor(f);};
 function add(g,key,zone,p=[0,0,0],r=[0,0,0]){
  if(g.index){const original=g;g=g.toNonIndexed();original.dispose();}
  g.applyMatrix4(new T.Matrix4().compose(v(p),new T.Quaternion().setFromEuler(new T.Euler(...r)),new T.Vector3(1,1,1)));
  if(!g.attributes.normal)g.computeVertexNormals();
  const ps=g.attributes.position,ns=g.attributes.normal,cols=new Float32Array(ps.count*3),base=new T.Color(P[key]);
  for(let i=0;i<ps.count;i++){const light=ns.getX(i)*-.45+ns.getY(i)*.76+ns.getZ(i)*.48;
   const shade=key==='glass'?1:(.54+.48*Math.max(0,light))*(.94+.04*Math.sin(ps.getY(i)*7+ps.getX(i)*2));
   cols[i*3]=Math.min(1,base.r*shade);cols[i*3+1]=Math.min(1,base.g*shade);cols[i*3+2]=Math.min(1,base.b*shade);}
  for(const a of Object.keys(g.attributes))if(!['position','normal'].includes(a))g.deleteAttribute(a);
  g.setAttribute('color',new T.BufferAttribute(cols,3));const k=zone+'/'+key;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(g);count++;
 }
 function box(key,x,y,z,w,h,d,ry=0,zone='keep',rz=0){add(new T.BoxGeometry(w,h,d,Math.max(1,Math.ceil(w/1.3)),Math.max(1,Math.ceil(h/1.6)),1),key,zone,[x,y,z],[0,ry,rz]);}
 function rod(key,a,b,r=.07,zone='keep',sides=5){const d=v(b).sub(v(a)),g=new T.CylinderGeometry(r,r,d.length(),sides);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate(...v(a).add(v(b)).multiplyScalar(.5).toArray());add(g,key,zone);}
 function tube(key,points,r=.08,zone='keep',steps=16){add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v)),steps,r,5,false),key,zone);}
 function cyl(key,x,y,z,rt,rb,h,seg=12,zone='keep'){add(new T.CylinderGeometry(rt,rb,h,seg,Math.max(1,Math.ceil(h/2))),key,zone,[x,y,z]);}
 function ring(key,x,y,z,r,t=.06,zone='keep'){add(new T.TorusGeometry(r,t,4,24),key,zone,[x,y,z],[Math.PI/2,0,0]);}
 function bolt(x,y,z,r=.075,zone='keep'){add(new T.IcosahedronGeometry(r,0),'brass',zone,[x,y,z]);}
 function window(x,y,z,w=.42,h=1.25,ry=0,lit=true){
  const nx=Math.sin(ry),nz=Math.cos(ry),dx=Math.cos(ry),dz=-Math.sin(ry);
  box('dark',x,y,z,w+.26,h+.23,.17,ry);
  box(lit?'glass':'glassdark',x+nx*.11,y,z+nz*.11,w,h,.05,ry);
  for(const t of [-.5,0,.5])box('dark',x+dx*w*t+nx*.17,y,z+dz*w*t+nz*.17,.055,h+.13,.09,ry);
  box('dark',x+nx*.19,y,z+nz*.19,w+.18,.07,.12,ry);
  box('brass',x+nx*.1,y-h*.5-.14,z+nz*.1,w+.48,.14,.36,ry);
  // Pointed brow produces a gothic aperture rather than a glowing rectangle.
  rod('dark',[x-dx*(w+.25)/2,y+h/2,z-dz*(w+.25)/2],[x,y+h/2+.38,z],.085);
  rod('dark',[x+dx*(w+.25)/2,y+h/2,z+dz*(w+.25)/2],[x,y+h/2+.38,z],.085);
 }
 function railing(a,b,zone='keep',height=.82){
  const av=v(a),bv=v(b),len=av.distanceTo(bv);rod('dark',a,b,.075,zone);
  rod('brass',[a[0],a[1]+height,a[2]],[b[0],b[1]+height,b[2]],.052,zone);
  for(let i=0;i<=Math.ceil(len/.45);i++){const p=av.clone().lerp(bv,i/Math.ceil(len/.45));rod('dark',p.toArray(),[p.x,p.y+height,p.z],.032,zone);}
 }
 function gallery(x,y,z,w,d,ry=0){
  const world=(xx,yy,zz)=>[x+xx*Math.cos(ry)+zz*Math.sin(ry),y+yy,z-xx*Math.sin(ry)+zz*Math.cos(ry)];
  box('wood',x,y,z,w,.21,d,ry);
  railing(world(-w/2,.15,d/2),world(w/2,.15,d/2));
  railing(world(-w/2,.15,-d/2),world(-w/2,.15,d/2));railing(world(w/2,.15,-d/2),world(w/2,.15,d/2));
  for(let i=0;i<=Math.ceil(w/1.2);i++){const q=-w/2+i*w/Math.ceil(w/1.2);rod('grain',world(q,-1.7,-d/2),world(q,-.12,d/2),.1);}
  for(let i=0;i<Math.ceil(w/.4);i++){const q=-w/2+i*.4;rod('grain',world(q,.12,-d/2),world(q,.12,d/2),.018);}
 }
 function gable(x,y,z,w,d,h,ry=0,skew=.15){
  const local=[[-w*.57,0,-d*.57],[w*.57,.12,-d*.57],[skew,h,-d*.5],[-w*.57,0,d*.57],[w*.57,.12,d*.57],[skew,h,d*.5]];
  const ids=[0,3,2,3,5,2,2,5,1,5,4,1,0,2,1,3,4,5];const ps=[];for(const i of ids){const [a,b,c]=local[i];ps.push(a,b,c);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.computeVertexNormals();add(g,'teal','keep',[x,y,z],[0,ry,0]);
  const p=(a,b,c)=>[x+a*Math.cos(ry)+c*Math.sin(ry),y+b,z-a*Math.sin(ry)+c*Math.cos(ry)];
  // Staggered metal shingle rows and standing seams, weathered eaves.
  for(const sign of [-1,1])for(let row=0;row<7;row++){
   const t=row/7,xx=sign*w*.57*(1-t)+skew*t,yy=h*t+.05;
   rod(row%3?'dark':'brass',p(xx,yy,-d*.57),p(xx,yy,d*.57),.04);
   for(let j=0;j<Math.ceil(d/.7);j++){const zz=-d*.5+j*.7+(row%2)*.28;
    rod('tile',p(xx,yy+.035,zz),p(sign*w*.57*(1-(t+.1))+skew*(t+.1),h*(t+.1)+.06,zz),.035);}
  }
  for(const zz of [-d*.58,d*.58])for(const sign of [-1,1])rod('dark',p(sign*w*.59,0,zz),p(skew,h+.1,zz),.09);
  rod('brass',p(skew,h+.12,-d*.58),p(skew,h+.12,d*.58),.055);
  for(const zz of [-d*.58,d*.58])cyl('brass',...p(skew,h+.65,zz),0,.1,1.0,6);
 }
 function spire(x,y,z,r,h,lean=.2){
  const pr=[[r*1.18,0],[r*1.1,.08],[r*.82,.28],[r*.55,.56],[r*.29,.81],[.025,1]];
  for(let i=0;i<pr.length-1;i++){const [a,t]=pr[i],[b,u]=pr[i+1];add(new T.CylinderGeometry(b,a,h*(u-t),12,2,true),'teal','keep',[x+lean*(t+u)/2,y+h*(t+u)/2,z]);ring('dark',x+lean*t,y+h*t,z,a,.055);}
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;tube(i%3?'dark':'brass',pr.map(([q,t])=>[x+Math.sin(a)*q+lean*t,y+t*h,z+Math.cos(a)*q]),.035,'keep',12);}
  for(let row=1;row<8;row++){const t=row/9,q=r*1.13*Math.pow(1-t,1.15);ring(row%3?'tile':'brass',x+lean*t,y+h*t,z,q,.035);}
  cyl('brass',x+lean,y+h+.45,z,0,.12,1.05,5);
 }
 function building(x,z,bottom,w,d,h,ry,roofH,variant=0){
  const top=bottom+h;
  // Stepped crooked mass: broad masonry foot, inset middle, projecting timber upper storey.
  box('dark',x,bottom+1.1,z,w+1,2.2,d+.8,ry);
  box(variant%3?'plaster':'plasterlight',x,bottom+h/2,z,w,h,d,ry, 'keep',variant%2?.012:-.01);
  const p=(a,b,c)=>[x+a*Math.cos(ry)+c*Math.sin(ry),b,z-a*Math.sin(ry)+c*Math.cos(ry)];
  for(let level=0;level<=Math.floor(h/3.1);level++){
   const y=bottom+.35+level*3.1;
   box('dark',x,y,z,w+.26,.23,d+.26,ry);
   box('brass',x,y+.17,z,w+.32,.055,d+.32,ry);
   // Unequal aperture rhythm breaks the toy-like wide unbroken plaster strips.
   for(const face of [-1,1])for(let col=0;col<Math.floor(w/1.35);col++){
    const xx=-w/2+.7+col*1.35+(level%2)*.12;const q=p(xx,y+1.42,face*(d/2+.13));
    if(y+2<top)window(...q,.4+rand(col+level+variant)*.19,1.25+(col%2)*.25,ry+(face<0?Math.PI:0),rand(level*7+col+variant)>.45);
   }
   for(const face of [-1,1])for(let col=0;col<Math.floor(d/1.6);col++){
    const q=p(face*(w/2+.1),y+1.45,-d/2+.7+col*1.6);
    if(y+2<top)window(...q,.4,1.25,ry+face*Math.PI/2,(col+level+variant)%3===0);
   }
   for(const sign of [-1,1]){
    const a=p(sign*w/2,y, d/2+.2),b=p(-sign*w*.1,Math.min(y+3,top),d/2+.2);
    rod('grain',a,b,.085);
   }
  }
  for(const xx of [-w/2,w/2])for(const zz of [-d/2,d/2]){
   rod('dark',p(xx,bottom,zz),p(xx,top+.1,zz),.16);
   for(let y=bottom+1;y<top;y+=1.5)bolt(...p(xx,y,zz),.065);
  }
  // Projecting upper workshop floor and roof make readable medium-scale layers.
  box('wood',x+.15,top-1.7,z,w+.5,2.5,d+.5,ry);
  for(let i=0;i<Math.ceil(w);i++){const xx=-w*.5+i;rod('grain',p(xx,top-2.9,d*.5+.28),p(xx,top-.4,d*.5+.28),.075);}
  for(let i=0;i<Math.floor(w/1.4);i++)window(...p(-w*.5+.7+i*1.4,top-1.6,d*.5+.32),.6,1.25,ry,i%2===0);
  gable(x,top,z,w+1,d+.8,roofH,ry,variant%2?.35:-.35);
  if(variant%2===0)gallery(...p(0,top-3.2,d*.5+.9),w+1.8,1.6,ry);
  // Iron ribs and narrow rust streaks over the masonry, at varied heights.
  for(let i=0;i<Math.ceil(w/.8);i++){const xx=-w/2+i*.8,q=p(xx,bottom+h*.6,d/2+.19);rod('rust',q,[q[0],q[1]-1.5-rand(i+variant)*3,q[2]],.025);}
 }
 function drum(x,z,bottom,r,h,rh,kind=0){
  const top=bottom+h;
  cyl(kind%2?'plaster':'iron',x,bottom+h/2,z,r*.91,r,h,kind%2?10:8);
  for(let level=0;level<=Math.floor(h/3);level++){
   const y=bottom+level*3;ring('dark',x,y,z,r*1.04,.11);ring('brass',x,y+.17,z,r*1.055,.04);
   for(let i=0;i<10;i++){const a=i/10*Math.PI*2,nx=Math.sin(a),nz=Math.cos(a);
    if(y+2.3<top&&i%2===level%2)window(x+nx*r,y+1.5,z+nz*r,.38,1.25,a,(i+level)%3===0);
    if(level%2===0)bolt(x+nx*r*1.07,y,z+nz*r*1.07,.07);
   }
  }
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;rod('dark',[x+Math.sin(a)*r,bottom,z+Math.cos(a)*r],[x+Math.sin(a)*r*.93,top,z+Math.cos(a)*r*.93],.09);}
  if(kind%3===0){cyl('wood',x,top-1,z,r*1.3,r*1.3,.22,12);ring('dark',x,top-.1,z,r*1.3,.07);
   for(let i=0;i<24;i++){const a=i/24*Math.PI*2;rod('dark',[x+Math.sin(a)*r*1.3,top-.9,z+Math.cos(a)*r*1.3],[x+Math.sin(a)*r*1.3,top-.1,z+Math.cos(a)*r*1.3],.035);}}
  spire(x,top+.1,z,r*1.16,rh,kind%2?-.35:.2);
 }

 // Asymmetric rising city: low front habitation / broad left barracks / tall off-centre keep.
 // No ring of same-size cylinders; each building has a different footprint and roof line.
 const blocks=[
  [-13,1,7,6.8,5.4,12,-.16,4.2,0],[-6,4,7,6.1,5,17,.1,5.1,1],
  [1,3,7,5.4,5.5,23,-.12,6.4,2],[9,0,7,5.4,6.2,24,.12,6.6,3],
  [15,-3,7,4.8,5.2,16,-.21,4.7,4],[-15,-7,7,6.5,5.8,18,.12,6.3,3],
  [-7,-6,7,7.2,6.8,27,-.08,7.5,4],[1,-8,7,5.9,6.4,25,.14,7.1,5],
  [10,-9,7,6.1,5.7,21,-.18,5.8,0],[-17,6,7,4.6,4.1,7,.2,3.1,1],
  [-8,10,7,4.6,3.9,8.8,-.16,3.5,2],[1,10,7,4.2,3.8,11,.13,4,3],
  [16,4,7,3.7,4.5,9,-.19,3.6,0],[-1,-13,7,5.2,3.8,19,.1,5,1]
 ];
 blocks.forEach(a=>building(...a));
 // Narrow secondary turrets grow from terraces/sidewalls, not another uniform outer row.
 for(const a of [[-19,-3,7,1.55,20,5.9,1],[-11,-11,7,1.6,29,8.2,2],[-2,-5,25,1.35,12,7,1],[13,-3,24,1.3,10,6,3],[18,-8,7,1.65,16,5,0],[-12,5,16,1.1,8.2,5.8,3],[-3,8,16,1.25,9.6,5.4,1],[6,7,18,1.4,11.5,6.8,0],[4,-13,7,1.65,26,6.9,1],[-21,-8,7,1.35,11,4.6,2]])drum(...a);
 // Thick foundation under raised belfry; only the open cage remains isolated above skyline.
 building(6.375,-5.125,7,5.2,5.1,26,.02,0.8,6);

 // Roof villages / overhanging workshops: gables cross at different angles and heights.
 for(const a of [[-17,1,19,3.2,3.1,3.8,.1,3,0],[-10,0,24,3.7,3.3,4.2,-.24,3.6,1],[-2,2,29,3,3.7,4,.18,3.5,2],[12,-5,31,3.4,3,3.7,.3,3.1,3],[-11,-8,34,3.6,3.1,3.4,-.2,3.9,1],[-2,-11,31,3,3.8,4.1,.1,3.4,2],[8,-11,26,3.7,3,4.4,-.25,3.5,4]])building(...a);
 // Open bridges and deep flying buttresses establish gaps and enormous vertical scale.
 for(const [a,b] of [ [[-15,21,-4],[-7,25,-4]], [[-6,29,-6],[1,28,-7]], [[2,31,-5],[6,33,-5]], [[8,23,3],[14,19,2]], [[-10,15,6],[-3,19,7]], [[-17,13,8],[-9,15,10]] ]){
  const mid=v(a).lerp(v(b),.5),length=v(a).distanceTo(v(b)),ry=-Math.atan2(b[2]-a[2],b[0]-a[0]);
  box('wood',mid.x,mid.y,mid.z,length,.28,1.55,ry);
  for(const side of [-1,1]){railing([a[0],a[1]+.2,a[2]+side*.75],[b[0],b[1]+.2,b[2]+side*.75]);
   tube('dark',[[a[0],a[1]-3.7,a[2]+side*.7],[mid.x,mid.y-1,mid.z+side*.7],[b[0],b[1]-.3,b[2]+side*.7]],.15);}
 }
 // Facade buttresses, hanging watch boxes and monumental outer steel columns.
 for(const [x,z,top,rx,rz] of [[-21,1,23,-14,0],[-18,9,17,-12,5],[-10,14,19,-5,8],[2,15,24,3,6],[20,4,25,13,0],[21,-7,22,14,-7],[-18,-11,27,-11,-6],[4,-16,29,3,-10]]){
  cyl('dark',x,10,z,.28,.65,14,8);
  tube('dark',[[x,5,z],[x,top-7,z],[rx,top-1,rz],[rx,top+2,rz]],.28);
  tube('brass',[[x+.25,5,z],[x+.25,top-7,z],[rx+.25,top-1,rz]],.055);
  for(let yy=8;yy<top-6;yy+=2){cyl('brass',x,yy,z,.44,.44,.16,8);}
  for(let i=0;i<4;i++){const yy=7+i*2;rod('dark',[x-.65,yy,z],[x+.65,yy+1.7,z],.075);}
 }

 // Replace the clean cylindrical armor reading with deep irregular hanging skirt panels.
 for(let i=0;i<38;i++){
  const a=i/38*Math.PI*2,rx=25.8,rz=17.4,x=Math.cos(a)*rx,z=Math.sin(a)*rz,ry=Math.PI/2-a;
  const width=2.5+rand(i)*1.4,low=-6-rand(i+7)*2.8,high=5.8+rand(i+12)*1.1;
  const g=new T.PlaneGeometry(width,high-low,3,5),p=g.attributes.position;
  for(let k=0;k<p.count;k++){let yy=p.getY(k);p.setZ(k,.13*Math.sin(k*1.7+i)+.17*Math.cos(yy));if(yy<-(high-low)*.4)p.setY(k,yy-rand(k+i)*.9);}
  g.computeVertexNormals();add(g,i%7?'iron':'ironlight','hull',[x,(low+high)/2,z],[0,ry,0]);
  const dir=[Math.sin(ry),Math.cos(ry)],tangent=[Math.cos(ry),-Math.sin(ry)];
  const q=(u,y,d=.2)=>[x+tangent[0]*u+dir[0]*d,y,z+tangent[1]*u+dir[1]*d];
  for(const u of [-width*.46,width*.46]){
   rod('dark',q(u,low),q(u,high),.105,'hull');
   for(let y=low+.6;y<high;y+=1.0)bolt(...q(u,y,.3),.075,'hull');
  }
  // Weld scars, overlapping crooked repair plates, uneven rust drips.
  if(i%2===0){box('rust',...q(.2,1,.3),1.2,.9,.09,ry,'hull',.13);box('ironlight',...q(.05,1.1,.4),.9,.75,.1,ry,'hull',-.1);}
  for(let j=0;j<3;j++){const yy=2+rand(i+j)*4,xx=(rand(i*3+j)-.5)*width*.8;rod('rust',q(xx,yy,.4),q(xx-.1,yy-1-rand(i*4+j)*2,.42),.035,'hull');}
  if(i%4===0){const base=q(0,high+.5);cyl('dark',...base,0,.35,2.5,5,'hull');}
 }
 // Armored corbels below cannon decks: large functional masses, then bolts/chains.
 for(const [x,z,ry] of [[-22,9,-.9],[22,8,.9],[-22,-8,-2.2],[22,-8,2.2]]){
  for(const s of [-1,1]){
   rod('dark',[x+s*1.5,9,z],[x+s*.8,-5,z],.45,'bastions',6);
   rod('brass',[x+s*1.7,9,z+.1],[x+s,0,z+.1],.065,'bastions');
  }
  gallery(x,9.1,z+1,6,2,ry);
 }
 // Industrial service layers; broad pipe bundles are readable at the default distance.
 for(const [x,z,top] of [[-18,-5,30],[-13,-12,33],[-8,-14,29],[15,-10,29],[19,-3,22]]){
  for(let j=0;j<3;j++){
   const xx=x+j*.65;const h=top+j*1.2;
   tube(j%2?'rust':'dark',[[xx,4,z],[xx,15,z],[xx-1,17,z],[xx-1,h,z]],.17+j*.035,'machinery',22);
   for(let y=8;y<h-1;y+=3.5)cyl('brass',xx-1,y,z,.28,.28,.12,8,'machinery');
  }
  box('iron',x,12,z,3,4,1.8,0,'machinery');
  for(let j=0;j<7;j++)box('dark',x,10.5+j*.43,z+1,2.5,.15,.12,0,'machinery');
 }
 // Clocks, chain wheels, pressure gauges and braces are set into the buildings.
 for(const [x,y,z,r] of [[-6,31,7.2,1.15],[8,27,4.1,.95],[-16,19,4.5,.7]]){
  add(new T.CylinderGeometry(r,r,.18,24),'brass','keep',[x,y,z],[Math.PI/2,0,0]);
  add(new T.CylinderGeometry(r*.82,r*.82,.2,24),'dark','keep',[x,y,z+.04],[Math.PI/2,0,0]);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;rod('cream',[x+Math.sin(a)*r*.65,y+Math.cos(a)*r*.65,z+.17],[x+Math.sin(a)*r*.76,y+Math.cos(a)*r*.76,z+.17],.035);}
  rod('gold',[x,y,z+.2],[x-r*.45,y+r*.3,z+.2],.05);rod('gold',[x,y,z+.2],[x+r*.1,y+r*.6,z+.2],.035);
 }
 // Lift gantry and a second articulated stair attach the great dock to the city.
 for(const [x,z,y,sign] of [[-18,7,9,1],[14,8,10,-1],[-11,-10,19,1],[8,-11,20,-1]]){
  for(let i=0;i<24;i++){const xx=x+sign*i*.19,yy=y+i*.18;box('iron',xx,yy,z,1.5,.1,.55,0,'machinery');
   if(i%2===0)rod('dark',[xx,yy,z+.34],[xx,yy+.95,z+.34],.028,'machinery');}
  rod('brass',[x,y+1,z+.34],[x+sign*23*.19,y+23*.18+1,z+.34],.045,'machinery');
 }
 // Human-scale hanging lanterns (about 1/60 of total height) strengthen the vastness.
 for(let i=0;i<30;i++){
  const a=i/30*Math.PI*2,x=Math.cos(a)*24.4,z=Math.sin(a)*16.3,y=7.4;
  rod('dark',[x,y,z],[x,y+1,z],.04,'hull');
  box('dark',x,y+.6,z,.28,.5,.28,0,'hull');box('glass',x,y+.6,z+.15,.16,.3,.02,0,'hull');
 }
 function hanging(key,x,y,z,w,h,ry=0,motif=false){
  const nx=12,ny=24,ps=[],ix=[];
  const point=(u,t,off=0)=>{const xx=(u-.5)*w+.18*Math.sin(t*7),zz=.3*Math.sin(u*6+t*8)+.17*Math.sin(t*19)+off;
   const torn=t>.8?Math.pow((t-.8)/.2,3)*(.6+.5*Math.sin(u*35)+.35*Math.sin(u*79)):0;
   return[x+Math.cos(ry)*xx+Math.sin(ry)*zz,y-t*h+torn,z-Math.sin(ry)*xx+Math.cos(ry)*zz];};
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)ps.push(...point(i/nx,j/ny));
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){if(j>20&&(i+j)%11===0)continue;const k=j*(nx+1)+i;ix.push(k,k+1,k+nx+1,k+1,k+nx+2,k+nx+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setIndex(ix);g.computeVertexNormals();add(g,key,'banners');
  rod('dark',point(-.15,0),point(1.15,0),.075,'banners');
  for(const u of [.045,.955])for(let i=0;i<30;i++)rod('cream',point(u,i/31,.05),point(u+.035,(i+.5)/31,.05),.016,'banners',4);
  if(motif)for(const [a,b] of [[[.5,.18],[.5,.8]],[[.25,.28],[.74,.48]],[[.74,.3],[.26,.58]],[[.28,.59],[.72,.75]]])tube('cream',Array.from({length:7},(_,i)=>point(a[0]+(b[0]-a[0])*i/6,a[1]+(b[1]-a[1])*i/6,.075)),.055,'banners',12);
  for(const t of [.24,.6]){const a=point(.05,t,.06),b=point(.3,t+.02,.06);rod(key==='red'?'rust':'wood',a,b,.04,'banners');}
 }
 for(const a of [[10,45,-1,2.8,15,.1],[-10,39,1,2.4,12,-.18],[-18,28,4,2.2,10,-.1],[17,34,-4,2.6,13,.2],[-5,28,11,2.1,11,0],[2,37,-12,2.4,13,Math.PI]])hanging('red',...a,true);
 for(const a of [[-14,24,5,3.4,7,-.1],[5,30,6,3,9,.1],[13,18,7,3.7,6,.15],[-3,16,14,4.8,6,0]])hanging('cream',...a,false);
 for(const [id,gs] of bins){const [zone,key]=id.split('/');if(!materials.has(key)){
   const m=new T.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,vertexColors:true,side:T.DoubleSide});m.name='dense_r4_'+key;
   if(key==='glass'){m.emissive.set('#994b16');m.emissiveIntensity=.4;}materials.set(key,m);}
  const g=mergeGeometries(gs,false);g.normalizeNormals();const mesh=new T.Mesh(g,materials.get(key));mesh.name=zone+'__dense_'+key;mesh.userData={semantic_zone:zone,paint:key,authored_components:gs.length};root.getObjectByName(zone).add(mesh);gs.forEach(g=>g.dispose());}
 for(const zone of zones){let tri=0;root.getObjectByName(zone.nodeName).traverse(n=>{if(n.isMesh)tri+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;});root.getObjectByName(zone.nodeName).userData.triangles=tri;}
 root.name='Cloudstitch_Iron_Blockade_dense_r4';root.userData={...root.userData,revision:'dense-r4',new_authored_components:count,composition:'Asymmetric stacked gothic workshops, narrow towers, raised belfry, flying braces, irregular armor skirt; handmade 2D-feeling actual 3D. Latest 10x direction interpreted through hierarchy and layered structure, not a scale multiplier.'};
 root.updateMatrixWorld(true);return{root,zones};
}
