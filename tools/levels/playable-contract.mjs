/** Local prototype contract. LU is provisional, never a claim about metres. */
export const CONTRACT = Object.freeze({version:1, frame:'xz-y-up-lu-v1', forward:'+Z', combatAuthority:'tools/battlefield/sim.mjs', stageId:'stage-01-harbor', levelId:'first-voyage', harborId:'jonghang-harbor', saveKey:'cloudstitch.playable-battlefield.v1'});
export function eventKey(voyageId, generation, sequence) {
  if(!voyageId || !Number.isSafeInteger(generation) || !Number.isSafeInteger(sequence)) throw new Error('Invalid event identity');
  return `${voyageId}:${generation}:${sequence}`;
}
export function xz(position) {
  if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite)) throw new Error('Expected [x,y,z]');
  return {x:position[0],z:position[2]};
}
/** Colliders use the inherited circle footprint; AABB remains spatial QA data. */
export function battlefieldWorld(level) {
  const dock=level.triggers.find(t=>t.type==='return-request');
  return {obstacles:level.colliders.filter(c=>c.kind==='solid'&&c.legacyCircleXZ).map(c=>({id:c.id,...c.legacyCircleXZ})),playerSpawn:xz(level.playerStart.position),harbor:{id:dock.id,...dock.hostLegacyCircleXZ}};
}
export function spawnCandidates(level) {
  return level.spawnAnchors.filter(a=>a.tags.includes('enemy')).map(a=>({id:a.id,...xz(a.position),safe:true}));
}
/** Explicit aggregate hit proxies; authoring detail and simulation topology differ. */
export function proxyModules(descriptor) {
  const id=descriptor.enemyId, hp=descriptor.tier==='normal'?64:descriptor.tier==='midboss'?96:144;
  const part=(key,parent,type,maxHp,localX,localZ,radius,weight)=>({id:`${id}:${key}`,key,parentId:parent?`${id}:${parent}`:null,type,name:{root:'핵심 선체',cannon:'주 무장',balloon:'주 기낭','main-engine':'기본 엔진'}[key],hp:maxHp,maxHp,localX,localZ,radius,weight});
  return [part('root',null,'hull',hp,0,0,1.7,0),part('cannon','root','cannon',32,0,3.2,.65,3),part('balloon','root','balloon',48,0,0,1.1,2),part('main-engine','root','engine',32,0,-4.2,.7,2)];
}
