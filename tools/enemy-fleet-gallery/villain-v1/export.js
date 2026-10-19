import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {THREE,group,makeMaterials,paintVolume} from './core.js';
import {addCultBoss} from './cult-boss.js';
import {addIndustrial} from './industrial.js';
import {addScoutGhost} from './scout-ghost.js';
let atlas;
window.__initVillain=async b64=>{atlas='data:image/png;base64,'+b64;return true;};
window.__exportVillain=async({base64,ship})=>{
 const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer,''),scene=gltf.scene;
 scene.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const factor=18/Math.max(size.x,.001),hull=scene.getObjectByName('HullMotion')||scene.children[0],inv=new THREE.Matrix4().copy(hull.matrixWorld).invert();
 // The attachment coordinates use a common art canvas, then map back into the
 // existing bind pose. The original skeleton and animation keys are preserved.
 const root=group(hull,ship.id+'-villain-landmarks');
 const world=new THREE.Matrix4().makeTranslation(center.x,bounds.min.y,center.z).multiply(new THREE.Matrix4().makeScale(1/factor,1/factor,1/factor));
 root.applyMatrix4(inv.multiply(world));
 const m=await makeMaterials(atlas,ship.id),features=[];
 const ctx={id:ship.id,root,m,unit:1,features,sourceScene:scene,sourceBounds:bounds};
 if(![addCultBoss,addIndustrial,addScoutGhost].some(build=>build(ctx)))throw Error('No art treatment for '+ship.id);
 // Recolour material families, retaining existing maps and baked vertex paint.
 const palette=ship.id.includes('ghost')?{dark:0x5b7280,canvas:0x9aafb5,wood:0x857d76,metal:0x7b8d96}:ship.id.includes('cult')||ship.id.includes('funeral')||ship.id.includes('bell')?{dark:0x5e6471,canvas:0xd8c4a5,wood:0x8d6e66,metal:0x78818c}:{dark:0x626a70,canvas:0xb79f8d,wood:0xaa795f,metal:0x8a9699};
 const treated=new Set();scene.traverse(node=>{if(!node.isMesh||root.getObjectById(node.id))return;for(const mat of Array.isArray(node.material)?node.material:[node.material]){if(treated.has(mat))continue;treated.add(mat);const key=Object.keys(palette).find(k=>mat.name.toLowerCase().includes(k));if(key)mat.color.setHex(palette[key]);mat.roughness=1;mat.metalness=0;}});
 paintVolume(root);
 let metadata=scene.userData;if(!metadata?.assetId)metadata=scene.children.find(n=>n.userData?.assetId)?.userData||{};
 scene.userData={...metadata,title:'Cloudstitch',assetId:ship.id,assetName:ship.name,version:'enemy-villain-1',villainFeatures:features,visualOnly:true,sourceModelSha256:ship.sourceModelSha256,gameplayIntegration:'Art-only. Existing modules/animation/IDs retained; no new damage, AI, collision or save.'};
 const originalClips=gltf.animations.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length}));
 const binary=await new GLTFExporter().parseAsync(scene,{binary:true,animations:gltf.animations,trs:true,onlyVisible:true});
 const result=new Uint8Array(binary);let str='';for(let i=0;i<result.length;i+=32768)str+=String.fromCharCode(...result.subarray(i,i+32768));
 return{base64:btoa(str),features,originalClips,addedMeshes:(()=>{let n=0;root.traverse(o=>{if(o.isMesh)n++;});return n;})()};
};
