const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-base-v1/dense-r4');
const rec=p=>{const b=fs.readFileSync(path.join(root,p));return{path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}};
const files=fs.readdirSync(__dirname).filter(n=>fs.statSync(path.join(__dirname,n)).isFile()).map(n=>rec('tools/enemy-base/dense-r4/'+n));
const m={revision:'dense-r4',date:'2026-10-19',status:'SOURCE_READY',ownership:['tools/enemy-base/dense-r4/','outputs/enemy-base-v1/dense-r4/'],files,
readOnlyDependencies:[rec('tools/enemy-base/fortress.mjs'),rec('tools/enemy-base/reference-r3/model.mjs'),rec('outputs/enemy-base-v1/reference-r3/delivery-manifest.json'),rec('outputs/enemy-base-v1/dense-r4/painted-atlas.png'),rec('outputs/enemy-base-v1/reference-r3/model-iso.png')],reference:rec('outputs/enemy-base-v1/dense-r4/reference.png'),
commands:['generate','paint','inspect','verify-surface','build','qa','finalize'].map(n=>'node tools/enemy-base/dense-r4/'+n+'.cjs'),
scope:'One actual static 3D fortress, embedded offline review, three material modes, controls, notes, download, mobile and ghosting regression; user art approval separate.',
changes:['Replaces repeated drum keep with unequal stacked multi-storey buildings and roof workshops','Narrow secondary turrets, taller offset belfry, deep projecting galleries','Open bridges and monumental flying buttresses','Irregular armor skirts, overlapping repair panels, weld scars, rust streaks','Dense windows and hand-sized lanterns as scale cues','Industrial pipe bundles, clock faces, exterior stairs, frayed flags','Same-camera r3 versus r4 PNG comparison; human art approval pending'],
limits:['Hidden geometry interpreted from a single image','Relative design scale only','No gameplay/collision/LOD/AI/interiors','No exact-pixel reproduction claim'],exporterStarted:false,browserStarted:false};
fs.writeFileSync(path.join(out,'SOURCE_READY.json'),JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({...rec('outputs/enemy-base-v1/dense-r4/SOURCE_READY.json'),files:files.length}));
