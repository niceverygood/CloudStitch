'use strict';
// Consumer only: --prepare reads JSON, --execute verifies ready files and writes a NEW gallery.
// Explicit external catalogs are mandatory. No generation, GLB embedding, or browser calls.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../../..'),OUT=path.join(ROOT,'outputs/enemy-fleet-gallery-v2');
const REFERENCE=['enemy-pirate-scout','enemy-cult-blockade','enemy-union-salvage','enemy-union-repair','enemy-ghost-chaser','enemy-disguised-wreck'];
const OWNED=['enemy-tax-cutter','mission-union-guard','mission-bridge-tug','mission-guard-scout','mission-cult-purifier','mission-ghost-artillery','role-enemy-artillery','role-enemy-defense','mini-funeral-guard','boss-shipyard-ribs','boss-shipwright-command','boss-last-inhale'];
const BOSS='boss-bell-devourer',HASH=/^[a-f0-9]{64}$/i;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const relative=f=>path.relative(OUT,f).split(path.sep).join('/');
function repoPath(value,base=ROOT){
 if(typeof value!=='string'||!value||/[?#\0]/.test(value)||(/^[a-z][a-z\d+.-]*:/i.test(value)&&!path.isAbsolute(value))||value.startsWith('//')||value.startsWith('\\\\'))throw Error('Expected local repository path: '+value);
 const file=path.resolve(base,value),rel=path.relative(ROOT,file);
 if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Path escapes repository: '+value);
 return file;
}
function assetPath(value,base,extension){
 const file=repoPath(value,value?.startsWith('outputs/')?ROOT:base);
 if(path.extname(file).toLowerCase()!==extension)throw Error('Expected '+extension+' path: '+value);
 return file;
}
function exactIds(rows,ids,label){
 if(!Array.isArray(rows)||rows.length!==ids.length||new Set(rows.map(s=>s.id||s.sourceId)).size!==ids.length||rows.some(s=>!ids.includes(s.id||s.sourceId)))throw Error(label+' must contain exactly these IDs: '+ids.join(', '));
}
function normalize(row,catalog,file,owner){
 const id=row.id||row.sourceId,base=path.dirname(file),sourceId=row.sourceId||id;
 const artVariant=row.artVariant||catalog.artVariant||(owner==='reference'&&row.variantId?.startsWith(id+'--')?row.variantId.slice(id.length+2):owner==='owned'&&catalog.version==='enemy-villain-2'?'dominant-form-rebuild-v2':null);
 const status=row.status||catalog.status;
 if(sourceId!==id)throw Error('sourceId mismatch: '+id);
 if(!['asset-built','preview-ready','ready','READY','actual-3d-art-prototype-awaiting-visual-QA'].includes(status))throw Error('Actual model/preview not ready: '+id+' / '+status);
 if(!artVariant||/source-ready|pending/i.test(artVariant))throw Error('Explicit art variant missing: '+id);
 if(owner==='reference'&&artVariant!=='villain-v3')throw Error('Reference must be villain-v3: '+id);
 if(owner==='owned'&&artVariant!=='dominant-form-rebuild-v2')throw Error('Owned model variant mismatch: '+id);
 if(owner==='boss'&&(id!==BOSS||sourceId!==BOSS||artVariant!=='chapter1-boss-review-v1'))throw Error('Independent boss identity/variant mismatch');
 for(const field of ['sha256','previewSha256','previewSourceSha256'])if(!HASH.test(row[field]||''))throw Error('Missing exact '+field+': '+id);
 if(row.previewSourceSha256!==row.sha256)throw Error('Preview is not bound to current model: '+id);
 const asset=assetPath(row.assetPath,base,'.glb'),viewer=assetPath(row.viewerPath,base,'.html'),preview=assetPath(row.previewPath,base,'.png');
 if(owner==='boss'&&(asset!==path.join(ROOT,'outputs/chapter1-boss-review-v1/boss.glb')||viewer!==path.join(ROOT,'outputs/chapter1-boss-review-v1/index.html')))throw Error('Independent boss must use its exact ready GLB/viewer');
 return {...row,id,sourceId,artVariant,status,owner,asset,viewer,preview};
}
function bindComparisons(reports,selected,originals,baseFile){
 const evidence=reports.flatMap(({file,report})=>{
  if(report.passed!==true||!Array.isArray(report.pairs))throw Error('Comparison report must pass with actual capture pairs: '+file);
  return report.pairs.map(pair=>({...pair,reportFile:file}));
 });
 exactIds(evidence,selected.map(s=>s.id),'same-camera captures19');
 return selected.map(model=>{
  const original=originals.find(s=>s.id===model.id),pair=evidence.find(e=>e.id===model.id);
  const beforeSha256=model.owner==='reference'?model.baseModelSha256:original.sourceModelSha256;
  if(!HASH.test(beforeSha256||'')||pair.passed!==true||pair.sameCamera!==true||pair.beforeSha256!==beforeSha256||pair.afterSha256!==model.sha256)throw Error('Unbound or failed same-camera capture: '+model.id);
  for(const key of ['beforePngSha256','afterPngSha256'])if(!HASH.test(pair[key]||''))throw Error('Missing exact '+key+': '+model.id);
  const folder=path.join(path.dirname(pair.reportFile),model.id);
  const beforeAsset=model.owner==='reference'?path.join(ROOT,'outputs/enemy-fleet-reference-v2/ships',model.id+'.glb'):assetPath(original.assetPath,path.dirname(baseFile),'.glb');
  const beforeViewer=model.owner==='reference'?path.join(ROOT,'outputs/enemy-fleet-reference-v2/ships',model.id+'.html'):assetPath(original.viewerPath,path.dirname(baseFile),'.html');
  if(model.owner==='boss'&&beforeAsset!==path.join(ROOT,'outputs/fleet-v2/ships/boss-bell-devourer.glb'))throw Error('Independent boss before must be original fleet-v2 GLB');
  return {id:model.id,beforeSha256,afterSha256:model.sha256,beforeAsset,beforeViewer,
   beforePreview:assetPath('before.png',folder,'.png'),afterPreview:assetPath('after.png',folder,'.png'),
   beforePngSha256:pair.beforePngSha256,afterPngSha256:pair.afterPngSha256,reportFile:pair.reportFile,passed:true,sameCamera:true};
 });
}
function prepare({referenceFile,bossFile,comparisonFiles=[],ownFile=path.join(ROOT,'outputs/enemy-fleet-villain-v2/models.json'),baseFile=path.join(ROOT,'outputs/enemy-fleet-gallery-v1/catalog.json')}){
 if(!referenceFile||!bossFile)throw Error('미준비: --reference-catalog=repoJSON 및 --boss-catalog=repoJSON 모두 필요합니다. SOURCE_READY는 실제 PNG/GLB catalog가 아닙니다.');
 if(!comparisonFiles.length)throw Error('미준비: --comparisons=repo/report.json의 실제 동일 카메라 전후 증거 19종이 필요합니다. 여러 보고서는 옵션을 반복합니다.');
 referenceFile=repoPath(referenceFile);bossFile=repoPath(bossFile);ownFile=repoPath(ownFile);baseFile=repoPath(baseFile);
 comparisonFiles=comparisonFiles.map(file=>repoPath(file));
 if(new Set(comparisonFiles).size!==comparisonFiles.length)throw Error('Duplicate comparison report');
 for(const file of [referenceFile,bossFile,ownFile,baseFile,...comparisonFiles])if(path.extname(file).toLowerCase()!=='.json')throw Error('Catalog/report must be JSON: '+file);
 const ref=read(referenceFile),boss=read(bossFile),own=read(ownFile),base=read(baseFile);
 const bossRows=boss.ships||[boss];
 exactIds(ref.ships,REFERENCE,'reference6');exactIds(own.ships,OWNED,'owned12');exactIds(bossRows,[BOSS],'independent boss1');
 const selected=[...ref.ships.map(r=>normalize(r,ref,referenceFile,'reference')),...own.ships.map(r=>normalize(r,own,ownFile,'owned')),...bossRows.map(r=>normalize(r,boss,bossFile,'boss'))];
 exactIds(selected,[...REFERENCE,...OWNED,BOSS],'combined19');
 const originals=base.ships.filter(s=>s.group!=='context');exactIds(originals,selected.map(s=>s.id),'baseline19');
 const comparisons=bindComparisons(comparisonFiles.map(file=>({file,report:read(file)})),selected,originals,baseFile);
 const ships=originals.map(original=>{
  const model=selected.find(s=>s.id===original.id),comparison=comparisons.find(s=>s.id===original.id);
  return {...original,sourceId:model.sourceId,artVariant:model.artVariant,status:model.status,modelOwner:model.owner,
   previousPreviewPath:relative(comparison.beforePreview),previousViewerPath:relative(comparison.beforeViewer),previousPreviewSha256:comparison.beforePngSha256,
   comparisonPreviewPath:relative(comparison.afterPreview),comparisonPreviewSha256:comparison.afterPngSha256,
   previousAssetPath:relative(comparison.beforeAsset),previousModelSha256:comparison.beforeSha256,
   comparisonReportPath:relative(comparison.reportFile),
   assetPath:relative(model.asset),viewerPath:relative(model.viewer),previewPath:relative(model.preview),sha256:model.sha256,sourceModelSha256:model.sha256,
   previewSha256:model.previewSha256,sourcePreviewSha256:model.previewSha256,previewSourceSha256:model.previewSourceSha256,
   features:model.features||[],description:model.theme||model.villainTheme||model.features?.join(' · ')||original.description,
   visual:'새 주형태 · 실제 3D 시안',latest:true,sameCameraComparison:true};
 });
 return {data:{version:'enemy-fleet-gallery-2',title:'Cloudstitch · 악당의 실루엣',counts:{enemy:19,total:19,context:0,standard:7,mission:7,boss:5,referenceModels:6,ownedModels:12,independentBossModels:1},ships,
  note:'19종 모두 정확한 전후 모델 해시에 결합된 동일 카메라의 실제 PNG 비교입니다. 기술 검사와 사람 미술 승인은 별도이며 실제 전투·장비 규칙 변경은 없습니다.',artApproval:'PENDING_HUMAN_REVIEW',gameplayIntegration:false},
  catalogs:[referenceFile,bossFile,ownFile,baseFile,...comparisonFiles],selected,comparisons};
}
function htmlFor(data){
 let html=fs.readFileSync(path.join(ROOT,'tools/enemy-fleet-gallery/template.html'),'utf8');
 const replace=(from,to)=>{if(!html.includes(from))throw Error('Gallery template contract changed: '+from);html=html.replaceAll(from,to);};
 replace('적 함선, 한눈에','악당의 실루엣, 강렬하게');
 replace('CLOUDSTITCH · ENEMY FLEET COLLECTION','CLOUDSTITCH · VILLAIN SILHOUETTES / 02');
 replace('실제 3D 외형을 모았습니다. 마음에 드는 배를 눌러 돌려 보세요.','서로 다른 19개의 주형태와 주역 장치. 이전 모습과 새 외형을 비교하세요.');
 replace('두 척 나란히 비교','이전 · 새 외형 비교');replace('<h2>함선과 함선, 나란히</h2>','<h2>이전 모습과 새 악당 외형</h2>');
 replace('같은 크기의 칸에서 외형을 비교하세요. 실제 크기 비율은 아닙니다.','각 전후 쌍은 같은 카메라로 실제 모델을 렌더했습니다. 기체 간 실제 크기·게임 밸런스는 미확정입니다.');
 replace('<label for="left-select">왼쪽</label>','<label for="left-select">이전</label>');replace('<label for="right-select">오른쪽</label>','<label for="right-select">새 외형</label>');
 replace("$('compare-'+side).src=ship.previewPath;","$('compare-'+side).src=side==='left'?ship.previousPreviewPath:ship.comparisonPreviewPath;");
 replace("ship.groupLabel+' · '+ship.visual","ship.groupLabel+' · '+(side==='left'?'이전 외형':ship.visual)");
 replace("function place(side,id){selectComparison(side,id);showCompare(true,true);}","function place(side,id){selectComparison('left',id);selectComparison('right',id);showCompare(true,true);}");
 replace("selectComparison(side,e.target.value)","(selectComparison('left',e.target.value),selectComparison('right',e.target.value))");
 replace("selectComparison('right','enemy-cult-blockade')","selectComparison('right','enemy-pirate-scout')");
 replace("side==='left'?'왼쪽 비교':'오른쪽 비교'","side==='left'?'이전과 비교':'새 외형 비교'");
 replace("frame.src=s.viewerPath;","frame.src=trigger?.id==='left-open'?s.previousViewerPath:s.viewerPath;");
 replace("$('viewer-new-tab').href=s.viewerPath;","$('viewer-new-tab').href=trigger?.id==='left-open'?s.previousViewerPath:s.viewerPath;");
 replace("el('span','최신 외형','latest')","el('span','새 악당 외형','latest')");
 replace('그림 기반 최신 6척 포함 · 일반 / 임무 / 보스 순서','참고 6 · 새 제작 12 · 독립 보스 1 / 총 19항목');
 replace('<button data-filter="context" aria-pressed="false">라이벌 · 시험<span>7</span></button>','');
 replace('협상 가능한 라이벌 6척과 함대왕의 시험은 별도 탭에 있습니다.','새 외형 19항목을 수록했습니다. 원본 갤러리와 기존 모델은 보존했습니다.');
 replace('그림·모델·이전 뷰어를 보존했습니다. 이 화면은 외형 열람용입니다.','실제 전투·장비 수·피해 규칙은 바꾸지 않은 아트 시안입니다. 사람 미술 승인은 별도입니다.');
 replace('<a href="overview.png" target="_blank" rel="noopener">19항목 한 장으로 보기 ↗</a>','');
 replace('<a href="README.txt">사용 안내</a>','<a href="source-manifest.json">검증 출처</a>');
 replace("['all','standard','mission','boss','context'].includes(params.get('group'))","['all','standard','mission','boss'].includes(params.get('group'))");
 return html.replace('/* GALLERY_DATA */',()=>JSON.stringify(data).replace(/</g,'\\u003c'));
}
function execute(prepared){
 const {data,selected,catalogs,comparisons}=prepared,files=new Map();
 function verify(file,expected,kind){
  const bytes=fs.readFileSync(file);if(expected&&sha(bytes)!==expected)throw Error('Stale '+kind+': '+file);
  if(kind==='PNG'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Not an actual PNG: '+file);
  if(kind==='GLB'&&bytes.toString('ascii',0,4)!=='glTF')throw Error('Not an actual GLB: '+file);
  files.set(file,{path:path.relative(ROOT,file).split(path.sep).join('/'),bytes:bytes.length,sha256:sha(bytes)});
 }
 for(const m of selected){verify(m.asset,m.sha256,'GLB');verify(m.preview,m.previewSha256,'PNG');verify(m.viewer,null,'viewer');}
 for(const c of comparisons){verify(c.beforeAsset,c.beforeSha256,'GLB');verify(c.beforePreview,c.beforePngSha256,'PNG');verify(c.afterPreview,c.afterPngSha256,'PNG');verify(c.beforeViewer,null,'viewer');}
 for(const file of catalogs)verify(file,null,'JSON');
 const html=htmlFor(data);
 // Build only after every actual PNG/GLB/viewer has passed. Never overwrite a prior gallery.
 if(fs.existsSync(OUT))throw Error('Output already exists; preserve revision: '+OUT);
 fs.mkdirSync(OUT,{recursive:true});
 fs.writeFileSync(path.join(OUT,'catalog.json'),JSON.stringify(data,null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(path.join(OUT,'index.html'),html,{flag:'wx'});
 fs.writeFileSync(path.join(OUT,'source-manifest.json'),JSON.stringify({version:data.version,counts:data.counts,sourceFiles:[...files.values()],newGenerationCalls:0,browserCalls:0,embeddedGLBs:0,viewerStrategy:'one lazy iframe removed on replacement/close',artApproval:data.artApproval,comparison:'19 unique passed same-camera actual capture pairs; model and PNG hashes verified',gameplayIntegration:false},null,2)+'\n',{flag:'wx'});
 return {output:'outputs/enemy-fleet-gallery-v2/index.html',counts:data.counts,browser:false};
}
function main(args=process.argv.slice(2)){
 const allowed=/^--(?:reference-catalog|boss-catalog|comparisons)=.+$|^--(?:prepare|execute)$/;
 if(args.some(a=>!allowed.test(a)))throw Error('Unknown CLI option');
 if(args.includes('--prepare')===args.includes('--execute'))throw Error('Choose exactly one: --prepare (JSON only) or --execute (ready assets only)');
 const value=name=>args.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
 const comparisonFiles=args.filter(a=>a.startsWith('--comparisons=')).map(a=>a.slice('--comparisons='.length));
 const ready=prepare({referenceFile:value('reference-catalog'),bossFile:value('boss-catalog'),comparisonFiles});
 const result=args.includes('--execute')?execute(ready):{prepared:true,jsonOnly:true,browser:false,modelsRead:0,outputWritten:false,counts:ready.data.counts,sameCameraComparisons:ready.comparisons.length,ships:ready.selected.map(s=>({id:s.id,sourceId:s.sourceId,artVariant:s.artVariant,status:s.status,sha256:s.sha256,previewSha256:s.previewSha256}))};
 console.log(JSON.stringify(result));return result;
}
module.exports={prepare,normalize,bindComparisons,htmlFor,execute,main,REFERENCE,OWNED,BOSS};
if(require.main===module)try{main();}catch(e){console.error(e.message);process.exitCode=1;}
