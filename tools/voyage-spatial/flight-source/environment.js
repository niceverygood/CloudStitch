import * as THREE from 'three';
import {buildEnvironmentLayout} from './environment-layout.mjs';
import {createEnvironmentModelLibrary} from './environment-models.js';

const noOutline=m=>{m.userData.outlineParameters={visible:false};return m;};
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);

/** Painted, world-anchored scenery. No collider, force or simulation mutation. */
export function createFlightEnvironment(scene,state){
 const layout=buildEnvironmentLayout(state),library=createEnvironmentModelLibrary(),owned=new Set(),instances=[];
 const rich=new THREE.Group(),legacy=new THREE.Group();rich.name='painted_flight_environment';legacy.name='ready4_scenery_comparison';scene.add(rich,legacy);
 let enabled=true,disposed=false,lastTime=0;
 const keep=r=>(owned.add(r),r),geometry=g=>keep(g),paint=(color,opacity=1)=>keep(noOutline(new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity>=1,fog:true})));

 // Keep the actual READY4 scenery for a same-camera, same-state comparison.
 const oldCloudGeometry=geometry(new THREE.IcosahedronGeometry(1,1)),oldCloudMat=paint('#f4f1df',.3),oldRockMat=keep(new THREE.MeshToonMaterial({color:'#9ab1a2'}));
 for(let i=0;i<44;i++){const m=new THREE.Mesh(oldCloudGeometry,oldCloudMat);m.position.set((i*53.27)%310-155,-33+(i%4)*17,(i*87.9)%300-150);m.scale.set(12+i%5*4,1.7,7+i%3*4);legacy.add(m);}
 for(let i=0;i<12;i++){const a=i*Math.PI/6,m=new THREE.Mesh(oldCloudGeometry,oldRockMat);m.position.set(Math.sin(a)*185,-32-(i%3)*6,Math.cos(a)*185);m.scale.set(18,14,15);legacy.add(m);}

 // An illustrated sky is effectively infinitely far away; all other cues stay
 // in the world. Vertex colour avoids external textures and shader noise.
 const skyGeometry=geometry(new THREE.SphereGeometry(440,32,24)),skyColors=[];
 const horizon=new THREE.Color('#eef0d8'),zenith=new THREE.Color('#9ec9c8'),lower=new THREE.Color('#d1ddd1'),gold=new THREE.Color('#fff0ce');
 const position=skyGeometry.attributes.position,sunDirection=new THREE.Vector3(-.6,.37,-.65).normalize(),direction=new THREE.Vector3();
 for(let i=0;i<position.count;i++){
  direction.set(position.getX(i),position.getY(i),position.getZ(i)).normalize();
  const color=direction.y>0?horizon.clone().lerp(zenith,smooth(0,.85,direction.y)):horizon.clone().lerp(lower,smooth(0,.7,-direction.y));
  color.lerp(gold,Math.pow(Math.max(0,direction.dot(sunDirection)),20)*.6);skyColors.push(color.r,color.g,color.b);
 }
 skyGeometry.setAttribute('color',new THREE.Float32BufferAttribute(skyColors,3));
 const skyMaterial=keep(noOutline(new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,depthWrite:false,fog:false}))),sky=new THREE.Mesh(skyGeometry,skyMaterial);sky.name='painted_sky_dome';sky.renderOrder=-20;sky.frustumCulled=false;rich.add(sky);

 function add(entry,type,flatten=false){
  const model=library.create(entry.kind,{flatten}),group=model.group;group.name=entry.id;group.position.set(entry.x,entry.y,entry.z);group.scale.setScalar(entry.scale);group.rotation.y=entry.phase*.7;
  rich.add(group);const value={entry,type,model,group,rest:new THREE.Vector3(entry.x,entry.y,entry.z),opacity:null};
  if(type==='cloud'||type==='draft'){
   const opacity=type==='draft'?.19:entry.tier==='far'?.73:.91;
   group.traverse(node=>{if(!node.isMesh)return;node.material=keep(noOutline(node.material.clone()));node.material.transparent=true;node.material.depthWrite=false;node.material.opacity=opacity;node.renderOrder=1;value.opacity=node.material;});
  }
  instances.push(value);return value;
 }
 layout.clouds.forEach(e=>add(e,'cloud',true));
 layout.landmarks.forEach(e=>add(e,'landmark'));
 layout.islands.forEach(e=>add(e,'island',true));

 // Thin, close ribbons make a readable foreground without turning the flight
 // corridor into an opaque cloud wall. They are source mist geometry too.
 const drafts=[];
 for(let i=0;i<12;i++){
  const entry={id:`near-wind-ribbon-${i+1}`,kind:'mist-ribbons',x:(i%2?1:-1)*(7+(i%3)*2.2),y:6.5+(i%4)*1.4,z:54-Math.floor(i/2)*15,scale:4.2+(i%3)*1.3,phase:i*1.31,tier:'near'};
  const item=add(entry,'draft',true);item.group.rotation.y=Math.PI*.5;drafts.push(item);
 }

 // Dressing sits on existing terrain/deck; large new islands remain beyond
 // flight bounds. New foliage and living props are presentation only.
 const dressing=[];
 state.obstacles.filter(o=>o.kind==='ellipsoid').forEach((o,i)=>{
  dressing.push({id:`island-canopy-${i}`,kind:'wind-tree',x:o.x+o.rx*.15,y:o.y+o.ry*.96+2,z:o.z,scale:7.8,phase:i*1.7,tier:'middle'});
 });
 dressing.push({id:'departure-supper-deck',kind:'supper-deck',x:-4.8,y:1,z:44,scale:7.5,phase:0,tier:'near'},
  {id:'departure-cargo-crane',kind:'cargo-crane',x:6.2,y:1.3,z:42.5,scale:6.3,phase:2,tier:'near'});
 dressing.forEach(e=>add(e,'dressing'));

 // Seed/feather-like brush marks are real instanced 3D surfaces, not a screen
 // overlay. Camera translation and altitude change produce genuine parallax.
 const seedGeometry=geometry(new THREE.BufferGeometry());
 seedGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,.8,0,-.19,.12,.05,0,0,0,.19,.12,.05,0,.8,0,0,0,0,-.01,.1,-.03,.01,.1,-.03,0,-.65,0],3));seedGeometry.computeVertexNormals();
 const seedMaterial=keep(noOutline(new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,transparent:true,opacity:.76,depthWrite:false,fog:true}))),seeds=new THREE.InstancedMesh(seedGeometry,seedMaterial,layout.motes.length);
 seeds.name='windborne_pollen_and_threads';seeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);seeds.frustumCulled=false;rich.add(seeds);
 const seedPalette=['#fff1c5','#d8e7db','#e8b995','#f9f5df'];layout.motes.forEach((e,i)=>seeds.setColorAt(i,new THREE.Color(seedPalette[i%4])));if(seeds.instanceColor)seeds.instanceColor.needsUpdate=true;
 const transform=new THREE.Object3D(),playerPosition=new THREE.Vector3(),seedPositions=[];
 function setRich(value){enabled=!!value;rich.visible=enabled;legacy.visible=!enabled;scene.background.set(enabled?'#e3eadd':'#cfdfd9');scene.fog.color.set(enabled?'#d9e6dc':'#d9e5dd');scene.fog.near=enabled?125:115;scene.fog.far=enabled?370:285;}
 setRich(true);
 function update(time,camera,player){
  if(disposed)return;lastTime=time;sky.position.copy(camera.position);playerPosition.set(player.x,player.y,player.z);
  if(!enabled)return;
  for(const item of instances){
   const {entry:e,group,rest,type}=item;group.position.copy(rest);item.model.update(time+e.phase);
   if(type==='cloud'||type==='draft'){
    group.position.x+=Math.sin(time*.035+e.phase)*.8;group.position.y+=Math.sin(time*.21+e.phase)*.45;
    const breath=1+Math.sin(time*.26+e.phase)*.018;group.scale.set(e.scale*breath,e.scale*(1-(breath-1)*.3),e.scale);
    const fade=Math.min(smooth(3,13,group.position.distanceTo(playerPosition)-e.scale*.34),smooth(3,17,group.position.distanceTo(camera.position)-e.scale*.42));
    item.opacity.opacity=(type==='draft'?.19:e.tier==='far'?.73:.91)*fade;group.visible=fade>.015;
   }else if(type==='landmark'){
    group.position.y+=Math.sin(time*.65+e.phase)*.35;group.rotation.z=Math.sin(time*.5+e.phase)*.035;group.visible=group.position.distanceTo(camera.position)>e.scale*.65;
   }else if(type==='dressing')group.visible=group.position.distanceTo(camera.position)>e.scale*.6;
  }
  seedPositions.length=0;
  for(let i=0;i<layout.motes.length;i++){
   const e=layout.motes[i],x=e.x+Math.sin(time*.26+e.phase)*.65,y=e.y+Math.sin(time*.63+e.phase)*.28,z=e.z+Math.cos(time*.19+e.phase)*.45;
   transform.position.set(x,y,z);transform.rotation.set(Math.sin(time*.4+e.phase)*.5,e.phase+time*.15,Math.sin(time*.7+e.phase)*.6);
   const distance=transform.position.distanceTo(camera.position),fade=smooth(2,6,distance)*(1-smooth(75,120,distance)),size=e.scale*fade;
   transform.scale.set(size*(e.kind==='thread'?.35:1),size*(e.kind==='thread'?2:1),size);transform.updateMatrix();seeds.setMatrixAt(i,transform.matrix);seedPositions.push([x,y,z]);
  }seeds.instanceMatrix.needsUpdate=true;
 }
 function stats(){
  const anchors=instances.filter(i=>i.type==='landmark'||i.type==='cloud'||i.type==='island').map(i=>({id:i.entry.id,kind:i.entry.kind,tier:i.entry.tier,type:i.type,rest:i.rest.toArray(),position:i.group.position.toArray(),scale:i.entry.scale,visible:i.group.visible}));
  const motion=instances.filter(i=>i.type==='landmark').slice(0,2).map(i=>{let signature=0;i.group.updateMatrixWorld(true);i.group.traverse(n=>{if(n.isMesh)n.matrixWorld.elements.forEach((v,j)=>{signature+=v*(j+1);});});return{id:i.entry.id,signature};});
  return{rich:enabled,time:lastTime,counts:{clouds:layout.clouds.length,landmarks:layout.landmarks.length,islands:layout.islands.length,motes:layout.motes.length,drafts:drafts.length,dressing:dressing.length},models:library.stats(),sourceIds:[...new Set(instances.map(i=>i.entry.kind))],anchors,motion,seeds:seedPositions.slice(0,8)};
 }
 function dispose(){if(disposed)return;disposed=true;library.dispose();owned.forEach(r=>r.dispose?.());rich.removeFromParent();legacy.removeFromParent();rich.clear();legacy.clear();instances.length=0;}
 return{update,stats,dispose,setRich,get rich(){return enabled;}};
}
