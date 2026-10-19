const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/voyage-campaign-v1');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const runtime=JSON.parse(fs.readFileSync(path.join(out,'runtime-verification.json'),'utf8'));
if(!runtime.passed||runtime.voyages.length!==6||runtime.sourceManifestSha256!==sha(path.join(out,'source-manifest.json')))throw Error('Current build runtime verification is required before READY');
const files=['campaign.test.mjs','storage.test.mjs','socket-aim.test.mjs'].map(name=>path.join(__dirname,name));
const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{encoding:'utf8'});
if(result.status!==0){process.stdout.write(result.stdout);process.stderr.write(result.stderr);process.exit(1);}
const get=name=>Number(result.stdout.match(new RegExp(`# ${name} (\\d+)`))?.[1]);
fs.writeFileSync(path.join(out,'unit-verification.json'),JSON.stringify({version:'voyage-campaign-v1',revision:2,passed:true,tests:get('tests'),pass:get('pass'),fail:get('fail'),scope:'Synthetic core receipt fixtures test progression/journal rules and analytic offset-socket poses test actual-frame yaw correction. Actual six-stage combat and restart proof is runtime-verification.json.'},null,2)+'\n');
fs.copyFileSync(path.join(__dirname,'HANDOFF.md'),path.join(out,'README.md'));
const record=file=>({path:path.relative(root,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:sha(file)});
const outputs=fs.readdirSync(out).filter(name=>name!=='delivery-manifest.json').sort().map(name=>record(path.join(out,name)));
const sources=fs.readdirSync(__dirname).sort().map(name=>record(path.join(__dirname,name)));
fs.writeFileSync(path.join(out,'delivery-manifest.json'),JSON.stringify({status:'READY',version:'voyage-campaign-v1',revision:2,files:outputs,sources},null,2)+'\n');
console.log(`READY: ${outputs.length} outputs, ${sources.length} sources; ${get('pass')}/${get('tests')} unit checks`);
