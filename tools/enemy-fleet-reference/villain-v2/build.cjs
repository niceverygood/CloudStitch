'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-fleet-reference-v2'),before=path.join(root,'outputs/enemy-fleet-reference-v1'),work=path.join(root,'work/enemy-fleet-reference-v2');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const IDS=['enemy-pirate-scout','enemy-cult-blockade','enemy-union-salvage','enemy-union-repair','enemy-ghost-chaser','enemy-disguised-wreck'];
async function main(){
  if(process.argv.includes('--help')){console.log('node tools/enemy-fleet-reference/villain-v2/build.cjs [--ids=ID,ID] [--resume]');return;}
  const esbuild=require('esbuild'),{launchBrowser}=require('../../lib/runtime.cjs');
  const source=JSON.parse(fs.readFileSync(path.join(root,'tools/fleet/catalog.json'),'utf8')),base=JSON.parse(fs.readFileSync(path.join(before,'catalog.json'),'utf8'));
  const only=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(',')||IDS;if(only.some(id=>!IDS.includes(id)))throw Error('Only six reference enemy IDs are owned here.');
  fs.mkdirSync(work,{recursive:true});for(const dir of ['ships','previews'])fs.mkdirSync(path.join(out,dir),{recursive:true});
  const old=fs.existsSync(path.join(out,'catalog.json'))?JSON.parse(fs.readFileSync(path.join(out,'catalog.json'))):null;
  const atlas=fs.readFileSync(path.join(before,'painted-atlas.png')),reference=fs.readFileSync(path.join(before,'reference.png'));
  const dependencies=['style.js','scout-cult.js','industrial.js','ghost-wreck.js','export.js','../kit.js','../scout-cult.js','../industrial.js','../ghost-wreck.js','../../fleet/rigging.js','../../fleet/body.js'];
  const pipelineSha=sha(Buffer.concat(dependencies.map(p=>fs.readFileSync(path.resolve(__dirname,p))).concat(atlas)));
  const catalog={version:'enemy-reference-villain-2',title:'Cloudstitch · 악당의 얼굴을 가진 여섯 함선',referencePath:'../enemy-fleet-reference-v1/reference.png',referenceSha256:sha(reference),atlasPath:'../enemy-fleet-reference-v1/painted-atlas.png',atlasSha256:sha(atlas),scope:'Six independent reference-derived villain art variants of the same source IDs; original modules and previous versions preserved. Art only; no automatic combat replacement.',newGeneration:{imagegen:0,meshy:0,reusedAtlas:true},ships:IDS.map(id=>{const b=base.ships.find(s=>s.id===id);return old?.ships.find(s=>s.id===id)||{...source.ships.find(s=>s.id===id),status:'planned',variantId:id+'--villain-v2',baseVariantId:id+'--reference-v1',baseModelSha256:b.sha256,beforePreviewPath:'../enemy-fleet-reference-v1/'+b.previewPath,assetPath:'ships/'+id+'.glb',viewerPath:'ships/'+id+'.html',previewPath:'previews/'+id+'.png'};})};
  const nodePaths=(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),bundle=await esbuild.build({entryPoints:[path.join(__dirname,'export.js')],bundle:true,write:false,format:'iife',target:'chrome100',nodePaths});
  const builder=path.join(work,'builder.html');fs.writeFileSync(builder,'<!doctype html><meta charset="utf-8"><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
  const {inspectGlb}=await import('../../fleet-v2/verify.mjs'),browser=await launchBrowser({args:['--disable-gpu']});
  try{
    const page=await browser.newPage();await page.goto(pathToFileURL(builder).href);await page.evaluate(b64=>window.__initEnemyReference(b64),atlas.toString('base64'));
    for(const ship of catalog.ships.filter(s=>only.includes(s.id))){
      const file=path.join(out,ship.assetPath);let bytes,result;
      if(process.argv.includes('--resume')&&ship.pipelineSha256===pipelineSha&&fs.existsSync(file)&&sha(fs.readFileSync(file))===ship.sha256)bytes=fs.readFileSync(file);
      else{result=await page.evaluate(input=>window.__exportEnemyReference(input),{ship:source.ships.find(s=>s.id===ship.id),referenceSha256:catalog.referenceSha256,baseModelSha256:ship.baseModelSha256});bytes=Buffer.from(result.base64,'base64');fs.writeFileSync(file,bytes);}
      const observed=inspectGlb(bytes);
      Object.assign(ship,{status:'asset-built',sha256:sha(bytes),bytes:bytes.length,pipelineSha256:pipelineSha,metrics:result?.metrics||ship.metrics,metricsScope:'Seven base motion statistics; observedClips includes the extra wreck deployment clip.',observedClips:observed.clips,triangles:observed.triangles,geometrySignature:observed.observedGeometrySignature,observedBounds:observed.staticNodeBounds});
      if(result)for(const k of ['artModules','weakpoints','features','referenceNotes','deployRig','villainTheme'])ship[k]=result.metadata[k]||null;
      ship.availableActions=result?.availableActions||ship.availableActions;catalog.updatedAt=new Date().toISOString();catalog.assetCount=catalog.ships.filter(s=>s.status==='asset-built').length;
      fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');console.log(JSON.stringify({id:ship.id,variant:ship.variantId,bytes:ship.bytes,triangles:ship.triangles}));
    }
  }finally{await browser.close();}
  await require('./viewers.cjs').buildViewers();require('./gallery.cjs').buildGallery();
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
