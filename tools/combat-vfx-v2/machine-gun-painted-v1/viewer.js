import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
import {getRichProfile} from '../../battlefield/vfx-rich-profiles.mjs';
import {createPaintedMG} from './painted-effects.js';

const DATA=window.__V1_REVIEW_DATA__,$=id=>document.getElementById(id),stage=$('stage');
const names={'01-machine-gun':'기관총','02-deck-cannon':'함포','03-mortar':'박격포','04-harpoon':'작살포','05-chain-shot':'사슬탄','06-flamethrower':'화염방사기',common:'공통'};
const hitIds=new Set(['machine-gun-hit','cannon-hit','mortar-hit','harpoon-hit','chain-shot-hit','flamethrower-hit','wood-hit','metal-hit','fabric-hit','armor-hit','ricochet-hit','weakpoint-hit','cloud-miss','penetration-exit','small-explosion','large-explosion','airburst','shrapnel-burst']);
const loader=new GLTFLoader(),cache=new Map(),scenes=[new THREE.Scene(),new THREE.Scene()];
const materials=new Set(),urls=new Set(),direction=new THREE.Vector3(-7,5.5,-7).normalize();
let renderer,camera,controls,outline,paintedAtlas,paintedMetal,active=null,request=0,time=0,duration=1,playing=true,loop=true,speed=.5,presentation='rich',amount=1,focus='all',halfHeight=2,last=performance.now(),dark=false;
const stats={ready:false,assetVersion:'v1',gameplayCollision:false,paidCalls:0,errors:[],sourceAssets:54};
window.__v1ReviewStats=stats;
function fail(e){stats.ready=false;stats.errors.push(String(e.message||e));$('loading').hidden=false;$('loading').classList.add('error');$('loading').textContent='화면을 준비하지 못했습니다: '+String(e.message||e);$('status').textContent='불러오기 실패';$('status').dataset.state='error';stage.setAttribute('aria-busy','false');console.error(e);}
function bytes(asset){const raw=atob(asset.base64),b=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)b[i]=raw.charCodeAt(i);return b;}
async function parse(item){if(!cache.has(item.id)){const b=bytes(item.asset);cache.set(item.id,loader.parseAsync(b.buffer,'').then(g=>({g,b})));}return cache.get(item.id);}
function mixer(root,clip){const m=new THREE.AnimationMixer(root),a=m.clipAction(clip);a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play();return{m,a};}
function evaluate(layer,t){layer.a.reset().setLoop(THREE.LoopOnce,1);layer.a.clampWhenFinished=true;layer.a.play();layer.m.setTime(Math.max(0,t));}
function addMaterials(root){root.traverse(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);});}
function profileGeometry(root,id,scale){
 const carrier=root.getObjectByName(id+'_projectile_carrier_0');
 if(!carrier)throw Error('발사체 표시 노드 없음: '+id);
 const content=new THREE.Group();content.name=id+'_review_visual_size';
 for(const child of [...carrier.children])content.add(child);carrier.add(content);content.scale.setScalar(scale);return content;
}
function makeLane(item,g,rich){
 if(rich){
  const lane=makeLane(item,g,false),paint=createPaintedMG(THREE,{atlas:paintedAtlas,metalTexture:paintedMetal});
  if(item.kind==='sequence')for(const p of lane.parts)p.node.visible=false;else lane.root.visible=false;
  lane.container.add(paint.root);lane.paint=paint;
  lane.parts=item.kind==='sequence'?[{role:'weapon',node:paint.muzzleGroup},{role:'flight',node:paint.projectileGroup},{role:'hit',node:paint.hitGroup}]:[{role:'effect',node:paint.root}];
  paint.root.traverse(n=>{if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material]){m.userData.painted=true;materials.add(m);}});
  return lane;
 }
 const root=g.scene.clone(true),clip=g.animations[0];if(!clip)throw Error('애니메이션 없음: '+item.id);
 const container=new THREE.Group();container.add(root);
 const main=mixer(root,clip),echoes=[],scaled=[],parts=[],sourceParts=[...root.children];
 const components=item.kind==='sequence'?item.component_effects:[{id:item.id,start:0,end:item.duration}];
 for(let index=0;index<components.length;index++){
  const c=components[index],p=getRichProfile(c.id),part=item.kind==='sequence'?sourceParts[index+1]:root;
  if(!part)throw Error('시연 구성 없음: '+item.id);
  const role=item.kind==='sequence'?['weapon','flight','hit'][index]:'effect';
  parts.push({role,id:c.id,node:part});
  if(!rich)continue;
  if(p.projectile){const size=profileGeometry(part,c.id,p.scale*amount);scaled.push({node:size,base:p.scale});continue;}
  // Keep the authored attachment at its original location. Only visual content grows.
  const parent=part.parent,anchor=new THREE.Group();anchor.position.copy(part.position);anchor.quaternion.copy(part.quaternion);
  part.position.set(0,0,0);part.quaternion.identity();parent.add(anchor);anchor.add(part);anchor.scale.setScalar(p.scale*amount);scaled.push({node:anchor,base:p.scale});
  for(const spec of p.echoes){
   const copy=part.clone(true),namesInPart=new Set();copy.traverse(n=>namesInPart.add(n.name));
   const tracks=clip.tracks.filter(t=>namesInPart.has(THREE.PropertyBinding.parseTrackName(t.name).nodeName)).map(t=>t.clone());
   const echoClip=new THREE.AnimationClip(clip.name+'_echo',clip.duration,tracks),group=new THREE.Group();group.position.set(...spec.offset);group.rotation.y=spec.rotation;group.scale.setScalar(spec.scale);group.add(copy);anchor.add(group);
   const sourceDuration=DATA.effects.find(e=>e.id===c.id).duration;
   echoes.push({...mixer(copy,echoClip),group,delay:spec.delay*(c.end-c.start)/sourceDuration,start:c.start,end:c.end});
  }
 }
 addMaterials(container);
 root.updateMatrixWorld(true);
 let impactFrame=null;
 if(item.kind==='sequence'){
  const panel=sourceParts.at(-1),normal=new THREE.Vector3(0,0,-1).transformDirection(panel.matrixWorld),point=panel.getWorldPosition(new THREE.Vector3());
  let first=null;panel.traverse(n=>{if(!first&&n.isMesh)first=n;});
  if(first){first.geometry.computeBoundingBox();const depth=first.geometry.boundingBox.getSize(new THREE.Vector3()).z*first.getWorldScale(new THREE.Vector3()).z;point.addScaledVector(normal,depth/2);}
  impactFrame={point,normal};
 }
 return{container,root,main,echoes,scaled,parts,impactFrame,weapon:item.kind==='sequence'?sourceParts[0]:null};
}
function board(id){const group=new THREE.Group(),color=/metal|armor/.test(id)?0x628a80:/fabric/.test(id)?0xe9d9ad:0xc19a65;
 const mat=new THREE.MeshBasicMaterial({color});for(let i=0;i<4;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(.42,.07,1.5),mat);p.position.x=(i-1.5)*.43;p.position.y=-.045;group.add(p);}const rim=new THREE.Mesh(new THREE.BoxGeometry(1.8,.09,.07),new THREE.MeshBasicMaterial({color:0x4b8580}));rim.position.set(0,-.05,.78);group.add(rim);addMaterials(group);return group;}
function pose(t){time=THREE.MathUtils.clamp(Number(t)||0,0,duration);
 if(active)for(const lane of active.lanes){evaluate(lane.main,time);for(const echo of lane.echoes){echo.group.visible=time>=echo.start+echo.delay&&time<echo.end;if(echo.group.visible)evaluate(echo,time-echo.delay);}lane.container.updateMatrixWorld(true);}
 updatePainted();
 $('timeline').value=time;$('time-value').value=`${time.toFixed(2)} / ${duration.toFixed(2)}초`;
 Object.assign(stats,{time,duration,playing,speed,loop,presentation,amount});
}
function updatePainted(){if(!active?.lanes[1].paint)return;const item=active.item,attack=item.kind==='sequence',projectile=item.id.endsWith('-projectile'),m=attack?item.approximate_muzzle:[0,0,0],frame=active.lanes[0].impactFrame;active.lanes[1].paint.update({time,mode:attack?'attack':item.id.endsWith('-muzzle')?'muzzle':projectile?'projectile':'hit',camera,muzzle:new THREE.Vector3(...m),hit:frame?.point||new THREE.Vector3(m[0],m[1],m[2]+(projectile?4:0)),impactNormal:frame?.normal||new THREE.Vector3(0,1,0),amount});active.lanes[1].container.updateMatrixWorld(true);}
function setPlaying(value){playing=Boolean(value);if(playing&&time>=duration)pose(0);$('play').textContent=playing?'일시정지':'재생';$('play').setAttribute('aria-pressed',String(playing));stats.playing=playing;}
function phaseTime(phase){if(!active)return 0;const c=active.item.component_effects;if(c){if(phase==='fire')return c[0].start+(c[0].end-c[0].start)*.35;if(phase==='flight')return(c[1].start+c[1].end)/2;if(phase==='hit')return c[2].start+Math.min(.2,(c[2].end-c[2].start)*.3);}return phase==='end'?Math.max(0,duration-.01):duration*(phase==='fire'?.12:phase==='flight'?.4:.28);}
function visibleBounds(root){const box=new THREE.Box3();root.traverseVisible(n=>{if(!n.geometry)return;if(!n.geometry.boundingBox)n.geometry.computeBoundingBox();box.union(n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld));});return box;}
function sampleBounds(){const saved=time,b={all:new THREE.Box3(),weapon:new THREE.Box3(),hit:new THREE.Box3(),projectile:new THREE.Box3()};
 for(let i=0;i<=28;i++){pose(duration*i/28);for(const lane of active.lanes){b.all.union(visibleBounds(lane.container));if(active.item.kind==='sequence'){if(lane.weapon)b.weapon.union(new THREE.Box3().setFromObject(lane.weapon));const h=lane.parts.find(p=>p.role==='hit');if(h)b.hit.union(visibleBounds(h.node));}}}
 if(active.item.kind==='sequence'){for(const lane of active.lanes)b.weapon.union(new THREE.Box3().setFromObject(lane.weapon));}
 if(active.item.kind==='sequence'){
  const m=active.item.approximate_muzzle,contact=new THREE.Vector3(m[0],m[1],m[2]+4);
  b.hit.set(contact.clone().add(new THREE.Vector3(-.65,-.42,-.15)),contact.clone().add(new THREE.Vector3(.65,.70,.08)));
 }
 if(active.item.kind==='sequence'||active.item.id.endsWith('-projectile')){const m=active.item.approximate_muzzle||[0,0,0],center=new THREE.Vector3(m[0],m[1],m[2]+2);b.projectile.set(center.clone().add(new THREE.Vector3(-.45,-.30,-.60)),center.clone().add(new THREE.Vector3(.45,.30,.60)));}
 for(const k of ['all','weapon','hit','projectile'])if(b[k].isEmpty())b[k].copy(b.all);
 active.bounds=b;pose(saved);
}
function fit(reset=false){if(!active)return;const box=active.bounds[focus].clone();if(box.isEmpty())return;
 const center=box.getCenter(new THREE.Vector3());if(reset)camera.position.copy(direction).multiplyScalar(14).add(center);else camera.position.add(center.clone().sub(controls.target));controls.target.copy(center);camera.lookAt(center);camera.updateMatrixWorld(true);
 const aspect=(presentation==='compare'?stage.clientWidth/2:stage.clientWidth)/Math.max(stage.clientHeight,1),local=box.clone().applyMatrix4(camera.matrixWorldInverse),s=local.getSize(new THREE.Vector3());halfHeight=Math.max(s.y/2,s.x/(2*Math.max(.1,aspect)),.26)*1.22;camera.zoom=1;resize();controls.update();}
function setFocus(value){focus=value;if(value==='projectile'&&active&&(active.item.kind==='sequence'||active.item.id.endsWith('-projectile'))){setPlaying(false);pose(active.item.kind==='sequence'?phaseTime('flight'):duration*.5);}document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===value)));fit(true);}
function resize(){if(!renderer)return;const w=Math.max(stage.clientWidth,1),h=Math.max(stage.clientHeight,1),aspect=(presentation==='compare'?w/2:w)/h;renderer.setSize(w,h,false);camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();for(const m of materials)m.userData.outlineParameters={thickness:1.35/Math.max(h,1),visible:$('outline').checked&&!m.userData.painted,color:[.08,.16,.14],keepAlive:true};}
function render(){updatePainted();const w=stage.clientWidth,h=stage.clientHeight;renderer.setScissorTest(true);const order=presentation==='compare'?[0,1]:[presentation==='rich'?1:0];
 for(let i=0;i<order.length;i++){const x=order.length===2?i*w/2:0,width=order.length===2?w/2:w;renderer.setViewport(x,0,width,h);renderer.setScissor(x,0,width,h);if($('outline').checked)outline.render(scenes[order[i]],camera);else renderer.render(scenes[order[i]],camera);}renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);}
function setPresentation(value){presentation=value;$('presentation').value=value;$('lane-labels').dataset.presentation=value;const l=$('lane-left'),r=$('lane-right');l.textContent='이전 v1';r.textContent='새 손그림 질감';l.hidden=value==='rich';r.hidden=value==='original';resize();fit(false);pose(time);}
function setAmount(value){amount=THREE.MathUtils.clamp(Number(value)||1,.75,1.5);$('amount').value=amount;$('amount-value').textContent=amount.toFixed(2)+'×';if(active){for(const s of active.lanes[1].scaled)s.node.scale.setScalar(s.base*amount);sampleBounds();fit(false);profileText();}pose(time);}
function profileText(){if(!active)return;$('profile-info').textContent='붓결 황동 탄체 · 붓으로 그린 탄흔 · 손그림 섬광/연기 · 목재 파편 · 표시 강도 '+amount.toFixed(2)+'×';}
function list(){const mode=$('mode').value,weapon=$('weapon').value;return(mode==='attack'?DATA.sequences:DATA.effects.filter(i=>mode==='all'||hitIds.has(i.id))).filter(i=>weapon==='all'||(i.weapon_id||'common')===weapon);}
function populate(){const values=list();$('effect').replaceChildren(...values.map(i=>new Option(i.name_ko,i.id)));return values;}
function query(){const p=new URLSearchParams(location.search);p.set('mode',$('mode').value);p.set('effect',active.item.id);p.set('presentation',presentation);history.replaceState(null,'','?'+p);}
async function select(id){const item=[...DATA.sequences,...DATA.effects].find(i=>i.id===id);if(!item)return false;const ticket=++request;stats.ready=false;$('loading').hidden=false;$('loading').classList.remove('error');$('loading').textContent=item.name_ko+' 준비 중…';$('status').dataset.state='busy';stage.setAttribute('aria-busy','true');
 const {g,b}=await parse(item);if(ticket!==request)return false;
 if(active)for(let i=0;i<2;i++){const lane=active.lanes[i];for(const mix of [lane.main,...lane.echoes]){mix.m.stopAllAction();mix.m.uncacheRoot(mix.m.getRoot());}if(lane.paint){lane.paint.root.traverse(n=>{if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.delete(m);});lane.paint.dispose();}if(lane.board){const oldMaterials=new Set();lane.board.traverse(n=>{n.geometry?.dispose();if(n.material)oldMaterials.add(n.material);});for(const m of oldMaterials){materials.delete(m);m.dispose();}}scenes[i].remove(lane.container);}
 const lanes=[makeLane(item,g,false),makeLane(item,g,true)];
 for(let i=0;i<2;i++){if(item.kind!=='sequence'){const target=board(item.id);lanes[i].board=target;lanes[i].container.add(target);}scenes[i].add(lanes[i].container);}
 active={item,lanes,bounds:null};duration=g.animations[0].duration;time=0;$('timeline').max=duration;$('effect').value=id;
 $('stage-title').textContent=item.name_ko;$('stage-detail').textContent=item.kind==='sequence'?'발사 → 황동 탄환 → 손그림 피격 · 기관총 아트 수정':'새 손그림 이미지와 질감 · 시간 이동으로 모양 확인';$('selected-name').textContent=item.name_ko;$('purpose').textContent='무기의 청록·황동과 거친 붓결을 이어갑니다. 명중 순간의 섬광, 날리는 파편과 늦게 퍼지는 연기를 확인하세요.';
 sampleBounds();setFocus('all');pose(phaseTime(item.kind==='sequence'?'fire':'hit'));setPlaying(true);profileText();resize();query();
 for(const old of urls)URL.revokeObjectURL(old);urls.clear();const url=URL.createObjectURL(new Blob([b],{type:'model/gltf-binary'}));urls.add(url);$('download').href=url;$('download').download=id+'-original-v1.glb';$('download').removeAttribute('aria-disabled');
 stats.selected=id;stats.kind=item.kind;stats.ready=true;stats.hash=item.asset.sha256;stats.projectilePathScaled=false;$('loading').hidden=true;stage.setAttribute('aria-busy','false');$('status').dataset.state='ready';$('status').textContent='기관총 새 아트 · 이미지 질감 2장 · 이전 원본 보존';render();return true;
}
async function start(){renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.setClearColor(0,0);renderer.domElement.setAttribute('aria-label','공격 및 피격 효과 3D 검수 화면');stage.prepend(renderer.domElement);
 camera=new THREE.OrthographicCamera(-4,4,3,-3,.01,1000);camera.position.copy(direction).multiplyScalar(14);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.085;controls.autoRotateSpeed=.7;controls.minZoom=.25;controls.maxZoom=12;
 outline=new OutlineEffect(renderer,{defaultThickness:.0015,defaultKeepAlive:true});outline.autoClear=true;
 for(const scene of scenes){scene.add(new THREE.AmbientLight(0xffffff,1));const light=new THREE.DirectionalLight(0xffffff,1.6);light.position.set(4,8,5);scene.add(light);}
 $('weapon').replaceChildren(new Option('기관총','all'));
 for(const id of ['mode','weapon'])$(id).addEventListener('change',()=>{const options=populate();if(options.length)select(options[0].id).catch(fail);else{$('weapon').value='all';select(populate()[0].id).catch(fail);}});
 $('effect').addEventListener('change',e=>select(e.target.value).catch(fail));$('presentation').addEventListener('change',e=>{setPresentation(e.target.value);query();});
 $('play').onclick=()=>setPlaying(!playing);$('replay').onclick=()=>{pose(0);setPlaying(true);};$('loop').checked=true;$('loop').onchange=e=>loop=e.target.checked;$('speed').value='.5';if($('speed').value!=='0.5')$('speed').value='0.5';$('speed').onchange=e=>speed=Number(e.target.value);$('timeline').oninput=e=>{setPlaying(false);pose(e.target.value);};
 $('frame-prev').onclick=()=>{setPlaying(false);pose(time-1/60);};$('frame-next').onclick=()=>{setPlaying(false);pose(time+1/60);};
 document.querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>{setPlaying(false);pose(phaseTime(b.dataset.phase));});document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setFocus(b.dataset.view));
 $('reset').onclick=()=>{setFocus('all');controls.autoRotate=false;$('rotate').setAttribute('aria-pressed','false');};$('fit').onclick=()=>fit(false);$('rotate').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('rotate').setAttribute('aria-pressed',String(controls.autoRotate));};$('outline').onchange=resize;$('background').onclick=()=>{dark=!dark;stage.classList.toggle('deep',dark);$('background').textContent=dark?'배경 · 짙은 청록':'배경 · 크림';$('background').setAttribute('aria-pressed',String(dark));};$('amount').oninput=e=>setAmount(e.target.value);
 $('capture').onclick=()=>{render();const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download=`${active.item.id}-${presentation}-${time.toFixed(2)}s.png`;a.click();};
 window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();setPlaying(!playing);}if(e.code==='ArrowRight'){e.preventDefault();setPlaying(false);pose(time+1/60);}if(e.code==='ArrowLeft'){e.preventDefault();setPlaying(false);pose(time-1/60);}});
 new ResizeObserver(()=>{resize();fit(false);}).observe(stage);
 const params=new URLSearchParams(location.search),requested=params.get('effect'),found=[...DATA.sequences,...DATA.effects].find(i=>i.id===requested);$('mode').value=found?.kind==='sequence'?'attack':found?'all':params.get('mode')==='impact'?'impact':'attack';populate();setPresentation(['rich','original','compare'].includes(params.get('presentation'))?params.get('presentation'):'rich');
 window.__v1Review={select,setTime:t=>{setPlaying(false);pose(t);render();},setPlaying,setPresentation,setAmount,phaseTime,render,renderer,camera,controls,outline,scenes,get active(){return active;},get duration(){return duration;},items:[...DATA.sequences,...DATA.effects].map(({asset,...m})=>m)};
 [paintedAtlas,paintedMetal]=await Promise.all(['atlas','metal'].map(async key=>{const a=DATA.textures[key],t=await new THREE.TextureLoader().loadAsync('data:'+a.mime+';base64,'+a.base64);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;}));
 await select(found?.id||list()[0].id);
 if(params.has('time')){setPlaying(false);pose(Number(params.get('time')));if(params.get('focus')==='hit')setFocus('hit');}
 function tick(now){requestAnimationFrame(tick);const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;if(playing&&active){const next=time+dt*speed;if(next>duration){if(loop)pose(next%duration);else{pose(duration);setPlaying(false);}}else pose(next);}controls.update(dt);render();}requestAnimationFrame(tick);
}start().catch(fail);
