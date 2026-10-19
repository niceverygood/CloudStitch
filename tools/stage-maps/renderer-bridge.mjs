import {createVoyageRenderer as createBaseRenderer} from 'cloudstitch/base-renderer';
export {THREE} from 'cloudstitch/base-renderer';
/** Presentation only. The base renderer owns all models; the controller owns sim. */
export function createVoyageRenderer(options){
 const renderer=createBaseRenderer(options),render=renderer.render,reset=renderer.reset,stats=renderer.stats;
 let previous=new Set(),presentationResets=0;
 renderer.reset=()=>{previous.clear();reset();};
 renderer.render=(snapshot,...args)=>{
  const current=new Set(snapshot.phase==='harbor'?[]:(snapshot.sim?.enemies||[]).map(enemy=>enemy.id));
  if([...previous].some(id=>!current.has(id))){reset();presentationResets++;}
  previous=current;return render(snapshot,...args);
 };
 renderer.stats=()=>({...stats(),presentationResets});
 return renderer;
}
