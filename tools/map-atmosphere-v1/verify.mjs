// Run once after build: node --loader ./tools/map-atmosphere-v1/deps-loader.mjs ./tools/map-atmosphere-v1/verify.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(here,'../..');
const output=path.join(project,'outputs/map-atmosphere-v1');
const catalogFile=path.join(output,'catalog.json');
const reportFile=path.join(output,'format-verification.json');
const require=createRequire(import.meta.url);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const packageVersion=(entry,name)=>{
  let dir=path.dirname(entry);
  for(let i=0;i<7;i++,dir=path.dirname(dir)){
    const f=path.join(dir,'package.json');
    if(fs.existsSync(f)){const p=JSON.parse(fs.readFileSync(f,'utf8'));if(p.name===name)return p.version;}
  }
  return 'unavailable';
};
function validatorRuntime(){
  const attempts=[];
  if(process.env.CLOUDSTITCH_NODE_MODULES)attempts.push(path.join(process.env.CLOUDSTITCH_NODE_MODULES,'gltf-validator'));
  attempts.push('gltf-validator');
  const failures=[];
  for(const candidate of attempts)try{
    const entry=require.resolve(candidate),api=require(entry);
    return {api,version:typeof api.version==='function'?api.version():packageVersion(entry,'gltf-validator'),entry};
  }catch(e){failures.push(e.message);}
  throw Error('gltf-validator could not be resolved: '+failures.join(' | '));
}
function readGlb(bytes){
  if(bytes.length<20)throw Error('GLB header is incomplete');
  if(bytes.readUInt32LE(0)!==0x46546c67)throw Error('GLB magic is invalid');
  if(bytes.readUInt32LE(4)!==2)throw Error('GLB version must be 2');
  const declared=bytes.readUInt32LE(8);
  if(declared!==bytes.length)throw Error(`Incomplete or trailing bytes: header=${declared}, actual=${bytes.length}`);
  const chunks=[];let offset=12;
  while(offset<bytes.length){
    if(offset+8>bytes.length)throw Error('Incomplete chunk header');
    const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);
    if(length%4)throw Error('Chunk length is not aligned to four bytes');
    offset+=8;if(offset+length>bytes.length)throw Error('Incomplete GLB chunk');
    chunks.push({type,length,data:bytes.subarray(offset,offset+length)});offset+=length;
  }
  if(chunks[0]?.type!==0x4e4f534a)throw Error('First GLB chunk must be JSON');
  if(chunks.filter(c=>c.type===0x4e4f534a).length!==1)throw Error('GLB must contain exactly one JSON chunk');
  const json=JSON.parse(chunks[0].data.toString('utf8').replace(/[\u0000 ]+$/,''));
  const binary=chunks.find(c=>c.type===0x004e4942);
  const uris=[];
  function scan(v,at='$'){
    if(!v||typeof v!=='object')return;
    for(const [key,value] of Object.entries(v)){
      if(key==='uri'&&typeof value==='string')uris.push({at:`${at}.${key}`,uri:value});
      else if(typeof value==='object')scan(value,`${at}.${key}`);
    }
  }
  scan(json);
  const external=uris.filter(u=>!/^data:/i.test(u.uri));
  if(external.length)throw Error('External URI found: '+external.map(u=>u.at).join(', '));
  for(const [i,b] of (json.buffers||[]).entries()){
    if(!b.uri&&i!==0)throw Error(`Buffer ${i} has no embedded binary chunk`);
    if(!b.uri&&(!binary||b.byteLength>binary.length))throw Error(`Embedded buffer ${i} is incomplete`);
  }
  for(const [i,bv] of (json.bufferViews||[]).entries()){
    const total=json.buffers?.[bv.buffer]?.byteLength;
    if(!Number.isFinite(total)||!Number.isFinite(bv.byteLength)||(bv.byteOffset||0)+bv.byteLength>total)throw Error(`BufferView ${i} exceeds its buffer`);
  }
  return {json,chunks:chunks.map(c=>({type:c.type===0x4e4f534a?'JSON':c.type===0x004e4942?'BIN':c.type,length:c.length})),uris};
}
function glbPath(a){
  let value=a.glb_path||a.glbPath||a.model_path||a.modelPath||a.glb||a.model||a.path||a.file||a.url||a.files?.glb||a.files?.model;
  if(value&&typeof value==='object')value=value.path||value.file||value.uri;
  if(!value)value=`models/${a.id}.glb`;
  if(!/\.glb$/i.test(value))throw Error('Asset model path is not GLB: '+value);
  if(/^https?:|^data:|^file:/i.test(value))throw Error('Model must be a local repository file');
  const candidates=path.isAbsolute(value)?[value]:[path.resolve(output,value),path.resolve(project,value)];
  const target=candidates.find(f=>fs.existsSync(f))||candidates[0];
  const rel=path.relative(output,target);
  if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('Model path leaves outputs/map-atmosphere-v1');
  return target;
}
function sceneStats(scene){
  let meshes=0,triangles=0,vertices=0,nodes=0;
  scene.updateMatrixWorld(true);
  scene.traverse(n=>{
    nodes++;
    if(!n.matrixWorld.elements.every(Number.isFinite)||!n.position.toArray().every(Number.isFinite)||!n.quaternion.toArray().every(Number.isFinite)||!n.scale.toArray().every(Number.isFinite))throw Error('Nonfinite node transform: '+n.name);
    if(n.isMesh){
      meshes++;const pos=n.geometry.attributes.position;
      if(!pos)throw Error('Mesh lacks positions: '+n.name);
      for(const value of pos.array)if(!Number.isFinite(value))throw Error('Nonfinite vertex: '+n.name);
      vertices+=pos.count;triangles+=(n.geometry.index?.count||pos.count)/3;
    }
  });
  const bounds=new THREE.Box3().setFromObject(scene);
  if(bounds.isEmpty()||![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite))throw Error('Scene bounds are empty or nonfinite');
  return {nodes,meshes,triangles,vertices,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new THREE.Vector3()).toArray()}};
}
function inspectAnimation(scene,clip){
  if(!Number.isFinite(clip.duration)||clip.duration<=0||!clip.tracks.length)throw Error('Empty animation clip: '+clip.name);
  for(const track of clip.tracks){
    if(![...track.times,...track.values].every(Number.isFinite))throw Error('Nonfinite animation track: '+track.name);
  }
  const mixer=new THREE.AnimationMixer(scene);mixer.stopAllAction();
  const action=mixer.clipAction(clip);action.reset();action.setLoop(THREE.LoopRepeat,Infinity);action.play();
  mixer.setTime(0);scene.updateMatrixWorld(true);
  const before=new Map();scene.traverse(n=>before.set(n.uuid,n.matrixWorld.elements.slice()));
  mixer.setTime(clip.duration*.31);scene.updateMatrixWorld(true);
  const moved=[];
  scene.traverse(n=>{
    const arr=n.matrixWorld.elements;
    if(!arr.every(Number.isFinite))throw Error('Nonfinite animated transform: '+n.name);
    if(arr.some((value,i)=>Math.abs(value-before.get(n.uuid)[i])>1e-7))moved.push(n.name||n.uuid);
  });
  action.stop();mixer.stopAllAction();mixer.setTime(0);mixer.uncacheRoot(scene);scene.updateMatrixWorld(true);
  if(!moved.length)throw Error('Animation has no moving node at duration * .31: '+clip.name);
  return {name:clip.name,duration:clip.duration,tracks:clip.tracks.length,sampled_times:[0,clip.duration*.31],moving_nodes:moved.length,moving_node_names:moved};
}

const report={schema:'cloudstitch-map-atmosphere-format-verification-v1',created_at:new Date().toISOString(),
  scope:'Actual GLB bytes, Khronos validator, GLTFLoader scene reload and clip transform samples. No gameplay or human art approval.',
  runtime:{node:process.version,three_revision:THREE.REVISION,three_version:packageVersion(fileURLToPath(import.meta.resolve('three')),'three')},
  expected_assets:24,assets:[],summary:{files:0,animated_assets:0,clips:0,bird_assets:0,animated_bird_assets:0,validator_errors:0,validator_warnings:0,validator_infos:0},failures:[]};
try {
  const validator=validatorRuntime();report.runtime.validator={name:'Khronos glTF Validator',version:validator.version};
  const catalog=JSON.parse(fs.readFileSync(catalogFile,'utf8'));
  const list=Array.isArray(catalog)?catalog:catalog.assets||catalog.items||catalog.models;
  if(!Array.isArray(list))throw Error('catalog.json must contain assets/items/models array');
  if(list.length!==24)report.failures.push(`Expected 24 catalog assets; found ${list.length}`);
  const seen=new Set();
  for(const a of list){
    const item={id:a.id,name_ko:a.name_ko,category:a.category,passed:false};report.assets.push(item);
    try {
      const target=glbPath(a);item.path=path.relative(project,target).split(path.sep).join('/');
      if(seen.has(target))throw Error('Duplicate model file in catalog');seen.add(target);
      const bytes=fs.readFileSync(target);item.bytes=bytes.length;item.sha256=sha(bytes);
      const expectedSha=a.sha256||a.glb_sha256||a.files?.glb?.sha256||a.files?.model?.sha256||a.stats?.sha256;
      if(expectedSha&&String(expectedSha).toLowerCase()!==item.sha256)throw Error('SHA256 differs from catalog');
      item.catalog_sha_match=expectedSha?true:null;
      const expectedBytes=a.bytes||a.byteLength||a.file_size||a.size_bytes||a.stats?.bytes||a.files?.glb?.bytes;
      if(typeof expectedBytes==='number'&&expectedBytes!==bytes.length)throw Error('File byte length differs from catalog');
      const parsed=readGlb(bytes);item.header={magic:'glTF',version:2,declared_length:bytes.length,complete:true,chunks:parsed.chunks};item.external_uris=[];item.embedded_data_uris=parsed.uris.length;
      const validation=await validator.api.validateBytes(new Uint8Array(bytes),{uri:path.basename(target),maxIssues:1000,externalResourceFunction:()=>Promise.reject(Error('External resource access is forbidden'))});
      const issues=validation.issues||{};
      item.validator={errors:issues.numErrors||0,warnings:issues.numWarnings||0,infos:issues.numInfos||0,hints:issues.numHints||0,truncated:!!issues.truncated,messages:issues.messages||[]};
      report.summary.validator_errors+=item.validator.errors;report.summary.validator_warnings+=item.validator.warnings;report.summary.validator_infos+=item.validator.infos;
      const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
      item.scene=sceneStats(gltf.scene);
      item.glb_mesh_definitions=parsed.json.meshes?.length||0;
      if(typeof a.mesh_count==='number'&&item.scene.meshes!==a.mesh_count)throw Error(`Mesh count differs from catalog: ${item.scene.meshes} vs ${a.mesh_count}`);
      const expectedTriangles=a.triangles||a.triangle_count||a.stats?.triangles||a.geometry?.triangles;
      if(typeof expectedTriangles==='number'&&item.scene.triangles!==expectedTriangles)throw Error(`Triangle count differs from catalog: ${item.scene.triangles} vs ${expectedTriangles}`);
      item.catalog_triangle_match=expectedTriangles?true:null;
      item.animations=[];
      for(const clip of gltf.animations)item.animations.push(inspectAnimation(gltf.scene,clip));
      if(typeof a.animation_count==='number'&&item.animations.length!==a.animation_count)throw Error(`Animation count differs from catalog: ${item.animations.length} vs ${a.animation_count}`);
      report.summary.files++;
      report.summary.clips+=item.animations.length;
      if(item.animations.length)report.summary.animated_assets++;
      if(a.category==='birds'){report.summary.bird_assets++;if(item.animations.length)report.summary.animated_bird_assets++;else throw Error('Bird asset has no actual animation clip');}
      if(item.validator.errors)throw Error('Khronos validator reported errors');
      item.passed=true;
    } catch(e){item.error=e.stack||e.message;report.failures.push(`${a.id||'unknown'}: ${e.message}`);}
  }
  if(report.summary.bird_assets!==4)report.failures.push(`Expected 4 bird assets; found ${report.summary.bird_assets}`);
  if(report.summary.animated_bird_assets!==4)report.failures.push(`Expected 4 animated bird assets; found ${report.summary.animated_bird_assets}`);
} catch(e){report.failures.push(e.stack||e.message);}
report.passed=report.failures.length===0&&report.assets.length===24&&report.assets.every(a=>a.passed);
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,summary:report.summary,failures:report.failures,report:path.relative(project,reportFile).split(path.sep).join('/')},null,2));
if(!report.passed)process.exitCode=1;
