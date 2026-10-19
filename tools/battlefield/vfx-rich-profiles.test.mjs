import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getRichProfile, RICH_EFFECT_IDS } from './vfx-rich-profiles.mjs';
import { runtimeAssetDescriptors } from './vfx-contract.mjs';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [catalog, recipes] = await Promise.all([
  json('../../outputs/combat-vfx/catalog.json'), json('../../outputs/combat-vfx/recipes.json'),
]);

test('rich profiles cover exactly the actual 48 v1 effect IDs and preserve catalog categories', () => {
  assert.equal(catalog.items.length, 48);
  assert.equal(new Set(catalog.items.map(item => item.id)).size, 48);
  assert.deepEqual([...RICH_EFFECT_IDS].sort(), catalog.items.map(item => item.id).sort());
  assert.deepEqual([...RICH_EFFECT_IDS].sort(), recipes.effects.map(recipe => recipe.id).sort());
  for (const item of catalog.items) assert.equal(getRichProfile(item.id).category, item.category, item.id);
});

test('unknown IDs and object prototype names cannot acquire a profile', () => {
  for (const id of ['unknown-hit', 'machine-gun-muzzle-v2', '../machine-gun-hit', 'toString', '__proto__',
    null, undefined, 1, {}, ['machine-gun-hit']]) {
    assert.throws(() => getRichProfile(id), RangeError);
  }
});

test('every profile has finite bounded display values and no more than two small echoes', () => {
  for (const id of RICH_EFFECT_IDS) {
    const p = getRichProfile(id);
    assert.deepEqual(Object.keys(p).sort(), ['category', 'echoes', 'projectile', 'scale', 'stateful']);
    assert.ok(Number.isFinite(p.scale) && p.scale >= 1.3 && p.scale <= 1.6, id);
    assert.equal(typeof p.projectile, 'boolean'); assert.equal(typeof p.stateful, 'boolean');
    assert.ok(Array.isArray(p.echoes) && p.echoes.length <= 2, id);
    for (const e of p.echoes) {
      assert.deepEqual(Object.keys(e).sort(), ['delay', 'offset', 'rotation', 'scale']);
      assert.ok(Number.isFinite(e.delay) && e.delay >= .02 && e.delay <= .08, id);
      assert.ok(Number.isFinite(e.scale) && e.scale >= .45 && e.scale <= .7, id);
      assert.ok(Number.isFinite(e.rotation) && Math.abs(e.rotation) >= .18 && Math.abs(e.rotation) <= .4, id);
      assert.equal(e.offset.length, 3);
      assert.ok(e.offset.every(value => Number.isFinite(value) && Math.abs(value) <= .1), id);
    }
  }
});

test('the existing six MG/cannon runtime bindings keep the same ID, models, clips and lifetimes', () => {
  const before = structuredClone({ catalog, recipes });
  const descriptors = runtimeAssetDescriptors(catalog, recipes);
  assert.equal(descriptors.length, 6);
  for (const descriptor of descriptors) {
    const p = getRichProfile(descriptor.id), item = catalog.items.find(value => value.id === descriptor.id);
    assert.equal(p.scale, descriptor.kind === 'muzzle' ? 1.4 : descriptor.kind === 'projectile' ? 1.35 : 1.5);
    assert.equal(p.projectile, descriptor.kind === 'projectile');
    assert.equal(p.stateful, false);
    assert.equal(descriptor.model, `assets/${descriptor.id}.glb`);
    assert.equal(descriptor.catalogDuration, item.duration);
    if (descriptor.kind === 'projectile') assert.deepEqual(p.echoes, []);
    else assert.ok(p.echoes.length >= 1 && p.echoes.length <= 2);
  }
  assert.deepEqual({ catalog, recipes }, before, 'profile lookup does not mutate authored source metadata');
  assert.deepEqual(runtimeAssetDescriptors(catalog, recipes), descriptors);
});

test('actual projectile attachments remain a single display and never receive echo copies', () => {
  const projectiles = recipes.effects.filter(recipe => recipe.attachment.mode === 'projectile');
  assert.equal(projectiles.length, 5);
  for (const recipe of recipes.effects) {
    const p = getRichProfile(recipe.id);
    assert.equal(p.projectile, recipe.attachment.mode === 'projectile', recipe.id);
    if (p.projectile) { assert.equal(p.scale, 1.35); assert.deepEqual(p.echoes, []); }
  }
});

test('actual loop-owned states keep one visual instance without extending real state lifetime', () => {
  assert.equal(catalog.items.filter(item => item.loop).length, 9);
  for (const item of catalog.items) {
    const recipe = recipes.effects.find(value => value.id === item.id), p = getRichProfile(item.id);
    assert.equal(item.loop, recipe.loop, item.id);
    assert.equal(p.stateful, item.loop, item.id);
    if (p.stateful) assert.deepEqual(p.echoes, [], item.id);
  }
});

test('harpoon, recovery, mounting and repair markers never imply duplicate actions', () => {
  for (const id of ['harpoon-launch', 'harpoon-projectile', 'harpoon-hit', 'salvage-tether',
    'mount-lock', 'repair-stitch', 'healing-pulse', 'module-detach-state']) {
    assert.deepEqual(getRichProfile(id).echoes, [], id);
  }
});

test('smoke/explosions are enlarged while support and damage indicators use a restrained scale', () => {
  for (const item of catalog.items) {
    const p = getRichProfile(item.id);
    if (item.category === 'explosion-environment' || item.id === 'cloud-miss') assert.equal(p.scale, 1.6, item.id);
    if (['damage-state', 'defense-support'].includes(item.category)) assert.equal(p.scale, 1.3, item.id);
  }
});

test('echo delays fit inside each actual clip and do not supply an alternate lifetime or source', () => {
  for (const item of catalog.items) {
    const p = getRichProfile(item.id);
    for (const e of p.echoes) assert.ok(e.delay < item.duration, item.id);
    for (const key of ['model', 'sourceId', 'clip', 'duration', 'loop', 'color', 'material', 'damage',
      'radius', 'range', 'velocity', 'collision', 'spawn', 'target']) assert.equal(Object.hasOwn(p, key), false, `${item.id}: ${key}`);
    // Original and rich modes resolve the very same semantic GLB/recipe. Rich
    // data has no alternate source or palette and cannot promote any v2 asset.
    assert.equal(item.model, `assets/${item.id}.glb`);
    assert.equal(recipes.effects.find(value => value.id === item.id).model, item.model);
  }
});

test('shared profiles and nested echo parameters cannot be changed by a renderer instance', () => {
  const p = getRichProfile('cannon-muzzle');
  assert.ok(Object.isFrozen(RICH_EFFECT_IDS)); assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.echoes)); assert.ok(Object.isFrozen(p.echoes[0]));
  assert.ok(Object.isFrozen(p.echoes[0].offset));
  assert.throws(() => { p.scale = 4; }, TypeError);
  assert.throws(() => { p.echoes[0].offset[0] = 20; }, TypeError);
  assert.equal(getRichProfile('cannon-muzzle').scale, 1.4);
});
