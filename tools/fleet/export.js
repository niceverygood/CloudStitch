import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { loadMaterials } from './body.js';
import { assembleShip } from './assemble.js';
import { rigAndAnimate } from './rigging.js';
let materials;
window.__initFleet = async atlas => { materials = await loadMaterials('data:image/png;base64,' + atlas); return true; };
window.__exportFleetShip = async spec => {
  const built=assembleShip(spec,materials);
  const {clips,stats}=rigAndAnimate(built.scene,built.controls,{motionScale:10,style:built.style});
  const binary=await new GLTFExporter().parseAsync(built.scene,{binary:true,animations:clips,onlyVisible:true,trs:true});
  const bytes=new Uint8Array(binary);let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const result={base64:btoa(text),metrics:stats,artModules:built.artModules,shapeProposal:built.shape,style:built.style,availableActions:stats.availableActions};
  built.scene.traverse(object=>{if(object.isMesh)object.geometry.dispose();});
  return result;
};
