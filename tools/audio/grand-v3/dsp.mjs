/** Cloudstitch grand-v3: source-derived material design, not another EQ pass.
 * Pure deterministic PCM. Feed original decoded MP3 PCM, not v1/v2 renders.
 * No new gunshot, beat, oscillator, melody, voice, gameplay event or I/O.
 * Numerical safety is not human approval of grandeur or timbral quality.
 */
export const DSP_VERSION='cloudstitch-grand-material-v3.0.0';
const TAU=Math.PI*2,EPS=1e-24;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const sumEnergy=a=>{let e=0;for(const x of a)e+=x*x;return e;};
function hash(id){let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}

const MATERIALS={
  pressure:{pitch:.80,lowpass:4700,shelf:-4.5,bodyHz:155,bodyMix:.82,tail:.44,room:.28,drive:1.8,threshold:1.65,ratio:2.8,label:'낮은 포신 압력·단단한 몸통·짙은 짧은 공간'},
  wood:{pitch:.82,lowpass:5100,shelf:-3.8,bodyHz:190,bodyMix:.74,tail:.34,room:.25,drive:1.65,threshold:1.75,ratio:2.6,label:'낮아진 목재 타격·두꺼운 선체 공명·어두운 잔향'},
  brass:{pitch:.85,lowpass:5700,shelf:-4.2,bodyHz:230,bodyMix:.64,tail:.22,room:.20,drive:1.6,threshold:1.8,ratio:2.5,label:'황동의 날카로운 잔딸랑을 줄인 묵직한 작동'},
  engine:{pitch:.82,lowpass:4900,shelf:-4.0,bodyHz:145,bodyMix:.84,tail:.30,room:.20,drive:1.85,threshold:1.6,ratio:2.8,label:'깊어진 기계 몸체·압축된 재료층·어두운 공간'},
  cloth:{pitch:.87,lowpass:6100,shelf:-3.3,bodyHz:255,bodyMix:.49,tail:.26,room:.22,drive:1.5,threshold:1.8,ratio:2.3,label:'낮고 넓어진 천·바람의 마찰과 부드러운 몸체'},
  warning:{pitch:.87,lowpass:6200,shelf:-3.2,bodyHz:260,bodyMix:.48,tail:.17,room:.13,drive:1.55,threshold:1.9,ratio:2.4,label:'식별 윤곽을 남긴 낮고 단단한 경고'},
  ui:{pitch:.92,lowpass:6700,shelf:-3.1,bodyHz:270,bodyMix:.43,tail:.065,room:.13,drive:1.45,threshold:1.8,ratio:2.2,label:'가벼운 딸랑임을 줄이고 낮고 단단하게 붙는 조작음'}
};
const OVERRIDES={
  'fire-machinegun':{pitch:.84,bodyHz:175,bodyMix:.77,tail:.115,room:.16,lowpass:5300},
  'fire-cannon':{pitch:.73,bodyHz:128,bodyMix:.94,tail:.64,room:.33,lowpass:4300},
  'fire-mortar':{pitch:.79,bodyHz:147,bodyMix:.88,tail:.43,room:.25},
  'mortar-launch-a':{pitch:.80,bodyHz:153,bodyMix:.88,tail:.37,room:.24},
  'mortar-launch-b':{pitch:.77,bodyHz:141,bodyMix:.92,tail:.43,room:.27},
  'mortar-impact':{pitch:.72,bodyHz:118,bodyMix:.97,tail:.67,room:.36,lowpass:4100},
  'machinegun-feed':{pitch:.88,tail:.10,room:.13,bodyHz:260,bodyMix:.52},
  'cannon-breech':{pitch:.80,tail:.23,bodyHz:202,bodyMix:.77},
  'fire-harpoon':{pitch:.80,tail:.27,bodyHz:184,bodyMix:.77},
  'harpoon-embed':{pitch:.80,tail:.27,bodyHz:188,bodyMix:.78},
  'chain-spin':{pitch:.84,tail:.17,room:.17,bodyMix:.59},
  'flame-ignite':{pitch:.80,bodyHz:152,bodyMix:.85,tail:.31},
  'flame-stop':{pitch:.85,tail:.15,bodyMix:.63},
  'hit-wood':{pitch:.79,bodyHz:176,bodyMix:.85,tail:.35,room:.27},
  'hit-armor':{pitch:.79,bodyHz:212,bodyMix:.79,tail:.34,room:.24},
  'hit-engine':{pitch:.77,bodyHz:134,bodyMix:.91,tail:.40,room:.25},
  'hit-cloth':{pitch:.88,tail:.17,room:.16,bodyMix:.48},
  'module-break':{pitch:.77,tail:.43,bodyHz:157,bodyMix:.88,room:.29},
  'bundle-detach':{pitch:.80,tail:.38,bodyHz:178,bodyMix:.83},
  'cargo-drop':{pitch:.78,tail:.33,bodyHz:162,bodyMix:.87},
  'connector-cut':{pitch:.83,tail:.18,bodyHz:240,bodyMix:.63},
  'return':{pitch:.77,tail:.30,lowpass:4200,shelf:-6,bodyHz:208,bodyMix:.70},
  'defeat':{pitch:.74,tail:.38,lowpass:4000,shelf:-6.5,bodyHz:187,bodyMix:.77},
  'harbor-depart':{pitch:.81,tail:.26,lowpass:4900,bodyHz:215,bodyMix:.67},
  'ui-hover':{pitch:.94,tail:.035,bodyMix:.34,room:.09},
  'ui-fail':{pitch:.89,tail:.060,bodyMix:.49},
  'ui-back':{pitch:.90,tail:.050,bodyMix:.44}
};
function materialFor(a,id){
  if(a.category==='warning'||/warning|danger|^defeat$/.test(id))return 'warning';
  if(a.category==='ui'||/^ui-|^(?:save|restore)-ok$/.test(id))return 'ui';
  if(/cloth|wind|mortar-fall/.test(id))return 'cloth';
  if(/wood|cargo|hull|bundle|module/.test(id))return 'wood';
  if(/engine|flame|winch/.test(id))return 'engine';
  if(/cannon|mortar|fire-machinegun/.test(id))return 'pressure';
  return 'brass';
}
function recipeFor(asset={}){
  const a=typeof asset==='string'?{id:asset}:(asset||{}),id=String(a.id||'unidentified-cue');
  const material=materialFor(a,id),p={...MATERIALS[material],...(OVERRIDES[id]||{})};
  const loop=a.loop===true||/(?:^|-)loop$/.test(id),seed=hash(id);
  // Ambience retains the original time span. No added tempo or new beat grid.
  if(loop){p.tail=0;p.room=Math.min(.23,p.room);p.bodyMix=Math.min(.79,p.bodyMix);}
  const early=[.007,.013,.019,.026,.034,.043].map((seconds,i)=>({seconds:seconds+((seed>>>(i*3))%3)*.0007,gain:[.19,.15,.12,.09,.065,.04][i]}));
  return {version:DSP_VERSION,id,material,loop,seed,description:p.label,
    processingInput:'original preserved native-decoded MP3 Float32 PCM, not cumulative EQ outputs',
    pitchRatio:p.pitch,pitchMethod:loop?'periodic two-window fractional-delay pitch shift; exact original frames':'source resampling at a lower rate; full source preserved',
    lowpassHz:p.lowpass,highpassHz:35,highShelfHz:2600,highShelfDb:p.shelf,
    body:{sourceDerived:true,monoCore:true,hz:p.bodyHz,q:.83,peakingGainDb:5.5,mix:p.bodyMix,lowpassHz:680,highpassHz:42,
      saturationDrive:2.25,envelopeAttackSeconds:.008,envelopeReleaseSeconds:.085},
    attack:{sourceOnly:true,detailMix:material==='warning'?.12:material==='ui'?.09:.075,lookbackSeconds:.009},
    dynamics:{thresholdTimesSourceRms:p.threshold,ratio:p.ratio,attackSeconds:.006,releaseSeconds:.075,parallelWarmDrive:p.drive},
    space:{mix:p.room,earlyReflections:early,
      diffusion:{method:'four dark damped parallel feedback delays followed by two allpass diffusers',
        delaysSeconds:[.031,.043,.059,.073].map((x,i)=>x+((seed>>>(i*5))%7)*.00031),
        allpassSeconds:[.0117,.0179],allpassFeedback:.47,dampingHz:material==='ui'?2450:1900,
        rt60Seconds:loop?.40:Math.max(.10,p.tail*.85),sourceDerived:true}},
    tailSeconds:loop?0:p.tail,peak:.72,peakLimit:.72,edgeFadeSeconds:{in:.0015,out:.009},seamSeconds:.006,
    dialogue:0,music:0,addedOscillators:0,newGunshots:0,approval:false,
    limits:'Candidate material redesign. Numerical safety does not approve grandeur, cue identity or human listening.'};
}

function coeff(type,sampleRate,hz,q=Math.SQRT1_2,gainDb=0){
  const w=TAU*clamp(hz,5,sampleRate*.44)/sampleRate,c=Math.cos(w),s=Math.sin(w),alpha=s/(2*q),A=10**(gainDb/40);
  let b0,b1,b2,a0,a1,a2;
  if(type==='highpass'){b0=(1+c)/2;b1=-(1+c);b2=b0;a0=1+alpha;a1=-2*c;a2=1-alpha;}
  else if(type==='lowpass'){b0=(1-c)/2;b1=1-c;b2=b0;a0=1+alpha;a1=-2*c;a2=1-alpha;}
  else if(type==='peaking'){b0=1+alpha*A;b1=-2*c;b2=1-alpha*A;a0=1+alpha/A;a1=-2*c;a2=1-alpha/A;}
  else if(type==='highshelf'){
    const k=s/2*Math.sqrt(2),r=2*Math.sqrt(A)*k;
    b0=A*((A+1)+(A-1)*c+r);b1=-2*A*((A-1)+(A+1)*c);b2=A*((A+1)+(A-1)*c-r);
    a0=(A+1)-(A-1)*c+r;a1=2*((A-1)-(A+1)*c);a2=(A+1)-(A-1)*c-r;
  }else throw new Error('Unknown filter');
  return [b0/a0,b1/a0,b2/a0,a1/a0,a2/a0];
}
function filter(input,sampleRate,type,hz,q=Math.SQRT1_2,gainDb=0,loop=false){
  const [b0,b1,b2,a1,a2]=coeff(type,sampleRate,hz,q,gainDb),out=new Float32Array(input.length);
  let z1=0,z2=0;const warm=loop?Math.min(24,Math.max(2,Math.ceil(sampleRate*.55/input.length))):0;
  for(let pass=0;pass<=warm;pass++)for(let i=0;i<input.length;i++){
    const y=b0*input[i]+z1;z1=b1*input[i]-a1*y+z2;z2=b2*input[i]-a2*y;
    if(pass===warm)out[i]=y;
  }
  return out;
}
function interpolate(input,position,circular=false){
  const n=input.length;if(!circular&&(position<0||position>=n))return 0;
  if(circular)position=((position%n)+n)%n;
  const i=Math.floor(position),fraction=position-i,a=input[i]||0,b=circular?input[(i+1)%n]:(input[i+1]||0);
  return a+(b-a)*fraction;
}
function pitch(input,sampleRate,ratio,frames,loop){
  const out=new Float32Array(frames);
  if(!loop){for(let i=0;i<frames;i++)out[i]=interpolate(input,i*ratio);return out;}
  const cycles=Math.max(1,Math.round(input.length/(sampleRate*.073))),window=input.length/cycles,range=(1-ratio)*window;
  for(let i=0;i<frames;i++){
    const phase=((i/window)%1+1)%1,other=(phase+.5)%1;
    const a=.5-.5*Math.cos(TAU*phase),b=1-a;
    out[i]=interpolate(input,i-phase*range,true)*a+interpolate(input,i-other*range,true)*b;
  }
  return out;
}
function monoSource(channels){
  const n=channels[0].length,mono=new Float32Array(n);let sourceEnergy=0;
  for(const channel of channels)for(let i=0;i<n;i++){mono[i]+=channel[i]/channels.length;sourceEnergy+=channel[i]*channel[i]/channels.length;}
  const monoEnergy=sumEnergy(mono);
  return {channel:monoEnergy<sourceEnergy*.15?Float32Array.from(channels[0]):mono,usedReferenceChannel:monoEnergy<sourceEnergy*.15};
}
function envelope(channels,sampleRate,attack,release,loop=false){
  const n=channels[0].length,out=new Float32Array(n),a=Math.exp(-1/(sampleRate*attack)),r=Math.exp(-1/(sampleRate*release));let e=0;
  for(let pass=0;pass<(loop?3:1);pass++)for(let i=0;i<n;i++){
    let x=0;for(const channel of channels)x=Math.max(x,Math.abs(channel[i]));const k=x>e?a:r;e=k*e+(1-k)*x;
    if(!loop||pass===2)out[i]=e;
  }
  return out;
}
function allpass(input,delay,g,loop){
  const memory=new Float64Array(Math.max(1,delay)),out=new Float32Array(input.length);let cursor=0;
  const warm=loop?Math.max(2,Math.ceil(memory.length*6/input.length)):0;
  for(let pass=0;pass<=warm;pass++)for(let i=0;i<input.length;i++){
    const old=memory[cursor],y=old-g*input[i];memory[cursor]=input[i]+g*y;cursor=(cursor+1)%memory.length;
    if(pass===warm)out[i]=y;
  }
  return out;
}
function darkSpace(input,sampleRate,recipe,channelIndex){
  const n=input.length,out=new Float32Array(n),space=recipe.space,d=space.diffusion;
  for(const tap of space.earlyReflections){
    const delay=Math.max(1,Math.round(sampleRate*(tap.seconds+channelIndex*.00043)));
    for(let i=0;i<n;i++){const j=recipe.loop?((i-delay)%n+n)%n:i-delay;if(j>=0)out[i]+=input[j]*tap.gain;}
  }
  const damping=1-Math.exp(-TAU*d.dampingHz/sampleRate),warm=recipe.loop?Math.min(16,Math.max(2,Math.ceil(d.rt60Seconds*4*sampleRate/n))):0;
  for(let comb=0;comb<d.delaysSeconds.length;comb++){
    const seconds=d.delaysSeconds[comb]+channelIndex*.00071,delay=Math.max(1,Math.round(seconds*sampleRate)),memory=new Float64Array(delay);
    const feedback=Math.min(.84,10**(-3*seconds/d.rt60Seconds));let cursor=0,low=0;
    for(let pass=0;pass<=warm;pass++)for(let i=0;i<n;i++){
      const old=memory[cursor];low+=damping*(old-low);memory[cursor]=input[i]+low*feedback;cursor=(cursor+1)%delay;
      if(pass===warm)out[i]+=old*.18;
    }
  }
  let result=out;for(const seconds of d.allpassSeconds)result=allpass(result,Math.round(sampleRate*(seconds+channelIndex*.00023)),d.allpassFeedback,recipe.loop);
  return filter(result,sampleRate,'lowpass',d.dampingHz,Math.SQRT1_2,0,recipe.loop);
}
function seam(input,frames){
  const n=Math.min(Math.floor(input.length/4),Math.max(1,frames));
  for(let i=0;i<n;i++){const a=input[i],b=input[input.length-1-i],wet=.25*(1+Math.cos(Math.PI*i/n));input[i]=a*(1-wet)+b*wet;input[input.length-1-i]=b*(1-wet)+a*wet;}
}
function fade(input,sampleRate,recipe){
  const a=Math.min(Math.floor(input.length/3),Math.round(sampleRate*recipe.edgeFadeSeconds.in)),r=Math.min(Math.floor(input.length/3),Math.round(sampleRate*recipe.edgeFadeSeconds.out));
  for(let i=0;i<a;i++)input[i]*=Math.sin(Math.PI*.5*i/a)**2;
  for(let i=0;i<r;i++)input[input.length-1-i]*=Math.sin(Math.PI*.5*i/r)**2;
}
function measure(channels,sampleRate){
  let peak=0,energy=0,finite=true,seamDelta=0,dc=0,lowMidEnergy=0,lowEnergy=0;
  for(const channel of channels){
    for(const x of channel){if(!Number.isFinite(x)){finite=false;continue;}peak=Math.max(peak,Math.abs(x));energy+=x*x;dc+=x;}
    seamDelta=Math.max(seamDelta,Math.abs(channel[0]-channel[channel.length-1]));
    lowMidEnergy+=sumEnergy(filter(filter(channel,sampleRate,'highpass',100),sampleRate,'lowpass',350));
    lowEnergy+=sumEnergy(filter(filter(channel,sampleRate,'highpass',35),sampleRate,'lowpass',120));
  }
  const samples=channels.length*channels[0].length;
  return {peak,rms:Math.sqrt(energy/samples),energy,finite,seam:seamDelta,seamDelta,dc:dc/samples,
    frames:channels[0].length,channels:channels.length,duration:channels[0].length/sampleRate,
    lowMidEnergy,lowMidEnergyRatio:lowMidEnergy/Math.max(EPS,energy),lowEnergyRatio:lowEnergy/Math.max(EPS,energy),
    bandEstimator:'100–350 Hz / 35–120 Hz cascaded second-order Butterworth filters; energy proxies, not listening approval or a brick-wall integral'};
}

/** Lower the original material, reshape density, and add source-bound space. */
export function designGrand(input,asset={}){
  if(!input||!Number.isFinite(input.sampleRate)||input.sampleRate<8000||input.sampleRate>96000)throw new RangeError('Expected 8000–96000 Hz PCM');
  const supplied=input.channels,sampleRate=input.sampleRate;
  if(!Array.isArray(supplied)||supplied.length<1||supplied.length>2||!supplied[0]?.length||!supplied.every(c=>c?.length===supplied[0].length))throw new TypeError('Expected mono/stereo equal nonempty PCM arrays');
  for(const channel of supplied)for(const x of channel)if(!Number.isFinite(x))throw new TypeError('Non-finite source PCM');
  const recipe=recipeFor(asset),original=measure(supplied,sampleRate),sourceFrames=supplied[0].length;
  const pitchedFrames=recipe.loop?sourceFrames:Math.ceil(sourceFrames/recipe.pitchRatio),tailFrames=recipe.loop?0:Math.round(recipe.tailSeconds*sampleRate),frames=pitchedFrames+tailFrames;
  const pitched=supplied.map(c=>pitch(c,sampleRate,recipe.pitchRatio,frames,recipe.loop));
  const dry=pitched.map(c=>filter(filter(filter(c,sampleRate,'highpass',recipe.highpassHz,Math.SQRT1_2,0,recipe.loop),sampleRate,'lowpass',recipe.lowpassHz,Math.SQRT1_2,0,recipe.loop),sampleRate,'highshelf',recipe.highShelfHz,Math.SQRT1_2,recipe.highShelfDb,recipe.loop));
  const core=monoSource(dry),bodyRecipe=recipe.body;
  let body=filter(filter(core.channel,sampleRate,'highpass',bodyRecipe.highpassHz,Math.SQRT1_2,0,recipe.loop),sampleRate,'lowpass',bodyRecipe.lowpassHz,Math.SQRT1_2,0,recipe.loop);
  body=filter(body,sampleRate,'peaking',bodyRecipe.hz,bodyRecipe.q,bodyRecipe.peakingGainDb,recipe.loop);
  const sourceRms=Math.max(1e-8,original.rms),bodyEnvelope=envelope([body],sampleRate,bodyRecipe.envelopeAttackSeconds,bodyRecipe.envelopeReleaseSeconds,recipe.loop);
  for(let i=0;i<frames;i++){
    const level=Math.max(sourceRms*.45,bodyEnvelope[i]*.75),x=body[i]/level;
    // Soft-saturated original material fills body harmonics; no sine/sub note.
    body[i]=(body[i]*.45+Math.tanh(x*bodyRecipe.saturationDrive)*level*.55)*bodyRecipe.mix;
  }
  const mixed=dry.map(channel=>Float32Array.from(channel,(x,i)=>x+body[i]));
  const linkedEnvelope=envelope(mixed,sampleRate,recipe.dynamics.attackSeconds,recipe.dynamics.releaseSeconds,recipe.loop),threshold=sourceRms*recipe.dynamics.thresholdTimesSourceRms;
  let maximumGainReduction=1;
  const compressed=mixed.map(channel=>{
    const out=new Float32Array(frames);for(let i=0;i<frames;i++){
      const e=linkedEnvelope[i],gain=e>threshold?(e/threshold)**(1/recipe.dynamics.ratio-1):1;maximumGainReduction=Math.min(maximumGainReduction,gain);
      out[i]=Math.tanh(channel[i]*gain*recipe.dynamics.parallelWarmDrive)/recipe.dynamics.parallelWarmDrive;
    }return out;
  });
  const attackEnvelope=envelope(pitched,sampleRate,.0015,.024,recipe.loop),look=Math.max(1,Math.round(recipe.attack.lookbackSeconds*sampleRate));
  const wet=compressed.map((channel,c)=>{
    const roomInput=new Float32Array(frames);
    for(let i=0;i<frames;i++)roomInput[i]=body[i]*.70+channel[i]*.30;
    const room=darkSpace(roomInput,sampleRate,recipe,c),out=new Float32Array(frames);
    for(let i=0;i<frames;i++){
      const flux=Math.max(0,attackEnvelope[i]-attackEnvelope[recipe.loop?((i-look)%frames+frames)%frames:Math.max(0,i-look)]),gate=clamp(flux/(sourceRms*.65),0,1);
      out[i]=channel[i]+room[i]*recipe.space.mix+pitched[c][i]*recipe.attack.detailMix*gate;
    }
    const clean=filter(out,sampleRate,'highpass',35,Math.SQRT1_2,0,recipe.loop);
    if(recipe.loop)seam(clean,Math.round(recipe.seamSeconds*sampleRate));else fade(clean,sampleRate,recipe);
    return clean;
  });
  let wetPeak=0;for(const channel of wet)for(const x of channel)wetPeak=Math.max(wetPeak,Math.abs(x));
  const commonGain=wetPeak>1e-9?recipe.peak/wetPeak:1;
  for(const channel of wet)for(let i=0;i<frames;i++)channel[i]*=commonGain;
  const output=measure(wet,sampleRate);
  return {channels:wet,sampleRate,recipe,metrics:{original,output,sourceFrames,pitchedFrames,outputFrames:frames,tailSeconds:tailFrames/sampleRate,
    pitchRatio:recipe.pitchRatio,loop:recipe.loop,commonGain,peakBeforeSafetyGain:wetPeak,compressionMinimumGain:maximumGainReduction,
    bodyMonoReferenceFallback:core.usedReferenceChannel,sourceDerivedBody:true,addedOscillators:0,newGunshots:0,dialogue:0,music:0,
    rmsNormalization:false,approval:false,qualityClaim:'No human listening approval. Finite/peak/band measurements do not measure grandeur or cue identity.'}};
}
