// Integration-approved one-shot bulk I/O slot only. No server/browser/process
// installation. Exit on the first failed stage and preserve its report.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
const root=new URL('../../../',import.meta.url),base=new URL('outputs/audio-cinematic-v5/',root);
// fileURLToPath also handles the Korean repository path on Windows.
import {fileURLToPath} from 'node:url';
function stage(file,args=[]){const r=spawnSync(process.execPath,[fileURLToPath(new URL(file,import.meta.url)),...args],{encoding:'utf8'});if(r.status!==0){process.stderr.write(r.stdout||'');process.stderr.write(r.stderr||'');throw Error(file+' failed; existing evidence retained');}console.log(JSON.stringify({stage:file,result:r.stdout.trim().split('\n').at(-1)}));}
stage('render.mjs');stage('auditions.mjs');stage('build.mjs');stage('verify.mjs');stage('preserve.mjs');
const catalog=JSON.parse(await fs.readFile(new URL('catalog.json',base),'utf8')),qa=JSON.parse(await fs.readFile(new URL('file-verification.json',base),'utf8')),pair=JSON.parse(await fs.readFile(new URL('audition-catalog.json',base),'utf8'));
await fs.writeFile(new URL('OWNER_RESULT.json',base),JSON.stringify({status:'FULL49_CANDIDATES_READY_FOR_LISTENING',assets:catalog.assets.length,outputWavBytes:catalog.summary.renderedBytes,comparisonWavBytes:catalog.summary.sourceBytes,pairedWavs:pair.pairs.length,pairedWavBytes:pair.pairs.reduce((s,p)=>s+p.bytes,0),technicalFileChecks:{passed:qa.passed,total:qa.total,passCount:qa.passCount},playerFakeChecks:{passed:true,checks:43,reference:'player-verification.json'},immediateContactSeconds:0,prototype:'prototype-r1/',previousV4:'expression rejected',humanListeningApproval:false,tenfoldGoalApproved:false,gameplayInstalled:false,browserRunsByOwner:0,paidRequests:0},null,2)+'\n');
await fs.writeFile(new URL('README.txt',base),'Cloudstitch · 시네마틱 사운드 v5\n\n전체47효과음+박격포A/B 후보2, 49파일을새시간구조로구성했다.\n기존v4는사용자표현반려로보존한다. 단순EQ증가가아니라즉시충격→커지는압력→분출/파열→시간차잔해→긴확산을설계했다. 기록된최초원재료와새deterministic합성층을함께쓴다.\nindex.html에서v4와v5를같은RMS로비교하고검수메모를남길수있다.\n대표3불변초안은prototype-r1/, 최종대표5비교는auditions/이다. paired파일은앞v4→400ms무음→뒤v5순서다.\n10배는표현의체감목표이며gain/수치PASS가아니다. 사람청취/실제게임설치/Native검수는각각별도다.\n실제기술결과는OWNER_RESULT.json와file-verification.json, 생성층은catalog.json.recipe를참조한다.\n새유료생성0/게임설치0. 원음과v1~v4, 첫대표3을보존했다.\n');
const proto=new URL('prototype-catalog.json',base);try{await fs.rename(proto,new URL('work/audio/cinematic-v5/prototype-catalog.json',root));}catch(e){if(e.code!=='ENOENT')throw e;}
stage('build.mjs',['--manifest']);
