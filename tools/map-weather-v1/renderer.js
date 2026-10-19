import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { createWeatherAssets } from './assets.mjs';
import { WEATHER_ZONES } from './sim.mjs';
import { makeWorldKit } from '../world-assets/core.mjs';
import * as terrain from '../map-atmosphere-v1/terrain.mjs';
import * as sky from '../map-atmosphere-v1/sky.mjs';
import * as props from '../map-atmosphere-v1/props.mjs';

const vec = (p) => new THREE.Vector3(p.x,p.y,p.z);
export async function createWeatherRenderer(stage, labels) {
  // Supersample a deterministic single-sample buffer. MSAA resolve on thin
  // translucent brush ribbons varied even between two freshly cleared frames.
  const renderer = new THREE.WebGLRenderer({antialias:false,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio||1,1.5),1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.setClearColor(0,0);renderer.autoClear=true;
  renderer.domElement.setAttribute('aria-label','바람과 폭풍 시험 항로. WASD 이동, Q/E 고도, F 예열. 드래그 회전, 휠 확대.');renderer.domElement.tabIndex=0;stage.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-90,90,65,-65,.1,650);
  const effect=new OutlineEffect(renderer,{defaultThickness:.0012,defaultColor:[.15,.22,.20],defaultKeepAlive:true});effect.autoClear=true;
  scene.add(new THREE.HemisphereLight(0xfff4d7,0x90a7a6,2.2));const sun=new THREE.DirectionalLight(0xffe5b5,2.2);sun.position.set(-60,100,40);scene.add(sun);const fill=new THREE.DirectionalLight(0xa9d2d0,.8);fill.position.set(50,20,-60);scene.add(fill);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minZoom=.35;controls.maxZoom=5;controls.maxPolarAngle=Math.PI*.47;controls.minPolarAngle=.12;controls.screenSpacePanning=true;
  let outlined=true,mode='handdrawn',follow=false,focusId=null,lastState=null,halfHeight=67,rotation=0;
  const records=[],converted=new Map(),gradient=new THREE.DataTexture(new Uint8Array([110,185,255]),3,1,THREE.RedFormat);gradient.minFilter=gradient.magFilter=THREE.NearestFilter;gradient.needsUpdate=true;
  function register(root){root.traverse(o=>{if(o.isMesh){records.push({mesh:o,original:o.material});for(const m of Array.isArray(o.material)?o.material:[o.material])m.userData.outlineParameters={thickness:.0012,color:[.16,.23,.2],visible:outlined};}});}
  function material(source){
    if(mode==='original')return source;const key=source.uuid+mode;if(converted.has(key))return converted.get(key);
    const p={color:source.color?.clone()||new THREE.Color(0xffffff),map:source.map||null,vertexColors:source.vertexColors,side:source.side,transparent:source.transparent,opacity:source.opacity,depthWrite:source.depthWrite,alphaTest:source.alphaTest};
    const m=mode==='cel'?new THREE.MeshToonMaterial({...p,gradientMap:gradient}):new THREE.MeshBasicMaterial(p);m.userData.outlineParameters={thickness:.0012,color:[.16,.23,.2],visible:outlined};converted.set(key,m);return m;
  }
  const reused=[];
  function reuse(module,id,position,size,rotationY=0){const spec=module.assets.find(s=>s.id===id),kit=makeWorldKit(spec),result=module.build(spec,kit)||{};kit.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(kit.root),s=b.getSize(new THREE.Vector3()),scale=size/Math.max(s.x,s.y,s.z,.01);const outer=new THREE.Group();outer.position.set(...position);outer.rotation.y=rotationY;kit.root.scale.setScalar(scale);kit.root.position.y-=b.max.y*scale;outer.add(kit.root);scene.add(outer);register(kit.root);const mixer=new THREE.AnimationMixer(kit.root);for(const c of result.clips||[])mixer.clipAction(c).play();reused.push({id,root:outer,mixer});return outer;}
  // These are read-only instances of the map collection, not new logical assets.
  reuse(terrain,'root-garden',[-67,4,-33],20,.3);
  reuse(terrain,'crescent-pass',[24,2,-42],25,-.7);
  reuse(terrain,'quiet-terrace',[-64,3,39],20,.5);
  reuse(terrain,'wreck-garden',[69,1,39],18,-.5);
  reuse(sky,'wind-swallows',[-30,19,-40],10,.4);
  reuse(props,'lantern-buoy',[21,12,3],7,.3);
  reuse(props,'mail-balloon',[-27,15,6],7,-.4);
  const assets=createWeatherAssets();scene.add(assets.root);
  const routes=new THREE.Group();scene.add(routes);
  // Broken stitches, rather than a filled plane, show the navigable sky.
  const routeMat=new THREE.MeshBasicMaterial({color:0xeaf0dc,transparent:true,opacity:.7,depthWrite:false});
  const course=[[-45,-24],[0,-24],[45,-24],[45,24],[0,24],[-45,24]];
  for(let j=0;j<course.length-1;j++){const a=course[j],b=course[j+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=0;d<len;d+=4){const t=d/len;const dash=new THREE.Mesh(new THREE.CapsuleGeometry(.08,1.8,2,4),routeMat);dash.position.set(a[0]+(b[0]-a[0])*t,1,a[1]+(b[1]-a[1])*t);dash.rotation.set(Math.PI/2,0,Math.atan2(b[1]-a[1],b[0]-a[0])+Math.PI/2);routes.add(dash);}}
  const labelNodes=WEATHER_ZONES.map((z,i)=>{const n=document.createElement('span');n.className='world-label';n.textContent=String(i+1).padStart(2,'0')+' · '+z.label;labels.append(n);return{zone:z,node:n};});
  const raw=Uint8Array.from(atob(__SHIP_BASE64__),c=>c.charCodeAt(0));
  const shipBytes=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const gltf=await new GLTFLoader().parseAsync(shipBytes,'');const ship=new THREE.Group(),model=gltf.scene;model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=9/Math.max(size.x,size.y,size.z);model.scale.setScalar(scale);model.position.copy(center).multiplyScalar(-scale);ship.add(model);scene.add(ship);register(model);
  const shadow=new THREE.Mesh(new THREE.RingGeometry(2.6,2.85,48),new THREE.MeshBasicMaterial({color:0x4f877b,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
  const frost=new THREE.Group();ship.add(frost);for(let i=0;i<18;i++){const ice=new THREE.Mesh(new THREE.OctahedronGeometry(.2,0),new THREE.MeshBasicMaterial({color:i%2?0xcbe8e7:0xf7f8e7}));ice.position.set(Math.sin(i*2.399)*2.4,Math.cos(i*.8)*.9,Math.cos(i*2.399)*3.4);ice.rotation.set(i,0,.3);frost.add(ice);}
  // Hostile observer is a training sight; actual lock permission is read from authority state.
  const sight=new THREE.Group();sight.position.set(-61,13,-28);const eye=new THREE.Mesh(new THREE.OctahedronGeometry(1.1),new THREE.MeshBasicMaterial({color:0xc27b5c}));sight.add(eye);scene.add(sight);
  const rayGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);const ray=new THREE.Line(rayGeo,new THREE.LineDashedMaterial({color:0xcd795a,dashSize:1.3,gapSize:.9,transparent:true,opacity:.75}));scene.add(ray);
  const marker=new THREE.Group();scene.add(marker);const targetMaterial=new THREE.MeshBasicMaterial({color:0xe27c5a,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false});const ring=new THREE.Mesh(new THREE.RingGeometry(4.9,5.4,64),targetMaterial);ring.rotation.x=-Math.PI/2;marker.add(ring);for(let i=0;i<7;i++){const h=new THREE.Mesh(new THREE.BoxGeometry(8,.04,.12),targetMaterial);h.position.z=(i-3)*1.05;h.rotation.y=-.5;marker.add(h);}marker.visible=false;
  function setMode(next){mode=next;for(const r of records)r.mesh.material=Array.isArray(r.original)?r.original.map(material):material(r.original);assets.setMode(next);}
  function setOutline(value){outlined=Boolean(value);for(const r of records)for(const m of Array.isArray(r.mesh.material)?r.mesh.material:[r.mesh.material])m.userData.outlineParameters={thickness:.0012,color:[.16,.23,.2],visible:outlined};}
  function drainControls(){const d=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=d;}
  function setView(kind='overview',id=null){drainControls();controls.autoRotate=false;follow=kind==='follow';focusId=id;const p=lastState?.player||{x:0,y:8,z:0},z=WEATHER_ZONES.find(z=>z.id===id);const target=z?vec(z.center):follow?vec(p):new THREE.Vector3(0,5,0);controls.target.copy(target);halfHeight=z?27:follow?26:67;camera.zoom=1;camera.position.copy(target).add(new THREE.Vector3(85,110,125).normalize().multiplyScalar(180));camera.lookAt(target);resize();controls.update();if(lastState)update(lastState,0);else renderNow();}
  function resize(){const w=Math.max(stage.clientWidth,1),h=Math.max(stage.clientHeight,1);renderer.setSize(w,h,false);camera.left=-halfHeight*w/h;camera.right=halfHeight*w/h;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();}
  function renderNow(){if(outlined)effect.render(scene,camera);else renderer.render(scene,camera);}
  function update(state,dt=0){lastState=state;const p=state.player;ship.position.set(p.x,p.y??8,p.z);rotation=p.angle??p.heading??rotation;ship.rotation.set(Math.sin(state.time*1.2)*.025,rotation,-Math.max(-.1,Math.min(.1,(p.vx||0)*.01)));ship.position.y+=Math.sin(state.time*1.1)*.13;
    const ice=p.icing??0;frost.visible=ice>.02;frost.scale.setScalar(.5+ice*.8);model.traverse(o=>{if(o.isMesh&&o.material){o.renderOrder=p.hidden?30:0;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.opacity=p.hidden?.62:1;m.transparent=Boolean(p.hidden);m.depthTest=!p.hidden;m.depthWrite=!p.hidden;}}});
    shadow.position.set(p.x,1.12,p.z);shadow.material.color.set(p.hidden?0x83b9b1:0x4f877b);sight.rotation.y=state.time*.35;ray.visible=!p.hidden&&(p.lock??1)>.1;const a=ray.geometry.attributes.position;a.setXYZ(0,sight.position.x,sight.position.y,sight.position.z);a.setXYZ(1,p.x,p.y??8,p.z);a.needsUpdate=true;ray.computeLineDistances();
    assets.update(state,dt);for(const r of reused)r.mixer.update(dt);
    const l=state.weather?.lightning;if(l){marker.visible=l.phase==='warning'||l.phase==='strike';marker.position.set(l.target.x,1.35,l.target.z);marker.scale.setScalar(l.phase==='strike'?1.1:1);targetMaterial.opacity=l.phase==='strike'?.95:.35+.25*Math.sin(state.time*9);}
    if(follow){const target=new THREE.Vector3(p.x,p.y??8,p.z),d=target.clone().sub(controls.target);camera.position.add(d);controls.target.copy(target);}
    controls.update(dt);renderNow();
    for(const {zone,node} of labelNodes){const q=new THREE.Vector3(zone.center.x,1,zone.center.z+16).project(camera);node.style.left=((q.x*.5+.5)*stage.clientWidth)+'px';node.style.top=((-q.y*.5+.5)*stage.clientHeight)+'px';node.hidden=Math.abs(q.x)>1||Math.abs(q.y)>1||q.z>1;node.classList.toggle('active',Boolean(state.weather?.[zone.id]?.inside));}
  }
  const observer=new ResizeObserver(resize);observer.observe(stage);setMode('handdrawn');setView('overview');
  return {renderer,effect,scene,camera,controls,ship,assets,update,renderNow,setMode,setOutline,setView,setAutoRotate(value){controls.autoRotate=Boolean(value);controls.autoRotateSpeed=.6;},setExpression(value){assets.setExpression?.(value);if(lastState)update(lastState,0);},fit(){setView(follow?'follow':'overview',focusId);},inspect(){return{shipLoaded:true,shipTriangles:11026,reusedMapIds:[...new Set(reused.map(r=>r.id))],assets:assets.inspect(),render:renderer.info.render,outlineAutoClear:effect.autoClear};},dispose(){observer.disconnect();controls.dispose();assets.dispose();scene.traverse(o=>{o.geometry?.dispose();});for(const m of converted.values())m.dispose();renderer.dispose();}};
}
