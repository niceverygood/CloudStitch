'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repoRoot = path.resolve(__dirname, '..', '..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const toPosix = value => value.split(path.sep).join('/');

function containedPath(base, candidate) {
  if (typeof candidate !== 'string' || !candidate || /^(?:[a-z]+:|[\\/])/i.test(candidate)) return null;
  const file = path.resolve(base, candidate);
  const relative = path.relative(base, file);
  return relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative) ? file : null;
}

function existingPath(base, candidate) {
  const file = containedPath(base, candidate);
  return file && fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

function writeGallery(options = {}) {
  const out = path.resolve(options.out || path.join(repoRoot, 'outputs', 'fleet-v2'));
  const catalogPath = path.resolve(options.catalog || path.join(out, 'catalog.json'));
  const source = options.catalogObject || readJSON(catalogPath);
  if (!source || !Array.isArray(source.ships)) throw new Error('catalog.ships 배열이 필요합니다.');
  const oldOut = path.join(repoRoot, 'outputs', 'fleet-v1');
  const oldCatalogFile = path.join(oldOut, 'catalog.json');
  const oldCatalog = fs.existsSync(oldCatalogFile) ? readJSON(oldCatalogFile) : { ships: [] };
  const oldById = new Map((oldCatalog.ships || []).map(ship => [ship.id, ship]));
  const sourceIds = new Set();
  const active = source.ships.filter(ship => ship.category !== 'preexisting-variant');
  const ships = active.map(ship => {
    if (!ship.id || sourceIds.has(ship.id)) throw new Error('카탈로그 ID 누락 또는 중복: ' + ship.id);
    sourceIds.add(ship.id);
    const viewerFile = existingPath(out, ship.viewerPath);
    const assetFile = existingPath(out, ship.assetPath);
    const previewFile = existingPath(out, ship.previewPath);
    const planned = /^planned(?:-|$)/.test(ship.status || '');
    const assetAvailable = Boolean(assetFile && !planned);
    const previewHashMatches = typeof ship.sha256 === 'string'
      && /^[a-f0-9]{64}$/i.test(ship.sha256)
      && ship.previewSourceSha256 === ship.sha256;
    const previewStale = Boolean(previewFile && !previewHashMatches);
    const previous = oldById.get(ship.id);
    const oldViewer = previous && existingPath(oldOut, previous.viewerPath);
    const oldPreview = previous && existingPath(oldOut, previous.previewPath);
    return {
      ...ship,
      viewerAvailable: Boolean(viewerFile && assetAvailable), assetAvailable,
      previewAvailable: Boolean(previewFile && assetAvailable && previewHashMatches), previewStale,
      previewState: previewStale ? 'stale' : previewFile && assetAvailable && previewHashMatches ? 'ready' : 'missing',
      previous: previous ? {
        name: previous.name,
        viewerPath: oldViewer ? toPosix(path.relative(out, oldViewer)) : null,
        previewPath: oldPreview ? toPosix(path.relative(out, oldPreview)) : null,
        sha256: previous.sha256 || null,
      } : null,
    };
  });
  const catalog = { ...source, ships, gallery: {
    activeEntries: ships.length,
    sourceEntries: source.originalCatalogCount || source.ships.length,
    excludedPreexistingAlternatives: source.excludes?.length || source.ships.length - ships.length,
    entryCountIsUniqueHullCount: false,
    offlineViewer: '개별 HTML에 GLB와 렌더러를 내장. 갤러리는 로컬 경로만 사용.',
    sizeComparison: '제작용 상대 단위이며 실제 미터 또는 최종 게임 크기가 아님.',
  } };
  const template = fs.readFileSync(path.join(__dirname, 'gallery-template.html'), 'utf8');
  if (!template.includes('/* FLEET_CATALOG */')) throw new Error('갤러리 카탈로그 삽입 위치가 없습니다.');
  const html = template.replace('/* FLEET_CATALOG */', () => JSON.stringify(catalog).replace(/</g, '\\u003c'));
  fs.mkdirSync(out, { recursive: true });
  const indexPath = path.join(out, 'index.html');
  fs.writeFileSync(indexPath, html);
  const result = {
    output: toPosix(path.relative(repoRoot, indexPath)),
    sha256: sha(Buffer.from(html)),
    activeEntries: ships.length,
    readyViewers: ships.filter(ship => ship.viewerAvailable).length,
    readyPreviews: ships.filter(ship => ship.previewAvailable).length,
    stalePreviews: ships.filter(ship => ship.previewStale).length,
    excludedPreexistingAlternatives: source.excludes?.length || source.ships.length - ships.length,
    overview: fs.existsSync(path.join(out, 'fleet-overview.png')) && ships.filter(ship => ship.previewAvailable).length >= 13
      ? '대표13항목 실제 v2 모델/실루엣 PNG 비교판 준비. 개별 화면 맞춤 크기이며 게임 배율이 아님.'
      : 'PNG 종합판은 실제 v2 캡처가 준비된 뒤 순차 캡처로 작성. v1 이미지를 v2로 재사용하지 않음.',
  };
  fs.writeFileSync(path.join(out, 'gallery-build.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const option = name => args.find(arg => arg.startsWith('--' + name + '='))?.slice(name.length + 3);
  try { console.log(JSON.stringify(writeGallery({ out: option('out'), catalog: option('catalog') }))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { writeGallery };
