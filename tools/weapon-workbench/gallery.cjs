/* A local overview of completed weapon prototypes, using actual browser GLB renders. */
const fs = require('node:fs');
const path = require('node:path');
const { repoPath } = require('../lib/paths.cjs');
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const uriPath = value => value.split(path.sep).join('/').split('/').map(encodeURIComponent).join('/');

function previewMarkup(item, href) {
  const alt = escape((item.name_ko || item.id) + ' 실제 3D 모델의 손그림 표시 렌더');
  const metadata = item.preview_image;
  const box = metadata?.bounds;
  const width = Number(metadata?.width), height = Number(metadata?.height);
  if (width > 0 && height > 0 && Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) && box[2] > box[0] && box[3] > box[1]) {
    const visibleWidth = box[2] - box[0], visibleHeight = box[3] - box[1];
    const padX = visibleWidth * .08, padY = visibleHeight * .08;
    const viewBox = [box[0] - padX, box[1] - padY, visibleWidth + 2 * padX, visibleHeight + 2 * padY].map(number => Number(number.toFixed(3))).join(' ');
    // Native SVG changes display framing only. The original browser-rendered
    // transparent PNG is referenced intact, at its actual source dimensions.
    return `<svg class="preview-crop" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${alt}"><title>${alt}</title><image href="${escape(href)}" width="${width}" height="${height}"/></svg>`;
  }
  return `<img src="${escape(href)}" alt="${alt}" width="1200" height="650">`;
}

function main() {
  const catalogPath = repoPath(process.argv[2] || 'outputs/weapon-modules/catalog.json');
  const output = repoPath(process.argv[3] || 'outputs/weapon-modules/gallery.html');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const root = path.dirname(catalogPath), destination = path.dirname(output);
  const link = file => uriPath(path.relative(destination, path.resolve(root, file)));
  const ready = [], skipped = [];
  for (const item of catalog.items || []) {
    const model = item.model && path.resolve(root, item.model);
    const preview = item.preview && path.resolve(root, item.preview);
    if (!item.id || ['pending', 'generating', 'failed'].includes(item.status) || !model || !fs.existsSync(model) || !preview || !fs.existsSync(preview)) {
      skipped.push(item.id || '(no id)');
      continue;
    }
    const glbHeader = fs.readFileSync(model).subarray(0, 12);
    if (glbHeader.length !== 12 || glbHeader.readUInt32LE(0) !== 0x46546c67 || glbHeader.readUInt32LE(4) !== 2) throw new Error('Not an actual GLB: ' + model);
    ready.push(item);
  }
  ready.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
  const cards = ready.map((item, index) => {
    const view = link('index.html') + '?weapon=' + encodeURIComponent(item.id);
    const reference = item.reference && fs.existsSync(path.resolve(root, item.reference)) ? `<a href="${escape(link(item.reference))}">기준 그림</a>` : '';
    return `<article class="card" data-weapon-id="${escape(item.id)}">
      <a class="art" href="${escape(view)}" aria-label="${escape(item.name_ko || item.id)} 실제 3D로 보기">${previewMarkup(item, link(item.preview))}<span class="number">${String(index + 1).padStart(2, '0')}</span></a>
      <div class="copy"><div class="name-line"><h2>${escape(item.name_ko || item.id)}</h2><span class="triangles">${Number(item.triangles || 0).toLocaleString('ko-KR')} 삼각형</span></div><div class="english">${escape(item.name_en || '')}</div><p class="role">${escape(item.role || item.description || '손그림의 색과 선을 담은 독립 3D 무기 원형입니다.')}</p><nav class="links" aria-label="${escape(item.name_ko || item.id)} 자료"><a class="primary" href="${escape(view)}">3D로 보기 <span aria-hidden="true">↗</span></a>${reference}<a href="${escape(link(item.model))}" download="${escape(item.id)}.glb">GLB 다운로드</a></nav></div>
    </article>`;
  }).join('\n');
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Cloudstitch · 손그림 3D 무기 모음</title><style>
  :root{font-family:"Malgun Gothic","Apple SD Gothic Neo",Arial,sans-serif;color:#31544b;background:#eae7dc;font-synthesis:none}*{box-sizing:border-box}body{margin:0}.shell{max-width:1440px;margin:auto;padding:38px 32px 24px}header{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:27px}.eyebrow{font-size:10px;letter-spacing:3px;color:#8b9988;margin-bottom:11px}h1{font-size:29px;letter-spacing:-.8px;margin:0;font-weight:650}header p{font-size:12px;line-height:1.8;color:#88967f;margin:11px 0 0}.counter{font-size:11px;color:#8d9b86;white-space:nowrap;padding-bottom:3px}.counter b{font-size:22px;color:#5c7e6c;font-weight:500;padding-right:5px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.card{border:1px solid #d1d4c5;background:#fbf9ef;border-radius:13px;overflow:hidden;box-shadow:0 9px 28px #35544b08}.art{position:relative;display:block;width:100%;aspect-ratio:1.72;background:#f8f5e9;border-bottom:1px solid #e0e1d1}.art img{display:block;width:100%;height:100%;object-fit:contain}.number{position:absolute;left:15px;top:14px;font-size:10px;color:#a5ac97;letter-spacing:1.2px}.copy{padding:19px 20px 17px}.name-line{display:flex;align-items:baseline;justify-content:space-between;gap:10px}h2{font-size:18px;letter-spacing:-.4px;margin:0;font-weight:650}.triangles{font-size:10px;white-space:nowrap;color:#99a38c}.english{font-size:10px;letter-spacing:1px;color:#a1a88f;margin-top:6px}.role{font-size:11px;line-height:1.9;color:#899781;min-height:42px;margin:14px 0 16px}.links{display:flex;align-items:center;gap:14px;border-top:1px dashed #dddfcc;padding-top:14px;flex-wrap:wrap}.links a{color:#93a08a;font-size:10px;text-decoration:none}.links .primary{color:#4f7e69;font-size:11px;font-weight:600;margin-right:auto}.primary span{margin-left:5px}a:focus-visible{outline:3px solid #7aa792;outline-offset:4px}.links a:hover{text-decoration:underline}.empty{padding:45px;background:#fbf9ef;border-radius:12px;color:#8b9780;font-size:13px}footer{display:flex;justify-content:space-between;gap:20px;font-size:10px;color:#9aa58e;line-height:1.8;margin-top:23px}
  @media(max-width:1050px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.shell{padding:28px 22px}.copy{padding:17px}}@media(max-width:650px){.shell{padding:23px 14px}.grid{grid-template-columns:1fr;gap:17px}header{align-items:flex-start;gap:12px;margin-bottom:21px}h1{font-size:25px}.eyebrow{font-size:8px;letter-spacing:2px}header p{font-size:11px;max-width:260px}.counter{font-size:9px;padding-top:25px}.counter b{font-size:19px}footer{font-size:9px;flex-direction:column;gap:3px}.role{min-height:0}.copy{padding:17px 18px}}
  .art{aspect-ratio:1.35}.art .preview-crop{display:block;width:100%;height:100%;overflow:hidden}
</style></head><body><div class="shell"><header><div><div class="eyebrow">CLOUDSTITCH · HANDCRAFTED ARSENAL</div><h1>작은 배를 지키는 도구들</h1><p>청록색 기계, 따뜻한 목재와 황동.<br>비행선과 같은 손그림 감성으로 만든 실제 3D 무기 원형입니다.</p></div><div class="counter"><b>${ready.length}</b>종 제작</div></header><main class="grid">${cards || '<p class="empty">완료한 3D 원형과 렌더를 준비하고 있습니다.</p>'}</main><footer><span>이미지는 실제 GLB를 브라우저에서 렌더한 손그림 표시입니다.</span><span>독립 3D 원형 · 게임용 부품 분리·소켓·발사 동작은 후속 작업</span></footer></div></body></html>`;
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(output, html, 'utf8');
  console.log(JSON.stringify({ output, displayed: ready.map(item => item.id), skipped, completeAssetCount: ready.length }, null, 2));
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
