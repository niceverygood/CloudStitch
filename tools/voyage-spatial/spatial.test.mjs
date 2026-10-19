import test from 'node:test';
import assert from 'node:assert/strict';
import {stageMaps} from '../stage-maps/maps.mjs';
import {sceneryState,cameraMove,localToWorld,worldToLocal} from './spatial-contract.mjs';
import {buildEnvironmentLayout} from './flight-source/environment-layout.mjs';
import {beginGesture,moveGesture,finishGesture} from './gesture.mjs';
const event=(overrides={})=>({pointerId:1,pointerType:'mouse',button:0,buttons:1,clientX:100,clientY:100,...overrides});
test('all six actual authored regions keep world/local placements and source data',()=>{
 const original=JSON.stringify(stageMaps);
 for(const map of stageMaps){const state=sceneryState(map.seaLevel);assert.equal(state.obstacles.length,map.seaLevel.colliders.length);assert.deepEqual(worldToLocal(localToWorld(8,-12)),{x:8,z:-12});
  for(let i=0;i<state.obstacles.length;i++){const p=state.obstacles[i],c=map.seaLevel.colliders[i];assert.deepEqual([p.x,p.y,p.z],c.center);assert.deepEqual([p.half.x,p.half.y,p.half.z],c.halfExtents);}
  const layout=buildEnvironmentLayout(state);assert.ok(layout.clouds.length>=16);assert.equal(layout.islands.length,8);assert.ok(layout.landmarks.length>=6);
  assert.ok(new Set(layout.clouds.map(c=>Math.round(c.y/18))).size>=4);assert.deepEqual(buildEnvironmentLayout(state),layout);
 }assert.equal(JSON.stringify(stageMaps),original);
});
test('camera-relative controls preserve direction and normalized diagonal speed',()=>{
 const forward=cameraMove(0,-1,Math.PI/2);assert.ok(Math.abs(forward.x+1)<1e-12&&Math.abs(forward.z)<1e-12);
 const right=cameraMove(1,0,Math.PI/2);assert.ok(Math.abs(right.z+1)<1e-12);
 for(let i=-20;i<=20;i++)assert.ok(Math.abs(Math.hypot(...Object.values(cameraMove(1,-1,i)))-1)<1e-12);
});
test('left click fires only on release before six CSS pixels',()=>{const g=beginGesture(event());assert.equal(moveGesture(g,event({clientX:105})).kind,'pending');assert.equal(finishGesture(g,event({buttons:0,clientX:105})),'click');});
test('a grab cannot turn back into a shot after returning to start',()=>{const g=beginGesture(event());assert.equal(moveGesture(g,event({clientX:106})).kind,'orbit');moveGesture(g,event());assert.equal(finishGesture(g,event({buttons:0})),'orbit');});
test('other pointers and partial multi-button releases cannot finish the capture',()=>{const g=beginGesture(event({buttons:3}));assert.equal(moveGesture(g,event({pointerId:2})).kind,'ignore');assert.equal(finishGesture(g,event({button:2,buttons:1})),'ignore');assert.equal(finishGesture(g,event({pointerId:2,buttons:0})),'ignore');assert.equal(moveGesture(g,event({buttons:2})).kind,'cancel');});
test('right/middle/touch start orbit and never click',()=>{for(const overrides of [{button:2,buttons:2},{button:1,buttons:4},{pointerType:'touch'}]){const e=event(overrides),g=beginGesture(e);assert.equal(g.mode,'orbit');assert.equal(finishGesture(g,{...e,buttons:0}),'orbit');}});
