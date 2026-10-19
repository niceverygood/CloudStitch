/** Light Node test with the actual frozen controller; no browser, fixed shot timeline or VFX drain. */
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createAudioAdapter} from './adapter.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const integrationRoot=process.argv[2]?path.resolve(process.argv[2]):null;
if(!integrationRoot)throw new Error('Usage: node tools/audio/verify-controller.mjs <frozen integration root>');
const paths=['tools/integration/HANDOFF.md','tools/integration/contract.mjs','tools/integration/session.mjs','tools/integration/renderer.js','tools/integration/ui.js','tools/battlefield/sim.mjs','tools/battlefield/integration.mjs'];
async function hashes(){return Promise.all(paths.map(async relative=>{const bytes=await readFile(path.join(integrationRoot,relative));return {path:relative,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}));}
const before=await hashes();
const {createVoyageController}=await import(pathToFileURL(path.join(integrationRoot,'tools/integration/session.mjs')));
const {moduleWorldPosition}=await import(pathToFileURL(path.join(integrationRoot,'tools/battlefield/sim.mjs')));
const controller=await createVoyageController(),cues=[],loopState=new Map(),clears=[];
const audio={play:(id,options)=>{cues.push({id,...options});return true;},setLoop:(id,on,options)=>{if(on)loopState.set(id,options);else loopState.delete(id);return on;},clear:reason=>{loopState.clear();clears.push(reason);},setPaused(){}};
const bridge=createAudioAdapter({audio});
const meta=()=>({voyageId:controller.snapshot().voyageId,generation:controller.battlefield?.generation,camera:{position:[0,55,38.51],target:[0,0,0]}});
const seen=new Map(),checks=[];
function check(name,fn){fn();checks.push({name,passed:true});}
function observe(){
  const snapshot=controller.snapshot(),context=meta(),digest=JSON.stringify(snapshot);
  bridge.update(snapshot,context);bridge.consume(snapshot.sim?.events||[],snapshot,context);
  assert.equal(JSON.stringify(snapshot),digest,'audio must not mutate authority snapshot');
  for(const event of snapshot.sim?.events||[])seen.set(event.seq,event);
  return snapshot;
}
const departed=await controller.command('depart');check('Actual safe departure',()=>assert.equal(departed.ok,true));bridge.commandResult('depart',departed,controller.snapshot(),meta());observe();
let ticks=0;
for(;ticks<6000;){
  const s=controller.snapshot();if(s.phase!=='sailing'||s.paused)break;
  const p=s.sim.player,enemy=s.sim.enemies.filter(e=>!e.defeated).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
  const part=enemy?.modules.find(m=>m.key==='connector'&&m.hp>0&&m.attached)||enemy?.modules.find(m=>m.key==='root'&&m.hp>0&&m.attached);
  const at=part?moduleWorldPosition(enemy,part):enemy||{x:p.x,z:p.z-30};
  const d=Math.hypot(at.x-p.x,at.z-p.z)||1,approach=d>23?1:0;
  controller.advance(1/60,{moveX:(at.x-p.x)/d*approach,moveZ:(at.z-p.z)/d*approach,aimX:at.x,aimZ:at.z,fire:true});ticks++;observe();
  if(cues.some(c=>c.id.startsWith('hit-'))&&cues.some(c=>c.id==='fire-cannon')&&cues.some(c=>c.id==='bundle-detach'))break;
}
check('Actual player projectile fire consumed',()=>{assert.ok([...seen.values()].some(e=>e.type==='player-fire'));assert.ok(cues.some(c=>c.id==='fire-machinegun'));});
check('Actual enemy projectile fire consumed',()=>{assert.ok([...seen.values()].some(e=>e.type==='enemy-fire'));assert.ok(cues.some(c=>c.id==='fire-cannon'));});
check('Actual swept-collision hit consumed',()=>{assert.ok([...seen.values()].some(e=>e.type==='hit'));assert.ok(cues.some(c=>c.id.startsWith('hit-')));});
const count=cues.length;observe();observe();check('Repeated real history does not replay cues',()=>assert.equal(cues.length,count));
const paused=await controller.command('pause');bridge.commandResult('pause',paused,controller.snapshot(),meta());observe();check('Actual pause stops loops',()=>{assert.equal(paused.ok,true);assert.equal(loopState.size,0);});
const resumed=await controller.command('resume');bridge.commandResult('resume',resumed,controller.snapshot(),meta());observe();check('Actual resume does not replay history',()=>{assert.equal(resumed.ok,true);assert.equal(cues.length,count);});
bridge.dispose();check('Adapter dispose stops loops',()=>assert.equal(loopState.size,0));
assert.deepEqual(await hashes(),before,'frozen source must be unchanged');
const report={version:'audio-v1.0.0-ready',passed:true,checks,ticks,elapsedSimulationSeconds:ticks/60,sourceBoundary:before,eventCounts:Object.fromEntries([...new Set([...seen.values()].map(e=>e.type))].map(type=>[type,[...seen.values()].filter(e=>e.type===type).length])),cueCounts:Object.fromEntries([...new Set(cues.map(e=>e.id))].map(id=>[id,cues.filter(e=>e.id===id).length])),adapter:bridge.debug(),limits:['Node accelerated actual input/controller/authority path; no browser or native Web Audio.','Only recorded event types were observed. No whole-campaign, return/repair/equip UI or human listening claim.','Audio sink is a recording fake; runtime scheduling is verified separately.'],sourcePreserved:true};
await mkdir(path.join(root,'outputs/audio-v1'),{recursive:true});await writeFile(path.join(root,'outputs/audio-v1/controller-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,ticks,eventCounts:report.eventCounts,cueCounts:report.cueCounts}));
