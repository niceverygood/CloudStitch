import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraProfiles,cameraBasis,screenMove,framingHeight} from './camera-profiles.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('each view preserves screen directions without changing diagonal speed',()=>{
  for(const view of cameraProfiles){
    const basis=cameraBasis(view.id);
    for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const movement=screenMove(view.id,x,z),length=Math.hypot(x,z);
      close(movement.moveX*basis.right.x+movement.moveZ*basis.right.z,x/length);
      close(movement.moveX*basis.down.x+movement.moveZ*basis.down.z,z/length);
      close(Math.hypot(movement.moveX,movement.moveZ),1);
    }
  }
});
test('rotated camera basis is orthonormal with a downward view and constant distance',()=>{
  for(const view of cameraProfiles){const b=cameraBasis(view.id);close(Math.hypot(...b.offset),78);close(b.right.x*b.down.x+b.right.z*b.down.z,0);close(Math.hypot(b.right.x,b.right.z),1);assert.ok(b.offset[1]>0);}
});
test('framing uses rotated screen extents and remains bounded on narrow screens',()=>{
  const player={x:0,z:35},enemy={x:-30,z:-12},goal={x:-10,z:16};
  for(const view of cameraProfiles){for(const aspect of [1.6,.46]){const half=framingHeight(view.id,player,enemy,goal,aspect);assert.ok(half>=24&&half<=44);}}
  assert.notEqual(framingHeight('high',player,enemy,goal,1.6),framingHeight('side',player,enemy,goal,1.6));
});
test('switching views repeatedly always derives movement from raw keys',()=>{
  const raw=Object.freeze({x:1,z:-1}),first=screenMove('oblique',raw.x,raw.z);
  for(const id of ['oblique','side','high','side','high','oblique']){const moved=screenMove(id,raw.x,raw.z);close(Math.hypot(moved.moveX,moved.moveZ),1);}
  assert.deepEqual(screenMove('oblique',raw.x,raw.z),first);assert.deepEqual(raw,{x:1,z:-1});
});
