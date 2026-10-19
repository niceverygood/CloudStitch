import * as THREE from 'three';
export {THREE};
export {group,box,sphere,beam,tube,ring,cloth,lantern} from '../../enemy-fleet-reference/kit.js';
import {group,mesh,box,sphere,beam,tube,ring,cloth,lantern,loadPaintedMaterials,paintVolume} from '../../enemy-fleet-reference/kit.js';
export {paintVolume};
export function cone(parent,mat,name,at,radius,height,rot=[0,0,0],sides=6){return mesh(parent,new THREE.ConeGeometry(radius,height,sides),mat,name,at,rot);}
export function gear(parent,mat,name,at,radius,axis='x'){
 const g=group(parent,name,at);ring(g,mat,name+'-rim',[0,0,0],radius,.12,axis);
 for(let i=0;i<12;i++){const a=i*Math.PI/6,pos=axis==='x'?[0,Math.sin(a)*radius,Math.cos(a)*radius]:axis==='y'?[Math.sin(a)*radius,0,Math.cos(a)*radius]:[Math.sin(a)*radius,Math.cos(a)*radius,0];const size=axis==='x'?[.28,.28,.38]:[.3,.3,.3];box(g,mat,name+'-cog-'+i,pos,size,axis==='x'?[a,0,0]:[0,0,-a]);}return g;
}
export function cannon(parent,m,name,at,scale=1,rotation=[0,0,0]){
 const g=group(parent,name,at,rotation);g.scale.setScalar(scale);
 sphere(g,m.iron,name+'-breech',[.3,.6,0],[.82,.68,.72]);
 const barrel=mesh(g,new THREE.CylinderGeometry(.44,.56,3.2,16),m.iron,name+'-forged-barrel',[-1.5,.65,0],[0,0,Math.PI/2]);
 for(const x of [-2.9,-2,-.6])ring(g,m.brass,name+'-collar-'+x,[x,.65,0],x===-2.9?.49:.57,.11,'x');
 mesh(g,new THREE.CylinderGeometry(.34,.34,.07,16),m.ink,name+'-bore',[-3.12,.65,0],[0,0,Math.PI/2]);
 box(g,m.darkWood,name+'-carriage',[0,0,0],[2,.32,1.8]);
 for(const s of [-1,1])gear(g,m.brass,name+'-elevation-'+s,[.25,.45,s*.85],.37,'z');return g;
}
export function jaw(parent,m,name,at,width,length,rotation=[0,0,0]){
 const g=group(parent,name,at,rotation);
 for(const side of [-1,1]){
  tube(g,m.iron,name+'-mandible-'+side,[[length*.3,0,side*width*.4],[-length*.35,-.25,side*width*.52],[-length*.65,.05,side*width*.21]],.16,16);
  for(let i=0;i<4;i++)cone(g,m.ivory,name+'-tooth-'+side+'-'+i,[-length*.42+i*length*.2,.2,side*(width*.43+i*.02)],.13,.65+(i%2)*.2,[0,0,-.2]);
 }return g;
}
export async function makeMaterials(atlas,id){
 const p=await loadPaintedMaterials(atlas),cult=id.includes('cult')||id.includes('funeral')||id.includes('bell'),ghost=id.includes('ghost'),royal=id.includes('inhale');
 const m={ink:p.dark.clone(),iron:p.metal.clone(),brass:p.brass.clone(),wood:p.wood.clone(),darkWood:p.darkWood.clone(),ivory:p.ivory.clone(),red:p.red.clone(),teal:p.teal.clone(),cloth:p.canvas.clone(),glow:p.glow.clone(),cold:p.coldGlow.clone()};
 const palette=cult?{ink:0x414654,iron:0x667080,brass:0xc7ab77,wood:0x8a6b62,ivory:0xd5c6a9,red:0xa3233c,cloth:0xd9c9aa,teal:0x536774}:ghost?{ink:0x364654,iron:0x778d98,brass:0x8d9991,wood:0x8a8682,ivory:0xcbd8cd,cloth:0x9eafb7,teal:0x518d94,red:0x5b6d80}:royal?{ink:0x393447,iron:0x625c78,brass:0xe2b55d,wood:0x7b5362,ivory:0xe5d6b3,cloth:0xa55968,red:0x8e244c,teal:0x76577c}:{ink:0x424a4f,iron:0x68737c,brass:0xd3a164,wood:0xb47a59,ivory:0xcac4a0,red:0xae3b34,cloth:0x8da69d,teal:0x427576};
 for(const[k,v]of Object.entries(palette))m[k].color.setHex(v);
 m.glow.color.setHex(ghost?0x76edf0:royal?0xffc36b:0xff804d);
 m.dark=m.ink;m.metal=m.iron;m.canvas=m.cloth;m.rope=p.rope.clone();m.gray=m.cloth;
 for(const[k,mat]of Object.entries(m))mat.name='villain painted '+k;
 return m;
}
