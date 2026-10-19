import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { loadShip } from '../battlefield/assets.js';
import { createWorld } from '../battlefield/world.js';
import {cameraProfile,cameraBasis,screenMove,framingHeight} from './camera-profiles.mjs';

export { THREE };
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const materialList = material => Array.isArray(material) ? material : [material];
const positionOf = value => Array.isArray(value) ? value : [finite(value?.x), finite(value?.y), finite(value?.z)];
const modulePosition = (enemy, part) => {
  const c = Math.cos(finite(enemy.angle)), s = Math.sin(finite(enemy.angle));
  return {x:enemy.x + finite(part.localX) * c + finite(part.localZ) * s, z:enemy.z - finite(part.localX) * s + finite(part.localZ) * c};
};

/** Presentation only. All ship positions, shots, warnings and damage come from sim. */
export function createVoyageRenderer({container, labels, onStatus = () => {}}) {
  if (!container || !labels) throw new Error('전장을 표시할 공간이 없습니다.');
  const startedAt = performance.now(), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d8e8df');
  scene.fog = new THREE.Fog('#e8eddc', 105, 245);
  const webgl = new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  webgl.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  webgl.outputColorSpace = THREE.SRGBColorSpace;
  webgl.toneMapping = THREE.NoToneMapping;
  webgl.autoClear = true;
  webgl.info.autoReset = false;
  container.append(webgl.domElement);
  const effect = new OutlineEffect(webgl, {defaultThickness:.0013,defaultColor:[.19,.19,.12],defaultAlpha:1,defaultKeepAlive:true});
  // OutlineEffect owns clearing during both passes; renderer.autoClear alone is insufficient.
  effect.autoClear = true;
  const camera = new THREE.OrthographicCamera(-35,35,35,-35,.1,500);
  let viewId='oblique';
  const cameraTarget = new THREE.Vector3(0,0,40), offset = new THREE.Vector3(...cameraBasis(viewId).offset);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0,1,0),0), rayHit = new THREE.Vector3();
  const projected = new THREE.Vector3(), up = new THREE.Vector3(0,1,0);
  const worldGroup = new THREE.Group(), actorGroup = new THREE.Group(), transientGroup = new THREE.Group();
  worldGroup.name = 'catalog-world'; actorGroup.name = 'authoritative-fleet'; transientGroup.name = 'authoritative-transients';
  scene.add(worldGroup,actorGroup,transientGroup);
  // Reuse the authored first-battle scenery as presentation only. Its returned
  // obstacles are NOT injected a second time; the level contract owns positions.
  const paintedReach = createWorld(THREE); scene.add(paintedReach.group);
  scene.add(new THREE.HemisphereLight('#fffae9','#8ca688',1.2));
  const sunlight = new THREE.DirectionalLight('#fff1ce',1.35);sunlight.position.set(-35,75,30);scene.add(sunlight);
  const fill = new THREE.DirectionalLight('#b3d4cf',.35);fill.position.set(30,30,-45);scene.add(fill);

  const gradient = new THREE.DataTexture(new Uint8Array([122,191,255]),3,1,THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;gradient.generateMipmaps = false;gradient.needsUpdate = true;
  const owned = new Set([gradient]);
  const circleGeometry = new THREE.RingGeometry(.93,1,64), projectileGeometry = new THREE.CapsuleGeometry(.12,.55,3,6);
  owned.add(circleGeometry);owned.add(projectileGeometry);
  const enemyViews = new Map(), debrisViews = new Map(), projectiles = new Map(), warnings = new Map(), connectorViews = new Map(), labelViews = new Map();
  const worldViews = new Map(), worldSources = new Map(), modelErrors = new Map(), pendingActors = new Set();
  let disposed = false, playerAsset = null, playerWrapper = null, currentLevel = null, currentSim = null, currentPhase = null, latest = null;
  let levelToken = 0, actorToken = 0, queue = Promise.resolve(), pendingLoads = 0, catalog = null, effects = null, overview = false, zoom = 1;
  let firstReadyMs = null, worldReadyMs = null, frameCount = 0, eventSequence = 0, effectsFloor = 0, cameraOccluderIds = [], cinematicHalfHeight = 24;
  const loadRecords = [], frameTimes = [], eventListeners = new Set();

  const noOutline = material => {material.userData.outlineParameters = {visible:false};return material;};
  function ring(color, radius, opacity = .55) {
    const material = noOutline(new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));
    const mesh = new THREE.Mesh(circleGeometry,material);mesh.rotation.x = -Math.PI / 2;mesh.scale.setScalar(radius);return mesh;
  }
  const playerRing = ring('#648c72',4.7,.23);playerRing.position.y = -2.5;actorGroup.add(playerRing);
  const returnRing = ring('#568b7c',12,.38);returnRing.position.set(0,-2,48);scene.add(returnRing);
  const returnDash = ring('#f8efcc',11.4,.55);returnDash.position.set(0,-1.98,48);scene.add(returnDash);

  function watercolorClouds() {
    const width = 96, height = 64, pixels = new Uint8Array(width * height * 4);
    const lobes = [[-.43,.04,.45,.42],[-.07,-.08,.52,.53],[.4,.04,.44,.37],[.16,.22,.43,.34]];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const u=x/(width-1)*2-1,v=y/(height-1)*2-1;let clear=1;
      for(const [cx,cy,rx,ry] of lobes)clear*=1-Math.exp(-((u-cx)**2/rx**2+(v-cy)**2/ry**2)*2.6)*.9;
      const density=Math.max(0,Math.min(1,(1-clear-.02)*(1+Math.sin(x*1.7+y*2.1)*.035)));
      const i=(y*width+x)*4;pixels[i]=255;pixels[i+1]=253;pixels[i+2]=236;pixels[i+3]=Math.round(density*223);
    }
    const texture=new THREE.DataTexture(pixels,width,height);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
    texture.minFilter=texture.magFilter=THREE.LinearFilter;
    const geometry=new THREE.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
    const material=noOutline(new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.83,depthWrite:false,alphaTest:.012,side:THREE.DoubleSide}));
    const mesh=new THREE.InstancedMesh(geometry,material,72), transform=new THREE.Object3D(), color=new THREE.Color();
    for(let i=0;i<72;i++){
      transform.position.set((i*67.3)%330-165,-23-(i%5)*3,(i*47.1)%330-165);
      transform.scale.set(18+i%7*3.4,1,11+i%5*2.5);transform.rotation.y=(i%7-3)*.07;transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
      color.set(i%4===0?'#cbdcd0':i%3===0?'#e1ead8':'#fff5db');mesh.setColorAt(i,color);
    }
    mesh.name='Watercolor cloud washes';mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;scene.add(mesh);
    owned.add(texture);owned.add(geometry);owned.add(material);return mesh;
  }
  const clouds = watercolorClouds();

  function enqueue(work) {
    pendingLoads++;
    const task=queue.then(()=>disposed?null:work());
    queue=task.catch(()=>{}).finally(()=>pendingLoads--);
    return task;
  }
  function createLabel(id, text, kind='') {
    let label=labelViews.get(id);
    if(!label){
      const element=document.createElement('div');element.className=`world-label ${kind}`;
      const title=document.createElement('span');title.textContent=text;element.append(title);
      label={element,title,health:null};labels.append(element);labelViews.set(id,label);
    }
    if(label.title.textContent!==text)label.title.textContent=text;
    return label;
  }
  function placeLabel(label, x, y, z, visible=true, pinOffscreen=false) {
    projected.set(x,y,z).project(camera);
    const onScreen=projected.z>=-1&&projected.z<=1&&Math.abs(projected.x)<1.03&&Math.abs(projected.y)<.93;
    const show=visible&&(onScreen||pinOffscreen);
    label.element.hidden=!show;
    label.element.dataset.offscreen=String(!onScreen);
    if(show){
      const sx=projected.x*.5+.5,sy=-projected.y*.5+.5;
      const width=container.clientWidth,height=container.clientHeight,safe=8;
      const bounds=label.element.getBoundingClientRect();
      // Labels translate by (-50%, -100%): reserve their full drawn size,
      // rather than pinning only the anchor and clipping the text at an edge.
      const px=(onScreen?sx:THREE.MathUtils.clamp(sx,.12,.88))*width;
      const py=(onScreen?sy:THREE.MathUtils.clamp(sy,.27,.83))*height;
      label.element.style.left=`${THREE.MathUtils.clamp(px,safe+bounds.width/2,width-safe-bounds.width/2)}px`;
      label.element.style.top=`${THREE.MathUtils.clamp(py,safe+bounds.height,height-safe)}px`;
    }
  }
  function removeLabel(id){const label=labelViews.get(id);if(label){label.element.remove();labelViews.delete(id);}}
  function paintMaterial(source) {
    const material=new THREE.MeshToonMaterial({color:source.color?.clone()||new THREE.Color('#f4e8ce'),map:source.map||null,alphaMap:source.alphaMap||null,transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest,side:source.side,vertexColors:source.vertexColors,gradientMap:gradient,toneMapped:false});
    material.userData.outlineParameters={thickness:.0012,color:[.2,.21,.14],alpha:1,visible:true,keepAlive:true};
    material.userData.originalOpacity=material.opacity;material.userData.originalTransparent=material.transparent;return material;
  }
  function paintObject(object) {
    const mapping=new Map(),materials=[];
    object.traverse(node=>{
      if(!node.isMesh)return;
      const paint=source=>{if(!mapping.has(source)){const material=paintMaterial(source);mapping.set(source,material);materials.push(material);}return mapping.get(source);};
      node.material=Array.isArray(node.material)?node.material.map(paint):paint(node.material);node.castShadow=false;node.receiveShadow=false;
    });
    return materials;
  }

  /** Compatibility path keeps the real GLB when an older loader has a fixed ID list. */
  async function genericShip(assetId, length) {
    if(!/^[a-z0-9][a-z0-9-]+$/.test(assetId))throw new Error('비행선 이름이 올바르지 않습니다.');
    const gltf=await new GLTFLoader().loadAsync(`../fleet-v1/ships/${assetId}.glb`),model=cloneSkeleton(gltf.scene);
    model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    if(size.x<=0||!Number.isFinite(size.x))throw new Error(`비행선 크기를 읽지 못했습니다: ${assetId}`);
    model.position.sub(center);const normalized=new THREE.Group();normalized.rotation.y=Math.PI/2;normalized.scale.setScalar(length/size.x);normalized.add(model);
    const group=new THREE.Group();group.add(normalized);const materials=paintObject(model);
    return {group,model,source:{assetId,genericDisplayAdapter:true,authoredForward:'-X',gameplayForward:'+Z'},update(){},setModuleState(){},dispose(){group.removeFromParent();materials.forEach(material=>material.dispose());}};
  }
  async function shipAsset(assetId, length=10) {
    const before=performance.now();
    let asset;
    try{asset=await loadShip(THREE,assetId,length);}
    catch(error){if(!/지원하지 않는|unsupported/i.test(error.message))throw error;asset=await genericShip(assetId,length);}
    loadRecords.push({kind:'fleet',assetId,durationMs:Math.round(performance.now()-before),fallback:!!asset.source?.genericDisplayAdapter});
    return asset;
  }
  function actorView(asset) {
    const wrapper=new THREE.Group();wrapper.add(asset.group);actorGroup.add(wrapper);
    const selection=ring('#b38b65',4.6,.18);selection.position.y=-2.4;actorGroup.add(selection);
    return {asset,wrapper,selection};
  }
  function releaseSkeletons(root) {
    const skeletons = new Set(); root?.traverse(node => { if (node.isSkinnedMesh && node.skeleton) skeletons.add(node.skeleton); });
    for (const skeleton of skeletons) skeleton.dispose();
  }
  function clearView(view){releaseSkeletons(view.asset?.group || view.wrapper || view.group);view.wrapper?.removeFromParent();view.group?.removeFromParent();view.selection?.removeFromParent();view.selection?.material.dispose();view.asset?.dispose();}

  async function initialize() {
    resize();camera.position.copy(cameraTarget).add(offset);camera.lookAt(cameraTarget);
    playerAsset=await enqueue(()=>shipAsset('player-homeward',10));
    if(disposed){releaseSkeletons(playerAsset?.group);playerAsset?.dispose();return api;}
    playerWrapper=new THREE.Group();playerWrapper.add(playerAsset.group);actorGroup.add(playerWrapper);
    playerWrapper.position.set(0,0,40);playerWrapper.rotation.y=0;playerRing.position.set(0,-2.5,40);
    firstReadyMs=Math.round(performance.now()-startedAt);draw();return api;
  }
  async function loadCatalog() {
    if(catalog)return catalog;
    const response=await fetch('../world-assets/catalog.json');if(!response.ok)throw new Error(`월드 목록을 읽지 못했습니다 (${response.status}).`);
    catalog=await response.json();return catalog;
  }
  async function sourceWorld(assetId) {
    if(!worldSources.has(assetId)){
      const promise=(async()=>{
        const data=await loadCatalog(),entry=data.items.find(item=>item.id===assetId);
        if(!entry)throw new Error(`월드 목록에 없는 자산입니다: ${assetId}`);
        if(!entry.model||entry.model.startsWith('/')||entry.model.includes('..'))throw new Error(`월드 경로가 올바르지 않습니다: ${assetId}`);
        const before=performance.now(),gltf=await new GLTFLoader().loadAsync(`../world-assets/${entry.model}`);
        loadRecords.push({kind:'world',assetId,path:entry.model,bytes:entry.bytes,durationMs:Math.round(performance.now()-before)});return gltf;
      })().catch(error=>{worldSources.delete(assetId);throw error;});
      worldSources.set(assetId,promise);
    }
    return worldSources.get(assetId);
  }
  function clearWorld() {
    for(const view of worldViews.values()){view.group.removeFromParent();view.materials.forEach(material=>material.dispose());}
    worldViews.clear();worldGroup.clear();cameraOccluderIds=[];
  }
  function setLevel(level) {
    if(!level||currentLevel?.id===level.id)return;
    currentLevel=level;const token=++levelToken,start=performance.now();worldReadyMs=null;clearWorld();
    paintedReach.group.visible = level.id === 'first-voyage';
    clouds.visible = level.id !== 'first-voyage';
    const startPosition=level.id==='jonghang-harbor'?[0,0,57]:positionOf(level.playerStart?.position);cameraTarget.set(...startPosition);
    offset.set(...cameraBasis(overview?'high':viewId).offset);
    resize();
    // The battle's merged islands provide landmarks; catalog markers and the
    // harbor keep their real authored GLBs. No duplicate terrain is stacked.
    const battleMarkers = new Set(['return-buoy-west','return-buoy-east','wreck-marker','north-beacon']);
    const candidates=(level.visuals||[]).filter(visual=>['required','landmark'].includes(visual.priority||'required') && (level.id !== 'first-voyage' || battleMarkers.has(visual.id)));
    const harborCore=['workshop','market','dock-main','dock-end','platform-west','platform-east','repair-point','storage-point'];
    candidates.sort((a,b)=>{
      const rank=item=>level.id==='jonghang-harbor'?(harborCore.includes(item.id)?harborCore.indexOf(item.id):harborCore.length):(item.priority==='required'?0:1);
      return rank(a)-rank(b);
    });
    const selected=candidates.slice(0,12);
    selected.forEach(visual=>enqueue(async()=>{
      if(token!==levelToken)return;
      try{
        const gltf=await sourceWorld(visual.assetId);if(disposed||token!==levelToken)return;
        const model=gltf.scene.clone(true),box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
        const longest=Math.max(size.x,size.y,size.z),displaySize=finite(visual.displaySizeLU,finite(visual.longestLU,10));
        if(longest<=0||displaySize<=0)throw new Error(`월드 크기가 올바르지 않습니다: ${visual.assetId}`);
        model.position.sub(box.getCenter(new THREE.Vector3()));
        const normalization=new THREE.Group();normalization.scale.setScalar(displaySize/longest);normalization.add(model);
        const group=new THREE.Group();group.add(normalization);group.position.set(...positionOf(visual.position));group.rotation.y=finite(visual.yawRadians);group.name=visual.id;
        const materials=paintObject(model);worldGroup.add(group);worldViews.set(visual.id,{group,materials,assetId:visual.assetId});
      }catch(error){modelErrors.set(visual.id,error.message);onStatus(error.message,{error:true});}
    }));
    queue.then(()=>{if(token===levelToken)worldReadyMs=Math.round(performance.now()-start);});
  }
  function resize() {
    const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight),aspect=width/height;
    webgl.setSize(width,height,false);
    const harborHeight=currentLevel?.id==='jonghang-harbor'?Math.max(24,23/aspect):cinematicHalfHeight;
    const base=overview?103:harborHeight*zoom;
    camera.left=-base*aspect;camera.right=base*aspect;camera.top=base;camera.bottom=-base;camera.updateProjectionMatrix();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);

  function clearTransient() {
    actorToken++;pendingActors.clear();
    for(const view of enemyViews.values())clearView(view);enemyViews.clear();
    for(const view of debrisViews.values()){releaseSkeletons(view.group);view.group.removeFromParent();view.materials?.forEach(material=>material.dispose());view.ring.removeFromParent();view.ring.material.dispose();}debrisViews.clear();
    for(const mesh of projectiles.values()){mesh.removeFromParent();mesh.material.dispose();}projectiles.clear();
    for(const warning of warnings.values()){warning.line.removeFromParent();warning.target.removeFromParent();warning.line.geometry.dispose();warning.line.material.dispose();warning.target.material.dispose();}warnings.clear();
    for(const view of connectorViews.values()){view.removeFromParent();view.material.dispose();}connectorViews.clear();
    for(const label of labelViews.values())label.element.remove();labelViews.clear();effects?.reset?.();eventSequence=0;effectsFloor=0;
  }
  function reset(){clearTransient();currentSim=null;latest=null;webgl.clear(true,true,true);}
  function requestEnemy(enemy) {
    if(enemyViews.has(enemy.id)||pendingActors.has(enemy.id)||modelErrors.has(`fleet:${enemy.assetId}`))return;
    pendingActors.add(enemy.id);const token=actorToken;
    enqueue(async()=>{
      if(token!==actorToken)return;
      try{
        const asset=await shipAsset(enemy.assetId,finite(enemy.displayLength,10));
        if(disposed||token!==actorToken){releaseSkeletons(asset.group);asset.dispose();return;}
        enemyViews.set(enemy.id,actorView(asset));
      }catch(error){modelErrors.set(`fleet:${enemy.assetId}`,error.message);onStatus(error.message,{error:true});}
      finally{if(token===actorToken)pendingActors.delete(enemy.id);}
    });
  }
  function updateShips(snapshot, dt) {
    const sailing=snapshot.phase!=='harbor',sim=snapshot.sim,p=sailing&&sim?sim.player:null;
    const home=positionOf(snapshot.level?.playerStart?.position),x=p?finite(p.x):home[0],z=p?finite(p.z):home[2];
    if(playerWrapper){
      playerWrapper.position.set(x,0,z);playerWrapper.rotation.y=p?finite(p.angle):finite(snapshot.level?.playerStart?.headingRadians);
      playerAsset.aimAt?.(finite(p?.aimX,x)-x,finite(p?.aimZ,z+10)-z,playerWrapper.rotation.y);
      playerAsset.update?.(snapshot.phase==='sailing'&&!snapshot.paused?dt:0);
      playerRing.position.set(x,-2.5,z);
    }
    const activeIds=new Set();
    for(const enemy of sailing?(sim?.enemies||[]):[]){
      activeIds.add(enemy.id);requestEnemy(enemy);const view=enemyViews.get(enemy.id);
      if(view){
        view.wrapper.visible=view.selection.visible=!enemy.defeated;
        view.wrapper.position.set(finite(enemy.x),0,finite(enemy.z));view.wrapper.rotation.y=finite(enemy.angle);
        view.selection.position.set(finite(enemy.x),-2.4,finite(enemy.z));
        view.asset.setModuleState?.(enemy.modules);
        const target=enemy.telegraph||{};view.asset.aimAt?.(finite(target.targetX,x)-enemy.x,finite(target.targetZ,z)-enemy.z,finite(enemy.angle));
        view.asset.update?.(snapshot.phase==='sailing'&&!snapshot.paused?dt:0);
      }
      const label=createLabel(enemy.id,`${enemy.name||'적 비행선'}${enemy.telegraph?' · 포격 예고':''}`,`enemy ${/boss/.test(enemy.tier||'')?'boss':''}`);
      if(!label.health){const bar=document.createElement('div');bar.className='mini-health';label.health=document.createElement('i');bar.append(label.health);label.element.append(bar);}
      label.health.style.width=`${THREE.MathUtils.clamp(finite(enemy.hp)/Math.max(1,finite(enemy.maxHp,64))*100,0,100)}%`;
      placeLabel(label,enemy.x,5.5,enemy.z,!enemy.defeated,!!enemy.telegraph);
      const connector=enemy.modules?.find(part=>part.key==='connector'&&part.attached&&part.hp>0);
      const connectorId=`connector:${enemy.id}`;
      if(connector&&!enemy.defeated){
        let marker=connectorViews.get(connectorId);if(!marker){marker=ring('#cc8b4d',1.45,.75);connectorViews.set(connectorId,marker);transientGroup.add(marker);}
        const point=modulePosition(enemy,connector);marker.position.set(point.x,.55,point.z);marker.visible=true;
        placeLabel(createLabel(connectorId,'◇ 연결부','module'),point.x,3.7,point.z);
      }else{const marker=connectorViews.get(connectorId);if(marker)marker.visible=false;removeLabel(connectorId);}
    }
    for(const [id,view] of enemyViews)if(!activeIds.has(id)){clearView(view);enemyViews.delete(id);removeLabel(id);}
    // A clear/new wave can keep the same sim object. Remove markers by actor ID,
    // including actors whose GLB never finished creating an enemy view.
    for(const [key,marker] of connectorViews)if(!activeIds.has(key.slice('connector:'.length))){marker.removeFromParent();marker.material.dispose();connectorViews.delete(key);removeLabel(key);}
    for(const [id,label] of labelViews)if(label.element.classList.contains('enemy')&&!activeIds.has(id))removeLabel(id);
    return {x,z};
  }
  function updateDebris(sim, visible) {
    const active=new Set();
    for(const bundle of visible?(sim?.debris||[]):[]){
      if(bundle.salvaged||bundle.lost||bundle.remaining<=0)continue;active.add(bundle.id);
      let view=debrisViews.get(bundle.id);
      if(!view){
        const source=enemyViews.get(bundle.enemyId)?.asset||[...enemyViews.values()].find(item=>item.asset.source?.assetId===bundle.source?.assetId)?.asset;
        if(!source?.createDebris)continue;
        try{
          const group=source.createDebris(bundle),materials=paintObject(group),marker=ring('#b6a057',3.4,.65);transientGroup.add(group,marker);view={group,materials,ring:marker};debrisViews.set(bundle.id,view);
        }catch(error){if(!modelErrors.has(`debris:${bundle.id}`)){modelErrors.set(`debris:${bundle.id}`,error.message);onStatus(error.message,{error:true});}continue;}
      }
      view.group.position.set(finite(bundle.x),-1.8,finite(bundle.z));view.group.rotation.y=finite(bundle.angle);view.ring.position.set(finite(bundle.x),-2.3,finite(bundle.z));
      placeLabel(createLabel(bundle.id,'♧ 회수할 부품','loot'),bundle.x,2.9,bundle.z);
    }
    for(const [id,view] of debrisViews)if(!active.has(id)){releaseSkeletons(view.group);view.group.removeFromParent();view.materials?.forEach(material=>material.dispose());view.ring.removeFromParent();view.ring.material.dispose();debrisViews.delete(id);removeLabel(id);}
  }
  function updateProjectiles(sim, visible) {
    const active=new Set(),supported=effects?.debug?.().supportedWeapons||[];
    for(const shot of visible?(sim?.projectiles||[]):[]){
      active.add(shot.id);let mesh=projectiles.get(shot.id);
      if(!mesh){mesh=new THREE.Mesh(projectileGeometry,noOutline(new THREE.MeshBasicMaterial({color:shot.owner==='player'?'#ffe9a8':'#bb6e4c'})));transientGroup.add(mesh);projectiles.set(shot.id,mesh);}
      // When the GLB effect owns a shot, the fallback is hidden instead of moving twice.
      mesh.visible=!effects||!supported.includes(shot.weaponId);
      mesh.position.set(finite(shot.x),finite(shot.y,.6),finite(shot.z));
      const direction=new THREE.Vector3(finite(shot.vx),finite(shot.vy),finite(shot.vz));if(direction.lengthSq()>0)mesh.quaternion.setFromUnitVectors(up,direction.normalize());
    }
    for(const [id,mesh] of projectiles)if(!active.has(id)){mesh.removeFromParent();mesh.material.dispose();projectiles.delete(id);}
  }
  function updateWarnings(sim, visible) {
    const active=new Set();
    for(const enemy of visible?(sim?.enemies||[]):[]){
      if(!enemy.telegraph||enemy.defeated)continue;active.add(enemy.id);let view=warnings.get(enemy.id);
      if(!view){
        const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
        const line=new THREE.Line(geometry,new THREE.LineDashedMaterial({color:'#b97855',dashSize:1.3,gapSize:.9,transparent:true,opacity:.75}));
        const target=ring('#b9754e',2.7,.58);transientGroup.add(line,target);view={line,target};warnings.set(enemy.id,view);
      }
      const warning=enemy.telegraph,tx=finite(warning.targetX,sim.player.x),tz=finite(warning.targetZ,sim.player.z),positions=view.line.geometry.attributes.position;
      positions.setXYZ(0,finite(warning.fromX,enemy.x),.4,finite(warning.fromZ,enemy.z));positions.setXYZ(1,tx,.4,tz);positions.needsUpdate=true;view.line.geometry.computeBoundingSphere();view.line.computeLineDistances();
      view.line.visible=view.target.visible=true;view.target.position.set(tx,-.3,tz);view.target.scale.setScalar(finite(warning.radius,2.7));
    }
    for(const [id,view] of warnings)if(!active.has(id)){view.line.visible=view.target.visible=false;}
  }
  function updateOcclusion() {
    const ids=new Set(),start=camera.position,end=cameraTarget,direction=end.clone().sub(start),length=direction.length();
    const cast=new THREE.Ray(start,direction.normalize()),hit=new THREE.Vector3();cameraOccluderIds=[];
    for(const collider of currentLevel?.colliders||[]){
      if(!collider.occludesCamera)continue;
      const center=new THREE.Vector3(...positionOf(collider.center)),extent=new THREE.Vector3(...positionOf(collider.halfExtents)),box=new THREE.Box3(center.clone().sub(extent),center.clone().add(extent));
      if(cast.intersectBox(box,hit)&&hit.distanceTo(start)<length){cameraOccluderIds.push(collider.id);for(const id of collider.visualIds||[])ids.add(id);}
    }
    for(const [id,view] of worldViews){
      const faded=ids.has(id);
      for(const material of view.materials){material.transparent=faded||material.userData.originalTransparent;material.opacity=faded?finite(currentLevel?.camera?.fadeOpacity,.22):material.userData.originalOpacity;material.depthWrite=!faded;material.userData.outlineParameters.alpha=faded?.15:1;}
    }
  }
  function draw(){if(!disposed){webgl.info.reset();webgl.autoClear=true;effect.autoClear=true;effect.render(scene,camera);}}
  function render(snapshot, dt=0, {fixedCamera=false}={}) {
    if(disposed||!snapshot)return;
    const before=performance.now();latest=snapshot;setLevel(snapshot.level);
    if(currentSim!==snapshot.sim||((currentPhase==='harbor')!==(snapshot.phase==='harbor'))){clearTransient();currentSim=snapshot.sim;}
    currentPhase=snapshot.phase;
    const time=finite(snapshot.sim?.time),point=updateShips(snapshot,Math.min(finite(dt),.1));
    const basis=cameraBasis(viewId);
    const goal=overview?new THREE.Vector3(0,0,currentLevel?.id==='jonghang-harbor'?57:0):snapshot.phase==='harbor'?new THREE.Vector3(0,0,57):new THREE.Vector3(point.x-basis.down.x*6,0,point.z-basis.down.z*6);
    if(!overview&&snapshot.phase!=='harbor'){
      const contact=(snapshot.sim?.enemies||[]).filter(enemy=>!enemy.defeated).sort((a,b)=>Math.hypot(a.x-point.x,a.z-point.z)-Math.hypot(b.x-point.x,b.z-point.z))[0];
      let desiredHalf=24;
      if(contact&&Math.hypot(contact.x-point.x,contact.z-point.z)<80){
        goal.x=point.x+(contact.x-point.x)*.35-basis.down.x*3;goal.z=point.z+(contact.z-point.z)*.35-basis.down.z*3;
        const aspect=Math.max(.25,container.clientWidth/Math.max(1,container.clientHeight));
        desiredHalf=framingHeight(viewId,point,contact,goal,aspect);
      }
      const nextHalf=THREE.MathUtils.lerp(cinematicHalfHeight,desiredHalf,1-Math.exp(-Math.max(finite(dt),0)*3));
      if(Math.abs(nextHalf-cinematicHalfHeight)>.01){cinematicHalfHeight=nextHalf;resize();}
    }
    if(!fixedCamera)cameraTarget.lerp(goal,1-Math.exp(-Math.max(finite(dt),0)*5));
    camera.position.copy(cameraTarget).add(offset);camera.lookAt(cameraTarget);camera.updateMatrixWorld();
    const active=snapshot.phase!=='harbor';
    updateDebris(snapshot.sim,active);updateProjectiles(snapshot.sim,active);updateWarnings(snapshot.sim,active);
    const dock=active?snapshot.sim?.harbor:null;
    returnRing.visible=returnDash.visible=active;returnRing.position.set(finite(dock?.x),-2,finite(dock?.z,48));returnDash.position.copy(returnRing.position);returnDash.position.y=-1.98;
    placeLabel(createLabel('return-marker','⌂ 종항으로 귀환','dock'),finite(dock?.x),1,finite(dock?.z,48),active);
    if(!reducedMotion){clouds.position.x=Math.sin(time*.016)*2;clouds.position.z=Math.sin(time*.012);}
    if(paintedReach.group.visible)paintedReach.update(snapshot.phase==='sailing'&&!snapshot.paused?Math.min(finite(dt),.1):0,time);
    const events=(active?snapshot.sim?.events||[]:[]).filter(event=>finite(event.seq,event.id)>eventSequence);
    if(events.length){eventSequence=Math.max(...events.map(event=>finite(event.seq,event.id)));eventListeners.forEach(listener=>listener(events,snapshot));}
    if(effects&&active){
      const cleared=[...events].reverse().find(event=>event.type==='combat-cleared');
      if(cleared){effects.reset?.();effectsFloor=finite(cleared.seq,cleared.id);}
      effects.consume?.((snapshot.sim?.events||[]).filter(event=>finite(event.seq,event.id)>=effectsFloor),snapshot.sim?.projectiles||[]);
      effects.update?.(snapshot.phase==='sailing'&&!snapshot.paused?Math.min(finite(dt),.1):0,snapshot.sim?.projectiles||[]);
    }
    updateOcclusion();draw();frameCount++;frameTimes.push(performance.now()-before);if(frameTimes.length>300)frameTimes.shift();
  }
  function aimAt(clientX, clientY) {
    const box=container.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((clientX-box.left)/box.width*2-1,-(clientY-box.top)/box.height*2+1),camera);
    if(ray.ray.intersectPlane(plane,rayHit))return {x:rayHit.x,z:rayHit.z};return null;
  }
  function muzzleFrame(player, target) {
    if(!playerAsset||!playerWrapper)return null;
    playerWrapper.position.set(finite(player.x),0,finite(player.z));playerWrapper.rotation.y=finite(player.angle);
    playerAsset.aimAt?.(finite(target?.x)-player.x,finite(target?.z)-player.z,finite(player.angle));playerWrapper.updateMatrixWorld(true);
    return playerAsset.muzzleFrame?.()||null;
  }
  function stats() {
    let meshes=0,visibleMeshes=0;const textures=new Set();
    scene.traverse(node=>{
      if(!node.isMesh)return;meshes++;let visible=node.visible;for(let parent=node.parent;parent;parent=parent.parent)visible&&=parent.visible;if(visible)visibleMeshes++;
      for(const material of materialList(node.material))for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    });
    let estimatedTextureBytes=0;
    for(const texture of textures){const image=texture.image;if(image?.width&&image?.height)estimatedTextureBytes+=image.width*image.height*4*(texture.generateMipmaps?4/3:1);}
    const sorted=[...frameTimes].sort((a,b)=>a-b);
    return {frameCount,firstReadyMs,worldReadyMs,meshes,visibleMeshes,textures:textures.size,estimatedTextureBytes:Math.round(estimatedTextureBytes),textureEstimate:'RGBA estimate; excludes driver/compression allocation',drawCalls:webgl.info.render.calls,triangles:webgl.info.render.triangles,gpuMemory:{...webgl.info.memory},pendingLoads,loadedWorldVisuals:worldViews.size,worldVisualIds:[...worldViews.keys()],worldVisualLimit:12,enemyViews:enemyViews.size,debrisViews:debrisViews.size,projectileViews:projectiles.size,modelErrors:Object.fromEntries(modelErrors),loads:loadRecords.map(record=>({...record})),effects:effects?.debug?.()||null,frameCpuMs:{average:frameTimes.length?frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length:0,p95:sorted[Math.floor(sorted.length*.95)]||0},camera:{projection:'orthographic',position:camera.position.toArray(),target:cameraTarget.toArray(),halfHeight:camera.top,occluderIds:[...cameraOccluderIds]},clearing:{rendererAutoClear:webgl.autoClear,outlineAutoClear:effect.autoClear},level:currentLevel?.id||null};
  }
  function dispose() {
    if(disposed)return;clearTransient();clearWorld();disposed=true;resizeObserver.disconnect();releaseSkeletons(playerAsset?.group);playerAsset?.dispose();effects?.dispose?.();paintedReach.dispose();
    playerRing.material.dispose();returnRing.material.dispose();returnDash.material.dispose();owned.forEach(resource=>resource.dispose?.());effect.dispose?.();webgl.dispose();webgl.domElement.remove();
  }
  const api={scene,camera,webgl,effect,initialize,render,aimAt,muzzleFrame,reset,stats,dispose,
    get playerAsset(){return playerAsset;},get playerWrapper(){return playerWrapper;},get ready(){return!!playerAsset&&!disposed;},
    get actorsPending(){return pendingActors.size;},
    get actorLoadFailed(){return [...modelErrors.keys()].some(key=>key.startsWith('fleet:'));},
    attachEffects(value){effects?.reset?.();effects=value;},onEvents(listener){eventListeners.add(listener);return()=>eventListeners.delete(listener);},
    setOverview(value){overview=!!value;offset.set(...cameraBasis(overview?'high':viewId).offset);resize();return overview;},get overview(){return overview;},
    setCameraView(id){viewId=cameraProfile(id).id;offset.set(...cameraBasis(overview?'high':viewId).offset);resize();if(latest)render(latest,.1);return cameraProfile(viewId);},get cameraView(){return viewId;},
    screenMove(right,down){return screenMove(overview?'high':viewId,right,down);},
    setZoom(value){zoom=THREE.MathUtils.clamp(finite(value,1),.6,1.6);resize();return zoom;},get zoom(){return zoom;},
    projectPoint(point){const value=new THREE.Vector3(...positionOf(point)).project(camera);return {x:(value.x*.5+.5)*container.clientWidth,y:(-.5*value.y+.5)*container.clientHeight,depth:value.z};},
    // Pixel comparisons redraw the current scene without advancing camera or animation.
    capture(){draw();return webgl.domElement.toDataURL('image/png');},
    drawFixed(){draw();return stats();},renderFixed(snapshot=latest){if(snapshot)render(snapshot,0,{fixedCamera:true});else draw();},
    clear(){webgl.clear(true,true,true);},whenIdle(){return queue;}
  };
  return api;
}
