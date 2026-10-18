// Verify the actual offline workbench and GLB animation; no generated screenshots
// or metadata are used as substitutes for loading and evaluating the meshes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { repoPath, reportDirectory, launchBrowser } = require('../lib/runtime.cjs');

const reportDir = reportDirectory('combat-vfx', process.argv[3]);
const htmlPath = repoPath(process.argv[2] || 'outputs/combat-vfx/index.html');
const catalogPath = repoPath(process.argv[4] || 'outputs/combat-vfx/catalog.json');
const representatives = ['machine-gun-muzzle', 'large-explosion', 'heavy-smoke-state', 'repair-stitch'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const assert = (value, message) => { if (!value) throw new Error(message); };

async function frames(page, count=3) {
  await page.evaluate(count => new Promise(resolve => {
    const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  }), count);
}

async function sampleModel(page, ratio) {
  return page.evaluate(ratio => {
    const work = window.__vfxWorkbench, stats = window.__vfxStats;
    work.setTime(stats.duration * ratio);
    work.root.updateMatrixWorld(true);
    work.renderer.render(work.scene, work.camera);
    const matrices=[], meshes=[];
    let finite=true, colored=0, unlit=0;
    work.root.traverse(node => {
      if (!node.isMesh) return;
      const matrix=node.matrixWorld.toArray();
      finite = finite && matrix.every(Number.isFinite);
      matrices.push(...matrix);
      const color=node.geometry.getAttribute('color');
      const materials=Array.isArray(node.material)?node.material:[node.material];
      const vertexColor=Boolean(color && color.count===node.geometry.getAttribute('position').count && materials.every(material=>material.vertexColors));
      const isUnlit=materials.every(material=>material.isMeshBasicMaterial);
      if(vertexColor)colored++;
      if(isUnlit)unlit++;
      meshes.push({name:node.name,vertexColor,unlit:isUnlit});
    });
    const source=work.renderer.domElement, buffer=document.createElement('canvas');
    buffer.width=source.width;buffer.height=source.height;
    const ctx=buffer.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(source,0,0);
    const pixels=ctx.getImageData(0,0,buffer.width,buffer.height).data;
    let visiblePixels=0, maxAlpha=0;
    for(let i=3;i<pixels.length;i+=4){if(pixels[i]>0)visiblePixels++;maxAlpha=Math.max(maxAlpha,pixels[i]);}
    return {ratio,time:stats.currentTime,actionTime:work.action?.time,meshCount:meshes.length,coloredMeshes:colored,
      unlitMeshes:unlit,finite,matrices,visiblePixels,maxAlpha,pixelCount:pixels.length/4};
  }, ratio);
}

async function embeddedDownload(page) {
  return page.evaluate(async () => {
    const link=document.getElementById('download');
    const response=await fetch(link.href);
    const bytes=new Uint8Array(await response.arrayBuffer());
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const sha256=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
    return {bytes:bytes.length,sha256,magic:Array.from(bytes.subarray(0,4)),filename:link.download,urlType:link.href.split(':')[0]};
  });
}

async function ghosting(page,id) {
  await page.evaluate(async id=>{const work=window.__vfxWorkbench;await work.selectEffect(id);work.setPlaying(false);work.setTime(window.__vfxStats.duration*.35);work.reset();work.controls.enableDamping=false;work.controls.autoRotateSpeed=18;work.setTarget('none');},id);
  await page.check('#outline');
  await frames(page,3);
  const result=await page.evaluate(async id=>{
    const work=window.__vfxWorkbench;
    const frames=count=>new Promise(resolve=>{const tick=()=>--count<=0?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick);});
    const capture=()=>{const source=work.renderer.domElement,c=document.createElement('canvas');c.width=source.width;c.height=source.height;const context=c.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0);return context.getImageData(0,0,c.width,c.height).data;};
    work.setAutoRotate(true);await frames(120);work.setAutoRotate(false);await frames(4);
    const position=work.camera.position.toArray(),time=window.__vfxStats.currentTime,before=capture();
    work.renderer.clear(true,true,true);await frames(3);
    const after=capture();let changedPixels=0,totalChannelDifference=0;
    for(let i=0;i<before.length;i+=4){let changed=false;for(let c=0;c<4;c++){const d=Math.abs(before[i+c]-after[i+c]);if(d)changed=true;totalChannelDifference+=d;}if(changed)changedPixels++;}
    const cameraDelta=Math.max(...position.map((value,index)=>Math.abs(value-work.camera.position.toArray()[index])));
    return {id,rotationFrames:120,changedPixels,totalChannelDifference,cameraDelta,cameraUnchanged:cameraDelta<1e-8,
      animationTimeUnchanged:Math.abs(time-window.__vfxStats.currentTime)<1e-10,outlineAutoClear:work.effect.autoClear===true};
  },id);
  await page.screenshot({path:path.join(reportDir,`qa-${id}.png`),fullPage:true});
  await page.uncheck('#outline');
  return result;
}

async function verifyCamera(page,id) {
  await page.evaluate(async id=>{const w=window.__vfxWorkbench;await w.selectEffect(id);w.setTime(window.__vfxStats.duration*.35);w.reset();w.controls.enableDamping=false;},id);
  await frames(page,3);
  const oldPosition=await page.evaluate(()=>window.__vfxWorkbench.camera.position.toArray());
  const stage=await page.locator('#stage').boundingBox();
  const center={x:stage.x+stage.width*.5,y:stage.y+stage.height*.52};
  await page.mouse.move(center.x,center.y);await page.mouse.down();await page.mouse.move(center.x+85,center.y+35,{steps:8});await page.mouse.up();await frames(page,3);
  const newPosition=await page.evaluate(()=>window.__vfxWorkbench.camera.position.toArray());
  assert(oldPosition.some((value,index)=>Math.abs(value-newPosition[index])>1e-6),id+': drag rotation failed');
  const oldZoom=await page.evaluate(()=>window.__vfxWorkbench.camera.zoom);
  await page.mouse.wheel(0,-160);await frames(page,4);
  const newZoom=await page.evaluate(()=>window.__vfxWorkbench.camera.zoom);
  assert(Math.abs(oldZoom-newZoom)>1e-6,id+': wheel zoom failed');
  await page.click('#rotate');await frames(page,2);
  assert(await page.getAttribute('#rotate','aria-pressed')==='true',id+': auto-rotation button failed');
  await page.click('#reset');await frames(page,2);
  const reset=await page.evaluate(()=>({rotating:window.__vfxWorkbench.controls.autoRotate,zoom:window.__vfxWorkbench.camera.zoom,position:window.__vfxWorkbench.camera.position.toArray()}));
  assert(!reset.rotating && reset.zoom===1,id+': reset did not restore camera and stop rotation');
  await page.click('#fit');await frames(page,2);
  const fitFinite=await page.evaluate(()=>Object.values(window.__vfxWorkbench.camera.projectionMatrix.elements).every(Number.isFinite));
  assert(fitFinite,id+': fit produced a nonfinite projection');
  return {id,dragRotate:true,wheelZoom:true,reset:true,fit:true,autoRotate:true};
}

async function verifyTransport(page) {
  const id='heavy-smoke-state';
  await page.evaluate(async id=>{const w=window.__vfxWorkbench;await w.selectEffect(id);w.setSpeed(1);w.setTime(window.__vfxStats.duration*.25);},id);
  const paused=await page.evaluate(()=>window.__vfxStats.currentTime);await frames(page,8);
  assert(await page.evaluate(()=>window.__vfxStats.currentTime)===paused,'Paused animation advanced');
  assert(await page.getAttribute('#play','aria-pressed')==='false','Pause button state is incorrect');

  const last=await page.evaluate(()=>{const w=window.__vfxWorkbench,d=window.__vfxStats.duration;w.setTime(d);return {time:window.__vfxStats.currentTime,duration:d,actionTime:w.action.time,playing:window.__vfxStats.playing};});
  await frames(page,4);
  assert(last.time===last.duration && Math.abs(last.actionTime-last.duration)<1e-6 && !last.playing,'Exact last-frame scrub wrapped or resumed');
  assert(await page.evaluate(()=>window.__vfxStats.currentTime)===last.duration,'Last frame advanced while paused');

  await page.evaluate(()=>{const w=window.__vfxWorkbench;w.setLoop(false);w.setTime(window.__vfxStats.duration-.02);w.setPlaying(true);});
  await frames(page,12);
  const oneShot=await page.evaluate(()=>({time:window.__vfxStats.currentTime,duration:window.__vfxStats.duration,playing:window.__vfxStats.playing,loop:window.__vfxStats.loop}));
  assert(!oneShot.loop && !oneShot.playing && oneShot.time===oneShot.duration,'One-shot playback did not stop at the final frame');

  await page.check('#loop');
  await page.evaluate(()=>{const w=window.__vfxWorkbench;w.setTime(window.__vfxStats.duration-.02);w.setPlaying(true);});
  await frames(page,12);
  const looping=await page.evaluate(()=>({time:window.__vfxStats.currentTime,duration:window.__vfxStats.duration,playing:window.__vfxStats.playing,loop:window.__vfxStats.loop}));
  assert(looping.loop && looping.playing && looping.time<looping.duration*.75,'Loop playback did not wrap into the clip');

  await page.selectOption('#speed','0.5');
  assert(await page.evaluate(()=>window.__vfxStats.speed)===.5,'Half speed selection failed');
  await page.selectOption('#speed','2');
  assert(await page.evaluate(()=>window.__vfxStats.speed)===2,'Double speed selection failed');
  await page.evaluate(()=>{const w=window.__vfxWorkbench;w.setTime(0);w.setPlaying(true);});
  await frames(page,6);
  assert(await page.evaluate(()=>window.__vfxStats.currentTime)>0,'Playing animation did not advance');
  await page.click('#play');
  assert(await page.evaluate(()=>window.__vfxStats.playing)===false,'Pause button did not pause');
  await page.click('#replay');
  assert(await page.evaluate(()=>window.__vfxStats.playing)===true,'Replay button did not start playback');
  await page.evaluate(()=>{const w=window.__vfxWorkbench;w.setSpeed(1);w.setTime(window.__vfxStats.duration*.35);});
  // Range inputs canonicalize numeric strings; match their 0.001 step without
  // trailing zeros so Playwright can verify the value it just assigned.
  await page.locator('#timeline').fill(String(Number((last.duration*.65).toFixed(3))));await page.locator('#timeline').dispatchEvent('input');
  const scrubbed=await page.evaluate(()=>({time:window.__vfxStats.currentTime,playing:window.__vfxStats.playing}));
  assert(Math.abs(scrubbed.time-last.duration*.65)<.002 && !scrubbed.playing,'Timeline input failed to scrub and pause');
  await page.uncheck('#loop');
  return {id,pause:true,lastFrame:last,oneShot,looping,speedSelections:[.5,2],play:true,replay:true,timeline:true};
}

async function main() {
  const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
  assert(Array.isArray(catalog.items),'Catalog has no items');
  const sourceItems=new Map(catalog.items.map(item=>[item.id,item]));
  const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1});
  const errors=[],consoleErrors=[],requests=[],failedRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('request',request=>requests.push(request.url()));
  page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
  const report={viewer:path.relative(repoPath('.'),htmlPath),catalog:path.relative(repoPath('.'),catalogPath),
    expectedEffects:48,models:[],ghosting:[],camera:[],errors,consoleErrors,failedRequests,passed:false};
  try {
    await page.goto(pathToFileURL(htmlPath).href);
    await page.waitForFunction(()=>window.__vfxReady || window.__vfxStats?.error,null,{timeout:60000});
    assert(await page.evaluate(()=>window.__vfxReady),'Workbench did not become ready: '+JSON.stringify(await page.evaluate(()=>window.__vfxStats)));
    const available=await page.evaluate(()=>window.__vfxWorkbench.availableItems);
    assert(available.length===48,'Expected 48 actual available GLBs, found '+available.length);
    for(const item of available) {
      assert(sourceItems.has(item.id),'Embedded effect absent from source catalog: '+item.id);
      await page.evaluate(async id=>{const w=window.__vfxWorkbench;await w.selectEffect(id);w.setPlaying(false);w.setAutoRotate(false);w.setTarget('none');w.controls.enableDamping=false;},item.id);
      await page.uncheck('#outline');
      const initial=await page.evaluate(()=>({...window.__vfxStats,models:undefined}));
      assert(initial.selectedId===item.id && initial.ready,item.id+': selection did not finish');
      assert(initial.meshCount>0 && initial.triangleCount>0 && initial.texturesReady,item.id+': invalid geometry or undecoded texture');
      assert(initial.animationClipCount>0 && initial.animationTrackCount>0 && initial.animatedNodeCount>0 && initial.duration>0,item.id+': no actual GLB animation');
      const a=await sampleModel(page,.15),b=await sampleModel(page,.65);
      assert(a.finite && b.finite,item.id+': nonfinite world matrix');
      assert(a.meshCount===initial.meshCount && a.coloredMeshes===a.meshCount && a.unlitMeshes===a.meshCount,item.id+': missing actual vertex color or unlit material');
      assert(a.visiblePixels>0 && b.visiblePixels>0,item.id+': transparent canvas is empty at 15% or 65% of its clip');
      const changedElements=a.matrices.reduce((count,value,index)=>count+(Math.abs(value-b.matrices[index])>1e-7?1:0),0);
      assert(changedElements>0,item.id+': actual mesh transforms did not change between sampled times');
      delete a.matrices;delete b.matrices;
      const delivered=await embeddedDownload(page);
      const source=fs.readFileSync(path.resolve(path.dirname(catalogPath),sourceItems.get(item.id).model));
      const expected={bytes:source.length,sha256:hash(source)};
      assert(delivered.bytes===expected.bytes && delivered.sha256===expected.sha256 && delivered.bytes===initial.sourceBytes,item.id+': embedded download differs from actual GLB');
      assert(delivered.magic.join(',')==='103,108,84,70' && delivered.filename===item.id+'.glb' && delivered.urlType==='blob',item.id+': invalid download link');
      report.models.push({id:item.id,stats:initial,samples:[a,b],changedMatrixElements:changedElements,download:delivered,source:expected});
      console.log(JSON.stringify({id:item.id,meshes:initial.meshCount,tracks:initial.animationTrackCount,visiblePixels:[a.visiblePixels,b.visiblePixels],downloadMatches:true}));
    }

    report.transport=await verifyTransport(page);
    for(const id of ['machine-gun-muzzle','large-explosion','repair-stitch'])report.camera.push(await verifyCamera(page,id));

    await page.evaluate(()=>window.__vfxWorkbench.setTime(window.__vfxStats.duration*.35));
    const targets=[];
    for(const value of ['wood','metal','cloth','none']) {
      await page.selectOption('#target',value);await frames(page,2);
      const actual=await page.evaluate(()=>window.__vfxStats.target);
      assert(actual===value,'Comparison target did not change to '+value);targets.push(value);
    }
    await page.click('#background');
    assert(await page.evaluate(()=>window.__vfxStats.background)==='deepteal','Deep teal background toggle failed');
    await page.click('#background');
    assert(await page.evaluate(()=>window.__vfxStats.background)==='cream','Cream background toggle failed');
    report.presentation={targets,backgrounds:['deepteal','cream']};

    await page.selectOption('#weapon-filter','01-machine-gun');
    await page.waitForFunction(()=>window.__vfxReady && window.__vfxStats.weaponId==='01-machine-gun');
    const filtered=await page.locator('#effect-select option').count();
    const expectedFiltered=available.filter(item=>item.weapon_id==='01-machine-gun').length;
    assert(filtered===expectedFiltered && filtered>0,'Weapon filter did not select its actual effects');
    await page.selectOption('#weapon-filter','all');
    await page.waitForFunction(()=>window.__vfxReady);
    assert(await page.locator('#effect-select option:not([disabled])').count()===48,'All-effects filter did not restore 48 choices');
    report.filter={weapon:'01-machine-gun',choices:filtered,allChoices:48};

    // Exercise the user-facing download button too; Playwright's temporary
    // download is inspected without adding another asset copy to this report.
    const downloadId=await page.evaluate(()=>window.__vfxStats.selectedId);
    const downloadPromise=page.waitForEvent('download');await page.click('#download');
    const download=await downloadPromise,downloadPath=await download.path();
    assert(downloadPath,'Browser download did not produce a file');
    const downloaded=fs.readFileSync(downloadPath);
    const expectedDownload=report.models.find(model=>model.id===downloadId).source;
    assert(downloaded.length===expectedDownload.bytes && hash(downloaded)===expectedDownload.sha256,'Actual button download differs from source GLB');
    report.buttonDownload={id:downloadId,filename:download.suggestedFilename(),bytes:downloaded.length,sha256:hash(downloaded),matchesSource:true};

    for(const id of representatives) {
      const result=await ghosting(page,id);report.ghosting.push(result);
      assert(result.changedPixels===0 && result.totalChannelDifference===0 && result.cameraUnchanged && result.animationTimeUnchanged && result.outlineAutoClear,id+': outline ghosting regression failed');
    }

    await page.setViewportSize({width:390,height:844});await frames(page,6);
    const mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
      viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
      canvasWidth:document.querySelector('#stage canvas').getBoundingClientRect().width,
      finiteProjection:Object.values(window.__vfxWorkbench.camera.projectionMatrix.elements).every(Number.isFinite)}));
    assert(!mobile.overflow && mobile.canvasWidth>0 && mobile.finiteProjection,'Mobile overflow or canvas sizing failed');
    await page.screenshot({path:path.join(reportDir,'qa-mobile.png'),fullPage:true});
    report.mobile=mobile;
    report.externalRequests=requests.filter(url=>/^https?:/i.test(url));
    assert(!errors.length && !consoleErrors.length,'Browser emitted errors');
    assert(!report.externalRequests.length && !failedRequests.length,'Offline workbench attempted an external or failed request');
    report.passed=true;
  } catch(error) {
    report.failure=error.message;
    report.externalRequests=requests.filter(url=>/^https?:/i.test(url));
    await page.screenshot({path:path.join(reportDir,'qa-failure.png'),fullPage:true}).catch(()=>{});
    process.exitCode=1;
  } finally {
    fs.writeFileSync(path.join(reportDir,'qa-result.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({passed:report.passed,models:report.models.length,ghosting:report.ghosting.map(item=>({id:item.id,changedPixels:item.changedPixels})),errors,consoleErrors,externalRequests:report.externalRequests,mobile:report.mobile,failure:report.failure},null,2));
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
