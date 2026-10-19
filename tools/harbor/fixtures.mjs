/** Independent rule examples, never imported MacBook gameplay or final balance. */
export const EXAMPLE_VERSION = 'harbor-v1.0.0';

export function createExampleState() {
  const part = (id, kind, name, weight, extra = {}) => ({
    id, kind, name, hp: 100, maxHp: 100, weight, lift: 0,
    powerSupply: 0, powerDemand: 0, ownerId: 'player',
    source: { originId: 'starter-support', assetId: 'player-homeward', acquiredVoyageId: null },
    location: 'installed', parentId: 'homeward:hull', socketId: null, ...extra,
  });
  return {
    schemaVersion: 1, profileId: 'example-captain', ownerId: 'player', revision: 0,
    phase: 'harbor', boundary: 'harbor', voyageSequence: 0, activeVoyage: null,
    resources: { S: 120, F: 40, C: 2 }, settlements: [], repairReceipts: [],
    ship: {
      id: 'player-homeward', rootId: 'homeward:hull', passengerWeight: 0,
      sockets: [
        ['L1', 'balloon'], ['E1', 'engine'], ['E2', 'engine'],
        ['W1', 'machinegun'], ['W2', 'machinegun'], ['S1', 'hook'],
        ['A1', 'armor'], ['A2', 'armor'],
      ].map(([id, kind]) => ({ id, parentId: 'homeward:hull', kinds: [kind], enabled: true })),
    },
    parts: [
      part('homeward:hull', 'hull', '귀환호 핵심 선체', 24, { parentId: null }),
      part('homeward:balloon', 'balloon', '패치 부양낭', 6, { socketId: 'L1', lift: 65 }),
      part('homeward:engine', 'engine', '청록 엔진', 8, { socketId: 'E1', powerSupply: 14, powerDemand: 6 }),
      part('homeward:gun', 'machinegun', '경량 기관총', 8, { socketId: 'W1', powerDemand: 2 }),
      part('homeward:hook', 'hook', '회수 갈고리', 4, { socketId: 'S1', powerDemand: 2 }),
    ],
    notes: { verification: 'independent-example', economy: '기획 초기값과 독립 예시. 실제 항해·밸런스 검증 아님.' },
  };
}

export function exampleReturn(state, outcome = 'completed') {
  const voyageId = state.activeVoyage?.id;
  if (!voyageId) throw new Error('먼저 예시 출항을 시작하세요.');
  const n = state.voyageSequence;
  const make = (suffix, kind, name, weight, extra = {}) => ({
    id: `${voyageId}:${suffix}`, kind, name, hp: 60, maxHp: 100, weight,
    lift: 0, powerSupply: 0, powerDemand: 0, ownerId: 'player',
    source: { originId: `example-wreck-${n}`, assetId: 'independent-example-wreck', acquiredVoyageId: voyageId },
    location: 'cargo', parentId: null, socketId: null, ...extra,
  });
  return {
    version: 1, voyageId, settlementId: `${voyageId}:final`, outcome,
    evidence: 'independent-example',
    gained: { S: 90, F: 0, C: n === 1 ? 1 : 0 },
    spent: { S: 12, F: 3, C: 0 }, contractReward: { S: 30, F: 0, C: 0 },
    recovered: [
      make('engine', 'engine', `회수 엔진 ${n}`, 8, { powerSupply: 6, powerDemand: 2 }),
      make('armor', 'armor', `중량 장갑 ${n}`, 12),
    ],
    damage: [{ partId: 'homeward:hull', hp: 76 }],
  };
}
