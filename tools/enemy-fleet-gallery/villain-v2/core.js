import * as THREE from 'three';
import {group,mesh,box,sphere,beam,tube,ring,cloth,hull,balloon,engine,control,lantern,loadPaintedMaterials,paintVolume as paintKit} from '../../enemy-fleet-reference/kit.js';
export {THREE,group,mesh,box,sphere,beam,tube,ring,cloth,hull,balloon,engine,control,lantern};

// The bodies in this revision start in an empty scene. The shared kit supplies
// craft materials and joints, never an existing generic airship body.
export function createContext(id,m){
 const scene=new THREE.Scene();scene.name='Cloudstitch_bold_enemy_'+id;
 const root=group(scene,'RigRoot'),motion=group(root,'HullMotion');
 return {id,scene,root,motion,controls:[],m,threats:[]};
}
export function plate(parent,mat,name,points,depth,at=[0,0,0],rot=[0,0,0]){
 const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:Math.min(depth*.12,.12),bevelThickness:Math.min(depth*.1,.1),bevelSegments:1,curveSegments:8,steps:1});g.translate(0,0,-depth/2);
 return mesh(parent,g,mat,name,at,rot);
}
export function gear(parent,mat,name,at,radius,axis='x'){
 const root=group(parent,name,at);ring(root,mat,name+'-rim',[0,0,0],radius,.14,axis);
 const n=Math.max(10,Math.round(radius*6));for(let i=0;i<n;i++){
  const a=i*Math.PI*2/n,p=axis==='x'?[0,Math.sin(a)*radius,Math.cos(a)*radius]:axis==='y'?[Math.sin(a)*radius,0,Math.cos(a)*radius]:[Math.sin(a)*radius,Math.cos(a)*radius,0];
  const node=box(root,mat,name+'-tooth-'+i,p,axis==='x'?[.32,.35,.4]:axis==='y'?[.35,.32,.4]:[.35,.4,.32]);
  if(axis==='x')node.rotation.x=-a;if(axis==='y')node.rotation.y=a;if(axis==='z')node.rotation.z=-a;
 }
 for(let i=0;i<6;i++){const a=i*Math.PI/3,p=axis==='x'?[0,Math.sin(a)*radius*.88,Math.cos(a)*radius*.88]:axis==='y'?[Math.sin(a)*radius*.88,0,Math.cos(a)*radius*.88]:[Math.sin(a)*radius*.88,Math.cos(a)*radius*.88,0];beam(root,mat,name+'-spoke-'+i,[0,0,0],p,.095);}
 return root;
}
export function chain(parent,m,name,points,links=14){
 const root=group(parent,name),curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 for(let i=0;i<links;i++){
  const t=(i+.5)/links,p=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
  const link=mesh(root,new THREE.TorusGeometry(.16,.045,5,10),i%4?m.iron:m.brass,name+'-link-'+i,p.toArray());
  link.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tangent);link.rotateY(i%2*Math.PI/2);link.scale.y=1.35;
 }return root;
}
export function gun(parent,m,name,{at=[0,0,0],scale=1,rotation=[0,0,0],barrelRadius=.4,barrelLength=3}={},controls=[]){
 const root=group(parent,name,at,rotation);root.scale.setScalar(scale);root.userData.moduleType='cannon';
 const yaw=group(root,name+'-Yaw');control(controls,yaw,'yaw','y',.16);
 const recoil=group(yaw,name+'-Recoil',[0,.7,0]);control(controls,recoil,'recoil','x',.25);
 sphere(recoil,m.iron,name+'-breech',[.35,0,0],[1.1,barrelRadius*1.7,barrelRadius*1.6],18);
 const cyl=(mat,suffix,x,r,l)=>mesh(recoil,new THREE.CylinderGeometry(r,r*.93,l,18),mat,name+suffix,[x,0,0],[0,0,Math.PI/2]);
 cyl(m.iron,'-forged-barrel',-barrelLength*.45,barrelRadius,barrelLength);
 for(const t of [.05,.35,.8])ring(recoil,m.brass,name+'-band-'+t,[-barrelLength*t,0,0],barrelRadius*1.08,.12,'x');
 cyl(m.ink,'-black-bore',-barrelLength*.955,barrelRadius*.76,.05);ring(recoil,m.iron,name+'-flared-muzzle',[-barrelLength*.955,0,0],barrelRadius*.96,.18,'x');
 plate(yaw,m.darkWood,name+'-curved-carriage',[[-1.1,-.2],[-.75,.5],[.65,.55],[1.25,-.2]],1.5,[.2,-.3,0]);
 for(const side of [-1,1])gear(yaw,m.brass,name+'-elevation-'+side,[.3,.5,side*.8],.55,'z');
 return root;
}
export function claw(parent,m,name,at,scale=1){
 const root=group(parent,name,at);root.scale.setScalar(scale);
 sphere(root,m.iron,name+'-knuckle',[0,0,0],[.5,.55,.5],14);
 for(let i=0;i<3;i++){
  const pivot=group(root,name+'-jaw-'+i,[0,0,0],[0,i*Math.PI*2/3,0]);
  plate(pivot,m.iron,name+'-curved-finger-'+i,[[0,.3],[.5,.15],[.8,-.6],[.65,-1.4],[.15,-1.85],[.36,-1.12],[.28,-.45],[-.2,-.1]],.24);
  sphere(pivot,m.brass,name+'-rivet-'+i,[.2,-.1,.16],[.12,.12,.08],8);
 }return root;
}
export function threat(ctx,node,axis='z',angle=.2){
 if(!node?.isBone)throw Error('Threat display target must be a named Bone: '+node?.name);
 ctx.threats.push({node,axis,angle,bind:node.quaternion.clone()});return node;
}
export function threatClip(ctx){
 const times=[0,.7,1.4,2,2.6,3.5,4.8,6],phases=[0,-.15,-.35,1,.65,.24,-.12,0],tracks=[];
 for(const [i,t] of ctx.threats.entries()){
  const axis=new THREE.Vector3(...(t.axis==='x'?[1,0,0]:t.axis==='y'?[0,1,0]:[0,0,1])),values=[];
  for(const p of phases)t.bind.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis,p*t.angle*(i%2?-.85:1))).normalize().toArray(values,values.length);
  tracks.push(new THREE.QuaternionKeyframeTrack(t.node.name+'.quaternion',times,values));
 }
 const clip=new THREE.AnimationClip('ThreatDisplay',6,tracks);clip.userData={visualOnly:true,availableAction:true,fullPose:false};return clip;
}
export async function makeMaterials(atlas,id){
 const p=await loadPaintedMaterials(atlas),cult=/cult|funeral|defense/.test(id),ghost=/ghost/.test(id),royal=/inhale/.test(id),tax=/tax/.test(id);
 const palette=royal?{ink:0x4a3d54,iron:0x82718b,brass:0xf0be69,wood:0x97746e,ivory:0xf0dcc4,red:0xb73d62,teal:0x87708f,canvas:0xaf687c,gray:0xaaa0ab}:ghost?{ink:0x4a6572,iron:0x91acb0,brass:0xa6b9aa,wood:0x9a9990,ivory:0xd9e5cd,red:0x708399,teal:0x64aaa5,canvas:0xb5cbd0,gray:0xc0cbd1}:cult?{ink:0x4c4c59,iron:0x85848e,brass:0xd6b88a,wood:0x9b8276,ivory:0xe9dec4,red:0xaf4052,teal:0x778184,canvas:0xe1cdb1,gray:0xa2a1ab}:{ink:0x47565a,iron:0x7d8e91,brass:0xd7b17b,wood:0xc0926a,ivory:0xe5d4ae,red:tax?0xa43f48:0xb65b4c,teal:0x648f89,canvas:tax?0xa94852:0x8b9f91,gray:0xadb5ae};
 const source={ink:'metal',iron:'metal',wood:'wood',darkWood:'wood',brass:'brass',ivory:'canvas',red:'canvas',teal:'teal',canvas:'canvas',gray:'canvas',rope:'rope'};
 const m={};for(const [key,src]of Object.entries(source)){m[key]=p[src].clone();m[key].name='Cloudstitch bold painted '+key;m[key].color.setHex(palette[key]??(key==='darkWood'?0x94765e:0xc5b596));}
 m.dark=m.ink;m.metal=m.iron;m.glow=p.glow.clone();m.glow.color.setHex(royal?0xffc36b:0xffb474);m.cold=p.coldGlow.clone();m.cold.color.setHex(0xa0e0d7);m.glow.name='bold warm lantern';m.cold.name='bold residual cyan';return m;
}
export function paintVolume(scene){paintKit(scene);}
