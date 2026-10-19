/** Read-only bindings to the MacBook fleet catalog. No GLB generation/loading. */
export const FLEET_ASSET_ROOT = 'outputs/fleet-v1/';

export function resolveEncounterAsset(catalog, assetId) {
  const asset = catalog?.ships?.find(item => item.id === assetId);
  if (!asset) throw new Error(`Unknown fleet asset: ${assetId}`);
  const model = asset.assetPath || asset.model;
  if (typeof model !== 'string' || !/^ships\/[a-z0-9-]+\.glb$/.test(model)) {
    throw new Error(`Unsafe or missing fleet model path: ${assetId}`);
  }
  return {
    assetId, modelPath: FLEET_ASSET_ROOT + model,
    bytes: asset.bytes ?? null, sha256: asset.sha256 ?? null,
    availableActions: [...(asset.availableActions || asset.metrics?.availableActions || [])],
    authoredUnits: asset.authoredUnits || 'fleet-kit',
    recommendedFleetScale: asset.recommendedFleetScale ?? 1,
    status: asset.status,
    note: 'Binding only. Battlefield owns LU scale, pose, collision and combat; GLB clips are visual.',
  };
}

export function collectEncounterAssets(encounters, fleet) {
  const ids = new Set(['player-homeward']);
  for (const stage of encounters?.stages || []) {
    for (const spec of [...stage.opening, ...stage.late, stage.midBoss, stage.finalBoss]) ids.add(spec.assetId);
  }
  return [...ids].map(id => resolveEncounterAsset(fleet, id));
}
