// Reversible combat slice: local tuning, not canonical balance or a full campaign.
const TAU=Math.PI*2,STEP=1/60;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const direction=a=>({x:-Math.cos(a),z:-Math.sin(a)});
const heading=(a,b)=>Math.atan2(-(b.z-a.z),-(b.x-a.x));
const combatPhases=new Set(['opening','midboss','late','finalboss']);
const roleData={
 scout:{hp:30,speed:2.7,range:9,attack:'shot',recovery:2.4},
 blockade:{hp:55,speed:1.1,range:11,attack:'fan',recovery:3.5},
 salvage:{hp:42,speed:1.6,range:10,attack:'harpoon',recovery:3.0},
 repair:{hp:35,speed:1.8,range:10,attack:'shot',recovery:3.3},
 charger:{hp:43,speed:2.1,range:8,attack:'charge',recovery:3.4},
 ambush:{hp:35,speed:.7,range:9,attack:'fan',recovery:3.3},
 artillery:{hp:44,speed:1.0,range:15,attack:'mortar',recovery:3.4},
 flame:{hp:48,speed:1.7,range:6,attack:'flame',recovery:3.3},
 bell:{hp:80,speed:.8,range:12,attack:'ring',recovery:3.6},
 shipyard:{hp:90,speed:0,range:30,attack:'mortar',recovery:3.4},
 king:{hp:90,speed:1.3,range:14,attack:'harpoon',recovery:3.0},
 heart:{hp:100,speed:0,range:30,attack:'pressure',recovery:3.4}
};
const phaseOrder=['briefing','opening','midboss','maintenance','late','finalboss','victory'];

export function createEncounter(catalog,{onEvent=()=>{}}={}){
 if(!catalog?.stages?.length)throw new Error('전장 편성이 없습니다.');
 let sequence=0,run=0,accumulator=0,difficulty='normal';
 let input={moveX:0,moveZ:0,fire:false,dash:false,autoAim:true,aimX:-12,aimZ:0};
 let state;
 const uid=prefix=>`${run}-${prefix}-${++sequence}`;
 const tuning=()=>catalog.difficultyProfiles?.find(profile=>profile.id===(state?.difficulty||difficulty))?.prototypeTuning||{enemyHealth:1,enemyDamage:1,telegraphTime:1};
 const emit=(type,detail={})=>onEvent({type,...detail});
 function newState(stage){return{runId:run,stageId:stage.id,stage,phase:'briefing',phaseIndex:0,simTime:0,paused:false,difficulty,player:{id:'player',assetId:'player-homeward',x:0,z:4.5,angle:Math.PI/2,aimAngle:Math.PI/2,hp:150,maxHp:150,vx:0,vz:0,radius:.7,hitFlash:0,shotCooldown:0,dashCooldown:0,dashTime:0,dashing:false,invulnerable:0,tetherTime:0},enemies:[],projectiles:[],telegraphs:[],effects:[],repairPickups:[],spawnLog:[],transitionLog:[],bossSpawnCounts:{midboss:0,finalboss:0},bossDefeatCounts:{midboss:0,finalboss:0},objective:'전장을 고른 뒤 출항하세요',stats:{shots:0,hits:0,kills:0,damageTaken:0,peakTelegraphs:0,repairs:0},banner:'',bannerTime:0};}
 state=newState(catalog.stages[0]);
 function resetInput(){input={...input,moveX:0,moveZ:0,fire:false,dash:false};}
 function clearHazards(){state.projectiles=[];state.telegraphs=[];state.effects=[];state.repairPickups=[];for(const e of state.enemies){e.warning=false;e.chargeTime=0;}}
 function transition(phase){
  if(state.phase==='defeat'||state.phase==='victory')return;
  const previous=state.phase;state.phase=phase;state.phaseIndex=phaseOrder.indexOf(phase);
  state.transitionLog.push({from:previous,to:phase,time:state.simTime,runId:run});
  const names={opening:'항로를 여는 적 편대를 격파하세요',midboss:'중간보스의 예고를 피하고 격파하세요',maintenance:'안전 정비 · 준비되면 후반 항로로 출항하세요',late:'후반 적 편대를 격파하세요',finalboss:'최종보스를 격파하고 항로를 확보하세요',victory:'항로 확보 완료'};
  state.objective=names[phase]||'';state.banner=phase==='midboss'?'중간보스 접근':phase==='finalboss'?'최종보스 접근':phase==='victory'?'항로 확보':phase==='maintenance'?'안전 정비':'';state.bannerTime=2.2;
  if(phase==='opening')spawnWave(state.stage.opening);
  if(phase==='late')spawnWave(state.stage.late);
  if(phase==='midboss'||phase==='finalboss')spawnBoss(phase);
  if(phase==='maintenance'){clearHazards();state.player.hp=state.player.maxHp;state.player.vx=state.player.vz=0;state.player.tetherTime=0;state.player.shotCooldown=state.player.dashCooldown=0;resetInput();}
  if(phase==='victory'){clearHazards();state.player.vx=state.player.vz=0;resetInput();emit('victory',{stageId:state.stageId,runId:run});}
  emit('phase',{phase,stageId:state.stageId});
 }
 function makeEnemy(spec,tier='normal',slot=0,total=1){
  const role=roleData[spec.role]?spec.role:'scout',data=roleData[role],level=catalog.stages.findIndex(s=>s.id===state.stageId);
  const boss=tier!=='normal',hp=(boss?(tier==='midboss'?155+level*27:250+level*38):(data.hp+level*3))*tuning().enemyHealth;
  const points=[[-10,-6],[10,-6],[-12,1],[12,1]],p=boss?[0,-6]:points[slot%points.length];
  const e={id:uid('enemy'),assetId:spec.assetId,name:spec.name||role,role,tier,sourceKind:spec.sourceKind||'prototypeUnit',sourceRefs:spec.sourceRefs||state.stage.sourceRefs,x:p[0],z:p[1],angle:-Math.PI/2,hp,maxHp:hp,radius:boss?(role==='heart'||role==='shipyard'?2.3:1.6):.8,speed:data.speed*(boss?.85:1),range:data.range,attack:data.attack,recovery:data.recovery,cooldown:1.2+slot*.55,healCooldown:1.5,healBudget:boss?70:36,attackCount:0,warning:false,hitFlash:0,chargeTime:0,chargeAngle:0,contactCooldown:0};
  state.enemies.push(e);state.spawnLog.push({id:e.id,assetId:e.assetId,tier,role,phase:state.phase,runId:run,time:state.simTime});pushOut(e);
  return e;
 }
 function spawnWave(units=[]){let i=0;const total=units.reduce((n,u)=>n+u.count,0);for(const spec of units)for(let n=0;n<spec.count;n++)makeEnemy(spec,'normal',i++,total);}
 function spawnBoss(tier){if(state.bossSpawnCounts[tier])throw new Error('중복 보스 출현을 차단했습니다.');state.bossSpawnCounts[tier]++;const spec=tier==='midboss'?state.stage.midBoss:state.stage.finalBoss;makeEnemy(spec,tier);}
 function startStage(id){const stage=catalog.stages.find(s=>s.id===id);if(!stage)throw new Error(`없는 전장: ${id}`);run++;sequence=0;accumulator=0;resetInput();state=newState(stage);transition('opening');return getState();}
 function reset(){run++;sequence=0;accumulator=0;resetInput();state=newState(state.stage);emit('reset');return getState();}
 function retry(){return startStage(state.stageId);}
 function pause(value=true){state.paused=!!value;resetInput();accumulator=0;emit('pause',{paused:state.paused});}
 function continueStage(){if(state.phase!=='maintenance')return false;transition('late');return true;}
 function nextStage(){if(state.phase!=='victory')return false;const i=catalog.stages.findIndex(s=>s.id===state.stageId);if(i+1>=catalog.stages.length)return false;startStage(catalog.stages[i+1].id);return true;}
 function setDifficulty(id){if(!['easy','normal','hard'].includes(id))return false;difficulty=id;if(state.phase==='briefing')state.difficulty=id;return true;}
 function setInput(next){for(const k of ['moveX','moveZ','aimX','aimZ'])if(Number.isFinite(next[k]))input[k]=next[k];for(const k of ['fire','dash','autoAim'])if(typeof next[k]==='boolean')input[k]=next[k];}
 function pushOut(entity){
  const margin=entity.radius;entity.x=clamp(entity.x,-18+margin,18-margin);entity.z=clamp(entity.z,-12+margin,12-margin);
  for(const o of state.stage.environment.obstacles||[]){const d=distance(entity,o),r=o.r+margin;if(d<r){const angle=d<1e-6?0:Math.atan2(entity.z-o.z,entity.x-o.x);entity.x=o.x+Math.cos(angle)*r;entity.z=o.z+Math.sin(angle)*r;}}
  entity.x=clamp(entity.x,-18+margin,18-margin);entity.z=clamp(entity.z,-12+margin,12-margin);
 }
 function effect(type,x,z,r=1,duration=.45){state.effects.push({id:uid('effect'),type,x,z,r,age:0,duration});}
 function damagePlayer(amount){
  const p=state.player;if(!combatPhases.has(state.phase)||state.paused||p.invulnerable>0)return false;
  const actual=Math.max(0,amount);p.hp=Math.max(0,p.hp-actual);p.hitFlash=.22;p.invulnerable=.45;state.stats.damageTaken+=actual;effect('hit',p.x,p.z,.7);emit('hit',{amount:actual});
  if(p.hp<=0){state.phase='defeat';state.phaseIndex=-1;state.objective='선체 손상 · 이 판을 다시 출항할 수 있습니다';state.transitionLog.push({to:'defeat',time:state.simTime,runId:run});clearHazards();state.enemies=[];p.vx=p.vz=0;resetInput();emit('defeat',{stageId:state.stageId});}
  return true;
 }
 function damageEnemy(id,amount){
  if(!combatPhases.has(state.phase)||state.paused)return false;const e=state.enemies.find(e=>e.id===id);if(!e||e.hp<=0)return false;
  e.hp=Math.max(0,e.hp-Math.max(0,amount));e.hitFlash=.16;state.stats.hits++;effect('hit',e.x,e.z,.35);
  if(e.hp===0){state.stats.kills++;state.telegraphs=state.telegraphs.filter(t=>t.sourceId!==id);effect('burst',e.x,e.z,e.radius+1,1);if(e.tier!=='normal')state.bossDefeatCounts[e.tier]++;else state.repairPickups.push({id:uid('repair'),x:e.x,z:e.z,r:.5});state.enemies=state.enemies.filter(other=>other.id!==id);emit('enemyDefeated',{id,tier:e.tier});}
  return true;
 }
 function defeatEnemy(id){return damageEnemy(id,1e9);}
 function shoot(source,team,angle,damage,speed=14,maxDistance=null){
  const d=direction(angle),offset=team==='player'?1.5:source.radius+.45;
  state.projectiles.push({id:uid('shot'),sourceId:source.id,team,x:source.x+d.x*offset,z:source.z+d.z*offset,angle,vx:d.x*speed,vz:d.z*speed,r:team==='player'?.1:.18,damage,life:maxDistance?Math.max(.01,maxDistance-offset)/speed:team==='player'?1.6:3.5});
  if(team==='player')state.stats.shots++;
 }
 function choosePattern(e){
  const n=e.attackCount;
  if(e.tier!=='normal'){
   if(e.role==='bell')return n%2?'fan':'ring';
   if(e.role==='shipyard')return n%2?'pressure':'mortar';
   if(e.role==='king')return n%3===2?'charge':n%3===1?'fan':'harpoon';
   if(e.role==='heart')return n%2?'mortar':'pressure';
   if(e.hp<e.maxHp*.5&&n%2===1)return e.role==='charger'?'fan':'mortar';
  }
  return e.attack;
 }
 function beginAttack(e){
  const maxWarnings=state.phase==='late'||state.phase==='finalboss'?2:1;
  if(state.telegraphs.length>=maxWarnings)return;
  const pattern=choosePattern(e),p=state.player,angle=heading(e,p),boss=e.tier!=='normal';
  const duration=Math.max(pattern==='charge'?1.2:pattern==='shot'?1.0:1.5,(boss?1.85:1.6)*(tuning().telegraphTime||1));
  const shape=pattern==='mortar'?'circle':pattern==='ring'?'ring':pattern==='fan'||pattern==='flame'?'cone':'line';
  const telegraph={id:uid('warning'),sourceId:e.id,pattern,shape,x:shape==='circle'?p.x:e.x,z:shape==='circle'?p.z:e.z,angle,length:pattern==='flame'?6:pattern==='charge'?13*.75+e.radius:pattern==='harpoon'?14:pattern==='pressure'?23:12,width:shape==='cone'?(pattern==='flame'?1.05:.65):shape==='ring'?1.6:pattern==='charge'?e.radius*2:1.1,r:shape==='circle'?(boss?2.8:2.2):shape==='ring'?7.3:0,safeAngle:angle+Math.PI/2,safeWidth:1.0,remaining:duration,duration,progress:0,locked:false,targetLockedAt:null,damage:(boss?19:12)*tuning().enemyDamage};
  e.warning=true;e.cooldown=duration+e.recovery;e.attackCount++;state.telegraphs.push(telegraph);state.stats.peakTelegraphs=Math.max(state.stats.peakTelegraphs,state.telegraphs.length);
 }
 function inShape(point,t,padding=0){
  const dx=point.x-t.x,dz=point.z-t.z,d=Math.hypot(dx,dz),a=heading(t,point);
  if(t.shape==='circle')return d<=t.r+padding;
  if(t.shape==='ring')return Math.abs(d-t.r)<=t.width/2+padding&&Math.abs(angleDelta(a,t.safeAngle))>t.safeWidth/2;
  const dir=direction(t.angle),along=dx*dir.x+dz*dir.z,across=Math.abs(dx*dir.z-dz*dir.x);
  if(t.shape==='cone')return d<=t.length+padding&&along>=-padding&&Math.abs(angleDelta(a,t.angle))<=t.width/2+padding/Math.max(d,1);
  return along>=-padding&&along<=t.length+padding&&across<=t.width/2+padding;
 }
 function releaseAttack(t){
  const e=state.enemies.find(e=>e.id===t.sourceId);if(!e||state.phase==='defeat')return;e.warning=false;
  if(t.pattern==='shot'||t.pattern==='fan'||t.pattern==='harpoon'){
   const spread=t.pattern==='fan'?[-.27,-.135,0,.135,.27]:t.pattern==='shot'?[-.05,0,.05]:[0];
   for(const delta of spread){shoot(e,'enemy',t.angle+delta,t.damage,t.pattern==='harpoon'?15:11,t.length);if(t.pattern==='harpoon')state.projectiles.at(-1).tether=true;}
  }else if(t.pattern==='charge'){e.chargeTime=.75;e.chargeAngle=t.angle;effect('charge',e.x,e.z,1,.6);}
  else if(inShape(state.player,t,state.player.radius*.45)){damagePlayer(t.damage);}
  if(['mortar','ring','flame','pressure'].includes(t.pattern))state.effects.push({...t,id:uid('impact'),type:'attack',age:0,duration:.45});
 }
 function segmentDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz,t=length?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/length,0,1):0;return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
 function updateProjectiles(dt){
  const survivors=[];
  for(const shot of state.projectiles){
   const before={x:shot.x,z:shot.z};shot.x+=shot.vx*dt;shot.z+=shot.vz*dt;shot.life-=dt;
   if(shot.life<=0||Math.abs(shot.x)>20||Math.abs(shot.z)>14)continue;
   if((state.stage.environment.obstacles||[]).some(o=>segmentDistance(o,before,shot)<o.r+shot.r)){effect('spark',shot.x,shot.z,.3);continue;}
   if(shot.team==='player'){
    const target=state.enemies.find(e=>segmentDistance(e,before,shot)<e.radius+shot.r);
    if(target){damageEnemy(target.id,shot.damage);continue;}
   }else{
    if(state.enemies.some(e=>e.id!==shot.sourceId&&segmentDistance(e,before,shot)<e.radius+shot.r))continue;
    if(segmentDistance(state.player,before,shot)<state.player.radius+shot.r){if(damagePlayer(shot.damage)&&shot.tether)state.player.tetherTime=1.3;continue;}
   }
   survivors.push(shot);
  }
  state.projectiles=state.phase==='defeat'?[]:survivors;
 }
 function advance(dt){
  if(state.paused||!combatPhases.has(state.phase))return;
  state.simTime+=dt;state.bannerTime=Math.max(0,state.bannerTime-dt);const p=state.player;
  for(const key of ['hitFlash','shotCooldown','dashCooldown','dashTime','invulnerable','tetherTime'])p[key]=Math.max(0,p[key]-dt);
  const nearest=state.enemies.reduce((found,e)=>!found||distance(p,e)<distance(p,found)?e:found,null);
  const target=input.autoAim&&nearest?nearest:{x:input.aimX,z:input.aimZ};p.targetX=target.x;p.targetZ=target.z;p.aimAngle=heading(p,target);p.angle+=clamp(angleDelta(p.aimAngle,p.angle),-3.8*dt,3.8*dt);
  const norm=Math.hypot(input.moveX,input.moveZ),mx=norm>1?input.moveX/norm:input.moveX,mz=norm>1?input.moveZ/norm:input.moveZ;
  if(input.dash&&p.dashCooldown<=0){p.dashTime=.23;p.dashCooldown=3.4;p.invulnerable=.34;effect('dash',p.x,p.z,1,.5);emit('dash');}input.dash=false;p.dashing=p.dashTime>0;
  const speed=p.dashing?17:p.tetherTime>0?3.5:5.5,blend=1-Math.exp(-dt*9),dashDirection=direction(p.angle);
  const vx=(p.dashing&&norm<.1?dashDirection.x:mx)*speed,vz=(p.dashing&&norm<.1?dashDirection.z:mz)*speed;
  p.vx+=(vx-p.vx)*blend;p.vz+=(vz-p.vz)*blend;p.x+=p.vx*dt;p.z+=p.vz*dt;pushOut(p);
  if(input.fire&&p.shotCooldown<=0&&Math.abs(angleDelta(p.aimAngle,p.angle))<.35){shoot(p,'player',p.aimAngle,12,27);p.shotCooldown=.18;}
  for(const e of [...state.enemies]){
   e.hitFlash=Math.max(0,e.hitFlash-dt);e.cooldown-=dt;e.contactCooldown=Math.max(0,e.contactCooldown-dt);e.healCooldown-=dt;
   const activeWarning=state.telegraphs.find(t=>t.sourceId===e.id);
   const targetAngle=activeWarning?.locked?activeWarning.angle:heading(e,p);e.aimAngle=targetAngle;e.angle+=clamp(angleDelta(targetAngle,e.angle),-dt*1.45,dt*1.45);
   if(e.chargeTime>0){e.chargeTime=Math.max(0,e.chargeTime-dt);const d=direction(e.chargeAngle),next={x:e.x+d.x*13*dt,z:e.z+d.z*13*dt};if((state.stage.environment.obstacles||[]).some(o=>distance(next,o)<o.r+e.radius))e.chargeTime=0;else{e.x=next.x;e.z=next.z;}if(distance(e,p)<e.radius+p.radius&&e.contactCooldown<=0){damagePlayer(21*tuning().enemyDamage);e.contactCooldown=.8;}}
   else if(!e.warning&&e.speed){
    const d=distance(e,p),dir=direction(targetAngle),desired=e.role==='flame'?4.5:e.role==='charger'?7:e.range*.74;
    const move=d>desired?1:d<desired-2?-.6:0,orbit=e.role==='scout'?.55:0;
    e.x+=(dir.x*move+dir.z*orbit)*e.speed*dt;e.z+=(dir.z*move-dir.x*orbit)*e.speed*dt;
   }
   pushOut(e);
   if(e.role==='repair'&&e.healBudget>0&&e.healCooldown<=0){const ally=state.enemies.find(a=>a!==e&&a.hp<a.maxHp-1&&distance(a,e)<7);if(ally){const amount=Math.min(7,e.healBudget,ally.maxHp-ally.hp);ally.hp+=amount;e.healBudget-=amount;effect('heal',ally.x,ally.z,1,.6);}e.healCooldown=2;}
   if(e.cooldown<=0&&!e.warning&&distance(e,p)<=e.range+2)beginAttack(e);
  }
  // Separate hulls gently; no instant turning or stacked ships.
  for(let i=0;i<state.enemies.length;i++)for(let j=i+1;j<state.enemies.length;j++){const a=state.enemies[i],b=state.enemies[j],d=distance(a,b),min=a.radius+b.radius+.45;if(d<min&&d>1e-5){const k=(min-d)*.5,dx=(a.x-b.x)/d,dz=(a.z-b.z)/d;a.x+=dx*k;a.z+=dz*k;b.x-=dx*k;b.z-=dz*k;}}
  const pending=[];
  for(const t of state.telegraphs){
   const e=state.enemies.find(e=>e.id===t.sourceId);if(!e)continue;t.remaining-=dt;t.progress=clamp(1-t.remaining/t.duration,0,1);
   if(!t.locked&&t.remaining>.4){if(t.shape==='circle'){t.x=p.x;t.z=p.z;}else if(t.shape!=='ring'){t.angle=heading(e,p);}if(t.shape!=='circle'){t.x=e.x;t.z=e.z;}}
   else if(!t.locked){t.locked=true;t.targetLockedAt=state.simTime;}
   if(t.remaining<=0)releaseAttack(t);else pending.push(t);
  }
  state.telegraphs=state.phase==='defeat'?[]:pending;
  updateProjectiles(dt);
  state.repairPickups=state.repairPickups.filter(r=>{if(distance(r,p)<1.3){p.hp=Math.min(p.maxHp,p.hp+12);state.stats.repairs++;effect('heal',p.x,p.z,1,.5);return false;}return true;});
  state.effects=state.effects.filter(e=>{e.age+=dt;return e.age<e.duration;});
  // Terminal defeat wins a same-tick tie. Cleared enemies can never advance it.
  if(state.phase==='defeat')return;
  if(state.enemies.length===0){if(state.phase==='opening')transition('midboss');else if(state.phase==='midboss')transition('maintenance');else if(state.phase==='late')transition('finalboss');else if(state.phase==='finalboss')transition('victory');}
 }
 function update(seconds){if(!Number.isFinite(seconds)||seconds<0)return;accumulator+=Math.min(seconds,.2);while(accumulator+1e-9>=STEP){advance(STEP);accumulator-=STEP;}}
 function step(seconds){if(!Number.isFinite(seconds)||seconds<0||seconds>600)throw new Error('유효하지 않은 검사 시간');for(let i=0,n=Math.round(seconds/STEP);i<n;i++)advance(STEP);return getState();}
 function getState(){return JSON.parse(JSON.stringify(state));}
 return{getState,snapshot:()=>state,update,step,startStage,pause,retry,reset,continue:continueStage,nextStage,setInput,setDifficulty,defeatEnemy,damagePlayer,damageEnemy,inShape};
}
