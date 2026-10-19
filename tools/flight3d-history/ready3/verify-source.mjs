import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),checks=[];
const check=(name,passed,detail)=>checks.push({name,passed:!!passed,detail});
const html=fs.readFileSync(path.join(root,'tools/flight3d/template.html'),'utf8'),app=fs.readFileSync(path.join(root,'tools/flight3d/app.js'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),refs=[...app.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
check('unique-controls-and-app-references',new Set(ids).size===ids.length&&refs.every(id=>ids.includes(id)),{ids:ids.length,refs:new Set(refs).size,missing:refs.filter(id=>!ids.includes(id))});
for(const filename of ['outputs/playable-battlefield-v1/handoff-files.json','outputs/playable-camera-v1/delivery-manifest.json']){
 const baseline=JSON.parse(fs.readFileSync(path.join(root,filename),'utf8'));
 const changed=baseline.files.filter(file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file.path))).digest('hex')!==file.sha256).map(file=>file.path);
 check(`preserved-${filename}`,changed.length===0,{files:baseline.files.length,changed});
}
check('single-xyz-state-owner',!app.includes('playable-session')&&!app.includes('battlefield/sim')&&app.includes("from './sim.mjs'"));
const archive=JSON.parse(fs.readFileSync(path.join(root,'outputs/flight3d-ready2/preservation.json'),'utf8'));
const archivedChanged=archive.files.filter(file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file.path))).digest('hex')!==file.sha256).map(file=>file.path);
check('ready2-playable-and-browser-report-preserved',archivedChanged.length===0,{files:archive.files.length,changed:archivedChanged});
const report={version:1,passed:checks.every(c=>c.passed),checks,scope:'Static controls and previous artifacts preservation only; physics and browser checks are separate.'};
fs.mkdirSync(path.join(root,'outputs/flight3d-v1'),{recursive:true});fs.writeFileSync(path.join(root,'outputs/flight3d-v1/source-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
