const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-base-v1/dense-r4'),work=path.join(root,'work/enemy-base/dense-r4');
const {launchBrowser}=require('../../lib/runtime.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const esbuild=require('esbuild'),source=path.join(out,'enemy-base.glb'),atlas=fs.readFileSync(path.join(out,'painted-atlas.png'));
 const input=fs.readFileSync(source),old=JSON.parse(fs.readFileSync(path.join(out,'model-manifest.json')));
 const archive=path.join(out,'geometry-baseline');fs.mkdirSync(archive,{recursive:true});
 for(const n of ['enemy-base.glb','model-manifest.json','structure-verification.json'])if(fs.existsSync(path.join(out,n))&&!fs.existsSync(path.join(archive,n)))fs.copyFileSync(path.join(out,n),path.join(archive,n));
 const raw=path.join(root,'work/verification/enemy-base-v1/dense-r4');
 // Geometry is preserved before texturing; only the final textured asset gets browser QA.
 const bundle=await esbuild.build({entryPoints:[path.join(__dirname,'paint-export.js')],bundle:true,write:false,format:'iife',nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)});
 const file=path.join(work,'paint.html');fs.writeFileSync(file,'<!doctype html><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
 const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});let result;
 try{const page=await browser.newPage();await page.goto(pathToFileURL(file).href);result=await page.evaluate(args=>window.paintAsset(args),{model:input.toString('base64'),atlas:atlas.toString('base64')});}finally{await browser.close();}
 const bytes=Buffer.from(result.base64,'base64');fs.writeFileSync(source,bytes);
 const j=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const model={...old.model,bytes:bytes.length,sha256:sha(bytes),textures:j.textures?.length||0,texture_images:j.images?.length||0};
 model.semantic_groups=model.semantic_groups.map(group=>{const node=j.nodes.find(n=>n.name===group.nodeName);let triangles=0,meshes=0;const walk=n=>{if(n.mesh!==undefined){meshes++;for(const p of j.meshes[n.mesh].primitives)triangles+=j.accessors[p.indices??p.attributes.POSITION].count/3;}for(const c of n.children||[])walk(j.nodes[c]);};walk(node);return{...group,triangles,meshes};});
 fs.writeFileSync(path.join(out,'model-manifest.json'),JSON.stringify({...old,model,appearance:{...old.appearance,surfaces:'Embedded existing painted atlas: timber, woven cloth, weathered iron, patinated brass, chipped teal; vertex-painted volume.',atlas:{path:'painted-atlas.png',sha256:sha(atlas),width:result.atlasDimensions[0],height:result.atlasDimensions[1]},painting:'Actual UV texture and matte glTF material, not a rendered overlay.'}},null,2)+'\n');
 console.log(JSON.stringify({bytes:bytes.length,sha256:sha(bytes),textures:model.textures,images:model.texture_images,baseline:sha(input),browserClosed:true}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
