/* Freeze this owned source revision without running an exporter or browser. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'outputs/enemy-base-v1');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const owned = fs.readdirSync(__dirname).filter(name => fs.statSync(path.join(__dirname, name)).isFile());
const paths = [...owned.map(name => 'tools/enemy-base/' + name), 'outputs/enemy-base-v1/production-spec.json'];
const reference = 'outputs/enemy-base-moodboard-v2/moodboard.png';
const manifest = {
  revision: 'enemy-base-v1-source-ready', status: 'SOURCE_READY_NOT_EXPORTED',
  ownership: ['tools/enemy-base/', 'outputs/enemy-base-v1/'],
  files: paths.map(p => { const bytes = fs.readFileSync(path.join(root,p)); return { path:p, bytes:bytes.length, sha256:sha(bytes) }; }),
  readOnlyDependencies: [{ path:reference, bytes:fs.statSync(path.join(root,reference)).size, sha256:sha(fs.readFileSync(path.join(root,reference))) }],
  dependencies: { three:'0.180.0', esbuild:'0.25.10', playwright:'1.62.1', 'gltf-validator':'2.0.0-dev.3.10', resolution:'Existing installed modules via node_modules or NODE_PATH; no new installation.' },
  sourceCensus: { triangles:149998, mergedMeshes:78, authoredComponents:5296, semanticGroups:8, scope:'Before export. Actual GLB and actual render must be measured separately.' },
  stages: [
    { name:'export', command:'node tools/enemy-base/generate.cjs', expectedOutput:['outputs/enemy-base-v1/enemy-base.glb','outputs/enemy-base-v1/model-manifest.json'], resource:'One Node GLTFExporter, no browser, only new asset.' },
    { name:'structure', command:'node tools/enemy-base/inspect.cjs', expectedOutput:['outputs/enemy-base-v1/structure-verification.json'], resource:'One GLB read and official validator / GLTFLoader.' },
    { name:'review-build', command:'node tools/enemy-base/build.cjs', expectedOutput:['outputs/enemy-base-v1/index.html'], resource:'esbuild plus one GLB/PNG read; no browser.' },
    { name:'browser-qa', command:'node tools/enemy-base/qa.cjs', expectedOutput:['work/verification/enemy-base-v1/qa-result.json','work/verification/enemy-base-v1/*.png'], resource:'One Chromium. Actual file:// GLB, three display modes and 120 rotation frames each, controls, notes, exact download hash, 390px emulation, seven PNGs.' },
    { name:'finalize', command:'node tools/enemy-base/finalize.cjs', expectedOutput:['outputs/enemy-base-v1/verification.json','outputs/enemy-base-v1/delivery-manifest.json','outputs/enemy-base-v1/HANDOFF.txt'], resource:'Copies only this asset QA evidence after PASS; no browser.' }
  ],
  checksCompleted: ['Source syntax checks', 'Generator bundle-only, no export', 'Lightweight pre-export geometry census', 'Reference SHA preserved'],
  pending: ['Actual GLB export', 'Official format validation', 'Actual representative renders and human visual assessment', 'Real browser control/offline/mobile/ghost regression', 'Actual output LFS check'],
  limitations: ['Static art prototype', 'No AI/combat/collision/interiors/navmesh/LOD/engine sockets/campaign integration', 'No approved engine scale or performance budget', 'No user art approval implied'],
  browserStarted:false, exporterStarted:false, commonFilesChanged:false, paidGeneration:false
};
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'SOURCE_READY.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:manifest.status,files:manifest.files.length,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0),manifest:'outputs/enemy-base-v1/SOURCE_READY.json',sha256:sha(fs.readFileSync(path.join(out,'SOURCE_READY.json')))}));
