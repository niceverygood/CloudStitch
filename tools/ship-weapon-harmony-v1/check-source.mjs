import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PLANS,compose} from './assembly.js';
const require=createRequire(import.meta.url),checks=require(path.resolve('tools/qa/world-gltf.cjs'));
globalThis.ProgressEvent??=class{constructor(type){this.type=type;}};
async function load(p){const b=checks.geometryOnly(fs.readFileSync(p));return(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'')).scene;}
const contract=JSON.parse(fs.readFileSync('docs/SHIP_WEAPON_MOUNTING.json','utf8')),results=[];
for(const plan of PLANS){const shipPath=contract.shipBaseline+plan.id+'-r5.glb',ship=await load(shipPath),weapon=await load(plan.weapon);const a=compose(plan,ship,weapon);let count=0,finite=true;a.root.traverse(n=>{finite&&=n.matrixWorld.elements.every(Number.isFinite);if(n.isMesh)count++;});if(!finite||!a.record.removed_source_copy_nodes.length)throw new Error('Invalid copied assembly '+plan.id);const box=new THREE.Box3().setFromObject(a.mount);results.push({id:plan.id,ship:shipPath,source_only:true,finite,meshes:count,weapon_bounds:{min:box.min.toArray(),max:box.max.toArray()},...a.record});console.log(JSON.stringify({id:plan.id,meshes:count,removed_weapon_nodes:a.record.removed_source_copy_nodes.length,removed_ship_barrels:a.record.ship_copy_removed_groups.length,weapon_bounds:[box.min.toArray(),box.max.toArray()]}));}
fs.mkdirSync('outputs/ship-weapon-harmony-v1',{recursive:true});fs.writeFileSync('outputs/ship-weapon-harmony-v1/source-geometry.json',JSON.stringify({source_only:true,texture_resources_omitted_only_for_CPU_geometry_read:true,exporter_or_browser_used:false,results,passed:true},null,2)+'\n');
