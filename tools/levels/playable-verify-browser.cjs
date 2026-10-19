// Integration owner runs this once, against the new playable entry. No new browser install.
const fs=require('node:fs'),path=require('node:path');
const {launchBrowser,repoPath}=require('../lib/runtime.cjs');
const url=process.env.PLAYABLE_URL||'http://127.0.0.1:8860/outputs/playable-battlefield-v1/index.html';
const output=repoPath('outputs/playable-battlefield-v1'),work=repoPath('work/verification/playable-battlefield');
async function main(){
  fs.mkdirSync(work,{recursive:true});const browser=await launchBrowser(),page=await browser.newPage({viewport:{width:1440,height:900}});
  const checks=[],samples=[],errors=[],externalRequests=[],failedRequests=[];
  const check=(name,passed,detail)=>{checks.push({name,passed:!!passed,detail});console.log(`${passed?'PASS':'FAIL'} ${name}`);};
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==new URL(url).origin)externalRequests.push(request.url());});page.on('requestfailed',request=>failedRequests.push({url:request.url(),reason:request.failure()?.errorText}));
  try{
    await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__playableBattlefield?.ready,undefined,{timeout:60000});
    await page.evaluate(()=>window.__playableBattlefield.whenIdle());
    const first=await page.evaluate(()=>window.__playableBattlefield.stats());samples.push({phase:'initial-harbor',...first});
    check('real-ship-and-harbor-GLBs',first.worldVisualIds.includes('workshop')&&first.worldVisualIds.includes('market')&&first.visibleMeshes>1&&first.effects.loaded,first);
    check('full-screen-play-area',await page.locator('#scene').evaluate(node=>node.clientWidth>=innerWidth*.98&&node.clientHeight>=innerHeight*.98));
    await page.screenshot({path:path.join(output,'preview-harbor.png')});
    await page.locator('.dock-depart').click();await page.evaluate(()=>window.__playableBattlefield.whenIdle());
    await page.locator('#scene').focus();const start=await page.evaluate(()=>window.__playableBattlefield.snapshot().sim.player.x);
    await page.keyboard.down('KeyD');await page.waitForTimeout(450);await page.keyboard.up('KeyD');
    check('keyboard-advances-authoritative-player',await page.evaluate(x=>window.__playableBattlefield.snapshot().sim.player.x>x+1,start));
    await page.keyboard.press('Escape');const paused=await page.evaluate(()=>window.__playableBattlefield.snapshot().sim.time);await page.waitForTimeout(200);
    check('pause-stops-combat-time',await page.evaluate(time=>window.__playableBattlefield.snapshot().paused&&window.__playableBattlefield.snapshot().sim.time===time,paused));await page.keyboard.press('Escape');
    await page.addScriptTag({url:new URL('qa-driver.js',url).href});
    for(let round=0;round<2;round++){
      if(round)await page.locator('.dock-depart').click();await page.evaluate(()=>window.__playableBattlefield.whenIdle());
      // Explicit accelerated QA driver takes the sole advance slot while the
      // production input RAF is suspended. It never teleports or injects damage.
      const sortie=await page.evaluate(async()=>{
        const q=window.__playableBattlefield;q.setDriverMode(true);const pilot=window.__playablePilot.createSortiePilot(q.controller);let result,peakHitEffects=0,peakProjectiles=0;const muzzles=new Set();
        try{for(let i=0;i<6500;i++){result=pilot.next(.05);q.renderer.render(q.snapshot(),.05);const v=q.vfxDebug();peakHitEffects=Math.max(peakHitEffects,v.hitEffects||0);peakProjectiles=Math.max(peakProjectiles,v.activeProjectiles||0);for(const event of q.snapshot().sim.events)if(event.type==='player-fire')muzzles.add(event.muzzleSource);if(result.done)break;if(i%15===0)await new Promise(requestAnimationFrame);}
        }finally{q.setDriverMode(false);}
        return {...result,peakHitEffects,peakProjectiles,muzzles:[...muzzles],settlements:q.controller.state.settlements.length};
      });
      check(`input-sortie-${round+1}-cut-recover-return`,sortie.returned&&sortie.observed.hits>0&&sortie.observed.detached>0&&sortie.observed.recovered>0,sortie);
      check(`real-muzzle-and-VFX-${round+1}`,sortie.peakHitEffects>0&&sortie.peakProjectiles>0&&sortie.muzzles.some(value=>value&&value!=='provisional-planar-muzzle'),sortie);
      await page.waitForFunction(()=>document.querySelector('.app').dataset.phase==='harbor');await page.evaluate(()=>window.__playableBattlefield.whenIdle());
      await page.locator('#drawer-button').click();check(`harbor-drawer-${round+1}`,await page.locator('#harbor-drawer').getAttribute('aria-hidden')==='false');
      await page.locator('#store-button').click();if(await page.locator('#repair-button').isEnabled())await page.locator('#repair-button').click();
      if(!round){const equipped=await page.evaluate(async()=>{const q=window.__playableBattlefield,choice=[['machinegun','W2'],['engine','E2']].map(([kind,slotId])=>({part:q.controller.state.parts.find(p=>p.kind===kind&&p.location==='warehouse'),slotId})).find(item=>item.part);return choice?await q.command('equip',{partId:choice.part.id,slotId:choice.slotId}):{ok:false};});check('recovered-part-equipped-through-controller',equipped.ok,equipped);}
      await page.locator('#save-button').click();samples.push({phase:`returned-${round+1}`,...await page.evaluate(()=>window.__playableBattlefield.stats())});await page.locator('#drawer-close').click();
    }
    const state=await page.evaluate(()=>JSON.stringify(window.__playableBattlefield.controller.state));await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__playableBattlefield?.ready,undefined,{timeout:60000});await page.evaluate(()=>window.__playableBattlefield.whenIdle());
    check('save-reload-after-two-sorties',await page.evaluate(expected=>JSON.stringify(window.__playableBattlefield.controller.state)===expected,state));
    const ghost=await page.evaluate(()=>{const r=window.__playableBattlefield.renderer,gl=r.webgl.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,a=new Uint8Array(w*h*4),b=new Uint8Array(w*h*4);r.drawFixed();gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);r.clear();r.drawFixed();gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);let difference=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])difference++;return{difference,outlineAutoClear:r.effect.autoClear};});check('outline-clears-every-frame',ghost.difference===0&&ghost.outlineAutoClear,ghost);
    await page.locator('.dock-depart').click();await page.evaluate(()=>window.__playableBattlefield.whenIdle());await page.locator('#pause-button').click();
    const hud=await page.locator('#objective-text').innerText();check('player-objective-present',hud.length>0,hud);samples.push({phase:'battlefield-paused',...await page.evaluate(()=>window.__playableBattlefield.stats())});
    await page.screenshot({path:path.join(work,'battlefield-paused.png')});
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);check('mobile-no-page-overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));await page.screenshot({path:path.join(output,'preview-mobile.png'),fullPage:true});
    check('page-errors-zero',errors.length===0,errors);check('external-requests-zero',externalRequests.length===0,externalRequests);check('failed-local-requests-zero',failedRequests.length===0,failedRequests);
  }catch(error){errors.push(error.message);throw error;}
  finally{await browser.close();const report={schemaVersion:1,passed:checks.length>=17&&checks.every(item=>item.passed)&&errors.length===0,checks,samples,errors,externalRequests,failedRequests,scope:'One Chromium-compatible browser, real keyboard movement + accelerated controller input sorties with production advance suspended. No teleport/damage injection. No real mobile hardware/human readability/performance-budget certification.'};fs.writeFileSync(path.join(output,'browser-verification.json'),JSON.stringify(report,null,2)+'\n');if(!report.passed)process.exitCode=1;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
