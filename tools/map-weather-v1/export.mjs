/** Central-slot only: reusable static GLB snapshots. Runtime motion is separate. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createWeatherAssets } from './assets.mjs';
import { WEATHER_ASSET_CATALOG } from './asset-catalog.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),OUT=path.join(ROOT,'outputs/map-weather-v1');
const require=createRequire(import.meta.url),deps=process.env.CLOUDSTITCH_NODE_MODULES;const validator=require(require.resolve('gltf-validator',{paths:[deps||ROOT,ROOT]}));
globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();}).catch(e=>this.onerror?.(e));}readAsDataURL(b){b.arrayBuffer().then(v=>{this.result='data:'+b.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.();}).catch(e=>this.onerror?.(e));}};
const assets=createWeatherAssets(),items=[],failures=[];fs.mkdirSync(path.join(OUT,'assets'),{recursive:true});
assets.update({time:0,weather:{},player:{}},0);
for(const [id,station]of assets.stations){
 const root=station.clone(true);root.position.set(0,0,0);root.name='cloudstitch_weather_'+id;
 const instanced=[];root.traverse(o=>{if(o.isInstancedMesh)instanced.push(o);});
 for(const source of instanced){const group=new THREE.Group();group.name=source.name+'_expanded_static';group.position.copy(source.position);group.quaternion.copy(source.quaternion);group.scale.copy(source.scale);group.visible=source.visible;const m=new THREE.Matrix4();for(let i=0;i<source.count;i++){source.getMatrixAt(i,m);const mesh=new THREE.Mesh(source.geometry,source.material);mesh.name=source.name+'_'+i;m.decompose(mesh.position,mesh.quaternion,mesh.scale);group.add(mesh);}source.parent.add(group);source.removeFromParent();}
 let meshes=0,triangles=0;root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))throw Error(id+' nonfinite geometry');});
 const glb=Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false,trs:true}));
 const file='assets/'+id+'.glb';fs.writeFileSync(path.join(OUT,file),glb);const report=await validator.validateBytes(new Uint8Array(glb),{uri:file});
 const spec=WEATHER_ASSET_CATALOG.find(s=>s.id===id);items.push({...spec,model:file,bytes:glb.length,sha256:crypto.createHash('sha256').update(glb).digest('hex'),meshes,triangles:Math.round(triangles),animations:0,validation:{errors:report.issues.numErrors,warnings:report.issues.numWarnings,infos:report.issues.numInfos}});
 if(report.issues.numErrors)failures.push({id,issues:report.issues.messages.filter(m=>m.severity===0)});
}
assets.dispose();const summary={revision:'map-weather-v1',date:'2026-10-18',assemblyGLBs:6,newFixtureAssemblies:5,reusedCloudAssets:4,newCloudAssets:0,staticSnapshots:true,runtimeMotionFile:'tools/map-weather-v1/assets.mjs',limits:['GLB snapshots contain geometry/materials; runtime procedural movement, transparency changes, hazard timing and damage are implemented by the separate controller/authority.','Six assembly snapshots are not six newly generated cloud assets. Existing cloud shapes are reused.','No engine production colliders, LOD, fluid simulation or approved performance budget.'],items,failures,passed:items.length===6&&!failures.length};
fs.writeFileSync(path.join(OUT,'asset-catalog.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({assemblyGLBs:items.length,bytes:items.reduce((n,a)=>n+a.bytes,0),errors:items.reduce((n,a)=>n+a.validation.errors,0),warnings:items.reduce((n,a)=>n+a.validation.warnings,0),passed:summary.passed}));if(!summary.passed)process.exitCode=1;
