const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const{repoPath}=require('../lib/paths.cjs');
const out=repoPath('outputs/fleet-v1');
const catalog=JSON.parse(fs.readFileSync(path.join(out,'catalog.json')));
const report=JSON.parse(fs.readFileSync(repoPath(process.argv[2]||'work/verification/fleet/qa-result.json')));
if(!report.passed||!report.fullCorpusPassed||report.assets.length!==catalog.ships.length)throw new Error('Complete corpus QA must pass before finalization.');
const ghostPath=repoPath('work/verification/fleet-ghosting/qa-result.json');
if(fs.existsSync(ghostPath)){
 const ghost=JSON.parse(fs.readFileSync(ghostPath));if(!ghost.passed||catalog.ships.find(s=>s.id===ghost.asset)?.sha256!==ghost.modelSha256)throw new Error('Shared viewer ghosting regression failed or is stale.');
 fs.writeFileSync(path.join(out,'ghosting-verification.json'),JSON.stringify(ghost,null,2)+'\n');
}
const labelPath=repoPath('work/verification/fleet-labels/qa-result.json');
if(fs.existsSync(labelPath)){
 const labels=JSON.parse(fs.readFileSync(labelPath));if(!labels.passed)throw new Error('Presentation label regression failed.');
 fs.writeFileSync(path.join(out,'labels-verification.json'),JSON.stringify(labels,null,2)+'\n');
}
for(const ship of catalog.ships){
 const result=report.assets.find(a=>a.id===ship.id);
 if(!result?.passed||result.asset.sha256!==ship.sha256||ship.previewSourceSha256!==ship.sha256)throw new Error(`Stale verification or thumbnail: ${ship.id}`);
 ship.qaStatus='passed';ship.verification={passed:true,khronosErrors:result.validation.errors,khronosWarnings:result.validation.warnings,mobileOverflow:result.viewer.mobileOverflow,externalRequestCount:result.viewer.externalRequests.length,browserErrorCount:result.viewer.errors.length,report:'verification.json'};
}
catalog.verification={passed:true,fullCorpusPassed:true,report:'verification.json',representativeGhostingReport:fs.existsSync(ghostPath)?'ghosting-verification.json':null,presentationLabelsReport:fs.existsSync(labelPath)?'labels-verification.json':null,verifiedAt:new Date().toISOString(),scope:'Asset structure, source coverage, rig clips, offline browser presentation. No engine/gameplay/performance certification.'};
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
const summaryPath=repoPath('work/verification/fleet/verification-summary.txt');
if(fs.existsSync(summaryPath))fs.copyFileSync(summaryPath,path.join(out,'verification-summary.txt'));
const template=fs.readFileSync(path.join(__dirname,'gallery-template.html'),'utf8');
fs.writeFileSync(path.join(out,'index.html'),template.replace('/* FLEET_CATALOG */',()=>JSON.stringify(catalog).replace(/</g,'\\u003c')));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const files=['catalog.json','index.html','verification.json','verification-summary.txt','ghosting-verification.json','labels-verification.json','handpainted-atlas.png','handpainted-atlas-v2.png','README.txt','fleet-overview.png'].filter(f=>fs.existsSync(path.join(out,f))).map(file=>{const bytes=fs.readFileSync(path.join(out,file));return{file,bytes:bytes.length,sha256:sha(bytes)}});
const manifest={title:'Cloudstitch',revision:1,catalogEntries:catalog.ships.length,uniqueCanonHullCount:null,scopeCounts:{coreEntries:24,variantEntries:14,roleAndSupportEntries:29,facilityEntries:3,recordEntries:1},files,assets:catalog.ships.map(s=>({id:s.id,name:s.name,model:s.assetPath,viewer:s.viewerPath,preview:s.previewPath,bytes:s.bytes,sha256:s.sha256,authoredUnits:s.authoredUnits,recommendedFleetScale:s.recommendedFleetScale,triangles:s.metrics.triangles,bones:s.metrics.bones,clips:s.metrics.clips,qaStatus:s.qaStatus})),verification:catalog.verification,limitations:['Source-unspecified shapes, counts and dimensions remain artistic proposals.','Seven clips per model; device-only actions are enabled only when supported.','Toon shading and outlines are viewer runtime features, not baked into GLB.','Final engine scale, collision, LOD, AI, gameplay and target-device performance remain unverified.']};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({finalized:catalog.ships.length,passed:true,glbBytes:catalog.ships.reduce((n,s)=>n+s.bytes,0)}));
