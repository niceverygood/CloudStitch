'use strict';
// New gallery revision. SOURCE_READY-1 and its v2 consumer stay byte-identical.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-fleet-villain-v1');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),rel=p=>path.relative(out,p).split(path.sep).join('/');
function main(){
 const arg=name=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3);
 const refFile=path.resolve(root,arg('reference')||'outputs/enemy-fleet-reference-v3/catalog.json'),refRoot=path.dirname(refFile);
 const beforeRoot=path.join(root,'outputs/enemy-fleet-gallery-v1'),base=read(path.join(beforeRoot,'catalog.json')),models=read(path.join(out,'models.json')),reference=read(refFile);
 if(!reference.version.includes('3'))throw Error('This consumer requires explicit villain-v3 reference catalog');
 const pairs=[],ships=base.ships.map(s=>{
  if(s.group==='context')return {...s,previousPreviewPath:s.previewPath,previousViewerPath:s.viewerPath,previousAssetPath:s.assetPath};
  const mine=models.ships.find(m=>m.id===s.id),foreign=reference.ships.find(m=>m.id===s.id),model=mine||foreign,dir=mine?out:refRoot;
  if(!model||!model.sha256||model.previewSourceSha256!==model.sha256)throw Error('New model/capture not ready: '+s.id);
  const afterAsset=path.resolve(dir,model.assetPath),beforeAsset=mine?path.resolve(beforeRoot,s.assetPath):path.join(root,'outputs/enemy-fleet-reference-v2/ships',s.id+'.glb');
  const beforeSha=mine?s.sourceModelSha256:model.baseModelSha256;
  if(!beforeSha)throw Error('Missing exact before model hash '+s.id);
  const afterPreview=path.resolve(dir,model.previewPath),beforePreview=mine?path.resolve(beforeRoot,s.previewPath):path.resolve(dir,model.beforePreviewPath);
  for(const file of [afterAsset,beforeAsset,afterPreview,beforePreview,path.resolve(dir,model.viewerPath)])if(!fs.existsSync(file))throw Error('Missing '+file);
  pairs.push({id:s.id,beforeAssetPath:path.relative(root,beforeAsset).split(path.sep).join('/'),afterAssetPath:path.relative(root,afterAsset).split(path.sep).join('/'),beforeSha256:beforeSha,afterSha256:model.sha256});
  return {...s,assetPath:rel(afterAsset),viewerPath:rel(path.resolve(dir,model.viewerPath)),previewPath:rel(afterPreview),
   previousPreviewPath:rel(beforePreview),previousAssetPath:rel(beforeAsset),previousViewerPath:mine?s.viewerPath:'../enemy-fleet-reference-v2/ships/'+s.id+'.html',
   description:mine?model.features.slice(-5).join(' · '):model.villainTheme||s.description,features:model.features,sourceModelSha256:model.sha256,
   modelOwner:mine?'gallery-new13':'reference-v3-six',visual:'새 악당 외형',latest:true};
 });
 if(pairs.length!==19||new Set(pairs.map(p=>p.id)).size!==19)throw Error('Need exact19 new enemy IDs');
 fs.writeFileSync(path.join(out,'comparison-pairs-r2.json'),JSON.stringify({pairs},null,2)+'\n');
 if(process.argv.includes('--pairs-only')){console.log(JSON.stringify({pairs:19,browser:false,originalModelBytesRead:0}));return;}
 const comparison=arg('comparison-dir');if(!comparison)throw Error('--comparison-dir is required for the same-camera final gallery; use --pairs-only first');
 const comparisonRoot=path.resolve(root,comparison),report=read(path.join(comparisonRoot,'report.json'));
 if(!report.passed)throw Error('Comparison capture did not pass');
 for(const pair of pairs){const evidence=report.pairs?.find(r=>r.id===pair.id);if(!evidence||!evidence.passed||!evidence.sameCamera||evidence.beforeSha256!==pair.beforeSha256||evidence.afterSha256!==pair.afterSha256)throw Error('Stale or unbound comparison capture '+pair.id);}
 for(const s of ships.filter(s=>s.group!=='context')){
  const before=path.join(comparisonRoot,s.id,'before.png'),after=path.join(comparisonRoot,s.id,'after.png');
  if(!fs.existsSync(before)||!fs.existsSync(after))throw Error('Missing same-camera pair '+s.id);
  s.previousPreviewPath=rel(before);s.previewPath=rel(after);s.sameCameraComparison=true;
 }
 const data={...base,version:'enemy-villain-gallery-2',title:'Cloudstitch · 악당의 실루엣',ships,
  counts:{...base.counts,newVillainModels:19,ownedModels:13,referenceModels:6},artTarget:'10x bolder impact; actual same-camera/time comparisons. Human art approval pending.'};
 let html=fs.readFileSync(path.join(root,'tools/enemy-fleet-gallery/template.html'),'utf8');
 html=html.replaceAll('적 함선, 한눈에','악당의 실루엣, 강렬하게').replace('CLOUDSTITCH · ENEMY FLEET COLLECTION','CLOUDSTITCH · VILLAIN SILHOUETTES / 02').replace('실제 3D 외형을 모았습니다. 마음에 드는 배를 눌러 돌려 보세요.','거대한 주역 장치와 극적인 윤곽. 같은 카메라·시점에서 이전 모습과 비교하세요.').replaceAll('그림 기반 최신 6척 포함 · 일반 / 임무 / 보스 순서','새 외형 19항목 · 같은 카메라와 시점의 전후 비교').replace("el('span','최신 외형','latest')","el('span','새 악당 외형','latest')");
 html=html.replace('<h2>함선과 함선, 나란히</h2>','<h2>이전 모습과 새 악당 외형</h2>').replace('같은 크기의 칸에서 외형을 비교하세요. 실제 크기 비율은 아닙니다.','같은 카메라·같은 애니메이션 시점의 실제 모델 렌더입니다.').replace('<label for="left-select">왼쪽</label>','<label for="left-select">이전</label>').replace('<label for="right-select">오른쪽</label>','<label for="right-select">새 외형</label>');
 html=html.replace("$('compare-'+side).src=ship.previewPath;","$('compare-'+side).src=side==='left'?ship.previousPreviewPath:ship.previewPath;").replace("ship.groupLabel+' · '+ship.visual","ship.groupLabel+' · '+(side==='left'?'이전 외형':ship.visual)");
 html=html.replace("selectComparison('right','enemy-cult-blockade')","selectComparison('right','enemy-pirate-scout')");
 html=html.replace("selectComparison(side,e.target.value)","(selectComparison('left',e.target.value),selectComparison('right',e.target.value))");
 html=html.replace("function place(side,id){selectComparison(side,id);showCompare(true,true);}","function place(side,id){selectComparison('left',id);selectComparison('right',id);showCompare(true,true);}").replace("side==='left'?'왼쪽 비교':'오른쪽 비교'","side==='left'?'이전과 비교':'새 외형 비교'");
 html=html.replace("frame.src=s.viewerPath;","frame.src=trigger?.id==='left-open'?s.previousViewerPath:s.viewerPath;").replace("$('viewer-new-tab').href=s.viewerPath;","$('viewer-new-tab').href=trigger?.id==='left-open'?s.previousViewerPath:s.viewerPath;");
 html=html.replace('그림·모델·이전 뷰어를 보존했습니다. 이 화면은 외형 열람용입니다.','원본과 기존 검사를 보존한 새 외형 시안입니다. 실제 전투·장비 규칙은 그대로입니다.').replace('한 칸에 맞춘 외형 비교 · 실제 크기·게임 밸런스 미확정','각 전후 쌍은 같은 카메라 · 기체 간 실제 크기·게임 밸런스 미확정');
 fs.writeFileSync(path.join(out,'index.html'),html.replace('/* GALLERY_DATA */',()=>JSON.stringify(data).replace(/</g,'\\u003c')));
 fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({new19:19,reference:reference.version,sameCamera:true}));
}
if(require.main===module)main();module.exports={main};
