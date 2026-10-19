const $=id=>document.getElementById(id),key='cloudstitch:mortar-r1:feedback';
let context=null,voice=null,epoch=0,disposed=false,catalog,feedback={choice:'hold',note:''};
const cache=new Map();
function status(message){$('status').textContent=message;}
function stop(){epoch++;if(voice){const current=voice;voice=null;try{const t=context.currentTime;current.gain.gain.cancelScheduledValues(t);current.gain.gain.setTargetAtTime(0,t,.003);current.source.stop(t+.02);}catch{} }status('소리를 정지했습니다.');}
function save(){feedback.note=$('note').value;try{localStorage.setItem(key,JSON.stringify(feedback));$('saved').textContent='이 브라우저에 저장됨';}catch{$('saved').textContent='로컬 저장 제한 · JSON으로 저장하세요.';}}
async function play(asset){
  stop();const currentEpoch=epoch;
  try{
    if(disposed||document.hidden)return;
    context??=new (globalThis.AudioContext||globalThis.webkitAudioContext)();await context.resume();
    if(currentEpoch!==epoch||disposed||document.hidden)return;
    if(!cache.has(asset.id))cache.set(asset.id,(async()=>{const r=await fetch(asset.file);if(!r.ok)throw new Error('음원 파일을 읽지 못했습니다.');return context.decodeAudioData(await r.arrayBuffer());})());
    const raw=await cache.get(asset.id);if(currentEpoch!==epoch||disposed||document.hidden)return;
    const channels=$('mono').checked?1:raw.numberOfChannels,buffer=context.createBuffer(channels,raw.length,raw.sampleRate);let peak=0;
    for(let c=0;c<channels;c++){const out=buffer.getChannelData(c);if(channels===1&&raw.numberOfChannels>1){for(let from=0;from<raw.numberOfChannels;from++){const input=raw.getChannelData(from);for(let i=0;i<out.length;i++)out[i]+=input[i]/raw.numberOfChannels;}}else out.set(raw.getChannelData(c));for(const sample of out){if(!Number.isFinite(sample))throw new Error('유효하지 않은 오디오입니다.');peak=Math.max(peak,Math.abs(sample));}}
    if(peak<.00001)throw new Error('무음에 가까운 후보입니다.');
    for(let c=0;c<channels;c++){const out=buffer.getChannelData(c);for(let i=0;i<out.length;i++)out[i]*=.7/peak;}
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.connect(gain);gain.connect(context.destination);
    const t=context.currentTime,volume=Number($('volume').value)/100;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.002);gain.gain.setValueAtTime(volume,t+buffer.duration-.012);gain.gain.linearRampToValueAtTime(0,t+buffer.duration);
    const active={source,gain};voice=active;source.onended=()=>{source.disconnect();gain.disconnect();if(voice===active){voice=null;status(asset.label+' · 재생 완료');}};source.start();status(asset.label+' · 재생 중');
  }catch(error){status(error.message);cache.delete(asset.id);}
}
$('stop').addEventListener('click',stop);$('mono').addEventListener('change',stop);$('volume').addEventListener('input',()=>{$('volume-label').value=$('volume').value+'%';if(voice)voice.gain.gain.setTargetAtTime(Number($('volume').value)/100,context.currentTime,.01);});
$('note').addEventListener('input',save);$('export').addEventListener('click',()=>{save();const blob=new Blob([JSON.stringify({schema:'cloudstitch-mortar-review-r1',...feedback,candidateHashes:Object.fromEntries(catalog.assets.map(a=>[a.id,a.sha256]))},null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='Cloudstitch-mortar-r1-review.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',()=>{stop();disposed=true;cache.clear();void context?.close();});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
try{
  catalog=await(await fetch('catalog.json')).json();
  try{const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored&&['mortar-launch-a','mortar-launch-b','hold'].includes(stored.choice)&&typeof stored.note==='string'&&stored.note.length<=2000)feedback=stored;}catch{}
  $('note').value=feedback.note;
  for(const asset of catalog.assets){const card=document.createElement('article');card.className='card'+(asset.old?' old':'');const tag=document.createElement('span');tag.className='tag';tag.textContent=asset.old?'PREVIOUS · 수정 요청':'NEW CANDIDATE · 검수 전';const title=document.createElement('h2');title.textContent=asset.label;const desc=document.createElement('p');desc.textContent=asset.description;const button=document.createElement('button');button.type='button';button.className=asset.old?'':'primary';button.textContent=asset.old?'기존 소리 듣기':'새 후보 듣기';button.addEventListener('click',()=>void play(asset));const download=document.createElement('a');download.href=asset.file;download.download=asset.id+'.mp3';download.textContent='MP3 원본 다운로드';const meta=document.createElement('div');meta.className='meta';meta.textContent=`요청 ${asset.duration}초 · ${asset.bytes.toLocaleString('ko-KR')} bytes`;const details=document.createElement('details'),summary=document.createElement('summary'),prompt=document.createElement('p');summary.textContent='생성 문안 보기';prompt.textContent=asset.prompt;details.append(summary,prompt);card.append(tag,title,desc,button,download,meta,details);$('sounds').append(card);}
  for(const [value,label] of [['mortar-launch-a','A가 더 가까움'],['mortar-launch-b','B가 더 가까움'],['hold','둘 다 보류']]){const wrap=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name='choice';radio.value=value;radio.checked=feedback.choice===value;radio.addEventListener('change',()=>{feedback.choice=value;save();});wrap.append(radio,document.createTextNode(label));$('choices').append(wrap);}
}catch(error){status('비교 화면을 준비하지 못했습니다: '+error.message);}
