const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');const{repoPath}=require('../lib/paths.cjs');
(async()=>{
 const out=repoPath('outputs/encounters-v1');fs.mkdirSync(out,{recursive:true});
 const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'catalog.json'))),fleet=JSON.parse(fs.readFileSync(repoPath('outputs/fleet-v1/catalog.json'))),ids=[...new Set(['player-homeward',...catalog.stages.flatMap(s=>[...s.opening,...s.late,s.midBoss,s.finalBoss].map(u=>u.assetId))])];
 const assets=ids.map(id=>{const asset=fleet.ships.find(s=>s.id===id);if(!asset||!fs.existsSync(repoPath('outputs/fleet-v1/'+asset.assetPath)))throw new Error('Missing fleet asset '+id);return{id,path:'../fleet-v1/'+asset.assetPath,bytes:asset.bytes,sha256:asset.sha256}});
 const result=await esbuild.build({entryPoints:[path.join(__dirname,'app.js')],bundle:true,minify:true,write:false,format:'iife',target:['chrome100','safari16']});
 const template=fs.readFileSync(path.join(__dirname,'template.html'),'utf8');fs.writeFileSync(path.join(out,'index.html'),template.replace('/* BUNDLED_ENCOUNTERS */',()=>result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')));
 fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({title:'Cloudstitch',version:'encounters-v1',stageCount:catalog.stages.length,bossCount:catalog.stages.length*2,normalSpawns:catalog.stages.reduce((n,s)=>n+[...s.opening,...s.late].reduce((sum,u)=>sum+u.count,0),0),assets,indexSha256:sha(fs.readFileSync(path.join(out,'index.html'))),scope:catalog.scopeNote,requires:'Local HTTP server from repository root; fleet GLBs remain separate and local.',verification:{passed:false,status:'pending'}},null,2)+'\n');
 console.log(JSON.stringify({stages:catalog.stages.length,bosses:catalog.stages.length*2,assets:assets.length,output:'outputs/encounters-v1/index.html'}));
})().catch(e=>{console.error(e);process.exitCode=1});
