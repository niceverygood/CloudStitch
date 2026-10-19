// Run only inside the approved central browser slot; captures actual GLB pixels.
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {launchBrowser}=require('../lib/runtime.cjs');
const sharp=require('sharp');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/grounded-weapons-v1');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const frames=(page,n=3)=>page.evaluate(n=>new Promise(resolve=>{function tick(){if(--n<=0)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);}),n);
async function main(){
  if(!process.argv.includes('--slot-start'))throw new Error('Central browser slot START required');
  const catalog=read(path.join(out,'catalog.json')),browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const results=[];fs.mkdirSync(path.join(out,'previews'),{recursive:true});
  try{
    await page.goto(pathToFileURL(path.join(out,'index.html')).href);
    await page.waitForFunction(()=>window.__worldReady,null,{timeout:90000});
    for(const item of catalog.items){
      await page.evaluate(async id=>{const w=window.__worldWorkbench;await w.selectAsset(id);w.setAutoRotate(false);w.setMode('handdrawn');w.controls.enableDamping=false;w.reset();},item.id);
      await frames(page,4);
      const data=await page.evaluate(()=>window.__worldWorkbench.renderer.domElement.toDataURL('image/png'));
      await sharp(Buffer.from(data.split(',')[1],'base64')).trim({threshold:0}).extend({top:28,bottom:28,left:28,right:28,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(out,item.preview));
      const stats=await page.evaluate(()=>({id:window.__worldStats.selectedId,meshes:window.__worldStats.meshCount,triangles:window.__worldStats.triangleCount}));
      results.push({...stats,preview:item.preview});
      if(['02-deck-greatbow','07-folding-shield','09-side-circular-saw'].includes(item.id)){
        await page.evaluate(()=>window.__worldWorkbench.setView('back'));await frames(page,3);
        const back=await page.evaluate(()=>window.__worldWorkbench.renderer.domElement.toDataURL('image/png'));
        await sharp(Buffer.from(back.split(',')[1],'base64')).trim({threshold:0}).extend({top:28,bottom:28,left:28,right:28,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(out,'previews',item.id+'-back.png'));
      }
      console.log(JSON.stringify({captured:item.id}));
    }
    await page.evaluate(async()=>{await window.__worldWorkbench.selectAsset('01-capacitor-tower');window.__worldWorkbench.reset();});await frames(page,3);
    await page.screenshot({path:path.join(out,'workbench-preview.png'),fullPage:true});
    fs.writeFileSync(path.join(out,'capture-verification.json'),JSON.stringify({actual_GLTFLoader_models:results.length,source:'actual WebGL canvas; no generated-image substitution',errors,results,passed:results.length===12&&!errors.length},null,2)+'\n');
  }finally{await browser.close();}
  if(errors.length)throw new Error(errors.join('\n'));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
