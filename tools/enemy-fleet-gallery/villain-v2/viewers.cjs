'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-fleet-villain-v2');
async function buildViewers(){
 const esbuild=require('esbuild'),data=JSON.parse(fs.readFileSync(path.join(out,'models.json'),'utf8'));
 const bundled=await esbuild.build({entryPoints:[path.join(root,'tools/fleet-v2/viewer.js')],bundle:true,minify:true,write:false,format:'iife',target:['chrome100','safari16'],nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),define:{__MODEL_BASE64__:'window.__VILLAIN_MODEL',__MODEL_BYTES__:'window.__VILLAIN_BYTES',__REFERENCE_BASE64__:'window.__VILLAIN_HERO'}});
 const hero=fs.readFileSync(path.join(root,'outputs/fleet-v1/ships/player-homeward.glb')).toString('base64');
 let template=fs.readFileSync(path.join(root,'tools/fleet-v2/viewer-template.html'),'utf8').replace('FLEET ATELIER / 02','VILLAIN FLEET / 02').replace('배마다 다른 윤곽, 바람을 타는 움직임','선체부터 다른 악당들 · 과감한 주형태와 위협 동작').replace('포격 반동</button></div>','포격 반동</button><button class="profile" data-profile="ThreatDisplay" aria-pressed="false">위협 장치</button></div>').replace('</style>','.villain-note{font-size:11px;line-height:1.8;color:#80665b;padding:13px 18px;border-bottom:1px solid #d5d8c9;background:#f6f0e1}</style>').replace('<section class="stage"','<div class="villain-note">__VILLAIN_FEATURES__</div><section class="stage"');
 for(const s of data.ships.filter(s=>s.status==='asset-built')){
  const model=fs.readFileSync(path.join(out,s.assetPath)),script='window.__VILLAIN_MODEL='+JSON.stringify(model.toString('base64'))+';window.__VILLAIN_BYTES='+model.length+';window.__VILLAIN_HERO='+JSON.stringify(hero)+';'+bundled.outputFiles[0].text;
  const escape=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  fs.writeFileSync(path.join(out,s.viewerPath),template.replaceAll('__ASSET_NAME__',escape(s.name)).replace('__VILLAIN_FEATURES__',s.features.map(escape).join(' · ')).replace('/* BUNDLED_VIEWER */',()=>script.replace(/<\/script/gi,'<\\/script')));
 }
 console.log(JSON.stringify({viewersBuilt:data.ships.filter(s=>s.status==='asset-built').length}));
}
module.exports={buildViewers};if(require.main===module)buildViewers().catch(e=>{console.error(e.stack);process.exitCode=1;});
