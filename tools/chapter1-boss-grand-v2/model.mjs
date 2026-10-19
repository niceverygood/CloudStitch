import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original visual revision. Relative art units; no gameplay module/stat changes.
export function buildBoss(){
 const root=new T.Group();root.name='BellDevourer';
 root.userData={sourceId:'boss-bell-devourer',visualRevision:'chapter1-boss-review-v1',artDirection:'10倍 boldness: leviathan jaw, enormous hollow bell, layered funeral machinery; hand-painted depth',gameplayImplemented:false};
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
  for(const a of Object.keys(g.attributes))if(!['position','normal'].includes(a))g.deleteAttribute(a);g.setAttribute('color',new T.BufferAttribute(c,3));const id=z+':'+k;if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(g);parts++;
 }
 const box=(z,k,p,s,r=[0,0,0])=>add(new T.BoxGeometry(...s,2,2,2),k,z,p,r);
 const ell=(z,k,p,s)=>add(new T.SphereGeometry(1,Math.max(...s)<.2?8:32,Math.max(...s)<.2?6:20),k,z,p,[0,0,0],s);
 const cyl=(z,k,p,rt,rb,h,r=[0,0,0],open=false)=>add(new T.CylinderGeometry(rt,rb,h,24,2,open),k,z,p,r);
 const ring=(z,k,p,rad,tube=.08,r=[0,0,0])=>add(new T.TorusGeometry(rad,tube,8,40),k,z,p,r);
 function tube(z,k,pts,rad=.1){add(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(v=>new T.Vector3(...v))),32,rad,8,false),k,z);}
 function rod(z,k,a,b,rad=.1){const av=new T.Vector3(...a),bv=new T.Vector3(...b),dir=bv.clone().sub(av);const g=new T.CylinderGeometry(rad,rad,dir.length(),10);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());add(g,k,z);}
 function panel(z,k,pts){const p=[];for(let i=1;i<pts.length-1;i++)p.push(...pts[0],...pts[i],...pts[i+1]);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();add(g,k,z);}
 function chain(z,a,b,count=12){const av=new T.Vector3(...a),bv=new T.Vector3(...b);for(let i=0;i<count;i++){const p=av.clone().lerp(bv,i/(count-1));ring(z,'brass',p.toArray(),.18,.052,i%2?[0,Math.PI/2,0]:[0,0,0]);}}
 function taper(z,k,pts,radius){const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,40,1,10,false),pos=g.attributes.position;for(let i=0;i<=40;i++){const center=curve.getPointAt(i/40),r=radius*Math.pow(1-i/40,.7)+.015;for(let j=0;j<=10;j++){const id=i*11+j;const p=new T.Vector3().fromBufferAttribute(pos,id).sub(center).multiplyScalar(r).add(center);pos.setXYZ(id,...p.toArray());}}g.computeVertexNormals();add(g,k,z);}
 function drape(z,k,at,w,h,side=1){const g=new T.PlaneGeometry(w,h,32,18),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),v=(h/2-y)/h; p.setXYZ(i,x,y+(Math.sin(x*6)>0?.2:.6)*Math.pow(v,6),side*(Math.sin(x*1.5+v*2)*.27+v*.55));}g.computeVertexNormals();add(g,k,z,at);}
 // Wide sculpted vessel: longitudinal rings, fully closed underside, low stern.
 const profile=[[-17,.4,1],[-14,3.3,2.1],[-10,4.5,2.7],[-3,4.9,3.1],[5,4.7,3],[12,3.6,2.5],[16,1.6,1.5],[17,.1,.25]];
 for(let q=0;q<profile.length-1;q++)for(let j=0;j<32;j++){const v=(row,angle)=>{const[x,w,d]=profile[row];return[x,-.7+Math.sin(angle)*d,Math.cos(angle)*w];};const a=j/32*Math.PI*2,b=(j+1)/32*Math.PI*2;panel('hull',j<16?'iron':'red',[v(q,a),v(q+1,a),v(q+1,b),v(q,b)]);}
 box('hull','wood',[0,1.72,0],[28,.28,7.1]);for(let x=-13;x<14;x+=.55)box('hull','dark',[x,1.88,0],[.025,.025,7]);
 for(const side of[-1,1]){
  for(let row=0;row<3;row++)for(let i=0;i<12;i++){const x=-14+i*2.55,z=side*(4.2-Math.pow((x-1)/18,2)*1.5-row*.4),y=1.05-row*1.55;
   box('hull',row===2?'red':i%3?'iron':'dark',[x,y,z],[2.65,1.55,.2],[0,side*.05,0]);for(const dx of[-1,1])for(const dy of[-.5,.5])ell('hull','brass',[x+dx,y+dy,z+side*.14],[.065,.065,.045]);
  }
  tube('hull','brass',[[-15,1.9,side*2.2],[-9,2.15,side*4.5],[3,2.15,side*4.8],[12,1.9,side*3.6],[16,.8,side*1.8]],.12);
  for(let x=-11;x<14;x+=1.6){rod('hull','brass',[x,2,side*3.7],[x,2.8,side*3.7],.045);}rod('hull','brass',[-11,2.8,side*3.7],[13,2.8,side*3.7],.045);
 }
 // Predatory armored mask. Both cheeks modeled, not a front-facing cutout.
 ell('keep','dark',[-15,.2,0],[4.8,2.15,3.25]);
 for(const side of[-1,1]){
  panel('keep','iron',[[-20,2,side*.3],[-15,3,side*3.4],[-11,1.9,side*4],[-13,.6,side*3.7],[-18,.5,side*2.3]]);
  box('keep','dark',[-16.4,1.4,side*2.8],[3.6,.85,.45],[side*.15,side*-.4,-.12]);
  box('keep','ember',[-16.5,1.25,side*3.03],[2.2,.24,.16],[0,side*-.4,-.16]);
  tube('keep','edge',[[-20,.2,side*.4],[-17,-1.4,side*3],[-13,-.9,side*3.9]],.22);
  for(let i=0;i<7;i++){const x=-19.2+i*.98;add(new T.ConeGeometry(.32,.9+(i%3)*.25,4),i%2?'edge':'iron','keep',[x,-.8,side*(1.3+i*.38)],[0,0,Math.PI+.13]);}
  taper('keep','brass',[[-12.8,-.5,side*3.7],[-14,-2.4,side*4.2],[-18,-3.3,side*3.9],[-21,-2.5,side*2.6]],.68);
  tube('keep','dark',[[-14,-2.6,side*3],[-17,-3,side*2.8],[-20,-2.3,side*1.1]],.3);
 }
 panel('keep','iron',[[-20,2,0],[-16,3.2,-2.5],[-12,3.2,0],[-16,3.2,2.5]]);
 // Swollen, stitched buoyancy volumes frame rather than fill the bell chamber.
 for(const [x,y,z,sx,sy,sz]of[[-7,6.1,0,7,3,3.8],[-6,5.8,-4.1,5.4,2.3,1.7],[-6,5.8,4.1,5.4,2.3,1.7],[11.1,6.1,-2.4,4.8,2.65,2.05],[11.1,6.1,2.4,4.8,2.65,2.05]]){
  ell('buoyancy','cream',[x,y,z],[sx,sy,sz]);
  for(const t of[-.6,-.25,.15,.55]){const xx=x+t*sx,rr=Math.sqrt(1-t*t),pts=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;pts.push([xx,y+Math.sin(a)*sy*rr*1.015,z+Math.cos(a)*sz*rr*1.015]);}tube('buoyancy','dark',pts,.11);for(const side of[-1,1])box('buoyancy','brass',[xx,y-.35, z+side*sz*rr],[.32,.48,.12]);}
  for(let j=0;j<7;j++){const a=j/7*Math.PI*2,pts=[];for(let i=0;i<=28;i++){const t=-.93+i/28*1.86,rr=Math.sqrt(1-t*t);pts.push([x+t*sx,y+Math.sin(a)*sy*rr*1.008,z+Math.cos(a)*sz*rr*1.008]);}tube('buoyancy','cloth',pts,.025);}
 }
 // Cathedral-size hollow bell and open rib chamber, with an actual swinging pivot.
 for(const x of[-1.6,6])for(const side of[-1,1]){tube('bell_tower','dark',[[x,.9,side*4.9],[x,6.4,side*4.1],[x,10.4,side*2.3],[x,11.2,0]],.3);tube('bell_tower','brass',[[x-.34,1,side*4.9],[x-.34,6.4,side*4.1],[x-.34,10.4,side*2.3],[x-.34,11.2,0]],.075);}
 rod('bell_tower','dark',[-2,11.2,0],[6.5,11.2,0],.4);
 const pivot=node('BellSwing',groups.bell_tower,[2,10.3,0]);
 const bellProfile=[[.25,0],[.8,-.3],[1.15,-1],[1.35,-2.3],[1.65,-3.5],[2.2,-4.3],[2.6,-4.6],[2.55,-4.84],[2.3,-4.8],[1.95,-4.45],[1.4,-3.4],[1.12,-2.2],[.92,-1],[.6,-.48],[.25,-.4]];
 add(new T.LatheGeometry(bellProfile.map(p=>new T.Vector2(...p)),64), 'brass','BellSwing');
 for(const y of[-.4,-1.4,-3.45,-4.6])ring('BellSwing','gold',[0,y,0],y===-4.6?2.55:y===-3.45?1.65:y===-1.4?1.24:.84,.07,[Math.PI/2,0,0]);
 rod('BellSwing','dark',[0,-.6,0],[0,-4.2,0],.14);ell('BellSwing','dark',[0,-4.3,0],[.36,.45,.36]);
 chain('bell_tower',[2,11.2,0],[2,10.2,0],5);
 for(const side of[-1,1]){drape('banners','cream',[-.6,8,side*4.15],1.1,5.3,side);drape('banners','red',[6.5,8,side*3.6],2,5.2,side);}
 // Dark crown, uneven chimney skyline, sealing canisters and glowing furnace slits.
 for(let i=0;i<7;i++){const x=5.5+i*1.15,z=i%2?1.4:-1.4,h=3.8+(i%3)*1.1; cyl('machinery','dark',[x,6+h/2,z],.34,.52,h);for(const y of[6.3,6+h-.2])cyl('machinery','brass',[x,y,z],.52,.52,.18);cyl('machinery','black',[x,6+h+.03,z],.29,.29,.04);}
 for(const side of[-1,1])for(let i=0;i<3;i++){cyl('machinery','dark',[9+i*1.8,3,side*2.5],.65,.65,2);ring('machinery','brass',[9+i*1.8,3,side*2.5],.66,.08,[Math.PI/2,0,0]);box('machinery','ember',[9+i*1.8,3,side*3.16],[.35,.7,.04]);}
 // Side gun rows: hollow muzzles, brass bands, carriages and recoil blocks.
 for(const side of[-1,1])for(let i=0;i<9;i++){const x=-10.6+i*2.7,z=side*(4.1-Math.pow((x-1)/20,2)),y=2.5;
  box('bastions','dark',[x,y,z],[1.6,1.1,1.1]);cyl('bastions','iron',[x,y+.2,z+side*1.15],.35,.48,2.3,[Math.PI/2,0,0],true);
  ring('bastions','brass',[x,y+.2,z+side*2.3],.35,.085);cyl('bastions','black',[x,y+.2,z+side*1.35],.29,.29,.02,[Math.PI/2,0,0]);
  for(const zz of[.4,1.7])ring('bastions','brass',[x,y+.2,z+side*zz],zz===.4?.46:.38,.06);
 }
 // Rear engines with articulated propellers and large teal housings.
 for(const [x,y,z,scale]of[[14,0,3.6,1],[14,0,-3.6,1],[15.3,-1,0,1.25]]){const id='Rotor'+rotors.length;
  ell('machinery','teal',[x,y,z],[2.4*scale,1.4*scale,1.4*scale]);for(const dx of[-1,.2,1.3])ring('machinery','brass',[x+dx,y,z],1.4*scale,.1,[0,Math.PI/2,0]);
  const rotor=node(id,groups.machinery,[x+2.5*scale,y,z]);rotors.push(rotor);cyl(id,'brass',[0,0,0],.4,.4,.65,[0,0,Math.PI/2]);for(let j=0;j<4;j++){const a=j*Math.PI/2;add(new T.SphereGeometry(1,20,12),'teal',id,[0,Math.cos(a)*1.45*scale,Math.sin(a)*1.45*scale],[a,0,0],[.16,1.6*scale,.43*scale]);}
 }
 // Front auxiliary towing winches, chain and hooked lower claws.
 for(const side of[-1,1]){
  box('dock','dark',[4.7,.5,side*5],[3,1.2,1.5]);cyl('dock','wood',[4.7,.5,side*5.1],.65,.65,1.9,[Math.PI/2,0,0]);for(let j=0;j<8;j++)ring('dock','brass',[4.7,.5,side*(4.3+j*.22)],.68,.06);
  chain('dock',[4.7,.1,side*5.2],[4.7,-4.2,side*5.2],16);tube('dock','dark',[[4.7,-4.2,side*5.2],[4.7,-5.5,side*5.2],[3.8,-6,side*5.2],[3.2,-5.3,side*5.2],[3.5,-4.9,side*5.2]],.25);
 }
 // Crown pennants and stitched funeral cloth, asymmetrically layered.
 for(const side of[-1,1])for(const[x,y,w,h]of[[-10,5,3,2.1],[9,7,3.4,3.4],[12,6.4,2.3,3.2]]){drape('banners','cloth',[x,y,side*3.5],w,h,side);drape('banners','red',[x+.5,y+.1,side*3.57],w*.3,h*.94,side);}
 rod('banners','brass',[9,8.5,0],[9,13,0],.07);drape('banners','red',[11,12,0],4,1.5);
 // Grand revision: re-proportion the main masses, rather than scaling the old ship.
 // An armored leviathan breastplate supports terraced shoulders and an open crown.
 for(const side of[-1,1]){
  // Raised armored cheeks with forged brow, hollow eye and aggressive temple fins.
  ell('keep','iron',[-15.5,1.1,side*2.7],[3.8,2.1,1.2]);
  box('keep','dark',[-17.1,2.2,side*3.65],[3.1,.8,.5],[0,side*-.2,-.25]);
  box('keep','ember',[-17.3,1.95,side*3.94],[2.35,.32,.08],[0,side*-.2,-.25]);
  taper('keep','dark',[[-12,2.1,side*3.4],[-13,4.2,side*4.7],[-15,5,side*4.8]],.75);
  taper('keep','brass',[[-11.4,-.5,side*4.3],[-13.2,-3.8,side*5.5],[-17.4,-4.6,side*4.9],[-22.4,-3.2,side*2.5]],.95);
  for(let i=0;i<10;i++){const x=-20+i*.95,z=side*(1.3+Math.sin(i/10*Math.PI)*2.6);add(new T.ConeGeometry(.4,1.5+(i%3)*.28,5),'edge','keep',[x,-1.1,z],[0,0,Math.PI+.2]);}
  // Great overlapping hanging cuirass plates: thick volume, seam trim and rivets.
  for(let i=0;i<9;i++){
   const x=-10.5+i*2.9,z=side*(4.7-Math.pow((x-1)/22,2)*1.35);
   const shape=new T.Shape();shape.moveTo(-1.48,1.4);shape.lineTo(1.48,1.4);shape.lineTo(1.3,-1.6);shape.lineTo(0,-2.5);shape.lineTo(-1.3,-1.6);shape.closePath();
   add(new T.ExtrudeGeometry(shape,{depth:.4,bevelEnabled:true,bevelSize:.12,bevelThickness:.1,bevelSegments:1,steps:1}),i%2?'dark':'iron','hull',[x,-.3,z],[0,side<0?Math.PI:0,0]);
   tube('hull','brass',[[x-1.3,1,z+side*.6],[x-1.15,-1.6,z+side*.6],[x,-2.7,z+side*.6],[x+1.15,-1.6,z+side*.6],[x+1.3,1,z+side*.6]],.065);
   box('hull','red',[x,-.8,z+side*.65],[.42,1.85,.1]);
  }
  // Upper terraced gun galleries, corbels, shutters and cathedral-like furnace slits.
  for(let tier=0;tier<2;tier++){
   const y=3.5+tier*2,z=side*(4.9-tier*.75),start=tier?-7:-10,end=tier?10:13;
   box('bastions','dark',[(start+end)/2,y-.45,z],[end-start+1,.55,1.65]);
   rod('bastions','brass',[start-.5,y-.08,z+side*.9],[end+.5,y-.08,z+side*.9],.12);
   for(let x=start;x<=end;x+=3.4){
    box('bastions','iron',[x,y+.4,z],[2.6,1.2,.9]);
    cyl('bastions','iron',[x,y+.4,z+side*1.2],.5,.64,2.5,[Math.PI/2,0,0],true);
    ring('bastions','brass',[x,y+.4,z+side*2.45],.5,.11);
    cyl('bastions','black',[x,y+.4,z+side*1.5],.4,.4,.06,[Math.PI/2,0,0]);
    tube('hull','dark',[[x,0,z-side*.4],[x,2,z+side*.7],[x,y-.5,z+side*.9]],.28);
   }
  }
  // Large asymmetrical stern shoulder towers; large surfaces remain readable.
  for(const [x,y,h]of[[10,6.2,5.2],[13,5.3,4.7]]){
   const z=side*3.3;cyl('machinery','dark',[x,y,z],1.05,1.4,h);
   for(const yy of[y-h/2+.15,y+h/2-.25])cyl('machinery','brass',[x,yy,z],1.42,1.42,.24);
   for(let j=0;j<4;j++)box('machinery','ember',[x-.65+j*.43,y,z+side*1.25],[.16,1.5,.08]);
   add(new T.ConeGeometry(1.65,2.3,8),'iron','machinery',[x,y+h/2+1.1,z]);
  }
  // Richly layered cloth, stitched hem and large seal disks.
  drape('banners','red',[8,9,side*5.3],3.8,6.3,side);
  for(const x of[6.3,9.7])tube('banners','brass',[[x,9,side*5.35],[x,6,side*5.6],[x,3.2,side*5.75]],.04);
  cyl('banners','brass',[8,7.3,side*5.7],.55,.55,.1,[Math.PI/2,0,0]);
 }
 // Amplify the open bell sanctuary: flank buttresses, roof crown and engraved rings.
 for(const x of[-2.5,6.8])for(const side of[-1,1]){
  tube('bell_tower','iron',[[x,-1.5,side*5.9],[x,4,side*6.1],[x,10.3,side*4],[x,14,side*1.4],[x,14.5,0]],.48);
  tube('bell_tower','brass',[[x-.46,0,side*6],[x-.46,4,side*6.2],[x-.46,10.3,side*4.1],[x-.46,14,side*1.4]],.09);
  for(const y of[3,6,9])box('bell_tower','brass',[x,y,side*(6-y*.18)],[1,.32,1]);
  add(new T.ConeGeometry(.48,2.5,5),'brass','bell_tower',[x,14.8,side*1.4]);
 }
 rod('bell_tower','iron',[-3,14.5,0],[7.2,14.5,0],.45);
 // Move and enlarge the bell itself, preserving the existing articulated pivot.
 pivot.position.y=12.8;pivot.scale.set(1.42,1.55,1.42);
 chain('bell_tower',[2,14.5,0],[2,12.8,0],7);
 for(let j=0;j<24;j++){const a=j*Math.PI/12;box('BellSwing','gold',[Math.cos(a)*1.6,-3.35,Math.sin(a)*1.6],[.12,.45,.08],[0,-a,0]);}
 // Winged funeral crown: arch-shaped roof, sockets and unequal great smoke horns.
 for(const side of[-1,1]){
  tube('machinery','dark',[[5.5,8,side*2.2],[6,13,side*3],[8,15.2,side*3.7],[10,15.4,side*4.2]],.65);
  for(const[x,y]of[[6,12],[8,15]])ring('machinery','brass',[x,y,side*(x===6?3:3.7)],.7,.12,[Math.PI/2,0,0]);
 }
 for(const[id,list]of buckets){const sep=id.indexOf(':'),zone=id.slice(0,sep),key=id.slice(sep+1),mesh=new T.Mesh(mergeGeometries(list,false),mats[key]);mesh.name=zone+'_'+key;groups[zone].add(mesh);list.forEach(g=>g.dispose());}
 const times=Array.from({length:25},(_,i)=>i/4),tracks=[];
 const quaternionTrack=(obj,axis,angle)=>{const values=[];for(const t of times){const q=new T.Quaternion().setFromAxisAngle(axis,angle(t));values.push(...q.toArray());}tracks.push(new T.QuaternionKeyframeTrack(obj.name+'.quaternion',times,values));};
 quaternionTrack(pivot,new T.Vector3(0,0,1),t=>Math.sin(t*Math.PI/3)*.16);
 for(const rotor of rotors)quaternionTrack(rotor,new T.Vector3(1,0,0),t=>t*Math.PI*4/3);
 clips.push(new T.AnimationClip('Exhibition_bell_and_propellers',6,tracks));
 root.userData.authored_components=parts;root.updateMatrixWorld(true);
 return{root,clips,zones:Object.keys(labels)};
}
