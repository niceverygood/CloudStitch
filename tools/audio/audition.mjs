import {SOUND_DEFINITIONS} from './synthesis.mjs';
import {createAudioEngine} from './runtime.mjs';
import {mountAudioPanel} from './panel.mjs';
let storage;try{storage=localStorage;}catch{}
const audio=createAudioEngine({storage}),activeLoops=new Set(),records=[];
let paused=false,hidden=document.hidden,serial=0;
const $=id=>document.getElementById(id);
const panel=mountAudioPanel($('audio-panel'),audio,{afterChange(){if(audio.settings().muted)activeLoops.clear();refresh();}});
const mainIds=['fire-machinegun','fire-cannon','hit-wood','hit-cloth','connector-cut','salvage'];
function log(id,message){const def=SOUND_DEFINITIONS.find(s=>s.id===id);$('visual-cue').textContent=message||def?.label||id;records.push(`${new Date().toLocaleTimeString('ko-KR')}  ${message||def?.label||id}`);if(records.length>40)records.shift();$('log').textContent=records.slice(-8).join('\n');}
function refresh(){for(const button of document.querySelectorAll('[data-sound]')){const def=SOUND_DEFINITIONS.find(s=>s.id===button.dataset.sound);button.textContent=def.loop?(activeLoops.has(def.id)?'반복 멈추기':'반복 듣기'):'들어보기';button.setAttribute('aria-pressed',String(def.loop&&activeLoops.has(def.id)));}panel.update();}
for(const [index,def] of SOUND_DEFINITIONS.entries()){
  const card=document.createElement('article');card.className='sound';
  const material=document.createElement('span');material.className='material';
  const num=document.createElement('span');num.className='index';num.textContent=String(index+1).padStart(2,'0')+' / '+def.id;
  const name=document.createElement('h3');name.textContent=def.label;
  const text=document.createElement('p');text.textContent=def.description;
  const length=document.createElement('small');length.textContent=`${def.duration.toFixed(2)}초 · ${def.loop?'반복 환경음':'단발 cue'} · 임시 합성`;
  const footer=document.createElement('footer'),button=document.createElement('button'),download=document.createElement('a');button.type='button';button.dataset.sound=def.id;button.textContent=def.loop?'반복 듣기':'들어보기';button.setAttribute('aria-label',`${def.label} 듣기`);download.href=`previews/${def.id}.wav`;download.download=`${def.id}.wav`;download.textContent='WAV ↓';
  button.addEventListener('click',async()=>{
    await audio.unlock();if(paused||hidden){log(def.id,'청취 일시정지 중 · 재개한 뒤 다시 누르세요.');return;}
    let played;
    if(def.loop){const active=!activeLoops.has(def.id);played=audio.setLoop(def.id,active);if(played)activeLoops.add(def.id);else activeLoops.delete(def.id);}
    else played=audio.play(def.id,{variantKey:++serial});
    log(def.id,played?def.label:audio.settings().muted?'음소거 · '+def.label:def.loop?'반복 종료 · '+def.label:'재생 보류 · '+def.label);refresh();
  });footer.append(button,download);card.append(material,num,name,text,length,footer);$(mainIds.includes(def.id)?'representatives':'extended').append(card);
}
$('stop').addEventListener('click',()=>{audio.clear('audition-stop');activeLoops.clear();log('stop','모든 소리를 멈췄습니다.');refresh();});
$('pause').addEventListener('click',()=>{paused=!paused;audio.setPaused(paused||hidden);activeLoops.clear();$('pause').textContent=paused?'청취 재개':'청취 일시정지';log('pause',paused?'일시정지 · 예약음과 반복음 정리':'재개 · 소리를 다시 선택하세요.');refresh();});
$('overlap').addEventListener('click',async()=>{await audio.unlock();for(const id of ['lift-warning','hit-wood','fire-machinegun'])audio.play(id,{variantKey:++serial});log('overlap','청취 비교: 천 장력 위험 + 목재 피격 + 기관총 (실제 전투와 별도)');refresh();});
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;audio.setPaused(paused||hidden);activeLoops.clear();refresh();});
window.addEventListener('pagehide',()=>{panel.dispose();void audio.dispose();},{once:true});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
window.__cloudstitchAudio={audio,get recent(){return [...records];}};
setInterval(()=>panel.update(),500);refresh();
