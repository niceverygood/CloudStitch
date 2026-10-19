const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),integration=path.resolve(process.argv[2]||root);
const esbuild=require(path.join(integration,'node_modules/esbuild'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const src=relative=>path.join(integration,relative),normalized=value=>path.resolve(value).replaceAll('\\','/').toLowerCase();
const aliases={
 'cloudstitch/renderer':path.join(__dirname,'renderer.mjs'),
 'cloudstitch/base-renderer':path.join(__dirname,'base-renderer.js'),
 'cloudstitch/ship-assets':src('tools/battlefield/assets.js'),
 'cloudstitch/base-contract':src('tools/integration/contract.mjs'),
 'cloudstitch/base-levels':src('tools/levels/levels.mjs'),
 'cloudstitch/sim':src('tools/battlefield/sim.mjs'),
 'cloudstitch/vfx':src('tools/battlefield/vfx.js'),
 'cloudstitch/battlefield-adapter':src('tools/battlefield/integration.mjs'),
 'cloudstitch/encounter-catalog':src('tools/encounters/catalog.json'),
 'cloudstitch/encounter-director':src('tools/encounters/director.mjs'),
 'cloudstitch/attack-intents':src('tools/encounters/attack-intents.mjs'),
 'cloudstitch/attack-budget':src('tools/encounters/attack-budget.mjs'),
 'cloudstitch/retreat-pilot':src('tools/integration/pilot.mjs')
};
const plugin={name:'spatial-readonly-dependencies',setup(build){build.onResolve({filter:/^cloudstitch\//},args=>{if(!aliases[args.path])throw Error('Unknown alias '+args.path);return{path:aliases[args.path]};});}};
(async()=>{
 const output=path.join(root,'outputs/voyage-spatial-v1');fs.mkdirSync(output,{recursive:true});
 const common={bundle:true,minify:true,format:'iife',target:['chrome100','safari16'],plugins:[plugin],nodePaths:[path.join(integration,'node_modules')],logLevel:'warning'};
 const result=await esbuild.build({...common,entryPoints:[path.join(__dirname,'app.js')],outfile:path.join(output,'spatial.js'),metafile:true});
 await esbuild.build({...common,entryPoints:[path.join(root,'tools/voyage-campaign/qa-driver.mjs')],outfile:path.join(output,'qa-driver.js')});
 fs.copyFileSync(path.join(__dirname,'template.html'),path.join(output,'index.html'));fs.copyFileSync(path.join(__dirname,'style.css'),path.join(output,'style.css'));
 const inputFiles=Object.keys(result.metafile.inputs).map(p=>path.resolve(p)).filter(p=>!p.includes(`${path.sep}node_modules${path.sep}`));
 const report={version:'voyage-spatial-v1',revision:3,saveKey:'cloudstitch.voyage-campaign.v1',frame:{worldEqualsLocalXZ:true,yUp:true,flightY:0},
  stateOwner:'unchanged tools/voyage-campaign/session.mjs → verified battlefield/sim.mjs',
  policy:'Perspective camera and world scenery only. No second flight state, flight app or RAF. Flight camera module only consumes frozen distance/sweep math.',
  sources:inputFiles.map(file=>{const base=normalized(file).startsWith(normalized(integration)+'/')?integration:root;return{scope:base===integration?'integration':'shared',path:path.relative(base,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:sha(file)};}),
  outputs:['index.html','style.css','spatial.js','qa-driver.js'].map(name=>({path:name,bytes:fs.statSync(path.join(output,name)).size,sha256:sha(path.join(output,name))}))};
 fs.writeFileSync(path.join(output,'source-manifest.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({built:'outputs/voyage-spatial-v1/',inputs:inputFiles.length}));
})().catch(error=>{console.error(error);process.exitCode=1});
