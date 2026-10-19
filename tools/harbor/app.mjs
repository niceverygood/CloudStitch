import { createExampleState, exampleReturn } from './fixtures.mjs';
import { validateState, acceptReturn, storeCargo, prepareDeparture, commitDeparture } from './core.mjs';
import { computeBudget, previewInstall, installPart, removePart, quoteRepair, confirmRepair, departureReasons } from '../shipyard/shipyard.mjs';
import { createSaveRepository } from '../save/save.mjs';
import { createDepartureManifest } from './adapters.mjs';

const byId = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const signed = n => `${n >= 0 ? '+' : ''}${n}`;
let state = createExampleState(), quote = null, saveRevision = 0, persistedStateRevision = null;
let storageBlocked = false, lastSavedAt = null, saveNotice = '아직 저장하지 않았습니다.';
let currentContact = 'warehouse';
const storage = {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => {
    if (byId('fail-save').checked) { byId('fail-save').checked = false; throw new Error('예시 쓰기 실패 주입'); }
    localStorage.setItem(key, value);
  },
};
const repo = createSaveRepository({ storage, validateState, key: 'cloudstitch.harbor.v1' });

function announce(message, error = false) {
  const el = byId('status'); el.textContent = message; el.classList.toggle('error', error);
  const li = document.createElement('li'); li.textContent = message; byId('log').prepend(li);
}
function apply(result, message) {
  if (!result.ok) { announce(result.message || result.reasons?.join(' ') || '처리하지 못했습니다.', true); return false; }
  state = result.state; quote = null; announce(message); render(); return true;
}
function saveNow() {
  const result = repo.save(state, { expectedRevision: saveRevision, boundary: state.boundary });
  if (result.ok) {
    saveRevision = result.revision ?? result.envelope?.revision ?? saveRevision + 1;
    lastSavedAt = result.savedAt ?? result.envelope?.savedAt;
    persistedStateRevision = state.revision; storageBlocked = false;
    saveNotice = '안전 지점 저장 완료'; announce(saveNotice);
  } else { saveNotice = result.message || '저장하지 못했습니다. 현재 세션을 유지합니다.'; announce(saveNotice, true); }
  render(); return result.ok;
}
function loadNow(initial = false) {
  const result = repo.load();
  if (result.ok && result.state) {
    state = result.state; saveRevision = result.revision ?? result.envelope?.revision ?? 0;
    lastSavedAt = result.savedAt ?? result.envelope?.savedAt; persistedStateRevision = state.revision;
    quote = null; storageBlocked = false; saveNotice = '최근 안전 지점에서 재개했습니다.'; announce(saveNotice);
  } else if (['EMPTY', 'NO_SAVE', 'NOT_FOUND'].includes(result.code)) {
    if (!initial) announce('저장된 항해가 없습니다. 현재 세션을 유지합니다.', true);
    else announce('저장된 항해가 없어 독립 예시 상태를 준비했습니다. 첫 출항 전에 안전 저장합니다.');
  } else {
    storageBlocked = true; saveNotice = result.message || '저장을 읽지 못했습니다. 원본을 덮어쓰지 않습니다.';
    announce(saveNotice, true); byId('recover').hidden = !result.recoveryAvailable;
  }
  render();
}
function render() {
  document.body.dataset.phase = state.phase;
  const budget = computeBudget(state), sailing = state.phase === 'sailing';
  byId('phase-label').textContent = sailing ? `예시 항해 ${state.voyageSequence} 진행 중` : state.phase === 'debrief' ? '귀환 · 정산 완료' : state.activeVoyage ? '출항 직전 안전 지점' : '안전한 종항';
  byId('budgets').innerHTML = `<table><tbody><tr><th>총중량</th><td>${budget.weight} W</td></tr><tr><th>장착 / 선내 화물</th><td>${budget.installedWeight} / ${budget.cargoWeight}</td></tr><tr><th>유효 양력 / 여유</th><td>${budget.lift} L / ${signed(budget.liftMargin)}</td></tr><tr><th>발전 / 소비 / 여유</th><td>${budget.powerSupply} / ${budget.powerDemand} / ${signed(budget.powerMargin)} P</td></tr></tbody></table>`;
  byId('resources').innerHTML = ['S','F','C'].map(k => `<div class="metric"><span>${{S:'스크랩 S',F:'연료 F',C:'봉인 천 C'}[k]}</span><div class="number">${state.resources[k]}</div></div>`).join('');
  byId('save-info').textContent = `${saveNotice}${lastSavedAt ? ` · ${new Date(lastSavedAt).toLocaleString('ko-KR')}` : ''} · ${persistedStateRevision === state.revision ? '현재 상태 저장됨' : '현재 세션에 미저장 변경 있음'}`;
  const reasons = departureReasons(state);
  byId('departure-reasons').textContent = sailing ? '예시 귀환 결과를 받으면 항구에서 안전 저장합니다.' : reasons.length ? reasons.join(' ') : '중량·양력·전력·기본 장비 확인. 재출항할 수 있습니다.';
  byId('depart').disabled = sailing || storageBlocked || reasons.length > 0;
  byId('depart').textContent = state.activeVoyage && !sailing ? '저장된 출항 준비에서 이어가기' : '저장 후 예시 출항';
  byId('return').disabled = byId('withdraw').disabled = !sailing;
  byId('store').disabled = sailing || !state.parts.some(p => p.location === 'cargo');
  byId('quote').disabled = sailing; byId('repair').disabled = sailing || !quote;
  byId('save').disabled = sailing || storageBlocked;
  const filter = byId('location-filter').value;
  byId('parts').innerHTML = state.parts.filter(p => filter === 'all' || p.location === filter).map(part => {
    const installable = part.location !== 'installed' && !part.parentId;
    const choices = state.ship.sockets.filter(s => s.parentId && s.kinds.includes(part.kind));
    return `<article class="part" data-part="${escape(part.id)}"><div class="row"><strong>${escape(part.name)}</strong><span class="badge">${{installed:'실제 장착',cargo:'선내 화물',warehouse:'항구 보관'}[part.location]}</span></div><p class="small">내구도 ${part.hp}/${part.maxHp} · 중량 ${part.weight} · 전력 ${part.powerDemand} · 출처 ${escape(part.source.originId)}</p>${installable ? `<div class="row"><select aria-label="${escape(part.name)} 장착 위치">${choices.map(s => `<option value="${escape(s.id)}">${escape(s.id)} · ${escape(s.parentId)}</option>`).join('')}</select><button data-action="preview" ${sailing || !choices.length ? 'disabled' : ''}>장착 비교</button><button data-action="install" ${sailing || !choices.length ? 'disabled' : ''}>장착 확정</button></div><p class="comparison muted small"></p>` : part.location === 'installed' && part.parentId ? `<button data-action="remove" ${sailing ? 'disabled' : ''}>하위 묶음과 보관함으로</button>` : ''}<details><summary>부품 · 연결 정보</summary><code>${escape(part.id)}</code><p class="small">소유자 ${escape(part.ownerId)} · 부모 ${escape(part.parentId || '없음')} · 소켓 ${escape(part.socketId || '없음')}</p></details></article>`;
  }).join('');
  byId('settlements').innerHTML = state.settlements.length ? [...state.settlements].reverse().map(e => `<div class="part"><strong>${e.outcome === 'completed' ? '임무 완료' : '선택 철수'} · 항해 ${escape(e.voyageId.split('-').at(-1))}</strong><table><tr><th></th><th>획득</th><th>현장 지출</th><th>계약 지급</th><th>순변동</th></tr>${['S','F','C'].map(k => `<tr><th>${k}</th><td>+${e.gained[k]}</td><td>-${e.spent[k]}</td><td>+${e.contractPaid[k]}</td><td>${signed(e.net[k])}</td></tr>`).join('')}</table><p class="small muted">회수 ${e.partIds.length}개 · 항구 수리는 별도 실소비 · ${e.evidence === 'independent-example' ? '독립 예시 검증용' : '전장 어댑터 입력'}</p></div>`).join('') : '<p class="muted">아직 정산된 항해가 없습니다.</p>';
  const receipt = state.repairReceipts.at(-1);
  byId('repair-detail').textContent = (quote ? `미지불 견적: ${quote.recovery} 내구도 복구 / ${quote.cost.S} S. 확정 전에는 소비하지 않습니다.` : '견적을 요청하면 미지불 금액을 표시합니다.') + (receipt ? ` 마지막 실제 수리: ${receipt.recovery} 복구 / ${receipt.cost.S} S 지불.` : '');
  byId('contracts').textContent = `세계 접점 ${WORLD_CONTACTS.contacts.map(c => `${c.label}: ${c.assetId}`).join(' / ')}. 실제 3D 좌표·충돌과 전장 적용은 통합 담당 연결 범위입니다.`;
  document.querySelectorAll('[data-contact]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.contact === currentContact)));
  byId('contact-note').textContent = {warehouse:'보관은 화물 무게를 배에서 내립니다. 실제 장착과 출력은 별도로 유지됩니다.',shipyard:'부품과 장착 위치를 선택해 전후 예산과 거부 이유를 확인하세요.',market:'천 시장은 종항 카탈로그 접점입니다. 매매·제작 가격은 아직 적용하지 않았습니다.',departure:'출항 직전 안전 저장이 성공한 뒤 예시 항해를 시작합니다.'}[currentContact];
}

byId('store').onclick = () => apply(storeCargo(state), '회수 화물을 항구 보관함으로 옮겼습니다.');
byId('location-filter').onchange = render;
byId('quote').onclick = () => { const result = quoteRepair(state); if (result.ok === false) { announce(result.message || result.reasons?.join(' '), true); return; } quote = result.quote || result; announce('수리 견적을 확인했습니다. 아직 지불하지 않았습니다.'); render(); };
byId('repair').onclick = () => { const result = confirmRepair(state, quote); if (apply(result, `실제 복구 ${quote?.recovery || 0} / ${quote?.cost.S || 0} S 지불`)) saveNow(); };
byId('save').onclick = saveNow;
byId('load').onclick = () => { if (persistedStateRevision !== state.revision && !confirm('현재 미저장 작업을 버리고 마지막 안전 지점으로 돌아갈까요?')) return; loadNow(); };
byId('depart').onclick = () => {
  if (!state.activeVoyage) { const prepared = prepareDeparture(state); if (!apply(prepared, '출항 직전 상태를 준비했습니다.')) return; }
  if (!saveNow()) return;
  const result = commitDeparture(state); if (apply(result, '예시 출항을 시작했습니다. 안전 저장은 출항 직전 상태입니다.')) window.cloudstitchDepartureManifest = createDepartureManifest(state);
};
function receive(outcome) { const result = acceptReturn(state, exampleReturn(state, outcome)); if (apply(result, outcome === 'completed' ? '예시 임무 완료. 보상과 회수품을 한 번 정산했습니다.' : '선택 철수. 확정 회수품은 보존하고 미완료 계약 보상은 지급하지 않았습니다.')) saveNow(); }
byId('return').onclick = () => receive('completed'); byId('withdraw').onclick = () => receive('withdrawn');
byId('recover').onclick = () => { const result = repo.recoverBackup(); if (result.ok) { byId('recover').hidden = true; loadNow(); } else announce(result.message, true); };
byId('export').onclick = () => {
  const result = repo.exportCurrent();
  const raw = typeof result === 'string' ? result : result.raw || result.data || result.json;
  if (!raw) { announce(result.message || '내려받을 저장이 없습니다.', true); return; }
  const url = URL.createObjectURL(new Blob([raw], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'Cloudstitch-harbor-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
byId('parts').onclick = event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const card = button.closest('[data-part]'), id = card.dataset.part, socketId = card.querySelector('select')?.value;
  if (button.dataset.action === 'preview') {
    const result = previewInstall(state, id, socketId);
    card.querySelector('.comparison').textContent = `중량 W ${result.before?.weight} → ${result.after?.weight ?? '—'} / 양력 L ${result.before?.lift} → ${result.after?.lift ?? '—'} / 전력 발전·소비 ${result.before?.powerSupply}·${result.before?.powerDemand} → ${result.after?.powerSupply ?? '—'}·${result.after?.powerDemand ?? '—'}. ${result.ok ? '장착 가능' : (result.reasons || []).join(' ')}`;
  } else if (button.dataset.action === 'install') apply(installPart(state, id, socketId), '선택한 위치에 장착했습니다. 부품 ID와 소유권을 유지합니다.');
  else apply(removePart(state, id, {destination:'warehouse'}), '선택 부품과 하위 묶음을 보관함으로 옮겼습니다.');
};
document.querySelectorAll('[data-contact]').forEach(button => button.onclick = () => {currentContact = button.dataset.contact; render();});
window.cloudstitchHarbor = { getState: () => structuredClone(state), validate: () => validateState(state), repo, version:'harbor-v1.0.0' };
loadNow(true);
