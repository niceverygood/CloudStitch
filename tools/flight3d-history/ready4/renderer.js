import * as THREE from 'three';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
import {loadShip} from '../battlefield/assets.js';
import {resolveFlightCamera} from './camera-geometry.mjs';

export function createFlightRenderer(container,labels){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#cfdfd9');scene.fog=new THREE.Fog('#d9e5dd',115,285);
  const webgl=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  webgl.setPixelRatio(Math.min(devicePixelRatio||1,1.5));webgl.outputColorSpace=THREE.SRGBColorSpace;webgl.autoClear=true;container.append(webgl.domElement);
  const outline=new OutlineEffect(webgl,{defaultThickness:.0014,defaultColor:[.22,.23,.16]});outline.autoClear=true;
  const camera=new THREE.PerspectiveCamera(57,1,.15,500),look=new THREE.Vector3(),cameraPosition=new THREE.Vector3();
  let yaw=0,followYaw=0,freeYaw=0,looking=false,freeLookUntil=0,elevation=.24,distance=28,first=true,playerAsset,disposed=false,latestState=null;
  const actors=new Map(),shots=new Map(),effects=new Map(),gates=new Map(),warnings=new Map(),labelViews=new Map(),owned=new Set();
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),up=new THREE.Vector3(0,1,0),scratch=new THREE.Vector3();
  scene.add(new THREE.HemisphereLight('#fff8df','#789c8c',2));
  const sun=new THREE.DirectionalLight('#ffe4ad',1.7);sun.position.set(-35,65,20);scene.add(sun);
  const fill=new THREE.DirectionalLight('#b2d8da',.5);fill.position.set(40,20,-60);scene.add(fill);
  const gradient=new THREE.DataTexture(new Uint8Array([114,189,255]),3,1,THREE.RedFormat);gradient.needsUpdate=true;gradient.minFilter=gradient.magFilter=THREE.NearestFilter;owned.add(gradient);
  function material(color,unlit=false,opacity=1){const m=unlit?new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity}):new THREE.MeshToonMaterial({color,gradientMap:gradient});owned.add(m);return m;}
  function mesh(geometry,paint,group=scene){owned.add(geometry);const value=new THREE.Mesh(geometry,paint);group.add(value);return value;}
  function noOutline(m){m.userData.outlineParameters={visible:false};return m;}
  const cloudMat=noOutline(material('#f4f1df',true,.3));cloudMat.depthWrite=false;
  for(let i=0;i<44;i++){const cloud=mesh(new THREE.IcosahedronGeometry(1,1),cloudMat);cloud.position.set((i*53.27)%310-155,-33+(i%4)*17,(i*87.9)%300-150);cloud.scale.set(12+i%5*4,1.7,7+i%3*4);}
  // Distant silhouettes are below the playable corridor and carry no collision.
  const farMat=material('#9ab1a2');for(let i=0;i<12;i++){const m=mesh(new THREE.IcosahedronGeometry(1,1),farMat);const a=i*Math.PI/6;m.position.set(Math.sin(a)*185,-32-(i%3)*6,Math.cos(a)*185);m.scale.set(18,14,15);}
  const terrain=new THREE.Group();scene.add(terrain);
  function createTerrain(state){
    const rock=material('#b2a58c'),grass=material('#a5b77d'),wood=material('#bd925d');
    for(const obstacle of state.obstacles){
      if(obstacle.kind==='ellipsoid'){
        const m=mesh(new THREE.IcosahedronGeometry(1,2),rock,terrain);m.position.set(obstacle.x,obstacle.y,obstacle.z);m.scale.set(obstacle.rx,obstacle.ry,obstacle.rz);
        const cap=mesh(new THREE.IcosahedronGeometry(1,2),grass,terrain);cap.position.set(obstacle.x,obstacle.y+obstacle.ry*.64,obstacle.z);cap.scale.set(obstacle.rx*.77,obstacle.ry*.31,obstacle.rz*.77);
      }else{
        const m=mesh(new THREE.BoxGeometry(obstacle.half.x*2,obstacle.half.y*2,obstacle.half.z*2),wood,terrain);m.position.set(obstacle.x,obstacle.y,obstacle.z);
      }
    }
    // The departure deck is decoration below the starting craft.
    const deck=mesh(new THREE.BoxGeometry(17,.7,12),wood,terrain);deck.position.set(0,-.8,42);
    const teal=material('#56877e');for(const x of [-8,8]){const post=mesh(new THREE.CylinderGeometry(.3,.3,5,8),teal,terrain);post.position.set(x,1,47);}
  }
  function label(id,text,kind=''){
    let l=labelViews.get(id);if(!l){l=document.createElement('div');labels.append(l);labelViews.set(id,l);}l.className=`world-label ${kind}`;l.textContent=text;return l;
  }
  function placeLabel(element,point,visible=true,pin=false){
    scratch.set(point.x,point.y,point.z).project(camera);const front=scratch.z>=-1&&scratch.z<=1;
    const inFrame=front&&Math.abs(scratch.x)<.96&&Math.abs(scratch.y)<.86;
    element.hidden=!visible||(!inFrame&&!pin);if(element.hidden)return;
    element.dataset.offscreen=String(!inFrame);
    const w=container.clientWidth,h=container.clientHeight,box=element.getBoundingClientRect(),sx=(scratch.x*.5+.5)*w,sy=(-scratch.y*.5+.5)*h;
    // If a goal is behind the camera, reflect its direction to the matching edge.
    const x=front?sx:w-sx,y=front?sy:h-sy;
    element.style.left=`${THREE.MathUtils.clamp(x,12+box.width/2,w-12-box.width/2)}px`;
    element.style.top=`${THREE.MathUtils.clamp(y,Math.max(112,box.height+12),h-140)}px`;
  }
  async function initialize(state){
    createTerrain(state);const ids=['player-homeward',...state.targets.map(()=> 'enemy-pirate-scout')];
    const assets=[];
    try{for(let i=0;i<ids.length;i++){const a=await loadShip(THREE,ids[i],i===0?10:8);assets.push(a);if(disposed)throw new Error('표시가 종료됐습니다.');scene.add(a.group);if(i===0)playerAsset=a;else actors.set(state.targets[i-1].id,a);}}
    catch(error){assets.forEach(a=>a.dispose());throw error;}
    for(let i=0;i<state.gates.length;i++){
      const g=state.gates[i],group=new THREE.Group();group.position.set(g.x,g.y,g.z);scene.add(group);
      const prev=i?state.gates[i-1]:state.player,direction=new THREE.Vector3(g.x-prev.x,g.y-prev.y,g.z-prev.z).normalize();
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
      const ring=mesh(new THREE.TorusGeometry(g.radius,.28,8,56),material('#c79c54'),group);
      const inner=mesh(new THREE.TorusGeometry(g.radius-.55,.055,4,48),noOutline(material('#fff2bd',true)),group);
      gates.set(g.id,{group,ring,inner});
    }
    resize();return api;
  }
  function resize(){const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);webgl.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(container);
  function resetCamera(){freeYaw=0;looking=false;freeLookUntil=0;followYaw=(latestState?.player.heading??Math.PI)-Math.PI;yaw=followYaw;elevation=.24;distance=28;first=true;}
  function orbit(dx,dy){freeYaw-=dx*.0045;freeYaw=Math.atan2(Math.sin(freeYaw),Math.cos(freeYaw));elevation=THREE.MathUtils.clamp(elevation+dy*.003,-.18,1.1);}
  function moveBasis(x,y,z){const length=Math.max(1,Math.hypot(x,y,z));return{x:(Math.cos(yaw)*x+Math.sin(yaw)*z)/length,y:y/length,z:(-Math.sin(yaw)*x+Math.cos(yaw)*z)/length};}
  function aimAt(clientX,clientY,state){
    const rect=container.getBoundingClientRect();pointer.set(((clientX??rect.left+rect.width/2)-rect.left)/rect.width*2-1,-((clientY??rect.top+rect.height/2)-rect.top)/rect.height*2+1);
    ray.setFromCamera(pointer,camera);let best=Infinity,point=null;
    for(const target of state.targets){if(target.defeated)continue;const p=ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(target.x,target.y,target.z),target.radius),new THREE.Vector3());if(p){const d=p.distanceTo(ray.ray.origin);if(d<best){point=p;best=d;}}}
    if(!point)point=ray.ray.at(220,new THREE.Vector3());return{x:point.x,y:point.y,z:point.z};
  }
  function render(state,dt=0,aim=null){
    if(disposed||!playerAsset)return;latestState=state;const p=state.player,active=!state.paused&&p.hp>0;
    const attitude=p.attitude||{pitch:0,roll:0,heave:0};
    playerAsset.group.position.set(p.x,p.y+attitude.heave,p.z);playerAsset.group.rotation.set(attitude.pitch,p.heading||0,attitude.roll,'YXZ');
    if(aim)playerAsset.aimAt(aim.x-p.x,aim.z-p.z,p.heading||0);playerAsset.update(active?dt:0);
    if(active||first){
      const desiredYaw=p.heading-Math.PI;
      followYaw+=Math.atan2(Math.sin(desiredYaw-followYaw),Math.cos(desiredYaw-followYaw))*(first?1:1-Math.exp(-Math.max(0,dt)*3));
      if(!looking&&state.time>freeLookUntil&&(Math.hypot(p.vx,p.vz)>.65||Math.abs(p.yawRate||0)>.025))freeYaw*=Math.exp(-dt*1.3);
      yaw=followYaw+freeYaw;
    }
    if(looking)yaw=followYaw+freeYaw;
    const focus=new THREE.Vector3(p.x-Math.sin(yaw)*6,p.y+3,p.z-Math.cos(yaw)*6);
    const wanted=focus.clone().add(new THREE.Vector3(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation)).multiplyScalar(distance));
    // The look target can also enter a solid near an overhang. Resolve both
    // focus and arm, including smoothing, from the safe player anchor.
    const resolved=resolveFlightCamera({player:p,desiredFocus:focus,desiredPosition:wanted,previousFocus:first?null:look,previousPosition:first?null:cameraPosition,blend:first?1:1-Math.exp(-Math.max(dt,.001)*7),obstacles:state.obstacles});
    look.set(resolved.focus.x,resolved.focus.y,resolved.focus.z);cameraPosition.set(resolved.position.x,resolved.position.y,resolved.position.z);first=false;
    playerAsset.group.visible=cameraPosition.distanceTo(new THREE.Vector3(p.x,p.y,p.z))>4;
    camera.position.copy(cameraPosition);camera.lookAt(look);camera.updateMatrixWorld();
    for(const target of state.targets){
      const asset=actors.get(target.id);if(!asset)continue;asset.group.visible=!target.defeated;
      asset.group.position.set(target.x,target.y,target.z);asset.group.rotation.y=target.heading||Math.PI;
      asset.aimAt(p.x-target.x,p.z-target.z,target.heading||Math.PI);asset.update(active?dt:0);
      const dh=target.y-p.y,text=`${target.label||'시험 표적'} · ${Math.round(target.hp)}${target.telegraph?' · 포격 예고':''} · ${dh>=0?'↑':'↓'}${Math.abs(dh).toFixed(0)}`;
      placeLabel(label(target.id,text,target.telegraph?'danger':'target'),{...target,y:target.y+4},!target.defeated,!!target.telegraph);
      let warning=warnings.get(target.id);
      if(target.telegraph){
        if(!warning){
          const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);owned.add(geometry);
          const paint=new THREE.LineDashedMaterial({color:'#d47c5f',dashSize:1,gapSize:.7,transparent:true,opacity:.75});noOutline(paint);owned.add(paint);
          const line=new THREE.Line(geometry,paint);scene.add(line);
          const marker=mesh(new THREE.IcosahedronGeometry(p.radius,1),noOutline(material('#d47c5f',true,.4)));marker.material.wireframe=true;
          warning={line,marker};warnings.set(target.id,warning);
        }
        const aim=target.telegraph.aim,positions=warning.line.geometry.attributes.position;
        positions.setXYZ(0,target.x,target.y,target.z);positions.setXYZ(1,aim.x,aim.y,aim.z);positions.needsUpdate=true;warning.line.geometry.computeBoundingSphere();warning.line.computeLineDistances();warning.marker.position.set(aim.x,aim.y,aim.z);warning.line.visible=warning.marker.visible=true;
      }else if(warning)warning.line.visible=warning.marker.visible=false;
    }
    for(let i=0;i<state.gates.length;i++){
      const g=state.gates[i],view=gates.get(g.id),next=i===state.routeIndex;
      // A future return hoop shares the initial spawn. Reveal it after leaving,
      // so it cannot fill the camera around the craft before it is a goal.
      view.group.visible=!g.passed&&(next||Math.hypot(g.x-p.x,g.y-p.y,g.z-p.z)>14);
      view.ring.material.color.set(next?'#e3ba65':'#86aaa1');view.inner.visible=next;
      if(next){const delta=g.y-p.y;placeLabel(label(g.id,`${i+1} · ${g.label} · ${Math.round(Math.hypot(g.x-p.x,g.y-p.y,g.z-p.z))} · ${delta>=0?'↑':'↓'}${Math.abs(delta).toFixed(0)}`,'gate'),{...g,y:g.y+g.radius+1},true,true);}
      else{const l=labelViews.get(g.id);if(l)l.hidden=true;}
    }
    const liveShots=new Set();for(const shot of state.projectiles){liveShots.add(shot.id);let m=shots.get(shot.id);if(!m){m=mesh(new THREE.CapsuleGeometry(.14,1.2,3,6),noOutline(material(shot.owner==='player'?'#ffe5a0':'#e2896b',true)));shots.set(shot.id,m);}m.position.set(shot.x,shot.y,shot.z);m.quaternion.setFromUnitVectors(up,new THREE.Vector3(shot.vx,shot.vy,shot.vz).normalize());}
    for(const [id,m]of shots)if(!liveShots.has(id)){m.removeFromParent();m.material.dispose();m.geometry.dispose();owned.delete(m.material);owned.delete(m.geometry);shots.delete(id);}
    const liveEffects=new Set();for(const fx of state.effects||[]){liveEffects.add(fx.id);let group=effects.get(fx.id);if(!group){group=mesh(new THREE.IcosahedronGeometry(1,1),noOutline(material(fx.type.includes('hit')?'#eb9f73':'#f7dda1',true,.7)));effects.set(fx.id,group);}group.position.set(fx.x,fx.y,fx.z);group.scale.setScalar(.4+(fx.age/fx.life)*2);group.material.opacity=Math.max(0,1-fx.age/fx.life);}
    for(const[id,m]of effects)if(!liveEffects.has(id)){m.removeFromParent();m.geometry.dispose();m.material.dispose();owned.delete(m.geometry);owned.delete(m.material);effects.delete(id);}
    webgl.autoClear=true;outline.autoClear=true;outline.render(scene,camera);
  }
  function dispose(){disposed=true;observer.disconnect();playerAsset?.dispose();actors.forEach(a=>a.dispose());owned.forEach(r=>r.dispose?.());outline.dispose();webgl.dispose();webgl.domElement.remove();labels.replaceChildren();}
  const api={initialize,render,resize,orbit,moveBasis,aimAt,resetCamera,dispose,scene,camera,webgl,outline,
    beginLook(){looking=true;},endLook(){looking=false;freeLookUntil=(latestState?.time||0)+.9;},
    projectPoint(point){const value=new THREE.Vector3(point.x,point.y,point.z).project(camera),r=container.getBoundingClientRect();return{x:r.left+(value.x*.5+.5)*r.width,y:r.top+(-value.y*.5+.5)*r.height,depth:value.z};},
    zoom(delta){distance=THREE.MathUtils.clamp(distance+delta,17,55);},
    stats(){return{projection:'perspective',fov:camera.fov,position:camera.position.toArray(),target:look.toArray(),yaw,followYaw,freeYaw,looking,elevation,distance,visualPose:playerAsset?{position:playerAsset.group.position.toArray(),rotation:playerAsset.group.rotation.toArray()}:null,ships:actors.size+Number(!!playerAsset),shots:shots.size,memory:{...webgl.info.memory},drawCalls:webgl.info.render.calls,triangles:webgl.info.render.triangles,outlineAutoClear:outline.autoClear,altitude:latestState?.player.y};}
  };return api;
}
