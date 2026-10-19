import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),output='outputs/playable-camera-v1/delivery-manifest.json',files=[];
for(const directory of ['tools/levels','outputs/playable-camera-v1'])for(const name of fs.readdirSync(path.join(root,directory)).sort()){
  if(directory==='tools/levels'&&!name.startsWith('camera-'))continue;
  const relative=`${directory}/${name}`,absolute=path.join(root,relative);if(relative===output||!fs.statSync(absolute).isFile())continue;
  const bytes=fs.readFileSync(absolute);files.push({path:relative,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync(path.join(root,output),JSON.stringify({version:'camera-comparison-ready-1',scope:'Three camera viewpoints with shared existing simulation; original READY3 preserved',files},null,2)+'\n');
console.log(JSON.stringify({path:output,files:files.length,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,output))).digest('hex')}));
