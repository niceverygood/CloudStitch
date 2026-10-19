import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createExampleState, exampleReturn } from './fixtures.mjs';
import { validateState, prepareDeparture, commitDeparture, acceptReturn, storeCargo } from './core.mjs';
import { computeBudget, quoteRepair, confirmRepair, installPart } from '../shipyard/shipyard.mjs';
import { createSaveRepository, createMemoryStorage } from '../save/save.mjs';
import { createWorldContacts, adaptBattlefieldReturn, createDepartureManifest } from './adapters.mjs';

const must = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.state; };
const depart = state => must(commitDeparture(must(prepareDeparture(state))));

test('two voyages, repairs, stable part IDs and reload retain exact resources and ledger', () => {
  const storage = createMemoryStorage();
  let repository = createSaveRepository({storage, validateState});
  let state = createExampleState();
  assert.deepEqual(validateState(state), []);
  assert.equal(computeBudget(state).weight, 50);
  assert.equal(computeBudget(state).lift, 65);
  const returns = [];
  for (let n = 1; n <= 2; n++) {
    state = must(prepareDeparture(state));
    assert.equal(repository.save(state, {boundary:'departure'}).ok, true);
    state = must(commitDeparture(state));
    const payload = exampleReturn(state); returns.push(payload);
    state = must(acceptReturn(state, payload));
    assert.equal(state.parts.filter(p => p.location === 'cargo').length, 2);
    assert.equal(computeBudget(state).weight, n === 1 ? 70 : 78);
    state = must(storeCargo(state));
    if (n === 1) state = must(installPart(state, payload.recovered[0].id, 'E2'));
    const quote = quoteRepair(state);
    const before = structuredClone(state);
    assert.deepEqual(state, before);
    assert.equal(quote.cost.S, n === 1 ? 26 : 26);
    state = must(confirmRepair(state, quote));
    assert.equal(repository.save(state,{boundary:'harbor'}).ok, true);
    repository = createSaveRepository({storage,validateState});
    state = repository.load().state;
    assert.deepEqual(validateState(state), []);
  }
  assert.deepEqual(state.resources, {S:284,F:34,C:3});
  assert.equal(state.settlements.length,2);
  assert.equal(state.parts.length,9);
  assert.equal(new Set(state.parts.map(p=>p.id)).size,9);
  for (const payload of returns) {
    const result = acceptReturn(state,payload);
    assert.equal(result.duplicate,true); assert.deepEqual(result.state,state);
  }
  assert.equal(state.parts.filter(p=>p.location==='installed').length,6);
  assert.equal(state.parts.filter(p=>p.location==='warehouse').length,3);
});

test('settlement IDs and voyage IDs reject altered or repeated final awards', () => {
  const start = depart(createExampleState()), payload = exampleReturn(start);
  const state = must(acceptReturn(start,payload)), before = structuredClone(state);
  assert.equal(acceptReturn(state,{...payload,settlementId:'other'}).code,'SETTLEMENT_CONFLICT');
  assert.equal(acceptReturn(state,{...payload,gained:{S:999,F:0,C:0}}).code,'SETTLEMENT_CONFLICT');
  assert.deepEqual(state,before);
});

test('withdrawal preserves confirmed cargo but pays no incomplete contract', () => {
  const state = depart(createExampleState()), payload = exampleReturn(state,'withdrawn');
  const result = acceptReturn(state,payload);
  assert.equal(result.ok,true); assert.equal(result.state.resources.S,198);
  assert.equal(result.state.parts.filter(p=>p.location==='cargo').length,2);
  assert.deepEqual(result.receipt.contractPaid,{S:0,F:0,C:0});
});

test('invalid recovery, duplicate IDs, malformed sockets and missing ownership do not mutate', () => {
  const state = depart(createExampleState()), payload = exampleReturn(state), before=structuredClone(state);
  const foreign=structuredClone(payload); foreign.recovered[0].ownerId='enemy';
  assert.equal(acceptReturn(state,foreign).code,'RECOVERY_NOT_CONFIRMED');
  const duplicated=structuredClone(payload); duplicated.recovered.push(duplicated.recovered[0]);
  assert.equal(acceptReturn(state,duplicated).code,'PART_ID_CONFLICT');
  assert.equal(acceptReturn(state,{...payload,recoveredSockets:[{id:'x',parentId:'unknown'}]}).code,'SOCKET_ID_CONFLICT');
  assert.deepEqual(state,before);
});

test('failed return save keeps session and last departure; retry saves without applying rewards twice', () => {
  const memory=createMemoryStorage(); let fail=false;
  const storage={getItem:k=>memory.getItem(k),setItem:(k,v)=>{if(fail)throw new Error('quota');memory.setItem(k,v);}};
  const repository=createSaveRepository({storage,validateState});
  const prepared=must(prepareDeparture(createExampleState())); repository.save(prepared,{boundary:'departure'});
  const state=depart(createExampleState()), payload=exampleReturn(state), returned=must(acceptReturn(state,payload));
  const previous=repository.exportCurrent().raw; fail=true;
  assert.equal(repository.save(returned,{boundary:'return'}).code,'WRITE_FAILED');
  assert.equal(repository.exportCurrent().raw,previous);
  assert.equal(returned.settlements.length,1); assert.equal(returned.resources.S,228);
  fail=false; assert.equal(repository.save(returned,{boundary:'return'}).ok,true);
  assert.deepEqual(repository.load().state,returned);
  assert.equal(acceptReturn(repository.load().state,payload).duplicate,true);
});

test('malformed state and outstanding departure are refused', () => {
  assert.ok(validateState({...createExampleState(),settlements:{}}).length);
  const prepared=must(prepareDeparture(createExampleState()));
  assert.equal(prepareDeparture(prepared).code,'DEPARTURE_PENDING');
  const storage=createMemoryStorage(), repo=createSaveRepository({storage,validateState});
  storage.setItem('cloudstitch.harbor.v1','{broken');
  assert.equal(repo.save(createExampleState()).ok,false);
  assert.equal(storage.getItem('cloudstitch.harbor.v1'),'{broken');
});

test('world adapter resolves four existing catalog contacts without assigned physical coordinates', () => {
  const contacts=createWorldContacts(JSON.parse(fs.readFileSync('outputs/world-assets/catalog.json','utf8')),JSON.parse(fs.readFileSync('outputs/world-assets/scene-catalog.json','utf8')));
  assert.equal(contacts.ok,true); assert.equal(contacts.contacts.length,4);
  assert.deepEqual(contacts.contacts.map(c=>c.assetId),['repair-workshop','canvas-market','storage-chest','dock-endcap']);
  assert.ok(contacts.contacts.every(c=>!('position' in c)));
  const manifest=createDepartureManifest(depart(createExampleState()));
  assert.equal(manifest.installed.length,5); assert.equal(manifest.cargo.length,0);
});

test('battlefield adapter preserves recovered tree, rejects unconfirmed cargo and invents no rewards', () => {
  const sim={outcome:'victory',endReason:'safe-retreat-with-cargo',player:{hp:90},cargo:[{
    id:'bundle-1',owner:'player',status:'cargo',salvaged:true,enemyId:'tax-1',source:{assetId:'enemy-tax-cutter'},
    modules:[{id:'tax-1:deck',parentId:'tax-1:connector',type:'deck',name:'갑판',hp:40,maxHp:40,weight:2,owner:'player'},
      {id:'tax-1:engine',parentId:'tax-1:deck',type:'engine',name:'엔진',hp:32,maxHp:32,weight:2,owner:'player'}],
  }]};
  const state=depart(createExampleState()), before=structuredClone(sim);
  const adapter=adaptBattlefieldReturn(sim,{voyageId:state.activeVoyage.id,settlementId:'adapter-1'});
  assert.equal(adapter.ok,true); assert.equal(adapter.result.recoveredSockets.length,1);
  const returned=must(acceptReturn(state,adapter.result));
  assert.equal(returned.resources.S,120); assert.equal(returned.parts.length,7);
  assert.equal(returned.parts.at(-1).parentId,returned.parts.at(-2).id);
  assert.deepEqual(sim,before);
  sim.cargo[0].salvaged=false; assert.equal(adaptBattlefieldReturn(sim,{voyageId:'v',settlementId:'s'}).ok,false);
});

test('battlefield player module damage maps installed identity and filters unrelated proxies', () => {
  const state=depart(createExampleState());
  const sim={outcome:'victory',endReason:'battle-cleared',player:{hp:90,modules:[
    {id:'render-hull',harborPartId:'homeward:hull',hp:90},
    {id:'homeward:balloon',hp:45}, {id:'unrelated-proxy',hp:0},
  ]},cargo:[]};
  const result=adaptBattlefieldReturn(sim,{voyageId:state.activeVoyage.id,settlementId:'modules-final',installedParts:state.parts.filter(p=>p.location==='installed')});
  assert.equal(result.ok,true); assert.equal(result.result.damage.length,2);
  const next=must(acceptReturn(state,result.result));
  assert.equal(next.parts.find(p=>p.id==='homeward:balloon').hp,45);
  assert.equal(computeBudget(next).lift,58.5);
});

test('staged departure keeps the same safe boundary through warehouse actions and reload', () => {
  const prepared=must(prepareDeparture(createExampleState()));
  const stored=must(storeCargo(prepared));
  assert.equal(stored.boundary,'departure');
  const storage=createMemoryStorage(),repo=createSaveRepository({storage,validateState});
  assert.equal(repo.save(stored,{boundary:'departure'}).ok,true);
  const loaded=repo.load().state,next=must(commitDeparture(loaded));
  assert.equal(next.activeVoyage.id,prepared.activeVoyage.id);
  assert.equal(next.voyageSequence,1);
  assert.ok(validateState({...loaded,boundary:'harbor'}).length);
});

test('destroyed optional installed part is refused before a battlefield loadout can commit', () => {
  const state=createExampleState();
  state.parts.push({...structuredClone(state.parts.find(p=>p.kind==='machinegun')),id:'optional-gun',socketId:'W2',weight:1,hp:0});
  assert.deepEqual(validateState(state),[]);
  const result=prepareDeparture(state);
  assert.equal(result.ok,false);assert.equal(result.code,'DEPARTURE_BLOCKED');
  assert.ok(result.reasons.some(reason=>reason.includes('installed-part-destroyed')));
  assert.equal(state.activeVoyage,null);assert.equal(state.phase,'harbor');
});

test('real field repair may exceed departure HP only with corresponding actual scrap spending', () => {
  const initial=createExampleState();initial.parts.find(p=>p.id==='homeward:hull').hp=75;
  const state=depart(initial),sim={outcome:'victory',endReason:'battle-cleared',player:{hp:90,modules:[{id:'homeward:hull',hp:90}]},cargo:[]};
  const options={voyageId:state.activeVoyage.id,settlementId:'paid-field-repair',installedParts:state.parts.filter(p=>p.location==='installed')};
  assert.equal(adaptBattlefieldReturn(sim,options).ok,false,'unpaid HP increase cannot enter return');
  const adapted=adaptBattlefieldReturn(sim,{...options,spent:{S:7.5,F:0,C:0}});assert.equal(adapted.ok,true);
  const returned=must(acceptReturn(state,adapted.result));
  assert.equal(returned.parts.find(p=>p.id==='homeward:hull').hp,90);
  assert.equal(returned.resources.S,112.5);assert.equal(returned.settlements[0].restoredBeyondDeparture,15);
  assert.equal(acceptReturn(state,{...adapted.result,spent:{S:0,F:0,C:0}}).code,'UNPAID_FIELD_REPAIR');
});
