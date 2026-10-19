import test from 'node:test';
import assert from 'node:assert/strict';
import {stageMaps} from './maps.mjs';
import {resolveMap,selectMap,selectedMap,routeBinding,validateRouteState} from './selection.mjs';
import {createExampleState} from '../harbor/fixtures.mjs';
import {checksumFNV1a,createMemoryStorage,createSaveRepository} from '../save/save.mjs';

const stateFor = map => ({...createExampleState(),route:routeBinding(map)});

test('selection defaults to first map and resolves only exact authored IDs',()=>{
  assert.equal(selectMap(''),stageMaps[0]);
  assert.equal(selectMap('?view=map'),stageMaps[0]);
  assert.equal(selectedMap,selectMap());
  for(const map of stageMaps){
    assert.equal(resolveMap(map.id),map);
    assert.equal(selectMap(`?map=${encodeURIComponent(map.id)}&view=map`),map);
  }
  for(const value of ['unknown-map','../maps.mjs','map-01-harbor-sea','',null,undefined])assert.throws(()=>resolveMap(value),RangeError);
  assert.throws(()=>selectMap('?map=unknown-map'),RangeError);
  assert.throws(()=>selectMap('?map='),RangeError);
});

test('route binding uses exact stage, level, revision and full-layout checksum',()=>{
  for(const map of stageMaps){
    assert.deepEqual(routeBinding(map),{
      routeId:map.id,routeVersion:1,stageId:map.stageId,levelId:map.seaLevel.id,
      layoutHash:checksumFNV1a(JSON.stringify(map.seaLevel))
    });
    assert.deepEqual(validateRouteState(stateFor(map),map),[]);
  }
  assert.equal(new Set(stageMaps.map(map=>routeBinding(map).layoutHash)).size,6);
});

test('route mismatch, version mismatch and changed layout are rejected without mutation',()=>{
  const map=stageMaps[0],baseline=stateFor(map),before=JSON.stringify(baseline);
  assert(validateRouteState(baseline,stageMaps[1]).some(issue=>issue.includes('routeId')));
  for(const [key,value] of [['routeId','unknown-map'],['routeVersion',2],['routeVersion','1'],['stageId',stageMaps[1].stageId],['levelId',stageMaps[1].seaLevel.id],['layoutHash','fnv1a32:00000000']]){
    const changed=structuredClone(baseline);changed.route[key]=value;
    assert(validateRouteState(changed,map).some(issue=>issue.includes(key)),key);
  }
  const changedMap=structuredClone(map);changedMap.seaLevel.playerStart.position[0]+=1;
  assert.notEqual(routeBinding(changedMap).layoutHash,routeBinding(map).layoutHash);
  assert(validateRouteState(baseline,changedMap).some(issue=>issue.includes('layoutHash')));
  const extra=structuredClone(baseline);extra.route.unexpected=true;
  assert(validateRouteState(extra,map).some(issue=>issue.includes('알 수 없는 필드')));
  assert(validateRouteState(createExampleState(),map).some(issue=>issue.includes('항로 정보')));
  assert(validateRouteState(null,map).every(issue=>typeof issue==='string'));
  const invalidCore=structuredClone(baseline);invalidCore.resources.S=-1;
  assert(validateRouteState(invalidCore,map).some(issue=>issue.includes('S/F/C')));
  assert.equal(JSON.stringify(baseline),before);
});

test('wrong-map restore and invalid-route overwrite preserve last normal journal',()=>{
  const storage=createMemoryStorage(),key='cloudstitch.stage-maps.selection-test';
  const first=createSaveRepository({storage,key,validateState:state=>validateRouteState(state,stageMaps[0])});
  const saved=first.save(stateFor(stageMaps[0]),{expectedRevision:0,boundary:'harbor'});
  assert.equal(saved.ok,true);
  const before=storage.getItem(key);
  const wrongMap=createSaveRepository({storage,key,validateState:state=>validateRouteState(state,stageMaps[1])});
  assert.equal(wrongMap.load().ok,false);
  assert.equal(wrongMap.save(stateFor(stageMaps[1]),{expectedRevision:1,boundary:'harbor'}).ok,false);
  assert.equal(storage.getItem(key),before);
  const invalid=stateFor(stageMaps[0]);invalid.route.routeVersion=2;
  assert.equal(first.save(invalid,{expectedRevision:1,boundary:'harbor'}).ok,false);
  assert.equal(storage.getItem(key),before);
  assert.equal(first.load().ok,true);
});
