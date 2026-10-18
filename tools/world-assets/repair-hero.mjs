// Repair invalid NORMAL vectors in a separate derived GLB. Positions, indices,
// UVs, textures, materials and the original model.glb remain byte-preserved.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import checks from '../qa/world-gltf.cjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=path.join(ROOT,'outputs/world-assets');
const require=createRequire(import.meta.url);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const componentBytes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const componentCounts={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const vector=(a)=>new THREE.Vector3(...a);
function validator(){
  for(const name of ['gltf-validator',path.join(ROOT,'work/vfx-validation/node_modules/gltf-validator')]){
    try{return require(name);}catch{}
  }
  throw new Error('Install the official gltf-validator locally before repairing a hero.');
}
const official=validator();
async function validate(bytes,uri){
  const result=await official.validateBytes(new Uint8Array(bytes),{uri,format:'glb',maxIssues:0,writeTimestamp:false,
    externalResourceFunction:async()=>{throw new Error('External resources are not permitted.');}});
  return {errors:result.issues.numErrors,warnings:result.issues.numWarnings,infos:result.issues.numInfos,
    hints:result.issues.numHints,truncated:result.issues.truncated,messages:result.issues.messages};
}
function offsetFor(json,accessor,i){
  const view=json.bufferViews[accessor.bufferView];
  if(!view || accessor.sparse)throw new Error('Normal repair does not support missing or sparse buffer views.');
  return (view.byteOffset||0)+(accessor.byteOffset||0)+i*(view.byteStride||componentBytes[accessor.componentType]*componentCounts[accessor.type]);
}
function vecAt(json,bin,accessor,i){
  if(accessor.type!=='VEC3'||accessor.componentType!==5126)throw new Error('Expected FLOAT VEC3 positions/normals.');
  const at=offsetFor(json,accessor,i);return new THREE.Vector3(bin.readFloatLE(at),bin.readFloatLE(at+4),bin.readFloatLE(at+8));
}
function indexAt(json,bin,accessor,i){
  if(!accessor)return i;const at=offsetFor(json,accessor,i);
  if(accessor.componentType===5125)return bin.readUInt32LE(at);
  if(accessor.componentType===5123)return bin.readUInt16LE(at);
  if(accessor.componentType===5121)return bin.readUInt8(at);
  throw new Error('Unsupported index component type.');
}
function geometricData(json,bin,primitive){
  if((primitive.mode??4)!==4)throw new Error('Normal repair only supports triangle primitives.');
  const p=json.accessors[primitive.attributes.POSITION],index=primitive.indices===undefined?null:json.accessors[primitive.indices];
  const positions=Array.from({length:p.count},(_,i)=>vecAt(json,bin,p,i));
  const bounds=new THREE.Box3().setFromPoints(positions),diagonal=bounds.getSize(new THREE.Vector3()).length();
  const tolerance=Math.max(diagonal*1e-6,1e-8),key=v=>v.toArray().map(x=>Math.round(x/tolerance)).join(',');
  const faceSums=Array.from({length:p.count},()=>new THREE.Vector3()),weldedFaceSums=new Map(),triangles=[];
  let degenerate=0;
  for(let t=0;t<(index?.count||p.count);t+=3){
    const ids=[indexAt(json,bin,index,t),indexAt(json,bin,index,t+1),indexAt(json,bin,index,t+2)];
    const [a,b,c]=ids.map(i=>positions[i]);
    if(!a||!b||!c)throw new Error('Triangle references a missing vertex.');
    const face=b.clone().sub(a).cross(c.clone().sub(a));
    if(face.lengthSq()<diagonal**4*1e-20){degenerate++;continue;}
    triangles.push({ids,face,center:a.clone().add(b).add(c).multiplyScalar(1/3)});
    for(const id of ids){faceSums[id].add(face);const at=key(positions[id]);if(!weldedFaceSums.has(at))weldedFaceSums.set(at,new THREE.Vector3());weldedFaceSums.get(at).add(face);}
  }
  return {p,index,positions,bounds,diagonal,tolerance,key,faceSums,weldedFaceSums,triangles,degenerate};
}
function topology(json,bin){
  const primitives=[];
  for(let mi=0;mi<(json.meshes||[]).length;mi++)for(let pi=0;pi<json.meshes[mi].primitives.length;pi++){
    const primitive=json.meshes[mi].primitives[pi],data=geometricData(json,bin,primitive),welded=new Map(),vertices=[],edges=new Map();
    const weldedId=i=>{const key=data.key(data.positions[i]);if(!welded.has(key)){welded.set(key,vertices.length);vertices.push(data.positions[i]);}return welded.get(key);};
    for(const triangle of data.triangles){const ids=triangle.ids.map(weldedId);if(new Set(ids).size<3)continue;for(let i=0;i<3;i++){const a=ids[i],b=ids[(i+1)%3],key=a<b?a+','+b:b+','+a;const entry=edges.get(key)||{a,b,count:0};entry.count++;edges.set(key,entry);}}
    const boundary=[...edges.values()].filter(edge=>edge.count===1),nonmanifold=[...edges.values()].filter(edge=>edge.count>2);
    const yThreshold=data.bounds.min.y+(data.bounds.max.y-data.bounds.min.y)*.58;
    const roofEdges=boundary.filter(edge=>vertices[edge.a].y>=yThreshold && vertices[edge.b].y>=yThreshold);
    const adjacent=new Map();boundary.forEach((edge,i)=>{for(const id of [edge.a,edge.b]){if(!adjacent.has(id))adjacent.set(id,[]);adjacent.get(id).push(i);}});
    const seen=new Set(),components=[];
    for(let i=0;i<boundary.length;i++){
      if(seen.has(i))continue;const stack=[i],edgeIds=[],nodeIds=new Set();
      while(stack.length){const e=stack.pop();if(seen.has(e))continue;seen.add(e);edgeIds.push(e);for(const id of [boundary[e].a,boundary[e].b]){nodeIds.add(id);for(const next of adjacent.get(id)||[])if(!seen.has(next))stack.push(next);}}
      const box=new THREE.Box3().setFromPoints([...nodeIds].map(id=>vertices[id]));
      components.push({edges:edgeIds.length,vertices:nodeIds.size,closed_loop:[...nodeIds].every(id=>adjacent.get(id).length===2),
        bounds:{min:box.min.toArray(),max:box.max.toArray()},center:box.getCenter(new THREE.Vector3()).toArray(),
        high_region_edges:edgeIds.filter(id=>vertices[boundary[id].a].y>=yThreshold&&vertices[boundary[id].b].y>=yThreshold).length});
    }
    primitives.push({mesh:mi,primitive:pi,space:'Mesh local coordinates',weld_tolerance:data.tolerance,
      vertex_count:data.positions.length,welded_vertex_count:vertices.length,triangle_count:data.triangles.length,
      degenerate_triangles:data.degenerate,boundary_edges:boundary.length,nonmanifold_edges:nonmanifold.length,
      high_region_y_threshold:yThreshold,high_region_boundary_edges:roofEdges.length,
      boundary_components:components.sort((a,b)=>b.edges-a.edges),
      high_region_boundary_samples:roofEdges.slice(0,30).map(edge=>({a:vertices[edge.a].toArray(),b:vertices[edge.b].toArray()}))});
  }
  return {method:'Position-welded edge incidence; geometric diagnostic, not a watertightness guarantee.',
    primitives,totals:{boundary_edges:primitives.reduce((s,p)=>s+p.boundary_edges,0),
      high_region_boundary_edges:primitives.reduce((s,p)=>s+p.high_region_boundary_edges,0),
      nonmanifold_edges:primitives.reduce((s,p)=>s+p.nonmanifold_edges,0),degenerate_triangles:primitives.reduce((s,p)=>s+p.degenerate_triangles,0)}};
}

export function repairedHeroCopy(sourceBytes){
  const {json,bin:source}=checks.parseGLB(sourceBytes),bin=Buffer.from(source),normalChanges=[],seen=new Set(),allowedChanges=new Set();
  const originalJSON=structuredClone(json);
  for(let mi=0;mi<(json.meshes||[]).length;mi++)for(let pi=0;pi<json.meshes[mi].primitives.length;pi++){
    const primitive=json.meshes[mi].primitives[pi];if(primitive.attributes.NORMAL===undefined)continue;
    const ai=primitive.attributes.NORMAL,normal=json.accessors[ai];
    if(seen.has(ai))continue;seen.add(ai);
    if(normal.componentType!==5126||normal.type!=='VEC3'||normal.sparse)throw new Error('Expected nonsparse FLOAT VEC3 NORMAL accessor.');
    const data=geometricData(json,bin,primitive),validNormals=new Map();
    for(let i=0;i<normal.count;i++){
      const n=vecAt(json,source,normal,i);if(n.toArray().every(Number.isFinite)&&n.lengthSq()>1e-12){const key=data.key(data.positions[i]);if(!validNormals.has(key))validNormals.set(key,new THREE.Vector3());validNormals.get(key).add(n.clone().normalize());}
    }
    for(let i=0;i<normal.count;i++){
      const original=vecAt(json,source,normal,i),length=original.length();
      if(Number.isFinite(length)&&length>1e-6&&Math.abs(length-1)<=1e-4)continue;
      let n,method,nearby;
      if(Number.isFinite(length)&&length>1e-6){n=original.clone().normalize();method='Normalize existing nonzero normal; direction preserved';}
      else if(data.faceSums[i].lengthSq()>1e-18){n=data.faceSums[i].clone().normalize();method='Area-weighted adjacent nondegenerate triangle normal';}
      else if((data.weldedFaceSums.get(data.key(data.positions[i]))?.lengthSq()||0)>1e-18){n=data.weldedFaceSums.get(data.key(data.positions[i])).clone().normalize();method='Area-weighted adjacent triangle normal at a position-welded UV seam';}
      else if((validNormals.get(data.key(data.positions[i]))?.lengthSq()||0)>1e-18){n=validNormals.get(data.key(data.positions[i])).clone().normalize();method='Existing valid normal at the same welded position';}
      else{
        let best=Infinity,index=-1;
        for(let j=0;j<normal.count;j++){
          const candidate=vecAt(json,source,normal,j);if(!candidate.toArray().every(Number.isFinite)||candidate.lengthSq()<1e-12)continue;
          const distance=data.positions[i].distanceToSquared(data.positions[j]);if(distance<best){best=distance;index=j;n=candidate.normalize();}
        }
        if(index<0)throw new Error('No reliable local normal candidate exists; refusing an arbitrary up-vector repair.');
        method='Nearest existing valid vertex normal for an isolated degenerate vertex';nearby={source_vertex:index,distance:Math.sqrt(best)};
      }
      const start=offsetFor(json,normal,i);
      for(let c=0;c<3;c++){bin.writeFloatLE(n.toArray()[c],start+c*4);for(let b=0;b<4;b++)allowedChanges.add(start+c*4+b);}
      normalChanges.push({mesh:mi,primitive:pi,accessor:ai,vertex:i,original:original.toArray(),replacement:n.toArray(),method,
        zero_or_nonfinite:!Number.isFinite(length)||length<=1e-6,...(nearby?{nearest_candidate:nearby}:{})});
    }
    if(normal.min||normal.max){
      const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<normal.count;i++){const values=vecAt(json,bin,normal,i).toArray();for(let c=0;c<3;c++){min[c]=Math.min(min[c],values[c]);max[c]=Math.max(max[c],values[c]);}}
      if(normal.min)normal.min=min;if(normal.max)normal.max=max;
    }
  }
  let modifiedBytes=0;
  for(let i=0;i<bin.length;i++)if(bin[i]!==source[i]){if(!allowedChanges.has(i))throw new Error('Repair unexpectedly changed a non-NORMAL binary byte.');modifiedBytes++;}
  // All semantic JSON fields are identical except normal-accessor extrema.
  const restore=structuredClone(json);
  for(const ai of seen){if(originalJSON.accessors[ai].min)restore.accessors[ai].min=originalJSON.accessors[ai].min;if(originalJSON.accessors[ai].max)restore.accessors[ai].max=originalJSON.accessors[ai].max;}
  if(JSON.stringify(restore)!==JSON.stringify(originalJSON))throw new Error('Unexpected semantic GLB metadata change.');
  const bytes=normalChanges.length?checks.makeGLB(json,bin):Buffer.from(sourceBytes);
  return {bytes,normalChanges,modifiedBytes,topology:topology(originalJSON,source),materialDiagnostic:{
    materials:(json.materials||[]).map((m,i)=>({material:i,doubleSided:m.doubleSided===true,alphaMode:m.alphaMode||'OPAQUE',
      baseColorTexture:m.pbrMetallicRoughness?.baseColorTexture?.index??null,baseColorFactor:m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1]})),
    embeddedImageTypes:(json.images||[]).map(image=>image.mimeType||null),
    conclusion:'Double-sided opaque materials cannot create missing surfaces through back-face culling or alpha cutout. Dark opaque texture painting and actual geometric openings require separate visual diagnosis.'}};
}

export async function repairHero(id){
  if(!/^[a-z0-9-]+$/.test(id))throw new Error('Expected a known hero id.');
  const folder=path.join(OUT,'hero',id),sourceFile=path.join(folder,'model.glb'),destFile=path.join(folder,'model-repaired.glb'),logFile=path.join(folder,'repair-log.json');
  const sourceBytes=fs.readFileSync(sourceFile),sourceSHA=hash(sourceBytes),before=await validate(sourceBytes,`hero/${id}/model.glb`);
  const unsupported=before.messages.filter(message=>message.severity===0&&message.code!=='ACCESSOR_VECTOR3_NON_UNIT');
  if(unsupported.length)throw new Error(`${id}: unrelated validator errors must be reviewed before normal repair: ${[...new Set(unsupported.map(m=>m.code))].join(', ')}`);
  const repaired=repairedHeroCopy(sourceBytes),after=await validate(repaired.bytes,`hero/${id}/model-repaired.glb`);
  if(after.errors || after.truncated)throw new Error(`${id}: derived GLB did not pass official validation.`);
  const sourceStats=checks.inspectGLB(sourceBytes),derivedStats=checks.inspectGLB(repaired.bytes);
  for(const key of ['triangles','mesh_count','material_count','texture_count','animation_count'])if(sourceStats[key]!==derivedStats[key])throw new Error(`${id}: repair changed ${key}.`);
  if(fs.existsSync(destFile)&&hash(fs.readFileSync(destFile))!==hash(repaired.bytes)){
    const old=fs.existsSync(logFile)?JSON.parse(fs.readFileSync(logFile,'utf8')):null;
    if(old?.original_source?.sha256!==sourceSHA||old?.tool!=='tools/world-assets/repair-hero.mjs')throw new Error('Refusing to overwrite an unrelated repaired model.');
  }
  fs.writeFileSync(destFile,repaired.bytes);
  if(hash(fs.readFileSync(sourceFile))!==sourceSHA)throw new Error('Original hero source changed during repair.');
  const methods=repaired.normalChanges.reduce((out,item)=>{out[item.method]=(out[item.method]||0)+1;return out;},{});
  const log={game_title:'Cloudstitch',id,tool:'tools/world-assets/repair-hero.mjs',validator_version:official.version(),
    original_source:{model:`hero/${id}/model.glb`,sha256:sourceSHA,bytes:sourceBytes.length},
    repaired_source:{model:`hero/${id}/model-repaired.glb`,sha256:hash(repaired.bytes),bytes:repaired.bytes.length},
    original_source_preserved:true,changes:{normal_vectors_repaired:repaired.normalChanges.length,
      zero_normal_vectors:repaired.normalChanges.filter(item=>item.zero_or_nonfinite).length,
      non_unit_normal_vectors:repaired.normalChanges.filter(item=>!item.zero_or_nonfinite).length,
      methods,modified_binary_bytes:repaired.modifiedBytes,positions_indices_uvs_textures_materials_unchanged:true},
    normal_changes:repaired.normalChanges,before,after,topology:repaired.topology,material_diagnostic:repaired.materialDiagnostic,
    geometry_before:sourceStats,geometry_after:derivedStats,
    limits:['Normal-only derived copy; no roof hole filling, remeshing, UV changes, texture edits, topology cleanup, or new geometry.',
      'Degenerate vertex fallback is logged per vertex and does not establish hidden-surface quality.',
      'Position-welded boundary diagnostics cannot prove watertightness or assign semantic roof parts.',
      'Engine collisions, LODs, socket pivots, interiors, navigation, and performance remain unimplemented.']};
  fs.writeFileSync(logFile,JSON.stringify(log,null,2)+'\n');
  console.log(JSON.stringify({id,repairedNormals:repaired.normalChanges.length,methods,beforeErrors:before.errors,afterErrors:after.errors,
    highRegionBoundaryEdges:log.topology.totals.high_region_boundary_edges,originalSHA:sourceSHA,repairedSHA:log.repaired_source.sha256}));
  return log;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const ids=process.argv.slice(2).filter(id=>id!=='--all-available');
  const chosen=ids.length?ids:fs.readdirSync(path.join(OUT,'hero'),{withFileTypes:true}).filter(entry=>entry.isDirectory()&&fs.existsSync(path.join(OUT,'hero',entry.name,'model.glb'))).map(entry=>entry.name);
  for(const id of chosen)await repairHero(id);
}
