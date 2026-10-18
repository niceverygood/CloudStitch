import * as THREE from 'three';

function mesh(parent, geometry, material, name, position = [0,0,0]) {
  const object = new THREE.Mesh(geometry, material); object.name = name;
  object.position.fromArray(position); parent.add(object); return object;
}
export function bone(name, parent, position = [0,0,0]) {
  const object = new THREE.Bone(); object.name = name; object.position.fromArray(position);
  if (parent) parent.add(object); return object;
}
export function tube(parent, points, radius, material, name, segments = 20) {
  return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))), segments, radius, 5, false), material, name);
}
function patchGeometry(points,reverse=false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
  g.setIndex(reverse?[0,2,1,0,3,2]:[0,1,2,0,2,3]);g.computeVertexNormals();return g;
}
export async function loadMaterials(atlasDataURL) {
  const base = await new THREE.TextureLoader().loadAsync(atlasDataURL);
  base.colorSpace=THREE.SRGBColorSpace;
  const result={}; const tiles={wood:[0,1],canvas:[1,1],metal:[2,1],brass:[0,0],teal:[1,0],rope:[2,0]};
  for(const [name,[column,row]] of Object.entries(tiles)) {
    const map=base.clone();map.repeat.set(1/3-.008,.5-.008);map.offset.set(column/3+.004,row/2+.004);map.needsUpdate=true;
    result[name]=new THREE.MeshStandardMaterial({map,roughness:1,metalness:0,color:0xffffff,side:THREE.DoubleSide});result[name].name=`Cloudstitch handpainted ${name}`;
  }
  const tint=(name,source,color)=>{result[name]=result[source].clone();result[name].color.set(color);result[name].name=`Cloudstitch ${name}`;};
  tint('coral','canvas',0xc17b60);tint('navy','canvas',0x414e65);tint('glass','teal',0x83bfc2);
  tint('darkWood','wood',0x806452);tint('dark','metal',0x5d6469);tint('ivory','canvas',0xfff2d2);
  return result;
}
export function makeHull({id,length=10,width=2.6,depth=1.4,bow=.35,bowClip=.10,sternClip=.10,style='warm',materials}) {
  const root=bone(`${id}_Hull`);root.userData={moduleId:id,moduleType:'hull',parentId:'HullMotion'};
  const iron=style==='union'||style==='ghost', main=iron?materials.metal:materials.wood;
  const rim=iron?materials.dark:materials.teal;
  const half=x=>{const t=THREE.MathUtils.clamp(x,0,1),clip=THREE.MathUtils.lerp(bowClip,sternClip,t);return width*.5*(clip+(1-clip)*Math.sin(Math.PI*t)**.58)};
  const rise=t=>bow*(Math.exp(-t*9)+.3*Math.exp(-(1-t)*8));
  // A continuous, closed inner hull sits directly behind the individual boards.
  // Narrow plank seams reveal timber/iron rather than the background sky.
  const shellPositions=[],shellUV=[],shellIndices=[],shellSections=48,shellRows=12;
  const shellPoint=(t,v,side)=>[(t-.5)*length,rise(t)-depth*v+.001,side*half(t)*(.15+.85*Math.cos(v*Math.PI/2))*.995];
  for(const side of [-1,1]){
    const base=shellPositions.length/3;
    for(let i=0;i<=shellSections;i++)for(let j=0;j<=shellRows;j++){
      shellPositions.push(...shellPoint(i/shellSections,j/shellRows,side));shellUV.push(i/shellSections,j/shellRows);
    }
    for(let i=0;i<shellSections;i++)for(let j=0;j<shellRows;j++){
      const a=base+i*(shellRows+1)+j,b=a+shellRows+1;
      if(side<0)shellIndices.push(a,b,b+1,a,b+1,a+1);
      else shellIndices.push(a,b+1,b,a,a+1,b+1);
    }
  }
  for(let i=0;i<shellSections;i++){
    const a=i/shellSections,b=(i+1)/shellSections;
    for(const v of [0,1]){
      const base=shellPositions.length/3;
      shellPositions.push(...shellPoint(a,v,-1),...shellPoint(b,v,-1),...shellPoint(b,v,1),...shellPoint(a,v,1));
      shellUV.push(a,0,b,0,b,1,a,1);
      if(v===0)shellIndices.push(base,base+2,base+1,base,base+3,base+2);
      else shellIndices.push(base,base+1,base+2,base,base+2,base+3);
    }
  }
  // Rounded stem caps complete both ends; the forward stem projects gently
  // beyond the strakes instead of ending in an open, square cut.
  for(const [t,direction] of [[0,-1],[1,1]]){
    const perimeter=[];
    for(let j=0;j<=shellRows;j++)perimeter.push(shellPoint(t,j/shellRows,-1));
    for(let j=shellRows;j>=0;j--)perimeter.push(shellPoint(t,j/shellRows,1));
    const centerY=rise(t)-depth*.46,base=shellPositions.length/3;
    for(const shrink of [1,.5])for(const p of perimeter){
      shellPositions.push(p[0]+direction*width*.045*(1-shrink),centerY+(p[1]-centerY)*shrink,p[2]*shrink);
      shellUV.push(.5+p[2]/Math.max(width,.01),.5+(p[1]-centerY)/Math.max(depth*2,.01));
    }
    const count=perimeter.length,tip=shellPositions.length/3;
    shellPositions.push((t-.5)*length+direction*width*.085,centerY,0);shellUV.push(.5,.5);
    for(let j=0;j<count;j++){
      const next=(j+1)%count,a=base+j,b=base+next,c=base+count+j,d=base+count+next;
      if(direction<0)shellIndices.push(a,b,d,a,d,c,c,d,tip);
      else shellIndices.push(a,d,b,a,c,d,c,tip,d);
    }
  }
  const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(shellPositions,3));shell.setAttribute('uv',new THREE.Float32BufferAttribute(shellUV,2));shell.setIndex(shellIndices);shell.computeVertexNormals();
  mesh(root,shell,iron?materials.dark:materials.darkWood,`${id}_closed_inner_shell`);
  const bands=5,sections=16;
  for(const side of [-1,1]) for(let row=0;row<bands;row++) for(let segment=0;segment<sections;segment++) {
    const a=segment/sections+.002,b=(segment+1)/sections-.002;
    const va=row/bands+.009,vb=(row+1)/bands-.009;
    const p=(t,v)=>[(t-.5)*length,rise(t)-depth*v,side*half(t)*(.15+.85*Math.cos(v*Math.PI/2))];
    const g=patchGeometry([p(a,va),p(b,va),p(b,vb),p(a,vb)],side>0);
    mesh(root,g,row%2?main:main,`${id}_strake_${side}_${row}_${segment}`);
  }
  // Board gaps, a sealed keel, deck planks and curved rails produce a readable
  // timber hull rather than a stretched box or an undifferentiated ellipsoid.
  for(let i=0;i<20;i++){
    const a=i/20+.001,b=(i+1)/20-.001;
    mesh(root,patchGeometry([[(a-.5)*length,rise(a)+.012,-half(a)*.97],[(b-.5)*length,rise(b)+.012,-half(b)*.97],[(b-.5)*length,rise(b)+.012,half(b)*.97],[(a-.5)*length,rise(a)+.012,half(a)*.97]],true),materials.wood,`${id}_deck_${i}`);
    mesh(root,patchGeometry([[(a-.5)*length,-depth+rise(a),-.15*half(a)],[(b-.5)*length,-depth+rise(b),-.15*half(b)],[(b-.5)*length,-depth+rise(b),.15*half(b)],[(a-.5)*length,-depth+rise(a),.15*half(a)]]),main,`${id}_keel_${i}`);
  }
  for(const side of [-1,1]) for(const row of [0,.48]){
    const points=Array.from({length:25},(_,i)=>{const t=i/24;return[(t-.5)*length,rise(t)-depth*row+.08,side*half(t)*(.15+.85*Math.cos(row*Math.PI/2))]});
    tube(root,points,row===0?.10:.065,rim,`${id}_rim_${side}_${row}`,40);
  }
  for(const t of [.15,.32,.52,.72,.88]){
    const x=(t-.5)*length,w=half(t);
    const pts=Array.from({length:17},(_,i)=>{const a=Math.PI*i/16;return[x,rise(t)-depth*Math.sin(a),-w*Math.cos(a)]});
    tube(root,pts,.065,materials.brass,`${id}_rib_${t}`,20);
    for(const side of [-1,1])mesh(root,new THREE.SphereGeometry(.09,8,6),materials.brass,`${id}_rivet_${t}_${side}`,[x,rise(t)-.15,side*w*1.006]);
  }
  return {root,halfWidth:half,rise};
}
export function makeCabin({id,materials,width=1.6,length=2.1,height=1.3,style='warm'}) {
  const root=bone(`${id}_Cabin`);root.userData={moduleId:id,moduleType:'cabin',parentId:'HullMotion'};
  const main=style==='union'?materials.metal:materials.wood;
  mesh(root,new THREE.BoxGeometry(length,height,width),main,`${id}_walls`,[0,height/2,0]);
  for(let i=0;i<6;i++)for(const side of [-1,1]){
    const x=(i/5-.5)*length*.9,cy=height*.55,clearance=.44;
    const panel=(bottom,top,suffix)=>{if(top-bottom>.025)mesh(root,new THREE.BoxGeometry(.035,top-bottom,.035),materials.darkWood,`${id}_panel_${i}_${side}_${suffix}`,[x,(bottom+top)/2,side*(width*.5+.009)]);};
    if(Math.abs(x)<clearance){const cut=Math.sqrt(clearance*clearance-x*x);panel(height*.03,Math.max(height*.03,cy-cut),'lower');panel(Math.min(height*.97,cy+cut),height*.97,'upper');}
    else panel(height*.03,height*.97,'full');
  }
  const shape=new THREE.Shape();shape.moveTo(-width*.62,0);shape.quadraticCurveTo(0,.52,width*.62,0);shape.lineTo(width*.62,.16);shape.quadraticCurveTo(0,.68,-width*.62,.16);shape.closePath();
  const roof=new THREE.ExtrudeGeometry(shape,{depth:length*1.13,bevelEnabled:false,curveSegments:12});roof.rotateY(Math.PI/2);roof.translate(-length*.565,height,0);
  const roofUV=roof.attributes.uv;let loU=Infinity,loV=Infinity,hiU=-Infinity,hiV=-Infinity;
  for(let i=0;i<roofUV.count;i++){loU=Math.min(loU,roofUV.getX(i));loV=Math.min(loV,roofUV.getY(i));hiU=Math.max(hiU,roofUV.getX(i));hiV=Math.max(hiV,roofUV.getY(i));}
  for(let i=0;i<roofUV.count;i++)roofUV.setXY(i,(roofUV.getX(i)-loU)/Math.max(hiU-loU,.0001),(roofUV.getY(i)-loV)/Math.max(hiV-loV,.0001));
  mesh(root,roof,style==='ghost'?materials.navy:materials.teal,`${id}_arched_roof`);
  for(const side of [-1,1]){
    const glass=mesh(root,new THREE.CircleGeometry(.34,20),materials.glass,`${id}_round_window_${side}`,[0,height*.55,side*(width*.5+.075)]);
    if(side<0)glass.rotation.y=Math.PI;
    const rim=mesh(root,new THREE.TorusGeometry(.37,.065,6,24),materials.brass,`${id}_window_brass_${side}`,[0,height*.55,side*(width*.5+.085)]);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;mesh(root,new THREE.SphereGeometry(.035,6,4),materials.dark,`${id}_window_bolt_${side}_${i}`,[Math.cos(a)*.37,height*.55+Math.sin(a)*.37,side*(width*.5+.15)]);}
    mesh(root,new THREE.BoxGeometry(.04,.58,.04),materials.teal,`${id}_window_cross_v_${side}`,[0,height*.55,side*(width*.5+.095)]);
    mesh(root,new THREE.BoxGeometry(.58,.04,.04),materials.teal,`${id}_window_cross_h_${side}`,[0,height*.55,side*(width*.5+.095)]);
  }
  mesh(root,new THREE.BoxGeometry(.04,height*.7,width*.32),materials.darkWood,`${id}_door`,[-length*.505,height*.35,0]);
  mesh(root,new THREE.SphereGeometry(.04,8,6),materials.brass,`${id}_handle`,[-length*.54,height*.4,width*.1]);
  const lantern=bone(`${id}_Lantern`,root,[length*.22,height+.55,0]);
  mesh(lantern,new THREE.CylinderGeometry(.13,.15,.28,8),materials.brass,`${id}_lantern_body`);
  mesh(lantern,new THREE.SphereGeometry(.095,8,6),materials.ivory,`${id}_lantern_light`);
  mesh(lantern,new THREE.ConeGeometry(.2,.16,8),materials.brass,`${id}_lantern_hat`,[0,.21,0]);
  return {root};
}
export function makeEnvelope({id,materials,length=9,radius=1.4,flatten=1,style='warm',patched=true}) {
  const root=bone(`${id}_Envelope`);root.userData={moduleId:id,moduleType:'balloon',parentId:'HullMotion'};
  const flex=bone(`${id}_Flex`,root);
  const geo=new THREE.SphereGeometry(1,36,20);geo.scale(length/2,radius*flatten,radius);
  mesh(flex,geo,style==='ghost'?materials.navy:materials.canvas,`${id}_canvas`);
  // Sparse longitude seams and thick leather straps sit on the ellipsoid.
  for(let seam=0;seam<10;seam++){
    const a=2*Math.PI*seam/10,points=[];
    for(let i=1;i<32;i++){const p=Math.PI*i/32;points.push([-Math.cos(p)*length*.502,Math.sin(p)*Math.sin(a)*radius*flatten*1.006,Math.sin(p)*Math.cos(a)*radius*1.006]);}
    tube(flex,points,.012,materials.rope,`${id}_seam_${seam}`,32);
  }
  for(const u of [-.27,.27]){
    const x=length*u,rr=Math.sqrt(1-(x/(length/2))**2);
    const points=Array.from({length:41},(_,i)=>{const a=Math.PI*2*i/40;return[x,Math.sin(a)*radius*flatten*rr*1.016,Math.cos(a)*radius*rr*1.016]});
    tube(flex,points,.075,materials.darkWood,`${id}_strap_${u}`,40);
    for(const side of [-1,1]){
      mesh(flex,new THREE.BoxGeometry(.23,.26,.075),materials.brass,`${id}_buckle_${u}_${side}`,[x,-radius*flatten*rr*.4,side*radius*rr*.94]);
    }
  }
  for(const side of [-1,1]){
    const cap=mesh(flex,new THREE.CylinderGeometry(.14,.18,.11,12),materials.brass,`${id}_endcap_${side}`,[side*length*.501,0,0]);cap.rotation.z=Math.PI/2;
  }
  if(patched){
    // A subdivided triangle follows the ellipsoid rather than forming a flat
    // chord inside it. Parameters are longitudinal X/L and angle on -Z side.
    const corners=[[-.32,.2],[-.16,.25],[-.22,.92]],N=12,positions=[],uv=[],indices=[],rows=new Map();
    const project=(u,a,out=1.012)=>{const rr=Math.sqrt(Math.max(0,1-(2*u)**2));return[u*length,Math.sin(a)*radius*flatten*rr*out,-Math.cos(a)*radius*rr*out];};
    for(let i=0;i<=N;i++)for(let j=0;j<=N-i;j++){
      const a=i/N,b=j/N,c=1-a-b,u=c*corners[0][0]+a*corners[1][0]+b*corners[2][0],angle=c*corners[0][1]+a*corners[1][1]+b*corners[2][1];
      rows.set(`${i},${j}`,positions.length/3);positions.push(...project(u,angle));uv.push(a,b);
    }
    for(let i=0;i<N;i++)for(let j=0;j<N-i;j++){
      const a=rows.get(`${i},${j}`),b=rows.get(`${i+1},${j}`),c=rows.get(`${i},${j+1}`);indices.push(a,b,c);
      if(i+j<N-1)indices.push(b,rows.get(`${i+1},${j+1}`),c);
    }
    const p=new THREE.BufferGeometry();p.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));p.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));p.setIndex(indices);p.computeVertexNormals();mesh(flex,p,materials.coral,`${id}_coral_repair`);
    for(let edge=0;edge<3;edge++){
      const a=corners[edge],b=corners[(edge+1)%3],dx=(b[0]-a[0])*length,dy=(b[1]-a[1])*radius,norm=Math.hypot(dx,dy),du=-dy/norm*.045/length,da=dx/norm*.045/radius;
      for(let s=1;s<10;s++){
        const t=s/10,u=THREE.MathUtils.lerp(a[0],b[0],t),angle=THREE.MathUtils.lerp(a[1],b[1],t);
        tube(flex,[project(u-du,angle-da,1.022),project(u,angle,1.027),project(u+du,angle+da,1.022)],.012,materials.ivory||materials.canvas,`${id}_cream_stitch_${edge}_${s}`,5);
      }
    }
  }
  return {root,flex,controls:[{bone:flex,role:'envelope',axis:'x',amplitude:.002}]};
}
