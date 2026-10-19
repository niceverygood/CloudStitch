// One-time audit repair for a render importing DSP before its final metadata edit.
// No samples change. A fresh render with final DSP already declares these values.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../../',import.meta.url),out=new URL('outputs/audio-grand-v4/',root),work=new URL('work/audio/grand-v4/',root),sha=b=>createHash('sha256').update(b).digest('hex');
if(sha(await fs.readFile(new URL('./dsp.mjs',import.meta.url)))!=='1395478fb9e34c8ed39bd1be886d5c38177c0bb9f30b435898fa83ddae9a02e2')throw new Error('Unexpected DSP revision');
const before=await fs.readFile(new URL('catalog.json',out)),catalog=JSON.parse(before),changes=[];
await fs.mkdir(work,{recursive:true});
await fs.writeFile(new URL('catalog-before-loop-metadata.json',work),before,{flag:'wx'});
await fs.copyFile(new URL('file-verification.json',out),new URL('file-verification-first-metadata-failure.json',work),fs.constants.COPYFILE_EXCL);
await fs.copyFile(new URL('file-verification.json',out),new URL('file-verification-before-metadata-fix.json',out),fs.constants.COPYFILE_EXCL);
for(const a of catalog.assets){const b=await fs.readFile(new URL(a.file,out));if(sha(b)!==a.sha256)throw new Error('WAV changed');if(a.loop)for(const s of a.recipe.stems){const value=a.duration*s.rate;if(s.fragmentSeconds!==value){changes.push({id:a.id,donor:s.id,previousSeconds:s.fragmentSeconds,actualConsumedSeconds:value});s.fragmentSeconds=value;}}}
if(changes.length!==30)throw new Error('Expected only 30 loop stem metadata corrections');
const after=Buffer.from(JSON.stringify(catalog,null,2)+'\n');await fs.writeFile(new URL('catalog.json',out),after);
await fs.writeFile(new URL('metadata-correction.json',out),JSON.stringify({purpose:'Final DSP loop fragment metadata now declares actual continuous source seconds, rather than the nominal plan value. Audio samples unchanged.',beforeCatalogSha256:sha(before),afterCatalogSha256:sha(after),changedFields:changes.length,unchangedWavFiles:49,firstReport:{passed:788,total:799,failures:11,retained:'outputs/audio-grand-v4/file-verification-before-metadata-fix.json'},changes,humanApproval:false},null,2)+'\n');
console.log(JSON.stringify({changedFields:changes.length,unchangedWavFiles:49,afterCatalogSha256:sha(after)}));
