const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/stage-maps-v1');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const runtime=JSON.parse(fs.readFileSync(path.join(out,'runtime-verification.json'),'utf8'));
if(!runtime.passed||runtime.smoke.length!==6||runtime.twoSorties.voyages.length!==2||runtime.sourceManifestSha256!==sha(path.join(out,'source-manifest.json')))throw Error('Current build runtime verification is required before READY');
const tests=['maps-data.test.mjs','selection.test.mjs','session-bridge.test.mjs'].map(name=>path.join(__dirname,name));
const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...tests],{encoding:'utf8'});
if(result.status!==0){process.stdout.write(result.stdout);process.stderr.write(result.stderr);process.exit(1);}
const get=name=>Number(result.stdout.match(new RegExp(`# ${name} (\\d+)`))?.[1]);
fs.writeFileSync(path.join(out,'unit-verification.json'),JSON.stringify({version:'stage-maps-v1',passed:true,tests:get('tests'),pass:get('pass'),fail:get('fail'),scope:'authored spatial clearance, selection whitelist, strict route-bound journal and failure preservation'},null,2)+'\n');
fs.copyFileSync(path.join(__dirname,'HANDOFF.md'),path.join(out,'README.md'));
const record=file=>({path:path.relative(root,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:sha(file)});
const files=fs.readdirSync(out).filter(name=>name!=='delivery-manifest.json').sort().map(name=>record(path.join(out,name)));
const sources=fs.readdirSync(__dirname).sort().map(name=>record(path.join(__dirname,name)));
fs.writeFileSync(path.join(out,'delivery-manifest.json'),JSON.stringify({status:'READY',version:'stage-maps-v1',files,sources},null,2)+'\n');
console.log(`READY: ${files.length} outputs, ${sources.length} sources; ${get('pass')}/${get('tests')} unit checks`);
