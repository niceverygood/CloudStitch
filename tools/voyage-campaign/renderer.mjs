import {createVoyageRenderer as createVerifiedRenderer,THREE} from '../stage-maps/renderer-bridge.mjs';
import {aimSocketAt} from './socket-aim.mjs';
export {THREE};

/** Own presentation correction; the returned projectile frame is the real GLB socket. */
export function createVoyageRenderer(options){
 const renderer=createVerifiedRenderer(options),initialize=renderer.initialize,stats=renderer.stats;
 const worldOrigin=new THREE.Vector3();let corrected=false,lastAim=null;
 renderer.initialize=async(...args)=>{
  const result=await initialize(...args),asset=renderer.playerAsset;
  if(!corrected&&asset?.aimAt&&asset?.muzzleFrame){
   const originalAim=asset.aimAt.bind(asset);
   asset.aimAt=(dx,dz,heading=0)=>{
    renderer.playerWrapper.getWorldPosition(worldOrigin);
    const origin={x:worldOrigin.x,z:worldOrigin.z};
    const aimed=aimSocketAt({aimRelative:originalAim,readFrame:()=>asset.muzzleFrame(),origin,target:{x:origin.x+dx,z:origin.z+dz},heading});
    lastAim={ok:aimed.ok,converged:aimed.converged,iterations:aimed.iterations,crossTrackError:aimed.crossTrackError,reason:aimed.reason};
    return aimed.frame;
   };
   corrected=true;
  }
  return result;
 };
 renderer.stats=()=>({...stats(),socketAim:{enabled:corrected,last:lastAim}});
 return renderer;
}
