const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
async function main(){
  const root=path.resolve(__dirname,'../..'),command=process.argv[2]||'inspect';
  const entries={inspect:'inspect.mjs',export:'export.mjs'};
  if(!entries[command])throw new Error('Use inspect or export');
  const outfile=path.join(root,'work/grounded-weapons-v1',command+'.mjs');fs.mkdirSync(path.dirname(outfile),{recursive:true});
  await require('esbuild').build({entryPoints:[path.join(__dirname,entries[command])],outfile,bundle:true,format:'esm',platform:'node',target:'node20',nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),logLevel:'warning'});
  if(process.argv.includes('--bundle-only')){console.log(JSON.stringify({bundle:path.relative(root,outfile),exported:false}));return;}
  const args=process.argv.slice(3);if(command==='inspect')args.push('--inspect');
  const result=spawnSync(process.execPath,[outfile,...args],{cwd:root,env:process.env,stdio:'inherit'});if(result.error)throw result.error;process.exitCode=result.status??1;
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
