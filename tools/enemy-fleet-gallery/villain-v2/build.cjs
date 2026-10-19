'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-fleet-villain-v2'),work=path.join(root,'work/enemy-fleet-villain-v2');
process.env.NODE_PATH=[path.join(root,'work/combat-vfx-v2/deps/node_modules'),process.env.NODE_PATH].filter(Boolean).join(path.delimiter);Module._initPaths();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const OWNED=['enemy-tax-cutter','mission-union-guard','mission-bridge-tug','mission-guard-scout','mission-cult-purifier','mission-ghost-artillery','role-enemy-artillery','role-enemy-defense','mini-funeral-guard','boss-shipyard-ribs','boss-shipwright-command','boss-last-inhale'];
const REPS=['enemy-tax-cutter','mission-cult-purifier','mission-ghost-artillery','boss-last-inhale'];
async function main(){
 const args=process.argv.slice(2),subset=args.find(a=>a.startsWith('--ids='))?.slice(6).split(',')||REPS;
 if(subset.some(id=>!OWNED.includes(id))||new Set(subset).size!==subset.length)throw Error('Only own12 unique IDs allowed; reference6 and bell boss are read-only');
 const roster=JSON.parse(fs.readFileSync(path.join(root,'outputs/enemy-fleet-gallery-v1/catalog.json'),'utf8')),baseBytes=fs.readFileSync(path.join(root,'outputs/fleet-v2/catalog.json')),base=JSON.parse(baseBytes);
 const scripts=['core.js','industrial.js','cult.js','spectral-works.js','export.js'];
 const pipelineSha256=sha(Buffer.concat(scripts.map(n=>fs.readFileSync(path.join(__dirname,n)))));
 const esbuild=require('esbuild'),bundle=await esbuild.build({entryPoints:[path.join(__dirname,'export.js')],bundle:true,write:false,format:'iife',target:'chrome100',nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)});
 if(!args.includes('--execute')){console.log(JSON.stringify({prepared:true,browser:false,modelsRead:0,ids:subset,ownedCount:12,pipelineSha256,bundleBytes:bundle.outputFiles[0].contents.length}));return;}
 fs.mkdirSync(work,{recursive:true});for(const dir of ['ships','previews'])fs.mkdirSync(path.join(out,dir),{recursive:true});
 fs.writeFileSync(path.join(out,'.gitattributes'),'ships/*.html filter=lfs diff=lfs merge=lfs -text\n');
 const builder=path.join(work,'builder.html');fs.writeFileSync(builder,'<!doctype html><meta charset="utf-8"><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
 const file=path.join(out,'models.json'),prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 const catalog={version:'enemy-villain-2',title:'Cloudstitch · 적선의 과감한 주형태',ownedModelCount:12,productionWhitelist:OWNED,readOnlyReferenceCount:6,readOnlyBoss:'boss-bell-devourer',pipelineSha256,baselineCatalogSha256:sha(baseBytes),artApproval:'PENDING_HUMAN_REVIEW',ships:roster.ships.filter(s=>OWNED.includes(s.id)).map(s=>prior?.ships.find(p=>p.id===s.id)||{...s,status:'source-ready',previousPreviewPath:s.previewPath,previousViewerPath:s.viewerPath,sourceAssetPath:s.assetPath,assetPath:'ships/'+s.id+'.glb',viewerPath:'ships/'+s.id+'.html',previewPath:'previews/'+s.id+'.png'})};
 const {inspectGlb}=await import('../../fleet-v2/verify.mjs');
 const {launchBrowser}=require('../../lib/runtime.cjs'),browser=await launchBrowser({args:['--disable-gpu']});
 try{
  const page=await browser.newPage();await page.goto(require('node:url').pathToFileURL(builder).href);
  await page.evaluate(b64=>window.__initBoldEnemy(b64),fs.readFileSync(path.join(root,'outputs/enemy-fleet-reference-v1/painted-atlas.png')).toString('base64'));
  for(const ship of catalog.ships.filter(s=>subset.includes(s.id))){
   const dest=path.join(out,ship.assetPath),baseline=base.ships.find(s=>s.id===ship.id);
   if(args.includes('--resume')&&ship.pipelineSha256===pipelineSha256&&fs.existsSync(dest)&&ship.sha256===sha(fs.readFileSync(dest)))continue;
   if(fs.existsSync(dest))throw Error('Refusing to overwrite built model; use a new revision: '+ship.id);
   if(sha(fs.readFileSync(path.resolve(root,'outputs/enemy-fleet-gallery-v1',ship.sourceAssetPath)))!==ship.sourceModelSha256)throw Error('Baseline GLB changed: '+ship.id);
   const result=await page.evaluate(input=>window.__exportBoldEnemy(input),{ship,baseline});
   const bytes=Buffer.from(result.base64,'base64'),inspected=inspectGlb(bytes);
   if(inspected.clips.length!==8||!result.threatTargets.length)throw Error('Missing actual animation clips');
   fs.writeFileSync(dest,bytes,{flag:'wx'});
   delete result.base64;Object.assign(ship,{...result,status:'asset-built',pipelineSha256,sha256:sha(bytes),bytes:bytes.length,observedClips:inspected.clips,metrics:{...result.rig,triangles:inspected.triangles},bounds:inspected.staticNodeBounds,geometrySignature:inspected.observedGeometrySignature,visual:'주형태부터 새로 구성한 악당 외형',latest:true,gameplayIntegration:false});
   fs.writeFileSync(file,JSON.stringify(catalog,null,2)+'\n');console.log(JSON.stringify({built:ship.id,bytes:bytes.length,triangles:inspected.triangles,threats:ship.threatTargets.length}));
  }
 }finally{await browser.close();}
 await require('./viewers.cjs').buildViewers();console.log(JSON.stringify({built:catalog.ships.filter(s=>s.status==='asset-built').length,browserClosed:true,referenceSixBuilt:0,bellBossBuilt:0}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
