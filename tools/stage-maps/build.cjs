const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),integration=path.resolve(process.argv[2]||root);
const controller=path.join(integration,'tools/integration/session.mjs');
if(!fs.existsSync(controller))throw Error('Verified integration checkout argument required: node tools/stage-maps/build.cjs INTEGRATION_ROOT');
const esbuild=require(path.join(integration,'node_modules/esbuild'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const normalize=file=>path.resolve(file).replaceAll('\\','/').toLowerCase();
const aliases={
 'cloudstitch/controller':controller,
 'cloudstitch/renderer':path.join(__dirname,'renderer-bridge.mjs'),
 'cloudstitch/base-renderer':path.join(integration,'tools/integration/renderer.js'),
 'cloudstitch/base-contract':path.join(integration,'tools/integration/contract.mjs'),
 'cloudstitch/base-levels':path.join(integration,'tools/levels/levels.mjs'),
 'cloudstitch/sim':path.join(integration,'tools/battlefield/sim.mjs'),
 'cloudstitch/vfx':path.join(integration,'tools/battlefield/vfx.js'),
 'cloudstitch/pilot':path.join(integration,'tools/integration/pilot.mjs')
};
const plugin={name:'stage-map-controller-imports',setup(build){
 build.onResolve({filter:/^cloudstitch\//},args=>({path:aliases[args.path]||(()=>{throw Error(`Unknown alias ${args.path}`)})()}));
 build.onResolve({filter:/^(\.\/contract\.mjs|\.\.\/levels\/levels\.mjs)$/},args=>{
  if(normalize(args.importer)!==normalize(controller))return;
  return {path:path.join(__dirname,args.path==='./contract.mjs'?'contract-bridge.mjs':'levels-bridge.mjs')};
 });
}};
async function build(){
 const out=path.join(root,'outputs/stage-maps-v1'),work=path.join(root,'work/stage-maps');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(work,{recursive:true});
 const common={bundle:true,plugins:[plugin],logLevel:'warning'};
 const result=await esbuild.build({...common,entryPoints:[path.join(__dirname,'entry.js')],outfile:path.join(out,'stage-maps.js'),format:'iife',minify:true,target:['chrome100','safari16'],metafile:true});
 await esbuild.build({...common,entryPoints:[path.join(__dirname,'runtime-export.mjs')],outfile:path.join(work,'runtime.mjs'),format:'esm',platform:'node',target:'node22'});
 for(const name of ['template.html','style.css'])fs.copyFileSync(path.join(__dirname,name),path.join(out,name==='template.html'?'index.html':name));
 const files=Object.keys(result.metafile.inputs).map(file=>path.resolve(file)).filter(file=>!file.includes(`${path.sep}node_modules${path.sep}`));
 const manifest={version:'stage-maps-v1',routeVersion:1,controllerPolicy:'Original controller source preserved; only its contract and levels imports are redirected in this bundle.',rendererPolicy:'Original renderer source preserved; own presentation bridge uses its reset API when enemy IDs disappear to clear stale connector markers and labels.',interceptedImports:['tools/integration/session.mjs -> ./contract.mjs','tools/integration/session.mjs -> ../levels/levels.mjs'],inputs:files.map(file=>({scope:normalize(file).startsWith(normalize(integration)+'/')?'integration':'stage-maps',path:path.relative(normalize(file).startsWith(normalize(integration)+'/')?integration:root,file).replaceAll('\\','/'),sha256:sha(file)})),outputs:['index.html','style.css','stage-maps.js'].map(file=>({path:file,sha256:sha(path.join(out,file)),bytes:fs.statSync(path.join(out,file)).size}))};
 fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`Built outputs/stage-maps-v1 (${manifest.inputs.length} source inputs)`);
}
build().catch(error=>{console.error(error);process.exitCode=1});
