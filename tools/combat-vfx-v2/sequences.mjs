// VFX v2 weapon choreography studies. Original weapons and v1 GLBs are read only.
// Bundle this entry point with esbuild, then run the bundle from the repo root.
// Standard glTF TRS is embedded; extras.runtime_fade is a separate viewer recipe.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { makeKit, THREE } from '../combat-vfx/core.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT,'outputs/combat-vfx-v2');
const read = file => JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(ROOT,file).split(path.sep).join('/');
const vec = values => new THREE.Vector3(...values);
const write = (file,value) => fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
globalThis.FileReader ??= class { readAsArrayBuffer(blob){ blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();}).catch(error=>this.onerror?.(error)); } };
globalThis.ProgressEvent ??= class { constructor(type,data={}){this.type=type;Object.assign(this,data);} };

const PLANS = [
  ['01-machine-gun','기관총 공격','machine-gun-muzzle','machine-gun-projectile','machine-gun-hit',2,[[0,.2],[.12,.85],[.84,1.8]]],
  ['02-deck-cannon','함포 공격','cannon-muzzle','cannon-projectile','cannon-hit',2.8,[[0,.55],[.3,1.25],[1.24,2.7]]],
  ['03-mortar','박격포 공격','mortar-launch','mortar-projectile','mortar-hit',3.5,[[0,.55],[.3,1.75],[1.74,3.4]]],
  ['04-harpoon','작살 견인','harpoon-launch','harpoon-projectile','harpoon-hit',2.8,[[0,.4],[.2,1.3],[1.29,2.7]]],
  ['05-chain-shot','사슬탄 공격','chain-shot-launch','chain-shot-projectile','chain-shot-hit',2.8,[[0,.4],[.2,1.25],[1.24,2.7]]],
  ['06-flamethrower','화염 분사','flamethrower-ignite','flamethrower-stream','flamethrower-hit',3,[[0,.4],[.15,2.6],[.5,2.9]]],
];

function parse(bytes) {
  if(bytes.length<20 || bytes.readUInt32LE(0)!==0x46546c67 || bytes.readUInt32LE(4)!==2 || bytes.readUInt32LE(8)!==bytes.length) throw new Error('Expected complete binary glTF 2.0.');
  let cursor=12,json,bin;
  while(cursor<bytes.length){
    if(cursor+8>bytes.length) throw new Error('Incomplete GLB chunk header.');
    const length=bytes.readUInt32LE(cursor),type=bytes.readUInt32LE(cursor+4);cursor+=8;
    if(cursor+length>bytes.length) throw new Error('Incomplete GLB chunk.');
    if(type===0x4e4f534a) json=JSON.parse(bytes.subarray(cursor,cursor+length).toString('utf8'));
    if(type===0x004e4942) bin=bytes.subarray(cursor,cursor+length);
    cursor+=length;
  }
  if(!json || !bin) throw new Error('GLB must embed JSON and BIN.');
  if([...(json.buffers||[]),...(json.images||[])].some(resource=>resource.uri)) throw new Error('Source must embed buffers and textures as GLB buffer views.');
  return {json,bin};
}
function packageGLB(jsonData,sourceBin){
  const bin=Buffer.concat([sourceBin,Buffer.alloc((4-sourceBin.length%4)%4)]);
  jsonData.buffers=[{byteLength:sourceBin.length}];
  const raw=Buffer.from(JSON.stringify(jsonData)),json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]);
  const h=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
  h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+bin.length,8);
  jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([h,jh,json,bh,bin]);
}
const WIDTH = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
const COMPONENT_BYTES = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
function accessorOffset(json,accessor,index){
  const view=json.bufferViews[accessor.bufferView];
  return (view.byteOffset||0)+(accessor.byteOffset||0)+index*(view.byteStride||WIDTH[accessor.type]*COMPONENT_BYTES[accessor.componentType]);
}
function animationTimes(json,bin,index){
  const accessor=json.accessors[index];
  if(accessor.type!=='SCALAR'||accessor.componentType!==5126||accessor.sparse) throw new Error('Expected nonsparse float animation times.');
  return Array.from({length:accessor.count},(_,i)=>bin.readFloatLE(accessorOffset(json,accessor,i)));
}
function repairedWeaponCopy(bytes){
  const {json,bin:source}=parse(bytes),bin=Buffer.from(source);let repaired=0;
  const position=(accessor,index)=>{const offset=accessorOffset(json,accessor,index);return vec([bin.readFloatLE(offset),bin.readFloatLE(offset+4),bin.readFloatLE(offset+8)]);};
  for(const mesh of json.meshes||[]) for(const primitive of mesh.primitives||[]){
    if(primitive.attributes.NORMAL===undefined) continue;
    const normal=json.accessors[primitive.attributes.NORMAL],pos=json.accessors[primitive.attributes.POSITION];
    if(normal.componentType!==5126||pos.componentType!==5126) throw new Error('Normal repair expects float geometry.');
    const index=primitive.indices!==undefined?json.accessors[primitive.indices]:null;
    const vertex=i=>{if(!index)return i;const offset=accessorOffset(json,index,i);return index.componentType===5125?bin.readUInt32LE(offset):index.componentType===5123?bin.readUInt16LE(offset):bin.readUInt8(offset);};
    for(let i=0;i<normal.count;i++){
      const offset=accessorOffset(json,normal,i),n=vec([bin.readFloatLE(offset),bin.readFloatLE(offset+4),bin.readFloatLE(offset+8)]);
      if(n.lengthSq()>1e-12)continue;
      const sum=new THREE.Vector3();
      for(let t=0;t<(index?.count||pos.count);t+=3){const ids=[vertex(t),vertex(t+1),vertex(t+2)];if(!ids.includes(i))continue;const a=position(pos,ids[0]),b=position(pos,ids[1]),c=position(pos,ids[2]);sum.add(b.sub(a).cross(c.sub(a)));}
      if(sum.lengthSq()<1e-12)sum.set(0,1,0);sum.normalize();
      bin.writeFloatLE(sum.x,offset);bin.writeFloatLE(sum.y,offset+4);bin.writeFloatLE(sum.z,offset+8);repaired++;
    }
  }
  return {bytes:packageGLB(json,bin),repaired};
}
function geometryOnly(bytes){
  const {json,bin}=parse(bytes);delete json.images;delete json.textures;delete json.samplers;
  json.extensionsUsed=['KHR_materials_unlit'];delete json.extensionsRequired;
  json.materials=[{extensions:{KHR_materials_unlit:{}}}];
  for(const mesh of json.meshes||[])for(const primitive of mesh.primitives||[])primitive.material=0;
  const result=packageGLB(json,bin);return result.buffer.slice(result.byteOffset,result.byteOffset+result.length);
}
async function approximateMuzzle(bytes,mortar=false){
  const gltf=await new GLTFLoader().parseAsync(geometryOnly(bytes),'');gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),points=[];
  gltf.scene.traverse(node=>{if(!node.isMesh)return;const position=node.geometry.attributes.position;for(let i=0;i<position.count;i++){const v=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(node.matrixWorld);if(mortar?v.y>bounds.max.y-size.y*.035:v.x<bounds.min.x+size.x*.025)points.push(v);}});
  if(!points.length)throw new Error('Cannot estimate muzzle from source geometry.');
  const tip=points.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).multiplyScalar(1/points.length);
  return {center,size,tip};
}
function makeComposer(name,duration){
  const json={asset:{version:'2.0',generator:'Cloudstitch VFX v2 sequence composer'},scene:0,scenes:[{nodes:[]}],buffers:[{byteLength:0}],bufferViews:[],accessors:[],materials:[],meshes:[],nodes:[],textures:[],images:[],samplers:[],animations:[{name,channels:[],samplers:[]}],extras:{visual_prototype:true,runtime_fade_is_not_gltf_material_animation:true,axes:'+Y up; +Z shot direction; impact normal +Y before placement'}};
  const chunks=[],used=new Set(['KHR_materials_unlit']),required=new Set();let length=0,fadeRecipes=0;
  function append(data){const offset=length,pad=(4-data.length%4)%4;chunks.push(data);length+=data.length;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}return offset;}
  function floatAccessor(values,type='SCALAR'){
    if(!WIDTH[type]||values.length%WIDTH[type]||values.some(value=>!Number.isFinite(value)))throw new Error('Invalid float accessor.');
    const data=Buffer.alloc(values.length*4);values.forEach((value,index)=>data.writeFloatLE(value,index*4));
    const byteOffset=append(data),view=json.bufferViews.push({buffer:0,byteOffset,byteLength:data.length})-1;
    return json.accessors.push({bufferView:view,componentType:5126,count:values.length/WIDTH[type],type,...(type==='SCALAR'?{min:[Math.min(...values)],max:[Math.max(...values)]}:{})})-1;
  }
  function addChannel(node,pathName,times,values,type){const sampler=json.animations[0].samplers.push({input:floatAccessor(times),output:floatAccessor(values,type),interpolation:'LINEAR'})-1;json.animations[0].channels.push({sampler,target:{node,path:pathName}});}
  function reindexMaterialTextures(object,offset){
    if(!object||typeof object!=='object')return;
    for(const [key,value] of Object.entries(object)){if(/Texture$/.test(key)&&value?.index!==undefined)value.index+=offset;else if(value&&typeof value==='object')reindexMaterialTextures(value,offset);}
  }
  function add(bytes,transform={},timing=null,unlit=false){
    const {json:source,bin}=parse(bytes);if(source.skins?.length)throw new Error('Skinned component is not supported.');
    if((source.extensionsRequired||[]).some(value=>/draco|meshopt/i.test(value)))throw new Error('Compressed source geometry needs decoding before composition.');
    const offsets={view:json.bufferViews.length,accessor:json.accessors.length,material:json.materials.length,mesh:json.meshes.length,node:json.nodes.length,texture:json.textures.length,image:json.images.length,sampler:json.samplers.length};
    const base=append(bin),retime=value=>timing.start+value/timing.sourceDuration*(timing.end-timing.start);
    for(const view of source.bufferViews||[])json.bufferViews.push({...view,buffer:0,byteOffset:(view.byteOffset||0)+base});
    for(const accessor of source.accessors||[]){const clone=structuredClone(accessor);if(clone.bufferView!==undefined)clone.bufferView+=offsets.view;if(clone.sparse){clone.sparse.indices.bufferView+=offsets.view;clone.sparse.values.bufferView+=offsets.view;}json.accessors.push(clone);}
    for(const material of source.materials||[]){const clone=structuredClone(material);reindexMaterialTextures(clone,offsets.texture);if(unlit){clone.extensions={...clone.extensions,KHR_materials_unlit:{}};clone.pbrMetallicRoughness={...clone.pbrMetallicRoughness,metallicFactor:0,roughnessFactor:1};}json.materials.push(clone);}
    for(const mesh of source.meshes||[]){const clone=structuredClone(mesh);for(const primitive of clone.primitives){for(const key of Object.keys(primitive.attributes))primitive.attributes[key]+=offsets.accessor;if(primitive.indices!==undefined)primitive.indices+=offsets.accessor;if(primitive.material!==undefined)primitive.material+=offsets.material;for(const target of primitive.targets||[])for(const key of Object.keys(target))target[key]+=offsets.accessor;}json.meshes.push(clone);}
    for(const node of source.nodes||[]){
      const clone=structuredClone(node);if(clone.mesh!==undefined)clone.mesh+=offsets.mesh;if(clone.children)clone.children=clone.children.map(index=>index+offsets.node);
      if(timing&&clone.extras?.runtime_fade){
        const fade=clone.extras.runtime_fade;
        for(const key of ['start','peak','end'])if(Number.isFinite(Number(fade[key])))fade[key]=retime(Number(fade[key]));
        // The harpoon head and tether remain visible after arrival. Their source
        // TRS must also keep its final visible pose rather than shrink to zero.
        if(timing.holdEnd!==undefined&&Number.isFinite(Number(fade.end)))fade.end=Math.max(fade.end,timing.holdEnd);
        fade.time_domain='sequence_seconds';fadeRecipes++;
      }
      json.nodes.push(clone);
    }
    for(const image of source.images||[])json.images.push({...image,...(image.bufferView!==undefined?{bufferView:image.bufferView+offsets.view}:{})});
    for(const texture of source.textures||[]){const clone=structuredClone(texture);if(clone.source!==undefined)clone.source+=offsets.image;if(clone.sampler!==undefined)clone.sampler+=offsets.sampler;for(const extension of Object.values(clone.extensions||{}))if(extension.source!==undefined)extension.source+=offsets.image;json.textures.push(clone);}
    json.samplers.push(...(source.samplers||[]));for(const extension of source.extensionsUsed||[])used.add(extension);for(const extension of source.extensionsRequired||[])required.add(extension);
    const parent=json.nodes.push({name:name+'_part_'+json.nodes.length,children:source.scenes[source.scene??0].nodes.map(index=>index+offsets.node),...transform,extras:{visual_component:true,...(timing?{timing:{...timing},fade_time_mapping:'start + sourceSeconds / sourceDuration * (end - start)'}:{})}})-1;
    json.scenes[0].nodes.push(parent);
    if(timing){
      if(!(timing.sourceDuration>0)||!(timing.end>timing.start))throw new Error('Invalid component timing.');
      for(const animation of source.animations||[])for(const channel of animation.channels||[]){
        if(!['translation','rotation','scale'].includes(channel.target.path))throw new Error('Only portable TRS component animations are supported.');
        const sampler=animation.samplers[channel.sampler],times=animationTimes(source,bin,sampler.input).map(retime);
        const mappedSampler=json.animations[0].samplers.push({...sampler,input:floatAccessor(times),output:sampler.output+offsets.accessor})-1;
        json.animations[0].channels.push({sampler:mappedSampler,target:{...channel.target,node:channel.target.node+offsets.node}});
      }
      const visibleEnd=timing.holdEnd??timing.end,scale=transform.scale||[1,1,1],epsilon=.002;
      const times=[...new Set([0,...(timing.start>0?[timing.start,timing.start+epsilon]:[]),visibleEnd,...(visibleEnd<duration?[Math.min(duration,visibleEnd+epsilon),duration]:[])])].sort((a,b)=>a-b);
      const scales=times.flatMap(time=>scale.map(value=>value*((timing.start>0&&time<=timing.start)||(visibleEnd<duration&&time>visibleEnd)?.001:1)));
      addChannel(parent,'scale',times,scales,'VEC3');
    }
    return parent;
  }
  function finish(){json.buffers[0].byteLength=length;json.extensionsUsed=[...used];if(required.size)json.extensionsRequired=[...required];return {bytes:packageGLB(json,Buffer.concat(chunks)),runtime_fade_recipes:fadeRecipes};}
  return {add,finish};
}
function metadata(bytes){
  const {json,bin}=parse(bytes);let triangles=0;
  for(const mesh of json.meshes||[])for(const primitive of mesh.primitives||[])triangles+=json.accessors[primitive.indices??primitive.attributes.POSITION].count/3;
  const paths=(json.animations||[]).flatMap(animation=>animation.channels.map(channel=>channel.target.path));
  const times=(json.animations||[]).flatMap(animation=>animation.samplers.flatMap(sampler=>animationTimes(json,bin,sampler.input)));
  return {triangles,mesh_count:(json.meshes||[]).length,node_count:(json.nodes||[]).length,material_count:(json.materials||[]).length,texture_count:(json.textures||[]).length,animation_count:(json.animations||[]).length,animation_channels:paths.length,channel_paths:[...new Set(paths)],actual_clip_duration:Math.max(...times)};
}
async function main(){
  if(!fs.existsSync(path.join(ROOT,'AGENTS.md'))||!fs.existsSync(path.join(ROOT,'outputs/combat-vfx/catalog.json')))throw new Error('Run this script or its bundle from the Cloudstitch repository root.');
  const catalog=read(path.join(OUT,'catalog.json')),weapons=read(path.join(ROOT,'outputs/weapon-modules/catalog.json')),entries=[];
  fs.mkdirSync(path.join(OUT,'sequences'),{recursive:true});fs.mkdirSync(path.join(OUT,'manifests'),{recursive:true});
  for(const [weaponId,nameKo,a,b,c,duration,times] of PLANS){
    const components=[a,b,c].map(id=>catalog.items.find(item=>item.id===id));
    const missing=[a,b,c].filter((id,index)=>!components[index]?.model||['pending','failed','generating','planned'].includes(components[index]?.status)||!fs.existsSync(path.join(OUT,components[index].model)));
    if(missing.length){entries.push({id:weaponId,order:entries.length+1,name_ko:nameKo,category:'weapon-sequence',weapon_id:weaponId,duration,loop:true,status:'pending',missing_v2_effects:missing});console.log(JSON.stringify({sequence:weaponId,status:'pending',missing}));continue;}
    const weapon=weapons.items.find(item=>item.id===weaponId);if(!weapon)throw new Error('Missing weapon source: '+weaponId);
    const weaponPath=path.join(ROOT,'outputs/weapon-modules',weapon.model),original=fs.readFileSync(weaponPath),sourceHash=hash(original),repaired=repairedWeaponCopy(original);
    const info=await approximateMuzzle(repaired.bytes,weaponId==='03-mortar'),scale=1.8/Math.max(info.size.x,info.size.y,info.size.z),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI/2,0)),position=vec([0,info.size.y*scale/2,-.9]);
    const spawn=info.tip.clone().sub(info.center).multiplyScalar(scale).applyQuaternion(rotation).add(position),translation=info.center.clone().multiplyScalar(-scale).applyQuaternion(rotation).add(position);
    const composer=makeComposer(weaponId+'_attack_sequence_v2',duration),distance=weaponId==='06-flamethrower'?1.85:4,componentRecords=[];
    composer.add(repaired.bytes,{translation:translation.toArray(),rotation:rotation.toArray(),scale:[scale,scale,scale]},null,true);
    for(let i=0;i<components.length;i++){
      const item=components[i],bytes=fs.readFileSync(path.join(OUT,item.model)),actual=metadata(bytes),sourceDuration=actual.actual_clip_duration;
      if(!actual.animation_count||!(sourceDuration>0))throw new Error('Component has no actual animation: '+item.id);
      const timing={start:times[i][0],end:times[i][1],sourceDuration,...(weaponId==='04-harpoon'&&i===1?{holdEnd:times[2][1]}:{})};
      // The mortar mouth points upward. Rotate its launch only: the projectile
      // already authors a local +Y arc that arrives at local Z4 and must stay so.
      const orientation=i===2||weaponId==='03-mortar'&&i===0
        ? new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0)).toArray()
        : [0,0,0,1];
      const placement={name:item.id+'_sequence_wrapper',translation:spawn.clone().add(vec([0,0,i===2?distance:0])).toArray(),rotation:orientation};
      composer.add(bytes,placement,timing);
      const componentJson=parse(bytes).json;
      componentRecords.push({id:item.id,original_id:item.original_id??item.id,model:relative(path.join(OUT,item.model)),bytes:bytes.length,sha256:hash(bytes),source_duration:sourceDuration,start:timing.start,end:timing.end,visible_until:timing.holdEnd??timing.end,wrapper:placement,source_root_nodes:componentJson.scenes[componentJson.scene??0].nodes.map(index=>({name:componentJson.nodes[index].name,scale:componentJson.nodes[index].scale??[1,1,1]})),projectile_geometry_subtree:componentJson.nodes.find(node=>node.name?.includes('_moving_payload_'))?.name??null,motion_owner:'choreography_clip_preview_only',source_type:item.source_type??item.provenance??'See effect manifest; generated v2 asset'});
    }
    const target=makeKit({id:weaponId+'_target_v2',duration_seconds:duration,purpose:'Abstract material target for choreography preview'});
    for(let i=0;i<4;i++){const plank=target.box(.3,1.05,.07,target.P.woodLight);plank.position.set((i-1.5)*.31,0,0);}const edge=target.box(1.32,.08,.11,target.P.teal);edge.position.y=-.52;
    const targetBytes=Buffer.from(await new GLTFExporter().parseAsync(target.root,{binary:true}));composer.add(targetBytes,{translation:spawn.clone().add(vec([0,0,distance+.04])).toArray()});
    const {bytes,runtime_fade_recipes}=composer.finish(),stats=metadata(bytes);
    if(Math.abs(stats.actual_clip_duration-duration)>1e-5||stats.animation_count!==1||!stats.animation_channels)throw new Error('Composed clip contract failed: '+weaponId);
    // No image decoding is needed for a portable structure/transform roundtrip.
    const parsed=await new GLTFLoader().parseAsync(geometryOnly(bytes),'');
    const mixer=new THREE.AnimationMixer(parsed.scene),action=mixer.clipAction(parsed.animations[0]);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
    const samples=[];for(const fraction of [0,.15,.35,.65,.9,1]){mixer.setTime(duration*fraction);parsed.scene.updateMatrixWorld(true);const values=[];parsed.scene.traverse(node=>{if(node.isMesh)values.push(...node.matrixWorld.elements.map(value=>Math.round(value*1e6)/1e6));});if(values.some(value=>!Number.isFinite(value)))throw new Error('Nonfinite transform in composed clip.');samples.push(hash(Buffer.from(JSON.stringify(values))));}
    if(new Set(samples).size<2)throw new Error('Composed clip does not change mesh transforms.');
    mixer.stopAllAction();if(hash(fs.readFileSync(weaponPath))!==sourceHash)throw new Error('Weapon source changed during composition.');
    const model='sequences/'+weaponId+'.glb',entry={id:weaponId,order:entries.length+1,name_ko:nameKo,name_en:weapon.name_en+' Attack Sequence v2',category:'weapon-sequence',weapon_id:weaponId,model,preview:'sequence-previews/'+weaponId+'.png',duration,loop:true,purpose:'원본 무기와 v2 효과를 연결한 연출 시제품. 실제 전투 판정은 별도 구현.',status:'file_animation_verified',...stats,bytes:bytes.length,sha256:hash(bytes),component_effects:componentRecords,approximate_muzzle:spawn.toArray(),source_weapon_model:relative(weaponPath),source_weapon_sha256:sourceHash,copied_weapon_zero_normals_repaired:repaired.repaired,runtime_fade_recipes};
    const manifest={...entry,source:'Existing original weapon plus generated v2 component GLBs; local binary composition and standard TRS retiming.',meshy_credits_used_by_composition:0,verification:{GLTFLoader_geometry_roundtrip:true,animation_changes_transforms:true,unique_sample_states:new Set(samples).size,sample_fractions:[0,.15,.35,.65,.9,1],original_weapon_unchanged:true,browser_render_pending:true,standard_validator_pending:true,art_review_pending:true},runtime:{opacity:'Node extras.runtime_fade is a separate browser/engine opacity recipe, not an embedded material animation.',fade_time_mapping:'start + sourceSeconds / sourceDuration * (end - start); harpoon end may extend to visible_until.',loop:'loop=true is optional comparison playback repetition only. A gameplay one-shot uses LoopOnce; state adapters stop when their real state ends.',axes:'+Y up; muzzle +Z; impact source +Y normal rotated toward -Z in this preview.',mortar_launch:'Only the mortar launch wrapper rotates X -PI/2 so source +Z points +Y. Projectile +Y arc and local Z4 arrival remain unchanged.',target_distance:distance,target_front_offset:.04,harpoon_hold:'Projectile and tether wrapper persists until 2.7 seconds; source final TRS must remain visible. Preview cable endpoints are not runtime physics.',flame_overlap:'Ignition 0–0.4s, stream 0.15–2.6s, contact 0.5–2.9s. Stream authored scale is preserved; target at Z1.85 is a visual hypothesis needing fresh render.',reset:['stop and reset action/mixer/time to zero','restore wrapper and child translation/rotation/scale','restore per-instance opacity and outline settings','clear parent/host/projectile/target/endpoint references','clear loop and preview-motion state']},limits:['Visual prototype, not a collision/damage/fuel/physics implementation.','Approximate muzzle from source geometry, not a validated engine socket or muzzleFrame authority.','Embedded projectile translation is a study; gameplay uses only the geometry subtree and owns projectile world motion. Only actual collision/contact events select impacts.','Resolve v2 by effect ID after integration checks; missing or unverified v2 uses v1 fallback. Do not use this whole sequence as a combat event source.','The target is an abstract comparison prop. Source dimensions and clip time are art hypotheses.','Original weapon texture remains embedded; four zero normals may be repaired only in a copied chain-shot weapon.']};
    fs.writeFileSync(path.join(OUT,model),bytes);write(path.join(OUT,'manifests',weaponId+'-sequence.json'),manifest);entries.push(entry);
    console.log(JSON.stringify({sequence:weaponId,status:entry.status,triangles:stats.triangles,bytes:bytes.length,runtime_fade_recipes,repaired_normals:repaired.repaired,source_weapon_unchanged:true}));
  }
  write(path.join(OUT,'sequence-catalog.json'),{game_title:'Cloudstitch',purpose:'Six v1/v2 comparable weapon choreography studies. Original source weapons preserved.',scope_count:6,complete_files:entries.filter(item=>item.model).length,items:entries});
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
