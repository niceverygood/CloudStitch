import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original curved construction, independent of chapter-one or fortress meshes.
export const P={bone:'#e6d6b5',pearl:'#eddac6',rose:'#d9b8ae',lavender:'#b3acbc',coral:'#bb463b',coralLight:'#d66c4c',wine:'#853f4b',cloth:'#dbc6a1',wood:'#936849',woodLight:'#bf9361',brass:'#bb9456',edge:'#efd4a0',rope:'#aa906b',dark:'#39313d',metal:'#61545b',cyan:'#70c9bd',amber:'#f2b869'};
const V=a=>new T.Vector3(...a),rnd=n=>{const x=Math.sin(n*91.317+17.62)*43758.5453;return x-Math.floor(x);};
export function createKit(kind){
 const root=new T.Group();root.name='C2_'+kind;
 const zones={},bins=new Map(),materials={};let components=0;
 const featureCounts={shellPlates:0,clothPanels:0,coralHorns:0,ropePaths:0,windows:0,lanterns:0,winches:0};
 for(const z of ['hull','buoyancy','keep','bell_tower','bastions','dock','machinery','banners']){zones[z]=new T.Group();zones[z].name=z;root.add(zones[z]);}
 for(const [key,color]of Object.entries(P)){const m=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.98,metalness:0,side:T.DoubleSide});m.name='paint_'+key;if(/cyan|amber/.test(key)){m.emissive.set(color);m.emissiveIntensity=.18;}materials[key]=m;}
 const rotors=[],winchPivots=[],sails=[];
 function node(name,parent,at=[0,0,0],rotation=[0,0,0]){const g=new T.Group();g.name=name;g.position.fromArray(at);g.rotation.fromArray(rotation);(typeof parent==='string'?zones[parent]:parent).add(g);zones[name]=g;return name;}
 function add(g,key,zone,p=[0,0,0],r=[0,0,0],s=[1,1,1],uvMode='auto'){
  g.applyMatrix4(new T.Matrix4().compose(V(p),new T.Quaternion().setFromEuler(new T.Euler(...r)),V(s)));
  if(!g.attributes.normal)g.computeVertexNormals();const ps=g.attributes.position,ns=g.attributes.normal,c=new Float32Array(ps.count*3),base=new T.Color(P[key]);
  for(let i=0;i<ps.count;i++){const x=ps.getX(i),y=ps.getY(i),z=ps.getZ(i),n=ns.getX(i)*-.45+ns.getY(i)*.78+ns.getZ(i)*.43;
   const bright=/amber|cyan/.test(key)?1:(n>.45?1.04:n>-.25?.88:.70),stroke=1+.023*Math.sin(x*7+y*14+z*2)+.016*Math.sin(x*23+z*11);
   const nacre=/bone|pearl|rose/.test(key)?Math.sin(x*.8+y*1.4+z*.5)*.025:0;
   c[i*3]=Math.min(1,base.r*bright*stroke*(1+nacre));c[i*3+1]=Math.min(1,base.g*bright*stroke);c[i*3+2]=Math.min(1,base.b*bright*stroke*(1-nacre));}
  g.setAttribute('color',new T.BufferAttribute(c,3));
  if(!g.attributes.uv){const uv=new Float32Array(ps.count*2);for(let i=0;i<ps.count;i++){uv[2*i]=ps.getX(i)*.22;uv[2*i+1]=ps.getY(i)*.22;}g.setAttribute('uv',new T.BufferAttribute(uv,2));}
  const family=/bone|pearl|rose|lavender/.test(key)?0:/wood/.test(key)?1:/cloth|wine/.test(key)?2:/coral/.test(key)?3:/rope/.test(key)?4:/brass|edge/.test(key)?5:6;
  const uv=g.attributes.uv;let loU=Infinity,hiU=-Infinity,loV=Infinity,hiV=-Infinity;for(let i=0;i<uv.count;i++){loU=Math.min(loU,uv.getX(i));hiU=Math.max(hiU,uv.getX(i));loV=Math.min(loV,uv.getY(i));hiV=Math.max(hiV,uv.getY(i));}
  for(let i=0;i<uv.count;i++){let u=uv.getX(i),v=uv.getY(i);if(loU<0||hiU>1.001)u=(u-loU)/Math.max(.001,hiU-loU);if(loV<0||hiV>1.001)v=(v-loV)/Math.max(.001,hiV-loV);u=T.MathUtils.clamp(u,.001,.999);v=T.MathUtils.clamp(v,.001,.999);uv.setXY(i,(family%4+.035+.93*u)/4,(Math.floor(family/4)+.035+.93*v)/2);}
  for(const attr of Object.keys(g.attributes))if(!['position','normal','color','uv'].includes(attr))g.deleteAttribute(attr);
  g.clearGroups();const id=zone+':'+key;if(!bins.has(id))bins.set(id,[]);if(!g.index){const ids=Array.from({length:ps.count},(_,i)=>i);g.setIndex(ids);}bins.get(id).push(g);components++;
 }
 function meshGrid(N,M,fn){const ps=[],uv=[],ids=[];for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){ps.push(...fn(i/N,j/M));uv.push(i/N,j/M);}for(let j=0;j<M;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i;ids.push(a,a+1,a+N+1,a+1,a+N+2,a+N+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();return g;}
 const box=(z,k,p,s,r=[0,0,0])=>add(new T.BoxGeometry(...s),k,z,p,r);
 const orb=(z,k,p,s,seg=16)=>add(new T.SphereGeometry(1,seg,Math.max(8,seg/2)),k,z,p,[0,0,0],s);
 const cyl=(z,k,p,rt,rb,h,r=[0,0,0],open=false,seg=20)=>add(new T.CylinderGeometry(rt,rb,h,seg,1,open),k,z,p,r);
 const ring=(z,k,p,rad,tube=.045,r=[0,0,0],seg=24)=>add(new T.TorusGeometry(rad,tube,5,seg),k,z,p,r);
 function tube(z,k,points,rad=.045,steps=16,sides=5){add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(V)),steps,rad,sides,false),k,z);if(k==='rope')featureCounts.ropePaths++;}
 function rod(z,k,a,b,rad=.045,sides=7){const av=V(a),bv=V(b),dir=bv.clone().sub(av),g=new T.CylinderGeometry(rad,rad,dir.length(),sides);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());add(g,k,z);}
 function bolt(z,p,r=.055){orb(z,'brass',p,[r,r,.04],8);}
 function twisted(z,points,r=.035){const curve=new T.CatmullRomCurve3(points.map(V)),frames=curve.computeFrenetFrames(30,false);for(let strand=0;strand<2;strand++){const pp=[];for(let i=0;i<=60;i++){const t=i/60,angle=t*Math.PI*26+strand*Math.PI,f=Math.round(t*30);pp.push(curve.getPointAt(t).add(frames.normals[f].clone().multiplyScalar(Math.cos(angle)*r)).add(frames.binormals[f].clone().multiplyScalar(Math.sin(angle)*r)).toArray());}tube(z,'rope',pp,r*.6,64,4);}}
 function rail(z,points,h=.7){tube(z,'rope',points.map(p=>[p[0],p[1]+h,p[2]]),.032,Math.max(8,points.length*2));tube(z,'rope',points.map(p=>[p[0],p[1]+h*.45,p[2]]),.022,Math.max(8,points.length*2));for(const p of points){rod(z,'wood',[p[0],p[1]-.1,p[2]],[p[0],p[1]+h+.12,p[2]],.037);orb(z,'brass',[p[0],p[1]+h+.13,p[2]],[.055,.045,.055],8);}}
 function deck(z,at,L,W,rounded=true){const [x,y,zv]=at;for(let i=0;i<Math.ceil(L/.42);i++){const xx=-L/2+(i+.5)*L/Math.ceil(L/.42),width=rounded?W*(.62+.38*Math.sin((xx/L+.5)*Math.PI)):W;box(z,i%3?'wood':'woodLight',[x+xx,y,zv],[L/Math.ceil(L/.42)-.018,.14,width]);for(const ss of[-1,1])bolt(z,[x+xx,y+.08,zv+ss*(width/2-.11)],.023);}for(const side of[-1,1]){const points=Array.from({length:Math.ceil(L)+1},(_,i)=>{const xx=-L/2+i*L/Math.ceil(L),ww=rounded?W*(.62+.38*Math.sin((xx/L+.5)*Math.PI)):W;return[x+xx,y+.1,zv+side*ww/2];});rail(z,points);}}
 function hull(L,W,D){const samples=64,rings=20;const width=u=>Math.pow(Math.max(.001,Math.sin(u*Math.PI)),.52)*(1-.12*Math.cos(u*Math.PI));
  const g=meshGrid(samples,rings,(u,v)=>{const a=v*Math.PI*2;return[(u-.5)*L,Math.sin(a)*D*(.55+.25*Math.sin(u*Math.PI))-.35,Math.cos(a)*W*width(u)];});add(g,'wood','hull');
  // Real longitudinal strakes and asymmetric overlapping shell shrouds.
  for(const side of[-1,1])for(let level=0;level<5;level++){const yy=-D*.65+level*D*.27,pts=Array.from({length:33},(_,i)=>{const u=.045+i/32*.91;return[(u-.5)*L,yy,side*W*width(u)*(1-.08*level)];});tube('hull',level%2?'woodLight':'dark',pts,level===4?.065:.032,40,5);}
  deck('hull',[0,.52,0],L*.91,W*1.72);for(const side of[-1,1])for(let i=0;i<8;i++){const x=(i/7-.5)*L*.8;rod('hull','bone',[x,-D*.48,side*W*.7],[x,.6,side*W*.87],.075);}
 }
 function leaf(z,at,w,h,{rot=[0,0,0],key='pearl',holes=3,bulge=.24,seed=0}={}){
  const parent=node('ShellPlate_'+featureCounts.shellPlates,z,at,rot);featureCounts.shellPlates++;
  const sh=new T.Shape();sh.moveTo(0,-h*.53);sh.bezierCurveTo(-w*.18,-h*.38,-w*.57,-h*.04,-w*.48,h*.24);sh.bezierCurveTo(-w*.32,h*.5,-w*.09,h*.57,0,h*.56);sh.bezierCurveTo(w*.14,h*.52,w*.51,h*.17,w*.49,-h*.03);sh.bezierCurveTo(w*.43,-h*.25,w*.11,-h*.44,0,-h*.53);
  for(let j=0;j<holes;j++){const yy=h*(.04+j*.12),hh=new T.Path();hh.absellipse((j%2?.08:-.07)*w,yy,w*.075,h*.038,.05,Math.PI*2+.05,true);sh.holes.push(hh);}
  const g=new T.ExtrudeGeometry(sh,{depth:.065,bevelEnabled:true,bevelThickness:.028,bevelSize:.025,bevelSegments:2,curveSegments:16,steps:1}),p=g.attributes.position,uv=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,p.getZ(i)+bulge*(Math.sin((y/h+.53)*Math.PI)*(.7-Math.pow(x/w,2))));uv.push(x/w+.5,y/h+.54);}g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();add(g,key,parent);
  const outline=[];for(let i=0;i<=60;i++){const q=sh.getPoint(i/60);outline.push([q.x,q.y,.095+bulge*Math.sin((q.y/h+.53)*Math.PI)*(.7-Math.pow(q.x/w,2))]);}tube(parent,'bone',outline,.027,64,5);
  const mid=[];for(let i=0;i<=22;i++){const v=i/22;mid.push([Math.sin(v*3+seed)*w*.035,(v-.53)*h,.11+bulge*Math.sin(v*Math.PI)*.7]);}tube(parent,'rose',mid,.022,24,4);
  for(let j=0;j<6;j++){const yy=-h*.33+j*h*.09,ww=w*.33*Math.sin((yy/h+.53)*Math.PI),pts=[];for(let i=0;i<=10;i++){const u=-1+i/5;pts.push([u*ww,yy+Math.sin(Math.abs(u)*Math.PI/2)*h*.018,.10+bulge*Math.sin((yy/h+.53)*Math.PI)*(.7-Math.pow(u*ww/w,2))]);}tube(parent,j%2?'rose':'lavender',pts,.011,12,4);}
  for(const xx of[-.29,.29])bolt(parent,[xx*w,-h*.08,.13+bulge*.6],.043);
  return parent;
 }
 function pod(at,size,zone='buoyancy',key='cloth'){orb(zone,key,at,size,28);for(let band=0;band<5;band++){const t=-.78+band*.39,rr=Math.sqrt(1-t*t),pts=Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*2;return[at[0]+t*size[0],at[1]+Math.cos(a)*rr*size[1]*1.005,at[2]+Math.sin(a)*rr*size[2]*1.005];});tube(zone,'wine',pts,.035,48,5);for(const side of[-1,1])box(zone,'brass',[at[0]+t*size[0],at[1],at[2]+side*rr*size[2]*1.01],[.11,.22,.04]);}
  for(let j=0;j<8;j++){const a=j/8*Math.PI*2,pts=Array.from({length:30},(_,i)=>{const t=-.95+i/29*1.9,q=Math.sqrt(1-t*t);return[at[0]+t*size[0],at[1]+Math.cos(a)*q*size[1]*1.012,at[2]+Math.sin(a)*q*size[2]*1.012];});tube(zone,'rope',pts,.014,30,4);for(let i=2;i<28;i+=2){const p=pts[i];rod(zone,'wine',[p[0]-.025,p[1]-.025,p[2]],[p[0]+.025,p[1]+.025,p[2]],.012,4);}}
 }
 function sail(at,w,h,rotation=[0,0,0],key='wine',shape='square'){
  const z=node('Canvas_'+featureCounts.clothPanels,'banners',at,rotation);featureCounts.clothPanels++;sails.push(z);
  const point=(u,v)=>{const ww=shape==='triangle'?(1-v*.85):1;return[(u-.5)*w*ww,-v*h+.10*h*Math.sin(Math.PI*u)*(1-v),.32*Math.sin(u*Math.PI)*Math.sin(v*Math.PI*.85)+.12*Math.sin(u*13+v*4)*v];};
  add(meshGrid(32,22,point),key,z);
  for(const edge of[0,1])tube(z,'rope',Array.from({length:25},(_,i)=>point(edge,i/24)),.022,26,4);
  for(const v of[0,1])tube(z,'rope',Array.from({length:33},(_,i)=>point(i/32,v)),.023,34,4);
  for(let j=0;j<7;j++){const u=(j+.5)/7;for(let i=1;i<12;i++){const a=point(u,i/13),b=point(u+.012,(i+.45)/13);rod(z,'cloth',a,b,.014,4);}}
  // Original stitched faction mark: a split diamond and joining seam, no imported logo.
  const y=-h*.45,zz=.35;rod(z,'cloth',[0,y+h*.15,zz],[0,y-h*.18,zz],.033,5);for(const s of[-1,1]){rod(z,'cloth',[0,y+h*.12,zz],[s*w*.12,y,zz],.032,5);rod(z,'cloth',[s*w*.12,y,zz],[0,y-h*.12,zz],.032,5);rod(z,'cloth',[0,y-h*.12,zz],[s*w*.09,y-h*.24,zz],.025,5);}
  return z;
 }
 function canopy(at,w,d,h,key='wine'){const[zx,zy,zz]=at;const point=(u,v)=>[(u-.5)*w,h*Math.sin(u*Math.PI)*(.88+.12*Math.cos(v*Math.PI)),(v-.5)*d];add(meshGrid(28,18,point),key,'banners',at);for(const v of[0,1]){const pp=Array.from({length:29},(_,i)=>{const p=point(i/28,v);return[p[0]+zx,p[1]+zy,p[2]+zz];});tube('banners','rope',pp,.035,30,4);}for(const sx of[-1,1])for(const sz of[-1,1])rod('banners','wood',[zx+sx*w*.5,zy-1.3,zz+sz*d*.5],[zx+sx*w*.5,zy,zz+sz*d*.5],.055);}
 function cabin(at,w=2,h=2,d=2.3){const[x,y,z]=at;box('keep','wood',[x,y+h*.43,z],[w,h*.86,d]);for(const side of[-1,1])for(let j=0;j<3;j++){const xx=x-w*.33+j*w*.33,zz=z+side*(d*.5+.025);box('keep','dark',[xx,y+h*.45,zz],[w*.23,h*.50,.04]);box('keep',j%2?'amber':'cyan',[xx,y+h*.45,zz+side*.025],[w*.16,h*.39,.03]);for(const yy of[-.23,.23])rod('keep','brass',[xx-w*.13,y+h*(.45+yy),zz+side*.05],[xx+w*.13,y+h*(.45+yy),zz+side*.05],.022);rod('keep','bone',[xx,y+h*.22,zz+side*.07],[xx,y+h*.70,zz+side*.07],.027);featureCounts.windows++;}
  add(meshGrid(28,16,(u,v)=>[(u-.5)*w*1.22,h*.82+Math.sin(u*Math.PI)*w*.30,(v-.5)*d*1.2]),'pearl','keep',at);
  for(let j=0;j<=6;j++)tube('keep',j%2?'rose':'bone',Array.from({length:23},(_,i)=>[x+(i/22-.5)*w*1.22,y+h*.82+Math.sin(i/22*Math.PI)*w*.30+.035,z+(j/6-.5)*d*1.2]),.035,24,5);
  deck('keep',[x,y+h*.05,z+d*.5+.45],w*1.12,.9,false);
 }
 function mast(x,y,h,z=0){rod('banners','wood',[x,y,z],[x,y+h,z],.075,10);rod('banners','brass',[x-1.5,y+h*.77,z],[x+1.5,y+h*.77,z],.045);for(const side of[-1,1])twisted('banners',[[x-2,y-.4,z+side*1.2],[x-.1,y+h*.9,z],[x+2,y-.3,z+side*1.2]],.021);orb('banners','brass',[x,y+h,z],[.12,.15,.12]);}
 function lantern(at,key='cyan',scale=1){const z=node('Lantern_'+featureCounts.lanterns,'banners',at);featureCounts.lanterns++;orb(z,key,[0,0,0],[.10*scale,.23*scale,.10*scale],10);cyl(z,'brass',[0,.25*scale,0],.16*scale,.12*scale,.09*scale);cyl(z,'brass',[0,-.23*scale,0],.13*scale,.16*scale,.08*scale);for(let i=0;i<4;i++){const a=i*Math.PI/2;rod(z,'brass',[Math.cos(a)*.13*scale,-.20*scale,Math.sin(a)*.13*scale],[Math.cos(a)*.13*scale,.22*scale,Math.sin(a)*.13*scale],.018*scale,4);}ring(z,'brass',[0,.36*scale,0],.07*scale,.02*scale);}
 function engine(at,scale=1){const[x,y,z]=at;orb('machinery','metal',at,[1.1*scale,.48*scale,.48*scale],20);for(const dx of[-.7,0,.7])ring('machinery','brass',[x+dx*scale,y,z],.49*scale,.055*scale,[0,Math.PI/2,0]);for(const side of[-1,1])tube('machinery','brass',[[x-.8*scale,y,z+side*.3*scale],[x,y+.6*scale,z+side*.3*scale],[x+.6*scale,y,z+side*.3*scale]],.055*scale,14,6);const id=node('Rotor_'+rotors.length,'machinery',[x+1.3*scale,y,z]);rotors.push(id);cyl(id,'brass',[0,0,0],.17*scale,.22*scale,.36*scale,[0,0,Math.PI/2]);
  for(let j=0;j<4;j++){const blade=node('Blade_'+j+'_'+rotors.length,id,[0,0,0],[j*Math.PI/2,0,0]);add(meshGrid(10,10,(u,v)=>[(u-.5)*.20*scale+v*.16*scale,.22*scale+v*1.35*scale,Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*.14*scale+(u-.5)*(.25+.18*v)*scale]),'woodLight',blade);tube(blade,'brass',[[0,.23*scale,0],[.04*scale,.8*scale,0],[.1*scale,1.55*scale,0]],.025*scale,12,4);}
 }
 function winch(at,s=1){featureCounts.winches++;const[x,y,z]=at;const id=node('WinchDrum_'+featureCounts.winches,'dock',at);winchPivots.push(id);cyl(id,'wood',[0,0,0],.55*s,.55*s,1.45*s,[Math.PI/2,0,0]);
  const pp=[];for(let i=0;i<=300;i++){const t=i/300,a=t*Math.PI*30;pp.push([Math.cos(a)*.60*s,Math.sin(a)*.60*s,(t-.5)*1.40*s]);}tube(id,'rope',pp,.045*s,360,5);
  for(const side of[-1,1]){cyl('dock','brass',[x,y,z+side*.86*s],.89*s,.89*s,.11*s,[Math.PI/2,0,0]);ring('dock','edge',[x,y,z+side*.93*s],.78*s,.045*s);for(let j=0;j<10;j++){const a=j/10*Math.PI*2;rod('dock','brass',[x+Math.cos(a)*.2*s,y+Math.sin(a)*.2*s,z+side*.94*s],[x+Math.cos(a)*.72*s,y+Math.sin(a)*.72*s,z+side*.94*s],.035*s);}box('dock','wood',[x,y-.8*s,z+side*.78*s],[1.7*s,.24*s,.25*s]);rod('dock','brass',[x-.65*s,y-.8*s,z+side*.78*s],[x,y,z+side*.78*s],.1*s);rod('dock','brass',[x+.65*s,y-.8*s,z+side*.78*s],[x,y,z+side*.78*s],.1*s);}
 }
 function chain(z,a,b,count=12,size=.16){for(let i=0;i<count;i++){const t=i/(count-1),p=V(a).lerp(V(b),t);p.y-=Math.sin(t*Math.PI)*.15;ring(z,'metal',p.toArray(),size,.035,i%2?[0,Math.PI/2,0]:[0,0,0],14);}}
 function hook(z,at,s=1){const[x,y,zz]=at;tube(z,'brass',[[x,y,zz],[x,y-.7*s,zz],[x-.5*s,y-1.05*s,zz],[x-.85*s,y-.6*s,zz],[x-.65*s,y-.3*s,zz]],.095*s,22,7);}
 function harpoon(at,s=1){const[x,y,z]=at;box('dock','wood',[x,y-.25*s,z],[2.3*s,.2*s,.5*s]);for(const side of[-1,1])rod('dock','brass',[x-.95*s,y,z+side*.25*s],[x+1.1*s,y,z+side*.25*s],.045*s);rod('dock','metal',[x+1*s,y+.10*s,z],[x-1.4*s,y+.10*s,z],.07*s);const sh=new T.Shape();sh.moveTo(-2*s,0);sh.lineTo(-1.1*s,.28*s);sh.lineTo(-1.35*s,.04*s);sh.lineTo(-1.1*s,-.28*s);sh.closePath();add(new T.ExtrudeGeometry(sh,{depth:.07*s,bevelEnabled:false}),'bone','dock',[x,y+.12*s,z],[Math.PI/2,0,0]);}
 function net(z,at,w,h){const[x,y,zz]=at;for(const diag of[-1,1])for(let j=-8;j<=8;j++){const pts=[];for(let i=0;i<=20;i++){const u=i/20,v=j/8+diag*u;if(v<0||v>1)continue;pts.push([x+(u-.5)*w,y-v*h,zz+.22*Math.sin(v*Math.PI)]);}if(pts.length>1)tube(z,'rope',pts,.016,14,4);}}
 function coral(z,at,size=1,axis=[-1,0,0]){
  featureCounts.coralHorns++;const id=node('CoralHorn_'+featureCounts.coralHorns,z,at);const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(-1,0,0),V(axis).normalize());zones[id].quaternion.copy(q);
  const curve=new T.CatmullRomCurve3([V([1.2*size,0,0]),V([.1*size,.02*size,0]),V([-1.4*size,.16*size,0]),V([-3.1*size,.55*size,0])]);const steps=42,sides=32,frames=curve.computeFrenetFrames(steps,false);
  for(const inside of[false,true]){const g=meshGrid(sides,steps,(u,t)=>{const a=u*Math.PI*2,f=Math.round(t*steps),rad=(.30+Math.pow(t,2.6)*.80)*size*(inside?.79:1)*(1+.055*Math.sin(a*7+t*5)+.035*Math.sin(a*11-t*8));return curve.getPointAt(t).add(frames.normals[f].clone().multiplyScalar(Math.cos(a)*rad)).add(frames.binormals[f].clone().multiplyScalar(Math.sin(a)*rad)).toArray();});add(g,inside?'coral':'coralLight',id);}
  const mouth=curve.getPointAt(1);const rim=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2,rad=1.10*size*(1+.055*Math.sin(a*7+5)+.035*Math.sin(a*11-8));rim.push(mouth.clone().add(frames.normals[steps].clone().multiplyScalar(Math.cos(a)*rad)).add(frames.binormals[steps].clone().multiplyScalar(Math.sin(a)*rad)).toArray());}tube(id,'coral',rim,.09*size,68,7);
  // Deep throat closes only at the breech; the trumpet mouth remains truly open.
  cyl(id,'dark',[.85*size,0,0],.28*size,.28*size,.06*size,[0,0,Math.PI/2]);for(const xx of[.65,-.2])ring(id,'brass',[xx*size,0,0],.40*size,.055*size,[0,Math.PI/2,0]);
  for(let j=0;j<7;j++){const t=.42+j*.077,a=j*2.4,f=Math.round(t*steps),base=curve.getPointAt(t),rr=(.3+Math.pow(t,2.6)*.8)*size;const n=frames.normals[f].clone().multiplyScalar(Math.cos(a)).add(frames.binormals[f].clone().multiplyScalar(Math.sin(a)));const start=base.clone().addScaledVector(n,rr*.8),end=start.clone().addScaledVector(n,(.4+rnd(j)*.7)*size);tube(id,j%2?'coral':'coralLight',[start.toArray(),start.clone().lerp(end,.6).add(V([.15*size,.1*size,0])).toArray(),end.toArray()],.10*size,14,7);orb(id,'coral',end.toArray(),[.13*size,.13*size,.13*size],10);}
  for(let j=0;j<8;j++){const a=j/8*Math.PI*2;const pts=[];for(let i=0;i<=22;i++){const t=i/22,f=Math.round(t*steps),rad=(.305+Math.pow(t,2.6)*.80)*size;pts.push(curve.getPointAt(t).add(frames.normals[f].clone().multiplyScalar(Math.cos(a)*rad*1.015)).add(frames.binormals[f].clone().multiplyScalar(Math.sin(a)*rad*1.015)).toArray());}tube(id,'coral',pts,.018*size,25,4);}
  return id;
 }
 function stairs(z,a,b,width=.7){const dist=V(b).sub(V(a)),count=Math.max(4,Math.ceil(Math.abs(dist.y)/.22));for(let i=0;i<=count;i++){const p=V(a).lerp(V(b),i/count);box(z,'woodLight',p.toArray(),[.32,.08,width]);}for(const side of[-1,1])rod(z,'rope',[a[0],a[1]+.7,a[2]+side*width*.5],[b[0],b[1]+.7,b[2]+side*width*.5],.025);}
 function finish(){for(const[id,list]of bins){const [z,key]=id.split(':'),g=mergeGeometries(list,false);if(!g)throw Error('Merge failed '+id);const mesh=new T.Mesh(g,materials[key]);mesh.name=z+'_'+key;zones[z].add(mesh);for(const x of list)x.dispose();}
  const times=Array.from({length:25},(_,i)=>i/4),tracks=[];
  for(const id of rotors){const values=[];for(const t of times)values.push(...new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),t*Math.PI*4/3).toArray());tracks.push(new T.QuaternionKeyframeTrack(id+'.quaternion',times,values));}
  for(const id of winchPivots){const values=[];for(const t of times)values.push(...new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.sin(t*Math.PI/3)*.22).toArray());tracks.push(new T.QuaternionKeyframeTrack(id+'.quaternion',times,values));}
  root.userData={revision:'chapter2-fleet-assets-v1',kind,authoredComponents:components,featureCounts,coordinate:'+Y up, -X bow; relative art units',gameplayImplemented:false,artDirection:'10x bold silhouettes, curved perforated nacre plates, hollow organic coral, working decks, stitched drapery, ropework and brush atlas'};
  root.updateMatrixWorld(true);return{root,clips:[new T.AnimationClip('MechanicalExhibition',6,tracks)],featureCounts,components};
 }
 return{root,zones,node,add,meshGrid,box,orb,cyl,ring,tube,rod,bolt,twisted,rail,deck,hull,leaf,pod,sail,canopy,cabin,mast,lantern,engine,winch,chain,hook,harpoon,net,coral,stairs,finish};
}
