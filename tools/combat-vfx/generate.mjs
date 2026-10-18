import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeKit, THREE } from './core.mjs';
import { buildPrimary } from './primary.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=path.join(ROOT,'outputs/combat-vfx');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const write=(p,data)=>fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n');
// Node provides Blob; this adapter is only for GLTFExporter's asynchronous reads.
globalThis.FileReader ??= class {readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();}).catch(e=>this.onerror?.(e));}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result='data:'+blob.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.();});}};
globalThis.ProgressEvent ??= class {constructor(type,data={}){this.type=type;Object.assign(this,data);}};

function inspect(bytes){
 if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Incomplete GLB');
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
 let triangles=0;
 for(const mesh of json.meshes||[])for(const p of mesh.primitives){if((p.mode??4)!==4)throw new Error('Nontriangle primitive');triangles+=json.accessors[p.indices??p.attributes.POSITION].count/3;}
 const channels=(json.animations||[]).flatMap(a=>a.channels.map(c=>c.target.path));
 if(!triangles||!channels.length||channels.some(x=>!['translation','rotation','scale'].includes(x)))throw new Error('Expected actual mesh plus portable transform animation');
 if((json.buffers||[]).some(b=>b.uri)||(json.images||[]).some(i=>i.uri))throw new Error('External resource in GLB');
 return {triangles,mesh_count:json.meshes.length,node_count:json.nodes.length,material_count:(json.materials||[]).length,animation_count:json.animations.length,animation_channels:channels.length,channel_paths:[...new Set(channels)],vertex_colors:json.meshes.every(m=>m.primitives.every(p=>p.attributes.COLOR_0!==undefined)),unlit_materials:json.materials.every(m=>m.extensions?.KHR_materials_unlit),texture_count:(json.textures||[]).length};
}
async function verifyMotion(bytes,duration){
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
 const mixer=new THREE.AnimationMixer(gltf.scene),clip=gltf.animations[0],action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 if(Math.abs(clip.duration-duration)>.001)throw new Error('Clip duration differs from recipe');
 const states=[],bounds=new THREE.Box3();
 for(const fraction of [0,.15,.35,.65,.9,1]){mixer.setTime(duration*fraction);gltf.scene.updateMatrixWorld(true);const values=[];gltf.scene.traverse(n=>{if(n.isMesh)values.push(...n.matrixWorld.elements.map(v=>Math.round(v*1e6)/1e6));});if(values.some(v=>!Number.isFinite(v)))throw new Error('Non-finite animation transform');states.push(crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex'));bounds.union(new THREE.Box3().setFromObject(gltf.scene));}
 const changed=new Set(states).size>1;if(!changed)throw new Error('Serialized animation does not change any mesh transforms');
 mixer.stopAllAction();
 return {GLTFLoader_roundtrip:true,animation_changes_transforms:true,sample_fractions:[0,.15,.35,.65,.9,1],unique_sample_states:new Set(states).size,clip_duration:clip.duration,animated_bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
}
async function main(){
 const spec=read(path.join(OUT,'production-spec.json'));const requested=process.argv[2];
 const effects=requested?spec.effects.filter(e=>e.id===requested):spec.effects;
 if(!effects.length)throw new Error('Unknown effect ID');
 fs.mkdirSync(path.join(OUT,'assets'),{recursive:true});fs.mkdirSync(path.join(OUT,'manifests'),{recursive:true});
 let catalog=fs.existsSync(path.join(OUT,'catalog.json'))?read(path.join(OUT,'catalog.json')):{game_title:'Cloudstitch',type:'animated-mesh-vfx',items:[]};
 let secondary;
 for(const item of effects){
  const kit=makeKit(item);
  if(item.order<=26)buildPrimary(item,kit);else {secondary??=await import('./secondary.mjs');secondary.buildSecondary(item,kit);}
  const clip=kit.clip();if(!clip.validate())throw new Error('Invalid keyframe clip '+item.id);
  const binary=await new GLTFExporter().parseAsync(kit.root,{binary:true,animations:[clip],trs:true,onlyVisible:false,includeCustomExtensions:false});
  const bytes=Buffer.from(binary),stats=inspect(bytes),verification=await verifyMotion(bytes,item.duration_seconds);
  const model='assets/'+item.id+'.glb';fs.writeFileSync(path.join(OUT,model),bytes);
  const manifest={id:item.id,name_ko:item.name_ko,source:'Original local procedural mesh authored for Cloudstitch',status:'file_animation_verified',model,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,...stats,duration:item.duration_seconds,loop:item.loop,axes:'+Y up, +Z forward; surface impact normal +Y',verification,meshy_credits_used:0,limits:['Visual mesh animation prototype. No collision, damage, fluid simulation, engine particle graph or sound.','Opacity and lighting/shader parameters are not animated. Appearance/disappearance uses mesh scale.','Unlit vertex paint is embedded. Optional viewer outline is a runtime effect.','Duration/size are art preview values; they do not change gameplay rules.']};
  write(path.join(OUT,'manifests',item.id+'.json'),manifest);
  const entry={id:item.id,order:item.order,name_ko:item.name_ko,name_en:item.name_en,category:item.category,weapon_id:item.weapon_id,model,preview:'previews/'+item.id+'.png',duration:item.duration_seconds,loop:item.loop,purpose:item.purpose,status:manifest.status,...stats,bytes:bytes.length,animated_bounds:verification.animated_bounds};
  catalog.items=[...catalog.items.filter(e=>e.id!==item.id),entry].sort((a,b)=>a.order-b.order);write(path.join(OUT,'catalog.json'),catalog);
  const ids=new Set(catalog.items.map(x=>x.id));write(path.join(OUT,'progress.json'),{game_title:'Cloudstitch',scope_count:48,files_verified:catalog.items.map(e=>e.id),remaining:spec.effects.filter(e=>!ids.has(e.id)).map(e=>e.id),meshy_credits_used:0,browser_verification_pending:true});
  console.log(JSON.stringify({id:item.id,triangles:stats.triangles,animation_channels:stats.animation_channels,bytes:bytes.length,verified:catalog.items.length}));
  kit.root.traverse(n=>{if(n.isMesh)n.geometry.dispose();});
 }
 console.log(JSON.stringify({completed_files:catalog.items.length,output:'outputs/combat-vfx',paid_generations:0}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
