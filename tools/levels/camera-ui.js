import { createVoyageController } from './playable-session.mjs';
import { createVoyageRenderer, THREE } from './camera-renderer.js';
import {cameraProfiles} from './camera-profiles.mjs';
import { moduleWorldPosition, CONFIG } from '../battlefield/sim.mjs';
import { createCombatVfx } from '../battlefield/vfx.js';
import { objectiveFor, selectContact, nextContact, edgeIndicator } from './playable-presentation.mjs';

const $=id=>document.getElementById(id);
const number=value=>Number.isFinite(value)?Math.round(value*10)/10:'—';
const clamp=value=>Math.max(0,Math.min(100,Number.isFinite(value)?value:0));
const phaseNames={harbor:'항구',sailing:'항해 중',defeat:'다시 준비'};
const stageNames={idle:'출항 준비',opening:'첫 교전',midboss:'중간보스',maintenance:'안전 정비',late:'후반 교전',finalboss:'최종보스',victory:'교전 완료','awaiting-clearance':'항로 정리',defeat:'재도전'};
const locationNames={installed:'장착됨',warehouse:'창고 보관',cargo:'회수 화물'};
const slotKinds={L:'기낭',E:'엔진',W:'무장',S:'인양 장치',A:'장갑'};
const friendlyReason=reason=>String(reason||'동작을 마치지 못했습니다.').replace(/\b[a-z][a-z0-9-]*:\s*/g,'');
const timeText=seconds=>`${String(Math.floor((seconds||0)/60)).padStart(2,'0')}:${String(Math.floor((seconds||0)%60)).padStart(2,'0')}`;
const slotLabel=slot=>slotKinds[slot.id?.[0]]?`${slotKinds[slot.id[0]]} 자리 ${slot.id.slice(1)}`:slot.label||slot.id;
const budgetText=budget=>`중량 ${number(budget?.weight)} · 양력 ${number(budget?.lift)} · 전력 ${number(budget?.powerDemand)}/${number(budget?.powerSupply)}`;
const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};

/** Input and presentation layer. Commands are the only mutation boundary. */
export async function bootIntegrationUI() {
  const app=document.querySelector('.app'),keys=new Set(),touchMoves=new Map(),errors=[],eventLog=[];
  let controller=null,renderer=null,vfx=null,ready=false,busy=false,disposed=false,lastTimestamp=performance.now(),lastUI=0,accumulator=0;
  let mouseActive=false,pointerFiring=false,buttonFiring=false,boostHolding=false,aim={x:0,z:-20},lastPhase=null,lastStatus='',toastUntil=0;
  let inventorySignature='',cargoSignature='',slotSignature='',selectedSlot='',runtimeFailure=false;
  let selectedContactId=null,lastHitAt=-Infinity;
  let compareMode=false,compareWasPaused=false,lastPointer=null;

  function selectView(id){
    clearInput();mouseActive=false;
    const profile=renderer.setCameraView(id);
    document.querySelectorAll('[data-camera-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.cameraView===profile.id)));
    $('camera-description').textContent=profile.description;
    app.dataset.viewMode=profile.id;
  }
  async function toggleCompare(){
    const snapshot=controller.snapshot();
    if(snapshot.phase!=='sailing'||snapshot.stage?.phase==='maintenance'||runtimeFailure)return;
    if(!compareMode){compareWasPaused=snapshot.paused;if(!snapshot.paused)await command('pause');compareMode=true;}
    else{compareMode=false;if(!compareWasPaused)await command('resume');}
    app.classList.toggle('camera-comparing',compareMode);
    $('compare-button').setAttribute('aria-pressed',String(compareMode));
    $('compare-button').textContent=compareMode?'비교 마침':'멈춰서 비교';
  }

  function status(message,{error=false,toast=false}={}) {
    if(!message)return;
    const text=friendlyReason(message);$('app-status').textContent=text;
    if(error){errors.push({time:Date.now(),message:String(message)});if(errors.length>100)errors.shift();}
    app.classList.toggle('has-error',error);
    if(toast){$('scene-toast').textContent=text;$('scene-toast').classList.add('show');toastUntil=performance.now()+4500;}
  }
  function clearInput(){keys.clear();touchMoves.clear();pointerFiring=false;buttonFiring=false;boostHolding=false;$('fire-button').classList.remove('holding');$('boost-button').classList.remove('holding');$('aim-reticle').style.display='none';}
  function modelFailure() {
    runtimeFailure=true;clearInput();controller.command('pause');
    status('적선 모델을 불러오지 못해 항해를 멈췄습니다.',{error:true,toast:true});
    const overlay=$('loading-screen');overlay.hidden=false;overlay.style.zIndex='20';overlay.querySelector('h2').textContent='비행선을 불러오지 못했어요';
    $('loading-message').textContent='배와 공격의 시간을 멈췄습니다. 출항할 때 저장한 상태에서 다시 불러올 수 있어요.';
    if(!overlay.querySelector('[data-model-reload]')){const retry=node('button','secondary','출항 경계에서 다시 불러오기');retry.type='button';retry.dataset.modelReload='true';retry.addEventListener('click',()=>location.reload());overlay.querySelector('.overlay-paper').append(retry);}
  }
  async function command(type,payload={}) {
    if(!controller||busy)return {ok:false,reason:'앞선 동작을 마치는 중입니다.'};
    busy=true;
    try{
      const outcome=await controller.command(type,payload);
      if(outcome?.ok&&['depart','retry','restore','return','maintenance'].includes(type)){compareMode=false;app.classList.remove('camera-comparing');$('compare-button').setAttribute('aria-pressed','false');$('compare-button').textContent='멈춰서 비교';}
      if(['depart','retry','pause','resume','maintenance','return','restore'].includes(type)){clearInput();accumulator=0;lastTimestamp=performance.now();}
      if(['depart','retry','restore'].includes(type)){renderer?.reset();selectedContactId=null;}
      if(outcome?.ok&&['depart','retry','resume','maintenance'].includes(type))$('scene').focus({preventScroll:true});
      const snapshot=controller.snapshot();renderUI(snapshot,true);renderer?.render(snapshot,0);
      status(outcome?.ok?snapshot.status:outcome?.reason||snapshot.status,{error:!outcome?.ok,toast:true});
      return outcome;
    }catch(error){status(error.message,{error:true,toast:true});return {ok:false,reason:error.message};}
    finally{busy=false;if(controller)renderUI(controller.snapshot(),true);}
  }
  const qa={version:'playable-battlefield-v1',ready:false,driverMode:false,errors,eventLog,command,
    get controller(){return controller;},get renderer(){return renderer;},get vfx(){return vfx;},vfxDebug(){return vfx?.debug()||null;},
    snapshot(){return controller?.snapshot()||null;},stats(){return renderer?.stats()||null;},
    capture(){return renderer?.capture()||null;},reset(){clearInput();renderer?.reset();},
    async whenIdle(){if(!renderer)return;renderer.render(controller.snapshot(),0);await renderer.whenIdle();renderer.render(controller.snapshot(),0);await renderer.whenIdle();},
    attachEffects(effects){renderer?.attachEffects(effects);},
    setDriverMode(value){qa.driverMode=!!value;clearInput();accumulator=0;lastTimestamp=performance.now();},
    dispose(){disposed=true;clearInput();renderer?.dispose();}
  };
  window.__integration=qa;
  window.__playableBattlefield=qa;
  window.__cameraStudy=qa;

  function guidance(snapshot) {
    const objective=objectiveFor(snapshot,selectedContactId),contacts=(snapshot.sim?.enemies||[]).filter(enemy=>!enemy.defeated);
    $('objective-text').textContent=objective.title;$('objective-detail').textContent=objective.detail;$('contacts-count').textContent=String(contacts.length);
    const target=objective.target,arrow=$('target-arrow');
    $('mission-brief').textContent=snapshot.phase==='harbor'?'한 번의 항해 · 부품 분리 → 인양 → 귀환':snapshot.stage?.phase==='maintenance'?'안전 정비 · 준비되면 계속 항해':'첫 항해 · 종항 잔해해역';
    $('objective-distance').textContent=objective.inRange?(objective.action==='salvage'?'F · 지금 인양 가능':'H · 지금 귀환 가능'):target?.kind==='return'?'남쪽 부표를 따라가세요':target?.kind==='salvage'?'회수 표식에 다가가세요':target?'마우스 조준 · J 또는 클릭 사격':'';
    $('target-arrow-label').textContent=target?.label||'';
    $('target-arrow-label').hidden=!target;
    if(target&&renderer){
      const scene=$('scene'),projected=renderer.projectPoint([target.x,1,target.z]),indicator=edgeIndicator(projected,scene.clientWidth,scene.clientHeight,70);
      arrow.hidden=!indicator?.visible;
      if(indicator?.visible){arrow.style.left=`${indicator.x}px`;arrow.style.top=`${indicator.y}px`;arrow.style.transform=`translate(-50%,-50%) rotate(${indicator.degrees}deg)`;arrow.dataset.kind=target.kind;}
    }else arrow.hidden=true;
    app.classList.toggle('hit-flash',performance.now()-lastHitAt<220);
  }

  function renderCargo(snapshot,force) {
    const inHarbor=snapshot.phase==='harbor',cargo=inHarbor?(snapshot.harbor?.inventory||[]).filter(part=>part.status==='cargo'):(snapshot.sim?.cargo||[]);
    const signature=`${inHarbor}:${cargo.map(part=>`${part.id}:${part.weight}:${part.label||part.modules?.length}`).join('|')}`;
    if(force||signature!==cargoSignature){
      cargoSignature=signature;const list=$('cargo-list');list.replaceChildren();
      if(!cargo.length)list.append(node('li','empty-item',inHarbor?'돌아온 화물이 여기에 모여요.':'아직 회수한 부품이 없어요.'));
      for(const part of cargo){
        const row=node('li'),icon=node('span','part-icon','◇'),info=node('div','part-info');
        const label=part.label||part.source?.name||'회수 부품 묶음';info.append(node('strong','',label));
        info.append(node('small','',inHarbor?`화물 · 중량 ${number(part.weight)}`:`${part.modules?.length||0}개 부품 · 중량 ${number(part.weight)}`));row.append(icon,info);list.append(row);
      }
    }
    $('cargo-tag').textContent=inHarbor?`${cargo.length}개 부품`:`${cargo.length}묶음`;
    $('store-button').disabled=busy||!inHarbor||!cargo.length;
    $('store-button').hidden=!inHarbor;
  }
  function renderInventory(snapshot,force) {
    const harbor=snapshot.harbor||{},slots=harbor.slots||[],parts=(harbor.inventory||[]).filter(part=>part.status!=='cargo');
    const signature=slots.map(slot=>`${slot.id}:${slot.label}`).join('|');
    if(signature!==slotSignature){
      slotSignature=signature;$('slot-select').replaceChildren();
      for(const slot of slots){const option=node('option','',slotLabel(slot));option.value=slot.id;$('slot-select').append(option);}
      if(!slots.some(slot=>slot.id===selectedSlot))selectedSlot=slots.find(slot=>/^W2$/.test(slot.id))?.id||slots[0]?.id||'';
      $('slot-select').value=selectedSlot;
    }
    const inventoryKey=`${selectedSlot}:${parts.map(part=>`${part.id}:${part.status}:${part.slotId}:${part.hp}:${part.canEquip}`).join('|')}`;
    if(!force&&inventoryKey===inventorySignature)return;
    inventorySignature=inventoryKey;const list=$('inventory-list');list.replaceChildren();
    const ordered=[...parts].sort((a,b)=>(a.status==='installed')-(b.status==='installed'));
    if(!ordered.length)list.append(node('li','empty-item','창고에 보관한 부품이 없습니다.'));
    for(const part of ordered){
      const row=node('li'),icon=node('span','part-icon',part.status==='installed'?'✦':'◇'),info=node('div','part-info');
      info.append(node('strong','',part.label));
      const socket=slots.find(slot=>slot.id===part.slotId),where=part.slotId?` · ${socket?slotLabel(socket):part.slotId}`:'';
      info.append(node('small','',`${locationNames[part.status]||part.status}${where} · 내구 ${number(part.hp)}/${number(part.maxHp)}`));
      row.append(icon,info);
      if(part.canEquip&&snapshot.phase==='harbor'){
        const preview=controller.previewEquip?.(part.id,selectedSlot),button=node('button','part-equip','장착');
        button.type='button';button.dataset.partId=part.id;button.disabled=busy||!preview?.ok;
        if(preview){
          const explanation=preview.ok?`${budgetText(preview.before)} → ${budgetText(preview.after)}`:(preview.reasons||[]).map(friendlyReason).join(' ');
          info.append(node('small',preview.ok?'preview-text':'preview-text invalid',explanation));button.title=explanation;
        }
        button.addEventListener('click',()=>command('equip',{partId:part.id,slotId:selectedSlot}));row.append(button);
      }
      list.append(row);
    }
    $('inventory-count').textContent=`${parts.length}개`;
  }
  function drawChart(snapshot) {
    const canvas=$('chart'),ctx=canvas.getContext('2d');if(!ctx)return;
    const width=canvas.width,height=canvas.height,level=snapshot.level,bounds=level?.bounds||{min:[-90,0,-90],max:[90,0,90]};
    const map=(x,z)=>({x:18+(x-bounds.min[0])/(bounds.max[0]-bounds.min[0])*(width-36),y:18+(z-bounds.min[2])/(bounds.max[2]-bounds.min[2])*(height-36)});
    const radius=value=>value/(bounds.max[0]-bounds.min[0])*(width-36);
    ctx.clearRect(0,0,width,height);ctx.strokeStyle='#dce1c9';ctx.lineWidth=.6;
    for(let i=1;i<6;i++){ctx.beginPath();ctx.moveTo(i*width/6,0);ctx.lineTo(i*width/6,height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*height/6);ctx.lineTo(width,i*height/6);ctx.stroke();}
    ctx.font='8px Georgia';ctx.textAlign='center';ctx.fillStyle='#9b9e80';ctx.fillText('N',width/2,12);
    for(const collider of level?.colliders||[]){
      const point=map(collider.center[0],collider.center[2]);ctx.fillStyle='#bdc9a67d';ctx.beginPath();ctx.ellipse(point.x,point.y,radius(collider.halfExtents[0]),Math.max(1,collider.halfExtents[2]/(bounds.max[2]-bounds.min[2])*(height-36)),0,0,Math.PI*2);ctx.fill();
    }
    const sim=snapshot.phase==='harbor'?null:snapshot.sim;
    if(sim?.harbor){const p=map(sim.harbor.x,sim.harbor.z);ctx.strokeStyle='#7b9c7d';ctx.setLineDash([2,2]);ctx.beginPath();ctx.arc(p.x,p.y,radius(sim.harbor.radius),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    for(const enemy of sim?.enemies||[]){if(enemy.defeated)continue;const p=map(enemy.x,enemy.z);ctx.fillStyle='#bc8065';ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill();}
    for(const bundle of sim?.debris||[]){if(bundle.salvaged||bundle.lost||bundle.remaining<=0)continue;const p=map(bundle.x,bundle.z);ctx.fillStyle='#b99b5a';ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.fillRect(-2.5,-2.5,5,5);ctx.restore();}
    const start=level?.playerStart?.position||[0,0,40],player=sim?.player||{x:start[0],z:start[2],angle:level?.playerStart?.headingRadians||0},p=map(player.x,player.z);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI-player.angle);ctx.fillStyle='#397565';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,5);ctx.lineTo(0,3);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();ctx.restore();
  }
  function renderUI(snapshot,force=false) {
    if(!snapshot)return;
    const harbor=snapshot.phase==='harbor',defeat=snapshot.phase==='defeat',maintenance=snapshot.stage?.phase==='maintenance',p=snapshot.sim?.player;
    app.dataset.phase=snapshot.phase;
    if(snapshot.phase!==lastPhase){lastPhase=snapshot.phase;clearInput();inventorySignature='';cargoSignature='';force=true;app.classList.remove('drawer-open');$('drawer-button').setAttribute('aria-expanded','false');$('harbor-drawer').setAttribute('aria-hidden','true');$('help-panel').hidden=true;$('help-button').setAttribute('aria-expanded','false');}
    $('phase-chip').textContent=maintenance?'안전 정비':phaseNames[snapshot.phase]||'항해';
    $('place-label').textContent=harbor?'구름이 머무는 곳':'첫 바람의 항로';
    $('route-title').textContent=harbor?'종항의 작은 부두':snapshot.stage?.title||'흩어진 조각을 찾아서';
    $('view-caption').textContent=harbor?'구름 아래 작은 불빛, 종항':stageNames[snapshot.stage?.phase]||'귀환호의 항해';
    $('harbor-eyebrow').textContent=harbor?'작은 부두에 닻을 내리고':'오늘 항해에서 건진 조각';
    $('harbor-title').textContent=harbor?'종항 공방':'항해 화물함';
    $('harbor-description').textContent=harbor?'돌아온 조각을 정리하고, 다음 항해를 준비하세요.':'화물은 귀환 뒤 창고로 옮기고 장착할 수 있어요.';
    $('harbor-section').hidden=!harbor;$('sailing-section').hidden=harbor;$('flight-actions').hidden=harbor||defeat;
    $('pause-screen').hidden=!snapshot.paused||harbor||defeat||maintenance;$('maintenance-screen').hidden=!maintenance||defeat||harbor;
    $('defeat-screen').hidden=!defeat;$('pause-button').disabled=busy||harbor||defeat||maintenance;
    $('pause-button').setAttribute('aria-pressed',String(snapshot.paused));$('pause-button').title=snapshot.paused?'계속 항해 · Esc':'일시정지 · Esc';
    $('pause-button').textContent=snapshot.paused?'▷':'Ⅱ';
    const rootPart=(snapshot.harbor?.inventory||[]).find(part=>part.status==='installed'&&!part.slotId),hp=harbor?rootPart?.hp:p?.hp,maxHp=harbor?rootPart?.maxHp:p?.maxHp;
    $('hull-text').textContent=`${number(hp)} / ${number(maxHp)}`;$('hull-fill').style.width=`${clamp(hp/Math.max(1,maxHp)*100)}%`;
    $('hull-fill').style.background=hp/Math.max(1,maxHp)<.3?'#ba7559':'#5e917b';
    $('boost-text').textContent=harbor?'출항 준비':`${Math.round(clamp(p?.boostCharge/Math.max(1,p?.maxBoostCharge||100)*100))}%`;
    $('boost-fill').style.width=harbor?'100%':`${clamp(p?.boostCharge/Math.max(1,p?.maxBoostCharge||100)*100)}%`;
    const harborBudget=snapshot.harbor?.totalsText||'';
    $('weight-text').textContent=harbor?harborBudget.match(/중량\s+([\d.]+)/)?.[1]||'—':number(p?.weight);$('lift-text').textContent=harbor?harborBudget.match(/양력\s+([\d.]+)/)?.[1]||'—':number(p?.lift);
    $('cargo-count').textContent=harbor?String((snapshot.harbor?.inventory||[]).filter(part=>part.status==='cargo').length):String(snapshot.sim?.cargo?.length||0);
    $('time-text').textContent=harbor?'—':timeText(snapshot.sim?.time);$('lift-warning').hidden=harbor||!(p?.weight>p?.lift);
    $('voyage-number').textContent=harbor?`${snapshot.harbor?.settlements||0}회 귀환`:stageNames[snapshot.stage?.phase]||'항해 중';
    $('resources-text').textContent=snapshot.harbor?.resourcesText||'—';$('totals-text').textContent=harbor?snapshot.harbor?.totalsText||'—':`중량 ${number(p?.weight)} / 양력 ${number(p?.lift)} · 전력 ${number(p?.powerDraw)} / ${number(p?.powerOutput)}`;
    $('repair-cost').textContent=snapshot.harbor?.repair?.costText||'수리할 곳이 없어요.';$('repair-button').disabled=busy||!harbor||!snapshot.harbor?.repair?.canRepair;
    $('depart-button').disabled=busy||!harbor;$('save-button').disabled=busy||!harbor;$('restore-button').disabled=busy||!harbor||snapshot.harbor?.canRestore===false;
    $('restore-button').title=snapshot.harbor?.canRestore===false?'현재 변경을 먼저 저장하세요.':snapshot.harbor?.dirty?'충돌한 현재 변경을 보관한 뒤 마지막 정상 항구 기록을 불러옵니다.':'마지막 정상 항구 기록을 불러옵니다.';
    const saveStatus=snapshot.harbor?.saveStatus||'아직 저장하지 않았습니다.';$('save-status').textContent=`${saveStatus}${snapshot.harbor?.dirty?' · 변경 미저장':''}`;
    $('save-dot').classList.toggle('error',/실패|오류|손상|불일치|거부/.test(saveStatus));
    $('slot-select').disabled=busy||!harbor;
    for(const button of document.querySelectorAll('.flight-action'))button.disabled=busy||snapshot.paused||defeat;
    if(snapshot.status!==lastStatus){lastStatus=snapshot.status;status(snapshot.status);}
    renderCargo(snapshot,force);renderInventory(snapshot,force);drawChart(snapshot);guidance(snapshot);
  }

  function autoAim(snapshot) {
    const sim=snapshot.sim;if(!sim)return;
    const enemies=(sim.enemies||[]).filter(enemy=>!enemy.defeated);if(!enemies.length)return;
    const enemy=selectContact(sim,selectedContactId);if(!enemy)return;
    const parts=enemy.modules||[],part=parts.find(value=>value.key==='connector'&&value.attached&&value.hp>0)||parts.find(value=>value.key==='cannon'&&value.attached&&value.hp>0)||parts.find(value=>value.key==='root');
    const point=part?moduleWorldPosition(enemy,part):enemy,lead=Math.hypot(point.x-sim.player.x,point.z-sim.player.z)/(CONFIG.playerProjectileSpeed||45);
    aim={x:point.x+(enemy.vx||0)*lead,z:point.z+(enemy.vz||0)*lead};
  }
  function input(snapshot) {
    if(!mouseActive||buttonFiring||matchMedia('(pointer: coarse)').matches)autoAim(snapshot);
    let moveX=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),moveZ=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
    for(const direction of touchMoves.values()){if(direction==='left')moveX--;if(direction==='right')moveX++;if(direction==='up')moveZ--;if(direction==='down')moveZ++;}
    if(mouseActive&&lastPointer){const point=renderer.aimAt(lastPointer.x,lastPointer.y);if(point)aim=point;}
    const movement=renderer.screenMove(moveX,moveZ);
    return {...movement,aimX:aim.x,aimZ:aim.z,fire:pointerFiring||buttonFiring||keys.has('KeyJ'),boost:boostHolding||keys.has('Space')};
  }
  function pointAim(event) {
    if(!renderer||!ready)return;
    lastPointer={x:event.clientX,y:event.clientY};
    const point=renderer.aimAt(event.clientX,event.clientY);if(point){aim=point;mouseActive=true;}
    const box=$('scene').getBoundingClientRect(),reticle=$('aim-reticle');reticle.style.left=`${event.clientX-box.left}px`;reticle.style.top=`${event.clientY-box.top}px`;
    const snapshot=controller.snapshot();reticle.style.display=snapshot.phase==='sailing'&&!snapshot.paused?'block':'none';
  }
  function bindHold(id,setValue) {
    const button=$(id),release=event=>{if(event?.pointerId!==undefined&&button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);setValue(false);button.classList.remove('holding');};
    button.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();if(button.disabled)return;button.setPointerCapture(event.pointerId);setValue(true);button.classList.add('holding');});
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',()=>{setValue(false);button.classList.remove('holding');});
    button.addEventListener('keydown',event=>{if(['Space','Enter'].includes(event.code)&&!event.repeat&&!button.disabled){event.preventDefault();setValue(true);button.classList.add('holding');}});
    button.addEventListener('keyup',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();release();}});
  }
  function bindInput() {
    document.querySelectorAll('[data-camera-view]').forEach(button=>button.addEventListener('click',()=>selectView(button.dataset.cameraView)));
    $('compare-button').addEventListener('click',toggleCompare);
    $('help-button').addEventListener('click',()=>{const open=$('help-panel').hidden;$('help-panel').hidden=!open;$('help-button').setAttribute('aria-expanded',String(open));});
    const setDrawer=open=>{app.classList.toggle('drawer-open',open);$('drawer-button').setAttribute('aria-expanded',String(open));$('harbor-drawer').setAttribute('aria-hidden',String(!open));};
    $('drawer-button').addEventListener('click',()=>setDrawer(!app.classList.contains('drawer-open')));
    $('drawer-close')?.addEventListener('click',()=>setDrawer(false));document.querySelector('.drawer-shade')?.addEventListener('click',()=>setDrawer(false));
    document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>command(button.dataset.command)));
    $('pause-button').addEventListener('click',()=>{if(compareMode)toggleCompare();else command(controller.snapshot().paused?'resume':'pause');});
    $('camera-button').addEventListener('click',()=>{clearInput();mouseActive=false;const value=renderer.setOverview(!renderer.overview);$('camera-button').setAttribute('aria-pressed',String(value));});
    $('slot-select').addEventListener('change',event=>{selectedSlot=event.target.value;inventorySignature='';renderUI(controller.snapshot(),true);});
    $('scene').addEventListener('pointermove',event=>{if(event.pointerType!=='touch')pointAim(event);});
    $('scene').addEventListener('pointerdown',event=>{
      if(event.button!==0||event.pointerType==='touch')return;
      const snapshot=controller.snapshot();if(snapshot.phase!=='sailing'||snapshot.paused)return;
      event.preventDefault();$('scene').focus({preventScroll:true});pointAim(event);pointerFiring=true;$('scene').setPointerCapture(event.pointerId);
    });
    $('scene').addEventListener('pointerup',()=>{pointerFiring=false;});$('scene').addEventListener('pointercancel',()=>{pointerFiring=false;});
    $('scene').addEventListener('lostpointercapture',()=>{pointerFiring=false;});$('scene').addEventListener('pointerleave',()=>{$('aim-reticle').style.display='none';});
    $('scene').addEventListener('contextmenu',event=>event.preventDefault());
    $('scene').addEventListener('wheel',event=>{event.preventDefault();renderer.setZoom(renderer.zoom+(event.deltaY>0?.08:-.08));},{passive:false});
    bindHold('fire-button',value=>{buttonFiring=value;if(value)mouseActive=false;});bindHold('boost-button',value=>{boostHolding=value;});
    document.querySelectorAll('[data-move]').forEach(button=>{
      button.addEventListener('pointerdown',event=>{event.preventDefault();if(controller.snapshot().paused)return;button.setPointerCapture(event.pointerId);touchMoves.set(event.pointerId,button.dataset.move);});
      for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>touchMoves.delete(event.pointerId));
    });
    window.addEventListener('keydown',event=>{
      const editable=/INPUT|SELECT|TEXTAREA/.test(event.target.tagName);if(editable)return;
      const snapshot=controller.snapshot();
      if(event.code==='KeyV'&&!event.repeat){event.preventDefault();const index=cameraProfiles.findIndex(profile=>profile.id===renderer.cameraView);selectView(cameraProfiles[(index+1)%cameraProfiles.length].id);return;}
      if(event.code==='Escape'&&!event.repeat&&compareMode){event.preventDefault();toggleCompare();return;}
      if(event.code==='Escape'&&!event.repeat&&snapshot.phase==='sailing'&&snapshot.stage?.phase!=='maintenance'){event.preventDefault();clearInput();command(snapshot.paused?'resume':'pause');return;}
      if(event.code==='KeyM'&&!event.repeat){event.preventDefault();$('camera-button').click();return;}
      if(event.code==='KeyT'&&!event.repeat&&snapshot.phase==='sailing'){event.preventDefault();selectedContactId=nextContact(snapshot.sim,selectedContactId);mouseActive=false;guidance(snapshot);return;}
      if(event.code==='KeyR'&&!event.repeat&&snapshot.phase==='defeat'){event.preventDefault();command('retry');return;}
      if(snapshot.phase!=='sailing'||snapshot.paused)return;
      if(['KeyF','KeyH'].includes(event.code)&&!event.repeat){event.preventDefault();command(event.code==='KeyF'?'salvage':'return');return;}
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyJ'].includes(event.code)){
        if(event.target.closest('button')&&['Space','Enter'].includes(event.code))return;
        event.preventDefault();keys.add(event.code);
      }
    });
    window.addEventListener('keyup',event=>keys.delete(event.code));
    window.addEventListener('blur',()=>{clearInput();const snapshot=controller?.snapshot();if(snapshot?.phase==='sailing'&&!snapshot.paused)command('pause');});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();const snapshot=controller?.snapshot();if(snapshot?.phase==='sailing'&&!snapshot.paused)command('pause');}lastTimestamp=performance.now();accumulator=0;});
  }
  function loop(timestamp) {
    if(disposed)return;
    const dt=Math.min(Math.max((timestamp-lastTimestamp)/1000,0),.1);lastTimestamp=timestamp;
    if(ready&&!runtimeFailure){
      try{
        let snapshot=controller.snapshot();
        if(snapshot.phase==='sailing'&&renderer.actorLoadFailed){modelFailure();snapshot=controller.snapshot();renderUI(snapshot,true);}
        app.dataset.streaming=String(renderer.actorsPending>0);
        if(!runtimeFailure&&snapshot.phase==='sailing'&&!snapshot.paused&&!busy&&!document.hidden&&!renderer.actorsPending&&!qa.driverMode){
          accumulator=Math.min(accumulator+dt,.15);
          while(accumulator>=1/60){controller.advance(1/60,input(snapshot));accumulator-=1/60;snapshot=controller.snapshot();if(snapshot.paused||snapshot.phase!=='sailing'){accumulator=0;break;}}
        }else accumulator=0;
        renderer.render(snapshot,dt);
        if(timestamp-lastUI>100){renderUI(snapshot);lastUI=timestamp;}
        if(toastUntil&&timestamp>toastUntil){$('scene-toast').classList.remove('show');toastUntil=0;}
      }catch(error){
        runtimeFailure=true;clearInput();controller.command('pause');status(`항해 표시를 멈췄습니다. ${error.message}`,{error:true,toast:true});
        $('loading-message').textContent=friendlyReason(error.message);$('loading-screen').hidden=false;$('loading-screen').querySelector('h2').textContent='항해를 표시하지 못했어요';
      }
    }
    requestAnimationFrame(loop);
  }

  try{
    // Access is deferred so storage exceptions remain visible through the save repository.
    const storage={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value),removeItem:key=>window.localStorage.removeItem(key)};
    controller=await createVoyageController({storage,saveKey:'cloudstitch.camera-study.v1'});
    renderer=createVoyageRenderer({container:$('scene'),labels:$('world-labels'),onStatus:status});
    $('loading-message').textContent='귀환호의 천과 나무, 황동 장식을 불러오고 있어요.';
    await renderer.initialize();
    controller.setMuzzleResolver?.(({player,target})=>renderer.muzzleFrame(player,target));
    $('loading-message').textContent='포구의 불빛과 피격 효과를 준비하고 있어요.';
    vfx=createCombatVfx(THREE,renderer.scene);await vfx.load();renderer.attachEffects(vfx);
    renderer.onEvents((events,snapshot)=>{
      if(events.some(event=>event.type==='hit'&&event.target==='player'))lastHitAt=performance.now();
      for(const event of events){eventLog.push({voyageId:snapshot.voyageId,...event});if(eventLog.length>200)eventLog.shift();}
      const messages={'bundle-detached':'연결이 끊어졌어요. 떠다니는 부품 가까이에서 F를 눌러 인양하세요.','enemy-defeated':'적선을 무력화했어요. 남은 부품을 살펴보세요.','salvaged':'인양 완료 · 부품을 화물로 실었습니다.','cargo-dropped':'화물을 내려 양력 여유를 확보했습니다.'};
      const event=[...events].reverse().find(entry=>messages[entry.type]);if(event)status(messages[event.type],{toast:true});
    });
    bindInput();renderUI(controller.snapshot(),true);renderer.render(controller.snapshot(),0);ready=true;qa.ready=true;$('loading-screen').hidden=true;
    status(controller.snapshot().status);lastTimestamp=performance.now();requestAnimationFrame(loop);return qa;
  }catch(error){
    status(error.message,{error:true});$('loading-message').textContent=friendlyReason(error.message);$('loading-screen').querySelector('h2').textContent='항해를 준비하지 못했어요';
    const retry=node('button','secondary','다시 불러오기');retry.type='button';retry.addEventListener('click',()=>location.reload());$('loading-screen').querySelector('.overlay-paper').append(retry);
    qa.ready=false;return qa;
  }
}

bootIntegrationUI();
