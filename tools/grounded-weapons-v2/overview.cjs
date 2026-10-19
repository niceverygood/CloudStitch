const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {launchBrowser}=require('../lib/runtime.cjs');
const out=path.resolve(__dirname,'../../outputs/grounded-weapons-v2');
async function main(){
 if(!process.argv.includes('--slot-start'))throw new Error('Central browser slot required');
 const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1300},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.join(out,'gallery.html')).href);
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  const cards=await page.locator('article').count();if(cards!==6)throw new Error('Missing cards');
  const links=await page.locator('article a').evaluateAll(a=>a.map(x=>x.getAttribute('href')));
  for(const link of links){const file=decodeURIComponent(link.split('?')[0]);if(!fs.existsSync(path.resolve(out,file)))throw new Error('Missing link '+link);}
  await page.screenshot({path:path.join(out,'overview.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow||errors.length)throw new Error('Gallery overflow/error');
  fs.writeFileSync(path.join(out,'gallery-verification.json'),JSON.stringify({cards,decoded_images:6,checked_card_links:links.length,mobile_width:390,mobile_overflow:overflow,errors,passed:true},null,2)+'\n');
  console.log(JSON.stringify({cards,links:links.length,mobile_overflow:overflow,errors}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
