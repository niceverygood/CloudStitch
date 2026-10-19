// Read-only player guidance. Combat state, hits and transactions remain host owned.
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const activeEnemies = sim => (sim?.enemies || []).filter(enemy => !enemy.defeated);
export function selectContact(sim, selectedId) {
  const contacts = activeEnemies(sim);
  return contacts.find(enemy => enemy.id === selectedId) || contacts.sort((a, b) => distance(a, sim.player) - distance(b, sim.player))[0] || null;
}
export function nextContact(sim, selectedId) {
  const contacts = activeEnemies(sim).sort((a, b) => a.id.localeCompare(b.id));
  if (!contacts.length) return null;
  return contacts[(contacts.findIndex(enemy => enemy.id === selectedId) + 1) % contacts.length].id;
}
export function objectiveFor(snapshot, selectedId = null) {
  if (snapshot.phase === 'harbor') return { title: '다음 바람을 향해', detail: '회수품을 정리하고 준비되면 출항하세요.', target: null, action: 'depart' };
  if (snapshot.phase === 'defeat') return { title: '다시 항해할 수 있어요', detail: '출항할 때의 상태에서 다시 시작합니다.', target: null, action: 'retry' };
  if (snapshot.stage?.phase === 'maintenance') return { title: '바람을 고르는 시간', detail: '공격이 정리됐습니다. 준비되면 항해를 계속하세요.', target: null, action: 'maintenance' };
  const sim = snapshot.sim;
  if (!sim) return { title: '항로를 준비하는 중', detail: '', target: null };
  const returnObjective = () => ({ title: '종항으로 돌아가기', detail: '화물은 귀환 뒤 창고에 보관하고 장착할 수 있어요.', target: { ...sim.harbor, kind: 'return', label: '종항 귀환 부표' }, action: 'return', inRange: distance(sim.player, sim.harbor) <= sim.harbor.radius });
  if (sim.cargo?.length > 0) return returnObjective();
  const debris = (sim.debris || []).filter(item => !item.salvaged && !item.lost && item.remaining > 0).sort((a, b) => distance(a, sim.player) - distance(b, sim.player))[0];
  if (debris) return { title: '떠다니는 부품 인양하기', detail: '노란 회수 표식에 다가가 F를 누르세요.', target: { ...debris, kind: 'salvage', label: '회수할 부품' }, action: 'salvage', inRange: distance(sim.player, debris) <= 10 };
  if (snapshot.stage?.phase === 'victory' || activeEnemies(sim).length === 0) return returnObjective();
  const enemy = selectContact(sim, selectedId);
  const hasConnector = enemy?.modules?.some(part => part.key === 'connector' && part.attached && part.hp > 0);
  return { title: hasConnector ? '연결부를 끊어 부품 확보하기' : '적선을 무력화하고 부품 확보하기', detail: hasConnector ? '주황색 연결부를 겨냥하세요. T로 표적을 바꿀 수 있어요.' : '이 배에는 외부 연결부가 없습니다. 선체를 겨냥하세요. T로 표적을 바꿀 수 있어요.', target: enemy && { x: enemy.x, z: enemy.z, id: enemy.id, kind: 'enemy', label: enemy.name || '적 비행선' }, action: 'fire' };
}
export function edgeIndicator(projected, width, height, inset = 56) {
  if (!projected || width <= 0 || height <= 0) return null;
  const dx = projected.x - width / 2, dy = projected.y - height / 2;
  const halfX = Math.max(1, width / 2 - inset), halfY = Math.max(1, height / 2 - inset);
  const visible = Math.abs(dx) <= halfX && Math.abs(dy) <= halfY && projected.depth >= -1 && projected.depth <= 1;
  if (visible) return { visible: false, x: projected.x, y: projected.y, degrees: 0 };
  const factor = Math.min(halfX / Math.max(Math.abs(dx), 1e-8), halfY / Math.max(Math.abs(dy), 1e-8));
  return { visible: true, x: width / 2 + dx * factor, y: height / 2 + dy * factor, degrees: Math.atan2(dx, -dy) * 180 / Math.PI };
}
