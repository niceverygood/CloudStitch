import * as THREE from 'three';
import { makeHull, makeEnvelope } from '../fleet/body.js';
export { THREE };

export function group(parent, name, at = [0,0,0], rot = [0,0,0]) {
  const node = new THREE.Bone(); node.name = name; node.position.fromArray(at); node.rotation.fromArray(rot);
  node.userData = { moduleId: name, moduleType: 'visual-assembly', parentId: parent?.userData?.moduleId || parent?.name || null };
  if (parent) parent.add(node); return node;
}
export function mesh(parent, geometry, mat, name, at = [0,0,0], rot = [0,0,0]) {
  const uv = geometry.attributes.uv;
  if (uv) {
    let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
    for(let i=0;i<uv.count;i++){a=Math.min(a,uv.getX(i));b=Math.min(b,uv.getY(i));c=Math.max(c,uv.getX(i));d=Math.max(d,uv.getY(i));}
    if(a<0||b<0||c>1||d>1) for(let i=0;i<uv.count;i++) uv.setXY(i,(uv.getX(i)-a)/Math.max(c-a,.001),(uv.getY(i)-b)/Math.max(d-b,.001));
  }
  const node = new THREE.Mesh(geometry, mat); node.name=name; node.position.fromArray(at); node.rotation.fromArray(rot); parent.add(node); return node;
}
export function box(parent,mat,name,at,size,rot=[0,0,0]) { return mesh(parent,new THREE.BoxGeometry(...size),mat,name,at,rot); }
export function cyl(parent,mat,name,at,radius,length,axis='y',segments=16,topRadius=radius) {
  const node=mesh(parent,new THREE.CylinderGeometry(topRadius,radius,length,segments,1,false),mat,name,at);
  if(axis==='x')node.rotation.z=Math.PI/2; if(axis==='z')node.rotation.x=Math.PI/2; return node;
}
export function sphere(parent,mat,name,at,size,detail=20) { const g=new THREE.SphereGeometry(1,detail,Math.max(8,Math.floor(detail/2)));g.scale(...size);return mesh(parent,g,mat,name,at); }
export function tube(parent,mat,name,points,radius=.04,segments=24) {
  return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,6,false),mat,name);
}
export function beam(parent,mat,name,a,b,radius=.04) {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const node=mesh(parent,new THREE.CylinderGeometry(radius,radius,Math.max(delta.length(),.0001),8),mat,name,start.add(end).multiplyScalar(.5).toArray());
  node.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); return node;
}
export function ring(parent,mat,name,at,radius,thickness=.04,axis='x') {
  const node=mesh(parent,new THREE.TorusGeometry(radius,thickness,6,28),mat,name,at);
  if(axis==='x')node.rotation.y=Math.PI/2; if(axis==='y')node.rotation.x=Math.PI/2; return node;
}
export function panel(parent,mat,name,at,size,rot=[0,0,0],rivetMat) {
  const node=box(parent,mat,name,at,size,rot);
  if(rivetMat){const holder=group(parent,name+'-rivet-frame',at,rot);for(const x of [-1,1])for(const y of [-1,1])sphere(holder,rivetMat,name+'-rivet-'+x+'-'+y,[x*size[0]*.4,y*size[1]*.38,size[2]*.6],[.042,.042,.028],8);}
  return node;
}
export function hull(parent,m,name,{length=11,width=3.6,depth=1.8,at=[0,0,0],bow=.6,style='wood'}={}) {
  const built=makeHull({id:name,length,width,depth,bow,style:style==='metal'?'union':'warm',materials:m,bowClip:style==='metal'?.4:.05,sternClip:.3});
  built.root.position.fromArray(at);parent.add(built.root);built.root.name=name;return built.root;
}
export function balloon(parent,m,name,{length=8,radius=1.5,at=[0,4.5,0],flatten=1,material='canvas',net=true,ragged=false}={},controls=[]) {
  const built=makeEnvelope({id:name,materials:{...m,canvas:m[material]||m.canvas},length,radius,flatten,patched:false});
  built.root.name=name;built.root.position.fromArray(at);parent.add(built.root);controls.push(...built.controls);
  if(net) {
    for(let band=0;band<5;band++) {
      const t=(band-2)*.16,x=t*length,rr=Math.sqrt(1-4*t*t);
      const pts=Array.from({length:37},(_,i)=>{const a=i*Math.PI*2/36;return[x,Math.sin(a)*radius*flatten*rr*1.02,Math.cos(a)*radius*rr*1.02];});
      tube(built.flex,m.rope,name+'-binding-'+band,pts,.025,36);
      for(const side of [-1,1])sphere(built.flex,m.darkWood,name+'-knot-'+band+'-'+side,[x,-radius*.32,side*radius*rr*.95],[.05,.045,.05],8);
    }
  }
  if(ragged)for(const side of [-1,1])cloth(built.flex,m.gray,name+'-torn-wrap-'+side,{at:[0,radius*.45,side*radius*.7],width:length*.94,height:radius*1.7,ragged:true,billow:side*.18});
  return built.root;
}
export function cloth(parent,mat,name,{at=[0,0,0],width=3,height=2,ragged=false,rotation=[0,0,0],horizontal=false,billow=.25}={}) {
  const p=[],uv=[],ix=[],nx=32,ny=10;
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++) {
    const u=x/nx,v=y/ny;
    const tear=ragged? Math.pow(v,4)*(x%5===0?.92:x%3===0?.05:.38)*Math.min(height*.34,.85):.06*Math.sin(u*9)*v;
    const px=(u-.5)*width,py=-v*height+tear,pz=Math.sin(u*Math.PI*4)*.045+Math.sin(u*Math.PI)*v*billow;
    p.push(px,horizontal?pz:py,horizontal?py:pz);uv.push(u,1-v);
  }
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=y*(nx+1)+x,b=a+nx+1;ix.push(a,b,a+1,a+1,b,b+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
  return mesh(parent,g,mat,name,at,rotation);
}
export function control(controls,node,role,axis,amplitude,extra={}) {controls.push({bone:node,role,axis,amplitude,...extra});return node;}
export function engine(parent,m,name,{at=[0,0,0],scale=1,rotation=[0,0,0]}={},controls=[]) {
  const root=group(parent,name,at,rotation);root.scale.setScalar(scale);root.userData.moduleType='engine';
  const body=group(root,name+'_Vibration');control(controls,body,'vibration','y',.025);
  cyl(body,m.dark,name+'-housing',[0,0,0],.67,1.3,'x',24,.61);
  for(const x of [-.6,0,.6])ring(body,m.brass,name+'-brass-rim-'+x,[x,0,0],.68,.055,'x');
  for(let i=0;i<10;i++){const a=i*Math.PI/5;box(body,m.brass,name+'-radiator-'+i,[0,Math.sin(a)*.67,Math.cos(a)*.67],[.72,.055,.11],[a,0,0]);}
  const rotor=group(body,name+'_Rotor',[.82,0,0]);control(controls,rotor,'rotor','x',Math.PI*2);
  cyl(rotor,m.brass,name+'-hub',[0,0,0],.19,.32,'x',16);
  for(let i=0;i<4;i++){const blade=group(rotor,name+'-blade-pivot-'+i,[0,0,0],[i*Math.PI/2,0,0]);sphere(blade,m.teal,name+'-blade-'+i,[0,.65,0],[.06,.66,.22],16);}
  ring(root,m.brass,name+'-protective-ring',[.85,0,0],1.22,.045,'x');
  for(let i=0;i<6;i++){const a=i*Math.PI/3;beam(root,m.metal,name+'-guard-'+i,[.86,Math.sin(a)*.2,Math.cos(a)*.2],[.86,Math.sin(a)*1.22,Math.cos(a)*1.22],.025);}
  tube(body,m.dark,name+'-exhaust',[[0,.55,0],[0,.95,0],[.45,1.07,0]],.1,12);
  return root;
}
export function cannon(parent,m,name,{at=[0,0,0],scale=1,rotation=[0,0,0],kind='cannon'}={},controls=[]) {
  const root=group(parent,name,at,rotation);root.scale.setScalar(scale);root.userData.moduleType=kind;
  cyl(root,m.darkWood,name+'-turntable',[0,.09,0],.44,.2,'y',18);ring(root,m.brass,name+'-turntable-rim',[0,.2,0],.4,.04,'y');
  const yaw=group(root,name+'_Aim',[0,.22,0]);control(controls,yaw,'yaw','y',.15);
  const recoil=group(yaw,name+'_Recoil',[0,.33,0]);control(controls,recoil,'recoil','x',.13);
  const r=kind==='machinegun'?.1:.17;
  cyl(recoil,m.metal,name+'-barrel',[-.65,0,0],r,1.5,'x',14,r*.9);
  for(const x of [-1.3,-.75,-.25])ring(recoil,m.brass,name+'-collar-'+x,[x,0,0],r*1.16,.035,'x');
  cyl(recoil,m.dark,name+'-muzzle',[-1.41,0,0],r*.78,.035,'x',14);
  box(yaw,m.darkWood,name+'-cradle',[.05,.13,0],[.65,.2,.62]);
  if(kind==='harpoon') {const cone=mesh(recoil,new THREE.ConeGeometry(.2,.65,4),m.brass,name+'-harpoon-head',[-1.68,0,0],[0,0,Math.PI/2]);tube(root,m.rope,name+'-coiled-line',[[.25,.2,-.35],[.5,.45,-.4],[.8,.35,-.2]],.025,15);}
  return root;
}
export function lantern(parent,m,name,at,scale=.3) {
  const root=group(parent,name,at);root.scale.setScalar(scale);
  box(root,m.glow,name+'-warm-glass',[0,0,0],[.7,1,.7]);
  for(const x of [-1,1])for(const z of [-1,1])beam(root,m.dark,name+'-cage-'+x+'-'+z,[x*.38,-.55,z*.38],[x*.38,.55,z*.38],.06);
  box(root,m.brass,name+'-base',[0,-.55,0],[.88,.13,.88]);mesh(root,new THREE.ConeGeometry(.67,.4,4),m.brass,name+'-roof',[0,.72,0],[0,Math.PI/4,0]);ring(root,m.dark,name+'-hanger',[0,1.08,0],.18,.045,'z');return root;
}
export async function loadPaintedMaterials(dataURL) {
  const texture=await new THREE.TextureLoader().loadAsync(dataURL);texture.colorSpace=THREE.SRGBColorSpace;
  const m={},tiles={wood:[0,1],canvas:[1,1],metal:[2,1],brass:[0,0],teal:[1,0],rope:[2,0]};
  for(const [name,[x,y]]of Object.entries(tiles)){const map=texture.clone();map.offset.set(x/3+.008,y/2+.012);map.repeat.set(1/3-.016,.5-.024);map.needsUpdate=true;m[name]=new THREE.MeshStandardMaterial({map,roughness:1,metalness:0,side:THREE.DoubleSide});m[name].name='reference-painted '+name;}
  const tint=(name,source,color)=>{m[name]=m[source].clone();m[name].color.set(color);m[name].name='reference-painted '+name;};
  tint('darkWood','wood',0x9b806c);tint('dark','metal',0x74818b);tint('red','canvas',0xad4330);tint('coral','canvas',0xbf6850);tint('blue','canvas',0x386887);tint('navy','canvas',0x38495a);tint('gray','canvas',0x9aa3ab);tint('glass','teal',0xd5f1e6);tint('ivory','canvas',0xfff6df);
  m.glow=new THREE.MeshBasicMaterial({color:0xffc36e,toneMapped:false});m.glow.name='reference warm lantern';
  m.coldGlow=new THREE.MeshBasicMaterial({color:0x72d5df,toneMapped:false});m.coldGlow.name='reference residual cyan';
  return m;
}
export function createContext(id,m) {const scene=new THREE.Scene();scene.name='Cloudstitch_reference_'+id;const root=group(scene,'RigRoot');const motion=group(root,'HullMotion');return{id,scene,root,motion,m,controls:[]};}
export function paintVolume(scene) {
  scene.updateMatrixWorld(true);const light=new THREE.Vector3(-.35,.8,-.5).normalize(),n=new THREE.Vector3();
  scene.traverse(node=>{if(!node.isMesh||!node.geometry.attributes.normal)return;const g=node.geometry,p=g.attributes.position,normal=g.attributes.normal,colors=new Float32Array(p.count*3),nm=new THREE.Matrix3().getNormalMatrix(node.matrixWorld),mats=Array.isArray(node.material)?node.material:[node.material];
    const glow=mats.every(mat=>mat.name.includes('lantern')||mat.name.includes('residual'));
    for(let i=0;i<p.count;i++){n.fromBufferAttribute(normal,i).applyMatrix3(nm).normalize();const value=glow?1:.72+.28*Math.max(0,n.dot(light));colors[i*3]=value;colors[i*3+1]=value;colors[i*3+2]=value;}
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));for(const mat of mats)mat.vertexColors=true;
  });
}
