const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),esbuild=require('esbuild');
const ROOT=path.resolve(__dirname,'../../..'),OUT=path.join(ROOT,'outputs/ship-states-v1/evolution30'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const source='outputs/selected-airship-toon3d/airship.glb',model=fs.readFileSync(path.join(ROOT,source));
 if(sha(model)!=='dae35b13806d553a8b124d502a81d7dff58c183a266db25efc0d9a060198ce74')throw Error('Selected source changed');
 const bundle=await esbuild.build({entryPoints:[path.join(__dirname,'viewer.js')],bundle:true,write:false,minify:true,format:'iife',target:['chrome100','safari16'],nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)});
 const data={model:model.toString('base64'),source,sourceSha256:sha(model),sourceBytes:model.length};
 const html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8').replace('/* STATE_DATA */',()=>('window.__SHIP_STATE_DATA__='+JSON.stringify(data)+';').replace(/<\/script/gi,'<\\/script')).replace('/* STATE_BUNDLE */',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
 const scope={module:{exports:{}}};scope.exports=scope.module.exports;vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.join(__dirname,'catalog.js'),'utf8'),{format:'cjs'}).code,scope);const {LEVELS}=scope.module.exports;
 fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'index.html'),html);
 fs.writeFileSync(path.join(OUT,'catalog.json'),JSON.stringify({title:'Cloudstitch',levels:LEVELS.map(l=>({...l,category:'e'+l.epoch,stage:(l.level-1)%5,view:`index.html?category=e${l.epoch}&stage=${(l.level-1)%5}`})),actualGameLevelRules:false},null,2)+'\n');
 const files=['catalog.js','variants.js','viewer.js','template.html','build.cjs'].map(f=>{const p='tools/ship-states/evolution30/'+f,b=fs.readFileSync(path.join(ROOT,p));return{path:p,bytes:b.length,sha256:sha(b)};});
 const readonly=['tools/ship-states/variants.js','tools/airship-rig/part-map.json',source,'outputs/ship-states-v1/index.html','outputs/ship-states-v1/delivery-manifest.json'].map(p=>{const b=fs.readFileSync(path.join(ROOT,p));return{path:p,bytes:b.length,sha256:sha(b)};});
 const m={title:'Cloudstitch',scope:'Lv1–30 cumulative visual evolution study',logicalLevels:30,epochs:6,wholeRootScale:1,gameplayOrSaveChanged:false,paidGenerationCalls:0,ownedPaths:['tools/ship-states/evolution30/','outputs/ship-states-v1/evolution30/'],sources:files,readOnly:readonly,output:{path:'outputs/ship-states-v1/evolution30/index.html',bytes:Buffer.byteLength(html),sha256:sha(Buffer.from(html))},browserVerified:false};
 fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify(m.output));
}main().catch(e=>{console.error(e);process.exitCode=1;});
