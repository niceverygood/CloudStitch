// CC0 Brackeys / Thomas Iche flipbooks; absolute event time, presentation only.
export function createDramaticEffects(T,scene,{weapon='cannon',textures={},reducedMotion=false}={}){
 const mg=weapon==='machinegun',root=new T.Group();scene.add(root);
 const plane=new T.PlaneGeometry(1,1),bulletGeo=new T.CylinderGeometry(.045,.075,1,8),materials=[];
 let disposed=false,activeEvents=0,activeProjectiles=0,droppedEvents=0;
 const vertexShader='varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
 const fragmentShader=`uniform sampler2D atlas; uniform float frame; uniform float opacity; uniform vec3 tint; varying vec2 vUv;
 void main(){vec2 cell=vec2(mod(frame,8.0),7.0-floor(frame/8.0));vec2 uv=(cell+clamp(vUv,vec2(.006),vec2(.994)))/8.0; vec4 c=texture2D(atlas,uv);if(c.a*opacity<.005)discard;gl_FragColor=vec4(c.rgb*tint,c.a*opacity);}`;
 function sprite(id,tint,add=false){const material=new T.ShaderMaterial({uniforms:{atlas:{value:textures[id]},frame:{value:0},opacity:{value:1},tint:{value:new T.Color(tint)}},vertexShader,fragmentShader,transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,blending:add?T.AdditiveBlending:T.NormalBlending});material.userData.outlineParameters={visible:false};materials.push(material);const mesh=new T.Mesh(plane,material);mesh.frustumCulled=false;root.add(mesh);return mesh;}
 const slots=Array.from({length:32},()=>({fire:sprite('explosion_01_8x8',0xffd394),smoke:sprite('explosion_smoke_01_8x8',0xd8c8ac),flash:sprite('fire_01_8x8',0xffcf84,true)}));
 const tracerMat=new T.MeshBasicMaterial({color:0xffd68b,toneMapped:false});tracerMat.userData.outlineParameters={visible:false};materials.push(tracerMat);
 const trails=Array.from({length:32},()=>{const m=new T.Mesh(bulletGeo,tracerMat);root.add(m);return m;});
 const y=new T.Vector3(0,1,0),axis=new T.Vector3();
 const clamp=x=>Math.max(0,Math.min(1,x));
 function hide(){slots.forEach(s=>Object.values(s).forEach(n=>n.visible=false));trails.forEach(n=>n.visible=false);}
 function show(mesh,e,age,duration,size,camera,{delay=0,lift=0,forward=0,fade=1,stretch=1}={}){
  const a=age-delay;if(a<0||a>=duration)return;const u=a/duration;mesh.visible=true;mesh.position.set(...e.position);
  axis.set(...(e.type==='hit'?(e.normal||[0,1,0]):e.direction)).normalize();mesh.position.addScaledVector(axis,forward);mesh.position.y+=lift*u*(reducedMotion?.25:1);
  mesh.quaternion.copy(camera.quaternion);mesh.scale.set(size*(.65+.35*Math.sqrt(u)),size*stretch*(.65+.35*Math.sqrt(u)),1);
  mesh.material.uniforms.frame.value=Math.min(63,Math.floor(u*64));mesh.material.uniforms.opacity.value=fade*(1-clamp((u-.7)/.3));
 }
 function update(time,events=[],projectiles=[],camera){if(disposed)return;hide();activeEvents=activeProjectiles=droppedEvents=0;if(!camera)return;
  const seen=new Set();for(const e of events){const age=time-e.time,key=e.type+':'+e.id+':'+e.time;if(!['fire','hit'].includes(e.type)||age<0||age>(mg?.85:1.95)||seen.has(key))continue;seen.add(key);if(activeEvents>=32){droppedEvents++;continue;}const s=slots[activeEvents++],hit=e.type==='hit',size=mg?(hit?1.8:1.5):(hit?7.5:5.2);
   show(s.fire,e,age,mg?.22:.7,size,camera,{forward:hit?.18:(mg?.6:1.2),stretch:hit?1:1.15});
   show(s.flash,e,age,mg?.065:.12,size*.65,camera,{forward:hit?.25:(mg?.75:1.5),fade:.9});
   show(s.smoke,e,age,mg?.6:1.65,size*1.25,camera,{delay:mg?.065:.14,lift:hit?(mg?.6:2.4):.7,forward:hit?.24:.8,fade:mg?.6:.85});
  }
  for(const p of projectiles.slice(0,32)){const m=trails[activeProjectiles++];m.visible=true;m.position.set(...p.position);axis.set(...p.direction).normalize();m.quaternion.setFromUnitVectors(y,axis);m.scale.set(mg?1:2,mg?1.2:2.3,mg?1:2);}
 }
 function reset(){hide();activeEvents=activeProjectiles=droppedEvents=0;}
 function dispose(){if(disposed)return;disposed=true;root.removeFromParent();plane.dispose();bulletGeo.dispose();materials.forEach(m=>m.dispose());}
 function debug(){return{disposed,activeEvents,activeProjectiles,droppedEvents,source:'Brackeys VFX Bundle / CC0',frameOrder:'left-to-right, top-to-bottom',simulationAuthority:false,callerTexturesOwned:true};}
 reset();return{update,reset,dispose,debug};
}
