import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DURATION,BRANCHES,eventsFor} from './events.js';
import {createRig} from './rig.js';
import {createAudio,wavBytes} from './audio.js';
const DATA=__ATTACK_DATA__,$=id=>document.getElementById(id),stage=$('stage'),audio=createAudio(DATA.cues),library=new Map();
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(0,0);stage.prepend(renderer.domElement);const effect=new OutlineEffect(renderer);effect.autoClear=true;
const camera=new T.OrthographicCamera(-1.7,1.7,1,-1,.001,100),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;camera.position.set(-2.8,1.7,3.5);controls.target.set(-.55,0,0);camera.lookAt(controls.target);
let branch='mobility',time=0,playing=false,effects=true,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,lastNow=performance.now(),visualMode='painted',outlined=true,half=.95;
const original=new Map(),converted=new Map(),gradient=new T.DataTexture(new Uint8Array([80,170,255]),3,1,T.RedFormat);gradient.minFilter=gradient.magFilter=T.NearestFilter;gradient.needsUpdate=true;
window.__attack={ready:false,error:null};
function makeScene(root){const scene=new T.Scene();scene.add(root,new T.AmbientLight(0xffffff,1.5));const light=new T.DirectionalLight(0xffefd8,1.6);light.position.set(-2,4,3);scene.add(light);return scene;}
function convert(source){if(visualMode==='original')return source;const id=source.uuid+visualMode;if(converted.has(id))return converted.get(id);const props={color:source.color?.clone()||new T.Color(0xffffff),map:source.map||null,vertexColors:source.vertexColors,side:source.side,transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest,toneMapped:false};const m=visualMode==='cel'?new T.MeshToonMaterial({...props,gradientMap:gradient}):new T.MeshBasicMaterial(props);converted.set(id,m);return m;}
function mode(value){visualMode=value;for(const entry of library.values())for(const rig of entry.rigs)rig.body.traverse(n=>{if(!n.isMesh)return;if(!original.has(n))original.set(n,n.material);const m=original.get(n);n.material=Array.isArray(m)?m.map(convert):convert(m);for(const a of Array.isArray(n.material)?n.material:[n.material])a.userData.outlineParameters={thickness:.0010,color:[.04,.065,.055],visible:outlined};});document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===value)));render();}
function panel(){const w=stage.clientWidth,h=stage.clientHeight;return w<650?[w,h/2]:[w/2,h];}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);const [pw,ph]=panel();camera.left=-half*pw/ph;camera.right=half*pw/ph;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}
function fit(){const c=new T.Vector3(-.58,.01,0),d=camera.position.clone().sub(controls.target).normalize();controls.target.copy(c);camera.position.copy(c).addScaledVector(d,4);camera.zoom=1;half=Math.max(.70,1.35/(panel()[0]/panel()[1]));resize();controls.update();render();}
function resetView(){camera.position.set(-2.8,1.7,3.5);controls.target.set(-.58,.01,0);fit();}
function render(){const current=library.get(branch);if(!current)return;current.rigs.forEach(r=>r.apply(time,{effects,reduced}));const w=stage.clientWidth,h=stage.clientHeight,mobile=w<650;renderer.setScissorTest(false);renderer.clear(true,true,true);renderer.setScissorTest(true);for(let i=0;i<2;i++){const box=mobile?[0,i===0?h/2:0,w,h/2]:[i*w/2,0,w/2,h];renderer.setViewport(...box);renderer.setScissor(...box);if(outlined)effect.render(current.scenes[i],camera);else renderer.render(current.scenes[i],camera);}renderer.setScissorTest(false);$('timeline').value=time;$('time').textContent=time.toFixed(2)+' / 6.00초';$('play').textContent=playing?'일시정지':'재생';$('event-state').textContent=eventsFor(branch).filter(e=>e.time<=time).at(-1)?.phase||'기대 동작 전';}
function pause(reason='pause'){playing=false;audio.cancel(reason);render();}
function seek(t){pause('seek');time=T.MathUtils.clamp(Number(t),0,DURATION);render();}
async function play(unlock=false){if(unlock)await audio.unlock();if(time>=DURATION)time=0;playing=true;lastNow=performance.now();audio.schedule(branch,time);render();}
async function fire(){pause('restart');time=0;await play(true);}
function select(id){pause('branch');branch=id;time=0;$('title').textContent=BRANCHES[id].name;document.querySelectorAll('[data-branch]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.branch===id)));resetView();render();}
function stats(){const current=library.get(branch);return{branch,time,playing,effects,reduced,mode:visualMode,oneClock:true,sourceModel:'ship-weapon-harmony-v1 final r2',left:current.rigs[0].stats,right:current.rigs[1].stats,sharedCamera:true,outlineAutoClear:effect.autoClear,audio:audio.stats,resources:{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length||0}};}
async function mix(b,v){const result=await audio.renderMix(b,v),bytes=new Uint8Array(wavBytes(result.buffer));let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return{base64:btoa(binary),stats:result.stats};}
function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function main(){
 for(const id of Object.keys(BRANCHES)){const rigs=[];for(const rich of[false,true]){const raw=Uint8Array.from(atob(DATA.models[id]),c=>c.charCodeAt(0));const gltf=await new GLTFLoader().parseAsync(raw.buffer,'');rigs.push(createRig(gltf.scene,id,rich));}library.set(id,{rigs,scenes:rigs.map(r=>makeScene(r.root))});}
 $('reduced').checked=reduced;mode('painted');resetView();render();
 document.querySelectorAll('[data-branch]').forEach(b=>b.onclick=()=>select(b.dataset.branch));document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>mode(b.dataset.mode));
 $('fire').onclick=()=>fire().catch(e=>$('audio-state').textContent=e.message);$('play').onclick=()=>playing?pause():play(true);$('reset').onclick=()=>{pause('reset');time=0;resetView();render();};$('timeline').oninput=e=>seek(e.target.value);$('fit').onclick=fit;
 $('fx').onchange=e=>{effects=e.target.checked;render()};$('reduced').onchange=e=>{reduced=e.target.checked;render()};$('outline').onchange=e=>{outlined=e.target.checked;mode(visualMode)};
 $('mute').onchange=e=>{audio.setMuted(e.target.checked);if(playing&&!e.target.checked)audio.schedule(branch,time)};$('volume').oninput=e=>audio.setVolume(Number(e.target.value)/100);$('audio-variant').onchange=e=>{audio.setVariant(e.target.value);if(playing)audio.schedule(branch,time)};
 $('unlock').onclick=async()=>{await audio.unlock();$('audio-state').textContent='음향 준비됨 · 선택한 한쪽만 재생'};
 $('wav').onclick=async()=>{const v=$('audio-variant').value,result=await mix(branch,v);download(Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)),branch+'-'+v+'-6s.wav','audio/wav')};
 $('record').onclick=()=>download(JSON.stringify({scope:'independent art demo, not game combat',branch,time,events:eventsFor(branch),stats:stats()},null,2),'Cloudstitch-attack-record.json','application/json');
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('hidden')});window.addEventListener('pagehide',()=>audio.cancel('pagehide'));new ResizeObserver(()=>{resize();fit()}).observe(stage);
 Object.assign(window.__attack,{ready:true,select,seek,play,fire,pause,render,setMode:mode,fit,resetView,stats,renderMix:mix,audio,events:eventsFor,renderer,effect,camera,controls,library,source:DATA.source});$('loading').hidden=true;
 function frame(now){requestAnimationFrame(frame);const dt=Math.max(0,(now-lastNow)/1000);lastNow=now;if(playing){time=Math.min(DURATION,time+dt);if(time===DURATION)pause('end');}controls.update();render();}requestAnimationFrame(frame);
}
main().catch(e=>{window.__attack.error=e.message;$('loading').textContent=e.message;console.error(e)});
