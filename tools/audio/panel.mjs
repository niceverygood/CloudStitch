/** Shared audio controls; labels stay visible when muted or audio is blocked. */
export function mountAudioPanel(container,audio,{afterChange=()=>{}}={}){
  container.innerHTML=`<div class="audio-top"><button type="button" data-unlock>소리 켜기</button><strong data-state role="status" aria-live="polite">소리 잠김 · 첫 클릭/키 입력으로 활성화</strong></div><div class="mix-grid"></div><div class="audio-toggles"></div><p data-warning class="muted-text"></p>`;
  for(const [id,label] of [['master','전체'],['sfx','효과'],['ambience','환경']]){
    const el=document.createElement('label');el.innerHTML=`${label} <output></output><input aria-label="${label} 볼륨" type="range" min="0" max="100" step="1" value="${Math.round(audio.settings()[id]*100)}">`;
    const input=el.querySelector('input'),output=el.querySelector('output');output.value=input.value+'%';
    input.addEventListener('input',()=>{output.value=input.value+'%';audio.setSettings({[id]:Number(input.value)/100});afterChange();update();});container.querySelector('.mix-grid').append(el);
  }
  for(const [id,label] of [['muted','음소거'],['mono','모노'],['lowDynamicRange','작은 음량 차이']]){
    const el=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=audio.settings()[id];el.append(input,document.createTextNode(label));input.addEventListener('change',()=>{audio.setSettings({[id]:input.checked});afterChange();update();});container.querySelector('.audio-toggles').append(el);
  }
  async function unlock(){await audio.unlock();afterChange();update();}
  container.querySelector('[data-unlock]').addEventListener('click',unlock);
  function gesture(){if(audio.debug().locked)void unlock();}
  document.addEventListener('pointerdown',gesture);document.addEventListener('keydown',gesture);
  function update(){const state=audio.debug();container.querySelector('[data-state]').textContent=state.disposed?'오디오 종료':state.muted?'음소거':state.locked?'소리 잠김 · 소리 켜기를 누르세요':state.paused?'소리 일시정지':'소리 활성 · '+state.activeVoices+'개 발음';container.querySelector('[data-warning]').textContent=state.unlockError||state.storageError||'위험·조작·피격 cue는 최대 3개. 소리를 꺼도 화면 경고를 유지합니다.';}
  update();return {update,dispose(){document.removeEventListener('pointerdown',gesture);document.removeEventListener('keydown',gesture);container.replaceChildren();}};
}
