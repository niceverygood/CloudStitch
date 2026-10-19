import fs from 'node:fs';
import assert from 'node:assert/strict';
const code=fs.readFileSync('tools/combat-impact-comparison-v1/audio/player.js','utf8');
const {createComparisonAudio}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
let contexts=0,decodes=0,starts=0;
const sources=[];
class Gain{constructor(){this.gain={value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(v,t){this.lastRamp={v,t};}};}connect(){}disconnect(){}}
class Source{connect(){}disconnect(){}start(){starts++;}stop(t){this.stopAt=t;} }
class Context{constructor(){contexts++;this.currentTime=3;this.state='suspended';this.destination={};}createGain(){return new Gain();}createBufferSource(){const s=new Source();sources.push(s);return s;}async resume(){this.state='running';}async decodeAudioData(){decodes++;return {duration:.2};}async close(){this.state='closed';}}
globalThis.AudioContext=Context;
const data=Object.fromEntries(['fire-cannon','impact-cannon','fire-machinegun','impact-machinegun'].map(id=>[id,Object.fromEntries(['old','new','oldMatched','newMatched'].map(v=>[v,'AA==']))]));
const checks=[];function check(name,fn){fn();checks.push(name);}
const player=createComparisonAudio(data);
check('starts locked; no automatic audio',()=>assert.equal(contexts,0));
assert.equal(await player.unlock(),true);
check('one context sixteen buffers',()=>{assert.equal(contexts,1);assert.equal(decodes,16);});
for(let i=0;i<4;i++)assert.equal(await player.play('fire-machinegun','new'),true);
check('four source voices',()=>assert.equal(starts,4));
assert.equal(await player.play('fire-machinegun','new'),false);
check('fifth suppressed; decode reused',()=>{assert.equal(player.debug().activeVoices,4);assert.equal(player.debug().suppressed,1);assert.equal(decodes,16);});
player.stop();
check('stop scheduled with 5ms release',()=>assert(sources.every(s=>Math.abs(s.stopAt-3.005)<1e-9)));
check('release voices still counted',()=>assert.equal(player.debug().activeVoices,4));
for(const s of sources)s.onended();
check('ended disconnect removes voices',()=>assert.equal(player.debug().activeVoices,0));
const pending=player.play('impact-cannon','old',{matched:false,volume:999});player.stop();assert.equal(await pending,false);
check('stop cancels pending play',()=>assert.equal(starts,4));
assert.equal(await player.play('impact-cannon','old',{matched:false}),true);
assert.equal(await player.play('unknown','new'),false);
assert.equal(await player.play('fire-cannon','invalid'),false);
player.dispose();player.dispose();
assert.equal(await player.play('fire-cannon','new'),false);
await new Promise(r=>setTimeout(r,25));
check('dispose closes context and clears',()=>{assert.equal(player.debug().state,'closed');assert.equal(player.debug().decodedBuffers,0);assert.equal(player.debug().activeVoices,0);assert.equal(player.debug().disposed,true);});
const report={passed:true,checks,contextCount:contexts,decodeCount:decodes,browserOrNative:false,actualListening:false};
fs.writeFileSync('outputs/combat-impact-comparison-v1/audio/player-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
