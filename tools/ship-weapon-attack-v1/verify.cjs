const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {launchBrowser}=require('../lib/runtime.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/ship-weapon-attack-v1'),qa=path.join(out,process.env.ATTACK_QA_REVISION||'qa-r1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 if(!process.argv.includes('--slot-start'))throw Error('Explicit coordinator START required');
 fs.mkdirSync(qa,{recursive:true});const report={checks:[],screenshots:[],mixes:[],errors:[],requests:[],browserClosed:false};
 const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});if(!pass)throw Error(name)};
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'build-manifest.json')));
 let browser;
 try{
  browser=await launchBrowser();const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.requests.push(r.url())});
  await page.goto(pathToFileURL(path.join(out,'index.html')).href);await page.waitForFunction(()=>window.__attack?.ready||window.__attack?.error,{},{timeout:60000});
  check('real GLB runtime ready',await page.evaluate(()=>window.__attack.ready),await page.evaluate(()=>window.__attack.error));
  for(const [b,count,launch,hit]of[['mobility',3,.8,1.25],['artillery',3,.9,1.55],['salvage',1,.95,1.65]]){
   await page.evaluate(b=>window.__attack.select(b),b);
   const stats=await page.evaluate(t=>{window.__attack.seek(t);return window.__attack.stats()},launch+.08);
   check(b+' actual groups and coupled recoil',stats.left.actualProjectileGroups===count&&stats.right.actualProjectileGroups===count&&Math.abs(stats.right.mechanismRecoil)>0&&Math.abs(stats.right.hullRecoil)>0,stats);
   check(b+' synchronized world origins',JSON.stringify(stats.left.launchOrigins)===JSON.stringify(stats.right.launchOrigins));
   for(const [phase,t]of[['launch',launch+.11],['impact',hit+.09],['recovery',3.1]]){
    await page.evaluate(t=>window.__attack.seek(t),t);await page.screenshot({path:path.join(qa,b+'-'+phase+'.png')});report.screenshots.push(b+'-'+phase+'.png');
   }
   const end=await page.evaluate(()=>{window.__attack.seek(2.5);return window.__attack.stats()});
   check(b+' all swept plane hits',end.left.hits.length===count&&end.right.hits.length===count&&end.left.finite&&end.right.finite,end);
   if(b==='salvage')check('harpoon cable after contact',end.right.cableSegmentsVisible===14);
   for(const mode of['painted','cel','original']){await page.evaluate(m=>window.__attack.setMode(m),mode);check(b+' '+mode+' renders',await page.evaluate(()=>window.__attack.stats().mode)===mode)}
   await page.evaluate(()=>window.__attack.setMode('painted'));
  }
  await page.evaluate(()=>window.__attack.setMode('painted'));
  await page.click('#unlock');check('user gesture unlock audio',await page.evaluate(()=>window.__attack.audio.stats.unlocked));
  await page.click('#fire');await page.waitForTimeout(1700);const live=await page.evaluate(()=>window.__attack.stats());
  check('live audio schedules matching events',live.audio.history.filter(e=>e.type==='scheduled').length>=4,live.audio);
  for(const [reason,code]of[['pause',()=>window.__attack.pause()],['seek',()=>window.__attack.seek(.4)]]){await page.evaluate(code);check(reason+' cancels all cue reservations',await page.evaluate(()=>window.__attack.audio.stats.active)===0)}
  await page.click('#fire');await page.selectOption('#audio-variant','basic');const v=await page.evaluate(()=>window.__attack.audio.stats);
  check('variant cancels then schedules one side',v.variant==='basic'&&v.history.filter(e=>e.type==='scheduled'&&e.epoch===v.generation).every(e=>e.variant==='basic'),v);
  await page.check('#mute');check('mute cancels audio',await page.evaluate(()=>window.__attack.audio.stats.active)===0);await page.evaluate(()=>window.__attack.pause());await page.uncheck('#mute');
  await page.click('#fire');await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden});
  check('synthetic hidden handler pauses and cancels',await page.evaluate(()=>!window.__attack.stats().playing&&window.__attack.audio.stats.active===0));
  await page.check('#reduced');await page.evaluate(()=>window.__attack.seek(1.1));check('reduced motion disables ship roll',await page.evaluate(()=>window.__attack.library.get(window.__attack.stats().branch).rigs.every(r=>r.body.rotation.z===0)));await page.uncheck('#reduced');
  await page.uncheck('#fx');check('effects control',await page.evaluate(()=>!window.__attack.stats().effects));await page.check('#fx');
  for(const b of['mobility','artillery','salvage'])for(const variant of['basic','enhanced']){
   const result=await page.evaluate(async([b,v])=>window.__attack.renderMix(b,v),[b,variant]);
   const file=b+'-'+variant+'-6s.wav';fs.writeFileSync(path.join(qa,file),Buffer.from(result.base64,'base64'));report.mixes.push({file,...result.stats});
   check(file+' finite headroom and event mapping',result.stats.finite&&!result.stats.clipping&&result.stats.frames===264600&&result.stats.events.length===(b==='salvage'?4:10),result.stats);
  }
  const download=page.waitForEvent('download');await page.click('#wav');const dl=await download;await dl.saveAs(path.join(qa,'download-'+dl.suggestedFilename()));check('actual WAV download',fs.statSync(path.join(qa,'download-'+dl.suggestedFilename())).size===1058444);
  const record=page.waitForEvent('download');await page.click('#record');const rd=await record;await rd.saveAs(path.join(qa,'download-record.json'));check('actual event record download',JSON.parse(fs.readFileSync(path.join(qa,'download-record.json'))).events.length>0);
  await page.evaluate(async()=>{window.__attack.seek(5.95);await window.__attack.play(false)});await page.waitForTimeout(300);check('ends once without loop or pending cue',await page.evaluate(()=>{const s=window.__attack.stats();return s.time===6&&!s.playing&&s.audio.active===0}));
  for(const mode of['painted','cel','original']){const same=await page.evaluate(m=>{const a=window.__attack;a.select('artillery');a.setMode(m);a.seek(1.64);for(let j=0;j<3;j++)a.render();const before=a.renderer.domElement.toDataURL();for(let i=0;i<240;i++)a.render();return before===a.renderer.domElement.toDataURL()},mode);check(mode+' 240 static frames no accumulated trails',same)}
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{window.__attack.select('artillery');window.__attack.seek(1.64)});await page.screenshot({path:path.join(qa,'mobile390.png'),fullPage:true});check('mobile no document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check('OutlineEffect autoClear explicit',await page.evaluate(()=>window.__attack.effect.autoClear===true));check('no external request',report.requests.length===0,report.requests);check('no JS errors',report.errors.length===0,report.errors);
 }catch(e){report.failure=e.stack;process.exitCode=1}
 finally{if(browser){await browser.close();report.browserClosed=true}report.originals=manifest.sources.map(s=>({path:s.path,preserved:sha(fs.readFileSync(path.join(root,s.path)))===s.sha256}));report.passed=!report.failure&&report.originals.every(s=>s.preserved);fs.writeFileSync(path.join(qa,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,browserClosed:report.browserClosed,failure:report.failure,originals:report.originals.length}));}
}
main().catch(e=>{console.error(e);process.exitCode=1});
