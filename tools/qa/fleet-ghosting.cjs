const fs=require('node:fs'),path=require('node:path');const{pathToFileURL}=require('node:url');
const crypto=require('node:crypto');
const{repoPath,reportDirectory,launchBrowser}=require('../lib/runtime.cjs');
(async()=>{
 const reportDir=reportDirectory('fleet-ghosting',process.argv[3]),asset=process.argv[2]||'enemy-tax-cutter';
 const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(repoPath(`outputs/fleet-v1/ships/${asset}.html`)).href);await page.waitForFunction(()=>window.__rigReady===true,null,{timeout:60000});
  const results=[];
  for(const mode of ['handdrawn','cel','original'])results.push(await page.evaluate(async mode=>{
   const v=window.__rigViewer;v.setPlaying(false);v.setTime(2);v.reset();v.setMode(mode);v.controls.enableDamping=false;v.controls.autoRotateSpeed=18;
   const frames=n=>new Promise(resolve=>{function tick(){if(--n<=0)resolve();else requestAnimationFrame(tick)}requestAnimationFrame(tick)});
   const capture=()=>{const source=v.renderer.domElement,c=document.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);return ctx.getImageData(0,0,c.width,c.height).data};
   v.setAutoRotate(true);await frames(60);v.setAutoRotate(false);await frames(4);const cameraBefore=v.camera.position.toArray(),before=capture();
   v.renderer.clear(true,true,true);await frames(3);const after=capture();let changedPixels=0,totalChannelDifference=0;
   for(let i=0;i<before.length;i+=4){let changed=false;for(let j=0;j<4;j++){const d=Math.abs(before[i+j]-after[i+j]);totalChannelDifference+=d;if(d)changed=true}if(changed)changedPixels++}
   const cameraAfter=v.camera.position.toArray(),cameraDelta=Math.max(...cameraBefore.map((x,i)=>Math.abs(x-cameraAfter[i])));
   return{mode,rotationFrames:60,changedPixels,totalChannelDifference,cameraDelta,cameraUnchanged:cameraDelta<1e-8,outlineAutoClear:window.__rigStats.outlineAutoClear};
  },mode));
  const modelSha256=crypto.createHash('sha256').update(fs.readFileSync(repoPath(`outputs/fleet-v1/ships/${asset}.glb`))).digest('hex');
  const report={asset,modelSha256,results,errors,passed:!errors.length&&results.every(r=>r.changedPixels===0&&r.cameraUnchanged&&r.outlineAutoClear)};
  fs.writeFileSync(path.join(reportDir,'qa-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
