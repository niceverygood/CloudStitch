'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/enemy-fleet-reference-v1');
const descriptions={
 'enemy-pirate-scout':['바람을 가르는 해적','뾰족한 목재 선수와 붉은 충각, 황토색 기낭과 해골 깃발. 큰 황동 엔진이 뒤로 드러납니다.'],
 'enemy-cult-blockade':['하늘을 막는 검은 성벽','검은 판금 장갑·높이 다른 봉인통·흰 의례 장막과 중앙 종. 작은 추진부는 후방에 노출했습니다.'],
 'enemy-union-salvage':['집게를 뻗는 인양 작업선','청록 기낭 아래 거대한 케이블 드럼, 길게 솟은 철골 크레인과 세 발 집게가 실루엣을 만듭니다.'],
 'enemy-union-repair':['날아다니는 수리 공방','창이 많은 긴 공방과 푸른 깃발. 양쪽 관절 수리팔·따뜻한 작업등·늘어진 케이블을 갖췄습니다.'],
 'enemy-ghost-chaser':['안개를 찢는 긴 창끝','회색 누더기 기낭과 하부의 찢어진 천, 가늘고 긴 목재 골조 사이로 차가운 잔광이 드러납니다.'],
 'enemy-disguised-wreck':['잔해 속에 숨은 함선','무너진 폐목재와 처진 천 외피 안에 기낭·함포·엔진을 숨겼습니다. 뷰어에서 외피 전개를 볼 수 있습니다.'],
};
function buildGallery(){
 const catalog=JSON.parse(fs.readFileSync(path.join(out,'catalog.json'),'utf8'));
 const ships=catalog.ships.map((ship,index)=>({...ship,index,tagline:descriptions[ship.id][0],summary:descriptions[ship.id][1],previewAvailable:ship.previewSourceSha256===ship.sha256&&fs.existsSync(path.join(out,ship.previewPath))}));
 const template=fs.readFileSync(path.join(__dirname,'gallery-template.html'),'utf8').replace('<title>','<link rel="icon" href="data:,"><title>');
 const html=template.replace('/* REFERENCE_FLEET */',()=>JSON.stringify({version:catalog.version,ships}).replace(/</g,'\\u003c'));
 fs.writeFileSync(path.join(out,'index.html'),html);
 const result={ships:ships.length,models:ships.filter(s=>s.status==='asset-built').length,previews:ships.filter(s=>s.previewAvailable).length,indexSha256:crypto.createHash('sha256').update(html).digest('hex')};
 fs.writeFileSync(path.join(out,'gallery-build.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));return result;
}
module.exports={buildGallery};if(require.main===module)buildGallery();
