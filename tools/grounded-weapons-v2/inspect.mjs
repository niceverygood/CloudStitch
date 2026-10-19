import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { SPEC,REFERENCE,REFERENCE_SHA } from './spec.mjs';
import { buildWeapon } from './models.mjs';
export function census(root) {
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
  let triangles=0,meshes=0,vertices=0,nodes=0,finite=true;const materials=new Set(),groups=[];
  root.traverse(node=>{
    nodes++;finite&&=node.matrixWorld.elements.every(Number.isFinite);
    if(node.isGroup)groups.push(node.name);
    if(!node.isMesh)return;meshes++;
    const geo=node.geometry;vertices+=geo.attributes.position.count;triangles+=(geo.index?.count||geo.attributes.position.count)/3;
    for(const key of ['position','normal','color']){
      if(!geo.attributes[key])throw new Error('Missing '+key+' on '+node.name);
      finite&&=geo.attributes[key].array.every(Number.isFinite);
    }
    const colors=geo.attributes.color.array;
    if(!colors.every(x=>x>=0&&x<=1))throw new Error('Out of range glTF color: '+node.name);
    for(const m of Array.isArray(node.material)?node.material:[node.material])materials.add(m);
  });
  finite&&=[...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite);
  if(!finite||bounds.isEmpty()||meshes<2||triangles<100)throw new Error('Invalid geometry '+root.name);
  return {triangles:Math.round(triangles),vertices,meshes,nodes,material_count:materials.size,texture_count:0,animation_count:0,finite,
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:size.toArray()},named_groups:groups};
}
export function dispose(root){const g=new Set(),m=new Set();root.traverse(o=>{if(o.geometry)g.add(o.geometry);for(const x of(o.material?(Array.isArray(o.material)?o.material:[o.material]):[]))m.add(x);});g.forEach(x=>x.dispose());m.forEach(x=>x.dispose());}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--inspect')){
  if(sha(fs.readFileSync(REFERENCE))!==REFERENCE_SHA)throw new Error('Approved reference changed');
  const results=[];
  for(const spec of SPEC){const root=buildWeapon(spec);const result={id:spec.id,...census(root)};results.push(result);console.log(JSON.stringify({id:spec.id,triangles:result.triangles,meshes:result.meshes,bounds:result.bounds.size}));dispose(root);}
  const report={source_only:true,exporter_used:false,browser_used:false,reference:{path:REFERENCE,sha256:REFERENCE_SHA},assets:results.length,results,passed:results.length===6};
  const out=path.resolve('outputs/grounded-weapons-v2/source-geometry.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
}
