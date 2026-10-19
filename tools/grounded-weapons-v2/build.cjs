const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/grounded-weapons-v2');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
  const catalog=read(path.join(out,'catalog.json'));
  if(catalog.items.length!==6)throw new Error('Expected six actual GLBs');
  const items=catalog.items.map(item=>{const b=fs.readFileSync(path.join(out,item.model));if(sha(b)!==item.sha256)throw new Error('Model changed: '+item.id);return {...item,available:true,asset:{base64:b.toString('base64'),bytes:b.length}};});
  const reference=fs.readFileSync(path.join(root,catalog.reference));if(sha(reference)!==catalog.reference_sha256)throw new Error('Reference changed');
  const payload=JSON.stringify({title:catalog.title,isScene:false,referenceDataURL:'data:image/png;base64,'+reference.toString('base64'),items}).replace(/</g,'\\u003c');
  const result=await require('esbuild').build({entryPoints:[path.join(__dirname,'viewer.js')],bundle:true,write:false,minify:true,format:'iife',target:['chrome100','firefox100','safari16'],nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),legalComments:'inline',define:{__WORLD_DATA__:'window.__GROUNDED_WEAPON_DATA__'}});
  const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
  let html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8').replace(/WORLD_TITLE/g,'비행선 무기 3D 작업대');
  html=html.replace('<script>/* BUNDLED_WORLD */</script>',()=>'<script type="application/json" id="weapon-data">'+payload+'</script><script>window.__GROUNDED_WEAPON_DATA__=JSON.parse(document.getElementById("weapon-data").textContent);'+script+'</script>');
  fs.writeFileSync(path.join(out,'index.html'),html);
  console.log(JSON.stringify({actual_models:items.length,html_bytes:Buffer.byteLength(html),offline:true}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
