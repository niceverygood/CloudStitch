import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation as originalCreate, step as originalStep } from '../battlefield/sim.mjs';
import { createSimulation, step, setPaused, getWeatherState, teleportWeatherTrial, AUTHORITY_BASELINE_SHA256 } from './authority.mjs';
import { createWeatherSession } from './session.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
function run(s,t,input={},dt=.05){for(let i=0;i<Math.round(t/dt);i++)step(s,dt,input);return s;}
const make=()=>createSimulation({weatherEnabled:true,enemySpawns:[]});
const warp=(s,x,z,y=8)=>teleportWeatherTrial(s,{x,y,z});
test('canonical source preserved; opt-in false equals original across varied combat ticks',()=>{
 const hash=crypto.createHash('sha256').update(fs.readFileSync(new URL('../battlefield/sim.mjs',import.meta.url))).digest('hex');assert.equal(hash,AUTHORITY_BASELINE_SHA256);
 const a=originalCreate(),b=createSimulation();assert.deepEqual(b,a);
 for(let i=0;i<180;i++){const input={moveX:Math.sin(i*.1),moveZ:Math.cos(i*.13),fire:i%3===0,aimX:20,aimZ:-20,boost:i%5===0},dt=[.01,1/60,.021,.033][i%4];originalStep(a,dt,input);step(b,dt,input);assert.deepEqual(b,a);}
});
test('single authority applies wind drift and vertical lift; bounded final position',()=>{
 const wind=make();warp(wind,45,-24);run(wind,1);assert.ok(wind.player.z>-19);assert.ok(wind.player.vz>5.5);
 const lift=make();warp(lift,0,-24);run(lift,3);assert.ok(lift.player.y>17);run(lift,30);assert.ok(lift.player.y<=34);assert.equal(lift.player.vy,0);
 const down=make();warp(down,-20,0,4);run(down,2,{lift:-1});assert.equal(down.player.y,3);assert.equal(down.player.vy,0);
 assert.ok(Math.abs(wind.time-getWeatherState(wind).time)<1e-10);
});
test('cloud cancels existing enemy telegraph and suppresses reacquisition; manual fire still works',()=>{
 const s=createSimulation({weatherEnabled:true});warp(s,-45,-24);s.enemies[0].telegraph={fromX:-28,fromZ:-12,targetX:-45,targetZ:-24,remaining:.1,duration:1.3};
 run(s,.2,{fire:true,aimX:0,aimZ:-24});assert.equal(s.player.hidden,true);assert.equal(s.enemies[0].telegraph,null);assert.ok(s.stats.shots>0);assert.equal(s.stats.damageTaken,0);
 warp(s,0,0);run(s,.1);assert.equal(s.player.hidden,false);assert.ok(s.player.lock>0);
});
test('actual authoritative ice slows movement and consumes heat only in authority',()=>{
 const ice=make();warp(ice,0,24);run(ice,5);const amount=ice.player.icing;assert.ok(amount>.59);run(ice,1,{preheat:true});assert.ok(ice.player.icing<amount-.29);assert.ok(ice.player.heat<76);const before=ice.player.heat;run(ice,1);assert.ok(ice.player.heat>before);
 const frozen=make(),clear=make();warp(frozen,0,24);run(frozen,5);warp(frozen,-22,0);warp(clear,-22,0);run(frozen,1,{moveX:1});run(clear,1,{moveX:1});assert.ok(frozen.player.x<clear.player.x-3);
});
test('lightning deals 24 once; fixed tell can be evaded; stats and hull match',()=>{
 const s=make();warp(s,-45,24);run(s,.6);const target=getWeatherState(s).weather.lightning.target;assert.deepEqual(target,{x:-45,y:8,z:24});run(s,2.8);assert.equal(s.player.hp,76);assert.equal(s.stats.damageTaken,24);assert.equal(s.events.filter(e=>e.type==='environment-hit').length,1);
 const d=make();warp(d,-45,24);run(d,.6);warp(d,-35,24);run(d,2.8);assert.equal(d.player.hp,100);assert.deepEqual(getWeatherState(d).weather.lightning.target,target);
});
test('sustained thermal late entry is hit once; safe gaps and height remain safe',()=>{
 const s=make();warp(s,45,21);run(s,3.4);assert.equal(getWeatherState(s).weather.thermal.phase,'burst');assert.equal(s.player.hp,100);warp(s,45,18);run(s,.1);assert.equal(s.player.hp,85);warp(s,45,21);run(s,.1);warp(s,45,18);run(s,.1);assert.equal(s.player.hp,85);
 const high=make();warp(high,45,18,14);run(high,4);assert.equal(high.player.hp,100);
});
test('pause freezes authoritative time/resources; reset changes generation and clears harm',()=>{
 const s=createWeatherSession();s.warp('icing',{center:true});for(let i=0;i<30;i++)s.advance(.05);s.pause(true);const before=s.snapshot();s.advance(.1,{preheat:true,moveX:1,lift:1});assert.deepEqual(s.snapshot(),before);const generation=s.generation;s.reset();assert.ok(s.generation>generation);assert.equal(s.state.time,0);assert.equal(s.state.player.hp,100);assert.equal(s.state.player.icing,0);assert.equal(s.state.player.heat,100);assert.equal(s.state.events.length,0);assert.equal(s.state.weather.lightning.phase,'calm');assert.equal(s.state.weather.thermal.phase,'calm');
 s.advance(.01);assert.equal(s.state.time,.01);s.dispose();assert.throws(()=>s.advance(.05),/disposed/);
});
test('environment lethal damage uses the existing defeat path',()=>{
 const s=make();warp(s,-45,24);run(s,40);assert.equal(s.player.hp,0);assert.equal(s.outcome,'defeat');assert.equal(s.endReason,'hull-destroyed');assert.equal(s.stats.damageTaken,100);assert.equal(s.events.filter(e=>e.type==='defeat').length,1);const time=s.time;step(s,1);assert.equal(s.time,time);
});
