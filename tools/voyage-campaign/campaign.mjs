import {stageMaps} from '../stage-maps/maps.mjs';
import {validateState} from '../harbor/core.mjs';
import {createExampleState} from '../harbor/fixtures.mjs';
import {checksumFNV1a} from '../save/save.mjs';

export const CAMPAIGN_VERSION = 1;
export const CAMPAIGN_ID = 'cloudstitch-six-v1';
export const CAMPAIGN_SAVE_KEY = 'cloudstitch.voyage-campaign.v1';
const clone = value => structuredClone(value);
const failure = (code, message) => ({ok: false, code, message});
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));

export function routeBinding(map) {
  return {routeId: map.id, routeVersion: 1, stageId: map.stageId, levelId: map.seaLevel.id,
    layoutHash: checksumFNV1a(JSON.stringify(map.seaLevel))};
}
export const CAMPAIGN_MANIFEST_HASH = checksumFNV1a(JSON.stringify(stageMaps.map(routeBinding)));
const campaignKeys = ['version', 'campaignId', 'manifestHash', 'currentStageIndex', 'completedStages'];
const completionKeys = ['stageId', 'levelId', 'layoutHash', 'voyageId', 'settlementId', 'proof'];
const proofKeys = ['phase', 'midBossDefeats', 'finalBossDefeats'];
const routeKeys = ['routeId', 'routeVersion', 'stageId', 'levelId', 'layoutHash'];

export function currentMap(state) {
  const index = state?.campaign?.currentStageIndex;
  if (!Number.isInteger(index) || index < 0 || index >= stageMaps.length) throw new RangeError('현재 캠페인 단계가 잘못되었습니다.');
  return stageMaps[index];
}

export function createCampaignState() {
  const state = createExampleState();
  state.campaign = {version: CAMPAIGN_VERSION, campaignId: CAMPAIGN_ID, manifestHash: CAMPAIGN_MANIFEST_HASH,
    currentStageIndex: 0, completedStages: []};
  state.route = routeBinding(stageMaps[0]);
  return state;
}

/** Every journal checkpoint is checked against its own stage, including backups. */
export function validateCampaignState(state) {
  const issues = validateState(state), campaign = state?.campaign;
  if (!exactKeys(campaign, campaignKeys)) {
    issues.push('캠페인 진행 정보의 필드가 잘못되었습니다.');
    return issues;
  }
  if (campaign.version !== CAMPAIGN_VERSION || campaign.campaignId !== CAMPAIGN_ID || campaign.manifestHash !== CAMPAIGN_MANIFEST_HASH) {
    issues.push('캠페인 ID·버전·지도 목록이 현재 구현과 다릅니다.');
  }
  const index = campaign.currentStageIndex;
  if (!Number.isInteger(index) || index < 0 || index >= stageMaps.length) {
    issues.push('현재 캠페인 단계가 잘못되었습니다.');
    return issues;
  }
  const expected = routeBinding(stageMaps[index]);
  if (!exactKeys(state.route, routeKeys) || routeKeys.some(key => state.route[key] !== expected[key])) {
    issues.push('현재 단계와 저장된 항로·버전·지형이 일치하지 않습니다.');
  }
  const completed = campaign.completedStages;
  if (!Array.isArray(completed) || ![index, index + 1].includes(completed.length)) {
    issues.push('완료 단계는 첫 단계부터 현재 단계까지 연속이어야 합니다.');
    return issues;
  }
  const voyages = new Set(), settlements = new Set();
  for (const [completedIndex, entry] of completed.entries()) {
    const binding = routeBinding(stageMaps[completedIndex]);
    if (!exactKeys(entry, completionKeys) || entry.stageId !== binding.stageId || entry.levelId !== binding.levelId || entry.layoutHash !== binding.layoutHash ||
        typeof entry.voyageId !== 'string' || !entry.voyageId || typeof entry.settlementId !== 'string' || !entry.settlementId ||
        voyages.has(entry.voyageId) || settlements.has(entry.settlementId)) {
      issues.push(`완료 단계 ${completedIndex + 1}의 경로·정산 연결이 잘못되었습니다.`);
    }
    if (!exactKeys(entry?.proof, proofKeys) || entry.proof.phase !== 'victory' || entry.proof.midBossDefeats !== 1 || entry.proof.finalBossDefeats !== 1) {
      issues.push(`완료 단계 ${completedIndex + 1}의 교전 완료 증거가 없습니다.`);
    }
    const receipt = Array.isArray(state.settlements) ? state.settlements.find(item => item?.voyageId === entry?.voyageId && item?.settlementId === entry?.settlementId) : null;
    if (!receipt || receipt.outcome !== 'completed' || receipt.evidence !== 'battlefield-adapter') {
      issues.push(`완료 단계 ${completedIndex + 1}과 일치하는 실제 전장 귀환 정산이 없습니다.`);
    }
    voyages.add(entry?.voyageId); settlements.add(entry?.settlementId);
  }
  if (completed.length === index + 1 && (state.activeVoyage !== null || state.phase === 'sailing')) {
    issues.push('이미 완료한 단계에서 새 항해를 시작할 수 없습니다.');
  }
  return issues;
}

/** Call only with a witness read from the active director at actual safe return. */
export function completeCampaignStage(state, witness = {}) {
  const issues = validateCampaignState(state);
  if (issues.length) return failure('INVALID_CAMPAIGN', issues.join(' '));
  const map = currentMap(state), index = state.campaign.currentStageIndex;
  if (witness.stageId !== map.stageId || witness.phase !== 'victory' || witness.midBossDefeats !== 1 || witness.finalBossDefeats !== 1) {
    return failure('STAGE_VICTORY_REQUIRED', '현재 단계의 중간·최종보스 격파와 교전 완료가 필요합니다.');
  }
  if (!['harbor', 'debrief'].includes(state.phase) || state.activeVoyage !== null || state.boundary !== 'return') {
    return failure('SAFE_RETURN_REQUIRED', '현재 항해의 안전 귀환 정산을 먼저 마쳐야 합니다.');
  }
  const receipt = state.settlements.at(-1);
  if (!receipt || receipt.voyageId !== witness.voyageId || receipt.outcome !== 'completed' || receipt.evidence !== 'battlefield-adapter') {
    return failure('STAGE_RECEIPT_REQUIRED', '실제 완료 항해와 동일한 최근 귀환 정산이 필요합니다.');
  }
  const existing = state.campaign.completedStages[index];
  if (existing) return existing.voyageId === receipt.voyageId && existing.settlementId === receipt.settlementId
    ? {ok: true, duplicate: true, state, message: '이미 완료 기록에 반영한 항해입니다.'}
    : failure('STAGE_COMPLETION_CONFLICT', '현재 단계에 다른 완료 항해가 이미 기록되어 있습니다.');
  const next = clone(state), binding = routeBinding(map);
  next.campaign.completedStages.push({stageId: binding.stageId, levelId: binding.levelId, layoutHash: binding.layoutHash,
    voyageId: receipt.voyageId, settlementId: receipt.settlementId,
    proof: {phase: 'victory', midBossDefeats: 1, finalBossDefeats: 1}});
  next.revision += 1;
  const errors = validateCampaignState(next);
  return errors.length ? failure('INVALID_CAMPAIGN', errors.join(' ')) : {ok: true, state: next, message: '단계 완료를 귀환 기록에 반영했습니다.'};
}

/** The host must save this candidate successfully BEFORE replacing live state/map. */
export function advanceCampaignStage(state) {
  const issues = validateCampaignState(state);
  if (issues.length) return failure('INVALID_CAMPAIGN', issues.join(' '));
  const index = state.campaign.currentStageIndex;
  if (!['harbor', 'debrief'].includes(state.phase) || state.activeVoyage !== null) return failure('SAFE_HARBOR_REQUIRED', '항구에서 현재 항해를 마친 뒤 다음 단계로 이동하세요.');
  if (state.campaign.completedStages.length !== index + 1) return failure('STAGE_INCOMPLETE', '현재 단계의 실제 교전과 귀환을 먼저 완료하세요.');
  if (index === stageMaps.length - 1) return failure('CAMPAIGN_COMPLETE', '여섯 단계 항해를 모두 마쳤습니다.');
  const next = clone(state);
  next.campaign.currentStageIndex += 1;
  next.route = routeBinding(currentMap(next));
  next.revision += 1;
  const errors = validateCampaignState(next);
  return errors.length ? failure('INVALID_CAMPAIGN', errors.join(' ')) : {ok: true, state: next, message: '다음 단계 항로를 준비했습니다.'};
}

/** Import one safe legacy slot without merging ledgers or awarding progression. */
export function validateLegacyState(legacyState, mapOrId) {
  const map = typeof mapOrId === 'string' ? stageMaps.find(item => item.id === mapOrId) : mapOrId;
  if (!stageMaps.includes(map)) return ['가져올 이전 항로가 잘못되었습니다.'];
  const issues = validateState(legacyState), expected = routeBinding(map);
  if (!exactKeys(legacyState?.route, routeKeys) || routeKeys.some(key => legacyState.route[key] !== expected[key])) issues.push('이전 항로의 지도 버전·지형이 일치하지 않습니다.');
  if (legacyState?.campaign !== undefined) issues.push('캠페인 기록을 이전 단계 기록으로 다시 가져올 수 없습니다.');
  return issues;
}

export function migrateLegacyState(legacyState, mapOrId) {
  const map = typeof mapOrId === 'string' ? stageMaps.find(item => item.id === mapOrId) : mapOrId;
  if (!stageMaps.includes(map)) return failure('LEGACY_MAP_UNKNOWN', '가져올 이전 항로가 잘못되었습니다.');
  const issues = validateLegacyState(legacyState, map), expected = routeBinding(map);
  if (issues.length) return failure('LEGACY_STATE_INVALID', issues.join(' '));
  if (!['harbor', 'debrief'].includes(legacyState.phase) || legacyState.activeVoyage !== null) return failure('LEGACY_UNSAFE', '진행 중 항해가 없는 이전 항구 기록만 가져올 수 있습니다.');
  const next = clone(legacyState), seed = createCampaignState();
  next.campaign = seed.campaign; next.route = seed.route;
  next.campaignImport = {format: 'stage-maps-v1', mapId: map.id, sourceRevision: legacyState.revision, stageId: map.stageId, layoutHash: expected.layoutHash};
  next.revision += 1;
  const errors = validateCampaignState(next);
  return errors.length ? failure('LEGACY_STATE_INVALID', errors.join(' ')) : {ok: true, state: next, message: '이전 항구의 함선·보관품·자원을 복사했습니다. 캠페인은 첫 단계부터 시작합니다.'};
}
