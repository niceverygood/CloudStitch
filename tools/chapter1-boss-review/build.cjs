const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),work=path.join(root,'work/chapter1-boss-review'),out=path.join(root,'outputs/chapter1-boss-review-v1');
(async()=>{fs.mkdirSync(work,{recursive:true});const common={bundle:true,nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),logLevel:'warning'};
await esbuild.build({...common,entryPoints:[path.join(__dirname,'generate.mjs')],outfile:path.join(work,'generator.mjs'),platform:'node',format:'esm'});
const bundle=await esbuild.build({...common,entryPoints:[path.join(__dirname,'review.js')],write:false,format:'iife',platform:'browser',minify:true});
if(process.argv.includes('--prepare')){console.log('SOURCE BUNDLED; no exporter/browser');return;}
if(!process.argv.includes('--execute'))throw Error('Use --prepare or coordinated --execute');
const run=spawnSync(process.execPath,[path.join(work,'generator.mjs')],{cwd:root,env:process.env,stdio:'inherit'});if(run.status!==0)throw Error('GLB export failed');
const html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8').replace('__REFERENCE_DATA__','data:image/png;base64,'+fs.readFileSync(path.join(root,'outputs/chapter1-final-boss-moodboard-v1/moodboard.png')).toString('base64')).replace('__BASELINE_BASE64__',fs.readFileSync(path.join(root,'outputs/fleet-v2/ships/boss-bell-devourer.glb')).toString('base64')).replace('__GLB_BASE64__',fs.readFileSync(path.join(out,'boss.glb')).toString('base64')).replace('__BUNDLE__',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
fs.writeFileSync(path.join(out,'index.html'),html);console.log(JSON.stringify({path:'outputs/chapter1-boss-review-v1/index.html',bytes:Buffer.byteLength(html)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
