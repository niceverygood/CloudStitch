'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-fleet-villain-v1'),work=path.join(root,'work/enemy-fleet-villain-v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const SIX=['enemy-pirate-scout','enemy-cult-blockade','enemy-union-salvage','enemy-union-repair','enemy-ghost-chaser','enemy-disguised-wreck'];
async function main(){
 if(process.argv.includes('--help')){console.log('node tools/enemy-fleet-gallery/villain-v1/build.cjs --prepare | --execute [--resume] [--ids=ID,ID]. execute requires the integration browser/exporter slot.');return;}
 const roster=JSON.parse(fs.readFileSync(path.join(root,'outputs/enemy-fleet-gallery-v1/catalog.json'),'utf8'));
 const ships=roster.ships.filter(s=>s.group!=='context'&&!SIX.includes(s.id));
 if(ships.length!==13)throw Error('Expected 13 non-overlapping new model IDs');
 const subset=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(',')||ships.map(s=>s.id);
 if(subset.some(id=>!ships.some(s=>s.id===id)))throw Error('IDs must remain in new13 whitelist; reference6 are read-only');
 const scripts=['core.js','scout-ghost.js','industrial.js','cult-boss.js','export.js'];
 const pipelineSha256=sha(Buffer.concat(scripts.map(n=>fs.readFileSync(path.join(__dirname,n)))));
 const esbuild=require('esbuild');
 const bundle=await esbuild.build({entryPoints:[path.join(__dirname,'export.js')],bundle:true,write:false,format:'iife',target:'chrome100',nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)});
 fs.mkdirSync(work,{recursive:true});
 const builder=path.join(work,'builder.html');fs.writeFileSync(builder,'<!doctype html><meta charset="utf-8"><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
 if(!process.argv.includes('--execute')){console.log(JSON.stringify({prepared:true,browser:false,modelsRead:0,ids:subset,pipelineSha256}));return;}
 for(const d of ['ships','previews'])fs.mkdirSync(path.join(out,d),{recursive:true});
 const catalogFile=path.join(out,'models.json'),prior=fs.existsSync(catalogFile)?JSON.parse(fs.readFileSync(catalogFile,'utf8')):null;
 const catalog={version:'enemy-villain-1',title:'Cloudstitch · 악당의 실루엣',ownedModelCount:13,referenceSixReadOnly:SIX,pipelineSha256,ships:ships.map(s=>prior?.ships.find(p=>p.id===s.id)||{...s,status:'source-ready',previousPreviewPath:s.previewPath,previousViewerPath:s.viewerPath,sourceAssetPath:s.assetPath,assetPath:'ships/'+s.id+'.glb',viewerPath:'ships/'+s.id+'.html',previewPath:'previews/'+s.id+'.png'})};
 const {inspectGlb}=await import('../../fleet-v2/verify.mjs');
 const {launchBrowser}=require('../../lib/runtime.cjs'),browser=await launchBrowser({args:['--disable-gpu']});
 try{
  const page=await browser.newPage();await page.goto(pathToFileURL(builder).href);
  await page.evaluate(b64=>window.__initVillain(b64),fs.readFileSync(path.join(root,'outputs/enemy-fleet-reference-v1/painted-atlas.png')).toString('base64'));
  for(const ship of catalog.ships.filter(s=>subset.includes(s.id))){
   const dest=path.join(out,ship.assetPath);
   if(process.argv.includes('--resume')&&ship.pipelineSha256===pipelineSha256&&fs.existsSync(dest)&&ship.sha256===sha(fs.readFileSync(dest))){console.log(JSON.stringify({resumed:ship.id}));continue;}
   const original=fs.readFileSync(path.resolve(root,'outputs/enemy-fleet-gallery-v1',ship.sourceAssetPath));
   if(sha(original)!==ship.sourceModelSha256)throw Error('Read-only source changed: '+ship.id);
   const result=await page.evaluate(input=>window.__exportVillain(input),{base64:original.toString('base64'),ship});
   const bytes=Buffer.from(result.base64,'base64');fs.writeFileSync(dest,bytes);
   const inspected=inspectGlb(bytes);
   Object.assign(ship,{status:'asset-built',pipelineSha256,sha256:sha(bytes),bytes:bytes.length,features:result.features,addedMeshes:result.addedMeshes,sourceClips:result.originalClips,observedClips:inspected.clips,metrics:{triangles:inspected.triangles},bounds:inspected.staticNodeBounds,geometrySignature:inspected.observedGeometrySignature,visual:'기체별 악당 강화 외형',latest:true,gameplayIntegration:false});
   fs.writeFileSync(catalogFile,JSON.stringify(catalog,null,2)+'\n');console.log(JSON.stringify({built:ship.id,triangles:inspected.triangles,features:ship.features.length,bytes:bytes.length}));
  }
 }finally{await browser.close();}
 await require('./viewers.cjs').buildViewers();
 console.log(JSON.stringify({models:catalog.ships.filter(s=>s.status==='asset-built').length,browserClosed:true,referenceSixBuilt:0}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
