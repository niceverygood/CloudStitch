const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {parseGLB}=require('../../qa/world-gltf.cjs'),root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-base-v1/dense-r4');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function signatures(file){const b=fs.readFileSync(file),{json,bin}=parseGLB(b),result={};
function bytesFor(ai){const a=json.accessors[ai],v=json.bufferViews[a.bufferView],stride=v.byteStride||12,rows=[];for(let i=0;i<a.count;i++){const o=(v.byteOffset||0)+(a.byteOffset||0)+i*stride;rows.push(bin.subarray(o,o+12));}return sha(Buffer.concat(rows));}
for(const n of json.nodes){if(n.mesh===undefined)continue;result[n.name]={transform:{matrix:n.matrix,translation:n.translation,rotation:n.rotation,scale:n.scale},primitives:json.meshes[n.mesh].primitives.map(p=>({position:bytesFor(p.attributes.POSITION),normal:bytesFor(p.attributes.NORMAL)}))};}
return{sha256:sha(b),meshes:result,textures:json.textures?.length||0,images:json.images?.length||0};}
const before=signatures(path.join(out,'geometry-baseline/enemy-base.glb')),after=signatures(path.join(out,'enemy-base.glb'));
assert.deepEqual(after.meshes,before.meshes,'Surface pass must preserve positions, normals and node transforms');
const m={positionNormalTransformPreserved:true,meshCount:Object.keys(after.meshes).length,beforeSha256:before.sha256,afterSha256:after.sha256,textures:after.textures,images:after.images,scope:'Exact per-mesh POSITION/NORMAL bytes and node transform comparison. UV, colors and materials intentionally changed.'};
fs.writeFileSync(path.join(out,'surface-preservation.json'),JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify(m));
