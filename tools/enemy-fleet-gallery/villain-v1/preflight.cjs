'use strict';
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-fleet-villain-v1');
(async()=>{
 const code="import {THREE} from './core.js';import {addIndustrial} from './industrial.js';import {addCultBoss} from './cult-boss.js';import {addScoutGhost} from './scout-ghost.js';export {THREE,addIndustrial,addCultBoss,addScoutGhost};";
 const bundle=await esbuild.build({stdin:{contents:code,resolveDir:__dirname},bundle:true,platform:'node',format:'cjs',write:false,nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)});
 const mod={exports:{}};new Function('module','exports','require',bundle.outputFiles[0].text)(mod,mod.exports,require);
 const{THREE,...builders}=mod.exports,base=JSON.parse(fs.readFileSync(path.join(root,'outputs/enemy-fleet-gallery-v1/catalog.json'),'utf8'));
 const ships=base.ships.filter(s=>s.group!=='context'&&!s.latest),results=[];
 for(const s of ships){
  const root=new THREE.Group(),m=Object.fromEntries(['ink','iron','brass','wood','darkWood','ivory','red','teal','cloth','glow','cold','dark','metal','canvas','rope','gray'].map(n=>[n,new THREE.MeshBasicMaterial({color:0x909090,side:THREE.DoubleSide})])),features=[];
  const handled=Object.values(builders).filter(fn=>fn({id:s.id,root,m,unit:1,features})).length;
  let meshes=0,invalid=0,missing=0;const names=new Set(),duplicates=[];
  root.updateMatrixWorld(true);root.traverse(n=>{if(n.name&&names.has(n.name))duplicates.push(n.name);names.add(n.name);if(!n.isMesh)return;meshes++;if(!n.material)missing++;const p=n.geometry.attributes.position;for(let i=0;i<p.array.length;i++)if(!Number.isFinite(p.array[i]))invalid++;});
  const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()).toArray();
  const row={id:s.id,handled,meshes,features:features.length,invalidPositions:invalid,missingMaterials:missing,duplicateNames:duplicates,bounds:size};row.passed=handled===1&&meshes>0&&features.length>=5&&!invalid&&!missing&&!duplicates.length&&size.every(Number.isFinite);results.push(row);
 }
 const report={scope:'13 synthetic additional-geometry API checks only. Original GLB reads0, browsers0, exporters0. Does not approve actual composite render quality.',passed:results.length===13&&results.every(r=>r.passed),results};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'source-preflight.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,models:results.length,failures:results.filter(r=>!r.passed)}));if(!report.passed)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
