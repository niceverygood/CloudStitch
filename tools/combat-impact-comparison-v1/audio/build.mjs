import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {decodeWav,encodeWav} from '../../audio/cinematic-v5/wav.mjs';

const OUT='outputs/combat-impact-comparison-v1/audio',SR=44100,TAU=Math.PI*2;
fs.mkdirSync(OUT,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>decodeWav(fs.readFileSync(p));
const inputs={};
function load(p){const b=fs.readFileSync(p);inputs[p]={bytes:b.length,sha256:hash(b)};return decodeWav(b);}
const originalWood=load('work/audio/rich-v1/decoded/hit-wood.wav');
const originalEngine=load('work/audio/rich-v1/decoded/hit-engine.wav');
const originalFeed=load('work/audio/rich-v1/decoded/machinegun-feed.wav');
const mono=w=>{const o=new Float32Array(w.channels[0].length);for(const c of w.channels)for(let i=0;i<o.length;i++)o[i]+=c[i]/w.channels.length;return o;};
const at=(a,p)=>{if(p<0||p>=a.length)return 0;const i=Math.floor(p),f=p-i;return a[i]*(1-f)+(a[Math.min(i+1,a.length-1)]||0)*f;};
function seeded(s){let v=s;return()=>{v^=v<<13;v^=v>>>17;v^=v<<5;return (v>>>0)/2147483648-1;};}
function peak(a){let p=0;for(const x of a)p=Math.max(p,Math.abs(x));return p;}
function low(a,hz){const k=1-Math.exp(-TAU*hz/SR),o=new Float32Array(a.length);let z=0;for(let i=0;i<a.length;i++){z+=k*(a[i]-z);o[i]=z;}return o;}
function band(a,lo,hi){const h=low(a,hi),l=low(h,lo);return h.map((v,i)=>v-l[i]);}
function edge(a,A=.0007,R=.018){const na=Math.round(SR*A),nr=Math.round(SR*R);for(let i=0;i<Math.min(na,a.length);i++)a[i]*=Math.sin(i/na*Math.PI/2)**2;for(let i=0;i<Math.min(nr,a.length);i++)a[a.length-1-i]*=Math.sin(i/nr*Math.PI/2)**2;return a;}
function noise(seconds,seed,lo,hi,decay,attack=.0003){const n=Math.round(seconds*SR),r=seeded(seed),a=new Float32Array(n);for(let i=0;i<n;i++){const t=i/SR;a[i]=r()*(1-Math.exp(-t/attack))*Math.exp(-t/decay);}return edge(band(a,lo,hi));}
function tone(seconds,hz,decay,drop=0,inharmonic=0){const a=new Float32Array(Math.round(SR*seconds));let ph=0;for(let i=0;i<a.length;i++){const t=i/SR;ph+=TAU*(hz+drop*Math.exp(-t/.012))/SR;a[i]=(Math.sin(ph)+inharmonic*Math.sin(ph*1.713))*(1-Math.exp(-t/.0006))*Math.exp(-t/decay);}return edge(a);}
function fragment(w,seconds,rate=1,lo=50,hi=6000){const m=mono(w);let onset=0;const threshold=peak(m)*.1;while(onset<m.length&&Math.abs(m[onset])<threshold)onset++;onset=Math.max(0,onset-Math.round(.001*w.sampleRate));const a=new Float32Array(Math.round(seconds*SR));for(let i=0;i<a.length;i++)a[i]=at(m,onset+i*w.sampleRate/SR*rate);const o=edge(band(a,lo,hi));const p=peak(o)||1;return o.map(x=>x/p);}
const recipes={};
function make(id,seconds){const channels=[new Float32Array(Math.round(seconds*SR)),new Float32Array(Math.round(seconds*SR))],layers=[];
 function add(a,start,gain,pan,label){const offset=Math.round(start*SR),g=[Math.sqrt((1-pan)/2),Math.sqrt((1+pan)/2)];for(let c=0;c<2;c++)for(let i=0;i<a.length&&i+offset<channels[c].length;i++)channels[c][i+offset]+=a[i]*gain*g[c];layers.push({label,start,duration:a.length/SR,gain,pan});}
 if(id==='fire-cannon'){
  add(noise(.08,7101,650,7500,.012),0,1.35,0,'single ignition crack; no repeated gunshot');
  add(tone(.55,53,.13,112,.16),0,1.4,0,'falling muzzle pressure');
  add(noise(.56,7102,85,2400,.14,.006),.009,.95,-.1,'thick compressed exhaust bloom');
  add(fragment(originalEngine,.22,.62,80,2100),.031,.62,.1,'breech and gun carriage recoil');
  add(tone(.44,132,.10,8,.32),.048,.40,-.12,'honeywood gun bed resonance');
  add(noise(.32,7103,220,2000,.09,.015),.12,.28,.22,'recoil rail friction and wooden settling');
  const reflection=noise(.55,7104,190,3200,.12,.002);add(reflection,.16,.10,-.6,'distant port reflection left');add(reflection,.21,.075,.6,'distant port reflection right');
 }else if(id==='impact-cannon'){
  add(noise(.09,7201,900,9500,.009),0,1.65,0,'hard projectile contact');
  add(tone(.42,89,.09,33,.35),0,.95,0,'hollow timber slab shock, not muzzle sub');
  add(fragment(originalWood,.30,.68,160,6500),.006,1.2,-.12,'recorded wood tearing body');
  // Delayed fractures are splinter events, not extra weapon shots.
  for(const [j,t] of [.027,.065,.115,.19,.29].entries())add(noise(.15,7250+j,750+j*120,7500,.016+j*.004),t,.47-j*.058,(j%2?1:-1)*(.25+j*.09),'branching grain fracture '+(j+1));
  add(tone(.7,164,.18,0,.62),.035,.40,.12,'broken plank bending resonance');
  add(noise(.85,7270,160,1500,.22,.028),.12,.33,0,'hull cavity exhalation');
  for(const [j,t] of [.35,.49,.68,.91,1.18].entries())add(tone(.13,590+j*131,.025,0,.67),t,.11-j*.014,j%2?.66:-.66,'falling splinter tick '+(j+1));
 }else if(id==='fire-machinegun'){
  add(noise(.045,7301,1100,8500,.0045),0,1.30,0,'one sharp pressure crack');
  add(tone(.105,112,.023,185,.22),0,.95,0,'compact heavy chamber punch');
  add(noise(.09,7302,180,2200,.018),.003,.60,-.1,'short barrel pressure');
  add(fragment(originalEngine,.055,.95,250,3000),.014,.28,.1,'breech clack');
  add(fragment(originalFeed,.046,1.15,900,6500),.078,.22,.3,'bolt return; mechanical, no repeated shot');
  add(tone(.055,1400,.011,0,.44),.13,.07,-.4,'tiny brass tick');
 }else{
  add(noise(.033,7401,1000,8000,.004),0,1.05,0,'small decisive timber bite');
  add(fragment(originalWood,.10,1.25,350,7200),.002,.58,.1,'short grain split');
  add(tone(.15,231,.033,35,.43),.003,.42,0,'dry plank knock');
  add(noise(.07,7402,1600,7200,.014),.043,.19,-.35,'fine splinter spray');
  add(tone(.08,1050,.014,0,.52),.14,.075,.4,'single light fragment');
 }
 // Preserve the transient/body ratio. No RMS forcing or v5 waveform input.
 let out=channels.map(c=>edge(band(c,30,11000),.00045,.035));const p=Math.max(...out.map(peak));out=out.map(c=>c.map(x=>x*.72/p));recipes[id]={duration:seconds,layers,normalization:'single scalar peak .72; no limiting/compression; preserve transient contrast',source:'new seeded pressure/mechanical/wood events plus first original PCM fragments; no v4/v5 waveform'};return {sampleRate:SR,channels:out};
}
function baseline(id){const name=id.startsWith('impact')?'hit-wood':id,p=`outputs/audio-v1/previews/${name}.wav`,w=load(p),rate=id==='impact-cannon'?.9:id==='impact-machinegun'?1.04:1,g=id==='impact-cannon'?.95:id==='impact-machinegun'?.72:1;
 const raw=mono(w),a=new Float32Array(Math.ceil(raw.length/w.sampleRate/rate*SR));for(let i=0;i<a.length;i++)a[i]=at(raw,i*w.sampleRate/SR*rate)*g;return {wave:{sampleRate:SR,channels:[a,a.slice()]},source:{file:p,sha256:inputs[p].sha256,rate,gain:g,policy:'audio-v1 exported preview; impact uses existing adapter weapon adjustment; no global mixer gain baked'}};}
function metrics(w){let sum=0,p=0,finite=true;for(const c of w.channels)for(const x of c){sum+=x*x;p=Math.max(p,Math.abs(x));finite&&=Number.isFinite(x);}return {duration:w.channels[0].length/w.sampleRate,peak:p,rms:Math.sqrt(sum/(w.channels.length*w.channels[0].length)),finite};}
function scale(w,g){return {sampleRate:w.sampleRate,channels:w.channels.map(c=>c.map(x=>x*g))};}
const assets=[],report={passed:true,checks:[],humanListeningApproval:false,tenfoldApproved:false,browserOrNativeRun:false,paidRequests:0,gameplayInstalled:false,inputs,recipes,matching:'Whole-clip stereo RMS matched by attenuation only; pair peak <= .60. Different durations retained. This is not LUFS or equal perceived loudness.'};
const check=(label,ok,detail)=>{report.checks.push({label,passed:!!ok,detail});if(!ok)report.passed=false;};
const rendered={};
for(const [id,duration] of [['fire-cannon',1.6],['impact-cannon',2.1],['fire-machinegun',.19],['impact-machinegun',.25]]){
 const {wave:old,source}=baseline(id),fresh=make(id,duration),om=metrics(old),nm=metrics(fresh),target=Math.min(om.rms,nm.rms,.6*om.rms/om.peak,.6*nm.rms/nm.peak),oldMatched=scale(old,target/om.rms),newMatched=scale(fresh,target/nm.rms);
 const entry={id,duration:newMatched.channels[0].length/SR,oldDuration:om.duration,newDuration:nm.duration,baseline:source,matchedGains:{old:target/om.rms,new:target/nm.rms},files:{}};
 for(const [key,w] of Object.entries({old,new:fresh,oldMatched,newMatched})){
  const file=`${OUT}/${id}-${key}.wav`,b=encodeWav(w);fs.writeFileSync(file,b);const decoded=read(file),m=metrics(decoded);entry[key]=file;entry.files[key]={bytes:b.length,sha256:hash(b),...m};rendered[`${id}:${key}`]=decoded;
  check(`${id}:${key} safe PCM`,m.finite&&m.peak<=.721&&m.duration>0,m);
  check(`${id}:${key} end release`,decoded.channels.every(c=>Math.abs(c[c.length-1])<.00004));
 }
 check(`${id} whole-clip RMS pair`,Math.abs(entry.files.oldMatched.rms-entry.files.newMatched.rms)<.00001,{old:entry.files.oldMatched.rms,new:entry.files.newMatched.rms});assets.push(entry);
}
// Ten shots over the two-second firing window, each real shot represented once.
// Delayed hits are distinct events, not embedded repeating gunfire.
report.mg={shots:10,interval:.22,fireWindow:2,lastShot:1.98,hitDelay:.10,voiceCap:4,masterGain:.28,maximumVolume:1};
for(const version of ['old','new','oldMatched','newMatched']){
 const a=rendered[`fire-machinegun:${version}`],b=rendered[`impact-machinegun:${version}`],n=Math.ceil(2.6*SR),mix=[new Float32Array(n),new Float32Array(n)],events=[];
 for(let j=0;j<10;j++){events.push({t:j*.22,w:a});events.push({t:j*.22+.1,w:b});}
 let maxVoices=0;for(let i=0;i<n;i++){const t=i/SR;maxVoices=Math.max(maxVoices,events.filter(e=>t>=e.t&&t<e.t+e.w.duration).length);}
 for(const e of events)for(let c=0;c<2;c++)for(let i=0;i<e.w.channels[c].length;i++){const j=i+Math.round(e.t*SR);if(j<n)mix[c][j]+=e.w.channels[c][i]*.28;}
 const m=metrics({channels:mix,sampleRate:SR});report.mg[version]={...m,maxVoices};check(`MG ten shot ${version} headroom`,maxVoices<=4&&m.peak<.92,report.mg[version]);
}
check('worst-case 4 voices bound',.721*.28*4<.92,{peakBound:.721*.28*4});
check('source unchanged',Object.entries(inputs).every(([p,m])=>hash(fs.readFileSync(p))===m.sha256));
fs.writeFileSync(`${OUT}/assets.json`,JSON.stringify(assets,null,2)+'\n');
fs.writeFileSync(`${OUT}/verification.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,assets:assets.length,output:OUT,mg:report.mg}));
if(!report.passed)process.exitCode=1;
