const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/voyage-spatial-v1');
const record=file=>{const b=fs.readFileSync(file);return{path:path.relative(root,file).replaceAll('\\','/'),bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};};
const source=JSON.parse(fs.readFileSync(path.join(out,'source-manifest.json')));
for(const item of source.outputs){const now=record(path.join(out,item.path));if(now.bytes!==item.bytes||now.sha256!==item.sha256)throw Error('Output changed after build: '+item.path);}
const provenance=JSON.parse(fs.readFileSync(path.join(__dirname,'provenance.json')));
for(const entry of provenance.flightSources){const now=record(path.join(root,entry.target));if(now.sha256!==entry.sha256||now.bytes!==entry.bytes)throw Error('Frozen source changed: '+entry.target);}
fs.copyFileSync(path.join(__dirname,'HANDOFF.md'),path.join(out,'README.md'));
const sources=fs.readdirSync(__dirname,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>record(path.join(e.parentPath||e.path,e.name))).sort((a,b)=>a.path.localeCompare(b.path));
const files=fs.readdirSync(out).filter(n=>n!=='delivery-manifest.json').map(n=>record(path.join(out,n))).sort((a,b)=>a.path.localeCompare(b.path));
fs.writeFileSync(path.join(out,'delivery-manifest.json'),JSON.stringify({status:'SOURCE_READY',revision:5,productRevision:3,previousDelivery:'68959b63375f65b770aed36eedaa6ab39954c925eac75a3f51c8eadac14ba96b',preserved:['work/voyage-spatial/history/r3','work/voyage-spatial/history/r4'],change:'Reset behind the displayed harbor craft, not its stale returned sim heading. Whole-map orbit pivot/distance fix retained. Controller/sim/save unchanged.',scope:'Perspective six-region placement with existing sequential campaign save',browserQA:'Prepared 12-check native harness; not yet run',files,sources},null,2)+'\n');
console.log(JSON.stringify({ready:true,outputs:files.length,sources:sources.length}));
