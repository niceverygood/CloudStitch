// Exact bitwise vertex welding. Changes storage only; no simplification or rounding.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {parseGLB,makeGLB}=require('../../qa/world-gltf.cjs'),out='outputs/enemy-base-v1/chapter2-r1';
fs.mkdirSync(out+'/geometry-baseline',{recursive:true});
for(const n of ['enemy-base.glb','model-manifest.json'])if(!fs.existsSync(out+'/geometry-baseline/'+n))fs.copyFileSync(out+'/'+n,out+'/geometry-baseline/'+n);
const bytes=fs.readFileSync(out+'/geometry-baseline/enemy-base.glb'),{json:j,bin}=parseGLB(bytes),chunks=[],views=[],accessors=[];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');let offset=0,beforeVertices=0,afterVertices=0,triangles=0,checkedComponents=0;
function addView(b,target){assert.equal(offset%4,0);const index=views.length;views.push({buffer:0,byteOffset:offset,byteLength:b.length,target});chunks.push(b);offset+=b.length;return index;}
for(const mesh of j.meshes)for(const p of mesh.primitives){
 assert.equal(p.indices,undefined,'Expected original nonindexed export');
 const attrs=Object.entries(p.attributes).map(([name,ai])=>{
  const a=j.accessors[ai],view=j.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert(!a.sparse);
  return{name,a,data:bin,size:12,start:(view.byteOffset||0)+(a.byteOffset||0),stride:view.byteStride||12};
 });
 const count=attrs[0].a.count,rows=[],map=new Map(),indices=new Uint32Array(count);beforeVertices+=count;triangles+=count/3;
 // Reproduce the FROZEN first paint's triangle UV mapping exactly before welding.
 // UV splits become part of the key, so indexing never changes UV interpretation.
 const materialName=j.materials[p.material].name,tile=/pearl/.test(materialName)?[0,1]:/bone|reef/.test(materialName)?[0,0]:/coral/.test(materialName)?[1,1]:[1,0];
 const positions=attrs.find(a=>a.name==='POSITION'),normals=attrs.find(a=>a.name==='NORMAL'),scale=/pearl|bone/.test(materialName)?6:3,uv=new Float32Array(count*2);
 const xyz=(a,i)=>[0,1,2].map(k=>a.data.readFloatLE(a.start+i*a.stride+k*4));
 for(let i=0;i<count;i+=3){const [nx,ny,nz]=xyz(normals,i).map(Math.abs),q=[];
  for(let k=i;k<i+3;k++){const [x,y,z]=xyz(positions,k);q.push(ny>nx&&ny>nz?[x/scale,z/scale]:nx>nz?[z/scale,y/scale]:[x/scale,y/scale]);}
  const cx=q.reduce((s,p)=>s+p[0],0)/3,cy=q.reduce((s,p)=>s+p[1],0)/3;
  for(let k=0;k<3;k++){uv[(i+k)*2]=(tile[0]+.02+Math.min(.99,Math.max(.01,q[k][0]-Math.floor(cx)))*.96)/2;uv[(i+k)*2+1]=(tile[1]+.02+Math.min(.99,Math.max(.01,q[k][1]-Math.floor(cy)))*.96)/2;}
 }
 if(!/cyan|window|deepwater|water$/.test(materialName))attrs.push({name:'TEXCOORD_0',a:{componentType:5126,type:'VEC2',count},data:Buffer.from(uv.buffer),start:0,stride:8,size:8});
 for(let i=0;i<count;i++){
  const words=[];for(const a of attrs)for(let k=0;k<a.size/4;k++)words.push(a.data.readUInt32LE(a.start+i*a.stride+k*4));
  const key=words.join('/');let id=map.get(key);if(id===undefined){id=rows.length;map.set(key,id);rows.push(i);}indices[i]=id;
 }
 afterVertices+=rows.length;
 for(const a of attrs){
  const b=Buffer.alloc(rows.length*a.size);for(let i=0;i<rows.length;i++)a.data.copy(b,i*a.size,a.start+rows[i]*a.stride,a.start+rows[i]*a.stride+a.size);
  // Expand every indexed attribute in triangle order and compare the exact source bytes.
  for(let i=0;i<count;i++){assert(a.data.subarray(a.start+i*a.stride,a.start+i*a.stride+a.size).equals(b.subarray(indices[i]*a.size,indices[i]*a.size+a.size)),'Geometry attribute changed');checkedComponents+=a.size/4;}
  const ai=accessors.length;accessors.push({...a.a,bufferView:addView(b,34962),byteOffset:0,count:rows.length});p.attributes[a.name]=ai;
 }
 const ib=Buffer.from(indices.buffer),ai=accessors.length;accessors.push({bufferView:addView(ib,34963),byteOffset:0,componentType:5125,count,type:'SCALAR',min:[0],max:[rows.length-1]});p.indices=ai;
}
j.bufferViews=views;j.accessors=accessors;j.buffers=[{byteLength:offset}];const result=makeGLB(j,Buffer.concat(chunks)),manifest=JSON.parse(fs.readFileSync(out+'/model-manifest.json'));
assert.equal(manifest.model.sha256,sha(bytes),'Current input must still be the first preserved export');
const report={method:'Exact bitwise duplicate-vertex indexing; no quantization, decimation or shape change. UVs exactly follow the frozen first-paint per-triangle formula; UV is part of each welding key. Material primitives remain separate.',beforeSha256:sha(bytes),afterSha256:sha(result),beforeBytes:bytes.length,afterBytes:result.length,beforeVertices,afterVertices,triangles,checkedComponents,expandedPositionNormalColourBytesIdentical:true,expectedFrozenTriangleUVBytesIdentical:true,materialBoundariesPreserved:true};
fs.writeFileSync(out+'/enemy-base.glb',result);fs.writeFileSync(out+'/index-preservation.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync(out+'/model-manifest.json',JSON.stringify({...manifest,model:{...manifest.model,bytes:result.length,sha256:sha(result),vertices:afterVertices},storage:report},null,2)+'\n');console.log(JSON.stringify(report));
