'use strict';
const fs = require('node:fs'), path = require('node:path');
const {pathToFileURL} = require('node:url');
const {launchBrowser} = require('../lib/runtime.cjs');
const root = path.resolve(__dirname,'../..'), out = path.join(root,'outputs/enemy-fleet-gallery-v1');
(async()=>{
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({viewport:{width:1800,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
    const errors=[], external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
    await page.goto(pathToFileURL(path.join(out,'index.html')).href+'?sheet=1');
    await page.evaluate(()=>Promise.all([...document.querySelectorAll('#cards img')].map(i=>i.decode())));
    const count=await page.locator('#cards article').count();
    if(count!==19)throw Error('Expected all 19 enemy entries');
    await page.screenshot({path:path.join(out,'overview.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(pathToFileURL(path.join(out,'index.html')).href);
    await page.evaluate(()=>Promise.all([...document.querySelectorAll('#cards img')].map(i=>i.decode())));
    await page.screenshot({path:path.join(out,'gallery-preview.png'),fullPage:true});
    await page.locator('#toggle-compare').click();
    await page.evaluate(()=>Promise.all([...document.querySelectorAll('#compare-panel img')].map(i=>i.decode())));
    await page.screenshot({path:path.join(out,'comparison-preview.png'),fullPage:false});
    if(errors.length||external.length)throw Error(JSON.stringify({errors,external}));
    fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify({count,source:'Existing GLB renders; no AI generation',offlineFileProtocol:true,pageErrors:errors,externalRequests:external,files:['overview.png','gallery-preview.png','comparison-preview.png']},null,2)+'\n');
    console.log(JSON.stringify({captured:3,count,offlineFileProtocol:true}));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
