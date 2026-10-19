// One bounded browser run: real models, previews, modes, clips, ghosting and responsive layout.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'outputs/map-atmosphere-v1'),deps=process.env.CLOUDSTITCH_NODE_MODULES;
const {chromium}=require(require.resolve('playwright',{paths:[deps||ROOT,ROOT]}));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const url=process.argv[2]||pathToFileURL(path.join(OUT,'index.html')).href;
const report={schema:1,harness:'tools/map-atmosphere-v1/verify-browser.cjs',harness_sha256:sha(__filename),url,started_at:new Date().toISOString(),models:[],ghosting:[],checks:[],errors:[],console_errors:[],external_requests:[],failed_requests:[]};
const check=(name,passed,detail)=>{report.checks.push({name,passed,detail});if(!passed)report.errors.push(name);};
const save=()=>{report.finished_at=new Date().toISOString();report.passed=!report.errors.length&&!report.console_errors.length&&!report.failed_requests.length&&!report.external_requests.length;fs.writeFileSync(path.join(OUT,'browser-verification.json'),JSON.stringify(report,null,2)+'\n');};
(async()=>{
 let browser;
 try{
  report.initial_html_sha256=sha(path.join(OUT,'index.html'));
  browser=await chromium.launch({headless:true,channel:process.env.CLOUDSTITCH_BROWSER_CHANNEL||'chrome'});
  const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1});
  page.on('pageerror',e=>report.console_errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.console_errors.push(m.text());});
  page.on('request',r=>{if(/^https?:/.test(r.url())&&!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.url()))report.external_requests.push(r.url());});
  page.on('requestfailed',r=>report.failed_requests.push({url:r.url(),reason:r.failure()?.errorText}));
  await page.goto(url,{waitUntil:'load',timeout:90000});await page.waitForFunction(()=>window.__worldReady&&window.__mapGallery,{timeout:90000});
  const items=await page.evaluate(()=>window.__mapGallery.items);check('logical_assets_24',items.length===24,items.length);
  fs.mkdirSync(path.join(OUT,'previews'),{recursive:true});fs.mkdirSync(path.join(OUT,'review-captures'),{recursive:true});
  for(const item of items){
   await page.evaluate(id=>window.__worldWorkbench.selectAsset(id),item.id);
   const result=await page.evaluate(()=>{const w=window.__worldWorkbench,g=window.__mapGallery;w.setPlaying(false);w.setAutoRotate(false);w.setMode('handdrawn');w.reset();g.renderNow();const gl=w.renderer.getContext(),a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);let painted=0;for(let i=3;i<a.length;i+=4)if(a[i]>128)painted++;return {id:w.selected.id,mesh_count:window.__worldStats.meshCount,triangles:window.__worldStats.triangleCount,animation_count:window.__worldStats.animationClipCount,painted_pixels:painted,preview:g.capturePreview()};});
   fs.writeFileSync(path.join(OUT,item.preview),Buffer.from(result.preview.split(',')[1],'base64'));delete result.preview;report.models.push(result);
   check('real_render_'+item.id,result.mesh_count===item.mesh_count&&result.triangles===item.triangles&&result.animation_count===item.animation_count&&result.painted_pixels>800,result);
  }
  report.comparisons=[];fs.mkdirSync(path.join(OUT,'comparisons'),{recursive:true});
  for(const id of ['root-garden','wind-tree','sunlit-cloud','harbor-gull','mail-balloon','lightning-mast']){
   const pair=await page.evaluate(id=>window.__mapGallery.captureComparison(id),id);
   for(const side of ['before','after'])fs.writeFileSync(path.join(OUT,'comparisons',id+'-'+side+'.png'),Buffer.from(pair[side].split(',')[1],'base64'));
   const different=pair.before!==pair.after;delete pair.before;delete pair.after;report.comparisons.push({...pair,different});check('same_camera_comparison_'+id,different&&pair.same_units_and_normalization&&pair.animation_time===0,pair);
  }
  const build=spawnSync(process.execPath,[path.join(__dirname,'build.cjs')],{cwd:ROOT,env:process.env,encoding:'utf8'});if(build.status!==0)throw Error(build.stderr||build.stdout||'Final preview build failed');
  report.final_html_sha256=sha(path.join(OUT,'index.html'));await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.__worldReady&&window.__mapGallery);
  // Force lazy preview loading, then check the actual decoded image dimensions.
  await page.evaluate(()=>document.querySelectorAll('.asset-card img').forEach(i=>i.loading='eager'));
  await page.waitForFunction(()=>[...document.querySelectorAll('.asset-card img')].every(i=>i.complete&&i.naturalWidth===480),{timeout:30000});check('preview_images_24',await page.locator('.asset-card img').count()===24);
  for(const id of ['root-garden','harbor-gull','lantern-buoy'])for(const mode of ['handdrawn','cel','original']){
   await page.evaluate(id=>window.__worldWorkbench.selectAsset(id),id);
   const r=await page.evaluate(mode=>{const w=window.__worldWorkbench,g=window.__mapGallery;w.setPlaying(false);w.setAutoRotate(false);w.controls.enableDamping=false;w.setTime(0);w.setMode(mode);w.reset();const root=w.root,gl=w.renderer.getContext(),n=gl.drawingBufferWidth*gl.drawingBufferHeight*4,a=new Uint8Array(n),b=new Uint8Array(n);for(let i=0;i<120;i++){root.rotation.y+=.025;g.renderNow();}g.renderNow();gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);w.renderer.clear();g.renderNow();gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,b);let different=0;for(let i=0;i<n;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])different++;root.rotation.set(0,0,0);w.reset();w.controls.enableDamping=true;return {different_pixels:different,outline_autoclear:w.effect.autoClear};},mode);
   report.ghosting.push({id,mode,...r});check('ghosting_'+id+'_'+mode,r.different_pixels===0&&r.outline_autoclear===true,r);
  }
  await page.evaluate(()=>window.__worldWorkbench.selectAsset('wind-swallows'));
  const motion=await page.evaluate(()=>{const w=window.__worldWorkbench,a=window.__mapGallery.active;w.setPlaying(false);w.setTime(0);const before=[];a.source.traverse(o=>before.push(...o.matrixWorld.elements));w.setTime(a.clip.duration*.31);const after=[];a.source.traverse(o=>after.push(...o.matrixWorld.elements));return before.some((v,i)=>Math.abs(v-after[i])>1e-5);});check('visible_bird_mesh_motion',motion);
  await page.locator('#category-filter').selectOption('birds');check('bird_filter_4',await page.locator('.asset-card:visible').count()===4);
  await page.locator('#search').fill('제비');await page.waitForTimeout(230);check('search_single_swallow',await page.locator('.asset-card:visible').count()===1);await page.locator('#search').fill('');await page.locator('#category-filter').selectOption('all');await page.waitForTimeout(230);
  await page.evaluate(()=>window.__worldWorkbench.selectAsset('root-garden'));
  const canvasBox=await page.locator('#stage canvas').boundingBox(),beforeOrbit=await page.evaluate(()=>window.__worldWorkbench.camera.position.toArray());
  await page.mouse.move(canvasBox.x+canvasBox.width*.45,canvasBox.y+canvasBox.height*.55);await page.mouse.down();await page.mouse.move(canvasBox.x+canvasBox.width*.62,canvasBox.y+canvasBox.height*.6,{steps:9});await page.mouse.up();await page.waitForTimeout(160);
  check('drag_rotates_camera',await page.evaluate(before=>window.__worldWorkbench.camera.position.toArray().some((v,i)=>Math.abs(v-before[i])>.01),beforeOrbit));
  const zoomBefore=await page.evaluate(()=>window.__worldWorkbench.camera.zoom);await page.mouse.wheel(0,-350);await page.waitForTimeout(140);check('wheel_zooms_camera',await page.evaluate(before=>window.__worldWorkbench.camera.zoom>before,zoomBefore));
  await page.locator('#outline').uncheck();check('outline_toggle_off',await page.evaluate(()=>window.__worldStats.outlineEnabled===false));await page.locator('#outline').check();check('outline_toggle_on',await page.evaluate(()=>window.__worldStats.outlineEnabled===true));
  await page.evaluate(()=>window.__worldWorkbench.reset());await page.setViewportSize({width:1440,height:1050});await page.waitForTimeout(150);
  await page.screenshot({path:path.join(OUT,'review-captures/desktop.png'),fullPage:false});await page.locator('.collection').screenshot({path:path.join(OUT,'review-captures/collection.png')});
  await page.evaluate(()=>window.__worldWorkbench.selectAsset('mail-balloon'));await page.screenshot({path:path.join(OUT,'review-captures/mail-balloon.png'),fullPage:false});
  await page.locator('[data-panel="compare-panel"]').click();check('comparison_tab_6',await page.locator('.compare-card:visible').count()===6);await page.locator('#compare-panel').screenshot({path:path.join(OUT,'review-captures/comparisons.png')});
  await page.locator('[data-panel="moods-panel"]').click();check('moodboard_tab',await page.locator('#moods-panel').isVisible());await page.locator('[data-panel="reference-panel"]').click();check('reference_tab',await page.locator('#reference-panel').isVisible());await page.locator('[data-panel="assets-panel"]').click();
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);check('mobile_no_overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(OUT,'review-captures/mobile.png'),fullPage:false});
  await page.evaluate(()=>{const w=window.__worldWorkbench;w.setView('back');w.fit();w.reset();w.setAutoRotate(true);w.setBackground('deepteal');});await page.waitForTimeout(180);const ui=await page.evaluate(()=>({rotate:window.__worldStats.autoRotate,background:window.__worldStats.background,view:window.__worldStats.view,download:document.querySelector('#download').href.startsWith('blob:')}));check('view_fit_reset_rotate_background_download',ui.rotate&&ui.background==='deepteal'&&ui.view==='iso'&&ui.download,ui);
  report.browser_version=browser.version();
 }catch(e){report.errors.push(e.stack||String(e));}
 finally{if(browser)await browser.close();report.browser_closed=true;save();}
 console.log(JSON.stringify({passed:report.passed,models:report.models.length,checks:report.checks.length,ghosting:report.ghosting.length,errors:report.errors,console:report.console_errors,failed:report.failed_requests,external:report.external_requests}));if(!report.passed)process.exitCode=1;
})();
