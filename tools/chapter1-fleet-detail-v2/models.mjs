import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Original visual revision. Relative art units; no gameplay module/stat changes.
export function buildFleet(kind){
 const root=new T.Group();root.name='Fleet_'+kind;
 root.userData={sourceId:'chapter1-fleet-'+kind,visualRevision:'chapter1-fleet-detail-v2',artDirection:'10倍 boldness: leviathan jaw, enormous hollow bell, layered funeral machinery; hand-painted depth',gameplayImplemented:false};
 const palette={iron:'#34434e',dark:'#1d2933',edge:'#687077',red:'#74333a',brass:'#c4984e',gold:'#edd297',cream:'#dfcfab',cloth:'#bbac91',teal:'#30636b',wood:'#916043',ember:'#ffaf49',black:'#192025'};
 const groups={},buckets=new Map(),mats={},clips=[],rotors=[];let parts=0;
 const labels={hull:'鉄甲船体',buoyancy:'浮力袋',keep:'怪獣形船首',bell_tower:'中央鐘室',bastions:'側面砲台',dock:'引揚げ装置',machinery:'推進機関',banners:'葬礼幕'};
 for(const name of Object.keys(labels)){groups[name]=new T.Group();groups[name].name=name;root.add(groups[name]);}
 function node(name,parent,at=[0,0,0]){const g=new T.Group();g.name=name;g.position.fromArray(at);parent.add(g);groups[name]=g;return g;}
 for(const [k,v]of Object.entries(palette)){mats[k]=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,metalness:0,side:T.DoubleSide});mats[k].name='paint_'+k;if(k==='ember'){mats[k].emissive.set(v);mats[k].emissiveIntensity=.35;}}
 const light=new T.Vector3(-.45,.8,.5).normalize(),normal=new T.Vector3();
 function add(g,k,z,p=[0,0,0],r=[0,0,0],s=[1,1,1]){
  if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...r)),new T.Vector3(...s)));
  if(!g.attributes.normal)g.computeVertexNormals();const ps=g.attributes.position,ns=g.attributes.normal,c=new Float32Array(ps.count*3),base=new T.Color(palette[k]);
  for(let i=0;i<ps.count;i++){normal.fromBufferAttribute(ns,i);const d=normal.dot(light),band=d>.4?1.08:d>-.2?.9:.69;const stroke=.96+.035*Math.sin(ps.getX(i)*13+ps.getY(i)*2)+.025*Math.sin(ps.getZ(i)*9+ps.getY(i)*17);const shade=k==='ember'?1:band*stroke;c[i*3]=base.r*shade;c[i*3+1]=base.g*shade;c[i*3+2]=base.b*shade;}
  const uv=new Float32Array(ps.count*2);for(let i=0;i<ps.count;i++){const nx=Math.abs(ns.getX(i)),ny=Math.abs(ns.getY(i)),nz=Math.abs(ns.getZ(i));uv[i*2]=(ny>nx&&ny>nz?ps.getX(i):nx>nz?ps.getZ(i):ps.getX(i))*.24;uv[i*2+1]=(ny>nx&&ny>nz?ps.getZ(i):ps.getY(i))*.24;}for(const a of Object.keys(g.attributes))if(!['position','normal'].includes(a))g.deleteAttribute(a);g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setAttribute('color',new T.BufferAttribute(c,3));const id=z+':'+k;if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(g);parts++;
 }
 const box=(z,k,p,s,r=[0,0,0])=>add(new RoundedBoxGeometry(...s,2,Math.min(...s)*.18),k,z,p,r);
 const ell=(z,k,p,s)=>add(new T.SphereGeometry(1,Math.max(...s)<.2?8:32,Math.max(...s)<.2?6:20),k,z,p,[0,0,0],s);
 const cyl=(z,k,p,rt,rb,h,r=[0,0,0],open=false)=>add(new T.CylinderGeometry(rt,rb,h,24,2,open),k,z,p,r);
 const ring=(z,k,p,rad,tube=.08,r=[0,0,0])=>add(new T.TorusGeometry(rad,tube,8,40),k,z,p,r);
 function tube(z,k,pts,rad=.1){add(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(v=>new T.Vector3(...v))),32,rad,8,false),k,z);}
 function rod(z,k,a,b,rad=.1){const av=new T.Vector3(...a),bv=new T.Vector3(...b),dir=bv.clone().sub(av);const g=new T.CylinderGeometry(rad,rad,dir.length(),10);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());add(g,k,z);}
 function panel(z,k,pts){const p=[];for(let i=1;i<pts.length-1;i++)p.push(...pts[0],...pts[i],...pts[i+1]);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();add(g,k,z);}
 function chain(z,a,b,count=12){const av=new T.Vector3(...a),bv=new T.Vector3(...b);for(let i=0;i<count;i++){const p=av.clone().lerp(bv,i/(count-1));ring(z,'brass',p.toArray(),.18,.052,i%2?[0,Math.PI/2,0]:[0,0,0]);}}
 function taper(z,k,pts,radius){const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,40,1,10,false),pos=g.attributes.position;for(let i=0;i<=40;i++){const center=curve.getPointAt(i/40),r=radius*Math.pow(1-i/40,.7)+.015;for(let j=0;j<=10;j++){const id=i*11+j;const p=new T.Vector3().fromBufferAttribute(pos,id).sub(center).multiplyScalar(r).add(center);pos.setXYZ(id,...p.toArray());}}g.computeVertexNormals();add(g,k,z);}
 function drape(z,k,at,w,h,side=1){const g=new T.PlaneGeometry(w,h,32,18),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),v=(h/2-y)/h; p.setXYZ(i,x,y+(Math.sin(x*6)>0?.2:.6)*Math.pow(v,6),side*(Math.sin(x*1.5+v*2)*.27+v*.55));}g.computeVertexNormals();add(g,k,z,at);}
 const configs={scout:[14,2,1.3],ram:[9,3.6,2],cannon:[11,3.6,1.8],tow:[13,3,1.3],shield:[8,4,2],fire:[11,3.4,2.2],mortar:[8,4.2,2.7],chain:[12,4.7,1.2],repair:[11,3.4,2.2],command:[12,2.5,1.6],executor:[18,5,2.8]};
 if(!configs[kind])throw Error('Unknown fleet kind');const[L,W,D]=configs[kind];
 // Distinct hull proportions and open working decks; material families stay shared.
 const profiles=[[-L*.64,.08,.3],[-L*.44,W*.7,D*.8],[-L*.2,W,D],[L*.3,W*.95,D],[L*.5,W*.7,D*.8],[L*.57,.1,.3]];
 for(let i=0;i<profiles.length-1;i++)for(let j=0;j<24;j++){const at=(q,a)=>{const[x,w,d]=profiles[q];return[x,Math.sin(a)*d-.5,Math.cos(a)*w];};const a=j/24*Math.PI*2,b=(j+1)/24*Math.PI*2;panel('hull',j<12?'iron':'red',[at(i,a),at(i+1,a),at(i+1,b),at(i,b)]);}
 box('hull','wood',[0,D*.62,0],[L*.9,.25,W*1.6]);for(let x=-L*.4;x<L*.43;x+=.55)box('hull','dark',[x,D*.62+.14,0],[.025,.02,W*1.6]);
 function armor(x,y,z,w=1.5,h=2){const side=Math.sign(z)||1;const s=new T.Shape();s.moveTo(-w/2,h/2);s.lineTo(w/2,h/2);s.lineTo(w*.43,-h*.28);s.lineTo(0,-h*.65);s.lineTo(-w*.43,-h*.28);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.16,bevelEnabled:true,bevelSize:.06,bevelThickness:.05,bevelSegments:1}), 'dark','hull',[x,y,z],[0,side<0?Math.PI:0,0]);tube('hull','brass',[[x-w*.45,y+h*.45,z+side*.26],[x-w*.4,y-h*.25,z+side*.26],[x,y-h*.6,z+side*.26],[x+w*.4,y-h*.25,z+side*.26],[x+w*.45,y+h*.45,z+side*.26]],.04);box('hull','red',[x,y,z+side*.3],[w*.14,h*.63,.04]);for(const dx of[-.35,.35])ell('hull','brass',[x+w*dx,y+h*.3,z+side*.3],[.055,.055,.035]);}
 for(const side of[-1,1]){for(let x=-L*.32;x<L*.45;x+=1.7)armor(x,0,side*(W*.88-Math.pow(x/L,2)),1.6,D*1.3);tube('hull','brass',[[-L*.5,D*.8,side*W*.65],[0,D*.8,side*W],[L*.47,D*.8,side*W*.7]],.08);for(let x=-L*.35;x<L*.4;x+=1.5)rod('hull','brass',[x,D*.7,side*W*.75],[x,D*.7+.7,side*W*.75],.04);rod('hull','brass',[-L*.35,D*.7+.7,side*W*.75],[L*.4,D*.7+.7,side*W*.75],.04);}
 function pod(at,size){ell('buoyancy','cream',at,size);for(const t of[-.62,-.22,.22,.62]){const pts=[];for(let j=0;j<=40;j++){const a=j/40*Math.PI*2,rr=Math.sqrt(1-t*t);pts.push([at[0]+t*size[0],at[1]+Math.sin(a)*rr*size[1]*1.01,at[2]+Math.cos(a)*rr*size[2]*1.01]);}tube('buoyancy','dark',pts,.07);for(const side of[-1,1])box('buoyancy','brass',[at[0]+t*size[0],at[1]-.4,at[2]+side*size[2]*Math.sqrt(1-t*t)],[.22,.34,.1]);}for(let a=0;a<6;a++){const ang=a*Math.PI/3,pts=[];for(let j=0;j<=24;j++){const t=-.94+j/24*1.88,rr=Math.sqrt(1-t*t);pts.push([at[0]+t*size[0],at[1]+Math.sin(ang)*rr*size[1]*1.008,at[2]+Math.cos(ang)*rr*size[2]*1.008]);}tube('buoyancy','cloth',pts,.018);}}
 function engine(at,scale=1){const[x,y,z]=at;ell('machinery','teal',at,[1.35*scale,.72*scale,.72*scale]);for(const dx of[-.8,.6])ring('machinery','brass',[x+dx*scale,y,z],.74*scale,.075,[0,Math.PI/2,0]);const id='Rotor'+rotors.length,r=node(id,groups.machinery,[x+1.5*scale,y,z]);rotors.push(r);cyl(id,'brass',[0,0,0],.24*scale,.24*scale,.4,[0,0,Math.PI/2]);for(let j=0;j<4;j++){const a=j*Math.PI/2;add(new T.SphereGeometry(1,16,10),'teal',id,[0,Math.cos(a)*.9*scale,Math.sin(a)*.9*scale],[a,0,0],[.09*scale,.95*scale,.24*scale]);}}
 function gun(at,size=1,rotation=[0,0,0],zone='bastions'){const id='Gun'+parts;node(id,groups[zone],at);groups[id].rotation.fromArray(rotation);cyl(id,'iron',[-.5*size,0,0],.35*size,.52*size,2.7*size,[0,0,Math.PI/2],true);for(const x of[-1.85,-.3,.7])ring(id,'brass',[x*size,0,0],(x===-1.85?.36:.51)*size,.07*size,[0,Math.PI/2,0]);cyl(id,'black',[-.6*size,0,0],.3*size,.3*size,.05,[0,0,Math.PI/2]);box(id,'dark',[.3*size,-.5*size,0],[1.5*size,.4*size,1.5*size]);}
 function winch(at,size=1){const[x,y,z]=at;box('dock','dark',[x,y-.6*size,z],[2.4*size,.5*size,1.4*size]);cyl('dock','wood',at,.65*size,.65*size,1.6*size,[Math.PI/2,0,0]);for(let i=0;i<8;i++)ring('dock','brass',[x,y,z+(-.75+i*.21)*size],.7*size,.055*size);for(const dz of[-.95,.95])cyl('dock','brass',[x,y,z+dz*size],.95*size,.95*size,.15*size,[Math.PI/2,0,0]);}
 function hook(at,size=1){const[x,y,z]=at;chain('dock',[x,y,z],[x,y-2.6*size,z],10);tube('dock','dark',[[x,y-2.6*size,z],[x,y-3.6*size,z],[x-.8*size,y-3.9*size,z],[x-1.1*size,y-3.2*size,z],[x-.8*size,y-2.9*size,z]],.16*size);}
 function chimney(at,h=3){const[x,y,z]=at;cyl('machinery','dark',[x,y+h/2,z],.3,.43,h);for(const yy of[y+.2,y+h-.2])cyl('machinery','brass',[x,yy,z],.44,.44,.14);cyl('machinery','black',[x,y+h+.01,z],.25,.25,.03);}
 function banner(at,w=1,h=3){drape('banners','red',at,w,h);for(const dx of[-w*.43,w*.43])tube('banners','brass',[[at[0]+dx,at[1]-.1,at[2]+.03],[at[0]+dx,at[1]-h*.9,at[2]+.3]],.025);}
 function bell(at,size=1){const[x,y,z]=at;const id='Bell';const pivot=node(id,groups.bell_tower,at);const pts=[[.15,0],[.5,-.25],[.7,-1],[1.05,-1.8],[1.35,-2.2],[1.3,-2.4],[1.15,-2.35],[.85,-1.7],[.5,-.5],[.15,-.2]].map(p=>new T.Vector2(p[0]*size,p[1]*size));add(new T.LatheGeometry(pts,40),'brass',id);ring(id,'gold',[0,-2.2*size,0],1.3*size,.07,[Math.PI/2,0,0]);rod(id,'dark',[0,-.3*size,0],[0,-2*size,0],.08);ell(id,'dark',[0,-2.15*size,0],[.2,.28,.2]);return pivot;}
 function clamp(at,size=1){const[x,y,z]=at;for(const side of[-1,1]){tube('keep','iron',[[x+1,y,side*size*1.4+z],[x-.6,y+side*.2,side*size*2+z],[x-2.5*size,y,side*.9*size+z]],.35*size);ring('keep','brass',[x+.6,y,z+side*size*1.5],.6*size,.15,[0,Math.PI/2,0]);for(let i=0;i<4;i++)add(new T.ConeGeometry(.22*size,.7*size,4),'edge','keep',[x-i*.6*size,y,z+side*size*1.4],[side>0?Math.PI/2:-Math.PI/2,0,0]);}box('keep','ember',[x-.4,y+.45,z],[1.5*size,.2*size,.6*size]);}
 // Core functional silhouette per type; they are not color or loadout swaps.
 switch(kind){
 case'scout':pod([0,3,0],[5,1.3,1.3]);for(const s of[-1,1]){panel('keep','iron',[[-10,.8,0],[-4,1,s*1.5],[-4,0,s*1.2]]);panel('keep','dark',[[5,1,s],[8,2,s*3],[6,.6,s*2]]);}rod('machinery','brass',[2,1,0],[2,8,0],.09);box('machinery','dark',[2,6,0],[1.2,.5,1.2]);for(const s of[-1,1])rod('machinery','brass',[2,6,s*.5],[2,7,s*.5],.05);banner([1.3,7.7,.15],1.3,2.2);engine([6,0,0],1);break;
 case'ram':for(const s of[-1,1]){pod([.5,3,s*2],[3,1.6,1.4]);engine([4,0,s*2.5],1.4);}ell('keep','dark',[-4,1,0],[2,1.8,2.8]);clamp([-4,1,0],1.3);banner([1,4.8,2.5],1.3,3);break;
 case'cannon':pod([2,4.3,0],[3.4,1.7,1.7]);gun([-3,2.5,0],2.2);for(const s of[-1,1]){box('bastions','dark',[-2,1,s*1.8],[4,2.8,.4]);rod('bastions','brass',[-4,2.5,s*1.8],[0,2.5,s*1.8],.12);banner([1,4,s*2.3],2,3);}engine([5,0,0],1.2);chimney([3,2,-1.5],4);break;
 case'tow':for(const s of[-1,1]){pod([2,3.5,s*2.4],[3.5,1.4,1.1]);tube('dock','dark',[[3,1,s*2],[-1,7,s*2],[-5,7,s*.7]],.25);hook([-5,6,s*.8],1.2);}winch([-1,2,0],1.4);engine([6,0,0],1.3);banner([2,6,0],1.4,3);break;
 case'shield':for(const s of[-1,1])pod([1,2.5,s*2.5],[2.7,1.2,1.3]);for(let i=0;i<3;i++){const x=-4-i*.35;const sh=new T.Shape();sh.moveTo(-4,0);sh.lineTo(-3.2,5);sh.lineTo(0,7);sh.lineTo(3.2,5);sh.lineTo(4,0);sh.lineTo(0,-1);sh.closePath();add(new T.ExtrudeGeometry(sh,{depth:.35,bevelEnabled:true,bevelSize:.1,bevelThickness:.08,bevelSegments:1}),'dark','keep',[x,0,0],[0,Math.PI/2,0],[1-i*.08,1-i*.06,1]);}for(const s of[-1,1]){rod('keep','brass',[-5,0,s*3.7],[-5,5,s*2.8],.14);rod('keep','brass',[-5,5,s*2.8],[-5,6.9,0],.14);}box('keep','ember',[-5.2,3.7,0],[.1,.25,3]);engine([4,0,0],1.4);break;
 case'fire':for(const s of[-1,1])pod([0,-.5,s*2.6],[4,1.5,1.1]);for(let i=0;i<3;i++){ell('machinery','dark',[-2.5+i*2.6,3,0],[1.35,1.6,1.5]);ring('machinery','brass',[-2.5+i*2.6,3,0],1.5,.1,[Math.PI/2,0,0]);chimney([-2.5+i*2.6,4.5,0],1.3+i*.3);}gun([-5,1,0],1.4);for(const s of[-1,1])tube('machinery','brass',[[2,3,s],[0,4,s*1.7],[-4,2,s],[-5,1,0]],.15);engine([5,0,0],1.3);break;
 case'mortar':pod([2,4,-1],[2.8,1.7,2]);const mortar=node('MortarTilt',groups.bastions,[-1,3,0]);mortar.rotation.z=.4;cyl('MortarTilt','iron',[0,1.4,0],1.8,1.4,3,[0,0,0],true);cyl('MortarTilt','black',[0,.2,0],1.25,1.25,.04);ring('MortarTilt','brass',[0,2.9,0],1.8,.16,[Math.PI/2,0,0]);for(const s of[-1,1]){rod('bastions','brass',[-3,0,s*2.5],[0,4,s*2.5],.2);banner([2,4,s*2.6],1.4,3);}engine([4,0,0],1.3);break;
 case'chain':for(const s of[-1,1]){pod([3,2,s*2.4],[2.7,1,1]);for(const a of[-1,1]){tube('dock','dark',[[a*3,1,s*2.6],[a*4,4,s*5],[a*6,3.5,s*5.5]],.2);chain('dock',[a*5,3.5,s*5.5],[a*5,0,s*5.5],9);}gun([-4,2,s*2.5],.8);}winch([0,2,0],1.7);engine([5,0,0],1.2);break;
 case'repair':pod([2,5,0],[3,2,2]);box('keep','dark',[1,2,0],[6,4,4]);for(const s of[-1,1]){banner([1,5,s*2.1],3.3,4);for(let i=0;i<3;i++)armor(-1+i*1.5,1, s*3,1.3,2.7);}tube('dock','brass',[[2,4,-2],[2,8,-3],[-2,9,-3],[-5,7,-3]],.35);for(const p of[[2,8,-3],[-2,9,-3],[-5,7,-3]])ring('dock','brass',p,.65,.17);clamp([-5,6,-3],.6);cyl('dock','cream',[-2,3,1],1,1,3,[Math.PI/2,0,0]);chimney([3,4,1],4);engine([5,0,0],1.4);break;
 case'command':pod([1,-.2,0],[4,1.3,1.4]);box('keep','dark',[1,3,0],[2.2,5,2]);for(const s of[-1,1])for(let j=0;j<3;j++)box('keep','ember',[.3+j*.5,3.8,s*1.05],[.15,1.3,.06]);tube('bell_tower','dark',[[-2,1,-2],[-2,8,-2],[-2,9,0],[-2,8,2],[-2,1,2]],.2);bell([-2,8,0],.55);for(let i=0;i<3;i++){cyl('machinery','dark',[-3-i*.3,4.5+i*1.5,1.7],1.2,.3,2.5,[0,0,Math.PI/2],true);ring('machinery','brass',[-4.25-i*.3,4.5+i*1.5,1.7],1.2,.08,[0,Math.PI/2,0]);}banner([-.7,8,2.4],1,6);engine([5.5,0,0],1.3);break;
 case'executor':for(const s of[-1,1]){for(const x of[-4,4])pod([x,5,s*3.7],[3.1,1.8,1.5]);winch([-3,2.5,s*4.8],1.7);hook([-3,1,s*5],1.3);engine([8,0,s*3.8],1.7);tube('keep','dark',[[5,1,s*3],[4,7,s*3],[1,8.7,s*2.6],[-3,7.5,s*3]],.32);banner([2,8,s*3.2],5,5.5);}box('keep','dark',[1,2,0],[10,3.3,5]);clamp([-9,1,0],2);for(const s of[-1,1])tube('keep','brass',[[-8,1,s*3],[-10,2.7,s*3.6],[-12,1,s*1.9]],.32);tube('bell_tower','dark',[[5,4,-2],[5,10,-2],[5,10,2],[5,4,2]],.2);bell([5,9.6,0],.7);break;
 }
 // Rebuild intermediate structure and mechanical joints; not decoration-only noise.
 function gear(z,at,r=.45){ring(z,'brass',at,r,.09);for(let j=0;j<12;j++){const a=j*Math.PI/6;box(z,'brass',[at[0]+Math.cos(a)*r,at[1]+Math.sin(a)*r,at[2]],[.16,.18,.16],[0,0,a]);}cyl(z,'dark',at,r*.4,r*.4,.2,[Math.PI/2,0,0]);}
 function lamp(at,size=.35){const[x,y,z]=at;box('machinery','ember',at,[size*.65,size,size*.65]);for(const a of[-1,1])for(const b of[-1,1])rod('machinery','dark',[x+a*size*.36,y-size*.55,z+b*size*.36],[x+a*size*.36,y+size*.55,z+b*size*.36],.035);add(new T.ConeGeometry(size*.63,size*.45,4),'brass','machinery',[x,y+size*.75,z],[0,Math.PI/4,0]);}
 function cabin(at,size){const[x,y,z]=at,[w,h,d]=size;box('keep','iron',at,size);for(const side of[-1,1]){for(let i=0;i<3;i++){const xx=x+(i-1)*w*.26;box('keep','dark',[xx,y+.2,z+side*(d/2+.04)],[w*.2,h*.55,.1]);box('keep','ember',[xx,y+.2,z+side*(d/2+.1)],[w*.13,h*.43,.035]);rod('keep','brass',[xx,y-h*.05,z+side*(d/2+.13)],[xx,y+h*.43,z+side*(d/2+.13)],.035);}tube('keep','brass',[[x-w/2,y-h/2,z+side*d/2],[x-w/2,y+h/2,z+side*d/2],[x+w/2,y+h/2,z+side*d/2],[x+w/2,y-h/2,z+side*d/2]],.07);}box('keep','dark',[x,y+h/2+.1,z],[w+.6,.24,d+.5]);for(const side of[-1,1])panel('keep','iron',[[x-w*.64,y+h/2+.23,z+side*d*.7],[x+w*.64,y+h/2+.23,z+side*d*.7],[x+w*.55,y+h*.9,z],[x-w*.55,y+h*.9,z]]);}
 // Thick overlapping side armor with three-dimensional edge flanges and ribs.
 for(const side of[-1,1]){
  for(let i=0;i<Math.ceil(L/1.8);i++){
   const x=-L*.37+i*1.6,z=side*(W*.9-Math.pow(x/L,2));
   box('hull',i%2?'iron':'dark',[x,-.15,z],[1.66,D*.9,.27],[0,side*.06,0]);
   box('hull','brass',[x,-D*.52,z+side*.19],[1.7,.07,.12]);
   for(const dx of[-.62,.62])for(const yy of[-D*.3,D*.25])ell('hull','brass',[x+dx,yy,z+side*.22],[.065,.065,.04]);
   tube('hull','dark',[[x,-D*.85,side*W*.25],[x,-D*.3,side*W*.85],[x,D*.72,side*W*.99]],.13);
  }
  tube('hull','iron',[[-L*.5,D*.6,side*W*.65],[-L*.2,D*.7,side*W],[L*.3,D*.7,side*W*.95],[L*.5,D*.55,side*W*.68]],.14);
  // Footings and rope eyelets attach the railing to real bearing pads.
  for(let x=-L*.32;x<L*.37;x+=2.1){box('hull','dark',[x,D*.64,side*W*.75],[.4,.13,.35]);ring('hull','brass',[x,D*.86,side*W*.78],.15,.035);}
  for(let i=0;i<3;i++)box('hull','brass',[L*.25+i*.24,-.15,side*W*.98],[.07,.6,.04]);
 }
 // Buoyancy straps now have actual suspension struts, buckles and stitched repairs.
 const podBoxes=[];for(const[id,list]of buckets)if(id==='buoyancy:cream')for(const g of list){g.computeBoundingBox();const b=g.boundingBox,sz=b.getSize(new T.Vector3());if(sz.x>2&&sz.y>1)podBoxes.push({at:b.getCenter(new T.Vector3()).toArray(),size:sz.multiplyScalar(.5).toArray()});}
 for(const{at,size}of podBoxes){const[x,y,z]=at,[rx,ry,rz]=size;for(const xx of[x-rx*.52,x+rx*.52])for(const side of[-1,1]){const top=[xx,y-ry*.5,z+side*rz*.8],bottom=[xx,D*.68,Math.max(-W*.8,Math.min(W*.8,z+side*rz))];rod('buoyancy','dark',top,bottom,.065);box('buoyancy','brass',top,[.25,.28,.16]);ring('buoyancy','brass',bottom,.14,.035);}
  for(let j=0;j<18;j++){const t=-.8+j/18*1.6,rr=Math.sqrt(1-t*t);rod('buoyancy','cloth',[x+t*rx-.035,y+ry*rr*.71,z+rz*rr*.72],[x+t*rx+.035,y+ry*rr*.76,z+rz*rr*.69],.018);}
  const patch=new T.PlaneGeometry(rx*.36,ry*.45,6,5);add(patch,'cloth','buoyancy',[x-rx*.2,y+ry*.2,z+rz*.97]);for(const t of[-.13,0,.13])box('buoyancy','dark',[x+t*rx,y+ry*.2,z+rz*1.005],[.025,ry*.37,.025]);
 }
 // Every engine gets layered casing bands, cooling vents, bolted feet and pipes.
 for(const r of rotors){const[x,y,z]=r.position.toArray(),scale=kind==='executor'?1.7:1;
  for(let i=0;i<12;i++){const a=i*Math.PI/6;box('machinery','dark',[x-.9*scale,y+Math.cos(a)*.72*scale,z+Math.sin(a)*.72*scale],[.8*scale,.05,.11],[a,0,0]);}
  ring('machinery','dark',[x,y,z],1.52*scale,.1,[0,Math.PI/2,0]);for(let j=0;j<6;j++){const a=j*Math.PI/3;rod('machinery','brass',[x,y+Math.cos(a)*.23,z+Math.sin(a)*.23],[x,y+Math.cos(a)*1.5*scale,z+Math.sin(a)*1.5*scale],.035);}
  box('machinery','iron',[x-1.3*scale,y-.8*scale,z],[1.8*scale,.25,.8]);tube('machinery','brass',[[x-1.9*scale,y,z],[x-1.9*scale,y+1.2*scale,z],[x-1*scale,y+1.3*scale,z]],.08);
 }
 if(kind==='scout'){
  // Crow-like hull is a working scout: raised bridge, windscreen and open lookout.
  cabin([2,1.8,0],[2.8,1.8,1.8]);
  for(const side of[-1,1]){tube('keep','brass',[[-8.8,.7,0],[-6.5,1.05,side*.7],[-4,1.1,side*1.6]],.08);panel('keep','dark',[[-8.8,.75,0],[-4,1.1,side*1.6],[-4,.65,side*1.7]]);box('keep','ember',[-5.3,1,side*.95],[1.2,.1,.08],[0,side*.2,0]);}
  // Lookout cage, visible binocular-like optical signal device and guy rigging.
  ring('machinery','dark',[2,6.25,0],.9,.12,[Math.PI/2,0,0]);for(let i=0;i<8;i++){const a=i*Math.PI/4;rod('machinery','brass',[2+Math.cos(a)*.85,6.2,Math.sin(a)*.85],[2+Math.cos(a)*.85,7.2,Math.sin(a)*.85],.045);}add(new T.ConeGeometry(1.2,.7,8),'dark','machinery',[2,7.5,0]);
  for(const side of[-1,1]){tube('machinery','brass',[[-3,1.3,side*1.2],[2,7.9,0],[5,1.3,side*1.2]],.026);cyl('machinery','brass',[1.1,6.8,side*.4],.22,.26,.6,[0,0,Math.PI/2]);lamp([2.5,3,side],.32);}
  for(let i=0;i<5;i++){box('hull','iron',[4,1+i*.3,1.3],[1.6,.07,.5]);}
 }
 if(kind==='command'){
  // Command tower: enclosed raised pilot house with tiered balconies, not a box.
  cabin([1,4,0],[3.1,3.8,2.6]);for(const y of[1.5,3.2,5.4]){box('keep','dark',[1,y,0],[4,.22,3.6]);for(const side of[-1,1]){rod('keep','brass',[-1,y+.7,side*1.8],[3,y+.7,side*1.8],.05);for(let x=-1;x<=3;x+=.7)rod('keep','brass',[x,y,side*1.8],[x,y+.7,side*1.8],.035);}}
  for(const side of[-1,1]){tube('machinery','brass',[[2.5,1,side],[3.4,2,side*1.5],[3.4,6.7,side*1.5]],.12);lamp([1,6.7,side*1.75],.4);for(let j=0;j<4;j++)box('machinery','brass',[3.4,2+j,side*1.5],[.45,.18,.45]);}
  for(let i=0;i<3;i++){const y=4.5+i*1.5,x=-3-i*.3;gear('machinery',[x+.6,y,2.05],.38);tube('machinery','dark',[[x+.6,y,1.7],[-.5,y,1.5],[-.3,2.3,1.5]],.09);ring('machinery','brass',[x-1.22,y,1.7],1.22,.06,[0,Math.PI/2,0]);for(let j=0;j<8;j++){const a=j*Math.PI/4;ell('machinery','brass',[x-1.3,y+Math.cos(a)*1.1,1.7+Math.sin(a)*1.1],[.045,.06,.06]);}}
  for(let j=0;j<5;j++){box('keep','brass',[2.6,1.5+j*.35,0],[.06,.06,1.2]);rod('keep','brass',[2.6,1.5,-.65],[2.6,3.2,-.65],.04);rod('keep','brass',[2.6,1.5,.65],[2.6,3.2,.65],.04);}
 }
 if(kind==='executor'){
  // Cohesive arched hearse canopy: roof skin, ribs, end cap and golden swept edging.
  const roof=new T.CylinderGeometry(3.6,3.6,9,32,6,true,0,Math.PI);add(roof,'dark','keep',[1,4.1,0],[0,0,Math.PI/2]);
  for(const x of[-3.5,-1,1.5,4,5.5]){const pts=[];for(let j=0;j<=24;j++){const a=j/24*Math.PI;pts.push([x,4.1+Math.sin(a)*3.65,Math.cos(a)*3.65]);}tube('keep','brass',pts,.12);for(const s of[-1,1]){box('keep','dark',[x,3.5,s*3.6],[.4,2,.4]);lamp([x,4.7,s*3.9],.36);}}
  for(const side of[-1,1]){
   // Thick hinge cheek plates, joint bearings, return cylinders and industrial jaw teeth.
   box('keep','iron',[-8,1.3,side*3.2],[4.1,2.8,.7],[0,side*.13,-.1]);gear('keep',[-8,1.3,side*3.65],1.1);ring('keep','gold',[-8,1.3,side*3.65],.72,.08);
   tube('keep','dark',[[-8,1.5,side*3.5],[-11,1.3,side*4],[-13.2,1.5,side*2.3]],.45);tube('keep','brass',[[-5,2,side*3],[-8,3.1,side*3.5],[-11,2,side*3.8]],.15);
   for(let i=0;i<5;i++){const x=-9.2-i*.65;add(new T.ConeGeometry(.3,.95,4),'edge','keep',[x,1.3,side*(3.5-i*.15)],[side>0?Math.PI/2:-Math.PI/2,0,0]);}
   // The giant reels now have ridged drum, cable layering and complete gearboxes.
   for(let i=0;i<14;i++)ring('dock','dark',[-3,2.5,side*4.8+(i-6.5)*.15],1.15,.1);
   for(const z of[side*3.2,side*6.45]){gear('dock',[-3,2.5,z],1.45);for(let j=0;j<6;j++){const a=j*Math.PI/3;rod('dock','brass',[-3,2.5,z],[-3+Math.cos(a)*1.15,2.5+Math.sin(a)*1.15,z],.065);}}
   box('dock','iron',[-.9,2.2,side*4.8],[1.1,1.5,1.5]);tube('dock','brass',[[-.9,2.8,side*4.8],[.5,3.5,side*4.8],[2,3.5,side*4]],.1);
  }
 }

 // Role-specific structural density for the other eight ships.
 if(kind==='ram'){
  cabin([1,2.4,0],[2.7,2.3,2.7]);for(const s of[-1,1]){gear('keep',[-3.4,1,s*2.8],.8);tube('keep','brass',[[-1.5,1.8,s*2.3],[-3.4,2.6,s*2.8],[-5.1,1.6,s*2.1]],.16);box('keep','dark',[-3.9,2.3,s*2.5],[2.6,.45,.7],[0,s*.25,-.12]);for(let j=0;j<4;j++)add(new T.ConeGeometry(.28,.85,4),'edge','keep',[-4.4-j*.5,1,s*(1.6-j*.18)],[s>0?Math.PI/2:-Math.PI/2,0,0]);lamp([1,3.6,s*1.6],.4);}
 }
 if(kind==='cannon'){
  cabin([2,2.6,-.3],[2.5,2.1,2.9]);for(const s of[-1,1]){gear('bastions',[-2,2.4,s*2.2],.68);rod('bastions','iron',[-4,1.3,s*2],[-1,3,s*2],.2);tube('bastions','brass',[[-3,1.4,s*2.1],[-1,1.8,s*2.1],[.4,1.8,s*1.8]],.09);for(let i=0;i<4;i++){cyl('bastions','brass',[1+i*.4,1.2,s*2.5],.12,.12,.65);add(new T.ConeGeometry(.12,.25,12),'iron','bastions',[1+i*.4,1.65,s*2.5]);}lamp([2,3.9,s*1.9],.35);}for(let x=-5;x<-1;x+=.7)ring('bastions','dark',[x,2.5,0],.9,.09,[0,Math.PI/2,0]);
 }
 if(kind==='tow'){
  cabin([3,2.4,0],[2.4,2.2,2.1]);for(const s of[-1,1]){tube('dock','brass',[[3,1,s*2.3],[-1,7.3,s*2.3],[-5,7.3,s*.85]],.08);for(let j=0;j<6;j++)rod('dock','iron',[2-j*.55,2+j*.6,s*2],[-j*.65,3+j*.6,s*2],.08);gear('dock',[-1,2,s*1.5],.85);ring('dock','brass',[-5,6.5,s*.85],.55,.13);tube('dock','dark',[[-1,2,s],[-3,6,s*.8],[-5,6.5,s*.85],[-5,3,s*.85]],.055);lamp([3,4,s*1.3],.32);}for(let i=0;i<12;i++)ring('dock','dark',[-1,2,(i-5.5)*.17],.85,.08);
 }
 if(kind==='shield'){
  cabin([1.2,2.5,0],[2.5,2.2,2.3]);for(const s of[-1,1]){rod('keep','iron',[-3,4,s*2.7],[1,1.6,s*2],.3);rod('keep','brass',[-3,3,s*2.8],[0,2,s*2.2],.11);gear('keep',[-3,2,s*3],.7);for(let j=0;j<7;j++)ell('keep','brass',[-5.25,1+j*.6,s*(3.6-j*.15)],[.065,.08,.08]);lamp([.8,3.8,s*1.5],.35);}for(let j=0;j<4;j++)box('keep','iron',[-4.7,1.4+j*.2,0],[.2,.07,2.8]);
 }
 if(kind==='fire'){
  cabin([3,2.7,-.1],[2,2.1,2.4]);for(let i=0;i<3;i++){const x=-2.5+i*2.6;for(const s of[-1,1]){rod('machinery','iron',[x-.7,1.3,s],[x,4.2,s*1.2],.12);ring('machinery','brass',[x,3,s*1.45],.33,.07);gear('machinery',[x,3,s*1.55],.24);tube('machinery','brass',[[x,4.2,0],[x,4.6,s*1.7],[x-1,3,s*1.9]],.12);}cyl('machinery','dark',[x,4.6,0],.45,.45,.18);for(let j=0;j<6;j++){const a=j*Math.PI/3;ell('machinery','brass',[x+Math.cos(a)*.37,4.72,Math.sin(a)*.37],[.04,.04,.04]);}}for(const s of[-1,1]){box('bastions','iron',[-5,1.2,s*1.1],[2.5,1.6,.3]);for(let j=0;j<5;j++)box('bastions','ember',[-5.8+j*.35,1.2,s*1.29],[.12,.9,.025]);lamp([3,3.8,s*1.5],.3);}
 }
 if(kind==='mortar'){
  cabin([2.1,2,-1.1],[2.1,1.7,1.8]);for(const s of[-1,1]){gear('bastions',[-.7,2.8,s*2.5],.8);tube('bastions','brass',[[-3,1,s*2.6],[-2,2.5,s*2.6],[-.7,2.8,s*2.5],[1,1,s*2.6]],.14);for(let j=0;j<3;j++){cyl('bastions','iron',[2+j*.5,1,s*2.7],.2,.2,.8);add(new T.ConeGeometry(.2,.35,12),'brass','bastions',[2+j*.5,1.55,s*2.7]);}lamp([2,3.1,s*2],.35);}for(let j=0;j<8;j++){const a=j*Math.PI/4;box('MortarTilt','dark',[Math.cos(a)*1.7,1.5,Math.sin(a)*1.7],[.22,2.1,.22]);}
 }
 if(kind==='chain'){
  cabin([2.2,1.9,0],[2.3,1.9,2.2]);for(const s of[-1,1])for(const a of[-1,1]){gear('dock',[a*3,1,s*2.8],.55);tube('dock','brass',[[a*3,1.3,s*2.8],[a*4,4.3,s*5.1],[a*6,3.8,s*5.5]],.07);rod('dock','iron',[a*3.5,1,s*3],[a*4.6,3,s*4.5],.14);ring('dock','brass',[a*5,3.5,s*5.5],.5,.1);ell('dock','dark',[a*5,-.2,s*5.5],[.45,.45,.45]);for(let j=0;j<6;j++){const ang=j*Math.PI/3;add(new T.ConeGeometry(.1,.45,4),'brass','dock',[a*5+Math.cos(ang)*.46,-.2+Math.sin(ang)*.46,s*5.5],[0,0,-ang]);}}for(let j=0;j<12;j++)ring('dock','dark',[0,2,(j-5.5)*.23],1.2,.1);lamp([2.2,3.1,1.4],.4);
 }
 if(kind==='repair'){
  cabin([2,3.4,0],[2.7,2.8,2.7]);for(const s of[-1,1]){lamp([2.2,5,s*1.7],.4);for(let i=0;i<3;i++){box('keep','iron',[-1+i*1.3,1.4,s*3],[1,.2,1.3]);cyl('keep','brass',[-1+i*1.3,1.8,s*3],.12,.12,.7);}rod('hull','dark',[-2,1,s*3.2],[-2,4,s*3.2],.13);}for(const p of[[2,8,-3],[-2,9,-3],[-5,7,-3]]){gear('dock',[p[0],p[1],p[2]+.24],.6);box('dock','dark',p,[.75,.75,.6]);}tube('dock','dark',[[2,4,-2.2],[2.4,8,-3.4],[-2,9.4,-3.4],[-5.4,7,-3.4]],.1);for(let j=0;j<7;j++)ring('dock','cloth',[-2,3,.3+j*.23],1.03,.025);box('dock','dark',[-2,1.8,1],[2.6,.25,3.4]);
 }

 // Final merged components and common actual GLB exhibition rotor clip.
 for(const[id,list]of buckets){const sep=id.indexOf(':'),zone=id.slice(0,sep),key=id.slice(sep+1),mesh=new T.Mesh(mergeGeometries(list,false),mats[key]);mesh.name=zone+'_'+key;groups[zone].add(mesh);list.forEach(g=>g.dispose());}
 const times=Array.from({length:25},(_,i)=>i/4),tracks=[];
 for(const r of rotors){const values=[];for(const t of times)values.push(...new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),t*Math.PI*4/3).toArray());tracks.push(new T.QuaternionKeyframeTrack(r.name+'.quaternion',times,values));}
 clips.push(new T.AnimationClip('Exhibition_propellers',6,tracks));root.userData.authored_components=parts;root.userData.kind=kind;root.userData.limitations='art asset; no AI,collision,damage,LOD or sockets';root.updateMatrixWorld(true);return{root,clips,zones:Object.keys(labels)};
}

