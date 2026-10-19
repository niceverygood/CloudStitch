import {
  createSimulation, configureWorld, spawnEnemy, setEnemyIntent, setPaused,
  step, salvage, dropCargo, returnToHarbor, repairPlayer, refreshBudgets, clearCombat,
} from './sim.mjs';

export const BATTLEFIELD_VERSION = 'battlefield-authority-0.2.1';
const copy = value => JSON.parse(JSON.stringify(value));

function applyLoadout(sim, loadout = {}) {
  const p = sim.player;
  for (const key of ['hp', 'maxHp', 'baseWeight', 'lift', 'powerOutput', 'powerDraw', 'crewWeight']) {
    if (loadout[key] === undefined) continue;
    if (!Number.isFinite(loadout[key]) || loadout[key] < 0) throw new Error(`Invalid loadout ${key}`);
    p[key] = loadout[key];
  }
  if (p.maxHp <= 0 || p.hp > p.maxHp || p.hp <= 0) throw new Error('Invalid hull HP');
  if (loadout.scrap !== undefined) {
    if (!Number.isFinite(loadout.scrap) || loadout.scrap < 0) throw new Error('Invalid scrap');
    sim.resources.scrap = loadout.scrap;
  }
  if (loadout.modules !== undefined) {
    // Reuse the same explicit single-parent topology validation as enemy spawns.
    const probe = createSimulation({ enemySpawns: [] });
    const validated = spawnEnemy(probe, { id: 'player', assetId: p.assetId, x: 0, z: 0, modules: loadout.modules });
    p.modules = copy(validated.modules);
    for (const m of p.modules) {
      for (const key of ['lift', 'powerOutput', 'powerDraw']) if (m[key] !== undefined && (!Number.isFinite(m[key]) || m[key] < 0)) throw new Error(`Invalid module ${key}`);
    }
    const root = p.modules.find(m => m.key === 'root');
    p.hp = root.hp; p.maxHp = root.maxHp;
  }
  refreshBudgets(sim);
}

/**
 * Thin integration port over sim.mjs. It owns no second combat simulation.
 * Encounter directors send spawn/intent; renderers only read state/events.
 */
export function createBattlefieldAdapter(options = {}) {
  let initial = { world: copy(options.world || {}), enemySpawns: options.enemySpawns === undefined ? undefined : copy(options.enemySpawns), loadout: copy(options.loadout || {}), muzzleResolver: options.muzzleResolver || null };
  let generation = 0, state, lastEvent = 0;
  const receipts = new Map();

  function begin(config) {
    const next = createSimulation({ ...config.world, enemySpawns: config.enemySpawns, muzzleResolver: config.muzzleResolver });
    applyLoadout(next, config.loadout);
    state = next; generation += 1; lastEvent = 0;
    state.prototype.integrationVersion = BATTLEFIELD_VERSION;
    return state;
  }
  begin(initial);

  function retry() { return begin(initial); }
  function depart(config = {}) {
    if (state.outcome !== 'victory') throw new Error('Return to harbor before departure');
    if (!config.loadout) throw new Error('A confirmed harbor loadout is required');
    const next = {
      world: copy(config.world || initial.world),
      enemySpawns: config.enemySpawns === undefined ? initial.enemySpawns : copy(config.enemySpawns),
      loadout: copy(config.loadout), muzzleResolver: config.muzzleResolver ?? initial.muzzleResolver,
    };
    // Validation must complete before changing the retry checkpoint.
    const result = begin(next); initial = next;
    return result;
  }
  function snapshot() {
    const { muzzleResolver, ...data } = state;
    return { version: BATTLEFIELD_VERSION, generation, ...copy(data) };
  }
  function drainEvents() {
    const entries = state.events.filter(e => e.seq > lastEvent);
    if (entries.length) lastEvent = entries.at(-1).seq;
    return entries.map(e => ({ ...copy(e), generation }));
  }
  function dispatch(command) {
    if (!command || typeof command.id !== 'string' || !command.id) return { ok: false, reason: 'command-id-required', generation };
    const encoded = JSON.stringify(command), previous = receipts.get(command.id);
    if (previous) return previous.encoded === encoded ? copy(previous.result) : { ok: false, reason: 'command-id-conflict', generation };
    if (command.generation !== undefined && command.generation !== generation) return { ok: false, reason: 'stale-generation', generation };
    let value, result;
    try {
      switch (command.type) {
        case 'pause': value = setPaused(state, true); break;
        case 'resume': setPaused(state, false); value = true; break;
        case 'salvage': value = state.paused ? false : salvage(state); break;
        case 'drop-cargo': value = dropCargo(state); break;
        case 'return': value = state.paused ? false : returnToHarbor(state); break;
        case 'repair': value = repairPlayer(state, command.hp); break;
        case 'spawn': value = spawnEnemy(state, command.enemy); break;
        case 'intent': value = setEnemyIntent(state, command.enemyId, command.intent); break;
        case 'world': configureWorld(state, command.world); value = true; break;
        case 'clear-combat': value = clearCombat(state, { reason: command.reason }); break;
        case 'retry': retry(); value = true; break;
        case 'depart': depart(command.config); value = true; break;
        default: throw new Error('Unknown battlefield command');
      }
      result = { ok: value !== false, value: value === undefined ? null : copy(value), generation };
    } catch (error) { result = { ok: false, reason: error.message, generation }; }
    receipts.set(command.id, { encoded, result });
    return result;
  }
  return {
    get state() { return state; }, get generation() { return generation; },
    advance(dt, input = {}) { step(state, dt, input); return state; },
    snapshot, drainEvents, dispatch, retry, depart,
  };
}
