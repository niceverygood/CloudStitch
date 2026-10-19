'use strict';
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {launchBrowser}=require('../../lib/runtime.cjs');
const {buildGallery}=require('./gallery.cjs');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-fleet-reference-v2'),work=path.join(root,'work/enemy-fleet-reference-v2');
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function main(){
  if(process.argv.includes('--help')){console.log('node tools/enemy-fleet-reference/villain-v2/capture.cjs [--ids=ID,ID]');return;}
  const catalog=JSON.parse(fs.readFileSync(path.join(out,'catalog.json'),'utf8'));
  const ids=process.argv.find(arg=>arg.startsWith('--ids='))?.slice(6).split(',');
  fs.mkdirSync(work,{recursive:true});fs.mkdirSync(path.join(out,'previews'),{recursive:true});
  const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});
  const receipt={startedAt:new Date().toISOString(),ships:[],scope:'Actual GLB screenshots, one browser and one page sequentially. No game-play verification.'};
  try{
    const page=await browser.newPage({viewport:{width:1100,height:950},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const ship of catalog.ships.filter(s=>!ids||ids.includes(s.id))){
      await page.goto(pathToFileURL(path.join(out,ship.viewerPath)).href);
      await page.waitForFunction(()=>window.__enemyReference?.ready||window.__rigStats?.error,null,{timeout:60000});
      await page.evaluate(()=>{if(window.__rigStats?.error)throw Error(window.__rigStats.error);const v=window.__rigViewer;v.setPlaying(false);v.setAutoRotate(false);v.setComparison(false);v.setSilhouette(false);v.setMode('handdrawn');v.setProfile('FloatIdle');v.setTime(2);v.controls.enableDamping=false;v.reset();window.__enemyReference.setWeakpoints(false);document.querySelectorAll('.stage-label,.view-tools,.caption').forEach(e=>e.style.display='none');});
      await page.waitForTimeout(150);
      await page.locator('#stage').screenshot({path:path.join(out,ship.previewPath)});
      ship.silhouettePath='previews/'+ship.id+'-silhouette.png';
      await page.evaluate(()=>window.__rigViewer.setSilhouette(true));await page.waitForTimeout(100);
      await page.locator('#stage').screenshot({path:path.join(out,ship.silhouettePath)});
      await page.evaluate(()=>window.__rigViewer.setSilhouette(false));
      if(ship.deployRig){
        await page.evaluate(()=>{window.__enemyReference.setDeployment(true);window.__rigViewer.reset();});await page.waitForTimeout(100);
        ship.deployedPreviewPath='previews/'+ship.id+'-deployed.png';
        await page.locator('#stage').screenshot({path:path.join(out,ship.deployedPreviewPath)});
      }
      ship.previewSourceSha256=ship.sha256;ship.previewCapturedAt=new Date().toISOString();
      receipt.ships.push({id:ship.id,sourceSha256:ship.sha256,previewPath:ship.previewPath,silhouettePath:ship.silhouettePath,deployedPreviewPath:ship.deployedPreviewPath||null});
      fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
      console.log(JSON.stringify({captured:ship.id}));
    }
    const ready=catalog.ships.filter(s=>s.previewSourceSha256===s.sha256&&fs.existsSync(path.join(out,s.previewPath)));
    for(const silhouette of [false,true]){
      const html='<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#f4eddf;color:#283d3b;font:16px system-ui}h1{margin:0;font-size:30px}p{margin:8px 0 22px;font-size:14px;color:#6c7264}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{border:1px solid #c4bead;border-radius:12px;background:#fffaf0;overflow:hidden}.card img{display:block;width:100%;height:315px;object-fit:contain}.label{border-top:1px solid #ded6c6;padding:12px 16px;font-weight:700}</style><h1>Cloudstitch · 악당의 얼굴을 가진 여섯 함선'+(silhouette?' · 실루엣':'')+'</h1><p>실제 새 GLB 렌더 · 개별 화면 맞춤 · 각 척의 게임상 상대 크기는 미확정</p><div class="grid">'+ready.map(s=>'<div class="card"><img src="'+pathToFileURL(path.join(out,silhouette?s.silhouettePath:s.previewPath)).href+'"><div class="label">'+esc(s.name)+'</div></div>').join('')+'</div>';
      const sheet=path.join(work,silhouette?'silhouette-sheet.html':'overview.html');fs.writeFileSync(sheet,html);
      await page.setViewportSize({width:1600,height:1000});await page.goto(pathToFileURL(sheet).href);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
      await page.screenshot({path:path.join(out,silhouette?'silhouette-sheet.png':'fleet-overview.png'),fullPage:true});
    }
    if(errors.length)throw Error(errors.join('\n'));
    receipt.browserErrors=errors;receipt.finishedAt=new Date().toISOString();receipt.result='PASS';
  }finally{await browser.close();fs.writeFileSync(path.join(out,'capture-receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
  console.log(JSON.stringify(buildGallery()));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
