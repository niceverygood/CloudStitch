const fs=require('fs'),path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-base-v1/chapter2-r1'),work=path.join(root,'work/enemy-base/chapter2-r1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const source=path.join(out,'enemy-base.glb'),input=fs.readFileSync(source),old=JSON.parse(fs.readFileSync(path.join(out,'model-manifest.json')));
 const archive=path.join(out,'surface-baseline');fs.mkdirSync(archive,{recursive:true});
 for(const n of ['enemy-base.glb','model-manifest.json']){if(fs.existsSync(path.join(archive,n)))throw Error('Do not overwrite frozen geometry');fs.copyFileSync(path.join(out,n),path.join(archive,n));}
 const bundle=await require('esbuild').build({entryPoints:[path.join(__dirname,'paint-export.js')],bundle:true,write:false,format:'iife',nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)});
 const file=path.join(work,'paint.html');fs.writeFileSync(file,'<!doctype html><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
 const browser=await require('../../lib/runtime.cjs').launchBrowser({args:['--enable-unsafe-swiftshader']});let result;
 try{const page=await browser.newPage();await page.goto(pathToFileURL(file).href);result=await page.evaluate(args=>window.paintAsset(args),{model:input.toString('base64')});}finally{await browser.close();}
 const b=Buffer.from(result.base64,'base64'),atlas=Buffer.from(result.atlas,'base64');fs.writeFileSync(source,b);fs.writeFileSync(path.join(out,'painted-atlas.png'),atlas);
 const json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 const model={...old.model,bytes:b.length,sha256:sha(b),textures:json.textures.length,texture_images:json.images.length};
 fs.writeFileSync(path.join(out,'model-manifest.json'),JSON.stringify({...old,model,appearance:{...old.appearance,surfaces:'Original coloured vertex painting plus one embedded 1024x1024 procedural hand-painted nacre/bone/coral/fibre atlas.',atlas:{path:'painted-atlas.png',bytes:atlas.length,sha256:sha(atlas),width:1024,height:1024},textureSource:'Deterministic canvas drawing, seed91843; no API image generation, no chapter-one textures.'}},null,2)+'\n');
 console.log(JSON.stringify({bytes:b.length,sha256:sha(b),textures:1,images:1,browserClosed:true}));
}main().catch(e=>{console.error(e.stack);process.exitCode=1;});
