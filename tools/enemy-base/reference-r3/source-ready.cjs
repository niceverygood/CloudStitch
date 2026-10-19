const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-base-v1/reference-r3');
const rec=p=>{const b=fs.readFileSync(path.join(root,p));return{path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}};
const files=fs.readdirSync(__dirname).filter(n=>fs.statSync(path.join(__dirname,n)).isFile()).map(n=>rec('tools/enemy-base/reference-r3/'+n));
const m={revision:'reference-r3',date:'2026-10-19',status:'SOURCE_READY',ownership:['tools/enemy-base/reference-r3/','outputs/enemy-base-v1/reference-r3/'],files,
readOnlyDependencies:[rec('tools/enemy-base/fortress.mjs'),rec('outputs/enemy-base-v1/grand-r2/enemy-base.glb'),rec('outputs/enemy-base-v1/grand-r2/index.html'),rec('outputs/enemy-base-v1/reference-r3/painted-atlas.png')],reference:rec('outputs/enemy-base-v1/reference-r3/reference.png'),
commands:['generate','paint','inspect','build','qa','finalize'].map(n=>'node tools/enemy-base/reference-r3/'+n+'.cjs'),
scope:'One actual static 3D fortress, embedded offline review, three material modes, controls, notes, download, mobile and ghosting regression; user art approval separate.',
changes:['Broad armor hull and quilted buoyancy proportions','Twelve substantial tower masses and layered tile roofs','Projecting timber galleries, furnace windows, stairs and pipes','Curved plates with rivets and overlap seams','Tall bell cage and original cannon/gate/crane parts','Red military standards and ivory sealing cloth','Reference-matched front-quarter camera'],
limits:['Hidden geometry interpreted from a single image','Relative design scale only','No gameplay/collision/LOD/AI/interiors','No exact-pixel reproduction claim'],exporterStarted:false,browserStarted:false};
fs.writeFileSync(path.join(out,'SOURCE_READY.json'),JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({...rec('outputs/enemy-base-v1/reference-r3/SOURCE_READY.json'),files:files.length}));
