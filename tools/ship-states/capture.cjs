const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {repoPath,launchBrowser}=require('../lib/runtime.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const html=repoPath('outputs/ship-states-v1/index.html'),out=repoPath('outputs/ship-states-v1');
 const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});const errors=[],requests=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>window.__shipStates?.ready,null,{timeout:90000});
  const bottom=await page.locator('.overview-card').evaluateAll(cards=>Math.max(...cards.map(c=>c.getBoundingClientRect().bottom+scrollY)));
  await page.screenshot({path:path.join(out,'overview.png'),clip:{x:0,y:0,width:1440,height:Math.ceil(bottom+24)}});
  const image=await page.locator('[data-overview-image="explosion"]').evaluate(img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const a=ctx.getImageData(0,0,c.width,c.height).data;let warm=0,visible=0;for(let i=0;i<a.length;i+=4){if(a[i+3]>20){visible++;if(a[i]>150&&a[i]>a[i+1]*1.2&&a[i+1]>a[i+2]*1.15)warm++;}}return{width:c.width,height:c.height,warmFirePixels:warm,visiblePixels:visible};});
  const report={scope:'Final thumbnail transparent-outline fix only; animation/export/mobile evidence remains on prior frozen HTML. Warm-color count is diagnostic; art is inspected visually.',viewerSha256:sha(fs.readFileSync(html)),overviewSha256:sha(fs.readFileSync(path.join(out,'overview.png'))),image,errors,externalRequests:requests.filter(u=>/^https?:/i.test(u)),passed:errors.length===0&&requests.every(u=>!/^https?:/i.test(u))&&image.width>0&&image.visiblePixels>100};
  fs.writeFileSync(path.join(out,'capture-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
