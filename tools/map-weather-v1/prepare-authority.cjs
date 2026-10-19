// Produce an isolated, opt-in battlefield revision. Never patches its owner source.
// All movement, weather rate integration, collisions and damage stay in one tick.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),source=fs.readFileSync(path.join(root,'tools/battlefield/sim.mjs'),'utf8');
const sha=crypto.createHash('sha256').update(source).digest('hex');
let code=source;
function replace(before,after){if(!code.includes(before))throw Error('Canonical source changed; review authority port anchor: '+before.slice(0,65));code=code.replace(before,after);}
replace('export function createSimulation({ obstacles = [], harbor, playerSpawn, enemySpawns, muzzleResolver = null } = {}) {','export function createSimulation({ obstacles = [], harbor, playerSpawn, enemySpawns, muzzleResolver = null, weatherEnabled = false, weatherGeneration = 1 } = {}) {');
replace('  return sim;\n}\n\nconst point =',`  if (weatherEnabled) attachWeather(sim, weatherGeneration);
  return sim;
}

const point =`);
replace('  if (!cannon || !attackTarget) { enemy.telegraph = null; return; }','  if (!cannon || !attackTarget || (weatherRuntime.has(sim) && p.hidden)) { enemy.telegraph = null; return; }');
replace('  const p = sim.player;\n  if (p.modules?.length) refreshBudgets(sim);','  const p = sim.player;\n  const weather = advanceOwnedWeather(sim, dt, input);\n  if (p.modules?.length) refreshBudgets(sim);');
replace('  const speed = (p.boosting ? CONFIG.boostSpeed : CONFIG.playerSpeed) * cargoPenalty;\n  const response = 1 - Math.exp(-7 * dt);\n  p.vx += (mx * speed - p.vx) * response;\n  p.vz += (mz * speed - p.vz) * response;',`  const speed = (p.boosting ? CONFIG.boostSpeed : CONFIG.playerSpeed) * cargoPenalty * (weather ? 1 - .62 * p.icing : 1);
  const response = 1 - Math.exp(-7 * dt * (weather ? 1 - .68 * p.icing : 1));
  p.vx += (mx * speed + (weather?.wind.x || 0) - p.vx) * response;
  p.vz += (mz * speed + (weather?.wind.z || 0) - p.vz) * response;
  if (weather) {
    const liftInput = clamp(finite(input.lift, finite(input.moveY)), -1, 1);
    p.vy += (liftInput * 4 - p.vy) * (1 - Math.exp(-2 * dt)) + weather.updraft * dt;
    p.vy = clamp(p.vy, -8, 9); p.y = clamp(p.y + p.vy * dt, WEATHER_BOUNDS.minY, WEATHER_BOUNDS.maxY);
    if ((p.y <= WEATHER_BOUNDS.minY && p.vy < 0) || (p.y >= WEATHER_BOUNDS.maxY && p.vy > 0)) p.vy = 0;
  }`);
replace('  resolveCollision(p, [...sim.obstacles, ...sim.enemies.filter(e => !e.defeated)], p.radius);','  resolveCollision(p, [...sim.obstacles, ...sim.enemies.filter(e => !e.defeated)], p.radius);\n  if (weather) finishOwnedWeather(sim, weather, dt);');
const prelude=`/** Isolated weather-enabled battlefield revision. Canonical remains untouched.
 * Generated from tools/battlefield/sim.mjs SHA256 ${sha}.
 * This module alone owns the test ship state and tick. It is not run beside a second combat sim.
 */
import { createAuthoritativeWeatherPort } from './adapter.mjs';
import { WEATHER_BOUNDS } from './sim.mjs';
export const AUTHORITY_BASELINE_SHA256 = '${sha}';
const weatherRuntime = new WeakMap();
function attachWeather(sim, generation) {
 Object.assign(sim.player,{y:8,vy:0,icing:0,heat:100,hidden:false,lock:1,preheating:false,preheatExhausted:false,speedMultiplier:1,accelerationMultiplier:1});
 const port=createAuthoritativeWeatherPort({generation,player:sim.player});
 const runtime={port,generation,frame:0,lastDamageSeqBySource:Object.create(null),sample:null};weatherRuntime.set(sim,runtime);
 sim.weatherGeneration=generation;return runtime;
}
function advanceOwnedWeather(sim,dt,input){
 const r=weatherRuntime.get(sim);if(!r)return null;const p=sim.player;
 const frame=r.port.advance({generation:r.generation,frame:++r.frame,dt,time:sim.time,player:p,input});
 if(!input.preheat)p.preheatExhausted=false;
 p.preheating=Boolean(input.preheat)&&p.heat>.5&&!p.preheatExhausted;
 p.heat=clamp(p.heat+(p.preheating?-frame.heat.preheatConsumption:frame.heat.regeneration)*dt,0,100);
 if(p.preheating&&p.heat<=.5)p.preheatExhausted=true;
 p.icing=clamp(p.icing+(frame.icing.rate-(p.preheating?frame.heat.thaw:0))*dt,0,1);
 p.speedMultiplier=1-.62*p.icing;p.accelerationMultiplier=1-.68*p.icing;
 r.sample=frame;for(const e of frame.events||[])event(sim,e.type,{zone:e.zone,weatherSeq:e.seq,position:e.position});
 return frame;
}
function shapeHits(p,s){if(!s||p.y<s.minY||p.y>s.maxY)return false;return s.type==='circle'?Math.hypot(p.x-s.x,p.z-s.z)<=s.radius:Math.abs(p.x-s.x)<=s.halfX&&Math.abs(p.z-s.z)<=s.halfZ;}
function finishOwnedWeather(sim,frame,dt){
 const r=weatherRuntime.get(sim),p=sim.player;
 p.x=clamp(p.x,WEATHER_BOUNDS.minX,WEATHER_BOUNDS.maxX);p.z=clamp(p.z,WEATHER_BOUNDS.minZ,WEATHER_BOUNDS.maxZ);
 const final=r.port.sampleAt(p,sim.time),hidden=final.visibility===0;
 if(hidden!==p.hidden)event(sim,hidden?'conceal-enter':'conceal-exit',{x:p.x,y:p.y,z:p.z});
 p.hidden=hidden;p.lock=hidden?0:clamp(p.lock+dt/1.5,0,1);
 for(const proposal of frame.proposals||[]){
  if(proposal.generation!==r.generation||proposal.seq<=(r.lastDamageSeqBySource[proposal.source]??-1)||!shapeHits(p,proposal.shape))continue;
  r.lastDamageSeqBySource[proposal.source]=proposal.seq;const damage=Math.min(p.hp,proposal.damage);p.hp-=damage;sim.stats.damageTaken+=damage;
  const hull=p.modules?.find(m=>m.key==='root');if(hull)hull.hp=p.hp;
  event(sim,'environment-hit',{x:p.x,y:p.y,z:p.z,damage,hp:p.hp,source:proposal.source,pulseId:proposal.pulseId,generation:r.generation});
 }
 r.sample=final;
}
export function getWeatherState(sim){const r=weatherRuntime.get(sim);if(!r)return null;const snapshot=r.port.snapshot(),sample=r.port.sampleAt(sim.player,sim.time);for(const [id,inside]of Object.entries(sample.inside||{}))if(snapshot.weather[id]){snapshot.weather[id].inside=inside;snapshot.weather[id].active=inside;}return{...snapshot,player:{...sim.player},time:sim.time,paused:sim.paused,generation:r.generation,events:sim.events,sample};}
/** Trial commands belong to this authority, not the renderer/session. */
export function teleportWeatherTrial(sim,position){if(!weatherRuntime.has(sim))throw Error('Weather trial is not enabled');for(const k of ['x','y','z'])if(!Number.isFinite(position[k]))throw Error('Invalid trial position');Object.assign(sim.player,{x:clamp(position.x,WEATHER_BOUNDS.minX,WEATHER_BOUNDS.maxX),y:clamp(position.y,WEATHER_BOUNDS.minY,WEATHER_BOUNDS.maxY),z:clamp(position.z,WEATHER_BOUNDS.minZ,WEATHER_BOUNDS.maxZ),vx:0,vy:0,vz:0});return sim;}
export function disposeWeatherTrial(sim){const r=weatherRuntime.get(sim);if(r){r.port.dispose();weatherRuntime.delete(sim);}}
`;
fs.writeFileSync(path.join(__dirname,'authority.mjs'),prelude+'\n'+code);
console.log(JSON.stringify({generated:'tools/map-weather-v1/authority.mjs',canonicalSha256:sha,canonicalWritten:false}));
