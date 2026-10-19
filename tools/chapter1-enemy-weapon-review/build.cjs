const fs=require('fs'),path=require('path'),crypto=require('crypto'),esbuild=require('esbuild');
const {SceneGLB,THREE:T}=require('../combat-vfx-v2/fantasy-weapon-firing-v1/glb.cjs'),profiles=require('./profiles.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/chapter1-enemy-weapon-review-v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const q=(axis,a)=>new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis),a).toArray();
function assemble(item,source){
 const g=new SceneGLB(source),sourceAnimations=g.json.animations||[],mounts=[];
 const gear=g.node('Enemy_fitted_weapon_systems',g.root),B=0xb89557,D=0x27383e,W=0x785345,R=0x73353e,C=0xe0c69a;
 function mesh(n,geo,c,parent,at=[0,0,0],scale=[1,1,1],rotation){return g.mesh(n,geo,c,parent,{translation:at,scale,...(rotation?{rotation}:{})});}
 const box=new T.BoxGeometry(1,1,1),cyl=new T.CylinderGeometry(1,1,1,16),ball=new T.SphereGeometry(1,12,8),cone=new T.ConeGeometry(1,1,16);
 function beam(n,a,b,r,c,parent){const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av);return mesh(n,cyl,c,parent,av.add(bv).multiplyScalar(.5).toArray(),[r,v.length(),r],new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()).toArray());}
 const p=profiles[item.kind];
 function mount(type,at,s,index){
  const id=type+'_'+index,base=g.node('Mount_'+id,gear,{translation:at,scale:[s,s,s]});
  mesh('Fitted_wood_saddle',box,W,base,[.3,-.3,0],[2.2,.45,1.25]);
  for(const z of[-.58,.58]){mesh('Brass_saddle_strap',box,B,base,[.3,-.05,z],[2.25,.18,.1]);beam('Hull_triangular_brace',[1,-1,z],[-.6,-.2,z],.11,D,base);}
  mesh('Turntable',cyl,D,base,[0,.13,0],[.65,.23,.65]);mesh('Turntable_brass_rim',new T.TorusGeometry(.63,.06,6,24),B,base,[0,.25,0],[1,1,1],q([1,0,0],Math.PI/2));
  const yaw=g.node('Aim_'+id,base),moving=g.node('Recoil_'+id,yaw);
  if(type==='cannon'){
   mesh('Recoil_bed',box,R,moving,[.15,.45,0],[1.8,.4,.9]);
   for(const z of[-.55,.55]){mesh('Cheek_plate',box,D,moving,[.3,.8,z],[1.5,.7,.16]);mesh('Trunnion',cyl,B,moving,[.1,.85,z],[.18,.2,.18],q([1,0,0],Math.PI/2));}
   mesh('Forged_tapered_barrel',new T.CylinderGeometry(.34,.49,2.8,20,1,true),D,moving,[-.85,1,0],[1,1,1],q([0,0,1],Math.PI/2));
   for(const x of[-2.2,-1.6,-.6,.4])mesh('Brass_barrel_binding',new T.TorusGeometry(x< -1?.37:.45,.07,6,24),B,moving,[x,1,0],[1,1,1],q([0,1,0],Math.PI/2));
   mesh('Dark_recessed_bore',new T.CircleGeometry(.29,20),0x101b20,moving,[-2.17,1,0],[1,1,1],q([0,1,0],-Math.PI/2));
   mesh('Breech_block',ball,D,moving,[.65,1,0],[.5,.45,.46]);beam('Recoil_piston',[.9,.5,-.35],[-.6,.5,-.35],.09,B,moving);
   if(['scout','chain','command','executor'].includes(item.kind))for(const z of[-.63,.63]){mesh('Auxiliary_linked_barrel',new T.CylinderGeometry(.17,.21,2.1,12,1,true),D,moving,[-.8,1,z],[1,1,1],q([0,0,1],Math.PI/2));mesh('Auxiliary_brass_muzzle',new T.TorusGeometry(.18,.045,6,20),B,moving,[-1.86,1,z],[1,1,1],q([0,1,0],Math.PI/2));beam('Barrel_yoke',[-.9,1,-.65],[-.9,1,.65],.075,B,moving);}
   if(item.kind==='tow'){beam('Loaded_forged_harpoon',[-2.8,1,0],[.5,1,0],.065,C,moving);mesh('Harpoon_barb',cone,D,moving,[-2.9,1,0],[.23,.6,.23],q([0,0,1],Math.PI/2));for(const z of[-.8,.8])mesh('Tow_rope_spool',cyl,W,moving,[.7,.6,z],[.48,.35,.48],q([1,0,0],Math.PI/2));}
   if(item.kind==='fire'){for(const z of[-.8,.8]){mesh('Ceramic_fuel_canister',cyl,R,base,[.5,.8,z],[.32,1.4,.32]);for(const y of[.25,1.25])mesh('Fuel_canister_binding',new T.TorusGeometry(.34,.05,6,20),B,base,[.5,y,z],[1,1,1],q([1,0,0],Math.PI/2));}mesh('Flared_furnace_nozzle',new T.CylinderGeometry(.55,.35,.5,12,1,true),B,moving,[-2.25,1,0],[1,1,1],q([0,0,1],Math.PI/2));}
   if(item.kind==='mortar'){mesh('Raised_mortar_cup',new T.CylinderGeometry(.62,.44,1.7,16,1,true),D,moving,[-.5,1.9,0],[1,1,1],q([0,0,1],.55));mesh('Mortar_cup_lip',new T.TorusGeometry(.62,.08,6,24),B,moving,[-.95,2.62,0],[1,1,1],q([0,0,1],.55));beam('Elevation_screw',[.7,.5,0],[-.4,1.8,0],.11,B,moving);}
   if(item.kind==='shield'||item.kind==='ram'){for(const z of[-.75,.75])mesh('Armoured_gun_cheek',box,D,moving,[-.4,1,z],[2.3,1.6,.18]);mesh('Crimson_gun_mantlet',box,R,moving,[-1.1,1.3,0],[.28,1.2,1.6]);}
   if(item.kind==='repair')for(const z of[-.65,.65]){mesh('Teal_pressure_gauge',cyl,0x638e87,moving,[.6,1.3,z],[.25,.12,.25],q([1,0,0],Math.PI/2));beam('Gauge_pointer',[.6,1.3,z],[.48,1.43,z],.025,B,moving);}
  }else{
   mesh('Wooden_crossbow_stock',box,W,moving,[-.2,.85,0],[2.7,.22,.32]);mesh('Brass_arrow_rail',box,B,moving,[-.25,1,0],[2.6,.08,.12]);
   for(const side of[-1,1]){beam('Bent_limb_inner',[-.9,.9,0],[-1.25,.92,side*.9],.12,D,moving);beam('Bent_limb_tip',[-1.25,.92,side*.9],[-.85,.95,side*1.5],.09,B,moving);beam('Taut_bowstring',[-.85,.95,side*1.5],[.5,1.02,0],.025,C,moving);}
   beam('Loaded_arrow',[-1.9,1.09,0],[.8,1.09,0],.04,C,moving);mesh('Forged_arrow_tip',cone,D,moving,[-2.05,1.09,0],[.12,.35,.12],q([0,0,1],Math.PI/2));
   for(const z of[-.1,.1])mesh('Crimson_fletching',box,R,moving,[.7,1.1,z],[.45,.18,.05]);
   mesh('Winding_spool',cyl,B,moving,[.7,.7,0],[.23,.8,.23],q([1,0,0],Math.PI/2));
  }
  for(let i=0;i<5;i++)for(const z of[-.66,.66])mesh('Hand_forged_rivet',ball,B,base,[-.7+i*.43,-.02,z],[.06,.06,.06]);
  const muzzle=[-2.3,1.05,0];g.node('Muzzle_'+id,moving,{translation:muzzle});mounts.push({id,type,parent:'Enemy_fitted_weapon_systems',position:at,quaternion:[0,0,0,1],scale:s,localForward:[-1,0,0],muzzle:'Muzzle_'+id,recoil:'Recoil_'+id,aim:'Aim_'+id});
 }
 p.ports.forEach((at,i)=>mount('cannon',at,p.scale,i));p.bows.forEach((at,i)=>mount('arrow',at,p.scale*.85,i));
 const device=g.node('Special_device',gear,{translation:p.device,scale:[p.scale,p.scale,p.scale]});
 mesh('Device_wood_support',box,W,device,[0,-.8,0],[1.8,.45,1.6]);
 for(const z of[-.65,.65])beam('Device_support_strut',[.6,-1.6,z],[-.3,0,z],.12,B,device);
 if(['bell','execution','ram'].includes(p.effect)){
  mesh('Resonator_bell',new T.CylinderGeometry(.45,1.1,1.65,20,1,true),B,device,[0,.6,0]);mesh('Bell_lip',new T.TorusGeometry(1.1,.1,6,32),B,device,[0,-.2,0],[1,1,1],q([1,0,0],Math.PI/2));mesh('Bell_clapper',ball,D,device,[0,-.1,0],[.3,.3,.3]);
 }else if(['shield','repair'].includes(p.effect)){
  for(let i=0;i<3;i++)mesh('Spindle_field_ring',new T.TorusGeometry(.9+i*.2,.065,6,32),B,device,[0,.6+i*.25,0],[1,1,1],q([1,0,0],Math.PI/2));mesh('Teal_resonance_crystal',new T.OctahedronGeometry(.7),0x648f87,device,[0,.7,0],[.8,1.7,.8]);
 }else{
  mesh('Pressure_vessel',ball,D,device,[0,.4,0],[.85,1.2,.85]);for(const y of[-.2,.6,1.2])mesh('Vessel_binding',new T.TorusGeometry(.77,.07,6,28),B,device,[0,y,0],[1,1,1],q([1,0,0],Math.PI/2));beam('Forward_spout',[0,.7,0],[-1.7,.9,0],.3,B,device);mesh('Brazier_crown',new T.CylinderGeometry(1,.55,.6,12,1,true),R,device,[0,1.5,0]);
 }
 g.node('Muzzle_special',device,{translation:[-1.8,1,0]});mounts.push({id:'special',type:'special',parent:'Enemy_fitted_weapon_systems',position:p.device,scale:p.scale,quaternion:[0,0,0,1],muzzle:'Muzzle_special',localForward:[-1,0,0]});
 const bytes=g.finish('Mounted_weapon_static',{}); // finish then retain original exhibition clip; weapon motion lives in review.
 const n=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+n));j.animations=sourceAnimations;
 j.extras={...j.extras,source:item.assetPath,weaponProfile:item.kind,combatImplemented:false,mounts};
 const jb=Buffer.from(JSON.stringify(j)),jp=Buffer.alloc(Math.ceil(jb.length/4)*4,32);jb.copy(jp);const bin=bytes.subarray(20+n),result=Buffer.alloc(20+jp.length+bin.length);bytes.copy(result,0,0,12);result.writeUInt32LE(result.length,8);result.writeUInt32LE(jp.length,12);result.writeUInt32LE(0x4e4f534a,16);jp.copy(result,20);bin.copy(result,20+jp.length);
 return {bytes:result,mounts};
}
async function main(){fs.mkdirSync(out,{recursive:true});const catalog=JSON.parse(fs.readFileSync(path.join(root,'outputs/chapter1-fleet-detail-v2/catalog.json')));
 const bundle=await esbuild.build({entryPoints:[path.join(__dirname,'viewer.js')],bundle:true,write:false,format:'iife',minify:true,nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)});fs.writeFileSync(path.join(out,'viewer.js'),bundle.outputFiles[0].text);
 if(process.argv.includes('--pages')){const c=JSON.parse(fs.readFileSync(path.join(out,'catalog.json'))),t=fs.readFileSync(path.join(__dirname,'template.html'),'utf8');for(const m of c.items)fs.writeFileSync(path.join(out,m.page),t.replace('__DATA__',()=>JSON.stringify(m)).replace('__GLB__',()=>fs.readFileSync(path.join(out,m.model)).toString('base64')));console.log('Pages refreshed; GLBs unchanged.');return;}
 if(!process.argv.includes('--execute')){console.log('Viewer bundled; source ready. Export requires coordinated --execute.');return;}
 const template=fs.readFileSync(path.join(__dirname,'template.html'),'utf8'),items=[];fs.mkdirSync(path.join(out,'ships'),{recursive:true});
 for(const m of catalog.models){const source=fs.readFileSync(path.join(root,'outputs/chapter1-fleet-detail-v2',m.assetPath)),a=assemble(m,source),p=profiles[m.kind],item={...m,...p,source:{path:'outputs/chapter1-fleet-detail-v2/'+m.assetPath,sha256:sha(source)},mounts:a.mounts,bytes:a.bytes.length,sha256:sha(a.bytes),model:'ships/'+m.kind+'.glb',page:'ships/'+m.kind+'.html'};fs.writeFileSync(path.join(out,item.model),a.bytes);fs.writeFileSync(path.join(out,item.page),template.replace('__DATA__',()=>JSON.stringify(item)).replace('__GLB__',()=>a.bytes.toString('base64')));items.push(item);console.log(m.kind+' '+a.mounts.length+' mounts '+a.bytes.length+' bytes');}
 fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({title:'Cloudstitch · 장례 함대 무장 시험',gameplayImplemented:false,items},null,2));
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cloudstitch · 함대 무장 시험</title><style>body{background:#e9e3d5;color:#283b3d;font:16px/1.7 system-ui;margin:0}main{max-width:1300px;margin:auto;padding:35px}h1{font-family:Georgia,serif}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}a{color:inherit}article{background:#f7f0e1;border:1px solid #b9aa91;padding:20px;border-radius:8px}img{width:100%;aspect-ratio:1.5;object-fit:contain}small{color:#85534b}</style><main><small>CLOUDSTITCH / CHAPTER I / ARMAMENT ATELIER</small><h1>장례 함대 · 무장 시험장</h1><p>11척의 함선에 포·쇠뇌·전용 기술 장치를 장착했습니다. 개별 발사와 일제사격, 궤적과 명중 연출을 직접 검토하세요.</p><section>${items.map(m=>`<article><a href="${m.page}"><img src="../chapter1-fleet-detail-v2/${m.previewPath}" alt="${m.name}"><h2>${m.name}</h2></a><p>${m.cannon} / ${m.arrow}<br><strong>${m.special}</strong></p><a href="${m.page}">발사 리뷰 →</a> · <a href="${m.model}" download>무장 GLB</a></article>`).join('')}</section><p>외형·발사 연출 리뷰입니다. 전투 AI·피해·재사용 대기시간·밸런스는 기존 전장 sim에 통합하지 않았습니다. GLB에는 무기·포구 노드가 포함되며 발사·윤곽선은 이 리뷰의 런타임 표현입니다.</p></main></html>`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
