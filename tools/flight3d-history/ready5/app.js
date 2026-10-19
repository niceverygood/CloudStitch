import {createFlightState,stepFlight,setCombatEnabled} from './sim.mjs';
import {createFlightRenderer} from './renderer.js';

const $=id=>document.getElementById(id),scene=$('scene'),keys=new Set(),touchMoves=new Map();
let state=createFlightState(),renderer=null,ready=false,started=false,failed=false,gesture=null,pointer=null,clickShotPending=false,fireHeld=false,boostHeld=false,upHeld=false,downHeld=false;
let previous=performance.now(),accumulator=0,lastUI=0,lastEvent=0;
state.paused=true;scene.tabIndex=0;
function centerAim(){pointer=null;$('crosshair').style.left='50%';$('crosshair').style.top='50%';}
function pointAim(x,y){pointer={x,y};const b=scene.getBoundingClientRect();$('crosshair').style.left=`${x-b.left}px`;$('crosshair').style.top=`${y-b.top}px`;}
function cancelGrab(){const active=gesture;gesture=null;clickShotPending=false;scene.classList.remove('is-grabbing');renderer?.endLook();centerAim();if(active&&scene.hasPointerCapture(active.id))scene.releasePointerCapture(active.id);}
function clearInput(){keys.clear();touchMoves.clear();fireHeld=boostHeld=upHeld=downHeld=false;cancelGrab();}
function pause(value){if(!ready||!started||(!value&&state.player.hp<=0))return;clearInput();state.paused=!!value;accumulator=0;previous=performance.now();$('pause-screen').hidden=!value;$('pause-button').setAttribute('aria-label',value?'항해 계속하기':'일시정지');$('pause-button').textContent=value?'▷':'Ⅱ';if(!value)scene.focus({preventScroll:true});}
function start(){if(!ready||failed)return;started=true;$('start-screen').hidden=true;pause(false);scene.focus({preventScroll:true});}
function reset(){clearInput();state=createFlightState({combatEnabled:state.combatEnabled});state.paused=!started;lastEvent=0;accumulator=0;renderer?.resetCamera();$('pause-screen').hidden=true;$('pause-screen').querySelector('h2').textContent='바람이 기다리고 있어요.';$('resume-button').textContent='비행 계속하기';$('status-text').textContent='새 비행을 시작합니다. Q로 올라가 보세요.';if(started)pause(false);updateUI();}
function fail(error){failed=true;state.paused=true;clearInput();$('loading').hidden=false;$('start-screen').hidden=true;$('pause-screen').hidden=true;$('load-message').textContent=`비행 공간을 불러오지 못했습니다. ${error.message}`;$('retry-load').hidden=false;console.error(error);}
function held(id,set){const button=$(id),release=e=>{set(false);button.classList.remove('holding');if(e?.pointerId!==undefined&&button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);};button.addEventListener('pointerdown',e=>{e.preventDefault();if(state.paused)return;button.setPointerCapture(e.pointerId);set(true);button.classList.add('holding');});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);}
function input(){
 let x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
 let z=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
 let y=Number(keys.has('KeyQ')||upHeld)-Number(keys.has('KeyE')||downHeld);
 for(const direction of touchMoves.values()){if(direction==='forward')z--;if(direction==='back')z++;if(direction==='left')x--;if(direction==='right')x++;}
 const aim=renderer.aimAt(pointer?.x,pointer?.y,state);
 const clickFire=clickShotPending;clickShotPending=false;
 return{helm:{throttle:-z,turn:-x,rise:y,brake:keys.has('Space')},aim,fire:clickFire||fireHeld||keys.has('KeyJ'),boost:boostHeld||keys.has('ShiftLeft')||keys.has('ShiftRight')};
}
function bind(){
 $('start-button').addEventListener('click',start);$('resume-button').addEventListener('click',()=>{if(state.player.hp<=0){reset();return;}pause(false);scene.focus({preventScroll:true});});
 $('pause-button').addEventListener('click',()=>pause(!state.paused));$('reset-button').addEventListener('click',reset);$('retry-load').addEventListener('click',()=>location.reload());
 $('camera-button').addEventListener('click',()=>{clearInput();renderer.resetCamera();if(started)scene.focus({preventScroll:true});});
 $('test-mode-button').addEventListener('click',()=>{setCombatEnabled(state,!state.combatEnabled);$('test-mode-button').setAttribute('aria-pressed',String(state.combatEnabled));$('test-mode-button').textContent=state.combatEnabled?'적 공격 켬':'적 공격 끔';if(started)scene.focus({preventScroll:true});});
 $('help-button').addEventListener('click',()=>{const show=$('help-panel').hidden;$('help-panel').hidden=!show;$('help-button').setAttribute('aria-expanded',String(show));if(started)scene.focus({preventScroll:true});});
 $('environment-button').addEventListener('click',()=>{const rich=!renderer.environmentRich;renderer.setEnvironmentRich(rich);$('environment-button').setAttribute('aria-pressed',String(rich));$('environment-button').textContent=rich?'풍경 · 풍성하게':'풍경 · 간결하게';if(started)scene.focus({preventScroll:true});});
 held('fire-button',v=>fireHeld=v);held('boost-button',v=>boostHeld=v);held('up-button',v=>upHeld=v);held('down-button',v=>downHeld=v);
 document.querySelectorAll('[data-move]').forEach(button=>{button.addEventListener('pointerdown',e=>{e.preventDefault();if(state.paused)return;button.setPointerCapture(e.pointerId);touchMoves.set(e.pointerId,button.dataset.move);});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>touchMoves.delete(e.pointerId));});
 scene.addEventListener('contextmenu',e=>e.preventDefault());scene.addEventListener('wheel',e=>{e.preventDefault();renderer.zoom(e.deltaY*.015);},{passive:false});
 scene.addEventListener('pointerdown',e=>{
  if(!ready||state.paused||gesture||![0,1,2].includes(e.button))return;
  e.preventDefault();scene.focus({preventScroll:true});scene.setPointerCapture(e.pointerId);
  const pending=e.button===0&&e.pointerType!=='touch';
  gesture={id:e.pointerId,kind:e.pointerType,mask:e.button===1?4:e.button===2?2:1,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,mode:pending?'pending':'orbit'};
  scene.classList.add('is-grabbing');
  if(pending)pointAim(e.clientX,e.clientY);else{renderer.beginLook();centerAim();}
 });
 scene.addEventListener('pointermove',e=>{
  if(!ready||state.paused)return;
  if(gesture){
   if(e.pointerId!==gesture.id)return;
   if(gesture.kind==='mouse'&&!(e.buttons&gesture.mask)){cancelGrab();return;}
   if(gesture.mode==='pending'){
    if(Math.hypot(e.clientX-gesture.startX,e.clientY-gesture.startY)<6)return;
    gesture.mode='orbit';renderer.beginLook();centerAim();
   }
   renderer.orbit(e.clientX-gesture.x,e.clientY-gesture.y);gesture.x=e.clientX;gesture.y=e.clientY;e.preventDefault();
  }else if(e.pointerType!=='touch')pointAim(e.clientX,e.clientY);
 });
 scene.addEventListener('pointerup',e=>{
  if(!gesture||gesture.id!==e.pointerId)return;
  const active=gesture;gesture=null;scene.classList.remove('is-grabbing');
  if(active.mode==='pending'&&e.button===0&&Math.hypot(e.clientX-active.startX,e.clientY-active.startY)<6&&!state.paused){pointAim(e.clientX,e.clientY);clickShotPending=true;}
  else{renderer.endLook();centerAim();}
  if(scene.hasPointerCapture(e.pointerId))scene.releasePointerCapture(e.pointerId);
 });
 for(const type of ['pointercancel','lostpointercapture'])scene.addEventListener(type,e=>{if(gesture?.id===e.pointerId)cancelGrab();});
 window.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.code==='Escape'&&!e.repeat){e.preventDefault();pause(!state.paused);return;}if(!started||state.paused)return;if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyJ','Space','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){if(e.target.closest('button')&&e.code==='Space')return;if(e.repeat&&!keys.has(e.code))return;e.preventDefault();keys.add(e.code);}});
 window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{clearInput();if(started)pause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)pause(true);});
 window.addEventListener('pagehide',()=>{clearInput();state.paused=true;renderer?.dispose();},{once:true});
}
function map(){const canvas=$('map'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,scale=Math.min(w,h)/240,point=p=>[w/2+p.x*scale,h/2+p.z*scale];ctx.clearRect(0,0,w,h);ctx.fillStyle='#e1e8d5';ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='#bccbb577';ctx.lineWidth=1;for(let n=1;n<4;n++){ctx.beginPath();ctx.moveTo(w*n/4,0);ctx.lineTo(w*n/4,h);ctx.moveTo(0,h*n/4);ctx.lineTo(w,h*n/4);ctx.stroke();}
 ctx.strokeStyle='#aa9c7399';ctx.setLineDash([3,4]);ctx.beginPath();state.gates.forEach((g,i)=>{const p=point(g);i?ctx.lineTo(...p):ctx.moveTo(...p);});ctx.stroke();ctx.setLineDash([]);
 for(const g of state.gates){const p=point(g);ctx.beginPath();ctx.strokeStyle=g.passed?'#87aa8a':'#b8954b';ctx.arc(...p,3,0,Math.PI*2);ctx.stroke();}
 for(const t of state.targets){if(t.defeated)continue;const p=point(t);ctx.fillStyle='#bd755b';ctx.fillRect(p[0]-2,p[1]-2,4,4);}
 const p=point(state.player);ctx.fillStyle='#2f7366';ctx.beginPath();ctx.arc(...p,3.5,0,Math.PI*2);ctx.fill();}
function updateUI(){const p=state.player,gate=state.gates[state.routeIndex],remaining=state.targets.filter(t=>!t.defeated).length;
 $('altitude-text').textContent=`${p.y>=0?'+':''}${p.y.toFixed(1)}`;$('speed-text').textContent=Math.hypot(p.vx,p.vy,p.vz).toFixed(1);$('hull-text').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;$('boost-fill').style.width=`${p.boost}%`;$('hull-fill').style.width=`${Math.max(0,p.hp/p.maxHp*100)}%`;
 $('progress-text').textContent=`${state.routeIndex} / ${state.gates.length}`;$('target-count').textContent=`${state.stats.kills} / ${state.targets.length}`;$('score-text').textContent=String(state.score??state.stats.checkpoints*100+state.stats.kills*75);
 if(p.hp<=0){$('objective-text').textContent='이번 비행을 마쳤어요';$('objective-detail').textContent='다시 시작해 다른 고도에서 접근해 보세요.';}
 else if(gate){const delta=gate.y-p.y;$('objective-text').textContent=`${state.routeIndex+1} · ${gate.label}`;$('objective-detail').textContent=`고도 ${gate.y>0?'+':''}${gate.y} · ${delta>1?'Q로 '+delta.toFixed(0)+'만큼 상승':delta< -1?'E로 '+(-delta).toFixed(0)+'만큼 하강':'높이가 맞아요. 고리 안으로 통과하세요.'}`;}
 else{$('objective-text').textContent='입체 항로 완주';$('objective-detail').textContent=`자유롭게 더 날아보세요. ${remaining?`남은 표적 ${remaining}척`:'모든 표적 격파'} · ↻ 다시 시작` ;}
 const nearest=state.targets.filter(t=>!t.defeated).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y,a.z-p.z)-Math.hypot(b.x-p.x,b.y-p.y,b.z-p.z))[0];
 $('target-hint').textContent=nearest?`가까운 표적 · ${nearest.y>=p.y?'위':'아래'} ${Math.abs(nearest.y-p.y).toFixed(0)} · 거리 ${Math.round(Math.hypot(nearest.x-p.x,nearest.y-p.y,nearest.z-p.z))}`:'표적을 모두 맞혔어요';
 for(const event of state.events){if(event.seq<=lastEvent)continue;lastEvent=event.seq;const messages={gate:'고리를 통과했어요. 다음 높이로 이동하세요.','route-complete':'입체 항로를 완주했어요. 자유롭게 비행하거나 다시 시작해 보세요.','target-defeated':'표적 격파. 다른 높이의 표적에도 도전해 보세요.',collision:'섬과 부딪혔어요. 위나 아래로 피할 수 있어요.','player-hit':'피격됐어요. 고도를 바꿔 포격을 피해 보세요.','enemy-warning':'적이 포격을 준비합니다. 고도를 바꿔 보세요.'};if(messages[event.type])$('status-text').textContent=messages[event.type];}
 map();
}
function frame(timestamp){const dt=Math.min(.05,Math.max(0,(timestamp-previous)/1000));previous=timestamp;
 if(ready&&!failed){try{if(started&&!state.paused&&state.player.hp>0&&!document.hidden){accumulator=Math.min(.12,accumulator+dt);while(accumulator>=1/60){stepFlight(state,1/60,input());accumulator-=1/60;}}else accumulator=0;
 renderer.render(state,dt,renderer.aimAt(pointer?.x,pointer?.y,state));
 if(state.player.hp<=0&&!state.paused){pause(true);$('pause-screen').querySelector('h2').textContent='다시 날아볼까요?';$('resume-button').textContent='새 비행 시작';}
 if(timestamp-lastUI>100){updateUI();lastUI=timestamp;}
 }catch(error){fail(error);}}requestAnimationFrame(frame);}
const qa={get state(){return state;},get renderer(){return renderer;},get ready(){return ready;},start,reset,pause,stepFlight,snapshot(){return structuredClone(state);}};window.__flight3d=qa;
async function boot(){try{bind();renderer=createFlightRenderer(scene,$('labels'));await renderer.initialize(state);ready=true;$('loading').hidden=true;$('start-screen').hidden=false;renderer.render(state,0);updateUI();}catch(error){fail(error);}}
boot();requestAnimationFrame(frame);
