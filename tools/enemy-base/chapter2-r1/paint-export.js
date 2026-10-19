import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
window.paintAsset=async({model})=>{
 const source=Uint8Array.from(atob(model),c=>c.charCodeAt(0)),gltf=await new GLTFLoader().parseAsync(source.buffer,'');
 // Four neutral hand-painted material tiles. Actual colour and volume remain in COLOR_0.
 // Generated from deterministic drawing operations; no new external raster/API input.
 const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');let seed=91843;
 const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const tile=(x,y,kind)=>{
  ctx.save();ctx.beginPath();ctx.rect(x,y,512,512);ctx.clip();ctx.fillStyle='#f4efe5';ctx.fillRect(x,y,512,512);
  for(let i=0;i<220;i++){
   const u=x+rnd()*512,v=y+rnd()*512;ctx.strokeStyle=i%3?'rgba(132,124,116,.045)':'rgba(255,255,253,.17)';ctx.lineWidth=3+rnd()*23;
   ctx.beginPath();ctx.moveTo(u-60,v);ctx.bezierCurveTo(u,v-8,u+50,v+13,u+160,v+2);ctx.stroke();
  }
  if(kind==='nacre')for(let i=0;i<46;i++){
   ctx.strokeStyle=i%3?'rgba(172,159,168,.14)':'rgba(255,255,254,.6)';ctx.lineWidth=i%3?.8:2.2;
   ctx.beginPath();ctx.ellipse(x+100,y+510,70+i*11,160+i*10,-.18,Math.PI,Math.PI*2);ctx.stroke();
  }
  if(kind==='bone')for(let i=0;i<100;i++){
   const u=x+rnd()*512,v=y+rnd()*512;ctx.strokeStyle='rgba(126,113,102,.19)';ctx.lineWidth=.5+rnd();ctx.beginPath();ctx.moveTo(u,v);ctx.bezierCurveTo(u-3,v+20,u+5,v+65,u-1,v+80+rnd()*100);ctx.stroke();
  }
  if(kind==='coral')for(let i=0;i<1400;i++){
   const u=x+rnd()*512,v=y+rnd()*512,r=.6+rnd()*2.8;ctx.strokeStyle='rgba(139,120,117,.2)';ctx.lineWidth=.7;ctx.beginPath();ctx.ellipse(u,v,r,r*1.4,0,0,Math.PI*2);ctx.stroke();
  }
  if(kind==='fiber'){
   for(let i=0;i<512;i+=4){ctx.strokeStyle=i%8?'rgba(120,115,102,.12)':'rgba(255,255,255,.6)';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x+i,y);ctx.lineTo(x+i+.8,y+512);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y+i);ctx.lineTo(x+512,y+i+1.2);ctx.stroke();}
  }
  ctx.restore();
 };
 tile(0,0,'nacre');tile(512,0,'coral');tile(0,512,'bone');tile(512,512,'fiber');
 const texture=await new T.TextureLoader().loadAsync(c.toDataURL('image/png'));texture.colorSpace=T.SRGBColorSpace;texture.flipY=true;
 const assigned=new Map();
 gltf.scene.traverse(n=>{if(!n.isMesh)return;const mat=n.material,name=mat.name;
  if(/cyan|window|deepwater|water$/.test(name))return;
  // The indexed asset already has the frozen first-paint triangle UVs, split
  // precisely at UV seams. Do not expand or reinterpret them in the browser.
  if(!n.geometry.attributes.uv)throw Error('Expected indexed preserved UVs');
  if(!assigned.has(mat.uuid)){const m=mat.clone();m.map=texture;m.name=mat.name+' / hand-painted surface';assigned.set(mat.uuid,m);}n.material=assigned.get(mat.uuid);
 });
 const output=await new GLTFExporter().parseAsync(gltf.scene,{binary:true,onlyVisible:true});const b=new Uint8Array(output);let binary='';for(let i=0;i<b.length;i+=32768)binary+=String.fromCharCode(...b.subarray(i,i+32768));
 return{base64:btoa(binary),atlas:c.toDataURL('image/png').split(',')[1],atlasDimensions:[1024,1024]};
};
