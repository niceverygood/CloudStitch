'use strict';
// Repackage the owner's already captured pairs. Never rerender/export reference6.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),source=path.join(root,'outputs/enemy-fleet-reference-v3'),out=path.join(root,'outputs/enemy-fleet-villain-v2/reference6-comparisons-r1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const inputs={
 'source-manifest.json':'2d483be0d2f5f864c6756b404b8b288101f8b35d2d9534d9f1766cfac335dfed',
 'catalog.json':'ea8059d3e4d1c1207d2220cbed2aa6ffadc9100d84bd5caa7d3aa33d09bc3594',
 'preview-bindings.json':'4c7681babc58b6d23424e4d329a363913fc0fc6a6d99161a3a22834a8b6cab2b'
};
const ids=['enemy-pirate-scout','enemy-cult-blockade','enemy-union-salvage','enemy-union-repair','enemy-ghost-chaser','enemy-disguised-wreck'];
function main(args=process.argv.slice(2)){
 if(args.length!==1||!['--prepare','--execute'].includes(args[0]))throw Error('Use exactly --prepare(JSON only) or --execute(copy verified PNG only, central slot)');
 const data={};for(const [file,expected]of Object.entries(inputs)){const b=fs.readFileSync(path.join(source,file));if(sha(b)!==expected)throw Error('Owner READY changed: '+file);data[file]=JSON.parse(b);}
 const catalog=data['catalog.json'],bindings=data['preview-bindings.json'];
 if(catalog.ships.length!==6||new Set(catalog.ships.map(s=>s.id)).size!==6)throw Error('Expected exact six reference rows');
 const pairs=ids.map(id=>{
  const s=catalog.ships.find(s=>s.id===id),binding=bindings.ships.find(s=>s.id===id),capture=s?.comparisonCapture;
  if(!s||!binding||s.status!=='asset-built'||s.variantId!==id+'--villain-v3'||!capture?.sameCameraAndPose||capture.sourceSha256!==s.sha256||capture.baseSourceSha256!==s.baseModelSha256||binding.sourceSha256!==s.sha256||s.previewSourceSha256!==s.sha256||binding.previewSha256!==s.previewSha256)throw Error('Stale model or matched capture: '+id);
  const frame=capture.frame;
  if(frame.profile!=='FloatIdle'||frame.time!==2||frame.modelScale!==1||frame.modelOrigin.some(v=>v!==0)||!frame.position.every(Number.isFinite)||!frame.frustum.every(Number.isFinite))throw Error('Unexpected camera/pose contract: '+id);
  const pngs={};for(const [side,field]of [['before','beforePreviewPath'],['after','comparisonPreviewPath']]){
   const p=binding.previews[field];if(!p||p.path!=='outputs/enemy-fleet-reference-v3/'+s[field]||!/^[0-9a-f]{64}$/.test(p.sha256))throw Error('Missing bound comparison PNG: '+id+'/'+side);
   const file=path.resolve(root,p.path);if(!file.startsWith(source+path.sep))throw Error('PNG escapes reference output');pngs[side]={file,sha256:p.sha256};
  }
  return {id,passed:true,sameCamera:true,beforeSha256:s.baseModelSha256,afterSha256:s.sha256,beforePngSha256:pngs.before.sha256,afterPngSha256:pngs.after.sha256,camera:frame,animation:{before:{clip:'FloatIdle',sampleTimeSeconds:2},after:{clip:'FloatIdle',sampleTimeSeconds:2}},ownerEvidence:{catalogSha256:inputs['catalog.json'],bindingsSha256:inputs['preview-bindings.json'],comparisonCapture:capture},pngs};
 });
 if(args[0]==='--prepare')return {prepared:true,jsonOnly:true,pairs:pairs.length,browser:false,modelBytesRead:0,pngBytesRead:0,outputCreated:false};
 if(fs.existsSync(out))throw Error('Refusing to overwrite adapted comparison revision');
 // Verify all PNG bytes before creating output; this is packaging, no rendering.
 const copies=[];for(const p of pairs)for(const side of ['before','after']){const b=fs.readFileSync(p.pngs[side].file);if(sha(b)!==p.pngs[side].sha256||b.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('Changed actual PNG: '+p.id+'/'+side);copies.push({id:p.id,side,b});}
 fs.mkdirSync(out,{recursive:true});for(const p of pairs){fs.mkdirSync(path.join(out,p.id));const row={...p};delete row.pngs;fs.writeFileSync(path.join(out,p.id,'metadata.json'),JSON.stringify(row,null,2)+'\n',{flag:'wx'});}
 for(const c of copies)fs.writeFileSync(path.join(out,c.id,c.side+'.png'),c.b,{flag:'wx'});
 const report={schemaVersion:1,passed:true,status:'OWNER_MATCHED_PNG_REPACKAGED',pairs:pairs.map(p=>{const row={...p};delete row.pngs;return row;}),newRenders:0,newExports:0,ownerFilesModified:0,artApproval:'PENDING_HUMAN_REVIEW',note:'The reference owner captured these actual GLB pairs. This adapter verifies and copies the bound PNG bytes; it does not repeat rendering or infer human art approval.'};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 return {adapted:true,pairs:6,newRenders:0,newExports:0,report:path.relative(root,path.join(out,'report.json')).split(path.sep).join('/')};
}
module.exports={main};if(require.main===module)try{console.log(JSON.stringify(main()));}catch(e){console.error(e.stack);process.exitCode=1;}
