const fs=require('node:fs'),path=require('node:path');const{pathToFileURL}=require('node:url');
const{repoPath,launchBrowser}=require('../lib/runtime.cjs');
(async()=>{
 const out=repoPath('outputs/fleet-v1'),catalog=JSON.parse(fs.readFileSync(path.join(out,'catalog.json')));
 const only=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(','),ships=only?catalog.ships.filter(s=>only.includes(s.id)):catalog.ships;
 const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});
 try{for(const ship of ships){
  const page=await browser.newPage({viewport:{width:1100,height:950},deviceScaleFactor:1});
  try{await page.goto(pathToFileURL(path.join(out,ship.viewerPath)).href);await page.waitForFunction(()=>window.__rigReady===true||window.__rigStats?.error,null,{timeout:60000});
   await page.evaluate(()=>{const v=window.__rigViewer;v.setPlaying(false);v.setTime(2);v.controls.enableDamping=false;v.reset();document.querySelectorAll('.stage-label,.view-tools,.caption').forEach(e=>e.style.display='none');});
   await page.waitForTimeout(80);await page.locator('#stage').screenshot({path:path.join(out,ship.previewPath)});
   ship.previewSourceSha256=ship.sha256;
   ship.previewCapturedAt=new Date().toISOString();
   fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
   console.log(JSON.stringify({captured:ship.id}));
  }finally{await page.close();}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
