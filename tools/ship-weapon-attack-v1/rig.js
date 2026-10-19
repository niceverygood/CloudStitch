import * as T from 'three';
import {BRANCHES,pulse,sweptTargetCrossing} from './events.js';
import {makeEffect} from './effects.js';
function find(root,re){let out;root.traverse(n=>{if(!out&&re.test(n.name))out=n});return out;}
function material(color){const m=new T.MeshBasicMaterial({color,toneMapped:false});m.userData.outlineParameters={thickness:.001,color:[.08,.1,.08],visible:true};return m;}
export function createRig(model,branch,rich){
 const spec=BRANCHES[branch],sceneRoot=new T.Group(),body=new T.Group();body.name='coupled_ship_and_mount';body.add(model);sceneRoot.add(body);model.updateMatrixWorld(true);
 const mount=find(model,/mobility-prow-saddle|artillery-battery-replacement|salvage-starboard-winch-bracket/),saddle=find(model,/fitted_adapter_and_load_path/),hull=find(model,/hull_root_preserved/);let mechanism=find(model,spec.mechanism);
 if(!mount||!saddle||!hull||!mechanism)throw new Error('Missing real assembly mechanism '+branch);
 if(branch==='salvage'){const core=find(mechanism,/rope_drum_core/),parent=mechanism.parent;if(!core)throw new Error('Missing winch core');const pivot=new T.Group();pivot.name='runtime_winch_axle_pivot';pivot.position.copy(parent.worldToLocal(core.getWorldPosition(new T.Vector3())));parent.add(pivot);pivot.updateMatrixWorld(true);pivot.attach(mechanism);mechanism=pivot;model.updateMatrixWorld(true);}
 const all=[];model.traverse(n=>{if(spec.source.test(n.name)&&n.children.length)all.push(n)});all.sort((a,b)=>a.name.localeCompare(b.name));
 if(all.length!==spec.launch.length)throw new Error('Expected actual projectile source groups '+branch+': '+all.length);
 const poses=[mount,saddle,hull,mechanism].map(n=>({n,p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()}));
 const shots=all.map((node,i)=>{
  const box=new T.Box3().setFromObject(node),tip=new T.Vector3(box.min.x,(box.min.y+box.max.y)/2,(box.min.z+box.max.z)/2),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();node.matrixWorld.decompose(p,q,s);
  const projectile=node.clone(true);projectile.name='live_projectile_'+i;projectile.position.copy(p);projectile.quaternion.copy(q);projectile.scale.copy(s);sceneRoot.add(projectile);
  const hit=new T.Vector3(spec.targetX,tip.y,tip.z),fx=makeEffect(branch,rich,tip,hit,i);sceneRoot.add(fx.root);
  return{node,projectile,start:p,tip,hit,launch:spec.launch[i],hitTime:spec.launch[i]+spec.travel,effect:fx};
 });
 const meanY=shots.reduce((a,s)=>a+s.hit.y,0)/shots.length,meanZ=shots.reduce((a,s)=>a+s.hit.z,0)/shots.length;
 const target=new T.Group();target.name='wood_and_iron_test_module';target.position.set(spec.targetX-.04,meanY,meanZ);sceneRoot.add(target);
 for(let i=0;i<5;i++){const plank=new T.Mesh(new T.BoxGeometry(.08,.065,.44),material(i%2?0xbc925f:0xd0a372));plank.position.y=(i-2)*.068;target.add(plank);}
 for(const z of[-.15,.15]){const brace=new T.Mesh(new T.BoxGeometry(.012,.37,.025),material(0x477b76));brace.position.set(.047,0,z);target.add(brace);}
 const stand=new T.Mesh(new T.BoxGeometry(.13,.08,.50),material(0x314f53));stand.position.y=-.23;target.add(stand);
 const cable=[];let spool=null;
 if(branch==='salvage'){spool=find(model,/rope_drum_core/);for(let i=0;i<14;i++){const n=new T.Mesh(new T.CylinderGeometry(rich?.0035:.0025,rich?.0035:.0025,1,6),material(0xd3c39a));sceneRoot.add(n);cable.push(n);}}
 let lastStats={};
 function apply(t,{effects=true,reduced=false}={}){
  body.position.set(0,0,0);body.rotation.set(0,0,0);for(const a of poses){a.n.position.copy(a.p);a.n.quaternion.copy(a.q);a.n.scale.copy(a.s)}
  let recoil=0,delayed=0,contact=0;
  for(const shot of shots){recoil+=pulse(t-shot.launch,.035,.18);delayed+=pulse(t-shot.launch-.055,.05,.40);const h=t-shot.hitTime;if(h>=0)contact+=pulse(Math.max(0,h-(h<.04?h:0)),.025,.20);}
  const strength=rich?1:.35,hold=rich&&shots.some(s=>t>=s.hitTime&&t<s.hitTime+.04);if(hold)recoil*=.3;
  mount.position.x+=recoil*(branch==='artillery'?.026:.012)*strength;
  saddle.position.x+=delayed*.0045*strength;hull.position.x+=delayed*.0055*strength;
  if(!reduced){body.position.x=delayed*.009*strength;body.position.y=Math.sin(t*2)*.001;body.rotation.z=-delayed*.013*strength;}
  if(branch==='mobility'){const anticipation=Math.max(0,...shots.map(s=>t<s.launch&&t>s.launch-.2?(t-s.launch+.2)/.2:0));mechanism.scale.z*=1-anticipation*.12;}
  if(branch==='salvage'){mechanism.rotation.x+=Math.min(1,Math.max(0,(t-.95)/.7))*4.3;}
  const hits=[];
  for(let i=0;i<shots.length;i++){
   const shot=shots[i],u=T.MathUtils.clamp((t-shot.launch)/spec.travel,0,1),distance=shot.hit.x-shot.tip.x;
   shot.node.visible=t<shot.launch||t>=spec.recovery+.4;
   shot.projectile.visible=t>=shot.launch&&t<shot.hitTime+(branch==='salvage'?1.8:0);
   shot.projectile.position.copy(shot.start);shot.projectile.position.x+=distance*u;
   if(branch==='artillery')shot.projectile.position.y+=Math.sin(u*Math.PI)*.045;
   const currentTip=shot.tip.clone();currentTip.x+=distance*u;
   const hit=sweptTargetCrossing(shot.tip.toArray(),currentTip.toArray(),spec.targetX)&&t>=shot.hitTime;
   if(hit)hits.push(i);
   shot.effect.apply(t,shot.launch,shot.hitTime,currentTip,effects);
  }
  target.rotation.z=reduced?0:contact*.024*strength;
  if(cable.length){model.updateMatrixWorld(true);const start=spool.getWorldPosition(new T.Vector3()),end=shots[0].projectile.position.clone();for(let i=0;i<cable.length;i++){const n=cable[i];n.visible=t>=shots[0].launch&&t<spec.recovery+.3;if(!n.visible)continue;const sag=t<shots[0].hitTime?.05:.008+Math.sin((t-shots[0].hitTime)*28)*Math.exp(-(t-shots[0].hitTime)*3)*.012;const point=u=>start.clone().lerp(end,u).add(new T.Vector3(0,-Math.sin(u*Math.PI)*sag,0));const a=point(i/14),b=point((i+1)/14),delta=b.clone().sub(a);n.position.copy(a).add(b).multiplyScalar(.5);n.scale.set(1,delta.length(),1);n.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());}}
  sceneRoot.updateMatrixWorld(true);lastStats={branch,rich,time:t,actualProjectileGroups:all.length,sourceGroups:all.map(n=>n.name),launchOrigins:shots.map(s=>s.tip.toArray()),hits,projectileVisible:shots.filter(s=>s.projectile.visible).length,mechanismRecoil:mount.position.x-poses[0].p.x,hullRecoil:hull.position.x-poses[2].p.x,hitstop:hold,cableSegmentsVisible:cable.filter(n=>n.visible).length,finite:sceneRoot.matrixWorld.elements.every(Number.isFinite)};
  return lastStats;
 }
 return{root:sceneRoot,body,shots,apply,get stats(){return lastStats}};
}
