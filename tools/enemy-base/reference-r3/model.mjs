import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildFortress as baseline} from '../fortress.mjs';

// Reference reconstruction: broad armored buoyant city, layered irregular towers.
// All decoration is real 360-degree geometry. No photograph projection/billboard.
export function buildFortress(){
 const {root,zones}=baseline();
 root.name='Cloudstitch_Blockade_Citadel_reference_r3';
 const transforms={hull:[1.85,1.65,1.6],buoyancy:[1.85,1.8,1.6],keep:[1.35,1.03,1.25],bell_tower:[1.25,1.12,1.25],bastions:[1.8,1.65,1.6],dock:[1.4,1.65,1.35],machinery:[1.6,1.25,1.5],banners:[1.5,1.18,1.35]};
 root.traverse(n=>{if(!n.isMesh)return;const z=n.userData.semantic_zone;const s=transforms[z]||[1,1,1];n.geometry.scale(...s);if(z==='dock')n.geometry.translate(8,0,1);});
 const P={iron:'#414c55',ironlight:'#59616a',dark:'#252f39',seam:'#202932',brass:'#a78851',gold:'#c6aa70',cream:'#bdb298',pale:'#d2c6ad',plaster:'#bdb8a5',wood:'#816044',grain:'#493f34',teal:'#3b696b',tile:'#537e7b',red:'#743435',redlight:'#93483e',window:'#f9ac49',rust:'#71564a'};
 const bins=new Map(),mats=new Map();let pieces=0;
 const V=p=>new T.Vector3(...p);
 function add(g,key,zone,p=[0,0,0],r=[0,0,0],s=[1,1,1]){
  if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}
  g.applyMatrix4(new T.Matrix4().compose(V(p),new T.Quaternion().setFromEuler(new T.Euler(...r)),V(s)));
  if(!g.attributes.normal)g.computeVertexNormals();
  const ps=g.attributes.position,ns=g.attributes.normal,col=new Float32Array(ps.count*3),base=new T.Color(P[key]);
  for(let i=0;i<ps.count;i++){
   const x=ps.getX(i),y=ps.getY(i),z=ps.getZ(i);
   const l=ns.getX(i)*-.45+ns.getY(i)*.76+ns.getZ(i)*.48;
   const broad=.63+.39*Math.max(0,l);
   const brush=.96+.045*Math.sin(x*9.1+Math.sin(y*2.7)*1.2+z*1.8)+.023*Math.sin(y*27+x*2+z*4);
   const weather=1-.08*Math.pow(Math.max(0,Math.sin(x*.9+z*1.3+y*.22)),5);
   const shade=key==='window'?1:broad*brush*weather;
   col[i*3]=Math.min(1,base.r*shade*1.03);col[i*3+1]=Math.min(1,base.g*shade);col[i*3+2]=Math.min(1,base.b*shade*(l<0?1.08:1));
  }
  for(const a of Object.keys(g.attributes))if(!['position','normal'].includes(a))g.deleteAttribute(a);
  g.setAttribute('color',new T.BufferAttribute(col,3));const k=zone+'/'+key;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(g);pieces++;
 }
 function box(zone,key,x,y,z,w,h,d,ry=0){add(new T.BoxGeometry(w,h,d,Math.max(1,Math.ceil(w*1.2)),Math.max(1,Math.ceil(h*1.2)),1),key,zone,[x,y,z],[0,ry,0]);}
 function cyl(zone,key,x,y,z,rt,rb,h,seg=16){add(new T.CylinderGeometry(rt,rb,h,seg,Math.max(1,Math.ceil(h))),key,zone,[x,y,z]);}
 function rod(zone,key,a,b,r=.07,seg=6){const av=V(a),bv=V(b),d=bv.clone().sub(av),g=new T.CylinderGeometry(r,r,d.length(),seg);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());add(g,key,zone);}
 function tube(zone,key,points,r=.07,steps=24){add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(V)),steps,r,5,false),key,zone);}
 function ring(zone,key,x,y,z,r,t=.08){add(new T.TorusGeometry(r,t,5,32),key,zone,[x,y,z],[Math.PI/2,0,0]);}
 function rivet(zone,x,y,z,r=.08){add(new T.SphereGeometry(r,6,4),'brass',zone,[x,y,z]);}
 function slit(zone,x,y,z,w,h,ry=0){
  box(zone,'dark',x,y,z,w+.22,h+.22,.15,ry);const dx=Math.sin(ry)*.11,dz=Math.cos(ry)*.11;
  box(zone,'window',x+dx,y,z+dz,w,h,.08,ry);
  for(const q of [-.45,.45])box(zone,'dark',x+Math.cos(ry)*w*q+dx*2,y,z-Math.sin(ry)*w*q+dz*2,.07,h+.16,.12,ry);
  box(zone,'brass',x+dx*2,y-h*.5-.08,z+dz*2,w+.4,.12,.25,ry);
 }
 function roof(zone,x,y,z,r,h,lean=.2){
  // Individual gently flared tile courses and radial ribs; no plain cone surface.
  const profile=[[1.12,0],[1.05,.12],[.85,.37],[.62,.63],[.35,.84],[.03,1]];
  for(let k=0;k<profile.length-1;k++){
   const [a,t]=profile[k],[b,u]=profile[k+1];const ch=(u-t)*h;
   const g=new T.CylinderGeometry(b*r,a*r,ch,20,3,true);
   add(g,k%2?'tile':'teal',zone,[x+lean*(t+u)/2,y+(t+u)*h/2,z]);
   ring(zone,'dark',x+lean*t,y+t*h,z,a*r,.045);
  }
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;
   tube(zone,i%3?'dark':'brass',profile.map(([q,t])=>[x+Math.cos(a)*r*q+lean*t,y+t*h,z+Math.sin(a)*r*q]),.035,20);
  }
  // Painted individual roof tiles at differing staggered heights.
  for(let row=1;row<6;row++){const t=row/7,q=1.13*(1-t)+.12;
   for(let i=0;i<18;i++){const a=(i+(row%2)*.5)/18*Math.PI*2;
    rod(zone,row%2?'tile':'teal',[x+Math.cos(a)*r*q+lean*t,y+t*h,z+Math.sin(a)*r*q],[x+Math.cos(a+.09)*r*q+lean*t,y+t*h,z+Math.sin(a+.09)*r*q],.038,4);
   }
  }
  cyl(zone,'brass',x+lean,y+h+.25,z,0,.1,.6,6);
 }
 function tower(x,z,bottom,r,h,roofH,variant=0){
  const zone='keep',top=bottom+h;
  cyl(zone,'plaster',x,bottom+h/2,z,r*.95,r,h,20);
  for(let level=0;level<4;level++){
   const y=bottom+.45+level*(h-.8)/3;
   cyl(zone,level%2?'dark':'iron',x,y,z,r*1.035,r*1.035,.34,20);ring(zone,'brass',x,y+.2,z,r*1.05,.045);
   for(let i=0;i<16;i++){const a=i/16*Math.PI*2;rivet(zone,x+Math.cos(a)*r*1.045,y,z+Math.sin(a)*r*1.045,.06);}
  }
  for(let i=0;i<8;i++){
   const a=i/8*Math.PI*2,dx=Math.sin(a),dz=Math.cos(a);
   rod(zone,'rust',[x+dx*r,bottom,z+dz*r],[x+dx*r*.96,top,z+dz*r*.96],.05);
   if(i%2===variant%2)for(let f=1;f<=2;f++)slit(zone,x+dx*r*.98,bottom+h*f/3,z+dz*r*.98,.35+r*.12,1.1+r*.12,a);
  }
  if(variant%2===0){cyl(zone,'wood',x,top-.85,z,r*1.25,r*1.25,.24,20);ring(zone,'dark',x,top+.1,z,r*1.23,.08);
   for(let i=0;i<22;i++){const a=i/22*Math.PI*2;rod(zone,'dark',[x+Math.sin(a)*r*1.23,top-.75,z+Math.cos(a)*r*1.23],[x+Math.sin(a)*r*1.23,top+.1,z+Math.cos(a)*r*1.23],.038);}
  }
  roof(zone,x,top+.2,z,r*1.18,roofH,(variant-2)*.16);
 }
 // Large drum towers cover the clean house facade and build the reference's
 // dense rise from broad gun deck to the offset high bell cage.
 for(const a of [
  [-16,-2,6.6,3.1,12,4.7,0],[-11,5,6.6,2.7,14.8,4.5,1],[-5,7,6.6,2.35,12.5,4.1,2],
  [2,5,6.6,2.5,15.5,4.8,3],[9,1,6.6,2.9,17.3,5.3,4],[16,-3,6.6,2.5,11.5,4.6,1],
  [-10,-8,6.6,2.9,19.4,5.2,1],[-2,-7,6.6,3.1,20.1,5.2,2],[6,-9,6.6,2.5,17.8,4.3,3],
  [-18,-9,6.6,2.2,9.4,3.6,2],[16,-10,6.6,2.2,12.2,4.1,0],[-15,9,6.6,2.0,8.6,3.1,1]
 ])tower(...a);
 // Plate the outer hull as a broad, tall wall. Each plate has seams, embossed
 // rivets, vertical overlaps and a distinct brushed face; not one smooth cup.
 for(let course=0;course<3;course++)for(let i=0;i<44;i++){
  const a=i/44*Math.PI*2,b=(i+1)/44*Math.PI*2,low=-5+course*3.8,high=low+3.75;
  const rx=24.8+(course-1)*.8,rz=16.7+(course-1)*.45;
  const ps=[];const nx=4,ny=5;
  for(let yy=0;yy<=ny;yy++)for(let xx=0;xx<=nx;xx++){const ang=a+(b-a)*xx/nx;ps.push(Math.cos(ang)*rx,low+(high-low)*yy/ny,Math.sin(ang)*rz);}
  const ids=[];for(let yy=0;yy<ny;yy++)for(let xx=0;xx<nx;xx++){const k=yy*(nx+1)+xx;ids.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setIndex(ids);g.computeVertexNormals();add(g,(i+course)%6?'iron':'ironlight','hull');
  rod('hull','seam',[Math.cos(a)*rx,low,Math.sin(a)*rz],[Math.cos(a)*rx,high,Math.sin(a)*rz],.1);
  for(const t of [.15,.83])for(const ang of [a+.012,b-.012])rivet('hull',Math.cos(ang)*(rx+.08),low+(high-low)*t,Math.sin(ang)*(rz+.08),.085);
 }
 for(const y of [-5.1,-1.2,2.6,6.3]){
  const pts=Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return[Math.cos(a)*25.75,y,Math.sin(a)*17.3];});
  tube('hull','dark',pts,.2,64);tube('hull','brass',pts.map(p=>[p[0],p[1]+.14,p[2]]),.055,64);
 }
 for(let i=0;i<40;i++){
  const a=i/40*Math.PI*2,x=Math.cos(a)*25.5,z=Math.sin(a)*17.1;
  cyl('hull','dark',x,7.15,z,0,.26,1.65,5);
  if(i%4===0){rod('hull','dark',[x,5,z],[x*.97,-6.4,z*.97],.18);}
 }
 // Hanging cloth sheets and repaired sealing banners bridge mass layers.
 function cloth(zone,key,x,y,z,w,h,angle=0,motif=false){
  const p=[],ix=[],nx=12,ny=18;
  const point=(u,v,off=0)=>{const xx=(u-.5)*w+.12*Math.sin(v*5),zz=.23*Math.sin(u*5+v*3)+.14*Math.sin(v*7)+off;
   return[x+xx*Math.cos(angle)+zz*Math.sin(angle),y-v*h+(v>.85?.25*Math.sin(u*21)*Math.pow((v-.85)/.15,2):0),z-xx*Math.sin(angle)+zz*Math.cos(angle)];};
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)p.push(...point(i/nx,j/ny));
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;ix.push(a,a+1,a+nx+1,a+1,a+nx+2,a+nx+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();add(g,key,zone);
  rod(zone,'dark',point(-.06,0),point(1.06,0),.07);
  for(const u of [.05,.95])for(let j=0;j<24;j++)rod(zone,'cream',point(u,j/25,.05),point(u+.025,(j+.55)/25,.05),.014,4);
  if(motif)for(const [a,b] of [[ [.5,.19],[.5,.77] ],[ [.3,.29],[.7,.5] ],[ [.7,.3],[.3,.56] ],[ [.3,.57],[.7,.73] ]])tube(zone,'cream',Array.from({length:8},(_,i)=>point(a[0]+(b[0]-a[0])*i/7,a[1]+(b[1]-a[1])*i/7,.08)),.045,12);
 }
 for(const a of [[-20,19,10,2.4,10,-.2],[-12,29,-1,2.2,11,-.1],[9,33,-2,2.6,13,.05],[19,22,1,2.4,11,.15],[7,18,15,2.5,9,.05],[-21,16,-10,2.4,8,Math.PI],[15,25,-12,2.3,10,Math.PI]])cloth('banners','red',...a,true);
 for(const a of [[-16,15,14,3.7,5,-.2],[-5,22,9,2.5,8,0],[14,21,6,2.2,9,.1],[-9,11,16,5,4,0]])cloth('banners','pale',...a,false);
 // Deep timber galleries: many small warm windows behind projecting braces.
 for(const [x,y,z,w,d] of [[-7,14,4,8,3],[8,20,-4,7,4],[-8,22,-7,6,3],[15,14,-7,5,3],[-17,11,-6,4,3],[0,10,11,9,3]]){
  box('keep','wood',x,y,z,w,3.5,d);
  for(const s of [-1,1])for(let q=0;q<Math.floor(w/1.4);q++){
   const xx=x-w/2+.7+q*1.4;slit('keep',xx,y+.3,z+s*(d/2+.06),.55,1.35,s>0?0:Math.PI);
   rod('keep','grain',[xx-.6,y-1.7,z+s*d/2],[xx+.6,y+1.7,z+s*d/2],.075);
  }
  box('keep','dark',x,y-1.8,z,w+.8,.25,d+.8);
  for(let q=0;q<Math.floor(w/.6);q++){const xx=x-w/2+q*.6;rod('keep','dark',[xx,y-1.5,z+d/2+.5],[xx,y-.4,z+d/2+.5],.035);}
  rod('keep','brass',[x-w/2,y-.4,z+d/2+.5],[x+w/2,y-.4,z+d/2+.5],.045);
  // Stacked roof eaves over the projecting gallery.
  for(let q=0;q<7;q++)box('keep',q%2?'tile':'teal',x,y+2+q*.16,z-q*.25,w+1,.15,d+1-q*.28);
 }
 // Exterior iron staircases and pipe runs provide scale and inhabited density.
 for(const [x,z,y,dir] of [[-20,4,8,1],[17,8,8,-1],[-12,-11,13,1],[10,-13,9,-1]]){
  for(let k=0;k<18;k++){box('machinery','iron',x+dir*k*.25,y+k*.24,z,1.9,.14,.8);rod('machinery','dark',[x+dir*k*.25,y+k*.24,z+.45],[x+dir*k*.25,y+k*.24+1,z+.45],.035);}
  rod('machinery','brass',[x,y+1,z+.45],[x+dir*17*.25,y+17*.24+1,z+.45],.05);
 }
 for(const [x,z,h,r] of [[-14,-8,28,1.1],[-10,-11,30,1.25],[-4,-13,26,1.0],[11,-10,25,1.3],[19,-7,18,1.0]]){
  cyl('machinery','dark',x,(7+h)/2,z,r,r*1.2,h-7,16);
  for(const y of [9,15,h-1,h]){cyl('machinery','iron',x,y,z,r*1.25,r*1.25,.45,16);ring('machinery','brass',x,y+.22,z,r*1.26,.075);}
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;rivet('machinery',x+Math.sin(a)*r*1.25,h-.8,z+Math.cos(a)*r*1.25,.08);}
  tube('machinery','rust',[[x,10,z],[x+2,10,z],[x+2,16,z],[x+3.8,16,z]],.18,18);
 }
 for(let side of [-1,1])for(let i=0;i<7;i++){
  const x=side*(22-i*.9),z=-10+i*3,y=1+i*.2;
  tube('machinery',i%2?'brass':'rust',[[x,y,z],[x,y+4,z],[x-side*2,y+6,z],[x-side*4,y+6,z]],.11,18);
 }
 // Wide gun-deck bulwarks behind original large outward cannon meshes.
 for(const [x,z] of [[-21,9],[21,8],[-21,-8],[21,-8]]){
  cyl('bastions','iron',x,8.4,z,4.2,4.5,3.8,20);
  for(const y of [6.5,9.8]){ring('bastions','dark',x,y,z,4.35,.15);ring('bastions','brass',x,y+.2,z,4.37,.05);}
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2;cyl('bastions','dark',x+Math.sin(a)*4.2,10.8,z+Math.cos(a)*4.2,0,.18,1.3,5);rivet('bastions',x+Math.sin(a)*4.3,8.5,z+Math.cos(a)*4.3,.09);}
 }
 // Additional fine deck texture and roof edge weathering, real geometry.
 for(let i=0;i<32;i++){
  const a=i/32*Math.PI*2,rx=25.4,rz=17.1;
  if(i%3===0)cloth('banners','red',Math.cos(a)*rx,5.7,Math.sin(a)*rz,1.4,5,-a+Math.PI/2,false);
 }
 for(const [id,gs] of bins){const [zone,key]=id.split('/');if(!mats.has(key)){const m=new T.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,vertexColors:true,side:T.DoubleSide});m.name='reference_r3_'+key;if(key==='window'){m.emissive.set('#a45b23');m.emissiveIntensity=.35;}mats.set(key,m);}
  const g=mergeGeometries(gs,false);g.normalizeNormals();const mesh=new T.Mesh(g,mats.get(key));mesh.name=zone+'__reference_'+key;mesh.userData={semantic_zone:zone,paint:key,authored_components:gs.length};root.getObjectByName(zone).add(mesh);gs.forEach(g=>g.dispose());}
 root.userData={...root.userData,revision:'reference-r3',authored_components:root.userData.authored_components+pieces,source:'User-attached villain moodboard, 2026-10-19',scope:'Static original architecture; rear/hidden areas interpreted, not exact recovered geometry.'};
 root.updateMatrixWorld(true);return{root,zones};
}
