/* Keep only public generation provenance when local state is not transferred.
 * Account state/credentials are never merged into the deliverable manifest.
 * Each available state value takes precedence; missing values use the previous
 * public manifest so a fresh Git clone can inspect/register existing heroes.
 */
export function generationProvenance(state = {}, previousManifest = {}) {
  const candidates = {
    task_id: state.task_id ?? previousManifest.task_id,
    operation_id: state.operation_id ?? previousManifest.operation_id,
    consumed_credits: state.reported_consumed_credits ?? state.consumed_credits ?? previousManifest.consumed_credits,
  };
  const result = {};
  for (const key of ['task_id', 'operation_id', 'consumed_credits']) {
    const value = candidates[key];
    if (value === undefined || value === null) continue;
    if (key === 'consumed_credits') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Generation consumed_credits must be a finite nonnegative number.');
    } else if (typeof value !== 'string' || !value.trim()) {
      throw new Error('Generation ' + key + ' must be a nonempty public identifier.');
    }
    result[key] = value;
  }
  return result;
}
