const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../../..'),OUT='outputs/ship-states-v1/dramatic-v2',EVO='outputs/ship-states-v1/evolution30';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const file=p=>{const b=fs.readFileSync(path.join(ROOT,p));return{path:p,bytes:b.length,sha256:sha(b)};};
const qa=read(OUT+'/verification.json');
if(!qa.passed||qa.actualStates.length!==52||!qa.evolution30Viewer)throw Error('Actual new viewer QA must pass before finalization');
const followup=read(OUT+'/verification-explosion.json');
if(!followup.passed||followup.samples.length!==18||!followup.finallyClosed)throw Error('Explosion correction QA must pass');
const prior=read(OUT+'/qa-initial/manifest.json'),latest=read(OUT+'/manifest.json');
for(const f of prior.sources)if(f.path!=='tools/ship-states/dramatic-v2/variants.js'&&latest.sources.find(n=>n.path===f.path)?.sha256!==f.sha256)throw Error('Unexpected changed input outside the explosion factory: '+f.path);
for(const relative of [OUT,EVO]){
 const m=read(relative+'/manifest.json'),source=read(relative+'/source-verification.json');if(!source.passed)throw Error('Actual source check failed');
 for(const f of m.sources.concat(m.readOnly))if(file(f.path).sha256!==f.sha256)throw Error('Source or readonly dependency changed: '+f.path);
 if(file(m.output.path).sha256!==m.output.sha256)throw Error('Viewer differs from build');
 const expected=relative===OUT?followup.viewerSha256:qa.evolutionHTMLSha256;if(expected!==m.output.sha256)throw Error('The tested HTML differs');
 m.browserVerified=true;m.browserReport={path:OUT+'/verification.json',sha256:file(OUT+'/verification.json').sha256,scope:relative===OUT?'52 displayed states and controls/exports/modes/responsive/opaque ghosting':'30 thumbnails, actual level30 and previous-level comparison in the same browser/page'};m.humanArtApproved=false;m.actualGameIntegration=false;m.exactExplosionRasterRetested=false;
 if(relative===OUT){m.browserReport.initialViewerSha256=qa.viewerSha256;m.browserReport.followup={path:OUT+'/verification-explosion.json',sha256:file(OUT+'/verification-explosion.json').sha256,viewerSha256:followup.viewerSha256,scope:'18 explosion time/mode samples after two factory corrections; 52-state controls and opaque checks inherited from unchanged input paths in the initial run'};}
 fs.writeFileSync(path.join(ROOT,relative,'manifest.json'),JSON.stringify(m,null,2)+'\n');
}
const dirs=['tools/ship-states/evolution30','tools/ship-states/dramatic-v2',EVO,OUT],files=[];
function collect(d){for(const n of fs.readdirSync(path.join(ROOT,d))){const p=d+'/'+n;if(n==='delivery-manifest.json')continue;if(fs.statSync(path.join(ROOT,p)).isDirectory())collect(p);else files.push(file(p));}}
for(const d of dirs)collect(d);
const readonly=read(OUT+'/manifest.json').readOnly;
const delivery={title:'Cloudstitch',revision:'hero-dramatic-v2-evolution30-ART-REVIEW',logicalStates:52,logicalGrowthLevels:30,ownedPaths:dirs.map(d=>d+'/'),entryPoint:OUT+'/index.html',evolutionEntry:EVO+'/index.html',sourcePassed:true,browserPassed:true,humanArtApproved:false,actualGameIntegration:false,originalAndV1Preserved:true,exactExplosionRasterRetested:false,files,readOnly:readonly,harness:file('tools/ship-states/dramatic-v2/verify.cjs'),qa:file(OUT+'/verification.json'),limits:['Authored visual state and motion prototypes; no actual HP/energy/level/save/combat rule changes.','Exported GLBs are selected static poses. Outline/cel shading and animation are viewer runtime features.','The prior v1 exact explosion raster failure remains preserved; new checks cover opaque-mode rotation ghosting, not a claim of exact explosion pixel identity.','Dramatic art direction is presented as actual side-by-side review, not numeric tenfold scaling or human art approval.']};
delivery.followup=file(OUT+'/verification-explosion.json');delivery.qaScope='Initial52 functional PASS with explosion art FAIL preserved in qa-initial; final HTML checked by narrow 18-sample explosion regression. Unchanged controls/growth/opaque-mode checks inherit the initial evidence.';
fs.writeFileSync(path.join(ROOT,OUT,'delivery-manifest.json'),JSON.stringify(delivery,null,2)+'\n');console.log(JSON.stringify({ready:true,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),deliverySha256:file(OUT+'/delivery-manifest.json').sha256}));
