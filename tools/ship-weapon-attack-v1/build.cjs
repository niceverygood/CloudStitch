const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/ship-weapon-attack-v1'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const harmony='outputs/ship-weapon-harmony-v1/',delivery=JSON.parse(fs.readFileSync(path.join(root,harmony,'delivery-summary.json'),'utf8')),mapPath='outputs/audio-ship-weapon-attack-v1/cue-map.json',cueMap=JSON.parse(fs.readFileSync(path.join(root,mapPath),'utf8'));
 const sources=[],models={},cues=[];
 for(const m of delivery.final_model_records){const p=harmony+m.model,b=fs.readFileSync(path.join(root,p));if(sha(b)!==m.sha256)throw new Error('Frozen harmony changed '+p);sources.push({path:p,bytes:b.length,sha256:sha(b)});models[m.id]=b.toString('base64');}
 if(cueMap.cues.length!==24)throw new Error('Expected final per-event audio24');
 for(const c of cueMap.cues){const p='outputs/audio-ship-weapon-attack-v1/'+c.path,b=fs.readFileSync(path.join(root,p));if(sha(b)!==c.sha256)throw new Error('Frozen audio changed '+p);sources.push({path:p,bytes:b.length,sha256:sha(b)});cues.push({key:c.id,branch:c.branch,variant:c.variant,phase:c.phase,duration:c.duration,sha256:c.sha256,path:p,base64:b.toString('base64')});}
 const payload=JSON.stringify({models,cues,source:sources,audioMode:'final dedicated per-event cue24; no fallback or whole-sequence playback'}).replace(/</g,'\\u003c');
 const bundle=await require('esbuild').build({entryPoints:[path.join(__dirname,'viewer.js')],bundle:true,write:false,minify:true,format:'iife',target:['chrome100'],nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),define:{__ATTACK_DATA__:'window.__ATTACK_PAYLOAD__'}});
 const html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8').replace('/* ATTACK_DATA */',()=>payload).replace('/* ATTACK_APP */',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),html);fs.writeFileSync(path.join(out,'build-manifest.json'),JSON.stringify({date:'2026-10-19',sources,audio_cue_map:{path:mapPath,sha256:sha(fs.readFileSync(path.join(root,mapPath)))},viewer_bytes:Buffer.byteLength(html),viewer_sha256:sha(Buffer.from(html)),models:3,per_event_cues:24,original_GLBS_unchanged:true,new_GLBS:0},null,2)+'\n');
 console.log(JSON.stringify({embedded_actual_models:3,final_audio_cues:24,bytes:Buffer.byteLength(html)}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
