const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');const esbuild=require('esbuild');
const {repoPath,launchBrowser}=require('../lib/runtime.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function main(){
 const out=repoPath('outputs/fleet-v1'),work=repoPath('work/fleet'),source=require('./catalog.json');
 fs.mkdirSync(path.join(out,'ships'),{recursive:true});fs.mkdirSync(path.join(out,'previews'),{recursive:true});fs.mkdirSync(work,{recursive:true});
 const args=process.argv.slice(2),only=args.find(x=>x.startsWith('--ids='))?.slice(6).split(',');
 const selected=only?source.ships.filter(s=>only.includes(s.id)):source.ships;
 const pipelineHash=sha(Buffer.concat(['body.js','devices.js','assemble.js','rigging.js','export.js','selected.cjs'].map(file=>fs.readFileSync(path.join(__dirname,file))).concat([fs.readFileSync(repoPath('tools/airship-rig/motion.js')),fs.readFileSync(path.join(out,'handpainted-atlas-v2.png'))])));
 if(!selected.length)throw new Error('No fleet assets selected.');
 const exported=fs.existsSync(path.join(out,'catalog.json'))?JSON.parse(fs.readFileSync(path.join(out,'catalog.json'))):{...source,ships:[]};
 if(args.includes('--viewers-only')){
  for(const spec of selected){const asset=exported.ships.find(s=>s.id===spec.id);if(!asset)throw new Error('Build model first: '+spec.id);const binary=fs.readFileSync(path.join(out,asset.assetPath));if(sha(binary)!==asset.sha256)throw new Error('Stale model: '+spec.id);await buildViewer(spec,binary,path.join(out,asset.viewerPath));}
  const template=fs.readFileSync(path.join(__dirname,'gallery-template.html'),'utf8');
  fs.writeFileSync(path.join(out,'index.html'),template.replace('/* FLEET_CATALOG */',()=>JSON.stringify(exported).replace(/</g,'\\u003c')));
  console.log(JSON.stringify({viewers: selected.length,modelsUnchanged:true}));return;
 }
 const result=await esbuild.build({entryPoints:[path.join(__dirname,'export.js')],bundle:true,write:false,format:'iife',target:'chrome100'});
 const builderPath=path.join(work,'builder.html');fs.writeFileSync(builderPath,'<!doctype html><meta charset="utf-8"><script>'+result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage();page.on('pageerror',e=>console.error(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warn')console.error(m.text())});
  await page.goto(pathToFileURL(builderPath).href);await page.evaluate(atlas=>window.__initFleet(atlas),fs.readFileSync(path.join(out,'handpainted-atlas-v2.png')).toString('base64'));
  for(const spec of selected){
   let asset=exported.ships.find(s=>s.id===spec.id),binary;
   const modelFile=path.join(out,'ships',spec.id+'.glb');
   const buildHash=sha(Buffer.from(pipelineHash+JSON.stringify(spec)));
   if(args.includes('--resume')&&asset?.buildHash===buildHash&&fs.existsSync(modelFile)&&sha(fs.readFileSync(modelFile))===asset.sha256){binary=fs.readFileSync(modelFile);console.log(JSON.stringify({id:spec.id,reused:true,bytes:binary.length}));}
   else{
    const built=spec.id==='player-homeward'?require('./selected.cjs').selectedAsset(spec):await page.evaluate(spec=>window.__exportFleetShip(spec),spec);binary=Buffer.from(built.base64,'base64');fs.writeFileSync(modelFile,binary);
    const previewMetadata=asset?.sha256===sha(binary)&&asset?.previewSourceSha256===asset.sha256?{previewSourceSha256:asset.previewSourceSha256,previewCapturedAt:asset.previewCapturedAt}:{};
    asset={...spec,status:'asset-built',assetPath:`ships/${spec.id}.glb`,viewerPath:`ships/${spec.id}.html`,previewPath:`previews/${spec.id}.png`,model:`ships/${spec.id}.glb`,viewer:`ships/${spec.id}.html`,preview:`previews/${spec.id}.png`,bytes:binary.length,sha256:sha(binary),buildHash,metrics:built.metrics,artModules:built.artModules,shapeProposal:built.shapeProposal,style:built.style,availableActions:built.availableActions,authoredUnits:built.authoredUnits||'fleet-kit',recommendedFleetScale:built.recommendedFleetScale||1,qaStatus:'pending',productionNote:'Authored modular 3D interpretation. Confirmed module counts are preserved; null source values use explicitly provisional art layout. No engine/gameplay implementation.'};
    Object.assign(asset,previewMetadata);
    exported.ships=exported.ships.filter(s=>s.id!==spec.id);exported.ships.push(asset);
    console.log(JSON.stringify({id:spec.id,bytes:binary.length,triangles:built.metrics.triangles,bones:built.metrics.bones,clips:built.metrics.clips.length}));
   }
   await buildViewer(spec,binary,path.join(out,asset.viewerPath));
   exported.ships.sort((a,b)=>source.ships.findIndex(s=>s.id===a.id)-source.ships.findIndex(s=>s.id===b.id));
   exported.assetCount=exported.ships.length;exported.sourceCatalogCount=source.ships.length;
   fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(exported,null,2)+'\n');
  }
 }finally{await browser.close();}
 const template=fs.readFileSync(path.join(__dirname,'gallery-template.html'),'utf8');
 fs.writeFileSync(path.join(out,'index.html'),template.replace('/* FLEET_CATALOG */',()=>JSON.stringify(exported).replace(/</g,'\\u003c')));
 console.log(JSON.stringify({built:selected.length,total:exported.ships.length,sourceCount:source.ships.length,output:'outputs/fleet-v1/index.html'}));
}
async function buildViewer(spec,binary,file){
 const result=await esbuild.build({entryPoints:[path.join(__dirname,'viewer.js')],bundle:true,minify:true,write:false,format:'iife',target:['chrome100','safari16'],define:{__MODEL_BASE64__:JSON.stringify(binary.toString('base64')),__MODEL_BYTES__:String(binary.length)}});
 const name=spec.name.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const template=fs.readFileSync(path.join(__dirname,'viewer-template.html'),'utf8').replaceAll('귀환호',name);
 fs.writeFileSync(file,template.replace('/* BUNDLED_VIEWER */',()=>result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')));
}
main().catch(e=>{console.error(e);process.exitCode=1});
