const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
const ROOT=path.resolve(__dirname,'../../..'),OUT=path.join(ROOT,'outputs/combat-vfx-v2/machine-gun-painted-v1'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
function asset(p,mime='model/gltf-binary'){const b=fs.readFileSync(path.join(ROOT,p));return{path:p,bytes:b.length,sha256:hash(b),base64:b.toString('base64'),mime};}
async function main(){
 const ids=new Set(['machine-gun-muzzle','machine-gun-projectile','machine-gun-hit']);
 const effects=read('outputs/combat-vfx/catalog.json').items.filter(i=>ids.has(i.id)).map(i=>({...i,kind:'effect',asset:asset('outputs/combat-vfx/'+i.model)}));
 const sequences=read('outputs/combat-vfx/sequence-catalog.json').items.filter(i=>i.id==='01-machine-gun').map(i=>({...i,kind:'sequence',asset:asset('outputs/combat-vfx/'+i.model)}));
 const textures={atlas:asset('outputs/combat-vfx-v2/machine-gun-painted-v1/textures/painted-vfx-atlas.png','image/png'),metal:asset('outputs/combat-vfx-v2/machine-gun-painted-v1/textures/painted-material-atlas.png','image/png')};
 const data={title:'Cloudstitch',effects,sequences,textures};
 const bundle=await esbuild.build({entryPoints:[path.join(__dirname,'viewer.js')],bundle:true,write:false,minify:true,format:'iife',target:['chrome100','safari16'],nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),legalComments:'inline'});
 const html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8').replace('/* REVIEW_DATA */',()=>('window.__V1_REVIEW_DATA__='+JSON.stringify(data)+';').replace(/<\/script/gi,'<\\/script')).replace('/* REVIEW_BUNDLE */',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
 fs.writeFileSync(path.join(OUT,'index.html'),html);
 const sources=['build.cjs','viewer.js','template.html','painted-effects.js'].map(p=>{const rel='tools/combat-vfx-v2/machine-gun-painted-v1/'+p,b=fs.readFileSync(path.join(ROOT,rel));return{path:rel,bytes:b.length,sha256:hash(b)};});
 const manifest={game_title:'Cloudstitch',date_seoul:'2026-10-18',status:'painted_machine_gun_art_prototype',source_files:sources,original_assets:[...effects,...sequences].map(i=>({id:i.id,...Object.fromEntries(Object.entries(i.asset).filter(([k])=>k!=='base64'))})),textures:Object.fromEntries(Object.entries(textures).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).filter(([k])=>k!=='base64'))])),output:{path:'outputs/combat-vfx-v2/machine-gun-painted-v1/index.html',bytes:Buffer.byteLength(html),sha256:hash(Buffer.from(html))},image_generation:{method:'built-in image_gen',images:2,prompts:'textures/*prompt.json'},meshy_calls:0,gameplay_integrated:false,render_qa:'pending',references:[{purpose:'Weapon style source',path:'outputs/weapon-modules/01-machine-gun/reference.png'},{purpose:'Broad action readability reference; no copied art or scene',url:'https://store.steampowered.com/app/3624140/Wanderburg/'}]};
 fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({output:manifest.output,textures:Object.keys(textures),actual_original_glbs:effects.length+sequences.length,meshy_calls:0}));
}main().catch(e=>{console.error(e.stack);process.exitCode=1;});
