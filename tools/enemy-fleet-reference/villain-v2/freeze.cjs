'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),output='outputs/enemy-fleet-reference-v2';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(root,p));
const row=p=>{const bytes=read(p);return{path:p,bytes:bytes.length,sha256:sha(bytes)};};
function freeze(){
 const catalog=JSON.parse(read(output+'/catalog.json')),structure=JSON.parse(read(output+'/structural-verification.json'));
 if(!structure.passed||catalog.ships.some(s=>s.previewSourceSha256!==s.sha256))throw Error('Actual structure and fresh six model previews are required.');
 const baseManifestPath='outputs/enemy-fleet-reference-v1/source-manifest.json',baseManifest=JSON.parse(read(baseManifestPath));
 const manifests=[['outputs/fleet-v2/source-manifest.json','916c3e9790818490ee6d4457b7e41d8fe23cc49130996f64512a3c2a2657f68e'],['outputs/fleet-comparison-v1/source-manifest.json','78ef52ad845b97c563fabdc1426006296f8ed122e860bf33e34cc6ef9a125af3'],[baseManifestPath,'679421632594a7864b1790aecd85267580ad362bf96ee966879c479d5cf62d8f']].map(([p,expected])=>{const actual=row(p);if(actual.sha256!==expected)throw Error('Original frozen manifest changed: '+p);return{...actual,expectedSha256:expected,passed:true};});
 const usedBase=baseManifest.files.filter(r=>r.path.startsWith('tools/enemy-fleet-reference/')||/outputs\/enemy-fleet-reference-v1\/(catalog\.json|reference\.png|painted-atlas\.png|ships\/[^/]+\.glb|previews\/[^/]+(?<!-silhouette)(?<!-deployed)\.png)$/.test(r.path));
 const dependencies=usedBase.map(r=>{const actual=row(r.path);if(actual.sha256!==r.sha256||actual.bytes!==r.bytes)throw Error('Read-only reference dependency changed: '+r.path);return actual;});
 for(const p of ['tools/fleet/body.js','tools/fleet/rigging.js','outputs/fleet-v1/ships/player-homeward.glb'])dependencies.push(row(p));
 const files=[];for(const dir of ['tools/enemy-fleet-reference/villain-v2',output]){const walk=p=>{for(const item of fs.readdirSync(path.join(root,p),{withFileTypes:true})){const next=p+'/'+item.name;if(item.isDirectory())walk(next);else if(next!==output+'/source-manifest.json')files.push(row(next));}};walk(dir);}
 const report={version:'enemy-reference-villain-v2-ready-1',capturedAt:new Date().toISOString(),scope:'Six new villain art variants of existing IDs. No combat, campaign or balance installation.',baseFrozenManifests:manifests,originalPreservationScope:'The three original manifest bytes and the listed read-only dependencies were rehashed. No full historical174/95 corpus rehash is claimed in this revision.',readOnlyDependencies:dependencies,counts:{variants:6,newEnemyTypes:0,actualClips:structure.summary.totalActualClips,weakpoints:structure.summary.weakpointBones,deploymentBones:structure.summary.deploymentBones,triangles:structure.summary.totalTriangles},structure:{passed:true,report:output+'/structural-verification.json'},generation:{imagegen:0,meshy:0,reusedPaintedAtlas:'outputs/enemy-fleet-reference-v1/painted-atlas.png'},browser:{status:'Pending reserved narrow model-revision QA',harness:'tools/enemy-fleet-reference/villain-v2/browser-qa.cjs',args:['--quick']},pending:['Human art approval','Actual damage/collision/sockets/detachment/ambush AI and performance budgets','Precise decoded-pixel/long-run ghosting regression'],files};
 fs.writeFileSync(path.join(root,output,'source-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({manifest:output+'/source-manifest.json',files:files.length,dependencies:dependencies.length,sha256:sha(read(output+'/source-manifest.json'))}));
}
if(require.main===module)try{freeze();}catch(e){console.error(e.stack);process.exitCode=1;}module.exports={freeze};
