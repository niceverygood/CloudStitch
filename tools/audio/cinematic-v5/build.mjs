import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=path.join(root,'outputs/audio-cinematic-v5'),hash=b=>createHash('sha256').update(b).digest('hex'),proto=process.argv.includes('--prototype');
if(proto)await fs.copyFile(path.join(out,'prototype-catalog.json'),path.join(out,'catalog.json'));
let html=await fs.readFile(new URL('./index-template.html',import.meta.url),'utf8');
if(proto)html=html.replace('전체 효과음 + 박격포 A·B 후보','새 방향 대표 3종 · 전체49 제작 전');
await fs.writeFile(path.join(out,'index.html'),html);
if(process.argv.includes('--manifest')){const files=[];async function walk(p){for(const f of await fs.readdir(path.join(root,p),{withFileTypes:true})){const q=p+'/'+f.name;if(f.isDirectory())await walk(q);else if(q!=='outputs/audio-cinematic-v5/delivery-manifest.json'&&f.name!=='prototype-catalog.json'&&f.name!=='.gitattributes'){const b=await fs.readFile(path.join(root,q));files.push({path:q,bytes:b.length,sha256:hash(b)});}}}await walk('tools/audio/cinematic-v5');await walk('outputs/audio-cinematic-v5');files.sort((a,b)=>a.path.localeCompare(b.path));const m={version:proto?'cinematic-v5-prototype3':'cinematic-v5-full49',status:'EXPRESSION_REDESIGNED_LISTENING_CANDIDATE',files,totalBytes:files.reduce((s,f)=>s+f.bytes,0),entry:'outputs/audio-cinematic-v5/index.html',previousV4Rejected:true,previousManifest:{file:'outputs/audio-grand-v4/delivery-manifest.json',sha256:'c7bec6defed1cd135de57330ced6b0f3fb1685093dc2ec28a5100eeac832ab71'},humanApproval:false,gameplayInstalled:false,paidGenerationRequests:0};const b=Buffer.from(JSON.stringify(m,null,2)+'\n');await fs.writeFile(path.join(out,'delivery-manifest.json'),b);console.log(JSON.stringify({files:files.length,bytes:m.totalBytes,manifestBytes:b.length,sha256:hash(b)}));}
