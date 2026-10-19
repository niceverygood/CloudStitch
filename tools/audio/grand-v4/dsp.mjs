/** Cloudstitch grand-v4: actual source-material composition.
 * base-dsp.mjs is the byte-exact frozen grand-v3 source. Original raw decoded
 * PCM is the input. New layers are short fragments from the supplied original
 * material library, not copied gunshots, oscillators, beats, music or gain x10.
 */
import {designGrand as designBase} from './base-dsp.mjs';
export const DSP_VERSION='cloudstitch-grand-composition-v4.0.0';
const TAU=2*Math.PI,EPS=1e-24;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const energy=a=>{let s=0;for(const x of a)s+=x*x;return s;};
function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function at(a,p,loop=false){if(loop)p=((p%a.length)+a.length)%a.length;else if(p<0||p>=a.length)return 0;const i=Math.floor(p),f=p-i;return a[i]+((loop?a[(i+1)%a.length]:(a[i+1]||0))-a[i])*f;}
function filter(a,sr,type,hz,q=Math.SQRT1_2,loop=false){
  const w=TAU*clamp(hz,5,sr*.44)/sr,c=Math.cos(w),alpha=Math.sin(w)/(2*q),a0=1+alpha;
  const b0=(type==='highpass'?(1+c):(1-c))/2/a0,b1=(type==='highpass'?-(1+c):(1-c))/a0,b2=b0,a1=-2*c/a0,a2=(1-alpha)/a0;
  const out=new Float32Array(a.length);let z1=0,z2=0;const warm=loop?Math.min(20,Math.max(2,Math.ceil(sr*.5/a.length))):0;
  for(let p=0;p<=warm;p++)for(let i=0;i<a.length;i++){const y=b0*a[i]+z1;z1=b1*a[i]-a1*y+z2;z2=b2*a[i]-a2*y;if(p===warm)out[i]=y;}
  return out;
}
function mono(channels){const n=channels[0].length,out=new Float32Array(n);let e=0;for(const c of channels)for(let i=0;i<n;i++){out[i]+=c[i]/channels.length;e+=c[i]*c[i]/channels.length;}return energy(out)<e*.12?Float32Array.from(channels[0]):out;}
function onset(channels,sr){
  let peak=0;for(const c of channels)for(const x of c)peak=Math.max(peak,Math.abs(x));if(peak<1e-10)return 0;
  let e=0;const smooth=Math.exp(-1/(sr*.0007));
  for(let i=0;i<channels[0].length;i++){let x=0;for(const c of channels)x=Math.max(x,Math.abs(c[i]));e=smooth*e+(1-smooth)*x;if(e>peak*.10)return Math.max(0,i/sr-.001);}
  return 0;
}
function inspect(channels,sr){
  let peak=0,e=0,finite=true,seam=0,lowMid=0,low=0;
  for(const c of channels){for(const x of c){finite&&=Number.isFinite(x);peak=Math.max(peak,Math.abs(x));e+=x*x;}seam=Math.max(seam,Math.abs(c[0]-c[c.length-1]));lowMid+=energy(filter(filter(c,sr,'highpass',100),sr,'lowpass',350));low+=energy(filter(filter(c,sr,'highpass',35),sr,'lowpass',120));}
  return {peak,rms:Math.sqrt(e/(channels.length*channels[0].length)),energy:e,finite,seam,seamDelta:seam,frames:channels[0].length,channels:channels.length,duration:channels[0].length/sr,
    lowMidEnergyRatio:lowMid/Math.max(EPS,e),lowEnergyRatio:low/Math.max(EPS,e),bandEstimator:'Cascaded 2nd-order 100–350 / 35–120 Hz Butterworth energy proxies; no grandeur or human listening approval'};
}
function stem(id,role,fragmentSeconds,rate,mix,lowpassHz,highpassHz=40,offset=0){return {id,role,fragmentSeconds,rate,mix,lowpassHz,highpassHz,relativeContactOffsetSeconds:offset};}
function plan(asset,baseRecipe){
  const id=String(asset.id||''),category=asset.category||'',loop=baseRecipe.loop;
  let kind='mechanism',extraTailSeconds=.22,space=.38,mainMix=1;
  let stems=[stem('hit-wood','enclosed timber body',.09,.67,.58,1050),stem('hit-armor','brass mechanism core',.07,.73,.48,1800,180,.003),stem('hull-creak-loop','dark enclosure residue',.16,.72,.29,850,65,.032)];
  if(loop){
    kind='continuous material depth';extraTailSeconds=0;space=.40;
    stems=[stem('wind-calm-loop','broad source-noise air layer',1,.76,.47,2000,100),stem('hull-creak-loop','continuous timber enclosure',1,.67,.52,1050,55),stem('engine-idle-loop','low mechanical body texture',1,.69,.52,580,40)];
    if(/wind/.test(id)){stems[0].mix=.75;stems[1].mix=.32;stems[2].mix=.22;}
    if(/warning|danger/.test(id)){stems[0].mix=.22;stems[1].mix=.40;stems[2].mix=.32;space=.27;}
  }else if(id==='fire-machinegun'){
    kind='single contact: pressure / timber mount / brass action';extraTailSeconds=.075;space=.27;
    stems=[stem('mortar-impact','short pressure core only',.080,.63,.68,440,42),stem('hit-wood','timber mount recoil',.065,.72,.58,1200,85,.002),stem('hit-armor','brass action contact',.036,.82,.43,2200,280,.004),stem('hit-engine','compressed mechanism body',.052,.67,.34,720,65,.001)];
  }else if(/fire-cannon|mortar-impact/.test(id)){
    kind='large pressure / material rupture / sustained recoil';extraTailSeconds=.62;space=.68;mainMix=.98;
    stems=[stem('mortar-impact','large low pressure mass',.25,.47,1.20,620,36),stem('hit-wood','timber carriage rupture',.17,.55,.83,1650,75,.004),stem('hit-armor','brass restraint strain',.115,.61,.58,2200,160,.008),stem('hit-engine','dense recoil machinery',.22,.50,.67,1000,45,.003),stem('wind-fast-loop','pressure exhaust and dispersed residue',.38,.66,.43,1900,110,.060)];
  }else if(/fire-mortar|mortar-launch-/.test(id)){
    kind='one mortar launch: pressure / mount / dense exhaust';extraTailSeconds=.47;space=.55;
    stems=[stem('mortar-impact','short tube pressure mass',.19,.53,1.02,620,40),stem('hit-wood','mount recoil body',.12,.61,.73,1400,80,.003),stem('hit-armor','tube restraint material',.075,.66,.45,1900,180,.006),stem('wind-fast-loop','low exhaust texture',.23,.66,.36,1550,130,.034)];
  }else if(/hit-wood|cargo-drop|module-break|bundle-detach/.test(id)){
    kind='wood contact / structural body / dispersed fragments';extraTailSeconds=.35;space=.48;
    stems=[stem('hit-wood','low timber contact mass',.15,.54,.99,1400,45),stem('hit-engine','structural pressure under impact',.105,.56,.56,650,40),stem('hit-armor','small fastener strain',.055,.72,.31,2100,250,.005),stem('hull-creak-loop','wood grain and enclosure decay',.25,.64,.50,1100,65,.035)];
  }else if(/hit-armor|hit-engine|fire-chain|fire-harpoon|harpoon-embed/.test(id)){
    kind='solid contact / machinery / material strain';extraTailSeconds=.37;space=.49;
    stems=[stem('hit-engine','machine enclosure mass',.16,.55,.85,880,40),stem('hit-armor','heavy brass/armor contact',.10,.59,.77,2200,140,.002),stem('hit-wood','embedded timber support',.095,.63,.55,1350,75,.004),stem('chain-spin','granular metal residue only',.16,.67,.30,1900,280,.040)];
  }else if(category==='ui'||/^ui-|save-ok|restore-ok/.test(id)){
    kind='miniature physical click: dense timber / brass';extraTailSeconds=id==='ui-hover'?.025:.065;space=.16;
    stems=[stem('hit-wood','miniature timber click body',.030,.82,.43,1800,160),stem('hit-armor','miniature brass contact',.022,.91,.30,2600,450,.001),stem('hull-creak-loop','small enclosed material tail',.045,.82,.16,1300,160,.009)];
  }else if(category==='warning'||/warning|danger|^defeat$/.test(id)){
    kind='recognition contour with physical weight';extraTailSeconds=id==='defeat'?.36:.14;space=id==='defeat'?.48:.25;mainMix=1.12;
    stems=[stem('hit-engine','low warning enclosure body',.085,.68,.45,600,55),stem('hit-wood','solid warning contact',.055,.75,.31,1400,150,.002),stem('wind-calm-loop','dark warning space texture',.12,.78,.21,1500,160,.025)];
  }else if(id==='return'||category==='harbor'){
    kind='large physical mechanism / timber enclosure / warm air';extraTailSeconds=.33;space=.47;
    stems=[stem('hit-wood','solid harbor mechanism body',.10,.64,.64,1300,65),stem('hit-armor','brass latch weight',.07,.70,.43,1900,200,.003),stem('hull-creak-loop','large timber enclosure',.26,.61,.46,950,60,.020),stem('wind-calm-loop','broad surrounding air',.23,.72,.29,1800,140,.035)];
  }
  return {kind,extraTailSeconds,space,mainMix,stems};
}
function softEdges(a,sr,attack=.002,release=.012){
  const n=a.length,A=Math.min(Math.floor(n/3),Math.max(1,Math.round(attack*sr))),R=Math.min(Math.floor(n/3),Math.max(1,Math.round(release*sr)));
  for(let i=0;i<A;i++)a[i]*=Math.sin(Math.PI*.5*i/A)**2;
  for(let i=0;i<R;i++)a[n-1-i]*=Math.sin(Math.PI*.5*i/R)**2;
}
function seamless(a,sr){const n=Math.min(Math.floor(a.length/4),Math.round(sr*.008));for(let i=0;i<n;i++){const x=a[i],y=a[a.length-1-i],w=.25*(1+Math.cos(Math.PI*i/n));a[i]=x*(1-w)+y*w;a[a.length-1-i]=y*(1-w)+x*w;}}

function fragment(entry,spec,sr,outputFrames,loop,sourceRms,seed){
  const source=mono(entry.channels),sourceOnset=onset(entry.channels,entry.sampleRate);
  const texture=/texture|residue|grain|decay|air|enclosure/.test(spec.role)&&!/contact|mass/.test(spec.role);
  const start=loop?(source.length/entry.sampleRate)*(.12+(seed%19)/100):sourceOnset+(texture?.055:0);
  const sourceFrames=Math.max(1,Math.round(spec.fragmentSeconds*entry.sampleRate));
  const n=loop?outputFrames:Math.max(8,Math.ceil(sourceFrames/spec.rate*sr/entry.sampleRate));
  const raw=new Float32Array(n);
  for(let i=0;i<n;i++)raw[i]=at(source,start*entry.sampleRate+i*entry.sampleRate/sr*spec.rate,loop);
  let out=filter(filter(raw,sr,'highpass',spec.highpassHz,Math.SQRT1_2,loop),sr,'lowpass',spec.lowpassHz,Math.SQRT1_2,loop);
  let peak=0;for(const x of out)peak=Math.max(peak,Math.abs(x));
  const rms=Math.sqrt(energy(out)/Math.max(1,n));
  const scale=loop?Math.min(8,Math.max(sourceRms,.015)*.85/Math.max(rms,1e-8)):(peak>1e-8?.70/peak:0);
  for(let i=0;i<n;i++)out[i]=Math.tanh(out[i]*scale*1.7)/1.7;
  if(loop)seamless(out,sr);else{
    softEdges(out,sr,texture?.005:.0015,texture?.028:.014);
    // A single attack decays into the same material contact. No fragment is
    // restarted later or arranged on a firing / music timeline.
    for(let i=0;i<n;i++)out[i]*=(1-.45*i/Math.max(1,n-1));
  }
  return {channel:out,startSeconds:start,onsetSeconds:sourceOnset,rawFrames:sourceFrames,renderedFrames:n,sourcePeak:peak};
}

function allpass(a,delay,g,loop){const memory=new Float64Array(Math.max(1,delay)),out=new Float32Array(a.length);let cursor=0;const warm=loop?Math.max(2,Math.ceil(delay*8/a.length)):0;for(let p=0;p<=warm;p++)for(let i=0;i<a.length;i++){const old=memory[cursor],y=old-g*a[i];memory[cursor]=a[i]+g*y;cursor=(cursor+1)%memory.length;if(p===warm)out[i]=y;}return out;}
function space(a,sr,loop,seed,channel,heavy){
  const input=filter(a,sr,'lowpass',heavy?1700:2400,Math.SQRT1_2,loop),out=new Float32Array(a.length);
  const delays=[.037,.049,.067,.089,.107,.131],rt60=heavy?1.05:.44,warm=loop?Math.min(12,Math.max(2,Math.ceil(rt60*3*sr/a.length))):0;
  for(let k=0;k<delays.length;k++){
    const seconds=delays[k]+((seed>>>(k*4))%5)*.00051+channel*.00063,memory=new Float64Array(Math.max(1,Math.round(seconds*sr))),feedback=Math.min(.86,10**(-3*seconds/rt60)),damp=1-Math.exp(-TAU*(heavy?1450:2200)/sr);let cursor=0,low=0;
    for(let p=0;p<=warm;p++)for(let i=0;i<a.length;i++){const old=memory[cursor];low+=damp*(old-low);memory[cursor]=input[i]+low*feedback;cursor=(cursor+1)%memory.length;if(p===warm)out[i]+=old/6;}
  }
  let result=out;for(const seconds of [.0067,.0113,.0197,.0299])result=allpass(result,Math.round(sr*(seconds+channel*.00013)),.55,loop);
  return filter(result,sr,'highpass',40,Math.SQRT1_2,loop);
}

/** Actual original material library composition above the frozen v3 design. */
export function designGrand(input,asset={},options={}){
  const a=typeof asset==='string'?{id:asset}:(asset||{}),library=options?.library||{};
  const base=designBase(input,a),sr=input.sampleRate,loop=base.recipe.loop,design=plan(a,base.recipe),seed=hash(String(a.id||''));
  const baseFrames=base.channels[0].length,extraTailFrames=loop?0:Math.round(design.extraTailSeconds*sr),frames=baseFrames+extraTailFrames;
  const contact=loop?0:onset(input.channels,sr)/base.recipe.pitchRatio;
  const channels=base.channels.map(c=>{const out=new Float32Array(frames);for(let i=0;i<c.length;i++)out[i]=c[i]*design.mainMix;return out;});
  const stems=[],dependencies=[],sourceRms=base.metrics.original.rms;
  for(let index=0;index<design.stems.length;index++){
    const spec=design.stems[index];
    if(/^fire-/.test(spec.id))throw new Error('Whole gunshot donors are not allowed');
    if(base.metrics.original.peak<1e-9){stems.push({...spec,offsetSeconds:0,status:'skipped: silent primary source',sourceSha256:null});continue;}
    const entry=library[spec.id];
    if(!entry||!Array.isArray(entry.channels)||!entry.channels.length||!Number.isFinite(entry.sampleRate)){
      stems.push({...spec,offsetSeconds:contact+spec.relativeContactOffsetSeconds,status:'missing material; not substituted',sourceSha256:null});continue;
    }
    const rendered=fragment(entry,spec,sr,frames,loop,sourceRms,seed+index*79),offsetSeconds=loop?0:contact+spec.relativeContactOffsetSeconds,offset=Math.round(offsetSeconds*sr);
    for(let c=0;c<channels.length;c++)for(let i=0;i<rendered.channel.length&&i+offset<frames;i++)channels[c][i+offset]+=rendered.channel[i]*spec.mix;
    stems.push({...spec,fragmentSeconds:loop?frames/sr*spec.rate:spec.fragmentSeconds,
      fragmentMode:loop?'continuous circular source texture':'single extracted material contact or residue',
      offsetSeconds,sourceStartSeconds:rendered.startSeconds,donorOnsetSeconds:rendered.onsetSeconds,renderedFrames:rendered.renderedFrames,
      sourceSha256:entry.sha256||null,sourcePath:entry.path||null,sourceSampleRate:entry.sampleRate,sourceFrames:entry.channels[0].length,status:'composed source-material fragment',monoCore:true});
    dependencies.push({id:spec.id,sha256:entry.sha256||null,path:entry.path||null,role:spec.role,sourceSampleRate:entry.sampleRate,sourceFrames:entry.channels[0].length});
  }
  const core=mono(channels),roomInput=filter(core,sr,'lowpass',1350,Math.SQRT1_2,loop),heavy=design.space>=.45;
  const result=channels.map((channel,c)=>{
    const room=space(roomInput,sr,loop,seed,c,heavy),out=new Float32Array(frames);
    for(let i=0;i<frames;i++){
      const x=channel[i]+room[i]*design.space;
      // Parallel dense material saturation, not a gain multiplier. Components
      // retain one contact and diffuse into a large dark surrounding space.
      out[i]=x*.68+Math.tanh(x*1.8)/1.8*.32;
    }
    const clean=filter(out,sr,'highpass',35,Math.SQRT1_2,loop);
    if(loop)seamless(clean,sr);else softEdges(clean,sr,.0015,.016);
    return clean;
  });
  let peak=0;for(const c of result)for(const x of c)peak=Math.max(peak,Math.abs(x));const commonGain=peak>1e-9?.71/peak:1;
  for(const c of result)for(let i=0;i<c.length;i++)c[i]*=commonGain;
  const output=inspect(result,sr),metadata={library:dependencies,addedGunshots:0,qualityPending:true,approval:false,dialogue:0,music:0};
  const recipe={version:DSP_VERSION,id:String(a.id||''),loop,baseRecipe:base.recipe,description:design.kind,
    pitchRatio:base.recipe.pitchRatio,extraTailSeconds:loop?0:design.extraTailSeconds,mainMix:design.mainMix,stems,
    stages:['original source contact and lowered physical material','aligned pressure / timber / brass or machine fragment composition','source-derived recoil / residue','dense dark diffusion space'],
    space:{mix:design.space,large:heavy,rt60Seconds:heavy?1.05:.44,sourceDerived:true,independentBeats:0},
    peak:.71,midLowMono:true,addedGunshots:0,addedOscillators:0,dialogue:0,music:0,qualityPending:true,approval:false,
    claim:'A bolder material composition candidate. No numerical claim of 10x grandeur or human approval.'};
  return {channels:result,sampleRate:sr,recipe,metadata,metrics:{original:base.metrics.original,processing:base.metrics.original,output,
    baseFrames,expectedFrames:frames,sourceFrames:input.channels[0].length,pitchedFrames:base.metrics.pitchedFrames,outputFrames:frames,
    extraTailSeconds:extraTailFrames/sr,tailSeconds:base.metrics.tailSeconds+extraTailFrames/sr,pitchRatio:base.recipe.pitchRatio,loop,
    commonGain,peakBeforeSafetyGain:peak,library:dependencies,composedStems:stems.filter(s=>s.status==='composed source-material fragment').length,
    missingStems:stems.filter(s=>s.status.startsWith('missing')).map(s=>s.id),addedGunshots:0,addedOscillators:0,dialogue:0,music:0,qualityPending:true,approval:false,
    note:'All stems are original supplied PCM fragments. Numeric safety does not approve scale, realism, cue identity or the requested dramatic change.'}};
}
