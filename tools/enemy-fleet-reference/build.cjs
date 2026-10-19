'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url'),esbuild=require('esbuild');
const {launchBrowser}=require('../lib/runtime.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/enemy-fleet-reference-v1'),work=path.join(root,'work/enemy-fleet-reference');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const IDS=['enemy-pirate-scout','enemy-cult-blockade','enemy-union-salvage','enemy-union-repair','enemy-ghost-chaser','enemy-disguised-wreck'];
const nodePaths=(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean);
async function main(){
  if(process.argv.includes('--help')){console.log('node tools/enemy-fleet-reference/build.cjs [--ids=ID,ID] [--resume]');return;}
  const {inspectGlb}=await import('../fleet-v2/verify.mjs');
  const source=JSON.parse(fs.readFileSync(path.join(root,'tools/fleet/catalog.json'),'utf8'));
  const only=process.argv.find(arg=>arg.startsWith('--ids='))?.slice(6).split(',')||IDS;
  if(only.some(id=>!IDS.includes(id)))throw new Error('Unknown enemy reference ID');
  for(const dir of ['ships','previews'])fs.mkdirSync(path.join(out,dir),{recursive:true});fs.mkdirSync(work,{recursive:true});
  const old=fs.existsSync(path.join(out,'catalog.json'))?JSON.parse(fs.readFileSync(path.join(out,'catalog.json'),'utf8')):null;
  const reference=fs.readFileSync(path.join(out,'reference.png')),atlas=fs.readFileSync(path.join(out,'painted-atlas.png'));
  const pipelineSha=sha(Buffer.concat(['kit.js','scout-cult.js','industrial.js','ghost-wreck.js','export.js'].map(file=>fs.readFileSync(path.join(__dirname,file))).concat(atlas)));
  const bundle=await esbuild.build({entryPoints:[path.join(__dirname,'export.js')],bundle:true,write:false,format:'iife',target:'chrome100',nodePaths});
  const builder=path.join(work,'builder.html');fs.writeFileSync(builder,'<!doctype html><meta charset="utf-8"><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
  const catalog={version:'enemy-reference-ready-1',title:'Cloudstitch · 여섯 적 함선',referenceSha256:sha(reference),atlasSha256:sha(atlas),scope:'Six independent reference interpretations, original IDs/modules preserved. No automatic combat replacement.',ships:IDS.map(id=>old?.ships.find(ship=>ship.id===id)||{...source.ships.find(ship=>ship.id===id),status:'planned',assetPath:'ships/'+id+'.glb',viewerPath:'ships/'+id+'.html',previewPath:'previews/'+id+'.png'})};
  const browser=await launchBrowser({args:['--disable-gpu']});
  try{
    const page=await browser.newPage();page.on('pageerror',e=>process.stderr.write(e.message+'\n'));await page.goto(pathToFileURL(builder).href);await page.evaluate(atlas=>window.__initEnemyReference(atlas),atlas.toString('base64'));
    for(const ship of catalog.ships.filter(ship=>only.includes(ship.id))){
      const target=path.join(out,ship.assetPath);let bytes,result;
      if(process.argv.includes('--resume')&&ship.pipelineSha256===pipelineSha&&fs.existsSync(target)&&sha(fs.readFileSync(target))===ship.sha256)bytes=fs.readFileSync(target);
      else{result=await page.evaluate(input=>window.__exportEnemyReference(input),{ship:source.ships.find(item=>item.id===ship.id),referenceSha256:sha(reference)});bytes=Buffer.from(result.base64,'base64');fs.writeFileSync(target,bytes);}
      const observed=inspectGlb(bytes);
      ship.observedClips=observed.clips;
      ship.metricsScope='Base seven motion clips from rigAndAnimate; observedClips lists the actual exported GLB including AmbushReveal when present.';
      Object.assign(ship,{status:'asset-built',sha256:sha(bytes),bytes:bytes.length,pipelineSha256:pipelineSha,metrics:result?.metrics||ship.metrics,artModules:result?.metadata.artModules||ship.artModules,weakpoints:result?.metadata.weakpoints||ship.weakpoints,features:result?.metadata.features||ship.features,referenceNotes:result?.metadata.referenceNotes||ship.referenceNotes,deployRig:result?.metadata.deployRig||ship.deployRig,availableActions:result?.availableActions||ship.availableActions,observedBounds:observed.staticNodeBounds,geometrySignature:observed.observedGeometrySignature,triangles:observed.triangles,verification:'Structure/browser pending; no game damage/AI verification.'});
      catalog.assetCount=catalog.ships.filter(item=>item.status==='asset-built').length;catalog.updatedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
      console.log(JSON.stringify({id:ship.id,bytes:bytes.length,triangles:observed.triangles,weakpoints:ship.weakpoints.length}));
    }
  }finally{await browser.close();}
  const {buildViewers}=require('./viewers.cjs');await buildViewers();
  const {buildGallery}=require('./gallery.cjs');buildGallery();
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
