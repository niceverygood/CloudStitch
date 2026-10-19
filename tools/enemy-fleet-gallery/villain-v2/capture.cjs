'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const {launchBrowser}=require('../../lib/runtime.cjs');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-fleet-villain-v2'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const catalog=JSON.parse(fs.readFileSync(path.join(out,'models.json'),'utf8')),only=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(',');
 const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});
 const report={scope:'Only own12 new models. Reference6 and bell boss read-only. Actual still renders, not gameplay QA.',models:[],pageErrors:[],externalRequests:[]};
 try{
  const page=await browser.newPage({viewport:{width:1100,height:950},deviceScaleFactor:1,reducedMotion:'reduce'});
  page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.externalRequests.push(r.url());});
  for(const s of catalog.ships.filter(s=>s.status==='asset-built'&&(!only||only.includes(s.id)))){
   await page.goto(pathToFileURL(path.join(out,s.viewerPath)).href);
   await page.waitForFunction(()=>window.__rigReady||window.__rigStats?.error,null,{timeout:60000});
   const loaded=await page.evaluate(()=>{if(window.__rigStats.error)throw Error(window.__rigStats.error);const v=window.__rigViewer;v.setPlaying(false);v.setAutoRotate(false);v.setComparison(false);v.setSilhouette(false);v.setMode('handdrawn');v.setTime(0);v.controls.enableDamping=false;v.reset();document.querySelectorAll('.stage-label,.view-tools,.caption').forEach(e=>e.style.display='none');return window.__rigStats;});
   await page.waitForTimeout(120);await page.locator('#stage').screenshot({path:path.join(out,s.previewPath)});
   await page.evaluate(()=>window.__rigViewer.setSilhouette(true));await page.waitForTimeout(80);
   s.silhouettePath='previews/'+s.id+'-silhouette.png';await page.locator('#stage').screenshot({path:path.join(out,s.silhouettePath)});
   s.previewSourceSha256=s.sha256;s.previewSha256=sha(fs.readFileSync(path.join(out,s.previewPath)));
   report.models.push({id:s.id,sourceSha256:s.sha256,previewSha256:s.previewSha256,stats:loaded});
   fs.writeFileSync(path.join(out,'models.json'),JSON.stringify(catalog,null,2)+'\n');console.log(JSON.stringify({captured:s.id}));
  }
  report.passed=report.models.length>0&&!report.pageErrors.length&&!report.externalRequests.length;
 }finally{await browser.close();fs.writeFileSync(path.join(out,'capture-models.json'),JSON.stringify(report,null,2)+'\n');}
 if(!report.passed)throw Error('Model capture failed');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
