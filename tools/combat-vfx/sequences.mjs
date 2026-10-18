// Compose existing weapon GLBs and authored VFX without editing the originals.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {makeKit,THREE} from './core.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),OUT=path.join(ROOT,'outputs/combat-vfx');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}};
globalThis.ProgressEvent??=class{constructor(type,data={}){this.type=type;Object.assign(this,data);}};
function parse(bytes){const n=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+n).toString());const start=20+n;return{json,bin:bytes.subarray(start+8,start+8+bytes.readUInt32LE(start))};}
const vec=(v)=>new THREE.Vector3(...v);
function packageGLB(jsonData,bin){const raw=Buffer.from(JSON.stringify(jsonData)),json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),h=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+bin.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,jh,json,bh,bin]);}
function repairedWeaponCopy(bytes){
 const {json,bin:source}=parse(bytes),bin=Buffer.from(source);let repaired=0;
 const offset=(a,i)=>{const v=json.bufferViews[a.bufferView];return(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type])*(a.componentType===5126||a.componentType===5125?4:2));};
 const position=(a,i)=>new THREE.Vector3(bin.readFloatLE(offset(a,i)),bin.readFloatLE(offset(a,i)+4),bin.readFloatLE(offset(a,i)+8));
 for(const mesh of json.meshes)for(const p of mesh.primitives){if(p.attributes.NORMAL===undefined)continue;const normal=json.accessors[p.attributes.NORMAL],pos=json.accessors[p.attributes.POSITION];if(normal.componentType!==5126||pos.componentType!==5126)throw new Error('Normal repair expects float geometry');const index=p.indices!==undefined?json.accessors[p.indices]:null;const vi=i=>!index?i:index.componentType===5125?bin.readUInt32LE(offset(index,i)):index.componentType===5123?bin.readUInt16LE(offset(index,i)):bin.readUInt8(offset(index,i));
  for(let i=0;i<normal.count;i++){const start=offset(normal,i);const n=new THREE.Vector3(bin.readFloatLE(start),bin.readFloatLE(start+4),bin.readFloatLE(start+8));if(n.lengthSq()>1e-12)continue;const sum=new THREE.Vector3();for(let t=0;t<(index?.count||pos.count);t+=3){const ids=[vi(t),vi(t+1),vi(t+2)];if(!ids.includes(i))continue;const a=position(pos,ids[0]),b=position(pos,ids[1]),c=position(pos,ids[2]);sum.add(b.sub(a).cross(c.sub(a)));}if(sum.lengthSq()<1e-12)sum.set(0,1,0);sum.normalize();bin.writeFloatLE(sum.x,start);bin.writeFloatLE(sum.y,start+4);bin.writeFloatLE(sum.z,start+8);repaired++;}
 }
 return{bytes:packageGLB(json,bin),repaired};
}
function geometryOnly(bytes){const {json,bin}=parse(bytes);delete json.images;delete json.textures;delete json.samplers;json.extensionsUsed=[...new Set([...(json.extensionsUsed||[]),'KHR_materials_unlit'])];json.materials=[{extensions:{KHR_materials_unlit:{}}}];for(const m of json.meshes)for(const p of m.primitives)p.material=0;const b=packageGLB(json,bin);return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);}
async function muzzle(bytes,mortar=false){const gltf=await new GLTFLoader().parseAsync(geometryOnly(bytes),'');gltf.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());const points=[];gltf.scene.traverse(n=>{if(!n.isMesh)return;const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld);if(mortar?v.y>bounds.max.y-size.y*.035:v.x<bounds.min.x+size.x*.025)points.push(v);}});const tip=points.reduce((v,p)=>v.add(p),new THREE.Vector3()).multiplyScalar(1/points.length);return{center,size,tip};}
function makeComposer(name,duration){
 const j={asset:{version:'2.0',generator:'Cloudstitch local combat sequence composer'},scene:0,scenes:[{nodes:[]}],buffers:[{byteLength:0}],bufferViews:[],accessors:[],materials:[],meshes:[],nodes:[],textures:[],images:[],samplers:[],animations:[{name,channels:[],samplers:[]}]};
 const chunks=[];let length=0;const used=new Set(['KHR_materials_unlit']);
 function append(data){const pad=(4-data.length%4)%4;const offset=length;chunks.push(data);length+=data.length;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}return offset;}
 function floatAccessor(values,type='SCALAR'){const data=Buffer.alloc(values.length*4);values.forEach((v,i)=>data.writeFloatLE(v,i*4));const byteOffset=append(data),view=j.bufferViews.push({buffer:0,byteOffset,byteLength:data.length})-1,count=type==='VEC3'?values.length/3:values.length;return j.accessors.push({bufferView:view,componentType:5126,count,type,...(type==='SCALAR'?{min:[Math.min(...values)],max:[Math.max(...values)]}:{})})-1;}
 function addChannel(node,pathName,times,values,type){const sampler=j.animations[0].samplers.push({input:floatAccessor(times),output:floatAccessor(values,type),interpolation:'LINEAR'})-1;j.animations[0].channels.push({sampler,target:{node,path:pathName}});}
 function add(bytes,transform={},timing=null,unlit=false){
  const {json:s,bin}=parse(bytes);if(s.skins?.length)throw new Error('Skinned source not supported');
  const o={view:j.bufferViews.length,accessor:j.accessors.length,material:j.materials.length,mesh:j.meshes.length,node:j.nodes.length,texture:j.textures.length,image:j.images.length,sampler:j.samplers.length};const base=append(bin);
  for(const v of s.bufferViews||[])j.bufferViews.push({...v,buffer:0,byteOffset:(v.byteOffset||0)+base});
  for(const a of s.accessors||[]){const b=structuredClone(a);if(b.bufferView!==undefined)b.bufferView+=o.view;if(b.sparse){b.sparse.indices.bufferView+=o.view;b.sparse.values.bufferView+=o.view;}j.accessors.push(b);}
  for(const m of s.materials||[]){const b=structuredClone(m);for(const owner of [b,b.pbrMetallicRoughness])if(owner)for(const key of Object.keys(owner))if(/Texture$/.test(key)&&owner[key]?.index!==undefined)owner[key].index+=o.texture;if(unlit){b.extensions={...b.extensions,KHR_materials_unlit:{}};b.pbrMetallicRoughness={...b.pbrMetallicRoughness,metallicFactor:0,roughnessFactor:1};}j.materials.push(b);}
  for(const m of s.meshes||[]){const b=structuredClone(m);for(const p of b.primitives){for(const key of Object.keys(p.attributes))p.attributes[key]+=o.accessor;if(p.indices!==undefined)p.indices+=o.accessor;if(p.material!==undefined)p.material+=o.material;for(const target of p.targets||[])for(const key of Object.keys(target))target[key]+=o.accessor;}j.meshes.push(b);}
  for(const n of s.nodes||[]){const b=structuredClone(n);if(b.mesh!==undefined)b.mesh+=o.mesh;if(b.children)b.children=b.children.map(i=>i+o.node);j.nodes.push(b);}
  for(const i of s.images||[]){const b={...i};if(b.bufferView!==undefined)b.bufferView+=o.view;if(b.uri)throw new Error('External source image');j.images.push(b);}
  for(const t of s.textures||[])j.textures.push({...t,...(t.source!==undefined?{source:t.source+o.image}:{}),...(t.sampler!==undefined?{sampler:t.sampler+o.sampler}:{})});
  j.samplers.push(...(s.samplers||[]));for(const e of s.extensionsUsed||[])used.add(e);
  const parent=j.nodes.push({name:name+'_part_'+j.nodes.length,children:s.scenes[s.scene??0].nodes.map(i=>i+o.node),...transform})-1;j.scenes[0].nodes.push(parent);
  if(timing){const {start,end}=timing,sourceDuration=timing.sourceDuration;
   for(const animation of s.animations||[])for(const ch of animation.channels){const sm=animation.samplers[ch.sampler],acc=s.accessors[sm.input],v=s.bufferViews[acc.bufferView];if(acc.componentType!==5126||acc.type!=='SCALAR')throw new Error('Unexpected animation time format');const sourceTimes=Array.from({length:acc.count},(_,i)=>bin.readFloatLE((v.byteOffset||0)+(acc.byteOffset||0)+i*4));const times=sourceTimes.map(t=>start+t/sourceDuration*(end-start));const sampler=j.animations[0].samplers.push({...sm,input:floatAccessor(times),output:sm.output+o.accessor})-1;j.animations[0].channels.push({sampler,target:{...ch.target,node:ch.target.node+o.node}});}
   const visibleEnd=timing.holdEnd??end,baseScale=transform.scale||[1,1,1],eps=.002;const gateTimes=[0,...(start>0?[start,start+eps]:[]),visibleEnd,...(visibleEnd<duration?[Math.min(duration,visibleEnd+eps),duration]:[])];const unique=[...new Set(gateTimes)];const scales=unique.flatMap(t=>baseScale.map(sv=>sv*((start>0&&t<=start)||(visibleEnd<duration&&t>visibleEnd)? .001:1)));addChannel(parent,'scale',unique,scales,'VEC3');
  }
  return parent;
 }
 function finish(){j.buffers[0].byteLength=length;j.extensionsUsed=[...used];const bin=Buffer.concat(chunks),raw=Buffer.from(JSON.stringify(j)),json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]);const total=12+8+json.length+8+bin.length,h=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(total,8);jh.writeUInt32LE(json.length,0);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,jh,json,bh,bin]);}
 return{add,finish};
}
async function main(){
 const c=read(path.join(OUT,'catalog.json')),weapons=read(path.join(ROOT,'outputs/weapon-modules/catalog.json'));const entries=[];
 const plans=[['01-machine-gun','기관총 공격','machine-gun-muzzle','machine-gun-projectile','machine-gun-hit',2,[[0,.2],[.12,.85],[.84,1.8]]],['02-deck-cannon','함포 공격','cannon-muzzle','cannon-projectile','cannon-hit',2.8,[[0,.55],[.3,1.25],[1.24,2.7]]],['03-mortar','박격포 공격','mortar-launch','mortar-projectile','mortar-hit',3.5,[[0,.55],[.3,1.75],[1.74,3.4]]],['04-harpoon','작살 견인','harpoon-launch','harpoon-projectile','harpoon-hit',2.8,[[0,.4],[.2,1.3],[1.29,2.7]]],['05-chain-shot','사슬탄 공격','chain-shot-launch','chain-shot-projectile','chain-shot-hit',2.8,[[0,.4],[.2,1.25],[1.24,2.7]]],['06-flamethrower','화염 분사','flamethrower-ignite','flamethrower-stream','flamethrower-hit',3,[[0,.4],[.15,2.6],[.5,2.9]]]];
 fs.mkdirSync(path.join(OUT,'sequences'),{recursive:true});
 for(const [weaponId,nameKo,a,b,d,duration,times] of plans){
  const w=weapons.items.find(x=>x.id===weaponId),originalWeapon=fs.readFileSync(path.join(ROOT,'outputs/weapon-modules',w.model)),repairedCopy=repairedWeaponCopy(originalWeapon),weaponBytes=repairedCopy.bytes,info=await muzzle(weaponBytes,weaponId==='03-mortar');
  const scale=1.8/Math.max(info.size.x,info.size.y,info.size.z),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI/2,0)),normalizedTip=info.tip.clone().sub(info.center).multiplyScalar(scale).applyQuaternion(rotation),pos=vec([0,info.size.y*scale/2,-.9]);const spawn=normalizedTip.clone().add(pos);
  const composer=makeComposer(weaponId+'_attack_sequence',duration);
  const normalTranslation=info.center.clone().multiplyScalar(-scale).applyQuaternion(rotation).add(pos);
  composer.add(weaponBytes,{translation:normalTranslation.toArray(),rotation:rotation.toArray(),scale:[scale,scale,scale]},null,true);
  const components=[a,b,d].map(id=>c.items.find(x=>x.id===id));const distance=weaponId==='06-flamethrower'?1.85:4;
  for(let i=0;i<components.length;i++){const item=components[i],impact=i===2;composer.add(fs.readFileSync(path.join(OUT,item.model)),{translation:spawn.clone().add(vec([0,0,impact?distance:0])).toArray(),...(impact?{rotation:new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0)).toArray()}:{})},{start:times[i][0],end:times[i][1],sourceDuration:item.duration,...(weaponId==='04-harpoon'&&i===1?{holdEnd:times[2][1]}:{})});}
  const targetKit=makeKit({id:weaponId+'_target',duration_seconds:duration,purpose:'Abstract material target for VFX preview'});for(let i=0;i<4;i++){const plank=targetKit.box(.3,1.05,.07,targetKit.P.woodLight);plank.position.set((i-1.5)*.31,0,0);}const edge=targetKit.box(1.32,.08,.11,targetKit.P.teal);edge.position.y=-.52;
  const targetBinary=Buffer.from(await new GLTFExporter().parseAsync(targetKit.root,{binary:true}));composer.add(targetBinary,{translation:spawn.clone().add(vec([0,0,distance+.04])).toArray()});
  const bytes=composer.finish();
  const gltf=await new GLTFLoader().parseAsync(geometryOnly(bytes),'').catch(e=>{throw new Error('Composite GLB geometry load failed: '+e.message);});
  let triangles=0,meshCount=0;gltf.scene.traverse(n=>{if(n.isMesh){meshCount++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});
  const model='sequences/'+weaponId+'.glb';fs.writeFileSync(path.join(OUT,model),bytes);entries.push({id:weaponId,order:entries.length+1,name_ko:nameKo,name_en:w.name_en+' Attack Sequence',category:'weapon-sequence',weapon_id:weaponId,model,preview:'sequence-previews/'+weaponId+'.png',duration,loop:true,purpose:'기존 무기와 발사→비행→명중을 연결한 연출 시연. 실제 충돌·피해·리깅은 미구현.',status:'file_animation_verified',triangles,mesh_count:meshCount,animation_count:1,bytes:bytes.length,component_effects:components.map((x,i)=>({id:x.id,start:times[i][0],end:times[i][1],...(weaponId==='04-harpoon'&&i===1?{visible_until:times[2][1]}:{})})),approximate_muzzle:spawn.toArray(),source_weapon_sha256:crypto.createHash('sha256').update(originalWeapon).digest('hex'),copied_weapon_zero_normals_repaired:repairedCopy.repaired,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});console.log(JSON.stringify({sequence:weaponId,triangles,bytes:bytes.length,repaired_normals:repairedCopy.repaired}));
 }
 fs.writeFileSync(path.join(OUT,'sequence-catalog.json'),JSON.stringify({game_title:'Cloudstitch',purpose:'Six composed weapon/VFX choreography studies. Original weapon sources preserved.',items:entries},null,2)+'\n');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
