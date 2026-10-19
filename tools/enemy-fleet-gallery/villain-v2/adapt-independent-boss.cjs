'use strict';
// Reuse the boss owner's frozen same-camera stills. No new model/render/QA run.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),source=path.join(root,'outputs/chapter1-boss-review-v1'),out=path.join(root,'outputs/enemy-fleet-villain-v2/independent-boss-comparison-r1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),expectedReady='1619c6a148948600a6b7264ac6ead964ddb8140d94d8cd4580ed01b489bf1318';
function main(args=process.argv.slice(2)){
 if(args.length!==1||!['--prepare','--execute'].includes(args[0]))throw Error('Use exactly --prepare(JSON only) or --execute(verified PNG packaging)');
 const readyBytes=fs.readFileSync(path.join(source,'READY-r2.json'));if(sha(readyBytes)!==expectedReady)throw Error('Owner boss READY changed');const ready=JSON.parse(readyBytes);
 function bound(name){const relative='outputs/chapter1-boss-review-v1/'+name,r=ready.files.find(f=>f.path===relative);if(!r)throw Error('Not in frozen owner READY: '+name);return {...r,file:path.join(source,name)};}
 function smallJson(name){const r=bound(name),b=fs.readFileSync(r.file);if(b.length!==r.bytes||sha(b)!==r.sha256)throw Error('Changed owner metadata: '+name);return JSON.parse(b);}
 const c=smallJson('catalog.json'),v=smallJson('verification.json'),old=JSON.parse(fs.readFileSync(path.join(root,'outputs/enemy-fleet-gallery-v1/catalog.json'))).ships.find(s=>s.id==='boss-bell-devourer');
 if(c.id!==old.id||c.artVariant!=='chapter1-boss-review-v1'||c.beforeSha256!==old.sourceModelSha256||v.model.sha256!==c.sha256||c.previewSourceSha256!==c.sha256||!v.passed||!v.checks.find(r=>r.name==='previous-3d-compares-at-same-camera'&&r.passed))throw Error('Boss comparison/current model binding mismatch');
 const pair={id:c.id,passed:true,sameCamera:true,sameAnimationSample:false,beforeSha256:c.beforeSha256,afterSha256:c.sha256,beforePngSha256:bound('comparison-before.png').sha256,afterPngSha256:bound('comparison-new.png').sha256,
  animation:{before:{clip:null,pose:'GLB default/rest; no previous mixer instantiated',sampleTimeSeconds:null},after:{clip:c.animations[0].name,sampleTimeSeconds:0,stopped:true}},
  transform:{before:{uniformScaleFormula:'32 / original old bounds X size',positionFormula:['-oldCenter.x * factor','newBounds.min.y - oldBounds.min.y * factor','-oldCenter.z * factor']},after:{scale:1,position:[0,0,0]},newBoundsMinY:-6.252723693847656,units:'relative art units; no metres or game size; full X widths are not normalized equal'},
  cameraEvidence:{sameCameraTargetZoom:true,source:'Owner QA previous-3d-compares-at-same-camera + explicit owner confirmation; reset before two visibility-toggle captures',resetState:v.checks.find(r=>r.name==='reset-restores-initial-camera-and-stops-rotation')?.detail},
  ownerEvidence:{readySha256:expectedReady,verificationSha256:bound('verification.json').sha256,harness:v.harness,harnessSha256:v.harnessSha256},
  comparisonNote:'이전 선체 길이를 32 미술 단위 기준으로 정렬한 기본 자세 / 새 보스 전시 0초. 같은 카메라의 외형 비교이며 동일 클립·실제 크기 비교는 아님.'};
 if(args[0]==='--prepare')return {prepared:true,jsonOnly:true,pairs:1,browser:false,modelBytesRead:0,pngBytesRead:0,outputCreated:false,sameCamera:true,sameAnimationSample:false};
 if(fs.existsSync(out))throw Error('Refusing to overwrite adapted comparison revision');
 const images=[['before','comparison-before.png'],['after','comparison-new.png']].map(([side,name])=>{const r=bound(name),b=fs.readFileSync(r.file);if(b.length!==r.bytes||sha(b)!==r.sha256||b.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('Changed actual boss comparison PNG');return{side,b};});
 fs.mkdirSync(path.join(out,c.id),{recursive:true});for(const im of images)fs.writeFileSync(path.join(out,c.id,im.side+'.png'),im.b,{flag:'wx'});
 fs.writeFileSync(path.join(out,c.id,'metadata.json'),JSON.stringify(pair,null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schemaVersion:1,passed:true,status:'OWNER_MATCHED_PNG_REPACKAGED',pairs:[pair],newRenders:0,newExports:0,ownerFilesModified:0,artApproval:'PENDING_HUMAN_REVIEW'},null,2)+'\n',{flag:'wx'});
 return {adapted:true,pairs:1,newRenders:0,newExports:0,report:path.relative(root,path.join(out,'report.json')).split(path.sep).join('/')};
}
module.exports={main};if(require.main===module)try{console.log(JSON.stringify(main()));}catch(e){console.error(e.stack);process.exitCode=1;}
