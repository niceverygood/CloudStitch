/* Optional integration QA. No browser runs until this script is invoked.
 * node tools/combat-vfx-v2/qa.cjs --smoke [--write]
 *   One page, six representatives, three sampled times, six screenshots.
 * node tools/combat-vfx-v2/qa.cjs [--write]
 *   All54, controls/downloads, modes, mobile overflow, rotation ghosting.
 * Dependency resolution uses the calling process's existing NODE_PATH.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {launchBrowser}=require('../lib/runtime.cjs');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'outputs/combat-vfx-v2'),SMOKE=process.argv.includes('--smoke'),WRITE=process.argv.includes('--write');
const REPRESENTATIVES=['machine-gun-muzzle','smoke-puff','cannon-hit','flamethrower-stream','shield-pulse','repair-stitch'];
const directory=path.join(ROOT,WRITE?'outputs/combat-vfx-v2/verification':'work/combat-vfx-v2/verification');
const captureDirectory=path.join(directory,SMOKE?'smoke-captures':'integration-captures');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const relative=file=>path.relative(ROOT,file).split(path.sep).join('/');
async function snapshot(page,seconds){
  return page.evaluate(seconds=>{
    const api=window.__vfxV2;api.setTime(seconds);api.renderClean();
    const roots=api.roots.map(root=>{root.updateMatrixWorld(true);const values=[];let finite=true,meshes=0,visibleMeshes=0;root.traverse(node=>{if(!node.isMesh)return;meshes++;const matrix=node.matrixWorld.elements;if(!matrix.every(Number.isFinite))finite=false;values.push(...matrix.map(value=>Math.round(value*1e6)/1e6));const materials=Array.isArray(node.material)?node.material:[node.material];values.push(...materials.map(material=>Math.round(material.opacity*1e6)/1e6));if(materials.some(material=>material.opacity>.01))visibleMeshes++;});return {finite,meshes,visibleMeshes,state:JSON.stringify(values)};});
    return {seconds:api.currentTime,duration:api.duration,ready:api.ready,outlineAutoClear:api.effect.autoClear===true,roots,stats:window.__vfxV2Stats.lanes};
  },seconds);
}
async function ghosting(page){
  return page.evaluate(()=>{
    const api=window.__vfxV2;api.setPlaying(false);api.setAutoRotate(false);api.controls.enableDamping=false;const focus=api.controls.target.clone(),axis=new api.camera.position.constructor(0,1,0);
    for(let i=0;i<120;i++){api.camera.position.sub(focus).applyAxisAngle(axis,.013).add(focus);api.camera.lookAt(focus);api.camera.updateMatrixWorld(true);api.render();}
    const gl=api.renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
    const before=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,before);
    api.renderClean();const after=new Uint8Array(before.length);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,after);
    let changedPixels=0,maxDifference=0;for(let i=0;i<before.length;i+=4){let changed=false;for(let c=0;c<4;c++){const difference=Math.abs(before[i+c]-after[i+c]);if(difference)changed=true;maxDifference=Math.max(maxDifference,difference);}if(changed)changedPixels++;}
    return {frames:120,changedPixels,maxDifference,outlineAutoClear:api.effect.autoClear===true};
  });
}
async function main(){
  const report={schema_version:1,game_title:'Cloudstitch',mode:SMOKE?'representative_smoke':'full_optional_integration',started_at_utc:new Date().toISOString(),purpose:SMOKE?'Actual representative renders for direct visual inspection; full integration QA remains optional.':'Browser integration verification, not gameplay/performance/art approval.',models:[],screenshots:[],errors:[],consoleErrors:[],externalRequests:[],passed:false};
  fs.mkdirSync(captureDirectory,{recursive:true});let browser;
  try{
    browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
    page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
    page.on('request',request=>{if(/^https?:/i.test(request.url())){const url=new URL(request.url());report.externalRequests.push(url.origin+url.pathname);}});
    await page.goto(pathToFileURL(path.join(OUT,SMOKE?'comparison.html':'index.html')).href,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__vfxV2Ready||window.__vfxV2Stats?.error,null,{timeout:120000});
    const initial=await page.evaluate(()=>({ready:window.__vfxV2Ready,error:window.__vfxV2Stats?.error,available:window.__vfxV2?.availableItems.map(item=>({id:item.id,kind:item.kind}))}));
    if(!initial.ready)throw new Error(initial.error||'Viewer failed to initialize.');
    report.available=initial.available;
    const ids=SMOKE?REPRESENTATIVES:initial.available.map(item=>item.id);
    if(SMOKE&&ids.some(id=>!initial.available.some(item=>item.id===id)))throw new Error('All six representative pairs must be available for smoke QA.');
    if(!SMOKE&&initial.available.length!==54)throw new Error('Full integration QA expects48effects and6sequences.');
    for(const id of ids){
      await page.evaluate(async id=>{await window.__vfxV2.selectEffect(id);const api=window.__vfxV2;api.setPlaying(false);api.setLoop(false);api.setAutoRotate(false);api.controls.enableDamping=false;api.setMode('handdrawn');api.setBackground(false);api.reset();api.renderClean();},id);
      const model={id,initial:await page.evaluate(()=>({ready:window.__vfxV2.ready,duration:window.__vfxV2.duration,stats:window.__vfxV2Stats.lanes,outlineAutoClear:window.__vfxV2.effect.autoClear===true})),samples:[]};
      if(!model.initial.ready||!model.initial.outlineAutoClear||model.initial.stats.some(lane=>!lane.texturesReady||!lane.clipCount||!lane.trackCount))throw new Error('Actual GLB/texture/clip readiness failed: '+id);
      for(const fraction of [.16,.38,.72]){const sample=await snapshot(page,model.initial.duration*fraction);if(!sample.ready||sample.roots.some(root=>!root.finite||!root.meshes))throw new Error('Invalid actual mesh/time sample: '+id);model.samples.push({...sample,roots:sample.roots.map(({state,...root})=>({...root,state_sha256:hash(state)}))});}
      if(new Set(model.samples.map(sample=>sample.roots[1].state_sha256)).size<2)throw new Error('v2 transforms/material visibility did not change: '+id);
      if(SMOKE||REPRESENTATIVES.includes(id)){
        const captureFraction=id==='machine-gun-muzzle'?.125:.38;
        await snapshot(page,model.initial.duration*captureFraction);
        const game=path.join(captureDirectory,id+'-game.png');await page.locator('#stage').screenshot({path:game});
        if(SMOKE)await page.evaluate(()=>{window.__vfxV2.focusEffect?.();window.__vfxV2.renderClean();});
        const file=path.join(captureDirectory,id+'.png');await page.locator('#stage').screenshot({path:file});report.screenshots.push({id,path:relative(file),game_path:relative(game),time:model.initial.duration*captureFraction});
      }
      if(!SMOKE){
        model.embeddedHashes=await page.evaluate(async()=>Promise.all(window.__vfxV2.models.map(async(model,index)=>({lane:index?'v2':'v1',sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',model.bytes))].map(value=>value.toString(16).padStart(2,'0')).join(''),expected:model.stats.sha256}))));
        if(model.embeddedHashes.some(item=>item.sha256!==item.expected))throw new Error('Embedded GLB hash mismatch: '+id);
        const downloadPromise=page.waitForEvent('download');await page.click('#download-v2');const download=await downloadPromise,file=path.join(ROOT,'work/combat-vfx-v2/download-check',id+'.glb');fs.mkdirSync(path.dirname(file),{recursive:true});await download.saveAs(file);model.downloadHashMatches=hash(fs.readFileSync(file))===model.embeddedHashes[1].sha256;if(!model.downloadHashMatches)throw new Error('Actual download hash mismatch: '+id);
        model.controls=await page.evaluate(()=>{const api=window.__vfxV2;api.setLoop(false);api.setSpeed(2);api.setTime(api.duration-.01);api.setPlaying(true);api.step(.02);const stopsAtEnd=Math.abs(api.currentTime-api.duration)<1e-6&&!api.stats.playing;api.setLoop(true);api.setTime(api.duration-.01);api.setPlaying(true);api.step(.02);const wraps=Math.abs(api.currentTime-.03)<1e-5;api.setPlaying(false);api.setTime(api.duration*.38);api.setSpeed(1);api.setLoop(false);return {stopsAtEnd,wraps,paused:!api.stats.playing,scrubTime:api.currentTime};});
        if(!model.controls.stopsAtEnd||!model.controls.wraps||!model.controls.paused)throw new Error('Playback/pause/loop/speed/scrub failed: '+id);
        if(REPRESENTATIVES.includes(id)){model.modes=[];for(const mode of ['handdrawn','cel','original']){await page.evaluate(mode=>{const api=window.__vfxV2;api.setMode(mode);api.setTime(api.duration*.38);api.renderClean();},mode);const ghost=await ghosting(page);model.modes.push({mode,...ghost});if(ghost.changedPixels||!ghost.outlineAutoClear)throw new Error('Rotation ghosting failed: '+id+' '+mode);}await page.evaluate(()=>{const api=window.__vfxV2;api.setMode('handdrawn');api.reset();api.setBackground(true);api.renderClean();});model.deepTealBackground=true;}
      }
      report.models.push(model);console.log(JSON.stringify({id,mode:report.mode,actual_pairs_loaded:true,sampled_times:model.samples.length,screenshot:report.screenshots.some(item=>item.id===id)}));
    }
    if(!SMOKE){await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{window.__vfxV2.fit();window.__vfxV2.renderClean();});report.mobile=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+1}));if(report.mobile.overflow)throw new Error('Mobile page overflows viewport.');await page.screenshot({path:path.join(captureDirectory,'mobile.png'),fullPage:true});}
    if(report.errors.length||report.externalRequests.length||report.consoleErrors.length)throw new Error('Browser error, console error or external request occurred.');
    report.passed=true;
  }catch(error){report.failure=error.message;process.exitCode=1;}
  finally{if(browser)await browser.close();report.finished_at_utc=new Date().toISOString();const file=path.join(directory,SMOKE?'browser-smoke.json':'browser-integration.json');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,mode:report.mode,models:report.models.length,screenshots:report.screenshots.length,report:relative(file),failure:report.failure,errors:report.errors,consoleErrors:report.consoleErrors,externalRequests:report.externalRequests},null,2));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
