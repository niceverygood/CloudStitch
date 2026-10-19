const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/ship-weapon-harmony-v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const contractPath='docs/SHIP_WEAPON_MOUNTING.json',contract=JSON.parse(fs.readFileSync(path.join(root,contractPath),'utf8'));
 const weapons={mobility:'outputs/grounded-weapons-v1/assets/03-repeating-crossbow.glb',artillery:'outputs/grounded-weapons-v2/assets/13-comet-rocket-rack.glb',salvage:'outputs/grounded-weapons-v1/assets/04-harpoon-winch.glb'};
 const source=[];const bytes={},delivery=[];
 for(const branch of contract.branches){
  const ship=contract.shipBaseline+branch+'-r5.glb',weapon=weapons[branch];
  const a=fs.readFileSync(path.join(root,ship)),b=fs.readFileSync(path.join(root,weapon));
  for(const [p,data]of[[ship,a],[weapon,b]]){if(data.subarray(0,4).toString()!=='glTF')throw new Error('Not actual GLB: '+p);source.push({path:p,bytes:data.length,sha256:sha(data)});}
  bytes[branch]={ship:a.toString('base64'),weapon:b.toString('base64')};
  const combined=path.join(out,branch+'-assembled.glb');if(fs.existsSync(combined)){const data=fs.readFileSync(combined);bytes[branch].assembled=data.toString('base64');delivery.push({id:branch,path:branch+'-assembled.glb',bytes:data.length,sha256:sha(data)});}
 }
 const payload=JSON.stringify({contract,bytes,source,delivery}).replace(/</g,'\\u003c');
 const bundle=await require('esbuild').build({entryPoints:[path.join(__dirname,'viewer.js')],bundle:true,write:false,minify:true,format:'iife',target:['chrome100'],nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),define:{__HARMONY_DATA__:'window.__HARMONY_PAYLOAD__'}});
 const html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8').replace('/* HARMONY_APP */',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')).replace('/* HARMONY_DATA */',()=>payload);
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),html);fs.writeFileSync(path.join(out,'build-manifest.json'),JSON.stringify({date:'2026-10-19',contract:{path:contractPath,sha256:sha(fs.readFileSync(path.join(root,contractPath)))},sources:source,delivery,viewer_sha256:sha(Buffer.from(html))},null,2)+'\n');
 console.log(JSON.stringify({source_files:source.length,exported_glbs_embedded:delivery.length,html_bytes:Buffer.byteLength(html)}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
