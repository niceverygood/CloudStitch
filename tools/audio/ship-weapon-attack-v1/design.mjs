export const RATE=44100;
export const PLANS=[
 ['mobility','launch',.34,'string','fire-harpoon','팽팽한 활줄 해방 → 황동 랙 접촉',155],
 ['mobility','flight',.30,'air','wind-fast-loop','짧고 날카로운 볼트 비행',0],
 ['mobility','hit',.64,'wood','hit-wood','목재 관통 → 섬유 파열·작은 파편',92],
 ['mobility','recovery',.40,'rack','machinegun-feed','장전 랙 복귀·황동 걸쇠',185],
 ['artillery','launch',.46,'rocket','flame-ignite','독립 로켓 1발 점화 → 압력 배기',72],
 ['artillery','flight',.65,'wash','flame-spray-loop','로켓 가속·넓은 비행 배기',0],
 ['artillery','hit',1.25,'blast','mortar-impact','큰 폭압 → 재료 파열·잔해·공간',45],
 ['artillery','recovery',.48,'rack','cannon-breech','발사관·받침 복귀 → 배기 밸브',125],
 ['salvage','launch',.54,'harpoon','fire-harpoon','무거운 작살 해방 → 윈치 하우징 진동',58],
 ['salvage','flight',.65,'cable','harpoon-tension-loop','케이블 풀림·회전하는 스풀',0],
 ['salvage','hit',.95,'metalwood','harpoon-embed','황동·목재 관통 → 고정 장력',68],
 ['salvage','recovery',.90,'tension','winch-loop','장력 걸림 → 윈치 감속·고정',85],
].map(([branch,event,duration,kind,donor,description,hz])=>({id:`${branch}-${event}`,branch,event,duration,kind,donor,description,hz}));
const TAU=2*Math.PI;
function rng(s){let a=2166136261;for(const c of s)a=Math.imul(a^c.charCodeAt(0),16777619);return()=>{a^=a<<13;a^=a>>>17;a^=a<<5;return(a>>>0)/2147483648-1;};}
function lowpass(x,hz){const a=1-Math.exp(-TAU*hz/RATE),out=new Float32Array(x.length);let s=0;for(let i=0;i<x.length;i++){s+=a*(x[i]-s);out[i]=s;}return out;}
function band(x,lo,hi){const out=lowpass(x,hi),low=lowpass(out,lo);for(let i=0;i<out.length;i++)out[i]-=low[i];return out;}
function fade(x){const A=44,R=Math.min(1323,Math.floor(x.length/4));for(let i=0;i<A;i++)x[i]*=i/A;for(let i=0;i<R;i++)x[x.length-1-i]*=i/R;return x;}
function normalize(x,target=1){let peak=0;for(const v of x)peak=Math.max(peak,Math.abs(v));if(peak>1e-9)for(let i=0;i<x.length;i++)x[i]*=target/peak;return x;}
export function measure(channels){let peak=0,e=0,sum=0,finite=true,clipped=0;for(const ch of channels)for(const x of ch){e+=x*x;sum+=x;peak=Math.max(peak,Math.abs(x));finite&&=Number.isFinite(x);if(Math.abs(x)>=1)clipped++;}const count=channels.length*channels[0].length;return{frames:channels[0].length,sampleRate:RATE,channels:channels.length,duration:channels[0].length/RATE,peak,peakDbfs:peak?20*Math.log10(peak):null,rms:Math.sqrt(e/count),dc:sum/count,finite,clipped};}
export function design(plan,mode,source){const rich=mode==='enhanced',n=Math.round(RATE*plan.duration),channels=[new Float32Array(n),new Float32Array(n)],rand=rng(plan.id+mode),layers=[];
 function add(x,at,gain,pan=0){const offset=Math.round(at*RATE);for(let i=0;i<x.length&&i+offset<n;i++){if(i+offset<0)continue;channels[0][i+offset]+=x[i]*gain*Math.sqrt(1-pan);channels[1][i+offset]+=x[i]*gain*Math.sqrt(1+pan);}}
 function tone(hz,seconds,gain,at=0,type='fall',pan=0){const x=new Float32Array(Math.round(seconds*RATE));let phase=0;for(let i=0;i<x.length;i++){const t=i/RATE,decay=seconds*(type==='string'?.33:.23),freq=type==='fall'?hz*(1+1.7*Math.exp(-t/.012)):hz;phase+=TAU*freq/RATE;const h=type==='string'?Math.sin(phase)+.48*Math.sin(phase*2.02)+.22*Math.sin(phase*3.91):Math.sin(phase)+.15*Math.sin(phase*1.99);x[i]=h*Math.exp(-t/decay)*(1-Math.exp(-t/.0007));}add(fade(x),at,gain,pan);layers.push({type:'original procedural oscillator',shape:type,hz,duration:seconds,start:at,gain,pan});}
 function noise(seconds,gain,at=0,lo=100,hi=6000,pan=0,rise=false){const x=new Float32Array(Math.round(seconds*RATE));for(let i=0;i<x.length;i++){const t=i/RATE,a=rise?Math.sin(Math.PI*i/x.length):Math.exp(-t/(seconds*.3));x[i]=rand()*a;}add(fade(normalize(band(x,lo,hi))),at,gain,pan);layers.push({type:'deterministic band-limited procedural noise',duration:seconds,start:at,lo,hi,gain,pan});}
 function donor(seconds,gain,at=0,rate=1,pan=0){const x=new Float32Array(Math.round(seconds*RATE)),s=source.channels,n0=s[0].length;for(let i=0;i<x.length;i++){const p=i*rate*source.sampleRate/RATE,k=Math.floor(p),f=p-k;if(k+1>=n0)break;for(const c of s)x[i]+=(c[k]*(1-f)+c[k+1]*f)/s.length;}add(fade(normalize(band(x,55,rich?6500:4800))),at,gain,pan);layers.push({type:'existing project v5 processed fragment',id:plan.donor,sha256:source.sha256,duration:seconds,start:at,rate,gain,pan});}
 const k=plan.kind;
 if(k==='string'){tone(rich?128:200,.21,rich?.9:.65,0,'string');noise(.035,.30,0,750,8500);donor(.08,rich?.48:.22,.025,1.2);tone(235,.07,.22,.065,'string',.2);if(rich){tone(73,.15,.58);noise(.10,.28,.025,260,6000,-.25);tone(490,.05,.17,.105,'string',-.3);}}
 else if(k==='air'||k==='wash'||k==='cable'){noise(plan.duration*.85,rich?.75:.55,0,k==='cable'?150:250,k==='air'?9500:5000,0,true);donor(plan.duration*.75,rich?.45:.25,0,k==='air'?1.8:.9);if(rich){noise(plan.duration*.65,.35,.03,95,3000,-.4,true);if(k==='cable'){tone(175,.45,.23,0,'string');tone(320,.25,.16,.08,'string',.4);}}}
 else if(k==='rocket'){noise(.08,rich?.9:.7,0,450,9500);tone(rich?66:105,.26,rich?.95:.5);noise(.33,rich?.7:.3,.018,80,4600,rich?-.2:0);donor(.22,rich?.75:.35,0,.9);if(rich){tone(132,.14,.45,.012);noise(.19,.37,.07,220,6800,.35);}}
 else if(k==='wood'||k==='metalwood'||k==='blast'){donor(Math.min(plan.duration*.65,.52),rich?.85:.65,0,rich?.8:1.15);tone(plan.hz,Math.min(.5,plan.duration*.6),rich?1:.45);noise(k==='blast'?.12:.055,rich?.85:.35,0,300,k==='wood'?7000:9500);if(rich){tone(plan.hz*.73,Math.min(.75,plan.duration*.75),.7,.008);noise(plan.duration*.48,.45,.04,80,4200,-.32);noise(.08,.30,.12,500,8000,.5);noise(.11,.23,.23,260,6400,-.45);if(k==='metalwood')tone(330,.32,.24,.07,'string');if(k==='blast'){noise(.22,.3,.37,170,7600,.4);noise(.16,.2,.65,600,8000,-.5);}}}
 else if(k==='harpoon'){donor(.26,rich?.8:.55,0,.8);tone(plan.hz,.35,rich?1:.5);noise(.065,rich?.65:.32,0,240,8000);tone(182,.15,rich?.40:.2,.06,'string');if(rich){noise(.25,.4,.05,120,4300,-.3);tone(92,.24,.42,.012);}}
 else if(k==='rack'){donor(.16,rich?.8:.55,0,1.25);tone(plan.hz,.12,rich?.55:.3,0,'string');noise(.04,.25,.045,600,7500,.2);if(rich){tone(plan.hz*.55,.22,.4,.018);noise(.10,.22,.12,180,4700,-.25);}}
 else if(k==='tension'){donor(.58,rich?.75:.5,0,.8);tone(plan.hz,.6,rich?.6:.3,0,'string');noise(.45,.2,.02,250,3100,0,true);if(rich){tone(54,.55,.45);tone(250,.30,.25,.15,'string',.3);noise(.07,.3,.66,700,5500,-.25);}}
 if(rich){const original=channels.map(c=>c.slice());for(let c=0;c<2;c++)for(const [sec,g]of[[.023,.16],[.041,.13],[.073,.1],[.113,.07]]){const d=Math.round((sec+c*.0027)*RATE);for(let i=d;i<n;i++)channels[c][i]+=original[c][i-d]*g*Math.exp(-(i-d)/RATE/(plan.duration*.7));}layers.push({type:'short source-derived stereo enclosure reflections',delaySeconds:[.023,.041,.073,.113]});}
 const out=channels.map(c=>fade(band(c,30,11000)));for(let c=0;c<2;c++)for(let i=0;i<n;i++)out[c][i]=Math.tanh(out[c][i]*(rich?1.8:1));return{channels:out,sampleRate:RATE,recipe:{id:plan.id,mode,kind:k,description:plan.description,contactSeconds:0,loop:false,proceduralPrototype:true,source:plan.donor,layers,subjectiveListeningPerformed:false}};
}
