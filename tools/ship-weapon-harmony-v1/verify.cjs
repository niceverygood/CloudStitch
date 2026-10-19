const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url'),{launchBrowser}=require('../lib/runtime.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/ship-weapon-harmony-v1'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const assert=(x,s)=>{if(!x)throw new Error(s)};
const report={passed:false,exports:[],displays:[],downloads:[],ghosting:[],errors:[],external:[],failedRequests:[]};
const frames=(p,n=3)=>p.evaluate(n=>new Promise(resolve=>{function f(){if(--n<=0)resolve();else requestAnimationFrame(f)}requestAnimationFrame(f)}),n);
async function main(){
 if(!process.argv.includes('--slot-start'))throw new Error('Explicit central slot START is required');
 const build=JSON.parse(fs.readFileSync(path.join(out,'build-manifest.json'),'utf8'));
 const branchArg=process.argv.indexOf('--branch'),targets=branchArg>=0?[process.argv[branchArg+1]]:['mobility','artillery','salvage'];
 assert(targets.every(x=>['mobility','artillery','salvage'].includes(x)),'Unknown branch');report.scope=targets;
 for(const s of build.sources)assert(sha(fs.readFileSync(path.join(root,s.path)))===s.sha256,'Source changed before export '+s.path);
 const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});let page;
 try{
  page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('request',r=>{if(/^https?:/.test(r.url()))report.external.push(r.url())});page.on('requestfailed',r=>report.failedRequests.push(r.url()));
  const url=pathToFileURL(path.join(out,'index.html')).href;await page.goto(url);await page.waitForFunction(()=>window.__harmony?.ready||window.__harmony?.error,null,{timeout:120000});assert(await page.evaluate(()=>window.__harmony.ready),'Initial viewer failed');
  const placementFile=path.join(out,'placement.json'),previousPlacements=fs.existsSync(placementFile)?JSON.parse(fs.readFileSync(placementFile,'utf8')).placements:[],placementMap=new Map(previousPlacements.map(p=>[p.id,p]));
  for(const id of targets){
   const result=await page.evaluate(id=>window.__harmony.exportOne(id),id),bytes=Buffer.from(result.base64,'base64');
   fs.writeFileSync(path.join(out,id+'-assembled.glb'),bytes);assert(bytes.subarray(0,4).toString()==='glTF','Not real GLB');
   const validator=require(process.env.GLTF_VALIDATOR_PATH||'gltf-validator');const v=await validator.validateBytes(new Uint8Array(bytes),{maxIssues:100});
   const record={id,path:id+'-assembled.glb',bytes:bytes.length,sha256:sha(bytes),stats:result.stats,validator:{errors:v.issues.numErrors,warnings:v.issues.numWarnings,infos:v.issues.numInfos,messages:v.issues.messages}};
   report.exports.push(record);assert(!record.validator.errors,'Official GLB errors '+id);
   placementMap.set(id,{...result.record,assembled:record,source_ship:build.sources.find(s=>s.path.endsWith(id+'-r5.glb')),source_weapon:build.sources.find(s=>s.path.includes(id==='mobility'?'03-repeating':id==='artillery'?'13-comet':'04-harpoon'))});
  }
  fs.writeFileSync(path.join(out,'placement.json'),JSON.stringify({date:'2026-10-19',contract:build.contract,ship_baseline:'ranks-1to5-v2 final structure revision',assembly_hull_scale:[1,1,1],placements:[...placementMap.values()],limitations:'Static art placement; no gameplay sockets, aiming, firing, physics, damage, load budget or swept movement clearance.'},null,2)+'\n');
  const child=spawnSync(process.execPath,[path.join(__dirname,'build.cjs')],{cwd:root,env:process.env,encoding:'utf8'});if(child.status!==0)throw new Error(child.stderr||child.stdout);
  await page.goto(url);await page.waitForFunction(()=>window.__harmony?.ready||window.__harmony?.error,null,{timeout:120000});assert(await page.evaluate(()=>window.__harmony.ready),'Exported reload failed');
  for(const id of targets){
   await page.evaluate(id=>window.__harmony.select(id),id);await frames(page);
   for(const mode of['painted','cel','original']){
    const stats=await page.evaluate(mode=>{const v=window.__harmony;v.setMode(mode);v.render();const s=v.renderer.domElement,c=document.createElement('canvas');c.width=s.width;c.height=s.height;const ctx=c.getContext('2d');ctx.drawImage(s,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let left=0,right=0;for(let i=3;i<p.length;i+=4)if(p[i]>8){if(((i-3)/4)%c.width<c.width/2)left++;else right++;}return {...v.stats,leftPixels:left,rightPixels:right}},mode);
    assert(stats.exportedGLBLoaded&&stats.sharedCamera&&stats.after.finite&&stats.before.finite&&stats.outlineAutoClear&&stats.leftPixels>1000&&stats.rightPixels>1000,'Actual GLB display '+id+'/'+mode);report.displays.push(stats);
   }
   await page.evaluate(()=>window.__harmony.setMode('painted'));
   for(const view of['iso','side','top']){await page.evaluate(view=>window.__harmony.setView(view),view);await frames(page);await page.locator('#stage').screenshot({path:path.join(out,id+'-'+view+'.png')});}
   await page.evaluate(()=>window.__harmony.closeup());await frames(page);await page.locator('#stage').screenshot({path:path.join(out,id+'-closeup.png')});
   const download=await page.evaluate(async()=>{const a=document.getElementById('download'),b=new Uint8Array(await(await fetch(a.href)).arrayBuffer()),digest=new Uint8Array(await crypto.subtle.digest('SHA-256',b));return{bytes:b.length,sha256:[...digest].map(x=>x.toString(16).padStart(2,'0')).join(''),name:a.download}});
   const expected=report.exports.find(x=>x.id===id);assert(download.sha256===expected.sha256&&download.bytes===expected.bytes,'Download mismatch');report.downloads.push({id,...download});
  }
  await page.evaluate(()=>{window.__harmony.select('artillery');window.__harmony.reset()});
  for(const mode of['painted','cel','original']){const g=await page.evaluate(async mode=>{const v=window.__harmony;v.setMode(mode);v.controls.autoRotateSpeed=20;v.controls.autoRotate=true;await new Promise(resolve=>{let n=120;function f(){if(--n<=0)resolve();else requestAnimationFrame(f)}requestAnimationFrame(f)});v.controls.autoRotate=false;const read=()=>{const s=v.renderer.domElement,c=document.createElement('canvas');c.width=s.width;c.height=s.height;const x=c.getContext('2d');x.drawImage(s,0,0);return x.getImageData(0,0,c.width,c.height).data};v.render();const a=read(),cam=v.camera.position.toArray();v.renderer.clear(true,true,true);v.render();const b=read();let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])changed++;return{mode,rotation_frames:120,changedPixels:changed,camera_unchanged:cam.every((x,i)=>x===v.camera.position.toArray()[i])};},mode);report.ghosting.push(g);assert(g.changedPixels===0&&g.camera_unchanged,'Ghosting '+mode);}
  await page.evaluate(()=>window.__harmony.reset());const box=await page.locator('canvas').boundingBox(),before=await page.evaluate(()=>window.__harmony.camera.position.toArray());await page.mouse.move(box.x+box.width*.7,box.y+box.height*.55);await page.mouse.down();await page.mouse.move(box.x+box.width*.7+60,box.y+box.height*.55+20,{steps:5});await page.mouse.up();await frames(page);assert(await page.evaluate(a=>window.__harmony.camera.position.toArray().some((x,i)=>Math.abs(x-a[i])>1e-6),before),'Drag failed');
  const z=await page.evaluate(()=>window.__harmony.camera.zoom);await page.mouse.wheel(0,-150);await frames(page);assert(await page.evaluate(z=>window.__harmony.camera.zoom!==z,z),'Zoom failed');await page.click('#fit');assert(await page.evaluate(()=>window.__harmony.camera.zoom===1),'Fit failed');await page.click('#rotate');await frames(page,6);await page.click('#reset');assert(await page.evaluate(()=>!window.__harmony.controls.autoRotate),'Reset failed');await page.uncheck('#outline');await frames(page);await page.check('#outline');report.controls=true;
  const dlPromise=page.waitForEvent('download');await page.click('#download');const dl=await dlPromise;assert(sha(fs.readFileSync(await dl.path()))===report.exports.find(x=>x.id==='artillery').sha256,'Button download mismatch');report.button_download=true;
  await page.setViewportSize({width:390,height:1000});await frames(page,6);report.mobile=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth,finite:window.__harmony.camera.projectionMatrix.elements.every(Number.isFinite)}));assert(!report.mobile.overflow&&report.mobile.finite,'Mobile failed');await page.screenshot({path:path.join(out,'mobile390.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1100});await page.evaluate(()=>{window.__harmony.select('mobility');window.__harmony.setMode('painted')});await frames(page);await page.screenshot({path:path.join(out,'overview.png'),fullPage:true});
  assert(!report.errors.length&&!report.external.length&&!report.failedRequests.length,'Browser errors');
  for(const s of build.sources)assert(sha(fs.readFileSync(path.join(root,s.path)))===s.sha256,'Source changed after render');report.source_post_sha_preserved=build.sources.length;report.passed=true;
 }catch(e){report.failure=e.stack;process.exitCode=1;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
 finally{await browser.close();report.finallyClosed=true;fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,exports:report.exports.length,displays:report.displays.length,downloads:report.downloads.length,ghosting:report.ghosting,mobile:report.mobile,errors:report.errors,failure:report.failure,finallyClosed:true}));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
