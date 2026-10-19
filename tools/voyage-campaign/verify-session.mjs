import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),self=fileURLToPath(import.meta.url);
const runtime=await import(pathToFileURL(path.join(root,'work/voyage-campaign/runtime.mjs')));
const {createCampaignController,memoryStorage,runCampaignSortie,runRetreatSortie,CAMPAIGN_SAVE_KEY}=runtime;
const stable=value=>JSON.parse(JSON.stringify(value)),ok=result=>assert.equal(result.ok,true,JSON.stringify(result));
const runDir=process.argv[2]==='--resume'?process.argv[3]:path.join(root,'work/voyage-campaign/verification',`${Date.now()}-${process.pid}`);
fs.mkdirSync(runDir,{recursive:true});const storeFile=path.join(runDir,'journal-store.json');
let entries=fs.existsSync(storeFile)?JSON.parse(fs.readFileSync(storeFile,'utf8')):{};
let failWrite=false;
const storage={getItem:key=>entries[key]??null,setItem(key,value){if(failWrite)throw Error('verification write failure');const next={...entries,[key]:String(value)},temp=`${storeFile}.${process.pid}.tmp`;fs.writeFileSync(temp,JSON.stringify(next));fs.renameSync(temp,storeFile);entries=next;}};
let controller=await createCampaignController({storage});
if(process.argv[2]==='--resume'){
 const expected=JSON.parse(fs.readFileSync(path.join(runDir,'expected.json'),'utf8'));assert.deepEqual(stable(controller.state),expected);
 assert.equal(controller.snapshot().campaign.campaignComplete,true);assert.equal(controller.state.campaign.currentStageIndex,5);
 ok(controller.command('restore'));assert.deepEqual(stable(controller.state),expected);
 assert.equal(controller.command('next-stage').ok,false);assert.equal(controller.command('depart').ok,false);
 console.log(JSON.stringify({freshProcess:true,campaignComplete:true,completed:6,parts:expected.parts.length,resources:expected.resources}));process.exit(0);
}
const checks=[];
assert.equal(controller.command('next-stage').ok,false);assert.equal(controller.state.campaign.currentStageIndex,0);checks.push('locked-next-stage');
// Real early retreat must retain progress on the same stage.
const retreatStorage=memoryStorage(),retreat=await createCampaignController({storage:retreatStorage});
const early=runRetreatSortie(retreat);assert.equal(early.returned,true,JSON.stringify(early));
assert.equal(retreat.state.campaign.completedStages.length,0);assert.equal(retreat.state.settlements.at(-1).outcome,'withdrawn');assert.equal(retreat.command('next-stage').ok,false);checks.push('actual-early-retreat-does-not-unlock');
// Copy one real safe legacy harbor without modifying or combining source slots.
ok(retreat.command('store'));if(retreat.snapshot().harbor.repair.canRepair)ok(retreat.command('repair'));ok(retreat.command('save'));
const legacy=stable(retreat.state);delete legacy.campaign;
const legacyKey='cloudstitch.stage-maps.v1.map-01-harbor';
const seedRepo=runtime.createSaveRepository({storage:retreatStorage,key:legacyKey,validateState:state=>runtime.validateLegacyState(state,'map-01-harbor')});ok(seedRepo.save(legacy,{expectedRevision:0,boundary:legacy.boundary}));
const oldRaw=retreatStorage.getItem(legacyKey),migrationStorage=memoryStorage();migrationStorage.setItem(legacyKey,oldRaw);migrationStorage.setItem('cloudstitch.integration.v1','preserved-unread-slot');
let migrationWriteFailure=false;
const migrationAdapter={getItem:key=>migrationStorage.getItem(key),setItem(key,value){if(migrationWriteFailure&&key===CAMPAIGN_SAVE_KEY)throw Error('import write failed');migrationStorage.setItem(key,value);}};
let imported=await createCampaignController({storage:migrationAdapter});const originalNew=stable(imported.state);
migrationWriteFailure=true;assert.equal(imported.command('import-legacy',{mapId:'map-01-harbor'}).ok,false);assert.deepEqual(stable(imported.state),originalNew);
migrationWriteFailure=false;ok(imported.command('import-legacy',{mapId:'map-01-harbor'}));
for(const key of ['ship','parts','resources','settlements','repairReceipts','voyageSequence','profileId','ownerId'])assert.deepEqual(imported.state[key],legacy[key]);
assert.equal(imported.state.campaign.currentStageIndex,0);assert.equal(imported.state.campaign.completedStages.length,0);
assert.equal(migrationStorage.getItem(legacyKey),oldRaw);assert.equal(migrationStorage.getItem('cloudstitch.integration.v1'),'preserved-unread-slot');
assert.equal(imported.command('import-legacy',{mapId:'map-01-harbor'}).ok,false);
const migrationSaved=stable(imported.state);imported=await createCampaignController({storage:migrationAdapter});assert.deepEqual(stable(imported.state),migrationSaved);checks.push('real-safe-legacy-import-and-failure-preserve-source');
// Actual warned enemy damage creates a defeat, then retry restores the same voyage.
const retry=await createCampaignController({storage:memoryStorage()});ok(retry.command('depart'));
const retryId=retry.state.activeVoyage.id,retryCheckpoint=stable(retry.state),generation=retry.battlefield.generation,run=retry.encounter.snapshot().runId;
for(let step=0;step<6000&&retry.snapshot().phase==='sailing';step++)retry.advance(.05,{});
assert.equal(retry.snapshot().phase,'defeat');assert.equal(retry.command('next-stage').ok,false);ok(retry.command('retry'));
assert.equal(retry.state.activeVoyage.id,retryId);assert.deepEqual(stable(retry.state),retryCheckpoint);assert.ok(retry.battlefield.generation>generation);assert.ok(retry.encounter.snapshot().runId>run);assert.equal(retry.state.campaign.completedStages.length,0);checks.push('actual-defeat-retry-keeps-same-voyage-assets-and-progress');
const voyages=[];let equippedId=null;
for(let index=0;index<6;index++){
 const before=stable(controller.state),resourcesBefore=stable(before.resources);
 assert.equal(before.campaign.currentStageIndex,index);
 ok(controller.command('depart'));const staged=controller.repository.load();ok(staged);const id=controller.state.activeVoyage.id;
 controller=await createCampaignController({storage});assert.deepEqual(stable(controller.state),stable(staged.state));assert.equal(controller.state.activeVoyage.id,id);
 // Use the real pilot from the same departure checkpoint; no artificial kills.
 let damagePreludeSteps=0;
 if(index===0){ok(controller.command('depart'));for(;damagePreludeSteps<1200&&controller.snapshot().sim.player.hp===controller.snapshot().sim.player.maxHp;damagePreludeSteps++)controller.advance(.05,{});assert.ok(controller.snapshot().sim.player.hp<100);}
 const rawDeparture=entries[CAMPAIGN_SAVE_KEY];
 const result=runCampaignSortie(controller,{maxSteps:24000,dt:.05,depart:index!==0,onStep(snapshot){if(index===0&&snapshot.phase==='sailing'&&snapshot.stage.phase==='victory')failWrite=true;}});
 assert.equal(result.returned,true,JSON.stringify({index,result,phase:controller.snapshot().stage.phase,hp:controller.snapshot().sim?.player.hp}));
 assert.equal(controller.state.campaign.completedStages.length,index+1);
 if(index===0){
  assert.equal(result.saved,false);assert.equal(controller.snapshot().harbor.dirty,true);assert.equal(entries[CAMPAIGN_SAVE_KEY],rawDeparture);
  const pending=stable(controller.state);assert.equal(controller.command('next-stage').ok,false);assert.equal(controller.command('depart').ok,false);assert.equal(controller.command('return').ok,false);assert.deepEqual(stable(controller.state),pending);
  failWrite=false;ok(controller.command('return'));assert.deepEqual(stable(controller.state),pending);checks.push('actual-victory-return-save-failure-retries-one-atomic-completion');
 }
 assert.equal(controller.snapshot().harbor.dirty,false);
 const settled=stable(controller.state);ok(controller.command('return'));assert.deepEqual(stable(controller.state),settled);
 ok(controller.command('store'));
 const beforeRepair=controller.state.resources.S;
 if(controller.snapshot().harbor.repair.canRepair)ok(controller.command('repair'));
 const repairCost=beforeRepair-controller.state.resources.S;
 if(index===0)assert.ok(repairCost>0,'real damage repair must spend resources carried to later stages');
 if(index===0){
  const part=controller.state.parts.find(part=>part.location==='warehouse'&&part.parentId===null&&part.kind==='engine');
  if(part&&controller.previewEquip(part.id,'E2').ok){ok(controller.command('equip',{partId:part.id,slotId:'E2'}));equippedId=part.id;}
 }
 ok(controller.command('save'));
 assert.equal(new Set(controller.state.parts.map(part=>part.id)).size,controller.state.parts.length);
 if(equippedId)assert.equal(controller.state.parts.find(part=>part.id===equippedId).socketId,'E2');
 assert.equal(result.stageCleared,true);assert.deepEqual(result.visited,['opening','midboss','maintenance','late','finalboss','victory']);assert.equal(result.kills.length,[6,8,8,9,9,8][index]);
 voyages.push({stage:index+1,mapId:controller.snapshot().routeMap.id,voyageId:id,steps:result.steps,proof:result,damagePreludeSteps,repairCost,resourcesBefore,resourcesAfter:stable(controller.state.resources),parts:controller.state.parts.length,equippedId});
 const restored=stable(controller.state);controller=await createCampaignController({storage});assert.deepEqual(stable(controller.state),restored);
 if(index<5){
  const raw=entries[CAMPAIGN_SAVE_KEY],unchanged=stable(controller.state);failWrite=true;
  assert.equal(controller.command('next-stage').ok,false);assert.equal(entries[CAMPAIGN_SAVE_KEY],raw);assert.deepEqual(stable(controller.state),unchanged);
  failWrite=false;ok(controller.command('next-stage'));
  const after=stable(controller.state);
  for(const key of ['ship','parts','resources','settlements','repairReceipts','voyageSequence','profileId','ownerId'])assert.deepEqual(after[key],unchanged[key],`stage carry ${key}`);
  assert.equal(after.campaign.currentStageIndex,index+1);
  assert.equal(controller.command('next-stage').ok,false,'no double advance');
 }
}
const final=stable(controller.state);fs.writeFileSync(path.join(runDir,'expected.json'),JSON.stringify(final,null,2));
const resumed=spawnSync(process.execPath,[self,'--resume',runDir],{encoding:'utf8',timeout:60000});assert.equal(resumed.status,0,resumed.stderr||resumed.stdout);
const report={version:'voyage-campaign-v1',revision:2,passed:true,sourceManifestSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'outputs/voyage-campaign-v1/source-manifest.json'))).digest('hex'),checks,voyages,stageTransitionFailuresPreserved:true,duplicateCompletionAndNextBlocked:true,sharedAssetsPreserved:true,departureRestarts:6,restart:JSON.parse(resumed.stdout.trim()),scope:'Actual controller/sim/director with Node provisional planar muzzle, real movement/fire/maintenance/return inputs. No HP edits, teleports, artificial enemy deaths, or fabricated returns. Full prototype encounter sequence, not canonical story boss implementation. Actual GLB muzzle browser results remain separate.'};
fs.writeFileSync(path.join(root,'outputs/voyage-campaign-v1/runtime-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,stages:6,kills:voyages.reduce((sum,voyage)=>sum+voyage.proof.kills.length,0),checks,parts:final.parts.length,resources:final.resources,restart:report.restart},null,2));
