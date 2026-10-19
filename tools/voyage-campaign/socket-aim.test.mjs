/** Analytic pose tests only. No browser, GLB rewrite or fabricated hit receipt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {aimSocketAt} from './socket-aim.mjs';

function rig({origin={x:0,y:0,z:0},pivotForward=3.02,barrel=1.6,side=.12}={}){
  let yaw=0,heading=0,frame=null,calls=0;
  return {
    origin,
    aimRelative(dx,dz,bodyHeading){yaw=Math.atan2(dx,dz);heading=bodyHeading;calls++;},
    readFrame(){
      // Body +Z pivot offset, independently turning barrel and lateral socket.
      // Parent position is read afresh on every call; all data is world XZ.
      const forward={x:Math.sin(yaw),z:Math.cos(yaw)},right={x:Math.cos(yaw),z:-Math.sin(yaw)};
      frame={position:{x:origin.x+Math.sin(heading)*pivotForward+forward.x*barrel+right.x*side,y:origin.y+1.3,z:origin.z+Math.cos(heading)*pivotForward+forward.z*barrel+right.z*side},direction:{x:forward.x,y:0,z:forward.z},source:'analytic-offset-socket'};
      return Object.freeze({...frame,position:Object.freeze(frame.position),direction:Object.freeze(frame.direction)});
    },
    get calls(){return calls;}
  };
}
const lateralError=(frame,target)=>Math.abs((target.x-frame.position.x)*frame.direction.z-(target.z-frame.position.z)*frame.direction.x);

test('offset socket solver converges around eight body headings and eight target directions',()=>{
  let oldMisses=0,poses=0,maxCorrected=0,maxIterations=0;
  for(let body=0;body<8;body++)for(let direction=0;direction<8;direction++)for(const distance of [20,27]){
    const heading=body*Math.PI/4,angle=direction*Math.PI/4;
    const origin={x:117.25,y:-2,z:-46.75},target={x:origin.x+Math.sin(angle)*distance,y:0,z:origin.z+Math.cos(angle)*distance};
    const source=rig({origin});
    source.aimRelative(target.x-origin.x,target.z-origin.z,heading);const previous=source.readFrame();
    if(lateralError(previous,target)>1.7)oldMisses++;
    const result=aimSocketAt({...source,origin,target,heading});
    assert.equal(result.ok,true,JSON.stringify({body,direction,distance,result}));
    assert(result.iterations<=8);
    assert(result.crossTrackError<.02);
    assert(result.angleErrorRadians<=1e-4);
    assert(result.forwardDistance>0);
    assert.equal(result.frame.source,'analytic-offset-socket');
    assert(Math.abs(result.crossTrackError-lateralError(result.frame,target))<1e-10);
    maxCorrected=Math.max(maxCorrected,result.crossTrackError);maxIterations=Math.max(maxIterations,result.iterations);poses++;
  }
  assert.equal(poses,128);assert(oldMisses>0);assert(maxCorrected<.02);assert(maxIterations<=8);
});

test('a side target misses the root before yaw correction and clears its centre after correction',()=>{
  const source=rig(),target={x:27,z:0};
  source.aimRelative(target.x,target.z,0);const before=source.readFrame();
  assert(lateralError(before,target)>1.7);
  const result=aimSocketAt({...source,origin:source.origin,target,heading:0});
  assert(result.ok);assert(result.crossTrackError<.02);
});

test('solver returns the actual callback frame without changing position, direction or metadata',()=>{
  const source=rig({origin:{x:-18,y:4,z:22}}),target={x:6,z:17};let lastFrame=null;
  const readFrame=()=>{lastFrame=source.readFrame();return lastFrame;};
  const result=aimSocketAt({aimRelative:source.aimRelative,readFrame,origin:source.origin,target,heading:2.3});
  assert.equal(result.ok,true);assert.equal(result.frame,lastFrame);
  assert(Object.isFrozen(result.frame)&&Object.isFrozen(result.frame.position)&&Object.isFrozen(result.frame.direction));
  assert.deepEqual(result.frame,source.readFrame());
});

test('world translation and newly moved parent positions preserve aim convergence',()=>{
  const source=rig({origin:{x:21,y:3,z:57}}),heading=-1.9,target={x:45,z:43};
  const initial=aimSocketAt({...source,origin:source.origin,target,heading});assert(initial.ok);
  source.origin.x+=300;source.origin.z-=120;
  const movedTarget={x:target.x+300,z:target.z-120};
  const moved=aimSocketAt({...source,origin:source.origin,target:movedTarget,heading});assert(moved.ok);
  assert(Math.abs(moved.frame.position.x-initial.frame.position.x-300)<1e-8);
  assert(Math.abs(moved.frame.position.z-initial.frame.position.z+120)<1e-8);
  assert(Math.abs(moved.crossTrackError-initial.crossTrackError)<1e-8);
});

test('a short unreachable target and coincident origin finish within the iteration bound',()=>{
  const source=rig(),target={x:0,z:1};
  const result=aimSocketAt({...source,origin:source.origin,target,maxIterations:8});
  assert.equal(result.ok,false);assert(result.iterations<=8);assert.equal(source.calls,result.iterations);
  assert.equal(result.reason,'iteration-limit');assert(Number.isFinite(result.crossTrackError));
  const coincident=aimSocketAt({...source,origin:source.origin,target:source.origin});
  assert.equal(coincident.ok,false);assert.equal(coincident.reason,'coincident-target');assert.equal(coincident.iterations,0);
  const limited=rig();const one=aimSocketAt({...limited,origin:limited.origin,target:{x:20,z:0},maxIterations:1});
  assert.equal(one.iterations,1);assert.equal(one.ok,false);assert.equal(limited.calls,1);
});

test('invalid coordinates, callback failures and unusable frame data fail without fabricated rays',()=>{
  const source=rig(),valid={...source,origin:source.origin,target:{x:20,z:0}};
  for(const options of [null,{...valid,heading:NaN},{...valid,origin:{x:Infinity,z:0}},{...valid,target:{x:20,z:NaN}},
    {...valid,target:{x:20,y:Infinity,z:0}},{...valid,maxIterations:9},{...valid,maxIterations:1.5},{...valid,tolerance:0},
    {...valid,angleToleranceRadians:NaN},{...valid,readFrame:null}]){
    const result=aimSocketAt(options??{});assert.equal(result.ok,false);assert.equal(result.frame,null);assert.equal(result.iterations,0);
  }
  for(const readFrame of [()=>null,()=>({position:{x:0,z:0},direction:{x:0,z:0}}),()=>({position:{x:NaN,z:0},direction:{x:1,z:0}}),()=>({position:{x:0,z:0},direction:{x:1,y:Infinity,z:0}})]){
    const result=aimSocketAt({...valid,readFrame});assert.equal(result.ok,false);assert.equal(result.frame,null);assert.equal(result.reason,'invalid-frame');assert.equal(result.iterations,1);
  }
  const thrown=aimSocketAt({...valid,aimRelative(){throw new Error('rig unavailable');}});
  assert.equal(thrown.ok,false);assert.equal(thrown.frame,null);assert.equal(thrown.reason,'callback-failed');
});
