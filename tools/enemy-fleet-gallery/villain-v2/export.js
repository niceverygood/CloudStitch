import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {THREE,createContext,makeMaterials,paintVolume,threatClip} from './core.js';
import {rigAndAnimate} from '../../fleet/rigging.js';
import {buildIndustrial} from './industrial.js';
import {buildCult} from './cult.js';
import {buildSpectralWorks} from './spectral-works.js';
let atlas;
window.__initBoldEnemy=b64=>{atlas='data:image/png;base64,'+b64;return true;};
window.__exportBoldEnemy=async({ship,baseline})=>{
 const m=await makeMaterials(atlas,ship.id),ctx=createContext(ship.id,m);
 const treatments=[buildIndustrial,buildCult,buildSpectralWorks].map(build=>build(ctx)).filter(Boolean);
 if(treatments.length!==1)throw Error('Expected exactly one complete body: '+ship.id);
 const art=treatments[0],b=baseline.observedBounds||baseline.bounds;
 if(!b?.size?.every(Number.isFinite)||b.size[0]<=0)throw Error('Missing verified native baseline bounds');
 const scale=b.size[0]/18;
 // Common authoring units map to the previous asset's native art units. No
 // independent camera fit or screen normalization is applied to the two sides.
 const form=ctx.motion.children[0];form.scale.multiplyScalar(scale);
 const before=new THREE.Box3().setFromObject(ctx.scene);
 form.position.set((b.min[0]+b.max[0])/2,b.min[1]-before.min.y,(b.min[2]+b.max[2])/2);
 const shapeBounds=new THREE.Box3().setFromObject(ctx.scene),size=shapeBounds.getSize(new THREE.Vector3());
 ctx.scene.userData={title:'Cloudstitch',assetId:ship.id,assetName:ship.name,version:'enemy-villain-2',artVariant:'dominant-form-rebuild-v2',visualOnly:true,modules:baseline.modules,sourceModelSha256:ship.sourceModelSha256,baselineIdentity:baseline.identity,artModules:art.artModules,villainFeatures:art.features,theme:art.theme,authoredUnits:'relative art units; not metres or collision sizes',gameplayIntegration:'No gameplay, collider, socket, equipment count, damage or save changes.'};
 paintVolume(ctx.scene);
 const rig=rigAndAnimate(ctx.scene,ctx.controls,{motionScale:Math.max(.1,b.size[0]/10),style:/ghost/.test(ship.id)?'ghost':/cult|funeral/.test(ship.id)?'cult':'union'});
 const extra=threatClip(ctx),clips=rig.clips.concat(extra);
 ctx.scene.userData.rig.clips.push({name:extra.name,duration:extra.duration,tracks:extra.tracks.length,ambientOnly:false});
 ctx.scene.userData.availableActions.push(extra.name);
 const binary=await new GLTFExporter().parseAsync(ctx.scene,{binary:true,animations:clips,trs:true,onlyVisible:true});
 const bytes=new Uint8Array(binary);let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));
 return {base64:btoa(str),...art,rig:rig.stats,normalization:{artUnitScale:scale,baselineX:b.size[0],bounds:{min:shapeBounds.min.toArray(),max:shapeBounds.max.toArray(),size:size.toArray()},kind:'fixed native baseline-unit mapping; no old body loaded'},threatTargets:ctx.threats.map(t=>({name:t.node.name,axis:t.axis,angle:t.angle})),clips:clips.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length}))};
};
