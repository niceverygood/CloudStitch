/** Lightweight spatial-data tests. No GLB scan, browser or gameplay assertion. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stageMaps} from './maps.mjs';
import {boxAt, segmentAABB, placementReport, availableSpawns} from '../levels/adapter.mjs';

const read = relative => JSON.parse(fs.readFileSync(new URL(`../../${relative}`,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const world = read('outputs/world-assets/catalog.json');
const scenes = read('outputs/world-assets/scene-catalog.json');
const encounters = read('tools/encounters/catalog.json');
const assets = new Map(world.items.map(item=>[item.id,item]));
const finiteVector = value => Array.isArray(value) && value.length===3 && value.every(Number.isFinite);
const distance = (a,b) => Math.hypot(a[0]-b[0],a[2]-b[2]);
function segmentDistance(point,start,end) {
  const dx=end[0]-start[0],dz=end[2]-start[2],lengthSquared=dx*dx+dz*dz;
  const t=lengthSquared ? Math.max(0,Math.min(1,((point[0]-start[0])*dx+(point[2]-start[2])*dz)/lengthSquared)) : 0;
  return Math.hypot(point[0]-start[0]-t*dx,point[2]-start[2]-t*dz);
}
function pathDistance(point,corridor) {
  return Math.min(...corridor.points.slice(1).map((end,index)=>segmentDistance(point,corridor.points[index],end)));
}
function unique(items,label) {
  assert(items.every(item=>typeof item.id==='string'&&item.id.length>0),`${label} IDs`);
  assert.equal(new Set(items.map(item=>item.id)).size,items.length,`${label} unique IDs`);
}

test('six canonical region IDs use existing scenes and independent catalog assets',()=>{
  assert.equal(world.items.length,96);
  assert.equal(stageMaps.length,6);unique(stageMaps,'maps');
  assert.deepEqual(stageMaps.map(item=>item.stageId),encounters.stages.map(item=>item.id));
  assert.deepEqual(stageMaps.map(item=>item.order),[1,2,3,4,5,6]);
  assert.equal(new Set(stageMaps.map(item=>item.theme.sky)).size,6);
  assert.equal(new Set(stageMaps.map(item=>item.landmark)).size,6);
  for(const map of stageMaps){
    assert.equal(map.region,encounters.stages.find(stage=>stage.id===map.stageId).region);
    assert(scenes.items.some(scene=>scene.id===map.sceneId));
    for(const color of Object.values(map.theme))assert.match(color,/^#[0-9a-f]{6}$/i);
    for(const visual of map.seaLevel.visuals)assert(assets.has(visual.assetId),`${map.id}/${visual.assetId}`);
  }
});

test('frozen eight-object renderer includes every solid and selected regional landmarks',()=>{
  const keyVisuals = [
    ['empty-bell','wreck-crane','return-buoy-west'],['teal-mineral','wind-vane'],['storm-wall','grounding-marker'],
    ['yard-crane','yard-tools'],['old-lighthouse','fog-beacon-1','fog-beacon-2'],['sealed-west']
  ];
  for(const [index,map] of stageMaps.entries()){
    const eligible=map.seaLevel.visuals.filter(item=>['required','landmark'].includes(item.priority));
    assert(eligible.length<=8,`${map.id} visible-object budget`);
    const expected=[...map.seaLevel.colliders.flatMap(item=>item.visualIds),...keyVisuals[index]];
    assert.equal(new Set(expected).size,8,`${map.id} eight distinct selected visuals`);
    assert.deepEqual(new Set(eligible.map(item=>item.id)),new Set(expected),`${map.id} exact frozen-renderer selection`);
    for(const id of expected)assert.equal(eligible.find(item=>item.id===id)?.priority,'required',`${map.id}/${id} required`);
    for(const visual of map.seaLevel.visuals)if(!expected.includes(visual.id))assert.equal(visual.priority,'decoration',`${map.id}/${visual.id} preserved deferred decoration`);
    assert.match(map.seaLevel.provenance.visualBudgetNote,/eight required catalog visuals/);
  }
});

for(const map of stageMaps) test(`${map.id}: finite geometry, full routes and reserved spawns`,()=>{
  const level=map.seaLevel,bodyRadius=5.3,spawnMargin=2,body=[bodyRadius,2,bodyRadius];
  assert.equal(level.frameId,'levels-lu-yup-v1');
  assert.deepEqual(level.bounds,{min:[-90,-10,-90],max:[90,10,90]});
  assert.deepEqual(level.playerStart.position,[0,0,55]);
  assert.equal(level.camera.elevationDegrees,55);
  for(const collection of ['visuals','colliders','spawnAnchors','triggers','corridors','turningPockets','referenceTargets'])unique(level[collection],`${map.id}/${collection}`);
  for(const visual of level.visuals){
    assert(finiteVector(visual.position)&&Number.isFinite(visual.yawRadians)&&visual.longestLU>0);
    assert.equal(visual.anchor,'center');
    assert(['required','landmark','decoration'].includes(visual.priority));
  }
  for(const collider of level.colliders){
    assert.equal(collider.kind,'solid');
    assert(finiteVector(collider.center)&&finiteVector(collider.halfExtents));
    assert(collider.halfExtents.every(value=>value>0));
    assert(collider.visualIds.every(id=>level.visuals.some(visual=>visual.id===id)));
    assert.equal(collider.cameraPolicy,'fade-visual-only');
    assert.equal(collider.legacyCircleXZ.x,collider.center[0]);
    assert.equal(collider.legacyCircleXZ.z,collider.center[2]);
    assert(collider.legacyCircleXZ.radius>0);
  }
  for(const corridor of level.corridors){
    assert(corridor.widthLU>=18&&corridor.points.length>=2);
    for(const waypoint of corridor.points){
      assert(finiteVector(waypoint));
      const margin=corridor.widthLU/2+3;
      assert(waypoint[0]-margin>=-90&&waypoint[0]+margin<=90&&waypoint[2]-margin>=-90&&waypoint[2]+margin<=90,`${corridor.id} boundary`);
    }
    for(const collider of level.colliders){
      // A full 18/20 LU route plus 3 LU bow allowance clears host circles.
      const minimum=collider.legacyCircleXZ.radius+corridor.widthLU/2+3;
      assert(pathDistance(collider.center,corridor)>minimum,`${map.id}/${corridor.id} clears ${collider.id}: ${pathDistance(collider.center,corridor)} > ${minimum}`);
      // Compatibility: authored AABBs also allow the complete route envelope.
      for(let index=1;index<corridor.points.length;index++)assert.equal(segmentAABB(corridor.points[index-1],corridor.points[index],boxAt(collider.center,collider.halfExtents),[corridor.widthLU/2,2,corridor.widthLU/2]),null,`${map.id}/${corridor.id} box ${collider.id}`);
    }
  }
  const main=level.corridors.find(item=>item.id==='main-flight');
  const home=level.corridors.find(item=>item.id==='return-approach');
  assert.deepEqual(main.points[0],level.playerStart.position);
  assert.deepEqual(home.points[0],main.points.at(-1));
  assert.deepEqual(home.points.at(-1),[0,0,67]);
  for(const objective of map.objectives){
    assert(finiteVector(objective.position));
    assert(pathDistance(objective.position,main)<1e-8,`${objective.id} is on main route`);
  }
  const initial=placementReport(level,level.playerStart.position,body);
  assert(initial.insideBounds&&initial.solidIds.length===0);
  assert(level.spawnAnchors.length>=6);
  for(const anchor of level.spawnAnchors){
    assert(finiteVector(anchor.position));assert(anchor.tags.includes('enemy'));assert.equal(anchor.headingRadians,0);
    const occupiedRadius=bodyRadius+spawnMargin;
    assert(anchor.position[0]-occupiedRadius>-90&&anchor.position[0]+occupiedRadius<90&&anchor.position[2]-occupiedRadius>-90&&anchor.position[2]+occupiedRadius<90);
    assert(distance(anchor.position,level.playerStart.position)>occupiedRadius*2,`${anchor.id} player separation`);
    for(const collider of level.colliders)assert(distance(anchor.position,collider.center)>collider.legacyCircleXZ.radius+occupiedRadius,`${anchor.id} body and safety margin`);
    for(const other of level.spawnAnchors)if(anchor!==other)assert(distance(anchor.position,other.position)>occupiedRadius*2,`${anchor.id} separate from ${other.id}`);
    const placement=placementReport(level,anchor.position,body);assert(placement.insideBounds&&placement.solidIds.length===0);
    const reserved=availableSpawns(level,body,[{id:'occupied-ship',position:anchor.position,halfExtents:body}]).find(item=>item.id===anchor.id);
    assert.equal(reserved.available,false);assert(reserved.occupiedIds.includes('occupied-ship'));
  }
  for(const pocket of level.turningPockets){
    assert(pocket.radiusLU>=bodyRadius*1.5);
    const placement=placementReport(level,pocket.center,[pocket.radiusLU,2,pocket.radiusLU]);
    assert(placement.insideBounds&&placement.solidIds.length===0,`${pocket.id} full rotation box`);
    for(const collider of level.colliders)assert(distance(pocket.center,collider.center)>pocket.radiusLU+collider.legacyCircleXZ.radius);
  }
  assert.deepEqual(level.triggers[0],{
    id:'return-to-jonghang',type:'return-request',center:[0,0,67],halfExtents:[8,5,8],target:'jonghang-harbor',owner:'harbor',requiresConfirmation:true,
    hostLegacyCircleXZ:{x:0,z:67,radius:12},note:'Availability only. Controller owns return confirmation, receipt and safe saving.'
  });
});
