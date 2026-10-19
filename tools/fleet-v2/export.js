import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { loadMaterials } from '../fleet/body.js';
import { rigAndAnimate } from '../fleet/rigging.js';
import { assembleShipV2 } from './assemble.js';
let materials;
window.__initFleetV2 = async atlas => { materials = await loadMaterials('data:image/png;base64,' + atlas); return true; };
window.__exportFleetV2 = async ({ ship, profile, art }) => {
  const built = assembleShipV2(ship, profile, art, materials);
  const { clips, stats } = rigAndAnimate(built.scene, built.controls, { motionScale: 10, style: built.style });
  built.scene.userData.availableProfiles = stats.availableActions;
  built.scene.userData.availableActions = stats.availableActions;
  const binary = await new GLTFExporter().parseAsync(built.scene, { binary: true, animations: clips, onlyVisible: true, trs: true });
  const bytes = new Uint8Array(binary); let text = '';
  for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  built.scene.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
  return { base64: btoa(text), metrics: stats, artModules: built.artModules, shapeProposal: built.shape, style: built.style, availableActions: stats.availableActions };
};
