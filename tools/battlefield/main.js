import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { createWorld } from './world.js';
import { loadShip } from './assets.js';
import { createSimulation, step, salvage, returnToHarbor, dropCargo, moduleWorldPosition, CONFIG } from './sim.mjs';

const $ = id => document.getElementById(id);
const stage = $('stage');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchDevice = matchMedia('(pointer: coarse)').matches;
if(touchDevice) document.body.classList.add('touch-mode');
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0,1,0),0), hit = new THREE.Vector3();
const pointer = new THREE.Vector2();
const keys = new Set(), touchMove = {x:0,z:0};
let scene, renderer, effect, camera, world, sim, playerAsset;
let ready=false, started=false, paused=false, exploring=false, overview=false;
let lastTime=performance.now(), acc=0, lastUI=0, zoom=30, cameraTarget=new THREE.Vector3(0,0,21);
let mouseActive=false, firing=false, boosting=false, aim={x:0,z:-10}, selectedEnemy=0;
let lastEvent=0, toastUntil=0, audioEnabled=false, audioContext=null, frameSamples=[];
const enemyAssets=new Map(), enemyViews=new Map(), debrisViews=new Map(), projectileViews=new Map(), moduleViews=new Map();
const labels=new Map(), fx=[], trails=[];
const shadowGeometry=new THREE.CircleGeometry(1,32);
const ringGeometry=new THREE.RingGeometry(.83,1,32);
const temp=new THREE.Vector3();
window.__battlefield={version:'0.1.0',ready:false};

function label(id,text,kind='') {
  if(labels.has(id))return labels.get(id);
  const el=document.createElement('div');el.className='world-label '+kind;el.textContent=text;$('labels').appendChild(el);labels.set(id,el);return el;
}
function placeLabel(el,x,y,z,show=true){
  temp.set(x,y,z).project(camera);
  el.hidden=!show||temp.z<-1||temp.z>1||Math.abs(temp.x)>1.08||Math.abs(temp.y)>1.1;
  if(!el.hidden){el.style.left=((temp.x*.5+.5)*innerWidth)+'px';el.style.top=((-temp.y*.5+.5)*innerHeight)+'px';}
}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');toastUntil=performance.now()+4200;}
function playSound(type){
  if(!audioEnabled||!audioContext)return;
  try{
    const t=audioContext.currentTime, osc=audioContext.createOscillator(), gain=audioContext.createGain();
    const kind={shot:[180,70,.045,.022],hit:[95,30,.12,.055],salvage:[400,780,.35,.055],alarm:[470,300,.17,.035]}[type]||[240,80,.2,.03];
    osc.type=type==='salvage'?'sine':'triangle';osc.frequency.setValueAtTime(kind[0],t);osc.frequency.exponentialRampToValueAtTime(kind[1],t+kind[2]);
    gain.gain.setValueAtTime(kind[3],t);gain.gain.exponentialRampToValueAtTime(.001,t+kind[2]);osc.connect(gain);gain.connect(audioContext.destination);osc.start(t);osc.stop(t+kind[2]);
  }catch{}
}
function ring(color,radius=5){const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false});mat.userData.outlineParameters={visible:false};const mesh=new THREE.Mesh(ringGeometry,mat);mesh.rotation.x=-Math.PI/2;mesh.scale.setScalar(radius);return mesh;}
function shadow(radius,color=0x618c80){const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.12,depthWrite:false});material.userData.outlineParameters={visible:false};const mesh=new THREE.Mesh(shadowGeometry,material);mesh.rotation.x=-Math.PI/2;mesh.scale.set(radius,radius*.65,1);mesh.position.y=-4;return mesh;}
function addBurst(x,z,color=0xe4b96c,count=9){
  const geom=new THREE.TetrahedronGeometry(.24);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true});mat.userData.outlineParameters={visible:false};
  for(let i=0;i<count;i++){const mesh=new THREE.Mesh(geom,mat);mesh.position.set(x,1,z);scene.add(mesh);const angle=i/count*Math.PI*2;fx.push({mesh,vx:Math.cos(angle)*3,vz:Math.sin(angle)*3,vy:2+(i%3),life:.5,max:.5,owned:i===count-1,geom,mat});}
}
function shipView(asset,entity,isPlayer=false){
  const wrapper=new THREE.Group();wrapper.add(asset.group);scene.add(wrapper);
  const s=shadow(isPlayer?5:6);scene.add(s);
  const selection=ring(isPlayer?0x4e9486:0xbc8665,isPlayer?5:6);selection.position.y=-1.5;scene.add(selection);
  return {wrapper,shadow:s,selection,asset};
}
function applySlots(enemy,asset){
  const slots=asset.slotPositions||{};
  for(const m of enemy.modules){const slot=slots[m.key]||slots[m.type];if(slot){m.localX=slot.x;m.localZ=slot.z;const radii={root:1.8,connector:.42,deck:.3,cannon:.32,engine:.45,'aux-balloon':.3,balloon:.7,'main-engine':.6};m.radius=radii[m.key]??.45;}}
}
function configureSimulation(){
  sim=createSimulation({obstacles:world.obstacles});
  for(const e of sim.enemies){const asset=enemyAssets.get(e.assetId);if(asset)applySlots(e,asset);}
  window.__battlefield.sim=sim;
  lastEvent=0;acc=0;
}
function clearTransient(){
  for(const mesh of projectileViews.values()){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}projectileViews.clear();
  for(const value of moduleViews.values()){for(const o of value.objects){scene.remove(o);if(o.geometry!==ringGeometry)o.geometry?.dispose();o.material?.dispose();}}moduleViews.clear();
  for(const value of debrisViews.values()){scene.remove(value.group);value.ring?.material.dispose();}debrisViews.clear();
  const geometries=new Set(),materials=new Set();for(const f of fx){scene.remove(f.mesh);geometries.add(f.geom);materials.add(f.mat);}for(const g of geometries)g?.dispose();for(const m of materials)m?.dispose();fx.length=0;
  for(const el of labels.values())el.remove();labels.clear();
}
function restart(){clearTransient();configureSimulation();for(const e of sim.enemies)enemyAssets.get(e.assetId)?.setModuleState?.(e.modules);started=true;paused=false;exploring=false;overview=false;$('map-toggle').setAttribute('aria-pressed','false');resize();cameraTarget.set(0,0,21);keys.clear();firing=false;boosting=false;mouseActive=false;selectedEnemy=0;$('result-screen').hidden=true;$('pause-screen').hidden=true;$('welcome').hidden=true;$('mode-label').textContent='교전 · 항해 중';stage.focus();toast('다시 출항했습니다. 주황색 연결부를 겨냥해 보세요.');}
function resize(){
  if(!renderer)return;renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  const h=overview?108:(innerWidth<760?zoom*1.24:zoom),aspect=innerWidth/innerHeight;
  camera.left=-h*aspect;camera.right=h*aspect;camera.top=h;camera.bottom=-h;camera.updateProjectionMatrix();
}
function updateCamera(dt){
  const goal=overview?new THREE.Vector3(0,0,0):new THREE.Vector3(sim.player.x,0,sim.player.z-8);
  if(!overview&&mouseActive){goal.x+=THREE.MathUtils.clamp((aim.x-sim.player.x)*.12,-6,6);goal.z+=THREE.MathUtils.clamp((aim.z-sim.player.z)*.1,-4,4);}
  cameraTarget.lerp(goal,1-Math.exp(-dt*3));camera.position.copy(cameraTarget).add(new THREE.Vector3(0,85,60));camera.lookAt(cameraTarget);camera.updateMatrixWorld();
}
function pickAim(event){
  pointer.x=event.clientX/innerWidth*2-1;pointer.y=-(event.clientY/innerHeight)*2+1;ray.setFromCamera(pointer,camera);
  if(ray.ray.intersectPlane(ground,hit)){aim.x=hit.x;aim.z=hit.z;}
  const r=$('aim-reticle');r.style.left=event.clientX+'px';r.style.top=event.clientY+'px';r.style.display=started&&!paused?'block':'none';
}
function getTarget(){
  const alive=sim.enemies.filter(e=>!e.defeated);
  if(!alive.length)return null;
  if(!mouseActive||touchDevice){const ordered=[...alive].sort((a,b)=>Math.hypot(a.x-sim.player.x,a.z-sim.player.z)-Math.hypot(b.x-sim.player.x,b.z-sim.player.z));return ordered[selectedEnemy%ordered.length];}
  return alive.reduce((a,b)=>Math.hypot(b.x-aim.x,b.z-aim.z)<Math.hypot(a.x-aim.x,a.z-aim.z)?b:a);
}
function autoAim(){const e=getTarget();if(!e)return;const m=e.modules.find(m=>m.key==='connector'&&m.attached&&m.hp>0)||e.modules.find(m=>m.key==='cannon'&&m.attached&&m.hp>0)||e.modules.find(m=>m.key==='root');const p=moduleWorldPosition(e,m);const lead=Math.hypot(p.x-sim.player.x,p.z-sim.player.z)/CONFIG.playerProjectileSpeed;const desired=Math.atan2(sim.player.x-e.x,sim.player.z-e.z);const diff=Math.atan2(Math.sin(desired-e.angle),Math.cos(desired-e.angle));const prediction={...e,x:e.x+e.vx*lead,z:e.z+e.vz*lead,angle:e.angle+THREE.MathUtils.clamp(diff,-.4*lead,.4*lead)};const future=moduleWorldPosition(prediction,m);aim.x=future.x;aim.z=future.z;}
function input(){
  let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touchMove.x;
  let z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+touchMove.z;
  if(!mouseActive||touchDevice)autoAim();
  return {moveX:x,moveZ:z,aimX:aim.x,aimZ:aim.z,fire:firing,boost:boosting||keys.has('Space')};
}
function doSalvage(){if(!started||paused||sim.outcome!=='sailing')return;const cargo=salvage(sim);if(!cargo)toast('떠다니는 부품에 더 가까이 다가가세요. (인양 거리 10)');}
function doReturn(){if(!started||paused)return;if(!returnToHarbor(sim))toast(Math.hypot(sim.player.x,sim.player.z-48)<12&&!sim.cargo.length?'부품을 하나 이상 인양하거나 적선을 모두 무력화한 뒤 귀환하세요.':'남쪽 귀환 부두의 청록색 원 안에서 귀환하세요.');}
function setPause(value){
  if(!started||sim.outcome!=='sailing')return;paused=value;keys.clear();firing=false;boosting=false;touchMove.x=0;touchMove.z=0;
  $('pause-screen').hidden=!value;$('pause').setAttribute('aria-pressed',String(value));$('aim-reticle').style.display='none';lastTime=performance.now();acc=0;
  if(!value)stage.focus();
}
function setOverview(){overview=!overview;$('map-toggle').setAttribute('aria-pressed',String(overview));resize();toast(overview?'항로 전체를 펼쳤습니다. M을 누르면 배로 돌아갑니다.':'귀환호를 따라갑니다.');}
function begin(explore=false){started=true;paused=false;exploring=explore;$('welcome').hidden=true;$('mode-label').textContent=explore?'전장 탐색':'교전 · 항해 중';lastTime=performance.now();stage.focus();toast(explore?'적의 포격이 멈춘 탐색 항해입니다. 이동과 사격·인양은 사용할 수 있어요.':'주황색 연결부를 겨냥하세요. 사격할 때는 적의 포격 예고선을 살펴보세요.');}
function processEvents(){
  for(const e of sim.events){if(e.seq<=lastEvent)continue;lastEvent=e.seq;
    if(e.type==='player-fire'){playSound('shot');addBurst(e.x,e.z,0xffe8a3,3);}
    if(e.type==='hit'){addBurst(e.x,e.z,0xf1cb85,5);playSound('hit');}
    if(e.type==='bundle-detached'){addBurst(e.x,e.z,0xcaa178,12);toast('연결이 끊어졌습니다. 부품 묶음 가까이에서 F를 눌러 인양하세요.');}
    if(e.type==='salvaged'){addBurst(e.x,e.z,0xd2bd76,16);toast('인양 완료 · 화물로 적재했습니다. 남쪽 부두로 돌아갈 수 있어요.');playSound('salvage');}
    if(e.type==='enemy-defeated'){addBurst(e.x,e.z,0xcb916c,20);toast('적선 무력화 · 남은 부품을 인양할 수 있습니다.');}
    if(e.type==='cargo-dropped')toast('화물을 투하했습니다. 양력 여유를 확인하세요.');
  }
}
function updateShips(dt){
  const p=sim.player;
  playerAsset.aimAt?.(aim.x-p.x,aim.z-p.z,p.angle);
  playerAsset.update?.(paused||!started?0:dt);
  playerAsset.group.rotation.z=THREE.MathUtils.lerp(playerAsset.group.rotation.z,THREE.MathUtils.clamp(-p.vx*.012,-.12,.12),.07);
  const pv=window.__battlefield.playerView;pv.wrapper.position.set(p.x,reducedMotion?0:Math.sin(sim.time*1.4)*.18,p.z);pv.wrapper.rotation.y=p.angle;
  pv.shadow.position.x=p.x;pv.shadow.position.z=p.z;pv.selection.position.x=p.x;pv.selection.position.z=p.z;
  for(const enemy of sim.enemies){
    const view=enemyViews.get(enemy.id);if(!view)continue;
    view.wrapper.visible=!enemy.defeated;view.shadow.visible=!enemy.defeated;view.selection.visible=!enemy.defeated;
    view.wrapper.position.set(enemy.x,reducedMotion?0:Math.sin(sim.time+enemy.phase)*.16,enemy.z);view.wrapper.rotation.y=enemy.angle;
    view.shadow.position.x=enemy.x;view.shadow.position.z=enemy.z;view.selection.position.x=enemy.x;view.selection.position.z=enemy.z;
    view.asset.aimAt?.((enemy.telegraph?.targetX??p.x)-enemy.x,(enemy.telegraph?.targetZ??p.z)-enemy.z,enemy.angle);
    view.asset.update?.(paused||!started?0:dt);view.asset.setModuleState?.(enemy.modules);
    const el=label(enemy.id,enemy.name,'enemy');
    if(!el.querySelector('i')){el.innerHTML='<span></span><div class="health-mini"><i></i></div>';el.querySelector('span').textContent=enemy.name;}
    el.querySelector('i').style.width=enemy.hp/enemy.maxHp*100+'%';placeLabel(el,enemy.x,5.4,enemy.z,!enemy.defeated);
    const connector=enemy.modules.find(m=>m.key==='connector');
    if(connector?.attached&&connector.hp>0&&!enemy.defeated){
      const pos=moduleWorldPosition(enemy,connector);let viewM=moduleViews.get(connector.id);
      if(!viewM){const m=ring(0xdf9554,1.65);m.rotation.x=-Math.PI/2;scene.add(m);viewM={objects:[m],mesh:m};moduleViews.set(connector.id,viewM);}
      viewM.mesh.visible=true;viewM.mesh.position.set(pos.x,1,pos.z);viewM.mesh.scale.setScalar(1.6+(reducedMotion?0:Math.sin(sim.time*3)*.08));
      const ml=label(connector.id,'◇ 연결부','module-label');ml.textContent='◇ 연결부';placeLabel(ml,pos.x,3.8,pos.z,Math.hypot(pos.x-p.x,pos.z-p.z)<48);
    }else{const mv=moduleViews.get(connector?.id);if(mv)mv.mesh.visible=false;const ml=labels.get(connector?.id);if(ml)ml.hidden=true;}
  }
  for(const landmark of world.landmarks){const el=label(landmark.id,landmark.label);placeLabel(el,landmark.x,1.5,landmark.z,Math.hypot(landmark.x-p.x,landmark.z-p.z)<65||overview);}
}
function updateTelegraphs(){
  for(const enemy of sim.enemies){
    const id='line-'+enemy.id;let view=moduleViews.get(id);
    if(!view){const geom=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);const mat=new THREE.LineDashedMaterial({color:0xc36f52,dashSize:1.5,gapSize:1,transparent:true,opacity:.8});const line=new THREE.Line(geom,mat);const target=ring(0xc06b4d,3.2);scene.add(line,target);view={objects:[line,target],line,target};moduleViews.set(id,view);}
    const t=enemy.telegraph;view.line.visible=view.target.visible=!!t&&!exploring;
    if(t&&!exploring){const from={x:t.fromX??enemy.x,z:t.fromZ??enemy.z},to={x:t.targetX,z:t.targetZ};const arr=view.line.geometry.attributes.position;arr.setXYZ(0,from.x,.5,from.z);arr.setXYZ(1,to.x,.5,to.z);arr.needsUpdate=true;view.line.computeLineDistances();view.target.position.set(to.x,-.5,to.z);view.target.material.opacity=.3+(1-t.remaining/t.duration)*.5;view.target.scale.setScalar(2+(1-t.remaining/t.duration)*1.2);}
  }
}
function updateProjectiles(){
  const active=new Set();
  for(const p of sim.projectiles){active.add(p.id);let mesh=projectileViews.get(p.id);if(!mesh){const mat=new THREE.MeshBasicMaterial({color:p.owner==='player'?0xffe5a1:0xbc684b});mat.userData.outlineParameters={visible:false};mesh=new THREE.Mesh(new THREE.CapsuleGeometry(p.owner==='player'?.12:.33,p.owner==='player'?.65:1,2,5),mat);mesh.rotation.x=Math.PI/2;scene.add(mesh);projectileViews.set(p.id,mesh);}mesh.position.set(p.x,1.3,p.z);mesh.rotation.z=-Math.atan2(p.vx,p.vz);}
  for(const [id,mesh]of projectileViews)if(!active.has(id)){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();projectileViews.delete(id);}
}
function updateDebris(){
  for(const b of sim.debris){
    let view=debrisViews.get(b.id);
    if(!view){
      const asset=enemyAssets.get(b.source?.assetId);const group=asset?.createDebris?.(b)||new THREE.Group();
      if(!group.children.length){const m=new THREE.Mesh(new THREE.BoxGeometry(2,1.2,3),new THREE.MeshToonMaterial({color:0xbb965e}));group.add(m);}
      const r=ring(0xb2924c,3.3);r.position.y=-.8;group.add(r);scene.add(group);view={group,ring:r,objects:[group]};debrisViews.set(b.id,view);
    }
    const visible=!b.salvaged&&!b.lost&&b.remaining>0;view.group.visible=visible;view.group.position.set(b.x,Math.sin(sim.time*2)*.25,b.z);view.group.rotation.y=b.angle||0;
    const el=label(b.id,'F · 인양할 부품','loot');placeLabel(el,b.x,4.5,b.z,visible);
  }
}
function updateFX(dt){for(let i=fx.length-1;i>=0;i--){const f=fx[i];if(paused||!started)continue;f.life-=dt;f.mesh.position.x+=f.vx*dt;f.mesh.position.z+=f.vz*dt;f.mesh.position.y+=f.vy*dt;f.vy-=10*dt;f.mesh.scale.setScalar(Math.max(0,f.life/f.max));if(f.life<=0){scene.remove(f.mesh);if(f.owned){f.geom.dispose();f.mat.dispose();}fx.splice(i,1);}}}
function drawMinimap(){
  const canvas=$('minimap'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#e4e6d4';ctx.fillRect(0,0,w,h);
  const sx=x=>(x+100)/200*w,sz=z=>(z+100)/200*h;
  ctx.strokeStyle='#a7b6a144';ctx.lineWidth=1;for(let n=-80;n<=80;n+=40){ctx.beginPath();ctx.moveTo(sx(n),0);ctx.lineTo(sx(n),h);ctx.moveTo(0,sz(n));ctx.lineTo(w,sz(n));ctx.stroke();}
  for(const o of world.obstacles){ctx.beginPath();ctx.fillStyle='#a2b399';ctx.ellipse(sx(o.x),sz(o.z),o.radius/200*w,o.radius/200*h,0,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle='#c3ac7a88';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(sx(0),sz(48));ctx.lineTo(sx(-28),sz(-12));ctx.lineTo(sx(28),sz(-27));ctx.lineTo(sx(5),sz(-52));ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#599186';ctx.fillRect(sx(0)-3,sz(48)-3,6,6);
  for(const e of sim.enemies)if(!e.defeated){ctx.fillStyle='#bd795b';ctx.beginPath();ctx.arc(sx(e.x),sz(e.z),2.6,0,Math.PI*2);ctx.fill();}
  for(const b of sim.debris)if(!b.salvaged&&!b.lost){ctx.fillStyle='#b59c50';ctx.fillRect(sx(b.x)-2,sz(b.z)-2,4,4);}
  const p=sim.player;ctx.save();ctx.translate(sx(p.x),sz(p.z));ctx.rotate(-p.angle);ctx.fillStyle='#2d766d';ctx.beginPath();ctx.moveTo(0,5);ctx.lineTo(-3,-4);ctx.lineTo(3,-4);ctx.closePath();ctx.fill();ctx.restore();
  ctx.strokeStyle='#638c7d77';ctx.lineWidth=1;ctx.strokeRect(sx(cameraTarget.x)-w*.18,sz(cameraTarget.z)-h*.16,w*.36,h*.32);
  ctx.fillStyle='#8a977d';ctx.font='8px Georgia';ctx.fillText('N',w/2-3,10);
}
function updateUI(){
  const p=sim.player;$('hull').textContent=Math.ceil(p.hp)+' / '+p.maxHp;$('hull-bar').style.width=p.hp/p.maxHp*100+'%';$('hull-bar').style.background=p.hp<35?'#bb7155':'#377e72';
  $('speed').innerHTML=Math.round(Math.hypot(p.vx,p.vz))+' <small>u/s</small>';$('lift').textContent=p.lift;$('weight').textContent=p.weight;$('cargo').textContent=sim.cargo.length;
  $('reload-bar').style.width=Math.max(0,1-p.cooldown/CONFIG.playerCooldown)*100+'%';$('boost-bar').style.width=p.boostCharge/p.maxBoostCharge*100+'%';$('danger').hidden=p.weight<=p.lift;
  if(p.weight>p.lift)$('danger').textContent='양력 부족 · '+Math.max(0,7-p.sinkingTime).toFixed(1)+'초 / Esc에서 화물 투하';
  $('clock').textContent=String(Math.floor(sim.time/60)).padStart(2,'0')+':'+String(Math.floor(sim.time%60)).padStart(2,'0');
  $('mission-1').classList.toggle('done',sim.time>2);$('mission-2').classList.toggle('done',sim.debris.length>0);$('mission-3').classList.toggle('done',sim.cargo.length>0);
  const nearby=sim.debris.some(b=>!b.salvaged&&!b.lost&&Math.hypot(b.x-p.x,b.z-p.z)<CONFIG.salvageRadius);$('salvage').classList.toggle('active',nearby);
  $('return').classList.toggle('active',Math.hypot(p.x,p.z-48)<12);$('boost').classList.toggle('active',p.boosting);
  const target=getTarget();const show=target&&Math.hypot(target.x-p.x,target.z-p.z)<65&&started;
  $('target-panel').hidden=!show;if(show){$('target-name').textContent=target.name;$('target-health').style.width=target.hp/target.maxHp*100+'%';$('target-hint').textContent=target.modules.some(m=>m.key==='connector'&&m.attached)?'◇ 주황색 연결부를 노리세요':target.assetId==='enemy-tax-cutter'?'연결부 분리됨 · 핵심 선체 공격 가능':'함포 또는 핵심 선체를 겨냥하세요';}
  if(performance.now()>toastUntil)$('toast').classList.remove('show');drawMinimap();
  if(sim.outcome!=='sailing'&&$('result-screen').hidden){
    $('result-title').textContent=sim.outcome==='victory'?'무사히 돌아왔어요.':'바람이 거세졌어요.';
    $('result-text').textContent=sim.outcome==='victory'?`부품 묶음 ${sim.cargo.length}개를 화물로 싣고 귀환했습니다.`:'귀환호가 더는 항해할 수 없습니다. 처음부터 다시 도전할 수 있어요.';
    $('result-stats').innerHTML=`<span><b>${sim.stats.kills}</b>무력화한 적선</span><span><b>${sim.cargo.length}</b>회수한 묶음</span><span><b>${Math.floor(sim.time/60)}:${String(Math.floor(sim.time%60)).padStart(2,'0')}</b>항해 시간</span>`;
    $('result-screen').hidden=false;firing=false;keys.clear();
  }
}
function frame(now){
  requestAnimationFrame(frame);if(!ready)return;
  const measuredFrameMs=Math.max(0,now-lastTime);const elapsed=Math.min(measuredFrameMs/1000,.08);lastTime=now;
  if(started&&!paused&&sim.outcome==='sailing'){
    acc+=elapsed;const i=input();while(acc>=1/60){if(exploring){for(const e of sim.enemies){e.cooldown=999;e.telegraph=null;}sim.projectiles=sim.projectiles.filter(p=>p.owner==='player');}step(sim,1/60,i);acc-=1/60;}processEvents();
  }
  updateCamera(elapsed);world.update?.(paused||!started?0:elapsed,sim.time);updateShips(elapsed);updateTelegraphs();updateProjectiles();updateDebris();updateFX(elapsed);
  if(now-lastUI>90){updateUI();lastUI=now;}
  effect.render(scene,camera);
  frameSamples.push(measuredFrameMs);if(frameSamples.length>300)frameSamples.shift();
  Object.assign(window.__battlefield,{ready,started,paused,exploring,overview,outlineAutoClear:effect.autoClear,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frameMs:frameSamples,loadedAssets:[...enemyAssets.keys(),'player-homeward'],cameraTarget:{x:cameraTarget.x,z:cameraTarget.z},cameraHalfHeight:camera.top,debrisArt:[...debrisViews.entries()].map(([id,v])=>({id,canonicalModuleIds:v.group.userData.canonicalModuleIds||[]}))});
}
function bindInput(){
  $('start').onclick=()=>begin();$('explore').onclick=()=>begin(true);$('pause').onclick=()=>setPause(!paused);$('resume').onclick=()=>setPause(false);$('restart').onclick=restart;$('again').onclick=restart;$('salvage').onclick=doSalvage;$('return').onclick=doReturn;$('map-toggle').onclick=setOverview;$('minimap').onclick=setOverview;
  $('drop-cargo').onclick=()=>{const b=dropCargo(sim);if(!b)toast('투하할 화물이 없습니다.');else updateUI();};
  $('sound').onclick=async()=>{audioEnabled=!audioEnabled;if(audioEnabled){audioContext||=new(window.AudioContext||window.webkitAudioContext)();await audioContext.resume();playSound('salvage');}$('sound').setAttribute('aria-pressed',String(audioEnabled));$('sound').querySelector('span').textContent=audioEnabled?'소리 켜짐':'소리 꺼짐';};
  window.addEventListener('keydown',e=>{if(started&&!paused&&sim.outcome==='sailing'&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();if(e.repeat){keys.add(e.code);return;}if(e.code==='Escape'){setPause(!paused);return;}if(!started||paused)return;keys.add(e.code);if(e.code==='KeyF')doSalvage();if(e.code==='KeyH')doReturn();if(e.code==='KeyM')setOverview();if(e.code==='Tab'){mouseActive=false;selectedEnemy++;autoAim();toast('가까운 적선의 연결부로 조준을 옮겼습니다.');}});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();firing=false;boosting=false;if(started&&!paused)setPause(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!paused)setPause(true);});
  stage.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;mouseActive=true;pickAim(e);});
  stage.addEventListener('pointerdown',e=>{if(!started||paused)return;stage.focus();if(e.button===0){mouseActive=true;pickAim(e);firing=true;stage.setPointerCapture(e.pointerId);}});
  stage.addEventListener('pointerup',()=>firing=false);stage.addEventListener('lostpointercapture',()=>firing=false);stage.addEventListener('pointercancel',()=>firing=false);stage.addEventListener('contextmenu',e=>e.preventDefault());
  stage.addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom+Math.sign(e.deltaY)*2,20,47);resize();},{passive:false});
  const hold=(el,set)=>{el.addEventListener('pointerdown',e=>{e.preventDefault();if(!started||paused)return;set(true);el.setPointerCapture(e.pointerId);});for(const name of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(name,()=>set(false));};hold($('fire'),v=>{firing=v;if(v){mouseActive=false;autoAim();}});hold($('boost'),v=>boosting=v);
  const stick=$('stick'),knob=stick.querySelector('i');let stickId=null;
  const stickInput=e=>{const r=stick.getBoundingClientRect(),dx=e.clientX-(r.x+r.width/2),dz=e.clientY-(r.y+r.height/2),len=Math.max(38,Math.hypot(dx,dz));touchMove.x=dx/len;touchMove.z=dz/len;knob.style.transform=`translate(${touchMove.x*32}px,${touchMove.z*32}px)`;};
  stick.onpointerdown=e=>{e.preventDefault();stickId=e.pointerId;stick.setPointerCapture(e.pointerId);stickInput(e);};stick.onpointermove=e=>{if(e.pointerId===stickId)stickInput(e);};const endStick=()=>{stickId=null;touchMove.x=0;touchMove.z=0;knob.style.transform='';};stick.onpointerup=endStick;stick.onpointercancel=endStick;stick.onlostpointercapture=endStick;
  window.addEventListener('resize',resize);
}
async function init(){
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0xc7ddd5);renderer.autoClear=true;stage.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','실시간 3D 구름 전장');
    effect=new OutlineEffect(renderer,{defaultThickness:.0013,defaultColor:[.19,.22,.17],defaultAlpha:.7});effect.autoClear=true;
    scene=new THREE.Scene();scene.background=new THREE.Color(0xc7ddd5);scene.fog=new THREE.Fog(0xc7ddd5,125,260);
    scene.add(new THREE.HemisphereLight(0xffffe5,0x8faea3,1.15));const sun=new THREE.DirectionalLight(0xffe5ba,1.65);sun.position.set(-35,70,35);scene.add(sun);
    camera=new THREE.OrthographicCamera(-40,40,30,-30,.1,500);world=createWorld(THREE);scene.add(world.group);
    configureSimulation();resize();camera.position.set(0,85,81);camera.lookAt(cameraTarget);
    const ids=['player-homeward',...sim.enemies.map(e=>e.assetId)];
    for(let i=0;i<ids.length;i++){$('load-message').textContent=`비행선을 불러오는 중 · ${i+1} / ${ids.length}`;const asset=await loadShip(THREE,ids[i],ids[i]==='enemy-tax-cutter'?12:10);if(ids[i]==='player-homeward')playerAsset=asset;else enemyAssets.set(ids[i],asset);}
    configureSimulation();window.__battlefield.playerView=shipView(playerAsset,sim.player,true);
    for(const e of sim.enemies){const a=enemyAssets.get(e.assetId);enemyViews.set(e.id,shipView(a,e));}
    const harborRing=ring(0x6d9b82,11);harborRing.position.set(0,-1,48);scene.add(harborRing);
    bindInput();ready=true;window.__battlefield.ready=true;$('loading').hidden=true;$('welcome').hidden=false;lastTime=performance.now();requestAnimationFrame(frame);
  }catch(e){$('load-message').textContent='전장을 준비하지 못했습니다. 로컬 HTTP 주소로 열고 에셋 파일을 확인해 주세요. '+e.message;window.__battlefield.error=e.message;console.error(e);}
}
init();
