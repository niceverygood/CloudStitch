import catalog from './catalog.json';
import {createEncounter} from './core.js';
import {createBattleScene} from './scene.js';
import {showBossBanner} from './presentation-policy.mjs';

const $=id=>document.getElementById(id),canvas=$('battle');
const phaseLabels={briefing:'출항 준비',opening:'전반 교전',midboss:'중간보스',maintenance:'안전 정비',late:'후반 교전',finalboss:'최종보스',victory:'항로 확보',defeat:'선체 손상'};
const roleNames={scout:'정찰·측면 기동',blockade:'봉쇄·일제 포격',salvage:'작살·견인',repair:'수리 지원',charger:'돌진·관성 회복',ambush:'위장·기습',artillery:'광역 포격',flame:'근접 화염',bell:'종·충격파',shipyard:'도크·압력 제어',king:'함대 지휘',heart:'봉인·압력파'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let scene,autoStep=true,lastTime=performance.now(),lastUI=0,lastPhase='',lastStage='',firePointer=false,stickPointer=null,stickMove={x:0,z:0},toastTimer;
const keys=new Set(),wins=new Set();
try{for(const id of JSON.parse(localStorage.getItem('cloudstitch-encounters-v1-wins')||'[]'))if(catalog.stages.some(s=>s.id===id))wins.add(id);}catch{}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function onEvent(event){
 if(event.type==='victory'){wins.add(event.stageId);try{localStorage.setItem('cloudstitch-encounters-v1-wins',JSON.stringify([...wins]));}catch{toast('승리 기록을 저장하지 못했습니다. 플레이는 계속할 수 있습니다.');}renderCards();}
 if(event.type==='phase')$('announcement').textContent=phaseLabels[event.phase]||'';
}
const engine=createEncounter(catalog,{onEvent});
function fail(error){const text=String(error?.message||error);$('error').textContent='전장을 불러오지 못했습니다. 저장소 루트의 로컬 서버에서 열어 주세요. '+text;$('error').hidden=false;window.__encounterStats={...window.__encounterStats,error:text};}
function renderCards(){
 $('stage-list').innerHTML=catalog.stages.map((s,i)=>`<button class="stage-card" data-stage-id="${esc(s.id)}" aria-pressed="${engine.snapshot().stageId===s.id}"><small>항로 ${String(i+1).padStart(2,'0')}${wins.has(s.id)?' · <span class="cleared">확보 완료</span>':''}</small><strong>${esc(s.region)}</strong><span class="boss-pair">중간 · ${esc(s.midBoss.name)}<br>최종 · ${esc(s.finalBoss.name)}</span></button>`).join('');
 for(const button of document.querySelectorAll('[data-stage-id]'))button.addEventListener('click',()=>start(button.dataset.stageId));
}
function applyDifficulty(){engine.setDifficulty($('difficulty').value);}
function start(id){resetControls();applyDifficulty();engine.startStage(id);renderCards();sync(true);canvas.focus({preventScroll:true});}
function resetControls(){keys.clear();firePointer=false;stickMove={x:0,z:0};stickPointer=null;$('stick').style.transform='';$('touch-fire').classList.remove('pressed');engine.setInput({moveX:0,moveZ:0,fire:false,dash:false});}
function doPrimary(){
 const s=engine.snapshot();if(s.paused){engine.pause(false);return sync(true);}
 if(s.phase==='briefing')start(s.stageId);
 else if(s.phase==='maintenance'){resetControls();engine.continue();sync(true);canvas.focus({preventScroll:true});}
 else if(s.phase==='defeat'){applyDifficulty();engine.retry();sync(true);canvas.focus({preventScroll:true});}
 else if(s.phase==='victory'){applyDifficulty();if(!engine.nextStage())engine.reset();renderCards();sync(true);canvas.focus({preventScroll:true});}
}
function sync(force=false,frameDt=0){
 const s=engine.snapshot();scene?.sync(s,frameDt);
 if(scene)window.__encounterStats={...scene.getStats(),renderedStageId:s.stageId,renderedPhase:s.phase,controlsReady:true};
 if(!force&&performance.now()-lastUI<80)return;lastUI=performance.now();
 if(lastStage!==s.stageId){
  lastStage=s.stageId;$('stage-title').textContent=s.stage.region;$('stage-subtitle').textContent=s.stage.subtitle;
  const units=[...s.stage.opening,...s.stage.late],roles=[...new Set(units.map(u=>u.role))];$('roster-list').innerHTML=roles.map(r=>`<span class="chip">${esc(roleNames[r]||r)}</span>`).join('');
  $('roster-note').textContent=`전반 ${s.stage.opening.reduce((n,u)=>n+u.count,0)}척 · 후반 ${s.stage.late.reduce((n,u)=>n+u.count,0)}척 · 두 보스는 각 1회 등장`;
  $('boss-lineup').textContent=`중간보스 · ${s.stage.midBoss.name} / 최종보스 · ${s.stage.finalBoss.name}`;renderCards();
 }
 $('health-value').textContent=`${Math.ceil(s.player.hp)} / ${s.player.maxHp}`;$('health-fill').style.width=`${s.player.hp/s.player.maxHp*100}%`;$('health-status').textContent=s.player.hp<45?'위험':'정상';
 $('objective').textContent=s.objective;$('phase-label').textContent=`${phaseLabels[s.phase]} · 남은 적 ${s.enemies.length}`;
 const boss=s.enemies.find(e=>e.tier!=='normal');$('boss-hud').hidden=!boss;
 if(boss){$('boss-tier').textContent=boss.tier==='midboss'?'중간보스':'최종보스';$('boss-name').textContent=boss.name;$('boss-fill').style.width=`${boss.hp/boss.maxHp*100}%`;}
 $('banner').hidden=!showBossBanner(s);$('banner').textContent=s.banner;
 $('movement-status').textContent=s.player.tetherTime>0?'견인 저항 · 기동으로 벗어나세요':s.player.dashCooldown>0?`긴급기동 ${s.player.dashCooldown.toFixed(1)}초`:'긴급기동 준비 · Space';
 $('combat-status').textContent=s.telegraphs.length?`공격 예고 ${s.telegraphs.length}개 · 경계 밖으로 회피`:`격파 ${s.stats.kills} · 수리 부표 ${s.repairPickups.length}`;
 $('combat-status').classList.toggle('danger-status',!!s.telegraphs.length);$('pause').textContent=s.paused?'계속하기':'일시정지';$('pause').disabled=['briefing','victory','defeat','maintenance'].includes(s.phase);$('restart').disabled=s.phase==='briefing';
 const overlay=s.paused||['briefing','maintenance','victory','defeat'].includes(s.phase);$('overlay').hidden=!overlay;
 if(overlay){
  const texts=s.paused?['정지한 항로','잠시 숨을 고르세요','일시정지 동안 이동·적 공격·모든 전투 시간이 멈춥니다.','계속하기']:s.phase==='maintenance'?['중간보스 격파','안전 정비 완료','선체를 복구했습니다. 준비되면 후반 편대와 최종보스가 기다리는 항로로 출항하세요.','후반 항로로']:s.phase==='victory'?['최종보스 격파','항로를 확보했습니다',`일반 적과 두 보스를 모두 격파했습니다. ${s.stats.shots}발 사격 · 피격 피해 ${Math.round(s.stats.damageTaken)}.`,catalog.stages.at(-1).id===s.stageId?'항로 선택으로':'다음 판 출항']:s.phase==='defeat'?['선체 손상','다시 바람을 잡으세요','큰 공격의 경계가 고정되는 순간을 보고 회피하세요. 같은 판을 처음부터 다시 시작할 수 있습니다.','이 판 다시 출항']:['출항 준비',s.stage.region,'일반 적 → 중간보스 → 안전 정비 → 후반 교전 → 최종보스. 사격하며 이동하고, 주황 예고의 바깥 경로를 찾으세요.','출항'];
  [$('overlay-eyebrow'),$('overlay-title'),$('overlay-text'),$('primary-action')].forEach((e,i)=>e.textContent=texts[i]);$('flow').hidden=s.paused||s.phase!=='briefing';$('secondary-action').hidden=!s.paused;$('secondary-action').textContent='출항 준비로 돌아가기';
 }
 const stats=scene?.getStats();const loading=stats?.loadingAssets??stats?.pendingAssets??stats?.loading??0;$('model-loading').hidden=!loading;$('model-loading').textContent=`비행선 준비 중${typeof loading==='number'?' · '+loading:''}`;
 lastPhase=s.phase;
}
function togglePause(){const s=engine.snapshot();if(['briefing','maintenance','victory','defeat'].includes(s.phase))return;resetControls();engine.pause(!s.paused);sync(true);}
$('primary-action').addEventListener('click',doPrimary);$('pause').addEventListener('click',togglePause);$('restart').addEventListener('click',()=>{resetControls();applyDifficulty();engine.retry();sync(true);});$('secondary-action').addEventListener('click',()=>{resetControls();engine.reset();sync(true);});
$('difficulty').addEventListener('change',()=>{if(engine.snapshot().phase!=='briefing')toast('난이도는 다시 출항할 때 적 편성에 적용됩니다.');});
// Difficulty changes apply at a fresh run, never secretly alter an active enemy.
$('difficulty').addEventListener('focus',()=>{if(!['briefing','victory','defeat','maintenance'].includes(engine.snapshot().phase))engine.pause(true);sync(true);});
$('reduced-motion').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;$('reduced-motion').addEventListener('change',()=>scene?.setReducedMotion($('reduced-motion').checked));
window.addEventListener('keydown',event=>{
 if(event.target.matches('input,select,textarea')||event.metaKey||event.ctrlKey||event.altKey)return;
 if(event.code==='Space'&&event.target.matches('button,a'))return;
 if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyJ','Escape'].includes(event.code))event.preventDefault();
 if(event.code==='Escape'&&!event.repeat){togglePause();return;}if(event.code==='Enter'&&!event.repeat&&$('overlay').hidden===false&&!event.target.matches('button,a')){event.preventDefault();doPrimary();return;}
 keys.add(event.code);if(event.code==='Space'&&!event.repeat)engine.setInput({dash:true});
});window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{resetControls();if(['opening','midboss','late','finalboss'].includes(engine.snapshot().phase))engine.pause(true);sync(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetControls();if(['opening','midboss','late','finalboss'].includes(engine.snapshot().phase))engine.pause(true);sync(true);}});
canvas.addEventListener('pointermove',event=>{if(!scene||$('auto-aim').checked)return;const p=scene.screenToWorld(event.clientX,event.clientY);if(p)engine.setInput({aimX:p.x,aimZ:p.z});});
canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;firePointer=true;canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>firePointer=false);
const joy=$('joystick');joy.addEventListener('pointerdown',event=>{stickPointer=event.pointerId;joy.setPointerCapture(event.pointerId);moveStick(event);});
function moveStick(event){if(stickPointer!==event.pointerId)return;const rect=joy.getBoundingClientRect(),dx=event.clientX-rect.left-rect.width/2,dz=event.clientY-rect.top-rect.height/2,m=Math.hypot(dx,dz),k=Math.min(1,32/(m||1));stickMove={x:dx*k/32,z:dz*k/32};$('stick').style.transform=`translate(${dx*k}px,${dz*k}px)`;}
joy.addEventListener('pointermove',moveStick);for(const event of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(event,()=>{stickPointer=null;stickMove={x:0,z:0};$('stick').style.transform='';});
const fire=$('touch-fire');fire.addEventListener('pointerdown',event=>{firePointer=true;fire.classList.add('pressed');fire.setPointerCapture(event.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])fire.addEventListener(event,()=>{firePointer=false;fire.classList.remove('pressed');});$('touch-dash').addEventListener('pointerdown',()=>engine.setInput({dash:true}));
window.addEventListener('resize',()=>scene?.resize());
const api={getState:engine.getState,step(seconds){engine.step(seconds);sync(true);return engine.getState();},startStage(id){start(id);return engine.getState();},pause(value){resetControls();engine.pause(value);sync(true);},retry(){resetControls();applyDifficulty();engine.retry();sync(true);return engine.getState();},reset(){resetControls();engine.reset();sync(true);return engine.getState();},continue(){const result=engine.continue();sync(true);return result;},nextStage(){applyDifficulty();const result=engine.nextStage();sync(true);return result;},setInput:engine.setInput,defeatEnemy(id){const result=engine.defeatEnemy(id);sync(true);return result;},damagePlayer(amount){const result=engine.damagePlayer(amount);sync(true);return result;},setAutoStep(value){autoStep=!!value;resetControls();},setDifficulty(id){$('difficulty').value=id;return engine.setDifficulty(id);}};
window.__encounters=api;window.__encountersReady=false;window.__encounterStats={ready:false};renderCards();sync(true);
async function init(){
 scene=await createBattleScene({canvas,onError:fail,onLoaded:()=>sync(true),reducedMotion:$('reduced-motion').checked});scene.resize();sync(true);window.__encountersReady=true;
 function frame(now){const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
  const renderStats=scene.getStats(),modelsReady=renderStats.ready&&renderStats.loading===0;
  if(autoStep&&modelsReady){const mx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stickMove.x,mz=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+stickMove.z;engine.setInput({moveX:mx,moveZ:mz,fire:firePointer||keys.has('KeyJ'),autoAim:$('auto-aim').checked});engine.update(dt);}
  sync(false,engine.snapshot().paused?0:dt);requestAnimationFrame(frame);
 }requestAnimationFrame(frame);
}
init().catch(fail);
