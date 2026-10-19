// Narrow glTF conformance repair: only COLOR_0 floats; positions/normals untouched.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-base-v1/reference-r3');
const {parseGLB,makeGLB}=require('../../qa/world-gltf.cjs');const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const file=path.join(out,'enemy-base.glb'),input=fs.readFileSync(file),{json,bin}=parseGLB(input);
const work=path.join(root,'work/verification/enemy-base-v1/reference-r3');fs.mkdirSync(work,{recursive:true});
const failed=path.join(work,'paint-attempt-1-invalid-colors.glb');if(!fs.existsSync(failed))fs.writeFileSync(failed,input);
let changed=0;const seen=new Set();
for(const mesh of json.meshes)for(const p of mesh.primitives){const ai=p.attributes.COLOR_0;if(ai===undefined||seen.has(ai))continue;seen.add(ai);const a=json.accessors[ai],view=json.bufferViews[a.bufferView];if(a.componentType!==5126)continue;
const components=a.type==='VEC4'?4:3,stride=view.byteStride||components*4;
for(let i=0;i<a.count;i++)for(let j=0;j<components;j++){const offset=(view.byteOffset||0)+(a.byteOffset||0)+i*stride+j*4,x=bin.readFloatLE(offset);if(x<0||x>1){bin.writeFloatLE(Math.max(0,Math.min(1,x)),offset);changed++;}}
if(a.max)a.max=a.max.map(x=>Math.min(1,x));if(a.min)a.min=a.min.map(x=>Math.max(0,x));}
const output=makeGLB(json,bin);fs.writeFileSync(file,output);
const m=JSON.parse(fs.readFileSync(path.join(out,'model-manifest.json')));m.model.bytes=output.length;m.model.sha256=sha(output);m.conformanceRepair={only:'COLOR_0 float clamp [0,1]',changedComponents:changed,failedInputSha256:sha(input),repairedSha256:sha(output),failedFile:path.relative(root,failed).split(path.sep).join('/')};
fs.writeFileSync(path.join(out,'model-manifest.json'),JSON.stringify(m,null,2)+'\n');fs.writeFileSync(path.join(out,'color-repair.json'),JSON.stringify(m.conformanceRepair,null,2)+'\n');console.log(JSON.stringify(m.conformanceRepair));
