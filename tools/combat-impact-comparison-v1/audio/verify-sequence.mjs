import fs from 'node:fs';
import assert from 'node:assert/strict';
import {decodeWav} from '../../audio/cinematic-v5/wav.mjs';
import {makeTape} from '../timeline.mjs';
const source=fs.readFileSync('tools/combat-impact-comparison-v1/audio/player.js','utf8');
const {mixSequencePCM,createComparisonAudio}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const output='outputs/combat-impact-comparison-v1/audio',assets=JSON.parse(fs.readFileSync(`${output}/assets.json`,'utf8')),checks=[];
function check(name,fn){fn();checks.push(name);}
function audioBuffer(w){return {numberOfChannels:w.channels.length,length:w.channels[0].length,sampleRate:w.sampleRate,getChannelData:c=>w.channels[c]};}
const loaded=new Map();for(const a of assets)for(const v of ['old','new','oldMatched','newMatched'])loaded.set(`${a.id}:${v}`,audioBuffer(decodeWav(fs.readFileSync(a[v]))));
const mixes=[];
for(const weapon of ['cannon','machinegun']){
 const tape=makeTape({weapon,muzzle:{position:[0,0,0],direction:[0,0,1]},miss:false}),cues=tape.events.map(e=>({id:`${e.type==='fire'?'fire':'impact'}-${weapon}`,time:e.time})),before=JSON.stringify(cues);
 for(const variant of ['old','new','oldMatched','newMatched'])for(const offset of [0,weapon==='cannon'?.7:.8,weapon==='cannon'?1.3:2.1]){
  const mixed=mixSequencePCM(cues,id=>loaded.get(`${id}:${variant}`),{offset,volume:.9});
  check(`${weapon}/${variant}/${offset} bound`,()=>{assert(mixed.maxOverlap<=4);assert(mixed.masterPeak<.92);assert(mixed.duration<=10);});
  // Independent direct event superposition, including a source sample cursor
  // inside events before offset. Compares the PCM, not just exported metadata.
  const reference=new Float64Array(mixed.frameCount);
  for(const cue of cues){const b=loaded.get(`${cue.id}:${variant}`),start=Math.round((cue.time-offset)*44100),a=b.getChannelData(0);for(let j=Math.max(0,-start);j<a.length&&j+start<reference.length;j++)reference[j+start]+=a[j]*.9;}
  let error=0;for(let i=0;i<reference.length;i++)error=Math.max(error,Math.abs(reference[i]-mixed.channels[0][i]));
  check(`${weapon}/${variant}/${offset} exact tail and volume`,()=>assert(error<2e-7));
  if(weapon==='machinegun'&&offset===0){const fire=mixed.eventIndices.filter(e=>e.id==='fire-machinegun');check(`${variant} ten sample-accurate shots`,()=>{assert.equal(fire.length,10);assert.equal(fire.at(-1).startFrame,87318);for(let j=1;j<10;j++)assert.equal(fire[j].startFrame-fire[j-1].startFrame,9702);});}
  if(offset>0)check(`${weapon}/${variant}/${offset} prior tail retained exactly when present`,()=>{const expected=cues.some(e=>e.time<offset&&e.time+loaded.get(`${e.id}:${variant}`).length/44100>offset);assert.equal(mixed.eventIndices.some(e=>e.startFrame<0),expected);});
  mixes.push({weapon,variant,offset,duration:mixed.duration,cueCount:mixed.cueCount,maxOverlap:mixed.maxOverlap,masterPeak:mixed.masterPeak});
 }
 check(`${weapon} inputs read only`,()=>assert.equal(JSON.stringify(cues),before));
}
check('reject more than32 cues',()=>assert.throws(()=>mixSequencePCM(Array.from({length:33},()=>({id:'fire-machinegun',time:0})),id=>loaded.get(`${id}:new`))));
check('reject oversized timeline',()=>assert.throws(()=>mixSequencePCM([{id:'fire-cannon',time:9.5}],id=>loaded.get(`${id}:new`))));
check('reject five overlapping tails',()=>assert.throws(()=>mixSequencePCM(Array.from({length:5},()=>({id:'fire-machinegun',time:0})),id=>loaded.get(`${id}:new`))));
check('reject invalid offset',()=>assert.throws(()=>mixSequencePCM([],()=>null,{offset:-1})));
check('empty past sequence',()=>assert.equal(mixSequencePCM([{id:'fire-machinegun',time:0}],id=>loaded.get(`${id}:new`),{offset:3}).frameCount,0));
let contexts=0,started=[],decoded=0;
class Gain{constructor(){this.gain={value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}};}connect(){}disconnect(){}}
class Source{connect(){}disconnect(){}start(t){started.push({t,buffer:this.buffer});}stop(t){this.stopAt=t;}}
class Context{constructor(){contexts++;this.currentTime=3;this.sampleRate=44100;this.state='suspended';this.destination={};}createGain(){return new Gain();}createBufferSource(){return new Source();}createBuffer(c,n,sr){return audioBuffer({channels:Array.from({length:c},()=>new Float32Array(n)),sampleRate:sr});}async resume(){this.state='running';}async decodeAudioData(){decoded++;return audioBuffer({channels:[new Float32Array(8820).fill(.1),new Float32Array(8820).fill(.1)],sampleRate:44100});}async close(){this.state='closed';}}
globalThis.AudioContext=Context;
const data=Object.fromEntries(assets.map(a=>[a.id,Object.fromEntries(['old','new','oldMatched','newMatched'].map(v=>[v,'AA==']))])),player=createComparisonAudio(data);
const cues=Array.from({length:10},(_,i)=>({id:'fire-machinegun',time:i*.22}));
const result=await player.playSequence(cues,'new');
check('one absolute scheduled source for ten cues',()=>{assert.equal(result.ok,true);assert.equal(result.cueCount,10);assert.equal(started.length,1);assert.equal(started[0].t,3.02);assert.equal(contexts,1);assert.equal(decoded,16);});
assert.equal(await player.play('fire-machinegun','new'),false);
check('individual cue suppressed during sequence',()=>assert.equal(started.length,1));
const busy=await player.playSequence(cues,'old');check('concurrent sequence rejected',()=>assert.equal(busy.reason,'busy'));
player.stop();const pending=player.playSequence(cues,'old');player.stop();const cancelled=await pending;check('pending sequence cancelled by stop',()=>{assert.equal(cancelled.ok,false);assert.equal(started.length,1);});
const resumed=await player.playSequence(cues,'old',{offset:.3});check('resumed includes prior tail and new schedule',()=>{assert.equal(resumed.ok,true);assert(resumed.eventIndices.some(e=>e.startFrame<0));assert.equal(started.length,2);});
player.dispose();assert.equal((await player.playSequence(cues,'new')).ok,false);await new Promise(r=>setTimeout(r,20));
check('dispose clears sequence buffers and sources',()=>{assert.equal(player.debug().activeVoices,0);assert.equal(player.debug().decodedBuffers,0);assert.equal(player.debug().state,'closed');});
const report={passed:true,checks,checkCount:checks.length,mixes,browserOrNative:false,humanListeningApproval:false,source:'sample-accurate offline PCM plus fake scheduling/lifecycle; actual output remains central Native QA'};
fs.writeFileSync(`${output}/sequence-verification.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,mixes:mixes.length}));
