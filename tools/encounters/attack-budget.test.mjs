import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateAttackTokens } from './attack-budget.mjs';

const unit = (enemyId, warningActive = false, ready = true) => ({ enemyId, warningActive, ready });

test('opening admits one ready attacker and later phases admit two', () => {
  assert.deepEqual(allocateAttackTokens({ units: [unit('a'), unit('b')], maxTokens: 1 }).permittedEnemyIds, ['a']);
  assert.deepEqual(allocateAttackTokens({ units: [unit('a'), unit('b'), unit('c')], maxTokens: 2 }).permittedEnemyIds, ['a', 'b']);
});

test('active warning keeps its slot even when a ready enemy appears earlier', () => {
  const budget = allocateAttackTokens({ units: [unit('new'), unit('active', true, false)], maxTokens: 1 });
  assert.deepEqual(budget.permittedEnemyIds, ['active']); assert.equal(budget.admittedStarts, 0);
});

test('completed warning frees a slot only from new authoritative host facts', () => {
  const budget = allocateAttackTokens({ units: [unit('cooling', false, false), unit('ready')], maxTokens: 1 });
  assert.deepEqual(budget.permittedEnemyIds, ['ready']);
});

test('maintenance with no active warnings grants no new attack', () => {
  assert.deepEqual(allocateAttackTokens({ units: [unit('a')], maxTokens: 0 }).permittedEnemyIds, []);
});

test('an already-invalid host state is reported without silently cancelling warnings', () => {
  const budget = allocateAttackTokens({ units: [unit('a', true), unit('b', true), unit('new')], maxTokens: 1 });
  assert.deepEqual(budget.permittedEnemyIds, ['a', 'b']);
  assert(budget.exceededByExistingWarnings); assert.equal(budget.admittedStarts, 0);
});

test('facts stay immutable; invalid caps and duplicate identities are rejected', () => {
  const units = [unit('a'), unit('b')], before = structuredClone(units);
  allocateAttackTokens({ units, maxTokens: 1 }); assert.deepEqual(units, before);
  assert.throws(() => allocateAttackTokens({ units, maxTokens: -1 }));
  assert.throws(() => allocateAttackTokens({ units: [unit('a'), unit('a')], maxTokens: 1 }));
});
