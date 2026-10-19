import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import {SPEC,REFERENCE,REFERENCE_SHA} from './spec.mjs';
import {buildWeapon} from './models.mjs';
import {census,dispose} from './inspect.mjs';
const require=createRequire(import.meta.url);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const out=path.resolve('outputs/grounded-weapons-v2');
const write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');};
if(!process.argv.includes('--slot-start'))throw new Error('Central export slot START is required. Source inspection uses run.cjs inspect.');
const validator=require(process.env.GLTF_VALIDATOR_PATH||'gltf-validator');
globalThis.ProgressEvent??=class{constructor(type,data={}){this.type=type;Object.assign(this,data);}};
globalThis.FileReader??=class{
  readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();}).catch(e=>this.onerror?.(e));}
  readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result='data:'+blob.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.();}).catch(e=>this.onerror?.(e));}
};
if(sha(fs.readFileSync(REFERENCE))!==REFERENCE_SHA)throw new Error('Approved reference changed');
const items=[],results=[];
for(const spec of SPEC){
  const root=buildWeapon(spec),source=census(root);
  const bytes=Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,trs:true}));
  if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Invalid binary glTF '+spec.id);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
  const actual=census(gltf.scene);
  if(actual.triangles!==source.triangles||actual.meshes!==source.meshes)throw new Error('GLB roundtrip differs '+spec.id);
  const validation=await validator.validateBytes(new Uint8Array(bytes),{maxIssues:100,externalResourceFunction:async()=>{throw new Error('No external resources');}});
  const standard={errors:validation.issues.numErrors,warnings:validation.issues.numWarnings,infos:validation.issues.numInfos,messages:validation.issues.messages};
  if(standard.errors)throw new Error('Official validator error '+spec.id+': '+JSON.stringify(standard));
  const model='assets/'+spec.id+'.glb',manifest='manifests/'+spec.id+'.json';
  fs.mkdirSync(path.join(out,'assets'),{recursive:true});fs.writeFileSync(path.join(out,model),bytes);
  const record={...spec,status:'completed_static_3d_art_prototype',model,bytes:bytes.length,sha256:sha(bytes),...actual,
    reference:{path:REFERENCE,sha256:REFERENCE_SHA,preserved:true,style_approved:true,individual_design_approval:'pending'},
    method:'Original expansion designs using the approved board palette and material language; not designs depicted in that board. Local multipart geometry and vertex painting.',
    standard_validator:standard,GLTFLoader_roundtrip:true,
    limitations:['Static model: no animation, collider, damage, physics, LOD or approved engine socket.','Unseen sides and small details are original 3D interpretations of a single concept sheet.','Vertex paint is embedded; outline and toon shading are viewer runtime effects.','Artist approval of the 3D interpretation is pending.']};
  write(path.join(out,manifest),record);
  items.push({...spec,status:record.status,model,manifest,preview:'previews/'+spec.id+'.png',triangles:actual.triangles,mesh_count:actual.meshes,material_count:actual.material_count,texture_count:0,animation_count:0,bytes:bytes.length,sha256:record.sha256,bounds:actual.bounds});
  results.push({id:spec.id,bytes:bytes.length,sha256:record.sha256,triangles:actual.triangles,meshes:actual.meshes,GLTFLoader_roundtrip:true,standard_validator:standard});
  console.log(JSON.stringify({id:spec.id,triangles:actual.triangles,meshes:actual.meshes,bytes:bytes.length,errors:standard.errors,warnings:standard.warnings}));
  dispose(root);dispose(gltf.scene);
}
if(sha(fs.readFileSync(REFERENCE))!==REFERENCE_SHA)throw new Error('Reference modified during export');
write(path.join(out,'catalog.json'),{game_title:'Cloudstitch',title:'비행선 무기 공방 · 3D 에셋 6종',type:'grounded-weapon-art-prototypes',independent_asset_count:6,reference:REFERENCE,reference_sha256:REFERENCE_SHA,items});
write(path.join(out,'glb-verification.json'),{checked:results.length,errors:results.reduce((s,x)=>s+x.standard_validator.errors,0),warnings:results.reduce((s,x)=>s+x.standard_validator.warnings,0),reference_preserved:true,results,passed:results.length===6&&results.every(x=>!x.standard_validator.errors)});
