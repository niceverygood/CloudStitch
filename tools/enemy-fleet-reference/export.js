import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { THREE, loadPaintedMaterials, createContext, paintVolume } from './kit.js';
import { rigAndAnimate } from '../fleet/rigging.js';
import { buildPirateScout, buildCultBlockade } from './scout-cult.js';
import { buildUnionSalvage, buildUnionRepair } from './industrial.js';
import { buildGhostChaser, buildDisguisedWreck } from './ghost-wreck.js';
const builders={ 'enemy-pirate-scout':buildPirateScout,'enemy-cult-blockade':buildCultBlockade,'enemy-union-salvage':buildUnionSalvage,'enemy-union-repair':buildUnionRepair,'enemy-ghost-chaser':buildGhostChaser,'enemy-disguised-wreck':buildDisguisedWreck };
let materials;
window.__initEnemyReference=async atlas=>{materials=await loadPaintedMaterials('data:image/png;base64,'+atlas);return true;};
window.__exportEnemyReference=async ({ship,referenceSha256})=>{
  const m=Object.fromEntries(Object.entries(materials).map(([key,mat])=>[key,mat.clone()]));
  const ctx=createContext(ship.id,m),built=builders[ship.id](ctx);
  const names=new Set();ctx.scene.traverse(node=>{if(node.name&&names.has(node.name))throw new Error('Duplicate object name '+node.name);if(node.name)names.add(node.name);});
  for(const point of built.weakpoints)if(!ctx.scene.getObjectByName(point.nodeName))throw new Error('Missing weakpoint '+point.nodeName);
  ctx.scene.userData={title:'Cloudstitch',version:'enemy-reference-1',assetId:ship.id,assetName:ship.name,category:ship.category,scopeKind:ship.scopeKind,sourceFiles:ship.sourceFiles,confirmedModules:ship.modules,artModules:built.artModules,referenceSha256,weakpoints:built.weakpoints,features:built.features,referenceNotes:built.referenceNotes,deployRig:built.deployRig||null,authoredUnits:'reference-art LU; not metres',forwardAxis:'-X',upAxis:'+Y',gameplayIntegration:'Art-only; collision, sockets, damage and AI unchanged.'};
  paintVolume(ctx.scene);
  const deploy=ctx.controls.filter(item=>item.deployment);
  const {clips,stats}=rigAndAnimate(ctx.scene,ctx.controls.filter(item=>!item.deployment),{motionScale:10,style:ship.id.includes('ghost')?'ghost':'warm'});
  if(deploy.length){
    const tracks=[];
    for(const item of deploy){const axis=new THREE.Vector3(item.axis==='x'?1:0,item.axis==='y'?1:0,item.axis==='z'?1:0),bind=item.bone.quaternion.clone(),open=bind.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis,item.deployAngle)),times=[0,.4,2.5,3.4],values=[...bind.toArray(),...bind.toArray(),...open.toArray(),...open.toArray()];tracks.push(new THREE.QuaternionKeyframeTrack(item.bone.name+'.quaternion',times,values));}
    clips.push(new THREE.AnimationClip('AmbushReveal',3.4,tracks));
  }
  ctx.scene.userData.availableActions=[...stats.availableActions,...(deploy.length?['AmbushReveal']:[])];
  const binary=await new GLTFExporter().parseAsync(ctx.scene,{binary:true,animations:clips,trs:true,onlyVisible:true});
  const bytes=new Uint8Array(binary);let b64='';for(let i=0;i<bytes.length;i+=32768)b64+=String.fromCharCode(...bytes.subarray(i,i+32768));
  ctx.scene.traverse(node=>{if(node.isMesh)node.geometry.dispose();});
  return{base64:btoa(b64),metadata:built,metrics:stats,availableActions:ctx.scene.userData.availableActions};
};
