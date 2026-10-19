/** Explicit user requested SFX review pack. Credential is stdin memory only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {REVIEW_SOUNDS} from './sound-plan.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=path.join(root,'outputs/audio-review-v2');
const arg=process.argv.slice(2),sourceIndex=arg.indexOf('--machinegun-root');
const machinegunRoot=sourceIndex>=0?path.resolve(arg[sourceIndex+1]||''):null;
const expectedMachinegun='bd3a66b2b94b175b1e45ba17bfd93a8654d2efd0d33d287d14407a548c224d22';
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const exists=async file=>{try{await fs.access(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const metadataFile=id=>path.join(out,'generation',id+'.json');
const baseAsset=def=>({...def,status:'pending',file:`audio/${def.id}.mp3`,humanReview:'pending',gameplayInstalled:false});
let catalog,key;
let writing=Promise.resolve();
async function persist(){
  // Serialize writes: two generation workers must never truncate each other.
  const data=JSON.stringify(catalog,null,2)+'\n';
  // Per-asset receipts are canonical. Direct, serialized catalog writes avoid
  // OneDrive's transient EPERM on rename-over-existing. Retry filesystem only.
  writing=writing.catch(()=>{}).then(async()=>{for(let n=0;;n++){try{await fs.writeFile(path.join(out,'catalog.json'),data);return;}catch(error){if(n>=8||!['EPERM','EBUSY','EACCES'].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,100*(n+1)));}}});
  await writing;
}
async function secretInput(){
  if(process.stdin.isTTY)process.stdin.setRawMode(true);
  console.log('Waiting for API credential on private stdin; input is not echoed.');
  try{return await new Promise((resolve,reject)=>{
    let value='';const cleanup=()=>{process.stdin.removeListener('data',onData);process.stdin.pause();};
    const onData=chunk=>{value+=chunk.toString('utf8');if(value.includes('\u0003')){value='';cleanup();reject(new Error('Cancelled'));return;}if(/[\r\n]/.test(value)){const result=value.trim();value='';cleanup();resolve(result);}};
    process.stdin.on('data',onData);process.stdin.resume();
  });}finally{if(process.stdin.isTTY)process.stdin.setRawMode(false);}
}
async function writeCatalogStart(){
  await fs.mkdir(path.join(out,'audio'),{recursive:true});await fs.mkdir(path.join(out,'generation'),{recursive:true});
  if(await exists(path.join(out,'catalog.json'))){
    catalog=JSON.parse(await fs.readFile(path.join(out,'catalog.json'),'utf8'));
    if(catalog.assets.length!==REVIEW_SOUNDS.length||catalog.assets.some((item,i)=>item.id!==REVIEW_SOUNDS[i].id))throw new Error('Existing pack differs from this plan; preserving it.');
  }else catalog={version:'audio-review-v2.0.0',title:'Cloudstitch 전체 SFX 검수실',createdAt:new Date().toISOString(),provider:'ElevenLabs',model:'eleven_text_to_sound_v2',
    purpose:'User requested all remaining necessary SFX for review. Not installed in frozen game.',
    authority:'Existing battlefield owns gameplay; this pack creates audition assets only.',
    scope:'Six weapon families and operating components, material impact, modular damage/salvage, ambience/warnings, harbor actions and UI. No music or voices.',
    sourceReferences:['outputs/34-sound-music-direction.txt','outputs/16-audio-accessibility-production.txt','outputs/21-weapons-combat-roles.txt','outputs/72-weapon-mount-readability.txt'],
    rights:'Generated through the user-supplied ElevenLabs account. Account/subscription license terms remain applicable; no claim of final legal clearance or third-party sample ownership.',
    documentation:'https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert',
    assets:REVIEW_SOUNDS.map(baseAsset),humanListeningPerformed:false,gameplayInstalled:false,credentialPersisted:false};
  const ids=new Set();for(const def of REVIEW_SOUNDS){if(ids.has(def.id)||!/^[a-z0-9-]+$/.test(def.id))throw new Error('Invalid/duplicate ID');ids.add(def.id);if(def.prompt.length>450||def.prompt.length<20)throw new Error('Prompt length out of range: '+def.id);if(!(def.duration>=.5&&def.duration<=30))throw new Error('Invalid duration: '+def.id);}
  const mg=catalog.assets.find(item=>item.id==='fire-machinegun');
  if(mg?.status==='pending'){
    if(!machinegunRoot)throw new Error('--machinegun-root must refer to the existing original, to avoid a duplicate charged shot.');
    const relative='outputs/audio-machinegun-elevenlabs-v1/machine-gun-single-shot.mp3';
    const bytes=await fs.readFile(path.join(machinegunRoot,relative));if(digest(bytes)!==expectedMachinegun)throw new Error('Existing machinegun SHA mismatch');
    const generation=JSON.parse(await fs.readFile(path.join(machinegunRoot,'outputs/audio-machinegun-elevenlabs-v1/generation.json'),'utf8'));
    await fs.writeFile(path.join(out,mg.file),bytes,{flag:'wx'});
    Object.assign(mg,{status:'existing_reused',duration:generation.request.duration_seconds,bytes:bytes.length,sha256:digest(bytes),source:{provider:'ElevenLabs',model:generation.request.model_id,originalRelative:relative,originalSha256:expectedMachinegun,prompt:generation.request.text,format:'mp3_44100_128',reusedWithoutGeneration:true},normalization:{status:'runtime peak normalization on decode',targetPeak:.7}});
  }
  const recovered=[];
  for(const def of REVIEW_SOUNDS){
    if(!await exists(metadataFile(def.id)))continue;
    const receipt=JSON.parse(await fs.readFile(metadataFile(def.id),'utf8')),asset=catalog.assets.find(a=>a.id===def.id);
    if(receipt.request?.text!==def.prompt)throw new Error('Existing request/plan mismatch: '+def.id);
    if(receipt.status==='generated_unreviewed'&&receipt.output){
      const bytes=await fs.readFile(path.join(out,receipt.output.file));if(bytes.length!==receipt.output.bytes||digest(bytes)!==receipt.output.sha256)throw new Error('Generation receipt file mismatch: '+def.id);
      if(asset.status!=='generated_unreviewed')recovered.push(def.id);
      Object.assign(asset,{status:'generated_unreviewed',...receipt.output,source:{provider:'ElevenLabs',model:receipt.request.model_id,prompt:def.prompt,request:receipt.request,receipt:`generation/${def.id}.json`,billedCharacterCost:receipt.billedCharacterCost},normalization:{status:'runtime peak normalization on decode',targetPeak:.7}});
    }else if(asset.status==='pending'){Object.assign(asset,{status:'failed',failure:{outcome:receipt.status,httpStatus:receipt.httpStatus,providerCode:receipt.providerCode,reason:'Prior attempt preserved. No automatic paid retry.'}});}
  }
  if(recovered.length){await fs.writeFile(path.join(out,'catalog-recovery.json'),JSON.stringify({recoveredAt:new Date().toISOString(),ids:recovered,reason:'OneDrive EPERM catalog rename interrupted local indexing; canonical successful generation receipts and MP3s restored without API re-request.',additionalPaidRequests:0},null,2)+'\n');}
  await persist();
  // A local staging index from the prior EPERM is redundant after receipt recovery.
  await fs.rm(path.join(out,'catalog.next.json'),{force:true});
}
let completed=0,fatal=false;
async function generate(def){
  const asset=catalog.assets.find(item=>item.id===def.id);
  if(['existing_reused','generated_unreviewed'].includes(asset.status)){
    const bytes=await fs.readFile(path.join(out,asset.file));if(bytes.length!==asset.bytes||digest(bytes)!==asset.sha256)throw new Error('Previously generated asset mismatch: '+def.id);return;
  }
  // Uncertain outcomes/failed paid requests are never retried automatically.
  if(await exists(metadataFile(def.id))){console.log(JSON.stringify({id:def.id,status:'skipped_prior_attempt',requestRetried:false}));return;}
  const request={text:def.prompt,duration_seconds:def.duration,prompt_influence:.65,loop:!!def.loop,model_id:'eleven_text_to_sound_v2'};
  const receipt={id:def.id,startedAt:new Date().toISOString(),provider:'ElevenLabs',endpoint:'https://api.elevenlabs.io/v1/sound-generation',request,status:'started_outcome_not_yet_known',credentialPersisted:false,requestRetried:false};
  await fs.writeFile(metadataFile(def.id),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  try{
    const response=await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',{method:'POST',redirect:'error',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(180000)});
    const providerRequestId=response.headers.get('request-id')||response.headers.get('x-request-id');
    if(providerRequestId&&/^[a-zA-Z0-9_-]{1,150}$/.test(providerRequestId))receipt.providerRequestId=providerRequestId;
    receipt.httpStatus=response.status;
    if(!response.ok){
      let code='';try{const data=await response.json();const candidate=data?.detail?.status||data?.status;if(typeof candidate==='string'&&/^[a-z0-9_-]{1,80}$/i.test(candidate))code=candidate;}catch{}
      Object.assign(receipt,{status:'failed',httpStatus:response.status,providerCode:code,completedAt:new Date().toISOString()});Object.assign(asset,{status:'failed',failure:{httpStatus:response.status,providerCode:code}});
      if([401,402,403,429].includes(response.status))fatal=true;
    }else{
      const bytes=Buffer.from(await response.arrayBuffer());const mp3=bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255&&(bytes[1]&224)===224;
      if(!mp3||bytes.length<1000)throw new Error('Invalid MP3 response');
      await fs.writeFile(path.join(out,asset.file),bytes,{flag:'wx'});
      const output={file:asset.file,bytes:bytes.length,sha256:digest(bytes),format:'mp3_44100_128'};
      Object.assign(receipt,{status:'generated_unreviewed',completedAt:new Date().toISOString(),output,billedCharacterCost:response.headers.get('character-cost')});
      Object.assign(asset,{status:'generated_unreviewed',...output,source:{provider:'ElevenLabs',model:request.model_id,prompt:def.prompt,request,receipt:`generation/${def.id}.json`,billedCharacterCost:receipt.billedCharacterCost},normalization:{status:'runtime peak normalization on decode',targetPeak:.7}});completed++;
    }
  }catch(error){Object.assign(receipt,{status:'uncertain',completedAt:new Date().toISOString(),error:error.name==='TimeoutError'?'Request timeout; may be billable. No automatic retry.':error.name==='TypeError'?'Network error; outcome unknown. No automatic retry.':String(error.message).replace(/[^a-zA-Z0-9 .:_-]/g,'').slice(0,130)});Object.assign(asset,{status:'failed',failure:{outcome:'uncertain',reason:receipt.error}});}
  await fs.writeFile(metadataFile(def.id),JSON.stringify(receipt,null,2)+'\n');await persist();console.log(JSON.stringify({id:def.id,status:asset.status,completed,of:REVIEW_SOUNDS.length-1,...(asset.bytes?{bytes:asset.bytes}:{}),requestRetried:false}));
}
try{
  await writeCatalogStart();if(arg.includes('--prepare-only')){console.log(JSON.stringify({prepared:true,count:catalog.assets.length,reused:catalog.assets.filter(item=>item.status==='existing_reused').length}));}
  else{
    const pending=REVIEW_SOUNDS.filter(def=>catalog.assets.find(a=>a.id===def.id).status==='pending');
    if(pending.length){key=await secretInput();if(!key)throw new Error('No credential received.');let next=0;
      const workers=await Promise.allSettled([0,1].map(async()=>{while(!fatal&&next<pending.length){const def=pending[next++];await generate(def);}}));
      const failed=workers.find(result=>result.status==='rejected');if(failed)throw failed.reason;
    }
    key=undefined;catalog.completedAt=new Date().toISOString();catalog.summary={planned:catalog.assets.length,generated:catalog.assets.filter(a=>a.status==='generated_unreviewed').length,reused:catalog.assets.filter(a=>a.status==='existing_reused').length,failed:catalog.assets.filter(a=>a.status==='failed').length,pending:catalog.assets.filter(a=>a.status==='pending').length,totalBytes:catalog.assets.reduce((sum,a)=>sum+(a.bytes||0),0),billedCharacterCost:catalog.assets.filter(a=>a.status==='generated_unreviewed').reduce((sum,a)=>sum+(Number(a.source?.billedCharacterCost)||0),0)};await persist();console.log(JSON.stringify({summary:catalog.summary,humanListeningPerformed:false,gameplayInstalled:false}));
    if(catalog.summary.failed||catalog.summary.pending)process.exitCode=2;
  }
}catch(error){key=undefined;console.error(JSON.stringify({ok:false,error:String(error.message).slice(0,200),requestRetried:false}));process.exitCode=1;}
