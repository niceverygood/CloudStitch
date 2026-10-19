import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createVoyageController,memoryStorage} from './playable-session.mjs';
import {runSortie} from './playable-pilot.mjs';
import {acceptReturn} from '../harbor/core.mjs';
const checks=[];
function checked(name,detail){checks.push({name,passed:true,detail});}

test('two actual input voyages, cargo ownership, repair, fitting, save and fresh-controller restore',async()=>{
  const storage=memoryStorage(),c=await createVoyageController({storage}),sorties=[];
  for(let n=0;n<2;n++){
    const voyage=runSortie(c);assert.equal(voyage.returned,true,JSON.stringify(voyage));assert.ok(voyage.observed.hits>0);assert.ok(voyage.observed.detached>0);assert.ok(voyage.observed.recovered>0);sorties.push(voyage);
    assert.equal(c.command('depart').ok,false,'untransferred cargo cannot vanish on departure');
    assert.equal(c.command('store').ok,true);assert.equal(c.command('repair').ok,true);
    if(n===0){const choice=[['machinegun','W2'],['engine','E2']].map(([kind,slotId])=>({part:c.state.parts.find(p=>p.kind===kind&&p.location==='warehouse'),slotId})).find(x=>x.part);assert.ok(choice);const preview=c.previewEquip(choice.part.id,choice.slotId);assert.equal(preview.ok,true);assert.equal(c.command('equip',{partId:choice.part.id,slotId:choice.slotId}).ok,true);assert.equal(c.command('equip',{partId:choice.part.id,slotId:choice.slotId}).ok,false);}
    assert.equal(c.command('save').ok,true);
    assert.equal(new Set(c.state.parts.map(p=>p.id)).size,c.state.parts.length);assert.ok(c.state.parts.every(p=>p.ownerId==='player'));
  }
  assert.equal(c.state.settlements.length,2);assert.equal(c.state.voyageSequence,2);assert.ok(c.state.parts.length>6);assert.equal(c.state.parts.filter(p=>p.location==='installed').length,6);
  const restored=await createVoyageController({storage});assert.deepEqual(restored.state,c.state);
  checked('two-input-voyages-and-persistent-restore',{sorties,resources:c.state.resources,parts:c.state.parts.length,settlements:2,installed:6,warehouse:c.state.parts.filter(p=>p.location==='warehouse').length,evidence:'Real controller movement/fire/salvage/return inputs. Simulated time accelerated. No teleport, direct damage or forced victory.'});
});

test('repeated return and identical settlement cannot duplicate resources or parts',async()=>{
  const c=await createVoyageController();assert.equal(runSortie(c).returned,true);const before=structuredClone(c.state);assert.equal(c.command('return').ok,true);assert.deepEqual(c.state,before);
  const repeated=acceptReturn(c.state,c.settlement);assert.equal(repeated.duplicate,true);assert.deepEqual(repeated.state,before);
  const changed=structuredClone(c.settlement);changed.gained.S=99;assert.equal(acceptReturn(c.state,changed).ok,false);
  checked('return-and-settlement-replay-no-duplication',{partCount:c.state.parts.length});
});

test('pause stops combat, recovery, warnings and danger timers',async()=>{
  const c=await createVoyageController();assert.equal(c.command('depart').ok,true);c.advance(.1,{fire:true,aimX:28,aimZ:-27});assert.equal(c.command('pause').ok,true);
  const before=c.battlefield.snapshot();for(let n=0;n<100;n++)c.advance(.1,{moveX:1,fire:true});assert.deepEqual(c.battlefield.snapshot(),before);assert.equal(c.command('salvage').ok,false);assert.equal(c.command('resume').ok,true);
  checked('pause-freezes-authoritative-state',{time:before.time});
});

test('failed departure save preserves the harbor and the last valid journal',async()=>{
  const base=memoryStorage();let fail=false;const storage={getItem:base.getItem,setItem(k,v){if(fail)throw new Error('quota');base.setItem(k,v);}};
  const c=await createVoyageController({storage});assert.equal(c.command('save').ok,true);const previous=base.getItem('cloudstitch.playable-battlefield.v1');fail=true;
  assert.equal(c.command('depart').ok,false);assert.equal(c.state.phase,'harbor');assert.equal(c.state.activeVoyage,null);assert.equal(base.getItem('cloudstitch.playable-battlefield.v1'),previous);
  fail=false;assert.equal(c.command('depart').ok,true);assert.equal(c.state.voyageSequence,1);
  checked('write-failure-does-not-depart-or-consume-id',{});
});

test('corrupt save is preserved rather than overwritten by a new departure',async()=>{
  const storage=memoryStorage();storage.setItem('cloudstitch.playable-battlefield.v1','{corrupt');const c=await createVoyageController({storage});assert.equal(c.command('depart').ok,false);assert.equal(storage.getItem('cloudstitch.playable-battlefield.v1'),'{corrupt');
  checked('corrupt-save-preserved',{});
});

test('stale save revision has an explicit recoverable reload preserving unsaved state',async()=>{
  const storage=memoryStorage(),a=await createVoyageController({storage});a.command('save');const b=await createVoyageController({storage});a.command('store');assert.equal(a.snapshot().harbor.canRestore,false);assert.equal(a.command('save').ok,true);b.command('store');assert.equal(b.command('save').ok,false);assert.equal(b.snapshot().harbor.canRestore,true);assert.equal(b.command('restore').ok,true);assert.ok(storage.getItem('cloudstitch.playable-battlefield.v1.conflict'));assert.deepEqual(b.state,a.state);
  checked('revision-conflict-preserves-unsaved-before-reload',{});
});

test('real enemy fire obeys warning budget; actual defeat clears combat and retry restores departure',async()=>{
  const c=await createVoyageController();assert.equal(c.command('depart').ok,true);const voyageId=c.state.activeVoyage.id,resources=structuredClone(c.state.resources);let maxWarnings=0,enemyShots=0,lastSequence=0;
  for(let n=0;n<1800&&c.snapshot().phase==='sailing';n++){
    c.advance(.1,{});const sim=c.battlefield.state;maxWarnings=Math.max(maxWarnings,sim.enemies.filter(e=>e.telegraph).length);
    for(const entry of sim.events)if(entry.seq>lastSequence){if(entry.type==='enemy-fire')enemyShots++;lastSequence=entry.seq;}
  }
  assert.ok(enemyShots>0,'Token policy must not deadlock enemy cooldowns');assert.ok(maxWarnings<=1);assert.equal(c.snapshot().phase,'defeat');assert.equal(c.battlefield.state.enemies.length,0);assert.equal(c.battlefield.state.projectiles.length,0);const oldGeneration=c.battlefield.generation,oldRun=c.encounter.snapshot().runId;assert.equal(c.command('retry').ok,true);assert.ok(c.battlefield.generation>oldGeneration);assert.ok(c.encounter.snapshot().runId>oldRun);assert.equal(c.state.activeVoyage.id,voyageId);assert.deepEqual(c.state.resources,resources);assert.equal(c.battlefield.state.player.hp,100);assert.equal(c.battlefield.state.cargo.length,0);
  checked('actual-defeat-clear-and-same-voyage-retry',{enemyShots,maxWarnings});
});

test.after(()=>{const out=new URL('../../outputs/playable-battlefield-v1/',import.meta.url);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(new URL('rules-verification.json',out),JSON.stringify({version:1,passed:checks.length===7,checks,scope:'Headless integration over actual simulation inputs, not browser performance or human playtesting.'},null,2)+'\n');});
