import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {MORTAR_REVISION} from './plan.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=path.join(root,'outputs/audio-mortar-r1');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const exists=async file=>{try{await fs.access(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
await fs.mkdir(path.join(out,'audio'),{recursive:true});await fs.mkdir(path.join(out,'generation'),{recursive:true});
let credential;
async function secretInput(){if(process.stdin.isTTY)process.stdin.setRawMode(true);console.log('Waiting for API credential on private stdin; input is not echoed.');try{return await new Promise((resolve,reject)=>{let value='';const onData=chunk=>{value+=chunk.toString('utf8');if(value.includes('\u0003')){value='';process.stdin.off('data',onData);process.stdin.pause();reject(new Error('Cancelled'));return;}if(/[\r\n]/.test(value)){const answer=value.trim();value='';process.stdin.off('data',onData);process.stdin.pause();resolve(answer);}};process.stdin.on('data',onData);process.stdin.resume();});}finally{if(process.stdin.isTTY)process.stdin.setRawMode(false);}}
try{
  for(const def of MORTAR_REVISION)if(def.prompt.length>450)throw new Error('Prompt too long');
  const pending=[];
  for(const def of MORTAR_REVISION){const receiptFile=path.join(out,'generation',def.id+'.json');if(await exists(receiptFile)){const receipt=JSON.parse(await fs.readFile(receiptFile,'utf8'));if(receipt.status==='generated_unreviewed'){const bytes=await fs.readFile(path.join(out,receipt.output.file));if(sha(bytes)!==receipt.output.sha256)throw new Error('Existing revision hash mismatch');console.log(JSON.stringify({id:def.id,status:'existing_success_preserved',requestRetried:false}));}else console.log(JSON.stringify({id:def.id,status:'previous_attempt_preserved_no_retry'}));}else pending.push(def);}
  if(pending.length){credential=await secretInput();if(!credential)throw new Error('No credential supplied');}
  for(const def of pending){
    const file=`audio/${def.id}.mp3`,receiptFile=path.join(out,'generation',def.id+'.json'),request={text:def.prompt,duration_seconds:def.duration,prompt_influence:.7,loop:false,model_id:'eleven_text_to_sound_v2'};
    const receipt={id:def.id,provider:'ElevenLabs',startedAt:new Date().toISOString(),request,status:'started_outcome_unknown',credentialPersisted:false,requestRetried:false};
    await fs.writeFile(receiptFile,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    try{
      const response=await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',{method:'POST',redirect:'error',headers:{'xi-api-key':credential,'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(180000)});
      receipt.httpStatus=response.status;
      if(!response.ok){let providerCode='';try{const data=await response.json();const candidate=data.detail?.status;if(typeof candidate==='string'&&/^[a-z0-9_-]{1,80}$/i.test(candidate))providerCode=candidate;}catch{}Object.assign(receipt,{status:'failed',providerCode});}
      else{const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<1000||!(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255&&(bytes[1]&224)===224))throw new Error('Invalid MP3 response');await fs.writeFile(path.join(out,file),bytes,{flag:'wx'});Object.assign(receipt,{status:'generated_unreviewed',output:{file,bytes:bytes.length,sha256:sha(bytes),format:'mp3_44100_128'},billedCharacterCost:response.headers.get('character-cost')});}
    }catch(error){Object.assign(receipt,{status:'uncertain',error:error.name==='TimeoutError'?'Timeout; no automatic paid retry.':'Request or local write failed; preserved without automatic paid retry.'});}
    receipt.completedAt=new Date().toISOString();await fs.writeFile(receiptFile,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({id:def.id,status:receipt.status,bytes:receipt.output?.bytes,httpStatus:receipt.httpStatus,requestRetried:false}));if(receipt.status!=='generated_unreviewed'){process.exitCode=2;break;}
  }
}catch(error){console.error(JSON.stringify({ok:false,error:error.message,requestRetried:false}));process.exitCode=1;}finally{credential=undefined;}
