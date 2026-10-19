/** URL selection and exact safe-save route binding. No state mutation. */
import {stageMaps} from './maps.mjs';
import {validateState} from '../harbor/core.mjs';
import {checksumFNV1a} from '../save/save.mjs';

const routeKeys = ['routeId','routeVersion','stageId','levelId','layoutHash'];

/** Only authored map IDs are accepted; unknown IDs never change to another map. */
export function resolveMap(id) {
  const map = stageMaps.find(item=>item.id===id);
  if (!map) throw new RangeError(`알 수 없는 항로 지도입니다: ${String(id)}`);
  return map;
}

export function selectMap(search = globalThis.location?.search || '') {
  const id = new URLSearchParams(search).get('map');
  return id===null ? stageMaps[0] : resolveMap(id);
}

export const selectedMap = selectMap();

/** FNV-1a detects accidental layout mismatch, not malicious modifications. */
export function routeBinding(map) {
  return {
    routeId:map.id,
    routeVersion:1,
    stageId:map.stageId,
    levelId:map.seaLevel.id,
    layoutHash:checksumFNV1a(JSON.stringify(map.seaLevel))
  };
}

/** Same string[] interface as the harbor validator and save repository. */
export function validateRouteState(state, map = selectedMap) {
  const issues = validateState(state);
  const route = state?.route;
  if (!route || Array.isArray(route) || typeof route!=='object') {
    issues.push('저장 상태에 단계별 항로 정보가 없습니다.');
    return issues;
  }
  const expected = routeBinding(map);
  if (Object.keys(route).some(key=>!routeKeys.includes(key))) issues.push('항로 정보에 알 수 없는 필드가 있습니다.');
  for (const key of routeKeys) if (route[key]!==expected[key]) issues.push(`저장 항로의 ${key}가 현재 지도와 다릅니다.`);
  return issues;
}
