const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-base-v1/grand-r2');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const rec=p=>{const b=fs.readFileSync(path.join(root,p));return{path:p,bytes:b.length,sha256:sha(b)}};
const sources=fs.readdirSync(__dirname).filter(n=>fs.statSync(path.join(__dirname,n)).isFile()).map(n=>rec('tools/enemy-base/grand-r2/'+n));
const baseline=JSON.parse(fs.readFileSync(path.join(root,'outputs/enemy-base-v1/delivery-manifest.json')));
const data={revision:'enemy-base-grand-r2-source',status:'SOURCE_READY_NOT_EXPORTED',
  ownership:['tools/enemy-base/grand-r2/','outputs/enemy-base-v1/grand-r2/'],files:sources,
  readOnlyDependencies:[rec('tools/enemy-base/fortress.mjs'),rec('outputs/enemy-base-moodboard-v2/moodboard.png')],
  baselinePreservation:baseline.files.filter(f=>/enemy-base\.glb$|index\.html$|browser-verification\.json$|model-iso\.png$/.test(f.path)),
  sourceCensus:{triangles:207914,meshes:101,groups:8,finiteCoordinates:true,scope:'Before export; actual GLB/render separately measured'},
  artChanges:['Large iron shoulder citadels','Load-bearing flying buttresses and broad keep armor','Monumental gate collar','Deep rear furnace and chimney housing','Large torn stitched solid standards','Tighter presentation and taller desktop stage'],
  stages:['generate','inspect','build','qa','finalize'].map(n=>({command:`node tools/enemy-base/grand-r2/${n}.cjs`})),
  work:'work/verification/enemy-base-v1/grand-r2/',
  latestArtGate:'Bolder monumental silhouette and functional layers; numeric multiplication is not art approval. Same-angle r1/r2 renders and user art approval remain to be evaluated.',
  state:{exporter:0,browser:0,originalV1:'frozen',gameplay:false,paidGeneration:false}};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'SOURCE_READY.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({files:sources.length,bytes:sources.reduce((n,f)=>n+f.bytes,0),manifest:'outputs/enemy-base-v1/grand-r2/SOURCE_READY.json',sha256:sha(fs.readFileSync(path.join(out,'SOURCE_READY.json')))}));
