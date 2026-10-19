const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),esbuild=require('esbuild');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'outputs/ship-states-v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const relative='outputs/selected-airship-toon3d/airship.glb',model=fs.readFileSync(path.join(ROOT,relative));
 const map=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/airship-rig/part-map.json'),'utf8'));
 if(model.readUInt32LE(0)!==0x46546c67||sha(model)!==map.sourceSha256)throw Error('Selected source GLB does not match preserved part map.');
 const bundle=await esbuild.build({entryPoints:[path.join(__dirname,'viewer.js')],bundle:true,write:false,minify:true,format:'iife',target:['chrome100','safari16'],nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),legalComments:'inline'});
 const data={model:model.toString('base64'),source:relative,sourceSha256:sha(model),sourceBytes:model.length};
 const html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8').replace('/* STATE_DATA */',()=>('window.__SHIP_STATE_DATA__='+JSON.stringify(data)+';').replace(/<\/script/gi,'<\\/script')).replace('/* STATE_BUNDLE */',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
 fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'index.html'),html);
 const sources=['catalog.js','variants.js','viewer.js','template.html','build.cjs'].map(file=>{const p='tools/ship-states/'+file,b=fs.readFileSync(path.join(ROOT,p));return{path:p,bytes:b.length,sha256:sha(b)};});
 const scope={module:{exports:{}}};scope.exports=scope.module.exports;vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.join(__dirname,'catalog.js'),'utf8'),{format:'cjs'}).code,scope);
 const {CATEGORIES,EXPLOSION_TIMES}=scope.module.exports;
 const catalog={title:'Cloudstitch',revision:1,scope:'Visual appearance and authored animation study',items:CATEGORIES.flatMap(c=>c.stages.map((s,i)=>({id:c.id==='growth'?`growth-lv${String(i+1).padStart(2,'0')}`:`${c.id}-${String(i).padStart(2,'0')}`,category:c.id,categoryName:c.name,stage:i,name:s[0],description:s[1],representativeTime:c.id==='explosion'?EXPLOSION_TIMES[i]:c.id==='normal'?1.1:0,view:`index.html?category=${c.id}&stage=${i}`})))};
 fs.writeFileSync(path.join(OUT,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
 const manifest={title:'Cloudstitch',purpose:'주인공 함선 6항목·31개 외형 단계 및 에너지 0 폭발 시각 시제품',source:{path:relative,bytes:model.length,sha256:sha(model),triangles:11026},readOnlyDependencies:[relative,'tools/airship-rig/part-map.json'],preservedSource:true,offline:true,categories:Object.fromEntries(CATEGORIES.map(c=>[c.id,c.stages.length])),total:catalog.items.length,sources,output:{path:'outputs/ship-states-v1/index.html',bytes:Buffer.byteLength(html),sha256:sha(Buffer.from(html))},paidGenerationCalls:0,gameplayImplemented:false,engineShadersExported:false,browserVerified:false};
 fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({output:manifest.output,total:31,offline:true}));
}main().catch(e=>{console.error(e);process.exitCode=1;});
