/* Build a gallery from actual GLBs and intact native-render preview PNGs.
 * CLI: node tools/world-assets/gallery.cjs [catalog] [outputHTML] [sceneCatalog] [overview=1]
 * URL: gallery.html?overview=1 shows the six hero assets plus seven scenes only.
 * No image generation, PNG editing, model mutation, or network request occurs here.
 */
const fs = require('node:fs');
const path = require('node:path');
const { repoPath } = require('../lib/paths.cjs');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const uriPath = value => value.split(path.sep).join('/').split('/').map(encodeURIComponent).join('/');
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const categoryNames = { 'hero-buildings': '주요 건물', architecture: '부두·건축', terrain: '지형·구름', vegetation: '식생', props: '생활 소품', navigation: '지도·항법', interactables: '기능 접점', scene: '조립 장면' };
const heroIDs = ['harbor-inn', 'repair-workshop', 'canvas-market', 'harbor-office', 'beacon-lighthouse', 'memory-observatory'];
const sceneIDs = ['jonghang-harbor', 'updraft-canyon', 'storm-shelter', 'iron-rib-yard', 'lower-fog-mooring', 'royal-service-deck', 'world-map-diorama'];
const blockedStatuses = new Set(['pending', 'planned', 'planned_before_build', 'generating', 'failed', 'cancelled']);

function inspectPNG(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.subarray(12, 16).toString('ascii') !== 'IHDR') throw new Error('Not an actual preview PNG: ' + file);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height) throw new Error('Empty preview dimensions: ' + file);
  return { width, height };
}
function inspectGLB(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Not an actual complete GLB: ' + file);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  if (!json.meshes?.length) throw new Error('GLB contains no meshes: ' + file);
  return { bytes: bytes.length, meshes: json.meshes.length, animations: json.animations?.length || 0 };
}
function previewMarkup(item, href, png) {
  const metadata = item.preview_image, box = metadata?.bounds;
  const alt = escape((item.name_ko || item.id) + ' 실제 GLB의 손그림 렌더');
  if (Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) && box[0] >= 0 && box[1] >= 0 && box[2] <= png.width && box[3] <= png.height && box[2] > box[0] && box[3] > box[1]) {
    const w = box[2] - box[0], h = box[3] - box[1], p = .08;
    const viewBox = [box[0] - w * p, box[1] - h * p, w * (1 + 2 * p), h * (1 + 2 * p)].map(value => Number(value.toFixed(3))).join(' ');
    // Framing references the unchanged source PNG; no pixels are transformed.
    return `<svg class="preview" viewBox="${viewBox}" role="img" aria-label="${alt}" xmlns="http://www.w3.org/2000/svg"><title>${alt}</title><image href="${escape(href)}" width="${png.width}" height="${png.height}"/></svg>`;
  }
  return `<img class="preview" src="${escape(href)}" alt="${alt}" width="${png.width}" height="${png.height}" loading="eager">`;
}

function main() {
  const args = process.argv.slice(2), overview = args.some(value => /^(?:--)?overview=1$/.test(value));
  const positional = args.filter(value => !/^(?:--)?overview=/.test(value));
  const catalogPath = repoPath(positional[0] || 'outputs/world-assets/catalog.json');
  const root = path.dirname(catalogPath);
  const output = repoPath(positional[1] || (overview ? 'outputs/world-assets/gallery-overview.html' : 'outputs/world-assets/gallery.html'));
  const sceneCatalogPath = positional[2] ? repoPath(positional[2]) : path.join(root, 'scene-catalog.json');
  const destination = path.dirname(output), specPath = path.join(root, 'production-spec.json');
  const spec = fs.existsSync(specPath) ? readJSON(specPath) : { assets: [], scenes: [] };
  const definitions = new Map([...(spec.assets || []), ...(spec.scenes || [])].map(item => [item.id, item]));
  const relativeLink = file => uriPath(path.relative(destination, file));
  const exists = file => Boolean(file && fs.existsSync(file));
  const available = { asset: [], scene: [] }, skipped = [];
  for (const [kind, file] of [['asset', catalogPath], ['scene', sceneCatalogPath]]) {
    if (!exists(file)) { if (kind === 'asset') throw new Error('Missing asset catalog: ' + file); continue; }
    const base = path.dirname(file), ids = new Set();
    for (const item of readJSON(file).items || []) {
      if (!item.id || ids.has(item.id)) throw new Error('Missing or duplicate catalog id: ' + item.id); ids.add(item.id);
      const model = item.model && path.resolve(base, item.model), preview = item.preview && path.resolve(base, item.preview);
      if (blockedStatuses.has(item.status) || !exists(model) || !exists(preview)) { skipped.push({ kind, id: item.id, reason: 'actual GLB/native PNG not ready' }); continue; }
      available[kind].push({ item, base, model, preview, png: inspectPNG(preview), glb: inspectGLB(model), kind });
    }
    available[kind].sort((a, b) => (a.item.order ?? 99999) - (b.item.order ?? 99999) || a.item.id.localeCompare(b.item.id));
  }
  const included = overview ? { asset: available.asset.filter(entry => heroIDs.includes(entry.item.id)), scene: available.scene.filter(entry => sceneIDs.includes(entry.item.id)) } : available;
  const recipes = {};
  function card(entry) {
    const { item, base, kind, glb, png } = entry, definition = definitions.get(item.id);
    const category = kind === 'scene' ? 'scene' : item.category || 'other';
    const name = item.name_ko || item.id, role = item.role || item.purpose || definition?.role || definition?.purpose || '';
    const viewerPath = path.join(base, kind === 'scene' ? 'scenes.html' : 'index.html');
    const viewer = relativeLink(viewerPath) + '?asset=' + encodeURIComponent(item.id);
    const primary = exists(viewerPath) ? `<a class="primary" href="${escape(viewer)}">3D로 보기 ↗</a>` : '<span class="pending">작업대 빌드 대기</span>';
    const art = previewMarkup(item, relativeLink(entry.preview), png);
    const manifestCandidates = [item.manifest, `manifests/${item.id}.json`, `hero/${item.id}/manifest.json`, `hero-models/${item.id}/manifest.json`].filter(Boolean).map(value => path.resolve(base, value));
    const manifest = manifestCandidates.find(exists);
    const manifestLink = manifest ? `<a href="${escape(relativeLink(manifest))}">검사 기록</a>` : '';
    const references = [item.reference, item.reference_png, `references/${item.id}.png`, `hero/${item.id}/reference.png`, `hero-models/${item.id}/reference.png`].filter(Boolean).map(value => path.resolve(base, value));
    const reference = references.find(exists), referenceLink = reference ? `<a href="${escape(relativeLink(reference))}">기준 그림</a>` : '';
    let specLink = '';
    if (definition) { recipes[item.id] = definition; specLink = `<a href="#spec-${escape(item.id)}" data-spec="${escape(item.id)}">제작 명세</a>`; }
    const search = [item.id, name, item.name_en, role, categoryNames[category] || category, definition?.region_ko].filter(Boolean).join(' ').toLowerCase();
    const artLink = exists(viewerPath) ? `<a class="art" href="${escape(viewer)}" aria-label="${escape(name)} 실제3D 보기">${art}<span class="number">${String(item.order || 0).padStart(2, '0')}</span></a>` : `<div class="art">${art}</div>`;
    return `<article class="card${heroIDs.includes(item.id) ? ' hero' : ''}" data-id="${escape(item.id)}" data-kind="${kind}" data-category="${escape(category)}" data-hero="${heroIDs.includes(item.id)}" data-search="${escape(search)}">${artLink}<div class="copy"><div class="category">${escape(kind === 'scene' ? '별도 조립 비교' : categoryNames[category] || category)}</div><h3>${escape(name)}</h3><div class="english">${escape(item.name_en || '')}</div><p class="role">${escape(role)}</p><div class="meta">${Number(item.triangles || 0).toLocaleString('ko-KR')} 삼각형 · ${glb.meshes}개 메시 · ${glb.animations}개 클립</div><nav class="links">${primary}<a href="${escape(relativeLink(entry.model))}" download="${escape(item.id)}.glb">GLB 다운로드</a>${referenceLink}${manifestLink}${specLink}</nav></div></article>`;
  }
  const assets = included.asset.map(card).join('\n'), scenes = included.scene.map(card).join('\n');
  const categories = [...new Set(included.asset.map(entry => entry.item.category || 'other'))];
  const options = categories.map(category => `<option value="${escape(category)}">${escape(categoryNames[category] || category)}</option>`).join('') + (included.scene.length ? '<option value="scene">조립 장면</option>' : '');
  const docLinks = [['production-spec.json', '전체 제작 명세'], ['README.txt', '사용 안내'], ['index.html', '독립 자산 작업대'], ['scenes.html', '조립 장면 작업대']].filter(([name]) => exists(path.join(root, name))).map(([name, label]) => `<a href="${escape(relativeLink(path.join(root, name)))}">${label}</a>`).join('');
  const data = JSON.stringify({ totalAssets: available.asset.length, totalScenes: available.scene.length, overviewDefault: overview, heroIDs, sceneIDs, recipes }).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Cloudstitch · 하늘 위의 작은 마을</title><style>
  :root{font-family:"Malgun Gothic","Apple SD Gothic Neo",Arial,sans-serif;color:#355b59;background:#ece8db;font-synthesis:none}*{box-sizing:border-box}body{margin:0}a{color:inherit}button,input,select{font:inherit}button,select{cursor:pointer}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #cd8b62;outline-offset:4px}.shell{max-width:1500px;margin:auto;padding:44px 34px 30px}.eyebrow{color:#85958a;font-size:10px;letter-spacing:3px}header{display:flex;justify-content:space-between;gap:28px;align-items:center}h1{font-size:39px;letter-spacing:-1.7px;font-weight:600;margin:13px 0}header p{font-size:13px;line-height:1.9;color:#7e9188;max-width:720px}.counts{display:flex;gap:25px;white-space:nowrap}.count{text-align:center;font-size:11px;color:#86988c}.count b{display:block;font-size:35px;font-weight:500;color:#547c72;margin-bottom:8px}.docs{display:flex;flex-wrap:wrap;gap:10px 22px;margin:23px 0;color:#7e9485;font-size:11px}.tools{position:sticky;top:0;z-index:4;background:#ece8dbf5;border-block:1px solid #d4dbcc;backdrop-filter:blur(12px);padding:16px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.tools input,.tools select{border:1px solid #cad2c0;background:#fffdf4;color:#5c7e6d;padding:11px 13px;border-radius:8px;font-size:12px}.tools input{flex:1;min-width:180px}.tools label{font-size:11px;color:#80947f;display:flex;gap:8px;align-items:center}.result{font-size:11px;color:#80917f;margin-left:auto}.section-heading{display:flex;justify-content:space-between;align-items:baseline;gap:18px;margin:35px 0 16px}h2{font-size:22px;letter-spacing:-.6px;font-weight:500;margin:0}.section-heading p{font-size:11px;color:#91a28e;line-height:1.8;margin:0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.scene-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.card{background:#fcfaf1;border:1px solid #d1d8c6;border-radius:13px;overflow:hidden;box-shadow:0 5px 17px #314d3905}.card[hidden],section[hidden]{display:none}.art{position:relative;display:block;height:295px;padding:21px 24px 10px;background:radial-gradient(ellipse at 50% 43%,#fffef7,#f2efe2);text-decoration:none}.scene-grid .art{height:340px}.hero .art{height:320px}.preview{width:100%;height:100%;object-fit:contain;display:block}.number{position:absolute;top:15px;left:16px;font-size:10px;letter-spacing:1px;color:#9b9c83}.copy{padding:23px 24px 24px}.category{font-size:9px;letter-spacing:1.3px;color:#a4ab91;margin-bottom:10px}h3{font-size:21px;letter-spacing:-.6px;line-height:1.4;font-weight:500;margin:0}.english{font-size:10px;letter-spacing:.5px;color:#a5ad94;margin-top:7px}.role{font-size:12px;line-height:1.9;color:#84957d;min-height:45px;margin:15px 0}.meta{font-size:10px;color:#a4ad95;line-height:1.8}.links{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:19px;font-size:10px;color:#8b9c85}.links a{text-underline-offset:3px}.links .primary{padding:9px 12px;border:1px solid #c3cebb;border-radius:6px;background:#f5f7e9;color:#557764;text-decoration:none}.pending{color:#ac9d81}.empty{padding:60px 20px;text-align:center;color:#88987e;font-size:13px}footer{border-top:1px solid #d1d9c7;margin-top:35px;padding-top:20px;font-size:10px;color:#9ba68e;line-height:1.9;display:flex;justify-content:space-between;gap:24px}dialog{max-width:820px;width:calc(100% - 32px);max-height:82vh;border:1px solid #cad3c0;border-radius:12px;background:#fffdf3;color:#4c725f;padding:24px}dialog::backdrop{background:#243f4a66}.dialog-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.dialog-head h2{font-size:19px}.dialog-head button{border:1px solid #ced7c3;background:#f5f5e8;border-radius:6px;padding:8px 12px;color:#5b7a65}pre{font:11px/1.8 ui-monospace,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;color:#7a8f76}.overview .tools{position:static}.overview .section-heading{margin-top:28px}
  @media(max-width:1120px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:32px}.counts{gap:20px}.art{height:310px}}@media(max-width:720px){.shell{padding:27px 15px 22px}header{display:block}h1{font-size:29px;letter-spacing:-1px}header p{font-size:11px}.eyebrow{font-size:8px;letter-spacing:2px}.counts{justify-content:flex-start;gap:35px;margin-top:23px}.count{text-align:left}.count b{font-size:28px}.tools{gap:9px}.tools input{width:100%;flex-basis:100%;font-size:11px}.tools select{max-width:180px;font-size:11px}.result{font-size:10px}.grid,.scene-grid{grid-template-columns:minmax(0,1fr);gap:19px}.art,.hero .art,.scene-grid .art{height:305px;padding:18px}.copy{padding:21px}.section-heading{display:block;margin-top:29px}.section-heading p{margin-top:8px}.role{min-height:0}h2{font-size:20px}h3{font-size:20px}footer{display:block;font-size:9px}footer span{display:block;margin-bottom:7px}}
  </style></head><body><div class="shell"><header><div><div class="eyebrow">CLOUDSTITCH · A PLACE TO RETURN TO</div><h1>하늘 위의 작은 마을</h1><p id="intro">크림색 천막, 청록 지붕과 따뜻한 목재.<br>비행선과 같은 감성으로 만든 실제3D 월드 원형을 모았습니다.</p></div><div class="counts"><div class="count"><b>${available.asset.length}</b>독립 자산</div><div class="count"><b>${available.scene.length}</b>조립 장면</div></div></header><nav class="docs">${docLinks}</nav><div class="tools"><input id="search" type="search" aria-label="자산 검색" placeholder="건물, 역할, 지역 이름 검색"><select id="category-filter" aria-label="자산 카테고리"><option value="all">모든 카테고리</option>${options}</select><label><input id="overview" type="checkbox">주요 건물·장면만</label><span id="result-count" class="result"></span></div><main><section id="asset-section"><div class="section-heading"><h2>독립 자산</h2><p>96개 기본팩의 실제 모델과 렌더가 준비된 항목만 표시합니다.</p></div><div class="grid" id="asset-grid">${assets}</div></section><section id="scene-section"><div class="section-heading"><h2>함께 놓아 본 풍경</h2><p>7개 조립 비교 · 독립 자산과 별도 집계 · 실제 게임 맵은 아닙니다.</p></div><div class="grid scene-grid" id="scene-grid">${scenes}</div></section><p id="empty" class="empty" hidden>조건에 맞는 완료 렌더가 없습니다.</p></main><footer><span>미리보기는 실제 GLB의 브라우저 렌더입니다. 원본 PNG를 그대로 참조합니다.</span><span>건물 내부·충돌·navmesh·LOD·상호작용·최종 게임 성능은 후속 작업입니다.</span></footer></div><dialog id="spec-dialog"><div class="dialog-head"><h2 id="spec-title">제작 명세</h2><button id="close-spec">닫기</button></div><pre id="spec-content"></pre></dialog><script id="gallery-data" type="application/json">${data}</script><script>
  (()=>{const data=JSON.parse(document.getElementById('gallery-data').textContent),$=id=>document.getElementById(id),cards=[...document.querySelectorAll('.card')],query=new URLSearchParams(location.search);$('overview').checked=data.overviewDefault||query.get('overview')==='1';function update(){const category=$('category-filter').value,term=$('search').value.trim().toLowerCase(),overview=$('overview').checked;let assets=0,scenes=0;for(const card of cards){const yes=(!overview||card.dataset.hero==='true'||(card.dataset.kind==='scene'&&data.sceneIDs.includes(card.dataset.id)))&&(category==='all'||card.dataset.category===category)&&(!term||card.dataset.search.includes(term));card.hidden=!yes;if(yes){if(card.dataset.kind==='scene')scenes++;else assets++;}}document.body.classList.toggle('overview',overview);$('asset-section').hidden=assets===0;$('scene-section').hidden=scenes===0;$('empty').hidden=assets+scenes>0;$('result-count').textContent='독립 '+assets+'개 · 조립 '+scenes+'개';}['search','category-filter','overview'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',update));document.querySelectorAll('[data-spec]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();const item=data.recipes[link.dataset.spec];if(!item)return;$('spec-title').textContent=item.name_ko||item.id;$('spec-content').textContent=JSON.stringify(item,null,2);$('spec-dialog').showModal();}));$('close-spec').addEventListener('click',()=>$('spec-dialog').close());window.__worldGallery={data,update,getVisibleIds:()=>cards.filter(card=>!card.hidden).map(card=>card.dataset.id)};update();})();
  </script></body></html>`;
  fs.mkdirSync(destination, { recursive: true }); fs.writeFileSync(output, html, 'utf8');
  console.log(JSON.stringify({ output, actualAssets: available.asset.length, actualScenes: available.scene.length, renderedAssetCards: included.asset.length, renderedSceneCards: included.scene.length, overview, skipped, previewImagesEdited: false }, null, 2));
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
