'use strict';
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/enemy-fleet-reference-v1');
async function buildViewers(){
  const catalog=JSON.parse(fs.readFileSync(path.join(out,'catalog.json'),'utf8')),nodePaths=(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean);
  const result=await esbuild.build({stdin:{contents:"import './viewer-base.js'; import './enhance.js';",resolveDir:__dirname,sourcefile:'enemy-reference-viewer-entry.js'},bundle:true,minify:true,write:false,format:'iife',target:['chrome100','safari16'],nodePaths,define:{__MODEL_BASE64__:'window.__MODEL_B64',__MODEL_BYTES__:'window.__MODEL_BYTES',__REFERENCE_BASE64__:'window.__HERO_B64'}});
  const reference=fs.readFileSync(path.join(root,'outputs/fleet-v1/ships/player-homeward.glb')).toString('base64');
  let template=fs.readFileSync(path.join(__dirname,'viewer-template.html'),'utf8').replace('FLEET ATELIER / 02','ENEMY FLEET / REFERENCE').replace('배마다 다른 윤곽, 바람을 타는 움직임','첨부 컨셉으로 새로 만든 선체 · 큰 구조와 약점 위치');
  template=template.replace('<title>','<link rel="icon" href="data:,"><title>').replace('</style>','.reference-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 17px;border-bottom:1px solid #d5d8c9}.weakpoint-label{position:absolute;z-index:2;transform:translate(-50%,-135%);background:#fff5e8e8;border:1px solid #b95d40;color:#7a3528;font:11px system-ui;padding:5px 8px;border-radius:5px;pointer-events:none;max-width:160px;text-align:center}</style>');
  template=template.replace('<section class="stage"','<div id="reference-actions" class="reference-actions" aria-label="컨셉 약점과 위장 상태"></div><section class="stage"');
  for(const ship of catalog.ships.filter(ship=>ship.status==='asset-built')){
    const bytes=fs.readFileSync(path.join(out,ship.assetPath));
    const script='window.__MODEL_B64='+JSON.stringify(bytes.toString('base64'))+';window.__MODEL_BYTES='+bytes.length+';window.__HERO_B64='+JSON.stringify(reference)+';'+result.outputFiles[0].text;
    const name=ship.name.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    fs.writeFileSync(path.join(out,ship.viewerPath),template.replaceAll('__ASSET_NAME__',name).replace('/* BUNDLED_VIEWER */',()=>script.replace(/<\/script/gi,'<\\/script')));
  }
  console.log(JSON.stringify({viewers:catalog.ships.filter(ship=>ship.status==='asset-built').length}));
}
module.exports={buildViewers};if(require.main===module)buildViewers().catch(e=>{console.error(e);process.exitCode=1;});
