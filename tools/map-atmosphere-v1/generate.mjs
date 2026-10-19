import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { makeWorldKit } from '../world-assets/core.mjs';
import * as terrain from './terrain.mjs';
import * as sky from './sky.mjs';
import * as props from './props.mjs';
import * as oldTerrain from './baseline-r1/terrain.mjs';
import * as oldSky from './baseline-r1/sky.mjs';
import * as oldProps from './baseline-r1/props.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=path.join(ROOT,'outputs/map-atmosphere-v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Linear renderer colors may contain tiny highlights above 1; glTF COLOR_0 must be in [0,1].
function encodeGLTFColors(root){let clamped=0;root.traverse(o=>{const a=o.geometry?.attributes?.color;if(!a)return;for(let i=0;i<a.array.length;i++){const v=a.array[i];if(!Number.isFinite(v))throw Error('Nonfinite vertex color');const c=Math.max(0,Math.min(1,v));if(c!==v){a.array[i]=c;clamped++;}}a.needsUpdate=true;});return clamped;}
const write=(file,obj)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(obj,null,2)+'\n');};
globalThis.FileReader ??= class {readAsArrayBuffer(b){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();}).catch(e=>this.onerror?.(e));}readAsDataURL(b){b.arrayBuffer().then(v=>{this.result='data:'+b.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.();}).catch(e=>this.onerror?.(e));}};
const modules=[terrain,sky,props], items=[], failures=[];
for(const module of modules)for(const [i,raw] of module.assets.entries()){
  const spec={...raw,order:items.length+1,build_method:'local_vertex_painted_multipart',status:'visual_asset_prototype'};
  try{
    const kit=makeWorldKit(spec),result=module.build(spec,kit)||{},clips=result.clips||[];
    kit.root.userData.implementation='Original multipart visual prototype; optional glTF transform clips. No collision, weather physics, AI, loot or mission behavior.';
    kit.root.userData.reference='references/user-rich-route.png and moodboards/; visual intent, not exact topology reproduction.';
    const encoded_color_components=encodeGLTFColors(kit.root);kit.root.updateMatrixWorld(true);
    let mesh_count=0,triangles=0,vertices=0;const materials=new Set();
    kit.root.traverse(o=>{if(!o.isMesh)return;mesh_count++;const p=o.geometry.attributes.position;if(!p)throw Error('Missing positions');for(const v of p.array)if(!Number.isFinite(v))throw Error('Nonfinite geometry');vertices+=p.count;triangles+=(o.geometry.index?.count||p.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
    if(mesh_count<4||triangles<100)throw Error('Asset requires actual multipart geometry');
    const bounds=new THREE.Box3().setFromObject(kit.root);if(bounds.isEmpty()||[...bounds.min.toArray(),...bounds.max.toArray()].some(x=>!Number.isFinite(x)))throw Error('Invalid bounds');
    for(const c of clips){if(!(c.duration>0)||!c.tracks.length)throw Error('Empty animation clip');for(const t of c.tracks)for(const v of [...t.times,...t.values])if(!Number.isFinite(v))throw Error('Nonfinite animation');}
    const glb=Buffer.from(await new GLTFExporter().parseAsync(kit.root,{binary:true,animations:clips,onlyVisible:true,trs:true}));
    const model='assets/'+spec.id+'.glb';fs.mkdirSync(path.join(OUT,'assets'),{recursive:true});fs.writeFileSync(path.join(OUT,model),glb);
    const entry={...spec,model,preview:'previews/'+spec.id+'.png',triangles:Math.round(triangles),mesh_count,vertices,material_count:materials.size,animation_count:clips.length,animation_duration:clips[0]?.duration||0,encoded_color_components,bytes:glb.length,sha256:sha(glb),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
    items.push(entry);write(path.join(OUT,'manifests',spec.id+'.json'),{...entry,format:'glTF 2 binary',vertex_colors:true,texture_count:0,units:'Relative art units; not approved engine meters',limits:['Visual prototype: collider, LOD, weather rules, bird AI, interaction and gameplay integration are not implemented.','Baked vertex color and actual geometry are saved in GLB; outline and display modes belong to the review viewer.','Animation is keyed mesh/group transformation; fluid simulation, cloth simulation and skeletal bird rig are not included.']});
    console.log(JSON.stringify({id:spec.id,meshes:mesh_count,triangles:entry.triangles,clips:clips.length,bytes:glb.length}));
  }catch(e){failures.push({id:spec.id,error:e.stack});}
}
if(new Set(items.map(x=>x.id)).size!==items.length)failures.push({error:'Duplicate asset IDs'});
const baselines=[],compareIds=new Set(['root-garden','wind-tree','sunlit-cloud','harbor-gull','mail-balloon','lightning-mast']);
for(const module of [oldTerrain,oldSky,oldProps])for(const spec of module.assets.filter(x=>compareIds.has(x.id))){
  const k=makeWorldKit(spec),r=module.build(spec,k),clips=r.clips||[];const encoded_color_components=encodeGLTFColors(k.root);k.root.updateMatrixWorld(true);
  let mesh_count=0,triangles=0;k.root.traverse(o=>{if(o.isMesh){mesh_count++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
  const bytes=Buffer.from(await new GLTFExporter().parseAsync(k.root,{binary:true,animations:clips,onlyVisible:true,trs:true}));
  const model='baseline/assets/'+spec.id+'.glb';fs.mkdirSync(path.dirname(path.join(OUT,model)),{recursive:true});fs.writeFileSync(path.join(OUT,model),bytes);
  baselines.push({...spec,id:'baseline-'+spec.id,source_asset_id:spec.id,isBaseline:true,name_ko:'이전안 · '+spec.name_ko,model,mesh_count,triangles,animation_count:clips.length,bytes:bytes.length,sha256:sha(bytes),available:true});
}
write(path.join(OUT,'catalog.json'),{game_title:'Cloudstitch',revision:'map-atmosphere-v1-rich-r2',date:'2026-10-18',type:'environment_visual_prototypes',art_target:'10x bolder expression is a perceptual target, not a numeric scale multiplier; human approval pending.',canonical_regions_unchanged:true,items,baselines});
write(path.join(OUT,'generation-report.json'),{asset_count:items.length,comparison_revision_files:baselines.length,animation_assets:items.filter(x=>x.animation_count).length,triangles:items.reduce((s,x)=>s+x.triangles,0),bytes:items.reduce((s,x)=>s+x.bytes,0),failures,passed:items.length===24&&baselines.length===6&&!failures.length});
if(items.length!==24||failures.length){console.error(JSON.stringify(failures));process.exitCode=1;}
