import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getImpactfulProfile, IMPACTFUL_EFFECT_IDS } from './profiles.mjs';
import { getRichProfile } from '../vfx-rich-profiles.mjs';
import { runtimeAssetDescriptors } from '../vfx-contract.mjs';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [catalog, recipes] = await Promise.all([
  json('../../../outputs/combat-vfx/catalog.json'), json('../../../outputs/combat-vfx/recipes.json'),
]);

test('impactful covers exactly the real 48 v1 semantic IDs and categories', () => {
  assert.equal(IMPACTFUL_EFFECT_IDS.length, 48);
  assert.deepEqual([...IMPACTFUL_EFFECT_IDS].sort(), catalog.items.map(item => item.id).sort());
  assert.deepEqual([...IMPACTFUL_EFFECT_IDS].sort(), recipes.effects.map(item => item.id).sort());
  for (const item of catalog.items) assert.equal(getImpactfulProfile(item.id).category, item.category);
});

test('unknown identifiers cannot acquire a profile', () => {
  for (const id of ['toString', '__proto__', 'unknown-hit', '../cannon-hit', null, 1, {}, ['cannon-hit']]) {
    assert.throws(() => getImpactfulProfile(id), RangeError);
  }
});

test('display dimensions remain bounded with at most four layers and three asymmetric echoes', () => {
  for (const id of IMPACTFUL_EFFECT_IDS) {
    const p = getImpactfulProfile(id);
    assert.deepEqual(Object.keys(p).sort(), ['category', 'echoes', 'projectile', 'scale', 'stateful', 'stretch']);
    assert.ok(p.scale >= 1.6 && p.scale <= 2.6, id);
    assert.equal(p.stretch.length, 3);
    assert.ok(p.stretch.every(axis => Number.isFinite(axis) && axis >= .8 && axis <= 1.3), id);
    assert.ok(p.echoes.length <= 3, id);
    for (const e of p.echoes) {
      assert.ok(e.delay >= .02 && e.delay <= .16, id);
      assert.ok(e.scale >= .4 && e.scale <= .8, id);
      assert.ok(Math.abs(e.rotation) >= .2 && Math.abs(e.rotation) <= .6, id);
      assert.equal(e.offset.length, 3);
      assert.ok(e.offset.every(axis => Number.isFinite(axis) && Math.abs(axis) <= .2), id);
      assert.equal(e.stretch.length, 3);
      assert.ok(e.stretch.every(axis => Number.isFinite(axis) && axis >= .8 && axis <= 1.3), id);
      assert.ok(new Set(e.stretch).size > 1, 'layers need deliberate width/height variation');
    }
  }
});

test('the six real runtime effects retain IDs and clips with a visibly stronger hierarchy', () => {
  const before = structuredClone({ catalog, recipes });
  const descriptors = runtimeAssetDescriptors(catalog, recipes);
  assert.equal(descriptors.length, 6);
  for (const descriptor of descriptors) {
    const p = getImpactfulProfile(descriptor.id), old = getRichProfile(descriptor.id);
    assert.ok(p.scale / old.scale >= 1.2, descriptor.id);
    assert.equal(p.projectile, descriptor.kind === 'projectile');
    assert.equal(descriptor.model, `assets/${descriptor.id}.glb`);
    if (descriptor.kind === 'projectile') assert.deepEqual(p.echoes, []);
    else assert.ok(p.echoes.length >= 2);
  }
  assert.ok(getImpactfulProfile('cannon-hit').scale > getImpactfulProfile('machine-gun-hit').scale);
  assert.deepEqual({ catalog, recipes }, before);
});

test('all five projectile carriers remain one undistorted copy', () => {
  let count = 0;
  for (const recipe of recipes.effects) {
    const p = getImpactfulProfile(recipe.id);
    assert.equal(p.projectile, recipe.attachment.mode === 'projectile', recipe.id);
    if (!p.projectile) continue;
    count++;
    assert.equal(p.scale, 1.65);
    assert.deepEqual(p.stretch, [1, 1, 1]);
    assert.deepEqual(p.echoes, []);
  }
  assert.equal(count, 5);
});

test('loop states and unique harpoon/repair/recovery/mount markers never multiply actions', () => {
  for (const item of catalog.items) {
    const p = getImpactfulProfile(item.id);
    assert.equal(p.stateful, item.loop, item.id);
    if (p.stateful) assert.deepEqual(p.echoes, [], item.id);
  }
  for (const id of ['harpoon-launch', 'harpoon-projectile', 'harpoon-hit', 'ricochet-hit',
    'salvage-tether', 'mount-lock', 'repair-stitch', 'healing-pulse', 'module-detach-state', 'penetration-exit']) {
    assert.deepEqual(getImpactfulProfile(id).echoes, [], id);
  }
  assert.deepEqual(getImpactfulProfile('salvage-tether').stretch, [1, 1, 1]);
});

test('explosion, smoke, state and support intensity remain distinguishable', () => {
  assert.equal(getImpactfulProfile('large-explosion').scale, 2.6);
  assert.equal(getImpactfulProfile('small-explosion').scale, 2.5);
  for (const id of ['smoke-puff', 'steam-vent', 'smoldering-fire', 'ember-drift', 'cloud-miss']) assert.equal(getImpactfulProfile(id).scale, 2.0);
  for (const item of catalog.items) {
    if (['damage-state', 'defense-support'].includes(item.category)) assert.equal(getImpactfulProfile(item.id).scale, 1.6);
  }
});

test('echoes fit source lifetime and cannot redefine asset, damage, collision or motion', () => {
  for (const item of catalog.items) {
    const p = getImpactfulProfile(item.id);
    for (const e of p.echoes) assert.ok(e.delay < item.duration, item.id);
    for (const key of ['model', 'clip', 'duration', 'damage', 'collision', 'radius', 'range', 'velocity', 'target', 'sourceId', 'material']) {
      assert.equal(Object.hasOwn(p, key), false, `${item.id}: ${key}`);
    }
    assert.equal(item.model, `assets/${item.id}.glb`);
  }
});

test('profile data and nested vectors are immutable', () => {
  const p = getImpactfulProfile('cannon-hit');
  for (const value of [IMPACTFUL_EFFECT_IDS, p, p.stretch, p.echoes, p.echoes[0], p.echoes[0].stretch, p.echoes[0].offset]) assert.ok(Object.isFrozen(value));
  assert.throws(() => { p.stretch[0] = 10; }, TypeError);
  assert.throws(() => { p.echoes[0].scale = 10; }, TypeError);
  assert.equal(getImpactfulProfile('cannon-hit').scale, 2.4);
});
