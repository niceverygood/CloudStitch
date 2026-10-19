// Central integration runs once in its exclusive browser slot after exact import.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {launchBrowser,repoPath}=require('../lib/runtime.cjs');
const url=process.env.SPATIAL_URL||'http://127.0.0.1:8840/outputs/voyage-spatial-v1/';
const OUT=repoPath(process.env.SPATIAL_QA_OUT||'outputs/voyage-spatial-browser-qa-v1');
const KEY='cloudstitch.voyage-campaign.v1';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const assetKeys=['profileId','ownerId','ship','parts','resources','settlements','repairReceipts','voyageSequence'];
const ledger=state=>Object.fromEntries(assetKeys.map(key=>[key,state[key]]));
const requireTrue=(condition,message)=>{if(!condition)throw Error(message);};
async function main(){
 requireTrue(!fs.existsSync(OUT),'Preserve prior QA; choose a fresh output directory');fs.mkdirSync(OUT,{recursive:true});
 const source=fs.readFileSync(repoPath('outputs/voyage-spatial-v1/source-manifest.json'));
 const report={version:'voyage-spatial-v1',url,passed:false,sourceManifestSha256:sha(source),checks:[],observations:{},pageErrors:[],consoleErrors:[],externalRequests:[],failedRequests:[],httpErrors:[],
  fixturePolicy:'All combat uses public input/controller and real GLB muzzle. Prior six-complete state is a separately labelled persistence fixture from the preserved actual READY2 report; no new six-voyage claim.',
  omitted:['No repeat of the old 26 unit/6-voyage48-kill suites.','No second XYZ flight simulation or vertical combat introduced.','No real phone or human art/feel approval.','Legacy import/fault matrix remains bound to the unchanged READY2 controller evidence.']};
 const check=(name,condition,detail)=>{report.checks.push({name,passed:!!condition,detail});console.log(`${condition?'PASS':'FAIL'} ${name}`);requireTrue(condition,name);};
 let browser,context,page,timer;
 try{
  browser=await launchBrowser();timer=setTimeout(()=>browser.close().catch(()=>{}),300000);
  context=await browser.newContext({viewport:{width:1440,height:900}});page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
  page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(url).origin)report.externalRequests.push(r.url());});
  page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
  const idle=()=>page.waitForFunction(()=>window.__campaign?.ready&&!__campaign.loading&&__campaign.stats().pendingLoads===0,undefined,{timeout:60000});
  const view=()=>page.evaluate(()=>({stats:__campaign.stats(),snapshot:__campaign.snapshot(),state:structuredClone(__campaign.controller.state),raw:localStorage.getItem('cloudstitch.voyage-campaign.v1'),grabbing:document.getElementById('scene').classList.contains('is-grabbing'),secondFlight:!!window.__flight3d,canvas:{width:document.getElementById('scene').clientWidth,height:document.getElementById('scene').clientHeight}}));
  const drag=async(button,dx,dy,x=720,y=440)=>{await page.mouse.move(x,y);await page.mouse.down({button});await page.mouse.move(x+dx,y+dy,{steps:9});await page.mouse.up({button});await page.waitForTimeout(80);};
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await idle();
  const initial=await view();report.observations.initial={camera:initial.stats.camera,environment:initial.stats.environment,level:initial.stats.level};
  check('perspective-whole-screen-single-campaign',initial.stats.camera.projection==='perspective'&&!initial.secondFlight&&initial.canvas.width===1440&&initial.canvas.height===900&&initial.stats.loadedWorldVisuals===8,report.observations.initial);
  await page.screenshot({path:path.join(OUT,'preview-departure.png')});

  const previewResults=[];
  const choices=await page.locator('#spatial-map-select option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean));
  for(const id of choices){
   await page.locator('#spatial-map-select').selectOption(id);await idle();await page.waitForFunction(id=>__campaign.stats().displayLevel===id+'-sea',id);
   const current=await view();previewResults.push({id,level:current.stats.level,visuals:current.stats.worldVisualIds,environment:current.stats.environment.counts,sameSave:current.raw===initial.raw,sameState:same(current.state,initial.state)});
   await page.screenshot({path:path.join(OUT,`preview-${id}.png`)});
  }
  report.observations.previews=previewResults;
  check('all-six-real-map-spaces-preview-without-progress-write',previewResults.length===6&&previewResults.every(v=>v.sameSave&&v.sameState&&v.visuals.length===8&&v.environment.islands===8&&v.environment.clouds>=16),previewResults);
  await page.locator('#spatial-map-select').selectOption('');await idle();await page.locator('#camera-reset').click();
  const beforeOrbit=await view();await drag('left',260,80);const left=await view();await drag('right',-100,-55);await drag('middle',80,40);
  await page.mouse.wheel(0,-220);await page.waitForTimeout(100);const zoomed=await view();
  await page.locator('#camera-button').click();await page.waitForTimeout(100);const fit=await view();await drag('left',70,20);const fitOrbit=await view();await page.screenshot({path:path.join(OUT,'preview-fit-whole-region.png')});await page.locator('#camera-reset').click();await page.waitForTimeout(100);const reset=await view();
  check('left-right-middle-orbit-wheel-fit-reset',Math.abs(left.stats.camera.yaw-beforeOrbit.stats.camera.yaw)>.8&&Math.abs(left.stats.camera.elevation-beforeOrbit.stats.camera.elevation)>.1&&zoomed.stats.camera.distance<beforeOrbit.stats.camera.distance&&fit.stats.camera.overview&&fitOrbit.stats.camera.overview&&fitOrbit.stats.camera.distance===fit.stats.camera.distance&&Math.abs(fitOrbit.stats.camera.yaw-fit.stats.camera.yaw)>.1&&!reset.stats.camera.overview&&reset.stats.camera.distance===42&&reset.raw===initial.raw,{left:left.stats.camera,zoom:zoomed.stats.camera,fit:fit.stats.camera,fitOrbit:fitOrbit.stats.camera,reset:reset.stats.camera});
  await page.screenshot({path:path.join(OUT,'preview-reset-behind.png')});

  const rays=await page.evaluate(()=>{
   const r=__campaign.renderer,points=[{x:0,y:0,z:55},{x:18,y:0,z:15},{x:25,y:0,z:30},{x:-35,y:0,z:20}];
   return points.map(point=>{const screen=r.projectPoint(point),hit=r.aimAt(screen.x,screen.y);return{point,screen,hit,error:hit?Math.hypot(hit.x-point.x,hit.z-point.z):null};});
  });check('perspective-screen-rays-return-identical-local-XZ',rays.every(r=>r.error!==null&&r.error<1e-6),rays);

  await page.locator('#quick-depart').click();await idle();await page.evaluate(()=>__campaign.command('pause'));const paused=await view();
  await drag('left',220,65,650,400);await page.mouse.wheel(0,-140);const dragged=await view();
  check('combat-grab-never-shoots-and-paused-camera-keeps-state',dragged.snapshot.sim.stats.shots===paused.snapshot.sim.stats.shots&&same(dragged.snapshot.sim.player,paused.snapshot.sim.player)&&dragged.snapshot.sim.time===paused.snapshot.sim.time&&!dragged.grabbing,{shots:dragged.snapshot.sim.stats.shots,time:dragged.snapshot.sim.time,camera:dragged.stats.camera});
  await page.locator('#camera-reset').click();await drag('right',38,20,650,380);await page.mouse.wheel(0,-120);
  await page.evaluate(()=>__campaign.command('resume'));
  const hitsBefore=await page.evaluate(()=>__campaign.eventLog.filter(e=>e.type==='hit'&&e.owner==='player'&&e.target==='module').length);
  await page.keyboard.down('j');let hitProof=null;
  for(let i=0;i<60&&!hitProof;i++){
   const target=await page.evaluate(()=>{const q=__campaign,s=q.snapshot(),e=s.sim.enemies.find(e=>!e.defeated);if(!e)return null;const root=e.modules.find(m=>m.key==='root'),c=Math.cos(e.angle),n=Math.sin(e.angle),x=e.x+(root?.localX||0)*c+(root?.localZ||0)*n,z=e.z-(root?.localX||0)*n+(root?.localZ||0)*c;return q.renderer.projectPoint({x,y:0,z});});
   if(target&&target.depth>-1&&target.depth<1)await page.mouse.move(target.x,target.y);await page.waitForTimeout(100);
   hitProof=await page.evaluate(before=>{const hits=__campaign.eventLog.filter(e=>e.type==='hit'&&e.owner==='player'&&e.target==='module');return hits.length>before?{hit:hits.at(-1),camera:__campaign.stats().camera,socket:__campaign.stats().socketAim}:null;},hitsBefore);
  }await page.keyboard.up('j');check('actual-UI-module-hit-after-camera-orbit-and-zoom',!!hitProof,hitProof);report.observations.hit=hitProof;
  await page.screenshot({path:path.join(OUT,'preview-actual-hit.png')});
  await page.addScriptTag({url:new URL('qa-driver.js',url).href});
  const voyage=await page.evaluate(()=>campaignQA.run({depart:false,maxSteps:2500}));
  await page.locator('#camera-reset').click();await page.waitForTimeout(100);const returnView=await page.evaluate(()=>({camera:__campaign.stats().camera,displayHeading:__campaign.renderer.playerWrapper.rotation.y}));
  const behindError=Math.abs(Math.atan2(Math.sin(returnView.camera.yaw-returnView.displayHeading+Math.PI),Math.cos(returnView.camera.yaw-returnView.displayHeading+Math.PI)));
  check('one-actual-sortie-real-socket-victory-return',voyage.returned&&voyage.saved&&voyage.stageCleared&&voyage.kills.length===6&&behindError<1e-6,{voyage,returnView,behindError});report.observations.voyage=voyage;
  if(await page.evaluate(()=>__campaign.snapshot().harbor.inventory.some(p=>p.status==='cargo')))await page.evaluate(()=>__campaign.command('store'));
  await page.evaluate(()=>__campaign.command('save'));const beforeNext=await view();const next=await page.evaluate(()=>__campaign.command('next-stage'));await idle();const afterNext=await view();
  await page.reload({waitUntil:'domcontentloaded'});await idle();const restored=await view();
  check('new-space-stage-transition-and-checkpoint-restore',next.ok&&same(ledger(beforeNext.state),ledger(afterNext.state))&&same(afterNext.state,restored.state)&&restored.snapshot.campaign.currentStageIndex===1&&restored.stats.displayLevel==='map-02-canyon-sea',{next,sameAssets:same(ledger(beforeNext.state),ledger(afterNext.state)),sameState:same(afterNext.state,restored.state),level:restored.stats.level});

  // Persistence-only fixture from the old actual six-sortie evidence. It does
  // not spawn enemies, change HP, complete this new battle, or count as play.
  const priorPath=repoPath('outputs/voyage-campaign-ready2-browser-qa-v1/runtime/browser-verification.json'),priorBytes=fs.readFileSync(priorPath),prior=JSON.parse(priorBytes);
  requireTrue(prior.passed&&prior.voyages.length===6,'Prior actual record missing');
  const oldState=prior.observations.final.state;
  const saved=await page.evaluate(state=>{const q=__campaign,loaded=q.controller.repository.load();return q.controller.repository.save(state,{expectedRevision:loaded.revision,boundary:state.boundary});},oldState);requireTrue(saved.ok,'Could not stage persistence-only existing-record fixture');
  await page.reload({waitUntil:'domcontentloaded'});await idle();const oldRestored=await view();
  check('prior-six-complete-record-keeps-assets-in-new-space',same(oldState,oldRestored.state)&&oldRestored.snapshot.campaign.campaignComplete&&oldRestored.stats.displayLevel==='map-06-palace-sea',{fixture:'prior actual six-complete safe state',source:priorPath,sourceSha256:sha(priorBytes),parts:oldRestored.state.parts.length,resources:oldRestored.state.resources,level:oldRestored.stats.level});
  await page.screenshot({path:path.join(OUT,'preview-prior-record-stage6.png')});

  const raster=await page.evaluate(async()=>{
   const q=__campaign,r=q.renderer;r.orbit(180,55);for(let i=0;i<60;i++){r.orbit(3,0);r.renderFixed();}const accumulated=r.capture();r.clear();r.renderFixed();const clean=r.capture();
   const pixels=async url=>{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};
   const a=await pixels(accumulated),b=await pixels(clean);let differentPixels=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])differentPixels++;
   return {differentPixels,clearing:r.stats().clearing};
  });check('sixty-orbit-frames-leave-no-ghosts',raster.differentPixels===0&&raster.clearing.rendererAutoClear&&raster.clearing.outlineAutoClear,raster);

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(180);await page.locator('#camera-reset').click();
  const client=await context.newCDPSession(page);await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});const mobileBefore=await view();
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:175,y:380,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:235,y:415,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(100);await client.send('Emulation.setTouchEmulationEnabled',{enabled:false});await client.detach();
  const mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,canvas:document.getElementById('scene').clientWidth,viewport:innerWidth,level:__campaign.stats().level,camera:__campaign.stats().camera,grabbing:document.getElementById('scene').classList.contains('is-grabbing')}));
  check('mobile-whole-space-and-CDP-touch-orbit',!mobile.overflow&&mobile.canvas===390&&!mobile.grabbing&&Math.abs(mobile.camera.yaw-mobileBefore.stats.camera.yaw)>.1,mobile);await page.screenshot({path:path.join(OUT,'preview-mobile.png')});
  check('unexpected-browser-and-external-requests-zero',!report.pageErrors.length&&!report.consoleErrors.length&&!report.externalRequests.length&&!report.failedRequests.length&&!report.httpErrors.length,{pageErrors:report.pageErrors,consoleErrors:report.consoleErrors,external:report.externalRequests,failed:report.failedRequests,http:report.httpErrors});
  report.passed=report.checks.length===12&&report.checks.every(c=>c.passed);
 }catch(error){report.error=error.stack||String(error);console.error(error);}
 finally{clearTimeout(timer);if(browser)await browser.close().catch(()=>{});report.browserClosed=true;report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'browser-verification.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,output:OUT}));if(!report.passed)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1});
