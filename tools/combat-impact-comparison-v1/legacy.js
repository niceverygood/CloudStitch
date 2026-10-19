import { createPaintedMG } from '../combat-vfx-v2/machine-gun-soft-v1/painted-effects.js';

// Faithful old artwork, placed by the same authoritative comparison tape.
export function createLegacyEffects(THREE,scene,{weapon='cannon',atlas=null,metal=null,cannonAssets=null}={}){
  const mg=['mg','machinegun','machine-gun','01-machine-gun'].includes(weapon),LIMIT=12;
  const root=new THREE.Group();root.name='legacy-comparison-effects';scene.add(root);
  const Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1),axis=new THREE.Vector3();
  let disposed=false,lastTime=0,eventCount=0,projectileCount=0,dropped=0;
  const soft=[],pools={muzzle:[],hit:[],flight:[]};
  function makeClone(kind){const asset=cannonAssets?.[kind];if(!asset?.scene||!asset.animations?.length)throw new TypeError('Missing original cannon '+kind+' GLTF');const wrapper=new THREE.Group(),model=asset.scene.clone(true);wrapper.add(model);root.add(wrapper);wrapper.visible=false;const mixer=new THREE.AnimationMixer(model),clip=asset.animations[0],action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();let carrier=null;if(kind==='flight'){model.traverse(n=>{if(n.name.endsWith('_projectile_carrier_0'))carrier=n;});if(!carrier)throw new Error('Original cannon projectile carrier not found');}return{wrapper,model,mixer,action,clip,carrier};}
  if(mg){if(!atlas?.isTexture)throw new TypeError('Legacy MG requires its original atlas');for(let i=0;i<LIMIT;i++){const s=createPaintedMG(THREE,{atlas,metalTexture:metal});root.add(s.root);s.root.visible=false;soft.push(s);}}
  else{for(const kind of Object.keys(pools))for(let i=0;i<4;i++)pools[kind].push(makeClone(kind));}
  const safe=(a,f)=>Array.isArray(a)&&a.length>=3&&a.slice(0,3).every(Number.isFinite)?a:f;
  function unit(a,f){axis.set(...safe(a,f));if(axis.lengthSq()<1e-9)axis.set(...f);return axis.normalize();}
  function softPose(s,mode,time,position,direction,normal,camera){const p=safe(position,[0,0,0]),d=unit(direction,[0,0,1]).clone(),a=new THREE.Vector3(...p),b=a.clone();
    if(mode==='projectile'){a.addScaledVector(d,-.5);b.addScaledVector(d,.5);}
    else if(mode==='muzzle')b.add(d);
    s.update({mode,time,camera,muzzle:a.toArray(),hit:mode==='hit'?p:b.toArray(),impactNormal:mode==='hit'?safe(normal,[0,1,0]):null,amount:1.5});
  }
  function glbPose(s,time,position,direction,normal,kind){s.wrapper.visible=true;s.wrapper.position.set(...safe(position,[0,0,0]));s.wrapper.quaternion.setFromUnitVectors(kind==='hit'?Y:Z,unit(kind==='hit'?normal:direction,kind==='hit'?[0,1,0]:[0,0,1]));s.wrapper.scale.setScalar(1);
    // Reset action state before setTime: LoopOnce may have paused at the end of
    // a previous scrub. Geometry, texture, and material remain source-shared.
    s.action.reset().play();s.mixer.setTime(Math.max(0,Math.min(time,s.clip.duration)));
    if(s.carrier)s.carrier.position.z=0;
  }
  function update(time,events=[],projectiles=[],camera=null){if(disposed)return;lastTime=Number.isFinite(time)?Math.max(0,time):0;eventCount=projectileCount=dropped=0;soft.forEach(s=>s.root.visible=false);Object.values(pools).flat().forEach(s=>s.wrapper.visible=false);const seen=new Set(),active=[];
    for(const e of events){if(!e||!['fire','hit'].includes(e.type)||!Number.isFinite(e.time))continue;const mode=e.type==='fire'?'muzzle':'hit',duration=mg?(mode==='muzzle'?.2:.35):pools[mode][0].clip.duration,age=lastTime-e.time,key=e.type+':'+e.id+':'+e.time;if(age<0||age>=duration||seen.has(key))continue;seen.add(key);active.push({...e,mode,age});}
    active.sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id)));
    const used={muzzle:0,hit:0,flight:0};let softIndex=0;
    for(const e of active){if(mg){if(softIndex>=LIMIT){dropped++;continue;}softPose(soft[softIndex++],e.mode,e.age,e.position,e.direction,e.normal,camera);}else{const index=used[e.mode]++;if(index>=pools[e.mode].length){dropped++;continue;}glbPose(pools[e.mode][index],e.age,e.position,e.direction,e.normal,e.mode);}eventCount++;}
    for(const p of projectiles){if(mg){if(softIndex>=LIMIT){dropped++;continue;}softPose(soft[softIndex++],'projectile',.225,p.position,p.direction,null,camera);}else{const index=used.flight++;if(index>=pools.flight.length){dropped++;continue;}const s=pools.flight[index],fire=events.find(e=>e.type==='fire'&&e.id===p.id),age=fire?lastTime-fire.time:s.clip.duration*.5;glbPose(s,Math.min(Math.max(age,.02),s.clip.duration*.85),p.position,p.direction,null,'flight');}projectileCount++;}
  }
  function dispose(){if(disposed)return;disposed=true;soft.forEach(s=>s.dispose());for(const s of Object.values(pools).flat()){s.mixer.stopAllAction();s.mixer.uncacheRoot(s.model);}root.removeFromParent();}
  function debug(){return{weapon,time:lastTime,disposed,eventCount,projectileCount,dropped,poolInstances:LIMIT,softSingleMode:true,attackModeUsed:false,projectileIntegration:false,sharedCannonAssetsPreserved:true,carrierNames:pools.flight.map(s=>s.carrier.name)};}
  return{update,dispose,debug};
}
