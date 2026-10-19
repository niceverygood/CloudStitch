'use strict';
// Only the small files owned by this gallery. Never reads linked model bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out='outputs/enemy-fleet-gallery-v1/',source='tools/enemy-fleet-gallery/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const manifestPath=out+'READY-r1.json';
if(process.argv.includes('--check')){
  const manifest=read(manifestPath),bad=[];
  for(const item of manifest.files){
    if(!item.path.startsWith(out)&&!item.path.startsWith(source))throw Error('Outside owned paths');
    const bytes=fs.readFileSync(path.join(root,item.path));
    if(bytes.length!==item.bytes||sha(bytes)!==item.sha256)bad.push(item.path);
  }
  console.log(JSON.stringify({revision:manifest.revision,files:manifest.files.length,failed:bad}));
  if(bad.length)process.exitCode=1;
}else{
  const catalog=read(out+'catalog.json'),verification=read(out+'verification.json'),capture=read(out+'capture.json'),checks=[];
  const check=(name,passed)=>checks.push({name,passed:!!passed});
  const files=[source+'build.cjs',source+'capture.cjs',source+'qa.cjs',source+'freeze.cjs'];
  for(const file of files)check('syntax:'+file,cp.spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'}).status===0);
  for(const file of ['catalog.json','verification.json','capture.json','source-manifest.json']){read(out+file);check('json:'+file,true);}
  const html=fs.readFileSync(path.join(root,out+'index.html'),'utf8');
  const embedded=html.match(/const data=(.+);\nconst \$=/);
  check('html-and-catalog-data-agree',embedded&&JSON.stringify(JSON.parse(embedded[1]))===JSON.stringify(catalog));
  check('unique26-enemy19-context7',new Set(catalog.ships.map(s=>s.id)).size===26&&catalog.ships.filter(s=>s.group!=='context').length===19&&catalog.ships.filter(s=>s.group==='context').length===7);
  for(const [group,count] of Object.entries({standard:7,mission:7,boss:5,context:7}))check('group:'+group,catalog.ships.filter(s=>s.group===group).length===count);
  check('78-link-targets-exist',catalog.ships.every(s=>['previewPath','viewerPath','assetPath'].every(k=>fs.existsSync(path.resolve(root,out,s[k])))));
  check('existing-local-report68-pass',verification.passed&&verification.summary.total===68&&verification.summary.failed===0);
  check('existing-six-ghosting-results-zero',verification.ghosting.length===6&&verification.ghosting.every(g=>g.changedPixels===0));
  check('existing-offline-capture-pass',capture.offlineFileProtocol&&capture.count===19&&!capture.pageErrors.length&&!capture.externalRequests.length);
  check('qa-harness-unchanged-since-local-run',verification.harnessSha256===sha(fs.readFileSync(path.join(root,source+'qa.cjs'))));
  const report={revision:'READY-r1',scope:'Owned small source/output inspection. No model bytes, browser, native media or external calls.',passed:checks.every(c=>c.passed),checks};
  fs.writeFileSync(path.join(root,out+'lightweight-checks.json'),JSON.stringify(report,null,2)+'\n');
  if(!report.passed)throw Error(JSON.stringify(checks.filter(c=>!c.passed)));
  const payload=[...fs.readdirSync(path.join(root,source)).map(n=>source+n),...fs.readdirSync(path.join(root,out)).filter(n=>n!=='READY-r1.json').map(n=>out+n)].filter(p=>fs.statSync(path.join(root,p)).isFile()).sort();
  const manifest={revision:'READY-r1',ownerThreadId:'01a14ec4-81b5-7583-8d51-e35ad3b30d55',entry:out+'index.html',handoff:out+'HANDOFF.md',
    state:'Owner complete; prior local QA PASS; integration import/QA pending.',counts:catalog.counts,
    files:payload.map(p=>{const b=fs.readFileSync(path.join(root,p));return{path:p,bytes:b.length,sha256:sha(b)};}),
    readOnlyDependencies:['outputs/fleet-comparison-v1/inventory.json','outputs/fleet-comparison-v1/previews/','outputs/enemy-fleet-reference-v1/catalog.json','outputs/enemy-fleet-reference-v1/previews/','outputs/enemy-fleet-reference-v1/ships/','outputs/fleet-v2/ships/','tools/lib/runtime.cjs','tools/lib/paths.cjs','existing Playwright/browser runtime'],
    externalDependencyEvidence:out+'source-manifest.json',
    priorExecution:{kind:'Completed owner-local QA before coordination; not central integration QA',startedAt:verification.startedAt,completedAt:verification.completedAt,
      harness:{path:source+'qa.cjs',bytes:fs.statSync(path.join(root,source+'qa.cjs')).size,sha256:verification.harnessSha256},
      report:{path:out+'verification.json',bytes:fs.statSync(path.join(root,out+'verification.json')).size,sha256:sha(fs.readFileSync(path.join(root,out+'verification.json')))},
      captureReport:{path:out+'capture.json',bytes:fs.statSync(path.join(root,out+'capture.json')).size,sha256:sha(fs.readFileSync(path.join(root,out+'capture.json')))},
      route:{protocol:'http:',hostname:'127.0.0.1',pathname:'/outputs/enemy-fleet-gallery-v1/index.html',port:'assigned by listen(0); numeric port not preserved in prior report'},
      captureRoute:{protocol:'file:',repositoryPath:out+'index.html',sheetQuery:'?sheet=1'},
      conditions:{desktop:verification.browser.desktop,mobile:verification.browser.mobile,deviceScaleFactor:1,reducedMotion:'reduce',browsers:1,pages:1,concurrentViewers:1},
      htmlAndCatalogChangedAfterRun:false,reportOutputOverrideSupported:false},
    qa:{harness:source+'qa.cjs',priorReport:out+'verification.json',priorChecks:68,representativeViewers:2,ghostingCases:6,slotOwnerThreadId:'01a14d9f-fd0c-72b3-a5e0-b2e83776c21b',newRun:false,automaticRepeat:false,integrationScope:'Selective import route/link checks; only missing coverage. Use independent harness and output path.'},sharedChangesRequired:[],browserActive:false};
  fs.writeFileSync(path.join(root,manifestPath),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({manifest:manifestPath,files:manifest.files.length,lightweightChecks:checks.length,passed:true,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0)}));
}
