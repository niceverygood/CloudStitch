const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const{pathToFileURL}=require('node:url');
const{repoPath,reportDirectory,launchBrowser}=require('../lib/runtime.cjs');
(async()=>{
 const reportDir=reportDirectory('fleet-labels',process.argv[2]),catalog=JSON.parse(fs.readFileSync(repoPath('outputs/fleet-v1/catalog.json')));
 const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']}),results=[];
 try{
  for(const id of ['civil-relief','enemy-union-repair','player-homeward']){
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{await page.goto(pathToFileURL(repoPath(`outputs/fleet-v1/ships/${id}.html`)).href);await page.waitForFunction(()=>window.__rigReady===true,null,{timeout:60000});
    const result=await page.evaluate(()=>({clips:window.__rigStats.animationClipCount,supported:window.__rigStats.availableActions,buttons:[...document.querySelectorAll('[data-profile]')].map(b=>({profile:b.dataset.profile,label:b.textContent,disabled:b.disabled}))}));
    assert.equal(result.clips,7);assert.deepEqual(result.supported,catalog.ships.find(s=>s.id===id).availableActions);
    for(const button of result.buttons)assert.equal(button.disabled,!result.supported.includes(button.profile));
    assert.equal(result.buttons.find(b=>b.profile==='FireBurst').label,id==='player-homeward'?'포격 반동':'장치 반응');
    if(id!=='player-homeward')assert.equal(result.buttons.find(b=>b.profile==='WinchCycle').label,'인양·지원 작업');
    assert.equal(errors.length,0);results.push({id,...result,errors,passed:true});
   }finally{await page.close();}
  }
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:59306/'))external.push(r.url())});page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto('http://127.0.0.1:59306/outputs/fleet-v1/index.html');await page.waitForFunction(()=>window.__fleetViewer?.loadedViewers===1);const child=page.frames().find(f=>f.url().endsWith('player-homeward.html'));await child.waitForFunction(()=>window.__rigReady===true,null,{timeout:60000});
  const delivery=await page.evaluate(()=>({cards:document.querySelectorAll('[data-ship-id]').length,loadedViewers:window.__fleetViewer.loadedViewers,currentId:window.__fleetViewer.currentId,overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.equal(delivery.cards,71);assert.equal(delivery.loadedViewers,1);assert.equal(delivery.overflow,false);assert.equal(errors.length,0);assert.equal(external.length,0);
  const report={passed:true,results,localHttpGallery:{...delivery,errors,externalRequests:external,url:'http://127.0.0.1:59306/outputs/fleet-v1/index.html'}};
  fs.writeFileSync(path.join(reportDir,'qa-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,models:results.length,localHttpGallery:delivery}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
