import { createWeatherSession } from './session.mjs';
import { createWeatherRenderer } from './renderer.js';
import { WEATHER_ZONES } from './sim.mjs';

const $=id=>document.getElementById(id),keys=new Set(),touchKeys=new Set();
const notes={
 cloud:{symbol:'☁',subtitle:'시야를 감추는 따뜻한 구름',description:'크림빛 구름 안에서는 적의 조준이 끊깁니다. 구름을 빠져나오면 다시 포착됩니다.'},
 updraft:{symbol:'↟',subtitle:'솟아오르는 나선 바람',description:'나선 안으로 들어가 조작을 놓아보세요. 상승기류가 배를 밀어 올립니다. Q를 누르면 힘을 거슬러 내려갑니다.'},
 crosswind:{symbol:'⇢',subtitle:'바람자루가 가리키는 흐름',description:'횡풍 구역에서는 배가 바람자루 방향으로 밀립니다. W를 눌러 반대 방향으로 버티고 구역 밖의 움직임과 비교하세요.'},
 lightning:{symbol:'ϟ',subtitle:'전조를 읽고 벗어나는 폭풍',description:'붉은 낙뢰 표식이 나타나면 그 자리에서 벗어나세요. 예고 뒤 조준 위치는 고정되며, 명중하면 실제 선체가 손상됩니다.'},
 icing:{symbol:'❋',subtitle:'서리를 녹이는 작은 온기',description:'차가운 구역에 머물면 서리가 쌓이고 조종이 둔해집니다. F를 누르고 예열해 녹이세요. 예열 여력은 쉬는 동안 충전됩니다.'},
 thermal:{symbol:'≋',subtitle:'압력등 사이로 지나는 길',description:'세 분사구가 차례로 압력을 모읍니다. 밝아지는 압력등을 보고 빈 틈이나 높은 고도로 우회하세요. 열풍 안에서는 실제 피해를 받습니다.'}
};
const eventsKo={'conceal-enter':'구름 속 은폐 · 적 조준 해제','conceal-exit':'구름을 벗어났습니다','lightning-warning':'낙뢰 전조 · 표시된 위치에서 벗어나세요','lightning-strike':'낙뢰가 떨어졌습니다','thermal-warning':'열풍 압력이 차오릅니다','thermal-burst':'열풍 분사 · 빈 틈으로 피하세요','weather-hit':'기상 피해','environment-hit':'기상 피해','player-hit':'선체 피격','defeat':'선체 파손 · 수리가 필요합니다'};
let session,view,selectedId=null,frozen=false,previousTime=0,lastEventKey='',visited=new Set(),disposed=false,ready=false;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
window.__weatherReady=false;
function axis(positive,negative){return Number(keys.has(positive)||touchKeys.has(positive))-Number(keys.has(negative)||touchKeys.has(negative));}
function input(){return{moveX:axis('KeyD','KeyA'),moveZ:axis('KeyS','KeyW'),lift:axis('KeyE','KeyQ'),moveY:axis('KeyE','KeyQ'),preheat:keys.has('KeyF')||touchKeys.has('KeyF')};}
function clearKeys(){keys.clear();touchKeys.clear();$('preheat').setAttribute('aria-pressed','false');}
function setPaused(value){clearKeys();session.pause(value);$('pause').setAttribute('aria-pressed',String(value));$('pause').textContent=value?'재개':'일시정지';renderNow();}
function renderNow(){if(!view||!session)return;view.update(session.state,0);updateUI();}
function warp(id,options={}){clearKeys();session.warp(id,options);selectedId=id;const z=WEATHER_ZONES.find(z=>z.id===id);$('place').textContent=z.label;$('active-title').textContent=z.label;$('active-description').textContent=notes[id].description;for(const b of document.querySelectorAll('[data-zone]'))b.setAttribute('aria-pressed',String(b.dataset.zone===id));view.setView('station',id);$('overview').setAttribute('aria-pressed','false');$('follow').setAttribute('aria-pressed','false');renderNow();return session.state;}
function reset(){clearKeys();session.reset();selectedId=null;visited.clear();lastEventKey='';$('event-log').replaceChildren();$('active-title').textContent='하늘의 여섯 규칙';$('active-description').textContent='아래 카드를 선택하면 해당 구역의 접근 지점으로 이동합니다. 배를 직접 움직여 효과를 확인하세요.';$('place').textContent='여섯 개의 하늘';$('pause').setAttribute('aria-pressed','false');$('pause').textContent='일시정지';view.setView('overview');for(const b of document.querySelectorAll('[data-zone]'))b.setAttribute('aria-pressed','false');renderNow();}
function setMode(mode){view.setMode(mode);document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));renderNow();}
function setExpression(expression){view.setExpression(expression);document.querySelectorAll('[data-expression]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.expression===expression)));renderNow();}
function updateUI(){
 const s=session.state,p=s.player,weather=s.weather||{},ice=Math.round((p.icing||0)*100),heat=Math.round(p.heat??100),hp=Math.max(0,Math.round(p.hp));
 $('hp').value=hp;$('hp-value').textContent=hp;$('ice').value=ice;$('ice-value').textContent=ice+'%';$('heat').value=heat;$('heat-value').textContent=heat+'%';$('altitude').textContent=(p.y??8).toFixed(1);
 $('lock').textContent=p.hidden?'놓침':(p.lock??1)<1?'재포착 중':'포착 중';
 const wind=s.sample?.wind||s.environment?.wind||{x:0,y:0,z:0};$('wind').textContent=Math.hypot(wind.x||0,wind.y||0,wind.z||0).toFixed(1);
 const active=WEATHER_ZONES.filter(z=>weather[z.id]?.inside);for(const z of active)visited.add(z.id);$('checked-count').textContent=visited.size+' / 6 경험';for(const b of document.querySelectorAll('[data-zone]'))b.querySelector('.check').textContent=visited.has(b.dataset.zone)?'✓':'';
 $('weather-status').textContent=active.length?active.map(z=>z.label).join(' · '):'맑음';
 const l=weather.lightning,t=weather.thermal;let callout='WASD로 이동 · Q/E로 하강/상승 · F를 누르고 예열';
 if(p.hidden)callout='구름 속 은폐 · 적이 배를 놓쳤습니다.';
 if(weather.updraft?.inside)callout='상승기류 · 바람이 배를 들어 올립니다.';
 if(weather.crosswind?.inside)callout='횡풍 · 바람자루 방향으로 배가 밀립니다.';
 if(weather.icing?.inside||ice>10)callout=p.preheating?'예열 중 · 서리가 녹고 있습니다.':'착빙 '+ice+'% · F를 누르고 예열하세요.';
 if(l?.phase==='warning'&&(selectedId==='lightning'||weather.lightning?.inside))callout='낙뢰까지 '+l.remaining.toFixed(1)+'초 · 붉은 표식에서 벗어나세요.';
 if(t?.phase==='warning'&&(selectedId==='thermal'||weather.thermal?.inside))callout='열풍까지 '+t.remaining.toFixed(1)+'초 · '+(t.jetIndex+1)+'번 압력등을 확인하세요.';
 if(t?.phase==='burst'&&(selectedId==='thermal'||weather.thermal?.inside))callout='열풍 분사 중 · 빈 틈이나 고도 14 이상으로 피하세요.';
 $('state-callout').textContent=callout;$('clock').textContent=String(Math.floor(s.time/60)).padStart(2,'0')+':'+String(Math.floor(s.time%60)).padStart(2,'0');
 $('paused-overlay').hidden=!s.paused||hp<=0;$('defeat-overlay').hidden=hp>0;$('preheat').setAttribute('aria-pressed',String(Boolean(p.preheating)));
 const events=s.events||[],event=events.at(-1),key=event?(s.generation??1)+':'+(event.seq??event.id)+':'+event.type:'';
 if(event&&key!==lastEventKey){lastEventKey=key;const label=eventsKo[event.type];if(label){const li=document.createElement('li');li.textContent=Math.floor(s.time)+'s · '+label+(event.damage?' −'+event.damage:'');$('event-log').prepend(li);while($('event-log').children.length>10)$('event-log').lastChild.remove();}}
}
function bind(){
 for(const [i,z]of WEATHER_ZONES.entries()){const b=document.createElement('button');b.className='station-card';b.dataset.zone=z.id;b.setAttribute('aria-pressed','false');b.innerHTML='<span class="number">'+String(i+1).padStart(2,'0')+'</span><span class="check"></span><span class="symbol" aria-hidden="true">'+notes[z.id].symbol+'</span><strong>'+z.label+'</strong><small>'+notes[z.id].subtitle+'</small>';b.addEventListener('click',()=>warp(z.id));$('station-cards').append(b);}
 $('pause').addEventListener('click',()=>setPaused(!session.state.paused));$('resume').addEventListener('click',()=>setPaused(false));$('reset').addEventListener('click',reset);$('retry').addEventListener('click',reset);
 $('overview').addEventListener('click',()=>{view.setView('overview');$('overview').setAttribute('aria-pressed','true');$('follow').setAttribute('aria-pressed','false');});$('follow').addEventListener('click',()=>{view.setView('follow');$('follow').setAttribute('aria-pressed','true');$('overview').setAttribute('aria-pressed','false');});$('fit').addEventListener('click',()=>view.fit());
 $('rotate').addEventListener('click',()=>{const value=$('rotate').getAttribute('aria-pressed')!=='true';view.setAutoRotate(value);$('rotate').setAttribute('aria-pressed',String(value));});
 $('outline').addEventListener('change',()=>{view.setOutline($('outline').checked);renderNow();});for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>setMode(b.dataset.mode));for(const b of document.querySelectorAll('[data-expression]'))b.addEventListener('click',()=>setExpression(b.dataset.expression));
 $('help').addEventListener('click',()=>{const hidden=!$('help-panel').hidden;$('help-panel').hidden=hidden;$('help').setAttribute('aria-expanded',String(!hidden));});
 const controlled=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyF','Space','KeyR']);
 addEventListener('keydown',e=>{if(!controlled.has(e.code)||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;e.preventDefault();if(e.repeat)return;if(e.code==='Space'){setPaused(!session.state.paused);return;}if(e.code==='KeyR'){reset();return;}keys.add(e.code);});addEventListener('keyup',e=>keys.delete(e.code));
 function hold(button,key){button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touchKeys.add(key);});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>touchKeys.delete(key));}
 for(const b of document.querySelectorAll('[data-key]'))hold(b,b.dataset.key);hold($('preheat'),'KeyF');
 addEventListener('blur',()=>{if(ready&&!session.state.paused)setPaused(true);else clearKeys();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready)setPaused(true);});
}
async function main(){session=createWeatherSession();view=await createWeatherRenderer($('stage'),$('world-labels'));bind();if(reduceMotion)setExpression('standard');ready=true;window.__weatherReady=true;$('loading').hidden=true;
 window.__weatherTest={get ready(){return ready;},get state(){return session.state;},session,renderer:view,setPaused,warp,renderNow,setMode,setExpression,freeze(value){frozen=Boolean(value);clearKeys();},get frozen(){return frozen;},reset};
 renderNow();function loop(time){if(disposed)return;requestAnimationFrame(loop);const dt=previousTime?Math.min(Math.max((time-previousTime)/1000,0),.05):0;previousTime=time;if(frozen)return;if(!session.state.paused&&session.state.player.hp>0)session.advance(dt,input());view.update(session.state,session.state.paused?0:dt);updateUI();}requestAnimationFrame(loop);
 addEventListener('beforeunload',()=>{disposed=true;clearKeys();session.dispose();view.dispose();},{once:true});
}
main().catch(e=>{console.error(e);$('loading').textContent='항로를 준비하지 못했습니다. '+e.message;window.__weatherError=e.message;});
