/* Dependency-free GLB/TRS structure check; optional installed Khronos validator.
 * node tools/combat-vfx-v2/check.cjs [--write] [--require-all] [--details]
 * This checks files and sampled transforms, not browser rendering or art quality.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'outputs/combat-vfx-v2');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const relative=file=>path.relative(ROOT,file).split(path.sep).join('/');
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function multiply(a,b){const out=Array(16).fill(0);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];return out;}
function normalize(q){const length=Math.hypot(...q);assert(length>1e-12,'Zero quaternion.');return q.map(value=>value/length);}
function compose(t,q,s){
  const [x,y,z,w]=q,x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
  return [(1-(yy+zz))*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,(xy-wz)*s[1],(1-(xx+zz))*s[1],(yz+wx)*s[1],0,(xz+wy)*s[2],(yz-wx)*s[2],(1-(xx+yy))*s[2],0,t[0],t[1],t[2],1];
}
function slerp(a,b,t){
  let cosine=a.reduce((sum,value,index)=>sum+value*b[index],0),end=[...b];if(cosine<0){cosine=-cosine;end=end.map(value=>-value);}
  if(cosine>.9995)return normalize(a.map((value,index)=>value+(end[index]-value)*t));
  const angle=Math.acos(Math.max(-1,Math.min(1,cosine))),den=Math.sin(angle),aWeight=Math.sin((1-t)*angle)/den,bWeight=Math.sin(t*angle)/den;
  return a.map((value,index)=>value*aWeight+end[index]*bWeight);
}
function parse(bytes){
  assert(bytes.length>=20&&bytes.readUInt32LE(0)===0x46546c67&&bytes.readUInt32LE(4)===2&&bytes.readUInt32LE(8)===bytes.length,'Invalid or incomplete GLB 2.0 header.');
  let cursor=12,json,bin;while(cursor<bytes.length){assert(cursor+8<=bytes.length,'Incomplete chunk header.');const length=bytes.readUInt32LE(cursor),type=bytes.readUInt32LE(cursor+4);cursor+=8;assert(length%4===0&&cursor+length<=bytes.length,'Invalid chunk alignment/length.');if(type===0x4e4f534a)json=JSON.parse(bytes.subarray(cursor,cursor+length).toString());if(type===0x004e4942)bin=bytes.subarray(cursor,cursor+length);cursor+=length;}
  assert(json&&bin,'Embedded JSON and BIN are required.');assert(json.asset?.version==='2.0','Asset version must be2.0.');
  assert([...(json.buffers||[]),...(json.images||[])].every(resource=>!resource.uri),'All resources must be GLB-embedded without URI.');
  assert(json.buffers?.length===1&&json.buffers[0].byteLength<=bin.length,'Expected a single embedded buffer.');
  return {json,bin};
}
function inspect(bytes,item){
  const {json,bin}=parse(bytes),accessors=json.accessors||[],views=json.bufferViews||[],nodes=json.nodes||[];
  for(const view of views)assert((view.buffer??0)===0&&(view.byteOffset||0)>=0&&view.byteLength>=0&&(view.byteOffset||0)+view.byteLength<=bin.length,'Buffer view exceeds embedded BIN.');
  function values(index){
    const accessor=accessors[index];assert(accessor&&widths[accessor.type]&&sizes[accessor.componentType],'Invalid accessor reference/type.');assert(!accessor.sparse,'Sparse accessor requires a separate decoder.');
    const view=views[accessor.bufferView];assert(view,'Accessor buffer view missing.');const width=widths[accessor.type],size=sizes[accessor.componentType],stride=view.byteStride||width*size,offset=(view.byteOffset||0)+(accessor.byteOffset||0);
    assert(stride>=width*size&&accessor.count>=0&&Number.isInteger(accessor.count),'Invalid accessor count or stride.');
    assert(offset>=0&&offset+(accessor.count?((accessor.count-1)*stride+width*size):0)<=(view.byteOffset||0)+view.byteLength,'Accessor exceeds buffer view.');
    const out=[];for(let i=0;i<accessor.count;i++){const tuple=[];for(let c=0;c<width;c++){const p=offset+i*stride+c*size;let v=accessor.componentType===5126?bin.readFloatLE(p):accessor.componentType===5125?bin.readUInt32LE(p):accessor.componentType===5123?bin.readUInt16LE(p):accessor.componentType===5122?bin.readInt16LE(p):accessor.componentType===5121?bin.readUInt8(p):bin.readInt8(p);if(accessor.normalized&&accessor.componentType!==5126)v=accessor.componentType===5120?Math.max(-1,v/127):accessor.componentType===5122?Math.max(-1,v/32767):v/(accessor.componentType===5121?255:accessor.componentType===5123?65535:4294967295);assert(Number.isFinite(v),'Non-finite accessor value.');tuple.push(v);}out.push(tuple);}return out;
  }
  let triangles=0;for(const mesh of json.meshes||[])for(const primitive of mesh.primitives||[]){assert((primitive.mode??4)===4,'Expected triangle primitive.');const position=accessors[primitive.attributes?.POSITION];assert(position&&position.type==='VEC3','POSITION VEC3 required.');values(primitive.attributes.POSITION);if(primitive.indices!==undefined){const index=accessors[primitive.indices];assert(index?.type==='SCALAR'&&[5121,5123,5125].includes(index.componentType),'Invalid triangle index accessor.');const list=values(primitive.indices).flat();assert(list.length%3===0&&list.every(value=>value<position.count),'Triangle indices exceed POSITION or incomplete triangle.');triangles+=list.length/3;}else{assert(position.count%3===0,'Incomplete nonindexed triangle.');triangles+=position.count/3;}}
  assert(triangles>0,'No triangles.');
  const parents=Array(nodes.length).fill(-1);nodes.forEach((node,index)=>{if(node.mesh!==undefined)assert(json.meshes?.[node.mesh],'Invalid node mesh.');for(const child of node.children||[]){assert(Number.isInteger(child)&&nodes[child]&&child!==index,'Invalid node child.');assert(parents[child]===-1,'Node has more than one parent.');parents[child]=index;}if(node.matrix)assert(node.matrix.length===16&&node.matrix.every(Number.isFinite),'Invalid node matrix.');});
  const runtimeFadeNodes=nodes.filter(node=>node.extras?.runtime_fade).length,animations=[];
  assert(json.animations?.length,'Actual animation is required.');
  for(const animation of json.animations){
    const tracks=[],targets=new Set();let duration=0;
    for(const channel of animation.channels||[]){
      const target=channel.target,node=nodes[target?.node],sampler=animation.samplers?.[channel.sampler];assert(node&&sampler,'Invalid animation node or sampler.');assert(['translation','rotation','scale'].includes(target.path),'Only standard TRS channels are allowed.');assert(!node.matrix,'Animated node must use TRS instead of matrix.');const key=target.node+':'+target.path;assert(!targets.has(key),'Duplicate animation target path.');targets.add(key);
      const input=accessors[sampler.input],output=accessors[sampler.output],expected=target.path==='rotation'?'VEC4':'VEC3';assert(input?.type==='SCALAR'&&input.componentType===5126&&output?.type===expected&&output.componentType===5126,'Animation sampler accessor type mismatch.');
      const times=values(sampler.input).flat(),data=values(sampler.output),interpolation=sampler.interpolation||'LINEAR';assert(['LINEAR','STEP','CUBICSPLINE'].includes(interpolation),'Unknown animation interpolation.');assert(times.length>0&&times.every((time,index)=>time>=0&&(index===0||time>times[index-1])),'Animation input times must increase and be nonnegative.');assert(data.length===times.length*(interpolation==='CUBICSPLINE'?3:1),'Animation input/output count mismatch.');
      if(target.path==='rotation')for(let index=interpolation==='CUBICSPLINE'?1:0;index<data.length;index+=interpolation==='CUBICSPLINE'?3:1)assert(Math.abs(Math.hypot(...data[index])-1)<.005,'Animation quaternion is not normalized.');
      duration=Math.max(duration,...times);tracks.push({node:target.node,path:target.path,times,data,interpolation});
    }
    assert(tracks.length>0&&duration>0,'No actual finite-duration TRS tracks.');
    function sampleTrack(track,time){
      const {times,data,interpolation}=track,multiplier=interpolation==='CUBICSPLINE'?3:1,value=index=>data[index*multiplier+(multiplier===3?1:0)];
      if(time<=times[0])return value(0);if(time>=times[times.length-1])return value(times.length-1);
      let i=0;while(i+1<times.length&&times[i+1]<=time)i++;const delta=times[i+1]-times[i],f=(time-times[i])/delta,a=value(i),b=value(i+1);
      if(interpolation==='STEP')return a;
      if(interpolation==='CUBICSPLINE'){const f2=f*f,f3=f2*f,out=a.map((v,k)=>(2*f3-3*f2+1)*v+(f3-2*f2+f)*delta*data[i*3+2][k]+(-2*f3+3*f2)*b[k]+(f3-f2)*delta*data[(i+1)*3][k]);return track.path==='rotation'?normalize(out):out;}
      return track.path==='rotation'?slerp(a,b,f):a.map((v,k)=>v+(b[k]-v)*f);
    }
    function sample(time){
      const locals=nodes.map(node=>({translation:node.translation||[0,0,0],rotation:node.rotation||[0,0,0,1],scale:node.scale||[1,1,1]}));for(const track of tracks)locals[track.node][track.path]=sampleTrack(track,time);
      const world=[],visiting=new Set();function matrix(index){if(world[index])return world[index];assert(!visiting.has(index),'Cycle in node graph.');visiting.add(index);const local=nodes[index].matrix||compose(locals[index].translation,locals[index].rotation,locals[index].scale);world[index]=parents[index]<0?local:multiply(matrix(parents[index]),local);visiting.delete(index);assert(world[index].every(Number.isFinite),'Nonfinite sampled transform.');return world[index];}
      const transforms=nodes.flatMap((node,index)=>node.mesh!==undefined?matrix(index):[]),quantized=transforms.map(value=>Math.round(value*1e6)/1e6);
      return {time,transform_sha256:hash(JSON.stringify(quantized)),finite:true,mesh_world_matrices:transforms.length/16,values:transforms};
    }
    const samples=[0,.15,.35,.65,.9,1].map(fraction=>sample(duration*fraction)),unique=new Set(samples.map(value=>value.transform_sha256)).size;
    assert(unique>1,'Animation samples do not change any actual mesh transform.');
    const start=samples[0].values,end=samples.at(-1).values,boundaryDifference=Math.max(...start.map((value,index)=>Math.abs(value-end[index])));
    animations.push({name:animation.name||'',duration_seconds:duration,channel_count:tracks.length,channel_paths:[...new Set(tracks.map(track=>track.path))],standard_trs:true,unique_transform_samples:unique,first_last_transform_max_difference:boundaryDifference,loop_boundary_equal:boundaryDifference<1e-5,samples:samples.map(({values,...metadata})=>metadata)});
  }
  if(item?.duration!==undefined)assert(Math.abs(animations[0].duration_seconds-item.duration)<1e-4,'Actual clip duration differs from catalog.');
  return {triangles,mesh_count:(json.meshes||[]).length,node_count:nodes.length,material_count:(json.materials||[]).length,texture_count:(json.textures||[]).length,image_count:(json.images||[]).length,runtime_fade_node_count:runtimeFadeNodes,embedded_resources:true,animations};
}
async function main(){
  let validator;try{validator=require('gltf-validator');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
  const sources=[['effect','catalog.json','outputs/combat-vfx/catalog.json'],['sequence','sequence-catalog.json','outputs/combat-vfx/sequence-catalog.json']],files=[],pending=[];
  for(const [kind,name,original]of sources){const catalogFile=path.join(OUT,name),catalog=fs.existsSync(catalogFile)?read(catalogFile).items:[];for(const expected of read(path.join(ROOT,original)).items){const item=catalog.find(value=>value.id===expected.id),file=item?.model?path.resolve(OUT,item.model):path.join(OUT,kind==='effect'?'assets':'sequences',expected.id+'.glb');if(!fs.existsSync(file)){pending.push({id:expected.id,kind});continue;}const entry={id:expected.id,kind,file:relative(file)};try{const bytes=fs.readFileSync(file);Object.assign(entry,{bytes:bytes.length,sha256:hash(bytes)},inspect(bytes,item));if(item?.sha256)assert(entry.sha256===item.sha256,'Actual SHA-256 differs from catalog.');if(validator){const result=await validator.validateBytes(new Uint8Array(bytes),{uri:entry.file,format:'glb',maxIssues:0,writeTimestamp:false,externalResourceFunction:async()=>{throw new Error('External resource forbidden.');}});entry.khronos={version:validator.version(),errors:result.issues.numErrors,warnings:result.issues.numWarnings,infos:result.issues.numInfos,hints:result.issues.numHints,truncated:result.issues.truncated,messages:result.issues.messages};assert(!entry.khronos.errors&&!entry.khronos.truncated,'Khronos validator errors or truncated result.');}entry.passed=true;}catch(error){entry.passed=false;entry.error=error.message;}files.push(entry);}}
  const report={schema_version:1,game_title:'Cloudstitch',scope:{effects:48,sequences:6},checked_at_utc:new Date().toISOString(),method:'Binary glTF accessor and hierarchy evaluation; no WebGL/browser, no art approval.',khronos_validator:validator?'installed_and_used':'unavailable_optional',source_preservation:'Run record.cjs verify separately.',files,pending,counts:{checked:files.length,passed:files.filter(file=>file.passed).length,failed:files.filter(file=>!file.passed).length,pending:pending.length},passed:files.length>0&&files.every(file=>file.passed)&&(!process.argv.includes('--require-all')||pending.length===0)};
  if(process.argv.includes('--write')){fs.mkdirSync(path.join(OUT,'verification'),{recursive:true});writeReport(path.join(OUT,'verification/structure.json'),report);}
  console.log(JSON.stringify(process.argv.includes('--details')?report:{counts:report.counts,passed:report.passed,khronos_validator:report.khronos_validator,failures:files.filter(file=>!file.passed).map(({id,error})=>({id,error})),...(process.argv.includes('--write')?{report:'outputs/combat-vfx-v2/verification/structure.json'}:{})},null,2));
  if(!report.passed)process.exitCode=1;
}
function writeReport(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
