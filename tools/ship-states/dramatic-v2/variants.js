import * as THREE from 'three';
import {createVariantLibrary as createV1} from '../variants.js';
import {createVariantLibrary as createEvolution} from '../evolution30/variants.js';
const TAU=Math.PI*2,clamp=THREE.MathUtils.clamp,smooth=(min,max,x)=>THREE.MathUtils.smoothstep(x,min,max);
export function createVariantLibrary(gltf){
 const old=createV1(gltf),evolution=createEvolution(gltf),a=evolution.author,owned=new Set();
 const group=(name)=>{const g=new THREE.Group();g.name=name;return g;};
 function common(p){
  for(const s of[-1,1]){a.deck(p,[.04,-.135,s*.185],.56,.2);a.rod(p,[-.16,-.19,s*.075],[-.16,-.13,s*.22],.015,'darkWood');a.rod(p,[.23,-.19,s*.075],[.23,-.13,s*.22],.015,'brass');a.engine(p,[.33,-.145,s*.26],1.07);a.lamp(p,[.12,-.07,s*.25],1.05);a.curve(p,[[-.28,-.22,s*.08],[-.05,-.29,s*.13],[.25,-.2,s*.09]],.014,'brass');}
  a.flag(p,[.23,.1,.07],.16);a.curve(p,[[-.24,-.1,-.15],[-.25,.05,-.17],[-.15,.27,-.13]],.008,'brass');
  a.cabin(p,[.43,.015,.02],.255,.22,.24);
  for(const s of[-1,1]){a.balloon(p,[-.04,-.005,s*.34],.48,.095);a.rod(p,[-.2,-.14,s*.18],[-.2,-.005,s*.34],.011,'brass');a.rod(p,[.15,-.14,s*.18],[.15,-.005,s*.34],.011,'darkWood');}
  const awning=a.cloth(p,[.27,.2,-.21],.31,.22,.11,'coral');awning.rotation.x=-.2;
  a.flag(p,[.49,.28,.04],.19);
 }
 function plate(p,at,w,h,m='teal',rot=0){const shape=new THREE.Shape();shape.moveTo(-w*.5,h*.44);shape.quadraticCurveTo(0,h*.62,w*.5,h*.44);shape.lineTo(w*.46,-h*.24);shape.quadraticCurveTo(0,-h*.68,-w*.46,-h*.24);shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:.016,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:1,curveSegments:6});owned.add(geo);const mesh=new THREE.Mesh(geo,a.materials[m]);mesh.position.fromArray(at);mesh.rotation.y=rot;p.add(mesh);for(const x of[-.32,.32])a.orb(p,[at[0]+x*w,at[1]+h*.24,at[2]-.005],[.006,.006,.004],'brass');return mesh;}
 function gun(p,at,type){const g=a.group(p,'Heavy '+type,at);a.mesh(g,new THREE.CylinderGeometry(.075,.086,.025,16), 'wood',[0,0,0]);a.ring(g,[0,.015,0],.078,'brass','y');a.orb(g,[0,.055,0],[.09,.064,.073],'teal');
  const barrels=type==='gatling'?2:type==='mortar'?3:1;for(let i=0;i<barrels;i++){const z=(i-(barrels-1)/2)*.047,length=type==='harpoon'?.39:type==='cannon'?.29:type==='mortar'?.21:.235;const end=type==='mortar'?[-length*.5,.21,z]:[-length,.073,z];a.rod(g,[0,.065,z],end,type==='cannon'?.028:.019,'darkTeal');const direction=new THREE.Vector3(...end).sub(new THREE.Vector3(0,.065,z)).normalize(),rim=a.ring(g,end,type==='cannon'?.032:.024,'brass');rim.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);const opening=a.orb(g,new THREE.Vector3(...end).addScaledVector(direction,.002).toArray(),[.003,.017,.017],'darkTeal');opening.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),direction);a.rod(g,[0,.075,z],[end[0]*.92,end[1]+.008,z],.01,'brass');if(type==='harpoon'){a.mesh(g,new THREE.ConeGeometry(.04,.1,5),'brass',[end[0]-.04,end[1],z],[1,1,1],[0,0,Math.PI/2]);a.curve(g,[[.02,.07,z],[.08,-.02,z-.08],[-.13,-.04,z-.15],[-.26,.07,z]],.006,'rope');}}
  for(const s of[-1,1])a.rod(g,[-.1,0,s*.07],[.06,.095,s*.07],.012,'darkWood');return g;}
 function create(category,stage=0){
  if(category.startsWith('v1-')){const v=old.create(category.slice(3),Math.min(stage,category==='v1-growth'?8:99));if(category==='v1-explosion'){const previousUpdate=v.update;v.update=t=>previousUpdate(t*4/6);}return v;}
  if(category==='original')return old.create('normal',0);
  if(category==='growth')return evolution.create('e'+(Math.floor(stage/5)+1),stage%5);
  const base=category==='explosion'?old.create(category,stage):old.create(category==='damage'?'damage':'normal',category==='damage'?stage:0);
  const p=group('Dramatic authored modules'),dynamic=[],baseUpdate=base.update;
  if(category!=='explosion')common(p);
  else{const shell=group('Living ship modules before rupture');common(shell);for(const child of [...shell.children]){p.add(child);dynamic.push({type:'moduleBreak',node:child,start:child.position.clone(),q:child.quaternion.clone(),scale:child.scale.clone(),index:dynamic.length});}}
  if(category==='normal'){
   base.parts.EnvelopeAndBands.scale.set(1.1,1.17,1.12);
   if(stage>=1){for(const s of[-1,1]){const sail=a.cloth(p,[-.12,.025,s*.32],.4,.22,.1,s<0?'coral':'cream');sail.rotation.x=s*.35;}}
   if(stage>=2){a.flag(p,[-.28,.23,.05],.2);a.deck(p,[.17,.31,.02],.2,.2);for(const s of[-1,1])a.rod(p,[.15,.12,s*.08],[.15,.31,s*.07],.006,'brass');}
  }
  if(category==='damage'&&stage>0){
   for(const s of[-1,1])for(let i=0;i<stage+1;i++){
    const f=group('Large torn cloth strip');const shape=new THREE.Shape();shape.moveTo(-.08,.045);shape.lineTo(-.035,-.035);shape.lineTo(-.025,-.16-stage*.025);shape.lineTo(.012,-.09);shape.lineTo(.07,.022);shape.closePath();const geo=new THREE.ShapeGeometry(shape);geo.computeVertexNormals();owned.add(geo);const cloth=new THREE.Mesh(geo,a.materials.cream);cloth.material.side=THREE.DoubleSide;f.add(cloth);f.position.set(-.24+i*.15,.14-i*.018,s*.135);f.rotation.y=s<0?0:Math.PI;p.add(f);dynamic.push({type:'flap',node:f,angle:f.rotation.z,index:i,side:s});plate(p,[-.25+i*.15,-.14,s*.14],.09,.12,'darkWood',s<0?0:Math.PI);
   }
   if(stage>=2){const loose=group('Hanging broken hull plates');a.box(loose,[0,0,0],[.22,.065,.013],'teal');a.rod(p,[-.2,-.16,-.13],[-.25,-.36,-.26],.006,'rope');loose.position.set(-.2,-.37,-.25);p.add(loose);dynamic.push({type:'loose',node:loose});}
   const cloud=group('Rolling engine smoke');cloud.position.set(.34,-.05,-.24);p.add(cloud);for(let i=0;i<6+stage*3;i++){const o=a.orb(cloud,[0,0,0],[.04,.04,.04],i%3?'darkTeal':'cream');dynamic.push({type:'damageSmoke',node:o,index:i,count:6+stage*3});}
   if(stage===3){const fall=group('Strained broken engine');a.engine(fall,[0,0,0],.9);fall.position.set(.28,-.4,.32);fall.rotation.z=.5;p.add(fall);a.curve(p,[[.3,-.12,.2],[.35,-.28,.3],[.28,-.4,.32]],.006,'rope');dynamic.push({type:'fallen',node:fall});}
  }
  if(category==='weapons'){
   a.deck(p,[-.26,-.115,-.16],.32,.26);a.curve(p,[[-.43,-.12,-.12],[-.3,-.18,-.3],[-.08,-.12,-.24]],.018,'brass');
   if(stage>=1)gun(p,[-.24,-.08,-.26],'gatling');
   if(stage>=2)for(const s of[-1,1]){a.deck(p,[0,-.13,s*.34],.4,.27);const c=gun(p,[-.02,-.095,s*.35],'cannon');c.rotation.y=s*.37;plate(p,[.06,-.07,s*.42],.21,.19,'teal',s<0?0:Math.PI);}
   if(stage>=3){gun(p,[.2,-.08,.29],'mortar');a.deck(p,[.18,-.12,.34],.28,.3);plate(p,[.23,-.01,.44],.24,.24,'teal',Math.PI);a.box(p,[.14,-.03,.43],[.13,.09,.08],'coral');}
   if(stage>=4){a.deck(p,[-.48,-.1,.05],.38,.32);gun(p,[-.48,-.055,.05],'harpoon');a.curve(p,[[-.68,-.1,-.12],[-.56,-.3,-.22],[-.25,-.2,-.25]],.014,'brass');a.flag(p,[-.38,-.04,.18],.15);}
  }
  if(category==='armor'){
   if(stage>=1)for(const s of[-1,1])for(const x of[-.32,-.1,.14])a.curve(p,[[x,-.1,s*.1],[x,-.19,s*.18],[x,-.3,s*.08]],.017,'brass');
   if(stage>=2)for(const s of[-1,1])for(let i=0;i<5;i++){plate(p,[-.32+i*.13,-.18,s*.16],.17,.19,i%2?'darkTeal':'teal',s<0?0:Math.PI);a.curve(p,[[-.4+i*.13,-.1,s*.165],[-.32+i*.13,-.07,s*.17],[-.25+i*.13,-.1,s*.165]],.009,'brass');}
   if(stage>=3){for(const s of[-1,1])plate(p,[-.45,-.15,s*.11],.25,.24,'teal',s<0?-.4:Math.PI+.4);a.box(p,[.21,.004,0],[.3,.035,.25],'teal');for(const s of[-1,1])a.curve(p,[[.08,.02,s*.09],[.2,.09,s*.12],[.35,.03,s*.09]],.014,'brass');}
   if(stage>=4){for(const s of[-1,1]){for(let i=0;i<4;i++)plate(p,[-.31+i*.16,-.29,s*.125],.21,.16,i%2?'teal':'brass',s<0?0:Math.PI);a.ring(p,[.45,-.14,s*.25],.16,'brass');a.curve(p,[[-.44,-.06,s*.15],[-.12,-.08,s*.22],[.31,-.05,s*.18]],.014,'darkWood');}a.ring(p,[-.35,-.12,0],.1,'brass','z');}
  }
  let extra;
  if(category==='explosion'){
   extra=p;
   function fx(name,color,scale,index,type){const o=a.orb(p,[0,0,0],scale,'cream');const mat=new THREE.MeshBasicMaterial({name,color,transparent:true,opacity:0,depthWrite:false});owned.add(mat);o.material=mat;o.name=name;dynamic.push({node:o,type,index,sourceMaterial:mat,initial:new THREE.Vector3(...scale)});return o;}
   fx('Compressed furnace heart',0xffe9ac,[.18,.17,.18],0,'core');
   for(let i=0;i<12;i++)fx('Petal pressure flame',i%3?0xef9942:0xf7d985,[.2,.16,.14],i,'fire');
   for(let i=0;i<18;i++)fx('Rolling ash cloud',i%4?0x596864:0xa2aa90,[.12,.12,.12],i,'cloud');
   for(let i=0;i<22;i++){const o=a.box(p,[0,0,0],[.08+(i%3)*.025,.012,.035],i%3?'wood':'brass');dynamic.push({node:o,type:'splinter',index:i,initialScale:o.scale.clone()});}
   for(let i=0;i<9;i++){const f=a.cloth(p,[0,0,0],.22,.065,.05,i%2?'coral':'cream');dynamic.push({node:f,type:'ribbon',index:i,initialScale:f.scale.clone()});}
   for(let i=0;i<3;i++){const ring=a.ring(p,[0,0,0],1,'brass',i===1?'y':'x');const mat=new THREE.MeshBasicMaterial({color:i===1?0xffe1a0:0xe5a244,transparent:true,opacity:0,depthWrite:false});owned.add(mat);ring.material=mat;dynamic.push({node:ring,type:'shock',index:i,sourceMaterial:mat});}
  }else{for(const d of dynamic)d.node.removeFromParent();extra=a.bake([p]);for(const d of dynamic)extra.add(d.node);}
  base.root.add(extra);const spins=[];extra.traverse(n=>{if(n.userData.spin)spins.push({node:n,q:n.quaternion.clone()});});
  let tris=0,count=0;base.root.traverse(n=>{if(n.isMesh){count++;tris+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});
  function opacity(d,v){const mats=Array.isArray(d.node.material)?d.node.material:[d.node.material];for(const m of mats.filter(Boolean))m.opacity=v;if(d.sourceMaterial)d.sourceMaterial.opacity=v;d.node.visible=v>.005;}
  const update=t=>{const seconds=Number.isFinite(t)?Math.max(0,t):0,phase=(seconds%6)*TAU/6;
   baseUpdate(category==='explosion'?Math.min(seconds,6)*4/6:seconds);
   if(category==='normal'){base.parts.EnvelopeAndBands.scale.set(1.1,1.17,1.12);base.root.rotation.z+=stage===1?-.035:0;if(stage===2){base.parts.TurretAssembly.rotation.y=Math.sin(phase)*.3;base.parts.GunBarrel.rotation.y=0;}}
   if(category==='damage'&&stage>0){base.root.rotation.z-=stage*.045;base.parts.EnvelopeAndBands.scale.y=1-stage*.16;base.parts.EnvelopeAndBands.position.y=.132-stage*.025;}
   for(const s of spins)s.node.quaternion.copy(s.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-phase*(category==='damage'?Math.max(2,12-stage*3):stage===1?18:12)));
   for(const d of dynamic){const n=d.node,i=d.index||0,angle=i*2.399963;
    if(d.type==='flap')n.rotation.z=d.angle+Math.sin(phase*3+i)*.23;
    if(d.type==='loose')n.rotation.z=-.5+Math.sin(phase*2)*.14;
    if(d.type==='fallen')n.rotation.z=.5+Math.sin(phase*3)*.12;
    if(d.type==='damageSmoke'){const u=(seconds/2+i/d.count)%1;n.position.set(.34+Math.sin(i*2)*.035+u*.11,-.05+u*.4,-.24+Math.cos(i)*.045);n.scale.setScalar(.045+u*.085);n.visible=u>.03;}
    if(category!=='explosion')continue;
    const ended=seconds>=6,center=new THREE.Vector3(.27,-.08,0),dir=new THREE.Vector3(Math.cos(angle),.15+Math.sin(i*.8)*.5,Math.sin(angle)).normalize();
    if(d.type==='core'){const compress=seconds<.9?(.04+.12*smooth(0,.85,seconds)):.34*(1-smooth(.9,1.8,seconds));n.position.copy(center);n.scale.setScalar(Math.max(.001,compress));opacity(d,ended?0:seconds<.9?.4+.5*smooth(0,.9,seconds):1-smooth(1.0,1.9,seconds));}
    if(d.type==='fire'){const age=seconds-.94-(i%3)*.12,u=clamp(age/1.65,0,1),r=Math.sin(u*Math.PI);n.position.copy(center).addScaledVector(dir,u*(.45+(i%4)*.08));n.scale.set(.20*r,.23*r*(1+(i%3)*.22),.16*r);n.rotation.set(i,u*2,i*.4);opacity(d,ended||age<0?0:(1-smooth(.75,1.65,age))*.94);}
    if(d.type==='cloud'){const age=seconds-1.3-(i%5)*.11,u=clamp(age/3.5,0,1);n.position.copy(center).addScaledVector(dir,u*(.4+(i%4)*.1));n.position.y+=u*.63+(i%3)*.05;const size=.025+u*(.19+(i%4)*.035);n.scale.set(size,size*(1.1+i%3*.1),size);n.rotation.y=i+u*.6;opacity(d,ended||age<0?0:smooth(0,.65,age)*(1-smooth(4.35,6,seconds))*.82);}
    if(d.type==='shock'){const age=seconds-1.05-i*.19,u=clamp(age/1.4,0,1);n.position.copy(center);const size=.1+u*(1.05+i*.1);n.scale.set(size,size*(i===1?.5:.85),size);opacity(d,ended||age<0?0:Math.sin(u*Math.PI)*.65);}
    if(d.type==='moduleBreak'){const age=Math.max(0,seconds-1.05);n.position.copy(d.start).addScaledVector(dir,age*(.075+(i%5)*.018));n.position.y-=.06*age*age;n.quaternion.copy(d.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(age*Math.sin(i)*.7,age*.2,age*Math.cos(i)*.5)));n.scale.copy(d.scale).multiplyScalar(1-smooth(4.4,6,seconds));n.visible=!ended;}
    if(d.type==='splinter'||d.type==='ribbon'){const age=Math.max(0,seconds-1.2-(i%4)*.07),speed=.18+(i%7)*.05;n.position.copy(center).addScaledVector(dir,age*speed);n.position.y-=.10*age*age;n.rotation.set(age*(i%4+1),i+age,age*1.3);n.scale.copy(d.initialScale).multiplyScalar(1-smooth(4,6,seconds));n.visible=!ended&&seconds>1.2&&seconds<5.9;}
   }
  };update(0);
  return{root:base.root,parts:base.parts,counts:{sourceTriangles:11026,triangles:tris,meshes:count},update,dispose(){extra.removeFromParent();base.dispose();}};
 }
 return{create,sourceTriangles:11026,dispose(){old.dispose();evolution.dispose();owned.forEach(o=>o.dispose());}};
}
