import {createCampaignPilot} from './pilot.mjs';
/** Browser QA owns the advance slot only for this explicit, awaited run. */
async function run({qa=window.__campaign,dt=.05,maxSteps=24000,depart=true,onStep}={}){
 if(!qa?.ready)throw Error('Campaign UI is not ready');
 qa.setDriverMode(true);let previous='';
 const signature=snapshot=>`${snapshot.phase}:${snapshot.routeMap.id}:${snapshot.stage.phase}:${(snapshot.sim?.enemies||[]).map(enemy=>`${enemy.id}/${enemy.defeated}`).join('|')}:${(snapshot.sim?.debris||[]).map(bundle=>`${bundle.id}/${bundle.salvaged}`).join('|')}`;
 try{
  if(depart){const result=await qa.command('depart');if(!result.ok)throw Error(result.reason);}
  await qa.whenIdle();const pilot=createCampaignPilot(qa.controller,{maxSteps});let calls=0;
  for(;;){
   const before=qa.snapshot(),key=signature(before);if(key!==previous){await qa.whenIdle();previous=key;}
   const result=pilot.next(dt);onStep?.(qa.snapshot(),result);
   if(result.done){await qa.whenIdle();return result;}
   if(++calls%8===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
 }finally{
  if(qa.snapshot()?.phase==='sailing'&&!qa.snapshot().paused)await qa.command('pause');
  qa.setDriverMode(false);
 }
}
window.campaignQA={version:'voyage-campaign-v1',createCampaignPilot,run};
