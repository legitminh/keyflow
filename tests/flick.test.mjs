import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve_flick_direction } from '../dist/flick.js';
import { keyboard_layouts, create_grid_keyboard } from '../dist/keyboards.js';
import { press_virtual_key } from '../dist/input-events.js';

const bounds = { left: 100, right: 200, top: 100, bottom: 200 };
test('flicks use final release beyond the original border; inside and border are taps', () => {
  for (const [x, y, side] of [[150, 99, 'up'], [150, 201, 'down'], [99, 150, 'left'], [201, 150, 'right'],
    [150, 150, null], [100, 100, null], [200, 200, null]]) {
    assert.equal(resolve_flick_direction(bounds, x, y), side);
  }
});
test('diagonal flicks choose normalized overrun, with vertical ties', () => {
  assert.equal(resolve_flick_direction(bounds, 50, 80), 'left');
  assert.equal(resolve_flick_direction(bounds, 220, 250), 'down');
  assert.equal(resolve_flick_direction(bounds, 50, 50), 'up');
  assert.equal(resolve_flick_direction({ left: 0, right: 200, top: 0, bottom: 100 }, 240, -30), 'up');
});
test('flick alpha has exactly the requested 3×10 grid and no extra mappings', () => {
  const layout = keyboard_layouts['flick-alpha'];
  assert.deepEqual(layout.rows.map((row) => row.map((key) => key.key)), [
    [...'qwertyuiop'], [...'asdfghjkl;'], [...'zxcvbnm,.', 'space']
  ]);
  const expected = Object.fromEntries([...'abcdefghijklmnopqrstuvwxyz'].map((key) => [key, { down: key.toUpperCase() }]));
  [...'qwertyuiop'].forEach((key, index) => expected[key].up = String((index + 1) % 10));
  Object.assign(expected.b, { left: '[', right: ']' });
  Object.assign(expected.c, { left: '{', right: '}' });
  expected[';'] = { up: ':' };
  expected[','] = { left: '<', right: '>' };
  expected['.'] = {};
  expected.space = { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' };
  for (const key of layout.rows.flat()) {
    assert.deepEqual(key.flick, expected[key.key], key.key);
    assert.ok(Object.isFrozen(key.flick));
    assert.equal(key.width ?? 1, 1);
  }
});
test('virtual uppercase translations preserve case for adapters while using stable key identities', () => {
  const events = [];
  press_virtual_key('Q', (event) => events.push(event));
  assert.deepEqual(events.map(({ type, key, code }) => ({ type, key, code })), [
    { type: 'keydown', key: 'Q', code: 'Virtual:q' },
    { type: 'keyup', key: 'Q', code: 'Virtual:q' }
  ]);
});
test('custom layouts mix ordinary and flick keys without sharing mutable translations', () => {
  const source = { key: 'a', flick: { up: { key: '1', label: 'One' } } };
  const layout = create_grid_keyboard('mixed', [source, 'b'], 2);
  assert.deepEqual(layout.rows[0][1], { key: 'b' });
  layout.rows[0][0].flick.up.label = 'Changed';
  assert.equal(source.flick.up.label, 'One');
});
