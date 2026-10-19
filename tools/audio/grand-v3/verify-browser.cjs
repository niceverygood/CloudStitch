/* Sequential integration-owner QA only; this script does not install, serve or generate audio.
 * node tools/audio/grand-v3/verify-browser.cjs --playwright-root <path> --channel chrome
 *   --url http://127.0.0.1:8840/outputs/audio-grand-v3/ --out outputs/audio-grand-v3-browser-qa-v1
 * Optional: --headed --executable-path <browser>. Use a separate QA output folder.
 */
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const args=process.argv.slice(2),root=path.resolve(__dirname,'../../..');
const option=(name,fallback)=>{const i=args.indexOf(name),equal=args.find(a=>a.startsWith(name+'='));return i>=0?args[i+1]:equal?equal.slice(name.length+1):fallback;};
const url=option('--url','http://127.0.0.1:8840/outputs/audio-grand-v3/');
const out=path.resolve(option('--out',path.join(root,'outputs/audio-grand-v3-browser-qa-v1')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(target,folder)=>{const relative=path.relative(folder,target);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
if(['tools/audio','outputs/audio-rich-v1','outputs/audio-rich-v2','outputs/audio-grand-v3'].some(p=>inside(out,path.join(root,p))))throw new Error('--out must be outside source and frozen delivery folders.');
function loadPlaywright(){const requested=option('--playwright-path',option('--playwright-root',null));if(!requested)return require('playwright');const resolved=path.resolve(requested);for(const candidate of [resolved,path.join(resolved,'playwright'),path.join(resolved,'node_modules/playwright')]){try{return require(candidate);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}throw new Error('Playwright path not found; no installation attempted.');}
async function snapshot(){
  const manifestPath='outputs/audio-grand-v3/delivery-manifest.json',manifest=JSON.parse(await fs.readFile(path.join(root,manifestPath),'utf8')),catalog=JSON.parse(await fs.readFile(path.join(root,'outputs/audio-grand-v3/catalog.json'),'utf8'));
  const files={},paths=[manifestPath,...manifest.files.map(row=>row.path),...catalog.assets.map(a=>a.source.originalRelative)];
  for(const relative of [...new Set(paths)].sort()){if(typeof relative!=='string')throw new Error('Missing manifest/source path');const full=path.resolve(root,relative);if(!inside(full,root))throw new Error('Protected path outside repository');const bytes=await fs.readFile(full);files[relative]={bytes:bytes.length,sha256:hash(bytes)};}return files;
}
async function run(){
  const checks=[],consoleErrors=[],pageErrors=[],httpErrors=[],externalRequests=[],failedRequests=[];
  let browser,context,page,catalog,inspection,pairInspection,catalogSha256,before;
  const report={schema:'cloudstitch-audio-grand-browser-qa/v3',startedAt:new Date().toISOString(),url,harnessSha256:hash(await fs.readFile(__filename)),scope:'Focused grand-v3 regression: previous body-v2 WAV versus newly processed grand-v3 WAV, 49 pairs. Reuses the existing player engine; does not repeat the broad v1/v2 suite.',humanListening:'Not performed. Native numeric/UI checks do not approve timbre, bass amount, headphones or audible cue identification.',gameplayInstalled:false,checks};
  // Failed or interrupted runs are evidence too. Require a new/empty destination
  // instead of overwriting an earlier report, screenshot or raw request record.
  try{if((await fs.readdir(out)).length)throw new Error('--out is not empty. Choose a fresh QA folder; previous evidence was preserved.');}catch(error){if(error.code!=='ENOENT')throw error;}
  await fs.mkdir(out,{recursive:true});
  async function check(name,task){try{const details=await task();checks.push({name,passed:true,...(details===undefined?{}:{details})});}catch(error){checks.push({name,passed:false,error:error.message});try{await page?.evaluate(()=>window.__audioRich?.stopAll('QA failure cleanup'));}catch{/* Keep original failure. */}}}
  try{
    before=await snapshot();
    const {chromium}=loadPlaywright(),launch={headless:!args.includes('--headed')};
    const channel=option('--channel',null),executablePath=option('--executable-path',null);if(channel)launch.channel=channel;if(executablePath)launch.executablePath=executablePath;
    browser=await chromium.launch(launch);context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});page=await context.newPage();page.setDefaultTimeout(15000);
    const origin=new URL(url).origin;
    page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});page.on('pageerror',error=>pageErrors.push(error.message));
    page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
    page.on('response',response=>{if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status()});});
    await page.route('**/*',route=>{const address=route.request().url();if(/^https?:/.test(address)&&new URL(address).origin!==origin){externalRequests.push(address);return route.abort();}return route.continue();});
    await check('load: 49 WAV pairs, gesture gate and no backlog',async()=>{
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__audioRich?.getCatalog()?.assets?.length===49,null,{timeout:30000});
      const response=await context.request.get(new URL('catalog.json',url).href);assert.equal(response.ok(),true);const bytes=await response.body();catalogSha256=hash(bytes);catalog=JSON.parse(bytes);
      assert.equal(catalog.assets.length,49);assert.equal(await page.locator('#asset-list .asset-row').count(),49);assert.equal(new Set(catalog.assets.map(a=>a.id)).size,49);assert.ok(catalog.assets.every(a=>a.file.endsWith('.wav')&&a.source.file.endsWith('.wav')));
      const locked=await page.evaluate(()=>window.__audioRich.debug);assert.equal(locked.contextState,'locked');assert.equal(locked.createdSources,0);await page.locator('#unlock').click();await page.waitForFunction(()=>window.__audioRich.debug.contextState==='running');assert.equal(await page.evaluate(()=>window.__audioRich.debug.createdSources),0);
    });
    await check('98 native WAV decodes: finite PCM, duration and peak',async()=>{
      inspection=await page.evaluate(()=>window.__audioRich.inspectAll({release:true}));assert.equal(inspection.cancelled,false);assert.equal(inspection.results.length,98);
      assert.ok(inspection.results.every(row=>row.status==='decoded'&&row.finite&&row.frames>0&&row.sampleRate>0&&row.duration>0&&row.rms>0&&row.peak<.99));
      for(const row of inspection.results){const asset=catalog.assets.find(a=>a.id===row.id),expected=row.mode==='original'?asset.metrics?.source:asset.metrics?.output;if(Number.isFinite(expected?.duration))assert.ok(Math.abs(row.duration-expected.duration)<.003,`${row.id}:${row.mode} differs from its own catalog duration`);}
      const d=await page.evaluate(()=>window.__audioRich.debug);assert.equal(d.cacheCount,0);assert.equal(d.createdSources,0);
      return {files:98,maxNativePeak:Math.max(...inspection.results.map(row=>row.peak)),sampleRatePolicy:'Native device resampling is allowed; no fixed 44100-Hz assertion. Peak ceiling .99 allows native interpolation above file PCM ceilings.'};
    });
    await check('49 pair comparisons: equal RMS and normalized peak at most .8',async()=>{
      pairInspection=await page.evaluate(async rows=>{const {pairNormalization}=await import(new URL('../../tools/audio/grand-v3/review.mjs',location.href).href);const pairs=[];for(const asset of window.__audioRich.getCatalog().assets){const original=rows.find(r=>r.id===asset.id&&r.mode==='original'),enhanced=rows.find(r=>r.id===asset.id&&r.mode==='enhanced'),levels=pairNormalization(original,enhanced,true);pairs.push({id:asset.id,originalPeak:original.peak*levels.original,enhancedPeak:enhanced.peak*levels.enhanced,originalRms:original.rms*levels.original,enhancedRms:enhanced.rms*levels.enhanced,targetRms:levels.targetRms});}return pairs;},inspection.results);
      assert.equal(pairInspection.length,49);for(const pair of pairInspection){assert.ok(pair.originalPeak<=.8000001&&pair.enhancedPeak<=.8000001,pair.id);assert.ok(Math.abs(pair.originalRms-pair.enhancedRms)<1e-9,pair.id);}
      return {pairs:49,maxNormalizedPeak:Math.max(...pairInspection.flatMap(p=>[p.originalPeak,p.enhancedPeak]))};
    });
    await check('grand-v3 labels, independent notes namespace and WAV downloads',async()=>{
      await page.locator('#asset-list .asset-row[data-asset-id="fire-machinegun"]').click();assert.ok((await page.locator('#play-original').textContent()).includes('이전 중저음 v2'));assert.ok((await page.locator('#play-enhanced').textContent()).includes('웅장·극적 v3'));
      for(const id of ['download-original','download-enhanced']){assert.ok((await page.locator('#'+id).getAttribute('href')).endsWith('.wav'));assert.ok((await page.locator('#'+id).getAttribute('download')).endsWith('.wav'));}
      await page.locator('#note').fill('NATIVE QA FIXTURE · grand-v3 namespace 확인, 사람 청취 판정 아님');const storage=await page.evaluate(()=>({keys:Object.keys(localStorage),schema:window.__audioRich.debug.notes.schema}));assert.equal(storage.schema,'cloudstitch-audio-grand-review/v3');assert.ok(storage.keys.some(key=>key.startsWith('cloudstitch:audio-grand:v3:')));assert.ok(storage.keys.every(key=>!key.startsWith('cloudstitch:audio-rich:')));
    });
    await check('machinegun previous/new one-shots and two-step A/B finish cleanly',async()=>{
      for(const button of ['play-original','play-enhanced']){const count=await page.evaluate(()=>window.__audioRich.debug.createdSources);await page.locator('#'+button).click();await page.waitForFunction(n=>window.__audioRich.debug.createdSources===n+1,count);assert.equal(await page.evaluate(()=>window.__audioRich.whenIdle(15000)),true);const idle=await page.evaluate(()=>window.__audioRich.debug);assert.equal(idle.voices.length,0);assert.equal(idle.releaseCount,0);}
      const count=await page.evaluate(()=>window.__audioRich.debug.createdSources);await page.locator('#compare-ab').click();await page.waitForFunction(n=>!window.__audioRich.debug.compareActive&&window.__audioRich.debug.createdSources===n+2,count,{timeout:20000});assert.equal(await page.evaluate(()=>window.__audioRich.whenIdle(1000)),true);
    });
    await check('mono loop stops with 5ms release and complete graph cleanup',async()=>{
      await page.locator('#mono').check();await page.locator('#repeat').check();await page.locator('#play-enhanced').click();await page.waitForFunction(()=>window.__audioRich.debug.voices.length===1);assert.equal(await page.evaluate(()=>window.__audioRich.debug.voices[0].channels),1);
      const stopped=await page.evaluate(async()=>{window.__audioRich.stopAll('native grand-v3 release test');const immediate=window.__audioRich.debug,idle=await window.__audioRich.whenIdle(1000);return {immediate,idle,final:window.__audioRich.debug};});assert.equal(stopped.immediate.voices.length,0);assert.equal(stopped.immediate.releaseCount,1);assert.ok(stopped.immediate.releasing.every(v=>v.fadeMs===5));assert.equal(stopped.idle,true);assert.equal(stopped.final.releaseCount,0);assert.equal(stopped.final.voices.length,0);await page.locator('#repeat').uncheck();await page.locator('#mono').uncheck();return {immediateActive:0,immediateRelease:stopped.immediate.releaseCount,finalRelease:stopped.final.releaseCount};
    });
    await check('grand-v3 three-cue playback starts three native sources then stops cleanly',async()=>{
      const count=await page.evaluate(()=>window.__audioRich.debug.createdSources);await page.locator('#play-three').click();await page.waitForFunction(n=>window.__audioRich.debug.createdSources>=n+3,count);await page.waitForTimeout(80);
      const playing=await page.evaluate(()=>window.__audioRich.debug);assert.equal(playing.createdSources-count,3);assert.ok(playing.voices.length<=3);assert.ok(playing.voices.every(v=>v.mode==='enhanced'&&v.level===.36));
      const stopped=await page.evaluate(async()=>{window.__audioRich.stopAll('native grand-v3 three-cue cleanup');const idle=await window.__audioRich.whenIdle(1000);return {idle,debug:window.__audioRich.debug};});assert.equal(stopped.idle,true);assert.equal(stopped.debug.voices.length,0);assert.equal(stopped.debug.releaseCount,0);assert.equal(stopped.debug.pending,0);
      return {createdSources:3,activeLimit:3,activeAtObservation:playing.voices.length,perCueLevel:.36,afterStopActive:0,afterStopReleasing:0,audibleIdentification:'Not tested. Three native sources do not establish human ability to identify all cues.'};
    });
    await check('desktop/mobile presentation and 390-pixel overflow',async()=>{
      await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);const sizes=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(sizes.document<=sizes.viewport&&sizes.body<=sizes.viewport);await page.screenshot({path:path.join(out,'mobile-390.png'),fullPage:true});return sizes;
    });
    await check('no page/console/HTTP/external errors; raw failures preserved',async()=>{
      assert.equal(pageErrors.length,0,JSON.stringify(pageErrors));assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));assert.equal(httpErrors.length,0,JSON.stringify(httpErrors));assert.equal(externalRequests.length,0,JSON.stringify(externalRequests));const unexpected=failedRequests.filter(row=>!row.error?.includes('ERR_ABORTED'));assert.equal(unexpected.length,0,JSON.stringify(unexpected));return {rawFailedRequests:failedRequests.length,expectedAbortCount:failedRequests.length-unexpected.length};
    });
    await check('explicit player dispose completes before browser teardown',async()=>{
      await page.evaluate(()=>window.__audioRich.dispose());const d=await page.evaluate(()=>window.__audioRich.debug);assert.equal(d.disposed,true);assert.equal(d.voices.length,0);assert.equal(d.releaseCount,0);assert.equal(d.cacheCount,0);assert.equal(d.pending,0);return {disposed:d.disposed,contextState:d.contextState};
    });
  }catch(error){checks.push({name:'harness setup/execution',passed:false,error:error.stack||error.message});}
  finally{
    try{await context?.close();}catch(error){checks.push({name:'context teardown',passed:false,error:error.message});}
    try{await browser?.close();}catch(error){checks.push({name:'browser teardown',passed:false,error:error.message});}
    if(before){try{const after=await snapshot();assert.deepEqual(after,before);checks.push({name:'manifest, delivery files and directly referenced previous WAV files unchanged',passed:true,details:{files:Object.keys(before).length}});}catch(error){checks.push({name:'manifest/source preservation',passed:false,error:error.message});}}
    Object.assign(report,{finishedAt:new Date().toISOString(),catalogVersion:catalog?.version,catalogSha256,passed:checks.every(row=>row.passed),checkCount:checks.length,passCount:checks.filter(row=>row.passed).length,consoleErrors,pageErrors,httpErrors,externalRequests,failedRequests,protectedFileCount:before?Object.keys(before).length:null});
    if(inspection)await fs.writeFile(path.join(out,'native-inspection.json'),JSON.stringify(inspection,null,2)+'\n');if(pairInspection)await fs.writeFile(path.join(out,'pair-normalization.json'),JSON.stringify(pairInspection,null,2)+'\n');await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,passCount:report.passCount,checks:report.checkCount,out}));if(!report.passed)process.exitCode=1;
  }
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
