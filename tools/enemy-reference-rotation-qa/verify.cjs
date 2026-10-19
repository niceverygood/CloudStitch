const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {launchBrowser,repoPath}=require('../lib/runtime.cjs');
const output=repoPath('outputs/enemy-reference-rotation-qa-v1'),url='http://127.0.0.1:8840/outputs/enemy-fleet-reference-v1/ships/enemy-ghost-chaser.html';
const checks=[],samples=[],errors=[],external=[],failed=[];const check=(name,passed,detail)=>checks.push({name,passed:!!passed,detail});
const frames=(page,n)=>page.evaluate(n=>new Promise(resolve=>{let count=0;function next(){if(++count>=n)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);}),n);
const snapshot=page=>page.evaluate(()=>{const v=__rigViewer;return {mode:__rigStats.mode,autoRotate:__rigStats.autoRotate,playing:__rigStats.playing,time:__rigStats.time,camera:v.camera.position.toArray(),cameraQuaternion:v.camera.quaternion.toArray(),rigPosition:v.rig.position.toArray(),rigQuaternion:v.rig.quaternion.toArray(),outlineAutoClear:v.outlineEffect.autoClear,rendererAutoClear:v.renderer.autoClear,renderCalls:v.renderer.info.render.calls};});
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await launchBrowser(),page=await browser.newPage({viewport:{width:1280,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(url).origin)external.push(r.url());});page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
 try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__rigReady&&window.__enemyReference?.ready,undefined,{timeout:60000});
  check('actual-ghost-model-ready',await page.evaluate(()=>__rigViewer.rig.userData.assetId==='enemy-ghost-chaser'&&__rigStats.texturesReady&&__rigStats.triangleCount>0));
  for(const mode of ['handdrawn','cel','original']){
   await page.locator(`[data-mode="${mode}"]`).click();await page.locator('#reset').click();await page.evaluate(()=>{const v=__rigViewer;v.setPlaying(false);v.setProfile('FloatIdle');v.setTime(.4);v.setComparison(false);v.setSilhouette(false);v.controls.enableDamping=false;});await frames(page,3);
   const before=await snapshot(page),trajectory=[];await page.locator('#rotate').click();for(let step=0;step<3;step++){await frames(page,60);trajectory.push(await snapshot(page));}await page.locator('#rotate').click();await frames(page,3);const after=await snapshot(page);
   const file=mode+'-after-rotation.png';await page.screenshot({path:path.join(output,file),fullPage:true});
   const distance=Math.hypot(...after.camera.map((v,i)=>v-before.camera[i]));
   check(mode+':actual180frames-camera-rotation-and-runtime-clear',distance>.01&&trajectory.every(s=>s.autoRotate&&s.mode===mode&&s.outlineAutoClear&&s.renderCalls>0)&&!after.autoRotate,{distance,before,trajectory,after,screenshot:file,meaning:'No pixel-equality or decoded ghosting assertion. The three captured post-rotation frames require separate visual review.'});samples.push({mode,file,before,trajectory,after});
  }
  check('page-external-and-failed-requests-zero',errors.length===0&&external.length===0&&failed.length===0,{errors,external,failed});
 }catch(e){check('harness-completed',false,e.message);}finally{await browser.close();}
 const report={scope:'One representative translucent ghost ship; three modes,180actualRAF rotation frames each, camera and actualOutlineEffect.autoClear observations, three PNGs. Separate from273QA and53source.',passed:checks.every(c=>c.passed),checks,samples,visualReview:'pending-separate-PNG-inspection',preciseGhosting:'not-run',longPerformance:'not-run',sourceManifestSha256:'679421632594a7864b1790aecd85267580ad362bf96ee966879c479d5cf62d8f',harnessSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')};
 fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:checks.length,output}));if(!report.passed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
