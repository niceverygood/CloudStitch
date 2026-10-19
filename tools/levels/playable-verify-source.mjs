import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const html=read('tools/levels/playable-template.html'),ui=read('tools/levels/playable-ui.js');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]),references=[...ui.matchAll(/\$\('([^']+)'\)/g)].map(match=>match[1]);
const failures=[];
if(new Set(ids).size!==ids.length)failures.push('duplicate-dom-id');
for(const id of new Set(references))if(!ids.includes(id))failures.push(`missing-control:${id}`);
for(const command of ['depart','return','salvage','resume','retry','maintenance','store','repair','save','restore'])if(!html.includes(`data-command="${command}"`))failures.push(`missing-command:${command}`);
const sourceFiles=fs.readdirSync(path.join(root,'tools/levels')).filter(file=>file.startsWith('playable-')&&/\.(mjs|js|cjs)$/.test(file));
const relativeImports=[];
for(const file of sourceFiles)for(const match of read(`tools/levels/${file}`).matchAll(/from\s+['"](\.[^'"]+)['"]/g)){
  const resolved=path.resolve(root,'tools/levels',match[1]);
  if(!fs.existsSync(resolved))failures.push(`missing-import:${file}:${match[1]}`);
  relativeImports.push({source:`tools/levels/${file}`,import:match[1]});
}
const dependencies=['tools/battlefield/sim.mjs','tools/battlefield/integration.mjs','tools/battlefield/assets.js','tools/battlefield/vfx.js','tools/battlefield/world.js','tools/encounters/director.mjs','tools/harbor/core.mjs','tools/shipyard/shipyard.mjs','tools/save/save.mjs','tools/levels/levels.mjs'].map(file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}));
const report={schemaVersion:1,passed:failures.length===0,failures,domIds:ids.length,requiredControlIds:new Set(references).size,relativeImports,dependencies,scope:'Portable relative imports and UI contract; no browser/layout/gameplay claim. Shared dependency SHA records preserve the build input baseline.'};
fs.mkdirSync(path.join(root,'outputs/playable-battlefield-v1'),{recursive:true});fs.writeFileSync(path.join(root,'outputs/playable-battlefield-v1/source-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,domIds:ids.length,requiredControlIds:report.requiredControlIds,relativeImports:relativeImports.length,failures}));if(!report.passed)process.exitCode=1;
