'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-fleet-reference-v3');
const summaries={
 'enemy-pirate-scout':'검붉은 기낭 아래 맹금처럼 굽은 충각과 큰 이빨 장갑. 곡선 뿔돛과 빼앗은 전리품을 매단 날렵한 사냥꾼입니다.',
 'enemy-cult-blockade':'왕관 모양 봉인탑과 굽은 의례 뿔, 겹장갑 위로 거대한 종이 솟습니다. 붉은 봉인 깃발이 압제적인 성벽의 인상을 만듭니다.',
 'enemy-union-salvage':'거대한 톱니 집게와 구속 사슬, 철제 턱 범퍼를 갖춘 포획선. 청록 기낭과 케이블 드럼을 중심으로 위협적인 중공업 구조를 겹쳤습니다.',
 'enemy-union-repair':'기울어진 눈매 차양과 좁은 주황 작업창, 비대칭 연통을 가진 해체 공방. 관절팔의 큰 바이스와 덮개 달린 톱이 기능을 드러냅니다.',
 'enemy-ghost-chaser':'뼈처럼 휜 큰 갈비 골조와 뒤로 쓸린 누더기 날개. 긴 창끝의 청록 이빨과 저주등이 차가운 추격자의 인상을 만듭니다.',
 'enemy-disguised-wreck':'봉합한 폐철판과 둥근 잔해 외피 안에 덫 아가리를 숨겼습니다. 외피를 펼치면 붉은 눈과 쇠집게가 드러납니다.',
};
function buildGallery(){
 const catalog=JSON.parse(fs.readFileSync(path.join(out,'catalog.json')));
 const ships=catalog.ships.map((s,index)=>({...s,index,tagline:s.villainTheme||'극적 악당 외형 v3',summary:summaries[s.id],previewAvailable:s.previewSourceSha256===s.sha256&&fs.existsSync(path.join(out,s.previewPath))}));
 let template=fs.readFileSync(path.join(__dirname,'../gallery-template.html'),'utf8');
 template=template.replace('<title>','<link rel="icon" href="data:,"><title>').replaceAll('그림에서 건너온','하늘의 괴물이 된').replace('ENEMY FLEET / REFERENCE STUDY','ENEMY FLEET / VILLAIN III').replace('첨부해 주신 실루엣과 약점 그림을 기준으로 선체·기낭·크레인·천과 장갑을 새로 구성했습니다. 각 함선을 직접 돌려 보고, 참고 그림과 나란히 비교해 보세요.','거대한 턱과 종아치, 포획쇄기와 해체 화로, 유령 골조와 접힌 덫으로 주형태를 다시 설계했습니다. 같은 카메라·화면 범위·부유 동작 2초에서 이전 판과 비교해 보세요.').replaceAll('그림과 비교','이전과 비교').replaceAll('그림과 3D','이전과 지금').replace('사용자가 제공한 기준 컨셉','이전 악당 강화판 · v2').replace('새로 만든 실제 3D 모델','극적 악당 외형 v3 · 실제 3D').replace('src="reference.png"','src="previews/enemy-pirate-scout-matched-before.png"').replace('href="reference.png"','href="../enemy-fleet-reference-v1/reference.png"').replace('새 손그림 질감','세력마다 다른 악역').replace('원본·기존 함대 보존','이전 제작판 보존');
 template=template.replace("img.src=ship.previewPath;","img.src=host.id==='result-picture'?(ship.comparisonPreviewPath||ship.previewPath):ship.previewPath;");
 template=template.replace('</style>','.reference-crop img{position:static;width:100%;height:100%;object-fit:contain}.reference-crop{background:#f6f6e9}.tagline{line-height:1.6}</style>');
 template=template.replace("img.style.left=-(ship.index%3)*100+'%';img.style.top=-Math.floor(ship.index/3)*100+'%';","img.src=ship.beforePreviewPath;img.style.left='0%';img.style.top='0%';");
 const html=template.replace('/* REFERENCE_FLEET */',()=>JSON.stringify({version:catalog.version,ships}).replace(/</g,'\\u003c'));
 fs.writeFileSync(path.join(out,'index.html'),html);const result={ships:ships.length,models:ships.filter(s=>s.status==='asset-built').length,previews:ships.filter(s=>s.previewAvailable).length,indexSha256:crypto.createHash('sha256').update(html).digest('hex')};fs.writeFileSync(path.join(out,'gallery-build.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));return result;
}
module.exports={buildGallery};if(require.main===module)buildGallery();
