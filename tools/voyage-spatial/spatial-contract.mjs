/** Y-up, world XZ = campaign local XZ. No physics/state coordinate is rescaled. */
export const SPATIAL_FRAME = Object.freeze({id:'campaign-spatial-yup-v1',unitsPerLocalUnit:1,origin:[0,0,0],flightY:0});
export const localToWorld = (x,z,y=0) => ({x,y,z});
export const worldToLocal = point => ({x:point.x,z:point.z});
export function cameraMove(x,z,yaw){
 const length=Math.max(1,Math.hypot(x,z));
 return {x:(Math.cos(yaw)*x+Math.sin(yaw)*z)/length,z:(-Math.sin(yaw)*x+Math.cos(yaw)*z)/length};
}
export function sceneryState(level){
 const start=level.playerStart?.position||[0,0,55],bounds=level.bounds;
 const gates=(level.corridors?.[0]?.points||[]).map(p=>({x:p[0],y:p[1],z:p[2],radius:4}));
 // The reused layout protects its last gate as the immutable departure point.
 gates.push({x:start[0],y:start[1],z:start[2],radius:4});
 return {bounds:{minX:bounds.min[0],maxX:bounds.max[0],minY:-18,maxY:72,minZ:bounds.min[2],maxZ:bounds.max[2]},
  player:localToWorld(start[0],start[2],start[1]),gates,
  targets:(level.spawnAnchors||[]).map(p=>({...localToWorld(p.position[0],p.position[2],p.position[1]),radius:3})),
  obstacles:(level.colliders||[]).map(p=>({id:p.id,kind:'box',x:p.center[0],y:p.center[1],z:p.center[2],half:{x:p.halfExtents[0],y:p.halfExtents[1],z:p.halfExtents[2]}}))};
}
