'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../../..');process.env.NODE_PATH=[path.join(root,'work/combat-vfx-v2/deps/node_modules'),process.env.NODE_PATH].filter(Boolean).join(path.delimiter);Module._initPaths();
(async()=>{
 const esbuild=require('esbuild');
 const contents="export * from './core.js';export {buildIndustrial} from './industrial.js';export {buildCult} from './cult.js';export {buildSpectralWorks} from './spectral-works.js';";
 const bundle=await esbuild.build({stdin:{contents,resolveDir:__dirname},bundle:true,platform:'node',format:'cjs',write:false,nodePaths:process.env.NODE_PATH.split(path.delimiter)}),mod={exports:{}};
 new Function('module','exports','require',bundle.outputFiles[0].text)(mod,mod.exports,require);
 const {THREE,createContext,threatClip,buildIndustrial,buildCult,buildSpectralWorks}=mod.exports;
 const ids=['enemy-tax-cutter','mission-union-guard','mission-bridge-tug','mission-guard-scout','mission-cult-purifier','mission-ghost-artillery','role-enemy-artillery','role-enemy-defense','mini-funeral-guard','boss-shipyard-ribs','boss-shipwright-command','boss-last-inhale'];
 const results=[];
 for(const id of ids){
  const m=Object.fromEntries(['wood','darkWood','canvas','red','ivory','gray','teal','metal','iron','dark','ink','brass','rope','glow','cold'].map(k=>[k,new THREE.MeshBasicMaterial({color:0x999999,side:THREE.DoubleSide})]));
  const ctx=createContext(id,m),handled=[buildIndustrial,buildCult,buildSpectralWorks].map(f=>f(ctx)).filter(Boolean),names=new Set(),issues=[];let meshes=0,bones=0,triangles=0;
  ctx.scene.updateMatrixWorld(true);ctx.scene.traverse(n=>{
   if(n.name&&names.has(n.name))issues.push('duplicate-name:'+n.name);names.add(n.name);if(n.isBone)bones++;
   if(!n.matrixWorld.elements.every(Number.isFinite))issues.push('invalid-transform:'+n.name);
   if(!n.isMesh)return;meshes++;if(!n.material)issues.push('missing-material:'+n.name);
   const g=n.geometry;if(!g.attributes.uv)issues.push('missing-uv:'+n.name);if(!g.attributes.normal)issues.push('missing-normal:'+n.name);
   for(const a of Object.values(g.attributes))if(!Array.from(a.array).every(Number.isFinite))issues.push('nonfinite-attribute:'+n.name);
   triangles+=(g.index?.count||g.attributes.position.count)/3;
  });
  const clip=threatClip(ctx);for(const t of clip.tracks)if(!Array.from(t.values).every(Number.isFinite))issues.push('nonfinite-animation');
  const b=new THREE.Box3().setFromObject(ctx.scene),size=b.getSize(new THREE.Vector3()).toArray();
  if(handled.length!==1||handled[0]?.features.length<5)issues.push('missing-unique-treatment');
  if(ctx.threats.length<1||ctx.threats.length>3)issues.push('missing-threat-hierarchy');
  if(size.some(v=>!Number.isFinite(v)||v<=0))issues.push('invalid-bounds');
  if(id==='boss-last-inhale'){
   const roots=[];ctx.scene.traverse(n=>{if(n.isBone)roots.push(n.name);});
   if(roots.filter(n=>/seal-tower-\d+$/.test(n)).length!==3)issues.push('expected-three-seal-tower-roots');
   if(roots.filter(n=>/single-mechanical-egg$/.test(n)).length!==1)issues.push('expected-one-heart-root');
  }
  results.push({id,meshes,bones,triangles,threats:ctx.threats.length,size,features:handled[0]?.features,passed:issues.length===0,issues});
 }
 const report={revision:'bold-v2-source-preflight',scope:'Synthetic source geometry only; GLB reads0, browser0, exporter0, rigskin0. Actual rendering and human art approval pending.',passed:results.every(r=>r.passed),models:results.length,results};
 const file=path.join(root,'outputs/enemy-fleet-villain-v2/source-preflight.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,models:results.length,failures:results.filter(r=>!r.passed)}));if(!report.passed)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
