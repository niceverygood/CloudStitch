/* Show only real GLBs with real browser-rendered preview PNGs. */
const fs = require('node:fs');
const path = require('node:path');
const { repoPath } = require('../lib/paths.cjs');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const uriPath = value => value.split(path.sep).join('/').split('/').map(encodeURIComponent).join('/');
const categories = { weapon: '무기별 발사·비행·명중', 'material-impact': '재질별 피격', 'explosion-environment': '폭발·연기·환경', 'damage-state': '손상·상태', 'defense-support': '방어·수리·인양' };
const weapons = { '01-machine-gun': '기관총', '02-deck-cannon': '함포', '03-mortar': '박격포', '04-harpoon': '작살포', '05-chain-shot': '사슬탄', '06-flamethrower': '화염방사기', common: '공통 효과' };
const overviewIDs = ['machine-gun-muzzle', 'cannon-muzzle', 'mortar-launch', 'harpoon-launch', 'chain-shot-launch', 'flamethrower-stream', 'large-explosion', 'wood-hit', 'envelope-rupture-state', 'shield-pulse', 'repair-stitch', 'salvage-tether'];

function preview(item, href) {
  const alt = escape((item.name_ko || item.id) + ' 실제 GLB 애니메이션의 대표 프레임');
  const metadata = item.preview_image, box = metadata?.bounds;
  const width = Number(metadata?.width), height = Number(metadata?.height);
  if (width > 0 && height > 0 && Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) && box[2] > box[0] && box[3] > box[1]) {
    const w = box[2] - box[0], h = box[3] - box[1];
    const viewBox = [box[0] - w * .09, box[1] - h * .09, w * 1.18, h * 1.18].map(value => Number(value.toFixed(3))).join(' ');
    return `<svg class="preview" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${alt}"><title>${alt}</title><image href="${escape(href)}" width="${width}" height="${height}"/></svg>`;
  }
  return `<img class="preview" src="${escape(href)}" alt="${alt}" loading="eager">`;
}

function main() {
  const catalogPath = repoPath(process.argv[2] || 'outputs/combat-vfx/catalog.json');
  const output = repoPath(process.argv[3] || 'outputs/combat-vfx/gallery.html');
  const root = path.dirname(catalogPath), destination = path.dirname(output);
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8').replace(/^\uFEFF/, ''));
  const link = file => uriPath(path.relative(destination, path.resolve(root, file)));
  const exists = file => file && fs.existsSync(path.resolve(root, file));
  const specFile = path.resolve(root, 'production-spec.json');
  const spec = fs.existsSync(specFile) ? JSON.parse(fs.readFileSync(specFile, 'utf8').replace(/^\uFEFF/, '')) : { effects: [] };
  const specById = new Map((spec.effects || []).map(item => [item.id, item]));
  const ready = [], skipped = [];
  for (const item of catalog.items || []) {
    if (!item.id || ['pending', 'generating', 'failed'].includes(item.status) || !exists(item.model) || !exists(item.preview)) { skipped.push(item.id || '(no id)'); continue; }
    const glb = fs.readFileSync(path.resolve(root, item.model));
    if (glb.length < 12 || glb.readUInt32LE(0) !== 0x46546c67 || glb.readUInt32LE(4) !== 2 || glb.readUInt32LE(8) !== glb.length) throw new Error('Not an actual complete GLB: ' + item.id);
    const imageHeader = fs.readFileSync(path.resolve(root, item.preview)).subarray(0, 8);
    if (!imageHeader.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Not an actual preview PNG: ' + item.id);
    ready.push(item);
  }
  ready.sort((a, b) => (a.order ?? 99999) - (b.order ?? 99999) || a.id.localeCompare(b.id));
  const recipeData = {};
  const cards = ready.map((item, index) => {
    const viewer = link('index.html') + '?effect=' + encodeURIComponent(item.id);
    const manifest = item.manifest || `manifests/${item.id}.json`;
    const manifestLink = exists(manifest) ? `<a href="${escape(link(manifest))}">검사 기록</a>` : '';
    const recipeFile = item.recipe || `recipes/${item.id}.json`;
    let recipeLink = '';
    if (exists(recipeFile)) recipeLink = `<a href="${escape(link(recipeFile))}">레시피</a>`;
    else if (specById.has(item.id)) {
      recipeData[item.id] = specById.get(item.id);
      recipeLink = `<a href="#recipe-${escape(item.id)}" data-recipe="${escape(item.id)}">레시피</a>`;
    }
    const category = item.category || 'other', weapon = item.weapon_id || 'common';
    const search = [item.id, item.name_ko, item.name_en, item.purpose, categories[category], weapons[weapon]].filter(Boolean).join(' ').toLowerCase();
    return `<article class="card" data-id="${escape(item.id)}" data-category="${escape(category)}" data-weapon="${escape(weapon)}" data-search="${escape(search)}">
      <a class="art" href="${escape(viewer)}" aria-label="${escape(item.name_ko || item.id)} 실제 3D 애니메이션 보기">${preview(item, link(item.preview))}<span class="number">${String(index + 1).padStart(2, '0')}</span><span class="duration">${Number(item.duration || 0).toFixed(2)}초${item.loop ? ' · 반복' : ''}</span></a>
      <div class="copy"><div class="category">${escape(categories[category] || category)}${weapon === 'common' ? '' : ' · ' + escape(weapons[weapon] || weapon)}</div><h2>${escape(item.name_ko || item.id)}</h2><div class="english">${escape(item.name_en || '')}</div><p class="purpose">${escape(item.purpose || '')}</p><div class="meta">${Number(item.triangles || 0).toLocaleString('ko-KR')} 삼각형 · ${Number(item.animation_count || 0)}개 실제 클립</div><nav class="links"><a class="primary" href="${escape(viewer)}">움직임 보기 ↗</a><a href="${escape(link(item.model))}" download="${escape(item.id)}.glb">GLB</a>${recipeLink}${manifestLink}</nav></div>
    </article>`;
  }).join('\n');
  const categoryOptions = [...new Set(ready.map(item => item.category || 'other'))].map(id => `<option value="${escape(id)}">${escape(categories[id] || id)}</option>`).join('');
  const weaponOptions = [...new Set(ready.map(item => item.weapon_id || 'common'))].map(id => `<option value="${escape(id)}">${escape(weapons[id] || id)}</option>`).join('');
  const sequenceLink = exists('attack-sequences.html') ? `<a class="toplink" href="${escape(link('attack-sequences.html'))}">무기별 공격 시연 ↗</a>` : '';
  const specLink = fs.existsSync(specFile) ? `<a href="${escape(link('production-spec.json'))}">전체 제작 명세 JSON</a>` : '';
  const scriptData = JSON.stringify({ overviewIDs, recipes: recipeData, total: ready.length }).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Cloudstitch · 전투 효과 모음</title><style>
  :root{font-family:"Malgun Gothic","Apple SD Gothic Neo",Arial,sans-serif;color:#345c50;background:#eae7dc;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,select{font:inherit}button,select{cursor:pointer}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #92b29b;outline-offset:3px}.shell{max-width:1440px;margin:auto;padding:31px 30px 22px}header{display:flex;justify-content:space-between;align-items:center;gap:22px;margin-bottom:22px}.eyebrow{font-size:10px;letter-spacing:2.7px;color:#8d9c87;margin-bottom:10px}h1{font-size:27px;letter-spacing:-.6px;margin:0}header p{font-size:11px;color:#8b9b81;line-height:1.9;margin:10px 0 0}.header-links{display:flex;flex-direction:column;align-items:flex-end;gap:11px}.toplink{font-size:11px;color:#668d71;text-decoration:none;padding:10px 13px;border:1px solid #c6d2bd;background:#f8f6eb;border-radius:6px;white-space:nowrap}.count{font-size:10px;color:#94a187}.filters{display:flex;align-items:center;gap:11px;flex-wrap:wrap;margin:0 0 19px}.filters select,.filters input{border:1px solid #cbd5c2;border-radius:6px;color:#6d8b70;background:#faf8ee;padding:9px 12px;font-size:11px}.filters input{flex:1;min-width:150px}.backgrounds{display:flex;gap:4px;padding:3px;border-radius:7px;background:#dfe6d7}.backgrounds button{font-size:10px;border:0;padding:7px 10px;border-radius:5px;color:#8b9e82;background:transparent}.backgrounds button[aria-pressed=true]{background:#4a7667;color:#fff}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:17px}.card{background:#fbf9ef;border:1px solid #cfd5c3;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px #49674808}.card[hidden]{display:none}.art{display:block;position:relative;width:100%;aspect-ratio:1.35;border-bottom:1px solid #d9dfcf;overflow:hidden;background:radial-gradient(ellipse at center,#2d5655,#1c4247 75%,#17393f)}body[data-background=cream] .art{background:radial-gradient(ellipse at center,#fffdf3,#f2eddf)}.preview{display:block;width:100%;height:100%;object-fit:contain}.number,.duration{position:absolute;font-size:9px;color:#91b5a6;pointer-events:none}.number{left:13px;top:12px;letter-spacing:1px}.duration{right:12px;bottom:11px;font-variant-numeric:tabular-nums}body[data-background=cream] .number,body[data-background=cream] .duration{color:#a2ad92}.copy{padding:15px 16px}.category{font-size:9px;color:#99a78c;margin-bottom:7px}h2{font-size:14px;letter-spacing:-.2px;margin:0;font-weight:650}.english{font-size:8px;color:#acb59a;letter-spacing:.4px;margin-top:5px;min-height:12px}.purpose{font-size:10px;color:#8a9c80;line-height:1.8;margin:11px 0;min-height:36px}.meta{font-size:9px;color:#a7b197;margin-bottom:12px}.links{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px dashed #dce1ce;padding-top:12px}.links a{font-size:9px;color:#97a88a;text-decoration:none}.links .primary{color:#5f8b6d;font-size:10px;font-weight:600;margin-right:auto}.links a:hover{text-decoration:underline}.empty{padding:35px;border:1px dashed #c8d3bd;border-radius:8px;color:#8da181;font-size:12px}.empty[hidden]{display:none}footer{font-size:9px;color:#9eac90;line-height:1.9;display:flex;justify-content:space-between;gap:20px;margin-top:20px}dialog{border:1px solid #c7d2bc;background:#fbf9ef;color:#577c60;border-radius:12px;max-width:min(760px,92vw);max-height:85vh;padding:24px;box-shadow:0 18px 60px #0e342447}dialog::backdrop{background:#1d3c3570}.dialog-head{display:flex;justify-content:space-between;align-items:center;gap:20px}.dialog-head h2{font-size:17px}.dialog-head button{border:1px solid #cad5c0;background:#f3f4e8;color:#8da080;padding:7px 11px;border-radius:6px;font-size:10px}dialog pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;line-height:1.8;color:#879b7b}dialog a{font-size:11px;color:#6d9478}.overview .filters{display:none}.overview .purpose{display:none}.overview .copy{padding:13px 15px}.overview .meta{margin-top:10px}.overview .english{min-height:0}.overview header p br{display:none}.overview .grid{gap:15px}
  @media(max-width:1100px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}.shell{padding:25px 22px}}@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}header{align-items:flex-start}.header-links{gap:9px}h1{font-size:24px}.toplink{font-size:10px;padding:9px}.filters input{min-width:140px}footer{flex-direction:column;gap:4px}}@media(max-width:520px){.shell{padding:21px 13px}.grid{grid-template-columns:1fr}.overview .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.overview .copy{padding:10px}.overview h2{font-size:11px}.overview .english{display:none}.overview .meta{font-size:8px}.overview .links{gap:6px}.overview .links a{font-size:8px}.overview .category{font-size:8px}.overview .art{aspect-ratio:1.15}h1{font-size:23px}.eyebrow{font-size:8px;letter-spacing:1.7px}header p{font-size:10px}.header-links{align-items:flex-end}.toplink{font-size:9px;padding:8px}.count{font-size:9px}.filters{gap:8px}.filters select{flex:1;min-width:0}.filters input{min-width:100%;width:100%}.backgrounds{margin-left:auto}.copy{padding:17px}.purpose{min-height:0}footer{font-size:8px}dialog{padding:17px}dialog pre{font-size:10px}}
</style></head><body data-background="deepteal"><div class="shell"><header><div><div class="eyebrow">CLOUDSTITCH · ANIMATED MESH VFX</div><h1>전투 효과 모음</h1><p id="intro">화염, 연기, 충격과 구름을 잇는 작은 움직임들.<br>실제 GLB 애니메이션의 대표 프레임입니다. 실제 게임 플레이 화면은 아닙니다.</p></div><div class="header-links">${sequenceLink}<a class="toplink" href="${escape(link('index.html'))}">전투 효과 3D 작업대 ↗</a><span id="result-count" class="count" aria-live="polite"></span></div></header>
  <section class="filters" aria-label="효과 찾기"><select id="category-filter" aria-label="계열 필터"><option value="all">모든 계열</option>${categoryOptions}</select><select id="weapon-filter" aria-label="무기 필터"><option value="all">모든 무기</option>${weaponOptions}</select><input id="search" type="search" placeholder="효과 이름이나 역할 검색" aria-label="효과 검색"><div class="backgrounds" role="group" aria-label="미리보기 배경"><button data-background="cream" aria-pressed="false">크림</button><button data-background="deepteal" aria-pressed="true">짙은 청록</button></div></section>
  <main id="grid" class="grid">${cards}</main><p id="empty" class="empty" hidden>조건에 맞는 완료 효과가 없습니다.</p><footer><span>정지 미리보기는 실제 GLB 클립에서 브라우저로 렌더했습니다. 움직임은 3D 작업대에서 확인하세요.</span><span>원본 PNG 보존 · 메시 변환 애니메이션 · 충돌·피해·엔진 성능은 후속 검증</span></footer></div>
  <dialog id="recipe-dialog"><div class="dialog-head"><h2 id="recipe-title">효과 레시피</h2><button id="close-recipe">닫기</button></div><pre id="recipe-content"></pre>${specLink}</dialog>
  <script type="application/json" id="gallery-data">${scriptData}</script><script>
  (()=>{const data=JSON.parse(document.getElementById('gallery-data').textContent),$=id=>document.getElementById(id),overview=new URLSearchParams(location.search).get('overview')==='1',cards=[...document.querySelectorAll('.card')];if(overview){document.body.classList.add('overview');$('intro').textContent='여섯 무기의 발사와 폭발·피격·방어·수리·회수를 고른 실제 3D 대표 프레임입니다.';}function update(){const category=$('category-filter').value,weapon=$('weapon-filter').value,query=$('search').value.trim().toLowerCase();let shown=0;for(const card of cards){const yes=(!overview||data.overviewIDs.includes(card.dataset.id))&&(category==='all'||card.dataset.category===category)&&(weapon==='all'||card.dataset.weapon===weapon)&&(!query||card.dataset.search.includes(query));card.hidden=!yes;if(yes)shown++;}$('result-count').textContent=(overview?'대표 ':'')+shown+'종 / 완료 렌더 '+data.total+'종';$('empty').hidden=shown!==0;}['category-filter','weapon-filter'].forEach(id=>$(id).addEventListener('change',update));$('search').addEventListener('input',update);document.querySelectorAll('button[data-background]').forEach(button=>button.addEventListener('click',()=>{document.body.dataset.background=button.dataset.background;document.querySelectorAll('button[data-background]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));}));document.querySelectorAll('[data-recipe]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();const recipe=data.recipes[link.dataset.recipe];if(!recipe)return;$('recipe-title').textContent=recipe.name_ko||recipe.id;$('recipe-content').textContent=JSON.stringify(recipe,null,2);$('recipe-dialog').showModal();}));$('close-recipe').addEventListener('click',()=>$('recipe-dialog').close());update();})();
  </script></body></html>`;
  fs.mkdirSync(destination, { recursive: true }); fs.writeFileSync(output, html, 'utf8');
  console.log(JSON.stringify({ output, completedRenderCount: ready.length, skipped, overviewReady: overviewIDs.filter(id => ready.some(item => item.id === id)), attackSequenceLinked: Boolean(sequenceLink), previewImagesEdited: false }, null, 2));
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
