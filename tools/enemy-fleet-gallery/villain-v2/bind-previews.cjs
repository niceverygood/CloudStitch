'use strict';
// Bind already captured same-camera PNGs; never starts a browser or exporter.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/enemy-fleet-villain-v2');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),args=process.argv.slice(2);
const input=args.find(a=>a.startsWith('--report='))?.slice(9);if(!input||args.includes('--prepare')===args.includes('--execute'))throw Error('Use --report=repo/report.json and exactly one of --prepare or --execute');
const reportPath=path.resolve(root,input),delta=path.relative(out,reportPath);if(delta.startsWith('..')||path.isAbsolute(delta))throw Error('Report must stay in owned v2 output');
const report=JSON.parse(fs.readFileSync(reportPath,'utf8')),file=path.join(out,'models.json'),catalog=JSON.parse(fs.readFileSync(file,'utf8'));
if(!report.passed||!report.pairs?.length)throw Error('Actual comparison report did not pass');
const records=[];
for(const e of report.pairs){
 const s=catalog.ships.find(s=>s.id===e.id);
 if(!s||s.status!=='asset-built'||!e.sameCamera||!e.passed||e.afterSha256!==s.sha256||e.beforeSha256!==s.sourceModelSha256||!/^[a-f0-9]{64}$/.test(e.afterPngSha256||''))throw Error('Stale model/PNG comparison: '+e.id);
 const png=path.join(path.dirname(reportPath),e.id,'after.png');
 if(args.includes('--execute')){
  const bytes=fs.readFileSync(png);if(sha(bytes)!==e.afterPngSha256||bytes.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('Stale or invalid actual preview: '+e.id);
  Object.assign(s,{previewPath:path.relative(out,png).split(path.sep).join('/'),previewSha256:e.afterPngSha256,previewSourceSha256:s.sha256,previewComparisonReport:path.relative(root,reportPath).split(path.sep).join('/'),previewSampleTimeSeconds:2});
 }
 records.push(e.id);
}
if(args.includes('--execute'))fs.writeFileSync(file,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({prepared:args.includes('--prepare'),bound:args.includes('--execute')?records:[],ids:records,browser:false,exporter:false}));
