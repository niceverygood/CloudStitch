/** Real integrated sim + authored route inputs. No HP edits, teleports or fixture returns. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const self=fileURLToPath(import.meta.url);
const sourceRoot=path.resolve(path.dirname(self),'../..');
const resuming=process.argv[2]==='--resume';
const integrationRoot=path.resolve(process.argv[resuming?3:2]||sourceRoot);
const journalDir=resuming?path.resolve(process.argv[4]):path.join(sourceRoot,'work/verification/harbor-linked',`${Date.now()}-${process.pid}`);
fs.mkdirSync(journalDir,{recursive:true});
const journalFile=path.join(journalDir,'journal-store.json');
const expectedFile=path.join(journalDir,'expected.json');
const controllerPath=path.join(integrationRoot,'tools/integration/session.mjs');
if(!fs.existsSync(controllerPath))throw new Error('통합 session.mjs가 필요합니다. node tools/harbor/verify-linked.mjs INTEGRATION_ROOT');
const {createVoyageController}=await import(pathToFileURL(controllerPath));
const {runSortie}=await import(pathToFileURL(path.join(integrationRoot,'tools/integration/pilot.mjs')));
let values=fs.existsSync(journalFile)?JSON.parse(fs.readFileSync(journalFile,'utf8')):{};
const storage={
  getItem:key=>values[key]??null,
  setItem(key,value){
    const candidate={...values,[key]:String(value)},temp=`${journalFile}.${process.pid}.tmp`;
    fs.writeFileSync(temp,JSON.stringify(candidate));fs.renameSync(temp,journalFile);values=candidate;
  },
};
const stable=value=>JSON.parse(JSON.stringify(value));
const expectOk=result=>assert.equal(result.ok,true,JSON.stringify(result));

if(resuming){
  const controller=await createVoyageController({storage});
  const expected=JSON.parse(fs.readFileSync(expectedFile,'utf8'));
  assert.deepEqual(stable(controller.state),expected.state);
  assert.equal(controller.snapshot().harbor.settlements,2);
  assert.equal(controller.snapshot().harbor.dirty,false);
  const before=JSON.stringify(controller.state);
  for(const payload of expected.returns){
    const {acceptReturn}=await import(pathToFileURL(path.join(integrationRoot,'tools/harbor/core.mjs')));
    const duplicate=acceptReturn(controller.state,payload);
    assert.equal(duplicate.ok,true);assert.equal(duplicate.duplicate,true);
    assert.equal(JSON.stringify(duplicate.state),before);
  }
  expectOk(controller.command('restore'));
  assert.deepEqual(stable(controller.state),expected.state);
  console.log(JSON.stringify({processRestart:true,partIdsUnique:true,settlements:2,parts:controller.state.parts.length,resources:controller.state.resources,duplicateReturnsUnchanged:true}));
  process.exit(0);
}

let controller=await createVoyageController({storage});
expectOk(controller.command('depart'));
const stagedId=controller.state.activeVoyage.id;
controller=await createVoyageController({storage});
assert.equal(controller.state.activeVoyage.id,stagedId);
expectOk(controller.command('store')); // no cargo; staged boundary must survive
const voyages=[],returns=[];
let equippedId=null;
for(let n=1;n<=2;n++){
  if(n===2){
    const expected=stable(controller.state);
    controller=await createVoyageController({storage});
    assert.deepEqual(stable(controller.state),expected);
  }
  let fieldRepairSpent=0,repairPreludeDone=false,repairPreludeSteps=0;
  const result=runSortie(controller,{maxSteps:6000,onStep(snapshot){
    if(n===1&&!repairPreludeDone&&snapshot.phase==='sailing'){
      // Let an authored warned enemy projectile reach the stationary player.
      // The sim still owns every movement, hit and HP change during this prelude.
      for(let i=0;i<600&&controller.battlefield.state.player.hp===controller.battlefield.state.player.maxHp;i++){controller.advance(.05,{});repairPreludeSteps++;}
      repairPreludeDone=true;snapshot=controller.snapshot();
      assert.equal(snapshot.phase,'sailing','the real warning/hit prelude must not defeat the player');
    }
    if(n===2&&equippedId&&snapshot.sim?.time<.2){
      assert.ok(snapshot.sim.player.modules.some(m=>m.id===equippedId));
      assert.equal(snapshot.sim.player.baseWeight,controller.state.parts.filter(p=>p.location==='installed').reduce((sum,p)=>sum+p.weight,0));
    }
    if(n===1&&!fieldRepairSpent&&snapshot.phase==='sailing'&&snapshot.sim?.player.hp<snapshot.sim.player.maxHp){
      const before=snapshot.sim.resources.scrap;
      expectOk(controller.battlefield.dispatch({id:'linked-verify-field-repair',type:'repair',hp:5}));
      fieldRepairSpent=before-controller.battlefield.state.resources.scrap;
      assert.ok(fieldRepairSpent>0,'actual battlefield repair consumes scrap');
    }
  }});
  assert.equal(result.returned,true,JSON.stringify(result));
  assert.ok(result.observed.shots>0&&result.observed.hits>0&&result.observed.detached>0&&result.observed.recovered>0);
  assert.equal(controller.state.settlements.length,n);
  assert.equal(controller.snapshot().harbor.dirty,false,'return ledger auto-saved');
  if(n===1){assert.ok(fieldRepairSpent>0);assert.equal(controller.state.settlements.at(-1).spent.S,fieldRepairSpent,'field repair spending survives return');}
  assert.ok(controller.state.parts.some(p=>p.location==='cargo'));
  const settledState=stable(controller.state);returns.push(stable(controller.settlement));
  expectOk(controller.command('return'));
  assert.deepEqual(stable(controller.state),settledState,'duplicate return does not re-award');
  const cargoGate=controller.command('depart');assert.equal(cargoGate.ok,false);assert.match(cargoGate.reason,/화물|보관/);
  expectOk(controller.command('store'));
  assert.equal(controller.command('restore').ok,false,'dirty harbor cannot roll back settlement/edits');
  const beforeS=controller.state.resources.S,quote=controller.snapshot().harbor.repair;
  if(quote.canRepair)expectOk(controller.command('repair'));
  const repairSpent=beforeS-controller.state.resources.S;
  if(n===1){
    const engine=controller.state.parts.find(p=>p.location==='warehouse'&&p.parentId===null&&p.kind==='engine');
    assert.ok(engine,'real recovered engine available');
    expectOk(controller.previewEquip(engine.id,'E2'));
    expectOk(controller.command('equip',{partId:engine.id,slotId:'E2'}));equippedId=engine.id;
  }
  expectOk(controller.command('save'));
  voyages.push({number:n,id:controller.state.settlements.at(-1).voyageId,pilotSteps:result.steps,repairPreludeSteps,simulatedSeconds:controller.battlefield.state.time,retainedEnemyFireEvents:controller.battlefield.state.events.filter(e=>e.type==='enemy-fire').length,observed:result.observed,fieldRepairSpent,repairSpent,resources:stable(controller.state.resources),parts:controller.state.parts.length,ledger:n});
}
assert.equal(new Set(controller.state.parts.map(p=>p.id)).size,controller.state.parts.length);
assert.notEqual(voyages[0].id,voyages[1].id);
fs.writeFileSync(expectedFile,JSON.stringify({state:controller.state,returns},null,2));
const restarted=spawnSync(process.execPath,[self,'--resume',integrationRoot,journalDir],{encoding:'utf8'});
assert.equal(restarted.status,0,`${restarted.stdout}\n${restarted.stderr}`);
const restart=JSON.parse(restarted.stdout.trim());
const paths=['tools/integration/session.mjs','tools/integration/pilot.mjs','tools/battlefield/sim.mjs','tools/battlefield/integration.mjs','tools/harbor/core.mjs','tools/harbor/adapters.mjs','tools/shipyard/shipyard.mjs','tools/save/save.mjs'];
const sourceHashes=paths.map(relative=>({path:relative,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(integrationRoot,relative))).digest('hex')}));
const report={version:'harbor-linked-v1',passed:true,scope:'actual integrated sim.mjs/controller plus authored first-region route; automated public movement/fire/salvage/return input; safe retreat rather than full boss route',directHpEdits:false,teleports:false,fixtureReturns:false,customEnemySpawns:false,browser:false,muzzle:'default provisional planar muzzle; actual GLB socket browser check belongs to integration QA',stagedVoyageResume:true,cargoDepartureGate:true,dirtyRestoreGate:true,returnAutoSave:true,equippedRecoveredEngine:equippedId,voyages,restart,sourceHashes};
const out=path.join(sourceRoot,'outputs/harbor-linked-v1');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
