'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'outputs/enemy-fleet-gallery-v1');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const roster = read('outputs/fleet-comparison-v1/inventory.json');
const reference = read('outputs/enemy-fleet-reference-v1/catalog.json');
const groups = {
  standard: ['enemy-pirate-scout','enemy-cult-blockade','enemy-union-salvage','enemy-union-repair','enemy-ghost-chaser','enemy-disguised-wreck','enemy-tax-cutter'],
  mission: ['mission-union-guard','mission-bridge-tug','mission-guard-scout','mission-cult-purifier','mission-ghost-artillery','role-enemy-artillery','role-enemy-defense'],
  boss: ['mini-funeral-guard','boss-bell-devourer','boss-shipyard-ribs','boss-shipwright-command','boss-last-inhale'],
  context: ['rival-change','rival-debts-end','rival-quiet-answer','rival-night-shift','rival-go-first','rival-unfinished','boss-fleet-king'],
};
const groupLabels = {standard:'일반 적선',mission:'임무 · 역할',boss:'보스 · 시설',context:'라이벌 · 시험'};
const shortNames = {'boss-bell-devourer':'종을 삼킨 자','boss-shipyard-ribs':'거신의 늑골','boss-last-inhale':'마지막 들숨','mission-guard-scout':'경비 정찰선'};
const detailLabels = {'boss-bell-devourer':'장례전함','boss-shipyard-ribs':'살아 있는 조선소 · 시설','boss-last-inhale':'원숨 순환 장치 · 시설','mini-funeral-guard':'중간보스','role-enemy-artillery':'함명 · 독자 선체 미정','role-enemy-defense':'함명 · 독자 선체 미정','boss-fleet-king':'비살상 시험 · 후속 협력'};
const ships = Object.entries(groups).flatMap(([group, ids]) => ids.map((id, index) => {
  const original = roster.ships.find(s => s.id === id);
  if (!original) throw Error('Missing ship ' + id);
  const latest = reference.ships.find(s => s.id === id);
  const sourceDir = latest ? '../enemy-fleet-reference-v1/' : '../fleet-v2/';
  const assetPath = sourceDir + 'ships/' + id + '.glb';
  const viewerPath = sourceDir + 'ships/' + id + '.html';
  const previewPath = latest ? '../enemy-fleet-reference-v1/' + latest.previewPath : '../fleet-comparison-v1/' + original.previewPath;
  const model = fs.readFileSync(path.resolve(out, assetPath)), preview = fs.readFileSync(path.resolve(out, previewPath));
  const expected = latest?.sha256 || original.modelSha256;
  if (sha(model) !== expected) throw Error('Model source changed: ' + id);
  if (latest && latest.previewSourceSha256 !== expected) throw Error('Stale preview: ' + id);
  if (!latest && sha(preview) !== original.previewSha256) throw Error('Preview source changed: ' + id);
  if (!fs.existsSync(path.resolve(out, viewerPath))) throw Error('Missing viewer ' + id);
  return {id, name:original.name, shortName:shortNames[id] || original.name, group, groupLabel:groupLabels[group], index:index+1,
    faction:original.faction, description:original.description, context:group === 'context' ? original.context : '',
    detail:detailLabels[id] || '', category:original.category,
    visual:latest ? '그림 기반 최신 외형' : '함대 v2 외형', latest:!!latest,
    previewPath, viewerPath, assetPath, sourceModelSha256:sha(model), sourcePreviewSha256:sha(preview),
    weakpoints:latest?.weakpoints?.map(p => p.label).filter((p,i,a) => a.indexOf(p) === i) || [],
    sources:original.sourceRefs, metrics:{triangles:latest?.metrics?.triangles || original.metrics?.triangles},
  };
}));
const enemyIds = roster.ships.filter(s => s.side === 'enemy').map(s => s.id).sort();
if (JSON.stringify(ships.filter(s => s.group !== 'context').map(s => s.id).sort()) !== JSON.stringify(enemyIds)) throw Error('Enemy roster incomplete');
const data = {version:'enemy-fleet-gallery-1', title:'Cloudstitch · 적 함선 한눈에', ships,
  counts:{enemy:19,context:7,total:26,standard:7,mission:7,boss:5},
  note:'적 교전 역할 19항목과 협상 가능한 라이벌·시험 상대 7항목. 역할·시설을 포함하며 고유 정사 함선 26종이라는 뜻은 아닙니다.'};
fs.mkdirSync(out,{recursive:true});
const template = fs.readFileSync(path.join(__dirname,'template.html'),'utf8');
fs.writeFileSync(path.join(out,'index.html'), template.replace('/* GALLERY_DATA */', () => JSON.stringify(data).replace(/</g,'\\u003c')));
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(data,null,2)+'\n');
const sourceFiles = ['outputs/fleet-comparison-v1/inventory.json','outputs/enemy-fleet-reference-v1/catalog.json',...ships.flatMap(s => [s.previewPath,s.assetPath,s.viewerPath].map(p => path.relative(root,path.resolve(out,p)).replaceAll('\\','/')))];
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({version:data.version,counts:data.counts,
  sourceFiles:[...new Set(sourceFiles)].map(p => {const b=fs.readFileSync(path.join(root,p));return{path:p,bytes:b.length,sha256:sha(b)};}),
  changes:'New overview gallery only; existing images, models, viewers and manifests preserved.',
  newGenerationCalls:0, combatImplemented:false},null,2)+'\n');
console.log(JSON.stringify({output:'outputs/enemy-fleet-gallery-v1/index.html',counts:data.counts}));
