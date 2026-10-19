// Camera presentation only. XZ positions, time and combat remain simulation-owned.
export const cameraProfiles = Object.freeze([
  Object.freeze({id:'oblique',label:'낮은 사선',elevation:32,azimuth:35,description:'선체 옆면과 갑판을 함께 보는 추천 시점'}),
  Object.freeze({id:'side',label:'측면에 가깝게',elevation:20,azimuth:65,description:'배의 실루엣이 잘 보이는 감상 시점'}),
  Object.freeze({id:'high',label:'기존 높은 시점',elevation:55,azimuth:0,description:'전장 배치와 이동 경로가 잘 보이는 비교 기준'})
]);
const radians=value=>value*Math.PI/180;
export function cameraProfile(id){return cameraProfiles.find(profile=>profile.id===id)||cameraProfiles[0];}
export function cameraBasis(id){
  const {elevation,azimuth}=cameraProfile(id),a=radians(azimuth),e=radians(elevation);
  return {right:{x:Math.cos(a),z:-Math.sin(a)},down:{x:Math.sin(a),z:Math.cos(a)},vertical:Math.sin(e),offset:[Math.cos(e)*Math.sin(a)*78,Math.sin(e)*78,Math.cos(e)*Math.cos(a)*78]};
}
export function screenMove(id,right,down){const basis=cameraBasis(id),length=Math.max(1,Math.hypot(right,down));right/=length;down/=length;return {moveX:right*basis.right.x+down*basis.down.x,moveZ:right*basis.right.z+down*basis.down.z};}
export function framingHeight(id,player,contact,goal,aspect){
  if(!contact)return 24;
  const basis=cameraBasis(id),points=[player,contact];
  const horizontal=Math.max(...points.map(p=>Math.abs((p.x-goal.x)*basis.right.x+(p.z-goal.z)*basis.right.z)))+7;
  const vertical=Math.max(...points.map(p=>Math.abs((p.x-goal.x)*basis.down.x+(p.z-goal.z)*basis.down.z)*basis.vertical))+8;
  return Math.max(24,Math.min(44,Math.max(horizontal/Math.max(.25,aspect),vertical)));
}
