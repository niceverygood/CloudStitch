import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {buildShip,ROSTER} from './models.mjs';

globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();}).catch(e=>this.onerror?.(e));}readAsDataURL(b){b.arrayBuffer().then(v=>{this.result='data:'+b.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.();}).catch(e=>this.onerror?.(e));}};
const root=process.cwd(),out=path.join(root,'outputs/chapter2-fleet-assets-v1'),work=path.join(root,'work/chapter2-fleet-assets'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const selected=process.argv.find(a=>a.startsWith('--ids='))?.split('=')[1].split(',');
const roster=selected?ROSTER.filter(r=>selected.includes(r.kind)):ROSTER;
const preflight=process.argv.includes('--preflight');
fs.mkdirSync(work,{recursive:true});
function census(object){let triangles=0,vertices=0,meshes=0,invalid=0;const mats=new Set();object.traverse(n=>{if(!n.isMesh)return;meshes++;const g=n.geometry;triangles+=(g.index?g.index.count:g.attributes.position.count)/3;vertices+=g.attributes.position.count;for(const a of Object.values(g.attributes))for(const v of a.array)if(!Number.isFinite(v))invalid++;(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>mats.add(m));});return{triangles,vertices,meshes,materials:mats.size,invalid,bounds:new T.Box3().setFromObject(object).getSize(new T.Vector3()).toArray()};}
function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function pngChunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([n,t,data,crc]);}
function atlasPNG(){const W=1024,H=512,raw=Buffer.alloc(H*(W*3+1));let seed=91843;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};for(let y=0;y<H;y++){const offset=y*(W*3+1);for(let x=0;x<W;x++){const u=x%256,v=y%256,k=Math.floor(x/256)+Math.floor(y/256)*4,grain=rand(),brush=Math.sin(u*.038+Math.sin(v*.049)*2)*2+Math.sin(v*.11+u*.007)*2;let tone=245+brush+(grain-.5)*6,r=1,g=1,b=1;
 if(k===0){tone+=Math.sin(v*.21+Math.sin(u*.021)*1.5)*2.8;r=1.0;g=.987;b=.985+Math.sin(u*.04+v*.025)*.014;}
 if(k===1){tone-=Math.pow(Math.max(0,Math.sin(v*.37+Math.sin(u*.009)*2)),16)*17;tone+=Math.sin(v*1.7+u*.04)*2;}
 if(k===2){tone-=((u%5===0)?7:0)+((v%6===0)?4:0);if(u%48<2&&v%10<5)tone-=16;}
 if(k===3){tone+=Math.sin(u*.19+Math.sin(v*.035)*2)*4;if(grain<.015)tone-=23;}
 if(k===4){tone-=Math.pow(Math.max(0,Math.cos(u*.27+v*.23)),8)*14;}
 if(k===5){tone+=Math.sin(v*.5+u*.009)*3;}
 const pos=offset+1+x*3;raw[pos]=Math.max(0,Math.min(255,tone*r));raw[pos+1]=Math.max(0,Math.min(255,tone*g));raw[pos+2]=Math.max(0,Math.min(255,tone*b));}}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',ihdr),pngChunk('IDAT',zlib.deflateSync(raw,{level:9})),pngChunk('IEND',Buffer.alloc(0))]);}
const pad=(b,fill=0)=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4,fill)]);
function embedAtlas(bytes,png){const jlen=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jlen).toString()),binOffset=20+jlen,binLen=bytes.readUInt32LE(binOffset),bin=bytes.subarray(binOffset+8,binOffset+8+binLen),start=pad(bin).length,all=pad(Buffer.concat([pad(bin),png]));json.bufferViews??=[];const bufferView=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:start,byteLength:png.length});json.images=[{bufferView,mimeType:'image/png',name:'Cloudstitch_handpainted_material_atlas'}];json.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];json.textures=[{source:0,sampler:0}];for(const m of json.materials||[]){m.pbrMetallicRoughness??={};m.pbrMetallicRoughness.baseColorTexture={index:0,texCoord:0};m.pbrMetallicRoughness.metallicFactor=0;m.pbrMetallicRoughness.roughnessFactor=.98;}
 json.buffers[0].byteLength=all.length;const jb=pad(Buffer.from(JSON.stringify(json)),32),header=Buffer.alloc(12),jc=Buffer.alloc(8),bc=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jb.length+8+all.length,8);jc.writeUInt32LE(jb.length);jc.write('JSON',4);bc.writeUInt32LE(all.length);bc.write('BIN\0',4);return Buffer.concat([header,jc,jb,bc,all]);}

const records=[],atlas=preflight?null:atlasPNG();
if(!preflight){fs.mkdirSync(path.join(out,'ships'),{recursive:true});fs.mkdirSync(path.join(out,'textures'),{recursive:true});fs.writeFileSync(path.join(out,'textures/handpainted-atlas.png'),atlas);}
const prior=!preflight&&fs.existsSync(path.join(out,'catalog.json'))?JSON.parse(fs.readFileSync(path.join(out,'catalog.json'))):null;
for(const spec of roster){
 const {root:ship,clips,featureCounts,components}=buildShip(spec.kind),stats=census(ship);if(stats.invalid)throw Error(spec.kind+' contains nonfinite geometry');if(stats.triangles<15000)throw Error(spec.kind+' unexpectedly sparse');
 const row={...spec,...stats,authoredComponents:components,featureCounts,reference:'../chapter2-enemy-moodboards-v1/'+spec.board,referenceSha256:sha(fs.readFileSync(path.join(root,'outputs/chapter2-enemy-moodboards-v1',spec.board)))};
 if(preflight){records.push(row);console.log(JSON.stringify({kind:spec.kind,triangles:stats.triangles,meshes:stats.meshes,components,featureCounts}));}
 else {const scene=new T.Scene();scene.name='Cloudstitch_chapter2_'+spec.kind;scene.add(ship);const raw=Buffer.from(await new GLTFExporter().parseAsync(scene,{binary:true,trs:true,animations:clips})),bytes=embedAtlas(raw,atlas);const assetPath='ships/'+spec.kind+'.glb';fs.writeFileSync(path.join(out,assetPath),bytes);records.push({...row,assetPath,viewerPath:'ships/'+spec.kind+'.html',previewPath:'previews/'+spec.kind+'.png',bytes:bytes.length,sha256:sha(bytes),embeddedAtlas:{images:1,width:1024,height:512,sha256:sha(atlas)},animations:clips.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length})),artApproval:'pending',status:'exported_needs_actual_render'});console.log(JSON.stringify({kind:spec.kind,bytes:bytes.length,triangles:stats.triangles,meshes:stats.meshes}));}
 ship.traverse(n=>{if(n.isMesh)n.geometry.dispose();});globalThis.gc?.();
}
if(preflight)fs.writeFileSync(path.join(work,'preflight.json'),JSON.stringify({scope:'CPU source census, no exporter or browser',models:records},null,2));
else {const combined=ROSTER.map(s=>records.find(r=>r.kind===s.kind)||prior?.models.find(r=>r.kind===s.kind)).filter(Boolean);fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({title:'Cloudstitch · 적조 사냥함대 3D 에셋',revision:'chapter2-fleet-assets-v1',coordinate:'+Y up, -X bow; relative art units',artMethod:'original curved geometry, matte vertex brush shading and embedded material atlas',gameplayImplemented:false,newPaidGeneration:false,models:combined},null,2));}
