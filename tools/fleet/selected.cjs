/* Keep the approved airship's binary geometry, paint and animation unchanged.
 * Add only semantic JSON so fleet QA and the gallery can identify its modules.
 */
const fs=require('node:fs');const{repoPath}=require('../lib/paths.cjs');
function selectedAsset(spec){
 const bytes=fs.readFileSync(repoPath('outputs/airship-rig-v1/airship-rigged.glb'));
 let json,bin,offset=12;
 while(offset<bytes.length){const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);if(type===0x4e4f534a)json=JSON.parse(bytes.subarray(offset+8,offset+8+length).toString());if(type===0x004e4942)bin=bytes.subarray(offset+8,offset+8+length);offset+=8+length;}
 const groups={HullAndCabin:['root','hull','HullMotion'],EnvelopeAndBands:['selected-balloon','balloon','EnvelopeFlex'],EngineHousing:['selected-engine','engine','EngineVibration'],PropellerAssembly:['selected-engine','engine','PropellerSpin'],TurretAssembly:['selected-machinegun','machinegun','TurretYaw'],GunBarrel:['selected-machinegun','machinegun','GunRecoil'],WinchDrumMesh:['selected-winch','hook','WinchDrum'],HookAndChain:['selected-winch','hook','HookSwing'],WovenCable_1:['selected-winch','hook','HullMotion'],WovenCable_2:['selected-winch','hook','HullMotion'],WovenCable_3:['selected-winch','hook','HullMotion']};
 for(const node of json.nodes){const group=groups[node.name];if(group)node.extras={...node.extras,moduleId:group[0],moduleType:group[1],ownerBone:group[2],parentId:group[0]==='root'?null:'root',originalSelectedAsset:true};}
 const availableActions=['FloatIdle','Cruise','BankTurn','GustRecovery','TurretScan','WinchCycle','FireBurst'];
 json.scenes[0].extras={...json.scenes[0].extras,assetId:spec.id,assetName:spec.name,sourceFiles:spec.sourceFiles,confirmedModules:spec.modules,artModules:spec.modules,availableActions,scopeKind:spec.scopeKind,originalSelectedBinaryPreserved:true,sourceRig:'outputs/airship-rig-v1/airship-rigged.glb',authoredUnits:'selected-original',nominalHullLength:.948,recommendedFleetScale:10/.948,scaleNote:'Multiply original asset by this approximate visual scale when assembling beside the fleet kit. Not metres; final engine scale unassigned.'};
 const text=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);
 const output=Buffer.alloc(12+8+padded.length+8+bin.length);output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);output.writeUInt32LE(bin.length,20+padded.length);output.writeUInt32LE(0x004e4942,24+padded.length);bin.copy(output,28+padded.length);
 const manifest=JSON.parse(fs.readFileSync(repoPath('outputs/airship-rig-v1/manifest.json')));
 const metrics={triangles:11986,bones:9,meshCount:11,skinnedMeshCount:11,materialCount:2,clips:manifest.clips,availableActions,originalSelectedBinaryPreserved:true};
 return{base64:output.toString('base64'),metrics,artModules:spec.modules,shapeProposal:{originalSelectedAsset:true},style:'selected-original',availableActions,authoredUnits:'selected-original',recommendedFleetScale:10/.948};
}
module.exports={selectedAsset};
