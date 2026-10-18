const fs=require('node:fs'),path=require('node:path');const{repoPath,launchBrowser}=require('../lib/runtime.cjs');
(async()=>{
 const out=repoPath('outputs/encounters-v1'),catalog=JSON.parse(fs.readFileSync(path.join(out,'catalog.json'))),browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});
 try{const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
  await page.goto(process.env.CLOUDSTITCH_PREVIEW_URL||'http://127.0.0.1:59306/outputs/encounters-v1/index.html');await page.waitForFunction(()=>window.__encountersReady,null,{timeout:60000});await page.evaluate(()=>window.__encounters.setAutoStep(false));
  const capture=async(id,phase,file)=>{await page.evaluate(({id,phase})=>{const a=window.__encounters;a.startStage(id);const clear=()=>{for(const e of a.getState().enemies)a.defeatEnemy(e.id);a.step(1/60)};if(phase!=='opening')clear();if(phase==='finalboss'){clear();a.continue();clear();}a.step(1.7);},{id,phase});await page.waitForFunction(()=>window.__encounterStats.ready&&window.__encounterStats.loading===0,null,{timeout:60000});await page.waitForTimeout(80);await page.screenshot({path:path.join(out,file),fullPage:true});console.log(JSON.stringify({captured:file,stage:id,phase}));};
  await capture(catalog.stages[0].id,'opening','preview-battle.png');await capture(catalog.stages[0].id,'finalboss','preview-boss.png');await capture(catalog.stages.at(-1).id,'finalboss','preview-palace.png');
  await page.setViewportSize({width:390,height:844});await capture(catalog.stages[1].id,'midboss','preview-mobile.png');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
