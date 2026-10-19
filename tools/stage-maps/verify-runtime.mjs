import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {stageMaps} from './maps.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const runtime=path.join(root,'work/stage-maps/runtime.mjs'),self=fileURLToPath(import.meta.url);
const mode=process.argv[2],id=process.argv[3];
const ok=result=>assert.equal(result.ok,true,JSON.stringify(result));
const stable=value=>JSON.parse(JSON.stringify(value));
if(mode==='--smoke'||mode==='--sorties'||mode==='--resume'){
 globalThis.location={search:`?map=${id}`};
 const {createStageMapController,selectedMap,runSortie,routeBinding}=await import(pathToFileURL(runtime));
 const dir=process.argv[4],file=path.join(dir,'slots.json');fs.mkdirSync(dir,{recursive:true});
 let data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
 const storage={getItem:key=>data[key]??null,setItem(key,value){const next={...data,[key]:String(value)},temp=`${file}.${process.pid}.tmp`;fs.writeFileSync(temp,JSON.stringify(next));fs.renameSync(temp,file);data=next;}};
 let controller=await createStageMapController({storage});
 assert.deepEqual(controller.state.route,routeBinding(selectedMap));
 if(mode==='--resume'){
  const expected=JSON.parse(fs.readFileSync(path.join(dir,'expected.json'),'utf8'));
  assert.deepEqual(stable(controller.state),expected.state);assert.equal(controller.state.settlements.length,2);assert.equal(controller.snapshot().harbor.dirty,false);
  ok(controller.command('restore'));assert.deepEqual(stable(controller.state),expected.state);
  console.log(JSON.stringify({newProcessRestored:true,settlements:2,resources:controller.state.resources,parts:controller.state.parts.length,route:controller.state.route}));process.exit(0);
 }
 if(mode==='--smoke'){
  ok(controller.command('depart'));let snapshot=controller.snapshot();
  assert.equal(snapshot.level.id,selectedMap.seaLevel.id);assert.equal(snapshot.stage.stageId,selectedMap.stageId);
  assert.ok(snapshot.sim.enemies.length>0);assert.equal(snapshot.sim.obstacles.length,selectedMap.seaLevel.colliders.length);
  const voyageId=controller.state.activeVoyage.id,checkpoint=stable(controller.repository.load().state);
  for(let i=0;i<20;i++)controller.advance(.05,{moveX:.3,moveZ:-.2});
  assert.ok(controller.snapshot().sim.time>0);
  controller=await createStageMapController({storage});assert.deepEqual(stable(controller.state),checkpoint);assert.equal(controller.state.activeVoyage.id,voyageId);
  ok(controller.command('depart'));assert.equal(controller.snapshot().level.id,selectedMap.seaLevel.id);
  console.log(JSON.stringify({map:id,stageId:selectedMap.stageId,levelId:selectedMap.seaLevel.id,spawned:snapshot.sim.enemies.length,obstacles:snapshot.sim.obstacles.length,departureRestart:true}));process.exit(0);
 }
 const voyages=[];
 for(let n=1;n<=2;n++){
  if(n===2){const saved=stable(controller.state);controller=await createStageMapController({storage});assert.deepEqual(stable(controller.state),saved);}
  const result=runSortie(controller,{maxSteps:6000});assert.equal(result.returned,true,JSON.stringify(result));
  assert.ok(result.observed.shots>0&&result.observed.hits>0&&result.observed.detached>0&&result.observed.recovered>0);
  assert.equal(controller.state.settlements.length,n);assert.equal(controller.snapshot().harbor.dirty,false);
  const settled=stable(controller.state);ok(controller.command('return'));assert.deepEqual(stable(controller.state),settled);
  assert.equal(controller.command('depart').ok,false);ok(controller.command('store'));
  if(controller.snapshot().harbor.repair.canRepair)ok(controller.command('repair'));
  ok(controller.command('save'));
  voyages.push({voyageId:controller.state.settlements.at(-1).voyageId,steps:result.steps,observed:result.observed,parts:controller.state.parts.length,resources:stable(controller.state.resources)});
 }
 assert.notEqual(voyages[0].voyageId,voyages[1].voyageId);
 assert.equal(new Set(controller.state.parts.map(part=>part.id)).size,controller.state.parts.length);
 fs.writeFileSync(path.join(dir,'expected.json'),JSON.stringify({state:controller.state},null,2));
 const resumed=spawnSync(process.execPath,[self,'--resume',id,dir],{encoding:'utf8',timeout:60000});assert.equal(resumed.status,0,resumed.stderr||resumed.stdout);
 console.log(JSON.stringify({map:id,voyages,duplicateReturnUnchanged:true,cargoDepartureGate:true,restart:JSON.parse(resumed.stdout.trim())}));process.exit(0);
}
const runDir=path.join(root,'work/stage-maps/verification',`${Date.now()}-${process.pid}`);fs.mkdirSync(runDir,{recursive:true});
const invoke=(mode,map,folder)=>{const result=spawnSync(process.execPath,[self,mode,map,path.join(runDir,folder)],{encoding:'utf8',timeout:60000});assert.equal(result.status,0,result.stderr||result.stdout);return JSON.parse(result.stdout.trim());};
const smoke=stageMaps.map(map=>invoke('--smoke',map.id,map.id));
const twoSorties=invoke('--sorties',stageMaps[0].id,'two-sorties');
const sourceManifestSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'outputs/stage-maps-v1/source-manifest.json'))).digest('hex');
const report={version:'stage-maps-v1',passed:true,sourceManifestSha256,scope:'six actual controller departure/restart smoke checks plus map 1 two real combat/salvage/safe-retreat voyages and fresh-process disk restore; not six full boss completions',browser:false,noTeleport:true,noHpInjection:true,noFixtureReturn:true,smoke,twoSorties};
fs.writeFileSync(path.join(root,'outputs/stage-maps-v1/runtime-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
