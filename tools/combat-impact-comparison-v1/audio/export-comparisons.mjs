import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeTape} from '../timeline.mjs';
import {decodeWav,encodeWav} from '../../audio/cinematic-v5/wav.mjs';

const ROOT='outputs/combat-impact-comparison-v1/audio',SR=44100,MASTER=.28,VOLUME=.9,GAP=.4;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const assets=JSON.parse(fs.readFileSync(`${ROOT}/assets.json`,'utf8'));
const originals=['assets.json','verification.json','player-verification.json',...assets.flatMap(a=>['old','new','oldMatched','newMatched'].map(v=>a[v].split('/').at(-1)))];
if(originals.length!==19||new Set(originals).size!==19)throw Error('Expected 19 original core files');
const sourcePins=originals.map(name=>{const p=`${ROOT}/${name}`,b=fs.readFileSync(p);return {path:p,bytes:b.length,sha256:hash(b)};});
const readme=fs.readFileSync(`${ROOT}/README.md`),readmeSha=hash(readme);
const checks=[];function check(label,ok,detail){checks.push({label,passed:!!ok,detail});if(!ok)throw Error(label);}
function metrics(channels){let energy=0,peak=0,finite=true;for(const c of channels)for(const x of c){energy+=x*x;peak=Math.max(peak,Math.abs(x));finite&&=Number.isFinite(x);}return {peak,rms:Math.sqrt(energy/(channels.length*channels[0].length)),finite,duration:channels[0].length/SR};}
const exports=[];
for(const [weapon,seconds,file] of [['cannon',3.6,'comparison-cannon.wav'],['machinegun',3,'comparison-machinegun-2s.wav']]){
 // Spatial mounting only rotates/translates this tape; the authority's event
 // timings, firing cadence and collision times are unchanged by this transform.
 const tape=makeTape({weapon,muzzle:{position:[0,0,0],direction:[0,0,1]},miss:false});
 const events=tape.events.map(e=>({type:e.type,time:e.time,id:e.id,authorityType:e.authorityType,weaponId:e.weaponId}));
 check(`${weapon} exact event counts`,events.filter(e=>e.type==='fire').length===(weapon==='cannon'?1:10)&&events.filter(e=>e.type==='hit').length===(weapon==='cannon'?1:10),events);
 const variants={},filesUsed=[];
 for(const version of ['old','new']){
  const channels=[new Float32Array(Math.round(seconds*SR)),new Float32Array(Math.round(seconds*SR))],ranges=[];
  for(const e of events){
   const id=`${e.type==='fire'?'fire':'impact'}-${weapon}`,asset=assets.find(a=>a.id===id),p=asset[`${version}Matched`],bytes=fs.readFileSync(p),w=decodeWav(bytes),offset=Math.round(e.time*SR);
   check(`${weapon}/${version}/${e.type}@${e.time} valid sample rate`,w.sampleRate===SR&&w.channels.length===2);
   check(`${weapon}/${version}/${e.type}@${e.time} full tail retained`,offset+w.channels[0].length<=channels[0].length,{eventTime:e.time,clipDuration:w.duration,segmentDuration:seconds});
   ranges.push({start:offset,end:offset+w.channels[0].length});
   filesUsed.push({id,version,path:p,sha256:hash(bytes)});
   for(let c=0;c<2;c++)for(let i=0;i<w.channels[c].length;i++)channels[c][offset+i]+=w.channels[c][i]*MASTER*VOLUME;
  }
  const edges=ranges.flatMap(r=>[{position:r.start,change:1},{position:r.end,change:-1}]).sort((a,b)=>a.position-b.position||a.change-b.change);let active=0,maxVoices=0;for(const e of edges){active+=e.change;maxVoices=Math.max(maxVoices,active);}
  const m=metrics(channels);check(`${weapon}/${version} headroom and cap`,m.finite&&m.peak<.92&&maxVoices<=4,{...m,maxVoices});variants[version]={channels,metrics:m,maxVoices};
 }
 const frames=Math.round(seconds*SR),gapFrames=Math.round(GAP*SR),pair=[new Float32Array(frames*2+gapFrames),new Float32Array(frames*2+gapFrames)];
 for(let c=0;c<2;c++){pair[c].set(variants.old.channels[c],0);pair[c].set(variants.new.channels[c],frames+gapFrames);}
 const output=`${ROOT}/${file}`,b=encodeWav({channels:pair,sampleRate:SR});fs.writeFileSync(output,b);
 const decoded=decodeWav(b),dm=metrics(decoded.channels);
 check(`${weapon} exact silent .4s separator`,decoded.channels.every(c=>c.subarray(frames,frames+gapFrames).every(x=>x===0)));
 check(`${weapon} export safe finite PCM`,dm.finite&&dm.peak<.92,dm);
 exports.push({weapon,file:output,bytes:b.length,sha256:hash(b),...dm,segments:{old:{start:0,end:seconds,...variants.old.metrics,maxVoices:variants.old.maxVoices},silence:{start:seconds,end:seconds+GAP},new:{start:seconds+GAP,end:seconds*2+GAP,...variants.new.metrics,maxVoices:variants.new.maxVoices}},events,filesUsed:[...new Map(filesUsed.map(f=>[f.path,f])).values()],authority:tape.authority,stats:tape.stats});
}
const afterPins=sourcePins.map(pin=>({...pin,afterSha256:hash(fs.readFileSync(pin.path)),preserved:hash(fs.readFileSync(pin.path))===pin.sha256}));
check('all 19 original core files preserved',afterPins.every(p=>p.preserved));
check('original README preserved',hash(fs.readFileSync(`${ROOT}/README.md`))===readmeSha);
const report={passed:true,sampleRate:SR,channels:2,codec:'PCM_S16LE',masterGain:MASTER,volume:VOLUME,linearMixGain:MASTER*VOLUME,matched:true,matching:'Uses existing per-clip whole-stereo-RMS matched assets without additional gain/EQ/limiting/normalization; complete-scene old/new RMS may differ due to lengths and overlap; not LUFS equality',eventSource:'tools/combat-impact-comparison-v1/timeline.mjs makeTape; actual existing battlefield authority fire/hit times; no authored .1s impact delay',playOrder:'old -> .4 seconds silence -> new',humanListeningApproval:false,tenfoldApproved:false,browserOrNativeRun:false,gameplayInstalled:false,paidRequests:0,sourcePreservation:{count:19,files:afterPins,readme:{sha256:readmeSha,preserved:true}},exports,checks};
fs.writeFileSync(`${ROOT}/comparisons.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:checks.length,preserved:afterPins.length,exports:exports.map(e=>({file:e.file,duration:e.duration,events:e.events,peak:e.peak,rms:e.rms,maxVoices:{old:e.segments.old.maxVoices,new:e.segments.new.maxVoices}}))}));
