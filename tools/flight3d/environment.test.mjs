import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFlightState} from './sim.mjs';
import {createFlightEnvironment} from './environment.js';

test('the actual selected scenery assembles and moves without changing the flight state',()=>{
 const state=createFlightState(),before=structuredClone(state),scene=new THREE.Scene();scene.background=new THREE.Color('#cfdfd9');scene.fog=new THREE.Fog('#d9e5dd',115,285);
 const camera=new THREE.PerspectiveCamera(57,1.6,.15,500);camera.position.set(0,18,62);camera.lookAt(0,11,34);
 const environment=createFlightEnvironment(scene,state);
 try{
  environment.update(0,camera,state.player);const first=environment.stats();
  assert.deepEqual(first.counts,{clouds:40,landmarks:16,islands:8,motes:80,drafts:12,dressing:6});
  assert.equal(first.sourceIds.length,17);assert.equal(first.models.prototypeCount,17);
  assert.ok(first.models.renderMeshes<450);assert.ok(first.models.sourceMeshes>first.models.renderMeshes);
  environment.update(1,camera,state.player);const later=environment.stats();
  assert.deepEqual(state,before);assert.notDeepEqual(first.seeds,later.seeds);assert.notDeepEqual(first.motion,later.motion);
  assert.notDeepEqual(first.anchors.map(a=>a.position),later.anchors.map(a=>a.position));
  assert.deepEqual(first.anchors.map(a=>a.rest),later.anchors.map(a=>a.rest));
  environment.update(1,camera,state.player);assert.deepEqual(environment.stats(),later);
  scene.updateMatrixWorld(true);scene.traverse(n=>assert.ok(n.matrixWorld.elements.every(Number.isFinite),n.name));
  const modelsBefore=environment.stats().models;environment.setRich(false);environment.update(2,camera,state.player);assert.equal(environment.rich,false);
  environment.setRich(true);environment.update(2,camera,state.player);assert.deepEqual(environment.stats().models,modelsBefore);assert.deepEqual(state,before);
 }finally{environment.dispose();}
 assert.equal(scene.children.length,0);assert.equal(environment.stats().models.disposed,true);
 environment.dispose();environment.update(4,camera,state.player);assert.equal(scene.children.length,0);
});
