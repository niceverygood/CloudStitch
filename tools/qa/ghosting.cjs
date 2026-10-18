const path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {repoPath,reportDirectory,launchBrowser}=require('../lib/runtime.cjs');
const reportDir=reportDirectory('ghosting',process.argv[3]);
(async()=>{
 const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1100,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(repoPath(process.argv[2] || 'outputs/selected-airship-toon3d/viewer-v2.html')).href);
 await page.waitForFunction(()=>window.__toonReady===true,null,{timeout:45000});
 const results=[];
 for(const mode of ['handdrawn','cel','original']){
  const result=await page.evaluate(async(mode)=>{
   const v=window.__toonViewer;v.reset();v.setMode(mode);v.controls.enableDamping=false;v.controls.autoRotateSpeed=18;
   const frames=n=>new Promise(resolve=>{function tick(){if(--n<=0)resolve();else requestAnimationFrame(tick)}requestAnimationFrame(tick)});
   const capture=()=>{const source=v.renderer.domElement;const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);return ctx.getImageData(0,0,c.width,c.height).data};
   v.setAutoRotate(true);await frames(120);v.setAutoRotate(false);await frames(4);
   const cameraBefore=v.camera.position.toArray(),before=capture();
   v.renderer.clear(true,true,true);await frames(3);
   const after=capture();let changedPixels=0,totalChannelDifference=0;
   for(let i=0;i<before.length;i+=4){let changed=false;for(let j=0;j<4;j++){const d=Math.abs(before[i+j]-after[i+j]);totalChannelDifference+=d;if(d)changed=true}if(changed)changedPixels++}
   const cameraAfter=v.camera.position.toArray();const cameraDelta=Math.max(...cameraBefore.map((x,i)=>Math.abs(x-cameraAfter[i])));
   return {mode,rotationFrames:120,changedPixels,totalChannelDifference,cameraDelta,cameraUnchanged:cameraDelta<1e-8,pixelCount:before.length/4};
  },mode);
  results.push(result);await page.screenshot({path:path.join(reportDir,`ghosting-fixed-${mode}.png`)});
 }
 const report={results,errors,passed:errors.length===0&&results.every(r=>r.changedPixels===0&&r.cameraUnchanged)};
 fs.writeFileSync(path.join(reportDir,'qa-ghosting-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 await browser.close();if(!report.passed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
