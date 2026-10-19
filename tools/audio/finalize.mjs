import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),manifestPath='outputs/audio-v1/handoff-files.json';
const excluded=new Set([manifestPath]);
async function walk(relative){const files=[];for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){const child=relative+'/'+entry.name;if(entry.isDirectory())files.push(...await walk(child));else if(!excluded.has(child))files.push(child);}return files;}
const files=[];for(const relative of (await Promise.all(['tools/audio','outputs/audio-v1'].map(walk))).flat().sort()){const data=await readFile(path.join(root,relative));files.push({path:relative,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
const verification=JSON.parse(await readFile(path.join(root,'outputs/audio-v1/verification.json'),'utf8'));if(!verification.passed)throw new Error('Light verification failed');
const controller=JSON.parse(await readFile(path.join(root,'outputs/audio-v1/controller-verification.json'),'utf8'));
if(process.argv[2])for(const item of controller.sourceBoundary){const bytes=await readFile(path.join(path.resolve(process.argv[2]),item.path));if(bytes.length!==item.bytes||createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new Error('Frozen source changed: '+item.path);}
const manifest={version:'audio-v1.0.0-ready',status:'READY_FOR_NEXT_INTEGRATION_REVISION',scope:'18 temporary procedural SFX, audition, read-only adapter and frozen-controller host; browser/audio QA pending',
  owners:['tools/audio/','outputs/audio-v1/','work/audio/ (ignored intermediates; not included)'],files,totalBytes:files.reduce((sum,item)=>sum+item.bytes,0),sourceBoundary:controller.sourceBoundary,
  sourceBoundaryPolicy:'No copied/edited integration source. Host imports /integration-source/tools/integration/session.mjs from an explicitly supplied read-only local root. Recheck hashes before reuse.',
  exclusions:[{path:manifestPath,reason:'Manifest cannot hash itself; all other owned source/output files are included.'}],verification:'outputs/audio-v1/verification.json',handoff:'tools/audio/HANDOFF.md',
  browserQa:'pending sequential integration QA',humanListening:'not performed; numerical checks are not a listening result',commonFilesChanged:false};
await writeFile(path.join(root,manifestPath),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({version:manifest.version,files:files.length,totalBytes:manifest.totalBytes,manifest:manifestPath,sha256:createHash('sha256').update(await readFile(path.join(root,manifestPath))).digest('hex')}));
