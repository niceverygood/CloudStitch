const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {launchBrowser}=require('../lib/runtime.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/weapon-review-v2');
const assert=(ok,s)=>{if(!ok)throw new Error(s)};
async function main(){
 const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[],requests=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});page.on('requestfailed',r=>failed.push(r.url()));
 const report={passed:false,errors,externalRequests:requests,failedRequests:failed};
 try{
  await page.goto(pathToFileURL(path.join(out,'index.html')).href);
  await page.waitForFunction(()=>window.__weaponReview?.count===24&&[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  assert(await page.locator('article').count()===24,'Initial cards');report.cards=24;report.images=24;
  const catalog=JSON.parse(fs.readFileSync(path.join(out,'catalog.json'),'utf8'));
  let links=0;for(const item of catalog.items)for(const key of['preview','original_preview','reference','viewer','model','source_catalog']){const p=decodeURIComponent(item[key].split('?')[0]);assert(fs.existsSync(path.resolve(out,p)),'Missing '+item.id+'/'+key);links++;}report.localTargets=links;
  await page.click('[data-group="classic"]');assert(await page.locator('article').count()===6,'Classic filter');
  await page.click('[data-group="new"]');assert(await page.locator('article').count()===12,'New filter');
  await page.click('[data-group="extra"]');assert(await page.locator('article').count()===6,'Extra filter');
  await page.click('[data-group="new"]');
  await page.selectOption('#category','방어');assert(await page.locator('article').count()===1,'Defense filter');
  await page.selectOption('#category','all');await page.click('[data-group="all"]');
  await page.fill('#search','작살');assert(await page.locator('article').count()===2,'Harpoon search');
  await page.locator('[data-select]').nth(0).check();await page.locator('[data-select]').nth(1).check();await page.click('#compare');
  assert(await page.locator('#comparison').isVisible(),'Comparison dialog');assert(await page.locator('.comparegrid section').count()===2,'Two comparison panels');
  await page.screenshot({path:path.join(out,'comparison-preview.png'),fullPage:false});await page.click('[data-close="comparison"]');
  await page.fill('#search','');await page.locator('.picture').first().click();
  await page.selectOption('#note-status','change');await page.fill('#note','검수용 메모');await page.click('[data-close="detail"]');
  await page.selectOption('#reviewfilter','change');assert(await page.locator('article').count()===1,'Review filter');
  const downloadPromise=page.waitForEvent('download');await page.click('#export');const downloaded=await downloadPromise;const exportData=JSON.parse(fs.readFileSync(await downloaded.path(),'utf8'));assert(exportData.items.length===24&&exportData.items[0].note==='검수용 메모','Export notes');
  // Leave the delivered review with no test notes or selected comparisons.
  await page.evaluate(()=>localStorage.removeItem('cloudstitch-weapon-review-v1'));await page.reload();await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  await page.screenshot({path:path.join(out,'overview.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  report.mobile=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth}));assert(!report.mobile.overflow,'Mobile overflow');
  await page.locator('.picture').first().click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Dialog overflow');await page.click('[data-close="detail"]');
  await page.screenshot({path:path.join(out,'mobile-preview.png'),fullPage:false});
  report.filters={classic:6,new:12,defense:1,searchHarpoon:2,reviewStatus:true};report.comparisonPanels=2;report.notesExport=true;
  assert(!errors.length&&!requests.length&&!failed.length,'Browser errors/requests');report.passed=true;
 }catch(e){report.failure=e.message;process.exitCode=1;await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
 finally{await browser.close();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
