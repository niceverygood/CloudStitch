/* Browser checks for the local battlefield, isolated from the handoff tab.
 * UI input checks and explicitly labelled deterministic fixtures are separate.
 * node tools/battlefield/verify.cjs [work/verification/battlefield]
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { launchBrowser, reportDirectory, repoPath } = require('../lib/runtime.cjs');

const url = process.env.BATTLEFIELD_URL || 'http://127.0.0.1:59306/outputs/battlefield-v1/index.html';
const origin = new URL(url).origin;
const reportDir = reportDirectory('battlefield', process.argv[2]);
const assert = (value, message) => { if (!value) throw new Error(message); };
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const report = {
  testedAt: new Date().toISOString(), url, passed: false,
  buildSha256: sha(fs.readFileSync(repoPath('outputs/battlefield-v1/battlefield.js'))),
  scope: 'Local browser integration. UI input and deterministic state fixtures are labelled separately. Not device, campaign, save or gameplay-fun certification.',
  checks: [], sections: {}, failures: [], screenshots: [],
};
if (process.env.BATTLEFIELD_EXPECTED_SHA && process.env.BATTLEFIELD_EXPECTED_SHA !== report.buildSha256) {
  throw new Error(`Unexpected battlefield bundle SHA256: ${report.buildSha256}`);
}

function check(name, condition, evidence = {}) {
  assert(condition, name);
  report.checks.push({ name, passed: true, ...evidence });
}

function monitor(page, expectedFailure = false) {
  const evidence = { errors: [], consoleErrors: [], externalRequests: [], glbResponses: [] };
  page.on('pageerror', error => evidence.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()); });
  page.on('request', request => {
    const target = request.url();
    if (/^https?:/.test(target) && new URL(target).origin !== origin) evidence.externalRequests.push(target);
  });
  page.on('response', response => {
    if (/\.glb(?:\?|$)/.test(response.url())) evidence.glbResponses.push({ url: response.url(), status: response.status() });
  });
  evidence.expectedFailure = expectedFailure;
  return evidence;
}

async function snapshot(page, filename) {
  const target = path.join(reportDir, filename);
  await page.screenshot({ path: target, fullPage: true });
  report.screenshots.push(target);
}

async function readyPage(context, section) {
  const page = await context.newPage();
  report.sections[section] = monitor(page);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__battlefield?.ready || window.__battlefield?.error, undefined, { timeout: 45000 });
  const error = await page.evaluate(() => window.__battlefield.error);
  assert(!error, `전장 로딩 실패: ${error}`);
  await page.waitForFunction(() => Array.isArray(window.__battlefield.loadedAssets), undefined, { timeout: 45000 });
  await page.locator('#welcome').waitFor({ state: 'visible' });
  return page;
}

async function holdButton(page, selector, stopWhen) {
  const bounds = await page.locator(selector).boundingBox();
  assert(bounds, `${selector} 버튼이 보이지 않습니다`);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  try { await page.waitForFunction(stopWhen, undefined, { timeout: 15000 }); }
  finally { await page.mouse.up(); }
}

async function nativeTab(page) {
  await page.evaluate(()=>{window.__qaTabPrevented=null;window.addEventListener('keydown',function probe(e){if(e.code==='Tab'){window.__qaTabPrevented=e.defaultPrevented;window.removeEventListener('keydown',probe);}});});
  await page.keyboard.press('Tab');
  return page.evaluate(()=>({prevented:window.__qaTabPrevented,focus:document.activeElement?.id}));
}

async function desktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  try {
    const page = await readyPage(context, 'desktop');
    const welcomeTab=await nativeTab(page);
    check('Welcome keeps the native Tab navigation available',welcomeTab.prevented===false,welcomeTab);
    const loaded = await page.evaluate(() => ({ assets: window.__battlefield.loadedAssets, outline: window.__battlefield.outlineAutoClear, canvas: document.querySelectorAll('#stage canvas').length }));
    check('Actual four fleet GLBs loaded', loaded.assets.length === 4 && ['player-homeward','enemy-tax-cutter','enemy-pirate-scout','enemy-union-salvage'].every(id => loaded.assets.includes(id)) && report.sections.desktop.glbResponses.length===4 && report.sections.desktop.glbResponses.every(response=>response.status===200), loaded);
    check('Explicit OutlineEffect autoClear enabled', loaded.outline === true);
    check('One WebGL canvas', loaded.canvas === 1);
    await page.locator('#explore').click();
    await page.waitForFunction(() => window.__battlefield.started && window.__battlefield.exploring);
    const before = await page.evaluate(() => ({ x: window.__battlefield.sim.player.x, time: window.__battlefield.sim.time }));
    await page.keyboard.down('d');
    try { await page.waitForFunction(start => window.__battlefield.sim.time > start + .35, before.time, { timeout: 15000 }); }
    finally { await page.keyboard.up('d'); }
    const after = await page.evaluate(() => ({ x: window.__battlefield.sim.player.x, time: window.__battlefield.sim.time }));
    check('Real keyboard movement changes player position', after.x > before.x + .5, { before, after });
    const shots = await page.evaluate(() => window.__battlefield.sim.stats.shots);
    await page.evaluate(n => window.__qaShots = n, shots);
    await holdButton(page, '#fire', () => window.__battlefield.sim.stats.shots > window.__qaShots);
    check('Fire button produces a simulation shot', await page.evaluate(() => window.__battlefield.sim.stats.shots > window.__qaShots));
    await page.locator('#map-toggle').click();
    await page.waitForFunction(() => window.__battlefield.overview);
    check('Overview toggle updates actual runtime', await page.locator('#map-toggle').getAttribute('aria-pressed') === 'true');
    await snapshot(page, 'desktop-overview.png');
    await page.keyboard.press('m');
    await page.waitForFunction(() => !window.__battlefield.overview);
    check('Keyboard returns from overview', await page.locator('#map-toggle').getAttribute('aria-pressed') === 'false');
    await snapshot(page, 'desktop-playing.png');
    const metrics = await page.evaluate(() => ({ triangles: window.__battlefield.triangles, drawCalls: window.__battlefield.drawCalls, frameMs: window.__battlefield.frameMs.slice(-120), viewport: [innerWidth, innerHeight] }));
    report.sections.desktop.metrics = metrics;
    check('Desktop has no JS errors or external network requests', !report.sections.desktop.errors.length && !report.sections.desktop.consoleErrors.length && !report.sections.desktop.externalRequests.length, report.sections.desktop);
  } finally { await context.close(); }
}

async function fixture(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  try {
    const page = await readyPage(context, 'deterministicFixture');
    await page.locator('#explore').click();
    await page.evaluate(()=>Object.assign(window.__battlefield.sim.player,{x:0,z:48,vx:0,vz:0}));
    await page.locator('#return').click();
    await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('하나 이상'));
    check('Empty-hold harbor return keeps the voyage active with a clear UI reason',await page.evaluate(()=>window.__battlefield.sim.outcome==='sailing'&&document.querySelector('#result-screen').hidden),{message:await page.locator('#toast').textContent()});
    // Test-only placement fixture: retain the real tax health and hit circles,
    // put it in an empty lane. Real UI shots must break the connector; the
    // production damage and separation code performs the rest.
    const setup = await page.evaluate(() => {
      const sim = window.__battlefield.sim, enemy = sim.enemies[0];
      sim.obstacles = [];
      enemy.x = enemy.spawnX = 0; enemy.z = enemy.spawnZ = 0; enemy.angle = 0;
      for (const other of sim.enemies.slice(1)) { other.x = other.spawnX = 70; other.z = other.spawnZ = -70; }
      const connector = enemy.modules.find(m => m.key === 'connector');
      Object.assign(sim.player, { x: connector.localX, z: connector.localZ + 18, vx: 0, vz: 0, cooldown: 0, angle: Math.PI });
      window.__qaInitialConnector = connector.id;
      return { fixture: 'empty lane and 18U initial distance; original health, hit radii and user UI fire remain actual', connector: { ...connector } };
    });
    report.sections.deterministicFixture.setup = setup;
    await holdButton(page, '#fire', () => window.__battlefield.sim.debris.length > 0);
    const separated = await page.evaluate(() => {
      const sim = window.__battlefield.sim, enemy = sim.enemies[0], bundle = sim.debris[0];
      return { keys: bundle.modules.map(m => m.key).sort(), owner: bundle.owner, connectorDestroyed: enemy.modules.find(m => m.key === 'connector').hp === 0, detached: enemy.modules.filter(m => !m.attached).map(m => m.key), mainEngineAttached: enemy.modules.find(m => m.key === 'main-engine').attached, mainBalloonAttached: enemy.modules.find(m => m.key === 'balloon').attached, damageHP: bundle.modules.map(m => [m.key,m.hp,m.maxHp]) };
    });
    check('Fixture real UI shot severs connector and canonical child bundle', separated.connectorDestroyed && ['deck','cannon','engine','aux-balloon'].every(key => separated.keys.includes(key)) && separated.mainEngineAttached && separated.mainBalloonAttached, separated);
    await page.evaluate(() => {
      const sim = window.__battlefield.sim;
      sim.projectiles.push({ id: 'qa-inflight', owner: 'player', x: -70, z: -70, prevX: -70, prevZ: -70, vx: 1, vz: 0, damage: 8, radius: .2, ttl: 20 });
      // Explicit risk fixture; this tests an active grace timer, not the
      // untouched zero value. Actual earned cargo is tested below separately.
      sim.player.weight = 66; sim.player.cargoWeight = 16;
    });
    await page.waitForFunction(() => window.__battlefield.sim.player.sinkingTime > .05, undefined, { timeout:15000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__battlefield.paused);
    const pauseTab=await nativeTab(page);
    check('Pause keeps the native Tab navigation available',pauseTab.prevented===false,pauseTab);
    const paused = await page.evaluate(() => { const s=window.__battlefield.sim; return { time:s.time, ttl:s.projectiles.find(p=>p.id==='qa-inflight').ttl, remaining:s.debris[0].remaining, sinking:s.player.sinkingTime }; });
    check('Overload fixture starts an active grace timer and visible danger UI',paused.sinking>0 && await page.locator('#danger').isVisible(),{sinking:paused.sinking,message:await page.locator('#danger').textContent()});
    await page.waitForTimeout(550);
    const still = await page.evaluate(() => { const s=window.__battlefield.sim; return { time:s.time, ttl:s.projectiles.find(p=>p.id==='qa-inflight').ttl, remaining:s.debris[0].remaining, sinking:s.player.sinkingTime }; });
    check('Pause freezes simulation, projectile, debris and risk timers', JSON.stringify(paused) === JSON.stringify(still), { paused, still });
    await page.locator('#resume').click();
    await page.waitForFunction(time => window.__battlefield.sim.time > time + .15, paused.time, { timeout: 15000 });
    check('Resume advances paused timers', await page.evaluate(old => { const s=window.__battlefield.sim; return s.debris[0].remaining<old.remaining && s.projectiles.find(p=>p.id==='qa-inflight').ttl<old.ttl && s.player.sinkingTime>old.sinking; }, paused));
    await page.evaluate(() => { const s=window.__battlefield.sim,b=s.debris[0];Object.assign(s.player,{x:b.x,z:b.z,vx:0,vz:0,weight:50,cargoWeight:0,sinkingTime:0});s.projectiles=[]; });
    await page.locator('#salvage').click();
    await page.waitForFunction(() => window.__battlefield.sim.cargo.length === 1);
    const recovered = await page.evaluate(() => { const s=window.__battlefield.sim;return { status:s.cargo[0].status,owner:s.cargo[0].owner,partOwners:s.cargo[0].modules.map(m=>m.owner),cargo:s.cargo.length,recovered:s.stats.recovered,weight:s.player.weight,hp:s.cargo[0].modules.map(m=>[m.key,m.hp,m.maxHp]) }; });
    check('UI salvage transfers ownership and keeps cargo separate from equipment', recovered.status==='cargo' && recovered.owner==='player' && recovered.partOwners.every(x=>x==='player') && recovered.hp.every((entry,index)=>JSON.stringify(entry)===JSON.stringify(separated.damageHP[index])), recovered);
    await page.locator('#salvage').click();
    check('Repeated salvage does not duplicate cargo or rewards', await page.evaluate(() => { const s=window.__battlefield.sim;return s.cargo.length===1&&s.stats.recovered===1; }));
    await page.evaluate(() => Object.assign(window.__battlefield.sim.player,{x:0,z:48,vx:0,vz:0}));
    await page.locator('#return').click();
    await page.locator('#result-screen').waitFor({ state:'visible' });
    const result = await page.evaluate(() => ({ outcome:window.__battlefield.sim.outcome, cargo:window.__battlefield.sim.cargo.length, title:document.querySelector('#result-title').textContent, text:document.querySelector('#result-text').textContent, stats:document.querySelector('#result-stats').textContent }));
    check('UI harbor return shows actual cargo outcome', result.outcome==='victory' && result.cargo===1 && result.text.includes('1'), result);
    await snapshot(page, 'fixture-return-result.png');
    await page.locator('#again').click();
    await page.waitForFunction(() => window.__battlefield.sim.outcome==='sailing' && window.__battlefield.sim.stats.shots===0);
    const counts=[];
    for(let i=0;i<3;i++) {
      if(i===0){await page.locator('#map-toggle').click();await page.waitForFunction(()=>window.__battlefield.overview);}
      await page.keyboard.press('Escape');await page.locator('#pause-screen').waitFor({state:'visible'});
      await page.locator('#restart').click();
      await page.waitForFunction(() => !window.__battlefield.paused);
      const reset=await page.evaluate(()=>{const b=window.__battlefield,s=b.sim;return {cargo:s.cargo.length,debris:s.debris.length,projectiles:s.projectiles.length,hp:s.player.hp,shots:s.stats.shots,kills:s.stats.kills,assets:b.loadedAssets.length,canvases:document.querySelectorAll('#stage canvas').length,labels:document.querySelectorAll('#labels .world-label').length,drawCalls:b.drawCalls,triangles:b.triangles,outcome:s.outcome};});
      counts.push(reset);
      assert(reset.cargo===0&&reset.debris===0&&reset.projectiles===0&&reset.hp===100&&reset.shots===0&&reset.kills===0&&reset.assets===4&&reset.canvases===1&&reset.outcome==='sailing','Repeated restart reset regression');
      if(i===0){const view=await page.evaluate(()=>({overview:window.__battlefield.overview,halfHeight:window.__battlefield.cameraHalfHeight,pressed:document.querySelector('#map-toggle').getAttribute('aria-pressed')}));check('Restart from overview restores camera zoom and toggle state',view.overview===false&&Number.isFinite(view.halfHeight)&&view.halfHeight!==108&&view.pressed==='false',view);}
    }
    check('Three repeated UI restarts reset cleanly without canvas or asset accumulation',counts.every(x=>x.labels===counts[0].labels),{counts});
    // Regression fixture: the cannon was destroyed before the connector is
    // actually shot. A living-parts bundle must not resurrect its old art.
    const cannonFirst=await page.evaluate(()=>{
      const sim=window.__battlefield.sim,enemy=sim.enemies[0];sim.obstacles=[];
      for(const e of sim.enemies){e.cooldown=999;e.telegraph=null;}
      enemy.x=enemy.spawnX=0;enemy.z=enemy.spawnZ=0;enemy.angle=0;
      for(const e of sim.enemies.slice(1)){e.x=e.spawnX=70;e.z=e.spawnZ=-70;}
      const cannon=enemy.modules.find(m=>m.key==='cannon'),engine=enemy.modules.find(m=>m.key==='engine'),connector=enemy.modules.find(m=>m.key==='connector');
      Object.assign(cannon,{hp:0,attached:false,detached:false,destroyed:true});
      Object.assign(sim.player,{x:connector.localX,z:connector.localZ+18,vx:0,vz:0,cooldown:0,angle:Math.PI});
      return {fixture:'cannon already destroyed; original connector health and radii; actual UI shots',engineAttached:engine.attached,engineHp:engine.hp};
    });
    check('Cannon-first fixture initially keeps its sibling engine intact',cannonFirst.engineAttached&&cannonFirst.engineHp>0,cannonFirst);
    await holdButton(page,'#fire',()=>window.__battlefield.sim.debris.length>0);
    await page.waitForFunction(()=>window.__battlefield.debrisArt?.length>0,undefined,{timeout:15000});
    const art=await page.evaluate(()=>{
      const sim=window.__battlefield.sim,b=sim.debris[0],enemy=sim.enemies[0];
      return {canonical:window.__battlefield.debrisArt.find(v=>v.id===b.id)?.canonicalModuleIds||[],bundleKeys:b.modules.map(m=>m.key),engineHp:b.modules.find(m=>m.key==='engine')?.hp,mainEngineAttached:enemy.modules.find(m=>m.key==='main-engine').attached};
    });
    check('Destroyed cannon remains absent from later detached art while surviving engine is preserved',!art.bundleKeys.includes('cannon')&&!art.canonical.includes('enemy-tax-cutter-cannon-1')&&art.canonical.includes('enemy-tax-cutter-engine-2')&&art.engineHp===cannonFirst.engineHp&&art.mainEngineAttached,art);
    check('Fixture paths have no JS errors or external requests',!report.sections.deterministicFixture.errors.length&&!report.sections.deterministicFixture.externalRequests.length,report.sections.deterministicFixture);
  } finally { await context.close(); }
}

async function mobile(browser) {
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  try {
    const page=await readyPage(context,'mobile390x844');await page.locator('#explore').tap();
    const overflow=await page.evaluate(()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,innerHeight,scrollHeight:document.documentElement.scrollHeight,coarse:matchMedia('(pointer: coarse)').matches,stick:!!document.querySelector('#stick').getBoundingClientRect().width}));
    check('390x844 mobile layout has no document overflow',overflow.scrollWidth<=390&&overflow.bodyWidth<=390&&overflow.scrollHeight<=844&&overflow.coarse,overflow);
    const box=await page.locator('#stick').boundingBox();assert(box,'Mobile movement stick missing');
    const cdp=await context.newCDPSession(page),cx=box.x+box.width/2,cy=box.y+box.height/2;
    const before=await page.evaluate(()=>({x:window.__battlefield.sim.player.x,time:window.__battlefield.sim.time}));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx+35,y:cy,id:1}]});
    try { await page.waitForFunction(time=>window.__battlefield.sim.time>time+.35,before.time,{timeout:15000}); }
    finally { await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); }
    const after=await page.evaluate(()=>({x:window.__battlefield.sim.player.x,time:window.__battlefield.sim.time}));
    check('Trusted browser touch stick moves the ship',after.x>before.x+.5,{before,after});
    const fire=await page.locator('#fire').boundingBox();const shots=await page.evaluate(()=>window.__battlefield.sim.stats.shots);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fire.x+fire.width/2,y:fire.y+fire.height/2,id:2}]});
    try { await page.waitForFunction(n=>window.__battlefield.sim.stats.shots>n,shots,{timeout:15000}); }
    finally { await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); }
    check('Trusted mobile touch fire produces shots',await page.evaluate(n=>window.__battlefield.sim.stats.shots>n,shots));
    await snapshot(page,'mobile390x844-playing.png');
    check('Mobile has no JS errors or external network requests',!report.sections.mobile390x844.errors.length&&!report.sections.mobile390x844.externalRequests.length,report.sections.mobile390x844);
  } finally { await context.close(); }
}

async function loadFailure(browser) {
  const context=await browser.newContext({viewport:{width:1100,height:760}});
  try {
    const page=await context.newPage();report.sections.missingGLB=monitor(page,true);
    await page.route('**/fleet-v1/ships/player-homeward.glb',route=>route.fulfill({status:404,contentType:'text/plain',body:'Intentional QA missing asset fixture'}));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__battlefield?.error,undefined,{timeout:45000});
    const failure=await page.evaluate(()=>({ready:window.__battlefield.ready,error:window.__battlefield.error,visible:!document.querySelector('#loading').hidden,message:document.querySelector('#load-message').textContent,welcomeHidden:document.querySelector('#welcome').hidden}));
    check('Missing GLB produces visible failure without fake ready state',!failure.ready&&failure.visible&&failure.welcomeHidden&&failure.message.includes('전장을 준비하지 못했습니다')&&failure.error.includes('player-homeward'),failure);
    check('Expected missing GLB has no unhandled JS exception',!report.sections.missingGLB.errors.length,report.sections.missingGLB);
    await snapshot(page,'missing-glb-error.png');
  } finally { await context.close(); }
}

(async()=>{
  const browser=await launchBrowser();
  try {
    for(const [name,run] of [['desktop',desktop],['deterministicFixture',fixture],['mobile390x844',mobile],['missingGLB',loadFailure]]) {
      console.log(`Checking ${name}`);
      try { await run(browser); console.log(`Passed ${name}`); }
      catch(error) { report.failures.push({section:name,error:error.stack||String(error)}); console.log(`Failed ${name}: ${error.message}`); }
    }
  } finally { await browser.close(); }
  const endingSha=sha(fs.readFileSync(repoPath('outputs/battlefield-v1/battlefield.js')));
  if(endingSha!==report.buildSha256)report.failures.push({section:'frozenBuild',error:'Battlefield bundle changed while browser QA was running.'});
  else check('The tested bundle stayed unchanged throughout browser QA',true,{sha256:endingSha});
  report.passed=report.failures.length===0;
  report.completedAt=new Date().toISOString();
  fs.writeFileSync(path.join(reportDir,'qa-result.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failures:report.failures,report:path.join(reportDir,'qa-result.json'),screenshots:report.screenshots},null,2));
  if(!report.passed)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
