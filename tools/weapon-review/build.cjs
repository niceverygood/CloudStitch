const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/weapon-review-v1');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const rel=p=>path.relative(out,p).split(path.sep).join('/');
async function main(){
 fs.mkdirSync(path.join(out,'previews'),{recursive:true});
 const old=read('outputs/weapon-modules/catalog.json'),fresh=read('outputs/grounded-weapons-v1/catalog.json');
 const groups=[{key:'classic',label:'기존 6종',base:'outputs/weapon-modules',viewer:'index.html?weapon=',items:old.items},{key:'new',label:'신규 12종',base:'outputs/grounded-weapons-v1',viewer:'index.html?asset=',items:fresh.items}];
 const oldCats=['연사','직사','곡사','인양·제어','인양·제어','압력·분사'];
 const cats={electrical:'전기',projectile:'화살·투척',utility:'인양·제어',defense:'방어',pressure:'압력·분사',melee:'근접'};
 const items=[],dependencies=[];
 for(const group of groups)for(const [i,item]of group.items.entries()){
  const base=path.join(root,group.base),sourcePreview=path.join(base,item.preview),model=path.join(base,item.model),id=group.key+'-'+item.id;
  for(const p of[sourcePreview,model])if(!fs.existsSync(p))throw new Error('Missing actual asset '+p);
  const sourceBytes=fs.readFileSync(sourcePreview);
  await sharp(sourceBytes).trim({threshold:0}).resize(700,550,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(out,'previews',id+'.png'));
  const reference=group.key==='classic'?path.join(base,item.reference):path.join(root,fresh.reference);
  const record={id,source_id:item.id,order:items.length+1,name:item.name_ko,english:item.name_en,group:group.key,group_label:group.label,category:group.key==='classic'?oldCats[i]:cats[item.category],role:item.role,triangles:item.triangles,meshes:group.key==='classic'?1:item.mesh_count,textures:group.key==='classic'?1:0,animations:0,preview:'previews/'+id+'.png',original_preview:rel(sourcePreview),reference:rel(reference),reference_label:group.key==='classic'?'개별 기준 원화':'승인한 12종 무드보드',viewer:rel(path.join(base,'index.html'))+(group.key==='classic'?'?weapon=':'?asset=')+item.id,model:rel(model),source_catalog:rel(path.join(base,'catalog.json')),method:group.key==='classic'?'텍스처 기반 단일 메시':'정점 채색·분리 부품 메시'};
  items.push(record);dependencies.push({path:group.base+'/'+item.preview,bytes:sourceBytes.length,sha256:sha(sourceBytes)},{path:group.base+'/'+item.model,bytes:fs.statSync(model).size,sha256:item.sha256||sha(fs.readFileSync(model))});
 }
 fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({title:'Cloudstitch · 무기·장치 리뷰',count:items.length,existing:6,new:12,items},null,2)+'\n');
 const template=fs.readFileSync(path.join(__dirname,'template.html'),'utf8');
 fs.writeFileSync(path.join(out,'index.html'),template.replace('/* REVIEW_DATA */',()=>JSON.stringify(items).replace(/</g,'\\u003c')));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({revision:'weapon-review-v1-r1',date:'2026-10-19',type:'unified_asset_review',count:18,source_catalogs:['outputs/weapon-modules/catalog.json','outputs/grounded-weapons-v1/catalog.json'],read_only_dependencies:dependencies,preview_process:'Trim transparent margins and fit into a shared 700x550 canvas; original renders and GLBs preserved.',new_GLBS:0,limitations:['Each card is fitted separately, not physical scale comparison.','Existing six and new twelve are static art prototypes; grouping does not add gameplay or mounting support.','New twelve includes a shield; eighteen is art entry count, not eighteen combat weapon rules.','Review notes stay in the current browser local storage until exported.'],preservation:'Original assets/viewers/catalogs are read-only.'},null,2)+'\n');
 console.log(JSON.stringify({cards:items.length,existing:6,new:12,new_GLBS:0}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
