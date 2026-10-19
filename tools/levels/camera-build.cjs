const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'outputs/playable-camera-v1');
async function main(){
  fs.mkdirSync(output,{recursive:true});
  await esbuild.build({entryPoints:[path.join(__dirname,'camera-ui.js')],outfile:path.join(output,'playable.js'),nodePaths:[path.resolve(path.dirname(require.resolve('three')),'../..')],bundle:true,minify:true,format:'iife',target:['chrome100','safari16'],legalComments:'inline'});
  fs.copyFileSync(path.join(__dirname,'camera-template.html'),path.join(output,'index.html'));
  fs.writeFileSync(path.join(output,'style.css'),fs.readFileSync(path.join(__dirname,'playable-style.css'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'camera-style.css'),'utf8'));
  const paths=['tools/levels/camera-build.cjs','tools/levels/camera-profiles.mjs','tools/levels/camera-renderer.js','tools/levels/camera-ui.js','tools/levels/camera-template.html','tools/levels/camera-style.css','outputs/playable-camera-v1/index.html','outputs/playable-camera-v1/playable.js','outputs/playable-camera-v1/style.css'];
  const files=paths.map(file=>{const b=fs.readFileSync(path.join(root,file));return{path:file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
  fs.writeFileSync(path.join(output,'build-manifest.json'),JSON.stringify({version:1,title:'Cloudstitch',scope:'Three orthographic camera comparisons; existing combat and original playable build preserved',saveKey:'cloudstitch.camera-study.v1',files},null,2)+'\n');
  console.log(JSON.stringify({output:'outputs/playable-camera-v1/index.html',files:files.length}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
