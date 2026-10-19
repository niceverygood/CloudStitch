import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';

window.paintAsset=async({model,atlas})=>{
 const bytes=Uint8Array.from(atob(model),c=>c.charCodeAt(0));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
 const texture=await new T.TextureLoader().loadAsync('data:image/png;base64,'+atlas);
 texture.colorSpace=T.SRGBColorSpace;texture.flipY=true;
 const assigned=new Map();
 function category(name){
  if(/glass|window|glow/.test(name))return null;
  if(/wood|grain|honey/.test(name))return['wood',0,1,0xbeb2a0];
  if(/brass|gold|amber/.test(name))return['brass',0,0,0xbfb5a2];
  if(/teal|tile/.test(name))return['teal',1,0,0xa7bbad];
  if(/red|coral|oxblood/.test(name))return['red',1,1,0xa63e39];
  if(/plaster/.test(name))return['plaster',1,1,/light/i.test(name)?0xc8c1b0:0xa9aaa0];
  if(/canvas|cream|pale|stitch/.test(name))return['cloth',1,1,0xfff0d2];
  if(/rust/.test(name))return['rust',2,1,0x96735b];
  if(/ironlight|ironLight/.test(name))return['iron',2,1,0xc1c3bf];
  return['iron',2,1,/dark|Dark|soot/.test(name)?0x869199:0xa2b1b8];
 }
 gltf.scene.traverse(node=>{
  if(!node.isMesh)return;const source=node.material,info=category(source.name);if(!info)return;
  const [name,tx,ty,tint]=info,g=node.geometry;
  if(g.index)node.geometry=g.toNonIndexed();const geo=node.geometry;
  const ps=geo.attributes.position,ns=geo.attributes.normal,old=geo.attributes.color,uv=new Float32Array(ps.count*2),colors=new Float32Array(ps.count*3);
  const scale=name==='wood'?4.5:name==='cloth'?7:5.5;
  for(let i=0;i<ps.count;i+=3){
   const nx=Math.abs(ns.getX(i)),ny=Math.abs(ns.getY(i)),nz=Math.abs(ns.getZ(i));
   const coords=[];for(let j=0;j<3;j++){const k=i+j,x=ps.getX(k),y=ps.getY(k),z=ps.getZ(k);coords.push(ny>nx&&ny>nz?[x/scale,z/scale]:nx>nz?[z/scale,y/scale]:[x/scale,y/scale]);}
   const cx=coords.reduce((s,p)=>s+p[0],0)/3,cy=coords.reduce((s,p)=>s+p[1],0)/3;
   for(let j=0;j<3;j++){
    const k=i+j,u=T.MathUtils.clamp(coords[j][0]-Math.floor(cx),.01,.99),v=T.MathUtils.clamp(coords[j][1]-Math.floor(cy),.01,.99);
    uv[k*2]=(tx+.02+u*.96)/3;uv[k*2+1]=(ty+.02+v*.96)/2;
    const l=ns.getX(k)*-.45+ns.getY(k)*.76+ns.getZ(k)*.48;
    const shade=.65+.42*Math.max(0,l);
    const grain=.98+.025*Math.sin(ps.getX(k)*4.2+ps.getY(k)*.8+ps.getZ(k)*3);
    colors[k*3]=Math.min(1,shade*grain);colors[k*3+1]=Math.min(1,shade*grain);colors[k*3+2]=Math.min(1,shade*grain);
   }
  }
  geo.setAttribute('uv',new T.BufferAttribute(uv,2));geo.setAttribute('color',new T.BufferAttribute(colors,3));
  const key=source.uuid;
  if(!assigned.has(key)){
   const mat=new T.MeshStandardMaterial({name:source.name+' / painted atlas',map:texture,color:tint,vertexColors:true,roughness:1,metalness:0,side:T.DoubleSide});
   assigned.set(key,mat);
  }
  node.material=assigned.get(key);
 });
 for(const group of gltf.scene.children[0].children){let count=0;group.traverse(n=>{if(n.isMesh)count+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;});group.userData.triangles=count;}
 gltf.scene.userData.material_revision='dense-r4-painted';
 const output=await new GLTFExporter().parseAsync(gltf.scene,{binary:true,onlyVisible:true});
 const b=new Uint8Array(output);let binary='';for(let i=0;i<b.length;i+=32768)binary+=String.fromCharCode(...b.subarray(i,i+32768));
 return{base64:btoa(binary),bytes:b.length,materials:assigned.size,atlasDimensions:[texture.image.width,texture.image.height]};
};
