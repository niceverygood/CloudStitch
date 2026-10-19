import {createAudioEngine} from './runtime.mjs';
import {createAudioAdapter} from './adapter.mjs';
import {mountAudioPanel} from './panel.mjs';
const $=id=>document.getElementById(id),keys=new Set(),cueLog=[];
let storage;try{storage=localStorage;}catch{}
const audio=createAudioEngine({storage});let controller=null,busy=false,disposed=false,last=performance.now(),accumulator=0,aim=null,lastSignature='';
const bridge=createAudioAdapter({audio,onCue(cue){cueLog.push(JSON.stringify(cue));if(cueLog.length>8)cueLog.shift();$('cue-log').textContent=cueLog.join('\n');}});
const panel=mountAudioPanel($('audio-panel'),audio);
const ctx=$('map').getContext('2d');
const context=()=>({voyageId:controller?.snapshot().voyageId,generation:controller?.battlefield?.generation,camera:{position:[0,55,38.51],target:[0,0,0]}});
function observe(){const snapshot=controller.snapshot(),meta=context();bridge.update(snapshot,meta);bridge.consume(snapshot.sim?.events||[],snapshot,meta);return snapshot;}
async function command(type,payload={}){
  if(!controller||busy)return;busy=true;
  try{const result=await controller.command(type,payload),snapshot=controller.snapshot();bridge.commandResult(type,result,snapshot,context());observe();$('load-status').textContent=result.ok?snapshot.status:result.reason||'명령 실패';}
  finally{busy=false;keys.clear();accumulator=0;last=performance.now();}
}
for(const [type,label] of [['depart','출항'],['pause','일시정지'],['resume','계속'],['salvage','가까운 묶음 회수'],['return','귀환'],['retry','재시도'],['maintenance','정비 완료'],['store','화물 보관'],['repair','수리'],['save','저장'],['restore','복원']]){const b=document.createElement('button');b.textContent=label;b.type='button';b.addEventListener('click',()=>command(type));$('commands').append(b);}
$('equip').addEventListener('click',()=>command('equip',{partId:$('part').value,slotId:$('slot').value}));
const xy=(x,z)=>({x:360+x*3,y:280+z*3});
function draw(s){
  ctx.clearRect(0,0,720,560);ctx.strokeStyle='#c3d1bc';ctx.lineWidth=1;for(let i=0;i<=720;i+=60){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,560);ctx.stroke();}for(let i=0;i<=560;i+=60){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(720,i);ctx.stroke();}
  const sim=s.sim,player=sim?.player||{x:0,z:48};
  const circle=(o,r,color)=>{const p=xy(o.x,o.z);ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,r*3,0,Math.PI*2);ctx.fill();};
  for(const o of sim?.obstacles||[])circle(o,o.radius,'#9ba88a');
  if(sim?.harbor){const p=xy(sim.harbor.x,sim.harbor.z);ctx.strokeStyle='#508873';ctx.beginPath();ctx.arc(p.x,p.y,sim.harbor.radius*3,0,Math.PI*2);ctx.stroke();}
  for(const enemy of sim?.enemies||[])if(!enemy.defeated){circle(enemy,2.4,enemy.telegraph?'#d0835b':'#a46f59');const p=xy(enemy.x,enemy.z);ctx.fillStyle='#5d5141';ctx.font='11px sans-serif';ctx.fillText(enemy.name||enemy.id,p.x+9,p.y);}
  for(const b of sim?.debris||[])if(!b.salvaged&&!b.lost)circle(b,1.1,'#b09a5b');
  for(const shot of sim?.projectiles||[])circle(shot,.4,shot.owner==='player'?'#326b5b':'#d6864d');
  circle(player,3,'#447b6b');const p=xy(player.x,player.z);ctx.strokeStyle='#fdf9db';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.sin(player.angle||0)*13,p.y+Math.cos(player.angle||0)*13);ctx.stroke();
  const danger=player.weight>player.lift;$('visual-warning').textContent=danger?'양력 부족 · 화물 투하/회복 필요':s.phase==='defeat'?'항해 실패 · 재시도 가능':s.paused?'항해 일시정지':(sim?.enemies||[]).some(e=>e.telegraph)?'적 공격 예고 · 피할 공간을 확인하세요.':'시각 경고 유지 · 소리 없이도 입력과 상태 확인 가능';
  $('readout').textContent=`${s.phase} / ${s.stage?.phase||'항구'}\n항해 ${s.voyageId||'아직 없음'}\ngeneration ${controller.battlefield?.generation??'—'}\nHP ${Math.round(player.hp||0)} · 화물 ${sim?.cargo?.length||0}\n${s.status}\n${JSON.stringify(audio.debug().counts)}`;
  const parts=(s.harbor?.inventory||[]).filter(p=>p.canEquip),slots=s.harbor?.slots||[],signature=parts.map(p=>p.id).join('|')+slots.map(p=>p.id).join('|');
  if(signature!==lastSignature){lastSignature=signature;for(const [id,list] of [['part',parts],['slot',slots]]){$(id).replaceChildren();for(const item of list){const o=document.createElement('option');o.value=item.id;o.textContent=item.label||item.id;$(id).append(o);}}}
  panel.update();
}
function frame(t){
  if(disposed)return;const dt=Math.min(Math.max((t-last)/1000,0),.1);last=t;
  if(controller&&!document.hidden&&!busy){
    accumulator+=dt;for(let i=0;accumulator>=1/60&&i<6;i++,accumulator-=1/60){
      const s=controller.snapshot(),p=s.sim?.player;let target=aim;
      if(!target&&p){const enemies=(s.sim.enemies||[]).filter(e=>!e.defeated);target=enemies.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];}
      controller.advance(1/60,{moveX:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),moveZ:(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0),aimX:target?.x??0,aimZ:target?.z??-40,fire:keys.has('KeyJ'),boost:keys.has('Space')});observe();
    }draw(controller.snapshot());
  }requestAnimationFrame(frame);
}
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(['KeyW','KeyA','KeyS','KeyD','KeyJ','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}});document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
$('map').addEventListener('pointerdown',e=>{const r=$('map').getBoundingClientRect();aim={x:((e.clientX-r.left)*720/r.width-360)/3,z:((e.clientY-r.top)*560/r.height-280)/3};$('map').focus();});
document.addEventListener('visibilitychange',()=>{keys.clear();accumulator=0;last=performance.now();bridge.setHidden(document.hidden);if(controller)observe();});
window.addEventListener('pagehide',()=>{disposed=true;keys.clear();bridge.dispose();panel.dispose();void audio.dispose();},{once:true});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
try{const {createVoyageController}=await import('/integration-source/tools/integration/session.mjs');controller=await createVoyageController();$('load-status').textContent='동결 controller 읽기 연결 완료 · 출항 후 WASD/J로 실제 입력';observe();draw(controller.snapshot());requestAnimationFrame(frame);}catch(error){$('load-status').textContent='controller mount 없음: serve.mjs --integration-root <통합 루트>로 실행하세요. 독립 소리 작업대는 그대로 사용할 수 있습니다. '+error.message;}
window.__audioHost={audio,bridge,get controller(){return controller;},command};
