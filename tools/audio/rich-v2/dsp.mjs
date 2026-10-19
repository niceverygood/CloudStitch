/**
 * Cloudstitch rich-v2: stronger low-mid body on preserved rich-v1 PCM.
 * Pure deterministic EQ. No file I/O, oscillators, event changes or codecs.
 * No RMS/energy normalization: only a shared downward gain for peak headroom.
 */
export const DSP_VERSION='cloudstitch-low-mid-dsp-v2.0.0';
const TAU=2*Math.PI,EPS=1e-24;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const energy=channel=>{let sum=0;for(const x of channel)sum+=x*x;return sum;};

// Broad physical body bands, not musical notes. UI/warnings use lighter,
// slightly higher bands so their existing recognition contour remains present.
const MATERIALS={
  pressure:{hz:195,gainDb:4.7,q:.76,shelfHz:95,shelfDb:2.3,label:'포신·압력의 중저음 몸통'},
  wood:{hz:218,gainDb:4.6,q:.74,shelfHz:98,shelfDb:2.05,label:'목재 선체·받침의 단단한 몸통'},
  brass:{hz:275,gainDb:4.0,q:.78,shelfHz:108,shelfDb:1.7,label:'황동·금속 작동음의 중저음 두께'},
  engine:{hz:185,gainDb:4.65,q:.72,shelfHz:96,shelfDb:2.3,label:'엔진·기계 압력의 따뜻한 두께'},
  cloth:{hz:292,gainDb:3.6,q:.70,shelfHz:115,shelfDb:1.4,label:'천·바람 마찰의 부드러운 몸통'},
  warning:{hz:322,gainDb:3.25,q:.72,shelfHz:116,shelfDb:1.25,label:'경고 식별음을 유지하는 중저음 받침'},
  ui:{hz:320,gainDb:3.15,q:.75,shelfHz:118,shelfDb:1.15,label:'작은 조작음의 또렷한 중저음 두께'}
};
const OVERRIDES={
  'fire-machinegun':{hz:218,gainDb:4.6,shelfHz:100,shelfDb:2.1},
  'fire-cannon':{hz:156,gainDb:5,shelfHz:90,shelfDb:2.5},
  'fire-mortar':{hz:188,gainDb:4.9,shelfHz:95,shelfDb:2.35},
  'mortar-launch-a':{hz:198,gainDb:4.8,shelfHz:96,shelfDb:2.3},
  'mortar-launch-b':{hz:177,gainDb:4.9,shelfHz:94,shelfDb:2.4},
  'mortar-impact':{hz:148,gainDb:5,shelfHz:90,shelfDb:2.5},
  'hit-wood':{hz:228,gainDb:4.8,shelfHz:98,shelfDb:2.15},
  'hit-cloth':{hz:286,gainDb:3.7,shelfHz:114,shelfDb:1.4},
  'hit-armor':{hz:286,gainDb:4.3,shelfHz:108,shelfDb:1.85},
  'hit-engine':{hz:179,gainDb:4.9,shelfHz:94,shelfDb:2.35},
  'cargo-drop':{hz:202,gainDb:4.75,shelfHz:96,shelfDb:2.2},
  'bundle-detach':{hz:220,gainDb:4.6,shelfHz:99,shelfDb:2.0},
  'engine-idle-loop':{hz:165,gainDb:4.8,shelfHz:92,shelfDb:2.4},
  'engine-cruise-loop':{hz:194,gainDb:4.8,shelfHz:96,shelfDb:2.35},
  'wind-calm-loop':{hz:276,gainDb:3.6,shelfHz:115,shelfDb:1.35},
  'wind-fast-loop':{hz:260,gainDb:3.85,shelfHz:112,shelfDb:1.5},
  'hull-creak-loop':{hz:207,gainDb:4.7,shelfHz:98,shelfDb:2.05},
  'lift-danger-loop':{hz:310,gainDb:3.3,shelfHz:116,shelfDb:1.3},
  'incoming-warning':{hz:330,gainDb:3.15,shelfHz:118,shelfDb:1.2},
  'ui-hover':{hz:337,gainDb:3.05,shelfHz:118,shelfDb:1.15}
};
function materialFor(asset,id){
  const category=asset.category||'';
  if(category==='warning'||/warning|danger|^defeat$/.test(id))return 'warning';
  if(category==='ui'||/^ui-|^(?:save|restore)-ok$/.test(id))return 'ui';
  if(/cloth|wind|mortar-fall/.test(id))return 'cloth';
  if(/wood|cargo|hull|bundle|module/.test(id))return 'wood';
  if(/engine|flame|winch/.test(id))return 'engine';
  if(/cannon|mortar|fire-machinegun/.test(id))return 'pressure';
  return 'brass';
}
function recipeFor(asset={}){
  if(typeof asset==='string')asset={id:asset};
  const id=String(asset?.id||'unidentified-cue'),material=materialFor(asset||{},id);
  const body={...MATERIALS[material],...(OVERRIDES[id]||{})};
  const loop=asset?.loop===true||/(?:^|-)loop$/.test(id);
  return {version:DSP_VERSION,id,material,loop,description:body.label,
    input:'preserved rich-v1 enhanced PCM; no replacement or regeneration',
    highpass:{type:'highpass',hz:35,q:Math.SQRT1_2},
    lowShelf:{type:'lowshelf',hz:body.shelfHz,gainDb:body.shelfDb,slope:1},
    lowMidBody:{type:'peaking',hz:body.hz,gainDb:body.gainDb,q:body.q},
    targetPeak:.74,upwardNormalization:false,rmsNormalization:false,
    tailSeconds:0,frameCountPolicy:'exact input frames and channels',
    loopWarmSeconds:.6,seamSeconds:.005,edgeFadeSeconds:{in:.001,out:.006},
    claims:'EQ candidate; human listening approval and game installation pending'};
}

function coefficients(type,sampleRate,hz,{q=Math.SQRT1_2,gainDb=0,slope=1}={}){
  const w=TAU*clamp(hz,5,sampleRate*.44)/sampleRate,c=Math.cos(w),s=Math.sin(w);
  const a=s/(2*q),A=10**(gainDb/40);let b0,b1,b2,a0,a1,a2;
  if(type==='highpass'){
    b0=(1+c)/2;b1=-(1+c);b2=b0;a0=1+a;a1=-2*c;a2=1-a;
  }else if(type==='lowpass'){
    b0=(1-c)/2;b1=1-c;b2=b0;a0=1+a;a1=-2*c;a2=1-a;
  }else if(type==='peaking'){
    b0=1+a*A;b1=-2*c;b2=1-a*A;a0=1+a/A;a1=-2*c;a2=1-a/A;
  }else if(type==='lowshelf'){
    const shelfAlpha=s/2*Math.sqrt((A+1/A)*(1/slope-1)+2),root=2*Math.sqrt(A)*shelfAlpha;
    b0=A*((A+1)-(A-1)*c+root);b1=2*A*((A-1)-(A+1)*c);b2=A*((A+1)-(A-1)*c-root);
    a0=(A+1)+(A-1)*c+root;a1=-2*((A-1)+(A+1)*c);a2=(A+1)+(A-1)*c-root;
  }else throw new Error('Unknown filter type');
  return [b0/a0,b1/a0,b2/a0,a1/a0,a2/a0];
}
function filter(channel,sampleRate,config,loop=false,warmSeconds=.6){
  const [b0,b1,b2,a1,a2]=coefficients(config.type,sampleRate,config.hz,config);
  const output=new Float32Array(channel.length);let z1=0,z2=0;
  const warm=loop?Math.min(32,Math.max(2,Math.ceil(sampleRate*warmSeconds/channel.length))):0;
  for(let pass=0;pass<=warm;pass++)for(let i=0;i<channel.length;i++){
    const y=b0*channel[i]+z1;z1=b1*channel[i]-a1*y+z2;z2=b2*channel[i]-a2*y;
    if(pass===warm)output[i]=y;
  }
  return output;
}
function seam(channel,frames){
  const n=Math.min(Math.floor(channel.length/4),Math.max(1,frames));
  for(let i=0;i<n;i++){
    const a=channel[i],b=channel[channel.length-1-i],wet=.25*(1+Math.cos(Math.PI*i/n));
    channel[i]=a*(1-wet)+b*wet;channel[channel.length-1-i]=b*(1-wet)+a*wet;
  }
}
function fade(channel,sampleRate,config){
  const n=channel.length,attack=Math.min(Math.floor(n/3),Math.max(2,Math.round(config.in*sampleRate))),
    release=Math.min(Math.floor(n/3),Math.max(2,Math.round(config.out*sampleRate)));
  for(let i=0;i<attack;i++)channel[i]*=Math.sin(Math.PI*.5*i/attack)**2;
  for(let i=0;i<release;i++)channel[n-1-i]*=Math.sin(Math.PI*.5*i/release)**2;
}

function bandEnergy(channels,sampleRate,lo,hi){
  let sum=0;
  for(const channel of channels){
    const low=filter(channel,sampleRate,{type:'highpass',hz:lo});
    sum+=energy(filter(low,sampleRate,{type:'lowpass',hz:hi}));
  }
  return sum;
}
function measure(channels,sampleRate){
  let peak=0,totalEnergy=0,finite=true,seamDelta=0,dc=0;
  for(const channel of channels){
    for(const x of channel){if(!Number.isFinite(x)){finite=false;continue;}peak=Math.max(peak,Math.abs(x));totalEnergy+=x*x;dc+=x;}
    seamDelta=Math.max(seamDelta,Math.abs(channel[0]-channel[channel.length-1]));
  }
  const samples=channels.length*channels[0].length;
  const bands={};
  for(const [name,lo,hi]of [['low35_120',35,120],['lowMid100_350',100,350],['lowMid120_350',120,350],['presence350_2000',350,2000]]){
    const e=bandEnergy(channels,sampleRate,lo,hi);
    bands[name]={energy:e,rms:Math.sqrt(e/samples),energyRatio:e/Math.max(EPS,totalEnergy)};
  }
  return {peak,rms:Math.sqrt(totalEnergy/samples),energy:totalEnergy,finite,seam:seamDelta,seamDelta,
    dc:dc/samples,frames:channels[0].length,channels:channels.length,duration:channels[0].length/sampleRate,
    bands,lowMidEnergy:bands.lowMid100_350.energy,lowMidEnergyRatio:bands.lowMid100_350.energyRatio,
    lowEnergyRatio:bands.low35_120.energyRatio,
    bandEstimator:'Cascaded second-order Butterworth highpass(lo) and lowpass(hi), zero initial state; energy proxy, not brick-wall spectral integration or LUFS.'};
}

/**
 * @param {{channels:Array<Float32Array>,sampleRate:number}} input
 * @param {{id?:string,category?:string,loop?:boolean}|string} asset
 * @returns {{channels:Array<Float32Array>,sampleRate:number,recipe:object,metrics:object}}
 */
export function enhanceLowMid(input,asset={}){
  if(!input||!Number.isFinite(input.sampleRate)||input.sampleRate<8000||input.sampleRate>96000)
    throw new RangeError('Expected 8000–96000 Hz PCM');
  const channels=input.channels,sampleRate=input.sampleRate;
  if(!Array.isArray(channels)||channels.length<1||channels.length>2||!channels[0]?.length
      ||!channels.every(channel=>channel?.length===channels[0].length))throw new TypeError('Expected one/two equal nonempty PCM channels');
  for(const channel of channels)for(const x of channel)if(!Number.isFinite(x))throw new TypeError('Non-finite input PCM');
  const recipe=recipeFor(asset),original=measure(channels,sampleRate);
  const outputChannels=channels.map(channel=>{
    // Copies and separate filter states preserve source buffers and stereo.
    let out=filter(channel,sampleRate,recipe.highpass,recipe.loop);
    out=filter(out,sampleRate,recipe.lowShelf,recipe.loop);
    out=filter(out,sampleRate,recipe.lowMidBody,recipe.loop);
    if(recipe.loop)seam(out,Math.round(recipe.seamSeconds*sampleRate));
    else fade(out,sampleRate,recipe.edgeFadeSeconds);
    return out;
  });
  let wetPeak=0;
  for(const channel of outputChannels)for(const x of channel)wetPeak=Math.max(wetPeak,Math.abs(x));
  const commonGain=wetPeak>EPS?Math.min(1,recipe.targetPeak/wetPeak):1;
  for(const channel of outputChannels)for(let i=0;i<channel.length;i++)channel[i]*=commonGain;
  const output=measure(outputChannels,sampleRate);
  const ratioChange=(key)=>output.bands[key].energyRatio/Math.max(EPS,original.bands[key].energyRatio);
  return {channels:outputChannels,sampleRate,recipe,metrics:{original,output,
    commonGain,gainReductionDb:20*Math.log10(commonGain),eqPeakBeforeSafetyGain:wetPeak,
    energyNormalized:false,upwardNormalized:false,addedOscillators:0,tailSeconds:0,
    originalFrames:channels[0].length,outputFrames:outputChannels[0].length,
    lowMid100_350RatioIncrease:ratioChange('lowMid100_350'),lowMid120_350RatioIncrease:ratioChange('lowMid120_350'),
    low35_120RatioIncrease:ratioChange('low35_120'),
    outputRmsRelativeToInput:output.rms/Math.max(EPS,original.rms),
    note:'Relative band energy reveals EQ change even when peak safety attenuation lowers overall RMS. Human listening and game mix approval pending.'}};
}
