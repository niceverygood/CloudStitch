/** Read-only boundaries. Battlefield remains the sole simulation/time/damage owner. */
export const HARBOR_CONTRACT_VERSION = 1;

export function createWorldContacts(assetCatalog, sceneCatalog) {
  const scene = sceneCatalog?.items?.find(item => item.id === 'jonghang-harbor');
  const defs = [
    ['workshop', '공방', 'repair-workshop', 'shipyard'],
    ['market', '천 시장', 'canvas-market', 'market'],
    ['warehouse', '보관함', 'storage-chest', 'warehouse'],
    ['departure', '출항 부두', 'dock-endcap', 'departure'],
  ];
  const errors = [], contacts = [];
  if (!scene) errors.push('jonghang-harbor 장면이 카탈로그에 없습니다.');
  for (const [id, label, assetId, action] of defs) {
    const asset = assetCatalog?.items?.find(item => item.id === assetId);
    if (!asset) { errors.push(`${assetId} 자산이 없습니다.`); continue; }
    contacts.push({ id, label, sceneId: 'jonghang-harbor', assetId, action,
      model: `outputs/world-assets/${asset.model}`, preview: `outputs/world-assets/${asset.preview}`,
      coordinateStatus: 'semantic-contact-only; XZ/Y-up LU; authored interaction positions pending',
    });
  }
  return { ok: errors.length === 0, version: 1, contacts, errors,
    scene: scene ? { id: scene.id, model: `outputs/world-assets/${scene.model}`, preview: `outputs/world-assets/${scene.preview}` } : null };
}

export function createDepartureManifest(state) {
  return {
    version: 1, voyageId: state.activeVoyage?.id || null, shipId: state.ship.id,
    rootId: state.ship.rootId, ownerId: state.ownerId,
    installed: state.parts.filter(p => p.location === 'installed').map(p => structuredClone(p)),
    cargo: state.parts.filter(p => p.location === 'cargo').map(p => structuredClone(p)),
    sockets: structuredClone(state.ship.sockets), resources: structuredClone(state.resources),
    integrationStatus: 'manifest-ready; battlefield owner must explicitly apply module graph/budgets; no simulation mutation here',
  };
}

/** sim victory is a safe arrival; safe-retreat pays no incomplete contract. */
export function adaptBattlefieldReturn(sim, { voyageId, settlementId, ownerId = 'player', rootId = 'homeward:hull', installedParts, gained, spent, contractReward } = {}) {
  const fail = message => ({ ok: false, code: 'ADAPTER_REJECTED', message });
  if (!sim || sim.outcome !== 'victory' || !['battle-cleared', 'safe-retreat-with-cargo'].includes(sim.endReason)) return fail('전장 안전 귀환 결과만 받을 수 있습니다.');
  if (!voyageId || !settlementId || !Array.isArray(sim.cargo)) return fail('호출자가 항해/정산 ID를 제공해야 합니다.');
  // Existing battlefield snapshot has no S/F/C economy. Never invent rewards from kill counts.
  const zero = () => ({ S: 0, F: 0, C: 0 });
  const recovered = [], recoveredSockets = [], seen = new Set();
  const kindMap = { machinegun: 'machinegun', cannon: 'cannon', harpoon: 'harpoon',
    engine: 'engine', balloon: 'balloon', connector: 'connector', deck: 'deck', hull: 'hull' };
  for (const bundle of sim.cargo) {
    if (bundle.owner !== ownerId || bundle.status !== 'cargo' || !bundle.salvaged || !Array.isArray(bundle.modules)) return fail('회수 완료·화물·소유권이 확인되지 않은 묶음입니다.');
    const ids = new Map(bundle.modules.map(m => [m.id, m.harborPartId || `${voyageId}:battle:${m.id}`]));
    for (const module of bundle.modules) {
      if (module.owner !== ownerId || module.hp <= 0 || !kindMap[module.type]) return fail('지원하지 않거나 소유권이 확인되지 않은 부품입니다.');
      const id = ids.get(module.id);
      if (seen.has(id)) return fail('전장 화물에 부품 ID가 중복됩니다.');
      seen.add(id);
      const parentId = ids.get(module.parentId) || null;
      const socketId = parentId ? `${parentId}:joint:${id}` : null;
      const kind = kindMap[module.type];
      recovered.push({ id, kind, name: module.name, hp: module.hp, maxHp: module.maxHp,
        weight: module.weight, lift: 0, powerSupply: 0, powerDemand: 0, ownerId,
        source: { originId: bundle.enemyId, originalPartId: module.id,
          assetId: bundle.source?.assetId || null, acquiredVoyageId: voyageId,
          budgetStatus: 'battlefield-source has weight only; functional outputs intentionally zero until catalog mapping approved' },
        location: 'cargo', parentId, socketId });
      if (parentId) recoveredSockets.push({ id: socketId, parentId, kinds: [kind], enabled: true });
    }
  }
  const damage = [];
  if (Array.isArray(sim.player?.modules)) {
    const known = Array.isArray(installedParts) ? new Map(installedParts.map(p => [p.id,p])) : null;
    for (const module of sim.player.modules) {
      const partId = module.harborPartId || module.id;
      if (known && !known.has(partId)) continue;
      if (typeof partId !== 'string' || !Number.isFinite(module.hp) || module.hp < 0 || damage.some(d => d.partId === partId)) return fail('장착 부품 손상 ID/내구도가 잘못되었습니다.');
      damage.push({partId,hp:module.hp});
    }
  }
  if (!damage.some(d => d.partId === rootId)) damage.push({partId:rootId,hp:sim.player?.hp});
  if (Array.isArray(installedParts)) {
    const known=new Map(installedParts.map(p=>[p.id,p]));
    if (damage.some(d=>d.partId!==rootId&&known.has(d.partId)&&d.hp>known.get(d.partId).hp)) return fail('현 전장의 전투 수리는 핵심 선체만 지원합니다.');
    const restoredBeyondDeparture=damage.reduce((sum,d)=>sum+Math.max(0,d.hp-(known.get(d.partId)?.hp??d.hp)),0);
    if (restoredBeyondDeparture>0 && !(Number.isFinite(spent?.S)&&spent.S>=restoredBeyondDeparture*.5)) return fail('출항 전보다 복구된 내구도에 대응하는 실제 전투 수리 지출이 없습니다.');
  }
  return { ok: true, result: {
    version: 1, voyageId, settlementId, evidence: 'battlefield-adapter',
    outcome: sim.endReason === 'battle-cleared' ? 'completed' : 'withdrawn',
    gained: gained || zero(), spent: spent || zero(), contractReward: contractReward || zero(),
    recovered, recoveredSockets,
    damage,
  } };
}
