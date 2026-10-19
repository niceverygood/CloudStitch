/* Offline v1 art review. Reads originals and the battlefield's immutable rich profiles. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
const ROOT=path.resolve(__dirname,'../../..'),OUT=path.join(ROOT,'outputs/combat-vfx-v2/v1-review');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function asset(relative){const b=fs.readFileSync(path.join(ROOT,relative));if(b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(8)!==b.length)throw Error('GLB required: '+relative);const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());if([...(j.images||[]),...(j.buffers||[])].some(r=>r.uri&&!r.uri.startsWith('data:')))throw Error('External resource: '+relative);return{path:relative,bytes:b.length,sha256:sha(b),base64:b.toString('base64')};}
async function main(){
 const effects=read('outputs/combat-vfx/catalog.json').items.map(i=>({...i,kind:'effect',asset:asset('outputs/combat-vfx/'+i.model)}));
 const sequences=read('outputs/combat-vfx/sequence-catalog.json').items.map(i=>({...i,kind:'sequence',asset:asset('outputs/combat-vfx/'+i.model)}));
 const data={title:'Cloudstitch',effects,sequences};
 const bundle=await esbuild.build({entryPoints:[path.join(__dirname,'viewer.js')],bundle:true,write:false,minify:true,format:'iife',target:['chrome100','safari16'],nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),legalComments:'inline'});
 const html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8').replace('/* REVIEW_DATA */',()=>('window.__V1_REVIEW_DATA__='+JSON.stringify(data)+';').replace(/<\/script/gi,'<\\/script')).replace('/* REVIEW_BUNDLE */',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
 fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'index.html'),html);
 const sources=['tools/combat-vfx-v2/review-v1/build.cjs','tools/combat-vfx-v2/review-v1/viewer.js','tools/combat-vfx-v2/review-v1/template.html','tools/battlefield/vfx-rich-profiles.mjs'].map(p=>{const b=fs.readFileSync(path.join(ROOT,p));return{path:p,bytes:b.length,sha256:sha(b),read_only:p.startsWith('tools/battlefield/')};});
 const manifest={game_title:'Cloudstitch',purpose:'Attack/impact v1 original and rich art review',effects:effects.length,sequences:sequences.length,asset_version:'v1',source_files:sources,original_assets:[...effects,...sequences].map(i=>({id:i.id,...Object.fromEntries(Object.entries(i.asset).filter(([k])=>k!=='base64'))})),output:{path:'outputs/combat-vfx-v2/v1-review/index.html',bytes:Buffer.byteLength(html),sha256:sha(Buffer.from(html))},offline:true,paid_calls:0,gameplay_collision:false,art_approved:false,browser_verified:false};
 fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({output:manifest.output,effects:effects.length,sequences:sequences.length,offline:true,paid_calls:0}));
}main().catch(e=>{console.error(e.stack);process.exitCode=1;});
