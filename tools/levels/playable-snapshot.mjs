import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),output='outputs/playable-battlefield-v1/handoff-files.json',files=[];
for(const directory of ['tools/levels','outputs/playable-battlefield-v1'])for(const name of fs.readdirSync(path.join(root,directory)).sort()){
  if(directory==='tools/levels'&&!name.startsWith('playable-'))continue;
  const relative=`${directory}/${name}`,absolute=path.join(root,relative);if(relative===output||!fs.statSync(absolute).isFile())continue;
  const bytes=fs.readFileSync(absolute);files.push({path:relative,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync(path.join(root,output),JSON.stringify({schemaVersion:1,status:'ready-for-integration-browser-QA',snapshot:'2026-10-18-playable-battlefield-v1-ready-3',scope:['tools/levels/playable-*','outputs/playable-battlefield-v1/'],browserQA:'ready-2-normal-18-pass-targeted-23-of-24; ready-3-label-clamp-recheck-pending',selfExcluded:output,files},null,2)+'\n');
console.log(JSON.stringify({output,files:files.length,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,output))).digest('hex')}));
