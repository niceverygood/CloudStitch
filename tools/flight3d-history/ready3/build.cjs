const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'outputs/flight3d-v1');
async function main(){
 fs.mkdirSync(output,{recursive:true});
 await esbuild.build({entryPoints:[path.join(__dirname,'app.js')],outfile:path.join(output,'flight.js'),nodePaths:[path.resolve(path.dirname(require.resolve('three')),'../..')],bundle:true,minify:true,format:'iife',target:['chrome100','safari16'],legalComments:'inline'});
 for(const [source,target]of [['template.html','index.html'],['style.css','style.css']])fs.copyFileSync(path.join(__dirname,source),path.join(output,target));
 const inputs=['tools/battlefield/assets.js',...fs.readdirSync(__dirname).filter(n=>/\.(?:js|mjs|cjs|html|css)$/.test(n)).map(n=>'tools/flight3d/'+n)],outputs=['index.html','flight.js','style.css'].map(n=>'outputs/flight3d-v1/'+n);
 const files=[...inputs,...outputs].map(p=>{const b=fs.readFileSync(path.join(root,p));return{path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
 fs.writeFileSync(path.join(output,'build-manifest.json'),JSON.stringify({version:3,title:'Cloudstitch',scope:'Ship-relative XYZ helm with inertial motion and damped display buoyancy',stateOwner:'tools/flight3d/sim.mjs',controls:{throttle:'W/S',rudder:'A/D',altitude:'Q/E',brake:'Space'},persistentSave:false,sharedFleetAssets:true,files},null,2)+'\n');console.log(JSON.stringify({output:'outputs/flight3d-v1/index.html',files:files.length}));
}main().catch(e=>{console.error(e);process.exitCode=1;});
