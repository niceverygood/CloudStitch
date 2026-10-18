const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { repoPath, reportDirectory, launchBrowser } = require('../lib/runtime.cjs');
const reportDir = reportDirectory('viewer', process.argv[3]);
async function main() {
  const browser = await launchBrowser({args:['--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const errors=[],requests=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR:',e.message)});page.on('request',r=>requests.push(r.url()));
  page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE:',m.text())});
  const html=repoPath(process.argv[2] || 'outputs/selected-airship-toon3d/viewer-v2.html');
  await page.goto(pathToFileURL(html).href);
  try { await page.waitForFunction(()=>window.__toonReady===true || window.__toonStats?.error,null,{timeout:45000}); }
  catch(e) { console.error('READY DEBUG:', await page.evaluate(()=>({stats:window.__toonStats,text:document.getElementById('loading-text')?.textContent}))); await page.screenshot({path:path.join(reportDir,'qa-failure.png')}); throw e; }
  const initial=await page.evaluate(()=>window.__toonStats);
  if(!initial.ready)throw new Error(JSON.stringify(initial));
  for(const mode of ['handdrawn','cel','original']) {
    await page.click(`[data-mode="${mode}"]`);
    await page.waitForTimeout(350);
    const stats=await page.evaluate(()=>window.__toonStats);
    if(stats.mode!==mode)throw new Error('Mode did not change: '+mode);
    await page.screenshot({path:path.join(reportDir,`qa-${mode}.png`),fullPage:true});
  }
  const oldPosition=await page.evaluate(()=>window.__toonViewer.camera.position.toArray());
  await page.mouse.move(720,500);await page.mouse.down();await page.mouse.move(810,540,{steps:8});await page.mouse.up();await page.waitForTimeout(300);
  const newPosition=await page.evaluate(()=>window.__toonViewer.camera.position.toArray());
  if(JSON.stringify(oldPosition)===JSON.stringify(newPosition))throw new Error('Drag did not rotate camera');
  const oldZoom=await page.evaluate(()=>window.__toonViewer.camera.zoom);await page.mouse.wheel(0,-160);await page.waitForTimeout(200);
  if((await page.evaluate(()=>window.__toonViewer.camera.zoom))===oldZoom)throw new Error('Wheel did not zoom camera');
  const downloadPromise=page.waitForEvent('download');await page.click('#download');const download=await downloadPromise;
  const downloadPath=path.join(reportDir,'qa-download.glb');await download.saveAs(downloadPath);
  if(fs.statSync(downloadPath).size!==initial.sourceBytes)throw new Error('Embedded model download length mismatch');
  await page.click('#rotate');const rotating=await page.getAttribute('#rotate','aria-pressed');
  if(rotating!=='true')throw new Error('Auto rotate toggle failed');
  await page.click('#reset');const stopped=await page.getAttribute('#rotate','aria-pressed');
  if(stopped!=='false')throw new Error('Reset should stop automatic rotation');
  await page.click('#fit');await page.uncheck('#outline');
  if((await page.evaluate(()=>window.__toonStats.outlineEnabled))!==false)throw new Error('Outline toggle failed');
  await page.check('#outline');
  await page.locator('#thickness').fill('2.4');await page.locator('#thickness').dispatchEvent('input');
  const thickness=await page.evaluate(()=>window.__toonStats.outlinePixels);
  if(thickness!==2.4)throw new Error('Outline thickness failed');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  await page.screenshot({path:path.join(reportDir,'qa-mobile.png'),fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  const external=requests.filter(url=>/^https?:/.test(url));
  const result={initial,errors,externalRequests:external,mobileOverflow:overflow,dragRotate:true,wheelZoom:true,downloadBytes:fs.statSync(downloadPath).size,passed:errors.length===0&&external.length===0&&!overflow};
  fs.writeFileSync(path.join(reportDir,'qa-result.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));await browser.close();
  if(!result.passed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exit(1)});
