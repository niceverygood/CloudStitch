import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
import {createVariantLibrary} from './variants.js';
import {CATEGORIES,EXPLOSION_TIMES,REPRESENTATIVES,TOTAL_STAGES,levelFor} from './catalog.js';

const $=id=>document.getElementById(id),DATA=window.__SHIP_STATE_DATA__,stage=$('stage');
const items=CATEGORIES.flatMap(c=>c.stages.map((s,i)=>({category:c.id,stage:i,name:s[0],description:s[1]})));
const variants=new Map(),materialCache=new Map(),sourceMaterials=new Set(),records=new Map();
const scenes=[new THREE.Scene(),new THREE.Scene()];
const direction=new THREE.Vector3(7,5.5,-7).normalize();
const gradientMap=new THREE.DataTexture(new Uint8Array([80,165,255]),3,1,THREE.RedFormat);
gradientMap.minFilter=gradientMap.magFilter=THREE.NearestFilter;gradientMap.generateMipmaps=false;gradientMap.needsUpdate=true;
let renderer,camera,controls,outline,library,baseline,current=null,category='normal',index=0,mode='handdrawn',time=0,duration=6;
let evolving=false,evolutionElapsed=0;
let playing=false,speed=1,loop=true,outlineEnabled=true,dark=false,halfHeight=.5,last=0,ready=false,frameId,controlsActive=false,settlingFrames=0;
const key=(c,s)=>`${c}:${s}`;
const getMeta=c=>CATEGORIES.find(v=>v.id===c);
const repTime=(c,s)=>c==='explosion'?EXPLOSION_TIMES[s]:c==='normal'?1.1:0;

function materialFor(source,targetMode){
 if(targetMode==='original')return source;
 const id=source.uuid+targetMode;if(materialCache.has(id))return materialCache.get(id);
 const params={color:source.color?.clone()||new THREE.Color('white'),map:source.map||null,vertexColors:source.vertexColors,side:source.side,transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest,depthWrite:source.depthWrite,toneMapped:false};
 const m=targetMode==='cel'?new THREE.MeshToonMaterial({...params,gradientMap}):new THREE.MeshBasicMaterial(params);
 m.userData.outlineParameters={thickness:.0016,color:[.08,.13,.11],visible:outlineEnabled&&!source.transparent,keepAlive:true};
 // Animated opacity/color effects retain their own source material; their
 // transforms are authored on every update and never depend on display mode.
 materialCache.set(id,m);return m;
}
function register(v){
 const rows=[];v.root.traverse(n=>{if(n.isMesh){rows.push({mesh:n,source:n.material});for(const m of(Array.isArray(n.material)?n.material:[n.material]))sourceMaterials.add(m);}});records.set(v,rows);return v;
}
function applyMode(v){for(const r of records.get(v)||[])r.mesh.material=Array.isArray(r.source)?r.source.map(m=>materialFor(m,mode)):materialFor(r.source,mode);}
function setMode(value){if(!['handdrawn','cel','original'].includes(value))return false;mode=value;if(baseline)applyMode(baseline);if(current)applyMode(current);for(const scene of scenes){scene.children.find(n=>n.isAmbientLight).intensity=mode==='cel'?.55:1.05;}document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));pose(time);resize();return true;}
function pose(t){time=THREE.MathUtils.clamp(Number(t)||0,0,duration);baseline?.update(time);current?.update(time);$('timeline').value=time;$('time-value').textContent=`${time.toFixed(2)} / ${duration.toFixed(1)}초`;if(category==='explosion'){const phase=EXPLOSION_TIMES.reduce((n,t,i)=>time>=t?i:n,0);$('lane-title').textContent=getMeta(category).stages[phase][0];}}
function setTime(t){setPlaying(false);pose(t);render();}
function setPlaying(value){playing=!!value;$('play').textContent=playing?'일시정지':'재생';$('play').setAttribute('aria-pressed',String(playing));}
function visibleBounds(v,viewMatrix=null){
 const box=new THREE.Box3(),point=new THREE.Vector3(),matrix=new THREE.Matrix4();v.root.updateMatrixWorld(true);
 v.root.traverseVisible(n=>{if(!n.isMesh)return;const mats=Array.isArray(n.material)?n.material:[n.material];if(mats.every(m=>!m.visible||m.opacity<.015))return;matrix.copy(n.matrixWorld);if(viewMatrix)matrix.premultiply(viewMatrix);const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(matrix);box.expandByPoint(point);}});
 return box;
}
function boundsOf(v,t){v.update(t);return visibleBounds(v);}
function fit(resetCamera=false){
 if(!current)return;
 const box=boundsOf(current,repTime(category,index)).union(boundsOf(baseline,0));
 if(category==='explosion')for(const t of [.75,1.6,3.2,5.3])box.union(boundsOf(current,t));
 const center=box.getCenter(new THREE.Vector3());
 if(resetCamera)camera.position.copy(direction).multiplyScalar(4).add(center);else camera.position.add(center.clone().sub(controls.target));
 controls.target.copy(center);camera.lookAt(center);camera.updateMatrixWorld(true);
 const local=new THREE.Box3();for(const t of category==='explosion'?[0,.75,1.6,3.2,5.3]:[repTime(category,index)]){current.update(t);local.union(visibleBounds(current,camera.matrixWorldInverse));}baseline.update(0);local.union(visibleBounds(baseline,camera.matrixWorldInverse));const size=local.getSize(new THREE.Vector3()),aspect=stage.clientWidth/2/Math.max(stage.clientHeight,1),projectedCenter=local.getCenter(new THREE.Vector3()),shift=new THREE.Vector3(projectedCenter.x,projectedCenter.y,0).applyQuaternion(camera.quaternion);camera.position.add(shift);controls.target.add(shift);camera.lookAt(controls.target);camera.updateMatrixWorld(true);
 halfHeight=Math.max(size.y/2,size.x/2/Math.max(aspect,.1),.21)*1.12;camera.zoom=1;resize();controls.update();pose(time);
}
function reset(){controls.autoRotate=false;$('rotate').setAttribute('aria-pressed','false');fit(true);}
function resize(){if(!renderer)return;const w=Math.max(stage.clientWidth,1),h=Math.max(stage.clientHeight,1),aspect=w/2/h;renderer.setSize(w,h,false);camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();for(const m of [...sourceMaterials,...materialCache.values()])m.userData.outlineParameters={thickness:1.15/h,color:[.07,.12,.1],visible:outlineEnabled&&!m.transparent,keepAlive:true};}
function render(){if(!renderer||!camera)return;const w=stage.clientWidth,h=stage.clientHeight;renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.clear(true,true,true);renderer.setScissorTest(true);for(let i=0;i<2;i++){const x=i===0?0:Math.floor(w/2),width=i===0?Math.floor(w/2):w-Math.floor(w/2);renderer.setViewport(x,0,width,h);renderer.setScissor(x,0,width,h);if(outlineEnabled)outline.render(scenes[i],camera);else renderer.render(scenes[i],camera);}renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);}
function syncSelection(){
 const c=getMeta(category),s=c.stages[index];for(const id of ['previous','next','level-output','level-range','evolve'])$(id).hidden=category!=='growth';$('level-range').value=levelFor(category,index);$('level-output').textContent='Lv.'+levelFor(category,index);$('previous').disabled=levelFor(category,index)===1;$('next').disabled=levelFor(category,index)===30;$('selected-title').textContent=c.name+' · '+s[0];$('selected-subtitle').textContent=c.subtitle;$('lane-title').textContent=s[0];$('lane-subtitle').textContent=category==='growth'?'누적 확장 · 원래 선장실과 기낭 유지':category==='explosion'?'전조 → 대분출 → 연쇄 파열 → 여운 · 6초':'누적 진화 · 원래 선장실과 기낭 보존';$('detail-title').textContent=s[0];$('detail-description').textContent=s[1];$('energy').hidden=category!=='explosion';$('detail-note').textContent=category==='explosion'?'처음부터 버튼으로 에너지 0 폭발을 재생하세요.':'30레벨 외형 시안 · 실제 게임 레벨 규칙과 별도';
 $('stage-tabs').replaceChildren(...c.stages.map((s,i)=>{const b=document.createElement('button');b.textContent=s[0];b.dataset.stage=i;b.setAttribute('aria-pressed',String(index===i));b.onclick=()=>select(category,i);return b;}));
 document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(category===b.dataset.category)));
 document.querySelectorAll('[data-card-category]').forEach(b=>b.setAttribute('aria-pressed',String(category===b.dataset.cardCategory&&index===Number(b.dataset.cardStage))));
 if(location.protocol!=='file:'||!new URLSearchParams(location.search).has('qa')){try{const p=new URLSearchParams(location.search);p.set('category',category);p.set('stage',String(index));history.replaceState(null,'','?'+p);}catch{}}
}

function goLevel(level,fromEvolution=false){level=THREE.MathUtils.clamp(Number(level)||1,1,30);return select('growth',level-1,fromEvolution);}
function rebase(){if(!library)return;const choice=$('baseline').value;if(baseline){scenes[0].remove(baseline.root);records.delete(baseline);baseline.dispose?.();}if(choice==='previous'&&index>0){baseline=register(library.create(category,index-1));$('baseline-title').textContent='직전 단계 · '+getMeta(category).stages[index-1][0];}else if(choice==='original'){baseline=register(library.create('original',0));$('baseline-title').textContent='원래의 귀환호 · Lv.1';}else{baseline=register(library.create('v1-'+category,category==='growth'?Math.min(index,8):index));$('baseline-title').textContent=category==='growth'?'v1 성장 · Lv.'+(Math.min(index,8)+1):'v1 · '+getMeta(category).name;}scenes[0].add(baseline.root);applyMode(baseline);}

function select(c,s,fromEvolution=false){
 if(!fromEvolution){evolving=false;document.getElementById('evolve').textContent='1 → 30 진화 재생';} 
 const v=variants.get(key(c,Number(s)));if(!v)return false;
 if(current)scenes[1].remove(current.root);current=v;category=c;index=Number(s);rebase();scenes[1].add(current.root);duration=6;$('timeline').max=duration;setPlaying(false);applyMode(current);pose(repTime(c,index));syncSelection();fit(true);render();return true;
}
function buildUI(){
 $('total').textContent=TOTAL_STAGES;
 for(const c of CATEGORIES){
  const b=document.createElement('button');b.className='overview-card';b.dataset.category=c.id;b.setAttribute('aria-pressed','false');b.innerHTML=`<div class="overview-top"><span class="overview-heading"><span class="number">${c.number}</span>${c.name}</span><span class="count">${c.stages.length}단계</span></div><img alt="${c.name} 대표 모습" data-overview-image="${c.id}"><div class="overview-bottom"><span>${c.subtitle}</span><b>확대해서 보기 ↗</b></div>`;
  b.onclick=()=>{select(c.id,REPRESENTATIVES[c.id]);$('workbench').scrollIntoView({behavior:'smooth',block:'start'});};$('overview-grid').append(b);
  const tab=document.createElement('button');tab.dataset.category=c.id;tab.textContent=c.name;tab.onclick=()=>select(c.id,REPRESENTATIVES[c.id]);$('category-tabs').append(tab);
  const section=document.createElement('section');section.className='sheet-section';section.id='sheet-'+c.id;const head=document.createElement('div');head.className='sheet-header';head.innerHTML=`<h3><span class="number">${c.number}</span>${c.name} <span class="count">${c.stages.length}단계</span></h3><p>${c.subtitle}</p>`;section.append(head);const grid=document.createElement('div');grid.className='stage-grid';
  c.stages.forEach((s,i)=>{const card=document.createElement('button');card.className='stage-card';card.dataset.cardCategory=c.id;card.dataset.cardStage=i;card.setAttribute('aria-pressed','false');card.innerHTML=`<img alt="${c.name} ${s[0]}" data-thumb="${key(c.id,i)}"><div class="card-copy"><strong>${s[0]}</strong><span>${s[1]}</span></div>`;card.onclick=()=>{select(c.id,i);$('workbench').scrollIntoView({behavior:'smooth',block:'start'});};grid.append(card);});section.append(grid);$('sheets').append(section);
 }
}
function lights(scene){scene.add(new THREE.AmbientLight(0xffffff,1.05));const keyLight=new THREE.DirectionalLight(0xfff7df,2.1);keyLight.position.set(-3,6,-4);scene.add(keyLight);const fill=new THREE.DirectionalLight(0xdcecef,.4);fill.position.set(3,1,4);scene.add(fill);}
async function makeThumbnails(){
 const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setSize(600,375);r.setPixelRatio(1);r.outputColorSpace=THREE.SRGBColorSpace;r.setClearColor(0,0);const fx=new OutlineEffect(r);fx.autoClear=true;
 const scene=new THREE.Scene();lights(scene);const cam=new THREE.OrthographicCamera(-1,1,1,-1,.01,100);cam.position.copy(direction).multiplyScalar(4);cam.lookAt(0,0,0);cam.updateMatrixWorld(true);
 for(const c of CATEGORIES){
  const box=new THREE.Box3();for(let i=0;i<c.stages.length;i++)box.union(boundsOf(variants.get(key(c.id,i)),repTime(c.id,i)));
  const center=box.getCenter(new THREE.Vector3());cam.position.copy(direction).multiplyScalar(4).add(center);cam.lookAt(center);cam.updateMatrixWorld(true);const projected=new THREE.Box3();for(let i=0;i<c.stages.length;i++){const v=variants.get(key(c.id,i));v.update(repTime(c.id,i));projected.union(visibleBounds(v,cam.matrixWorldInverse));}const size=projected.getSize(new THREE.Vector3()),pc=projected.getCenter(new THREE.Vector3()),shift=new THREE.Vector3(pc.x,pc.y,0).applyQuaternion(cam.quaternion);cam.position.add(shift);cam.lookAt(center.clone().add(shift));cam.updateMatrixWorld(true);const h=Math.max(size.y/2,size.x/3.2,.19)*1.12;cam.left=-h*1.6;cam.right=h*1.6;cam.top=h;cam.bottom=-h;cam.updateProjectionMatrix();
  for(let i=0;i<c.stages.length;i++){
   const v=variants.get(key(c.id,i));applyMode(v);v.update(repTime(c.id,i));scene.add(v.root);fx.render(scene,cam);const url=r.domElement.toDataURL('image/png');document.querySelector(`[data-thumb="${key(c.id,i)}"]`).src=url;if(i===REPRESENTATIVES[c.id])document.querySelector(`[data-overview-image="${c.id}"]`).src=url;scene.remove(v.root);$('load-progress').textContent=`단계별 모습 렌더링 ${items.findIndex(n=>n.category===c.id&&n.stage===i)+1} / ${TOTAL_STAGES}`;
   await new Promise(resolve=>requestAnimationFrame(resolve));
  }
 }
 r.dispose();r.forceContextLoss();
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function capture(){render();const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;const ctx=canvas.getContext('2d');ctx.fillStyle=dark?'#244946':'#f4f5e8';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(renderer.domElement,0,0);const scale=canvas.width/stage.clientWidth;ctx.fillStyle=dark?'#fff6df':'#294f50';ctx.font=`600 ${14*scale}px sans-serif`;ctx.fillText('Cloudstitch · 원래의 귀환호',18*scale,29*scale);ctx.fillText(getMeta(category).stages[index][0],canvas.width/2+18*scale,29*scale);canvas.toBlob(b=>download(b,`Cloudstitch-${category}-${index}-${time.toFixed(2)}s.png`));}
async function exportGLB(){
 const button=$('export-glb');button.disabled=true;const originals=[];
 try{current.root.updateMatrixWorld(true);const copy=current.root.clone(true);copy.traverse(n=>{if(n.isMesh){n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone();originals.push(...(Array.isArray(n.material)?n.material:[n.material]));}});const result=await new GLTFExporter().parseAsync(copy,{binary:true,onlyVisible:true,trs:true});download(new Blob([result],{type:'model/gltf-binary'}),`Cloudstitch-${category}-${index}-pose.glb`);}catch(e){$('detail-note').textContent='GLB 저장 실패: '+e.message;console.error(e);}finally{for(const m of originals)m.dispose();button.disabled=false;}
}
function stats(){
 let meshCount=0,triangleCount=0;current?.root.traverseVisible(n=>{if(n.isMesh){meshCount++;triangleCount+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});const box=current?new THREE.Box3().setFromObject(current.root):new THREE.Box3();const bounds={min:box.min.toArray(),max:box.max.toArray()};return{ready,category,stage:index,mode,time,duration,playing,autoRotate:controls?.autoRotate,outlineEnabled,outlineAutoClear:outline?.autoClear===true,background:dark?'dark':'cream',meshCount,triangleCount,bounds,finite:[...bounds.min,...bounds.max].every(Number.isFinite),sourceBytes:DATA.sourceBytes,total:items.length};
}
async function start(){
 buildUI();renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);stage.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','함선 레벨1부터30까지 점진 진화 3D 비교');
 camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,100);camera.position.copy(direction).multiplyScalar(4);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.autoRotateSpeed=.7;controls.minZoom=.25;controls.maxZoom=10;controls.addEventListener('start',()=>{controlsActive=true;});controls.addEventListener('end',()=>{controlsActive=false;settlingFrames=100;});outline=new OutlineEffect(renderer,{defaultThickness:.002,defaultKeepAlive:true});outline.autoClear=true;for(const s of scenes)lights(s);
 const raw=atob(DATA.model),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');library=createVariantLibrary(gltf);
 for(const item of items)variants.set(key(item.category,item.stage),register(library.create(item.category,item.stage)));
 baseline=register(library.create('original',0));scenes[0].add(baseline.root);applyMode(baseline);resize();await makeThumbnails();
 $('previous').onclick=()=>goLevel(levelFor(category,index)-1);$('next').onclick=()=>goLevel(levelFor(category,index)+1);$('level-range').oninput=e=>goLevel(Number(e.target.value));$('baseline').onchange=()=>{rebase();applyMode(baseline);pose(time);fit(true);render();};$('evolve').onclick=()=>{evolving=!evolving;evolutionElapsed=0;if(evolving&&(category!=='growth'||levelFor(category,index)===30))goLevel(1,true);$('evolve').textContent=evolving?'진화 재생 멈춤':'1 → 30 진화 재생';};
 $('play').onclick=()=>{if(time>=duration)pose(0);setPlaying(!playing);};$('replay').onclick=()=>{pose(0);setPlaying(true);};$('timeline').oninput=e=>setTime(e.target.value);$('loop').onchange=e=>loop=e.target.checked;$('speed').onchange=e=>speed=Number(e.target.value);
 for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{setMode(b.dataset.mode);render();};$('outline').onchange=e=>{outlineEnabled=e.target.checked;resize();render();};$('background').onclick=()=>{dark=!dark;stage.classList.toggle('deep',dark);$('background').textContent=dark?'배경 · 짙은 청록':'배경 · 크림';$('background').setAttribute('aria-pressed',String(dark));};$('reset').onclick=reset;$('fit').onclick=()=>fit(false);$('rotate').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('rotate').setAttribute('aria-pressed',String(controls.autoRotate));};$('capture').onclick=capture;$('export-glb').onclick=exportGLB;
 new ResizeObserver(()=>{resize();if(current)fit(false);}).observe(stage);
 const params=new URLSearchParams(location.search),c=getMeta(params.get('category'))?.id||'normal',s=Number(params.get('stage')||0);select(c,variants.has(key(c,s))?s:0);ready=true;$('loading').hidden=true;stage.setAttribute('aria-busy','false');
 window.__shipStates=window.__dramaticShip=window.__evolution30={ready:true,get level(){return levelFor(category,index);},goLevel,select,setMode,setTime,setPlaying,render,reset,fit,renderer,camera,controls,outline,items,variants,get current(){return current;},get stats(){return stats();}};
 function tick(now){frameId=requestAnimationFrame(tick);const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;if(evolving){evolutionElapsed+=dt;if(evolutionElapsed>=1.6){evolutionElapsed=0;const level=levelFor(category,index);if(level<30)goLevel(level+1,true);else{evolving=false;$('evolve').textContent='1 → 30 진화 재생';}}}if(playing){const t=time+dt*speed;if(t>=duration){if(loop)pose(t%duration);else{pose(duration);setPlaying(false);}}else pose(t);}if(controls.autoRotate||controlsActive||(controls.enableDamping&&settlingFrames>0)){controls.update(dt);if(!controlsActive&&settlingFrames>0)settlingFrames--;}render();}frameId=requestAnimationFrame(tick);
 window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();setPlaying(!playing);}if(e.code==='ArrowRight'){e.preventDefault();setTime(time+1/60);}if(e.code==='ArrowLeft'){e.preventDefault();setTime(time-1/60);}});
}
start().catch(e=>{console.error(e);$('loading').hidden=false;$('loading').textContent='함선을 표시하지 못했습니다. '+e.message;window.__shipStates={ready:false,error:e.message};});
