// Derived from the frozen integration controller; original stays unchanged.
import encounterCatalog from 'cloudstitch/encounter-catalog';
import {createEncounterDirector} from 'cloudstitch/encounter-director';
import {describeAttack} from 'cloudstitch/attack-intents';
import {allocateAttackTokens} from 'cloudstitch/attack-budget';
import {createBattlefieldAdapter} from 'cloudstitch/battlefield-adapter';
import {setEnemyIntent,moduleWorldPosition,segmentCircleT} from 'cloudstitch/sim';
import {levels} from 'cloudstitch/base-levels';
import {prepareDeparture,commitDeparture,acceptReturn,storeCargo} from '../harbor/core.mjs';
import {adaptBattlefieldReturn,createDepartureManifest} from '../harbor/adapters.mjs';
import {computeBudget,previewInstall,installPart,quoteRepair,confirmRepair} from '../shipyard/shipyard.mjs';
import {createSaveRepository} from '../save/save.mjs';
import {battlefieldWorld,spawnCandidates,proxyModules,eventKey} from 'cloudstitch/base-contract';
import {CAMPAIGN_SAVE_KEY,currentMap,completeCampaignStage,advanceCampaignStage,migrateLegacyState,validateLegacyState} from './campaign.mjs';
import {prepareCampaignStorage} from './storage.mjs';
import {stageMaps} from '../stage-maps/maps.mjs';

const copy=value=>structuredClone(value);
export function memoryStorage(){const entries=new Map();return {getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,String(value)),removeItem:key=>entries.delete(key)};}

/** One combat owner, one harbor ledger, and a read-only encounter sequencer. */
export async function createCampaignController({storage=memoryStorage(),muzzleResolver=null}={}) {
  const nativeStorage=storage,prepared=prepareCampaignStorage({storage}),saveKey=CAMPAIGN_SAVE_KEY;
  storage=prepared.storage;
  const repository=prepared.repository,port=levels.find(l=>l.id==='jonghang-harbor');
  let harbor=prepared.loaded.state,adapter=null,director=createEncounterDirector(encounterCatalog),phase='harbor';
  let map=currentMap(harbor),sea=map.seaLevel,world=battlefieldWorld(sea),candidates=spawnCandidates(sea);
  let status='종항에서 첫 항해를 준비하세요.',saveStatus='아직 저장하지 않았습니다.',saveRevision=0,dirty=false,commandSeq=0,lastSaveError=null;
  let lastDelivered=0,roles=new Map(),attackCounts=new Map(),lastEvents=[],departureCheckpoint=null,settlementPending=null;
  const load=prepared.loaded;
  if(load.ok){harbor=load.state;saveRevision=load.revision;saveStatus=load.message;status=harbor.activeVoyage?'출항 직전 저장을 불러왔습니다. 같은 항해로 이어갑니다.':'저장한 항구 기록을 불러왔습니다.';}
  else if(load.code!=='NOT_FOUND'){saveStatus=load.message;status=load.message;}

  function configureRoute(){
    map=currentMap(harbor);sea=map.seaLevel;world=battlefieldWorld(sea);candidates=spawnCandidates(sea);
    adapter=null;director=createEncounterDirector(encounterCatalog);settlementPending=null;departureCheckpoint=null;
    lastDelivered=0;lastEvents=[];roles.clear();attackCounts.clear();
  }
  function completionProof(){
    const stage=director.snapshot();
    return stage.stageId===map.stageId&&stage.phase==='victory'&&!stage.clearance&&stage.activeEnemyIds.length===0&&
      stage.bossDefeatCounts.midboss===1&&stage.bossDefeatCounts.finalboss===1;
  }

  function result(ok,message,detail={}){status=message;return {ok,reason:ok?undefined:message,...detail};}
  function persist(candidate=harbor,boundary=candidate.boundary){
    const saved=repository.save(candidate,{expectedRevision:saveRevision,boundary});saveStatus=saved.message;
    lastSaveError=saved.ok?null:saved.code;
    if(saved.ok){saveRevision=saved.revision;dirty=false;}else dirty=true;
    return saved;
  }
  function commandBattle(type,detail={}){return adapter.dispatch({id:`${harbor.activeVoyage?.id||'port'}:${adapter.generation}:${++commandSeq}`,type,...detail});}
  function candidatesNow(){
    const sim=adapter?.state;
    return candidates.map(candidate=>({...candidate,safe:!sim||Math.hypot(candidate.x-sim.player.x,candidate.z-sim.player.z)>sim.player.radius+5.3+2}));
  }
  function loadout(sourceState=harbor){
    const manifest=createDepartureManifest(sourceState),budget=computeBudget(sourceState);
    const moduleType={machinegun:'machinegun',hook:'hook',hull:'hull',engine:'engine',balloon:'balloon'};
    const modules=manifest.installed.map((p,index)=>({id:p.id,harborPartId:p.id,key:p.id===manifest.rootId?'root':p.id,type:moduleType[p.kind]||p.kind,name:p.name,parentId:p.parentId,hp:p.hp,maxHp:p.maxHp,weight:p.weight,lift:p.lift||0,powerOutput:p.powerSupply||0,powerDraw:p.powerDemand||0,localX:0,localZ:index===3?3.8:0,radius:p.kind==='hull'?3:.6}));
    const root=modules.find(m=>m.key==='root');
    return {hp:root.hp,maxHp:root.maxHp,baseWeight:budget.installedWeight,lift:budget.lift,powerOutput:budget.powerSupply,powerDraw:budget.powerDemand,crewWeight:sourceState.ship.passengerWeight,scrap:sourceState.resources.S,modules};
  }
  function drainDirector(){
    let commands=director.drainCommands();
    for(let guard=0;commands.length&&guard<12;guard++){
      for(const cmd of commands){
        if(cmd.runId!==director.snapshot().runId) continue;
        if(cmd.type==='clear-combat'){
          const clear=commandBattle('clear-combat',{reason:cmd.reason});
          if(!clear.ok)throw new Error(clear.reason);
          roles.clear();attackCounts.clear();
          director.acknowledgeClearance({runId:cmd.runId,commandId:cmd.commandId,remainingHazards:adapter.state.projectiles.length,remainingEnemies:adapter.state.enemies.length});
        }
        if(cmd.type==='spawn-enemy'){
          const descriptor={id:cmd.enemyId,assetId:cmd.assetId,name:cmd.name,role:cmd.role,tier:cmd.tier,x:cmd.x,z:cmd.z};
          if(!['enemy-tax-cutter','enemy-pirate-scout','enemy-union-salvage'].includes(cmd.assetId))descriptor.modules=proxyModules(cmd);
          const spawned=commandBattle('spawn',{enemy:descriptor});if(!spawned.ok)throw new Error(spawned.reason);
          roles.set(cmd.enemyId,cmd);attackCounts.set(cmd.enemyId,0);
        }
        if(cmd.type==='maintenance-ready'){commandBattle('pause');status='중간 교전 완료 · 정비 뒤 다음 구간을 선택하세요.';}
        if(cmd.type==='region-completed'){status='교전을 마쳤습니다. 회수품과 함께 종항 부두로 돌아오세요.';}
      }
      commands=director.drainCommands();
    }
    if(commands.length)throw new Error('Encounter command overflow');
  }
  function beginCombat(){
    const config={world,enemySpawns:[],loadout:loadout(),muzzleResolver};
    if(adapter?.state.outcome==='victory')adapter.depart(config);else adapter=createBattlefieldAdapter(config);
    lastDelivered=0;lastEvents=[];roles=new Map();attackCounts=new Map();
    director=createEncounterDirector(encounterCatalog);director.startStage(map.stageId,candidates);drainDirector();
    departureCheckpoint=copy(harbor);phase='sailing';settlementPending=null;
  }
  function depart(){
    if(phase==='sailing'||phase==='defeat')return result(false,'항해 중에는 새 항해를 시작할 수 없습니다.');
    if(dirty)return result(false,'항구의 변경 사항을 먼저 저장하세요.');
    if(harbor.campaign.completedStages.length>harbor.campaign.currentStageIndex)return result(false,harbor.campaign.completedStages.length===6?'여섯 항로를 모두 마쳤습니다. 항구의 함선과 기록을 보관했습니다.':'이 항로는 완료했습니다. 다음 항로로 이동하세요.');
    if(harbor.parts.some(p=>p.location==='cargo'))return result(false,'선내 화물을 먼저 창고에 보관한 뒤 출항하세요.');
    let prepared=harbor.activeVoyage?{ok:true,state:harbor}:prepareDeparture(harbor);
    if(!prepared.ok)return result(false,prepared.message);
    // Validate the complete runtime before committing a departure boundary.
    createBattlefieldAdapter({world,enemySpawns:[],loadout:loadout(prepared.state),muzzleResolver});
    const preflightDirector=createEncounterDirector(encounterCatalog);preflightDirector.startStage(map.stageId,candidates);
    const saved=persist(prepared.state,'departure');
    if(!saved.ok)return result(false,saved.message);
    const committed=commitDeparture(prepared.state);if(!committed.ok)return result(false,committed.message);
    harbor=committed.state;beginCombat();return result(true,'출항했습니다. 적선의 무장을 살펴보세요.');
  }
  function updateIntents(){
    const sim=adapter.state;
    const permitted=new Set(allocateAttackTokens({units:sim.enemies.filter(e=>!e.defeated).map(e=>{
      const cannon=e.modules.find(m=>m.key==='cannon'&&m.attached&&m.hp>0),from=cannon&&moduleWorldPosition(e,cannon);
      const reachable=from&&!sim.obstacles.some(o=>segmentCircleT(from.x,from.z,sim.player.x,sim.player.z,o.x,o.z,o.radius)!==null);
      // Conservative admission facts; the actual muzzle/hull obstruction remains sim authority.
      return {enemyId:e.id,warningActive:!!e.telegraph,ready:!!cannon&&!!reachable&&e.cooldown<=1e-8&&Math.hypot(e.x-sim.player.x,e.z-sim.player.z)<=72};
    }),maxTokens:director.snapshot().majorAttackTokens}).permittedEnemyIds);
    for(const enemy of sim.enemies){
      if(enemy.defeated)continue;
      const descriptor=roles.get(enemy.id);if(!descriptor)continue;
      const dx=sim.player.x-enemy.x,dz=sim.player.z-enemy.z,d=Math.hypot(dx,dz)||1;
      // Intent only: battlefield determines actual movement, warnings and hits.
      const attack=describeAttack({role:descriptor.role,tier:descriptor.tier,attackIndex:attackCounts.get(enemy.id)||0,healthFraction:enemy.hp/enemy.maxHp});
      const advance=d>35?1:d<19?-.5:0,strafe=descriptor.role==='scout'?.35:0;
      const move={x:(dx*advance-dz*strafe)/d,z:(dz*advance+dx*strafe)/d};
      setEnemyIntent(sim,enemy.id,{move,attackTarget:attack&&permitted.has(enemy.id)?{x:sim.player.x,z:sim.player.z}:null});
    }
  }
  function advance(dt,input={}){
    if(phase!=='sailing'||!adapter||adapter.state.paused)return;
    updateIntents();adapter.advance(Math.min(Math.max(dt,0),.1),input);
    const sim=adapter.state,events=adapter.drainEvents();lastEvents=events;
    for(const entry of events){
      eventKey(harbor.activeVoyage.id,entry.generation,entry.seq);if(entry.seq<=lastDelivered)continue;lastDelivered=entry.seq;
      if(entry.type==='enemy-fire')attackCounts.set(entry.enemyId,(attackCounts.get(entry.enemyId)||0)+1);
      if(entry.type==='enemy-defeated')director.enemyDefeated({runId:director.snapshot().runId,enemyId:entry.enemyId});
    }
    if(sim.outcome==='defeat'){director.playerDefeated({runId:director.snapshot().runId,reason:sim.endReason});drainDirector();phase='defeat';status='항해에 실패했습니다. 출항 직전 상태에서 다시 도전할 수 있습니다.';return;}
    director.advance(candidatesNow());drainDirector();
  }
  function settle(){
    const sim=adapter.state,voyageId=harbor.activeVoyage?.id;
    if(!settlementPending){
      const spentScrap=Math.max(0,(departureCheckpoint?.resources.S||0)-sim.resources.scrap);
      const adapted=adaptBattlefieldReturn(sim,{voyageId,settlementId:`${voyageId}:return`,ownerId:harbor.ownerId,rootId:harbor.ship.rootId,installedParts:harbor.parts.filter(p=>p.location==='installed'),spent:{S:spentScrap,F:0,C:0}});
      if(!adapted.ok)return result(false,adapted.message);
      // A cleared opening/mid-wave is still an early withdrawal from this region.
      if(!completionProof())adapted.result.outcome='withdrawn';
      settlementPending=adapted.result;
    }
    const accepted=acceptReturn(harbor,settlementPending);if(!accepted.ok)return result(false,accepted.message);
    let candidate=accepted.state;
    if(completionProof()){
      const completed=completeCampaignStage(candidate,{stageId:map.stageId,voyageId:settlementPending.voyageId,phase:'victory',midBossDefeats:1,finalBossDefeats:1});
      if(!completed.ok)return result(false,completed.message);candidate=completed.state;
    }
    harbor=candidate;phase='harbor';dirty=true;
    const saved=persist(harbor,'return');
    return result(saved.ok,saved.ok?(completionProof()?(harbor.campaign.completedStages.length===6?'여섯 항로의 완료와 귀환 정산을 저장했습니다. 함선과 항해 기록을 보관했습니다.':'항로 완료와 귀환 정산을 함께 저장했습니다. 정비 후 다음 항로로 이동하세요.'):'철수 정산을 저장했습니다. 함선을 정비하고 같은 항로에 다시 도전하세요.'):saved.message,{receipt:accepted.receipt});
  }
  function command(type,payload={}){
    try{
      if(type==='depart')return depart();
      if(type==='pause'||type==='resume'){
        if(phase!=='sailing')return result(false,'항해 중에만 사용할 수 있습니다.');
        if(type==='resume'&&director.snapshot().phase==='maintenance')return result(false,'정비 완료를 선택하세요.');
        const action=commandBattle(type);return result(action.ok,type==='pause'?'항해를 잠시 멈췄습니다.':'항해를 계속합니다.');
      }
      if(type==='salvage'){
        if(phase!=='sailing')return result(false,'항해 중에만 인양할 수 있습니다.');
        const action=commandBattle('salvage');return result(action.ok,action.ok?'회수한 부품을 화물로 실었습니다.':'가까이에 회수할 부품이 없습니다.');
      }
      if(type==='return'){
        if(phase==='harbor'&&settlementPending){if(dirty){const saved=persist(harbor,'return');return result(saved.ok,saved.message);}return result(true,'이미 정산한 항해입니다.');}
        if(phase!=='sailing')return result(false,'항해 중에만 귀환할 수 있습니다.');
        if(adapter.state.outcome==='victory')return settle();
        const action=commandBattle('return');if(!action.ok)return result(false,'종항 귀환 표식 가까이에서 회수품과 함께 귀환하세요.');
        return settle();
      }
      if(type==='maintenance'){
        if(phase!=='sailing'||director.snapshot().phase!=='maintenance')return result(false,'지금은 정비 구간이 아닙니다.');
        director.continue(candidatesNow());drainDirector();commandBattle('resume');return result(true,'후반 교전을 시작합니다.');
      }
      if(type==='retry'){
        if(phase!=='defeat')return result(false,'패배한 항해만 다시 도전할 수 있습니다.');
        harbor=copy(departureCheckpoint);adapter.retry();lastDelivered=0;lastEvents=[];roles.clear();attackCounts.clear();
        director.retry(candidatesNow());drainDirector();phase='sailing';settlementPending=null;
        return result(true,'같은 항해를 출항 직전 상태에서 다시 시작합니다.');
      }
      if(phase!=='harbor')return result(false,'이 기능은 항구에서 사용할 수 있습니다.');
      if(type==='next-stage'){
        if(dirty)return result(false,'현재 함선과 정산을 먼저 저장하세요.');
        const next=advanceCampaignStage(harbor);if(!next.ok)return result(false,next.message);
        const saved=repository.save(next.state,{expectedRevision:saveRevision,boundary:next.state.boundary});
        saveStatus=saved.message;lastSaveError=saved.ok?null:saved.code;
        if(!saved.ok)return result(false,'다음 항로를 저장하지 못했습니다. 현재 항로와 재산을 보존했습니다.');
        harbor=next.state;saveRevision=saved.revision;dirty=false;configureRoute();
        return result(true,`${map.name}에 도착했습니다. 같은 함선과 창고로 항해를 이어갑니다.`);
      }
      if(type==='import-legacy'){
        if(harbor.activeVoyage||harbor.voyageSequence!==0||harbor.settlements.length||harbor.campaignImport)return result(false,'이전 기록은 연속 항해의 첫 출항 전에만 가져올 수 있습니다.');
        const legacyMap=stageMaps.find(item=>item.id===payload.mapId);if(!legacyMap)return result(false,'가져올 항로를 선택하세요.');
        const legacy=createSaveRepository({storage:nativeStorage,key:`cloudstitch.stage-maps.v1.${legacyMap.id}`,validateState:state=>validateLegacyState(state,legacyMap)}).load();
        if(!legacy.ok)return result(false,`이전 항로를 가져오지 못했습니다. ${legacy.message}`);
        const migration=migrateLegacyState(legacy.state,legacyMap);if(!migration.ok)return result(false,migration.message);
        const saved=repository.save(migration.state,{expectedRevision:saveRevision,boundary:migration.state.boundary});
        saveStatus=saved.message;lastSaveError=saved.ok?null:saved.code;
        if(!saved.ok)return result(false,'가져온 함선을 저장하지 못했습니다. 두 기존 기록을 그대로 보존했습니다.');
        harbor=migration.state;saveRevision=saved.revision;dirty=false;configureRoute();
        return result(true,'이전 함선·장착품·창고·자원을 가져왔습니다. 연속 항해는 1단계부터 시작합니다.');
      }
      if(type==='store'){const action=storeCargo(harbor);if(action.ok){harbor=action.state;dirty=true;}return result(action.ok,action.ok?'화물을 창고로 옮겼습니다.':action.message);}
      if(type==='repair'){const quote=quoteRepair(harbor),action=confirmRepair(harbor,quote);if(action.ok){harbor=action.state;dirty=true;}return result(action.ok,action.ok?`스크랩 ${action.actualCost.S}을 써서 수리했습니다.`:action.reasons?.join(' '));}
      if(type==='equip'){const action=installPart(harbor,payload.partId,payload.slotId);if(action.ok){harbor=action.state;dirty=true;}return result(action.ok,action.ok?'선택한 부품을 장착했습니다.':action.reasons?.join(' '),{before:action.before,after:action.after});}
      if(type==='save'){const saved=persist();return result(saved.ok,saved.message);}
      if(type==='restore'){
        if(dirty&&lastSaveError!=='REVISION_CONFLICT')return result(false,'현재 항구 변경을 먼저 저장하세요.');
        if(dirty){
          try{storage.setItem(`${saveKey}.conflict`,JSON.stringify({schemaVersion:1,state:harbor,saveRevision,reason:lastSaveError}));}
          catch{return result(false,'충돌한 현재 상태를 보존하지 못했습니다. 새 저장을 불러오지 않았습니다.');}
        }
        const restored=repository.load();if(!restored.ok)return result(false,restored.message);
        harbor=restored.state;saveRevision=restored.revision;saveStatus=restored.message;dirty=false;lastSaveError=null;configureRoute();return result(true,restored.message);
      }
      return result(false,'알 수 없는 동작입니다.');
    }catch(error){return result(false,error.message);}
  }
  function snapshot(){
    const budget=computeBudget(harbor),quote=quoteRepair(harbor),stage=director.snapshot();
    const count=harbor.campaign.completedStages.length;
    return {version:1,phase,paused:!!adapter?.state.paused,voyageId:harbor.activeVoyage?.id||harbor.settlements.at(-1)?.voyageId||null,status,
      sim:adapter?.state||null,events:lastEvents,stage:{...stage,title:map.name},level:phase==='harbor'?port:sea,routeMap:map,
      campaign:{...copy(harbor.campaign),completed:count,totalStages:6,campaignComplete:count===6,canAdvance:phase==='harbor'&&!dirty&&!harbor.activeVoyage&&count>harbor.campaign.currentStageIndex&&harbor.campaign.currentStageIndex<5},
      harbor:{resourcesText:`스크랩 ${harbor.resources.S} · 연료 ${harbor.resources.F} · 봉인 천 ${harbor.resources.C}`,totalsText:`중량 ${budget.weight} / 양력 ${budget.lift} · 전력 ${budget.powerDemand} / ${budget.powerSupply}`,
        inventory:harbor.parts.map(p=>({id:p.id,label:p.name,status:p.location,slotId:p.socketId,canEquip:p.location!=='installed'&&p.parentId===null,hp:p.hp,maxHp:p.maxHp,weight:p.weight})),
        slots:harbor.ship.sockets.filter(s=>s.enabled&&harbor.parts.some(p=>p.id===s.parentId&&p.location==='installed')).map(s=>({id:s.id,label:`${s.id} · ${s.kinds.join('/')}`})),
        repair:{costText:`스크랩 ${quote.cost.S} · 내구도 ${quote.recovery} 회복`,canRepair:quote.ok&&quote.recovery>0&&harbor.resources.S>=quote.cost.S},saveStatus,dirty,canRestore:!dirty||lastSaveError==='REVISION_CONFLICT',settlements:harbor.settlements.length},
      limits:['Six sequential prototype regions with one persistent harbor ledger','Aggregate proxy collision on additional fleet assets','Role intents reduced to warned training shots; full canonical boss patterns remain independent','Battle economy has zero invented rewards','Combat reload resumes the departure checkpoint of the same stage and voyage','Visual socket editing is provisional']};
  }
  return {snapshot,advance,command,previewEquip:(partId,slotId)=>previewInstall(harbor,partId,slotId),setMuzzleResolver(resolver){muzzleResolver=resolver;if(adapter)adapter.state.muzzleResolver=resolver;},get state(){return harbor;},get battlefield(){return adapter;},get encounter(){return director;},get repository(){return repository;},get settlement(){return settlementPending;}};
}
