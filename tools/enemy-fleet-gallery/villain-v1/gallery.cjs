'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-fleet-villain-v1');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function buildGallery(){
 const base=read(path.join(root,'outputs/enemy-fleet-gallery-v1/catalog.json')),models=read(path.join(out,'models.json'));
 const latestFile=path.join(root,'outputs/enemy-fleet-reference-v2/catalog.json');
 if(!fs.existsSync(latestFile))throw Error('Reference6 villain-v2 catalog is not ready; keep original gallery untouched');
 const six=read(latestFile);
 const ships=base.ships.map(s=>{
  if(s.group==='context')return {...s,previousPreviewPath:s.previewPath,previousViewerPath:s.viewerPath};
  const mine=models.ships.find(m=>m.id===s.id),foreign=six.ships.find(m=>m.id===s.id),model=mine||foreign;
  if(!model||!model.sha256)throw Error('No new actual villain model: '+s.id);
  const prefix=mine?'':'../enemy-fleet-reference-v2/';
  const previewPath=prefix+model.previewPath,viewerPath=prefix+model.viewerPath,assetPath=prefix+model.assetPath;
  if(model.previewSourceSha256!==model.sha256||!fs.existsSync(path.resolve(out,previewPath)))throw Error('New villain preview is absent or stale: '+s.id);
  const features=model.features||[];
  return{...s,previewPath,viewerPath,assetPath,features,description:mine&&features.length?features.slice(-5).join(' · '):model.villainTheme||s.description,
    previousPreviewPath:s.previewPath,previousViewerPath:s.viewerPath,sourceModelSha256:model.sha256,
    sourcePreviewSha256:sha(fs.readFileSync(path.resolve(out,previewPath))),visual:'악당 강화 · 실제 새 3D',latest:true,modelOwner:mine?'enemy-gallery-villain13':'fleet-reference-villain6'};
 });
 const data={...base,version:'enemy-villain-gallery-1',title:'Cloudstitch · 악당의 실루엣',ships,counts:{...base.counts,newVillainModels:19,ownedModels:13,referenceModels:6}};
 let template=fs.readFileSync(path.join(root,'tools/enemy-fleet-gallery/template.html'),'utf8');
 template=template.replaceAll('적 함선, 한눈에','악당의 실루엣, 더 강렬하게').replace('CLOUDSTITCH · ENEMY FLEET COLLECTION','CLOUDSTITCH · VILLAIN FLEET / NEW SILHOUETTES').replace('실제 3D 외형을 모았습니다. 마음에 드는 배를 눌러 돌려 보세요.','더 과장된 윤곽과 주역 장치. 같은 배의 이전 모습과 새 악당 외형을 비교하세요.').replaceAll('그림 기반 최신 6척 포함 · 일반 / 임무 / 보스 순서','새 외형 19항목 · 기체마다 다른 악당의 캐릭터').replace("el('span','최신 외형','latest')","el('span','악당 강화','latest')");
 template=template.replace('<h2>함선과 함선, 나란히</h2>','<h2>이전 외형과 악당 강화, 나란히</h2>').replace('같은 크기의 칸에서 외형을 비교하세요. 실제 크기 비율은 아닙니다.','두 칸에서 같은 기체를 고르면 이전 외형과 새 외형을 비교합니다. 실제 크기 비율은 아닙니다.');
 template=template.replace('<label for="left-select">왼쪽</label>','<label for="left-select">이전</label>').replace('<label for="right-select">오른쪽</label>','<label for="right-select">강화</label>');
 template=template.replace("$('compare-'+side).src=ship.previewPath;","$('compare-'+side).src=side==='left'?ship.previousPreviewPath:ship.previewPath;");
 template=template.replace("ship.groupLabel+' · '+ship.visual","ship.groupLabel+' · '+(side==='left'?'이전 외형':ship.visual)");
 template=template.replace("selectComparison('right','enemy-cult-blockade')","selectComparison('right','enemy-pirate-scout')");
 template=template.replace("function place(side,id){selectComparison(side,id);showCompare(true,true);}","function place(side,id){selectComparison('left',id);selectComparison('right',id);showCompare(true,true);}");
 template=template.replace("side==='left'?'왼쪽 비교':'오른쪽 비교'","side==='left'?'이전과 비교':'새 외형 비교'");
 template=template.replace("frame.src=s.viewerPath;","frame.src=trigger?.id==='left-open'?s.previousViewerPath:s.viewerPath;");
 template=template.replace("$('viewer-new-tab').href=s.viewerPath;","$('viewer-new-tab').href=trigger?.id==='left-open'?s.previousViewerPath:s.viewerPath;");
 template=template.replace('그림·모델·이전 뷰어를 보존했습니다. 이 화면은 외형 열람용입니다.','새로운 외형 시안입니다. 기존 모델과 실제 전투·장비 규칙은 보존했습니다.');
 fs.writeFileSync(path.join(out,'index.html'),template.replace('/* GALLERY_DATA */',()=>JSON.stringify(data).replace(/</g,'\\u003c')));
 fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({gallery:'outputs/enemy-fleet-villain-v1/index.html',new19:ships.filter(s=>s.group!=='context').length,owned13:13,reference6:6}));return data;
}
module.exports={buildGallery};if(require.main===module)buildGallery();
