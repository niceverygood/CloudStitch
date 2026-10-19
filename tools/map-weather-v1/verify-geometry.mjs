// Lightweight memory preflight only. No renderer, browser or GLB export.
import fs from 'node:fs';
import { createWeatherAssets } from './assets.mjs';
const assets=createWeatherAssets(),errors=[],phases=[];
for(const time of [0,.8,3,3.4,4.5]){
 const state={time,player:{icing:.75,preheating:true},weather:{lightning:{phase:time===3?'strike':time<3?'warning':'recovery',target:{x:-45,y:8,z:24},phaseTime:.2,remaining:1,progress:.5},thermal:{phase:time===3.4?'burst':time<3.4?'warning':'recovery',jetIndex:0,progress:.5,phaseTime:.2,remaining:1}}};
 assets.update(state,0);
 assets.root.traverse(o=>{if(!o.isMesh)return;for(const [key,attr]of Object.entries(o.geometry.attributes))for(const value of attr.array)if(!Number.isFinite(value)||(key==='color'&&(value<0||value>1))){errors.push({time,name:o.name,key,value});break;}for(const m of Array.isArray(o.material)?o.material:[o.material])if(!Number.isFinite(m.opacity)||m.opacity<0||m.opacity>1)errors.push({time,name:o.name,opacity:m.opacity});for(const value of [...o.position.toArray(),...o.scale.toArray(),...o.quaternion.toArray()])if(!Number.isFinite(value))errors.push({time,name:o.name,transform:value});});
 phases.push(time);
}
assets.setExpression('standard');const standard=assets.inspect();assets.setExpression('dramatic');const dramatic=assets.inspect();assets.dispose();
const report={scope:'Memory-only generated geometry and expression census; no renderer, browser, GLB export or art approval.',passed:errors.length===0,errors,phases,standard,dramatic,originalFailurePreserved:'geometry-preflight.json',correction:'Clamp only local consumer geometry COLOR_0 into the standard range; source recipe remains unchanged.'};
fs.writeFileSync('outputs/map-weather-v1/geometry-preflight-followup.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,meshes:dramatic.meshes,triangles:dramatic.triangles,reusedColorComponentsClamped:dramatic.reusedColorComponentsClamped,errors:errors.length}));if(!report.passed)process.exitCode=1;
