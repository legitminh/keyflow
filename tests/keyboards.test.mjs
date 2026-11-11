import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { create_keyboard_store, create_grid_keyboard, keyboard_layouts } from '../dist/keyboards.js';
import { parse_shortcut } from '../dist/shortcuts.js';

test('built-in layouts have the requested shapes and valid input keys', () => {
  const count = (layout) => layout.rows.flat().length;
  assert.equal(count(keyboard_layouts.alpha), 26);
  assert.equal(count(keyboard_layouts.alphanumeric), 36);
  assert.deepEqual(keyboard_layouts.grid16.rows.map((r) => r.length), [4, 4, 4, 4]);
  assert.deepEqual(keyboard_layouts.grid32.rows.map((r) => r.length), [8, 8, 8, 8]);
  assert.deepEqual(keyboard_layouts.ortholinear.rows.map((r) => r.length), [12, 12, 12, 12]);
  assert.equal(count(keyboard_layouts['60%']), 61);
  for (const layout of Object.values(keyboard_layouts)) {
    for (const key of layout.rows.flat()) assert.equal(parse_shortcut([key.key]).length, 1);
    assert.ok(Object.isFrozen(layout.rows));
  }
});

test('grid builder supports arbitrary dimensions and custom keys', () => {
  const keys = ['a', { key: 'b', color: 'red', label: 'B' }, 'c', 'd', 'e'];
  const layout = create_grid_keyboard('custom', keys, 3, 'Custom');
  assert.deepEqual(layout.rows.map((r) => r.length), [3, 2]);
  assert.equal(layout.rows[0][1].color, 'red');
  assert.notEqual(layout.rows[0][1], keys[1]);
  for (const invalid of [0, -1, 1.5, NaN]) assert.throws(() => create_grid_keyboard('x', [], invalid), RangeError);
});

test('keyboard registry manages add, update, select, remove and nullable active state', () => {
  const store = create_keyboard_store([keyboard_layouts.alpha]);
  assert.equal(get(store.active), null);
  store.select('alpha');
  assert.equal(get(store.active), keyboard_layouts.alpha);
  const updated = { ...keyboard_layouts.alpha, label: 'Updated' };
  store.update(updated);
  assert.equal(get(store.active), updated);
  assert.equal(get(store.keyboards)[0], updated);
  store.add(keyboard_layouts.grid16);
  store.select('grid16');
  store.remove('alpha');
  assert.equal(get(store.active).id, 'grid16');
  store.remove('grid16');
  assert.equal(get(store.active), null);
  assert.deepEqual(get(store.keyboards), []);
  store.remove('missing');
  assert.throws(() => store.select('missing'), RangeError);
  assert.throws(() => store.update(keyboard_layouts.alpha), RangeError);
  store.add(keyboard_layouts.alpha);
  assert.throws(() => store.add(keyboard_layouts.alpha), RangeError);
  store.select(null);
});

test('separate project registries never share selection or entries', () => {
  const first = create_keyboard_store([keyboard_layouts.alpha], 'alpha');
  const second = create_keyboard_store();
  first.remove('alpha');
  assert.equal(get(second.active), null);
  assert.equal(get(second.keyboards).length, 0);
});
