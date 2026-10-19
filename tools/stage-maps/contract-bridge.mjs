import {CONTRACT as base} from 'cloudstitch/base-contract';
import {selectedMap} from './selection.mjs';
export {battlefieldWorld,spawnCandidates,proxyModules,eventKey} from 'cloudstitch/base-contract';
export const CONTRACT=Object.freeze({...base,stageId:selectedMap.stageId,levelId:selectedMap.seaLevel.id,saveKey:`cloudstitch.stage-maps.v1.${selectedMap.id}`});
