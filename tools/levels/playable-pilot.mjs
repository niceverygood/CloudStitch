/** QA driver: real movement/fire/salvage/return inputs, no teleport or damage injection. */
export function createSortiePilot(controller){
  let targetId=null,mode='fight',steps=0,returned=false;const observed={hits:0,detached:0,recovered:0,shots:0,damage:0};
  const counters=new Set();
  function steer(sim,target){
    const p=sim.player,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1;
    let x=dx/d,z=dz/d;
    for(const o of sim.obstacles){const ax=p.x-o.x,az=p.z-o.z,ad=Math.hypot(ax,az)||1,clearance=o.radius+p.radius+7;if(ad<clearance){const k=(clearance-ad)/7*2;x+=ax/ad*k;z+=az/ad*k;}}
    const len=Math.max(1,Math.hypot(x,z));return {moveX:x/len,moveZ:z/len};
  }
  function next(dt=.05){
    const snapshot=controller.snapshot(),sim=snapshot.sim;
    if(snapshot.phase==='harbor'){returned=true;return {done:true,returned,steps,observed};}
    if(snapshot.phase==='defeat')return {done:true,returned:false,steps,observed,reason:'defeat'};
    if(!sim)return {done:true,returned:false,reason:'no-simulation'};
    for(const e of sim.events){if(counters.has(e.seq))continue;counters.add(e.seq);if(e.type==='hit'&&e.owner==='player')observed.hits++;if(e.type==='bundle-detached')observed.detached++;if(e.type==='salvaged')observed.recovered++;if(e.type==='player-fire')observed.shots++;}
    observed.damage=sim.stats.damageTaken;
    if(sim.cargo.length)mode='return';
    const debris=sim.debris.find(b=>!b.salvaged&&!b.lost&&b.weight>0);
    if(mode==='fight'&&debris)mode='salvage';
    let input={};
    if(mode==='return'){
      if(Math.hypot(sim.player.x-sim.harbor.x,sim.player.z-sim.harbor.z)<sim.harbor.radius-1){const result=controller.command('return');if(!result.ok)return {done:true,returned:false,reason:result.reason};return next(dt);}
      input=steer(sim,sim.harbor);
    }else if(mode==='salvage'){
      if(!debris){mode='fight';return next(dt);}
      if(Math.hypot(sim.player.x-debris.x,sim.player.z-debris.z)<9){controller.command('salvage');mode='return';}
      else input=steer(sim,debris);
    }else{
      let enemy=sim.enemies.find(e=>e.id===targetId&&!e.defeated);
      if(!enemy){enemy=sim.enemies.filter(e=>!e.defeated).sort((a,b)=>b.x-a.x)[0];targetId=enemy?.id;}
      if(!enemy)return {done:true,returned:false,reason:'no-enemy-or-recovery'};
      const root=enemy.modules.find(m=>m.key==='root'),c=Math.cos(enemy.angle),s=Math.sin(enemy.angle);
      const center={x:enemy.x+root.localX*c+root.localZ*s,z:enemy.z-root.localX*s+root.localZ*c};
      const d=Math.hypot(center.x-sim.player.x,center.z-sim.player.z);
      // Aim at the outer hull edge, away from the fore-mounted weapon.
      const aim={aimX:center.x+c*1.1,aimZ:center.z-s*1.1,fire:true};
      input=d>24?{...steer(sim,center),...aim}:{moveX:-Math.sin(sim.time*.8)*.45,moveZ:Math.cos(sim.time*.8)*.25,...aim};
    }
    controller.advance(dt,input);steps++;return {done:false,mode,steps,observed};
  }
  return {next};
}
export function runSortie(controller,{maxSteps=6000,dt=.05,onStep}={}){
  const departed=controller.command('depart');if(!departed.ok)throw new Error(departed.reason);
  const pilot=createSortiePilot(controller);let result;
  for(let i=0;i<maxSteps;i++){result=pilot.next(dt);onStep?.(controller.snapshot(),dt);if(result.done)return result;}
  return {...result,done:false,reason:'pilot-timeout'};
}
