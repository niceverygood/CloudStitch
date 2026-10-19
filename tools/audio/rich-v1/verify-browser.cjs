/* Native QA harness only. Run sequentially in the integration owner's browser slot.
 * node tools/audio/rich-v1/verify-browser.cjs --playwright-root <module-or-node_modules-parent>
 *   --url http://127.0.0.1:8866/outputs/audio-rich-v1/ --out outputs/audio-rich-browser-qa-v1
 * Optional: --headed --channel chrome --executable-path <browser executable>
 * No dependency install, server start, asset edit, generation, or human-listening claim.
 */
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const assert=require('node:assert/strict');
const args=process.argv.slice(2);
function option(name,fallback){const exact=args.indexOf(name);if(exact>=0)return args[exact+1];const equals=args.find(a=>a.startsWith(name+'='));return equals?equals.slice(name.length+1):fallback;}
const root=path.resolve(__dirname,'../../..');
const url=option('--url','http://127.0.0.1:8866/outputs/audio-rich-v1/');
const out=path.resolve(option('--out',path.join(root,'outputs/audio-rich-browser-qa-v1')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(target,container)=>{const relative=path.relative(container,target);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
const protectedDirs=['tools/audio','outputs/audio-v1','outputs/audio-review-v2','outputs/audio-mortar-r1','outputs/audio-rich-v1','outputs/audio-machinegun-elevenlabs-v1'];
if(protectedDirs.some(dir=>inside(out,path.join(root,dir))))throw new Error('--out must be outside frozen audio source and delivery folders.');
async function loadPlaywright(){
  const requested=option('--playwright-path',option('--playwright-root',null));
  if(!requested)return require('playwright');
  const resolved=path.resolve(requested),candidates=[resolved,path.join(resolved,'playwright'),path.join(resolved,'node_modules/playwright')];
  for(const candidate of candidates){try{return require(candidate);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}
  throw new Error('Cannot load Playwright from --playwright-root/--playwright-path. No installation was attempted.');
}
async function protectedSnapshot(){
  const files={},manifestPath='outputs/audio-rich-v1/delivery-manifest.json';
  const manifest=JSON.parse(await fs.readFile(path.join(root,manifestPath),'utf8'));
  const current=JSON.parse(await fs.readFile(path.join(root,'outputs/audio-rich-v1/catalog.json'),'utf8'));
  const paths=[manifestPath,...manifest.files.map(f=>f.path),...current.assets.map(a=>a.source.originalRelative)].sort();
  for(const relative of new Set(paths)){
    const target=path.resolve(root,relative);if(!inside(target,root))throw new Error('Snapshot path outside repository');
    const bytes=await fs.readFile(target);files[relative]={bytes:bytes.length,sha256:hash(bytes)};
  }
  return files;
}
async function run(){
  const {chromium}=await loadPlaywright(),checks=[],consoleErrors=[],pageErrors=[],failedRequests=[],externalRequests=[],httpErrors=[];
  let browser,context,page,inspection,catalog,catalogSha256,protectedBefore,protectedAfter;
  const report={schema:'cloudstitch-audio-rich-browser-qa/v1',startedAt:new Date().toISOString(),url,scope:'New rich-v1 UI and its 49 original/enhanced pairs: 98 native decodes support pair normalization comparisons. This is separate from the old 47-cue QA and production-only PCM decode. Audio waveform and numeric validity do not establish sound quality. Human listening and game installation remain pending.',harnessSha256:hash(await fs.readFile(__filename)),method:'Isolated fresh browser context; no user localStorage accessed. Protection scope: new delivery manifest/files and only 49 directly referenced source MP3 files; no repeated project-wide asset QA.',checks};
  await fs.mkdir(out,{recursive:true});
  async function check(name,task){try{const details=await task();checks.push({name,passed:true,...(details===undefined?{}:{details})});}catch(error){checks.push({name,passed:false,error:error.message});try{await page?.evaluate(()=>window.__audioRich?.stopAll('QA failure cleanup'));}catch{/* Preserve original test error. */}}}
  try{
    protectedBefore=await protectedSnapshot();
    const launch={headless:!args.includes('--headed')};const channel=option('--channel',null),executablePath=option('--executable-path',null);if(channel)launch.channel=channel;if(executablePath)launch.executablePath=executablePath;
    browser=await chromium.launch(launch);context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});page=await context.newPage();page.setDefaultTimeout(15000);
    const origin=new URL(url).origin;
    page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});page.on('pageerror',error=>pageErrors.push(error.message));
    page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
    page.on('response',response=>{if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status()});});
    await page.route('**/*',route=>{const address=route.request().url();if(/^https?:/i.test(address)&&new URL(address).origin!==origin){externalRequests.push(address);return route.abort();}return route.continue();});
    await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__audioRich?.getCatalog()?.assets?.length>0);
    const catalogResponse=await context.request.get(new URL('catalog.json',url).href);assert.equal(catalogResponse.ok(),true);const catalogBytes=await catalogResponse.body();catalogSha256=hash(catalogBytes);catalog=JSON.parse(catalogBytes);
    await check('catalog has 49 independently identified original/enhanced pairs',async()=>{assert.equal(catalog.assets.length,49);assert.equal(new Set(catalog.assets.map(a=>a.id)).size,49);assert.equal(await page.locator('#asset-list .asset-row').count(),49);assert.ok(catalog.assets.some(a=>a.id==='mortar-launch-a'));assert.ok(catalog.assets.some(a=>a.id==='mortar-launch-b'));});
    await check('before gesture: locked and no backlog',async()=>{const d=await page.evaluate(()=>window.__audioRich.debug);assert.equal(d.contextState,'locked');assert.equal(d.createdSources,0);assert.equal(d.voices.length,0);assert.equal(d.pending,0);});
    await check('first real click unlocks context without autoplay',async()=>{await page.locator('#unlock').click();await page.waitForFunction(()=>window.__audioRich.debug.contextState==='running');const d=await page.evaluate(()=>window.__audioRich.debug);assert.equal(d.createdSources,0);assert.equal(d.voices.length,0);});
    await check('native decode: 98 files, finite PCM, enhanced peak below 0.81',async()=>{inspection=await page.evaluate(()=>window.__audioRich.inspectAll({release:true}));assert.equal(inspection.cancelled,false);assert.equal(inspection.results.length,98);assert.ok(inspection.results.every(r=>r.status==='decoded'&&r.finite&&r.frames>0&&r.duration>0&&r.rms>0&&r.sampleRate>0));assert.ok(inspection.results.filter(r=>r.mode==='enhanced').every(r=>r.peak<.81));for(const result of inspection.results){const asset=catalog.assets.find(a=>a.id===result.id),expected=result.mode==='enhanced'?asset.metrics?.output:asset.metrics?.source;if(expected?.duration)assert.ok(Math.abs(result.duration-expected.duration)<(result.mode==='enhanced'?.002:.025),`Duration mismatch ${result.id}:${result.mode}`);if(expected?.channels)assert.equal(result.channels,expected.channels);}const d=await page.evaluate(()=>window.__audioRich.debug);assert.equal(d.cacheCount,0);assert.equal(d.createdSources,0);return {decoded:inspection.results.length,rawPeakPolicy:'Original MP3 peaks are measured, not rejected solely for exceeding 1.',sampleRatePolicy:'Native device rate may resample 44100-Hz files; no forced device sample rate assertion.',enhancedMaxPeak:Math.max(...inspection.results.filter(r=>r.mode==='enhanced').map(r=>r.peak))};});
    await check('49 native original/enhanced pairs share RMS target and peak headroom',async()=>{
      assert.equal(inspection?.results.length,98);
      const pairs=await page.evaluate(async rows=>{
        const {pairNormalization}=await import('../../tools/audio/rich-v1/review.mjs');
        return window.__audioRich.getCatalog().assets.map(a=>{
          const original=rows.find(r=>r.id===a.id&&r.mode==='original'),enhanced=rows.find(r=>r.id===a.id&&r.mode==='enhanced'),g=pairNormalization(original,enhanced,true);
          return {id:a.id,targetRms:g.targetRms,originalRms:original.rms*g.original,enhancedRms:enhanced.rms*g.enhanced,originalPeak:original.peak*g.original,enhancedPeak:enhanced.peak*g.enhanced};
        });
      },inspection.results);
      assert.equal(pairs.length,49);for(const p of pairs){assert.ok(p.targetRms>0&&p.targetRms<=.180000001);assert.ok(Math.abs(p.originalRms-p.enhancedRms)<1e-8);assert.ok(p.originalPeak<=.80000001&&p.enhancedPeak<=.80000001);}
      report.pairNormalization=pairs;return {pairs:pairs.length,maximumDifference:Math.max(...pairs.map(p=>Math.abs(p.originalRms-p.enhancedRms)))};
    });
    await check('real UI original one-shot starts and finishes',async()=>{await page.locator('#play-original').click();await page.waitForFunction(()=>window.__audioRich.debug.voices.some(v=>v.mode==='original'));assert.equal(await page.evaluate(()=>window.__audioRich.whenIdle(15000)),true);});
    await check('real UI enhanced one-shot starts and finishes',async()=>{const before=await page.evaluate(()=>window.__audioRich.debug.createdSources);await page.locator('#play-enhanced').click();await page.waitForFunction(count=>window.__audioRich.debug.createdSources>count,before);assert.equal(await page.evaluate(()=>window.__audioRich.whenIdle(15000)),true);assert.equal(await page.evaluate(()=>window.__audioRich.debug.createdSources),before+1);});
    await check('A/B comparison starts both modes and finishes without overlap',async()=>{const before=await page.evaluate(()=>window.__audioRich.debug.createdSources);await page.evaluate(()=>{window.__qaMaxVoices=0;window.__qaMonitor=setInterval(()=>{window.__qaMaxVoices=Math.max(window.__qaMaxVoices,window.__audioRich.debug.voices.length);},10);});try{await page.locator('#compare-ab').click();await page.waitForFunction(()=>!window.__audioRich.debug.compareActive,{},{timeout:20000});const after=await page.evaluate(()=>({sources:window.__audioRich.debug.createdSources,maxVoices:window.__qaMaxVoices}));assert.equal(after.sources-before,2);assert.ok(after.maxVoices<=1);}finally{await page.evaluate(()=>clearInterval(window.__qaMonitor));}});
    await check('idle master volume changes immediately',async()=>{await page.locator('#volume').evaluate(el=>{el.value='27';el.dispatchEvent(new Event('input',{bubbles:true}));});const d=await page.evaluate(()=>window.__audioRich.debug);assert.equal(d.settings.volume,.27);assert.ok(Math.abs(d.gain-.27)<1e-5);});
    await check('loop duplication is prevented and stop clears the source',async()=>{await page.locator('#repeat').check();await page.locator('#play-enhanced').click();await page.waitForFunction(()=>window.__audioRich.debug.voices.length===1);const before=await page.evaluate(()=>window.__audioRich.debug.createdSources);await page.evaluate(async()=>{const id=window.__audioRich.debug.selectedId;await window.__audioRich.play(id,{mode:'enhanced',loop:true,exclusive:false});});const d=await page.evaluate(()=>window.__audioRich.debug);assert.equal(d.createdSources,before);assert.equal(d.voices.length,1);assert.equal(d.voices[0].loop,true);});
    await check('active master volume converges while source is running',async()=>{await page.locator('#volume').evaluate(el=>{el.value='31';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>Math.abs(window.__audioRich.debug.gain-.31)<.001);assert.equal(await page.evaluate(()=>window.__audioRich.debug.voices.length),1);await page.locator('#stop-all').click();assert.equal(await page.evaluate(()=>window.__audioRich.debug.voices.length),0);await page.locator('#repeat').uncheck();});
    await check('stop schedules short release then cleans all native sources',async()=>{
      await page.evaluate(()=>window.__audioRich.play('engine-idle-loop',{mode:'enhanced',loop:true}));await page.waitForTimeout(30);
      const stopped=await page.evaluate(()=>{window.__audioRich.stopAll('native release check');return window.__audioRich.debug;});
      assert.equal(stopped.voices.length,0);assert.ok(stopped.releasing.length>=1);assert.ok(stopped.releasing.every(v=>v.fadeMs>=4&&v.fadeMs<=6&&v.stopAt>v.releaseAt));
      assert.equal(await page.evaluate(()=>window.__audioRich.whenIdle(3000)),true);const d=await page.evaluate(()=>window.__audioRich.debug);assert.equal(d.releaseCount,0);return {release:stopped.releasing,remaining:d.releaseCount,meaning:'Checks scheduled native gain release and cleanup, not audible click-free approval.'};
    });
    await check('mono playback has one channel',async()=>{await page.locator('#mono').check();await page.locator('#repeat').check();await page.locator('#play-enhanced').click();await page.waitForFunction(()=>window.__audioRich.debug.voices.length===1);assert.equal(await page.evaluate(()=>window.__audioRich.debug.voices[0].channels),1);await page.locator('#stop-all').click();await page.locator('#repeat').uncheck();await page.locator('#mono').uncheck();});
    await check('important three-cue preview has at most three native voices',async()=>{const before=await page.evaluate(()=>window.__audioRich.debug.createdSources);await page.locator('#play-three').click();await page.waitForFunction(count=>window.__audioRich.debug.createdSources>=count+3,before);const d=await page.evaluate(()=>window.__audioRich.debug);assert.equal(d.createdSources-before,3);assert.ok(d.voices.length<=3);await page.locator('#stop-all').click();});
    await check('search and category filters preserve a valid selection',async()=>{await page.locator('#search').fill('mortar-launch');assert.equal(await page.locator('#asset-list .asset-row').count(),2);await page.locator('#search').fill('');await page.locator('#filters button[data-category="warning"]').click();assert.equal(await page.locator('#asset-list .asset-row').count(),catalog.assets.filter(a=>a.category==='warning').length);await page.locator('#filters button[data-category="all"]').click();assert.equal(await page.locator('#asset-list .asset-row').count(),49);});
    await check('sequence cancellation stops queued playback',async()=>{await page.locator('#sequence').click();await page.waitForFunction(()=>window.__audioRich.debug.sequenceActive);await page.locator('#stop-all').click();const before=await page.evaluate(()=>window.__audioRich.debug.createdSources);await page.waitForTimeout(350);const d=await page.evaluate(()=>window.__audioRich.debug);assert.equal(d.sequenceActive,false);assert.equal(d.voices.length,0);assert.equal(d.createdSources,before);});
    let exported,noteFixtureId;
    await check('review notes export as valid versioned JSON',async()=>{noteFixtureId=await page.evaluate(()=>window.__audioRich.debug.selectedId);await page.locator('.decisions label').filter({has:page.locator('input[value="revision"]')}).click();await page.locator('#note').fill('NATIVE QA FIXTURE · 메모 JSON 검증, 사용자 음색 판정 아님');const downloadPromise=page.waitForEvent('download');await page.locator('#export-notes').click();const download=await downloadPromise;const target=path.join(out,'qa-notes-export.json');await download.saveAs(target);exported=JSON.parse(await fs.readFile(target,'utf8'));assert.equal(exported.schema,'cloudstitch-audio-rich-review/v1');assert.equal(exported.catalogVersion,catalog.version);assert.equal(exported.catalogAssets.length,49);assert.equal(exported.decisions.length,49);});
    await check('notes survive reload and valid JSON import roundtrip',async()=>{await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__audioRich?.getCatalog());await page.locator(`#asset-list .asset-row[data-asset-id="${noteFixtureId}"]`).click();assert.ok((await page.locator('#note').inputValue()).includes('NATIVE QA FIXTURE'));const imported=structuredClone(exported);imported.decisions.find(item=>item.id===noteFixtureId).note='NATIVE QA ROUNDTRIP · 판정용 아님';await page.locator('#import-notes').setInputFiles({name:'valid-review.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('합쳤습니다'));assert.ok((await page.locator('#note').inputValue()).includes('NATIVE QA ROUNDTRIP'));});
    await check('mismatched file SHA import is rejected without replacing notes',async()=>{const invalid=structuredClone(exported);invalid.catalogAssets[0].enhancedSha256='0'.repeat(64);const before=await page.locator('#note').inputValue();await page.locator('#import-notes').setInputFiles({name:'invalid-review.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('가져오기 실패'));assert.equal(await page.locator('#note').inputValue(),before);});
    await check('original mortar retains user-revision warning',async()=>{await page.locator('#asset-list .asset-row[data-asset-id="fire-mortar"]').click();assert.equal(await page.locator('#feedback-warning').isVisible(),true);assert.ok((await page.locator('#selected-status').textContent()).includes('검수 전'));});
    await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
    await check('390-pixel layout has no horizontal document overflow',async()=>{await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);const sizes=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(sizes.scroll<=sizes.viewport);assert.ok(sizes.body<=sizes.viewport);await page.screenshot({path:path.join(out,'mobile-390.png'),fullPage:true});return sizes;});
    await check('dispose leaves no sources or cache',async()=>{await page.evaluate(()=>window.__audioRich.dispose());const d=await page.evaluate(()=>window.__audioRich.debug);assert.equal(d.voices.length,0);assert.equal(d.releaseCount,0);assert.equal(d.cacheCount,0);assert.equal(d.disposed,true);assert.equal(d.contextState,'closed');});
    await check('no page, console, HTTP or external-network errors',async()=>{assert.equal(pageErrors.length,0,JSON.stringify(pageErrors));assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));assert.equal(httpErrors.length,0,JSON.stringify(httpErrors));assert.equal(externalRequests.length,0,JSON.stringify(externalRequests));const unexpected=failedRequests.filter(r=>!r.error?.includes('ERR_ABORTED'));assert.equal(unexpected.length,0,JSON.stringify(unexpected));});
  }catch(error){checks.push({name:'harness initialization or unhandled execution',passed:false,error:error.stack||error.message});}
  finally{
    try{await context?.close();}catch(error){checks.push({name:'context cleanup',passed:false,error:error.message});}
    try{await browser?.close();}catch(error){checks.push({name:'browser cleanup',passed:false,error:error.message});}
    if(protectedBefore){try{protectedAfter=await protectedSnapshot();assert.deepEqual(protectedAfter,protectedBefore);checks.push({name:'frozen audio source and output files unchanged',passed:true,details:{files:Object.keys(protectedBefore).length}});}catch(error){checks.push({name:'frozen audio source and output files unchanged',passed:false,error:error.message});}}
    Object.assign(report,{finishedAt:new Date().toISOString(),catalogVersion:catalog?.version,catalogSha256,passed:checks.every(c=>c.passed),passCount:checks.filter(c=>c.passed).length,checkCount:checks.length,consoleErrors,pageErrors,httpErrors,externalRequests,failedRequests,protectedFileCount:protectedBefore?Object.keys(protectedBefore).length:null,humanListening:'Not performed. No subjective quality or approval claim.',gameplayInstalled:false});
    if(inspection)await fs.writeFile(path.join(out,'native-inspection.json'),JSON.stringify(inspection,null,2)+'\n');await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({passed:report.passed,passCount:report.passCount,checks:report.checkCount,out}));if(!report.passed)process.exitCode=1;
  }
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
