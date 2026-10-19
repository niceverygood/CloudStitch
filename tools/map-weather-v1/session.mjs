import { createSimulation, step, setPaused, getWeatherState, teleportWeatherTrial, disposeWeatherTrial } from './authority.mjs';
import { WEATHER_ZONES } from './sim.mjs';

/** Only this battlefield revision advances. Renderers consume a detached snapshot. */
export function createWeatherSession(){
 let generation=0,sim,disposed=false;
 const initial={world:{playerSpawn:{x:-45,z:-5}},enemySpawns:[]};
 function reset(){if(sim)disposeWeatherTrial(sim);generation++;sim=createSimulation({...initial.world,enemySpawns:initial.enemySpawns,weatherEnabled:true,weatherGeneration:generation});return state();}
 function state(){const w=getWeatherState(sim);return{...w,outcome:sim.outcome,stats:{...sim.stats},player:{...sim.player}};}
 function assertLive(){if(disposed)throw Error('Weather session disposed');}
 reset();
 return{
  get state(){return state();},get generation(){return generation;},
  advance(dt,input={}){assertLive();step(sim,Math.min(Math.max(Number.isFinite(dt)?dt:0,0),.1),{...input,moveX:input.moveX??input.x??0,moveZ:input.moveZ??input.z??0,lift:input.lift??input.moveY??0});return state();},
  pause(value=true){assertLive();setPaused(sim,value);return state();},
  reset(){assertLive();return reset();},snapshot:state,
  warp(id,options={}){assertLive();const z=WEATHER_ZONES.find(z=>z.id===id);if(!z)throw Error('Unknown weather zone: '+id);const approach=id==='thermal'?{x:45,y:8,z:14}:{x:z.center.x,y:8,z:z.center.z+z.radius+1};teleportWeatherTrial(sim,options.position||(options.center?z.center:approach));return state();},
  dispose(){if(disposed)return;disposeWeatherTrial(sim);disposed=true;}
 };
}
