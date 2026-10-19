const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),integration=path.resolve(process.argv[2]||root);
if(!fs.existsSync(path.join(integration,'tools/integration/session.mjs')))throw Error('Verified integration checkout argument required');
const esbuild=require(path.join(integration,'node_modules/esbuild'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const normalize=file=>path.resolve(file).replaceAll('\\','/').toLowerCase();
const source=relative=>path.join(integration,relative);
const aliases={
 'cloudstitch/renderer':path.join(__dirname,'renderer.mjs'),
 'cloudstitch/base-renderer':source('tools/integration/renderer.js'),
 'cloudstitch/base-contract':source('tools/integration/contract.mjs'),
 'cloudstitch/base-levels':source('tools/levels/levels.mjs'),
 'cloudstitch/sim':source('tools/battlefield/sim.mjs'),
 'cloudstitch/vfx':source('tools/battlefield/vfx.js'),
 'cloudstitch/battlefield-adapter':source('tools/battlefield/integration.mjs'),
 'cloudstitch/encounter-catalog':source('tools/encounters/catalog.json'),
 'cloudstitch/encounter-director':source('tools/encounters/director.mjs'),
 'cloudstitch/attack-intents':source('tools/encounters/attack-intents.mjs'),
 'cloudstitch/attack-budget':source('tools/encounters/attack-budget.mjs'),
 'cloudstitch/retreat-pilot':source('tools/integration/pilot.mjs')
};
const plugin={name:'campaign-readonly-dependencies',setup(build){build.onResolve({filter:/^cloudstitch\//},args=>{if(!aliases[args.path])throw Error(`Unknown alias ${args.path}`);return {path:aliases[args.path]};});}};
async function build(){
 const out=path.join(root,'outputs/voyage-campaign-v1'),work=path.join(root,'work/voyage-campaign');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(work,{recursive:true});
 const common={bundle:true,plugins:[plugin],logLevel:'warning'};
 const result=await esbuild.build({...common,entryPoints:[path.join(__dirname,'entry.js')],outfile:path.join(out,'campaign.js'),format:'iife',minify:true,target:['chrome100','safari16'],metafile:true});
 await esbuild.build({...common,entryPoints:[path.join(__dirname,'qa-driver.mjs')],outfile:path.join(out,'qa-driver.js'),format:'iife',minify:true,target:['chrome100','safari16']});
 await esbuild.build({...common,entryPoints:[path.join(__dirname,'runtime-export.mjs')],outfile:path.join(work,'runtime.mjs'),format:'esm',platform:'node',target:'node22'});
 for(const name of ['template.html','style.css'])fs.copyFileSync(path.join(__dirname,name),path.join(out,name==='template.html'?'index.html':name));
 const files=Object.keys(result.metafile.inputs).map(file=>path.resolve(file)).filter(file=>!file.includes(`${path.sep}node_modules${path.sep}`));
 const integrationPrefix=normalize(integration)+'/';
 const manifest={version:'voyage-campaign-v1',revision:2,saveKey:'cloudstitch.voyage-campaign.v1',previousFailedSourceManifest:'6197d914a5840dad5f600024872060724423e23c9d036dabb33e81a05efa00bb',rendererPolicy:'Own player asset instance corrects offset socket yaw against the real world muzzle. Original GLB frame, collider, damage and shared renderer source stay unchanged.',controllerOrigin:{path:'tools/integration/session.mjs',sha256:sha(source('tools/integration/session.mjs')),policy:'Original preserved. Own derived controller adds saved campaign cursor, atomic return completion and stage transition. Original sim/director remain combat authorities.'},inputs:files.map(file=>({scope:normalize(file).startsWith(integrationPrefix)?'integration':'shared',path:path.relative(normalize(file).startsWith(integrationPrefix)?integration:root,file).replaceAll('\\','/'),sha256:sha(file)})),outputs:['index.html','style.css','campaign.js','qa-driver.js'].map(file=>({path:file,sha256:sha(path.join(out,file)),bytes:fs.statSync(path.join(out,file)).size}))};
 fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`Built outputs/voyage-campaign-v1 (${files.length} source inputs)`);
}
build().catch(error=>{console.error(error);process.exitCode=1});
