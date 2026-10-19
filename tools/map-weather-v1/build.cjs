// No installation, network, or shared source mutation. Central QA runs this.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'outputs/map-weather-v1');
const deps=process.env.CLOUDSTITCH_NODE_MODULES;const resolve=name=>require.resolve(name,{paths:[deps||ROOT,ROOT]});
async function main(){
 const esbuild=require(resolve('esbuild'));fs.mkdirSync(OUT,{recursive:true});
 const shipPath=path.join(ROOT,'outputs/selected-airship-toon3d/airship.glb'),bytes=fs.readFileSync(shipPath);if(bytes.readUInt32LE(0)!==0x46546c67)throw Error('Ship must be an actual GLB');
 const result=await esbuild.build({entryPoints:[path.join(__dirname,'app.js')],bundle:true,write:false,minify:true,format:'iife',target:['chrome110','safari16.4'],nodePaths:deps?[deps]:[],define:{__SHIP_BASE64__:JSON.stringify(zlib.gzipSync(bytes,{level:9}).toString('base64'))},metafile:true});
 const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'),css=fs.readFileSync(path.join(__dirname,'style.css'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8').replace('/* WEATHER_STYLE */',()=>css).replace('/* WEATHER_APP */',()=>script);fs.writeFileSync(path.join(OUT,'index.html'),html);
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');const paths=[...new Set([...Object.keys(result.metafile.inputs).map(p=>path.resolve(ROOT,p)),path.join(__dirname,'template.html'),path.join(__dirname,'style.css'),shipPath])];
 const files=paths.map(p=>{const b=fs.readFileSync(p),portable=p.replace(/\\/g,'/'),packagePath=portable.split('/node_modules/')[1];return{path:packagePath?'dependency:'+packagePath:path.relative(ROOT,p).replace(/\\/g,'/'),bytes:b.length,sha256:sha(b)};});
 fs.writeFileSync(path.join(OUT,'build-manifest.json'),JSON.stringify({revision:'map-weather-v1',date:'2026-10-18',output:'outputs/map-weather-v1/index.html',bytes:Buffer.byteLength(html),sha256:sha(Buffer.from(html)),offlineEmbeddedShip:true,stateAuthority:'battlefield opt-in environment authority',files},null,2)+'\n');
 console.log(JSON.stringify({output:'outputs/map-weather-v1/index.html',bytes:Buffer.byteLength(html),inputs:files.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
