'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {launchBrowser}=require('../../lib/runtime.cjs');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-fleet-villain-v1');
(async()=>{
 const browser=await launchBrowser(),report={pageErrors:[],externalRequests:[],files:[]};
 try{
  const page=await browser.newPage({viewport:{width:1800,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.externalRequests.push(r.url());});
  await page.goto(pathToFileURL(path.join(out,'index.html')).href+'?sheet=1');
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('#cards img')].map(i=>i.decode())));
  if(await page.locator('#cards article').count()!==19)throw Error('Expected new 19 enemy visuals');
  await page.screenshot({path:path.join(out,'overview.png'),fullPage:true});report.files.push('overview.png');
  await page.setViewportSize({width:1440,height:1000});await page.goto(pathToFileURL(path.join(out,'index.html')).href);
  await page.locator('#toggle-compare').click();await page.locator('#left-select').selectOption('mission-ghost-artillery');await page.locator('#right-select').selectOption('mission-ghost-artillery');
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('#compare-panel img')].map(i=>i.decode())));
  await page.screenshot({path:path.join(out,'before-after.png'),fullPage:false});report.files.push('before-after.png');
  await page.setViewportSize({width:390,height:844});const mobile=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));report.mobile=mobile;
  report.passed=!report.pageErrors.length&&!report.externalRequests.length&&mobile.documentWidth<=mobile.viewport+1;
 }finally{await browser.close();fs.writeFileSync(path.join(out,'capture-gallery.json'),JSON.stringify(report,null,2)+'\n');}
 if(!report.passed)throw Error('Gallery capture/mobile failed');
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
